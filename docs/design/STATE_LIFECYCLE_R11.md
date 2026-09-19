# R11 — 状态、规则事件和战斗收尾

基于 `feat/full-vfx-remaster` 的 R10.1 `58d604a894ec818e4b4b7c5f552dd987981e192b`。
这是事件演出的补齐，不是新规则，也不是重新制作全游戏界面。

## 本轮 22 个命名事件配方

状态类：圣盾破碎、解冻、进入潜行、攻击显形、沉默封印、变形过渡、复生、临时增益到期、护甲承击。
规则类：奥秘揭示、法术反制、武器装备、武器损坏、爆牌焚毁、疲劳、能力触发。
流程类：回合蓄能、英雄致命受击、胜利、失败、首领阶段觉醒、抽牌落手。

这些是独立事件配方，共享几何、粒子和材质基础；不宣称22个全新角色模型，
也不等于给每张卡的每项被动制作专属长动画。
既有抽牌飞行、出牌、发现选择、手牌布局、战役地图、奖励弹窗和菜单导航继续沿用原实现。

## 触发契约

- 只在原导演层到达该规则事件的表现时刻后发出。获得圣盾与圣盾损失分开，
  冰冻获得继续使用已认可效果，解冻只由 `thaw` 事件发出。
- `lifecycle-arts.js` 是纯 `sample(descriptor,time)`；没有计时器、DOM、随机每帧或规则写入。
- 所有新cue带 `visualOnly`、`lifecycle`、`sequenceId`，不进入主要攻击trace。
- 同一事件/类型/目标去重。多次合法疲劳伤害按各自事件执行，演出不再次扣血。
- 常规回放仅拼接同一 `sequenceId` 的生命周期cue，防止下一轮抽牌进入上一击。
  `lastGroup` 保留原攻击组语义，`replayGroup` 才是包含附加cue的可视组。
- 新cue不延长规则输入锁。降低动态时不生成额外cue；低画质减少次级粒子，保留结构。
- 原规则、卡池、时序、喷火、R8标杆、Renderer与已批准基线保持完整哈希一致。

## 视觉方法

盾面从接触点向外分离；冰壳碎片下坠；潜行采用收拢/散开的影线。
沉默把符印合拢并熄灭；变形由旧卡面扫除显露新卡面，保留原UI数值。
复生用向上汇聚的魂光而非普通召唤爆发；武器损坏使用分离刃片；
爆牌从牌库锚点呈现焚烧边界；反制用阻断形状和奥秘来源联系；
回合/抽牌等高频反馈克制，不使用全屏闪烁。

变形和玩家爆牌使用不可交互的旧原画覆盖层，无文字/血量烘焙；
敌方爆牌不会显示隐藏卡牌的原画。暂停、取消、低动态和WebGL上下文丢失都会清理覆盖层。
声音复用已有规则事件音效，不新增22套独立音效；状态检查回放保持静音。

## 工具与回放边界

`lifecycle-fixtures.js` 和 `lifecycle-lab.js` 仅加入导出的检查版。
场景按钮先执行一次真实规则动作，并与独立纯规则引擎比较完整结果；之后只重绘。
临时设置如护盾、低血量、空牌库仅用于检查fixture，不修改卡牌定义和正式对局存档。
普通攻击的冰冻/血量回放继续使用R10.1只读投影；本轮不能被称为完整对局回放引擎：
手牌、死亡/复生的DOM成员不倒放，只展示该事件后的对象和特效。
胜负演出检查时按回放时间暂时隐藏/恢复结果弹窗，真实出招和生产弹窗流程不改。

## 构建和检查

```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify_lifecycle.py
xvfb-run -a python3 tools/vfx3/verify_freeze_order.py
xvfb-run -a python3 tools/vfx3/verify_benchmarks.py
xvfb-run -a python3 tools/vfx3/verify_remaster.py
xvfb-run -a python3 tools/vfx3/record_lifecycle.py
python3 tools/vfx3/assemble_lifecycle.py
```

录像为实际程序在24fps时间点的确定性采样，没有生成式图片替代，音轨为空。
截图裁切等比放大，没有增强曝光/调色。编码24fps不等于实测硬件帧率。
浏览器为Xvfb/Chromium/ANGLE/Mesa软件渲染和内存加载。未进行实体手机、Safari、
真实HTTP/file来源存档、全量E2E或性能压力认证。自动化测试不等同于美术品质认证。
