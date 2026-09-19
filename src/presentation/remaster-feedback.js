/* Pure family adapter; shared motion feedback owns DOM poses and cue deduplication. */
const EmberRemasterFeedback = Object.freeze({
  name: "remaster",
  supports: d => EmberRemasterArts.supports(d.kind),
  reaction: (d, t) => EmberRemasterArts.reaction(d, t),
  events: d => EmberRemasterCues.events(d),
  type: (d, cue) => `remaster-${d.kind}-${cue.id}`,
});
