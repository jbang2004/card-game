/* BATTLE_PRESENTATION_V2 §5.1 — causal presentation matrix.
 *
 * Every path-type presentation recorded in EmberFX.trace must start inside
 * its actor's visible card, end inside a target's card, use only units of the
 * dispatched action, show its numbers within 34ms of the planned contact, keep
 * single-target contacts within 1.25× the target box and leave no effect
 * nodes 250ms after the sequence. "A fireball launched from the enemy hero"
 * fails the actor-box assertion on both layouts. */
const { test, expect } = require("@playwright/test");

const LAYOUTS = [
  { name: "desktop", viewport: { width: 1600, height: 940 }, mobile: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, mobile: true },
];
const PATH_TYPES = new Set(["cast", "power", "battlecry", "attack", "play"]);

/* Scenario setup runs in the page. `X` acts, `O` is the opponent. Returns the
 * action to dispatch; the board is rebuilt from scratch each time. */
const SCENARIOS = {
  melee: `const a = g.summon(X, "guard", { sick: false }); const t = g.summon(O, "treant", { sick: false });
    return { type: "attack", side: X, uid: a.uid, target: { side: O, uid: t.uid } };`,
  ranged: `const a = g.summon(X, "archer", { sick: false });
    return { type: "attack", side: X, uid: a.uid, target: { side: O, uid: "hero" } };`,
  heroWeapon: `g.s[X].weapon = { cid: "sunblade", atk: 4, durability: 2, tags: [] }; g.s[X].attacks = 0;
    const t = g.summon(O, "treant", { sick: false });
    return { type: "attack", side: X, uid: "hero", target: { side: O, uid: t.uid } };`,
  projectileSpell: `const w = g.summon(O, "wolf"); g.summon(O, "treant"); const c = hand("fireball");
    return { type: "play", side: X, uid: c.uid, target: { side: O, uid: w.uid } };`,
  linkSpell: `const t = g.summon(O, "treant"); g.summon(O, "wolf"); const c = hand("silence");
    return { type: "play", side: X, uid: c.uid, target: { side: O, uid: t.uid } };`,
  aoeSpell: `for (let i = 0; i < 3; i++) g.summon(O, "treant"); const c = hand("storm");
    return { type: "play", side: X, uid: c.uid };`,
  heal: `g.s[X].hp = 12; const c = hand("renew");
    return { type: "play", side: X, uid: c.uid };`,
  heroPower: `if (X === "p") g.s.heroId = "mage"; else if (g.s.mode === "practice") g.s.opponentHero = "mage"; else g.s.bossIndex = 0;
    g.s[X].powerUsed = false; g.summon(O, "treant");
    const def = g.powerDefinition(X);
    return { type: "power", side: X, target: def.target ? { side: O, uid: "hero" } : undefined };`,
  battlecry: `g.summon(O, "treant"); const c = hand("spark");
    return { type: "play", side: X, uid: c.uid };`,
  deathrattle: `const fox = g.summon(O, "moonfox"); g.s[O].hp = 10; const c = hand("fireball");
    return { type: "play", side: X, uid: c.uid, target: { side: O, uid: fox.uid } };`,
  fatigue: `g.s[X].deck = []; g.s[X].fatigue = 2; const c = hand("renew");
    return { type: "play", side: X, uid: c.uid };`,
  counterSecret: `g.s[O].secrets = ["counterspell"]; const c = hand("fireball");
    return { type: "play", side: X, uid: c.uid, target: { side: O, uid: "hero" } };`,
};

async function open(browser, layout) {
  const context = await browser.newContext({
    viewport: layout.viewport,
    isMobile: layout.mobile,
    hasTouch: layout.mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  // The AI must not act between our dispatch and the assertions.
  await page.evaluate(() => {
    EmberDebug.game.aiStep = () => ({ ok: true });
  });
  return { context, page, errors };
}

async function run(page, name, side) {
  return page.evaluate(
    async ({ code, side }) => {
      const g = EmberDebug.game;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      EmberFX.cancel(true);
      await wait(30);
      let X = side,
        O = side === "p" ? "e" : "p";
      Object.assign(g.s, { phase: "battle", active: X, choice: null });
      for (const s of ["p", "e"]) {
        Object.assign(g.s[s], {
          board: [],
          secrets: [],
          hp: 30,
          maxHp: 30,
          armor: 0,
          mana: 10,
          maxMana: 10,
          powerUsed: false,
          weapon: null,
          frozen: false,
        });
      }
      const hand = (id) => {
        const card = g.card(id);
        g.s[X].hand = [card];
        return card;
      };
      const action = new Function("g", "X", "O", "hand", code)(g, X, O, hand);
      const actingSide = action.side;
      g.s.active = actingSide;
      g.events = [];
      g.emit();
      await new Promise((resolve) => {
        const f = () => (EmberFX.busy ? setTimeout(f, 20) : resolve());
        f();
      });
      await wait(60);
      const face = (s) =>
        EmberViewport.pos(
          document
            .getElementById(s === "p" ? "player-hero" : "enemy-hero")
            .querySelector(".hero-card-inner"),
        );
      const boxes = { hero: { p: face("p"), e: face("e") }, units: {} };
      for (const el of document.querySelectorAll("#battle .minion[data-uid]"))
        boxes.units[el.dataset.side + el.dataset.uid] = EmberViewport.pos(el);
      const lastSeq = EmberFX.trace.at(-1)?.seq ?? 0;
      const started = performance.now();
      const result = Emberfall.act(() => g.dispatch(action));
      if (!result.ok) return { error: result.error };
      const revealRects = [];
      const probe = setInterval(() => {
        for (const el of document.querySelectorAll(".cast-card")) {
          const r = EmberViewport.pos(el);
          if (r) revealRects.push(r);
        }
      }, 30);
      await new Promise((resolve) => {
        const f = () => (EmberFX.busy ? setTimeout(f, 10) : resolve());
        f();
      });
      const ended = performance.now();
      clearInterval(probe);
      const records = EmberFX.trace.filter((r) => r.seq > lastSeq);
      const sequence = records[0]?.sequence ?? null;
      const refs = new Set();
      for (const e of result.events) {
        if (e.side && e.uid) refs.add(e.side + e.uid);
        if (e.from) refs.add(e.from.side + e.from.uid);
        if (e.to) refs.add(e.to.side + e.to.uid);
        if (["play", "power", "secret"].includes(e.type)) refs.add(e.side + "hero");
        for (const d of e.departures || []) refs.add(d.side + d.uid);
      }
      await wait(260);
      const stats = typeof EmberFx2 !== "undefined" ? EmberFx2.stats : null;
      return {
        actingSide,
        sequence,
        records: records.filter((r) => r.sequence === sequence),
        refs: [...refs],
        boxes,
        started,
        ended,
        revealRects,
        residue: document.querySelectorAll(
          ".attack-actor,.attack-host,.death-ghost,.card-motion-proxy",
        ).length,
        fxActive: stats ? stats.effects + stats.particles : 0,
        events: result.events.map((e) => ({
          type: e.type,
          side: e.side,
          uid: e.uid,
          loss: e.loss ?? e.amount,
        })),
      };
    },
    { code: SCENARIOS[name], side },
  );
}

const inside = (p, box, slack = 1) =>
  !!p &&
  !!box &&
  Math.abs(p.x - box.x) <= box.w / 2 + slack &&
  Math.abs(p.y - box.y) <= box.h / 2 + slack;
const sameBox = (a, b, slack = 3) =>
  !!a &&
  !!b &&
  Math.abs(a.x - b.x) <= slack &&
  Math.abs(a.y - b.y) <= slack &&
  Math.abs(a.w - b.w) <= slack &&
  Math.abs(a.h - b.h) <= slack;
function segmentHitsRect(a, b, r) {
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps,
      y = a.y + ((b.y - a.y) * i) / steps;
    if (x > r.left && x < r.left + r.w && y > r.top && y < r.top + r.h)
      return true;
  }
  return false;
}

function assertCausal(label, out) {
  expect(out.error, label).toBeUndefined();
  const { records, refs, boxes, actingSide } = out;
  expect(records.length, label + " wrote trace records").toBeGreaterThan(0);
  expect(
    records.filter((r) => r.type === "warn").map((r) => r.kind),
    label + " anchors",
  ).toEqual([]);
  const known = new Set(refs);
  for (const r of records) {
    const tag = `${label} #${r.seq} ${r.type}:${r.kind}`;
    if (r.actor) {
      if (r.type !== "play")
        expect(known.has(r.actor.side + r.actor.uid), tag + " actor in block").toBe(true);
    }
    for (const t of r.targets)
      expect(known.has(t.side + t.uid), tag + " target in block").toBe(true);
    if (PATH_TYPES.has(r.type) && r.from) {
      expect(r.actor?.box, tag + " actor box").toBeTruthy();
      expect(inside(r.from, r.actor.box), tag + " path starts in actor").toBe(true);
      r.to.forEach((to, i) => {
        if (!to) return;
        expect(
          r.targets.some((t) => inside(to, t.box)),
          tag + ` path ${i} ends in a target`,
        ).toBe(true);
      });
    }
    // Hero actors must be the acting side's own hero CARD, as laid out now.
    if (r.actor?.uid === "hero" && ["cast", "power"].includes(r.type)) {
      expect(r.actor.side, tag + " caster side").toBe(actingSide);
      expect(sameBox(r.actor.box, boxes.hero[r.actor.side]), tag + " caster is the hero card").toBe(true);
    }
    if (r.type === "attack" && r.actor.uid !== "hero")
      expect(sameBox(r.actor.box, boxes.units[r.actor.side + r.actor.uid]), tag + " attacker box").toBe(true);
    r.numberAt.forEach((at, i) => {
      if (at === null || at === undefined) return;
      expect(Math.abs(at - r.hitAt[i]), tag + ` number ${i} in sync`).toBeLessThanOrEqual(34);
    });
    r.contactBox.forEach((cb, i) => {
      const t = r.targets[i]?.box;
      if (!cb || !t) return;
      if (r.aoe) {
        const all = r.targets.map((x) => x.box).filter(Boolean),
          left = Math.min(...all.map((b) => b.left)) - 24,
          right = Math.max(...all.map((b) => b.left + b.w)) + 24,
          top = Math.min(...all.map((b) => b.top)) - 24,
          bottom = Math.max(...all.map((b) => b.top + b.h)) + 24;
        expect(cb.left >= left - 1 && cb.left + cb.w <= right + 1, tag + " aoe x").toBe(true);
        expect(cb.top >= top - 1 && cb.top + cb.h <= bottom + 1, tag + " aoe y").toBe(true);
      } else {
        expect(cb.w, tag + " contact width").toBeLessThanOrEqual(t.w * 1.25 + 1);
        expect(cb.h, tag + " contact height").toBeLessThanOrEqual(t.h * 1.25 + 1);
      }
    });
  }
  // Every damaged unit of a path presentation received its number in sync.
  for (const r of records.filter((x) => ["cast", "power", "battlecry", "attack"].includes(x.type)))
    r.targets.forEach((t, i) => {
      const hit = out.events.find((e) => e.type === "damage" && e.side === t.side && e.uid === t.uid && e.loss > 0);
      if (hit) expect(r.numberAt[i], `${label} #${r.seq} number for ${t.side}${t.uid}`).not.toBeNull();
    });
  // Enemy reveal never sits on the cast path.
  for (const r of records.filter((x) => x.type === "cast" && x.actor?.side === "e" && x.from))
    for (const rect of out.revealRects)
      for (const to of r.to.filter(Boolean))
        expect(segmentHitsRect(r.from, to, rect), label + " reveal clear of path").toBe(false);
  expect(out.residue, label + " residue 250ms after the sequence").toBe(0);
  expect(out.fxActive, label + " effect layer idle").toBe(0);
}

for (const layout of LAYOUTS)
  test(`presentation causality matrix · ${layout.name}`, async ({ browser }) => {
    test.setTimeout(180000);
    const { context, page, errors } = await open(browser, layout);
    for (const side of ["p", "e"])
      for (const name of Object.keys(SCENARIOS)) {
        const label = `${layout.name}/${side}/${name}`;
        const out = await run(page, name, side);
        assertCausal(label, out);
        const types = out.records.map((r) => r.type);
        if (["melee", "ranged", "heroWeapon"].includes(name))
          expect(types, label).toContain("attack");
        if (["projectileSpell", "linkSpell", "aoeSpell", "heal"].includes(name))
          expect(types, label).toContain("cast");
        if (name === "heroPower") expect(types, label).toContain("power");
        if (name === "battlecry") expect(types, label).toContain("battlecry");
        if (name === "deathrattle") {
          const heal = out.records.find((r) => r.type === "contact" && r.kind === "heal");
          expect(heal, label + " deathrattle heal is a source-less contact").toBeTruthy();
          expect(heal.actor).toBeNull();
        }
        if (name === "fatigue") {
          const hit = out.records.find((r) => r.type === "contact" && r.kind === "damage");
          expect(hit, label + " fatigue is a source-less contact").toBeTruthy();
          const cast = out.records.find((r) => r.type === "cast");
          expect(cast.targets.some((t) => t.uid === "hero" && t.side === side), label + " fatigue is not on the spell path").toBe(false);
        }
        if (name === "counterSecret") {
          const cast = out.records.find((r) => r.type === "cast"),
            secret = out.records.find((r) => r.type === "secret");
          expect(cast.countered, label).toBe(true);
          expect(cast.targets, label + " countered spell has no targets").toEqual([]);
          expect(secret.actor.side, label).toBe(side === "p" ? "e" : "p");
          expect(secret.targets.map((t) => t.side + t.uid), label).toEqual([side + "hero"]);
        }
        if (name === "projectileSpell") {
          // The canonical failure: the fireball must leave the caster's own card.
          const cast = out.records.find((r) => r.type === "cast");
          expect(cast.actor.side, label).toBe(side);
          expect(inside(cast.from, out.boxes.hero[side]), label + " fireball starts in own hero card").toBe(true);
          expect(inside(cast.from, out.boxes.hero[side === "p" ? "e" : "p"]), label).toBe(false);
        }
      }
    // The trace stays bounded however long a session runs.
    expect(await page.evaluate(() => EmberFX.trace.length)).toBeLessThanOrEqual(200);
    expect(errors).toEqual([]);
    await context.close();
  });

/* The contact beat of an enemy action re-renders the board. After a real end
 * of turn that render used to force a style recalc per portrait (plus hand
 * scroll and chip reflows), pushing numbers ~50–70ms past the planned contact.
 * The AI dispatches through game.dispatch (not Emberfall.act), so do the same. */
for (const layout of LAYOUTS)
  test(`enemy turn after a real end of turn keeps numbers on the contact · ${layout.name}`, async ({ browser }) => {
    test.setTimeout(90000);
    const { context, page, errors } = await open(browser, layout);
    const out = await page.evaluate(async () => {
      const g = EmberDebug.game;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const idle = () => new Promise((r) => { const f = () => (EmberFX.busy ? setTimeout(f, 10) : r()); f(); });
      EmberFX.cancel(true);
      await wait(30);
      Object.assign(g.s, { phase: "battle", active: "p", choice: null });
      for (const s of ["p", "e"])
        Object.assign(g.s[s], { board: [], secrets: [], hp: 30, maxHp: 30, armor: 0, mana: 10, maxMana: 10, powerUsed: false, weapon: null, frozen: false });
      for (const id of ["guard", "wolf", "golem"]) g.summon("p", id, { sick: false });
      for (const id of ["berserker", "treant", "golem"]) g.summon("e", id, { sick: false }).sick = false;
      g.events = [];
      g.emit();
      await idle();
      await wait(200);
      const result = Emberfall.act(() => g.dispatch({ type: "end", side: "p" }));
      if (!result.ok) return { error: result.error };
      await idle();
      await wait(300);
      const first = EmberFX.trace.at(-1)?.seq ?? 0;
      const actions = [];
      g.s.e.board.forEach((m) => { m.sick = false; m.attacks = 0; });
      actions.push(g.dispatch({ type: "attack", side: "e", uid: g.s.e.board[0].uid, target: { side: "p", uid: g.s.p.board[0].uid } }));
      await idle();
      await wait(200);
      const fireball = g.card("fireball");
      g.s.e.hand = [fireball];
      g.s.e.mana = 10;
      actions.push(g.dispatch({ type: "play", side: "e", uid: fireball.uid, target: { side: "p", uid: g.s.p.board.at(-1).uid } }));
      await idle();
      await wait(200);
      return {
        active: g.s.active,
        actions: actions.map((a) => a.ok),
        records: EmberFX.trace
          .filter((r) => r.seq > first && r.type !== "warn")
          .map((r) => ({ seq: r.seq, type: r.type, kind: r.kind, side: r.actor?.side ?? null, hitAt: r.hitAt, numberAt: r.numberAt })),
        warns: EmberFX.trace.filter((r) => r.seq > first && r.type === "warn").map((r) => r.kind),
      };
    });
    expect(out.error).toBeUndefined();
    expect(out.active, "still the enemy's turn").toBe("e");
    expect(out.actions).toEqual([true, true]);
    expect(out.warns).toEqual([]);
    const timed = out.records.flatMap((r) =>
      r.hitAt.map((hit, i) => ({ tag: `${layout.name} #${r.seq} ${r.type}:${r.kind}`, side: r.side, lag: r.numberAt[i] == null ? null : r.numberAt[i] - hit })),
    ).filter((x) => x.lag !== null);
    expect(timed.some((x) => /attack:/.test(x.tag) && x.side === "e"), "enemy attack numbers recorded").toBe(true);
    expect(timed.some((x) => /cast:fireball/.test(x.tag) && x.side === "e"), "enemy spell number recorded").toBe(true);
    for (const x of timed) expect(Math.abs(x.lag), x.tag + " number within 34ms of contact").toBeLessThanOrEqual(34);
    expect(errors).toEqual([]);
    await context.close();
  });

/* On phones the enemy hand is hidden, so an enemy minion has no card to fly
 * from. The flight must either start from a real point or be skipped in favour
 * of the landing squash — never a NaN transform stuck in the corner. */
for (const layout of LAYOUTS)
  test(`enemy minion play has a valid flight or the landing fallback · ${layout.name}`, async ({ browser }) => {
    test.setTimeout(60000);
    const { context, page, errors } = await open(browser, layout);
    const warnings = [];
    page.on("console", (m) => {
      if (/NaN/.test(m.text())) warnings.push(m.type() + ": " + m.text());
    });
    const out = await page.evaluate(async () => {
      const g = EmberDebug.game;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const idle = () => new Promise((r) => { const f = () => (EmberFX.busy ? setTimeout(f, 10) : r()); f(); });
      EmberFX.cancel(true);
      await wait(30);
      Object.assign(g.s, { phase: "battle", active: "e", choice: null });
      for (const s of ["p", "e"])
        Object.assign(g.s[s], { board: [], secrets: [], hp: 30, maxHp: 30, armor: 0, mana: 10, maxMana: 10, powerUsed: false, weapon: null, frozen: false });
      g.summon("p", "guard", { sick: false });
      g.summon("e", "golem", { sick: false });
      const card = g.card("treant");
      g.s.e.hand = [card, g.card("wolf")];
      g.events = [];
      g.emit();
      await idle();
      await wait(200);
      const first = EmberFX.trace.at(-1)?.seq ?? 0;
      const samples = { badProxy: [], nanKeyframes: [], landing: false };
      let landedUid = null;
      const probe = setInterval(() => {
        for (const el of document.querySelectorAll(".card-motion-proxy")) {
          const r = el.getBoundingClientRect();
          if (![r.left, r.top, r.width, r.height].every(Number.isFinite)) samples.badProxy.push(el.style.cssText);
          for (const a of el.getAnimations())
            if (JSON.stringify(a.effect?.getKeyframes?.() || []).includes("NaN")) samples.nanKeyframes.push(el.dataset.motionId);
          if (/NaN/.test(el.style.cssText)) samples.nanKeyframes.push(el.style.cssText);
        }
        if (landedUid) {
          const unit = document.querySelector(`#battle .minion[data-side="e"][data-uid="${landedUid}"]`);
          if (unit?.getAnimations().some((a) => JSON.stringify(a.effect?.getKeyframes?.() || []).includes("1.09"))) samples.landing = true;
        }
      }, 16);
      const before = new Set(g.s.e.board.map((m) => m.uid));
      const result = g.dispatch({ type: "play", side: "e", uid: card.uid });
      landedUid = g.s.e.board.find((m) => !before.has(m.uid))?.uid ?? null;
      await idle();
      await wait(150);
      clearInterval(probe);
      const records = EmberFX.trace.filter((r) => r.seq > first);
      return {
        ok: result.ok,
        landedUid,
        mobile: EmberViewport.mobile,
        play: records.find((r) => r.type === "play") || null,
        summon: records.find((r) => r.type === "summon") || null,
        samples,
        unit: !!document.querySelector(`#battle .minion[data-side="e"][data-uid="${landedUid}"]`),
      };
    });
    expect(out.ok).toBe(true);
    expect(out.landedUid).toBeTruthy();
    expect(out.unit, "landed unit is on the board").toBe(true);
    expect(out.play, "play record").toBeTruthy();
    expect(out.summon, "summon record").toBeTruthy();
    expect(out.samples.badProxy).toEqual([]);
    expect(out.samples.nanKeyframes).toEqual([]);
    if (out.play.from) {
      expect([out.play.from.x, out.play.from.y].every(Number.isFinite), "flight starts from a real point").toBe(true);
    } else {
      expect(out.samples.landing, "hidden hand falls back to the landing squash").toBe(true);
    }
    if (layout.mobile) expect(out.play.from, "phone enemy hand is hidden: no flight origin").toBeNull();
    expect(warnings).toEqual([]);
    expect(errors).toEqual([]);
    await context.close();
  });
