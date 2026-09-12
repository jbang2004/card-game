> 2026-09-12 界面与素材更新见 [星海银蓝重构说明](design/SILVERBLUE_REBUILD.md)。下文旧视觉架构和数量属于历史记录，以当前注册表及内容数据为准。

> 素材清理更新：旧版 moon-sources 已按用户要求删除。当前只保留 moon-anime-v2 原画、分层制作源及其运行 WebP。下文旧路径属于历史制作记录。

> 当前统一角色配置与制作契约见 [CHARACTER_AUTHORING.md](CHARACTER_AUTHORING.md)。下文涉及独立 motion manifest / portrait-profiles 的描述是早期阶段记录，已由 `assets/characters.json` 取代。

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

## 角色动态素材

`assets/characters.json` 是唯一正式角色配置源，`assets/motion/` 保存按 ID 命名的背景、主体与必要前景 WebP，`sources/` 保存可复现的生成输入。实际动态覆盖以 `python3 tools/characters.py --list` 为准；上场角色来自游戏的随从定义及英雄/首领 `portraitId`。

原 56 张静态卡图保留，手牌、选卡与自动悬停预览使用原图；场上及显式检查窗口播放动态。网页版本按需加载、限额解码，离线单文件版内嵌压缩素材并按需解码。没有恢复 Three.js、视频播放器或独立角色时钟。

制作与验收命令见 [角色制作规范](CHARACTER_AUTHORING.md)。共用打包器为 `tools/pack_motion_assets.cjs`；纯色底输入可用 `tools/chroma_motion_atlas.cjs` 转为真实 alpha，此素材制作步骤需要本机 FFmpeg 和项目已声明的 Playwright，普通构建与游戏运行均不需要 FFmpeg。

初始素材来源见 [PROMPTS.md](../assets/motion/PROMPTS.md)，本轮逐角色请求与处理记录见 [BATCH_A.md](../assets/motion/BATCH_A.md)、[BATCH_B.md](../assets/motion/BATCH_B.md)、[BATCH_TOKENS.md](../assets/motion/BATCH_TOKENS.md)。它们记录制作过程；最终动作参数始终以正式清单为准。

## 酒馆誓约扩展

新增 `counterspell`、`icebarrier`、`muster`、`absolution`、`tracking`、`sabotage` 六张独立法术插画，总计 62 张卡图（54 可组牌 + 8 衍生）。源图及提示词保存在 `assets/anime/expansion-sources/`。每张图片使用内置 image_gen 独立生成并检查，tracking 对右下角伪文字做过一次局部修正。源文件和运行文件哈希均记录在原统一 manifest 中；原有 56 个图像文件没有替换。

六张新法术在 `assets/characters.json` 中注册为静态，不需要随从分层动作；原 35 个动态随从保持完整。

## v0.12.1 遗物图标

`assets/relics/sources/` 保存六张独立生成原画及 provenance.json；`assets/relics/*.webp` 为 256px 运行图。打包输入仍使用 `assets/anime/non-card-relics.json`，由现有 packer 生成 `src/relic-assets.js`。原 62 张卡图未改动。

## 本地战斗音效（2026-09-08）

12 段 Kenney CC0 Foley、原件、许可和测量位于 `assets/audio/`。`tools/audio_assets.py` 校验清单哈希，构建时生成 `src/audio-assets.js`；单文件内嵌，网页构建提取成哈希命名 MP3。声音总线和元素合成在 `src/platform/audio.js`，事件时序由 `src/presentation/combat.js` / `src/effects.js` 驱动。详见 [音画反馈优化](AUDIO_FEEDBACK.md)。

## 本地攻击与法术特效（2026-09-08）

清理后保留 13 张有透明通道的 CC0 无损 WebP 纹理/图集：Kenney Particle Pack 的 8 张刀光、爪痕、烟尘与光纹；Mikodrak 2D Spell Effects 的 5 套火焰斩、爆破、电光及能量动画。作者页面、许可快照、选用原件、逐文件/逐帧 SHA-256、处理尺寸与落点锚点都保留在 [assets/vfx](../assets/vfx/README.md)。这些素材通过合法公开来源引入，不包含炉石游戏文件。

`tools/vfx_assets.py` 使用标准库校验并内嵌素材，网页构建提取为本地内容哈希 WebP；`tools/repack_vfx.py` 可使用已声明的 Pillow 从原件重建。运行时的七类攻击、具名施法与四张传说签名由 `presentation/fx-profiles.js` 注册，`presentation/vfx.js` 使用现有 Canvas 时钟。详见 [战斗特效记录](VFX_FEEDBACK.md)。

2026-09-08 的资源清理将特效下载量减少至 879,870 字节，删除闲置 smoke，保留所有使用中图片的精确 RGBA。体积与加载隔离验证见 [清理记录](MEDIA_CLEANUP.md)。

## 月影神契（v0.13）

本轮新增十一张独立 AI 插画，总计 73 张严格 ID 映射卡图。`assets/anime/moon-sources/` 保存原画及提示词，`overrides.json` 注册来源，运行文件为同名 WebP。未使用《游戏王》的角色或素材；以庄严巨像、月蚀、祭坛和渺小朝圣者构成原创神祇。

六个新随从（soulguide、moonfox、duskstag、eclipsewolf、moonguard、selmyra）都有背景与主体两层。源图集、参考静态原画和逐角色提示词位于 `assets/motion/moon-sources/`；完整技术参数及切分坐标见其中的 `processing.json`。本轮采用绿色键色、0.30 similarity、0.08 blend 与 green despill，消除透明边缘绿色污染。保留生成原图和真实 alpha 处理结果，最终 rig 仍以 `assets/characters.json` 为唯一来源。

莫菈复用 soulguide，断契监誓者复用 moonguard。全游戏 41 个随从均有分层待机，其余 32 张法术/武器保持静态。完整清单见 [CHARACTER_ROSTER.txt](CHARACTER_ROSTER.txt)。

神祇的运行卡图保留 768×1024，以支持全屏仪式；普通卡仍为 336×448。该尺寸由统一 packer 依据 divine 元数据派生，网页与离线单文件使用同一张图。

## 月影系列动漫风统一（2026-09-08）

按用户确认，对月影扩展全部十一张插画做 style-transfer 重绘。当前静态来源改为 `assets/anime/moon-anime-v2/`，逐卡提示词、身份/风格参考、哈希及美术方向均留档。原 `moon-sources/` 仅作为前版来源保留。原有其他卡牌不重画。

六个随从对应分层改为 `assets/motion/moon-anime-v2/`，仍为背景/主体两层。新版 `green-edge` 去溢色仅处理透明轮廓附近的过量绿色，保留内部青色灯光、衣料和肤色；各卡实际 split 与处理参数见 `*-processing.json`。神祇 split 771、背景宽 767，其余 split 768，均按各自图集观察确认。

清单、静态与动态缓存已重新构建。验证见 [月影画风统一记录](QA_MOON_ART_RESTYLE.md)。

## 诸神同辉（v0.14）

新增 jingchen、aurion、fenlos 三位神祇与 starweave、dawnvow、huntinghorn 三张法术，总计 79 张独立卡图。原画、完整提示和风格参考哈希在 `assets/anime/pantheon-sources/`，统一 overrides / manifest / packer 接入，神祇仍使用 768×1024、普通法术 336×448 的运行 WebP。

三位神分别使用自己的原画生成背景/主体图集，输入、提示、alpha 处理参数保存在 `assets/motion/pantheon-sources/`。星焰和曙日用绿色键色与 green-edge，荒猎用洋红键色避免影响翠绿眼睛，并用新增 magenta-edge 去除轮廓粉边。处理只限制于透明轮廓附近，不改主体内部颜色。星焰背景残留冠冕经过定点重绘修复，修订前输入留档。

全游戏 44 个上场随从都有真实 alpha 分层待机，35 张法术/武器静态。运行脚本使用现有角色渲染器；没有增加 Three.js、视频播放器或新动画时钟。检查记录见 [诸神验收](QA_PANTHEON.md)。

## 2026-09-09 界面器物素材

`assets/ui/manifest.json` 管理原创星火徽章与胡桃木古金透明边框，制作简报见 `assets/ui/PROMPTS.md`。源图保存在 `assets/ui/sources/`；WebP 用于界面，所有文字和数值仍由 DOM 绘制。`tools/ui_assets.py` 使用标准库校验 SHA-256 并生成 `src/ui-assets.js`，由构建注册表装入离线版与 HTTP 版。此次没有替换任何角色原画。

本轮后续新增专用英雄冠饰、收藏书脊、契约祭坛环。书脊首版因实际显示像短把手被拒收，v2重新生成14:1细长装订条；原图和返工记录均保留。完整来源、提示词、处理参数以 `assets/ui/manifest.json` 为准，评审见 `docs/UI_CRAFT_REVIEW_20260909.md`。
