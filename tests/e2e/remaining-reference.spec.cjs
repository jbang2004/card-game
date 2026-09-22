const { openCovenantPage } = require("./helpers/covenant.cjs");
const { test, expect } = require("@playwright/test");
const path = require("node:path");
const out = path.resolve(
  process.env.REFERENCE_OUTPUT || "output/remaining-reference-20260913",
);
async function ready(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function shot(page, name) {
  await page.waitForTimeout(250);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const urls = new Set();
    for (const e of document.querySelectorAll("#modal, #modal *")) {
      for (const m of getComputedStyle(e).backgroundImage.matchAll(
        /url\(["']?(.*?)["']?\)/g,
      ))
        urls.add(m[1]);
    }
    await Promise.all(
      [...urls].map((url) => {
        const i = new Image();
        i.src = url;
        return i.decode().catch(() => {});
      }),
    );
    await Promise.all(
      [...document.querySelectorAll("#modal img")].map((e) =>
        e.decode().catch(() => {}),
      ),
    );
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  if (process.env.VISUAL_DISCIPLINE) {
    const issues =
      await require("./helpers/visual-discipline.cjs").inspectVisualDiscipline(
        page,
      );
    require("node:fs").writeFileSync(
      path.join(out, `${name}-discipline.json`),
      JSON.stringify(issues, null, 2),
    );
    if (process.env.VISUAL_DISCIPLINE === "strict") expect(issues).toEqual([]);
  }
}
test("reference pages: live settings, guide chapters, hero modes and public contract selection", async ({
  page,
}) => {
  await page.setViewportSize({
    width: Number(process.env.REFERENCE_WIDTH) || 1672,
    height: Number(process.env.REFERENCE_HEIGHT) || 941,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.locator("#settings-btn").click();
  await page.locator("#audio-sfxVolume").fill("60");
  await page.locator("#audio-sfxVolume").dispatchEvent("input");
  await expect(page.locator("#audio-sfxVolume + output")).toHaveText("60%");
  await shot(page, "settings");
  await page.locator('[data-section="operation"]').click();
  await page.locator('[data-setting="fast"]').click();
  await page.locator("#settings-done").click();
  await page.reload();
  await page.waitForFunction(() => window.Emberfall);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("emberfall.settings.v1")).sfxVolume,
    ),
  ).toBe(0.6);
  await page.locator("#guide-nav").click();
  await shot(page, "help");
  await page.locator(".help-toc button").nth(3).click();
  await expect(page.locator(".key-table")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#lobby-library-btn").click();
  await shot(page, "library");
  await page.locator("[data-library-inspect]").first().click();
  await page.locator("#card-stage #library-detail-add").waitFor();
  await shot(page, "detail");
  // The card is held up over the library: one Escape puts it back, the next leaves.
  await page.keyboard.press("Escape");
  await expect(page.locator("#card-stage")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator("#adventure-nav").click();
  await page.locator(".atlas-ready").waitFor();
  await page.locator('[data-map-node="1"]').click();
  await shot(page, "map");
  await expect(page.locator(".atlas-dossier h3")).toHaveText("荆棘女王");
  await page.keyboard.press("Escape");
  await page.locator("#start-btn").click();
  await shot(page, "heroes");
  await page.locator('[data-mode="practice"]').click();
  await expect(page.locator("#game-mode")).toHaveValue("practice");
  await expect(page.locator("#practice-opponent")).toBeVisible();
  await page.locator('[data-mode="campaign"]').click();
  await page.locator('[data-hero="morla"]').click();
  await page.locator("#hero-confirm").click();
  await page.locator("[data-mulligan]").first().click();
  await expect(page.locator(".mulligan-choice-state").first()).toContainText(
    "替换",
  );
  await shot(page, "mulligan");
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await openCovenantPage(page);
  await shot(page, "contracts");
  const chooser = page.locator(".reference-active-side [data-contract-select]");
  await chooser.nth(1).click();
  await expect(
    page.locator(".reference-active-side .reference-active-contract"),
  ).toHaveAttribute(
    "data-deity",
    await chooser.nth(1).getAttribute("data-contract-select"),
  );
  await page.locator('[data-side="1"]').click();
  await expect(page.locator(".covenant-side").nth(1)).toHaveClass(
    /reference-active-side/,
  );
  await page.keyboard.press("Escape");
  await page.locator("#settings-btn").click();
  await page.locator("#restart-battle").click();
  await shot(page, "confirm");
  await page.locator("#cancel-confirm").click();
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.choice = { side: "p", cards: ["spark", "frostbolt", "fireball"] };
    g.emit();
  });
  await page.locator("[data-discover]").first().waitFor();
  await shot(page, "discover");
  await page.locator("[data-discover]").first().click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    EmberFX.configure(true, false);
    const g = EmberDebug.game;
    g.s.e.hp = 0;
    g.s.rewardOffers = ["heart", "lens", "crown"];
    g.cleanup();
    g.emit();
  });
  await page.locator("#result-next").waitFor();
  await shot(page, "result");
  await page.locator("#result-next").click();
  await page.locator('[data-relic="lens"]').click();
  await shot(page, "rewards");
  await expect(page.locator("#reward-confirm")).toBeEnabled();
  await page.locator("#reward-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.hp = 0;
    g.cleanup();
    g.emit();
  });
  await page.locator("#result-next").waitFor();
  await shot(page, "defeat");
  expect(errors).toEqual([]);
});
for (const [w, h, touch] of [
  [1672, 941, false],
  [390, 844, true],
  [844, 390, true],
  [320, 568, true],
  [568, 320, true],
])
  test(`reference battle controls and rotation ${w}x${h}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      hasTouch: touch,
      isMobile: touch,
    });
    const p = await ctx.newPage();
    await ready(p);
    await p.locator("#quick-btn").click();
    await p.waitForFunction(() => Emberfall.inBattle && !EmberFX.busy);
    for (const s of ["#end-turn", "#power-btn", "#contract-open"]) {
      await p.locator(s).click({ trial: true });
      const r = await p.locator(s).boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(w + 1);
      /* The god slot is a hand card parked at the end of the dock: like the
         rest of the fan its lower third deliberately hangs off the screen
         (docs/design/BATTLE_REDESIGN_20260914.md §11), so only its visible
         band has to be on screen. */
      if (touch && s === "#contract-open")
        expect(r.y + 44).toBeLessThanOrEqual(h + 1);
      else expect(r.y + r.height).toBeLessThanOrEqual(h + 1);
    }
    await shot(p, `battle-${w}`);
    if (touch) {
      const before = await p.evaluate(() => JSON.stringify(Emberfall.game.s));
      await p.setViewportSize({ width: h, height: w });
      await p.waitForFunction(() => EmberViewport.width === innerWidth);
      expect(await p.evaluate(() => JSON.stringify(Emberfall.game.s))).toBe(
        before,
      );
    }
    await ctx.close();
  });

for (const [w, h, name] of [
  [470, 836, "battle-portrait-reference"],
  [922, 427, "battle-landscape-reference"],
])
  test(`reference mobile bitmap capture ${name}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await ready(page);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => Emberfall.inBattle && !EmberFX.busy);
    await shot(page, name);
    await ctx.close();
  });
