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

/* A card with live artwork shows it instead of the relief face: black out the flat
 * artwork underneath and check the art window is still lit by the canvas. */
async function expectLiveVisible(page, art) {
  await expect(art).toHaveClass(/live-art-ready/);
  await expect(art.locator(".live-art-canvas")).toHaveCSS("opacity", "1");
  await expect(art.locator(".card-relief-canvas")).toHaveCount(0);
  await art.evaluate((el) => (el.querySelector("img").style.filter = "brightness(0)"));
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
  expect(seen).toBeGreaterThan(25);
  await art.evaluate((el) => (el.querySelector("img").style.filter = ""));
}

test("the god stage's front card carries its live artwork (or relief) and keeps the stage's own tilt", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await openBattle(page);
  await page.locator("#contract-open").click();
  const art = page.locator("#god-stage .god-card-front .card-art").first();
  await page.waitForTimeout(900); // entrance flight
  const id = await page.evaluate(() => document.querySelector("#god-stage .god-card.focused").dataset.cid);
  const live = await page.evaluate((id) => !!EmberLiveArtMaps[id], id);
  if (live) {
    await expectLiveVisible(page, page.locator("#god-stage .god-card.focused .card-art"));
    expect((await page.evaluate(() => EmberLiveArt.diagnostics())).id).toBe(id);
  } else await expectReliefVisible(page, art);
  const state = await page.evaluate(() => EmberCardRelief.diagnostics());
  expect(state.steer).toBe("follow");
  expect(state.id).toBe(id);
  // The stage tilts the card; the relief must not add a second transform to it.
  await expect(page.locator(".card-relief-tilt")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#god-stage .card-relief-canvas, #god-stage .live-art-canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("library: a card with live artwork flies up alive, then lets go when the stage closes", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#lobby-library-btn").click();
  for (const id of ["nyx", "frostking", "ashdragon", "storm"]) {
    await page.evaluate((id) => {
      const item = document.querySelector(`[data-library-inspect="${id}"]`);
      item.scrollIntoView({ block: "center" });
      item.click();
    }, id);
    await expect(page.locator("#card-stage.flying")).toHaveCount(0);
    await expectLiveVisible(page, page.locator("#card-stage .card-art"));
    expect((await page.evaluate(() => EmberLiveArt.diagnostics())).id).toBe(id);
    await page.keyboard.press("Escape");
    await expect(page.locator(".live-art-canvas")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("a card turning over on the god stage shows its thickness as a side", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await openBattle(page);
  // Timers stand still from here, so the stage never declares its flight over.
  await page.clock.install();
  await page.locator("#contract-open").click();
  await page.waitForSelector("#god-stage.flying");
  await holdFlight(page, "#god-stage", 0.2);
  const front = page.locator("#god-stage .god-card-front .card").first();
  await expect(front).toHaveClass(/card-relief-slabbed/);
  // Real depth, in the page and not flattened away by a filter on the card (rare
  // and better cards carry one in the legacy sheet): the back of the slab is well
  // to the left of the face, not on top of it.
  const side = await slabSide(front);
  expect(side.layers).toBeGreaterThan(12);
  expect(side.left).toBeGreaterThan(6);
  // The card's back is seated that same depth behind its face.
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.querySelector("#god-stage .god-card-back")).transform,
    ),
  ).toMatch(/-[1-3][0-9](\.\d+)?, 1\)$/);
  expect(errors).toEqual([]);
});

/* How many pixels of the slab's side show past the card face, per side. The slab is
 * wider than the face by its painted edge (`--relief-flange`), which is not side. */
const slabSide = (card) =>
  card.evaluate((el) => {
    const face = el.querySelector(".card-inner").getBoundingClientRect();
    const layers = [...el.querySelectorAll(":scope > .card-relief-slab")];
    const back = layers.at(-1)?.getBoundingClientRect(),
      flange = parseFloat(el.style.getPropertyValue("--relief-flange")) || 0;
    return back
      ? {
          layers: layers.length,
          left: face.left - back.left - flange,
          right: back.right - face.right - flange,
        }
      : { layers: 0, left: 0, right: 0 };
  });

/* Hold every animation of a stage's entrance flight at a fraction of its run. A
 * fifth of the way in, the card is turned about 57° from face-on, its left edge
 * toward the viewer. */
const holdFlight = (page, stage, fraction) =>
  page.evaluate(
    ([stage, fraction]) => {
      for (const a of document.getAnimations()) {
        if (!a.effect?.target?.closest?.(stage)) continue;
        const t = a.effect.getComputedTiming();
        a.pause();
        a.currentTime = (t.delay || 0) + t.duration * fraction;
      }
    },
    [stage, fraction],
  );

/* One rule for every screen: a card singled out in front of the player is in relief;
 * cards shown in rows stay flat until the player attends to one of them. */
const leanOf = (card) =>
  card.evaluate((el) => parseFloat(el.style.getPropertyValue("--relief-ry")));

test("opening hand: the cards are still — no relief, no lean, a click still toggles", async ({
  page,
}) => {
  // 2026-09-22: the opening hand is a decision, not a showcase; the three
  // cards neither rise nor turn under the pointer.
  const errors = errorsFor(page);
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#start-btn").click();
  await page.locator(".hero-mode-cards [data-mode=practice]").click();
  await page.locator("#hero-confirm").click();
  const cards = page.locator(".mulligan-card");
  await cards.first().waitFor();
  await cards.nth(1).hover();
  const box = await cards.nth(1).boundingBox();
  await page.mouse.move(box.x + box.width * 0.92, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(300);
  expect((await leanOf(cards.nth(1).locator("> .card"))) || 0).toBeLessThan(1);
  await expect(page.locator("#modal .card-relief-canvas")).toHaveCount(0);
  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveClass(/replace/);
  await page.locator("#mulligan-confirm").click();
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

test("library: a clicked card flies up onto the stage in relief; the grid stays flat", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#lobby-library-btn").click();
  await page.locator(".library-entry").first().waitFor();
  await expect(page.locator(".library-item .card-relief-canvas")).toHaveCount(0);
  // Make room for two copies of a card the deck does not hold yet.
  await page.locator("[data-remove]").first().click();
  await page.locator("[data-remove]").first().click();
  // Pin the entry by card id: a locator filtered on the count would move on as it changes.
  const id = await page
    .locator(".library-entry")
    .filter({ has: page.locator(".owned-count", { hasText: /^0 \/ 2/ }) })
    .first()
    .locator(".library-item")
    .getAttribute("data-library-inspect");
  const entry = page
    .locator(".library-entry")
    .filter({ has: page.locator(`[data-library-inspect="${id}"]`) });
  // The pill under a card still adds it in one click.
  await entry.locator("[data-add]").click();
  await expect(entry.locator(".owned-count")).toHaveText(/^1 \//);
  // The card itself is taken out of the grid and turned over onto the stage. Timers
  // stand still while the flight is held part-way, so the stage's own "flight over"
  // timeout waits with it.
  await page.clock.install();
  await entry.locator(".library-item").click();
  const stage = page.locator("#card-stage");
  await expect(stage).toHaveClass(/flying/);
  const front = stage.locator(".god-card-front .card");
  await holdFlight(page, "#card-stage", 0.2);
  // Turned about 57°, the card shows its thickness as a side (see the god stage test).
  expect((await slabSide(front)).left).toBeGreaterThan(6);
  await page.evaluate(() =>
    document.getAnimations().forEach((a) => a.effect?.target?.closest?.("#card-stage") && a.finish()),
  );
  await page.clock.runFor(1000);
  await expectReliefVisible(page, front.locator(".card-art"));
  const box = await stage.locator(".god-card").boundingBox();
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2, { steps: 4 });
  // The stage's own lean steers the relief face.
  await expect.poll(() => page.evaluate(() => EmberCardRelief.diagnostics().steer)).toBe("follow");
  await stage.locator("#library-detail-add").click();
  await expect(stage.locator(".card-stage-count")).toContainText("已加入 2");
  await expect(entry.locator(".owned-count")).toHaveText(/^2 \//);
  await page.keyboard.press("Escape");
  await expect(stage).toHaveCount(0);
  await expect(page.locator("#modal")).toHaveAttribute("data-type", "library");
  expect(errors).toEqual([]);
});

test("a held card has thickness, and sinks back when the player puts it down", async ({
  page,
}) => {
  const errors = errorsFor(page);
  await openBattle(page);
  // Unaffordable, so a tap on the table puts the card back instead of playing it.
  await page.evaluate(() => {
    EmberDebug.game.s.p.mana = 0;
    EmberDebug.game.emit();
  });
  await page.locator("#hand .hand-card").nth(1).click();
  const lift = page.locator("#hand-card-lift");
  await expect(lift.locator(".card-art")).toHaveClass(/card-relief-ready/);
  const card = lift.locator("> .card");
  const box = await lift.boundingBox();
  // A real stack of layers behind the face: turned to the right the slab shows its
  // left side, turned to the left its right side, and face-on neither. A held card
  // leans about 18°, so what shows is a sliver (12px × sin 18°, less what the
  // perspective takes off the deeper layers — about 2px), never a ring.
  expect((await slabSide(card)).layers).toBeGreaterThan(8);
  await page.mouse.move(box.x + box.width * 0.98, box.y + box.height / 2, { steps: 4 });
  await expect.poll(async () => (await slabSide(card)).left).toBeGreaterThan(1.2);
  expect((await slabSide(card)).right).toBeLessThan(0);
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height / 2, { steps: 4 });
  await expect.poll(async () => (await slabSide(card)).right).toBeGreaterThan(1.2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await expect
    .poll(async () => Math.max((await slabSide(card)).left, (await slabSide(card)).right))
    .toBeLessThan(0.5);

  // Record the lift's opacity every frame across the dismissal.
  await page.evaluate(() => {
    window.__fade = [];
    const tick = () => {
      const el = document.getElementById("hand-card-lift");
      window.__fade.push(el ? +getComputedStyle(el).opacity : null);
      if (window.__fade.length < 40) requestAnimationFrame(tick);
    };
    tick();
  });
  const arena = await page.locator("#arena").boundingBox();
  await page.mouse.click(arena.x + arena.width * 0.85, arena.y + arena.height * 0.75);
  await expect(lift).toHaveCount(0);
  const fade = await page.evaluate(() => window.__fade);
  // It must pass through partial opacity: gone in one frame is the bug this guards.
  expect(fade.some((o) => o !== null && o > 0.05 && o < 0.95)).toBe(true);
  expect(errors).toEqual([]);
});
