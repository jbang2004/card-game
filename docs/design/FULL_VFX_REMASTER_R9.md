# R9 · Battle VFX Remaster

## Scope
This is a source implementation inside the existing card game, not a standalone substitute game. The user-approved original flame and R8 benchmark animations are the frozen baseline. All 18 names in the existing `EmberFx2Engine.SKILL_ORDER` can now use the mesh runtime. The retained EmberFx2 backend supplies authoritative plans, generic director services and fallback; it is not deleted.

The new pure module defines 19 non-benchmark families (including utility cues), using the existing renderer: arrow, spear, claw, slam, fireball, frost, frost-field, holy, nature, void, siphon, arcane, bladeCross, heal, ward, buff, summon, demise, contact. Breath and lightning retain their approved runtime implementations. Blade-family characters retain their individual R6 trajectories; non-benchmark sword surfaces gain dark-backed sharp edges. The three R8 benchmark branches return before that additional styling and are unchanged.

## Rendering and choreography
- Rigid arrows: fixed shaft, split-metal arrowhead, independently translated speed history, local puncture. Spear uses a longer rigid shaft and slightly bowed flight. The tip, not the sprite center, reaches the target at contact.
- Claws: three staggered crescents, dark incision beneath the bright edge, short-lived parallel wounds. One rule attack, not three damage events.
- Weight: forged axe impression for berserker/titan, faceted rock for golems, woody mass for treants; descending center of mass, pressure ellipse, fragments, dust and branching scars.
- Fireballs: moving layered fire parcels with the existing flame shader, then expansion, debris and smoke. This is not a fluid simulation. The dragon-breath source remains byte-identical.
- Ice: sharp crystal polygons, card-local frost, branching fractures; area spells create one visual instance per affected target with one audible cast group. Existing freeze rules are unchanged.
- Void: dark aperture with rotating inward spirals; siphon visibly flows from target to source. Arcane uses constructed polygon sigils instead of another colored explosion.
- Heal, ward and buff are resolved by source identity/semantic context. For example `renew` heals; `shield`/`absolution` form a shield; `rally`/`blessing`/`huntinghorn` buff; wolves/muster show summoning. Original mechanics decide whether any shield, freeze or healing actually occurs.
- Summon/death retain the existing DOM card landing/dissolve and layout. New mesh accents supplement those events; they do not create or delete units.

## Ownership, replay and sound
`src/vfx3/remaster-arts.js` is a deterministic, pure geometry sampler. `src/vfx3/remaster-cues.js` synthesizes original PCM samples. `src/presentation/remaster-feedback.js` owns temporary DOM pose transforms and schedules sounds against the existing absolute contact timestamp. R8's own feedback implementation is not edited.

The director pre-starts attacks and provides immutable origin/target snapshots, identity references and contact deadlines. Mesh-supported attacks suppress the duplicate legacy source lunge/impact sound; retaliatory damage, rule ordering and numbers remain the original system. Remaster target marks follow live target pose; manual replay reconstructs that pose.

Auxiliary cues (`visualOnly`) never replace the last primary attack or count as new primary attacks. A grouped cast is replayed as a group, including its later summon/death accents. Secondary AoE instances are silent. The recording/replay fixture is export-only, uses in-memory saves, and does not change production debug gates. Replay preserves already-resolved numbers; it does not replay damage or rewind the entire game state.

A 1e-6 millisecond terminal tolerance avoids non-associative floating-point residue after subtracting absolute host timestamps. This is not a frame-sized truncation. Active instances are capped at 24; clear/cancel/reduced motion dispose visuals and pose ownership. There is no additional animation timer in the new sampler.

Explicit-target spells with no damage/status contact (e.g. direct destruction) keep the actual declared target and existing cast deadline; untargeted spells never adopt arbitrary targets from an action payload. The shield fixture uses an unshielded ally so the actual grant and its visual endpoint are exercised.

## What is intentionally not replaced
Rules, card stats, campaigns, saves, anime artwork, board, card UI, hand layout, ordinary UI transitions and existing sound settings are retained. These are family-authored VFX with role-aware variants, not a unique newly modeled actor/animation for every card, and not commercial-quality certification. DOM and WebGL still have limited cross-layer occlusion. There are no permanent card damage textures, true fluid simulation or automatic website deployment.

## Tests and reproduction
```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify_remaster.py
xvfb-run -a python3 tools/vfx3/verify_benchmarks.py
xvfb-run -a python3 tools/vfx3/record_remaster.py
python3 tools/vfx3/assemble_remaster.py
```
Python browser tools use Playwright with Chromium; Pillow/NumPy/FFmpeg assemble the review. Font paths are local, not distributed. Source-only tests require Node built-ins. Final observations are recorded in `docs/qa/remaster-r9.json`, not inferred from a test count or a screenshot.
