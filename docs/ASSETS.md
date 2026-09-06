# 素材目录与加工关系

## 当前版本的真实来源

- 卡牌：56张不同的WebP图版（48张可组牌卡+8张衍生牌），每张336×448。由用户确认的8张素材表裁切、去标题条和等比处理得到；原始PNG全部保留。没有声称56次独立高清生成。
- 新环境：9个运行时图版，含4座建筑、天际、纸纹、木纹、棋盘与叶片徽章。建筑/天际按批准环境示意图提取；界面/表面素材由脚本制作。不是完整三维建筑网格。
- 英雄/首领：显式复用主题卡图。不要以同名ID覆盖卡牌原画；路由需结合角色上下文/配色。
- 六件非卡牌遗物保留继承图；人物卡图不回退到旧程序化插画。
- 字体不随包提供。音频由Web Audio合成，没有外部BGM或音效文件遗漏。

## 文件与编辑方式

| 路径 | 用途 |
| --- | --- |
| `assets/anime/*.webp` | 56张实际运行卡图；`manifest.json`逐张记录名称、类型、原图、裁切窗口与哈希 |
| `assets/anime/sources/*.png` | 8张批准卡牌素材表；不是依赖或可随意删除的下载缓存 |
| `assets/anime/Contact_Sheet.jpg` | 56张实际图版的美术总览 |
| `assets/anime/frame-sources/` | 兼容卡框加工输入；`prepare_anime_runtime.py`需要它们 |
| `assets/anime/non-card-relics.json` | 六种非卡牌遗物图输入 |
| `assets/references/world/*.png` | 两张批准的环境参考；本轮生产提取使用`approved-village.png` |
| `assets/windborne/*.webp` | 新环境/材质独立资产；来源与蒙版见同目录`manifest.json` |
| `assets/atelier/*.webp` | 历史兼容环境/卡框输入；已有场景回退和缓存重建仍使用，未作为新角色插画回退 |
| `src/anime-assets.js` | 56张卡图内嵌缓存，由`tools/build_anime_assets.py`生成 |
| `src/world-assets.js` | 新环境内嵌缓存，由`tools/build_world_assets.py`生成 |
| `src/atelier-assets.js` / `src/portraits.js` | 兼容环境/卡框及遗物缓存，由`tools/prepare_anime_runtime.py`生成 |
| `src/materials.js` / `src/backdrops.js` | 继承的内嵌纹理/场景输入，仍被当前构建引用 |
| `src/atelier-art.js` | 卡图路由、英雄/首领复用关系、焦点/缩放参数 |

正常改代码不需要重新生图或裁图。新增卡牌时必须同步`src/data.js`、素材映射/清单、图片缓存和测试。替换WebP文件本身不会自动更新已经内嵌的JavaScript缓存；需要同步加工管线再运行`build.py`。费用、描述和属性必须继续由DOM动态显示。

原始素材和当前图版都保留，是为了后续可以重新裁切、修正蒙版或替换美术；这也是压缩包主要体积来源。没有PSD/分层绘画工程可提供；当前真正的可编辑输入是PNG、WebP、JSON蒙版/焦点配置与生成脚本。

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

注意卡牌`oracle`与深渊先知、卡牌`dragon`与终焉巨龙存在ID重名。`EmberArt.card()`读取卡牌专属图，角色肖像通过当前`AtelierArt`路由处理。改动后运行`node --test tests/anime_assets.test.cjs`。

## 权利与分发说明

代码许可和第三方说明见根目录`LICENSE`、`THIRD_PARTY.md`。素材来源说明不是额外的商业版权担保。不要将这些素材描述为原版炉石素材或独立手绘原画，也不要分发系统字体、未附许可的依赖二进制。
