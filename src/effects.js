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
    view = "lobby",
    theme = 0,
    phase = false,
    quality = { reduced: false, low: false },
    worldDirty = true,
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
  function animate(el, frames, options) {
    const animation = el.animate(frames, options);
    animations.add(animation);
    animation.onfinish = () => {
      animation.cancel();
      animations.delete(animation);
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
  // Event cues are decorative; they never delay dispatch or own rule state.
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
    const el = transient(
      "turn-cue " + (side === "p" ? "ours" : "theirs"),
      1250,
    );
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
        { duration: 1250, easing: "ease-out" },
      );
  }
  function arrival(p, card) {
    if (quality.reduced) return;
    const school = classification(card),
      legendary = card?.rarity === "legendary";
    add(
      "portal",
      {
        x: p.x,
        y: p.y + p.h * 0.3,
        school,
        radius: legendary ? 125 : 70,
        legendary,
      },
      legendary ? 1250 : 700,
    );
    if (legendary) {
      spark(p.x, p.y, school, 56, {
        up: 100,
        speed: 130,
        gravity: -30,
        life: 1200,
      });
      const seal = transient("summon-seal", 1250);
      seal.textContent = "✦ 传说降临 ✦";
      seal.style.left = p.x + "px";
      seal.style.top = p.y - p.h / 2 - 20 + "px";
      animate(
        seal,
        [
          { opacity: 0, translate: "0 8px" },
          { opacity: 1, translate: "0 0", offset: 0.2 },
          { opacity: 1, offset: 0.7 },
          { opacity: 0, translate: "0 -12px" },
        ],
        { duration: 1250 },
      );
      shake(3);
    }
  }
  function setBusy(v) {
    busy = v;
    app.classList.toggle("fx-busy", v);
    document.dispatchEvent(new CustomEvent("ember:fx-busy", { detail: v }));
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
        animate(el, frames, {
          duration: 420,
          easing: "cubic-bezier(.18,.72,.24,1)",
        });
      });
  }
  function add(kind, data, d = 800, delay = 0) {
    if (quality.reduced) return;
    if (EmberViewport.mobile) {
      data = { ...data };
      for (const k of ["radius", "size", "wide", "vx", "vy", "gravity"])
        if (typeof data[k] === "number") data[k] *= EmberViewport.effectScale;
    }
    const budget = quality.low ? 220 : EmberViewport.mobile ? 360 : 800;
    if (items.length >= budget) items.splice(0, items.length - budget + 1);
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
        rnd(Math.min(430, options.life || 1150), options.life || 1150),
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
      animate(
        el,
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${amount}px,${amount * 0.45}px)` },
          { transform: `translate(${-amount * 0.65}px,${-amount * 0.25}px)` },
          { transform: `translate(${amount * 0.3}px,0)` },
          { transform: "translate(0,0)" },
        ],
        { duration: 260, easing: "ease-out" },
      );
    }
  }
  function vignette(school = "fire", d = 600, x = 800, y = 430) {
    if (quality.reduced) return;
    const v = document.getElementById("fx-vignette");
    v.style.setProperty("--vcolor", colors[school][2]);
    v.style.setProperty("--vx", (x / W) * 100 + "%");
    v.style.setProperty("--vy", (y / H) * 100 + "%");
    animate(
      v,
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
    const s = clamp(strength, 0.6, 2.2);
    glow(x, y, school, 80 * s, school === "frost" ? 150 : 510);
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
      ring(x, y, school, 40 * s, 180, 0.75);
      spark(x, y, school, 10, {
        shape: "shard",
        speed: 65,
        gravity: 90,
        life: 280,
        size: 2,
      });
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
  function copyPortraits(source, clone) {
    const originals = source?.querySelectorAll(".portrait-motion") || [];
    clone.querySelectorAll(".portrait-motion").forEach((canvas, i) => {
      const original = originals[i];
      if (original?.width && original?.height) {
        canvas.width = original.width;
        canvas.height = original.height;
        canvas.getContext("2d").drawImage(original, 0, 0);
      } else canvas.parentElement.classList.remove("motion-ready");
    });
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
    copyPortraits(old.el, el);
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
    animate(
      el,
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
    schedule(() => {
      el.remove();
      nodes.delete(el);
    }, 660);
  }
  function lunge(from, to, dies = false) {
    if (!from?.el || quality.reduced) return;
    const el = from.el.cloneNode(true);
    copyPortraits(from.el, el);
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
    animate(
      el,
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
      { duration: 710, easing: "linear", fill: "forwards" },
    );
    schedule(() => {
      el.remove();
      nodes.delete(el);
      const current = unit(from.el.dataset.side, from.el.dataset.uid);
      if (current) current.style.visibility = "";
    }, 715);
    return el;
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
    animate(
      el,
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
      animate(
        el,
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
  function hitReaction(el, heavy = false, from = null) {
    if (!el || quality.reduced) return;
    const p = pos(el),
      dx = from ? p.x - from.x : 0,
      dy = from ? p.y - from.y : -1;
    const length = Math.hypot(dx, dy) || 1,
      amount = heavy ? 8 : 4;
    animate(
      el,
      [
        { filter: "brightness(1.85)", translate: "0 0" },
        {
          filter: "brightness(1.15)",
          translate: `${(dx / length) * amount}px ${(dy / length) * amount}px`,
          offset: 0.28,
        },
        { filter: "brightness(1)", translate: "0 0" },
      ],
      { duration: 320, easing: "ease-out" },
    );
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
  function cue(p, text, kind = "status") {
    if (!p) return;
    const el = transient("combat-cue cue-" + kind, quality.reduced ? 700 : 950);
    el.textContent = text;
    el.style.left = p.x + "px";
    el.style.top = p.y - p.h * 0.35 + "px";
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
  function present(events, s, render, after, cardHTML, before = null) {
    if (busy) cancel(true);
    clearTurnCue();
    const plan = EmberCombat.compile(events, before, s, quality.reduced);
    if (!plan.beats.length || quality.reduced) {
      render();
      postEvents(events, s, capture(), null, null);
      after?.();
      return;
    }
    const primary = events.find((e) =>
      ["play", "attack", "power"].includes(e.type),
    );
    let c = primary?.cid ? EmberData.byId[primary.cid] : null;
    const initial = capture(),
      history = { ...initial };
    if (primary?.type === "attack")
      c = EmberData.byId[initial[primary.from.side + primary.from.uid]?.cid];
    let school = classification(c, primary?.type === "attack");
    if (primary?.type === "power")
      school =
        primary.side === "e"
          ? paletteSchool(EmberData.bosses[s.bossIndex].palette)
          : { mage: "fire", paladin: "holy", ranger: "steel" }[s.heroId];
    counts.actions++;
    counts.school[school] = (counts.school[school] || 0) + 1;
    setBusy(true);
    pendingCommit = () => render();
    doneCallback = after;
    const seenRattles = new Set();
    let attackFlight = null;
    const locate = (map, t, state) =>
      map[t.side + t.uid] || fallback(state, t.side, t.uid);
    for (const beat of plan.beats)
      for (const e of beat.events) {
        if (e.type === "heal" && e.from)
          schedule(
            () => {
              const positions = { ...initial, ...capture() };
              projectile(
                locate(positions, e.from, beat.frame),
                locate(positions, { side: e.side, uid: e.uid }, beat.frame),
                "blood",
                Math.min(300, beat.at),
              );
            },
            Math.max(0, beat.at - 300),
          );
      }
    for (const beat of plan.beats)
      schedule(() => {
        const old = capture(),
          event = beat.events[0];
        Object.assign(history, old);
        render(beat.frame);
        settleLayout(old);
        if (beat.sourceId && !seenRattles.has(beat.sourceId)) {
          seenRattles.add(beat.sourceId);
          const p = Object.values(history).find(
            (p) => p.el?.dataset.uid === beat.sourceId,
          );
          cue(p, "亡语", "deathrattle");
        }
        if (["play", "power"].includes(event.type)) {
          if (c) reveal(c, event.side, cardHTML);
          const from = locate(
            old,
            { side: event.side, uid: "hero" },
            beat.frame,
          );
          const target = event.target;
          const profile = EmberRules.profile(c);
          const summon = events.find((e) => e.type === "summon");
          const firstEffect = events.find(
            (e) =>
              ["damage", "heal", "status", "summon"].includes(e.type) && e.side,
          );
          const to = target
            ? locate(old, target, beat.frame)
            : summon
              ? fallback(s, summon.side, summon.uid)
              : firstEffect
                ? locate(
                    old,
                    { side: firstEffect.side, uid: firstEffect.uid || "hero" },
                    beat.frame,
                  )
                : EmberViewport.lane(
                    profile.self ? event.side : event.side === "p" ? "e" : "p",
                  );
          if (c?.type === "minion") {
            rune(to.x, to.y, school, 70, 760);
            add("pillar", { ...to, school, radius: 50 }, 610);
          } else if (
            c?.type === "weapon" ||
            profile.self ||
            (!target &&
              firstEffect?.uid === "hero" &&
              firstEffect.side === event.side)
          ) {
            rune(from.x, from.y, school, 70, 700);
            EmberAudio.fx(c?.type === "weapon" ? "equip" : "cast-" + school);
          } else if (profile.area) {
            const stop = events.findIndex(
              (e) => e.type === "death" || e.type === "phase",
            );
            const sides = new Set(
              events
                .slice(0, stop < 0 ? events.length : stop)
                .filter(
                  (e) =>
                    ["damage", "status", "summon"].includes(e.type) && e.side,
                )
                .map((e) => e.side),
            );
            if (!sides.size) sides.add(event.side);
            for (const side of sides) {
              const lane = EmberViewport.lane(side);
              add(
                "wave",
                {
                  from: { x: lane.x - W * 0.3, y: lane.y },
                  to: { x: lane.x + W * 0.3, y: lane.y },
                  school,
                },
                beat.hold,
              );
            }
            EmberAudio.fx("cast-" + school);
          } else {
            glow(from.x, from.y, school, 65, 220);
            schedule(() => {
              projectile(from, to, school, Math.max(100, beat.hold - 170));
              EmberAudio.fx("cast-" + school);
            }, 170);
          }
        }
        if (event.type === "attack") {
          const now = capture(),
            from = locate(now, event.from, beat.frame),
            to = locate(now, event.to, beat.frame);
          const dies = events.some(
            (e) =>
              e.type === "death" &&
              e.side === event.from.side &&
              e.uid === event.from.uid,
          );
          const ranged =
            c && ["archer", "mage", "dragon", "phoenix"].includes(c.art);
          if (ranged) {
            rune(from.x, from.y, school, 35, 350);
            projectile(from, to, school, beat.hold);
          } else {
            // render() has replaced the live DOM; its new canvas is not painted
            // until the observer/frame runs. Copy the last painted source now.
            const actor = lunge(
              {
                ...from,
                el: from.el?.querySelector(".portrait-motion")
                  ? from.el
                  : old[event.from.side + event.from.uid]?.el || from.el,
              },
              to,
              dies,
            );
            attackFlight = {
              side: event.from.side,
              uid: event.from.uid,
              until: performance.now() + 715,
              dies,
              impact: {
                ...from,
                el: actor,
                x: from.x + (to.x - from.x) * 0.77,
                y: from.y + (to.y - from.y) * 0.77,
                left: from.left + (to.x - from.x) * 0.77,
                top: from.top + (to.y - from.y) * 0.77,
              },
            };
          }
          EmberAudio.fx("swing");
        }
        if (attackFlight && performance.now() < attackFlight.until) {
          const current = unit(attackFlight.side, attackFlight.uid);
          if (current) {
            current.style.visibility = "hidden";
            schedule(() => {
              current.style.visibility = "";
            }, attackFlight.until - performance.now());
          }
        }
        const positions = { ...history, ...old };
        if (
          attackFlight &&
          (attackFlight.dies || performance.now() < attackFlight.until)
        )
          positions[attackFlight.side + attackFlight.uid] = attackFlight.impact;
        postEvents(beat.events, beat.frame, positions, primary, school);
        if (event.type === "phase") phaseChange(s);
      }, beat.at);
    schedule(() => {
      const commit = pendingCommit,
        cb = doneCallback;
      pendingCommit = doneCallback = null;
      commit?.();
      setBusy(false);
      cb?.();
    }, plan.duration + 80);
  }
  function postEvents(events, s, old, primary, school) {
    const at = (e) =>
      pos(unit(e.side, e.uid)) ||
      old[e.side + e.uid] ||
      fallback(s, e.side, e.uid);
    events.forEach((e) => {
      if (e.type === "turn") turnCue(e.side, s.turn);
      if (e.type === "damage") {
        const p = old[e.side + e.uid] || at(e);
        if (e.absorbed)
          cue({ ...p, y: p.y - 24 }, `护甲吸收 ${e.absorbed}`, "armor");
        if ((e.loss ?? e.amount) > 0) number(p, e.loss ?? e.amount);
        hitReaction(
          p.el?.isConnected && p.el.matches(".death-ghost")
            ? p.el
            : unit(e.side, e.uid),
          e.amount >= 6,
          e.from &&
            (old[e.from.side + e.from.uid] ||
              fallback(s, e.from.side, e.from.uid)),
        );
        impact(p.x, p.y, school || "steel", 0.7 + e.amount / 15);
        if (primary) EmberAudio.fx("impact-" + (school || "steel"));
        if (!primary) EmberAudio.fx("damage");
      }
      if (e.type === "heal") {
        // Health is revealed with this beat, at the end of the incoming flow.
        heal(at(e), e.amount);
        EmberAudio.fx("heal");
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
        if (el && !quality.reduced) {
          arrival(p, EmberData.byId[e.cid]);
          animate(
            el,
            [
              { opacity: 0, translate: "0 -32px", scale: ".65" },
              { opacity: 1, translate: "0 4px", scale: "1.07", offset: 0.65 },
              { opacity: 1, translate: "0 0", scale: "1" },
            ],
            { duration: 520, easing: "cubic-bezier(.16,.8,.24,1)" },
          );
        }
        EmberAudio.fx("summon");
        if (e.rebornFrom) cue(p, "复生 · 1 生命", "reborn");
      }
      if (e.type === "death")
        death(old[e.side + e.uid], classification(EmberData.byId[e.cid]));
      if (e.type === "draw" && e.side === "p" && !quality.reduced) {
        const el = document.querySelector(`#hand [data-hand="${e.uid}"]`),
          end = pos(el);
        if (!end) return;
        el.style.visibility = "hidden";
        schedule(() => {
          el.style.visibility = "";
          if (el.isConnected)
            animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
        }, 220);
        add(
          "draw",
          {
            from: EmberViewport.mobile
              ? { x: W - 25, y: EmberViewport.layout.hand.y - 18 }
              : { x: 1137, y: 723 },
            to: end,
            school: "holy",
          },
          220,
        );
      }
      if (e.type === "burn") {
        const p = fallback(s, e.side, "hero");
        cue(
          p,
          e.side === "p" && e.cid
            ? `${EmberData.byId[e.cid].name} · 手牌已满`
            : "手牌已满 · 焚毁",
          "burn",
        );
        spark(p.x, p.y, "fire", 24, { up: 100, gravity: 0 });
      }
      if (e.type === "secret") {
        const p = fallback(s, e.side, "hero");
        cue(p, "镜像伏击 · 拦截", "secret");
        rune(p.x, p.y, "arcane", 65, 550);
        EmberAudio.fx("cast-arcane");
      }
      if (e.type === "weaponWear")
        cue(at(e), e.broken ? "武器损坏" : "耐久 −1", "weapon");
      if (e.type === "status") {
        const p = at(e),
          el = unit(e.side, e.uid);
        const labels = {
          freeze: "冻结",
          thaw: "解冻",
          silence: "沉默",
          transform: "变形",
          expire: `攻击 ${e.attack}`,
          buff: `+${e.attack}${e.health ? " / +" + e.health : " 攻击"}`,
          grant: EmberData.kw[e.tag],
          armor: `护甲 +${e.amount}`,
          mana: `法力 +${e.amount}`,
        };
        cue(p, labels[e.kind] || e.kind, e.kind);
        const cl = ["freeze", "thaw"].includes(e.kind)
          ? "frost"
          : ["silence", "transform"].includes(e.kind)
            ? "shadow"
            : "holy";
        if (e.kind === "freeze" && !quality.reduced) {
          const shell = transient("freeze-lock", 245);
          shell.style.left = p.left + "px";
          shell.style.top = p.top + "px";
          shell.style.width = p.w + "px";
          shell.style.height = p.h + "px";
          animate(
            shell,
            [
              { opacity: 0, scale: "1.04" },
              { opacity: 0.9, scale: "1", offset: 0.3 },
              { opacity: 0, scale: "1" },
            ],
            { duration: 240, easing: "ease-out" },
          );
        } else if (e.kind === "thaw")
          spark(p.x, p.y, cl, 22, { shape: "shard", speed: 85 });
        else rune(p.x, p.y, cl, p.w * 0.55, 420, e.kind === "silence");
        if (el && !quality.reduced && e.kind !== "freeze") {
          const target =
            e.kind === "buff" || e.kind === "expire"
              ? el.querySelector(".stat.atk")
              : el;
          if (target)
            animate(
              target,
              e.kind === "transform"
                ? [
                    { opacity: 0, filter: "blur(9px)", scale: ".85" },
                    { opacity: 1, filter: "blur(0)", scale: "1" },
                  ]
                : [{ filter: "brightness(1.6)" }, { filter: "brightness(1)" }],
              { duration: 300 },
            );
        }
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
      case "portal": {
        const reveal = Math.sin(Math.PI * k),
          r = e.radius * (0.65 + ease(k) * 0.35);
        ctx.translate(e.x, e.y);
        ctx.scale(1, 0.36);
        ctx.rotate(k * (e.legendary ? 1 : -0.6));
        ctx.globalAlpha = reveal * 0.8;
        ctx.strokeStyle = cc[1];
        ctx.lineWidth = e.legendary ? 3 : 2;
        for (const scale of [1, 0.83]) {
          ctx.beginPath();
          ctx.arc(0, 0, r * scale, 0, TAU);
          ctx.stroke();
        }
        const segments = e.legendary ? 12 : 8;
        for (let i = 0; i < segments; i++) {
          ctx.save();
          ctx.rotate((i * TAU) / segments);
          ctx.fillStyle = cc[0];
          ctx.beginPath();
          ctx.moveTo(r * 0.92, -5);
          ctx.lineTo(r * 1.07, 0);
          ctx.lineTo(r * 0.92, 5);
          ctx.lineTo(r * 0.87, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = reveal * 0.22;
        ctx.fillStyle = cc[2];
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, TAU);
        ctx.fill();
        break;
      }
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
          segments = e.school === "frost" ? 6 : 22;
        if (e.school === "steel") {
          const prev = bezier(e, Math.max(0, k - 0.01));
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.y - prev.y, p.x - prev.x));
          const size = EmberViewport.mobile ? EmberViewport.effectScale : 1;
          ctx.scale(size, size);
          line(
            [
              { x: -28, y: 0 },
              { x: 12, y: 0 },
            ],
            cc[1],
            2,
            0.95,
          );
          ctx.fillStyle = cc[0];
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.moveTo(21, 0);
          ctx.lineTo(8, -5);
          ctx.lineTo(8, 5);
          ctx.closePath();
          ctx.fill();
          line(
            [
              { x: -25, y: -5 },
              { x: -18, y: 0 },
              { x: -25, y: 5 },
            ],
            cc[0],
            2,
            0.85,
          );
          break;
        }
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
  // Desktop and touch share this single Canvas scene.
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
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const min = quality.low ? 40 : 0;
    if (t - last < min) return;
    last = t;
    if (
      worldDirty ||
      AtelierWorld.loading ||
      (!quality.reduced && t - worldLast > 80)
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
    if (typeof EmberPortraits !== "undefined")
      EmberPortraits.configure(reduced, low);
    app.classList.toggle("fx-low", quality.low);
    app.classList.toggle("fx-reduced", quality.reduced);
    worldDirty = true;
    // Turning accessibility on is immediate, even during an effect's tail.
    // Keep the rule-commit timers and busy lifecycle; only remove decoration.
    if (quality.reduced) {
      if (busy && pendingCommit) {
        const cb = doneCallback;
        cancel(true);
        cb?.();
      }
      items.length = 0;
      for (const a of animations) a.cancel();
      animations.clear();
      for (const el of [...nodes])
        if (el.matches(".death-ghost,.cast-card,.summon-seal")) {
          el.remove();
          nodes.delete(el);
        }
      document.querySelectorAll(".minion[data-uid],.hero").forEach((el) => {
        el.style.visibility = "";
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
  requestAnimationFrame(tick);
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
    get activeAnimations() {
      return animations.size;
    },
    get transientNodes() {
      return nodes.size;
    },
    get particles() {
      return items.length;
    },
    get pendingTimers() {
      return timers.size;
    },
  };
})();
