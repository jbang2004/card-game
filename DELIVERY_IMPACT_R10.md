# R10 — 更清楚的主形状与命中反馈

实现提交：`4af2f1f7861c8c17c03e03aa10ec24ad12a9564e`。
基线：R9 `412e135da6645ece1c8ba31d56663b1099222fcf`。
本轮改动在 `feat/full-vfx-remaster`，等待用户视觉审阅，不合并或部署。

## 已实施

- 箭矢与投枪保持刚体尺寸，扩大箭头、箭羽和杆身的正常尺寸辨识度。
- 爪痕强化暗色主体与锐边；重击增强主体、方向性接触和受力位移。
- 接触峰值约保持 62–66ms 后单调消退；没有反复闪烁、额外伤害或输入等待。
- 火球使用不同相位/寿命/方向的火舌和不对称焰锋。冰霜改用折面和错落晶片。
- 护盾增加有面的光学外壳；治疗、汲取、强化、奥术与召唤突出自身形状和流向。
- 目标只做受限刚体位移/倾斜，不拉伸压扁。近同时多目标仅衰减装饰辉光，保留主形状。
- 原版喷火、R8 三招、渲染器、规则/卡池/时间配置保持完整哈希不变。

## 构建及验证

```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify_remaster.py
xvfb-run -a python3 tools/vfx3/verify_benchmarks.py
```

本地 Node 523 项：515 通过，8 项缺少原美术源文件跳过，0 失败。
新效果 411 项、已认可效果 102 项，共 513 项定向 Chromium 检查通过。
源码在推送时经过前后文件校验，GitHub 构建和 Node 测试通过后才落为实现提交。
一次性传输数据和临时写工作流已从最终文件树移除，保留原只读 CI。

## 演示

`index.html` / `dist/` 为正常游戏，`Card_Game_3D_VFX_Demo.html` 为临时内存练习对局。
原速查看时先打开声音；时间轴重建动作和特效，不重复伤害。
`capture_impact.py --baseline /path/to/R9.html --video` 生成同种子同相位截帧；
`assemble_impact.py` 生成 19.5 秒录像：九组新效果原速及三组半速前后对照。
声音用同一套运行时 PCM 按同一时间混合，不是现场扬声器录音。

## 边界

Chromium/ANGLE/Mesa 软件渲染、内存加载。本地 HTTP 导航实际尝试后被运行环境策略拦截。
没有声称实体手机、Safari、完整 E2E、真实来源存档或硬件 FPS 验收。
截图未经曝光/颜色强化；正常游戏尺寸的视觉审阅仍需用户确认。
测试与覆盖数不代表达到商业美术质量，目标是可辨识、明确命中而非画面越亮越好。
详见 `docs/design/IMPACT_CLARITY_R10.md`、`docs/qa/impact-r10.json`。
