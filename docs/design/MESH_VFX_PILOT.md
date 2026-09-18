# 3D attack pilot — breath, lightning, sword

Baseline: `73d50ba67cd45c0941ac8fa9569c7d1ce33ccd67`.
This is an incremental change to the real game, not a replacement game or scene.

## Explicit scope change

The user requested the geometry-based renderer from the independent Ember Steel
VFX demonstrations. The new `src/vfx3/renderer.js` is derived from that renderer's
matrix, mesh, normal-lighting and HDR/post-processing code. It has been adapted
for a transparent stage-aligned surface with real Z coordinates, depth testing
and a single host-owned clock. No third-party engine or model files are loaded.

This pilot supersedes the **single WebGL backend** requirement in
BATTLE_PRESENTATION_V2 §2.7 for a transitional period: `breath`, `lightning`,
`bolt` and `slash` exclusively use the new renderer when available; other
recipes continue using EmberFx2. Each cast goes to exactly one backend.
The old impulse/cutin/camera director remains authoritative. There is no new
independent animation loop in either new runtime module.

It also replaces the old universal 250ms residue limit **only for these new
recipes**: breath has a 1100ms tail, lightning 320ms, sword 1000ms, multiplied by
presentation timeScale. Tails do not block later actions and never represent
persistent status or additional damage. The rule engine and its data files are
unchanged. Existing contact deadlines, HP updates and sound events are retained.

## Rendering and constraints

- Breath (R2): depth-sorted, birth-relative flame/smoke billboards, bright inner
  flame parcels and deterministic embers. The continuous cone mesh was removed.
  There is a 480ms feeding stage after first contact, followed by natural cleanup. This is not a fluid simulation. The portrait-relative
  emitter is an authored default, not a recovered per-character mouth rig.
- Lightning / bolt: branching 3D tube meshes with stable endpoints, bounded
  topology changes, a bright core, secondary branches and contact sparks.
- Sword (R2): a rigid metal blade falls from an elevated, slightly tilted pose
  with cubic acceleration. The local tip at 0.98 meets the target's foot plane
  at the director's exact contact deadline. It stays planted; no rebound or stretch.
  Centre-out fissures, separated lips, branching seams, fixed-size rubble and dust
  are transient geometry only, not a destroyed card or a changed board state.
- The old illustrated board and cards remain Canvas/DOM. No claim is made that
  DOM artwork becomes a full 3D scene or receives physically correct shadows.
  The borrowed renderer retains shadow machinery, but the pilot does not cast
  mesh shadows onto DOM cards. The camera is stage-aligned orthographic.
- Transparent framebuffers preserve the game beneath them. The pilot introduces
  no full-screen refractive warp. Existing director camera impulses are shared.
- Reduced motion clears/disables the new layer. Low quality lowers resolution
  and flame/particle counts. Failure to initialize it retains old FX; total
  WebGL failure retains the existing game's DOM-only fallback.

## Files and build

`renderer.js`: math, geometry, lit meshes, buffers and transparent composition.
`runtime.js`: immutable attack descriptors, pure time samples, three recipes,
replay/cleanup/quality controls. `presentation/fx-stage.js`: exclusive dispatch.
`effects.js`: sends absolute start/contact markers and prelaunches the sword;
the contact callback does NOT launch it again. Build registration is explicit.

```
python3 build.py
node --test tests/*.test.cjs
python3 tools/vfx3/export_demo.py
```

Production: `index.html` / `dist/` as before. Exported inspection edition:
`Card_Game_3D_VFX_Demo.html`. The latter deliberately enables fixture/debug
access and uses an in-memory storage boundary; it is not the production page.
Its top buttons dispatch REAL rule actions in a disposable quick-demo battle.
The seek bar replays only the last 3D FX; it does not rerun rules or card motion.
Do not confuse that inspection mode with a replay of the full match.

`EmberFx2.mesh3d` exposes `emit`, `clear`, `setQuality`, `last`, `stats`,
`diagnostics`, `replay(ms)` and `resume()`. All times at the boundary are ms;
recipe geometry uses seconds internally. `emit` accepts stage CSS boxes and
absolute `startedAt` / `contactAt`. `replay` uses time relative to the last start.

## Validation boundary

Tests and their logs are included in the delivery. The local focused browser
checks load exact built scripts into Chromium with an **in-memory test-only**
debug-gate substitution because this environment blocks localhost navigation.
They verify actual rule dispatch, not a mock renderer. This does not establish
cross-origin persistence, HTTP security, physical-phone performance or Safari
compatibility. Mobile checks are viewport simulations. The original test suite's
missing-source-asset skips remain explicit; they are not counted as passes.

`tools/vfx3/record.py` captures live rule-driven attacks and a separately labelled
quarter-speed effect-only inspection. Video encoding FPS is not a GPU benchmark.
