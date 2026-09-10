const { turnTo, assertDialogFit } = require("./helpers/dialog-pages.cjs");
const { openDeckTools, finishDeckTools } = require("./helpers/deck-tools.cjs");
const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [667, 375],
  [844, 390],
  [768, 1024],
]) {
  test(`hero copy and deck controls fit touch ${width}x${height}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#start-btn").click();
    const heroColumns = await page.locator(".hero-options").evaluate((grid) => {
      const firstTop = grid.querySelector(".hero-option").getBoundingClientRect().top;
      return [...grid.querySelectorAll(".hero-option")].filter(
        (card) => Math.abs(card.getBoundingClientRect().top - firstTop) <= 1,
      ).length;
    });
    expect(heroColumns).toBe(2);
    await page.locator('[data-hero="morla"]').click();
    // A long skill and larger copy must grow its card, never clip below its frame.
    await page
      .locator(".hero-option em")
      .evaluateAll((es) => es.forEach((e) => (e.style.fontSize = "17px")));
    for (const card of await page.locator(".hero-option").all())
      expect(
        await card.evaluate((e) => {
          const r = e.getBoundingClientRect(),
            t = e.querySelector("em").getBoundingClientRect();
          return (
            t.bottom <= r.bottom - 5 &&
            t.right <= r.right - 5 &&
            t.left >= r.left
          );
        }),
      ).toBe(true);
    await page.locator('[data-hero="morla"]').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/qa/mobile-fixed-hero-${width}.png`,
    });
    await page.locator("#hero-confirm").scrollIntoViewIfNeeded();
    await expect(page.locator("#hero-confirm")).toBeInViewport();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#touch-collection").click();
    await page.locator("#touch-deck-tab").click();
    await expect(page.locator("#library-search")).toBeHidden();
    await openDeckTools(page);
    await page.locator("#deck-class").selectOption("morla");
    await openDeckTools(page);
    await page.locator("#deck-reset").click();
    await openDeckTools(page);
    await page.locator("#deck-contracts summary").click();
    for (const id of await page
      .locator("[data-deck-contract]")
      .evaluateAll((es) => es.map((e) => e.dataset.deckContract))) {
      await turnTo(page, `[data-deck-contract="${id}"]`);
      await expect(
        page.locator(`[data-deck-contract="${id}"]`),
      ).toBeInViewport();
    }
    await assertDialogFit(page);
    await finishDeckTools(page);
    const buttons = await page
      .locator(".deck-actions button")
      .evaluateAll((es) =>
        es.map((e) => {
          const r = e.getBoundingClientRect();
          return { top: r.top, left: r.left, right: r.right, height: r.height };
        }),
      );
    // Actions may wrap, but must remain separate and reachable.
    for (let i = 0; i < buttons.length; i++)
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i],
          b = buttons[j];
        expect(
          a.right <= b.left ||
            b.right <= a.left ||
            a.top + a.height <= b.top ||
            b.top + b.height <= a.top,
        ).toBe(true);
      }
    buttons.forEach((b) => {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
      expect(b.height).toBeGreaterThanOrEqual(44);
    });
    await assertDialogFit(page);
    await page.screenshot({
      path: `artifacts/qa/mobile-fixed-deck-${width}.png`,
    });
    await expect(page.locator("#deck-save")).toBeEnabled();
    await page.locator("#touch-card-tab").click();
    await expect(page.locator("#library-search")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await ctx.close();
  });
}
