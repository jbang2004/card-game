# R8 — visual hierarchy, contact and material alignment

Baseline: R7 `9aa2d9baa835307b958183337ef6dd4ceab583f2`.
Only the three reviewed benchmark arts are refined. This is an implementation
of the art direction, not a pixel-identical reproduction of generated storyboards.

## Holy / judgment

The authored half-width grows from 0.105 to 0.202 target-card widths. This is
constant geometry during flight, not animated stretching. A solid concave seal
sits at 48% of blade height, with a few thin accent lines around the visible
bevelled face. Gold stays saturated at its midtones, the narrow rim is bright.
The main light has a 45 ms contact plateau followed by a fast falloff. Fan-shaped
energy is born at contact (never before), then detaches into rising angular motes.
Shader erosion breaks the blade surface during the release, rather than reducing
one global alpha on an otherwise identical shape. A dark puncture and asymmetrical
branched fractures remain after the impact flash.

## Shadow / night

Replace the white centre-line with a dark tapered body and ONE sharp violet edge.
The moving front and short trailing shadow wisps share one direction. On contact,
small shards move mostly along the thrust; there is no big radial explosion or
holy-style crack pattern. A black incision with one lit lower lip and pointed
ends lasts briefly on the target card. The 18 ms impact plateau is shorter than
holy; a short release keeps the attack quick rather than spectacular.

## Ice / frost

The main blade has an angular, piecewise cross-section, discontinuous optical
planes and solid asymmetric crown spikes. No circular gold seal recolored blue.
Larger faceted crystals (3.2–8.3 CSS-stage px scale, plus blade-breakup shards)
are intentionally prioritized over tiny glitter. A locally clipped frost plate
uses irregular cell boundaries and fern branches; it is not a full-card frozen
status or a new gameplay mechanic. Mist, crystals and film have separate tails.

## Attachment and clock

The existing event contact remains authoritative. Target feedback now includes
its previously authored bounded rotation. The VFX render adapter applies the
same rigid angle about the target-card centre after contact, together with the
existing live/replay translation mapping. Incoming blades remain vertical before
contact. No nonuniform card scaling, no new damage, no rule changes.

## Unchanged

Reference flame source, fire/smoke shader branches, post-processing, audio cue
bank, rule engine, card/campaign data, shared timing constants and all other R6
sword recipes are unchanged. Added work is isolated to `benchmark-arts.js`, its
four shader modes (13–16), the benchmark feedback adapter and inspection UI.

## Verification and limits

370 Node tests: 362 pass, 8 missing-art-source skips, 0 fail. 102 targeted browser
checks pass on Xvfb/Chromium/ANGLE Mesa llvmpipe. Test logs/byte invariants are in
`docs/qa/benchmark-r8.json`. Direct HTTP navigation was blocked by administrator
policy in this execution environment; browser testing uses executable in-memory
HTML. No claim of HTTP/file-origin storage, full E2E, real device performance,
Safari or production aesthetics certification.
