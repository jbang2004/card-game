const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const out = path.resolve("output/hero-pose-v3-20260920/qa/model");
fs.mkdirSync(out, { recursive: true });
// Only an explicit unregistered source opts out. A registered but missing or
// broken GLB must fail build/load assertions, never silently skip model QA.
const modelExplicitlyUnregistered =
  /^\s*const\s+MODEL_URL\s*=\s*null\s*;/m.test(
    fs.readFileSync(path.resolve("src/presentation/hero-model.js"), "utf8"),
  );
async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function demo(page) {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}
async function modelReady(page) {
  await expect(page.locator("#player-hero")).toHaveClass(/hero-model-ready/, {
    timeout: 30000,
  });
  await page.waitForFunction(() => EmberHeroModel.diagnostics().frames > 1);
}
function errorsFor(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // The existing static server has no site favicon. Exclude only that
    // confirmed browser-initiated 404, never game/model resource errors.
    if (m.type() === "error" && !/\/favicon\.ico$/.test(m.location().url || ""))
      errors.push(m.text());
  });
  return errors;
}
async function measure(page, name) {
  const report = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll(".hero-model-canvas")].map(
      (canvas) => {
        const { width: w, height: h } = canvas,
          data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
        let count = 0,
          min = 255,
          max = 0,
          sum = 0,
          edges = 0;
        const bins = new Map(),
          luminance = new Float32Array(w * h);
        let left = w,
          top = h,
          right = 0,
          bottom = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (data[i + 3] < 32) continue;
            count++;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            const l =
              0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
            luminance[y * w + x] = l;
            min = Math.min(min, l);
            max = Math.max(max, l);
            sum += l;
            const key =
              (data[i] >> 5) * 64 + (data[i + 1] >> 5) * 8 + (data[i + 2] >> 5);
            bins.set(key, (bins.get(key) || 0) + 1);
            if (
              x &&
              data[i - 1] >= 32 &&
              Math.abs(l - luminance[y * w + x - 1]) > 20
            )
              edges++;
          }
        let entropy = 0,
          dominant = 0;
        for (const n of bins.values()) {
          const p = n / count;
          entropy -= p * Math.log2(p);
          dominant = Math.max(dominant, p);
        }
        return {
          side: canvas.closest(".hero").id,
          width: w,
          height: h,
          rect: canvas.getBoundingClientRect().toJSON(),
          opaquePixels: count,
          coverage: count / (w * h),
          colorEntropyBits: entropy,
          dominantColorShare: dominant,
          edgeDensity: edges / count,
          luminance: { min, max, mean: sum / count, contrast: max - min },
          silhouette: { left, top, right, bottom },
        };
      },
    );
    const obscuredStats = [
      ...document.querySelectorAll(
        "#battle .hero-health,#battle .hero-mana,#battle .minion .stat-value",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const owner = el.closest(".hero,.minion");
        // Floating hero HUD chips intentionally ignore pointers and may sit
        // outside the hero button. Their visibility is geometric, not hit
        // ownership; the raised-mage test checks their real UI overlaps.
        if (
          owner?.matches(".hero") &&
          getComputedStyle(el).pointerEvents === "none"
        )
          return false;
        return (
          document
            .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            ?.closest(".hero,.minion") !== owner
        );
      })
      .map((el) => el.className);
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      diagnostics: EmberHeroModel.diagnostics(),
      canvases,
      obscuredStats,
    };
  });
  fs.writeFileSync(
    path.join(out, name + ".json"),
    JSON.stringify(report, null, 2),
  );
  expect(report.obscuredStats).toEqual([]);
  for (const c of report.canvases) {
    expect(c.silhouette.left).toBeGreaterThan(0);
    expect(c.silhouette.top).toBeGreaterThan(0);
    expect(c.silhouette.right).toBeLessThan(c.width - 1);
    expect(c.silhouette.bottom).toBeLessThan(c.height - 1);
    expect(c.opaquePixels).toBeGreaterThan(150);
    expect(c.coverage).toBeGreaterThan(0.03);
    expect(c.colorEntropyBits).toBeGreaterThan(1);
    expect(c.luminance.contrast).toBeGreaterThan(30);
  }
  await page.screenshot({ path: path.join(out, name + ".png") });
  return report;
}
test.describe("registered real GLB", () => {
  test.skip(
    modelExplicitlyUnregistered,
    "Tripo export has not been saved locally; MODEL_URL explicitly null. Real-model QA remains pending.",
  );
  test("native skeleton idle, cast and hit animate and return to idle", async ({
    page,
  }) => {
    const errors = errorsFor(page);
    await demo(page);
    await modelReady(page);
    const initial = await page.evaluate(() => EmberHeroModel.diagnostics());
    expect(initial.clips).toHaveLength(3);
    expect(initial.views[0].nativeActions.sort()).toEqual(["cast", "hit"]);
    expect(initial.views[0].idleClip).toBeTruthy();
    expect(initial.views[0].activeClip).toBe(initial.views[0].idleClip);
    await page.waitForTimeout(160);
    const idle = await page.evaluate(
      () => EmberHeroModel.diagnostics().views[0],
    );
    expect(idle.idleTime).not.toBe(initial.views[0].idleTime);
    expect(idle.bonePose).not.toEqual(initial.views[0].bonePose);
    await page
      .locator("#player-hero .hero-model-canvas")
      .screenshot({ path: path.join(out, "desktop-native-idle-detail.png") });
    // Observe the real renderer cue at the skill's first event, before the
    // short authored cast has finished. Read-only instrumentation records it.
    await page.evaluate(() => {
      window.__heroNativeSamples = [];
      window.__heroNativeSampler = setInterval(() => {
        const d = EmberHeroModel.diagnostics();
        window.__heroNativeSamples.push({
          at: performance.now(),
          ...d.views[0],
        });
      }, 20);
    });
    await page.locator("#power-btn").click();
    await page.locator("#enemy-hero").click();
    await page.waitForTimeout(180);
    await page
      .locator("#player-hero .hero-model-canvas")
      .screenshot({ path: path.join(out, "desktop-native-cast-detail.png") });
    await page.screenshot({ path: path.join(out, "desktop-native-cast.png") });
    await page.waitForFunction(() => !EmberFX.busy);
    await page.waitForFunction(
      () => {
        const d = EmberHeroModel.diagnostics().views[0];
        return d.activeClip === d.idleClip;
      },
      null,
      { timeout: 5000 },
    );
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.events = [];
      g.damage("p", "hero", 2, { side: "e", uid: "hero" });
      g.emit();
    });
    await page.waitForFunction(
      () => EmberHeroModel.diagnostics().lastCue?.kind === "hit",
    );
    await page.waitForTimeout(160);
    await page.screenshot({ path: path.join(out, "desktop-native-hit.png") });
    await page
      .locator("#player-hero .hero-model-canvas")
      .screenshot({ path: path.join(out, "desktop-native-hit-detail.png") });
    await page.waitForFunction(
      () => {
        const d = EmberHeroModel.diagnostics().views[0];
        return d.activeClip === d.idleClip;
      },
      null,
      { timeout: 5000 },
    );
    const samples = await page.evaluate(() => {
      clearInterval(window.__heroNativeSampler);
      return window.__heroNativeSamples;
    });
    fs.writeFileSync(
      path.join(out, "native-animation-samples.json"),
      JSON.stringify(samples, null, 2),
    );
    for (const kind of ["cast", "hit"]) {
      const playing = samples.filter((s) =>
        new RegExp(kind, "i").test(s.activeClip || ""),
      );
      expect(playing.length, kind + " must play a native clip").toBeGreaterThan(
        2,
      );
      expect(playing.some((s) => s.actionRunning)).toBe(true);
      expect(new Set(playing.map((s) => s.actionTime)).size).toBeGreaterThan(2);
      expect(
        new Set(playing.map((s) => JSON.stringify(s.bonePose))).size,
      ).toBeGreaterThan(2);
    }
    expect(errors).toEqual([]);
  });
  for (const [name, viewport] of [
    ["desktop", { width: 1600, height: 940 }],
    ["portrait", { width: 390, height: 844 }],
    ["landscape", { width: 844, height: 390 }],
  ]) {
    test(`mage GLB pixels, retained identity and hero targeting: ${name}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport,
        isMobile: name !== "desktop",
        hasTouch: name !== "desktop",
      });
      const page = await context.newPage(),
        errors = errorsFor(page);
      await demo(page);
      await modelReady(page);
      await page.evaluate(() => {
        window.__mageCanvas = document.querySelector(
          "#player-hero .hero-model-canvas",
        );
        for (let i = 0; i < 12; i++) Emberfall.renderNow();
      });
      expect(
        await page.evaluate(
          () =>
            window.__mageCanvas ===
            document.querySelector("#player-hero .hero-model-canvas"),
        ),
      ).toBe(true);
      await page.waitForTimeout(160);
      const report = await measure(page, name + "-active");
      expect(report.diagnostics.loads).toBe(1);
      expect(report.diagnostics.renderers).toBe(1);
      expect(report.diagnostics.triangles).toBeGreaterThan(100);
      // Actual UI hero-power input must still target the enemy and update rules.
      const hp = await page.evaluate(
        () => EmberDebug.game.s.e.hp + EmberDebug.game.s.e.armor,
      );
      await page.locator("#power-btn").click();
      await page.locator("#enemy-hero").click();
      await page.waitForFunction(() => !EmberFX.busy);
      expect(
        await page.evaluate(
          () => EmberDebug.game.s.e.hp + EmberDebug.game.s.e.armor,
        ),
      ).toBeLessThan(hp);
      expect(
        await page.evaluate(() => EmberHeroModel.diagnostics().lastCue?.kind),
      ).toBe("cast");
      // A public rule damage event reaches the model hit cue while health stays DOM.
      await page.evaluate(() => {
        const g = EmberDebug.game;
        g.events = [];
        g.damage("p", "hero", 2, { side: "e", uid: "hero" });
        g.emit();
      });
      await expect(page.locator("#player-hero .hero-health")).toHaveText("24");
      expect(
        await page.evaluate(() => EmberHeroModel.diagnostics().lastCue?.kind),
      ).toBe("hit");
      await page.evaluate(() => {
        const g = EmberDebug.game;
        g.s.p.frozen = true;
        g.events = [];
        g.emit();
      });
      expect(
        await page
          .locator("#player-hero .portrait-frame")
          .evaluate((e) => getComputedStyle(e, "::after").content),
      ).toContain("❄");
      await page.screenshot({ path: path.join(out, name + "-frozen.png") });
      if (name === "portrait") {
        const before = await page.evaluate(() =>
          JSON.stringify(EmberDebug.game.s),
        );
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(200);
        expect(
          await page.evaluate(() => JSON.stringify(EmberDebug.game.s)),
        ).toBe(before);
        expect(
          await page.evaluate(
            () =>
              window.__mageCanvas ===
              document.querySelector("#player-hero .hero-model-canvas"),
          ),
        ).toBe(true);
        await measure(page, "rotated-same-match");
      }
      expect(errors).toEqual([]);
      await context.close();
    });
  }
  for (const [name, viewport] of [
    ["desktop", { width: 1600, height: 940 }],
    ["portrait", { width: 390, height: 844 }],
    ["landscape", { width: 844, height: 390 }],
  ]) {
    test(`mage vs mage practice shares model and renderer; home pauses: ${name}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
          viewport,
          isMobile: name !== "desktop",
          hasTouch: name !== "desktop",
        }),
        page = await context.newPage();
      const errors = errorsFor(page);
      await page.goto("./?debug=1");
      await ready(page);
      await page.locator("#start-btn").click();
      await page.locator('[data-hero="mage"]').click();
      if (await page.locator('[data-mode="practice"]').isVisible())
        await page.locator('[data-mode="practice"]').click();
      else await page.locator("#game-mode").selectOption("practice");
      await page.locator("#practice-opponent").selectOption("mage_burn");
      await page.locator("#hero-confirm").click();
      await page.locator("#mulligan-confirm").click();
      await page.waitForFunction(() => !EmberFX.busy);
      await modelReady(page);
      await expect(page.locator("#enemy-hero")).toHaveClass(/hero-model-ready/);
      const report = await measure(page, `practice-two-mages-${name}`);
      expect(report.diagnostics.activeViews).toBe(2);
      expect(report.diagnostics.loads).toBe(1);
      expect(report.diagnostics.renderers).toBe(1);
      await page.locator("#home-btn").click();
      await page.waitForTimeout(150);
      const before = await page.evaluate(
        () => EmberHeroModel.diagnostics().frames,
      );
      await page.waitForTimeout(250);
      expect(
        await page.evaluate(() => EmberHeroModel.diagnostics().frames),
      ).toBe(before);
      expect(
        await page.evaluate(() => EmberHeroModel.diagnostics().running),
      ).toBe(false);
      await page.locator("#quick-btn").click();
      await modelReady(page);
      expect(
        await page.evaluate(() => EmberHeroModel.diagnostics().loads),
      ).toBe(1);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
  test("reduced motion paints then stops; visibility event pauses without mutating state", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = errorsFor(page);
    await demo(page);
    await expect(page.locator("#player-hero")).toHaveClass(/hero-model-ready/);
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => EmberHeroModel.diagnostics());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => EmberHeroModel.diagnostics().frames)).toBe(
      before.frames,
    );
    expect(before.reduced).toBe(true);
    await measure(page, "portrait-reduced");
    const state = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(
      await page.evaluate(() => EmberHeroModel.diagnostics().running),
    ).toBe(false);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      state,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
  test("failed GLB leaves original portrait and functioning rules", async ({
    page,
  }) => {
    await page.route("**/*.glb", (route) => route.abort());
    await demo(page);
    await page.waitForFunction(
      () => EmberHeroModel.diagnostics().status === "fallback",
    );
    await expect(page.locator("#player-hero")).not.toHaveClass(
      /hero-model-ready/,
    );
    expect(
      await page
        .locator("#player-hero .portrait-frame > img")
        .evaluate((img) => ({
          opacity: getComputedStyle(img).opacity,
          loaded: img.complete && img.naturalWidth > 0,
        })),
    ).toEqual({ opacity: "1", loaded: true });
    await page.locator("#power-btn").click();
    await page.locator("#enemy-hero").click();
    await page.waitForFunction(() => !EmberFX.busy);
    expect(await page.evaluate(() => EmberDebug.game.s.p.powerUsed)).toBe(true);
    await page.screenshot({
      path: path.join(out, "model-failure-portrait-fallback.png"),
    });
  });
  test("single-file build renders real model without network and gates debug state", async ({
    browser,
  }) => {
    const context = await browser.newContext({ offline: true }),
      page = await context.newPage(),
      errors = errorsFor(page),
      external = [];
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) external.push(r.url());
    });
    await page.goto(pathToFileURL(path.resolve("index.html")).href);
    await ready(page);
    expect(await page.evaluate(() => typeof EmberDebug)).toBe("undefined");
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await modelReady(page);
    await measure(page, "offline-file");
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
    await context.close();
  });
});

test("unregistered model preserves portraits, targets and zero renderer allocation", async ({
  browser,
}) => {
  test.skip(
    !modelExplicitlyUnregistered,
    "A real model is registered; the GLB suite owns this state.",
  );
  const cases = [
    ["desktop", { width: 1600, height: 940 }, false],
    ["portrait", { width: 390, height: 844 }, false],
    ["landscape", { width: 844, height: 390 }, false],
    ["offline-file", { width: 1600, height: 940 }, true],
  ];
  const reports = [];
  for (const [name, viewport, offline] of cases) {
    const context = await browser.newContext({
      viewport,
      offline,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    const page = await context.newPage(),
      errors = errorsFor(page),
      modelRequests = [];
    page.on("request", (request) => {
      if (/\.glb(?:[?#]|$)|^data:model\//.test(request.url()))
        modelRequests.push(request.url());
    });
    await page.goto(
      offline ? pathToFileURL(path.resolve("index.html")).href : "./?debug=1",
    );
    await ready(page);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    const stats = await page.evaluate(() => EmberHeroModel.diagnostics());
    expect(stats).toMatchObject({
      status: "disabled",
      model: null,
      loads: 0,
      renderers: 0,
      frames: 0,
      activeViews: 0,
    });
    await expect(page.locator(".hero-model-canvas")).toHaveCount(0);
    await expect(page.locator("#player-hero")).not.toHaveClass(
      /hero-model-ready/,
    );
    const portrait = await page
      .locator("#player-hero .portrait-frame > img")
      .evaluate((img) => ({
        opacity: getComputedStyle(img).opacity,
        loaded: img.complete && img.naturalWidth > 0,
      }));
    expect(portrait).toEqual({ opacity: "1", loaded: true });
    const before = await page.evaluate(
      () => Emberfall.game.s.e.hp + Emberfall.game.s.e.armor,
    );
    await page.locator("#power-btn").click();
    await page.locator("#enemy-hero").click();
    await page.waitForFunction(() => !EmberFX.busy);
    expect(
      await page.evaluate(
        () => Emberfall.game.s.e.hp + Emberfall.game.s.e.armor,
      ),
    ).toBeLessThan(before);
    expect(modelRequests).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: path.join(out, `unregistered-${name}.png`) });
    reports.push({
      name,
      viewport,
      offline,
      diagnostics: stats,
      portrait,
      modelRequests,
      errors,
    });
    await context.close();
  }
  fs.writeFileSync(
    path.join(out, "unregistered-smoke.json"),
    JSON.stringify(reports, null, 2),
  );
});

// Motion acceptance is deliberately measured in screen pixels. A changing
// skeleton checksum alone can pass while the player sees a nearly still hero.
const motionOut = path.resolve("output/hero-pose-v3-20260920/qa");
fs.mkdirSync(motionOut, { recursive: true });
for (const [name, viewport] of [
  ["desktop", { width: 1600, height: 940 }],
  ["compact", { width: 1130, height: 884 }],
  ["portrait", { width: 390, height: 844 }],
  ["landscape", { width: 844, height: 390 }],
]) {
  test(`visible hero choreography and real release: ${name}`, async ({
    browser,
  }) => {
    test.skip(modelExplicitlyUnregistered, "No real model registered.");
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
      recordVideo: { dir: motionOut, size: viewport },
    });
    const page = await context.newPage(),
      errors = errorsFor(page),
      video = page.video();
    try {
      await demo(page);
      await modelReady(page);
      await page.evaluate(() => {
        const state = {
          phase: "idle",
          frames: [],
          baseline: null,
          timer: null,
        };
        window.__heroMotionQA = state;
        state.timer = setInterval(() => {
          const canvas = document.querySelector(
            "#player-hero .hero-model-canvas",
          );
          if (!canvas?.width) return;
          // DOM hit/cast poses can resize the drawing buffer. Normalize
          // every frame into the first frame's dimensions before differencing.
          if (!state.sampleCanvas) {
            state.sampleCanvas = document.createElement("canvas");
            state.sampleCanvas.width = canvas.width;
            state.sampleCanvas.height = canvas.height;
            state.sampleContext = state.sampleCanvas.getContext("2d");
          }
          const w = state.sampleCanvas.width,
            h = state.sampleCanvas.height,
            rect = canvas.getBoundingClientRect();
          state.sampleContext.clearRect(0, 0, w, h);
          state.sampleContext.drawImage(canvas, 0, 0, w, h);
          const pixels = state.sampleContext.getImageData(0, 0, w, h).data;
          if (!state.baseline) state.baseline = new Uint8ClampedArray(pixels);
          let occupied = 0,
            changed = 0,
            delta = 0,
            left = w,
            right = -1,
            top = h,
            bottom = -1;
          for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4,
                a = pixels[i + 3],
                ba = state.baseline[i + 3];
              if (a >= 32) {
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
              }
              if (a < 32 && ba < 32) continue;
              occupied++;
              let difference = Math.abs(a - ba);
              for (let c = 0; c < 3; c++)
                difference = Math.max(
                  difference,
                  Math.abs(
                    (pixels[i + c] * a) / 255 -
                      (state.baseline[i + c] * ba) / 255,
                  ),
                );
              delta += difference;
              if (difference > 24) changed++;
            }
          const magicCanvas = document.querySelector(
            "#player-hero .hero-magic-canvas",
          );
          let magic = null;
          if (magicCanvas?.width && magicCanvas.height) {
            const mw = magicCanvas.width,
              mh = magicCanvas.height,
              mr = magicCanvas.getBoundingClientRect();
            const mp = magicCanvas
              .getContext("2d")
              .getImageData(0, 0, mw, mh).data;
            let ml = mw,
              mt = mh,
              mright = -1,
              mbottom = -1,
              count = 0;
            for (let my = 0; my < mh; my++)
              for (let mx = 0; mx < mw; mx++)
                if (mp[(my * mw + mx) * 4 + 3] >= 12) {
                  count++;
                  ml = Math.min(ml, mx);
                  mt = Math.min(mt, my);
                  mright = Math.max(mright, mx);
                  mbottom = Math.max(mbottom, my);
                }
            magic = {
              width: mw,
              height: mh,
              rect: mr.toJSON(),
              count,
              left: ml,
              top: mt,
              right: mright,
              bottom: mbottom,
              clipped:
                count > 0 &&
                (ml === 0 ||
                  mt === 0 ||
                  mright === mw - 1 ||
                  mbottom === mh - 1),
              viewportClipped:
                count > 0 &&
                (mr.x + (ml * mr.width) / mw < 0 ||
                  mr.y + (mt * mr.height) / mh < 0 ||
                  mr.x + ((mright + 1) * mr.width) / mw > innerWidth ||
                  mr.y + ((mbottom + 1) * mr.height) / mh > innerHeight),
              png:
                state.frames.length % 2 === 0
                  ? magicCanvas.toDataURL("image/png")
                  : null,
            };
          }
          const diag = EmberHeroModel.diagnostics();
          state.frames.push({
            magic,
            at: performance.now(),
            phase: state.phase,
            width: w,
            height: h,
            rect: rect.toJSON(),
            silhouette: { left, right, top, bottom },
            changedFraction: changed / Math.max(1, occupied),
            meanDifference: delta / Math.max(1, occupied),
            view: diag.views.find((v) => v.side === "p"),
            lastCue: diag.lastCue,
            lastCast: diag.views.find((v) => v.side === "p")?.lastCast,
            png:
              state.frames.length % 2 === 0
                ? canvas.toDataURL("image/png")
                : null,
          });
        }, 80);
      });
      await page.waitForTimeout(6500);
      const outcomes = [];
      for (const kind of ["power", "fireball"]) {
        const before = await page.evaluate(
          () => Emberfall.game.s.e.hp + Emberfall.game.s.e.armor,
        );
        await page.evaluate((kind) => {
          window.__heroMotionQA.phase = kind;
        }, kind);
        if (kind === "power") await page.locator("#power-btn").click();
        else
          await page
            .locator('#hand [data-cardid="fireball"]')
            .click({ position: { x: 14, y: 30 } });
        await page.locator("#enemy-hero").click();
        await page.waitForFunction(() => !EmberFX.busy);
        await page.waitForTimeout(1450);
        const after = await page.evaluate(
          () => Emberfall.game.s.e.hp + Emberfall.game.s.e.armor,
        );
        const presentation = await page.evaluate(
          (kind) => ({
            model: EmberHeroModel.diagnostics().views.find(
              (v) => v.side === "p",
            )?.lastCast,
            returnedPose: EmberHeroModel.diagnostics().views.find(
              (v) => v.side === "p",
            ),
            effect: [...EmberFX.trace]
              .reverse()
              .find(
                (record) =>
                  record.type === (kind === "power" ? "power" : "cast") &&
                  record.actor?.side === "p",
              ),
          }),
          kind,
        );
        outcomes.push({ kind, before, after, ...presentation });
        expect(after).toBeLessThan(before);
      }
      const evidence = await page.evaluate(() => {
        clearInterval(window.__heroMotionQA.timer);
        return {
          frames: window.__heroMotionQA.frames,
          trace: EmberFX.trace,
          diagnostics: EmberHeroModel.diagnostics(),
        };
      });
      const frameDir = path.join(motionOut, name + "-frames");
      fs.mkdirSync(frameDir, { recursive: true });
      for (const [index, frame] of evidence.frames.entries()) {
        if (frame.png) {
          const file =
            String(index).padStart(4, "0") + "-" + frame.phase + ".png";
          fs.writeFileSync(
            path.join(frameDir, file),
            Buffer.from(frame.png.split(",")[1], "base64"),
          );
          frame.file = path.join(name + "-frames", file);
          delete frame.png;
        }
        if (frame.magic?.png) {
          const file =
            String(index).padStart(4, "0") + "-" + frame.phase + "-magic.png";
          fs.writeFileSync(
            path.join(frameDir, file),
            Buffer.from(frame.magic.png.split(",")[1], "base64"),
          );
          frame.magic.file = path.join(name + "-frames", file);
          delete frame.magic.png;
        }
      }
      const summaries = {};
      for (const phase of ["idle", "power", "fireball"]) {
        const frames = evidence.frames.filter((f) => f.phase === phase);
        const range = (values) => Math.max(...values) - Math.min(...values);
        const bodyHeight = Math.max(
          ...frames.map(
            (f) =>
              ((f.silhouette.bottom - f.silhouette.top) * f.rect.height) /
              f.height,
          ),
        );
        const handExcursion = { left: 0, right: 0 };
        for (const key of ["left", "right"])
          for (const a of frames)
            for (const b of frames) {
              const p = a.view?.screenHands?.[key],
                q = b.view?.screenHands?.[key];
              if (p && q)
                handExcursion[key] = Math.max(
                  handExcursion[key],
                  Math.hypot(p.x - q.x, p.y - q.y),
                );
            }
        const complete = frames.filter(
          (f) =>
            f.view?.screenPose?.hips &&
            f.view?.kneeAngles &&
            f.view?.screenHands?.left &&
            f.view?.screenHands?.right,
        );
        const standing = complete.length
          ? {
              samples: complete.length,
              distinctHalfSecondPhases: new Set(
                complete.map((f) => Math.floor(f.view.idleTime * 2)),
              ).size,
              hipsHeightRange:
                range(complete.map((f) => f.view.screenPose.hips.y)) /
                bodyHeight,
              kneeHeightRange: Math.max(
                ...["leftKnee", "rightKnee"].map(
                  (k) =>
                    range(complete.map((f) => f.view.screenPose[k].y)) /
                    bodyHeight,
                ),
              ),
              minKneeAngle: Math.min(
                ...complete.flatMap((f) => Object.values(f.view.kneeAngles)),
              ),
              waistHandHeightOffset:
                Math.max(
                  ...complete.map((f) =>
                    Math.abs(
                      f.view.screenHands.left.y - f.view.screenPose.hips.y,
                    ),
                  ),
                ) / bodyHeight,
              waistHandAnchorDrift:
                Math.hypot(
                  range(
                    complete.map(
                      (f) =>
                        f.view.screenHands.left.x - f.view.screenPose.hips.x,
                    ),
                  ),
                  range(
                    complete.map(
                      (f) =>
                        f.view.screenHands.left.y - f.view.screenPose.hips.y,
                    ),
                  ),
                ) / bodyHeight,
              rightArcWidth: range(
                complete.map((f) => f.view.screenHands.right.x),
              ),
              rightArcHeight: range(
                complete.map((f) => f.view.screenHands.right.y),
              ),
            }
          : null;
        summaries[phase] = {
          bodyHeight,
          handExcursion,
          standing,
          magicClippedFrames: frames
            .filter((f) => f.magic?.clipped || f.magic?.viewportClipped)
            .map((f) => f.at),
          magicPaintedFrames: frames.filter((f) => f.magic?.count > 0).length,
          sampleCount: frames.length,
          maxChangedFraction: Math.max(...frames.map((f) => f.changedFraction)),
          maxMeanDifference: Math.max(...frames.map((f) => f.meanDifference)),
          handExcursionCssPx: Math.max(handExcursion.left, handExcursion.right),
          clippedFrames: frames
            .filter(
              (f) =>
                f.silhouette.left <= 0 ||
                f.silhouette.top <= 0 ||
                f.silhouette.right >= f.width - 1 ||
                f.silhouette.bottom >= f.height - 1 ||
                f.rect.x + (f.silhouette.left * f.rect.width) / f.width < 0 ||
                f.rect.y + (f.silhouette.top * f.rect.height) / f.height < 0 ||
                f.rect.x + ((f.silhouette.right + 1) * f.rect.width) / f.width >
                  viewport.width ||
                f.rect.y +
                  ((f.silhouette.bottom + 1) * f.rect.height) / f.height >
                  viewport.height,
            )
            .map((f) => f.at),
        };
      }
      const report = { viewport, outcomes, summaries, ...evidence };
      fs.writeFileSync(
        path.join(motionOut, name + "-motion.json"),
        JSON.stringify(report, null, 2),
      );
      // Readability floors deliberately exceed tiny quaternion/AA movement.
      expect(summaries.idle.handExcursionCssPx).toBeGreaterThanOrEqual(
        { desktop: 6, compact: 6, portrait: 3, landscape: 2 }[name],
      );
      expect(summaries.idle.standing?.samples).toBeGreaterThanOrEqual(6);
      expect(
        summaries.idle.standing.distinctHalfSecondPhases,
      ).toBeGreaterThanOrEqual(6);
      expect(summaries.idle.standing.minKneeAngle).toBeGreaterThanOrEqual(165);
      expect(summaries.idle.standing.hipsHeightRange).toBeLessThanOrEqual(0.05);
      expect(summaries.idle.standing.kneeHeightRange).toBeLessThanOrEqual(0.05);
      expect(summaries.idle.standing.waistHandHeightOffset).toBeLessThanOrEqual(
        0.18,
      );
      expect(summaries.idle.standing.waistHandAnchorDrift).toBeLessThanOrEqual(
        0.05,
      );
      expect(summaries.idle.maxChangedFraction).toBeGreaterThan(0.08);
      expect(summaries.idle.maxMeanDifference).toBeGreaterThan(1.5);
      for (const phase of ["power", "fireball"]) {
        expect(summaries[phase].handExcursionCssPx).toBeGreaterThanOrEqual(
          { desktop: 16, compact: 16, portrait: 8, landscape: 6 }[name],
        );
        expect(summaries[phase].handExcursion.left).toBeLessThan(
          summaries[phase].handExcursion.right * 0.5,
        );
        expect(
          summaries[phase].standing.waistHandHeightOffset,
        ).toBeLessThanOrEqual(0.18);
        expect(summaries[phase].standing.rightArcWidth).toBeGreaterThan(
          summaries[phase].bodyHeight * 0.05,
        );
        expect(summaries[phase].standing.rightArcHeight).toBeGreaterThan(
          summaries[phase].bodyHeight * 0.06,
        );
        expect(summaries[phase].magicClippedFrames).toEqual([]);
        expect(summaries[phase].magicPaintedFrames).toBeGreaterThan(0);
        expect(summaries[phase].maxChangedFraction).toBeGreaterThan(0.22);
        expect(Number.isFinite(summaries[phase].maxMeanDifference)).toBe(true);
        expect(summaries[phase].clippedFrames).toEqual([]);
      }
      expect(summaries.idle.clippedFrames).toEqual([]);
      expect(summaries.idle.magicClippedFrames).toEqual([]);
      for (const event of outcomes) {
        expect(event.returnedPose.activeClip).toBe(event.returnedPose.idleClip);
        expect(event.model).toBeTruthy();
        expect(event.effect).toBeTruthy();
        expect(event.model.releaseAt).toBeGreaterThan(event.model.startedAt);
        expect(
          Math.abs(event.model.releaseAt - event.effect.launchAt),
        ).toBeLessThanOrEqual(50);
        const hit = event.effect.hitAt.find(Number.isFinite);
        const number = event.effect.numberAt.find(Number.isFinite);
        expect(hit).toBeGreaterThanOrEqual(event.model.releaseAt - 20);
        expect(event.effect.sourceAnchor).toBe("hero-hand");
        // The initial demo power is absorbed by armor and deliberately has
        // no health damage-number timestamp. Fireball must expose one.
        if (Number.isFinite(number))
          expect(Math.abs(hit - number)).toBeLessThanOrEqual(35);
        else expect(event.kind).toBe("power");
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await video.saveAs(path.join(motionOut, name + "-actual-gameplay.webm"));
    }
  });
}

const layoutOut = path.resolve("output/hero-pose-v3-20260920/qa/layout");
fs.mkdirSync(layoutOut, { recursive: true });
// Before-state alpha heights from the prior accepted capture; the compact
// reference is its former 106px avatar slot. These are baselines, not target
// coordinates or a copy of the new layout implementation.
for (const [name, viewport, priorHeight, touch] of [
  ["desktop", { width: 1600, height: 940 }, 193.76, false],
  ["compact", { width: 1221, height: 880 }, 106, false],
  ["portrait", { width: 390, height: 844 }, 107.875, true],
  ["landscape", { width: 844, height: 390 }, 76.66, true],
]) {
  test(`raised mage stands above reachable covenant: ${name}`, async ({
    browser,
  }) => {
    test.skip(modelExplicitlyUnregistered, "No real model registered.");
    const context = await browser.newContext({
      viewport,
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage(),
      errors = errorsFor(page);
    try {
      await demo(page);
      await modelReady(page);
      const samples = [];
      for (let sample = 0; sample < 6; sample++) {
        samples.push(
          await page.evaluate(() => {
            const canvas = document.querySelector(
              "#player-hero .hero-model-canvas",
            );
            const rect = canvas.getBoundingClientRect(),
              w = canvas.width,
              h = canvas.height;
            const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
            const get = (selector) =>
              document
                .querySelector(selector)
                ?.getBoundingClientRect()
                .toJSON();
            const contract = get("#contract-open"),
              name = get("#player-hero .hero-name"),
              hp = get("#player-hero .hero-health"),
              power = get("#power-btn");
            const controls = [
              ["name", name],
              ["hp", hp],
              ["contract", contract],
              ["power", power],
              ...Array.from(
                document.querySelectorAll("#hand .hand-card,.minion"),
                (el, i) => ["card-" + i, el.getBoundingClientRect().toJSON()],
              ),
            ].filter(([, r]) => r?.width && r?.height);
            let left = Infinity,
              top = Infinity,
              right = -Infinity,
              bottom = -Infinity;
            const overlaps = new Set();
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] < 80) continue;
                const sx = rect.x + ((x + 0.5) * rect.width) / w,
                  sy = rect.y + ((y + 0.5) * rect.height) / h;
                left = Math.min(left, sx);
                right = Math.max(right, sx);
                top = Math.min(top, sy);
                bottom = Math.max(bottom, sy);
                for (const [label, r] of controls)
                  if (
                    sx > r.left + 1 &&
                    sx < r.right - 1 &&
                    sy > r.top + 1 &&
                    sy < r.bottom - 1
                  )
                    overlaps.add(label);
              }
            const blocked = [];
            for (const [label, r] of [
              ["name", name],
              ["hp", hp],
              ["contract", contract],
              ["power", power],
            ]) {
              if (
                !r?.width ||
                r.top < 0 ||
                r.bottom > innerHeight ||
                r.left < 0 ||
                r.right > innerWidth
              ) {
                blocked.push(label + ":outside");
                continue;
              }
              // Names and health are noninteractive HUD. Require real hit
              // ownership only for the covenant and power controls.
              if (label === "name" || label === "hp") continue;
              const hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
              const selector =
                label === "contract"
                  ? "#contract-open"
                  : label === "power"
                    ? "#power-btn"
                    : "#player-hero";
              if (!hit?.closest(selector)) blocked.push(label + ":covered");
            }
            const intersects = (a, b) =>
              Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
              Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
            const labelOverlaps = [];
            for (const [label, a, b] of [
              ["name/hp", name, hp],
              ["name/contract", name, contract],
              ["hp/contract", hp, contract],
              ["power/contract", power, contract],
            ])
              if (intersects(a, b)) labelOverlaps.push(label);
            for (const [label, hud] of [
              ["name", name],
              ["hp", hp],
            ])
              for (const [other, box] of controls)
                if (
                  (other.startsWith("card-") || other === "power") &&
                  intersects(hud, box)
                )
                  labelOverlaps.push(label + "/" + other);
            return {
              model: {
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top,
              },
              contract,
              name,
              hp,
              power,
              overlaps: [...overlaps],
              blocked,
              labelOverlaps,
              rotation: EmberHeroModel.diagnostics().views.find(
                (v) => v.side === "p",
              ).rotation,
            };
          }),
        );
        await page.waitForTimeout(160);
      }
      const report = { viewport, priorHeight, samples };
      fs.writeFileSync(
        path.join(layoutOut, name + "-geometry.json"),
        JSON.stringify(report, null, 2),
      );
      await page.screenshot({
        path: path.join(layoutOut, name + "-formation.png"),
      });
      expect(Math.max(...samples.map((s) => s.model.height))).toBeGreaterThan(
        priorHeight * 1.15,
      );
      for (const sample of samples) {
        expect(sample.model.bottom).toBeLessThan(sample.contract.top);
        expect(sample.model.left).toBeGreaterThanOrEqual(0);
        expect(sample.model.top).toBeGreaterThanOrEqual(0);
        expect(sample.model.right).toBeLessThanOrEqual(viewport.width);
        expect(sample.overlaps).toEqual([]);
        expect(sample.blocked).toEqual([]);
        expect(sample.labelOverlaps).toEqual([]);
        for (const label of [sample.name, sample.hp]) {
          const horizontallyAligned =
            Math.min(label.right, sample.contract.right) >
            Math.max(label.left, sample.contract.left);
          if (horizontallyAligned)
            expect(sample.contract.top - label.bottom).toBeGreaterThanOrEqual(
              4,
            );
        }
      }
      await require("./helpers/covenant.cjs").openCovenantPage(page);
      await expect(page.locator(".covenant-box")).toBeVisible();
      await page.keyboard.press("Escape");
      const before = await page.evaluate(
        () => Emberfall.game.s.e.hp + Emberfall.game.s.e.armor,
      );
      await page.locator("#power-btn").click();
      await page.locator("#enemy-hero").click();
      await page.waitForFunction(() => !EmberFX.busy);
      expect(
        await page.evaluate(
          () => Emberfall.game.s.e.hp + Emberfall.game.s.e.armor,
        ),
      ).toBeLessThan(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
