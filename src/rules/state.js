/* v1 save boundary. Optional modifier metadata extends v1 without replacing keys.
 * Old saves retain their authoritative numeric stats and tempAtk unchanged. */
const EmberState = (() => {
  function valid(s, data) {
    try {
      if (
        !s ||
        s.version !== 1 ||
        !data.heroes.some((h) => h.id === s.heroId) ||
        !data.bosses[s.bossIndex]
      )
        return false;
      if (
        !["p", "e"].includes(s.active) ||
        !["mulligan", "battle", "over"].includes(s.phase) ||
        !Number.isInteger(s.turn) ||
        s.turn < 0 ||
        s.turn > 51
      )
        return false;
      if (
        !Number.isInteger(s.seq) ||
        !Number.isInteger(s.rng) ||
        !Array.isArray(s.log) ||
        !s.log.every((x) => typeof x === "string")
      )
        return false;
      if (
        !Array.isArray(s.relics) ||
        !s.relics.every((id) => data.relics.some((r) => r.id === id)) ||
        new Set(s.relics).size !== s.relics.length
      )
        return false;
      if (
        !s.stats ||
        !["played", "damage", "turns"].every(
          (k) => Number.isFinite(s.stats[k]) && s.stats[k] >= 0,
        )
      )
        return false;
      if (s.ruleset !== undefined && ![1, 2].includes(s.ruleset)) return false;
      if (s.mode !== undefined && s.mode !== "practice") return false;
      if (
        s.mode === "practice" &&
        (!data.archetypes.some(
          (a) => a.id === s.opponent && a.hero === s.opponentHero,
        ) ||
          !["p", "e"].includes(s.first))
      )
        return false;
      const validUses = (u) =>
        u === undefined ||
        (u &&
          typeof u === "object" &&
          !Array.isArray(u) &&
          Object.values(u).every(
            (v) =>
              v &&
              typeof v.clock === "string" &&
              Number.isInteger(v.count) &&
              v.count >= 0 &&
              v.count <= 5,
          ));
      if (!validUses(s.triggerUses)) return false;
      const seen = new Set();
      for (const side of ["p", "e"]) {
        const p = s[side];
        if (
          !p ||
          !Array.isArray(p.board) ||
          !Array.isArray(p.hand) ||
          !Array.isArray(p.deck) ||
          p.board.length > 7 ||
          p.hand.length > 10 ||
          p.deck.length > 100
        )
          return false;
        if (
          ![
            "hp",
            "maxHp",
            "mana",
            "maxMana",
            "armor",
            "attacks",
            "fatigue",
          ].every((k) => Number.isFinite(p[k]))
        )
          return false;
        if (
          p.mana < 0 ||
          p.mana > 10 ||
          p.maxMana < 0 ||
          p.maxMana > 10 ||
          p.armor < 0 ||
          p.hp > p.maxHp ||
          p.maxHp <= 0
        )
          return false;
        if (
          !Array.isArray(p.secrets) ||
          !p.secrets.every((x) => data.byId[x]?.secret)
        )
          return false;
        for (const c of [...p.board, ...p.hand, ...p.deck]) {
          if (
            !data.byId[c.cid] ||
            !/^u[0-9]+$/.test(c.uid) ||
            seen.has(c.uid) ||
            Number(c.uid.slice(1)) > s.seq
          )
            return false;
          seen.add(c.uid);
        }
        for (const m of p.board)
          if (
            !validUses(m.triggerUses) ||
            ![m.hp, m.maxHp, m.atk, m.attacks, m.tempAtk].every(
              Number.isFinite,
            ) ||
            m.hp <= 0 ||
            m.hp > m.maxHp ||
            m.atk < 0 ||
            !Array.isArray(m.tags) ||
            !m.tags.every((x) => data.kw[x])
          )
            return false;
        if (
          p.weapon &&
          (!data.byId[p.weapon.cid] ||
            data.byId[p.weapon.cid].type !== "weapon" ||
            !Number.isFinite(p.weapon.atk) ||
            !Number.isFinite(p.weapon.durability) ||
            p.weapon.durability < 1 ||
            !Array.isArray(p.weapon.tags))
        )
          return false;
      }
      if (
        s.choice &&
        (!["p", "e"].includes(s.choice.side) ||
          !Array.isArray(s.choice.cards) ||
          s.choice.cards.length !== 3 ||
          !s.choice.cards.every((id) => data.byId[id]?.type === "spell"))
      )
        return false;
      for (const side of ["p", "e"])
        for (const m of s[side].board) {
          if (
            m.modifiers !== undefined &&
            (!Array.isArray(m.modifiers) ||
              m.modifiers.some(
                (x) =>
                  !x ||
                  !Number.isFinite(x.attack) ||
                  !Number.isFinite(x.health) ||
                  typeof x.source !== "string" ||
                  !["permanent", "turn"].includes(x.duration),
              ))
          )
            return false;
        }
      if (
        s.rewardOffers !== undefined &&
        (!Array.isArray(s.rewardOffers) ||
          s.rewardOffers.some((id) => !data.relics.some((r) => r.id === id)))
      )
        return false;
      return true;
    } catch {
      return false;
    }
  }
  return Object.freeze({ valid });
})();
if (typeof module !== "undefined") module.exports = EmberState;
