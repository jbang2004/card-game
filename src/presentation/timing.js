/* Battle presentation timing and weight tiers. Single source of truth for the
 * director (effects.js / combat.js) and the fx2 engine. Values mirror
 * docs/design/BATTLE_PRESENTATION_V2.md §4 — change the document first. */
const EmberTiming = (() => {
  const freeze = (o) => {
    for (const v of Object.values(o))
      if (v && typeof v === "object" && !Object.isFrozen(v)) freeze(v);
    return Object.freeze(o);
  };
  /* Tier 1: amount <= 2 (or no amount: buffs, statuses, summons).
   * Tier 2: 3–5. Tier 3: >= 6, lethal, or a hero taking >= 5. */
  function tierOf({ amount = 0, lethal = false, heroTarget = false } = {}) {
    const n = Math.max(0, Number(amount) || 0);
    if (lethal || n >= 6 || (heroTarget && n >= 5)) return 3;
    return n >= 3 ? 2 : 1;
  }
  return freeze({
    tiers: [
      null,
      { contactScale: 0.8, shakePx: 0, shakeMs: 0, hitStopMs: 0, recoilPx: 6, volume: 0.75 },
      { contactScale: 1.0, shakePx: 3, shakeMs: 160, hitStopMs: 50, recoilPx: 10, volume: 0.9 },
      { contactScale: 1.2, shakePx: 6, shakeMs: 240, hitStopMs: 90, recoilPx: 14, volume: 1.0 },
    ],
    tierOf,
    stagger: 45,
    staggerSteps: 5,
    attack: { lift: 110, lunge: 150, recover: 200, rangedRecoil: 90, rangedSpeed: 1800, rangedMin: 90, rangedMax: 220 },
    spell: { castFlash: 120, projectileSpeed: 1400, projectileMin: 160, projectileMax: 320, link: 140 },
    death: { delay: 120, freeze: 100, dissolve: 320, reflow: 220 },
    summon: { land: 260, legendary: 500 },
    draw: 300,
    turnCue: 900,
    cutin: { in: 70, hold: 190, out: 80, lead: 340 },
    residueMaxMs: 250,
    contactBoxMax: 1.25,
    aoePad: 24,
    flashMaxLuma: 1.3,
    numberSyncMs: 34,
  });
})();
if (typeof module !== "undefined") module.exports = EmberTiming;
