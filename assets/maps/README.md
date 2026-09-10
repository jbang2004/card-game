# Layered adventure map

The active map is assembled from independent artwork and live UI. No screen-sized UI bitmap is used.

## Runtime layers

- `walnut.webp`: repeating low-contrast walnut surface, under DOM borders and corner ornaments.
- `terrain.webp`: continuous unlabelled parchment geography, fitted without distorting its aspect ratio.
- `regions/*.webp`: six independently generated location illustrations, keyed by the campaign boss ID.
- CSS: arched frames, paper nameplates, pennants, chapter medallions, selection/current/completed states.
- SVG: route curves and waypoints measured from the current DOM landmark positions.
- DOM: names, boss health, campaign progress, inspection details, relics and action controls.

`src/presentation/adventure-map.js` owns presentation only. It reads the current campaign and never alters combat state. Its resize observer is disposed through `EmberDialogs.onClose`. The DOM order always remains 01–06 even where a serpentine desktop layout reverses a visual row.

Desktop uses three columns, intermediate containers two, and portrait containers a single vertical itinerary. The normal font sizes and image proportions are retained. One vertical scroll surface owns overflow; the header and footer remain outside it. A scroll cue appears only when content actually overflows. Opening the map waits for all artwork to decode before revealing the landmarks, with a retry control on failure.

## Artwork provenance and processing

Generated with the built-in imagegen tool by three authorized asset subagents; reviewed and integrated by the main agent. Sources are in `sources/`; runtime images are WebP quality 88. Terrain retains 1536×1024, wood is 768×768, and each location is 640×640. Conversion uses the available `cwebp` tool; it does not crop or repaint the generated artwork.

Common brief: premium Japanese fantasy RPG environments, fine etched detail and mineral-pigment painting, warm antique gold, ordered visual richness; no text, numbers, UI, frames, map badges or character portraits. Each asset is generated independently.

| Source | Specific generation brief |
| --- | --- |
| terrain.png | Full-bleed subdued parchment world geography: volcanic northwest coast, northern ancient forest, violet northeastern mountains, southeastern glacier, southern ashlands, southwestern cold coast, a central river valley. Continuous terrain, no routes, compass or location markers. |
| walnut.png | Full-bleed deep chocolate walnut, fine straight grain, subtle wear, uniform diffuse light, no plank seams, objects, edge lighting or decorations. |
| warden.png | Obsidian Gothic gateway above a lava canyon; orange-gold molten rivers, charcoal mountain depth. Central architecture designed for an arch crop. |
| queen.png | Mossy giant-tree arch and root sanctuary, elven carved ruins, emerald foliage, honey-gold forest light. |
| oracle.png | Black-stone monastery tower under a violet moon, silver-purple stars, mist valleys and small antique-gold window lights. |
| frost-v2.png | Silver-blue ice castle and glacier stairs; full tallest spire visible with generous sky above, central architecture with sky and mountains at corners. |
| dragon.png | Dragon-shaped black-iron ridge supporting a volcanic fortress, gold-red lava and deep charcoal cliffs. |
| moonkeeper.png | Silver-stone sea altar under an eclipse, ring arch, carved ancient oaths, midnight teal and cool gold. |

The first frost illustration cropped the spire at the source edge. It was rejected and regenerated with a wider camera. `sources/frost.png` is retained as the rejected first version; only `frost-v2.png` feeds the active frost asset.

The former whole-screen illustration was removed at the user's request. Its prior version remains recoverable from Git history; the active map uses only the separate assets described above.

## Review scope

Main-agent review covered all eight generated assets and the revised frost artwork, plus the rendered local two-column map. Build and JavaScript syntax checks were run. No gameplay test suite or physical-device tests were run for this visual-only iteration.

UI reference ledger: game-ui-designer's ui-patterns, game-ui-quality, hud-readability, responsive-ui-fit and mobile-input references were read. They informed fixed readable controls, container-driven layout, persistent footer actions and observer cleanup.
