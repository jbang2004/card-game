/* EmberMoveSheet — compiles the move sheets (content/moves.js, docs/design/MOVES.md) into what the battlefield's
 * figures play: a humanoid's suite (EmberModelFigures: its motion-captured clips, how its body is held, its signature
 * choreography and effects) and a beast's signature. A sheet is written the way a move is talked about — named
 * phases with their length in milliseconds, effects grouped by the moment they play — and inherits from an archetype
 * (base), so one number changes one figure or a whole class of them. Pure data in, pure data out: no three.js, no
 * page; the tests, the audit and the review page run the same code.
 *
 *   sheet (after its base chain is merged; a null value removes what was inherited, { _replace: true, … } replaces it):
 *     name · move · note            what the review page shows
 *     kind                          melee | caster | archer | beast
 *     clips { idle, attack, hurt, victory, stance }      humanoid: clip names (EmberModelAnims; "<clip>@m" mirrored)
 *     speed · aim { clip: … } · body { upright, lower, keep, castSide, face, bow, float, hover, spin, levitate,
 *                                      fists (Left | Right | both: fingers closed), hands (the same: fingers that
 *                                      a coded move works), carry (sheath | book | watch | pick | crowbar: a prop) }
 *     spell { fire | tint, rise, bolt, r, gather }       a caster's charge and bolt (its wind-up is the lead below;
 *                                                        gather false: nothing is drawn into its hand)
 *     attack
 *       before { <phase>: { ms, frame, ease } … }        to the blow, in order: each phase's length, the clip frame it
 *                                                        ends on, the ease into it (io · o · o3 · i2 · i3 · l)
 *       after  { <phase>: { ms, frame, ease } …, rise: { ms }, home: { ms } }   from the blow: the landing's phases,
 *                                                        then up into the stance (rise) and the hop home
 *       start                                            the first frame (default 0)
 *       stretch { before, after }                        × every phase's length on that side of the blow
 *       before.<phase>.hit                               that phase ends on a blow of its own, a lighter one (a combo)
 *       dash { kind: leap | lunge | stay, ms, arrive, reach, levitate, hipScale }   ms: how long before the blow it leaves (arrive: how long before the blow it is there — a combo's first hit)
 *       (was) dash                                       ms: how long before the blow it leaves
 *                                                        its station (a beast: at, the share of its lead when it does)
 *       hitstop [tier 1, 2, 3]                           frames the blow holds it
 *       bladeFrom                                        where along the weapon its light and swoosh begin (0–1)
 *       windup · draw · hold                             a beast: ms added to its charge (a shooter: ms it draws
 *                                                        before the shot leaves) · ms held at the foe
 *     flourish                                           humanoid { clip, every [s, s], keys { <phase>: … }, fadeIn,
 *                                                        fadeOut } · beast { every, len }
 *     fx { palette, size, style, charge, weapon, cast, hit, hurt, victory, idle }    see FX below
 *     look · emitter · blade                             a beast's glow, its mouth, its rider's sword
 *     plain                                              what the signature replaced (the model demo compares)
 *
 * The director's own beats (EmberTiming.attack) are part of the sum: a melee figure's lead is the lift, its wind-up
 * and the lunge; a shooter's is the recoil and its draw. The sheet gives the lead; the wind-up is derived, so the two
 * cannot drift apart. */
const EmberMoveSheet = (() => {
  const T = (typeof EmberTiming !== "undefined" && EmberTiming.attack) || { lift: 110, lunge: 150, rangedRecoil: 90 };
  const DIRECTOR = Object.freeze({ lift: T.lift, lunge: T.lunge, recoil: T.rangedRecoil });
  const KINDS = ["melee", "caster", "archer", "beast"], EASES = ["io", "o", "o3", "i2", "i3", "l"];
  // coded moves (EmberModelFigures poses them, frame by frame): n frames, the contact's frame, and — base — a
  // motion-captured clip to reshape, frame for frame (none: over the figure's stance). A sheet names one like any clip
  // and re-times it by these frames
  const CODED = Object.freeze({
    pc_horse_punch: { n: 41, hit: 18 },                 // 马步冲拳: 10 sunk · 14 held · 18 the fist out · 22 · 30 drawn back · 40 risen
    pc_loupe: { n: 37, hit: 18 },                       // 以镜观敌: 11 the loupe raised into her line of sight · 25 held · 36 lowered
    pc_starfall: { n: 61, hit: 31 },                   // 星陨: 8 gathered · 20 the whirl, risen · 27 the pose held aloft · 31 the scepter brought down at her foe · 37 · 60
    pc_ignite: { n: 49, hit: 27 },                     // 点火: 9 the hand in the pocket · 16 the dust sown · 23–25 the pose · 27 the snap · 34 · 48
    pc_watch: { n: 61, hit: 30 },                      // 看表: 16 the watch up before his chest, his head bowed to it · 48 held · 60 put away
  });
  // chained clips: stretches of motion-captured clips played one after another as one clip (a combo made of two cuts,
  // a jab and a cross) — [clip, first frame, last frame] each, `blend` frames of the next eased in from where the last
  // one ended. A sheet names a chain like any clip; its frames run on from part to part (n: how many in all)
  const CHAINS = Object.freeze({
    // 夜幕刺客: two quick stabs (13, 29: Mixamo's are left-handed — mirrored), then the stab from the rear hand (40)
    ch_stabs: { n: 61, parts: [["kb_v1@m", 6, 38], ["kn_stab", 19, 46]] },
  });
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const clone = (v) => (Array.isArray(v) ? v.map(clone) : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);

  // ------------------------------------------------------------------ inheritance
  /** b over a: objects merge key by key (a's order first), anything else replaces; `plain` is taken whole */
  function merge(a, b, key = "") {
    if (!isObj(a) || !isObj(b) || b._replace || key === "plain") {
      if (!isObj(b)) return clone(b);
      const out = clone(b); delete out._replace; return out;
    }
    const out = clone(a);
    for (const k of Object.keys(b)) out[k] = merge(a[k], b[k], k);
    return out;
  }
  /** nulls removed (a null in a sheet takes away what its base gave); `plain` keeps its own */
  function prune(v, key = "") {
    if (!isObj(v) || key === "plain") return v;
    for (const k of Object.keys(v)) { if (v[k] === null) delete v[k]; else prune(v[k], k); }
    return v;
  }
  const lookup = (S, id, figureFirst) => (figureFirst ? S.figures[id] || S.archetypes[id] : S.archetypes[id] || S.figures[id]) || null;
  /** a figure's (or an archetype's) sheet with everything it inherits */
  function resolve(S, id) {
    const chain = [], seen = new Set();
    for (let cur = lookup(S, id, true), at = id; cur; ) {
      if (seen.has(cur)) throw new Error(`move sheet ${id}: its bases loop at ${at}`);
      seen.add(cur); chain.unshift(cur);
      at = cur.base; cur = at ? lookup(S, at, false) : null;
      if (at && !cur) throw new Error(`move sheet ${id}: no base "${at}"`);
    }
    if (!chain.length) return null;
    const out = prune(chain.reduce((a, b) => merge(a, b), {}));
    delete out.base; delete out.label;
    return out;
  }
  /** the archetypes a sheet stands on, nearest first */
  function bases(S, id) {
    const out = [];
    for (let cur = lookup(S, id, true); cur?.base && out.length < 16; cur = lookup(S, cur.base, false)) out.push(cur.base);
    return out;
  }

  // ------------------------------------------------------------------ effects: the sheet's groups ↔ the recipe
  // [the recipe's key (EmberSkillFx), the sheet's group, its key there]
  const FX = [
    ["pal", null, "palette"], ["scale", null, "size"],
    ["sigil", "charge", "sigil"], ["chargeShape", "charge", "motes"], ["dim", "charge", "dim"], ["lantern", "charge", "lantern"], ["vanish", "charge", "vanish"],
    ["weapon", "weapon", "glow"], ["limb", "weapon", "limb"],
    ["cast", "cast", "kind"], ["castHand", "cast", "hand"], ["blades", "cast", "blades"], ["sky", "cast", "sky"], ["look", "cast", "look"], ["callSigil", "cast", "sigil"],
    ["castBits", "cast", "bits"], ["castCount", "cast", "count"], ["castGap", "cast", "gap"], ["castAt", "cast", "at"], ["echo", "charge", "echo"],
    ["flash", "hit", "flash"], ["slash", "hit", "mark"], ["beam", "hit", "beam"], ["ground", "hit", "ground"], ["spikes", "hit", "spikes"], ["rocks", "hit", "rocks"],
    ["bits", "hit", "bits"], ["nbits", "hit", "bitsCount"], ["bits2", "hit", "bits2"], ["dust", "hit", "dust"], ["shake", "hit", "shake"], ["flame", "hit", "flame"],
    ["drain", "hit", "drain"], ["implode", "hit", "implode"], ["lift", "hit", "lift"],
    ["hurt", "hurt", "at"],
  ];
  const FX_GROUPS = { charge: ["sigil", "motes", "column", "dim", "lantern", "vanish", "echo"], weapon: ["glow", "limb", "trail"], cast: ["kind", "hand", "blades", "sky", "look", "sigil", "bits", "count", "gap", "at"],
    hit: ["flash", "mark", "beam", "ground", "spikes", "rocks", "bits", "bitsCount", "bits2", "dust", "shake", "flame", "drain", "implode", "lift"],
    hurt: ["at"], victory: ["ray", "orb", "rain", "flame", "shock"], idle: ["bits", "every", "halo"] };
  // an element given as { kind, size, gain, life, count } is that element tuned: × its size, its brightness, how long
  // it lasts, how many of it (EmberSkillFx reads recipe.tune[name]). name → [group, key]; an element without a key
  // of its own (the shock rings, the sparks) is always on and only ever tuned
  const TUNE_KEYS = ["size", "gain", "life", "count"];
  const TUNABLE = {
    sigil: ["charge", "sigil"], stream: ["charge", "stream"], column: ["charge", "column"], glint: ["weapon", "glint"], trail: ["weapon", "trail"], glow: ["weapon", "glow"],
    flash: ["hit", "burst"], mark: ["hit", "mark"], shock: ["hit", "shock"], beam: ["hit", "beam"], ground: ["hit", "ground"], spikes: ["hit", "spikes"], rocks: ["hit", "rocks"],
    sparks: ["hit", "sparks"], bits: ["hit", "bits"], dust: ["hit", "dust"], flame: ["hit", "flame"], hurt: ["hurt", "flash"],
    ray: ["victory", "ray"], orb: ["victory", "orb"], rain: ["victory", "rain"], aura: ["idle", "bits"], halo: ["idle", "halo"],
  };
  const ALWAYS = { charge: ["stream"], weapon: ["glint"], hit: ["burst", "shock", "sparks"], hurt: ["flash"] };   // tuned only
  const isTuned = (v) => isObj(v) && Object.keys(v).some((k) => TUNE_KEYS.includes(k));
  const untuned = (v) => (isTuned(v) ? ("kind" in v ? v.kind : true) : v);

  /** the sheet's fx → the recipe EmberSkillFx plays */
  function fxRecipe(fx) {
    if (!fx) return undefined;
    const out = {}, G = (g) => fx[g] || {};
    for (const [flat, group, key] of FX) { const v = group ? G(group)[key] : fx[key]; if (v !== undefined) out[flat] = untuned(v); }
    if (fx.style === "modern") out.modern = true;
    const col = G("charge").column;
    if (col !== undefined) { const c = untuned(col); if (c) { out.rise = true; if (typeof c === "string") out.riseShape = c; } else out.rise = false; }
    const tr = G("weapon").trail;
    if (tr === false) out.trail = false;
    else if (isObj(tr)) { if (tr.from !== undefined) out.trailFrom = tr.from; if (tr.inner !== undefined) out.trailInner = tr.inner; }
    if (fx.victory) out.victory = Object.fromEntries(Object.entries(fx.victory).map(([k, v]) => [k, untuned(v)]));
    if (fx.idle) out.aura = Object.fromEntries(Object.entries(fx.idle).map(([k, v]) => [k, untuned(v)]));
    const tune = {};
    for (const [name, [group, key]] of Object.entries(TUNABLE)) {
      const v = G(group)[key];
      if (isTuned(v)) tune[name] = Object.fromEntries(TUNE_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, v[k]]));
    }
    if (Object.keys(tune).length) out.tune = tune;
    return out;
  }

  // ------------------------------------------------------------------ timing
  const phasesOf = (o, skip = []) => Object.entries(o || {}).filter(([k]) => !skip.includes(k));
  /** [[0, first frame], [x, frame, ease] …]: x the running sum of the phases' ms (× k), over `per` */
  function keys(phases, first, k, per) {
    let at = 0;
    return [[0, first], ...phases.map(([, p]) => { at += p.ms * k; const key = [at / per, p.frame]; if (p.ease !== undefined) key.push(p.ease); return key; })];
  }
  const sum = (phases, k) => phases.reduce((n, [, p]) => n + p.ms * k, 0);

  /** a humanoid's sheet → its suite (EmberModelFigures.SUITES[id]) */
  function suite(sheet) {
    const s = {}, c = sheet.clips || {}, b = sheet.body || {}, A = sheet.attack;
    for (const k of ["idle", "attack", "hurt", "victory", "stance"]) if (c[k] !== undefined) s[k] = c[k];
    if (sheet.aim) s.aim = clone(sheet.aim);
    for (const k of ["upright", "lower", "keep", "castSide", "face", "bow", "float", "hover", "spin", "levitate", "fists", "hands", "carry"]) if (b[k] !== undefined) s[k] = clone(b[k]);
    if (sheet.speed !== undefined) s.speed = sheet.speed;
    if (sheet.spell) s.spell = clone(sheet.spell);
    if (A?.before) {
      const before = phasesOf(A.before), after = phasesOf(A.after, ["rise", "home"]), kb = A.stretch?.before ?? 1, ka = A.stretch?.after ?? 1;
      const lead = sum(before, kb), first = A.start ?? 0, d = A.dash || {};
      const sig = { lead, pre: keys(before, first, kb, lead) };
      // a combo: every phase marked `hit` ends on a lighter blow of its own (hit: its weight, true = 0.6) before the last
      // phase's, which is the director's contact — [{ at: its share of the lead, k }]
      { let t = 0; const combo = []; before.forEach(([, p], i) => { t += p.ms * kb; if (p.hit && i < before.length - 1) combo.push({ at: t / lead, k: p.hit === true ? 0.6 : p.hit }); }); if (combo.length) sig.combo = combo; }
      if (d.arrive !== undefined) sig.arrive = d.arrive / lead;
      sig.post = keys(after, before.length ? before[before.length - 1][1].frame : first, ka, 1000);
      sig.rise = ((A.after?.rise?.ms ?? 0) * ka) / 1000; sig.back = ((A.after?.home?.ms ?? 0) * ka) / 1000;
      if (d.kind === "stay") sig.stay = true; else if (d.kind) sig.dash = d.kind;
      if (d.ms !== undefined) sig.leap = (lead - d.ms) / lead;
      for (const k of ["reach", "levitate", "hipScale", "recoil"]) if (d[k] !== undefined) sig[k] = d[k];
      if (A.hitstop) sig.hitstop = [0, ...A.hitstop];
      if (A.bladeFrom !== undefined) sig.bladeFrom = A.bladeFrom;
      // the director's beats make up the rest of the lead: what is left is this figure's own wind-up
      if (sheet.kind === "melee") sig.windup = lead - DIRECTOR.lift - DIRECTOR.lunge;
      else if (sheet.kind === "archer") sig.draw = lead - DIRECTOR.recoil;
      else if (s.spell) s.spell.windup = lead - DIRECTOR.recoil;
      const fl = sheet.flourish;
      if (fl) sig.flourish = { clip: fl.clip, every: clone(fl.every), keys: keys(phasesOf(fl.keys), fl.start ?? 0, 1, 1000), fade: [(fl.fadeIn ?? 0) / 1000, (fl.fadeOut ?? 0) / 1000] };
      const fx = fxRecipe(sheet.fx); if (fx) sig.fx = fx;
      sig.phases = { pre: before.map(([k]) => k), post: after.map(([k]) => k) };
      s.sig = sig;
    }
    if (sheet.plain) s.plain = clone(sheet.plain);
    return s;
  }
  /** a beast's sheet → its entry (EmberModelFigures' BEASTS[id]): its look, and the signature round its coded clip */
  function beast(sheet) {
    const out = {}, A = sheet.attack || {}, d = A.dash || {};
    for (const k of ["look", "flourish", "emitter", "blade"]) if (sheet[k] !== undefined) out[k] = clone(sheet[k]);
    const sig = {};
    if (A.windup !== undefined) sig.windup = A.windup;
    if (A.draw !== undefined) sig.draw = A.draw;
    if (d.at !== undefined) sig.leap = d.at;
    if (d.kind === "stay") sig.stay = true; else if (d.kind) sig.dash = d.kind;
    if (d.reach !== undefined) sig.reach = d.reach;
    if (A.hitstop) sig.hitstop = [0, ...A.hitstop];
    sig.post = [[0, 0], [(A.hold ?? 0) / 1000, 0]];
    sig.rise = (A.after?.rise?.ms ?? 0) / 1000; sig.back = (A.after?.home?.ms ?? 0) / 1000;
    const fx = fxRecipe(sheet.fx); if (fx) sig.fx = fx;
    out.sig = sig;
    return out;
  }
  /** every figure of the sheets → { SUITES, BEASTS } */
  function compile(S) {
    const SUITES = {}, BEASTS = {};
    for (const id of Object.keys(S.figures)) {
      const sheet = resolve(S, id);
      if (sheet.kind === "beast") BEASTS[id] = beast(sheet); else SUITES[id] = suite(sheet);
    }
    return { SUITES, BEASTS };
  }

  // ------------------------------------------------------------------ the timeline (the review page, the audit)
  // what the phases and the effects are called (zh): a phase or element a sheet names itself (label) wins
  const LABELS = {
    phase: { coil: "蓄力", hold: "蓄满", draw: "后引", sink: "潜影", poise: "蓄势", crouch: "下蹲", spring: "腾空", heave: "腾空", hang: "滞空", first: "第一击", level: "指剑", lift: "上举",
      gather: "聚能", pull: "拉弓", strike: "出手", loose: "放箭", volley: "齐射", release: "释放", follow: "随势", settle: "定格", rise: "起身", home: "回位", charge: "蓄势", dash: "冲刺", stay: "停留", raise: "举起", lower: "放下",
      wind: "起手", cut: "斩", chop: "劈", swing: "抡", back: "反手", heave: "举起", reap: "镰斩", spin: "旋身", turn: "翻腕", bash: "盾击", thrust: "刺", lash: "鞭", kick: "踢", jab: "刺拳",
      left: "左拳", punch: "拳", hook: "勾拳", stab: "刺", again: "再刺", one: "一", two: "二", three: "三", whirl: "旋身", pose: "定势", command: "一指", dip: "探囊", sow: "撒尘", snap: "响指", stoop: "弓身" },
    group: { charge: "蓄力", weapon: "武器", cast: "施法", hit: "命中", hurt: "受击", victory: "胜利", idle: "待机" },
    fx: { palette: "配色", size: "整体大小", style: "风格",
      "charge.sigil": "脚下法印", "charge.motes": "聚能光点", "charge.stream": "聚能光流", "charge.column": "升腾光柱", "charge.dim": "舞台压暗", "charge.lantern": "提灯变亮", "charge.vanish": "遁影烟", "charge.echo": "倒影分身",
      "weapon.glow": "武器发光", "weapon.limb": "拳脚刀光", "weapon.trail": "刀光", "weapon.glint": "刃尖闪光",
      "cast.kind": "施法方式", "cast.hand": "施法手", "cast.blades": "光剑数量", "cast.sky": "天象", "cast.look": "弹道外观", "cast.sigil": "落点法印", "cast.bits": "飞出之物", "cast.count": "数量", "cast.gap": "连发间隔", "cast.at": "点燃时刻",
      "hit.flash": "闪光强度", "hit.burst": "命中闪光", "hit.mark": "刀痕", "hit.shock": "冲击环", "hit.beam": "光柱", "hit.ground": "地面痕迹", "hit.spikes": "地刺", "hit.rocks": "碎石", "hit.sparks": "火花",
      "hit.bits": "飞散物", "hit.bitsCount": "飞散物数量", "hit.bits2": "第二种飞散物", "hit.dust": "尘土", "hit.shake": "震屏", "hit.flame": "爆燃", "hit.drain": "吸取", "hit.implode": "内吸", "hit.lift": "挑飞",
      "hurt.at": "受击部位", "hurt.flash": "受击闪光", "victory.ray": "天光", "victory.orb": "身后天体", "victory.rain": "飘落物", "victory.flame": "火焰", "victory.shock": "震地",
      "idle.bits": "环身飘浮物", "idle.every": "飘浮间隔", "idle.halo": "脚下光环" },
    // what the values are called (the review page reads a sheet out in these words)
    value: { crack: "地裂", roots: "根须", frost: "霜冻", void: "虚空池", rune: "符印", line: "一道", cross: "十字", crescent: "新月", pierce: "贯穿", claw: "爪痕", bite: "咬痕",
      ice: "冰刺", rock: "岩石", thorn: "荆棘", feather: "光羽", leaf: "叶片", snow: "雪花", shard: "碎晶", star: "星", star5: "五角星", wisp: "魂丝", sparkle: "光点", spark: "火星",
      sun: "日", moon: "月", shield: "盾上", body: "身上", bolt: "飞弹", sky: "星坠", ground: "地涌", array: "剑阵", pillar: "火柱", collapse: "坍缩", spear: "灵矛",
      stream: "连发", lob: "抛星", ray: "聚光", fuse: "引信", mark: "鉴定标记", ignite: "粉尘点火", clock: "钟面", astral: "星轨", glyph: "字符", gear: "齿轮", petal: "花瓣", tag: "当票", held: "手持物", book: "书",
      leap: "跃起", lunge: "突进", stay: "原地", modern: "现代", true: "有", false: "无" },
    palette: { holy: "圣光金", sun: "烈日橙", dawn: "晨曦", frost: "霜蓝", moon: "暗月紫", star: "星辉蓝", wild: "荒野绿", verdant: "翠金", earth: "大地", fire: "烈火", void: "虚空紫", astral: "星界",
      necro: "冥绿", nightbloom: "夜花紫", hearth: "炉火", amber: "琥珀", brass: "黄铜", coal: "煤黑", glass: "镜蓝", steel: "钢灰", bone: "骨白", shadow: "暗影红", rage: "怒红", ember: "余烬", iron: "玄铁", soul: "魂蓝", blood: "血红", fey: "精灵青", phoenix: "凤凰蓝金", rune: "符文蓝" },
    kind: { melee: "近战", caster: "施法", archer: "弓手", beast: "兽类" },
  };
  const label = (id, own) => own || LABELS.phase[id] || id;
  /** an attack as a list of phases on one clock (ms from the cue; the blow at `lead`):
   *  → { lead, total, phases: [{ id, label, side: "before" | "after", t0, t1, frame0, frame1, ease }], dash: { t0, t1, kind } | null } */
  function timeline(sheet) {
    const A = sheet?.attack;
    if (sheet?.kind === "beast" && A) {
      // a beast's clip is coded: its phases are the director's — the charge, the dash, what it holds at the foe
      const d = A.dash || {}, lead = A.draw !== undefined ? DIRECTOR.recoil + A.draw : DIRECTOR.lift + (A.windup ?? 0) + DIRECTOR.lunge, out = [];
      const leave = d.at !== undefined && d.kind !== "stay" ? d.at * lead : lead;
      let t = 0;
      const add = (id, ms, side) => { if (ms > 0) out.push({ id, label: label(id), side, t0: t, t1: (t += ms) }); };
      add("charge", leave, "before"); add("dash", lead - leave, "before");
      add("stay", A.hold ?? 0, "after"); add("rise", A.after?.rise?.ms ?? 0, "after"); add("home", A.after?.home?.ms ?? 0, "after");
      return { lead, total: t, phases: out, dash: leave < lead ? { t0: leave, t1: lead, kind: d.kind } : null };
    }
    if (!A?.before) return null;
    const kb = A.stretch?.before ?? 1, ka = A.stretch?.after ?? 1, out = [];
    let t = 0, f = A.start ?? 0;
    for (const [id, p] of phasesOf(A.before)) { out.push({ id, label: label(id, p.label), side: "before", t0: t, t1: (t += p.ms * kb), frame0: f, frame1: (f = p.frame), ease: p.ease, hit: p.hit || undefined }); }
    const lead = t;
    for (const [id, p] of phasesOf(A.after)) out.push({ id, label: label(id, p.label), side: "after", t0: t, t1: (t += p.ms * ka), frame0: f, frame1: (f = p.frame ?? f), ease: p.ease });
    const d = A.dash;
    return { lead, total: t, phases: out, dash: d?.ms !== undefined ? { t0: lead - d.ms, t1: lead, kind: d.kind } : null };
  }
  /** the effects a sheet plays, by the moment they play: [{ group, key, label, value }] */
  function effects(sheet) {
    const fx = sheet?.fx, out = [];
    if (!fx) return out;
    for (const k of ["palette", "size", "style"]) if (fx[k] !== undefined) out.push({ group: null, key: k, label: LABELS.fx[k], value: fx[k] });
    for (const g of Object.keys(FX_GROUPS)) for (const [k, v] of Object.entries(fx[g] || {})) out.push({ group: g, key: k, label: LABELS.fx[`${g}.${k}`] || k, value: v });
    return out;
  }

  // ------------------------------------------------------------------ checks
  const SHEET_KEYS = ["base", "label", "name", "move", "note", "kind", "clips", "speed", "aim", "body", "spell", "attack", "flourish", "fx", "look", "emitter", "blade", "plain"];
  const ENUM = { "hit.mark": ["line", "cross", "crescent", "pierce", "claw", "bite", false], "hit.ground": ["crack", "roots", "frost", "void", "rune", false],
    "hit.spikes": ["ice", "rock", "thorn", false], "cast.kind": ["bolt", "sky", "ground", "array", "pillar", "collapse", "spear", "stream", "lob", "ray", "fuse", "mark", "ignite"], "hurt.at": ["shield", "body"],
    "cast.bits": ["glyph", "petal", "sparkle", "wisp", "tag"], "cast.sigil": ["sun", "moon", "star", "rune", "leaf", "clock", "astral"],
    "charge.sigil": ["sun", "moon", "star", "rune", "leaf", "clock", false], "dash": ["leap", "lunge", "stay"] };
  /** what is wrong with the sheets → [message]. known: { clips: { name: frames }, palettes: [name], shapes: [name] }
   *  (each optional: what the page has loaded) */
  function validate(S, known = {}) {
    const bad = [], say = (id, msg) => bad.push(`${id}: ${msg}`);
    if (known.clips) known = { ...known, clips: { ...known.clips, ...Object.fromEntries(Object.entries(CODED).map(([k, c]) => [k, c.n])), ...Object.fromEntries(Object.entries(CHAINS).map(([k, c]) => [k, c.n])) } };   // (a coded move is a clip too, and a chain)
    if (known.clips) for (const [k, c] of Object.entries(CHAINS)) for (const [part, f0, f1] of c.parts) { const n = known.clips[part.replace(/@m$/, "")]; if (n === undefined) bad.push(`chain ${k}: clip "${part}" is not in EmberModelAnims`); else if (f0 < 0 || f1 > n - 1 || f1 <= f0) bad.push(`chain ${k}: ${part} ${f0}–${f1} is outside its ${n} frames`); }
    for (const id of Object.keys(S.archetypes)) if (S.figures[id]) say(id, "is both an archetype and a figure");
    for (const [where, table] of [["archetype", S.archetypes], ["figure", S.figures]]) for (const [id, raw] of Object.entries(table)) {
      for (const k of Object.keys(raw)) if (!SHEET_KEYS.includes(k)) say(id, `unknown key "${k}"`);
      let sheet;
      try { sheet = resolve(S, id); } catch (e) { say(id, e.message); continue; }
      if (where === "archetype") continue;
      if (!KINDS.includes(sheet.kind)) { say(id, `kind "${sheet.kind}" is not one of ${KINDS.join(" | ")}`); continue; }
      const A = sheet.attack || {}, fx = sheet.fx || {};
      if (sheet.kind !== "beast") {
        for (const k of ["idle", "attack", "hurt", "victory"]) {
          const c = sheet.clips?.[k];
          if (!c) say(id, `no ${k} clip`);
          else if (known.clips && !(c.replace(/@m$/, "") in known.clips)) say(id, `clip "${c}" is not in EmberModelAnims`);
        }
        const frames = known.clips?.[sheet.clips?.attack?.replace(/@m$/, "")];
        for (const side of ["before", "after"]) for (const [pid, p] of phasesOf(A[side])) {
          if (!(p.ms > 0)) say(id, `attack.${side}.${pid}: ms must be > 0`);
          if (pid === "rise" || pid === "home") continue;
          if (typeof p.frame !== "number") say(id, `attack.${side}.${pid}: no frame`);
          else if (frames && (p.frame < 0 || p.frame > frames - 1)) say(id, `attack.${side}.${pid}: frame ${p.frame} is outside ${sheet.clips.attack} (0–${frames - 1})`);
          if (p.ease !== undefined && !EASES.includes(p.ease)) say(id, `attack.${side}.${pid}: ease "${p.ease}"`);
        }
        if (A.before) {
          const lead = sum(phasesOf(A.before), A.stretch?.before ?? 1), floor = sheet.kind === "melee" ? DIRECTOR.lift + DIRECTOR.lunge : DIRECTOR.recoil;
          if (lead < floor) say(id, `its lead (${lead} ms) is shorter than the director's own beats (${floor} ms)`);
          if (A.dash?.ms !== undefined && A.dash.ms > lead) say(id, `attack.dash.ms (${A.dash.ms}) is longer than its lead (${lead})`);
          if (sheet.kind === "caster" && !sheet.spell) say(id, "a caster needs a spell");
        }
      } else if (A.before) say(id, "a beast's clip is coded: attack.before does not apply");
      if (A.dash?.kind !== undefined && !ENUM.dash.includes(A.dash.kind)) say(id, `attack.dash.kind "${A.dash.kind}"`);
      if (A.hitstop && A.hitstop.length !== 3) say(id, "attack.hitstop is [tier 1, tier 2, tier 3]");
      for (const k of Object.keys(fx)) if (!["palette", "size", "style", ...Object.keys(FX_GROUPS)].includes(k)) say(id, `fx: unknown key "${k}"`);
      if (fx.palette !== undefined && known.palettes && !known.palettes.includes(fx.palette)) say(id, `fx.palette "${fx.palette}"`);
      for (const [g, allowed] of Object.entries(FX_GROUPS)) for (const [k, v] of Object.entries(fx[g] || {})) {
        if (!allowed.includes(k) && !(ALWAYS[g] || []).includes(k)) { say(id, `fx.${g}: unknown key "${k}"`); continue; }
        const e = ENUM[`${g}.${k}`], plain = untuned(v);
        if (e && !e.includes(plain)) say(id, `fx.${g}.${k} "${plain}" is not one of ${e.join(" | ")}`);
        if ((ALWAYS[g] || []).includes(k) && !isTuned(v)) say(id, `fx.${g}.${k} is always on: give it { size, gain, life, count }`);
        if (isTuned(v) && !Object.values(TUNABLE).some(([tg, tk]) => tg === g && tk === k)) say(id, `fx.${g}.${k} cannot be tuned`);
      }
    }
    return bad;
  }

  // ------------------------------------------------------------------ the sheets in use
  let sheets = typeof EmberMoveSheets !== "undefined" ? EmberMoveSheets : { archetypes: {}, figures: {} };
  let built = null;
  const tables = () => built || (built = compile(sheets));
  /** new sheets (the review page reloads content/moves.js as it is edited) → the tables compiled again */
  function use(S) { sheets = S; built = null; return tables(); }
  return Object.freeze({
    DIRECTOR, LABELS, KINDS, EASES, FX_GROUPS, TUNABLE, CODED, CHAINS,
    merge, resolve, compile, suite, beast, fxRecipe, timeline, effects, validate, use,
    get sheets() { return sheets; },
    get SUITES() { return tables().SUITES; },
    get BEASTS() { return tables().BEASTS; },
    sheet: (id) => (sheets.figures[id] ? resolve(sheets, id) : null),
    bases: (id) => bases(sheets, id),
    timelineOf: (id) => (sheets.figures[id] ? timeline(resolve(sheets, id)) : null),
    effectsOf: (id) => (sheets.figures[id] ? effects(resolve(sheets, id)) : []),
  });
})();
if (typeof module !== "undefined") module.exports = EmberMoveSheet;
