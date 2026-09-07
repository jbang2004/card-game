# 角色制作与游戏接入

本文是当前规范。旧动画更新记录用于理解历史，不作为接口定义。保持既有游戏，静态卡片与场上动态允许存在小幅构图差异，不要求重新生成已确认原画。

## 唯一编辑入口

`assets/characters.json` 的 `cards` 覆盖所有游戏卡牌，包括法术、武器与衍生牌。以 `python3 tools/characters.py --list` 的输出确认动态覆盖，不要把“已登记”报告成“已制作动态”。上场范围由游戏内容中 `type: "minion"` 及英雄/首领的 `portraitId` 决定，法术与武器不套人物待机。角色名、玩法与类型仍来自 `src/content/cards.js`，美术来源和静态文件哈希仍由 `assets/anime/manifest.json` 管理。

每项必须有三个字段：

```json
{"staticKey":"wolf","focus":20,"motion":null}
```

- `staticKey` 必须等于该项 ID，不允许用别人的插画补缺。
- `focus` 为纵向裁切焦点百分比 0–100；手牌/场上裁切规则共用 `AtelierArt`。
- `motion: null` 明确表示当前只有静态图。
- 动态完成后把 `motion` 换成下面的对象。不要另建人物数组或再次维护 `portrait-profiles.js`。

```json
{
  "source":"assets/anime/wolf.webp",
  "atlas":"sources/wolf-v2-atlas.png",
  "mask":"sources/wolf-v2-mask.png",
  "cuts":[0,632,1254,1881],
  "maskCuts":[0,627,1254,1881],
  "accent":"unused",
  "preserveHighlights":true,
  "edgeTrim":[5,0],
  "backgroundWidth":632,
  "size":[384,512],
  "rig":{"template":"whole-subject","speed":1.5,"lift":0.012,"sway":0.009,"turn":0.018},
  "files":[]
}
```

这只是现有幼狼的结构示例。`cuts`、`maskCuts`、裁边和支点取决于实际素材，不可复制到其他角色。新条目可以先留 `files: []`，打包后生成正式文件清单；此中间状态不能通过正式构建。

## 图层与动作契约

运行尺寸目前为 384×512。每层处于相同坐标空间；背景必须填满被移走主体后露出的区域。角色完整头身优先；独立头部只用于确有颈部遮挡、补图和可靠支点的素材。

| 模板 | 图层角色，按绘制所需列出 | rig 附加字段 |
|---|---|---|
| `whole-subject` | background、subject | sway |
| `held-accent` | background、subject、accent | sway |
| `anchored-accent` | background、subject、accent | sway |
| `joint` | background、subject、accent（头等关节部件） | sway、pivot、offset |
| `canopy` | background、subject、accent（外层枝叶） | sway、pivot、offset、crop |
| `wings` | background、subject、accent（左右翼各半幅） | wingSpeed、wings |

所有 rig 都必须有 `template`、`speed`、`lift`、`turn`。速度为正弦相位速度，位移为画布宽/高比例，角度为弧度。完整主体的起伏使用 speed，侧移和侧倾使用 speed × 0.65，重型角色可以同时降低整体节奏而保持可辨认幅度。具体参数以当前清单为可运行示例，不能把幅度上限当成推荐值。`pivot`、`offset`、`crop` 使用图层像素坐标。凤凰 `wings` 每项为 `[裁切起始X, 对齐偏移X, 对齐偏移Y, 转动方向, 支点X, 支点Y]`，左右翼源区域各宽 192、高 512。

`files` 由打包器产生，每项有 `role`、`file`、`bytes`、`sha256`，文件名为 `{id}-{role}.webp`。两层角色不创建或加载空 accent。图层运行时按名称寻址，不靠“数组第二项应该是头”的隐含约定。

`atlas` 和 `mask` 相对于 `assets/motion/`，原始输入留在其 `sources/`。优先真正透明 alpha；若图集确有 alpha，可省略 mask/maskCuts 并设 `nativeAlpha: true`。画出来的棋盘背景不算 alpha；此时需制作对齐技术遮罩。`preserveHighlights`、`edgeTrim` 与 `backgroundWidth` 是特定输入修整参数，只有发现实际问题时才设置。

若工具输出绘制棋盘，可重新要求纯键色底，再用 `tools/chroma_motion_atlas.cjs` 转 alpha（素材制作时需要 FFmpeg）。默认品红键色；紫红、肤色或魔法主体优先选择不会和本体混淆的绿色键色。记录 `--color`、`--split`、`--similarity` 与 `--blend` 的实际值以便重做，不能把默认阈值当成所有素材通用值。检查肤色、口腔、火焰和毛边：真实 alpha 仍可能错误抠穿内部或保留键色溢边。

## 制作与接入顺序

1. 从当前清单选定用户要求的 ID，核对原图、卡名、卡牌类型和英雄/首领的 `portraitId`。只增加动态不修改规则。新玩法角色须另按 `CARD_AUTHORING.md` 注册规则和静态素材，不能只插一张图片就声称可玩。
2. 保留已确认静态图，以自己的原图为参考制作动态分层。脸、体型、服装、武器及主色应保持可辨认；小幅构图差异可接受。不把手牌原图替换成随机动画帧。
3. 检查图层重合、支点、遮挡补图、alpha 与循环。先调到场上尺寸也可辨认，再查看放大图；不要只验证“大图会动”。
4. 将来源、提示词、产物路径留档。填写该 ID 的 motion 与 rig，执行 `node tools/pack_motion_assets.cjs`。它更新清单的 files 并生成运行缓存，不会重打包静态原图。
5. 执行 `python3 build.py`；仅 Python 标准库。构建自动验证清单并生成 `src/character-catalog.js` 和 `src/motion-assets.js`，这些文件不是手工编辑入口。
6. 执行 `python3 tools/characters.py --check`。用 `python3 tools/characters.py --list` 输出全部 ID、中文名、静态/动态状态、模板与图层数。不要只交付本次新增 ID 而漏掉既有清单。
7. 单测 `node --test tests/*.test.cjs`；制作工具改动另跑 `npm run test:art`（使用已声明的 Playwright）。动画交互回归 `npx playwright test tests/e2e/combat-motion.spec.cjs`。角色或绑定结构大改运行 `npm run test:release`。只用项目声明的 Playwright 与已有 Chromium。
8. 截图与动态观察：手牌保持原图且 hover/click 不换姿态；场上动作可见、冻结停绘、解冻恢复；出牌、变形、阵亡克隆没有空白。检查桌面、手机横/竖屏及满场。不得把模拟器结果说成真实手机耗电验收。

需要 HTTP 时从仓库根目录运行 `python3 -m http.server 8000 --bind 127.0.0.1`，游戏位于 `/dist/?debug=1`。`tools/animation-demo.html?zoom=1` 从游戏内容自动读取全部上场随从，每组六个分页放大并同步上场；逐页检查，不把仅出现在清单中的角色当成已验收。

批量协作时将不重叠 ID 分给制作者，暂存 `{cards:{ID:{motion:{...}}}}` 片段，使用同一个打包器：

```bash
node tools/pack_motion_assets.cjs --manifest assets/motion/batch.json --card ID
```

片段打包不会更新运行缓存，但仍写同名 WebP。角色一旦交给审核者合入，后续只用 `--card ID` 打包本次待修项，避免整批覆盖已交付文件；修订须同时通知新哈希。打包器先完成整批生成和裁切/alpha校验，再写文件，阻止生成阶段中断留下部分覆盖。审核者核对 ID、素材与哈希后合入唯一正式清单，再执行构建。合入后删除临时配置片段，保留原始图集与提示词。单角色更新正式清单也可使用 `--card ID`，避免重复重压其他素材。

## 表现绑定

UI 根据只读表现快照写在 img 上：

- `data-art-key`：素材 ID。
- `data-portrait-mode`：`static` / `board` / `hero` / `detail`。只有后三者注册动画窗口，静态栏不创建动画画布或监听器。
- `data-portrait-instance`：稳定实例名，场上 `${side}:${uid}`，英雄 `${side}:hero`；同图的不同实体不能使用同名实例。
- `data-portrait-state`：`idle` / `frozen`。冻结来自表现快照，不从 CSS 类推断。

渲染器消费这些绑定、共用命名图层缓存，保存实例相位并复用画布。`detail` 只供显式动态检查，不能用于普通手牌选中或自动悬停预览。攻击、出牌和死亡的整体位移继续由战斗表现编排控制，不把它们混入规则或持久存档，也不必为每个动作创建另一套人物时钟。

## 验收交付

交付完整机器可读清单（上述 --list 输出）、变更 ID、素材与提示词位置、构建/测试结果、实际看过的截图，以及仍是静态的项目。静态与动态映射检查通过不能代替美术验收。角色制作 skill 位于 `.agents/skills/character-creation/SKILL.md`，其他模型可以直接读取使用，不依赖本会话记忆。

### 出牌入场交接

战斗演出开始时通过 `EmberPortraits.prepareSummons(events)` 提前准备本次召唤的图层，复用现有两并发加载器；手牌仍静态，不因悬停预加载。图像完成 decode 后才能绘制。新召唤实例显现时先绘制动态，未就绪只遮住画面最多 180ms，然后显示静态兜底；晚到的动态图层用 160ms 单次淡入衔接。连续待机帧没有透明度混合。该等待只作用于肖像，不等待网络推进规则或锁住输入。减少动态、低画质及加载失败保持静态，现有缓存及同时播放上限不变。
