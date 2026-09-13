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

test.describe("battle instruction and feedback rails", () => {
  test("insufficient mana highlights its source and explains the error outside the court", async ({
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
        c = document
          .querySelector("#hand .feedback-error")
          .getBoundingClientRect();
      return { n, c };
    });
    expect(geometry.n.width).toBeLessThanOrEqual(900);
    expect(geometry.n.bottom).toBeLessThanOrEqual(geometry.c.top + 2);
  });

  test("desktop targetless play offers a visible instruction and cancel action", async ({
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
    await expect(page.locator("#touch-target-bar")).toBeVisible();
    await expect(page.locator("#touch-target-text")).toBeVisible();
    await assertPlacementCue(page);
  });

  test("desktop placement cue resolves to open space beside an occupied board", async ({
    page,
  }) => {
    await startDemo(page);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.active = "p";
      g.s.phase = "battle";
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.e.board = [];
      g.s.p.board = g.s.p.board.slice(0, 2);
      g.s.p.hand = [g.card("guard")];
      g.emit();
    });
    await page.locator('#hand [data-cardid="guard"]').click();
    const placement = await page.evaluate(() => {
      const d = document.getElementById("target-path").getAttribute("d"),
        match = d?.match(/([0-9.-]+),([0-9.-]+)$/),
        target = match ? { x: Number(match[1]), y: Number(match[2]) } : null,
        units = [...document.querySelectorAll(".friendly.minion")].map((el) => {
          const r = EmberViewport.pos(el);
          return { x: r.x, y: r.y, w: r.w, h: r.h };
        });
      return {
        target,
        overlaps:
          !!target &&
          units.some(
            (r) =>
              Math.abs(target.x - r.x) <= r.w / 2 &&
              Math.abs(target.y - r.y) <= r.h / 2,
          ),
      };
    });
    expect(placement.target).not.toBeNull();
    expect(placement.overlaps).toBe(false);
  });

  test("mobile targetless play keeps instructions above the court", async ({
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
      const chip = document
          .getElementById("touch-target-bar")
          .getBoundingClientRect(),
        hand = document.getElementById("hand").getBoundingClientRect(),
        label = document
          .getElementById("touch-target-text")
          .getBoundingClientRect();
      return { chip, hand, label };
    });
    expect(geometry.chip.width).toBeGreaterThanOrEqual(280);
    expect(geometry.chip.bottom).toBeLessThanOrEqual(geometry.hand.top + 1);
    expect(geometry.label.width).toBeGreaterThan(40);
    const cancel = await page.locator("#touch-cancel").boundingBox();
    expect(cancel.width).toBeGreaterThanOrEqual(44);
    expect(cancel.height).toBeGreaterThanOrEqual(44);
    await page.locator("#touch-cancel").click();
    await expect(chip).toBeHidden();
    await context.close();
  });
});

for (const [width, height] of [
  [1600, 940],
  [1360, 768],
  [1359, 768],
  [1280, 720],
  [390, 844],
  [320, 568],
  [844, 390],
  [667, 375],
  [568, 320],
]) {
  test(`commands, visible instructions and cancellation fit ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      isMobile: width < 1000,
    });
    const page = await context.newPage();
    await startDemo(page);
    await expect(page.locator("#end-turn")).toBeEnabled();
    await page.locator('#hand [data-cardid="frostbolt"]').click();
    await expect(page.locator("#touch-target-text")).toBeVisible();
    const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    const faults = await page.evaluate(() => {
      const errors = [],
        controls = [
          ...document.querySelectorAll(
            "#power-btn,#contract-open,#end-turn,#touch-cancel",
          ),
        ];
      const overlap = (a, b) =>
        Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
        Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
      for (const el of controls) {
        const r = el.getBoundingClientRect();
        if (r.width < 43 || r.height < 43) errors.push("small:" + el.id);
        if (
          r.left < 0 ||
          r.top < 0 ||
          r.right > innerWidth + 1 ||
          r.bottom > innerHeight + 1
        )
          errors.push("outside:" + el.id);
        if (getComputedStyle(el).backgroundImage !== "none")
          errors.push("texture:" + el.id);
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        if (!el.contains(hit)) errors.push("blocked:" + el.id);
      }
      for (let i = 0; i < controls.length; i++)
        for (let j = i + 1; j < controls.length; j++)
          if (
            overlap(
              controls[i].getBoundingClientRect(),
              controls[j].getBoundingClientRect(),
            )
          )
            errors.push("control-overlap");
      const bar = document.querySelector("#touch-target-bar"),
        r = bar.getBoundingClientRect();
      for (const el of document.querySelectorAll(
        "#battle .hero,#battle .minion,#hand",
      ))
        if (overlap(r, el.getBoundingClientRect()))
          errors.push("instruction-overlap:" + el.className);
      const label = document.querySelector("#touch-target-text"),
        range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      if (
        text.left < r.left ||
        text.right > r.right ||
        text.top < r.top - 1 ||
        text.bottom > r.bottom + 1
      )
        errors.push("text-outside");
      if (label.scrollHeight > label.clientHeight + 1)
        errors.push("clipped-copy");
      return errors;
    });
    expect(faults).toEqual([]);
    await page.screenshot({
      path: `output/battle-layout-20260913/target-${width}.png`,
    });
    await page.locator("#touch-cancel").click();
    await expect(page.locator("#touch-target-bar")).toBeHidden();
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      before,
    );
    if (width < 1000) {
      await page.setViewportSize({ width: height, height: width });
      await page.waitForFunction(() => EmberViewport.width === innerWidth);
      expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
        before,
      );
    }
    await context.close();
  });
}

test("a rejected action temporarily replaces its instruction without covering units", async ({
  page,
}) => {
  await startDemo(page);
  await page.locator('#hand [data-cardid="frostbolt"]').click();
  await page.evaluate(() =>
    Emberfall.toast("请点击高亮的合法目标，再确认本次行动。", {
      duration: 1000,
    }),
  );
  await expect(page.locator("#toast")).toBeVisible();
  await expect(page.locator("#touch-target-bar")).toBeHidden();
  await expect(page.locator("#toast")).toBeHidden();
  await expect(page.locator("#touch-target-bar")).toBeVisible();
  await page.locator("#touch-cancel").click();
});

test("the gallery shows the six current scenes and no retired building bundle", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await ready(page);
  await page.evaluate(() => Emberfall.showAtelier());
  await expect(page.locator(".atelier-vignette")).toHaveCount(6);
  expect(await page.evaluate(() => typeof WindborneAssets)).toBe("undefined");
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll(".atelier-vignette img")].every(
        (img, i) =>
          img.getAttribute("src") ===
          EmberTheme.art(
            EmberThemeDefinition.encounters[EmberData.bosses[i].id],
          ),
      ),
    ),
  ).toBe(true);
  await page.locator("#atelier-done").click();
  await expect(page.locator("#modal")).not.toHaveClass(/visible/);
});
