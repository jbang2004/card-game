/* Effect registry: validation, execution and wording share the same parameters.
 * No DOM, global card database, random source or persistence access. */
const EmberRules = (() => {
  "use strict";
  const selectors = new Set([
    "selected",
    "self",
    "friendlyLowest",
    "friendlyBeasts",
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
    if (to === "self")
      return source && g.getTarget({ side, uid: source.uid })
        ? [{ side, uid: source.uid }]
        : [];
    if (to === "friendlyBeasts")
      return g.s[side].board
        .filter((m) => g.data.byId[m.cid].tribe === "beast")
        .map((m) => ({ side, uid: m.uid }));
    if (to === "friendlyLowest")
      return g.s[side].board
        .filter((m) => m.hp > 0 && !m.tags.includes("shield"))
        .sort(
          (a, b) =>
            a.atk - b.atk || Number(a.uid.slice(1)) - Number(b.uid.slice(1)),
        )
        .slice(0, 1)
        .map((m) => ({ side, uid: m.uid }));
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
    self: "自身",
    friendlyLowest: "攻击力最低且没有圣盾的友方随从",
    friendlyBeasts: "所有友方野兽",
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
        const affected = targets(g, c, e.to);
        c.damageSource = affected.length === 1 ? affected[0] : null;
        for (const t of affected)
          g.damage(t.side, t.uid, e.amount + (e.spell ? c.spellBonus : 0), {
            side: c.side,
            uid: c.source?.uid || "hero",
          });
      },
      text: (e) => `对${labels[e.to]}造成 ${e.amount} 点伤害`,
    },
    drawFiltered: {
      fields: ["count", "cardType", "tribe"],
      required: ["count", "cardType"],
      run(g, e, c) {
        const p = g.s[c.side];
        for (let n = 0; n < e.count; n++) {
          const i = p.deck.findIndex(
            (x) =>
              g.data.byId[x.cid].type === e.cardType &&
              (!e.tribe || g.data.byId[x.cid].tribe === e.tribe),
          );
          if (i < 0) break;
          const [card] = p.deck.splice(i, 1);
          p.deck.unshift(card);
          g.draw(c.side);
        }
      },
      text: (e, db) =>
        `从牌库抽取 ${e.count} 张${e.tribe ? db.$tribes[e.tribe] : "随从"}牌（不足时抽取剩余牌）`,
    },
    destroyWeapon: {
      fields: [],
      required: [],
      run(g, e, c) {
        const side = g.other(c.side);
        if (g.s[side].weapon) {
          g.s[side].weapon = null;
          g.event("weaponWear", { side, uid: "hero", broken: true });
        }
      },
      text: () => "摧毁敌方武器",
    },
    freeze: {
      fields: ["to"],
      required: ["to"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) {
          const m = g.getTarget(t),
            changed = !m.frozen;
          m.frozen = true;
          if (changed) g.event("status", { ...t, kind: "freeze" });
        }
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
      run: (g, e, c) => g.heal(c.side, e.amount, c.damageSource || null),
      text: (e) => `为你的英雄恢复 ${e.amount} 点生命`,
    },
    armor: {
      fields: ["amount"],
      required: ["amount"],
      run(g, e, c) {
        g.s[c.side].armor += e.amount;
        g.event("status", {
          side: c.side,
          uid: "hero",
          kind: "armor",
          amount: e.amount,
        });
      },
      text: (e) => `获得 ${e.amount} 点护甲`,
    },
    mana: {
      fields: ["amount"],
      required: ["amount"],
      run(g, e, c) {
        g.s[c.side].mana = Math.min(10, g.s[c.side].mana + e.amount);
        g.event("status", {
          side: c.side,
          uid: "hero",
          kind: "mana",
          amount: e.amount,
        });
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
        for (const t of targets(g, c, e.to)) {
          g.buff(g.getTarget(t), e.attack, e.health, {
            duration: e.duration,
            source: c.source?.uid || c.card.id,
          });
          g.event("status", {
            ...t,
            kind: "buff",
            attack: e.attack,
            health: e.health,
          });
        }
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
        for (const t of targets(g, c, e.to)) {
          g.silence(g.getTarget(t));
          g.event("status", { ...t, kind: "silence" });
        }
      },
      text: (e) => `沉默${labels[e.to]}，移除其关键词和增益`,
    },
    grant: {
      fields: ["to", "tag"],
      required: ["to", "tag"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) {
          const m = g.getTarget(t);
          if (!m.tags.includes(e.tag)) {
            m.tags.push(e.tag);
            g.event("status", { ...t, kind: "grant", tag: e.tag });
          }
        }
      },
      text: (e, db) => `使${labels[e.to]}获得${db.$kw[e.tag]}`,
    },
    transform: {
      fields: ["to", "card"],
      required: ["to", "card"],
      run(g, e, c) {
        for (const t of targets(g, c, e.to)) {
          g.transform(t, e.card);
          g.event("status", { ...t, kind: "transform", cid: e.card });
        }
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
                .filter(
                  (x) =>
                    x.type === e.cardType &&
                    !x.token &&
                    (x.class === "neutral" || x.class === g.classFor(c.side)),
                )
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
        if (c.secret.counter) return "奥秘：敌人施放法术时，反制该法术";
        if (c.secret.armor)
          return `奥秘：敌人攻击你的英雄时，获得 ${c.secret.armor} 点护甲`;
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
          g.damage(g.other(c.side), m.uid, e.amount, {
            side: c.side,
            uid: "hero",
          });
          m.frozen = true;
          g.event("status", {
            side: g.other(c.side),
            uid: m.uid,
            kind: "freeze",
          });
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
          "self",
          "friendlyLowest",
          "friendlyBeasts",
          "enemyMinions",
          "friendlyMinions",
          "friendlyOthers",
        ].includes(e.to)
      )
        throw Error(owner + ": This effect requires minion targets");
      if (e.card && db[e.card]?.type !== "minion")
        throw Error(owner + ": Invalid summoned/transformed card " + e.card);
      if (
        e.type === "drawFiltered" &&
        (e.cardType !== "minion" ||
          (e.tribe && !Object.hasOwn(db.$tribes, e.tribe)))
      )
        throw Error(owner + ": Invalid draw filter");
      if (e.tag && !db.$kw[e.tag])
        throw Error(owner + ": Unknown keyword " + e.tag);
      if (e.duration !== undefined && (e.duration !== "turn" || e.health !== 0))
        throw Error(owner + ": Only attack-only turn buffs are supported");
      if (e.type === "discover" && (e.count !== 3 || e.cardType !== "spell"))
        throw Error(owner + ": Discovery requires three spells");
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
    if (c.secret && g.s[side].secrets.length >= 5)
      return "奥秘已满（最多 5 个）";
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
    if (c.triggers?.length) result += triggerText(c.triggers, db);
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
  const triggerLabels = {
    spellCast: "你施放法术后",
    friendlyDeath: "其他友方随从死亡后",
    shieldLost: "友方随从失去圣盾后",
    turnEnd: "你的回合结束时",
    afterAttack: "该随从攻击后",
  };
  function validateTriggers(triggers, db, owner) {
    if (triggers === undefined) return;
    if (!Array.isArray(triggers)) throw Error(owner + ": Invalid triggers");
    for (const t of triggers) {
      if (
        Object.keys(t).some(
          (k) => !["event", "effects", "maxPerTurn"].includes(k),
        ) ||
        !triggerLabels[t.event] ||
        !Number.isInteger(t.maxPerTurn) ||
        t.maxPerTurn < 1 ||
        t.maxPerTurn > 5
      )
        throw Error(owner + ": Invalid trigger");
      validateEffects(t.effects, db, owner);
      if (
        t.effects.some(
          (e) =>
            e.to === "selected" || e.type === "discover" || e.type === "secret",
        )
      )
        throw Error(owner + ": Trigger must resolve without a choice");
    }
  }
  function triggerText(ts, db) {
    return (ts || [])
      .map(
        (t) =>
          `${triggerLabels[t.event]}，${t.effects.map((e) => registry[e.type].text(e, db, {})).join("，")}（每回合最多 ${t.maxPerTurn} 次）。`,
      )
      .join("");
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
    validateTriggers,
    triggerText,
    execute,
    legal,
    text,
    profile,
    targets,
    freeze,
  });
})();
if (typeof module !== "undefined") module.exports = EmberRules;
