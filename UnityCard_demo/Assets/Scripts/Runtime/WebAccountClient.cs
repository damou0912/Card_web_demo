using System;
using System.Collections;
using System.Text;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.Networking;

namespace CardDemo
{
    [Serializable] public sealed class AccountProfile
    { public string nickname; public int totalGames, pveWins, pvpWins, challengeHighestLevel; }
    [Serializable] public sealed class AccountReply
    { public bool success; public string username, error; }
    [Serializable] internal sealed class LoginRequest { public string username, password; }

    // Session cookie is held in memory only, never PlayerPrefs or project files.
    public sealed class WebAccountClient : IDisposable
    {
        private string cookie;
        private UnityWebRequest active;
        public string Origin { get; private set; }
        public string Username { get; private set; }
        public string Error { get; private set; }
        public AccountProfile Profile { get; private set; }
        private readonly int timeout;
        public WebAccountClient(int timeoutSeconds=12) { timeout=Mathf.Clamp(timeoutSeconds,3,30); }

        public IEnumerator Login(string address,string username,string password)
        {
            Clear();
            try {Origin=AccountEndpoint.Normalize(address);}
            catch(ArgumentException e) {Error=e.Message;}
            if(Error!=null)yield break;
            if(string.IsNullOrWhiteSpace(username)||string.IsNullOrEmpty(password)) {Error="请填写用户名和密码。";yield break;}
            using(var request=Request("/api/auth/login","POST",JsonUtility.ToJson(new LoginRequest{username=username.Trim(),password=password})))
            {
                yield return request.SendWebRequest();active=null;
                if(!ReadSuccess(request))yield break;
                AccountReply reply=null;
                try{reply=JsonUtility.FromJson<AccountReply>(request.downloadHandler.text);}catch(ArgumentException){ }
                if(reply==null||!reply.success||string.IsNullOrWhiteSpace(reply.username)||reply.username.Length>32)
                {Error="登录响应格式不正确，请确认地址是本项目 Web 服务。";yield break;}
#if !UNITY_WEBGL || UNITY_EDITOR
                cookie=AccountEndpoint.SessionCookie(request.GetResponseHeader("Set-Cookie"));
                if(cookie==null){Error="服务未返回 card_session 会话，请更新 Web 服务。";yield break;}
#endif
                Username=reply.username;
            }
            // Verify the session instead of trusting a username-only login response.
            using(var request=Request("/api/auth/session","GET"))
            {
                yield return request.SendWebRequest();active=null;
                if(!ReadSuccess(request)){Username=null;cookie=null;yield break;}
                AccountReply session=null;
                try{session=JsonUtility.FromJson<AccountReply>(request.downloadHandler.text);}catch(ArgumentException){ }
                if(session==null||session.username!=Username){Clear();Error="会话校验失败，请重新登录。";yield break;}
            }
            yield return RefreshProfile();
        }
        public IEnumerator RefreshProfile()
        {
            if(Username==null)yield break;
            using(var request=Request("/api/profile/"+Uri.EscapeDataString(Username),"GET"))
            {
                yield return request.SendWebRequest();active=null;
                if(request.result==UnityWebRequest.Result.Success)
                    try{Profile=JsonUtility.FromJson<AccountProfile>(request.downloadHandler.text);}catch(ArgumentException){Profile=null;}
                // A profile failure must not masquerade as zero wins, or invalidate a valid session.
            }
        }
        public IEnumerator Logout()
        {
            Error=null;
            if(Username!=null)
                using(var request=Request("/api/auth/logout","POST","{}"))
                {
                    yield return request.SendWebRequest();active=null;
                    if(request.responseCode!=401&&!ReadSuccess(request))yield break;
                }
            Clear();
        }
        private UnityWebRequest Request(string path,string method,string json=null)
        {
            var request=new UnityWebRequest(Origin+path,method);request.downloadHandler=new DownloadHandlerBuffer();
            request.timeout=timeout;request.redirectLimit=0;request.SetRequestHeader("Accept","application/json");
            if(json!=null){request.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));request.SetRequestHeader("Content-Type","application/json");}
#if !UNITY_WEBGL || UNITY_EDITOR
            if(cookie!=null)request.SetRequestHeader("Cookie",cookie);
#endif
            active=request;return request;
        }
        private bool ReadSuccess(UnityWebRequest request)
        {
            if(request.result==UnityWebRequest.Result.Success)return true;
            Error=request.responseCode==401?"用户名、密码错误或会话已失效，请重新登录。"
                :request.responseCode>=300&&request.responseCode<400?"服务发生重定向，已停止发送凭据。请填写最终 HTTPS 地址。"
                :"无法连接账号服务（HTTP "+request.responseCode+"）。请检查地址和网络后重试。";
            return false;
        }
        private void Clear(){cookie=null;Username=null;Profile=null;Error=null;}
        public void Dispose(){if(active!=null){active.Abort();active.Dispose();active=null;}Clear();}
    }
}
