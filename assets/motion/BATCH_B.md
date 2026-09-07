# Batch B 动态角色素材记录

日期：2026-09-08。工具：Codex 内置 `image_gen`。所有角色均以各自的 `assets/anime/{id}.webp` 为身份与构图参考，静态原画未覆盖。运行图层由 `node tools/pack_motion_assets.cjs --manifest assets/motion/batch-b.json --card ID` 生成；配置、字节数与 SHA-256 见 `batch-b.json`。

## 本批范围

`leech`、`rider`、`necromancer`、`paladin`、`titan`、`huntress`、`dragon`、`reaper`、`solaris`、`nyx`、`ashdragon`、`colossus`。

全部采用 `whole-subject`：完整头身和手持物处于同一主体层，避免断颈、断翼和武器脱手。`rider` 的骑手与霜狼作为一个主体；`dragon` 与 `ashdragon` 保持翼根、头颈和身体连续；`titan`、`ashdragon`、`colossus` 使用较低频率和较小位移；`necromancer`、`nyx` 使用更明显但克制的浮动；其余按姿态分别调节。

## 图集提示词

以下公共段落逐卡使用，角色段落插入其中。实际生成均为一张 1536×1024 两栏 PNG：

> Use case: production animation layer extraction for Emberfall. The supplied local image is the approved identity and composition reference. Create ONE clean landscape PNG atlas with exactly TWO equal side-by-side portrait panels, no gutter, frame, labels, or text. Both panels use exactly the same coordinate space, scale, crop, lighting, and framing as the supplied reference so stacking reconstructs the scene. [CHARACTER PARAGRAPH] LEFT PANEL must be opaque and full-bleed. RIGHT PANEL contains ONLY that complete coherent foreground subject at the exact original position; every other pixel must have genuine transparent alpha zero, never white/black/checkerboard/painted transparency. Keep face/anatomy, equipment, silhouette, main colors, anime painted style and original pose unmistakably recognizable. Reconstruct concealed background behind all moving edges. Clean antialiased edges. No duplicated limbs or wings, no detached head, no extra character, no altered pose/equipment, no card UI, watermark, or motion blur. Motion plan is a subtle whole-subject idle appropriate to this character, so preserve all connected joints and held items. Highest production game asset quality.

逐卡角色段落：

- `leech`: 血月行者 / leech, silver-haired red-eyed elf vampire; preserve face, pointed ears, layered black-crimson clothing, belts, jewelry, both hands, cloak and attached red magical ribbon. Empty background is the crimson moon and gothic castle skyline.
- `rider`: dark-haired armored woman mounted on a huge white blue-eyed frost wolf; rider, wolf, spear and reins are one connected subject. Empty background is the snowy pine valley and ice castle.
- `necromancer`: purple-eyed hooded woman, ornate black-purple robe, raised hand, two nearby skeletons and connected purple spirit ribbons as one foreground subject. Empty background is the moonlit gothic castle.
- `paladin`: blonde female paladin in white-gold-blue armor with sword and sun-emblem shield as one subject. Empty background is the radiant cathedral/castle.
- `titan`: colossal dark iron and stone armored titan with orange furnace glow, shoulders and hanging chain as one heavy subject. Empty background is the ruined sunlit fortress.
- `huntress`: brown-haired elf huntress in green forest leathers and fur trim, complete crouching body and long held spear as one subject. Empty background is the sunlit forest.
- `dragon`: red-black young fire dragon with intact head, neck, torso, legs, tail, both wings and mouth-connected fire as one subject. Empty background is the volcanic cliffs and burning sky.
- `reaper`: hooded female reaper in black-purple armor, both hands, complete scythe, cloak, skull wisps and connected purple soul ribbon as one subject. Empty background is the moonlit gothic city.
- `solaris`: blonde sun champion in white-gold-blue armor with raised sword, cape and nearest cloth as one subject. Empty background is the bright castle courtyard with distant soldiers and banners retained.
- `nyx`: purple-haired star queen in celestial gown and crown, raised hand, hair and foreground armillary orb as one subject. Empty background is the cosmic archway, eclipse and stars.
- `ashdragon`: enormous obsidian dragon with lava cracks, horned head, long neck, torso, intact visible wings and mouth fire as one subject. Empty background is the devastated city and lava rivers.
- `colossus`: living mountain guardian formed from cliffs, trees, moss and waterfalls; upper creature-shaped mountain mass is one heavy subject. Its accepted background was generated separately with: “REMOVE the entire creature-shaped upper mountain guardian … replace the removed area with a believable open alpine valley and distant ordinary cliffs that do not form a face or humanoid silhouette.”

## 遮罩提示词与加工

图像工具对透明请求仍输出了绘制棋盘，因此没有把 RGB 棋盘冒充 alpha。每张 atlas 作为编辑目标生成技术遮罩：

> Create an exact technical luminance alpha matte for this supplied 1536x1024 two-panel atlas. Keep boundary at x=768 and identical pixel alignment. LEFT PANEL pure solid WHITE edge to edge. RIGHT PANEL pure BLACK background with the entire isolated foreground subject WHITE, including all white hair/fur/armor, dark cloth/scales, faces, eyes, weapons, wings, fire, magic, fingers and connected held items/effects. Preserve the exact outside contour. Do not punch black holes through internal subject detail. Only true empty checkerboard outside the isolated subject is black. No color, texture, checkerboard, labels, border or text. Do not move, rescale, crop, simplify or redesign.

`rider` 与 `dragon` 初次遮罩分别把狼嘴和幼龙嘴内火焰误判为空洞，使用针对性编辑提示补白；之后只填充未连接画布边缘且小于 25,000 像素的封闭黑色分量，保留与外部相连的真实肢体/翼间空隙。`colossus` 同样用该步骤保留完整山体、瀑布与发光眼内部。最终三个主体均实际检查为 WebP alpha。

## 视觉审核

- 384×512 合成预览：`artifacts/qa/characters/{id}.png`；总览：`artifacts/qa/characters/batch-b-contact.png`。
- `leech` 作为首个代表完成后再扩展全批，脸、尖耳、服装、手部和红色能量轮廓可辨。
- `rider` 修复后狼嘴腔、牙齿和舌头保留；骑手、霜狼与长枪无错层。
- `dragon` 修复后嘴内与喷火中央不再露背景；双翼与翼根保持同层。
- `colossus` 首轮背景仍含本体，已拒绝并保存为 `sources/colossus-atlas-rejected.png`；最终背景为无脸、无发光眼的高山谷。
- 其余角色在合成预览中未见主体断裂、棋盘残留、明显白边或错误内部孔洞。所有 subject 文件均有真实 alpha。

本批只交付素材源、运行图层、批次配置与审核记录；未修改玩法、`assets/characters.json`、生成 JS 或运行源码。

## 合并后的正式入口

本批素材已合入 `assets/characters.json`，临时批次 JSON 已删除。上文参数记录制作过程，最终动作幅度以正式清单为准。重打包使用 `node tools/pack_motion_assets.cjs --card ID`；不要重新维护一份批次配置。
