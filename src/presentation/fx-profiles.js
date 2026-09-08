/* Presentation-only signatures. Explicit IDs keep new cards from silently
 * inheriting the wrong attack or spell language. No rules or randomness here. */
const EmberFXProfiles = (() => {
  const records = {};
  function register(ids, attack, cast = "summon", windup = 300) {
    for (const id of ids.split(" "))
      records[id] = { id, attack, cast, windup, signature: false };
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
      signature: ["storm", "execute", "rally", "fireball"].includes(id),
    };
  }
  const legends = {
    solaris: "solar-crown",
    nyx: "astral-gate",
    ashdragon: "dragon-wake",
    frostking: "frost-throne",
  };
  for (const [id, arrival] of Object.entries(legends))
    Object.assign(records[id], { arrival, windup: 620, signature: true });
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
      return { attack: "blade", cast: "ember", windup: 420, signature: false };
    if (!records[id]) throw Error("Missing combat presentation: " + id);
    return records[id];
  }
  const fromPalette = (palette, fallback = "arcane") =>
    schools[palette] || fallback;
  return Object.freeze({
    get,
    records: Object.freeze(records),
    fromPalette,
    school: (c) => fromPalette(c?.palette, "steel"),
    ranged: (c) => ["arrow", "spear", "bolt", "breath"].includes(get(c).attack),
  });
})();
if (typeof module !== "undefined") module.exports = EmberFXProfiles;
