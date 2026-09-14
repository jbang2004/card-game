const { test, expect } = require("@playwright/test");
for (const width of [1672, 1280, 390])
  test(`selector rails track live targets at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 941 });
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#lobby-library-btn").click();
    if (width === 390)
      await page.locator("#library-filters").evaluate((e) => (e.open = true));
    const group = page.locator(".filter-type-group");
    const spell = group.locator('[data-type="spell"]');
    await spell.click();
    await expect(spell).toHaveClass(/active/);
    // Slate replaced the old theme's travelling `.selection-light` band with
    // the underline bar the text pager owns (`.filter-btn.active::after`,
    // design system §3 「文字分页」); the band is no longer injected at all.
    // The geometric intent is unchanged: the indicator is a thin bar pinned to
    // the bottom of the active tab and centred on it.
    await expect(group.locator(".selection-light")).toHaveCount(0);
    await expect
      .poll(() =>
        group.evaluate((e) => {
          const active = e.querySelector(".active");
          const a = active.getBoundingClientRect();
          const bar = getComputedStyle(active, "::after");
          if (bar.content === "none") return Infinity;
          const left = parseFloat(bar.left),
            right = parseFloat(bar.right),
            bottom = parseFloat(bar.bottom),
            height = parseFloat(bar.height);
          return (
            // symmetric inset keeps the bar centred on its tab
            Math.abs(left - right) +
            // a hairline bar, not a filled block
            Math.max(0, height - 4) +
            // pinned to the tab's bottom edge
            Math.max(0, Math.abs(bottom) - 3) +
            // and it has to actually span the tab
            Math.max(0, 1 - (a.width - left - right))
          );
        }),
      )
      .toBeLessThan(2);
    expect(await page.locator("#library-grid .card").count()).toBeGreaterThan(
      0,
    );
    await expect(page.locator("#library-grid .card").first()).toHaveClass(
      /spell/,
    );
    await group.locator('[data-type="minion"]').hover();
    await expect(group).toHaveAttribute("data-light-target", "minion");
    await page.mouse.move(2, 2);
    await expect(group).toHaveAttribute("data-light-target", "spell");
    const mana = page.locator(".filter-mana-group");
    await mana.locator('[data-mana="2"]').focus();
    await expect(mana).toHaveAttribute("data-light-target", "2");
    await page.keyboard.press("Enter");
    await expect(mana.locator('[data-mana="2"]')).toHaveClass(/active/);
    await page.keyboard.press("Escape");
    await page.locator("#settings-btn").click();
    await page.locator('[data-section="operation"]').click();
    await expect(page.locator(".settings-nav")).toHaveAttribute(
      "data-light-target",
      "operation",
    );
    await expect(page.locator("#settings-done > svg")).toHaveCount(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
test("guide panels are rounded matte cards with no corner ornament over the heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#guide-nav").click();
  const panel = page.locator(".help-turn-flow");
  await expect(panel).toBeVisible();
  // The four-corner trim `panels.js` used to inject into every
  // `.crafted-panel` is gone from the DOM: slate's panel is a rounded matte
  // card (design system §5.6 「无四角」).
  await expect(panel.locator(".panel-corner-trim")).toHaveCount(0);
  const card = await panel.evaluate((e) => {
    const style = getComputedStyle(e);
    const heading = e.querySelector("h3");
    const box = e.getBoundingClientRect();
    const title = heading.getBoundingClientRect();
    return {
      trim: e.querySelectorAll(".panel-corner-trim").length,
      radius: parseFloat(style.borderRadius),
      borderWidth: parseFloat(style.borderTopWidth),
      // the heading sits inside the card's padding, nothing on top of it
      headingInside:
        title.left >= box.left && title.right <= box.right &&
        title.top >= box.top && title.bottom <= box.bottom,
      headingTopmost: (() => {
        const x = title.left + Math.min(8, title.width / 2);
        const hit = document.elementFromPoint(x, title.top + title.height / 2);
        return !!hit && heading.contains(hit);
      })(),
    };
  });
  expect(card.trim).toBe(0);
  expect(card.radius).toBeGreaterThanOrEqual(8);
  expect(card.borderWidth).toBeGreaterThan(0);
  expect(card.headingInside).toBe(true);
  expect(card.headingTopmost).toBe(true);
});
