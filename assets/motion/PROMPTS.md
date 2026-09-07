> 当前参数与文件清单已统一到 `assets/characters.json`，旧 motion manifest 与 portrait-profiles 不再维护。历史提示词保留为素材来源记录。

# Three optional animated-card samples — 2026-09-07

Generated using the built-in `image_gen` tool, using the matching approved `assets/anime/{id}.webp` as the edit reference. These are derived illustrations, not pixel-identical cutouts of the originals. The original 56 card images and their provenance remain unchanged. No Live2D/Spine model or eye/face rig is claimed.

## Atlas prompt (shared, verbatim)

Use case: background-extraction / identity-preserve. Create a production layer atlas for animating this existing game card. Output ONE landscape PNG, exactly three equal side-by-side portrait panels, each panel aspect ratio 3:4, total canvas aspect ratio 9:4 (recommended 2304x1024). Each panel uses EXACT SAME coordinate system and framing as the reference: overlaying all three panels reconstructs the reference artwork. No borders, gaps, labels, text, card frame, watermark, checkerboard or matte background. Preserve painted anime illustration, character identity, colors and original composition.

Insert the matching character paragraph below, then append:

All empty regions of panels 2 and 3 must be genuinely transparent, alpha zero. Panel 1 opaque. Do not shift, center, enlarge, or recrop isolated elements within their panel. Keep original full-bleed framing.

### oracle

Keep the purple hooded young woman's exact face, costume, pose and golden armillary sphere. Layer 1: empty observatory room, stars, arches, books, with all woman and handheld sphere removed and background filled. Layer 2: woman including arms/hands holding the golden sphere, isolated on real transparent alpha; no background. Layer 3: a small cluster of the existing star glints around the sphere, isolated on transparent alpha, otherwise empty.

### phoenix

Keep the exact fiery phoenix pose and silhouette. Layer 1: empty ruined city and smoky orange sky, remove entire bird, wings and trailing feathers and fill background. Layer 2: complete phoenix body, head, legs and tail but without the two outstretched wings, isolated on real transparent alpha; fill shoulder junctions naturally. Layer 3: the two complete outstretched wings in their original exact positions, isolated on real transparent alpha, no body, no background.

### frostking

Keep the exact white-haired crowned ice king's face, armor, pose and sword. Layer 1: empty icy castle and crystalline landscape, remove king and fill background. Layer 2: complete king including his cloak, hands and sword, isolated on real transparent alpha, no landscape. Layer 3: isolated foreground ice shards from the bottom edges, on real transparent alpha, no king.

## Matte prompt (shared, verbatim)

The initial atlas outputs contained a painted checkerboard instead of alpha. Each corresponding atlas was supplied as the edit target with this prompt:

Create the precise black-and-white alpha MATTE for this supplied three-panel layer atlas. Output same canvas size and identical three-panel layout and pixel alignment. Panel 1 entirely pure WHITE. Panel 2: the full isolated character silhouette is pure WHITE, all checkerboard background is pure BLACK, preserve all holes as black. Panel 3: all isolated wings, ice crystals or star/glow elements are WHITE, all checkerboard background BLACK; feather thin star/glow edges in gray. No colors, no texture or shading inside solid silhouettes, no checkerboard. Do not redraw or move silhouettes. This matte will be multiplied as the alpha channel of the supplied image, so edge registration must match exactly.

## Packing and registration

Source atlas and matte PNGs are saved in `sources/`. `manifest.json` records source mapping, measured panel boundaries and output hashes. `node tools/pack_motion_assets.cjs` packs the generated mattes into WebP alpha with a conservative edge cleanup. The 384×512 layers are embedded by `src/motion-assets.js`; the standard build extracts identical bytes into the web build. Ordinary `python3 build.py` does not run image generation or require Playwright.

Phoenix wings required independent shoulder registration, recorded in `src/presentation/portraits.js`. Atlas sources remain intact. White/gray hair edges are an approximate generated matte, so these remain a limited three-card motion sample rather than a full production character rig.

## 第二阶段：wolf / golem / treant

2026-09-07，仍使用内置 `image_gen`；每卡以自己的 `assets/anime/{id}.webp` 为编辑参考，独立生成图集，再以生成图集生成技术遮罩。原图不覆盖。完整展开提示词记录见 `PROMPTS-v2.json`。

生成工具再次返回 RGB 棋盘背景而非真实 alpha，因此最终透明通道来自单独生成的黑白遮罩，使用既有 packer 应用。`preserveHighlights` 保留雪和白毛，`edgeTrim` 去除图集边界白线，古木背景排除图集沟槽。头部支点和对齐偏移记录在源码 profile；古木只使用 accent 上部 150 像素枝叶，避免装饰枝条覆盖脸部。它们仍是派生素材，非完全忠实的逐像素切层或完整面部绑定。

## 幼狼完整头身修订

内置 image_gen，以 `assets/anime/wolf.webp` 为参考，输出 `sources/wolf-v2-atlas.png`。技术遮罩输出 `sources/wolf-v2-mask.png`。原图及第一版图集留档，manifest 指向 v2。

图集提示词：

> Edit target: attached approved blue-eyed gray wolf cub illustration. Create a production animation atlas 3 equal portrait panels wide, 1881x836, NO gutters NO labels. All panels share exact same composition/scale/coordinates. Panel 1: original moonlit snowy forest castle AND foreground rock fully painted, but remove wolf and fill behind it. Panel 2: ONLY the COMPLETE intact wolf cub from reference, with its original naturally connected head, neck, torso, paws and tail as ONE coherent subject, exact original face and cute proportions, positioned exactly as original; genuinely transparent alpha background. Do NOT include rock or scenery in this panel. Panel 3: entirely empty transparent panel reserved for future accessories. No detached head, no severed body, no separate ears, no new pose, no stretching, no outline, no lettering. Preserve original image identity and head-to-body proportions especially. Request actual alpha, never a painted checkerboard.

遮罩提示词：

> Make a precise luminance alpha mask for this exact atlas, keeping dimensions and position identical. Left third entirely white. Middle third: complete wolf silhouette solid white including all fur, face and paws, no black eyes or internal marks; checkerboard background solid black. Right third entirely black. No borders no gray checker no new art. Preserve exact wolf outline and position; head, neck and body form one connected white silhouette.

生成图仍带棋盘背景，使用技术遮罩打包成实际 alpha。whole-subject 模板仅绘制前两层，第三层保留为透明空层以兼容当前素材结构。
