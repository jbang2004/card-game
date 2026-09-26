#!/usr/bin/env node
/* Embed motion-captured clips (Mixamo, the rig our realistic figures share) into src/presentation/voxel/model-anims.js
 * for EmberModelFigures (docs/design/MINIATURES.md).
 *
 *   node tools/anim_art.mjs
 *
 * Input: tools/models/anims/<clip>.fbx — a Mixamo animation downloaded "without skin" at 30 fps (FBX 2019), on the
 * Mixamo skeleton in its T-pose (the files are large and stay out of git, like the models).
 * Per clip it stores, for every frame and every animated bone (fingers left out: our figures keep their fists round
 * what they hold), the bone's turn in world space away from the T-pose — D = G(t) · G(T-pose)⁻¹ — so the runtime
 * can put it on any of our figures: G_figure(t) = D · G_figure(T-pose) (tools/model_art.cjs gives each figure its own
 * T-pose, "tq"), whatever its bone lengths and its resting pose. The hips' travel is stored as a fraction of the
 * hip height. An attack's contact frame is where its striking hand moves fastest (CLIPS[clip].hand).
 * Quaternions go to 16 bits. Needs three (package.json) for its FBX reader; otherwise Node built-ins. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "tools", "models", "anims"), OUT = process.env.ANIM_OUT || path.join(ROOT, "src", "presentation", "voxel", "model-anims.js");   // ANIM_OUT: write elsewhere (a scratch bundle)
// per clip: loop (idle), hand (an attack's striking hand → its contact frame), from / to (a trim, in frames)
const CLIPS = {
  // great sword (the dawn paladin)
  gs_idle: { loop: true }, gs_power_slash: { hand: "RightHand" },
  gs_downward_slash: { hand: "RightHand", to: 22 },    // ends just after the blow: the pack's low guard afterwards is not hers
  gs_impact: {}, gs_powering_up: {}, gs_look: { loop: true }, gs_admire: { loop: true },
  gs_pose: { to: 60 },                         // the salute, held (the rest drops back to guard)
  // victory candidates: an arm raised high
  vc_pump: { loop: true }, vc_pump_restrained: { loop: true }, vc_pump_high: { loop: true }, vc_boxing: { loop: true },
  vc_raise_hand: { to: 78 },                   // the arm goes up and stays up
  // plain standing idles (candidates for a composed, upright rest)
  st_idle: { loop: true }, st_idle2: { loop: true }, st_axe: { loop: true }, ss_look: { loop: true },
  // sword and shield (the squire)
  ss_idle: { loop: true }, ss_high_attack: { hand: "RightHand" }, ss_cross_slash: { hand: "RightHand" }, ss_impact: {}, ss_powering_up: {},
  // magic (the fire apprentice)
  mg_idle: { loop: true }, mg_cast_forward: { hand: "RightHand" }, mg_conjure_throw: { hand: "RightHand" }, mg_hit_right: {}, mg_cheer: {},
  // brute (the rune golem)
  mu_idle: { loop: true }, mu_swipe: { hand: "LeftHand" }, mu_jump_attack: { hand: "RightHand" }, mu_hit: {}, mu_roar: {}, mu_flex: {},
};
Object.assign(CLIPS, {
  // the rest of the cast (see SUITES in src/presentation/voxel/models.js); _m = Mixamo's mirror (left-handed)
  ss_power: { hand: "RightHand" }, ss_down: { hand: "RightHand" }, ss_block_idle: { loop: true }, ss_blocked: {},
  sp_bayonet: { hand: "RightHand" }, sp_torch: { hand: "RightHand" }, kn_idle: { loop: true }, kn_stab: { hand: "RightHand" },
  ax_look: { loop: true }, ax_crouch: { loop: true }, ax_battlecry: {}, ax_spin: { hand: "RightHand" }, ax_down: { hand: "RightHand" }, ax_gut: {},
  zb_idle: { loop: true }, zb_alert: {}, zb_stumble: {}, zb_right: { hand: "RightHand" }, zb_overhead: { hand: "RightHand" },
  bw_formal: {}, tt_taunt: {}, bw_idle: { loop: true }, bw_shoot: { hand: "RightHand" }, bw_hit_front: {},
  cs_one: { hand: "RightHand" }, cs_one_m: { hand: "LeftHand" }, cs_summon: { hand: "RightHand" }, cs_wide: {}, cs_two: { hand: "RightHand" }, cs_upwards: {},
  cs_two_fwd: { hand: "RightHand" }, mg_sweep_m: { hand: "LeftHand" }, mg_ground: { hand: "RightHand" }, mg_blast: { hand: "RightHand" }, mg_heal: {}, mg_idle_m: { loop: true },
  pr_sway: { loop: true }, pr_arms_up: {}, st_suitcase: { loop: true }, st_suitcase_m: { loop: true }, st_look: { loop: true },
  mu_stretch: { loop: true }, fi_bounce: { loop: true }, kk_bicycle: { hand: "RightFoot" },
  pu_cross: { hand: "RightHand" }, pu_hook: { hand: "RightHand" },
});
Object.assign(CLIPS, {
  // second pass (the motion review): a real draw and loose, a sheathing, a scythe's low sweep, a leaping great-sword
  // blow (its legs are replaced by the idle's: an overhead slam), chest-pounding, the left-handed raise and upward cast
  bw_aimfire: { hand: "RightHand" }, bw_power: { hand: "RightHand" }, bw_aim_idle: { loop: true }, kn_sheath: {},
  zb_swipe: { hand: "RightHand" }, gs_low: { hand: "RightHand" }, gs_jump_atk: { hand: "RightHand" }, ax_chest: {},
  vc_raise_hand_m: { to: 78 }, cs_upwards_m: { hand: "LeftHand" },
});
CLIPS.gs_power_slash = { hand: "RightHand", post: 7 };     // the frost king's slash ends on the blow (it re-raised after)
CLIPS.cs_upwards = { hand: "RightHand" };
// the conjure-and-throw clip spends five seconds conjuring: keep the gather and the throw
CLIPS.mg_conjure_throw = { hand: "RightHand", from: 118, to: 196 };
// the mountain's leap: the crouch, the jump, the fall onto its fists and the kneel after it (its fastest hand is the
// raise, not the slam, so the automatic trim would stop in the air)
CLIPS.mu_jump_attack = { hand: "RightHand", from: 0, to: 92 };
const FINGER = /(Thumb|Index|Middle|Ring|Pinky)\d|_End$/;
const FPS = 30;

/** the frame (over the whole clip) where the named bone moves fastest, smoothed over three frames */
function contactOf(bones, byBone, name, g, n0) {
  const b = bones.find((x) => x.name.replace(/^mixamorig:?/, "") === name); if (!b) return null;
  const P = [];
  for (let f = 0; f < n0; f++) {
    for (const [bn, it] of byBone) { if (it.quaternion) bn.quaternion.fromArray(it.quaternion.evaluate(f / FPS)).normalize(); if (it.position) bn.position.fromArray(it.position.evaluate(f / FPS)); }
    g.updateMatrixWorld(true); P.push(b.getWorldPosition(new THREE.Vector3()));
  }
  let best = 0, hit = null;
  for (let f = 2; f < P.length - 1; f++) { const s = P[f - 1].distanceTo(P[f - 2]) + P[f].distanceTo(P[f - 1]) + P[f + 1].distanceTo(P[f]); if (s > best) { best = s; hit = f; } }
  return hit;
}

function convert(id, file) {
  const buf = fs.readFileSync(file);
  const g = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  const bones = []; g.traverse((o) => { if (o.isBone) bones.push(o); });
  const nameOf = (b) => b.name.replace(/^mixamorig:?/, "");
  const clip = g.animations[0], cfg = CLIPS[id];
  g.updateMatrixWorld(true);
  const restQ = bones.map((b) => b.getWorldQuaternion(new THREE.Quaternion()).invert());
  const hips = bones.find((b) => nameOf(b) === "Hips"), hipRest = hips.getWorldPosition(new THREE.Vector3()), H = hipRest.y;
  // sample every track at 30 fps
  const byBone = new Map();
  for (const tr of clip.tracks) {
    const [bn, prop] = tr.name.split("."), b = bones.find((x) => x.name === bn || nameOf(x) === bn.replace(/^mixamorig:?/, ""));
    if (b) (byBone.get(b) || byBone.set(b, {}).get(b))[prop] = tr.createInterpolant();
  }
  const used = bones.filter((b) => byBone.get(b)?.quaternion && !FINGER.test(nameOf(b)));
  const n0 = Math.round(clip.duration * FPS) + 1;
  // an attack keeps at most a second before its contact and half a second after (battle beats are short); an explicit
  // from / to wins
  let from = cfg.from ?? 0, to = Math.min(n0 - 1, cfg.to ?? n0 - 1);
  if (cfg.hand && cfg.from == null && cfg.to == null && !cfg.whole) {
    const c = contactOf(bones, byBone, nameOf(bones.find((b) => nameOf(b) === cfg.hand)), g, n0);
    if (c != null) { from = Math.max(0, c - (cfg.pre ?? 30)); to = Math.min(n0 - 1, c + (cfg.post ?? 16)); }
  }
  const n = to - from + 1;
  const q = new Int16Array(n * used.length * 4), hip = new Int16Array(n * 3), q1 = new THREE.Quaternion(), wp = new THREE.Vector3();
  const handB = cfg.hand && bones.find((b) => nameOf(b) === cfg.hand), handP = [];
  for (let f = 0; f < n; f++) {
    const t = (from + f) / FPS;
    for (const [b, it] of byBone) {
      if (it.quaternion) b.quaternion.fromArray(it.quaternion.evaluate(t)).normalize();
      if (it.position) b.position.fromArray(it.position.evaluate(t));
    }
    g.updateMatrixWorld(true);
    used.forEach((b, k) => {
      b.getWorldQuaternion(q1).multiply(restQ[bones.indexOf(b)]);             // D = G(t) · G(T)⁻¹
      if (q1.w < 0) q1.set(-q1.x, -q1.y, -q1.z, -q1.w);
      [q1.x, q1.y, q1.z, q1.w].forEach((v, c) => (q[(f * used.length + k) * 4 + c] = Math.round(v * 32767)));
    });
    hips.getWorldPosition(wp).sub(hipRest).divideScalar(H);
    [wp.x, wp.y, wp.z].forEach((v, c) => (hip[f * 3 + c] = Math.round(Math.max(-3, Math.min(3, v)) * 10000)));
    if (handB) handP.push(handB.getWorldPosition(new THREE.Vector3()));
  }
  // contact: the striking hand's fastest frame (smoothed over three frames)
  let hit = null;
  if (handP.length > 4) {
    const sp = handP.map((p, f) => (f ? p.distanceTo(handP[f - 1]) : 0));
    let best = 0; for (let f = 2; f < sp.length - 1; f++) { const s = sp[f - 1] + sp[f] + sp[f + 1]; if (s > best) { best = s; hit = f; } }
  }
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString("base64");
  console.log(`${id}: ${n} frames (${(n / FPS).toFixed(2)} s), ${used.length} bones${hit != null ? `, contact at frame ${hit} (${(hit / FPS).toFixed(2)} s)` : ""}`);
  return { fps: FPS, n, bones: used.map(nameOf), q: b64(q), hip: b64(hip), ...(cfg.loop ? { loop: 1 } : {}), ...(hit != null ? { hit } : {}) };
}

// only what a figure's suite plays is embedded (SUITES in the runtime); the other clips stay on disk as candidates
const suites = fs.readFileSync(path.join(ROOT, "src", "presentation", "voxel", "models.js"), "utf8").match(/const SUITES = \{[\s\S]*?\n  \};/)[0];
const used = new Set([...suites.matchAll(/"([a-z]{2}_[a-z0-9_]+)(?:@m)?"/g)].map((m) => m[1]));   // (a clip mirrored at run time, "<clip>@m", needs its clip)
const out = [];
for (const id of Object.keys(CLIPS)) {
  if (!used.has(id) && !process.env.ANIM_ALL) { console.log(`${id}: no suite plays it — left out`); continue; }   // ANIM_ALL=1: every clip (a scratch bundle to choose from)
  const f = path.join(SRC, id + ".fbx");
  if (!fs.existsSync(f)) { console.log(`${id}: no ${id}.fbx yet — skipped`); continue; }
  out.push(`  ${id}: ${JSON.stringify(convert(id, f))},`);
}
fs.writeFileSync(OUT, `/* Generated by tools/anim_art.mjs from tools/models/anims/*.fbx (Mixamo) — do not edit. */\nconst EmberModelAnims = {\n${out.join("\n")}\n};\n`);
console.log(`${path.relative(ROOT, OUT)}: ${out.length} clips, ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
