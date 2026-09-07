/* Public-information turn planner. Hidden hands, secrets and draw order are never
 * inspected. Simulated draws reserve unknown hand slots, never playable cards. */
const EmberAI = (() => {
  const value = (m) =>
    Math.max(0, m.atk) * 1.45 +
    Math.max(0, m.hp) * 0.75 +
    (m.tags.includes("shield") ? 2 : 0) +
    (m.tags.includes("taunt") ? 1 : 0) +
    (m.tags.includes("poison") ? 2 : 0) +
    (m.tags.includes("windfury") ? m.atk : 0) +
    (m.tags.includes("lifesteal") ? 1 : 0) -
    (m.frozen ? m.atk * 0.55 : 0);
  function evaluate(g, side) {
    const p = g.s[side],
      e = g.s[g.other(side)];
    if (p.hp <= 0) return e.hp <= 0 ? -1000 : -100000;
    if (e.hp <= 0) return 100000;
    const board = (x) =>
      x.board.reduce(
        (n, m) =>
          n +
          value(m) +
          (g.data.byId[m.cid].triggers?.length && !m.silenced ? 2 : 0) +
          (g.data.byId[m.cid].onDeath.length && !m.silenced ? 1.5 : 0),
        0,
      );
    const life = (x) =>
      (x.hp + x.armor) * 0.45 - Math.max(0, 15 - x.hp - x.armor) * 0.8;
    const archetype = g.data.archetypes.find(
      (a) => a.id === (side === "p" ? g.s.archetype : g.s.opponent),
    );
    const pressure = archetype?.strategy === "pressure" ? 1.6 : 1;
    return (
      board(p) -
      board(e) * 1.12 +
      life(p) -
      life(e) * pressure +
      p.hand.length * 2.6 -
      e.hand.length * 1.3 +
      (p.weapon ? p.weapon.atk * Math.min(2, p.weapon.durability) * 0.8 : 0) -
      (e.weapon ? e.weapon.atk * Math.min(2, e.weapon.durability) * 0.8 : 0) +
      // A discovered card provides a hand slot plus selection flexibility.
      (g.s.choice?.side === side ? 2.6 + 1 : 0) +
      p.secrets.length * 2.2 -
      e.secrets.length * 1.2
    );
  }
  function legalActions(g, side) {
    const a = [];
    for (const m of [...g.s[side].board, { uid: "hero" }])
      for (const target of g.attackTargets(side, m.uid))
        a.push({ type: "attack", side, uid: m.uid, target });
    const seen = new Set();
    for (const card of g.s[side].hand) {
      if (
        g.legalCard(side, card.uid) ||
        seen.has(card.cid + ":" + g.cost(card))
      )
        continue;
      seen.add(card.cid + ":" + g.cost(card));
      const c = g.data.byId[card.cid],
        ts = c.target ? g.targets(c.target, side) : [null];
      if (!ts.length && c.type === "minion") ts.push(null);
      for (const target of ts)
        a.push({ type: "play", side, uid: card.uid, target });
    }
    if (!g.legalPower(side)) {
      const c = g.powerDefinition(side);
      for (const target of c.target ? g.targets(c.target, side) : [null])
        a.push({ type: "power", side, target });
    }
    return a;
  }
  function copy(g, side, root = false) {
    const h = new g.constructor({ data: g.data });
    h.simulation = true;
    // Build the initial search state without touching the opponent's card IDs.
    if (root) {
      const other = g.other(side),
        s = g.s;
      h.s = {
        ...s,
        rng: 97531,
        log: [],
        [side]: {
          ...s[side],
          hand: s[side].hand.map((c) => ({ ...c })),
          // Only an unordered multiset of our remaining cards is known. Sorting
          // discards the real draw order; draw() below never reveals an identity.
          deck: s[side].deck
            .map((c) => ({ cid: c.cid, costMod: 99, uid: "unknown" }))
            .sort((a, b) => a.cid.localeCompare(b.cid)),
        },
        [other]: {
          ...s[other],
          hand: s[other].hand.map(() => ({
            cid: "colossus",
            costMod: 99,
            uid: "unknown",
          })),
          deck: s[other].deck.map(() => ({
            cid: "colossus",
            costMod: 99,
            uid: "unknown",
          })),
          secrets: [],
        },
      };
      h.s = structuredClone(h.s);
    } else h.s = structuredClone(g.s);
    h.draw = function (s, n = 1) {
      const p = this.s[s];
      for (let i = 0; i < n; i++) {
        if (p.deck.length) {
          p.deck.shift();
          if (p.hand.length < 10)
            p.hand.push({ cid: "colossus", costMod: 99, uid: this.uid() });
        } else {
          p.fatigue++;
          this.damage(s, "hero", p.fatigue);
        }
      }
    };
    return h;
  }
  function discovery(g, side) {
    const p = g.s[side],
      enemy = g.s[g.other(side)];
    return [...g.s.choice.cards].sort((a, b) => score(b) - score(a))[0];
    function score(id) {
      const c = g.data.byId[id];
      let n = 0;
      for (const e of c.onPlay) {
        if (e.type === "damage")
          n +=
            e.to === "selected"
              ? enemy.hp + enemy.armor <= e.amount + g.spellBonus(side) &&
                c.cost <= p.mana
                ? 1000
                : e.amount * 0.65
              : enemy.board.reduce(
                  (v, m) => v + Math.min(m.hp, e.amount) * 0.8,
                  0,
                );
        if (["destroy", "transform"].includes(e.type))
          n += Math.max(0, ...enemy.board.map(value)) * 0.75;
        if (e.type === "draw" || e.type === "drawFiltered")
          n += Math.min(e.count, 10 - p.hand.length) * 2;
        if (e.type === "heal") n += Math.min(e.amount, p.maxHp - p.hp) * 0.5;
        if (e.type === "freeze")
          n += enemy.board.filter((m) => !m.frozen).length * 1.3;
        if (e.type === "buff")
          n +=
            (e.to === "selected"
              ? Math.min(1, p.board.length)
              : p.board.length) *
            (e.attack + e.health) *
            0.8;
        if (e.type === "summon") n += Math.min(e.count, 7 - p.board.length) * 3;
        if (e.type === "secret") n += p.secrets.includes(id) ? -5 : 2;
        if (e.type === "destroyWeapon")
          n += enemy.weapon ? enemy.weapon.atk * enemy.weapon.durability : 0;
      }
      return n - c.cost * 0.35;
    }
  }
  function choose(g, side = "e", options = {}) {
    if (g.s.phase !== "battle" || g.s.active !== side) return { type: "none" };
    if (g.s.choice) return { type: "choose", cid: discovery(g, side) };
    const root = copy(g, side, true),
      base = evaluate(root, side),
      hiddenSecrets = g.s[g.other(side)].secrets.length;
    const budget = options.budget ?? 220,
      depth = options.depth ?? 7,
      width = options.width ?? 7;
    let frontier = [{ g: root, first: null, penalty: 0 }],
      best = { score: base + 0.1, first: { type: "end", side } },
      visited = 0;
    for (let d = 0; d < depth && frontier.length && visited < budget; d++) {
      const next = [];
      for (const node of frontier)
        for (const action of legalActions(node.g, side)) {
          if (visited++ >= budget) break;
          const h = copy(node.g, side),
            r = h.dispatch(action);
          if (!r.ok) continue;
          const first = node.first || action;
          let penalty = node.penalty + 0.015;
          if (d === 0 && hiddenSecrets)
            penalty +=
              action.type === "attack" && action.target.uid === "hero"
                ? 1.5
                : action.type === "play" &&
                    g.data.byId[
                      g.s[side].hand.find((c) => c.uid === action.uid).cid
                    ].type === "spell"
                  ? 0.7
                  : 0;
          const score = evaluate(h, side) - penalty;
          if (score > best.score) best = { score, first };
          if (h.s.winner === side) return first;
          if (h.s.phase === "battle" && !h.s.choice)
            next.push({ g: h, first, score, penalty });
        }
      next.sort((a, b) => b.score - a.score);
      frontier = next.slice(0, width);
    }
    return best.first;
  }
  return Object.freeze({ choose, legalActions, evaluate });
})();
if (typeof module !== "undefined") module.exports = EmberAI;
