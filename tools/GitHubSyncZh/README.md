# GitHub 中文同步助手

一个为 Windows 10/11 x64 编写的中文 Git 图形界面。将 Git、Git LFS 和 Git Credential Manager 嵌入单个 EXE，首次启动时解压到 `%LOCALAPPDATA%\GitHubSyncZh`。需要系统 .NET Framework 4.8，无需另外安装 Git、Python、Node.js 或 GitHub Desktop。

## 单文件安装包

双击 `GitHub中文同步助手-安装包.exe`，按照中文向导安装。默认安装到 `%LOCALAPPDATA%\Programs\GitHubSyncZh`，无需管理员权限，并创建桌面和开始菜单快捷方式。可以从 Windows 的“已安装的应用”或开始菜单卸载。卸载仅移除程序及快捷方式，保留项目、用户配置和 GitHub 凭据。

安装包包含全部程序组件，安装本身不需要联网；访问 GitHub 时需要联网。也可以继续使用免安装的 `GitHub中文同步助手.exe`。

安装包源码为 `installer.nsi`，使用 NSIS 3.13 编译；运行 `build-installer.ps1 -ReleaseDirectory <发行目录> -NsisCompiler <makensis.exe路径>` 可以重新打包。`test-installer.ps1` 在独立测试目录验证安装、更新、快捷方式和卸载，不写入真实桌面、开始菜单或卸载注册表。

## 使用

1. 本机已有 Git 项目：点击 **选择本地项目**。当前卡牌项目应选择 `D:\Card_web_demo-main\Card_web_demo-main`。
2. 另一台电脑第一次使用：复制 EXE 过去，点击 **从 GitHub 下载**，填写 `https://github.com/damou0912/Card_web_demo.git`，选择新的空文件夹。
3. 每次开始工作：**检查远端更新 → 下载更新**。
4. 修改文件后：**刷新本地 → 勾选文件 → 填写修改说明 → 保存并上传**。
5. 换电脑前等上传成功，另一台电脑再检查并下载更新。两端使用同一分支。

“保存本地版本”只是生成本地提交。“上传已存版本”只上传已有提交，不会自动保存尚未提交的文件。提交已成功但上传失败时，本地版本仍然保留，解决网络或权限问题后重试上传即可。

## 首次登录

点击 **提交身份**，填写版本记录中显示的姓名和邮箱，只影响当前项目。可以使用 GitHub 提供的隐私邮箱。

首次上传或访问私有仓库时，Git Credential Manager 会根据账号状态显示登录提示或打开浏览器。请本人完成 GitHub 授权，然后返回工具等待操作结束。账号凭据由 Git Credential Manager / Windows 凭据管理器处理，本工具不收集密码、令牌，也不把凭据放进仓库地址。

“连接 GitHub”用于添加或修改现有 Git 项目的 origin 地址。远端仓库需要先在 GitHub 创建好；本版本不自动创建 GitHub 仓库，也不把普通文件夹自动初始化成 Git 项目。

## 检查文件

- 文件改动：点击文件显示当前文件相对最近提交的文本差异；勾选要保存的文件。
- 历史版本：显示最近 60 个提交，点击可查看说明、变更统计和补丁。
- 图片、Excel、Unity 等二进制文件可以同步，但不支持逐行文本比较。
- `.gitignore` 已忽略且未被跟踪的文件不参与同步。
- 嵌套独立仓库不可勾选，应作为另一个项目打开；已注册的子模块应使用专业 Git 工具管理。
- 超过或等于 100 MiB 的普通文件会被拦截；已配置 `filter=lfs` 的文件交给内置 Git LFS 处理。LFS 规则及 GitHub 配额需自行配置。

## 两台电脑同时修改

下载采用快进更新，不会自动丢弃本地改动；上传不使用强制推送。

如果两边都有新提交：先 **保存本地版本**，再点 **合并远端**。不冲突的改动会合并到一起。发生冲突时，可逐个文件选择保留本机版本、保留远端版本，或手动编辑后标记已解决。全部处理后点击 **完成合并 → 上传已存版本**。

“保留本机/远端版本”以整个文件为单位，不是逐行选择。手动编辑冲突文件时，应先移除 `<<<<<<<`、`=======`、`>>>>>>>` 冲突标记，再点击标记已解决。修改/删除冲突中，选择已删除的一侧会删除该冲突文件。

## 构建

源码：`Program.cs`、`GitService.cs`、`MainForm.cs`、`IntegrationTests.cs`。

使用 Windows PowerShell 或 PowerShell 7：

```powershell
.\build.ps1 -GitRoot 'C:\path\to\portable-git' -OutputDirectory 'D:\release'
```

`GitRoot` 应包含 `cmd\git.exe` 以及 `mingw64\bin\git-credential-manager.exe`。本次构建采用本机 GitHub Desktop 提供的 Git 2.53.0.windows.4、Git Credential Manager 2.9.0 和 Git LFS 3.7.1。打包整个 Git 目录，不打包用户配置、凭据或项目内容。

脚本也可自动查找本机 GitHub Desktop 的 Git 组件。使用系统 .NET Framework C# 编译器生成 x64 EXE；`-SkipBundle` 可快速生成开发版，此时运行需加 `--git 'C:\path\to\git.exe'`。

运行集成测试（仅创建独立临时仓库，不访问 GitHub）：

```powershell
$p = Start-Process '.\dist\GitHub中文同步助手.exe' -ArgumentList '--self-test "D:\test-output" --data-dir "D:\test-data"' -Wait -PassThru
$p.ExitCode
Get-Content 'D:\test-output\test-results.txt'
```

集成测试使用独立本地裸仓库模拟 GitHub，以及两个克隆模拟两台电脑。覆盖首次提交、分支跟踪、上传下载、中文及特殊字符路径、其他暂存内容的保留、删除/重命名、冲突处理、分叉阻止覆盖和嵌套仓库。实际 GitHub OAuth 登录和向你的远端写入需由你首次使用时完成，测试不执行这些操作。

## 组件与参考

- Git 自带许可：EXE 内的 Git 组件保留原 `LICENSE.txt`，发行目录另附副本。
- Git for Windows 源码与发行信息：https://github.com/git-for-windows/git
- GitHub Desktop Git 打包工程：https://github.com/desktop/dugite-native
- Git Credential Manager：https://github.com/git-ecosystem/git-credential-manager
- Git LFS：https://github.com/git-lfs/git-lfs
- GitHub 登录文档：https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git

此工具是独立开发的中文客户端，不是 GitHub Desktop 官方汉化版本。
