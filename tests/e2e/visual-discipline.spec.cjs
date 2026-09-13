const { test, expect } = require("@playwright/test");
const { inspectVisualDiscipline } = require("./helpers/visual-discipline.cjs");
const path = require("node:path");
for (const [width, height] of [
  [752, 884],
  [1117, 884],
  [1132, 1074],
  [1210, 983],
  [1100, 650],
  [1280, 720],
  [1459, 996],
  [1672, 941],
  [390, 844],
  [320, 568],
  [844, 390],
  [568, 320],
])
  test(`hero text and ornaments own separate space ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#start-btn").click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await expect.poll(() => inspectVisualDiscipline(page)).toEqual([]);
    await page.screenshot({
      path: path.resolve(
        `output/visual-discipline-20260913/heroes-${width}.png`,
      ),
    });
    const orbit = page.locator(".hero-skill .theme-orbit");
    expect(
      await orbit.evaluate((e) => {
        let a = e.getBoundingClientRect(),
          b = e.querySelector("svg").getBoundingClientRect();
        return (
          Math.abs(a.x + a.width / 2 - b.x - b.width / 2) +
          Math.abs(a.y + a.height / 2 - b.y - b.height / 2)
        );
      }),
    ).toBeLessThan(2);
    for (const el of await page.locator(".hero-option").all()) {
      await el.click();
      await expect(el).toHaveAttribute("aria-pressed", "true");
      const heroBinding = await page.locator(".hero-chooser").evaluate(() => {
        const selected = EmberData.heroes.find(
          (hero) => hero.id === document.querySelector(".hero-option.selected").dataset.hero,
        );
        const scene = document.querySelector(".hero-chooser > .scene-showcase");
        const icon = document.querySelector(".hero-skill .theme-orbit svg");
        return {
          scene: scene.dataset.artKey,
          portrait: selected.portraitId,
          icon: icon.classList.contains(`ui-icon-${selected.powerIcon}`),
        };
      });
      expect(heroBinding.scene).toBe(heroBinding.portrait);
      expect(heroBinding.icon).toBe(true);
      await expect.poll(() => inspectVisualDiscipline(page)).toEqual([]);
    }
    await page
      .locator('[data-hero="mage"],[data-hero="aelric"]')
      .first()
      .click();
    await page
      .locator(".hero-config-contract summary")
      .scrollIntoViewIfNeeded();
    await page.locator(".hero-config-contract summary").click();
    await expect(page.locator(".hero-config-contract")).toHaveAttribute(
      "open",
      "",
    );
    await expect.poll(() => inspectVisualDiscipline(page)).toEqual([]);
    await page.locator(".hero-config-contract summary").click();
    await page.locator("#hero-confirm").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.resolve(
        `output/visual-discipline-20260913/heroes-${width}-configuration.png`,
      ),
    });
  });
