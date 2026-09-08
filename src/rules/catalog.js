/* Authored metadata schemas. Cross-reference and effect checks live in data.js. */
const EmberCatalog = (() => {
  function fields(record, allowed, owner) {
    if (!record || typeof record !== "object" || Array.isArray(record))
      throw Error(owner + ": Expected record");
    for (const key of Object.keys(record))
      if (!allowed.includes(key)) throw Error(owner + ": Unknown field " + key);
  }
  function text(value, owner) {
    if (typeof value !== "string" || !value.trim())
      throw Error(owner + ": Expected nonempty text");
  }
  function integer(value, min, owner) {
    if (!Number.isInteger(value) || value < min)
      throw Error(owner + ": Invalid number");
  }
  function list(records, allowed, name, required = true) {
    if (!Array.isArray(records) || (required && !records.length))
      throw Error(name + ": Expected records");
    const ids = new Set();
    for (const r of records) {
      fields(r, allowed, name);
      if (
        typeof r.id !== "string" ||
        !/^[a-z][a-z0-9_]*$/.test(r.id) ||
        ids.has(r.id)
      )
        throw Error(name + ": Invalid or duplicate ID " + r.id);
      ids.add(r.id);
      text(r.name, r.id + ".name");
    }
  }
  function validate(world) {
    fields(
      world,
      [
        "classes",
        "tribes",
        "deckRules",
        "heroes",
        "bosses",
        "relics",
        "kw",
        "archetypes",
      ],
      "campaign",
    );
    list(world.classes, ["id", "name"], "classes");
    list(world.tribes, ["id", "name"], "tribes", false);
    if (!world.classes.some((c) => c.id === "neutral"))
      throw Error("Missing neutral class");
    const classExists = (id) =>
      world.classes.some((c) => c.id === id && id !== "neutral");
    const common = [
      "id",
      "name",
      "title",
      "art",
      "palette",
      "power",
      "powerCost",
      "powerEffects",
      "target",
      "portraitId",
    ];
    list(
      world.heroes,
      [...common, "classId", "defaultDeckId", "powerIcon", "sub", "desc"],
      "heroes",
    );
    list(
      world.bosses,
      [
        ...common,
        "en",
        "hp",
        "quote",
        "deck",
        "color",
        "phaseEffects",
        "discoverClass",
      ],
      "bosses",
    );
    for (const h of [...world.heroes, ...world.bosses]) {
      for (const key of ["title", "art", "palette", "power", "portraitId"])
        text(h[key], h.id + "." + key);
      integer(h.powerCost, 0, h.id + ".powerCost");
      if (
        h.target !== undefined &&
        !["enemy", "enemyMinion", "friendlyMinion", "minion"].includes(h.target)
      )
        throw Error(h.id + ": Invalid target");
    }
    for (const h of world.heroes) {
      if (!classExists(h.classId)) throw Error(h.id + ": Invalid classId");
      for (const key of ["defaultDeckId", "powerIcon", "sub", "desc"])
        text(h[key], h.id + "." + key);
    }
    for (const b of world.bosses) {
      integer(b.hp, 1, b.id + ".hp");
      if (!classExists(b.discoverClass))
        throw Error(b.id + ": Invalid discoverClass");
      for (const key of ["en", "quote", "color"])
        text(b[key], b.id + "." + key);
    }
    list(
      world.relics,
      [
        "id",
        "name",
        "icon",
        "maxHealth",
        "spellDamage",
        "startingMana",
        "onStart",
        "onTurn",
        "triggers",
      ],
      "relics",
      false,
    );
    for (const r of world.relics) {
      text(r.icon, r.id + ".icon");
      for (const key of ["maxHealth", "spellDamage", "startingMana"])
        if (r[key] !== undefined) integer(r[key], 1, r.id + "." + key);
    }
    if (world.relics.reduce((n, r) => n + (r.startingMana || 0), 0) > 10)
      throw Error("Relics exceed starting mana limit");
    list(
      world.archetypes,
      ["id", "name", "hero", "classId", "deck", "plan", "strategy"],
      "archetypes",
    );
    for (const a of world.archetypes) {
      if (!classExists(a.classId)) throw Error(a.id + ": Invalid classId");
      text(a.plan, a.id + ".plan");
      if (a.strategy !== undefined) text(a.strategy, a.id + ".strategy");
    }
    fields(world.deckRules, ["size", "maxCopies", "rarityCopies"], "deckRules");
    integer(world.deckRules.size, 1, "deckRules.size");
    if (world.deckRules.size > 100)
      throw Error("Deck size exceeds current capacity");
    integer(world.deckRules.maxCopies, 1, "deckRules.maxCopies");
    fields(
      world.deckRules.rarityCopies,
      ["common", "rare", "epic", "legendary"],
      "rarityCopies",
    );
    for (const value of Object.values(world.deckRules.rarityCopies))
      integer(value, 1, "rarityCopies");
    if (!world.kw || typeof world.kw !== "object" || Array.isArray(world.kw))
      throw Error("Invalid keywords");
    for (const value of Object.values(world.kw)) text(value, "keyword");
  }
  return Object.freeze({ validate, fields });
})();
if (typeof module !== "undefined") module.exports = EmberCatalog;
