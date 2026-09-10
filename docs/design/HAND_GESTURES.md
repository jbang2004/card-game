# 触屏出牌手势与详情层

本记录说明 v0.14 之后统一后的出牌交互：一次手势完成出牌，查看与出牌彻底分离。
实现位于 `src/ui.js`（手势与结算）、`src/mobile-ui.js`（触摸长按与点击抑制）、
`src/refinement.css`（详情层与瞄准反馈）、`src/mobile.css`（手牌横向滚动归属）。

## 最终模型

| 手势 | 结果 |
| --- | --- |
| 拖出手牌并松在战场空位 | 无目标牌立即打出；需要目标的牌进入瞄准 |
| 拖动需要目标的牌 | 合法目标呼吸高亮，指针下的目标出现 `aim-focus` 描边，瞄准线跟随手指 / 鼠标 |
| 松在合法目标上 | 结算该目标 |
| 松在非法单位上 | 拒绝并提示，卡牌回手，法力不变 |
| 松回手牌或战场外 | 取消，提示"已取消"，法力不变 |
| 点按手牌 | 无目标牌直接打出；有目标牌进入瞄准，再点目标确认 |
| 右键 / Esc / 取消按钮 | 退出瞄准 |
| 悬停、右键（桌面）或长按（手机） | 放大该卡到屏幕中央，无外框；点击任意位置收起 |

设计取舍：

- **点击不等于出牌**，只在无目标时是快捷出牌；有目标时点击只进入瞄准，避免误消耗法力。
- **拖拽释放是确认动作**（对齐实体卡牌与炉石的直接操控），因此非法释放一律回手。
- **查看不参与决策**：详情层用同一个 `#card-preview` 元素承载悬停与长按两种模式，
  手机上不再有"详情卡 → 打出按钮 → 选目标"的中间步骤。
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
