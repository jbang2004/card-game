# 剑光剑气 R6 交付

已实现10个角色和2把武器的差异剑技，保留原版火焰。演出设计和验证边界详见 `docs/design/SWORD_ARTS_R6.md`。

## 直接运行

随交付的 `Card_Game_Sword_Arts_R6.html` 是已构建的临时练习演示。源码中的正常入口由以下命令生成：

```bash
python3 build.py
python3 tools/vfx3/export_demo.py
node --test tests/*.test.cjs
```

`index.html` 是正常游戏；`dist/` 用于静态网页托管；`Card_Game_3D_VFX_Demo.html` 是本地检查版，临时对局使用内存存储。选择角色后点击“实际出招”；时间轴只回看效果，不重新结算或回放整段DOM移动。所有测试目标临时增加血量用于检查，不改卡池定义。

浏览器检查需要 Python Playwright、系统 Chromium 和 Linux Xvfb：

```bash
xvfb-run -a python3 tools/vfx3/verify_sword_arts.py
xvfb-run -a python3 tools/vfx3/record_sword_arts.py
```

可通过 CHROMIUM_PATH 指定浏览器。录制标签需要本机 CJK 字体，可通过 VFX_FONT 指定路径；交付不包含字体文件。

## 应用到现有仓库

当前 GitHub 连接没有写入操作，本次没有推送远程或合并。交付包含两份独立补丁，**二选一，不要都应用**：

1. `Card_Game_Sword_Arts_R6.patch`：从上版 R5 的 `bb3de7859073a8a9037f57dd20a739dc2d8a1844` 升级。
2. `Card_Game_Sword_Arts_R6_From_Main.patch`：从已合并 R4 的 main `9e5b06203fa020b479a7f174a811801c316e7dd5` 完整升级，包含本轮需要的 R5 文件。

先保存当前未提交工作；确认基线再应用，不要强行覆盖冲突。示例（补丁路径替换为本地实际路径）：

```bash
git fetch origin
git switch -c feat/character-sword-arts 9e5b06203fa020b479a7f174a811801c316e7dd5
git apply --check /path/to/Card_Game_Sword_Arts_R6_From_Main.patch
git apply /path/to/Card_Game_Sword_Arts_R6_From_Main.patch
python3 build.py
node --test tests/*.test.cjs
# 本地检查满意后再提交与推送，勿直接覆盖 main
git add src config tests tools docs DELIVERY_SWORD_ARTS_R6.md
git commit -m "feat: character-specific sword-light arts"
git push -u origin feat/character-sword-arts
```

补丁检查会在基线有差异时明确报错。没有改动纯规则、原画、存档实现，也没有网站部署动作。

## 验证记录

`verification/` 包含最终 Node 日志、167项定向浏览器报告以及补丁应用检查。完整源码包不含 node_modules、浏览器、字体、密钥或历史失败录制日志。
