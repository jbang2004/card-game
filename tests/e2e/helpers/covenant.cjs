/* The hand-dock slot no longer opens the covenant page directly: tapping it
 * lifts the contract card onto the god stage (docs/design/BATTLE_REDESIGN_
 * 20260914.md §11). The full page — enemy contracts, soul ledger, per-card
 * roster — is one link inside that stage, so player-facing tests take the
 * same two steps a player does. With no player contracts the slot still
 * opens the page straight away. */
async function openCovenantPage(page) {
  await page.locator("#contract-open").click();
  const link = page.locator("#god-covenant-page");
  if (await link.count()) await link.click();
}
module.exports = { openCovenantPage };
