---
name: character-creation
description: 为烬域 Emberfall / card-game 项目制作或修复角色静态插画，维护完整角色清单与裁切焦点，并接入现有游戏完成验收。适用于单卡、批量角色和角色制作规范任务。
---

# 角色制作

在既有 Emberfall 项目内完成角色静态插画、清单与游戏接入。2026-09-18 起卡面与英雄头像只有静态插画，不重建游戏、不引入动画渲染框架。

## 找到当前契约

以用户提供的仓库为目标。先读仓库 `AGENTS.md`、`README.md`、`docs/ASSETS.md`，再读 **`docs/CHARACTER_AUTHORING.md`**，它是字段、命令、模板和绑定的维护入口。若当前仓库不是此项目，不把示例路径当成授权去改另一产品。

当前完整目录在 `assets/characters.json`；静态图片来源仍在 `assets/anime/manifest.json`。先运行：

```bash
python3 tools/characters.py --check
python3 tools/characters.py --list
```

若缓存过期，先核对差异，再运行 `python3 tools/characters.py`。清单验证失败要修复具体字段或素材，不删除校验绕过。每项只有 `staticKey` 与 `focus`，ID 集合必须与 `assets/anime/manifest.json` 完全相等。

## 按请求制作

- **修改已有角色**：使用其准确 ID。保留既有静态原画，除非用户要求替换。只调整插画与裁切焦点，不修改玩法。
- **批量制作**：先生成全量清单，标出本次范围，逐卡记录实际状态。先完成一个同类型代表角色的完整接入，再复用流程；不要复制另一个角色的裁切数值充数。
- **新增可玩角色**：除美术流程外，遵循仓库 `docs/CARD_AUTHORING.md`，同步内容定义、规则文本、必要效果/AI/预览与静态素材清单。仅在本次用户授权包含新玩法时做这些修改。
- **只整理规范或逻辑**：不因此自动生成新图或重画既有角色。

制作插画前读 [references/art-review.md](references/art-review.md)。有可用 imagegen 技能/图像工具时按该工具流程使用本角色原图作为参考；若环境没有图像生成能力，先完成目录、接入和现有素材可做的工作，明确缺失素材，不能用代码占位图冒充最终角色。来源和提示词随素材留档，项目产物不能只存在工具临时输出目录。

## 接入与验证

唯一手工配置源是 `assets/characters.json`。`src/character-catalog.js` 为生成输出，不直接编辑。字段说明、素材路径规则和命令均见仓库 `docs/CHARACTER_AUTHORING.md`。

```bash
python3 build.py
python3 tools/characters.py --check
node --test tests/*.test.cjs
npx playwright test tests/e2e/combat-motion.spec.cjs
```

结构或玩法大改改用完整 `npm run test:release`。浏览器使用项目已声明的 Playwright；构建/校验只需 Python 标准库。不要安装 Three.js、视频播放器或额外渲染依赖。

UI 只在 img 上写 `data-art-key`（素材 ID）。卡名、费用、攻击、生命和规则保持 DOM；美术改动不得写规则状态或更改 v1 存档及四个存储键。

交付前完成 `art-review.md` 的实际视觉检查。自动测试通过只能证明其覆盖的行为。缺少真实手机、Safari 或耗电测量时如实说明，不为格式齐全而填写“已验收”。

## 交付结果

使用 `python3 tools/characters.py --list` 导出完整清单；说明本次改动 ID、素材及提示词位置、如何在游戏查看、通过的检查和实际限制。不要把“登记完成”说成“插画制作完成”。未经另行要求不部署、不提交远端、不清理仍有用途的静态原图。
