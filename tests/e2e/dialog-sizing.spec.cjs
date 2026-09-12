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

test("desktop workspaces and compact dialogs use their semantic dimensions", async ({
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
    width: 480,
    centered: true,
  });

  await page.evaluate(() => Emberfall.showSettings());
  expect(await dialogMetrics(page)).toMatchObject({
    size: "settings",
    width: 1080,
    centered: true,
  });

  await page.evaluate(() => Emberfall.showHelp());
  expect(await dialogMetrics(page)).toMatchObject({
    size: "help",
    width: 1280,
    centered: true,
  });

  await page.evaluate(() => Emberfall.showLibrary());
  expect(await dialogMetrics(page)).toMatchObject({
    size: "library",
    width: 1600,
    height: 940,
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

test("long-form dialog exposes one vertical scroll surface", async ({ page }) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.showHelp());
  await expect(page.locator("#modal .folio-dialog > .folio-pane")).toHaveCount(1);
  await expect(page.locator("#modal .folio-pager")).toHaveCount(0);
  await expect(page.locator("#modal .folio-viewport")).toHaveCSS(
    "overflow-y",
    "auto",
  );
});
