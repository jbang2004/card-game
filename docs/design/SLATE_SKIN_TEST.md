# 磨砂青岩皮肤 / slate — 从测试到默认

**2026-09-14：本皮肤已成为默认视觉。** 不带查询参数时 `src/presentation/theme.js` 直接写入 `html[data-skin="slate"]`，全部页面（主页、英雄选择、万象秘典、旅途设置、冒险地图、诸神契约、桌面战场、全部弹窗、旅人手册）以及 `body.touch-layout` 的手机横竖屏布局都由 `src/presentation/skins/slate/` 提供。设计依据见 [SLATE_DESIGN_SYSTEM.md](SLATE_DESIGN_SYSTEM.md)。

2026-09-13。依据用户提供的参考截图（某卡牌游戏「阵容」页：深蓝灰磨砂面板、细斜纹、发丝分隔线、左侧节点导航轨、中列清单、右侧预览、药丸按钮）评估能否用同一套材质与布局重置本游戏页面。结论：**材质可以纯 CSS 复现，列表 / 预览分栏与导航轨在现有 DOM 上可以复现**；当时已在三个真实页面上实装为可切换的测试皮肤，未改动现有银蓝主题。

## 开启方式

默认即为本皮肤，无需任何参数。

- `?skin=silverblue` —— 切回旧的星海银蓝主题（`data-skin` 保持未设置，皮肤层全部规则不命中），用于对照与历史回看；`?skin=off` 等价。
- `?skin=slate` —— 显式指定，与不带参数完全相同。
- `?skin=<其他值>` —— 原样写入 `html[data-skin]`，留给后续皮肤实验。

开关仍在 `src/presentation/theme.js`，用正则读 `globalThis.location?.search`（`tests/theme-presentation.test.cjs` 在 Node vm 里跑这个文件，不能依赖 `URLSearchParams` 或真实 `location`）。

## 落点

> 以下自「落点」到文末为立项当天（2026-09-13）的评估记录，保留作为历史；分工与覆盖范围的现状以 [SLATE_DESIGN_SYSTEM.md](SLATE_DESIGN_SYSTEM.md) 为准。当时留空的 `{home,map,contracts,battle,dialogs,guide,mobile}.css` 已全部实装，`body:not(.touch-layout)` 的限制也已解除：base.css 同时提供桌面与触控两套外壳。

皮肤按「共享底座 + 每页一文件」拆分，便于多人并行重置各页面。全部规则只在 `html[data-skin="slate"] body:not(.touch-layout)` 下生效。

| 文件 | 作用 |
| --- | --- |
| `src/presentation/skins/slate/base.css` | 共享底座：`--slate-*` 令牌（材质与几何）、两套外壳、通用控件（药丸按钮、表单、关闭按钮、`.crafted-panel` 中和、装饰隐藏）、`max-width: 1500px` 令牌覆盖 |
| `src/presentation/skins/slate/heroes.css` | 英雄选择页专属规则 |
| `src/presentation/skins/slate/library.css` | 万象秘典页专属规则 |
| `src/presentation/skins/slate/settings.css` | 旅途设置页专属规则 |
| `src/presentation/skins/slate/{home,map,contracts,battle,dialogs,guide,mobile}.css` | 空占位，各由对应页面的重置任务认领 |
| `src/template.html` | 级联层顺序 `legacy, layout, theme, components, skin`；`@layer skin` 内按 BASE → HOME → HEROES → LIBRARY → MAP → CONTRACTS → BATTLE → DIALOGS → SETTINGS → GUIDE → MOBILE 排列 |
| `config/build.json` | 注册 `SKIN_SLATE_BASE` 等 11 个令牌 |
| `src/presentation/theme.js` | 三行查询参数开关（接受任意值，`?skin=silverblue` 无副作用） |

两套外壳按 `dialog-layout.js` 写入的 `[data-dialog-size]` 区分，不再按 `[data-type]` 枚举：

- **整页外壳**（`heroes` / `library` / `settings` / `route` / `covenant` / `help`）：宿主去内边距、对话框 100%×100% 铺满、磨砂材质、无边框圆角阴影、左上返回箭头与标题行。
- **浮层外壳**（`confirm` / `detail` / `hand` / `menu` / `journal` / `discover` / `mulligan` / `choice` / `result` / `atelier` / `workspace`）：宿主保留居中并加暗底，对话框为 16px 圆角磨砂面板（发丝描边 + 投影），宽度仍由 `dialog-layout.css` 的 `--dialog-width` 决定，关闭按钮保持右上圆形「×」。

通用控件与排版规则作用于**全部**弹窗类型；页面文件只追加自己的选择器，不重新定义令牌。

皮肤放在 `components` 之后的独立级联层，因此不需要和现有 6700 行组件规则比拼选择器权重，也没有修改任何既有声明。这是**评估用的临时层**：若采用，应按 AGENTS.md 的约定把颜色/材质令牌并入 `components.css`，几何并入各页面布局模块，然后删除本层。

## 参考元素到本项目的映射

| 参考元素 | 本项目实现 |
| --- | --- |
| 深蓝灰磨砂底 + 左上柔光 + 细斜纹 | `--slate-material`：三层径向渐变 + `repeating-linear-gradient(45deg)` 7px 斜纹 + 160° 线性渐变，纯 CSS，无位图 |
| 左上「‹ 阵容」 | 关闭按钮改为 44px 返回箭头（CSS 描边），标题 32px 粗黑体 |
| 左侧节点导航轨（发光圆点 + 空心小点 + 竖线） | 英雄页：`.hero-roster-heading` 作为唯一节点；设置页：`.settings-nav` 三个真实分页按钮成为节点，选中项显示图标与蓝色发光 |
| 中列条目（标题行 / 分隔线 / 缩略图 / 药丸按钮） | 英雄页 `.hero-option` 改为 grid：名称 + 英文副标题一行、发丝线、72×96 圆角缩略图、技能说明、「选择英雄 / 已选择」药丸 |
| 右侧「预览 \| 蓝色副标」+ 大卡 + 说明 | 英雄页：`.scene-showcase` 从全屏背景改为 300×430 圆角预览卡；`.hero-profile-heading` 变为「英雄预览 \| 英雄名」标题；技能、出发准备、套牌、模式、构成、契约按发丝线分节 |
| 「新手 \| 进阶」文字分页 | 图鉴页类型筛选（全部 / 随从 / 法术 / 武器），竖线分隔 + 白色下划亮条 |
| 圆形小徽章 | 图鉴页费用筛选改为 36px 圆形芯片，选中为蓝色 |
| 深色药丸按钮 / 主按钮 | `.ghost-btn` 深色药丸，`.gold-btn` 蓝色药丸；替换原有冰晶 / 深蓝纹理位图皮肤 |
| 开关 | 设置页 `.toggle` 改为 104×40 滑动开关 |

所有文字、数值、选择状态、按钮动作仍是原有 DOM 与动作接口，未新增假按钮；「游戏模式」标题沿用页面已有伪元素，「全部英雄 / 英雄预览 / 牌组预览 / 牌组思路」为纯装饰标签。

## 覆盖与限制

- 覆盖：英雄选择、旅途设置、万象秘典三页，桌面 1672×941 与 1280×720 已截图验证；`max-width: 1500px` 断点缩小导航轨、清单和预览卡。
- 未覆盖：主页、地图、战斗、契约、弹窗和全部手机布局（`body.touch-layout` 下皮肤不生效）。低于 1100px 宽的桌面窗口未调整。
- 若采用，需要少量 DOM 配合才能更贴近参考：预览卡底部的英雄名铭牌（当前 `.scene-showcase` 没有名称数据）、图鉴页导航轨的真实节点、英雄页中列的真实分页。
- 字体使用系统黑体栈（PingFang SC 等），不提交字体文件；Windows 上会回退到微软雅黑，字重观感会有差异。

## 验证

- `python3 build.py`；`node --test tests/*.test.cjs` 127 通过。
- 截图、交互与对照见 [output/slate-skin-test-20260913/](../../output/slate-skin-test-20260913/README.md)。未运行完整 Playwright 回归；皮肤不带参数时不生效，原有回归不受影响。
- 未发布公开站点。
