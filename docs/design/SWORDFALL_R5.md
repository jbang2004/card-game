# R5 · 从屏幕外垂直刺入卡牌

基线：main `9e5b06203fa020b479a7f174a811801c316e7dd5`。
本次仅重做 `slash` 剑击及其接入，不修改已验收的原版火焰、闪电配方、卡牌数值、规则或存储。

## 动作契约

- 替代 R3 的回引/弧线/拔出设计。最低点（剑尖）从舞台上边界外 38 个逻辑像素开始，整把剑因此在画面之外。
- 剑始终垂直，屏幕 X 不变。姿态是固定比例网格的刚体变换；固定侧向角只为露出金属侧面，不产生挥动。
- 在权威接触时刻前最多 160ms 才进入下落段。轨迹 `0.32u + 0.68u²` 保留非零入场速度，并在撞击前持续加速，不做 ease-out 软着陆。
- 命中位置为目标卡牌中心向上 0.055 倍卡高，不再是目标脚下的地面参考平面。
- 命中之后剑尖、剑柄、朝向保持不动；340–680ms 逐步溶解消退，没有弹起、横摆和拔出。接触节拍沿用原导演层，不新增伤害。
- 近战三维剑击预启动成功时，来源卡片只做轻微释放动作，不再同时冲撞一次；三维路径不可用时保留旧动作回退。

## 视觉

实体剑使用固定多面刃身、双侧斜面、深色剑槽、刻纹、包缠握柄和宝石护手。两条窄尾迹采样真实剑身的过去位置，不拉长实体剑。

接触层为短促亮核、非对称火星、窄冲击环和少量刚体碎片。裂纹在卡面局部坐标生成：八条不等长主裂纹、从已有裂缝分出的支线、暗槽、单边断口高光和快速衰减的内部细光。裂纹约 150ms 展开，最迟 940ms 消退；不得成为持续状态指示，也不永久修改卡图。

`EmberFX.liveAnchor()` 提供表现层的实时卡面盒；接入层将其转换回三维 canvas 局部坐标，扣除共同震屏/缩放，避免双重位移。命中后的剑与裂纹跟随受击卡牌；卡牌不再存在时不在原槽位留下裂纹。手动回看使用捕获的静态盒，不重放 DOM 位移或规则。

## 文件与接口

- `src/vfx3/runtime.js`：`SWORDFALL` 配置、纯函数 `cleaveMotion()` / `cardFracturePaths()`，卡牌裂纹与剑模型渲染。
- `src/effects.js`：三维剑击的来源卡释放动作、targetRef 和只读实时锚点。
- `src/presentation/fx-stage.js`：实时卡面坐标与公共 canvas 变换的对齐。
- `tools/vfx3/lab.js`：检查版名称与时间轴；仅首次进入检查时取消原序列，不为每个采样点重复取消。
- `tests/vfx3-swordfall.test.cjs`：新增18项；仅替换旧测试里与用户新指令冲突的回引/拔出断言，保留刚体、接触、确定性等不变量。

## 验收

```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify_swordfall.py
xvfb-run -a python3 tools/vfx3/verify_swordfall.py --width 390 --height 844
xvfb-run -a python3 tools/vfx3/verify_swordfall.py --width 844 --height 390
xvfb-run -a python3 tools/vfx3/record_swordfall.py
```

记录：`docs/qa/swordfall-r5.json`。267项Node测试：259通过，8项因未入库素材源跳过，0失败。专项浏览器检查67项通过（桌面25、竖屏21、横屏21）。三个视口在各自新环境加载；旧版连续横竖切换工具超时，因此**未通过跨方向连续性验收**，不据此宣称全部端到端测试通过。

浏览器是Xvfb/Chromium/ANGLE/Mesa llvmpipe软件渲染，使用内存加载（环境禁止本地HTTP导航）。未验收HTTP来源/文件来源存档、Safari、实体手机、硬件帧率。截图来自实际运行的三维特效回看；视频30fps为确定性导出的采样率，不是设备实测帧率。为录制暂停了背景DOM动画，不更改技能渲染代码。

## 保留边界

`src/vfx3/reference-flame.js` 与 `src/vfx3/renderer.js` 完整文件哈希保持基线不变，另有原火焰32个采样/着色器一致性测试。新效果仍叠加在原有二维卡面与棋盘上，不是整场3D重建或真实材质破坏。
