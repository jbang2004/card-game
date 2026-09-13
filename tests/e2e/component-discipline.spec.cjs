const { test, expect } = require("@playwright/test");
const { inspectVisualDiscipline } = require("./helpers/visual-discipline.cjs");
for (const [width, height] of [
  [1117, 884],
  [752, 884],
  [1672, 941],
  [844, 390],
]) {
  test(`deck metrics and action labels retain their space ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#lobby-library-btn").click();
    if (await page.locator("#touch-deck-tab").isVisible())
      await page.locator("#touch-deck-tab").click();
    await expect.poll(() => inspectVisualDiscipline(page)).toEqual([]);
    const geometry = await page.evaluate(() => {
      const curve = document.querySelector("#deck-curve"),
        r = curve.getBoundingClientRect();
      const actions = document
        .querySelector(".deck-actions")
        .getBoundingClientRect();
      return {
        height: r.height,
        bottom: r.bottom,
        actionTop: actions.top,
        parent: curve.parentElement.className,
        labels: [...curve.querySelectorAll("small")].every((e) => {
          const t = e.getBoundingClientRect();
          return t.top >= r.top && t.bottom <= r.bottom;
        }),
        costSize: parseFloat(
          getComputedStyle(document.querySelector(".deck-row .cost")).fontSize,
        ),
        centers: [...document.querySelectorAll(".deck-actions button")].map(
          (e) => {
            const a = e.getBoundingClientRect(),
              l = e.querySelector(".action-label").getBoundingClientRect();
            return Math.abs(a.x + a.width / 2 - l.x - l.width / 2);
          },
        ),
      };
    });
    expect(geometry.height).toBeGreaterThanOrEqual(70);
    expect(geometry.labels).toBe(true);
    expect(geometry.costSize).toBeLessThanOrEqual(16);
    expect(Math.max(...geometry.centers)).toBeLessThan(2);
    if (height > 500) {
      expect(geometry.parent).toContain("deck-editor");
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.actionTop);
    } else expect(geometry.parent).toContain("deck-content");
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(page.locator(".deck-content > #deck-curve")).toHaveCount(1);
    await page.setViewportSize({ width: 1117, height: 884 });
    await expect(page.locator(".deck-editor > #deck-curve")).toHaveCount(1);
  });
}
