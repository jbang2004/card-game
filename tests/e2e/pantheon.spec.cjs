const { openDeckTools, finishDeckTools } = require("./helpers/deck-tools.cjs");
const { test, expect } = require("@playwright/test");
const gods = [
  ["mage", "jingchen", "stars"],
  ["paladin", "aurion", "dawn"],
  ["ranger", "fenlos", "hunt"],
];
for (const [width, height, touch] of [
  [1600, 940, false],
  [390, 844, true],
  [844, 390, true],
])
  for (const [hero, id, theme] of gods)
    test(`${id} ritual, layered portrait and persisted public progress ${width}`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({
        viewport: { width, height },
        isMobile: touch,
        hasTouch: touch,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() =>
        localStorage.setItem(
          "emberfall.settings.v1",
          JSON.stringify({ sound: false, reduced: false }),
        ),
      );
      await page.goto("./?debug=1");
      await page.waitForFunction(
        () => window.Emberfall && !AtelierWorld.loading,
      );
      await page.locator("#start-btn").click();
      await page.locator(`[data-hero="${hero}"]`).click();
      await page.locator("#hero-confirm").click();
      await page.locator("#mulligan-confirm").click();
      await page.waitForFunction(() => !EmberFX.busy);
      await page.locator("#contract-open").click();
      await expect(page.locator(`[data-invoke="${id}"]`)).toBeDisabled();
      await page.keyboard.press("Escape");
      await page.evaluate((id) => {
        const g = EmberDebug.game;
        g.s.turn = 9;
        g.s.active = "p";
        g.s.p.mana = g.s.p.maxMana = 9;
        g.s.p.board = [];
        g.s.e.board = [];
        const r = EmberData.byId[id].contract.ritual;
        g.s.p.devotion[r.kind] =
          r.kind === "spells"
            ? ["bolt", "frostbolt", "nova", "wisdom", "starweave", "fireball"]
            : r.amount;
        g.emit();
      }, id);
      await page.locator("#contract-open").click();
      const invoke = page.locator(`[data-invoke="${id}"]`);
      await expect(invoke).toBeEnabled();
      await invoke.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `artifacts/qa/pantheon-${id}-contract-${width}.png`,
      });
      await invoke.click();
      await expect(
        page.locator(`.divine-arrival[data-deity="${theme}"]`),
      ).toBeVisible();
      await page.waitForTimeout(650);
      await page.screenshot({
        path: `artifacts/qa/pantheon-${id}-arrival-${width}.png`,
      });
      await page.waitForFunction(() => !EmberFX.busy);
      await page.waitForFunction(
        (id) =>
          document.querySelector(
            `[data-art-key="${id}"][data-portrait-mode="board"]`,
          )?.complete,
        id,
      );
      await page.waitForTimeout(900);
      await page.screenshot({
        path: `artifacts/qa/pantheon-${id}-board-${width}.png`,
      });
      const state = await page.evaluate(() => Emberfall.game.s);
      expect(state.p.usedContracts).toEqual([id]);
      expect(state.p.mana).toBe(0);
      await page.reload();
      await page.waitForFunction(
        () => window.Emberfall && !AtelierWorld.loading,
      );
      await page.locator("#start-btn").click();
      expect(
        await page.evaluate(() => Emberfall.game.s.p.usedContracts),
      ).toEqual([id]);
      if (touch) {
        await page.setViewportSize({ width: height, height: width });
        await page.waitForTimeout(300);
        expect(
          await page.evaluate(() => Emberfall.game.s.p.usedContracts),
        ).toEqual([id]);
      }
      expect(errors).toEqual([]);
      await ctx.close();
    });
test("ranger may choose moon or hunt but cannot equip both gods; named loadout keeps the choice", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#collection-nav").click();
  await openDeckTools(page);
  await page.locator("#deck-class").selectOption("ranger");
  await openDeckTools(page);
  await page.locator("#deck-reset").click();
  await openDeckTools(page);
  await page.locator("#deck-contracts summary").click();
  await expect(page.locator('[data-deck-contract="fenlos"]')).toBeChecked();
  await expect(
    page.locator('[data-deck-contract="eclipsewolf"]'),
  ).not.toBeChecked();
  await expect(
    page.locator('[data-deck-contract="moonguard"]'),
  ).not.toBeChecked();
  await page.locator('[data-deck-contract="fenlos"]').uncheck();
  await page.locator('[data-deck-contract="selmyra"]').check();
  await page.locator("#deck-name").fill("游侠的冥月之誓");
  await finishDeckTools(page);
  await page.locator("#deck-play").click();
  await page.locator(".contract-setup summary").click();
  await expect(page.locator('[data-contract="selmyra"]')).toBeChecked();
  await expect(page.locator('[data-contract="fenlos"]')).not.toBeChecked();
  await page.locator("#hero-confirm").click();
  expect(await page.evaluate(() => Emberfall.game.s.p.contracts)).toEqual([
    "selmyra",
  ]);
});
