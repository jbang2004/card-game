const { openDeckTools, finishDeckTools } = require("./helpers/deck-tools.cjs");
const { test, expect } = require("@playwright/test");
const D = require("../../src/data.js");
async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function open(page) {
  await page.goto("./?debug=1");
  await ready(page);
}
const stored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("emberfall.deck.v1")));

test("obsolete deck can be reset; two current named decks persist and launch independently", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const legacy = D.heroes[0].deck;
  await page.evaluate(
    (cards) => localStorage.setItem("emberfall.deck.v1", JSON.stringify(cards)),
    legacy,
  );
  await page.locator("#collection-nav").click();
  await expect(page.locator("#deck-save")).toBeDisabled();
  await expect(page.locator("#deck-warning")).toContainText("无法读取");
  expect(await stored(page)).toEqual(legacy);
  expect(
    await page.locator("#deck-play").evaluate((el) => {
      const panel = el.closest(".deck-editor").getBoundingClientRect();
      return el.getBoundingClientRect().bottom <= panel.bottom + 1;
    }),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/qa/current-reset-desktop.png" });
  await page.locator("#deck-rebuild").click();
  await page.locator("#deck-name").fill("我的星火");
  await finishDeckTools(page);
  await page.locator("#deck-save").click();
  await openDeckTools(page);
  await page.locator("#deck-preset").selectOption("mage_frost");
  await openDeckTools(page);
  await page.locator("#deck-reset").click();
  await page.locator("#deck-name").fill("我的永冬");
  await finishDeckTools(page);
  await page.locator("#deck-copy").click();
  const saved = await stored(page);
  expect(saved.version).toBe(3);
  expect(saved.decks).toHaveLength(2);
  expect(saved.decks[0].cards).toEqual(legacy);
  expect(saved.decks[1].cards).toEqual(
    D.archetypes.find((a) => a.id === "mage_frost").deck,
  );
  await page.reload();
  await ready(page);
  await page.locator("#collection-nav").click();
  await expect(page.locator("#deck-name")).toHaveValue("我的永冬");
  await openDeckTools(page);
  await page.locator("#deck-saved").selectOption("deck_1");
  await expect(page.locator("#deck-name")).toHaveValue("我的星火");
  await page.locator("#deck-name").fill("星火改名");
  await finishDeckTools(page);
  await page.locator("#deck-play").click();
  await expect(page.locator("#hero-archetype")).toHaveValue("saved:deck_1");
  await page.locator("#hero-confirm").click();
  expect(await page.evaluate(() => Emberfall.game.s.customDeck)).toEqual(
    legacy,
  );
  expect((await stored(page)).decks[1]).toEqual(saved.decks[1]);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [390, 844],
  [844, 390],
])
  test(`named deck controls work on touch ${width}x${height}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await open(page);
    await page
      .getByRole("button", { name: "卡牌收藏", exact: true })
      .filter({ visible: true })
      .click();
    await page.locator("#touch-deck-tab").click();
    await page.locator("#deck-name").fill("触屏牌组");
    await finishDeckTools(page);
    await page.locator("#deck-save").click();
    expect((await stored(page)).decks[0].name).toBe("触屏牌组");
    await page.locator("#touch-deck-tab").click();
    await page.locator("#deck-copy").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/qa/model-touch-${width}.png` });
    await finishDeckTools(page);
    await page.locator("#deck-copy").click();
    expect((await stored(page)).decks).toHaveLength(2);
    await ctx.close();
  });

test("corrupt local deck collection is visible and cannot be overwritten", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    localStorage.setItem("emberfall.deck.v1", "{broken"),
  );
  await page.locator("#collection-nav").click();
  await expect(page.locator("#deck-warning")).toContainText("无法读取");
  await expect(page.locator("#deck-save")).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("emberfall.deck.v1")),
  ).toBe("{broken");
});

test("a second mage and sixth boss work through production screens with only content additions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/scripts/content/campaign.js", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body:
        body +
        `
      EmberCampaign.heroes.push({...structuredClone(EmberCampaign.heroes[0]),id:'arcanist',name:'第二位法师'});
      EmberCampaign.bosses.push({...structuredClone(EmberCampaign.bosses[0]),id:'sixth',name:'第六位首领'});
    `,
    });
  });
  await open(page);
  await page.locator("#start-btn").click();
  await expect(page.locator(".hero-option")).toHaveCount(D.heroes.length + 1);
  await expect(page.locator("#game-mode option").first()).toContainText(
    `${D.bosses.length + 1} 关`,
  );
  await page.locator('[data-hero="arcanist"]').click();
  await page.locator("#hero-deck-btn").click();
  await expect(page.locator("#deck-class")).toHaveValue("arcanist");
  await expect(page.locator("#deck-preset option")).toHaveCount(
    D.archetypes.filter((a) => a.classId === "mage").length,
  );
  await page.locator("#deck-name").fill("第二法师牌组");
  await page.screenshot({ path: "artifacts/qa/model-desktop.png" });
  await finishDeckTools(page);
  await page.locator("#deck-play").click();
  await page.locator("#hero-confirm").click();
  expect(await page.evaluate(() => Emberfall.game.s.heroId)).toBe("arcanist");
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    Emberfall.settings.reduced = true;
    EmberFX.configure(true, false);
    const g = EmberDebug.game;
    g.s.bossIndex = EmberData.bosses.length - 2;
    g.s.relics = EmberData.relics.map((r) => r.id);
    g.s.e.hp = 0;
    g.cleanup();
    g.emit();
  });
  await expect(page.locator("#result-next")).toContainText("选择遗物");
  await page.locator("#result-next").click();
  await expect(page.locator("#reward-confirm")).toBeEnabled();
  await page.locator("#reward-confirm").click();
  expect(await page.evaluate(() => Emberfall.game.s.bossIndex)).toBe(
    D.bosses.length,
  );
  await page.reload();
  await ready(page);
  await page.locator("#start-btn").click();
  expect(await page.evaluate(() => Emberfall.game.s.bossIndex)).toBe(
    D.bosses.length,
  );
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    Emberfall.settings.reduced = true;
    EmberFX.configure(true, false);
    const g = EmberDebug.game;
    g.s.e.hp = 0;
    g.cleanup();
    g.emit();
  });
  await expect(page.locator("#result-next")).toContainText("新的旅程");
  await page.locator("#result-home").click();
  await page.locator("#adventure-nav").click();
  await expect(page.locator(".map-stop.done")).toHaveCount(D.bosses.length + 1);
  expect(errors).toEqual([]);
});

test("obsolete campaign is not resumed and a new match uses the current schema", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    localStorage.setItem(
      "emberfall.v1",
      JSON.stringify({ version: 1, heroId: "mage", bossIndex: 0 }),
    ),
  );
  await page.reload();
  await ready(page);
  await expect(page.locator(".local-status")).toContainText("已失效");
  await page.locator("#start-btn").click();
  await expect(page.locator("#hero-confirm")).toBeVisible();
  await page.locator("#hero-confirm").click();
  const s = await page.evaluate(() => Emberfall.game.s);
  expect(s.version).toBe(3);
  expect(s).not.toHaveProperty("ruleset");
  expect(s).not.toHaveProperty("legacyDeck");
});
