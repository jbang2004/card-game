/* Public, finite contract resources. No graveyard resurrection or hidden data. */
const EmberContracts = (() => {
  function check(data, ids, classId) {
    return (
      Array.isArray(ids) &&
      ids.length <= 3 &&
      new Set(ids).size === ids.length &&
      ids.every(
        (id) => data.byId[id]?.contract && data.byId[id].class === classId,
      ) &&
      ids.filter((id) => data.byId[id].contract.divine).length <= 1
    );
  }
  const rituals = Object.freeze({
    spells: { label: "星火" },
    shields: { label: "誓光" },
    hunts: { label: "狩猎" },
  });
  function progress(p, c) {
    const r = c.contract;
    if (r.ritual) {
      const { kind, amount } = r.ritual;
      return [
        {
          label: rituals[kind].label,
          current:
            kind === "spells" ? p.devotion.spells.length : p.devotion[kind],
          required: amount,
        },
      ];
    }
    return [
      { label: "印记", current: p.souls.length, required: r.souls },
      { label: "阵亡", current: p.fallen, required: r.deaths },
    ];
  }
  function describe(c) {
    const r = c.contract;
    const need = r.ritual
      ? `${rituals[r.ritual.kind].label}${r.ritual.amount}`
      : `亡${r.deaths}魂${r.souls}`;
    return `${r.divine ? "神" : "契"}·${need}·局1次${r.divine ? "；不复生·禁攻1回合" : ""}。`;
  }
  function validDevotion(d, data, turn) {
    if (
      !d ||
      typeof d !== "object" ||
      Array.isArray(d) ||
      Object.keys(d).some(
        (k) =>
          !["spells", "shields", "hunts", "huntTurn", "huntCount"].includes(k),
      )
    )
      return false;
    return (
      Array.isArray(d.spells) &&
      new Set(d.spells).size === d.spells.length &&
      d.spells.every(
        (id) => data.byId[id]?.type === "spell" && !data.byId[id].token,
      ) &&
      ["shields", "hunts", "huntTurn", "huntCount"].every(
        (k) => Number.isInteger(d[k]) && d[k] >= 0,
      ) &&
      d.shields <= 1000 &&
      d.hunts <= turn * 2 &&
      d.huntTurn <= turn &&
      d.huntCount <= 2 &&
      d.huntCount <= d.hunts
    );
  }
  function spell(g, side, c) {
    const d = g.s[side].devotion;
    if (!c.token && !d.spells.includes(c.id)) d.spells.push(c.id);
  }
  function shield(g, side, from) {
    if (from?.side === g.other(side)) g.s[side].devotion.shields++;
  }
  function hunt(g, side, m, target) {
    if (
      !m ||
      g.data.byId[m.cid].tribe !== "beast" ||
      target.uid === "hero" ||
      target.side !== g.other(side)
    )
      return;
    const d = g.s[side].devotion;
    if (d.huntTurn !== g.s.turn) {
      d.huntTurn = g.s.turn;
      d.huntCount = 0;
    }
    if (d.huntCount < 2) {
      d.hunts++;
      d.huntCount++;
    }
  }
  function legal(g, side, id) {
    if (
      !["p", "e"].includes(side) ||
      !g.s ||
      g.s.phase !== "battle" ||
      g.s.active !== side ||
      g.s.choice
    )
      return "现在无法召唤契约";
    const p = g.s[side],
      c = g.data.byId[id];
    if (!p.contracts.includes(id) || !c?.contract) return "未装备此契约";
    if (p.usedContracts.includes(id)) return "本局已使用此契约";
    if (
      c.contract.divine &&
      p.usedContracts.some((x) => g.data.byId[x].contract.divine)
    )
      return "本局神祇已经降临";
    for (const gate of progress(p, c))
      if (gate.current < gate.required)
        return `需要 ${gate.required} ${gate.label}（当前 ${gate.current}）`;
    if (p.mana < c.cost) return "法力不足";
    if (p.board.length >= 7) return "战场已满";
    return null;
  }
  function summon(g, side, id) {
    const error = legal(g, side, id);
    if (error) return g.reject(error);
    const p = g.s[side],
      c = g.data.byId[id];
    p.mana -= c.cost;
    if (!c.contract.ritual) p.souls.splice(0, c.contract.souls);
    p.usedContracts.push(id);
    g.log(`${side === "p" ? "你" : "敌人"}唤醒「${c.name}」。`);
    g.event("contract", {
      side,
      uid: "hero",
      cid: id,
      divine: c.contract.divine,
    });
    const m = g.summon(
      side,
      id,
      c.contract.divine ? { divineArrival: g.s.turn } : {},
    );
    g.resolve(c.onPlay, { side, source: m, card: c });
    g.cleanup();
    return g.emit();
  }
  function death(g, side, m) {
    const c = g.data.byId[m.cid],
      p = g.s[side];
    if (c.token) return;
    p.fallen++;
    if (!p.souls.includes(c.id)) p.souls.push(c.id);
  }
  return Object.freeze({
    check,
    describe,
    legal,
    summon,
    death,
    progress,
    validDevotion,
    spell,
    shield,
    hunt,
  });
})();
if (typeof module !== "undefined") module.exports = EmberContracts;
