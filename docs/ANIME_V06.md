# 烬域 · 动漫秘境

**EMBERFALL — ANIME ATELIER · v0.6.0**

基于《掌中酒馆》v0.5 的完整卡牌插画替换版。已把用户确认的 8 张动漫素材表拆成 56 张独立卡图，接入实际手牌、收藏、战场随从、召唤衍生牌、法术、武器与详情页。不是静态演示图，也不需要运行时调用生图 API。

**发布状态：本地构建与浏览器验证已完成，但没有发布到公网。** 交付前没有取得本游戏的托管项目、既存站点地址或可用的写入部署入口。连接的 WaveShift 工作区没有本游戏代码，本轮未改动它。`deploy/` 是待上传的静态站点文件，不是已经上线的网站。

## 立即游玩

打开 `index.html`，或交付的 `Emberfall_Anime_Atelier.html`。建议先进入“战斗试玩”，再打开卡牌收藏或点开手机手牌详情。手机端保留竖屏、横屏、左右滑动手牌、点牌确认、长按查看和旋转继续对局。

手机的文件管理器、聊天软件可能只预览 HTML 而不运行 JavaScript。这时请用浏览器访问静态托管站点，或在电脑启动本地服务后，在同一可信 Wi-Fi 用手机访问电脑的局域网地址：

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

电脑本地访问 `http://localhost:8000`；Windows 可用 `py` 替代 `python3`。不要将此本地服务器端口开放到公网。

## 替换范围

| 内容 | 本版结果 |
|---|---|
| 可组牌卡 | 48/48：28 张随从、18 张法术、2 张武器 |
| 衍生牌 | 8/8：硬币、幽灵狼、灵狼、骸骨、石卫、绵羊、新兵、树灵 |
| 独立卡图 | 56 个不同的 WebP 文件，与卡牌 ID 一对一对应；无共用的卡图路由 |
| 旧卡图回退 | 0；缺失未来新增卡图会明确报错，不会静默回退到旧矢量画 |
| 英雄与 Boss | 使用这套新图中对应主题的图版，映射见下文；不是另生成 8 幅原画 |
| 建筑、棋盘、音效、规则 | 保留 v0.5 玩法与环境；没有重新生成建筑或把建筑变成完整三维网格 |

每个输出为 **336×448 像素、3:4 比例**，来自素材表中的独立图格。裁掉标题条和边距，再等比缩小、编码为 WebP；没有用模糊色块填充，也没有把放大重采样冒充高清重绘。每个素材的来源、裁切坐标、原始像素尺寸、文件哈希都在 `assets/anime/manifest.json`。

卡名、法力、攻击、生命、规则文字仍由实时 DOM 显示。素材表中的文字不会叠到游戏界面。56 张卡拥有各自的图格，但相近角色的服饰和构图可能相似；“独立图版”不等于 56 次独立生成任务。

### 英雄与首领共用图版说明

星焰法师使用 `oracle`，黎明圣卫使用 `paladin`，暗影游侠使用 `archer`。灰烬监守使用 `berserker`，荆棘女王使用 `treant`，深渊先知使用 `necromancer`，霜狱君王使用 `frostking`，终焉巨龙使用 `ashdragon`。首领与卡牌同名 ID 根据实际实体/配色分开路由，不会把“星界观测者”卡图错误换成深渊先知。

六件非卡牌遗物的小图标沿用旧素材。这里没有声称所有场景和 UI 图标都已重新绘制。

## 同步修复与交互

清理了旧雕刻卡框拱顶中残留的旧画面像素，并让新插画覆盖完整开口。按卡牌主题设置焦点位置，卡面、随从和英雄使用不同的轻微裁切参数；不拉伸人物比例。

手机卡牌详情新增 **“查看完整原画”**。打开和关闭只展示图片，不消耗法力或改变游戏状态。Esc 只关闭原画层，保留下面的卡牌详情；旋转屏幕会安全关闭原画层并保持同一对局。

既有的出牌确认、目标选择、攻击曲线、冻结、死亡、复生、武器和 AI 回合继续使用原有规则与动画。未修改 `src/engine.js` 和 `src/data.js`，也没有重置存档格式。

## 构建、测试与素材重建

直接运行不需要 Python、Node 或安装任何依赖。

```bash
# 由当前源码组装单文件 HTML
python3 build.py

# 规则与素材路由测试
node --test tests/engine.test.cjs tests/anime_assets.test.cjs

# 浏览器验证；需要 Playwright 和 Chromium
python3 tests/browser_pocket.py
python3 tests/pocket_additional.py
python3 tests/browser_anime.py
```

重新从确认的 8 张素材表生成独立图片与精简缓存：

```bash
python3 -m pip install -r requirements-art.txt
python3 tools/build_anime_assets.py
python3 tools/prepare_anime_runtime.py
python3 build.py
```

以上素材管线已验证可重建出字节完全一致的 HTML。`tools/art_contact_sheet.py` 仅制作开发用总览图，标签使用系统已有字体；源码和发布包都没有打包字体文件。

### 关键文件

```text
index.html                         可直接运行的单文件游戏
build.py                           HTML 构建器
src/anime-assets.js                56 张新卡图的内嵌缓存
src/atelier-art.js                 严格的卡图路由、英雄/Boss 别名、裁切焦点
src/anime.css                      插画开口、轻微裁切与完整原画查看样式
src/anime-ui.js                    完整原画查看与本版显示信息
src/mobile-*.js / mobile.css       延续的触屏与横竖屏系统
assets/anime/sources/              8 张确认的原始素材表
assets/anime/*.webp                56 张单独卡图
assets/anime/manifest.json         来源与校验清单
assets/anime/frame-sources/        清理前的框素材，用于可重复加工
assets/anime/Contact_Sheet.jpg      全部 56 张实际交付卡图总览
assets/atelier/                    本版保留的环境与处理后的卡框
preview/                          实际浏览器截图
VALIDATION.md                      本版测试结果及限制
DEPLOYMENT.md                      待部署文件与上线检查
```

## 渲染与存档边界

手机端的卡图、棋盘、战斗特效和规则全部内嵌，可离线运行。桌面保留可选的 Three.js CDN 棋盘；本次截图和测试使用 Canvas / 2D 路径，没有完成真实 GPU 3D 验收。

存档键保持 `emberfall.v1`、`emberfall.deck.v1`、`emberfall.settings.v1`。同一来源可以继续使用原存档格式；换域名、浏览器、设备或本地文件路径不保证共享进度。

本次浏览器测试使用 Chromium 触摸模拟和明确的内存存储适配器。HTTP 和 file 导航已实际尝试，但被测试浏览器的管理员策略阻止，所以没有验证真实来源下跨刷新存档。也未验收实体 Android/iPhone、Safari、长时间耗电发热、联网 PVP 或长期数值平衡。
