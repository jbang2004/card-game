const { test, expect } = require("@playwright/test");
const path = require("node:path");
async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}
// These four cases exercise the retained DOM fallback. Mesh attacks use the
// real card and shared sampled poses, covered by motion-semantics.spec.cjs.
async function useDOMFallback(page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
}
async function prepare(page, config) {
  await page.evaluate((config) => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.p.hp = 15;
    g.s.e.hp = g.s.e.maxHp;
    for (const cid of config.friends || []) g.summon("p", cid, { sick: false });
    for (const cid of config.enemies || []) g.summon("e", cid, { sick: false });
    g.s.p.hand = (config.hand || []).map((id) => g.card(id));
    g.events = [];
    g.emit();
  }, config);
}
async function cast(page, id, side, index = 0) {
  return page.evaluate(
    ({ id, side, index }) => {
      const g = EmberDebug.game,
        card = g.s.p.hand.find((c) => c.cid === id);
      const target = side
        ? { side, uid: g.s[side].board[index].uid }
        : undefined;
      const result = Emberfall.act(() =>
        g.dispatch({ type: "play", side: "p", uid: card.uid, target }),
      );
      if (!result.ok) throw Error(result.error);
      return JSON.stringify(g.s);
    },
    { id, side, index },
  );
}

test("actual deathrattle shows hit, death and token in order; cancellation commits the final view", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { enemies: ["wolf"], hand: ["fireball"] });
  const state = await cast(page, "fireball", "e");
  await page.waitForFunction(() => {
    const el = document.querySelector('.enemy[data-cardid="wolf"] .hp');
    return el && Number(el.textContent) <= 0;
  });
  await expect(page.locator('.enemy[data-cardid="pup"]')).toHaveCount(0);
  await page.waitForFunction(
    () => !document.querySelector('#minions .enemy[data-cardid="wolf"]'),
  );
  await expect(page.locator(".death-ghost")).not.toHaveCount(0);
  await expect(page.locator('#minions .enemy[data-cardid="pup"]')).toHaveCount(
    0,
  );
  await page.screenshot({
    path: path.resolve("artifacts/qa/deathrattle-between.png"),
  });
  await expect(page.locator('#minions .enemy[data-cardid="pup"]')).toHaveCount(
    1,
  );
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    state,
  );
  await prepare(page, { enemies: ["wolf"], hand: ["fireball"] });
  const final = await cast(page, "fireball", "e");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(page.locator('#minions .enemy[data-cardid="pup"]')).toHaveCount(
    1,
  );
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    final,
  );
  expect(
    await page.evaluate(() => [
      EmberFX.pendingTimers,
      EmberFX.activeAnimations,
      EmberFX.transientNodes,
    ]),
  ).toEqual([0, 0, 0]);
});

test("multi-draw reveals one actual card per beat, and statuses have named feedback", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, {
    friends: ["treant"],
    enemies: ["treant"],
    hand: ["wisdom"],
  });
  await page.evaluate(() => {
    window.handSteps = [];
    new MutationObserver(() =>
      window.handSteps.push(
        document.querySelectorAll("#hand .hand-card").length,
      ),
    ).observe(document.getElementById("hand"), { childList: true });
  });
  const state = await cast(page, "wisdom");
  await page.waitForFunction(() => !EmberFX.busy);
  const steps = await page.evaluate(() => window.handSteps);
  expect(steps).toContain(1);
  expect(steps).toContain(2);
  expect(steps.indexOf(1)).toBeLessThan(steps.indexOf(2));
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    state,
  );
  await prepare(page, { enemies: ["treant"], hand: ["frostbolt"] });
  await cast(page, "frostbolt", "e");
  await expect(page.locator(".cue-freeze")).toContainText("冻结");
  await page.waitForFunction(() => !EmberFX.busy);
  await prepare(page, { enemies: ["treant"], hand: ["polymorph"] });
  await cast(page, "polymorph", "e");
  await expect(page.locator(".cue-transform")).toContainText("变形");
  await expect(page.locator('#minions [data-cardid="sheep"]')).toHaveCount(1);
  await page.screenshot({ path: path.resolve("artifacts/qa/transform.png") });
});

test("a lunging minion clone carries its static illustration", async ({
  page,
}) => {
  await useDOMFallback(page);
  await demo(page);
  await prepare(page, { friends: ["frostking"], enemies: ["treant"] });
  const art = page.locator(
    '#minions [data-cardid="frostking"] .minion-art img',
  );
  await expect(art).toHaveCount(1);
  await expect(art).toHaveJSProperty("complete", true);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    Emberfall.act(() =>
      g.dispatch({
        type: "attack",
        side: "p",
        uid: g.s.p.board[0].uid,
        target: { side: "e", uid: g.s.e.board[0].uid },
      }),
    );
  });
  // The lunging clone is built from the live card markup: its illustration must
  // arrive decoded and opaque, and nothing may paint over it.
  const clone = page.locator(".attack-actor .minion-art img");
  await expect(clone).toHaveCount(1);
  expect(
    await clone.evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  await expect(clone).toHaveCSS("opacity", "1");
  await expect(page.locator(".attack-actor canvas")).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/qa/layered-attack.png"),
  });
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(
    page.locator('#minions [data-cardid="frostking"]'),
  ).toBeVisible();
});

test("attack owner keeps one causal clock, live stats and status classes until recovery", async ({
  page,
}) => {
  await useDOMFallback(page);
  await demo(page);
  await prepare(page, { friends: ["solaris"], enemies: ["treant"] });
  const report = await page.evaluate(async () => {
    const g = EmberDebug.game;
    Emberfall.act(() =>
      g.dispatch({
        type: "attack",
        side: "p",
        uid: g.s.p.board[0].uid,
        target: { side: "e", uid: g.s.e.board[0].uid },
      }),
    );
    return await new Promise((resolve) => {
      function sample() {
        const actor = document.querySelector(".attack-actor"),
          live = document.querySelector(
            '#minions .friendly[data-cardid="solaris"]',
          );
        if (!actor || !live) return requestAnimationFrame(sample);
        const liveAttack = live.querySelector(".stat.atk"),
          actorAttack = actor.querySelector(".stat.atk");
        resolve({
          contact: Number(actor.dataset.contactMs),
          release: Number(actor.dataset.releaseMs),
          recoveryEnd: Number(actor.dataset.recoveryEndMs),
          end: Number(actor.dataset.motionEndMs),
          actorAttack: actorAttack?.textContent,
          liveAttack: liveAttack?.textContent,
          actorShield: actor.classList.contains("shield"),
          liveShield: live.classList.contains("shield"),
        });
      }
      requestAnimationFrame(sample);
    });
  });
  // Hit-stop is tier-based (§4.1): a tier-1 contact releases immediately.
  expect(report.contact).toBeLessThanOrEqual(report.release);
  expect(report.release).toBeLessThanOrEqual(report.recoveryEnd);
  expect(report.recoveryEnd).toBe(report.end);
  expect(report.actorAttack).toBe(report.liveAttack);
  expect(report.actorShield).toBe(report.liveShield);
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(page.locator(".attack-actor")).toHaveCount(0);
  await page.waitForFunction(
    () =>
      EmberFX.pendingTimers === 0 &&
      EmberFX.activeAnimations === 0 &&
      EmberFX.transientNodes === 0 &&
      (EmberFx2.stats
        ? EmberFx2.stats.effects + EmberFx2.stats.particles
        : 0) === 0,
    null,
    { timeout: 3000 },
  );
  expect(
    await page.evaluate(() => [
      EmberFX.pendingTimers,
      EmberFX.activeAnimations,
      EmberFX.transientNodes,
    ]),
  ).toEqual([0, 0, 0]);
});

test("contact rebind updates the visible proxy after retaliation without FLIP takeover", async ({
  page,
}) => {
  await useDOMFallback(page);
  await demo(page);
  await prepare(page, { friends: ["guard"], enemies: ["treant"] });
  const report = await page.evaluate(async () => {
    const g = EmberDebug.game;
    Emberfall.act(() =>
      g.dispatch({
        type: "attack",
        side: "p",
        uid: g.s.p.board[0].uid,
        target: { side: "e", uid: g.s.e.board[0].uid },
      }),
    );
    return await new Promise((resolve) => {
      function sample() {
        const actor = document.querySelector(".attack-actor"),
          live = document.querySelector("#minions .friendly[data-uid]"),
          number = document.querySelector(".damage-number");
        if (!actor || !live || !number) return requestAnimationFrame(sample);
        resolve({
          actorHp: actor.querySelector(".stat.hp .stat-value")?.textContent,
          liveHp: live.querySelector(".stat.hp .stat-value")?.textContent,
          actorBadge: !!actor.querySelector(".stat.hp .badge-frame"),
          liveBadge: !!live.querySelector(".stat.hp .badge-frame"),
          hidden: getComputedStyle(live).visibility === "hidden",
          actorAnimations: actor.getAnimations().length,
        });
      }
      requestAnimationFrame(sample);
    });
  });
  expect(report.actorHp).toBe(report.liveHp);
  expect(report.actorBadge).toBe(report.liveBadge);
  expect(report.hidden).toBe(true);
  expect(report.actorAnimations).toBeGreaterThan(0);
  await page.waitForFunction(
    () =>
      !EmberFX.busy &&
      EmberFX.pendingTimers === 0 &&
      EmberFX.activeAnimations === 0,
  );
  await expect(page.locator(".attack-actor")).toHaveCount(0);
});

test("a new contact reaction owns target translation when the contact render moves layout", async ({
  page,
}) => {
  await useDOMFallback(page);
  await demo(page);
  await prepare(page, { friends: ["guard"], enemies: ["treant"] });
  const targetUid = await page.evaluate(() => {
    const g = EmberDebug.game,
      target = g.s.e.board[0],
      beforeHp = target.hp,
      original = EmberFX.present;
    window.contactProbe = false;
    window.contactAnimations = [];
    window.independentAnimation = null;
    const nativeAnimate = Element.prototype.animate;
    window.__nativeAnimate = nativeAnimate;
    Element.prototype.animate = function (frames, options) {
      const animation = nativeAnimate.call(this, frames, options);
      if (this.dataset.uid === target.uid && this.closest("#minions"))
        window.contactAnimations.push({ animation, frames, options });
      return animation;
    };
    EmberFX.present = (events, state, render, after, cardHTML, before) => {
      if (!events.some((event) => event.type === "attack"))
        return original(events, state, render, after, cardHTML, before);
      const damageIndex = events.findIndex((event) => event.type === "damage"),
        attack = events.find((event) => event.type === "attack"),
        stagedEvents = [
          ...events.slice(0, damageIndex),
          {
            id: "contact-layout-status",
            type: "status",
            parentId: attack?.parentId,
            side: target.side,
            uid: target.uid,
            kind: "buff",
            attack: 0,
          },
          ...events.slice(damageIndex),
        ];
      let renderCount = 0;
      return original(
        stagedEvents,
        state,
        (frame) => {
          render(frame);
          renderCount++;
          const el = document.querySelector(
            `#minions .enemy[data-uid="${target.uid}"]`,
          );
          if (renderCount === 1) {
            el.style.marginLeft = "48px";
            return;
          }
          if (renderCount === 2) {
            el.style.marginLeft = "";
            return;
          }
          const current = frame?.e?.board?.find(
            (unit) => unit.uid === target.uid,
          );
          if (window.contactProbe || !(current?.hp < beforeHp)) return;
          window.independentAnimation = el.animate(
            [
              { translate: "0 0", scale: "1", opacity: 1 },
              { translate: "0 12px", scale: "1.12", opacity: 0.82 },
            ],
            { duration: 700, fill: "both" },
          );
          window.contactProbe = true;
          EmberFX.present = original;
        },
        after,
        cardHTML,
        before,
      );
    };
    Emberfall.act(() =>
      g.dispatch({
        type: "attack",
        side: "p",
        uid: g.s.p.board[0].uid,
        target: { side: "e", uid: target.uid },
      }),
    );
    return target.uid;
  });
  await page.waitForFunction(() => window.contactProbe === true);
  const during = await page.evaluate((uid) => {
    const el = document.querySelector(`#minions .enemy[data-uid="${uid}"]`),
      pureLayout = (frames) =>
        frames.length > 1 &&
        frames.every((frame) =>
          Object.keys(frame).every((key) =>
            ["translate", "offset", "easing"].includes(key),
          ),
        ),
      layoutRecord = window.contactAnimations.find(({ frames }) =>
        pureLayout(frames),
      ),
      activeTranslations = el
        .getAnimations()
        .filter((animation) =>
          (animation.effect?.getKeyframes?.() || []).some(
            (frame) => frame.translate != null,
          ),
        ),
      attacker = document.querySelector(".attack-actor");
    return {
      layoutState: layoutRecord?.animation.playState,
      independentActive: window.independentAnimation?.playState === "running",
      independentStillPresent: el
        .getAnimations()
        .includes(window.independentAnimation),
      activeTranslationCount: activeTranslations.length,
      reactionDurations: activeTranslations
        .map((animation) => Number(animation.effect?.getTiming?.().duration))
        .filter((duration) => duration <= 250),
      attackerHasMotion: !!attacker
        ?.getAnimations()
        .some((animation) =>
          (animation.effect?.getKeyframes?.() || []).some(
            (frame) => frame.transform != null,
          ),
        ),
    };
  }, targetUid);
  expect(during.layoutState).toBe("idle");
  expect(during.independentActive).toBe(true);
  expect(during.independentStillPresent).toBe(true);
  expect(during.activeTranslationCount).toBe(2);
  expect(during.reactionDurations).toHaveLength(1);
  expect(during.attackerHasMotion).toBe(true);
  await page.waitForFunction(() => !EmberFX.busy);
  expect(
    await page.evaluate(() => {
      const layoutRecord = window.contactAnimations.find(
        ({ frames }) =>
          frames.length > 1 &&
          frames.every((frame) =>
            Object.keys(frame).every((key) =>
              ["translate", "offset", "easing"].includes(key),
            ),
          ),
      );
      window.independentAnimation?.cancel();
      Element.prototype.animate = window.__nativeAnimate;
      delete window.__nativeAnimate;
      return layoutRecord?.animation.playState;
    }),
  ).toBe("idle");
});

test("freeze settles without lingering ice particles or delayed filter transitions", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { enemies: ["treant"], hand: ["frostbolt"] });
  await cast(page, "frostbolt", "e");
  await expect(page.locator(".cue-freeze")).toBeVisible();
  await page.waitForTimeout(450);
  // V2 §2.5: freeze is the card's CSS state only — no ice shell, no residue.
  await expect(page.locator(".freeze-lock")).toHaveCount(0);
  const transition = await page
    .locator("#minions .frozen")
    .evaluate((e) => getComputedStyle(e).transitionProperty);
  expect(transition).not.toContain("filter");
  expect(transition).not.toContain("transform");
  await page.screenshot({
    path: path.resolve("artifacts/qa/freeze-settled.png"),
  });
});

test("every on-board minion shows its own decoded illustration across roster pages", async ({
  page,
}) => {
  test.setTimeout(120000);
  await demo(page);
  const ids = await page.evaluate(() =>
    EmberData.cards.filter((c) => c.type === "minion").map((c) => c.id),
  );
  for (let offset = 0; offset < ids.length; offset += 6) {
    const group = ids.slice(offset, offset + 6);
    await prepare(page, { friends: group, hand: group });
    // A freshly rendered board starts its image loads: wait for the decode,
    // not just for the nodes, or the first page of the roster races the network.
    await page.waitForFunction(
      (count) =>
        [...document.querySelectorAll("#minions .minion-art img")].filter(
          (img) => img.complete && img.naturalWidth > 0,
        ).length === count,
      group.length,
    );
    // Static art only: every board illustration must decode, and no renderer
    // may add a surface on top of it.
    const report = await page
      .locator("#minions .minion-art img")
      .evaluateAll((images) =>
        images.map((img) => ({
          key: img.dataset.artKey,
          loaded: img.complete && img.naturalWidth > 0,
          src: img.currentSrc || img.src,
        })),
      );
    expect(report.length).toBe(group.length);
    report.forEach((entry, i) => {
      expect(entry.loaded, group[i] + " illustration should decode").toBe(true);
      expect(entry.src.length).toBeGreaterThan(0);
    });
    await expect(page.locator("#minions canvas")).toHaveCount(0);
    await expect(page.locator("#hand canvas")).toHaveCount(0);
  }
});

// (a card without a voxel figure: a figure's token dims its art to a backdrop by design, MINIATURES.md)
test("a summoned minion lands with its illustration visible and unobscured", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["ashdragon"] });
  await cast(page, "ashdragon");
  const art = page.locator('#minions [data-cardid="ashdragon"] .minion-art');
  await expect(art).toHaveCount(1);
  await expect(art.locator("img")).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      art
        .locator("img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  // Nothing is layered over the approved illustration any more, on board or in hand.
  await expect(art.locator("canvas")).toHaveCount(0);
  await expect(page.locator("#hand canvas")).toHaveCount(0);
  await page.waitForFunction(() => !EmberFX.busy);
  await page.screenshot({ path: path.resolve("artifacts/qa/arrival-v4.png") });
});
