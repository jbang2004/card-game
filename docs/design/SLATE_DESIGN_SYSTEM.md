# 磨砂青岩设计系统 / slate

2026-09-13 立项，2026-09-14 成为**唯一**表现层。本页是全站「磨砂青岩」风格的唯一设计依据：令牌、材质、组件语言、布局模板、各页面简报与子代理工作规则。参考来源为用户提供的卡牌游戏「阵容」页截图（深蓝灰磨砂底、细斜纹、发丝分隔线、节点导航轨、中列清单、右侧预览、药丸按钮、粗黑体标题）。

用户决策（2026-09-13）：完成后设为默认皮肤；主页 / 地图 / 战场保留场景原画，只重做 UI 层；手机布局纳入第二阶段。2026-09-14 旧的星海银蓝主题连同 `?skin=` 开关一并删除：`src/presentation/theme.js` 无条件写入 `html[data-skin="slate"]`，该属性是皮肤选择器的命名空间，不再是切换点。

## 0. 参考元素到本项目的映射

| 参考元素 | 本项目实现 |
| --- | --- |
| 深蓝灰磨砂底 + 左上柔光 + 细斜纹 | `--slate-material`：三层径向渐变 + `repeating-linear-gradient(45deg)` 7px 斜纹 + 160° 线性渐变，纯 CSS，无位图 |
| 左上「‹ 阵容」 | 关闭按钮改为 44px 返回箭头（CSS 描边），标题 32px 粗黑体 |
| 左侧节点导航轨（发光圆点 + 空心小点 + 竖线） | 设置页 `.settings-nav` 与手册 `.help-toc` 的真实分页按钮成为节点，选中项显示图标与蓝色发光 |
| 中列条目（标题行 / 分隔线 / 缩略图 / 药丸按钮） | 英雄页 `.hero-option` 为 grid：名称 + 英文副标题一行、发丝线、72×96 圆角缩略图、技能说明、「选择英雄 / 已选择」药丸 |
| 右侧「预览 \| 蓝色副标」+ 大卡 + 说明 | 英雄页 `.scene-showcase` 为 300×430 圆角预览卡，`.hero-profile-heading` 为「英雄预览 \| 英雄名」；技能、出发准备、套牌、模式、构成、契约按发丝线分节 |
| 「新手 \| 进阶」文字分页 | 图鉴页类型筛选（全部 / 随从 / 法术 / 武器），竖线分隔 + 白色下划亮条 |
| 圆形小徽章 | 图鉴页费用筛选 36px 圆形芯片，选中为蓝色 |
| 深色药丸按钮 / 主按钮 | `.ghost-btn` 深色药丸、`.gold-btn` 蓝色药丸，取代原有位图按钮皮肤 |
| 开关 | 设置页 `.toggle` 为 104×40 滑动开关 |

所有文字、数值、选择状态与按钮动作仍是原有 DOM 与动作接口，未新增假按钮；「全部英雄 / 英雄预览 / 牌组预览 / 牌组思路」等为纯装饰标签。字体使用系统黑体栈（PingFang SC 等），不提交字体文件；Windows 上回退到微软雅黑，字重观感会有差异。

## 1. 设计原则

1. **一种材质，两种外壳。** 所有 UI 面板只用 `--slate-material`（磨砂深蓝灰 + 左上柔光 + 45° 细斜纹）。全屏功能页用「页面壳」（满屏、无边框、左上返回箭头）；叠在场景或战场上的用「浮层壳」（圆角 16、细边、深投影、右上圆形关闭）。
2. **发丝线分节，不套框。** 内容分组靠 1px `--slate-line` 分隔线与粗黑体节标题，不再使用四角 SVG、玻璃底、双层框。只有可点选的实体（卡片、缩略图、模式卡）才有圆角描边容器。
3. **药丸即按钮。** 主操作为蓝色药丸，次操作为深色药丸，禁用为灰字细边；不再使用位图按钮皮肤、切角、冰晶纹理。
4. **节点即导航。** 竖向导航轨：2px 竖线 + 56px 发光节点（选中）/ 16px 空心点（未选中）+ 25px 粗体标签。水平分页用文字 + 竖线分隔 + 白色下划亮条。
5. **原画只在卡片里或作为场景底。** 主页、地图、战场、契约保留场景原画；功能页里的原画一律装进圆角描边卡片（英雄预览卡、缩略图、遗物卡）。
6. **游戏语义不动。** 卡牌牌面、费用/攻击/生命徽章、法力晶体、契约菱形槽、目标线等游戏语义组件保持现有 SVG/DOM，只调整其容器与周边文字。规则、存档、动作接口一律不改。
7. **实时 DOM。** 所有文字、数值、状态继续是 DOM；装饰标签（如「英雄预览」「牌组预览」）可用伪元素，但不制造假按钮。

## 2. 令牌

全部定义在 `src/presentation/skins/slate/base.css` 的 `html[data-skin="slate"]` 块，页面文件不得重定义：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--slate-font` | PingFang SC / Hiragino Sans GB / Source Han Sans / Noto Sans SC / Microsoft YaHei / system-ui | 全部文字，标题 700，正文 400/500 |
| `--slate-ink` `--slate-ink-2` `--slate-ink-3` | #f3f6fa / #c3ccd8 / #8e99a9 | 主文字 / 次文字 / 弱文字 |
| `--slate-blue` `--slate-blue-deep` | #8cc4ff / #2f72d6 | 强调文字、选中描边 / 主按钮、选中填充 |
| `--slate-line` `--slate-line-strong` | #ffffff26 / #ffffff40 | 发丝线 / 竖线分隔、浮层边 |
| `--slate-line-art` | #ffffff59 | 场景原画（T5）上的发丝线，`--slate-line` 压在画面上会看不见 |
| `--slate-pill` `--slate-pill-line` | #121824b3 / #ffffff2e | 深色药丸底 / 边 |
| `--slate-card-line` `--slate-card-base` | #d6dfe9aa / #0f141d | 卡片描边 / 卡片底 |
| `--slate-material` | 三层径向渐变 + 45° 斜纹 + 160° 线性渐变 | 页面壳与浮层壳底 |
| `--slate-page-x` `--slate-rail` `--slate-list` `--slate-col-gap` `--slate-card-w/h` `--slate-thumb-w/h` | 48 / 200 / 400 / 40 / 300×430 / 72×96 px；`max-width:1500px` 时 36 / 150 / 330 / 28 / 240×344 | 页面壳几何 |
| `--covenant-col` | `clamp(400px, 42vw, 600px)` | 契约页右栏列宽。分页轨与面板在不同子树里，必须共用同一条列边，所以不能挂在其中任何一个上（2026-09-14 由 contracts.css 上收） |
| `--slate-hud-hit` | `max(44px, calc(44px / var(--scale, 1)))` | 战场 HUD 的最小命中区。`#battle` 是被 `--scale` 缩放的 1600×940 逻辑画布，按逻辑 px 写的控件会随窗口缩小；本令牌把它还原成 44 个真实设备 px。**必须声明在 `#app` 上而不是根元素**：自定义属性里的 `var()` 在「持有该声明的元素」上求值，而 `mobile-view.js` 是把 `--scale` 作为内联样式写在 `#app` 上的；写在 `html` 上会永远取 fallback 1，塌成固定 44px（2026-09-14 由 battle.css 上收） |

新增页面若需要新令牌（例如战场 HUD 的半透明底 `--slate-hud`），在最终报告中提出，由协调者并入 base.css；页面文件里先用字面值并加 `/* token candidate */` 注释。

## 3. 组件语言

| 组件 | 规格 | 已有实现参考 |
| --- | --- | --- |
| 页面标题 | 返回箭头 44px（CSS 描边 chevron，左 36 上 26）+ 标题 32px/700/字距 3px，标题左侧留 48px | base.css `.modal-close` / `.modal-heading h2` |
| 节标题 | 20–26px/700 白字，下方 12px 发丝线；可带「\| 蓝色副标」 | heroes.css `.hero-profile-heading` |
| 文字分页 | 20px，未选 ink-3，选中白色 700 + 3px 白色下划亮条（发光），项间 1px 竖线 | library.css `.filter-type-group` |
| 圆形芯片 | 36px 圆，深色药丸底；选中蓝底白字 | library.css `.filter-btn.mana` |
| 导航轨 | 2px 竖线 left 27px；选中节点 56px 径向蓝光圆 + 图标；未选 16px 空心点；标签 25px/700 | settings.css `.settings-nav` |
| 主药丸 / 次药丸 | 高 48–52，圆角 999，主：`linear-gradient(180deg,#4a8be6,#2c66c4)` 边 #8cc4ff99；次：`--slate-pill` 底 + 边；文字 18px/500–600 | base.css `.gold-btn` `.ghost-btn` |
| 小药丸 | 高 30–38，13–16px | base.css `.library-inspect`、heroes 「选择英雄」 |
| 开关 | 104×40 药丸，圆形滑块；开启蓝底白字 | settings.css `.toggle` |
| 滑杆 | 现有轨道，浅蓝进度，白色圆形滑块 | settings.css `.audio-level` |
| 下拉 / 输入 | 高 44，圆角 999，药丸底与边，16px | base.css `select.library-search` |
| 卡片容器 | 圆角 8–12，1.5px `--slate-card-line`，底 `--slate-card-base`，投影 `0 8px 20px #0007`；内侧 6px 处 1px #ffffff2a 细内框（大卡） | heroes.css `.scene-showcase` |
| 缩略图 | 72×96（列表）/ 56×56（身份）/ 96×128（预览列表），圆角 8，1.5px 描边，`object-fit: cover` | heroes.css `.hero-option img` |
| 模式卡 / 可选块 | 圆角 10，1px `--slate-line-strong`，底 #0f141d99；选中：边 `--slate-blue` + `inset 0 0 0 1px` + 外发光 #8cc4ff33 + 底 #16243a | heroes.css `.hero-mode-cards button` |
| 列表行 | 高 40，圆角 8，深色底 + 右侧半透明卡图，左侧 28px 圆形费用 | library.css `.deck-row` |
| 进度条 | 轨道 6px #ffffff1f 圆角，进度 `--slate-blue-deep`→`--slate-blue` | 新增（契约页） |
| 徽章芯片 | 高 28，圆角 999，药丸底，14px，`b` 白色 | heroes.css `.comp-counts span` |
| 浮层壳 | 圆角 16，边 `--slate-line-strong`，投影 `0 30px 80px #000a`，内边距 28/32，宿主暗幕 #0b0f16b8；关闭为右上 40px 圆 | base.css（重构后） |
| HUD 芯片（战场） | 高 36–44 药丸，底 #0f141dcc，边 #ffffff2e，图标 + 数字；重要节点（技能）用 56px 发光圆 | 战场任务新增 |
| 提示 / Toast | 深色药丸，最大宽 520，16px，居中 | 战场任务新增 |

状态：hover 底变亮 (#1b2434d9) 边 `--slate-line-strong`；pressed `transform: scale(.98)`；focus-visible 2px `--slate-blue` 外描边；disabled 文字 ink-3、边 #ffffff1a；遵循 `prefers-reduced-motion` 与游戏「减少动态效果」设置（不新增动画，仅 0.15–0.2s 过渡）。

## 4. 布局模板

- **T1 轨 + 清单 + 预览**（参考图原型）：`[导航轨 200][清单 400][预览 1fr]`；预览列顶部节标题「X 预览 | 名称」，其下预览卡 + 分节。用于英雄选择；地图右栏、契约右栏采用其「预览列」部分。
- **T2 轨 + 内容**：`[导航轨 260][内容 1fr]`，内容列节标题 + 发丝线行。用于设置、旅人手册。
- **T3 分页 + 网格 + 侧栏**：标题行（返回 + 标题 + 搜索药丸）→ 文字分页 / 芯片 → 卡片网格 `auto-fill minmax(186px,1fr)` → 右侧 380px 发丝线分节侧栏。用于万象秘典。
- **T4 浮层对话**：浮层壳内：标题（26px/700，右上关闭）→ 正文 / 卡片区 → 发丝线 → 底部药丸（右对齐；确认类左取消右主）。用于确认、详情、发现、菜单、记录、手牌总览、结算。
- **T5 场景页 + 磨砂 UI 层**：场景原画全屏为底；UI 元素全部换成组件语言（药丸、芯片、圆角卡片、发丝线、文字分页），面板用浮层壳。用于主页、地图、战场、契约。
- **T6 全宽流程页**：页面壳；标题行 → 横排选项卡片（3 张）→ 发丝线 → 底部状态 + 主药丸。用于起手换牌（浮层壳版）、遗物奖励（页面壳版）。

## 5. 页面简报

每份简报：入口 / DOM 归属 / 模板 / 布局 / 保留与替换 / 验收尺寸。子代理先读该页档案（`docs/design/reference-pages/*.md`）确认真实入口与既往批注，再读源码核对类名。

### 5.1 主页 home（T5）— `src/template.html` `#lobby` 区、`src/presentation/home.js`、`src/presentation/components.css` 中 `.lobby-*` `.home-*` 规则
- 顶栏：品牌改为文字字标（「烬域」20px/700 + `EMBERFALL` 10px 字距 3px），三个导航改为文字分页（`.nav-link.active::after` 下划亮条；旧的移动光带已删除），右侧图标按钮改为 36px 圆形药丸。
- 标题区：保留 `homeLogo` 位图 Logo；「灰烬酒馆」28px/700，标语 18px ink-2，存档状态 15px ink-3。
- 主按钮：位图皮 `.home-action-skin` 已删除；`#start-btn` 为主药丸 320×64（左图标槽 + 文字 22px + 右箭头），`#quick-btn` 为次药丸 300×56。两者共用同一列与对齐轴（沿用主页档案批注结论）。
- 收藏区：「我的收藏」改为节标题 + 发丝线；三张卡保留高低错位与倾角，容器改圆角 10 + 1.5px 描边 + 投影，标题字改黑体；箭头改 44px 圆形药丸。间距沿用 ≥12px 实测要求。
- 页脚：黑体，顶部发丝线；寄语文字改黑体 ink-2。
- 场景：保留 Canvas 场景与昼夜切换；左侧文字可读性靠既有 `--home-veil`，可微调为更中性的深蓝灰。
- 验收：1672×941、1280×720、1440×900；`tests/e2e/home-reference.spec.cjs` 的几何断言（间距、箭头居中）仍应成立，若断言依赖旧材质请在报告中列出。

### 5.2 冒险地图 map（T5 + T1 预览列）— `src/presentation/adventure-map.js`（`.adventure-atlas`），`dialogSize` = `route`（页面壳）
- 保留地图原画与路径线。标题行改为返回箭头 + 「冒险地图」；「远征图志 · 06 境」为 ink-3 小字；左下品牌字标改文字。
- 关卡节点：统一为导航轨节点语言：当前可打 = 56px 蓝光节点；已通关 = 56px 实心节点带勾；未解锁 = 44px 空心点 + 锁图标；编号与名称黑体，名称 20px/700 带阴影。
- 右栏（380px）：改为磨砂材质列（不透明度略高于浮层，保证文字可读），发丝线分节：首领卡（圆角 12 描边卡，原画 cover）→ 名称 28px/700 + 地区副标 → 引言 15px ink-2 → 属性芯片（生命、技能）→「旅途遗物」节 → 底部主药丸「准备出发」。移除四角 SVG。
- 验收：1672×941、1280×720；点击不同节点右栏内容切换；`map-detail.spec.cjs` 相关断言。

### 5.3 诸神契约 contracts（T5 + T1 预览列）— `src/application/contracts.js`（`.covenant-box` `.covenant-heading` `.covenant-portrait`），`dialogSize` = `covenant`（页面壳）
- 左侧神祇原画保留；底部三张契约缩略图改圆角 10 描边卡，选中蓝边 + 发光。
- 右栏：「我方契约 | 敌方契约」改文字分页（下划亮条），面板去框，改发丝线分节：名称 26px/700 + 元信息 14px ink-3 → 效果说明 15px → 三行进度（标签 / 6px 进度条 / 数值 20px/700 蓝色）→ 需求说明 → 主药丸「唤醒 …」（不可用时禁用态）。
- 战斗中打开时同样规则；敌方分页只读。
- 验收：1672×941、1280×720；`contracts.spec.cjs`、`pantheon.spec.cjs` 相关断言。

### 5.4 桌面战场 battle（T5）— `src/template.html` `#battle` 区、`src/presentation/battle.css`（布局）、`components.css` 中战场材质、`src/presentation/polish-battle.css`
- 场景原画、随从牌面、手牌、徽章、法力晶体、目标线、动画全部保留。
- 顶栏：字标文字化；图标按钮 36px 圆药丸；回合文字放入居中深色芯片。
- 英雄：头像改圆角 10 描边卡（尺寸不变），名牌改深色药丸；攻血徽章保留。敌方契约进度 `◆ 0/5` 改为芯片。
- 右侧：技能按钮改 56px 发光节点（与导航轨选中节点同语言）+ 名称/费用芯片；「诸神契约」按钮改为深色药丸芯片；牌库计数改药丸（图标 + 数字 + 说明）。
- 「战斗记录」「首领情报」入口改深色药丸芯片；两块侧栏面板改浮层壳（圆角 12，发丝线分节，去四角）。
- 结束回合：主药丸 160×56，下方快捷键 12px ink-3；法力面板：标签黑体，晶体保留。
- 手牌标签、`#combat-preview` `#action-status` `#hint` `#toast` `#touch-target-bar`：深色药丸提示条，同一时刻只显示一种（沿用规范）；`#board-empty` 黑体 ink-3。
- 验收：1672×941、1280×720 的完整对局截图（含选牌、瞄准、战斗记录展开、首领情报展开）；`game.spec.cjs`、`action-feedback.spec.cjs`、`ui-alignment.spec.cjs` 中与材质无关的断言应保持通过。

### 5.5 过场与对话 dialogs（T4 / T6）— `src/application/screens/campaign.js`（`.rewards-box` `.relic-choice` `.campaign-refit`、`.result-box` `.result-stats`、发现 `.discover-options` `.discover-card`），`src/application/screens/heroes.js`（`.mulligan-box`），`src/ui.js`（`.confirm-box`），`src/enhancements.js`（卡牌详情 `.card-detail-layout` `.card-detail-copy`），`src/mobile-ui.js`（`.tactical-sheet` `.touch-menu-grid` `.touch-hand-grid` `.touch-hero-info`，桌面下也可打开的菜单/记录/手牌总览），`src/atelier-ui.js`（`.atelier-box` 画廊）
- 起手换牌 `mulligan`：浮层壳 1060；标题「命运的第一手」26px/700 + 副标；三张牌保留；「保留 / 替换」改药丸（替换 = 蓝底）；发丝线；主药丸；提示 15px ink-2。
- 遗物奖励 `choice`：改用页面壳（在 dialogs.css 内覆盖 `[data-dialog-size="choice"]`）；标题行 → 三张遗物卡（圆角 14 描边卡，遗物图 + 名称 22px/700 + 说明 15px + 「选择此遗物」小药丸；选中蓝边发光）→「酒馆整备」折叠区改发丝线分节 → 左下状态文字，右下主药丸「继续冒险」。
- 胜利结算 `result` 与失败：浮层壳；徽记保留；标题 44px/700；三项统计并排，中间竖线分隔，数字 40px/700；发丝线；底部次 + 主药丸。
- 卡牌详情 `detail`：浮层壳 740；标题行；左卡右信息（名称 26px/700，效果 15px，发丝线行：职业稀有度 / 已加入 / 牌组）；底部次 + 主药丸。
- 发现 `discover`：浮层壳 820；标题 + 副标；三张牌，选中蓝色发光。
- 确认 `confirm`：浮层壳 480；标题 22px/700，正文 15px ink-2，底部取消（次）+ 确认（主）。
- 菜单 / 记录 / 手牌总览 / 英雄信息 / 画廊：浮层壳；列表改发丝线行；按钮改药丸；画廊场景块改圆角描边卡。
- 验收：每种对话至少一张 1672×941 截图，结算与失败通过 `?debug=1` 的 `EmberDebug` 夹具或现有 e2e 夹具打开（参考 `tests/e2e/remaining-reference.spec.cjs`、`dialog-detail.spec.cjs`）；`dialog-layout.spec.cjs`、`dialog-sizing.spec.cjs` 相关断言。

### 5.6 旅人手册 guide（T2）— `src/application/screens/preferences.js` `showHelp`（`.help-box` `.help-toc` `.help-section` `.help-*`），`dialogSize` = `help`（页面壳）
- 标题行返回箭头 + 「旅人手册」；副标 ink-3。
- 左侧 `.help-toc` 四个章节按钮改导航轨（同设置页），选中蓝光节点。
- 内容列：章节标题 26px/700 + 发丝线；「回合流程」「卡牌说明」「关键词速查」三个 `.crafted-panel` 改为圆角 12 磨砂内容卡（底 #0f141d80，1px 线，无四角）或发丝线分节，二选一并全页一致；图标放 56px 圆角方块；关键词表改发丝线行。
- 底部主药丸「返回游戏」固定右下，不遮内容（当前遮挡卡牌说明，需修）。
- 验收：1672×941、1280×720；四个章节各一张截图。

### 5.7 手机横竖屏 mobile（第二阶段）— `src/mobile.css` `src/presentation/polish-mobile.css` `src/mobile-ui.js` `src/mobile-view.js`
- 桌面各页合并后进行。`body.touch-layout` 下启用同一套令牌：顶栏字标与图标药丸、英雄头像圆角卡、技能节点、结束回合主药丸、手牌标签芯片、触控目标条药丸、战术底板（`.tactical-sheet`）改浮层壳、触控菜单 / 记录 / 手牌总览改发丝线行。
- 保留滑动、点牌确认、长按、旋转后同局状态；至少 44px 命中区与安全区。
- 验收：390×844 竖屏、844×390 横屏、568×320 短横屏；`mobile-layout.spec.cjs`、`mobile-dialog-fit.spec.cjs`、`mobile-craft.spec.cjs`。

## 6. 子代理工作规则

1. 在独立 worktree 上工作（基于 main 最新提交）；只修改分配给你的文件：你的页面 CSS 文件（`src/presentation/skins/slate/<page>.css`）、该页归属的 JS/模板区域（仅限为皮肤增加类名或极少量结构调整，不改行为）、该页档案 `docs/design/reference-pages/<page>.md` 的「当前实现」小节、你的输出目录 `output/slate-<page>-20260913/`。
2. 不修改 `base.css`、`config/build.json`、`src/template.html` 的 `@layer` 区、其他页面文件。需要共享改动时写入最终报告的「需要协调者合并的共享改动」。
3. 皮肤规则一律以 `html[data-skin="slate"] body:not(.touch-layout)` 开头（手机任务用 `body.touch-layout`）；不用 `!important`；不新增位图；不改变规则层、存档格式与卡牌映射。
4. 每次修改后 `python3 build.py`；用分配的端口 `python3 -m http.server <port> --bind 127.0.0.1` 在后台服务；Playwright 从 `/Users/yijun/codebase/card-game/node_modules/playwright` 以绝对路径 require，Chrome 为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`；页面就绪条件 `window.Emberfall && !AtelierWorld.loading`（120 s 超时），截图前解码 `#modal img`。
5. 验收：按简报尺寸截图，覆盖 hover/选中/禁用与真实交互；与改动前的同页截图逐像素比对（Canvas 场景、随机手牌与卡图解码之外应为零差）。`node --test tests/*.test.cjs` 必须通过；简报点名的 e2e 规格运行一次，记录通过/失败与原因。
6. 完成后在 worktree 分支提交（信息前缀 `feat(slate): …`，结尾 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`），不推送。最终报告固定包含：worktree 路径与分支、提交哈希、改动文件、截图目录、测试结果、与简报的偏差及原因、需要协调者合并的共享改动、已知差异。
7. **皮肤层无条件胜出，隐藏要重说一遍。** `skin` 排在 `components` 之后，层级先于选择器权重结算：组件层里任何「必须保持隐藏」的 `display: none`，只要皮肤规则命中同一元素、或被某条裸后代选择器扫到，就会被皮肤的 `display` 覆盖而复活。命中这类元素时在皮肤规则里重新声明 `display: none`。
8. **不要用裸 `span` / `svg` 后代选择器。** 裸选择器会连同任何脚本注入的辅助节点一起命中，并且因为皮肤层排在最后，会盖掉组件层对那些节点的 `display: none`。真实事故：`heroes.css` 的 `.hero-mode-cards span { display: block }` 复活了 base.css 已经隐藏的 `.selection-light` 光带（2026-09-14 随光带一起删除）。一律带类名限定（如 `.help-section > svg`、`.atlas-number svg`）。
9. **药丸按钮上的 `::before` 必须自带 `display`。** base.css 对 `:is(.gold-btn, .ghost-btn, .text-btn, .library-inspect)::before / ::after` 统一写了 `content: none; display: none`，页面规则若要在 `.ghost-btn` / `.gold-btn` 上另建 `::before`（导航节点、指示点等），除 `content` 外还要声明 `display`；`components.css` 同时给这两个伪元素留了 `opacity: .14`，需要一并重置为 `1`，否则节点会发暗（手册导航轨曾因此只剩微光）。
10. **战斗中弹窗的桌面验收尺寸下限是 1360×700。** `src/mobile-view.js` 会把宽 < 1360 或高 < 700 的战场视图切到 `body.touch-layout`，桌面皮肤规则随即失效。因此涉及对局内弹窗的桌面验收只取 1360×700 及以上，窄桌面统一用 1440×900。
11. **场景页的文字字标由页面自己拥有。** 旧主题给十三种弹窗统一注入 `.reference-page-brand` 再由 base.css 隐藏；现在只有地图页需要字标，由 `adventure-map.js` 注入 `.atlas-wordmark`，`map.css` 负责桌面定位并在触控下隐藏。新页面需要字标时照此在自己的文件里实现，不要恢复统一注入。
12. **把材质规则从 `body:not(.touch-layout)` 提升到 `body` 会掉一级权重。** 合并桌面与触控的重复声明时，去掉布局守卫等于少了一个类，选择器权重随之下降一级；皮肤层内部按 BASE → HOME → … → MOBILE 排序，于是**排在后面的皮肤文件会因此反超**原本输不掉的规则。典型例子：`dialogs.css` 的页脚规则本来打不过地图页脚，把地图那条提升到 `body` 之后就被 `dialogs.css` 盖住了。提升前先确认没有更靠后的文件命中同一元素；确实需要保留归属时，用对话框根（`.folio-dialog`，或 `[data-dialog-size="…"]`、`[data-type="…"]`）把选择器限定回去，把丢掉的那一级补上。base.css 里那些「刻意打平」的权重结对（`.crafted-panel` 中和 vs 页面壳）也按同一条规则理解：同文件内整体降级不影响相对关系，跨文件才会出问题。

## 7. 协调者验收清单

- 合并后重新构建，全页面截图走查：材质一致、字体一致、按钮语言一致、无残留四角 / 玻璃 / 位图按钮。
- 交互抽查：主页三个导航、开始冒险全流程（英雄 → 换牌 → 战斗 → 记录/情报 → 结束回合 → 结算 → 奖励 → 地图）、图鉴筛选与保存、设置分页与开关、手册章节、契约唤醒。
- 唯一表现层（2026-09-14 完成）：`theme.js` 无条件写入 `data-skin="slate"`，`?skin=` 开关、旧主题的位图按钮皮、页面背景板、四角装饰与光带全部删除；`AGENTS.md` 与 `REFERENCE_UI_STANDARD.md` 已同步。
- 回归：`npm run test:release`；对依赖旧材质的断言逐条决定更新或保留。
- 手机第二阶段后再做一次全量走查。
