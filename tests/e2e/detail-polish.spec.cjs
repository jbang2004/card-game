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
    await expect(group.locator(".selection-light")).toHaveCount(1);
    await expect
      .poll(() =>
        group.evaluate((e) => {
          const a = e.querySelector(".active").getBoundingClientRect(),
            r = e.querySelector(".selection-light").getBoundingClientRect();
          return (
            Math.abs(r.left - a.left) +
            Math.abs(r.width - a.width) +
            Math.abs(r.top - (a.bottom - 1))
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
test("guide panel ornaments stay at four corners without covering the heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#guide-nav").click();
  const trim = page.locator(".help-turn-flow .panel-corner-trim");
  await expect(trim.locator("svg")).toHaveCount(4);
  expect(
    await trim.evaluate((e) => {
      const p = e.getBoundingClientRect(),
        r = [...e.children].map((c) => c.getBoundingClientRect());
      return (
        Math.abs(r[0].left - p.left - 1) < 1 &&
        Math.abs(r[1].right - p.right + 1) < 1 &&
        Math.abs(r[2].bottom - p.bottom + 1) < 1 &&
        Math.abs(r[3].left - p.left - 1) < 1 &&
        [...e.children].every(
          (c) => getComputedStyle(c).position === "absolute",
        )
      );
    }),
  ).toBe(true);
});
