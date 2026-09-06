const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve("artifacts/qa");
fs.mkdirSync(out, { recursive: true });
async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.waitForTimeout(100);
}
async function idle(page) {
  await page.waitForFunction(() => !EmberFX.busy);
}
async function demo(page) {
  await page.goto("./");
  await ready(page);
  await page.locator("#quick-btn").click();
  await idle(page);
}

test("web build: all assets decode, no external dependencies, actual spells, melee and AI", async ({
  page,
}) => {
  const errors = [],
    failed = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:8000/")
    )
      external.push(r.url());
  });
  await demo(page);
  expect(
    await page.evaluate(async () => {
      for (const src of [
        ...Object.values(AnimeAssets),
        ...Object.values(WindborneAssets),
      ]) {
        const image = new Image();
        image.src = src;
        await image.decode();
      }
      return EmberData.cards.length;
    }),
  ).toBe(56);
  await page.screenshot({ path: path.join(out, "desktop.png") });
  await page.locator('#hand [data-cardid="frostbolt"]').click();
  const line = await page.locator("#target-path").getAttribute("d");
  expect(line).toMatch(/^M/);
  // Notification boxes must not cover any live target.
  expect(
    await page.evaluate(() => {
      const h = document.querySelector("#hint").getBoundingClientRect();
      return [...document.querySelectorAll(".hero,.minion,.hand-card")].some(
        (e) => {
          const r = e.getBoundingClientRect();
          return (
            Math.min(h.right, r.right) > Math.max(h.left, r.left) &&
            Math.min(h.bottom, r.bottom) > Math.max(h.top, r.top)
          );
        },
      );
    }),
  ).toBe(false);
  await page.locator('.enemy[data-cardid="golem"]').click();
  await idle(page);
  expect(await page.evaluate(() => Emberfall.game.s.p.mana)).toBe(4);
  await expect(page.locator('.enemy[data-cardid="golem"]')).toHaveClass(
    /frozen/,
  );
  await page.locator('.friendly[data-cardid="guard"]').click();
  await page.locator('.enemy[data-cardid="golem"]').click();
  await idle(page);
  await expect(page.locator('.enemy[data-cardid="golem"]')).toHaveCount(0);
  expect(await page.evaluate(() => Emberfall.game.s.p.board[0].hp)).toBe(1);
  await page.locator('#hand [data-cardid="phoenix"]').click();
  await idle(page);
  await expect(page.locator('.friendly[data-cardid="phoenix"]')).toHaveCount(1);
  await page.locator("#end-turn").click();
  await page.waitForFunction(
    () =>
      Emberfall.game.s.active === "p" &&
      Emberfall.game.s.turn > 6 &&
      !EmberFX.busy,
    { timeout: 20000 },
  );
  expect(
    await page.evaluate(
      () => document.querySelectorAll(".attack-clone,.drag-ghost").length,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});

test("real origin: campaign, settings and day/night survive reload; demo leaves save intact", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  await page.locator("#start-btn").click();
  await page.locator('[data-hero="paladin"]').click();
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await idle(page);
  await page.locator("#settings-btn").click();
  await page.locator('[data-setting="reduced"]').click();
  await page.locator(".wind-time-setting").click();
  await page.locator("#settings-done").click();
  const before = await page.evaluate(() =>
    localStorage.getItem("emberfall.v1"),
  );
  expect(JSON.parse(before).heroId).toBe("paladin");
  await page.reload();
  await ready(page);
  await expect(page.locator("#start-btn")).toContainText("继续冒险");
  await page.locator("#start-btn").click();
  await idle(page);
  expect(await page.evaluate(() => JSON.stringify(Emberfall.game.s))).toBe(
    before,
  );
  expect(
    await page.evaluate(() => Emberfall.settings.reduced && AtelierWorld.dusk),
  ).toBe(true);
  await page.evaluate(() => Emberfall.demo());
  await idle(page);
  await page.locator("#home-btn").click();
  expect(await page.evaluate(() => localStorage.getItem("emberfall.v1"))).toBe(
    before,
  );
});

const screens = [
  [1600, 940, false],
  [1440, 900, false],
  [1280, 720, false],
  [1024, 768, false],
  [390, 844, true],
  [320, 568, true],
  [844, 390, true],
  [667, 375, true],
  [568, 320, true],
  [768, 1024, true],
  [1024, 768, true],
];
for (const [width, height, touch] of screens) {
  test(`full board and ten-card hand ${width}x${height} ${touch ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8000/dist/");
    await ready(page);
    await page.evaluate(() => {
      Emberfall.settings.reduced = true;
      EmberFX.configure(true, false);
      document.body.classList.add("reduced-motion");
      Emberfall.demo();
      const g = Emberfall.game,
        s = g.s;
      s.p.board = [];
      s.e.board = [];
      for (const side of ["p", "e"])
        for (const id of [
          "guard",
          "oracle",
          "wisp",
          "phoenix",
          "golem",
          "paladin",
          "dragon",
        ])
          g.summon(side, id, { sick: false });
      s.p.hand = [
        "phoenix",
        "sunblade",
        "guard",
        "frostbolt",
        "fireball",
        "dragon",
        "paladin",
        "nyx",
        "wisdom",
        "bolt",
      ].map((id) => g.card(id));
      g.emit();
    });
    await idle(page);
    await page.waitForTimeout(150);
    const faults = await page.evaluate(() => {
      const faults = [],
        items = [
          ...document.querySelectorAll(".hero,.minion,#end-turn,#power-btn"),
        ];
      for (const e of items) {
        const r = e.getBoundingClientRect();
        if (
          r.left < -1 ||
          r.top < -1 ||
          r.right > innerWidth + 1 ||
          r.bottom > innerHeight + 1
        )
          faults.push("outside:" + e.className);
      }
      const overlays = [
        ...document.querySelectorAll(
          "#hint,#toast.visible,.mana-panel,#enemy-mana",
        ),
      ].filter((e) => getComputedStyle(e).display !== "none");
      for (const overlay of overlays) {
        const a = overlay.getBoundingClientRect();
        if (!a.width) continue;
        for (const target of items) {
          const b = target.getBoundingClientRect();
          if (
            Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1
          )
            faults.push("overlay:" + overlay.id + ":" + target.className);
        }
      }
      const units = [...document.querySelectorAll(".minion")];
      for (let i = 0; i < units.length; i++)
        for (let j = i + 1; j < units.length; j++) {
          const a = units[i].getBoundingClientRect(),
            b = units[j].getBoundingClientRect();
          if (
            Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1
          )
            faults.push("overlap:units");
        }
      if (!EmberViewport.mobile) {
        const cards = [...document.querySelectorAll(".hand-card")];
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect();
          if (r.left < 0 || r.right > innerWidth || r.bottom > innerHeight + 1)
            faults.push("outside:hand");
          if (i && cards[i - 1].getBoundingClientRect().right > r.left)
            faults.push("overlap:hand");
          for (const stat of cards[i].querySelectorAll(".stat,.card-cost")) {
            const b = stat.getBoundingClientRect(),
              top = document.elementFromPoint(
                b.x + b.width / 2,
                b.y + b.height / 2,
              );
            if (top?.closest(".hand-card") !== cards[i])
              faults.push("covered:stat");
          }
        }
      }
      return faults;
    });
    expect(faults).toEqual([]);
    await page.screenshot({
      path: path.join(
        out,
        `full-${width}x${height}-${touch ? "touch" : "desktop"}.png`,
      ),
    });
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("touch: inspect, confirm, rotate during spell, same match and no stuck effects", async ({
  browser,
}) => {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:8000/dist/");
  await ready(p);
  await p.locator("#quick-btn").tap();
  await idle(p);
  await p.locator('#hand [data-cardid="frostbolt"]').tap();
  await expect(p.locator(".touch-rule")).toContainText("冻结");
  expect(await p.evaluate(() => Emberfall.game.s.p.mana)).toBe(6);
  await p.locator("#touch-card-play").tap();
  await p.locator('.enemy[data-cardid="golem"]').tap();
  await p.setViewportSize({ width: 844, height: 390 });
  await idle(p);
  expect(await p.evaluate(() => Emberfall.game.s.p.mana)).toBe(4);
  await expect(p.locator('.enemy[data-cardid="golem"]')).toHaveClass(/frozen/);
  await expect(p.locator("#end-turn")).toBeEnabled();
  await p.screenshot({ path: path.join(out, "touch-landscape.png") });
  await c.close();
});

for (const [width, height, touch] of [
  [1600, 940, false],
  [320, 568, true],
  [568, 320, true],
]) {
  test(`premium numeric glyph containment ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8000/dist/");
    await ready(page);
    await page.evaluate(() => {
      Emberfall.settings.reduced = true;
      EmberFX.configure(true, false);
      Emberfall.demo();
      const s = Emberfall.game.s;
      s.p.hp = 30;
      s.e.hp = 30;
      Emberfall.renderNow();
    });
    await idle(page);
    const faults = await page.evaluate(() => {
      const faults = [];
      for (const el of document.querySelectorAll(
        ".hero-health,.hand-card .card-cost,.minion .stat,.hand-card .stat",
      )) {
        const b = el.getBoundingClientRect();
        for (const value of ["1", "2", "3", "10", "30"]) {
          const original = el.textContent;
          el.textContent = value;
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          if (
            r.left < b.left + 1 ||
            r.right > b.right - 1 ||
            r.top < b.top ||
            r.bottom > b.bottom
          )
            faults.push({
              class: el.className,
              value,
              b: { w: b.width, h: b.height },
              text: { w: r.width, h: r.height },
            });
          el.textContent = original;
        }
      }
      return faults;
    });
    expect(faults).toEqual([]);
    await page.screenshot({
      path: path.join(out, `premium-${width}x${height}.png`),
    });
    await context.close();
  });
}

test("shared desktop and touch materials, readable lobby, single card aperture", async ({
  browser,
}) => {
  const materials = [];
  for (const [width, height, touch] of [
    [1600, 940, false],
    [390, 844, true],
    [844, 390, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: touch,
      hasTouch: touch,
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:8000/dist/");
    await ready(page);
    materials.push(
      await page.evaluate(() =>
        Object.fromEntries(
          [".lobby-copy", ".gold-btn", ".ghost-btn"].map((s) => {
            const c = getComputedStyle(document.querySelector(s));
            return [s, [c.backgroundColor, c.backgroundImage, c.color]];
          }),
        ),
      ),
    );
    const contrast = await page.evaluate(() => {
      const rgb = (s) =>
        s
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      const lum = (s) =>
        rgb(s)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const bg = lum(
        getComputedStyle(document.querySelector(".lobby-copy")).backgroundColor,
      );
      return [".lobby-tagline", ".lobby-desc", ".lobby-copy .eyebrow"].map(
        (s) => {
          const fg = lum(getComputedStyle(document.querySelector(s)).color);
          return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        },
      );
    });
    expect(contrast.every((x) => x >= 4.5)).toBe(true);
    await page.screenshot({ path: path.join(out, `v10-lobby-${width}.png`) });
    await page.evaluate(() => Emberfall.showLibrary());
    const faults = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".library-item .card-art")).flatMap(
        (el) => {
          const img = el.querySelector("img"),
            a = el.getBoundingClientRect(),
            b = img.getBoundingClientRect(),
            s = getComputedStyle(el);
          return Math.abs(a.width - b.width) > 0.5 ||
            Math.abs(a.height - b.height) > 0.5 ||
            Math.abs(a.x - b.x) > 0.5 ||
            Math.abs(a.y - b.y) > 0.5 ||
            s.borderRadius !== "0px" ||
            s.overflow !== "hidden"
            ? [el.closest("[data-add]").dataset.add]
            : [];
        },
      ),
    );
    expect(faults).toEqual([]);
    await page.screenshot({ path: path.join(out, `v10-library-${width}.png`) });
    await page.evaluate(() => {
      Emberfall.closeModal();
      Emberfall.settings.reduced = true;
      EmberFX.configure(true, false);
      Emberfall.demo();
    });
    await idle(page);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `v10-battle-${width}.png`) });
    await context.close();
  }
  expect(materials[1]).toEqual(materials[0]);
  expect(materials[2]).toEqual(materials[0]);
});
