/* Desktop hand geometry. Touch retains its native scrolling layout.
 * Reserve space for every card's cost and stats, including a ten-card hand. */
const EmberHand = (() => {
  function metrics(count) {
    const n = Math.max(1, Math.min(10, count));
    const gap = 16;
    const width = Math.min(142, Math.floor((1160 - (n - 1) * gap) / n));
    return { width, height: n > 7 ? 172 : 184, step: width + gap };
  }
  return Object.freeze({ metrics });
})();
