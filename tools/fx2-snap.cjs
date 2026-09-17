#!/usr/bin/env node
/* 快档截图（V2 接口，2026-09-17）：把 EmberFx2 定格到指定毫秒截图 / 出 60fps 定格视频。
 *
 *   node tools/fx2-snap.cjs                              # 全部 kind，桌面 + 手机，接触帧 + 视频 + 拼图
 *   node tools/fx2-snap.cjs --kinds=fireball,holy        # 只跑这几个
 *   node tools/fx2-snap.cjs --viewport=mobile            # desktop | mobile | both（默认 both）
 *   node tools/fx2-snap.cjs --no-video                   # 只出接触帧与拼图（快档）
 *   node tools/fx2-snap.cjs --kinds=holy --times=120,260,300   # 额外按毫秒定格
 *   node tools/fx2-snap.cjs --out=/abs/dir               # 输出目录（默认 output/fx2-v2）
 *
 * 流程：起静态服务（端口 8882）→ 开页面（?debug=1）→ 战斗试玩 → 用 EmberDebug.game 布场
 * （敌我各三个随从）→ 量锚点（英雄取 .hero-card-inner，随从取卡片本身，EmberViewport.pos）
 * → EmberFx2.debugScript 排好 cast/attack/contact + 接触时刻的 impulse → debugSeek 定格截图。
 * 引擎固定 1/60s 步长 + 定种随机，所以同一 (kind, 毫秒) 每次截出来的是同一帧。
 *
 * 每个 kind 输出到 <out>/<kind>/：
 *   <viewport>-contact.png   接触帧（接触 + 顿帧 + 40ms），叠画目标包围盒（青）与
 *                            逐轴限制框（红，contactBoxMax × w × contactScale/1.2 乘 contactBoxMax × h × contactScale/1.2）
 *   <viewport>-60fps.mp4     从 0 到 duration + 顿帧 + 100ms 的逐帧定格视频（含 impulse）
 * 以及 <out>/mosaic-<viewport>.png：全部 kind 接触帧的对照拼图。
 *
 * 也被 tools/fx2-measure.cjs 复用（module.exports）。
 */
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { execFileSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.FX2_PORT) || 8882;
const TIER = 3;
const SEED = 7;

const VIEWPORTS = {
  desktop: { viewport: { width: 1600, height: 940 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

/** kind → 怎么调。attack 族从己方中间随从打敌方中间随从；法术从己方英雄卡出手。 */
const KINDS = [
  { kind: "slash", call: "attack" },
  { kind: "claw", call: "attack" },
  { kind: "slam", call: "attack" },
  { kind: "arrow", call: "attack" },
  { kind: "spear", call: "attack" },
  { kind: "bolt", call: "attack" },
  { kind: "breath", call: "attack" },
  { kind: "fireball", call: "cast" },
  { kind: "lightning", call: "cast" },
  { kind: "frost", call: "cast" },
  { kind: "frost-field", call: "cast", aoe: true },
  { kind: "holy", call: "cast" },
  { kind: "nature", call: "cast" },
  { kind: "void", call: "cast" },
  { kind: "siphon", call: "cast" },
  { kind: "arcane", call: "cast" },
  { kind: "bladeCross", call: "cast" },
  { kind: "contact", call: "contact" },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
};

function serve(port = PORT) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
    const file = path.join(REPO_ROOT, rel || "index.html");
    if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(port, "127.0.0.1", () => done(server)));
}

function launch() {
  return chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
    args: ["--use-gl=angle", "--ignore-gpu-blocklist"],
  });
}

/** 开一局战斗试玩并布场，返回 { ctx, page, anchors, errors }。 */
async function openBattle(browser, name, port = PORT) {
  const ctx = await browser.newContext(VIEWPORTS[name]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html?debug=1`);
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading, null, { timeout: 30000 });
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy, null, { timeout: 30000 });
  await page.waitForFunction(() => EmberFx2.diagnostics.ready || EmberFx2.diagnostics.failed, null, { timeout: 30000 });
  const anchors = await page.evaluate(() => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.active = "p";
    g.s.phase = "battle";
    for (let i = 0; i < 3; i++) g.summon("e", "treant");
    for (let i = 0; i < 3; i++) g.summon("p", "squire");
    // 召唤失调的纱网是卡面状态装饰，会被误读成"有东西画到卡面上了"
    g.s.e.board.forEach((m) => (m.sick = false));
    g.s.p.board.forEach((m) => (m.sick = false));
    g.events = [];
    g.emit();
    return null;
  });
  await page.waitForTimeout(600);
  const measured = await page.evaluate(() => {
    const box = (el) => {
      const p = el && EmberViewport.pos(el);
      return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
    };
    return {
      hero: box(document.querySelector("#player-hero .hero-card-inner") || document.getElementById("player-hero")),
      enemyHero: box(document.querySelector("#enemy-hero .hero-card-inner") || document.getElementById("enemy-hero")),
      friendly: [...document.querySelectorAll("#minions .minion.friendly")].map(box),
      enemy: [...document.querySelectorAll("#minions .minion.enemy")].map(box),
      stage: { w: EmberViewport.width, h: EmberViewport.height },
      diag: EmberFx2.diagnostics,
    };
  });
  return { ctx, page, anchors: Object.assign(measured, anchors || {}), errors };
}

/** 这个 kind 的调用参数（舞台坐标包围盒）。 */
function callFor(entry, anchors, tier = TIER) {
  const mid = anchors.enemy[1];
  const opts = { tier, seed: SEED };
  if (entry.call === "attack") {
    Object.assign(opts, { from: anchors.friendly[1], to: mid });
  } else if (entry.call === "contact") {
    Object.assign(opts, { at: mid });
  } else {
    Object.assign(opts, {
      from: anchors.hero,
      targets: entry.aoe ? anchors.enemy : [mid],
      aoe: !!entry.aoe,
    });
  }
  return { call: entry.call, kind: entry.kind, opts };
}

/**
 * 调用脚本：t=0 施放；每个接触时刻一次 impulse（第一个接触用本档，其余用 1 档 ——
 * 震屏与顿帧只触发一次，边缘闪每个目标各一次）。顿帧把此后的接触整体后移。
 */
async function scriptFor(page, entry, anchors, tier = TIER, withImpulse = true) {
  const c = callFor(entry, anchors, tier);
  const plan = await page.evaluate(
    ([kind, o, attack]) => EmberFx2.plan(kind, attack ? Object.assign({ attack: true }, o, { targets: [o.to] }) : o),
    [c.kind, c.opts, c.call === "attack"],
  );
  const hitStop = await page.evaluate((t) => EmberTiming.tiers[t].hitStopMs, tier);
  const targets = c.call === "attack" ? [c.opts.to] : c.call === "contact" ? [c.opts.at] : c.opts.targets;
  const order = plan.hitAt.map((h, i) => ({ h, i })).sort((a, b) => a.h - b.h);
  const script = [{ at: 0, call: c.call, kind: c.kind, opts: c.opts }];
  if (withImpulse) {
    order.forEach((o, n) => {
      script.push({
        at: o.h + (n > 0 ? hitStop : 0),
        call: "impulse",
        opts: { at: targets[o.i], tier: n === 0 ? tier : 1 },
      });
    });
  }
  return { call: c, plan, hitStop, targets, script };
}

async function seek(page, script, ms) {
  await page.evaluate(
    ([s, t]) => {
      EmberFx2.debugScript(s);
      EmberFx2.debugSeek(t);
    },
    [script, ms],
  );
  // 这一次 evaluate 同时起到"等合成器把 transform 落定"的作用
  await page.evaluate(() => document.documentElement.clientHeight);
}

async function overlay(page, label, targets, tier, show) {
  await page.evaluate(
    ([label, targets, tier, show]) => {
      document.getElementById("snap-overlay")?.remove();
      if (!show) return;
      const T = EmberTiming;
      const cs = T.tiers[tier].contactScale;
      const app = document.getElementById("app");
      const root = document.createElement("div");
      root.id = "snap-overlay";
      root.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:99;";
      for (const b of targets) {
        // 逐轴限制框：宽 contactBoxMax × w × contactScale/1.2、高 contactBoxMax × h × contactScale/1.2
        const LW = T.contactBoxMax * b.w * cs / 1.2;
        const LH = T.contactBoxMax * b.h * cs / 1.2;
        const t = document.createElement("div");
        t.style.cssText = `position:absolute;left:${b.x - b.w / 2}px;top:${b.y - b.h / 2}px;width:${b.w}px;height:${b.h}px;outline:1px solid #3ff;`;
        const r = document.createElement("div");
        r.style.cssText = `position:absolute;left:${b.x - LW / 2}px;top:${b.y - LH / 2}px;width:${LW}px;height:${LH}px;outline:1px solid #f22;`;
        root.append(t, r);
      }
      const tag = document.createElement("div");
      tag.textContent = label;
      tag.style.cssText = "position:absolute;left:8px;top:8px;padding:2px 8px;font:bold 16px/1.3 monospace;color:#fff;background:#000c;";
      root.append(tag);
      app.appendChild(root);
    },
    [label, targets, tier, show],
  );
}

async function shoot(page, file) {
  await page.screenshot({ path: file, scale: "css", animations: "allow" });
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (name, dflt) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : dflt;
  };
  const only = arg("kinds", "");
  const vpArg = arg("viewport", "both");
  const out = path.resolve(REPO_ROOT, arg("out", "output/fx2-v2"));
  const video = !args.includes("--no-video");
  const times = arg("times", "").split(",").filter(Boolean).map(Number);
  const kinds = only ? KINDS.filter((k) => only.split(",").includes(k.kind)) : KINDS;
  const viewports = vpArg === "both" ? ["desktop", "mobile"] : [vpArg];
  fs.mkdirSync(out, { recursive: true });

  const server = await serve();
  const browser = await launch();
  let failed = false;
  try {
    for (const vp of viewports) {
      const { ctx, page, anchors, errors } = await openBattle(browser, vp);
      if (!anchors.diag.available) throw new Error(`${vp}: EmberFx2 不可用 ${JSON.stringify(anchors.diag)}`);
      process.stdout.write(`[${vp}] stage ${anchors.stage.w}×${anchors.stage.h} hero ${JSON.stringify(anchors.hero)}\n`);
      const contactShots = [];
      for (const entry of kinds) {
        const dir = path.join(out, entry.kind);
        fs.mkdirSync(dir, { recursive: true });
        const s = await scriptFor(page, entry, anchors);
        const first = Math.min(...s.plan.hitAt);
        const contactAt = first + s.hitStop + 40;
        await seek(page, s.script, contactAt);
        await overlay(page, `${entry.kind} · ${vp} · hit ${s.plan.hitAt.join("/")}ms · +${contactAt - first}ms`, s.targets, TIER, true);
        const shot = path.join(dir, `${vp}-contact.png`);
        await shoot(page, shot);
        contactShots.push(shot);
        await overlay(page, "", [], TIER, false);
        for (const ms of times) {
          await seek(page, s.script, ms);
          await shoot(page, path.join(dir, `${vp}-${String(ms).padStart(4, "0")}ms.png`));
        }
        let line = `${entry.kind.padEnd(12)} hit ${s.plan.hitAt.join("/")} → ${path.relative(REPO_ROOT, shot)}`;
        if (video) {
          const frameDir = path.join(dir, `.frames-${vp}`);
          fs.rmSync(frameDir, { recursive: true, force: true });
          fs.mkdirSync(frameDir, { recursive: true });
          const end = s.plan.duration + s.hitStop * s.plan.hitAt.length + 100;
          const n = Math.ceil(end / (1000 / 60));
          for (let i = 0; i <= n; i++) {
            await seek(page, s.script, (i * 1000) / 60);
            await shoot(page, path.join(frameDir, `f${String(i).padStart(4, "0")}.png`));
          }
          const mp4 = path.join(dir, `${vp}-60fps.mp4`);
          execFileSync("ffmpeg", [
            "-loglevel", "error", "-y", "-framerate", "60",
            "-i", path.join(frameDir, "f%04d.png"),
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", mp4,
          ]);
          fs.rmSync(frameDir, { recursive: true, force: true });
          line += ` + ${path.basename(mp4)} (${n + 1} 帧)`;
        }
        process.stdout.write(line + "\n");
      }
      await page.evaluate(() => { EmberFx2.debugReset(); EmberFx2.debugResume(); });
      if (contactShots.length > 1) {
        const tmp = path.join(out, `.mosaic-${vp}`);
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        contactShots.forEach((f, i) => fs.copyFileSync(f, path.join(tmp, `m${String(i).padStart(2, "0")}.png`)));
        const cols = vp === "desktop" ? 6 : 9;
        const rows = Math.ceil(contactShots.length / cols);
        const mosaic = path.join(out, `mosaic-${vp}.png`);
        execFileSync("ffmpeg", [
          "-loglevel", "error", "-y", "-i", path.join(tmp, "m%02d.png"),
          "-vf", `${vp === "desktop" ? "scale=800:-1," : ""}tile=${cols}x${rows}:padding=4:color=black`,
          "-frames:v", "1", mosaic,
        ]);
        fs.rmSync(tmp, { recursive: true, force: true });
        process.stdout.write(`[${vp}] mosaic → ${mosaic}\n`);
      }
      if (errors.length) {
        failed = true;
        console.error(`[${vp}] 页面错误：\n` + errors.join("\n"));
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) process.exitCode = 1;
}

module.exports = { serve, launch, openBattle, callFor, scriptFor, seek, overlay, shoot, KINDS, VIEWPORTS, TIER, REPO_ROOT, PORT };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
