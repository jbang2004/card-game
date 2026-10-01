const { test, expect } = require("@playwright/test");

/* Every card is an amber block (presentation/amber-cards.js): a still picture behind live DOM text,
 * and a live canvas for the card held up to read. */
async function ready(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function battle(page) {
  await ready(page);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}
const hand = (ids) => ({ ids });
async function setHand(page, ids, mana = 10) {
  await page.evaluate(({ ids, mana }) => {
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.p.mana = g.s.p.maxMana = mana;
    g.s.p.hand = ids.map((id) => g.card(id));
    g.events = [];
    g.emit();
  }, { ids, mana });
}

test("every rule fits on the face, all of its characters placed", async ({ page }) => {
  await ready(page);
  const faults = await page.evaluate(async () => {
    const out = [];
    for (const c of EmberData.cards) {
      const r = await EmberAmber.rules(c.id);
      if (!r || r.lines === 0 && r.total > 0 || r.placed !== r.total || r.lines > 5 || r.size < 4.2) out.push([c.id, r]);
    }
    return out;
  });
  expect(faults).toEqual([]);
});

test("hand cards are painted, with their text still in the DOM", async ({ page }) => {
  await battle(page);
  await setHand(page, ["spark", "wolf", "treant", "solaris", "bonelord", "frostbolt", "dagger"], 5);
  await page.waitForFunction(() => document.querySelectorAll("#hand .card.amber-ready").length === 7);
  const state = await page.evaluate(() =>
    [...document.querySelectorAll("#hand .card")].map((el) => ({
      img: getComputedStyle(el).backgroundImage.startsWith("url("),
      name: el.querySelector(".card-title-value").textContent,
      aspect: +(el.offsetWidth / el.offsetHeight).toFixed(3),
    })),
  );
  for (const c of state) {
    expect(c.img).toBe(true);
    expect(c.name.length).toBeGreaterThan(0);
    expect(c.aspect).toBeCloseTo(5 / 7.4, 2);
  }
  expect(await page.evaluate(() => document.documentElement.classList.contains("amber-off"))).toBe(false);
});

test("a card held up to read is a live block that turns with the pointer", async ({ page }) => {
  await battle(page);
  await setHand(page, ["wolf", "solaris"]);
  await page.waitForFunction(() => document.querySelectorAll("#hand .card.amber-ready").length === 2);
  await page.locator("#hand .hand-card").first().click({ position: { x: 20, y: 25 }, force: true });
  await page.waitForSelector("#hand-card-lift .card.amber-live .amber-live-canvas", { timeout: 20000 });
  const lift = await page.locator("#hand-card-lift").boundingBox();
  await page.mouse.move(lift.x + lift.width * 0.5, lift.y + lift.height * 0.5);
  await page.mouse.move(lift.x + lift.width * 0.95, lift.y + lift.height * 0.4, { steps: 6 });
  await page.waitForTimeout(500);
  const angle = await page.evaluate(() => EmberAmber.diagnostics());
  expect(angle.status).toBe("ready");
  expect(angle.id).toBe("wolf");
  // the canvas is inside the card and is drawing
  expect(angle.frames).toBeGreaterThan(2);
  expect(await page.locator("#hand-card-lift .amber-live-canvas").evaluate((c) => c.width * c.height)).toBeGreaterThan(100000);
  await page.keyboard.press("Escape");
  await expect(page.locator(".amber-live-canvas")).toHaveCount(0);
});

test("the collection paints the cards in view", async ({ page }) => {
  await ready(page);
  await page.locator("#lobby-library-btn").click();
  await page.locator(".library-entry").first().waitFor();
  await page.waitForFunction(() => {
    const inView = [...document.querySelectorAll(".library-item .card")].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.width > 0;
    });
    return inView.length >= 4 && inView.every((c) => c.classList.contains("amber-ready"));
  }, null, { timeout: 30000 });
  // one amber everywhere: the same picture pipeline, no second face
  expect(await page.locator(".library-item .card-art, .library-item .card-inner").count()).toBe(0);
});

test("without WebGL2 (html.amber-off) the text shows on a plain plate", async ({ page }) => {
  await ready(page);
  await page.locator("#lobby-library-btn").click();
  await page.locator(".library-entry").first().waitFor();
  await page.evaluate(() => document.documentElement.classList.add("amber-off"));
  await expect(page.locator(".library-item .card-title-value").first()).toBeVisible();
  await expect(page.locator(".library-item .card-copy").first()).toBeVisible();
});
