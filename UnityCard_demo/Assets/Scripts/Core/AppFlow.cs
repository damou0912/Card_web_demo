using System;
using System.Text.RegularExpressions;

namespace CardDemo.Core
{
    public enum AppPage { Loading, Login, Home, Battle }

    // Navigation is independent of Unity and never substitutes a local name for server identity.
    public sealed class AppFlow
    {
        public AppPage Page { get; private set; } = AppPage.Loading;
        public string PlayerId { get; private set; }
        public bool IsGuest { get; private set; }
        public void Loaded() { Require(AppPage.Loading); Page = AppPage.Login; }
        public void Enter(string playerId, bool guest)
        {
            Require(AppPage.Login);
            if (string.IsNullOrWhiteSpace(playerId) || playerId.Trim().Length > 32)
                throw new ArgumentException("玩家 ID 应为 1～32 个字符。");
            PlayerId = playerId.Trim(); IsGuest = guest; Page = AppPage.Home;
        }
        public void StartBattle(int boardSize)
        {
            Require(AppPage.Home);
            if (boardSize != 4 && boardSize != 5) throw new ArgumentException("请选择 4×4 或 5×5 地图。");
            Page = AppPage.Battle;
        }
        public void LeaveBattle() { Require(AppPage.Battle); Page = AppPage.Home; }
        public void Logout() { Require(AppPage.Home); PlayerId = null; IsGuest = false; Page = AppPage.Login; }
        private void Require(AppPage expected)
        { if (Page != expected) throw new InvalidOperationException("当前页面不能执行此操作：" + Page); }
    }

    public static class AccountEndpoint
    {
        // The Web server exposes root-relative /api routes. Never send credentials to a redirect.
        public static string Normalize(string address)
        {
            Uri uri;
            if (!Uri.TryCreate((address ?? "").Trim(), UriKind.Absolute, out uri)
                || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Query)
                || !string.IsNullOrEmpty(uri.Fragment) || uri.AbsolutePath != "/"
                || (uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback)))
                throw new ArgumentException("填写 Web 服务根地址：线上必须为 HTTPS；HTTP 仅限 localhost / 127.0.0.1。不要附带路径、账号或参数。");
            return uri.GetLeftPart(UriPartial.Authority);
        }
        public static string SessionCookie(string header)
        {
            var match = Regex.Match(header ?? "", @"(?:^|[,;]\s*)card_session=([a-f0-9]{64})(?:;|$)");
            return match.Success ? "card_session=" + match.Groups[1].Value : null;
        }
    }
}
