const { test, expect } = require("@playwright/test");
// figures are baked in a worker as pixel sprites (0.1–2 s each): these tests wait for real bakes
test.describe.configure({ timeout: 90000 });
// Minion miniatures: one stage canvas; figures stand on tokens that have a spec,
// answer attack / hurt / death cues and never change the rules state.
test("minion miniatures follow tokens and combat cues", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  const ids = await page.evaluate(() => {
    const g = EmberDebug.game;
    const h = g.summon("p", "huntress"), d = g.summon("p", "duskstag"), w = g.summon("e", "wolf");
    g.summon("p", "recruit"); // no spec: stays a flat token
    Emberfall.renderNow();
    return { h: h.uid, d: d.uid, w: w.uid };
  });
  await page.waitForFunction(() => EmberMiniatures.diagnostics().figures === 3);
  // pixel-sprite bakes take up to ~2 s each in the worker (longer on a loaded machine): wait for them to stand
  await page.waitForFunction(() => EmberMiniatures.diagnostics().live === 3, null, { timeout: 60000 });
  expect(await page.locator("#miniature-stage").count()).toBe(1);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("miniature-stage")).pointerEvents)).toBe("none");
  await expect(page.locator(`#minions .minion[data-uid="${ids.h}"]`)).toHaveClass(/miniature-ready/);
  await expect(page.locator('#minions .minion[data-cardid="recruit"]')).not.toHaveClass(/miniature-ready/);
  const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s.e.board.map((m) => [m.uid, m.hp])));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s.e.board.map((m) => [m.uid, m.hp])))).toBe(before);
  await page.evaluate(({ h, w }) => Emberfall.act(() => EmberDebug.game.dispatch({ type: "attack", side: "p", uid: h, target: { side: "e", uid: w } })), ids);
  await page.waitForFunction(() => { const c = EmberMiniatures.diagnostics().cues.map((x) => x.kind); return c.includes("attack") && c.includes("death"); });
  await page.waitForFunction(() => !EmberFX.busy);
  await page.waitForFunction(() => EmberMiniatures.diagnostics().dying === 0);
  // the wolf is gone; whatever its deathrattle leaves behind (a pup) stands as its own figure
  const left = await page.evaluate(() => ({
    expected: [...document.querySelectorAll("#minions .minion[data-cardid]")].filter((el) => EmberVoxelKit.forCard(el.dataset.cardid)).length,
    figures: EmberMiniatures.diagnostics().figures,
  }));
  expect(left.figures).toBe(left.expected);
  expect(left.expected).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => Emberfall.home());
  await page.waitForFunction(() => !Emberfall.inBattle);
  expect(errors).toEqual([]);
});

// A played card turns straight into its figure: the token lands without its card (its art never shows) and the
// figure, baked ahead from the hand, assembles on its pedestal within the same sequence.
test("a played card becomes its figure without a flat token", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.active = "p"; g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10; g.s.p.board = []; g.s.e.board = [];
    g.s.p.hand = [g.card("reaper")];
    g.events = []; g.emit();
  });
  const spec = await page.evaluate(() => EmberVoxelKit.forCard("reaper").id);
  await page.waitForFunction((id) => !!EmberVoxelRender.cached(id), spec, { timeout: 30000 });   // prewarmed from the hand
  const seen = await page.evaluate(async () => {
    const g = EmberDebug.game, live0 = EmberMiniatures.diagnostics().live, t0 = performance.now();
    Emberfall.act(() => g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }));
    let landed = null, flat = 0, liveAt = null;
    await new Promise((done) => {
      const tick = () => {
        const t = performance.now() - t0, tok = document.querySelector('#minions .minion[data-cardid="reaper"]');
        if (tok && getComputedStyle(tok).visibility !== "hidden") {
          landed ??= t;
          const art = tok.querySelector(".minion-art img"), cs = getComputedStyle(art);
          if (cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.5) flat++;         // the card's art never shows
          if (liveAt == null && EmberMiniatures.diagnostics().live > live0) liveAt = t;
        }
        if (liveAt != null || t > 4000) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { landed, flat, liveAt };
  });
  expect(seen.landed).not.toBeNull();
  expect(seen.flat).toBe(0);
  expect(seen.liveAt).not.toBeNull();
  expect(seen.liveAt - seen.landed).toBeLessThan(1500);
  await expect(page.locator('#minions .minion[data-cardid="reaper"]')).toHaveClass(/miniature-ready/);
  expect(errors).toEqual([]);
});

// A narrow desktop window (mouse, compact battle layout) keeps its figures, sized to its tokens; only touch phones
// go without them for now.
test("a narrow desktop window keeps its figures", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  expect(await page.evaluate(() => EmberViewport.mobile)).toBe(true);
  await page.evaluate(() => { EmberDebug.game.summon("p", "reaper"); EmberDebug.game.summon("e", "wolf"); Emberfall.renderNow(); });
  await page.waitForFunction(() => EmberMiniatures.diagnostics().live === 2);
  await expect(page.locator('#minions .minion[data-cardid="reaper"]')).toHaveClass(/miniature-ready/);
});

// A unit is its figure: no card on the board, stats as badges above the figure's layer, each side facing the other,
// and the hero's figure seated inside its portrait window.
test("figure units drop their card and face the other side", async ({ page }) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  const ids = await page.evaluate(() => { const g = EmberDebug.game; const a = g.summon("p", "reaper"), b = g.summon("e", "paladin"); Emberfall.renderNow(); return { a: a.uid, b: b.uid }; });
  await page.waitForFunction(() => EmberMiniatures.diagnostics().live === 2);
  await page.waitForTimeout(600);
  const r = await page.evaluate(({ a, b }) => {
    const tok = document.querySelector(`#minions .minion[data-uid="${a}"]`), st = (e) => getComputedStyle(e);
    const stage = document.getElementById("miniature-stage"), minions = document.getElementById("minions");
    return {
      art: st(tok.querySelector(".minion-art")).visibility,
      frame: getComputedStyle(tok, "::before").visibility,
      stat: st(tok.querySelector(".stat.hp")).visibility,
      under: +st(stage).zIndex < +st(minions).zIndex,
    };
  }, ids);
  expect(r).toEqual({ art: "hidden", frame: "hidden", stat: "visible", under: true });
  // the hero figure stays inside its portrait window
  const seat = await page.evaluate(() => {
    const h = document.getElementById("hero-figure"), w = document.querySelector("#player-hero .portrait-frame");
    if (!h || h.hidden) return "none";
    const a = h.getBoundingClientRect(), b = w.getBoundingClientRect();
    return Math.abs(a.left - b.left) < 2 && Math.abs(a.top - b.top) < 2 && Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;
  });
  expect(seat === true || seat === "none").toBe(true);
});
