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

async function startMulligan(page) {
  await ready(page);
  await page.locator("#start-btn").click();
  await page.waitForSelector("#hero-confirm");
  await page.locator("#hero-confirm").click();
  await page.waitForSelector("#mulligan-confirm");
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
        fontSize: Number.parseFloat(getComputedStyle(text).fontSize),
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
  expect(state[0].fontSize).toBeGreaterThan(state[1].fontSize);
  expect(state[1].fontSize).toBeGreaterThanOrEqual(state[2].fontSize);
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
        fontSize: Number.parseFloat(getComputedStyle(text).fontSize),
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
  expect(state[0].fontSize).toBeGreaterThan(state[1].fontSize);
  expect(state[1].fontSize).toBeGreaterThanOrEqual(state[2].fontSize);
  expect(Math.max(...state.map((x) => x.artHeight)) - Math.min(...state.map((x) => x.artHeight))).toBeLessThanOrEqual(1);
  expect(state.every((x) => x.verticalFit)).toBe(true);
});

for (const [name, viewport, touch] of [
  ["opening portrait", { width: 390, height: 844 }, true],
  ["opening desktop", { width: 1600, height: 940 }, false],
]) {
  test(`opening hand and battle hand keep one card aperture in ${name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage();
    await startMulligan(page);
    const opening = await page.locator(".mulligan-card .card").first().evaluate((card) => {
      const measure = (node) => {
        const r = node.getBoundingClientRect();
        return { width: r.width, height: r.height };
      };
      return {
        card: measure(card),
        art: measure(card.querySelector(".card-art")),
        artPosition: getComputedStyle(card.querySelector(".card-art")).position,
        imagePosition: getComputedStyle(card.querySelector(".card-art img")).position,
        imageOffsetParentIsArt:
          card.querySelector(".card-art img").offsetParent ===
          card.querySelector(".card-art"),
        imageFillsArt: (() => {
          const art = card.querySelector(".card-art"),
            img = card.querySelector(".card-art img");
          return (
            Math.abs(img.offsetWidth - art.clientWidth) <= 1 &&
            Math.abs(img.offsetHeight - art.clientHeight) <= 1
          );
        })(),
      };
    });
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    const hand = await page.locator("#hand .hand-card .card").first().evaluate((card) => {
      const measure = (node) => {
        const r = node.getBoundingClientRect();
        return { width: r.width, height: r.height };
      };
      return {
        card: measure(card),
        art: measure(card.querySelector(".card-art")),
        artPosition: getComputedStyle(card.querySelector(".card-art")).position,
        imagePosition: getComputedStyle(card.querySelector(".card-art img")).position,
        imageOffsetParentIsArt:
          card.querySelector(".card-art img").offsetParent ===
          card.querySelector(".card-art"),
        imageFillsArt: (() => {
          const art = card.querySelector(".card-art"),
            img = card.querySelector(".card-art img");
          return (
            Math.abs(img.offsetWidth - art.clientWidth) <= 1 &&
            Math.abs(img.offsetHeight - art.clientHeight) <= 1
          );
        })(),
      };
    });
    const ratio = 5 / 7.4;
    const cardRatio = (x) => x.width / x.height;
    const artRatio = (x) => x.width / x.height;
    expect(cardRatio(opening.card)).toBeCloseTo(ratio, 2);
    expect(cardRatio(hand.card)).toBeCloseTo(ratio, 2);
    expect(artRatio(opening.art)).toBeCloseTo(artRatio(hand.art), 1);
    for (const view of [opening, hand]) {
      expect(view.artPosition).toBe("absolute");
      expect(view.imagePosition).toBe("absolute");
      expect(view.imageOffsetParentIsArt).toBe(true);
      expect(view.imageFillsArt).toBe(true);
    }
    await context.close();
  });
}
