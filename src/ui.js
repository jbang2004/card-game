/* Application controller. Offline rules, local storage, input, deck editor and campaign. */
(() => {
  "use strict";
  const D = EmberData,
    A = EmberArt,
    $ = (id) => document.getElementById(id),
    app = $("app");
  const STORE = "emberfall.v1",
    DECK = "emberfall.deck.v1",
    SETTINGS = "emberfall.settings.v1";
  const {
    escape,
    formatText,
    artKeyForCard,
    artStyleForCard,
    artStyleForHero,
    cardHTML,
  } = EmberCards;
  function readStore(key, fallback = null) {
    try {
      const t = localStorage.getItem(key);
      return t ? JSON.parse(t) : fallback;
    } catch {
      return fallback;
    }
  }
  let storeWarning = false;
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      if (!storeWarning) {
        storeWarning = true;
        toast("浏览器未允许本地存档，本次游戏仍可继续。");
      }
      return false;
    }
  }
  const defaults = {
    sound: true,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    low: false,
    fast: false,
  };
  const settings = { ...defaults, ...readStore(SETTINGS, {}) };
  let inBattle = false,
    isDemo = false,
    modalType = null,
    selection = null,
    chosenHero = "mage",
    aiTimer = null,
    turnTimer = null,
    toastTimer = null,
    runToken = 0,
    previewTimer = null,
    lastFocus = null,
    drag = null,
    suppressClick = false;
  let editDeck = [],
    filterType = "all",
    filterCost = "all",
    filterSearch = "",
    deckHero = "mage",
    mulliganSet = new Set(),
    pointer = { x: 800, y: 470 };
  const keywords = {
    taunt: "敌方必须先攻击具有嘲讽的随从。",
    shield: "抵挡下一次伤害，然后移除圣盾。",
    rush: "被召唤的回合即可攻击随从，但不能攻击英雄。",
    charge: "被召唤的回合即可攻击。",
    lifesteal: "造成伤害时，为自己的英雄恢复等量生命。",
    poison: "对随从造成伤害后，消灭该随从。",
    windfury: "每个回合最多攻击两次。",
    stealth: "攻击前不能成为敌方攻击或指定效果的目标，仍受群体效果影响。",
    reborn: "死亡后以 1 点生命复活一次，复活后的随从不再具有复生。",
    spellpower: "使你的伤害法术额外造成 1 点伤害。",
  };
  const game = new EmberEngine.Game({ onChange: changed });
  const coarsePointer = () =>
    matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

  function resize() {
    EmberViewport.resize();
  }
  function iconify(root = document) {
    root
      .querySelectorAll("[data-icon]")
      .forEach((el) => (el.innerHTML = A.icon(el.dataset.icon)));
  }
  function toast(text) {
    clearTimeout(toastTimer);
    $("toast").textContent = text;
    $("toast").classList.add("visible");
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 2900);
  }
  function applySettings() {
    document.body.classList.toggle("reduced-motion", !!settings.reduced);
    $("sound-btn").innerHTML = A.icon(settings.sound ? "sound" : "mute");
    $("sound-btn").setAttribute("aria-pressed", String(settings.sound));
    EmberAudio.toggle(settings.sound);
    EmberScene.quality(settings.reduced, settings.low);
    EmberFX.configure(settings.reduced, settings.low);
  }
  function save() {
    if (game.s && !isDemo) writeStore(STORE, game.s);
  }
  function validSave() {
    const s = readStore(STORE);
    return s?.version === 1 &&
      D.heroes.some((h) => h.id === s.heroId) &&
      D.bosses[s.bossIndex]
      ? s
      : null;
  }
  function updateStart() {
    const s = validSave();
    $("start-btn").innerHTML =
      (s ? "继续冒险" : "开启冒险") + " " + A.icon("arrow");
    $("quick-btn").textContent = s ? "新的旅程" : "战斗试玩";
    $("quick-btn").title = s
      ? "开始新战役（确认后覆盖当前进度）"
      : "从第 6 回合开始的示范战斗，不影响战役存档";
  }
  function startGame(hero, boss = 0, relics = [], deck = null) {
    EmberFX.cancel();
    runToken++;
    clearTimeout(aiTimer);
    clearTimeout(turnTimer);
    isDemo = false;
    inBattle = true;
    chosenHero = hero;
    selection = null;
    closeModal(false);
    setView(true);
    game.start(hero, boss, relics, deck);
    showMulligan();
  }
  function continueGame() {
    const s = validSave();
    if (!s) {
      showHeroes();
      return;
    }
    runToken++;
    isDemo = false;
    inBattle = true;
    closeModal(false);
    setView(true);
    if (!game.restore(s)) {
      toast("存档无法读取，请重新开启旅程。");
      setView(false);
      inBattle = false;
      return;
    }
    chosenHero = game.s.heroId;
    if (s.phase === "mulligan") showMulligan();
    else if (s.phase === "over") showResult();
    else if (s.choice?.side === "p") showDiscover();
    else scheduleAI();
  }
  function setView(battle) {
    app.classList.toggle("battle-view", battle);
    app.classList.toggle("lobby-view", !battle);
    $("lobby").style.display = battle ? "none" : "block";
    $("battle").style.display = battle ? "block" : "none";
    EmberScene.setView(battle ? "battle" : "lobby");
    EmberFX.setView(battle ? "battle" : "lobby");
    document
      .querySelectorAll(".nav-link")
      .forEach((e) => e.classList.remove("active"));
    $("adventure-nav").classList.add("active");
    if (!battle) {
      app.classList.remove("log-open", "intel-open");
      $("card-preview").style.display = "none";
      clearSelection();
      updateStart();
    }
  }
  function home() {
    EmberFX.cancel();
    clearTimeout(aiTimer);
    clearTimeout(turnTimer);
    save();
    inBattle = false;
    closeModal(false);
    setView(false);
  }
  function newJourney() {
    if (validSave())
      showConfirm(
        "重燃一段新的旅程",
        "开启新战役后，当前战役的本地进度将被覆盖。卡组和设置不会受到影响。",
        () => showHeroes(),
        "选择英雄",
      );
    else showHeroes();
  }
  function demo() {
    EmberFX.cancel();
    runToken++;
    clearTimeout(aiTimer);
    isDemo = true;
    inBattle = true;
    closeModal(false);
    setView(true);
    game.start("mage", 0, [], null, 372149);
    game.mulligan();
    const s = game.s;
    s.turn = 6;
    s.stats.turns = 6;
    s.p.maxMana = s.p.mana = 6;
    s.e.maxMana = 5;
    s.e.mana = 0;
    s.p.hp = 26;
    s.e.hp = 27;
    s.e.armor = 3;
    s.p.board = [];
    s.e.board = [];
    s.p.hand = [
      "frostbolt",
      "phoenix",
      "fireball",
      "wisdom",
      "sunblade",
      "bolt",
    ].map((id) => game.card(id));
    for (const id of ["guard", "oracle", "wisp"])
      game.summon("p", id, { sick: false });
    for (const id of ["squire", "golem", "leech"])
      game.summon("e", id, { sick: false });
    s.log = [
      "战斗试玩 · 从第 6 回合开始，不覆盖战役存档。",
      "敌方铁卫具有嘲讽，必须先解决它。",
      "星界精灵使你的法术伤害提高 1 点。",
      "你的随从已准备好攻击。",
    ];
    game.emit();
    $("turn-banner").classList.remove("show");
    toast("战斗试玩：点击手牌或己方随从，再选择目标。");
  }
  function showModal(html, type, locked = false) {
    clearTimeout(toastTimer);
    $("toast").classList.remove("visible");
    if (modalType === "lab") EmberFX.setLab(false);
    clearTimeout(aiTimer);
    hidePreview();
    clearSelection();
    lastFocus = document.activeElement;
    modalType = type;
    $("modal").dataset.type = type;
    $("modal").innerHTML = html;
    $("modal").style.display = "flex";
    $("modal").dataset.locked = locked ? "1" : "0";
    if (!locked) {
      const box = $("modal").firstElementChild;
      const close = document.createElement("button");
      close.className = "modal-close";
      close.setAttribute("aria-label", "关闭对话框");
      close.innerHTML = A.icon("close");
      close.onclick = () => closeModal();
      box.prepend(close);
    }
    window.EmberMobile?.afterModal(type);
    requestAnimationFrame(() => {
      $("modal")
        .querySelector("button:not(:disabled),input,select")
        ?.focus({ preventScroll: true });
    });
  }
  function closeModal(resume = true) {
    if (modalType === "lab") EmberFX.setLab(false);
    $("modal").style.display = "none";
    $("modal").innerHTML = "";
    modalType = null;
    delete $("modal").dataset.type;
    hidePreview();
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
    if (resume) scheduleAI();
  }
  function showConfirm(title, text, fn, label = "确认") {
    showModal(
      `<section class="modal-box confirm-box"><div class="modal-heading"><div class="eyebrow">EMBERFALL</div><h2>${title}</h2></div><p>${text}</p><div class="modal-footer"><button class="ghost-btn" id="cancel-confirm">取消</button><button class="gold-btn" id="ok-confirm">${label}</button></div></section>`,
      "confirm",
    );
    $("cancel-confirm").onclick = () => closeModal();
    $("ok-confirm").onclick = () => {
      closeModal(false);
      fn();
    };
  }
  function showHeroes() {
    const custom = readStore(DECK);
    showModal(
      `<section class="modal-box"><div class="modal-heading"><div class="eyebrow">CHOOSE YOUR PATH</div><h2>选择你的英雄</h2><p>三种信仰，同一束不灭的星火。你的英雄技能将贯穿整段旅程。</p></div><div class="hero-options">${D.heroes.map((h) => `<button class="hero-option hero-${h.id} ${h.id === chosenHero ? "selected" : ""}" data-hero="${h.id}"><img src="${A.url(h.art, h.palette, h.id)}" alt="${h.name}" draggable="false" style="${artStyleForHero(h, "option")}"><div class="hero-option-text"><small>${h.sub}</small><h3>${h.name}</h3><p>${h.desc}</p><em>${h.powerText}</em></div>${h.id === chosenHero ? '<span class="selected-check">' + A.icon("check") + "</span>" : ""}</button>`).join("")}</div><p class="hero-deck-note">${game.validateDeck(custom) ? "已装配你的自定义 30 张卡组。" : "每位英雄均配有经过费用曲线配置的 30 张起始牌组。"} · 战役共五场，关卡之间恢复全部生命。</p><div class="modal-footer"><button class="ghost-btn" id="hero-deck-btn">先去组牌</button><button class="gold-btn" id="hero-confirm">踏入余火之门 ${A.icon("arrow")}</button></div></section>`,
      "heroes",
    );
    document.querySelectorAll("[data-hero]").forEach(
      (b) =>
        (b.onclick = () => {
          chosenHero = b.dataset.hero;
          EmberAudio.fx("ui");
          showHeroes();
        }),
    );
    $("hero-confirm").onclick = () => {
      const d = readStore(DECK);
      startGame(chosenHero, 0, [], game.validateDeck(d) ? d : null);
    };
    $("hero-deck-btn").onclick = () => {
      deckHero = chosenHero;
      showLibrary();
    };
  }
  function showMulligan() {
    mulliganSet = new Set();
    renderMulligan();
  }
  function renderMulligan() {
    showModal(
      `<section class="modal-box mulligan-box"><div class="modal-heading"><div class="eyebrow">YOUR OPENING HAND</div><h2>命运的第一手</h2><p>点击不想保留的卡牌进行替换。优先留下低费随从，建立你的战场。</p></div><div class="mulligan-cards">${game.s.p.hand.map((c) => `<button class="mulligan-card ${mulliganSet.has(c.uid) ? "replace" : ""}" data-mulligan="${c.uid}" aria-label="${D.byId[c.cid].name}，点击${mulliganSet.has(c.uid) ? "保留" : "替换"}">${cardHTML(D.byId[c.cid])}</button>`).join("")}</div><div class="modal-footer"><button class="gold-btn" id="mulligan-confirm">${mulliganSet.size ? "替换 " + mulliganSet.size + " 张并开始" : "保留手牌，开始战斗"} ${A.icon("arrow")}</button></div><p class="hero-deck-note">你先手。每个回合开始时，抽一张牌。</p></section>`,
      "mulligan",
      true,
    );
    document.querySelectorAll("[data-mulligan]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.mulligan;
          mulliganSet.has(id) ? mulliganSet.delete(id) : mulliganSet.add(id);
          renderMulligan();
        }),
    );
    $("mulligan-confirm").onclick = () => {
      const ids = [...mulliganSet];
      closeModal(false);
      game.mulligan(ids);
    };
  }
  function centerOf(el) {
    return EmberViewport.pos(el);
  }
  function findUnit(side, uid) {
    return uid === "hero"
      ? $(side === "p" ? "player-hero" : "enemy-hero")
      : document.querySelector(`.minion[data-uid="${uid}"]`);
  }
  function changed(s, events) {
    save();
    if (!inBattle) {
      render(s);
      return;
    }
    const token = runToken;
    EmberFX.present(
      events || [],
      s,
      () => render(s),
      () => {
        if (!inBattle || token !== runToken) return;
        handleEvents(events || []);
        if (s.choice?.side === "p" && !modalType) showDiscover();
        if (s.phase === "over") {
          clearTimeout(aiTimer);
          clearTimeout(turnTimer);
          turnTimer = setTimeout(() => {
            if (inBattle && token === runToken && game.s.phase === "over")
              showResult();
          }, 400);
        } else scheduleAI();
      },
      cardHTML,
    );
  }
  function render(s) {
    if (!s) return;
    const handScroll = $("hand").scrollLeft;
    EmberFX.setTheme(s.bossIndex, s.phase2);
    EmberScene.setTheme?.(s.bossIndex, s.phase2);
    const hero = D.heroes.find((h) => h.id === s.heroId),
      boss = D.bosses[s.bossIndex];
    $("chapter-name").textContent = boss.title;
    $("chapter-sub").textContent =
      "CHAPTER " +
      ["I", "II", "III", "IV", "V"][s.bossIndex] +
      " · " +
      (isDemo ? "战斗试玩" : "失落的王国");
    $("path-list").innerHTML = D.bosses
      .map(
        (b, i) =>
          `<div class="path-item ${i === s.bossIndex ? "current" : i < s.bossIndex ? "done" : ""}"><div class="path-node"><span>${i < s.bossIndex ? "✓" : String(i + 1).padStart(2, "0")}</span></div><div><strong>${b.title}</strong><small>${b.name}</small></div></div>`,
      )
      .join("");
    $("relic-slots").innerHTML =
      s.relics
        .map((id) => {
          const r = D.relics.find((x) => x.id === id);
          return `<div class="relic-slot" title="${r.name}：${r.text}">${A.icon(r.icon)}</div>`;
        })
        .join("") +
      Array.from(
        { length: Math.max(0, 3 - s.relics.length) },
        () => '<div class="relic-slot empty">' + A.icon("gem") + "</div>",
      ).join("");
    $("boss-order").textContent =
      "BOSS ENCOUNTER · " + String(s.bossIndex + 1).padStart(2, "0");
    $("boss-name").textContent = boss.name;
    $("boss-english").textContent = boss.en;
    $("boss-power-info").innerHTML =
      `<strong>${boss.power}</strong><p>${boss.powerText}</p>`;
    $("phase-info").classList.toggle("awaken", s.phase2);
    $("phase-info").innerHTML =
      `<small>${s.phase2 ? "PHASE II · 已觉醒" : "PHASE II · 半血觉醒"}</small><p>${boss.phaseText}</p>`;
    for (const side of ["p", "e"]) {
      const p = s[side],
        data = side === "p" ? hero : boss,
        el = $(side === "p" ? "player-hero" : "enemy-hero");
      el.innerHTML = `<div class="hero-carving" aria-hidden="true"></div><div class="portrait-frame"><img src="${A.url(data.art, data.palette, data.id)}" alt="${data.name}" draggable="false" style="${artStyleForHero(data, "hero")}"></div><div class="hero-name">${data.name}</div><div class="hero-health ${p.hp < p.maxHp ? "damaged" : ""}">${Math.max(0, p.hp)}</div>${p.armor ? `<div class="hero-armor" title="护甲 ${p.armor}">${p.armor}</div>` : ""}${p.secrets.length ? '<div class="secret-indicator" title="奥秘已布置">?</div>' : ""}${side === "e" ? `<div class="hero-phase">${s.phase2 ? "阶段 II" : "阶段 I"}</div>` : ""}`;
      el.classList.toggle("frozen", p.frozen);
      el.classList.toggle("ready", game.canAttack(side, "hero"));
      el.setAttribute(
        "aria-label",
        data.name +
          "，生命 " +
          p.hp +
          "，护甲 " +
          p.armor +
          (p.frozen ? "，已冻结" : ""),
      );
      el.title =
        data.name +
        " · " +
        p.hp +
        "/" +
        p.maxHp +
        (p.armor ? " · 护甲 " + p.armor : "");
    }
    $("hero-side-label").innerHTML =
      `<strong>${hero.title}</strong>${isDemo ? "战斗试玩" : "余火的旅人"}`;
    $("power-btn").innerHTML =
      A.icon(
        hero.id === "mage"
          ? "fire"
          : hero.id === "paladin"
            ? "shield"
            : "sword",
      ) +
      "<b>2</b><span>" +
      hero.power +
      "</span>";
    $("power-btn").title = hero.powerText;
    $("power-btn").disabled =
      s.phase !== "battle" ||
      s.active !== "p" ||
      s.p.powerUsed ||
      s.p.mana < 2 ||
      !!s.choice ||
      (hero.id === "paladin" && s.p.board.length >= 7);
    $("enemy-mana").innerHTML =
      "<i></i><span>" + s.e.mana + " / " + s.e.maxMana + "</span>";
    $("enemy-hand").innerHTML = s.e.hand
      .map(
        (c, i) =>
          `<div class="card-back" style="--r:${(i - (s.e.hand.length - 1) / 2) * 5}deg;--y:${Math.abs(i - (s.e.hand.length - 1) / 2) * 3}px"></div>`,
      )
      .join("");
    $("enemy-hand").setAttribute(
      "aria-label",
      "敌方手牌 " + s.e.hand.length + " 张",
    );
    $("enemy-deck-count").textContent = s.e.deck.length;
    $("player-deck-count").textContent = s.p.deck.length;
    if (s.p.weapon) {
      const c = D.byId[s.p.weapon.cid];
      $("weapon-slot").style.display = "flex";
      $("weapon-slot").innerHTML =
        `<img src="${A.card(c)}" alt="${c.name}"><b>${s.p.weapon.atk}</b><b>${s.p.weapon.durability}</b>`;
      $("weapon-slot").title =
        c.name +
        "：攻击力 " +
        s.p.weapon.atk +
        "，耐久 " +
        s.p.weapon.durability +
        "。点击英雄进行攻击。";
    } else $("weapon-slot").style.display = "none";
    $("minions").innerHTML = ["e", "p"]
      .map((side) =>
        s[side].board
          .map((m, i) => {
            const c = D.byId[m.cid],
              ready = game.canAttack(side, m.uid),
              geo = EmberViewport.minion(side, i, s[side].board.length),
              x = geo.x,
              y = geo.y;
            const specials = m.tags
              .filter((t) =>
                [
                  "poison",
                  "lifesteal",
                  "reborn",
                  "windfury",
                  "spellpower",
                ].includes(t),
              )
              .map(
                (t) =>
                  ({
                    poison: "◆",
                    lifesteal: "♥",
                    reborn: "↻",
                    windfury: "»",
                    spellpower: "✦",
                  })[t],
              )
              .join("");
            return `<button class="minion ${side === "e" ? "enemy" : "friendly"} ${m.tags.join(" ")} ${ready ? "ready" : ""} ${m.frozen ? "frozen" : ""} ${c.rarity}" style="left:${x}px;top:${y}px;width:${geo.w}px;height:${geo.h}px;--unit-w:${geo.w}px" data-compact="${geo.w < 50}" data-side="${side}" data-uid="${m.uid}" data-cardid="${c.id}" aria-label="${c.name}，攻击 ${m.atk}，生命 ${m.hp}，${m.tags.map((t) => D.kw[t]).join("、")}${m.frozen ? "，被冻结" : ""}"><div class="minion-art"><img src="${A.card(c)}" alt="" draggable="false" data-art-key="${artKeyForCard(c)}" style="${artStyleForCard(c, "minion")}"></div><div class="minion-name">${c.name}</div><span class="stat atk">${m.atk}</span><span class="stat hp ${m.hp < m.maxHp ? "hurt" : ""}">${m.hp}</span><span class="minion-status">${m.frozen ? "❄" : specials ? '<span class="special">' + specials + "</span>" : m.sick && !ready ? '<span class="sleep">z z</span>' : ""}</span>${ready ? '<span class="ready-dot"></span>' : ""}</button>`;
          })
          .join(""),
      )
      .join("");
    $("board-empty").style.display = s.p.board.length ? "none" : "block";
    $("hand-count").textContent = s.p.hand.length;
    const metrics = EmberHand.metrics(s.p.hand.length);
    $("hand").style.setProperty("--desktop-card-w", metrics.width + "px");
    $("hand").style.setProperty("--desktop-card-h", metrics.height + "px");
    $("hand").classList.toggle("compact-hand", s.p.hand.length > 7);
    const gap = metrics.step;
    $("hand").innerHTML = s.p.hand
      .map((card, i) => {
        const c = D.byId[card.cid],
          offset = i - (s.p.hand.length - 1) / 2,
          playable = !game.legalCard("p", card.uid);
        return `<button class="hand-card ${playable ? "playable" : ""} ${game.cost(card) > s.p.mana ? "unaffordable" : ""}" style="--x:${offset * gap}px;--y:${0}px;--r:${0}deg;--i:${i + 1}" data-hand="${card.uid}" data-cardid="${c.id}" aria-label="${c.name}，${game.cost(card)} 法力。${c.text}">${cardHTML(c, { cost: game.cost(card) })}</button>`;
      })
      .join("");
    const ours = s.active === "p";
    $("turn-number").textContent =
      "TURN " +
      String(s.turn).padStart(2, "0") +
      " · " +
      (ours ? "你的回合" : "敌方回合");
    $("end-turn").disabled = s.phase !== "battle" || !ours || !!s.choice;
    $("end-turn").textContent =
      s.phase === "over" ? "战斗结束" : ours ? "结束回合" : "敌方回合";
    $("end-turn").classList.toggle("thinking", !ours);
    const anyAction =
      s.p.hand.some((c) => !game.legalCard("p", c.uid)) ||
      s.p.board.some((m) => game.canAttack("p", m.uid)) ||
      game.canAttack("p", "hero") ||
      !$("power-btn").disabled;
    $("end-turn").classList.toggle("ready-end", ours && !anyAction);
    $("turn-shortcut").textContent = ours
      ? "SPACE · 结束回合"
      : "正在选择行动…";
    $("mana-value").textContent = s.p.mana + " / " + s.p.maxMana;
    $("mana-gems").innerHTML = Array.from(
      { length: 10 },
      (_, i) =>
        `<span class="mana-gem ${i < s.p.mana ? "available" : i < s.p.maxMana ? "used" : ""}"></span>`,
    ).join("");
    $("battle-log").innerHTML = s.log
      .slice(-8)
      .map(
        (l) =>
          `<div class="log-line ${l.startsWith("第 ") ? "log-turn" : ""}">${escape(l)}</div>`,
      )
      .join("");
    document.querySelectorAll(".minion").forEach((el) => {
      el.onclick = () => {
        if (EmberViewport.mobile && window.EmberMobile)
          EmberMobile.tapUnit(el.dataset.side, el.dataset.uid);
        else clickUnit(el.dataset.side, el.dataset.uid);
      };
      el.addEventListener("mouseenter", () => preview(el.dataset.cardid, el));
      el.addEventListener("mouseleave", hidePreview);
    });
    document.querySelectorAll(".hand-card").forEach((el) => {
      el.onclick = (e) => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (EmberViewport.mobile && window.EmberMobile)
          EmberMobile.handClick(el.dataset.hand);
        else selectCard(el.dataset.hand);
      };
      el.addEventListener("mouseenter", () => preview(el.dataset.cardid, el));
      el.addEventListener("mouseleave", hidePreview);
      el.addEventListener("focus", () => preview(el.dataset.cardid, el));
      el.addEventListener("blur", hidePreview);
      el.addEventListener("pointerdown", beginDrag);
    });
    if (EmberViewport.mobile) $("hand").scrollLeft = handScroll;
    window.EmberMobile?.afterRender(s);
    updateSelection();
    EmberScene.sync(s);
  }
  function preview(cid, el) {
    clearTimeout(previewTimer);
    if (EmberViewport.mobile) return;
    if (drag?.started) return;
    previewTimer = setTimeout(() => {
      const c = D.byId[cid];
      if (!c || !el.isConnected) return;
      const p = $("card-preview");
      let actual = null;
      if (el.dataset.uid)
        actual = game.s[el.dataset.side]?.board.find(
          (m) => m.uid === el.dataset.uid,
        );
      p.innerHTML = cardHTML(
        c,
        actual ? { atk: actual.atk, hp: actual.hp } : {},
      );
      const keys = actual ? actual.tags : c.tags;
      if (keys?.length)
        p.innerHTML +=
          '<div class="keyword-notes">' +
          keys
            .map((k) => "<b>" + D.kw[k] + "</b> · " + keywords[k])
            .join("<br>") +
          "</div>";
      const pos = centerOf(el);
      if (modalType === "library") {
        p.style.zIndex = "95";
        p.style.left =
          (pos.x < 1070 ? Math.min(pos.x + 89, 1100) : pos.x - 320) + "px";
        p.style.top = Math.min(Math.max(pos.y - 170, 118), 470) + "px";
      } else {
        p.style.zIndex = "45";
        p.style.left = "29px";
        p.style.top = "345px";
      }
      p.style.display = "block";
    }, 280);
  }
  function hidePreview() {
    clearTimeout(previewTimer);
    $("card-preview").style.display = "none";
  }
  function act(fn) {
    if (EmberFX.busy) return { ok: false, error: "战斗动作正在结算" };
    clearTimeout(toastTimer);
    $("toast").classList.remove("visible");
    hidePreview();
    clearSelection();
    const r = fn();
    if (!r?.ok) toast(r?.error || "无法执行此操作");
    return r;
  }
  function targetAnchor(targets) {
    if (!targets?.length) return null;
    const preferred =
      targets.find((t) => t.side === "e" && t.uid !== "hero") ||
      targets.find((t) => t.side === "e") ||
      targets[0];
    return centerOf(findUnit(preferred.side, preferred.uid));
  }
  function selectCard(uid) {
    if (!inBattle || modalType || EmberFX.busy) return;
    const err = game.legalCard("p", uid);
    if (err) {
      toast(err);
      return;
    }
    const card = game.s.p.hand.find((x) => x.uid === uid),
      c = D.byId[card.cid],
      targets = c.target ? game.targets(c.target, "p") : [];
    if (c.target && targets.length) {
      selection = { type: "card", uid, cid: card.cid };
      pointer = targetAnchor(targets) || pointer;
      hint(
        "选择" +
          (c.target === "friendlyMinion" ? "一个友方随从" : "一个目标") +
          " · ESC 取消",
      );
      updateSelection(targets);
      hidePreview();
      EmberAudio.fx("ui");
    } else act(() => game.play("p", uid));
  }
  function clickUnit(side, uid) {
    if (modalType || !inBattle || EmberFX.busy) return;
    if (selection) {
      const sel = selection;
      if (
        EmberViewport.mobile &&
        side === "e" &&
        !findUnit(side, uid)?.classList.contains("valid-target")
      ) {
        toast("请点击高亮的合法目标");
        return;
      }
      if (sel.type === "card")
        act(() => game.play("p", sel.uid, { side, uid }));
      else if (sel.type === "attack") {
        if (side === "p") {
          if (game.canAttack("p", uid)) {
            selection = { type: "attack", uid };
            const targets = game.attackTargets("p", uid);
            pointer = targetAnchor(targets) || pointer;
            updateSelection(targets);
          } else clearSelection();
        } else act(() => game.attack("p", sel.uid, { side, uid }));
      } else if (sel.type === "power")
        act(() => game.power("p", { side, uid }));
      return;
    }
    if (side === "p") {
      if (game.canAttack("p", uid)) {
        selection = { type: "attack", uid };
        const targets = game.attackTargets("p", uid);
        pointer = targetAnchor(targets) || pointer;
        hint("选择攻击目标 · 嘲讽随从优先 · ESC 取消");
        updateSelection(targets);
        hidePreview();
        EmberAudio.fx("ui");
      } else if (uid === "hero") {
        toast(
          game.s.p.weapon
            ? "本回合无法再次攻击，或英雄已被冻结。"
            : "先装备武器，再用英雄进行攻击。",
        );
      } else {
        const m = game.getTarget({ side, uid });
        toast(
          m.frozen
            ? "这个随从被冻结了。"
            : m.sick
              ? "召唤失调：需要等到下回合才能攻击。"
              : m.atk === 0
                ? "攻击力为 0，无法攻击。"
                : "这个随从本回合已经攻击过了。",
        );
      }
    }
  }
  function usePower() {
    if ($("power-btn").disabled || EmberFX.busy) return;
    if (game.s.heroId === "mage") {
      selection = { type: "power" };
      const targets = game.targets("enemy", "p");
      pointer = targetAnchor(targets) || pointer;
      hint("星火 · 选择一个敌人，造成 1 点伤害");
      updateSelection(targets);
    } else act(() => game.power("p"));
  }
  function hint(t) {
    clearTimeout(toastTimer);
    $("toast").classList.remove("visible");
    $("hint").textContent = t;
    $("hint").style.display = "block";
  }
  function clearSelection() {
    app.classList.remove("is-targeting");
    selection = null;
    $("touch-target-bar").hidden = true;
    $("combat-preview").style.display = "none";
    $("hint").style.display = "none";
    $("target-lines").style.display = "none";
    document.querySelectorAll(".selected,.valid-target").forEach((el) => {
      if (el.matches(".hero,.minion,.hand-card"))
        el.classList.remove("selected", "valid-target");
    });
  }
  function updateSelection(targets = null) {
    document
      .querySelectorAll(".hero,.minion,.hand-card")
      .forEach((el) => el.classList.remove("selected", "valid-target"));
    if (!selection) return;
    targets = targets || [];
    if (!targets.length) {
      if (selection.type === "attack") {
        targets = game.attackTargets("p", selection.uid);
        findUnit("p", selection.uid)?.classList.add("selected");
      } else if (selection.type === "card") {
        const c = D.byId[selection.cid];
        targets = game.targets(c.target, "p");
        document
          .querySelector(`[data-hand="${selection.uid}"]`)
          ?.classList.add("selected");
      } else targets = game.targets("enemy", "p");
    }
    if (selection.type === "attack")
      findUnit("p", selection.uid)?.classList.add("selected");
    else if (selection.type === "card")
      document
        .querySelector(`[data-hand="${selection.uid}"]`)
        ?.classList.add("selected");
    targets.forEach((t) =>
      findUnit(t.side, t.uid)?.classList.add("valid-target"),
    );
    if (EmberViewport.mobile) {
      app.classList.add("is-targeting");
      $("touch-target-bar").hidden = false;
      window.EmberMobile?.selectionChanged();
    }
    updateTargetLine();
  }
  function updateTargetLine() {
    if (!selection || modalType) return;
    const source =
      selection.type === "attack"
        ? findUnit("p", selection.uid)
        : selection.type === "power"
          ? $("power-btn")
          : document.querySelector(`[data-hand="${selection.uid}"]`);
    const from = centerOf(source);
    if (!from) return;
    const to = pointer,
      dx = to.x - from.x,
      dy = to.y - from.y,
      len = Math.hypot(dx, dy);
    if (len < 12) {
      $("target-lines").style.display = "none";
      return;
    }
    const bend = Math.min(EmberViewport.mobile ? 18 : 34, len * 0.07),
      nx = -dy / len,
      ny = dx / len;
    const c1 = {
        x: from.x + dx * 0.33 + nx * bend,
        y: from.y + dy * 0.33 + ny * bend,
      },
      c2 = {
        x: from.x + dx * 0.66 + nx * bend,
        y: from.y + dy * 0.66 + ny * bend,
      };
    $("target-lines").style.display = "block";
    $("target-path").setAttribute(
      "d",
      `M${from.x},${from.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`,
    );
    const angle = Math.atan2(to.y - c2.y, to.x - c2.x),
      tip = EmberViewport.mobile ? 9 : 13,
      wing = tip * 0.55;
    const ux = Math.cos(angle),
      uy = Math.sin(angle);
    $("target-arrow").setAttribute(
      "d",
      `M${to.x},${to.y} L${to.x - tip * ux - wing * uy},${to.y - tip * uy + wing * ux} L${to.x - tip * ux + wing * uy},${to.y - tip * uy - wing * ux} Z`,
    );
    $("target-circle").setAttribute("cx", to.x);
    $("target-circle").setAttribute("cy", to.y);
    $("target-circle").setAttribute("r", EmberViewport.mobile ? "10" : "12");
  }
  function localPoint(e) {
    return EmberViewport.point(e);
  }
  function beginDrag(e) {
    if (EmberViewport.mobile) return;
    if (e.button !== 0 || modalType || EmberFX.busy) return;
    const el = e.currentTarget,
      uid = el.dataset.hand;
    if (game.legalCard("p", uid)) return;
    const p = localPoint(e);
    drag = {
      uid,
      cid: el.dataset.cardid,
      x: p.x,
      y: p.y,
      el,
      started: false,
      pointerId: e.pointerId,
    };
  }
  document.addEventListener(
    "pointermove",
    (e) => {
      if (!EmberViewport.mobile || e.pointerType !== "touch") {
        pointer = localPoint(e);
        if (selection) updateTargetLine();
      }
      if (!drag) return;
      if (
        !drag.started &&
        Math.hypot(pointer.x - drag.x, pointer.y - drag.y) > 12
      ) {
        drag.started = true;
        clearSelection();
        hidePreview();
        drag.el.classList.add("drag-source");
        const ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.innerHTML = cardHTML(D.byId[drag.cid]);
        app.appendChild(ghost);
        drag.ghost = ghost;
        const c = D.byId[drag.cid];
        if (c.target) {
          selection = { type: "card", uid: drag.uid, cid: drag.cid };
          updateSelection();
        } else hint("将卡牌拖入战场");
      }
      if (drag.started) {
        e.preventDefault();
        drag.ghost.style.left = pointer.x + "px";
        drag.ghost.style.top = pointer.y + "px";
      }
    },
    { passive: false },
  );
  document.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.started) return;
    d.ghost.remove();
    d.el.classList.remove("drag-source");
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 80);
    const el = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-uid]"),
      p = localPoint(e),
      c = D.byId[d.cid];
    clearSelection();
    if (c.target && el)
      act(() =>
        game.play("p", d.uid, { side: el.dataset.side, uid: el.dataset.uid }),
      );
    else if (c.target) {
      if (
        c.type === "minion" &&
        game.targets(c.target, "p").length === 0 &&
        p.y < 720
      )
        act(() => game.play("p", d.uid));
      else if (p.y < 730) selectCard(d.uid);
    } else if (p.y < 730 && p.x > 270 && p.x < 1330)
      act(() => game.play("p", d.uid));
  });
  document.addEventListener("pointercancel", () => {
    if (drag) {
      drag.ghost?.remove();
      drag.el.classList.remove("drag-source");
      drag = null;
      clearSelection();
    }
  });
  function scheduleAI() {
    clearTimeout(aiTimer);
    if (
      !inBattle ||
      modalType ||
      EmberFX.busy ||
      game.s?.phase !== "battle" ||
      game.s.active !== "e"
    )
      return;
    const token = runToken;
    aiTimer = setTimeout(
      () => {
        if (
          token !== runToken ||
          !inBattle ||
          modalType ||
          game.s.active !== "e"
        )
          return;
        const r = game.aiStep();
        if (!r.ok) {
          console.warn("AI action rejected", r.error);
          if (game.s.choice?.side === "e") game.choose(game.s.choice.cards[0]);
          else game.endTurn("e");
        }
      },
      settings.fast ? 240 : 720,
    );
  }
  function banner(text, sub) {
    const el = $("turn-banner");
    el.innerHTML = text + (sub ? "<small>" + sub + "</small>" : "");
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }
  function handleEvents(events) {
    for (const e of events) {
      if (e.type === "turn" && e.side === "p" && !modalType) {
        banner(
          "你的回合",
          "TURN " +
            String(game.s.turn).padStart(2, "0") +
            " · THE EMBER IS YOURS",
        );
        EmberAudio.fx("turn");
      }
      if (e.type === "over") EmberAudio.fx("over");
      if (e.type === "secret") toast("镜像伏击触发：镜卫代替英雄承受攻击。");
    }
  }
  function showDiscover() {
    const choice = game.s.choice;
    if (!choice || choice.side !== "p") return;
    showModal(
      `<section class="modal-box" style="width:875px"><div class="modal-heading"><div class="eyebrow">A GLIMPSE BEYOND</div><h2>虚空中的启示</h2><p>选择一张法术牌加入你的手牌。</p></div><div class="discover-options">${choice.cards.map((id) => `<button class="discover-card" data-discover="${id}" aria-label="发现 ${D.byId[id].name}">${cardHTML(D.byId[id])}</button>`).join("")}</div></section>`,
      "discover",
      true,
    );
    document.querySelectorAll("[data-discover]").forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.dataset.discover;
          closeModal(false);
          game.choose(id);
        }),
    );
  }
  function showResult() {
    if (!inBattle || game.s.phase !== "over") return;
    const s = game.s,
      win = s.winner === "p",
      last = s.bossIndex === 4;
    clearSelection();
    showModal(
      `<section class="modal-box result-box"><div class="result-sigil">${A.icon(win ? "fire" : "skull")}</div><div class="result-sub">${win ? (last ? "THE LAST EMBER BURNS" : "ENCOUNTER CLEARED") : s.winner === "draw" ? "A SHARED FATE" : "THE FLAME WILL RISE AGAIN"}</div><h2 class="result-title">${win ? (last ? "余火不灭" : "战役告捷") : s.winner === "draw" ? "同归于尽" : "火种未熄"}</h2><p class="boss-quote">${win ? (last ? "最后一颗星辰，因你重新燃起。" : "「" + D.bosses[s.bossIndex].name + "」已被击败。") : "每一次陨落，都是下一次重燃的序章。"}</p><div class="result-stats"><div><strong>${s.turn}</strong><span>战斗回合</span></div><div><strong>${s.stats.played}</strong><span>打出卡牌</span></div><div><strong>${s.stats.damage}</strong><span>造成伤害</span></div></div><div class="modal-footer"><button class="ghost-btn" id="result-home">返回营地</button><button class="gold-btn" id="result-next">${isDemo ? "开启正式旅程" : win ? (last ? "新的旅程" : "选择遗物") : "重试本关"} ${A.icon("arrow")}</button></div></section>`,
      "result",
      true,
    );
    $("result-home").onclick = home;
    $("result-next").onclick = () => {
      if (isDemo) {
        closeModal(false);
        showHeroes();
      } else if (win && !last) showRewards();
      else if (win) {
        home();
        showHeroes();
      } else {
        closeModal(false);
        startGame(s.heroId, s.bossIndex, s.relics, s.customDeck);
      }
    };
  }
  function showRewards() {
    const s = game.s;
    if (!s.rewardOffers) {
      const candidates = D.relics
        .filter((r) => !s.relics.includes(r.id))
        .map((r) => r.id);
      s.rewardOffers = game.shuffle(candidates).slice(0, 3);
      save();
    }
    showModal(
      `<section class="modal-box" style="width:880px"><div class="modal-heading"><div class="eyebrow">RELICS OF A FORGOTTEN AGE</div><h2>拾起古老的力量</h2><p>选择一件遗物。它将强化之后的每一场战斗，英雄生命也将完全恢复。</p></div><div class="relic-options">${s.rewardOffers
        .map((id) => {
          const r = D.relics.find((r) => r.id === id);
          return `<button class="relic-choice" data-relic="${id}"><img src="${A.url(r.icon, "gold", r.id)}" alt=""><h3>${r.name}</h3><p>${r.text}</p></button>`;
        })
        .join(
          "",
        )}</div><p class="boss-quote" style="margin:26px 0 0;font-size:13px">下一站 · ${D.bosses[s.bossIndex + 1].title}</p></section>`,
      "rewards",
      true,
    );
    document.querySelectorAll("[data-relic]").forEach(
      (b) =>
        (b.onclick = () => {
          const relics = [...s.relics, b.dataset.relic];
          startGame(s.heroId, s.bossIndex + 1, relics, s.customDeck);
        }),
    );
  }
  function showLibrary() {
    editDeck = readStore(DECK) || [
      ...D.heroes.find((h) => h.id === deckHero).deck,
    ];
    filterType = "all";
    filterCost = "all";
    filterSearch = "";
    renderLibrary();
  }
  function renderLibrary() {
    showModal(
      `<section class="modal-box library-box"><div class="library-heading"><div><h2>万象秘典</h2><p>THE COLLECTION · 48 张原创卡牌全部可用</p></div><input id="library-search" class="library-search" placeholder="搜索名称、关键词或效果…" aria-label="搜索卡牌" value="${escape(filterSearch)}"></div><div class="library-layout"><div class="library-main"><div class="filter-bar" id="filter-bar"><button class="filter-btn active" data-type="all">全部</button><button class="filter-btn" data-type="minion">随从</button><button class="filter-btn" data-type="spell">法术</button><button class="filter-btn" data-type="weapon">武器</button><span class="spacer"></span><button class="filter-btn mana active" data-mana="all">费用</button>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<button class="filter-btn mana" data-mana="${i}">${i === 7 ? "7+" : i}</button>`).join("")}</div><div class="library-grid" id="library-grid"></div><div class="library-foot" id="library-foot">点击卡牌加入牌组 · 右侧点击移除 · 同名最多 2 张，传说最多 1 张</div></div><aside class="deck-editor"><h3>你的牌组 <span class="deck-total" id="deck-total"></span></h3><p class="deck-intro">配置恰好 30 张卡牌。应用后用于新战役，<br>不会修改当前战斗的牌库。</p><div style="display:flex;gap:8px;align-items:center;margin-top:12px"><select class="library-search" id="deck-preset" aria-label="预设职业" style="width:160px;padding:7px">${D.heroes.map((h) => `<option value="${h.id}" ${deckHero === h.id ? "selected" : ""}>${h.name}预设</option>`).join("")}</select><button class="text-btn" id="deck-reset">套用</button><button class="text-btn" id="deck-clear">清空</button></div><div class="deck-list" id="deck-list"></div><div class="deck-curve" id="deck-curve"></div><div class="deck-actions"><button class="gold-btn small-btn" id="deck-save">应用牌组</button><button class="ghost-btn small-btn" id="deck-play">选择英雄</button></div></aside></div></section>`,
      "library",
    );
    $("library-search").oninput = (e) => {
      filterSearch = e.target.value;
      renderLibraryCards();
    };
    $("filter-bar")
      .querySelectorAll("[data-type]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            filterType = b.dataset.type;
            renderLibraryCards();
          }),
      );
    $("filter-bar")
      .querySelectorAll("[data-mana]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            filterCost = b.dataset.mana;
            renderLibraryCards();
          }),
      );
    $("deck-preset").onchange = (e) => (deckHero = e.target.value);
    $("deck-reset").onclick = () => {
      editDeck = [...D.heroes.find((h) => h.id === deckHero).deck];
      renderDeck();
      renderLibraryCards();
    };
    $("deck-clear").onclick = () => {
      editDeck = [];
      renderDeck();
      renderLibraryCards();
    };
    $("deck-save").onclick = () => {
      if (game.validateDeck(editDeck) && writeStore(DECK, editDeck))
        toast("30 张卡组已应用，将用于下一段新战役。");
    };
    $("deck-play").onclick = () => {
      if (!game.validateDeck(editDeck)) {
        toast("请先完成 30 张卡组，或关闭图鉴使用英雄预设。");
        return;
      }
      writeStore(DECK, editDeck);
      chosenHero = deckHero;
      if (inBattle && !isDemo) {
        showConfirm(
          "开启新的战役",
          "当前战役进度将被新战役覆盖。已应用的卡组会保留。",
          showHeroes,
          "选择英雄",
        );
      } else showHeroes();
    };
    renderLibraryCards();
    renderDeck();
  }
  function renderLibraryCards() {
    const list = D.cards
      .filter(
        (c) =>
          !c.token &&
          (filterType === "all" || c.type === filterType) &&
          (filterCost === "all" ||
            (filterCost === "7"
              ? c.cost >= 7
              : c.cost === Number(filterCost))) &&
          (!filterSearch ||
            (c.name + c.text + c.rarity)
              .toLowerCase()
              .includes(filterSearch.toLowerCase())),
      )
      .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, "zh"));
    $("filter-bar")
      .querySelectorAll("[data-type]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.type === filterType),
      );
    $("filter-bar")
      .querySelectorAll("[data-mana]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.mana === filterCost),
      );
    $("library-grid").innerHTML = list.length
      ? list
          .map(
            (c) =>
              `<button class="library-item" data-add="${c.id}" title="${c.name}：${c.text}">${cardHTML(c)}<span class="add-label">+ 加入牌组</span><span class="owned-count">${editDeck.filter((id) => id === c.id).length} / ${c.rarity === "legendary" ? 1 : 2}</span></button>`,
          )
          .join("")
      : '<p style="color:#879990;font-size:12px;padding:25px;grid-column:1/-1">没有符合筛选条件的卡牌。</p>';
    $("library-foot").textContent =
      "显示 " +
      list.length +
      " / 48 张 · 点击加入，右侧点击移除 · 同名最多 2 张，传说最多 1 张";
    document.querySelectorAll("[data-add]").forEach((b) => {
      b.onclick = () => {
        hidePreview();
        const id = b.dataset.add,
          c = D.byId[id],
          max = c.rarity === "legendary" ? 1 : 2;
        if (editDeck.length >= 30) {
          toast("牌组已满。先在右侧移除卡牌。");
          return;
        }
        if (editDeck.filter((x) => x === id).length >= max) {
          toast(
            c.rarity === "legendary"
              ? "每张传说只能携带 1 张。"
              : "同名卡牌最多携带 2 张。",
          );
          return;
        }
        editDeck.push(id);
        renderDeck();
        const count = b.querySelector(".owned-count");
        count.textContent =
          editDeck.filter((x) => x === id).length + " / " + max;
        EmberAudio.fx("ui");
      };
      b.onmouseenter = () => preview(b.dataset.add, b);
      b.onmouseleave = hidePreview;
    });
  }
  function renderDeck() {
    window.EmberMobile?.syncDeck(editDeck.length);
    const counts = {};
    editDeck.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
    $("deck-total").textContent = editDeck.length + "/30";
    $("deck-total").classList.toggle("full", editDeck.length === 30);
    $("deck-save").disabled = !game.validateDeck(editDeck);
    $("deck-list").innerHTML = Object.keys(counts)
      .sort((a, b) => D.byId[a].cost - D.byId[b].cost)
      .map((id) => {
        const c = D.byId[id];
        return `<button class="deck-row" data-remove="${id}" title="点击移除一张 ${c.name}"><span class="cost">${c.cost}</span><span>${c.name}</span><span class="count">${counts[id] > 1 ? "×" + counts[id] : c.rarity === "legendary" ? "✦" : "1"}</span></button>`;
      })
      .join("");
    const curve = Array(8).fill(0);
    editDeck.forEach((id) => curve[Math.min(7, D.byId[id].cost)]++);
    const max = Math.max(1, ...curve);
    $("deck-curve").innerHTML = curve
      .map(
        (n, i) =>
          `<div class="curve-bar" style="height:${(n / max) * 43}px" title="${i === 7 ? "7+" : i} 费：${n} 张"><small>${i === 7 ? "7+" : i}</small></div>`,
      )
      .join("");
    document.querySelectorAll("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          editDeck.splice(editDeck.indexOf(b.dataset.remove), 1);
          renderDeck();
          renderLibraryCards();
        }),
    );
  }
  function showSettings() {
    showModal(
      `<section class="modal-box settings-box"><div class="modal-heading"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h2>旅途设置</h2></div>${[
        ["sound", "声音与氛围", "低频环境声场与分层、分元素的战斗音效"],
        [
          "reduced",
          "减弱动态效果",
          "关闭粒子、镜头震动；保留伤害、状态和回合信息",
        ],
        ["low", "轻量画质", "减少粒子数量与帧率，关闭 3D 阴影"],
        ["fast", "加速敌方行动", "缩短 AI 每次行动之间的间隔"],
      ]
        .map(
          ([k, n, d]) =>
            `<div class="setting-row"><div><h3>${n}</h3><p>${d}</p></div><button class="toggle ${settings[k] ? "on" : ""}" data-setting="${k}" role="switch" aria-checked="${settings[k]}" aria-label="${n}"></button></div>`,
        )
        .join(
          "",
        )}<div class="modal-footer">${inBattle ? '<button class="ghost-btn small-btn" id="settings-home">返回营地</button><button class="ghost-btn small-btn" id="restart-battle">重试本关</button>' : '<button class="ghost-btn small-btn" id="settings-how">游戏玩法</button>'}<button class="gold-btn small-btn" id="settings-done">完成</button></div><p class="hero-deck-note">进度自动保存在当前浏览器。七系战斗特效均可离线运行。<br>默认使用完整手绘场景；战斗与特效可离线运行。</p></section>`,
      "settings",
    );
    document.querySelectorAll("[data-setting]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.setting;
          settings[k] = !settings[k];
          b.classList.toggle("on", settings[k]);
          b.setAttribute("aria-checked", String(settings[k]));
          writeStore(SETTINGS, settings);
          applySettings();
        }),
    );
    $("settings-done").onclick = () => closeModal();
    if (inBattle) {
      $("settings-home").onclick = home;
      $("restart-battle").onclick = () =>
        showConfirm(
          "重新点燃火种",
          "当前这场战斗将从头开始。已获得的遗物与之前的关卡进度不会丢失。",
          () => {
            const s = game.s;
            isDemo
              ? demo()
              : startGame(s.heroId, s.bossIndex, s.relics, s.customDeck);
          },
          "重试本关",
        );
    } else $("settings-how").onclick = showHelp;
  }
  function showHelp() {
    showModal(
      `<section class="modal-box help-box"><div class="modal-heading"><div class="eyebrow">THE WAYFARER'S HANDBOOK</div><h2>旅人手册</h2><p>让策略成为锋刃，让每一点法力都物有所值。</p></div><div class="help-columns"><div><section class="help-section"><h3>01 · 一场战斗如何获胜</h3><p>将敌方英雄生命降至 <b>0</b>。你有 <b>30 点基础生命、30 张牌库</b>，双方最多拥有 <b>7 个随从、10 张手牌</b>。你先手并可替换初始 3 张牌，敌方后手获得硬币。每个回合增加一枚法力水晶，上限 10，并补满法力、抽一张牌。</p></section><section class="help-section"><h3>02 · 出牌与攻击</h3><p><b>点击手牌</b>即可打出；需要目标时，再点击相应角色。也可以拖动卡牌。<br><b>点击己方随从 → 点击敌人</b>即可攻击。新召唤的随从通常需要等待一回合。双方随从同时对彼此造成攻击力数值的伤害。装备武器后，点击自己的英雄攻击。<br><b>2 法力</b>使用英雄技能，每回合一次。空格结束回合，Esc 取消选择，M 静音。</p></section><section class="help-section"><h3>03 · 构筑与冒险</h3><p>图鉴中 48 张卡全部开放。自定义牌组恰好 <b>30 张</b>，普通卡同名最多 2 张，传说最多 1 张。五位首领均在半血时进入第二阶段。每次胜利选择一件遗物，下一关生命完全恢复。进度自动保存在当前浏览器。<br>牌库耗尽后，每次抽牌依次受到 <b>1、2、3…</b> 点疲劳伤害。第 51 个玩家回合开始时判为平局。</p></section></div><div><section class="help-section"><h3>04 · 关键词速查</h3><div class="key-table">${Object.entries(
        keywords,
      )
        .map(([k, v]) => `<div><b>${D.kw[k]}</b>${v}</div>`)
        .join(
          "",
        )}<div><b>战吼 / 亡语</b>分别在从手牌打出随从时、随从死亡后触发。</div><div><b>冻结 / 沉默</b>冻结阻止攻击，直到自己的回合结束。沉默移除关键词、亡语和增益。</div><div><b>奥秘</b>隐藏的触发式法术。镜像伏击会用嘲讽镜卫拦截一次对英雄的攻击。</div><div><b>发现</b>从三个随机法术中选一张加入手牌。</div></div></section></div></div><div class="modal-footer"><button class="gold-btn small-btn" id="help-done">让冒险开始 ${A.icon("arrow")}</button></div></section>`,
      "help",
    );
    $("help-done").onclick = () => closeModal();
  }
  $("start-btn").onclick = () => {
    EmberAudio.unlock();
    validSave() ? continueGame() : showHeroes();
  };
  $("quick-btn").onclick = () => {
    EmberAudio.unlock();
    validSave() ? newJourney() : demo();
  };
  $("home-btn").onclick = () => {
    if (inBattle) home();
  };
  $("adventure-nav").onclick = () => {
    if (modalType) closeModal();
    if (!inBattle && validSave()) continueGame();
  };
  $("collection-nav").onclick = showLibrary;
  $("guide-nav").onclick = showHelp;
  $("settings-btn").onclick = showSettings;
  $("sound-btn").onclick = () => {
    settings.sound = !settings.sound;
    writeStore(SETTINGS, settings);
    applySettings();
  };
  $("fullscreen-btn").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast("浏览器未允许全屏；可以使用浏览器的全屏菜单。");
    }
  };
  $("player-hero").onclick = () =>
    EmberViewport.mobile && window.EmberMobile
      ? EmberMobile.tapUnit("p", "hero")
      : clickUnit("p", "hero");
  $("enemy-hero").onclick = () =>
    EmberViewport.mobile && window.EmberMobile
      ? EmberMobile.tapUnit("e", "hero")
      : clickUnit("e", "hero");
  $("power-btn").onclick = usePower;
  $("end-turn").onclick = () => act(() => game.endTurn("p"));
  $("arena").onclick = () => clearSelection();
  document.addEventListener("pointerdown", () => EmberAudio.unlock(), {
    once: true,
  });
  document.addEventListener("keydown", (e) => {
    const input = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === "Tab" && modalType) {
      const nodes = [
        ...$("modal").querySelectorAll(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (nodes.length) {
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (input && e.key !== "Escape") return;
    if (e.key === "Escape") {
      if (drag) {
        drag.ghost?.remove();
        drag.el.classList.remove("drag-source");
        drag = null;
      }
      if (selection) clearSelection();
      else if (modalType && $("modal").dataset.locked !== "1") closeModal();
      return;
    }
    if (e.key.toLowerCase() === "m") $("sound-btn").click();
    if (e.key.toLowerCase() === "h" && !modalType && !EmberFX.busy) showHelp();
    if (
      (e.code === "Space" || e.key === " ") &&
      inBattle &&
      !modalType &&
      game.s.active === "p" &&
      game.s.phase === "battle"
    ) {
      e.preventDefault();
      $("end-turn").click();
    }
  });
  window.addEventListener("resize", resize);
  window.addEventListener("beforeunload", save);
  resize();
  iconify();
  $("lobby-art").src = A.portrait("dragon", "ember", "worldender");
  $("lobby-card-one").innerHTML = cardHTML(D.byId.ashdragon);
  $("lobby-card-two").innerHTML = cardHTML(D.byId.phoenix);
  for (let i = 0; i < 35; i++) {
    const e = document.createElement("span");
    e.className = "ember";
    e.style.left = 8 + Math.random() * 86 + "%";
    e.style.top = 40 + Math.random() * 55 + "%";
    e.style.animationDelay = -(Math.random() * 15) + "s";
    e.style.animationDuration = 11 + Math.random() * 13 + "s";
    document.querySelector(".ambient").appendChild(e);
  }
  applySettings();
  updateStart();
  EmberScene.load();
  window.Emberfall = {
    selectCard,
    clickUnit,
    usePower,
    clearSelection,
    renderNow: () => render(game.s),
    save,
    toast,
    hidePreview,
    act,
    formatText,
    game,
    startGame,
    demo,
    home,
    showLibrary,
    showHelp,
    showSettings,
    showModal,
    closeModal,
    cardHTML,
    settings,
    get selection() {
      return selection;
    },
    get inBattle() {
      return inBattle;
    },
    get modal() {
      return modalType;
    },
  };
  window.addEventListener("ember:viewport", () => {
    if (drag) {
      drag.ghost?.remove();
      drag.el?.classList.remove("drag-source");
      drag = null;
    }
    clearSelection();
    hidePreview();
    EmberFX.reflow();
    if (game.s) render(game.s);
    window.EmberMobile?.afterModal(modalType);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      save();
      clearSelection();
      if (drag) {
        drag.ghost?.remove();
        drag.el?.classList.remove("drag-source");
        drag = null;
      }
    }
  });
})();
