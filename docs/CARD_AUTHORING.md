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

迁移行为 fixture 保证现有规则没有无意变化。做有意的平衡调整时，先新增/修改明确的行为测试，再逐项审查相关 fixture 的预期；不要批量更新全部结果或重新加上源码哈希锁。
