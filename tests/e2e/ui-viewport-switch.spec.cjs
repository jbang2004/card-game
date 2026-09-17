/* A window that changes class mid-match — a phone-width desktop window dragged
 * wide, a tablet rotated — has to be re-evaluated, not just re-measured.
 * V2 (BATTLE_PRESENTATION_V2 §2.7) runs one effect pipeline on every layout,
 * so the crossing must keep EmberFx2 available, move the director's hero
 * anchor with the hero card, and never leave the phone's inline coordinates on
 * `#touch-target-bar` (that parked the aim prompt on the brand mark). */
const { test, expect } = require("@playwright/test");

async function startDemo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}

const read = (page) =>
  page.evaluate(() => {
    const card = EmberViewport.pos(
        document.querySelector("#player-hero .hero-card-inner"),
      ),
      anchor = EmberFX.anchor({ side: "p", uid: "hero" });
    return {
      mobile: EmberViewport.mobile,
      available: EmberFx2.diagnostics.available,
      barStyle: document.getElementById("touch-target-bar").getAttribute("style"),
      anchorOnCard:
        !!card &&
        !!anchor &&
        Math.abs(card.x - anchor.x) < 2 &&
        Math.abs(card.y - anchor.y) < 2 &&
        Math.abs(card.w - anchor.w) < 2 &&
        Math.abs(card.h - anchor.h) < 2,
      anchor,
    };
  });

// Two boxes that share no area at all — the prompt must not sit on the logo.
function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

async function aim(page) {
  await page.evaluate(() => {
    const g = EmberDebug.game;
    for (const m of g.s.p.board) {
      m.sick = false;
      m.attacks = 0;
      m.frozen = false;
    }
    g.emit();
  });
  await page.locator("#minions .minion.friendly.ready").first().click();
  await expect(page.locator("#touch-target-bar")).toBeVisible();
}

test.describe("viewport class changes mid-match", () => {
  test("widening a phone-width window restores the desktop battle", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 800, height: 600 },
    });
    const page = await ctx.newPage();
    await startDemo(page);

    const narrow = await read(page);
    expect(narrow.mobile).toBe(true);
    expect(narrow.available).toBe(true);
    expect(narrow.anchorOnCard).toBe(true);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => EmberViewport.mobile === false);
    await page.waitForFunction(() => !EmberFX.busy);

    const wide = await read(page);
    expect(wide.available).toBe(true);
    expect(wide.anchorOnCard).toBe(true);
    expect(wide.anchor.w).toBeGreaterThan(narrow.anchor.w);
    // No leftover phone geometry on the prompt.
    expect(wide.barStyle || "").not.toMatch(/left|top|width|height/);

    await aim(page);
    const bar = await page.locator("#touch-target-bar").boundingBox();
    const brand = await page.locator(".brand").first().boundingBox();
    expect(bar).not.toBeNull();
    expect(brand).not.toBeNull();
    expect(overlaps(bar, brand)).toBe(false);

    await ctx.close();
  });

  test("narrowing a desktop window hands the match back to the phone layout", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    await startDemo(page);
    const wide = await read(page);
    expect(wide.mobile).toBe(false);
    expect(wide.available).toBe(true);

    await aim(page);
    expect(await page.evaluate(() => !!Emberfall.selection)).toBe(true);

    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForFunction(() => EmberViewport.mobile === true);
    await page.waitForFunction(() => !EmberFX.busy);

    // An aim whose anchors have just moved is not worth keeping.
    expect(await page.evaluate(() => !!Emberfall.selection)).toBe(false);
    await expect(page.locator("#target-lines")).toBeHidden();
    const narrow = await read(page);
    expect(narrow.available).toBe(true);
    expect(narrow.anchorOnCard).toBe(true);
    expect(narrow.anchor.w).toBeLessThan(wide.anchor.w);

    await ctx.close();
  });
});
