const { test, expect } = require("@playwright/test");
const path = require("node:path");
async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
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
      EmberFX.particles,
    ]),
  ).toEqual([0, 0, 0, 0]);
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

for (const mobile of [false, true])
  test(`layered portraits animate independently, freeze and fall back ${mobile ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1600, height: 940 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await demo(page);
    await prepare(page, {
      friends: ["oracle", "phoenix", "frostking"],
      hand: ["oracle", "phoenix", "frostking"],
    });
    await page.waitForFunction(
      () => document.querySelectorAll("#minions .motion-ready").length === 3,
    );
    const canvas = page.locator('#minions [data-cardid="phoenix"] canvas');
    const state = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    const first = await canvas.evaluate((c) => c.toDataURL());
    await page.waitForTimeout(300);
    expect(await canvas.evaluate((c) => c.toDataURL())).not.toBe(first);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      state,
    );
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/portraits-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.board.find((m) => m.cid === "phoenix").frozen = true;
      g.events = [];
      g.emit();
    });
    await page.waitForTimeout(150);
    const frozen = await canvas.evaluate((c) => c.toDataURL());
    await page.waitForTimeout(300);
    expect(await canvas.evaluate((c) => c.toDataURL())).toBe(frozen);
    const dimensions = await canvas.evaluate((c) => [c.width, c.height]);
    expect(dimensions[0]).toBeGreaterThan(10);
    expect(
      await page.evaluate(() => EmberPortraits.active),
    ).toBeLessThanOrEqual(mobile ? 6 : 12);
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) EmberDebug.game.emit();
    });
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => EmberPortraits.tracked),
    ).toBeLessThanOrEqual(10);
    await page.evaluate(() => EmberFX.configure(true, false));
    await expect(
      page.locator('#minions [data-cardid="phoenix"] img'),
    ).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => EmberPortraits.active)).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });

test("a lunging layered character retains its painted canvas", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { friends: ["frostking"], enemies: ["treant"] });
  await page.waitForFunction(() =>
    document.querySelector('#minions [data-cardid="frostking"] .motion-ready'),
  );
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
  await expect(page.locator(".death-ghost .portrait-motion")).toHaveCount(1);
  expect(
    await page.locator(".death-ghost .portrait-motion").evaluate((c) => {
      const data = c
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height).data;
      return data.some((v, i) => i % 4 === 3 && v > 0);
    }),
  ).toBe(true);
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
  expect(report.contact).toBeLessThan(report.release);
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
      EmberFX.particles === 0,
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
          live = document.querySelector('#minions .friendly[data-uid]'),
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
      attackerHasMotion: !!attacker?.getAnimations().some((animation) =>
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
      const layoutRecord = window.contactAnimations.find(({ frames }) =>
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

test("portrait clock follows display frames and reuses surfaces without size churn", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { friends: ["oracle", "phoenix", "frostking"] });
  await page.waitForFunction(
    () => document.querySelectorAll("#minions .motion-ready").length === 3,
  );
  const report = await page.evaluate(async () => {
    const selector = '#minions [data-cardid="phoenix"] canvas',
      canvas = document.querySelector(selector);
    const before = EmberPortraits.diagnostics,
      frames = [];
    let drawing = 0;
    const ctx = canvas.getContext("2d"),
      original = ctx.clearRect.bind(ctx);
    ctx.clearRect = (...args) => {
      drawing++;
      return original(...args);
    };
    const start = performance.now();
    await new Promise((resolve) => {
      function step(t) {
        frames.push(t);
        if (t - start > 650) resolve();
        else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
    const after = EmberPortraits.diagnostics;
    EmberDebug.game.emit();
    return {
      drawing,
      displayFrames: frames.length,
      resizes: after.resizes - before.resizes,
      sameCanvas: document.querySelector(selector) === canvas,
      ready: document
        .querySelector(selector)
        .parentElement.classList.contains("motion-ready"),
    };
  });
  expect(report.drawing).toBeGreaterThanOrEqual(report.displayFrames - 2);
  expect(report.resizes).toBe(0);
  expect(report.sameCanvas).toBe(true);
  expect(report.ready).toBe(true);
});

test("freeze settles without lingering ice particles or delayed filter transitions", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { enemies: ["treant"], hand: ["frostbolt"] });
  await cast(page, "frostbolt", "e");
  await expect(page.locator(".cue-freeze")).toBeVisible();
  await page.waitForTimeout(450);
  expect(await page.evaluate(() => EmberFX.particles)).toBe(0);
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

for (const mobile of [false, true])
  test(`full board shares six rigs within its budget ${mobile ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 844, height: 390 }
        : { width: 1600, height: 940 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    await demo(page);
    const ids = [
      "oracle",
      "phoenix",
      "frostking",
      "wolf",
      "golem",
      "treant",
      "oracle",
    ];
    await prepare(page, {
      friends: ids,
      enemies: ids,
      hand: [...ids, "wolf", "golem", "treant"],
    });
    await page.mouse.move(0, 0);
    await page.waitForFunction(
      () =>
        EmberPortraits.active > 0 &&
        EmberPortraits.diagnostics.pendingLoads === 0,
    );
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    const report = await page.evaluate(async () => {
      const start = EmberPortraits.diagnostics;
      let frames = 0,
        maxActive = 0;
      await new Promise((resolve) => {
        const begin = performance.now();
        function step(t) {
          frames++;
          maxActive = Math.max(maxActive, EmberPortraits.active);
          if (t - begin > 700) resolve();
          else requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
      return { start, end: EmberPortraits.diagnostics, frames, maxActive };
    });
    expect(report.maxActive).toBeLessThanOrEqual(mobile ? 6 : 12);
    expect(report.end.decodedBytes).toBeLessThanOrEqual(
      report.end.cacheLimit * 3 * 384 * 512 * 4,
    );
    expect(report.end.resizes).toBe(report.start.resizes);
    expect(report.end.frames - report.start.frames).toBeGreaterThan(0);
    await expect(page.locator("#hand .motion-ready")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      before,
    );
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/full-motion-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    await context.close();
  });

test("gallery stays static on hover and selection; explicit inspection can animate", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    document.getElementById("app").innerHTML =
      '<div id="gallery" style="position:fixed;inset:100px;display:flex"></div>';
    for (const id of Object.keys(CharacterCatalog).filter(
      (id) => CharacterCatalog[id].motion,
    )) {
      const host = document.createElement("div");
      host.className = "card-art";
      host.dataset.fixture = id;
      host.style.cssText = "width:140px;height:200px;position:relative";
      host.innerHTML = `<img data-art-key="${id}" src="${EmberArt.card(EmberData.byId[id])}">`;
      document.getElementById("gallery").append(host);
    }
    EmberPortraits.sync();
  });
  await page.waitForTimeout(350);
  expect(
    await page.evaluate(() => EmberPortraits.diagnostics.loadedIds),
  ).toEqual([]);
  expect(
    await page
      .locator("#gallery canvas")
      .evaluateAll((cs) => cs.every((c) => c.width === 1 && c.height === 1)),
  ).toBe(true);
  await page.locator('[data-fixture="wolf"]').hover();
  await page.locator('[data-fixture="wolf"]').click();
  await page
    .locator('[data-fixture="wolf"]')
    .evaluate((el) => el.classList.add("selected"));
  await page.waitForTimeout(200);
  await expect(page.locator("#gallery .motion-ready")).toHaveCount(0);
  expect(
    await page.evaluate(() => EmberPortraits.diagnostics.loadedIds),
  ).toEqual([]);
  await page.locator('[data-fixture="wolf"]').evaluate((el) => {
    el.querySelector("img").dataset.portraitMode = "detail";
    EmberPortraits.sync();
  });
  await expect(page.locator('[data-fixture="wolf"]')).toHaveClass(
    /motion-ready/,
  );
  expect(
    await page.evaluate(() => EmberPortraits.diagnostics.loadedIds),
  ).toEqual(["wolf"]);
  await page.locator('[data-fixture="wolf"]').evaluate((el) => {
    el.querySelector("img").dataset.portraitMode = "static";
    EmberPortraits.sync();
  });
  await page.mouse.move(0, 0);
  await expect(page.locator("#gallery .motion-ready")).toHaveCount(0);
});

test("frozen portrait performs zero redraws and resumes after reduced-motion toggles", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { friends: ["wolf"] });
  await expect(
    page.locator('#minions [data-cardid="wolf"] .minion-art'),
  ).toHaveClass(/motion-ready/);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.board[0].frozen = true;
    g.events = [];
    g.emit();
  });
  const result = await page
    .locator('#minions [data-cardid="wolf"] canvas')
    .evaluate(async (canvas) => {
      let count = 0;
      const ctx = canvas.getContext("2d"),
        original = ctx.clearRect.bind(ctx);
      ctx.clearRect = (...args) => {
        count++;
        original(...args);
      };
      await new Promise((r) => setTimeout(r, 300));
      return count;
    });
  expect(result).toBe(0);
  expect(await page.evaluate(() => EmberPortraits.active)).toBeLessThanOrEqual(
    await page.locator('img[data-portrait-mode="hero"]').count(),
  );
  await page.evaluate(() => EmberFX.configure(true, false));
  await expect(page.locator("#minions .motion-ready")).toHaveCount(0);
  await page.evaluate(() => EmberFX.configure(false, false));
  await expect(
    page.locator('#minions [data-cardid="wolf"] .minion-art'),
  ).toHaveClass(/motion-ready/);
});

test("bounded cache evicts unused rigs and can reload an evicted rig", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  // Synthetic IDs exist only in intercepted test scripts to exercise future scale.
  await page.route("**/scripts/motion-assets.js", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace("const MotionAssets =", "const FixtureSource =");
    body +=
      '\nconst MotionAssets=Object.freeze(Object.fromEntries(Array.from({length:20},(_,i)=>["fixture"+i,FixtureSource.wolf])));';
    await route.fulfill({ response, body });
  });
  await page.route("**/scripts/character-catalog.js", async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace("const CharacterCatalog =", "const FixtureCatalog =");
    body +=
      '\nconst CharacterCatalog=Object.freeze({...FixtureCatalog,...Object.fromEntries(Array.from({length:20},(_,i)=>["fixture"+i,FixtureCatalog.wolf]))});';
    await route.fulfill({ response, body });
  });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall);
  async function show(i) {
    await page.evaluate((i) => {
      document.getElementById("app").innerHTML =
        `<div class="selected" data-motion-detail style="position:fixed;left:40px;top:160px"><div class="card-art" style="width:200px;height:270px"><img data-art-key="fixture${i}" data-portrait-mode="detail" data-portrait-instance="fixture:${i}" data-portrait-state="idle"></div></div>`;
      EmberPortraits.sync();
    }, i);
    await page.waitForFunction(() => document.querySelector(".motion-ready"));
  }
  for (let i = 0; i < 20; i++) await show(i);
  const cached = await page.evaluate(() => EmberPortraits.diagnostics);
  expect(cached.cached).toBeLessThanOrEqual(8);
  expect(cached.loadedIds).not.toContain("fixture0");
  await show(0);
  expect(
    await page.evaluate(() => EmberPortraits.diagnostics.loadedIds),
  ).toContain("fixture0");
  await context.close();
});

test("same-art instances keep independent state and ignore decorative frozen classes", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { friends: ["wolf", "wolf"] });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#minions [data-cardid="wolf"] .motion-ready')
        .length === 2,
  );
  const canvases = page.locator('#minions [data-cardid="wolf"] canvas');
  const bindings = await page
    .locator('#minions [data-cardid="wolf"] img')
    .evaluateAll((images) => images.map((i) => i.dataset.portraitInstance));
  expect(new Set(bindings).size).toBe(2);
  await page
    .locator('#minions [data-cardid="wolf"]')
    .first()
    .evaluate((e) => e.classList.add("frozen"));
  const beforeDecoration = await canvases
    .first()
    .evaluate((c) => c.toDataURL());
  await page.waitForTimeout(300);
  expect(await canvases.first().evaluate((c) => c.toDataURL())).not.toBe(
    beforeDecoration,
  );
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.board[0].frozen = true;
    g.events = [];
    g.emit();
  });
  await page.waitForTimeout(100);
  const before = await canvases.evaluateAll((cs) =>
    cs.map((c) => c.toDataURL()),
  );
  await page.waitForTimeout(350);
  const after = await canvases.evaluateAll((cs) =>
    cs.map((c) => c.toDataURL()),
  );
  expect(after[0]).toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
});

test("every on-board portrait paints, moves and freezes independently across roster pages", async ({
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
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll("#minions .motion-ready").length === count,
      group.length,
    );
    const before = await page
      .locator("#minions canvas")
      .evaluateAll((cs) => cs.map((c) => c.toDataURL()));
    await page.waitForTimeout(350);
    const after = await page
      .locator("#minions canvas")
      .evaluateAll((cs) => cs.map((c) => c.toDataURL()));
    expect(after.length).toBe(group.length);
    after.forEach((frame, i) =>
      expect(frame, group[i] + " should move").not.toBe(before[i]),
    );
    await expect(page.locator("#hand canvas")).toHaveCount(0);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.board.forEach((m) => (m.frozen = true));
      g.emit();
    });
    await page.waitForTimeout(80);
    const frozen = await page
      .locator("#minions canvas")
      .evaluateAll((cs) => cs.map((c) => c.toDataURL()));
    await page.waitForTimeout(200);
    expect(
      await page
        .locator("#minions canvas")
        .evaluateAll((cs) => cs.map((c) => c.toDataURL())),
    ).toEqual(frozen);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.board.forEach((m) => (m.frozen = false));
      g.emit();
    });
    await page.waitForTimeout(250);
    const thawed = await page
      .locator("#minions canvas")
      .evaluateAll((cs) => cs.map((c) => c.toDataURL()));
    thawed.forEach((frame, i) =>
      expect(frame, group[i] + " should thaw").not.toBe(frozen[i]),
    );
    expect(
      await page.evaluate(() => EmberPortraits.diagnostics.cached),
    ).toBeLessThanOrEqual(16);
  }
});

for (const slow of [false, true]) {
  test(`summon preloads motion before landing and reveals without a hard swap ${slow ? "slow network" : "normal network"}`, async ({ page }) => {
    await demo(page);
    await prepare(page, { hand: ["solaris"] });
    const urls = await page.evaluate(() => Object.values(MotionAssets.solaris).map(src => new URL(src, location.href).href));
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const requested = [];
    for (const url of urls) await page.route(url, async route => {
      requested.push(await page.locator('#minions [data-cardid="solaris"]').count());
      if (slow) await gate;
      await route.continue();
    });
    await page.evaluate(() => {
      window.arrivalSamples = [];
      window.captureArrival = true;
      function sample() {
        const art = document.querySelector('#minions [data-cardid="solaris"] .minion-art');
        if (art) arrivalSamples.push({ ready: art.classList.contains('motion-ready'), opacity: Number(getComputedStyle(art.querySelector('img')).opacity) });
        if (captureArrival) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await cast(page, "solaris");
    await expect.poll(() => requested.length).toBe(urls.length);
    expect(requested.every(count => count === 0)).toBe(true);
    const art = page.locator('#minions [data-cardid="solaris"] .minion-art');
    await expect(art).toHaveCount(1);
    if (slow) {
      // The image may wait briefly, but rules and input cannot wait on the network.
      await page.waitForFunction(() => !EmberFX.busy);
      await expect(art.locator('img')).toHaveCSS('opacity', '1');
      await expect(art).not.toHaveClass(/motion-arriving/);
      release();
    }
    await expect(art).toHaveClass(/motion-ready/);
    await expect(art.locator('canvas')).toHaveCSS('opacity', '1');
    await expect(art.locator('img')).toHaveCSS('opacity', '0');
    await expect(page.locator('#hand canvas')).toHaveCount(0);
    const samples = await page.evaluate(() => { captureArrival = false; return arrivalSamples; });
    expect(samples.length).toBeGreaterThan(0);
    if (!slow) expect(samples.filter(s => !s.ready && s.opacity > 0.05)).toEqual([]);
    await page.screenshot({ path: path.resolve(`artifacts/qa/arrival-${slow ? "slow" : "normal"}.png`) });
  });
}

test("failed summon layers leave static art visible and reduced motion skips preloading", async ({ page }) => {
  await demo(page);
  await prepare(page, { hand: ["solaris", "nyx"] });
  const urls = await page.evaluate(() => Object.values(MotionAssets.solaris).map(src => new URL(src, location.href).href));
  for (const url of urls) await page.route(url, route => route.abort());
  await cast(page, "solaris");
  await page.waitForFunction(() => !EmberFX.busy);
  const art = page.locator('#minions [data-cardid="solaris"] .minion-art');
  await expect(art.locator('img')).toHaveCSS('opacity', '1');
  await expect(art).not.toHaveClass(/motion-arriving|motion-ready/);
  await page.evaluate(() => { EmberFX.configure(true, false); EmberDebug.game.s.p.mana = 10; });
  await cast(page, "nyx");
  expect(await page.evaluate(() => EmberPortraits.diagnostics.loadedIds.includes('nyx'))).toBe(false);
  await expect(page.locator('#minions [data-cardid="nyx"] .minion-art img')).toHaveCSS('opacity', '1');
});
