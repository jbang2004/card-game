# v0.11 架构

## 依赖与职责

```text
content/cards.js ───────┐
content/campaign.js ────┼→ data.js（校验、派生文案、冻结）
rules/effects.js ───────┘              ↓
                                  engine.js
                         ↙          ↓           ↘
                    rules/ai    rules/state   rules/preview
                                      ↓
ui.js（流程、输入、动画协调） ← 快照与因果事件
   ├─ application/library.js（收藏、组牌）
   ├─ platform/storage.js（浏览器存储）
   ├─ presentation/cards.js（卡牌 DOM）
   ├─ effects.js（Canvas 演出）→ atelier-world.js（唯一场景）
   └─ mobile-ui.js / mobile-view.js（触屏与视口）
```

`data.js` 是内容组合入口，不再包含位置数组或执行代码。`Game` 接收内容目录，规则模块不访问 DOM、浏览器存储、动画或网络。AI 从当前己方手牌与公开棋盘选行动，不读取对方手牌内容或牌库顺序。

## 单一规则路径

卡牌使用 `onPlay` / `onDeath` 效果数组；英雄技能、首领阶段和遗物也使用同一注册表。伤害、治疗、召唤、冻结、抽牌、增益等是具名操作；不再有 `heal4`、`skeletons`、`wolves` 等把参数藏在效果名字里的专用分支。

`rules/effects.js` 为每种操作定义允许字段、必填字段、执行与文案。未知操作或拼错字段明确报错。`data.js` 校验卡牌 ID、属性、引用与技能，生成描述后深度冻结。特殊行为作为具名操作进入注册表，不绕过引擎直接写 UI。

AI 是独立的参数化启发式策略。其取舍会与旧版略有不同，不承诺复刻旧 AI 的所有行动；规则结果通过旧版行为样本单独对照。演出从效果结构取得表现分类，不再维护旧效果名称列表。

## 动作、结算与事件

应用和 AI 通过 `dispatch({type, side, uid, target, ...})` 提交动作。保留纯引擎的低层方法供内部结算和 Node 测试使用，不暴露给生产页面。

每次成功分派在完整结算后通知一次，事件携带 `id` / `parentId`，动作、效果、亡语和奥秘触发产生配对的块。事件和通知快照冻结，动画不持有可写规则状态。无效动作不花费资源、不发布事件。

结算仍遵循当前游戏规则：效果列表顺序执行，同一群体效果选取一批目标；一次出牌完成效果后清理死亡。死亡先释放场位，再按实体序号处理亡语和复生；之后检查胜负与首领阶段。没有为未来玩法引入未经验证的通用事件总线或异步规则队列。

`modifiers` 记录增益来源及 permanent/turn 期限；当前支持永久攻血和本回合攻击增益。攻击/生命仍是权威运行时数值，`tempAtk` 保留 v1 语义。回合结束移除临时攻击记录，沉默/变形清空增益。尚未实现光环、任意层叠覆盖、墓地复活等新玩法，不把记录增益来源称为完整光环系统。

## 预览与状态边界

`rules/preview.js` 只返回已知的立即结果，伤害计算复用引擎 `damageResult()`。不调用 RNG；复杂组合没有预览时返回空，对英雄攻击存在奥秘时显示不确定性，不提前揭示内容。不会用完整状态模拟泄露隐藏结果。

生产 `Emberfall.game` 只提供深度冻结的状态快照、目标/费用/合法性查询和预览。`ui.js` 内部保留引擎所有权；示范局和奖励抽取也由引擎方法生成，视图不自行编辑对局。

`rules/state.js` 校验 v1 存档，`platform/storage.js` 独立处理 JSON 与不可用存储。保留：

- `emberfall.v1`
- `emberfall.deck.v1`
- `emberfall.settings.v1`
- `emberfall.world.v1`

旧存档无 `modifiers` 也可原样恢复；新记录是可选 v1 元数据，不重新计算或覆盖旧数值。没有删除 ID、改变实体编号分配或改变阶段索引。测试以真实旧版 fixture 验证浏览器跨刷新恢复。

## 唯一表现与素材路径

`atelier-world.js` 是桌面、手机共用的 Canvas 场景，无代理层，无 WebGL/CDN 加载。旧 Three.js、TavernWorld、MobileWorld、程序化卡图及未使用的兼容素材缓存已删除。

`art.js` 只有 `card` / `character` / `relic` / `icon` 四种明确接口，启动时校验所有图片。角色通过 `portraitId` 指定图像，卡牌与首领同名不会再依赖 palette 猜路由。`atelier-art.js` 仅负责裁切焦点。接口不再被后续脚本覆盖。

`application/library.js` 拥有组牌草稿和过滤器，应用只注入导航、存储、牌组校验和预览回调。界面其余流程仍在 `ui.js`，没有为拆文件而引入框架。

CSS 的四层约定继续有效。现有基础样式仍承载弹窗、触屏和布局；清理了旧帧图绑定，没有将所有历史 CSS 粗暴移除。原始美术输入与历史 QA 文档仅留档，不作为另一套可执行游戏加载。

## 构建与验证

`config/build.json` 和模板明确模块加载顺序，构建检查占位符。单文件与网页来自同一份源码；网页图片按内容哈希去重。构建只清理上次 manifest 登记的输出，避免移除源码或用户文件。

统一入口 `npm run test:release`：构建、Node 规则/素材/架构测试、Playwright。原 Python 内存页面回归已退役。历史文件哈希检查不再阻止合法改卡；`tests/fixtures/card-behavior-v1.json` 保留迁移前 56 张卡在固定局面的行为，而不保留可执行旧引擎。

新增机制需增加其行为、顺序、状态与必要 UI 回归。改变预期玩法时应审查行为 fixture，而不是自动覆盖所有预期来让测试变绿。

## 战斗演出增强（2026-09-07）

`effects.js` 继续作为唯一战斗演出所有者：读取结算事件与快照，按学派绘制召唤法阵，并为传说随从增加短暂铭牌和落场弹性。回合旗帜从 `turn` 事件创建，按实际两排随从之间的空间使用普通或紧凑尺寸；下一次表现更新即移除过时旗帜。已删除旧 UI 回合横幅入口、分散样式与 CSS 召唤动画，避免同一事件双重演出。

所有 Web Animations API 动画通过统一 helper 登记，完成、取消、视口变化与退出时释放；临时 DOM 和 Canvas 效果仍使用同一生命周期。视觉尾段不延长原有输入锁，也不写入规则状态。减少动态模式在粒子入口直接拒绝装饰性绘制；低画质／触屏／桌面同时存活的 Canvas 项上限分别为 220／360／800。没有新增运行依赖、图像素材或存档字段。

`presentation/components.css` 使用同一套配色，圣盾、冻结、可攻击边框仅由既有只读状态类决定。新增的 `unit-aura` 不接收输入；费用、攻血和文字仍为 DOM。可出牌的卡框有缓慢扫光，减少动态或低画质时关闭。

`tests/e2e/effects.spec.cjs` 验证真实出牌的传说登场、桌面／触屏截图、视觉播放期间规则状态不变、动态设置中途切换，以及取消／重排后计时器、动画、节点和粒子归零。诊断值通过 `EmberFX.activeAnimations` / `transientNodes` 和既有计数器读取，不暴露新的规则写接口。

## 因果演出与分层人物（2026-09-07）

`presentation/combat.js` 将事件按因果块编成中间表现快照；`effects.js` 仍是唯一战斗演出所有者。引擎只发布已结算的公开观察数据，不等待动画，不新增存档字段。`presentation/portraits.js` 独立管理场上分层人物的共用时钟、可见性、冻结、品质降级及绘制上限；不读取或修改规则状态。详细范围见 [动画更新](ANIMATION_UPDATE.md)。

人物动态使用下述统一目录；35 个随从及英雄/首领所复用的图版都有分层待机。手牌、选卡和自动悬停预览保持静态，场上与显式检查才播放；解码缓存和活跃画布受统一预算限制。

## 统一角色目录（当前接口）

`assets/characters.json` 是角色身份、静态焦点、动态来源、命名图层和 rig 参数的唯一手工配置入口，覆盖全部卡牌。它替代早期 `assets/motion/manifest.json` 与 `presentation/portrait-profiles.js`。静态图来源/哈希与规则定义仍由各自既有模块负责，不把美术配置混进规则层。

`tools/characters.py` 在构建时校验并生成 `character-catalog.js` / `motion-assets.js`；打包器只更新清单的图层产物记录。`EmberArt` 和 `AtelierArt` 使用同一目录，渲染器按图层名称取图。UI 在表现快照渲染时传入明确 mode / instance / state 属性；冻结不再读取 CSS 类，双方英雄与同卡不同实体使用不同实例键。静态卡片不注册动画窗口，显式 detail 切回 static 会释放注册与画布。

字段、命令、模板和验收以 `CHARACTER_AUTHORING.md` 为准。项目内 `.agents/skills/character-creation/SKILL.md` 为可携带的制作入口。
