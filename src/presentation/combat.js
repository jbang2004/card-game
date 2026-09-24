/* Compile immutable observations into presentation beats. No rules, RNG or DOM.
 *
 * docs/design/BATTLE_PRESENTATION_V2.md §3: every beat carries
 *   actor / targets / tier / blockId / rule{aoe,status}
 * and every number in the timeline comes from EmberTiming (§4). Geometry is
 * injected by the director through opts.anchor (a pure lookup into the
 * sequence snapshot); without it a nominal distance keeps compile usable in
 * node tests. */
const EmberCombat = (() => {
  const profiles =
    typeof EmberFXProfiles !== "undefined"
      ? EmberFXProfiles
      : require("./fx-profiles.js");
  const T =
    typeof EmberTiming !== "undefined" ? EmberTiming : require("./timing.js");
  /* The effect engine's plan() is the only source of cast contact times
   * (§3.3); it is pure and needs neither WebGL nor DOM. */
  const engine = () =>
    typeof EmberFx2Engine !== "undefined"
      ? EmberFx2Engine
      : require("../fx2-engine.js");
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
    !!a && !!b && a.side === b.side && a.uid === b.uid;
  const sameParent = (a, b) => (a?.parentId ?? null) === (b?.parentId ?? null);
  const refKey = (ref) => (ref ? ref.side + ref.uid : "");
  const plainRef = (ref) => (ref ? { side: ref.side, uid: ref.uid } : null);
  /* Without a measured snapshot (node tests, a unit that has not landed yet)
   * travel is planned over this distance. It never becomes a screen position. */
  const NOMINAL_DISTANCE = 520;
  const NOMINAL_CARD = { w: 116, h: 146 };
  const AOE_SELECTORS = new Set([
    "enemyMinions",
    "friendlyMinions",
    "friendlyOthers",
    "allOthers",
    "enemies",
    "friendlyBeasts",
  ]);
  const CONTACT_TYPES = new Set(["damage", "shield", "heal", "status"]);
  // Presentation consumes observed results, never infers a status from artwork.
  function outcomeOf(events) {
    const damage = events.filter((e) => e.type === "damage");
    return {
      kind: damage.some((e) => (e.loss ?? e.amount) > 0) ? "damage"
        : events.some((e) => e.type === "shield") ? "shield"
        : damage.length ? "armor"
        : "support",
      freezes: events.some((e) => e.type === "status" && e.kind === "freeze"),
    };
  }
  // Bookkeeping statuses that are not caused by the action's card.
  const PASSIVE_STATUS = new Set(["trigger", "thaw", "expire"]);

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function distance(a, b) {
    return a && b && Number.isFinite(a.x) && Number.isFinite(b.x)
      ? Math.hypot(b.x - a.x, b.y - a.y)
      : NOMINAL_DISTANCE;
  }
  const travel = (dist, speed, min, max) =>
    clamp((dist / speed) * 1000, min, max);

  function tierOfEvent(event, lethal) {
    if (!event) return 1;
    if (event.type === "damage") {
      const loss = event.loss === undefined ? event.amount : event.loss;
      return T.tierOf({
        amount: loss,
        lethal: loss > 0 && lethal,
        heroTarget: event.uid === "hero",
      });
    }
    if (event.type === "heal") return T.tierOf({ amount: event.amount });
    return 1;
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
  function insideDeathrattle(ref, blocks) {
    let id = ref?.parentId || null;
    while (id) {
      const block = blocks.get(id);
      if (!block) return null;
      if (block.kind === "deathrattle") return block.sourceId;
      id = block.parentId || null;
    }
    return null;
  }
  const primaryAction = (type) => ["play", "attack", "power"].includes(type);
  function actionBoundaryIndex(events, index, blocks, blockEnds) {
    const actionId = owningActionId(events[index], blocks);
    const actionEnd = actionId ? blockEnds.get(actionId) : null;
    let boundary = Number.isInteger(actionEnd) ? actionEnd : events.length;
    for (let i = index + 1; i < events.length; i++)
      if (primaryAction(events[i].type)) {
        boundary = Math.min(boundary, i);
        break;
      }
    return boundary;
  }
  function findDirectSummon(events, playIndex, blocks, blockEnds) {
    const play = events[playIndex];
    const boundary = actionBoundaryIndex(events, playIndex, blocks, blockEnds);
    for (let i = playIndex + 1; i < boundary; i++) {
      const candidate = events[i];
      if (
        candidate.type === "summon" &&
        candidate.side === play.side &&
        candidate.cid === play.cid &&
        candidate.parentId === play.parentId &&
        !candidate.rebornFrom
      )
        return { event: candidate, index: i };
    }
    return null;
  }
  /** Did this damage kill its target before the target was hit again? */
  function lethalAt(events, index) {
    const hit = events[index];
    for (let i = index + 1; i < events.length; i++) {
      const e = events[i];
      if (e.type === "damage" && e.side === hit.side && e.uid === hit.uid)
        return false;
      if (e.type === "over" && hit.uid === "hero")
        return e.winner !== hit.side;
      if (e.type !== "death") continue;
      const batch = e.departures || [e];
      if (batch.some((d) => d.side === hit.side && d.uid === hit.uid))
        return true;
    }
    return false;
  }
  /* The events an action's own card caused: effect blocks directly under the
   * action block. Deathrattles, triggers and secrets are nested deeper and are
   * deliberately excluded — they are separate causes (§2.1). */
  function causedEvents(events, primaryIndex, blocks, blockEnds, source) {
    const primary = events[primaryIndex],
      actionId = owningActionId(primary, blocks),
      boundary = actionBoundaryIndex(events, primaryIndex, blocks, blockEnds),
      list = [];
    if (!actionId) return list;
    for (let i = primaryIndex + 1; i < boundary; i++) {
      const e = events[i];
      if (!CONTACT_TYPES.has(e.type) || !e.side || !e.uid) continue;
      if (e.type === "status" && PASSIVE_STATUS.has(e.kind)) continue;
      // Damage without a source (fatigue) is never on the card's path.
      if ((e.type === "damage" || e.type === "shield") && !e.from) continue;
      const parent = blocks.get(e.parentId);
      if (!parent || parent.kind !== "effect" || parent.parentId !== actionId)
        continue;
      if (source !== undefined && parent.sourceId !== source) continue;
      list.push({ event: e, index: i });
    }
    return list;
  }
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
  function defaultCard(cid) {
    try {
      if (typeof EmberData !== "undefined") return EmberData.byId[cid] || null;
      return require("../data.js").byId[cid] || null;
    } catch {
      return null;
    }
  }
  function defaultCastSpec({ kind, cid, battlecry }) {
    try {
      const spec =
        kind === "battlecry"
          ? profiles.fx2Cast(battlecry, defaultCard(cid))
          : kind === "play"
            ? profiles.fx2(cid)
            : null;
      return spec
        ? { kind: spec.fx, tint: spec.tint || null, tintGrad: spec.tintGrad ?? null, swordStyle: spec.swordStyle || null }
        : null;
    } catch {
      return null;
    }
  }
  function patchUnit(frame, view, ref) {
    const src = view?.[ref.side],
      dst = frame?.[ref.side];
    if (!src || !dst) return;
    if (ref.uid === "hero") {
      for (const key of ["hp", "maxHp", "armor", "frozen", "weapon"])
        if (key in src) dst[key] = structuredClone(src[key]);
      return;
    }
    const unit = src.board?.find((m) => m.uid === ref.uid),
      index = dst.board?.findIndex((m) => m.uid === ref.uid) ?? -1;
    if (unit && index >= 0) dst.board[index] = structuredClone(unit);
  }
  function cardTrackId(kind, event) {
    return `card-${kind}-${event.id || event.uid || "event"}`;
  }
  function groupIndexForEvent(groups, eventId) {
    return groups.findIndex((group) =>
      group.events.some((event) => event.id === eventId),
    );
  }
  function attachCardTracks(groups, events, blocks, blockEnds) {
    const tracks = [];
    const drawProfile = profiles.cardMotion.draw;
    const playProfile = profiles.cardMotion.play;
    for (let sourceIndex = 0; sourceIndex < events.length; sourceIndex++) {
      const event = events[sourceIndex];
      if (!event?.id || !["draw", "play"].includes(event.type)) continue;
      const startBeatIndex = groupIndexForEvent(groups, event.id);
      if (startBeatIndex < 0) continue;
      const startBeat = groups[startBeatIndex];
      if (event.type === "draw") {
        const handoffAt =
          startBeat.at + startBeat.hold * drawProfile.handoffFraction;
        const blendEndAt =
          handoffAt + startBeat.hold * drawProfile.blendFraction;
        const endAt = startBeat.at + startBeat.hold * drawProfile.endFraction;
        const track = {
          id: cardTrackId("draw", event),
          kind: "draw",
          sourceEventId: event.id,
          landingEventId: event.id,
          startBeatIndex,
          landingBeatIndex: startBeatIndex,
          sourceRef: { side: event.side, uid: "deck", zone: "deck" },
          targetRef: { side: event.side, uid: event.uid, zone: "hand" },
          face:
            event.side === "p"
              ? { mode: "player-flip", cid: event.cid || null }
              : { mode: "back-only" },
          markers: {
            startAt: startBeat.at,
            liftEndAt: startBeat.at + startBeat.hold * drawProfile.liftFraction,
            flipStartAt:
              event.side === "p"
                ? startBeat.at + startBeat.hold * drawProfile.flipStartFraction
                : null,
            flipEndAt:
              event.side === "p"
                ? startBeat.at + startBeat.hold * drawProfile.flipEndFraction
                : null,
            handoffAt,
            blendEndAt,
            endAt,
          },
        };
        tracks.push(track);
        (startBeat.cardStartIds ??= []).push(track.id);
        (startBeat.cardLandingIds ??= []).push(track.id);
        continue;
      }
      if (event.side !== "p" && event.side !== "e") continue;
      const landing = findDirectSummon(events, sourceIndex, blocks, blockEnds);
      if (!landing) continue;
      const landingBeatIndex = groupIndexForEvent(groups, landing.event.id);
      if (landingBeatIndex < 0) continue;
      const landingBeat = groups[landingBeatIndex];
      const flight = Math.max(0, landingBeat.at - startBeat.at);
      const liftAt =
        startBeat.at + Math.min(playProfile.liftMaxMs, flight * 0.18);
      const approachAt =
        landingBeat.at - Math.min(playProfile.approachMaxMs, flight * 0.18);
      const blendEndAt =
        landingBeat.at + Math.min(playProfile.blendMaxMs, landingBeat.hold);
      const endAt =
        landingBeat.at + Math.min(playProfile.settleMaxMs, landingBeat.hold);
      const track = {
        id: cardTrackId("play", event),
        kind: "play",
        sourceEventId: event.id,
        landingEventId: landing.event.id,
        startBeatIndex,
        landingBeatIndex,
        sourceRef: { side: event.side, uid: event.uid, zone: "hand" },
        targetRef: {
          side: landing.event.side,
          uid: landing.event.uid,
          zone: "board",
        },
        face: { mode: "revealed-play", cid: event.cid || null },
        markers: {
          startAt: startBeat.at,
          liftEndAt: liftAt,
          approachAt: Math.max(startBeat.at, approachAt),
          handoffAt: landingBeat.at,
          blendEndAt,
          endAt,
        },
      };
      tracks.push(track);
      (startBeat.cardStartIds ??= []).push(track.id);
      (landingBeat.cardLandingIds ??= []).push(track.id);
    }
    return tracks;
  }

  /* opts (all optional, all pure):
   *   anchor(ref, frame)  → {x,y,w,h} from the director's sequence snapshot
   *   plan(kind, args)    → {hitAt[], duration}; EmberFx2Engine.plan when present
   *   castSpec(ctx)       → {kind, tint, tintGrad} | null for play/power/battlecry
   *   card(cid)           → card definition (rarity, onPlay selectors)
   *   cutin(ctx)          → boolean; only asked for hero or legendary attackers
   *   figure(ref)         → {melee, windup} | null; a minion attacker's battlefield figure */
  function compile(
    events,
    before,
    final,
    reduced = false,
    attackFamily = "blade",
    opts = null,
  ) {
    const o = opts || {};
    const anchor = typeof o.anchor === "function" ? o.anchor : () => null;
    const card = typeof o.card === "function" ? o.card : defaultCard;
    const castSpec =
      typeof o.castSpec === "function" ? o.castSpec : defaultCastSpec;
    const stopMs = (tier) => (reduced ? 0 : T.tiers[tier]?.hitStopMs || 0);
    const planner = typeof o.plan === "function" ? o.plan : engine().plan;
    /* hitAt from the cast() call (it opens with the caster flash), excluding
     * hit-stop. Missing anchors plan over nominal, distinct distances so the
     * near-to-far order of the given targets is kept. */
    const plan = (kind, { from, targets, tier, aoe }) => {
      if (!targets.length) return { hitAt: [], duration: T.spell.castFlash + T.spell.link };
      const origin = from || { x: 0, y: 0, ...NOMINAL_CARD };
      const boxes = targets.map(
        (box, i) => box || { x: origin.x, y: origin.y - NOMINAL_DISTANCE - i, ...NOMINAL_CARD },
      );
      const result = planner(kind, { from: origin, targets: boxes, tier, aoe });
      if (
        !result ||
        !Array.isArray(result.hitAt) ||
        result.hitAt.length !== targets.length ||
        !result.hitAt.every(Number.isFinite)
      )
        throw new Error("plan() must return one hitAt per target: " + kind);
      return result;
    };

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

    // Frames: the displayed state after each beat, plus per-event views so a
    // contact can reveal exactly the units it has touched.
    let frame = structuredClone(before || final || {});
    for (const group of groups) {
      const contactGroup = ["hit", "heal"].includes(group.kind) ||
        group.kind.startsWith("status:");
      if (contactGroup) group.base = structuredClone(frame);
      for (const e of group.events)
        if (e.view) {
          for (const side of ["p", "e"])
            if (e.view[side])
              Object.assign(frame[side] ||= {}, structuredClone(e.view[side]));
          for (const key of ["active", "turn", "phase2"])
            frame[key] = e.view[key];
        }
      group.frame = structuredClone(frame);
      group.blockId = group.parentId || null;
      group.actionId = owningActionId(group.events[0], blocks);
      group.actor = null;
      group.targets = [];
      group.tier = 1;
      group.rule = { aoe: false, status: group.kind.startsWith("status:") };
      group.contacts = [];
      const rattle = insideDeathrattle(group.events[0], blocks);
      if (rattle) group.sourceId = rattle;
    }

    // Contact registry: event id → planned contact (cause, time, tier).
    const planned = new Map();
    const castRecords = [];
    let at = 0;
    const eventIndexOf = (event) => events.indexOf(event);

    function registerCast(group, primaryIndex, actor, source, spec, startAt, extra = {}) {
      const caused = causedEvents(events, primaryIndex, blocks, blockEnds, source);
      const order = [];
      const byRef = new Map();
      for (const { event, index } of caused) {
        const key = refKey(event);
        if (!byRef.has(key)) {
          const ref = plainRef(event);
          byRef.set(key, { ref, events: [], tier: 1, status: true });
          order.push(key);
        }
        const entry = byRef.get(key),
          eventTier = tierOfEvent(event, lethalAt(events, index));
        entry.events.push({ event, tier: eventTier });
        entry.tier = Math.max(entry.tier, eventTier);
        if (event.type !== "status") entry.status = false;
      }
      const from = anchor(actor, group.frame);
      if (from)
        order.sort(
          (a, b) =>
            distance(from, anchor(byRef.get(a).ref, group.frame)) -
            distance(from, anchor(byRef.get(b).ref, group.frame)),
        );
      const card0 = extra.cid ? card(extra.cid) : null;
      const selectorAoe = (card0?.onPlay || extra.effects || []).some((effect) =>
        AOE_SELECTORS.has(effect?.to),
      );
      const targets = order.map((key) => byRef.get(key));
      const aoe = targets.length > 1 || (selectorAoe && targets.length > 0);
      const statusOnly = targets.length > 0 && targets.every((t) => t.status);
      const tier = targets.reduce((n, t) => Math.max(n, t.tier), 1);
      const result = plan(spec?.kind || null, {
        from,
        targets: targets.map((t) => anchor(t.ref, group.frame)),
        tier,
        aoe,
      });
      const cast = {
        beatIndex: groups.indexOf(group),
        kind: spec?.kind || null,
        tint: spec?.tint || null,
        tintGrad: spec?.tintGrad ?? null,
        swordStyle: spec?.swordStyle || null,
        actor: plainRef(actor),
        targets: targets.map((t) => t.ref),
        tiers: targets.map((t) => t.tier),
        outcomes: targets.map((t) => outcomeOf(t.events.map((x) => x.event))),
        tier,
        aoe,
        link: statusOnly,
        flashAt: startAt,
        flashMs: T.spell.castFlash,
        startAt,
        hitAt: result.hitAt.slice(),
        // Actual contact per target (sequence ms), after any hit-stop shift.
        contactAt: result.hitAt.map((ms) => startAt + ms),
        duration: result.duration,
      };
      targets.forEach((t, i) => {
        for (const { event, tier: eventTier } of t.events)
          planned.set(event, {
            cast,
            targetIndex: i,
            at: startAt + result.hitAt[i],
            tier: eventTier,
            actor: cast.actor,
          });
      });
      castRecords.push(cast);
      group.cast = cast;
      group.targets = cast.targets.slice();
      group.tier = tier;
      group.rule = { aoe, status: statusOnly };
      return cast;
    }

    // From the cast() call to its first contact (or the end of a target-less cast).
    const castLead = (cast) =>
      cast.hitAt.length ? Math.min(...cast.hitAt) : T.spell.castFlash + T.spell.link;
    for (const [gi, group] of groups.entries()) {
      group.at = at;
      const first = group.events[0];
      const firstIndex = group.eventIndexes[0];
      switch (group.kind) {
        case "play": {
          const def = card(first.cid);
          group.actor = { side: first.side, uid: "hero" };
          if (def?.type === "minion") {
            group.actor = { side: first.side, uid: first.uid, zone: "hand" };
            group.hold = profiles.get(first.cid).windup;
            const landing = findDirectSummon(events, firstIndex, blocks, blockEnds);
            if (landing) group.targets = [plainRef(landing.event)];
            break;
          }
          const countered = events
            .slice(firstIndex + 1, actionBoundaryIndex(events, firstIndex, blocks, blockEnds))
            .some((e) => e.type === "secret" && e.side !== first.side);
          group.countered = countered;
          const spec = countered
            ? null
            : castSpec({ kind: "play", cid: first.cid, side: first.side, frame: group.frame });
          const cast = registerCast(group, firstIndex, group.actor, first.cid, spec, at, {
            cid: first.cid,
          });
          group.hold = castLead(cast);
          break;
        }
        case "power": {
          group.actor = { side: first.side, uid: "hero" };
          const spec = castSpec({ kind: "power", side: first.side, frame: group.frame });
          const cast = registerCast(group, firstIndex, group.actor, undefined, spec, at, {
            effects: o.powerEffects?.(first.side) || [],
          });
          group.hold = castLead(cast);
          break;
        }
        case "attack": {
          const attack = first,
            attackId = attack.id || "attack-" + gi,
            actionEnd = group.actionId ? blockEnds.get(group.actionId) : null,
            nextAttack = groups
              .slice(gi + 1)
              .find((candidate) => candidate.kind === "attack")?.eventIndexes[0],
            boundary = Math.min(
              ...[actionEnd, nextAttack, events.length].filter(Number.isInteger),
            ),
            candidates = groups
              .slice(gi + 1)
              .filter((candidate) => (candidate.eventIndexes?.[0] ?? Infinity) < boundary),
            cid = sourceCid(group.frame, attack.from),
            resolvedFamily =
              attack.attack || sourceFamily(group.frame, attack.from, attackFamily),
            // a minion with a battlefield figure attacks the way its figure does (melee dash or ranged shot)
            figure =
              attack.from?.uid !== "hero" && typeof o.figure === "function"
                ? o.figure({ side: attack.from?.side, uid: attack.from?.uid, cid }) || null
                : null,
            ranged = figure ? !figure.melee : profiles.ranged(resolvedFamily),
            matches = (e, direction) => {
              if (!["damage", "shield"].includes(e.type) || !sameParent(attack, e))
                return false;
              const from = direction === "outgoing" ? attack.from : attack.to,
                to = direction === "outgoing" ? attack.to : attack.from;
              return sameRef(e.from, from) && e.side === to.side && e.uid === to.uid;
            },
            pairs = candidates.flatMap((candidate) =>
              candidate.events.map((event) => ({ candidate, event })),
            ),
            outgoing = pairs.find(({ event }) => matches(event, "outgoing")),
            returns = pairs.filter(({ event }) => matches(event, "retaliation"));
          const outgoingTier = outgoing
            ? tierOfEvent(outgoing.event, lethalAt(events, eventIndexOf(outgoing.event)))
            : 1;
          const returnTier = returns.reduce(
            (n, r) => Math.max(n, tierOfEvent(r.event, lethalAt(events, eventIndexOf(r.event)))),
            1,
          );
          const tier = Math.max(outgoingTier, returnTier),
            def = cid ? card(cid) : null,
            hero = attack.from?.uid === "hero",
            legendary = !hero && def?.rarity === "legendary";
          group.cutin =
            !reduced &&
            (hero || legendary) &&
            !!o.cutin?.({
              side: attack.from?.side,
              uid: attack.from?.uid,
              cid,
              hero,
              legendary,
            });
          const flight = ranged
            ? travel(
                distance(anchor(attack.from, group.frame), anchor(attack.to, group.frame)),
                T.attack.rangedSpeed,
                T.attack.rangedMin,
                T.attack.rangedMax,
              )
            : 0;
          // a shooting figure draws before the shot leaves (bow, staff, breath)
          const windup = figure && ranged ? Math.max(0, figure.windup || 0) : 0;
          let lead = ranged
            ? T.attack.rangedRecoil + windup + flight
            : T.attack.lift + T.attack.lunge;
          if (group.cutin) lead = Math.max(lead, T.cutin.lead);
          const stop = stopMs(tier),
            recover = ranged ? 0 : T.attack.recover;
          group.actor = plainRef(attack.from);
          group.targets = [plainRef(attack.to)];
          group.tier = tier;
          group.attackId = attackId;
          group.sourceCid = cid;
          group.attackFamily = resolvedFamily;
          group.hold = lead;
          group.motion = {
            family: resolvedFamily,
            ranged,
            lift: ranged ? T.attack.rangedRecoil + windup : lead - T.attack.lunge,
            lunge: ranged ? 0 : T.attack.lunge,
            flight,
            contact: lead,
            hitStop: stop,
            release: lead + stop,
            recoveryEnd: lead + stop + recover,
            duration: lead + stop + recover,
            recoilPx: T.tiers[outgoingTier].recoilPx,
            tier,
            figure: !!figure,
          };
          group.markers = {
            start: at,
            anticipation: at + group.motion.lift,
            contact: outgoing ? at + lead : null,
            release: outgoing ? at + lead + stop : null,
            recoveryEnd: outgoing ? at + lead + stop + recover : null,
            end: at + group.motion.duration,
          };
          const contactAt = at + lead;
          const link = (event, direction, eventTier) => {
            const record = {
              attackId,
              direction,
              eventId: event.id,
              targetRef: plainRef(event),
              sourceRef: plainRef(event.from),
              family: direction === "outgoing" ? resolvedFamily : sourceFamily(group.frame, event.from, "blade"),
              sourceCid: direction === "outgoing" ? cid : sourceCid(group.frame, event.from),
              tier: eventTier,
              outcome: outcomeOf([event]),
              heavy: eventTier === 3,
              recoilPx: T.tiers[eventTier].recoilPx,
              contactAt,
              releaseAt: contactAt + stop,
              recoveryEndAt: contactAt + stop + T.attack.recover,
              actorRecoveryEndAt: at + group.motion.recoveryEnd,
            };
            planned.set(event, {
              attack: group,
              at: contactAt,
              tier: eventTier,
              actor: plainRef(event.from),
              link: record,
            });
            return record;
          };
          if (outgoing) group.contacts.push(link(outgoing.event, "outgoing", outgoingTier));
          for (const r of returns)
            link(r.event, "retaliation", tierOfEvent(r.event, lethalAt(events, eventIndexOf(r.event))));
          break;
        }
        case "summon": {
          const def = card(first.cid);
          const arrival =
            !first.rebornFrom &&
            group.events.length === 1 &&
            def?.rarity === "legendary";
          group.targets = group.events.map(plainRef);
          group.legendary = arrival;
          group.hold = T.summon.land + (arrival ? T.summon.legendary : 0);
          // Battlecry: the summoned minion is the actor, its own effect blocks
          // are the targets; the visual only exists when it has targets.
          const playIndex = events.findIndex(
            (e, i) =>
              i < firstIndex &&
              e.type === "play" &&
              findDirectSummon(events, i, blocks, blockEnds)?.event === first,
          );
          if (playIndex >= 0 && !first.rebornFrom) {
            const actor = plainRef(first),
              caused = causedEvents(events, playIndex, blocks, blockEnds, first.uid);
            if (caused.length) {
              const spec = castSpec({
                kind: "battlecry",
                cid: first.cid,
                battlecry: profiles.get(first.cid).battlecry,
                side: first.side,
                frame: group.frame,
              });
              const startAt = at + group.hold;
              const cast = registerCast(group, playIndex, actor, first.uid, spec, startAt, {
                effects: def?.onPlay,
              });
              group.targets = group.events.map(plainRef);
              group.battlecry = cast;
              group.actor = actor;
              group.hold += castLead(cast);
            }
          }
          break;
        }
        case "death":
          group.targets = group.events.map(plainRef);
          group.hold = T.death.freeze + T.death.dissolve + T.death.reflow;
          break;
        case "draw":
          group.actor = { side: first.side, uid: "deck" };
          group.targets = [{ side: first.side, uid: first.uid }];
          group.hold = T.draw;
          break;
        case "burn":
          group.hold = T.draw;
          break;
        case "turn":
          // The cue itself lasts EmberTiming.turnCue but never locks input.
          group.hold = 220;
          break;
        case "over":
          group.hold = 700;
          break;
        case "phase":
          group.hold = 1800;
          break;
        case "contract":
          group.hold = first.divine ? 1700 : 650;
          break;
        case "secret":
          group.actor = { side: first.side, uid: "hero" };
          group.hold = 420;
          break;
        case "weaponWear":
          group.targets = [{ side: first.side, uid: "hero" }];
          group.hold = 200;
          break;
        default: {
          // hit / heal / status:* — every event is a contact.
          let last = at,
            maxTier = 1;
          for (const [i, event] of group.events.entries()) {
            const index = group.eventIndexes[i];
            const known = planned.get(event);
            const tier = known?.tier ?? tierOfEvent(event, lethalAt(events, index));
            const contactAt = Math.max(at, known?.at ?? at);
            const stop = stopMs(tier);
            const direction = known?.link?.direction || (known?.cast ? "cast" : "sourceless");
            const record = {
              ...(known?.link || {}),
              eventId: event.id,
              targetRef: plainRef(event),
              direction,
              kind: event.type === "status" ? "status:" + event.kind : event.type,
              actor: known?.actor || null,
              castBeat: known?.cast ? known.cast.beatIndex : known?.attack ? groups.indexOf(known.attack) : null,
              targetIndex: known?.targetIndex ?? 0,
              tier,
              heavy: tier === 3,
              recoilPx: T.tiers[tier].recoilPx,
              contactAt,
              releaseAt: contactAt + stop,
              recoveryEndAt: contactAt + stop + T.attack.recover,
            };
            group.contacts.push(record);
            last = Math.max(last, contactAt);
            maxTier = Math.max(maxTier, tier);
          }
          /* One impulse per beat, at the first highest-tier contact. Its hit-stop
           * freezes the effect world, so every later contact of this beat moves
           * back by the same hit-stop (§4.1, engine plan excludes hit-stop). */
          const impulseAt = Math.min(
            ...group.contacts.filter((c) => c.tier === maxTier).map((c) => c.contactAt),
          );
          const shift = stopMs(maxTier);
          group.impulseAt = impulseAt;
          for (const c of group.contacts)
            if (c.contactAt > impulseAt && shift > 0) {
              c.contactAt += shift;
              c.releaseAt += shift;
              c.recoveryEndAt += shift;
              last = Math.max(last, c.contactAt);
            }
          for (const [i, c] of group.contacts.entries()) {
            const known = planned.get(group.events[i]);
            if (known?.cast && known.cast.contactAt[c.targetIndex] === known.at)
              known.cast.contactAt[c.targetIndex] = c.contactAt;
          }
          const actors = group.contacts.map((c) => c.actor).filter(Boolean);
          group.actor =
            actors.length && actors.every((a) => sameRef(a, actors[0]))
              ? actors[0]
              : null;
          group.targets = group.contacts.map((c) => c.targetRef);
          group.tier = maxTier;
          group.rule = {
            aoe: !!group.contacts.find((c) => c.direction === "cast") &&
              !!castRecords.find((c) => c.beatIndex === group.contacts[0].castBeat)?.aoe,
            status: group.kind.startsWith("status:"),
          };
          group.hold = last - at + stopMs(maxTier) + T.death.delay;
          // Buckets: one render per distinct contact time, each frame showing
          // only the units already touched. The last bucket is the full frame.
          const times = [...new Set(group.contacts.map((c) => c.contactAt))].sort(
            (a, b) => a - b,
          );
          const touched = structuredClone(group.base);
          group.buckets = times.map((time, n) => {
            const list = group.contacts
              .map((c, i) => (c.contactAt === time ? i : -1))
              .filter((i) => i >= 0);
            for (const i of list) patchUnit(touched, group.events[i].view, group.contacts[i].targetRef);
            return {
              at: time,
              contacts: list,
              frame: n === times.length - 1 ? group.frame : structuredClone(touched),
            };
          });
          delete group.base;
        }
      }
      group.markers ??= { start: group.at, end: group.at + group.hold };
      at += group.hold;
    }

    const cardTracks = attachCardTracks(groups, events, blocks, blockEnds);
    // Pathological chains stay bounded without changing causal order. The same
    // scale applies to every clock the director reads: beats, contacts, casts,
    // hit-stops, DOM motion and card tracks (§4.2).
    const presentationEnd = Math.max(
      at,
      ...groups.map((group) => group.markers.end),
      ...castRecords.map((cast) => cast.startAt + cast.duration),
    );
    const scale =
      (reduced ? 0.5 : 1) * Math.min(1, 6500 / Math.max(1, presentationEnd));
    const scaleKeys = (object, keys) => {
      for (const key of keys)
        if (typeof object?.[key] === "number") object[key] *= scale;
    };
    const seen = new Set();
    for (const group of groups) {
      scaleKeys(group, ["at", "hold"]);
      for (const key of Object.keys(group.markers))
        if (group.markers[key] !== null) group.markers[key] *= scale;
      if (group.motion) {
        scaleKeys(group.motion, [
          "lift", "lunge", "flight", "contact", "hitStop", "release", "recoveryEnd", "duration",
        ]);
        Object.freeze(group.motion);
      }
      for (const contact of group.contacts) {
        if (seen.has(contact)) continue;
        seen.add(contact);
        scaleKeys(contact, ["contactAt", "releaseAt", "recoveryEndAt", "actorRecoveryEndAt"]);
      }
      for (const bucket of group.buckets || []) bucket.at *= scale;
      if (typeof group.impulseAt === "number") group.impulseAt *= scale;
    }
    for (const cast of castRecords) {
      scaleKeys(cast, ["flashAt", "flashMs", "startAt", "duration"]);
      cast.hitAt = cast.hitAt.map((ms) => ms * scale);
      cast.contactAt = cast.contactAt.map((ms) => ms * scale);
    }
    for (const track of cardTracks)
      for (const key of Object.keys(track.markers))
        if (track.markers[key] !== null) track.markers[key] *= scale;
    return {
      beats: groups,
      casts: castRecords,
      duration: presentationEnd * scale,
      scale,
      reduced: !!reduced,
      cardTracks,
    };
  }
  return Object.freeze({ compile, refKey, outcomeOf });
})();
if (typeof module !== "undefined") module.exports = EmberCombat;
