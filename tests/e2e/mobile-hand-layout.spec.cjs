const { test, expect } = require("@playwright/test");
const path = require("node:path");

const output = path.resolve("artifacts/mobile-hand-fix-20260919");
for (const [width, height] of [
  [320, 568],
  [390, 844],
  [568, 320],
  [844, 390],
  [768, 1024],
]) {
  test(`mobile cards never overlap and hero HUD stays frameless: ${width}x${height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    for (const count of [1, 2, 6, 10]) {
      await page.evaluate((count) => {
        EmberFX.cancel(true);
        const g = EmberDebug.game;
        g.s.active = "p";
        g.s.p.mana = g.s.p.maxMana = 10;
        g.s.p.hand = Array.from({ length: count }, (_, i) =>
          g.card(i % 2 ? "fireball" : "guard"),
        );
        g.events = [];
        g.emit();
        document.getElementById("hand").scrollLeft = 0;
      }, count);
      const geometry = await page.locator("#hand").evaluate((hand) => {
        const cards = [...hand.children].map((el) =>
          el.getBoundingClientRect(),
        );
        return {
          gaps: cards.slice(1).map((r, i) => r.left - cards[i].right),
          pan: hand.classList.contains("hand-pan"),
          overflowing: hand.scrollWidth > hand.clientWidth + 1,
        };
      });
      expect(geometry.gaps.every((gap) => gap >= 7)).toBe(true);
      expect(geometry.pan).toBe(geometry.overflowing);
    }
    await page.screenshot({
      path: path.join(output, `${width}x${height}-hand.png`),
    });
    const state = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
    // Check actual hit testing at both rail ends, not just flex dimensions.
    for (const end of ["first", "last"]) {
      const hit = await page.locator("#hand").evaluate((hand, end) => {
        hand.scrollLeft = end === "first" ? 0 : hand.scrollWidth;
        const card =
          end === "first" ? hand.firstElementChild : hand.lastElementChild;
        const r = card.getBoundingClientRect();
        return (
          document
            .elementFromPoint(r.x + r.width / 2, r.y + 32)
            ?.closest(".hand-card") === card
        );
      }, end);
      expect(hit).toBe(true);
    }
    await page.screenshot({
      path: path.join(output, `${width}x${height}-last-card.png`),
    });
    for (const status of ["", "ready", "selected", "valid-target"]) {
      const frames = await page.locator("#battle .hero").evaluateAll(
        (heroes, status) =>
          heroes.map((hero) => {
            hero.classList.remove("ready", "selected", "valid-target");
            if (status) hero.classList.add(status);
            /* a hero standing on its dais shows its state on its name plaque (its card frame is gone) */
            const outer = getComputedStyle(hero),
              portrait = getComputedStyle(
                hero.querySelector(hero.classList.contains("hero-station") ? ".hero-name" : ".portrait-frame"),
              );
            return {
              border: outer.borderTopWidth,
              outline: outer.outlineWidth,
              background: outer.backgroundColor,
              shadow: outer.boxShadow,
              innerBackground: getComputedStyle(
                hero.querySelector(".hero-card-inner"),
              ).backgroundColor,
              portrait: portrait.borderTopColor,
            };
          }),
        status,
      );
      for (const frame of frames) {
        expect(frame.border).toBe("0px");
        expect(frame.outline).toBe("0px");
        expect(frame.background).toBe("rgba(0, 0, 0, 0)");
        expect(frame.shadow).toBe("none");
        expect(frame.innerBackground).toBe("rgba(0, 0, 0, 0)");
        /* The court's palette (skins/slate/arena.css): ember for "can act",
         * brass for the chosen hero, amber for a target. */
        if (status === "ready") expect(frame.portrait).toBe("rgb(255, 179, 90)");
        if (status === "selected")
          expect(frame.portrait).toBe("rgb(243, 223, 166)");
        if (status === "valid-target")
          expect(frame.portrait).toBe("rgb(224, 180, 85)");
      }
    }
    await page.screenshot({
      path: path.join(output, `${width}x${height}-target.png`),
    });
    await page.setViewportSize({ width: height, height: width });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      state,
    );
    const gaps = await page
      .locator("#hand .hand-card")
      .evaluateAll((cards) =>
        cards
          .slice(1)
          .map(
            (card, i) =>
              card.getBoundingClientRect().left -
              cards[i].getBoundingClientRect().right,
          ),
      );
    expect(gaps.every((gap) => gap >= 7)).toBe(true);
    await context.close();
  });
}
