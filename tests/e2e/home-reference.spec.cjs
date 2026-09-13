const { test, expect } = require("@playwright/test");
const path = require("node:path");
const out = path.resolve("output/home-implementation-20260912");
async function ready(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page
    .locator("#lobby img")
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
}
for (const [width, height, touch] of [
  [1672, 941, false],
  [1244, 922, false],
  [1280, 720, false],
  [390, 844, true],
  [320, 568, true],
  [844, 390, true],
  [568, 320, true],
  [768, 1024, true],
]) {
  test(`reference home: reachable controls and collection ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await ready(page);
    const controls = [
      "#start-btn",
      "#quick-btn",
      "#lobby-library-btn",
      "#sound-btn",
      "#settings-btn",
    ];
    const arrows = await page
      .locator(".home-action-arrow svg")
      .evaluateAll((es) =>
        es.map((e) => {
          const r = e.getBoundingClientRect();
          return r.x + r.width / 2;
        }),
      );
    expect(Math.abs(arrows[0] - arrows[1])).toBeLessThan(1);
    const ring = await page.locator(".home-collection-arrow").boundingBox();
    const chevron = await page
      .locator(".home-collection-arrow svg")
      .boundingBox();
    const cardRight = await page
      .locator(".home-collection-card")
      .evaluateAll((es) =>
        Math.max(...es.map((e) => e.getBoundingClientRect().right)),
      );
    expect(ring.x - cardRight).toBeGreaterThanOrEqual(12);
    expect(
      Math.abs(ring.x + ring.width / 2 - chevron.x - chevron.width / 2),
    ).toBeLessThan(1);
    expect(
      Math.abs(ring.y + ring.height / 2 - chevron.y - chevron.height / 2),
    ).toBeLessThan(1);
    const rects = [];
    for (const selector of controls) {
      const button = page.locator(selector);
      await expect(button).toBeVisible();
      const r = await button.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
      expect(r.y + r.height).toBeLessThanOrEqual(height + 1);
      if (touch) {
        expect(r.width).toBeGreaterThanOrEqual(44);
        expect(r.height).toBeGreaterThanOrEqual(44);
      }
      await button.click({ trial: true });
      rects.push(r);
    }
    // Separate primary, secondary, and collection targets even on short phones.
    for (let a = 0; a < 3; a++)
      for (let b = a + 1; b < 3; b++) {
        const x = rects[a],
          y = rects[b];
        expect(
          Math.max(
            0,
            Math.min(x.x + x.width, y.x + y.width) - Math.max(x.x, y.x),
          ) *
            Math.max(
              0,
              Math.min(x.y + x.height, y.y + y.height) - Math.max(x.y, y.y),
            ),
        ).toBe(0);
      }
    await page.screenshot({
      path: path.join(out, `verified-home-${width}.png`),
    });
    await page.locator("#lobby-library-btn").click();
    await expect(page.locator(".library-box")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#lobby-library-btn")).toBeFocused();
    await page.locator("#start-btn").click();
    await expect(page.locator("#hero-confirm")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => Emberfall.inBattle && !EmberFX.busy);
    await page.locator("#home-btn").click();
    await expect(page.locator("#start-btn")).toContainText("开启冒险");
    // Returning to the lobby restores the primary action's own treatment:
    // slate paints it as the blue pill (§5.1) rather than the silverblue
    // bitmap skin, which is still in the DOM but never painted.
    expect(
      await page.locator("#start-btn").evaluate((button) => {
        const style = getComputedStyle(button);
        const skin = button.querySelector(".home-action-skin");
        return {
          pill: parseFloat(style.borderRadius) >= button.offsetHeight / 2,
          painted: style.backgroundImage !== "none",
          skinPainted: skin ? getComputedStyle(skin).opacity !== "0" : false,
        };
      }),
    ).toEqual({ pill: true, painted: true, skinPainted: false });
    expect(
      await page.evaluate(() => localStorage.getItem("emberfall.v1")),
    ).toBeNull();
    expect(errors).toEqual([]);
    await context.close();
  });
}
test("saved campaign labels preserve the skins; cancel new journey preserves the save", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#adventure-nav").click();
  await expect(page.locator(".adventure-atlas")).toBeVisible();
  await page.locator("#map-continue").click();
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.locator("#home-btn").click();
  const saved = await page.evaluate(() => localStorage.getItem("emberfall.v1"));
  expect(saved).toBeTruthy();
  await expect(page.locator("#start-btn")).toContainText("继续冒险");
  await expect(page.locator("#quick-btn")).toContainText("新的旅程");
  // Both lobby actions keep their pill treatment once a save exists: the
  // primary carries the blue gradient, the secondary the dark pill, and
  // neither paints the retired bitmap skin.
  expect(
    await page
      .locator("#start-btn, #quick-btn")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const style = getComputedStyle(button);
          const skin = button.querySelector(".home-action-skin");
          return {
            pill: parseFloat(style.borderRadius) >= button.offsetHeight / 2,
            skinPainted: skin ? getComputedStyle(skin).opacity !== "0" : false,
          };
        }),
      ),
  ).toEqual([
    { pill: true, skinPainted: false },
    { pill: true, skinPainted: false },
  ]);
  await page.locator("#quick-btn").click();
  await expect(page.locator("#ok-confirm")).toBeVisible();
  await page.locator("#cancel-confirm").click();
  expect(await page.evaluate(() => localStorage.getItem("emberfall.v1"))).toBe(
    saved,
  );
  await page.reload();
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await expect(page.locator("#start-btn")).toContainText("继续冒险");
  await page.locator("#start-btn").click();
  await page.waitForFunction(() => Emberfall.inBattle && !EmberFX.busy);
  await page.locator("#home-btn").click();
  await page.locator("#settings-btn").click();
  await page.locator('[data-section="options"]').click();
  await expect(page.locator("#settings-fullscreen")).toBeVisible();
  await page.locator('[data-section="options"]').click();
  await page.locator('[data-setting="reduced"]').click();
  await page.locator("#settings-done").click();
  await expect(page.locator("body")).toHaveClass(/reduced-motion/);
  expect(
    await page
      .locator("#start-btn")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
});

test("navigation highlight follows pointer, focus and touch without triggering an action", async ({
  page,
}) => {
  await ready(page);
  // Silverblue tracked the pointer with a sliding `.nav-light` band. Slate
  // paints the indicator as an underline on the ACTIVE link instead
  // (`.nav-link.active::after`, design system §4) and leaves the band
  // unpainted, so the highlight is asserted where it is now drawn: hover,
  // focus and touch light the label they are over, and the underline stays on
  // whichever page is actually open.
  async function highlighted(id) {
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const link = document.getElementById(id);
          return getComputedStyle(link).color;
        }, id),
      )
      .toBe("rgb(255, 255, 255)");
  }
  async function underlined(id) {
    expect(
      await page.evaluate((id) => {
        const link = document.getElementById(id);
        const bar = getComputedStyle(link, "::after");
        return {
          active: link.classList.contains("active"),
          painted:
            bar.content !== "none" &&
            parseFloat(bar.height) > 0 &&
            bar.opacity !== "0",
          // a bar centred on its own link
          symmetric:
            Math.abs(parseFloat(bar.left) - parseFloat(bar.right)) <= 1,
        };
      }, id),
    ).toEqual({ active: true, painted: true, symmetric: true });
  }
  await underlined("adventure-nav");
  await page.locator("#collection-nav").hover();
  await highlighted("collection-nav");
  await page.locator("#guide-nav").hover();
  await highlighted("guide-nav");
  // Hovering is not navigating: the open page, and its underline, do not move.
  await underlined("adventure-nav");
  expect(await page.evaluate(() => Emberfall.modal)).toBeFalsy();
  await page.mouse.move(900, 400);
  // Keyboard focus is shown by the focus ring, not by the hover colour, and
  // it still must not navigate on its own.
  await page.locator("#collection-nav").focus();
  await expect(page.locator("#collection-nav")).toBeFocused();
  expect(await page.evaluate(() => Emberfall.modal)).toBeFalsy();
  await page.locator("#collection-nav").press("Enter");
  await expect(page.locator(".library-box")).toBeVisible();
  await expect(page.locator("#collection-nav")).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.keyboard.press("Escape");
  await page.locator("#home-btn").focus();
  const r = await page.locator("#guide-nav").boundingBox();
  await page.locator(".top-nav").dispatchEvent("pointermove", {
    pointerType: "touch",
    clientX: r.x + r.width / 2,
    clientY: r.y + r.height / 2,
  });
  // A touch that only moves across the strip must not navigate either.
  expect(await page.evaluate(() => Emberfall.modal)).toBeFalsy();
  await page
    .locator(".top-nav")
    .dispatchEvent("pointercancel", { pointerType: "touch" });
  // Back on the lobby the underline rests on the open page again.
  await underlined("adventure-nav");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("#adventure-nav")
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  const emblem = await page.locator(".home-footer-emblem").boundingBox();
  const text = await page.locator(".lobby-bottom b").first().boundingBox();
  expect(
    Math.abs(emblem.y + emblem.height / 2 - text.y - text.height / 2),
  ).toBeLessThan(1);
  await expect(page.locator('.brand [data-theme-art="homeLogo"]')).toHaveCount(
    0,
  );
  await expect(page.locator("#quick-btn .ui-icon-swords")).toBeVisible();
});
