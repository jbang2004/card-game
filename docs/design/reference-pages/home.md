# 酒馆主页 / home

更新于 2026-09-13。当前为本地实装；用户已要求保存流程经验。图标是否达到原始像素一致未获证实，不将当前实现等同于无损复刻。

## 当前实现入口

- [实装时间线](../HOME_REFERENCE_IMPLEMENTATION.md)：按时间追加，早期位图指南针/七项角色描述已被后续 SVG 版本取代。
- [模板](../../../src/template.html)、[组件样式](../../../src/presentation/components.css)、[图标](../../../src/art.js)、[导航光带](../../../src/presentation/home.js)。
- [主题角色](../../../src/presentation/themes/silverblue.js)、[应用协调](../../../src/ui.js)、[场景设置](../../../src/application/scenery.js)、[专项测试](../../../tests/e2e/home-reference.spec.cjs)。

## 参考与素材

- [原图](../../../assets/ui/home-reference-v1/sources/reference.png)：1672×941。
- [裁切和素材清单](../../../assets/ui/home-reference-v1/manifest.json)、[来源记录](../../../assets/ui/home-reference-v1/provenance.json)、[原始加工脚本](../../../assets/ui/home-reference-v1/process_assets.py)。这是素材生产档案，不代表其中每项仍在运行。
- 当前背景为 `assets/themes/silverblue/home.webp`。位图皮肤为 `final/` 中 Logo、两枚按钮、三张收藏图；指南针位图仅留档。
- 双剑使用 SVG 实色银刃，冰晶徽记按 [62×68 原始裁切](../../../assets/ui/home-reference-v1/reference-crops/compass.png) 重描，使用断环、四向长芒和短斜角。`compass-small` 省略内弧。
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
