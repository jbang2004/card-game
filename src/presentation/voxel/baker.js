/* EmberVoxelBaker — voxelizes figures off the main thread (docs/design/MINIATURES.md §4). A figure's bake takes
 * 0.1–0.7 s of pure math; in the page that is a stalled frame (an idle animation, a hand-card hover or a combat
 * beat freezes, and late sound cues are dropped). The worker is rebuilt from the very scripts that loaded the
 * pipeline — sculpt, voxelize, kit and every figure file, which record themselves as they load
 * (EmberVoxelKit.scripts) — as `importScripts` of their URLs or, for inlined builds, their text; so the page, the
 * worker and the tests share one copy of the code (EmberVoxelKit.bakeData). The result is posted back with its typed
 * arrays transferred and cached by EmberVoxelRender.bake(id, data). If a worker cannot start (no Worker, a policy
 * that forbids blob workers, a script error), bake() rejects and callers bake in the page between actions. */
const EmberVoxelBaker = (() => {
  let worker = null, failed = false, seq = 0;
  const jobs = new Map();                                  // seq → { resolve, reject }
  const pending = new Map();                               // figure id → Promise (one bake per figure at a time)

  // the worker: the pipeline's scripts, then a handler that bakes one figure per message
  function source() {
    const els = (typeof EmberVoxelKit !== "undefined" && EmberVoxelKit.scripts) || [];
    if (els.length < 3) throw new Error("voxel pipeline scripts were not recorded");
    const parts = els.map((el) => (el.src ? `importScripts(${JSON.stringify(el.src)});` : el.textContent));
    parts.push(`
      // every typed array's buffer goes back as a transfer, not a copy
      function buffers(o, out) {
        if (!o || typeof o !== "object") return out;
        if (ArrayBuffer.isView(o)) { if (!out.includes(o.buffer)) out.push(o.buffer); return out; }
        for (const k in o) buffers(o[k], out);
        return out;
      }
      self.onmessage = (e) => {
        const { seq, id, V, VPROP } = e.data;
        try { const data = EmberVoxelKit.bakeData(id, V, VPROP); self.postMessage({ seq, data }, buffers(data, [])); }
        catch (error) { self.postMessage({ seq, error: String((error && error.message) || error) }); }
      };`);
    return parts.join("\n;\n");
  }
  function start() {
    if (worker || failed) return worker;
    try {
      if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") throw new Error("no Worker");
      const url = URL.createObjectURL(new Blob([source()], { type: "text/javascript" }));
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = (e) => {
        const job = jobs.get(e.data.seq); if (!job) return;
        jobs.delete(e.data.seq);
        if (e.data.error) job.reject(new Error(e.data.error)); else job.resolve(e.data.data);
      };
      worker.onerror = (e) => { e.preventDefault?.(); stop(e.message || "voxel baker failed"); };
    } catch (error) { stop(error?.message || error); }
    return worker;
  }
  function stop(reason) {
    failed = true;
    try { worker?.terminate(); } catch {}
    worker = null;
    for (const job of jobs.values()) job.reject(new Error(String(reason)));
    jobs.clear();
  }
  /** → Promise of the figure's bake data (EmberVoxelKit.bakeData); rejects when no worker can run */
  function bake(id) {
    if (pending.has(id)) return pending.get(id);
    const p = new Promise((resolve, reject) => {
      if (!start()) { reject(new Error("no voxel worker")); return; }
      const n = ++seq;
      jobs.set(n, { resolve, reject });
      worker.postMessage({ seq: n, id, V: EmberVoxelRender.V, VPROP: EmberVoxelRender.VPROP });
    });
    pending.set(id, p);
    p.then(() => pending.delete(id), () => pending.delete(id));
    return p;
  }
  return Object.freeze({ bake, get available() { return !failed; } });
})();
