# Batch A 动态素材记录

范围：`spark`、`squire`、`archer`、`guard`、`wisp`、`spider`、`sentinel`、`assassin`、`cleric`、`berserker`。全部保留 `assets/anime/{id}.webp` 静态原画，并以各自原画作为 built-in `image_gen` 编辑参考。批次配置在 `assets/motion/batch-a.json`；未直接修改统一角色清单与运行缓存。

## spark / 引火学徒

- 工具：built-in `image_gen`
- 原图：`assets/anime/spark.webp`
- 图集：`assets/motion/sources/spark-atlas.png`（1536×1024，RGB；工具画出了棋盘，因此另制遮罩）
- 遮罩：`assets/motion/sources/spark-mask.png`（1536×1024）
- 模板：`whole-subject`
- 动作意图：少年连同掌心小火球缓慢呼吸起伏并轻微侧倾；火球保持在手上，避免身体与持物错位。

图集提示词（全文）：

> Use case: background-extraction
> Asset type: Emberfall animated battlefield portrait production atlas for card ID spark (引火学徒)
> Input image: the attached approved spark.webp is the sole identity, costume, pose, palette, and composition reference.
> Primary request: Create ONE landscape PNG atlas with exactly TWO equal side-by-side portrait panels, each panel 3:4 and sharing the exact same coordinate system, subject scale, and crop. Panel 1: the complete firelit castle-town background with the boy and his foreground flame ribbons fully removed; naturally repaint every formerly hidden area. Panel 2: ONLY the complete intact boy as one connected head-and-body subject, including hair, face, red cloak, tunic, belts, pouch, both arms and hands, isolated on genuine transparent alpha. Keep the original forward-reaching pose and recognizable cheerful face. Include the small fireball held above his left palm as part of the subject so it moves naturally with him, but exclude the large foreground flame ribbons and all scenery.
> Style/medium: preserve the approved polished anime fantasy painting, linework, lighting, and colors.
> Composition/framing: no gutters, borders, labels, text, card frame, watermark, checkerboard, matte, or recentering. Both panels reconstruct the reference when aligned. Panel 1 is fully opaque. Empty regions of panel 2 must be actual RGBA alpha zero.
> Constraints: preserve exact character identity, childlike proportions, brown tousled hair, green eyes, red cloak, leather harness and pouch; reconstruct hidden background and hidden body edges cleanly; no detached head or limbs; no duplicated character; no new props; no rules text. Motion intent is subtle whole-subject breathing, lift, sway, and turn at 384x512, so keep natural clean silhouette and enough edge detail.

遮罩提示词（全文）：

> Use case: precise-object-edit
> Asset type: exact luminance alpha matte for the supplied spark two-panel production atlas
> Primary request: Create a pixel-aligned black-and-white matte for THIS EXACT atlas. Output the same 1536x1024 dimensions, exactly two equal 768x1024 panels, no gutter, and do not move or redraw any silhouette.
> Panel 1 must be entirely pure WHITE (#FFFFFF), edge to edge.
> Panel 2: every pixel belonging to the complete boy and his small held fireball is WHITE, including all brown hair wisps, eyes, skin, fingers, red cloak, sleeves, belts, pouch, clothing, translucent orange flame and fine glow edges. All painted checkerboard/background pixels must be pure BLACK (#000000). Preserve holes between fingers, arms, cloak, and body as black. Use a narrow antialiased gray fringe only on the true silhouette and flame glow edge.
> Constraints: identical registration to supplied atlas; no checkerboard pattern, colors, texture, shadows, labels, border, new art, recentering, cropping, or size change. This image will be used only as alpha by the packer.

审核记录：首轮遮罩在发梢和斗篷边缘留下棋盘污染，未采用。最终把右栏改成纯品红色键控底，使用共用 `tools/chroma_motion_atlas.cjs` 生成 `sources/spark-atlas-alpha.png` 的真实 alpha；背景完整且没有主体残影，完整头身、脸、红斗篷、皮带、挎包和掌心火球可直接辨认为静态原画中的角色。主代理已在场上尺寸与放大尺度审核通过。

## 其余九张的图集提示词

除 `spider` 修订版外，下列角色使用同一个 production prompt，只替换 ID 与主体说明。第二批以后直接要求纯品红键控底；首批 `squire`、`archer`、`guard` 先得到棋盘底，再用后附的 chroma 修订提示词转换。

> Use case: background-extraction
> Asset type: Emberfall animated battlefield portrait two-panel chroma atlas for card ID {id}
> Input image: attached approved {id}.webp is the sole identity, pose, costume, palette and composition reference.
> Create ONE 1536x1024 landscape PNG with exactly TWO equal 768x1024 portrait panels, no gutter, same coordinates, scale and crop. LEFT: complete opaque environment with the entire subject removed and hidden areas naturally repainted. RIGHT: ONLY the complete intact subject as one connected whole: {subject}. Preserve the original recognizable face and pose. Right-panel empty region perfectly flat uniform fully opaque chroma magenta RGB #FF00FF, with magenta kept out of subject.
> Preserve polished anime fantasy style, lighting and colors. No transparency/checkerboard, labels, text, frame, watermark, halo, recentering, detached pieces, duplicates, new props or scenery attached. Intended for subtle whole-subject motion at 384x512.

主体替换文本：

- `squire`：young blonde blue-eyed female squire, blue-and-white tabard, gold-edged plate armor, large white-and-gold sun shield held at right; sunny castle and blue banners; include shield with subject
- `archer`：brown-haired green-hooded elf archer drawing a longbow, pointed ears, leather bracers, quiver and arrows; sunlit green forest with distant stone arches; include bow, drawn arrow and string with subject
- `guard`：bearded male guard in polished steel armor and blue cloak, crested helmet, spear and blue-gold lion shield; bright fortified castle; include spear and shield with subject
- `wisp`：lavender-haired elf woman in a deep violet dress and translucent lavender shawl, leafy circlet, raised right hand; include the small luminous butterflies nearest her hands and shawl as part of the whole subject; moonlit purple forest ruins
- `sentinel`：red-black ember-winged phoenix-like scout bird, complete head, beak, body, both wings, talons and fire-feather tail as one connected flying subject; burning castle city
- `assassin`：hooded masked young female night assassin crouching on a battlement, black leather armor, flowing deep-blue cloak, both silver daggers, boots and all straps as one subject; moonlit gothic castle
- `cleric`：blonde female dawn cleric in white-blue-gold robes, raised left hand and complete sun-topped staff in right hand; include the golden halo sigil directly above her head as part of subject, exclude separate doves; luminous cathedral
- `berserker`：red-haired bearded muscular male berserker roaring, fur mantle, leather harness, tattoos, raised double-headed axe and clenched fist; volcanic mountain battlefield

首批 chroma 修订提示词（分别以各自的棋盘底图集为编辑目标）：

> Use case: precise-object-edit
> Asset type: chroma-key preparation of the exact supplied {id} two-panel production atlas.
> Change ONLY the background behind the isolated subject in the RIGHT panel to a perfectly flat, uniform, fully opaque chroma magenta RGB #FF00FF. Keep magenta completely out of the subject. Preserve every subject pixel, facial detail, hair, clothing, equipment, pose, scale, position, crop and edge exactly as supplied. Keep the entire LEFT background panel pixel-for-pixel visually unchanged and fully opaque. Preserve the exact canvas dimensions and exact panel boundary.
> No transparency, checkerboard, gradient, shadow, halo, texture, new art, labels, borders, recentering, or redraw. The right-panel empty region must be solid #FF00FF edge to edge so software can create true alpha with colorkey.

`wisp` 与 `sentinel` 为保护紫衣和火羽，追加一次仅改右栏背景的绿色修订：

> Use case: precise-object-edit
> Asset type: corrected chroma-key preparation for exact {id} atlas.
> Change ONLY the flat magenta background of the RIGHT panel to perfectly flat uniform fully opaque chroma green RGB #00FF00. Keep green out of the subject. Preserve every subject pixel, glow, feather/hair edge, pose, scale, placement, canvas size and panel boundary exactly. Keep the entire LEFT panel visually unchanged and opaque.
> No transparency, checkerboard, gradient, shadow, halo, redraw, new art, labels, borders or recentering. Right empty region solid #00FF00 edge to edge.

## spider 修订版

首版品红键控导致肤色半透明，且背景残留大型角色蛛腿，被场上审核退回。修订版使用自己的 `assets/anime/spider.webp` 重新生成绿色图集，提示词全文：

> Use case: background-extraction
> Asset type: corrected Emberfall animated battlefield two-panel chroma atlas for spider / 幽谷蛛后
> Input image: attached approved spider.webp is sole identity, face, costume, pose, palette and composition reference.
> Create ONE 1536x1024 landscape PNG, exactly TWO equal 768x1024 portrait panels, no gutter, same coordinate system, scale and crop.
> LEFT panel: complete opaque purple webbed cavern forest EMPTY of the queen and EMPTY of every large articulated spider leg/appendage belonging to her. Remove her whole body, crown, dress, all six/eight large black-purple legs, and all foreground character-attached web strands; naturally repaint the exposed cavern and webs. Small distant spiders may remain only if clearly separate background creatures.
> RIGHT panel: ONLY the complete intact black-haired red-eyed spider queen together with ALL of her own large articulated spider limbs attached behind her, her crown, black-purple armor, gloves and dress, as one connected subject in the original seated pose. Preserve recognizable face and anatomy. Empty region is perfectly flat uniform opaque chroma green RGB #00FF00, green kept out of subject.
> Preserve polished anime fantasy style. No transparency/checkerboard, labels, text, frame, watermark, halo, duplicate limbs in left panel, detached pieces, scenery attached to subject, recentering or new props. Background must have zero duplicate large queen legs. Intended for subtle whole-subject motion at 384x512.

修订审核：左栏没有角色的大型蛛腿，仅保留两只明确分离的远景小蜘蛛；右栏女王、服装和全部角色蛛腿完整。共用 helper 报告 `leftTransparent=0`、`rightTransparent=411303`、`rightVisible=375071`、`residualKey=0`，脸与胸口不再被品红键控抠穿。

## Alpha 转换与产物审核

保留的原始键控输出为 `sources/{id}-atlas-chroma.png`；绿色修订为 `sources/{id}-atlas-chroma-green.png`。正式透明图为 `sources/{id}-atlas-alpha.png`，批次清单统一设置 `nativeAlpha: true`。转换使用共用命令：

```bash
node tools/chroma_motion_atlas.cjs --input assets/motion/sources/ID-atlas-chroma.png --output assets/motion/sources/ID-atlas-alpha.png --split 768
node tools/chroma_motion_atlas.cjs --input assets/motion/sources/ID-atlas-chroma-green.png --output assets/motion/sources/ID-atlas-alpha.png --color 0x00ff00 --similarity 0.42 --blend 0.06 --split 768
node tools/pack_motion_assets.cjs --manifest assets/motion/batch-a.json --card ID
```

`berserker` 自动实测分界为 769，清单使用 `cuts: [0,769,1536]`。其余九张为 768。`wisp` 与 `sentinel` 最终明确使用绿色键控的 similarity 0.42 / blend 0.06，避免共用 helper 默认窄阈值留下绿边。10 张均为 `whole-subject` 两层，未创建空 accent；每张角色的完整头身与持物在同层，适合自然呼吸、升降、侧倾与轻转。`spark`、`squire`、`archer`、`guard` 已经主代理在场上和放大尺度审核通过；`wisp`、`sentinel` 已通过场上审核并按复查修订；`spider` 使用退回后的绿色修订版；`assassin`、`cleric`、`berserker` 已提交场上审核。文件字节数与 SHA-256 以 `assets/motion/batch-a.json` 的 `files` 为准。

## 合并后的正式入口

十项已合入 `assets/characters.json`，临时批次 JSON 已删除。最终动作幅度以正式清单为准，重打包使用 `node tools/pack_motion_assets.cjs --card ID`。
