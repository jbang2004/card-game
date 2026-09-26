const { test, expect } = require("@playwright/test");
const path = require("node:path");
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [568, 320],
  [844, 390],
  [768, 1024],
  [1600, 940],
]) {
  test(`translucent status, hero covenant and directional hand cues ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      isMobile: width < 1000,
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
      g.s.p.hand = Array.from({ length: 10 }, () => g.card("guard"));
      g.s.p.weapon = { cid: "sunblade", atk: 3, durability: 2, tags: [] };
      g.events = [];
      g.emit();
    });
    await page.waitForTimeout(150);
    const faults = await page.evaluate(() => {
      const errors = [],
        rail = document.getElementById("battle-status"),
        style = getComputedStyle(rail),
        rect = rail.getBoundingClientRect();
      if (
        !style.backgroundColor.startsWith("rgba(") ||
        style.backgroundImage !== "none"
      )
        errors.push("opaque status material");
      if (!EmberViewport.mobile && rect.width > 440)
        errors.push("desktop status too wide");
      if (EmberViewport.mobile) {
        const god = document.getElementById("contract-open"),
          r = god.getBoundingClientRect(),
          hand = document.getElementById("hand").getBoundingClientRect();
        /* portrait: a medallion in the console row beside the hero power (the hand's lift headroom reaches over
         * that row); landscape: a card in the rail above the hero */
        const power = document.getElementById("power-btn").getBoundingClientRect();
        if (
          (EmberViewport.portrait ? Math.abs(r.top - power.top) > 1 : r.bottom > hand.top) ||
          r.width < 44 ||
          r.height < 44 ||
          r.x < 0 ||
          r.right > innerWidth
        )
          errors.push("god is not in hero HUD");
        for (const el of document.querySelectorAll(
          "#weapon-slot,#power-btn,#end-turn,#player-hero .hero-card-inner,#player-hero .hero-chip,.mana-panel",
        )) {
          const b = el.getBoundingClientRect();
          if (
            Math.min(r.right, b.right) > Math.max(r.left, b.left) + 1 &&
            Math.min(r.bottom, b.bottom) > Math.max(r.top, b.top) + 1
          )
            errors.push("god overlaps " + el.className);
        }
        if (
          !god.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          )
        )
          errors.push("god hit blocked");
      }
      return errors;
    });
    expect(faults).toEqual([]);
    const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    const left = page.locator('[data-hand-scroll="-1"]'),
      right = page.locator('[data-hand-scroll="1"]');
    if (width < 1000) {
      await expect(left).toBeHidden();
      await expect(right).toBeVisible();
      await page
        .locator("#hand")
        .evaluate((el) =>
          el.scrollBy({ left: el.clientWidth * 0.75, behavior: "instant" }),
        );
      await expect(left).toBeVisible();
      // A page step may reach the end on a wide hand; verify the true midpoint.
      await page
        .locator("#hand")
        .evaluate(
          (el) => (el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2),
        );
      await expect(right).toBeVisible();
      const intercepts = await page
        .locator("#hand-scroll-hints")
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return [r.left + 12, r.right - 12].some((x) =>
            el.contains(document.elementFromPoint(x, r.top + 30)),
          );
        });
      expect(intercepts).toBe(false);
      await page.screenshot({
        path: path.resolve(
          `artifacts/responsive-polish-20260919/${width}x${height}-middle.png`,
        ),
      });
      await page
        .locator("#hand")
        .evaluate((el) => (el.scrollLeft = el.scrollWidth));
      await expect(right).toBeHidden();
      await expect(left).toBeVisible();
      await page
        .locator("#hand")
        .evaluate((el) =>
          el.scrollBy({ left: -el.clientWidth * 0.75, behavior: "instant" }),
        );
      await expect(right).toBeVisible();
      await page.locator("#hand").evaluate((el) => (el.scrollLeft = 0));
      await expect(left).toBeHidden();
    } else await expect(page.locator("#hand-scroll-hints")).toBeHidden();
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      before,
    );
    await page.evaluate(() =>
      Emberfall.toast("法力不足 · 请先选择其他手牌", { duration: 10000 }),
    );
    await expect(page.locator("#toast")).toBeVisible();
    await page.screenshot({
      path: path.resolve(
        `artifacts/responsive-polish-20260919/${width}x${height}-notice.png`,
      ),
    });
    await page.evaluate(() => Emberfall.clearSelection());
    await page.locator("#contract-open").click();
    await expect(page.locator("#god-stage")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.hand = [g.card("guard")];
      g.events = [];
      g.emit();
    });
    await expect(page.locator("#hand-scroll-hints")).toBeHidden();
    await context.close();
  });
}
