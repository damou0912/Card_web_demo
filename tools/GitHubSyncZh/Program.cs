using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

[assembly: AssemblyTitle("GitHub 中文同步助手")]
[assembly: AssemblyDescription("多台电脑之间的中文 GitHub 项目同步工具")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace GitHubSyncZh
{
    internal static class Program
    {
        internal static string DataDir;
        internal static string Option(string[] args, string name)
        {
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }

        [STAThread]
        private static int Main(string[] args)
        {
            // Some launchers supply both Path and PATH. .NET Framework rejects that
            // environment when starting a child process; normalize only this process.
            var groups = Environment.GetEnvironmentVariables().Cast<System.Collections.DictionaryEntry>().GroupBy(e => (string)e.Key, StringComparer.OrdinalIgnoreCase).Where(g => g.Count() > 1).ToList();
            foreach (var group in groups)
            {
                string key = (string)group.First().Key;
                string value = (string)group.OrderByDescending(e => ((string)e.Value).Length).First().Value;
                foreach (var entry in group) Environment.SetEnvironmentVariable((string)entry.Key, null);
                Environment.SetEnvironmentVariable(key, value);
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            DataDir = Option(args, "--data-dir") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GitHubSyncZh");
            Directory.CreateDirectory(DataDir);
            string testDir = Option(args, "--self-test");
            if (testDir != null)
            {
                try { return IntegrationTests.Run(Option(args, "--git") ?? ExtractGit(), testDir); }
                catch (Exception e) { File.WriteAllText(Path.Combine(DataDir, "test-failure.txt"), e.ToString()); return 1; }
            }
            Application.ThreadException += (sender, e) => MessageBox.Show(e.Exception.Message, "操作提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
            Application.Run(new StartupForm(args));
            return 0;
        }

        internal static string ExtractGit()
        {
            string destination = Path.Combine(DataDir, "git-2.53.0-4");
            string exe = Path.Combine(destination, "cmd", "git.exe");
            string marker = Path.Combine(destination, ".ready");
            using (System.Threading.Mutex mutex = new System.Threading.Mutex(false, "Local\\GitHubSyncZh-Runtime-v1"))
            {
                bool locked = false;
                try
                {
                    try { locked = mutex.WaitOne(TimeSpan.FromMinutes(3)); }
                    catch (System.Threading.AbandonedMutexException) { locked = true; }
                    if (!locked) throw new InvalidOperationException("另一份同步助手正在准备组件，请稍后再打开。");
                    if (File.Exists(marker) && File.Exists(exe)) return exe;
                    Directory.CreateDirectory(destination);
                    using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("portable-git.zip"))
                    {
                        if (stream == null) throw new InvalidOperationException("缺少内置 Git 组件，请重新运行完整构建脚本。");
                        using (ZipArchive zip = new ZipArchive(stream, ZipArchiveMode.Read))
                        {
                            foreach (ZipArchiveEntry entry in zip.Entries)
                            {
                                string full = Path.GetFullPath(Path.Combine(destination, entry.FullName));
                                if (!full.StartsWith(destination + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("组件路径无效。");
                                if (String.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(full); continue; }
                                Directory.CreateDirectory(Path.GetDirectoryName(full));
                                entry.ExtractToFile(full, true);
                            }
                        }
                    }
                    File.WriteAllText(marker, "2.53.0.windows.4");
                    return exe;
                }
                finally { if (locked) mutex.ReleaseMutex(); }
            }
        }
    }

    internal sealed class StartupForm : Form
    {
        private readonly string[] args;
        public StartupForm(string[] arguments)
        {
            args = arguments;
            Text = "GitHub 中文同步助手";
            ClientSize = new Size(480, 155);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            Font = new Font("Microsoft YaHei UI", 10);
            Controls.Add(new Label { Text = "正在准备同步助手…\n首次运行需要解压内置 Git，请稍候。", AutoSize = false, Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter });
            Shown += Start;
        }

        private async void Start(object sender, EventArgs e)
        {
            try
            {
                string exe = Program.Option(args, "--git") ?? await Task.Run(() => Program.ExtractGit());
                Hide();
                using (MainForm main = new MainForm(new GitService(exe), Program.Option(args, "--project"), Program.Option(args, "--smoke-image"))) main.ShowDialog();
            }
            catch (Exception error) { MessageBox.Show(error.Message, "启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error); }
            Close();
        }
    }
}
