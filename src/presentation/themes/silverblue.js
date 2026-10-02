/* Theme data only: semantic artwork, lighting and composition. No game state. */
const EmberThemeDefinition = Object.freeze({
  id: "silverblue",
  name: "星海银蓝",
  title: "琥珀战记 · 铜壶酒馆",
  copy: Object.freeze({
    eyebrow: "矿区黄昏的序章",
    subtitle: "铜壶酒馆",
    tagline: "每一手，都是新的故事。",
    footer: "AMBER WAR CHRONICLE / A TAVERN BY THE SHAFT",
  }),
  art: Object.freeze({
    home: "asset:themes/silverblue/home.webp",
    homeLogo: "asset:ui/home-reference-v1/final/logo.webp",
    homePortal: "asset:ui/home-reference-v1/final/card-portal.webp",
    homeTree: "asset:ui/home-reference-v1/final/card-tree.webp",
    homeDragon: "asset:ui/home-reference-v1/final/card-dragon.webp",
    // the six relics of the amber story (docs/design/CAST_V2.md): ordinary working things with a speck of amber
    relicHeart: "asset:ui/relics-v2/relic-heart.webp",
    relicLens: "asset:ui/relics-v2/relic-lens.webp",
    relicCrown: "asset:ui/relics-v2/relic-crown.webp",
    relicFeather: "asset:ui/relics-v2/relic-feather.webp",
    relicEmber: "asset:ui/relics-v2/relic-ember.webp",
    relicBanner: "asset:ui/relics-v2/relic-banner.webp",
    victorySigil: "asset:ui/page-reference-v1/victory-sigil.webp",
    map: "asset:themes/silverblue/map.webp",
    backdrop: "asset:themes/silverblue/backdrop.webp",
  }),
  scenes: Object.freeze({
    home: Object.freeze({
      art: "home",
      focus: [0.52, 0.5],
      portraitFocus: [0.54, 0.5],
      shade: 0.04,
    }),
    /* The battle backdrop is rendered live by presentation/arena-3d.js; this
     * role only keeps the ambient shade the 2D world canvas paints beneath it. */
    battle: Object.freeze({
      art: null,
      focus: [0.5, 0.5],
      portraitFocus: [0.5, 0.48],
      shade: 0.1,
    }),
    backdrop: Object.freeze({
      art: "backdrop",
      focus: [0.5, 0.5],
      portraitFocus: [0.5, 0.5],
      shade: 0.15,
    }),
  }),
  scenery: Object.freeze([
    {
      id: "chimney",
      name: "窗边的铜灯",
      hint: "轻触铜灯，点亮桌边的暖光",
      focus: [145, 160],
      warm: true,
      box: { left: "12px", top: "58px", width: "240px", height: "217px" },
    },
    {
      id: "crystals",
      name: "星辉观测台",
      hint: "轻拨星环，让星光落在掌心",
      focus: [1430, 160],
      box: { left: "1390px", top: "63px", width: "180px", height: "211px" },
    },
    {
      id: "tree",
      name: "流云星石",
      hint: "轻触星石，听见清澈的回声",
      focus: [125, 690],
      box: { left: "18px", top: "510px", width: "175px", height: "232px" },
    },
    {
      id: "forge",
      name: "旅人铜灯",
      hint: "轻触铜灯，唤起温暖的光",
      focus: [1460, 700],
      warm: true,
      box: { left: "1475px", top: "710px", width: "110px", height: "120px" },
    },
  ]),
  light: Object.freeze({
    ambient: "#101a30",
    glow: "#b6ddff",
    warm: "#f1c891",
    line: "#beddf3",
  }),
});
