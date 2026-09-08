# 修改与扩展卡牌

## 常见改动

在 `src/content/cards.js` 搜索卡牌 ID。所有字段具名，卡名、费用、攻血、图像主题和效果放在同一条定义中。

```js
{
  id: "cleric",
  name: "曙光祭司",
  type: "minion",
  cost: 3,
  atk: 3,
  hp: 3,
  art: "mage",
  palette: "gold",
  rarity: "common",
  onPlay: [{ type: "heal", amount: 4 }]
}
```

改为恢复 5 点生命，只改 `amount: 5`。`text` 是派生值，不要另写描述字符串；`battle`、`death`、`effect`、`value` 等旧字段已删除，不能混用。

`art` 表示战斗表现类型，`palette` 表示表现色系。真正的卡牌图片严格按 `id` 对应；英雄和首领显式配置 `portraitId`。

## 效果组合

寒霜之触由两个顺序操作构成：

```js
onPlay: [
  { type: "damage", amount: 3, to: "selected", spell: true },
  { type: "freeze", to: "selected" }
],
target: "enemy"
```

`spell: true` 表示享受法术伤害加成；战吼伤害设为 false。列表在清理死亡前顺序执行，法术伤害加成在本次列表开始时计算。不要随意在某个操作中额外调用 `cleanup()`，否则会改变整套时点语义。

常见操作有 damage、heal、draw、summon、buff、freeze、grant、destroy、silence、transform、armor、mana、discover、secret。完整字段定义在 `src/rules/effects.js`；未知字段会报错。

亡语用 `onDeath`。召唤引用共享卡牌时，其数值与生成文案都会读取被引用定义。如果需要独立平衡，应设计独立衍生牌 ID，并遵守项目卡池/插画约定；不要只在一处硬写另一个数值。

## 新效果类型

1. 在效果注册表中添加允许/必填字段、执行器和文案。
2. 执行器通过引擎的伤害、召唤、增益等方法修改状态，不访问 DOM 或外部随机源。
3. 在 `rules/ai.js` 添加对应评分；不能静默退回未知效果默认分数。
4. 需要目标预览时，在 `rules/preview.js` 实现可确定结果；涉及隐藏信息或随机数时返回空/不确定。
5. 增加规则和顺序测试；只有新演出需求才修改 `effects.js`。常见表现类别自动从操作结构得到。

当前支持本回合攻击增益，不支持本回合生命增益，内容校验会拒绝后者。完整光环和墓地不是已实现能力，新增时需要先定义来源移除、沉默、区域迁移和存档规则。

## 单张插画

替换图至少 336×448，使用已确认的图像与来源说明：

```bash
python3 tools/pack_card_assets.py --card cleric --image /absolute/path/cleric.png --source-note '用户确认的替换图'
python3 build.py
npm test
```

工具保存单张原始输入和 `overrides.json`，生成 WebP、更新来源清单、重建缓存。以后从八张旧图集整体重建时也保留已登记的单张覆盖。

只改卡名等元数据，或重新打包现有图片：

```bash
python3 tools/pack_card_assets.py
```

直接手改 WebP 但不登记来源会报错。不要编辑 `src/anime-assets.js` / `src/relic-assets.js`，它们是生成文件。

## 检查

```bash
npm run test:release
```

使用当前版本的效果、触发顺序、增益到期和存档往返测试防止规则回归；全部卡牌还需通过确定性与可恢复状态检查。旧版本行为 fixture 已退役，不再要求当前规则复刻旧玩法。

## 英雄、职业、预设和卡组规则

在 `content/campaign.js` 中注册职业 `classes: [{id, name}]`；卡牌 `class` 与英雄 `classId` 引用它。种族使用同文件中的 `tribes`，筛选抽牌的文案会读取注册名称。

新增同职业英雄可以复用已有 `classId` 和 `defaultDeckId`，为其设置独立 `id`、名称、技能、`powerIcon` 与 `portraitId`。不要添加 `hero.deck`：默认牌表仅从预设派生。新英雄仍需遵守角色制作和素材映射规范。

预设包含 `{id, name, classId, hero, deck, plan, strategy?}`；`hero` 是练习对手的英雄 ID，其职业必须匹配 `classId`。同职业的其他英雄也可以选用此预设，无需复制牌表。英雄默认预设必须存在且符合职业、牌数与同名限制。

`deckRules: {size: 30, maxCopies: 2, rarityCopies: {legendary: 1}}` 是构筑规则的唯一配置源。修改时同时调整所有预设到新规则；加载器会拒绝不合法内容。改变已发布构筑规则时，还需审查旧战役继续游玩与卡组迁移策略，不代表任何规则变动都能无条件兼容。

首领 `deck` 仍是战役专用牌表种子，开局复制两份，因此无需遵守玩家职业和同名限制；引用必须有效，展开后不超过 当前存档的 100 张牌库容量。首领配置明确 `discoverClass`，`phaseEffects` 在半血时执行。追加首领后，地图、通关和奖励流程自动延长；不要重排现有首领而不迁移存档。
