# 烬域 · 鎏金酒馆 v0.9

本轮采用完整酒馆桌面原画、胡桃木与古金 UI，修复生命与费用数值越界。视觉改造和验收见 [v0.9 记录](docs/QA_V09.md)。

本地可玩的单人策略卡牌游戏。保留 56 张已确认卡图、三位英雄、五关战役与 v1 存档，完成开发结构整理、战场遮挡修复及真实来源浏览器回归。

```bash
python3 build.py
python3 -m http.server 8000 --bind 127.0.0.1
```

访问 **http://127.0.0.1:8000/dist/**，点击「战斗试玩」或「开启冒险」。`dist/` 是拆分图片和脚本的网页版本；根目录 `index.html` 是包含全部资源的离线单文件版本。修改源码后重新构建并刷新浏览器。

```bash
npm ci
npm test
npm run test:e2e
```

端到端测试优先使用本机 Chrome；其他环境可设置 `CHROMIUM_PATH`，或安装 Playwright Chromium。原 Python 浏览器回归需激活 `.venv` 后运行 `python tests/run_release_checks.py`。

本次变化、模块职责和验证边界见 [开发结构](docs/ARCHITECTURE.md) 与 [本轮验收](docs/QA_V08.md)。原始交接说明、素材来源与基线哈希仍在 `docs/` 和 `HANDOFF_*` 中。默认手绘 Canvas 场景完全独立运行；`?renderer=three` 仅供开发者预览继承的 Three.js 场景。

---

以下为导入 v0.7 时的历史说明，测试状态以本轮验收为准。

> **源码交接包说明（2026-09-06）：** 本包针对继续开发整理，不包含依赖包或已构建的 `index.html`。解压后先运行 `python3 build.py`，即可在本目录生成与 v0.7.0 交付版一致的游戏。正常构建不需要 `npm install` 或 `pip install`。首次接手请看 `AGENTS.md`、`docs/CODEX_HANDOFF.md` 和 `docs/ASSETS.md`。

# 烬域 · 风起之境

**EMBERFALL — WIND BORNE · v0.7.0**

在 v0.6 动漫秘境可玩项目上完成的环境与 UI 重构。原有 56 张动漫卡图、卡池、规则、AI 与手机横竖屏交互保留；四角建筑、远景、棋盘表面、卡框、牌背、英雄框、按钮、收藏与各类面板统一为温暖的手绘幻想 / 纸木旅行手帐风格。

## 开始游戏

用现代浏览器打开 `index.html`，或单文件 `Emberfall_Windborne.html`。界面、美术、玩法和 Canvas 战斗效果都已内置。首页“战斗试玩”立即进入第六回合；“开启冒险”进入英雄选择和正式五关战役。试玩不覆盖正式冒险。

手机以实际 CSS 像素布局，竖屏和横屏能继续同一局。点手牌先阅读详情，再确认出牌；左右滑动手牌，长按场上角色查看信息。桌面保留点击、悬停和拖牌。这里是静态可运行交付包，不代表已经更新任何公网网站。

某些文件管理器只预览 HTML、不执行脚本。可在本目录启动静态服务：

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

电脑访问 `http://localhost:8000`。手机连接同一可信局域网，访问电脑 IP 的 8000 端口。不需要将端口开放到公网；分享后 Ctrl+C 关闭。

## 视觉重构

四角采用用户确认的第二张环境概念图中的独立绘画图层：旅人的酒馆（屋檐小猫、铜灯、木窗）、星辉观测台（观星旅人、黄铜星环）、蓝晶矿脉（矿工、矿洞与晶簇）、余烬锻炉（铁匠、炉火与铁砧）。背景增加清晰的远方天际、安静的庭院铺石，棋盘中央保持干净。

UI 改为米色纸张、哑光木边、青绿色主操作、暖黄回合按钮和柔和蓝色法力标记。卡牌保留原画，移除旧版亮金属 / 紫色雕框叠层，采用纸质名牌和统一轮廓。费用、规则、攻血全部为实时 DOM，不从示意图复制固定数值。收藏、英雄选择、换牌、发现、地图、遗物、设置、胜负、手机菜单与卡牌详情都采用相同材质和层级。

桌面可以点四角建筑取得环境声音和光效反馈，不能消耗法力或影响胜负。手机保留紧凑布局，建筑不覆盖操作区；“漫游四境”可从首页或菜单查看实际使用的建筑图版。

## 晴昼与暮色

桌面右上角“晴昼 / 暮色”切换环境光。手机在设置中使用“山谷时光”。它只改变背景氛围和灯光，不改变牌组、随机数、攻击力或战斗状态。设置单独存于 `emberfall.world.v1`，不覆盖原战役存档。

少量落叶、观星环光线与炉火光点只在非减弱动态模式运行。开启减弱动态后保留静态画面与必要的战斗结果。场景底图按布局、主题与昼夜状态缓存，动画不移动实际角色或命中框。

## 素材来源与边界

**这轮是确认概念图的资产化和 UI 重构，不是重新生成四幅高清单体建筑原画。** 建筑由 `assets/references/world/approved-village.png` 按蒙版提取；天际来自没有游戏数值的顶部区域；棋盘、纹理和叶片徽章为代码制作的界面 / 表面资产。费用、手牌、英雄和结束回合按钮没有被带入背景。来源、坐标和校验见 `assets/windborne/manifest.json`。

新增 9 个运行时图版：4 张建筑、天际、纸纹、木纹、透明棋盘及叶片徽章。原来的 56 张动漫卡图保持字节不变；原英雄 / 首领继续复用相应卡图。建筑为分层绘画，**不是可任意旋转查看的完整三维模型**。

手机使用内嵌 Canvas 绘画环境与战斗特效。桌面保留已有可选 Three.js r160 分支；没有替换或验收新的三维建筑。网络或 WebGL 不可用时完整 2D 路径仍可运行。测试与截图使用 Canvas 路径，不应称为已验收的 GPU 3D 画面。

## 玩法与存档

`src/engine.js` 和 `src/data.js` 与 v0.6 字节一致。原有 48 张可组牌卡、8 张衍生牌、3 位英雄、5 位首领、6 种遗物与所有已实现的规则和 AI 保留。战役继续使用 version 1 格式与 `emberfall.v1`、`emberfall.deck.v1`、`emberfall.settings.v1`。

相同来源可恢复既有数据；更换文件路径、浏览器、设备或托管域名不保证共享进度。没有新增账号、云存档、PVP 或服务端防作弊。清理浏览器数据也会清除进度。

## 构建与维护

```bash
python3 build.py
node --test tests/engine.test.cjs
node --test tests/anime_assets.test.cjs
python3 tests/browser_windborne.py
```

重建本轮环境资产：

```bash
python3 -m pip install pillow numpy
python3 tools/build_world_assets.py
python3 build.py
```

浏览器测试需要 Python Playwright 和 Chromium。`tests/run_release_checks.py` 串联原桌面 / 手机回归及本轮集成检查。实际结果以 `VALIDATION.md` 与 `tests/windborne/` 为准。旧目录中的 v0.5/v0.6 文档、截图与结果仅作历史记录。

主要改动文件：

```text
src/world-assets.js             9 张内嵌环境 / 材质图版
src/atelier-world.js            桌面和手机共用的分层绘画场景与缓存
src/mobile-world.js             手机渲染适配器
src/windborne.css               统一的纸木手帐 UI 主题
src/windborne-ui.js             新世界文案、材质绑定与昼夜切换
src/atelier-ui.js               四境画廊
src/tavern-ui.js                环境热点位置同步
assets/windborne/               输出图片及来源清单
assets/references/world/        已确认的环境示意图
```

没有打包字体文件。UI 使用系统字体。浏览器检查是 Chromium 桌面与原生触控模拟，非实体 Android / iPhone 验收；真实来源下跨刷新持久化、Safari、真实软键盘、安全区与长期 GPU 性能仍需目标设备验收。
