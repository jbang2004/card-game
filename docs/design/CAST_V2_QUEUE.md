# 全员重构 v2：待生成队列

2026-10-02 codex 生图额度用完（HTTP 429，24 小时窗口，到 2026-10-02 08:15 重置）。队列里的立绘、道具、第二批对手后来都改用 Tripo 的图片页做完了（见 CAST_V2.md「P5」各节）；下面的提示词留作记录，额度恢复后可再用 `~/.claude/skills/codex-image/gen.sh`。仍未做的只有新首页标志（游戏名《琥珀战记》）和镜中四英雄、伊芙。

通用头（人物，3:4）：`Use case: new-asset. Asset type: production game character portrait (three-quarter length), NOT a screenshot or mockup. The input image is a STYLE reference only (painterly anime rendering quality, muted lived-in palette, soft ordinary light): do NOT copy its pose, costume, composition, background or the man himself. Camera: eye-level, figure centered, face in the upper third of the frame. An ordinary working person of a coal-and-steam mining country, NOT a legendary hero: NO halo, NO glowing magic aura, NO floating objects, NO low-angle heroic pose, NO billowing cape, NO ornate gold filigree.`
通用尾：`Output full-bleed 3:4 at high resolution. ZERO baked text, numbers, letters, logos, icons, interface controls, borders or watermarks anywhere (any writing must be unreadable scribble).`

## 一、预设劲敌的面孔（P4）：已完成（改用 Tripo 图片生成，见 CAST_V2.md），以下仅留作提示词记录

接线已完成（`EmberArt.rivalFace`、战场敌方牌、手机敌情档案、路线页对手卡、切入图规避），**数据先不加**：出图后在 `campaign.js` 的 `archetypes` 每项加 `person`（显示名）与 `portraitId`，在 `portraits.js` 登记，再 `tools/portrait_assets.py` 转 WebP。

| 预设（archetype id） | person | portraitId | 主体 |
|---|---|---|---|
| mage_burn 星火连奏 | 炉前学徒 | apprentice | 19 岁炉房学徒，脸上煤灰，刘海烧焦，袖子卷起，带烧痕的皮围裙，手持铁钳，身后炉门飘出火星。炉火橙、煤灰 |
| mage_frost 永冬秘法 | 冰窖管事 | icekeeper | 五十来岁，厚重长呢大衣肩头结霜，胡子带霜，一手挂罩灯一手拿长冰钩，呼出白气；冷库隧道、冰块、梁上结霜 |
| paladin_swarm 黎明军势 | 民兵队长 | militia | 35 岁民兵班长，凹痕铁盔，棉甲加布袖章，腰挂小手鼓，持短矛，疲惫鼓舞的笑；身后松散的拿草叉的镇民；矿镇广场白天 |
| paladin_guard 不落圣盾 | 老卫兵 | oldguard | 六十多岁老门卫，白胡子，微驼但结实，双手拄着一面巨大的旧长方形塔盾，素色罩袍外套垫甲；矿镇石门洞正午 |
| ranger_pack 月影群猎 | 林地猎人 | woodswoman | 30 岁女猎手，林缘黄昏，短斗篷，腰挂猎刀，脚边两只小狼崽，一手按在近处小狼头上；暮绿、紫天 |
| ranger_death 亡者回响 | 掘墓人 | gravedigger | 45 岁掘墓人，夜里的村庄墓地，鸭舌帽，厚外套，肩扛铁锹，另一手提带罩的灯，墓碑隐入雾中，平静认命；夜蓝、灯琥珀 |
| moon_covenant 月影神契 | 月神殿修士 | moonmonk | 55 岁女修士，素灰兜帽长袍，腰挂小铜铃，一手提小纸灯，慈和而看不透的眼神；黄昏的石回廊，一弯细月 |
| moon_hunt 契兽群猎 | 驯兽人 | beasttamer | 28 岁女驯兽人，发间编着鹿角护符，补丁旅行外套，肩旁一头小鹿，另一臂卷着一只红狐，带点逗人的笑；黎明薄雾草地 |
| pantheon_stars 星焰天仪 | 天文台学者 | stargazer | 40 岁，皱巴巴的马甲、眼镜，指尖墨渍，腋下夹着沉重的黄铜手持望远镜，另一手拿满是看不清星图涂鸦的笔记本，疲惫而兴奋；小天文台圆顶的缝隙下星空 |
| pantheon_dawn 曙日誓军 | 教会卫士 | churchguard | 30 岁，素白罩袍绣简单黄色太阳，里面是锁子甲，素圆盾，腰挂钉头锤，诚实稳定的脸；矿镇礼拜堂门口的清晨 |
| pantheon_hunt 荒猎神途 | 山村猎手 | villagehunter | 五十五岁，灰胡子，饱经风霜，腰挂猎号，一手长矛，背包上系着狍鹿角战利品，眯眼远望；有几间小屋和炊烟的山坡 |

## 二、道具参考图（P5）：7 张，存 `assets/portraits/props/<名>.png`（1:1，纯灰底，单件，三分之二正面，参考图用对应角色立绘）

| 文件 | 来源立绘 | 道具 |
|---|---|---|
| shield_frederia | frederia | 圆木盾，铁边，盾心铁钉下嵌一小块金黄琥珀，盾面有刮掉徽记的亮斑 |
| sword_frederia | frederia | 普通单手剑，旧皮鞘，简单十字护手，缠绳握柄，斜放，入鞘 |
| bow_rowan | rowan | 缠布条握把的木短弓，握把上用麻绳绑一小块绿琥珀，弓弦松 |
| quiver_rowan | rowan | 普通皮箭袋，几支灰羽箭，插着一枝带红果的花楸，直立 |
| lantern_liol | liol | 凹痕黄铜矿工灯改的手提灯，提梁系褪色蓝布条，玻璃里一点稳定的火，灯座下卡一小块灰琥珀 |
| shield_rootkeeper | rootkeeper | 旧圆木盾，铁盾心，厚厚的白霜和冰晶，冰里有琥珀金脉 |
| loupe_nahira | nahira | 小黄铜放大镜，圆镜片，短黄铜柄，带短绳 |

头：`Use case: precise-object-edit. Asset type: 3D modeling reference image of a single game prop, NOT a screenshot or mockup. The input image is the CHARACTER REFERENCE that shows the prop in use: redraw ONLY the prop as an isolated object with exactly the same design, materials, wear and painterly anime rendering. The prop alone, centered, shown from a clear three-quarter front view, fully inside the frame with generous margin, flat even soft studio lighting, plain flat light-grey background (#D9D9D9), no hands, no person, no floor, no cast shadow.` 尾：`Output full-bleed 1:1 at high resolution. ZERO baked text, ... anywhere.`

## 三、第二批对手（立绘 + 切入图 + T 姿势参考图）——已于 2026-10-02 用 Tripo 图片页完成，下面的提示词留作记录

四位已做完（镜中四英雄是"按玩家英雄变脸"的新机制，伊芙在第 9 层，远征只有 8 层，两者暂缓）。额度恢复后（2026-10-02 08:15 之后）一次出齐，数据草稿如下，立绘到位后写进 `campaign.js` 的 `bosses`、`portraits.js`、`dungeon.js`，再跑 `tools/playtest-run.cjs` 看平衡。

| id | 名字 | 层 | 形象 | 数据草稿（全用现有卡与效果） |
|---|---|---|---|---|
| earlyriser | 早醒者 | 4–5 | 被矿工砸出琥珀的远古巨兽（长牙的披甲野猪/猛犸类），身上粘着碎琥珀和锤痕，痛得发狂，蒸汽从鼻孔喷出；矿洞深处的凿开的琥珀壳 | 血 40，技能「痛吼」2 费：对敌方随从各造成 1 点伤害；二阶段召唤 2 个石卫并全体 +1/+1。卡组：boar tortoise rider treant huntress berserker titan golem colossus moonguard eclipsewolf dragon wolves spider stone guard sentinel |
| amberbody | 琥珀之躯 | 4–5 | 联邦改造兵：半张脸封进琥珀，破损的灰蓝制服，另一半脸平静疲惫；工坊走廊的冷光 | 血 36，技能「琥珀装甲」2 费：获得 2 点护甲；二阶段 +6 护甲。卡组：guard sentinel acolyte vowguard dawnrider golem titan mirrormage oathkeeper sunblade shield blessing consecrate renew absolution archbishop |
| pawnbroker | 典当人 | 2–3 | 当铺铁栅栏后的干瘦老人，戴单片眼镜，墙上挂满贴标签的琥珀，柜台上一杆小秤 | 血 24，技能「抵押」2 费：抽 1 张牌；卡组偏控制：coin silence counterspell stillness polymorph discovery wisdom ambush icebarrier guard oracle cleric scribe |
| mirrorlegion | 倒影军团 | 6–7 | 黑玉面甲的另一边士兵，袖章上是镜像图案，排成一列；肃穆的黑色镜面大厅 | 血 44，技能「列阵」2 费：召唤 1 个曙光新兵；二阶段召唤 2 具骸骨并全体 +1/+1。卡组：squire acolyte vowguard dawnrider archer dagger assassin spark wisp mirrormage ambush counterspell muster rally archbishop |

出图（每位 1 张立绘 3:4 + 1 张 T 姿势参考图 3:2；加上第一批八位新对手的 T 姿势参考图）：
- 立绘用通用头尾（上面第一节）+ 形象栏；参考风格图 `assets/portraits/whistle.png`。
- T 姿势参考图沿用 `assets/portraits/tpose/` 里已跑通的提示词（`provenance.json` 里可查）：全身、双手空空张开、正面、纯灰底、3:2。
- 早醒者是兽类：用 `tools/beast_prep.cjs` 的流程（参考 lampbeast），不用 Mixamo 骨架。
- 新首页标志（游戏名《琥珀战记》）与娜希拉的放大镜道具参考图（1:1）也在这一批。
