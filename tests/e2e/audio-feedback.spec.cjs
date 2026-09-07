const { test, expect } = require("@playwright/test");
const path = require("node:path");

async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => EmberAudio.ready);
}
async function prepare(page, { friends = [], enemies = [], hand = [] } = {}) {
  await page.evaluate(
    ({ friends, enemies, hand }) => {
      EmberFX.cancel(true);
      const g = EmberDebug.game;
      g.s.active = "p";
      g.s.phase = "battle";
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.board = [];
      g.s.e.board = [];
      g.s.p.hp = 20;
      g.s.e.hp = g.s.e.maxHp;
      g.s.p.armor = g.s.e.armor = 0;
      for (const cid of friends) g.summon("p", cid, { sick: false });
      for (const cid of enemies) g.summon("e", cid, { sick: false });
      g.s.p.hand = hand.map((id) => g.card(id));
      g.events = [];
      g.emit();
    },
    { friends, enemies, hand },
  );
}

test("audio waits for a gesture, decodes every local sample and survives mute restored from v1", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall);
  expect(await page.evaluate(() => EmberAudio.state)).toBe("not-started");
  await page.evaluate(() =>
    localStorage.setItem(
      "emberfall.settings.v1",
      JSON.stringify({ sound: false, reduced: true }),
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.Emberfall);
  await page.locator("#settings-btn").click();
  expect(await page.evaluate(() => EmberAudio.state)).toBe("not-started");
  await page.locator('[data-setting="sound"]').click();
  await page.evaluate(() => EmberAudio.ready);
  await expect
    .poll(() => page.evaluate(() => EmberAudio.state))
    .toBe("running");
  const audio = await page.evaluate(() => EmberAudio.diagnostics);
  expect(audio.loaded).toHaveLength(12);
  expect(audio.failed).toEqual([]);
  expect(audio.runtimeErrors).toBe(0);
  const slider = page.locator("#audio-volume");
  await slider.focus();
  await slider.press("Home");
  for (let i = 0; i < 7; i++) await slider.press("ArrowRight");
  expect(await page.evaluate(() => EmberAudio.diagnostics.levels.volume)).toBe(
    0.35,
  );
  await page.locator('[data-setting="sound"]').click();
  expect(await page.evaluate(() => EmberAudio.diagnostics.activeVoices)).toBe(
    0,
  );
  await page.reload();
  await page.waitForFunction(() => window.Emberfall);
  expect(
    await page.evaluate(() => [
      Emberfall.settings.volume,
      Emberfall.settings.sound,
    ]),
  ).toEqual([0.35, false]);
  await page.locator("#sound-btn").focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => page.evaluate(() => EmberAudio.state))
    .toBe("running");
});

for (const mobile of [false, true]) {
  test(`melee contact, damage number and impact cue share one beat ${mobile ? "touch" : "desktop"}`, async ({
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
    await prepare(page, { friends: ["frostking"], enemies: ["treant"] });
    const report = await page.evaluate(async () => {
      const g = EmberDebug.game;
      const start = performance.now();
      const result = Emberfall.act(() =>
        g.dispatch({
          type: "attack",
          side: "p",
          uid: g.s.p.board[0].uid,
          target: { side: "e", uid: g.s.e.board[0].uid },
        }),
      );
      if (!result.ok) throw Error(result.error);
      const final = JSON.stringify(g.s);
      return await new Promise((resolve) => {
        function sample() {
          const number = document.querySelector(".damage-number"),
            actor = document.querySelector(".attack-actor");
          if (number && actor) {
            const cue = EmberAudio.diagnostics.history.find(
              (e) => e.at >= start && e.type.startsWith("impact-"),
            );
            const motion = actor
              .getAnimations()
              .find((a) => a.effect.getKeyframes().some((k) => k.transform));
            resolve({
              audioDelta: performance.now() - cue.at,
              motionDelta: Math.abs(
                motion.currentTime - Number(actor.dataset.contactMs),
              ),
              final,
            });
          } else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
    });
    expect(report.audioDelta).toBeLessThan(70);
    expect(report.motionDelta).toBeLessThan(80);
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/feedback-contact-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    await page.waitForFunction(() => !EmberFX.busy);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      report.final,
    );
    await expect(page.locator(".attack-actor")).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("AOE uses one weighted impact, and full armor absorption has no flesh hit", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, {
    enemies: ["treant", "treant", "treant"],
    hand: ["storm"],
  });
  const before = await page.evaluate(
    () => EmberAudio.played["impact-fire"] || 0,
  );
  await page.evaluate(() => {
    const g = EmberDebug.game;
    Emberfall.act(() =>
      g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
    );
  });
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberAudio.played["impact-fire"])).toBe(
    before + 1,
  );
  await prepare(page, { hand: ["bolt"] });
  const state = await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.e.armor = 20;
    g.emit();
    const previous = {
      armor: EmberAudio.played.armor || 0,
      impact: EmberAudio.played["impact-fire"] || 0,
    };
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: g.s.p.hand[0].uid,
        target: { side: "e", uid: "hero" },
      }),
    );
    return previous;
  });
  await expect(page.locator(".cue-armor")).toBeVisible();
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberAudio.played.armor)).toBe(
    state.armor + 1,
  );
  expect(await page.evaluate(() => EmberAudio.played["impact-fire"])).toBe(
    state.impact,
  );
});

test("bounded audio voices render a nonclipping mix and cancel without stale tails", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof AudioDestinationNode && !window.mixProbe) {
        window.mixProbe = this.context.createAnalyser();
        mixProbe.fftSize = 2048;
        connect.call(this, mixProbe);
      }
      return connect.call(this, destination, ...args);
    };
  });
  await demo(page);
  const report = await page.evaluate(async () => {
    EmberAudio.stop();
    const types = [
      "impact-fire",
      "impact-frost",
      "impact-steel",
      "heal",
      "shield",
      "death",
      "legendary",
      "equip",
      "turn",
      "cast-arcane",
    ];
    for (const type of types) EmberAudio.fx(type, { heavy: true });
    let peak = 0,
      frames = 0;
    const values = new Float32Array(mixProbe.fftSize),
      start = performance.now();
    await new Promise((resolve) => {
      function measure() {
        mixProbe.getFloatTimeDomainData(values);
        for (const value of values) peak = Math.max(peak, Math.abs(value));
        frames++;
        if (performance.now() - start >= 1200) resolve();
        else requestAnimationFrame(measure);
      }
      requestAnimationFrame(measure);
    });
    EmberFX.cancel();
    return { peak, frames, audio: EmberAudio.diagnostics };
  });
  expect(report.peak).toBeGreaterThan(0.005);
  expect(report.peak).toBeLessThan(0.98);
  expect(report.audio.peakVoices).toBeLessThanOrEqual(20);
  expect(report.audio.activeVoices).toBe(0);
  expect(report.audio.runtimeErrors).toBe(0);
  await testInfo.attach("audio-mix-measurement", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => EmberAudio.diagnostics.activeVoices)).toBe(
    0,
  );
});

test("result cue distinguishes victory, defeat and draw; reflow never replays it", async ({
  page,
}) => {
  await demo(page);
  for (const [winner, cue] of [
    ["p", "victory"],
    ["e", "defeat"],
    ["draw", "draw-result"],
  ]) {
    await page.evaluate((winner) => {
      EmberFX.cancel();
      EmberFX.present(
        [{ type: "over", winner }],
        Emberfall.game.s,
        () => {},
        () => {},
      );
    }, winner);
    await expect
      .poll(() => page.evaluate((cue) => EmberAudio.played[cue] || 0, cue))
      .toBe(1);
    await page.evaluate(() => EmberFX.reflow());
    expect(await page.evaluate((cue) => EmberAudio.played[cue], cue)).toBe(1);
  }
});

test("portable build decodes embedded audio without asset requests", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => {
    if (/\.mp3/.test(r.url())) requests.push(r.url());
  });
  await page.goto("http://127.0.0.1:8000/?debug=1");
  await page.waitForFunction(() => window.Emberfall);
  await page.locator("#quick-btn").click();
  await page.evaluate(() => EmberAudio.ready);
  expect(await page.evaluate(() => EmberAudio.diagnostics.loaded.length)).toBe(
    12,
  );
  expect(requests).toEqual([]);
});

test("touch settings fit and reduced motion keeps feedback without moving actors", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await demo(page);
  await page.evaluate(() => Emberfall.showSettings());
  await expect(page.locator("#audio-volume")).toBeVisible();
  await page.screenshot({
    path: path.resolve("artifacts/qa/feedback-settings-touch.png"),
  });
  await page.locator("#settings-done").click();
  await prepare(page, { hand: ["solaris"] });
  await page.evaluate(() => {
    EmberFX.configure(true, true);
    const g = EmberDebug.game;
    Emberfall.act(() =>
      g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
    );
  });
  await expect(page.locator('#minions [data-cardid="solaris"]')).toBeVisible();
  expect(
    await page.evaluate(() => [EmberFX.activeAnimations, EmberFX.particles]),
  ).toEqual([0, 0]);
  expect(await page.evaluate(() => EmberAudio.played.summon)).toBeGreaterThan(
    0,
  );
  await context.close();
});

test("reflow during a draw reveals every card and stops its landing cue", async ({
  page,
}) => {
  await demo(page);
  await prepare(page, { hand: ["wisdom"] });
  await page.evaluate(() => {
    const g = EmberDebug.game;
    Emberfall.act(() =>
      g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
    );
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("#hand .hand-card")].some(
      (el) => el.style.visibility === "hidden",
    ),
  );
  const final = await page.evaluate(() => {
    EmberFX.reflow();
    return {
      state: JSON.stringify(EmberDebug.game.s),
      land: EmberAudio.played.land || 0,
    };
  });
  await page.waitForTimeout(320);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    final.state,
  );
  expect(await page.evaluate(() => EmberAudio.played.land || 0)).toBe(
    final.land,
  );
  expect(
    await page
      .locator("#hand .hand-card")
      .evaluateAll((cards) =>
        cards.every((el) => getComputedStyle(el).visibility === "visible"),
      ),
  ).toBe(true);
  expect(
    await page.evaluate(() => [
      EmberFX.busy,
      EmberFX.activeAnimations,
      EmberFX.pendingTimers,
      EmberAudio.diagnostics.activeVoices,
    ]),
  ).toEqual([false, 0, 0, 0]);
});
