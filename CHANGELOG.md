# v0.8.0 — 本地工程整理与战场可读性

- 分离卡牌表示、手牌布局和 Web Audio；格式化主要界面／场景／特效源码。
- 构建注册表校验，并同时输出便携单文件与独立图片的缓存友好网页构建。
- 完整手牌槽位、右侧操作区、桌面通知安全区；修复手机横屏法力及通知遮挡。
- 默认统一手绘场景，继承 3D 路径改为显式开发预览。
- 增加真实来源存档、11 种满场布局与遮挡检测的端到端回归。
- 完整变化与验证见 `docs/QA_V08.md`。

---

# v0.7.0 — WIND BORNE / 风起之境

- 接入已确认环境概念图中的四个独立建筑层、远景与手绘庭院基底。
- 统一纸纹、木边、叶片徽章、卡背、卡框、英雄框、费用 / 攻血、菜单、收藏和手机面板。
- 桌面与手机共用分层场景和缓存，保持已有命中与特效坐标。
- 新增晴昼 / 暮色视觉切换及手机设置入口；不修改对局或卡牌数据。
- 保留全部 56 张动漫卡图、规则和 AI 字节，新增环境 / 材质图版 9 个。
- 35 项规则、10 项卡图单元、67 项浏览器检查通过；实际为 Canvas / 触控模拟，边界见 VALIDATION.md。
- 发布单文件 HTML、静态发布包和可重建源码；未执行公网部署。

---

# v0.6.0 — Anime Atelier

- 从 8 张用户确认素材表拆出 56 张独立、无标题条的动漫卡图。
- 48 张可组牌卡与 8 张衍生牌全部切换，卡图不再回退到程序化插画。
- 精简运行时：移除旧角色肖像缓存，保留六个非卡牌遗物图标。
- 统一英雄/Boss 对应主题图；记录复用关系，处理同名 ID 的路由冲突。
- 清理卡框拱顶旧画面残留；校准新图的焦点与图片开口。
- 手机详情增加非破坏性的完整原画查看、Esc 返回和旋转清理。
- 提供独立发布包、源码、原图裁切清单、重建脚本和本版测试证据。
- 公网部署未执行；需要目标托管项目和可用发布入口。

---

# v0.5.0 — POCKET ATELIER / 掌中酒馆

- Native CSS-pixel mobile playfield, distinct portrait/landscape layouts and safe-area/VisualViewport handling.
- Touch-inspect-confirm cards, native swipeable hand, full-hand overview, long-press current unit/hero details and explicit targeting cancel.
- Responsive modal system, collection/deck tabs, compact menu and larger text/action targets.
- Unified hit-test/effect coordinates and curve-tangent aim; resize drains one pending presentation commit without changing game rules.
- Mobile uses offline Canvas without requesting Three.js; desktop direct-click and mouse drag preserved.
- Fixed generic data-type selector collision with modal type, interrupted long-press close tap, hidden cinematic overlay, inherited desktop root dimensions and cross-layout weapon coordinates.
- Rules/data and v1 save keys unchanged. See VALIDATION.md for executed tests and unverified physical-device/storage boundaries.

---

# v0.4.0 — ATELIER / 酒馆秘境

- Approved concept paintings are now actual runtime assets, not background UI screenshots.
- Four separately masked architectural layers: brewery, observatory, mine, forge.
- Layered brass/card frames for minion, spell, nature, legendary, weapon; a separate hero arch.
- 16 portrait crops and two sword recompositions, with explicit native-resolution metadata.
- 34 card definitions and three hero choices route to painted assets; unrepresented subjects retain original artwork.
- All card values, rules, targeting and input remain live DOM over the original unchanged engine.
- Compact turn controls, faceted mana, quieter typography, cleaner collection and hero selection.
- Non-destructive asset workshop with keyboard focus return and no save writes.
- Same painted architecture in lobby and combat; local glints, smoke and four click interactions.
- Optional Three.js tabletop now shares the new contour/material; GPU rendering is not validated here.
- 35 rule tests and 30 browser checks passed. See tests/atelier/VALIDATION.md.

---

# Changelog

## 0.3.0 — Tavern Edition / 灰烬酒馆

- Replaced the dark editorial art direction with a warm wood, brass and parchment system.
- Added original tavern/chessboard dioramas and four non-destructive corner interactions.
- Rebuilt card frames, cost/attack/health badges, portrait medallions, rarity gems and legendary trims.
- Repainted programmatic character/object illustrations and embedded 71 pre-rendered portrait resources.
- Aligned heroes vertically; simplified minions; grouped mana and turn controls; revised full-hand geometry.
- Unified collection, deck editor, heroes, mulligan, discoveries, relics, settings and results.
- Added a sequential campaign map with current, completed and locked encounter states.
- Recalibrated combat positions, draw origins and the optional Three.js warm board material.
- Fixed a real reduced-motion interaction bug: hover no longer lifts cards out of their click target.
- Preserved the original rule engine, card data and v1 storage schema byte-for-byte.
- Actual browser screenshots are Canvas / 2D fallback, not verified WebGL output.

# 0.2.0 — REKINDLED / 重燃

- 新的首页、战场、卡牌、图鉴、英雄、遗物、设置与结算排版。
- 重制巨龙主视觉，添加金属、鳞片、衣料和法阵的程序化 SVG 细节。
- 新增独立、无需 CDN 的 Canvas 世界与战斗演出层。
- 七系弹道与命中，近战前冲、死亡消散、召唤、护盾、冻结、群攻和阶段演出。
- 新增分流派合成音效、卷积尾音与输出压缩。
- 重做 Three.js 棋盘投影与 UI 位置校准、倒角、纹理、灯光及棋子底座。
- 新增不改存档的特效演武场，支持中途取消并清理效果。
- 新增目标交换预览，标明不计算隐藏触发；修正英雄防御武器的预览逻辑。
- 新增右键查看、折叠记录/首领情报、输入锁和减弱动态的反馈保留。
- 修复原版卡牌类型 `.minion` 与战场单位选择器重名的问题，改用 `.type-minion`。
- `engine.js`、`data.js` 与存档结构保持不变。
- 测试与截图是兼容渲染路径，不冒充真实 Three.js/GPU 验收。
