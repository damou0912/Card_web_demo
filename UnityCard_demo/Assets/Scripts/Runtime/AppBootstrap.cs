using System;
using System.Collections;
using CardDemo.Core;
using CardDemo.Pages;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace CardDemo
{
    [Serializable] public sealed class AppFlowConfig
    { public string serverUrl=""; public int requestTimeoutSeconds=12; public bool allowGuest=true; }

    // Main is a stable entry scene. Four independent page roots live under one navigation owner.
    public sealed class AppBootstrap : MonoBehaviour
    {
        public AppFlow Flow { get; private set; } = new AppFlow();
        public DemoBootstrap Battle { get; private set; }
        private RectTransform safe;
        private PageUi ui;
        private LoadingPage loading;
        private LoginPage login;
        private HomePage home;
        private WebAccountClient account;
        private GameConfig config;
        private AppFlowConfig appConfig;
        private CardCatalog demo, catalog;
        private WorkshopLibrary workshop;
        private bool busy;
        private Rect lastSafe;
        private Vector2 lastSize;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if(SceneManager.GetActiveScene().name=="Main"&&FindObjectOfType<AppBootstrap>()==null)
                new GameObject("Card App / Page Router").AddComponent<AppBootstrap>();
        }
        private void Awake()
        {
            Application.targetFrameRate=60;
            if(FindObjectOfType<EventSystem>()==null)new GameObject("EventSystem",typeof(EventSystem),typeof(StandaloneInputModule));
            var canvasObject=new GameObject("Application Canvas",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform,false);canvasObject.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;
            var scaler=canvasObject.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution=new Vector2(1600,1000);scaler.matchWidthOrHeight=.5f;
            var font=Resources.Load<Font>("Fonts/NotoSansSC-Regular");
            ui=new PageUi(font!=null?font:Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));
            safe=ui.Box(canvasObject.transform,"Safe Area",0,0,1,1,ui.Paper);ApplySafeArea();
            loading=new LoadingPage(ui,safe,()=>StartCoroutine(Load()));StartCoroutine(Load());
        }
        private IEnumerator Load()
        {
            if(busy)yield break;busy=true;
            string[] paths={"Config/app-flow","Config/game-config","Data/demo-cards","Data/workshop-library","Data/web-card-catalog"};
            string[] names={"页面与账号配置","对局规则配置","演示卡牌","制作库技能与卡组","正式卡牌资料"};
            for(int i=0;i<paths.Length;i++)
            {
                loading.Progress((float)i/paths.Length,"正在加载："+names[i]);
                var request=Resources.LoadAsync<TextAsset>(paths[i]);yield return request;
                string error=null;
                try
                {
                    var asset=request.asset as TextAsset;if(asset==null)throw new InvalidOperationException("缺少资源："+paths[i]);
                    switch(i)
                    {
                        case 0:appConfig=JsonUtility.FromJson<AppFlowConfig>(asset.text);if(appConfig==null||appConfig.requestTimeoutSeconds<3||appConfig.requestTimeoutSeconds>30)throw new ArgumentException("请求超时需为 3～30 秒。");break;
                        case 1:config=JsonUtility.FromJson<GameConfig>(asset.text);config.Validate();break;
                        case 2:demo=JsonUtility.FromJson<CardCatalog>(asset.text);new GameEngine(config,demo.cards,1);break;
                        case 3:workshop=JsonUtility.FromJson<WorkshopLibrary>(asset.text);WorkshopValidation.ThrowIfInvalid(workshop);foreach(var card in workshop.cards)card.effect=SkillText.Describe(card);break;
                        case 4:catalog=JsonUtility.FromJson<CardCatalog>(asset.text);if(catalog?.cards==null||catalog.cards.Length==0)throw new ArgumentException("正式卡表为空。");break;
                    }
                }
                catch(Exception e){error=e.Message;}
                if(error!=null){loading.Fail(error);busy=false;yield break;}
            }
            loading.Progress(1,"载入完成");yield return null;
            account=new WebAccountClient(appConfig.requestTimeoutSeconds);
            login=new LoginPage(ui,safe,appConfig.serverUrl,appConfig.allowGuest,()=>StartCoroutine(Login()),EnterGuest);
            home=new HomePage(ui,safe,config,catalog,StartBattle,()=>StartCoroutine(Logout()),OpenRecruit);
            home.Root.SetActive(false);loading.Root.SetActive(false);Flow.Loaded();busy=false;
        }
        private IEnumerator Login()
        {
            if(busy||Flow.Page!=AppPage.Login)yield break;busy=true;login.Busy(true);
            string password=login.Password.text;login.Password.text="";
            yield return account.Login(login.Server.text,login.Username.text,password);password=null;
            busy=false;login.Busy(false);
            if(account.Username==null||account.Error!=null){login.Message(account.Error??"登录失败，请重试。");yield break;}
            Flow.Enter(account.Username,false);ShowHome();
        }
        private void EnterGuest()
        {
            if(busy||Flow.Page!=AppPage.Login||!appConfig.allowGuest)return;
            account.Dispose();account=new WebAccountClient(appConfig.requestTimeoutSeconds);
            login.Password.text="";Flow.Enter("游客",true);ShowHome();
        }
        private void ShowHome(){login.Root.SetActive(false);home.Show(Flow,account.Profile);}
        private IEnumerator Logout()
        {
            if(busy||Flow.Page!=AppPage.Home)yield break;busy=true;home.Busy(true);
            if(!Flow.IsGuest)yield return account.Logout();
            busy=false;home.Busy(false);
            if(account.Error!=null){home.SetNotice("退出失败："+account.Error+" 当前账号仍保留，可重试。");yield break;}
            Flow.Logout();home.Root.SetActive(false);login.Root.SetActive(true);login.Password.text="";login.Message("请登录，或选择游客体验。",false);
        }
        private void StartBattle()
        {
            if(busy||Flow.Page!=AppPage.Home)return;
            try
            {
                var selected=JsonUtility.FromJson<GameConfig>(JsonUtility.ToJson(config));
                selected.boardSize=home.BoardSize;selected.playerId=Flow.PlayerId;selected.useWorkshopCards=home.WorkshopCards;
                if(selected.aiId==selected.playerId)selected.aiId+=" (AI)";
                selected.Validate();
                if(selected.useWorkshopCards){workshop.ResolveDeck(selected.playerDeckId,selected.deckSize);workshop.ResolveDeck(selected.aiDeckId,selected.deckSize);}
                var obj=new GameObject("04 Battle Page");obj.transform.SetParent(transform,false);
                Battle=obj.AddComponent<DemoBootstrap>();
                Battle.Initialize(selected,selected.useWorkshopCards?new CardCatalog{schemaVersion=1,cards=workshop.cards}:demo,selected.useWorkshopCards?workshop:null,ReturnHome);
                Flow.StartBattle(selected.boardSize);safe.gameObject.SetActive(false);
            }
            catch(Exception e)
            {if(Battle!=null){Battle.gameObject.SetActive(false);Destroy(Battle.gameObject);Battle=null;}home.SetNotice("无法开局："+e.Message);}
        }
        private void ReturnHome()
        {
            if(Flow.Page!=AppPage.Battle)return;
            // Disable immediately: Destroy is deferred, and the old AI must not get another Update.
            if(Battle!=null){Battle.gameObject.SetActive(false);Destroy(Battle.gameObject);Battle=null;}
            Flow.LeaveBattle();safe.gameObject.SetActive(true);ShowHome();
        }
        private void OpenRecruit()
        {
            if(busy||Flow.Page!=AppPage.Home||FindObjectOfType<GachaDemoPanel>()!=null)return;
            busy=true;safe.gameObject.SetActive(false);
            GachaDemoPanel.Open(()=>{if(this==null)return;busy=false;safe.gameObject.SetActive(true);home.SetNotice("已返回。本机招募进度与 Web 账号库存独立。");});
        }
        private void Update(){if(lastSafe!=Screen.safeArea||lastSize!=new Vector2(Screen.width,Screen.height))ApplySafeArea();}
        private void ApplySafeArea()
        {
            if(safe==null||Screen.width==0||Screen.height==0)return;
            lastSafe=Screen.safeArea;lastSize=new Vector2(Screen.width,Screen.height);
            safe.anchorMin=new Vector2(lastSafe.xMin/Screen.width,lastSafe.yMin/Screen.height);
            safe.anchorMax=new Vector2(lastSafe.xMax/Screen.width,lastSafe.yMax/Screen.height);
        }
        private void OnDestroy(){StopAllCoroutines();account?.Dispose();}
    }
}
