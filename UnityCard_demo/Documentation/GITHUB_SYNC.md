# 仅使用 GitHub 同步

唯一同步仓库：`https://github.com/damou0912/Card_web_demo.git`，分支 `main`。
Unity 工程位于仓库的 `UnityCard_demo/` 子目录，网页文件也在这个仓库中。

## 第一次下载

1. 在另一台 Windows 电脑安装 Git for Windows，保留 Git Credential Manager。
2. 单独复制 `Download-GitHub.cmd` 到希望保存仓库的目录，例如 `D:\Games`。不要放在已经存在的 Git 仓库内。
3. 双击运行，会创建 `Card_web_demo` 并从 GitHub 克隆。已有同名目录时停止，不覆盖。
4. Unity Hub 添加 `Card_web_demo\UnityCard_demo`，不要选外层 `Card_web_demo`。

不必打开 GitHub 网页，但 Git 必须能连接 GitHub。这个脚本不改变代理或网络配置，不能绕过网络访问限制。需要认证时只在 Git 凭据窗口登录，不要把密码或令牌发进对话。

## 后续更新

关闭 Unity，双击 Unity 工程里的 **`Update-GitHub.cmd`**。

- 只从 GitHub 的 `main` 获取并快进更新。
- 检查整个仓库；有未提交／未跟踪文件、Unity 锁、未完成的合并或不在 main 时停止。
- 本地提交领先或已经分叉时停止，不自动合并、stash、重置或清理文件。
- 不自动改变 origin 地址，不接受另一个推送地址。
- Unity 自动生成的设置也可能是“本地修改”；检查后提交需要保留的内容，不要为更新而直接删除它们。

GitHub 不是 Unity 独立仓库，所以同步会更新整个仓库，而非只更新 Assets。

## 上传已提交的内容

先用 Git 客户端检查并提交修改，再运行 **`Publish-GitHub.cmd`**。该脚本上传整个仓库的已有提交（包括其中的网页提交），不会自动暂存或提交。非快进推送会被拒绝，不强行覆盖远端。

脚本只更新／上传，不自动互相调用。GitHub Actions 继续在上传后执行已有检查。

## 之前从 Gitee 下载的电脑

停止使用旧目录中的 `Update-Gitee.cmd`、`Publish-Gitee.cmd`。
旧仓库的 Unity 工程位于仓库根目录，与 GitHub 的目录和历史不同，**不要只把旧仓库的远程 URL 改成 GitHub 再拉取**。

请先保留旧目录及其所有修改，再另外克隆一份 GitHub 仓库。如果旧目录有自己制作的卡牌、图片或页面，请先备份，然后人工比较并迁移到新仓库的 `UnityCard_demo` 中；资源和对应 `.meta` 一起迁移，不要复制旧 `.git`、Library 或缓存。

本次只停用本地的 Gitee 同步配置，不删除 Gitee 线上仓库，也不修改另一台电脑的文件。旧脚本可从 Git 历史恢复，但不再用于后续更新。

## 文件位置

- `Download-GitHub.cmd`：可以单独发送到另一台电脑的首次下载器。
- `Update-GitHub.cmd`：安全快进更新。
- `Publish-GitHub.cmd`：上传已有提交。
- `Tools/Sync-GitHub.ps1`：分支、目录、远程地址与本地修改保护逻辑。

PowerShell 的执行策略只对本次进程使用 Bypass，不修改全局策略。脚本不包含账号密码或访问令牌。
