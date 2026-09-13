# 手机竖屏战斗 / battle-portrait

## 当前实现 · 2026-09-13

敌方英雄与简洁的首领名、契约入口位于上方；两排随从居中；回合信息居中置顶，我方英雄、技能与主要操作处于手牌上方。双方英雄沿用手牌的卡宽和 `5:7.4` 比例，法力、攻击、生命、护甲（有值时）共用卡牌徽章，数值始终保留为实时 DOM。小竖屏进一步压缩上方资料区，把高度让给随从，保留原有卡牌尺寸和横向浏览手牌的排版，不重构牌面。法力改为简洁数字，取消手牌旁密集的水晶底板；窄于 430px 时操作提示停靠右侧留白，避免遮挡我方英雄。

指令与错误消息使用战场上方预留区域，不覆盖角色或手牌；取消按钮至少 44px，完整操作提示可见。控件与桌面共享银蓝材质和状态，不再加载旧的纹理按钮。缩放和旋转裁切同一张 Boss 场景，不更换场景身份、不重启对局。

几何由 `src/mobile-view.js` 与 `src/presentation/battle.css` 统一负责；材质位于 `src/presentation/components.css`。清理范围、桌面关联与历史来源见 [桌面档案](battle-desktop.md)。

## 验证与入口

入口：手机尺寸下主页「战斗试玩」或正常开局。覆盖点牌、拖牌、合法目标、取消、长按与旋转状态保持。具体命令和结果见 [本轮验证](../../../output/battle-layout-20260913/VALIDATION.md)，实装见 [截图对照](../../../output/battle-layout-20260913/index.html)。手机为 Chromium 触控模拟，未声称实体手机验收；未发布。

此前 concepts 与纹理控件实装为历史方案，不能代替本轮验收。场景仍采用 [六处俯视战场](../../../assets/scenes/boss-topdown-v1/generation.json)。

## 2026-09-14 触控布局皮肤

`?skin=slate` 下竖屏战场只换 HUD 外壳，几何仍由 `src/mobile-view.js` 的内联盒子决定（皮肤不碰
`left/top/width/height`）。顶栏：文字字标 17px/700 + 发丝线分隔，图标按钮改 36px 圆形深色药丸（重新声明
`#fullscreen-btn` / `#touch-collection` 的 `display: none`，否则皮肤的 `display: grid` 会把它们复活）；
回合信息进居中深色药丸。首领名 `#touch-match-chip` 与「诸神契约」入口改深色药丸芯片；双方英雄改
10px 圆角 1.5px 描边卡（内框 3px/7px，名牌改药丸，`.hero-card-plaque` 隐藏），法力/攻击/生命/护甲徽章
与牌面完全不动。技能改发光节点（径向渐变写成半径百分比，随 48px 的盒子自适应）+ 深色圆形费用徽章 +
ink-3 名称；「结束回合」改蓝色主药丸（渐变画在 `::before`，控件本身 `background-image: none`，满足
`action-feedback.spec.cjs`）；法力数字改白色粗体，手牌标签改深色药丸；`#hint` / `#toast` /
`#combat-preview` / `#action-status` / `#touch-target-bar` 统一为深色药丸条，取消按钮 ≥56×44。
起手换牌 / 结算 / 奖励 / 发现 / 战术底板见 [mulligan](mulligan.md)、[result](result.md)、[rewards](rewards.md)。

实现只在 `src/presentation/skins/slate/mobile.css`；材质逐条抄自 `battle.css`，桌面 1600×940 与
390×844 / 844×390 / 568×320 / 1024×768 的计算材质实测 0 差异。截图与已知差异见
`output/slate-mobile-battle-20260914/`。

已知差异：技能节点是 48px 而非简报的 56px，`手牌 N` 芯片会压住我方英雄卡底边，牌库计数在触控下隐藏——
三者都源自 `mobile-view.js` 的内联几何，超出皮肤范围。
