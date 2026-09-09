# 界面美学与排版全面修复 · 2026-09-09

## 背景与根因

在 v0.14 构建上对 1600×940 / 1280×800 / 1024×768 / 390×844 / 844×390 / 320×568 六档视口做了截图与几何测量，发现九类可复现问题。根因集中在三点：

1. 手机手牌把规则文字当作装饰：`max-height: 23% + overflow: hidden` 直接裁掉文字，且文字区域没有为攻血宝珠预留空间。
2. 桌面是固定 1600×940 舞台等比缩放（`EmberViewport` 的 `--scale`），导致非 16:9 窗口出现信箱黑边，7–9px 微标签在小窗口被二次缩小。
3. 弹窗尺寸按"任务档位"固定分配，内容撑不满时留白集中在一侧；英雄选择右栏尤其明显。

## 修改清单

### 卡面排版（P0-1 / P0-2 / P0-3）

- `src/presentation/components.css`
  - `.card-text` 改为有界阅读区：`top` + `bottom` 双边界 + `display: -webkit-box` + `-webkit-line-clamp: var(--rule-lines)` + `overflow: hidden`，长文案以省略号收尾，不再静默丢行。
  - 随从/武器卡 `.card-text` 底部预留 17%（`bottom`），法术卡预留 9%，文字不再压到攻血宝珠或类型行。
  - 触屏手牌卡面重排为 48% 立绘 / 10.5% 名牌 / 19% 规则 / 19% 宝珠；`--rule-lines: 2`。
  - 极短屏分档降字号：横屏 ≤379px 用 8px/1.15，竖屏 ≤719px 用 9px/1.3、≤599px 用 8.5px/1.2，保证两行完整显示。
- `src/mobile-view.js`
  - 横屏手牌高度 132→152、竖屏分档 154/142/126，手牌卡宽改为按可用高度推导（横屏 96–124px，竖屏 98/112px），手牌区继续横向滚动，不再固定 88px。
  - 手牌标签行高度 25→44，让 44px 的"展开"按钮完全落在标签行内，不再压进手牌。

### 弹窗信息密度（P1-1 / P1-2 / P1-3）

- `src/ui.js`：英雄选择右栏新增"英雄档案"（称号、英文副题、定位描述、技能名/费用/效果）与"牌组构成"（随从/法术/武器数量 + 0–7+ 法力曲线），随套牌切换实时更新。
- `src/presentation/components.css`：新增 `.hero-dossier` / `.hero-power-line` / `.hero-composition` / `.comp-curve` 样式。
- `src/presentation/dialog-layout.css`
  - 新增 `route` 档（1120×760），地图不再套用 1180×850 工作区，底部空白从约 185px 收到约 100px。
  - `data-compact` 下英雄头像由 `display: none` 改为 44px 圆角方图，选中勾缩到 20px 贴在头像角上，矮屏也保留角色辨识度。
  - `.help-section` 恢复 `break-inside: avoid`，手册 01/02/03 不再被拆成"右栏无标题续块"。
- `src/presentation/dialog-layout.js`：`map: "route"`。

### 全局观感与可读性（P2-1 / P2-2 / P2-3）

- `src/presentation/components.css`
  - `#viewport` 信箱区由纯深色改为暖棕径向渐变，16:10 / 4:3 窗口的黑边变成有意为之的"桌面留白"。
  - 分路标签 7px/0.65 → 9px 实色 `#4f3619`；空场引导 13px/0.65 → 14px `#5b3f1f` + 亮描边；牌库说明、法力说明、英雄说明、手牌提示、回合快捷键、英雄侧标统一提到 9–10px 并提高对比度。
- `src/refinement.css`：`.hand-tip` 受 legacy 层 `!important` 锁定，直接在该处把 9px/`#647c71` 改为 10px/`#9fb8ac`。

## 验证

- 构建：`python3 build.py` 成功（单文件 + dist）。
- 规则/应用/素材：`node --test tests/*.test.cjs` 116/116 通过。
- 美术：`node --test tests/art/*.test.cjs` 6/6 通过。
- 浏览器：`npx playwright test` 最终一轮 143 通过 / 3 失败。三个失败项（`audio-feedback` 音画同拍、`mobile-layout` 667×375 与 844×390 英雄文案）均单独复跑通过；本轮用 `git stash` 在未改动的基线上复现了 `uiux` 长文案用例的同类间歇失败，确认属于既有时间敏感用例在满载下的抖动，不是本次布局改动的确定性回归。修复期间新暴露的确定性回归（宝珠两位数包含 320/568×320、十张满手牌 320、landscape 牌组配置、`.ritual-stones` 可见性）已全部修复并通过。
- 证据截图与几何报告：`artifacts/aesthetic-review/`（本地忽略提交），脚本 `tools/aesthetic-shot.cjs`、`tools/aesthetic-audit.cjs`。

## 边界

- 浏览器回归为 Chromium 桌面与触控模拟，未做实体手机、Safari、真实刘海安全区验收。
- 320×568 等极短屏为保证战场与两行规则同时可用，规则字号降到 8.5px，属于该尺寸的取舍。
- 未发布公开站点。
