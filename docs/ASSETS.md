> 2026-09-12 界面与素材更新见 [星海银蓝重构说明](design/SILVERBLUE_REBUILD.md)。下文旧视觉架构和数量属于历史记录，以当前注册表及内容数据为准。

> 素材清理更新：旧版 moon-sources 已按用户要求删除。当前只保留 moon-anime-v2 原画、分层制作源及其运行 WebP。下文旧路径属于历史制作记录。

> 当前统一角色配置与制作契约见 [CHARACTER_AUTHORING.md](CHARACTER_AUTHORING.md)。下文涉及独立 motion manifest / portrait-profiles 的描述是早期阶段记录，已由 `config/characters.json` 取代。

> 2026-09-18：分层立绘动画整体移除，`config/characters.json` 只剩 `staticKey` / `focus`。下文所有关于分层、rig、图集与 alpha 处理的段落均为历史制作记录，对应素材与工具已不在仓库中，详见[角色静态插画登记](#角色静态插画登记)。

> 2026-09-18：`assets/` 整体移出版本库（本机备份 `../card-game-sources-20260918/`）。运行时数据仍在 `src/*-assets.js` 等生成物与 `art/`（`asset:` 协议引用的 30 张运行图）中，克隆后无需素材即可构建；下文所有 `assets/` 路径指的是恢复素材后的本地目录。说明见 [README 的「素材源」](../README.md#素材源)。

## 2026-09-21 · 卡面浮雕贴图

`presentation/card-relief.js` 用 WebGL2 绘制"正在被呈现的那一张卡"的插画：英雄选择页的预览卡、战场上从手牌提起的卡、悬停／长按放大的详情卡。沿视线在高度图里做浮雕映射得到立体视差，粗糙度／金属度贴图区分金属与布料，金属反射一张预烘的摄影棚环境贴图，外加清漆反光和薄膜虹彩。颜色贴图直接复用 `EmberArt` 已显示的插画，不另存一份。

79 个卡牌 ID 在 `art/relief/` 下各有 `<id>-height`（白 = 近）与 `<id>-orm`（R = 虹彩遮罩，G = 粗糙度，B = 金属度）。336×448 的普通卡：高度图保持原图分辨率（层与层的剪影必须锐利，才读得出前后分离；L 通道压缩后每张仍只有几 KB），材质图 `-orm` 为 168×224，法线由着色器从高度图求导；768×1024 的肖像卡（含四位可选英雄）烘焙为 384×512，并多一张 `<id>-normal`（OpenGL 约定），因为它们会被放大展示。全部贴图约 1.4 MB，经 `asset:relief/...` 内嵌或抽取；注册表 `src/card-relief-maps.js` 是烘焙脚本的生成物，不手改。

```bash
uv run --python 3.12 --no-project --with pillow --with numpy --with onnxruntime \
  tools/bake_card_relief.py --cards   # 全部卡牌（跳过已人工确认的肖像卡）
  tools/bake_card_relief.py wolf      # 单张；无参数则只重写注册表
```

高度来自 Depth Anything V2 Small 的单目深度估计（ONNX，Apache-2.0，`huggingface.co/onnx-community/depth-anything-v2-small`）。99 MB 权重是本机制作输入，放在 `tools/models/depth-anything-v2-small.onnx`（即该仓库的 `onnx/model.onnx`，2026-09-23 从 `tools/.scratch/` 移出），不入库、不进构建；贴图是它对本项目原画的推理结果。金属遮罩按金色色相与高对比低饱和区域启发式生成，并排除高饱和或过曝的同色相区域（火焰、光球是自发光，不是金属）。仍会误判的（例如金发）可手修 `-orm`。

材质按稀有度分档（`card-relief.js` 的 `FINISH`）：所有卡都有视差和清漆光带（转动时扫过卡面的反光是"手里是一张实体卡"的基本线索，2026-09-21 用户确认全员标配）；稀有度由金属与虹彩区分——普通无金属，稀有半强度金属反射，史诗全强度，传奇再加虹彩；英雄预览卡用满档。

抛光区域反射的摄影棚环境是共用的 `art/relief/studio.webp`（768×128，约 3 KB），由 `tools/bake_relief_studio.py` 纯程序生成（只需 Pillow 与 numpy）：六块 128² 的球极投影瓦片，从清晰到全粗糙依次高斯预滤波，HDR 以 `sqrt(辐射 / 6)` 存储。场景是正前方一片天花板漫反射（让金属在正视时拿回被着色器去掉的漫反射，亮度守恒）、左上主柔光箱、右侧暖色条灯、底部冷色补光、几颗点光，以及中心偏右的一条黑旗——转动时金属因此同时变亮和变暗。改动布光后重跑该脚本即可，常量 `SPAN` / `RANGE` / 瓦片数须与 `card-relief.js` 的 `studio()` 保持一致。

新增卡牌或英雄时重跑烘焙脚本。`tests/card-relief.test.cjs` 要求注册表、`art/relief/` 文件与 `src/content/cards.js` 的卡牌 ID 三者完全一致，可选英雄的肖像必须带法线贴图，每个稀有度必须有材质档。

### 英雄活立绘（hero-live）

英雄选择页的预览卡不再画浮雕卡面，而是英雄的"活立绘"（`presentation/hero-live.js`，2026-09-23 用户要求"建模必须和卡片上的图片完全一致"）。模型就是卡面原画本身：`assets/anime/overrides/<portraitId>.png`（1086×1448）拆成背景、人物、手持道具（星盘与手、长剑与手、弓箭与手、提灯）三层，每层有自己的深度并重建为网格；镜头回正、动作归零时画面与原画逐像素一致（离线测得平均差约 1/255）。被遮挡处用 push-pull 插值补底，只在镜头转动时露出窄边。

`art/hero-live/<portraitId>-{bg,body,front,depth,ctrl,flags}.webp` 共四位约 1.3 MB：`bg` 背景（人物区已补底）；`body` 人物颜色＋alpha（道具区已补底）；`front` 道具颜色＋alpha；`depth` 半尺寸，RGB 分别是三层深度（白 = 近）；`ctrl` 半尺寸，R 星光/流水、G 金属流光、B 辉光遮罩；`flags` 半尺寸，B 为道具遮罩（顶点着色器据此让剑、弓、灯保持刚性）。注册表 `src/hero-live-maps.js` 是生成物，不手改：

```bash
uv run --python 3.12 --no-project --with pillow --with numpy --with onnxruntime \
  tools/bake_hero_live.py            # 全部可选英雄；可只写一个 portraitId
```

每位英雄的分层规则（道具多边形、特效遮罩）写在脚本的 `RIGS` 里；待机动作（呼吸、转头、眨眼、发丝、披风、道具摆动、辉光）写在 `src/presentation/hero-live-rigs.js`，以原画像素为坐标。眨眼不拉伸眼睑上方像素（眉毛近的角色会被一起拉下），闭合处取下眼睑下方的皮肤色，只有睫毛线下移。WebP 以 `exact` 保存，补底区域的颜色才不会因 alpha 为 0 被丢掉。`tests/hero-live.test.cjs` 要求注册表、文件、动作配置与可选英雄的 `portraitId` 一致。

# v0.12 素材与加工

运行时保留原 56 张已确认卡图，并新增六张酒馆誓约扩展卡图、6 张遗物、当前完整酒馆图和山谷原画档案。角色明确复用卡图；不加载旧程序化人物、旧 Three.js 场景、旧卡框缓存或旧酒馆背景。

| 输入/源码 | 用途 |
|---|---|
| `assets/anime/*.webp` / `manifest.json` | 56 张运行卡图、来源和文件哈希 |
| `assets/anime/sources/*.png` | 八张已确认原始图集，原始输入留档 |
| `assets/anime/overrides.json` / `overrides/`（有替换时创建） | 独立卡图来源，整体裁图时仍优先使用 |
| `assets/anime/non-card-relics.json` | 六张当前遗物的运行内嵌图（来自 assets/relics） |
| `src/anime-assets.js` / `src/relic-assets.js` | 由同一个 packer 生成的运行缓存 |
| `src/art.js` | 严格 card / character / relic 路由，无隐式回退 |
| `src/atelier-art.js` | 卡图焦点与裁切参数 |
| `assets/premium/` / `src/premium-assets.js` | 当前完整酒馆画面与生成缓存 |
| `assets/windborne/` / `src/world-assets.js` | 原画档案及当前使用的纹理资源 |

常规代码改动只运行 `python3 build.py`。元数据更新或重新打包运行 `python3 tools/pack_card_assets.py`。单张替换见 [卡牌修改指南](CARD_AUTHORING.md)。重新裁切八张原图运行 `python3 tools/build_anime_assets.py`，需要 `requirements-art.txt` 的 Pillow；最终仍调用统一 packer。

打包器也生成六张遗物缓存。旧 `prepare_anime_runtime.py` 已删除；不会重新生成废弃卡框。`assets/atelier/` 和 frame-sources 只作历史原始资产保留，不进入当前构建。

网页构建直接从同一份缓存提取图片，不重复压缩。单文件与网页的卡图内容一致。下面的图集清单描述当前确认素材来源；将来替换某图时以 manifest 的逐图记录为准。

## 全部56张卡图

| ID | 中文名 | 类别 | 实际图版 | 源素材表（相对于assets/anime） |
| --- | --- | --- | --- | --- |
| `spark` | 引火学徒 | 随从 | [`spark.webp`](../assets/anime/spark.webp) | `sources/01-apprentices.png` |
| `squire` | 晨曦侍从 | 随从 | [`squire.webp`](../assets/anime/squire.webp) | `sources/01-apprentices.png` |
| `wolf` | 月影幼狼 | 随从 | [`wolf.webp`](../assets/anime/wolf.webp) | `sources/01-apprentices.png` |
| `archer` | 边境游侠 | 随从 | [`archer.webp`](../assets/anime/archer.webp) | `sources/01-apprentices.png` |
| `guard` | 铁誓卫士 | 随从 | [`guard.webp`](../assets/anime/guard.webp) | `sources/01-apprentices.png` |
| `oracle` | 星界观测者 | 随从 | [`oracle.webp`](../assets/anime/oracle.webp) | `sources/01-apprentices.png` |
| `wisp` | 暮光精灵 | 随从 | [`wisp.webp`](../assets/anime/wisp.webp) | `sources/01-apprentices.png` |
| `spider` | 幽谷蛛后 | 随从 | [`spider.webp`](../assets/anime/spider.webp) | `sources/02-vanguards.png` |
| `sentinel` | 烬翼斥候 | 随从 | [`sentinel.webp`](../assets/anime/sentinel.webp) | `sources/02-vanguards.png` |
| `assassin` | 夜幕刺客 | 随从 | [`assassin.webp`](../assets/anime/assassin.webp) | `sources/02-vanguards.png` |
| `cleric` | 曙光祭司 | 随从 | [`cleric.webp`](../assets/anime/cleric.webp) | `sources/02-vanguards.png` |
| `berserker` | 赤岩狂战士 | 随从 | [`berserker.webp`](../assets/anime/berserker.webp) | `sources/02-vanguards.png` |
| `golem` | 符文石像 | 随从 | [`golem.webp`](../assets/anime/golem.webp) | `sources/02-vanguards.png` |
| `leech` | 血月行者 | 随从 | [`leech.webp`](../assets/anime/leech.webp) | `sources/02-vanguards.png` |
| `treant` | 古木守护者 | 随从 | [`treant.webp`](../assets/anime/treant.webp) | `sources/03-guardians.png` |
| `phoenix` | 不灭凤凰 | 随从 | [`phoenix.webp`](../assets/anime/phoenix.webp) | `sources/03-guardians.png` |
| `rider` | 霜牙狼骑 | 随从 | [`rider.webp`](../assets/anime/rider.webp) | `sources/03-guardians.png` |
| `necromancer` | 亡者织梦师 | 随从 | [`necromancer.webp`](../assets/anime/necromancer.webp) | `sources/03-guardians.png` |
| `paladin` | 圣光裁决者 | 随从 | [`paladin.webp`](../assets/anime/paladin.webp) | `sources/03-guardians.png` |
| `titan` | 玄铁泰坦 | 随从 | [`titan.webp`](../assets/anime/titan.webp) | `sources/03-guardians.png` |
| `huntress` | 荒野之矛 | 随从 | [`huntress.webp`](../assets/anime/huntress.webp) | `sources/03-guardians.png` |
| `dragon` | 烬喉幼龙 | 随从 | [`dragon.webp`](../assets/anime/dragon.webp) | `sources/04-legends.png` |
| `reaper` | 黯月收割者 | 随从 | [`reaper.webp`](../assets/anime/reaper.webp) | `sources/04-legends.png` |
| `colossus` | 远古山岳 | 随从 | [`colossus.webp`](../assets/anime/colossus.webp) | `sources/04-legends.png` |
| `solaris` | 逐日者·索拉 | 随从 | [`solaris.webp`](../assets/anime/solaris.webp) | `sources/04-legends.png` |
| `nyx` | 星陨女王·妮克丝 | 随从 | [`nyx.webp`](../assets/anime/nyx.webp) | `sources/04-legends.png` |
| `ashdragon` | 终焰·阿什拉 | 随从 | [`ashdragon.webp`](../assets/anime/ashdragon.webp) | `sources/04-legends.png` |
| `frostking` | 白霜之王 | 随从 | [`frostking.webp`](../assets/anime/frostking.webp) | `sources/04-legends.png` |
| `bolt` | 星火箭 | 法术 | [`bolt.webp`](../assets/anime/bolt.webp) | `sources/05-elements.png` |
| `frostbolt` | 寒霜之触 | 法术 | [`frostbolt.webp`](../assets/anime/frostbolt.webp) | `sources/05-elements.png` |
| `fireball` | 陨火术 | 法术 | [`fireball.webp`](../assets/anime/fireball.webp) | `sources/05-elements.png` |
| `nova` | 冰封领域 | 法术 | [`nova.webp`](../assets/anime/nova.webp) | `sources/05-elements.png` |
| `storm` | 烈焰风暴 | 法术 | [`storm.webp`](../assets/anime/storm.webp) | `sources/05-elements.png` |
| `wisdom` | 星界密卷 | 法术 | [`wisdom.webp`](../assets/anime/wisdom.webp) | `sources/05-elements.png` |
| `blessing` | 黎明祝福 | 法术 | [`blessing.webp`](../assets/anime/blessing.webp) | `sources/05-elements.png` |
| `renew` | 生命之泉 | 法术 | [`renew.webp`](../assets/anime/renew.webp) | `sources/06-rituals.png` |
| `execute` | 暗影湮灭 | 法术 | [`execute.webp`](../assets/anime/execute.webp) | `sources/06-rituals.png` |
| `silence` | 遗忘咒印 | 法术 | [`silence.webp`](../assets/anime/silence.webp) | `sources/06-rituals.png` |
| `rally` | 王者号令 | 法术 | [`rally.webp`](../assets/anime/rally.webp) | `sources/06-rituals.png` |
| `wolves` | 群狼呼唤 | 法术 | [`wolves.webp`](../assets/anime/wolves.webp) | `sources/06-rituals.png` |
| `shield` | 圣光庇佑 | 法术 | [`shield.webp`](../assets/anime/shield.webp) | `sources/06-rituals.png` |
| `lifedrain` | 灵魂虹吸 | 法术 | [`lifedrain.webp`](../assets/anime/lifedrain.webp) | `sources/06-rituals.png` |
| `dagger` | 银月双刃 | 武器 | [`dagger.webp`](../assets/anime/dagger.webp) | `sources/07-relics.png` |
| `sunblade` | 日耀圣剑 | 武器 | [`sunblade.webp`](../assets/anime/sunblade.webp) | `sources/07-relics.png` |
| `polymorph` | 迷途化形 | 法术 | [`polymorph.webp`](../assets/anime/polymorph.webp) | `sources/07-relics.png` |
| `discovery` | 虚空洞见 | 法术 | [`discovery.webp`](../assets/anime/discovery.webp) | `sources/07-relics.png` |
| `ambush` | 镜像伏击 | 法术 | [`ambush.webp`](../assets/anime/ambush.webp) | `sources/07-relics.png` |
| `battlecry` | 战意沸腾 | 法术 | [`battlecry.webp`](../assets/anime/battlecry.webp) | `sources/07-relics.png` |
| `coin` | 以太硬币 | 衍生牌 | [`coin.webp`](../assets/anime/coin.webp) | `sources/07-relics.png` |
| `pup` | 幽灵狼 | 衍生牌 | [`pup.webp`](../assets/anime/pup.webp) | `sources/08-companions.png` |
| `spiritwolf` | 灵狼 | 衍生牌 | [`spiritwolf.webp`](../assets/anime/spiritwolf.webp) | `sources/08-companions.png` |
| `skeleton` | 骸骨 | 衍生牌 | [`skeleton.webp`](../assets/anime/skeleton.webp) | `sources/08-companions.png` |
| `stone` | 石卫 | 衍生牌 | [`stone.webp`](../assets/anime/stone.webp) | `sources/08-companions.png` |
| `sheep` | 绵羊 | 衍生牌 | [`sheep.webp`](../assets/anime/sheep.webp) | `sources/08-companions.png` |
| `recruit` | 曙光新兵 | 衍生牌 | [`recruit.webp`](../assets/anime/recruit.webp) | `sources/08-companions.png` |
| `thorn` | 荆棘树灵 | 衍生牌 | [`thorn.webp`](../assets/anime/thorn.webp) | `sources/08-companions.png` |

## 新环境图版

| 运行时键 | 内容 | 实际图版 | 尺寸 |
| --- | --- | --- | --- |
| `building-brewery` | 旅人的酒馆 | [`building-brewery.webp`](../assets/windborne/building-brewery.webp) | 558×543 |
| `building-observatory` | 星辉观测台 | [`building-observatory.webp`](../assets/windborne/building-observatory.webp) | 406×547 |
| `building-mine` | 蓝晶矿脉 | [`building-mine.webp`](../assets/windborne/building-mine.webp) | 520×398 |
| `building-forge` | 余烬锻炉 | [`building-forge.webp`](../assets/windborne/building-forge.webp) | 350×556 |
| `horizon` | 远方天际 | [`horizon.webp`](../assets/windborne/horizon.webp) | 1536×130 |
| `paper` | 纸纹 | [`paper.webp`](../assets/windborne/paper.webp) | 512×512 |
| `wood` | 木纹 | [`wood.webp`](../assets/windborne/wood.webp) | 512×256 |
| `board` | 棋盘 | [`board.webp`](../assets/windborne/board.webp) | 1600×940 |
| `leaf-seal` | 叶片徽章 | [`leaf-seal.svg`](../assets/windborne/leaf-seal.svg) | SVG矢量 |

## 英雄和首领的复用关系

英雄：星焰法师→`oracle`，黎明圣卫→`paladin`，暗影游侠→`archer`。
首领：灰烬监守→`berserker`，荆棘女王→`treant`，深渊先知→`necromancer`，霜狱君王→`frostking`，终焉巨龙→`ashdragon`。

注意卡牌`oracle`与深渊先知、卡牌`dragon`与终焉巨龙存在ID重名。`EmberArt.card()`读取卡牌专属图，`EmberArt.character()`读取角色定义中的 `portraitId`。改动后运行`node --test tests/anime_assets.test.cjs`。

## 权利与分发说明

代码许可和第三方说明见根目录`LICENSE`、`THIRD_PARTY.md`。素材来源说明不是额外的商业版权担保。不要将这些素材描述为原版炉石素材或独立手绘原画，也不要分发系统字体、未附许可的依赖二进制。

## 角色静态插画登记

`config/characters.json` 是唯一正式角色配置源，每项只有 `staticKey`（必须等于自身 ID）和 `focus`（纵向裁切焦点 0–100）。ID 集合必须与 `assets/anime/manifest.json` 完全相等。运行图为 `assets/anime/` 顶层 WebP，由 `EmberArt.card()` / `EmberArt.character()` 读取，`AtelierArt` 只负责裁切焦点。`tools/characters.py` 在构建时校验清单并生成 `src/character-catalog.js`；`python3 tools/characters.py --list` 输出完整登记清单。制作与验收命令见 [角色制作规范](CHARACTER_AUTHORING.md)。

> 2026-09-18 立绘动画移除。按用户决定，卡面与英雄头像上的分层立绘动画端到端删除，只保留静态插画：
>
> - 删除 `src/presentation/portraits.js`（`EmberPortraits`，18,855 字节）与生成物 `src/motion-assets.js`（7,579,378 字节），以及 `config/build.json` / `src/template.html` 中的 `PORTRAITS`、`MOTION_ASSETS` 注册。
> - 删除 `assets/motion/`（191 个文件，170,840,057 字节；含 102 张分层 WebP、`sources/`、`moon-anime-v2/`、`pantheon-sources/` 与 `PROMPTS.md` / `PROMPTS-v2.json` / `BATCH_A.md` / `BATCH_B.md` / `BATCH_TOKENS.md` 等制作记录）。制作过程只在本文与 git 历史中留痕。
> - 删除打包链路 `tools/pack_motion_assets.cjs`、`tools/chroma_motion_atlas.cjs` 与 `tests/art/motion-packing.test.cjs`（`tests/art/` 随之清空，`npm run test:art` 一并取消）。
> - `config/characters.json` 删掉 `motion` 字段并保留 `staticKey` / `focus`（它仍是 `AtelierArt` 焦点与 `art.js` 路由的唯一来源，因此不整体删除）。`tools/characters.py` 相应删去图层、rig、哈希校验与 `motion-assets.js` 生成。
> - 运行时删掉 `.portrait-motion` 画布、`motion-ready` / `motion-arriving` / `motion-entering` 类、`data-portrait-*` 与 `data-art-version` 属性，以及 `effects.js` 的 `copyPortraits` 与召唤预载。冲撞克隆改为直接克隆表现快照元素。`data-art-key` 保留作调试与端到端定位。
> - 构建体积：`index.html` 31,675,676 → 24,067,789 字节；`dist/` 24,278,693 → 18,563,612 字节，文件数 299 → 204。
>
> **接触数字预算由 34ms 放宽到 45ms**。`EmberPortraits` 每帧都在画布上绘制，渲染器因此始终处在稳定的逐帧绘制节奏里；移除后页面在节拍之间基本空闲，接触数字的定时回调在帧内的相位平均后移约一帧。实测（同一台机器、同一时段交替测量，`tests/e2e/presentation-causality.spec.cjs:319` 的敌方回合场景）最大延迟：移除前 19.5–33.4ms（0/24 次超 34ms），移除后 20.5–38.8ms（7/24 次超 34ms）。
>
> 试过但无效、已全部回退的优化：把冲撞克隆体的 `filter: drop-shadow` 改成 `steps(1, end)` 阶跃轨道（桌面 37.7→35.2、手机 37.8→38.7，在噪声内，且会让抬起段的投影从渐变变成跳变）、`.minion-art{contain:paint}`、`.attack-actor{will-change:transform}`、卡面 `decoding="async"`。决定性的对照是把场上 `<img>` 整体设为 `opacity:0`：交替测量下与不改完全一致（36.0–37.6ms），说明代价不在插画光栅化，而在于失去了逐帧绘制带来的帧内相位——唯一能"修复"它的办法就是重新加回每帧画布绘制，与本次移除的目的相悖。上限改为 45ms（≈2.7 帧，实测上限 38.8ms，留约 6ms 余量）的理由写在 `docs/design/BATTLE_PRESENTATION_V2.md` §2 原则 4 与 §5.1；运行时常量为 `EmberTiming.numberSyncMs`（`src/presentation/timing.js`），同处改了 `tests/e2e/presentation-causality.spec.cjs` 与 `tests/e2e/vfx-signatures.spec.cjs` 共 5 处断言常量。§5.5 里"桌面与手机节拍时间差不超过 34ms"是另一条断言（跨设备节拍顺序），未改动。

## 酒馆誓约扩展

新增 `counterspell`、`icebarrier`、`muster`、`absolution`、`tracking`、`sabotage` 六张独立法术插画，总计 62 张卡图（54 可组牌 + 8 衍生）。源图及提示词保存在 `assets/anime/expansion-sources/`。每张图片使用内置 image_gen 独立生成并检查，tracking 对右下角伪文字做过一次局部修正。源文件和运行文件哈希均记录在原统一 manifest 中；原有 56 个图像文件没有替换。

六张新法术在 `config/characters.json` 中注册；当时的 35 个动态随从分层已于 2026-09-18 随立绘动画整体移除。

## v0.12.1 遗物图标

`assets/relics/sources/` 保存六张独立生成原画及 provenance.json；`assets/relics/*.webp` 为 256px 运行图。打包输入仍使用 `assets/anime/non-card-relics.json`，由现有 packer 生成 `src/relic-assets.js`。原 62 张卡图未改动。

## 本地战斗音效（2026-09-08）

12 段 Kenney CC0 Foley、原件、许可和测量位于 `assets/audio/`。`tools/audio_assets.py` 校验清单哈希，构建时生成 `src/audio-assets.js`；单文件内嵌，网页构建提取成哈希命名 MP3。声音总线和元素合成在 `src/platform/audio.js`，事件时序由 `src/presentation/combat.js` / `src/effects.js` 驱动。详见 [音画反馈优化](AUDIO_FEEDBACK.md)。

## 本地攻击与法术特效（2026-09-08）

> 2026-09-17 起本节素材已删除。战斗表现层 V2 只保留一个特效后端 EmberFx2（WebGL，`src/fx2-engine.js` / `src/fx2-shaders.js`，素材在 `assets/fx2/`），切入立绘在 `assets/cutin/`（`tools/cutin_assets.py` 生成 `src/cutin-assets.js`）。原 Kenney Particle Pack / Mikodrak 2D Spell Effects 的 13 张 WebP、`assets/vfx/` 目录、`tools/vfx_assets.py`、`tools/repack_vfx.py` 与 `presentation/vfx.js`（EmberVFX）均不再存在。契约见 [战斗表现层 V2](design/BATTLE_PRESENTATION_V2.md)。
>
> 2026-09-18：切入只给英雄与传奇随从（契约 §2.8 / `cutinPolicy`），`assets/cutin/` 从 44 张裁到 17 张（10 个英雄 `portraitId` + 10 张传奇随从，四个 id 重合）。没有专用立绘的 id 一律不弹切入，**不再回退卡插画**（卡插画是 336×448 竖版，塞进 512² 切入取景会错位）。`src/cutin-assets.js` 3,209,955 → 1,303,031 字节。这张清单由 `tests/cutin-coverage.test.cjs` 守住：素材键集合必须与"传奇随从 + 英雄 portraitId"完全相等，多一个少一个都失败。原图保留在 `output/cutin-gen-20260916/raw`，是重做立绘的唯一来源。
>
> 2026-09-18：`assets/motion/sources/` 清掉 28 张无人引用的中间物（chroma / rejected / 被 v2 取代的旧版，65,358,590 字节），保留 54 张。**注意它不是纯中间物目录**：`config/characters.json` 的 `motion.atlas` / `motion.mask` 直接指向其中 53 个文件，`tools/characters.py` 的 `local_file()` 会在每次 `python3 build.py` 时校验它们存在，缺一个就构建失败；另有 `sources/pup-atlas-chroma.png` 是 `tests/art/motion-packing.test.cjs` 的夹具。`assets/motion/PROMPTS-v2.json` 里 wolf 的两条路径已成历史记录。同日删除 `assets/anime/generated/`（371 MB，168 个文件，全仓零引用，构建产物逐字节不变）与未跟踪的 `tools/.scratch/`（29 MB）。

历史记录：2026-09-08 起曾内嵌 13 张 CC0 无损 WebP 纹理/图集（Kenney 8 张、Mikodrak 5 套），由 EmberVFX 在 Canvas 上绘制；`presentation/fx-profiles.js` 的攻击 / 施法 / 传说登场注册仍在使用，但现在由导演层交给 EmberFx2 渲染。当时的体积与加载验证见 [战斗特效记录](VFX_FEEDBACK.md) 与 [清理记录](MEDIA_CLEANUP.md)。

## 月影神契（v0.13）

本轮新增十一张独立 AI 插画，总计 73 张严格 ID 映射卡图。`assets/anime/moon-sources/` 保存原画及提示词，`overrides.json` 注册来源，运行文件为同名 WebP。未使用《游戏王》的角色或素材；以庄严巨像、月蚀、祭坛和渺小朝圣者构成原创神祇。

历史记录：六个新随从（soulguide、moonfox、duskstag、eclipsewolf、moonguard、selmyra）当时制作了背景与主体两层，源图集与处理参数位于已删除的 `assets/motion/moon-sources/`。

莫菈复用 soulguide，断契监誓者复用 moonguard。完整清单见 [CHARACTER_ROSTER.txt](CHARACTER_ROSTER.txt)。

神祇、契兽与四位英雄的正式肖像卡图均保留 768×1024，以支持全屏契约档案及英雄选择底图；普通卡仍为 336×448。该尺寸由统一 packer 依据 contract 元数据和英雄 portraitId 派生，网页与离线单文件使用同一张图。

## 月影系列动漫风统一（2026-09-08）

按用户确认，对月影扩展全部十一张插画做 style-transfer 重绘。当前静态来源改为 `assets/anime/moon-anime-v2/`，逐卡提示词、身份/风格参考、哈希及美术方向均留档。原 `moon-sources/` 仅作为前版来源保留。原有其他卡牌不重画。

历史记录：六个随从对应分层当时改为 `assets/motion/moon-anime-v2/`（已随立绘动画一并删除）。静态原画 `assets/anime/moon-anime-v2/` 保留并仍在使用。

验证见 [月影画风统一记录](QA_MOON_ART_RESTYLE.md)。

## 诸神同辉（v0.14）

新增 jingchen、aurion、fenlos 三位神祇与 starweave、dawnvow、huntinghorn 三张法术，总计 79 张独立卡图。原画、完整提示和风格参考哈希在 `assets/anime/pantheon-sources/`，统一 overrides / manifest / packer 接入，神祇仍使用 768×1024、普通法术 336×448 的运行 WebP。

历史记录：三位神当时各自生成了背景/主体图集，输入与 alpha 处理参数保存在已删除的 `assets/motion/pantheon-sources/`。静态原画 `assets/anime/pantheon-sources/` 保留并仍在使用。检查记录见 [诸神验收](QA_PANTHEON.md)。

## 2026-09-09 界面器物素材

`assets/ui/manifest.json` 管理原创星火徽章与胡桃木古金透明边框，制作简报见 `assets/ui/PROMPTS.md`。源图保存在 `assets/ui/sources/`；WebP 用于界面，所有文字和数值仍由 DOM 绘制。`tools/ui_assets.py` 使用标准库校验 SHA-256 并生成 `src/ui-assets.js`，由构建注册表装入离线版与 HTTP 版。此次没有替换任何角色原画。

本轮后续新增专用英雄冠饰、收藏书脊、契约祭坛环。书脊首版因实际显示像短把手被拒收，v2重新生成14:1细长装订条；原图和返工记录均保留。完整来源、提示词、处理参数以 `assets/ui/manifest.json` 为准，评审见 `docs/UI_CRAFT_REVIEW_20260909.md`。


## 2026-09-13 剩余参考页面素材

`assets/ui/page-reference-v1/`：透明遗物图标与胜利徽记，以 `EmberThemeDefinition.art` 语义角色消费（`relicHeart` / `relicLens` / `relicCrown` 经 `src/art.js`，`victorySigil` 经 `--victory-sigil`）；卡牌插画映射不变。生成来源、Alpha 实测与散列见该目录 `provenance.json`；页面状态与对照见 [参考页面档案](design/reference-pages/INDEX.md)。素材为参考重建，未声称原图无损提取。

> 2026-09-14 旧主题移除：本包原有的八张页面背景板（换牌、奖励、结算、设置、手册、详情、发现、确认）与失败背景只被旧星海银蓝材质规则消费，已连同其 PNG 生成副本删除。

## 2026-09-14 旧主题位图清理

磨砂青岩（slate）成为唯一表现层后，只有旧主题读取的界面位图全部退役：

| 位置 | 处理 |
|---|---|
| `assets/ui/detail-polish-v1/` | 整目录删除（卡框、药丸按钮皮、选择面板、已退役的 turn-ring；主题角色 `polishCardFrame` / `polishButtonCapsule` / `polishButtonNight` / `polishSelectionPanel` 一并删除） |
| `assets/ui/home-reference-v1/` | 只保留 `final/{logo,card-portal,card-tree,card-dragon}.webp` 与裁剪后的 `manifest.json` / `provenance.json` / `prompts/`；位图按钮皮、compass、全部 PNG 中间件与 `sources/`、`reference-crops/`、`process_assets.py`、`validation.json` 删除 |
| `assets/ui/page-reference-v1/` | 只保留 `relic-*.webp` 与 `victory-sigil.webp`，其余删除 |

这些文件不进入构建注册表（`tools/ui_assets.py` 只处理 `assets/ui/manifest.json` 的五项器物素材），删除不改变 `python3 build.py` 的产物路径。

## 2026-09-13 · 地图对应的俯视战场

战场不再是一张位图。`presentation/arena-3d.js` 在 `#arena-gl`（WebGL2）里实时渲染「断裂王庭」（2026-09-23 重做，场景说明见 `docs/design/SLATE_DESIGN_SYSTEM.md` §5.4b）：火山灰石台基、左右熔岩河、柱状玄武岩与紫水晶/祖母绿晶簇，随从的 DOM 包围盒转成接触阴影。它只用 `assets/scenes/lava-forge/` 里的 6 张贴图（ambientCG CC0：Rock035 的法线、粗糙度、AO，Lava001 的法线、颜色、自发光，缩至 512–1024 并重新压缩），颜色由代码里的令牌决定。原来引入的 Lava001 粗糙度与 Metal032 法线/粗糙度三张图着色器从未采样，2026-09-23 已移除。旧的六张俯视场景图（`boss-topdown-v1`）已移除；六个 Boss 目前共用这一场景，`EmberArena3D.setEncounter` 保留了按 Boss 换调色板的入口。

上一轮地面视角图保存在 `output/boss-topdown-20260913/ground-level-sources/`，旧桌面/横竖屏背景保存在 `output/boss-map-20260913/retired/`，均移出生产素材注册。官方参考仅作为研究证据，见 `output/boss-topdown-20260913/RESEARCH.md`，没有复制其图片到游戏。

## 2026-09-13 · 战场控件与旧运行素材清理

战场辅助按钮与结束回合改为原生细线控件，主题注册不再引用 `polishTurnRing`。旧纸木地图纹理声明和 `WORLD_ASSETS` 注册已移除；早期 `WindborneAssets` 建筑仅保留源文件，不进入当前游戏。画廊消费现有六处 Boss 场景，没有新增或替换卡牌原画。`premium.css` 只保留必要数字与牌面几何，现行材质归属 `components.css`。验证见 [本轮记录](../output/battle-layout-20260913/VALIDATION.md)。
