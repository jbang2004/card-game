const { test, expect } = require("@playwright/test");
async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function rewardPage(page) {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#start-btn").click();
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    Emberfall.settings.reduced = true;
    EmberFX.configure(true, false);
    const g = EmberDebug.game;
    g.s.rewardOffers = ["heart", "lens", "banner"];
    g.s.e.hp = 0;
    g.cleanup();
    g.emit();
  });
  await page.locator("#result-next").click();
  await page
    .locator(".relic-choice img")
    .evaluateAll((xs) => Promise.all(xs.map((x) => x.decode())));
}
async function assertInk(page, selector, bgSelector) {
  const values = await page.locator(selector).evaluateAll((xs, bg) => {
    const rgb = (s) =>
      s
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const lum = (c) =>
      c
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    return xs.map((x) => {
      const a = lum(rgb(getComputedStyle(x).color)),
        b = lum(rgb(getComputedStyle(x.closest(bg)).backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  }, bgSelector);
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) expect(value).toBeGreaterThanOrEqual(4.5);
}
for (const [width, height, touch] of [
  [1600, 940, false],
  [1280, 800, false],
  [1024, 768, true],
  [768, 1024, true],
  [390, 844, true],
  [844, 390, true],
  [320, 568, true],
]) {
  test(`reward legibility, image containment and deliberate selection ${width}x${height}`, async ({
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
    await rewardPage(page);
    await assertInk(page, ".relic-choice p", ".relic-choice");
    const bounds = await page.locator(".relic-choice").evaluateAll((xs) =>
      xs.map((x) => {
        const r = x.getBoundingClientRect(),
          i = x.querySelector("img").getBoundingClientRect(),
          p = x.querySelector("p").getBoundingClientRect();
        return {
          font: parseFloat(getComputedStyle(x.querySelector("p")).fontSize),
          within:
            i.x >= r.x &&
            i.right <= r.right &&
            i.y >= r.y &&
            i.bottom <= r.bottom,
          text: p.right <= r.right,
          overlap:
            Math.min(i.right, p.right) > Math.max(i.x, p.x) &&
            Math.min(i.bottom, p.bottom) > Math.max(i.y, p.y),
        };
      }),
    );
    for (const b of bounds) {
      expect(b.font).toBeGreaterThanOrEqual(16);
      expect(b.within && b.text && !b.overlap).toBe(true);
    }
    await expect(page.locator("#reward-confirm")).toBeDisabled();
    await page.locator('[data-relic="heart"]').click();
    await expect(page.locator('[data-relic="heart"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => Emberfall.game.s.bossIndex)).toBe(0);
    await page.locator('[data-relic="lens"]').click();
    await expect(page.locator('[data-relic="heart"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.locator("#reward-confirm").scrollIntoViewIfNeeded();
    expect(
      await page.locator("#reward-confirm").evaluate((x) => {
        const r = x.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        return x === hit || x.contains(hit);
      }),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/uiux/verified-rewards-${width}.png`,
    });
    await page.locator("#reward-confirm").click();
    await expect(page.locator("#mulligan-confirm")).toBeVisible();
    expect(await page.evaluate(() => Emberfall.game.s.relics)).toEqual([
      "lens",
    ]);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
test("map, rulebook and collection actions have readable surfaces and usable layout", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#adventure-nav").click();
  await assertInk(page, ".map-stop p", ".map-stop");
  await page.locator(".modal-close").click();
  await page.locator("#guide-nav").click();
  await assertInk(page, ".help-section p b", ".help-section");
  await assertInk(page, ".key-table b", ".help-section");
  await page.locator("#help-done").click();
  await page.locator("#collection-nav").click();
  await expect(page.locator("#deck-save")).toBeInViewport();
  expect(
    await page.locator("#deck-save").evaluate((x) => {
      const r = x.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return x === hit || x.contains(hit);
    }),
  ).toBe(true);
});
test("enlarged reward rules remain contained and keyboard selection does not auto-advance", async ({
  page,
}) => {
  await rewardPage(page);
  await page.addStyleTag({
    content: ".relic-choice p {font-size:32px !important;}",
  });
  await page.locator('[data-relic="banner"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-relic="banner"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await page.evaluate(() => Emberfall.game.s.bossIndex)).toBe(0);
  const fit = await page
    .locator(".relic-choice p")
    .evaluateAll((xs) =>
      xs.every(
        (p) =>
          p.getBoundingClientRect().bottom <=
          p.closest("button").getBoundingClientRect().bottom,
      ),
    );
  expect(fit).toBe(true);
  await page.locator("#reward-confirm").scrollIntoViewIfNeeded();
  await page.locator("#reward-confirm").click();
  await expect(page.locator("#mulligan-confirm")).toBeVisible();
});

test("long collection rules stay above stats on desktop and phone", async ({
  browser,
}) => {
  for (const [width, height] of [
    [1600, 940],
    [390, 844],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const page = await ctx.newPage();
    await page.goto("./?debug=1");
    await ready(page);
    await page
      .locator(width < 500 ? "#touch-collection" : "#collection-nav")
      .click();
    await page.locator("#library-search").fill("引火学徒");
    const card = page.locator(".library-item .card");
    await expect(card).toHaveCount(1);
    expect(
      await card.evaluate((c) => {
        const p = c.querySelector(".card-text"),
          s = c.querySelector(".stat");
        return (
          p.scrollHeight <= p.clientHeight + 1 &&
          p.getBoundingClientRect().bottom <= s.getBoundingClientRect().top
        );
      }),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/uiux/verified-long-card-${width}.png`,
    });
    await ctx.close();
  }
});
