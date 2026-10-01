# Amber card bitmap layers

2026-09-29. Built-in imagegen; actual model identifier not exposed. Reference: output/amber-card-design-20260929/mirror-mage-amber-v1.png. Native RGBA PNG transparency; runtime crops are SVG viewBox/clipPath, no generated text is used. Assets copied unchanged; not lossless extraction.

## body

SHA256: bb9f3c52cffa76b74092791a2a69dd9b41d8e292da50f56d5cc01b37fa2f0b70

Use case: precise-object-edit. Image1 is reusable amber UI shell, edit target. Keep EXACT same 1024x1536 canvas geometry, real transparency outside and real transparency in upper window, same polished amber resin thick rim with small golden bubbles and blue sapphire apex. Remove ONLY round cost medallion at upper left, hex attack medallion at bottom left and ruby heart medallion at bottom right, reconstructing seamless original amber resin behind them. Remove central nameplate shape and stars, leave a smooth narrow amber horizontal bar at y910..980. Keep dark cognac lower rules bed with no text, keep golden bottom ribbon blank. Everything else must stay same exact positions, materials, realistic specular highlights. No character, text, digits, backdrop, ground or checkerboard. Real transparent PNG. This is the BASE BODY layer; badges and silver plaque are separate UI layers.


## badge-atlas

SHA256: 99a1d1a196ee4f72dea1e72046c6be63c031488e862b4f175b480a02aedb2290

Use case: background-extraction / precise-object-edit.
Input image 1 is the exact approved amber fantasy trading card to reproduce as reusable game UI layers. Output a single transparent RGBA PNG, same portrait composition and 2:3 canvas aspect, maintaining EXACT source placement and silhouette: amber card outer bounds x60..947 y65..1425 on original1024x1536. Extract/reconstruct ONLY the polished golden amber card body and ornaments, with original luxurious photographic crystalline resin, tiny bubbles, organic internal streaks, white specular rim highlights, thick depth, gold decorative metal, blue sapphire at apex. Keep blank round amber cost medallion at x300 y265, blank amber hex attack gem at x170 y1245, blank ruby heart gem at x840 y1250. Keep dark cognac lower rules bed at y990..1280 and blank golden bottom type ribbon y1295..1380. Remove ALL lettering and ALL digits. Remove entire silver nameplate at y885..988 including side stars, leaving amber support bar behind it. Remove character illustration, mirrors, sky and entire upper interior aperture: upper opening must be genuinely alpha-transparent from under apex to y910, preserving amber border. Outside card transparent, no studio background, no ground shadow, no checkerboard painted into image. Lower rules bed opaque dark warm brown, empty. Maintain same card size/placement on canvas, do not zoom/recenter/reinterpret or simplify materials. This is production UI asset not a redesign. NO text, NO numbers, NO people.


## nameplate

SHA256: edd1ad3407b158edf41aa01cb5ce51a6f8476e56fd3f70a2a2cd4bc7daa531a4

Use case: background-extraction. Input is approved card reference. Extract ONLY its blank SILVER NAMEPLATE including golden border, four small rivets and the two gold four-point star fittings left and right. Preserve original silver hammered satin metal texture and bevels. Remove Chinese name cleanly by reconstructing blank silver texture. Transparent PNG with real alpha outside object. A horizontal tightly framed single nameplate, original proportions approximately 490 pixels wide by110 pixels high; stars included. Straight frontal view exactly like reference, no perspective tilt, no extra objects, no lettering, no digits. This asset overlays card at original x265..755 y882..988. Match original photographic metal details, do not redesign.


## mirrormage illustration

Use case: precise-object-edit / background-extraction. Input is approved mirror mage amber card. Produce ONLY the upper character illustration as standalone rectangular portrait artwork for same mirrormage card, no UI. Precisely preserve silver-haired beautiful female mage's face, gaze, black/navy ornate coat, silver gilded piping, hand held out at lower left with bluewhite crystal magic, floating mirror shards reflecting her face, deep navy starry magic circle and brilliant upper-right star. Match face, costume, palette and pose from input with utmost fidelity. Remove every amber rim, blue apex gem, cost medallion, silver title, rules area and both stat gems and all text/numbers. Reconstruct illustration behind removed upper UI ornaments. Rectangular portrait crop corresponding to original x105..917 y137..918, expanded to a complete 4:5 rectangle with no frame. Full bleed richly detailed anime painting, frontal composition, female upper torso centered, face near 40% height, hands lower left. No transparent gaps inside painting. NO card UI, NO words, NO digits.


Registered through tools/pack_card_assets.py; relief/live assets rebuilt from the new source with existing authoring tools. All other card artwork kept.
