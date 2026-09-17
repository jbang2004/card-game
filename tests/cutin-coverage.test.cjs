/* The cut-in bank is exactly the ids that can ever play one.
 *
 * `cutinPolicy` (src/presentation/fx-profiles.js) only allows a cut-in for a
 * hero or a legendary minion, and `cutinFor` (src/presentation/fx-stage.js)
 * refuses to substitute the card illustration, so an id missing from the bank
 * silently gets no cut-in. That silence is correct at runtime but a bad way to
 * find out about a new legendary whose still was never authored — this test is
 * where it surfaces instead. */
const test = require("node:test"),
  assert = require("node:assert/strict");
const cards = require("../src/content/cards.js");
const campaign = require("../src/content/campaign.js");
const CutinAssets = require("../src/cutin-assets.js");

test("dedicated cut-in stills cover the heroes and legendary minions exactly", () => {
  const expected = new Set([
    ...cards
      .filter((c) => c.rarity === "legendary" && c.type === "minion")
      .map((c) => c.id),
    ...[...campaign.heroes, ...campaign.bosses].map((h) => h.portraitId),
  ]);
  const packed = new Set(Object.keys(CutinAssets));
  const missing = [...expected].filter((id) => !packed.has(id)).sort();
  const extra = [...packed].filter((id) => !expected.has(id)).sort();
  assert.deepEqual(
    { missing, extra },
    { missing: [], extra: [] },
    "assets/cutin/*.webp is out of sync with the cut-in policy." +
      "\n  missing stills (a hero or legendary that would silently skip its cut-in): " +
      (missing.join(", ") || "none") +
      "\n  unused stills (drop the webp and rerun tools/cutin_assets.py): " +
      (extra.join(", ") || "none"),
  );
  // Guards the assertion itself: an empty bank must not read as "in sync".
  assert.ok(expected.size >= 10);
  assert.equal(packed.size, expected.size);
  for (const id of packed)
    assert.match(CutinAssets[id], /^data:image\/webp;base64,/);
});
