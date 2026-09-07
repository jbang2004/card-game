# Combat effect textures · 2026-09-08

All 13 runtime lossless WebP files are local derivatives of two author-published **CC0 1.0 Universal** collections:

- **Kenney — Particle Pack**: https://kenney.nl/assets/particle-pack. Eight masks: blade arc, claw scratches, vortex, fire, smoke ring, energy ring, glint, debris. The unused smoke mask and its selected original were removed. Original license: `KENNEY-LICENSE.txt`.
- **Mikodrak — 2D Spell Effects**: https://opengameart.org/content/2d-spell-effects. Five frame sequences authored for Nyrthos: blue column, fiery slash, fire explosion, branching burst, energy burst. Author's CC0 declaration is retained in `sources/mikodrak-source.html`.
- License terms: https://creativecommons.org/publicdomain/zero/1.0/.

`manifest.json` records source URLs, author, licensing evidence, original ZIP hashes, selected original file/frame hashes, runtime WebP / decoded RGBA hashes, crops and target anchors. Original selected files and source-page snapshots are retained under `sources/`. No Hearthstone/Blizzard game files were used.

Textures are 256×256. Animation cells are 128×128, eight columns, row-major, with transparent unused cells. All frames in a sequence use one shared crop and fixed target anchor, preventing jitter. The original animations are small particle renders, used as detail layers with runtime geometry and authored motion; these are not native HD cinematic sequences.

Runtime WebP bytes: **879,870**. Base decoded RGBA: **11,534,336 bytes / 11.0 MiB**. Maximum atlas width: 1024. Static-mask tints are cached with a 48-entry cap; colored full atlases are never copied for tinting (one shared 128px scratch cell handles school corrections). `src/presentation/vfx.js` shares the existing combat Canvas clock and keeps bounded queues; decorative shards yield to target contact cues.

Normal build: `python3 build.py` verifies and packs frozen images using the standard library. To deliberately rebuild derivatives after editing retained originals: `.venv/bin/python tools/repack_vfx.py` with `requirements-art.txt` configured, then build. `contact-sheet.jpg` shows representative texture/animation frames. Runtime animation duration comes from combat profiles, not source GIF/frame playback timing.

Lossless cleanup preserves all RGBA bytes, frame dimensions and anchors. The manifest retains previous PNG hashes for the conversion audit. See `docs/MEDIA_CLEANUP.md` for build-size and dependency cleanup results.
