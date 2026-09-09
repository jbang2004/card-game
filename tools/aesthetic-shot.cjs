const { chromium } = require("@playwright/test");
const fs = require("fs");

const BASE = process.env.SHOT_BASE || "http://127.0.0.1:8010/dist/";
const OUT = "artifacts/aesthetic-review";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const sizes = [
    { name: "1600", w: 1600, h: 940, mobile: false },
    { name: "1280", w: 1280, h: 800, mobile: false },
    { name: "390", w: 390, h: 844, mobile: true },
    { name: "844", w: 844, h: 390, mobile: true },
    { name: "320", w: 320, h: 568, mobile: true },
  ];

  const only = process.env.SHOT_SIZE;

  for (const s of sizes) {
    if (only && s.name !== only) continue;
    const page = await browser.newPage({
      viewport: { width: s.w, height: s.h },
      isMobile: s.mobile,
      hasTouch: s.mobile,
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(20000);
    const snap = async (name) => {
      await page
        .evaluate(() =>
          Promise.all(
            [...document.querySelectorAll("img")].map((i) =>
              i.decode().catch(() => {}),
            ),
          ),
        )
        .catch(() => {});
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/${s.name}-${name}.png` });
      console.log("shot", s.name, name);
    };

    await page.goto(BASE + "?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.waitForTimeout(1200);
    await snap("home");

    const openMenu = async (key) => {
      await page.locator("#touch-menu").click();
      await page.locator(`[data-touch-menu="${key}"]`).click();
    };

    // settings
    if (s.mobile) await openMenu("settings");
    else await page.locator("#settings-btn").click();
    await snap("settings");
    await page.locator(".modal-close").click();

    // collection
    if (s.mobile) await openMenu("cards");
    else await page.locator("#collection-nav").click();
    await snap("collection");
    await page.locator(".modal-close").click();

    // map
    if (s.mobile) await openMenu("map");
    else await page.locator("#adventure-nav").click();
    await snap("map");
    await page.locator(".modal-close").click();

    // help
    if (s.mobile) await openMenu("guide");
    else await page.locator("#guide-nav").click();
    await snap("help");
    await page.locator("#help-done").click();

    // heroes
    await page.locator("#start-btn").click();
    await snap("heroes");
    await page.locator("#hero-confirm").click();

    // mulligan
    await snap("mulligan");
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.waitForTimeout(800);
    await snap("battle");

    // contract
    const contractOpen = page.locator("#contract-open");
    if (await contractOpen.isVisible().catch(() => false)) {
      await contractOpen.click();
      await snap("contract");
      await page.locator(".modal-close").click().catch(() => {});
    }

    // hand detail / occupied board metrics
    const metrics = await page.evaluate(() => {
      const q = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      };
      return {
        viewport: { w: innerWidth, h: innerHeight },
        topbar: q(".topbar"),
        arena: q("#arena"),
        hand: q("#hand"),
        handLabel: q(".hand-label"),
        endTurn: q("#end-turn"),
        manaPanel: q(".mana-panel"),
        campaign: q(".campaign-panel"),
        playerHero: q("#player-hero"),
        enemyHero: q("#enemy-hero"),
        enemyMana: q(".enemy-mana"),
        playerDeck: q(".player-deck"),
        enemyDeck: q(".enemy-deck"),
        boardCenter: q(".board-center"),
        battleBottom: q(".battle-bottom"),
        bossPanel: q(".boss-panel"),
        logPanel: q(".log-panel"),
        turnControls: q(".turn-controls"),
        heroCaption: q(".hero-caption"),
        heroSideLabel: q("#hero-side-label"),
      };
    });
    fs.writeFileSync(
      `${OUT}/${s.name}-metrics.json`,
      JSON.stringify(metrics, null, 2),
    );
    await page.close();
  }
  await browser.close();
})();
