# 二级状态 / secondary

## 目标与当前状态

当前面板外壳已统一为 [共享 SVG 四角组件](../SHARED_PANELS.md)，包括菜单、卡牌详情、发现、确认和画廊等普通弹窗；标题与关闭区、底部操作区统一留白。旧伪元素外框及菜单木色样式已移除。

2026-09-13，按 concepts 中对应参考接入既有可玩游戏。当前已实装，未发布；用户尚未确认视觉验收。卡牌插画继续使用当前严格 ID 映射；卡名、规则、数量和状态取真实游戏数据。

## 参考与坐标

- [参考图](../../../output/design-hok-world-20260912/concepts/14-secondary-states.png)
- [实装截图](../../../output/remaining-reference-20260913/detail.png)
- 原图为四分屏，各子图约 836×470；实装分别为独立 1672×941 页面。除上述手机输出外，桌面截图为 1672×941。
- [逐页对照](../../../output/remaining-reference-20260913/index.html)

## 元素拆分与当前实现

- 实现入口：`src/application/library.js / src/application/screens/campaign.js / src/ui.js`；统一材质由 `src/presentation/components.css` 消费，场景由 `EmberTheme` 的语义角色解析。
- 范围：详情与加入牌组、三选一发现、失败结算、可取消的重试确认。
- 位图只承担场景、复杂材质、遗物和徽记；文字、数值、规则、选择状态与按钮保留实时 DOM；简单图案由 `EmberArt` 原生 SVG 提供。
- 新生成素材的提示词、源文件、格式、SHA-256 和 Alpha 实测见 [provenance.json](../../../assets/ui/page-reference-v1/provenance.json)。生成模型未由工具返回，记录为未核实；WebP 仅作格式封装。生成重建不等于无损分层。

## 页面动作

入口：卡牌详情；发现效果；战败；设置→重试。所有按钮沿用既有动作接口；测试中的状态夹具用于打开胜负、发现和奖励页面，不进入生产接口。

## 批注与迭代结论

排除了旧 absolute/margin/广泛选择器造成的覆盖；桌面卡牌维持同一图区比例和按规则长度变化的字号。横屏提示移出单位区域，敌方法力移到英雄旁。新增设置导航、模式按钮和契约槽位均绑定实际状态。

已知差异：参考包含与当前内容库不同的卡名、数值、配置与装饰性文案，实装显示当前真实内容；背景和复杂徽记为图像重建，纹理与边界不是原图逐像素复制；部分细边框、字形、按钮轮廓仍由现有主题及 SVG 重建。没有计算排除卡图后像素误差为零，不能将交互测试通过称为像素一致证明。

## 验证与交付

当前结果以 [本轮验证记录](../../../output/remaining-reference-20260913/VALIDATION.md) 为准。新增截图/交互脚本：`tests/e2e/remaining-reference.spec.cjs`。手机为 Chromium 触控模拟，无实体手机验收；未更新公开站点。

## 2026-09-13 细节打磨

卡牌详情使用独立透明银框、实时徽章与原生标题横线；返回/加入/确认动作增加独立纹理和 SVG 图标。

复杂纹理由 image-gen 重建，简单图标与轮廓由原生 SVG/CSS 完成。生成图并非原图无损分层；具体透明通道限制见 [素材记录](../../../assets/ui/detail-polish-v1/provenance.json)。本次截图和检查见 [细节打磨记录](../../../output/detail-polish-20260913/VALIDATION.md)。

## 2026-09-13 同类问题扩展修正

卡牌详情的规则框增加 16×20 px 内边距，解除正文贴边；按钮内容、图标间距与关闭按钮留白纳入逐状态检查。见 [视觉纪律验证](../../../output/visual-discipline-20260913/VALIDATION.md)。

## 2026-09-13 确认操作

确认框按钮组整体居中；各按钮文字由共享 action-label 独立居中，图标占独立侧槽。保持取消、确认及动态更新文案的原有行为。

## 2026-09-13 磨砂青岩皮肤

`?skin=slate` 下全部二级弹窗使用浮层壳，`.crafted-panel` 玻璃底与四角在 base.css 已中和，本次补齐内容语言（`src/presentation/skins/slate/dialogs.css`）：

- 卡牌详情：宽度从 `components.css` 的 1600px 收回简报要求的 740px（皮肤仅在此文件覆盖 `--dialog-width`）；左卡 260px、右信息列名称 26px/700、规则文字去框改 15px 正文、职业稀有度 / 已加入 / 牌组各为 46px 发丝线行；底部次 + 主药丸。
- 发现：宽度收回 820px，三张牌等宽；hover / focus 由旧金色 `drop-shadow` 改为蓝色发光。
- 确认：480px，标题 22px/700，正文 15px ink-2 左对齐，右下取消（次）+ 确认（主）。
- 菜单 / 战斗记录 / 手牌总览 / 英雄信息 / 战场画廊：菜单项改药丸（左图标槽 + 文字）；记录改发丝线行；手牌 hover 蓝色发光；英雄信息去掉 `legacy-components.css` 的琥珀玻璃底，头像改圆角描边卡，数值与技能说明改发丝线行；画廊六个场景块改圆角 12 描边卡。

已知差异：菜单图标仍由 `art.js` 返回彩色 emoji（地图 / 书 / 宝石），未统一为描边 SVG，需在共享层处理。截图见 `output/slate-dialogs-20260913/`。

## 2026-09-14 触控布局皮肤

`?skin=slate` 第二阶段，`dialogs.css`：

**桌面回归修复（优先）。** `base.css` 现在对所有布局生效后，本文件开头那段「浮层通用装饰」——`.folio-dialog > .modal-heading`（下边发丝线 + 16px 下内边距）与 `> :is(.modal-footer, .reward-footer, .atelier-foot)`（上边发丝线 + 20px 上内边距）——不再被页面壳规则压住，于是六个页面壳（英雄 / 图鉴 / 设置 / 地图 / 契约 / 手册）的标题行下多出一条发丝线，正文整体下移约 16px。已把这段规则限定到十一种浮层尺寸（`confirm` `detail` `hand` `menu` `journal` `discover` `mulligan` `choice` `result` `atelier` `workspace`）。修复后 1672×941 的英雄页与 `output/slate-skin-test-20260913/heroes-slate-1672x941.png` 像素差为 0（修复前差 239,752 px）。

**触控布局（第 12 节）。** 页面壳在触控下改为 16px 侧边距 + 安全区、28px 标题、左上 44px 返回箭头（短横屏 21px 标题、平板恢复 32px）；页面壳底部药丸整行等分（平板回到居中定宽）。浮层壳（确认 / 卡牌详情）改为 16px 外边距、标题 22px、底部药丸整宽纵向堆叠（短横屏回到一行）；卡牌详情竖屏为「卡面在上、信息在下」，短横屏与平板恢复左右两栏。

`components.css` 的 `.panel-actions > button { max-width: min(240px, 100%) }` 会让手机底部药丸只占三分之二宽，触控下解除该上限；同一条规则在 `column-reverse` 的堆叠底栏里还会让 `flex: 1 1 140px` 把药丸撑成 140px 高的方块，已改为 `flex: 0 0 auto`。

需要协调者并入 `base.css` 的共享改动：第 12.1 节整段（页面壳的触控几何）以及浮层壳关闭按钮在触控下的 44px 命中区。两者现在只挂了本任务负责的四种尺寸，并入 `base.css` 时应补上 `route` 与 `covenant`。

验收：确认框与卡牌详情 × 四个视口的截图见 [output/slate-mobile-pages-20260914](../../../output/slate-mobile-pages-20260914/)。
