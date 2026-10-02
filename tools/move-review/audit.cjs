#!/usr/bin/env node
/* Move audit (docs/design/MOVES.md): plays figures' attacks on the review page's clock, frame by frame, and reports
 * what a reviewer would otherwise have to catch by eye, with a sheet of each take's key moments.
 *
 *   node tools/move-review/audit.cjs paladin spark        these figures
 *   node tools/move-review/audit.cjs --all                every figure with a sheet and a model
 *   node tools/move-review/audit.cjs --verbose paladin    every check, not only the ones to look at
 *   … --port 8013                                         the review server to use (started here when none answers)
 *
 * Each figure's attack, heavy blow, being hit, triumph and rest are measured. Writes tools/move-review/audits/<id>.json
 * and <id>.jpg (a sheet of its key moments, 640 px each, with the worst frame of whatever was flagged). The numbers and their limits are the
 * page's (Review.audit, Review.LIMIT in app.js); a failed check is a thing to look at, not a verdict. Exits 1 only when
 * the sheets themselves are wrong (EmberMoveSheet.validate). */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const { chromium } = require("@playwright/test");

const ROOT = path.join(__dirname, "..", "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const port = args.includes("--port") ? Number(args[args.indexOf("--port") + 1]) : 8013;
const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--port");
const BASE = `http://127.0.0.1:${port}`;

const up = () => new Promise((res) => { const r = http.get(`${BASE}/__review/state`, (m) => { m.resume(); res(m.statusCode === 200); }); r.on("error", () => res(false)); r.setTimeout(800, () => { r.destroy(); res(false); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!ids.length && !flag("--all")) { console.error("usage: node tools/move-review/audit.cjs <figure id …> | --all  [--verbose] [--port N]"); process.exit(2); }
  let server = null;
  if (!(await up())) {
    server = spawn("python3", [path.join(__dirname, "serve.py"), "--port", String(port)], { cwd: ROOT, stdio: "ignore" });
    for (let i = 0; i < 40 && !(await up()); i++) await sleep(150);
    if (!(await up())) { console.error("the review server did not start"); process.exit(2); }
  }
  const executablePath = process.env.CHROMIUM_PATH || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined);
  const browser = await chromium.launch({ executablePath, args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  let code = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
    page.on("pageerror", (e) => console.error("page error:", e.message));
    await page.goto(`${BASE}/?who=${ids[0] || "paladin"}`);
    await page.waitForFunction(() => typeof Review !== "undefined" && !Review.clock.busy && Review.unit(Review.HERO)?.state === "live", null, { timeout: 120000 });
    const problems = await page.evaluate(() => Review.problems);
    if (problems.length) { console.log(`招式单有 ${problems.length} 处问题：\n  ` + problems.join("\n  ")); code = 1; }
    const list = flag("--all") ? await page.evaluate(() => Object.keys(EmberMoveSheet.sheets.figures).filter((id) => typeof EmberModelArt !== "undefined" && EmberModelArt[id])) : ids;
    let flagged = 0;
    for (const id of list) {
      let a;
      try { a = await page.evaluate((who) => Review.audit(who), id); }
      catch (e) { console.log(`\n${id}: 自检没跑完 — ${String(e.message).split("\n")[0]}`); flagged++; continue; }
      if (a.failed) flagged++;
      console.log(`\n${a.name}（${id}）${a.failed ? ` — ${a.failed} 项要看` : " — 无异常"}`);
      for (const c of a.checks) if (!c.ok || flag("--verbose")) console.log(`  ${c.ok ? "✓" : c.seen ? "○" : "✗"} ${c.text}${c.seen ? `（已确认：${c.seen}）` : c.ok ? "" : `  [${c.key}]`}`);
    }
    console.log(`\n${list.length} 个角色，${flagged} 个有要看的项。联络图与数值在 tools/move-review/audits/`);
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  process.exit(code);
})();
