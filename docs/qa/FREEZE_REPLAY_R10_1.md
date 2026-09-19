# R10.1 — freeze follows projectile contact in inspection replay

Baseline: 371668bf13caf15489042c559e62902875c7feb4.

## Diagnosis
The R10 inspection replay sought mesh VFX and DOM pose tracks, but left card health, frozen CSS and snowflake icons at the final post-action state. Its exported recordings therefore showed already-frozen targets before the projectile arrived. Real frostbolt and nova dispatches were observed separately: visible frozen classes appeared after, not before, their mesh contact deadlines in the tested cases.

## Fix
An export-only read-only projection captures target DOM health/status before and after the real action, switching at each target's own contact time during seeking/playback. Backward seeking restores the previous appearance; previously frozen targets stay frozen. Stopping or changing fixtures restores the resolved appearance. Removed targets are not recreated. No rule writes, extra damage, new status or timer delays. This is not a complete hand/death/board replay implementation. All production src/ files and the renderer are unchanged.

## Checks actually executed
- Node full suite: 542 tests, 534 passed, 8 missing-art-source skips, 0 failed (19 new replay-state tests).
- Targeted browser suite: 117 passed, 0 failed, desktop 1440x900 and mobile-sized 390x844. Includes real dispatch order, per-target group deadlines, pre-contact and post-contact icons/health/labels, backwards seek, no rule mutation or new sound, stop/reset and cleanup.
- Two output builds and inspection export passed. Chromium via Xvfb/ANGLE software rendering, in-memory HTML; not real phone, Safari, HTTP/file-origin storage or full end-to-end acceptance.

Run: python3 build.py && python3 tools/vfx3/export_demo.py
Tests: node --test tests/*.test.cjs
Browser: xvfb-run -a python3 tools/vfx3/verify_freeze_order.py

The old R10 video cannot update itself. Re-export recordings using the corrected inspection edition. This patch is on the feature branch, not merged or deployed.
