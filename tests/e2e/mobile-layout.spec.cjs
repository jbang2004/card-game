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
    await page.locator("#deck-class").selectOption("morla");
    await page.locator("#deck-reset").click();
    await page.locator("#deck-contracts summary").click();
    expect(
      await page.locator("#deck-contracts label").evaluateAll((es) =>
        es.every((e) => {
          const r = e.getBoundingClientRect(),
            s = e.querySelector("span").getBoundingClientRect(),
            t = e.querySelector("strong").getBoundingClientRect();
          return (
            s.right <= r.right + 1 && s.left >= r.left && s.top >= t.bottom - 1
          );
        }),
      ),
    ).toBe(true);
    const buttons = await page
      .locator(".deck-actions button")
      .evaluateAll((es) =>
        es.map((e) => {
          const r = e.getBoundingClientRect();
          return { top: r.top, left: r.left, right: r.right, height: r.height };
        }),
      );
    expect(
      Math.max(...buttons.map((b) => b.top)) -
        Math.min(...buttons.map((b) => b.top)),
    ).toBeLessThan(2);
    buttons.forEach((b) => {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
      expect(b.height).toBeGreaterThanOrEqual(44);
    });
    await page.locator("#deck-contracts").scrollIntoViewIfNeeded();
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
