const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [1672, 941],
  [1280, 720],
  [390, 844],
  [844, 390],
])
  test(`settings categories are honest, accessible and persistent ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#settings-btn").click();
    await expect(
      page.locator('.settings-content [role="tabpanel"]:visible'),
    ).toHaveCount(1);
    await expect(page.locator("#audio-volume")).toBeVisible();
    await page.locator("#audio-volume").fill("40");
    await page.locator("#audio-volume").dispatchEvent("input");
    await page.locator('[data-section="options"]').click();
    await expect(page.locator("#audio-volume")).toBeHidden();
    await expect(page.locator('[data-setting="low"]')).toBeVisible();
    const tab = page.locator('[data-section="options"]');
    await tab.press("End");
    await expect(page.locator('[data-section="operation"]')).toBeFocused();
    await expect(page.locator('[data-setting="fast"]')).toBeVisible();
    await tab.focus();
    await tab.press("Home");
    await expect(page.locator("#audio-volume")).toHaveValue("40");
    await expect(page.locator('.settings-nav [tabindex="0"]')).toHaveCount(1);
    await page.locator("#settings-done").click();
    await page.reload();
    await page.waitForFunction(() => window.Emberfall);
    await page.locator("#settings-btn").click();
    await expect(page.locator("#audio-volume")).toHaveValue("40");
  });
test("collection has one search and no simulated destinations; help explains free actions", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#lobby-library-btn").click();
  await expect(page.locator(".library-reference-nav")).toHaveCount(0);
  await expect(page.locator("#library-search")).toHaveCount(1);
  await page.locator("#library-search").fill("寒霜");
  await expect(page.locator("#library-grid .card")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.evaluate(() => Emberfall.showHelp());
  await expect(page.locator(".help-turn-flow")).toContainText("可按策略穿插");
  await page.locator(".help-toc button").nth(1).click();
  await expect(page.locator(".help-section:visible")).toHaveCount(1);
  await expect(page.locator(".help-section:visible")).toContainText(
    "不需要目标的牌再点战场空位确认",
  );
  await expect(page.locator("#help-done")).toHaveText("返回游戏");
});
test("portrait guide exposes every chapter and keyboard focus stays inside the dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.showHelp());
  const tabs = page.locator(".help-toc button");
  for (const tab of await tabs.all()) {
    const r = await tab.boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(390);
    await expect(tab).toBeInViewport();
  }
  await tabs.nth(3).click();
  await expect(page.locator(".key-table")).toBeVisible();
  await tabs.nth(3).press("Home");
  await expect(tabs.first()).toBeFocused();
  await tabs.first().press("Tab");
  await expect(page.locator(".help-section:visible")).toBeFocused();
  await page.locator("#help-done").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".modal-close")).toBeFocused();
});
