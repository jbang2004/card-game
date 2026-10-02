/* EmberMoveSheets — how every battlefield figure moves and what its blows look like, written the way a move is talked
 * about (docs/design/MOVES.md). The only place to tune a figure's motion and effects: EmberMoveSheet
 * (presentation/voxel/movesheet.js) compiles these sheets into the suites and recipes the figures play.
 *
 *   archetypes   what a class of figures shares (近战 · 剑盾劈砍 · 施法 · 弓手 · 神 · 兽类 …): change a number here and
 *                every figure standing on it changes
 *   figures      one sheet per figure: its base (an archetype, or another figure) and only what differs from it.
 *                A null takes away what the base gave; { _replace: true, … } replaces a group of phases whole.
 *
 * Times are milliseconds, sizes are × the figure, frames are the motion-captured clip's (30 fps). The phases of an
 * attack run in the order written: `before` up to the blow (their sum is the figure's lead — the director's lift and
 * lunge, or a shooter's recoil, are inside it), `after` from the blow, then `rise` back into the stance and `home`,
 * the hop back to its station. Pure data: no code, no three.js. */
const EmberMoveSheets = {
  archetypes: {
    melee: {
      label: "近战",
      kind: "melee",
    },
    swordShield: {
      base: "melee", label: "剑盾劈砍",
      clips: { attack: "ss_down", victory: "vc_pump" }, body: { lower: ["attack"] },
      attack: {
        before: { coil: { ms: 253, frame: 13, ease: "io" }, hold: { ms: 69, frame: 14, ease: "o" }, strike: { ms: 138, frame: 20, ease: "i3" } },
        after: { follow: { ms: 120, frame: 22.5, ease: "o" }, settle: { ms: 220, frame: 28, ease: "io" }, rise: { ms: 280 }, home: { ms: 280 } },
        dash: { kind: "lunge", ms: 230, reach: 0.4 }, hitstop: [3, 4, 6],
      },
      fx: {
        size: 0.85, charge: { sigil: "sun" }, hit: { beam: false }, hurt: { at: "shield" }, victory: { rain: "sparkle" },
        idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    crossSlash: {
      base: "melee", label: "十字斩",
      clips: { idle: "ss_idle", attack: "ss_cross_slash", hurt: "ss_impact" },
      attack: {
        before: {
          coil: { ms: 100, frame: 6, ease: "io" }, first: { ms: 150, frame: 17, ease: "o", hit: 0.6 }, hold: { ms: 60, frame: 18.5, ease: "o" },
          strike: { ms: 190, frame: 25, ease: "i3" },
        },
        after: { follow: { ms: 100, frame: 29, ease: "o" }, settle: { ms: 240, frame: 36, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 420, arrive: 270, reach: 0.4 }, hitstop: [3, 5, 7],
      },
      fx: {
        charge: { sigil: "sun" }, weapon: { trail: { from: 0.15 } }, hit: { mark: "cross", beam: false, ground: "crack", flame: true },
        hurt: { at: "shield" }, victory: { orb: "sun" }, idle: { bits: "sparkle", every: 380 },
      },
    },
    spear: {
      base: "melee", label: "长枪突刺",
      clips: { attack: "sp_bayonet" }, aim: { idle: "up", attack: "target", victory: "up" },
      attack: {
        before: { coil: { frame: 17, ease: "io" }, hold: { frame: 17.5, ease: "o" }, strike: { frame: 28, ease: "i3" } },
        after: { follow: { ms: 100, frame: 31, ease: "o" }, settle: { ms: 200, frame: 36, ease: "io" }, rise: { ms: 280 }, home: { ms: 300 } },
        dash: { kind: "lunge", reach: 0.55 }, hitstop: [3, 4, 6], bladeFrom: 0.7,
      },
      fx: {
        charge: { sigil: "rune" }, weapon: { trail: { from: 0.6, inner: 0.6 } }, hit: { mark: "pierce", beam: false }, hurt: { at: "body" },
        victory: { ray: false }, idle: { halo: false },
      },
    },
    swipe: {
      base: "melee", label: "重臂横扫",
      clips: { attack: "mu_swipe", hurt: "mu_hit", victory: "vc_raise_hand" },
      attack: {
        before: { coil: { ms: 336, frame: 22, ease: "io" }, hold: { ms: 67, frame: 24, ease: "o" }, strike: { ms: 157, frame: 30, ease: "i3" } },
        after: { follow: { ms: 120, frame: 33, ease: "o" }, settle: { ms: 280, frame: 40, ease: "io" }, rise: { ms: 350 }, home: { ms: 350 } },
        dash: { kind: "lunge", ms: 280, reach: 0.4 }, hitstop: [4, 6, 8],
      },
      fx: {
        size: 1.1, charge: { sigil: "rune" }, weapon: { glow: false, limb: ["LeftForeArm", "LeftHand"], trail: { from: 0.72, inner: 0.2 } },
        hit: { mark: false, beam: false, ground: "crack", spikes: "rock", rocks: 5, shake: 1.3 }, hurt: { at: "body" },
        victory: { ray: false, rain: "rock", shock: true }, idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    punch: {
      base: "melee", label: "重拳",
      clips: { idle: "st_idle", attack: "pu_cross", hurt: "mu_hit", victory: "vc_pump" },
      attack: {
        before: { coil: { ms: 275, frame: 4, ease: "io" }, hold: { ms: 65, frame: 4.5, ease: "o" }, strike: { ms: 160, frame: 10, ease: "i3" } },
        after: { follow: { ms: 100, frame: 12, ease: "o" }, settle: { ms: 250, frame: 18, ease: "io" }, rise: { ms: 300 }, home: { ms: 320 } },
        dash: { kind: "lunge", ms: 250, reach: 0.34 }, hitstop: [4, 6, 8],
      },
      fx: {
        size: 1.15, charge: { sigil: false }, weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.55, inner: 0.2 } },
        hit: { mark: false, beam: false, shake: 1.4 }, hurt: { at: "body" }, victory: { ray: false, shock: true },
        idle: { bits: "sparkle", every: 1000, halo: false },
      },
    },
    caster: {
      label: "施法",
      kind: "caster", clips: { hurt: "mg_hit_right" }, body: { face: true },
    },
    throwCast: {
      base: "caster", label: "掷出法术",
      clips: { idle: "mg_idle", attack: "mg_cast_forward" }, body: { lower: ["attack"] },
      attack: {
        before: { gather: { ms: 553, frame: 20, ease: "io" }, hold: { ms: 79, frame: 22, ease: "o" }, release: { ms: 158, frame: 24, ease: "i3" } },
        after: { follow: { ms: 150, frame: 28, ease: "o" }, settle: { ms: 300, frame: 36, ease: "io" }, rise: { ms: 350 } },
      },
      fx: {
        size: 0.8, charge: { sigil: "sun" }, weapon: { glow: false }, cast: { kind: "bolt" }, hit: { mark: false, ground: "crack", flame: true },
        hurt: { at: "body" }, victory: { ray: false, flame: true }, idle: { bits: "sparkle", every: 500, halo: false },
      },
    },
    // (the light leaves the lantern itself — cast.hand "held" — so it is seen where it comes from)
    lanternCast: {
      base: "caster", label: "提灯施法",
      clips: { idle: "st_suitcase_m", attack: "cs_one_m", victory: "vc_raise_hand_m" },
      body: { lower: ["attack"], castSide: "L" },
      fx: {
        charge: { sigil: "moon", lantern: true }, weapon: { glow: false }, cast: { kind: "bolt", hand: "held" },
        hit: { mark: false, bits: "wisp" }, hurt: { at: "body" }, victory: { ray: false, rain: "wisp" }, idle: { bits: "wisp", every: 700 },
      },
    },
    prayerCast: {
      base: "caster", label: "祷告施法",
      clips: { attack: "cs_two_fwd" },
      attack: {
        before: { gather: { ms: 521, frame: 27, ease: "io" }, hold: { ms: 95, frame: 29, ease: "o" }, release: { ms: 174, frame: 34, ease: "i3" } },
        after: { follow: { ms: 120, frame: 37, ease: "o" }, settle: { ms: 280, frame: 44, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        size: 0.9, charge: { sigil: "sun" }, weapon: { glow: false }, cast: { kind: "bolt" },
        hit: { mark: false, ground: "rune", bits: "feather", bitsCount: 5 }, hurt: { at: "body" }, victory: { ray: false, rain: "feather" },
        idle: { bits: "sparkle", every: 600 },
      },
    },
    archer: {
      label: "弓手",
      kind: "archer", clips: { idle: "bw_aim_idle", attack: "bw_aimfire", hurt: "bw_hit_front", victory: "vc_pump_restrained" }, body: { bow: true },
      attack: {
        before: { pull: { ms: 273, frame: 5, ease: "io" }, hold: { ms: 59, frame: 5.5, ease: "o" }, loose: { ms: 58, frame: 7, ease: "i3" } },
        after: { follow: { ms: 200, frame: 12, ease: "o" }, settle: { ms: 300, frame: 20, ease: "io" }, rise: { ms: 300 } },
      },
      fx: {
        charge: { sigil: "leaf" }, weapon: { trail: false }, cast: { kind: "bolt" },
        hit: { mark: "pierce", beam: false, bits: "leaf", bitsCount: 5 }, hurt: { at: "body" }, victory: { ray: false, rain: "leaf" },
        idle: { bits: "leaf", every: 900, halo: false },
      },
    },
    god: {
      label: "神",
      fx: { size: 1.1, style: "modern", hit: { mark: false, shake: 1.2 }, hurt: { at: "body" } },
    },
    beast: {
      label: "兽类",
      kind: "beast",
      attack: { after: { rise: { ms: 120 }, home: { ms: 300 } }, hitstop: [3, 4, 6], hold: 180 },
      fx: {
        charge: { sigil: false }, hit: { flash: 0.4, beam: false }, hurt: { at: "body" }, victory: { ray: false },
        idle: { bits: "sparkle", halo: false },
      },
    },
  },
  figures: {
    // ---- 近战（melee）
    // 圣光裁决者 — the signature: upright and composed at rest, saluting with the blade now and then; the attack is a
    // spinning leap behind her shield that slams the blade down on the foe and lands her on one knee as the light
    // cracks out of the ground, then she rises; she takes a blow on the shield, braced; the holy sword raised high on
    // victory
    paladin: {
      base: "melee", name: "圣光裁决者", move: "圣光裁决",
      note: "蓄力 → 旋身跃起 → 劈落裂地 → 单膝落地 → 起身归位。",
      clips: { idle: "st_axe", attack: "ss_power", hurt: "ss_impact", victory: "vc_raise_hand" }, aim: { victory: "raised" },
      attack: {
        before: {
          coil: { ms: 132, frame: 11, ease: "io" }, hold: { ms: 48, frame: 12.5, ease: "o" }, spring: { ms: 300, frame: 28, ease: "o" },
          strike: { ms: 120, frame: 33, ease: "i3" },
        },
        after: { follow: { ms: 100, frame: 37, ease: "o" }, settle: { ms: 260, frame: 41, ease: "io" }, rise: { ms: 340 }, home: { ms: 320 } },
        dash: { kind: "leap", ms: 420, reach: 0.42 }, hitstop: [3, 5, 7],
      },
      flourish: {
        clip: "gs_pose", every: [9, 14], keys: { raise: { ms: 850, frame: 30, ease: "io" }, lower: { ms: 1450, frame: 58, ease: "io" } },
        fadeIn: 350, fadeOut: 550,
      },
      fx: { palette: "holy", charge: { sigil: "sun" }, hit: { ground: "crack", bits: "feather" }, hurt: { at: "shield" }, idle: { bits: "sparkle" } },
      plain: { attack: "gs_downward_slash", hurt: "gs_impact" },
    },
    // the frost king admires his own blade; one sweeping slash that ends on the blow; a cold salute 凛冬斩: the blade
    // swung far back as rime climbs it, one wide cut — the ground freezes over and ice bursts from it
    frostking: {
      base: "melee", name: "白霜之王", move: "凛冬斩",
      note: "剑身凝霜后横斩一击：地面冻结，冰刺破土。",
      clips: { idle: "gs_admire", attack: "gs_power_slash", hurt: "gs_impact", victory: "gs_pose" }, aim: { attack: "foe" },
      attack: {
        before: {
          coil: { ms: 203, frame: 10, ease: "io" }, draw: { ms: 157, frame: 18, ease: "o" }, hold: { ms: 58, frame: 19, ease: "o" },
          strike: { ms: 162, frame: 23, ease: "i3" },
        },
        after: { follow: { ms: 100, frame: 26, ease: "o" }, settle: { ms: 200, frame: 29, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 261, reach: 0.45 }, hitstop: [3, 5, 7],
      },
      fx: {
        palette: "frost", charge: { sigil: "rune", motes: "snow" },
        hit: { beam: false, ground: "frost", spikes: "ice", bits: "shard", bits2: "snow" }, hurt: { at: "body" }, victory: { rain: "snow" },
        idle: { bits: "snow", every: 500 },
      },
    },
    // the dark-moon reaper: prowling guard, a low reaping sweep in both hands, the scythe raised to the sky 月蚀收割: a
    // long low reap under a dark moon; the crescent it leaves, the victim's life drawn back into him in wisps
    reaper: {
      base: "melee", name: "黯月收割者", move: "月蚀收割",
      note: "低身横扫留下暗月印记，魂火被抽回自身（吸血）。",
      clips: { idle: "gs_look", attack: "gs_low", hurt: "gs_impact", victory: "vc_raise_hand" }, aim: { idle: "up", attack: "foe", victory: "raised" },
      attack: {
        before: { coil: { ms: 270, frame: 12, ease: "io" }, hold: { ms: 65, frame: 13, ease: "o" }, strike: { ms: 205, frame: 27.5, ease: "i3" } },
        after: { follow: { ms: 120, frame: 31, ease: "o" }, settle: { ms: 220, frame: 36, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 270, reach: 0.5 }, hitstop: [3, 5, 7], bladeFrom: 0.6,
      },
      fx: {
        palette: "moon", charge: { sigil: "moon" }, weapon: { trail: { inner: 0.55 } },
        hit: { mark: "crescent", beam: false, ground: "void", bits: "wisp", drain: true }, hurt: { at: "body" },
        victory: { ray: false, orb: "moon", rain: "wisp" }, idle: { bits: "wisp", every: 600 },
      },
    },
    // sword and shield: the squire cheers with his sword up; the sun-chaser swift and bright; the rookie pumps his
    // fist with the sword high; the moon knight stands tall behind his shield, strikes without leaving the ground,
    // salutes 晨曦斩: a squire's clean overhead cut behind a raised shield, the dawn's light on the blade
    squire: {
      base: "melee", name: "晨曦侍从", move: "晨曦斩",
      note: "盾后蓄势，一记干净的下劈，刀身映着晨光。",
      clips: { idle: "ss_idle", attack: "ss_high_attack", hurt: "ss_impact", victory: "mg_cheer" }, aim: { victory: "raised" },
      attack: {
        before: { coil: { ms: 253, frame: 13, ease: "io" }, hold: { ms: 51, frame: 14, ease: "o" }, strike: { ms: 156, frame: 18, ease: "i3" } },
        after: { follow: { ms: 100, frame: 21, ease: "o" }, settle: { ms: 240, frame: 28, ease: "io" }, rise: { ms: 280 }, home: { ms: 280 } },
        dash: { kind: "lunge", ms: 230, reach: 0.4 }, hitstop: [3, 4, 6],
      },
      fx: {
        palette: "holy", size: 0.85, charge: { sigil: "sun" }, hit: { beam: false }, hurt: { at: "shield" }, victory: { rain: "sparkle" },
        idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    // the assassin: knife in a reverse grip, a stab from the rear hand, then the blade sheathed 影袭: she sinks into
    // shadow, poised, darts in and stabs — a crimson line across the foe, smoke where she was
    assassin: {
      base: "melee", name: "夜幕刺客", move: "影袭",
      note: "隐入烟影，一闪而至：两记快刺，再从后手补上致命一刺，留下一道血线。",
      // (a sheath hangs at her left hip — body.carry — where the victory clip puts the knife away)
      clips: { idle: "kn_idle", attack: "ch_stabs", hurt: "mu_hit", victory: "kn_sheath" }, body: { carry: "sheath" },
      attack: {
        before: {
          sink: { ms: 100, frame: 6, ease: "o" }, stab: { ms: 80, frame: 13, ease: "i2", hit: 0.5, label: "第一刺" }, draw: { ms: 80, frame: 22, ease: "io" },
          again: { ms: 80, frame: 29, ease: "i2", hit: 0.5, label: "第二刺" }, poise: { ms: 80, frame: 36, ease: "io" }, strike: { ms: 80, frame: 40, ease: "i3" },
        },
        after: { follow: { ms: 100, frame: 44, ease: "o" }, settle: { ms: 200, frame: 52, ease: "io" }, rise: { ms: 260 }, home: { ms: 260 } },
        dash: { kind: "lunge", ms: 450, arrive: 330, reach: 0.18 }, hitstop: [3, 4, 6],
      },

      fx: {
        palette: "shadow", charge: { sigil: false, vanish: true }, weapon: { trail: { from: 0.7, inner: 0.3 } },
        hit: { beam: false, bits: "wisp", bitsCount: 5 }, hurt: { at: "body" }, victory: { ray: false, rain: "wisp" },
        idle: { bits: "wisp", every: 1100, halo: false },
      },
    },
    // the red-rock berserker: crouched and restless, an overhead chop, a battle cry 狂怒劈斩: the axe hauled up with a
    // roar and brought down; the rock splits red-hot, stones jump
    berserker: {
      base: "melee", name: "赤岩狂战士", move: "狂怒劈斩",
      note: "正手一斧、反手一斧，再怒吼举斧砸下——岩石炽红开裂、碎石飞起。",
      clips: { idle: "ax_crouch", attack: "mc_two", hurt: "ax_gut", victory: "ax_battlecry" },
      attack: {
        start: 14,
        before: {
          coil: { ms: 120, frame: 20, ease: "io" }, chop: { ms: 90, frame: 29, ease: "i2", hit: 0.5, label: "第一斧" }, swing: { ms: 110, frame: 42, ease: "io" },
          back: { ms: 90, frame: 51, ease: "i2", hit: 0.6, label: "反手斧" }, heave: { ms: 150, frame: 70, ease: "io", label: "举斧" }, strike: { ms: 110, frame: 80, ease: "i3" },
        },
        after: { follow: { ms: 110, frame: 84, ease: "o" }, settle: { ms: 240, frame: 96, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 610, arrive: 470, reach: 0.33, recoil: 0.2 }, hitstop: [4, 6, 8],
      },

      fx: {
        palette: "rage", charge: { sigil: false }, hit: { beam: false, ground: "crack", rocks: 5, shake: 1.3 }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle", shock: true }, idle: { bits: "sparkle", every: 700, halo: false },
      },
    },
    // the ember-wing scout: a fighter's bounce, a flying kick, a boxer's win 烬翼飞踢: a leaping kick trailing embers; it
    // lands in a burst of flame
    sentinel: {
      base: "melee", name: "烬翼斥候", move: "烬翼飞踢",
      note: "腾空飞踢拖着余烬，落点爆出火焰。",
      clips: { idle: "fi_bounce", attack: "kk_bicycle", hurt: "mu_hit", victory: "vc_boxing" },
      attack: {
        before: { coil: { ms: 276, frame: 5, ease: "io" }, hold: { ms: 46, frame: 5.5, ease: "o" }, strike: { ms: 138, frame: 8, ease: "i3" } },
        after: { follow: { ms: 100, frame: 12, ease: "o" }, settle: { ms: 150, frame: 19, ease: "io" }, rise: { ms: 190 }, home: { ms: 260 } },
        dash: { kind: "leap", ms: 253, reach: 0.38 }, hitstop: [3, 5, 6],
      },
      fx: {
        palette: "ember", size: 0.85, charge: { sigil: false }, weapon: { limb: ["RightLeg", "RightToeBase"], trail: { from: 0.55, inner: 0.2 } },
        hit: { mark: false, beam: false, ground: "crack", flame: true }, hurt: { at: "body" }, victory: { ray: false, flame: true },
        idle: { bits: "sparkle", every: 600, halo: false },
      },
    },
    // 古木鞭挞: the old tree draws its branch-arm back and lashes; roots split the ground, thorns spring up, leaves fall
    treant: {
      base: "melee", name: "古木守护者", move: "古木鞭挞",
      note: "枝臂后拉再抽出，根须裂地、荆棘破土、落叶纷飞。",
      clips: { idle: "mu_idle", attack: "zb_swipe", hurt: "mu_hit", victory: "mu_roar" }, speed: 0.9, body: { lower: ["attack"] },
      attack: {
        before: { coil: { ms: 224, frame: 13, ease: "io" }, draw: { ms: 146, frame: 26, ease: "o" }, strike: { ms: 190, frame: 31, ease: "i3" } },
        after: { follow: { ms: 150, frame: 36, ease: "o" }, settle: { ms: 270, frame: 42, ease: "io" }, rise: { ms: 350 }, home: { ms: 350 } },
        dash: { kind: "lunge", ms: 280, reach: 0.4 }, hitstop: [4, 6, 8],
      },
      fx: {
        palette: "verdant", size: 1.1, charge: { sigil: "leaf" },
        weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.7, inner: 0.2 } },
        hit: { beam: false, ground: "roots", spikes: "thorn", bits: "leaf", shake: 1.2 }, hurt: { at: "body" },
        victory: { ray: false, rain: "leaf" }, idle: { bits: "leaf", every: 800, halo: false },
      },
    },
    // 山崩: the mountain crouches, heaves itself into the air and comes down fists first — the ground breaks, stone
    // spikes burst up, boulders fly, the dust rolls out; a long hold on the blow
    colossus: {
      base: "melee", name: "远古山岳", move: "山崩",
      note: "下蹲、腾空、双拳砸地：岩刺破土、碎石飞溅、尘浪滚开。",
      clips: { idle: "mu_idle", attack: "mu_jump_attack", hurt: "mu_hit", victory: "mu_roar" }, speed: 0.8,
      attack: {
        before: {
          crouch: { ms: 175, frame: 12, ease: "io" }, hold: { ms: 56, frame: 13.5, ease: "o" }, heave: { ms: 245, frame: 29, ease: "o" },
          hang: { ms: 56, frame: 32, ease: "l" }, strike: { ms: 168, frame: 50, ease: "i3" },
        },
        after: { follow: { ms: 150, frame: 55, ease: "o" }, settle: { ms: 300, frame: 66, ease: "io" }, rise: { ms: 450 }, home: { ms: 400 } },
        dash: { kind: "leap", ms: 469, reach: 0.36, hipScale: 0.35 }, hitstop: [5, 7, 9],
      },
      fx: {
        palette: "earth", size: 1.3, charge: { sigil: "rune" }, weapon: { glow: false, trail: false },
        hit: { mark: false, beam: false, ground: "crack", spikes: "rock", rocks: 10, dust: 2, shake: 1.8 }, hurt: { at: "body" },
        victory: { ray: false, rain: "rock", shock: true }, idle: { bits: "sparkle", every: 900, halo: false },
      },
      plain: { lower: ["attack"] },
    },
    // ---- 剑盾劈砍（swordShield）
    // 新兵劈砍: the rookie's eager chop, a flash of first light
    recruit: {
      base: "swordShield", name: "曙光新兵", move: "新兵劈砍",
      note: "新兵的全力一劈，闪过一点曙光。",
      clips: { idle: "ss_look", hurt: "ss_impact" }, aim: { victory: "raised" },
      attack: { dash: { reach: 0.48 } },
      fx: { palette: "dawn" },
    },
    // 星盾镇击: the lamp-keeper gathers starlight behind his shield and brings the blade down; a star sigil is struck
    // into the ground, stars scatter; blows ring off his star shield
    moonguard: {
      base: "swordShield", name: "守灯巨兽", move: "星盾镇击",
      note: "沉身蓄势，整面塔盾举起砸上去，星印刻进地面。",
      clips: { idle: "st_axe", attack: "sa_v3", hurt: "ss_blocked", victory: "gs_pose" }, speed: 0.92,
      attack: {
        start: 3,
        before: { _replace: true, coil: { ms: 330, frame: 12, ease: "io" }, hold: { ms: 80, frame: 13.5, ease: "o" }, strike: { ms: 150, frame: 23, ease: "i3" } },
        after: { _replace: true, follow: { ms: 120, frame: 27, ease: "o" }, settle: { ms: 240, frame: 38, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { ms: 280, reach: 0.24 }, hitstop: [4, 6, 8],
      },


      fx: {
        palette: "star", size: null, charge: { sigil: "star" }, hit: { beam: null, ground: "rune", bits: "star", shake: 1.2 },
        victory: { orb: "star", rain: "star" }, idle: { every: null, halo: null },
      },
      plain: { attack: "ss_power" },
    },
    // 冻盾: three thousand years in the ice with his shield on his arm. He drives the frozen shield into his foe and
    // follows it with his fist; ice breaks out of the ground where the blow lands
    rootkeeper: {
      base: "melee", name: "守根人", move: "冻盾",
      note: "沉肩蓄力，一记重击砸上去——落点冰晶破土、地面结霜。",
      clips: { idle: "ss_idle", attack: "hv_bash", hurt: "ss_blocked", victory: "gs_pose" }, speed: 0.92, body: { fists: "Right" },
      attack: {
        start: 20,
        before: { coil: { ms: 300, frame: 33, ease: "io" }, hold: { ms: 70, frame: 35, ease: "o" }, strike: { ms: 140, frame: 44, ease: "i3" } },
        after: { follow: { ms: 120, frame: 50, ease: "o" }, settle: { ms: 260, frame: 64, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 260, reach: 0.2 }, hitstop: [4, 6, 8],
      },

      fx: {
        palette: "frost", charge: { sigil: false, motes: "snow" }, weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.7, inner: 0.2 } },
        hit: { mark: false, beam: false, ground: "frost", spikes: { kind: "ice", size: 0.8 }, bits: "shard", bits2: "snow", shake: 1.2 }, hurt: { at: "shield" },
        victory: { ray: false, rain: "snow" }, idle: { bits: "snow", every: 700, halo: false },
      },
    },

    // 镐: a miner's own tool (body.carry: a pick in her fist). She swings it flat across, hauls it up over her shoulder
    // and brings the point down
    redscarf: {
      base: "melee", name: "红围巾", move: "镐",
      note: "矿镐抡过头顶，镐尖朝下一记砸落——火星与碎石。",
      clips: { idle: "ax_look", attack: "ax_down", hurt: "ax_gut", victory: "ax_battlecry" }, speed: 0.95, body: { fists: "Right", carry: "pick" },
      attack: {
        before: { coil: { ms: 290, frame: 17, ease: "io" }, hold: { ms: 60, frame: 18.5, ease: "o" }, strike: { ms: 170, frame: 26.5, ease: "i3" } },
        after: { follow: { ms: 120, frame: 28.5, ease: "o" }, settle: { ms: 220, frame: 34, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 286, reach: 0.26 }, hitstop: [4, 6, 8],
      },

      fx: {
        palette: "ember", size: 0.9, charge: { sigil: false }, weapon: { glow: false, trail: { from: 0.2, inner: 0.55 } },
        hit: { mark: "pierce", beam: false, ground: { kind: "crack", size: 0.7 }, rocks: 4, dust: 1.4, shake: 1.2 }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 1100, halo: false },
      },
    },

    // 马步冲拳 (a coded move: pc_horse_punch): she steps in and sinks into the horse stance, both fists drawn back to the
    // waist, and drives the right one straight out; the fist comes back, she rises
    ada: {
      base: "melee", name: "艾达", move: "马步冲拳",
      note: "进步沉入马步，双拳收在腰间，左拳先探、右拳直线冲出；收拳、起身。",
      clips: { idle: "st_idle2", attack: "pc_horse_punch", hurt: "ss_impact", victory: "vc_pump" }, body: { fists: "both" },
      attack: {
        before: { sink: { ms: 280, frame: 10, ease: "io", label: "沉马步" }, left: { ms: 100, frame: 13.5, ease: "i2", hit: 0.5, label: "左拳" }, strike: { ms: 130, frame: 18, ease: "i3", label: "右冲拳" } },
        after: { follow: { ms: 150, frame: 22, ease: "o" }, settle: { ms: 230, frame: 30, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 440, arrive: 240, reach: 0.25 }, hitstop: [4, 5, 7],
      },

      fx: {
        palette: "ember", charge: { sigil: false }, weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.72, inner: 0.2 } },
        hit: { mark: false, beam: false, shake: 1.2 }, hurt: { at: "body" }, victory: { ray: false }, idle: { bits: "sparkle", every: 1100, halo: false },
      },
    },
    // 琥珀拳: half of him is amber already. Four straight punches, left and right, faster than a man should be —
    // amber splinters off him with each
    amberbody: {
      base: "melee", name: "琥珀之躯", move: "琥珀连拳",
      note: "左右左右四记直拳，快得不像人——每一拳都从身上崩下琥珀碎片。",
      clips: { idle: "st_idle", attack: "bx_combo", hurt: "ss_impact", victory: "vc_pump" }, body: { fists: "both" },
      attack: {
        start: 9,
        before: {
          coil: { ms: 150, frame: 13, ease: "io" }, one: { ms: 70, frame: 17.5, ease: "i2", hit: 0.4, label: "一" }, two: { ms: 100, frame: 24.5, ease: "o", hit: 0.4, label: "二" },
          three: { ms: 100, frame: 31.5, ease: "o", hit: 0.5, label: "三" }, strike: { ms: 110, frame: 38.5, ease: "i2", label: "四" },
        },
        after: { follow: { ms: 100, frame: 43, ease: "o" }, settle: { ms: 240, frame: 56, ease: "io" }, rise: { ms: 280 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 470, arrive: 310, reach: 0.24 }, hitstop: [3, 5, 7],
      },
      fx: {
        palette: "amber", charge: { sigil: false }, weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.3, inner: 0.2 } },
        hit: { mark: false, beam: false, bits: "shard", bitsCount: 6, shake: 1.1 }, hurt: { at: "body" }, victory: { ray: false, rain: "sparkle" },
        idle: { bits: "sparkle", every: 1000, halo: false },
      },
    },

    // ---- 十字斩（crossSlash）
    // 逐日十字斩: in on the foe in two strokes — the second one fast and burning — a cross of sunfire left on it, a flare
    // of flame, the ground scorched
    solaris: {
      base: "crossSlash", name: "逐日者·索拉", move: "逐日十字斩",
      note: "两段斩击冲上前，第二刀带火，在敌人身上留下日炎十字。",
      clips: { victory: "vc_raise_hand" }, aim: { attack: "foe", victory: "raised" },
      fx: { palette: "sun" },
    },
    frederia: {
      base: "crossSlash", name: "菲德莉亚",
      clips: { attack: "os_combo", victory: "vc_pump" }, move: "老兵三连",
      note: "不花哨的三刀：横斩、反手、当头一劈——一个打过太多仗的人的打法。",
      attack: {
        start: 14,
        before: { _replace: true, coil: { ms: 110, frame: 23, ease: "io" }, cut: { ms: 80, frame: 31, ease: "i2", hit: 0.5, label: "横斩" }, turn: { ms: 110, frame: 50, ease: "io" }, back: { ms: 80, frame: 60, ease: "i2", hit: 0.6, label: "反手" }, raise: { ms: 120, frame: 80, ease: "io" }, strike: { ms: 100, frame: 91, ease: "i3" } },
        after: { _replace: true, follow: { ms: 100, frame: 96, ease: "o" }, settle: { ms: 220, frame: 110, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { ms: 540, arrive: 420 },
      },
      // (her triumph is a pumped fist, the sword low: no ray of light comes down onto its point)
      fx: { palette: "steel", charge: { sigil: false }, hit: { mark: "line", ground: false, flame: false }, victory: { ray: false, orb: false }, idle: { halo: false, every: 1200 } },
    },
    // ---- 长枪突刺（spear）
    // spears: upright at rest and on victory, driven point-first at the foe 铁誓突刺: the iron-sworn guard's disciplined
    // thrust, steel ringing
    guard: {
      base: "spear", name: "铁誓卫士", move: "铁誓突刺",
      note: "稳步突刺，钢光一闪，受击时举盾格挡。",
      clips: { idle: "st_axe", hurt: "ss_blocked", victory: "vc_raise_hand" }, aim: { victory: "raised" },
      attack: { before: { coil: { ms: 240 }, hold: { ms: 48 }, strike: { ms: 192 } }, dash: { ms: 264 }, hitstop: [3, 5, 6] },
      fx: { palette: "steel", hurt: { at: "shield" }, victory: { ray: null, rain: "sparkle" }, idle: { bits: "sparkle", every: 900 } },
    },
    // 穿林突刺: she charges and drives the spear through — a streak of wind out the far side, leaves torn loose
    huntress: {
      base: "spear", name: "荒野之矛", move: "穿林突刺",
      note: "冲锋突刺，长矛贯穿带出风痕与落叶。",
      clips: { idle: "ax_look", hurt: "bw_hit_front", victory: "ax_battlecry" },
      attack: { before: { coil: { ms: 230 }, hold: { ms: 46 }, strike: { ms: 184 } }, dash: { ms: 253 } },
      fx: { palette: "wild", charge: { sigil: "leaf" }, hit: { bits: "leaf" }, victory: { rain: "leaf" }, idle: { bits: "leaf", every: 700 } },
    },
    // 骸骨突刺: a lurching jab in a haze of grave-light, bone chips flying
    skeleton: {
      base: "spear", name: "骸骨", move: "骸骨突刺",
      note: "跌撞着一刺，墓光与骨屑飞散。",
      clips: { idle: "zb_idle", attack: "za_v2", hurt: "zb_stumble", victory: "zb_alert" },
      attack: {
        start: 6,
        before: { _replace: true, coil: { ms: 250, frame: 20, ease: "io", label: "踉跄" }, hold: { ms: 50, frame: 21, ease: "o" }, strike: { ms: 140, frame: 31, ease: "i3" } },
        after: { _replace: true, follow: { ms: 110, frame: 35, ease: "o" }, settle: { ms: 220, frame: 46, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { ms: 250 },
      },
      fx: { palette: "bone", hit: { bits: "shard", bitsCount: 5 }, victory: { rain: "wisp" }, idle: { bits: "wisp", every: 800 } },
    },
    // ---- 重臂横扫（swipe）
    // stone, iron, bark and mountain: the golem swipes; the titan throws a straight cross and pounds his chest; the
    // treant lashes a branch-arm across, rooted; the mountain brings both fists down from overhead, slowly 符文横扫: the
    // runes on the stone wake one by one, a heavy swipe — the ground cracks blue, stones burst up
    golem: {
      base: "swipe", name: "符文石像", move: "符文横扫",
      note: "石上符文依次亮起，横扫一击，地面蓝光裂开。",
      clips: { idle: "mu_idle", victory: "mu_roar" },
      fx: { palette: "rune" },
    },
    // 点火 (a coded move: pc_ignite) — the Igniter does not run at anyone. A hand into his coat pocket and a handful of
    // amber dust sown at his foe in one wide sweep; it hangs in the air round it, glittering. He carries the hand on up
    // beside his head, still — and snaps his fingers: the spark runs through the dust and the cloud goes up round his foe
    nathan: {
      base: "caster", name: "点火者·纳坦", move: "点火",
      note: "探手入囊，一把琥珀粉尘横臂撒向敌人，悬在半空闪烁；手顺势抬到耳侧、定住——一个响指，火星沿粉尘窜过去，尘云在敌人身上连环爆燃。",
      clips: { idle: "st_idle", attack: "pc_ignite", victory: "pc_watch" },
      // (his fingers work: body.hands; the coded move turns him itself and keeps his eyes on his foe: face false; his
      // triumph — pc_watch — is a look at the watch that stopped when Eve died: body.carry)
      body: { face: false, hands: "both", castSide: "R", carry: "watch" }, spell: { tint: [1.3, 0.7, 0.2], gather: false },
      attack: {
        before: {
          dip: { ms: 250, frame: 9, ease: "io", label: "探囊" }, sow: { ms: 190, frame: 16, ease: "o", label: "撒尘" }, raise: { ms: 290, frame: 23, ease: "io", label: "抬手" },
          hold: { ms: 120, frame: 25, ease: "l" }, snap: { ms: 70, frame: 27, ease: "i3", label: "响指" },
        },
        after: { follow: { ms: 230, frame: 34, ease: "o" }, settle: { ms: 420, frame: 48, ease: "io" }, rise: { ms: 250 } },
      },
      fx: {
        palette: "hearth", charge: { sigil: false, dim: 0.3 }, weapon: { glow: false }, cast: { kind: "ignite", hand: "RightHandMiddle3", at: 0.38 },
        hit: { mark: false, beam: false, flash: 0.7, ground: { kind: "crack", size: 0.8 }, flame: { size: 1.25 }, dust: 1.6, shake: 1.5 }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    // 撬棍: a scavenger's crowbar (body.carry). Two short, mean swings and a third with his back in it
    gleaner: {
      base: "melee", name: "拾珀人", move: "撬棍",
      note: "撬棍左一下右一下，第三下抡圆了砸——拾荒的人不讲章法。",
      clips: { idle: "st_idle", attack: "cb_one", hurt: "mu_hit", victory: "vc_raise_hand" }, body: { fists: "Right", carry: "crowbar" },
      attack: {
        start: 10,
        before: {
          coil: { ms: 120, frame: 15, ease: "io" }, one: { ms: 90, frame: 22, ease: "i2", hit: 0.5, label: "一" }, back: { ms: 130, frame: 39.5, ease: "o", hit: 0.5, label: "二" },
          wind: { ms: 150, frame: 58, ease: "io" }, strike: { ms: 110, frame: 67, ease: "i3" },
        },
        after: { follow: { ms: 110, frame: 72, ease: "o" }, settle: { ms: 240, frame: 86, ease: "io" }, rise: { ms: 300 }, home: { ms: 300 } },
        dash: { kind: "lunge", ms: 540, arrive: 400, reach: 0.34 }, hitstop: [3, 5, 7],
      },
      fx: {
        palette: "iron", size: 0.9, charge: { sigil: false }, weapon: { glow: false, trail: { from: 0.15, inner: 0.5 } },
        hit: { mark: "line", beam: false, dust: 1.3 }, hurt: { at: "body" }, victory: { ray: false }, idle: { bits: "sparkle", every: 1300, halo: false },
      },
    },

    // 黑尘砸击: he stoops with a cough, hauls both fists up over his head and brings them down; black dust bursts out of
    // the blow, the ground breaks dark
    blacklung: {
      base: "melee", name: "黑肺", move: "黑尘砸击",
      note: "弓身一咳，双拳举过头顶砸下，黑色煤尘炸开。",
      clips: { idle: "st_idle", attack: "zb_overhead", hurt: "mu_hit", victory: "vc_raise_hand" },
      attack: {
        before: { stoop: { ms: 150, frame: 5, ease: "io", label: "一咳" }, coil: { ms: 250, frame: 21, ease: "io" }, hold: { ms: 60, frame: 25, ease: "o" }, strike: { ms: 140, frame: 32, ease: "i3" } },
        after: { follow: { ms: 120, frame: 34, ease: "o" }, settle: { ms: 220, frame: 38, ease: "io" }, rise: { ms: 340 }, home: { ms: 320 } },
        dash: { kind: "lunge", ms: 270, reach: 0.4 }, hitstop: [4, 6, 8],
      },
      fx: {
        palette: "coal", size: 1.05, charge: { sigil: false }, weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.72, inner: 0.2 } },
        hit: { mark: false, beam: false, flash: 0.5, ground: "crack", rocks: 4, dust: 2.6, shake: 1.3 }, hurt: { at: "body" },
        victory: { ray: false, rain: "rock" }, idle: { bits: "sparkle", every: 1200, halo: false },
      },
    },
    // ---- 重拳（punch）
    // 玄铁重拳: the iron titan winds up and throws a straight cross — sparks and a ringing shock
    titan: {
      base: "punch", name: "玄铁泰坦", move: "玄铁重拳",
      note: "蓄力一记直拳，火花四溅、冲击回荡。",
      clips: { idle: "mu_idle", victory: "ax_chest" }, speed: 0.9,
      fx: { palette: "iron" },
    },
    // 上勾拳 (motion capture: Mixamo's uppercut, left-handed, played mirrored): a step in, the knees give and the fist
    // drops, then it comes up the foe's centre line with the whole body behind it
    whistle: {
      base: "melee", name: "铁哨", move: "上勾拳",
      note: "垫步近身，屈膝沉拳，整个人顶上去的一记上勾拳。",
      clips: { idle: "st_idle", attack: "pu_uppercut@m", hurt: "mu_hit", victory: "vc_pump" }, body: { fists: "both" },
      attack: {
        before: { coil: { ms: 230, frame: 7, ease: "io", label: "垫步" }, sink: { ms: 110, frame: 11, ease: "o", label: "沉拳" }, strike: { ms: 130, frame: 14.5, ease: "i3" } },
        after: { follow: { ms: 130, frame: 18.5, ease: "o" }, settle: { ms: 250, frame: 27, ease: "io" }, rise: { ms: 300 }, home: { ms: 320 } },
        dash: { kind: "lunge", ms: 250, reach: 0.3 }, hitstop: [4, 6, 8],
      },
      fx: {
        palette: "steel", size: 1.05, charge: { sigil: false }, weapon: { glow: false, limb: ["RightForeArm", "RightHand"], trail: { from: 0.55, inner: 0.2 } },
        hit: { mark: false, beam: false, shake: 1.3 }, hurt: { at: "body" }, victory: { ray: false, shock: true }, idle: { bits: "sparkle", every: 1000, halo: false },
      },
    },
    // 镜影围击: two reflections of him step out as he winds up — mirror images, left for right — go round the foe with
    // him and strike as he strikes, from either side; on the blow they break like glass
    mirrorlegion: {
      base: "punch", name: "倒影军团", move: "镜影围击",
      note: "蓄势时身侧走出两个左右相反的倒影，三面合围同时出拳；命中后倒影如镜面碎裂。",
      body: { fists: "both" },
      attack: { before: { coil: { ms: 330 }, hold: { ms: 90 } }, dash: { ms: 270 } },
      fx: { palette: "glass", charge: { sigil: "moon", echo: 2 }, hit: { bits: "shard", bitsCount: 6 }, victory: { shock: null } },
    },
    // ---- 施法（caster）
    // the necromancer holds his lantern out before him, calls the dead up from the ground, and lifts the lantern high
    // 亡魂之手: the lantern (right) is held steady and burns brighter as the dead answer; his free hand calls down into
    // the ground — a circle opens under his foe and the dead rise out of it in a column
    necromancer: {
      base: "caster", name: "亡者织梦师", move: "亡魂之手",
      note: "右手提灯不动、灯火转绿变亮；空着的左手向下召唤，敌人脚下裂开冥环，亡魂成柱涌出。",
      clips: { idle: "mg_idle", attack: "mg_ground@m", victory: "vc_raise_hand" },
      body: { lower: ["attack"], keep: { attack: "Right" }, castSide: "L" }, spell: { tint: [0.35, 1.3, 0.7] },
      attack: {
        before: { gather: { ms: 537, frame: 26, ease: "io" }, hold: { ms: 95, frame: 28, ease: "o" }, release: { ms: 158, frame: 31, ease: "i3" } },
        after: { follow: { ms: 120, frame: 34, ease: "o" }, settle: { ms: 280, frame: 42, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "necro", charge: { sigil: "rune", lantern: true }, weapon: { glow: false }, cast: { kind: "ground", hand: "LeftHand" },
        hit: { mark: false, ground: "void", bits: "wisp" }, hurt: { at: "body" }, victory: { ray: false, rain: "wisp" },
        idle: { bits: "wisp", every: 600 },
      },
      plain: { attack: "mg_ground", keep: null, castSide: null, spell: { tint: [0.55, 0.2, 1.1] } },
    },
    // 星陨 (a coded move: pc_starfall) — a dancer's cast, her whole body in it: she gathers, wound away from her foe; unwinds
    // through a full turn as she rises, the scepter climbing round her and drawing a ribbon of starlight; hangs there,
    // arched, the scepter high; and brings it down to point — the stars fall where it points, needles of light, the
    // last of them on her foe
    nyx: {
      base: "caster", name: "星陨女王·妮克丝", move: "星陨",
      note: "蓄势侧身，旋身一周升空、权杖绕身划出星带；悬停展臂、权杖高举；一指落下——流星成阵斜坠，最后一颗正中敌人。",
      clips: { idle: "st_idle2", attack: "pc_starfall", victory: "vc_raise_hand_m" }, aim: { idle: "up", victory: "up" },
      // (the coded move turns her, lifts her and aims the scepter itself: face false, no levitate, no attack aim)
      body: { face: false, upright: ["victory"], float: 0.03 }, spell: { tint: [1.1, 0.45, 1.6], gather: false },
      attack: {
        before: {
          gather: { ms: 240, frame: 8, ease: "io", label: "蓄势" }, whirl: { ms: 340, frame: 20, ease: "io", label: "旋身升空" }, pose: { ms: 220, frame: 27, ease: "o", label: "悬停" },
          command: { ms: 110, frame: 31, ease: "i3", label: "一指" },
        },
        after: { follow: { ms: 200, frame: 37, ease: "o" }, settle: { ms: 520, frame: 60, ease: "io", label: "落地" }, rise: { ms: 250 } },
      },
      fx: {
        palette: "astral", charge: { sigil: false, dim: 0.5, stream: { count: 0.35, size: 0.8 } }, weapon: { glow: { gain: 0.5 }, trail: { from: 0.2, inner: 0.72 } },
        cast: { kind: "sky", count: 5, sigil: "astral" }, hit: { mark: false, beam: false, flash: 0.35, ground: "rune", bits: "star", bitsCount: 5, shake: 1.2, shock: { size: 0.8, gain: 0.7 } },
        hurt: { at: "body" }, victory: { ray: { size: 0.45, gain: 0.55 }, rain: "star" }, idle: { bits: "star5", every: 800, halo: false },
      },
    },
    // the blood-moon walker casts left-handed and exults, arms spread to the sky 血月汲取: a bolt of blood-moon light;
    // the wound's life runs back to her in red wisps
    leech: {
      base: "caster", name: "血月行者", move: "血月汲取",
      note: "一道血月光，伤口的生命化作红色魂丝回到她身上。",
      clips: { idle: "st_idle2", attack: "cs_one_m", victory: "pr_arms_up" }, body: { upright: ["attack"] }, spell: { tint: [1.5, 0.08, 0.15] },
      attack: {
        before: { gather: { ms: 521, frame: 22, ease: "io" }, hold: { ms: 95, frame: 23.5, ease: "o" }, release: { ms: 174, frame: 27, ease: "i3" } },
        after: { follow: { ms: 150, frame: 31, ease: "o" }, settle: { ms: 300, frame: 38, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "blood", charge: { sigil: "moon" }, weapon: { glow: false }, cast: { kind: "bolt" },
        hit: { mark: false, bits: "wisp", bitsCount: 5, drain: true }, hurt: { at: "body" }, victory: { ray: false, orb: "moon", rain: "wisp" },
        idle: { bits: "wisp", every: 700 },
      },
    },
    // the twilight sprite floats on her wings 暮光花雨: she whirls in the air, petals of light round her, and sends a
    // mote of dusk; it bursts in petals
    wisp: {
      base: "caster", name: "暮光精灵", move: "暮光花雨",
      note: "空中旋身，身边花光环绕，送出暮光，落点绽开花瓣。",
      clips: { idle: "mg_idle_m", attack: "cs_two_fwd", victory: "pr_arms_up" }, body: { hover: 0.3, spin: true }, spell: { tint: [0.45, 1.6, 0.8] },
      attack: {
        before: { gather: { ms: 504, frame: 24, ease: "io" }, hold: { ms: 118, frame: 26, ease: "o" }, release: { ms: 218, frame: 31, ease: "i3" } },
        after: { follow: { ms: 120, frame: 34, ease: "o" }, settle: { ms: 280, frame: 40, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "fey", charge: { sigil: "leaf" }, weapon: { glow: false }, cast: { kind: "bolt", count: 3, gap: 80 }, hit: { mark: false, bits: "leaf", bitsCount: 8 },
        hurt: { at: "body" }, victory: { ray: false, rain: "leaf" }, idle: { bits: "sparkle", every: 400 },
      },
    },
    // 根须缠绕: she was the one humanoid left without a signature (her blows fell back on the old pixel sparks). The
    // root mother gathers the green in both hands over the ground and sends it; roots split the ground under her foe
    // and thorns come up through it, leaves falling
    rootmother: {
      base: "caster", name: "根母", move: "根须缠绕",
      note: "双臂高举再猛按向地面——对手脚下根须裂地、荆棘破土，落叶纷飞。",
      clips: { idle: "mg_idle", attack: "mr_one", victory: "pr_arms_up" }, body: { upright: ["victory"], float: 0.03 },
      spell: { tint: [0.45, 1, 0.4], gather: false },
      attack: {
        start: 8,
        before: { gather: { ms: 420, frame: 26, ease: "io", label: "举臂" }, hold: { ms: 110, frame: 30, ease: "o" }, release: { ms: 170, frame: 38, ease: "i3", label: "按地" } },
        after: { follow: { ms: 140, frame: 43, ease: "o" }, settle: { ms: 320, frame: 60, ease: "io" }, rise: { ms: 400 } },
      },

      fx: {
        palette: "verdant", charge: { sigil: "leaf" }, weapon: { glow: false }, cast: { kind: "ground", sigil: "leaf" },
        hit: { mark: false, ground: "roots", spikes: "thorn", bits: "leaf" }, hurt: { at: "body" }, victory: { ray: false, rain: "leaf" },
        idle: { bits: "leaf", every: 800 },
      },
    },
    // ---- 掷出法术（throwCast）
    // 火花弹: the apprentice feeds the fire between his hands until it roars and throws it level from the chest, his
    // eyes on his foe — it flies straight, bursts and scorches
    spark: {
      base: "throwCast", name: "引火学徒", move: "火花弹",
      note: "双手把火喂到咆哮，从胸前平掷出去——火球笔直飞向敌人，落点爆燃灼地。",
      clips: { attack: "mg_blast", victory: "mg_cheer" }, spell: { fire: true },
      attack: {
        before: { gather: { ms: 520, frame: 21, ease: "io" }, hold: { ms: 110, frame: 25.5, ease: "o" }, release: { ms: 160, frame: 30, ease: "i3" } },
        after: { follow: { ms: 150, frame: 33, ease: "o" }, settle: { ms: 400, frame: 46, ease: "io" }, rise: { ms: 350 } },
      },
      fx: { palette: "fire" },
    },
    // ---- 各有各的法子（each its own way: what the figure is and what it carries decides the move — 2026-10-02）
    // 咒文: he reads from the book open in his left hand, his right hand over the page — the words lift off it — and
    // sends them: a line of letters that strikes one after another
    translator: {
      base: "caster", name: "译者", move: "咒文",
      note: "左手托着摊开的书，右手拂过书页，文字离纸升起；一挥，字符连成一串打向敌人。",
      clips: { idle: "st_idle", attack: "mg_conjure_throw", victory: "vc_raise_hand" }, body: { lower: ["attack"], carry: "book" },
      spell: { tint: [0.95, 0.75, 0.4], gather: false },
      attack: {
        before: { gather: { ms: 560, frame: 28, ease: "io" }, hold: { ms: 110, frame: 36, ease: "o" }, release: { ms: 170, frame: 46, ease: "i3" } },
        after: { follow: { ms: 150, frame: 52, ease: "o" }, settle: { ms: 300, frame: 60, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "amber", size: 0.9, charge: { sigil: "rune" }, weapon: { glow: false }, cast: { kind: "stream", hand: "book", bits: "glyph", count: 8 },
        hit: { mark: false, beam: false, flash: 0.6, ground: "rune", bits: "glyph", bitsCount: 6 }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    // 引信: she crouches and puts a flame to the cord she has run out along the ground; the spark runs down it,
    // spitting, and the charge goes up under her foe
    fuse: {
      base: "caster", name: "引信", move: "引信",
      note: "导火索沿地面铺到敌人脚下；她蹲身点火，火星嘶嘶窜过去，在敌人脚下炸开。",
      clips: { idle: "mg_idle", attack: "mg_ground", victory: "vc_pump" }, spell: { tint: [1.2, 0.6, 0.15], gather: false },
      attack: {
        before: { gather: { ms: 430, frame: 26, ease: "io", label: "蹲身" }, hold: { ms: 150, frame: 29, ease: "o", label: "点火" }, release: { ms: 300, frame: 33, ease: "io", label: "火星窜出" } },
        after: { follow: { ms: 140, frame: 36, ease: "o" }, settle: { ms: 260, frame: 42, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "fire", size: 0.95, charge: { sigil: false }, weapon: { glow: false }, cast: { kind: "fuse", at: 0.62 },
        hit: { mark: false, beam: false, ground: "crack", rocks: 5, dust: 1.6, shake: 1.5, flame: { size: 1.7 } }, hurt: { at: "body" },
        victory: { ray: false, flame: true }, idle: { bits: "sparkle", every: 700, halo: false },
      },
    },
    // 停摆: he lets his watch hang from his fingers and winds it — a clock face opens under his foe, its hands racing
    // round — and snaps it shut as they reach twelve: the blow lands, gears fly
    clockmaker: {
      base: "caster", name: "钟表匠", move: "停摆",
      note: "垂下怀表上弦，敌人脚下展开钟面、指针飞转；合上表盖的一刻指针归零，齿轮迸飞。",
      clips: { idle: "st_idle2", attack: "cs_summon", victory: "vc_raise_hand" }, body: { lower: ["attack"] }, spell: { tint: [1, 0.8, 0.4], gather: false },
      attack: {
        before: { gather: { ms: 520, frame: 15, ease: "io", label: "上弦" }, hold: { ms: 130, frame: 19, ease: "o" }, release: { ms: 170, frame: 26, ease: "i3" } },
        after: { follow: { ms: 140, frame: 30, ease: "o" }, settle: { ms: 300, frame: 38, ease: "io", label: "合表" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "brass", charge: { sigil: "clock" }, weapon: { glow: false }, cast: { kind: "ground", sigil: "clock" },
        hit: { mark: false, beam: false, flash: 0.6, bits: "gear", bitsCount: 7, shake: 1.2 }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 800, halo: false },
      },
    },
    // 摘星: the astrolabe stays carried at her side (lifting it one-handed read as wrong); her free hand dips to it,
    // draws a star off its face and tosses it up — it arcs over and falls on her foe
    oracle: {
      base: "caster", name: "星界观测者", move: "摘星",
      note: "星盘始终提在身侧；空着的右手探向盘面摘下一颗星，向上一抛，星划弧坠向敌人，落点亮起星印。",
      clips: { idle: "st_look", attack: "cs_upwards", victory: "vc_raise_hand" }, body: { lower: ["attack"], keep: { attack: "Left" }, castSide: "R" },
      spell: { tint: [0.6, 0.8, 1.7], gather: false },
      attack: {
        before: { gather: { ms: 440, frame: 15, ease: "io" }, hold: { ms: 190, frame: 18.5, ease: "o", label: "探向星盘" }, release: { ms: 180, frame: 24, ease: "i3", label: "抛星" } },
        after: { follow: { ms: 150, frame: 28, ease: "o" }, settle: { ms: 300, frame: 32, ease: "io" }, rise: { ms: 420 } },
      },
      fx: {
        palette: "star", charge: { sigil: "star", lantern: true }, weapon: { glow: false }, cast: { kind: "lob", hand: "held" },
        hit: { mark: false, beam: false, ground: "rune", bits: "star", bitsCount: 5 }, hurt: { at: "body" },
        victory: { ray: false, orb: "star", rain: "star" }, idle: { bits: "star5", every: 700 },
      },
    },
    // the amber story's heroes and bosses (content/portraits.js)
    // 聚光: she raises her loupe into her line of sight to the foe (a coded move: pc_loupe); light gathers in the lens,
    // a thin line finds the mark, and on the release it burns — a ray through the glass
    nahira: {
      base: "caster", name: "娜希拉", move: "聚光",
      note: "举起放大镜对准敌人，光在镜片里聚成一点，一线光先找准落点，随后化作灼热的光束烧过去。",
      clips: { idle: "st_look", attack: "pc_loupe", victory: "vc_raise_hand" }, spell: { tint: [1.2, 0.75, 0.3], gather: false },
      attack: {
        before: { gather: { ms: 380, frame: 11, ease: "io", label: "举镜" }, hold: { ms: 330, frame: 14, ease: "l", label: "聚光" }, release: { ms: 110, frame: 18, ease: "o" } },
        after: { follow: { ms: 260, frame: 25, ease: "l", label: "灼烧" }, settle: { ms: 300, frame: 36, ease: "io", label: "放下" }, rise: { ms: 300 } },
      },
      fx: {
        palette: "amber", charge: { sigil: "sun" }, weapon: { glow: false }, cast: { kind: "ray", hand: "held" },
        hit: { mark: false, beam: false, flash: 0.5, flame: { size: 0.7 } }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 800, halo: false },
      },
    },
    // 估价: he sizes his foe up at arm's length — a reticle closes on its weak point — draws the hand back and jabs a
    // finger at it: what the mark found breaks
    appraiser: {
      base: "caster", name: "估价人", move: "估价",
      note: "伸臂比量敌人，准星一圈圈收拢到破绽上；收手，一指点出——被看准的地方应声碎裂。",
      clips: { idle: "st_idle2", attack: "cs_one", victory: "vc_raise_hand" }, body: { lower: ["attack"] }, spell: { tint: [1, 0.85, 0.3], gather: false },
      attack: {
        before: { gather: { ms: 420, frame: 15, ease: "io", label: "比量" }, hold: { ms: 250, frame: 26, ease: "io", label: "收手" }, release: { ms: 150, frame: 33, ease: "i3", label: "一指" } },
        after: { follow: { ms: 150, frame: 37, ease: "o" }, settle: { ms: 300, frame: 42, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "amber", charge: { sigil: false }, weapon: { glow: false }, cast: { kind: "mark", hand: "RightHand" },
        hit: { mark: "cross", beam: false, flash: 0.6, bits: "shard", bitsCount: 8 }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    // 死当: the pawnbroker flicks a ticket at his foe — it sticks — and what it is worth runs back to him in gold
    pawnbroker: {
      base: "caster", name: "典当人", move: "死当",
      note: "扬手甩出一张当票贴在敌人身上；票一贴上，它的“价值”化作金光流回他手里。",
      clips: { idle: "st_idle2", attack: "mg_cast_forward", victory: "vc_raise_hand" }, body: { lower: ["attack"] }, spell: { tint: [1, 0.8, 0.3], gather: false },
      attack: {
        before: { gather: { ms: 440, frame: 20, ease: "io" }, hold: { ms: 110, frame: 23.5, ease: "o" }, release: { ms: 150, frame: 28.5, ease: "i3" } },
        after: { follow: { ms: 150, frame: 32, ease: "o" }, settle: { ms: 300, frame: 38, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "amber", size: 0.9, charge: { sigil: false }, weapon: { glow: false }, cast: { kind: "stream", hand: "RightHand", bits: "tag", count: 1 },
        hit: { mark: false, beam: false, flash: 0.5, bits: "sparkle", drain: true }, hurt: { at: "body" },
        victory: { ray: false, rain: "sparkle" }, idle: { bits: "sparkle", every: 900, halo: false },
      },
    },
    // ---- 提灯施法（lanternCast）
    // 渡魂之光: the ferryman holds his lantern out as the souls' light gathers in it, draws it back and thrusts it at
    // his foe — the light leaves the lantern itself
    soulguide: {
      base: "lanternCast", name: "渡魂引路人", move: "渡魂之光",
      note: "提灯前举，魂光在灯里聚亮；收回，再向前一送——光从灯里直射出去。",
      spell: { tint: [0.45, 0.95, 1.4] },
      attack: {
        before: { gather: { ms: 430, frame: 19, ease: "io", label: "举灯" }, hold: { ms: 200, frame: 26, ease: "io", label: "收灯" }, release: { ms: 160, frame: 33, ease: "i3", label: "送出" } },
        after: { follow: { ms: 150, frame: 37, ease: "o" }, settle: { ms: 300, frame: 42, ease: "io" }, rise: { ms: 400 } },
      },
      fx: { palette: "soul" },
    },
    // 萤火引路: he lifts the lantern to arm's length and holds it there; the lights in it wake and pour out toward his
    // foe, one after another — no thrust: he lets them go
    liol: {
      base: "lanternCast", name: "利奥尔", move: "萤火引路",
      note: "把灯平举在身前、稳稳托住；灯里的萤火一只只飞出，绕着弧线扑向敌人。",
      spell: { tint: [0.95, 0.8, 0.45], gather: false },
      attack: {
        before: { gather: { ms: 360, frame: 7, ease: "io", label: "举灯" }, hold: { ms: 380, frame: 14, ease: "l", label: "放萤" }, release: { ms: 130, frame: 17, ease: "o" } },
        after: { follow: { ms: 200, frame: 20, ease: "l" }, settle: { ms: 300, frame: 26, ease: "io", label: "放下" }, rise: { ms: 400 } },
      },
      fx: { palette: "fey", cast: { kind: "stream", bits: "sparkle", count: 9 }, hit: { bits: "sparkle", flash: 0.6 }, victory: { rain: "sparkle" }, idle: { bits: "sparkle" } },
    },
    // ---- 祷告施法（prayerCast）
    // 曙光圣击: a prayer gathered in both hands and sent; light comes down where it strikes, feathers of it
    cleric: {
      base: "prayerCast", name: "曙光祭司", move: "曙光圣击",
      note: "双手捧起祷光送出，落点降下圣光与光羽。",
      clips: { idle: "pr_sway", victory: "mg_heal" }, body: { upright: ["attack", "victory"] }, spell: { tint: [1.5, 1.15, 0.45] },
      fx: { palette: "holy" },
    },
    // 黑花: she holds her cupped hands before her as if round the pot, and opens them toward her foe — black petals
    // lift off and go on the air, turning; they settle on it and fall
    eve: {
      base: "caster", name: "伊芙", move: "黑花",
      note: "双手像捧着花盆一样拢在身前，向敌人轻轻一送；黑色花瓣离手飘旋而去，落在敌人身上。",
      clips: { idle: "st_idle2", attack: "cs_wide", victory: "pr_arms_up" }, body: { lower: ["attack"] }, spell: { tint: [0.55, 0.4, 0.7], gather: false },
      attack: {
        start: 104,
        before: { gather: { ms: 460, frame: 92, ease: "io", label: "捧花" }, hold: { ms: 140, frame: 88, ease: "o" }, release: { ms: 240, frame: 68, ease: "io", label: "送出" } },
        after: { follow: { ms: 220, frame: 58, ease: "o" }, settle: { ms: 300, frame: 50, ease: "io" }, rise: { ms: 450 } },
      },
      fx: {
        palette: "nightbloom", charge: { sigil: "leaf" }, weapon: { glow: false }, cast: { kind: "stream", hand: "RightHand", bits: "petal", count: 10 },
        hit: { mark: false, beam: false, flash: 0.4, bits: "petal", bitsCount: 9 }, hurt: { at: "body" },
        victory: { ray: false, rain: "leaf" }, idle: { bits: "sparkle", every: 900 },
      },
    },
    // ---- 弓手（archer）
    // the archer: the bow held ready, drawn to the cheek facing the foe, loosed 逐风之矢: wind gathers on the drawn
    // arrow; it leaves with a crack and runs the foe through
    vesper: {
      base: "archer", name: "薇丝珀", move: "逐风之矢",
      note: "拉弓聚风，一箭贯穿，落叶翻飞。",
      fx: { palette: "wild" },
    },
    // 穿心箭: a hunter's one arrow — drawn long and held until it is sure, loosed, the bow hand still
    rowan: {
      base: "archer", name: "罗温", move: "穿心箭",
      note: "猎人只放一箭：拉满、屏息、稳住，一箭穿心。",
      attack: { before: { pull: { ms: 340 }, hold: { ms: 150 }, loose: { ms: 60 } }, after: { follow: { ms: 260 } } },
      fx: { palette: "verdant", charge: { sigil: false }, hit: { bits: "leaf", bitsCount: 3, shake: 1.3 }, idle: { halo: false } },
    },
    // ---- 神（god）
    // the sun god: his sun blade planted point-down before him; he leaps up with it overhead — kept on his feet, a
    // god's overhead judgment, slow — and raises it to the sky 日轮万剑: a god does not swing. Risen a hand's breadth, he
    // draws the sun blade back as a wheel of blades forms behind him, one by one, facing the world; they turn on his
    // foe, he levels the sword at it, and they are loosed in quick succession — lines of light, each marking its cut
    // — the last of them the judgment: a great crossed cut
    aurion: {
      base: "god", name: "曙日神·奥瑞恩", move: "日轮万剑",
      note: "身后展开日轮剑阵，光剑依次转向敌人；神以剑指之，万剑平射贯穿，最后一剑落成十字审判。",
      kind: "melee", clips: { idle: "st_idle", attack: "mg_cast_forward", hurt: "gs_impact", victory: "vc_raise_hand" }, speed: 0.85,
      aim: { idle: [0, -1, 0.35], attack: "target", victory: "raised" }, body: { upright: ["attack", "victory"], float: 0.04 },
      attack: {
        before: {
          draw: { ms: 315, frame: 6, ease: "io" }, hold: { ms: 91, frame: 7, ease: "o" }, level: { ms: 112, frame: 17, ease: "i3" },
          volley: { ms: 182, frame: 22, ease: "l" },
        },
        after: { follow: { ms: 300, frame: 26, ease: "io" }, settle: { ms: 300, frame: 32, ease: "io" }, rise: { ms: 450 } },
        dash: { kind: "stay", levitate: 0.12 }, hitstop: [3, 4, 5],
      },
      fx: {
        palette: "dawn", charge: { sigil: "sun", dim: 0.7 }, weapon: { trail: false }, cast: { kind: "array", blades: 12 }, victory: { orb: "sun" },
        idle: { bits: "sparkle", every: 300 },
      },
      plain: { attack: "gs_jump_atk", aim: { idle: [0, -1, 0.35], victory: "raised" }, float: 0 },
    },
    // 荒猎神矛: the hunt god does not run at his prey. Leaves climb round him as he draws back and levels the spear; a
    // lance of the wild's light leaves its point and runs the prey through, and the wild answers — roots split the
    // ground and thorns burst up round it
    fenlos: {
      base: "god", name: "荒猎神·芬洛斯", move: "荒猎神矛",
      note: "神不追猎：原地横矛，一支荒野灵矛自矛尖飞出贯穿猎物，荆棘破土、根须裂地。",
      kind: "melee", clips: { idle: "st_axe", attack: "sp_torch", hurt: "bw_hit_front", victory: "vc_raise_hand" },
      aim: { idle: "up", attack: "target", victory: "raised" }, body: { upright: ["attack"] },
      attack: {
        before: { coil: { ms: 319, frame: 19, ease: "io" }, hold: { ms: 64, frame: 20, ease: "o" }, strike: { ms: 197, frame: 25, ease: "i3" } },
        after: { follow: { ms: 150, frame: 28, ease: "o" }, settle: { ms: 250, frame: 33, ease: "io" }, rise: { ms: 350 } }, dash: { kind: "stay" },
        hitstop: [3, 4, 5], bladeFrom: 0.7,
      },
      fx: {
        palette: "verdant", charge: { sigil: "leaf", column: "leaf", dim: 0.5 }, weapon: { trail: false }, cast: { kind: "spear" },
        hit: { mark: null }, victory: { rain: "leaf" }, idle: { bits: "leaf", every: 500 },
      },
    },
    // 焚天炎柱: the star-flame god throws nothing. The ground under his foe is marked — a crisp ring filling as he lifts
    // the fire in his hand to the sky — and as he raises it, a vortex of fire tears up out of the ground, tossing the
    // foe; black smoke rolls from its foot, the ground left molten; it burns out from the top
    jingchen: {
      base: "god", name: "星焰神·烬辰", move: "焚天炎柱",
      note: "敌人脚下出现范围圈并逐渐填满，神托火上举，火焰旋涡柱破地而起把敌人挑飞，地面熔裂。",
      kind: "caster", clips: { idle: "st_idle", attack: "cs_upwards", hurt: "mg_hit_right", victory: "cs_upwards" },
      body: { upright: ["attack", "victory"], face: true, float: 0.05 }, spell: { fire: true, rise: true, bolt: 0.11 },
      attack: {
        before: {
          gather: { ms: 470, frame: 11, ease: "io" }, hold: { ms: 150, frame: 13, ease: "o" }, lift: { ms: 179, frame: 18, ease: "o" },
          release: { ms: 141, frame: 20, ease: "l" },
        },
        after: { follow: { ms: 300, frame: 24, ease: "io" }, settle: { ms: 300, frame: 30, ease: "io" }, rise: { ms: 450 } },
      },
      fx: {
        palette: "fire", charge: { sigil: "sun", dim: 0.65 }, weapon: { glow: false }, cast: { kind: "pillar" }, hit: { shake: 1.3, lift: 0.3 },
        victory: { ray: false, orb: "sun", flame: true }, idle: { bits: "sparkle", every: 350 },
      },
      plain: { attack: "mg_conjure_throw" },
    },
    // the dark-moon goddess: the orb held before her, its power pulled in and blasted out standing, arms spread wide
    // 月蚀坍缩: the dark-moon goddess draws the dark in with both hands, three crescents wheeling round her; before her
    // foe the air tears open and a black hole swells in the rift, pulling the light in; she thrusts her hands out and
    // it collapses to a point — and bursts: a black ring, crescents cutting outward, a pool of dark
    selmyra: {
      base: "god", name: "冥月神·瑟弥拉", move: "月蚀坍缩",
      note: "三弯新月绕身，敌人面前撕开裂隙，黑洞在其中涨起、吞噬光线；神双手推出，黑洞坍缩为一点再爆开。",
      kind: "caster", clips: { idle: "mg_idle", attack: "mg_blast", hurt: "mg_hit_right", victory: "pr_arms_up", stance: "st_idle" },
      body: { upright: ["idle", "attack", "victory"], face: true, float: 0.05 }, spell: { tint: [0.75, 0.25, 1.4], rise: true, bolt: 0.1 },
      attack: {
        before: { gather: { ms: 517, frame: 20, ease: "io" }, hold: { ms: 235, frame: 24, ease: "o" }, release: { ms: 188, frame: 30, ease: "i3" } },
        after: { follow: { ms: 120, frame: 33, ease: "o" }, settle: { ms: 330, frame: 40, ease: "io" }, rise: { ms: 400 } },
      },
      fx: {
        palette: "void", charge: { sigil: "moon", dim: 0.75 }, weapon: { glow: false }, cast: { kind: "collapse" }, hit: { beam: false, lift: 0.12 },
        victory: { ray: false, orb: "moon", rain: "wisp" }, idle: { bits: "wisp", every: 500 },
      },
      plain: { attack: "mg_blast" },
    },
    // ---- 兽类（beast）
    // (dash.reach: where a beast stops, × its size — set so that its muzzle, its antlers or its beak come onto its foe's
    // near side; its model is far longer than the sculpt the old reaches were made for)
    // 月影幼狼: a bite that leaves two moonlit crescents closing on the foe
    wolf: {
      base: "beast", name: "月影幼狼", move: "扑咬",
      attack: { dash: { kind: "leap", at: 0.55, reach: 0.54 }, windup: 160 },
      fx: { palette: "moon", size: 0.9, hit: { mark: "bite", bits: "wisp", bitsCount: 4 }, idle: { every: 1400 } },
    },
    // 守灯之兽: the old lantern on its back burns warm; its bite is the wolf's, drawn out, and now and then it roars
    lampbeast: {
      base: "beast", name: "守灯之兽",
      look: { emit: [1, 0.65, 0.25], emitK: 0.5, key: 0.9 },
      attack: { dash: { kind: "lunge", at: 0.5, reach: 0.66 }, windup: 220 },
      flourish: { every: 12, len: 1.4 },
      fx: { palette: "moon", size: 1.1, hit: { mark: "bite", bits: "wisp", bitsCount: 5 }, victory: { rain: "sparkle" }, idle: { every: 800 } },
    },
    earlyriser: {
      base: "beast", name: "早醒者",
      look: { emit: [1, 0.7, 0.25], emitK: 0.12, key: 0.9 },
      attack: { dash: { kind: "lunge", at: 0.45, reach: 0.42 }, windup: 300 },
      fx: {
        palette: "earth", size: 1.25,
        hit: { mark: "pierce", ground: "crack", spikes: "rock", rocks: 6, bits: "sparkle", bitsCount: 6, dust: 1.6, shake: 1.5 },
        victory: { rain: "rock", shock: true }, idle: { every: 600 },
      },
    },
    // 幽灵狼: a wolf cub with a ghost's pale violet glow at its edges
    pup: {
      base: "beast", name: "幽灵狼",
      look: { ghost: 0.28, ghostC: [0.62, 0.45, 1] },
      attack: { dash: { kind: "leap", at: 0.55 }, windup: 120 },
      fx: { palette: "void", size: 0.75, hit: { mark: "bite", bits: "wisp", bitsCount: 3 }, idle: { bits: "wisp", every: 1600 } },
    },
    // 灵狼: a spirit of the green wood, lit from within
    spiritwolf: {
      base: "beast", name: "灵狼",
      look: { ghost: 0.75, ghostC: [0.35, 1.25, 0.7] },
      attack: { dash: { kind: "leap", at: 0.55, reach: 0.45 }, windup: 140 },
      fx: { palette: "fey", size: 0.9, hit: { mark: "bite", bits: "wisp", bitsCount: 6 }, idle: { bits: "wisp", every: 520 } },
    },
    // 银灯灵狐: a fox of lantern light
    moonfox: {
      base: "beast", name: "银灯灵狐", move: "飞扑",
      attack: { dash: { kind: "leap", at: 0.55, reach: 0.46 }, windup: 140 },
      fx: { palette: "fey", size: 0.9, hit: { mark: "bite", bits: "wisp", bitsCount: 5 }, victory: { orb: "moon" }, idle: { every: 900 } },
    },
    // 暮角契鹿: antlers lowered, a charge that splits the ground with roots
    duskstag: {
      base: "beast", name: "暮角契鹿", move: "角撞",
      attack: { dash: { kind: "lunge", at: 0.45, reach: 0.6 }, windup: 220 },
      fx: { palette: "dawn", hit: { mark: "pierce", ground: "roots", bits: "leaf" }, victory: { rain: "leaf" }, idle: { bits: "leaf", every: 1100 } },
    },
    // 幽谷蛛后: fangs, venom, the ground gone dark under her prey
    spider: {
      base: "beast", name: "幽谷蛛后", move: "突袭",
      attack: { dash: { kind: "leap", at: 0.5, reach: 0.35 }, windup: 200 },
      fx: { palette: "necro", hit: { mark: "bite", ground: "void", bits: "wisp" }, idle: { bits: "wisp", every: 900 } },
    },
    // 烬喉幼龙: a young dragon's gout of fire
    dragon: {
      base: "beast", name: "烬喉幼龙", move: "吐息",
      look: { emit: [1, 0.45, 0.12], emitK: 0.35 }, emitter: { bone: "jaw", offset: [0, 0.012, 0.07] },
      attack: { draw: 260 },
      fx: { palette: "ember", hit: { mark: false, ground: "crack", flame: true }, victory: { flame: true }, idle: { every: 700 } },
    },
    // 终焰·阿什拉 (legendary): lava in the cracks of its hide; it rears, the stage darkens, and it pours a river of fire
    // on its foe — the ground breaks molten under it, rocks fly; now and then it spreads its wings and roars
    ashdragon: {
      base: "beast", name: "终焰·阿什拉",
      look: { emit: [1, 0.42, 0.1], emitK: 0.6, key: 0.85 }, emitter: { bone: "jaw", offset: [0, 0.012, 0.075] },
      attack: { draw: 480 },
      flourish: { every: 11, len: 1.6 },
      fx: {
        palette: "fire", size: 1.35, charge: { column: "spark", dim: 0.55 },
        hit: { mark: false, ground: "crack", spikes: "rock", rocks: 6, dust: 1.6, shake: 1.8, flame: true }, victory: { flame: true, shock: true },
        idle: { every: 220 },
      },
    },
    // 蚀月狼王 (legendary): the eclipse over it; a raking blow of the dark moon — three claw-cuts and the void under
    // them; it howls at the dark moon now and then
    eclipsewolf: {
      base: "beast", name: "蚀月狼王",
      look: { key: 0.72 },
      attack: { dash: { kind: "lunge", at: 0.5, reach: 0.48 }, windup: 320 },
      flourish: { every: 12, len: 1.6 },
      fx: {
        palette: "void", size: 1, charge: { sigil: "moon", dim: 0.5 }, weapon: { limb: ["wriL", "fpawL"], trail: { from: 0.55, inner: 0.25 } },
        hit: { mark: "claw", ground: "void", bits: "wisp", bitsCount: 8, shake: 1.4 }, victory: { orb: "moon" }, idle: { bits: "wisp", every: 380 },
      },
    },
    // 不灭凤凰 (epic): a gold flame at its heart; it dives wings first, a crescent of blue fire; feathers of light fall
    phoenix: {
      base: "beast", name: "不灭凤凰",
      look: { emit: [1, 0.72, 0.25], emitK: 0.8 },
      attack: { dash: { kind: "leap", at: 0.4, reach: 0.57 }, windup: 280 },
      flourish: { every: 10, len: 1.6 },
      fx: {
        palette: "phoenix", size: 1.15, charge: { sigil: "star", dim: 0.35 },
        weapon: { limb: ["wing2R", "wing3R"], trail: { from: 0.55, inner: 0.3 } },
        hit: { mark: { kind: "crescent", size: 0.7 }, bits: "feather", bitsCount: 6, shake: 1.2, flame: { size: 0.6 } }, victory: { rain: "feather", flame: true },
        idle: { every: 320 },
      },
    },
    // 霜牙狼骑: the knight's ice blade cuts as the wolf charges; frost and ice where it lands
    rider: {
      base: "beast", name: "霜牙狼骑",
      blade: { bone: "rHandR", at: [[-0.13, 0.475, 0], [-0.52, 0.7, 0]] },
      attack: { dash: { kind: "lunge", at: 0.45, reach: 0.5 }, windup: 220 },
      fx: {
        palette: "frost", weapon: { trail: { from: 0.6 } }, hit: { mark: "line", ground: "frost", spikes: "ice", bits: "shard", bits2: "snow" },
        victory: { ray: true, rain: "snow" }, idle: { bits: "snow", every: 800 },
      },
    },
    // 绵羊: a soft bonk and a few stars
    sheep: {
      base: "beast", name: "绵羊",
      attack: { dash: { kind: "lunge", at: 0.5 }, windup: 100 },
      fx: {
        palette: "dawn", size: 0.8, hit: { mark: false, bits: "star", bitsCount: 4, dust: 1.2, shake: 0.5 }, victory: { rain: "star" },
        idle: { every: 2400 },
      },
    },
    // 石卫: the rune crystal lit; it slams, the ground cracks and stone spikes out of it
    stone: {
      base: "beast", name: "石卫",
      look: { emit: [0.3, 0.7, 1], emitK: 0.9 },
      attack: { dash: { kind: "lunge", at: 0.4 }, windup: 200 },
      fx: {
        palette: "rune", hit: { mark: false, ground: "crack", spikes: "rock", rocks: 5, dust: 1.5, shake: 1.4 },
        victory: { rain: "rock", shock: true }, idle: { every: 1100 },
      },
    },
    // 荆棘树灵: it lashes from where it grows; roots split the ground under its foe and thorns burst up
    thorn: {
      base: "beast", name: "荆棘树灵",
      attack: { dash: { kind: "stay" }, windup: 180 },
      fx: {
        palette: "verdant", hit: { mark: false, ground: "roots", spikes: "thorn", bits: "leaf" }, victory: { rain: "leaf" },
        idle: { bits: "leaf", every: 1300 },
      },
    },
    // ---- 镜中英雄：与本尊同一套招式
    mirrornahira: {
      base: "nahira", name: "镜中的娜希拉",
    },
    mirrorfrederia: {
      base: "frederia", name: "镜中的菲德莉亚",
    },
    mirrorrowan: {
      base: "rowan", name: "镜中的罗温",
    },
    mirrorliol: {
      base: "liol", name: "镜中的利奥尔",
    },
  },
};
if (typeof module !== "undefined") module.exports = EmberMoveSheets;
