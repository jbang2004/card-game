const { test, expect } = require("@playwright/test");
const path = require("node:path");

const MATERIAL_PROPERTIES = [
  "backgroundColor",
  "backgroundImage",
  "borderTopColor",
  "borderTopStyle",
  "borderTopWidth",
  "borderRadius",
  "boxShadow",
  "clipPath",
  "color",
  "fontFamily",
  "fontWeight",
  "textShadow",
];

const pages = {
  menu: [".modal-box", ".menu-action", ".modal-close"],
  gallery: [".atelier-box", ".atelier-vignette", "#atelier-done"],
  journal: [".tactical-log", ".touch-log", ".modal-close"],
  intelligence: [".tactical-intel", ".touch-live-stat", "#touch-hero-close"],
  lobby: [
    ".topbar",
    ".brand",
    "#start-btn",
    "#quick-btn",
    "#lobby-library-btn",
    "#atelier-open",
    ".icon-btn",
    ".lobby-actions .ghost-btn",
    ".lobby-bottom",
  ],
  heroes: [
    ".hero-chooser",
    ".modal-close",
    ".modal-heading h2",
    ".hero-option",
    ".hero-option.selected",
    ".hero-option.selected h3",
    ".hero-option.selected .selected-check",
    ".hero-configuration",
    ".hero-profile-heading h3",
    ".hero-skill",
    ".hero-skill .theme-orbit",
    ".hero-skill strong",
    ".hero-skill p",
    ".hero-config-intro",
    ".hero-config-deck",
    ".hero-config-deck select",
    ".hero-config-contract",
    ".hero-composition",
    ".comp-curve i",
    '.hero-mode-cards button[aria-pressed="true"]',
    '.hero-mode-cards button[aria-pressed="true"] span',
    '.hero-mode-cards button[aria-pressed="true"] small',
    '[data-mode="campaign"]',
    "#hero-deck-btn",
    "#hero-confirm",
  ],
  settings: [
    ".settings-box",
    ".modal-close",
    ".settings-nav button",
    ".settings-nav button.active",
    ".setting-row",
    "#settings-done",
    ".audio-sliders",
    ".audio-level",
    "#audio-volume",
    ".toggle",
    ".wind-time-setting",
  ],
  map: [
    ".adventure-atlas",
    ".modal-close",
    ".atlas-stage",
    ".atlas-node",
    ".atlas-heading h2",
    ".atlas-dossier",
    ".atlas-footer",
  ],
  help: [
    ".help-box",
    ".modal-close",
    ".help-toc button",
    ".help-toc button.active",
    ".help-turn-flow",
    ".key-table",
    "#help-done",
  ],
  library: [
    ".library-box",
    ".modal-close",
    ".filter-btn",
    ".filter-btn.active",
    ".deck-actions button",
    ".deck-editor",
    ".deck-row",
    ".library-item .card",
  ],
  detail: [
    ".modal-box",
    ".card-detail-layout",
    ".card-detail-rule",
    "#library-detail-back",
    "#library-detail-add",
  ],
  mulligan: [
    ".mulligan-box",
    ".mulligan-card",
    ".mulligan-card.replace",
    ".mulligan-card .card",
    ".mulligan-choice-state",
    "#mulligan-confirm",
  ],
  battle: [
    "#battle-log-toggle",
    "#contract-open",
    "#intel-toggle",
    "#end-turn",
    "#power-btn",
    ".mana-panel",
    ".hand-card .card",
    ".hero",
  ],
  battleOpen: [".boss-panel", "#intel-toggle"],
  contracts: [
    ".covenant-box",
    ".modal-close",
    ".covenant-tabs button",
    '.covenant-tabs button[aria-pressed="true"]',
    ".covenant-card",
    ".covenant-card.divine",
    ".covenant-copy .gold-btn",
  ],
  confirm: [".confirm-box", "#cancel-confirm", "#ok-confirm"],
  discover: [".modal-box", ".discover-card", ".discover-card .card"],
  result: [
    ".result-box",
    ".result-sigil",
    ".result-stats",
    ".result-stats > div",
    "#result-home",
    "#result-next",
  ],
  rewards: [
    ".rewards-box",
    ".relic-choice",
    '.relic-choice[aria-pressed="true"]',
    "#reward-confirm",
  ],
};

async function fingerprint(page, selectors) {
  // Exercise the actual shared surfaces, including late-mounted guide content.
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".crafted-panel")].every(
      (panel) =>
        panel.querySelectorAll(":scope > .panel-corner-trim > svg").length ===
        4,
    ),
  );
  await page.mouse.move(0, 0);
  const result = {};
  for (const selector of selectors) {
    const node = page.locator(`${selector}:visible`).first();
    if (!(await node.count())) continue;
    result[selector] = await node.evaluate((element, properties) => {
      if (element.id === "end-turn") {
        element.classList.remove("ready-end", "thinking");
        element.disabled = false;
      }
      if (element.matches(".hand-card .card"))
        element.parentElement.classList.remove("playable", "selected");
      const style = getComputedStyle(element);
      return Object.fromEntries(properties.map((key) => [key, style[key]]));
    }, MATERIAL_PROPERTIES);
  }
  if (process.env.PANEL_AUDIT) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Hidden roster images also supply full-screen covenant artwork.
      await Promise.all([...document.querySelectorAll("#modal img")].map((img) => img.decode()));
    });
    const type = await page.locator("#modal").getAttribute("data-type");
    await page.screenshot({
      path: path.resolve(
        process.env.PANEL_AUDIT,
        `${page.viewportSize().width}-${type || "lobby"}.png`,
      ),
    });
  }
  const issues = await page.evaluate(() => {
    const issues = [];
    for (const panel of document.querySelectorAll(".crafted-panel")) {
      if (!panel.getBoundingClientRect().width || !panel.checkVisibility())
        continue;
      const s = getComputedStyle(panel);
      const padding = ["Top", "Right", "Bottom", "Left"].map((side) =>
        parseFloat(s[`padding${side}`]),
      );
      if (padding.some((n) => n < 20 || Math.abs(n - padding[0]) > 0.1))
        issues.push(`${panel.className}: uneven padding ${padding}`);
      if (s.borderRadius !== "0px")
        issues.push(`${panel.className}: old radius ${s.borderRadius}`);
      if (s.backgroundColor !== "rgba(16, 26, 42, 0.9)")
        issues.push(
          `${panel.className}: mismatched material ${s.backgroundColor}`,
        );
      if (s.backgroundImage !== "none")
        issues.push(
          `${panel.className}: old surface image ${s.backgroundImage.slice(0, 100)}`,
        );
    }
    return issues;
  });
  expect(issues).toEqual([]);
  return result;
}

async function captureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
  });
  const page = await context.newPage();
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.addStyleTag({
    content:
      "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  const result = { lobby: await fingerprint(page, pages.lobby) };

  await page.locator("#touch-menu").evaluate((button) => button.click());
  result.menu = await fingerprint(page, pages.menu);
  await page.locator('[data-touch-menu="gallery"]').click();
  result.gallery = await fingerprint(page, pages.gallery);
  await page.locator("#atelier-done").click();

  await page.locator("#settings-btn").evaluate((button) => button.click());
  result.settings = await fingerprint(page, pages.settings);
  await page.locator(".modal-close").click();

  await page.locator("#adventure-nav").evaluate((button) => button.click());
  result.map = await fingerprint(page, pages.map);
  await page.locator(".modal-close").click();

  await page.locator("#guide-nav").evaluate((button) => button.click());
  result.help = await fingerprint(page, pages.help);
  await page.locator(".modal-close").click();

  await page.locator("#collection-nav").evaluate((button) => button.click());
  result.library = await fingerprint(page, pages.library);
  await page.locator("[data-library-inspect]").first().click();
  result.detail = await fingerprint(page, pages.detail);
  await page.locator("#library-detail-back").click();
  await page.locator(".modal-close").click();

  await page.locator("#start-btn").click();
  await page.locator('[data-hero="morla"]').click();
  result.heroes = await fingerprint(page, pages.heroes);
  await page.locator("#hero-confirm").click();
  await page.locator("[data-mulligan]").first().click();
  result.mulligan = await fingerprint(page, pages.mulligan);
  const openingHand = await page
    .locator(".mulligan-card")
    .evaluateAll((cards) =>
      cards.map((button) => {
        const b = button.getBoundingClientRect();
        const art = button.querySelector(".card").getBoundingClientRect();
        const label = button
          .querySelector(".mulligan-choice-state")
          .getBoundingClientRect();
        return label.top >= art.bottom + 8 && label.bottom <= b.bottom + 1;
      }),
    );
  expect(openingHand.every(Boolean)).toBe(true);
  await page.locator("#mulligan-confirm").click();
  await page.waitForFunction(() => Emberfall.inBattle && !EmberFX.busy);
  await page
    .locator("#end-turn")
    .evaluate((button) => button.classList.remove("ready-end"));
  result.battle = await fingerprint(page, pages.battle);
  await page.locator("#intel-toggle").evaluate((button) => button.click());
  result.battleOpen = await fingerprint(page, pages.battleOpen);
  await page.locator("#intel-toggle").evaluate((button) => button.click());
  await page.locator("#touch-menu").evaluate((button) => button.click());
  await page.locator('[data-touch-menu="journal"]').click();
  result.journal = await fingerprint(page, pages.journal);
  await page.locator(".modal-close").click();
  await page.locator("#touch-menu").evaluate((button) => button.click());
  await page.locator('[data-touch-menu="boss"]').click();
  result.intelligence = await fingerprint(page, pages.intelligence);
  await page.locator("#touch-hero-close").click();
  await page.locator("#contract-open").click();
  result.contracts = await fingerprint(page, pages.contracts);
  await page.keyboard.press("Escape");

  await page.locator("#settings-btn").evaluate((button) => button.click());
  await page.locator("#restart-battle").click();
  result.confirm = await fingerprint(page, pages.confirm);
  await page.locator("#cancel-confirm").click();
  await page.evaluate(() => {
    const game = EmberDebug.game;
    game.s.choice = { side: "p", cards: ["spark", "frostbolt", "fireball"] };
    game.emit();
  });
  await page.locator("[data-discover]").first().waitFor();
  result.discover = await fingerprint(page, pages.discover);
  await page.locator("[data-discover]").first().click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    const game = EmberDebug.game;
    game.s.e.hp = 0;
    game.s.rewardOffers = ["heart", "lens", "crown"];
    game.cleanup();
    game.emit();
  });
  await page.locator("#result-next").waitFor();
  result.result = await fingerprint(page, pages.result);
  await page.locator("#result-next").click();
  await page.locator('[data-relic="lens"]').click();
  result.rewards = await fingerprint(page, pages.rewards);
  await context.close();
  return result;
}

test("shared components keep one material contract across viewports", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const desktop = await captureViewport(browser, {
    width: 1600,
    height: 940,
    touch: false,
  });
  const differences = [];
  for (const viewport of [
    { width: 1228, height: 996, touch: false },
    { width: 752, height: 1056, touch: true },
    { width: 390, height: 844, touch: true },
    { width: 844, height: 390, touch: true },
  ]) {
    const compact = await captureViewport(browser, viewport);
    for (const [pageName, selectors] of Object.entries(desktop)) {
      for (const [selector, expected] of Object.entries(selectors)) {
        const actual = compact[pageName][selector];
        // Responsive composition may hide or replace navigation affordances.
        // Only compare components that are physically present in both layouts.
        if (!actual) continue;
        for (const property of MATERIAL_PROPERTIES)
          if (actual[property] !== expected[property])
            differences.push(
              `${viewport.width}x${viewport.height} ${pageName} ${selector} ${property}: ${expected[property]} -> ${actual[property]}`,
            );
      }
    }
  }
  expect(differences).toEqual([]);
});
