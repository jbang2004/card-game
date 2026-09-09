// Follow the same disclosure interaction as a player; never force hidden inputs.
async function openDeckTools(page) {
  const tools = page.locator("#deck-tools");
  if (!(await tools.evaluate((el) => el.open)))
    await tools.locator(":scope > summary").click();
}
module.exports = { openDeckTools };
