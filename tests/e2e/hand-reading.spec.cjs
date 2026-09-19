const { test, expect } = require("@playwright/test");
const path = require("node:path");
const output = path.resolve("artifacts/hand-reading-20260919");

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [568, 320],
  [844, 390],
  [768, 1024],
  [1600, 940],
]) {
  test(`full hand reading and top status rail ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 1000,
      hasTouch: width < 1000,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.active = "p";
      g.s.p.mana = 0;
      g.s.p.hand = Array.from({ length: 10 }, () => g.card("solaris"));
      g.events = [];
      g.emit();
    });
    const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    await page
      .locator("#hand .hand-card")
      .first()
      .click({ position: { x: 20, y: 25 } });
    const lift = page.locator("#hand-card-lift");
    await expect(lift).toBeVisible();
    await expect(page.locator("#touch-target-bar")).toHaveAttribute(
      "data-mode",
      "inspect",
    );
    await expect(page.locator("#target-lines")).toBeHidden();
    const faults = await page.evaluate(() => {
      const errors = [],
        lift = document.getElementById("hand-card-lift"),
        r = lift.getBoundingClientRect();
      if (
        r.left < 0 ||
        r.right > innerWidth ||
        r.top < 0 ||
        r.bottom > innerHeight
      )
        errors.push("card outside viewport");
      for (const sel of [
        ".card-title",
        ".card-copy",
        ".stat-value",
        ".card-cost",
      ])
        for (const el of lift.querySelectorAll(sel)) {
          const b = el.getBoundingClientRect();
          if (
            b.left < r.left - 1 ||
            b.right > r.right + 1 ||
            b.top < r.top ||
            b.bottom > r.bottom
          )
            errors.push("outside " + sel);
        }
      const copy = lift.querySelector(".card-copy");
      if (
        copy.scrollHeight > copy.clientHeight + 1 ||
        getComputedStyle(copy).webkitLineClamp !== "none"
      )
        errors.push("rules clipped");
      for (const fy of [0.1, 0.6, 0.9])
        if (
          document
            .elementFromPoint(r.x + r.width / 2, r.y + r.height * fy)
            ?.closest(".hand-card") !== lift
        )
          errors.push("card clipped by scroller");
      const rail = document
        .getElementById("touch-target-bar")
        .getBoundingClientRect();
      if (
        rail.bottom >
        (EmberViewport.mobile && EmberViewport.portrait ? 100 : 80)
      )
        errors.push("rail outside header");
      for (const el of document.querySelectorAll(".topbar button")) {
        const b = el.getBoundingClientRect();
        if (
          getComputedStyle(el).visibility !== "hidden" &&
          b.width &&
          b.left < rail.right &&
          b.right > rail.left &&
          b.top < rail.bottom &&
          b.bottom > rail.top
        )
          errors.push("rail overlaps " + el.id);
      }
      return errors;
    });
    expect(faults).toEqual([]);
    await page.screenshot({
      path: path.join(output, `${width}x${height}-inspect.png`),
    });
    await lift.click({ position: { x: 50, y: 60 } });
    await expect(lift).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      before,
    );
    // Every catalogue card retains all rule lines even on the shortest viewport.
    const clipped = await page.evaluate(() => {
      const g = EmberDebug.game,
        errors = [];
      for (const c of EmberData.cards) {
        Emberfall.clearSelection();
        g.s.p.hand = [g.card(c.id)];
        g.events = [];
        g.emit();
        Emberfall.selectCard(g.s.p.hand[0].uid);
        const el = document.getElementById("hand-card-lift"),
          copy = el.querySelector(".card-copy"),
          r = el.getBoundingClientRect(),
          t = el.querySelector(".card-title").getBoundingClientRect();
        if (
          copy.scrollHeight > copy.clientHeight + 1 ||
          t.y < r.y + 30 ||
          copy.getBoundingClientRect().bottom > r.bottom - 20
        )
          errors.push(c.id);
      }
      Emberfall.clearSelection();
      return errors;
    });
    expect(clipped).toEqual([]);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.hand = [g.card("guard")];
      g.s.p.board = [];
      g.events = [];
      g.emit();
    });
    await page
      .locator("#hand .hand-card")
      .click({ position: { x: 20, y: 25 } });
    await expect(page.locator("#touch-target-bar")).toHaveAttribute(
      "data-mode",
      "placement",
    );
    await page.screenshot({
      path: path.join(output, `${width}x${height}-play.png`),
    });
    await page.locator("#touch-cancel").click();
    await expect(lift).toHaveCount(0);
    await page.evaluate(() =>
      Emberfall.toast("已取消 · 未消耗法力", { kind: "info" }),
    );
    await page.screenshot({
      path: path.join(output, `${width}x${height}-notice.png`),
    });
    await context.close();
  });
}

test("full board and opponent turn remain inspectable without spending resources", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  for (const reason of ["board", "turn"]) {
    await page.evaluate((reason) => {
      Emberfall.clearSelection();
      const g = EmberDebug.game;
      g.s.p.board = [];
      if (reason === "board")
        for (let i = 0; i < 7; i++) g.summon("p", "guard");
      g.s.active = reason === "turn" ? "e" : "p";
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.hand = [g.card("guard")];
      g.events = [];
      Emberfall.renderNow();
    }, reason);
    const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    await page
      .locator("#hand .hand-card")
      .click({ position: { x: 20, y: 25 } });
    await expect(page.locator("#hand-card-lift")).toBeVisible();
    await expect(page.locator("#touch-target-bar")).toHaveAttribute(
      "data-mode",
      "inspect",
    );
    expect(await page.evaluate(() => Emberfall.selection)).toBe(null);
    await page.locator("#arena").click({ position: { x: 30, y: 30 } });
    await expect(page.locator("#hand-card-lift")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      before,
    );
  }
});

test("touch can drag an expanded targeted card to play; rotation clears reading only", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.hand = [g.card("fireball")];
    g.events = [];
    g.emit();
  });
  await page.locator("#hand .hand-card").tap({ position: { x: 20, y: 25 } });
  const from = await page.locator("#hand-card-lift").boundingBox(),
    to = await page.locator("#enemy-hero .portrait-frame").boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x + 50, y: from.y + 60 }],
  });
  for (let i = 1; i <= 15; i++) {
    const t = i / 15;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + 50 + (to.x + to.width / 2 - from.x - 50) * t,
          y: from.y + 60 + (to.y + to.height / 2 - from.y - 60) * t,
        },
      ],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberDebug.game.s.p.hand.length)).toBe(0);
  await expect(page.locator("#hand-card-lift")).toHaveCount(0);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.hand = [g.card("solaris")];
    g.s.p.mana = 0;
    g.events = [];
    g.emit();
  });
  await page.locator("#hand .hand-card").tap({ position: { x: 20, y: 25 } });
  await expect(page.locator("#hand-card-lift")).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#hand-card-lift")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    before,
  );
  await context.close();
});
