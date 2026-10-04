const { turnTo, assertDialogFit } = require("./helpers/dialog-pages.cjs");
const { test, expect } = require("@playwright/test");
const { seedRun, storedRun } = require("./helpers/expedition.cjs");
async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}

// the expedition's first treasure, offered as three relics: the first battle is won, the stored run's offer is
// set, and the run is shown again as a resumed run is
async function rewardPage(page) {
  await page.goto("./?debug=1");
  await ready(page);
  // a run standing before a treasure of three relics, a bundle of cards to follow
  await seedRun(page, "mage", { step: "treasure", queue: ["bundle"], offer: { treasures: ["heart", "lens", "banner"].map((id) => ({ kind: "relic", id })) } });
  await page.locator("#start-btn").click();
  await page
    .locator(".run-option img")
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
    // Liquid-glass tiles are translucent fills (e.g. 6% white) laid over the
    // dark sheet, so the tile's own background colour is composited over the
    // near-black the sheet dims to instead of being read as opaque.
    const backdrop = (el) => {
      const v = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).map(Number);
      const a = v.length > 3 ? v[3] : 1;
      return [5, 7, 10].map((c, i) => v[i] * a + c * (1 - a));
    };
    return xs.map((x) => {
      const a = lum(rgb(getComputedStyle(x).color)),
        b = lum(backdrop(x.closest(bg)));
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
    await assertInk(page, ".run-option p", ".run-option");
    const bounds = await page.locator(".run-option").evaluateAll((xs) =>
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
    await expect(page.locator("#run-confirm")).toBeDisabled();
    await page.locator('[data-pick="0"]').click();
    await expect(page.locator('[data-pick="0"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect((await storedRun(page)).step).toBe("treasure");
    await page.locator('[data-pick="1"]').click();
    await expect(page.locator('[data-pick="0"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await page.locator("#run-confirm").scrollIntoViewIfNeeded();
    expect(
      await page.locator("#run-confirm").evaluate((x) => {
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
    await page.locator("#run-confirm").click();
    await expect(page.locator('#modal .run-box[data-run-step="bundle"]')).toBeVisible();
    expect((await storedRun(page)).relics).toEqual(["lens"]);
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
  await assertInk(page, ".run-page p", ".run-page");
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
    content: ".run-option p {font-size:32px !important;}",
  });
  await page.locator('[data-pick="2"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-pick="2"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect((await storedRun(page)).step).toBe("treasure");
  const fit = await page
    .locator(".run-option p")
    .evaluateAll((xs) =>
      xs.every(
        (p) =>
          p.getBoundingClientRect().bottom <=
          p.closest("button").getBoundingClientRect().bottom,
      ),
    );
  expect(fit).toBe(true);
  await page.locator("#run-confirm").scrollIntoViewIfNeeded();
  await page.locator("#run-confirm").click();
  await expect(page.locator('#modal .run-box[data-run-step="bundle"]')).toBeVisible();
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
      .locator("#touch-collection:visible, #collection-nav:visible")
      .click();
    if (!(await page.locator("#library-search").isVisible()))
      await page.locator("#library-filters > summary").click();
    await page.locator("#library-search").fill("引火学徒");
    const card = page.locator(".library-item .card");
    await expect(card).toHaveCount(1);
    expect(
      await card.evaluate((c) => {
        const p = c.querySelector(".card-text"),
          s = c.querySelector(".stat");
        return (
          p.scrollHeight <= p.clientHeight + 1 &&
          (() => {
            if (!p.checkVisibility()) return true;
            const range = document.createRange();
            range.selectNodeContents(p);
            return (
              range.getBoundingClientRect().bottom <=
              s.getBoundingClientRect().top
            );
          })()
        );
      }),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/uiux/verified-long-card-${width}.png`,
    });
    // The card is taken out of the grid and held up; its label must fit the screen.
    await page.locator("[data-library-inspect]").click();
    await expect(page.locator("#card-stage .card-stage-name")).toHaveText("引火学徒");
    await expect(page.locator("#card-stage .card-stage-count")).not.toBeEmpty();
    await page.waitForTimeout(700); // flight
    const shell = await page.locator("#card-stage .god-shell").boundingBox();
    expect(shell.x).toBeGreaterThanOrEqual(0);
    expect(shell.y).toBeGreaterThanOrEqual(0);
    expect(shell.x + shell.width).toBeLessThanOrEqual(width + 0.5);
    expect(shell.y + shell.height).toBeLessThanOrEqual(page.viewportSize().height + 0.5);
    await page.locator("#library-detail-back").click();
    await expect(page.locator("#card-stage")).toHaveCount(0);
    await expect(page.locator("#library-search")).toHaveValue("引火学徒");
    await ctx.close();
  }
});
