const { test, expect } = require("@playwright/test");
const path = require("node:path");
const output = path.resolve("artifacts/battle-layout-audit-20260919");
const sizes = [
  [320, 568],
  [360, 640],
  [390, 844],
  [568, 320],
  [667, 375],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1920, 1080],
];
async function prepare(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.turn = 25;
    for (const side of ["p", "e"]) {
      g.s[side].hp = 23;
      g.s[side].armor = 12;
      g.s[side].mana = g.s[side].maxMana = 10;
      g.s[side].weapon = { cid: "sunblade", atk: 4, durability: 2, tags: [] };
      g.s[side].attacks = 0;
    }
    g.s.e.contracts = ["selmyra"];
    g.events = [];
    g.emit();
    Emberfall.clearSelection();
  });
  await page.waitForTimeout(240);
}
async function audit(page) {
  return page.evaluate(() => {
    const rect = (s) => document.querySelector(s).getBoundingClientRect();
    const overlap = (a, b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const errors = [];
    const weapon = rect("#weapon-slot"),
      portrait = rect("#player-hero .hero-card-inner");
    if (overlap(weapon, portrait)) errors.push("weapon covers portrait");
    if (weapon.left - portrait.right > 20 || weapon.left < portrait.right - 1)
      errors.push("weapon detached from portrait");
    for (const s of [
      "#power-btn",
      "#end-turn",
      "#contract-open",
      "#player-hero .hero-health",
      "#player-hero .hero-armor",
      ".mana-caption strong",
    ]) {
      if (overlap(weapon, rect(s))) errors.push("weapon overlaps " + s);
    }
    if (
      weapon.left < 0 ||
      weapon.right > innerWidth ||
      weapon.bottom > innerHeight
    )
      errors.push("weapon outside viewport");
    const nodes = [
      ...document.querySelectorAll(
        "#battle .hero-stat,#battle .hero-chip,#power-btn,#end-turn,.mana-caption strong",
      ),
    ].filter((e) => e.getBoundingClientRect().width > 0);
    // Inspect readable content, not the broad transparent hero hit targets.
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        if (
          overlap(
            nodes[i].getBoundingClientRect(),
            nodes[j].getBoundingClientRect(),
          )
        )
          errors.push(nodes[i].className + " overlaps " + nodes[j].className);
      }
    if (EmberViewport.mobile) {
      for (const e of document.querySelectorAll("#battle .hero-name")) {
        const a = e.getBoundingClientRect(),
          b = e.parentElement.getBoundingClientRect();
        if (
          a.left < b.left - 1 ||
          a.right > b.right + 1 ||
          a.top < b.top - 1 ||
          a.bottom > b.bottom + 1
        )
          errors.push("name outside portrait");
      }
      const value = rect(".mana-caption strong"),
        panel = rect(".mana-panel");
      if (
        value.height > 16 ||
        value.left < panel.left - 1 ||
        value.right > panel.right + 1
      )
        errors.push("mana wraps or escapes panel");
      for (const e of document.querySelectorAll(
        "#enemy-hero .hero-chip,#enemy-hero .hero-stat",
      )) {
        if (!e.getBoundingClientRect().width) continue;
        if (
          overlap(
            e.getBoundingClientRect(),
            rect("#player-hero .hero-card-inner"),
          )
        )
          errors.push("enemy stats cover player");
      }
    }
    return { errors, state: JSON.stringify(EmberDebug.game.s) };
  });
}
for (const [width, height] of sizes) {
  test(`equipped hero HUD fits ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 1000,
        hasTouch: width < 1000,
      }),
      page = await context.newPage();
    await prepare(page);
    const first = await audit(page);
    expect(first.errors).toEqual([]);
    await expect(page.locator("#weapon-slot b")).toHaveText(["4", "2"]);
    await page.screenshot({
      path: path.join(output, `${width}x${height}-verified.png`),
    });
    // Crossing the layout breakpoint must keep the weapon with its owner.
    await page.setViewportSize(
      width >= 1360
        ? { width: 390, height: 844 }
        : { width: height, height: width },
    );
    await page.waitForTimeout(250);
    const rotated = await audit(page);
    expect(rotated.errors).toEqual([]);
    expect(rotated.state).toBe(first.state);
    await context.close();
  });
}
test("weapon presentation follows equip, attack, break and desktop resize", async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.e.board = [];
    g.s.e.weapon = null;
    g.s.e.armor = 0;
    g.s.p.weapon.durability = 1;
    g.events = [];
    g.emit();
  });
  await expect(page.locator("#weapon-slot b").last()).toHaveText("1");
  const result = await page.evaluate(() => {
    const g = EmberDebug.game;
    return Emberfall.act(() =>
      g.dispatch({
        type: "attack",
        side: "p",
        uid: "hero",
        target: { side: "e", uid: "hero" },
      }),
    );
  });
  expect(result.ok).toBe(true);
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(page.locator("#weapon-slot")).toBeHidden();
  expect(await page.evaluate(() => EmberDebug.game.s.e.hp)).toBe(19);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(180);
  await expect(page.locator("#weapon-slot")).toBeHidden();
});

test("card focus cannot scroll the battlefield and header messages have one text layer", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    }),
    page = await context.newPage();
  await prepare(page);
  // Divine actions no longer consume hand width; explicitly create overflow.
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.hand = Array.from({ length: 10 }, () => g.card("guard"));
    g.events = [];
    g.emit();
  });
  await page.waitForTimeout(100);

  await page
    .locator("#hand .hand-card")
    .last()
    .evaluate((card) => {
      card.scrollIntoView({ block: "end", inline: "end" });
      card.focus();
    });
  const result = await page.evaluate(() => ({
    scroll: ["battle", "app"].map(
      (id) => document.getElementById(id).scrollTop,
    ),
    rail: document.getElementById("hand").scrollLeft,
  }));
  expect(result.scroll).toEqual([0, 0]);
  expect(result.rail).toBeGreaterThan(0);
  await page.evaluate(() =>
    Emberfall.toast("布局检查", { kind: "info", duration: 10000 }),
  );
  await expect(page.locator("#toast")).toBeVisible();
  await expect(page.locator("#turn-number")).toBeHidden();
  await page.evaluate(() => Emberfall.clearSelection());
  await expect(page.locator("#turn-number")).toBeVisible();
  await context.close();
});
