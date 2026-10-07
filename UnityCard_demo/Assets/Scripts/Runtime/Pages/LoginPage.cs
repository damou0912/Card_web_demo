using System;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    public sealed class LoginPage
    {
        private readonly PageUi ui;
        public readonly GameObject Root;
        public readonly InputField Server, Username, Password;
        private readonly Button login, guest;
        private readonly Text message;
        public LoginPage(PageUi ui,Transform parent,string server,bool allowGuest,Action onLogin,Action onGuest)
        {
            this.ui=ui;
            var root=ui.Page(parent,"login","02 Account Login Page",ui.Theme.loginBackground);Root=root.gameObject;
            var aside=ui.Box(root,"Brand Panel",0,0,.40f,1,ui.Green);
            ui.Label(aside,"Eyebrow","CARD DEMO / 三国",24,.12f,.12f,.78f,.06f,ui.Line);
            ui.Label(aside,"Title","方寸之间\n谋定天下",60,.12f,.27f,.78f,.22f,ui.Paper);
            ui.Label(aside,"Description","与 Web 共用账号验证接口。\n无需账号，也可进入本机 PVE 演示。",26,.12f,.54f,.76f,.17f,ui.Paper);
            ui.Label(aside,"Boundary","UNITY 页面迁移\n正式技能、联网对局仍分阶段接入",21,.12f,.82f,.76f,.09f,ui.Line);
            ui.Label(root,"Step","01 / 账号登录",21,.47f,.085f,.46f,.05f,ui.Muted);
            ui.Label(root,"Heading","欢迎归来",46,.47f,.15f,.46f,.09f);
            ui.Label(root,"Server Label","Web 服务地址",22,.47f,.28f,.46f,.035f);
            Server=ui.Input(root,"Server Address","https://你的游戏服务",.47f,.325f,.46f,.065f,false,240);Server.text=server;
            ui.Label(root,"Username Label","账号",22,.47f,.415f,.46f,.035f);
            Username=ui.Input(root,"Username","输入现有 Web 账号",.47f,.46f,.46f,.065f,false,32);
            ui.Label(root,"Password Label","密码",22,.47f,.55f,.46f,.035f);
            Password=ui.Input(root,"Password","密码仅用于本次验证，不保存",.47f,.595f,.46f,.065f,true,200);
            message=ui.Label(root,"Login Message","线上使用 HTTPS；本机开发可使用 http://127.0.0.1:端口。",20,.47f,.68f,.46f,.10f,ui.Muted);
            login=ui.Button(root,"Login","登录并进入主页",.47f,.80f,.46f,.075f,onLogin,true);
            guest=ui.Button(root,"Guest","游客体验 · 不连接账号",.47f,.895f,.46f,.065f,onGuest);guest.gameObject.SetActive(allowGuest);
            ui.Finish(root);
        }
        public void Busy(bool value)
        {Server.interactable=Username.interactable=Password.interactable=login.interactable=guest.interactable=!value;login.GetComponentInChildren<Text>().text=value?"正在登录…":"登录并进入主页";if(value)Message("正在验证账号与会话…",false);}
        public void Message(string text,bool error=true){message.text=text;message.color=error?ui.Red:ui.Muted;}
    }
}
