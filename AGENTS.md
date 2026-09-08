# Emberfall / 风起之境 — 项目约定

## 先阅读

`README.md` → `docs/CODEX_HANDOFF.md` → `docs/ASSETS.md`。本项目是 v0.11.0 的既有可玩游戏，不需要从零另建框架。

## 最小启动与检查

```bash
python3 build.py
node --test tests/*.test.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

构建器只使用 Python 标准库；上述 Node 测试只用 Node 内置模块。不要为这些步骤安装没有声明用途的依赖。修改素材按 `requirements-art.txt` 配置；浏览器回归使用 package.json 声明的 Playwright。

## 修改边界

- 组件样式遵循 `legacy → layout → theme → components` 层级；新配色与卡图容器放在 `presentation/components.css`，手机规则不要另外定义主题颜色。
- 修改 `src/` 与素材源，然后构建；不要只改生成的 `index.html`。
- `config/build.json` / `src/template.html` 决定模块顺序。只有当前注册表中的实现进入运行；不能因历史文档提及就恢复已经退役的 Three.js、程序化插画或旧素材缓存。仍有引用的 `tavern-ui.js` / `atelier*` 承担当前 UI 和 Canvas 职责。
- 56 个卡牌 ID 必须各有新动漫插画；保持严格映射，不让缺图静默回退到旧程序化角色图。
- 按用户 2026-09-07 全面视觉重构要求，当前采用完整酒馆桌面、胡桃木与古金 UI（旧山谷原画仅留档）；卡名、费用、攻血和规则文字保持实时 DOM，不烘焙进画面。
- 手机端是专用横/竖屏布局，不退回到把 1600×940 桌面等比缩小；保留滑动、点牌确认、长按、旋转后的同局状态。
- `engine.js` 与 `rules/` 是纯规则层，AI 独立在 `rules/ai.js`；不要让画面粒子、昼夜切换、建筑互动改变对局状态。
- 用户于 2026-09-08 确认游戏仍在测试期、没有旧对局需要保留：只支持当前 version 2 对局和命名卡组，不恢复 v1、旧 ruleset、混合职业放行或旧数组迁移。存储键名仍沿用，但不承诺旧格式兼容。
- 不自动修改其他产品/站点，不在未确定目标项目和授权时部署，不提交密钥、依赖目录、浏览器二进制或字体文件。

## 验证与诚实说明

常规改动先构建并运行规则/素材单元测试；交互变更再跑相关 Playwright 脚本并检查截图。浏览器可通过 `CHROMIUM_PATH` 指定，未指定时寻找系统 Chromium，否则使用 Playwright 默认浏览器。

`VALIDATION.md` 与现有测试结果属于输入 v0.7.0 的历史验收记录；本次交接打包的复验见 `HANDOFF_CHECKS.json`。没有实体手机、真实 GPU 3D 或真实跨刷新存储测试时，不把模拟/内存适配器结果称为相应验收。桌面与手机只有 Canvas 路径，旧 Three.js 预览已经删除。现有公开站点为 https://emberfall-gilded-tavern.jbang2004.chatgpt.site ，Sites 项目绑定见 `.openai/hosting.json`；仅用户明确要求发布时更新。

## v0.11 内容与验证

- 卡牌只编辑 `src/content/cards.js` 的具名定义；战役编辑 `src/content/campaign.js`。不要恢复 `battle/effect/value/death` 字段或重复手写规则文案。
- 新效果注册字段校验、执行和文案，补充 AI / 必要预览；纯规则不依赖表现。
- 生产界面使用只读状态和动作接口；仅本地 `?debug=1` 暴露 `EmberDebug.game` 给测试。
- 当前完整入口为 `npm run test:release`；旧 Python 浏览器脚本已退役，旧 QA 仅作历史记录。
- 当前存档必须具备 modifiers；临时攻击仅从 modifiers 结算，不再维护 tempAtk。格式不支持或数据损坏时明确失效，不做隐式旧版本转换。
