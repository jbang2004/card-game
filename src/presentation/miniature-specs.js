/* Character descriptions for battlefield miniatures, keyed by card id. Each is
 * data for EmberMiniatureKit: a skeleton (`body`), palette taken from the card
 * art and pushed toward the game's dusk tones, and a few feature switches.
 * Cards without an entry keep their flat token. */
const EmberMiniatureSpecs = Object.freeze({
  // 荒野之矛 — hooded elf huntress with a leaf spear
  huntress: {
    body: "humanoid",
    skin: 0xeec5a8,
    eye: 0x6f8a2a,
    elf: true,
    longHair: true,
    hood: 0x2d5a2c,
    weapon: "spear",
    bodice: 0x3a2618,
    palette: {
      hair: 0x5a3521, top: 0x2f5a2c, sleeve: 0x2a4a26, skirt: 0x345f30,
      legs: 0x2a221c, boots: 0x4a2c1a, belt: 0x3a2214, trim: 0xc9a352,
      gloves: 0x4a2c1a, cape: 0x24472a, wood: 0x6b4325, metal: 0xd6dde2, accent: 0x7fb34a,
    },
  },
  // 月影幼狼 — grey wolf pup, pale belly, ice-blue eyes
  wolf: {
    body: "quadruped",
    scale: 0.95,
    legLength: 0.2,
    bodyLength: 0.3,
    bodyRadius: 0.12,
    headRadius: 0.19,
    neckLength: 0.09,
    legThick: 1.1,
    ears: true,
    ruff: true,
    tail: "bushy",
    tailLength: 0.2,
    eye: 0x8fd6ff,
    wag: 6,
    palette: {
      body: 0x8d8f96, belly: 0xd9dbe0, head: 0x9a9ca3, snout: 0xd6d8dd, ruff: 0xc4c6cc,
      legs: 0x7c7e86, paws: 0xe2e3e6, ears: 0x6f7178, tail: 0xa5a7ad,
    },
  },
  // 暮角契鹿 — night-blue spirit stag, crescent marks, pale antlers
  duskstag: {
    body: "quadruped",
    scale: 1.12,
    legLength: 0.34,
    bodyLength: 0.34,
    bodyRadius: 0.12,
    headRadius: 0.14,
    neckLength: 0.22,
    legThick: 0.8,
    ears: true,
    tail: "short",
    tailLength: 0.12,
    eye: 0xb9d4ff,
    antlers: 0xe6e2d6,
    marks: 0x9fc3ff,
    wag: 3,
    palette: {
      body: 0x2a3566, belly: 0x3a4a86, head: 0x2e3a70, snout: 0x3d4c8c,
      legs: 0x222b55, paws: 0x151a33, ears: 0x2a3566, tail: 0xc9d6ff,
    },
  },
});
