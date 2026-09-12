# 星海银蓝界面重构 · 2026-09-12

本次在既有 v0.14 游戏上实现新的界面表现层，产品名称仍为「烬域 · 风起之境」。没有新建游戏框架，没有迁移到 Godot，也没有改动战斗规则和存档格式。未发布到公开站点。

## 设计与交付

参考设计在 `output/design-hok-world-20260912/concepts/`；实际运行截图与对照页在 `output/silverblue-rebuild/`。两者用于人工视觉核对，不把不同角色、随机手牌、实时数值的截图差异伪装成零像素误差。

实现范围包括首页、四位英雄选择、收藏与命名卡组、战役地图、桌面/横屏/竖屏战场、诸神契约、换牌、发现、战役奖励、结算、设置、玩法手册及卡牌详情/确认/触屏菜单。布局吸收设计图中的大面积场景、侧边角色、银蓝细线、低饱和深色面板与明确的浅色主行动按钮。手机使用专用排版；矮屏允许内容滚动，操作按钮固定可达。

### 生成素材与代码的职责

| 内容 | 实现 |
| --- | --- |
| 首页、战斗桌面、地图、通用远景 | 4 张独立 WebP 场景 |
| 法师、圣卫、游侠、送魂人 | 4 张独立角色场景 |
| 月神契约场景 | 1 张独立角色场景 |
| 面板、细边、按钮、图标、数值徽章、进度、路线 | DOM / CSS / SVG |
| 费用、攻血、规则、卡组、状态、仪式条件 | 真实规则数据生成的 DOM |
| 场景裁切、暮色、交互光晕 | Canvas，沿用唯一表现时钟 |
| 卡牌插画、角色动画、遗物 | 保留当前已确认素材与严格 ID 映射 |

九张新素材位于 `assets/themes/silverblue/`。`manifest.json` 记录尺寸、字节数和 SHA-256；`provenance.json` 记录完整提示词、输入设计图与生成源路径。WebP 是对生成 PNG 的格式打包，没有把 UI 烘焙到图中。原始 PNG 路径在 provenance 中保留。

## 模块边界

| 层 | 文件 | 责任 |
| --- | --- | --- |
| 内容与规则 | `src/content/`、`src/engine.js`、`src/rules/` | 卡牌、战斗、AI、合法动作；不依赖主题 |
| 页面流程 | `src/application/screens/heroes.js` | 英雄配置、换牌，注入所需动作与数据 |
| 页面流程 | `src/application/screens/campaign.js` | 发现、结算、奖励 |
| 页面流程 | `src/application/screens/preferences.js` | 设置和手册 |
| 页面流程 | `src/application/library.js`、`contracts.js` | 收藏、命名卡组和契约 |
| 应用协调 | `src/ui.js` | 状态变更、输入、模态生命周期和页面组合 |
| 主题定义 | `src/presentation/themes/silverblue.js` | 素材角色、光色、场景焦点和装饰热点 |
| 主题解析 | `src/presentation/theme.js` | 按语义角色查找/缓存/绑定素材，不访问对局或存储 |
| 组件材料 | `src/presentation/components.css` | 配色、字体、纹理、按钮和卡牌视觉规范 |
| 页面几何 | `src/presentation/screens.css` | 页面排版、断点、控件位置 |
| 通用排版 | `dialog-layout.js/.css`、`mobile-view.js` | 滚动、焦点、销毁、设备布局、命中坐标 |
| 场景呈现 | `src/atelier-world.js` | 缓存场景与装饰光，不改变游戏 |
| 环境交互 | `src/application/scenery.js` | 环境时光与热点交互，独立存储偏好 |

页面模块通过 `create(context)` 获取明确依赖；共享状态仍由应用协调器持有。页面关闭时清理地图 ResizeObserver、模态观察器及回调。规则、AI、随机数和 version 3 存档没有被主题改造侵入。

CSS 顺序仍为 `legacy → layout → theme → components`。原组件样式迁入 `legacy-components.css`，保留既有细节作为过渡底层；清除了旧层的 `!important` 抢占。新样式在最终组件层统一生效。唯一强制优先级规则用于 HTML 的 `[hidden]` 语义，避免断点把隐藏控制重新显示出来。

`legacy` 尚未被全部删除：其中仍有当前动画、详情、布局的底层样式。后续可按组件逐步移除，不能直接删整层。`screens.css` 的颜色与场景遮罩使用主题变量；若布局变化很大，需要一起重写几何规则。

## 换成另一种风格

1. 新建一个主题定义，保持 `home / battle / map / backdrop / mage / paladin / ranger / morla / goddess` 的语义角色，修改焦点、装饰热点和光色。新增英雄没有专属场景时显示通用背景，不借用另一个英雄的大图；卡牌图仍严格按 ID 查找。
2. 在 `config/build.json` 的 `THEME_DEFINITION` 改为新定义。构建顺序保持主题解析在场景渲染之前。
3. 修改 `components.css` 的语义令牌与必要的组件外观。纯配色/材料变化不改页面动作和规则。若连信息层级和构图一起改动，再调整 `screens.css`；战场位置改动必须同步 `mobile-view.js` 的命中/落点几何。
4. 替换相应素材目录并更新 manifest。执行构建、单元/素材/浏览器检查，复核桌面、390×844、844×390、320×568、568×320 与旋转场景。

不建议仅为 UI 更换引擎。将来需要实时 3D 时，可通过独立场景接口加入 WebGL；Blender 用于生产场景/模型，Godot 则属于玩法运行时的另一次迁移，不能替代本次的页面结构设计。

## 验证说明

执行记录与最终计数见 `output/silverblue-rebuild/validation.json`。验收覆盖规则、79 张卡图、真实浏览器存储、手牌操作、契约召唤、完整练习对局、页面滚动和尺寸变化。旧的固定木框宽高测试已改为新设计的语义尺寸；保留了触控最小尺寸、可点击、无横向溢出、完整规则和状态保持要求。

浏览器使用本机 Chrome；手机为触控/视口模拟，不是实体手机验收。没有声称验证实时 3D GPU，也没有给设计图到实时页面虚构“100% 像素一致”的数值。
