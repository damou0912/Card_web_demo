# Railway 部署

## 1. 创建代码仓库

1. 在 GitHub 创建一个新的空仓库，例如 `card-demo-online`。
2. 将本项目文件上传到仓库根目录。不要上传 `outputs/`、日志、调试探针或 `.env` 文件。

## 2. 创建 Railway 服务

1. 登录 Railway，选择 **New Project** -> **Deploy from GitHub repo**。
2. 选择刚才的仓库。
3. Railway 会读取 `package.json`，自动执行 `npm start`。
4. 在服务的 **Settings** -> **Networking** 中生成公网域名。
5. 用 `https://你的域名/health` 检查服务是否返回 `{"ok":true}`。

## 3. 当前服务能力

`railway-server.js` 同时提供网页静态文件和 WebSocket 房间基础服务，支持创建房间、房间码加入、玩家加入/离开通知及游戏消息转发。

当前网页仍以本地 V2 对局为主；联网房间 UI 和服务端权威结算需要在公网服务部署成功后接入验证。
