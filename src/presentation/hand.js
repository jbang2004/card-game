/* Desktop hand geometry. Touch retains its native scrolling layout.
 * Reserve space for every card's cost and stats, including a ten-card hand. */
const EmberHand = (() => {
  const CARD_RATIO = 5 / 7.4;

  function metrics(count) {
    const n = Math.max(1, Math.min(10, count));
    const gap = 16;
    const heightLimit = n > 7 ? 172 : 184;
    const width = Math.min(
      Math.floor(heightLimit * CARD_RATIO),
      Math.floor((1160 - (n - 1) * gap) / n),
    );
    const height = Math.round(width / CARD_RATIO);
    return { width, height, step: width + gap };
  }
  return Object.freeze({ metrics });
})();
