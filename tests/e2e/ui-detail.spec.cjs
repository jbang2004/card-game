const { test, expect } = require("@playwright/test");

for (const [width, height] of [
  [1600, 940],
  [1280, 800],
  [390, 844],
  [844, 390],
  [320, 568],
]) {
  test(`hero seals remain unclipped and selection preserves focus ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 1000,
      hasTouch: width < 1000,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#start-btn").click();
    // Inspect actual browser hit testing: a bounding box alone misses rounded clipping.
    for (const hero of await page
      .locator(".hero-option")
      .evaluateAll((els) => els.map((el) => el.dataset.hero))) {
      const choice = page.locator(`.hero-option[data-hero="${hero}"]`);
      await choice.scrollIntoViewIfNeeded();
      await choice.focus();
      await page.keyboard.press("Enter");
      await expect(choice).toHaveAttribute("aria-pressed", "true");
      await expect(choice).toBeFocused();
      await choice.scrollIntoViewIfNeeded();
      expect(
        await choice.locator(".selected-check").evaluate((badge) => {
          const r = badge.getBoundingClientRect();
          return [
            [0.5, 0.05],
            [0.95, 0.5],
            [0.5, 0.95],
            [0.05, 0.5],
            [0.2, 0.2],
            [0.8, 0.2],
            [0.2, 0.8],
            [0.8, 0.8],
          ].every(
            ([x, y]) =>
              document
                .elementFromPoint(r.x + r.width * x, r.y + r.height * y)
                ?.closest(".hero-option") === badge.closest(".hero-option"),
          );
        }),
      ).toBe(true);
    }
    // Choices now flow down measured columns instead of one fixed desktop row.
    expect(
      await page.locator(".hero-option h3").evaluateAll((es) =>
        es.every((e) => {
          const r = e.getBoundingClientRect(),
            p = e.closest(".hero-option").getBoundingClientRect();
          return (
            r.left >= p.left &&
            r.right <= p.right &&
            r.top >= p.top &&
            r.bottom <= p.bottom
          );
        }),
      ),
    ).toBe(true);
    const close = page.locator(".modal-close");
    expect(
      await close.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const title = document
          .querySelector(".modal-heading h2")
          .getBoundingClientRect();
        const minTarget = document.body.classList.contains("touch-layout")
          ? 44
          : 32;
        return (
          r.width >= minTarget - 0.1 &&
          r.height >= minTarget - 0.1 &&
          (title.right <= r.left ||
            title.bottom <= r.top ||
            title.top >= r.bottom) &&
          el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          )
        );
      }),
    ).toBe(true);
    await close.click();
    expect(errors).toEqual([]);
    await context.close();
  });
}
