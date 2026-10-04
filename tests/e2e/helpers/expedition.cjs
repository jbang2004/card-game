/* Hero select no longer opens a battle directly: a descent (EmberRun) first shows Amara's send-off and the act's
 * opening, then its map; the bearer walks to a place, and a battle starts from the opponent met there. A
 * player-facing test takes the same steps a player does. The deck and the covenants chosen on hero select belong to
 * a practice duel, so tests that need them pick the practice mode first. */
const { turnTo } = require("./dialog-pages.cjs");
const RUN_STORE = "emberfall.run.v2";
const step = (page) => page.locator("#modal .run-box").getAttribute("data-run-step", { timeout: 2000 }).catch(() => null);
/** from any page of the run short of a battle (the send-off, an act's opening, the map, an encounter) to the
 *  opening hand of the next battle; on the map the first open place is taken (`index` picks another) */
async function chooseFoe(page, index = 0) {
  for (let i = 0; i < 8; i++) {
    if (await page.locator("#mulligan-confirm").isVisible()) return;
    const at = await step(page);
    if (at === "map") await page.locator("#modal .run-node.is-open").nth(index).click();
    await page.locator("#run-confirm").click();
  }
  await page.locator("#mulligan-confirm").waitFor();
}
/** hero select → the first act's first opponent → the opening hand */
async function beginExpedition(page) {
  await page.locator("#hero-confirm").click();
  await chooseFoe(page);
  await page.locator("#mulligan-confirm").waitFor();
}
/** the practice mode: the mode segments where the layout shows them, the mode select where it does not */
async function choosePractice(page, opponent = null) {
  const segment = page.locator('.hero-mode-cards [data-mode="practice"]');
  if (await segment.isVisible()) await segment.click();
  else {
    await turnTo(page, "#game-mode");
    await page.locator("#game-mode").selectOption("practice");
  }
  if (opponent) await page.locator("#practice-opponent").selectOption(opponent);
}
/** the lobby → a battle of a descent for this hero, whose run has taken the hero's own covenants as treasures (a
 *  run carries them from battle to battle, and its match is the one kept across a reload) → the opening hand */
async function beginWithCovenants(page, heroId) {
  await page.evaluate(([heroId, key]) => {
    const D = EmberData,
      run = EmberRun.begin(D, EmberRun.create(D, heroId, 7));
    run.contracts = [...(D.heroes.find((h) => h.id === heroId).defaultContracts || [])];
    localStorage.setItem(key, JSON.stringify(run));
  }, [heroId, RUN_STORE]);
  await page.locator("#start-btn").click();
  await chooseFoe(page);
  await page.locator("#mulligan-confirm").waitFor();
}
/** the stored run */
const storedRun = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), RUN_STORE);
/** walk a won battle's pages (the note, what to do with the opponent, cards to put down, a treasure) to the bundle
 *  of cards, taking the first of everything */
async function toBundle(page) {
  for (let i = 0; i < 10; i++) {
    const at = await step(page);
    if (at === "bundle") return;
    if (at === "aftermath") await page.locator("#modal [data-choice]:not(:disabled)").first().click();
    else if (at === "treasure") { await page.locator("#modal [data-pick]").first().click(); await page.locator("#run-confirm").click(); }
    else await page.locator("#run-confirm").click();
  }
  await page.locator('#modal .run-box[data-run-step="bundle"]').waitFor();
}
/** a run stored as if it stood at a step of its own: a fresh run on its first act's map, with `patch` laid over it
 *  (`patch` is built in the page from (run, EmberData)); the lobby then resumes it */
async function seedRun(page, heroId, patch) {
  await page.evaluate(([heroId, key, patch]) => {
    const D = EmberData,
      run = EmberRun.begin(D, EmberRun.create(D, heroId, 7));
    Object.assign(run, { at: { row: 0, col: 0 }, path: [0] }, patch);
    if (!EmberRun.valid(run, D)) throw Error("seeded run is not valid");
    localStorage.setItem(key, JSON.stringify(run));
  }, [heroId, RUN_STORE, patch]);
}
module.exports = { seedRun, chooseFoe, beginExpedition, choosePractice, beginWithCovenants, storedRun, toBundle, RUN_STORE };
