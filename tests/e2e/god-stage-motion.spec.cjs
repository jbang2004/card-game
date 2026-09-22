const { test, expect } = require("@playwright/test");
const path = require("node:path");
const output = path.resolve("artifacts/god-stage-fix-20260920");
async function open(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    // Choose three current contract definitions without depending on a deck.
    g.s.p.contracts = Object.values(EmberData.byId)
      .filter((c) => c.contract)
      .slice(0, 3)
      .map((c) => c.id);
    g.events = [];
    g.emit();
  });
}
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [568, 320],
  [844, 390],
  [1600, 940],
]) {
  test(`hero-sized covenant and one swipe per card ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width < 1000,
      isMobile: width < 1000,
    });
    const page = await context.newPage();
    await open(page);
    if (width < 1000) {
      const geometry = await page.evaluate(() => {
        const { contract, player, arena } = EmberViewport.layout;
        return { contract, player, arena };
      });
      expect(geometry.contract.w).toBe(geometry.player.w);
      expect(geometry.contract.h).toBe(geometry.player.h);
      expect(geometry.contract.y + geometry.contract.h).toBeLessThan(
        geometry.player.y,
      );
      expect(geometry.contract.x + geometry.contract.w).toBeLessThan(
        geometry.arena.x,
      );
    }
    await page.screenshot({
      path: path.join(output, `${width}x${height}-battle.png`),
    });
    await page.locator("#contract-open").click();
    await expect(page.locator("#god-stage.flying")).toHaveCount(0);
    const cards = page.locator(".god-card");
    await expect(cards.nth(0)).toHaveClass(/focused/);
    // Real touch events generate the compatibility click as well as pointer events.
    const cdp = await context.newCDPSession(page);
    async function swipe(direction) {
      const r = await page.locator(".god-card.focused").boundingBox();
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let d = 12; d <= 144; d += 12)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + direction * d, y }],
        });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    }
    await swipe(-1);
    await expect(cards.nth(1)).toHaveClass(/focused/);
    await page.waitForTimeout(650); // Capture the settled card and ritual copy.
    if (width < 1000 && width > height) {
      const clear = await page.evaluate(() => {
        const copy = document
          .querySelector(".god-ritual-holder")
          .getBoundingClientRect();
        return [...document.querySelectorAll(".god-card")].every(
          (card) => card.getBoundingClientRect().right < copy.left,
        );
      });
      expect(clear).toBe(true);
    }
    await page.screenshot({
      path: path.join(output, `${width}x${height}-middle.png`),
    });
    await swipe(-1);
    await expect(cards.nth(2)).toHaveClass(/focused/);
    await swipe(1);
    await expect(cards.nth(1)).toHaveClass(/focused/);
    await page.keyboard.press("Escape");
    const targets = await cards.evaluateAll((nodes) =>
      nodes.map((n) => n.style.transform),
    );
    expect(new Set(targets).size).toBe(1);
    expect(targets[0]).toContain("scale(");
    await expect(page.locator("#god-stage")).toHaveCount(0);
    // Closing during staggered entry must also withdraw all cards immediately.
    await page.locator("#contract-open").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#god-stage.flying")).toHaveCount(0);
    expect(
      await cards.evaluateAll(
        (nodes) => new Set(nodes.map((n) => n.style.transform)).size,
      ),
    ).toBe(1);
    await expect(page.locator("#god-stage")).toHaveCount(0);
    await context.close();
  });
}

test("death dissolution cannot reveal its original image after animation cleanup", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    g.summon("e", "wolf", { sick: false });
    g.s.p.hand = [g.card("fireball")];
    g.events = [];
    g.emit();
    window.deathSamples = [];
    const seen = new Set();
    const observer = new MutationObserver(() => {
      document.querySelectorAll(".death-ghost").forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        node.getAnimations().forEach((animation) =>
          animation.addEventListener("finish", () => {
            // Run after the compositor's finish callback has cancelled WAAPI.
            queueMicrotask(() =>
              window.deathSamples.push({
                connected: node.isConnected,
                opacity: Number(getComputedStyle(node).opacity),
              }),
            );
          }),
        );
      });
    });
    observer.observe(document.getElementById("app"), { childList: true });
    window.deathObserver = observer;
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: g.s.p.hand[0].uid,
        target: { side: "e", uid: g.s.e.board[0].uid },
      }),
    );
  });
  await page.waitForFunction(() => !EmberFX.busy);
  const samples = await page.evaluate(() => {
    window.deathObserver.disconnect();
    return window.deathSamples;
  });
  expect(samples.length).toBeGreaterThanOrEqual(2);
  expect(samples.filter((s) => s.connected && s.opacity > 0)).toEqual([]);
  await expect(page.locator(".death-ghost")).toHaveCount(0);
  await expect(page.locator('#minions [data-cardid="wolf"]')).toHaveCount(0);
  await expect(page.locator('#minions [data-cardid="pup"]')).toHaveCount(1);
});

for (const [width, height] of [
  [320, 568],
  [390, 844],
]) {
  test(`full battlefield keeps the covenant lane clear ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await open(page);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      for (const side of ["p", "e"]) {
        g.s[side].board = [];
        for (let i = 0; i < 7; i++) g.summon(side, "guard", { sick: false });
      }
      g.events = [];
      g.emit();
    });
    await expect(page.locator("#minions .minion")).toHaveCount(14);
    const overlaps = await page.evaluate(() => {
      const god = document
        .getElementById("contract-open")
        .getBoundingClientRect();
      return [...document.querySelectorAll("#minions .minion")].filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left < god.right &&
          r.right > god.left &&
          r.top < god.bottom &&
          r.bottom > god.top
        );
      }).length;
    });
    expect(overlaps).toBe(0);
    await page.screenshot({
      path: path.join(output, `${width}x${height}-full-board.png`),
    });
    await context.close();
  });
}
