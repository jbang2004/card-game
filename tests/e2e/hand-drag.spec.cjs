/* Touch drag-to-play, aiming and dismissal on the shared battle pointer plane.
 * Runs the same gesture rules in landscape and portrait, because the hand rail
 * and the arena swap ends when the phone turns. */
const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const out = path.resolve("artifacts/qa");
fs.mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  ["portrait", { width: 390, height: 844 }],
  ["landscape", { width: 844, height: 390 }],
];

async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.waitForTimeout(100);
}
async function idle(page) {
  await page.waitForFunction(() => !EmberFX.busy);
}

async function startTouch(page) {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#quick-btn").click();
  await idle(page);
  await page.waitForTimeout(400);
}

/* Cards are classified from the deck data so a test never depends on the
 * shuffle: "plain" cards need no target, "targeted" ones do. */
async function pick(page, kind) {
  return page.evaluate((wanted) => {
    const out = [];
    document.querySelectorAll("#hand .hand-card").forEach((el) => {
      const c = EmberData.byId[el.dataset.cardid];
      if (!el.classList.contains("playable")) return;
      if (!!c.target !== wanted) return;
      if (wanted === false && c.type === "weapon") return;
      out.push({ uid: el.dataset.hand, cid: el.dataset.cardid, type: c.type });
    });
    return out[0] || null;
  }, kind === "targeted");
}

async function handState(page) {
  return page.evaluate(() => {
    const hand = document.getElementById("hand");
    const detail = document.getElementById("card-preview");
    return {
      handCount: document.getElementById("hand-count").textContent,
      mana: document.getElementById("mana-value").textContent,
      validTargets: document.querySelectorAll(".valid-target").length,
      selected: document.querySelectorAll("#hand .hand-card.selected").length,
      targeting: !document.getElementById("touch-target-bar").hidden,
      aimFocus: document.querySelectorAll(".aim-focus").length,
      dragSource: document.querySelectorAll(".drag-source").length,
      ghost: document.querySelectorAll(".drag-ghost").length,
      snapped: document.querySelectorAll(".drag-ghost.is-snapped").length,
      snapMode: document.querySelector(".drag-ghost")?.dataset.snapMode || null,
      toast: document.getElementById("toast").textContent,
      hint: document.getElementById("hint").textContent,
      detail: detail.dataset.mode || null,
      detailOpen: detail.classList.contains("open"),
      scrollLeft: hand.scrollLeft,
      scrollWidth: hand.scrollWidth,
      clientWidth: hand.clientWidth,
    };
  });
}

/* Touch drag via CDP: the same pointer stream a finger produces. */
async function touchDrag(page, from, to, steps = 14) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
      ],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  await page.waitForTimeout(700);
}

async function boxOf(page, uid) {
  const b = await page.locator(`#hand [data-hand="${uid}"]`).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/* Lower half of the arena, on a screen point that has no unit under it, so the
 * drop can only be judged by the play-area rule. */
async function emptyDropPoint(page) {
  return page.evaluate(() => {
    const a = EmberViewport.layout.arena;
    const unit = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el?.closest?.("[data-uid]") ? 1 : 0;
    };
    let fallback = null;
    for (let fy = 0.8; fy >= 0.42; fy -= 0.12) {
      for (let fx = 0.14; fx <= 0.87; fx += 0.12) {
        const x = Math.round(a.x + a.w * fx),
          y = Math.round(a.y + a.h * fy);
        if (!fallback) fallback = { x, y };
        if (!unit(x, y)) return { x, y };
      }
    }
    return fallback;
  });
}

async function prepareSingleMinion(page) {
  return page.evaluate(() => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.p.hand = [g.card("guard")];
    g.events = [];
    g.emit();
    return g.s.p.hand[0].uid;
  });
}

async function releaseArcherWithPose(page, settleMs) {
  const uid = await prepareSingleMinion(page),
    box = await page.locator(`#hand [data-hand="${uid}"]`).boundingBox(),
    from = { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    to = await page.evaluate((fromPoint) => {
      const a = EmberViewport.layout.arena;
      const candidates = [
        { x: fromPoint.x, y: a.y + a.h * 0.54 },
        { x: a.x + a.w * 0.5, y: a.y + a.h * 0.54 },
        { x: a.x + a.w * 0.35, y: a.y + a.h * 0.54 },
        { x: a.x + a.w * 0.65, y: a.y + a.h * 0.54 },
      ];
      return (
        candidates.find((point) => {
          const el = document.elementFromPoint(point.x, point.y);
          return (
            point.x >= a.x &&
            point.x <= a.x + a.w &&
            point.y >= a.y &&
            point.y <= a.y + a.h &&
            !el?.closest?.("[data-uid]")
          );
        }) || candidates[0]
      );
    }, from),
    cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  await page.waitForTimeout(540);
  const staging = await page.evaluate((point) => {
    const arena = EmberViewport.layout.arena;
    return {
      x: point.x,
      y: Math.min(window.innerHeight - 8, arena.y + arena.h + 18),
    };
  }, to);
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + (staging.x - from.x) * t,
          y: from.y + (staging.y - from.y) * t,
        },
      ],
    });
    await page.waitForTimeout(16);
  }
  await expect(page.locator(".drag-ghost.is-snapped")).toHaveCount(0);
  await page.evaluate(() => {
    const state = {
      startedAt: performance.now(),
      samples: [],
      stop: false,
      firstSnappedAt: null,
    };
    const transformScale = (value) => {
      const numbers = value?.match(/^matrix\(([^)]+)\)$/)?.[1]
        ?.split(",")
        .map(Number);
      if (!numbers || numbers.length < 4)
        return { x: 1, y: 1 };
      return {
        x: Math.hypot(numbers[0], numbers[1]),
        y: Math.hypot(numbers[2], numbers[3]),
      };
    };
    const sample = () => {
      const ghost = document.querySelector(".drag-ghost"),
        rect = ghost?.getBoundingClientRect(),
        style = ghost && getComputedStyle(ghost),
        scale = transformScale(style?.transform);
      if (rect)
        state.samples.push({
          t: performance.now(),
          snapped: ghost.classList.contains("is-snapped"),
          x: rect.x,
          y: rect.y,
          w: rect.width,
          h: rect.height,
          transitionMs: style
            ? parseFloat(style.transitionDuration.split(",")[0]) * 1000
            : 0,
          scaleX: scale.x,
          scaleY: scale.y,
        });
      if (ghost?.classList.contains("is-snapped") && !state.firstSnappedAt)
        state.firstSnappedAt = performance.now();
      if (!state.stop && performance.now() - state.startedAt < 420)
        requestAnimationFrame(sample);
    };
    window.__dragSnapTrace = state;
    sample();
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [to],
  });
  await page.evaluate(() => {
    const state = { pose: null };
    const readPose = () => {
      const ghost = document.querySelector(".drag-ghost"),
        rect = ghost?.getBoundingClientRect(),
        style = ghost && getComputedStyle(ghost),
        numbers = style?.transform
          ?.match(/^matrix\(([^)]+)\)$/)?.[1]
          ?.split(",")
          .map(Number),
        scaleX = numbers?.length >= 4 ? Math.hypot(numbers[0], numbers[1]) : 1,
        scaleY = numbers?.length >= 4 ? Math.hypot(numbers[2], numbers[3]) : 1;
      return rect
        ? {
            t: performance.now(),
            snapped: ghost.classList.contains("is-snapped"),
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            transitionMs: style
              ? parseFloat(style.transitionDuration.split(",")[0]) * 1000
              : 0,
            scaleX,
            scaleY,
          }
        : null;
    };
    const capture = () => {
      if (!state.pose) state.pose = readPose();
      if (state.pose) {
        document.removeEventListener("pointerup", capture, true);
        document.removeEventListener("touchend", capture, true);
      }
    };
    state.capture = capture;
    window.__dragReleaseProbe = state;
    document.addEventListener("pointerup", capture, true);
    document.addEventListener("touchend", capture, true);
  });
  await page.waitForTimeout(settleMs);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  const snapObservation = await page.evaluate((waitMs) => {
    const state = window.__dragSnapTrace,
      samples = state?.samples || [],
      first = samples[0],
      firstSnapped = samples.find((sample) => sample.snapped),
      current = firstSnapped
        ? samples
            .filter((sample) => sample.t <= firstSnapped.t + waitMs + 24)
            .at(-1) || firstSnapped
        : samples.at(-1),
      snapped = samples.filter((sample) => sample.snapped),
      transitionMs = Math.max(0, ...samples.map((sample) => sample.transitionMs)),
      currentScaleX = current?.scaleX ?? 1,
      currentScaleY = current?.scaleY ?? 1,
      hasIntermediateScale = samples.some(
        (sample) =>
          sample.snapped &&
          sample.scaleX > 0.795 &&
          sample.scaleX < 0.995 &&
          sample.scaleY > 0.795 &&
          sample.scaleY < 0.995,
      ),
      currentNotFinal =
        !!current &&
        current.snapped &&
        (Math.abs(currentScaleX - 0.78) > 0.012 ||
          Math.abs(currentScaleY - 0.78) > 0.012),
      movedFromStart =
        first && current
          ? Math.max(
              Math.hypot(
                current.x + current.w / 2 - (first.x + first.w / 2),
                current.y + current.h / 2 - (first.y + first.h / 2),
              ),
              Math.abs(current.w - first.w),
              Math.abs(current.h - first.h),
            )
          : 0;
    if (state) state.stop = true;
    return {
      frames: samples.length,
      snappedFrames: snapped.length,
      transitionMs,
      currentScaleX,
      currentScaleY,
      hasIntermediateScale,
      currentNotFinal,
      movedFromStart,
      hadUnsnappedFrame: samples.some((sample) => !sample.snapped),
    };
  }, settleMs);
  const releaseInfo = await page.evaluate(() => {
    const probe = window.__dragReleaseProbe,
      state = window.__dragSnapTrace,
      release = probe?.pose || null,
      first = state?.samples?.[0] || null,
      intermediate =
        !!release &&
        release.snapped &&
        release.scaleX > 0.795 &&
        release.scaleX < 1.105 &&
        release.scaleY > 0.795 &&
        release.scaleY < 1.105,
      notFinal =
        !!release &&
        release.snapped &&
        (Math.abs(release.scaleX - 0.78) > 0.012 ||
          Math.abs(release.scaleY - 0.78) > 0.012),
      movedFromStart =
        first && release
          ? Math.max(
              Math.hypot(
                release.x + release.w / 2 - (first.x + first.w / 2),
                release.y + release.h / 2 - (first.y + first.h / 2),
              ),
              Math.abs(release.w - first.w),
              Math.abs(release.h - first.h),
            )
          : 0;
    if (probe?.capture) {
      document.removeEventListener("pointerup", probe.capture, true);
      document.removeEventListener("touchend", probe.capture, true);
    }
    delete window.__dragReleaseProbe;
    delete window.__dragSnapTrace;
    return {
      release,
      intermediate,
      notFinal,
      movedFromStart,
      releaseDelta: release && state?.firstSnappedAt
        ? release.t - state.firstSnappedAt
        : null,
    };
  });
  const releasePose = releaseInfo.release,
    ghostPose = {
      x: releasePose.x + releasePose.w / 2,
      y: releasePose.y + releasePose.h / 2,
      w: releasePose.w,
      h: releasePose.h,
    };
  const proxyPose = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deadline = performance.now() + 2000;
        const read = () => {
          const el = document.querySelector(
            '.card-motion-proxy[data-motion-kind="play"]',
          );
          if (el) {
            const r = el.getBoundingClientRect();
            resolve({
              x: r.x + r.width / 2,
              y: r.y + r.height / 2,
              w: r.width,
              h: r.height,
            });
            return;
          }
          if (performance.now() >= deadline) {
            resolve(null);
            return;
          }
          requestAnimationFrame(read);
        };
        read();
      }),
  );
  expect(proxyPose).toBeTruthy();
  return {
    ghostPose,
    proxyPose,
    snapFrames: snapObservation.frames,
    snapSnappedFrames: snapObservation.snappedFrames,
    snapHadUnsnappedFrame: snapObservation.hadUnsnappedFrame,
    snapTransitionMs: snapObservation.transitionMs,
    snapCurrentScaleX: snapObservation.currentScaleX,
    snapCurrentScaleY: snapObservation.currentScaleY,
    snapHasIntermediateScale: snapObservation.hasIntermediateScale,
    snapCurrentNotFinal: snapObservation.currentNotFinal,
    snapMovedFromStart: snapObservation.movedFromStart,
    releasePose: releaseInfo.release,
    releaseHasIntermediateScale: releaseInfo.intermediate,
    releaseNotFinal: releaseInfo.notFinal,
    releaseMovedFromStart: releaseInfo.movedFromStart,
    releaseDelta: releaseInfo.releaseDelta,
    snapInProgress:
      releaseInfo.release?.snapped === true &&
      releaseInfo.intermediate &&
      releaseInfo.notFinal &&
      releaseInfo.movedFromStart > 0.1,
  };
}

async function firstPlayProxyPose(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const deadline = performance.now() + 2000;
        const read = () => {
          const el = document.querySelector(
            '.card-motion-proxy[data-motion-kind="play"]',
          );
          if (el) {
            const r = el.getBoundingClientRect();
            resolve({
              x: r.x + r.width / 2,
              y: r.y + r.height / 2,
              w: r.width,
              h: r.height,
            });
            return;
          }
          if (performance.now() >= deadline) {
            resolve(null);
            return;
          }
          requestAnimationFrame(read);
        };
        read();
      }),
  );
}

function assertPoseContinuity(source, proxy, tolerance = 14) {
  expect(proxy).toBeTruthy();
  expect(
    Math.hypot(
      source.x + source.width / 2 - proxy.x,
      source.y + source.height / 2 - proxy.y,
    ),
  ).toBeLessThan(tolerance);
  expect(Math.abs(source.width - proxy.w)).toBeLessThan(tolerance);
  expect(Math.abs(source.height - proxy.h)).toBeLessThan(tolerance);
}

/* Fill the rail past its width so a pan gesture has somewhere to go. */
async function fillHand(page) {
  return page.evaluate(() => {
    const g = EmberDebug.game;
    while (g.s.p.hand.length < 10)
      g.s.p.hand.push({ ...g.s.p.hand[0], uid: "pan-" + g.s.p.hand.length });
    Emberfall.renderNow();
    const h = document.getElementById("hand");
    return {
      n: g.s.p.hand.length,
      scrollWidth: h.scrollWidth,
      clientWidth: h.clientWidth,
    };
  });
}

for (const [label, viewport] of VIEWPORTS) {
  test.describe(`touch battle gestures · ${label}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test("drag a targetless card onto the board plays it in one gesture", async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await startTouch(page);

      const card = await pick(page, "plain");
      expect(card).toBeTruthy();
      const before = await handState(page);
      const from = await boxOf(page, card.uid);
      await touchDrag(page, from, await emptyDropPoint(page));
      const after = await handState(page);
      const stillInHand = await page.evaluate(
        (uid) => !!document.querySelector(`#hand [data-hand="${uid}"]`),
        card.uid,
      );
      await page.screenshot({
        path: path.join(out, `touch-drag-play-${label}.png`),
      });
      expect(stillInHand).toBe(false);
      expect(after.ghost).toBe(0);
      expect(after.dragSource).toBe(0);
      expect(Number(after.handCount)).toBe(Number(before.handCount) - 1);
      expect(after.mana).not.toBe(before.mana);
      expect(errors).toEqual([]);
    });

    test("a dragged target card arms aiming with a visible reticle", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "targeted");
      expect(card).toBeTruthy();
      const before = await handState(page);
      const from = await boxOf(page, card.uid);
      await touchDrag(page, from, await emptyDropPoint(page));
      const after = await handState(page);
      await page.screenshot({
        path: path.join(out, `touch-drag-aim-${label}.png`),
      });
      expect(after.validTargets).toBeGreaterThan(0);
      expect(after.mana).toBe(before.mana);
      expect(Number(after.handCount)).toBe(Number(before.handCount));
      expect(before.validTargets).toBe(0);
    });

    test("aiming follows the finger and confirms on a legal target", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "targeted");
      expect(card).toBeTruthy();
      const from = await boxOf(page, card.uid);
      const enemy = await page.evaluate(() => {
        const el = document.querySelector("#battle .minion.enemy");
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
        };
      });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: from.x, y: from.y }],
      });
      const lift = { x: from.x, y: from.y - 70 };
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: from.x + (lift.x - from.x) * t,
              y: from.y + (lift.y - from.y) * t,
            },
          ],
        });
        await page.waitForTimeout(16);
      }
      expect(await page.locator("#target-path").getAttribute("d")).toMatch(
        /^M/,
      );
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: lift.x + (enemy.x - lift.x) * t,
              y: lift.y + (enemy.y - lift.y) * t,
            },
          ],
        });
        await page.waitForTimeout(16);
      }
      await page.screenshot({
        path: path.join(out, `touch-aim-reticle-${label}.png`),
      });
      expect((await handState(page)).aimFocus).toBe(1);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      await page.waitForTimeout(700);
      const after = await handState(page);
      const stillInHand = await page.evaluate(
        (uid) => !!document.querySelector(`#hand [data-hand="${uid}"]`),
        card.uid,
      );
      expect(stillInHand).toBe(false);
      expect(after.validTargets).toBe(0);
      expect(after.aimFocus).toBe(0);
    });

    test("releasing a targetless card on an enemy unit never plays it", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "plain");
      expect(card).toBeTruthy();
      const before = await handState(page);
      const from = await boxOf(page, card.uid);
      const enemy = await page.evaluate(() => {
        const el = document.querySelector("#battle .minion.enemy");
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
        };
      });
      expect(enemy).toBeTruthy();
      await touchDrag(page, from, enemy);
      const after = await handState(page);
      const stillInHand = await page.evaluate(
        (uid) => !!document.querySelector(`#hand [data-hand="${uid}"]`),
        card.uid,
      );
      await page.screenshot({
        path: path.join(out, `touch-drag-rejected-${label}.png`),
      });
      expect(stillInHand).toBe(true);
      expect(after.mana).toBe(before.mana);
      expect(Number(after.handCount)).toBe(Number(before.handCount));
      expect(after.toast).toContain("不需要目标");
    });

    test("dragging back into the hand cancels without spending mana", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "plain");
      expect(card).toBeTruthy();
      const before = await handState(page);
      const from = await boxOf(page, card.uid);
      await touchDrag(page, from, { x: from.x, y: from.y - 90 }, 8);
      expect((await handState(page)).hint).toContain("拖入战场");
      await touchDrag(page, { x: from.x, y: from.y - 90 }, from, 8);
      const after = await handState(page);
      const stillInHand = await page.evaluate(
        (uid) => !!document.querySelector(`#hand [data-hand="${uid}"]`),
        card.uid,
      );
      await page.screenshot({
        path: path.join(out, `touch-drag-cancel-${label}.png`),
      });
      expect(stillInHand).toBe(true);
      expect(after.mana).toBe(before.mana);
      expect(after.toast).toContain("已取消");
    });

    test("a tap prepares a targetless card, then the board confirms it", async ({
      page,
    }) => {
      await startTouch(page);
      const plain = await pick(page, "plain");
      const targeted = await pick(page, "targeted");
      expect(plain).toBeTruthy();
      const before = await handState(page);
      await page.locator(`#hand [data-hand="${plain.uid}"]`).tap();
      await page.waitForTimeout(300);
      const prepared = await handState(page);
      expect(
        await page.evaluate(
          (uid) => !!document.querySelector(`#hand [data-hand="${uid}"]`),
          plain.uid,
        ),
      ).toBe(true);
      expect(prepared.selected).toBe(1);
      expect(prepared.targeting).toBe(true);
      expect(prepared.mana).toBe(before.mana);
      expect(prepared.detail).toBe(null);

      await page.locator(`#hand [data-hand="${plain.uid}"]`).tap();
      await page.waitForTimeout(200);
      const cancelled = await handState(page);
      expect(cancelled.selected).toBe(0);
      expect(cancelled.targeting).toBe(false);
      expect(cancelled.mana).toBe(before.mana);

      await page.locator(`#hand [data-hand="${plain.uid}"]`).tap();
      const point = await emptyDropPoint(page);
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(700);
      const afterPlain = await handState(page);
      const plainGone = await page.evaluate(
        (uid) => !document.querySelector(`#hand [data-hand="${uid}"]`),
        plain.uid,
      );
      expect(plainGone).toBe(true);
      expect(Number(afterPlain.handCount)).toBe(Number(before.handCount) - 1);
      expect(afterPlain.detail).toBe(null);
      expect(afterPlain.targeting).toBe(false);
      if (targeted) {
        await page.locator(`#hand [data-hand="${targeted.uid}"]`).tap();
        await page.waitForTimeout(400);
        const afterAim = await handState(page);
        await page.screenshot({
          path: path.join(out, `touch-tap-aim-${label}.png`),
        });
        expect(afterAim.validTargets).toBeGreaterThan(0);
        expect(Number(afterAim.handCount)).toBe(Number(afterPlain.handCount));
      }
    });

    test("a dragged card shrinks into a snapped landing preview", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "plain");
      expect(card).toBeTruthy();
      const from = await boxOf(page, card.uid);
      const to = await emptyDropPoint(page);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [from],
      });
      await page.waitForTimeout(480);
      expect((await handState(page)).ghost).toBe(1);
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: from.x + (to.x - from.x) * t,
              y: from.y + (to.y - from.y) * t,
            },
          ],
        });
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(180);
      const snapped = await handState(page);
      expect(snapped.snapped).toBe(1);
      expect(snapped.snapMode).toBe("board");
      await page.screenshot({
        path: path.join(out, `touch-drag-snap-${label}.png`),
      });

      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x, y: from.y }],
      });
      await page.waitForTimeout(120);
      expect((await handState(page)).snapped).toBe(0);

      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [to],
      });
      await page.waitForTimeout(120);
      expect((await handState(page)).snapped).toBe(1);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      await page.waitForTimeout(700);
      expect(
        await page.evaluate(
          (uid) => !document.querySelector(`#hand [data-hand="${uid}"]`),
          card.uid,
        ),
      ).toBe(true);
    });

    test("long press lifts a playable hand card instead of opening detail", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "plain");
      const before = await handState(page);
      const box = await page
        .locator(`#hand [data-hand="${card.uid}"]`)
        .boundingBox();
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [from],
      });
      await page.waitForTimeout(540);
      const lifted = await handState(page);
      await page.screenshot({
        path: path.join(out, `touch-longpress-${label}.png`),
      });
      expect(lifted.detail).toBe(null);
      expect(lifted.detailOpen).toBe(false);
      expect(lifted.dragSource).toBe(1);
      expect(lifted.ghost).toBe(1);
      const to = await emptyDropPoint(page);
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: from.x + (to.x - from.x) * t,
              y: from.y + (to.y - from.y) * t,
            },
          ],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      await page.waitForTimeout(700);
      const after = await handState(page);
      expect(after.detailOpen).toBe(false);
      expect(after.ghost).toBe(0);
      expect(after.dragSource).toBe(0);
      expect(Number(after.handCount)).toBe(Number(before.handCount) - 1);
      expect(after.mana).not.toBe(before.mana);
    });

    test("long press clones the displayed modified cost into the drag ghost", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "plain");
      const expected = await page.evaluate((uid) => {
        const g = EmberDebug.game,
          value = g.s.p.hand.find((entry) => entry.uid === uid);
        value.costMod = -1;
        g.emit();
        return String(g.cost(value));
      }, card.uid);
      const box = await page
        .locator(`#hand [data-hand="${card.uid}"]`)
        .boundingBox();
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [from],
      });
      await page.waitForTimeout(540);
      await expect(page.locator(".drag-ghost")).toHaveCount(1);
      expect(
        await page.locator(".drag-ghost .badge-value").first().textContent(),
      ).toBe(expected);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
      await page.waitForTimeout(250);
      expect((await handState(page)).ghost).toBe(0);
    });

    test("a successful release keeps a settled snap pose into card flight", async ({
      page,
    }) => {
      await startTouch(page);
      const pose = await releaseArcherWithPose(page, 240);
      expect(pose.releasePose?.snapped).toBe(true);
      expect(Math.abs(pose.releasePose.scaleX - 0.78)).toBeLessThan(0.025);
      expect(Math.abs(pose.releasePose.scaleY - 0.78)).toBeLessThan(0.025);
      expect(Math.hypot(pose.ghostPose.x - pose.proxyPose.x, pose.ghostPose.y - pose.proxyPose.y)).toBeLessThan(8);
      expect(Math.abs(pose.ghostPose.w - pose.proxyPose.w)).toBeLessThan(8);
      expect(Math.abs(pose.ghostPose.h - pose.proxyPose.h)).toBeLessThan(8);
      await page.waitForFunction(() => !EmberFX.busy);
      await expect(page.locator(".drag-ghost")).toHaveCount(0);
    });

    test("a release during snap transition keeps the current pose into card flight", async ({
      page,
    }) => {
      await startTouch(page);
      const pose = await releaseArcherWithPose(page, 0);
      expect(pose.snapInProgress).toBe(true);
      expect(pose.snapFrames).toBeGreaterThan(0);
      expect(pose.snapSnappedFrames).toBeGreaterThan(0);
      expect(pose.snapHadUnsnappedFrame).toBe(true);
      expect(pose.snapTransitionMs).toBeGreaterThan(0);
      expect(pose.snapMovedFromStart).toBeGreaterThan(0.1);
      expect(pose.releasePose?.snapped).toBe(true);
      expect(pose.releasePose?.transitionMs).toBeGreaterThan(0);
      expect(pose.releaseHasIntermediateScale).toBe(true);
      expect(pose.releaseNotFinal).toBe(true);
      expect(pose.releaseMovedFromStart).toBeGreaterThan(0.1);
      expect(pose.releaseDelta).toBeGreaterThan(0);
      expect(Math.hypot(pose.ghostPose.x - pose.proxyPose.x, pose.ghostPose.y - pose.proxyPose.y)).toBeLessThan(14);
      expect(Math.abs(pose.ghostPose.w - pose.proxyPose.w)).toBeLessThan(14);
      expect(Math.abs(pose.ghostPose.h - pose.proxyPose.h)).toBeLessThan(14);
      await page.waitForFunction(() => !EmberFX.busy);
      await expect(page.locator(".drag-ghost")).toHaveCount(0);
    });

    test("horizontal panning on a card still scrolls a full hand", async ({
      page,
    }) => {
      await startTouch(page);
      const filled = await fillHand(page);
      expect(filled.n).toBeGreaterThan(6);
      await page.waitForTimeout(200);
      const rail = await page.evaluate(() => {
        const h = document.getElementById("hand");
        return { scrollWidth: h.scrollWidth, clientWidth: h.clientWidth };
      });
      expect(rail.scrollWidth).toBeGreaterThan(rail.clientWidth);
      const box = await page.locator("#hand .hand-card").first().boundingBox();
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      await touchDrag(page, from, { x: from.x - 240, y: from.y + 4 }, 12);
      const after = await handState(page);
      await page.screenshot({
        path: path.join(out, `touch-hand-pan-${label}.png`),
      });
      expect(after.scrollLeft).toBeGreaterThan(0);
    });
  });
}

for (const [label, viewport] of [
  ["desktop-1600", { width: 1600, height: 940 }],
  ["desktop-scaled-1280", { width: 1280, height: 720 }],
]) {
  test.describe(`desktop card source continuity · ${label}`, () => {
    test.use({ viewport, isMobile: false, hasTouch: false });

    test("click-play starts at the captured source geometry", async ({ page }) => {
      await startTouch(page);
      const uid = await prepareSingleMinion(page),
        card = page.locator(`#hand [data-hand="${uid}"]`),
        source = await card.boundingBox();
      await card.click();
      const arena = await page.locator("#arena").boundingBox();
      await page.mouse.click(arena.x + arena.width / 2, arena.y + arena.height / 2);
      assertPoseContinuity(source, await firstPlayProxyPose(page));
      await page.waitForFunction(() => !EmberFX.busy);
    });

    test("mouse drag preserves the source pose through snap release", async ({
      page,
    }) => {
      await startTouch(page);
      const uid = await prepareSingleMinion(page),
        card = page.locator(`#hand [data-hand="${uid}"]`),
        source = await card.boundingBox(),
        arena = await page.locator("#arena").boundingBox(),
        from = { x: source.x + source.width / 2, y: source.y + source.height / 2 },
        to = { x: arena.x + arena.width / 2, y: arena.y + arena.height / 2 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.waitForTimeout(30);
      await page.mouse.move(to.x, to.y, { steps: 16 });
      await page.waitForTimeout(20);
      const ghost = page.locator(".drag-ghost"),
        ghostBox = await ghost.boundingBox();
      expect(ghostBox).toBeTruthy();
      await page.mouse.up();
      assertPoseContinuity(
        {
          x: ghostBox.x,
          y: ghostBox.y,
          width: ghostBox.width,
          height: ghostBox.height,
        },
        await firstPlayProxyPose(page),
      );
      await page.waitForFunction(() => !EmberFX.busy);
    });
  });
}
