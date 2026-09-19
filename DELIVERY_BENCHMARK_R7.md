# 三式 · 形与力 / R7 实际游戏实现

这一交付在现有 card-game 中实现“圣裁·天剑、夜幕·无声刺、白霜·王敕”。
不是分镜图播放器，不将三张概念板嵌入游戏充当动画。

## 运行

```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
```

正常入口：`index.html`（内嵌单文件）或 `dist/index.html`（静态网站）。
检查入口：`Card_Game_3D_VFX_Demo.html`。临时练习对局使用内存存储，不覆盖正式存档。
选择角色并点击“实际出招”执行真实规则攻击。三式连播仅精修的三个角色。
声音默认关闭，点击“声音：开”后以原速体验。时间轴只回看动作与特效，不重复伤害。

## 回归和录像

需要 Python Playwright、系统 Chromium、Linux Xvfb 和 FFmpeg；字体只用于截图标签，
不包含/分发字体文件。通过 `CHROMIUM_PATH` 指定 Chromium。

```bash
xvfb-run -a python3 tools/vfx3/verify_benchmarks.py
xvfb-run -a python3 tools/vfx3/record_benchmarks.py
python3 tools/vfx3/assemble_benchmarks.py
```

录像工具保存60Hz确定性采样帧和描述符。这不是实时硬件帧率成绩；
数值保留真实攻击的结算值，且录制时暂停无关 CSS 装饰动画。
声音采样来自运行时同一 cue bank，而非第三方配乐。
修改说明：`docs/design/BENCHMARK_SWORD_ARTS_R7.md`；
实际测试记录：`docs/qa/benchmark-sword-arts-r7.json`。

## 完整性

原版 `reference-flame.js` 文件未修改，原火焰/烟雾GLSL与后处理也保持不变。
`src/engine.js`、`src/content/cards.js`、`src/content/campaign.js`、
`src/presentation/timing.js` 与远程main基线一致。
三招不是新增规则技能；不增加伤害次数或冻结状态。
本地交付R6尚未推送，故R7完整补丁同时包含R6角色区分与游侠箭矢映射修正。

## 本轮实际验证

354 项 Node 测试：346 通过、8 项源素材缺失跳过、0 失败。
102 项定向 Chromium 检查通过；两种移动尺寸独立测试。
未执行全量 E2E、实体手机、Safari、硬件 GPU 帧率或 HTTP 来源持久化验收。
