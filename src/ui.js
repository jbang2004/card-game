/* Application controller. Offline rules, local storage, input, deck editor and campaign. */
(() => {
  "use strict";
  const D = EmberData,
    A = EmberArt,
    $ = (id) => document.getElementById(id),
    app = $("app");
  const STORE = "emberfall.v1",
    SETTINGS = "emberfall.settings.v1";
  const {
    escape,
    formatText,
    artKeyForCard,
    artStyleForCard,
    artStyleForHero,
    cardHTML,
  } = EmberCards;
  const {
    read: readStore,
    write: writeStore,
    readResult,
  } = EmberStorage.create(
    () => localStorage,
    () => toast("浏览器未允许本地存档，本次游戏仍可继续。"),
  );
  const defaults = {
    sound: true,
    volume: 0.75,
    sfxVolume: 0.85,
    ambienceVolume: 0.35,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    low: false,
    fast: false,
  };
  const settings = { ...defaults, ...readStore(SETTINGS, {}) };
  let inBattle = false,
    isDemo = false,
    modalType = null,
    selection = null,
    chosenHero = D.heroes[0].id,
    aiTimer = null,
    turnTimer = null,
    toastTimer = null,
    runToken = 0,
    previewTimer = null,
    lastFocus = null,
    drag = null,
    suppressClick = false;
  let mulliganSet = new Set(),
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
  const contractUI = EmberContractUI.create({
    game,
    showModal,
    closeModal,
    act,
  });
  const deckStore = EmberDeckStore.create({
    data: D,
    read: readResult,
    write: writeStore,
  });
  const library = EmberLibrary.create({
    data: D,
    deckStore,
    showModal,
    toast,
    preview,
    hidePreview,
    onStart(hero) {
      chosenHero = hero;
      if (inBattle && !isDemo)
        showConfirm(
          "开启新的战役",
          "当前战役进度将被新战役覆盖。已应用的卡组会保留。",
          showHeroes,
          "选择英雄",
        );
      else showHeroes();
    },
  });
  function showLibrary() {
    library.show();
  }
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
    EmberAudio.configure(settings);
    EmberAudio.toggle(settings.sound);
    EmberFX.configure(settings.reduced, settings.low);
  }
  function save() {
    if (game.s && !isDemo && game.s.mode !== "practice")
      writeStore(STORE, game.s);
  }
  function validSave() {
    const s = readStore(STORE);
    return EmberState.valid(s, D) ? s : null;
  }
  function updateStart() {
    const s = validSave();
    const discarded = readStore(STORE) && !s;
    document.querySelector(".local-status").textContent = discarded
      ? "测试存档已失效，请重新开始"
      : "单人战役";
    $("start-btn").innerHTML =
      (s ? "继续冒险" : "开启冒险") + " " + A.icon("arrow");
    $("quick-btn").textContent = s ? "新的旅程" : "战斗试玩";
    $("quick-btn").title = s
      ? "开始新战役（确认后覆盖当前进度）"
      : "从第 6 回合开始的示范战斗，不影响战役存档";
  }
  function startGame(hero, boss = 0, relics = [], deck = null, options = {}) {
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
    const result = game.start(hero, boss, relics, deck, Date.now(), options);
    if (!result.ok) {
      toast(result.error);
      home();
      return;
    }
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
    game.demo();
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
    EmberDialogs.mount($("modal").firstElementChild, type);
    const openedBox = $("modal").firstElementChild;
    requestAnimationFrame(() => {
      if (!openedBox?.isConnected || openedBox.contains(document.activeElement))
        return;
      openedBox
        .querySelector("button:not(:disabled),input,select")
        ?.focus({ preventScroll: true });
    });
  }
  function closeModal(resume = true) {
    EmberDialogs.close();
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
    const loaded = deckStore.load();
    const collection = loaded.ok
      ? loaded.collection
      : { decks: [], activeId: null };
    const customs = collection.decks.filter(
      (d) => d.heroId === chosenHero && game.validateDeck(d.cards, chosenHero),
    );
    const presets = D.archetypes.filter(
      (a) => a.classId === EmberDeckRules.classFor(D, chosenHero),
    );
    showModal(
      `<section class="modal-box"><div class="modal-heading"><div class="eyebrow">准备出发</div><h2>选择你的英雄</h2><p>选择英雄、套牌与对战方式。</p></div><div class="hero-options">${D.heroes.map((h) => `<button class="hero-option hero-${h.id} ${h.id === chosenHero ? "selected" : ""}" data-hero="${h.id}" aria-pressed="${h.id === chosenHero}"><img src="${A.character(h)}" alt="${h.name}" draggable="false" style="${artStyleForHero(h, "option")}"><div class="hero-option-text"><small>${h.sub}</small><h3>${h.name}</h3><p>${h.desc}</p><em>${h.powerText}</em></div>${h.id === chosenHero ? '<span class="selected-check" aria-hidden="true">' + A.icon("check") + "</span>" : ""}</button>`).join("")}</div><div class="hero-configuration"><p class="hero-deck-note">${escape(loaded.ok ? (customs.length ? "可选用已保存的英雄牌组。" : "请选择职业套牌，或到收藏中建立命名牌组。") : loaded.error)} · 战役共 ${D.bosses.length} 场，关卡之间恢复全部生命。</p><label class="archetype-picker">套牌 <select class="library-search" id="hero-archetype">${customs.map((d) => `<option value="saved:${d.id}" ${d.id === collection.activeId ? "selected" : ""}>${escape(d.name)}</option>`).join("")}${presets
        .map(
          (a) =>
            `<option value="${a.id}" ${!customs.length && a.id === D.heroes.find((h) => h.id === chosenHero).defaultDeckId ? "selected" : ""}>${a.name}</option>`,
        )
        .join(
          "",
        )}</select></label><p id="hero-plan" class="deck-plan"></p><details class="contract-setup"><summary>契约栏 · 最多三张，一位神祇</summary><p>契约不占主卡组，无需抽取；战斗中可查看召唤进度。</p>${
        D.cards
          .filter(
            (c) =>
              c.contract && c.class === EmberDeckRules.classFor(D, chosenHero),
          )
          .map(
            (c) =>
              `<label><input type="checkbox" data-contract="${c.id}" checked><strong>${c.name}</strong><span>${EmberContracts.describe(c)}</span></label>`,
          )
          .join("") || "该职业尚无契约。"
      }</details><label class="archetype-picker">玩法 <select id="game-mode" class="library-search"><option value="campaign">${D.bosses.length} 关战役 · 遗物与整备</option><option value="practice">练习对战 · 不覆盖战役存档</option></select></label><label class="archetype-picker" id="opponent-picker" hidden>对手 <select id="practice-opponent" class="library-search">${D.archetypes.map((a) => `<option value="${a.id}">${D.classNames[a.classId]} · ${a.name}</option>`).join("")}</select></label></div><div class="modal-footer"><button class="ghost-btn" id="hero-deck-btn">先去组牌</button><button class="gold-btn" id="hero-confirm">踏入余火之门 ${A.icon("arrow")}</button></div></section>`,
      "heroes",
    );
    document.querySelectorAll("[data-hero]").forEach(
      (b) =>
        (b.onclick = () => {
          const scrollTop =
            document.querySelector("#modal .modal-scroll")?.scrollTop || 0;
          const restoreFocus = document.activeElement === b;
          chosenHero = b.dataset.hero;
          EmberAudio.fx("ui");
          showHeroes();
          const scroll = document.querySelector("#modal .modal-scroll");
          if (scroll) scroll.scrollTop = scrollTop;
          if (restoreFocus)
            document
              .querySelector(`#modal [data-hero="${chosenHero}"]`)
              ?.focus({ preventScroll: true });
        }),
    );
    const plan = () => {
      const loadout =
        customs.find((d) => "saved:" + d.id === $("hero-archetype").value)
          ?.contracts ??
        D.heroes.find((h) => h.id === chosenHero).defaultContracts ??
        [];
      document
        .querySelectorAll("[data-contract]")
        .forEach((el) => (el.checked = loadout.includes(el.dataset.contract)));
      $("hero-plan").textContent =
        D.archetypes.find((a) => a.id === $("hero-archetype").value)?.plan ||
        `使用已保存的 ${D.deckRules.size} 张英雄牌组。`;
    };
    $("hero-archetype").onchange = plan;
    plan();
    $("game-mode").onchange = () => {
      $("opponent-picker").hidden = $("game-mode").value !== "practice";
      $("hero-confirm").textContent =
        $("game-mode").value === "practice" ? "开始练习对战" : "踏入余火之门";
    };
    $("hero-confirm").onclick = () => {
      const id = $("hero-archetype").value;
      const selected = id.startsWith("saved:")
        ? customs.find((d) => d.id === id.slice(6))?.cards
        : presets.find((a) => a.id === id)?.deck;
      if (!selected) {
        toast("请选择可用牌组");
        return;
      }
      startGame(
        chosenHero,
        0,
        [],
        selected,
        $("game-mode").value === "practice"
          ? {
              opponent: $("practice-opponent").value,
              contracts: [
                ...document.querySelectorAll("[data-contract]:checked"),
              ].map((el) => el.dataset.contract),
            }
          : {
              contracts: [
                ...document.querySelectorAll("[data-contract]:checked"),
              ].map((el) => el.dataset.contract),
            },
      );
    };
    $("hero-deck-btn").onclick = () => {
      library.show(chosenHero);
    };
  }
  function showMulligan() {
    mulliganSet = new Set();
    renderMulligan();
  }
  function renderMulligan() {
    showModal(
      `<section class="modal-box mulligan-box"><div class="modal-heading"><div class="eyebrow">YOUR OPENING HAND</div><h2>命运的第一手</h2><p>点击不想保留的卡牌进行替换。优先留下低费随从，建立你的战场。</p></div><div class="mulligan-cards">${game.s.p.hand.map((c) => `<button class="mulligan-card ${mulliganSet.has(c.uid) ? "replace" : ""}" data-mulligan="${c.uid}" aria-label="${D.byId[c.cid].name}，点击${mulliganSet.has(c.uid) ? "保留" : "替换"}">${cardHTML(D.byId[c.cid])}</button>`).join("")}</div><div class="modal-footer"><button class="gold-btn" id="mulligan-confirm">${mulliganSet.size ? "替换 " + mulliganSet.size + " 张并开始" : "保留手牌，开始战斗"} ${A.icon("arrow")}</button></div><p class="hero-deck-note">${game.s.first === "e" ? "你后手，换牌后获得硬币。" : "你先手。"}每个回合开始时，抽一张牌。</p></section>`,
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
      game.dispatch({ type: "mulligan", ids });
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
  let displayedState = null;
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
      (frame = s) => render(frame),
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
      displayedState,
    );
  }
  function render(s) {
    if (!s) return;
    displayedState = s;
    contractUI.render(s);
    const handScroll = $("hand").scrollLeft;
    EmberFX.setTheme(s.bossIndex, s.phase2);
    const hero = D.heroes.find((h) => h.id === s.heroId),
      boss =
        s.mode === "practice"
          ? {
              ...D.heroes.find((h) => h.id === s.opponentHero),
              en: "PRACTICE DUEL",
              phaseText: "双方 30 血，无遗物与首领觉醒。",
            }
          : D.bosses[s.bossIndex];
    $("chapter-name").textContent = boss.title;
    $("chapter-sub").textContent =
      "CHAPTER " +
      String(s.bossIndex + 1).padStart(2, "0") +
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
    if (s.mode === "practice") {
      $("chapter-name").textContent = "酒馆练习";
      $("chapter-sub").textContent = D.archetypes.find(
        (a) => a.id === s.opponent,
      ).name;
      $("boss-order").textContent = "PRACTICE DUEL";
      $("path-list").innerHTML =
        '<p class="deck-plan">' +
        D.archetypes.find((a) => a.id === s.opponent).plan +
        "</p>";
    }
    $("boss-name").textContent = boss.name;
    $("boss-english").textContent = boss.en;
    $("boss-power-info").innerHTML =
      `<strong>${boss.power}</strong><p>${boss.powerText}</p>`;
    $("phase-info").classList.toggle("awaken", s.phase2);
    $("phase-info").innerHTML =
      `<small>${s.mode === "practice" ? "公平练习" : s.phase2 ? "PHASE II · 已觉醒" : "PHASE II · 半血觉醒"}</small><p>${boss.phaseText}</p>`;
    for (const side of ["p", "e"]) {
      const p = s[side],
        data = side === "p" ? hero : boss,
        el = $(side === "p" ? "player-hero" : "enemy-hero");
      el.innerHTML = `<div class="portrait-frame"><img src="${A.character(data)}" data-art-key="${data.portraitId}" data-portrait-mode="hero" data-portrait-instance="${side}:hero" data-portrait-state="${p.frozen ? "frozen" : "idle"}" alt="${data.name}" draggable="false" style="${artStyleForHero(data, "hero")}"></div><div class="hero-name">${data.name}</div><div class="hero-health ${p.hp < p.maxHp ? "damaged" : ""}">${Math.max(0, p.hp)}</div>${p.armor ? `<div class="hero-armor" title="护甲 ${p.armor}">${p.armor}</div>` : ""}${p.secrets.length ? '<div class="secret-indicator" title="奥秘已布置">?</div>' : ""}${side === "e" && s.mode !== "practice" ? `<div class="hero-phase">${s.phase2 ? "阶段 II" : "阶段 I"}</div>` : ""}`;
      el.dataset.heroClass = data.classId || "boss";
      el.classList.toggle("frozen", p.frozen);
      el.classList.toggle("ready", game.canAttack(side, "hero"));
      el.setAttribute(
        "aria-label",
        data.name +
          "，生命 " +
          Math.max(0, p.hp) +
          "，护甲 " +
          p.armor +
          (p.frozen ? "，已冻结" : ""),
      );
      el.title =
        data.name +
        " · " +
        Math.max(0, p.hp) +
        "/" +
        p.maxHp +
        (p.armor ? " · 护甲 " + p.armor : "");
    }
    $("hero-side-label").innerHTML =
      `<strong>${hero.title}</strong>${isDemo ? "战斗试玩" : "余火的旅人"}`;
    $("power-btn").innerHTML =
      A.icon(hero.powerIcon) +
      "<b>" +
      hero.powerCost +
      "</b><span>" +
      hero.power +
      "</span>";
    $("power-btn").dataset.heroClass = hero.classId;
    $("power-btn").title = hero.powerText;
    $("power-btn").disabled = !!game.legalPower("p");
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
            return `<button class="minion ${side === "e" ? "enemy" : "friendly"} ${m.tags.join(" ")} ${ready ? "ready" : ""} ${m.frozen ? "frozen" : ""} ${c.rarity}" style="left:${x}px;top:${y}px;width:${geo.w}px;height:${geo.h}px;--unit-w:${geo.w}px" data-compact="${geo.w < 50}" data-side="${side}" data-uid="${m.uid}" data-cardid="${c.id}" aria-label="${c.name}，攻击 ${m.atk}，生命 ${m.hp}，${m.tags.map((t) => D.kw[t]).join("、")}${m.frozen ? "，被冻结" : ""}"><div class="minion-art"><img src="${A.card(c)}" alt="" draggable="false" data-art-key="${artKeyForCard(c)}" data-portrait-mode="board" data-portrait-instance="${side}:${m.uid}" data-portrait-state="${m.frozen ? "frozen" : "idle"}" style="${artStyleForCard(c, "minion")}"></div><span class="unit-aura" aria-hidden="true"></span><div class="minion-name">${c.name}</div><span class="stat atk">${m.atk}</span><span class="stat hp ${m.hp < m.maxHp ? "hurt" : ""}">${Math.max(0, m.hp)}</span><span class="minion-status">${m.frozen ? "❄" : specials ? '<span class="special">' + specials + "</span>" : m.sick && !ready ? '<span class="sleep">z z</span>' : ""}</span>${ready ? '<span class="ready-dot"></span>' : ""}</button>`;
          })
          .join(""),
      )
      .join("");
    $("board-empty").style.display = s.p.board.length ? "none" : "block";
    $("hand-count").textContent = s.p.hand.length;
    $("hand").setAttribute("aria-label", `你的 ${s.p.hand.length} 张手牌`);
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
    syncEndTurn(s);
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
    EmberPortraits.sync();
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
    if (!r?.ok) {
      EmberAudio.fx("error");
      toast(r?.error || "无法执行此操作");
    }
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
      EmberAudio.fx("error");
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
      EmberAudio.fx("select");
    } else act(() => game.dispatch({ type: "play", side: "p", uid }));
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
        act(() =>
          game.dispatch({
            type: "play",
            side: "p",
            uid: sel.uid,
            target: { side, uid },
          }),
        );
      else if (sel.type === "attack") {
        if (side === "p") {
          if (game.canAttack("p", uid)) {
            selection = { type: "attack", uid };
            const targets = game.attackTargets("p", uid);
            pointer = targetAnchor(targets) || pointer;
            updateSelection(targets);
          } else clearSelection();
        } else
          act(() =>
            game.dispatch({
              type: "attack",
              side: "p",
              uid: sel.uid,
              target: { side, uid },
            }),
          );
      } else if (sel.type === "power")
        act(() =>
          game.dispatch({ type: "power", side: "p", target: { side, uid } }),
        );
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
    const power = game.powerDefinition("p");
    if (power.target) {
      selection = { type: "power" };
      const targets = game.targets(power.target, "p");
      pointer = targetAnchor(targets) || pointer;
      hint(power.power + " · " + power.powerText);
      updateSelection(targets);
    } else act(() => game.dispatch({ type: "power", side: "p" }));
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
      } else targets = game.targets(game.powerDefinition("p").target, "p");
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
        EmberAudio.fx("select");
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
        game.dispatch({
          type: "play",
          side: "p",
          uid: d.uid,
          target: { side: el.dataset.side, uid: el.dataset.uid },
        }),
      );
    else if (c.target) {
      if (
        c.type === "minion" &&
        game.targets(c.target, "p").length === 0 &&
        p.y < 720
      )
        act(() => game.dispatch({ type: "play", side: "p", uid: d.uid }));
      else if (p.y < 730) selectCard(d.uid);
    } else if (p.y < 730 && p.x > 270 && p.x < 1330)
      act(() => game.dispatch({ type: "play", side: "p", uid: d.uid }));
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
          if (game.s.choice?.side === "e")
            game.dispatch({ type: "choose", cid: game.s.choice.cards[0] });
          else game.dispatch({ type: "end", side: "e" });
        }
      },
      settings.fast ? 240 : 720,
    );
  }
  function handleEvents(events) {
    for (const e of events) {
      if (e.type === "secret")
        toast((D.byId[e.cid]?.name || "奥秘") + "触发。");
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
          game.dispatch({ type: "choose", cid: id });
        }),
    );
  }
  function showResult() {
    if (!inBattle || game.s.phase !== "over") return;
    const s = game.s,
      win = s.winner === "p",
      last = s.bossIndex === D.bosses.length - 1 || s.mode === "practice";
    clearSelection();
    showModal(
      `<section class="modal-box result-box" data-outcome="${win ? "win" : "loss"}"><div class="result-sigil">${A.icon(win ? "fire" : "skull")}</div><div class="result-sub">${win ? (last ? "THE LAST EMBER BURNS" : "ENCOUNTER CLEARED") : s.winner === "draw" ? "A SHARED FATE" : "THE FLAME WILL RISE AGAIN"}</div><h2 class="result-title">${win ? (last ? "余火不灭" : "战役告捷") : s.winner === "draw" ? "同归于尽" : "火种未熄"}</h2><p class="boss-quote">${win ? (last ? "最后一颗星辰，因你重新燃起。" : "「" + D.bosses[s.bossIndex].name + "」已被击败。") : "每一次陨落，都是下一次重燃的序章。"}</p><div class="result-stats"><div><strong>${s.turn}</strong><span>战斗回合</span></div><div><strong>${s.stats.played}</strong><span>打出卡牌</span></div><div><strong>${s.stats.damage}</strong><span>造成伤害</span></div></div><div class="modal-footer"><button class="ghost-btn" id="result-home">返回营地</button><button class="gold-btn" id="result-next">${isDemo ? "开启正式旅程" : win ? (last ? "新的旅程" : "选择遗物") : "重试本关"} ${A.icon("arrow")}</button></div></section>`,
      "result",
      true,
    );
    if (s.mode === "practice") {
      $("modal").querySelector(".result-title").textContent = win
        ? "对战胜利"
        : s.winner === "draw"
          ? "平局"
          : "对战落败";
      $("modal").querySelector(".boss-quote").textContent =
        "调整卡组或更换对手，再试一次。战役存档未被覆盖。";
      $("result-next").textContent = "再选一局";
    }
    $("result-home").onclick = home;
    $("result-next").onclick = () => {
      if (isDemo || s.mode === "practice") {
        closeModal(false);
        showHeroes();
      } else if (win && !last) showRewards();
      else if (win) {
        home();
        showHeroes();
      } else {
        closeModal(false);
        startGame(s.heroId, s.bossIndex, s.relics, s.customDeck, {
          contracts: s.p.contracts,
          ...(s.mode === "practice" ? { opponent: s.opponent } : {}),
        });
      }
    };
  }
  function showRewards() {
    const s = game.s;
    game.rewardOffers();
    save();
    let selected = null;
    showModal(
      `<section class="modal-box rewards-box"><div class="modal-heading"><div class="eyebrow">战役奖励</div><h2>选择你的遗物</h2><p>${s.rewardOffers.length ? "获得一件永久加持，带着它继续冒险。" : "已收集全部遗物，可整备牌组后继续冒险。"}</p></div><div class="relic-options" role="group" aria-label="可选遗物">${s.rewardOffers
        .map((id) => {
          const r = D.relics.find((r) => r.id === id);
          return `<button class="relic-choice" data-relic="${id}" aria-pressed="false"><span class="relic-art"><img src="${A.relic(r.id)}" alt="${r.name}"></span><h3>${r.name}</h3><p>${r.text}</p><span class="relic-pick-label">选择此遗物</span></button>`;
        })
        .join(
          "",
        )}</div><details class="campaign-refit"><summary>酒馆整备 <span>可选 · 更换一张牌</span></summary><div class="refit-fields"><label>移除卡牌<select id="refit-remove" class="library-search"><option value="">保留原牌组</option>${[...new Set(s.customDeck || D.heroes.find((h) => h.id === s.heroId).deck)].map((id) => `<option value="${id}">${D.byId[id].name}</option>`).join("")}</select></label><label>加入卡牌<select id="refit-add" class="library-search" aria-label="补给卡牌">${D.cards
        .filter((c) => EmberDeckRules.canInclude(D, c, s.heroId))
        .map((c) => `<option value="${c.id}">${c.cost}费 · ${c.name}</option>`)
        .join(
          "",
        )}</select></label></div><p id="refit-status" role="status">${EmberDeckRules.summary(D)}。</p></details><div class="reward-footer"><div><span class="reward-next">下一站 · ${D.bosses[s.bossIndex + 1].title}</span><p id="reward-selection" aria-live="polite">${s.rewardOffers.length ? "先选择一件遗物" : "遗物已集齐"}</p></div><button class="gold-btn" id="reward-confirm" ${s.rewardOffers.length ? "disabled" : ""}>继续冒险</button></div></section>`,
      "rewards",
      true,
    );
    document.querySelectorAll("[data-relic]").forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.relic;
          document
            .querySelectorAll("[data-relic]")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          $("reward-selection").textContent =
            "已选择 · " + D.relics.find((r) => r.id === selected).name;
          $("reward-confirm").disabled = false;
        }),
    );
    $("reward-confirm").onclick = () => {
      if (!selected && s.rewardOffers.length) return;
      const deck = [
        ...(s.customDeck || D.heroes.find((h) => h.id === s.heroId).deck),
      ];
      const remove = $("refit-remove").value,
        add = $("refit-add").value;
      if (remove) deck[deck.indexOf(remove)] = add;
      if (!game.validateDeck(deck, s.heroId)) {
        document.querySelector(".campaign-refit").open = true;
        $("refit-status").textContent = EmberDeckRules.check(
          D,
          deck,
          s.heroId,
        ).errors.join("；");
        $("refit-add").focus();
        return;
      }
      startGame(
        s.heroId,
        s.bossIndex + 1,
        selected ? [...s.relics, selected] : [...s.relics],
        deck,
        { contracts: s.p.contracts },
      );
    };
  }
  function showSettings() {
    showModal(
      `<section class="modal-box settings-box"><div class="modal-heading"><div class="eyebrow">游戏设置</div><h2>旅途设置</h2></div>${[
        ["sound", "开启声音", "卡牌、战斗音效与酒馆底声"],
        ["reduced", "减弱动态效果", "减少粒子与镜头震动，保留战斗提示"],
        ["low", "轻量画质", "降低画面负担，适合节能游玩"],
        ["fast", "加速敌方行动", "缩短 AI 每次行动之间的间隔"],
      ]
        .map(
          ([k, n, d]) =>
            `<div class="setting-row"><div><h3>${n}</h3><p>${d}</p></div><button class="toggle ${settings[k] ? "on" : ""}" data-setting="${k}" role="switch" aria-checked="${settings[k]}" aria-label="${n}"></button></div>`,
        )
        .join("")}<div class="audio-sliders">${[
        ["volume", "总音量"],
        ["sfxVolume", "战斗与操作"],
        ["ambienceVolume", "酒馆氛围"],
      ]
        .map(
          ([k, label]) =>
            `<label class="audio-level" for="audio-${k}"><span>${label}</span><input id="audio-${k}" data-audio-level="${k}" type="range" min="0" max="100" step="5" value="${Math.round((Number.isFinite(settings[k]) ? Math.max(0, Math.min(1, settings[k])) : defaults[k]) * 100)}"><output for="audio-${k}">${Math.round((Number.isFinite(settings[k]) ? Math.max(0, Math.min(1, settings[k])) : defaults[k]) * 100)}%</output></label>`,
        )
        .join(
          "",
        )}</div><div class="modal-footer">${inBattle ? '<button class="ghost-btn small-btn" id="settings-home">返回营地</button><button class="ghost-btn small-btn" id="restart-battle">重试本关</button>' : '<button class="ghost-btn small-btn" id="settings-how">游戏玩法</button>'}<button class="gold-btn small-btn" id="settings-done">完成</button></div><p class="hero-deck-note">进度自动保存在当前浏览器。</p></section>`,
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
    document.querySelectorAll("[data-audio-level]").forEach((input) => {
      input.oninput = () => {
        settings[input.dataset.audioLevel] = Number(input.value) / 100;
        input.nextElementSibling.textContent = input.value + "%";
        EmberAudio.configure(settings);
        writeStore(SETTINGS, settings);
      };
      input.onchange = () => EmberAudio.fx("ui");
    });
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
              : startGame(s.heroId, s.bossIndex, s.relics, s.customDeck, {
                  contracts: s.p.contracts,
                  ...(s.mode === "practice" ? { opponent: s.opponent } : {}),
                });
          },
          "重试本关",
        );
    } else $("settings-how").onclick = showHelp;
  }
  function showHelp() {
    showModal(
      `<section class="modal-box help-box"><div class="modal-heading"><div class="eyebrow">玩法与规则</div><h2>旅人手册</h2><p>回合流程、构筑规则与关键词速查。</p></div><div class="help-columns"><div><section class="help-section"><h3>01 · 一场战斗如何获胜</h3><p>将敌方英雄生命降至 <b>0</b>。你有 <b>30 点基础生命、${D.deckRules.size} 张牌库</b>，双方最多拥有 <b>7 个随从、10 张手牌</b>。战役中你先手；练习对战随机先后手。先手起始三张、后手四张并在换牌后获得硬币。每个回合增加一枚法力水晶，上限 10，并补满法力、抽一张牌。</p></section><section class="help-section"><h3>02 · 出牌与攻击</h3><p><b>点击手牌</b>即可打出；需要目标时，再点击相应角色。也可以拖动卡牌。<br><b>点击己方随从 → 点击敌人</b>即可攻击。新召唤的随从通常需要等待一回合。双方随从同时对彼此造成攻击力数值的伤害。装备武器后，点击自己的英雄攻击。<br>按按钮标示的法力费用使用英雄技能，每回合一次。空格结束回合，Esc 取消选择，M 静音。</p></section><section class="help-section"><h3>03 · 构筑与冒险</h3><p>图鉴中 ${D.cards.filter((c) => !c.token).length} 张卡全部开放，构筑使用所选职业与中立牌。${D.archetypes.length} 套预设分别提供打法说明。<b>${EmberDeckRules.summary(D)}</b>。${D.bosses.length} 位首领均在半血时进入第二阶段。每次胜利可更换一张牌并选择遗物，下一关生命完全恢复。练习对战可挑战 ${D.archetypes.length} 套牌，随机先后手、双方三十血，不覆盖战役进度。进度自动保存在当前浏览器。<br>牌库耗尽后，每次抽牌依次受到 <b>1、2、3…</b> 点疲劳伤害。第 51 个玩家回合开始时判为平局。</p></section></div><div><section class="help-section"><h3>04 · 关键词速查</h3><div class="key-table">${Object.entries(
        keywords,
      )
        .map(([k, v]) => `<div><b>${D.kw[k]}</b>${v}</div>`)
        .join(
          "",
        )}<div><b>战吼 / 亡语</b>分别在从手牌打出或契约召唤随从时、随从死亡后触发。</div><div><b>冻结 / 沉默</b>冻结阻止攻击，直到自己的回合结束。沉默移除关键词、亡语和增益。</div><div><b>奥秘</b>隐藏的触发式法术。镜像伏击会用嘲讽镜卫拦截一次对英雄的攻击。</div><div><b>契约 / 神祇</b>开局可额外携带三张同职业契约、至多一位神祇，不占主牌组。己方非衍生随从死亡积累阵亡数和同名唯一的灵魂印记。星焰神需施放不同名称的非衍生法术（被反制不计）；曙日神需圣盾被敌方伤害击破；荒猎神需野兽主动攻击敌方随从（每回合最多计两次）。打开「诸神契约」查看双方进度，按各自条件支付法力或灵魂印记唤醒，每张每局一次。神祇无法复生，降临当回合不能攻击英雄。</div><div><b>发现</b>从三个随机法术中选一张加入手牌。</div></div></section></div></div><div class="modal-footer"><button class="gold-btn small-btn" id="help-done">让冒险开始 ${A.icon("arrow")}</button></div></section>`,
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
  function syncEndTurn(s = game.s) {
    if (!s) return;
    const resolving = EmberFX.busy;
    $("end-turn").disabled =
      resolving || s.phase !== "battle" || s.active !== "p" || !!s.choice;
    $("end-turn").textContent =
      s.phase === "over"
        ? "战斗结束"
        : resolving
          ? "结算中…"
          : s.active === "p"
            ? "结束回合"
            : "敌方回合";
  }
  document.addEventListener("ember:fx-busy", () => syncEndTurn());
  $("end-turn").onclick = () =>
    act(() => game.dispatch({ type: "end", side: "p" }));
  $("arena").onclick = () => clearSelection();
  document.addEventListener("pointerdown", () => EmberAudio.unlock(), {
    passive: true,
  });
  document.addEventListener("keydown", () => EmberAudio.unlock(), {
    capture: true,
  });
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      if (
        !button ||
        button.disabled ||
        button.closest(
          ".hand-card,.minion,.hero,#power-btn,#end-turn,#sound-btn,[data-setting='sound']",
        )
      )
        return;
      EmberAudio.fx("ui");
    },
    { capture: true },
  );
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
  $("lobby-art").src = A.card(D.byId.ashdragon);
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
    game: game.view(),
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
  if (
    ["127.0.0.1", "localhost"].includes(location.hostname) &&
    new URLSearchParams(location.search).get("debug") === "1"
  )
    window.EmberDebug = Object.freeze({ game });
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
