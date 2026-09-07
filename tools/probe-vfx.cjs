/* Local diagnostic probe; requires the built game served with local debug access.
 * Measures active VFX CPU/rAF intervals and captures all three viewport layouts. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const pct = (a, n) => {
  const b = [...a].sort((a, b) => a - b);
  return b[Math.min(b.length - 1, Math.floor(b.length * n))] || 0;
};
(async () => {
  fs.mkdirSync("artifacts/qa/vfx-signatures", { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
  });
  const report = {
    date: new Date().toISOString(),
    note: "Headless local Chrome, requestAnimationFrame intervals and Canvas compositor CPU time; touch viewport emulation, not physical mobile or whole-device GPU certification.",
    viewports: [],
  };
  for (const [name, width, height, mobile] of [
    ["desktop", 1600, 940, false],
    ["portrait", 390, 844, true],
    ["landscape", 844, 390, true],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
    });
    await page.goto(
      process.env.VFX_URL || "http://127.0.0.1:8000/dist/?debug=1",
    );
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.evaluate(() => EmberVFX.prepare());
    const measured = await page.evaluate(async () => {
      const g = EmberDebug.game;
      g.s.p.board = [];
      g.s.e.board = [];
      g.s.p.mana = 10;
      g.s.p.hand = [g.card("storm")];
      g.s.e.hp = g.s.e.maxHp;
      g.s.e.armor = 0;
      for (let i = 0; i < 7; i++) g.summon("e", "treant");
      g.events = [];
      g.emit();
      const intervals = [],
        cpu = [];
      let last = 0;
      let sample = true;
      const tick = (t) => {
        if (EmberVFX.active) {
          if (last) intervals.push(t - last);
          cpu.push(EmberVFX.diagnostics.frameMs);
        }
        last = t;
        if (sample) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      Emberfall.act(() =>
        g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
      );
      await new Promise((r) => setTimeout(r, 2200));
      sample = false;
      return { intervals, cpu, metrics: EmberVFX.diagnostics };
    });
    report.viewports.push({
      name,
      width,
      height,
      rafP50Ms: pct(measured.intervals, 0.5),
      rafP95Ms: pct(measured.intervals, 0.95),
      vfxCpuP95Ms: pct(measured.cpu, 0.95),
      samples: measured.cpu.length,
      metrics: measured.metrics,
    });
    await page.evaluate(() => Emberfall.showFXLab());
    await page.waitForTimeout(1900);
    await page.locator("#lab-variant").selectOption("storm");
    await page.waitForTimeout(540);
    await page.screenshot({
      path: `artifacts/qa/vfx-signatures/lab-${name}.png`,
    });
    await page.evaluate(() => Emberfall.closeModal());
    // Trigger a real boss phase transition through a real damaging play.
    await page.evaluate(() => {
      const g = EmberDebug.game;
      EmberFX.cancel(true);
      g.s.mode = "campaign";
      g.s.phase2 = false;
      g.s.p.board = [];
      g.s.e.board = [];
      g.s.e.hp = Math.floor(g.s.e.maxHp / 2) + 1;
      g.s.e.armor = 0;
      g.s.p.mana = 10;
      g.s.p.hand = [g.card("bolt")];
      g.events = [];
      g.emit();
      Emberfall.act(() =>
        g.dispatch({
          type: "play",
          side: "p",
          uid: g.s.p.hand[0].uid,
          target: { side: "e", uid: "hero" },
        }),
      );
    });
    await page.waitForFunction(() =>
      document.getElementById("cinematic").classList.contains("visible"),
    );
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `artifacts/qa/vfx-signatures/phase-${name}.png`,
    });
    await page.waitForFunction(() => !EmberFX.busy && EmberFX.particles === 0);
    report.viewports.at(-1).phase2 = await page.evaluate(
      () => EmberDebug.game.s.phase2,
    );
    await page.close();
  }
  fs.writeFileSync(
    "artifacts/qa/vfx-metrics.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();
