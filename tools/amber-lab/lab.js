/* Amber hand lab: the battle hand as a bandolier of amber, and a specimen tray
 * that explains the visual system. Uses the real card art, relief height maps
 * and card data (cards.json is exported from src/data.js). */
(async () => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const DPR = Math.min(2, devicePixelRatio || 1);
  const cards = Object.fromEntries((await (await fetch("cards.json")).json()).map((c) => [c.id, c]));
  EmberAmber.configure({ studio: "../../art/relief/studio.webp" });
  const urls = (id) => ({ art: `../../assets/anime/${id}.webp`, height: `../../art/relief/${id}-height.webp` });
  const specOf = (id) => EmberAmber.spec(cards[id], urls(id));

  /* ---------- stage fit ---------- */
  const stage = $("#stage");
  let scale = 1;
  function fit() {
    scale = Math.min(innerWidth / 1600, innerHeight / 940);
    stage.style.transform = `scale(${scale})`;
  }
  addEventListener("resize", fit);
  fit();

  /* ---------- piece ---------- */
  const KW = ["战吼", "亡语", "法术伤害", "嘲讽", "圣盾", "突袭", "冲锋", "吸血", "剧毒", "风怒", "潜行", "复生", "冻结", "沉默", "发现", "奥秘"];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const rule = (t) => KW.reduce((s, k) => s.replaceAll(k, `<em>${k}</em>`), esc(t));
  const index = Object.keys(cards);

  function piece(id, w = 156) {
    const c = cards[id],
      s = specOf(id);
    const el = document.createElement("div");
    el.className = "amber";
    el.dataset.id = id;
    el.dataset.type = s.type;
    el.style.setProperty("--w", w + "px");
    el.style.setProperty("--tag-r", ((s.seed - 0.5) * 5).toFixed(2) + "deg");
    const h = Math.round((w * 230) / 156);
    const stat = s.type !== "spell";
    el.innerHTML =
      `<canvas class="body cold"></canvas><canvas class="body warm"></canvas><canvas class="body live"></canvas>` +
      `<div class="cost"><span>${c.cost}</span></div>` +
      `<div class="tag"><b>${esc(c.name)}</b><div class="rule">${rule(c.text)}</div><div class="no">${EmberAmber.BODIES[c.class]?.name || "蜜珀"} · No.${String(index.indexOf(id) + 1).padStart(3, "0")}</div></div>` +
      (stat ? `<div class="stat atk"><span>${c.atk}</span></div><div class="stat hp ${s.type === "weapon" ? "ward" : ""}"><span>${c.hp}</span></div>` : "");
    for (const cv of el.querySelectorAll("canvas.cold,canvas.warm")) {
      cv.width = Math.round(w * DPR);
      cv.height = Math.round(h * DPR);
    }
    const live = el.querySelector("canvas.live");
    live.width = Math.round(w * DPR * 1.45);
    live.height = Math.round(h * DPR * 1.45);
    el.spec = s;
    return el;
  }
  async function bake(el, state = {}) {
    await EmberAmber.paint(el.querySelector("canvas.cold"), el.spec, { ...state, warm: 0 });
    await EmberAmber.paint(el.querySelector("canvas.warm"), el.spec, { ...state, warm: 1 });
  }

  /* ---------- tabs ---------- */
  for (const b of document.querySelectorAll("#tabs button"))
    b.onclick = () => {
      document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === b.dataset.view));
      if (b.dataset.view === "tray") buildTray();
    };

  /* ---------- battle ---------- */
  const hand = [];
  let mana = 6;
  const handEl = $("#hand"),
    strap = $("#strap");
  const drawPool = ["frostbolt", "wisdom", "frostgolem", "oracle", "dragon", "scribe", "frostking", "counterspell", "wisp", "magmacore"];
  const RAIL = 1096,
    W = 156,
    H = 230,
    CX = 800,
    BASE = 740;

  function slot(i, n) {
    const step = n > 1 ? Math.min(W + 16, (RAIL - W) / (n - 1)) : 0;
    const off = i - (n - 1) / 2;
    return { x: CX - W / 2 + off * step, y: BASE + Math.min(off * off * 2.4, 22), step };
  }
  function strapY(x, n) {
    const step = n > 1 ? Math.min(W + 16, (RAIL - W) / (n - 1)) : W;
    const off = (x - CX) / step;
    return BASE + 11.5 + Math.min(off * off * 2.4, 22 + (Math.abs(off) - 3.03) * 5);
  }
  function drawStrap() {
    const n = Math.max(hand.length, 1);
    const pts = [];
    for (let x = 200; x <= 1400; x += 20) pts.push([x, strapY(x, n)]);
    const d = (dy) => "M" + pts.map(([x, y]) => `${x},${(y + dy).toFixed(1)}`).join(" L");
    const rivets = hand
      .map((el) => {
        const cx = parseFloat(el.style.getPropertyValue("--x")) + W / 2;
        return `<circle cx="${cx}" cy="${strapY(cx, n)}" r="6" fill="url(#rivet)"/>`;
      })
      .join("");
    strap.innerHTML = `<defs>
      <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3e1f"/><stop offset=".5" stop-color="#4a2913"/><stop offset="1" stop-color="#2c170a"/></linearGradient>
      <linearGradient id="fade" x1="200" x2="1400" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".1" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <mask id="fadeMask"><rect x="0" y="0" width="1600" height="940" fill="url(#fade)"/></mask>
      <linearGradient id="pulse" x1="0" x2="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff9a3a" stop-opacity="0"/><stop offset=".5" stop-color="#ffcf7a" stop-opacity=".95"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></linearGradient>
      <radialGradient id="rivet" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff2c6"/><stop offset=".45" stop-color="#c9953f"/><stop offset="1" stop-color="#4a2c08"/></radialGradient>
    </defs>
    <g mask="url(#fadeMask)">
      <path d="${d(0)}" fill="none" stroke="#150a03" stroke-width="24" stroke-linecap="round"/>
      <path d="${d(0)}" fill="none" stroke="url(#leather)" stroke-width="20" stroke-linecap="round"/>
      <path d="${d(-1.5)}" fill="none" stroke="rgba(255,210,160,.12)" stroke-width="3"/>
      <path d="${d(-6.5)}" fill="none" stroke="#d9b47a" stroke-opacity=".55" stroke-width="1.1" stroke-dasharray="5 4"/>
      <path d="${d(6.5)}" fill="none" stroke="#d9b47a" stroke-opacity=".45" stroke-width="1.1" stroke-dasharray="5 4"/>
      <path id="pulse-path" d="${d(0)}" fill="none" stroke="url(#pulse)" stroke-width="16" stroke-linecap="round" opacity="0" style="mix-blend-mode:screen"/>
      ${rivets}
    </g>`;
  }

  function layout(animate = true) {
    const n = hand.length;
    hand.forEach((el, i) => {
      const { x, y } = slot(i, n);
      const px = parseFloat(el.style.getPropertyValue("--x"));
      if (animate && !Number.isNaN(px)) swing(el, (x - px) * -0.0035);
      el.style.setProperty("--x", x + "px");
      el.style.setProperty("--y", y + "px");
      el.style.zIndex = String(i + 1);
    });
    drawStrap();
    playable();
  }
  function playable(stagger = false) {
    hand.forEach((el, i) => {
      const on = cards[el.dataset.id].cost <= mana;
      if (stagger && on && !el.classList.contains("playable")) {
        setTimeout(() => el.classList.add("playable"), 120 + i * 110);
      } else el.classList.toggle("playable", on);
    });
  }

  /* pendulum: every stone hangs from its clip and swings when the strap moves */
  const swinging = new Set();
  function swing(el, impulse) {
    el.w = (el.w || 0) + impulse;
    el.a = el.a || 0;
    swinging.add(el);
    if (swinging.size === 1) requestAnimationFrame(tickSwing);
  }
  let lastSwing = 0;
  function tickSwing(now) {
    const dt = Math.min(0.033, (now - (lastSwing || now)) / 1000) || 0.016;
    lastSwing = now;
    for (const el of swinging) {
      el.w += (-38 * el.a - 3.2 * el.w) * dt;
      el.a += el.w * dt;
      el.style.setProperty("--rot", ((el.a * 180) / Math.PI).toFixed(2) + "deg");
      if (Math.abs(el.a) < 0.0006 && Math.abs(el.w) < 0.003) {
        el.style.setProperty("--rot", "0deg");
        swinging.delete(el);
      }
    }
    if (swinging.size) requestAnimationFrame(tickSwing);
    else lastSwing = 0;
  }

  /* holding a stone: it lifts, faces the pointer, and what is inside stirs */
  let held = null,
    heldRaf = 0;
  const tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  function hold(el) {
    if (held === el || el.busy) return;
    release();
    held = el;
    el.classList.add("lifted", "live");
    el.style.transition = "";
    hand.forEach((o) => {
      if (o !== el) swing(o, (parseFloat(o.style.getPropertyValue("--x")) < parseFloat(el.style.getPropertyValue("--x")) ? 1 : -1) * 0.05);
    });
    let prev = performance.now();
    const t0 = prev;
    const loop = async (now) => {
      if (held !== el) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      for (const k of ["x", "y"]) {
        const goal = k === "x" ? tilt.tx : tilt.ty;
        const v = k === "x" ? "vx" : "vy";
        tilt[v] += ((goal - tilt[k]) * 90 - tilt[v] * 13) * dt;
        tilt[k] += tilt[v] * dt;
      }
      const t = (now - t0) / 1000;
      const warm = el.classList.contains("playable") ? 1.15 + 0.1 * Math.sin(t * 2.2) : 0.28;
      await EmberAmber.paint(el.querySelector("canvas.live"), el.spec, {
        warm,
        tilt: [tilt.x, tilt.y],
        time: t,
        breathe: 0.012 + 0.008 * Math.sin(t * 1.7),
      });
      heldRaf = requestAnimationFrame(loop);
    };
    heldRaf = requestAnimationFrame(loop);
  }
  function release() {
    if (!held) return;
    held.classList.remove("lifted", "live");
    cancelAnimationFrame(heldRaf);
    held = null;
  }
  addEventListener("pointermove", (e) => {
    if (!held) return;
    const r = held.getBoundingClientRect();
    tilt.tx = Math.max(-0.7, Math.min(0.7, ((e.clientX - (r.left + r.width / 2)) / r.width) * 1.3));
    tilt.ty = Math.max(-0.7, Math.min(0.7, (-(e.clientY - (r.top + r.height * 0.45)) / r.height) * 1.3));
  });

  function wire(el) {
    el.addEventListener("pointerenter", () => hold(el));
    el.addEventListener("pointerleave", () => {
      if (held === el) release();
    });
    el.addEventListener("click", () => awaken(el));
  }

  /* ---------- awakening (playing a card) ---------- */
  const layer = $("#awaken-layer");
  const stageRect = (el) => {
    const s = stage.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale };
  };
  function caption(text, ms = 1600) {
    const c = document.createElement("div");
    c.className = "caption glass";
    c.textContent = text;
    layer.append(c);
    c.animate([{ opacity: 0, transform: "translate(-50%,8px)" }, { opacity: 1, transform: "translate(-50%,0)" }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms, easing: "ease-out" }).onfinish = () => c.remove();
  }
  async function awaken(el) {
    if (el.busy) return;
    const c = cards[el.dataset.id];
    if (c.cost > mana) {
      el.animate([{ translate: "0 0" }, { translate: "-5px 0" }, { translate: "5px 0" }, { translate: "-3px 0" }, { translate: "0 0" }], { duration: 320 });
      caption("火种不够暖——这块琥珀还醒不过来", 1500);
      return;
    }
    el.busy = true;
    const from = stageRect(el);
    release();
    mana -= c.cost;
    $("#mana").value = mana;
    $("#mana-out").textContent = mana;
    // The stone leaves the strap.
    el.classList.add("gone");
    const ghostPiece = piece(el.dataset.id, 156);
    ghostPiece.classList.add("playable", "live");
    ghostPiece.querySelector(".tag").style.display = "none";
    Object.assign(ghostPiece.style, { left: "0px", top: "0px", zIndex: 5, transformOrigin: "50% 50%" });
    layer.append(ghostPiece);
    const live = ghostPiece.querySelector("canvas.live");
    await EmberAmber.paint(live, ghostPiece.spec, { warm: 1.2 });
    const to = { x: CX - 78, y: 330 };
    const fromT = `translate(${from.x + (from.w - 156) / 2}px, ${from.y + (from.h - 230) / 2}px) scale(${from.w / 156})`;
    const toT = `translate(${to.x}px, ${to.y}px) scale(1.75)`;
    await ghostPiece.animate([{ transform: fromT }, { transform: toT }], { duration: 430, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished;
    for (const n of ghostPiece.querySelectorAll(".cost,.stat")) n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
    // Warm it past bearing: cracks of light.
    const t0 = performance.now();
    await new Promise((done) => {
      const step = async (now) => {
        const k = Math.min(1, (now - t0) / 720);
        await EmberAmber.paint(live, ghostPiece.spec, { warm: 1.2 + k * 1.3, crack: k, time: k * 2, tilt: [Math.sin(k * 40) * 0.03 * k, 0] });
        if (k < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    // Shards are amber, not light: paint them from a calmer frame.
    const src = document.createElement("canvas");
    src.width = live.width;
    src.height = live.height;
    await EmberAmber.paint(src, ghostPiece.spec, { warm: 1.5, crack: 0.45, mount: 0 });
    shatter(src, to, c);
    ghostPiece.remove();
    hand.splice(hand.indexOf(el), 1);
    el.remove();
    layout();
  }
  function shatter(canvas, at, c) {
    const S = 1.75,
      w = 156 * S,
      h = 230 * S;
    const ox = at.x + 78 - w / 2,
      oy = at.y + 115 - h / 2;
    const cx = w / 2,
      cy = h * 0.47;
    const R = Math.max(w, h) * 0.62;
    const rings = [
      { n: 7, r0: 0, r1: 0.42 },
      { n: 13, r0: 0.42, r1: 1.2 },
    ];
    for (const ring of rings) {
      const a0 = Math.random() * Math.PI * 2;
      const angles = Array.from({ length: ring.n + 1 }, (_, i) => a0 + (i / ring.n) * Math.PI * 2 + (i && i < ring.n ? (Math.random() - 0.5) * 0.35 : 0));
      for (let i = 0; i < ring.n; i++) {
        const a1 = angles[i],
          a2 = angles[i + 1],
          am = (a1 + a2) / 2;
        const r0 = R * ring.r0,
          r1 = R * ring.r1 * (0.9 + Math.random() * 0.2),
          rm = R * ((ring.r0 + ring.r1) / 2) * (0.85 + Math.random() * 0.3);
        const pts = [
          [cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0],
          [cx + Math.cos(a1) * rm, cy + Math.sin(a1) * rm],
          [cx + Math.cos(a1 + 0.1) * r1, cy + Math.sin(a1 + 0.1) * r1],
          [cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1],
          [cx + Math.cos(a2) * rm, cy + Math.sin(a2) * rm],
          [cx + Math.cos(am) * r0, cy + Math.sin(am) * r0],
        ];
        const sh = document.createElement("canvas");
        sh.className = "shard";
        sh.width = canvas.width;
        sh.height = canvas.height;
        sh.getContext("2d").drawImage(canvas, 0, 0);
        Object.assign(sh.style, { left: ox + "px", top: oy + "px", width: w + "px", height: h + "px", transformOrigin: `${cx + Math.cos(am) * rm}px ${cy + Math.sin(am) * rm}px`, clipPath: `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",")})` });
        layer.append(sh);
        const dist = (ring.r0 ? 200 : 110) + Math.random() * 200;
        sh.animate(
          [
            { transform: "translate(0,0) rotate(0)", opacity: 1 },
            { transform: `translate(${Math.cos(am) * dist * 0.35}px, ${Math.sin(am) * dist * 0.35}px) rotate(${(Math.random() - 0.5) * 40}deg)`, opacity: 1, offset: 0.25 },
            { transform: `translate(${Math.cos(am) * dist}px, ${Math.sin(am) * dist + 160}px) rotate(${(Math.random() - 0.5) * 220}deg) scale(.7)`, opacity: 0 },
          ],
          { duration: 800 + Math.random() * 350, easing: "cubic-bezier(.2,.65,.35,1)", fill: "forwards" },
        ).onfinish = () => sh.remove();
      }
    }
    for (let i = 0; i < 26; i++) {
      const d = document.createElement("div");
      d.className = "drop";
      const s = 4 + Math.random() * 8;
      Object.assign(d.style, { width: s + "px", height: s + "px", left: ox + cx + "px", top: oy + cy + "px" });
      layer.append(d);
      const a = Math.random() * Math.PI * 2,
        r = 120 + Math.random() * 260;
      d.animate(
        [
          { transform: "translate(-50%,-50%)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r * 0.7 + 180}px))`, opacity: 0 },
        ],
        { duration: 800 + Math.random() * 500, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" },
      ).onfinish = () => d.remove();
    }
    const f = document.createElement("div");
    f.className = "flash";
    Object.assign(f.style, { left: ox + cx - 260 + "px", top: oy + cy - 260 + "px", width: "520px", height: "520px" });
    layer.append(f);
    f.animate([{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1)", offset: 0.25 }, { opacity: 0, transform: "scale(1.3)" }], { duration: 900, fill: "forwards" }).onfinish = () => f.remove();
    const g = document.createElement("img");
    g.className = "ghost";
    g.src = urls(c.id).art;
    Object.assign(g.style, { left: ox + cx - 150 + "px", top: oy + cy - 210 + "px", width: "300px", height: "400px" });
    layer.append(g);
    g.animate(
      [
        { opacity: 0, transform: "scale(.7)", filter: "brightness(2) sepia(.6)" },
        { opacity: 1, transform: "scale(1)", filter: "brightness(1.15) sepia(0)", offset: 0.35 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: "scale(1.08) translateY(-16px)" },
      ],
      { duration: 1500, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => g.remove();
    caption(`唤醒 · ${c.name}`, 1700);
  }

  /* ---------- drawing (opening the window) ---------- */
  async function draw() {
    if (hand.length >= 10) return caption("琥珀带满了", 1200);
    const id = drawPool[Math.floor(Math.random() * drawPool.length)];
    const el = piece(id);
    await bake(el);
    el.classList.add("live", "drawing");
    const live = el.querySelector("canvas.live");
    await EmberAmber.paint(live, el.spec, { crust: 1, mount: 0 });
    for (const n of el.querySelectorAll(".cost,.tag,.stat")) n.style.opacity = "0";
    hand.push(el);
    handEl.append(el);
    wire(el);
    const n = hand.length;
    const { x, y } = slot(n - 1, n);
    el.style.setProperty("--x", x + "px");
    el.style.setProperty("--y", y + "px");
    el.style.zIndex = String(n);
    layout();
    el.animate(
      [
        { transform: `translate(60px, 700px) scale(.35) rotate(-30deg)` },
        { transform: `translate(${(60 + x) / 2}px, 560px) scale(.8) rotate(-8deg)`, offset: 0.55 },
        { transform: `translate(${x}px, ${y}px) scale(1) rotate(0deg)` },
      ],
      { duration: 620, easing: "cubic-bezier(.3,.7,.3,1)" },
    );
    await new Promise((r) => setTimeout(r, 560));
    swing(el, 0.35);
    const t0 = performance.now();
    await new Promise((done) => {
      const step = async (now) => {
        const k = Math.min(1, (now - t0) / 1000);
        const e = 1 - Math.pow(1 - k, 2);
        await EmberAmber.paint(live, el.spec, { crust: 1 - e, mount: Math.max(0, (k - 0.55) / 0.45), warm: el.classList.contains("playable") ? e : 0 });
        if (k < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
    for (const n of el.querySelectorAll(".cost,.tag,.stat")) {
      n.style.transition = "opacity .35s";
      n.style.opacity = "1";
    }
    el.classList.remove("live", "drawing");
    $("#case-count").textContent = String(+$("#case-count").textContent - 1);
  }

  /* ---------- a new turn: the spark warms the strap ---------- */
  function newTurn() {
    mana = Math.min(10, mana + 1);
    $("#mana").value = mana;
    $("#mana-out").textContent = mana;
    hand.forEach((el) => el.classList.remove("playable"));
    const path = $("#pulse-path"),
      grad = $("#pulse");
    path.setAttribute("opacity", "1");
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1300);
      const x = 180 + k * 1260;
      grad.setAttribute("x1", x - 110);
      grad.setAttribute("x2", x + 110);
      path.setAttribute("opacity", String(k < 0.85 ? 1 : (1 - k) / 0.15));
      hand.forEach((el) => {
        const cx = parseFloat(el.style.getPropertyValue("--x")) + W / 2;
        if (!el.classList.contains("playable") && cards[el.dataset.id].cost <= mana && cx < x) {
          el.classList.add("playable");
          swing(el, 0.06);
        }
      });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- enemy: raw stones ---------- */
  let jet = false;
  async function enemyStones() {
    const box = $("#enemy-stones");
    box.innerHTML = "";
    const ids = ["guard", "berserker", "golem", "cleric", "titan"];
    const n = ids.length;
    for (let i = 0; i < n; i++) {
      const cv = document.createElement("canvas");
      cv.width = 44 * DPR;
      cv.height = 65 * DPR;
      const off = i - (n - 1) / 2;
      Object.assign(cv.style, { left: 93 + off * 34 + "px", top: 4 + Math.abs(off) * 3 + "px", transform: `rotate(${off * 7}deg)` });
      box.append(cv);
      const s = specOf(ids[i]);
      s.cut = { ...EmberAmber.CUTS.common };
      s.seed = (s.seed * 7.31 + i * 0.137) % 1;
      await EmberAmber.paint(cv, s, { crust: 1, bare: true, jet });
    }
  }

  /* ---------- controls ---------- */
  $("#mana").oninput = (e) => {
    mana = +e.target.value;
    $("#mana-out").textContent = mana;
    playable();
  };
  $("#turn").onclick = newTurn;
  $("#draw").onclick = draw;
  $("#enemy-kind").onclick = (e) => {
    jet = !jet;
    e.target.textContent = jet ? "敌方：黑玉原石" : "敌方：联邦原石";
    enemyStones();
  };
  $("#strap-toggle").onclick = (e) => {
    strap.classList.toggle("off");
    e.target.textContent = strap.classList.contains("off") ? "皮带：关" : "皮带：开";
  };

  /* ---------- tray ---------- */
  let trayBuilt = false;
  async function buildTray() {
    if (trayBuilt) return;
    trayBuilt = true;
    const groups = [
      {
        title: "颜色 = 职业",
        note: "天然琥珀的四个品种。同为稀有随从，只换职业。",
        slots: [
          ["berserker", "蜜珀", "中立 · 最常见的琥珀"],
          ["vowguard", "金珀", "圣卫 · 清亮如日光"],
          ["spider", "绿珀", "游侠 · 林间的树脂"],
          ["mirrormage", "蓝珀", "法师 · 表面泛星蓝荧光"],
        ],
      },
      {
        title: "切工与镶嵌 = 稀有度",
        note: "鉴珀师的四个等级。托的金属沿用卡框的稀有度色。",
        slots: [
          ["spark", "随形 · 皮绳", "普通 · 滚磨原形，绳子扎住"],
          ["frostgolem", "素面 · 银托", "稀有 · 抛光蛋面，四爪蓝宝"],
          ["phoenix", "刻面 · 包边", "史诗 · 十二面切工，紫晶"],
          ["nyx", "雕件 · 金冠", "传说 · 世界树叶冠，光晕"],
        ],
      },
      {
        title: "外形 = 类型",
        note: "封住的是什么，琥珀就长成什么样。",
        slots: [
          ["squire", "泪滴", "随从 · 一个生命"],
          ["fireball", "圆珠", "法术 · 凝住的一瞬"],
          ["sunblade", "棱晶", "武器 · 一件兵器"],
        ],
      },
      {
        title: "光 = 能不能出",
        note: "法力是持有者的火种之温。焐得热的琥珀会从里面亮起来。",
        slots: [
          ["mirrormage", "冷", "火种不够", { warm: 0 }],
          ["mirrormage", "焐热", "可以出", { warm: 1 }],
          ["mirrormage", "裂光", "唤醒的一瞬", { warm: 2, crack: 0.7 }],
        ],
      },
      {
        title: "原石与开窗",
        note: "对手的手牌是没开窗的原石：看得见有几块，看不见里面封着什么。抽牌就是给原石开窗。",
        wide: true,
        slots: [
          ["guard", "联邦原石", "敌方手牌", { crust: 1, bare: true }],
          ["guard", "黑玉原石", "黑玉之界的敌人", { crust: 1, bare: true, jet: true }],
          ["dragon", "开窗 · 磨去外皮", "抽到手里的一刻", { crust: 0.55, mount: 0 }],
          ["dragon", "开窗完成", "", { crust: 0, warm: 1 }],
          ["skeleton", "虚珀", "衍生物：琥珀力量的投影", { warm: 0.6 }],
        ],
      },
    ];
    const root = $("#tray-groups");
    for (const g of groups) {
      const box = document.createElement("div");
      box.className = "group" + (g.wide ? " wide" : "");
      box.innerHTML = `<h3>${g.title}</h3><p>${g.note}</p><div class="slots"></div>`;
      root.append(box);
      for (const [id, name, small, state] of g.slots) {
        const s = document.createElement("div");
        s.className = "slot";
        const el = piece(id, 136);
        const well = document.createElement("div");
        well.className = "well";
        well.append(el);
        s.append(well);
        s.insertAdjacentHTML("beforeend", `<div class="plate">${name}${small ? `<small>${small}</small>` : ""}</div>`);
        box.querySelector(".slots").append(s);
        const st = state || { warm: 1 };
        if (st.crust >= 1) for (const n of el.querySelectorAll(".cost,.tag,.stat")) n.style.display = "none";
        if (st.crust > 0 && st.crust < 1) for (const n of el.querySelectorAll(".tag,.stat,.cost")) n.style.opacity = ".0";
        if ((st.warm ?? 1) >= 1 && !st.crust) el.classList.add("playable");
        el.classList.add("live");
        const live = el.querySelector("canvas.live");
        await EmberAmber.paint(live, el.spec, { tilt: [-0.05, 0.04], ...st });
      }
    }
  }

  /* ---------- start ---------- */
  const opening = ["spark", "starshot", "mirrormage", "fireball", "phoenix", "storm", "nyx", "boar"];
  for (const id of opening) {
    const el = piece(id);
    hand.push(el);
    handEl.append(el);
    wire(el);
  }
  layout(false);
  await Promise.all(hand.map((el) => bake(el)));
  enemyStones();
  window.__lab = { hand, cards, draw, newTurn, awaken, buildTray };
})();
