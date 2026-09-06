# Emberfall / 风起之境 — 项目约定

## 先阅读

`README.md` → `docs/CODEX_HANDOFF.md` → `docs/ASSETS.md`。本项目是 v0.7.0 的既有可玩游戏，不需要从零另建框架。

## 最小启动与检查

```bash
python3 build.py
node --test tests/engine.test.cjs tests/anime_assets.test.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

构建器只使用 Python 标准库；上述 Node 测试只用 Node 内置模块。不要为这些步骤安装没有声明用途的依赖。修改素材和运行浏览器测试才按 `requirements-art.txt` / `requirements-test.txt` 配置环境。

## 修改边界

- 修改 `src/` 与素材源，然后构建；不要只改生成的 `index.html`。
- `src/template.html` / `build.py` 决定模块顺序；历史名称的 `tavern*`、`atelier*` 文件仍有构建引用，不能因名字旧就删除。
- 56 个卡牌 ID 必须各有新动漫插画；保持严格映射，不让缺图静默回退到旧程序化角色图。
- 按用户 2026-09-07 全面视觉重构要求，当前采用完整酒馆桌面、胡桃木与古金 UI（旧山谷原画仅留档）；卡名、费用、攻血和规则文字保持实时 DOM，不烘焙进画面。
- 手机端是专用横/竖屏布局，不退回到把 1600×940 桌面等比缩小；保留滑动、点牌确认、长按、旋转后的同局状态。
- `engine.js` 是纯规则与 AI 层；不要让画面粒子、昼夜切换、建筑互动改变对局状态。
- 保留 version 1 存档及现有四个 localStorage 键。需要升级格式时先设计迁移。
- 不自动修改其他产品/站点，不在未确定目标项目和授权时部署，不提交密钥、依赖目录、浏览器二进制或字体文件。

## 验证与诚实说明

常规改动先构建并运行规则/素材单元测试；交互变更再跑相关 Playwright 脚本并检查截图。浏览器可通过 `CHROMIUM_PATH` 指定，未指定时寻找系统 Chromium，否则使用 Playwright 默认浏览器。

`VALIDATION.md` 与现有测试结果属于输入 v0.7.0 的历史验收记录；本次交接打包的复验见 `HANDOFF_CHECKS.json`。没有实体手机、真实 GPU 3D 或真实跨刷新存储测试时，不把模拟/内存适配器结果称为相应验收。桌面 Three.js 可选，手机主路径为 Canvas。当前没有已确认的公网部署。
