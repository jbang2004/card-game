# R11 — 状态、特殊事件与战斗收尾

实现提交：6bb96ff723644e4b481214977234fa0c650ba749。
基线：58d604a894ec818e4b4b7c5f552dd987981e192b（R10.1）。
位于 feat/full-vfx-remaster / PR #4；尚未合并 main，未部署。

## 完成范围

新增22个状态/事件演出入口，复用现有三维材质和几何能力，不是22个新角色模型：破盾、解冻、进入潜行、显形、沉默、变形、复生、增益到期、护甲受损、奥秘揭示、反制、装备、武器损坏、爆牌、疲劳、触发来源、回合就绪、英雄倒下、胜利、失败、首领觉醒、抽牌到位。

这些入口绑定实际规则事件。原版喷火、R8三式、R10攻击造型、原Renderer和规则/卡池/时序没有重写。视觉只表现结果，不执行伤害、不延长规则输入锁。

变形保留旧卡插画的裁切位置并扫描消退；爆牌使用己方可见原画，敌方隐藏卡不会被揭示。复生沿用规则产生的新ID与1生命，不能靠回看复活单位。旧抽牌、手牌、发现、地图、奖励和菜单动画继续使用，不声称全游戏每个界面已重新制作。

## 实际验证

- 本地Node全套663项：655通过，8项缺少美术源文件跳过，0失败；新增121项。
- 生命周期专项396项通过；冰冻顺序回归117项通过；标杆/喷火/闪电回归102项通过；既有重制攻击/法术回归411项通过。共1026项定向Chromium检查，0失败。
- 用真实dispatch后的完整规则状态与独立纯规则结果对照；检查事件归属、去重、精确清理、低画质、减少动态、各尺寸及回拖。
- 修复同屏晚到的抽牌到位效果被归入上一招的问题，改为共同sequenceId归组，新增保护测试；冰冻先后顺序重新通过。
- 源码传输按全包及逐文件前后SHA256校验；恢复后GitHub构建与全套Node通过，才生成上述实现提交。最终文件树已移除临时传输数据和临时写工作流，保留原只读CI。

## 运行

```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
xvfb-run -a python3 tools/vfx3/verify_lifecycle.py
xvfb-run -a python3 tools/vfx3/verify_freeze_order.py
xvfb-run -a python3 tools/vfx3/verify_benchmarks.py
xvfb-run -a python3 tools/vfx3/verify_remaster.py
xvfb-run -a python3 tools/vfx3/record_lifecycle.py
python3 tools/vfx3/assemble_lifecycle.py
```

检查版下拉菜单新增R11状态与事件选项。真实出招沿用原事件声音；此次无声录像为11组实际事件的确定性回看，12.208秒、24fps、293帧，不是概念图动画。新状态回看没有独立重放全部事件声音。

## 验证边界

Chromium/Xvfb/ANGLE/Mesa软件渲染，内存载入；没有声称实体手机、Safari、真实HTTP/file来源存档、全量E2E或硬件帧率验收。回看同步状态外观，不是完整棋盘成员/手牌/死亡的可逆规则回放；变形和复生后的成员与数值以实际结算为准。背景与卡面仍二维。功能测试通过不等于商业美术质量认证。

规格：docs/design/STATE_LIFECYCLE_R11.md。各验证脚本会在output/下生成真实检查记录。
