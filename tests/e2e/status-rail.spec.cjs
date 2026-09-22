const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [844, 390],
  [1600, 940],
]) {
  test(`shared round and rolling notifications ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 1000,
      hasTouch: width < 1000,
    });
    const page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.waitForTimeout(2500);
    const round = page.locator("#turn-number"),
      rail = page.locator("#battle-status");
    await expect(round).toBeVisible();
    const original = await rail.boundingBox();
    await page.screenshot({
      path: `artifacts/status-rail-20260919/${width}-round.png`,
    });
    await page.evaluate(() =>
      Emberfall.toast("法力不足 · 请先选择其他手牌", { duration: 1000 }),
    );
    await expect(rail).toHaveClass(/has-message/);
    const motion = await round.evaluate((el) =>
      el.getAnimations().map((a) => a.effect.getTiming().duration),
    );
    expect(motion.some((n) => n > 0)).toBe(true);
    await expect(round).toBeHidden();
    await expect(page.locator("#toast")).toBeVisible();
    const toast = await page.locator("#toast").boundingBox();
    expect(Math.abs(toast.x - original.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(toast.y - original.y)).toBeLessThanOrEqual(2);
    const overflow = await page
      .locator("#toast")
      .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(overflow).toBe(false);
    await page.screenshot({
      path: `artifacts/status-rail-20260919/${width}-notice.png`,
    });
    await expect(page.locator("#toast")).toBeHidden();
    await expect(round).toBeVisible();
    await page.waitForTimeout(300);
    expect(await rail.boundingBox()).toEqual(original);
    await page.screenshot({
      path: `artifacts/status-rail-20260919/${width}-returned.png`,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() =>
      Emberfall.toast("已取消 · 未消耗法力", { kind: "info" }),
    );
    await expect(rail).toHaveClass(/has-message/);
    expect(
      await round.evaluate((el) => getComputedStyle(el).transitionDuration),
    ).toBe("0s");
    await context.close();
  });
}
