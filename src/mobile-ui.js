/* POCKET ATELIER — touch controller. Uses the original guarded actions and
 * rules engine. Inspecting, scrolling and orientation changes never spend mana.
 */
(() => {
  "use strict";
  const E = window.Emberfall,
    D = EmberData,
    A = EmberArt,
    V = EmberViewport,
    F = EmberFX;
  const $ = (id) => document.getElementById(id),
    app = $("app");
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let longPress = null,
    suppressUntil = 0,
    lastGesture = null;
  function blocked() {
    return !E.inBattle || F.busy;
  }
  /* Tap selects a card (or arms targeting); only a second board action or a
   * drag commits a targetless play, so an accidental tap cannot spend mana. */
  function handClick(uid) {
    if (blocked() || E.modal) return;
    const card = E.game.s.p.hand.find((x) => x.uid === uid);
    if (!card) return;
    E.selectCard(uid);
  }
  function showHand() {
    if (blocked() || E.modal) return;
    const s = E.game.s;
    E.showModal(
      `<section class="modal-box"><div class="modal-heading"><div class="eyebrow">${s.p.hand.length} 张手牌 · 长按扶起并拖出</div><h2>手牌总览</h2></div><div class="touch-hand-grid">${s.p.hand.map((v) => `<button data-touch-hand="${v.uid}" aria-label="查看 ${D.byId[v.cid].name}">${E.cardHTML(D.byId[v.cid], { cost: E.game.cost(v) })}</button>`).join("") || "<p>手牌暂时为空，下回合会再抽一张。</p>"}</div></section>`,
      "touch-hand",
    );
    document
      .querySelectorAll("[data-touch-hand]")
      .forEach((b) => (b.onclick = () => showHandDetail(b.dataset.touchHand)));
  }
  function showHandDetail(uid) {
    const card = E.game.s.p.hand.find((x) => x.uid === uid);
    if (card)
      E.showCardDetail(card.cid, { pinned: true, cost: E.game.cost(card) });
  }
  function inspectMinion(side, uid) {
    if (blocked()) return;
    const m = E.game.s[side].board.find((x) => x.uid === uid);
    if (!m) return;
    E.showCardDetail(m.cid, { pinned: true, atk: m.atk, hp: m.hp });
  }
  function inspectHero(side = "p", power = false) {
    if (blocked()) return;
    const s = E.game.s,
      p = s[side],
      d =
        side === "p"
          ? D.heroes.find((h) => h.id === s.heroId)
          : D.bosses[s.bossIndex];
    const usable = side === "p" && !$("power-btn").disabled,
      canAttack = side === "p" && E.game.canAttack("p", "hero");
    E.showModal(
      `<section class="modal-box"><div class="modal-heading"><div class="eyebrow">${side === "p" ? "我方英雄" : "敌方情报"}</div><h2>${esc(power ? d.power : d.name)}</h2></div><div class="touch-hero-info"><img src="${A.character(d)}" alt="${esc(d.name)}"><div><div class="touch-live-stat">${p.hp} / ${p.maxHp} 生命${p.armor ? " · " + p.armor + " 护甲" : ""}</div><p><b>${esc(d.power)}</b><br>${esc(d.powerText)}</p>${side === "e" ? `<p>${s.phase2 ? "已进入第二阶段" : "半血时觉醒"}<br>${esc(d.phaseText)}</p>` : p.weapon ? `<p>${D.byId[p.weapon.cid].name} · ${p.weapon.atk} 攻 / ${p.weapon.durability} 耐久</p>` : ""}</div></div><div class="modal-footer"><button id="touch-hero-close" class="ghost-btn">回到战场</button>${usable ? `<button id="touch-hero-power" class="gold-btn">英雄技能 · ${d.powerCost} 法力</button>` : canAttack ? '<button id="touch-hero-attack" class="gold-btn">武器攻击</button>' : ""}</div></section>`,
      "touch-hero",
    );
    $("touch-hero-close").onclick = () => E.closeModal();
    if ($("touch-hero-power"))
      $("touch-hero-power").onclick = () => {
        E.closeModal(false);
        E.usePower();
      };
    if ($("touch-hero-attack"))
      $("touch-hero-attack").onclick = () => {
        E.closeModal(false);
        E.clickUnit("p", "hero");
      };
  }
  function tapUnit(side, uid) {
    if (blocked() || E.modal) return;
    if (E.selection) {
      if (E.selection.type === "card-play") {
        E.toast("请点击战场空位确认，或点手牌取消", {
          sourceUid: E.selection.uid,
        });
        return;
      }
      if (
        E.selection.type === "attack" &&
        side === "p" &&
        E.selection.uid === uid
      ) {
        E.clearSelection();
        return;
      }
      const el =
        uid === "hero"
          ? $(side === "p" ? "player-hero" : "enemy-hero")
          : document.querySelector(`#battle [data-uid="${uid}"]`);
      if (
        !(E.selection.type === "attack" && side === "p") &&
        !el?.classList.contains("valid-target")
      ) {
        E.toast("请点击高亮目标，或按“取消”重新选择", {
          sourceUid: E.selection.uid,
        });
        return;
      }
      E.clickUnit(side, uid);
      return;
    }
    if (side === "p" && E.game.canAttack("p", uid)) E.clickUnit(side, uid);
    else if (uid === "hero") inspectHero(side);
    else inspectMinion(side, uid);
  }
  function selectionChanged() {
    if (!V.mobile || !E.selection) return;
    if (E.actionGuide) {
      $("touch-target-text").textContent = E.actionGuide;
      return;
    }
    const sel = E.selection;
    $("touch-target-text").textContent =
      sel.type === "card-play"
        ? "点击战场确认"
        : sel.type === "attack"
          ? "选择攻击目标"
          : "选择目标";
  }
  /* Called by the controller after a touch drag settles, so the compatibility
   * click that follows the pointerup never re-opens the card sheet. */
  function dragEnded() {
    suppressUntil = performance.now() + 400;
  }
  /* Called by card detail dismissal: a long press or drag already consumed this
   * tap, so it must not also close the magnified card or replay the action. */
  function consumedClick() {
    lastGesture = null;
    suppressUntil = 0;
  }
  function showLog() {
    if (blocked()) return;
    E.showModal(
      `<section class="modal-box"><div class="modal-heading"><h2>战斗记录</h2></div><div class="touch-log">${E.game.s.log
        .slice(-24)
        .reverse()
        .map((l) => `<p>${esc(l)}</p>`)
        .join("")}</div></section>`,
      "touch-log",
    );
  }
  function showMenu() {
    if (F.busy) return;
    const opts = [
      ["map", "map", "冒险地图"],
      ["cards", "book", "卡牌收藏"],
      ["guide", "book", "玩法手册"],
      ["gallery", "gem", "工匠画廊"],
      ["settings", "settings", "设置"],
    ];
    if (E.inBattle)
      opts.push(
        ["journal", "book", "战斗记录"],
        ["boss", "skull", "首领情报"],
        ["home", "arrow", "返回酒馆"],
      );
    opts.push(["full", "full", "全屏"]);
    E.showModal(
      `<section class="modal-box"><div class="modal-heading"><h2>菜单</h2></div><div class="touch-menu-grid">${opts.map(([id, icon, label]) => `<button data-touch-menu="${id}">${A.icon(icon)}<span>${label}</span></button>`).join("")}</div></section>`,
      "touch-menu",
    );
    const fn = {
      map: () => E.showMap(),
      cards: () => E.showLibrary(),
      guide: () => E.showHelp(),
      gallery: () => E.showAtelier(),
      settings: () => E.showSettings(),
      journal: showLog,
      boss: () => inspectHero("e"),
      home: () => E.home(),
      full: () => {
        $("fullscreen-btn").click();
      },
    };
    document.querySelectorAll("[data-touch-menu]").forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.touchMenu;
          E.closeModal(false);
          fn[k]?.();
          if (k === "full") E.closeModal();
        }),
    );
  }
  function syncDeck(n) {
    const b = $("touch-deck-tab");
    if (b) b.textContent = `我的牌组 · ${n}/${D.deckRules.size}`;
  }
  function afterRender(s) {
    if (!V.mobile || !s) return;
    const b = D.bosses[s.bossIndex];
    $("touch-match-chip").innerHTML =
      `<small>第 ${s.bossIndex + 1} 战</small><strong>${esc(b.name)}</strong><span>${s.phase2 ? "第二阶段 · 已觉醒" : "第一阶段"} · ${s.e.hand.length} 手牌</span>`;
    $("turn-number").textContent =
      (s.active === "p" ? "你的回合" : "敌方回合") + " · " + s.turn;
    $("hand").setAttribute(
      "aria-label",
      `你的 ${s.p.hand.length} 张手牌，左右滑动，点按选中，拖动出牌，长按扶起拖动`,
    );
    const tip = document.querySelector(".hand-tip");
    if (tip) tip.textContent = "左右滑动 · 点按选中 · 拖动出牌";
    const p = V.layout.player,
      wslot = $("weapon-slot"),
      beside = V.portrait && V.layout.power.x - (p.x + p.w) > 36;
    V.box(wslot, {
      x: beside ? p.x + p.w + 6 : p.x - 8,
      y: p.y + (beside ? 36 : 18),
      w: 30,
      h: 34,
    });
    const arrow = $("target-arrow");
    arrow?.setAttribute("aria-hidden", "true");
    selectionChanged();
  }
  // Touch discovery lives in the compact header; secondary controls open a menu.
  const collection = document.createElement("button");
  collection.className = "icon-btn touch-only";
  collection.id = "touch-collection";
  collection.setAttribute("aria-label", "卡牌收藏");
  collection.innerHTML = A.icon("book");
  collection.onclick = () => {
    if (!F.busy) E.showLibrary();
  };
  document.querySelector(".top-actions").prepend(collection);
  const menu = document.createElement("button");
  menu.className = "icon-btn touch-only";
  menu.id = "touch-menu";
  menu.setAttribute("aria-label", "打开菜单");
  menu.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="8" cy="6" r="1" fill="currentColor"/></svg>';
  menu.onclick = showMenu;
  document.querySelector(".top-actions").append(menu);
  $("touch-cancel").onclick = () => E.clearSelection();
  // No pointer capture on the hand: the controller owns card drags and pans.
  // Track motion to suppress a compatibility click even on permissive click slop.
  function stopLong() {
    if (longPress) {
      clearTimeout(longPress.timer);
      longPress = null;
    }
  }
  document.addEventListener(
    "pointerdown",
    (ev) => {
      if (!V.mobile || ev.isPrimary === false) return;
      suppressUntil = 0;
      lastGesture = {
        x: ev.clientX,
        y: ev.clientY,
        moved: false,
        id: ev.pointerId,
        target: ev.target,
      };
      stopLong();
      const el = ev.target.closest?.(
        "#battle .minion,#battle .hero,#power-btn,.library-item",
      );
      if (!el || F.busy || (E.modal && E.modal !== "library")) return;
      longPress = {
        el,
        id: ev.pointerId,
        x: ev.clientX,
        y: ev.clientY,
        timer: setTimeout(() => {
          longPress = null;
          /* While aiming, a hold must not steal the target confirmation. */
          if (E.selection) return;
          /* The long press swallows the tap it grew out of: without this the
           * compatibility click would immediately close the card it opened. */
          E.suppressNextClick?.(450);
          suppressUntil = performance.now() + 850;
          if (el.matches(".hand-card")) {
            const card = E.game.s.p.hand.find((x) => x.uid === el.dataset.hand);
            if (card)
              E.showCardDetail(card.cid, {
                pinned: true,
                cost: E.game.cost(card),
              });
          } else if (el.id === "power-btn") inspectHero("p", true);
          else if (el.dataset.uid === "hero") inspectHero(el.dataset.side);
          else inspectMinion(el.dataset.side, el.dataset.uid);
        }, 440),
      };
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "pointermove",
    (ev) => {
      if (
        lastGesture &&
        ev.pointerId === lastGesture.id &&
        Math.hypot(ev.clientX - lastGesture.x, ev.clientY - lastGesture.y) > 9
      ) {
        lastGesture.moved = true;
        stopLong();
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener("pointerup", stopLong, {
    capture: true,
    passive: true,
  });
  document.addEventListener(
    "pointercancel",
    () => {
      stopLong();
      if (lastGesture) lastGesture.moved = true;
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "click",
    (ev) => {
      if (!V.mobile) return;
      const moved =
        lastGesture?.moved &&
        lastGesture.target?.closest?.(
          "#hand,.library-grid,.deck-list,.touch-hand-grid",
        );
      if (performance.now() < suppressUntil || moved) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        lastGesture = null;
        suppressUntil = 0;
        return;
      }
      lastGesture = null;
    },
    true,
  );
  document.addEventListener(
    "contextmenu",
    (ev) => {
      if (
        V.mobile &&
        ev.target.closest?.("#battle,.library-item,.touch-hand-grid")
      )
        ev.preventDefault();
    },
    true,
  );
  window.addEventListener("ember:viewport", () => {
    stopLong();
    lastGesture = null;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLong();
      lastGesture = null;
    }
  });
  window.EmberMobile = {
    handClick,
    tapUnit,
    dragEnded,
    consumedClick,
    showHand,
    showHandDetail,
    inspectMinion,
    inspectHero,
    afterRender,
    selectionChanged,
    syncDeck,
    showMenu,
  };
  document.title = "烬域 · 鎏金酒馆";
  document.querySelector(".lobby-copy>.eyebrow").textContent = "诸神同辉";
  document.querySelector(".lobby-bottom small").textContent = "烬域 · 鎏金酒馆";
  const prev = V.mobile;
  V.resize();
  if (prev && E.game.s) afterRender(E.game.s);
  window.PocketDiagnostics = {
    version: "0.5.0",
    get mode() {
      return V.mobile
        ? V.portrait
          ? "mobile-portrait"
          : "mobile-landscape"
        : "desktop";
    },
    get viewport() {
      return { width: V.width, height: V.height };
    },
    get coordinatePlane() {
      return V.mobile ? "CSS pixels" : "1600×940";
    },
    input: "tap-inspect-confirm / native hand scroll / long-press details",
  };
})();
