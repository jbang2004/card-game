/* The hero-select preview card (EmberCardRelief + EmberLiveArt). Cards are amber blocks: tests/e2e/amber-cards.spec.cjs. */
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve("artifacts/card-relief");
fs.mkdirSync(out, { recursive: true });

async function openHeroes(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#start-btn").click();
  // The preview card shows the hero's live portrait; relief only tilts the card.
  await expect(page.locator("#modal .scene-showcase")).toHaveClass(
    /live-art-ready/,
    { timeout: 15000 },
  );
}
function errorsFor(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      ["error", "warning"].includes(m.type()) &&
      !/\/favicon\.ico$/.test(m.location().url || "")
    )
      errors.push(m.text());
  });
  return errors;
}
// Mean absolute pixel difference between two live-portrait frames, 0..255.
const liveDiff = (page, a, b) =>
  page.evaluate(
    ([a, b]) => {
      const canvas = document.querySelector(".live-art-canvas");
      const grab = ([x, y, t, blink]) => {
        EmberCardRelief.pose(x, y);
        EmberLiveArt.pose(t, blink);
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const g = copy.getContext("2d");
        g.drawImage(canvas, 0, 0);
        return g.getImageData(0, 0, copy.width, copy.height).data;
      };
      const first = grab(a),
        second = grab(b);
      EmberCardRelief.pose();
      EmberLiveArt.pose();
      let sum = 0;
      for (let i = 0; i < first.length; i++) sum += Math.abs(first[i] - second[i]);
      return sum / first.length;
    },
    [a, b],
  );

test("hero preview card is the live portrait: idle motion, blink, and a turn with the card", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await openHeroes(page);
  const card = page.locator("#modal .scene-showcase");
  // Tilt only: the relief face is not painted underneath the portrait.
  expect(await page.locator(".card-relief-canvas").count()).toBe(0);
  expect(await page.locator(".live-art-canvas").count()).toBe(1);
  await expect(page.locator(".live-art-canvas")).toHaveCSS("opacity", "1");
  // Idle motion changes the picture over time; a blink changes it at once.
  expect(await liveDiff(page, [0, 0, 0, 0], [0, 0, 2.4, 0])).toBeGreaterThan(1);
  expect(await liveDiff(page, [0, 0, 0, 0], [0, 0, 0, 1])).toBeGreaterThan(0.02);
  // The card still turns (DOM frame) and the scene inside turns with it.
  expect(await liveDiff(page, [-1, 0, 0, 0], [1, 0, 0, 0])).toBeGreaterThan(3);
  await page.evaluate(() => EmberCardRelief.pose(1, 0));
  expect(
    await card.evaluate((el) => el.style.getPropertyValue("--relief-ry")),
  ).toMatch(/^1\d\.\d+deg$/);
  await page.evaluate(() => EmberCardRelief.pose());
  // It keeps drawing while the page is open.
  const before = (await page.evaluate(() => EmberLiveArt.diagnostics())).frames;
  await page.waitForTimeout(400);
  expect((await page.evaluate(() => EmberLiveArt.diagnostics())).frames).toBeGreaterThan(before + 5);

  // Every selectable hero has a portrait; switching re-mounts onto the new element.
  const heroes = await page.evaluate(() =>
    EmberData.heroes.map((h) => ({ id: h.id, portrait: h.portraitId })),
  );
  for (const { id, portrait } of heroes) {
    await page.locator(`#modal [data-hero="${id}"]`).click();
    await expect(page.locator("#modal .scene-showcase")).toHaveClass(/live-art-ready/);
    expect((await page.evaluate(() => EmberLiveArt.diagnostics())).id).toBe(portrait);
    await page.evaluate(() => EmberCardRelief.pose(0.8, 0.3));
    await page.screenshot({ path: path.join(out, `page-${id}.png`) });
    await page.evaluate(() => EmberCardRelief.pose());
  }
  expect(await page.locator(".live-art-canvas").count()).toBe(1);
  // Leaving the page stops it.
  await page.keyboard.press("Escape");
  await expect(page.locator(".live-art-canvas")).toHaveCount(0);
  await expect.poll(async () => (await page.evaluate(() => EmberLiveArt.diagnostics())).status).toBe("idle");
  expect(errors).toEqual([]);
});

test("reduced motion keeps the card flat and the portrait still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHeroes(page);
  await page.mouse.move(1500, 100);
  await page.waitForTimeout(400);
  const frames = (await page.evaluate(() => EmberCardRelief.diagnostics())).frames,
    live = (await page.evaluate(() => EmberLiveArt.diagnostics())).frames;
  await page.waitForTimeout(400);
  expect((await page.evaluate(() => EmberCardRelief.diagnostics())).frames).toBe(frames);
  expect((await page.evaluate(() => EmberLiveArt.diagnostics())).frames).toBe(live);
  expect(
    await page
      .locator("#modal .scene-showcase")
      .evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry"))),
  ).toBe(0);
});

/* The relief canvas must be what the player sees, not merely be mounted: black out
 * the flat artwork underneath and check the card is still as bright as the canvas. */
