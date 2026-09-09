const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [568, 320],
  [844, 390],
]) {
  test(`landscape deck configuration stays operable and returns to list ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#touch-collection").click();
    await page.locator("#touch-deck-tab").click();
    await page.locator("#deck-tools > summary").click();
    await expect(page.locator("#deck-tools > summary")).toContainText(
      "完成调整",
    );
    const body = await page.locator(".deck-tools-body").boundingBox();
    expect(body.height).toBeGreaterThanOrEqual(80);
    expect(body.y + body.height).toBeLessThanOrEqual(height);
    await page.locator("#deck-class").selectOption("ranger");
    await expect(page.locator("#deck-class")).toHaveValue("ranger");
    await expect(page.locator("#deck-warning")).toContainText(/问题/);
    const warningBody = await page.locator(".deck-tools-body").boundingBox();
    expect(warningBody.height).toBeGreaterThanOrEqual(80);
    expect(warningBody.y + warningBody.height).toBeLessThanOrEqual(height);
    await page.screenshot({
      path: `artifacts/uiux/deck-detail-fixed-${width}-warnings.png`,
    });
    await page.locator("#deck-contracts > summary").click();
    const contract = page.locator("[data-deck-contract]").first();
    await contract.scrollIntoViewIfNeeded();
    await contract.check();
    await expect(contract).toBeChecked();
    await page.screenshot({
      path: `artifacts/uiux/deck-detail-fixed-${width}-contracts.png`,
    });
    await page.locator("#deck-tools > summary").click();
    await expect(page.locator("#deck-list")).toBeVisible();
    await expect(page.locator("#deck-tools > summary")).toContainText("调整套牌");
    await page.screenshot({
      path: `artifacts/uiux/deck-detail-fixed-${width}-list.png`,
    });
    const action = await page.locator("#deck-save").boundingBox();
    expect(action.y + action.height).toBeLessThanOrEqual(height);
    const summary = page.locator("#deck-tools > summary");
    const summaryRect = await summary.boundingBox();
    expect(summaryRect.y).toBeGreaterThanOrEqual(0);
    expect(summaryRect.y + summaryRect.height).toBeLessThanOrEqual(height);
    await summary.click();
    await expect(summary).toContainText("完成调整");
    const reopened = await page.locator(".deck-tools-body").boundingBox();
    expect(reopened.height).toBeGreaterThanOrEqual(80);
    expect(errors).toEqual([]);
    await page.locator(".modal-close").click();
    await page.locator("#start-btn").click();
    await page.locator("#hero-confirm").click();
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.evaluate(() => {
      const e = document.createElement("div");
      e.className = "turn-cue";
      e.dataset.audit = "true";
      e.textContent = "TURN AUDIT";
      document.getElementById("app").append(e);
    });
    await page.locator("#contract-open").click();
    await expect(page.locator(".turn-cue[data-audit]")).toBeHidden();
    await page.screenshot({
      path: `artifacts/uiux/deck-detail-fixed-${width}-covenant.png`,
    });
    await context.close();
  });
}
