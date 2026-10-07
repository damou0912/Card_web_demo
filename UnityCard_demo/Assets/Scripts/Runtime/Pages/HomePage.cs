using System;
using System.Linq;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    public sealed class HomePage
    {
        public readonly GameObject Root;
        public int BoardSize { get; private set; }
        public bool WorkshopCards { get; private set; }
        private readonly PageUi ui;
        private readonly CardCatalog catalog;
        private readonly Button map4,map5,deck,logout,start;
        private readonly Text identity,stats,notice;
        private GameObject modal;
        private string selectedCamp="全部";
        private InputField search;
        private RectTransform list;

        public HomePage(PageUi ui,Transform parent,GameConfig config,CardCatalog catalog,Action onStart,Action onLogout,Action onRecruit)
        {
            this.ui=ui;this.catalog=catalog;BoardSize=config.boardSize;WorkshopCards=config.useWorkshopCards;
            var root=ui.Box(parent,"03 Home Page",0,0,1,1,PageUi.Paper);Root=root.gameObject;
            ui.Label(root,"Brand","三国卡牌 / CARD DEMO",27,.04f,.025f,.49f,.07f);
            identity=ui.Label(root,"Identity","",21,.55f,.025f,.25f,.07f,PageUi.Muted,TextAnchor.MiddleRight);
            logout=ui.Button(root,"Logout","切换账号 / 退出",.82f,.036f,.14f,.052f,onLogout);
            ui.Box(root,"Divider",.04f,.108f,.92f,.002f,PageUi.Line);
            ui.Label(root,"Eyebrow","02 / 模式主页",21,.055f,.14f,.6f,.035f,PageUi.Muted);
            ui.Label(root,"Heading","落子之前，先定战局。",46,.055f,.19f,.61f,.09f);
            ui.Label(root,"Intro","选择地图与测试牌库，进入独立对战页。\n正式卡牌资料可查阅，演示对局不会写入 Web 战绩。",23,.055f,.30f,.61f,.09f,PageUi.Muted);
            ui.Button(root,"PVE Mode","PVE 对战 AI\n基础规则 / 可游玩",.055f,.425f,.185f,.13f,()=>SetNotice("当前为本机 PVE：随机先后手，固定玩家视角。"),true);
            ui.Button(root,"Challenge Mode","PVE 挑战\n尚未移植",.255f,.425f,.185f,.13f,()=>SetNotice("Web 精英 AI、12 关挑战与词条奖励尚未迁入 Unity。本入口不启动普通局冒充挑战。"));
            ui.Button(root,"Online Mode","联网对战\n尚未接入",.455f,.425f,.185f,.13f,()=>SetNotice("账号登录不等于联网对局。房间、权威结算和重连仍需独立接入。"));
            ui.Label(root,"Map Label","地图大小",22,.055f,.60f,.14f,.055f);
            map4=ui.Button(root,"Map 4","4 × 4",.20f,.60f,.11f,.055f,()=>SetMap(4));
            map5=ui.Button(root,"Map 5","5 × 5",.325f,.60f,.11f,.055f,()=>SetMap(5));
            deck=ui.Button(root,"Deck Source","",.055f,.69f,.585f,.065f,()=>{WorkshopCards=!WorkshopCards;RefreshOptions();});
            start=ui.Button(root,"Start Battle","开始 PVE 对战   →",.055f,.79f,.585f,.085f,onStart,true);
            notice=ui.Label(root,"Notice","",20,.055f,.895f,.585f,.075f,PageUi.Muted);
            var side=ui.Box(root,"Profile And Rules",.70f,.15f,.25f,.72f,Color.white);
            ui.Label(side,"Profile Heading","账号档案",26,.07f,.035f,.86f,.055f);
            stats=ui.Label(side,"Profile","",22,.07f,.11f,.86f,.25f,PageUi.Muted);
            ui.Box(side,"Line",.07f,.385f,.86f,.002f,PageUi.Line);
            ui.Label(side,"Rules","本机对局规则\n\n双方各 "+config.deckSize+" 张牌，手牌上限 "+config.handLimit+"\n2 个中立守军，随机先后手\n首回合 1 次，其余 2 次行动\n占领超过一半即可获胜\n每回合 "+config.turnSeconds+" 秒",21,.07f,.415f,.86f,.42f);
            ui.Button(side,"Help","操作指南",.07f,.875f,.86f,.075f,ShowHelp);
            ui.Button(root,"Catalog","卡牌 / 卡组资料",.70f,.90f,.12f,.065f,ShowCatalog);
            ui.Button(root,"Recruit","本机招募 Demo",.835f,.90f,.115f,.065f,onRecruit);
            RefreshOptions();
        }
        public void Show(AppFlow flow,AccountProfile profile)
        {
            Root.SetActive(true);identity.text=(flow.IsGuest?"游客 · ":"已登录 · ")+flow.PlayerId;
            stats.text=flow.IsGuest?"游客模式\n\n可体验本机 PVE、查阅卡牌。\n不读取或写入账号战绩。"
                :profile==null?"账号已验证。\n\n暂未读取到档案，可继续本机对局。"
                :(string.IsNullOrEmpty(profile.nickname)?flow.PlayerId:profile.nickname)+"\n\nWeb 总对局："+profile.totalGames+"\nPVE 通关："+profile.pveWins+" / 联网胜场："+profile.pvpWins+"\n挑战最高层："+profile.challengeHighestLevel;
            SetNotice("演示卡 / 制作库有可执行技能；90 张正式卡目前作为资料展示。");Busy(false);
        }
        public void Busy(bool busy){logout.interactable=start.interactable=!busy;}
        public void SetNotice(string text){notice.text=text;}
        private void SetMap(int size){BoardSize=size;RefreshOptions();}
        private void RefreshOptions()
        {
            map4.GetComponent<Image>().color=BoardSize==4?PageUi.Line:Color.white;
            map5.GetComponent<Image>().color=BoardSize==5?PageUi.Line:Color.white;
            deck.GetComponentInChildren<Text>().text=WorkshopCards?"当前：制作库测试卡组  /  点击切换为演示牌库":"当前：基础演示牌库  /  点击切换为制作库";
        }
        private RectTransform Modal(string title)
        {
            CloseModal();var overlay=ui.Box(Root.transform,"Home Dialog",0,0,1,1,new Color(0,0,0,.5f));modal=overlay.gameObject;
            var panel=ui.Box(overlay,"Dialog",.09f,.09f,.82f,.82f,PageUi.Paper);
            ui.Label(panel,"Title",title,30,.035f,.025f,.72f,.075f);
            ui.Button(panel,"Close Dialog","关闭",.85f,.025f,.11f,.065f,CloseModal);return panel;
        }
        private void CloseModal(){if(modal!=null){modal.SetActive(false);UnityEngine.Object.Destroy(modal);modal=null;}}
        private void ShowHelp()
        {
            var panel=Modal("对战操作 / 与 Web 对应的页面区域");var content=ui.Scroll(panel,"Help Content",.035f,.14f,.93f,.80f);
            ui.Paragraph(content,"1. 主页选择 4×4 或 5×5，点击开始。对战页独立创建棋盘、手牌和 AI。");
            ui.Paragraph(content,"2. 点击手牌，再点击高亮空格放置；点击己方场上卡，再点击相邻空格或敌卡移动 / 攻击。");
            ui.Paragraph(content,"3. 我方与敌方 ID、牌库、手牌数量固定显示；计时、剩余行动在手牌上方。不会显示 AI 手牌内容。");
            ui.Paragraph(content,"4. 可取消选择、结束回合、查看技能与完整流程。还有合法行动时，结束回合需要再次确认。");
            ui.Paragraph(content,"5. 对战菜单可认输或返回主页，均需确认。返回主页后该局销毁，AI 和计时停止。结算可重开或返回主页。");
            ui.Paragraph(content,"边界：这不是完整 Web 规则移植。正式卡牌、精英挑战、联网房间、教程四节实操及账号战绩上传尚未接入；本机招募存档与 Web 账号独立。");
        }
        private void ShowCatalog()
        {
            var panel=Modal("正式卡牌 / 卡组资料 · "+catalog.cards.Length+" 张（只读）");
            search=ui.Input(panel,"Card Search","搜索卡名、ID 或技能",.035f,.13f,.55f,.065f,false,80);
            var filter=ui.Button(panel,"Camp Filter","势力：全部",.61f,.13f,.35f,.065f,()=>{
                string[] camps={"全部","三国~魏","三国~蜀","三国~吴"};selectedCamp=camps[(Array.IndexOf(camps,selectedCamp)+1)%camps.Length];
                panel.Find("Camp Filter/Label").GetComponent<Text>().text="势力："+selectedCamp;PopulateCards();
            });
            filter.GetComponentInChildren<Text>().text="势力："+selectedCamp;
            ui.Label(panel,"Catalog Notice","资料来自转表 JSON。这里只展示属性、技能文字和默认卡组，不把未迁移的技能当作可执行效果。",19,.035f,.215f,.93f,.07f,PageUi.Muted);
            list=ui.Scroll(panel,"Card List",.035f,.305f,.93f,.64f);search.onValueChanged.AddListener(_=>PopulateCards());PopulateCards();
        }
        private void PopulateCards()
        {
            foreach(Transform child in list){child.gameObject.SetActive(false);UnityEngine.Object.Destroy(child.gameObject);}
            string query=search.text.Trim();var cards=catalog.cards.Where(c=>(selectedCamp=="全部"||c.camp==selectedCamp)
                &&(c.id+" "+c.name+" "+c.skill).IndexOf(query,StringComparison.OrdinalIgnoreCase)>=0).ToArray();
            if(cards.Length==0)ui.Paragraph(list,"未找到匹配的卡牌。");
            foreach(var card in cards)ui.Paragraph(list,card.name+"   "+card.id+" / "+card.camp+" / "+card.rarity+" / 战力 "+card.baseAttack
                +(catalog.defaultCardIds!=null&&catalog.defaultCardIds.Contains(card.id)?" / 默认卡组":" / 备选卡")+"\n「"+card.skill+"」 "+card.effect+"\n");
        }
    }
}
