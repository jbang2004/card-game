/* EmberFX — the battle presentation director (docs/design/BATTLE_PRESENTATION_V2.md §3).
 *
 *   engine events ─► EmberCombat.compile (pure beats: actor / targets / tier / blockId / rule)
 *                 ─► recipes[beat.kind]   one recipe per event kind
 *                 ─► timeline.at(ms, fn)  one ordered clock per sequence (sequence.origin)
 *                 ─► DOM (card motion, reactions, numbers, cues) + EmberFx2 (the only effect backend)
 *
 * anchors.resolve is the only place that turns a {side, uid} into a box; every
 * presentation writes one EmberFX.trace record for causal assertions. Rules
 * never depend on an animation clock; cancelled scenes clean up timers, clones
 * and the input lock. No network assets are used.
 */
const EmberFX = (() => {
  "use strict";
  const T = EmberTiming;
  let W = EmberViewport.width,
    H = EmberViewport.height;
  const app = document.getElementById("app");
  const world = document.getElementById("world-canvas"),
    wc = world.getContext("2d");
  // Accent colour per school: death-edge line and the phase cinematic.
  const accents = {
    steel: "#aab5b1",
    fire: "#f1a35c",
    frost: "#86dcec",
    arcane: "#b3a3e8",
    nature: "#a6d6a2",
    holy: "#eac992",
    shadow: "#a77dc8",
    blood: "#d98c88",
  };
  let timers = new Set(),
    animations = new Set(),
    nodes = new Set(),
    layoutOwners = new Map(),
    attackOwners = new Map(),
    generation = 0,
    presentationVersion = 0,
    busy = false,
    pendingCommit = null,
    doneCallback = null,
    activeSequence = null;
  let view = "lobby",
    theme = 0,
    phase = false,
    quality = { reduced: false, low: false },
    worldDirty = true;
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const refKey = (ref) => (ref ? ref.side + ref.uid : "");

  /* ------------------------------------------------------------------ trace
   * One record per presentation. Bounded to the latest TRACE_LIMIT entries so
   * it can stay on outside ?debug=1 without growing. Times are
   * performance.now() values. */
  const TRACE_LIMIT = 200;
  const trace = [];
  let traceSeq = 0;
  const point = (box) =>
    box ? { x: round(box.x), y: round(box.y) } : null;
  const round = (n) => Math.round(n * 10) / 10;
  const plainBox = (box) =>
    box
      ? {
          x: round(box.x),
          y: round(box.y),
          w: round(box.w),
          h: round(box.h),
          left: round(box.left ?? box.x - box.w / 2),
          top: round(box.top ?? box.y - box.h / 2),
        }
      : null;
  const traced = (ref, box) =>
    ref ? { side: ref.side, uid: ref.uid, box: plainBox(box) } : null;
  function tracePush(entry) {
    const rec = { seq: ++traceSeq, ...entry };
    trace.push(rec);
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
    return rec;
  }
  function traceWarn(sequence, beat, message, ref = null) {
    return tracePush({
      beat,
      type: "warn",
      kind: message,
      sequence: sequence?.id ?? null,
      actor: null,
      targets: ref ? [traced(ref, null)] : [],
      from: null,
      to: [],
      tier: 0,
      at: performance.now(),
      hitAt: [],
      contactBox: [],
      numberAt: [],
    });
  }

  /* ----------------------------------------------------------------- clocks */
  function schedule(fn, ms) {
    const gen = generation;
    const callback = () => {
      timers.delete(id);
      if (gen === generation) fn();
    };
    if (fn?.__emberCardTimerMeta)
      callback.__emberCardTimerMeta = fn.__emberCardTimerMeta;
    const id = setTimeout(callback, ms);
    timers.add(id);
    return id;
  }
  let sequenceIds = 0;
  function createSequence(plan, version = presentationVersion) {
    const sequence = {
      id: ++sequenceIds,
      generation,
      version,
      origin: performance.now(),
      plan,
      closed: false,
      reactions: new Map(),
      cards: new Map(),
      records: new Map(),
      anchors: new Map(),
      queue: [],
      queueOrder: 0,
      timer: null,
      timerAt: Infinity,
      pumping: false,
      cardLandingIds: new Set(
        (plan.cardTracks || [])
          .filter((track) => track.kind === "play")
          .map((track) => track.landingEventId),
      ),
    };
    activeSequence = sequence;
    return sequence;
  }
  function closeSequence(sequence = activeSequence) {
    if (!sequence) return;
    sequence.closed = true;
    sequence.queue.length = 0;
    if (activeSequence === sequence) activeSequence = null;
  }
  function isCurrentSequence(sequence) {
    return (
      !!sequence &&
      !sequence.closed &&
      sequence.generation === generation &&
      sequence.version === presentationVersion &&
      activeSequence === sequence
    );
  }
  /** Card tracks keep one real timer per marker (their tests observe them). */
  function scheduleAt(sequence, at, fn) {
    if (!sequence) return schedule(fn, at);
    const delay = Math.max(0, sequence.origin + at - performance.now());
    const callback = () => {
      if (!isCurrentSequence(sequence)) return;
      fn();
    };
    if (fn?.__emberCardTimerMeta)
      callback.__emberCardTimerMeta = fn.__emberCardTimerMeta;
    return schedule(callback, delay);
  }
  /* timeline.at — the director's single clock. Entries run strictly in
   * (at, registration) order from one pending timer, so two steps due in the
   * same millisecond can never swap because of timer rounding. */
  const timeline = {
    at(sequence, at, fn) {
      const entry = { at: Math.max(0, at), order: sequence.queueOrder++, fn };
      const queue = sequence.queue;
      let lo = 0,
        hi = queue.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const q = queue[mid];
        if (q.at < entry.at || (q.at === entry.at && q.order < entry.order))
          lo = mid + 1;
        else hi = mid;
      }
      queue.splice(lo, 0, entry);
      if (!sequence.pumping) arm(sequence);
    },
  };
  function arm(sequence) {
    if (!isCurrentSequence(sequence)) return;
    const next = sequence.queue[0];
    if (!next) return;
    if (sequence.timer !== null && sequence.timerAt <= next.at) return;
    if (sequence.timer !== null) {
      clearTimeout(sequence.timer);
      timers.delete(sequence.timer);
    }
    sequence.timerAt = next.at;
    sequence.timer = schedule(() => {
      sequence.timer = null;
      sequence.timerAt = Infinity;
      pump(sequence);
    }, Math.max(0, sequence.origin + next.at - performance.now()));
  }
  function pump(sequence) {
    if (!isCurrentSequence(sequence)) return;
    sequence.pumping = true;
    try {
      while (isCurrentSequence(sequence) && sequence.queue.length) {
        const elapsed = performance.now() - sequence.origin;
        if (sequence.queue[0].at > elapsed + 1) break;
        sequence.queue.shift().fn();
      }
    } finally {
      sequence.pumping = false;
    }
    arm(sequence);
  }
  const scaled = (sequence, ms) => ms * (sequence?.plan?.scale ?? 1);

  /* ------------------------------------------------------------ fx backend
   * EmberFx2 is the only effect backend (§2.7). Reduced motion or an
   * unavailable backend leaves DOM motion and numbers only. The calls are
   * guarded until the V2 engine interface (§3.3) is present. */
  const fx2 = () => (typeof EmberFx2 !== "undefined" ? EmberFx2 : null);
  const fxReady = () =>
    !quality.reduced && !!fx2()?.available && typeof fx2().attack === "function";
  function fxCall(name, ...args) {
    if (!fxReady() || typeof EmberFx2[name] !== "function") return false;
    try {
      EmberFx2[name](...args);
      return true;
    } catch (err) {
      return false;
    }
  }
  function lifeCue(ctx,e,kind,box,options={}) {
    if(!box||quality.reduced||!fx2()?.renderer3dAvailable||typeof EmberFx2.lifecycle!=="function")return false;
    const ref=options.targetRef||{side:e.side,uid:e.uid||"hero"};
    const key=[e.id||"event",kind,ref.side,ref.uid].join(":");
    ctx.lifecycleSeen ||= new Set();if(ctx.lifecycleSeen.has(key))return false;
    const previous=ctx.lifecycleBefore?.[refKey(ref)]||ctx.history?.[refKey(ref)];
    const out=EmberFx2.lifecycle(kind,{at:fxBox(box),sourceCid:e.cid||previous?.cid||null,
      previousCid:previous?.cid||null,artPosition:previous?.artPosition||null,targetRef:ref,sequenceId:ctx.sequence.id,groupId:"life-"+ctx.sequence.id,
      seed:ctx.sequence.id*71+[...String(e.id||0)].reduce((n,c)=>(n*31+c.charCodeAt(0))%100003,0),timeScale:ctx.sequence.plan.scale,...options});
    if(out)ctx.lifecycleSeen.add(key);return !!out;
  }
  const fxBox = (box) =>
    box
      ? {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          left: box.left ?? box.x - box.w / 2,
          top: box.top ?? box.y - box.h / 2,
        }
      : null;
  /** §2.3: a single target's contact never exceeds its box × contactScale
   * (≤ 1.25); an AOE contact stays inside the union of its targets + 24px. */
  function contactBoxes(boxes, tiers, aoe) {
    if (aoe && boxes.some(Boolean)) {
      const valid = boxes.filter(Boolean),
        left = Math.min(...valid.map((b) => b.x - b.w / 2)) - T.aoePad,
        right = Math.max(...valid.map((b) => b.x + b.w / 2)) + T.aoePad,
        top = Math.min(...valid.map((b) => b.y - b.h / 2)) - T.aoePad,
        bottom = Math.max(...valid.map((b) => b.y + b.h / 2)) + T.aoePad,
        union = plainBox({
          x: (left + right) / 2,
          y: (top + bottom) / 2,
          w: right - left,
          h: bottom - top,
        });
      return boxes.map((b) => (b ? union : null));
    }
    return boxes.map((b, i) => {
      if (!b) return null;
      const s = Math.min(T.contactBoxMax, T.tiers[tiers[i] || 1].contactScale);
      return plainBox({ x: b.x, y: b.y, w: b.w * s, h: b.h * s });
    });
  }

  /* --------------------------------------------------------------- anchors
   * §3.2: the hero anchor is the hero CARD, never the #player-hero /
   * #enemy-hero host (on phones that host is the whole console strip). */
  const HERO_CARD = ".hero-card-inner";
  function pos(el) {
    return EmberViewport.pos(el);
  }
  function heroHost(side) {
    return document.getElementById(side === "p" ? "player-hero" : "enemy-hero");
  }
  /** Rule host of a unit: the minion element, or the hero button. */
  function unit(side, uid) {
    return uid === "hero"
      ? heroHost(side)
      : document.querySelector(`#battle .minion[data-uid="${uid}"]`);
  }
  /** Visible card face of a unit. */
  function anchorEl(ref) {
    if (!ref) return null;
    return ref.uid === "hero"
      ? heroHost(ref.side)?.querySelector(HERO_CARD) || null
      : unit(ref.side, ref.uid);
  }
  function measure(ref) {
    const el = anchorEl(ref),
      box = el && pos(el);
    return box ? { ...box, el } : null;
  }
  function captureAnchors() {
    const map = new Map();
    for (const el of document.querySelectorAll("#battle .minion[data-uid]")) {
      const box = pos(el);
      if (box && el.dataset.side)
        map.set(el.dataset.side + el.dataset.uid, box);
    }
    for (const side of ["p", "e"]) {
      const box = measure({ side, uid: "hero" });
      if (box) map.set(side + "hero", { ...box, el: undefined });
    }
    return map;
  }
  function recordAnchors(sequence, refs = null) {
    if (!sequence?.anchors) return;
    if (!refs) {
      for (const [key, box] of captureAnchors()) sequence.anchors.set(key, box);
      return;
    }
    for (const ref of refs) {
      const box = measure(ref);
      if (box) sequence.anchors.set(refKey(ref), { ...box, el: undefined });
    }
  }
  const anchors = {
    /** The only anchor function. A lunging attacker resolves to its clone's
     * live position; everything else to the sequence snapshot. */
    resolve(ref, snapshot) {
      if (!ref) return null;
      const owner = attackOwners.get(refKey(ref));
      if (owner && !owner.dead && owner.anchorEl?.isConnected) {
        const live = pos(owner.anchorEl);
        if (live) return live;
      }
      const box = snapshot?.get(refKey(ref));
      return box
        ? {
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
            left: box.left,
            top: box.top,
          }
        : null;
    },
  };
  function resolveOrWarn(sequence, beat, ref, what) {
    const box = anchors.resolve(ref, sequence.anchors);
    if (!box && ref) traceWarn(sequence, beat, "missing-anchor:" + what, ref);
    return box;
  }

  /* ---------------------------------------------------------------- DOM kit */
  function animate(el, frames, options, onFinish = null) {
    const animation = el.animate(frames, options);
    animations.add(animation);
    animation.onfinish = () => {
      animation.cancel();
      animations.delete(animation);
      onFinish?.(animation);
    };
    animation.oncancel = () => animations.delete(animation);
    return animation;
  }
  function transient(className, duration) {
    const el = document.createElement("div");
    el.className = className;
    el.setAttribute("aria-hidden", "true");
    app.appendChild(el);
    nodes.add(el);
    schedule(() => {
      el.remove();
      nodes.delete(el);
    }, duration);
    return el;
  }
  function setBusy(v) {
    busy = v;
    app.classList.toggle("fx-busy", v);
    document.dispatchEvent(new CustomEvent("ember:fx-busy", { detail: v }));
    const el = document.getElementById("action-status");
    if (el) el.textContent = v ? "RESOLVING · 战斗结算" : "";
  }
  function sound(type, p, options = {}) {
    EmberAudio.fx(type, { pan: p ? (p.x / W - 0.5) * 1.1 : 0, ...options });
  }
  function schoolOf(card, attack = false) {
    if (!card) return attack ? "steel" : "fire";
    if (attack) {
      if (["knight", "golem", "archer", "rogue", "wolf", "reaper"].includes(card.art))
        return "steel";
      if (card.art === "dragon" || card.art === "phoenix") return "fire";
      if (card.art === "spider" || card.art === "treant") return "nature";
    }
    return EmberFXProfiles.fromPalette(card.palette);
  }
  function powerSchool(side, s) {
    return side === "e" && s?.mode !== "practice"
      ? EmberFXProfiles.fromPalette(EmberData.bosses[s?.bossIndex]?.palette)
      : { mage: "fire", paladin: "holy", ranger: "steel" }[
          side === "e" ? s?.opponentHero : s?.heroId
        ] || "arcane";
  }

  /* ------------------------------------------------------------------ cues */
  function clearTurnCue() {
    for (const node of [...nodes]) {
      if (!node.matches(".turn-cue")) continue;
      node.getAnimations().forEach((a) => a.cancel());
      node.remove();
      nodes.delete(node);
    }
  }
  function turnCue(side, turn) {
    clearTurnCue();
    const life = T.turnCue;
    const el = transient("turn-cue " + (side === "p" ? "ours" : "theirs"), life);
    const laneP = EmberViewport.lane("p"),
      laneE = EmberViewport.lane("e");
    el.style.left = (laneP.x + laneE.x) / 2 + "px";
    const enemy = pos(document.querySelector("#battle .minion.enemy")),
      friendly = pos(document.querySelector("#battle .minion.friendly"));
    const upper = enemy ? enemy.top + enemy.h : laneE.y + 50,
      lower = friendly ? friendly.top : laneP.y - 50,
      gap = lower - upper;
    el.style.top = (upper + lower) / 2 + "px";
    if (gap < 52) el.classList.add("compact");
    el.innerHTML = `<span class="turn-cue-gem">✦</span><div><small>TURN ${String(turn).padStart(2, "0")}</small><strong>${side === "p" ? "你的回合" : "敌方回合"}</strong></div><span class="turn-cue-gem">✦</span>`;
    if (!quality.reduced)
      animate(
        el,
        [
          { opacity: 0, translate: "0 9px", scale: ".84" },
          { opacity: 1, translate: "0 0", scale: "1.04", offset: 0.18 },
          { opacity: 1, scale: "1", offset: 0.72 },
          { opacity: 0, translate: "0 -8px", scale: "1" },
        ],
        { duration: life, easing: "ease-out" },
      );
  }
  function cue(p, text, kind = "status") {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const el = transient("combat-cue cue-" + kind, quality.reduced ? 700 : 950);
    el.textContent = text;
    el.style.left = p.x + "px";
    el.style.top = p.y - (Number(p.h) || 0) * 0.35 + "px";
    if (!quality.reduced)
      animate(
        el,
        [
          { opacity: 0, translate: "0 7px", scale: ".9" },
          { opacity: 1, translate: "0 0", scale: "1", offset: 0.18 },
          { opacity: 1, offset: 0.7 },
          { opacity: 0, translate: "0 -10px" },
        ],
        { duration: 940 },
      );
  }

  /* --------------------------------------------------------- damage numbers
   * An irregular splat (inline SVG) behind a bold white number. The shape is
   * stable per unit. 120ms pop + hold + fade, one CSS animation for all. */
  const SPLAT_SHAPES = Object.freeze([
    "M15 47c-2-11 5-21 16-26 7-3 10-12 19-13 9-1 13 8 21 10 11 3 21 9 22 20 1 9-7 14-7 22 0 9 3 19-5 23-9 5-17-4-26-2-9 1-15 9-23 5-9-4-9-15-13-21-3-6-3-11-4-18Z",
    "M11 53c0-13 10-20 18-27 6-5 5-15 14-17 10-2 17 7 26 9 10 2 22 6 23 17 1 10-10 15-11 24-1 8 5 18-4 23-9 5-18-5-28-3-9 2-14 11-23 7-9-4-8-16-11-22-3-6-4-7-4-11Z",
    "M17 41c2-10 12-16 20-21 7-4 10-14 19-12 10 2 13 13 21 18 9 5 18 13 15 23-3 10-15 11-19 19-4 8-1 20-10 22-10 2-16-9-25-12-9-3-19-1-21-11-2-9 1-17 0-26Z",
  ]);
  const SPLAT_DROPS = Object.freeze([
    "<circle cx='12' cy='22' r='4.6'/><circle cx='88' cy='72' r='3.4'/><circle cx='70' cy='11' r='2.6'/>",
    "<circle cx='90' cy='30' r='4.2'/><circle cx='9' cy='70' r='3.6'/><circle cx='34' cy='7' r='2.4'/>",
    "<circle cx='7' cy='47' r='4'/><circle cx='80' cy='90' r='3.2'/><circle cx='93' cy='18' r='2.8'/>",
  ]);
  function splatIndex(seed) {
    const key = String(seed || "");
    let hash = 0;
    for (let i = 0; i < key.length; i++)
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return Math.abs(hash) % SPLAT_SHAPES.length;
  }
  /** A removed unit takes its numbers with it instead of leaving them on air. */
  function dropNumbers(key, delay = 0) {
    if (!key) return;
    const found = [
      ...app.querySelectorAll(`.damage-number[data-hit-key="${key}"]`),
    ];
    if (!found.length) return;
    const drop = () =>
      found.forEach((el) => {
        el.remove();
        nodes.delete(el);
      });
    if (delay > 0) schedule(drop, delay);
    else drop();
  }
  const NUMBER_LIFE = 620;
  /** Returns the performance.now() at which the number entered the DOM. */
  function number(p, n, type = "damage", options = null) {
    const heavy = options?.tier === 3 && type === "damage";
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.className =
      "damage-number " +
      (type === "heal"
        ? "heal"
        : type === "shield"
          ? "block"
          : heavy
            ? "crit"
            : "");
    const shape = splatIndex(options?.key || type + n);
    el.innerHTML =
      `<svg class="dmg-splat" viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
      `<path vector-effect="non-scaling-stroke" d="${SPLAT_SHAPES[shape]}"/>` +
      `<g vector-effect="non-scaling-stroke">${SPLAT_DROPS[shape]}</g></svg>` +
      `<span class="dmg-value">` +
      (type === "shield"
        ? "格挡"
        : `${type === "heal" ? "+" : "−"}${n}${heavy ? "<small>重击</small>" : ""}`) +
      `</span>`;
    if (options?.key) el.dataset.hitKey = options.key;
    el.style.left = clamp(p.x, 40, W - 40) + "px";
    el.style.top = p.y - (p.h || 100) * 0.2 + "px";
    app.appendChild(el);
    nodes.add(el);
    schedule(() => {
      el.remove();
      nodes.delete(el);
    }, NUMBER_LIFE + 20);
    return performance.now();
  }

  /* ------------------------------------------------------------ attack owners
   * A lunging minion is a clone (minions are rebuilt on every render); a hero
   * lunges its own card (cloning a hero out of #battle loses its scoped
   * layout — the "giant heart" bug). */
  const STATE_CLASSES = [
    "shield",
    "frozen",
    "stealth",
    "taunt",
    "poison",
    "lifesteal",
    "reborn",
    "windfury",
    "spellpower",
    "charge",
    "rush",
    "sick",
    "ready",
  ];
  function syncAttackOwner(owner) {
    if (!owner || owner.dead) return;
    if (owner.live) {
      rebindLiveActor(owner);
      return;
    }
    if (!owner.el?.isConnected) return;
    const current = unit(owner.side, owner.uid);
    if (!current) return;
    for (const selector of [".stat.atk", ".stat.hp"]) {
      const live = current.querySelector(selector),
        copy = owner.el.querySelector(selector);
      if (live && copy) {
        const liveValue = live.querySelector(".stat-value"),
          copyValue = copy.querySelector(".stat-value");
        if (liveValue && copyValue) copyValue.textContent = liveValue.textContent;
        else copy.textContent = live.textContent;
        copy.className = live.className;
      } else if (!live && copy) copy.remove();
    }
    for (const className of STATE_CLASSES)
      owner.el.classList.toggle(className, current.classList.contains(className));
    const liveStatus = current.querySelector(".minion-status"),
      copyStatus = owner.el.querySelector(".minion-status");
    if (liveStatus && copyStatus) copyStatus.innerHTML = liveStatus.innerHTML;
    current.style.visibility = "hidden";
  }
  /* A render replaces the hero card's inner markup, so the lunge moves to the
   * fresh card element at the same point of its timeline. */
  function rebindLiveActor(owner) {
    const current = heroHost(owner.side)?.querySelector(HERO_CARD);
    if (!current || current === owner.el) return;
    const elapsed = performance.now() - owner.startedAt;
    owner.animation?.cancel();
    owner.el = owner.anchorEl = current;
    current.classList.add("attack-actor", "attack-family-" + owner.family);
    if (elapsed >= owner.duration) return;
    owner.animation = animate(current, owner.frames, {
      duration: owner.duration,
      delay: -elapsed,
      fill: "forwards",
    });
  }
  function restoreLiveActor(owner) {
    owner.animation?.cancel();
    owner.host?.classList.remove("attack-host");
    // The card element may have been replaced by a render; clear both.
    for (const el of [owner.el, heroHost(owner.side)?.querySelector(HERO_CARD)]) {
      if (!el) continue;
      el.classList.remove("attack-actor");
      for (const name of [...el.classList])
        if (name.startsWith("attack-family-")) el.classList.remove(name);
      for (const key of ["attackFamily", "contactMs", "releaseMs", "recoveryEndMs", "motionEndMs"])
        delete el.dataset[key];
      el.style.transform = "";
    }
  }
  function releaseAttackOwner(key, restore = true, expected = null) {
    const owner = attackOwners.get(key);
    if (!owner || (expected && owner !== expected)) return false;
    attackOwners.delete(key);
    if (owner.live) {
      restoreLiveActor(owner);
      return true;
    }
    owner.el?.getAnimations?.().forEach((a) => a.cancel());
    owner.el?.remove();
    if (owner.el) nodes.delete(owner.el);
    if (restore && !owner.dead) {
      const current = unit(owner.side, owner.uid);
      if (current) current.style.visibility = "";
    }
    return true;
  }
  function retireExpiredAttackOwners(now = performance.now(), force = false, sequence = null) {
    for (const [key, owner] of attackOwners)
      if ((!sequence || owner.sequence === sequence) && (force || now >= owner.deadline))
        releaseAttackOwner(key);
  }

  /* -------------------------------------------------------------- reactions
   * Target recoil: hold through the hit-stop, recoil by the tier's recoilPx,
   * return. Rebound onto a fresh element when a render replaces the target. */
  function stopReaction(sequence, key, expected = null) {
    const record = sequence?.reactions?.get(key);
    if (!record || (expected && record !== expected)) return false;
    sequence.reactions.delete(key);
    record.animation?.cancel();
    return true;
  }
  function retireExpiredReactions(sequence, now = performance.now(), force = false) {
    if (!sequence?.reactions) return;
    for (const [key, record] of sequence.reactions)
      if (force || now >= record.deadline) stopReaction(sequence, key, record);
  }
  function reactionTarget(ref) {
    const owner = attackOwners.get(refKey(ref));
    if (owner && !owner.dead && owner.el?.isConnected) return owner.anchorEl;
    return anchorEl(ref);
  }
  function recoil(el, from, contact, elapsed = 0) {
    if (!el) return null;
    const box = pos(el);
    if (!box) return null;
    const duration = contact.recoveryEnd - contact.contact,
      at = Math.max(0, Math.min(duration, elapsed));
    if (!(duration > 0) || at >= duration) return null;
    const dx = from ? box.x - from.x : 0,
      dy = from ? box.y - from.y : -1,
      length = Math.hypot(dx, dy) || 1,
      amount = contact.recoilPx || 6,
      hold = clamp((contact.release - contact.contact) / duration, 0, 0.9),
      peak = hold + (1 - hold) * 0.3,
      frames = [{ translate: "0 0", offset: 0 }];
    if (hold > 0) frames.push({ translate: "0 0", offset: hold, easing: "linear" });
    frames.push({
      translate: `${(dx / length) * amount}px ${(dy / length) * amount}px`,
      offset: peak,
      easing: "cubic-bezier(.16,.8,.3,1)",
    });
    frames.push({ translate: "0 0", offset: 1 });
    if (contact.family === "slam") {
      frames[0].scale = "1 0.94";
      frames[frames.length - 1].scale = "1 1";
    }
    return animate(el, frames, { duration, delay: -at, fill: "forwards" });
  }
  function startReaction(sequence, ref, from, timing) {
    if (!isCurrentSequence(sequence) || !timing || timing.recoveryEnd <= timing.contact)
      return null;
    const key = refKey(ref);
    stopReaction(sequence, key);
    const record = {
      key,
      ref,
      from,
      timing,
      el: null,
      animation: null,
      deadline: sequence.origin + timing.recoveryEnd,
    };
    const target = reactionTarget(ref),
      elapsed = performance.now() - (sequence.origin + timing.contact);
    if (!target) return null;
    sequence.reactions.set(key, record);
    record.el = target;
    cancelLayoutTranslation(target, key);
    record.animation = recoil(target, from, timing, elapsed);
    if (!record.animation) stopReaction(sequence, key, record);
    return record;
  }
  function rebindReactions(sequence) {
    if (!sequence?.reactions) return;
    const now = performance.now();
    for (const [key, record] of [...sequence.reactions]) {
      if (now >= record.deadline) {
        stopReaction(sequence, key, record);
        continue;
      }
      const target = reactionTarget(record.ref);
      if (!target) {
        stopReaction(sequence, key, record);
        continue;
      }
      if (target === record.el && record.el.isConnected) continue;
      record.animation?.cancel();
      record.el = target;
      cancelLayoutTranslation(target, key);
      record.animation = recoil(
        target,
        record.from,
        record.timing,
        now - (sequence.origin + record.timing.contact),
      );
      if (!record.animation) stopReaction(sequence, key, record);
    }
  }

  /* ----------------------------------------------------------------- layout */
  function capture() {
    const m = {};
    document
      .querySelectorAll("#battle .hero,#battle .minion[data-uid]")
      .forEach((el) => {
        const face = el.matches(".hero") ? el.querySelector(HERO_CARD) || el : el;
        m[el.dataset.side + el.dataset.uid] = {
          ...pos(face),
          el,
          cid: el.dataset.cardid,
          artPosition: el.querySelector(".minion-art img") ? getComputedStyle(el.querySelector(".minion-art img")).objectPosition : null,
          html: el.outerHTML,
        };
      });
    document.querySelectorAll(".hand-card").forEach(
      (el) =>
        (m["hand" + el.dataset.hand] = {
          ...pos(el),
          el,
          html: el.outerHTML,
        }),
    );
    document.querySelectorAll("#enemy-hand .card-back").forEach(
      (el) =>
        (m["hand" + el.dataset.enemyHand] = {
          ...pos(el),
          el,
          html: el.outerHTML,
        }),
    );
    return m;
  }
  function releaseLayoutOwner(key, animation) {
    if (layoutOwners.get(key)?.animation === animation) layoutOwners.delete(key);
  }
  function registerLayoutOwner(key, el, animation) {
    const previous = layoutOwners.get(key);
    if (previous && previous.animation !== animation) previous.animation.cancel();
    layoutOwners.set(key, { el, animation });
    const release = () => releaseLayoutOwner(key, animation);
    animation.addEventListener?.("finish", release, { once: true });
    animation.addEventListener?.("cancel", release, { once: true });
    return animation;
  }
  /** FLIP survivors from their previous boxes. `hold` keeps them in place
   * first (a death reflows only after the dissolve). */
  function settleLayout(old, excludedKeys = new Set(), timing = null) {
    const duration = timing?.duration ?? 420,
      hold = timing?.hold ?? 0;
    if (duration <= 0) return;
    document
      .querySelectorAll("#battle .minion[data-uid],#hand .hand-card")
      .forEach((el) => {
        if (EmberViewport.mobile && el.dataset.hand) return;
        const key = el.dataset.hand
            ? "hand" + el.dataset.hand
            : el.dataset.side + el.dataset.uid,
          prev = old[key],
          p = pos(el);
        if (excludedKeys.has(key)) return;
        if (!p) return;
        let frames;
        if (prev) {
          const dx = prev.x - p.x,
            dy = prev.y - p.y;
          if (Math.abs(dx) + Math.abs(dy) < 3) return;
          frames = [{ translate: `${dx}px ${dy}px` }];
          if (hold > 0)
            frames.push({
              translate: `${dx}px ${dy}px`,
              offset: hold / (hold + duration),
            });
          frames.push({ translate: "0px 0px" });
        } else if (el.dataset.hand) {
          frames = [
            { opacity: 0, translate: "22px 16px" },
            { opacity: 1, translate: "0px 0px" },
          ];
        } else return;
        registerLayoutOwner(
          key,
          el,
          animate(el, frames, {
            duration: hold + duration,
            easing: "cubic-bezier(.18,.72,.24,1)",
          }),
        );
      });
  }
  function cancelLayoutTranslation(el, key = null) {
    if (key) {
      layoutOwners.get(key)?.animation.cancel();
      return;
    }
    for (const owner of layoutOwners.values())
      if (owner.el === el) owner.animation.cancel();
  }

  /* ------------------------------------------------------------ card motion
   * Hand → board and deck → hand flights (unchanged from the previous director). */
  function cardMarkup(source, fallbackMarkup = "") {
    if (source?.html) {
      const template = document.createElement("template");
      template.innerHTML = source.html;
      const node = template.content.querySelector(".card,.card-back");
      if (node) return node.outerHTML;
    }
    return fallbackMarkup;
  }
  function cardTarget(ref) {
    if (!ref?.uid) return null;
    const anchor = EmberViewport.handCardAnchor?.(ref.side, ref.uid);
    if (anchor?.el) return anchor.el;
    const selector =
      ref.side === "p" ? "#hand .hand-card" : "#enemy-hand .card-back";
    return [...document.querySelectorAll(selector)].find(
      (el) =>
        (ref.side === "p" ? el.dataset.hand : el.dataset.enemyHand) ===
        ref.uid,
    );
  }
  function cardMotionCount(sequence) {
    return [...(sequence?.cards?.values() || [])].filter(
      (track) => !track.disposed && track.phase === "flight",
    ).length;
  }
  function cardProxyContent(markup, frontMarkup = null) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    const content = document.createElement("div");
    content.className = "card-motion-content";
    const normalize = (node, className) => {
      if (!node) return null;
      node.classList.add(className);
      node.removeAttribute("id");
      node.setAttribute("aria-hidden", "true");
      node.querySelectorAll("[id]").forEach((child) =>
        child.removeAttribute("id"),
      );
      node.querySelectorAll("[tabindex]").forEach((child) =>
        child.setAttribute("tabindex", "-1"),
      );
      return node;
    };
    if (frontMarkup) {
      const face = document.createElement("div");
      face.className = "card-motion-face";
      const back = template.content.firstElementChild;
      if (back) face.appendChild(normalize(back, "card-motion-back"));
      const frontTemplate = document.createElement("template");
      frontTemplate.innerHTML = frontMarkup;
      const front = frontTemplate.content.firstElementChild;
      if (front) face.appendChild(normalize(front, "card-motion-front"));
      content.appendChild(face);
    } else if (template.content.firstElementChild) {
      content.appendChild(
        normalize(template.content.firstElementChild, "card-motion-back"),
      );
    }
    return content;
  }
  function captureInline(el) {
    return el
      ? {
          visibility: el.style.visibility,
          opacity: el.style.opacity,
          scale: el.style.scale,
          translate: el.style.translate,
          transform: el.style.transform,
        }
      : null;
  }
  function restoreInline(el, style) {
    if (!el || !style) return;
    el.style.visibility = style.visibility;
    el.style.opacity = style.opacity;
    el.style.scale = style.scale;
    el.style.translate = style.translate;
    el.style.transform = style.transform;
  }
  function cardMotionSurface(track, target) {
    return track.kind === "draw"
      ? target?.querySelector?.(".card") || target
      : target;
  }
  function bindCardTarget(track, target, hidden = false) {
    const nextSurface = cardMotionSurface(track, target),
      sameTarget = track.targetEl === target,
      sameSurface = track.surfaceEl === nextSurface,
      previousSurfaceStyle = track.surfaceStyle;
    if (track.targetEl && !sameTarget)
      restoreInline(track.targetEl, track.targetStyle);
    if (track.surfaceEl && !sameSurface)
      restoreInline(track.surfaceEl, track.surfaceStyle);
    // A cloned draw surface can carry the compositor's current endpoint
    // styles. When only the inner surface changed, restore the logical
    // surface style before measuring it; the cached pose supplies the live
    // animation state separately.
    if (
      !sameSurface &&
      sameTarget &&
      nextSurface &&
      previousSurfaceStyle
    )
      restoreInline(nextSurface, previousSurfaceStyle);
    if (!sameTarget || !track.targetStyle) {
      track.targetEl = target || null;
      track.targetStyle = captureInline(target);
    }
    if (!sameSurface || !track.surfaceStyle) {
      track.surfaceEl = nextSurface;
      track.surfaceStyle =
        !sameTarget && !sameSurface
          ? captureInline(track.surfaceEl)
          : previousSurfaceStyle || captureInline(track.surfaceEl);
    }
    if (target && hidden) target.style.visibility = "hidden";
  }
  function removeCardProxy(track) {
    if (!track?.proxy) return;
    track.proxy.remove();
    nodes.delete(track.proxy);
    track.proxy = null;
  }
  function ownCardAnimation(track, animation, onFinish = null) {
    if (!animation) return null;
    track.animations ??= new Set();
    track.animations.add(animation);
    animation.addEventListener?.(
      "finish",
      () => {
        track.animations.delete(animation);
        onFinish?.();
      },
      { once: true },
    );
    animation.addEventListener?.(
      "cancel",
      () => track.animations.delete(animation),
      { once: true },
    );
    return animation;
  }
  function cancelOwnedCardAnimations(track) {
    for (const animation of track?.animations || []) animation.cancel();
    track?.animations?.clear();
    track?.animation?.cancel();
    track?.settleAnimation?.cancel();
    if (track) {
      track.animation = null;
      track.settleAnimation = null;
    }
  }
  function cardSurfacePose(surface) {
    if (!surface) return null;
    const point = pos(surface),
      opacity = Number(getComputedStyle(surface).opacity);
    return point && validCardPoint(point)
      ? {
          point,
          opacity: Number.isFinite(opacity) ? clamp(opacity) : 1,
        }
      : null;
  }
  function captureCardTargets(sequence = activeSequence) {
    if (!sequence?.cards) return;
    const capturedAt = performance.now();
    for (const track of sequence.cards.values()) {
      if (track.disposed) continue;
      const proxyStyle = track.proxy && getComputedStyle(track.proxy);
      track.preRenderCardPose = {
        capturedAt,
        surface: cardSurfacePose(track.surfaceEl || track.targetEl),
        proxy: track.proxy ? pos(track.proxy) : null,
        proxyOpacity: proxyStyle
          ? Number(proxyStyle.opacity)
          : 0,
      };
    }
  }
  function handoffEndAt(sequence, track) {
    return (
      track.handoffGeometry?.endAt ??
      sequence.origin +
        (track.markers?.blendEndAt ?? track.markers?.handoffAt ?? 0)
    );
  }
  function cardHandoffLanding(track, target) {
    return track.clippedEdge ? track.target : pos(target) || track.target;
  }
  function setCardSurfacePose(surface, base, point, opacity) {
    const scaleX = point.w / Math.max(1, base.w),
      scaleY = point.h / Math.max(1, base.h),
      dx = point.x - base.x,
      dy = point.y - base.y;
    surface.style.opacity = String(clamp(opacity));
    surface.style.translate = `${dx}px ${dy}px`;
    surface.style.scale = `${scaleX} ${scaleY}`;
  }
  function applyCardHandoffSurface(
    sequence,
    track,
    surface,
    from,
    landing,
    now,
    startOpacity = 0,
  ) {
    if (!surface || !validCardPoint(from) || !validCardPoint(landing))
      return false;
    cancelLayoutTranslation(surface, cardLayoutKey(track));
    const base = pos(surface),
      endAt = handoffEndAt(sequence, track),
      remaining = Math.max(0, endAt - now);
    if (!base || !validCardPoint(base)) return false;
    const startScaleX = from.w / Math.max(1, base.w),
      startScaleY = from.h / Math.max(1, base.h),
      startDx = from.x - base.x,
      startDy = from.y - base.y,
      endScaleX = landing.w / Math.max(1, base.w),
      endScaleY = landing.h / Math.max(1, base.h),
      endDx = landing.x - base.x,
      endDy = landing.y - base.y,
      start = {
        opacity: clamp(startOpacity),
        translate: `${startDx}px ${startDy}px`,
        scale: `${startScaleX} ${startScaleY}`,
      },
      end = {
        opacity: 1,
        translate: `${endDx}px ${endDy}px`,
        scale: `${endScaleX} ${endScaleY}`,
      };
    setCardSurfacePose(surface, base, from, start.opacity);
    if (quality.reduced || remaining <= 0) {
      setCardSurfacePose(surface, base, landing, 1);
      return true;
    }
    const settle = animate(
      surface,
      [start, end],
      {
        duration: remaining,
        easing: "linear",
        fill: "both",
      },
      () => {
        if (track.settleAnimation === settle)
          setCardSurfacePose(surface, base, landing, 1);
      },
    );
    track.settleAnimation = ownCardAnimation(track, settle);
    // Keep the real endpoint in inline styles as a cancellation fallback.
    // Draw's blend deadline and its track disposal deadline are identical, so
    // the timer can win the race with WAAPI's finish event.
    setCardSurfacePose(surface, base, landing, 1);
    return true;
  }
  function applyCardHandoffProxy(
    track,
    from,
    landing,
    now,
    endAt,
    startOpacity = 1,
  ) {
    const proxy = track.proxy;
    if (!proxy || !validCardPoint(from) || !validCardPoint(landing)) return true;
    const remaining = Math.max(0, endAt - now),
      dx = landing.x - from.x,
      dy = landing.y - from.y,
      endScaleX = landing.w / Math.max(1, from.w),
      endScaleY = landing.h / Math.max(1, from.h),
      finalTransform = `translate(${dx}px,${dy}px) rotate(0deg) scale(${endScaleX},${endScaleY})`;
    proxy.style.left = from.x - from.w / 2 + "px";
    proxy.style.top = from.y - from.h / 2 + "px";
    proxy.style.width = from.w + "px";
    proxy.style.height = from.h + "px";
    proxy.style.transform = "translate(0,0) rotate(0deg) scale(1)";
    proxy.style.opacity = String(clamp(startOpacity));
    if (quality.reduced || remaining <= 0) {
      proxy.style.transform = finalTransform;
      removeCardProxy(track);
      return true;
    }
    const travel = animate(
      proxy,
      [
        {
          transform: "translate(0,0) rotate(0deg) scale(1)",
          opacity: clamp(startOpacity),
        },
        { transform: finalTransform, opacity: clamp(startOpacity) },
      ],
      { duration: remaining, easing: "linear", fill: "both" },
    );
    ownCardAnimation(track, travel);
    proxy.style.opacity = "0";
    const proxyFade = animate(
      proxy,
      [{ opacity: clamp(startOpacity) }, { opacity: 0 }],
      { duration: remaining, easing: "ease-out", fill: "both" },
      () => removeCardProxy(track),
    );
    ownCardAnimation(track, proxyFade);
    return true;
  }
  function replanCardHandoff(track, now, from, landing) {
    track.handoffGeometry = {
      ...(track.handoffGeometry || {}),
      startAt: now,
      start: from,
      end: landing,
    };
    track.target = landing;
  }
  function scheduleCardAt(sequence, track, at, fn, role = null) {
    const runner = () => {
      track.timers?.delete(timer);
      if (!track.disposed) fn();
    };
    if (role)
      runner.__emberCardTimerMeta = {
        role,
        at,
        dueAt: sequence ? sequence.origin + at : null,
        endAt:
          sequence && track.markers?.endAt !== undefined
            ? sequence.origin + track.markers.endAt
            : null,
        uid: track.ref?.uid || track.targetRef?.uid || null,
        trackId: track.id,
      };
    let timer;
    timer = scheduleAt(sequence, at, runner);
    track.timers ??= new Set();
    track.timers.add(timer);
    return timer;
  }
  function trackTarget(sequence, track) {
    return track.kind === "play"
      ? unit(track.landingRef?.side, track.landingRef?.uid)
      : cardTarget(track.targetRef || track.ref);
  }
  function cardLayoutKey(track) {
    const source =
        track?.kind === "draw"
          ? track?.targetRef || track?.ref
          : track?.ref || track?.sourceRef,
      target = track?.landingRef || track?.targetRef;
    return track?.kind === "draw"
      ? "hand" + source?.uid
      : refKey(target);
  }
  function clippedHandTarget(anchor, side) {
    /* On phones a newly drawn card can be outside the horizontally scrollable
     * rail. Do not invent a visible landing point at the rail edge: that
     * makes an off-screen draw flash at the boundary. Desktop still uses the
     * edge clamp because its hand is a fixed presentation surface. */
    if (EmberViewport.mobile || !anchor || anchor.status !== "clipped")
      return anchor;
    const hand = document.getElementById(side === "p" ? "hand" : "enemy-hand"),
      region = EmberViewport.pos(hand);
    if (!region) return anchor;
    return {
      ...anchor,
      x: clamp(
        anchor.x,
        region.left + anchor.w / 2,
        region.left + region.w - anchor.w / 2,
      ),
      y: clamp(
        anchor.y,
        region.top + anchor.h / 2,
        region.top + region.h - anchor.h / 2,
      ),
    };
  }
  function validCardPoint(point) {
    return !!point &&
      point.w > 0 &&
      point.h > 0 &&
      [point.x, point.y, point.w, point.h].every(Number.isFinite);
  }
  function watchHandCard(sequence, track) {
    if (track.handScrollCleanup || track.kind !== "draw") return;
    const hand = document.getElementById(
      track.ref.side === "p" ? "hand" : "enemy-hand",
    );
    if (!hand) return;
    let lastLeft = hand.scrollLeft,
      lastTop = hand.scrollTop;
    const onScroll = () => {
      if (track.disposed) return;
      const left = hand.scrollLeft,
        top = hand.scrollTop;
      if (left === lastLeft && top === lastTop) return;
      lastLeft = left;
      lastTop = top;
      track.handScrollChanged = true;
      if (track.phase === "flight") {
        // A user-owned scroll invalidates the in-flight endpoint. End only
        // this decoration; never force scrollLeft or finish the rule scene.
        disposeCardMotion(sequence, track);
      } else if (track.phase === "settle") {
        disposeCardMotion(sequence, track);
      }
    };
    hand.addEventListener("scroll", onScroll, { passive: true });
    track.handScrollCleanup = () =>
      hand.removeEventListener("scroll", onScroll);
  }
  function cardElapsed(sequence, track) {
    return Math.max(
      0,
      performance.now() -
        (sequence.origin + (track.markers?.startAt ?? 0)),
    );
  }
  function startCardMotion(
    sequence,
    track,
    from,
    to,
    markup,
    duration,
    options = {},
  ) {
    if (
      !isCurrentSequence(sequence) ||
      quality.reduced ||
      !from ||
      !to ||
      !markup ||
      duration <= 0 ||
      cardMotionCount(sequence) >= EmberFXProfiles.cardMotion.maxTracks
    )
      return null;
    const elapsed = cardElapsed(sequence, track);
    if (elapsed >= duration) return null;
    const startScale = clamp(
        Number(options.startPose?.scale ?? from.poseScale ?? 1) || 1,
        0.45,
        1.35,
      ),
      startTilt = Number(options.startPose?.tilt ?? from.poseTilt ?? 0) || 0,
      width = Math.max(
        1,
        from.baseW ||
          from.w / startScale ||
          to.w ||
          (EmberViewport.mobile ? 96 : 125),
      ),
      height = Math.max(
        1,
        from.baseH || from.h / startScale || to.h || width * 1.44,
      ),
      dx = to.x - from.x,
      dy = to.y - from.y,
      endScaleX =
        options.endScaleX ??
        options.endScale ??
        (track.kind === "play" ? (to.w || width) / width : 1),
      endScaleY =
        options.endScaleY ??
        options.endScale ??
        (track.kind === "play" ? (to.h || height) / height : 1),
      el = document.createElement("div"),
      finalTransform = `translate(${dx}px,${dy}px) rotate(0deg) scale(${endScaleX},${endScaleY})`;
    el.className = "card-motion-proxy";
    el.setAttribute("aria-hidden", "true");
    el.dataset.motionId = track.id;
    el.dataset.motionKind = track.kind;
    el.dataset.motionSide = track.ref.side;
    el.dataset.motionUid = track.ref.uid;
    if (track.landingRef)
      el.dataset.motionTargetUid = track.landingRef.uid;
    // WAAPI is cancelled when it finishes. Keep the endpoint in the inline
    // style so cancellation cannot snap the proxy back to its origin.
    el.style.cssText = `left:${from.x - width / 2}px;top:${from.y - height / 2}px;width:${width}px;height:${height}px;transform:${finalTransform};opacity:.98`;
    el.appendChild(cardProxyContent(markup, options.frontMarkup));
    app.appendChild(el);
    nodes.add(el);
    track.proxy = el;
    track.phase = "flight";
    track.from = from;
    track.to = to;
    track.target = to;
    track.duration = duration;
    track.endScaleX = endScaleX;
    track.endScaleY = endScaleY;
    track.endScale = (endScaleX + endScaleY) / 2;
    track.startPose = {
      scale: startScale,
      tilt: startTilt,
      alreadyLifted: !!options.startPose?.alreadyLifted,
    };
    if (track.targetEl) bindCardTarget(track, track.targetEl, true);
    const markers = track.markers || {},
      liftAt = clamp(
        ((markers.liftEndAt ?? markers.startAt ?? 0) -
          (markers.startAt ?? 0)) /
          duration,
      ),
      approachAt = clamp(
        Math.max(
          liftAt,
          ((markers.approachAt ??
          (markers.startAt ?? 0) + duration * 0.78) -
          (markers.startAt ?? 0)) /
          duration,
        ),
      ),
      startTransform = `translate(0,0) rotate(${startTilt}deg) scale(${startScale})`,
      /* Keep the deck-to-hand center moving during the lift beat. Holding x/y
       * still here forced the remaining flight to accelerate visibly. */
      liftedTransform = `translate(${dx * liftAt}px,${dy * liftAt - (track.startPose.alreadyLifted ? 0 : 12)}px) rotate(0deg) scale(${Math.max(startScale, 0.92)})`,
      approachTransform = `translate(${dx * 0.78}px,${dy * 0.78 - 18}px) rotate(2deg) scale(.86)`,
      frames = [{ opacity: 0.98, transform: startTransform, offset: 0 }];
    if (!track.startPose.alreadyLifted && liftAt > 0 && liftAt < 1)
      frames.push({ opacity: 1, transform: liftedTransform, offset: liftAt });
    if (approachAt > 0 && approachAt < 1)
      frames.push({ opacity: 1, transform: approachTransform, offset: approachAt });
    frames.push({ opacity: 0.98, transform: finalTransform, offset: 1 });
    const animation = animate(
      el,
      frames,
      {
        duration,
        delay: -elapsed,
        // Marker offsets are compiled timestamps. A single non-linear easing
        // would remap every boundary, so use linear clock progression and
        // express local lift/approach accents in the keyframes themselves.
        easing: "linear",
        fill: "both",
      },
      () => {
        if (track.animation === animation) {
          track.animation = null;
          track.reached = true;
        }
      },
    );
    ownCardAnimation(track, animation);
    track.animation = animation;
    const face = el.querySelector(".card-motion-face");
    if (face && options.frontMarkup && !quality.low) {
      // Make the revealed face the stable post-animation state too.
      face.style.transform = "rotateY(180deg)";
      const flipStart = clamp(
          ((markers.flipStartAt ?? markers.liftEndAt ?? markers.startAt) -
            markers.startAt) /
            duration,
        ),
        flipEnd = clamp(
          ((markers.flipEndAt ?? markers.handoffAt ?? markers.startAt + duration) -
            markers.startAt) /
            duration,
        ),
        flip = animate(
          face,
          [
            { transform: "rotateY(0deg)", offset: 0 },
            { transform: "rotateY(0deg)", offset: flipStart },
            { transform: "rotateY(180deg)", offset: flipEnd },
            { transform: "rotateY(180deg)", offset: 1 },
          ],
          { duration, delay: -elapsed, easing: "linear", fill: "both" },
        );
      ownCardAnimation(track, flip);
    }
    return track;
  }
  function handoffCardMotion(sequence, track, target = null, options = {}) {
    if (!track || track.disposed || track.phase !== "flight") return false;
    const live = target || trackTarget(sequence, track);
    if (!live) {
      disposeCardMotion(sequence, track);
      return false;
    }
    const now = performance.now(),
      markers = track.markers || {};
    const endAt = markers.endAt ?? markers.handoffAt ?? 0;
    if (now >= sequence.origin + endAt) {
      disposeCardMotion(sequence, track);
      return false;
    }
    const landing = options.landing ||
      (track.clippedEdge ? track.target : pos(live) || track.target);
    if (!validCardPoint(landing)) {
      disposeCardMotion(sequence, track);
      return false;
    }
    // Sample the painted proxy before cancelling WAAPI. The inline endpoint
    // is intentionally kept on the element, so cancelling first would snap
    // a late frame to the landing box and make the handoff visibly jump.
    const currentProxy = track.proxy ? pos(track.proxy) : null,
      currentSurface = cardSurfacePose(track.surfaceEl || live);
    cancelOwnedCardAnimations(track);
    bindCardTarget(track, live, false);
    if (currentProxy && validCardPoint(currentProxy)) {
      track.proxy.style.left = currentProxy.x - currentProxy.w / 2 + "px";
      track.proxy.style.top = currentProxy.y - currentProxy.h / 2 + "px";
      track.proxy.style.width = currentProxy.w + "px";
      track.proxy.style.height = currentProxy.h + "px";
      track.proxy.style.transform = "translate(0,0) rotate(0deg) scale(1)";
      track.from = {
        ...currentProxy,
        baseW: currentProxy.w,
        baseH: currentProxy.h,
        poseScale: 1,
        poseTilt: 0,
      };
      track.endScaleX = (landing.w || currentProxy.w) / currentProxy.w;
      track.endScaleY = (landing.h || currentProxy.h) / currentProxy.h;
      track.endScale = (track.endScaleX + track.endScaleY) / 2;
    }
    const surfaceFrom =
      currentProxy || currentSurface?.point || landing;
    if (!validCardPoint(surfaceFrom)) {
      disposeCardMotion(sequence, track);
      return false;
    }
    track.endScaleX = landing.w / Math.max(1, surfaceFrom.w);
    track.endScaleY = landing.h / Math.max(1, surfaceFrom.h);
    track.endScale = (track.endScaleX + track.endScaleY) / 2;
    track.target = landing;
    track.phase = "settle";
    track.handedOff = true;
    const handoffAt = sequence.origin + (markers.handoffAt ?? 0),
      blendEnd = sequence.origin + (markers.blendEndAt ?? markers.handoffAt ?? 0);
    track.handoffTimestamp = handoffAt;
    track.handoffGeometry = {
      startAt: now,
      endAt: blendEnd,
      start: surfaceFrom,
      end: landing,
    };
    live.style.visibility = "";
    const surface = track.surfaceEl || live,
      blend = Math.max(0, blendEnd - now);
    if (quality.low && track.lowFrontMarkup && track.proxy)
      track.proxy
        .querySelector(".card-motion-content")
        ?.replaceWith(cardProxyContent(track.lowFrontMarkup));
    try {
      applyCardHandoffProxy(track, surfaceFrom, landing, now, blendEnd);
      if (
        !applyCardHandoffSurface(
          sequence,
          track,
          surface,
          surfaceFrom,
          landing,
          now,
          // A short physical crossfade must still paint a non-zero live
          // surface on the first compositor frame; otherwise a 16 ms blend
          // can collapse to a proxy-only frame on 60 Hz displays.
          0.08,
        )
      )
        throw new Error("card handoff surface unavailable");
    } catch {
      // A browser may reject a late WAAPI creation (for example while a
      // document is being reflowed). The rule sequence still owns its final
      // commit; only this decorative track is discarded.
      disposeCardMotion(sequence, track);
      return false;
    }
    scheduleCardAt(
      sequence,
      track,
      endAt,
      () => disposeCardMotion(sequence, track),
      track.kind === "draw" ? "draw-end" : "play-end",
    );
    if (
      track.kind === "draw" &&
      !track.landSound &&
      !options.silent &&
      now < sequence.origin + endAt
    ) {
      sound("land", landing, { gain: 0.42 });
      track.landSound = true;
    }
    return true;
  }
  function disposeCardMotion(sequence, track) {
    if (!track || track.disposed) return;
    track.disposed = true;
    track.handScrollCleanup?.();
    track.handScrollCleanup = null;
    for (const timer of track.timers || []) {
      clearTimeout(timer);
      timers.delete(timer);
    }
    for (const animation of track.animations || []) animation.cancel();
    track.animation?.cancel();
    track.settleAnimation?.cancel();
    removeCardProxy(track);
    restoreInline(track.targetEl, track.targetStyle);
    restoreInline(track.surfaceEl, track.surfaceStyle);
    const live = trackTarget(sequence, track);
    if (live && live !== track.targetEl) live.style.visibility = "";
    sequence.cards.delete(track.id);
  }
  function rebindCardSettle(sequence, track, target, now) {
    if (track.phase !== "settle" || !target) return false;
    const preRenderPose = track.preRenderCardPose,
      oldSurface = track.surfaceEl || track.targetEl,
      oldSurfacePose = preRenderPose?.surface || cardSurfacePose(oldSurface),
      oldProxy = preRenderPose?.proxy || (track.proxy ? pos(track.proxy) : null),
      oldProxyOpacity = preRenderPose
        ? preRenderPose.proxyOpacity
        : track.proxy
          ? Number(getComputedStyle(track.proxy).opacity)
          : 0,
      landing = cardHandoffLanding(track, target),
      from = oldSurfacePose?.point || oldProxy || landing;
    track.preRenderCardPose = null;
    if (!validCardPoint(landing) || !validCardPoint(from)) return false;
    cancelOwnedCardAnimations(track);
    bindCardTarget(track, target, false);
    target.style.visibility = "";
    const surface = track.surfaceEl || target;
    replanCardHandoff(track, now, from, landing);
    track.endScaleX = landing.w / Math.max(1, from.w);
    track.endScaleY = landing.h / Math.max(1, from.h);
    track.endScale = (track.endScaleX + track.endScaleY) / 2;
    try {
      applyCardHandoffProxy(
        track,
        oldProxy || from,
        landing,
        now,
        handoffEndAt(sequence, track),
        Number.isFinite(oldProxyOpacity) ? oldProxyOpacity : 0,
      );
      if (
        !applyCardHandoffSurface(
          sequence,
          track,
          surface,
          from,
          landing,
          now,
          oldSurfacePose?.opacity ?? 0,
        )
      )
        throw new Error("card rebind surface unavailable");
      return true;
    } catch {
      // Rebinding is local to the visual track. Restore the real card and let
      // the owning presentation sequence commit normally if WAAPI rejects.
      disposeCardMotion(sequence, track);
      return false;
    }
  }
  function rebindCardMotions(sequence) {
    if (!sequence?.cards) return;
    const now = performance.now();
    for (const track of sequence.cards.values()) {
      if (track.disposed) continue;
      const target = trackTarget(sequence, track),
        endAt = sequence.origin + (track.markers?.endAt ?? Infinity);
      if (now >= endAt) {
        disposeCardMotion(sequence, track);
        continue;
      }
      const nextSurface = cardMotionSurface(track, target);
      if (target !== track.targetEl || nextSurface !== track.surfaceEl) {
        if (track.phase === "settle") {
          if (!target || !rebindCardSettle(sequence, track, target, now))
            disposeCardMotion(sequence, track);
        } else {
          bindCardTarget(track, target, true);
        }
      }
      track.preRenderCardPose = null;
      if (track.phase === "flight" && target)
        target.style.visibility = "hidden";
    }
  }
  function syncCardTargets() {
    rebindCardMotions(activeSequence);
  }
  function startPlayCardMotion(
    sequence,
    events,
    beat,
    old,
    cardOrigin,
    card,
    cardHTML,
  ) {
    const play = beat.events[0],
      descriptor = sequence.plan.cardTracks?.find(
        (track) => track.sourceEventId === play?.id,
      );
    if (!play || !descriptor || (card && card.type !== "minion")) return;
    const landingBeat = sequence.plan.beats[descriptor.landingBeatIndex];
    if (!landingBeat) return;
    const captured =
      cardOrigin?.side === play.side && cardOrigin.uid === play.uid
        ? {
            ...(old["hand" + play.uid] || {}),
            ...cardOrigin.point,
            html: cardOrigin.html || old["hand" + play.uid]?.html,
          }
        : old["hand" + play.uid];
    const target = EmberViewport.minionLandingBox(
      landingBeat.frame,
      play.side,
      descriptor.targetRef.uid,
    );
    const fallbackMarkup = captured?.html
      ? ""
      : typeof cardHTML === "function" && card
        ? cardHTML(card)
        : "";
    const frontMarkup =
      descriptor.face?.mode === "revealed-play" &&
      play.side === "e" &&
      typeof cardHTML === "function" &&
      card
        ? cardHTML(card)
        : null;
    // A hidden hand (the enemy's on phones) measures as NaN: no flight to start.
    if (!validCardPoint(captured) || !validCardPoint(target) || (!captured.html && !fallbackMarkup))
      return;
    const track = {
      ...descriptor,
      kind: "play",
      ref: descriptor.sourceRef,
      landingRef: descriptor.targetRef,
      phase: "queued",
      proxy: null,
      targetEl: null,
      disposed: false,
      lowFrontMarkup: frontMarkup,
    };
    sequence.cards.set(track.id, track);
    const flightDuration =
      descriptor.markers.handoffAt - descriptor.markers.startAt;
    const sourceWidth = Math.max(1, captured.baseW || captured.w || target.w),
      sourceHeight = Math.max(1, captured.baseH || captured.h || target.h),
      endScaleX = target.w / sourceWidth,
      endScaleY = target.h / sourceHeight;
    scheduleCardAt(
      sequence,
      track,
      descriptor.markers.endAt,
      () => disposeCardMotion(sequence, track),
      "play-end",
    );
    if (cardElapsed(sequence, track) >= flightDuration) {
      track.phase = "flight";
      track.from = captured;
      track.to = target;
      track.target = target;
      track.duration = flightDuration;
      track.endScaleX = endScaleX;
      track.endScaleY = endScaleY;
      track.endScale = (endScaleX + endScaleY) / 2;
      return;
    }
    let started = false;
    try {
      started = !!startCardMotion(
        sequence,
        track,
        captured,
        target,
        cardMarkup(captured, fallbackMarkup),
        flightDuration,
        {
          endScaleX,
          endScaleY,
          frontMarkup,
          startPose: {
            scale: cardOrigin?.scale,
            tilt: cardOrigin?.tilt,
            alreadyLifted: cardOrigin?.alreadyLifted,
          },
        },
      );
    } catch {
      started = false;
    }
    if (!started) {
      disposeCardMotion(sequence, track);
      return;
    }
  }
  function startDrawCardMotion(sequence, event, beat) {
    if (!event?.uid || !["p", "e"].includes(event.side)) return;
    const descriptor = sequence.plan.cardTracks?.find(
        (track) => track.sourceEventId === event.id,
      ),
      anchor = EmberViewport.handCardAnchor?.(event.side, event.uid),
      target = anchor?.el || cardTarget({ side: event.side, uid: event.uid }),
      measuredTarget = anchor || (pos(target) ? { ...pos(target), status: "visible", el: target } : null),
      targetPos = clippedHandTarget(measuredTarget, event.side),
      source = EmberViewport.deckAnchor(event.side);
    if (
      !descriptor ||
      !target ||
      !measuredTarget ||
      measuredTarget.status === "absent" ||
      !validCardPoint(targetPos) ||
      !validCardPoint(source)
    )
      return;
    /* A draw whose destination is outside the mobile hand viewport should
     * never be represented by a proxy parked on the viewport edge. The live
     * card is already present in the rail; let it remain there until the
     * player deliberately scrolls to it. */
    if (EmberViewport.mobile && measuredTarget.status === "clipped") return;
    const frontMarkup =
        descriptor.face?.mode === "player-flip"
          ? cardMarkup({ html: target.outerHTML })
          : null,
      backMarkup =
        '<div class="card-back card-motion-back" aria-hidden="true"></div>';
    if (descriptor.face?.mode === "player-flip" && !frontMarkup) return;
    const track = {
      ...descriptor,
      ref: descriptor.targetRef,
      landingRef: descriptor.targetRef,
      phase: "queued",
      proxy: null,
      targetEl: target,
      disposed: false,
      lowFrontMarkup: frontMarkup,
      clippedEdge: measuredTarget.status === "clipped",
      target: targetPos,
    };
    sequence.cards.set(track.id, track);
    watchHandCard(sequence, track);
    const flightDuration =
      descriptor.markers.handoffAt - descriptor.markers.startAt;
    if (cardElapsed(sequence, track) >= flightDuration) {
      track.phase = "flight";
      track.from = source;
      track.to = targetPos;
      track.target = targetPos;
      track.duration = flightDuration;
      track.endScaleX = targetPos.w / Math.max(1, source.w);
      track.endScaleY = targetPos.h / Math.max(1, source.h);
      track.endScale = (track.endScaleX + track.endScaleY) / 2;
      bindCardTarget(track, target, true);
      handoffCardMotion(sequence, track, target, {
        landing: targetPos,
        silent: true,
      });
      return;
    }
    // Register the track deadline before starting WAAPI. If proxy startup
    // throws, disposeCardMotion can cancel the same deadline together with
    // the hand scroll watcher instead of leaving a detached timer behind.
    scheduleCardAt(
      sequence,
      track,
      descriptor.markers.endAt,
      () => disposeCardMotion(sequence, track),
      "draw-end",
    );
    let started = false;
    try {
      started = !!startCardMotion(
        sequence,
        track,
        source,
        targetPos,
        backMarkup,
        flightDuration,
        {
          endScaleX: targetPos.w / Math.max(1, source.w),
          endScaleY: targetPos.h / Math.max(1, source.h),
          frontMarkup,
        },
      );
    } catch {
      started = false;
    }
    if (!started) {
      disposeCardMotion(sequence, track);
      return;
    }
    scheduleCardAt(
      sequence,
      track,
      descriptor.markers.handoffAt,
      () => handoffCardMotion(sequence, track),
      "draw-handoff",
    );
  }
  /* ------------------------------------------------------ enemy card reveal
   * Kept beside the enemy hero card, on whichever side does not cross the
   * cast path (hero → targets). */
  function segmentHitsRect(a, b, r) {
    if (!a || !b) return false;
    const inside = (p) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
    if (inside(a) || inside(b)) return true;
    const edges = [
      [{ x: r.left, y: r.top }, { x: r.right, y: r.top }],
      [{ x: r.right, y: r.top }, { x: r.right, y: r.bottom }],
      [{ x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }],
      [{ x: r.left, y: r.bottom }, { x: r.left, y: r.top }],
    ];
    const cross = (p, q, s, t) => {
      const d = (q.x - p.x) * (t.y - s.y) - (q.y - p.y) * (t.x - s.x);
      if (!d) return false;
      const u = ((s.x - p.x) * (t.y - s.y) - (s.y - p.y) * (t.x - s.x)) / d,
        v = ((s.x - p.x) * (q.y - p.y) - (s.y - p.y) * (q.x - p.x)) / d;
      return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    };
    return edges.some(([s, t]) => cross(a, b, s, t));
  }
  /* Candidates hug the enemy hero card (right, below, left, above; full size
   * first, then smaller). A spot must stay on stage, keep clear of every
   * cast path and not cover another unit's card. */
  const REVEAL_SCALES = [1, 0.8, 0.66];
  function revealPlacement(hero, targets, obstacles, w, h) {
    const gap = 10,
      caption = 22,
      overlaps = (r, b) =>
        r.left < b.left + b.w && r.right > b.left && r.top < b.top + b.h && r.bottom > b.top;
    const all = [];
    for (const scale of REVEAL_SCALES) {
      const cw = w * scale,
        ch = h * scale + caption;
      for (const c of [
        { left: hero.left + hero.w + gap, top: hero.top },
        { left: hero.left + hero.w + gap, top: hero.top + hero.h - ch },
        { left: hero.left, top: hero.top + hero.h + gap },
        { left: hero.left - cw - gap, top: hero.top },
        { left: hero.left, top: hero.top - ch - gap },
      ])
        all.push({ ...c, scale, right: c.left + cw, bottom: c.top + ch });
    }
    const inBounds = (r) => r.left >= 4 && r.top >= 4 && r.right <= W - 4 && r.bottom <= H - 4;
    const clear = (r) => targets.every((t) => !segmentHitsRect(hero, t, r));
    const free = (r) => obstacles.every((b) => !overlaps(r, b));
    return (
      all.find((r) => inBounds(r) && clear(r) && free(r)) ||
      all.find((r) => inBounds(r) && clear(r)) ||
      all.find(inBounds) ||
      all[0]
    );
  }
  function reveal(card, cardHTML, heroBox, targetBoxes, obstacles = []) {
    if (!card || !cardHTML || quality.reduced || !heroBox) return;
    const el = document.createElement("div");
    el.className = "cast-card";
    el.innerHTML =
      cardHTML(card) + '<div class="cast-caption">ENEMY CAST · 敌方出牌</div>';
    el.style.visibility = "hidden";
    app.appendChild(el);
    nodes.add(el);
    const size = pos(el);
    if (size) {
      const spot = revealPlacement(heroBox, targetBoxes.filter(Boolean), obstacles, size.w, size.h);
      el.style.left = spot.left + "px";
      el.style.top = spot.top + "px";
      el.style.transformOrigin = "0 0";
      if (spot.scale !== 1) el.style.scale = String(spot.scale);
    }
    el.style.visibility = "";
    animate(
      el,
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)", offset: 0.18 },
        { opacity: 1, transform: "translateY(0)", offset: 0.78 },
        { opacity: 0, transform: "translateY(-8px)" },
      ],
      { duration: 1650, easing: "ease-out", fill: "forwards" },
    );
    schedule(() => {
      el.remove();
      nodes.delete(el);
    }, 1660);
  }

  /* ------------------------------------------------------------ death ghost */
  function deathGhost(sequence, old, school) {
    if (!old?.html || quality.reduced) return;
    const freeze = scaled(sequence, T.death.freeze),
      dissolve = scaled(sequence, T.death.dissolve),
      total = freeze + dissolve;
    if (total <= 0) return;
    const ghost = document.createElement("div");
    ghost.innerHTML = old.html;
    const el = ghost.firstElementChild;
    if (!el) return;
    el.removeAttribute("id");
    el.classList.remove("attack-actor");
    el.classList.add("death-ghost");
    el.style.left = old.left + "px";
    el.style.top = old.top + "px";
    el.style.width = old.w + "px";
    el.style.height = old.h + "px";
    el.style.visibility = "visible";
    el.style.transform = "";
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    app.appendChild(el);
    nodes.add(el);
    const edge = "linear-gradient(to top, transparent 0%, #000 13%, #000 100%)";
    el.style.maskImage = edge;
    el.style.webkitMaskImage = edge;
    const f = freeze / total;
    animate(
      el,
      [
        { opacity: 1, filter: "brightness(1) saturate(1)", clipPath: "inset(0 0 0% 0)", transform: "translateY(0)", offset: 0 },
        { opacity: 1, filter: "brightness(.45) saturate(.3)", clipPath: "inset(0 0 0% 0)", transform: "translateY(0)", offset: f, easing: "cubic-bezier(.35,0,.7,1)" },
        { opacity: 0.12, filter: "brightness(.3) saturate(.2) blur(3px)", clipPath: "inset(0 0 100% 0)", transform: "translateY(-14px)", offset: 1 },
      ],
      { duration: total, fill: "forwards" },
    );
    const tint = accents[school] || accents.steel;
    const line = document.createElement("div");
    line.className = "death-ghost death-edge";
    line.style.cssText =
      `left:${old.left}px;top:${old.top + old.h - 2}px;width:${old.w}px;height:2px;` +
      `background:linear-gradient(90deg,transparent,${tint} 16%,#fff4dc 50%,${tint} 84%,transparent);`;
    app.appendChild(line);
    nodes.add(line);
    animate(
      line,
      [
        { opacity: 0, transform: "translateY(0)", offset: 0 },
        { opacity: 0.95, transform: "translateY(0)", offset: f, easing: "cubic-bezier(.35,0,.7,1)" },
        { opacity: 0, transform: `translateY(${2 - old.h}px)`, offset: 1 },
      ],
      { duration: total, fill: "forwards" },
    );
    schedule(() => {
      el.remove();
      line.remove();
      nodes.delete(el);
      nodes.delete(line);
    }, total + 20);
  }

  /* --------------------------------------------------------------- lunge
   * §4.2 melee: lift (8px up, 1.06, long shadow) → lunge until the card edges
   * meet and press PRESS_PX in → hold for the hit-stop → recover. The contact
   * point and the travel distance come from the same contactOffset(). */
  const PRESS_PX = 18;
  function contactOffset(a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1,
      ux = dx / len,
      uy = dy / len,
      sx = Math.abs(ux) > 1e-6 ? (a.w + b.w) / 2 / Math.abs(ux) : Infinity,
      sy = Math.abs(uy) > 1e-6 ? (a.h + b.h) / 2 / Math.abs(uy) : Infinity,
      touch = Math.max(0, len - Math.min(sx, sy)),
      travel = Math.min(len, touch + PRESS_PX);
    return { dx: ux * travel, dy: uy * travel, travel };
  }
  function shadowFilters(el) {
    const base = typeof getComputedStyle === "function" ? getComputedStyle(el).filter : "";
    const has = base && base !== "none";
    const withShadow = (shadow) => (has ? `${base} ${shadow}` : shadow);
    return {
      flat: has ? base : "none",
      lift: withShadow("drop-shadow(0 22px 16px rgba(0,0,0,.5))"),
      drop: withShadow("drop-shadow(0 4px 6px rgba(0,0,0,.42))"),
    };
  }
  function lunge(ctx, beat, beatIndex, actorRef, actorBox, targetBox, old) {
    const { sequence } = ctx;
    const m = beat.motion,
      duration = m.duration;
    if (!(duration > 0)) return null;
    const hero = actorRef.uid === "hero";
    let el, host = null;
    if (hero) {
      host = heroHost(actorRef.side);
      el = host?.querySelector(HERO_CARD);
      if (!el) return null;
      host.classList.add("attack-host");
      el.classList.add("attack-actor", "attack-family-" + m.family);
    } else {
      const origin = old[refKey(actorRef)]?.el?.isConnected
        ? old[refKey(actorRef)].el
        : unit(actorRef.side, actorRef.uid);
      if (!origin) return null;
      el = origin.cloneNode(true);
      el.removeAttribute("id");
      el.classList.add("death-ghost", "attack-actor", "attack-family-" + m.family);
      el.style.cssText += `;left:${actorBox.left}px;top:${actorBox.top}px;width:${actorBox.w}px;height:${actorBox.h}px;margin:0;visibility:visible`;
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      app.appendChild(el);
      nodes.add(el);
    }
    el.dataset.attackFamily = m.family;
    el.dataset.contactMs = String(m.contact);
    el.dataset.releaseMs = String(m.release);
    el.dataset.recoveryEndMs = String(m.recoveryEnd);
    el.dataset.motionEndMs = String(duration);
    const { dx, dy } = contactOffset(actorBox, targetBox),
      shadow = shadowFilters(el),
      k = (ms) => clamp(ms / duration),
      frames = [
        { transform: "translate(0px,0px) scale(1)", filter: shadow.flat, offset: 0, easing: "cubic-bezier(.2,.7,.3,1)" },
        { transform: "translate(0px,-8px) scale(1.06)", filter: shadow.lift, offset: k(m.lift), easing: "cubic-bezier(.55,0,.9,.45)" },
        { transform: `translate(${dx}px,${dy}px) scale(1)`, filter: shadow.drop, offset: k(m.contact) },
      ];
    if (m.release > m.contact)
      frames.push({ transform: `translate(${dx}px,${dy}px) scale(1)`, filter: shadow.drop, offset: k(m.release), easing: "cubic-bezier(.16,.8,.3,1)" });
    else frames[2].easing = "cubic-bezier(.16,.8,.3,1)";
    frames.push({ transform: "translate(0px,0px) scale(1)", filter: shadow.flat, offset: 1 });
    const elapsed = clamp(performance.now() - (sequence.origin + beat.at), 0, duration);
    if (elapsed >= duration) {
      if (!hero) {
        el.remove();
        nodes.delete(el);
      } else {
        host.classList.remove("attack-host");
        el.classList.remove("attack-actor", "attack-family-" + m.family);
      }
      return null;
    }
    const animation = animate(el, frames, { duration, delay: -elapsed, fill: "forwards" });
    const key = refKey(actorRef);
    releaseAttackOwner(key, false);
    const owner = {
      el,
      host,
      anchorEl: el,
      side: actorRef.side,
      uid: actorRef.uid,
      sequence,
      dead: false,
      live: hero,
      animation,
      deadline: sequence.origin + beat.at + duration + 2,
      home: actorBox,
      impact: { ...actorBox, x: actorBox.x + dx, y: actorBox.y + dy },
      frames,
      duration,
      family: m.family,
      startedAt: sequence.origin + beat.at,
    };
    attackOwners.set(key, owner);
    syncAttackOwner(owner);
    timeline.at(sequence, beat.at + duration + 2, () =>
      releaseAttackOwner(key, true, owner),
    );
    return owner;
  }
  /** §4.2 ranged: a short recoil away from the target on the live card. */
  function rangedRecoil(sequence, beat, ref, actorBox, targetBox) {
    if (quality.reduced) return;
    const el = anchorEl(ref),
      duration = beat.motion.lift;
    if (!el?.isConnected || !(duration > 0)) return;
    const len = Math.hypot(targetBox.x - actorBox.x, targetBox.y - actorBox.y) || 1,
      px = -((targetBox.x - actorBox.x) / len) * 6,
      py = -((targetBox.y - actorBox.y) / len) * 6;
    animate(
      el,
      [
        { translate: "0 0", offset: 0 },
        { translate: `${px}px ${py}px`, offset: 0.55, easing: "cubic-bezier(.16,.8,.3,1)" },
        { translate: "0 0", offset: 1 },
      ],
      { duration },
    );
  }

  /* ------------------------------------------------------------- cut-in
   * Heroes and legendary minions only (§2.8), same policy for both sides. */
  function cutinArt(ref, cid, s) {
    const stage = fx2();
    if (typeof stage?.cutinArt !== "function") return null;
    try {
      let id = ref?.uid === "hero" ? null : cid;
      if (ref?.uid === "hero") {
        const heroId =
          ref.side === "e"
            ? s?.mode !== "practice" && EmberData.bosses[s?.bossIndex]
              ? EmberData.bosses[s.bossIndex].portraitId
              : s?.opponentHero
            : s?.heroId;
        const hero =
          EmberData.heroes.find((h) => h.id === heroId) ||
          EmberData.bosses.find((h) => h.id === heroId);
        id = hero?.portraitId || null;
      }
      return id ? stage.cutinArt(id) : null;
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------------- casts */
  function castRecordFor(ctx, beatIndex, cast, type) {
    const { sequence } = ctx;
    const actorBox = resolveOrWarn(sequence, beatIndex, cast.actor, "actor");
    const boxes = cast.targets.map((ref) =>
      resolveOrWarn(sequence, beatIndex, ref, "target"),
    );
    return tracePush({
      beat: beatIndex,
      sequence: sequence.id,
      blockId: sequence.plan.beats[beatIndex]?.blockId ?? null,
      type,
      kind: cast.kind,
      actor: traced(cast.actor, actorBox),
      targets: cast.targets.map((ref, i) => traced(ref, boxes[i])),
      from: point(actorBox),
      to: boxes.map(point),
      tier: cast.tier,
      aoe: cast.aoe,
      at: sequence.origin + cast.flashAt,
      hitAt: cast.contactAt.map((ms) => sequence.origin + ms),
      contactBox: contactBoxes(boxes, cast.tiers, cast.aoe),
      numberAt: cast.targets.map(() => null),
    });
  }
  function castFlash(ctx, beatIndex, cast, type) {
    const { sequence } = ctx;
    // The caster flash itself is the first stage of EmberFx2.cast().
    const rec = castRecordFor(ctx, beatIndex, cast, type);
    sequence.records.set(beatIndex, rec);
    return rec;
  }
  function castLaunch(ctx, beatIndex, cast) {
    const { sequence } = ctx;
    if (!cast.kind) return;
    const from = anchors.resolve(cast.actor, sequence.anchors);
    if (!from) return;
    const sourceEvent = ctx.plan.beats[beatIndex]?.events?.[0];
    const sourceCid = sourceEvent?.cid || null;
    const remastered = fx2()?.renderer3dAvailable && typeof EmberRemasterArts !== "undefined" && EmberRemasterArts.supports(cast.kind);
    let targetRefs = cast.targets;
    let contactAt = cast.contactAt;
    // Destroy/transform or a redundant status can have an explicit rule target
    // without a damage/status contact beat. Never turn that cast into a self-hit.
    // Untargeted spells must NOT inherit an arbitrary UI/test action target.
    if (remastered && !targetRefs.length && EmberData.byId[sourceCid]?.target && sourceEvent?.target) {
      const ref = sourceEvent.target;
      if ((ref.side === "p" || ref.side === "e") && ref.uid != null) {
        targetRefs = [ref];
        contactAt = [cast.startAt + cast.duration];
      }
    }
    const resolved = targetRefs.map((ref, i) => ({ ref, box: anchors.resolve(ref, sequence.anchors), at: contactAt[i] })).filter(x => x.box);
    if (targetRefs.length && !resolved.length) return;
    if (remastered) { const rec = sequence.records.get(beatIndex); if (rec) rec.remasterKind = cast.kind; }
    fxCall("cast", cast.kind, {
      sourceCid, sourceRef: cast.actor,sequenceId:sequence.id,
      from: fxBox(from), targets: resolved.map(x => fxBox(x.box)),
      targetRefs: resolved.map(x => x.ref), swordStyle: cast.swordStyle,
      tier: cast.tier, tint: cast.tint, tintGrad: cast.tintGrad,
      aoe: cast.aoe, seed: sequence.id * 97 + beatIndex,
      timeScale: sequence.plan.scale,
      startedAt: sequence.origin + cast.startAt,
      contactAt: resolved.map(x => sequence.origin + x.at),
    });
  }

  /* ------------------------------------------------------------- recipes
   * Each recipe registers its steps on the sequence timeline up front. */
  function enterFrame(ctx, beat, beatIndex, frame) {
    const { sequence, plan } = ctx;
    const now = performance.now();
    retireExpiredAttackOwners(now, false, sequence);
    retireExpiredReactions(sequence, now);
    for (const track of [...sequence.cards.values()])
      if (now >= sequence.origin + (track.markers?.endAt ?? Infinity))
        disposeCardMotion(sequence, track);
    const old = capture();
    ctx.lifecycleBefore=old;
    ctx.render(frame);
    if (!isCurrentSequence(sequence)) return null;
    rebindReactions(sequence);
    rebindCardMotions(sequence);
    for (const owner of attackOwners.values()) syncAttackOwner(owner);
    const excluded = new Set(sequence.reactions.keys());
    for (const trackId of [...(beat.cardStartIds || []), ...(beat.cardLandingIds || [])]) {
      const descriptor = plan.cardTracks?.find((track) => track.id === trackId);
      if (descriptor) excluded.add(cardLayoutKey(descriptor));
    }
    for (const track of sequence.cards.values())
      if (!track.disposed && (track.startBeatIndex === beatIndex || track.landingBeatIndex === beatIndex))
        excluded.add(cardLayoutKey(track));
    for (const contact of beat.contacts || [])
      if (contact.targetRef) excluded.add(refKey(contact.targetRef));
    const death = beat.kind === "death";
    settleLayout(old, excluded, {
      hold: death ? scaled(sequence, T.death.freeze + T.death.dissolve) : 0,
      duration: scaled(sequence, death ? T.death.reflow : 420),
    });
    return old;
  }
  const at = (ctx, ms, fn) => timeline.at(ctx.sequence, ms, fn);

  function heroFace(ctx, side) {
    return anchors.resolve({ side, uid: "hero" }, ctx.sequence.anchors);
  }

  const recipes = {
    play(ctx, beat, i) {
      const e = beat.events[0],
        card = EmberData.byId[e.cid] || null;
      if (card?.type === "minion") {
        at(ctx, beat.at, () => {
          const old = enterFrame(ctx, beat, i, beat.frame);
          if (!old) return;
          const captured =
              ctx.cardOrigin?.uid === e.uid ? ctx.cardOrigin.point : old["hand" + e.uid],
            // A hidden hand (the enemy's on phones) has no card to start from.
            origin = Number.isFinite(captured?.x) && captured.w > 0 ? captured : null;
          startPlayCardMotion(ctx.sequence, ctx.events, beat, old, ctx.cardOrigin, card, ctx.cardHTML);
          sound("select", origin || heroFace(ctx, e.side));
          const landing = beat.targets[0]
            ? EmberViewport.minionLandingBox(
                ctx.plan.beats[ctx.plan.cardTracks?.find((t) => t.sourceEventId === e.id)?.landingBeatIndex]?.frame,
                beat.targets[0].side,
                beat.targets[0].uid,
              )
            : null;
          ctx.sequence.records.set(
            i,
            tracePush({
              beat: i,
              sequence: ctx.sequence.id,
              blockId: beat.blockId,
              type: "play",
              kind: "minion",
              actor: traced({ side: e.side, uid: e.uid }, origin),
              targets: beat.targets.map((ref) => traced(ref, landing)),
              from: point(origin),
              to: [point(landing)],
              tier: 1,
              at: performance.now(),
              hitAt: [],
              contactBox: [],
              numberAt: [],
            }),
          );
        });
        return;
      }
      recipes.cast(ctx, beat, i, card);
    },
    power(ctx, beat, i) {
      recipes.cast(ctx, beat, i, null);
    },
    cast(ctx, beat, i, card) {
      const e = beat.events[0],
        cast = beat.cast;
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        const rec = castFlash(ctx, i, cast, beat.kind === "power" ? "power" : "cast");
        rec.countered = !!beat.countered;
        if(!beat.countered&&card?.type==="weapon")lifeCue(ctx,e,"weapon-equip",heroFace(ctx,e.side));
        const from = anchors.resolve(cast.actor, ctx.sequence.anchors);
        const school = beat.kind === "power" ? powerSchool(e.side, ctx.s) : schoolOf(card);
        rec.school = school;
        sound("play", from);
        if(!(fx2()?.renderer3dAvailable&&typeof EmberRemasterArts!=="undefined"&&EmberRemasterArts.supports(cast.kind))) sound(card?.type === "weapon" ? "equip" : "cast-" + school, from);
        if (e.side === "e" && card)
          reveal(
            card,
            ctx.cardHTML,
            from,
            cast.targets.map((ref) => anchors.resolve(ref, ctx.sequence.anchors)),
            [...ctx.sequence.anchors.entries()]
              .filter(([key]) => key !== refKey(cast.actor))
              .map(([, box]) => box),
          );
      });
      if (!beat.countered) at(ctx, cast.startAt, () => castLaunch(ctx, i, cast));
    },
    attack(ctx, beat, i) {
      const e = beat.events[0],
        m = beat.motion;
      at(ctx, beat.at, () => {
        const old = enterFrame(ctx, beat, i, beat.frame);
        if (!old) return;
        const { sequence } = ctx;
        const actorBox = resolveOrWarn(sequence, i, e.from, "actor"),
          targetBox = resolveOrWarn(sequence, i, e.to, "target");
        const outgoing = beat.contacts[0];
        const rec = tracePush({
          beat: i,
          sequence: sequence.id,
          blockId: beat.blockId,
          type: "attack",
          kind: m.family,
          ranged: m.ranged,
          actor: traced(e.from, actorBox),
          targets: [traced(e.to, targetBox)],
          from: point(actorBox),
          to: [point(targetBox)],
          tier: outgoing?.tier || 1,
          at: sequence.origin + beat.at,
          hitAt: [sequence.origin + beat.at + m.contact],
          contactBox: contactBoxes([targetBox], [outgoing?.tier || 1], false),
          numberAt: [null],
          counterAt: null,
          school: schoolOf(EmberData.byId[beat.sourceCid], true),
        });
        sequence.records.set(i, rec);
        if (!actorBox || !targetBox) return;
        if(/class="[^"]*\bstealth\b/.test(old[refKey(e.from)]?.html||""))
          lifeCue(ctx,e,"stealth-out",actorBox,{targetRef:e.from});
        if (beat.cutin) {
          const art = cutinArt(e.from, beat.sourceCid, ctx.s);
          if (art && !quality.reduced && fx2()?.available)
            fx2().cutin(art, { side: e.from.side });
        }
        const skyStrike = fx2()?.renderer3dAvailable &&
          EmberFXProfiles.fx2Attack(EmberData.byId[beat.sourceCid], beat.sourceCid)?.fx === "slash";
        // Skyfall comes from offscreen, not a second body colliding with the card.
        const swordStyle=EmberFXProfiles.fx2Attack(EmberData.byId[beat.sourceCid],beat.sourceCid)?.swordStyle;
        const benchmark=skyStrike&&typeof EmberBenchmarkArts!=="undefined"&&EmberBenchmarkArts.supports(swordStyle);
        const remasterKind=EmberFXProfiles.fx2Attack(EmberData.byId[beat.sourceCid],beat.sourceCid)?.fx;
        const remastered=fx2()?.renderer3dAvailable&&typeof EmberRemasterArts!=="undefined"&&EmberRemasterArts.supports(remasterKind);
        if(benchmark) rec.benchmarkStyle=swordStyle;
        else if(remastered)rec.remasterKind=remasterKind;
        else if (m.ranged || skyStrike) rangedRecoil(sequence, beat, e.from, actorBox, targetBox);
        else lunge(ctx, beat, i, e.from, actorBox, targetBox, old);
        // R3: a weapon needs its anticipation; a dragon needs an inhalation.
        // These are the SAME instance later consumed at contact, not extra casts.
        const preSpec = EmberFXProfiles.fx2Attack(EmberData.byId[beat.sourceCid], beat.sourceCid);
        if (fx2()?.renderer3dAvailable && (["slash", "breath"].includes(preSpec?.fx)||EmberRemasterArts.supports(preSpec?.fx))) {
          const started = fxCall("attack", preSpec.fx, {
            from: fxBox(actorBox), to: fxBox(targetBox),
            swordStyle: preSpec.swordStyle, sourceCid: beat.sourceCid, sourceRef: e.from, targetRef: e.to,
            tier: outgoing?.tier || 1, tint: preSpec.tint || null,
            tintGrad: preSpec.tintGrad ?? null, ranged: m.ranged,
            startedAt: sequence.origin + beat.at,
            contactAt: sequence.origin + beat.at + m.contact,
            leadMs: m.contact, hitStopMs: m.hitStop,
            seed: sequence.id * 97 + i, timeScale: sequence.plan.scale,sequenceId:sequence.id,
          });
          if (started) { rec.meshPrelude = true; if (!m.ranged) rec.meshMelee = true; }
        }
      });
      at(ctx, beat.at + m.lift, () => {
        const { sequence } = ctx;
        if (performance.now() >= sequence.origin + beat.at + m.contact) return;
        if (sequence.records.get(i)?.meshPrelude) {
          if(!sequence.records.get(i)?.benchmarkStyle&&!sequence.records.get(i)?.remasterKind) sound("swing", anchors.resolve(e.from, sequence.anchors));
          return;
        }
        const actorBox = anchors.resolve(e.from, sequence.anchors),
          targetBox = anchors.resolve(e.to, sequence.anchors);
        sound("swing", actorBox);
        const spec = EmberFXProfiles.fx2Attack(EmberData.byId[beat.sourceCid], beat.sourceCid);
        const meshMelee = !m.ranged && spec?.fx === "slash" && fx2()?.renderer3dAvailable;
        if ((m.ranged || meshMelee) && actorBox && targetBox && spec) {
          fxCall("attack", spec.fx, {
            from: fxBox(actorBox),
            to: fxBox(targetBox),
            tier: beat.contacts[0]?.tier || 1,
            swordStyle: spec?.swordStyle, sourceCid: beat.sourceCid,
            tint: spec?.tint || null,
            tintGrad: spec?.tintGrad ?? null,
            ranged: m.ranged,
            startedAt: sequence.origin + beat.at + m.lift,
            contactAt: sequence.origin + beat.at + m.contact,
            leadMs: m.contact - m.lift,
            hitStopMs: m.hitStop,
            seed: sequence.id * 97 + i,
            timeScale: sequence.plan.scale,
          });
          if (meshMelee) {
            const record = sequence.records.get(i);
            if (record) record.meshMelee = true;
          }
        }
      });
    },
    contact(ctx, beat, i) {
      // One impulse per beat (§4.1): at the first highest-tier contact, with
      // every box touched in that same instant. It also owns the edge flash,
      // so tier 1 calls it too. compile already moved later contacts back by
      // its hit-stop.
      for (const [n, bucket] of beat.buckets.entries())
        at(ctx, bucket.at, () => {
          const old = enterFrame(ctx, beat, i, bucket.frame);
          if (!old) return;
          if (n === 0 && beat.sourceId && !ctx.seenRattles.has(beat.sourceId)) {
            ctx.seenRattles.add(beat.sourceId);
            const source = Object.values(ctx.history).find(
              (p) => p.el?.dataset.uid === beat.sourceId,
            );
            cue(source, "亡语", "deathrattle");
            const target=beat.contacts?.[bucket.contacts?.[0]]?.targetRef;
            const to=target&&anchors.resolve(target,ctx.sequence.anchors);
            if(source&&to)lifeCue(ctx,{id:"rattle-"+beat.sourceId},"trigger",to,{from:fxBox(source),targetRef:target});
          }
          Object.assign(ctx.history, old);
          let impactBox = null,
            impactTier = 0;
          const boxes = [];
          for (const index of bucket.contacts) {
            const box = contactStep(ctx, beat, i, index);
            if (box) boxes.push(box);
            const event = beat.events[index];
            if (box && event.type === "damage" && (event.loss ?? event.amount) > 0 && beat.contacts[index].tier >= impactTier) {
              impactBox = box;
              impactTier = beat.contacts[index].tier;
            }
          }
          if (Math.abs(bucket.at - beat.impulseAt) < 1e-6 && boxes.length) {
            const causeIndex = beat.contacts[bucket.contacts[0]].castBeat,
              cause = causeIndex !== null ? ctx.plan.beats[causeIndex] : null;
            if(!ctx.sequence.records.get(causeIndex)?.benchmarkStyle&&!ctx.sequence.records.get(causeIndex)?.remasterKind) fxCall("impulse", {
              at: boxes.map(fxBox),
              tier: beat.tier,
              cinematic: !!(cause?.cutin || (cause?.battlecry && cause.legendary)),
            });
          }
          if (impactBox) {
            const contact = beat.contacts[bucket.contacts[0]],
              cause = contact.castBeat !== null ? ctx.sequence.records.get(contact.castBeat) : null;
            if(!cause?.benchmarkStyle&&!cause?.remasterKind) sound(cause ? "impact-" + (cause.school || "steel") : "damage", impactBox, {
              gain: T.tiers[impactTier].volume,
              strength: T.tiers[impactTier].volume,
              heavy: impactTier === 3,
            });
          }
        });
    },
    summon(ctx, beat, i) {
      const land = scaled(ctx.sequence, T.summon.land);
      at(ctx, beat.at, () => {
        const old = enterFrame(ctx, beat, i, beat.frame);
        if (!old) return;
        const { sequence } = ctx;
        for (const landed of beat.events) {
          const track = [...sequence.cards.values()].find((c) => c.landingEventId === landed.id);
          const el = unit(landed.side, landed.uid);
          if (track) handoffCardMotion(sequence, track, el);
          const box = el && pos(el);
          const card = EmberData.byId[landed.cid];
          if (el && !quality.reduced && (!track || !sequence.cardLandingIds.has(landed.id)) && land > 0)
            animate(
              el,
              [
                { translate: "0 3px", scale: "1.09 .93" },
                { translate: "0 -2px", scale: ".985 1.025", offset: 0.45 },
                { translate: "0 0", scale: "1" },
              ],
              { duration: land, easing: "cubic-bezier(.16,.8,.24,1)" },
            );
          if (landed.id === ctx.primaryLandingEventId && !landed.rebornFrom)
            sound("play", box, { gain: 0.8 });
          sound("summon", box);
          if(box){
            if(!landed.rebornFrom||!lifeCue(ctx,landed,"rebirth",box))
              fxCall("cue","summon",{at:fxBox(box),targetRef:{side:landed.side,uid:landed.uid},sourceCid:landed.cid,seed:sequence.id*71+i,timeScale:sequence.plan.scale});
            if(card?.tags?.includes("stealth"))lifeCue(ctx,landed,"stealth-in",box);
          }
          if (card?.rarity === "legendary") sound("legendary", box);
          if (landed.rebornFrom) cue(box, "复生 · 1 生命", "reborn");
          if (beat.legendary && box && !quality.reduced) {
            const seal = transient("summon-seal", scaled(sequence, T.summon.land + T.summon.legendary));
            seal.textContent = "✦ 传说降临 ✦";
            seal.style.left = box.x + "px";
            seal.style.top = box.y - box.h / 2 - 20 + "px";
          }
          tracePush({
            beat: i,
            sequence: sequence.id,
            blockId: beat.blockId,
            type: "summon",
            kind: beat.legendary ? EmberFXProfiles.get(landed.cid).arrival || "legendary" : "land",
            actor: null,
            targets: [traced(landed, box)],
            from: null,
            to: [point(box)],
            tier: 1,
            at: performance.now(),
            hitAt: [],
            contactBox: contactBoxes([box], [1], false),
            numberAt: [],
          });
        }
      });
      at(ctx, beat.at + land, () => {
        recordAnchors(ctx.sequence, beat.targets);
        if (!beat.legendary) return;
        const landed = beat.events[0],
          box = anchors.resolve(landed, ctx.sequence.anchors),
          spec = EmberFXProfiles.fx2Arrival(
            EmberFXProfiles.get(landed.cid).arrival,
            EmberData.byId[landed.cid],
          );
        if (box && spec)
          fxCall("cast", spec.fx, {
            from: fxBox(box),
            targets: [fxBox(box)],
            tier: 1,
            tint: spec.tint || null,
            tintGrad: spec.tintGrad ?? null,
            aoe: false,
            seed: ctx.sequence.id * 97 + i,
            timeScale: ctx.sequence.plan.scale,
          });
      });
      if (beat.battlecry) {
        const cast = beat.battlecry;
        at(ctx, cast.flashAt, () => {
          const rec = castFlash(ctx, i, cast, "battlecry");
          rec.school = schoolOf(EmberData.byId[beat.events[0].cid]);
        });
        at(ctx, cast.startAt, () => castLaunch(ctx, i, cast));
      }
    },
    death(ctx, beat, i) {
      at(ctx, beat.at, () => {
        const old = enterFrame(ctx, beat, i, beat.frame);
        if (!old) return;
        const { sequence } = ctx;
        Object.assign(ctx.history, old);
        let soundBox = null;
        for (const e of beat.events) {
          const key = refKey(e),
            owner = attackOwners.get(key);
          let visual = ctx.history[key];
          if (owner && !owner.live && owner.el?.isConnected) {
            owner.dead = true;
            const copy = owner.el.cloneNode(true);
            copy.classList.remove("attack-actor", "death-ghost");
            copy.style.transform = "";
            visual = { ...(pos(owner.el) || owner.impact), el: owner.el, html: copy.outerHTML };
            releaseAttackOwner(key, false, owner);
          } else if (owner) releaseAttackOwner(key, false, owner);
          deathGhost(sequence, visual, schoolOf(EmberData.byId[e.cid]));
          if(visual)fxCall("cue","demise",{at:fxBox(visual),sourceCid:e.cid,seed:sequence.id*71+i,timeScale:sequence.plan.scale});
          dropNumbers(key, scaled(sequence, T.death.freeze + T.death.dissolve));
          sequence.anchors.delete(key);
          soundBox ||= visual;
          tracePush({
            beat: i,
            sequence: sequence.id,
            blockId: beat.blockId,
            type: "death",
            kind: e.cid,
            actor: null,
            targets: [traced(e, visual)],
            from: null,
            to: [],
            tier: 1,
            at: performance.now(),
            hitAt: [],
            contactBox: [],
            numberAt: [],
          });
        }
        sound("death", soundBox);
      });
      at(ctx, beat.at + beat.hold, () => recordAnchors(ctx.sequence));
    },
    draw(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        for (const e of beat.events) {
          sound("draw", e.side === "p" ? { x: W * 0.72 } : { x: W * 0.55 });
          if (!quality.reduced) startDrawCardMotion(ctx.sequence, e, beat);
          const tr=ctx.plan.cardTracks?.find(x=>x.sourceEventId===e.id);
          if(e.side==="p")at(ctx,tr?.markers?.handoffAt??(beat.at+beat.hold*.78),()=>{
            const el=document.querySelector(`#hand [data-hand="${e.uid}"]`),b=el&&pos(el);
            if(b)lifeCue(ctx,e,"draw-arrive",b,{targetRef:{side:e.side,uid:"hand-"+e.uid}});
          });
        }
      });
    },
    burn(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        for (const e of beat.events) {
          const p = heroFace(ctx, e.side);
          sound("burn", p);
          const anchor=EmberViewport.deckAnchor(e.side)||p;
          const w=EmberViewport.mobile?72:104,drawBox={...anchor,w,h:w*1.40};
          lifeCue(ctx,e,"overdraw",drawBox,{targetRef:{side:e.side,uid:"burn"},sourceCid:e.side==="p"?e.cid:null});
          cue(p, e.side === "p" && e.cid ? `${EmberData.byId[e.cid].name} · 手牌已满` : "手牌已满 · 焚毁", "burn");
        }
      });
    },
    turn(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        for (const e of beat.events) {
          turnCue(e.side, beat.frame?.turn ?? ctx.s.turn);
          lifeCue(ctx,e,"turn-ready",heroFace(ctx,e.side));
          sound(e.side === "p" ? "turn" : "turn-enemy");
        }
      });
    },
    over(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        for (const e of beat.events) {
          sound(e.winner === "p" ? "victory" : e.winner === "draw" ? "draw-result" : "defeat");
          if(e.winner!=="draw"){
            const loser=e.winner==="p"?"e":"p";
            lifeCue(ctx,e,"hero-fall",heroFace(ctx,loser),{targetRef:{side:loser,uid:"hero"}});
            lifeCue(ctx,e,e.winner==="p"?"victory":"defeat",heroFace(ctx,"p"),{targetRef:{side:"p",uid:"hero"}});
          }
          if (e.winner !== "draw")
            cue(heroFace(ctx, e.winner === "p" ? "e" : "p"), "英雄倒下", "defeat");
        }
      });
    },
    secret(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        const { sequence } = ctx;
        for (const e of beat.events) {
          const owner = { side: e.side, uid: "hero" },
            box = heroFace(ctx, e.side);
          cue(box, (EmberData.byId[e.cid]?.name || "奥秘") + " · 触发", "secret");
          sound("cast-arcane", box);
          const countered = ctx.plan.beats.find(
            (b, n) => n < i && b.countered && b.actionId === beat.actionId,
          );
          const caster = countered ? countered.cast.actor : null,
            casterBox = caster ? anchors.resolve(caster, sequence.anchors) : null;
          lifeCue(ctx,e,"secret-reveal",box,{targetRef:owner});
          if (casterBox) {
            lifeCue(ctx,e,"counterspell",casterBox,{from:fxBox(box),targetRef:caster});
            fxCall("contact", { at: fxBox(casterBox), tier: 1 });
          }
          tracePush({
            beat: i,
            sequence: sequence.id,
            blockId: beat.blockId,
            type: "secret",
            kind: e.cid,
            actor: traced(owner, box),
            targets: caster ? [traced(caster, casterBox)] : [],
            from: null,
            to: casterBox ? [point(casterBox)] : [],
            tier: 1,
            at: performance.now(),
            hitAt: [],
            contactBox: contactBoxes([casterBox], [1], false),
            numberAt: [],
          });
        }
      });
    },
    weaponWear(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        for (const e of beat.events) {
          const box = heroFace(ctx, e.side);
          cue(box, e.broken ? "武器损坏" : "耐久 −1", "weapon");
          if (e.broken) {sound("weapon-break", box);lifeCue(ctx,e,"weapon-break",box);}
        }
      });
    },
    contract(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        const e = beat.events[0],
          name = EmberData.byId[e.cid].name,
          box = anchors.resolve(e, ctx.sequence.anchors) || measure(e) || heroFace(ctx, e.side);
        if (e.divine && !quality.reduced) {
          const seal = transient("divine-arrival", beat.hold);
          const deity = EmberFXProfiles.get(e.cid).deity;
          seal.dataset.deity = deity.theme;
          seal.innerHTML = `<div class="divine-atmosphere"></div><div class="divine-halo"></div><div class="divine-orbit orbit-one"></div><div class="divine-orbit orbit-two"></div><div class="divine-rays"><i></i><i></i><i></i><i></i><i></i></div><img src="${EmberArt.card(EmberData.byId[e.cid])}" alt=""><div class="divine-caption"><small>${deity.english}</small><strong>${name}</strong><span>${deity.title}</span><em>${deity.sigil} 神祇降临 ${deity.sigil}</em></div>`;
          sound("phase", box);
        } else cue(measure(e) || box, name + " · 契约降临", "summon");
      });
    },
    phase(ctx, beat, i) {
      at(ctx, beat.at, () => {
        if (!enterFrame(ctx, beat, i, beat.frame)) return;
        phaseChange(ctx.s, beat.hold);
        lifeCue(ctx,beat.events[0]||{},"awaken",heroFace(ctx,"e"),{targetRef:{side:"e",uid:"hero"}});
      });
    },
  };
  function contactStep(ctx, beat, beatIndex, index) {
    const { sequence } = ctx;
    const contact = beat.contacts[index],
      event = beat.events[index],
      ref = contact.targetRef,
      box = resolveOrWarn(sequence, beatIndex, ref, "target");
    if (!box) return null;
    const cause = contact.castBeat !== null ? sequence.records.get(contact.castBeat) : null,
      key = refKey(ref),
      tier = contact.tier,
      actorBox = contact.actor ? anchors.resolve(contact.actor, sequence.anchors) : null,
      timing = {
        contact: contact.contactAt,
        release: contact.releaseAt,
        recoveryEnd: contact.recoveryEndAt,
        recoilPx: contact.recoilPx,
        family: contact.family,
      };
    let numberAt = null;
    const sourceless = contact.direction === "sourceless" || !cause;
    if (event.type === "damage") {
      const loss = event.loss ?? event.amount;
      if(ref.uid==="hero"&&!event.from){
        const current=ctx.s?.[ref.side]?.fatigue||0;
        if(current>(ctx.lifecycleFatigue?.[ref.side]||0)){
          lifeCue(ctx,event,"fatigue",box);ctx.lifecycleFatigue[ref.side]=(ctx.lifecycleFatigue[ref.side]||0)+1;
        }
      }
      if (event.absorbed) {
        lifeCue(ctx,event,"armor-break",box);
        cue({ ...box, y: box.y - 24 }, `护甲吸收 ${event.absorbed}`, "armor");
        sound("armor", box);
      }
      if (loss > 0) {
        if(!((cause?.benchmarkStyle||cause?.remasterKind) && contact.direction === "outgoing"))
          startReaction(sequence, ref, actorBox, timing);
        numberAt = number(numberSpot(contact, box, actorBox), loss, "damage", { key, tier });
        if (contact.direction === "outgoing" && cause && !cause.ranged && !cause.meshMelee) {
          const spec = EmberFXProfiles.fx2Attack(EmberData.byId[contact.sourceCid], contact.sourceCid);
          if (spec) fxCall("attack", spec.fx, {
            from: fxBox(actorBox),
            to: fxBox(box),
            tier,
            swordStyle: spec?.swordStyle, sourceCid: contact.sourceCid, targetRef: ref,sequenceId:sequence.id,
            tint: spec?.tint || null,
            tintGrad: spec?.tintGrad ?? null,
            ranged: false,
            seed: sequence.id * 97 + beatIndex,
            timeScale: sequence.plan.scale,
          });
        } else if (contact.direction === "retaliation" || sourceless)
          fxCall("contact", { at: fxBox(box), tier });
      }
    } else if (event.type === "shield") {
      startReaction(sequence, ref, actorBox, { ...timing, recoilPx: T.tiers[1].recoilPx });
      numberAt = number(box, 0, "shield", { key });
      sound("shield", box);
      if(!lifeCue(ctx,event,"shield-break",box))
        fxCall("cue","ward",{at:fxBox(box),targetRef:ref,seed:sequence.id*71+index,timeScale:sequence.plan.scale});
      if (sourceless || contact.direction === "retaliation") fxCall("contact", { at: fxBox(box), tier: 1 });
    } else if (event.type === "heal") {
      numberAt = number(box, event.amount, "heal", { key });
      sound("heal", box);
      if(!cause?.remasterKind)fxCall("cue","heal",{at:fxBox(box),targetRef:ref,seed:sequence.id*71+index,timeScale:sequence.plan.scale});
      if (sourceless) fxCall("contact", { at: fxBox(box), tier: 1 });
    } else if (event.type === "status") {
      statusCue(ctx, event, box);
    }
    if (numberAt !== null) {
      if (cause && contact.direction === "retaliation") cause.counterAt = numberAt;
      else if (cause) cause.numberAt[contact.targetIndex] = numberAt;
      else
        tracePush({
          beat: beatIndex,
          sequence: sequence.id,
          blockId: beat.blockId,
          type: "contact",
          kind: event.type,
          actor: null,
          targets: [traced(ref, box)],
          from: null,
          to: [point(box)],
          tier,
          at: sequence.origin + contact.contactAt,
          hitAt: [sequence.origin + contact.contactAt],
          contactBox: contactBoxes([box], [tier], false),
          numberAt: [numberAt],
        });
    }
    return box;
  }
  /** A melee pair shows its two numbers on the far halves of the two cards. */
  function numberSpot(contact, box, actorBox) {
    if (!actorBox || !["outgoing", "retaliation"].includes(contact.direction))
      return box;
    const dx = box.x - actorBox.x,
      dy = box.y - actorBox.y,
      len = Math.hypot(dx, dy) || 1;
    return {
      ...box,
      x: box.x + (dx / len) * box.w * 0.12,
      y: box.y + (dy / len) * box.h * 0.22,
    };
  }
  const STATUS_LABELS = {
    trigger: () => "能力触发",
    freeze: () => "冻结",
    thaw: () => "解冻",
    silence: () => "沉默",
    transform: () => "变形",
    sacrifice: () => "献祭",
    expire: (e) => `攻击 ${e.attack}`,
    buff: (e) => `+${e.attack}${e.health ? " / +" + e.health : " 攻击"}`,
    grant: (e) => EmberData.kw[e.tag],
    armor: (e) => `护甲 +${e.amount}`,
    mana: (e) => `法力 +${e.amount}`,
  };
  const STATUS_SOUNDS = {
    freeze: "freeze",
    silence: "silence",
    transform: "cast-shadow",
    armor: "armor",
    buff: "buff",
    mana: "buff",
    grant: "buff",
  };
  /* §2.5: status visuals belong to the card's CSS state after render; the
   * director only names the change. */
  function statusCue(ctx, e, box) {
    cue(box, STATUS_LABELS[e.kind]?.(e) || e.kind, e.kind);
    if (STATUS_SOUNDS[e.kind]) sound(STATUS_SOUNDS[e.kind], box, { gain: 0.6 });
    const identity=typeof EmberLifecycleArts!=="undefined"?EmberLifecycleArts.kindFor(e):null;
    const played=identity&&lifeCue(ctx,e,identity,box);
    if(e.kind==="thaw"&&played)sound("freeze",box,{gain:.35});
    if (e.kind === "transform" && !quality.reduced && !played) {
      const el = unit(e.side, e.uid);
      if (el)
        animate(
          el,
          [
            { opacity: 0, filter: "blur(9px)", scale: ".85" },
            { opacity: 1, filter: "blur(0)", scale: "1" },
          ],
          { duration: scaled(ctx.sequence, 300) },
        );
    }
  }
  function phaseChange(s, hold) {
    const boss = EmberData.bosses[s.bossIndex];
    if (!boss) return;
    const school = EmberFXProfiles.fromPalette(boss.palette),
      el = document.getElementById("cinematic");
    el.innerHTML = `<div class="cinematic-inner" style="--theme:${accents[school]}"><div class="cinematic-kicker">PHASE II · ${boss.en}</div><div class="cinematic-title">${boss.name} · 觉醒</div><div class="cinematic-quote">「${boss.quote}」</div></div>`;
    el.classList.add("visible");
    const life = Math.max(0, hold - 50);
    if (!quality.reduced)
      animate(
        el,
        [
          { opacity: 0, transform: "scale(1.035)" },
          { opacity: 1, transform: "scale(1)", offset: 0.2 },
          { opacity: 1, offset: 0.73 },
          { opacity: 0 },
        ],
        { duration: life, fill: "forwards" },
      );
    EmberAudio.fx("phase");
    schedule(() => {
      el.classList.remove("visible");
      el.innerHTML = "";
    }, life + 20);
  }

  /* ------------------------------------------------------------- present */
  function cutinAllowed(s) {
    return (ctx) => {
      const spec = EmberFXProfiles.fx2Attack(
        ctx.cid ? EmberData.byId[ctx.cid] || { id: ctx.cid } : null,
        ctx.cid,
      );
      return EmberFXProfiles.cutinPolicy({
        cutin: !!spec?.cutin,
        fx2: !quality.reduced && !!fx2()?.available,
        art: !!cutinArt({ side: ctx.side, uid: ctx.uid }, ctx.cid, s),
        hero: ctx.hero,
        legendary: ctx.legendary,
      });
    };
  }
  function castSpecFor(s) {
    return (ctx) => {
      let spec = null;
      if (ctx.kind === "play") spec = EmberFXProfiles.fx2(ctx.cid);
      else if (ctx.kind === "power")
        spec = EmberFXProfiles.fx2Power(powerSchool(ctx.side, s));
      else if (ctx.kind === "battlecry")
        spec = EmberFXProfiles.fx2Cast(ctx.battlecry, EmberData.byId[ctx.cid]);
      return spec
        ? { kind: spec.fx, tint: spec.tint || null, tintGrad: spec.tintGrad ?? null, swordStyle: spec.swordStyle || null }
        : null;
    };
  }
  function present(events, s, render, after, cardHTML, before = null, options = null) {
    const version = ++presentationVersion;
    if (busy) {
      const result = cancel(true);
      if (result.reentered || presentationVersion !== version) return;
    }
    clearTurnCue();
    const snapshot = captureAnchors();
    const plan = EmberCombat.compile(events, before, s, quality.reduced, "blade", {
      anchor: (ref, frame) =>
        anchors.resolve(ref, snapshot) ||
        (ref?.uid && ref.uid !== "hero"
          ? EmberViewport.minionLandingBox(frame, ref.side, ref.uid)
          : null),
      castSpec: castSpecFor(s),
      card: (cid) => EmberData.byId[cid] || null,
      cutin: cutinAllowed(s),
    });
    if (!plan.beats.length) {
      const startGeneration = generation;
      render();
      if (presentationVersion !== version || generation !== startGeneration || activeSequence)
        return;
      after?.();
      return;
    }
    setBusy(true);
    const sequence = createSequence(plan, version);
    sequence.anchors = snapshot;
    pendingCommit = () => render();
    doneCallback = after;
    const primary = events.find((e) => ["play", "attack", "power"].includes(e.type));
    const ctx = {
      sequence,
      plan,
      render,
      cardHTML,
      cardOrigin: options?.cardOrigin || null,
      events,
      s,
      history: capture(),
      lifecycleFatigue:{p:before?.p?.fatigue||0,e:before?.e?.fatigue||0},
      seenRattles: new Set(),
      primaryLandingEventId:
        plan.cardTracks?.find((track) => track.sourceEventId === primary?.id)?.landingEventId || null,
    };
    for (const [index, beat] of plan.beats.entries()) {
      const recipe =
        recipes[beat.kind] ||
        (beat.buckets ? recipes.contact : null);
      recipe?.(ctx, beat, index);
    }
    timeline.at(sequence, plan.duration + 80, () => finish(sequence));
  }
  function finish(sequence) {
    retireExpiredReactions(sequence, performance.now(), true);
    retireExpiredAttackOwners(performance.now(), true, sequence);
    for (const track of [...sequence.cards.values()]) disposeCardMotion(sequence, track);
    closeSequence(sequence);
    const commit = pendingCommit,
      cb = doneCallback;
    pendingCommit = doneCallback = null;
    commit?.();
    if (
      generation !== sequence.generation ||
      presentationVersion !== sequence.version ||
      activeSequence
    )
      return;
    setBusy(false);
    cb?.();
  }

  /* ------------------------------------------------------------ lifecycle */
  function cleanupVisuals(sequence = activeSequence) {
    if (sequence?.cards) {
      for (const track of [...sequence.cards.values()]) disposeCardMotion(sequence, track);
      sequence.cards.clear();
    }
    timers.forEach(clearTimeout);
    timers.clear();
    if (sequence) {
      sequence.timer = null;
      sequence.queue.length = 0;
    }
    animations.forEach((a) => a.cancel());
    animations.clear();
    layoutOwners.clear();
    retireExpiredReactions(sequence, performance.now(), true);
    for (const key of [...attackOwners.keys()]) releaseAttackOwner(key);
    nodes.forEach((el) => el.remove());
    nodes.clear();
    // In-flight effects of a cancelled scene must not outlive it.
    fx2()?.clear?.();
    document.getElementById("cinematic").classList.remove("visible");
    document
      .querySelectorAll(".hero,.minion,#hand .hand-card")
      .forEach((el) => (el.style.visibility = ""));
    setBusy(false);
  }
  function cancel(commit = false) {
    const sequence = activeSequence,
      commitFn = commit ? pendingCommit : null,
      expectedGeneration = generation + 1,
      expectedPresentationVersion = presentationVersion;
    generation++;
    closeSequence(sequence);
    EmberAudio.stop();
    pendingCommit = null;
    doneCallback = null;
    cleanupVisuals(sequence);
    // Old visual cleanup is complete before user-owned rendering can re-enter
    // presentation and create a new active sequence.
    commitFn?.();
    return {
      sequence,
      reentered:
        generation !== expectedGeneration ||
        presentationVersion !== expectedPresentationVersion ||
        activeSequence !== null,
    };
  }
  function paintWorld(t) {
    wc.clearRect(0, 0, W, H);
    AtelierWorld.paint(wc, t, view, theme, phase, quality.reduced, quality.low);
    worldDirty = false;
  }
  let worldLast = 0;
  function resizeCanvas() {
    W = EmberViewport.width;
    H = EmberViewport.height;
    const d = EmberViewport.mobile
      ? Math.min(devicePixelRatio || 1, quality.low ? 1 : 2)
      : 1;
    world.width = Math.round(W * d);
    world.height = Math.round(H * d);
    wc.setTransform(d, 0, 0, d, 0, 0);
    worldDirty = true;
  }
  function reflow() {
    const commit = pendingCommit,
      after = doneCallback;
    pendingCommit = null;
    doneCallback = null;
    const version = ++presentationVersion;
    cancel();
    resizeCanvas();
    const callbackGeneration = generation;
    commit?.();
    if (
      presentationVersion !== version ||
      generation !== callbackGeneration ||
      activeSequence
    )
      return;
    after?.();
  }
  function tick(t) {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    // Low quality throttles only the ambient world paint; effects and their
    // contact frames run every display frame (§2.7: low only lowers resolution).
    if (
      worldDirty ||
      AtelierWorld.loading ||
      (!quality.reduced && t - worldLast > (quality.low ? 120 : 80))
    ) {
      paintWorld(quality.reduced ? 0 : t / 1000);
      worldLast = t;
    }
    // The effect backend has no rAF of its own; idle frames draw nothing.
    fx2()?.draw?.(t);
  }
  function setView(v) {
    view = v;
    EmberAudio.setScene(v);
    worldDirty = true;
    if (v !== "battle") cancel();
  }
  function setTheme(i, p = false) {
    if (theme !== i || phase !== p) {
      theme = i;
      phase = p;
      worldDirty = true;
    }
  }
  function configure(reduced, low) {
    quality = { reduced: !!reduced, low: !!low };
    fx2()?.setQuality?.(quality);
    app.classList.toggle("fx-low", quality.low);
    app.classList.toggle("fx-reduced", quality.reduced);
    worldDirty = true;
    // Turning accessibility on is immediate, even during an effect's tail.
    // Keep the rule commit and busy lifecycle; only remove decoration.
    if (quality.reduced) {
      if (busy && pendingCommit) {
        const cb = doneCallback;
        const callbackVersion = presentationVersion;
        const result = cancel(true);
        if (result.reentered || presentationVersion !== callbackVersion) return;
        const callbackGeneration = generation;
        cb?.();
        if (
          generation !== callbackGeneration ||
          presentationVersion !== callbackVersion ||
          activeSequence
        )
          return;
      }
      for (const a of animations) a.cancel();
      animations.clear();
      for (const el of [...nodes])
        if (el.matches(".death-ghost,.cast-card,.summon-seal,.card-motion-proxy,.divine-arrival")) {
          el.remove();
          nodes.delete(el);
        }
      document
        .querySelectorAll(".minion[data-uid],.hero,#hand .hand-card")
        .forEach((el) => {
          el.style.visibility = "";
        });
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) worldDirty = true;
  });
  resizeCanvas();
  fx2()?.init?.({ debug: new URLSearchParams(location.search).has("debug") });
  fx2()?.setQuality?.(quality);
  requestAnimationFrame(tick);
  return {
    reflow,
    present,
    cancel,
    captureCardTargets,
    syncCardTargets,
    setView,
    setTheme,
    configure,
    /** Read-only anchor lookup against the live DOM (tests, tooling). */
    anchor: (ref) => anchors.resolve(ref, activeSequence?.anchors || captureAnchors()),
    get trace() {
      return trace;
    },
    get busy() {
      return busy;
    },
    get activeAnimations() {
      return animations.size;
    },
    get transientNodes() {
      return nodes.size;
    },
    get pendingTimers() {
      return timers.size;
    },
  };
})();
