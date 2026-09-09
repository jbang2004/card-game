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
    const mobile = rawW < 960 || (touch && rawW < 1366);
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
      portrait,
      W,
      H,
      rawW,
      rawH,
      ...Object.values(safe),
    ].join(":");
    document.body.classList.toggle("mobile-ui", mobile);
    document.body.classList.toggle("touch-layout", mobile);
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
      const handH = portrait
        ? H >= 720
          ? 154
          : H >= 600
            ? 142
            : 126
        : H >= 420
          ? 132
          : 116;
      l.hand = {
        x: padL - 4,
        y: H - safe.bottom - handH - 6,
        w: usableW + 8,
        h: handH,
      };
      if (portrait) {
        const heroH = H >= 700 ? 102 : 84,
          heroW = heroH * 0.8;
        l.enemy = {
          x: W / 2 - heroW / 2,
          y: l.header + 18,
          w: heroW,
          h: heroH,
        };
        const ctrlY = l.hand.y - 28 - (H >= 700 ? 112 : 98);
        l.player = {
          x: padL + 15,
          y: ctrlY + 5,
          w: H >= 700 ? 74 : 65,
          h: H >= 700 ? 92 : 82,
        };
        l.power = {
          x: Math.round(padL + usableW * 0.36),
          y: ctrlY + 44,
          w: 52,
          h: 52,
        };
        l.turn = { x: W - padR - 120, y: ctrlY + 43, w: 120, h: 52 };
        l.mana = { x: W - padR - 168, y: l.hand.y - 31, w: 168, h: 25 };
        const top = l.enemy.y + l.enemy.h + 44,
          bottom = Math.max(top + 100, ctrlY - 8);
        l.notice = { x: padL, y: l.enemy.y + l.enemy.h + 9, w: usableW, h: 26 };
        l.arena = { x: padL - 2, y: top, w: usableW + 4, h: bottom - top };
        l.target = { x: padL + 106, y: ctrlY - 4, w: usableW - 106, h: 40 };
        l.enemyMana = {
          x: Math.min(W - padR - 80, l.enemy.x + l.enemy.w + 20),
          y: l.enemy.y + 34,
          w: 76,
          h: 28,
        };
        l.chip = {
          x: padL,
          y: l.enemy.y + 8,
          w: Math.max(70, l.enemy.x - padL - 12),
          h: 76,
        };
      } else {
        const heroH = clamp((l.hand.y - l.header - 10) * 0.36, 54, 88),
          heroW = heroH * 0.81;
        l.enemy = { x: padL + 14, y: l.header + 9, w: heroW, h: heroH };
        l.player = {
          x: padL + 14,
          y: l.hand.y - heroH - 26,
          w: heroW,
          h: heroH,
        };
        const railR = W - padR - 104;
        l.power = { x: railR + 24, y: l.header + 16, w: 52, h: 52 };
        l.turn = { x: railR, y: l.hand.y - 72, w: 104, h: 50 };
        l.mana = { x: railR, y: l.hand.y - 20, w: 104, h: 18 };
        l.arena = {
          x: padL + 106,
          y: l.header + 28,
          w: W - padL - padR - 226,
          h: l.hand.y - l.header - 48,
        };
        l.target = {
          x: l.arena.x + 6,
          y: l.hand.y - 19,
          w: l.arena.w - 12,
          h: 22,
        };
        l.enemyMana = { x: padL, y: l.hand.y - 19, w: 94, h: 18 };
        l.chip = { x: l.arena.x, y: l.header + 2, w: l.arena.w, h: 20 };
        l.notice = { ...l.chip };
      }
      if (portrait) {
        l.chip.h = Math.max(28, l.enemy.h - 56);
        l.contract = {
          x: padL,
          y: l.enemy.y + l.enemy.h - 44,
          w: l.chip.w,
          h: 44,
        };
      } else {
        // The right rail is partitioned into skill, covenant, turn and mana.
        l.power.y = l.header + 8;
        l.power.w = l.power.h = H < 370 ? 44 : 48;
        l.contract = {
          x: l.turn.x,
          y: l.power.y + l.power.h + 6,
          w: l.turn.w,
          h: 44,
        };
        if (l.contract.y + l.contract.h + 6 > l.turn.y) {
          l.power.x = l.turn.x;
          l.contract = { x: l.turn.x + 60, y: l.power.y, w: 44, h: 44 };
        }
      }
      l.handLabel = { x: padL, y: l.hand.y - 28, w: 100, h: 25 };
      l.cardW = portrait ? (W < 350 ? 94 : 106) : 88;
      l.cardH = portrait ? handH - 12 : handH - 10;
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
        "enemy-mana": l.enemyMana,
        hand: l.hand,
        "touch-target-bar": l.target,
        "touch-match-chip": l.chip,
      };
      for (const [id, r] of Object.entries(roots))
        box(document.getElementById(id), r);
      box(document.querySelector(".turn-controls"), l.turn);
      box(document.querySelector(".mana-panel"), l.mana);
      box(document.querySelector(".hand-label"), l.handLabel);
      app.style.setProperty("--hand-card-w", l.cardW + "px");
      app.style.setProperty("--hand-card-h", l.cardH + "px");
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
        "enemy-mana",
        "hand",
        "board-empty",
        "weapon-slot",
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
  function minion(side, i, n) {
    if (!state.mobile)
      return {
        x: 800 + (i - (n - 1) / 2) * 128 - 58,
        y: side === "e" ? 291 : 444,
        w: 116,
        h: 134,
      };
    const a = state.layout.arena;
    const gap = n > 5 ? 3 : state.portrait ? 9 : 12;
    const maxW = state.portrait ? 76 : 70;
    const availableH = a.h * 0.5 - 14;
    const w = Math.floor(
      Math.min(
        maxW,
        (a.w - 16 - (n - 1) * gap) / Math.max(1, n),
        availableH / 1.18,
      ),
    );
    const h = Math.round(w * 1.22),
      total = n * w + (n - 1) * gap;
    return {
      x: a.x + (a.w - total) / 2 + i * (w + gap),
      y: a.y + a.h * (side === "e" ? 0.25 : 0.75) - h / 2,
      w,
      h,
    };
  }
  function fallback(s, side, uid) {
    if (state.mobile && uid === "hero") {
      const r = state.layout[side === "p" ? "player" : "enemy"];
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }
    if (uid === "hero") return { x: 800, y: side === "p" ? 660 : 195 };
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
    minion,
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
