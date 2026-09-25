/* EmberSculpt — code-driven digital sculpting. A character is a list of signed
 * distance primitives (smooth-unioned, carved, displaced) with a material and a
 * bone each; bake() polygonises the field with narrow-band surface nets and
 * returns a seamless mesh with per-vertex albedo, AO, cavity, convexity,
 * roughness/metal/emissive, face-decal UVs and automatic skin weights.
 * Pure math, no three.js: runs in the page, a worker or Node. */
(function (root) {
  "use strict";
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ noise
  function hash3(i, j, k) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function vnoise(x, y, z) { // value noise in [-1, 1]
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
    const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
    const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
    return 2 * mix(mix(mix(a, b, fx), mix(c, d, fx), fy), mix(mix(e, f, fx), mix(g, h, fx), fy), fz) - 1;
  }
  function fbm(x, y, z, oct = 3) { let s = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { s += a * vnoise(x, y, z); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.2; a *= 0.5; } return s / n; }

  // ------------------------------------------------------------------ transforms
  // euler XYZ → 3x3 rotation (row-major), local = R^T (p - c) / s
  function rotm(ex = 0, ey = 0, ez = 0) {
    const cx = Math.cos(ex), sx = Math.sin(ex), cy = Math.cos(ey), sy = Math.sin(ey), cz = Math.cos(ez), sz = Math.sin(ez);
    // R = Rx * Ry * Rz (three.js 'XYZ' order)
    return [
      cy * cz, -cy * sz, sy,
      cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
      sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
    ];
  }
  // rotation taking +Y to direction d (for shapes authored along Y)
  function rotY2(dx, dy, dz) {
    const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
    // axis = Y × d, angle = acos(dy)
    let ax = dz, az = -dx; const s = Math.hypot(ax, az);
    if (s < 1e-8) return dy > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, -1, 0, 0, 0, -1];
    ax /= s; az /= s; const c = dy, t = 1 - c, sn = s;
    return [
      t * ax * ax + c, -sn * az, t * ax * az,
      sn * az, c, -sn * ax,
      t * ax * az, sn * ax, t * az * az + c,
    ];
  }
  function mat3mul(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }

  // ------------------------------------------------------------------ shapes (local space)
  // Each returns { f(x,y,z) → distance, b: [minx,miny,minz,maxx,maxy,maxz] local bounds }
  const S = {
    sphere(r) { return { f: (x, y, z) => Math.sqrt(x * x + y * y + z * z) - r, b: [-r, -r, -r, r, r, r] }; },
    ell(a, b, c) {
      return {
        f(x, y, z) {
          const k0 = Math.sqrt((x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2);
          const k1 = Math.sqrt((x / (a * a)) ** 2 + (y / (b * b)) ** 2 + (z / (c * c)) ** 2);
          return k1 < 1e-9 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1;
        },
        b: [-a, -b, -c, a, b, c],
      };
    },
    box(bx, by, bz, r = 0) {
      return {
        f(x, y, z) {
          const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
          const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
          return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
        },
        b: [-bx, -by, -bz, bx, by, bz],
      };
    },
    // round cone along +Y from 0 (radius r1) to h (radius r2)
    rcone(h, r1, r2) {
      const b = (r1 - r2) / h, a = Math.sqrt(Math.max(1e-9, 1 - b * b));
      return {
        f(x, y, z) {
          const qx = Math.sqrt(x * x + z * z), qy = y;
          const k = -qx * b + qy * a; // dot(q, vec2(-b, a))
          if (k < 0) return Math.sqrt(qx * qx + qy * qy) - r1;
          if (k > a * h) return Math.sqrt(qx * qx + (qy - h) * (qy - h)) - r2;
          return qx * a + qy * b - r1;
        },
        b: [-Math.max(r1, r2), -r1, -Math.max(r1, r2), Math.max(r1, r2), h + r2, Math.max(r1, r2)],
      };
    },
    // elliptic cross-section round cone: x scaled by sx, z by sz (approximate)
    ercone(h, r1, r2, sx = 1, sz = 1) {
      const c = S.rcone(h, r1, r2), m = Math.min(sx, sz);
      return { f: (x, y, z) => c.f(x / sx, y, z / sz) * m, b: [c.b[0] * sx, c.b[1], c.b[2] * sz, c.b[3] * sx, c.b[4], c.b[5] * sz] };
    },
    torus(R, r) { return { f: (x, y, z) => Math.hypot(Math.hypot(x, z) - R, y) - r, b: [-R - r, -r, -R - r, R + r, r, R + r] }; },
    // cylinder along Y, half height h, radius r, edge rounding e
    cyl(h, r, e = 0) {
      return {
        f(x, y, z) {
          const dx = Math.hypot(x, z) - r + e, dy = Math.abs(y) - h + e;
          return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - e;
        },
        b: [-r, -h, -r, r, h, r],
      };
    },
    // quadratic bezier tube (control points local), radius r0 → r1 (+ optional flatten in local Z)
    bez(A, B, C, r0, r1, flat = 1) {
      const pts = [];
      const N = 24;
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t;
        pts.push([u * u * A[0] + 2 * u * t * B[0] + t * t * C[0], u * u * A[1] + 2 * u * t * B[1] + t * t * C[1], u * u * A[2] + 2 * u * t * B[2] + t * t * C[2], mix(r0, r1, t)]);
      }
      return S.chain(pts, flat);
    },
    // polyline of spheres swept (piecewise round cones), pts = [[x,y,z,r], ...]
    chain(pts, flat = 1) {
      const segs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay, az, ra] = pts[i], [bx, by, bz, rb] = pts[i + 1];
        const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz;
        segs.push({ ax, ay, az, dx, dy, dz, L2, ra, rb });
      }
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const [x, y, z, r] of pts) { mn = [Math.min(mn[0], x - r), Math.min(mn[1], y - r), Math.min(mn[2], z - r)]; mx = [Math.max(mx[0], x + r), Math.max(mx[1], y + r), Math.max(mx[2], z + r)]; }
      return {
        f(x, y, z) {
          z /= flat;
          let best = 1e9;
          for (const s of segs) {
            const px = x - s.ax, py = y - s.ay, pz = z - s.az;
            const t = s.L2 > 0 ? clamp((px * s.dx + py * s.dy + pz * s.dz) / s.L2, 0, 1) : 0;
            const qx = px - s.dx * t, qy = py - s.dy * t, qz = pz - s.dz * t;
            const d = Math.sqrt(qx * qx + qy * qy + qz * qz) - mix(s.ra, s.rb, t);
            if (d < best) best = d;
          }
          return best * Math.min(1, flat);
        },
        b: [mn[0], mn[1], mn[2] * flat, mx[0], mx[1], mx[2] * flat],
      };
    },
    // capped torus arc in XY plane, opening half-angle `an` around +Y, major R, minor r
    arc(R, r, an) {
      const sc = [Math.sin(an), Math.cos(an)];
      return {
        f(x, y, z) {
          const px = Math.abs(x), k = sc[1] * px > sc[0] * y ? px * sc[0] + y * sc[1] : Math.hypot(px, y);
          return Math.sqrt(x * x + y * y + z * z + R * R - 2 * R * k) - r;
        },
        b: [-R - r, -R - r, -r, R + r, R + r, r],
      };
    },
    plane(nx, ny, nz, o = 0) { const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L; return { f: (x, y, z) => x * nx + y * ny + z * nz - o, b: [-9, -9, -9, 9, 9, 9] }; },
    custom(f, b) { return { f, b }; },
  };
  // shell of any shape: |d| - t
  S.shell = (sh, t) => ({ f: (x, y, z) => Math.abs(sh.f(x, y, z)) - t, b: sh.b.map((v, i) => v + (i < 3 ? -t : t)) });
  // intersection / subtraction inside one primitive (hard or smooth)
  S.inter = (a, bsh, k = 0) => ({ f: (x, y, z) => smax(a.f(x, y, z), bsh.f(x, y, z), k), b: a.b });
  S.minus = (a, bsh, k = 0) => ({ f: (x, y, z) => smax(a.f(x, y, z), -bsh.f(x, y, z), k), b: a.b });
  S.union = (a, bsh, k = 0) => ({ f: (x, y, z) => smin(a.f(x, y, z), bsh.f(x, y, z), k), b: a.b.map((v, i) => (i < 3 ? Math.min(v, bsh.b[i]) : Math.max(v, bsh.b[i]))) });
  S.at = (sh, ox, oy, oz) => ({ f: (x, y, z) => sh.f(x - ox, y - oy, z - oz), b: [sh.b[0] + ox, sh.b[1] + oy, sh.b[2] + oz, sh.b[3] + ox, sh.b[4] + oy, sh.b[5] + oz] });

  function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return mix(b, a, h) - k * h * (1 - h); }
  function smax(a, b, k) { return -smin(-a, -b, k); }

  // ------------------------------------------------------------------ scene of primitives
  class Sculpture {
    constructor() { this.prims = []; this.paints = []; this.bones = []; this.boneIndex = new Map(); this.mats = new Map(); this.faces = []; this.part = "body"; }
    // run fn with every primitive added inside it tagged as belonging to `part`
    inPart(part, fn) { const was = this.part; this.part = part; try { fn(); } finally { this.part = was; } }
    parts() { return [...new Set(this.prims.map((p) => p.part))]; }
    bone(name, parent, x, y, z) {
      const i = this.bones.length;
      this.bones.push({ name, parent: parent == null ? -1 : this.boneIndex.get(parent), head: [x, y, z] });
      this.boneIndex.set(name, i); return i;
    }
    mat(name, m) { this.mats.set(name, Object.assign({ name, color: [1, 1, 1], rough: 0.7, metal: 0, emit: 0, cls: 0, vary: 0.04, pattern: null, fur: 1 }, m)); }
    /* add a primitive
     *  shape: from S; o: { p:[x,y,z] centre, r:[ex,ey,ez] | R: 3x3, s: uniform scale,
     *     k: blend radius, op: 'add'|'sub'|'int', mat, bone, sigma, wg, cs (colour softness),
     *     disp: (x,y,z) => offset, dispAmp: bound, cut: material shown on carved faces } */
    add(shape, o = {}) {
      const R = o.R || (o.r ? rotm(o.r[0], o.r[1], o.r[2]) : null), c = o.p || [0, 0, 0], s = o.s || 1;
      const p = {
        f: shape.f, s, R, c, k: o.k ?? 0.006, op: o.op === "sub" ? 1 : o.op === "int" ? 2 : o.op === "wrap" ? 3 : 0, t: o.t || 0,
        mat: o.mat, bone: o.bone == null ? 0 : typeof o.bone === "string" ? this.boneIndex.get(o.bone) : o.bone,
        sigma: o.sigma ?? 0.012, wg: o.wg || 0, cs: o.cs ?? 0.12, disp: o.disp || null, cut: o.cut || null,
        bones: o.bones || null, // fixed [[boneName, w], ...]
        part: o.part || this.part || "body",
        feat: !!o.feat, vdil: o.vdil, // voxel bake: small facial feature (skipped) / dilation override (voxels)
      };
      if (p.bones) p.bones = p.bones.map(([b, w]) => [typeof b === "string" ? this.boneIndex.get(b) : b, w]);
      if (p.bone === undefined) throw new Error("unknown bone " + o.bone);
      // model-space bounds
      const b = shape.b, inf = Math.max(p.k, 0.004) + (o.dispAmp || 0) + (p.t || 0);
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < 8; i++) {
        let x = (i & 1 ? b[3] : b[0]) * s, y = (i & 2 ? b[4] : b[1]) * s, z = (i & 4 ? b[5] : b[2]) * s;
        if (R) { const X = R[0] * x + R[1] * y + R[2] * z, Y = R[3] * x + R[4] * y + R[5] * z, Z = R[6] * x + R[7] * y + R[8] * z; x = X; y = Y; z = Z; }
        x += c[0]; y += c[1]; z += c[2];
        mn[0] = Math.min(mn[0], x); mn[1] = Math.min(mn[1], y); mn[2] = Math.min(mn[2], z);
        mx[0] = Math.max(mx[0], x); mx[1] = Math.max(mx[1], y); mx[2] = Math.max(mx[2], z);
      }
      p.bounds = [mn[0] - inf, mn[1] - inf, mn[2] - inf, mx[0] + inf, mx[1] + inf, mx[2] + inf];
      if (p.op !== 0 && shape.b[0] <= -9) p.bounds = null; // unbounded cutters: filled in at bake
      this.prims.push(p); return p;
    }
    // capsule/round-cone between two model-space points
    limb(a, b, r1, r2, o = {}) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], h = Math.hypot(dx, dy, dz);
      const R0 = rotY2(dx, dy, dz);
      const R = o.twist ? mat3mul(R0, rotm(0, o.twist, 0)) : R0;
      const sh = o.sx || o.sz ? S.ercone(h, r1, r2, o.sx || 1, o.sz || 1) : S.rcone(h, r1, r2);
      return this.add(sh, Object.assign({}, o, { p: a, R }));
    }
    /* garment: offset the surface built so far by t inside a region shape
     * (region in model space); crisp hems where the region ends */
    wrap(region, o = {}) { return this.add(region, Object.assign({ k: 0.0015, cs: 0.02 }, o, { op: "wrap", t: o.t || 0.004 })); }
    // colour-only primitive (no geometry): o = { mat | color, soft, emit, bone? }
    paint(shape, o = {}) { const R = o.R || (o.r ? rotm(o.r[0], o.r[1], o.r[2]) : null); this.paints.push({ f: shape.f, R, c: o.p || [0, 0, 0], s: o.s || 1, mat: o.mat, soft: o.soft ?? 0.004, mode: o.mode || "set", amt: o.amt ?? 1, only: o.only || null, part: o.part || this.part || "body", fur: o.fur ?? null }); }
    // planar face decal projected along +Z from the head: centre, half size, bone
    face(o) { this.faces.push(o); }
  }

  // local coordinates of a model-space point for a primitive
  function local(p, x, y, z, out) {
    let lx = x - p.c[0], ly = y - p.c[1], lz = z - p.c[2];
    const R = p.R;
    if (R) { const X = R[0] * lx + R[3] * ly + R[6] * lz, Y = R[1] * lx + R[4] * ly + R[7] * lz, Z = R[2] * lx + R[5] * ly + R[8] * lz; lx = X; ly = Y; lz = Z; }
    const s = p.s; out[0] = lx / s; out[1] = ly / s; out[2] = lz / s;
  }
  const L = [0, 0, 0];
  // bake switches (set for the length of one bake): PLAIN leaves out surface displacement (hair grooves, bark), FLAT
  // the colour jitter and patterns of the materials — the clean, flat-shaded shapes the pixel-sprite look wants
  let PLAIN = false, FLAT = false;
  function primDist(p, x, y, z) {
    local(p, x, y, z, L);
    let d = p.f(L[0], L[1], L[2]) * p.s;
    if (p.disp && !PLAIN) d += p.disp(x, y, z, L);
    return d;
  }

  // ------------------------------------------------------------------ bake
  /* opts: { h: voxel size, ao: [radii], faceBone, plain, flat } → mesh arrays */
  function bake(sc, opts = {}) {
    PLAIN = !!opts.plain; FLAT = !!opts.flat;
    try { return bakeMesh(sc, opts); } finally { PLAIN = FLAT = false; }
  }
  function bakeMesh(sc, opts) {
    const t0 = Date.now();
    const h = opts.h || 0.005, BS = 8;
    const part = opts.part || "body";
    const prims = sc.prims.filter((p) => p.part === part);
    const paints = sc.paints.filter((p) => p.part === part);
    const faces = part === "body" ? sc.faces : [];
    // overall bounds from additive prims
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const p of prims) if (p.op === 0) for (let i = 0; i < 3; i++) { bb[i] = Math.min(bb[i], p.bounds[i]); bb[i + 3] = Math.max(bb[i + 3], p.bounds[i + 3]); }
    for (let i = 0; i < 3; i++) { bb[i] -= 2 * h; bb[i + 3] += 2 * h; }
    for (const p of prims) if (!p.bounds) p.bounds = bb.slice();
    const nx = Math.ceil((bb[3] - bb[0]) / h), ny = Math.ceil((bb[4] - bb[1]) / h), nz = Math.ceil((bb[5] - bb[2]) / h);
    const bx = Math.ceil(nx / BS), by = Math.ceil(ny / BS), bz = Math.ceil(nz / BS);
    const ox = bb[0], oy = bb[1], oz = bb[2];
    // block prim lists (in authoring order)
    const lists = new Array(bx * by * bz);
    for (let pi = 0; pi < prims.length; pi++) {
      const b = prims[pi].bounds;
      const x0 = clamp(Math.floor((b[0] - ox) / h / BS), 0, bx - 1), x1 = clamp(Math.floor((b[3] - ox) / h / BS), 0, bx - 1);
      const y0 = clamp(Math.floor((b[1] - oy) / h / BS), 0, by - 1), y1 = clamp(Math.floor((b[4] - oy) / h / BS), 0, by - 1);
      const z0 = clamp(Math.floor((b[2] - oz) / h / BS), 0, bz - 1), z1 = clamp(Math.floor((b[5] - oz) / h / BS), 0, bz - 1);
      for (let k = z0; k <= z1; k++) for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const bi = i + bx * (j + by * k);
        (lists[bi] || (lists[bi] = [])).push(prims[pi]);
      }
    }
    // SDF at a point with a given list
    function sdfList(list, x, y, z, exact) {
      if (!list) return 1;
      let d = 1e9, any = false;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const b = p.bounds;
        if (!exact && (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5])) continue;
        const di = primDist(p, x, y, z);
        if (p.op === 0) { d = any ? smin(d, di, p.k) : di; any = true; }
        else if (p.op === 1) { if (any) d = smax(d, -di, p.k); }
        else if (p.op === 3) { if (any) d = smin(d, Math.max(d - p.t, di), p.k); }
        else if (any) d = smax(d, di, p.k);
      }
      return any ? d : 1;
    }
    const blockOf = (x, y, z) => {
      const i = Math.floor((x - ox) / h / BS), j = Math.floor((y - oy) / h / BS), k = Math.floor((z - oz) / h / BS);
      if (i < 0 || j < 0 || k < 0 || i >= bx || j >= by || k >= bz) return null;
      return lists[i + bx * (j + by * k)];
    };
    const sdf = (x, y, z) => sdfList(blockOf(x, y, z), x, y, z);

    // corner field
    const cx = nx + 1, cy = ny + 1, cz = nz + 1;
    const field = new Float32Array(cx * cy * cz).fill(NaN);
    const active = [];
    const half = Math.sqrt(3) * BS * h * 0.5;
    let evals = 0;
    for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
      const list = lists[i + bx * (j + by * k)];
      if (!list || !list.some((p) => p.op === 0)) continue;
      const mx = ox + (i + 0.5) * BS * h, my = oy + (j + 0.5) * BS * h, mz = oz + (k + 0.5) * BS * h;
      const dc = sdfList(list, mx, my, mz, true); evals++;
      if (Math.abs(dc) > half * 1.6) continue;
      active.push([i, j, k]);
      const I1 = Math.min(nx, (i + 1) * BS), J1 = Math.min(ny, (j + 1) * BS), K1 = Math.min(nz, (k + 1) * BS);
      for (let kk = k * BS; kk <= K1; kk++) for (let jj = j * BS; jj <= J1; jj++) for (let ii = i * BS; ii <= I1; ii++) {
        const ci = ii + cx * (jj + cy * kk);
        if (field[ci] === field[ci]) continue;
        field[ci] = sdfList(list, ox + ii * h, oy + jj * h, oz + kk * h); evals++;
      }
    }
    const corner = (ii, jj, kk) => {
      const ci = ii + cx * (jj + cy * kk);
      let v = field[ci];
      if (v !== v) { v = field[ci] = sdf(ox + ii * h, oy + jj * h, oz + kk * h); evals++; }
      return v;
    };
    // surface nets vertices
    const vmap = new Map();
    const pos = [];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cv = new Float64Array(8);
    function cellVertex(i, j, k) {
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return -1;
      const key = i + nx * (j + ny * k);
      const got = vmap.get(key);
      if (got !== undefined) return got;
      let mask = 0;
      for (let c = 0; c < 8; c++) { cv[c] = corner(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1)); if (cv[c] < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) { vmap.set(key, -1); return -1; }
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of EDGES) {
        const da = cv[a], db = cv[b];
        if (da < 0 === db < 0) continue;
        const t = da / (da - db);
        sx += (a & 1) + t * ((b & 1) - (a & 1)); sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1)); sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1)); n++;
      }
      const vi = pos.length / 3;
      pos.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
      vmap.set(key, vi); return vi;
    }
    const idx = [];
    const quad = (a, b, c, d) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      // split along the shorter diagonal
      const dac = (pos[a * 3] - pos[c * 3]) ** 2 + (pos[a * 3 + 1] - pos[c * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[c * 3 + 2]) ** 2;
      const dbd = (pos[b * 3] - pos[d * 3]) ** 2 + (pos[b * 3 + 1] - pos[d * 3 + 1]) ** 2 + (pos[b * 3 + 2] - pos[d * 3 + 2]) ** 2;
      if (dac < dbd) idx.push(a, b, c, a, c, d); else idx.push(a, b, d, b, c, d);
    };
    for (const [bi, bj, bk] of active) {
      const I1 = Math.min(nx, (bi + 1) * BS), J1 = Math.min(ny, (bj + 1) * BS), K1 = Math.min(nz, (bk + 1) * BS);
      for (let k = bk * BS; k < K1; k++) for (let j = bj * BS; j < J1; j++) for (let i = bi * BS; i < I1; i++) {
        const v = cellVertex(i, j, k);
        if (v < 0) continue;
        const c0 = corner(i, j, k), in0 = c0 < 0;
        // x edge: corner0 → corner1
        if (j > 0 && k > 0 && in0 !== corner(i + 1, j, k) < 0) {
          const A = v, B = cellVertex(i, j - 1, k), C = cellVertex(i, j - 1, k - 1), D = cellVertex(i, j, k - 1);
          in0 ? quad(A, B, C, D) : quad(A, D, C, B);
        }
        if (i > 0 && k > 0 && in0 !== corner(i, j + 1, k) < 0) {
          const A = v, B = cellVertex(i, j, k - 1), C = cellVertex(i - 1, j, k - 1), D = cellVertex(i - 1, j, k);
          in0 ? quad(A, B, C, D) : quad(A, D, C, B);
        }
        if (i > 0 && j > 0 && in0 !== corner(i, j, k + 1) < 0) {
          const A = v, B = cellVertex(i - 1, j, k), C = cellVertex(i - 1, j - 1, k), D = cellVertex(i, j - 1, k);
          in0 ? quad(A, B, C, D) : quad(A, D, C, B);
        }
      }
    }
    if (opts.debug) {
      const ys = {}; for (const [bi, bj, bk] of active) ys[bj] = (ys[bj] || 0) + 1;
      console.log('active', active.length, 'by y-block', JSON.stringify(ys), 'raw verts', pos.length / 3, 'tris', idx.length / 3, 'grid', nx, ny, nz, 'bxyz', bx, by, bz);
    }
    // compact: drop vertices not used by any triangle
    const nv0 = pos.length / 3, used = new Int32Array(nv0).fill(-1);
    let nv = 0;
    for (const i of idx) if (used[i] < 0) used[i] = nv++;
    const P = new Float32Array(nv * 3);
    for (let i = 0; i < nv0; i++) if (used[i] >= 0) { const o = used[i] * 3; P[o] = pos[i * 3]; P[o + 1] = pos[i * 3 + 1]; P[o + 2] = pos[i * 3 + 2]; }
    const I = new Uint32Array(idx.length);
    for (let i = 0; i < idx.length; i++) I[i] = used[idx[i]];

    // refine onto the surface, normals from the gradient
    const N = new Float32Array(nv * 3);
    const e = h * 0.35;
    const grad = (x, y, z, out) => {
      const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), d = sdf(x + e, y + e, z + e);
      let gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d;
      const l = Math.hypot(gx, gy, gz);
      if (l < 1e-9) { out[0] = 0; out[1] = 1; out[2] = 0; return; }
      out[0] = gx / l; out[1] = gy / l; out[2] = gz / l;
    };
    const g = [0, 0, 0];
    for (let v = 0; v < nv; v++) {
      let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      for (let it = 0; it < 2; it++) {
        const d = sdf(x, y, z);
        grad(x, y, z, g);
        const step = clamp(d, -h, h);
        x -= g[0] * step; y -= g[1] * step; z -= g[2] * step;
      }
      grad(x, y, z, g);
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
      N[v * 3] = g[0]; N[v * 3 + 1] = g[1]; N[v * 3 + 2] = g[2];
    }

    // attributes
    const nb = sc.bones.length;
    const COL = new Float32Array(nv * 3), AUX = new Float32Array(nv * 4), AUX2 = new Float32Array(nv * 4), FACE = new Float32Array(nv * 4);
    const SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
    const bw = new Float64Array(nb);
    const aoR = opts.ao || [0.01, 0.022, 0.045, 0.09];
    const mats = sc.mats;
    const defMat = { color: [0.8, 0.8, 0.8], rough: 0.7, metal: 0, emit: 0, cls: 0, vary: 0 };
    const col = [0, 0, 0];
    for (let v = 0; v < nv; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx_ = N[v * 3], ny_ = N[v * 3 + 1], nz_ = N[v * 3 + 2];
      const list = blockOf(x, y, z) || [];
      // colour/material chain + distances for weights
      let d = 1e9, any = false, M = null, cr = 0, cg = 0, cb = 0, rough = 0.7, metal = 0, emit = 0, cls = 0, furL = 1;
      let dmin = 1e9, dom = null;
      const near = [];
      for (const p of list) {
        const b = p.bounds;
        if (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5]) continue;
        const di = primDist(p, x, y, z);
        if (p.op === 0) {
          const m = mats.get(p.mat) || defMat;
          let w;
          if (!any) { d = di; w = 1; any = true; }
          else {
            const k = Math.max(p.k, 1e-6), hh = clamp(0.5 + (0.5 * (di - d)) / k, 0, 1);
            d = mix(di, d, hh) - k * hh * (1 - hh);
            const wn = 1 - hh; // weight of the new prim
            w = clamp((wn - 0.5) / Math.max(p.cs * 2, 1e-3) + 0.5, 0, 1);
          }
          cr = mix(cr, m.color[0], w); cg = mix(cg, m.color[1], w); cb = mix(cb, m.color[2], w);
          rough = mix(rough, m.rough, w); metal = mix(metal, m.metal, w); emit = mix(emit, m.emit, w); furL = mix(furL, m.fur, w);
          if (w > 0.5) { cls = m.cls; M = m; }
          near.push([p, di]);
          if (di < dmin) { dmin = di; dom = p; }
        } else if (p.op === 3 && any) {
          const m = mats.get(p.mat) || defMat, dg = Math.max(d - p.t, di);
          const k = Math.max(p.k, 1e-6), hh = clamp(0.5 + (0.5 * (dg - d)) / k, 0, 1);
          d = mix(dg, d, hh) - k * hh * (1 - hh);
          const w = clamp((1 - hh - 0.5) / Math.max(p.cs * 2, 1e-3) + 0.5, 0, 1);
          cr = mix(cr, m.color[0], w); cg = mix(cg, m.color[1], w); cb = mix(cb, m.color[2], w);
          rough = mix(rough, m.rough, w); metal = mix(metal, m.metal, w); emit = mix(emit, m.emit, w);
          if (w > 0.5) { cls = m.cls; M = m; }
        } else if (any) {
          const k = Math.max(p.k, 1e-6), a = p.op === 1 ? -di : di;
          const hh = clamp(0.5 - (0.5 * (a - d)) / k, 0, 1); // weight of cutter surface
          d = mix(d, a, hh) + k * hh * (1 - hh);
          if (p.cut) {
            const m = mats.get(p.cut) || defMat, w = clamp((hh - 0.5) / Math.max(p.cs * 2, 1e-3) + 0.5, 0, 1);
            cr = mix(cr, m.color[0], w); cg = mix(cg, m.color[1], w); cb = mix(cb, m.color[2], w);
            rough = mix(rough, m.rough, w); metal = mix(metal, m.metal, w); emit = mix(emit, m.emit, w);
            if (w > 0.5) { cls = m.cls; M = m; }
          }
        }
      }
      // material pattern / variation
      if (M && M.vary && !FLAT) { const n = fbm(x * 38, y * 38, z * 38, 2); cr *= 1 + M.vary * n; cg *= 1 + M.vary * n; cb *= 1 + M.vary * n; }
      if (M && M.pattern && !FLAT) { col[0] = cr; col[1] = cg; col[2] = cb; M.pattern(x, y, z, nx_, ny_, nz_, col); cr = col[0]; cg = col[1]; cb = col[2]; }
      // paints
      for (const pt of paints) {
        local(pt, x, y, z, L);
        const dp = pt.f(L[0], L[1], L[2]) * pt.s;
        if (dp > pt.soft) continue;
        if (pt.only && !(M && pt.only.includes(M.name))) continue;
        const w = (1 - sstep(-pt.soft, pt.soft, dp)) * pt.amt;
        const m = mats.get(pt.mat) || defMat;
        if (pt.mode === "mul") { cr *= mix(1, m.color[0], w); cg *= mix(1, m.color[1], w); cb *= mix(1, m.color[2], w); }
        else { cr = mix(cr, m.color[0], w); cg = mix(cg, m.color[1], w); cb = mix(cb, m.color[2], w); rough = mix(rough, m.rough, w); metal = mix(metal, m.metal, w); emit = mix(emit, m.emit, w); if (pt.fur != null) furL = mix(furL, pt.fur, w); if (w > 0.5) cls = m.cls; }
      }
      COL[v * 3] = cr; COL[v * 3 + 1] = cg; COL[v * 3 + 2] = cb;
      // AO + cavity
      let occ = 0, wsum = 0;
      for (let i = 0; i < aoR.length; i++) {
        const r = aoR[i], dd = sdf(x + nx_ * r, y + ny_ * r, z + nz_ * r);
        const wi = 1 / (i + 1);
        occ += wi * clamp((r - dd) / r, 0, 1); wsum += wi;
      }
      const cav = clamp((aoR[0] - sdf(x + nx_ * aoR[0] * 0.6, y + ny_ * aoR[0] * 0.6, z + nz_ * aoR[0] * 0.6) / 0.6) / aoR[0], 0, 1);
      AUX[v * 4] = 1 - occ / wsum; AUX[v * 4 + 1] = cav; AUX[v * 4 + 3] = rough;
      AUX2[v * 4] = metal; AUX2[v * 4 + 1] = emit; AUX2[v * 4 + 2] = cls; AUX2[v * 4 + 3] = furL;
      // skin weights
      bw.fill(0);
      const wg = dom ? dom.wg : 0;
      for (const [p, di] of near) {
        if (p.wg !== wg) continue;
        const w = Math.exp(-Math.max(di - dmin, 0) / p.sigma);
        if (p.wfn) { for (const [b, bwt] of p.wfn(x, y, z)) { const bi = typeof b === "string" ? sc.boneIndex.get(b) : b; if (bi !== undefined && bwt > 0) bw[bi] += w * bwt; } }
        else if (p.bones) for (const [b, bwt] of p.bones) bw[b] += w * bwt;
        else bw[p.bone] += w;
      }
      const top = [];
      for (let b = 0; b < nb; b++) if (bw[b] > 1e-4) top.push([b, bw[b]]);
      top.sort((a, b) => b[1] - a[1]);
      let tot = 0;
      for (let i = 0; i < Math.min(4, top.length); i++) tot += top[i][1];
      for (let i = 0; i < 4; i++) {
        if (i < top.length && tot > 0) { SI[v * 4 + i] = top[i][0]; SW[v * 4 + i] = top[i][1] / tot; }
        else { SI[v * 4 + i] = 0; SW[v * 4 + i] = 0; }
      }
      if (tot === 0) { SI[v * 4] = dom ? dom.bone : 0; SW[v * 4] = 1; }
      // face decal
      for (const f of faces) {
        if (f.cls && !f.cls.includes(cls)) continue;
        const fb = sc.boneIndex.get(f.bone);
        let hw = 0; for (let i = 0; i < 4; i++) if (SI[v * 4 + i] === fb) hw += SW[v * 4 + i];
        if (hw < 0.5) continue;
        const u = (x - f.c[0]) / f.size[0], w_ = (y - f.c[1]) / f.size[1];
        if (Math.abs(u) > 1.05 || Math.abs(w_) > 1.05 || z < f.c[2] - (f.depth || 0.05)) continue;
        const facing = sstep(f.nz ?? 0.15, (f.nz ?? 0.15) + 0.25, nz_);
        if (facing <= 0) continue;
        FACE[v * 4] = u * 0.5 + 0.5; FACE[v * 4 + 1] = w_ * 0.5 + 0.5; FACE[v * 4 + 2] = facing * (1 - sstep(0.9, 1.05, Math.max(Math.abs(u), Math.abs(w_)))); FACE[v * 4 + 3] = faces.indexOf(f) + 1;
      }
    }
    // convexity from the mesh (mean curvature sign) for edge highlights
    const curv = new Float32Array(nv), cnt = new Float32Array(nv);
    for (let t = 0; t < I.length; t += 3) for (let a = 0; a < 3; a++) {
      const i = I[t + a], j = I[t + ((a + 1) % 3)];
      const dx = P[j * 3] - P[i * 3], dy = P[j * 3 + 1] - P[i * 3 + 1], dz = P[j * 3 + 2] - P[i * 3 + 2];
      const l2 = dx * dx + dy * dy + dz * dz + 1e-12;
      const dn = (N[j * 3] - N[i * 3]) * dx + (N[j * 3 + 1] - N[i * 3 + 1]) * dy + (N[j * 3 + 2] - N[i * 3 + 2]) * dz;
      const k = dn / Math.sqrt(l2);
      curv[i] += k; curv[j] += k; cnt[i]++; cnt[j]++;
    }
    for (let v = 0; v < nv; v++) AUX[v * 4 + 2] = clamp((cnt[v] ? curv[v] / cnt[v] : 0) * 0.5 + 0.5, 0, 1);
    return {
      position: P, normal: N, color: COL, aux: AUX, aux2: AUX2, face: FACE, skinIndex: SI, skinWeight: SW, index: I,
      bones: sc.bones.map((b) => ({ name: b.name, parent: b.parent, head: b.head.slice() })),
      stats: { verts: nv, tris: I.length / 3, grid: [nx, ny, nz], evals, ms: Date.now() - t0 },
    };
  }

  // sRGB hex → linear rgb
  function lin(hex) {
    const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => v / 255);
    return c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  }

  const api = { S, Sculpture, bake, lin, vnoise, fbm, hash3, rotm, rotY2, mat3mul, smin, smax, clamp, mix, sstep, primDist, local };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EmberSculpt = api;
  // recorded for EmberVoxelBaker, which rebuilds this pipeline in a worker from the scripts that loaded it
  if (typeof document !== "undefined" && document.currentScript) (root.EmberVoxelScripts || (root.EmberVoxelScripts = [])).push(document.currentScript);
})(typeof self !== "undefined" ? self : this);
