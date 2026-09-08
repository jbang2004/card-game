const { test, expect } = require("@playwright/test");
async function ready(page) {
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
}
async function idle(page) {
  await page.waitForFunction(() => !EmberFX.busy);
}
async function practice(page) {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#start-btn").click();
  await page.locator("#game-mode").selectOption("practice");
  await page.locator("#practice-opponent").selectOption("ranger_pack");
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await idle(page);
}
test("collection: all presets, class filters, rule text and expansion artwork", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#collection-nav").click();
  await expect(page.locator("#deck-plan")).toContainText(
    await page.evaluate(
      () =>
        EmberData.archetypes.find(
          (a) => a.id === EmberData.heroes[0].defaultDeckId,
        ).plan,
    ),
  );
  for (const hero of ["mage", "paladin", "ranger"]) {
    await page.locator("#deck-class").selectOption(hero);
    await expect(page.locator("#deck-preset option")).toHaveCount(
      await page.evaluate(
        (id) => EmberData.archetypes.filter((a) => a.classId === id).length,
        hero,
      ),
    );
    const ids = await page
      .locator("#deck-preset option")
      .evaluateAll((xs) => xs.map((x) => x.value));
    for (const id of ids) {
      await page.locator("#deck-preset").selectOption(id);
      await page.locator("#deck-reset").click();
      await expect(page.locator("#deck-total")).toHaveText("30/30");
      await expect(page.locator("#deck-save")).toBeEnabled();
    }
    expect(
      await page
        .locator("[data-add]")
        .evaluateAll(
          (xs, hero) =>
            xs.every((x) =>
              ["neutral", hero].includes(EmberData.byId[x.dataset.add].class),
            ),
          hero,
        ),
    ).toBe(true);
  }
  expect(
    await page.evaluate(async () => {
      for (const c of EmberData.cards.filter((c) => c.set)) {
        const img = new Image();
        img.src = AnimeAssets[c.id];
        await img.decode();
      }
      return EmberData.cards.filter((c) => c.set).length;
    }),
  ).toBe(23);
  await page.screenshot({ path: "artifacts/qa/oaths-library.png" });
});
test("practice preserves an existing campaign save, survives both hero powers and exits cleanly", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await ready(page);
  const old = require("../fixtures/save-current.json");
  await page.evaluate(
    (s) => localStorage.setItem("emberfall.v1", JSON.stringify(s)),
    old,
  );
  await page.locator("#start-btn").click(); // button state was rendered before fixture was inserted; opens/resumes depending source state
  if ((await page.locator("#game-mode").count()) === 0) {
    await page.locator("#home-btn").click();
    await page.locator("#quick-btn").click();
    await page.locator("#ok-confirm").click();
  }
  await page.locator("#game-mode").selectOption("practice");
  await page.locator("#practice-opponent").selectOption("mage_frost");
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await idle(page);
  await expect(page.locator("#chapter-name")).toHaveText("酒馆练习");
  expect(
    await page.evaluate(() => EmberDebug.game.powerDefinition("e").id),
  ).toBe("mage");
  await page.locator("#end-turn").click();
  await page.waitForFunction(
    () => EmberDebug.game.s.active === "p" && !EmberFX.busy,
  );
  await page.locator("#home-btn").click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("emberfall.v1"))),
  ).toEqual(old);
  expect(errors).toEqual([]);
});
for (const [width, height] of [
  [390, 844],
  [844, 390],
])
  test(`new deck and mode controls remain accessible on touch ${width}x${height}`, async ({
    browser,
  }) => {
    const c = await browser.newContext({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await c.newPage();
    await page.goto("http://127.0.0.1:8000/dist/?debug=1");
    await ready(page);
    await page.locator("#start-btn").tap();
    await page.locator("#game-mode").selectOption("practice");
    await page.locator("#practice-opponent").scrollIntoViewIfNeeded();
    expect(
      await page.locator("#practice-opponent").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) ===
          el
        );
      }),
    ).toBe(true);
    await page.locator("#practice-opponent").selectOption("paladin_guard");
    await page.screenshot({ path: `artifacts/qa/oaths-chooser-${width}.png` });
    await page.locator("#hero-confirm").tap();
    await expect(page.locator("#mulligan-confirm")).toBeVisible();
    await c.close();
  });
test("full practice game through visible card/target controls with no stuck triggers", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await ready(page);
  await page.evaluate(() => {
    Emberfall.settings.reduced = true;
    EmberFX.configure(true, false);
  });
  await page.locator("#start-btn").click();
  await page.locator('[data-hero="ranger"]').click();
  await page.locator("#hero-archetype").selectOption("ranger_death");
  await page.locator("#game-mode").selectOption("practice");
  await page.locator("#practice-opponent").selectOption("mage_burn");
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  let moves = 0;
  while (moves++ < 180) {
    await page.waitForFunction(
      () =>
        !EmberFX.busy &&
        (EmberDebug.game.s.phase === "over" ||
          EmberDebug.game.s.active === "p"),
    );
    const phase = await page.evaluate(() => EmberDebug.game.s.phase);
    if (phase === "over") break;
    const a = await page.evaluate(() => EmberDebug.game.trainingAction("p"));
    if (moves % 15 === 0)
      console.log(
        "UI moves",
        moves,
        await page.evaluate(() => EmberDebug.game.s.turn),
      );
    expect(["choose", "end", "contract", "play", "attack", "power"]).toContain(
      a.type,
    );
    if (a.type === "contract") {
      await page.locator("#contract-open").click();
      await page.locator(`[data-invoke="${a.cid}"]`).click();
      continue;
    }
    if (a.type === "choose") {
      await page.locator(`[data-discover="${a.cid}"]`).click();
      continue;
    }
    if (a.type === "end") {
      await page.locator("#end-turn").click();
      continue;
    }
    const target = a.target
      ? a.target.uid === "hero"
        ? `#${a.target.side === "p" ? "player" : "enemy"}-hero`
        : `.minion[data-uid="${a.target.uid}"]`
      : null;
    if (a.type === "play") {
      await page.locator(`#hand [data-hand="${a.uid}"]`).click();
      if (target) await page.locator(target).click();
    }
    if (a.type === "attack") {
      await page
        .locator(
          a.uid === "hero"
            ? "#player-hero"
            : `.minion.friendly[data-uid="${a.uid}"]`,
        )
        .click();
      await page.locator(target).click();
    }
    if (a.type === "power") {
      await page.locator("#power-btn").click();
      if (target) await page.locator(target).click();
    }
  }
  expect(await page.evaluate(() => EmberDebug.game.s.phase)).toBe("over");
  expect(errors).toEqual([]);
  await expect(page.locator("#result-next")).toHaveText("再选一局");
  await page.screenshot({ path: "artifacts/qa/oaths-practice-result.png" });
});

test("campaign refit rejects a third copy and carries a legal replacement forward", async ({
  page,
}) => {
  await page.goto("./?debug=1");
  await ready(page);
  await page.locator("#start-btn").click();
  await page.locator("#hero-confirm").click();
  await page.locator("#mulligan-confirm").click();
  await idle(page);
  const choices = await page.evaluate(() => {
    const g = EmberDebug.game,
      deck = g.s.customDeck;
    const counts = Object.fromEntries(
      [...new Set(deck)].map((id) => [id, deck.filter((x) => x === id).length]),
    );
    const twice = Object.keys(counts).find((id) => counts[id] === 2);
    const remove = deck.find((id) => id !== twice);
    const add = EmberData.cards.find(
      (c) => !c.token && c.class === "mage" && !counts[c.id],
    ).id;
    Emberfall.settings.reduced = true;
    EmberFX.configure(true, false);
    g.s.e.hp = 0;
    g.cleanup();
    g.emit();
    return { twice, remove, add, deck: [...deck] };
  });
  await page.locator("#result-next").click();
  await page.locator(".campaign-refit summary").click();
  await page.locator("#refit-remove").selectOption(choices.remove);
  await page.locator("#refit-add").selectOption(choices.twice);
  await page.locator(".relic-choice").first().click();
  await page.locator("#reward-confirm").click();
  await expect(page.locator("#refit-status")).toContainText("最多 2 张");
  expect(await page.evaluate(() => Emberfall.game.s.bossIndex)).toBe(0);
  expect(await page.evaluate(() => Emberfall.game.s.customDeck)).toEqual(
    choices.deck,
  );
  await page.locator("#refit-add").selectOption(choices.add);
  await page.locator(".relic-choice").first().click();
  await page.locator("#reward-confirm").click();
  const expected = [...choices.deck];
  expected[expected.indexOf(choices.remove)] = choices.add;
  expect(await page.evaluate(() => Emberfall.game.s.customDeck)).toEqual(
    expected,
  );
  await expect(page.locator("#mulligan-confirm")).toBeVisible();
});
