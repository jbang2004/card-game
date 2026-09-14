const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [568, 320],
  [844, 390],
]) {
  test(`compact collection keeps a complete card and remembers disclosed filters ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#collection-nav").evaluate((e) => e.click());
    // Silverblue parked the search field behind the filter disclosure on a
    // phone. The slate title row carries it as a search pill at every size
    // (design system §5 T3 「标题行（返回 + 标题 + 搜索药丸）」), so it is
    // reachable without opening anything.
    await expect(page.locator("#library-search")).toBeVisible();
    const geometry = await page
      .locator(".library-entry")
      .first()
      .evaluate((e) => ({
        card: e.getBoundingClientRect().toJSON(),
        action: e
          .querySelector(".library-inspect")
          .getBoundingClientRect()
          .toJSON(),
        scrollbar: getComputedStyle(e.closest(".library-box")).scrollbarWidth,
      }));
    expect(geometry.card.top).toBeGreaterThanOrEqual(0);
    expect(geometry.card.bottom).toBeLessThanOrEqual(height + 1);
    expect(geometry.action.height).toBeGreaterThanOrEqual(44);
    expect(geometry.scrollbar).toBe("none");
    await expect(
      page.locator("#modal .folio-scroll-hint").first(),
    ).toBeHidden();
    await page.locator("#library-filters > summary").click();
    await page.locator("#library-search").fill("星");
    await expect(page.locator(".library-item")).toHaveCount(5);
    await page.locator("#touch-deck-tab").click();
    await page.locator("#touch-card-tab").click();
    await expect(page.locator("#library-search")).toHaveValue("星");
    await page.locator("#library-filters > summary").click();
    await expect(page.locator("#library-filter-summary")).toContainText("5 张");
    await expect(page.locator(".library-item")).toHaveCount(5);
    // A desktop resize must expose filters even if their mobile disclosure was closed.
    await page.setViewportSize({ width: 1600, height: 940 });
    await expect(page.locator("#library-search")).toBeVisible();
    await expect(page.locator("#filter-bar button").first()).toBeVisible();
    await page.locator("#library-search").fill("寒霜");
    await expect(page.locator(".library-item")).toHaveCount(1);
    await context.close();
  });
}

test("short landscape keeps both unit stats separate and heroes apart", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 568, height: 320 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => {
    Emberfall.settings.reduced = true;
    EmberFX.configure(true, false);
    Emberfall.demo();
  });
  await page.waitForFunction(() => !EmberFX.busy);
  const fits = await page.evaluate(() => ({
    units: [...document.querySelectorAll(".minion")].map((e) => ({
      w: e.getBoundingClientRect().width,
      separate:
        e.querySelector(".stat.atk").getBoundingClientRect().right <=
        e.querySelector(".stat.hp").getBoundingClientRect().left + 1,
    })),
    /* Short landscape seats the two hero cards SIDE BY SIDE on purpose
     * (`EmberViewport` layout, mobile-view.js `shortLandscape`): 320px of
     * height cannot stack two 128px hero cards above the board and the hand.
     * "Apart" is therefore a non-overlap check on both axes, not a claim that
     * the enemy sits above the player. */
    heroes: (() => {
      const a = document.querySelector(".hero.enemy").getBoundingClientRect(),
        b = document.querySelector(".hero.player").getBoundingClientRect();
      return (
        Math.min(a.right, b.right) <= Math.max(a.left, b.left) ||
        Math.min(a.bottom, b.bottom) <= Math.max(a.top, b.top)
      );
    })(),
  }));
  expect(fits.heroes).toBe(true);
  for (const u of fits.units) {
    expect(u.w).toBeGreaterThanOrEqual(40);
    expect(u.separate).toBe(true);
  }
  await context.close();
});
