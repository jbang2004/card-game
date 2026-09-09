const { chromium } = require("@playwright/test");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const all = [];
  for (const [width, height] of [
    [1600, 940],
    [390, 844],
    [844, 390],
    [568, 320],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 1000,
      hasTouch: width < 1000,
    });
    page.setDefaultTimeout(7000);
    await page.goto("http://127.0.0.1:8000/dist/?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    const snap = async (name) => {
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `artifacts/uiux/detail-audit-${width}-${name}.png`,
      });
      const data = await page.evaluate(() => {
        let out = [];
        for (const e of document.querySelectorAll(
          "#modal button,#modal input,#modal select,#modal summary,#modal .deck-list,#modal .modal-scroll,#modal .modal-footer,#modal .reward-footer",
        )) {
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          let clip = r;
          for (let p = e.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/auto|scroll|hidden/.test(s.overflowY)) {
              const q = p.getBoundingClientRect();
              clip = {
                top: Math.max(clip.top, q.top),
                bottom: Math.min(clip.bottom, q.bottom),
                left: Math.max(clip.left, q.left),
                right: Math.min(clip.right, q.right),
              };
            }
          }
          out.push({
            selector: e.id ? "#" + e.id : e.className,
            text: e.textContent.trim().slice(0, 40),
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            visible: Math.max(0, clip.bottom - clip.top),
            font: getComputedStyle(e).fontSize,
          });
        }
        return out;
      });
      all.push({ width, height, name, data });
    };
    await page.locator("#settings-btn").click();
    await snap("settings");
    await page.locator("#settings-done").click();
    await page
      .locator(width < 1000 ? "#touch-collection" : "#collection-nav")
      .click();
    await snap("library");
    if (width < 1000) await page.locator("#touch-deck-tab").click();
    await snap("deck");
    await page.locator("#deck-tools summary").first().click();
    await snap("library-expanded");
    await page.locator(".modal-close").click();
    for (const [sel, name] of [
      ["#adventure-nav", "map"],
      ["#guide-nav", "help"],
    ]) {
      await page.locator(sel).evaluate((e) => e.click());
      await snap(name);
      await page.locator(".modal-close").click();
    }
    await page.locator("#start-btn").click();
    await snap("heroes");
    await page.locator("#hero-confirm").click();
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await snap("battle");
    await page.locator("#contract-open").click();
    await snap("contracts");
    await page.locator(".modal-close").click();
    await page.evaluate(() => {
      Emberfall.settings.reduced = true;
      EmberFX.configure(true, false);
      EmberDebug.game.s.rewardOffers = ["heart", "lens", "banner"];
      EmberDebug.game.s.e.hp = 0;
      EmberDebug.game.cleanup();
      EmberDebug.game.emit();
    });
    await page.locator("#result-next").click();
    await snap("rewards");
    await page.locator(".campaign-refit summary").click();
    await snap("rewards-expanded");
    await page.close();
    console.log("done", width);
  }
  fs.writeFileSync(
    "artifacts/uiux/detail-audit.json",
    JSON.stringify(all, null, 2),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
