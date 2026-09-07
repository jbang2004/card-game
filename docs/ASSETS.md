> 当前统一角色配置与制作契约见 [CHARACTER_AUTHORING.md](CHARACTER_AUTHORING.md)。下文涉及独立 motion manifest / portrait-profiles 的描述是早期阶段记录，已由 `assets/characters.json` 取代。

# v0.11 素材与加工

运行时保留 56 张已确认卡图、6 张遗物、当前完整酒馆图和山谷原画档案。角色明确复用卡图；不加载旧程序化人物、旧 Three.js 场景、旧卡框缓存或旧酒馆背景。

| 输入/源码 | 用途 |
|---|---|
| `assets/anime/*.webp` / `manifest.json` | 56 张运行卡图、来源和文件哈希 |
| `assets/anime/sources/*.png` | 八张已确认原始图集，原始输入留档 |
| `assets/anime/overrides.json` / `overrides/`（有替换时创建） | 独立卡图来源，整体裁图时仍优先使用 |
| `assets/anime/non-card-relics.json` | 六张已有遗物的原始内嵌图 |
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
