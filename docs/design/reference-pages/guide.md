# 旅人手册 / guide

## 目标与当前状态

手册外壳及流程、卡牌说明、关键词独立内容块现共用 [SVG 四角面板](../SHARED_PANELS.md)，统一四边留白、标题区和操作区。

2026-09-13，按 concepts 中对应参考接入既有可玩游戏。当前已实装，未发布；用户尚未确认视觉验收。卡牌插画继续使用当前严格 ID 映射；卡名、规则、数量和状态取真实游戏数据。

## 参考与坐标

- [参考图](../../../output/design-hok-world-20260912/concepts/11-guide.png)
- [实装截图](../../../output/remaining-reference-20260913/help.png)
- 左目录，右 2.1:1 内容网格；规则全文留在可展开区域。除上述手机输出外，桌面截图为 1672×941。
- [逐页对照](../../../output/remaining-reference-20260913/index.html)

## 元素拆分与当前实现

- 实现入口：`src/application/screens/preferences.js`；统一材质由 `src/presentation/components.css` 消费，场景由 `EmberTheme` 的语义角色解析。
- 范围：四章导航、回合四步图、卡牌结构、关键词、完整基础规则。
- 位图只承担场景、复杂材质、遗物和徽记；文字、数值、规则、选择状态与按钮保留实时 DOM；简单图案由 `EmberArt` 原生 SVG 提供。
- 新生成素材的提示词、源文件、格式、SHA-256 和 Alpha 实测见 [provenance.json](../../../assets/ui/page-reference-v1/provenance.json)。生成模型未由工具返回，记录为未核实；WebP 仅作格式封装。生成重建不等于无损分层。

## 页面动作

入口：主页「旅人手册」。所有按钮沿用既有动作接口；测试中的状态夹具用于打开胜负、发现和奖励页面，不进入生产接口。

## 批注与迭代结论

排除了旧 absolute/margin/广泛选择器造成的覆盖；桌面卡牌维持同一图区比例和按规则长度变化的字号。横屏提示移出单位区域，敌方法力移到英雄旁。新增设置导航、模式按钮和契约槽位均绑定实际状态。

已知差异：参考包含与当前内容库不同的卡名、数值、配置与装饰性文案，实装显示当前真实内容；背景和复杂徽记为图像重建，纹理与边界不是原图逐像素复制；部分细边框、字形、按钮轮廓仍由现有主题及 SVG 重建。没有计算排除卡图后像素误差为零，不能将交互测试通过称为像素一致证明。

## 验证与交付

当前结果以 [本轮验证记录](../../../output/remaining-reference-20260913/VALIDATION.md) 为准。新增截图/交互脚本：`tests/e2e/remaining-reference.spec.cjs`。手机为 Chromium 触控模拟，无实体手机验收；未更新公开站点。

## 2026-09-13 细节打磨

目录选中纹理与移动高光、完成按钮冰晶材质、面板四角银线；嘲讽与亡语图标改为原生实心轮廓。角饰 SVG 与流程图标选择器分离，避免标题重叠。

复杂纹理由 image-gen 重建，简单图标与轮廓由原生 SVG/CSS 完成。生成图并非原图无损分层；具体透明通道限制见 [素材记录](../../../assets/ui/detail-polish-v1/provenance.json)。本次截图和检查见 [细节打磨记录](../../../output/detail-polish-20260913/VALIDATION.md)。

## 2026-09-13 同类问题扩展修正

在 1132×1074 复查发现示意卡被绝对定位到“卡牌说明”标题和介绍区域。示意图改回文档流，标题/介绍后保留 30 px 间距，面板高度随内容增长。1100–1350 px 桌面将概览模块上下排列，关键词使用两列，避免窄文字列。新增检查直接测量标题、介绍与卡牌/费用徽章之间的间距。见 [视觉纪律验证](../../../output/visual-discipline-20260913/VALIDATION.md)。

## 2026-09-13 内容留白

桌面目录文字左对齐，统一起始位置；内容卡框内边距 24×28px，外框内边距 32px。保留正常内容流及单一纵向滚动。共享操作按钮采用独立居中文字槽。

## 2026-09-13 磨砂青岩皮肤

按 [SLATE_DESIGN_SYSTEM.md](../SLATE_DESIGN_SYSTEM.md) 5.6 简报，在 `?skin=slate` 下重做为 T2（导航轨 + 内容列）模板，实现于 `src/presentation/skins/slate/guide.css`（不改 `base.css`、其他页面文件；仅本页归属的 CSS）。

- `.help-toc` 改为与旅途设置页相同的节点导航轨语言：左侧 2px 竖线、56px 发光节点（选中）/ 16px 空心点（未选中）、25px/700 标签；原实现为 `.ghost-btn` 药丸横排，现完全替换视觉（类名不变，仅样式覆盖）。实现改用绝对定位圆点（而非 CSS Grid 双列）承载长标签换行，避免章节文字（如「出牌与攻击」）在导航轨内被压缩到两三字一行。
- 内容列三个 `.crafted-panel`（回合流程 / 卡牌说明 / 关键词速查）统一改为圆角 12、`#0f141d80` 磨砂底、1px 发丝线描边的内容卡，去除四角 SVG；回合流程步骤图标与关键词速查图标改为 56/48px 圆角方块（英雄页技能图标同语言）。卡牌说明示意图保留卡面组件本身（游戏语义不动），标签改为发丝线描边的小标签片。
- 章节 04「关键词速查」的 `.key-table` 改为两列发丝线行，填满内容列宽度、减少纵向滚动。
- 已知问题修复：旧实现中「返回游戏」主药丸使用 `position:absolute; left:28px; bottom:20px`（继承自 1100×650 以上桌面断点的旧规则），在磨砂青岩全屏页面壳下会压住「卡牌说明」卡片右下角；改为 `position:static`，随 `.modal-footer` 正常文档流排在内容之后，不再重叠。
- 调试过程中发现并修正一处皮肤内部冲突：`.help-key-preview span` / `.help-key-preview svg` 选择器原本未加范围限定，意外命中 `panels.js` 自动注入到每个 `.crafted-panel` 内的 `.panel-corner-trim` 四角描边（其 DOM 也是 `span` 包 `svg`），特异度高于 base.css 的隐藏规则，导致窄桌面尺寸下「关键词速查」卡片重新露出旧四角银线；已改为 `.help-key-preview > div span` / `> div i svg` 的精确范围。
- 截图：`output/slate-guide-20260913/`（1672×941、1280×720，各四章节 + 一张不带 `?skin` 的对照图）。
- 验证：`node --test tests/*.test.cjs`（127 通过）；本地追加 `&skin=slate` 的 `dialog-sizing` / `interface-audit` / `remaining-reference` / `responsive-component-style` / `uiux` 五个 e2e 规格在端口 8106 跑通，25/28 通过；3 个失败（`dialog-sizing` 设置弹窗宽度期望 1100px、`responsive-component-style` 材质指纹、`uiux` 长卡牌规则文本）与本页无关，在改动前的原始构建上同样失败，均依赖尚未更新的旧材质断言。
