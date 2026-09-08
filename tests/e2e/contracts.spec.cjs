const { test, expect } = require("@playwright/test");
async function open(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function begin(page) {
  await page.locator("#start-btn").click();
  await page.locator('[data-hero="morla"]').click();
  await expect(page.locator("#hero-archetype")).toHaveValue("moon_covenant");
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
}
for (const [width, height, touch] of [
  [1600, 940, false],
  [390, 844, true],
  [844, 390, true],
]) {
  test(`covenant selection, solemn arrival and persistent public resources ${width}x${height}`, async ({
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
    await open(page);
    await begin(page);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.turn = 9;
      g.s.p.mana = g.s.p.maxMana = 9;
      g.s.active = "p";
      g.s.p.board = [];
      g.s.e.board = [];
      g.s.p.fallen = 8;
      g.s.p.souls = ["wolf", "moonfox", "duskstag", "soulguide"];
      g.emit();
    });
    await page.locator("#contract-open").click();
    await expect(page.locator('[data-invoke="selmyra"]')).toBeEnabled();
    await page.locator('[data-invoke="selmyra"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/qa/contracts-${width}.png` });
    await page.locator('[data-invoke="selmyra"]').click();
    await expect(page.locator(".divine-arrival")).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `artifacts/qa/divine-arrival-${width}.png` });
    await page.waitForFunction(() => !EmberFX.busy);
    const s = await page.evaluate(() => Emberfall.game.s);
    expect(s.p.usedContracts).toEqual(["selmyra"]);
    expect(s.p.souls).toEqual([]);
    expect(s.p.mana).toBe(0);
    expect(s.p.board.map((m) => m.cid)).toEqual([
      "selmyra",
      "spiritwolf",
      "spiritwolf",
    ]);
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-art-key="selmyra"][data-portrait-mode="board"]',
        )?.complete,
    );
    await page.screenshot({ path: `artifacts/qa/moon-board-${width}.png` });
    await page.reload();
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#start-btn").click();
    expect(await page.evaluate(() => Emberfall.game.s.p.usedContracts)).toEqual(
      ["selmyra"],
    );
    await page.locator("#contract-open").click();
    await expect(page.locator('[data-invoke="selmyra"]')).toBeDisabled();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
test("named deck saves an independent contract loadout and selection launches it", async ({
  page,
}) => {
  await open(page);
  await page.locator("#collection-nav").click();
  await page.locator("#deck-class").selectOption("morla");
  await page.locator("#deck-reset").click();
  await page.locator("#deck-contracts summary").click();
  await page.locator('[data-deck-contract="eclipsewolf"]').uncheck();
  await page.locator('[data-deck-contract="moonguard"]').uncheck();
  await page.locator("#deck-name").fill("只携冥月神");
  await page.locator("#deck-play").click();
  await page.locator(".contract-setup summary").click();
  await expect(page.locator('[data-contract="selmyra"]')).toBeChecked();
  await expect(page.locator('[data-contract="eclipsewolf"]')).not.toBeChecked();
  await page.locator("#hero-confirm").click();
  expect(await page.evaluate(() => Emberfall.game.s.p.contracts)).toEqual([
    "selmyra",
  ]);
});
test("reduced motion omits divine overlay while committing the same summon", async ({
  page,
}) => {
  await open(page);
  await begin(page);
  await page.evaluate(() => {
    EmberFX.configure(true, false);
    const g = EmberDebug.game;
    g.s.p.mana = 10;
    g.s.p.fallen = 8;
    g.s.p.souls = ["wolf", "moonfox", "duskstag", "soulguide"];
    g.emit();
  });
  await page.locator("#contract-open").click();
  await page.locator('[data-invoke="selmyra"]').click();
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(page.locator(".divine-arrival")).toHaveCount(0);
  expect(await page.evaluate(() => Emberfall.game.s.p.usedContracts)).toEqual([
    "selmyra",
  ]);
});
