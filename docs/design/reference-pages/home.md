# 酒馆主页 / home

更新于 2026-09-13。当前为本地实装；用户已要求保存流程经验。图标是否达到原始像素一致未获证实，不将当前实现等同于无损复刻。

## 当前实现入口

- [实装时间线](../HOME_REFERENCE_IMPLEMENTATION.md)：按时间追加，早期位图指南针/七项角色描述已被后续 SVG 版本取代。
- [模板](../../../src/template.html)、[组件样式](../../../src/presentation/components.css)、[图标](../../../src/art.js)、[导航光带](../../../src/presentation/home.js)。
- [主题角色](../../../src/presentation/themes/silverblue.js)、[应用协调](../../../src/ui.js)、[场景设置](../../../src/application/scenery.js)、[专项测试](../../../tests/e2e/home-reference.spec.cjs)。

## 参考与素材

- 原图（该素材记录已随 2026-09-14 旧主题移除删除）：1672×941。
- [裁切和素材清单](../../../assets/ui/home-reference-v1/manifest.json)、[来源记录](../../../assets/ui/home-reference-v1/provenance.json)。两者已在 2026-09-14 随旧主题移除裁剪为仍在运行的四项；原始加工脚本与生产归档已删除。
- 当前背景为 `assets/themes/silverblue/home.webp`。仍在使用的位图只有 `final/` 中的 Logo 与三张收藏图；两枚位图按钮皮与指南针位图已删除，主/次操作改为纯 CSS 药丸。
- 双剑使用 SVG 实色银刃，冰晶徽记按 62×68 原始裁切（该素材记录已随 2026-09-14 旧主题移除删除） 重描，使用断环、四向长芒和短斜角。`compass-small` 省略内弧。
- 文案、按钮标签和收藏装饰标题使用 DOM。收藏插画是入口装饰，未注册成新的战斗卡牌。

桌面仍是 1600×940 的游戏平面，目标视口按既有规则缩放，因此与原图存在比例/裁切差异；手机独立布局。主按钮桌面皮肤高 116（含光晕），副按钮 66；不把这些数字直接复用于其他页面。收藏区为箭头预留独立空间，按变换后的卡片边界实测间隔。

## 用户批注与返工结论

| 问题 | 根因/观察 | 当前修正 |
| --- | --- | --- |
| 收藏箭头偏心 | 字符箭头受字体基线影响，容器不是正圆 | 现有 SVG chevron，等宽高容器，中心误差检查 |
| 两按钮箭头不齐、靠右 | 主按钮残留 SVG absolute/right，绕过新网格 | 明确清除旧定位，两按钮共用列与内边距 |
| 主按钮矮 | PNG 留白/光晕使可见晶体高度小于元素高度 | 加高皮肤，并在实际显示尺寸下比较 |
| 页脚徽记不对、对齐不佳 | 通用星形不等于参考徽记 | 图标与文字共享中心轴，最终使用 SVG |
| 两个 Logo 重复 | 顶栏重复主标题复杂图形 | 顶栏简洁实时文字字标，主标题保留原画字标 |
| 导航缺少集中高光/移动 | 各按钮独立下划线 | 单一移动光带，中央光晕，pointer/focus/cancel 与 reduced-motion |
| 三卡平铺、箭头贴卡 | 容器未为箭头保留空间，层次不足 | 高低错位、轻微倾角、投影，悬停保留排列，八个窗口至少 12 CSS px 间距 |
| 双剑线框风格不搭 | 交叠轮廓在小尺寸形成线团 | 前后分层银刃、蓝灰柄、简洁护手 |
| 冰晶 SVG 线条过密 | 凭印象增加椭圆轨道与嵌套星形 | 放大原始小图，删除额外装饰，按原轮廓重描 |

不要恢复旧的单剑、拥挤线框双剑、轨道椭圆徽记或两处大 Logo。原图低分辨率和合成边缘限制仍存在；当前 SVG 未声明零像素差异。

## 真实动作

开启/继续冒险按有效存档切换；副按钮是试玩/新的旅程，沿用新旅程确认和取消语义。试玩不覆盖战役。冒险导航打开现有地图，收藏按钮打开现有收藏/组牌。全屏、声音、时光仍有入口。装饰及导航高光不写游戏状态。

## 证据（各自对应当时迭代）

- 初次实装：[validation.json](../../../output/home-implementation-20260912/validation.json)。
- 五处批注：[feedback-validation.json](../../../output/home-implementation-20260912/feedback-validation.json)。
- 卡片间距/双剑：[layer-validation.json](../../../output/home-implementation-20260912/layer-validation.json)。
- 首次 SVG：[compass-validation.json](../../../output/home-implementation-20260912/compass-validation.json)，是被后续重描修正的早期版本。
- 最后重描：[按钮截图](../../../output/home-implementation-20260912/compass-traced-button.png)、[页脚截图](../../../output/home-implementation-20260912/compass-traced-footer.png)、[SVG 导出](../../../output/home-implementation-20260912/compass-traced-normal.svg)。运行代码仍以 `src/art.js` 为唯一编辑源，导出供复用和比较。

最后重描时实际执行 `python3 build.py`，`node --test tests/*.test.cjs tests/art/*.test.cjs`（131 通过），`npx playwright test tests/e2e/home-reference.spec.cjs`（10 通过）；本次整理仅保存既有日志，没有重新运行游戏验收。日志：[规则/素材](../../../output/home-implementation-20260912/compass-traced-unit.log)、[浏览器](../../../output/home-implementation-20260912/compass-traced-browser.log)。Chrome/触控视口模拟，不是实体手机验收；未发布线上。

## 2026-09-13 磨砂青岩皮肤

`?skin=slate` 下主页 UI 层按 [SLATE_DESIGN_SYSTEM.md](../SLATE_DESIGN_SYSTEM.md) 第 5.1 节重做，Canvas 场景原画与昼夜切换保留。唯一改动文件是 `src/presentation/skins/slate/home.css`（模板与 `home.js` 未动）；全部规则以 `html[data-skin="slate"] body:not(.touch-layout)` 开头，不带 `?skin` 时本页与改动前一致（逐像素比较见下）。

- 顶栏：品牌改文字字标（「烬域」20px/700 + `EMBERFALL` 10px 字距 3px）；三个导航改文字分页（未选 ink-3，选中白色 700 + 3px 白色发光下划亮条）；图标按钮改 36px 圆形药丸。
- 标题区：保留 `homeLogo` 位图；「灰烬酒馆」28px/700、标语 18px ink-2、存档状态 15px ink-3，均为黑体；存档状态改回文档流，不再固定在 318px。
- 主按钮：位图皮肤隐藏；`#start-btn` 蓝色主药丸 320×64（22px 标签），`#quick-btn` 深色次药丸 300×56。两者用同一栅格模板与同一内容盒跨度（左 24px → 280px），因此左边缘、图标槽、标签列、箭头槽四条轴完全重合。
- 收藏区：「我的收藏」改节标题 + 发丝线；三张卡保留错位与倾角，加圆角 10 + 1.5px `--slate-card-line` 描边 + 投影，图片改 `object-fit: cover`，标题字改黑体；箭头改 44px 圆形药丸。
- 页脚与寄语改黑体 ink-2，页脚上方加发丝线。
- `--home-veil` / `--home-collection-veil` / `--home-caption-shadow` 在 `#lobby` 上调为中性深蓝灰（这三个是 components.css 的场景令牌，不是 slate 令牌；只作用于 `#lobby`，不外溢）。

两处位图用 `opacity: 0` 而非 `display: none` 隐藏：`.home-action-skin` 与导航光带 `.nav-light`。两者本就脱离文档流（绝对定位、`z-index:-1` / `pointer-events:none`），不影响几何；同时 `home-reference.spec.cjs` 断言按钮皮肤可见、且光带跟随指针/焦点移动，`display:none` 会把这两条断言变成永远成立的空断言。皮肤下光带不可见，选中态改由 `.nav-link.active::after` 的下划亮条承担。

既往批注结论全部复测通过（三档视口，`getBoundingClientRect` 屏幕 px）：两按钮左边缘差与箭头中心差均为 0；卡片变换后边界间隔最小 14.60px；箭头药丸到卡片右缘最小 17.05px；药丸与 chevron 中心差 ≤ 0.005px。舞台按 `min(w/1600, h/940)` 缩放，1280×720 时为 0.766，上述值已是缩放后的实测值。

验证：`python3 build.py`；`node --test tests/*.test.cjs`（127 通过）；`home-reference.spec.cjs` 在 `?skin=slate` 下 10 通过，不带 `?skin` 同样 10 通过。不带 `?skin` 的 1672×941 截图与改动前的控制组逐像素比较——单通道最大差 1、无像素差 > 8，小于同一构建两帧之间的 Canvas 噪声底（1.137 % 像素、最大差 1）。截图与逐项实测数据：[output/slate-home-20260913/](../../../output/slate-home-20260913/README.md)。

已知差异：手机布局（`body.touch-layout`）不在本次范围，属设计系统第 5.7 节第二阶段。

## 2026-09-14 触控布局皮肤

`?skin=slate` 的第二阶段：`body.touch-layout` 下主页有了专用的竖屏 / 横屏排版，唯一改动文件仍是
`src/presentation/skins/slate/home.css`（模板、`home.js`、`mobile.css`、`components.css` 均未动）。

文件重排成三段，顺序固定：**材质 → 桌面几何 → 触控几何**。

- **材质段**以 `html[data-skin="slate"] body` 开头，不带布局限定：底色、描边、圆角、投影、字族/字重/字距、文字颜色、阴影与 hover/pressed/focus/disabled 反馈在桌面、竖屏、横屏三种视口里只写一次。字号随 `font:` 简写带到材质段（桌面值），各布局段只重写 `font-size`——这正是 `REFERENCE_UI_STANDARD.md`「只允许改变位置、尺寸、间距、排列、可见性及必要的字号密度」允许的那一项。
- **桌面几何段**保持 `body:not(.touch-layout)`，与 2026-09-13 完全一致。
- **触控几何段**为 `body.touch-layout`（再按 `.mobile-portrait` / `.mobile-landscape` 与高度分档）。

竖屏 390×844：顶栏变两行栅格——第一行文字字标（「烬域」19px + `EMBERFALL` 9px，`mobile.css` 原本隐藏第二行，这里重新打开）与右侧 44px 圆形图标药丸，第二行是三等分的文字分页条（选中白色 700 + 下划亮条）；`#lobby` 顶部相应下移 44px。位图 Logo 缩到文字列宽（300×172）；主/次药丸改为整列同宽（最大 360px）、各 56px 高、同一栅格模板；收藏区改为平排三张 96×140 描边卡 + 44px 圆形箭头药丸，页脚保留发丝线。

横屏 844×390 / 568×320：左栏文案 + 两枚药丸，右栏收藏，两栏各占 `min(…, calc(50% - 24px))`，分页条收回顶栏单行。568×320 另有一档更紧的字号与 76px 卡片。竖屏 ≤620 高（320×568）还有一档收口，把装饰先压掉以保证两枚药丸与收藏条之间仍有 ≥12px 走廊。

三点值得记录：

- 图标药丸在触控下是 **44px** 而不是简报写的 36px。`AGENTS.md` 与本规范都要求触控命中区 ≥44px，而 `home-reference.spec.cjs` 也直接断言 `#sound-btn` / `#settings-btn` 的宽高 ≥44。材质（圆形、`--slate-pill` 底、`--slate-pill-line` 边）与桌面完全相同，只有尺寸变——这属于允许的差异。
- 触控下收藏卡取消桌面的错位与 3D 倾角（`transform: none`），并且必须同时写 `transition: none`：`components.css` 给 `transform` 挂了 180ms 过渡，否则每次布局翻转都会播一段「倾斜→摊平」，而且量到的是**变换后的**包围盒而不是 94px 的边框盒，箭头药丸与卡片右缘的 ≥12px 实测会偏小 6px。
- 横屏顶栏改成 `height: auto; min-height: var(--header-h)`：`--header-h` 是行高而顶栏另有 1px 发丝线，定高会让内容盒只剩 43px，44px 的药丸被居中到 `y = -0.5`，`home-reference.spec.cjs` 的 `r.y >= 0` 会失败。
- 横屏高度 ≤500 时页脚（装饰性）整条隐藏：左栏的高度被 Logo、文案和两枚药丸占满，按规范「空间不足时先减少装饰，不挤压主要操作」。

验证：`node --test tests/*.test.cjs` 127 通过；`?skin=slate` 下 `home-reference.spec.cjs` 10/10 通过（含 390×844、320×568、844×390、568×320、768×1024 五档触控），`mobile-layout.spec.cjs` 5/5 通过。`responsive-component-style.spec.cjs` 的跨视口材质比对中，`lobby` 一页的差异由 144 条降到 **0** 条。桌面 1672×941 与改动前逐像素比较：单通道最大差 1、无像素差 > 8（即只有 Canvas 场景噪声）。截图见 [output/slate-mobile-scene-20260914/](../../../output/slate-mobile-scene-20260914/README.md)。

已知差异：战场 `body.touch-layout` 不在本任务范围。
