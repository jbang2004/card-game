const { test, expect } = require("@playwright/test");

async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

async function dialogMetrics(page) {
  await settle(page);
  return page.locator("#modal .folio-dialog").evaluate((box) => {
    const r = box.getBoundingClientRect();
    return {
      size: box.dataset.dialogSize,
      width: r.width,
      height: r.height,
      centered:
        Math.abs(r.left + r.right - innerWidth) <= 1 &&
        Math.abs(r.top + r.bottom - innerHeight) <= 1,
    };
  });
}

test("desktop dialogs use semantic dimensions instead of one full-screen frame", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);

  await page.evaluate(() =>
    Emberfall.showModal(
      '<section class="modal-box confirm-box"><div class="modal-heading"><h2>确认</h2></div><p>短内容</p><div class="modal-footer"><button>取消</button><button>确认</button></div></section>',
      "confirm",
    ),
  );
  expect(await dialogMetrics(page)).toMatchObject({
    size: "confirm",
    width: 620,
    height: 360,
    centered: true,
  });

  await page.evaluate(() => Emberfall.showSettings());
  expect(await dialogMetrics(page)).toMatchObject({
    size: "standard",
    width: 900,
    height: 640,
    centered: true,
  });

  await page.evaluate(() => Emberfall.showHelp());
  expect(await dialogMetrics(page)).toMatchObject({
    size: "workspace",
    width: 1180,
    height: 850,
    centered: true,
  });

  await page.evaluate(() => Emberfall.showLibrary());
  expect(await dialogMetrics(page)).toMatchObject({
    size: "workspace",
    width: 1400,
    height: 850,
    centered: true,
  });
});

test("desktop toolbar SVGs share the exact button center", async ({ page }) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  const metrics = await page
    .locator("#sound-btn,#fullscreen-btn,#settings-btn")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const svg = button.querySelector("svg"),
          path = svg.querySelector("path"),
          b = button.getBoundingClientRect(),
          s = svg.getBoundingClientRect(),
          p = path.getBBox();
        return {
          id: button.id,
          button: [b.width, b.height],
          svg: [s.width, s.height],
          offset: [
            s.left + s.width / 2 - (b.left + b.width / 2),
            s.top + s.height / 2 - (b.top + b.height / 2),
          ],
          pathInsideViewBox:
            p.x >= 0 && p.y >= 0 && p.x + p.width <= 24 && p.y + p.height <= 24,
        };
      }),
    );
  expect(metrics).toHaveLength(3);
  for (const icon of metrics) {
    expect(icon.button).toEqual([32, 32]);
    expect(icon.svg).toEqual([18, 18]);
    expect(Math.abs(icon.offset[0])).toBeLessThanOrEqual(0.1);
    expect(Math.abs(icon.offset[1])).toBeLessThanOrEqual(0.1);
    expect(icon.pathInsideViewBox).toBe(true);
  }
});

test("folio pager uses symmetric coded SVGs centered in full touch targets", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.showHelp());
  const metrics = await page
    .locator(".folio-pager > button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const svg = button.querySelector("svg"),
          path = svg.querySelector("path"),
          b = button.getBoundingClientRect(),
          s = svg.getBoundingClientRect(),
          p = path.getBBox();
        return {
          button: [b.width, b.height],
          svg: [s.width, s.height],
          offset: [
            s.left + s.width / 2 - (b.left + b.width / 2),
            s.top + s.height / 2 - (b.top + b.height / 2),
          ],
          pathCenter: [p.x + p.width / 2, p.y + p.height / 2],
        };
      }),
    );
  expect(metrics).toHaveLength(2);
  for (const icon of metrics) {
    expect(icon.button).toEqual([44, 44]);
    expect(icon.svg).toEqual([18, 18]);
    expect(icon.offset).toEqual([0, 0]);
    expect(icon.pathCenter).toEqual([12, 12]);
  }
});
