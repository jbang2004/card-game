/* EmberBattleView — how the battlefield is seen, and where everyone stands on it (docs/design/BATTLE_VIEW.md).
 *
 * One camera for the three layers that draw a battle: the scene under it (EmberArena3D), the figures on it
 * (EmberMiniatures) and the page's tokens over them (EmberViewport.minion: the click targets and the stats plates).
 * The formation is the source of truth — a unit's place on the ground — and the tokens are where those places land on
 * the screen (before 2026-10-03 it was the other way round: the page laid tokens out in rows and the figures were put
 * where the tokens were).
 *
 * World: x across the board, z toward the player (the enemy's side at −z), y up; one unit is a person's height.
 * Two views, chosen by the screen (the user's choice, 2026-10-03, from the view lab's eight):
 *   side   ⑥ 我方背后斜侧 — a screen on its side (a desktop, a phone held sideways): a low camera over our side's
 *          right shoulder (22° down, turned 44°), each side in two rows a column apart, every other column stepped
 *          back so nothing hides behind anything on a full board; the heroes behind their sides
 *   front  ② 正面·英雄居中 — a phone held upright: from the front, 40° down; a side's line becomes two rows past
 *          four units; the heroes behind their sides
 * The camera is fitted (its distance and aim) so a full board of both sides and both heroes fills the room the
 * page's chrome leaves (top bar, hand, consoles) — the same camera whatever is on the board, so nothing jumps as units
 * come and go. Pure geometry: no three.js, no WebGL; it works where the figures do not (the tokens still stand on it).
 * `?view=classic` keeps the old row layout (EmberViewport's own), for comparison only. */
const EmberBattleView = (() => {
  "use strict";
  const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
  const classic = Q.get("view") === "classic";
  // a hero's dais: its top a little above the court (EmberArena3D's SEAT.top, in its units / K)
  const DAIS = 0.075;
  // the scene's units per world unit (EmberArena3D draws in its own: a court ~1100 across)
  const K = 213;
  // a token's foot: the figure stands at FOOT of its token's height (EmberMiniatures: the plate below it)
  const FOOT = 0.6;
  const MODES = {
    side: { fov: 30, pitch: 22, yaw: 44, dx: 1.2, x0: 1.0, gap: 0.95, stag: 0.55, hero: 4.15, heroX: { p: 0, e: 1.2 } },
    front: { fov: 32, pitch: 40, yaw: 0, z: 1.15, back: 0.85, sp: 0.95, hero: 3.7, heroX: { p: 0, e: 0 } },
  };
  const rad = (d) => (d * Math.PI) / 180;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ the formation
  /** where the i-th of a side's n units stands: [x, 0, z] */
  function slot(mode, side, i, n) {
    const s = side === "e" ? -1 : 1, M = MODES[mode];
    n = Math.max(1, Math.min(7, n)); i = clamp(i, 0, n - 1);
    if (mode === "side") {
      // columns across the board (left to right), two deep — the front one a step from the middle, the back one a
      // column further — and every other column stepped back
      const m = Math.ceil(n / 2), j = Math.floor(i / 2), col = i % 2;
      return [(j - (m - 1) / 2) * M.dx, 0, s * (M.x0 + col * M.gap + (j % 2) * M.stag)];
    }
    // one line up to four; past that the front four and the rest behind them, between
    if (n <= 4) return [(i - (n - 1) / 2) * M.sp, 0, s * M.z];
    const f = Math.ceil(n / 2), back = i >= f, k = back ? i - f : i, c = back ? n - f : f;
    return [(k - (c - 1) / 2) * M.sp, 0, s * (M.z + (back ? M.back : 0))];
  }
  // (a hero behind its side; heroX moves it along: the camera turned as it is, a hero straight behind its side can
  // stand behind one of that side's columns)
  const heroAt = (mode, side) => [MODES[mode].heroX[side], DAIS, (side === "e" ? -1 : 1) * MODES[mode].hero];

  // ------------------------------------------------------------------ the screen it is fitted into
  /** the room the chrome leaves for the battle, in stage pixels (EmberViewport's coordinates) */
  function room(Vp) {
    const W = Vp.width, H = Vp.height, l = Vp.layout || {};
    if (!Vp.mobile) {
      // the desktop page: under the top bar, over the hand (its cards' tops), clear of the side columns' chrome
      // (the left column keeps the covenant and the hero power, the right one the deck, the turn and the mana)
      return { W, H, top: 72, bottom: 772, left: 190, right: W - 96 };
    }
    const a = l.arena || { x: 0, y: 0, w: W, h: H };
    // (held upright, our hero stands in the console's band between the hero power and the turn button, its stats
    // just over the mana row: the room runs down to that row)
    const bottom = Vp.portrait && l.mana ? l.mana.y - 6 : a.y + a.h - 2;
    return { W, H, top: a.y + 4, bottom, left: a.x + 2, right: a.x + a.w - 2 };
  }

  // ------------------------------------------------------------------ the camera
  function basis(eye, target) {
    const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    return { f, r, u };
  }
  function makeView(mode, R) {
    const M = MODES[mode], fov = M.fov, aspect = R.W / R.H, t = Math.tan(rad(fov) / 2);
    const yaw = rad(M.yaw), pitch = rad(M.pitch);
    const dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    // what has to be seen: a full board of both sides (their feet, heads and the stats under them) and both heroes
    const pts = [];
    for (const side of ["p", "e"]) {
      for (let i = 0; i < 7; i++) { const p = slot(mode, side, i, 7); pts.push(p, [p[0], 1.05, p[2]], [p[0], -0.22, p[2]]); }
      // (a hero's nameplate and stats hang a little further under its dais than a unit's plate)
      const h = heroAt(mode, side); pts.push(h, [h[0], h[1] + 1.2, h[2]], [h[0], -0.7, h[2]]);
    }
    const sx0 = (R.left / R.W) * 2 - 1, sx1 = (R.right / R.W) * 2 - 1, sy0 = 1 - (R.bottom / R.H) * 2, sy1 = 1 - (R.top / R.H) * 2;
    let T = [0, 0, 0], D = 14;
    const ndc = (p, e, B) => { const q = sub(p, e), z = dot(q, B.f); return [dot(q, B.r) / (z * t * aspect), dot(q, B.u) / (z * t)]; };
    for (let it = 0; it < 80; it++) {
      const eye = [T[0] + dir[0] * D, T[1] + dir[1] * D, T[2] + dir[2] * D], B = basis(eye, T);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { const [x, y] = ndc(p, eye, B); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      D *= Math.pow(Math.max((x1 - x0) / (sx1 - sx0), (y1 - y0) / (sy1 - sy0)), 0.6);
      const k = D * t, right = norm([B.r[0], 0, B.r[2]]), fwd = norm([B.f[0], 0, B.f[2]]);
      const cx = ((x0 + x1) / 2 - (sx0 + sx1) / 2) * k * aspect, cy = (((y0 + y1) / 2 - (sy0 + sy1) / 2) * k) / Math.max(0.35, Math.sin(pitch));
      T = [T[0] + right[0] * cx + fwd[0] * cy, 0, T[2] + right[2] * cx + fwd[2] * cy];
    }
    const eye = [T[0] + dir[0] * D, T[1] + dir[1] * D, T[2] + dir[2] * D];
    return { mode, fov, aspect, W: R.W, H: R.H, eye, target: T, dist: D, room: R, ...basis(eye, T), t };
  }

  // ------------------------------------------------------------------ the current view (made again as the screen changes)
  let view = null, key = "", version = 0;
  /** (a design tool: change a mode's numbers and the view is made again) */
  function tune(mode, o) { Object.assign(MODES[mode], o); key = ""; }
  function current() {
    if (typeof EmberViewport === "undefined") return null;
    const Vp = EmberViewport, mode = Vp.mobile && Vp.portrait ? "front" : "side", R = room(Vp);
    const k = [mode, R.W, R.H, R.top, R.bottom, R.left, R.right].map((v) => (typeof v === "number" ? Math.round(v) : v)).join(":");
    if (k !== key) {
      key = k; view = makeView(mode, R); version++;
      // (the page's chrome is laid out for the view: body[data-battle-view] — skins/slate/battle-view.css)
      if (typeof document !== "undefined" && document.body && document.body.dataset.battleView !== mode) document.body.dataset.battleView = mode; if (typeof dispatchEvent === "function") dispatchEvent(new CustomEvent("ember:battleview", { detail: { version } }));
    }
    return view;
  }
  /** a world point → stage pixels (x, y) and its depth along the camera */
  function project(p, v = current()) {
    const q = sub(p, v.eye), z = dot(q, v.f);
    return { x: ((dot(q, v.r) / (z * v.t * v.aspect) + 1) / 2) * v.W, y: ((1 - dot(q, v.u) / (z * v.t)) / 2) * v.H, depth: z };
  }
  /** stage pixels → the point on the ground (y = 0) under them, or null */
  function ground(x, y, v = current()) {
    const nx = (x / v.W) * 2 - 1, ny = 1 - (y / v.H) * 2;
    const d = norm([v.f[0] + v.r[0] * nx * v.t * v.aspect + v.u[0] * ny * v.t, v.f[1] + v.r[1] * nx * v.t * v.aspect + v.u[1] * ny * v.t, v.f[2] + v.r[2] * nx * v.t * v.aspect + v.u[2] * ny * v.t]);
    if (d[1] >= -1e-6) return null;
    const s = -v.eye[1] / d[1];
    return [v.eye[0] + d[0] * s, 0, v.eye[2] + d[2] * s];
  }
  /** how tall a person standing at p is on screen (stage pixels) */
  const person = (p, v = current()) => Math.abs(project([p[0], p[1] + 1, p[2]], v).y - project(p, v).y);

  /** a unit's token: a box whose point FOOT down its height is where the unit stands, as wide as a little over half
   *  a person there (its stats plate under the feet); z: nearer tokens over farther ones */
  function minionBox(side, i, n) {
    const v = current(), p = slot(v.mode, side, i, n), f = project(p, v), h0 = person(p, v);
    const w = Math.round(clamp(h0 * 0.56, v.W < 900 ? 46 : 64, 150)), h = Math.round(w * 1.25);
    return { x: Math.round(f.x - w / 2), y: Math.round(f.y - FOOT * h), w, h, z: Math.round(1000 - f.depth * 20), foot: { x: f.x, y: f.y }, world: p };
  }
  /** a hero's station: a box round its figure (its foot near the bottom, the nameplate and stats below that). aside:
   *  the nameplate and stats beside the figure instead — the enemy's, seen from the front: its feet are level with
   *  its back row's heads, and a plate under them would cover those */
  function heroBox(side) {
    const v = current(), p = heroAt(v.mode, side), f = project(p, v), h0 = person(p, v) * 1.12;
    const aside = v.mode === "front" && side === "e";
    const w = Math.round(clamp(h0 * 0.56, 96, 200)), inner = Math.round(h0 * 1.04), plate = aside ? 0 : v.W < 900 ? 52 : 76;
    return { x: Math.round(f.x - w / 2), y: Math.round(f.y + 8 - inner), w, h: inner + plate, inner, aside, foot: { x: f.x, y: f.y }, world: p };
  }
  /** a side's middle on screen (where a lone token lands, where effects run along a lane) */
  function lane(side) {
    const v = current(), M = MODES[v.mode], s = side === "e" ? -1 : 1, f = project([0, 0, s * (v.mode === "side" ? M.x0 + M.gap / 2 : M.z)], v);
    return { x: f.x, y: f.y };
  }

  return Object.freeze({
    K, DAIS, FOOT, MODES,
    /** the battle is drawn this way (false only with ?view=classic) */
    get active() { return !classic; },
    get version() { current(); return version; },
    /** { mode, fov, aspect, W, H, eye, target, dist, f, r, u } — the camera in world units */
    view: () => current(),
    slot: (side, i, n) => slot(current().mode, side, i, n),
    hero: (side) => heroAt(current().mode, side),
    project: (p) => project(p),
    ground: (x, y) => ground(x, y),
    person: (p) => person(p),
    minionBox, heroBox, lane, tune,
    /** the extent of a full board (and the heroes) on the ground: what the court has to hold */
    extent: () => {
      const v = current(); let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const side of ["p", "e"]) for (let i = 0; i < 7; i++) { const p = slot(v.mode, side, i, 7); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
      return { x0, x1, z0, z1, hero: MODES[v.mode].hero };
    },
  });
})();
// (the page laid itself out before this script was read: once more, the battlefield's way)
if (typeof EmberViewport !== "undefined" && typeof document !== "undefined") EmberViewport.resize();
if (typeof module !== "undefined") module.exports = EmberBattleView;
