/* EmberMeshSimplify — quadric-error edge collapse for the painted figures (docs/design/MINIATURES.md §4).
 * A figure's surface-nets bake is dense and even (hundreds of thousands of triangles); at board size a
 * figure needs a few tens of thousands. simplify(mesh, target) collapses edges in order of error
 * (Garland–Heckbert quadrics, boundary edges held by side planes) onto one of their two endpoints —
 * a half-edge collapse, so every surviving vertex keeps its own colour, AO, face-decal UV and skin
 * weights untouched. Collapses that cross paint (a colour change), the painted face, a change of
 * dominant bone or that would flip a triangle cost more or are refused, so paint edges, the face and
 * the joints keep their shape. Pure data in, pure data out: runs in the page, the worker and Node. */
(function (root) {
  // mesh-array layout shared with EmberSculpt.bake / EmberVoxel.voxelize
  const ATTRS = [["position", 3], ["normal", 3], ["color", 3], ["aux", 4], ["aux2", 4], ["face", 4], ["skinIndex", 4], ["skinWeight", 4]];

  /** opts: { target: triangles, paint: colour-change weight, face: face-decal weight, bone: joint weight } */
  function simplify(m, opts = {}) {
    const t0 = Date.now();
    const P = m.position, C = m.color, F = m.face, SI = m.skinIndex, SW = m.skinWeight, A2 = m.aux2;
    const nv = P.length / 3, I = m.index, nf = I.length / 3;
    const target = Math.max(4, opts.target ?? Math.round(nf / 8));
    if (nf <= target) return { ...m, stats: { ...(m.stats || {}), tris: nf, simplifiedFrom: nf, ms: 0 } };
    const WP = opts.paint ?? 40, WF = opts.face ?? 60, WB = opts.bone ?? 4;

    // ---- welding: surface nets emits shared vertices already; parts merged side by side stay separate islands
    const fv = new Int32Array(I);                    // face → 3 vertices (−1 = dead face)
    const alive = new Uint8Array(nf).fill(1);
    // vertex → faces (CSR, rebuilt lazily through per-vertex arrays)
    const vf = Array.from({ length: nv }, () => []);
    for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vf[fv[f * 3 + k]].push(f);

    // ---- quadrics (10 floats per vertex), area weighted, plus boundary side planes
    const Q = new Float64Array(nv * 10);
    const addPlane = (v, a, b, c, d, w) => {
      const q = v * 10;
      Q[q] += w * a * a; Q[q + 1] += w * a * b; Q[q + 2] += w * a * c; Q[q + 3] += w * a * d;
      Q[q + 4] += w * b * b; Q[q + 5] += w * b * c; Q[q + 6] += w * b * d;
      Q[q + 7] += w * c * c; Q[q + 8] += w * c * d; Q[q + 9] += w * d * d;
    };
    const fn = new Float64Array(nf * 3);             // face normals (unnormalised, = 2 × area)
    function faceNormal(f, out, o = 0) {
      const a = fv[f * 3] * 3, b = fv[f * 3 + 1] * 3, c = fv[f * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      out[o] = uy * vz - uz * vy; out[o + 1] = uz * vx - ux * vz; out[o + 2] = ux * vy - uy * vx;
    }
    for (let f = 0; f < nf; f++) {
      faceNormal(f, fn, f * 3);
      const nx = fn[f * 3], ny = fn[f * 3 + 1], nz = fn[f * 3 + 2], L = Math.hypot(nx, ny, nz);
      if (L < 1e-20) continue;
      const a = nx / L, b = ny / L, c = nz / L, p = fv[f * 3] * 3, d = -(a * P[p] + b * P[p + 1] + c * P[p + 2]);
      for (let k = 0; k < 3; k++) addPlane(fv[f * 3 + k], a, b, c, d, L * 0.5);
    }
    // edge → face count, for boundaries
    const ekey = (a, b) => (a < b ? a * nv + b : b * nv + a);
    const ecount = new Map();
    for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) { const e = ekey(fv[f * 3 + k], fv[f * 3 + (k + 1) % 3]); ecount.set(e, (ecount.get(e) || 0) + 1); }
    for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) {
      const a = fv[f * 3 + k], b = fv[f * 3 + (k + 1) % 3];
      if (ecount.get(ekey(a, b)) !== 1) continue;
      // plane through the edge, perpendicular to the face: holds the border in place
      const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
      const nx = fn[f * 3], ny = fn[f * 3 + 1], nz = fn[f * 3 + 2];
      let px = ey * nz - ez * ny, py = ez * nx - ex * nz, pz = ex * ny - ey * nx; const L = Math.hypot(px, py, pz);
      if (L < 1e-20) continue; px /= L; py /= L; pz /= L;
      const d = -(px * P[a * 3] + py * P[a * 3 + 1] + pz * P[a * 3 + 2]), w = (ex * ex + ey * ey + ez * ez) * 20;
      addPlane(a, px, py, pz, d, w); addPlane(b, px, py, pz, d, w);
    }
    const qerr = (v, x, y, z) => {
      const q = v * 10;
      return Q[q] * x * x + 2 * Q[q + 1] * x * y + 2 * Q[q + 2] * x * z + 2 * Q[q + 3] * x + Q[q + 4] * y * y + 2 * Q[q + 5] * y * z + 2 * Q[q + 6] * y + Q[q + 7] * z * z + 2 * Q[q + 8] * z + Q[q + 9];
    };
    const dom = (v) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) if (SW[v * 4 + k] > w) { w = SW[v * 4 + k]; b = SI[v * 4 + k]; } return b; };
    const bone = new Int32Array(nv); for (let v = 0; v < nv; v++) bone[v] = dom(v);
    // extra cost of letting v's attributes stand for u's (u disappears into v)
    function attrCost(u, v, len2) {
      const dr = C[u * 3] - C[v * 3], dg = C[u * 3 + 1] - C[v * 3 + 1], db = C[u * 3 + 2] - C[v * 3 + 2];
      const de = A2 ? A2[u * 4 + 1] - A2[v * 4 + 1] : 0;              // a glow edge is paint too
      let c = WP * (dr * dr + dg * dg + db * db + 4 * de * de) * len2;
      if (F[u * 4 + 2] > 0.001 || F[v * 4 + 2] > 0.001) c += WF * len2;
      if (bone[u] !== bone[v]) c += WB * len2;
      return c;
    }
    // cost and direction of collapsing edge (a, b): the cheaper of a→b and b→a
    function edgeCost(a, b) {
      const ex = P[a * 3] - P[b * 3], ey = P[a * 3 + 1] - P[b * 3 + 1], ez = P[a * 3 + 2] - P[b * 3 + 2], len2 = ex * ex + ey * ey + ez * ez;
      const toB = qerr(a, P[b * 3], P[b * 3 + 1], P[b * 3 + 2]) + qerr(b, P[b * 3], P[b * 3 + 1], P[b * 3 + 2]) + attrCost(a, b, len2);
      const toA = qerr(a, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]) + qerr(b, P[a * 3], P[a * 3 + 1], P[a * 3 + 2]) + attrCost(b, a, len2);
      return toB <= toA ? [toB, a, b] : [toA, b, a];   // [cost, removed, kept]
    }

    // ---- binary heap of edges (lazy: stale entries are skipped by the version stamp)
    const ver = new Uint32Array(nv);
    let hc = [], hu = [], hv = [], hs = [];         // cost, removed, kept, stamp (sum of the two versions)
    const heap = [];
    const less = (i, j) => hc[heap[i]] < hc[heap[j]];
    const swap = (i, j) => { const t = heap[i]; heap[i] = heap[j]; heap[j] = t; };
    function push(a, b) {
      const [c, u, v] = edgeCost(a, b), id = hc.length;
      hc.push(c); hu.push(u); hv.push(v); hs.push(ver[a] + ver[b]);
      heap.push(id); let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
    }
    function pop() {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last; let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && less(l, s)) s = l; if (r < heap.length && less(r, s)) s = r; if (s === i) break; swap(i, s); i = s; }
      }
      return top;
    }
    for (const e of ecount.keys()) push(Math.floor(e / nv), e % nv);

    // ---- collapse loop
    let faces = nf;
    const nb = new Float64Array(3);
    const hasVert = (f, v) => fv[f * 3] === v || fv[f * 3 + 1] === v || fv[f * 3 + 2] === v;
    while (faces > target && heap.length) {
      const id = pop(), u = hu[id], v = hv[id];
      if (hs[id] !== ver[u] + ver[v] || u === v) continue;
      const fu = vf[u].filter((f) => alive[f]);
      if (!fu.some((f) => hasVert(f, v))) continue;              // no longer an edge
      // link condition: u and v share exactly the two (or one, on a border) opposite vertices
      const nu = new Set(), nvv = new Set();
      for (const f of fu) for (let k = 0; k < 3; k++) nu.add(fv[f * 3 + k]);
      for (const f of vf[v]) if (alive[f]) for (let k = 0; k < 3; k++) nvv.add(fv[f * 3 + k]);
      let shared = 0; for (const w of nu) if (w !== u && w !== v && nvv.has(w)) shared++;
      const common = fu.filter((f) => hasVert(f, v)).length;
      if (shared !== common) continue;
      // refuse flips: every face of u that survives must keep its orientation with u moved onto v
      let ok = true;
      for (const f of fu) {
        if (hasVert(f, v)) continue;
        const o = fn.subarray(f * 3, f * 3 + 3), ox = o[0], oy = o[1], oz = o[2];
        const k = fv[f * 3] === u ? 0 : fv[f * 3 + 1] === u ? 1 : 2;
        fv[f * 3 + k] = v; faceNormal(f, nb); fv[f * 3 + k] = u;
        if (nb[0] * ox + nb[1] * oy + nb[2] * oz <= 1e-12 * Math.hypot(ox, oy, oz)) { ok = false; break; }
      }
      if (!ok) { hc[id] = Infinity; continue; }
      // collapse
      for (const f of fu) {
        if (hasVert(f, v)) { alive[f] = 0; faces--; continue; }
        const k = fv[f * 3] === u ? 0 : fv[f * 3 + 1] === u ? 1 : 2;
        fv[f * 3 + k] = v; faceNormal(f, fn, f * 3); vf[v].push(f);
      }
      vf[u] = [];
      for (let k = 0; k < 10; k++) Q[v * 10 + k] += Q[u * 10 + k];
      ver[u]++; ver[v]++;
      const around = new Set();
      for (const f of vf[v]) if (alive[f]) for (let k = 0; k < 3; k++) around.add(fv[f * 3 + k]);
      around.delete(v);
      for (const w of around) push(v, w);
      if (hc.length > 4 * nf) {                    // compact the edge store now and then
        const keep = heap.filter((i) => hs[i] === ver[hu[i]] + ver[hv[i]]);
        const c2 = [], u2 = [], v2 = [], s2 = [];
        keep.forEach((i, n) => { c2.push(hc[i]); u2.push(hu[i]); v2.push(hv[i]); s2.push(hs[i]); keep[n] = n; });
        hc = c2; hu = u2; hv = v2; hs = s2; heap.length = 0; keep.forEach((i) => heap.push(i));
        for (let i = (heap.length >> 1) - 1; i >= 0; i--) { let j = i; for (;;) { const l = 2 * j + 1, r = l + 1; let s = j; if (l < heap.length && less(l, s)) s = l; if (r < heap.length && less(r, s)) s = r; if (s === j) break; swap(j, s); j = s; } }
      }
    }

    // ---- compact
    const remap = new Int32Array(nv).fill(-1);
    let n = 0; const idx = [];
    for (let f = 0; f < nf; f++) {
      if (!alive[f]) continue;
      for (let k = 0; k < 3; k++) { const w = fv[f * 3 + k]; if (remap[w] < 0) remap[w] = n++; idx.push(remap[w]); }
    }
    const out = { bones: m.bones };
    for (const [name, w] of ATTRS) {
      const src = m[name]; if (!src) continue;
      const dst = new src.constructor(n * w);
      for (let v = 0; v < nv; v++) if (remap[v] >= 0) for (let k = 0; k < w; k++) dst[remap[v] * w + k] = src[v * w + k];
      out[name] = dst;
    }
    out.index = new Uint32Array(idx);
    out.stats = { ...(m.stats || {}), verts: n, tris: idx.length / 3, simplifiedFrom: nf, ms: Date.now() - t0 };
    return out;
  }

  /** flatten the per-vertex colour jitter of a paint while keeping paint edges: each vertex moves toward the mean of
   *  its neighbours whose colour is within `tol` (an edge-preserving, bilateral pass), `it` passes */
  function flatten(m, tol = 0.06, it = 3, k = 0.7) {
    const nv = m.position.length / 3, I = m.index, C = m.color, S = new Float64Array(nv * 3), n = new Uint16Array(nv), t2 = tol * tol;
    for (let pass = 0; pass < it; pass++) {
      S.fill(0); n.fill(0);
      for (let f = 0; f < I.length; f += 3) for (let e = 0; e < 3; e++) {
        const p = I[f + e], q = I[f + (e + 1) % 3];
        const dr = C[p * 3] - C[q * 3], dg = C[p * 3 + 1] - C[q * 3 + 1], db = C[p * 3 + 2] - C[q * 3 + 2];
        if (dr * dr + dg * dg + db * db > t2) continue;
        for (let c = 0; c < 3; c++) { S[p * 3 + c] += C[q * 3 + c]; S[q * 3 + c] += C[p * 3 + c]; }
        n[p]++; n[q]++;
      }
      for (let v = 0; v < nv; v++) if (n[v]) for (let c = 0; c < 3; c++) C[v * 3 + c] += (S[v * 3 + c] / n[v] - C[v * 3 + c]) * k;
    }
    return m;
  }

  /** smooth a per-vertex channel (aux.z curvature…) over the mesh's edges, `it` passes */
  function relax(m, attr, width, comp, it = 2, k = 0.5) {
    const nv = m.position.length / 3, I = m.index, a = m[attr];
    const sum = new Float64Array(nv), cnt = new Uint16Array(nv);
    for (let pass = 0; pass < it; pass++) {
      sum.fill(0); cnt.fill(0);
      for (let f = 0; f < I.length; f += 3) for (let e = 0; e < 3; e++) {
        const p = I[f + e], q = I[f + (e + 1) % 3];
        sum[p] += a[q * width + comp]; cnt[p]++; sum[q] += a[p * width + comp]; cnt[q]++;
      }
      for (let v = 0; v < nv; v++) if (cnt[v]) a[v * width + comp] += (sum[v] / cnt[v] - a[v * width + comp]) * k;
    }
    return m;
  }

  const api = { simplify, relax, flatten };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EmberMeshSimplify = api;
  // recorded for EmberVoxelBaker, which rebuilds this pipeline in a worker from the scripts that loaded it
  if (typeof document !== "undefined" && document.currentScript) (root.EmberVoxelScripts || (root.EmberVoxelScripts = [])).push(document.currentScript);
})(typeof self !== "undefined" ? self : this);
