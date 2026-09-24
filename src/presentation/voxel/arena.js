/* EmberVoxelArena — how battlefield figures behave, independent of any page (docs/design/MINIATURES.md).
 * A unit stands at a point on the ground, bakes on first use, assembles from its voxels, idles, attacks (a melee
 * figure dashes to its target on the director's timeline — lift → contact → release → back — a shooter shoots from
 * where it stands), takes hits (1 frame white-hot, a decaying wash, recoil, the attacker's hitstop) and dies
 * (launched, then shattered into its own voxels, which bounce once and sink). The hit-feel that belongs to the
 * figures — weapon trail and contact burst — is drawn here, in the same 3D space as the figures.
 *
 * The page owns the renderer and camera and says where things stand (the battlefield: presentation/voxel/stage.js;
 * the character gallery uses the same arena, so it shows exactly what the battle shows):
 *   const arena = EmberVoxelArena.create(scene, {
 *     size,                  board size of a figure (× its spec.scale)
 *     where(ref),            → ground point (Vector3) of { side, uid } — any unit, figure or not; null = unknown
 *     live(unit, on),        a figure took over / left its unit (the battlefield dims the token art)
 *     pixelRatio(),          for the figures' pixel dither
 *     shots,                 true = the arena flies shooters' projectiles itself (the gallery; in battle EmberFx2 does)
 *     bake(id),              → Promise of the figure's bake made off the main thread (EmberVoxelBaker.bake)
 *     ready(),               false while baking in the page or appearing would hurt (the battlefield: a sequence plays)
 *     warm(root),            compile a new figure's shaders off the frame (→ Promise); it appears once they are ready
 *     wake(),                something started that needs frames
 *   });
 *   arena.set(side, uid, figureId, info) · drop(side, uid, animate) · each(fn) · cue · contact · owns · plan
 *   arena.step(now, camera) → true while anything moves · setPixelRatio(dpr) · diagnostics()
 * Rules state is never read; a figure never changes the game. */
const EmberVoxelArena = (() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, C = EmberVoxelClips, KIT = EmberVoxelKit;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const FPS = 60, ASSEMBLE = 33, S = 0.54;
  // where a melee figure stops before its target: its weapon's reach (× its size) plus the target's half-width
  const REACH = { spear: 0.5, bite: 0.24, gore: 0.32 }, REACH_DEFAULT = 0.3;
  // victim glow colours (× strength; HOT = 1 + white emissive on the contact frame) and per-tier numbers
  const HOT = [1.55, 1.53, 1.5], TINT = { 1: [1.0, 0.6, 0.12], 2: [1.0, 0.4, 0.07], 3: [1.0, 0.25, 0.12] };
  const TIER = { 1: { freeze: 0, star: 0.36, needles: 12, spd: 15 }, 2: { freeze: 3, star: 0.42, needles: 14, spd: 17 }, 3: { freeze: 5, star: 0.44, needles: 16, spd: 20 } };
  const key = (side, uid) => side + ":" + uid;
  const hex3 = (h, k) => { const c = new THREE.Color(h); return [c.r * k, c.g * k, c.b * k]; };

  function create(scene, o = {}) {
    const SIZE = o.size ?? 1;
    // a single contact stays within 1.25× its target's token (BATTLE_PRESENTATION_V2 §5): the star's radius is capped
    // for a token at board size (0.7 world units wide at size 1.25) and the needle sparks fly shorter than in Musou
    const STAR_MAX = 0.32 * SIZE, NEEDLE_K = 0.6;
    const fx = EmberVoxelFx.create(scene, { pixel: true, light: R.LIGHT, scale: S });
    const units = new Map();      // "side:uid" → unit
    const dying = [];             // units playing their death beat (their token may be gone already)
    const queue = [];             // units waiting for their figure bake
    const shots = [];             // projectiles the arena flies itself (o.shots)
    const trail = { on: false, base: V3(), tip: V3(), heavy: false, freeze: 0 };   // latest posed weapon edge
    const stats = { figures: 0, cues: [], bakeMs: {} };
    let frame = 0, acc = 0, T = 0, pumping = false, disposed = false;
    const wake = () => o.wake?.();
    const where = (ref) => (ref ? o.where?.(ref) ?? null : null);
    const pixelRatio = () => o.pixelRatio?.() ?? Math.min(globalThis.devicePixelRatio || 1, 2);
    const live = (u, on) => { try { o.live?.(u, on); } catch {} };

    // ------------------------------------------------------------------ units
    function set(side, uid, id, info = {}) {
      const k = key(side, uid);
      let u = units.get(k);
      if (u && u.id !== id) { drop(side, uid, false); u = null; }
      if (!u) {
        const spec = KIT.get(id);
        if (!spec) return null;
        u = { k, id, spec, side, uid: String(uid), info, fig: null, state: "baking", clip: "idle", t: 0, yaw: null, toward: null,
          atk: null, freeze: 0, glow: null, spawnAt: 0, lastFrom: null, pos: null };
        units.set(k, u); queue.push(u);
        stats.figures = units.size;
        pump();
      }
      u.info = info;
      if (u.state === "live") live(u, true);
      return u;
    }
    // the bake queue, one figure at a time. With a worker baker (o.bake → Promise of EmberVoxelKit.bakeData) the
    // voxels are made off the main thread; without one the bake runs in the page, and then only while the page says it
    // is quiet (o.ready): 0.1–0.7 s of main thread must never land inside a combat sequence — a unit summoned
    // mid-sequence keeps its flat token until the sequence ends. Building the mesh from a bake takes a few ms.
    let worker = !!o.bake;
    function pump(delay = 0) {
      if (pumping || !queue.length || disposed) return;
      pumping = true;
      setTimeout(async () => {
        const u = queue[0];
        if (!u || units.get(u.k) !== u || disposed) { queue.shift(); pumping = false; pump(); return; }
        if (!R.cached(u.id) && worker) {
          try { R.bake(u.id, await o.bake(u.id)); }
          catch (error) { worker = false; console.warn("voxel worker unavailable; baking in the page.", String(error?.message || error)); }
          if (disposed) return;
        }
        if (!R.cached(u.id) && o.ready && !o.ready()) { pumping = false; pump(120); return; }
        const i = queue.indexOf(u); if (i >= 0) queue.splice(i, 1);
        pumping = false;
        if (units.get(u.k) === u) {
          try {
            const t0 = performance.now();
            u.fig = R.build(u.id, { pixelRatio: pixelRatio() });
            stats.bakeMs[u.id] = Math.round(R.cached(u.id)?.ms ?? performance.now() - t0);
            u.fig.root.visible = false;
            u.fig.root.scale.setScalar((u.spec.scale || 1) * SIZE);
            scene.add(u.fig.root);
            // its shaders compile in the background (a first draw would otherwise stall a frame); then it may arrive
            u.state = "compiling";
            Promise.resolve(o.warm ? o.warm(u.fig.root) : null).catch(() => {}).then(() => {
              if (units.get(u.k) === u && u.state === "compiling") { u.state = "arrive"; wake(); }
            });
          } catch (error) { console.warn("voxel figure failed", u.id, error); units.delete(u.k); stats.figures = units.size; }
        }
        if (queue.length) pump();
        wake();
      }, delay);
    }
    // a figure is on stage once it shows (assembling or live); before that its unit is still a flat token
    const shown = (u) => !!u.fig && (u.state === "live" || u.state === "assembling");
    function drop(side, uid, animate) {
      const k = key(side, uid), u = units.get(k);
      if (!u) return;
      units.delete(k); stats.figures = units.size;
      live(u, false);
      const i = queue.indexOf(u); if (i >= 0) queue.splice(i, 1);
      if (animate && shown(u)) { die(u, u.lastFrom); return; }
      if (u.state === "dying") return;                   // its death beat finishes on its own
      if (u.fig) { scene.remove(u.fig.root); R.dispose(u.fig); }
    }
    function goLive(u) { u.state = "live"; u.fig.root.visible = true; live(u, true); }

    // ------------------------------------------------------------------ cues
    /* kind: attack | hurt | death | victory. opts: attack { toward, planned, ranged, tier, liftMs, contactMs, releaseMs,
     * durationMs } · hurt { tier, from, direction }. death → true when the unit's figure shatters (the page then skips
     * its own demise). */
    function cue(side, uid, kind, opts = {}) {
      const u = units.get(key(side, uid)) || dying.find((d) => d.side === side && d.uid === String(uid));
      if (!u) return false;
      stats.cues.push({ key: key(side, uid), kind, at: Math.round(performance.now()) });
      if (stats.cues.length > 30) stats.cues.shift();
      if (kind === "attack") {
        u.toward = opts.toward || null;
        if (!shown(u)) return true;                         // not on stage yet: the page animates its flat token
        if (u.state !== "live") goLive(u);
        const tm = C.timing(u.fig), a = u.spec.moves?.attack || {}, shoots = !!a.ranged;
        // the clip's contact (a shooter's release) lands on the director's contact (a shot's launch = lift)
        const align = shoots ? opts.liftMs : opts.contactMs;
        u.clip = "attack"; u.t = 0; u.freeze = 0;
        u.atk = { t0: performance.now(), alignMs: Math.max(60, align ?? tm.hit * 1000), H: tm.hit, tier: opts.tier || 1, ranged: shoots, dash: null };
        if (!shoots && opts.planned && opts.toward) {
          const lift = opts.liftMs ?? 110, contact = Math.max(lift + 40, opts.contactMs ?? 260), release = Math.max(contact, opts.releaseMs ?? contact);
          u.atk.dash = { lift, contact, release, back: Math.max(220, (opts.durationMs ?? release + 200) - release), tgt: null };
        }
        if (shoots && o.shots && opts.toward) shots.push({ u, to: opts.toward, at: u.atk.t0 + (opts.liftMs ?? 350), hit: u.atk.t0 + (opts.contactMs ?? 500), tier: opts.tier || 1, style: a.style, tint: a.tint, from: null, fired: false });
      } else if (kind === "hurt") {
        const tier = Math.max(1, Math.min(3, opts.tier || 1));
        u.glow = { f: 0, tier };
        u.lastFrom = opts.from || u.lastFrom;
        if (u.fig && u.state === "live") { u.stopF = Math.min(TIER[tier].freeze, 3); u.pendingHurt = true; }
        const a = opts.from && units.get(key(opts.from.side, opts.from.uid));
        if (a && a.fig && a.state === "live") {
          if (a.clip === "attack") a.freeze = TIER[tier].freeze;
          if (opts.direction === "outgoing" && (!a.spec.moves?.attack?.ranged || o.shots)) burst(u, a, tier, a.spec.moves?.attack?.style);
        }
      } else if (kind === "death") {
        // it shatters if it was on stage (or a page render already started its beat through drop); a figure that never
        // showed leaves quietly and the page plays its own demise
        const shatters = u.state === "dying" || shown(u);
        if (shatters) die(u, u.lastFrom); else drop(u.side, u.uid, false);
        wake();
        return shatters;
      } else if (kind === "victory") {
        if (u.fig && u.state === "live" && u.clip !== "attack") { u.clip = "victory"; u.t = 0; }
      }
      wake();
      return true;
    }
    /** a damage contact on any unit (figure, flat token or hero): a victim figure glows and recoils; when the attacker
     *  is a melee figure the contact burst is drawn at the victim (its ground point when it has no figure) */
    function contact(ref, opts = {}) {
      if (disposed) return false;
      const tier = Math.max(1, Math.min(3, opts.tier || 1));
      if (units.has(key(ref.side, ref.uid))) cue(ref.side, ref.uid, "hurt", opts);
      else {
        const a = opts.from && units.get(key(opts.from.side, opts.from.uid));
        if (!a || !a.fig || a.state !== "live" || (a.spec.moves?.attack?.ranged && !o.shots) || opts.direction !== "outgoing") return false;
        if (a.clip === "attack") a.freeze = TIER[tier].freeze;
        const g = where(ref); if (!g) return false;
        burst(ghost(g, a), a, tier, a.spec.moves?.attack?.style);
      }
      wake();
      return true;
    }
    // a stand-in victim for a unit without a figure (a flat token or a hero): its ground point and a figure-sized box
    const ghost = (g, a) => ({ fig: { root: { position: g, scale: { x: SIZE } }, mesh: { geometry: { boundingBox: { min: { y: 0 }, max: { y: 0.9 } } } }, vox: a.fig.vox }, spec: { scale: 1 }, pal: paletteOf(a) });
    /** a figure stands for this unit (melee = only when its attack is melee) */
    const owns = (side, uid, melee = false) => {
      const u = units.get(key(side, uid));
      return !!(u && shown(u) && !(melee && u.spec.moves?.attack?.ranged));
    };
    /** for the attack planner: how this unit's figure attacks — a melee dash, or a shot with `windup` ms of drawing */
    function plan(side, uid) {
      if (!owns(side, uid)) return null;
      const a = units.get(key(side, uid)).spec.moves?.attack || {};
      return { melee: !a.ranged, windup: a.ranged ? a.windup ?? 260 : 0 };
    }

    // contact burst on the victim (voxel-musou: pixel star with 13 spikes + needle sparks, warm → cool with the tier)
    function burst(v, a, tier, style) {
      if (!v.fig) return;
      const c = center(v), from = a.fig.root.position, d = V3(c.x - from.x, 0, c.z - from.z);
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
      const p = c.clone().addScaledVector(d, -0.12 * v.fig.root.scale.x);
      const T3 = TIER[tier], cool = tier >= 3, tint = a.spec.moves?.attack?.tint;
      const pal = cool ? fx.PAL.HOT_COOL : fx.PAL.NEEDLE_WARM;
      fx.needleBurst(p.x, p.y, p.z, T3.needles, d.x, d.z, T3.spd * S * NEEDLE_K, tint ? [[...hex3(tint, 1.2)], [...hex3(tint, 0.6)], [1.6, 1.4, 1.1]] : pal, (cool ? 0.065 : 0.055) * S, 1.5, fx.pools.hot);
      fx.star(p.x, p.y, p.z, Math.min(STAR_MAX, T3.star * v.fig.root.scale.x), cool ? 0.15 : 0.13, tint ? hex3(tint, 0.5) : cool ? fx.PAL.BURST_COOL : fx.PAL.FLASH_WARM, -1, 1);
      if (style === "thrust" && cool) {
        const o2 = from.clone().addScaledVector(d, 0.2);
        fx.beam(fx.KIND.STREAK, o2.x, p.y, o2.z, d.x, 0, d.z, 1.1, 0.3, 0.2, [1.2, 1.9, 2.8]);
      }
      if (style === "blunt") fx.ring(v.fig.root.position.x, v.fig.root.position.z, 0.5, 0.3, [1.4, 1.0, 0.6]);
      if (fx.rng.chance(tier >= 2 ? 0.7 : 0.35)) fx.chunks(p.x, p.y - 0.1, p.z, 1, d.x, d.z, 3 * S, paletteOf(v), 0.06 * S, 0.12 * S, [2 * S, 5 * S], [0.25, 0.4]);
    }
    function paletteOf(u) {
      if (u.pal) return u.pal;
      const V = u.fig.vox, out = [];
      for (let i = 0; i < V.bone.length; i += 11) out.push([V.color[i * 3], V.color[i * 3 + 1], V.color[i * 3 + 2]]);
      return (u.pal = out.length ? out : [[0.4, 0.4, 0.4]]);
    }
    const center = (u) => { const b = u.fig.mesh.geometry.boundingBox, s = u.fig.root.scale.x; return u.fig.root.position.clone().add(V3(0, (b.min.y + b.max.y) * 0.45 * s, 0)); };

    // death beat (≈ 0.52 s, as the DOM's): a short launch away from the last attacker, then it shatters into its own
    // voxels, which bounce once and sink before the beat ends
    function die(u, from) {
      if (u.state === "dying") return;
      units.delete(u.k); stats.figures = units.size;
      live(u, false);
      if (!u.fig || u.state === "baking") return;
      u.state = "dying"; u.dieF = frame; dying.push(u);
      u.fig.root.visible = true;
      const p = u.fig.root.position, a = from && units.get(key(from.side, from.uid));
      const d = a && a.fig ? V3(p.x - a.fig.root.position.x, 0, p.z - a.fig.root.position.z) : V3(0, 0, u.side === "p" ? 1 : -1);
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
      u.fly = { v: V3(d.x * 1.1, 2.0, d.z * 1.1), axis: V3(0, 1, 0).cross(d).normalize(), rot: 0, dir: d, q0: u.fig.root.quaternion.clone(), p0: p.clone() };
      u.glow = { f: 0, tier: 3, kill: true };
    }
    function shatter(u) {
      const { pts, cols, size } = R.voxelsWorld(u.fig), c = center(u);
      fx.shatter(pts, cols, c, u.fly.dir, { n: 420, spd: 2.0 * S, up: [1.0 * S, 2.8 * S], size, life: [0.24, 0.34] });
      fx.dustPuff(c.x, c.z, 2, 1.6 * S, 0.36 * S, 0.08 * S, 0.3);
      u.fig.root.visible = false; u.shattered = frame;
    }

    // ------------------------------------------------------------------ per frame
    function facing(u, from) {
      let target = null;
      if (u.toward && u.clip === "attack") target = where(u.toward);
      let want;
      if (target) { const dx = target.x - from.x, dz = target.z - from.z; want = Math.atan2(dx, dz); }
      else want = u.side === "p" ? 0.35 : -0.35;            // idle: three-quarters toward the camera (faces read)
      if (u.yaw == null) u.yaw = want;
      let d = want - u.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      u.yaw += d * Math.min(1, target ? 0.45 : 0.1);
      u.fig.root.rotation.set(0, u.yaw, 0);
    }
    /** attack clip time: the part before contact is stretched onto the director's contact, the rest runs at speed */
    function attackTime(u, now) {
      const a = u.atk, r = (now - a.t0) / 1000, c = a.alignMs / 1000;
      return r <= c ? (r / c) * a.H : a.H + (r - c);
    }
    /** a melee figure's dash on the director's timeline: holds home through the lift (its clip coils), accelerates onto
     *  the strike point by the contact, holds through the hit-stop, hops back home */
    function dashOffset(u, home, now) {
      const d = u.atk.dash, r = now - u.atk.t0;
      const g = where(u.toward);
      if (g) d.tgt = g;
      if (!d.tgt || r >= d.release + d.back) return null;
      const v = units.get(key(u.toward.side, u.toward.uid));
      const clip = u.spec.moves?.attack?.clip;
      const reach = (u.spec.moves?.attack?.reach ?? REACH[clip] ?? REACH_DEFAULT) * u.fig.root.scale.x + (v?.fig ? 0.14 * v.fig.root.scale.x : 0.3);
      // strike from a diagonal on the side the attacker comes from: straight in, the nearer figure would hide the other
      // (the board is seen from a low angle, so depth is short on screen)
      const bx = home.x - d.tgt.x, bz = home.z - d.tgt.z, bl = Math.hypot(bx, bz) || 1;
      if (bl <= reach) return null;
      const side = Math.abs(bx) > 0.2 ? Math.sign(bx) : u.side === "p" ? -1 : 1;
      let ax = (bx / bl) * 0.72 + side * 0.7, az = (bz / bl) * 0.72;
      const al = Math.hypot(ax, az); ax /= al; az /= al;
      const sx = d.tgt.x + ax * reach - home.x, sz = d.tgt.z + az * reach - home.z;
      let s = 0, hop = 0;
      if (r >= d.lift && r < d.contact) { const q = (r - d.lift) / (d.contact - d.lift); s = Math.pow(q, 1.6); hop = 0.05 * Math.sin(Math.PI * q); }
      else if (r >= d.contact && r < d.release) s = 1;
      else if (r >= d.release) { const q = (r - d.release) / d.back; s = Math.pow(1 - q, 3); hop = 0.07 * Math.sin(Math.PI * q); }
      return V3(sx * s, hop, sz * s);
    }
    function glowOf(u) {
      const g = u.glow; if (!g) { R.setHit(u.fig, 0, 0, 0); return; }
      const D = 11 + (g.tier >= 2 ? 3 : 0), fl = D + 1 - g.f;
      const ember = g.kill && u.state === "dying" ? 0.22 : 0;
      if (g.f === 0) R.setHit(u.fig, ...HOT);
      else if (fl > 0 || ember) { const q = Math.max(0, Math.min(1, fl / (D - 1))), k = Math.max(ember, q * q), c = g.kill ? TINT[3] : TINT[g.tier]; R.setHit(u.fig, c[0] * k, c[1] * k, c[2] * k); }
      else { R.setHit(u.fig, 0, 0, 0); u.glow = null; }
    }
    // a shot the arena flies itself (gallery): arrow / bolt / breath from the shooter's emitter to the target
    function emitterOf(u) {
      const a = u.spec.moves?.attack || {}, e = a.emitter;
      if (e && u.fig.J[e.bone]) { u.fig.J[e.bone].updateWorldMatrix(true, false); return u.fig.J[e.bone].localToWorld(V3(...(e.offset || [0, 0, 0]))); }
      return center(u).add(V3(0, 0.15 * u.fig.root.scale.x, 0));
    }
    function flyShots(now) {
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        if (now < s.at || !s.u.fig) continue;
        const to = where(s.to);
        if (!to) { shots.splice(i, 1); continue; }
        const v = units.get(key(s.to.side, s.to.uid)), end = v?.fig ? center(v) : to.clone().add(V3(0, 0.45 * SIZE, 0));
        if (!s.fired) { s.fired = true; s.from = emitterOf(s.u); }
        const q = Math.min(1, (now - s.at) / Math.max(60, s.hit - s.at)), p = s.from.clone().lerp(end, q);
        const col = s.tint ? hex3(s.tint, 2.2) : s.style === "breath" ? [2.4, 0.95, 0.28] : [1.6, 1.1, 2.4];
        if (s.style === "breath") fx.embers(p.x, p.y, p.z, 5, 0.07 * S, col);
        else if (s.style !== "arrow") fx.embers(p.x, p.y, p.z, 2, 0.02 * S, col);   // the bow clip flies its own arrow
        if (q >= 1) shots.splice(i, 1);
      }
    }
    function tick() {                                           // one 60 Hz step: effect ages, hitstop, glow, death beat
      frame++;
      fx.trailStep(trail.on, trail.base, trail.tip, trail.heavy, 0, trail.freeze);
      fx.step(frame);
      for (const u of units.values()) {
        if (u.glow) u.glow.f++;
        if (u.freeze > 0) u.freeze--;
        if (u.pendingHurt && --u.stopF < 0) { u.pendingHurt = false; if (u.clip !== "attack") { u.clip = "hurt"; u.t = 0; } }
      }
      for (let i = dying.length - 1; i >= 0; i--) {
        const u = dying[i], age = frame - u.dieF;
        if (u.glow) u.glow.f++;
        if (!u.shattered) {
          const dt = 1 / FPS, v = u.fly.v;
          v.y -= 13 * (Math.abs(v.y) < 1 ? 0.5 : 1) * dt;
          u.fly.p0.addScaledVector(v, dt); u.fly.rot += 5.5 * dt;
          if (age >= 9 || (u.fly.p0.y <= 0 && v.y < 0)) shatter(u);
        } else if (frame - u.shattered > 21) { scene.remove(u.fig.root); R.dispose(u.fig); dying.splice(i, 1); }
      }
    }
    /** advance and pose everything for this frame (the page renders afterwards); true while anything is on stage */
    function step(now, camera, dt) {
      if (disposed) return false;
      T += dt;
      acc += dt;
      let n = 0;
      while (acc >= 1 / FPS && n < 4) { tick(); acc -= 1 / FPS; n++; }
      if (n === 4) acc = 0;
      fx.setCamera(camera.position);
      let attacker = null;
      for (const u of units.values()) {
        if (!u.fig) continue;
        const p = where(u);
        if (p) u.pos = p;
        if (!u.pos) continue;
        u.fig.root.position.copy(u.pos);
        if (u.state === "live" && u.atk?.dash) { const off = dashOffset(u, u.pos, now); if (off) u.fig.root.position.add(off); }
        if (u.state === "arrive" && (!o.ready || o.ready())) {   // appear between actions, not mid-sequence
          facing(u, u.fig.root.position);
          C.pose(u.fig, "idle", 0, T);
          const { pts, cols, size } = R.voxelsWorld(u.fig);
          fx.assemble(pts, cols, frame, ASSEMBLE, { n: 900, size });
          u.state = "assembling"; u.spawnAt = frame;
        } else if (u.state === "assembling" && frame - u.spawnAt >= ASSEMBLE + 2) {
          goLive(u);
          fx.dustPuff(u.fig.root.position.x, u.fig.root.position.z, 2, 1.2 * S, 0.34 * S, 0.05 * S, 0.3);
        }
        if (u.state !== "live") continue;
        facing(u, u.fig.root.position);
        if (u.clip === "attack") {
          if (u.freeze <= 0) u.t = attackTime(u, now); else u.atk.t0 += dt * 1000;   // hitstop holds the pose
          if (!C.pose(u.fig, "attack", u.t, T)) { u.clip = "idle"; u.t = 0; u.toward = null; u.atk = null; C.pose(u.fig, "idle", 0, T); }
          else attacker = u;
        } else {
          u.t += dt;
          if (!C.pose(u.fig, u.clip, u.t, T) && u.clip !== "idle") { u.clip = "idle"; u.t = 0; }
        }
        glowOf(u);
      }
      for (const u of dying) {
        if (u.shattered) continue;
        const q = new THREE.Quaternion().setFromAxisAngle(u.fly.axis, -u.fly.rot);
        u.fig.root.position.copy(u.fly.p0); u.fig.root.quaternion.copy(q.multiply(u.fly.q0));
        glowOf(u);
      }
      // weapon trail of the current attacker, sampled from the posed weapon
      let on = false, base = null, tip = null;
      if (attacker) {
        const m = attacker.spec.moves?.attack, tr = m?.trail, tm = attacker.atk;
        if (tr && (m.style === "slash" || m.style === "thrust")) {
          const holder = tr.prop ? attacker.fig.props.find((p) => p.grip === tr.prop)?.holder : attacker.fig.J[tr.bone];
          if (holder) {
            holder.updateWorldMatrix(true, false);
            base = holder.localToWorld(V3(...tr.from)); tip = holder.localToWorld(V3(...tr.to));
            on = attacker.t > tm.H - 0.12 && attacker.t < tm.H + 0.1;
            fx.setHero(attacker.fig.root.position.clone().add(V3(0, 0.03, 0)), attacker.fig.root.position.clone().add(V3(0, 0.98 * attacker.fig.root.scale.x, 0)));
          }
        }
      }
      trail.on = on;
      if (on) { trail.base.copy(base); trail.tip.copy(tip); trail.heavy = attacker.atk.tier >= 3; trail.freeze = attacker.freeze; }
      if (o.shots) flyShots(now);
      fx.update(dt);
      return !!(units.size || dying.length || queue.length || shots.length);
    }
    function setPixelRatio(dpr) { for (const u of units.values()) if (u.fig) R.setPixelRatio(u.fig, dpr); }
    function dispose() {
      disposed = true;
      for (const u of [...units.values(), ...dying]) if (u.fig) { scene.remove(u.fig.root); R.dispose(u.fig); }
      units.clear(); dying.length = 0; queue.length = 0; shots.length = 0;
    }
    return Object.freeze({
      set, drop, cue, contact, owns, plan, step, setPixelRatio, dispose, fx,
      each: (fn) => units.forEach(fn),
      has: (side, uid) => units.has(key(side, uid)),
      unit: (side, uid) => units.get(key(side, uid)) || null,
      diagnostics: () => ({ ...stats, cues: stats.cues.slice(), dying: dying.length, baking: queue.length, live: [...units.values()].filter((u) => u.state === "live").length }),
    });
  }
  return Object.freeze({ create, key, TIER, REACH });
})();
