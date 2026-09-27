/* Hero select no longer opens a battle directly: the expedition (EmberRun)
 * first offers its level's opponents, and the battle starts from that choice.
 * A player-facing test takes the same step a player does. The deck and the
 * covenants chosen on hero select belong to a practice duel, so tests that
 * need them pick the practice mode first. */
const { turnTo } = require("./dialog-pages.cjs");
async function chooseFoe(page, index = 0) {
  await page.locator("#modal .run-box [data-foe]").nth(index).click();
  await page.locator("#run-confirm").click();
}
/** hero select → the level's first opponent → the opening hand */
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
/** the lobby → an expedition battle for this hero, whose run has taken the hero's own covenants as treasures (a
 *  run carries them from battle to battle, and its match is the one kept across a reload) → the opening hand */
async function beginWithCovenants(page, heroId) {
  await page.evaluate((heroId) => {
    const D = EmberData,
      run = EmberRun.create(D, heroId, 7);
    run.contracts = [...(D.heroes.find((h) => h.id === heroId).defaultContracts || [])];
    localStorage.setItem("emberfall.run.v1", JSON.stringify(run));
  }, heroId);
  await page.locator("#start-btn").click();
  await chooseFoe(page);
  await page.locator("#mulligan-confirm").waitFor();
}
module.exports = { chooseFoe, beginExpedition, choosePractice, beginWithCovenants };
