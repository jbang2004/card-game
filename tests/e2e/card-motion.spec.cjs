const { test, expect } = require("@playwright/test");

async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}

async function prepare(page, { hand = [], enemies = [] } = {}) {
  await page.evaluate(({ hand, enemies }) => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.p.hand = hand.map((id) => g.card(id));
    for (const cid of enemies) g.summon("e", cid, { sick: false });
    g.events = [];
    g.emit();
  }, { hand, enemies });
}

test("a playable minion proxy hands off to its own summoned UID", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["archer"], enemies: ["treant"] });
  const identity = await page.evaluate(() => {
    const g = EmberDebug.game,
      card = g.s.p.hand[0],
      enemy = g.s.e.board[0];
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: card.uid,
        target: { side: "e", uid: enemy.uid },
      }),
    );
    return { handUid: card.uid, enemyUid: enemy.uid, minionUid: g.s.p.board[0].uid };
  });
  await expect(page.locator('.card-motion-proxy[data-motion-kind="play"]')).toHaveCount(
    1,
  );
  const flight = await page.locator(".card-motion-proxy").evaluate((el) => ({
    source: el.dataset.motionUid,
    target: el.dataset.motionTargetUid,
    hasCard: !!el.querySelector(".card"),
  }));
  expect(flight).toEqual({
    source: identity.handUid,
    target: identity.minionUid,
    hasCard: true,
  });
  expect(flight.target).not.toBe(identity.enemyUid);
  const samples = await page.evaluate(
    ({ uid }) =>
      new Promise((resolve) => {
        const values = [],
          deadline = performance.now() + 700;
        let started = false;
        const sample = () => {
          const proxy = document.querySelector(
              '.card-motion-proxy[data-motion-kind="play"]',
            ),
            live = document.querySelector(`.minion[data-uid="${uid}"]`);
          if (proxy || live) started = true;
          if (started)
            values.push({
              proxy: !!proxy,
              live: !!live,
              proxyVisible: proxy
                ? getComputedStyle(proxy).visibility !== "hidden" &&
                  Number(getComputedStyle(proxy).opacity) > 0
                : false,
              liveVisible: live
                ? getComputedStyle(live).visibility !== "hidden" &&
                  Number(getComputedStyle(live).opacity) > 0
                : false,
              proxyOpacity: proxy ? Number(getComputedStyle(proxy).opacity) : 0,
              liveOpacity: live ? Number(getComputedStyle(live).opacity) : 0,
            });
          if (performance.now() < deadline) requestAnimationFrame(sample);
          else resolve(values);
        };
        requestAnimationFrame(sample);
      }),
    { uid: identity.minionUid },
  );
  expect(
    samples.some(
      (sample) =>
        sample.proxy &&
        sample.live &&
        sample.proxyOpacity > 0 &&
        sample.liveOpacity > 0,
    ),
  ).toBe(true);
  const activeSamples = samples.filter((sample) => sample.proxy || sample.live);
  expect(activeSamples.length).toBeGreaterThan(0);
  expect(
    activeSamples.every(
      (sample) => sample.proxyVisible || sample.liveVisible,
    ),
  ).toBe(true);
  await expect(
    page.locator(
      `#minions .friendly[data-uid="${identity.minionUid}"]`,
    ),
  ).toBeVisible();
  await expect(page.locator(".card-motion-proxy")).toHaveCount(0);
  await page.waitForFunction(() => !EmberFX.busy);
  expect(
    await page.locator(`#minions .friendly[data-uid="${identity.minionUid}"]`).evaluate(
      (el) => getComputedStyle(el).opacity,
    ),
  ).not.toBe("0");
});

test("a player minion keeps the captured displayed cost through flight", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["archer"] });
  const identity = await page.evaluate(() => {
    const g = EmberDebug.game,
      card = g.s.p.hand[0];
    card.costMod = 2;
    g.emit();
    const displayed = document.querySelector(`#hand [data-hand="${card.uid}"]`);
    return {
      uid: card.uid,
      cost: String(g.cost(card)),
      renderedCost: displayed.querySelector(".badge-value")?.textContent || null,
    };
  });
  expect(identity.renderedCost).toBe(identity.cost);
  await page.evaluate(
    (uid) =>
      Emberfall.act(() =>
        EmberDebug.game.dispatch({ type: "play", side: "p", uid }),
      ),
    identity.uid,
  );
  const proxy = page.locator('.card-motion-proxy[data-motion-kind="play"]');
  await expect(proxy).toHaveCount(1);
  const flight = await proxy.evaluate((el) => ({
    cost: el.querySelector(".badge-value")?.textContent || null,
    faceLayers: el.querySelectorAll(".card-motion-face").length,
  }));
  expect(flight.cost).toBe(identity.cost);
  expect(flight.faceLayers).toBe(0);
  await page.waitForFunction(() => !EmberFX.busy);
});

test("player draws flip a card back, while enemy draws stay hidden", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["wisdom"] });
  await page.evaluate(() => {
    const g = EmberDebug.game,
      card = g.s.p.hand[0];
    Emberfall.act(() => g.dispatch({ type: "play", side: "p", uid: card.uid }));
  });
  const playerProxy = await (
    await page.waitForFunction(() => {
      const el = document.querySelector(
        '.card-motion-proxy[data-motion-kind="draw"][data-motion-side="p"]',
      );
      return el
        ? {
            uid: el.dataset.motionUid,
            hasCard: !!el.querySelector(".card"),
            hasBack: !!el.querySelector(".card-back"),
            hasFace: !!el.querySelector(".card-motion-face"),
            hasFront: !!el.querySelector(".card-motion-front"),
          }
        : false;
    })
  ).jsonValue();
  expect(playerProxy.hasCard).toBe(true);
  expect(playerProxy.hasBack).toBe(true);
  expect(playerProxy.hasFace).toBe(true);
  expect(playerProxy.hasFront).toBe(true);
  await page.waitForFunction(() => !EmberFX.busy);

  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.draw("e");
    g.emit();
  });
  const enemyProxy = await (
    await page.waitForFunction(() => {
      const el = document.querySelector(
        '.card-motion-proxy[data-motion-kind="draw"][data-motion-side="e"]',
      );
      return el
        ? {
            uid: el.dataset.motionUid,
            hasCard: !!el.querySelector(".card"),
            hasBack: !!el.querySelector(".card-back"),
            text: el.textContent.trim(),
            cardKey: el.querySelector("[data-card-key]")?.dataset.cardKey || null,
          }
        : false;
    })
  ).jsonValue();
  expect(enemyProxy.hasBack).toBe(true);
  expect(enemyProxy.hasCard).toBe(false);
  expect(enemyProxy.text).toBe("");
  expect(enemyProxy.cardKey).toBeNull();
  await page.waitForFunction(() => !EmberFX.busy);
});

test("reflow cancels a card proxy without replaying the final state", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["archer"], enemies: ["treant"] });
  const finalState = await page.evaluate(() => {
    const g = EmberDebug.game,
      card = g.s.p.hand[0],
      enemy = g.s.e.board[0];
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: card.uid,
        target: { side: "e", uid: enemy.uid },
      }),
    );
    return JSON.stringify(g.s);
  });
  await expect(page.locator(".card-motion-proxy")).toHaveCount(1);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    finalState,
  );
  await expect(page.locator(".card-motion-proxy")).toHaveCount(0);
  await expect(page.locator("#minions .friendly[data-cardid='archer']")).toHaveCount(
    1,
  );
});

test("enemy minion play keeps the hidden-hand source and hands off to its own UID", async ({
  page,
}) => {
  await demo(page);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    EmberFX.cancel(true);
    g.s.active = "e";
    g.s.phase = "battle";
    g.s.e.mana = g.s.e.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.e.hand = [g.card("archer")];
    g.events = [];
    g.emit();
    const card = g.s.e.hand[0];
    Emberfall.act(() => g.dispatch({ type: "play", side: "e", uid: card.uid }));
  });
  await expect(page.locator('.card-motion-proxy[data-motion-kind="play"]')).toHaveCount(1);
  const flight = await page.locator('.card-motion-proxy[data-motion-kind="play"]').evaluate((el) => ({
    hasBack: !!el.querySelector(".card-back"),
    hasFront: !!el.querySelector(".card-motion-front"),
    frontKey:
      el.querySelector(".card-motion-front")?.dataset.cardKey ||
      el.querySelector(".card-motion-front [data-card-key]")?.dataset.cardKey ||
      null,
    target: el.dataset.motionTargetUid,
  }));
  expect(flight.hasBack).toBe(true);
  expect(flight.hasFront).toBe(true);
  expect(flight.frontKey).toBe("archer");
  expect(flight.target).toBeTruthy();
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(page.locator('.card-motion-proxy[data-motion-kind="play"]')).toHaveCount(0);
});

test("a replaced landing target is locally cleaned up when rebind animation creation fails", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["spark"] });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const result = await page.evaluate(() => {
    const originalAnimate = Element.prototype.animate,
      originalPresent = EmberFX.present,
      state = { afterCalls: 0, renderReplaced: false, rebindFailureInjected: false };
    EmberFX.present = function (...args) {
      const after = args[3];
      args[3] = (...afterArgs) => {
        state.afterCalls++;
        return after?.(...afterArgs);
      };
      return originalPresent.apply(this, args);
    };
    Element.prototype.animate = function (frames, options) {
      if (
        window.__cardMotionRebindFailure &&
        this.matches("#minions .minion") &&
        options?.easing === "linear" &&
        frames?.[0]?.opacity < 0.2 &&
        frames?.[1]?.opacity === 1
      ) {
        state.rebindFailureInjected = true;
        window.__cardMotionRebindFailure = false;
        throw new Error("forced card rebind failure");
      }
      const animation = originalAnimate.call(this, frames, options);
      if (
        this.matches("#minions .minion") &&
        options?.easing === "linear" &&
        frames?.[0]?.opacity < 0.2 &&
        frames?.[1]?.opacity === 1 &&
        !window.__cardMotionRebindScheduled
      ) {
        window.__cardMotionRebindScheduled = true;
        setTimeout(() => {
          window.__cardMotionRebindFailure = true;
          state.renderReplaced = true;
          Emberfall.renderNow();
        }, 0);
      }
      return animation;
    };
    const g = EmberDebug.game,
      card = g.s.p.hand[0];
    Emberfall.act(() => g.dispatch({ type: "play", side: "p", uid: card.uid }));
    window.__cardMotionRebindState = state;
    window.__cardMotionRebindCleanup = () => {
      Element.prototype.animate = originalAnimate;
      EmberFX.present = originalPresent;
      delete window.__cardMotionRebindFailure;
      delete window.__cardMotionRebindScheduled;
      delete window.__cardMotionRebindState;
      delete window.__cardMotionRebindCleanup;
    };
    return { uid: card.uid };
  });
  await expect(page.locator('.card-motion-proxy[data-motion-kind="play"]')).toHaveCount(
    1,
  );
  await page.waitForFunction(() => window.__cardMotionRebindState?.renderReplaced);
  await page.waitForFunction(() => window.__cardMotionRebindState?.rebindFailureInjected);
  await page.waitForFunction(() => !EmberFX.busy);
  const settled = await page.evaluate(() => {
    const state = { ...window.__cardMotionRebindState };
    const minion = document.querySelector("#minions .minion.friendly");
    state.liveVisible =
      !!minion &&
      getComputedStyle(minion).visibility !== "hidden" &&
      Number(getComputedStyle(minion).opacity) > 0;
    state.proxyCount = document.querySelectorAll(".card-motion-proxy").length;
    window.__cardMotionRebindCleanup?.();
    return state;
  });
  expect(pageErrors).toEqual([]);
  expect(settled.renderReplaced).toBe(true);
  expect(settled.rebindFailureInjected).toBe(true);
  expect(settled.liveVisible).toBe(true);
  expect(settled.proxyCount).toBe(0);
  expect(settled.afterCalls).toBe(1);
});

test.describe("card motion mobile ownership", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("user hand scrolling locally releases only the draw decoration", async ({
    page,
  }) => {
    await demo(page);
    await page.evaluate(() => {
      EmberFX.cancel(true);
      const g = EmberDebug.game;
      g.s.active = "p";
      g.s.phase = "battle";
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.board = [];
      g.s.e.board = [];
      g.s.p.hand = Array.from({ length: 8 }, (_, i) => ({
        ...g.card("guard"),
        uid: "scroll-hand-" + i,
      }));
      g.events = [];
      g.emit();
    });
    const rail = await page.evaluate(() => {
      const hand = document.getElementById("hand");
      return { scrollWidth: hand.scrollWidth, clientWidth: hand.clientWidth };
    });
    expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
    const completion = await page.evaluate(async () => {
      const g = EmberDebug.game,
        originalPresent = EmberFX.present,
        state = {
          controlLandDelta: 0,
          canceledLandDelta: 0,
          afterCalls: 0,
          busyFalseEvents: 0,
          audioState: EmberAudio.state,
          immediateBusy: false,
          immediateLiveVisible: false,
          immediateProxyCount: -1,
          scrollBefore: 0,
          scrollAfter: 0,
          canceledUid: null,
        },
        onBusy = (event) => {
          if (!event.detail) state.busyFalseEvents++;
        };
      EmberFX.present = function (...args) {
        const after = args[3];
        args[3] = (...afterArgs) => {
          state.afterCalls++;
          return after?.(...afterArgs);
        };
        return originalPresent.apply(this, args);
      };
      document.addEventListener("ember:fx-busy", onBusy);
      const waitUntil = (predicate, timeout = 1400) =>
        new Promise((resolve, reject) => {
          const deadline = performance.now() + timeout;
          const poll = () => {
            if (predicate()) return resolve();
            if (performance.now() >= deadline)
              return reject(new Error("card motion probe timed out"));
            setTimeout(poll, 8);
          };
          poll();
        });
      try {
        const beforeControl = EmberAudio.played.land || 0;
        g.events = [];
        g.draw("p");
        g.emit();
        await waitUntil(() => !EmberFX.busy);
        state.controlLandDelta = (EmberAudio.played.land || 0) - beforeControl;

        const beforeCanceled = EmberAudio.played.land || 0;
        g.events = [];
        g.draw("p");
        state.canceledUid = g.s.p.hand.at(-1).uid;
        g.emit();
        await waitUntil(() =>
          !!document.querySelector(
            '.card-motion-proxy[data-motion-kind="draw"][data-motion-side="p"]',
          ),
        );
        state.immediateBusy = EmberFX.busy;
        state.scrollBefore = document.getElementById("hand").scrollLeft;
        const hand = document.getElementById("hand");
        const maxScroll = hand.scrollWidth - hand.clientWidth,
          nextScroll =
            state.scrollBefore >= maxScroll - 1
              ? Math.max(0, state.scrollBefore - 80)
              : Math.min(maxScroll, state.scrollBefore + 80);
        const scrollBehavior = hand.style.scrollBehavior;
        hand.style.scrollBehavior = "auto";
        hand.scrollLeft = nextScroll;
        hand.dispatchEvent(new Event("scroll"));
        hand.style.scrollBehavior = scrollBehavior;
        state.immediateProxyCount = document.querySelectorAll(
          '.card-motion-proxy[data-motion-kind="draw"][data-motion-side="p"]',
        ).length;
        const liveHost = document.querySelector(
            `#hand [data-hand="${state.canceledUid}"]`,
          ),
          live = liveHost?.querySelector(".card"),
          hostStyle = liveHost && getComputedStyle(liveHost),
          liveStyle = live && getComputedStyle(live);
        state.immediateLiveVisible =
          !!live &&
          hostStyle.visibility !== "hidden" &&
          liveStyle.visibility !== "hidden" &&
          Number(liveStyle.opacity) > 0;
        state.scrollAfter = hand.scrollLeft;
        await waitUntil(() => !EmberFX.busy);
        state.canceledLandDelta =
          (EmberAudio.played.land || 0) - beforeCanceled;
      } finally {
        document.removeEventListener("ember:fx-busy", onBusy);
        EmberFX.present = originalPresent;
      }
      return state;
    });
    expect(completion.audioState).toBe("running");
    expect(completion.controlLandDelta).toBe(1);
    expect(completion.canceledLandDelta).toBe(0);
    expect(completion.afterCalls).toBe(2);
    expect(completion.busyFalseEvents).toBe(2);
    expect(completion.immediateBusy).toBe(true);
    expect(completion.immediateProxyCount).toBe(0);
    expect(completion.immediateLiveVisible).toBe(true);
    expect(completion.scrollAfter).toBeGreaterThanOrEqual(completion.scrollBefore);
    await expect(page.locator("#hand .hand-card")).toHaveCount(10);
  });
});

async function drawHandoffGeometry(
  page,
  compressed = false,
  { late = "none" } = {},
) {
  const { uid } = await page.evaluate(({ useCompressed, lateMode }) => {
    const g = EmberDebug.game;
    EmberFX.cancel(true);
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    const cards = useCompressed
      ? Array.from({ length: 40 }, (_, i) => ({
          ...g.card("guard"),
          uid: "compressed-hand-" + i,
        }))
      : [g.card("guard")];
    g.s.p.hand = cards;
    let drawCards = cards;
    if (useCompressed) {
      g.events = [];
      g.emit();
      Emberfall.renderNow();
      const hand = document.getElementById("hand"),
        handRect = hand.getBoundingClientRect(),
        visible = cards.find((card) => {
          const el = document.querySelector(`[data-hand="${card.uid}"]`),
            rect = el?.getBoundingClientRect();
          return (
            rect &&
            rect.right > handRect.left &&
            rect.left < handRect.right &&
            rect.bottom > handRect.top &&
            rect.top < handRect.bottom
          );
        });
      drawCards = visible ? [visible, ...cards.filter((card) => card !== visible)] : cards;
      g.events = drawCards.map((card, i) => ({
        id: "compressed-draw-" + i,
        type: "draw",
        parentId: null,
        side: "p",
        uid: card.uid,
        cid: card.cid,
      }));
    } else {
      g.events = [];
      g.draw("p");
    }
    const targetUid = useCompressed ? drawCards[0].uid : g.s.p.hand.at(-1).uid,
      originalAnimate = Element.prototype.animate,
      originalSetTimeout = window.setTimeout,
      probe = {
        originalAnimate,
        originalSetTimeout,
        lateMode,
        targetUid,
        delayedHandoff: false,
        handoffAnimations: [],
        handoffTimer: null,
        handoffProxySnapshot: null,
        handoffObservation: null,
      };
    window.__cardMotionProbe = probe;
    const motionRect = (el) => {
      const r = el?.getBoundingClientRect();
      return r && r.width && r.height
        ? { x: r.x, y: r.y, w: r.width, h: r.height }
        : null;
    };
    const motionSnapshot = () => {
      const proxy = document.querySelector(
          `.card-motion-proxy[data-motion-kind="draw"][data-motion-side="p"][data-motion-uid="${targetUid}"]`,
        ),
        host = document.querySelector(`#hand [data-hand="${targetUid}"]`),
        live = host?.querySelector(".card"),
        proxyStyle = proxy && getComputedStyle(proxy),
        hostStyle = host && getComputedStyle(host),
        liveStyle = live && getComputedStyle(live),
        proxyOpacity = proxyStyle ? Number(proxyStyle.opacity) : 0,
        liveOpacity = liveStyle ? Number(liveStyle.opacity) : 0;
      return {
        t: performance.now(),
        proxy: motionRect(proxy),
        live: motionRect(live),
        proxyVisible:
          !!proxy &&
          proxyStyle.visibility !== "hidden" &&
          proxyOpacity > 0,
        liveVisible:
          !!live &&
          hostStyle.visibility !== "hidden" &&
          liveStyle.visibility !== "hidden" &&
          liveOpacity > 0,
        proxyOpacity,
        liveOpacity,
      };
    };
    Element.prototype.animate = function (frames, options) {
      const animation = originalAnimate.call(this, frames, options);
      const isHandoffProxy =
        this.classList.contains("card-motion-proxy") &&
        options?.easing === "linear" &&
        frames?.[0]?.opacity === 1 &&
        frames?.[1]?.opacity === 1;
      if (isHandoffProxy) {
        probe.handoffAnimations.push({
          at: performance.now(),
          duration: Number(options.duration) || 0,
          delay: Number(options.delay) || 0,
        });
        probe.handoffProxySnapshot = motionSnapshot();
      }
      if (
        this.classList.contains("card") &&
        options?.easing === "linear" &&
        frames?.[0]?.opacity !== undefined
      ) {
        const sample = motionSnapshot();
        if (sample.proxyVisible && sample.liveVisible)
          probe.handoffObservation = {
            before: probe.handoffProxySnapshot,
            after: sample,
          };
      }
      return animation;
    };
    if (lateMode !== "none") {
      window.setTimeout = function (callback, delay, ...args) {
        const meta = callback?.__emberCardTimerMeta;
        if (
          !probe.delayedHandoff &&
          meta?.role === "draw-handoff" &&
          meta.uid === probe.targetUid
        ) {
          const addedDelay = lateMode === "past" ? 80 : 12;
          probe.delayedHandoff = true;
          probe.handoffTimer = {
            role: meta.role,
            uid: meta.uid,
            dueAt: meta.dueAt,
            endAt: meta.endAt,
            requestedDelay: Number(delay) || 0,
            addedDelay,
            scheduledAt: performance.now(),
            firedAt: null,
          };
          const wrapped = (...callbackArgs) => {
            probe.handoffTimer.firedAt = performance.now();
            return callback(...callbackArgs);
          };
          return originalSetTimeout.call(
            window,
            wrapped,
            delay + addedDelay,
            ...args,
          );
        }
        return originalSetTimeout.call(window, callback, delay, ...args);
      };
    }
    g.emit();
    return { uid: targetUid };
  }, { useCompressed: compressed, lateMode: late });
  await expect(
    page.locator(
      `.card-motion-proxy[data-motion-kind="draw"][data-motion-side="p"][data-motion-uid="${uid}"]`,
    ),
  ).toHaveCount(1);
  return page.evaluate(
    ({ uid, useCompressed, lateMode }) =>
      new Promise((resolve) => {
        let previous = null,
          firstOverlap = null,
          firstBefore = null,
          final = null,
          samples = [],
          started = false,
          noProxyFrames = 0;
        const deadline =
          performance.now() +
          (useCompressed ? (lateMode === "past" ? 2200 : 1800) : 1200);
        const rect = (el) => {
          const r = el?.getBoundingClientRect();
          return r && r.width && r.height
            ? { x: r.x, y: r.y, w: r.width, h: r.height }
            : null;
        };
        const sample = () => {
          const proxy = document.querySelector(
              `.card-motion-proxy[data-motion-kind="draw"][data-motion-side="p"][data-motion-uid="${uid}"]`,
            ),
            liveHost = document.querySelector(`#hand [data-hand="${uid}"]`),
            live = liveHost?.querySelector(".card"),
            proxyStyle = proxy && getComputedStyle(proxy),
            hostStyle = liveHost && getComputedStyle(liveHost),
            liveStyle = live && getComputedStyle(live),
            proxyVisible =
              !!proxy &&
              proxyStyle.visibility !== "hidden" &&
              Number(proxyStyle.opacity) > 0,
            liveVisible =
              !!live &&
              hostStyle.visibility !== "hidden" &&
              liveStyle.visibility !== "hidden" &&
              Number(liveStyle.opacity) > 0;
          const current = {
            t: performance.now(),
            proxy: rect(proxy),
            live: rect(live),
            proxyVisible,
            liveVisible,
            proxyOpacity: proxy ? Number(proxyStyle.opacity) : 0,
            liveOpacity: live ? Number(liveStyle.opacity) : 0,
          };
          if (proxy || live) started = true;
          if (started) samples.push(current);
          const probe = window.__cardMotionProbe;
          if (!firstOverlap && probe?.handoffObservation?.after) {
            firstBefore = probe.handoffObservation.before || previous;
            firstOverlap = probe.handoffObservation.after;
          }
          if (!firstOverlap && liveVisible && proxyVisible && previous?.proxy) {
            firstBefore = previous;
            firstOverlap = current;
          }
          const pastDeadline = lateMode === "past";
          if ((firstOverlap || pastDeadline) && !proxy && liveVisible)
            noProxyFrames++;
          else noProxyFrames = 0;
          if (
            (pastDeadline
              ? probe?.handoffTimer &&
                performance.now() >= probe.handoffTimer.endAt &&
                liveVisible &&
                !proxy
              : firstOverlap) &&
            noProxyFrames >= 3
          ) {
            final = current;
            const result = {
              before: firstBefore,
              after: firstOverlap,
              final,
              samples,
              lateMode,
              delayedHandoff: !!probe?.delayedHandoff,
              handoffAnimations: probe?.handoffAnimations || [],
              handoffTimer: probe?.handoffTimer || null,
            };
            if (probe) {
              Element.prototype.animate = probe.originalAnimate;
              window.setTimeout = probe.originalSetTimeout;
              delete window.__cardMotionProbe;
            }
            resolve(result);
            return;
          }
          previous = current;
          if (performance.now() >= deadline) {
            const probe = window.__cardMotionProbe,
              result = {
                error: "draw handoff was not observed",
                before: firstBefore || previous,
                after: firstOverlap,
                final,
                samples,
                lateMode,
                delayedHandoff: !!probe?.delayedHandoff,
                handoffAnimations: probe?.handoffAnimations || [],
                handoffTimer: probe?.handoffTimer || null,
              };
            if (probe) {
              Element.prototype.animate = probe.originalAnimate;
              window.setTimeout = probe.originalSetTimeout;
              delete window.__cardMotionProbe;
            }
            resolve(result);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    { uid, useCompressed: compressed, lateMode: late },
  );
}

function assertDrawHandoffGeometry(handoff) {
  expect(handoff.error).toBeUndefined();
  expect(handoff.before).toBeTruthy();
  expect(handoff.after).toBeTruthy();
  expect(handoff.final).toBeTruthy();
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const before = center(handoff.before.proxy),
    afterProxy = center(handoff.after.proxy),
    afterLive = center(handoff.after.live),
    finalLive = center(handoff.final.live);
  expect(Number.isFinite(before.x + before.y)).toBe(true);
  expect(Number.isFinite(handoff.before.proxy.w + handoff.before.proxy.h)).toBe(true);
  expect(handoff.before.proxyVisible).toBe(true);
  expect(handoff.after.liveVisible).toBe(true);
  expect(handoff.after.liveOpacity).toBeGreaterThan(0);
  expect(Math.hypot(afterProxy.x - afterLive.x, afterProxy.y - afterLive.y)).toBeLessThan(16);
  expect(Math.abs(handoff.after.proxy.w - handoff.after.live.w)).toBeLessThan(16);
  expect(Math.abs(handoff.after.proxy.h - handoff.after.live.h)).toBeLessThan(16);
  expect(Number.isFinite(finalLive.x + finalLive.y)).toBe(true);
  expect(handoff.final.liveVisible).toBe(true);
  expect(handoff.final.liveOpacity).toBeGreaterThan(0.95);
  expect(handoff.samples.length).toBeGreaterThan(2);
  // Once the first card object is painted, no sampled compositor frame may
  // contain neither a visible proxy nor a visible live card.
  expect(handoff.samples.every((sample) => sample.proxyVisible || sample.liveVisible)).toBe(true);
  const proxySamples = handoff.samples.filter(
    (sample) => sample.proxy && sample.proxyVisible,
  );
  const maxProxyStepRate = Math.max(
    0,
    ...proxySamples.slice(1).map((sample, i) => {
      const previous = proxySamples[i];
      const distance = Math.hypot(
          center(sample.proxy).x - center(previous.proxy).x,
          center(sample.proxy).y - center(previous.proxy).y,
        ),
        frameCount = Math.max(1, (sample.t - previous.t) / 16);
      return distance / frameCount;
    }),
  );
  // The deck-to-hand flight can cover several hundred logical pixels in one
  // short beat; compare velocity, not raw frame distance, so a delayed frame
  // is not misclassified as a handoff jump.
  expect(maxProxyStepRate).toBeLessThan(160);
  const boundaryAdvance = Math.hypot(
    afterProxy.x - before.x,
    afterProxy.y - before.y,
  );
  const boundaryMs = Math.max(16, handoff.after.t - handoff.before.t);
  expect(boundaryAdvance).toBeLessThan(90 * Math.max(1, boundaryMs / 16));
}

function assertDrawDeadlineSkip(handoff) {
  expect(handoff.error).toBeUndefined();
  expect(handoff.delayedHandoff).toBe(true);
  expect(handoff.handoffTimer).toBeTruthy();
  expect(handoff.handoffTimer.firedAt).toBeNull();
  expect(
    handoff.handoffTimer.dueAt + handoff.handoffTimer.addedDelay,
  ).toBeGreaterThan(handoff.handoffTimer.endAt);
  expect(handoff.handoffAnimations).toEqual([]);
  expect(handoff.final).toBeTruthy();
  expect(handoff.final.proxy).toBeNull();
  expect(handoff.final.liveVisible).toBe(true);
  expect(handoff.final.liveOpacity).toBeGreaterThan(0.95);
  expect(
    handoff.samples.every((sample) => sample.proxyVisible || sample.liveVisible),
  ).toBe(true);
}

for (const [label, viewport, isMobile] of [
  ["desktop", { width: 1280, height: 720 }, false],
  ["portrait", { width: 390, height: 844 }, true],
  ["landscape", { width: 844, height: 390 }, true],
]) {
  test.describe(`draw handoff geometry · ${label}`, () => {
    test.use({ viewport, isMobile, hasTouch: isMobile });

    test("keeps center and both dimensions continuous across handoff", async ({
      page,
    }) => {
      await demo(page);
      const normal = await drawHandoffGeometry(page);
      assertDrawHandoffGeometry(normal);
      await page.waitForFunction(() => !EmberFX.busy);
      const compressed = await drawHandoffGeometry(page, true, { late: "mid" });
      assertDrawHandoffGeometry(compressed);
      expect(compressed.delayedHandoff).toBe(true);
      expect(compressed.handoffTimer.firedAt).toBeGreaterThan(
        compressed.handoffTimer.dueAt + 6,
      );
      expect(compressed.handoffTimer.firedAt).toBeLessThan(
        compressed.handoffTimer.endAt,
      );
      expect(normal.handoffAnimations.length).toBeGreaterThan(0);
      expect(compressed.handoffAnimations.length).toBeGreaterThan(0);
      expect(compressed.handoffAnimations[0].delay).toBe(0);
      expect(compressed.handoffAnimations[0].duration).toBeLessThan(
        normal.handoffAnimations[0].duration,
      );
      await page.waitForFunction(() => !EmberFX.busy);
      const expired = await drawHandoffGeometry(page, true, { late: "past" });
      assertDrawDeadlineSkip(expired);
      await page.waitForFunction(() => !EmberFX.busy);
    });
  });
}

async function rebindSurfaceScenario(page, { clipped = false } = {}) {
  await demo(page);
  await prepare(page, {
    hand: clipped ? Array.from({ length: 9 }, () => "guard") : ["guard"],
  });
  const identity = await page.evaluate(() => {
    const originalPresent = EmberFX.present,
      originalAnimate = Element.prototype.animate,
      state = { afterCalls: 0, surfaceAnimations: 0 };
    EmberFX.present = function (...args) {
      const after = args[3];
      args[3] = (...afterArgs) => {
        state.afterCalls++;
        return after?.(...afterArgs);
      };
      return originalPresent.apply(this, args);
    };
    Element.prototype.animate = function (frames, options) {
      if (
        this.classList.contains("card") &&
        options?.easing === "linear" &&
        frames?.[0]?.opacity !== undefined
      )
        state.surfaceAnimations++;
      return originalAnimate.call(this, frames, options);
    };
    const g = EmberDebug.game;
    g.events = [];
    g.draw("p");
    const uid = g.s.p.hand.at(-1).uid;
    g.emit();
    window.__cardRebindProbe = { originalPresent, originalAnimate, state };
    return { uid };
  });
  const poses = await page.evaluate(
    (uid) =>
      new Promise((resolve, reject) => {
        const rect = (el) => {
          const r = el?.getBoundingClientRect();
          return r && r.width && r.height
            ? { x: r.x, y: r.y, w: r.width, h: r.height }
            : null;
        };
        const read = () => {
          const host = document.querySelector(`#hand [data-hand="${uid}"]`),
            live = host?.querySelector(".card"),
            proxy = document.querySelector(
              `.card-motion-proxy[data-motion-kind="draw"][data-motion-uid="${uid}"]`,
            ),
            hostStyle = host && getComputedStyle(host),
            liveStyle = live && getComputedStyle(live),
            proxyStyle = proxy && getComputedStyle(proxy);
          return {
            rect: rect(live),
            opacity: liveStyle ? Number(liveStyle.opacity) : 0,
            hostVisible:
              !!host && hostStyle.visibility !== "hidden" && hostStyle.display !== "none",
            liveVisible:
              !!live && liveStyle.visibility !== "hidden" && liveStyle.display !== "none",
            proxyOpacity: proxyStyle ? Number(proxyStyle.opacity) : 0,
            card: live,
            inline: live
              ? {
                  opacity: live.style.opacity,
                  translate: live.style.translate,
                  scale: live.style.scale,
                  transform: live.style.transform,
                }
              : null,
          };
        };
        const strip = ({ card, ...value }) => value;
        const deadline = performance.now() + 900;
        const sample = () => {
          const before = read();
          if (
            before.card &&
            before.hostVisible &&
            before.liveVisible &&
            before.opacity > 0.05 &&
            before.opacity < 0.95 &&
            before.proxyOpacity > 0.2
          ) {
            const beforeCard = before.card,
              probe = window.__cardRebindProbe,
              beforeAnimations = probe?.state.surfaceAnimations || 0;
            Emberfall.renderNow();
            const afterRender = read(),
              renderCardChanged = afterRender.card !== beforeCard;
            EmberFX.captureCardTargets();
            const host = document.querySelector(`#hand [data-hand="${uid}"]`),
              oldCard = host?.querySelector(".card");
            if (!oldCard) {
              reject(new Error("rebind surface disappeared before clone"));
              return;
            }
            const clonedCard = oldCard.cloneNode(true);
            oldCard.replaceWith(clonedCard);
            EmberFX.syncCardTargets();
            const afterInnerReplacement = read();
            resolve({
              before: strip(before),
              afterRender: strip(afterRender),
              afterInnerReplacement: strip(afterInnerReplacement),
              renderCardChanged,
              innerCardChanged: afterInnerReplacement.card === clonedCard,
              beforeAnimations,
              afterRenderAnimations: probe?.state.surfaceAnimations || 0,
            });
            return;
          }
          if (performance.now() >= deadline) {
            reject(new Error("rebind surface never entered visible crossfade"));
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
    identity.uid,
  );
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const assertContinuous = (before, after) => {
    expect(before.rect).toBeTruthy();
    expect(after.rect).toBeTruthy();
    expect(Math.hypot(center(before.rect).x - center(after.rect).x, center(before.rect).y - center(after.rect).y)).toBeLessThan(8);
    expect(Math.abs(before.rect.w - after.rect.w)).toBeLessThan(8);
    expect(Math.abs(before.rect.h - after.rect.h)).toBeLessThan(8);
    expect(Math.abs(before.opacity - after.opacity)).toBeLessThan(0.18);
  };
  expect(poses.renderCardChanged).toBe(true);
  expect(poses.innerCardChanged).toBe(true);
  expect(poses.afterRenderAnimations).toBeGreaterThan(poses.beforeAnimations);
  assertContinuous(poses.before, poses.afterRender);
  assertContinuous(poses.afterRender, poses.afterInnerReplacement);
  await page.waitForFunction(() => !EmberFX.busy);
  const result = await page.evaluate(() => {
    const probe = window.__cardRebindProbe;
    Element.prototype.animate = probe.originalAnimate;
    EmberFX.present = probe.originalPresent;
    const output = {
      afterCalls: probe.state.afterCalls,
      surfaceAnimations: probe.state.surfaceAnimations,
      finalInline: document.querySelector("#hand .hand-card:last-child .card")
        ? (() => {
            const card = document.querySelector("#hand .hand-card:last-child .card");
            return {
              opacity: card.style.opacity,
              translate: card.style.translate,
              scale: card.style.scale,
              transform: card.style.transform,
            };
          })()
        : null,
    };
    delete window.__cardRebindProbe;
    return output;
  });
  expect(result.afterCalls).toBe(1);
  expect(result.surfaceAnimations).toBeGreaterThanOrEqual(3);
  expect(result.finalInline).toEqual({
    opacity: "",
    translate: "",
    scale: "",
    transform: "",
  });
  await expect(
    page.locator(
      `.card-motion-proxy[data-motion-kind="draw"][data-motion-uid="${identity.uid}"]`,
    ),
  ).toHaveCount(0);
  expect(
    await page.locator(`#hand [data-hand="${identity.uid}"] .card`).evaluate(
      (el) => {
        const host = el.parentElement,
          style = getComputedStyle(el);
        return (
          getComputedStyle(host).visibility !== "hidden" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0.95
        );
      },
    ),
  ).toBe(true);
}

test("rebinds a replaced landing surface from its current painted pose", async ({
  page,
}) => {
  await rebindSurfaceScenario(page);
});

test.describe("rebinds a clipped mobile landing surface", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("keeps nonzero hand-edge transforms continuous through surface replacement", async ({
    page,
  }) => {
    await rebindSurfaceScenario(page, { clipped: true });
  });
});

test("a failed handoff animation restores the live card and keeps the sequence commit", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["guard"] });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.evaluate(() => {
    const originalAnimate = Element.prototype.animate,
      originalPresent = EmberFX.present,
      state = { injected: false, afterCalls: 0 };
    EmberFX.present = function (...args) {
      const after = args[3];
      args[3] = (...afterArgs) => {
        state.afterCalls++;
        return after?.(...afterArgs);
      };
      return originalPresent.apply(this, args);
    };
    Element.prototype.animate = function (frames, options) {
      if (
        this.classList.contains("card-motion-proxy") &&
        options?.easing === "linear" &&
        frames?.[0]?.opacity === 1 &&
        frames?.[1]?.opacity === 1
      ) {
        state.injected = true;
        throw new Error("forced card handoff failure");
      }
      return originalAnimate.call(this, frames, options);
    };
    const g = EmberDebug.game;
    g.events = [];
    g.draw("p");
    g.emit();
    window.__cardMotionHandoffFailure = {
      state,
      cleanup() {
        Element.prototype.animate = originalAnimate;
        EmberFX.present = originalPresent;
        delete window.__cardMotionHandoffFailure;
      },
    };
  });
  await page.waitForFunction(() => window.__cardMotionHandoffFailure?.state.injected);
  await expect(page.locator(".card-motion-proxy")).toHaveCount(0);
  expect(
    await page.locator("#hand .hand-card").last().evaluate((el) => {
      const style = getComputedStyle(el),
        card = el.querySelector(".card"),
        cardStyle = card && getComputedStyle(card);
      return (
        style.visibility !== "hidden" &&
        cardStyle.visibility !== "hidden" &&
        Number(cardStyle.opacity) > 0
      );
    }),
  ).toBe(true);
  await page.waitForFunction(() => !EmberFX.busy);
  const result = await page.evaluate(() => {
    const result = { ...window.__cardMotionHandoffFailure.state };
    window.__cardMotionHandoffFailure.cleanup();
    return result;
  });
  expect(pageErrors).toEqual([]);
  expect(result.afterCalls).toBe(1);
});

test("a failed card-motion start cleans up the registered draw watcher", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["guard"] });
  const result = await page.evaluate(async () => {
    const original = Element.prototype.animate,
      originalAdd = EventTarget.prototype.addEventListener,
      originalRemove = EventTarget.prototype.removeEventListener,
      originalSetTimeout = window.setTimeout,
      originalClearTimeout = window.clearTimeout,
      hand = document.getElementById("hand"),
      stats = {
        scrollAdded: 0,
        scrollRemoved: 0,
        cardTimerCreated: 0,
        cardTimerCleared: 0,
        pendingCardTimers: 0,
        liveRestored: false,
      },
      pendingCardTimers = new Set();
    let drawnUid = null;
    window.setTimeout = function (callback, delay, ...args) {
      const isCardTimer = (new Error().stack || "").includes("scheduleCardAt");
      let timer;
      const wrapped = (...callbackArgs) => {
        if (isCardTimer) pendingCardTimers.delete(timer);
        return callback(...callbackArgs);
      };
      timer = originalSetTimeout.call(window, wrapped, delay, ...args);
      if (isCardTimer) {
        pendingCardTimers.add(timer);
        stats.cardTimerCreated++;
      }
      return timer;
    };
    window.clearTimeout = function (timer) {
      if (pendingCardTimers.delete(timer)) stats.cardTimerCleared++;
      return originalClearTimeout.call(window, timer);
    };
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (this === hand && type === "scroll") stats.scrollAdded++;
      return originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (this === hand && type === "scroll") stats.scrollRemoved++;
      return originalRemove.call(this, type, listener, options);
    };
    Element.prototype.animate = function (frames, options) {
      if (this.classList.contains("card-motion-proxy"))
        throw new Error("forced card-motion startup failure");
      return original.call(this, frames, options);
    };
    try {
      const g = EmberDebug.game;
      g.draw("p");
      drawnUid = g.s.p.hand.at(-1).uid;
      g.emit();
      await new Promise((resolve) => originalSetTimeout.call(window, resolve, 40));
      const live = document.querySelector(`#hand [data-hand="${drawnUid}"] .card`),
        liveHost = document.querySelector(`#hand [data-hand="${drawnUid}"]`),
        liveStyle = live && getComputedStyle(live),
        hostStyle = liveHost && getComputedStyle(liveHost);
      stats.liveRestored =
        !!live &&
        !!liveStyle &&
        !!hostStyle &&
        hostStyle.visibility !== "hidden" &&
        liveStyle.visibility !== "hidden" &&
        Number(liveStyle.opacity) > 0;
      stats.busy = EmberFX.busy;
      stats.pendingCardTimers = pendingCardTimers.size;
    } finally {
      Element.prototype.animate = original;
      EventTarget.prototype.addEventListener = originalAdd;
      EventTarget.prototype.removeEventListener = originalRemove;
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    }
    return stats;
  });
  expect(result.busy).toBe(true);
  expect(result.liveRestored).toBe(true);
  expect(result.scrollAdded).toBeGreaterThan(0);
  expect(result.scrollRemoved).toBe(result.scrollAdded);
  expect(result.cardTimerCreated).toBeGreaterThan(0);
  expect(result.pendingCardTimers).toBe(0);
  expect(result.cardTimerCleared).toBeGreaterThan(0);
  await expect(page.locator(".card-motion-proxy")).toHaveCount(0);
  await page.waitForTimeout(360);
  expect(await page.evaluate(() => EmberFX.busy)).toBe(false);
  await page.evaluate(() => {
    const hand = document.getElementById("hand");
    hand.scrollLeft = Math.min(hand.scrollWidth - hand.clientWidth, 10);
    hand.dispatchEvent(new Event("scroll"));
  });
  expect(await page.evaluate(() => EmberFX.busy)).toBe(false);
});
