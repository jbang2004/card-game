/* EmberVoxel — voxel-art bake of an EmberSculpt sculpture (the Voxel Musou look).
 * The same signed distance field that bake() polygonises is sampled on a grid of
 * cubes instead: parts merge by layer (cloth over hair over body), only exposed
 * faces are meshed, with flat normals, per-corner ambient occlusion (the voxel
 * mesher of github.com/mike007jd/voxel-musou, MIT), per-voxel shade jitter,
 * material patterns at voxel scale and shaded seams where materials meet. Skin
 * weights are evaluated per corner, so joints bend without opening gaps.
 * Output has the same attribute set as bake() plus `vox` (exposed voxel centres,
 * colours and bones, for shattering) and `faceGrid` (texel ↔ voxel mapping of the
 * face decal). Pure math: runs in the page or Node. */
(function (root) {
  "use strict";
  const K = root.EmberSculpt || (typeof require !== "undefined" ? require("./sculpt.js") : null);
  const { clamp, mix, sstep, fbm, hash3, smin, smax, primDist, local } = K;

  const LAYER = { body: 0, hair: 1, cloth: 2 };
  const FACES = [
    { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  // per material class (chars.js CLS): shade jitter and default dilation (in voxels)
  //            cloth skin hair leath metal fur  glow  wood  lips  eye  plant
  const JIT = [0.07, 0.025, 0.07, 0.09, 0.05, 0.12, 0.02, 0.1, 0.02, 0.0, 0.1];
  const DIL = [0.15, 0.12, 0.3, 0.15, 0.45, 0.2, 0.55, 0.3, 0.2, 0.55, 0.45];
  const AO = [1 - 0.42, 1 - 0.42 * 0.6, 1 - 0.42 * 0.25, 1];

  /** prim lists of one part on a coarse spatial grid (cell `cs`) */
  function field(sc, part, cs, flat) {
    const prims = sc.prims.filter((p) => p.part === part && !(flat && p.feat));
    const paints = sc.paints.filter((p) => p.part === part);
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const p of prims) if (p.op === 0) for (let i = 0; i < 3; i++) { bb[i] = Math.min(bb[i], p.bounds[i]); bb[i + 3] = Math.max(bb[i + 3], p.bounds[i + 3]); }
    for (let i = 0; i < 3; i++) { bb[i] -= 2 * cs; bb[i + 3] += 2 * cs; }
    for (const p of prims) if (!p.bounds) p.bounds = bb.slice();
    const n = [0, 1, 2].map((i) => Math.max(1, Math.ceil((bb[i + 3] - bb[i]) / cs)));
    const lists = new Array(n[0] * n[1] * n[2]);
    for (const p of prims) {
      const b = p.bounds, r = [0, 1, 2].map((i) => [clamp(Math.floor((b[i] - bb[i]) / cs), 0, n[i] - 1), clamp(Math.floor((b[i + 3] - bb[i]) / cs), 0, n[i] - 1)]);
      for (let k = r[2][0]; k <= r[2][1]; k++) for (let j = r[1][0]; j <= r[1][1]; j++) for (let i = r[0][0]; i <= r[0][1]; i++) {
        const c = i + n[0] * (j + n[1] * k);
        (lists[c] || (lists[c] = [])).push(p);
      }
    }
    const listAt = (x, y, z) => {
      const i = Math.floor((x - bb[0]) / cs), j = Math.floor((y - bb[1]) / cs), k = Math.floor((z - bb[2]) / cs);
      if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) return null;
      return lists[i + n[0] * (j + n[1] * k)];
    };
    return { part, prims, paints, bb, listAt, empty: !prims.some((p) => p.op === 0) };
  }

  /** distance of one part at a point; st.dom = the additive primitive closest to it */
  function sd(F, x, y, z, exact, st) {
    const list = F.listAt(x, y, z);
    let d = 1e9, any = false, dmin = 1e9, dom = null;
    if (list) for (let i = 0; i < list.length; i++) {
      const p = list[i], b = p.bounds;
      if (!exact && (x < b[0] || y < b[1] || z < b[2] || x > b[3] || y > b[4] || z > b[5])) continue;
      const di = primDist(p, x, y, z);
      if (p.op === 0) { d = any ? smin(d, di, p.k) : di; any = true; if (di < dmin) { dmin = di; dom = p; } }
      else if (p.op === 1) { if (any) d = smax(d, -di, p.k); }
      else if (p.op === 3) { if (any) d = smin(d, Math.max(d - p.t, di), p.k); }
      else if (any) d = smax(d, di, p.k);
    }
    if (st) st.dom = dom;
    return any ? d : 1;
  }

  /** the bone a primitive mostly follows at a point (fixed bone, `bones` table or `wfn`) */
  function domBone(sc, p, x, y, z) {
    if (!p) return -1;
    if (p.wfn) { let best = -1, bw = -1; for (const [b, w] of p.wfn(x, y, z)) { const bi = typeof b === "string" ? sc.boneIndex.get(b) : b; if (bi !== undefined && w > bw) { bw = w; best = bi; } } return best >= 0 ? best : p.bone; }
    if (p.bones) { let best = p.bones[0][0], bw = -1; for (const [b, w] of p.bones) if (w > bw) { bw = w; best = b; } return best; }
    return p.bone;
  }

  /** bone frames for rigid voxel segments: world-aligned unless a bone runs well off every world axis
   *  (arms in the A-pose, necks, spread legs), in which case its cubes line up with the bone */
  const WORLD = ["root", "spine", "chest", "head", "jaw"];
  function boneFrames(sc) {
    const B = sc.bones, kids = B.map(() => []);
    B.forEach((b, i) => { if (b.parent >= 0) kids[b.parent].push(i); });
    const dirOf = (i) => {
      const ks = kids[i].filter((k) => !/^(hair|cape|ear|antler|tail|jaw|clav)/.test(B[k].name) || /^tail/.test(B[i].name));
      const k = ks.find((c) => B[c].name.replace(/[LR]$/, "") !== B[i].name.replace(/[LR]$/, "")) ?? ks[0];
      if (k == null) return null;
      const d = [0, 1, 2].map((a) => B[k].head[a] - B[i].head[a]), l = Math.hypot(...d);
      return l > 1e-6 ? d.map((a) => a / l) : null;
    };
    const F = [];
    B.forEach((b, i) => {
      let d = WORLD.includes(b.name) ? null : dirOf(i);
      if (!d && b.parent >= 0 && !WORLD.includes(b.name) && F[b.parent] && F[b.parent].R) d = [F[b.parent].R[1], F[b.parent].R[4], F[b.parent].R[7]];
      if (!d || Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])) > Math.cos(0.33)) { F.push({ R: null, o: b.head }); return; }
      let x = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
      const dp = x[0] * d[0] + x[1] * d[1] + x[2] * d[2];
      x = [x[0] - dp * d[0], x[1] - dp * d[1], x[2] - dp * d[2]]; const lx = Math.hypot(...x); x = x.map((a) => a / lx);
      const z = [x[1] * d[2] - x[2] * d[1], x[2] * d[0] - x[0] * d[2], x[0] * d[1] - x[1] * d[0]];
      // columns of R = local x, y (bone), z in model space
      F.push({ R: [x[0], d[0], z[0], x[1], d[1], z[1], x[2], d[2], z[2]], o: b.head });
    });
    return { F, kids };
  }

  /** colour / material chain at a point (the same rules as bake()); n = surface normal */
  const L = [0, 0, 0], col = [0, 0, 0], defMat = { name: "", color: [0.8, 0.8, 0.8], rough: 0.7, metal: 0, emit: 0, cls: 0, vary: 0 };
  function shadeAt(F, mats, x, y, z, n, out) {
    const list = F.listAt(x, y, z) || [];
    let d = 1e9, any = false, M = null, cr = 0, cg = 0, cb = 0, rough = 0.7, metal = 0, emit = 0, cls = 0;
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
          w = clamp((1 - hh - 0.5) / Math.max(p.cs * 2, 1e-3) + 0.5, 0, 1);
        }
        cr = mix(cr, m.color[0], w); cg = mix(cg, m.color[1], w); cb = mix(cb, m.color[2], w);
        rough = mix(rough, m.rough, w); metal = mix(metal, m.metal, w); emit = mix(emit, m.emit, w);
        if (w > 0.5) { cls = m.cls; M = m; }
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
        const hh = clamp(0.5 - (0.5 * (a - d)) / k, 0, 1);
        d = mix(d, a, hh) + k * hh * (1 - hh);
        if (p.cut) {
          const m = mats.get(p.cut) || defMat, w = clamp((hh - 0.5) / Math.max(p.cs * 2, 1e-3) + 0.5, 0, 1);
          cr = mix(cr, m.color[0], w); cg = mix(cg, m.color[1], w); cb = mix(cb, m.color[2], w);
          rough = mix(rough, m.rough, w); metal = mix(metal, m.metal, w); emit = mix(emit, m.emit, w);
          if (w > 0.5) { cls = m.cls; M = m; }
        }
      }
    }
    if (M && M.vary) { const v = fbm(x * 38, y * 38, z * 38, 2); cr *= 1 + M.vary * v; cg *= 1 + M.vary * v; cb *= 1 + M.vary * v; }
    if (M && M.pattern) { col[0] = cr; col[1] = cg; col[2] = cb; M.pattern(x, y, z, n[0], n[1], n[2], col); cr = col[0]; cg = col[1]; cb = col[2]; }
    let tag = M ? M.name : "";
    for (const pt of F.paints) {
      local(pt, x, y, z, L);
      const dp = pt.f(L[0], L[1], L[2]) * pt.s;
      if (dp > pt.soft) continue;
      if (pt.only && !(M && pt.only.includes(M.name))) continue;
      const w = (1 - sstep(-pt.soft, pt.soft, dp)) * pt.amt;
      if (w < 0.5 && pt.mode !== "mul") continue;          // voxels take a paint or not: crisp pixel edges
      const m = mats.get(pt.mat) || defMat;
      if (pt.mode === "mul") { cr *= mix(1, m.color[0], w); cg *= mix(1, m.color[1], w); cb *= mix(1, m.color[2], w); }
      else { const a = Math.min(1, w * 1.25); cr = mix(cr, m.color[0], a); cg = mix(cg, m.color[1], a); cb = mix(cb, m.color[2], a); rough = m.rough; metal = m.metal; emit = mix(emit, m.emit, a); cls = m.cls; tag += "+" + m.name; }
    }
    out.r = cr; out.g = cg; out.b = cb; out.rough = rough; out.metal = metal; out.emit = emit; out.cls = cls; out.mat = tag;
    return out;
  }

  /** skin weights at a point (the same rules as bake()) → top-4 into SI/SW at o */
  const bw = [];
  function weightsAt(F, sc, x, y, z, SI, SW, o) {
    const nb = sc.bones.length;
    for (let b = 0; b < nb; b++) bw[b] = 0;
    const list = F.listAt(x, y, z) || [];
    let dmin = 1e9, dom = null;
    const near = [];
    for (const p of list) {
      if (p.op !== 0) continue;
      const b = p.bounds;
      if (x < b[0] - 0.02 || y < b[1] - 0.02 || z < b[2] - 0.02 || x > b[3] + 0.02 || y > b[4] + 0.02 || z > b[5] + 0.02) continue;
      const di = primDist(p, x, y, z);
      near.push(p, di);
      if (di < dmin) { dmin = di; dom = p; }
    }
    const wg = dom ? dom.wg : 0;
    for (let i = 0; i < near.length; i += 2) {
      const p = near[i], di = near[i + 1];
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
      if (i < top.length && tot > 0) { SI[o + i] = top[i][0]; SW[o + i] = top[i][1] / tot; }
      else { SI[o + i] = 0; SW[o + i] = 0; }
    }
    if (tot === 0) { SI[o] = dom ? dom.bone : 0; SW[o] = 1; }
  }

  /* opts: { v: voxel size, dilate: {part: voxels}, jitter: scale, seams: bool, rigid: bool, flatFace: bool }
   * rigid (default): the body part becomes one rigid voxel segment per bone — cubes aligned with the bone,
   * overlapping at the joints like an action figure (Voxel Musou's one mesh per joint); hair and cloth stay on
   * the world lattice with per-corner weights so they drape across bones. */
  function voxelize(sc, opts = {}) {
    const t0 = Date.now();
    const v = opts.v || 0.0125, BS = 8;
    const fields = sc.parts().map((part) => field(sc, part, Math.max(v * 4, 0.04), opts.flatFace !== false)).filter((F) => !F.empty)
      .sort((a, b) => (LAYER[a.part] ?? 0) - (LAYER[b.part] ?? 0));
    const partDil = Object.assign({ body: 0, hair: 0.12, cloth: 0.5 }, opts.dilate || {});
    const jitK = opts.jitter ?? 1;
    const mats = sc.mats;
    const rigid = opts.rigid !== false && sc.bones.length > 1;
    const bodyFi = fields.findIndex((F) => F.part === "body");
    const st = { dom: null };
    const dilOf = (F, dom) => {
      const m = dom && mats.get(dom.mat);
      const md = dom && dom.vdil != null ? dom.vdil : m && m.vox != null ? m.vox : m ? DIL[m.cls] ?? 0.15 : 0.15;
      return Math.max(md, partDil[F.part] ?? 0) * v;
    };
    let evals = 0;

    // ---- world lattice (multiples of v, shared by every figure)
    const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const F of fields) for (let i = 0; i < 3; i++) { bb[i] = Math.min(bb[i], F.bb[i]); bb[i + 3] = Math.max(bb[i + 3], F.bb[i + 3]); }
    const o0 = [0, 1, 2].map((i) => Math.floor(bb[i] / v) * v);
    const n = [0, 1, 2].map((i) => Math.ceil((bb[i + 3] - o0[i]) / v) + 1);
    const [nx, ny, nz] = n, N = nx * ny * nz;
    const id = (i, j, k) => i + nx * (j + ny * k);
    const occ = new Int8Array(N).fill(-1), domB = new Int16Array(N).fill(-1);
    const half = Math.sqrt(3) * BS * v * 0.5;
    const bxn = Math.ceil(nx / BS), byn = Math.ceil(ny / BS), bzn = Math.ceil(nz / BS);
    fields.forEach((F, fi) => {
      const needBone = rigid && fi === bodyFi;
      for (let bk = 0; bk < bzn; bk++) for (let bj = 0; bj < byn; bj++) for (let bi = 0; bi < bxn; bi++) {
        const cx = o0[0] + (bi * BS + BS / 2) * v, cy = o0[1] + (bj * BS + BS / 2) * v, cz = o0[2] + (bk * BS + BS / 2) * v;
        const dc = sd(F, cx, cy, cz, true, st); evals++;
        if (dc > half * 1.6 + 0.6 * v) continue;
        const full = dc < -half * 1.6 && !needBone;
        const I1 = Math.min(nx, (bi + 1) * BS), J1 = Math.min(ny, (bj + 1) * BS), K1 = Math.min(nz, (bk + 1) * BS);
        for (let k = bk * BS; k < K1; k++) for (let j = bj * BS; j < J1; j++) for (let i = bi * BS; i < I1; i++) {
          const c = id(i, j, k);
          if (full) { occ[c] = fi; continue; }
          const x = o0[0] + (i + 0.5) * v, y = o0[1] + (j + 0.5) * v, z = o0[2] + (k + 0.5) * v;
          const d = sd(F, x, y, z, false, st); evals++;
          if (d < dilOf(F, st.dom)) { occ[c] = fi; if (needBone) domB[c] = domBone(sc, st.dom, x, y, z); }
        }
      }
    });
    const solid = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && occ[id(i, j, k)] >= 0;
    const NB6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = id(i, j, k);
      if (occ[c] < 0) continue;
      let cnt = 0; for (const [a, b, e] of NB6) cnt += solid(i + a, j + b, k + e) ? 1 : 0;
      if (cnt === 0) occ[c] = -1;
    }

    // ---- shared mesher: G = { n, own(i,j,k), solid(i,j,k), at(i,j,k) → model-space centre, R (3x3 cols) | null,
    //      o (corner origin), fi(i,j,k) field index, bone (rigid) | -1, key (hash seed), face: bool }
    const pos = [], nor = [], alb = [], aux = [], aux2 = [], fce = [], idx = [], wts = [];
    const VP = [], VC = [], VB = [], VCLS = [];
    const faceDefs = sc.faces || [];
    const faceGrid = faceDefs.map((f) => {
      const i0 = Math.floor((f.c[0] - f.size[0] - o0[0]) / v), i1 = Math.ceil((f.c[0] + f.size[0] - o0[0]) / v);
      const j0 = Math.floor((f.c[1] - f.size[1] - o0[1]) / v), j1 = Math.ceil((f.c[1] + f.size[1] - o0[1]) / v);
      return { i0, j0, W: i1 - i0, H: j1 - j0, ox: o0[0], oy: o0[1], v, def: f };
    });
    const tmp = {}, gN = [0, 0, 0];
    const grad = (F, x, y, z) => {
      const e = v * 0.5;
      const a = sd(F, x + e, y - e, z - e, false), b = sd(F, x - e, y - e, z + e), c = sd(F, x - e, y + e, z - e), d = sd(F, x + e, y + e, z + e);
      const gx = a - b - c + d, gy = -a - b + c + d, gz = -a + b - c + d, l = Math.hypot(gx, gy, gz) || 1;
      gN[0] = gx / l; gN[1] = gy / l; gN[2] = gz / l; return gN;
    };
    const tI = new Uint16Array(4), tW = new Float32Array(4), wcache = new Map();
    function mesh(G) {
      const [gx, gy, gz] = G.n, gid = (i, j, k) => i + gx * (j + gy * k);
      const info = new Map();
      const cell = (i, j, k) => {
        const c = gid(i, j, k);
        let r = info.get(c);
        if (r) return r;
        const F = fields[G.fi(i, j, k)], p = G.at(i, j, k);
        shadeAt(F, mats, p[0], p[1], p[2], grad(F, p[0], p[1], p[2]), tmp);
        r = { r: tmp.r, g: tmp.g, b: tmp.b, rough: tmp.rough, metal: tmp.metal, emit: tmp.emit, cls: tmp.cls, mat: F.part + ":" + tmp.mat, F, p };
        info.set(c, r);
        return r;
      };
      const R = G.R;
      const rot = (x, y, z) => (R ? [R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z] : [x, y, z]);
      const lv = [0, 0, 0, 0];
      for (let k = 0; k < gz; k++) for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
        if (!G.own(i, j, k)) continue;
        let open = false; for (const [a, b, e] of NB6) if (!G.solid(i + a, j + b, k + e)) { open = true; break; }
        if (!open) continue;
        const r = cell(i, j, k), cls = r.cls | 0;
        // stylise at voxel scale: jitter, hair/fur/cloth/leather/wood patterns, seams
        const h1 = hash3(i + G.key, j, k), h2 = hash3(k + 71, i + 13 + G.key, j + 29);
        let f = 1 - (JIT[cls] ?? 0.06) * jitK / 2 + h1 * (JIT[cls] ?? 0.06) * jitK, add = 0;
        if (cls === 2) { if ((i * 3 + k) % 5 === 0) { f *= 1.25; add = 0.018; } else if ((i + j * 2) % 7 === 0) f *= 0.8; }
        else if (cls === 5) f *= (i + 2 * j + k) % 6 === 0 ? 0.86 : h2 < 0.08 ? 1.14 : 1;
        else if (cls === 0) f *= j % 4 === 0 ? 0.96 : 1;
        else if (cls === 3) f *= h2 < 0.1 ? 0.84 : 1;
        else if (cls === 7) f *= (i + k) % 3 === 0 ? 0.88 : 1;
        if (opts.seams !== false && cls !== 6) {
          if (G.own(i, j + 1, k) && cell(i, j + 1, k).mat !== r.mat) f *= 0.8;
          else if (G.own(i, j - 1, k) && cell(i, j - 1, k).mat !== r.mat) f *= 1.08;
        }
        const c3 = [r.r * f + add, r.g * f + add * 0.9, r.b * f + add * 0.85];
        VP.push(...r.p); VC.push(...c3); VCLS.push(cls);
        if (G.bone >= 0) VB.push(G.bone); else { weightsAt(r.F, sc, r.p[0], r.p[1], r.p[2], tI, tW, 0); VB.push(tI[0]); }
        for (let fi = 0; fi < 6; fi++) {
          const fc = FACES[fi], [ax, ay, az] = fc.n;
          if (G.solid(i + ax, j + ay, k + az)) continue;
          const axes = ax ? [1, 2] : ay ? [0, 2] : [0, 1];
          const P0 = [i + ax, j + ay, k + az];
          let occN = 0, occT = 0;
          for (let s2 = 1; s2 <= 3; s2++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
            if (s2 === 1 && a === 0 && b === 0) continue;
            const t = [i + ax * s2, j + ay * s2, k + az * s2]; t[axes[0]] += a * s2; t[axes[1]] += b * s2;
            occT += 1 / s2; if (G.solid(t[0], t[1], t[2])) occN += 1 / s2;
          }
          const big = 1 - 0.55 * Math.min(1, occN / occT * 1.6);
          let fu = 0, fv = 0, fm = 0, fx = 0;
          if (G.face && az === 1) for (let d = 0; d < faceGrid.length; d++) {
            const FG = faceGrid[d], f0 = FG.def, p = r.p;
            if (Math.abs(p[0] - f0.c[0]) > f0.size[0] || Math.abs(p[1] - f0.c[1]) > f0.size[1] || p[2] < f0.c[2] - (f0.depth || 0.05)) continue;
            if (f0.cls && !f0.cls.includes(r.cls)) continue;
            if (r.F.part !== "body") continue;
            fu = (i - FG.i0 + 0.5) / FG.W; fv = (j - FG.j0 + 0.5) / FG.H; fm = 1; fx = d + 1;
          }
          const nm = rot(ax, ay, az), base = pos.length / 3;
          fc.v.forEach((cv, qq) => {
            const s1 = P0.slice(), s2 = P0.slice();
            s1[axes[0]] += cv[axes[0]] ? 1 : -1; s2[axes[1]] += cv[axes[1]] ? 1 : -1;
            const cc = s1.slice(); cc[axes[1]] += cv[axes[1]] ? 1 : -1;
            const A = G.solid(...s1) ? 1 : 0, B = G.solid(...s2) ? 1 : 0, C = G.solid(...cc) ? 1 : 0;
            lv[qq] = A && B ? 0 : 3 - A - B - C;
            const lp = rot((i + cv[0]) * v + G.o[0], (j + cv[1]) * v + G.o[1], (k + cv[2]) * v + G.o[2]);
            const wp = R ? [lp[0] + G.org[0], lp[1] + G.org[1], lp[2] + G.org[2]] : lp;
            pos.push(wp[0], wp[1], wp[2]); nor.push(nm[0], nm[1], nm[2]);
            alb.push(c3[0], c3[1], c3[2]);
            aux.push(AO[lv[qq]] * big, 0, 0.5, r.rough);
            aux2.push(r.metal, r.emit, r.cls, 0);
            fce.push(fu, fv, fm, fx);
            if (G.bone >= 0) wts.push(G.bone, 0, 0, 0, 1, 0, 0, 0);
            else {
              const key = ((i + cv[0]) + (gx + 1) * ((j + cv[1]) + (gy + 1) * (k + cv[2]))) * 4 + G.fi(i, j, k);
              let w = wcache.get(key);
              if (!w) { weightsAt(r.F, sc, wp[0], wp[1], wp[2], tI, tW, 0); w = [tI[0], tI[1], tI[2], tI[3], tW[0], tW[1], tW[2], tW[3]]; wcache.set(key, w); }
              wts.push(...w);
            }
          });
          if (lv[0] + lv[2] < lv[1] + lv[3]) idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
          else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }

    // ---- rigid body segments
    const worldBone = new Uint8Array(sc.bones.length);
    if (rigid && bodyFi >= 0) {
      const { F: frames, kids } = boneFrames(sc);
      frames.forEach((fr, b) => { worldBone[b] = fr.R ? 0 : 1; });
      const cells = new Map();
      for (let c = 0; c < N; c++) if (occ[c] === bodyFi && domB[c] >= 0) { let a = cells.get(domB[c]); if (!a) cells.set(domB[c], (a = [])); a.push(c); }
      const FB = fields[bodyFi], rj = 3 * v;
      const bodyAt = (c) => occ[c] === bodyFi;
      // world-aligned segments tile the shared lattice: faces between them are culled, overlaps are not needed
      const worldSolid = (i, j, k) => { if (!solid(i, j, k)) return false; const c = id(i, j, k); return occ[c] !== bodyFi || worldBone[domB[c]] === 1; };
      for (const [b, list] of cells) {
        const fr = frames[b];
        if (!fr.R) {
          mesh({ n, key: b * 131, fi: () => bodyFi, bone: b, face: sc.bones[b].name === "head", R: null, o: o0, org: [0, 0, 0],
            own: (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && bodyAt(id(i, j, k)) && domB[id(i, j, k)] === b,
            solid: worldSolid, at: (i, j, k) => [o0[0] + (i + 0.5) * v, o0[1] + (j + 0.5) * v, o0[2] + (k + 0.5) * v] });
          continue;
        }
        // own lattice along the bone: bounds of the bone's cells in its frame, padded for the joint overlap
        const R = fr.R, O = fr.o, joints = [O, ...kids[b].map((k) => sc.bones[k].head)];
        const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (const c of list) {
          const i = c % nx, j = Math.floor(c / nx) % ny, k = Math.floor(c / (nx * ny));
          const d = [o0[0] + (i + 0.5) * v - O[0], o0[1] + (j + 0.5) * v - O[1], o0[2] + (k + 0.5) * v - O[2]];
          const l = [R[0] * d[0] + R[3] * d[1] + R[6] * d[2], R[1] * d[0] + R[4] * d[1] + R[7] * d[2], R[2] * d[0] + R[5] * d[1] + R[8] * d[2]];
          for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], l[a]); hi[a] = Math.max(hi[a], l[a]); }
        }
        const lo2 = lo.map((x) => Math.floor((x - rj - 2 * v) / v) * v), ln = [0, 1, 2].map((a) => Math.ceil((hi[a] + rj + 2 * v - lo2[a]) / v) + 1);
        const at = (i, j, k) => { const l = [lo2[0] + (i + 0.5) * v, lo2[1] + (j + 0.5) * v, lo2[2] + (k + 0.5) * v]; return [O[0] + R[0] * l[0] + R[1] * l[1] + R[2] * l[2], O[1] + R[3] * l[0] + R[4] * l[1] + R[5] * l[2], O[2] + R[6] * l[0] + R[7] * l[1] + R[8] * l[2]]; };
        const inside = new Uint8Array(ln[0] * ln[1] * ln[2]);
        for (let k = 0; k < ln[2]; k++) for (let j = 0; j < ln[1]; j++) for (let i = 0; i < ln[0]; i++) {
          const p = at(i, j, k), d = sd(FB, p[0], p[1], p[2], false, st); evals++;
          if (d >= dilOf(FB, st.dom)) continue;
          const db = domBone(sc, st.dom, p[0], p[1], p[2]);
          if (fields.some((F, fi) => fi !== bodyFi && sd(F, p[0], p[1], p[2], false) < 0.25 * v)) continue;   // under hair / cloth
          if (db === b || joints.some((J) => Math.hypot(p[0] - J[0], p[1] - J[1], p[2] - J[2]) < rj)) inside[i + ln[0] * (j + ln[1] * k)] = 1;
        }
        const own = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < ln[0] && j < ln[1] && k < ln[2] && inside[i + ln[0] * (j + ln[1] * k)] === 1;
        mesh({ n: ln, key: b * 131, fi: () => bodyFi, bone: b, face: false, R, o: lo2, org: O, own, solid: own, at });
      }
    }
    // ---- world lattice: everything (rigid off) or hair and cloth; cloth cells sunk more than half a voxel into a
    // rotated body segment are dropped (that segment shows there), so bone-aligned and world cubes don't interleave
    const buried = new Uint8Array(N);
    if (rigid && bodyFi >= 0) {
      const FB = fields[bodyFi];
      for (let c = 0; c < N; c++) {
        if (occ[c] < 0 || occ[c] === bodyFi) continue;
        const i = c % nx, j = Math.floor(c / nx) % ny, k = Math.floor(c / (nx * ny));
        const x = o0[0] + (i + 0.5) * v, y = o0[1] + (j + 0.5) * v, z = o0[2] + (k + 0.5) * v;
        const d = sd(FB, x, y, z, false, st);
        if (d < -0.5 * v && !worldBone[domBone(sc, st.dom, x, y, z)]) buried[c] = 1;
      }
    }
    mesh({ n, key: 0, fi: (i, j, k) => occ[id(i, j, k)], bone: -1, face: !rigid, R: null, o: o0, org: [0, 0, 0],
      own: (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && occ[id(i, j, k)] >= 0 && !(rigid && occ[id(i, j, k)] === bodyFi) && !buried[id(i, j, k)],
      solid, at: (i, j, k) => [o0[0] + (i + 0.5) * v, o0[1] + (j + 0.5) * v, o0[2] + (k + 0.5) * v] });

    const nv = pos.length / 3;
    const SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4);
    for (let q = 0; q < nv; q++) for (let a = 0; a < 4; a++) { SI[q * 4 + a] = wts[q * 8 + a]; SW[q * 4 + a] = wts[q * 8 + 4 + a]; }
    return {
      position: new Float32Array(pos), normal: new Float32Array(nor), color: new Float32Array(alb), aux: new Float32Array(aux), aux2: new Float32Array(aux2),
      face: new Float32Array(fce), skinIndex: SI, skinWeight: SW, index: new Uint32Array(idx),
      bones: sc.bones.map((b) => ({ name: b.name, parent: b.parent, head: b.head.slice() })),
      vox: { center: new Float32Array(VP), color: new Float32Array(VC), bone: new Uint16Array(VB), cls: new Uint8Array(VCLS), size: v },
      faceGrid,
      stats: { verts: nv, tris: idx.length / 3, voxels: VB.length, grid: n, evals, ms: Date.now() - t0 },
    };
  }

  const api = { voxelize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EmberVoxel = api;
  // recorded for EmberVoxelBaker, which rebuilds this pipeline in a worker from the scripts that loaded it
  if (typeof document !== "undefined" && document.currentScript) (root.EmberVoxelScripts || (root.EmberVoxelScripts = [])).push(document.currentScript);
})(typeof self !== "undefined" ? self : this);
