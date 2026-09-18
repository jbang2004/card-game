# R10 — Readability and contact impact

Based on feature-branch commit `412e135da6645ece1c8ba31d56663b1099222fcf`.
The user requested stronger, more legible effects without changing the approved
flame and three sword benchmarks. These changes stay in the existing game.

## Changes
- A single contact envelope holds its peak for approximately 62–66 ms and then
  decays monotonically. It does not add flashes, damage ticks or input delay.
- Arrows and spears have larger, invariant shafts, visible fletching and a defined
  contact tip. Traces are independent of weapon length. No stretching in flight.
- Claws use wider opaque cuts under fine bright lips; heavy impacts use a larger
  rigid weapon/stone shape, directional energy release, debris and dust.
- Fireball particles have different phases, rotations and lifetimes rather than
  identical tiles. Flame fronts vary in direction, length and curl; no global
  exposure boost, fullscreen flash or background distortion was introduced.
- Ice gets optical facets and uneven growing crystals. Area frost uses stable
  per-recipient seeds; void arms are dark shapes with narrow luminous boundaries.
- Shield gains optical faces, stronger contour and a traveling glint. Healing,
  buff, drain, arcane and summon silhouettes are stronger but remain semantic:
  no extra freeze, DoT, healing or status is added by presentation.
- The target response grows quickly, briefly holds and settles with no recovery
  oscillation. DOM feedback caps total target displacement at 14 CSS px and angle
  at 3.4 degrees. Cards are neither squashed nor stretched.
- Near-simultaneous nonutility effects (contact deadlines within 260 ms) attenuate
  decorative glows by max(0.42, 1/sqrt(n)); primary geometry is not attenuated.

## Unchanged
The complete files for the original flame, R8 benchmark geometry/cues/feedback,
the renderer, rules, card/campaign content and timing are checksum-checked by
`tests/impact-r10.test.cjs` against the approved R9 baseline. Existing audio cues
and their contact deadlines are unchanged. No main merge or deployment.

## Review / reproduction
```
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify_remaster.py
xvfb-run -a python3 tools/vfx3/verify_benchmarks.py
xvfb-run -a python3 tools/vfx3/capture_impact.py --baseline /path/to/R9.html --video
python3 tools/vfx3/assemble_impact.py
```
`R9.html` should be the R9 exported inspection edition. Baseline and new capture
use the same fixture sequence, seed, viewport, crop, and phase relative to contact.
Caption bars are outside the battle; image exposure and colors are not retouched.
The full-game HTML uses temporary memory storage for its inspection battle.

## Verification boundaries
523 Node tests: 515 passed, 8 skipped for absent original art sources, 0 failed.
411 remaster + 102 benchmark Chromium assertions passed on final presentation
source. Functional / geometry tests are not a commercial art quality certification.
Chromium ANGLE/Mesa software rendering with in-memory HTML loading was used.
Local HTTP navigation was actually attempted but blocked by runtime policy.
No physical mobile, Safari, real-origin storage, full E2E or hardware-FPS claim.
Video is actual deterministic frame capture at 24 fps. Sound is the identical
runtime PCM mixed offline at the same cue times, not a live speaker recording.
