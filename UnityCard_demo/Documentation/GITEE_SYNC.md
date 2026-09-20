# 不打开 GitHub，也能同步 Unity

备用地址：`https://gitee.com/damou_0912_0/unity-card-demo.git`

**此 Gitee 仓库只保存 Unity 工程，Assets、Packages、ProjectSettings 就在仓库根目录。**
GitHub 原仓库仍保留 `UnityCard_demo/` 子目录与网页版，两边不是可以随意互相 pull 的相同根目录。
Gitee 必须先由维护者完成首次发布 `main`，其他电脑才能下载。仓库要求认证时先在 Git 认证窗口登录；不要把密码或令牌发给任何聊天工具。

## 其他 Windows 电脑：第一次下载

1. 安装 Git for Windows（可从官网或电脑上已有的可信软件安装渠道获取）。安装时保留 Git Credential Manager。
2. 单独把 **`Download-Gitee.cmd`** 发到另一台电脑，放到希望存放项目的文件夹，例如 `D:\Games`。不需要先下载整个项目。
3. 双击运行。它会在旁边创建 `UnityCard_project`，从 Gitee 克隆；如果目录已经存在会停止，不覆盖。
4. 私有仓库按 Git 弹出的认证提示登录。网页登录和 Git 登录可能需要分别完成；若要求访问令牌，只在 Git 认证窗口输入。
5. Unity Hub → Add project from disk → 选择新建的 `UnityCard_project`。按项目说明安装 Unity **2022.3.62f3**。

如果克隆失败后留下了目录，先检查里面的内容；可以把目录重命名保存，再重试。脚本不会自动删除失败目录。

## 后续更新：只双击一个文件

关闭该项目的 Unity，然后双击工程根目录 **`Update-Gitee.cmd`**。

- 自动从 Gitee 下载并快进更新，不需要打开 GitHub。
- 本地有未提交／未跟踪文件时停止，保留你的修改。
- 本地提交领先或分叉时停止，不自动合并。
- 只接受 main 分支；绝不 reset、clean、自动 stash 或 force push。
- Unity 首次生成的项目设置也可能导致“本地修改”提示，这是保护措施，不是错误。先检查并提交需要保留的设置；不要直接删文件。

脚本只更新，不自动上传你的修改。若你也在另一台电脑制作卡牌，先用 Git 客户端检查并提交，再双击 **`Publish-Gitee.cmd`** 上传已有提交。遇到远端领先时非快进推送会被拒绝，需要先协调合并，不会覆盖远端。

## 当前 GitHub 开发电脑：发布 Unity 到 Gitee

在 GitHub 仓库中先提交 `UnityCard_demo` 的改动，然后运行该目录的 **`Publish-Gitee.cmd`**。

它用 Git subtree split 提取 Unity 子目录的提交历史，推送到 Gitee main；不会上传网页代码、网页历史、未提交文件或更改 GitHub origin。
若 Gitee 上已有其他电脑的新提交，推送被拒绝时应让维护者用 subtree 工作流导入合并，再发布；**不要强推**。

GitHub 和 Gitee 的发布是两个明确动作，不是自动后台镜像。正常发布顺序为：提交 → 检查并 push GitHub → `Publish-Gitee.cmd`。
这个目录里现有自动化测试仍由 GitHub Actions 执行，Gitee 不会自动运行 GitHub 工作流。

## 文件位置

- `Download-Gitee.cmd`：独立首下载器，可单独发送到其他电脑。
- `Update-Gitee.cmd`：双击安全更新，需要同目录的 Tools 文件夹。
- `Publish-Gitee.cmd`：上传已提交内容，不自动提交或上传 GitHub。
- `Tools/Sync-Gitee.ps1`：同步实现，支持仓库结构检查、main 检查、干净目录检查和非快进保护。

脚本不会更改全局执行策略；PowerShell 的 Bypass 仅适用于这一次进程。Git 首次认证可能缓存到系统凭据管理器，仓库文件不保存密码或令牌。
