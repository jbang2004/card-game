# 风起之境 v0.7 — 静态发布

这是完整构建的静态网页包，**本轮未发布到公网，没有在线试玩地址**。没有修改 WaveShift 或其他业务站点。

- `Emberfall_Windborne.html`：内嵌图片、UI、规则与 Canvas 特效，适合本地试玩。
- `Emberfall_Windborne_Deploy.zip`：解压后根目录为 `index.html`、`release.json`、`README.txt`。
- `Emberfall_Windborne_Source.zip`：可编辑源码、原图、构建脚本、测试与说明。

上传静态发布包中的文件到现有静态站点的对应游戏目录即可。不需要 npm 安装，不包含 API 密钥、数据库迁移或服务器。不要把 ZIP 本身当作首页。

发布前保留旧版本。浏览器刷新后标题应为“烬域 · 风起之境”，首页副标题为“风起之境”，桌面顶栏应看到“晴昼”。手机设置中可见“山谷时光”。可与 `release.json` 的 SHA-256 核对。

继续使用相同站点来源有助于保留 localStorage，但更换域名、浏览器或清除浏览器数据会影响存档共享。无账号与云存档。Three.js 分支仍为原固定版本可选加载；手机和离线 Canvas 不依赖外部图片请求。
