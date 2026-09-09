const { test, expect } = require("@playwright/test");
const { turnTo, assertDialogFit } = require("./helpers/dialog-pages.cjs");
for (const [width, height] of [
  [1600, 940],
  [1280, 800],
  [1024, 768],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
  [768, 1024],
]) {
  test(`viewport-owned pages retain air and actions ${width}x${height}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      isMobile: width < 1000,
    });
    const page = await ctx.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#start-btn").click();
    await assertDialogFit(page);
    await turnTo(page, '[data-hero="morla"]');
    await page.locator('[data-hero="morla"]').click();
    if (width < 1000) {
      const heroSheet = await page.locator("#modal .folio-pane").first().evaluate(
        (pane) => {
          const viewport = pane.querySelector(".folio-viewport"),
            flow = pane.querySelector(".folio-flow"),
            pager = pane.querySelector(".folio-pager");
          return {
            heroCount: flow.querySelectorAll(".hero-option").length,
            overflowY: getComputedStyle(viewport).overflowY,
            horizontalOverflow: flow.scrollWidth - viewport.clientWidth,
            pagerHidden: getComputedStyle(pager).display === "none",
          };
        },
      );
      expect(heroSheet.heroCount).toBe(4);
      expect(heroSheet.overflowY).toBe("auto");
      expect(heroSheet.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(heroSheet.pagerHidden).toBe(true);
      await page.locator("#game-mode").scrollIntoViewIfNeeded();
      await expect(page.locator("#game-mode")).toBeInViewport();
    }
    if (width === 1600) {
      await turnTo(page, ".hero-option");
      const cards = await page
        .locator(".hero-option")
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().left));
      expect(Math.max(...cards) - Math.min(...cards)).toBeLessThanOrEqual(1);
      const choices = await page.locator(".hero-option").first().boundingBox();
      const config = await page.locator(".hero-configuration").boundingBox();
      expect(config.x).toBeGreaterThan(choices.x + choices.width);
    }

    await turnTo(page, "#game-mode");
    await page.locator("#game-mode").selectOption("practice");
    await turnTo(page, "#practice-opponent");
    await page.locator("#practice-opponent").selectOption("mage_frost");
    await assertDialogFit(page);
    await page.locator(".modal-close").click();
    for (const sel of ["#settings-btn", "#adventure-nav", "#guide-nav"]) {
      await page.locator(sel).evaluate((e) => e.click());
      await assertDialogFit(page);
      const panes = page.locator(".folio-pane");
      for (const p of await panes.all()) {
        if (!(await p.isVisible())) continue;
        const next = p.locator(".folio-pager > button").last();
        let n = 0;
        while ((await next.isEnabled()) && n++ < 50) {
          await next.click();
          await assertDialogFit(page);
        }
      }
      await page.locator(".modal-close").click();
    }
    await page
      .locator(width < 1000 ? "#touch-collection" : "#collection-nav")
      .click();
    await assertDialogFit(page);
    await page.locator("[data-library-inspect]").first().click();
    await assertDialogFit(page);
    await page.locator("#library-detail-back").click();
    if (await page.locator("#touch-deck-tab").isVisible())
      await page.locator("#touch-deck-tab").click();
    await page.locator("#deck-name").fill("分页验证牌组");
    await page.locator("#deck-tools > summary").click();
    await turnTo(page, "#deck-class");
    await page.locator("#deck-class").selectOption("morla");
    await assertDialogFit(page);
    await turnTo(page, "#deck-preset");
    await page.locator("#deck-preset").selectOption("moon_covenant");
    await page.locator("#deck-tools > summary").click();
    await assertDialogFit(page);
    await page.screenshot({
      path: `artifacts/ui-alignment/flow-${width}-deck.png`,
    });
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("arbitrary resize retains hero choices and unsaved deck edits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1107, height: 713 });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#start-btn").click();
  await turnTo(page, '[data-hero="morla"]');
  await page.locator('[data-hero="morla"]').click();
  await turnTo(page, "#game-mode");
  await page.locator("#game-mode").selectOption("practice");
  for (const [width, height] of [
    [431, 777],
    [777, 431],
    [1357, 839],
  ]) {
    await page.setViewportSize({ width, height });
    await assertDialogFit(page);
    await turnTo(page, "#game-mode");
    await expect(page.locator("#game-mode")).toHaveValue("practice");
    await expect(page.locator('[data-hero="morla"]')).toHaveClass(/selected/);
  }
  await page.locator(".modal-close").click();
  await page.locator("#collection-nav").click();
  await page.locator("#deck-name").fill("跨尺寸未保存草稿");
  for (const [width, height] of [
    [453, 731],
    [731, 453],
    [1223, 807],
  ]) {
    await page.setViewportSize({ width, height });
    await assertDialogFit(page);
    if (await page.locator("#touch-deck-tab").isVisible())
      await page.locator("#touch-deck-tab").click();
    await expect(page.locator("#deck-name")).toHaveValue("跨尺寸未保存草稿");
  }
});
