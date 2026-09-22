# 桌面战斗 / battle-desktop

## 当前实现 · 2026-09-20 法师战场站位

法师从左下头像区移入战场左下的原神契区域，人物放大、朝右并保留侧脸；神契下移到左下辅助区。英雄命中区域随人物移动，姓名、生命、技能保持实时 DOM。用户当前窄桌面窗口走 compact-desktop，与宽桌面分别验收。

素材使用已有 Tripo 法师，不重做原画或动作。几何归属为 `src/presentation/skins/slate/hero-model.css` 与现有响应式布局模块，朝向归属 `src/presentation/hero-model.js`。本轮参考与最终验收见 `output/hero-stage-20260920/`；下方较早记录不作为本轮验收结果。

## 当前实现 · 2026-09-13 轻量战场控件

战斗记录与首领情报弹层现接入 [共享 SVG 四角面板](../SHARED_PANELS.md)，与菜单和参数面板保持同一材质及内边距；战场 HUD 和游戏卡牌不额外套框。

本轮依据用户提供的三张王者荣耀万象棋截图，参考图标文字入口、细线按钮与信息留白；保留当前银蓝卡牌和六处 Boss 俯视场景，不复制截图中的玩法、角色或文案。

- 回合信息置顶居中；工具入口集中于顶部。敌方英雄靠左上，我方英雄靠左下，技能与契约位于右上，结束回合与法力位于右下。
- 双方英雄现在使用与手牌相同的卡面宽度和 `5:7.4` 比例，完整使用角色原画、半包围铭牌与实时 DOM 文本；法力、攻击、生命、护甲（有值时）均直接复用卡牌的 `badgeFrame` 徽章，不再保留英雄专用的圆形数值图标。
- 辅助入口采用图标、文字与细线；技能采用图标文字，结束回合使用轻量圆角边框，取消原玻璃金属纹理。点击、悬停、禁用和可结束状态采用共享主题令牌。
- 操作指令在中央上方预留区显示，桌面同样提供可点击的「取消」。错误信息暂时替换指令，结束后恢复；不再把通知贴在卡牌、英雄或目标上。
- 1600×940 为桌面逻辑画布。宽度低于 1360px 或高度低于 700px 的鼠标战场采用独立紧凑布局；触控继续使用实际 CSS 像素。取消按钮在缩放后仍至少 44px。
- 用户追加要求：卡牌恢复本轮开始时的设计和排版，不重构卡牌。手牌原有尺寸、比例、排列、字号及桌面两排随从位置均保留；边框、插画和规则区不参与重新设计。对照实测见 [卡牌样式比对](../../../output/battle-layout-20260913/card-preservation.json)。
- 牌面、规则、费用、攻血和公开契约进度仍来自实时 DOM 与当前游戏数据。

## 源码归属与清理

`src/presentation/battle.css` 管理控件结构和桌面/响应式几何；`src/mobile-view.js` 管理原生小屏坐标和单位命中；`src/presentation/components.css` 管理共享材质、英雄卡面与状态。双方英雄的宽度由 `--battle-card-w` 与手牌几何共同决定，避免跨尺寸出现两套卡宽。移除或收窄 429 处旧控件规则，相关控件不再由历史 CSS 文件竞争覆盖。

`premium.css` 仅保留必要牌面与数字几何，删除旧胡桃木/古金材质声明；旧纸木地图、圆形按钮和山谷建筑包不再进入当前构建引用。画廊改为六处当前战场。旧原图保留在源目录供历史追溯，不是运行时回退。

## 验证与入口

入口：主页「战斗试玩」或正式冒险开局。实装对照与本轮测试记录：[控件布局验证](../../../output/battle-layout-20260913/VALIDATION.md)、[截图对照](../../../output/battle-layout-20260913/index.html)。手机测试为 Chromium 触控模拟，未发布。

## 历史素材记录

此前纹理按钮和左右分散英雄的方案已被本轮替代。原素材来源保留在 细节素材记录（该素材记录已随 2026-09-14 旧主题移除删除）；场景制作见 [六处俯视场景](../../../output/boss-topdown-20260913/RESEARCH.md)。上述历史验收不能代替当前截图与检查。

## 2026-09-13 磨砂青岩皮肤

`?skin=slate` 下的桌面战场 HUD 按 [设计系统](../SLATE_DESIGN_SYSTEM.md) §5.4 重做，实现只在
`src/presentation/skins/slate/battle.css`，全部规则以 `html[data-skin="slate"] body:not(.touch-layout)`
开头，不用 `!important`，不新增位图，不改规则层、存档与卡牌映射。首领场景、随从牌面、手牌、
费用/攻血徽章、法力晶体、目标线与全部动画保持原样；`.card-preview` 悬停放大未改。

- 顶栏（仅 `#app.battle-view`）：字标改 20px/700 + `EMBERFALL` 10px 字距 3px；`.top-actions .icon-btn`
  改 36px 圆形药丸；回合文字 `.turn-number` 收成居中深色芯片（`left:50%` + `width:max-content`）。
- 英雄：`.hero` 改 10px 圆角 + 1.5px `--slate-card-line` 描边卡；半包围铭牌 `.hero-card-plaque` 隐藏，
  `.hero-name` 改深色药丸并保留 17.8% 对称内缩（`ui-alignment.spec.cjs` 的居中断言仍成立）；
  攻血/法力/护甲徽章不动。
- 右栏：`#power-btn` 改 56px 发光节点（与 `settings.css` 选中节点同一径向渐变）+ 名称/费用连体芯片；
  `#contract-open` 改深色药丸芯片；`.enemy-deck` / `.player-deck` 改「图标 + 数字 + 说明」药丸。
- `#log-toggle` / `#intel-toggle` 改带图标的深色药丸；`.log-panel` / `.boss-panel` 改浮层壳
  （12px 圆角、磨砂材质、发丝线分节、隐藏 `panels.js` 的四角 SVG、高度随内容）；
  `.battle-log` 改自上而下的发丝线清单（去掉旧的底部对齐 flex 与渐隐遮罩）。
- `#end-turn` 主药丸 160×56（渐变画在 `::before`），`.turn-shortcut` 12px ink-3；法力标签改黑体，
  晶体不动；`#board-empty` 改黑体 ink-3。
- `#combat-preview` `#action-status` `#hint` `#toast` `#touch-target-bar` 统一为最大 520px、16px、
  居中的深色药丸提示条，同一时刻只显示一种的既有行为不变。`#toast` 的 `left/width` 由
  `ui.js positionBattleNotice()` 写成内联样式（内联样式优先于层叠层），因此用 `max-width` 收窄、
  用 `margin-left` 重新居中。

命中区：`#battle` 是被 `--scale` 缩放的 1600×940 逻辑画布，指令芯片加了
`--slate-battle-hit: max(44px, calc(44px / var(--scale,1)))` 下限，结束回合、英雄技能、两个工具页签、
取消在 1672×941 / 1600×940 / 1440×900 / 1360×768 实测均 ≥ 44 设备像素。这四个控件的
`background-image` 必须保持 `none`（`action-feedback.spec.cjs` 的 `texture:` 断言），发光一律画在伪元素上。

已知边界：`src/mobile-view.js` 在战场视图下把 `rawW < 1360 || rawH < 700` 判为 `compactDesktop` 并打开
`body.touch-layout`，所以 1280×720 的战场不走本皮肤，属于设计系统 §5.7 手机第二阶段。
简报要求的敌方契约进度 `◆ 0/5`（`#enemy-mana`）已在提交 `39ac031` 删除，当前敌方法力是头像内的
`.hero-mana` 徽章，没有可改的 DOM。截图、命中区实测与原主题对照见
[磨砂青岩战场输出](../../../output/slate-battle-20260913/README.md)。
