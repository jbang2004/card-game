#!/usr/bin/env node
/* fx2 量化探针（V2 接口，2026-09-17）。复用 tools/fx2-snap.cjs 的布场与调用脚本。
 *
 *   node tools/fx2-measure.cjs                     # 量化表：桌面 + 手机，全部 kind
 *   node tools/fx2-measure.cjs --viewport=desktop --kinds=holy,void
 *   node tools/fx2-measure.cjs --calibrate         # k = 1 时接触层的自然外包（给 SKILLS[kind].extent 定标）
 *   node tools/fx2-measure.cjs --perf              # 手机模拟（390×844、DPR 3、CPU 4× 降速）真实时钟施法
 *   node tools/fx2-measure.cjs --json=/abs/out.json
 *
 * 量化表每一行（tier 3，不叠 impulse，定格重放、逐帧读回 #fx-gl 像素）：
 *   wRatio     接触层可见像素的轴向外包宽 ÷ 目标卡宽（逐轴口径，2026-09-17 定）
 *   hRatio     接触层可见像素的轴向外包高 ÷ 目标卡高；两者都取接触后 0→250ms 所有帧的最大值，
 *              像素"可见" = 预乘输出 max(r,g,b,a) > 24/255（bloom 淡边一起算）
 *   limit      contactBoxMax × contactScale / 1.2（tier 3 = 1.25），宽高各自比
 *   centerLift 目标卡中央 50%×50% 区域的平均亮度（页面截图，0..1）在接触后 120ms 内相对
 *              无特效帧的最大提升（契约：≤ 0.2）
 *   groundOverUnion  群体地面层可见像素超出目标并集的逐边距离（≤ aoePad）
 *   residue    最后一帧仍有任何可见像素的时刻 − 接触时刻（全部层）
 *   hitErr     trace 里接触帧的真实时刻 − plan.hitAt（ms，应 < 1 帧）
 *   pathStart  路径层几何的起点是否落在 from 盒内（首帧路径记录的起点）
 *   pathEnd    接触帧前后路径层几何是否有点落在目标盒内
 *   pathOut    路径层几何点落在"from 盒 ∪ 目标盒 ∪ 两盒之间走廊"之外的个数
 */
const path = require("node:path");
const fs = require("node:fs");
const zlib = require("node:zlib");
const snap = require("./fx2-snap.cjs");

const FRAME = 1000 / 60;
const CENTER_FRAMES_MS = 120; // 卡面中央亮度：接触后这么长时间里逐帧取最大

function readPNG(file) {
  const buf = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  if (bd !== 8 || (ct !== 6 && ct !== 2)) throw new Error("只支持 8bit RGB/RGBA PNG");
  const ch = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * ch);
  const stride = w * ch;
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, ch, px };
}

/** 截目标卡中央 50%×50% 的区域，返回平均亮度（0..1）。页面截图 = 玩家真正看到的合成结果。 */
async function centerLuma(page, b) {
  const clip = { x: b.x - b.w / 4, y: b.y - b.h / 4, width: b.w / 2, height: b.h / 2 };
  const buf = await page.screenshot({ clip, scale: "css", animations: "allow" });
  const tmp = path.join(require("node:os").tmpdir(), `fx2-center-${process.pid}.png`);
  fs.writeFileSync(tmp, buf);
  const img = readPNG(tmp);
  let sum = 0;
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    const o = i * img.ch;
    sum += (0.2126 * img.px[o] + 0.7152 * img.px[o + 1] + 0.0722 * img.px[o + 2]) / 255;
  }
  return sum / n;
}
const THRESH = 24;

async function pixelsExtent(page, center) {
  return page.evaluate(([c, th]) => {
    const shot = EmberFx2.debugPixels();
    const { width: W, height: H, data, stageW, stageH } = shot;
    const sx = stageW / W;
    const sy = stageH / H;
    let hx = 0, hy = 0, n = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let y = 0; y < H; y++) {
      const row = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const i = (row + x) * 4;
        const v = Math.max(data[i], data[i + 1], data[i + 2], data[i + 3]);
        if (v <= th) continue;
        n++;
        const X = (x + 0.5) * sx;
        const Y = (y + 0.5) * sy;
        if (X < x0) x0 = X;
        if (X > x1) x1 = X;
        if (Y < y0) y0 = Y;
        if (Y > y1) y1 = Y;
        if (c) {
          hx = Math.max(hx, Math.abs(X - c.x));
          hy = Math.max(hy, Math.abs(Y - c.y));
        }
      }
    }
    return { n, hx, hy, x0, x1, y0, y1 };
  }, [center, THRESH]);
}

const inBox = (p, b, tol = 2) =>
  Math.abs(p[0] - b.x) <= b.w / 2 + tol && Math.abs(p[1] - b.y) <= b.h / 2 + tol;

function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((p[0] - a.x) * dx + (p[1] - a.y) * dy) / L2));
  return Math.hypot(p[0] - (a.x + dx * u), p[1] - (a.y + dy * u));
}

async function measureKind(page, entry, anchors, opts) {
  const s = await snap.scriptFor(page, entry, anchors, snap.TIER, false);
  const call = s.script[0];
  if (opts.calibrate) call.opts = Object.assign({}, call.opts, { k: 1 });
  const hits = s.plan.hitAt;
  const first = Math.min(...hits);
  const last = Math.max(...hits);
  const T = await page.evaluate(() => ({
    residue: EmberTiming.residueMaxMs, boxMax: EmberTiming.contactBoxMax,
    cs: EmberTiming.tiers.map((t) => t && t.contactScale),
  }));
  const limit = T.boxMax * T.cs[snap.TIER] / 1.2;
  const row = { kind: entry.kind, hitAt: hits.join("/"), limit: +limit.toFixed(3) };

  // ---- 接触层外包：群体技能另起一次"只打中间那个目标"的群体施法来量（同一配方，
  //      接触层按目标逐个缩放，多个目标同时在画时分不开）----
  let one = s;
  if (s.targets.length > 1) {
    const e1 = Object.assign({}, entry);
    const a1 = Object.assign({}, anchors, { enemy: [anchors.enemy[1], anchors.enemy[1], anchors.enemy[1]] });
    one = await snap.scriptFor(page, e1, a1, snap.TIER, false);
    one.script[0].opts = Object.assign({}, one.script[0].opts, { targets: [anchors.enemy[1]] });
    if (opts.calibrate) one.script[0].opts.k = 1;
  }
  const target = anchors.enemy[1];
  let bw = 0, bh = 0, nat = 0, pxAtHit = 0, pxBefore = 0;
  await page.evaluate(() => { EmberFx2.debugLayer = "contact"; });
  const single = true;
  const oneFirst = one === s ? first : 120;
  for (let t = oneFirst; t <= oneFirst + T.residue; t += FRAME) {
    await snap.seek(page, one.script, t);
    const e = await pixelsExtent(page, target);
    if (!e.n) continue;
    if (single) {
      nat = Math.max(nat, 2 * Math.max(e.hx, e.hy));
      bw = Math.max(bw, (e.x1 - e.x0) / target.w);
      bh = Math.max(bh, (e.y1 - e.y0) / target.h);
    }
  }
  await snap.seek(page, s.script, Math.max(0, first - FRAME));
  pxBefore = (await pixelsExtent(page, null)).n;
  await snap.seek(page, s.script, first + 0.5);
  pxAtHit = (await pixelsExtent(page, null)).n;
  if (single) {
    row.wRatio = +bw.toFixed(3);
    row.hRatio = +bh.toFixed(3);
    row.withinW = bw <= limit;
    row.withinH = bh <= limit;
    if (opts.calibrate) row.naturalExtent = Math.round(nat);
  }
  // ---- 卡面中央亮度提升（全部层、不叠 impulse：震屏会把插画挪位，读成亮度差）----
  await page.evaluate((l) => { EmberFx2.debugLayer = l || null; }, process.env.FX2_LIFT_LAYER);
  if (!opts.calibrate) {
    await snap.seek(page, [], 0);
    const base = await centerLuma(page, target);
    let lift = 0;
    for (let t = oneFirst; t <= oneFirst + CENTER_FRAMES_MS; t += FRAME) {
      await snap.seek(page, one.script, t);
      const l = (await centerLuma(page, target)) - base;
      if (process.env.FX2_LIFT_DEBUG) console.log(entry.kind, Math.round(t), l.toFixed(3));
      lift = Math.max(lift, l);
    }
    row.centerLift = +lift.toFixed(3);
  }
  await page.evaluate(() => { EmberFx2.debugLayer = "contact"; });
  row.contactPxBefore = pxBefore;
  row.contactPxAtHit = pxAtHit;

  // ---- 群体地面层：外包 ≤ 并集 + aoePad ---------------------------------------
  if (s.targets.length > 1) {
    await page.evaluate(() => { EmberFx2.debugLayer = "ground"; });
    let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity;
    for (let t = first; t <= last + T.residue; t += FRAME) {
      await snap.seek(page, s.script, t);
      const e = await pixelsExtent(page, null);
      if (!e.n) continue;
      gx0 = Math.min(gx0, e.x0); gx1 = Math.max(gx1, e.x1);
      gy0 = Math.min(gy0, e.y0); gy1 = Math.max(gy1, e.y1);
    }
    const ux0 = Math.min(...s.targets.map((b) => b.x - b.w / 2));
    const ux1 = Math.max(...s.targets.map((b) => b.x + b.w / 2));
    const uy0 = Math.min(...s.targets.map((b) => b.y - b.h / 2));
    const uy1 = Math.max(...s.targets.map((b) => b.y + b.h / 2));
    row.groundOverUnion = {
      left: +(ux0 - gx0).toFixed(1), right: +(gx1 - ux1).toFixed(1),
      top: +(uy0 - gy0).toFixed(1), bottom: +(gy1 - uy1).toFixed(1),
    };
  }

  // ---- 残留：全部层，接触后最后一帧可见像素 ------------------------------------
  await page.evaluate(() => { EmberFx2.debugLayer = null; });
  let lastVisible = last;
  for (let t = last; t <= last + T.residue + 120; t += FRAME) {
    await snap.seek(page, s.script, t);
    const e = await pixelsExtent(page, null);
    if (e.n) lastVisible = t;
  }
  row.residue = Math.round(lastVisible - last);
  row.busyAfter = await page.evaluate(() => EmberFx2.stats.busy);

  // ---- 接触帧与路径几何（trace）-------------------------------------------------
  const from = call.opts.from || call.opts.at;
  let starts = [], ends = [], out = 0, total = 0, hitErr = [];
  for (let t = FRAME; t <= last + T.residue; t += FRAME) {
    await page.evaluate(() => { EmberFx2.trace = []; });
    await snap.seek(page, s.script, t);
    const tr = await page.evaluate(() => EmberFx2.trace);
    for (const r of tr) {
      if (r.type === "contact" && hitErr.length < hits.length && !hitErr.find((h) => h.id === r.id)) {
        hitErr.push({ id: r.id, err: r.real - r.hit });
      }
      if (r.type !== "path") continue;
      if (Math.abs(r.outer - t) > FRAME) continue; // 只要最后渲染那一帧
      total++;
      if (!starts.length) starts = [r.a, r.b];
      const nearest = s.targets.reduce((best, b) =>
        Math.hypot(b.x - r.b[0], b.y - r.b[1]) < Math.hypot(best.x - r.b[0], best.y - r.b[1]) ? b : best);
      if (Math.abs(t - first) <= 2 * FRAME) ends.push(inBox(r.a, nearest) || inBox(r.b, nearest));
      for (const p of [r.a, r.b]) {
        const corridor = Math.max(from.w, from.h, nearest.w, nearest.h) / 2 + 24;
        if (!inBox(p, from) && !inBox(p, nearest) && segDist(p, from, nearest) > corridor) out++;
      }
    }
    await page.evaluate(() => { EmberFx2.trace = null; });
  }
  row.hitErr = hitErr.map((h) => +h.err.toFixed(1)).join("/");
  row.pathStart = starts.length ? starts.some((p) => inBox(p, from)) : "无路径";
  row.pathEnd = ends.length ? ends.some(Boolean) : "无路径";
  row.pathOut = total ? `${out}/${total * 2}` : "-";
  return row;
}

async function perf(browser, kinds, vp = "mobile", rate = 4, low = false, impulse = true) {
  const { ctx, page, anchors, errors } = await snap.openBattle(browser, vp);
  if (low) await page.evaluate(() => EmberFX.configure(false, true));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const list = kinds.map((k) => snap.callFor(k, anchors, 2));
  const result = await page.evaluate(async ([calls, withImpulse]) => {
    const frames = [];
    let last = performance.now();
    let running = true;
    let curKind = "";
    const tick = (now) => {
      if (!running) return;
      const s = EmberFx2.stats;
      frames.push({ kind: curKind, dt: now - last, js: s.jsMsLast, col: s.collectMsLast, ema: s.jsMs, busy: s.busy, q: s.quads });
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 500));
    // 真实时钟下的接触帧：trace 的接触记录（外部时钟）− 施放那一刻的外部时钟 − hitAt
    EmberFx2.trace = [];
    const hitErr = [];
    for (const c of calls) {
      curKind = c.kind;
      const outer0 = EmberFx2.stats.outer;
      const traceFrom = EmberFx2.trace.length;
      const p = c.call === "attack" ? EmberFx2.attack(c.kind, c.opts)
        : c.call === "contact" ? EmberFx2.contact(c.opts) : EmberFx2.cast(c.kind, c.opts);
      setTimeout(() => {
        const rec = EmberFx2.trace.slice(traceFrom).filter((r) => r.type === "contact");
        for (const r of rec) hitErr.push({ kind: c.kind, err: +(r.outer - outer0 - r.hit).toFixed(1) });
      }, (p ? p.duration : 300) + 150);
      const hit = p ? Math.min(...p.hitAt) : 0;
      if (withImpulse) setTimeout(() => EmberFx2.impulse({ at: c.opts.to || c.opts.at || c.opts.targets[0], tier: 2 }), hit);
      await new Promise((r) => setTimeout(r, (p ? p.duration : 300) + 250));
    }
    running = false;
    EmberFx2.trace = null;
    const busy = frames.filter((f) => f.busy);
    const p95 = (arr) => {
      const a = arr.slice().sort((x, y) => x - y);
      return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] : 0;
    };
    return {
      frames: busy.length,
      frameP95: p95(busy.map((f) => f.dt)),
      frameMedian: busy.map((f) => f.dt).sort((a, b) => a - b)[Math.floor(busy.length / 2)],
      jsP95: p95(busy.map((f) => f.js)),
      jsEmaP95: p95(busy.map((f) => f.ema)),
      collectP95: p95(busy.map((f) => f.col)),
      perKind: Object.fromEntries(calls.map((c) => {
        const fs = busy.filter((f) => f.kind === c.kind);
        return [c.kind, [+p95(fs.map((f) => f.js)).toFixed(1), +p95(fs.map((f) => f.col)).toFixed(1), p95(fs.map((f) => f.q))]];
      })),
      jsMax: Math.max(...busy.map((f) => f.js)),
      quadsP95: p95(busy.map((f) => f.q)),
      hitErr: hitErr.map((h) => h.kind + ":" + h.err).join(" "),
      hitErrMax: Math.max(...hitErr.map((h) => h.err)),
      hitErrMin: Math.min(...hitErr.map((h) => h.err)),
      frameDtP95All: p95(frames.map((f) => f.dt)),
      stats: (({ renderScale, canvasWidth, canvasHeight, lowTier, low, textures, texUnits }) =>
        ({ renderScale, canvasWidth, canvasHeight, lowTier, low, textures, texUnits }))(EmberFx2.stats),
    };
  }, [list, impulse]);
  await ctx.close();
  return { result, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, dflt) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
  };
  const only = arg("kinds", "");
  const kinds = only ? snap.KINDS.filter((k) => only.split(",").includes(k.kind)) : snap.KINDS;
  const vpArg = arg("viewport", "both");
  const viewports = vpArg === "both" ? ["desktop", "mobile"] : [vpArg];
  const jsonOut = arg("json", "");
  const server = await snap.serve();
  const browser = await snap.launch();
  const report = {};
  try {
    if (args.includes("--perf")) {
      const low = args.includes("--low");
      const vp = vpArg === "both" ? "mobile" : vpArg;
      const rate = Number(arg("cpu", vp === "mobile" ? "4" : "1"));
      const { result, errors } = await perf(browser, kinds, vp, rate, low, !args.includes("--no-impulse"));
      report.perf = result;
      console.log(JSON.stringify(result, null, 1));
      if (errors.length) console.error("页面错误：\n" + errors.join("\n"));
    } else {
      for (const vp of viewports) {
        const { ctx, page, anchors, errors } = await snap.openBattle(browser, vp);
        const rows = [];
        for (const entry of kinds) {
          const row = await measureKind(page, entry, anchors, { calibrate: args.includes("--calibrate") });
          rows.push(row);
          console.log(vp.padEnd(8), JSON.stringify(row));
        }
        report[vp] = rows;
        if (errors.length) console.error(`[${vp}] 页面错误：\n` + errors.join("\n"));
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify(report, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
