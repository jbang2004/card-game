# 烬域 · 鎏金酒馆 — 静态发布

现有公开站点：https://emberfall-gilded-tavern.jbang2004.chatgpt.site

Sites 项目绑定在 `.openai/hosting.json`，源码远端为 `sites`，部署目录为 `dist/`。继续更新同一项目和域名，保留浏览器的 v1 存档及四个 localStorage 键。没有账号、云存档或 PVP。

发布前运行 `npm run test:release`。`python3 build.py` 生成离线内嵌版 `index.html` 和按需请求资源的网页版本 `dist/`。生产发布仅打包 `dist/`，不上传开发演示页、原始分层制作图或依赖目录。当前表现使用 Canvas，没有 Three.js 运行时。

使用 Sites 工作流推送已验证源码，打包相同源码的构建产物，保存版本并发布至现有公开站点；发布动作必须有用户授权。以部署成功状态和线上资源核对作为上线证据，保留历史版本用于回退。

本轮体积及性能对比见 [docs/PERFORMANCE_2026-09-08.md](docs/PERFORMANCE_2026-09-08.md)。

## 私有试玩：claude.ai Artifact

不更新公开站点、只想给自己（或经分享菜单给指定的人）试玩时，可以发布成 claude.ai 的 Artifact。Artifact 最多 255 个文件、单个文本文件 16 MB，且页面不能访问其他主机，所以不能直接上传 `dist/`：

```bash
python3 build.py
python3 tools/build_artifact.py <输出目录>
```

它把图片与音效内嵌进各模块脚本、每个模块一个脚本，活立绘每张插画打成一个 JSON 包（`live/<id>.json`，展示该卡时才请求），输出约 155 个文件、41 MB，超出限制时直接报错。**从干净的检出构建**（例如 `git worktree add`），否则会把工作区里未提交的改动一起发布。发布时以 `index.html` 为页面、其余文件为附带文件；更新时发布到同一个 Artifact 链接，玩家的浏览器存档会保留。

