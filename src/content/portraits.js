/* Portraits of the people you play and meet: heroes, bosses and rival opponents. Their own art, never a card's — the 97
 * card ids keep their strict mapping in CharacterCatalog, and a portrait id may not equal a card id.
 *   image  the 3:4 still (assets/portraits/<id>.png → tools/portrait_assets.py → .webp)
 *   focus  vertical crop centre (%) for round and short frames
 *   figure the id of a realistic 3D figure to stand on the hero dais; without one the plate keeps the flat portrait
 *   live   true once art/live-art has its layered live artwork (tools/bake_live_art.py)
 *   relief true once art/relief has its height/normal/orm maps (tools/bake_card_relief.py)
 * A dedicated cut-in still (assets/cutin/<id>.webp) is optional and keyed by the same id. */
const EmberPortraits = {
  nahira: { image: "asset:portraits/nahira.webp", focus: 18, figure: "nahira", live: true, relief: true },
  frederia: { image: "asset:portraits/frederia.webp", focus: 16, figure: "frederia", live: true, relief: true },
  rowan: { image: "asset:portraits/rowan.webp", focus: 18, figure: "rowan", live: true, relief: true },
  liol: { image: "asset:portraits/liol.webp", focus: 14, figure: "liol", live: true, relief: true },
  // bosses (the expedition's opponents; see docs/design/CAST_V2.md)
  whistle: { image: "asset:portraits/whistle.webp", focus: 14, figure: "whistle" },
  rootmother: { image: "asset:portraits/rootmother.webp", focus: 16, figure: "rootmother" },
  translator: { image: "asset:portraits/translator.webp", focus: 14, figure: "translator" },
  rootkeeper: { image: "asset:portraits/rootkeeper.webp", focus: 18, figure: "rootkeeper" },
  lampbeast: { image: "asset:portraits/lampbeast.webp", focus: 14, figure: "lampbeast" },
  nathan: { image: "asset:portraits/nathan.webp", focus: 22, figure: "nathan" },
  // more opponents of the expedition
  fuse: { image: "asset:portraits/fuse.webp", focus: 16, figure: "fuse" },
  gleaner: { image: "asset:portraits/gleaner.webp", focus: 16, figure: "gleaner" },
  appraiser: { image: "asset:portraits/appraiser.webp", focus: 14, figure: "appraiser" },
  redscarf: { image: "asset:portraits/redscarf.webp", focus: 14, figure: "redscarf" },
  drill: { image: "asset:portraits/drill.webp", focus: 20 },
  clockmaker: { image: "asset:portraits/clockmaker.webp", focus: 18, figure: "clockmaker" },
  blacklung: { image: "asset:portraits/blacklung.webp", focus: 16, figure: "blacklung" },
  ada: { image: "asset:portraits/ada.webp", focus: 14, figure: "ada" },
  // the second batch of opponents
  earlyriser: { image: "asset:portraits/earlyriser.webp", focus: 22, figure: "earlyriser" },
  amberbody: { image: "asset:portraits/amberbody.webp", focus: 14, figure: "amberbody" },
  pawnbroker: { image: "asset:portraits/pawnbroker.webp", focus: 18, figure: "pawnbroker" },
  mirrorlegion: { image: "asset:portraits/mirrorlegion.webp", focus: 16, figure: "mirrorlegion" },
  // the mirror heroes: the four heroes' black-jade twins (tools/mirror_glb.py; the portraits are the heroes' own, flipped and regraded)
  mirrornahira: { image: "asset:portraits/mirrornahira.webp", focus: 14, figure: "mirrornahira" },
  mirrorfrederia: { image: "asset:portraits/mirrorfrederia.webp", focus: 14, figure: "mirrorfrederia" },
  mirrorrowan: { image: "asset:portraits/mirrorrowan.webp", focus: 22, figure: "mirrorrowan" },
  mirrorliol: { image: "asset:portraits/mirrorliol.webp", focus: 14, figure: "mirrorliol" },
  // the other side: Eve, who took over her husband's work and tends a black flower
  eve: { image: "asset:portraits/eve.webp", focus: 14, figure: "eve" },
  // the expedition's rival presets (campaign.js archetypes: person + portraitId)
  apprentice: { image: "asset:portraits/apprentice.webp", focus: 16 },
  icekeeper: { image: "asset:portraits/icekeeper.webp", focus: 16 },
  militia: { image: "asset:portraits/militia.webp", focus: 16 },
  oldguard: { image: "asset:portraits/oldguard.webp", focus: 16 },
  woodswoman: { image: "asset:portraits/woodswoman.webp", focus: 16 },
  gravedigger: { image: "asset:portraits/gravedigger.webp", focus: 16 },
  moonmonk: { image: "asset:portraits/moonmonk.webp", focus: 16 },
  beasttamer: { image: "asset:portraits/beasttamer.webp", focus: 16 },
  stargazer: { image: "asset:portraits/stargazer.webp", focus: 16 },
  churchguard: { image: "asset:portraits/churchguard.webp", focus: 16 },
  villagehunter: { image: "asset:portraits/villagehunter.webp", focus: 16 },
  // the keeper of the Copper Kettle (the run's hub; she is never fought)
  amara: { image: "asset:portraits/amara.webp", focus: 16 },
};
if (typeof module !== "undefined") module.exports = EmberPortraits;
