# Starfire interface assets · 2026-09-09

Provider: built-in image_gen. No runtime image API. Gemini skill credential probe returned `GEMINI_API_KEY=MISSING`; the built-in tool was used. Both source PNG files have real alpha and were inspected; WebP export preserves alpha. No card artwork changed.

## starfire-seal

Create one original fantasy game UI emblem, transparent background, front-facing circular antique brass and walnut seal, graceful rising ember/flame with warm amber crystal, four star points and small teal enamel accents. Thick readable silhouette for 48–160px UI, upper-left lighting, engraved ash and star motifs, premium hand-painted tabletop aesthetic compatible with anime art. No text, numbers, watermark, scene or grid.

Generated at 1254×1254; runtime 384×384 WebP quality 92. Used for menu, brand and results. Source and runtime SHA-256 are in manifest.json.

## cabinet-rim

Create one original production fantasy UI border frame, 1536×1024, orthographic, transparent center and outside. Rectangular dark walnut and antique brass frame with parallel straight stepped edges, faceted squared corner fittings, restrained star engravings, tiny teal corner enamel. Upper-left lighting, readable bevels, no text, no icons, no UI screenshot, no decorations inside the opening. Designed for CSS nine-slice border-image.

Generated at 1536×1024; runtime 1024×683 WebP quality 90. CSS slices 17% vertically / 12% horizontally; central image area is not drawn. Used for main menu and modal rims. Source and runtime SHA-256 are in manifest.json.

Packing uses Pillow already declared by requirements-art.txt; routine builds only use the Python standard library to validate hashes and produce src/ui-assets.js. Full original tool prompts were issued in the creation task; this file records the production briefs and processing parameters.

## Dedicated component ornaments · 2026-09-09

Provider: built-in `image_gen`. The existing literal credential probe result was `GEMINI_API_KEY=MISSING`; no Gemini or client-side image API was used. Full verbatim prompts are retained in `source-prompts-20260909.json` and each asset's `sourcePrompt` in `manifest.json`. Original PNGs are copied unchanged under `sources/`; the runtime files preserve generated alpha. Runtime processing uses the project's declared Pillow dependency, with Lanczos resizing and WebP quality 92 / method 6.

| Key | Source | Runtime | Processing and purpose |
| --- | --- | --- | --- |
| hero-laurel | 2172×724 RGBA | 750×250 WebP | Full source, resized. Open bronze laurel arch with amber crest; dedicated hero portrait crown, with transparent interior. |
| collection-spine | 1024×1536 RGBA | 128×715 WebP | Crop `[383,24,639,1453]` around the narrow object, then resize. Burgundy leather book binding and three brass ribs for collection page edges. |
| covenant-ring | 1254×1254 RGBA | 384×384 WebP | Full source, resized. Four rune stones on a silver-bronze and teal ring, with transparent center for live content. |

Inspection: source alpha ranges are 0–255 (laurel/ring) and 0–254 (spine); runtime alpha ranges are 0–255. Laurel and ring center pixels have alpha 0. The spine's broad apparent background in the generation preview is alpha 0–1, and its object bounds at alpha >1 are `[391,32,631,1445]`; runtime crop leaves 8 px padding around those bounds. No background removal or repainted pixels were used.

Actual-size PNG review copies are retained in `artifacts/ui-assets-review/` (local, excluded from source control): laurel at 250×83, spine at 44×246, ring at 96×96. Each was visually inspected at these sizes: laurel leaves and central crest remain distinct; spine ribs and central teal buckle remain legible; ring silhouette and all four stone colors remain distinct. Fine etched symbols are ornament, not interaction indicators. Live selection marks and progress must stay separate DOM elements. In-game placement/overlap verification is handled by the coordinating UI pass.

### Collection spine revision 2 — composition review rejection

The initial 5.6:1 object appeared as a short floating handle in the narrow collection-column gap. It was rejected during integration review. A new image was generated with a near 14:1 physical silhouette, five leather segments, four slim riveted binding bands, and thin end caps. The old PNG remains archived as `sources/collection-spine.png`; it is not the active manifest source.

Active source: `sources/collection-spine-v2.png`, 1060×1484 RGBA, generated alpha 0–255. Crop `[478,6,584,1470]` produces the runtime `collection-spine.webp`, 106×1464 (13.81:1), WebP quality 92 / method 6 without resizing or anisotropic scaling. The visible opaque body spans about 100 px, with only 2–3 px edge padding. Runtime alpha is preserved. Full prompt is retained in `collection-spine-v2-prompt.txt` and the updated manifest `sourcePrompt` field. An actual-size review at 43×594 is retained as `artifacts/ui-assets-review/collection-spine-v2-size-check.png` (local, excluded from source control); all five segments and four rivet bands remain visible and continuous.
