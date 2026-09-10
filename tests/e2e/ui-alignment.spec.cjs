const { assertDialogFit } = require("./helpers/dialog-pages.cjs");
const { test, expect } = require("@playwright/test");
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
  test(`ornaments and HUD stay anchored ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      isMobile: width < 1000,
    });
    const page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page
      .locator(width < 1000 ? "#touch-collection" : "#collection-nav")
      .click();
    const collectionHeader = await page.locator(".library-heading").evaluate((heading) => {
      const close = heading.parentElement.querySelector(":scope > .modal-close");
      const closeRect = close.getBoundingClientRect();
      const line = getComputedStyle(heading, "::after");
      return {
        close: [closeRect.width, closeRect.height],
        border: getComputedStyle(heading).borderBottomStyle,
        content: line.content,
        right: parseFloat(line.right),
      };
    });
    expect(collectionHeader.close).toEqual([44, 44]);
    expect(collectionHeader.border).toBe("none");
    expect(collectionHeader.content).not.toBe("none");
    expect(collectionHeader.right).toBeGreaterThanOrEqual(48);
    const search = await page.locator("#library-search").boundingBox();
    const close = await page.locator(".modal-close").boundingBox();
    expect(
      Math.max(
        0,
        Math.min(search.x + search.width, close.x + close.width) -
          Math.max(search.x, close.x),
      ) *
        Math.max(
          0,
          Math.min(search.y + search.height, close.y + close.height) -
            Math.max(search.y, close.y),
        ),
    ).toBe(0);
    const hits = await page.locator(".modal-close").evaluate((el) => {
      const a = el.getBoundingClientRect();
      const buttons = [...document.querySelectorAll("#filter-bar button")];
      return (
        buttons.length > 0 &&
        buttons.every((b) => {
          const r = b.getBoundingClientRect();
          return (
            r.right <= a.left ||
            r.left >= a.right ||
            r.bottom <= a.top ||
            r.top >= a.bottom
          );
        })
      );
    });
    expect(hits).toBe(true);
    await page.locator(".modal-close").click();
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    expect(
      await page.locator(".hero-name").evaluateAll((es) =>
        es.every((el) => {
          const r = el.getBoundingClientRect(),
            p = el.parentElement.getBoundingClientRect();
          return (
            r.left >= p.left - 1 &&
            r.right <= p.right + 1 &&
            Math.abs(r.left + r.right - (p.left + p.right)) < 2
          );
        }),
      ),
    ).toBe(true);
    if (width < height && width < 1000) {
      expect(
        await page.locator(".mana-panel").evaluate((el) => {
          const p = el.getBoundingClientRect(),
            v = el.querySelector("strong").getBoundingClientRect(),
            g = el.querySelector(".mana-gems").getBoundingClientRect();
          return (
            [...el.querySelectorAll(".mana-gem")].every((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.top >= p.top && r.bottom <= p.bottom && r.right <= p.right
              );
            }) &&
            g.left >= v.right + 3 &&
            Math.abs(v.top + v.bottom - (g.top + g.bottom)) < 2
          );
        }),
      ).toBe(true);
    }
    await page.screenshot({
      path: `artifacts/ui-alignment/fixed-${width}-battle.png`,
    });
    await page.locator("#contract-open").click();
    await expect(page.locator("#toast")).not.toBeVisible();
    await page
      .locator(".covenant-card > img")
      .evaluateAll((es) => Promise.all(es.map((e) => e.decode())));
    await page.waitForTimeout(200);
    await assertDialogFit(page);
    await page.screenshot({
      path: `artifacts/ui-alignment/fixed-${width}-contract.png`,
    });
    await context.close();
  });
}
