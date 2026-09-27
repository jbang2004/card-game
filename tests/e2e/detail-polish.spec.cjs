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
    // an indicator the control owns; the band is no longer injected at all.
    // Since liquid glass v2 (design system 「分段控件」) the type filter is a
    // segmented control: the indicator is the active segment's own capsule
    // thumb inside the track, and no other segment paints one.
    await expect(group.locator(".selection-light")).toHaveCount(0);
    await expect
      .poll(() =>
        group.evaluate((e) => {
          const painted = (b) => {
            const s = getComputedStyle(b);
            return (
              s.backgroundColor !== "rgba(0, 0, 0, 0)" ||
              s.backgroundImage !== "none"
            );
          };
          const active = e.querySelector(".active");
          const track = e.getBoundingClientRect(),
            a = active.getBoundingClientRect();
          const radius = parseFloat(getComputedStyle(active).borderRadius);
          return (
            // the active segment is a painted capsule…
            (painted(active) ? 0 : 1) +
            (radius >= a.height / 2 - 0.5 ? 0 : 1) +
            // …seated inside the track…
            (a.left >= track.left - 0.5 &&
            a.right <= track.right + 0.5 &&
            a.top >= track.top - 0.5 &&
            a.bottom <= track.bottom + 0.5
              ? 0
              : 1) +
            // …and it is the only thumb
            [...e.querySelectorAll(".filter-btn:not(.active)")].filter(painted)
              .length
          );
        }),
      )
      .toBe(0);
    expect(await page.locator("#library-grid .card").count()).toBeGreaterThan(
      0,
    );
    await expect(page.locator("#library-grid .card").first()).toHaveClass(
      /spell/,
    );
    // The old theme moved one shared band onto whatever the pointer was over,
    // which meant the indicator lied about which filter was applied. Slate
    // marks hover on the segment itself and leaves the thumb on the segment
    // that is actually active, so hovering must change neither selection nor
    // grid.
    const minion = group.locator('[data-type="minion"]');
    await minion.hover();
    await expect(minion).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(minion).not.toHaveClass(/active/);
    await expect(spell).toHaveClass(/active/);
    await expect(page.locator("#library-grid .card").first()).toHaveClass(
      /spell/,
    );
    await page.mouse.move(2, 2);
    await expect(spell).toHaveClass(/active/);
    const mana = page.locator(".filter-mana-group");
    await mana.locator('[data-mana="2"]').focus();
    await expect(mana.locator('[data-mana="2"]')).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(mana.locator('[data-mana="2"]')).toHaveClass(/active/);
    await page.keyboard.press("Escape");
    await page.locator("#settings-btn").click();
    await page.locator('[data-section="operation"]').click();
    await expect(
      page.locator('.settings-nav [data-section="operation"]'),
    ).toHaveClass(/active/);
    await expect(page.locator(".settings-nav .active")).toHaveCount(1);
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
        title.left >= box.left &&
        title.right <= box.right &&
        title.top >= box.top &&
        title.bottom <= box.bottom,
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
