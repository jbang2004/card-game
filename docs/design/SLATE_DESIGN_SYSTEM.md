# 磨砂青岩设计系统 / slate

2026-09-13 立项，2026-09-14 成为**唯一**表现层。本页是全站「磨砂青岩」风格的唯一设计依据：令牌、材质、组件语言、布局模板、各页面简报与子代理工作规则。参考来源为用户提供的卡牌游戏「阵容」页截图（深蓝灰磨砂底、细斜纹、发丝分隔线、节点导航轨、中列清单、右侧预览、药丸按钮、粗黑体标题）。

用户决策（2026-09-13）：完成后设为默认皮肤；主页 / 地图 / 战场保留场景原画，只重做 UI 层；手机布局纳入第二阶段。2026-09-14 旧的星海银蓝主题连同 `?skin=` 开关一并删除：`src/presentation/theme.js` 无条件写入 `html[data-skin="slate"]`，该属性是皮肤选择器的命名空间，不再是切换点。

## 0. 参考元素到本项目的映射

| 参考元素 | 本项目实现 |
| --- | --- |
| 深蓝灰磨砂底 + 左上柔光 + 细斜纹 | 2026-09-22 起改为**液态玻璃**：`--glass-fill` 透色 + `--glass-blur` 背景模糊 + `--glass-rim` 折射内高光，斜纹与描边一并删除；页面壳背后铺模糊后的 `--scene-backdrop` 夜景原画。旧 `--slate-material` 只剩别名 |
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

1. **一块玻璃，两种外壳（2026-09-22 起）。** 所有 UI 面板都是液态玻璃：`--glass-fill` 透色 + `--glass-blur` 背景模糊 + `--glass-rim` 折射内高光（顶亮、底暗、5% 轮廓），不画边框、不用斜纹。全屏功能页用「页面壳」：面板本体透明，宿主 `::before` 铺模糊 30px 的 `--scene-backdrop` 夜景原画并盖一层左深右浅的暗幕（左 65% → 中 40% → 右 50%），左上返回箭头；叠在场景或战场上的用「浮层壳」：圆角 24、无边、blur 28 + 饱和 160%、`--glass-rim` + 柔投影，宿主暗幕 55%，右上圆形关闭。不支持 backdrop-filter 或系统「减少透明度」时，`@supports` / `prefers-reduced-transparency` 把玻璃退化为近不透明着色。
   - **哪些页面全屏。** 只有内容真正铺满的页面才用页面壳：英雄、图鉴、地图、契约。设置与旅人手册在**所有布局**都是浮层壳（桌面 920 / 1240 宽；触屏 640 / 900 宽、16px 内边距、44px 圆形关闭、22px 标题），高度贴内容、最多占满视口后内部滚动，背后是清晰的场景加 55% 暗幕。遗物奖励桌面用 1080 宽浮层壳，触屏仍是页面壳（三张遗物卡要铺满手机）。`tests/e2e/responsive-component-style.spec.cjs` 的 `FLOATING_SIZES` / `DESKTOP_FLOATING_SIZES` 与 `dialog-sizing.spec.cjs` 记录这一约定。
   - **舞台壳（第三种壳）。** 起手换牌、发现、卡牌详情表、手牌总览是「看卡」的页面：对话框本体完全透明、无边无影，宿主铺 65% 暗幕 + 18px 背景模糊（触屏 10px），卡牌、一行居中标题（带投影）和操作药丸直接落在模糊的战场上。英雄信息表共用 `detail` 尺寸但是数据面板，保留浮层壳。图鉴的卡片舞台（`EmberCardStage`）本来就是这个语言。起手换牌的三张牌是**静止**的：不挂浮雕、不倾斜、不上浮（2026-09-22，`heroes.js` 不再 `attend` 它们）。神祇舞台的卡在桌面按视口高度放大到最多 480 宽（`contracts.js stageCardWidth`），hover 同一张卡不再重建右侧仪式面板。
2. **留白分组，不画线。** 内容分组靠 24–32px 留白与粗黑体节标题；需要块感的分组放进比外层浅一档的**子玻璃块** `--glass-fill-2`（圆角 16–20，顶部 1px 内高光，内边距 20/22）；列表行靠行距与 hover / 选中的圆角填充区分；标题行、页脚、文字分页、栏与栏之间一律不再画 1px 发丝线。全站保留的线只有两类：导航轨的 2px 竖线（导航语义）与手册示意图的连线（图示语义）。可点选实体（卡片、缩略图、模式卡）仍有轮廓，但用内高光和 `--glass-fill-2` 底而非描边；选中态仍是蓝色描边 + 发光。
3. **药丸即按钮。** 主操作为蓝色药丸，次操作为深色药丸，禁用为灰字细边；不再使用位图按钮皮肤、切角、冰晶纹理。
4. **节点即导航。** 竖向导航轨：2px 竖线 + 56px 发光节点（选中）/ 16px 空心点（未选中）+ 25px 粗体标签。水平分页用文字 + 竖线分隔 + 白色下划亮条。
5. **原画只在卡片里或作为场景底。** 主页、地图、战场、契约保留场景原画；功能页里的原画一律装进圆角描边卡片（英雄预览卡、缩略图、遗物卡）。
6. **游戏语义在皮肤层里，牌面已解冻（2026-09-14 起）。** 法力晶体、契约菱形槽、目标线等语义组件仍保持现有 SVG/DOM，只调整容器与周边文字；规则、存档、动作接口一律不改。但**卡牌牌面本身不再冻结**：`src/presentation/skins/slate/card-face.css` 是牌面唯一定义（皮肤层最后一个文件），旧的「半包围铭牌」与 `badgeFrame` 徽章已从牌面删除。新牌面为——
   - **无外框满幅原画**：`.card` 自身不绘制任何东西，`.card-inner` 满幅承载原画与下半深色面板，圆角即卡的边界（`.card` 自身的圆角用百分比，因为 `cqw` 在容器元素自身上会按视口解析）。
   - **阵营名牌**：卡名是一枚骑在原画与面板交界上的胶囊，描边色由阵营 `--accent` 决定；关键词也用同一 `--accent` 上色并带 16×16 遮罩图标。
   - **稀有度金属底带**：卡底一条抛光金属条，刻「类型 · 职业」，金属配色由 common/rare/epic/legendary 决定（传说另加一圈暖光）。
   - **形状即含义的属性宝石**：`EmberArt.statGem` —— 攻击为双剑琥珀菱晶、生命为红宝石心、武器耐久为青晶盾；费用是纯 CSS 烟熏玻璃圆盘。战场随从沿用同一套语法（满幅原画 + 底带 + 两枚宝石，无外框）。
7. **实时 DOM。** 所有文字、数值、状态继续是 DOM；装饰标签（如「英雄预览」「牌组预览」）可用伪元素，但不制造假按钮。

## 2. 令牌

全部定义在 `src/presentation/skins/slate/base.css` 的 `html[data-skin="slate"]` 块，页面文件不得重定义：

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--slate-font` | PingFang SC / Hiragino Sans GB / Source Han Sans / Noto Sans SC / Microsoft YaHei / system-ui | 全部文字，标题 700，正文 400/500 |
| `--slate-ink` `--slate-ink-2` `--slate-ink-3` | #f3f6fa / #c3ccd8 / #8e99a9 | 主文字 / 次文字 / 弱文字 |
| `--slate-blue` `--slate-blue-deep` | #8cc4ff / #2f72d6 | 强调文字、选中描边 / 主按钮、选中填充 |
| `--slate-line` `--slate-line-strong` | #ffffff26 / #ffffff40 | 仅剩导航轨竖线、图示连线与少数可点选实体轮廓（契约缩略图）使用；**不再作分节线或浮层边** |
| `--slate-line-art` | #ffffff59 | 场景原画（T5）上的发丝线，`--slate-line` 压在画面上会看不见 |
| `--slate-pill` `--slate-pill-line` | #121824b3 / #ffffff12 | 深色药丸底 / 7% 的极淡边（战场 HUD 芯片仍引用；对话框内的药丸已改为 #ffffff14 底 + 顶部内高光，无边） |
| `--slate-card-line` `--slate-card-base` | #d6dfe9aa / #0f141d | 卡片描边 / 卡片底 |
| `--glass-fill` | 左上 9% 白色高光 + 160° `#1a2231ad → #0f151fa3` 透色 | 玻璃着色（浮层壳、战场侧栏、英雄信息表等） |
| `--glass-fill-2` | #ffffff0f | 子玻璃块：面板内分组、模式卡、手册内容卡、图鉴牌组编辑列、设置分组 |
| `--glass-blur` | `blur(28px) saturate(160%)` | 玻璃的 backdrop-filter；回退时为 `none` |
| `--glass-rim` | `inset 0 1px 0 #ffffff30, inset 0 -1px 0 #00000030, inset 0 0 0 1px #ffffff0c` | 折射边缘：顶部亮唇、底部阴影、5% 轮廓，代替 border |
| `--glass-shadow` | `0 30px 80px #00000080` | 浮层柔投影，与 `--glass-rim` 一起写进 box-shadow |
| `--slate-material` | `var(--glass-fill)` | **别名**，只为兼容尚未改写的旧引用（dialogs / map / mobile 的少数面板）；新代码直接用 `--glass-fill` |
| `--slate-page-x` `--slate-rail` `--slate-list` `--slate-col-gap` `--slate-card-w/h` `--slate-thumb-w/h` | 48 / 200 / 400 / 40 / 300×430 / 72×96 px；`max-width:1500px` 时 36 / 150 / 330 / 28 / 240×344 | 页面壳几何 |
| `--covenant-col` | `clamp(400px, 42vw, 600px)` | 契约页右栏列宽。分页轨与面板在不同子树里，必须共用同一条列边，所以不能挂在其中任何一个上（2026-09-14 由 contracts.css 上收） |
| `--slate-hud-hit` | `max(44px, calc(44px / var(--scale, 1)))` | 战场 HUD 的最小命中区。`#battle` 是被 `--scale` 缩放的 1600×940 逻辑画布，按逻辑 px 写的控件会随窗口缩小；本令牌把它还原成 44 个真实设备 px。**必须声明在 `#app` 上而不是根元素**：自定义属性里的 `var()` 在「持有该声明的元素」上求值，而 `mobile-view.js` 是把 `--scale` 作为内联样式写在 `#app` 上的；写在 `html` 上会永远取 fallback 1，塌成固定 44px（2026-09-14 由 battle.css 上收） |
| `--m-fast` `--m-base` `--m-stage` `--m-cine` | 120ms / 180ms / 320ms / 550ms | 动效时长（2026-09-14 第三轮加入）。`--m-fast` = 芯片数值变化、hover 让位；`--m-base` = 手牌抬起、选中、令牌高亮；`--m-stage` = 浮层进出、随从落场；`--m-cine` = 神卡出场、降临仪式。**退场时长 = 进场的 60%**（例：神卡进场 `--m-cine`，退场 `--m-stage`），同组元素共用一条时间线；`prefers-reduced-motion` 与设置里的「减少动态效果」下一律退化为 0.2s 淡入淡出 |
| `--e-std` `--e-spring` `--e-exit` | `cubic-bezier(.2,.8,.2,1)` / `cubic-bezier(.34,1.4,.64,1)` / `cubic-bezier(.4,0,1,1)` | 缓动（同上）。`--e-std` = 进场与常规过渡；`--e-spring` = 带过冲的落定（神卡飞行、芯片弹入）；`--e-exit` = 退场，加速离开 |

| `--arena-brass/-hi/-lo` `--arena-iron/-hi/-lo` | #c9a45c / #f3dfa6 / #6e5120；#a9b4c2 / #e6edf5 / #4a5563 | 对局台金属：玩家旧铜、敌方冷铁（2026-09-22 由 arena.css 上收） |
| `--arena-ember/-hi/-lo` `--arena-crimson` | #ff9b3d / #ffd39a / #b4471a；#e0475a | 余烬 = 此刻可行动；朱红 = 受伤 / 敌方回合 |
| `--arena-ink/-2/-3` | #f6efe2 / #cdbfa6 / #8f8471 | 对局台上的暖白文字三档 |
| `--arena-glass` `--arena-glass-line` | 170° `#1b1712e0 → #0c0a08ea`；#ffffff14 | 烟黑曜石玻璃底与 8% 发丝线 |
| `--arena-metal-brass` `--arena-metal-iron` | 155° 五段渐变 | 用 mask 画成 2px 金属环（令牌、座席） |

新增页面若需要新令牌（例如战场 HUD 的半透明底 `--slate-hud`），在最终报告中提出，由协调者并入 base.css；页面文件里先用字面值并加 `/* token candidate */` 注释。

## 3. 组件语言

| 组件 | 规格 | 已有实现参考 |
| --- | --- | --- |
| 页面标题 | 返回箭头 44px（CSS 描边 chevron，左 36 上 26）+ 标题 32px/700/字距 3px，标题左侧留 48px | base.css `.modal-close` / `.modal-heading h2` |
| 节标题 | 20–26px/700 白字，下方 12–14px 留白（无发丝线）；可带「\| 蓝色副标」 | heroes.css `.hero-profile-heading` |
| 文字分页 | 20px，未选 ink-3，选中白色 700 + 3px 白色下划亮条（发光），项间 1px 竖线 | library.css `.filter-type-group` |
| 圆形芯片 | 36px 圆，深色药丸底；选中蓝底白字 | library.css `.filter-btn.mana` |
| 导航轨 | 2px 竖线 left 27px；选中节点 56px 径向蓝光圆 + 图标；未选 16px 空心点；标签 25px/700 | settings.css `.settings-nav` |
| 主药丸 / 次药丸 | 高 48–52，圆角 999，无边。主：`linear-gradient(180deg,#4a8be6,#2c66c4)` + `inset 0 1px 0 #ffffff59` + 蓝色柔光 `0 10px 28px #2f72d659`；次：#ffffff14 底 + `inset 0 1px 0 #ffffff2e`，hover #ffffff24；文字 18px/500–600 | base.css `.gold-btn` `.ghost-btn` |
| 小药丸 | 高 30–38，13–16px | base.css `.library-inspect`、heroes 「选择英雄」 |
| 开关 | 104×40 药丸，圆形滑块；开启蓝底白字 | settings.css `.toggle` |
| 滑杆 | 现有轨道，浅蓝进度，白色圆形滑块 | settings.css `.audio-level` |
| 下拉 / 输入 | 高 44，圆角 999，#ffffff14 底 + 顶部内高光，无边，16px | base.css `select.library-search` |
| 卡片容器 | 圆角 8–12，1.5px `--slate-card-line`，底 `--slate-card-base`，投影 `0 8px 20px #0007`；内侧 6px 处 1px #ffffff2a 细内框（大卡） | heroes.css `.scene-showcase` |
| 缩略图 | 72×96（列表）/ 56×56（身份）/ 96×128（预览列表），圆角 8，1.5px 描边，`object-fit: cover` | heroes.css `.hero-option img` |
| 模式卡 / 可选块 | 圆角 12，无边（1px 透明占位），底 `--glass-fill-2` + `inset 0 1px 0 #ffffff1f`；选中：边 `--slate-blue` + `inset 0 0 0 1px` + 外发光 #8cc4ff33 + 底 #16243a | heroes.css `.hero-mode-cards button` |
| 子玻璃块 | 圆角 16–20，底 `--glass-fill-2` + `inset 0 1px 0 #ffffff14`，内边距 20/22，块与块之间 12px；用于设置分组、图鉴牌组编辑列、手册内容卡 | settings.css `.settings-options`、library.css `.deck-editor`、guide.css `.help-turn-flow` |
| 列表行 | 高 40，圆角 8，深色底 + 右侧半透明卡图，左侧 28px 圆形费用 | library.css `.deck-row` |
| 进度条 | 轨道 6px #ffffff1f 圆角，进度 `--slate-blue-deep`→`--slate-blue` | 新增（契约页） |
| 徽章芯片 | 高 28，圆角 999，药丸底，14px，`b` 白色 | heroes.css `.comp-counts span` |
| 浮层壳 | 圆角 24，无边，底 `--glass-fill`，`backdrop-filter: var(--glass-blur)`，`box-shadow: var(--glass-rim), var(--glass-shadow)`，内边距 28/32，宿主暗幕 #0b0f168c；关闭为右上 40px 圆（#ffffff14 底 + 顶部内高光）。战场侧栏（战斗记录 / 首领情报）同一套，圆角 20 | base.css、battle.css §4、mobile.css §9 |
| HUD 芯片（战场） | 高 36–44 药丸，底 #0f141dcc，边 `--slate-pill-line`（7%，几乎不可见），图标 + 数字；重要节点（技能）用 56px 发光圆。HUD 芯片的完整玻璃化（内高光代替边）待下一轮 | 战场任务新增 |
| 提示 / Toast | 深色药丸，最大宽 520，16px，居中 | 战场任务新增 |

状态：hover 底变亮 (#1b2434d9) 边 `--slate-line-strong`；pressed `transform: scale(.98)`；focus-visible 2px `--slate-blue` 外描边；disabled 文字 ink-3、边 #ffffff1a；遵循 `prefers-reduced-motion` 与游戏「减少动态效果」设置（不新增动画，仅 0.15–0.2s 过渡）。

## 4. 布局模板

- **T1 轨 + 清单 + 预览**（参考图原型）：`[导航轨 200][清单 400][预览 1fr]`；预览列顶部节标题「X 预览 | 名称」，其下预览卡 + 分节。用于英雄选择；地图右栏、契约右栏采用其「预览列」部分。
- **T2 轨 + 内容**：`[导航轨 200–240][内容 1fr]`，内容列节标题 + 子玻璃块分组。用于设置、旅人手册；桌面上装在浮层壳里，触屏上是页面壳。
- **T3 分页 + 网格 + 侧栏**：标题行（返回 + 标题 + 搜索药丸）→ 文字分页 / 芯片 → 卡片网格 `auto-fill minmax(186px,1fr)` → 右侧 380px 发丝线分节侧栏。用于万象秘典。
- **T4 浮层对话**：浮层壳内：标题（26px/700，右上关闭）→ 正文 / 卡片区 → 留白 → 底部药丸（右对齐；确认类左取消右主）。用于确认、菜单、记录、结算、英雄信息。看卡的对话（发现、起手换牌、卡牌详情表、手牌总览）改用舞台壳：无面板，标题居中，卡牌直接落在模糊战场上。
- **T5 场景页 + 磨砂 UI 层**：场景原画全屏为底；UI 元素全部换成组件语言（药丸、芯片、圆角卡片、发丝线、文字分页），面板用浮层壳。用于主页、地图、战场、契约。
- **T6 流程页**：标题行 → 横排选项卡片（3 张）→ 留白 → 底部状态 + 主药丸。遗物奖励桌面用 1080 宽浮层壳，触屏用页面壳；起手换牌用舞台壳。

## 5. 页面简报

每份简报：入口 / DOM 归属 / 模板 / 布局 / 保留与替换 / 验收尺寸。子代理先读该页档案（`docs/design/reference-pages/*.md`）确认真实入口与既往批注，再读源码核对类名。

### 5.0 英雄选择 heroes（卡牌舞台，2026-09-22）— `src/application/screens/heroes.js`，`src/presentation/skins/slate/heroes.css` 末段「卡牌舞台」
- 页面读起来像起手换牌：一张大的浮雕英雄卡（`.scene-showcase`，桌面 300×430）、一行**英雄卡**（`.hero-option` 改为 5:6 满幅立绘 + 名字带，桌面 132 宽四张居中一行；触屏四张平分一行、最宽 124；横屏 ≤500 高时最宽 96）、一列紧凑选项（技能、套牌、模式卡、契约栏、牌组思路两行截断）、一个主按钮。
- 删掉的结构（DOM 仍在，CSS 隐藏）：左侧导航轨与「英雄名册」、列表行的英文副标与技能说明、`.hero-config-intro` 出发准备文案、`.hero-composition` 构成图表、「英雄预览 |」前缀、契约栏的说明小字。
- 选中态：卡上浮 8px、蓝色 2px 内描边 + 发光，右上 26px 蓝色勾徽；hover 上浮 4px。
- 桌面 ≤820 高：改三列 `[卡 300][选项 400][英雄卡 2×2]`，避免英雄行被挤出首屏。
- 共享规则用 `body:is(.touch-layout, :not(.touch-layout))` 与前面的分布局规则打平特异性、靠源顺序取胜。
- 验收：`dialog-layout.spec.cjs` 1600 分支断言四张英雄卡同一行（用 offsetTop，选中卡有位移）且选项列在大卡右侧。

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

#### 5.4b 黑曜石对局台（2026-09-22）— `src/presentation/skins/slate/arena.css`（皮肤层最后一个战场文件，靠加载顺序覆盖 battle / mobile / card-face / console 四个文件）
- 材质一把钥匙：烟黑曜石玻璃（`--arena-glass`）+ 金属边（玩家 `--arena-metal-brass` 旧铜、敌方 `--arena-metal-iron` 冷铁）；**余烬 `--arena-ember` 是唯一强调色**，只给"此刻可行动"的东西（可攻击的令牌、无事可做的结束回合、技能节点的核心）。法力晶体与卡费同色，仍是月石蓝 `--slate-blue`，是战场上唯一允许的冷色。
- 随从令牌：`::before` 遮罩画 2px 渐变金属环、`::after` 画地面接触阴影；底部 24cqw 高的暗色铭板（画在 `.minion-art::after` 里，跟随圆角）承载攻/血裸数字 + 遮罩字形（`--glyph-blade/heart/shield`），两颗宝石与稀有度色带不再绘制（DOM 保留，`.stat.atk` 右边 = `.stat.hp` 左边的契约不变）。可攻击 = 余烬边（`.ready-dot`）；嘲讽 = 暖石环；目标 = 朱红环。
- 桌面英雄座席：156×231 不变，改 `78px 78px 14px 14px` 拱形；名字刻在拱内底部 42px（左右 17.8% 对称内缩，`ui-alignment` 契约）；脚部 34px 铭板放攻（仅持武器时显示，`.is-zero` 隐藏，血格随之占满）与血；护甲是左肩盾形芯片（右侧留给武器槽）；阶段 / 契约进度是拱顶右上的小药丸。牌库计数改为座席正下方的"牌堆 + 数字 + 说明"芯片（36,338 / 36,748）。
- 手牌扇形（仅桌面）：`ui.js` 写 `--r = 中心偏移 × 2.8°`、`--y = 偏移² × 3 − 8px`（中央微抬），悬停 / 选中时转正抬起 78px；触屏坞不转。
- 结束回合：黑曜石药丸 + 铜边 + 铜字；`.ready-end` 余烬填充深字；敌方回合暗灰 + 转圈。技能节点：黑曜石环 + 余烬核心，标签为裸文字，费用为小圆芯片。
- 触屏三档（compact-desktop / 竖屏 / 横屏）用同一套：头像 / 迷你卡的铜或铁边（迷你卡同为拱形）、芯片改黑曜石 + 字形、圆形结束回合、竖屏六边形晶体。
- 敌方在右上（2026-09-23）：桌面座席 `left:1412 / top:94`，牌库芯片贴右缘，首领情报面板改到左侧、战斗记录面板到右侧座席之下；触屏三档由 `mobile-view.js` 把敌方主机台放到右上（横屏 `x = W − padR − rail`，竖屏头像盒贴右缘），arena.css §10 把头像/迷你卡镜像到右端、芯片向左排。
- 3D 场景「断裂王庭」（`presentation/arena-3d.js`，2026-09-23 按设计画布 https://claude.ai/artifact/HyVAsg2simBqazVxQJaiYc 重做）：场地是一座压制火山灰石台基（顶面 y=0、高 30、倒角 7），夹在左右两条熔岩河之间。台面图形层由 `courtArt()` 按 HX/HZ 在运行时画进一张 RGBA 遮罩（R 刻线深度 / G 黑曜石 / B 暗铜 / A 黑曜石流纹光泽；桌面 1792、触屏 1408，生成约 70ms，`EmberArena3D.board.artMs` 可查）：流纹刻线、斜贯台面的彩虹黑曜石笔触（发丝裂缝留在笔触内，两端撕裂成碎片）、断冠徽记（R246、刻度环、双环）、两排随从之间的中线、左右竖排铭文、上缘「断裂王庭」、下缘关卡铭牌；铭文用系统衬线字体，没有位图。光：暖色聚光池只照台面（`pool()`），其余是冷月光（`PAL.key`），暖色只来自聚光与熔岩。熔岩河按屏幕可见边界放在台面与屏幕边缘之间约 55% 处（远端宽、近端窄，随透视收窄），绕开英雄座台；河心是流动的熔体（流纹、气泡），结壳推向河岸。座台按 `.hero-card-inner` 头像底边反投影放置（触屏的 `.hero` 是整条信息栏，不能用），阵营色只在透镜细环。环境：Voronoi 柱状玄武岩（远岸成墙、近岸低簇）、焦草、从河里升起的余烬；砖墙残垣与要塞已移除。点缀色是紫水晶与祖母绿两种晶簇（2026-09-23 用户要求「明显可见、给画面添彩」，替换原来几乎看不见的黑曜晶簇）：六棱柱带尖顶，根部暗、向尖端变亮，每个面亮度不同，棱线与尖端用浅一档的芯色，偶尔有面闪光；颜色集中在 `GEM` 一个令牌里。每簇 1–2 根主晶朝远离台面、远离镜头的方向倾斜，旁边 2–3 根、根部一圈小尖晶，外围再散两根；最大的 7 簇各带一盏同色点光把周围地面和玄武岩染色，每种颜色各有 36 粒上浮光点。自发光走泛光但不触发热浪（晶体 alpha 写负值，亮度提取取绝对值，热浪只读正值）。放置：横屏类布局放在台面边缘与熔岩河近岸之间的中点，竖屏没有这块地，改放台面远端一排、近端三簇；只放在镜头看得到、且根部不被 HUD（`HUD_BOXES`：按钮、状态条、头像、神契、法力、手牌等）盖住的位置；颜色按最近邻交替（单独一簇取较少的那种，平局取紫水晶），竖屏两排从左到右排列，所以沿排交替。晶簇尺寸按屏幕上每单位像素放大（`gemK`，桌面约 1、竖屏约 1.8，浅台面有上限），所以各尺寸屏幕上都一样醒目。竖屏：俯角 64°（其余 57°），台面宽 = 全宽战场 − 40px（两侧露出熔岩光边），近端止于我方指挥台上沿，进深上限放宽到 1250，所以两行随从都落在台面上；熔岩河收窄到 72、贴台面 18。阴影 pass 改用光源矩阵（旧版误用了相机矩阵，阴影贴图实际无效）。实测（隐藏 HUD、同尺，旧版在括号里）：台心 L* 56（42）、明度比 3.7（1.9）、暗部 45%（19%）、环境/台心细节比 0.25（0.98）；彩色面积 15%、高光 8% 超出原设计目标，都来自按要求加强的熔岩河，是有意放宽的两项。加晶簇后（桌面同尺）：台心 L* 55.5、明度比 3.5、暗部 43%、高光 8.4%、彩色面积 18%、细节比 0.27，台面仍是明度中心。`node tools/arena-measure.cjs` 复测，表里 `gems` 列是各布局放下的晶簇数。
- 验收：`battle-hud-layout`、`ui-alignment`、`action-feedback`、`ui-polish`、`mobile-craft`、`remaining-reference`、`hand-drag`、`hand-reading`、`card-motion`、`mobile-hand-layout`、`motion-semantics`、`combat-motion`、`boss-scenes` 全过；`card-motion` 里压缩抽牌的代理卡断言改为逐帧观察（代理卡只活约 90ms，100ms 轮询碰运气）。

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
