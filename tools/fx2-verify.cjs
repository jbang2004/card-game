#!/usr/bin/env node
/* 收尾链的恒等性验证：#fx-gl 是压在战场 DOM 之上的叠加层，没有特效在跑时
 * 它必须是**逐像素全透明**的 —— 浏览器按 dst = src.rgb + dst*(1-a) 合成，
 * 全透明时屏幕上留下的就是 #world-canvas 本身，逐像素相同。
 *
 *   node tools/fx2-verify.cjs
 *
 * 逐项打印：完全中性 / 引擎默认基线 / 单独加回某一项后的偏离量。
 * maxDelta 为 0 表示这一层什么都没往屏幕上写。
 */
const { chromium } = require("playwright");
const path = require("node:path"),
  fs = require("node:fs"),
  http = require("node:http");
const ROOT = path.resolve(__dirname, "..");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
};
const srv = http.createServer((q, r) => {
  const f = path.join(
    ROOT,
    decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html",
  );
  if (!fs.existsSync(f)) {
    r.writeHead(404).end();
    return;
  }
  r.writeHead(200, {
    "Content-Type": MIME[path.extname(f)] || "application/octet-stream",
  });
  fs.createReadStream(f).pipe(r);
});
srv.listen(Number(process.env.FX2_PORT) || 8882, "127.0.0.1", async () => {
  const b = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${Number(process.env.FX2_PORT) || 8882}/index.html?debug=1`);
  await p.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await p.locator("#quick-btn").click();
  await p.waitForFunction(() => !EmberFX.busy);
  await p.waitForFunction(() => EmberFx2.available, null, { timeout: 20000 });
  await p.waitForTimeout(800);
  // 1) 完全中性
  console.log(
    "NEUTRAL   ",
    JSON.stringify(await p.evaluate(() => EmberFx2.debugSceneDelta())),
  );
  // 2) 用引擎自己的 DEFAULT_POST（override=null）→ 空闲基线
  console.log(
    "DEFAULT   ",
    JSON.stringify(await p.evaluate(() => EmberFx2.debugSceneDelta(null))),
  );
  // 3) 逐项加回来（V2 后期链只剩 bloom / 折射 / 色调压缩），看谁在改色
  for (const [name, o] of [
    ["tone .80", { tone: 0.8 }],
    ["bloom1 .30", { bloom1: 0.3 }],
    ["bloom2 .16", { bloom2: 0.16 }],
  ]) {
    const r = await p.evaluate(
      (o) => EmberFx2.debugSceneDelta(Object.assign({ bloom1: 0, bloom2: 0, distort: 0, tone: 1 }, o)),
      o,
    );
    console.log(name.padEnd(12), JSON.stringify(r));
  }
  console.log(errs.length ? "ERRORS " + errs.join("|") : "no errors");
  await b.close();
  srv.close();
});
