# 月影卡组画风统一 · 2026-09-08

本次只调整美术、图层和素材制作工具；卡牌效果、费用、攻击/生命、构筑与契约规则没有修改。

## 完成范围

十一张静态原画全部重新绘制：soulguide、moonfox、duskstag、graveoffering、mooncall、soultether、moonlance、stillness、eclipsewolf、moonguard、selmyra。六个随从同步重做背景与透明主体两层，其余五张法术保持静态。莫菈及第六首领沿用对应 portraitId，因此同步获得新画面。全游戏仍是 73 张独立卡图、41 个动态随从；完整清单见 [CHARACTER_ROSTER.txt](CHARACTER_ROSTER.txt)。

以内置 image_gen 完成逐卡 style-transfer，使用各卡旧形象作身份参考，oracle、wolf、solaris、wolves、blessing 作风格参考。先完成神祇静态、分层和实际召唤检查，再制作其余卡。保留月影配色和神祇尺度，统一动漫线条、人物面部、毛发概括及明暗色块。

当前原画、提示词、风格说明与来源哈希：`assets/anime/moon-anime-v2/`。分层图集、提示词与逐卡抠图记录：`assets/motion/moon-anime-v2/`。前版 `moon-sources` 保留为设计档案，当前运行路由已替换。

## 边缘与颜色

图集经绿色键色转换为真实 alpha。检查发现旧的全图去绿会改变青色灯光和衣料，新增 `green-edge` 模式，仅在透明边缘三像素范围内压掉过量绿色，不修改内部颜色。新增合成素材测试明确检查绿边、青色、肤色、内部绿色、透明背景与左侧背景像素。

六张实际记录均为 similarity 0.22、blend 0.06、despill green-edge，residualKey 为零。神祇切分 771，背景宽 767；其余五张各自确认切分为 768。通过正常 packer 更新清单和缓存，无手工改写运行缓存。

## 验证

- 完整构建与浏览器回归：87/87 通过。
- 最终边缘修正后重新构建：106/106 Node 规则/素材单测，5/5 制作工具测试通过。
- 最终图层的动画与契约专项：22/22 Playwright 测试通过，包括全 41 角色绘制/运动/冻结/解冻、手牌静态、缓存、失败回退、桌面/横竖屏契约与神祇降临。
- `python3 tools/characters.py --check`、完整角色清单导出与 `git diff --check` 通过。

检查 1600×940、390×844、844×390 新旧卡混排截图：人物、动物、传说各两张配对同屏，手牌配对加入法术。查看新版主体 alpha、放大图及神祇仪式。放大页连续观察 36 秒并采样 7 次，五个契兽/神祇伙伴相邻样本均变化；引路人另检查放大页。没有透明缺口、旧版主体残留或明显绿边。当前仍是两层待机，不是完整骨骼/表情动画。

本地截图：`artifacts/qa/restyle-mixed-{1600,390,844}.png`、`moon-motion-{0,3,6}.png`、`moon-motion-guide.png`、`divine-arrival-{1600,390,844}.png`。完整浏览器报告另存为 `artifacts/qa/restyle-full-results.json`；最终专项在 `results.json`。

浏览器验收是本机 Chromium 与触屏模拟，不代表实体手机或 Safari。未部署公开站点。
