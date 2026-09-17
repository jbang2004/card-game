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
  /* #app is the shared coordinate frame: every hit test maps client pixels
   * through its rect. Measuring it per pointer move forces a layout on every
   * mousemove during aiming, so it is cached and invalidated whenever the
   * frame can actually have moved — a relayout here, or a window/visual
   * viewport change before one is queued. */
  let appRect = null;
  const invalidateAppRect = () => {
    appRect = null;
  };
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  function resize() {
    invalidateAppRect();
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
    /* §12.1: the hero is one card in three scales — 156x231 on desktop,
     * 72x106 in landscape and on tablets, 60x89 in portrait. The round avatar
     * survives only where a card genuinely cannot fit: the narrowest phones,
     * and landscape so short the rail has no room for one. Decided up here
     * because it changes both the body class and the strip heights. */
    const shortLandscape = mobile && !portrait && H < 380,
      mini = mobile && W > 320 && !shortLandscape;
    const signature = [
      mobile,
      compactDesktop,
      portrait,
      mini,
      W,
      H,
      rawW,
      rawH,
      ...Object.values(safe),
    ].join(":");
    /* Input class, independent of layout (design doc §12.2): a mouse gets the
     * hover affordances at ANY window size, and a finger gets the riffle in
     * their place. `touch-layout` answers "how is this laid out", never "what
     * is pointing at it". */
    document.body.classList.toggle("pointer-fine", finePointer.matches);
    document.body.classList.toggle("pointer-coarse", !finePointer.matches);
    document.body.classList.toggle("mobile-ui", mobile);
    document.body.classList.toggle("touch-layout", mobile);
    document.body.classList.toggle("compact-desktop", compactDesktop);
    document.body.classList.toggle("mobile-portrait", portrait);
    document.body.classList.toggle("mobile-landscape", mobile && !portrait);
    /* Which hero component is on screen — a card or the legacy round avatar. */
    document.body.classList.toggle("hero-mini", mini);
    app.style.setProperty("--scale", scale);
    app.style.setProperty("--view-w", rawW + "px");
    app.style.setProperty("--view-h", rawH + "px");
    app.style.setProperty("--view-top", (vv?.offsetTop || 0) + "px");
    app.style.setProperty("--view-left", (vv?.offsetLeft || 0) + "px");
    if (signature === state.signature) return false;
    const l = {};
    if (mobile) {
      /* Console + dock model (docs/design/BATTLE_REDESIGN_20260914.md):
       *   portrait  = topbar / enemy console strip / arena / player console
       *               strip / hand dock (cards peek 55%, god slot at the right)
       *   landscape = topbar / [left rail: enemy console, player console]
       *               arena [right rail: end turn] / hand dock
       * The hero buttons ARE the consoles: they get the whole strip and lay
       * their avatar, name and chips out in CSS; the skill node, mana pips
       * and end-turn are boxed inside that strip so they stay adjacent. */
      const padL = safe.left + 12,
        padR = safe.right + 12,
        usableW = W - padL - padR;
      l.header = safe.top + (portrait ? 52 : 44);
      /* Tablets and compact desktops get the same layout at a larger scale. */
      const roomy = portrait ? W >= 600 : W >= 1000;
      const short = shortLandscape,
        /* Landscape stacks both hero cards in one narrow rail, so the 72x106
         * card is only affordable when the rail is tall enough for two of them
         * plus their chip rows; a 390-high phone gets the smaller step. */
        roomyRail = H >= 470,
        heroW = portrait ? 60 : roomyRail ? 72 : 56,
        heroH = portrait ? 89 : roomyRail ? 106 : 83;
      const cardW = portrait
          ? roomy
            ? 140
            : /* 360-wide phones: the dock also carries a full-size god slot
                 now, so anything above 96 pushes their six-card step under
                 the 24px pan threshold and costs them the riffle gesture. */
              W < 380 || H < 640
              ? 96
              : H >= 760
                ? 112
                : 104
          : roomy
            ? 118
            : H >= 380
              ? 96
              : 88,
        cardH = Math.round((cardW * 7.4) / 5),
        peek = Math.round(cardH * (!portrait && H < 380 ? 0.55 : 0.66)),
        /* The god slot is a hand card: same size, same dock line, same
         * peek (its lower third hangs off the screen just like the fan). */
        godW = cardW,
        godH = cardH;
      /* The dock box extends below the screen: only the top `peek` px of a
       * resting card are visible; a selected or dragged card rises out of it. */
      const dockTop = H - safe.bottom - peek - 10;
      l.hand = { x: 0, y: dockTop, w: 0, h: cardH + 20 };
      /* The turn capsule shares the top bar with the brand wordmark on the
       * left and the icon cluster on the right, so it may only claim the band
       * BETWEEN them — a capsule centred on the screen runs under the volume
       * button as soon as the phone is narrow. The band is measured from the
       * same constants the bar is built from (brand 50 wide at padL + 14,
       * `.top-actions` 116 wide ending padR + 14 from the right edge) with an
       * 8px gutter on each side, and the capsule is centred IN THE BAND. */
      const brandRight = padL + 52,
        actionsLeft = W - padR - 118,
        roundBand = Math.max(0, actionsLeft - 8 - (brandRight + 8)),
        roundW = Math.min(portrait ? 200 : 260, roundBand);
      l.round = {
        x: Math.round(brandRight + 8 + (roundBand - roundW) / 2),
        y: safe.top + 6,
        w: Math.round(roundW),
        h: portrait ? 34 : 30,
      };
      if (portrait) {
        /* §12.1: the hero is the SAME card at every size, just three scales.
         * A mini card needs a taller strip than a 56px avatar did. */
        const consoleH = mini ? 96 : 82,
          enemyH = mini ? 78 : 56;
        l.hand.x = padL - 6;
        l.hand.w = usableW + 6 - godW - 8;
        l.contract = { x: W - padR - godW, y: dockTop + 10, w: godW, h: godH };
        l.enemyConsole = { x: padL, y: l.header + 4, w: usableW, h: enemyH };
        l.playerConsole = {
          x: padL,
          y: dockTop - 6 - consoleH,
          w: usableW,
          h: consoleH,
        };
        /* Hero boxes double as effect anchors. The player's mini card rises
         * 12px out of the console band, like a name plate pulled from a slot;
         * the enemy's mirrors it downwards so it never hits the top bar. */
        l.enemy = mini
          ? { x: padL + 6, y: l.enemyConsole.y + 2, w: heroW, h: heroH }
          : { x: padL + 6, y: l.enemyConsole.y + 6, w: 44, h: 44 };
        l.player = mini
          ? { x: padL + 8, y: l.playerConsole.y - 12, w: heroW, h: heroH }
          : { x: padL + 8, y: l.playerConsole.y + 12, w: 56, h: 56 };
        const skillX = padL + (mini ? 16 + heroW : 72);
        l.power = { x: skillX, y: l.playerConsole.y + 12, w: 56, h: 56 };
        /* The mana row starts clear of the card, or the pips run under it. */
        l.mana = {
          x: mini ? skillX : padL + 10,
          y: l.playerConsole.y + (mini ? 74 : 64),
          /* Stops at the round button's left edge (64 + 12 of clearance). */
          w: mini ? W - padR - 76 - skillX : 220,
          h: 14,
        };
        /* §12.6: the primary action becomes a 64px round button at the
         * bottom-right corner of the play area. It stays inside the console
         * band, which is the only strip guaranteed clear of the god slot and
         * the hand dock below it. */
        l.turn = mini
          ? { x: W - padR - 64, y: l.playerConsole.y + 16, w: 64, h: 64 }
          : { x: W - padR - 124, y: l.playerConsole.y + 14, w: 124, h: 52 };
        l.chip = { x: padL, y: l.header, w: 0, h: 0 };
        const top = l.enemyConsole.y + enemyH + 6;
        l.arena = {
          x: padL - 2,
          y: top,
          w: usableW + 4,
          h: Math.max(120, l.playerConsole.y - 6 - top),
        };
      } else {
        /* The landscape rail holds the hero card, the skill node beside it and
         * the mana pill under that. */
        const rail = mini ? (roomyRail ? 150 : 128) : 104,
          /* A 64px round button needs far less of the right edge than the old
           * 124px pill did; the arena takes the difference. */
          right = mini ? 76 : 124;
        const arenaX = padL + rail + 8,
          arenaW = W - arenaX - padR - right - 8;
        l.contract = {
          x: W - padR - right - 8 - godW,
          y: dockTop + 10,
          w: godW,
          h: godH,
        };
        l.hand.x = arenaX - 4;
        l.hand.w = l.contract.x - 8 - l.hand.x;
        /* Both consoles are the card plus the chip row that sits under it. */
        const railH = mini ? heroH + 30 : 0;
        l.enemyConsole = {
          x: padL,
          y: l.header + 4,
          w: rail,
          h: mini ? railH : short ? 72 : 102,
        };
        const playerH = mini ? railH : short ? 96 : 118;
        l.playerConsole = {
          x: padL,
          y: dockTop - 8 - playerH,
          w: rail,
          h: playerH,
        };
        l.enemy = mini
          ? { x: padL + 6, y: l.enemyConsole.y + 2, w: heroW, h: heroH }
          : { x: padL + 6, y: l.enemyConsole.y + 6, w: 40, h: 40 };
        l.player = mini
          ? { x: padL + 6, y: l.playerConsole.y + 6, w: heroW, h: heroH }
          : { x: padL + 6, y: l.playerConsole.y + 8, w: 44, h: 44 };
        l.power = {
          x: padL + (mini ? 12 + heroW : 56),
          y: l.playerConsole.y + 8,
          w: 44,
          h: 44,
        };
        /* Under the skill node, clear of the chip row that sits below the
         * card — the rail has no spare height for a third band. */
        l.mana = mini
          ? {
              x: padL + 12 + heroW,
              y: l.playerConsole.y + 56,
              w: rail - 18 - heroW,
              h: 20,
            }
          : { x: padL + 6, y: l.playerConsole.y + playerH - 14, w: 92, h: 10 };
        l.turn = mini
          ? { x: W - padR - 64, y: dockTop - 8 - 64, w: 64, h: 64 }
          : { x: W - padR - right, y: dockTop - 8 - 52, w: right, h: 52 };
        l.chip = { x: padL, y: l.header, w: 0, h: 0 };
        l.arena = {
          x: arenaX,
          y: l.header + 4,
          w: Math.max(120, arenaW),
          h: Math.max(100, dockTop - 8 - (l.header + 4)),
        };
      }
      /* Transient messages float between the two minion rows in portrait
       * (`minion()` keeps a 44px band free there); landscape has no spare
       * height, so they take the topbar's centre instead. */
      l.notice = portrait
        ? {
            x: l.arena.x + 8,
            y: l.arena.y + l.arena.h / 2 - 20,
            w: l.arena.w - 16,
            h: 40,
          }
        : {
            x: l.arena.x + 40,
            y: safe.top + 4,
            w: l.arena.w - 80,
            h: 36,
          };
      l.handLabel = { x: padL, y: -100, w: 0, h: 0 };
      l.actionChip = { ...l.notice };
      l.cardH = cardH;
      l.cardW = cardW;
      l.peek = peek;
      l.tokenScale = roomy ? 1.4 : 1;
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
        "enemy-hero": l.enemyConsole,
        "player-hero": l.playerConsole,
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
      app.style.setProperty("--hand-peek", l.peek + "px");
      app.style.setProperty("--hand-lift", l.cardH - l.peek + "px");
      app.style.setProperty("--god-w", l.contract.w + "px");
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
      /* Every id the phone branch boxes above has to be listed here, or a
       * window that starts narrow and is then widened keeps phone coordinates
       * as inline styles that no desktop rule can outrank — the aim prompt
       * ends up over the brand mark in the top-left corner. */
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
        "touch-target-bar",
        "touch-match-chip",
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
    invalidateAppRect();
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
      raw = intersectionStatus(el, handRect),
      rect = el.getBoundingClientRect(),
      /* Dock cards deliberately hang below the screen edge (peek); a card
       * whose top strip is inside the dock and on screen is a valid landing
       * point for draw flights, not a clipped one.
       *
       * The fan also rotates its outer cards by up to 3° (design doc §13.5),
       * and a rotated element reports an AXIS-ALIGNED box, which sticks out
       * past the dock edge by roughly `height * sin(3°)`. That is a
       * measurement artefact, not a clipped card, so the horizontal tolerance
       * has to absorb it or the draw flight silently stops animating. */
      roll = Math.ceil(rect.height * 0.06) + 1,
      status =
        raw === "clipped" &&
        state.mobile &&
        handRect &&
        rect.left >= handRect.left - roll &&
        rect.right <= handRect.right + roll &&
        rect.top >= handRect.top - 1 &&
        rect.top < Math.min(window.innerHeight, handRect.bottom) - 40
          ? "visible"
          : raw;
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
    /* Board tokens are sized by how many units share the row, never by the
     * seven-slot ceiling: three minions get three-minion tokens. A row that
     * still cannot fit unstacked overlaps its tokens by 10px. A 44px band
     * between the rows stays clear for the floating notice. */
    const a = state.layout.arena,
      count = Math.max(1, n),
      rowH = a.h / 2,
      tiers = state.portrait
        ? [96, 96, 96, 84, 70, 58, 58]
        : [88, 88, 88, 80, 70, 58, 54],
      cap = Math.round(
        tiers[Math.min(count, 7) - 1] * (state.layout.tokenScale || 1),
      ),
      inner = a.w - 16;
    let gap = 8,
      w = Math.floor(Math.min(cap, (rowH - (state.portrait ? 44 : 10)) / 1.25));
    if (count * w + (count - 1) * gap > inner) {
      w = Math.floor((inner - (count - 1) * gap) / count);
      if (w < 58) {
        gap = -10;
        w = Math.min(cap, 58);
        if (count * w + (count - 1) * gap > inner)
          w = Math.floor((inner - (count - 1) * gap) / count);
      }
    }
    w = Math.max(28, w);
    const h = Math.round(w * 1.25),
      total = count * w + (count - 1) * gap;
    return {
      x: a.x + (a.w - total) / 2 + i * (w + gap),
      y: a.y + a.h * (side === "e" ? 0.25 : 0.75) - h / 2,
      w,
      h,
      stacked: gap < 0,
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
    invalidateAppRect();
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      resize();
    });
  }
  /* A mouse can be plugged in (or a tablet put in a keyboard dock) mid-game;
   * the signature guard would swallow a class-only change, so force a relayout. */
  finePointer.addEventListener?.("change", () => {
    state.signature = "";
    queue();
  });
  window.addEventListener("resize", queue);
  window.visualViewport?.addEventListener("resize", queue);
  window.visualViewport?.addEventListener("scroll", queue);
  window.addEventListener("orientationchange", queue);
  window.addEventListener("scroll", invalidateAppRect, { passive: true });
  resize();
  return {
    resize,
    box,
    /* Cached #app rect, for hit tests that run on every pointer move. */
    get appRect() {
      return (appRect ||= app.getBoundingClientRect());
    },
    point,
    pos,
    deckAnchor,
    handCardAnchor,
    minion,
    minionLandingBox,
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
  };
})();
