# Emberfall Foley credits

These prepared cues derive from Kenney audio packs, distributed under Creative Commons Zero (CC0 1.0). Kenney permits personal and commercial use; attribution is optional. Original license text is retained in LICENSES/.

Source packs:

- Casino Audio 1.1 — https://kenney.nl/assets/casino-audio
- Impact Sounds 1.0 — https://kenney.nl/assets/impact-sounds
- RPG Audio 1.0 — https://kenney.nl/assets/rpg-audio

Creator: Kenney / Kenney Vleugels. License: https://creativecommons.org/publicdomain/zero/1.0/

Prepared on 2026-09-08: decoded to mono PCM, trimmed, 1 ms fade-in and 12 ms fade-out applied, peak scaled to -5 dBFS, encoded as 44.1 kHz MP3 at 128 kbps. Card landing cues have been aligned to their strong contact transients. These are licensed source Foley, not AI-generated recordings.

| File | Source filename | Pack | Duration | Preparation gain suggestion |
| --- | --- | --- | ---: | ---: |
| card-pickup.mp3 | card-slide-1.ogg | casino-audio | 0.432 s | 0.32 |
| card-draw.mp3 | card-slide-6.ogg | casino-audio | 0.583 s | 0.44 |
| card-play.mp3 | card-place-1.ogg | casino-audio | 0.496 s | 0.58 |
| card-play-alt.mp3 | card-place-2.ogg | casino-audio | 0.210 s | 0.62 |
| table-thump.mp3 | impactWood_heavy_001.ogg | impact-sounds | 0.310 s | 0.28 |
| swing.mp3 | knifeSlice.ogg | rpg-audio | 0.413 s | 0.45 |
| impact-light.mp3 | impactPunch_medium_001.ogg | impact-sounds | 0.308 s | 0.64 |
| impact-heavy.mp3 | impactPunch_heavy_000.ogg | impact-sounds | 0.534 s | 0.79 |
| death-debris.mp3 | impactMining_003.ogg | impact-sounds | 0.708 s | 0.39 |
| shield-crack.mp3 | impactGlass_heavy_001.ogg | impact-sounds | 0.429 s | 0.52 |
| turn-bell.mp3 | impactBell_heavy_000.ogg | impact-sounds | 1.316 s | 0.27 |
| equip-latch.mp3 | metalLatch.ogg | rpg-audio | 0.238 s | 0.48 |

All 12 MP3 files were decoded and measured after encoding. Total duration is 5.977 s and total MP3 size is 108,775 bytes. Measured decoded peaks are between -5.481 and -4.947 dBFS; relative -45 dB onset is at most 2.971 ms. Strong card landing onset is 2.993 ms. No subjective listening or in-game browser verification is claimed by this preparation step.

death-debris is a mineral/mining Foley layer for a composite crumble effect. Draw and swing intentionally retain movement before their peak. These preparation gain suggestions are not the final mixer values. Runtime cue timing, gain mixing and magical layers are maintained in src/platform/audio.js.

Per-file source and derived SHA-256 hashes, processing measurements and provenance are recorded in manifest.json.
