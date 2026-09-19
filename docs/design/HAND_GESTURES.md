# 触屏出牌手势与详情层

## 当前交互（2026-09-19）

- 手机手牌保持完整卡宽，间隔 8px，不再扇形重叠；容纳不下时使用浏览器原生横向滚动。少量能完整放下的牌仍支持拨牌选择。
- 滚动栏中的卡牌保持 `touch-action: pan-x`；展开卡牌是独立可交互节点 `#hand-card-lift`，使用 `touch-action: none` 接续拖动。滑动原手牌栏会收起展开状态。
- 点按任何手牌都会完整展开。不能出的牌只阅读并在顶栏说明原因；可出的牌同时准备出牌 / 瞄准，再点击战场空位或合法目标确认。上拖释放可以直接出牌，静止长按可用手牌仍是扶起拖动。
- 再点展开的牌、顶栏取消、Esc 或右键手牌收起。阅读状态独立于合法动作，不消耗法力。正文不使用省略号，根据实际行数分配空间；卡名、费用和攻血始终保留。
- 竖屏通知位于导航下专用一行；横屏和桌面通知替换顶栏回合标签。错误短消息暂时替换当前操作说明，消息结束后恢复说明。
- 旋转与滑动不修改对局状态。桌面沿用相同展开机制。
- 回归见 `tests/e2e/hand-reading.spec.cjs`、`tests/e2e/mobile-hand-layout.spec.cjs`、`hand-drag.spec.cjs`、`card-reading.spec.cjs`、`ui-viewport-switch.spec.cjs`。

以下保留早期设计记录；涉及重叠扇形、24px 阈值、手动滚动、点按直接出牌和长按手牌详情的描述已由上述交互替代。

## 早期设计记录

本记录说明 v0.14 之后统一后的出牌交互：一次手势完成出牌，查看与出牌彻底分离。
实现位于 `src/ui.js`（手势与结算）、`src/mobile-ui.js`（触摸长按与点击抑制）、
`src/refinement.css`（详情层与瞄准反馈）、`src/mobile.css`（手牌横向滚动归属）、
`src/presentation/skins/slate/console.css`（手牌坞与拨牌反馈）。

## 最终模型

| 手势 | 结果 |
| --- | --- |
| 拖出手牌并松在战场空位 | 无目标牌立即打出；需要目标的牌进入瞄准 |
| 拖动需要目标的牌 | 合法目标呼吸高亮，指针下的目标出现 `aim-focus` 描边，瞄准线跟随手指 / 鼠标 |
| 松在合法目标上 | 结算该目标 |
| 松在非法单位上 | 拒绝并提示，卡牌回手，法力不变 |
| 松回手牌或战场外 | 取消，提示"已取消"，法力不变 |
| 点按手牌 | 无目标牌直接打出；有目标牌进入瞄准，再点目标确认 |
| 横向拨牌（触屏，`#hand.hand-fits`） | 手指扫过手牌坞，指下那张**整张升出坞外并回正到 0°**（`.peek`，位姿与选中态一致）；松手等同点按该卡（`EmberMobile.handClick` → 选中 / 瞄准）。手指移出坞的有效范围则该卡回落，不选中 |
| 鼠标悬停（任意布局，`body.pointer-fine`） | 与拨牌等价：指针下那张同样升出坞外。悬停规则由**输入**（`pointer-fine` / `pointer-coarse`）决定，不再由 `touch-layout` 决定，所以小窗口的鼠标用户也有 hover |
| 横向滑动（触屏，`#hand.hand-pan`） | 手牌过多、步进 <24px 时坞退回浏览器原生横滑，不拨牌 |
| 右键 / Esc / 取消按钮 | 退出瞄准 |
| 悬停、右键（桌面）或长按（手机） | 放大该卡到屏幕中央，无外框；点击任意位置收起 |

设计取舍：

- **点击不等于出牌**，只在无目标时是快捷出牌；有目标时点击只进入瞄准，避免误消耗法力。
- **拖拽释放是确认动作**（对齐实体卡牌与炉石的直接操控），因此非法释放一律回手。
- **查看不参与决策**：详情层用同一个 `#card-preview` 元素承载悬停与长按两种模式，
  手机上不再有"详情卡 → 打出按钮 → 选目标"的中间步骤。
- **拨牌代替"横滑什么也不做"**：坞装得下全部手牌时（`.hand-fits`）横向手势没有滚动
  可做，于是用来扫过扇形；抬起是选中前的中间反馈（设计文档 §4.3 / §5 的 armed
  前置）。上拖仍是出牌，静止长按仍是详情，三者互不抢手势。
  实现：`src/ui.js` 的 `riffle`，样式 `src/presentation/skins/slate/console.css` §3。
- **按输入而不是按布局给悬停**（2026-09-14 第三轮，设计文档 §12.2）：`mobile-view.js`
  用 `matchMedia("(hover: hover) and (pointer: fine)")` 写 `body.pointer-fine` /
  `body.pointer-coarse` 并监听其变化。触屏的拨牌与鼠标的 hover 现在是**同一个位姿**
  ——整张卡升出坞外、旋转归零、1.0 缩放——因为两者要回答同一个问题（"这张是什么"）。
  抬起 12px 的旧反馈不够：卡在坞里只露 66%，抬 12px 仍读不到规则文字。
- **扇形与触感**（第三轮，设计文档 §13.5）：`.hand-fits` 的卡按其在手牌中的归一化
  位置带 ±3° 旋转与 2px 弧度（`ui.js` 写进 `--r` / `--y`），拨牌 / 悬停抬起时归零。
  拨牌换卡 `navigator.vibrate(5)`、合法落位 `vibrate(12)`；项目没有独立的触感开关，
  因此跟随「减少动态效果」——要求减少动态的玩家不会想要更多震动。
  **注意**：旋转会让 `getBoundingClientRect()` 报出轴对齐外框，比卡本身宽
  `height×sin(3°)`。`mobile-view.js` 的 `handCardAnchor` 因此把横向容差放宽到
  `ceil(height×0.06)+1`，否则抽牌飞行会把扇形两端的卡误判成 clipped 而整个跳过。
- 手牌的横向滚动由控制器接管（卡片 `touch-action: none` + 手动 `scrollLeft`），
  因为浏览器在 `pan-x` 下会把竖向拖动判定为页面滚动并发出 `pointercancel`。

## 命中测试

落点判定使用 `unitAt()`，它遍历 `elementsFromPoint` 并跳过遮罩层（例如详情层背后
的 `body.has-card-detail:after` 幕布），保证"松在目标上"永远解析到真正的单位。

## 验收

`tests/e2e/hand-drag.spec.cjs` 在 390×844 与 844×390 两种朝向下各跑 8 项：
拖拽打出、拖拽进入瞄准、瞄准跟随并结算、非法释放拒绝、拖回取消、点按出牌 /
进入瞄准、长按放大并可点击收起、满手牌横向滚动。截图输出到 `artifacts/qa/`。

回归：`node --test tests/*.test.cjs` 全部通过；`game.spec.cjs` 的"触屏确认与旋转"
用例改用真实的 650ms 长按（`touchscreen.tap` 过快，不会触发长按判定）。

已知与本改动无关的既有失败（在未包含本改动的基线上同样失败）：
`premium numeric glyph containment 320x568 / 568x320`、
`shared desktop and touch materials, readable lobby, single card aperture`、
`desktop dialogs use semantic dimensions`、`fixed touch controls avoid orphan pages`、
`polished entry, fixed actions and independent battle controls`、
`a second mage and sixth boss work through production screens`。它们来自工作区里
未提交的美术 / 布局改动。
