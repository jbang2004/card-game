/* Stateless policy. Reads visible board and its own hand, never opponent draws. */
const EmberAI = (() => {
  const R =
    typeof EmberRules !== "undefined" ? EmberRules : require("./effects.js");
  function scoreEffect(g, e, side, target) {
    const p = g.s[side],
      opp = g.other(side),
      enemy = g.s[opp];
    const ts = R.targets(g, { side, target }, e.to),
      n = (e.amount || 0) + (e.spell ? g.spellBonus(side) : 0);
    switch (e.type) {
      case "damage":
        return ts.reduce((s, t) => {
          const m = g.getTarget(t);
          if (t.uid === "hero") return s + (m.hp + m.armor <= n ? 1000 : 1.2);
          return (
            s +
            (m.tags.includes("shield")
              ? 0.5
              : m.hp <= n
                ? 6 + m.atk
                : Math.min(n, m.hp) * 0.8)
          );
        }, 0);
      case "buff":
        return ts.reduce((s, t) => {
          const m = g.getTarget(t);
          return s + m.atk + m.hp / 3;
        }, 0);
      case "grant":
        return ts.reduce((s, t) => {
          const m = g.getTarget(t);
          return s + (m.tags.includes(e.tag) ? -20 : m.atk + m.hp / 3);
        }, 0);
      case "destroy":
      case "transform":
        return ts.reduce((s, t) => {
          const m = g.getTarget(t);
          return s + m.atk + m.hp / 2;
        }, 0);
      case "silence":
        return ts.reduce((s, t) => {
          const m = g.getTarget(t);
          return (
            s +
            (t.side === side
              ? -20
              : m.tags.length * 3 + m.atk - g.data.byId[m.cid].atk)
          );
        }, 0);
      case "freeze":
        return ts.filter((t) => !g.getTarget(t).frozen).length * 1.8;
      case "heal":
        return p.maxHp - p.hp >= e.amount * 0.66 ? 5 : 0.5;
      case "draw":
      case "discover":
        return p.hand.length < 6 ? 4 : 0.1;
      case "summon":
        return Math.min(e.count, 7 - p.board.length) * 3;
      case "mana":
        return p.hand.some(
          (h) => g.cost(h) > p.mana && g.cost(h) <= p.mana + e.amount,
        )
          ? 6
          : -8;
      case "secret":
        return 2.5;
      case "armor":
        return e.amount * 0.5;
      case "randomDamageFreeze":
        return enemy.board.length ? 2 : 0;
      default:
        throw Error("Missing AI policy for " + e.type);
    }
  }
  function choose(g) {
    const s = g.s,
      side = "e";
    if (s.phase !== "battle" || s.active !== side) return { type: "none" };
    if (s.choice)
      return {
        type: "choose",
        cid: s.choice.cards
          .slice()
          .sort((a, b) => g.data.byId[b].cost - g.data.byId[a].cost)[0],
      };
    const actions = [];
    for (const m of [...s.e.board, { uid: "hero" }])
      for (const t of g.attackTargets(side, m.uid)) {
        const a = g.getTarget({ side, uid: m.uid }),
          atk = m.uid === "hero" ? a.weapon.atk : a.atk,
          d = g.getTarget(t);
        const score =
          t.uid === "hero"
            ? d.hp + d.armor <= atk
              ? 2000
              : 3 + atk * 0.2
            : (d.hp <= atk ? 5 + d.atk : 1) -
              (m.uid !== "hero" && a.hp <= d.atk ? a.atk * 0.65 : 0) +
              (d.tags.includes("taunt") ? 2 : 0);
        actions.push({ type: "attack", uid: m.uid, target: t, score });
      }
    for (const card of s.e.hand) {
      if (g.legalCard(side, card.uid)) continue;
      const c = g.data.byId[card.cid],
        ts = c.target ? g.targets(c.target, side) : [null];
      if (c.type === "minion" && !ts.length) ts.push(null);
      for (const t of ts) {
        let score =
          c.type === "minion"
            ? 5 + c.cost * 0.8
            : c.type === "weapon"
              ? s.e.weapon
                ? -4
                : 5
              : 0;
        // Battlecry usefulness contributes without making an ordinary minion unplayable.
        const effects = c.onPlay.reduce(
          (n, e) => n + scoreEffect(g, e, side, t),
          0,
        );
        score += c.type === "minion" ? Math.max(0, effects) * 0.25 : effects;
        actions.push({ type: "play", uid: card.uid, target: t, score });
      }
    }
    if (!g.legalPower(side)) actions.push({ type: "power", score: 2 });
    actions.sort((a, b) => b.score - a.score);
    return actions.length && actions[0].score > 0
      ? actions[0]
      : { type: "end" };
  }
  return Object.freeze({ choose });
})();
if (typeof module !== "undefined") module.exports = EmberAI;
