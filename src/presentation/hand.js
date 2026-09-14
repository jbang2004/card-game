/* Desktop hand geometry. Touch retains its dock layout (mobile-view.js).
 * The desktop hand is a dock too (docs/design/BATTLE_REDESIGN_20260914.md §11):
 * the card size no longer shrinks with the hand — a ten-card hand overlaps
 * instead, so a card is always legible and always ≥ `MIN_STEP` wide to hit. */
const EmberHand = (() => {
  const CARD_RATIO = 5 / 7.4;
  const RAIL = 1096;
  const CARD_W = 156;
  const GAP = 16;
  const MIN_STEP = 40;

  function metrics(count) {
    const n = Math.max(1, Math.min(10, count));
    const width = CARD_W;
    const height = Math.round(width / CARD_RATIO);
    const step =
      n > 1
        ? Math.max(MIN_STEP, Math.min(width + GAP, (RAIL - width) / (n - 1)))
        : width + GAP;
    return { width, height, step: Math.round(step) };
  }
  return Object.freeze({ metrics });
})();
