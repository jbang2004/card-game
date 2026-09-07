const { chromium } = require("@playwright/test");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const label = process.env.UI_LABEL || "before";
  fs.mkdirSync("artifacts/uiux", { recursive: true });
  for (const [w, h] of [
    [1600, 940],
    [390, 844],
    [844, 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      isMobile: w < 1000,
      hasTouch: w < 1000,
    });
    page.setDefaultTimeout(12000);
    await page.goto("http://127.0.0.1:8000/dist/?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    const snap = async (name) => {
      await page.evaluate(() =>
        Promise.all(
          [...document.querySelectorAll("#modal img")].map((i) =>
            i.decode().catch(() => {}),
          ),
        ),
      );
      await page.screenshot({
        path: `artifacts/uiux/${label}-${name}-${w}.png`,
      });
    };
    await snap("home");
    if (w === 1600) {
      await page.locator("#adventure-nav").click();
      await snap("map");
      await page.locator(".modal-close").click();
      await page.locator("#guide-nav").click();
      await snap("help");
      await page.locator("#help-done").click();
    }
    await page.locator("#settings-btn").click();
    await snap("settings");
    await page.locator("#settings-done").click();
    await page
      .locator(w < 1000 ? "#touch-collection" : "#collection-nav")
      .click();
    await snap("library");
    await page.locator(".modal-close").click();
    await page.locator("#start-btn").click();
    await snap("heroes");
    await page.locator("#hero-confirm").click();
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await snap("battle");
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
    const styles = await page.locator(".relic-choice p").evaluateAll((xs) =>
      xs.map((x) => ({
        text: x.textContent,
        color: getComputedStyle(x).color,
        font: getComputedStyle(x).fontSize,
        background: getComputedStyle(x.closest(".relic-choice"))
          .backgroundColor,
      })),
    );
    console.log(w, JSON.stringify(styles));
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
