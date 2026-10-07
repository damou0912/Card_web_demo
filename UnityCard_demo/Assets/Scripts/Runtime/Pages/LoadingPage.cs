using System;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    public sealed class LoadingPage
    {
        private readonly PageUi ui;
        public readonly GameObject Root;
        private readonly Text status, percent;
        private readonly RectTransform fill;
        private readonly Button retry;
        public LoadingPage(PageUi ui, Transform parent, Action onRetry)
        {
            this.ui=ui;
            var root=ui.Page(parent,"loading","01 Loading Page",ui.Theme.loadingBackground);Root=root.gameObject;
            ui.Label(root,"Eyebrow","CARD DEMO / UNITY",22,.16f,.23f,.68f,.05f,ui.Muted);
            ui.Label(root,"Title","三国卡牌",64,.16f,.30f,.68f,.12f);
            ui.Label(root,"Subtitle","载入棋盘，准备出征。",28,.16f,.43f,.68f,.06f,ui.Muted);
            var track=ui.Box(root,"Progress Track",.16f,.57f,.68f,.008f,ui.Line);
            fill=ui.Box(track,"Progress Fill",0,0,0,1,ui.Green);
            status=ui.Label(root,"Loading Status","准备读取本地资源…",23,.16f,.60f,.59f,.15f);
            percent=ui.Label(root,"Progress","0%",23,.75f,.60f,.09f,.06f,ui.Muted,TextAnchor.MiddleRight);
            retry=ui.Button(root,"Retry","重试加载",.16f,.79f,.20f,.07f,onRetry,true);retry.gameObject.SetActive(false);
            ui.Label(root,"Privacy","资源加载不需要联网。账号验证仅在你点击登录后发起。",19,.16f,.91f,.7f,.05f,ui.Muted);
            ui.Finish(root);
        }
        public void Progress(float value,string message)
        {fill.anchorMax=new Vector2(Mathf.Clamp01(value),1);status.text=message;percent.text=Mathf.RoundToInt(value*100)+"%";retry.gameObject.SetActive(false);status.color=ui.Ink;}
        public void Fail(string message) {status.text="加载失败："+message;status.color=ui.Red;retry.gameObject.SetActive(true);}
    }
}
