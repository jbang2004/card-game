# R4 · 只移植原版火焰

基础：`feat/3d-combat-vfx` @ `b0ec30d1f4de36ad9a99d7447d1585d7ed722280`。

保留二维龙卡、R3 剑劈/裂地、闪电、卡池与规则，不搬入三维龙模型。
从本会话《焰·弦·刃》实际源代码直接提取火焰及火星方法，完整保留出生率、
随机序列、速度、生命期、颜色、透明度及噪声着色器。

## 主要文件
- `src/vfx3/reference-flame.js`：独立 CPU 特效输出；不含模型、规则和渲染循环。
- `src/vfx3/runtime.js`：只做坐标/相机方向/等比缩放/原始火焰时间到规则时间的适配。
- `src/vfx3/renderer.js`：原版 flame GLSL + 适配透明底的预乘能量合成。
- `tests/vfx3-reference-flame.test.cjs`、`tests/fixtures/reference-flame.json`：实际原版输出对照。

## 运行
```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify.py
```
正常游戏仍为 `index.html`/`dist/`；导出的检查页使用临时练习对局和内存存储。
上排执行真实攻击，时间轴只回看特效，不重复扣血，不重放卡牌 DOM 动作。

## 对照录像
```bash
xvfb-run -a python3 tools/vfx3/record_reference_flame.py --reference-html /path/Ember_Steel_VFX_Play.html
```
原版 HTML 为本会话此前提供的文件，不随游戏源码引入原演示龙模型。
录像按同一原版火焰时间对照，24fps、无音轨。编码帧率不是实时性能指标。

## 验证
本地 Node：249 项，241 通过、8 项因缺失源素材跳过、0 失败。
其中 32 个原版参数帧与移植版逐字段输出一致（浮点量化 1e-6 后比对）。
剑身动作、裂地函数及闪电函数与 R3 按源码哈希核对保持不变。
重新执行的 35 项定向 Chromium 浏览器检查全部通过。
最终定向浏览器结果与截图见 `output/vfx3/verification.json`（单独交付中附带，
构建/CI 可重新执行）；不把历史或未运行测试说成通过。

## 边界
仅原版火焰逻辑移植，不是逐像素复刻；背景、视角合成、显示尺寸不同。
起手被适配到现有权威命中时刻，后段恢复原版自然节奏，不执行额外伤害。
保留原版寿命，清理上限为接触后 4.1 秒×timeScale；不阻塞规则队列。
原版地板焦痕/贴地光不搬入；没有新增龙模型、体积流体或全场三维遮挡。
浏览器为 Chromium/Xvfb/Mesa 软件渲染，非实体手机/Safari/硬件GPU验收，
未运行全量端到端测试，也不以通过功能测试代替用户的视觉审阅。

当前执行环境禁止 file:// 页面导航，因此文件来源运行未在此环境验收；
浏览器检查与对照录像使用完整构建内容的内存加载，不将其等同于真实来源存档验证。
