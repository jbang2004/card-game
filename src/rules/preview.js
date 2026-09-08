/* Known immediate outcomes only. Never simulates hidden cards or consumes RNG. */
const EmberPreview = (() => {
  function get(g, selection, target) {
    if (!selection || !g.s) return null;
    const { side, uid } = target,
      t = g.getTarget(target);
    if (!t) return null;
    if (
      (g.s.e.secrets.length && selection.type !== "attack") ||
      [...g.s.p.board, ...g.s.e.board].some(
        (m) => !m.silenced && g.data.byId[m.cid].triggers?.length,
      )
    )
      return { kind: "uncertain", text: "触发能力或奥秘可能改变最终结果" };
    if (selection.type === "attack") {
      if (
        !g
          .attackTargets("p", selection.uid)
          .some((x) => x.side === side && x.uid === uid)
      )
        return null;
      if (uid === "hero" && g.s[side].secrets.length)
        return { kind: "uncertain", text: "奥秘可能改变攻击结果" };
      const source = g.getTarget({ side: "p", uid: selection.uid });
      const weapon = selection.uid === "hero" ? g.s.p.weapon : null,
        atk = weapon?.atk ?? source.atk;
      const outcome = {
        kind: "attack",
        amount: atk,
        target: g.damageResult(
          side,
          uid,
          atk,
          (weapon?.tags || source.tags).includes("poison"),
        ),
        self: g.damageResult(
          "p",
          selection.uid,
          uid === "hero" ? 0 : t.atk,
          t.tags?.includes("poison"),
        ),
      };
      if (weapon?.tags.includes("lifesteal")) {
        outcome.self.hp = Math.max(
          0,
          Math.min(
            source.maxHp,
            source.hp - outcome.self.loss + outcome.target.amount,
          ),
        );
        outcome.self.dead = outcome.self.hp <= 0;
      }
      return outcome;
    }
    const c =
      selection.type === "power"
        ? g.powerDefinition("p")
        : g.data.byId[selection.cid];
    if (!c || !g.hasTarget(c.target, "p", target)) return null;
    const ops = selection.type === "power" ? c.powerEffects : c.onPlay;
    // More complicated multi-hit/transform chains need an explicit preview implementation.
    const damage = ops.filter(
      (e) => e.type === "damage" && e.to === "selected",
    );
    if (
      damage.length === 1 &&
      ops.every((e) => ["damage", "freeze", "heal"].includes(e.type))
    ) {
      const e = damage[0],
        n = e.amount + (e.spell ? g.spellBonus("p") : 0);
      return {
        kind: "damage",
        amount: n,
        target: g.damageResult(side, uid, n),
        frozen: ops.some((e) => e.type === "freeze"),
      };
    }
    if (ops.length !== 1) return null;
    const e = ops[0];
    if (e.to !== "selected") return null;
    if (e.type === "destroy")
      return { kind: "message", text: "消灭目标", detail: "无视当前生命值" };
    if (e.type === "transform") {
      const m = g.data.byId[e.card];
      return {
        kind: "message",
        text: "变形为" + m.name,
        detail: `${m.atk} 攻击 / ${m.hp} 生命 · 移除原有能力`,
      };
    }
    if (e.type === "buff")
      return {
        kind: "message",
        text: `${e.duration === "turn" ? "本回合 " : ""}+${e.attack}${e.health ? "/+" + e.health : " 攻击"}`,
        detail: `${t.atk + e.attack} 攻击 / ${t.hp + e.health} 生命`,
      };
    if (e.type === "grant")
      return {
        kind: "message",
        text: "获得" + g.data.kw[e.tag],
        detail: "赋予目标关键词",
      };
    if (e.type === "silence")
      return {
        kind: "message",
        text: "施加沉默",
        detail: "移除关键词、亡语和增益",
      };
    return null;
  }
  return Object.freeze({ get });
})();
if (typeof module !== "undefined") module.exports = EmberPreview;
