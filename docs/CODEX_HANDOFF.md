# 风起之境 v0.7.0 · 开发交接

## 1. 交付内容与启动

这是对当前 v0.7.0 源码的开发用整理，不是玩法升级。所有 `src/` 文件和运行时素材均与输入源码保持字节一致。保留完整素材来源与重建脚本；没有下载或打包第三方依赖。

本包不含已构建 `index.html`，避免重复带一份约 8.8 MB 的单文件成品。解压进入项目根目录：

```bash
python3 build.py
node --test tests/engine.test.cjs tests/anime_assets.test.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8000`。Windows 可把 `python3` 改为 `py`；测试总入口会使用启动它的 Python 解释器。首页“战斗试玩”进入预设第六回合，不覆盖正式存档。不是 React / Next.js / Vite 项目，没有必须安装的 npm 运行时依赖；`package.json` 主要是现有脚本入口。

## 2. 目录与架构

| 位置 | 用途 |
| --- | --- |
| `src/data.js` | 48 张可组牌卡、8 张衍生牌、3 位英雄、5 个首领、6 个遗物与预设牌组 |
| `src/engine.js` | 纯规则、事件、AI、随机数与存档状态；可在 Node 中测试 |
| `src/ui.js` / `src/enhancements.js` | 对局流程、DOM 显示、输入、收藏/组牌、已知结果预览 |
| `src/effects.js` | 分阶段战斗演出、弹道、命中、死亡、动画清理与输入锁 |
| `src/atelier-art.js` / `src/anime-assets.js` | 严格卡牌图路由、焦点配置、56 张内嵌卡图 |
| `src/atelier-world.js` / `src/world-assets.js` | 当前分层山谷场景及9个新环境图版 |
| `src/windborne.css` / `src/windborne-ui.js` | 最终视觉主题、纸木 UI、晴昼/暮色及世界文案 |
| `src/mobile-view.js` / `src/mobile-ui.js` / `src/mobile.css` | 原生尺寸触屏布局、命中坐标、手牌滚动、详情、旋转 |
| `src/scene.js` | 可选 Three.js 棋盘与 Web Audio 合成声音 |
| `src/template.html` / `build.py` | 页面结构、脚本/CSS加载顺序、内嵌打包 |
| `assets/` / `tools/` | 原始素材表、独立图版、来源清单、图像加工脚本 |
| `tests/` | 规则/素材测试、浏览器回归与输入版验收记录 |
| `preview/` | 四张实际运行参考图：桌面战场/首页、手机横屏/竖屏 |

工程有历次迭代的分层样式；旧名字不等于无用。首次接手不要一边换框架一边改布局，先跑通基线。若后续整理模块或删除旧缓存，应独立做一次有回归测试的重构。

## 3. 依赖按任务安装

| 工作 | 所需环境 | 是否需要下载依赖 |
| --- | --- | --- |
| 构建HTML | Python 3 标准库 | 不需要 |
| 规则/素材单元测试 | Node.js，按项目清单为18或以上 | 不需要npm包 |
| 重建卡图/建筑 | Python、Node、Pillow、NumPy | 由开发环境按`requirements-art.txt`安装 |
| 浏览器回归 | Python Playwright + Chromium | 由开发环境按`requirements-test.txt`安装；浏览器另行准备 |
| 可选完全离线桌面3D | Three.js r160 UMD全局构建及许可证 | 未随包提供；普通Canvas玩法不需要 |

`requirements-art.txt` 原有 Pillow 锁定保留，并补齐环境图像脚本实际使用的 NumPy。`requirements-test.txt` 记录交接环境的 Playwright 版本。这些是文本清单，不是依赖包；不同平台的二进制兼容性由接手环境处理。

可选安装（按工作范围执行，不要求所有步骤都安装）：

```bash
python3 -m pip install -r requirements-art.txt
python3 -m pip install -r requirements-test.txt
python3 -m playwright install chromium
```

已有系统 Chromium 时可以用环境变量 `CHROMIUM_PATH` 指向它。不要把下载后的浏览器、`node_modules`、虚拟环境、轮子包或字体提交进项目。

## 4. 素材重建与校验

常规代码修改只需要 `python3 build.py`，不必重复加工图片。修改素材源后按相关管线重建：

```bash
python3 tools/build_anime_assets.py
python3 tools/prepare_anime_runtime.py
python3 tools/build_world_assets.py
python3 build.py
node --test tests/engine.test.cjs tests/anime_assets.test.cjs
```

前两个脚本负责卡牌裁切/内嵌及兼容卡框/遗物缓存；第三个负责新建筑与材质。`src/*assets.js` 等内嵌图片文本虽属于生成源，但被当前构建直接读取，已经保留，不是第三方依赖，也不能随临时缓存清掉。完整关系见`ASSETS.md`。

如需重新做总览图，可运行`python3 tools/art_contact_sheet.py`。它只用于美术审阅，非构建必需；可用`EMBERFALL_FONT`提供系统已安装的中文字体路径，不分发字体。辅助缩略图现在写入项目`assets/anime/`，不再依赖聊天容器路径。

## 5. 验证方法

```bash
python3 tests/browser_pocket.py
python3 tests/pocket_additional.py
python3 tests/browser_anime.py
python3 tests/browser_windborne.py
```

或构建后运行`python3 tests/run_release_checks.py`。这些既有脚本使用`set_content`和显式内存存储适配器，并中止外部加载以测试Canvas分支；不会证明公网部署、真实浏览器来源的跨刷新存档或实际GPU渲染已经正确。

本次打包复验：见`HANDOFF_CHECKS.json`。未再次执行整套浏览器回归；输入版67项浏览器检查及其限制仍见`VALIDATION.md`。

`tools/verify_handoff.py`可验证解压文件是否和交付清单一致；`--build`还会从本地源码重建并核对原始HTML哈希。这个校验针对“未修改的交接基线”；正常开发修改后不应继续要求它匹配旧哈希。

## 6. 已知边界

桌面可选Three.js引擎仍走CDN/可选vendor；手机采用Canvas。四座建筑是批准示意图的分层提取，不是可旋转的完整三维模型。56张卡图来自8张批准素材表的独立图块，不是56次独立高清生图；英雄和首领复用对应图版；6个非卡牌遗物图仍为继承资产。没有原版炉石美术/录音或字体文件。

保留存档键：`emberfall.v1`、`emberfall.deck.v1`、`emberfall.settings.v1`、`emberfall.world.v1`。没有云存档、账号、PVP、防作弊或服务端权威结算。实体Android/iPhone、Safari、真实来源存档、软键盘、安全区、发热耗电及长期平衡仍需验收。不要在未指定目标站点前部署。

## 7. 可直接作为接手任务的说明

> 这是已有的《烬域·风起之境》v0.7.0。先阅读AGENTS.md、README.md、docs/CODEX_HANDOFF.md和docs/ASSETS.md，检查依赖清单，仅安装当前任务所需依赖。先构建并运行规则/素材测试，再启动页面检查桌面、手机横竖屏。保留现有手绘山谷/纸木UI、56张卡图、纯规则引擎与version 1存档，不从零重做，不随意换框架。后续修改源码和素材源后重新构建，并报告实际通过的测试与未验证边界；没有目标站点时不要自行部署。
