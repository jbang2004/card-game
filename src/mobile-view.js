/* Responsive interaction plane. Desktop keeps its 1600×940 optical canvas.
 * Touch/small displays use CSS pixels, NOT a scaled-down desktop page.
 * All hit tests, effect origins and controls share these coordinates.
 */
const EmberViewport = (() => {
  "use strict";
  const app = document.getElementById("app");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.appendChild(probe);
  let state = {
    mobile: false,
    portrait: false,
    width: 1600,
    height: 940,
    scale: 1,
    layout: {},
    signature: "",
  };
  let queued = false;
  function resize() {
    const vv = window.visualViewport;
    // Do not fight browser pinch-to-zoom by laying out a narrower page on every pinch.
    if (vv && vv.scale > 1.05) return false;
    const rawW = Math.round(vv?.width || innerWidth),
      rawH = Math.round(vv?.height || innerHeight);
    const touch =
      matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
    /* A 1600-wide optical canvas becomes illegible before the old 1200px
       breakpoint.  Treat narrow mouse windows as a dedicated command layout,
       rather than letterboxing a scaled desktop table. */
    const compactDesktop =
      !touch &&
      (rawW < 1360 || rawH < 700) &&
      app.classList.contains("battle-view");
    const mobile = rawW < 1200 || compactDesktop || (touch && rawW < 1366);
    const portrait = mobile && rawH >= rawW;
    const css = getComputedStyle(probe);
    const safe = {
      top: parseFloat(css.paddingTop) || 0,
      right: parseFloat(css.paddingRight) || 0,
      bottom: parseFloat(css.paddingBottom) || 0,
      left: parseFloat(css.paddingLeft) || 0,
    };
    const W = mobile ? rawW : 1600,
      H = mobile ? rawH : 940;
    const scale = mobile ? 1 : Math.min(rawW / 1600, rawH / 940);
    const signature = [
      mobile,
      compactDesktop,
      portrait,
      W,
      H,
      rawW,
      rawH,
      ...Object.values(safe),
    ].join(":");
    document.body.classList.toggle("mobile-ui", mobile);
    document.body.classList.toggle("touch-layout", mobile);
    document.body.classList.toggle("compact-desktop", compactDesktop);
    document.body.classList.toggle("mobile-portrait", portrait);
    document.body.classList.toggle("mobile-landscape", mobile && !portrait);
    app.style.setProperty("--scale", scale);
    app.style.setProperty("--view-w", rawW + "px");
    app.style.setProperty("--view-h", rawH + "px");
    app.style.setProperty("--view-top", (vv?.offsetTop || 0) + "px");
    app.style.setProperty("--view-left", (vv?.offsetLeft || 0) + "px");
    if (signature === state.signature) return false;
    const l = {};
    if (mobile) {
      const padL = safe.left + 12,
        padR = safe.right + 12,
        usableW = W - padL - padR;
      l.header = safe.top + (portrait ? 52 : 44);
      // Preserve the established card rail and physical card sizes.
      const handH = portrait
        ? H >= 720
          ? 204
          : H >= 600
            ? 184
            : 166
        : H >= 380
          ? Math.round(clamp(H * 0.36, 138, 176))
          : 138;
      l.hand = {
        x: padL - 4,
        y: H - safe.bottom - handH - 6,
        w: usableW + 8,
        h: handH,
      };
      const cardH = portrait ? handH - 12 : handH - 10,
        cardW = Math.round((cardH * 5) / 7.4),
        shortLandscape = !portrait && H < 420;
      if (portrait) {
        const short = H < 650;
        const heroH = cardH,
          heroW = cardW;
        l.enemy = {
          x: W / 2 - heroW / 2,
          y: l.header + (short ? 4 : 10),
          w: heroW,
          h: heroH,
        };
        /* The readout row above the hand (`l.handLabel` on the left, `l.mana`
         * on the right) starts 28px above the hand. A 12px gap let the player
         * hero card reach into it, so the 手牌 chip sat across the card's
         * bottom edge; clear the whole row instead. */
        const playerY = l.hand.y - heroH - 28,
          ctrlY = l.hand.y - (short ? 106 : 126);
        l.player = {
          x: padL + 10,
          y: playerY,
          w: heroW,
          h: heroH,
        };
        l.power = { x: Math.round(W * 0.43), y: ctrlY + 18, w: 48, h: 48 };
        l.turn = {
          x: W - padR - 86,
          y: ctrlY + (short ? -10 : 2),
          w: 86,
          h: short ? 88 : 102,
        };
        l.mana = { x: W - padR - 150, y: l.hand.y - 23, w: 150, h: 22 };
        l.chip = {
          x: padL,
          y: l.enemy.y,
          w: Math.max(86, l.enemy.x - padL - 10),
          h: short ? 20 : 38,
        };
        l.contract = {
          x: padL,
          y: l.enemy.y + (short ? 24 : 44),
          w: Math.max(114, l.chip.w),
          h: 44,
        };
        /* The notice doubles as the targeting bar (`l.actionChip`), which
         * carries an instruction plus a 44px cancel button, so it wants the
         * whole rail. What it must not do is sit across the player's hero
         * card — and whether it would is a question of the screen's HEIGHT,
         * not its width: on a tall portrait the hero starts well below the
         * bar, on a short one it reaches up into it. Measure instead of
         * guessing from the width, and only fall back to the docked right
         * rail when the bar genuinely cannot clear the card. */
        const noticeY = Math.max(l.enemy.y + heroH, l.contract.y + 44) + 8;
        const noticeClearsHero = noticeY + 44 <= playerY;
        const noticeW = noticeClearsHero ? usableW : Math.min(180, usableW);
        l.notice = {
          x: noticeClearsHero ? padL : W - padR - noticeW,
          y: noticeY,
          w: noticeW,
          h: 44,
        };
        const top = l.notice.y + l.notice.h + 8;
        l.arena = {
          x: padL - 2,
          y: top,
          w: usableW + 4,
          h: Math.max(84, ctrlY - 12 - top),
        };
      } else {
        const rail = compactDesktop ? 128 : 104;
        const heroH = cardH,
          heroW = cardW;
        const railX = W - padR - rail;
        const leftRail = shortLandscape
          ? padL + heroW * 2 + 20
          : padL + heroW + 20;
        l.notice = {
          x: leftRail,
          y: l.header + 2,
          w: W - leftRail - padR - rail,
          h: 40,
        };
        const arenaTop = l.notice.y + l.notice.h + 6;
        l.arena = {
          x: leftRail,
          y: arenaTop,
          w: Math.max(120, l.notice.w),
          h: Math.max(90, l.hand.y - 14 - arenaTop),
        };
        if (shortLandscape) {
          const heroY = l.header + 4;
          l.enemy = { x: padL + 8, y: heroY, w: heroW, h: heroH };
          l.player = {
            x: padL + 16 + heroW,
            y: heroY,
            w: heroW,
            h: heroH,
          };
        } else {
          l.enemy = {
            x: padL + 8,
            y: l.header + 12,
            w: heroW,
            h: heroH,
          };
          l.player = {
            x: padL + 8,
            y: l.hand.y - heroH - 14,
            w: heroW,
            h: heroH,
          };
        }
        l.power = { x: railX, y: l.header + 10, w: 44, h: 44 };
        l.contract = { x: railX + rail - 48, y: l.power.y, w: 48, h: 44 };
        l.turn = {
          x: railX,
          y:
            H < 350 ? l.power.y + 56 : Math.max(l.power.y + 88, l.hand.y - 106),
          w: rail,
          h: 80,
        };
        l.mana = {
          x: railX,
          y: l.hand.y - (H < 350 ? 20 : 24),
          w: rail,
          h: H < 350 ? 20 : 22,
        };
        l.chip = { x: padL, y: l.header, w: 80, h: 20 };
      }
      l.round = {
        x: W / 2 - (portrait ? 50 : 110),
        y: safe.top + 6,
        w: portrait ? 100 : 220,
        h: portrait ? 34 : 30,
      };
      l.handLabel = { x: padL, y: l.hand.y - 28, w: 110, h: 24 };
      l.actionChip = { ...l.notice };
      /* The hand is the same physical card as every other card surface. Keep
       * its 5:7.4 face ratio and derive width from the available rail height;
       * independent width/height clamps were making the art aperture change
       * between the hand and the opening-hand dialog. */
      l.cardH = cardH;
      l.cardW = cardW;
    }
    const before = state;
    state = {
      mobile,
      portrait,
      width: W,
      height: H,
      scale,
      layout: l,
      safe,
      signature,
    };
    if (mobile) {
      for (const [key, value] of Object.entries(l.notice))
        app.style.setProperty("--notice-" + key, value + "px");
      const roots = {
        arena: l.arena,
        "enemy-hero": l.enemy,
        "player-hero": l.player,
        "power-btn": l.power,
        "contract-open": l.contract,
        hand: l.hand,
        "touch-target-bar": l.actionChip,
        "touch-match-chip": l.chip,
        "turn-number": l.round,
      };
      for (const [id, r] of Object.entries(roots))
        box(document.getElementById(id), r);
      box(document.querySelector(".turn-controls"), l.turn);
      box(document.querySelector(".mana-panel"), l.mana);
      box(document.querySelector(".hand-label"), l.handLabel);
      app.style.setProperty("--hand-card-w", l.cardW + "px");
      app.style.setProperty("--hand-card-h", l.cardH + "px");
      app.style.setProperty("--battle-card-w", l.cardW + "px");
      app.style.setProperty("--battle-card-h", l.cardH + "px");
      app.style.setProperty("--header-h", l.header + "px");
      app.style.setProperty(
        "--enemy-row-y",
        l.arena.y + l.arena.h * 0.25 + "px",
      );
      app.style.setProperty(
        "--player-row-y",
        l.arena.y + l.arena.h * 0.75 + "px",
      );
      const empty = document.getElementById("board-empty");
      box(empty, {
        x: l.arena.x + 16,
        y: l.arena.y + l.arena.h * 0.75 - 10,
        w: l.arena.w - 32,
        h: 24,
      });
    } else {
      for (const id of [
        "arena",
        "enemy-hero",
        "player-hero",
        "power-btn",
        "contract-open",
        "hand",
        "board-empty",
        "weapon-slot",
        "turn-number",
      ]) {
        const el = document.getElementById(id);
        if (el)
          for (const k of ["left", "top", "width", "height"])
            el.style.removeProperty(k);
      }
      for (const sel of [".turn-controls", ".mana-panel", ".hand-label"]) {
        const el = document.querySelector(sel);
        if (el)
          for (const k of ["left", "top", "width", "height"])
            el.style.removeProperty(k);
      }
    }
    const svg = document.getElementById("target-lines");
    svg?.setAttribute("viewBox", `0 0 ${W} ${H}`);
    window.dispatchEvent(
      new CustomEvent("ember:viewport", { detail: { before, after: state } }),
    );
    return true;
  }
  function box(el, r) {
    if (el && r)
      Object.assign(el.style, {
        left: r.x + "px",
        top: r.y + "px",
        width: r.w + "px",
        height: r.h + "px",
      });
  }
  function point(e) {
    const r = app.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * state.width) / r.width,
      y: ((e.clientY - r.top) * state.height) / r.height,
    };
  }
  function pos(el) {
    if (!el) return null;
    const a = app.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const sx = state.width / a.width,
      sy = state.height / a.height;
    return {
      x: (r.x + r.width / 2 - a.x) * sx,
      y: (r.y + r.height / 2 - a.y) * sy,
      w: r.width * sx,
      h: r.height * sy,
      left: (r.x - a.x) * sx,
      top: (r.y - a.y) * sy,
    };
  }
  function elementPosition(selector, fallback = null) {
    const el = document.querySelector(selector),
      measured = pos(el);
    return measured || fallback;
  }
  function deckAnchor(side) {
    const fallback =
        side === "p"
          ? {
              x: state.mobile ? state.width - 28 : 1137,
              y: state.mobile ? state.height - 92 : 723,
            }
          : {
              x: state.mobile ? 28 : 1137,
              y: state.mobile ? 86 : 182,
            },
      size = state.mobile ? { w: 78, h: 110 } : { w: 125, h: 178 };
    return elementPosition(side === "p" ? ".player-deck" : ".enemy-deck", {
      ...fallback,
      ...size,
      left: fallback.x - size.w / 2,
      top: fallback.y - size.h / 2,
    });
  }
  function intersectionStatus(el, region) {
    if (!el?.isConnected) return "absent";
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden")
      return "absent";
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return "absent";
    const viewport = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
    const clip = region || viewport;
    const left = Math.max(rect.left, viewport.left, clip.left),
      right = Math.min(rect.right, viewport.right, clip.right),
      top = Math.max(rect.top, viewport.top, clip.top),
      bottom = Math.min(rect.bottom, viewport.bottom, clip.bottom);
    if (right <= left || bottom <= top) return "clipped";
    const fullyVisible =
      rect.left >= clip.left &&
      rect.right <= clip.right &&
      rect.top >= clip.top &&
      rect.bottom <= clip.bottom &&
      rect.left >= viewport.left &&
      rect.right <= viewport.right &&
      rect.top >= viewport.top &&
      rect.bottom <= viewport.bottom;
    return fullyVisible ? "visible" : "clipped";
  }
  function handCardAnchor(side, uid) {
    const selector =
        side === "p" ? "#hand .hand-card" : "#enemy-hand .card-back",
      el = [...document.querySelectorAll(selector)].find(
        (node) =>
          (side === "p" ? node.dataset.hand : node.dataset.enemyHand) === uid,
      );
    if (!el) return null;
    const measured = pos(el);
    const hand = document.getElementById(side === "p" ? "hand" : "enemy-hand"),
      handRect = hand?.getBoundingClientRect(),
      status = intersectionStatus(el, handRect);
    if (!measured)
      return { el, visible: false, clipped: status === "clipped", status };
    return {
      ...measured,
      el,
      visible: status === "visible",
      clipped: status === "clipped",
      status,
      scrollLeft: hand?.scrollLeft || 0,
      scrollTop: hand?.scrollTop || 0,
    };
  }
  function minion(side, i, n) {
    if (!state.mobile)
      return {
        x: 800 + (i - (n - 1) / 2) * 132 - 58,
        y: side === "e" ? 222 : 386,
        w: 116,
        h: 146,
      };
    const a = state.layout.arena;
    const gap = n > 5 ? 3 : state.portrait ? 9 : 12;
    const maxW = state.portrait ? 76 : 70;
    // Short landscape uses wider portrait tokens, not tiny tall cards. Both
    // layout and hit testing consume these same measured dimensions.
    const compactLandscape = !state.portrait && state.height < 370;
    const availableH = a.h * 0.5 - (compactLandscape ? 4 : 14);
    const w = Math.floor(
      Math.min(
        maxW,
        (a.w - 16 - (n - 1) * gap) / Math.max(1, n),
        compactLandscape ? availableH * 1.25 : availableH / 1.18,
      ),
    );
    const h = compactLandscape
        ? Math.min(availableH, Math.round(w * 1.22))
        : Math.round(w * 1.22),
      total = n * w + (n - 1) * gap;
    return {
      x: a.x + (a.w - total) / 2 + i * (w + gap),
      y: a.y + a.h * (side === "e" ? 0.25 : 0.75) - h / 2,
      w,
      h,
    };
  }
  function minionLandingBox(frame, side, uid) {
    const board = frame?.[side]?.board || [],
      index = board.findIndex((m) => m.uid === uid);
    if (index < 0) return null;
    const r = minion(side, index, board.length);
    return {
      ...r,
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      left: r.x,
      top: r.y,
      visible: true,
    };
  }
  function fallback(s, side, uid) {
    if (state.mobile && uid === "hero") {
      const r = state.layout[side === "p" ? "player" : "enemy"];
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    if (uid === "hero") {
      const el = document.getElementById(
        side === "p" ? "player-hero" : "enemy-hero",
      );
      return {
        x: el.offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + el.offsetHeight / 2,
      };
    }
    const arr = s[side].board,
      i = Math.max(
        0,
        arr.findIndex((m) => m.uid === uid),
      ),
      r = minion(side, i, arr.length || 1);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  const lane = (side) =>
    state.mobile
      ? {
          x: state.layout.arena.x + state.layout.arena.w / 2,
          y:
            state.layout.arena.y +
            state.layout.arena.h * (side === "e" ? 0.25 : 0.75),
        }
      : { x: 800, y: side === "e" ? 374 : 554 };
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      resize();
    });
  }
  window.addEventListener("resize", queue);
  window.visualViewport?.addEventListener("resize", queue);
  window.visualViewport?.addEventListener("scroll", queue);
  window.addEventListener("orientationchange", queue);
  resize();
  return {
    resize,
    box,
    point,
    pos,
    deckAnchor,
    handCardAnchor,
    minion,
    minionLandingBox,
    fallback,
    lane,
    get mobile() {
      return state.mobile;
    },
    get portrait() {
      return state.portrait;
    },
    get width() {
      return state.width;
    },
    get height() {
      return state.height;
    },
    get layout() {
      return state.layout;
    },
    get safe() {
      return state.safe;
    },
    get effectScale() {
      return state.mobile
        ? clamp(Math.min(state.width, state.height) / 800, 0.4, 0.68)
        : 1;
    },
  };
})();
