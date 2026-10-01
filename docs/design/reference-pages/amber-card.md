# 琥珀卡面 / amber-card

## 当前实现（2026-10-01，2.5D 琥珀）

整张卡是一块封着人物的琥珀，所有场合（手牌、收藏/卡组目录、发现、换牌、奖励、详情、拖动副本、飞行代理）共用同一条管线，没有第二套卡面。

- **渲染器** `src/presentation/amber-volume.js`（`EmberAmberVolume.create(canvas)`，WebGL2）：画框 `art/ui/amber-card-v2/body.png` 是琥珀的前表面（z=0），卡的分层（场景 bg、人物 body、可选道具 front，各按深度图位移成网格）放在其后，每个内部片元沿视线射线回投到前表面，用轮廓遮罩决定可见并做 Beer–Lambert 吸收；加树脂雾层、气泡、楔形侧壁（侧壁像素同样折射进封存层）。名字、规则、费用、攻血画在卡面上（规则按字数分字号档、绕开宝石；类型行居中于铜牌）；稀有度=顶端宝石与铭牌金属，职业=画框色相与树脂（中立蜜珀、法师蓝珀、圣卫金珀、游侠绿珀）；亮度太暗/太亮的画面按 `gammaFor()` 调伽马。取景用 `FOCUS`（头顶位置，手读 14 张）或人物层顶行，让脸落在拱顶下方。
- **接入** `src/presentation/amber-cards.js`（`EmberAmber`）：MutationObserver + IntersectionObserver 找到页面里的 `.card[data-card-key]`，一个隐藏渲染器按显示尺寸画静止图（按 卡/数值/尺寸 缓存为 blob URL），写入 `--amber-img` 作背景；被拿起阅读/详情/舞台前排的那张卡由第二个渲染器的画布挂在 `.card` 内（`.amber-live-canvas`），随指针转动（`mountCard / attend / bindTouch / rest / release / angles`）。`cards.js` 的 `cardHTML` 仍输出真实 DOM 文字（名字、费用、数值、规则），出图后视觉隐藏（sr-only），无 WebGL2 时 `html.amber-off` 把文字放在朴素琥珀底板上。状态用 CSS：可出牌暖光、费用不足去饱和变暗、选中亮光。样式在 `skins/slate/card-face.css`。
- **素材** `art/amber/<id>-{bg,body,front?,depth}.webp` 与注册表 `src/amber-layers.js`，由 `tools/bake_amber_layers.py` 生成：有 `tools/amber_relayer/work/<id>/out/` 的卡用重分层（真实抠像 + 画出来的背景板，转到侧面不缺脸），否则用 `art/live-art` 的自动分层。重分层流程见 `tools/amber_relayer/`：`gen.py <id> plate|figure`（codex-image 各一次）→ `layer.py <id>` → `bake_amber_layers.py`；`descs.json` 是每张卡的主体/场景描述。单文件构建把注册表置空（约 15 MB 分层不内联），卡片改封存平面插画（不随角度移动）。
- 测试：`tests/e2e/amber-cards.spec.cjs`（97 张规则整行排下、手牌出图、拿起的卡是实时画布、收藏出图、无 WebGL2 回退）。

## 早期位图版本（已被取代）

2026-09-29 的第一版是 imagegen 透明位图（`art/ui/amber-card-v2/` 的 body / badge-atlas / nameplate）用 SVG viewBox 裁切、`amber-face.js` 共享位图集、DOM 规则文字按 `ruleFit` 分档。现在这三张位图仍是 2.5D 渲染器的画框/铭牌/宝石来源，`amber-face.js`、`card-face.css` 里的旧卡面规则与 `amber-rules.spec` 已删除。

## 还原边界

画框、铭牌、徽章来自从单张合成设计稿生成的重建图层，不能称为原图无损抠图；重分层的背景板是重绘内容，转动时露出的背景与原画并不完全一致。现有卡牌尺寸比例与数据优先保留。未做实体手机、Safari 或公开发布验收。
