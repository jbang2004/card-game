const { test, expect } = require("@playwright/test");

async function expectSingleScreenControls(page, selector) {
  const box = page.locator("#modal .folio-dialog");
  const viewport = box.locator(".folio-viewport");
  await expect(box.locator(":scope > .folio-pane")).toHaveCount(1);
  await expect(box.locator(".folio-pager")).toHaveCount(0);
  const result = await box.evaluate((dialog, controlSelector) => {
    const view = dialog.querySelector(".folio-viewport"),
      flow = dialog.querySelector(".folio-flow"),
      vr = view.getBoundingClientRect(),
      controls = [...dialog.querySelectorAll(controlSelector)];
    return {
      horizontalOverflow: flow.scrollWidth - view.clientWidth,
      verticalOverflow: flow.scrollHeight - view.clientHeight,
      outside: controls
        .filter((control) => {
          const r = control.getBoundingClientRect();
          return (
            r.left < vr.left - 1 ||
            r.right > vr.right + 1 ||
            r.top < vr.top - 1 ||
            r.bottom > vr.bottom + 1
          );
        })
        .map((control) => control.textContent.trim()),
      undersizedButtons: controls
        .filter((control) => control.matches("button"))
        .filter((control) => {
          const r = control.getBoundingClientRect();
          return r.width < 44 || r.height < 44;
        }).length,
    };
  }, selector);
  expect(result.horizontalOverflow).toBeLessThanOrEqual(1);
  if (result.verticalOverflow > 1) await expect(viewport).toHaveCSS('overflow-y','auto');
  for (const control of await box.locator(selector).all()) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    expect(await control.evaluate(el => {
      const r=el.getBoundingClientRect();
      return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;
    })).toBe(true);
  }
  expect(result.undersizedButtons).toBe(0);
  await expect(viewport).toBeVisible();
}

for (const [width, height] of [
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
]) {
  test(`touch controls stay reachable in one scroll surface ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);

    await page.evaluate(() => Emberfall.showSettings());
    await expectSingleScreenControls(
      page,
      ".setting-row,.audio-level,.toggle,.wind-time-setting",
    );
    await page.evaluate(() => Emberfall.closeModal(false));

    await page.evaluate(() => Emberfall.demo());
    await page.waitForFunction(() => !EmberFX.busy);
    await page.evaluate(() => EmberMobile.showMenu());
    await expectSingleScreenControls(page, ".touch-menu-grid > button");
    await context.close();
  });
}

test("long mobile views scroll vertically without a pager", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  for (const show of ["showMap", "showHelp"]) {
    await page.evaluate((name) => Emberfall[name](), show);
    const box = page.locator("#modal .folio-dialog");
    await expect(box.locator(":scope > .folio-pane")).toHaveCount(1);
    await expect(box.locator(".folio-pager")).toHaveCount(0);
    await expect(box.locator(".folio-viewport")).toHaveCSS(
      "overflow-y",
      "auto",
    );
    await page.evaluate(() => Emberfall.closeModal(false));
  }
  await context.close();
});
