/* Compile immutable observations into presentation beats. No rules, RNG or DOM. */
const EmberCombat = (() => {
  const profiles =
    typeof EmberFXProfiles !== "undefined"
      ? EmberFXProfiles
      : require("./fx-profiles.js");
  const visible = new Set([
    "contract",
    "play",
    "power",
    "attack",
    "damage",
    "shield",
    "heal",
    "summon",
    "death",
    "draw",
    "burn",
    "status",
    "secret",
    "weaponWear",
    "phase",
    "turn",
    "over",
  ]);
  const family = (e) =>
    ["damage", "shield"].includes(e.type)
      ? "hit"
      : e.type === "status"
        ? "status:" + e.kind
        : e.type;
  function compile(events, before, final, reduced = false) {
    const groups = [];
    const departed = new Set();
    const blocks = new Map(
      events.filter((e) => e.type === "blockStart").map((e) => [e.id, e]),
    );
    for (const e of events) {
      if (!visible.has(e.type)) continue;
      if (e.type === "death") {
        if (departed.has(e.side + e.uid)) continue;
        const batch = (e.departures || [e]).filter(
          (d) => !departed.has(d.side + d.uid),
        );
        batch.forEach((d) => departed.add(d.side + d.uid));
        groups.push({
          kind: "death",
          parentId: e.parentId,
          events: batch.map((d) => ({ ...e, ...d })),
        });
        continue;
      }
      const prev = groups.at(-1),
        kind = family(e);
      // AOE targets share a beat; separate draws must retain individual landings.
      if (
        prev &&
        prev.kind === kind &&
        prev.parentId === e.parentId &&
        !["draw", "burn", "play", "attack", "power"].includes(kind)
      )
        prev.events.push(e);
      else groups.push({ kind, parentId: e.parentId, events: [e] });
    }
    let frame = structuredClone(before || final),
      at = 0;
    for (const group of groups) {
      for (const e of group.events)
        if (e.view) {
          for (const side of ["p", "e"])
            if (e.view[side])
              Object.assign(frame[side], structuredClone(e.view[side]));
          for (const key of ["active", "turn", "phase2"])
            frame[key] = e.view[key];
        }
      group.frame = structuredClone(frame);
      group.at = at;
      let block = blocks.get(group.parentId);
      while (block) {
        if (block.kind === "deathrattle") {
          group.sourceId = block.sourceId;
          break;
        }
        block = blocks.get(block.parentId);
      }
      group.hold =
        {
          play: 460,
          power: 420,
          attack: 220,
          hit: 300,
          death: 400,
          summon: 300,
          secret: 420,
          heal: 300,
          draw: 240,
          phase: 1800,
          turn: 220,
          over: 700,
        }[group.kind] || 260;
      if (group.kind === "contract")
        group.hold = group.events[0].divine ? 1700 : 650;
      if (group.kind === "play")
        group.hold = profiles.get(group.events[0].cid).windup;
      if (group.events.some((e) => e.type === "heal" && e.from))
        group.hold = 360;
      at += group.hold;
    }
    // Pathological chains stay bounded without changing causal order.
    const scale = reduced ? 0 : Math.min(1, 6500 / Math.max(1, at));
    for (const g of groups) {
      g.at *= scale;
      g.hold *= scale;
    }
    return { beats: groups, duration: at * scale };
  }
  return Object.freeze({ compile });
})();
if (typeof module !== "undefined") module.exports = EmberCombat;
