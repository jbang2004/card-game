const { test, expect } = require("@playwright/test");
for (const [width, height] of [
  [1600, 940],
  [390, 844],
  [844, 390],
  [568, 320],
]) {
  test(`map titles stay inside route nodes and departure remains reachable ${width}x${height}`, async ({
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
    await page.locator("#adventure-nav").evaluate((e) => e.click());
    const nodes = await page.locator(".map-stop").evaluateAll((es) =>
      es.map((e) => {
        const box = e.getBoundingClientRect();
        const text = [...e.querySelectorAll("h3,p")].map((n) => {
          const r = n.getBoundingClientRect();
          return {
            x: r.x,
            right: r.right,
            width: r.width,
            height: r.height,
            scroll: n.scrollWidth,
            client: n.clientWidth,
          };
        });
        return {
          x: box.x,
          right: box.right,
          width: box.width,
          height: box.height,
          text,
        };
      }),
    );
    expect(nodes).toHaveLength(6);
    for (const n of nodes) {
      expect(n.height).toBeLessThan(240);
      for (const t of n.text) {
        expect(t.x).toBeGreaterThanOrEqual(n.x);
        expect(t.right).toBeLessThanOrEqual(n.right + 1);
        expect(t.width).toBeGreaterThan(90);
        expect(t.scroll).toBeLessThanOrEqual(t.client + 1);
      }
    }
    const action = page.locator("#map-continue");
    const r = await action.boundingBox();
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height).toBeLessThanOrEqual(height + 1);
    await action.click();
    await expect(page.locator("#hero-confirm")).toBeVisible();
    await context.close();
  });
}
