/* Pure family adapter; shared motion feedback owns DOM poses and cue deduplication. */
const EmberBenchmarkFeedback = Object.freeze({
  name: "benchmark",
  targetMax: 11,
  angleMax: 2.4,
  supports: d => EmberBenchmarkArts.supports(d.swordStyle),
  reaction: (d, t) => EmberBenchmarkArts.reaction(d, t),
  events: d => EmberBenchmarkCues.events(d),
  type: (d, cue) => `benchmark-${d.swordStyle}-${cue.id}`,
});
