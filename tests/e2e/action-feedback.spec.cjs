const { test, expect } = require("@playwright/test");

async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.waitForTimeout(100);
}

async function idle(page) {
  await page.waitForFunction(() => !EmberFX.busy);
}

async function startDemo(page) {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#quick-btn").click();
  await idle(page);
}

async function assertPlacementCue(page) {
  const cue = await page.evaluate(() => {
    const svg = document.getElementById("target-lines"),
      path = document.getElementById("target-path"),
      arrow = document.getElementById("target-arrow"),
      circle = document.getElementById("target-circle"),
      rect = circle.getBoundingClientRect();
    return {
      mode: svg.dataset.mode,
      path: path.getAttribute("d"),
      arrow: arrow.getAttribute("d"),
      radius: Number(circle.getAttribute("r")),
      circle: { width: rect.width, height: rect.height },
    };
  });
  expect(cue.mode).toBe("placement");
  expect(cue.path).toMatch(/^M/);
  expect(cue.arrow).toMatch(/^M/);
  expect(cue.radius).toBeGreaterThan(12);
  expect(cue.circle.width).toBeGreaterThan(20);
}

test.describe("three-layer action feedback", () => {
  test("insufficient mana stays local to its card and resource", async ({
    page,
  }) => {
    await startDemo(page);
    const uid = await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = 0;
      g.emit();
      return g.s.p.hand.find((card) => g.cost(card) > 0).uid;
    });
    const card = page.locator(`#hand [data-hand="${uid}"]`),
      notice = page.locator("#toast");
    await card.click();
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("法力不足");
    await expect(notice).toContainText("当前 0 点");
    await expect(page.locator("#touch-target-bar")).toBeHidden();
    await expect(page.locator("#target-lines")).toBeHidden();
    await expect(card).toHaveClass(/feedback-error/);
    await expect(page.locator(".mana-panel")).toHaveClass(/feedback-error/);
    const geometry = await page.evaluate(() => {
      const n = document.getElementById("toast").getBoundingClientRect(),
        c = document.querySelector("#hand .feedback-error").getBoundingClientRect();
      return { n, c };
    });
    expect(geometry.n.width).toBeLessThanOrEqual(280);
    expect(geometry.n.bottom).toBeLessThanOrEqual(geometry.c.top + 2);
  });

  test("desktop targetless play uses a compact board drop guide", async ({
    page,
  }) => {
    await startDemo(page);
    const uid = await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.board = [];
      g.s.p.hand = [g.card("guard")];
      g.emit();
      return g.s.p.hand[0].uid;
    });
    await page.locator(`#hand [data-hand="${uid}"]`).click();
    const cue = page.locator("#target-lines");
    await expect(cue).toBeVisible();
    await expect(cue).toHaveAttribute("data-mode", "placement");
    await expect(page.locator("#touch-target-bar")).toBeHidden();
    await assertPlacementCue(page);
  });

  test("mobile targetless play keeps confirmation beside the hand", async ({
    browser,
  }) => {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
      page = await context.newPage();
    await startDemo(page);
    const uid = await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.board = [];
      g.s.p.hand = [g.card("guard")];
      g.emit();
      return g.s.p.hand[0].uid;
    });
    await page.locator(`#hand [data-hand="${uid}"]`).click();
    const chip = page.locator("#touch-target-bar");
    await expect(chip).toBeVisible();
    await expect(chip.locator("#touch-cancel")).toBeVisible();
    await expect(page.locator("#target-lines")).toBeVisible();
    await expect(page.locator("#target-lines")).toHaveAttribute(
      "data-mode",
      "placement",
    );
    const geometry = await page.evaluate(() => {
      const chip = document.getElementById("touch-target-bar").getBoundingClientRect(),
        hand = document.getElementById("hand").getBoundingClientRect(),
        label = document.getElementById("touch-target-text").getBoundingClientRect();
      return { chip, hand, label };
    });
    expect(geometry.chip.width).toBeLessThanOrEqual(64);
    expect(geometry.chip.bottom).toBeLessThanOrEqual(geometry.hand.top + 1);
    expect(geometry.label.width).toBeLessThanOrEqual(1);
    await context.close();
  });
});
