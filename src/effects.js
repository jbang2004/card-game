/* REKINDLED — independent, bounded Canvas combat compositor.
 * All effects are driven by immutable event payloads. Rules never depend on an
 * animation clock. Save data remains version 1. Cancelled scenes clean up timers,
 * particles, animation clones, and the input lock. No network assets are used.
 */
const EmberFX = (() => {
  "use strict";
  let W = EmberViewport.width,
    H = EmberViewport.height;
  const TAU = Math.PI * 2,
    canvas = document.getElementById("fx-canvas"),
    ctx = canvas.getContext("2d"),
    app = document.getElementById("app");
  const world = document.getElementById("world-canvas"),
    wc = world.getContext("2d");
  const colors = {
    steel: ["#e9ede3", "#aab5b1", "#728988"],
    fire: ["#ffe7b2", "#f1a35c", "#bd5439"],
    frost: ["#e1ffff", "#86dcec", "#5a8eb2"],
    arcane: ["#f1e9ff", "#b3a3e8", "#746fba"],
    nature: ["#e4f5ad", "#a6d6a2", "#558e7e"],
    holy: ["#fff2ce", "#eac992", "#b79153"],
    shadow: ["#e3bffa", "#a77dc8", "#574477"],
    blood: ["#ffd7c2", "#d98c88", "#8c4d6b"],
  };
  const schoolNames = {
    steel: "钢铁",
    fire: "烈焰",
    frost: "寒霜",
    arcane: "奥术",
    nature: "自然",
    holy: "圣光",
    shadow: "暗影",
    blood: "鲜血",
  };
  let items = [],
    timers = new Set(),
    animations = new Set(),
    nodes = new Set(),
    generation = 0,
    busy = false,
    pendingCommit = null,
    doneCallback = null;
  let last = 0,
    now = 0,
    view = "lobby",
    theme = 0,
    phase = false,
    quality = { reduced: false, low: false },
    worldDirty = true,
    backdrop = null,
    frame = 0,
    lab = false;
  let counts = { actions: 0, previews: 0, school: {}, maxParticles: 0 };
  const rnd = (a, b) => a + Math.random() * (b - a),
    clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n)),
    lerp = (a, b, t) => a + (b - a) * t;
  function ease(t) {
    return 1 - Math.pow(1 - clamp(t), 3);
  }
  function schedule(fn, ms) {
    const gen = generation;
    const id = setTimeout(() => {
      timers.delete(id);
      if (gen === generation) fn();
    }, ms);
    timers.add(id);
    return id;
  }
  function setBusy(v) {
    busy = v;
    app.classList.toggle("fx-busy", v);
    const el = document.getElementById("action-status");
    if (el) el.textContent = v ? "RESOLVING · 战斗结算" : "";
  }
  function pos(el) {
    return EmberViewport.pos(el);
  }
  function unit(side, uid) {
    return uid === "hero"
      ? document.getElementById(side === "p" ? "player-hero" : "enemy-hero")
      : document.querySelector(`#battle .minion[data-uid="${uid}"]`);
  }
  function fallback(s, side, uid) {
    return EmberViewport.fallback(s, side, uid);
  }
  function capture() {
    const m = {};
    document
      .querySelectorAll("#battle .hero,#battle .minion[data-uid]")
      .forEach((el) => {
        m[el.dataset.side + el.dataset.uid] = {
          ...pos(el),
          el,
          cid: el.dataset.cardid,
          html: el.outerHTML,
        };
      });
    document
      .querySelectorAll(".hand-card")
      .forEach((el) => (m["hand" + el.dataset.hand] = { ...pos(el) }));
    return m;
  }
  function settleLayout(old) {
    if (quality.reduced) return;
    document
      .querySelectorAll("#battle .minion[data-uid],#hand .hand-card")
      .forEach((el) => {
        if (EmberViewport.mobile && el.dataset.hand) return;
        const key = el.dataset.hand
            ? "hand" + el.dataset.hand
            : el.dataset.side + el.dataset.uid,
          prev = old[key],
          p = pos(el);
        if (!p) return;
        let frames;
        if (prev) {
          const dx = prev.x - p.x,
            dy = prev.y - p.y;
          if (Math.abs(dx) + Math.abs(dy) < 3) return;
          frames = [{ translate: `${dx}px ${dy}px` }, { translate: "0px 0px" }];
        } else if (el.dataset.hand) {
          frames = [
            { opacity: 0, translate: "22px 16px" },
            { opacity: 1, translate: "0px 0px" },
          ];
        } else return;
        const a = el.animate(frames, {
          duration: 420,
          easing: "cubic-bezier(.18,.72,.24,1)",
        });
        animations.add(a);
        a.onfinish = () => animations.delete(a);
      });
  }
  function add(kind, data, d = 800, delay = 0) {
    if (EmberViewport.mobile) {
      data = { ...data };
      for (const k of ["radius", "size", "wide", "vx", "vy", "gravity"])
        if (typeof data[k] === "number") data[k] *= EmberViewport.effectScale;
    }
    if (items.length > 800) items.splice(0, items.length - 780);
    items.push({ kind, ...data, start: performance.now() + delay, d });
    counts.maxParticles = Math.max(counts.maxParticles, items.length);
  }
  function spark(x, y, school = "fire", n = 36, options = {}) {
    if (quality.reduced) return;
    const scale = quality.low ? 0.5 : 1;
    for (let i = 0; i < n * scale; i++) {
      let a = rnd(0, TAU),
        v = rnd(45, options.speed || 190);
      add(
        "particle",
        {
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - (options.up || 0),
          size: rnd(0.9, options.size || 3.8),
          rot: rnd(0, TAU),
          spin: rnd(-6, 6),
          gravity: options.gravity ?? 110,
          color: colors[school][i % 3],
          school,
          shape: options.shape || "spark",
          ...options,
        },
        rnd(430, options.life || 1150),
      );
    }
  }
  function rune(
    x,
    y,
    school = "arcane",
    radius = 70,
    d = 850,
    reverse = false,
  ) {
    if (quality.reduced) return;
    add("rune", { x, y, school, radius, reverse, rot: rnd(0, TAU) }, d);
  }
  function ring(x, y, school = "fire", radius = 110, d = 620, ry = 1) {
    if (quality.reduced) return;
    add("ring", { x, y, school, radius, ry }, d);
  }
  function glow(x, y, school = "fire", radius = 85, d = 500) {
    if (quality.reduced) return;
    add("glow", { x, y, school, radius }, d);
  }
  function shake(amount = 3) {
    if (quality.reduced) return;
    for (const el of [world, document.getElementById("scene")]) {
      if (!el?.animate) continue;
      const a = el.animate(
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${amount}px,${amount * 0.45}px)` },
          { transform: `translate(${-amount * 0.65}px,${-amount * 0.25}px)` },
          { transform: `translate(${amount * 0.3}px,0)` },
          { transform: "translate(0,0)" },
        ],
        { duration: 260, easing: "ease-out" },
      );
      animations.add(a);
      a.onfinish = () => animations.delete(a);
    }
  }
  function vignette(school = "fire", d = 600, x = 800, y = 430) {
    if (quality.reduced) return;
    const v = document.getElementById("fx-vignette");
    v.style.setProperty("--vcolor", colors[school][2]);
    v.style.setProperty("--vx", (x / W) * 100 + "%");
    v.style.setProperty("--vy", (y / H) * 100 + "%");
    v.animate(
      [{ opacity: 0 }, { opacity: 0.7, offset: 0.22 }, { opacity: 0 }],
      { duration: d, easing: "ease-out" },
    );
  }
  function number(p, n, type = "damage") {
    const el = document.createElement("div");
    el.className =
      "damage-number " +
      (type === "heal"
        ? "heal"
        : type === "shield"
          ? "block"
          : n >= 6
            ? "crit"
            : "");
    el.innerHTML =
      type === "shield"
        ? "格挡"
        : `${type === "heal" ? "+" : "−"}${n}${n >= 6 && type === "damage" ? "<small>重击</small>" : ""}`;
    el.style.left = p.x + "px";
    el.style.top = p.y - 20 + "px";
    app.appendChild(el);
    nodes.add(el);
    schedule(() => {
      el.remove();
      nodes.delete(el);
    }, 1150);
  }
  function impact(x, y, school = "fire", strength = 1) {
    if (quality.reduced) {
      return;
    }
    if (!EmberViewport.mobile)
      EmberScene.burst(
        x,
        y,
        parseInt(colors[school][1].slice(1), 16),
        quality.low ? 14 : 26,
      );
    const s = clamp(strength, 0.6, 2.2);
    glow(x, y, school, 80 * s, 510);
    if (school === "steel") {
      add("slash", { x, y, school, a: rnd(-1, 1), radius: 85 * s }, 360);
      add(
        "slash",
        { x: x + 5, y: y - 7, school, a: rnd(1.3, 2.3), radius: 60 * s },
        260,
        80,
      );
      spark(x, y, school, 34 * s, { speed: 260, size: 2.5, gravity: 240 });
      ring(x, y, school, 90 * s, 380, 0.7);
    } else if (school === "fire") {
      for (let i = 0; i < 7; i++)
        add(
          "smoke",
          {
            x: x + rnd(-30, 30),
            y: y + rnd(-25, 15),
            school,
            radius: rnd(18, 35) * s,
            vx: rnd(-25, 25),
            vy: rnd(-55, -20),
          },
          900 + i * 55,
        );
      add("explosion", { x, y, school, radius: 105 * s }, 680);
      ring(x, y, school, 120 * s, 640, 0.7);
      spark(x, y, school, 70 * s, {
        speed: 245,
        gravity: 170,
        up: 45,
        size: 4.5,
        life: 1100,
      });
      add("scorch", { x, y, school, radius: 50 * s }, 1900);
    } else if (school === "frost") {
      ring(x, y, school, 108 * s, 760, 0.75);
      rune(x, y, school, 65 * s, 800);
      for (let i = 0; i < 16; i++) {
        let a = (i * TAU) / 16;
        add(
          "ice",
          { x, y, a, radius: rnd(46, 106) * s, wide: rnd(5, 14) },
          740 + rnd(0, 220),
        );
      }
      spark(x, y, school, 46 * s, {
        shape: "shard",
        speed: 210,
        gravity: 25,
        life: 1300,
        size: 5,
      });
      add("mist", { x, y, school, radius: 100 * s }, 1350);
    } else if (school === "arcane") {
      rune(x, y, school, 90 * s, 950);
      ring(x, y, school, 125 * s, 650);
      add("starburst", { x, y, school, radius: 115 * s }, 570);
      spark(x, y, school, 45 * s, {
        shape: "diamond",
        gravity: -20,
        speed: 155,
        size: 4.4,
      });
    } else if (school === "nature") {
      rune(x, y, school, 78 * s, 950);
      add("bloom", { x, y, school, radius: 98 * s }, 1100);
      spark(x, y, school, 38 * s, {
        shape: "leaf",
        gravity: -58,
        speed: 105,
        size: 7,
        life: 1600,
      });
    } else if (school === "holy") {
      add("pillar", { x, y, school, radius: 62 * s }, 870);
      rune(x, y, school, 93 * s, 1080);
      spark(x, y, school, 42 * s, {
        shape: "cross",
        up: 40,
        gravity: -75,
        speed: 110,
        size: 4.5,
        life: 1400,
      });
      ring(x, y, school, 113 * s, 820, 0.65);
    } else {
      add("vortex", { x, y, school, radius: 100 * s }, 870);
      rune(x, y, school, 95 * s, 770, true);
      spark(x, y, school, 42 * s, {
        shape: "smoke",
        speed: 115,
        gravity: -15,
        life: 1250,
        size: 6.5,
      });
      ring(x, y, school, 110 * s, 740, 0.7);
    }
    if (s > 1.25) shake(2.5 * s);
  }
  function projectile(from, to, school = "fire", duration = 510) {
    if (quality.reduced) return;
    const bend =
      school === "frost"
        ? 40
        : school === "nature"
          ? -75
          : -Math.min(135, Math.hypot(to.x - from.x, to.y - from.y) * 0.22);
    add(
      "projectile",
      { from, to, school, bend, radius: school === "fire" ? 14 : 10 },
      duration,
    );
    rune(from.x, from.y, school, 37, 440);
    glow(from.x, from.y, school, 55, 420);
    if (school === "arcane")
      add(
        "lightning",
        { from, to, school, seed: Math.random() * 900 },
        duration + 70,
      );
  }
  function heal(p, amount) {
    if (!quality.reduced) {
      add("heal", { ...p, school: "nature", radius: 56 }, 1100);
      spark(p.x, p.y, "nature", 26, {
        shape: "leaf",
        up: 80,
        gravity: -20,
        speed: 65,
        size: 5,
        life: 1200,
      });
    }
    number(p, amount, "heal");
  }
  function shieldBreak(p) {
    if (!quality.reduced) {
      for (let i = 0; i < 17; i++) {
        let a = (i / 17) * TAU;
        add(
          "particle",
          {
            x: p.x + Math.cos(a) * 48,
            y: p.y + Math.sin(a) * 58,
            vx: Math.cos(a) * rnd(65, 170),
            vy: Math.sin(a) * rnd(65, 150),
            size: rnd(8, 18),
            rot: a,
            spin: rnd(-3, 3),
            gravity: 150,
            color: colors.holy[i % 3],
            shape: "glass",
          },
          rnd(560, 1000),
        );
      }
      ring(p.x, p.y, "holy", 85, 480);
    }
    number(p, 0, "shield");
  }
  function death(old, school) {
    if (!old) return;
    spark(old.x, old.y, school, 30, {
      shape: "ash",
      gravity: -28,
      up: 25,
      speed: 70,
      life: 1400,
      size: 3,
    });
    if (quality.reduced) return;
    const ghost = document.createElement("div");
    ghost.innerHTML = old.html;
    const el = ghost.firstElementChild;
    if (!el) return;
    el.removeAttribute("id");
    el.classList.add("death-ghost");
    el.style.left = old.left + "px";
    el.style.top = old.top + "px";
    el.style.width = old.w + "px";
    el.style.height = old.h + "px";
    el.style.visibility = "visible";
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    app.appendChild(el);
    nodes.add(el);
    const a = el.animate(
      [
        {
          opacity: 0.9,
          filter: "brightness(1.7) grayscale(.4)",
          transform: "translateY(0) scale(1)",
        },
        {
          opacity: 0.35,
          filter: "brightness(.55) grayscale(1)",
          transform: "translateY(12px) scale(.96)",
          offset: 0.4,
        },
        {
          opacity: 0,
          filter: "brightness(.2) blur(4px)",
          transform: "translateY(-24px) scale(.88)",
        },
      ],
      { duration: 650, easing: "ease-out", fill: "forwards" },
    );
    animations.add(a);
    schedule(() => {
      el.remove();
      nodes.delete(el);
      animations.delete(a);
    }, 660);
  }
  function lunge(from, to, dies = false) {
    if (!from?.el || quality.reduced) return;
    const el = from.el.cloneNode(true);
    el.removeAttribute("id");
    el.classList.add("death-ghost");
    el.style.left = from.left + "px";
    el.style.top = from.top + "px";
    el.style.width = from.w + "px";
    el.style.height = from.h + "px";
    el.style.margin = "0";
    el.style.visibility = "visible";
    el.tabIndex = -1;
    el.setAttribute("aria-hidden", "true");
    app.appendChild(el);
    nodes.add(el);
    from.el.style.visibility = "hidden";
    const dx = (to.x - from.x) * 0.77,
      dy = (to.y - from.y) * 0.77;
    const a = el.animate(
      [
        { transform: "translate(0,0) scale(1)", offset: 0 },
        {
          transform: `translate(${-dx * 0.08}px,${-dy * 0.08}px) scale(1.06)`,
          offset: 0.24,
        },
        { transform: `translate(${dx}px,${dy}px) scale(1.08)`, offset: 0.5 },
        {
          transform: `translate(${dx * 0.92}px,${dy * 0.92}px) scale(1.04)`,
          offset: 0.57,
        },
        {
          transform: dies
            ? `translate(${dx}px,${dy + 10}px) scale(.85)`
            : "translate(0,0) scale(1)",
          opacity: dies ? 0 : 1,
          offset: 1,
        },
      ],
      { duration: 710, easing: "cubic-bezier(.2,.65,.15,1)", fill: "forwards" },
    );
    animations.add(a);
    schedule(() => {
      el.remove();
      nodes.delete(el);
      animations.delete(a);
      const current = unit(from.el.dataset.side, from.el.dataset.uid);
      if (current) current.style.visibility = "";
    }, 715);
  }
  function reveal(c, side, cardHTML) {
    if (!c || !cardHTML || quality.reduced) return;
    const el = document.createElement("div");
    el.className = "cast-card";
    el.style.left = (EmberViewport.mobile ? W - 146 : 1381) + "px";
    el.style.top =
      (EmberViewport.mobile ? EmberViewport.layout.header + 8 : 182) + "px";
    el.innerHTML =
      cardHTML(c) +
      '<div class="cast-caption">' +
      (side === "e" ? "ENEMY CAST · 敌方出牌" : "JUST PLAYED · 打出的卡牌") +
      "</div>";
    app.appendChild(el);
    nodes.add(el);
    el.animate(
      [
        { opacity: 0, transform: "translateX(24px) rotateY(30deg) scale(.9)" },
        {
          opacity: 1,
          transform: "translateX(0) rotateY(0) scale(1)",
          offset: 0.18,
        },
        { opacity: 1, transform: "translateX(0) scale(1)", offset: 0.78 },
        { opacity: 0, transform: "translateY(-8px) scale(.97)" },
      ],
      { duration: 1650, easing: "ease-out", fill: "forwards" },
    );
    schedule(() => {
      el.remove();
      nodes.delete(el);
    }, 1660);
  }
  function phaseChange(s) {
    const boss = EmberData.bosses[s.bossIndex],
      school = paletteSchool(boss.palette),
      el = document.getElementById("cinematic");
    el.innerHTML = `<div class="cinematic-inner" style="--theme:${colors[school][1]}"><div class="cinematic-kicker">PHASE II · ${boss.en}</div><div class="cinematic-title">${boss.name} · 觉醒</div><div class="cinematic-quote">「${boss.quote}」</div></div>`;
    el.classList.add("visible");
    if (!quality.reduced)
      el.animate(
        [
          { opacity: 0, transform: "scale(1.035)" },
          { opacity: 1, transform: "scale(1)", offset: 0.2 },
          { opacity: 1, offset: 0.73 },
          { opacity: 0 },
        ],
        { duration: 1750, fill: "forwards" },
      );
    const ep = fallback(s, "e", "hero"),
      lane = EmberViewport.lane("e");
    vignette(school, 1550, ep.x, ep.y);
    rune(lane.x, lane.y, school, 250, 1700);
    ring(lane.x, lane.y, school, 420, 1600, 0.8);
    spark(ep.x, ep.y, school, 95, {
      speed: 250,
      up: -90,
      gravity: 0,
      life: 2000,
      size: 4,
    });
    EmberAudio.fx("phase");
    schedule(() => {
      el.classList.remove("visible");
      el.innerHTML = "";
    }, 1770);
  }
  function paletteSchool(p) {
    return (
      {
        ember: "fire",
        ice: "frost",
        arcane: "arcane",
        nature: "nature",
        gold: "holy",
        void: "shadow",
        blood: "blood",
        steel: "steel",
      }[p] || "arcane"
    );
  }
  function classification(c, attack = false) {
    if (!c) return attack ? "steel" : "fire";
    if (attack) {
      if (
        ["knight", "golem", "archer", "rogue", "wolf", "reaper"].includes(c.art)
      )
        return "steel";
      if (c.art === "dragon" || c.art === "phoenix") return "fire";
      if (c.art === "spider" || c.art === "treant") return "nature";
    }
    return paletteSchool(c.palette);
  }
  function hitReaction(el, heavy = false) {
    if (!el || quality.reduced) return;
    const a = el.animate(
      [
        { filter: "brightness(1.85)", transform: "translate(0,0)" },
        {
          filter: "brightness(1.15)",
          transform: `translate(${heavy ? 6 : 3}px,${heavy ? 5 : 2}px)`,
          offset: 0.28,
        },
        { filter: "brightness(1)", transform: "translate(0,0)" },
      ],
      { duration: 320, easing: "ease-out" },
    );
    animations.add(a);
    a.onfinish = () => animations.delete(a);
  }
  function cleanupVisuals() {
    timers.forEach(clearTimeout);
    timers.clear();
    animations.forEach((a) => a.cancel());
    animations.clear();
    nodes.forEach((el) => el.remove());
    nodes.clear();
    items = [];
    ctx.clearRect(0, 0, W, H);
    document.getElementById("cinematic").classList.remove("visible");
    document
      .querySelectorAll(".hero,.minion")
      .forEach((el) => (el.style.visibility = ""));
    setBusy(false);
  }
  function cancel(commit = false) {
    generation++;
    if (commit && pendingCommit) {
      const fn = pendingCommit;
      pendingCommit = null;
      fn();
    }
    pendingCommit = null;
    doneCallback = null;
    cleanupVisuals();
  }
  function present(events, s, render, after, cardHTML) {
    if (busy) cancel(true);
    const old = capture(),
      primary = events.find((e) =>
        ["play", "attack", "power"].includes(e.type),
      );
    const hasPhase = events.some((e) => e.type === "phase");
    if (!primary && !hasPhase) {
      render();
      settleLayout(old);
      postEvents(events, s, old, null, null);
      after?.();
      return;
    }
    counts.actions++;
    let c = primary?.cid ? EmberData.byId[primary.cid] : null;
    if (primary?.type === "attack")
      c = EmberData.byId[old[primary.from.side + primary.from.uid]?.cid];
    let school = classification(c, primary?.type === "attack");
    if (primary?.type === "power") {
      const side = primary.side;
      if (side === "e")
        school = paletteSchool(EmberData.bosses[s.bossIndex].palette);
      else
        school = { mage: "fire", paladin: "holy", ranger: "steel" }[s.heroId];
    }
    counts.school[school] = (counts.school[school] || 0) + 1;
    const source =
      primary?.type === "attack"
        ? old[primary.from.side + primary.from.uid]
        : primary
          ? old[primary.side + "hero"]
          : null;
    const target = primary?.to || primary?.target;
    const from = source || fallback(s, primary?.side || "p", "hero");
    const to = target
      ? old[target.side + target.uid] || fallback(s, target.side, target.uid)
      : events.some((e) => e.type === "summon")
        ? EmberViewport.lane(primary?.side || "p")
        : EmberViewport.lane(primary?.side === "e" ? "p" : "e");
    const timing = quality.reduced
      ? 90
      : primary?.type === "attack"
        ? 350
        : 610;
    setBusy(true);
    pendingCommit = render;
    doneCallback = after;
    if (primary?.type === "attack") {
      const dies = events.some(
        (e) =>
          e.type === "death" &&
          e.side === primary.from.side &&
          e.uid === primary.from.uid,
      );
      lunge(source, to, dies);
      if (!quality.reduced) {
        add("windup", { x: from.x, y: from.y, school, radius: 44 }, 290);
        schedule(() => EmberAudio.fx("swing"), 110);
      }
    } else if (primary) {
      if (c) reveal(c, primary.side, cardHTML);
      if (c?.type === "minion") {
        const se = events.find((e) => e.type === "summon" && e.cid === c.id),
          p = se ? fallback(s, se.side, se.uid) : to;
        rune(p.x, p.y, school, 70, 850);
        glow(p.x, p.y, school, 95, 750);
        add("pillar", { ...p, school, radius: 50 }, 720);
      } else if (c?.type === "weapon") {
        rune(from.x, from.y, "holy", 65, 760);
        add(
          "slash",
          { x: from.x, y: from.y, school: "steel", a: -0.6, radius: 100 },
          600,
        );
        EmberAudio.fx("equip");
      } else if (
        c &&
        ["aoe", "nova", "rally", "wolves", "inferno"].includes(c.effect)
      ) {
        add(
          "wave",
          {
            from: {
              x: EmberViewport.mobile ? EmberViewport.layout.arena.x : 250,
              y: to.y,
            },
            to: {
              x: EmberViewport.mobile
                ? EmberViewport.layout.arena.x + EmberViewport.layout.arena.w
                : 1350,
              y: to.y,
            },
            school,
          },
          650,
        );
        rune(to.x, to.y, school, 165, 860);
        schedule(() => EmberAudio.fx("cast-" + school), 120);
      } else if (
        c &&
        ["draw", "discover", "secret", "coin"].includes(c.effect)
      ) {
        rune(from.x, from.y, school, 78, 850);
        add("starburst", { x: from.x, y: from.y, school, radius: 80 }, 650);
        EmberAudio.fx("cast-" + school);
      } else {
        glow(from.x, from.y, school, 75, 350);
        schedule(
          () => {
            projectile(from, to, school, 430);
            EmberAudio.fx("cast-" + school);
          },
          quality.reduced ? 0 : 170,
        );
      }
    }
    schedule(() => {
      if (pendingCommit) {
        const fn = pendingCommit;
        pendingCommit = null;
        fn();
        settleLayout(old);
      }
      if (primary?.type === "attack" && source) {
        const current = unit(primary.from.side, primary.from.uid);
        if (current && !quality.reduced) {
          current.style.visibility = "hidden";
          schedule(() => {
            current.style.visibility = "";
          }, 365);
        }
      }
      const damage = events.filter((e) => e.type === "damage"),
        max = Math.max(1, ...damage.map((e) => e.amount));
      if (
        primary?.type === "attack" ||
        (primary &&
          target &&
          !(
            c &&
            ["heal", "buff", "shield", "silence", "tempBuff"].includes(c.effect)
          ))
      ) {
        impact(to.x, to.y, school, Math.min(2, 0.7 + max / 8));
        EmberAudio.fx("impact-" + school);
        if (max >= 6) vignette(school, 630, to.x, to.y);
      }
      if (
        c &&
        ["buff", "rally", "shield", "tempBuff", "silence"].includes(c.effect)
      ) {
        impact(to.x, to.y, school, 0.8);
        EmberAudio.fx("cast-" + school);
      }
      postEvents(events, s, old, primary, school);
      if (hasPhase) schedule(() => phaseChange(s), quality.reduced ? 90 : 300);
    }, timing);
    schedule(
      () => {
        setBusy(false);
        const cb = doneCallback;
        doneCallback = null;
        cb?.();
      },
      timing +
        (hasPhase
          ? quality.reduced
            ? 800
            : 2050
          : quality.reduced
            ? 140
            : 540),
    );
  }
  function postEvents(events, s, old, primary, school) {
    const at = (e) =>
      pos(unit(e.side, e.uid)) ||
      old[e.side + e.uid] ||
      fallback(s, e.side, e.uid);
    events.forEach((e, i) => {
      if (e.type === "damage") {
        const p = old[e.side + e.uid] || at(e);
        number(p, e.amount);
        hitReaction(unit(e.side, e.uid), e.amount >= 6);
        if (primary?.target?.uid !== e.uid && primary?.to?.uid !== e.uid)
          impact(p.x, p.y, school || "shadow", 0.7 + e.amount / 15);
        if (!primary) EmberAudio.fx("damage");
      }
      if (e.type === "heal") {
        heal(at(e), e.amount);
        EmberAudio.fx("heal");
        if (school === "blood" && !quality.reduced) {
          const opponent =
            old[(e.side === "p" ? "e" : "p") + "hero"] ||
            fallback(s, e.side === "p" ? "e" : "p", "hero");
          projectile(opponent, at(e), "blood", 600);
        }
      }
      if (e.type === "shield") {
        shieldBreak(old[e.side + e.uid] || at(e));
        EmberAudio.fx("shield");
      }
      if (e.type === "summon") {
        const p = at(e),
          cl = classification(EmberData.byId[e.cid]);
        rune(p.x, p.y, cl, 72, 850);
        spark(p.x, p.y + 42, cl, 24, {
          up: 95,
          gravity: 0,
          speed: 75,
          life: 950,
          shape: cl === "frost" ? "shard" : "spark",
        });
        const el = unit(e.side, e.uid);
        if (el && !quality.reduced) el.classList.add("summon-reveal");
        EmberAudio.fx("summon");
      }
      if (e.type === "death")
        death(old[e.side + e.uid], classification(EmberData.byId[e.cid]));
      if (e.type === "draw" && e.side === "p" && !quality.reduced) {
        const hand = [...document.querySelectorAll(".hand-card")],
          end = pos(hand[hand.length - 1]) || { x: 1190, y: 800 };
        add(
          "draw",
          {
            from: EmberViewport.mobile
              ? { x: W - 25, y: EmberViewport.layout.hand.y - 18 }
              : { x: 1137, y: 723 },
            to: end,
            school: "holy",
          },
          700,
        );
      }
      if (e.type === "burn") {
        spark(
          e.side === "p" ? 1200 : 1160,
          e.side === "p" ? 750 : 170,
          "fire",
          24,
          { up: 100, gravity: 0 },
        );
      }
    });
  }
  function preview(school, from, to) {
    if (busy) return false;
    counts.previews++;
    counts.school[school] = (counts.school[school] || 0) + 1;
    setBusy(true);
    rune(from.x, from.y, school, 48, 750);
    schedule(
      () => {
        projectile(from, to, school, 500);
        EmberAudio.fx("cast-" + school);
      },
      quality.reduced ? 0 : 140,
    );
    schedule(
      () => {
        impact(to.x, to.y, school, 1.4);
        number(
          to,
          school === "holy" ? 4 : 6,
          school === "nature" ? "heal" : "damage",
        );
        EmberAudio.fx("impact-" + school);
        vignette(school, 650, to.x, to.y);
        hitReaction(document.querySelector(".lab-token.target"), true);
      },
      quality.reduced ? 100 : 645,
    );
    schedule(() => setBusy(false), quality.reduced ? 400 : 1350);
    return true;
  }
  // ---- Vector compositing primitives --------------------------------------------------
  function radial(g, x, y, r, alpha = 1) {
    const p = ctx.createRadialGradient(x, y, 0, x, y, Math.max(0.1, r));
    p.addColorStop(0, colors[g][0]);
    p.addColorStop(0.12, colors[g][1] + "df");
    p.addColorStop(0.45, colors[g][2] + "50");
    p.addColorStop(1, colors[g][2] + "00");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function line(points, color, width = 1, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  function poly(n, r, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      let a = (i / n) * TAU + rot;
      i
        ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  function bezier(e, t) {
    const bx = (e.from.x + e.to.x) / 2,
      by = (e.from.y + e.to.y) / 2 + (e.bend || 0);
    return {
      x: (1 - t) * (1 - t) * e.from.x + 2 * t * (1 - t) * bx + t * t * e.to.x,
      y: (1 - t) * (1 - t) * e.from.y + 2 * t * (1 - t) * by + t * t * e.to.y,
    };
  }
  function drawItem(e, t) {
    const k = clamp(t),
      a = 1 - k,
      sec = (k * e.d) / 1000,
      cc = colors[e.school] || colors.fire;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    switch (e.kind) {
      case "particle": {
        let x = e.x + e.vx * sec,
          y = e.y + e.vy * sec + (e.gravity * sec * sec) / 2,
          s = e.size * Math.pow(a, 0.35);
        ctx.translate(x, y);
        ctx.rotate(e.rot + e.spin * sec);
        ctx.globalAlpha = Math.sin((Math.min(1, k * 6) * Math.PI) / 2) * a;
        ctx.fillStyle = e.color;
        if (e.shape === "leaf") {
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(s * 1.3, -s * 0.2, 0, s * 2);
          ctx.quadraticCurveTo(-s, s * 0.2, 0, -s);
          ctx.fill();
          ctx.globalAlpha *= 0.4;
          ctx.strokeStyle = cc[0];
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(0, s * 2);
          ctx.stroke();
        } else if (["shard", "diamond", "glass"].includes(e.shape)) {
          ctx.beginPath();
          ctx.moveTo(0, -s * 2);
          ctx.lineTo(s * 0.6, 0);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.7, 0);
          ctx.closePath();
          ctx.fill();
        } else if (e.shape === "cross") {
          ctx.fillRect(-s, -s * 0.19, s * 2, s * 0.38);
          ctx.fillRect(-s * 0.19, -s, s * 0.38, s * 2);
        } else if (e.shape === "smoke") {
          radial(e.school, 0, 0, s * 4, a * 0.32);
        } else if (e.shape === "ash") {
          ctx.globalCompositeOperation = "source-over";
          ctx.fillRect(-s / 2, -s / 2, s, s);
        } else {
          ctx.fillRect(-s / 2, -s * 0.6, s, s * 1.2);
          ctx.globalAlpha *= 0.35;
          ctx.fillRect(-s / 3, -s * 4, s * 0.7, s * 4);
        }
        break;
      }
      case "glow":
        radial(
          e.school,
          e.x,
          e.y,
          e.radius * (0.4 + ease(k) * 0.6),
          Math.sin(k * Math.PI) * 0.7,
        );
        break;
      case "ring": {
        const r = e.radius * ease(k);
        ctx.translate(e.x, e.y);
        ctx.scale(1, e.ry || 1);
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 2.3 * a + 0.3;
        ctx.globalAlpha = a * 0.75;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, r), 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = a * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, r * 0.85), 0, TAU);
        ctx.stroke();
        break;
      }
      case "rune": {
        ctx.translate(e.x, e.y);
        ctx.scale(1, 0.67);
        ctx.rotate(e.rot + k * (e.reverse ? -1 : 1) * 0.7);
        let r = e.radius * (e.reverse ? 1 - 0.65 * k : 0.55 + 0.45 * ease(k));
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.65;
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 1.4;
        for (let s of [1, 0.87, 0.7]) {
          ctx.beginPath();
          ctx.arc(0, 0, r * s, 0, TAU);
          ctx.stroke();
        }
        poly(e.school === "frost" ? 6 : 3, r * 0.86, k * 0.4);
        ctx.stroke();
        poly(3, r * 0.86, Math.PI - k * 0.4);
        ctx.stroke();
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 20; i++) {
          ctx.save();
          ctx.rotate((i * TAU) / 20);
          ctx.beginPath();
          ctx.moveTo(r * 0.9, -2);
          ctx.lineTo(r * 0.95, 2);
          ctx.lineTo(r * 0.98, -2);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "projectile": {
        const p = bezier(e, k),
          segments = 22;
        for (let i = segments; i > 0; i--) {
          let q = clamp(k - i * 0.009),
            q2 = clamp(k - (i - 1) * 0.009),
            p1 = bezier(e, q),
            p2 = bezier(e, q2);
          line(
            [p1, p2],
            cc[1],
            Math.max(0.5, (1 - i / segments) * e.radius * 1.1),
            (1 - i / segments) * 0.42,
          );
        }
        if (e.school === "nature") {
          ctx.strokeStyle = cc[1];
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.75;
          ctx.beginPath();
          for (let j = 0; j < 30; j++) {
            const t = (k * j) / 29,
              pp = bezier(e, t);
            j
              ? ctx.lineTo(
                  pp.x + Math.sin(t * 24) * 9,
                  pp.y + Math.cos(t * 24) * 9,
                )
              : ctx.moveTo(pp.x, pp.y);
          }
          ctx.stroke();
        }
        radial(e.school, p.x, p.y, e.radius * 3.1, 0.87);
        ctx.globalAlpha = 1;
        ctx.fillStyle = cc[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, e.radius * 0.35, 0, TAU);
        ctx.fill();
        if (e.school === "frost") {
          ctx.translate(p.x, p.y);
          const delta = bezier(e, Math.min(1, k + 0.005)),
            prev = bezier(e, Math.max(0, k - 0.005));
          ctx.rotate(Math.atan2(delta.y - prev.y, delta.x - prev.x));
          if (EmberViewport.mobile)
            ctx.scale(EmberViewport.effectScale, EmberViewport.effectScale);
          ctx.fillStyle = cc[0];
          ctx.beginPath();
          ctx.moveTo(27, 0);
          ctx.lineTo(-12, 6);
          ctx.lineTo(-20, 0);
          ctx.lineTo(-12, -6);
          ctx.fill();
        }
        if (e.school === "arcane" || e.school === "shadow") {
          for (let j = 0; j < 3; j++) {
            const ang = k * 18 + (j * TAU) / 3;
            radial(
              e.school,
              p.x + Math.cos(ang) * 17,
              p.y + Math.sin(ang) * 17,
              13,
              0.75,
            );
          }
        }
        break;
      }
      case "lightning": {
        if (k < 0.2 || k > 0.88) break;
        let list = [e.from];
        for (let i = 1; i < 12; i++) {
          const p = bezier(e, i / 12);
          list.push({
            x: p.x + Math.sin(i * 29 + Math.floor(k * 16) + e.seed) * 14,
            y: p.y + Math.cos(i * 12 + Math.floor(k * 16)) * 12,
          });
        }
        list.push(e.to);
        line(list, cc[2], 3, 0.16);
        line(list, cc[0], 0.8, 0.33);
        break;
      }
      case "slash": {
        ctx.translate(e.x, e.y);
        ctx.rotate(e.a);
        let r = e.radius;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 16 * Math.sin(k * Math.PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.5, 0, -2.6, -2.6 + 3.6 * ease(k));
        ctx.stroke();
        ctx.strokeStyle = cc[0];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(2, -1, r + 3, r * 0.53, 0, -2.6, -2.6 + 3.6 * ease(k));
        ctx.stroke();
        break;
      }
      case "windup": {
        ctx.translate(e.x, e.y);
        ctx.scale(1, 0.7);
        ctx.rotate(-k * 2);
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.6;
        ctx.lineWidth = 1;
        ctx.strokeStyle = cc[1];
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * (1 - k * 0.2), 0.4, 5.4);
        ctx.stroke();
        break;
      }
      case "explosion": {
        radial(
          e.school,
          e.x,
          e.y,
          e.radius * (0.35 + 0.9 * ease(k)),
          Math.pow(a, 1.6) * 0.85,
        );
        ctx.translate(e.x, e.y);
        ctx.globalAlpha = a * 0.65;
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 4 * a;
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          let an = (i / 60) * TAU,
            r = e.radius * ease(k) * (1 + Math.sin(an * 7 + k * 6) * 0.055);
          i
            ? ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r * 0.7)
            : ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r * 0.7);
        }
        ctx.stroke();
        break;
      }
      case "smoke": {
        ctx.globalCompositeOperation = "source-over";
        const x = e.x + e.vx * sec,
          y = e.y + e.vy * sec,
          r = e.radius * (1 + ease(k) * 1.4),
          g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "#25242866");
        g.addColorStop(0.6, "#4a3c3030");
        g.addColorStop(1, "#282a2900");
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        break;
      }
      case "scorch": {
        ctx.globalCompositeOperation = "source-over";
        ctx.translate(e.x, e.y);
        ctx.scale(1, 0.57);
        ctx.globalAlpha =
          Math.sin((Math.min(k * 6, 1) * Math.PI) / 2) * (1 - k) * 0.65;
        let g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.radius);
        g.addColorStop(0, "#151315bc");
        g.addColorStop(0.65, "#281d1744");
        g.addColorStop(1, "#30252200");
        ctx.fillStyle = g;
        ctx.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
        break;
      }
      case "ice": {
        ctx.translate(e.x, e.y);
        ctx.rotate(e.a);
        let r = e.radius * ease(k);
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
        ctx.fillStyle = cc[1] + "60";
        ctx.strokeStyle = cc[0] + "b0";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(19, -e.wide / 2);
        ctx.lineTo(r, -e.wide * 0.2);
        ctx.lineTo(r + 12, 0);
        ctx.lineTo(r - 10, e.wide / 2);
        ctx.lineTo(20, e.wide / 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(r + 10, 0);
        ctx.stroke();
        break;
      }
      case "mist": {
        radial(
          e.school,
          e.x,
          e.y,
          e.radius * (0.65 + 0.5 * k),
          Math.sin(k * Math.PI) * 0.21,
        );
        break;
      }
      case "starburst": {
        ctx.translate(e.x, e.y);
        ctx.rotate(k * 0.6);
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = cc[0];
        for (let i = 0; i < 8; i++) {
          ctx.rotate(TAU / 8);
          ctx.lineWidth = i % 2 ? 0.7 : 1.2;
          ctx.beginPath();
          ctx.moveTo(e.radius * ease(k) * 0.25, 0);
          ctx.lineTo(e.radius * ease(k), 0);
          ctx.stroke();
        }
        break;
      }
      case "pillar": {
        let width = e.radius * (0.2 + 0.8 * Math.sin(k * Math.PI)),
          height = 220 * ease(k);
        const g = ctx.createLinearGradient(e.x - width, e.y, e.x + width, e.y);
        g.addColorStop(0, cc[2] + "00");
        g.addColorStop(0.4, cc[1] + "66");
        g.addColorStop(0.5, cc[0] + "bb");
        g.addColorStop(0.6, cc[1] + "66");
        g.addColorStop(1, cc[2] + "00");
        ctx.fillStyle = g;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.65;
        ctx.fillRect(e.x - width, e.y - height, width * 2, height + 15);
        radial(e.school, e.x, e.y, width * 1.8, Math.sin(k * Math.PI) * 0.6);
        break;
      }
      case "vortex": {
        ctx.translate(e.x, e.y);
        let r = e.radius * (0.2 + 0.8 * Math.sin(k * Math.PI));
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.75;
        let g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, "#080815");
        g.addColorStop(0.4, "#181129d0");
        g.addColorStop(0.8, cc[2] + "50");
        g.addColorStop(1, cc[2] + "00");
        ctx.fillStyle = g;
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.globalCompositeOperation = "lighter";
        ctx.rotate(k * 4);
        ctx.strokeStyle = cc[1];
        for (let i = 0; i < 5; i++) {
          ctx.rotate(TAU / 5);
          ctx.globalAlpha = a * 0.6;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, r * (0.4 + i * 0.13), 0.1, 2.6);
          ctx.stroke();
        }
        break;
      }
      case "bloom": {
        ctx.translate(e.x, e.y);
        ctx.rotate(k * 0.7);
        ctx.strokeStyle = cc[1];
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.6;
        ctx.lineWidth = 1.5;
        const r = e.radius * ease(k);
        for (let i = 0; i < 7; i++) {
          ctx.rotate(TAU / 7);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.bezierCurveTo(r * 0.85, -r * 0.6, r, -r * 0.2, r, 0);
          ctx.bezierCurveTo(r, r * 0.2, r * 0.8, r * 0.6, 0, 0);
          ctx.stroke();
        }
        break;
      }
      case "heal": {
        ctx.translate(e.x, e.y);
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 1.8;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          for (let i = 0; i < 35; i++) {
            let t = i / 34,
              yy = 45 - t * 135 * k,
              xx =
                Math.sin(t * 9 + k * 7 + (j * TAU) / 3) *
                e.radius *
                (1 - t * 0.2);
            i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
          }
          ctx.stroke();
        }
        break;
      }
      case "wave": {
        let x = lerp(e.from.x, e.to.x, ease(k));
        radial(e.school, x, e.from.y, 125, 0.48 * Math.sin(k * Math.PI));
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.7;
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, e.from.y, 27, 110, 0, Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();
        break;
      }
      case "draw": {
        const p = bezier({ ...e, bend: -90 }, ease(k));
        ctx.translate(p.x, p.y);
        ctx.rotate((1 - k) * -0.5);
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.5;
        ctx.fillStyle = "#d4bd8c22";
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = 1;
        ctx.fillRect(-20, -28, 40, 56);
        ctx.strokeRect(-20, -28, 40, 56);
        break;
      }
    }
    ctx.restore();
  }
  // Original pre-rendered tavern diorama + lightweight real-time atmosphere.
  // This layer is always available, independently of the optional WebGL renderer.
  function paintWorld(t) {
    wc.clearRect(0, 0, W, H);
    if (EmberViewport.mobile)
      EmberMobileWorld.paint(
        wc,
        t,
        view,
        theme,
        phase,
        quality.reduced,
        quality.low,
      );
    else
      TavernWorld.paint(
        wc,
        t,
        view,
        theme,
        phase,
        quality.reduced,
        quality.low,
      );
    worldDirty = false;
  }
  let worldLast = 0;
  function resizeCanvas() {
    W = EmberViewport.width;
    H = EmberViewport.height;
    const d = EmberViewport.mobile
      ? Math.min(devicePixelRatio || 1, quality.low ? 1 : 2)
      : 1;
    for (const [el, c] of [
      [canvas, ctx],
      [world, wc],
    ]) {
      el.width = Math.round(W * d);
      el.height = Math.round(H * d);
      c.setTransform(d, 0, 0, d, 0, 0);
    }
    worldDirty = true;
  }
  function reflow() {
    const commit = pendingCommit,
      after = doneCallback;
    pendingCommit = null;
    doneCallback = null;
    cancel();
    resizeCanvas();
    commit?.();
    after?.();
  }
  function tick(t) {
    frame = requestAnimationFrame(tick);
    if (document.hidden) return;
    const min = quality.low ? 40 : EmberViewport.mobile ? 16 : 30;
    if (t - last < min) return;
    last = t;
    now = t;
    if (
      worldDirty ||
      AtelierWorld.loading ||
      (EmberViewport.mobile && EmberMobileWorld.loading) ||
      (!quality.reduced && t - worldLast > (EmberViewport.mobile ? 80 : min))
    ) {
      paintWorld(quality.reduced ? 0 : t / 1000);
      worldLast = t;
    }
    ctx.clearRect(0, 0, W, H);
    let keep = [];
    for (const e of items) {
      let progress = (t - e.start) / e.d;
      if (progress < 0) {
        keep.push(e);
        continue;
      }
      if (progress >= 1) continue;
      drawItem(e, progress);
      keep.push(e);
    }
    items = keep;
  }
  function setView(v) {
    view = v;
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
    worldDirty = true;
    // Turning accessibility on is immediate, even during an effect's tail.
    // Keep the rule-commit timers and busy lifecycle; only remove decoration.
    if (quality.reduced) {
      items.length = 0;
      for (const a of animations) a.cancel();
      animations.clear();
      for (const el of [...nodes])
        if (el.matches(".death-ghost,.cast-card")) {
          el.remove();
          nodes.delete(el);
        }
      document.querySelectorAll(".minion[data-uid],.hero").forEach((el) => {
        el.style.visibility = "";
        el.classList.remove("summon-reveal");
      });
      for (const el of [
        world,
        document.getElementById("scene"),
        document.getElementById("fx-vignette"),
      ])
        el?.getAnimations().forEach((a) => a.cancel());
    }
  }
  function setLab(v) {
    lab = !!v;
    app.classList.toggle("lab-open", lab);
    if (!v) cancel();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) worldDirty = true;
  });
  resizeCanvas();
  frame = requestAnimationFrame(tick);
  return {
    reflow,
    present,
    preview,
    cancel,
    setView,
    setTheme,
    configure,
    setLab,
    pos,
    capture,
    impact,
    projectile,
    number,
    rune,
    paletteSchool,
    classification,
    schoolNames,
    colors,
    counts,
    get busy() {
      return busy;
    },
    get particles() {
      return items.length;
    },
    get pendingTimers() {
      return timers.size;
    },
  };
})();
