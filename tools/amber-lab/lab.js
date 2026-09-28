/* Amber frame lab: the battle hand as today's cards with amber frames, and a
 * tray that compares them with the current face and explains the system. Uses
 * the real card art, relief height maps and card data (cards.json is exported
 * from src/data.js). */
(async () => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const DPR = Math.min(2, devicePixelRatio || 1);
  const cards = Object.fromEntries((await (await fetch("cards.json")).json()).map((c) => [c.id, c]));
  const index = Object.keys(cards);
  EmberAmber.configure({ studio: "../../art/relief/studio.webp" });
  const urls = (id) => ({ art: `../../assets/anime/${id}.webp`, height: `../../art/relief/${id}-height.webp` });
  const specOf = (id) => EmberAmber.spec(cards[id], urls(id));

  const stage = $("#stage");
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / 1600, innerHeight / 940);
    stage.style.transform = `scale(${scale})`;
  };
  addEventListener("resize", fit);
  fit();

  /* ---------- a card ---------- */
  const KW = ["战吼", "亡语", "法术伤害", "嘲讽", "圣盾", "突袭", "冲锋", "吸血", "剧毒", "风怒", "潜行", "复生", "冻结", "沉默", "发现", "奥秘"];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const rule = (t) => KW.reduce((s, k) => s.replaceAll(k, `<em>${k}</em>`), esc(t));
  const TYPE = { minion: "随从", spell: "法术", weapon: "武器" };
  const CLASS = { mage: "法师", paladin: "圣卫", ranger: "游侠", neutral: "中立" };

  function makeCard(id, w = 156) {
    const c = cards[id],
      s = specOf(id),
      b = EmberAmber.box(w);
    const el = document.createElement("div");
    el.className = "acard";
    el.dataset.id = id;
    el.dataset.rarity = c.rarity;
    el.style.setProperty("--w", w + "px");
    const stat = c.type !== "spell";
    el.innerHTML =
      `<canvas class="face cold"></canvas><canvas class="face warm"></canvas><canvas class="face live"></canvas>` +
      `<div class="cost"><span>${c.cost}</span></div>` +
      `<div class="title ${[...c.name].length > 6 ? "long" : ""}">${esc(c.name)}</div>` +
      `<div class="text"><span>${rule(c.text)}</span></div>` +
      `<div class="band">${TYPE[c.type] || "随从"} · ${CLASS[c.class] || "中立"}</div>` +
      (stat ? `<div class="stat atk"><span>${c.atk}</span></div><div class="stat hp ${c.type === "weapon" ? "ward" : ""}"><span>${c.hp}</span></div>` : "");
    for (const cv of el.querySelectorAll("canvas.cold,canvas.warm")) {
      cv.width = Math.round(b.cw * DPR);
      cv.height = Math.round(b.ch * DPR);
    }
    const live = el.querySelector("canvas.live");
    live.width = Math.round(b.cw * DPR * 1.35);
    live.height = Math.round(b.ch * DPR * 1.35);
    el.spec = s;
    return el;
  }
  async function bake(el, state = {}) {
    await EmberAmber.paint(el.querySelector("canvas.cold"), el.spec, { ...state, warm: 0 });
    await EmberAmber.paint(el.querySelector("canvas.warm"), el.spec, { ...state, warm: 1 });
  }
  function backCanvas(id, w, jet) {
    const b = EmberAmber.box(w);
    const cv = document.createElement("canvas");
    cv.width = Math.round(b.cw * DPR);
    cv.height = Math.round(b.ch * DPR);
    cv.style.width = b.cw + "px";
    cv.style.height = b.ch + "px";
    return EmberAmber.paint(cv, specOf(id), { back: true, jet, warm: 0.4 }).then(() => cv);
  }

  for (const b of document.querySelectorAll("#tabs button"))
    b.onclick = () => {
      document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("on", x === b));
      document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === b.dataset.view));
      if (b.dataset.view === "tray") buildTray();
    };

  /* ---------- battle hand ---------- */
  const hand = [];
  let mana = 6;
  const handEl = $("#hand");
  const W = 156,
    H = W / EmberAmber.CARD.aspect,
    RAIL = 1096,
    CX = 800,
    BASE = 733;
  const drawPool = ["frostbolt", "wisdom", "frostgolem", "oracle", "dragon", "scribe", "frostking", "counterspell", "wisp", "magmacore"];

  function slot(i, n) {
    const step = n > 1 ? Math.max(40, Math.min(W + 16, (RAIL - W) / (n - 1))) : 0;
    const off = i - (n - 1) / 2;
    return { x: CX - W / 2 + off * step, y: BASE + Math.round(Math.min(off * off * 3, 26) - 8), r: Math.max(-3.5, Math.min(3.5, off * 1.4)) };
  }
  function layout() {
    const n = hand.length;
    hand.forEach((el, i) => {
      const { x, y, r } = slot(i, n);
      el.style.setProperty("--x", x + "px");
      el.style.setProperty("--y", y + "px");
      el.style.setProperty("--r", r.toFixed(1) + "deg");
      el.style.zIndex = String(i + 1);
    });
    playable();
  }
  function playable() {
    hand.forEach((el) => el.classList.toggle("playable", cards[el.dataset.id].cost <= mana));
  }

  /* Held card: it lifts, and the amber answers the pointer. */
  let held = null,
    heldRaf = 0;
  const tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  function hold(el) {
    if (held === el || el.busy) return;
    release();
    held = el;
    el.classList.add("lifted", "live");
    let prev = performance.now();
    const t0 = prev;
    const loop = async (now) => {
      if (held !== el) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      for (const [k, v, g] of [["x", "vx", "tx"], ["y", "vy", "ty"]]) {
        tilt[v] += ((tilt[g] - tilt[k]) * 90 - tilt[v] * 13) * dt;
        tilt[k] += tilt[v] * dt;
      }
      const t = (now - t0) / 1000;
      await EmberAmber.paint(el.querySelector("canvas.live"), el.spec, {
        warm: el.classList.contains("playable") ? 1.1 + 0.1 * Math.sin(t * 2.2) : 0.15,
        tilt: [tilt.x, tilt.y],
        time: t,
        breathe: 0.01 + 0.006 * Math.sin(t * 1.7),
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
    tilt.tx = Math.max(-0.6, Math.min(0.6, ((e.clientX - (r.left + r.width / 2)) / r.width) * 1.2));
    tilt.ty = Math.max(-0.6, Math.min(0.6, (-(e.clientY - (r.top + r.height * 0.45)) / r.height) * 1.2));
  });
  function wire(el) {
    el.addEventListener("pointerenter", () => hold(el));
    el.addEventListener("pointerleave", () => held === el && release());
    el.addEventListener("click", () => play(el));
  }

  /* ---------- playing a card: the amber is warmed until it gives way ---------- */
  const fx = $("#fx-layer");
  const stageRect = (el) => {
    const s = stage.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale };
  };
  function caption(text, ms = 1600) {
    const c = document.createElement("div");
    c.className = "caption glass";
    c.textContent = text;
    fx.append(c);
    c.animate([{ opacity: 0, transform: "translate(-50%,8px)" }, { opacity: 1, transform: "translate(-50%,0)" }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms, easing: "ease-out" }).onfinish = () => c.remove();
  }
  const frame = (fn, ms) =>
    new Promise((done) => {
      const t0 = performance.now();
      const step = async (now) => {
        const k = Math.min(1, (now - t0) / ms);
        await fn(k);
        if (k < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });

  async function play(el) {
    if (el.busy) return;
    const c = cards[el.dataset.id];
    if (c.cost > mana) {
      el.animate([{ translate: "0 0" }, { translate: "-5px 0" }, { translate: "5px 0" }, { translate: "-3px 0" }, { translate: "0 0" }], { duration: 320 });
      caption("法力不够", 1200);
      return;
    }
    el.busy = true;
    const from = stageRect(el);
    release();
    mana -= c.cost;
    $("#mana").value = mana;
    $("#mana-out").textContent = mana;
    el.classList.add("gone");
    const g = makeCard(el.dataset.id, W);
    g.classList.add("playable", "live");
    Object.assign(g.style, { left: "0px", top: "0px", transformOrigin: "50% 50%" });
    fx.append(g);
    const live = g.querySelector("canvas.live");
    await EmberAmber.paint(live, g.spec, { warm: 1.1 });
    const S = 1.45,
      to = { x: CX - W / 2, y: 300 };
    await g.animate(
      [
        { transform: `translate(${from.x + (from.w - W) / 2}px, ${from.y + (from.h - H) / 2}px) scale(${from.w / W})` },
        { transform: `translate(${to.x}px, ${to.y}px) scale(${S})` },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
    ).finished;
    for (const n of g.querySelectorAll(".cost,.stat,.title,.text,.band")) n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" });
    await frame((k) => EmberAmber.paint(live, g.spec, { warm: 1.1 + k * 1.4, crack: k, time: k * 2, tilt: [Math.sin(k * 40) * 0.03 * k, 0] }), 700);
    const src = document.createElement("canvas");
    src.width = live.width;
    src.height = live.height;
    await EmberAmber.paint(src, g.spec, { warm: 1.5, crack: 0.45 });
    shatter(src, to, S, c);
    g.remove();
    hand.splice(hand.indexOf(el), 1);
    el.remove();
    layout();
  }
  function shatter(canvas, at, S, c) {
    const b = EmberAmber.box(W);
    const w = b.cw * S,
      h = b.ch * S;
    const ox = at.x + W / 2 - w / 2,
      oy = at.y + H / 2 - h / 2;
    const cx = w / 2,
      cy = h * 0.46;
    const R = Math.max(w, h) * 0.62;
    for (const ring of [{ n: 7, r0: 0, r1: 0.42 }, { n: 13, r0: 0.42, r1: 1.2 }]) {
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
        fx.append(sh);
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
    for (let i = 0; i < 24; i++) {
      const d = document.createElement("div");
      d.className = "drop";
      const s = 4 + Math.random() * 8;
      Object.assign(d.style, { width: s + "px", height: s + "px", left: ox + cx + "px", top: oy + cy + "px" });
      fx.append(d);
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
    fx.append(f);
    f.animate([{ opacity: 0, transform: "scale(.3)" }, { opacity: 1, transform: "scale(1)", offset: 0.25 }, { opacity: 0, transform: "scale(1.3)" }], { duration: 900, fill: "forwards" }).onfinish = () => f.remove();
    const gh = document.createElement("img");
    gh.className = "ghost";
    gh.src = urls(c.id).art;
    Object.assign(gh.style, { left: ox + cx - 150 + "px", top: oy + cy - 210 + "px", width: "300px", height: "400px" });
    fx.append(gh);
    gh.animate(
      [
        { opacity: 0, transform: "scale(.7)", filter: "brightness(2) sepia(.6)" },
        { opacity: 1, transform: "scale(1)", filter: "brightness(1.15) sepia(0)", offset: 0.35 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: "scale(1.08) translateY(-16px)" },
      ],
      { duration: 1500, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => gh.remove();
    caption(`唤醒 · ${c.name}`, 1700);
  }

  /* ---------- drawing: a card back flies in and turns over ---------- */
  async function draw() {
    if (hand.length >= 10) return caption("手牌已满", 1200);
    const id = drawPool[Math.floor(Math.random() * drawPool.length)];
    const el = makeCard(id, W);
    await bake(el);
    const back = await backCanvas(id, W, false);
    const b = EmberAmber.box(W);
    Object.assign(back.style, { position: "absolute", left: -b.m + "px", top: -b.m + "px", zIndex: 6 });
    el.append(back);
    for (const n of el.querySelectorAll(".cost,.stat,.title,.text,.band")) n.style.visibility = "hidden";
    hand.push(el);
    handEl.append(el);
    wire(el);
    el.busy = true;
    layout();
    const { x, y, r } = slot(hand.length - 1, hand.length);
    el.style.transition = "none";
    await el.animate(
      [
        { transform: `translate(40px, 640px) scale(.5) rotate(-18deg)` },
        { transform: `translate(${(40 + x) / 2}px, 520px) scale(.9) rotate(-6deg)`, offset: 0.6 },
        { transform: `translate(${x}px, ${y}px) rotate(${r}deg)` },
      ],
      { duration: 560, easing: "cubic-bezier(.3,.7,.3,1)" },
    ).finished;
    await el.animate([{ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scaleX(1)` }, { transform: `translate(${x}px, ${y}px) rotate(${r}deg) scaleX(0)` }], { duration: 150, easing: "ease-in" }).finished;
    back.remove();
    for (const n of el.querySelectorAll(".cost,.stat,.title,.text,.band")) n.style.visibility = "";
    await el.animate([{ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scaleX(0)` }, { transform: `translate(${x}px, ${y}px) rotate(${r}deg) scaleX(1)` }], { duration: 170, easing: "ease-out" }).finished;
    el.style.transition = "";
    el.busy = false;
  }

  /* ---------- a new turn: warmth runs along the hand ---------- */
  async function newTurn() {
    mana = Math.min(10, mana + 1);
    $("#mana").value = mana;
    $("#mana-out").textContent = mana;
    hand.forEach((el) => el.classList.remove("playable"));
    const s = document.createElement("div");
    s.className = "sweep";
    fx.append(s);
    await frame((k) => {
      const x = 180 + k * 1240;
      s.style.transform = `translate(${x - 120}px, 0)`;
      s.style.opacity = String(k < 0.85 ? 1 : (1 - k) / 0.15);
      hand.forEach((el) => {
        const cx = parseFloat(el.style.getPropertyValue("--x")) + W / 2;
        if (!el.classList.contains("playable") && cards[el.dataset.id].cost <= mana && cx < x) el.classList.add("playable");
      });
    }, 1200);
    s.remove();
  }

  /* ---------- enemy hand: card backs ---------- */
  let jet = false;
  async function enemyHand() {
    const box = $("#enemy-hand");
    box.innerHTML = "";
    const n = 5;
    for (let i = 0; i < n; i++) {
      const cv = await backCanvas(["guard", "golem", "cleric", "titan", "wolf"][i], 38, jet);
      const off = i - (n - 1) / 2;
      Object.assign(cv.style, { left: 92 + off * 30 + "px", top: 2 + Math.abs(off) * 3 + "px", transform: `rotate(${off * 6}deg)` });
      box.append(cv);
    }
  }

  $("#mana").oninput = (e) => {
    mana = +e.target.value;
    $("#mana-out").textContent = mana;
    playable();
  };
  $("#turn").onclick = newTurn;
  $("#draw").onclick = draw;
  $("#enemy-kind").onclick = (e) => {
    jet = !jet;
    e.target.textContent = jet ? "敌方卡背：黑玉" : "敌方卡背：琥珀";
    enemyHand();
  };

  /* ---------- tray ---------- */
  let trayBuilt = false;
  async function buildTray() {
    if (trayBuilt) return;
    trayBuilt = true;
    const groups = [
      {
        title: "对照：现在的卡面 → 琥珀卡框",
        note: "版式不动：插画、名字、规则、费用、攻血都在原位。换掉的是外框、名牌、规则底板和稀有度的表达。",
        wide: true,
        slots: [
          ["ref:mirrormage", "现在", "镜盾术士"],
          ["mirrormage", "琥珀卡框", "镜盾术士"],
          ["ref:nyx", "现在", "星陨女王·妮克丝"],
          ["nyx", "琥珀卡框", "星陨女王·妮克丝"],
          ["ref:fireball", "现在", "陨火术"],
          ["fireball", "琥珀卡框", "陨火术"],
        ],
      },
      {
        title: "琥珀的颜色 = 职业",
        note: "天然琥珀的四个品种，同为稀有随从。",
        slots: [
          ["berserker", "蜜珀", "中立"],
          ["vowguard", "金珀", "圣卫"],
          ["spider", "绿珀", "游侠"],
          ["mirrormage", "蓝珀", "法师 · 表面泛蓝荧光"],
        ],
      },
      {
        title: "镶嵌 = 稀有度",
        note: "沿用现在的稀有度色：无镶嵌、银、紫、金。",
        slots: [
          ["spark", "素框", "普通 · 滚磨的哑光琥珀"],
          ["frostgolem", "银角", "稀有 · 银包角，蓝宝"],
          ["phoenix", "刻面", "史诗 · 切面框，紫晶"],
          ["nyx", "金冠", "传说 · 世界树叶冠，光晕"],
        ],
      },
      {
        title: "亮起来 = 能出",
        note: "法力够的牌，琥珀框从里面亮起来，费用章变成烧红的黄铜。",
        slots: [
          ["mirrormage", "法力不够", "", { warm: 0 }],
          ["mirrormage", "可以出", "", { warm: 1 }],
          ["mirrormage", "出牌的一瞬", "琥珀裂开", { warm: 2, crack: 0.7 }],
        ],
      },
      {
        title: "法术、武器与卡背",
        note: "法术和武器用同一个框；卡背是一块封着火种的琥珀，黑玉之界的敌人用黑玉。",
        slots: [
          ["sunblade", "武器", "日耀圣剑"],
          ["back:guard", "卡背", "琥珀"],
          ["back-jet:guard", "卡背", "黑玉"],
        ],
      },
    ];
    const root = $("#tray-groups");
    for (const g of groups) {
      const box = document.createElement("div");
      box.className = "group" + (g.wide ? " wide" : "");
      box.innerHTML = `<h3>${g.title}</h3><p>${g.note}</p><div class="slots"></div>`;
      root.append(box);
      for (const [key, name, small, state] of g.slots) {
        const s = document.createElement("div");
        s.className = "slot";
        const holder = document.createElement("div");
        holder.className = "holder";
        s.append(holder);
        s.insertAdjacentHTML("beforeend", `<div class="plate">${name}${small ? `<small>${small}</small>` : ""}</div>`);
        box.querySelector(".slots").append(s);
        if (key.startsWith("ref:")) {
          holder.innerHTML = `<img class="ref" src="ref/${key.slice(4)}.webp" alt="">`;
          continue;
        }
        if (key.startsWith("back")) {
          const cv = await backCanvas(key.split(":")[1], 150, key.startsWith("back-jet"));
          const b = EmberAmber.box(150);
          Object.assign(cv.style, { position: "absolute", left: -b.m + "px", top: -b.m + "px" });
          holder.append(cv);
          continue;
        }
        const el = makeCard(key, 150);
        holder.append(el);
        const st = state || { warm: 1 };
        if ((st.warm ?? 1) >= 1) el.classList.add("playable");
        if (st.crack) for (const n of el.querySelectorAll(".cost,.stat,.title,.text,.band")) n.style.opacity = ".25";
        el.classList.add("live");
        await EmberAmber.paint(el.querySelector("canvas.live"), el.spec, { tilt: [-0.05, 0.04], ...st });
      }
    }
  }

  /* ---------- start ---------- */
  for (const id of ["spark", "starshot", "mirrormage", "fireball", "phoenix", "storm", "nyx", "boar"]) {
    const el = makeCard(id);
    hand.push(el);
    handEl.append(el);
    wire(el);
  }
  layout();
  await Promise.all(hand.map((el) => bake(el)));
  enemyHand();
  window.__lab = { hand, cards, draw, newTurn, play, buildTray };
})();
