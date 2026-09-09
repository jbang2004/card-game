const { openDeckTools, finishDeckTools } = require("./helpers/deck-tools.cjs");
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
    const poster = await page.locator(".covenant-card").first().evaluate((card) => {
      const art = card.querySelector(":scope > img"),
        copy = card.querySelector(":scope > .covenant-copy"),
        cardRect = card.getBoundingClientRect(),
        artRect = art.getBoundingClientRect(),
        copyRect = copy.getBoundingClientRect();
      return {
        card: [cardRect.width, cardRect.height],
        art: [artRect.width, artRect.height],
        copyPosition: getComputedStyle(copy).position,
        copyBottom: cardRect.bottom - copyRect.bottom,
        copyTop: copyRect.top - cardRect.top,
      };
    });
    expect(poster.copyPosition).toBe("absolute");
    expect(poster.art[0]).toBeGreaterThanOrEqual(poster.card[0] - 3);
    expect(poster.art[1]).toBeGreaterThanOrEqual(poster.card[1] - 3);
    expect(poster.copyBottom).toBeLessThanOrEqual(2);
    expect(poster.copyTop).toBeGreaterThan(0);
    if (touch) {
      const scroll = await page.locator("#modal .folio-viewport").first().evaluate((viewport) => ({
        overflowY: getComputedStyle(viewport).overflowY,
        scrollable: viewport.scrollHeight > viewport.clientHeight + 2,
      }));
      expect(scroll).toEqual({ overflowY: "auto", scrollable: true });
    }
    expect(
      await page.locator('[data-invoke="selmyra"]').evaluate((button) => {
        const r = button.getBoundingClientRect();
        return (
          !button.closest(".folio-viewport") &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          r.top >= 0 &&
          r.bottom <= innerHeight
        );
      }),
    ).toBe(true);
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
for (const [width, height] of [
  [320, 568],
  [568, 320],
]) {
  test(`all covenant actions remain visible outside pagination ${width}x${height}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await open(page);
    await begin(page);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = g.s.p.maxMana = 9;
      g.s.p.fallen = 8;
      g.s.p.souls = ["wolf", "moonfox", "duskstag", "soulguide"];
      g.emit();
    });
    await page.locator("#contract-open").click();
    const result = await page.locator(".covenant-actions").evaluate((footer) => {
      const dialog = footer.closest(".folio-dialog").getBoundingClientRect(),
        buttons = [...footer.querySelectorAll("[data-invoke]")];
      return {
        count: buttons.length,
        allEnabled: buttons.every((button) => !button.disabled),
        allOutsidePages: buttons.every(
          (button) => !button.closest(".folio-viewport"),
        ),
        allVisible: buttons.every((button) => {
          const r = button.getBoundingClientRect();
          return (
            r.width >= 44 &&
            r.height >= 44 &&
            r.left >= dialog.left &&
            r.right <= dialog.right &&
            r.top >= dialog.top &&
            r.bottom <= dialog.bottom
          );
        }),
      };
    });
    expect(result).toEqual({
      count: 3,
      allEnabled: true,
      allOutsidePages: true,
      allVisible: true,
    });
    await ctx.close();
  });
}
test("named deck saves an independent contract loadout and selection launches it", async ({
  page,
}) => {
  await open(page);
  await page.locator("#collection-nav").click();
  await openDeckTools(page);
  await page.locator("#deck-class").selectOption("morla");
  await openDeckTools(page);
  await page.locator("#deck-reset").click();
  await openDeckTools(page);
  await page.locator("#deck-contracts summary").click();
  await page.locator('[data-deck-contract="eclipsewolf"]').uncheck();
  await page.locator('[data-deck-contract="moonguard"]').uncheck();
  await page.locator("#deck-name").fill("只携冥月神");
  await finishDeckTools(page);
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
