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
