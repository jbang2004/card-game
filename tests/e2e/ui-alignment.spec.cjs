const { openCovenantPage } = require("./helpers/covenant.cjs");
const { assertDialogFit } = require("./helpers/dialog-pages.cjs");
const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [1600, 940],
  [1280, 800],
  [1024, 768],
  [390, 844],
  [360, 780],
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
      .locator("#touch-collection:visible, #collection-nav:visible")
      .click();
    const collectionHeader = await page
      .locator(".library-heading")
      .evaluate((heading) => {
        const close = heading.parentElement.querySelector(
          ":scope > .modal-close",
        );
        const closeRect = close.getBoundingClientRect();
        const title = heading.querySelector("h2");
        const range = document.createRange();
        range.selectNodeContents(title);
        const titleRect = range.getBoundingClientRect();
        const gap = Math.max(
          closeRect.left - titleRect.right,
          titleRect.left - closeRect.right,
          closeRect.top - titleRect.bottom,
          titleRect.top - closeRect.bottom,
        );
        return {
          close: [closeRect.width, closeRect.height],
          border: getComputedStyle(heading).borderBottomStyle,
          ornament: getComputedStyle(heading, "::after").content,
          gap,
        };
      });
    expect(collectionHeader.close).toEqual([44, 44]);
    // The slate page shell drops silverblue's hairline rule and its `::after`
    // ornament: the title row is unadorned and its geometry is carried by the
    // page inset instead. What still has to hold is that the title clears the
    // back control — the inset the ornament used to encode.
    expect(collectionHeader.border).toBe("none");
    expect(collectionHeader.ornament).toBe("none");
    expect(collectionHeader.gap).toBeGreaterThanOrEqual(12);
    if (!(await page.locator("#library-search").isVisible()))
      await page.locator("#library-filters > summary").click();
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
          /* Touch consoles seat the name beside the round avatar, inside the
           * hero strip; the desktop card keeps it centred on the plaque. */
          if (document.body.classList.contains("touch-layout")) {
            const hero = el.closest(".hero").getBoundingClientRect();
            return (
              getComputedStyle(el).display === "none" ||
              (r.left >= hero.left && r.right <= hero.right + 1)
            );
          }
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
            gems = el.querySelector(".mana-gems"),
            g = gems.getBoundingClientRect();
          if (getComputedStyle(gems).display === "none")
            return (
              v.left >= p.left &&
              v.right <= p.right &&
              v.top >= p.top &&
              v.bottom <= p.bottom
            );
          return (
            [...el.querySelectorAll(".mana-gem")].every((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.top >= p.top && r.bottom <= p.bottom && r.right <= p.right
              );
            }) &&
            /* Round 3 (§12.6) moved the `6/6` read-out to the RIGHT of the
             * pips so it reads as the caption of the round end-turn button in
             * the corner; before that it led the row. The contract this
             * protects — value and pips on one line, inside the panel,
             * vertically centred on each other — is unchanged, so the order
             * is no longer prescribed. */
            (g.left >= v.right + 3 || v.left >= g.right + 3) &&
            Math.abs(v.top + v.bottom - (g.top + g.bottom)) < 2
          );
        }),
      ).toBe(true);
    }
    /* The turn capsule shares the top bar with the brand on the left and the
     * icon cluster on the right. It is centred in the band BETWEEN them, not
     * on the screen, so it must never touch either — a screen-centred capsule
     * ran under the volume button on every phone narrower than ~400px
     * (design doc §12.6 / §14). */
    expect(
      await page.locator(".turn-number").evaluate((el) => {
        const area = (a, b) =>
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const capsule = el.getBoundingClientRect();
        return ["#sound-btn", ".brand"]
          .map((sel) => document.querySelector(sel))
          .filter((node) => node && getComputedStyle(node).display !== "none")
          .reduce(
            (worst, node) =>
              Math.max(worst, area(capsule, node.getBoundingClientRect())),
            0,
          );
      }),
    ).toBe(0);
    await page.screenshot({
      path: `artifacts/ui-alignment/fixed-${width}-battle.png`,
    });
    await openCovenantPage(page);
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
