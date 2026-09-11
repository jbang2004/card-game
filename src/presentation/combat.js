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
  const sameRef = (a, b) =>
    !!a &&
    !!b &&
    a.side === b.side &&
    a.uid === b.uid;
  const sameParent = (a, b) => (a?.parentId ?? null) === (b?.parentId ?? null);
  const contactEvent = (e) => ["damage", "shield"].includes(e.type);
  const contactRef = (e) => ({ side: e.side, uid: e.uid });
  const matchesContact = (attack, e, direction) => {
    if (!contactEvent(e) || !sameParent(attack, e)) return false;
    const from = direction === "outgoing" ? attack.from : attack.to,
      to = direction === "outgoing" ? attack.to : attack.from;
    return sameRef(e.from, from) && sameRef(contactRef(e), to);
  };
  const heavyContact = (event) =>
    event?.type === "damage" &&
    (event.loss === undefined ? event.amount : event.loss) > 0 &&
    event.amount >= 6;

  function sourceCid(frame, ref) {
    if (!frame || !ref) return null;
    const side = frame[ref.side];
    if (!side) return null;
    if (ref.uid === "hero") return side.weapon?.cid || null;
    return side.board?.find((m) => m.uid === ref.uid)?.cid || null;
  }

  function sourceFamily(frame, ref, fallback) {
    const cid = sourceCid(frame, ref);
    if (!cid) return fallback;
    try {
      return profiles.get(cid).attack || fallback;
    } catch {
      return fallback;
    }
  }

  function owningActionId(ref, blocks) {
    let id = ref?.parentId || null;
    while (id) {
      const block = blocks.get(id);
      if (!block) return null;
      if (block.kind === "action") return id;
      id = block.parentId || null;
    }
    return null;
  }

  function reactionTiming(at, hold, heavy, actorEnd = null) {
    const window = Math.min(250, Math.max(0, Number(hold) || 0));
    const contactHold = Math.min(
      heavy ? 50 : 30,
      window * 0.25,
    );
    const end = Math.max(at, Math.min(
      at + window,
      actorEnd === null ? at + window : actorEnd,
    ));
    return {
      contactAt: at,
      releaseAt: Math.min(at + contactHold, end),
      recoveryEndAt: end,
    };
  }

  function attachMotionMarkers(
    groups,
    events,
    blocks,
    blockEnds,
    attackFamily = "blade",
  ) {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      group.markers = {
        start: group.at,
        end: group.at + group.hold,
      };
      group.contacts ??= [];
      if (group.kind !== "attack") continue;
      const attack = group.events[0],
        attackId = attack.id || "attack-" + i,
        attackIndex = group.eventIndexes?.[0] ?? events.indexOf(attack),
        actionId = owningActionId(attack, blocks),
        actionEnd = actionId ? blockEnds.get(actionId) : null,
        nextAttackIndex = groups
          .slice(i + 1)
          .filter((candidate) => candidate.kind === "attack")
          .map((candidate) => candidate.eventIndexes?.[0])
          .find((index) => Number.isInteger(index)),
        boundary = Math.min(
          ...[actionEnd, nextAttackIndex, events.length].filter(
            (index) => Number.isInteger(index),
          ),
        ),
        candidates = groups.slice(i + 1).filter((candidate) =>
          (candidate.eventIndexes?.[0] ?? Infinity) < boundary,
        ),
        sourceCidValue = sourceCid(group.frame, attack.from),
        resolvedFamily = attack.attack || sourceFamily(
          group.frame,
          attack.from,
          attackFamily,
        ),
        outgoing = candidates
          .flatMap((candidate) =>
            candidate.events.map((event) => ({ candidate, event })),
          )
          .find(({ event }) => matchesContact(attack, event, "outgoing")),
        contact = outgoing?.candidate?.at ?? null,
        leadIn = contact === null ? 0 : Math.max(0, contact - group.at),
        heavy = heavyContact(outgoing?.event),
        motion = profiles.motionFor(
          resolvedFamily,
          leadIn,
          heavy,
          outgoing?.candidate?.hold || 0,
        );
      group.attackId = attackId;
      group.sourceCid = sourceCidValue;
      group.attackFamily = resolvedFamily;
      group.motion = motion;
      let outgoingLink = null;
      if (outgoing) {
        const timing = reactionTiming(
          outgoing.candidate.at,
          outgoing.candidate.hold,
          heavy,
          motion.ranged ? null : group.at + motion.recoveryEnd,
        );
        outgoingLink = {
          attackId,
          direction: "outgoing",
          eventId: outgoing.event.id,
          targetRef: { ...attack.to },
          motion,
          heavy,
          sourceCid: sourceCidValue,
          family: resolvedFamily,
          actorRecoveryEndAt: group.at + motion.recoveryEnd,
          ...timing,
        };
        group.contacts.push(outgoingLink);
        (outgoing.candidate.contacts ??= []).push(outgoingLink);
      }
      for (const candidate of candidates) {
        for (const event of candidate.events) {
          if (!matchesContact(attack, event, "retaliation")) continue;
          const sourceCidValue = sourceCid(candidate.frame, event.from),
            family = sourceFamily(candidate.frame, event.from, "blade"),
            timing =
              outgoing && candidate === outgoing.candidate
                ? {
                    contactAt: outgoingLink.contactAt,
                    releaseAt: outgoingLink.releaseAt,
                    recoveryEndAt: outgoingLink.recoveryEndAt,
                  }
                : reactionTiming(
                    candidate.at,
                    candidate.hold,
                    heavyContact(event),
                  );
          (candidate.contacts ??= []).push({
            attackId,
            direction: "retaliation",
            eventId: event.id,
            targetRef: { side: event.side, uid: event.uid },
            heavy: heavyContact(event),
            sourceCid: sourceCidValue,
            family,
            ...timing,
          });
        }
      }
      group.markers = {
        start: group.at,
        anticipation: group.at + motion.anticipation,
        contact,
        release: contact === null ? null : group.at + motion.release,
        recoveryEnd:
          contact === null ? null : group.at + motion.recoveryEnd,
        end: group.at + motion.duration,
      };
    }
  }
  function compile(
    events,
    before,
    final,
    reduced = false,
    attackFamily = "blade",
  ) {
    const groups = [];
    const departed = new Set();
    const blocks = new Map(
      events.filter((e) => e.type === "blockStart").map((e) => [e.id, e]),
    );
    const blockEnds = new Map(
      events
        .filter((e) => e.type === "blockEnd")
        .map((e) => [e.blockId, events.indexOf(e)]),
    );
    for (const [eventIndex, e] of events.entries()) {
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
          eventIndexes: [eventIndex],
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
        prev.events.push(e), prev.eventIndexes.push(eventIndex);
      else
        groups.push({
          kind,
          parentId: e.parentId,
          events: [e],
          eventIndexes: [eventIndex],
        });
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
    attachMotionMarkers(groups, events, blocks, blockEnds, attackFamily);
    // Pathological chains stay bounded without changing causal order.
    const presentationEnd = Math.max(
      at,
      ...groups.map((group) => group.markers?.end || group.at + group.hold),
    );
    const scale = reduced ? 0 : Math.min(1, 6500 / Math.max(1, presentationEnd));
    for (const g of groups) {
      g.at *= scale;
      g.hold *= scale;
      if (g.motion) g.motion = profiles.scaleMotion(g.motion, scale);
      if (g.markers)
        for (const key of Object.keys(g.markers))
          if (g.markers[key] !== null) g.markers[key] *= scale;
    }
    const scaledContacts = new Set();
    for (const group of groups)
      for (const contact of group.contacts || []) {
        if (scaledContacts.has(contact)) continue;
        scaledContacts.add(contact);
        if (contact.motion)
          contact.motion = profiles.scaleMotion(contact.motion, scale);
        for (const key of [
          "contactAt",
          "releaseAt",
          "recoveryEndAt",
          "actorRecoveryEndAt",
        ])
          if (contact[key] !== undefined && contact[key] !== null)
            contact[key] *= scale;
      }
    return { beats: groups, duration: presentationEnd * scale, scale };
  }
  return Object.freeze({ compile });
})();
if (typeof module !== "undefined") module.exports = EmberCombat;
