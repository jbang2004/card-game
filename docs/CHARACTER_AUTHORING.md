# 角色制作与游戏接入

本文是当前规范。旧动画更新记录用于理解历史，不作为接口定义。

> 2026-09-18：分层立绘动画（`EmberPortraits`、`assets/motion/`、`src/motion-assets.js`）已整体移除，角色只有静态插画。本文只描述静态插画的登记与接入；历史的图层、rig、打包器章节不再适用，移除说明见 [ASSETS.md](ASSETS.md#角色静态插画登记)。

## 唯一编辑入口

`assets/characters.json` 的 `cards` 覆盖所有游戏卡牌，包括法术、武器与衍生牌。以 `python3 tools/characters.py --list` 的输出确认全部登记项。角色名、玩法与类型仍来自 `src/content/cards.js`，美术来源和静态文件哈希仍由 `assets/anime/manifest.json` 管理。

每项只有两个字段：

```json
{"staticKey":"wolf","focus":20}
```

- `staticKey` 必须等于该项 ID，不允许用别人的插画补缺。
- `focus` 为纵向裁切焦点百分比 0–100；手牌/场上裁切规则共用 `AtelierArt`。

`assets/characters.json` 的 ID 集合必须与 `assets/anime/manifest.json` 完全相等，多一个少一个都构建失败。

## 制作与接入顺序

1. 从当前清单选定用户要求的 ID，核对原图、卡名、卡牌类型和英雄/首领的 `portraitId`。只增加插画不修改规则。新玩法角色须另按 `CARD_AUTHORING.md` 注册规则和静态素材，不能只插一张图片就声称可玩。
2. 生成或替换 `assets/anime/` 下的运行 WebP，并在 `assets/anime/manifest.json` 登记来源与哈希。原画、提示词与 provenance 留在对应的 `*-sources/` 目录。
3. 在 `assets/characters.json` 为该 ID 填写 `staticKey` 与 `focus`。
4. 执行 `python3 build.py`；仅 Python 标准库。构建自动验证清单并生成 `src/character-catalog.js`，它不是手工编辑入口。
5. 执行 `python3 tools/characters.py --check`，再用 `python3 tools/characters.py --list` 输出全部 ID、中文名与焦点。不要只交付本次新增 ID 而漏掉既有清单。
6. 单测 `node --test tests/*.test.cjs`。插画或绑定结构大改运行 `npm run test:release`。只用项目声明的 Playwright 与已有 Chromium。
7. 截图核对：手牌、场上、卡牌详情、图鉴与结算页的插画取景正确，冻结/圣盾/嘲讽等状态表现不被插画遮挡。检查桌面、手机横/竖屏及满场。

需要 HTTP 时从仓库根目录运行 `python3 -m http.server 8000 --bind 127.0.0.1`，游戏位于 `/dist/?debug=1`。`tools/animation-demo.html` 逐项演示攻击、冻结、变形、死亡、吸血与抽牌的战斗演出。

## 表现绑定

UI 根据只读表现快照在 img 上写 `data-art-key`（素材 ID），供调试与端到端定位使用。攻击、出牌和死亡的整体位移由战斗表现编排控制（`src/presentation/combat.js` + `src/effects.js`），不混入规则或持久存档。卡面插画本身没有任何逐帧绘制或独立时钟。

## 验收交付

交付完整机器可读清单（上述 --list 输出）、变更 ID、素材与提示词位置、构建/测试结果、实际看过的截图。映射检查通过不能代替美术验收。角色制作 skill 位于 `.agents/skills/character-creation/SKILL.md`，其他模型可以直接读取使用，不依赖本会话记忆。
