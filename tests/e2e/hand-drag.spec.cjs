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
      aimFocus: document.querySelectorAll(".aim-focus").length,
      dragSource: document.querySelectorAll(".drag-source").length,
      ghost: document.querySelectorAll(".drag-ghost").length,
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

/* A real press-and-hold: touchEnd has to come after the 440ms long-press gate. */
async function touchHold(page, point, ms = 660) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: point.x, y: point.y }],
  });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  await page.waitForTimeout(200);
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

    test("a tap plays a targetless card and aims a targeted one", async ({
      page,
    }) => {
      await startTouch(page);
      const plain = await pick(page, "plain");
      const targeted = await pick(page, "targeted");
      expect(plain).toBeTruthy();
      const before = await handState(page);
      await page.locator(`#hand [data-hand="${plain.uid}"]`).tap();
      await page.waitForTimeout(600);
      const afterPlain = await handState(page);
      const plainGone = await page.evaluate(
        (uid) => !document.querySelector(`#hand [data-hand="${uid}"]`),
        plain.uid,
      );
      expect(plainGone).toBe(true);
      expect(Number(afterPlain.handCount)).toBe(Number(before.handCount) - 1);
      expect(afterPlain.detail).toBe(null);
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

    test("long press magnifies the card and any tap dismisses it", async ({
      page,
    }) => {
      await startTouch(page);
      const card = await pick(page, "plain");
      const before = await handState(page);
      const box = await page
        .locator(`#hand [data-hand="${card.uid}"]`)
        .boundingBox();
      await touchHold(page, { x: box.x + box.width / 2, y: box.y + 10 });
      await page.waitForTimeout(300);
      const shown = await handState(page);
      await page.screenshot({
        path: path.join(out, `touch-longpress-${label}.png`),
      });
      expect(shown.detail).toBe("pinned");
      expect(shown.handCount).toBe(before.handCount);
      expect(shown.mana).toBe(before.mana);
      await page.mouse.click(6, 6);
      await page.waitForTimeout(300);
      const closed = await handState(page);
      expect(closed.detailOpen).toBe(false);
      expect(closed.handCount).toBe(before.handCount);
      expect(closed.mana).toBe(before.mana);
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
