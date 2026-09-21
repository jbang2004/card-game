const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve("artifacts/card-relief");
fs.mkdirSync(out, { recursive: true });

async function openHeroes(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#start-btn").click();
  await expect(page.locator("#modal .scene-showcase")).toHaveClass(
    /card-relief-ready/,
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
// Mean absolute pixel difference between two canvas frames, 0..255.
const faceDiff = (page, a, b) =>
  page.evaluate(
    ([a, b]) => {
      const canvas = document.querySelector(".card-relief-canvas");
      const grab = (pose) => {
        EmberCardRelief.pose(...pose);
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const g = copy.getContext("2d");
        g.drawImage(canvas, 0, 0);
        return g.getImageData(0, 0, copy.width, copy.height).data;
      };
      const first = grab(a),
        second = grab(b);
      let sum = 0;
      for (let i = 0; i < first.length; i++) sum += Math.abs(first[i] - second[i]);
      return sum / first.length;
    },
    [a, b],
  );

test("hero preview card paints a relief face that responds to tilt", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await openHeroes(page);
  const card = page.locator("#modal .scene-showcase");
  for (const [name, pose] of [
    ["front", [0, 0]],
    ["left", [-0.75, -0.4]],
    ["right", [0.85, 0.4]],
  ]) {
    await page.evaluate((p) => EmberCardRelief.pose(...p), pose);
    await card.screenshot({ path: path.join(out, `paladin-or-first-${name}.png`) });
  }
  expect(await faceDiff(page, [-1, 0], [1, 0])).toBeGreaterThan(3);
  // Tilt is mirrored onto the element so the DOM frame turns with the face.
  await page.evaluate(() => EmberCardRelief.pose(1, 0));
  expect(
    await card.evaluate((el) => el.style.getPropertyValue("--relief-ry")),
  ).toMatch(/^1\d\.\d+deg$/);
  await page.evaluate(() => EmberCardRelief.pose());

  // Every selectable hero has maps; switching re-mounts onto the new element.
  const ids = await page.evaluate(() => EmberData.heroes.map((h) => h.id));
  for (const id of ids) {
    await page.locator(`#modal [data-hero="${id}"]`).click();
    await expect(page.locator("#modal .scene-showcase")).toHaveClass(
      /card-relief-ready/,
    );
    await page.evaluate(() => EmberCardRelief.pose(0.8, 0.3));
    await page.screenshot({ path: path.join(out, `page-${id}.png`) });
    await page.evaluate(() => EmberCardRelief.pose());
  }
  expect(await page.locator(".card-relief-canvas").count()).toBe(1);
  expect(errors).toEqual([]);
});

test("reduced motion keeps the card flat and still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHeroes(page);
  await page.mouse.move(1500, 100);
  await page.waitForTimeout(400);
  const frames = (await page.evaluate(() => EmberCardRelief.diagnostics())).frames;
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => EmberCardRelief.diagnostics());
  expect(after.frames).toBe(frames);
  expect(
    await page
      .locator("#modal .scene-showcase")
      .evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry"))),
  ).toBe(0);
});

/* The relief canvas must be what the player sees, not merely be mounted: black out
 * the flat artwork underneath and check the card is still as bright as the canvas. */
async function expectReliefVisible(page, art) {
  await expect(art).toHaveClass(/card-relief-ready/);
  await expect(art.locator(".card-relief-canvas")).toHaveCSS("opacity", "1");
  await art.evaluate((el) => {
    const flat = el.querySelector("img");
    if (flat) flat.style.filter = "brightness(0)";
    else el.style.backgroundImage = "none";
  });
  // Decode the screenshot in the page: no image library is a declared dependency.
  // A clipped page shot: an element shot waits for the box to stop moving, and a
  // card in the hand never does.
  const clip = await art.boundingBox();
  const shot = (await page.screenshot({ clip })).toString("base64");
  const seen = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = "data:image/png;base64," + base64;
    await image.decode();
    const copy = document.createElement("canvas");
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const g = copy.getContext("2d");
    g.drawImage(image, 0, 0);
    const data = g.getImageData(0, 0, copy.width, copy.height).data;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
    return total / (data.length / 4) / 3;
  }, shot);
  const painted = await art.evaluate((el) => {
    const canvas = el.querySelector(".card-relief-canvas"),
      copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const g = copy.getContext("2d");
    EmberCardRelief.pose(0, 0);
    g.drawImage(canvas, 0, 0);
    EmberCardRelief.pose();
    const data = g.getImageData(0, 0, copy.width, copy.height).data;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
    return total / (data.length / 4) / 3;
  });
  expect(painted).toBeGreaterThan(12);
  expect(seen).toBeGreaterThan(painted * 0.5);
}

async function openBattle(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(
    () =>
      !EmberFX.busy &&
      EmberDebug.game.s?.phase === "battle" &&
      EmberDebug.game.s.active === "p",
    null,
    { timeout: 30000 },
  );
  return page.evaluate(() =>
    [...document.querySelectorAll("#hand .hand-card")].map((el) => {
      const box = el.getBoundingClientRect(),
        card = EmberData.byId[el.dataset.cardid];
      return {
        id: card.id,
        target: !!card.target,
        playable: !EmberDebug.game.legalCard("p", el.dataset.hand),
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
    }),
  );
}

test("hovered detail card faces the pointer over its hand card", async ({
  page,
}) => {
  const errors = errorsFor(page);
  const [first] = await openBattle(page);
  await page.mouse.move(first.x, first.y);
  const art = page.locator("#card-preview .card-art");
  await expectReliefVisible(page, art);
  await page.mouse.move(first.x + 30, first.y, { steps: 4 });
  await expect
    .poll(() =>
      page
        .locator("#card-preview > .card")
        .evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry"))),
    )
    .toBeGreaterThan(2);
  expect((await page.evaluate(() => EmberCardRelief.diagnostics())).id).toBe(
    first.id,
  );
  await page.mouse.move(800, 300);
  await expect(page.locator(".card-relief-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a lifted card leans into the drag and is handed back flat when played", async ({
  page,
}) => {
  const errors = errorsFor(page);
  const hand = await openBattle(page);
  const card = hand.find((c) => c.playable && !c.target);
  test.skip(!card, "opening hand has no untargeted playable card");
  await page.mouse.move(card.x, card.y);
  await page.mouse.down();
  await page.mouse.move(card.x + 30, card.y - 60, { steps: 4 });
  await expectReliefVisible(page, page.locator(".drag-ghost .card-art"));
  for (let i = 1; i <= 6; i++)
    await page.mouse.move(card.x + 30 + i * 45, card.y - 60);
  const lean = await page
    .locator(".drag-ghost > .card")
    .evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry")));
  expect(lean).toBeGreaterThan(3);
  await page.screenshot({ path: path.join(out, "battle-drag.png") });
  const before = await page.evaluate(() => EmberDebug.game.s.p.hand.length);
  // The player's own lane below the minion rows is the accepted landing area.
  await page.mouse.move(800, 620, { steps: 8 });
  await expect(page.locator(".drag-ghost")).toHaveClass(/is-snapped/);
  await page.mouse.up();
  // Nothing of the relief may leak into the card-motion proxy or the board.
  await expect(page.locator(".card-relief-canvas, .card-relief-tilt")).toHaveCount(0);
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberDebug.game.s.p.hand.length)).toBe(
    before - 1,
  );
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1600, height: 940 },
  { width: 1219, height: 829 }, // narrow window: touch layout driven by a mouse
])
  test(`a hand card held up to read turns toward the pointer ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    const errors = errorsFor(page);
    await page.setViewportSize(viewport);
    await openBattle(page);
    await page.locator("#hand .hand-card").nth(1).click();
    const lift = page.locator("#hand-card-lift");
    await expectReliefVisible(page, lift.locator(".card-art"));
    const box = await lift.boundingBox();
    const leanAt = async (fx) => {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height / 2, {
        steps: 5,
      });
      await page.waitForTimeout(450);
      return lift
        .locator("> .card")
        .evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry")));
    };
    expect(await leanAt(0.05)).toBeLessThan(-6);
    expect(await leanAt(0.95)).toBeGreaterThan(6);
    // Dragging out of the lift hands the relief over to the ghost, never two canvases.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y - 40, { steps: 5 });
    await expect(page.locator(".drag-ghost .card-art")).toHaveClass(
      /card-relief-ready/,
    );
    await expect(page.locator(".card-relief-canvas")).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator(".card-relief-canvas, .card-relief-tilt")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("a held card draws only when the picture changes", async ({ page }) => {
  await openBattle(page);
  await page.locator("#hand .hand-card").nth(1).click();
  await expect(page.locator("#hand-card-lift .card-art")).toHaveClass(
    /card-relief-ready/,
  );
  const paintsPerSecond = (ms) =>
    page.evaluate(async (ms) => {
      const before = EmberCardRelief.diagnostics().frames;
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ((EmberCardRelief.diagnostics().frames - before) * 1000) / ms;
    }, ms);
  // The idle sway is slow enough for half the display rate.
  await page.waitForTimeout(1300);
  const swaying = await paintsPerSecond(1500);
  expect(swaying).toBeGreaterThan(20);
  expect(swaying).toBeLessThan(36);
  // The hand was already uploaded while idle, so another card is up within two frames.
  await page.locator("#hand-card-lift").click();
  const elapsed = await page.evaluate(async () => {
    const started = performance.now();
    document.querySelectorAll("#hand .hand-card")[2].click();
    while (!document.querySelector("#hand-card-lift .card-relief-ready"))
      await new Promise(requestAnimationFrame);
    return performance.now() - started;
  });
  expect(elapsed).toBeLessThan(80);
});

test("the god stage's front card carries the relief and keeps the stage's own tilt", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await openBattle(page);
  await page.locator("#contract-open").click();
  const art = page.locator("#god-stage .god-card-front .card-art").first();
  await page.waitForTimeout(900); // entrance flight
  await expectReliefVisible(page, art);
  const state = await page.evaluate(() => EmberCardRelief.diagnostics());
  expect(state.steer).toBe("follow");
  expect(state.id).toBe(
    await page.evaluate(() => document.querySelector("#god-stage .card-relief-canvas").closest(".god-card").dataset.cid),
  );
  // The stage tilts the card; the relief must not add a second transform to it.
  await expect(page.locator(".card-relief-tilt")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#god-stage .card-relief-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* One rule for every screen: a card singled out in front of the player is in relief;
 * cards shown in rows stay flat until the player attends to one of them. */
const leanOf = (card) =>
  card.evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry")));

test("opening hand: the attended card is in relief and keeps it through a toggle", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#start-btn").click();
  await page.locator(".hero-mode-cards [data-mode=practice]").click();
  await page.locator("#hero-confirm").click();
  const cards = page.locator(".mulligan-card");
  await cards.first().waitFor();
  await cards.nth(1).hover();
  await expectReliefVisible(page, cards.nth(1).locator(".card-art"));
  const box = await cards.nth(1).boundingBox();
  await page.mouse.move(box.x + box.width * 0.92, box.y + box.height / 2, { steps: 4 });
  await expect.poll(() => leanOf(cards.nth(1).locator("> .card"))).toBeGreaterThan(5);
  // Toggling redraws the whole row; the same card must come back in relief.
  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveClass(/replace/);
  await expect(cards.nth(1).locator(".card-art")).toHaveClass(/card-relief-ready/);
  await cards.nth(2).hover();
  await expect(cards.nth(2).locator(".card-art")).toHaveClass(/card-relief-ready/);
  await expect(page.locator(".card-relief-canvas")).toHaveCount(1);
  await page.locator("#mulligan-confirm").click();
  await expect(page.locator("#modal .card-relief-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("discover: the attended choice is in relief", async ({ page }) => {
  const errors = errorsFor(page);
  await openBattle(page);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.choice = { side: "p", cards: ["spark", "frostbolt", "fireball"] };
    g.emit();
  });
  const choices = page.locator("[data-discover]");
  await choices.first().waitFor();
  await choices.nth(2).hover();
  await expectReliefVisible(page, choices.nth(2).locator(".card-art"));
  expect((await page.evaluate(() => EmberCardRelief.diagnostics())).id).toBe("fireball");
  await choices.nth(2).click();
  await expect(page.locator("#modal .card-relief-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("library: the detail card is in relief, the grid stays flat", async ({ page }) => {
  const errors = errorsFor(page);
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#lobby-library-btn").click();
  await page.locator(".library-item").first().waitFor();
  await expect(page.locator(".library-item .card-relief-canvas")).toHaveCount(0);
  await page.locator("[data-library-inspect]").first().click();
  const card = page.locator("#modal .card-detail-art > .card");
  await expectReliefVisible(page, card.locator(".card-art"));
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width * 0.08, box.y + box.height / 2, { steps: 4 });
  await expect.poll(() => leanOf(card)).toBeLessThan(-5);
  await page.locator("#library-detail-back").click();
  await expect(page.locator(".library-item .card-relief-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});
