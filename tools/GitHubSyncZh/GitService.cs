using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GitHubSyncZh
{
    public sealed class GitResult
    {
        public int Code;
        public string Output, Error;
        public string Text { get { return (Output + "\n" + Error).Trim(); } }
    }

    public sealed class Change
    {
        public string Code, Path, OldPath;
        public bool Nested, Conflict;
        public string Label
        {
            get
            {
                if (Nested) return "独立仓库 · 请单独打开";
                if (Conflict) return "冲突 · 需要处理";
                if (Code == "??") return "新增";
                if (Code.Contains("R")) return "重命名";
                if (Code.Contains("D")) return "删除";
                if (Code.Contains("A")) return "新增";
                return "修改";
            }
        }
    }

    public sealed class Snapshot
    {
        public string Root, Branch, Remote, Upstream;
        public int Ahead, Behind;
        public bool HasHead, Merging;
        public List<Change> Changes = new List<Change>();
        public List<string> Branches = new List<string>();
    }

    public sealed class HistoryEntry
    {
        public string Hash, ShortHash, Date, Author, Subject;
    }

    public sealed class GitService
    {
        public readonly string Exe;
        public Action<string> Log;
        public GitService(string exe) { Exe = exe; }

        // Windows CreateProcess quoting. Arguments are never passed through a shell.
        internal static string Quote(string value)
        {
            StringBuilder b = new StringBuilder("\"");
            int slashes = 0;
            foreach (char c in value)
            {
                if (c == '\\') { slashes++; continue; }
                if (c == '"') b.Append('\\', slashes * 2 + 1);
                else b.Append('\\', slashes);
                slashes = 0;
                b.Append(c);
            }
            b.Append('\\', slashes * 2);
            return b.Append('"').ToString();
        }

        public GitResult Run(string root, params string[] args) { return RunWithInput(root, null, args); }

        public GitResult RunWithInput(string root, string input, params string[] args)
        {
            List<string> all = new List<string>();
            all.AddRange(new[] { "-c", "core.quotepath=false", "-c", "color.ui=false", "-c", "credential.helper=", "-c", "credential.helper=manager" });
            if (!String.IsNullOrEmpty(root))
            {
                all.AddRange(new[] { "-c", "safe.directory=" + System.IO.Path.GetFullPath(root).Replace('\\', '/'), "-C", root });
            }
            all.AddRange(args);
            ProcessStartInfo info = new ProcessStartInfo(Exe, String.Join(" ", all.Select(Quote).ToArray()));
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.RedirectStandardInput = true;
            info.StandardOutputEncoding = Encoding.UTF8;
            info.StandardErrorEncoding = Encoding.UTF8;
            info.EnvironmentVariables["GIT_TERMINAL_PROMPT"] = "0";
            info.EnvironmentVariables["GCM_GUI_PROMPT"] = "true";
            info.EnvironmentVariables["GIT_LITERAL_PATHSPECS"] = "1";
            info.EnvironmentVariables["LC_ALL"] = "C.UTF-8";
            string gitRoot = Directory.GetParent(Directory.GetParent(Exe).FullName).FullName;
            info.EnvironmentVariables["PATH"] = System.IO.Path.Combine(gitRoot, "cmd") + ";" + System.IO.Path.Combine(gitRoot, "mingw64", "bin") + ";" + System.IO.Path.Combine(gitRoot, "usr", "bin") + ";" + Environment.GetEnvironmentVariable("PATH");
            using (Process p = new Process())
            {
                p.StartInfo = info;
                p.Start();
                Task<string> stdout = Task.Run(() => ReadBounded(p.StandardOutput));
                Task<string> stderr = Task.Run(() => ReadBounded(p.StandardError));
                if (input != null)
                {
                    byte[] bytes = new UTF8Encoding(false).GetBytes(input);
                    p.StandardInput.BaseStream.Write(bytes, 0, bytes.Length);
                }
                p.StandardInput.Close();
                bool network = args.Any(a => a == "fetch" || a == "push" || a == "clone" || a == "pull");
                if (!p.WaitForExit(network ? 600000 : 120000))
                {
                    try { p.Kill(); } catch { }
                    throw new InvalidOperationException("操作超时。请检查网络与浏览器登录状态，然后刷新项目状态。正在运行的 Git 操作可能尚未完成。");
                }
                Task.WaitAll(stdout, stderr);
                return new GitResult { Code = p.ExitCode, Output = stdout.Result, Error = stderr.Result };
            }
        }

        private static string ReadBounded(StreamReader reader)
        {
            const int cap = 4000000;
            StringBuilder b = new StringBuilder();
            char[] buffer = new char[8192];
            int count;
            bool truncated = false;
            while ((count = reader.Read(buffer, 0, buffer.Length)) > 0)
            {
                int keep = Math.Min(count, cap - b.Length);
                if (keep > 0) b.Append(buffer, 0, keep);
                if (keep < count) truncated = true;
            }
            if (truncated) b.Append("\n…内容过长，已截断显示。\n");
            return b.ToString();
        }

        public string Need(string root, params string[] args)
        {
            GitResult result = Run(root, args);
            if (result.Code != 0) throw new InvalidOperationException(Explain(result.Text));
            return result.Output.TrimEnd('\r', '\n');
        }

        public static string Explain(string raw)
        {
            string hint = "操作未完成，请查看下面的 Git 信息。";
            if (raw.IndexOf("Authentication", StringComparison.OrdinalIgnoreCase) >= 0 || raw.Contains("could not read Username")) hint = "GitHub 登录未完成或账号没有权限。请重试，并在浏览器中登录有仓库权限的账号。";
            else if (raw.Contains("non-fast-forward") || raw.Contains("fetch first") || raw.Contains("Not possible to fast-forward")) hint = "GitHub 和本机都有新提交。请先检查更新，再使用“合并远端”，处理完成后重新上传。";
            else if (raw.Contains("Could not resolve host") || raw.Contains("Failed to connect") || raw.Contains("unable to access")) hint = "无法连接 GitHub，请检查网络、代理或仓库地址后重试。";
            else if (raw.Contains("Repository not found")) hint = "仓库不存在，或当前登录账号没有访问权限。请检查仓库地址和账号。";
            else if (raw.Contains("index.lock")) hint = "项目正在被其他 Git 工具操作。请等其他操作完成后重试。";
            else if (raw.Contains("Author identity unknown")) hint = "请先在“提交身份”中填写你的姓名和邮箱。";
            return hint + "\n\n" + raw;
        }

        public string FindRoot(string folder)
        {
            string full = System.IO.Path.GetFullPath(folder);
            if (!Directory.Exists(full)) throw new InvalidOperationException("这个文件夹不存在。");
            if (Directory.Exists(System.IO.Path.Combine(full, ".git")) || File.Exists(System.IO.Path.Combine(full, ".git"))) return full;
            // A folder chosen above the actual repository is common with ZIP downloads.
            string[] children = Directory.GetDirectories(full).Where(d => Directory.Exists(System.IO.Path.Combine(d, ".git")) || File.Exists(System.IO.Path.Combine(d, ".git"))).ToArray();
            if (children.Length == 1) return children[0];
            GitResult found = Run(full, "rev-parse", "--show-toplevel");
            if (found.Code == 0) return System.IO.Path.GetFullPath(found.Output.Trim());
            throw new InvalidOperationException("这里还不是 Git 项目。请选择包含 .git 的项目目录，或使用“从 GitHub 下载”。");
        }

        public Snapshot Read(string root)
        {
            Snapshot s = new Snapshot { Root = root };
            s.HasHead = Run(root, "rev-parse", "--verify", "HEAD").Code == 0;
            GitResult branch = Run(root, "symbolic-ref", "--short", "HEAD");
            s.Branch = branch.Code == 0 ? branch.Output.Trim() : "游离状态";
            GitResult remote = Run(root, "remote", "get-url", "origin");
            s.Remote = remote.Code == 0 ? remote.Output.Trim() : "";
            GitResult upstream = Run(root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
            s.Upstream = upstream.Code == 0 ? upstream.Output.Trim() : "";
            if (s.HasHead && s.Upstream.Length > 0)
            {
                string[] counts = Need(root, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").Split(new[] { '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (counts.Length == 2) { s.Ahead = Int32.Parse(counts[0]); s.Behind = Int32.Parse(counts[1]); }
            }
            s.Changes = ParseStatus(root, Need(root, "status", "--porcelain=v1", "-z", "--untracked-files=all"));
            s.Branches = Need(root, "for-each-ref", "--format=%(refname:short)", "refs/heads/").Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries).ToList();
            string merge = Need(root, "rev-parse", "--git-path", "MERGE_HEAD");
            s.Merging = File.Exists(System.IO.Path.IsPathRooted(merge) ? merge : System.IO.Path.Combine(root, merge));
            return s;
        }

        internal static List<Change> ParseStatus(string root, string output)
        {
            string[] pieces = output.Split('\0');
            List<Change> list = new List<Change>();
            for (int i = 0; i < pieces.Length; i++)
            {
                string row = pieces[i];
                if (row.Length < 4) continue;
                Change c = new Change { Code = row.Substring(0, 2), Path = row.Substring(3) };
                if ((c.Code.Contains("R") || c.Code.Contains("C")) && i + 1 < pieces.Length) c.OldPath = pieces[++i];
                c.Conflict = new[] { "DD", "AU", "UD", "UA", "DU", "AA", "UU" }.Contains(c.Code);
                string path = System.IO.Path.Combine(root, c.Path.TrimEnd('/'));
                c.Nested = Directory.Exists(path) && (Directory.Exists(System.IO.Path.Combine(path, ".git")) || File.Exists(System.IO.Path.Combine(path, ".git")));
                list.Add(c);
            }
            return list;
        }

        public string Diff(string root, Change change)
        {
            if (change.Nested) return "这是一个独立的 Git 仓库。\n\n请用“选择本地项目”单独打开它，本工具不会把整个嵌套仓库作为普通文件提交。";
            if (change.Code == "??")
            {
                string file = System.IO.Path.Combine(root, change.Path);
                FileInfo info = new FileInfo(file);
                if (!info.Exists) return "文件已不存在，请刷新。";
                if (info.Length > 512000) return "新增文件：" + change.Path + "\n大小：" + (info.Length / 1024) + " KB\n\n文件较大，请用原应用查看内容。";
                byte[] bytes = File.ReadAllBytes(file);
                if (bytes.Take(8000).Any(b => b == 0)) return "二进制文件：" + change.Path + "\n\n图片、Excel、Unity 二进制等文件可以同步，但不支持逐行文本比较。";
                return "新增文件：" + change.Path + "\n\n" + Encoding.UTF8.GetString(bytes);
            }
            List<string> args = new List<string> { "diff", "--no-ext-diff", "--no-textconv", "--no-color" };
            if (Run(root, "rev-parse", "--verify", "HEAD").Code == 0) args.Add("HEAD");
            else args.Add("--cached");
            args.Add("--"); args.Add(change.Path);
            if (!String.IsNullOrEmpty(change.OldPath)) args.Add(change.OldPath);
            string value = Need(root, args.ToArray());
            return value.Length == 0 ? "没有可显示的文本差异。文件属性或二进制内容可能已改变。" : value;
        }

        private Snapshot Ready(string root, bool requireClean)
        {
            Snapshot s = Read(root);
            if (s.Branch == "游离状态") throw new InvalidOperationException("当前没有位于分支上，请先切换到一个本地分支。");
            if (s.Merging || s.Changes.Any(c => c.Conflict)) throw new InvalidOperationException("项目有尚未完成的合并。请先处理冲突并完成合并。");
            // An untracked embedded repository is intentionally excluded from commits.
            // Git itself still refuses a merge that would overwrite untracked paths.
            // Tracked dirty submodules continue to block working-tree updates.
            if (requireClean && s.Changes.Any(c => !(c.Nested && c.Code == "??"))) throw new InvalidOperationException("本机还有未保存的改动。请先“保存本地版本”，再下载或合并更新。子模块的改动请在对应项目中处理。");
            return s;
        }

        public void Fetch(string root)
        {
            if (String.IsNullOrEmpty(Read(root).Remote)) throw new InvalidOperationException("请先通过“连接 GitHub”设置仓库地址。");
            Need(root, "fetch", "--prune", "origin");
        }

        public string Pull(string root)
        {
            Snapshot s = Ready(root, true);
            Fetch(root);
            string target = Target(root, s);
            return Need(root, "merge", "--ff-only", target);
        }

        private string Target(string root, Snapshot s)
        {
            if (s.Upstream.Length > 0)
            {
                string remote = Need(root, "config", "--get", "branch." + s.Branch + ".remote");
                if (remote != "origin") throw new InvalidOperationException("当前分支跟踪的不是 origin。请使用 Git 工具调整跟踪分支后重试。");
                return "@{upstream}";
            }
            string target = "refs/remotes/origin/" + s.Branch;
            if (Run(root, "rev-parse", "--verify", target).Code != 0) throw new InvalidOperationException("GitHub 上还没有同名分支。请先保存本地版本并上传，或检查当前分支。");
            Need(root, "branch", "--set-upstream-to=origin/" + s.Branch, s.Branch);
            return target;
        }

        public string Merge(string root)
        {
            Snapshot s = Ready(root, true);
            Fetch(root);
            GitResult result = Run(root, "merge", "--no-edit", Target(root, s));
            if (result.Code != 0 && Read(root).Changes.Any(c => c.Conflict)) return "已开始合并，部分文件需要处理冲突。选择冲突文件后，保留所需版本或手动编辑，再标记已解决。";
            if (result.Code != 0) throw new InvalidOperationException(Explain(result.Text));
            return result.Text;
        }

        public void Push(string root)
        {
            Snapshot s = Ready(root, false);
            if (!s.HasHead) throw new InvalidOperationException("请先保存第一个本地版本。");
            if (String.IsNullOrEmpty(s.Remote)) throw new InvalidOperationException("请先通过“连接 GitHub”设置仓库地址。");
            if (s.Upstream.Length > 0)
            {
                string remote = Need(root, "config", "--get", "branch." + s.Branch + ".remote");
                string mergeRef = Need(root, "config", "--get", "branch." + s.Branch + ".merge");
                if (remote != "origin" || mergeRef != "refs/heads/" + s.Branch) throw new InvalidOperationException("当前分支的跟踪目标与 origin 上的同名分支不同。请先在 Git 工具中确认分支设置。");
            }
            // No force option: another computer's new commits can never be overwritten.
            Need(root, "push", "--set-upstream", "origin", "HEAD:refs/heads/" + s.Branch);
        }

        public string Commit(string root, IList<Change> selected, string message)
        {
            Ready(root, false);
            if (String.IsNullOrWhiteSpace(message)) throw new InvalidOperationException("请填写本次修改说明。");
            if (selected.Count == 0) throw new InvalidOperationException("请勾选要保存的文件。");
            if (selected.Any(c => c.Nested || c.Conflict)) throw new InvalidOperationException("独立仓库和未解决的冲突不能直接提交。");
            List<string> paths = new List<string>();
            List<string> addPaths = new List<string>();
            foreach (Change c in selected)
            {
                string full = System.IO.Path.GetFullPath(System.IO.Path.Combine(root, c.Path));
                if (!full.StartsWith(System.IO.Path.GetFullPath(root).TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("文件必须位于当前项目中。");
                if (File.Exists(full) && new FileInfo(full).Length >= 100L * 1024 * 1024)
                {
                    string[] attr = Need(root, "check-attr", "-z", "filter", "--", c.Path).Split('\0');
                    if (attr.Length < 3 || attr[2] != "lfs") throw new InvalidOperationException("文件达到或超过 100 MB：" + c.Path + "\n请先使用 Git LFS 管理大文件。");
                }
                paths.Add(c.Path);
                // Staged deletions and the old side of staged renames are no longer
                // in the index. Passing those to git add would fail with pathspec errors.
                if (File.Exists(full) || Directory.Exists(full) || c.Code[0] != 'D') addPaths.Add(c.Path);
                if (!String.IsNullOrEmpty(c.OldPath)) paths.Add(c.OldPath);
            }
            string input = String.Join("\0", paths.Distinct().ToArray()) + "\0";
            if (addPaths.Count > 0)
            {
                GitResult add = RunWithInput(root, String.Join("\0", addPaths.Distinct().ToArray()) + "\0", "add", "--all", "--pathspec-from-file=-", "--pathspec-file-nul");
                if (add.Code != 0) throw new InvalidOperationException(Explain(add.Text));
            }
            // --only prevents unrelated files staged by another tool from entering this commit.
            GitResult commit = RunWithInput(root, input, "commit", "--only", "-m", message, "--pathspec-from-file=-", "--pathspec-file-nul");
            if (commit.Code != 0) throw new InvalidOperationException(Explain(commit.Text));
            return commit.Text;
        }

        public void Resolve(string root, Change c, string side)
        {
            if (!Read(root).Merging || !c.Conflict) throw new InvalidOperationException("只能在合并过程中处理冲突文件。");
            if (side != "manual")
            {
                string stage = side == "ours" ? "2" : "3";
                if (Run(root, "cat-file", "-e", ":" + stage + ":" + c.Path).Code == 0) Need(root, "checkout", "--" + side, "--", c.Path);
                else { Need(root, "rm", "--", c.Path); return; }
            }
            Need(root, "add", "--all", "--", c.Path);
        }

        public void FinishMerge(string root)
        {
            Snapshot s = Read(root);
            if (!s.Merging || s.Changes.Any(c => c.Conflict)) throw new InvalidOperationException("请先解决所有冲突文件。");
            Need(root, "commit", "--no-edit");
        }

        public void Switch(string root, string branch)
        {
            Ready(root, true);
            Need(root, "switch", "--", branch);
        }

        public List<HistoryEntry> History(string root)
        {
            if (Run(root, "rev-parse", "--verify", "HEAD").Code != 0) return new List<HistoryEntry>();
            string raw = Need(root, "log", "-60", "--date=short", "--format=%H%x00%h%x00%ad%x00%an%x00%s");
            List<HistoryEntry> list = new List<HistoryEntry>();
            foreach (string row in raw.Split('\n'))
            {
                string[] p = row.TrimEnd('\r').Split('\0');
                if (p.Length >= 5) list.Add(new HistoryEntry { Hash = p[0], ShortHash = p[1], Date = p[2], Author = p[3], Subject = p[4] });
            }
            return list;
        }

        public static string ValidateUrl(string text)
        {
            Uri uri;
            if (!Uri.TryCreate(text.Trim(), UriKind.Absolute, out uri) || uri.Scheme != "https" || uri.Host != "github.com" || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0 || !uri.IsDefaultPort)
                throw new InvalidOperationException("请输入 HTTPS 仓库地址，例如 https://github.com/用户名/项目名.git。请不要在地址中包含密码或令牌。");
            string[] pieces = uri.AbsolutePath.Trim('/').Split('/');
            if (pieces.Length != 2 || pieces.Any(p => String.IsNullOrWhiteSpace(p))) throw new InvalidOperationException("仓库地址应只包含用户名和项目名。");
            return "https://github.com/" + pieces[0] + "/" + pieces[1];
        }

        public void Connect(string root, string url)
        {
            string valid = ValidateUrl(url);
            if (Run(root, "remote", "get-url", "origin").Code == 0) Need(root, "remote", "set-url", "origin", valid);
            else Need(root, "remote", "add", "origin", valid);
        }

        public void Clone(string url, string destination)
        {
            string valid = ValidateUrl(url);
            if (Directory.Exists(destination) && Directory.EnumerateFileSystemEntries(destination).Any()) throw new InvalidOperationException("目标文件夹不是空的。请选择一个新的项目文件夹。");
            Need(null, "clone", "--", valid, destination);
        }
    }
}
