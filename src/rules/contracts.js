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
  function describe(c) {
    const r = c.contract;
    return `${r.divine ? "神祇" : "契约"} · 本局非衍生随从死亡 ${r.deaths} 次，消耗最早获得的 ${r.souls} 枚不同名称灵魂印记及 ${c.cost} 法力。每局一次${r.divine ? "；无法复生，降临当回合不能攻击英雄" : ""}。`;
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
    if (p.fallen < c.contract.deaths)
      return `需要 ${c.contract.deaths} 次非衍生随从死亡（当前 ${p.fallen}）`;
    if (p.souls.length < c.contract.souls)
      return `需要 ${c.contract.souls} 枚不同名称印记（当前 ${p.souls.length}）`;
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
    p.souls.splice(0, c.contract.souls);
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
  return Object.freeze({ check, describe, legal, summon, death });
})();
if (typeof module !== "undefined") module.exports = EmberContracts;
