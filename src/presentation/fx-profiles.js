/* Presentation-only signatures. Explicit IDs keep new cards from silently
 * inheriting the wrong attack or spell language. No rules or randomness here. */
const EmberFXProfiles = (() => {
  const records = {};
  /* Attack families. Timing lives in EmberTiming; the only per-family fact the
   * director needs is whether the attacker lunges or shoots. */
  const attackFamilies = Object.freeze({
    blade: false,
    claw: false,
    slam: false,
    arrow: true,
    spear: true,
    bolt: true,
    breath: true,
  });
  const cardMotion = Object.freeze({
    maxTracks: 3,
    draw: Object.freeze({
      liftFraction: 0.15,
      flipStartFraction: 0.35,
      flipEndFraction: 0.7,
      handoffFraction: 5 / 6,
      blendFraction: 1 / 6,
      endFraction: 1,
    }),
    play: Object.freeze({
      liftMaxMs: 60,
      approachMaxMs: 60,
      blendMaxMs: 50,
      settleMaxMs: 200,
    }),
    easing: "cubic-bezier(.2,.7,.3,1)",
  });

  function register(ids, attack, cast = "summon", windup = 300) {
    for (const id of ids.split(" "))
      records[id] = {
        id,
        attack,
        cast,
        windup,
      };
  }
  register(
    "squire guard assassin leech paladin reaper skeleton recruit frostking solaris",
    "blade",
  );
  register("wolf spider sentinel rider pup spiritwolf sheep", "claw");
  register("berserker golem treant titan colossus stone thorn", "slam");
  register("archer", "arrow");
  register("huntress", "spear");
  register("spark oracle wisp cleric necromancer nyx", "bolt");
  register("phoenix dragon ashdragon", "breath");
  register("soulguide selmyra", "bolt");
  register("moonfox eclipsewolf", "claw");
  register("duskstag moonguard", "slam");
  register("jingchen", "bolt");
  register("aurion", "slam");
  register("fenlos", "claw");
  const spells = {
    starweave: ["starwell", 480],
    dawnvow: ["aegis", 440],
    huntinghorn: ["wildgate", 480],
    graveoffering: ["siphon", 480],
    mooncall: ["wildgate", 480],
    soultether: ["benediction", 420],
    moonlance: ["ice-lance", 480],
    stillness: ["dispel", 440],
    bolt: ["ember", 420],
    frostbolt: ["ice-lance", 440],
    fireball: ["meteor", 640],
    nova: ["blizzard", 580],
    storm: ["firestorm", 800],
    wisdom: ["starwell", 420],
    blessing: ["benediction", 420],
    renew: ["bloom", 420],
    execute: ["void-collapse", 660],
    silence: ["dispel", 380],
    rally: ["sunrise", 600],
    wolves: ["wildgate", 480],
    shield: ["aegis", 400],
    lifedrain: ["siphon", 460],
    dagger: ["forge", 360],
    sunblade: ["forge", 480],
    polymorph: ["metamorphosis", 500],
    discovery: ["starwell", 480],
    ambush: ["mirror", 400],
    battlecry: ["warcry", 360],
    coin: ["aether", 320],
    counterspell: ["mirror", 400],
    icebarrier: ["aegis", 400],
    muster: ["sunrise", 480],
    absolution: ["benediction", 480],
    tracking: ["wildgate", 420],
    sabotage: ["shatter", 420],
  };
  for (const [id, [cast, windup]] of Object.entries(spells)) {
    records[id] = {
      id,
      attack: "blade",
      cast,
      windup,
    };
  }
  /* ------------------------------------------------------------------ fx2
   * 特效后端（EmberFx2）的卡牌映射。没有列在这里的卡只有 DOM 动作与数字，
   * 这张表是"哪张卡放什么特效"的唯一清单 —— effects.js 里没有按卡 id 的 if。字段：
   *   fx        技能名（fireball / lightning / slash / arcane / bladeCross）
   *   cutin     true = 弹切入立绘。**只有"人物出手"才有**：随从平砍用攻击方
   *             随从自己的插画，英雄平砍用英雄立绘。纯法术卡（play 事件）一律
   *             没有切入 —— 法术是从施法方英雄位置直接放出去的。
   *   perTarget 对每个敌方随从各放一发（烈焰风暴）
   *   stagger   perTarget 时相邻两发的间隔区间（毫秒）
   *   scale     几何缩放（随从平砍的轻量剑风）
   *   tint      主色覆盖；tintGrad 渐变表行号（0 火 / 1 闪电 / 2 奥术）
   *   selfCast  无目标时以施法方英雄前方为中心
   */
  const GOLD = Object.freeze([1.0, 0.78, 0.36]);
  const SILVER = Object.freeze([0.86, 0.93, 1.0]);
  // 法术卡一律没有切入立绘（见上面 cutin 的说明）。
  const fx2Cards = Object.freeze({
    fireball: { fx: "fireball" },
    storm: { fx: "fireball", perTarget: true, stagger: [60, 90], scale: 0.8 },
    // 星火箭：结构不变，配色换成白芯 + 暖金橙辉光，贴 ember 调色板
    bolt: { fx: "lightning", tint: [1.0, 0.72, 0.3], tintGrad: 0 },
    sabotage: { fx: "slash", tint: SILVER, swordStyle: "shatter" },
    // 奥秘两张：镜像伏击从暗处扑出（虚空触须），破法之镜是一面奥术镜。
    ambush: { fx: "void", tint: [0.72, 0.5, 1.0], tintGrad: 2 },
    counterspell: { fx: "arcane", tint: [0.78, 0.62, 1.0], tintGrad: 2 },
    starweave: { fx: "arcane" },
    polymorph: { fx: "arcane" },
    discovery: { fx: "arcane", selfCast: true },
    wisdom: { fx: "arcane", selfCast: true },
    execute: { fx: "bladeCross" },
    // 冰系：frostbolt / moonlance 走冰枪，nova（新星）走群体霜原
    frostbolt: { fx: "frost" },
    moonlance: { fx: "frost", tint: [0.78, 0.67, 1.0], tintGrad: 8 },
    nova: { fx: "frost-field", field: true },
    // 圣光：光柱 + 地面光环 + 上升金粒。field = 群体（每个目标各一道光柱），
    // shield = 额外闪一次六边护盾。
    rally: { fx: "holy", field: true },
    muster: { fx: "holy", field: true },
    blessing: { fx: "holy" },
    absolution: { fx: "holy", field: true },
    dawnvow: { fx: "holy", shield: true },
    shield: { fx: "holy", shield: true },
    icebarrier: {
      fx: "holy",
      shield: true,
      tint: [0.66, 0.92, 1.0],
      tintGrad: 4,
    },
    dagger: { fx: "holy", tint: SILVER, tintGrad: 4 },
    sunblade: { fx: "holy" },
    coin: { fx: "holy" },
    // 自然：地面绿光炸起 + 叶片碎屑 + 上升藤线；battlecry 换成 ember 冲击环
    wolves: { fx: "nature" },
    huntinghorn: { fx: "nature" },
    tracking: { fx: "nature" },
    mooncall: { fx: "nature" },
    renew: { fx: "nature" },
    battlecry: { fx: "nature", tint: [1.0, 0.54, 0.16], tintGrad: 0 },
    // 虚空：暗触须朝内收拢 + 紫环坍缩 + 小爆
    dispel: { fx: "void" },
    silence: { fx: "void" },
    stillness: { fx: "void" },
    // 汲取：目标 → 施法方的血色光束，脉冲逆着攻击方向跑
    lifedrain: { fx: "siphon" },
    graveoffering: { fx: "siphon" },
    soultether: { fx: "arcane" },
  });
  // 英雄装备后的平砍：剑风，sunblade 金色、dagger 银白
  const fx2Weapons = Object.freeze({
    dagger: { fx: "slash", cutin: true, tint: SILVER, swordStyle: "twins" },
    sunblade: { fx: "slash", cutin: true, tint: GOLD, swordStyle: "daybreak" },
  });
  /* 学派配色：byPalette 的动作族按攻击方卡牌的 palette 取主色与渐变表行号。
   *
   * 第 13 轮：渐变表从 5 行扩到 10 行（tools/fx2_gradients.py），冰 / 圣金 /
   * 自然 / 虚空 / 血五个学派终于有了自己的色带，不用再借火（0）、奥术（2）、
   * 剑光（4）三行然后靠 col 硬乘 —— 借行的做法在渐变映射下必然串色（火的
   * 橙色带乘冰蓝就是一团褐）。0 火 / 1 闪电 / 2 奥术 / 3 余烬 / 4 剑光 /
   * 5 冰蓝 / 6 圣金 / 7 自然绿 / 8 虚空紫 / 9 血红。*/
  const FX2_PALETTES = Object.freeze({
    ember: Object.freeze({ tint: [1.0, 0.54, 0.16], grad: 0 }),
    gold: Object.freeze({ tint: GOLD, grad: 6 }),
    ice: Object.freeze({ tint: [0.58, 0.9, 1.0], grad: 5 }),
    arcane: Object.freeze({ tint: [0.78, 0.54, 1.0], grad: 2 }),
    void: Object.freeze({ tint: [0.6, 0.36, 0.9], grad: 8 }),
    nature: Object.freeze({ tint: [0.62, 1.0, 0.54], grad: 7 }),
    blood: Object.freeze({ tint: [1.0, 0.34, 0.34], grad: 9 }),
    steel: Object.freeze({ tint: SILVER, grad: 4 }),
  });
  /* 英雄技能（power 事件）：引擎不给 cid，只有施法方的学派，所以按**学派**映射。
   * 这是旧管线里那张 { fire: "ember", frost: "ice-lance", … } 表的 fx2 对应物。*/
  const fx2Powers = Object.freeze({
    fire: { fx: "fireball", scale: 0.7 },
    frost: { fx: "frost" },
    arcane: { fx: "arcane" },
    nature: { fx: "nature" },
    holy: { fx: "holy" },
    shadow: { fx: "void" },
    blood: { fx: "siphon" },
    steel: { fx: "arrow", tint: SILVER },
  });
  // 随从平砍的动作族。byPalette = 主色随攻击方卡牌的学派走。
  // cutin: true 只表示"这一族有切入画面"，真正弹不弹由 cutinPolicy 决定。
  const fx2AttackFamilies = Object.freeze({
    blade: { fx: "slash", cutin: true, scale: 0.6, tint: SILVER },
    claw: { fx: "claw", cutin: true, byPalette: true },
    slam: { fx: "slam", cutin: true, byPalette: true },
    arrow: { fx: "arrow", cutin: true, byPalette: true },
    spear: { fx: "spear", cutin: true, byPalette: true },
    bolt: { fx: "bolt", cutin: true, byPalette: true },
    breath: { fx: "breath", cutin: true, tint: [1.0, 0.55, 0.16], tintGrad: 0 },
  });

  /* ------------------------------------------------------------- 切入立绘策略
   * 纯函数。大演出稀缺（契约 §2.8）：切入只给英雄与传奇随从，敌我一致。
   * ctx: { cutin 这一族有切入画面, fx2 管线可用, art 画面解析得出, hero, legendary } */
  function cutinPolicy(ctx) {
    if (!ctx || !ctx.cutin || !ctx.fx2 || !ctx.art) return false;
    return !!(ctx.hero || ctx.legendary);
  }

  /* 战吼（records[].battlecry）与传奇降临（records[].arrival）按 **cast 名 /
   * arrival 名** 映射到 fx2 技能，落点是召唤位。字段与 fx2Cards 相同；
   * byPalette = 主色随这张随从的学派走。*/
  const fx2Casts = Object.freeze({
    meteor: { fx: "fireball" },
    firestorm: { fx: "fireball" },
    cataclysm: { fx: "fireball" },
    ember: { fx: "lightning" },
    sunrise: { fx: "holy", field: true },
    benediction: { fx: "holy" },
    aegis: { fx: "holy", shield: true },
    wildgate: { fx: "nature" },
    bloom: { fx: "nature" },
    warcry: { fx: "nature", tint: [1.0, 0.54, 0.16], tintGrad: 0 },
    starwell: { fx: "arcane" },
    mirror: { fx: "arcane" },
    metamorphosis: { fx: "arcane" },
    arrow: { fx: "arrow", byPalette: true },
    "ice-lance": { fx: "frost" },
    blizzard: { fx: "frost-field", field: true },
    "dragon-breath": { fx: "breath", tint: [1.0, 0.55, 0.16], tintGrad: 0 },
    dispel: { fx: "void" },
    siphon: { fx: "siphon" },
    shatter: { fx: "slash", tint: SILVER, swordStyle: "shatter" },
  });
  const fx2Arrivals = Object.freeze({
    "solar-crown": { fx: "holy", field: true },
    "astral-gate": { fx: "arcane" },
    "dragon-wake": { fx: "breath", tint: [1.0, 0.55, 0.16], tintGrad: 0 },
    "frost-throne": { fx: "frost-field", field: true },
  });

  const legends = {
    solaris: "solar-crown",
    nyx: "astral-gate",
    ashdragon: "dragon-wake",
    frostking: "frost-throne",
  };
  for (const [id, arrival] of Object.entries(legends))
    Object.assign(records[id], { arrival, windup: 620 });
  const battlecries = {
    jingchen: "firestorm",
    aurion: "sunrise",
    fenlos: "wildgate",
    spark: "ember",
    archer: "arrow",
    oracle: "starwell",
    cleric: "benediction",
    necromancer: "wildgate",
    dragon: "dragon-breath",
    solaris: "sunrise",
    nyx: "starwell",
    ashdragon: "cataclysm",
    frostking: "blizzard",
  };
  for (const [id, battlecry] of Object.entries(battlecries))
    records[id].battlecry = battlecry;
  const deities = {
    jingchen: {
      theme: "stars",
      title: "群星为薪，天火为证",
      sigil: "✦",
      english: "THE STARS IGNITE",
    },
    aurion: {
      theme: "dawn",
      title: "长夜止步，誓光永存",
      sigil: "☀",
      english: "THE DAWN ENDURES",
    },
    fenlos: {
      theme: "hunt",
      title: "古林苏醒，万兽同行",
      sigil: "❧",
      english: "THE WILD ANSWERS",
    },
    selmyra: {
      theme: "moon",
      title: "月记众生，魂归银灯",
      sigil: "☾",
      english: "THE MOON REMEMBERS",
    },
  };
  for (const [id, deity] of Object.entries(deities))
    records[id].deity = Object.freeze(deity);
  for (const value of Object.values(records)) Object.freeze(value);
  const schools = Object.freeze({
    ember: "fire",
    ice: "frost",
    arcane: "arcane",
    nature: "nature",
    gold: "holy",
    void: "shadow",
    blood: "blood",
    steel: "steel",
  });
  function get(card) {
    const id = typeof card === "string" ? card : card?.id;
    if (!id)
      return {
        attack: "blade",
        cast: "ember",
        windup: 420,
      };
    if (!records[id]) throw Error("Missing combat presentation: " + id);
    return records[id];
  }
  const fromPalette = (palette, fallback = "arcane") =>
    schools[palette] || fallback;
  /** 这张卡打出时放哪个 fx2 技能；null = 没有特效，只有 DOM 动作与数字。 */
  function fx2(card) {
    const id = typeof card === "string" ? card : card?.id;
    return (id && fx2Cards[id]) || null;
  }
  /** 按学派解析 byPalette 的覆盖项。card 可以是卡对象或 id。 */
  function tinted(spec, card) {
    if (!spec || !spec.byPalette) return spec;
    const palette =
      FX2_PALETTES[typeof card === "object" ? card?.palette : null] ||
      FX2_PALETTES.steel;
    return { ...spec, tint: palette.tint, tintGrad: palette.grad };
  }
  /** 战吼 / 英雄技能按 cast 名走不走 fx2。 */
  function fx2Cast(cast, card) {
    return tinted((cast && fx2Casts[cast]) || null, card);
  }
  /** 传奇降临按 arrival 名走不走 fx2。 */
  function fx2Arrival(arrival, card) {
    return tinted((arrival && fx2Arrivals[arrival]) || null, card);
  }
  /** 英雄技能按施法方学派映射到 fx2 技能。 */
  function fx2Power(school) {
    return (school && fx2Powers[school]) || null;
  }
  // R6: visual identities only. Every blade unit has an authored silhouette.
  // Damage, targeting, attack family and authoritative contact times stay intact.
  const swordIdentities = Object.freeze({
    squire: "dawn", guard: "bastion", assassin: "night", leech: "blood",
    paladin: "judgment", reaper: "crescent", solaris: "sunfall",
    frostking: "frost", skeleton: "bone", recruit: "thrust",
  });
  /** 平砍走不走 fx2：先看武器，再看动作族。 */
  function fx2Attack(card, weaponId) {
    if (weaponId && fx2Weapons[weaponId]) return fx2Weapons[weaponId];
    const id = typeof card === "string" ? card : card?.id;
    const family = id && records[id] ? records[id].attack : null;
    // 学派着色：combat.js 只拿 spec 读 cutin，传进来的是没有 palette 的存根，
    // 落到 steel 就行 —— 那条路径不看颜色。
    const spec = tinted((family && fx2AttackFamilies[family]) || null, card);
    return spec?.fx === "slash" ? { ...spec, swordStyle: swordIdentities[id] || "dawn" } : spec;
  }

  return Object.freeze({
    get,
    fx2,
    fx2Attack,
    fx2Cast,
    fx2Arrival,
    fx2Power,
    cutinPolicy,
    fx2Cards,
    fx2Casts,
    fx2Arrivals,
    fx2Weapons,
    swordIdentities,
    fx2Powers,
    records: Object.freeze(records),
    cardMotion,
    fromPalette,
    school: (c) => fromPalette(c?.palette, "steel"),
    ranged: (family) => !!attackFamilies[family],
  });
})();
if (typeof module !== "undefined") module.exports = EmberFXProfiles;
