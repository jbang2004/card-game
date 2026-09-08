# 烬域 · 鎏金酒馆 v0.13.0 · 月影神契

可离线运行的单人策略卡牌游戏：62 张可组牌卡、8 张普通衍生牌、3 张契约牌、4 位英雄、8 套职业预设、6 场首领战役与公平练习对战。桌面与手机使用同一 Canvas 酒馆场景，手机保留独立横竖屏布局与触屏操作。

## 开发与运行

```bash
python3 build.py
node --test tests/*.test.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

访问 **http://127.0.0.1:8000/dist/**。`dist/` 是图片和脚本分离的网页版本；根目录 `index.html` 是同源构建的离线单文件版本。修改源码后重新构建。

构建只需要 Python 标准库，单元测试只需要 Node 内置模块。完整浏览器回归使用项目声明的 Playwright：

```bash
npm ci
npm run test:release
```

默认使用本机 Chrome，也可通过 `CHROMIUM_PATH` 指定浏览器。测试模式只在 `localhost` / `127.0.0.1` 且带 `?debug=1` 时开放 `EmberDebug.game`；正常页面的 `Emberfall.game` 只有只读快照和查询接口。

## 修改卡牌

- **卡牌定义：** `src/content/cards.js`。具名字段、参数化 `onPlay` / `onDeath`，规则文字自动生成。
- **英雄、首领、遗物：** `src/content/campaign.js`。技能、阶段、遗物效果共用效果注册表。
- **新效果类型：** `src/rules/effects.js`。必须定义字段校验、执行与规则文字；AI 在 `rules/ai.js`，确定性预览在 `rules/preview.js`。
- **职业与构筑规则：** `src/content/campaign.js` 的 `classes` / `tribes` / `deckRules`；英雄用 `classId` 关联职业，用 `defaultDeckId` 引用预设。统一校验在 `src/rules/decks.js`。
- **命名卡组：** `src/application/decks.js` 管理多套命名卡组，只接受当前命名卡组格式，开局与战役整备使用独立拷贝。
- **组牌界面：** `src/application/library.js`。过滤器、草稿牌组和编辑逻辑独立于战斗状态。
- **单张插画替换：** `tools/pack_card_assets.py --card ID --image /path/image.png --source-note '来源说明'`，然后构建。见 [素材说明](docs/ASSETS.md)。

例如把曙光祭司治疗量从 4 改为 5，只改它的 `onPlay` 中 `amount`，文字和实际效果同步。未知效果、拼错字段、失效引用会在内容加载或单元测试时明确失败。

## 音画反馈优化

卡牌飞行与落桌音、按接触时刻对齐的攻击和反击、分层轻重撞击、护甲与圣盾反馈、死亡与胜负音色，以及可分别调整的音效/氛围音量。12 段本地 CC0 音效同样支持单文件离线运行。实现与验收见 [音画反馈记录](docs/AUDIO_FEEDBACK.md)。

刀剑、利爪、重击、弓箭、投矛、能量弹和吐息具有不同攻击语言；陨火、火焰风暴、冰封领域、暗影湮灭与四张传说牌具有具名演出。13 张本地 CC0 无损 WebP 纹理/动画图集与事件结算同步，演武场可切换 14 种预览。详见 [战斗特效记录](docs/VFX_FEEDBACK.md) 与 [资源清理记录](docs/MEDIA_CLEANUP.md)。

## v0.13 月影神契

新增送魂人·莫菈、八张可组牌卡与「月影神契」「契兽群猎」两套预设；第六关为断契监誓者。契约栏独立于三十张主牌组，最多三张、至多一位神祇，同职业英雄共享契约池。

非衍生随从的死亡积累不同名称的灵魂印记，唤醒契兽或冥月神需要法力、印记和累计阵亡门槛。每张契约每局一次，神祇不能复生且降临当回合不能攻击英雄。对手可以通过公开契约栏提前判断威胁；寂静封印提供中立沉默反制。

十一张独立原画、六个分层角色与月蚀降临演出已接入桌面和手机，并已统一为原游戏动漫画风。详见 [设计与素材记录](docs/design/MOON_COVENANT.md)、[平衡与验收](docs/QA_MOON_COVENANT.md)。自动筛查命令：`node tools/playtest-contracts.cjs`。测试期对局及命名卡组升为 version 3，旧测试记录失效。

## v0.12.1 界面改造

统一胡桃木面板与古金边框，修复遗物、地图、手册的跨主题文字对比问题；六张独立遗物图标、选择后确认、可折叠整备、收藏长规则排版与固定操作区。详细测试见 [UI/UX 审计记录](docs/UIUX_AUDIT.md)。

## v0.12 玩法升级

- 职业与中立牌构筑；六套可直接使用和调整的预设，附打法说明。
- 施法、死亡、圣盾破裂、回合结束和攻击后触发；野兽定向抽牌、三种奥秘、武器反制。
- AI 搜索回合行动顺序，覆盖多牌斩杀、交换、发现和职业技能；模拟不读取隐藏牌或未来抽牌。
- 练习对战随机先后手、双方三十血、无遗物和首领觉醒，不覆盖战役存档。
- 战役胜利后可更换一张牌；遗物增加构筑联动；首关重新调整难度。
- 测试期只接受当前 version 3 对局与命名卡组。旧测试存档失效，旧数组卡组可在收藏中重建；所有对局使用当前职业规则，不维护旧玩法分支。

自动玩法筛查：`node tools/playtest-balance.cjs` 和 `node tools/playtest-campaign.cjs`。结果为策略程序模拟，不代表真人胜率。最终验收见 [v0.12 验证记录](docs/QA_V12.md)。

## 本次架构升级

统一效果定义与执行、抽离 AI / 预览 / 存档边界、提供动作分派和因果事件块、记录增益来源与期限、收紧外部状态访问。已删除旧 Three.js 预览、旧程序化插画、旧世界转接和未使用的旧素材缓存，不再保留替代运行路径。

保留原 56 张已确认卡图，新增六张独立法术插画；存储仍使用原四个键，但键名不代表支持旧存档格式。现有 CSS 层级仍为 `legacy → layout → theme → components`，其中基础布局规则仍被当前 UI 使用，不因历史命名删除有效样式。

详细说明见 [架构](docs/ARCHITECTURE.md)、[卡牌修改指南](docs/CARD_AUTHORING.md) 和 [v0.11 验证记录](docs/QA_V11.md)。`CODEX_HANDOFF.md`、旧 QA、`HANDOFF_*` 是历史输入记录，不再作为当前源码必须保持不变的要求。

公开试玩：https://emberfall-gilded-tavern.jbang2004.chatgpt.site 。没有账号、云存档或 PVP。浏览器回归属于 Chromium 桌面和触控模拟，不代表实体手机或其他浏览器验收。

## 角色制作

统一清单为 `assets/characters.json`；制作与接入见 [角色制作规范](docs/CHARACTER_AUTHORING.md)。41 个上场随从（含 7 个普通衍生角色及 3 个契约角色）均有分层待机，4 位英雄和 6 位首领按既有 portraitId 复用。其余 32 张法术/武器保持静态。运行 `python3 tools/characters.py --list` 查看完整静态/动态清单；`tools/animation-demo.html?zoom=1` 可分页查看所有角色。其他模型可直接读取项目内 [角色制作 Skill](.agents/skills/character-creation/SKILL.md)。
