# 战场 3D 角色（体素风）

2026-09-24 用户在六种风格选型后确认体素风（参照 voxel-musou），取代 Q 版手办风。取舍理由：写实风格的脸、手和关节变形正好落在代码雕刻做不好的地方（恐怖谷），方块的抽象程度让这些问题消失，而且角色、特效、碎块能用同一种方块语言。本文件是约定，改数值先改本文件。

## 1. 风格规格（所有角色共用）

- **方块尺寸**：身体 1.25 cm，道具 0.75 cm。人形约 1 单位高 ≈ 80 格。所有角色用同一套方块尺寸，看起来属于同一个世界；不按角色改尺寸。
- **比例**：人形用 `chunky` 体型族（约 5 头身，宽肩、大手、大武器）。动物、怪物按卡面比例，头和标志性部位（角、翅膀、武器）可以放大 10–30% 以便在棋盘上辨认。
- **分段**：身体按骨骼分段体素化，每段方块沿骨骼方向排列，关节处互相重叠（可动人偶的关节）。头发、布料、披风在世界网格上平滑蒙皮，可以跨骨骼飘动。
- **颜色**：取自卡面，一个材质一个主色。方块亮度按材质抖动（布 ±3.5%，皮革 ±4.5%，毛发 ±6%，金属 ±2.5%，皮肤 ±1.3%）；头发每隔几列加一道亮色，毛皮随机深色簇。材质交界处：上方压暗 0.8 倍（压边阴影），下方提亮 1.08 倍（翻边高光）。
- **脸**：像素画，一格一个方块面。人形：上睫毛线 + 眼白 | 虹膜 | 外眼角（深色），眉毛在上方隔一行，鼻影 1 像素，嘴 2 像素。表情 `open / closed / fierce / hurt / focus`，按动作切换。动物：2×2 眼（上沿深色、虹膜、高光），或用发光材质的方块做眼（灵体、石像、亡灵）。脸部的鼻、唇、颧骨等小起伏不参与体素化（`feat: true`），脸保持平整、只靠像素画。
- **光与调色**：黄昏暖主光、冷紫天光、尘土色地面反光、桃色轮廓光；另有一道来自相机左上方的柔和补光，只提亮暗面。调色在材质里完成：冷影暖光分离、Lottes 曲线（斜率 2.0，场景 0.18 → 显示 0.18）、40 级色阶 + 2 像素有序抖动。发光部位（灵体纹路、符文、火焰、眼睛）用材质的 `emit`。
- **轮廓**：每个角色至少一个在棋盘尺寸（约 150 像素/单位）下能认出的特征：武器、角、翅膀、兜帽、盾牌或一块醒目的配色。

## 2. 动作

- 共享动作库 `EmberVoxelClips`：待机（呼吸、重心摆动）、攻击（由角色的 `moves.attack.clip` 选择）、受击、胜利。
- 出场：方块从地面跳回原位拼成角色（约 0.6 秒）。死亡：碎成自己的方块（见 §3）。
- 攻击的接触时刻 `moves.attack.hit`（秒）由舞台对齐到导演层的接触拍：接触前的部分按比例压缩或拉伸，接触后按原速播放。远程角色对齐的是出手（`lift`），因为弹道由 EmberFx2 从出手飞到接触。
- **近战角色离开令牌出手**：令牌留在原位（显示攻血），角色按导演层的时间线冲到目标——抬起 110 ms 在原位蓄势（动作自己的后撤）、冲出 150 ms 加速到出手点、顿帧期间停在出手点、回位 200 ms 跳回。出手点在目标的斜前方（从攻击方来的那一侧），距离 = 武器长度 × 角色大小 + 目标半宽，直线冲过去会让近处的角色挡住远处的角色（棋盘是低角度俯视，纵深在屏幕上很短）。
- **远程角色原地出手**：规划器通过 `EmberCombat.compile` 的 `figure` 钩子得知这张卡由体素角色出手，把出手时刻推迟 `moves.attack.windup`（默认 260 ms）留给拉弓、聚火、吸气；弹道仍按距离计算。
- 骨架不是人形或四足的角色（蜘蛛、鸟、有翼的龙……）在自己的文件里写 `pose(fig, clip, t, T, C)`，并用共享的 IK 与瞄准工具。

## 3. 打击感（战场）

沿用 voxel-musou 的做法，受 [BATTLE_PRESENTATION_V2.md](BATTLE_PRESENTATION_V2.md) 的因果与尺寸规则约束：

| 分量档 | 画面 |
|---|---|
| 1（≤ 2） | 刀光或冲撞、橙金色星爆 + 针状火花、受击方 1 帧白热轮廓 + 金色渐退、后仰 |
| 2（3–5） | 同上，星爆大一号，琥珀色受击光 |
| 3（≥ 6 / 致死 / 英雄受 ≥ 5） | 冰蓝星爆 + 突刺光束，受击方红色受击光；致死时挑飞并碎成方块 |

- **尺寸**：单体接触画面逐轴不超过目标棋子底座的 1.25 倍：星爆半径上限 0.32 × 棋盘尺寸（战场 0.4 单位 ≈ 60 像素），针状火花的速度是 voxel-musou 的 0.6 倍。
- **顿帧**：数值沿用 `EmberTiming` 各档；受击方最多停 3 帧就开始反应（后仰、挑飞），重量来自反应。
- **死亡拍（2026-09-24 用户确认）**：体素角色的死亡改为“碎成方块”，总长与现有死亡拍相同（约 0.52 秒）：接触后挑飞或原地、碎开、碎块弹一次并在死亡拍结束前沉入地面。碎块只属于死亡拍本身，不算残留；死亡拍结束后 250 毫秒内画面清空。
- 角色身上的效果（刀光、接触星爆、受击光、碎块、出场拼合）由体素舞台绘制，因为它们必须与角色处在同一个三维空间里；法术、弹道、全屏演出仍由 EmberFx2 负责。一个效果只由一处绘制。

## 4. 架构

```
presentation/voxel/
  sculpt.js      EmberSculpt   代码雕刻：带符号距离场图元（平滑并、减、包裹）
  voxelize.js    EmberVoxel    体素化：按骨骼分段、角落暗部、材质缝、像素脸网格
  kit.js         EmberVoxelKit 体型族、人形身体、服装与发束工具、道具、四足骨架、角色注册表
  figures/*.js                 每个角色一个文件：EmberVoxelKit.define(id, spec)
  render.js      EmberVoxelRender  烘焙缓存、蒙皮网格、体素材质（含调色与抖动）、像素脸
  baker.js       EmberVoxelBaker   在 Web Worker 里烘焙：用加载这条管线的同一批脚本（它们加载时自己登记）重建 worker，
                                   结果转移回页面放进烘焙缓存；worker 起不来时退回页面内烘焙（只在两次行动之间）
  clips.js       EmberVoxelClips   共享动作库
  hitfeel.js     EmberVoxelFx      打击感粒子（voxel-musou 移植）：刀光、星爆、针状火花、碎块、拼合
  arena.js       EmberVoxelArena   角色的全部行为，不依赖页面：烘焙队列、拼合出场、待机朝向、近战冲刺、
                                   受击光与顿帧、接触星爆、挑飞碎裂；页面只回答“某个单位站在哪”
  hero.js        EmberHeroFigure   英雄头像板上的英雄角色（独立小画布）
  stage.js       EmberMiniatures   战场适配：一张透明画布、相机（150 像素/单位、俯角 30°），令牌 → 单位，
                                   导演层的提示 → arena；角色在棋盘上是 spec.scale × 1.25
tools/voxel-gallery/               体素角色馆：同一个 arena 驱动的独立页面（全员 / 单人 / 对战，带合成音效）
```

- 三维库只有 `src/vendor/vesper-three.js`（全局 `EmberVesperThree`）一份。
- 体素化在运行时进行，每个角色约 0.1–0.3 秒（英雄更重），按角色缓存，**在 worker 里做，不占主线程**；新角色的着色器用 `compileAsync` 并行编译完才出场；出场（拼合）只在两次行动之间开始，所以战斗序列里不会有角色突然出现或卡帧。棋子第一次上场时先显示平面令牌，烘焙完成后用“拼合”出场。
- 角色永远不改变规则状态；卡名、费用、攻血仍是 DOM。令牌在角色站上去时把原画压暗成底座（`.miniature-ready`）。
- 与导演层的接口（`src/effects.js`、`src/presentation/combat.js`）：`EmberMiniatures.plan(side, uid)` 供规划器决定近战 / 远程与前摇；`cue(attack | death)`、`contact(ref, {tier, from, direction})` 在对应的拍上调用；`owns(side, uid, melee)` 告诉导演层这一击由角色负责，导演层就不再做 DOM 突进、fx2 近战特效与 demise。详见 [BATTLE_PRESENTATION_V2.md](BATTLE_PRESENTATION_V2.md) R13。
- 手机与“减少动态效果”下不启用，任何失败退回平面令牌。

### 角色文件

```js
EmberVoxelKit.define("golem", (() => {
  const K = EmberVoxelKit, { S, Sculpture, mats, CLS, ... } = K;
  function build(fam) {           // → { sc, kind, props, P? (人形体型), G? (四足骨架) }
    const sc = new Sculpture();
    ...
    return { sc, kind: "humanoid", props: [] };
  }
  return {
    cards: ["golem"],             // 使用这个角色的卡牌 id（英雄写 "hero:<heroId>"）
    kind: "humanoid",             // humanoid | quadruped | 自定义
    build,
    scale: 1.15,                  // 棋盘上相对大小
    face: { kind: "human", look: { eye, brow, lash, lip, skinD } },   // 可选：像素脸
    moves: { attack: { clip: "slam", hit: 0.42, length: 1.2, style: "blunt" } },
    pose(fig, clip, t, T, C) { ... },   // 可选：自定义动作；返回 undefined 则用共享动作
  };
})());
```

- 材质：`mats(sc, { name: { c: 0xRRGGBB, cls: CLS.xxx, rough, metal, emit, vary, pattern } })`，`CLS` 决定抖动与像素图案（cloth, skin, hair, leather, metal, fur, glow, wood, lips, eye, plant）。
- 细件（角、爪、骨头、法杖）：在图元上加 `vdil: 0.5`，保证至少一格厚。
- 脸部小起伏：在图元上加 `feat: true`，体素化时跳过。
- `moves.attack.style`：`slash`（弧形刀光）· `thrust`（突刺光束）· `blunt`（钝击：星爆 + 冲击环）· `bite`（咬）· `breath`（吐息）· `bolt`（法术弹）· `arrow`（箭）。武器刀光在 `moves.attack.trail = { prop | bone, from, to }` 里给出武器边缘在道具或骨骼局部坐标里的两端。

## 5. 性能预算

- 每个角色可见方块 ≤ 12000，三角面 ≤ 45000；道具另计 ≤ 2000 方块。
- 同屏 16 个角色 + 特效时，舞台每帧 JS ≤ 2 毫秒（桌面）。

## 6. 制作流程（新角色）

1. 对照卡面（`assets/anime/<card>.webp`）定剪影、配色和一个棋盘上可辨认的特征。
2. 在 `presentation/voxel/figures/<id>.js` 写雕刻配方与动作。
3. 用工作台出检查图（四视角、脸、攻击四帧、受击、棋盘尺寸、卡面对照），迭代到满意。
4. 在 `config/build.json` 与 `src/template.html` 注册角色文件（放在 `VOXEL_KIT` 之后、`VOXEL_RENDER` 之前）；`tests/voxel-figures.test.cjs` 检查注册、卡牌映射、攻击声明与体素预算。
5. `python3 tools/voxel-gallery/build.py` 重建角色馆，在里面试动作与对战。

## 7. 阶段

1. 体素风选型（完成，选型画布）。
2. 试点：薇丝珀（英雄）、荒野之矛、月影幼狼、暮角契鹿，外加 8 个不同类型的新角色（铁誓卫士、骸骨、引火学徒、烬翼斥候、符文石像、古木守护者、烬喉幼龙、幽谷蛛后）；接入战场与打击感；角色馆。
3. 按职业批量制作其余卡牌。
