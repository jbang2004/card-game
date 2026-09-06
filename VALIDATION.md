# v0.7.0 — 风起之境：执行记录与边界

## 测试对象

- HTML：`index.html`，8,844,233 字节。
- SHA-256：`bee5fec655a6f27007c6ec7d98427e5a02b5b3dea46eba38e763f40e2999f790`。
- 四组浏览器结果均记录并匹配这个交付文件的 SHA-256；不是混用旧版本测试结果。
- `src/engine.js`、`src/data.js` 和 `src/anime-assets.js` 与 v0.6 输入源码包逐字节相同。证据：`tests/windborne/unchanged-content.json`。

## 已通过的检查

| 组别 | 数量 | 结果记录 |
| --- | ---: | --- |
| 原规则测试（含 150 局随机完整对战不变量检查） | 35 | `tests/windborne/engine-release.log` |
| 动漫卡图单元检查 | 10 | `tests/windborne/card-assets-release.log` |
| 桌面与移动主回归 | 31 | `tests/pocket/browser-results.json`、`tests/windborne/pocket-final.log` |
| 武器、完整手牌、旋转、桌面拖牌补充回归 | 5 | `tests/pocket/additional-results.json` |
| 新卡图 / 衍生牌 / 完整原画集成回归 | 17 | `tests/anime/integration-results.json` |
| 本轮环境与 UI 集成 | 14 | `tests/windborne/integration.json` |

**合计 67 项浏览器检查，全部通过，没有 JavaScript 页面错误。** 所有 56 个卡牌 ID 保持新动漫图像映射；48 张收藏卡图覆盖新的插画开口。未声称覆盖所有可能的规则状态或长期平衡。

本轮 14 项检查验证：新环境解码、无外部图片 / 字体请求、晴昼与暮色只改变视觉、四角热点不影响对局、画廊、统一卡框和动态数值、真实指定法术和交换、手机收藏与卡图查看、横竖屏恢复，以及施法途中切换时光和减弱动态不遗留输入锁。

既有移动回归覆盖十种视口、十张手牌、每方七随从、原生触控滚动和长按、AI 回合及旋转时未完成展示提交。普通战役实际操作覆盖三个正常圣卫回合；其他边界使用受控局面触发真实规则事件。这不等于真人完整战役通关。

## 构建可复现

重新运行 `tools/build_world_assets.py` 和 `build.py` 后，环境缓存、来源清单、最终 HTML 的 SHA-256 均与运行测试的版本一致。证据：`tests/windborne/rebuild.json`。源码发布包解压后的常规构建校验见 `tests/windborne/archive-build.json`。

截图由 `tests/preview_windborne.py` 生成，来自实际运行的游戏。`preview/` 是精简 JPEG，完整 PNG 可通过测试脚本重新生成；本轮截图脚本无页面异常，见 `tests/windborne/preview-errors.json`。

## 素材与功能范围

新增 9 个运行时图版：四座建筑、天际、纸纹、木纹、棋盘和叶片徽章。建筑是已批准环境示意图的蒙版提取，不是这轮独立生成的四幅高清原画；卡图完全保留。UI、即时数值、可点击单位与战斗效果都是真实组件，不是将概念图当作不可交互整屏背景。

## 明确未验收的部分

测试为 Chromium 桌面与原生触控模拟，不是实体 Android、iPhone 或 Safari。运行画面与截图为 Canvas / 2D，不作为真实 Three.js GPU 验收证据。建筑是分层绘画，不是完整三维网格。

浏览器使用 `set_content` 与明确的内存 localStorage 适配器；恢复流程已检查，但没有验证真实来源下跨刷新持久化。未验收软键盘、真实刘海安全区、长期发热耗电或硬件帧率。

没有执行公网部署，也没有修改 WaveShift 网站。静态发布包待上传到用户指定托管目标。没有新增账号、云存档、PVP、防作弊或服务端结算。

历史 `tests/pocket/` 和 `tests/anime/` 的检查程序在本版重新执行，结果中的 HTML 哈希为准；旧日志 / 文档不额外计入本版数量。
