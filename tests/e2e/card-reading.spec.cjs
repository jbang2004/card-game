const { test, expect } = require("@playwright/test");

async function ready(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}

async function startTouchBattle(page) {
  await ready(page);
  await page.locator("#quick-btn").tap();
  await page.waitForFunction(() => !EmberFX.busy);
}

function detailMetrics(page) {
  return page.evaluate(() => {
    const preview = document.querySelector("#card-preview"),
      card = preview?.querySelector(".card"),
      text = card?.querySelector(".card-text");
    if (!preview || !card || !text) return null;
    const within = (r) =>
      r.x >= -1 &&
      r.y >= -1 &&
      r.right <= innerWidth + 1 &&
      r.bottom <= innerHeight + 1;
    const previewRect = preview.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const artRect = card.querySelector(".card-art").getBoundingClientRect();
    const art = card.querySelector(".card-art img");
    return {
      text: text.textContent,
      textScrollHeight: text.scrollHeight,
      textClientHeight: text.clientHeight,
      lineClamp: getComputedStyle(text).webkitLineClamp,
      overflow: getComputedStyle(text).overflowY,
      artHeight: artRect.height,
      objectFit: getComputedStyle(art).objectFit,
      previewWithin: within(previewRect),
      cardWithin: within(cardRect),
    };
  });
}

for (const [name, viewport, touch] of [
  ["portrait", { width: 390, height: 844 }, true],
  ["landscape", { width: 844, height: 390 }, true],
  ["desktop", { width: 1600, height: 940 }, false],
]) {
  test(`card detail keeps complete rules in ${name}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage();
    await ready(page);
    await page.evaluate(() =>
      Emberfall.showCardDetail("fenlos", { pinned: true }),
    );
    await expect(page.locator("#card-preview")).toHaveClass(/open/);
    const metrics = await detailMetrics(page);
    expect(metrics.text).toContain("突袭灵狼");
    expect(metrics.textScrollHeight).toBeLessThanOrEqual(
      metrics.textClientHeight + 1,
    );
    expect(metrics.lineClamp).toMatch(/none|unset/);
    expect(metrics.overflow).toBe("hidden");
    expect(metrics.objectFit).toBe("cover");
    expect(metrics.previewWithin && metrics.cardWithin).toBe(true);
    await context.close();
  });
}

test("hand rail keeps compact rules complete without a nested scroller", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await startTouchBattle(page);
  const state = await page.evaluate(() => {
    const game = EmberDebug.game;
    game.s.active = "p";
    game.s.phase = "battle";
    game.s.p.mana = game.s.p.maxMana = 10;
    game.s.p.hand = ["dragon", "spark", "solaris"].map((id) => game.card(id));
    game.emit();
    return [...document.querySelectorAll("#hand .hand-card")].map((hand) => {
      const card = hand.querySelector(".card"),
        text = card.querySelector(".card-text"),
        handRect = hand.getBoundingClientRect();
      text.scrollTop = text.scrollHeight;
      return {
        id: hand.dataset.cardid,
        lineClamp: getComputedStyle(text).webkitLineClamp,
        overflow: getComputedStyle(text).overflowY,
        scrollHeight: text.scrollHeight,
        clientHeight: text.clientHeight,
        artHeight: card.querySelector(".card-art").getBoundingClientRect().height,
        objectFit: getComputedStyle(card.querySelector(".card-art img")).objectFit,
        ruleSize: card.dataset.ruleSize,
        verticalFit:
          handRect.y >= 0 && handRect.bottom <= innerHeight + 1,
      };
    });
  });
  expect(state.map((x) => x.lineClamp)).toEqual(["none", "none", "none"]);
  expect(state.map((x) => x.overflow)).toEqual(["hidden", "hidden", "hidden"]);
  expect(state.every((x) => x.scrollHeight <= x.clientHeight + 1)).toBe(true);
  expect(state.every((x) => x.objectFit === "cover")).toBe(true);
  expect(state.map((x) => x.ruleSize)).toEqual(["short", "standard", "long"]);
  expect(Math.max(...state.map((x) => x.artHeight)) - Math.min(...state.map((x) => x.artHeight))).toBeLessThanOrEqual(1);
  expect(state.every((x) => x.verticalFit)).toBe(true);
  await context.close();
});

test("desktop hand rail uses the same static card face contract", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  const state = await page.evaluate(() => {
    const game = EmberDebug.game;
    game.s.active = "p";
    game.s.phase = "battle";
    game.s.p.mana = game.s.p.maxMana = 10;
    game.s.p.hand = ["dragon", "spark", "solaris"].map((id) => game.card(id));
    game.emit();
    return [...document.querySelectorAll("#hand .hand-card")].map((hand) => {
      const text = hand.querySelector(".card-text"),
        rect = hand.getBoundingClientRect();
      return {
        id: hand.dataset.cardid,
        lineClamp: getComputedStyle(text).webkitLineClamp,
        overflow: getComputedStyle(text).overflowY,
        scrollHeight: text.scrollHeight,
        clientHeight: text.clientHeight,
        artHeight: hand.querySelector(".card-art").getBoundingClientRect().height,
        objectFit: getComputedStyle(hand.querySelector(".card-art img")).objectFit,
        ruleSize: hand.querySelector(".card").dataset.ruleSize,
        verticalFit: rect.y >= 0 && rect.bottom <= innerHeight + 1,
      };
    });
  });
  expect(state.map((x) => x.lineClamp)).toEqual(["none", "none", "none"]);
  expect(state.map((x) => x.overflow)).toEqual(["hidden", "hidden", "hidden"]);
  expect(state.every((x) => x.scrollHeight <= x.clientHeight + 1)).toBe(true);
  expect(state.every((x) => x.objectFit === "cover")).toBe(true);
  expect(state.map((x) => x.ruleSize)).toEqual(["short", "standard", "long"]);
  expect(Math.max(...state.map((x) => x.artHeight)) - Math.min(...state.map((x) => x.artHeight))).toBeLessThanOrEqual(1);
  expect(state.every((x) => x.verticalFit)).toBe(true);
});
