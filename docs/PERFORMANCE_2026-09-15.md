# 战场性能：测量、根因与优化（2026-09-15）

用户反馈战场「有点卡，性能比较低」。本次工作的顺序是**先测量、再优化、最后用数据证明**，不凭直觉改样式。基准是战场重构 `e14878f` 之后的 `dist/`。

## 1. 方法

本机 Chrome（152.0.7977.83）+ Playwright + CDP，服务为 `python3 -m http.server 8000`，页面 `http://127.0.0.1:8000/dist/?debug=1`。脚本每个视口开一个独立 context，点 `#quick-btn` 进试玩局，等 `EmberFX.busy` 落下再采样。

- 视口：`1600×940` 桌面、`1280×720` 紧凑桌面、`390×844` 触屏（`isMobile` + `hasTouch`，并用 `Emulation.setCPUThrottlingRate` 降速 4×）。
- 场景：(a) 静止 5s；(b) 手牌坞上来回 hover 3s；(c) 进入瞄准并在随从间移动指针 3s；(d) 连出手牌 + 一次随从攻击；(e) 神卡舞台开关 3 次；(f) 双方补满随从 + 10 手牌后静止 5s。
- 指标来源：
  - 帧间隔与掉帧比例：页内 `requestAnimationFrame` 采样。
  - long task：页内 `PerformanceObserver('longtask')`。
  - 主线程 `TaskDuration` / `ScriptDuration`、样式重算 `RecalcStyleCount` / `RecalcStyleDuration`、布局 `LayoutCount` / `LayoutDuration`、`Nodes`：CDP `Performance.getMetrics` 的区间差值。
  - 合成层数：CDP `LayerTree.layerTreeDidChange`。
  - JS 热点：CDP `Profiler`（200µs 采样）。
- 采样脚本与原始 JSON 在忽略目录之外没有落盘，结果表见 §4。

**样本口径说明**：`TaskDuration` 是主线程忙碌时间的增量，除以采样时长即"主线程占用比"。单次短样本有波动，场景 (d)(e) 还带随机对局内容，个位数百分比的差异不应解读为改善或回归。

## 2. 测量出来的事实

### 2.1 帧率不是问题，主线程预算才是

三个视口、六个场景，**优化前平均帧间隔全部是 16.67ms，掉帧率 0%**，long task 基本为 0。本机（Apple Silicon Mac）不掉帧。

但静止 5 秒的桌面战场：

- `TaskDuration` **849ms / 5000ms = 主线程 17%**，对照 `docs/PERFORMANCE_2026-09-08.md` 记录的 3.92%，是重构后的明显回退。
- `RecalcStyleCount` = **301 次 / 5s，即每帧一次**；`RecalcStyleDuration` = **264ms**，平均每次 0.88ms。
- `LayoutCount` = 1（静止时没有布局抖动）。

也就是说：**画面完全静止时，每一帧都在做一次昂贵的全量样式重算**。这就是低端机、外接高分屏、或同时开着其他应用时"卡"的来源。

### 2.2 JS 不是瓶颈

静止 6 秒的 CPU profile：

| 占比 | 自身耗时 | 函数 |
|---:|---:|---|
| 91.2% | 3543ms | (idle) |
| 8.1% | 314ms | (program) — 浏览器内部：样式、布局、绘制、合成 |
| 0.1% | 5ms | `tick` @ portraits.js:412 |
| 0.1% | 4ms | `drawImage` |
| 0.1% | 3ms | `remove` |
| 0.1% | 2ms | `clearRect` |
| 0.1% | 2ms | `paint` @ portraits.js:254 |
| 0.0% | 1ms | `tick` @ effects.js:3471 / `draw` @ vfx.js:925 |

全部 JS 自身耗时加起来不到 **0.5%**。`effects.js` / `vfx.js` 的 canvas tick 在静止时几乎不画东西，粒子上限和 `effectScale` 都不是问题。**代价全部在渲染管线里**，所以优化方向是 CSS，不是 JS。

### 2.3 消融实验：谁在每帧重算样式

桌面 1600×940，静止 5s，逐项用运行时注入的 `<style>` 关掉某个嫌疑点后重测：

| 变体 | 样式重算次数 | 样式重算 ms | 主线程 taskMs |
|---|---:|---:|---:|
| 基准 | 301 | 319 | 894 |
| 关掉 `.minion.ready` 的两条动画 | **0** | **0** | **377** |
| 关掉全部动画与过渡 | 0 | 0 | 318 |
| 隐藏 `canvas.portrait-motion` | 300 | 312 | 895 |
| 隐藏 `#world-canvas` | 300 | 343 | 950 |
| 隐藏 `#fx-canvas` | 301 | 286 | 860 |
| `#battle * { filter: none }` | 300 | 334 | 673 |
| `#battle *, #app * { backdrop-filter: none }` | 300 | 376 | 988 |
| `#hand, #minions { contain: layout paint style }` | 301 | 270 | 843 |

结论已经很清楚：

- **`.minion.ready` 的两条持续动画是唯一的连续动画源**，关掉它们等于关掉全部动画（377 vs 318）。
- 三块 canvas（世界、特效、人物分层）在静止时**不产生**样式重算，也不是主线程大头。
- `backdrop-filter` 在战场静止时**不是**成本项（关掉反而略高，属噪声）。指挥台底板已在 `e14878f` 去掉，`console.css:34` 剩下的 `blur(10px)` 与神卡舞台暗幕只在浮层打开时参与合成。
- `filter: drop-shadow` 有代价（894 → 673），但它是**被动画驱动的重绘**放大出来的，见下。

### 2.4 再往下一层：是 float 不是 breathe

把两条动画拆开（每组两次独立运行，结论一致）：

| 变体 | 样式重算 ms | 主线程 taskMs |
|---|---:|---:|
| 基准 | 354 / 319 | 987 / 956 |
| 只关 `slate-ready-breathe`（`.unit-aura`，动 `opacity`） | 331 | 982 |
| 只关 `slate-ready-float`（`.minion-art`，动 `transform`） | **60 / 62** | **398 / 459** |
| 两条都关 | 0 | 395 / 375 |

**`slate-ready-float` 一条动画，占静止时样式重算的 82%、全部主线程工作的约 55%。**
`slate-ready-breathe`（纯 `opacity`）几乎免费，可以原样保留。

### 2.5 为什么一个 2px 的 transform 这么贵

`slate-ready-float` 动的是 `.minion-art` 的 `transform`，正常情况下应该在合成线程上跑、完全不碰主线程。它没有被合成，而且每帧都要重新解析 `.minion-art` 的样式。原因是这个元素同时踩中了几件事：

- `card-face.css:855` 的 `.minion` 是 `container-type: inline-size`，`.minion-art` 是它的绝对定位子元素；
- `.minion-art` 的 `box-shadow` 由三个自定义属性合成 `box-shadow: var(--unit-ring), var(--unit-glow), var(--unit-inset)`，而这些值用的是 **`cqw` 容器单位**（`card-face.css:1156-1164`、`.taunt` / `.shield` 状态也是）；
- 父元素 `.minion` 还带 `filter: drop-shadow(...)`（`card-face.css:875`），子元素每动一次，整个令牌的离屏滤镜都要重画。

每帧一次的动画帧让 Chrome 对该元素做一次完整样式解析，其中包含 `var()` 替换 + 容器单位求值，再触发父级滤镜重绘。6 个随从 × 60fps，就是观察到的 0.88ms/帧。

**下列方案都实测过，没有一个能把成本拿回来**（桌面静止 5s，taskMs）：

| 尝试 | 结果 |
|---|---|
| `will-change: transform` / `will-change: opacity` | 1013（更差） |
| 常驻 `will-change: transform` | 1091（更差） |
| 去掉 `.minion` 的 `filter` | 823 |
| 去掉 `filter` 并把投影换成 `.minion-art` 的 `box-shadow` | 698 |
| 去掉 `filter` + `will-change` | 907 |
| `.minion` 去掉 `container-type` | 772 |
| `.minion` 加 `contain: layout paint` | 721 |
| `.minion-art` 加 `contain: layout paint` | 880 |
| 用字面量 `box-shadow` 替掉 `var()` 组合 | 724 |
| 把 `box-shadow` 挪到 `::before` 伪元素 | 621 / 831（两次跑不一致） |
| 改用 `translate` 属性代替 `transform` | 915 |
| 把动画挪到 `.minion-art img` 与 `.unit-aura` | 799 |
| **直接去掉这条动画** | **398 / 459** |

### 2.6 瞄准时的强制同步布局

场景 (c) 桌面：3 秒内 `LayoutCount` = **207**。两个原因：

- `ui.js` 的 `pointerPoint()` 每次指针移动都调 `app.getBoundingClientRect()`，而同文件的 `clientPoint()` 早就改用了 `EmberViewport.appRect` 缓存（`mobile-view.js:631`，由 `ember:viewport` 失效）。
- `mousemove` / `touchmove` / `pointermove` 每个事件都**同步**跑一次 `targetCue()`，里面有 `elementsFromPoint`（强制布局）+ `querySelectorAll('.aim-focus')` + `centerOf()` 取矩形。指针一帧内可能派发好几个事件，但屏幕一帧只能显示一个结果。

## 3. 改动

只做了三处，都围绕上面的测量结果。

| # | 文件:行 | 改动 | 依据 |
|---|---|---|---|
| 1 | `src/presentation/skins/slate/console.css:1479-1497`（原 1483-1505） | 删除 `slate-ready-float` 动画声明与 `@keyframes`；`.minion.ready .minion-art` 只保留 `--unit-glow` / `--unit-inset` 配色。"可攻击"的动效由纯 `opacity` 的 `slate-ready-breathe` 独自承担 | §2.4 / §2.5 |
| 2 | `src/presentation/skins/slate/console.css:1513-1517`、`1522-1526` | 敌方回合 / 瞄准中、以及两处 `prefers-reduced-motion` / `.reduced-motion` 的 `animation: none` 规则里，删掉已经没有动画的 `.minion.ready .minion-art` 选择器 | 清理，顺带少一条长链匹配 |
| 3 | `src/ui.js:1110-1117` | `pointerPoint()` 改用 `EmberViewport.appRect` 缓存，不再每次指针移动强制一次布局 | §2.6 |
| 4 | `src/ui.js:1325-1361` | 新增 `queueTargetCue()`：把 `mousemove` / `touchmove` / `pointermove` 的瞄准回调用 `requestAnimationFrame` 合并成每帧一次，后到的调用覆盖前一个回调（拖拽中仍走 `updateTargetLine`）。需要同步结果的调用方继续直接调 `targetCue()` | §2.6 |

没有新增令牌，没有改规则层，没有碰 `engine.js` / `rules/`，没有动素材。

### 明确的取舍：2px 浮动被取消

改动 1 **改变了视觉**：我方可攻击的随从原本除了蓝色呼吸边，还会以 1.6s 的周期上下浮动 2px（设计文档 §13.3）。这条动画现在没有了，呼吸边保留。

之所以这么做而不是保住它：§2.5 表里 11 种"保住动画同时降成本"的做法全部实测失败，而这一条动画占静止时主线程工作的一半以上。**这是本次唯一需要上级拍板的点**。如果决定必须保留 2px 浮动，恢复只需要在 `console.css` 的 `.minion.ready .minion-art` 规则里加回一行 `animation: slate-ready-float 1.6s ease-in-out infinite;` 并补回 `@keyframes`，代价就是静止帧预算回到 17%。

## 4. 前后对照

同一台机器、同一脚本、同一天连续两次运行。触屏视口带 4× CPU 降速。

| 视口 | 场景 | 主线程 taskMs/采样 | 样式重算 ms | 样式重算次数 | 布局次数 | 掉帧% | 平均帧间隔 ms |
|---|---|---|---|---|---|---|---|
| desktop 1600×940 | a 静止 5s | 849 → **192 (−77%)** | 264 → **25 (−91%)** | 301 → 301 | 1 → 1 | 0 → 0 | 16.67 → 16.67 |
| desktop 1600×940 | b 手牌 hover 3s | 463 → 384 (−17%) | 164 → 128 (−22%) | 285 → 196 (−31%) | 0 → 0 | 0 → 0 | 16.67 → 16.67 |
| desktop 1600×940 | c 瞄准 3s | 460 → 432 (−6%) | 114 → 113 | 433 → 337 (−22%) | 207 → **111 (−46%)** | 0 → 0 | 16.67 → 16.67 |
| desktop 1600×940 | d 出牌+攻击 | 489 → 328 (−33%) | 148 → 75 (−49%) | 241 → 236 | 39 → 35 | 0 → 0 | 16.67 → 16.67 |
| desktop 1600×940 | e 神卡舞台 ×3 | 474 → 334 (−29%) | 130 → 74 (−43%) | 210 → 208 | 23 → 22 | 0 → 0.56 | 16.67 → 16.76 |
| desktop 1600×940 | f 满场静止 5s | 551 → **227 (−59%)** | 141 → 37 (−74%) | 301 → 301 | 0 → 0 | 0 → 0 | 16.67 → 16.67 |
| compact 1280×720 | a 静止 5s | 741 → **394 (−47%)** | 262 → **62 (−76%)** | 300 → 300 | 1 → 1 | 0 → 0 | 16.67 → 16.67 |
| compact 1280×720 | b 手牌 hover 3s | 396 → 280 (−29%) | 131 → 59 (−55%) | 202 → 194 | 0 → 0 | 0 → 0 | 16.67 → 16.67 |
| compact 1280×720 | c 瞄准 3s | 452 → 401 (−11%) | 125 → 116 (−7%) | 404 → 307 (−24%) | 207 → **111 (−46%)** | 0 → 0 | 16.67 → 16.67 |
| compact 1280×720 | d 出牌+攻击 | 326 → 335 (+3%) | 90 → 91 | 231 → 231 | 40 → 39 | 0 → 0 | 16.67 → 16.67 |
| compact 1280×720 | e 神卡舞台 ×3 | 318 → 318 | 80 → 84 (+5%) | 218 → 214 | 30 → 26 | 0 → 0 | 16.67 → 16.67 |
| compact 1280×720 | f 满场静止 5s | 400 → 386 (−4%) | 98 → 96 | 300 → 301 | 0 → 0 | 0 → 0 | 16.67 → 16.67 |
| touch 390×844 (4× 降速) | a 静止 5s | 470 → **128 (−73%)** | 96 → **14 (−85%)** | 301 → 301 | 1 → 1 | 0 → 0 | 16.67 → 16.67 |
| touch 390×844 (4× 降速) | b 手牌 hover 3s | 336 → **136 (−59%)** | 104 → 28 (−73%) | 195 → 195 | 0 → 0 | 0 → 0 | 16.67 → 16.67 |
| touch 390×844 (4× 降速) | c 瞄准 3s | 615 → **261 (−58%)** | 144 → 53 (−63%) | 297 → 295 | 10 → 10 | 0.37 → 0.38 | 16.79 → 16.73 |
| touch 390×844 (4× 降速) | d 出牌+攻击 | 713 → **327 (−54%)** | 164 → 56 (−66%) | 371 → 366 | 16 → 13 | 0.30 → 0.60 | 16.77 → 16.77 |
| touch 390×844 (4× 降速) | e 神卡舞台 ×3 | 380 → 365 (−4%) | 91 → 87 | 217 → 217 | 27 → 26 | 0 → 0 | 16.67 → 16.67 |
| touch 390×844 (4× 降速) | f 满场静止 5s | 265 → 260 (−2%) | 53 → 50 | 300 → 300 | 0 → 0 | 0 → 0 | 16.67 → 16.67 |

合成层数：桌面 107 → 102，紧凑 81 → 81，触屏 84 → 84。
`performance.memory.usedJSHeapSize` 在所有场景都是 5–7 MB，前后无差别，没有观察到堆增长。

一句话总结：**桌面静止战场的主线程占用从 17% 降到 3.8%，触屏（4× 降速）从 9.4% 降到 2.6%，瞄准时的强制布局减半。** 帧率本来就是 60，现在的意义是把预算让出来给弱机器和高刷屏。

注意事项：

- `RecalcStyleCount` 在静止场景仍是 301（每帧一次），因为 `slate-ready-breathe` 的 `opacity` 动画还在跑。区别是**每次重算从 0.88ms 降到 0.08ms**，这是有意保留的——它是"可攻击"的唯一动效，而且几乎免费。
- compact 视口的 d/e/f 与 touch 的 e/f 变化在 ±5% 以内，属于运行间噪声，不主张为改善。
- 场景 (f) 的补场逻辑是克隆已有随从，不同运行的场上数量不完全一致，横比时要留意。

## 5. 视觉回归

三视口优化前后的战场截图在 `output/battle-perf-20260915/`（`before-*.png` / `after-*.png`）。试玩局是确定性的，两次抓到的是同一个局面（第 6 回合、双方各 3 随从、6 手牌）。截图前把页面上所有动画 `pause()` 并定格在 `currentTime = 800ms`（呼吸动画与原浮动动画共同的峰值），使两次抓图可比。

逐张比对结果：唯一的差异是**我方三个可攻击随从的插画在 `after` 里低 2px**（`before` 定格在浮动的最高点）。蓝色呼吸边、外发光、内描边、状态角标、手牌坞、指挥台、神卡槽位、法力点阵、顶栏全部逐像素一致。没有其他视觉回归。

## 6. 验证

- `python3 build.py` — 通过（`dist/index.html`，284 文件，22,543,953 字节）。
- `node --test tests/*.test.cjs` — **127 通过 / 0 失败**。
- `env -u CI -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy NO_PROXY=127.0.0.1,localhost npx playwright test --reporter=line` — **284 passed (11.5m)**，0 失败。其中包含瞄准线相关的 `action-feedback.spec.cjs`（"the aim line ends on whichever friendly minion the cursor is over"）与 `hand-drag.spec.cjs`，rAF 合并没有破坏它们（测试在 `mouse.move` 后有 60ms 等待，足够一帧）。
- `npx prettier --check src/ui.js src/presentation/skins/slate/console.css` — 通过。
- 未 commit，按要求保留在工作区。工作区里原有的 `gallery-diff.json` 与旧卡面 CSS 清理未被触碰。

## 7. 查过但没有改的（附证据）

| 嫌疑点 | 结论 |
|---|---|
| `backdrop-filter: blur` | 战场静止时不参与（§2.3）。指挥台底板已在 `e14878f` 去掉，`console.css:34` 的 `blur(10px)` 与神卡暗幕 `blur(8px)` 只在浮层存在时合成；场景 (e) 前后无显著差异，未改。 |
| `filter: drop-shadow` | 单独看有代价（894 → 673），但一旦 float 停掉就没有增量：`float-off` 398/459 vs `float-off + 去 filter + 换 box-shadow` 416/449，**无差别**。换 `box-shadow` 会改变投影跟随的形状（`.unit-aura` 的外凸边），风险 > 收益，未改。 |
| canvas 特效（`vfx.js` / `effects.js`） | 静止时 CPU profile 合计 < 0.05%，`clearRect`/`drawImage` 可忽略。共用一个 rAF。未改。 |
| 人物分层 canvas（`portraits.js`） | `tick`+`paint` 合计约 7ms/6s；隐藏全部 `canvas.portrait-motion` 对静止 taskMs 无影响（895 vs 894）。未改。 |
| 桌面手牌让位的 `:has(+ .hand-card:hover)` | 场景 (b) 桌面样式重算 3s 内 285 次、164ms，本身不是热点；改动 1 之后已降到 196 次 / 128ms。改成 JS 加 class 收益不明确且会把表现逻辑搬进 JS，未改。 |
| `render()` 整块 innerHTML 重建 | 静止与 hover 场景 `ScriptDuration` 只有 20–100ms/采样，hover 不触发 render。未改。 |
| `content-visibility` / `contain` | `#hand, #minions { contain: layout paint style }` 实测 843 vs 基准 894，在噪声范围内。未改。 |
| 图片解码尺寸 | 卡面 webp 是 384×512（93 张）与 336×448（69 张），随从令牌实际显示约 116×146 CSS px，手牌约 148×223。令牌的解码像素约是显示的 3× 边长（≈9× 面积），每张 384×512 解码后约 0.75MB RGBA。属于内存/解码项，不是每帧成本。按任务约定**只报告，不动素材策略**。 |
| 构建产物体积 | `dist/` 22.5MB，其中 219 个 webp 占 20.7MB（92%）；另有 51 个 js、12 个 mp3。`dist` 走按需加载所以不等于首屏流量；离线内嵌版 29.5MB 受 Base64 膨胀影响。没有发现"未使用的内联资源"这一类明显浪费，**只报告**。 |
| `mobile-view.js` resize 读写交替 | 静止与交互场景 `LayoutCount` 分别是 1 和 0，没有观察到 resize 之外的布局抖动。未改。 |

## 8. 未做 / 已知风险

1. **2px 浮动取消是视觉改动**，需要上级确认（§3）。这是唯一一个"改了看得见的东西"的地方。
2. 所有数据都来自本机 Apple Silicon Mac 上的 Chrome。触屏一栏是**桌面 Chrome 的模拟 + 4× CPU 降速**，不是实体手机验收；不能据此承诺任何具体机型的帧率。
3. 场景 (d)(e) 依赖随机对局内容，前后不是同一局，只应看数量级。
4. 本次没有用 DevTools Tracing 抓完整 trace，"top 5 耗时 CSS 属性"是通过消融实验反推的（§2.3/§2.5），不是 trace 里逐属性的直接读数。
5. 静止时仍有每帧一次的样式重算（`slate-ready-breathe`）。如果将来要做到"完全静止 0 重算"，需要把这条动画也换成合成层上的方案，收益已经很小（25ms/5s）。
