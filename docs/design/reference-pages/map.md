# 冒险地图 / map

## 目标与当前状态

地图档案现共用 [SVG 四角面板](../SHARED_PANELS.md)，统一内边距；全屏地图保持独立构图。短横屏地图区按可用高度收缩，不由旧最小高度顶出内容区。

2026-09-13，按 concepts 中对应参考接入既有可玩游戏。当前已实装，未发布；用户尚未确认视觉验收。卡牌插画继续使用当前严格 ID 映射；卡名、规则、数量和状态取真实游戏数据。

## 参考与坐标

- [参考图](../../../output/design-hok-world-20260912/concepts/03-map.png)
- [实装截图](../../../output/remaining-reference-20260913/map.png)
- 地图 75.5%，情报栏 24.5%；节点与底图坐标绑定。除上述手机输出外，桌面截图为 1672×941。
- [逐页对照](../../../output/remaining-reference-20260913/index.html)

## 元素拆分与当前实现

- 实现入口：`src/presentation/adventure-map.js`；统一材质由 `src/presentation/components.css` 消费，场景由 `EmberTheme` 的语义角色解析。
- 范围：六个真实关卡、节点选择、首领规则及出发按钮。
- 位图只承担场景、复杂材质、遗物和徽记；文字、数值、规则、选择状态与按钮保留实时 DOM；简单图案由 `EmberArt` 原生 SVG 提供。
- 新生成素材的提示词、源文件、格式、SHA-256 和 Alpha 实测见 [provenance.json](../../../assets/ui/page-reference-v1/provenance.json)。生成模型未由工具返回，记录为未核实；WebP 仅作格式封装。生成重建不等于无损分层。

## 页面动作

入口：主页「冒险」。所有按钮沿用既有动作接口；测试中的状态夹具用于打开胜负、发现和奖励页面，不进入生产接口。

## 批注与迭代结论

排除了旧 absolute/margin/广泛选择器造成的覆盖；桌面卡牌维持同一图区比例和按规则长度变化的字号。横屏提示移出单位区域，敌方法力移到英雄旁。新增设置导航、模式按钮和契约槽位均绑定实际状态。

已知差异：参考包含与当前内容库不同的卡名、数值、配置与装饰性文案，实装显示当前真实内容；背景和复杂徽记为图像重建，纹理与边界不是原图逐像素复制；部分细边框、字形、按钮轮廓仍由现有主题及 SVG 重建。没有计算排除卡图后像素误差为零，不能将交互测试通过称为像素一致证明。

## 验证与交付

当前结果以 [本轮验证记录](../../../output/remaining-reference-20260913/VALIDATION.md) 为准。新增截图/交互脚本：`tests/e2e/remaining-reference.spec.cjs`。手机为 Chromium 触控模拟，无实体手机验收；未更新公开站点。

## 2026-09-13 磨砂青岩皮肤

`?skin=slate` 下的地图按 [设计系统](../SLATE_DESIGN_SYSTEM.md) 简报 5.2 重做 UI 层，实现文件只有
`src/presentation/skins/slate/map.css`（全部规则以 `html[data-skin="slate"] body:not(.touch-layout)` 开头，无 `!important`，无新位图）。

保留：地图原画满幅铺底、六个关卡节点的百分比坐标、随 DOM 锚点实时重绘的路径 SVG、右栏信息与「准备出发」的既有动作接口。

替换：去掉四角 SVG（`.atlas-corners`）、罗盘徽记与纸面材质；标题行改为 base.css 的返回箭头 + 「冒险地图」32px/700，「远征图志 · 06 境」为 ink-3 16px 并列在标题右侧，章节计数沿用桌面既有的隐藏；左下品牌字标改为黑体文字（「烬域」20px/700 + `EMBERFALL` 10px 字距 3px）。关卡节点统一为导航轨节点语言：当前可打 56px 蓝光节点（内嵌首领原画）、已通关 56px 实心蓝节点带勾、未解锁 44px 空心点加锁；编号 25px/700、名称 20px/700，均带阴影。右栏改为 380px 磨砂列（比浮层壳更不透明，左侧发丝线分隔），发丝线分节依次为首领卡（圆角 12、1.5px 描边、`object-fit: cover`）→ 名称 28px/700 → 地区副标 14px ink-3 → 引言 15px ink-2 → 属性芯片 →「旅途遗物」节标题 + 56px 圆角遗物格 → 底部主药丸「准备出发」。

`src/presentation/adventure-map.js` 只做了一处非行为改动：`.atlas-dossier-rule` 由一条文本改为
`.atlas-dossier-stat` / `.atlas-dossier-sep` / `.atlas-dossier-stat.atlas-dossier-skill` 三个 span，拼接文本与原来逐字相同，供皮肤渲染成芯片。

选中态是独立于进度的第三个轴（任何节点都能点开查看），因此额外给 `[aria-pressed="true"]` 一圈蓝色描边与外发光，简报未列出此状态。技能芯片文字是整句规则，采用圆角 14 的可换行芯片而非 28px 定高药丸。

验收：1672×941、1440×900、1280×720 各一张默认图与一张切换节点图，见 [截图与说明](../../../output/slate-map-contracts-20260913/README.md)。不带 `?skin` 的同页截图与改动前 MD5 逐字节一致。`node --test tests/*.test.cjs` 全通过；`?skin=slate` 下 `map-detail.spec.cjs` 四个尺寸全通过。

## 2026-09-14 触控布局皮肤

第二阶段：`body.touch-layout` 下地图有了专用竖屏 / 横屏排版，唯一改动文件仍是
`src/presentation/skins/slate/map.css`。文件重排成 **材质 → 桌面几何 → 触控几何** 三段；材质段以
`html[data-skin="slate"] body` 开头（无布局限定），桌面段保持 `body:not(.touch-layout)` 且与
2026-09-13 逐像素一致，触控段为 `body.touch-layout`。

材质段一次性定义：页底 `#0d121b`、四角/罗盘/章节计数的隐藏、标题与 kicker 的字族与颜色、路径 SVG 的描边、
节点语言（`.atlas-node` 无底无框、`.atlas-landmark` 圆形 + `#212c3d` 底、已通关蓝色填充、当前关蓝光、未解锁空心、
选中蓝环）、右栏磨砂底与发丝线分节、属性芯片、遗物格与「准备出发」主药丸。节点**尺寸**留在各布局段：
桌面 56/44px，触控 48/44px（都满足 44px 命中区）。

竖屏 390×844：`.adventure-atlas` 与桌面一样 `padding: 0`，返回箭头移到安全区角上；标题行为两行（kicker + 「冒险地图」22px），
地图铺满宽度、高 `min(35dvh, 320px)` 的可滚动舞台，其下是全宽的磨砂档案带（首领卡 112px → 名称 22px → 地区副标 → 引言 →
属性芯片），最底是发丝线 + 全宽「准备出发」的页脚。

横屏 844×390 / 568×320 / 1024×768：`.modal-scroll` 保持横排，地图在左、`min(300px, 45%)` 的档案列在右（左侧发丝线分隔），
页脚变成一行「旅途遗物 + 300px 主药丸」。

两点值得记录：

- `.atlas-footer` 同时也是 `.modal-footer`，而 `dialogs.css` 用
  `.folio-dialog > :is(.modal-footer, …) { border: 0; border-top: 1px …; background: none }` 抹平所有对话框页脚。
  第一阶段靠 `body:not(.touch-layout)` 多出的一个类胜出；材质段去掉这个限定后就会输给 `dialogs.css`（同权重、后出现），
  桌面的磨砂页脚会被打回透明。这里用对话框根节点自己的 `.folio-dialog` 类补回同样的类数——
  1672×941 的逐像素比对最初就是靠这条 1px 竖线（x=1292，y 743–941）发现的。
- 触控档案列是定高的 flex 列，子项默认会被 flex-shrink 压扁（568×320 上首领名一度被压成 0px 高）。
  触控段给 `img / h3 / status / quote / rule` 统一 `flex: none`，由列自身滚动。

「分栏发丝线」（`.atlas-dossier` 与 `.atlas-footer` 的 `border-left`）只在真的有第二栏的布局里出现——桌面与触控横屏——
竖屏没有。这是分隔符的**可见性**变化，面板自身的底色、圆角与投影三视口一致。

验证：`node --test tests/*.test.cjs` 127 通过；`?skin=slate` 下 `map-detail.spec.cjs` 4/4 通过（1600×940、390×844、844×390、568×320）。
`responsive-component-style.spec.cjs` 的跨视口材质比对中 `map` 一页的差异由 36 条降到 **0** 条。
桌面 1672×941 与改动前逐像素完全一致（0 像素差）。截图见 [output/slate-mobile-scene-20260914/](../../../output/slate-mobile-scene-20260914/README.md)。
