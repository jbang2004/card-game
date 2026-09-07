/* Effect registry: validation, execution and wording share the same parameters.
 * No DOM, global card database, random source or persistence access. */
const EmberRules = (() => {
  "use strict";
  const selectors = new Set([
    "selected",
    "enemyHero",
    "enemyMinions",
    "friendlyMinions",
    "friendlyOthers",
    "allOthers",
    "enemies",
  ]);
  function targets(g, ctx, to = "selected") {
    const { side, source, target } = ctx,
      opp = g.other(side);
    const board = (s) =>
      g.s[s].board
        .filter((m) => m !== source)
        .map((m) => ({ side: s, uid: m.uid }));
    if (to === "selected") return target && g.getTarget(target) ? [target] : [];
    if (to === "enemyHero") return [{ side: opp, uid: "hero" }];
    if (to === "enemyMinions") return board(opp);
    if (to === "friendlyMinions")
      return g.s[side].board.map((m) => ({ side, uid: m.uid }));
    if (to === "friendlyOthers") return board(side);
    if (to === "enemies") return [{ side: opp, uid: "hero" }, ...board(opp)];
    if (to === "allOthers")
      return ["p", "e"].flatMap((s) => [{ side: s, uid: "hero" }, ...board(s)]);
    throw Error("Unknown selector: " + to);
  }
  const labels = {
    selected: "目标",
    enemyHero: "敌方英雄",
    enemyMinions: "所有敌方随从",
    friendlyMinions: "所有友方随从",
    friendlyOthers: "其他友方随从",
    allOthers: "所有其他角色",
    enemies: "所有敌人",
  };
  const registry = {
    damage: {
      fields: ["amount", "to", "spell"],
      required: ["amount", "to"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to))
          g.damage(t.side, t.uid, e.amount + (e.spell ? c.spellBonus : 0));
      },
      text: (e) => `对${labels[e.to]}造成 ${e.amount} 点伤害`,
    },
    freeze: {
      fields: ["to"],
      required: ["to"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) g.getTarget(t).frozen = true;
      },
      text: (e) => `冻结${labels[e.to]}`,
    },
    draw: {
      fields: ["count"],
      required: ["count"],
      run: (g, e, c) => g.draw(c.side, e.count),
      text: (e) => `抽 ${e.count} 张牌`,
    },
    heal: {
      fields: ["amount"],
      required: ["amount"],
      run: (g, e, c) => g.heal(c.side, e.amount),
      text: (e) => `为你的英雄恢复 ${e.amount} 点生命`,
    },
    armor: {
      fields: ["amount"],
      required: ["amount"],
      run(g, e, c) {
        g.s[c.side].armor += e.amount;
      },
      text: (e) => `获得 ${e.amount} 点护甲`,
    },
    mana: {
      fields: ["amount"],
      required: ["amount"],
      run(g, e, c) {
        g.s[c.side].mana = Math.min(10, g.s[c.side].mana + e.amount);
      },
      text: (e) => `本回合获得 ${e.amount} 点法力`,
    },
    summon: {
      fields: ["card", "count", "requireSpace"],
      required: ["card", "count"],
      run(g, e, c) {
        for (let i = 0; i < e.count; i++) g.summon(c.side, e.card);
      },
      text(e, db) {
        const m = db[e.card];
        return `召唤 ${e.count} 个 ${m.atk}/${m.hp}${m.tags.length ? "、具有" + m.tags.map((t) => db.$kw[t]).join("、") : ""}的${m.name}`;
      },
    },
    buff: {
      fields: ["attack", "health", "to", "duration"],
      required: ["attack", "health", "to"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to))
          g.buff(g.getTarget(t), e.attack, e.health, {
            duration: e.duration,
            source: c.source?.uid || c.card.id,
          });
      },
      text: (e) =>
        `使${labels[e.to]}${e.duration === "turn" ? "本回合" : ""}获得 +${e.attack}${e.health ? "/+" + e.health : " 攻击力"}`,
    },
    destroy: {
      fields: ["to"],
      required: ["to"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) {
          g.getTarget(t).hp = 0;
          g.event("destroy", t);
        }
      },
      text: (e) => `消灭${labels[e.to]}`,
    },
    silence: {
      fields: ["to"],
      required: ["to"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) g.silence(g.getTarget(t));
      },
      text: (e) => `沉默${labels[e.to]}，移除其关键词和增益`,
    },
    grant: {
      fields: ["to", "tag"],
      required: ["to", "tag"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) {
          const m = g.getTarget(t);
          if (!m.tags.includes(e.tag)) m.tags.push(e.tag);
        }
      },
      text: (e, db) => `使${labels[e.to]}获得${db.$kw[e.tag]}`,
    },
    transform: {
      fields: ["to", "card"],
      required: ["to", "card"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) g.transform(t, e.card);
      },
      text: (e, db) =>
        `将${labels[e.to]}变为 ${db[e.card].atk}/${db[e.card].hp} 的${db[e.card].name}`,
    },
    discover: {
      fields: ["count", "cardType"],
      required: ["count", "cardType"],
      run(g, e, c) {
        g.s.choice = {
          side: c.side,
          cards: g
            .shuffle(
              g.data.cards
                .filter((x) => x.type === e.cardType && !x.token)
                .map((x) => x.id),
            )
            .slice(0, e.count),
        };
      },
      text: () => `发现一张法术牌，将其置入手牌`,
    },
    secret: {
      fields: [],
      required: [],
      run(g, e, c) {
        g.s[c.side].secrets.push(c.card.id);
      },
      text: (e, db, c) => {
        const m = db[c.secret.summon];
        return `奥秘：敌人攻击你的英雄时，召唤一个 ${m.atk}/${m.hp} ${m.tags.map((t) => db.$kw[t]).join("、")}镜卫代为承受攻击`;
      },
    },
    randomDamageFreeze: {
      fields: ["amount"],
      required: ["amount"],
      run(g, e, c) {
        const a = g.s[g.other(c.side)].board;
        if (a.length) {
          const m = a[Math.floor(g.rand() * a.length)];
          g.damage(g.other(c.side), m.uid, e.amount);
          m.frozen = true;
        }
      },
      text: (e) => `对随机敌方随从造成 ${e.amount} 点伤害并冻结`,
    },
  };
  function validateEffects(effects, db, owner) {
    if (!Array.isArray(effects))
      throw Error(owner + ": effects must be an array");
    for (const e of effects) {
      const spec = registry[e?.type];
      if (!spec) throw Error(owner + ": Unknown effect " + e?.type);
      for (const k of Object.keys(e))
        if (k !== "type" && !spec.fields.includes(k))
          throw Error(owner + ": Unknown effect field " + k);
      for (const k of spec.required)
        if (e[k] === undefined) throw Error(owner + ": Missing " + k);
      for (const k of ["amount", "count", "attack", "health"])
        if (
          e[k] !== undefined &&
          (!Number.isInteger(e[k]) || e[k] < 0 || (k === "count" && e[k] < 1))
        )
          throw Error(owner + ": Invalid " + k);
      if (e.to && !selectors.has(e.to))
        throw Error(owner + ": Unknown selector " + e.to);
      if (
        ["buff", "grant", "silence", "transform", "destroy"].includes(e.type) &&
        ![
          "selected",
          "enemyMinions",
          "friendlyMinions",
          "friendlyOthers",
        ].includes(e.to)
      )
        throw Error(owner + ": This effect requires minion targets");
      if (e.card && db[e.card]?.type !== "minion")
        throw Error(owner + ": Invalid summoned/transformed card " + e.card);
      if (e.tag && !db.$kw[e.tag])
        throw Error(owner + ": Unknown keyword " + e.tag);
      if (e.duration !== undefined && (e.duration !== "turn" || e.health !== 0))
        throw Error(owner + ": Only attack-only turn buffs are supported");
      if (e.type === "discover" && (e.count !== 3 || e.cardType !== "spell"))
        throw Error(owner + ": v1 discovery requires three spells");
      for (const k of ["spell", "requireSpace"])
        if (e[k] !== undefined && typeof e[k] !== "boolean")
          throw Error(owner + ": Invalid " + k);
    }
  }
  function execute(g, effects, ctx) {
    const c = { ...ctx, spellBonus: g.spellBonus(ctx.side) };
    for (const e of effects || [])
      g.withBlock(
        "effect",
        { effect: e.type, sourceId: ctx.source?.uid || ctx.card.id },
        () => registry[e.type].run(g, e, c),
      );
  }
  function legal(g, c, side, effects = c.onPlay) {
    if (
      (effects || []).some((e) => e.requireSpace) &&
      g.s[side].board.length >= 7
    )
      return "战场已满";
    if (c.secret && g.s[side].secrets.includes(c.id)) return "相同的奥秘已存在";
    return null;
  }
  function text(c, db) {
    const words = c.tags.map((t) => db.$kw[t]);
    if (c.type === "weapon")
      return `装备一把 ${c.atk}/${c.hp}${words.length ? "、具有" + words.join("、") : ""}的武器。`;
    const describe = (ops) =>
      ops.map((e) => registry[e.type].text(e, db, c)).join("，");
    let result = words.length ? words.join("。") + "。" : "";
    if (c.onPlay.length)
      result +=
        (c.type === "minion" ? "战吼：" : "") + describe(c.onPlay) + "。";
    if (c.onDeath.length) result += "亡语：" + describe(c.onDeath) + "。";
    return result.replaceAll(
      "目标",
      {
        enemy: "一个敌人",
        enemyMinion: "一个敌方随从",
        friendlyMinion: "一个友方随从",
        minion: "一个随从",
      }[c.target] || "目标",
    );
  }
  function profile(c) {
    const ops = c?.onPlay || [];
    return {
      area: ops.some(
        (e) =>
          [
            "enemyMinions",
            "friendlyMinions",
            "friendlyOthers",
            "allOthers",
            "enemies",
          ].includes(e.to) || e.type === "summon",
      ),
      self:
        ops.length > 0 &&
        ops.every((e) =>
          ["draw", "discover", "secret", "mana"].includes(e.type),
        ),
      gentle:
        ops.length > 0 &&
        ops.every((e) =>
          ["heal", "draw", "buff", "grant", "silence"].includes(e.type),
        ),
      enhance: ops.some((e) => ["buff", "grant", "silence"].includes(e.type)),
    };
  }
  function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  return Object.freeze({
    validateEffects,
    execute,
    legal,
    text,
    profile,
    targets,
    freeze,
  });
})();
if (typeof module !== "undefined") module.exports = EmberRules;
