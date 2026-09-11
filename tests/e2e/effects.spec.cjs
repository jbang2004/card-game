const { test, expect } = require("@playwright/test");
const path = require("node:path");

async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}
async function legend(page) {
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.hand = [g.card("solaris")];
    g.emit();
    Emberfall.act(() =>
      g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
    );
  });
}
for (const mobile of [false, true]) {
  test(`combat cues and bounded cleanup ${mobile ? "touch" : "desktop"}`, async ({
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
    // Invoke the same public application action on touch, where selection requires confirmation.
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.hand = [g.card("solaris")];
      g.emit();
      Emberfall.act(() =>
        g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
      );
    });
    await expect(page.locator(".summon-seal")).toBeVisible();
    await page.waitForTimeout(160);
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/legend-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    const settled = await page.evaluate(() =>
      JSON.stringify(EmberDebug.game.s),
    );
    await page.waitForFunction(
      () =>
        !EmberFX.busy &&
        EmberFX.pendingTimers === 0 &&
        EmberFX.activeAnimations === 0 &&
        EmberFX.transientNodes === 0 &&
        EmberFX.particles === 0,
    );
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      settled,
    );
    // The cue itself consumes only a snapshot and cannot advance the turn or RNG.
    await page.evaluate(() =>
      EmberFX.present(
        [{ type: "turn", side: "p" }],
        Emberfall.game.s,
        () => {},
        () => {},
      ),
    );
    await expect(page.locator(".turn-cue")).toContainText("你的回合");
    expect(
      await page
        .locator(".turn-cue")
        .evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe("none");
    await page.waitForTimeout(220);
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/turn-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      settled,
    );
    await page.evaluate(() => EmberFX.cancel());
    expect(
      await page.evaluate(() => [
        EmberFX.busy,
        EmberFX.pendingTimers,
        EmberFX.activeAnimations,
        EmberFX.transientNodes,
        EmberFX.particles,
      ]),
    ).toEqual([false, 0, 0, 0, 0]);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("reduced motion during cast preserves the single commit and removes decoration", async ({
  page,
}) => {
  await demo(page);
  await legend(page);
  const authoritative = await page.evaluate(() =>
    JSON.stringify(EmberDebug.game.s),
  );
  await page.evaluate(() => EmberFX.configure(true, true));
  await page.waitForFunction(
    () => !EmberFX.busy && EmberFX.pendingTimers === 0,
  );
  await expect(page.locator('.friendly[data-cardid="solaris"]')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    authoritative,
  );
  expect(
    await page.evaluate(() => [
      EmberFX.activeAnimations,
      EmberFX.particles,
      EmberFX.transientNodes,
    ]),
  ).toEqual([0, 0, 0]);
  await page.evaluate(() => {
    EmberFX.configure(false, true);
    for (let i = 0; i < 15; i++) EmberFX.impact(500, 400, "fire", 2);
  });
  expect(await page.evaluate(() => EmberFX.particles)).toBeLessThanOrEqual(220);
  await page.evaluate(() => EmberFX.reflow());
  expect(
    await page.evaluate(() => [
      EmberFX.busy,
      EmberFX.pendingTimers,
      EmberFX.activeAnimations,
      EmberFX.transientNodes,
      EmberFX.particles,
    ]),
  ).toEqual([false, 0, 0, 0, 0]);
});

test("reduced render cancellation does not emit post-cancellation work", async ({
  page,
}) => {
  await demo(page);
  const result = await page.evaluate(async () => {
    EmberFX.configure(true, true);
    const event = [{ id: "cancel-immediate", type: "turn", side: "p" }],
      state = Emberfall.game.s,
      started = performance.now();
    let renders = 0,
      afters = 0;
    EmberFX.present(
      event,
      state,
      () => {
        renders++;
        EmberFX.cancel(false);
      },
      () => {
        afters++;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    return {
      renders,
      afters,
      cue: document.querySelectorAll(".turn-cue").length,
      turnSounds: EmberAudio.diagnostics.history.filter(
        (entry) => entry.at >= started && entry.type.startsWith("turn"),
      ).length,
      busy: EmberFX.busy,
      timers: EmberFX.pendingTimers,
      animations: EmberFX.activeAnimations,
      particles: EmberFX.particles,
    };
  });
  expect(result).toEqual({
    renders: 1,
    afters: 0,
    cue: 0,
    turnSounds: 0,
    busy: false,
    timers: 0,
    animations: 0,
    particles: 0,
  });
});

test("a synchronous reduced replacement supersedes the old presentation", async ({
  page,
}) => {
  await demo(page);
  const result = await page.evaluate(() => {
    EmberFX.configure(true, true);
    const event = [{ id: "sync-replacement", type: "turn", side: "p" }],
      state = Emberfall.game.s,
      started = performance.now();
    let replaced = false,
      renders = 0,
      oldDone = 0,
      replacementDone = 0;
    EmberFX.present(
      event,
      state,
      () => {
        renders++;
        if (replaced) return;
        replaced = true;
        EmberFX.present(
          event,
          state,
          () => {
            renders++;
          },
          () => {
            replacementDone++;
          },
        );
      },
      () => {
        oldDone++;
      },
    );
    return {
      replaced,
      renders,
      oldDone,
      replacementDone,
      cue: document.querySelectorAll(".turn-cue").length,
      turnSounds: EmberAudio.diagnostics.history.filter(
        (entry) => entry.at >= started && entry.type === "turn",
      ).length,
    };
  });
  expect(result).toEqual({
    replaced: true,
    renders: 2,
    oldDone: 0,
    replacementDone: 1,
    cue: 1,
    turnSounds: 1,
  });
  await page.evaluate(() => EmberFX.cancel());
});

test("cancel commit re-entry cannot let the old sequence clean the replacement", async ({
  page,
}) => {
  await demo(page);
  await page.evaluate(() => {
    const event = [{ type: "turn", side: "p" }],
      state = Emberfall.game.s;
    EmberFX.present(
      event,
      state,
      () => EmberFX.present(event, state, () => {}, () => {}),
      () => {},
    );
    EmberFX.cancel(true);
  });
  await page.waitForFunction(
    () =>
      !EmberFX.busy &&
      EmberFX.pendingTimers === 0 &&
      EmberFX.activeAnimations === 0 &&
      EmberFX.transientNodes === 0 &&
      EmberFX.particles === 0,
  );
  expect(await page.locator(".turn-cue")).toHaveCount(0);
});

test("a render cancellation stops the executing attack beat before it owns work", async ({
  page,
}) => {
  await demo(page);
  const result = await page.evaluate(async () => {
    const g = EmberDebug.game;
    EmberFX.cancel(true);
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.e.hp = g.s.e.maxHp;
    const attacker = g.summon("p", "guard", { sick: false });
    const target = g.summon("e", "treant", { sick: false });
    g.events = [];
    g.emit();
    const original = EmberFX.present,
      started = performance.now();
    let armed = true;
    EmberFX.present = (events, state, render, after, cardHTML, before) => {
      if (!armed || !events.some((event) => event.type === "attack"))
        return original(events, state, render, after, cardHTML, before);
      return original(
        events,
        state,
        (frame) => {
          render(frame);
          if (!armed) return;
          armed = false;
          EmberFX.present = original;
          EmberFX.cancel(false);
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
        uid: attacker.uid,
        target: { side: "e", uid: target.uid },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 520));
    const history = EmberAudio.diagnostics.history.filter(
      (event) => event.at >= started,
    );
    return {
      busy: EmberFX.busy,
      actors: document.querySelectorAll(".attack-actor").length,
      hidden: [...document.querySelectorAll(".hero,.minion")].some(
        (el) => getComputedStyle(el).visibility === "hidden",
      ),
      lateSounds: history.filter(
        (event) => event.type === "swing" || event.type.startsWith("impact-"),
      ).length,
      timers: EmberFX.pendingTimers,
      animations: EmberFX.activeAnimations,
      particles: EmberFX.particles,
    };
  });
  expect(result).toEqual({
    busy: false,
    actors: 0,
    hidden: false,
    lateSounds: 0,
    timers: 0,
    animations: 0,
    particles: 0,
  });
});

test("a replacement created during cancel re-entry survives and completes once", async ({
  page,
}) => {
  await demo(page);
  const result = await page.evaluate(async () => {
    const event = [{ id: "replacement-turn", type: "turn", side: "p" }],
      state = Emberfall.game.s;
    let replaced = false,
      renders = 0,
      replacementDone = 0;
    EmberFX.present(
      event,
      state,
      () => {
        renders++;
        if (replaced) return;
        replaced = true;
        EmberFX.present(
          event,
          state,
          () => {
            renders++;
          },
          () => {
            replacementDone++;
          },
        );
      },
      () => {},
    );
    await new Promise((resolve) => setTimeout(resolve, 55));
    const mid = {
      busy: EmberFX.busy,
      renders,
      cue: !!document.querySelector(".turn-cue"),
    };
    await new Promise((resolve) => setTimeout(resolve, 430));
    return {
      mid,
      replaced,
      replacementDone,
      busy: EmberFX.busy,
    };
  });
  expect(result.replaced).toBe(true);
  expect(result.mid.busy).toBe(true);
  expect(result.mid.renders).toBeGreaterThanOrEqual(2);
  expect(result.mid.cue).toBe(true);
  expect(result.replacementDone).toBe(1);
  expect(result.busy).toBe(false);
  await page.evaluate(() => EmberFX.cancel());
});
