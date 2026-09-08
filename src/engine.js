/* Pure, serializable rules engine. Rendering never changes the rules. */
const EmberEngine = (() => {
  const D = typeof EmberData !== "undefined" ? EmberData : require("./data.js");
  const R =
    typeof EmberRules !== "undefined"
      ? EmberRules
      : require("./rules/effects.js");
  const AI =
    typeof EmberAI !== "undefined" ? EmberAI : require("./rules/ai.js");
  const Preview =
    typeof EmberPreview !== "undefined"
      ? EmberPreview
      : require("./rules/preview.js");
  const State =
    typeof EmberState !== "undefined"
      ? EmberState
      : require("./rules/state.js");
  const Decks =
    typeof EmberDeckRules !== "undefined"
      ? EmberDeckRules
      : require("./rules/decks.js");
  const Contracts =
    typeof EmberContracts !== "undefined"
      ? EmberContracts
      : require("./rules/contracts.js");
  class Game {
    constructor(opts = {}) {
      this.data = opts.data || D;
      this.onChange = opts.onChange || (() => {});
      this.s = null;
      this.events = [];
      this.eventSeq = 0;
      this.blocks = [];
    }
    rand() {
      let x = this.s.rng | 0;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.s.rng = x >>> 0;
      return this.s.rng / 4294967296;
    }
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    uid() {
      return "u" + ++this.s.seq;
    }
    card(cid) {
      if (!this.data.byId[cid]) throw Error("Unknown card " + cid);
      return { uid: this.uid(), cid };
    }
    other(side) {
      return side === "p" ? "e" : "p";
    }
    log(text) {
      if (this.simulation) return;
      this.s.log.push(text);
      if (this.s.log.length > 70) this.s.log.shift();
    }
    event(type, data = {}) {
      if (this.simulation) return;
      // Public presentation snapshots describe an already resolved observation.
      // They contain no deck identities, RNG or opponent hand identities and
      // are ephemeral event data, never stored in a v1 save.
      const view = {};
      if (this.s && type !== "blockEnd") {
        for (const side of ["p", "e"]) {
          const p = this.s[side];
          if (!p) continue;
          view[side] = structuredClone({
            hp: p.hp,
            maxHp: p.maxHp,
            armor: p.armor,
            mana: p.mana,
            maxMana: p.maxMana,
            powerUsed: p.powerUsed,
            attacks: p.attacks,
            frozen: p.frozen,
            weapon: p.weapon,
            board: p.board,
            hand: side === "p" ? p.hand : p.hand.map((c) => ({ uid: c.uid })),
            deck: Array(p.deck.length).fill(null),
            secrets: Array(p.secrets.length).fill(null),
            souls: p.souls,
            fallen: p.fallen,
            devotion: p.devotion,
            contracts: p.contracts,
            usedContracts: p.usedContracts,
          });
        }
        Object.assign(view, {
          active: this.s.active,
          turn: this.s.turn,
          phase2: this.s.phase2,
        });
      }
      this.events.push({
        id: "ev" + ++this.eventSeq,
        parentId: this.blocks.at(-1) || null,
        type,
        ...data,
        ...(Object.keys(view).length ? { view } : {}),
      });
    }
    withBlock(kind, meta, fn) {
      if (this.simulation) return fn();
      const id = "ev" + ++this.eventSeq;
      this.events.push({
        id,
        parentId: this.blocks.at(-1) || null,
        type: "blockStart",
        kind,
        ...meta,
      });
      this.blocks.push(id);
      try {
        return fn();
      } finally {
        this.blocks.pop();
        this.event("blockEnd", { blockId: id });
      }
    }
    dispatch(action) {
      if (!this.s) return this.reject("尚未开始对局");
      if (
        !action ||
        ![
          "play",
          "attack",
          "power",
          "end",
          "choose",
          "mulligan",
          "contract",
        ].includes(action.type)
      )
        return this.reject("未知操作");
      if (
        ["play", "attack", "power", "end", "contract"].includes(action.type) &&
        !["p", "e"].includes(action.side)
      )
        return this.reject("无效玩家");
      const eventCount = this.events.length,
        seq = this.eventSeq;
      this.deferEmit = true;
      let result;
      try {
        result = this.withBlock("action", { action: action.type }, () => {
          switch (action.type) {
            case "contract":
              return Contracts.summon(this, action.side, action.cid);
            case "play":
              return this.play(action.side, action.uid, action.target);
            case "attack":
              return this.attack(action.side, action.uid, action.target);
            case "power":
              return this.power(action.side, action.target);
            case "end":
              return this.endTurn(action.side);
            case "choose":
              return this.choose(action.cid);
            case "mulligan":
              return this.mulligan(action.ids);
          }
        });
      } finally {
        this.deferEmit = false;
      }
      if (!result.ok) {
        this.events.length = eventCount;
        this.eventSeq = seq;
        return result;
      }
      return this.emit();
    }
    preview(selection, target) {
      return Preview.get(this, selection, target);
    }
    snapshot() {
      return R.freeze(structuredClone(this.s));
    }
    view() {
      const g = this;
      return Object.freeze({
        get s() {
          return g.snapshot();
        },
        cost: (c) => g.cost(c),
        legalCard: (...a) => g.legalCard(...a),
        canAttack: (...a) => g.canAttack(...a),
        targets: (...a) => g.targets(...a),
        attackTargets: (...a) => g.attackTargets(...a),
        getTarget: (t) => R.freeze(structuredClone(g.getTarget(t))),
        spellBonus: (s) => g.spellBonus(s),
        preview: (...a) => g.preview(...a),
        legalContract: (...a) => g.legalContract(...a),
      });
    }
    relicValue(key) {
      return this.data.relics
        .filter((r) => this.s.relics.includes(r.id))
        .reduce((n, r) => n + (r[key] || 0), 0);
    }
    relicEffects(key) {
      for (const r of this.data.relics)
        if (this.s.relics.includes(r.id) && r[key])
          this.resolve(r[key], { side: "p", card: r });
    }
    resolve(effects, ctx) {
      return R.execute(this, effects, ctx);
    }

    emit() {
      if (this.simulation) return { ok: true };
      if (this.deferEmit) return { ok: true };
      const ev = this.events.splice(0);
      this.onChange(this.snapshot(), R.freeze(ev));
      return { ok: true, events: ev };
    }
    reject(error) {
      return { ok: false, error };
    }
    start(
      heroId = this.data.heroes[0].id,
      bossIndex = 0,
      relics = [],
      deck = null,
      seed = Date.now(),
      options = {},
    ) {
      const hero = this.data.heroes.find((h) => h.id === heroId),
        boss = this.data.bosses[bossIndex];
      if (!hero || !Number.isInteger(bossIndex) || !boss)
        return this.reject("未知英雄或关卡");
      if (
        !Array.isArray(relics) ||
        new Set(relics).size !== relics.length ||
        relics.some((id) => !this.data.relics.some((r) => r.id === id))
      )
        return this.reject("未知或重复遗物");
      if (options.first !== undefined && !["p", "e"].includes(options.first))
        return this.reject("无效先后手");
      if (deck !== null && !this.validateDeck(deck, hero.id))
        return this.reject(
          Decks.check(this.data, deck, hero.id).errors.join("；"),
        );
      const opponent = options.opponent
        ? this.data.archetypes.find((a) => a.id === options.opponent)
        : null;
      if (options.opponent && !opponent) return this.reject("未知练习对手");
      const contracts = options.contracts ?? hero.defaultContracts ?? [];
      if (!Contracts.check(this.data, contracts, hero.classId))
        return this.reject("无效契约：最多三张、同职业且至多一位神祇");
      if (opponent) relics = [];
      this.s = {
        version: State.VERSION,
        seq: 0,
        rng: seed >>> 0 || 12345,
        turn: 0,
        active: "p",
        phase: "mulligan",
        heroId: hero.id,
        bossIndex,
        phase2: false,
        relics: [...relics],
        log: [],
        choice: null,
        winner: null,
        stats: { played: 0, damage: 0, turns: 0 },
        customDeck: deck ? [...deck] : null,
      };
      const archetype = this.data.archetypes.find(
        (a) =>
          a.classId === hero.classId &&
          JSON.stringify([...a.deck].sort()) ===
            JSON.stringify([...(deck || hero.deck)].sort()),
      );
      if (archetype) this.s.archetype = archetype.id;
      if (opponent) {
        this.s.mode = "practice";
        this.s.opponent = opponent.id;
        this.s.opponentHero = opponent.hero;
        this.s.first = options.first || (this.rand() < 0.5 ? "p" : "e");
      }
      const unit = (hp) => ({
        hp,
        maxHp: hp,
        armor: 0,
        mana: 0,
        maxMana: 0,
        hand: [],
        deck: [],
        board: [],
        fatigue: 0,
        powerUsed: false,
        attacks: 0,
        frozen: false,
        weapon: null,
        secrets: [],
        souls: [],
        fallen: 0,
        devotion: {
          spells: [],
          shields: 0,
          hunts: 0,
          huntTurn: 0,
          huntCount: 0,
        },
        contracts: [],
        usedContracts: [],
      });
      this.s.p = unit(30 + this.relicValue("maxHealth"));
      this.s.e = unit(opponent ? 30 : boss.hp);
      this.s.p.contracts = [...contracts];
      this.s.e.contracts = opponent
        ? [
            ...(this.data.heroes.find((h) => h.id === opponent.hero)
              .defaultContracts || []),
          ]
        : [];
      const valid = this.validateDeck(deck);
      this.s.p.deck = this.shuffle(
        (valid ? deck : hero.deck).map((x) => this.card(x)),
      );
      this.s.e.deck = this.shuffle(
        (opponent ? opponent.deck : [...boss.deck, ...boss.deck]).map((x) =>
          this.card(x),
        ),
      );
      const second = this.s.first === "e";
      this.draw("p", second ? 4 : 3);
      this.draw("e", second ? 3 : 4);
      if (!second) this.s.e.hand.push(this.card("coin"));
      if (opponent) {
        const returned = this.s.e.hand.filter(
          (c) => this.data.byId[c.cid].cost > 3,
        );
        this.s.e.hand = this.s.e.hand.filter((c) => !returned.includes(c));
        this.draw("e", returned.length);
        this.s.e.deck.push(...returned);
        this.shuffle(this.s.e.deck);
      }
      this.s.p.maxMana = this.relicValue("startingMana");
      this.relicEffects("onStart");
      this.log(
        opponent
          ? "练习对战 · " + opponent.name
          : "你抵达了" + boss.title + "。",
      );
      this.log("选择需要替换的起始卡牌。");
      return this.emit();
    }
    legalContract(side, id) {
      return Contracts.legal(this, side, id);
    }
    validateDeck(deck, heroId = null) {
      return Decks.check(this.data, deck, heroId).ok;
    }
    classFor(side) {
      return side === "p"
        ? Decks.classFor(this.data, this.s.heroId)
        : this.s.mode === "practice"
          ? Decks.classFor(this.data, this.s.opponentHero)
          : this.data.bosses[this.s.bossIndex].discoverClass;
    }
    restore(s) {
      if (!State.valid(s, this.data)) return false;
      this.s = structuredClone(s);
      this.events = [];
      this.emit();
      return true;
    }
    mulligan(ids = []) {
      if (this.s.phase !== "mulligan") return this.reject("当前不在换牌阶段");
      const p = this.s.p,
        returned = p.hand.filter((c) => ids.includes(c.uid));
      p.hand = p.hand.filter((c) => !ids.includes(c.uid));
      this.draw("p", returned.length);
      p.deck.push(...returned);
      this.shuffle(p.deck);
      this.s.phase = "battle";
      if (this.s.first === "e") this.s.p.hand.push(this.card("coin"));
      this.beginTurn(this.s.first || "p");
      return this.emit();
    }
    draw(side, n = 1) {
      const p = this.s[side];
      for (let i = 0; i < n; i++) {
        if (!p.deck.length) {
          p.fatigue++;
          this.damage(side, "hero", p.fatigue);
          this.log(
            (side === "p" ? "你" : "敌人") +
              "受到 " +
              p.fatigue +
              " 点疲劳伤害。",
          );
          continue;
        }
        const c = p.deck.shift();
        if (p.hand.length < 10) {
          p.hand.push(c);
          this.event("draw", {
            side,
            uid: c.uid,
            ...(side === "p" ? { cid: c.cid } : {}),
          });
        } else {
          this.log("手牌已满，" + this.data.byId[c.cid].name + "被焚毁。");
          this.event("burn", { side, ...(side === "p" ? { cid: c.cid } : {}) });
        }
      }
    }
    summon(side, cid, extra = {}, origin = {}) {
      const p = this.s[side];
      if (p.board.length >= 7) return null;
      const c = this.data.byId[cid],
        m = {
          uid: this.uid(),
          cid,
          atk: c.atk || 0,
          hp: c.hp || 1,
          maxHp: c.hp || 1,
          tags: [...(c.tags || [])],
          sick: true,
          attacks: 0,
          frozen: false,
          silenced: false,
          modifiers: [],
          ...extra,
        };
      p.board.push(m);
      this.event("summon", { side, uid: m.uid, cid, ...origin });
      return m;
    }
    getTarget(t) {
      if (!t || !["p", "e"].includes(t.side)) return null;
      if (t.uid === "hero") return this.s[t.side];
      return this.s[t.side].board.find((m) => m.uid === t.uid) || null;
    }
    targets(kind, side) {
      const opp = this.other(side),
        list = [];
      const add = (s, hero) => {
        if (hero) list.push({ side: s, uid: "hero" });
        this.s[s].board.forEach((m) => {
          if (s === side || !m.tags.includes("stealth"))
            list.push({ side: s, uid: m.uid });
        });
      };
      if (kind === "enemy") add(opp, true);
      if (kind === "enemyMinion") add(opp, false);
      if (kind === "friendlyMinion") add(side, false);
      if (kind === "minion") {
        add(side, false);
        add(opp, false);
      }
      return list;
    }
    hasTarget(kind, side, t) {
      return this.targets(kind, side).some(
        (x) => x.side === t?.side && x.uid === t?.uid,
      );
    }
    spellBonus(side) {
      return (
        this.s[side].board.filter((m) => m.tags.includes("spellpower")).length +
        (side === "p" ? this.relicValue("spellDamage") : 0)
      );
    }
    cost(card) {
      return Math.max(0, this.data.byId[card.cid].cost + (card.costMod || 0));
    }
    legalCard(side, uid) {
      if (this.s.phase !== "battle" || this.s.active !== side)
        return "还没有轮到你";
      if (this.s.choice) return "请先完成发现";
      const p = this.s[side],
        c = p.hand.find((x) => x.uid === uid);
      if (!c) return "找不到这张牌";
      const d = this.data.byId[c.cid];
      if (d.contract) return "契约牌只能从契约栏召唤";
      if (this.cost(c) > p.mana) return "法力不足";
      if (d.type === "minion" && p.board.length >= 7)
        return "战场已满（最多 7 个随从）";
      const effectError = R.legal(this, d, side);
      if (effectError) return effectError;
      if (d.target && this.targets(d.target, side).length === 0) {
        if (d.type === "minion") return null;
        return "没有合法目标";
      }
      return null;
    }
    play(side, uid, target = null) {
      const err = this.legalCard(side, uid);
      if (err) return this.reject(err);
      const p = this.s[side],
        card = p.hand.find((x) => x.uid === uid),
        c = this.data.byId[card.cid];
      if (
        c.target &&
        !(c.type === "minion" && this.targets(c.target, side).length === 0) &&
        !this.hasTarget(c.target, side, target)
      )
        return this.reject("请选择有效的目标");
      p.mana -= this.cost(card);
      p.hand = p.hand.filter((x) => x.uid !== uid);
      if (side === "p") this.s.stats.played++;
      this.log((side === "p" ? "你" : "敌人") + "打出「" + c.name + "」。");
      this.event("play", { side, uid, cid: c.id, target });
      if (
        c.type === "spell" &&
        this.revealSecret(this.other(side), "beforeSpell")
      ) {
        this.log("法术被反制。");
        this.cleanup();
        return this.emit();
      }
      if (c.type === "minion") {
        const m = this.summon(side, c.id);
        this.resolve(c.onPlay, { side, source: m, card: c, target });
      } else if (c.type === "weapon") {
        p.weapon = {
          cid: c.id,
          atk: c.atk,
          durability: c.hp,
          tags: [...c.tags],
        };
        this.event("equip", { side });
      } else this.resolve(c.onPlay, { side, card: c, target });
      this.cleanup();
      if (c.type === "spell" && this.s.phase === "battle") {
        Contracts.spell(this, side, c);
        this.trigger("spellCast", side);
        this.cleanup();
      }
      return this.emit();
    }
    choose(cid) {
      const choice = this.s.choice;
      if (!choice || !choice.cards.includes(cid))
        return this.reject("无效的发现选项");
      if (this.s[choice.side].hand.length < 10)
        this.s[choice.side].hand.push(this.card(cid));
      else this.log("手牌已满，发现的卡牌被焚毁。");
      this.s.choice = null;
      this.event("discover");
      return this.emit();
    }
    buff(m, a, h, meta = {}) {
      if (!m) return;
      m.atk += a;
      m.hp += h;
      m.maxHp += h;
      m.modifiers.push({
        attack: a,
        health: h,
        source: meta.source || "rule",
        duration: meta.duration || "permanent",
      });
    }
    silence(m) {
      const base = this.data.byId[m.cid];
      m.atk = base.atk;
      m.maxHp = base.hp;
      m.hp = Math.min(m.hp, m.maxHp);
      m.tags = [];
      m.modifiers = [];
      m.silenced = true;
    }
    transform(t, cid) {
      const base = this.data.byId[cid],
        i = this.s[t.side].board.findIndex((m) => m.uid === t.uid),
        m = this.s[t.side].board[i];
      this.s[t.side].board[i] = {
        ...m,
        cid,
        atk: base.atk,
        hp: base.hp,
        maxHp: base.hp,
        tags: [...base.tags],
        modifiers: [],
        silenced: false,
      };
    }
    damageResult(side, uid, n, poison = false) {
      const t = this.getTarget({ side, uid });
      if (!t) return null;
      const blocked = n > 0 && uid !== "hero" && t.tags.includes("shield"),
        actual = blocked ? 0 : n,
        loss = uid === "hero" ? Math.max(0, actual - t.armor) : actual;
      return {
        hp: Math.max(0, t.hp - loss),
        dead: loss >= t.hp || (poison && actual > 0 && uid !== "hero"),
        blocked,
        amount: actual,
        loss,
      };
    }

    heal(side, n, from = null) {
      const p = this.s[side],
        actual = Math.min(n, p.maxHp - p.hp);
      p.hp += actual;
      if (actual > 0)
        this.event("heal", { side, uid: "hero", amount: actual, from });
    }
    damage(side, uid, n, from = null) {
      const target = this.getTarget({ side, uid });
      if (!target || n <= 0) return 0;
      const result = this.damageResult(side, uid, n);
      if (result.blocked) {
        target.tags = target.tags.filter((x) => x !== "shield");
        Contracts.shield(this, side, from);
        this.event("shield", { side, uid, from });
        this.trigger("shieldLost", side, target);
        return 0;
      }
      if (uid === "hero") target.armor -= n - result.loss;
      target.hp -= result.loss;
      this.event("damage", {
        side,
        uid,
        amount: n,
        loss: result.loss,
        absorbed: n - result.loss,
        from,
      });
      if (side === "e") this.s.stats.damage += n;
      return n;
    }
    canAttack(side, uid) {
      if (this.s.phase !== "battle" || this.s.active !== side || this.s.choice)
        return false;
      const m = this.getTarget({ side, uid });
      if (!m || m.frozen) return false;
      if (uid === "hero")
        return !!m.weapon && m.attacks < 1 && m.weapon.atk > 0;
      if (
        m.hp <= 0 ||
        m.atk <= 0 ||
        m.attacks >= (m.tags.includes("windfury") ? 2 : 1)
      )
        return false;
      return !m.sick || m.tags.includes("charge") || m.tags.includes("rush");
    }
    attackTargets(side, uid) {
      if (!this.canAttack(side, uid)) return [];
      const opp = this.other(side),
        m = this.getTarget({ side, uid });
      const visible = this.s[opp].board.filter(
          (x) => !x.tags.includes("stealth") && x.hp > 0,
        ),
        taunts = visible.filter((x) => x.tags.includes("taunt"));
      if (taunts.length) return taunts.map((x) => ({ side: opp, uid: x.uid }));
      const list = visible.map((x) => ({ side: opp, uid: x.uid }));
      if (
        (uid === "hero" || !m.sick || m.tags.includes("charge")) &&
        m.divineArrival !== this.s.turn
      )
        list.push({ side: opp, uid: "hero" });
      return list;
    }
    attack(side, uid, target) {
      if (
        !this.attackTargets(side, uid).some(
          (t) => t.side === target?.side && t.uid === target?.uid,
        )
      )
        return this.reject("无法攻击该目标：请检查嘲讽、冻结或召唤失调");
      const m = this.getTarget({ side, uid });
      let t = { ...target };
      if (t.uid === "hero") {
        // Resolve in registration order, rechecking the attack target after each secret.
        for (const id of [...this.s[t.side].secrets]) {
          if (t.uid !== "hero") break;
          const secret = this.data.byId[id].secret;
          if (secret.when !== "beforeHeroAttack") continue;
          if (secret.summon && this.s[t.side].board.length >= 7) continue;
          this.consumeSecret(t.side, id);
          if (secret.armor) {
            this.s[t.side].armor += secret.armor;
            this.event("status", {
              side: t.side,
              uid: "hero",
              kind: "armor",
              amount: secret.armor,
            });
          }
          if (secret.summon) {
            const mirror = this.summon(t.side, secret.summon);
            if (mirror) t.uid = mirror.uid;
          }
        }
      }
      const d = this.getTarget(t);
      if (!d) return this.reject("目标已消失");
      const atk = uid === "hero" ? m.weapon.atk : m.atk,
        retaliate = t.uid === "hero" ? 0 : d.atk,
        tags = uid === "hero" ? m.weapon.tags : [...m.tags],
        dtags = t.uid === "hero" ? [] : [...d.tags];
      m.attacks++;
      if (uid !== "hero") m.tags = m.tags.filter((x) => x !== "stealth");
      Contracts.hunt(this, side, uid === "hero" ? null : m, t);
      this.event("attack", { from: { side, uid }, to: t });
      const dealt = this.damage(t.side, t.uid, atk, { side, uid }),
        back = this.damage(side, uid, retaliate, t);
      if (dealt > 0 && tags.includes("poison") && t.uid !== "hero") d.hp = 0;
      if (back > 0 && dtags.includes("poison") && uid !== "hero") m.hp = 0;
      if (tags.includes("lifesteal")) this.heal(side, dealt, t);
      if (dtags.includes("lifesteal")) this.heal(t.side, back, { side, uid });
      if (uid === "hero") {
        m.weapon.durability--;
        if (m.weapon.durability <= 0) {
          m.weapon = null;
          this.log("武器已损坏。");
        }
        this.event("weaponWear", { side, uid: "hero", broken: !m.weapon });
      }
      this.cleanup();
      if (
        this.s.phase === "battle" &&
        uid !== "hero" &&
        this.getTarget({ side, uid })
      ) {
        this.trigger("afterAttack", side, m);
        this.cleanup();
      }
      return this.emit();
    }
    powerDefinition(side) {
      return side === "p"
        ? this.data.heroes.find((h) => h.id === this.s.heroId)
        : this.s.mode === "practice"
          ? this.data.heroes.find((h) => h.id === this.s.opponentHero)
          : this.data.bosses[this.s.bossIndex];
    }
    legalPower(side) {
      if (this.s.phase !== "battle" || this.s.active !== side || this.s.choice)
        return "现在无法使用技能";
      const p = this.s[side],
        c = this.powerDefinition(side);
      if (p.powerUsed) return "本回合已使用英雄技能";
      if (p.mana < c.powerCost) return "法力不足";
      if (c.target && !this.targets(c.target, side).length)
        return "没有合法目标";
      return R.legal(this, c, side, c.powerEffects);
    }
    power(side, target = null) {
      const error = this.legalPower(side);
      if (error) return this.reject(error);
      const c = this.powerDefinition(side);
      if (c.target && !this.hasTarget(c.target, side, target))
        return this.reject("请选择有效的目标");
      this.s[side].mana -= c.powerCost;
      this.s[side].powerUsed = true;
      this.event("power", { side, target });
      this.resolve(c.powerEffects, { side, card: c, target });
      this.log(
        side === "p" ? "你使用了英雄技能。" : "敌人发动「" + c.power + "」。",
      );
      this.cleanup();
      return this.emit();
    }
    cleanup() {
      for (let loop = 0; loop < 30; loop++) {
        const dead = [];
        for (const side of ["p", "e"]) {
          const p = this.s[side];
          for (const m of p.board) if (m.hp <= 0) dead.push({ side, m });
          p.board = p.board.filter((m) => m.hp > 0);
        }
        if (!dead.length) break;
        dead.sort(
          (a, b) => Number(a.m.uid.slice(1)) - Number(b.m.uid.slice(1)),
        );
        for (const { side, m } of dead) {
          Contracts.death(this, side, m);
          this.event("death", {
            side,
            uid: m.uid,
            cid: m.cid,
            // The batch left the board together, before individual deathrattles.
            ...(m === dead[0].m
              ? {
                  departures: dead.map(({ side, m }) => ({
                    side,
                    uid: m.uid,
                    cid: m.cid,
                  })),
                }
              : {}),
          });
          if (!m.silenced) {
            this.withBlock("deathrattle", { sourceId: m.uid }, () =>
              this.resolve(this.data.byId[m.cid].onDeath, {
                side,
                source: m,
                card: this.data.byId[m.cid],
              }),
            );
          }
          this.trigger("friendlyDeath", side, m);
          if (
            m.tags.includes("reborn") &&
            !this.data.byId[m.cid].contract?.divine
          ) {
            const c = this.data.byId[m.cid];
            this.summon(
              side,
              m.cid,
              {
                hp: 1,
                tags: c.tags.filter((x) => x !== "reborn"),
              },
              { rebornFrom: m.uid },
            );
          }
        }
      }
      if (this.s.p.hp <= 0 || this.s.e.hp <= 0) {
        this.s.phase = "over";
        this.s.winner =
          this.s.p.hp <= 0 ? (this.s.e.hp <= 0 ? "draw" : "e") : "p";
        this.s.choice = null;
        this.event("over", { winner: this.s.winner });
        this.log(
          this.s.winner === "p"
            ? "胜利！余火仍在燃烧。"
            : this.s.winner === "draw"
              ? "同归于尽。"
              : "你的火焰暂时熄灭了。",
        );
        return;
      }
      if (
        this.s.mode !== "practice" &&
        !this.s.phase2 &&
        this.s.e.hp <= this.s.e.maxHp / 2 &&
        this.s.phase === "battle"
      ) {
        this.s.phase2 = true;
        this.log(
          "阶段 II · " + this.data.bosses[this.s.bossIndex].name + "觉醒！",
        );
        this.event("phase");
        this.resolve(this.data.bosses[this.s.bossIndex].phaseEffects, {
          side: "e",
          card: this.data.bosses[this.s.bossIndex],
        });
        this.cleanup();
      }
    }
    beginTurn(side) {
      this.s.active = side;
      const p = this.s[side];
      if (side === "p") {
        this.s.turn++;
        this.s.stats.turns++;
        this.relicEffects("onTurn");
      }
      if (this.s.turn > 50) {
        this.s.phase = "over";
        this.s.winner = "draw";
        this.event("over", { winner: "draw" });
        return;
      }
      p.maxMana = Math.min(10, p.maxMana + 1);
      p.mana = p.maxMana;
      p.powerUsed = false;
      p.attacks = 0;
      for (const m of p.board) {
        m.sick = false;
        m.attacks = 0;
      }
      this.draw(side);
      this.log(
        "第 " +
          this.s.turn +
          " 回合 · " +
          (side === "p" ? "你的回合" : "敌方回合"),
      );
      this.event("turn", { side });
      this.cleanup();
    }
    endTurn(side) {
      if (this.s.phase !== "battle" || this.s.active !== side || this.s.choice)
        return this.reject("现在不能结束回合");
      this.trigger("turnEnd", side);
      this.cleanup();
      if (this.s.phase !== "battle") return this.emit();
      const p = this.s[side];
      const thawed = p.frozen ? [{ side, uid: "hero", kind: "thaw" }] : [];
      p.frozen = false;
      for (const m of p.board) {
        if (m.frozen) thawed.push({ side, uid: m.uid, kind: "thaw" });
        m.frozen = false;
        const expired = m.modifiers.filter((x) => x.duration === "turn");
        const attack = expired.reduce((n, x) => n + x.attack, 0);
        m.atk -= attack;
        m.modifiers = m.modifiers.filter((x) => x.duration !== "turn");
        if (attack)
          thawed.push({ side, uid: m.uid, kind: "expire", attack: -attack });
      }
      for (const cue of thawed) this.event("status", cue);
      this.beginTurn(this.other(side));
      return this.emit();
    }
    consumeSecret(side, id) {
      this.s[side].secrets = this.s[side].secrets.filter((x) => x !== id);
      this.event("secret", { side, cid: id });
      this.log("奥秘「" + this.data.byId[id].name + "」触发！");
    }
    revealSecret(side, when) {
      const id = this.s[side].secrets.find(
        (id) => this.data.byId[id].secret.when === when,
      );
      if (!id) return false;
      this.consumeSecret(side, id);
      return true;
    }
    trigger(event, side, target = null) {
      (this.triggerQueue ??= []).push({ event, side, target });
      if (this.triggerRunning) return;
      this.triggerRunning = true;
      try {
        let steps = 0;
        while (this.triggerQueue.length) {
          if (++steps > 100)
            throw Error("Trigger chain exceeded content limit");
          const e = this.triggerQueue.shift();
          const sources = [...this.s[e.side].board].filter(
            (m) => m.hp > 0 && !m.silenced,
          );
          const relics =
            e.side === "p"
              ? this.data.relics.filter((r) => this.s.relics.includes(r.id))
              : [];
          for (const source of [...sources, ...relics]) {
            const card = source.cid ? this.data.byId[source.cid] : source;
            if (
              source.cid &&
              (source.hp <= 0 ||
                source.silenced ||
                !this.s[e.side].board.includes(source))
            )
              continue;
            if (e.event === "friendlyDeath" && source === e.target) continue;
            if (e.event === "afterAttack" && source !== e.target) continue;
            for (const [i, t] of (card.triggers || []).entries()) {
              if (t.event !== e.event) continue;
              const owner = source.cid ? source : this.s;
              const key = (source.uid || card.id) + ":" + i;
              const clock = this.s.turn + ":" + this.s.active;
              const used = owner.triggerUses?.[key];
              if (used?.clock === clock && used.count >= t.maxPerTurn) continue;
              (owner.triggerUses ??= {})[key] = {
                clock,
                count: used?.clock === clock ? used.count + 1 : 1,
              };
              this.withBlock(
                "trigger",
                { sourceId: source.uid || card.id },
                () => {
                  this.log(card.name + "的能力触发。");
                  this.event("status", {
                    side: e.side,
                    uid: source.uid || "hero",
                    kind: "trigger",
                  });
                  this.resolve(t.effects, {
                    side: e.side,
                    source: source.cid ? source : null,
                    card,
                  });
                },
              );
            }
          }
        }
      } finally {
        this.triggerRunning = false;
        this.triggerQueue = [];
      }
    }
    trainingAction(side = "p", options = {}) {
      return AI.choose(this, side, options);
    }
    demo() {
      this.start("mage", 0, [], null, 372149);
      this.mulligan();
      const s = this.s;
      s.turn = 6;
      s.stats.turns = 6;
      s.p.maxMana = s.p.mana = 6;
      s.e.maxMana = 5;
      s.e.mana = 0;
      s.p.hp = 26;
      s.e.hp = 27;
      s.e.armor = 3;
      s.p.board = [];
      s.e.board = [];
      s.p.hand = [
        "frostbolt",
        "phoenix",
        "fireball",
        "wisdom",
        "sunblade",
        "bolt",
      ].map((id) => this.card(id));
      for (const id of ["guard", "oracle", "wisp"])
        this.summon("p", id, { sick: false });
      for (const id of ["squire", "golem", "leech"])
        this.summon("e", id, { sick: false });
      s.log = [
        "战斗试玩 · 从第 6 回合开始，不覆盖战役存档。",
        "敌方铁卫具有嘲讽，必须先解决它。",
        "星界精灵使你的法术伤害提高 1 点。",
        "你的随从已准备好攻击。",
      ];
      this.emit();
    }
    rewardOffers() {
      if (!this.s.rewardOffers) {
        const ids = this.data.relics
          .filter((r) => !this.s.relics.includes(r.id))
          .map((r) => r.id);
        this.s.rewardOffers = this.shuffle(ids).slice(0, 3);
      }
      return [...this.s.rewardOffers];
    }
    aiAction() {
      return AI.choose(this);
    }
    aiStep() {
      const a = this.aiAction();
      return a.type === "none"
        ? this.reject("AI 无需行动")
        : this.dispatch({ ...a, side: "e" });
    }
  }
  return { Game };
})();
if (typeof module !== "undefined") module.exports = EmberEngine;
