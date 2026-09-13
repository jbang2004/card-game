# 起手换牌 / mulligan

## 目标与当前状态

当前使用 [共享 SVG 四角面板](../SHARED_PANELS.md)。卡片与保留/替换标签共同参与网格高度；竖屏两列，短横屏单行，确认区居中固定可达。旧固定卡高与重复断点网格已移除。

2026-09-13，按 concepts 中对应参考接入既有可玩游戏。当前已实装，未发布；用户尚未确认视觉验收。卡牌插画继续使用当前严格 ID 映射；卡名、规则、数量和状态取真实游戏数据。

## 参考与坐标

- [参考图](../../../output/design-hok-world-20260912/concepts/07-mulligan.png)
- [实装截图](../../../output/remaining-reference-20260913/mulligan.png)
- 桌面 76vw 面板；卡片维持 5:7.4 比例；状态按钮与卡片独立。除上述手机输出外，桌面截图为 1672×941。
- [逐页对照](../../../output/remaining-reference-20260913/index.html)

## 元素拆分与当前实现

- 实现入口：`src/application/screens/heroes.js`；统一材质由 `src/presentation/components.css` 消费，场景由 `EmberTheme` 的语义角色解析。
- 范围：逐张保留/替换、选择状态、确认换牌。
- 位图只承担场景、复杂材质、遗物和徽记；文字、数值、规则、选择状态与按钮保留实时 DOM；简单图案由 `EmberArt` 原生 SVG 提供。
- 新生成素材的提示词、源文件、格式、SHA-256 和 Alpha 实测见 [provenance.json](../../../assets/ui/page-reference-v1/provenance.json)。生成模型未由工具返回，记录为未核实；WebP 仅作格式封装。生成重建不等于无损分层。

## 页面动作

入口：选择英雄后进入。所有按钮沿用既有动作接口；测试中的状态夹具用于打开胜负、发现和奖励页面，不进入生产接口。

## 批注与迭代结论

排除了旧 absolute/margin/广泛选择器造成的覆盖；桌面卡牌维持同一图区比例和按规则长度变化的字号。横屏提示移出单位区域，敌方法力移到英雄旁。新增设置导航、模式按钮和契约槽位均绑定实际状态。

已知差异：参考包含与当前内容库不同的卡名、数值、配置与装饰性文案，实装显示当前真实内容；背景和复杂徽记为图像重建，纹理与边界不是原图逐像素复制；部分细边框、字形、按钮轮廓仍由现有主题及 SVG 重建。没有计算排除卡图后像素误差为零，不能将交互测试通过称为像素一致证明。

## 验证与交付

当前结果以 [本轮验证记录](../../../output/remaining-reference-20260913/VALIDATION.md) 为准。新增截图/交互脚本：`tests/e2e/remaining-reference.spec.cjs`。手机为 Chromium 触控模拟，无实体手机验收；未更新公开站点。

## 2026-09-13 细节打磨

卡牌使用独立透明金属边框，标题与数值继续实时绘制；确认按钮使用切角冰晶纹理。

复杂纹理由 image-gen 重建，简单图标与轮廓由原生 SVG/CSS 完成。生成图并非原图无损分层；具体透明通道限制见 [素材记录](../../../assets/ui/detail-polish-v1/provenance.json)。本次截图和检查见 [细节打磨记录](../../../output/detail-polish-20260913/VALIDATION.md)。

## 2026-09-13 磨砂青岩皮肤

`?skin=slate` 下改为浮层壳（1060）：标题「命运的第一手」26px/700 + 15px ink-2 副标 + 发丝线；三张牌面与网格完全不动，只把「保留 / 替换」状态标签换成药丸（替换 = 蓝色渐变填充，保留 = 深色药丸），hover 提亮；提示文字 15px ink-2 居中；底部发丝线 + 主药丸 260×52。规则见 [SLATE_DESIGN_SYSTEM.md](../SLATE_DESIGN_SYSTEM.md) §5.5，实现在 `src/presentation/skins/slate/dialogs.css`，截图见 `output/slate-dialogs-20260913/`。

已知差异：1280×720 在战场视图下 `mobile-view.js` 的 `compactDesktop` 判定会加上 `body.touch-layout`，皮肤按规则不生效，该尺寸仍是旧主题；桌面窄尺寸以 1360×768 验收。

## 2026-09-14 触控布局皮肤

`?skin=slate` + `body.touch-layout`：仍是浮层壳，外边距收到 12px（含安全区），壳内边距 18/16（横屏 12/16），
标题 22px（横屏 19px）+ 13px ink-2 副标 + 发丝线，底部发丝线 + 铺满宽度的主药丸（`panels.js` 会给页脚
加上 `.panel-actions`，`components.css` 把按钮卡在 `min(240px,100%)`，皮肤改回 `max-width: 100%`）。
网格沿用 `dialog-layout.css`：竖屏两列、短横屏一行，卡面与 5:7.4 比例不动。
「保留 / 替换」状态标签与桌面同一份药丸材质（替换 = 蓝色渐变 + `#8cc4ff99` 边 + 600 字重），
`components.css` 给替换卡额外画的选中环重新隐藏。

短横屏（横向、高 ≤ 430px）另外：隐藏副标与「你先手…」提示，并把 `--opening-width` 从
`(100dvh - 250px)/1.48` 改成 `(100dvh - 190px)/1.48`——那 250px 是按桌面壳的标题/页脚预算写的，
触控壳只花约 136px，所以同一块屏幕能给卡片更多宽度。这一条同时修掉了基线里 844×390 与 568×320
的「保留 / 替换」药丸被裁切 / 折成两行的问题（对照 `output/slate-integration-20260914/mobile-baseline/`）。

截图：`output/slate-mobile-battle-20260914/<尺寸>/mulligan.png` 与 `mulligan-replace.png`
（390×844、844×390、568×320、1024×768、1280×720）。桌面 1600×940 与四个触控尺寸的
`.mulligan-box` / `.mulligan-card` / `.mulligan-choice-state` / `#mulligan-confirm` 计算材质实测 0 差异。
