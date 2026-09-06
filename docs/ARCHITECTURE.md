# v0.8 开发结构

## 原则

既有规则引擎、卡牌数据和素材 ID 保持稳定。界面只订阅状态、派发规则动作；画面、音频和环境不决定伤害或随机结果。没有引入新的 UI 框架。

| 边界 | 入口 | 职责 |
| --- | --- | --- |
| 规则与数据 | `src/engine.js`, `src/data.js` | 纯规则、AI、确定性 RNG、v1 对局序列化；保留基线字节 |
| 卡牌表示 | `src/presentation/cards.js` | 统一转义、规则强调、角色焦点与实时卡牌 DOM；无状态写入 |
| 手牌布局 | `src/presentation/hand.js` | 根据 1–10 张手牌计算完整槽位，给费用和攻血留空间 |
| 战场表现 | `src/presentation/battle.css` | 桌面手牌与右侧操作区、通知安全区域；明确最终布局所有权 |
| 触屏坐标 | `src/mobile-view.js` | 安全区、横竖屏几何、命中坐标、通知条预留空间 |
| 应用流程 | `src/ui.js` | 战役、输入、存档、AI 调度和模态流程；通过 EmberCards 共享卡牌表示 |
| 触屏输入 | `src/mobile-ui.js` | 手势、点牌确认、长按详情、旋转保持 |
| 战斗演出 | `src/effects.js` | 规则事件的演出与清理，统一使用视口坐标 |
| 音频 | `src/platform/audio.js` | 独立 Web Audio 合成与生命周期，不再耦合可选 3D 初始化 |
| 世界 | `src/atelier-world.js` | 缓存的分层绘画、日夜氛围，使用已有来源明确的资产 |
| 可选 3D | `src/scene.js` | 显式 `?renderer=three` 开启的继承预览；生产路径无 CDN 请求 |

## 构建

`config/build.json` 映射源文件，`src/template.html` 表达实际依赖顺序。`build.py` 检查未知、重复和未使用的占位符，同一次构建生成：

- `index.html`：内嵌脚本、样式与图片，离线可用，也用于既有内存页面回归。
- `dist/index.html`：使用有序 `defer` 脚本、单独 CSS 和按内容哈希去重的图片。图片相对页面路径解析，支持 `/dist/` 等子目录。
- `dist/build-manifest.json`：输出文件字节数、版本及单文件 SHA-256。

Web 图片从同一份内嵌源缓存提取，没有重新压缩原画。素材生产管线仍按 `docs/ASSETS.md` 运作：改图后重建缓存，再构建游戏。

历史 CSS 仍作为兼容基础保留，并已格式化为可阅读规则。主题属于 `windborne.css`，触屏基础属于 `mobile.css`，此次桌面对战几何属于 `presentation/battle.css`。后续避免往多个历史文件重复添加同一布局补丁。没有宣称本轮已彻底消除全部历史样式。

## 验证

`npm test` 验证规则与素材；`npm run test:e2e` 验证真实 HTTP 来源、独立资产加载、完整交互、跨刷新存档、11 种满场布局和旋转。截图与机器报告在 `artifacts/qa/`。原 Python 回归保留，用于离线嵌入版和更多卡牌机制的兼容验证。

不把元素在视口内当成无遮挡：新增回归额外检查卡牌间矩形重叠、攻血中心的真实命中元素，以及通知／法力区域与角色、按钮之间的相交。

## v0.9 场景重构

`src/atelier-world.js` 用单张连续原画替换建筑蒙版拼接，独立缓存随视口和昼夜失效；保留调用接口。`src/presentation/premium.css` 负责新材质和数值徽章尺寸，布局仍由原生视口模块管理。`src/premium-assets.js` 由 `tools/build_premium_assets.py` 从审核后的 WebP 生成；生产构建提取为独立图片，单文件构建保留内嵌资源。原始 PNG 与提示词见 `assets/premium/`。

## v0.10 样式层级与组件契约

模板声明 CSS cascade layers：`legacy → layout → theme → components`。旧样式保留基础布局兼容；`battle.css` 管理专属几何，`premium.css` 提供材质，`components.css` 唯一定义大厅色彩、按钮色彩、正文排版与卡图裁切。不再依赖新规则拥有更长选择器来胜过历史移动端或稀有度样式。组件响应式规则只改变字号与几何，不改变配色。

卡面使用一个内框、一个矩形图片窗口及 `object-fit: cover`；图片不再额外缩放，去掉历史伪元素纸面和竞争的拱形轮廓。费用与攻血仍在独立的外层徽章，不会被图片裁切影响。
