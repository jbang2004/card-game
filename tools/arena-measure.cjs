// Value / colour discipline of the 3D arena, measured the same way as the
// 2026-09-23 design study (docs/design/SLATE_DESIGN_SYSTEM.md §5.4b).
//
//   node tools/arena-measure.cjs            # the four layouts
//   ARENA_SIZE=1600 node tools/arena-measure.cjs
//
// Each layout starts the demo battle, hides the DOM (HUD, hand, units) so only
// #arena-gl is left, saves the frame to artifacts/arena-measure/ and prints:
//   centre / env   CIE L* of the court's middle ellipse over the ground outside it
//   dark           share of the frame below L* 20
//   light          share of the frame above L* 60
//   colour         share of the frame with chroma C* above 20
//   detail         mean L* gradient outside the court over inside its middle
// The court's screen box comes from EmberArena3D.board and the arena camera.
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.SHOT_BASE || "http://127.0.0.1:8000/dist/";
const OUT = "artifacts/arena-measure";
const SIZES = [
  { name: "1600", w: 1600, h: 940, mobile: false },
  { name: "1117", w: 1117, h: 884, mobile: true },
  { name: "390", w: 390, h: 844, mobile: true },
  { name: "844", w: 844, h: 390, mobile: true },
];

/* in-page: project the court's corners with the arena camera (pitch 57°, fov 27°) */
function courtBox() {
  const b = EmberArena3D.board, W = b.width, H = b.height, P = (57 * Math.PI) / 180, t = Math.tan((27 * Math.PI) / 360);
  const eye = [0, Math.sin(P) * b.dist, b.tz + Math.cos(P) * b.dist], sub = (a, c) => a.map((v, i) => v - c[i]), dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); }, cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  const f = norm(sub([0, 0, b.tz], eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const project = (p) => { const d = sub(p, eye), zc = dot(d, f); return [((dot(d, r) / (zc * t * (W / H))) * 0.5 + 0.5) * W, (0.5 - (dot(d, u) / (zc * t)) * 0.5) * H]; };
  const pts = [[-b.hx, 0, -b.hz], [b.hx, 0, -b.hz], [b.hx, 0, b.hz], [-b.hx, 0, b.hz]].map(project);
  const app = document.getElementById("app").getBoundingClientRect(), sx = app.width / W, sy = app.height / H;
  const xs = pts.map((p) => app.x + p[0] * sx), ys = pts.map((p) => app.y + p[1] * sy);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/* in-page: the five numbers over a PNG (data url) and a court box in CSS px */
async function measure({ url, box, dpr }) {
  const img = new Image(); img.src = url; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, W, H).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const fl = (x) => (x > 216 / 24389 ? Math.cbrt(x) : (24389 / 27 * x + 16) / 116);
  const L = new Float32Array(W * H); let dark = 0, light = 0, colour = 0;
  for (let i = 0; i < W * H; i++) {
    const r = lin(d[i * 4]), gg = lin(d[i * 4 + 1]), b = lin(d[i * 4 + 2]);
    const fx = fl((0.4124 * r + 0.3576 * gg + 0.1805 * b) / 0.95047), fy = fl(0.2126 * r + 0.7152 * gg + 0.0722 * b), fz = fl((0.0193 * r + 0.1192 * gg + 0.9505 * b) / 1.08883);
    const l = 116 * fy - 16; L[i] = l; if (l < 20) dark++; else if (l > 60) light++;
    if (Math.hypot(500 * (fx - fy), 200 * (fy - fz)) > 20) colour++;
  }
  const [x0, y0, x1, y1] = box.map((v) => v * dpr), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
  const zone = { centre: [0, 0, 0], env: [0, 0, 0] };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, nx = (x - cx) / hw, ny = (y - cy) / hh, grad = Math.hypot(L[i + 1] - L[i - 1], L[i + W] - L[i - W]);
    const z = Math.hypot(nx, ny) < 0.4 ? zone.centre : Math.abs(x - cx) > hw + 40 * dpr || Math.abs(y - cy) > hh + 40 * dpr ? zone.env : null;
    if (z) { z[0] += L[i]; z[1] += grad; z[2]++; }
  }
  const n = W * H, mean = (z, k) => (z[2] ? z[k] / z[2] : NaN);
  return { centre: mean(zone.centre, 0), env: mean(zone.env, 0), ratio: mean(zone.centre, 0) / mean(zone.env, 0), dark: (dark / n) * 100, light: (light / n) * 100, colour: (colour / n) * 100, detail: mean(zone.env, 1) / mean(zone.centre, 1) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const rows = [];
  for (const s of SIZES) {
    if (process.env.ARENA_SIZE && s.name !== process.env.ARENA_SIZE) continue;
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, isMobile: s.mobile, hasTouch: s.mobile, deviceScaleFactor: 1 });
    await page.goto(BASE + "?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading, null, { timeout: 30000 });
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => Emberfall.inBattle && !EmberFX.busy, null, { timeout: 30000 });
    await page.waitForFunction(() => EmberArena3D.failed || (EmberArena3D.active && EmberArena3D.ready), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const box = await page.evaluate(courtBox);
    await page.evaluate(() => document.querySelectorAll("#minions .minion").forEach((e) => e.remove()));
    await page.addStyleTag({ content: "body *{visibility:hidden !important} #arena-gl{visibility:visible !important}" });
    await page.waitForTimeout(600);
    const file = path.join(OUT, `arena-${s.name}.png`);
    await page.screenshot({ path: file });
    const m = await page.evaluate(measure, { url: "data:image/png;base64," + fs.readFileSync(file).toString("base64"), box, dpr: 1 });
    const board = await page.evaluate(() => EmberArena3D.board);
    rows.push({ layout: `${s.w}x${s.h}`, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, +v.toFixed(k === "ratio" || k === "detail" ? 2 : 1)])), artMs: board.artMs, tier: board.tier });
    await page.close();
  }
  await browser.close();
  console.table(rows);
})().catch((e) => { console.error(e); process.exit(1); });
