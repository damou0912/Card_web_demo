using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace GitHubSyncZh
{
    internal static class IntegrationTests
    {
        private static List<string> checks = new List<string>();
        private static void Assert(bool condition, string label)
        {
            if (!condition) throw new Exception("FAIL: " + label);
            checks.Add("PASS: " + label);
        }
        private static void Reject(Action action, string label)
        {
            bool failed = false;
            try { action(); } catch (InvalidOperationException) { failed = true; }
            Assert(failed, label);
        }
        private static void Identity(GitService git, string root)
        {
            git.Need(root, "config", "user.name", "集成测试");
            git.Need(root, "config", "user.email", "test@example.invalid");
            git.Need(root, "config", "commit.gpgsign", "false");
            git.Need(root, "config", "core.autocrlf", "false");
        }
        private static void Write(string root, string file, string value)
        {
            string path = Path.Combine(root, file); Directory.CreateDirectory(Path.GetDirectoryName(path)); File.WriteAllText(path, value, new UTF8Encoding(false));
        }
        private static string Read(string root, string file) { return File.ReadAllText(Path.Combine(root, file)); }

        internal static int Run(string gitExe, string testParent)
        {
            string root = Path.Combine(Path.GetFullPath(testParent), "run-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N").Substring(0, 6));
            Directory.CreateDirectory(root);
            string report = Path.Combine(testParent, "test-results.txt");
            string emptyConfig = Path.Combine(root, "empty.gitconfig"); File.WriteAllText(emptyConfig, "");
            Environment.SetEnvironmentVariable("GIT_CONFIG_GLOBAL", emptyConfig);
            Environment.SetEnvironmentVariable("GIT_CONFIG_NOSYSTEM", "1");
            GitService git = new GitService(gitExe);
            try
            {
                string a = Path.Combine(root, "电脑 A 中文 & 空格"), b = Path.Combine(root, "电脑 B"), remote = Path.Combine(root, "远端.git");
                git.Need(null, "init", "--bare", "--initial-branch=main", remote);
                git.Need(null, "init", "--initial-branch=main", a); Identity(git, a);
                git.Need(a, "remote", "add", "origin", remote);
                Write(a, "卡牌.txt", "原始卡牌\n"); Write(a, "保留.txt", "原始保留\n"); Write(a, ".gitignore", "秘密.env\n"); Write(a, "秘密.env", "test-only\n");
                Assert(git.Read(a).Changes.Count == 3, "新项目识别中文文件，并遵守 .gitignore");
                git.Commit(a, git.Read(a).Changes, "首次保存 中文 & 特殊符号 \"测试\"");
                Assert(git.Read(a).Changes.Count == 0, "首次部分路径提交成功");
                git.Push(a);
                Assert(git.Read(a).Upstream == "origin/main", "首次上传建立分支跟踪");
                git.Need(null, "clone", "--", remote, b); Identity(git, b);
                Assert(Read(b, "卡牌.txt") == "原始卡牌\n", "另一台电脑克隆完整项目");
                Assert(git.FindRoot(a) == a, "识别正确仓库根目录");
                Write(a, "卡牌.txt", "本机新卡牌\n"); Write(a, "保留.txt", "另一个工具暂存的内容\n");
                git.Need(a, "add", "--", "保留.txt");
                string stagedBefore = git.Need(a, "show", ":保留.txt");
                Change card = git.Read(a).Changes.Single(c => c.Path == "卡牌.txt");
                Assert(git.Diff(a, card).Contains("+本机新卡牌"), "中文文本差异预览");
                git.Commit(a, new[] { card }, "只保存勾选文件");
                Assert(git.Need(a, "show", "HEAD:保留.txt") == "原始保留", "不会提交其他工具已暂存的文件");
                Assert(git.Need(a, "show", ":保留.txt") == stagedBefore, "其他工具暂存内容保持不变");
                git.Push(a); git.Pull(b);
                Assert(Read(b, "卡牌.txt") == "本机新卡牌\n", "电脑 A 上传后，电脑 B 可以下载");
                Write(b, "未存.txt", "未保存\n");
                Reject(() => git.Pull(b), "本地未保存改动时阻止下载");
                Assert(Read(b, "未存.txt") == "未保存\n", "被阻止的下载保留本地文件");
                git.Commit(b, git.Read(b).Changes, "保存新增文件"); git.Push(b);
                git.Commit(a, git.Read(a).Changes, "保存原先暂存的文件");
                Reject(() => git.Push(a), "远端有其他电脑的新提交时拒绝覆盖上传");
                string before = git.Need(a, "rev-parse", "HEAD");
                Reject(() => git.Pull(a), "双方都有新提交时下载不会擅自合并");
                Assert(git.Need(a, "rev-parse", "HEAD") == before, "下载拒绝后本地版本保持不变");
                git.Merge(a); git.Push(a); git.Pull(b);
                Assert(Read(b, "保留.txt") == "另一个工具暂存的内容\n" && Read(a, "未存.txt") == "未保存\n", "分叉历史无冲突合并后双方改动都保留");
                Write(a, "卡牌.txt", "电脑 A 的冲突内容\n"); git.Commit(a, git.Read(a).Changes, "A 修改"); git.Push(a);
                Write(b, "卡牌.txt", "电脑 B 的冲突内容\n"); git.Commit(b, git.Read(b).Changes, "B 修改");
                git.Merge(b);
                Snapshot conflicted = git.Read(b);
                Assert(conflicted.Merging && conflicted.Changes.Any(c => c.Conflict), "同一行冲突被正确识别");
                Reject(() => git.Push(b), "合并未完成时不能上传");
                git.Resolve(b, conflicted.Changes.Single(c => c.Conflict), "theirs"); git.FinishMerge(b); git.Push(b); git.Pull(a);
                Assert(Read(b, "卡牌.txt") == "电脑 A 的冲突内容\n" && !git.Read(b).Merging, "选择远端版本并完成冲突合并");
                git.Need(a, "mv", "--", "卡牌.txt", "重命名 [卡牌] & 测试.txt");
                Change rename = git.Read(a).Changes.Single(c => c.Code.Contains("R"));
                Assert(rename.OldPath == "卡牌.txt" && rename.Path == "重命名 [卡牌] & 测试.txt", "正确解析重命名的中文特殊字符路径");
                git.Commit(a, new[] { rename }, "重命名文件"); git.Push(a); git.Pull(b);
                Assert(File.Exists(Path.Combine(b, rename.Path)) && !File.Exists(Path.Combine(b, "卡牌.txt")), "重命名同步不丢失文件");
                File.Delete(Path.Combine(a, "未存.txt")); git.Commit(a, git.Read(a).Changes, "删除文件"); git.Push(a); git.Pull(b);
                Assert(!File.Exists(Path.Combine(b, "未存.txt")), "文件删除同步正常");
                Write(a, "[literal].txt", "literal\n");
                git.Commit(a, git.Read(a).Changes, "字面路径测试");
                Assert(git.Need(a, "show", "HEAD:[literal].txt") == "literal", "路径不被当作 Git 通配语法");
                string nested = Path.Combine(a, "嵌套仓库"); git.Need(null, "init", nested);
                Snapshot nestedState = git.Read(a);
                Assert(nestedState.Changes.Any(c => c.Nested), "嵌套仓库单独标识");
                Reject(() => git.Commit(a, nestedState.Changes, "不得提交嵌套仓库"), "阻止误提交嵌套仓库");
                git.Pull(a);
                Assert(Directory.Exists(Path.Combine(nested, ".git")), "未跟踪的嵌套仓库不阻塞正常下载，也不会被删除");
                Write(b, "暂存删除.txt", "删除测试\n"); git.Commit(b, git.Read(b).Changes, "准备删除测试");
                git.Need(b, "rm", "--", "暂存删除.txt"); git.Commit(b, git.Read(b).Changes, "提交已暂存的删除");
                Assert(git.Read(b).Changes.Count == 0, "其他工具已暂存的删除可以正常提交");
                git.Need(b, "branch", "test-switch"); git.Switch(b, "test-switch");
                Assert(git.Read(b).Branch == "test-switch", "干净项目可以切换分支");
                git.Switch(b, "main");
                Assert(git.History(b).Count > 5, "历史版本包含完整提交信息");
                Assert(GitService.ValidateUrl("https://github.com/example/project.git") == "https://github.com/example/project.git", "接受标准 GitHub HTTPS 地址");
                Reject(() => GitService.ValidateUrl("https://secret@github.com/example/project"), "拒绝地址中夹带凭据");
                Reject(() => GitService.ValidateUrl("file:///C:/something"), "拒绝非 HTTPS 仓库地址");
                Reject(() => GitService.ValidateUrl("https://github.com/example/project/tree/main"), "拒绝误填网页子路径");
                checks.Add("\nFixture: " + root);
            }
            catch (InvalidOperationException error)
            {
                // Re-throw with report below. The catch is deliberately separate for diagnostics.
                checks.Add("ERROR: " + error.ToString()); File.WriteAllLines(report, checks, Encoding.UTF8); return 1;
            }
            catch (Exception error) { checks.Add("ERROR: " + error.ToString()); File.WriteAllLines(report, checks, Encoding.UTF8); return 1; }
            File.WriteAllLines(report, checks, Encoding.UTF8);
            return 0;
        }
    }
}
