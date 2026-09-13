# 参考图主页实装 · 2026-09-13

> 本文是按时间追加的实装记录，早期方案可能已被后续修正替代。当前状态与返工结论见 [主页档案](reference-pages/home.md)；可复用规则见 [视觉规范](REFERENCE_UI_STANDARD.md)。

已将酒馆参考图的构图和独立素材接入现有游戏首页，保持当前 DOM + Canvas 运行路径。仅本地构建，未更新公开站点。

## 表现与交互

- 复用已有无 UI 酒馆背景 `assets/themes/silverblue/home.webp`，由现有 Canvas 场景缓存绘制；保留晴昼/暮色设置。
- Logo、主按钮冰晶底图、副按钮金属底图、指南针、三张收藏入口插画，通过主题语义角色引用 `assets/ui/home-reference-v1/final/` 中的 WebP。构建器自动生成内容寻址的 HTTP 资源和单文件离线内嵌资源。
- 标题 Logo 保留图形字标；按钮文案、寄语、收藏装饰标题和其他界面文字使用 DOM。按钮皮肤、图标与文案分层，刷新存档文案时只更新文字节点。
- 主按钮按当前有效 version 3 战役存档显示“开启冒险”或“继续冒险”。副按钮显示“战斗试玩”或“新的旅程”，继续沿用试玩不覆盖战役、新旅程先确认的现有逻辑。无效存档提示保留在主按钮附近。
- “冒险地图”继续打开真实战役地图。收藏整体为一个原生按钮，图卡和箭头都是同一入口的装饰，打开现有收藏/组牌页面；三张展示插画不冒充可用战斗卡牌 ID，也不改变 79 张卡牌映射。
- 顶栏桌面只保留声音、设置；全屏入口移入设置，环境时光入口已在设置中。手机保留现有收藏与菜单快捷入口。
- 原生按钮支持键盘、焦点返回、悬停、按下和禁用状态。动态效果遵从游戏减弱动态选项与系统 reduced-motion 偏好。没有新增动画时钟、轮播定时器或规则层依赖。

## 响应式与代码边界

桌面沿用既有 1600×940 交互平面；参考图为 1672×941，因此构图不是逐像素复制。手机采用独立的横竖屏排版与安全区，最小竖屏省去底部装饰说明，为主操作和收藏入口留出独立空间。触控图标和主操作至少 44 CSS px。

- `src/template.html`：主页语义结构和装饰图绑定声明。
- `src/presentation/components.css`：主页材料与布局，使用 `#lobby` / `.lobby-view` 限定范围，清除旧主页高度和 span 样式对新组合的影响。
- `src/presentation/themes/silverblue.js`：七个主页语义美术角色、主页文案。
- `src/ui.js`：首次素材绑定、只更新存档按钮文字，保留原动作处理。
- `src/application/scenery.js`：去掉旧卡牌缩略图覆盖逻辑，保留环境设置并加入全屏入口。
- `tests/e2e/home-reference.spec.cjs`：主页跨尺寸可点击、触控尺寸、不重叠、焦点返回、试玩不写存档、保存后皮肤保持、新旅程取消及恢复流程。

没有改动规则、AI、战役数据或存档格式。工作区原有未提交修改保留；本次不把那些改动归为主页重构成果。

## 检查记录

最终结果见 `output/home-implementation-20260912/validation.json`；运行截图为同目录 `verified-home-*.png`。另执行现有 `game.spec.cjs` 和 `ui-polish.spec.cjs`，覆盖真实来源存储、完整手牌、对局动作、手机旋转、设置与离线启动。测试为本机 Chrome 和触控视口模拟，未进行实体手机测试。

复刻限制：背景和提取图存在生成细节差异，透明边缘部分经过重建；未声称无损分层或与参考图像素一致。未增加新的图片生成/锐化步骤。

## 技能参考记录

全部已读取：

| 参考 | 读取 | 应用 |
| --- | --- | --- |
| threejs-game-ui-designer/references/ui-patterns.md | 是 | 游戏主页分区、动作与状态绑定 |
| references/checklists/game-ui-quality.md | 是 | 原生按钮、可达状态、非仪表盘式页面 |
| references/checklists/hud-readability.md | 是 | 背景文字对比、保留既有战场 HUD |
| references/checklists/responsive-ui-fit.md | 是 | 桌面、平板、横竖屏及窄窗口检查 |
| references/checklists/mobile-input.md | 是 | 44 px 触控区域、安全区、旋转状态 |

本次状态覆盖：新玩家主页、有效/无效存档主页、地图、收藏、英雄选择、试玩/战役和返回主页、设置、减弱动态。胜负和奖励流程由现有游戏回归覆盖，不另建页面。

## 五处浏览器批注修正

- 收藏箭头改为已有 `chevron` 矢量图标，34×34 的正圆容器，SVG 几何中心与圆心重合。
- 底部复用 `homeCompass` 冰晶徽记，以 CSS 调为浅色；徽记与三段文字使用同一条 flex 中心轴。
- 桌面主按钮皮肤高度由 98 增到 116，连同移动端分别调整。两按钮箭头统一向内收，共用网格列。显式清除旧主按钮 SVG 的绝对定位，避免箭头绕过网格。
- 攻击图标在原生 `EmberArt.icon` 中重画为 `swords`，两把交叉剑，保持矢量透明和可缩放；无新增图标库或位图生成请求。
- 顶部复用实时文字字标，移除与主标题相同的 Logo 图片。`presentation/home.js` 管理单一导航高光，包含中央光晕与菱形亮点，跟随 pointer/focus，在取消触摸和离开时返回当前项目；不调用游戏动作。CSS 坐标使用 offsetLeft/offsetWidth，适配缩放后的桌面交互平面。尊重系统和游戏的减弱动态选项。

专项测试新增箭头同轴、圆心、徽记居中、1244×922 批注窗口、悬停/键盘/触摸高光跟随及取消。修正后的截图仍为 `verified-home-*.png`；本轮独立结果见 `feedback-validation.json`，保留首轮 `validation.json` 作为历史记录。

### 收藏层次与双剑材质二次修正

收藏按钮为箭头预留独立的右侧空间（桌面 64、触屏 54 布局像素）；三张卡采用 -5° / -1° / 3° 倾角、高低错位和投影，悬停抬起时保留排列。专项回归检查八个窗口尺寸中，经过变换后的卡片边界与箭头至少相隔 12 CSS px。

双剑改为两把纤细银刃，以前后两层实色面、剑脊高光、简洁护手和蓝灰剑柄表现材质，替换原先交叠的线框。仍使用项目原生 SVG 图标 API，无新依赖、无位图重采样。实际截图：`output/home-implementation-20260912/layered-home.png`、`silver-swords.png`。

### 冰晶指南针 SVG

`EmberArt.icon('compass')` 使用同心圆、星芒、轨道椭圆和中心晶核，统一 100×100 viewBox；`compass-small` 去掉外环及细刻度，用于页脚。颜色继承 `currentColor`，按钮深蓝、页脚银白，不再对位图使用反色滤镜。模板改为原生图标挂载，删除主题中不再使用的 `homeCompass` 位图角色；原始 PNG/WebP 留档。

导出的可复用 SVG 与实装局部截图位于 `output/home-implementation-20260912/compass-normal.svg`、`compass-small.svg`、`compass-button.png`、`compass-footer.png`。本轮构建通过，131 项规则/素材测试与 10 项主页浏览器测试通过（含居中、触控尺寸、存档文案更新和导航动作）。

### 按原始徽记重新描线

以 `reference-crops/compass.png` 的 62×68 原图裁切作为坐标基准，删除上一版额外的轨道椭圆、多层星形及外围刻度。改成断开圆环、四向渐细长芒、四枚斜向尖角和单一中心晶核；轮廓面用 currentColor 实色填充，避免细线交叠成团。小号只省略内侧细弧。

本次属于依据截图轮廓的矢量重描，并非恢复原始矢量文件或声称零像素差异。新版导出为 `compass-traced-normal.svg` / `compass-traced-small.svg`；按钮和页脚的实际效果为 `compass-traced-button.png` / `compass-traced-footer.png`。
