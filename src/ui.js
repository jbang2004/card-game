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
    suppressTimer = null,
    suppressClick = false;
  let pointer = { x: 800, y: 470 };
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
  const screenContext = {
    game, deckStore, library, showModal, closeModal, toast, save, startGame,
    home, demo, clearSelection, showConfirm, applySettings, writeStore, settings, defaults,
    keywords, showHeroes, showHelp,
    get chosenHero() { return chosenHero; },
    set chosenHero(value) { chosenHero = value; },
    get isDemo() { return isDemo; },
    get inBattle() { return inBattle; },
  };
  const screens = Object.freeze({
    heroes: EmberHeroScreens.create(screenContext),
    campaign: EmberCampaignScreens.create(screenContext),
    preferences: EmberPreferenceScreens.create(screenContext),
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
  let actionGuide = { text: "", mode: null };
  function clearFeedbackMarks() {
    document
      .querySelectorAll("#hand .hand-card.feedback-error,#hand .hand-card.feedback-info")
      .forEach((el) => el.classList.remove("feedback-error", "feedback-info"));
    document.querySelector(".mana-panel")?.classList.remove("feedback-error");
  }
  function localRect(el) {
    const point = EmberViewport.pos(el);
    return point
      ? {
          left: point.left,
          top: point.top,
          w: point.w,
          h: point.h,
          right: point.left + point.w,
          bottom: point.top + point.h,
        }
      : null;
  }
  function setGuide(text, mode = "target") {
    hideBattleNotice();
    actionGuide = { text, mode };
    const hint = $("hint"),
      bar = $("touch-target-bar"),
      label = $("touch-target-text");
    if (hint) hint.textContent = text;
    if (label) {
      label.textContent = text;
      label.setAttribute("aria-label", text);
    }
    if (bar) {
      bar.dataset.mode = mode;
      bar.setAttribute("aria-label", text);
      bar.hidden = !EmberViewport.mobile;
    }
    app.classList.toggle("placement-active", mode === "placement");
  }
  function clearGuide() {
    actionGuide = { text: "", mode: null };
    const hint = $("hint"),
      bar = $("touch-target-bar");
    if (hint) hint.textContent = "";
    if (bar) {
      bar.hidden = true;
      bar.removeAttribute("data-mode");
      bar.removeAttribute("aria-label");
    }
    app.classList.remove("placement-active");
    clearActionCue();
  }
  function clearActionCue() {
    const svg = $("target-lines");
    if (!svg) return;
    svg.style.display = "none";
    svg.removeAttribute("data-mode");
  }
  function drawActionCue(from, to, mode = "target") {
    const svg = $("target-lines");
    if (!svg || !from || !to) {
      clearActionCue();
      return;
    }
    const dx = to.x - from.x,
      dy = to.y - from.y,
      len = Math.hypot(dx, dy);
    if (len < 12) {
      clearActionCue();
      return;
    }
    const bend =
        mode === "placement"
          ? Math.min(EmberViewport.mobile ? 26 : 58, len * 0.14)
          : Math.min(EmberViewport.mobile ? 18 : 34, len * 0.07),
      nx = -dy / len,
      ny = dx / len,
      c1 = {
        x: from.x + dx * 0.33 + nx * bend,
        y: from.y + dy * 0.33 + ny * bend,
      },
      c2 = {
        x: from.x + dx * 0.66 + nx * bend,
        y: from.y + dy * 0.66 + ny * bend,
      };
    svg.dataset.mode = mode;
    svg.style.display = "block";
    $("target-path").setAttribute(
      "d",
      `M${from.x},${from.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`,
    );
    const angle = Math.atan2(to.y - c2.y, to.x - c2.x),
      tip = mode === "placement" ? (EmberViewport.mobile ? 10 : 15) : EmberViewport.mobile ? 9 : 13,
      wing = tip * 0.55,
      ux = Math.cos(angle),
      uy = Math.sin(angle);
    $("target-arrow").setAttribute(
      "d",
      `M${to.x},${to.y} L${to.x - tip * ux - wing * uy},${to.y - tip * uy + wing * ux} L${to.x - tip * ux + wing * uy},${to.y - tip * uy - wing * ux} Z`,
    );
    $("target-circle").setAttribute("cx", to.x);
    $("target-circle").setAttribute("cy", to.y);
    $("target-circle").setAttribute(
      "r",
      mode === "placement"
        ? EmberViewport.mobile
          ? "18"
          : "24"
        : EmberViewport.mobile
          ? "10"
          : "12",
    );
  }
  function placementAnchor(pointerTarget = null) {
    const arena = localRect($("arena"));
    if (!arena) return null;
    const margin = EmberViewport.mobile ? 26 : 72,
      hand = localRect($("hand")),
      minY = arena.top + arena.h * 0.5,
      maxY = Math.min(
        arena.bottom - margin,
        hand ? hand.top - margin : arena.bottom - margin,
      ),
      board = game.s?.p?.board || [],
      count = board.length,
      lane = EmberViewport.lane("p");
    let candidate = pointerTarget || null;
    if (!candidate) {
      if (!count) {
        candidate = lane;
      } else if (count < 7) {
        /* Anchor from the live group edge, not from the lane midpoint. The
         * board recenters after a summon, but the current edge is the only
         * point we can guarantee is actually empty before the click. */
        const first = EmberViewport.minion("p", 0, count),
          last = EmberViewport.minion("p", count - 1, count),
          nudge = EmberViewport.mobile ? 18 : 28,
          right = last.x + last.w + nudge,
          left = first.x - nudge;
        candidate = {
          x: right <= arena.right - margin ? right : left,
          y: last.y + last.h / 2,
        };
      } else {
        /* A full board has no legal minion slot. Keep the cue in the lower
         * play lane instead of pointing at an occupied center card. */
        candidate = {
          x: arena.right - margin,
          y: lane.y,
        };
      }
    }
    return {
      x: Math.max(arena.left + margin, Math.min(arena.right - margin, candidate.x)),
      y: Math.max(minY, Math.min(maxY, candidate.y)),
    };
  }
  function updatePlacementCue(pointerTarget = null) {
    if (!selection || selection.type !== "card-play") return;
    const from = centerOf(sourceCard(selection.uid)),
      to = placementAnchor(pointerTarget);
    drawActionCue(from, to, "placement");
  }
  function sourceCard(uid) {
    return uid
      ? [...document.querySelectorAll("#hand .hand-card")].find(
          (el) => el.dataset.hand === uid,
        )
      : null;
  }
  function positionBattleNotice(text, sourceUid, mana) {
    const notice = $("toast");
    if (!notice) return;
    const anchor = localRect(sourceCard(sourceUid)) ||
      (mana && localRect(document.querySelector(".mana-panel"))) ||
      null,
      width = Math.min(
        280,
        Math.max(154, 34 + [...String(text)].length * 13),
      );
    // Measure wrapped copy in the active theme before anchoring above a card.
    notice.style.width = width + "px";
    const height = notice.offsetHeight || 38;
    const rail = EmberViewport.mobile ? EmberViewport.layout.notice : {x:25,y:510,w:222};
    let x = rail.x, y = rail.y;
    if (!anchor) {
      Object.assign(notice.style, {left:rail.x+'px', top:rail.y+'px',width:rail.w+'px'});
      return;
    }
    if (anchor) {
      x = anchor.left + (anchor.w - width) / 2;
      y = anchor.top - height - 10;
      if (y < 48) y = anchor.bottom + 10;
    }
    x = Math.max(14, Math.min(EmberViewport.width - width - 14, x));
    y = Math.max(44, Math.min(EmberViewport.height - height - 14, y));
    Object.assign(notice.style, {
      left: Math.round(x) + "px",
      top: Math.round(y) + "px",
      width: width + "px",
    });
  }
  function hideBattleNotice() {
    clearTimeout(toastTimer);
    clearFeedbackMarks();
    const notice = $("toast");
    notice?.classList.remove("visible");
    notice?.removeAttribute("data-kind");
  }
  function showBattleNotice(
    text,
    { kind = "error", sourceUid = null, mana = false, duration = 2200 } = {},
  ) {
    const notice = $("toast");
    if (!notice) return;
    clearTimeout(toastTimer);
    clearFeedbackMarks();
    notice.textContent = text;
    notice.dataset.kind = kind;
    notice.classList.add("visible");
    positionBattleNotice(text, sourceUid, mana);
    sourceCard(sourceUid)?.classList.add(
      kind === "info" ? "feedback-info" : "feedback-error",
    );
    if (mana && kind !== "info")
      document.querySelector(".mana-panel")?.classList.add("feedback-error");
    toastTimer = setTimeout(hideBattleNotice, duration);
  }
  function toast(text, options = {}) {
    if (inBattle) {
      showBattleNotice(text, {
        kind: options.kind || "error",
        sourceUid: options.sourceUid || null,
        mana: !!options.mana,
        duration: options.duration ?? 2200,
      });
      return;
    }
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
      closeCardDetail();
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
    clearTimeout(aiTimer);
    closeCardDetail();
    hidePreview();
    clearSelection();
    lastFocus = document.activeElement;
    modalType = type;
    $("modal").dataset.type = type;
    $("modal").innerHTML = html;
    EmberTheme.bind($("modal"));
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
  function showHeroes(...args) { return screens.heroes.showHeroes(...args); }
  function showMulligan(...args) { return screens.heroes.showMulligan(...args); }
  function centerOf(el) {
    return EmberViewport.pos(el);
  }
  function findUnit(side, uid) {
    return uid === "hero"
      ? $(side === "p" ? "player-hero" : "enemy-hero")
      : document.querySelector(`.minion[data-uid="${uid}"]`);
  }
  function captureCardOrigin(ref) {
    if (!ref?.side || !ref.uid) return null;
    const el =
      ref.el ||
      (ref.side === "p"
        ? [...document.querySelectorAll("#hand .hand-card")].find(
            (node) => node.dataset.hand === ref.uid,
          )
        : [...document.querySelectorAll("#enemy-hand .card-back")].find(
            (node) => node.dataset.enemyHand === ref.uid,
          ));
    const point = ref.point || centerOf(el);
    const computed = el ? getComputedStyle(el) : null;
    let poseScale = 1,
      poseTilt = 0;
    const transform = computed?.transform;
    if (transform && transform !== "none") {
      const values = transform.startsWith("matrix3d(")
        ? transform
            .slice(9, -1)
            .split(",")
            .map(Number)
        : transform
            .slice(transform.startsWith("matrix(") ? 7 : 0, -1)
            .split(",")
            .map(Number);
      if (values.length >= 6) {
        const a = values[0],
          b = values[1],
          c = values[2],
          d = values[3];
        poseScale = Math.max(0.01, (Math.hypot(a, b) + Math.hypot(c, d)) / 2);
        poseTilt = (Math.atan2(b, a) * 180) / Math.PI;
      }
    }
    const customTilt = ref.tilt ?? computed?.getPropertyValue("--r");
    if (customTilt != null && customTilt !== "") {
      const parsed = Number.parseFloat(customTilt);
      if (Number.isFinite(parsed)) poseTilt = parsed;
    }
    // offsetWidth/offsetHeight are the untransformed border-box dimensions in
    // #app's local coordinate system. Do not multiply them by the viewport
    // scale: the motion proxy is also positioned in those local coordinates
    // and the parent transform applies the desktop scale exactly once.
    const layoutW = el ? el.offsetWidth || null : null,
      layoutH = el ? el.offsetHeight || null : null,
      baseW = layoutW || (point?.w ? point.w / poseScale : null),
      baseH = layoutH || (point?.h ? point.h / poseScale : null);
    const snapshot = {
      side: ref.side,
      uid: ref.uid,
      point: point
        ? {
            x: point.x,
            y: point.y,
            w: point.w,
            h: point.h,
            left: point.left,
            top: point.top,
            baseW,
            baseH,
            poseScale,
            poseTilt,
          }
        : null,
      size: point ? { w: baseW || point.w, h: baseH || point.h } : null,
      tilt: ref.tilt ?? poseTilt,
      scale: ref.scale ?? poseScale,
      alreadyLifted: !!ref.alreadyLifted,
      html: ref.html || el?.outerHTML || null,
    };
    return snapshot.point ? snapshot : { ...snapshot, point: null };
  }
  let pendingCardOrigin = null;
  let displayedState = null;
  function changed(s, events) {
    const cardOrigin = pendingCardOrigin;
    pendingCardOrigin = null;
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
      { cardOrigin },
    );
  }
  function render(s) {
    if (!s) return;
    // Capture animated card surfaces before innerHTML replaces their nodes.
    // The compositor can then continue a rebind from the painted pose instead
    // of trying to measure a detached element after this render completes.
    EmberFX.captureCardTargets?.();
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
          `<div class="card-back" data-enemy-hand="${c.uid}" style="--r:${(i - (s.e.hand.length - 1) / 2) * 5}deg;--y:${Math.abs(i - (s.e.hand.length - 1) / 2) * 3}px"></div>`,
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
            return `<button class="minion ${side === "e" ? "enemy" : "friendly"} ${m.tags.join(" ")} ${ready ? "ready" : ""} ${m.frozen ? "frozen" : ""} ${c.rarity}" style="left:${x}px;top:${y}px;width:${geo.w}px;height:${geo.h}px;--unit-w:${geo.w}px" data-compact="${geo.w < 50}" data-side="${side}" data-uid="${m.uid}" data-cardid="${c.id}" aria-label="${c.name}，攻击 ${m.atk}，生命 ${m.hp}，${m.tags.map((t) => D.kw[t]).join("、")}${m.frozen ? "，被冻结" : ""}"><div class="minion-art"><img src="${A.card(c)}" alt="" draggable="false" data-art-key="${artKeyForCard(c)}" data-portrait-mode="board" data-portrait-instance="${side}:${m.uid}" data-portrait-state="${m.frozen ? "frozen" : "idle"}" style="${artStyleForCard(c, "minion")}"></div><span class="unit-aura" aria-hidden="true"></span><div class="minion-name">${c.name}</div><span class="stat atk">${A.badgeFrame("blade")}<span class="stat-value">${m.atk}</span></span><span class="stat hp ${m.hp < m.maxHp ? "hurt" : ""}">${A.badgeFrame("heart")}<span class="stat-value">${Math.max(0, m.hp)}</span></span><span class="minion-status">${m.frozen ? "❄" : specials ? '<span class="special">' + specials + "</span>" : m.sick && !ready ? '<span class="sleep">z z</span>' : ""}</span>${ready ? '<span class="ready-dot"></span>' : ""}</button>`;
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
    const gap = metrics.step;
    $("hand").innerHTML = s.p.hand
      .map((card, i) => {
        const c = D.byId[card.cid],
          offset = i - (s.p.hand.length - 1) / 2,
          playable = !game.legalCard("p", card.uid);
        return `<button class="hand-card ${playable ? "playable" : ""} ${game.cost(card) > s.p.mana ? "unaffordable" : ""}" style="--x:${offset * gap}px;--y:${0}px;--r:${0}deg;--i:${i + 1}" data-hand="${card.uid}" data-cardid="${c.id}" aria-label="${c.name}，${game.cost(card)} 法力。点按选中，拖动出牌。${c.text}">${cardHTML(c, { cost: game.cost(card) })}</button>`;
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
      el.addEventListener("focus", () => preview(el.dataset.cardid, el));
      el.addEventListener("blur", hidePreview);
    });
    document.querySelectorAll(".hand-card").forEach((el) => {
      el.onclick = () => {
        if (suppressClick) {
          suppressClick = false;
          window.EmberMobile?.consumedClick?.();
          return;
        }
        if (EmberViewport.mobile && window.EmberMobile)
          EmberMobile.handClick(el.dataset.hand);
        else selectCard(el.dataset.hand);
      };
      const magnify = () => preview(el.dataset.cardid, el);
      el.addEventListener("mouseenter", magnify);
      el.addEventListener("mouseleave", hidePreview);
      el.addEventListener("focus", magnify);
      el.addEventListener("blur", hidePreview);
      el.addEventListener("pointerdown", beginDrag);
    });
    document.querySelectorAll("#battle .hero").forEach((el) => {
      el.addEventListener("mouseenter", () => preview(el.dataset.cardid, el));
      el.addEventListener("mouseleave", hidePreview);
    });
    updateHandTip();
    if (EmberViewport.mobile) $("hand").scrollLeft = handScroll;
    window.EmberMobile?.afterRender(s);
    updateSelection();
    EmberPortraits.sync();
    // Rendering can replace card nodes while a presentation sequence is
    // between beats. Let the compositor rebind its visual track immediately,
    // so the next frame continues from the painted pose instead of replaying a
    // template entrance.
    EmberFX.syncCardTargets?.();
  }
  function updateHandTip() {
    const tip = document.querySelector(".hand-tip");
    if (tip && !EmberViewport.mobile)
      tip.textContent = "拖到战场出牌 · 点按选中/瞄准 · 悬停看大图";
  }
  /* One detail layer for every input: hover (mouse), keyboard focus, right
   * click and touch long-press all magnify the same card. Nothing else is
   * drawn around it, and any click dismisses a pinned card. */
  const detail = { source: null, pinned: false };
  let lastHit = null;
  function pointerPoint(e) {
    const r = app.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * EmberViewport.width) / r.width,
      y: ((e.clientY - r.top) * EmberViewport.height) / r.height,
    };
  }
  function localPoint(e) {
    return e instanceof Event ? pointerPoint(e) : e;
  }
  function showCardDetail(cid, opts = {}) {
    /* Accepts a card ID or a card record, so every caller can pass what it has. */
    const c = typeof cid === "string" ? D.byId[cid] : cid;
    if (!c?.art) return;
    const el = $("card-preview");
    const pinned = !!opts.pinned;
    /* A pinned detail must live above the app's transformed/filtered canvas.
     * Returning it to #app for hover keeps the old left-side placement intact. */
    if (pinned && el.parentElement !== document.body) document.body.append(el);
    if (!pinned && el.parentElement !== app) app.append(el);
    el.innerHTML = cardHTML(
      c,
      opts.atk === undefined && opts.hp === undefined && opts.cost === undefined
        ? {}
        : { atk: opts.atk, hp: opts.hp, cost: opts.cost },
    );
    detail.source = opts.source || null;
    detail.pinned = pinned;
    el.dataset.mode = pinned ? "pinned" : "hover";
    el.setAttribute("aria-hidden", String(!pinned));
    el.classList.remove("open");
    el.style.display = "block";
    document.body.classList.toggle("has-card-detail", detail.pinned);
    /* Next frame, so the magnify transition always plays from the small state. */
    requestAnimationFrame(() => {
      el.classList.add("open");
    });
    if (!detail.pinned) placeHoverDetail();
  }
  /* Desktop battle hover is deliberately fixed on the left, restoring one
   * stable reading position instead of duplicating the card over the hand. */
  function placeHoverDetail() {
    const el = $("card-preview"),
      source = detail.source;
    if (!source || detail.pinned || el.style.display === "none") return;
    if (modalType !== "library") {
      el.style.left = "29px";
      el.style.top = "345px";
      el.style.zIndex = "45";
      return;
    }
    /* Library hover remains contextual because it has no battle hand to anchor
     * against; this does not affect the single-card battle detail path. */
    const pos = centerOf(source),
      w = el.offsetWidth || 219,
      h = el.offsetHeight || 318,
      handTop =
        modalType === "library"
          ? EmberViewport.height
          : ($("hand")?.getBoundingClientRect().top ??
            app.getBoundingClientRect().top + 753);
    const top = Math.max(8, handTop - h - 6);
    el.style.left = Math.min(Math.max(pos.x - w / 2, 8), 1600 - w - 8) + "px";
    el.style.top = top + "px";
  }
  function closeCardDetail() {
    if (!detail.pinned) return;
    clearTimeout(previewTimer);
    detail.pinned = false;
    detail.source = null;
    document.body.classList.remove("has-card-detail");
    const el = $("card-preview");
    el.classList.remove("open");
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
    delete el.dataset.mode;
    if (el.parentElement !== app) app.append(el);
  }
  function preview(cid, el) {
    clearTimeout(previewTimer);
    if (EmberViewport.mobile || detail.pinned) return;
    if (drag?.started) return;
    previewTimer = setTimeout(() => {
      if (!el.isConnected) return;
      let actual = null;
      if (el.dataset.uid)
        actual = game.s[el.dataset.side]?.board.find(
          (m) => m.uid === el.dataset.uid,
        );
      showCardDetail(cid, {
        source: el,
        atk: actual?.atk,
        hp: actual?.hp,
      });
    }, 180);
  }
  function hidePreview() {
    clearTimeout(previewTimer);
    if (detail.pinned) return;
    detail.source = null;
    document.body.classList.remove("has-card-detail");
    const el = $("card-preview");
    el.classList.remove("open");
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
  }
  function inspectBattleCard(el) {
    if (!el?.dataset.cardid) return false;
    const c = D.byId[el.dataset.cardid];
    if (!c) return false;
    const side = el.dataset.side,
      unit = side
        ? game.s[side]?.board.find((m) => m.uid === el.dataset.uid)
        : null,
      hand = el.dataset.hand
        ? game.s.p.hand.find((v) => v.uid === el.dataset.hand)
        : null;
    showCardDetail(c.id, {
      pinned: true,
      ...(unit ? { atk: unit.atk, hp: unit.hp } : {}),
      ...(hand ? { cost: game.cost(hand) } : {}),
    });
    return true;
  }
  /* Touch devices keep right-click as a compatibility gesture alongside long
   * press. Desktop already has a persistent left-side hover preview, so a
   * secondary click only suppresses the browser menu and opens nothing. */
  document.addEventListener(
    "contextmenu",
    (e) => {
      if (e.target.closest?.("#card-preview")) {
        if (detail.pinned) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      const el = e.target.closest?.("#battle [data-cardid]");
      if (!el || modalType || EmberFX.busy) return;
      /* Hand cards use long-press as a lift-to-drag gesture on touch. Their
       * secondary action must not reopen the full-screen detail layer. */
      if (el.matches(".hand-card")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!EmberViewport.mobile) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!inspectBattleCard(el)) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  /* The unit under a screen point, ignoring overlay chrome such as the pinned
   * detail veil, which must never swallow a release or a reticle hit test. */
  function unitAt(x, y) {
    return (
      document
        .elementsFromPoint(x, y)
        .map((n) => n.closest?.("[data-uid]"))
        .find((n) => n && n.closest("#battle")) || null
    );
  }
  function hitUnit() {
    return unitAt(pointer.x, pointer.y);
  }
  /* Aim cue: retarget the line to what is actually under the finger, and give
   * a short tick when the aim crosses onto a valid target. */
  function targetCue() {
    if (!selection) return;
    if (selection.type === "card-play") {
      document
        .querySelectorAll(".aim-focus")
        .forEach((el) => el.classList.remove("aim-focus"));
      const hit = hitUnit();
      updatePlacementCue(!hit && inPlayArea(pointer) ? pointer : null);
      return;
    }
    const hit = hitUnit(),
      uid = hit?.dataset?.uid || null,
      side = hit?.dataset?.side || null,
      unit = hit ? findUnit(side, uid) : null;
    if (unit) pointer = centerOf(unit) || pointer;
    const valid = !!unit?.classList.contains("valid-target"),
      key = uid ? side + ":" + uid : null;
    if (key !== lastHit) {
      lastHit = key;
      if (valid) EmberAudio.fx("select");
    }
    document.querySelectorAll(".aim-focus").forEach((el) => {
      if (el !== unit) el.classList.remove("aim-focus");
    });
    unit?.classList.add("aim-focus");
    updateTargetLine();
  }
  document.addEventListener(
    "mousemove",
    (e) => {
      pointer = localPoint(e);
      if (selection) targetCue();
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      pointer = pointerPoint(t);
      if (selection) targetCue();
    },
    { passive: true },
  );
  /* Click suppression lives here; mobile-ui and the drag paths both arm it. */
  function suppressNextClick(ms) {
    suppressClick = true;
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => (suppressClick = false), ms);
  }
  function clickSuppressed() {
    return suppressClick;
  }
  document.addEventListener(
    "click",
    (e) => {
      if (!detail.pinned) return;
      /* A long press or a drag already handled this tap: keep the detail open
       * and let the owner of that gesture swallow the compatibility click. */
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      /* The card is the detail itself; only the empty veil dismisses it. */
      if (e.target.closest?.("#card-preview")) return;
      closeCardDetail();
      /* Dismissal must not fall through to the board or a hand card. */
      e.preventDefault();
      e.stopPropagation();
      suppressNextClick(60);
    },
    true,
  );
  function act(fn, origin = null) {
    if (EmberFX.busy) return { ok: false, error: "战斗动作正在结算" };
    hideBattleNotice();
    const previousOrigin = pendingCardOrigin;
    const selectedOrigin =
      origin ||
      (selection?.type === "card" || selection?.type === "card-play"
        ? { side: "p", uid: selection.uid }
        : null);
    // A successful drag already carries an immutable geometry/markup snapshot.
    // Do not reinterpret its ghost through the live hand node a second time.
    const capturedOrigin =
      origin?.point && origin.html
        ? origin
        : captureCardOrigin(selectedOrigin);
    hidePreview();
    clearSelection();
    pendingCardOrigin = capturedOrigin;
    let r;
    try {
      r = fn();
    } finally {
      pendingCardOrigin = previousOrigin;
    }
    if (!r?.ok) {
      EmberAudio.fx("error");
      toast(r?.error || "无法执行此操作", {
        sourceUid: capturedOrigin?.uid || origin?.uid || null,
      });
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
  function targetLabel(target) {
    if (target === "friendlyMinion") return "一个友方随从";
    if (target === "enemyMinion") return "一个敌方随从";
    if (target === "anyMinion") return "一个随从";
    return "一个目标";
  }
  /* Enter targeting state for a hand card. Shared by tap/click and by every
   * path that ends a drag, so the reticle and the target rail never diverge. */
  function armCard(uid) {
    const card = game.s.p.hand.find((x) => x.uid === uid);
    if (!card) return false;
    const c = D.byId[card.cid],
      targets = c.target ? game.targets(c.target, "p") : [];
    if (!c.target || !targets.length) return false;
    selection = { type: "card", uid, cid: card.cid };
    pointer = targetAnchor(targets) || pointer;
    setGuide("选择" + targetLabel(c.target) + " · 右键或 ESC 取消", "target");
    updateSelection(targets);
    hidePreview();
    return true;
  }
  function prepareCard(uid) {
    const card = game.s.p.hand.find((x) => x.uid === uid);
    if (!card) return false;
    selection = { type: "card-play", uid, cid: card.cid };
    setGuide("点击战场空位确认 · 再点手牌取消", "placement");
    updateSelection();
    hidePreview();
    EmberAudio.fx("select");
    return true;
  }
  function selectCard(uid) {
    if (!inBattle || modalType || EmberFX.busy) return;
    if (selection?.type === "card-play" && selection.uid === uid) {
      clearSelection();
      return;
    }
    const card = game.s.p.hand.find((x) => x.uid === uid),
      err = game.legalCard("p", uid);
    if (err) {
      EmberAudio.fx("error");
      const mana = err === "法力不足",
        message =
          mana && card
            ? `法力不足 · 需要 ${game.cost(card)} 点，当前 ${game.s.p.mana} 点`
            : err;
      toast(message, { sourceUid: uid, mana });
      return;
    }
    const c = card && D.byId[card.cid];
    if (armCard(uid)) return EmberAudio.fx("select");
    if (c && !c.target) return prepareCard(uid);
    return act(
      () => game.dispatch({ type: "play", side: "p", uid }),
      { side: "p", uid },
    );
  }
  function clickUnit(side, uid) {
    if (modalType || !inBattle || EmberFX.busy) return;
    if (selection) {
      const sel = selection;
      if (sel.type === "card-play") {
        toast("请点击战场空位确认，或点手牌取消", {
          sourceUid: sel.uid,
        });
        return;
      }
      if (
        EmberViewport.mobile &&
        side === "e" &&
        !findUnit(side, uid)?.classList.contains("valid-target")
      ) {
        toast("请点击高亮的合法目标", { sourceUid: sel.uid });
        return;
      }
      if (sel.type === "card")
        act(
          () =>
            game.dispatch({
              type: "play",
              side: "p",
              uid: sel.uid,
              target: { side, uid },
            }),
          { side: "p", uid: sel.uid },
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
        setGuide("选择攻击目标 · 嘲讽随从优先 · ESC 取消", "target");
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
  /* Show one board object as an enlarged card. Touch long-press and the end
   * of a touch drag both land here; tapping still means "act", not "inspect". */
  function inspect(side, uid) {
    if (!side || !uid || !window.EmberMobile) return;
    if (uid === "hero") window.EmberMobile.inspectHero(side);
    else window.EmberMobile.inspectMinion(side, uid);
  }
  function usePower() {
    if ($("power-btn").disabled || EmberFX.busy) return;
    const power = game.powerDefinition("p");
    if (power.target) {
      selection = { type: "power" };
      const targets = game.targets(power.target, "p");
      pointer = targetAnchor(targets) || pointer;
      setGuide(power.power + " · " + power.powerText, "target");
      updateSelection(targets);
    } else act(() => game.dispatch({ type: "power", side: "p" }));
  }
  function clearSelection() {
    app.classList.remove("is-targeting");
    selection = null;
    lastHit = null;
    document
      .querySelectorAll(".aim-focus")
      .forEach((el) => el.classList.remove("aim-focus"));
    $("combat-preview").style.display = "none";
    clearGuide();
    hideBattleNotice();
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
      } else if (selection.type === "card-play") {
        document
          .querySelector(`[data-hand="${selection.uid}"]`)
          ?.classList.add("selected");
      } else targets = game.targets(game.powerDefinition("p").target, "p");
    }
    if (selection.type === "attack")
      findUnit("p", selection.uid)?.classList.add("selected");
    else if (selection.type === "card" || selection.type === "card-play")
      document
        .querySelector(`[data-hand="${selection.uid}"]`)
        ?.classList.add("selected");
    targets.forEach((t) =>
      findUnit(t.side, t.uid)?.classList.add("valid-target"),
    );
    if (EmberViewport.mobile) {
      app.classList.add("is-targeting");
      window.EmberMobile?.selectionChanged();
    }
    setGuide(
      actionGuide.text ||
        (selection.type === "card-play" ? "点击战场空位确认" : "选择目标"),
      actionGuide.mode || (selection.type === "card-play" ? "placement" : "target"),
    );
    if (selection.type === "card-play") updatePlacementCue();
    else updateTargetLine();
  }
  function updateTargetLine() {
    if (!selection || modalType || selection.type === "card-play") {
      clearActionCue();
      return;
    }
    const source =
      selection.type === "attack"
        ? findUnit("p", selection.uid)
        : selection.type === "power"
          ? $("power-btn")
          : document.querySelector(`[data-hand="${selection.uid}"]`);
    const from = centerOf(source);
    if (!from) {
      clearActionCue();
      return;
    }
    drawActionCue(from, pointer, "target");
  }
  function dropZone() {
    if (!EmberViewport.mobile) return { x0: 270, x1: 1330, y1: 730 };
    const a = EmberViewport.layout?.arena;
    if (!a) return { x0: 0, x1: EmberViewport.width, y1: 0 };
    const h = $("hand")?.getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    /* The hand rail overlays the bottom of the arena on short screens; a
     * release there is a cancel, not a play. */
    const handTop = h && h.height ? h.top - appRect.top : Infinity;
    return { x0: a.x, x1: a.x + a.w, y1: Math.min(a.y + a.h, handTop - 4) };
  }
  function inPlayArea(p) {
    const z = dropZone();
    return p.x >= z.x0 && p.x <= z.x1 && p.y >= 0 && p.y <= z.y1;
  }
  /* The drag ghost and the release path share one landing decision. A card
   * only snaps when releasing there would be meaningful: on a legal target,
   * or on an unoccupied point in the play area. */
  function dragLanding(d, e, p) {
    const c = D.byId[d.cid],
      el = unitAt(e.clientX, e.clientY),
      uid = el?.dataset?.uid,
      side = el?.dataset?.side;
    const legalTarget =
      uid && side && c?.target
        ? game.targets(c.target, "p").some(
            (t) => t.side === side && t.uid === uid,
          )
        : false;
    if (el && legalTarget)
      return { kind: "target", point: centerOf(el) || p };
    if (el && c?.target) return null;
    if (el && c?.type !== "weapon") return null;
    if (inPlayArea(p)) return { kind: "board", point: p };
    return null;
  }
  function updateDragVisual(d, p, landing) {
    if (!d.ghost) return;
    const kind = landing?.kind || null,
      changed = kind !== d.snapKind;
    d.snapKind = kind;
    d.ghost.classList.toggle("is-snapped", !!kind);
    if (kind) {
      d.ghost.dataset.snapMode = kind;
      d.ghost.style.left = landing.point.x + "px";
      d.ghost.style.top = landing.point.y + "px";
      if (changed) {
        EmberAudio.fx("select");
        if (!D.byId[d.cid].target)
          setGuide("松手落位 · 拖回手牌取消", "placement");
      }
    } else {
      delete d.ghost.dataset.snapMode;
      d.ghost.style.left = p.x + "px";
      d.ghost.style.top = p.y - (d.lift || 0) + "px";
      if (changed && !D.byId[d.cid].target)
        setGuide("将卡牌拖入战场 · 松回手牌取消", "placement");
    }
  }
  function cancelDrag(restore = true) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.timer) clearTimeout(d.timer);
    d.ghost?.remove();
    d.el?.classList.remove("drag-source", "drag-armed");
    clearSelection();
    if (restore) d.el?.focus({ preventScroll: true });
  }

  function startDrag(d, touch = d?.touch) {
    if (!d || d.started || d.horizontal) return;
    if (d.timer) {
      clearTimeout(d.timer);
      d.timer = null;
    }
    d.started = true;
    d.snapKind = null;
    EmberAudio.fx("select");
    clearSelection();
    hidePreview();
    d.el.classList.add("drag-source");
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    // Clone the rendered card surface, not the base definition: temporary
    // cost/attack/health modifiers must remain visible during the drag and
    // in the subsequent card-motion proxy.
    ghost.innerHTML =
      d.el.querySelector(".card")?.outerHTML || cardHTML(D.byId[d.cid]);
    app.appendChild(ghost);
    d.ghost = ghost;
    if (touch) d.lift = 58;
    ghost.style.left = d.x + "px";
    ghost.style.top = d.y - (d.lift || 0) + "px";
    const c = D.byId[d.cid];
    if (c.target) {
      selection = { type: "card", uid: d.uid, cid: d.cid };
      updateSelection();
    } else setGuide("将卡牌拖入战场 · 松回手牌取消", "placement");
  }

  /* Ends a drag started by beginDrag. Rejected releases never dispatch: a card
   * only leaves the hand when the drop is legal (unit -> legal target, or
   * anywhere in the play area for a card that needs no target). */
  function finishDrag(d, e) {
    const source = d.ghost || d.el;
    const origin = captureCardOrigin({
      side: "p",
      uid: d.uid,
      el: source,
      point: centerOf(source),
      alreadyLifted: !!d.ghost,
    });
    /* The ghost and the source dimming always end with the gesture. */
    d.ghost?.remove();
    d.el.classList.remove("drag-source");
    const p = localPoint(e),
      c = D.byId[d.cid],
      el = unitAt(e.clientX, e.clientY),
      landing = dragLanding(d, e, p),
      uid = el?.dataset?.uid,
      side = el?.dataset?.side;
    if (landing?.kind === "target") {
      act(
        () =>
          game.dispatch({
            type: "play",
            side: "p",
            uid: d.uid,
            target: { side, uid },
          }),
        origin,
      );
    } else if (el && c.target) {
      /* Released on a unit that is not in game.targets(): never dispatch. */
      EmberAudio.fx("error");
      toast("「" + c.name + "」不能指定这个目标", { sourceUid: d.uid });
    } else if (el && c.type !== "weapon") {
      /* A targetless minion or spell dropped on top of a unit is ambiguous
       * placement, not a play: reject it instead of silently spending mana. */
      EmberAudio.fx("error");
      toast("「" + c.name + "」不需要目标 · 请放到空位或战场下方", {
        sourceUid: d.uid,
      });
    } else if (inPlayArea(p)) {
      if (
        c.target &&
        !(c.type === "minion" && !game.targets(c.target, "p").length)
      )
        armCard(d.uid);
      else
        act(
          () => game.dispatch({ type: "play", side: "p", uid: d.uid }),
          origin,
        );
    } else if (EmberViewport.mobile) {
      EmberAudio.fx("ui");
      toast("已取消：「" + c.name + "」回到手牌", {
        kind: "info",
        duration: 1600,
        sourceUid: d.uid,
      });
    }
  }
  function beginDrag(e) {
    if (e.button !== 0 || modalType || EmberFX.busy) return;
    if (
      !inBattle ||
      !game.s?.p ||
      game.s.active !== "p" ||
      game.s.phase !== "battle"
    )
      return;
    const el = e.currentTarget,
      uid = el.dataset.hand;
    if (game.legalCard("p", uid)) return;
    const p = localPoint(e);
    drag = {
      uid,
      cid: el.dataset.cardid,
      x: p.x,
      y: p.y,
      sx: e.clientX,
      sy: e.clientY,
      el,
      started: false,
      touch: e.pointerType === "touch",
      horizontal: false,
      timer: null,
      pointerId: e.pointerId,
      snapKind: null,
    };
    if (drag.touch)
      drag.timer = setTimeout(() => {
        if (drag?.pointerId === e.pointerId && !drag.horizontal)
          startDrag(drag, true);
      }, 440);
  }
  /* The browser owns horizontal rail panning. A card only becomes a drag
   * after vertical intent or a stationary long press, so scroll and play no
   * longer compete for the same gesture. */
  document.addEventListener(
    "pointermove",
    (e) => {
      const touch = EmberViewport.mobile && e.pointerType === "touch";
      if (!touch) {
        pointer = localPoint(e);
        if (selection && !drag?.started) targetCue();
        else if (selection) updateTargetLine();
      }
      if (!drag) return;
      const p = localPoint(e);
      if (!drag.started) {
        const dx = e.clientX - drag.sx,
          dy = e.clientY - drag.sy;
        if (
          touch &&
          Math.abs(dx) > 10 &&
          Math.abs(dx) > Math.abs(dy) + 4
        ) {
          drag.horizontal = true;
          if (drag.timer) {
            clearTimeout(drag.timer);
            drag.timer = null;
          }
          return;
        }
        if (touch && drag.horizontal) return;
        const intent = touch
          ? dy < -14 &&
            -dy > Math.abs(dx) + 6 &&
            !drag.horizontal
          : Math.hypot(p.x - drag.x, p.y - drag.y) > 12;
        if (!intent) return;
        startDrag(drag, touch);
      }
      if (drag.started) {
        e.preventDefault();
        pointer = p;
        if (selection) {
          if (touch) updateTargetLine();
          else targetCue();
        }
        const landing = dragLanding(drag, e, p);
        if (landing?.kind === "target") pointer = landing.point;
        updateDragVisual(drag, p, landing);
        if (selection && touch) updateTargetLine();
      }
    },
    { passive: false },
  );
  document.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.timer) clearTimeout(d.timer);
    if (!d.started) return;
    const landing = unitAt(e.clientX, e.clientY);
    finishDrag(d, e);
    /* A completed touch drag must not be replayed as a tap by the
     * compatibility click (mobile-ui owns that suppressor). */
    if (EmberViewport.mobile) window.EmberMobile?.dragEnded?.();
    suppressNextClick(320);
    if (landing) inspect(landing.dataset.side, landing.dataset.uid);
    suppressNextClick(80);
  });
  document.addEventListener("pointercancel", () => cancelDrag(false));
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
  function showDiscover(...args) { return screens.campaign.showDiscover(...args); }
  function showResult(...args) { return screens.campaign.showResult(...args); }
  function showRewards(...args) { return screens.campaign.showRewards(...args); }
  function showSettings(...args) { return screens.preferences.showSettings(...args); }
  function showHelp(...args) { return screens.preferences.showHelp(...args); }
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
  $("arena").onclick = () => {
    if (selection?.type === "card-play") {
      const uid = selection.uid;
      act(
        () => game.dispatch({ type: "play", side: "p", uid }),
        { side: "p", uid },
      );
    } else clearSelection();
  };
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
      if (drag) cancelDrag(false);
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
    showCardDetail,
    suppressNextClick,
    clickSuppressed,
    closeCardDetail,
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
    get actionGuide() {
      return actionGuide.text;
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
    cancelDrag(false);
    clearSelection();
    hidePreview();
    EmberFX.reflow();
    if (game.s) render(game.s);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      save();
      cancelDrag(false);
      clearSelection();
    }
  });
})();
