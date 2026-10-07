using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace GitHubSyncZh
{
    internal sealed class MainForm : Form
    {
        private readonly GitService git;
        private readonly string initial, smokeImage;
        private string root;
        private Snapshot state;
        private bool busy, loading;
        private int previewVersion;
        private DateTime? checkedAt;
        private readonly Color ink = Color.FromArgb(30, 43, 65), muted = Color.FromArgb(103, 117, 138), blue = Color.FromArgb(45, 103, 216);
        private Label project, pathLabel, summary, footer, selectedLabel;
        private ComboBox branches;
        private ListView changes, history;
        private RichTextBox diff, historyDiff, log;
        private TextBox message;
        private FlowLayoutPanel actions, commitActions, conflictActions, sideButtons;
        private ProgressBar progress;
        private TabControl tabs;
        private ToolTip tips = new ToolTip();

        public MainForm(GitService service, string start, string smoke)
        {
            git = service; initial = start; smokeImage = smoke;
            Text = "GitHub 中文同步助手";
            ClientSize = new Size(1260, 820);
            MinimumSize = new Size(1080, 740);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Microsoft YaHei UI", 9.5f);
            BackColor = Color.FromArgb(244, 247, 251);
            ForeColor = ink;
            AutoScaleMode = AutoScaleMode.Dpi;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            Build();
            Shown += OnShown;
            FormClosing += (s, e) => { if (busy) { e.Cancel = true; MessageBox.Show(this, "正在执行操作，请等待完成后再关闭。", "正在同步"); } };
        }

        private Button Button(string text, Action action, bool primary = false, int width = 122)
        {
            Button b = new Button { Text = text, Width = width, Height = 38, FlatStyle = FlatStyle.Flat, BackColor = primary ? blue : Color.White, ForeColor = primary ? Color.White : ink, Margin = new Padding(0, 0, 9, 8), Cursor = Cursors.Hand, UseVisualStyleBackColor = false };
            b.FlatAppearance.BorderColor = primary ? blue : Color.FromArgb(218, 225, 236);
            b.Click += (s, e) => action();
            return b;
        }

        private Label Label(string text, float size, Color color)
        {
            return new Label { Text = text, ForeColor = color, Font = new Font("Microsoft YaHei UI", size), AutoSize = false, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft };
        }

        private RichTextBox Viewer()
        {
            return new RichTextBox { Dock = DockStyle.Fill, ReadOnly = true, WordWrap = false, BorderStyle = BorderStyle.None, BackColor = Color.FromArgb(250, 251, 253), ForeColor = ink, Font = new Font("Consolas", 10), DetectUrls = false };
        }

        private ListView List(params string[] headers)
        {
            ListView v = new ListView { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, HideSelection = false, BorderStyle = BorderStyle.None, BackColor = Color.White, MultiSelect = false };
            foreach (string h in headers) v.Columns.Add(h);
            return v;
        }

        private void Build()
        {
            TableLayoutPanel shell = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 1, Margin = Padding.Empty, Padding = Padding.Empty };
            shell.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 208));
            shell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(shell);
            Panel side = new Panel { Dock = DockStyle.Fill, BackColor = Color.FromArgb(23, 38, 63), Padding = new Padding(19, 24, 14, 20), Margin = Padding.Empty };
            shell.Controls.Add(side, 0, 0);
            Label brand = Label("同 步 助 手", 19, Color.White); brand.Dock = DockStyle.Top; brand.Height = 47;
            Label sub = Label("GITHUB  /  中文版", 9, Color.FromArgb(158, 179, 211)); sub.Dock = DockStyle.Top; sub.Height = 36;
            sideButtons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(0, 22, 0, 0) };
            sideButtons.Controls.Add(Button("选择本地项目", PickProject, false, 173));
            sideButtons.Controls.Add(Button("从 GitHub 下载", CloneDialog, false, 173));
            sideButtons.Controls.Add(Button("连接 GitHub", ConnectDialog, false, 173));
            sideButtons.Controls.Add(Button("提交身份", IdentityDialog, false, 173));
            sideButtons.Controls.Add(Button("打开项目文件夹", () => { if (HasRoot()) Process.Start("explorer.exe", GitService.Quote(root)); }, false, 173));
            sideButtons.Controls.Add(Button("在 GitHub 查看", OpenRemote, false, 173));
            Label helper = Label("每次开始：检查 → 下载\n每次结束：保存 → 上传\n\n其他电脑首次使用，选择\n“从 GitHub 下载”。\n\nWindows 64 位 · v1.0\n内置 Git，无需另行安装", 9, Color.FromArgb(164, 184, 214)); helper.Dock = DockStyle.Bottom; helper.Height = 172;
            side.Controls.Add(sideButtons); side.Controls.Add(helper); side.Controls.Add(sub); side.Controls.Add(brand);
            TableLayoutPanel main = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 6, Padding = new Padding(23, 18, 23, 14), Margin = Padding.Empty };
            main.RowStyles.Add(new RowStyle(SizeType.Absolute, 87));
            main.RowStyles.Add(new RowStyle(SizeType.Absolute, 49));
            main.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
            main.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            main.RowStyles.Add(new RowStyle(SizeType.Absolute, 148));
            main.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
            shell.Controls.Add(main, 1, 0);
            TableLayoutPanel header = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2, Margin = Padding.Empty };
            header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); header.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
            header.RowStyles.Add(new RowStyle(SizeType.Absolute, 46)); header.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            project = Label("让项目在每台电脑上保持同步", 20, ink);
            pathLabel = Label("选择一个本地项目，或从 GitHub 下载。", 9, muted); pathLabel.AutoEllipsis = true;
            header.Controls.Add(project, 0, 0); header.Controls.Add(pathLabel, 0, 1); header.SetColumnSpan(pathLabel, 2);
            branches = new ComboBox { Dock = DockStyle.Bottom, DropDownStyle = ComboBoxStyle.DropDownList, Margin = new Padding(8, 10, 0, 10) };
            branches.SelectedIndexChanged += SwitchBranch;
            header.Controls.Add(branches, 1, 0); main.Controls.Add(header, 0, 0);
            actions = new FlowLayoutPanel { Dock = DockStyle.Fill, Margin = Padding.Empty };
            actions.Controls.Add(Button("刷新本地", () => Execute("读取本地改动", () => RefreshData())));
            actions.Controls.Add(Button("检查远端更新", () => Execute("正在连接 GitHub，首次使用可能需要浏览器登录", async () => { RequireRoot(); await Task.Run(() => git.Fetch(root)); checkedAt = DateTime.Now; await RefreshData(); AppendLog("已检查 GitHub 最新状态。"); })));
            actions.Controls.Add(Button("下载更新", () => Execute("正在下载更新", async () => { RequireRoot(); AppendLog(await Task.Run(() => git.Pull(root))); checkedAt = DateTime.Now; await RefreshData(); })));
            actions.Controls.Add(Button("上传已存版本", PushOnly, true, 134));
            actions.Controls.Add(Button("合并远端", MergeRemote));
            main.Controls.Add(actions, 0, 1);
            summary = Label("尚未打开项目", 10, muted); summary.BackColor = Color.FromArgb(232, 239, 250); summary.Padding = new Padding(14, 0, 8, 0); summary.Margin = new Padding(0, 1, 0, 12); main.Controls.Add(summary, 0, 2);
            tabs = new TabControl { Dock = DockStyle.Fill, Margin = Padding.Empty, Padding = new Point(17, 7) };
            TabPage changePage = new TabPage("文件改动"); TabPage historyPage = new TabPage("历史版本"); TabPage logPage = new TabPage("操作记录"); TabPage helpPage = new TabPage("使用说明");
            tabs.TabPages.AddRange(new[] { changePage, historyPage, logPage, helpPage }); main.Controls.Add(tabs, 0, 3);
            SplitContainer split = new SplitContainer { Dock = DockStyle.Fill, Width = 950, SplitterDistance = 355, Panel1MinSize = 260, Panel2MinSize = 300, BackColor = Color.FromArgb(225, 231, 240) };
            changes = List("文件", "状态"); changes.CheckBoxes = true; changes.Columns[0].Width = 235; changes.Columns[1].Width = 140;
            changes.SelectedIndexChanged += PreviewChange;
            changes.ItemCheck += (s, e) => { Change c = changes.Items[e.Index].Tag as Change; if (c != null && (c.Nested || c.Conflict)) e.NewValue = CheckState.Unchecked; if (IsHandleCreated) BeginInvoke((Action)UpdateSelected); };
            diff = Viewer(); diff.Text = "点击左侧文件，查看本次修改。\n\n绿色 + 表示新增内容，红色 - 表示删除内容。";
            split.Panel1.Controls.Add(changes); split.Panel2.Controls.Add(diff); changePage.Controls.Add(split);
            FlowLayoutPanel checks = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 38, BackColor = Color.White };
            checks.Controls.Add(Button("全选可提交文件", () => { foreach (ListViewItem item in changes.Items) { Change c = (Change)item.Tag; item.Checked = !c.Nested && !c.Conflict; } }, false, 144));
            checks.Controls.Add(Button("全不选", () => { foreach (ListViewItem item in changes.Items) item.Checked = false; }, false, 80));
            split.Panel1.Controls.Add(checks);
            SplitContainer hs = new SplitContainer { Dock = DockStyle.Fill, Height = 400, Orientation = Orientation.Horizontal, SplitterDistance = 145, Panel1MinSize = 90, Panel2MinSize = 90 };
            history = List("版本", "日期", "提交者", "修改说明"); history.Columns[0].Width = 80; history.Columns[1].Width = 100; history.Columns[2].Width = 130; history.Columns[3].Width = 540;
            history.SelectedIndexChanged += PreviewHistory; historyDiff = Viewer(); hs.Panel1.Controls.Add(history); hs.Panel2.Controls.Add(historyDiff); historyPage.Controls.Add(hs);
            log = Viewer(); logPage.Controls.Add(log);
            RichTextBox help = Viewer(); help.Font = new Font("Microsoft YaHei UI", 10); help.WordWrap = true;
            help.Text = "日常使用\n\n1. 开始工作：检查远端更新 → 下载更新。\n2. 修改项目：保存文件后点击“刷新本地”。\n3. 结束工作：勾选文件，填写修改说明，点击“保存并上传”。\n4. 换到另一台电脑：打开同一仓库、同一分支，检查并下载更新。\n\n首次使用\n\n已有项目：选择本地项目；已有 Git 仓库会保留原有设置。\n另一台电脑：从 GitHub 下载，选择新文件夹。\n连接 GitHub：填写已创建的 GitHub 仓库 HTTPS 地址，不会自动创建远端仓库。\n提交身份：姓名和邮箱会写入版本记录，可使用 GitHub 提供的隐私邮箱。\n\nGitHub 登录\n\n首次访问私有仓库或上传时，内置 Git Credential Manager 会提示登录。\n如果出现浏览器授权页面，请完成登录，再回到这里等待结果。凭据由 Windows 凭据管理器保存。\n“提交身份”是版本署名，不等于 GitHub 登录。\n\n两台电脑都做了修改\n\n先保存本地版本，再点“合并远端”。不同位置的改动通常可以自动合并。\n如发生冲突，选择冲突文件：保留本机版本、保留远端版本，或在编辑器里手动处理后标记已解决。\n全部处理后点击“完成合并”，再上传。\n\n范围与说明\n\n只有 Git 跟踪且已提交的文件才会上传。.gitignore 排除的缓存、密码配置不会出现。\n图片、Excel、Unity 等二进制文件可以同步，但不提供逐行差异。\n内层 Git 仓库需要单独打开；已注册的子模块需使用专业 Git 工具管理。\n下载采用快进更新，上传不使用强制推送；不会自动丢弃本地改动。\n大于等于 100 MB 的文件需要事先配置 Git LFS。\n仅支持 Windows 10/11 x64，需要系统 .NET Framework 4.8。\n\n组件\n\nGit for Windows 2.53.0.windows.4（保留原 LICENSE.txt）\nGit Credential Manager 随 Git 组件一起提供。\n组件首次解压到 %LOCALAPPDATA%\\GitHubSyncZh；本工具源代码与构建说明另附。";
            helpPage.Controls.Add(help);
            TableLayoutPanel commit = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 4, Margin = new Padding(0, 10, 0, 0) };
            commit.RowStyles.Add(new RowStyle(SizeType.Absolute, 25)); commit.RowStyles.Add(new RowStyle(SizeType.Absolute, 34)); commit.RowStyles.Add(new RowStyle(SizeType.Absolute, 40)); commit.RowStyles.Add(new RowStyle(SizeType.Absolute, 40));
            selectedLabel = Label("勾选文件后保存一个版本", 9, muted); commit.Controls.Add(selectedLabel, 0, 0);
            message = new TextBox { Dock = DockStyle.Fill, Font = new Font("Microsoft YaHei UI", 10), Margin = new Padding(0, 0, 0, 5) }; tips.SetToolTip(message, "填写这次做了什么，例如：调整卡牌效果和界面"); commit.Controls.Add(message, 0, 1);
            commitActions = new FlowLayoutPanel { Dock = DockStyle.Fill, Margin = Padding.Empty };
            commitActions.Controls.Add(Button("保存本地版本", () => Save(false), false, 140)); commitActions.Controls.Add(Button("保存并上传", () => Save(true), true, 140));
            Label note = Label("保存只在本机；上传后其他电脑才能下载。", 9, muted); note.Width = 440; note.Dock = DockStyle.None; note.Height = 32; commitActions.Controls.Add(note); commit.Controls.Add(commitActions, 0, 2);
            conflictActions = new FlowLayoutPanel { Dock = DockStyle.Fill, Margin = Padding.Empty, Visible = false };
            conflictActions.Controls.Add(Button("保留本机版本", () => Resolve("ours"), false, 127)); conflictActions.Controls.Add(Button("保留远端版本", () => Resolve("theirs"), false, 127)); conflictActions.Controls.Add(Button("标记已解决", () => Resolve("manual"), false, 116)); conflictActions.Controls.Add(Button("完成合并", FinishMerge, true, 110));
            commit.Controls.Add(conflictActions, 0, 3); main.Controls.Add(commit, 0, 4);
            TableLayoutPanel bottom = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, Margin = Padding.Empty }; bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); bottom.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
            footer = Label("就绪", 9, muted); progress = new ProgressBar { Dock = DockStyle.Fill, Style = ProgressBarStyle.Marquee, Visible = false, Margin = new Padding(6, 7, 0, 7) }; bottom.Controls.Add(footer, 0, 0); bottom.Controls.Add(progress, 1, 0); main.Controls.Add(bottom, 0, 5);
        }

        private async void OnShown(object sender, EventArgs e)
        {
            string candidate = initial;
            if (candidate == null)
            {
                string config = Path.Combine(Program.DataDir, "last-project.txt");
                if (File.Exists(config)) candidate = File.ReadAllText(config).Trim();
            }
            if (candidate == null || !Directory.Exists(candidate))
            {
                foreach (string folder in new[] { AppDomain.CurrentDomain.BaseDirectory, Directory.GetParent(AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\')).FullName, Environment.CurrentDirectory })
                {
                    try { candidate = git.FindRoot(folder); break; } catch { }
                }
            }
            await ExecuteAsync("读取项目", async () => { if (candidate != null) { root = await Task.Run(() => git.FindRoot(candidate)); await RefreshData(); } });
            if (smokeImage != null)
            {
                if (changes.Items.Count > 0) { changes.Items[0].Selected = true; }
                await Task.Delay(1000);
                using (Bitmap image = new Bitmap(Width, Height)) { DrawToBitmap(image, new Rectangle(Point.Empty, Size)); image.Save(smokeImage, System.Drawing.Imaging.ImageFormat.Png); }
                Close();
            }
        }

        private bool HasRoot()
        {
            if (root != null) return true;
            MessageBox.Show(this, "请先选择本地项目，或从 GitHub 下载一个项目。", "选择项目"); return false;
        }
        private void RequireRoot() { if (root == null) throw new InvalidOperationException("请先选择本地项目。"); }
        private async void Execute(string title, Func<Task> action) { await ExecuteAsync(title, action); }
        private async Task ExecuteAsync(string title, Func<Task> action)
        {
            if (busy) return;
            busy = true; SetBusy(true); footer.Text = title; AppendLog(title);
            try
            {
                Exception failure = null;
                try { await action(); footer.Text = "完成 · " + DateTime.Now.ToString("HH:mm:ss"); }
                catch (Exception error) { failure = error; }
                if (failure != null)
                {
                    AppendLog(failure.Message); footer.Text = "操作未完成，请查看提示或操作记录。";
                    if (smokeImage == null) MessageBox.Show(this, failure.Message, "操作提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    if (root != null) { try { await RefreshData(); } catch { } }
                }
            }
            finally { busy = false; SetBusy(false); }
        }

        private void SetBusy(bool value)
        {
            actions.Enabled = !value; commitActions.Enabled = !value; sideButtons.Enabled = !value; conflictActions.Enabled = !value; branches.Enabled = !value; message.Enabled = !value; changes.Enabled = !value;
            progress.Visible = value; UseWaitCursor = value;
        }

        private async Task RefreshData()
        {
            RequireRoot();
            string current = root;
            Snapshot next = await Task.Run(() => git.Read(current));
            List<HistoryEntry> entries = await Task.Run(() => git.History(current));
            state = next;
            loading = true; previewVersion++;
            HashSet<string> selected = new HashSet<string>(changes.CheckedItems.Cast<ListViewItem>().Select(i => ((Change)i.Tag).Path));
            bool first = changes.Items.Count == 0;
            changes.BeginUpdate(); changes.Items.Clear();
            foreach (Change c in state.Changes)
            {
                ListViewItem item = new ListViewItem(c.Path); item.SubItems.Add(c.Label); item.Tag = c;
                item.Checked = !c.Nested && !c.Conflict && (first || selected.Contains(c.Path));
                if (c.Nested) item.ForeColor = muted;
                if (c.Conflict) item.ForeColor = Color.FromArgb(184, 69, 57);
                changes.Items.Add(item);
            }
            changes.EndUpdate();
            history.BeginUpdate(); history.Items.Clear();
            foreach (HistoryEntry h in entries) { ListViewItem item = new ListViewItem(new[] { h.ShortHash, h.Date, h.Author, h.Subject }); item.Tag = h; history.Items.Add(item); }
            history.EndUpdate();
            branches.Items.Clear(); foreach (string b in state.Branches) branches.Items.Add(b); if (!branches.Items.Contains(state.Branch)) branches.Items.Add(state.Branch); branches.SelectedItem = state.Branch;
            project.Text = Path.GetFileName(root.TrimEnd('\\', '/'));
            pathLabel.Text = root + "   ·   " + (state.Remote.Length == 0 ? "尚未连接 GitHub" : state.Remote); tips.SetToolTip(pathLabel, pathLabel.Text);
            string cloud = checkedAt.HasValue ? "已检查 " + checkedAt.Value.ToString("HH:mm") : "远端状态未联网刷新";
            summary.Text = "本地改动 " + state.Changes.Count + " 项     |     " + (state.Upstream.Length > 0 ? "待上传 " + state.Ahead + " 个版本     待下载 " + state.Behind + " 个版本" : "当前分支尚未建立远端跟踪") + "     |     " + cloud;
            if (state.Merging) summary.Text = "正在合并     |     待解决冲突 " + state.Changes.Count(c => c.Conflict) + " 个     |     处理完成后点击“完成合并”";
            conflictActions.Visible = state.Merging;
            diff.Text = state.Changes.Count == 0 ? "本地工作区干净，没有未保存的文件改动。\n\n点击“检查远端更新”，查看其他电脑上传的新版本。" : "点击左侧文件查看差异；勾选需要保存到版本中的文件。";
            File.WriteAllText(Path.Combine(Program.DataDir, "last-project.txt"), root, Encoding.UTF8);
            loading = false; UpdateSelected();
        }

        private void UpdateSelected() { if (!IsDisposed) selectedLabel.Text = "已勾选 " + changes.CheckedItems.Count + " 个文件  ·  修改说明（必填）"; }
        private void AppendLog(string value) { log.AppendText("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + value + "\n\n"); log.SelectionStart = log.TextLength; log.ScrollToCaret(); }

        private async void PreviewChange(object sender, EventArgs e)
        {
            if (loading || changes.SelectedItems.Count == 0 || root == null) return;
            Change c = (Change)changes.SelectedItems[0].Tag; int version = ++previewVersion; string current = root;
            diff.Text = "正在读取差异…";
            try { string text = await Task.Run(() => git.Diff(current, c)); if (version == previewVersion && !IsDisposed) PaintDiff(diff, text); }
            catch (Exception error) { if (version == previewVersion && !IsDisposed) diff.Text = error.Message; }
        }

        private async void PreviewHistory(object sender, EventArgs e)
        {
            if (loading || history.SelectedItems.Count == 0 || root == null) return;
            HistoryEntry entry = (HistoryEntry)history.SelectedItems[0].Tag; string current = root;
            try
            {
                string text = await Task.Run(() => git.Need(current, "show", "--no-ext-diff", "--no-textconv", "--stat", "--patch", "--format=fuller", entry.Hash, "--"));
                if (!IsDisposed && root == current && history.SelectedItems.Count > 0 && ((HistoryEntry)history.SelectedItems[0].Tag).Hash == entry.Hash) PaintDiff(historyDiff, text);
            }
            catch (Exception error) { if (!IsDisposed) historyDiff.Text = error.Message; }
        }

        private void PaintDiff(RichTextBox box, string text)
        {
            box.Text = text; box.SelectAll(); box.SelectionColor = ink;
            if (text.Length < 160000)
            {
                int at = 0;
                foreach (string line in text.Split('\n'))
                {
                    if (line.StartsWith("+") || line.StartsWith("-") || line.StartsWith("@@"))
                    {
                        box.Select(at, line.Length); box.SelectionColor = line.StartsWith("+") ? Color.FromArgb(21, 125, 83) : line.StartsWith("-") ? Color.FromArgb(191, 63, 64) : blue;
                    }
                    at += line.Length + 1;
                }
            }
            box.Select(0, 0); box.ScrollToCaret();
        }

        private void PickProject()
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog { Description = "选择要同步的项目目录", SelectedPath = root ?? "", ShowNewFolderButton = false })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                Execute("打开项目", async () => { string candidate = await Task.Run(() => git.FindRoot(dialog.SelectedPath)); root = candidate; checkedAt = null; changes.Items.Clear(); await RefreshData(); });
            }
        }

        private void CloneDialog()
        {
            using (InputDialog dialog = new InputDialog("从 GitHub 下载项目", new[] { "GitHub 仓库地址", "保存到新的文件夹（完整路径）" }, new[] { "https://github.com/damou0912/Card_web_demo.git", Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "GitHub", "Card_web_demo") }, "下载包含版本历史的项目。首次访问私有仓库可能需要浏览器登录。", true))
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                string url = dialog.Values[0], destination = dialog.Values[1];
                Execute("正在下载项目，首次使用可能需要浏览器登录", async () => { await Task.Run(() => git.Clone(url, Path.GetFullPath(destination))); root = Path.GetFullPath(destination); checkedAt = DateTime.Now; changes.Items.Clear(); await RefreshData(); AppendLog("下载完成，可以开始工作。"); });
            }
        }

        private void ConnectDialog()
        {
            if (!HasRoot()) return;
            using (InputDialog dialog = new InputDialog("连接 GitHub 仓库", new[] { "已创建的 GitHub 仓库地址（HTTPS）" }, new[] { state.Remote }, "将当前项目的 origin 指向此地址。此操作不会创建或上传远端仓库。", false))
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                string url = dialog.Values[0];
                Execute("连接 GitHub 仓库", async () => { await Task.Run(() => git.Connect(root, url)); checkedAt = null; await RefreshData(); });
            }
        }

        private async void IdentityDialog()
        {
            if (!HasRoot() || busy) return;
            string current = root;
            string name = (await Task.Run(() => git.Run(current, "config", "user.name"))).Output.Trim();
            string email = (await Task.Run(() => git.Run(current, "config", "user.email"))).Output.Trim();
            using (InputDialog dialog = new InputDialog("设置提交身份", new[] { "姓名 / 昵称", "邮箱（可用 GitHub 隐私邮箱）" }, new[] { name, email }, "只修改当前项目的版本署名，不会更改其他项目，也不用于登录 GitHub。", false))
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                string[] values = dialog.Values;
                Execute("保存提交身份", () => Task.Run(() => { git.Need(current, "config", "--local", "user.name", values[0]); git.Need(current, "config", "--local", "user.email", values[1]); }));
            }
        }

        private void Save(bool upload)
        {
            if (!HasRoot()) return;
            List<Change> selected = changes.CheckedItems.Cast<ListViewItem>().Select(i => (Change)i.Tag).ToList(); string note = message.Text.Trim();
            Execute(upload ? "保存并上传，首次使用可能需要浏览器登录" : "保存本地版本", async () =>
            {
                AppendLog(await Task.Run(() => git.Commit(root, selected, note)));
                message.Clear();
                if (upload)
                {
                    try { await Task.Run(() => git.Push(root)); AppendLog("已上传到 GitHub，其他电脑现在可以下载。"); }
                    catch (Exception error) { throw new InvalidOperationException("本地版本已经保存，但上传未完成。无需重复提交；处理下面的问题后，点击“上传已存版本”。\n\n" + error.Message); }
                }
                await RefreshData();
            });
        }

        private void PushOnly()
        {
            Execute("正在上传已保存的版本，首次使用可能需要浏览器登录", async () => { RequireRoot(); await Task.Run(() => git.Push(root)); AppendLog("上传完成。未提交的文件仍保留在本机。 "); await RefreshData(); });
        }

        private void MergeRemote()
        {
            if (!HasRoot()) return;
            if (MessageBox.Show(this, "把 GitHub 的更新合并到当前分支。请先保存本地改动。\n\n同一处内容有冲突时，会让你选择保留的版本。继续？", "合并远端更新", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK) return;
            Execute("合并远端更新", async () => { AppendLog(await Task.Run(() => git.Merge(root))); checkedAt = DateTime.Now; await RefreshData(); });
        }

        private void Resolve(string side)
        {
            if (changes.SelectedItems.Count == 0) { MessageBox.Show(this, "请先选择一个冲突文件。"); return; }
            Change c = (Change)changes.SelectedItems[0].Tag;
            if (!c.Conflict) { MessageBox.Show(this, "这个文件没有未解决的冲突。"); return; }
            string description = side == "ours" ? "用本机版本替换此文件的冲突内容（本机已删除时会删除该文件）" : side == "theirs" ? "用远端版本替换此文件的冲突内容（远端已删除时会删除该文件）" : "确认已手动编辑此文件，并移除所有冲突标记";
            if (MessageBox.Show(this, description + "：\n\n" + c.Path + "\n\n确认继续？", "解决冲突", MessageBoxButtons.OKCancel, MessageBoxIcon.Question) != DialogResult.OK) return;
            Execute("处理冲突文件", async () => { await Task.Run(() => git.Resolve(root, c, side)); await RefreshData(); });
        }

        private void FinishMerge()
        {
            Execute("完成合并", async () => { RequireRoot(); await Task.Run(() => git.FinishMerge(root)); AppendLog("合并已保存。点击“上传已存版本”同步到 GitHub。"); await RefreshData(); });
        }

        private void SwitchBranch(object sender, EventArgs e)
        {
            if (loading || busy || state == null || branches.SelectedItem == null || branches.SelectedItem.ToString() == state.Branch) return;
            string branch = branches.SelectedItem.ToString(); Execute("切换分支", async () => { await Task.Run(() => git.Switch(root, branch)); await RefreshData(); });
        }

        private void OpenRemote()
        {
            if (!HasRoot()) return;
            try { Process.Start(GitService.ValidateUrl(state.Remote).Replace(".git", "")); }
            catch (Exception e) { MessageBox.Show(this, e.Message, "打开 GitHub"); }
        }
    }

    internal sealed class InputDialog : Form
    {
        private readonly List<TextBox> fields = new List<TextBox>();
        public string[] Values { get { return fields.Select(f => f.Text.Trim()).ToArray(); } }
        public InputDialog(string title, string[] labels, string[] values, string hint, bool browse)
        {
            Text = title; StartPosition = FormStartPosition.CenterParent; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false;
            Font = new Font("Microsoft YaHei UI", 10); ClientSize = new Size(660, 150 + labels.Length * 72); BackColor = Color.White;
            Label info = new Label { Text = hint, Location = new Point(24, 18), Size = new Size(610, 50), ForeColor = Color.FromArgb(96, 110, 132) }; Controls.Add(info);
            for (int i = 0; i < labels.Length; i++)
            {
                int y = 76 + i * 72;
                Controls.Add(new Label { Text = labels[i], Location = new Point(24, y), Size = new Size(600, 23) });
                TextBox box = new TextBox { Text = values[i], Location = new Point(24, y + 25), Size = new Size(browse && i == 1 ? 510 : 610, 28) }; fields.Add(box); Controls.Add(box);
                if (browse && i == 1)
                {
                    Button pick = new Button { Text = "浏览…", Location = new Point(546, y + 23), Size = new Size(89, 32) };
                    pick.Click += (s, e) => { using (FolderBrowserDialog f = new FolderBrowserDialog { Description = "选择项目的保存位置（空文件夹）" }) if (f.ShowDialog(this) == DialogResult.OK) box.Text = f.SelectedPath; }; Controls.Add(pick);
                }
            }
            Button ok = new Button { Text = "确定", Location = new Point(438, ClientSize.Height - 47), Size = new Size(92, 32), BackColor = Color.FromArgb(45, 103, 216), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
            Button cancel = new Button { Text = "取消", Location = new Point(542, ClientSize.Height - 47), Size = new Size(92, 32), DialogResult = DialogResult.Cancel };
            ok.Click += (s, e) => { if (Values.Any(String.IsNullOrWhiteSpace)) { MessageBox.Show(this, "请填写所有字段。"); return; } DialogResult = DialogResult.OK; Close(); };
            Controls.Add(ok); Controls.Add(cancel); AcceptButton = ok; CancelButton = cancel;
        }
    }
}
