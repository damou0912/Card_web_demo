using System;
using System.Linq;
using CardDemo.Core;
using CardDemo.Pages;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Editor
{
    public enum UiPreviewKind { Loading, LoadingError, Login, LoginBusy, LoginError, HomeGuest, HomeAccount, Battle, BattleMenu, BattleResult }

    public static class UiPreviewFactory
    {
        public static GameObject Create(UiPreviewKind kind,UiTheme theme,UiLayoutProfile layout)
        {
            theme.Validate();layout.Validate();
            var root=new GameObject("UI Design Preview - "+kind);
            try
            {
                if(kind>=UiPreviewKind.Battle)
                {
                    root.AddComponent<DemoBootstrap>().BuildDesignPreview(theme,layout,(int)kind-(int)UiPreviewKind.Battle);
                }
                else
                {
                    var cameraObject=new GameObject("Preview Camera",typeof(Camera));cameraObject.transform.SetParent(root.transform,false);
                    var camera=cameraObject.GetComponent<Camera>();camera.orthographic=true;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=theme.paper;
                    cameraObject.transform.position=new Vector3(0,0,-10);
                    var canvasObject=new GameObject("Preview Canvas",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));canvasObject.transform.SetParent(root.transform,false);
                    canvasObject.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;
                    var scaler=canvasObject.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
                    scaler.referenceResolution=new Vector2(1600,1000);scaler.matchWidthOrHeight=.5f;
                    var ui=new PageUi(theme.font,theme,layout);var parent=canvasObject.transform;
                    if(kind==UiPreviewKind.Loading||kind==UiPreviewKind.LoadingError)
                    {
                        var page=new LoadingPage(ui,parent,()=>{});page.Progress(.62f,"正在加载：正式卡牌资料（预览）");
                        if(kind==UiPreviewKind.LoadingError)page.Fail("示例资源缺失。此状态用于检查错误提示与重试按钮。");
                    }
                    else if(kind<=UiPreviewKind.LoginError)
                    {
                        var page=new LoginPage(ui,parent,"",true,()=>{},()=>{});
                        if(kind==UiPreviewKind.LoginBusy)page.Busy(true);
                        if(kind==UiPreviewKind.LoginError)page.Message("用户名、密码错误或会话已失效，请重新登录。");
                    }
                    else
                    {
                        var config=JsonUtility.FromJson<GameConfig>(Resources.Load<TextAsset>("Config/game-config").text);
                        var catalog=JsonUtility.FromJson<CardCatalog>(Resources.Load<TextAsset>("Data/web-card-catalog").text);
                        var page=new HomePage(ui,parent,config,catalog,()=>{},()=>{},()=>{});
                        var flow=new AppFlow();flow.Loaded();flow.Enter("UI_Preview",kind==UiPreviewKind.HomeGuest);
                        page.Show(flow,kind==UiPreviewKind.HomeAccount?new AccountProfile{nickname="示例账号 · 非真实数据",totalGames=28,pveWins=12,pvpWins=6,challengeHighestLevel=4}:null);
                    }
                }
                // A preview must remain harmless if entered into Play or saved outside the build scene list.
                foreach(var button in root.GetComponentsInChildren<Button>(true))button.onClick.RemoveAllListeners();
                foreach(var input in root.GetComponentsInChildren<InputField>(true)){input.onValueChanged.RemoveAllListeners();input.onEndEdit.RemoveAllListeners();}
                Canvas.ForceUpdateCanvases();return root;
            }
            catch{UnityEngine.Object.DestroyImmediate(root);throw;}
        }
    }

    public sealed class UiWorkbenchWindow : EditorWindow
    {
        [SerializeField] private UiTheme theme;
        [SerializeField] private UiLayoutProfile layout;
        [SerializeField] private UiPreviewKind preview=UiPreviewKind.HomeGuest;
        [SerializeField] private GameObject previewRoot;
        private UnityEditor.Editor themeInspector,layoutInspector;
        private Vector2 scroll;
        private bool showTheme=true,showLayout;
        private string feedback;
        [MenuItem("Card Demo/UI/页面视觉工作台")]
        public static void Open(){GetWindow<UiWorkbenchWindow>("页面视觉工作台").minSize=new Vector2(430,620);}
        [MenuItem("Card Demo/UI/选择运行时主题")]
        private static void SelectTheme(){Selection.activeObject=UiTheme.Load();}
        [MenuItem("Card Demo/UI/选择运行时布局")]
        private static void SelectLayout(){Selection.activeObject=Resources.Load<UiLayoutProfile>(UiLayoutProfile.ResourcePath);}
        private void OnEnable()
        {if(theme==null)theme=Resources.Load<UiTheme>(UiTheme.ResourcePath);if(layout==null)layout=Resources.Load<UiLayoutProfile>(UiLayoutProfile.ResourcePath);Selection.selectionChanged+=Repaint;}
        private void OnDisable()
        {Selection.selectionChanged-=Repaint;if(themeInspector!=null)DestroyImmediate(themeInspector);if(layoutInspector!=null)DestroyImmediate(layoutInspector);}
        private void OnGUI()
        {
            EditorGUILayout.LabelField("UI FOUNDATION / 四页面视觉入口",EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("主题管颜色、字体与贴图；布局资产管分区位置与字号。预览不登录、不运行 AI、不读写玩家存档。",MessageType.Info);
            theme=(UiTheme)EditorGUILayout.ObjectField("主题",theme,typeof(UiTheme),false);
            layout=(UiLayoutProfile)EditorGUILayout.ObjectField("布局",layout,typeof(UiLayoutProfile),false);
            preview=(UiPreviewKind)EditorGUILayout.EnumPopup("页面 / 状态",preview);
            using(new EditorGUI.DisabledScope(EditorApplication.isPlayingOrWillChangePlaymode||theme==null||layout==null))
            {
                if(GUILayout.Button("打开独立预览场景",GUILayout.Height(30)))Try(OpenPreview);
                using(new EditorGUI.DisabledScope(previewRoot==null))
                    if(GUILayout.Button("按当前主题 / 布局刷新预览"))Try(RefreshPreview);
                var selected=Selection.activeGameObject==null?null:Selection.activeGameObject.GetComponent<UiElement>();
                EditorGUILayout.Space();EditorGUILayout.LabelField("选中节点 → 保存排版",EditorStyles.boldLabel);
                EditorGUILayout.SelectableLabel(selected==null?"在预览 Hierarchy 中选择带 UiElement 的节点。":selected.key,GUILayout.Height(35));
                bool inPreview=selected!=null&&previewRoot!=null&&selected.transform.IsChildOf(previewRoot.transform);
                using(new EditorGUI.DisabledScope(!inPreview))
                {
                    if(GUILayout.Button("记录选中节点的 RectTransform / 字号"))Try(()=>{
                        Undo.RecordObject(layout,"记录 UI 布局");layout.Record(selected);EditorUtility.SetDirty(layout);AssetDatabase.SaveAssetIfDirty(layout);
                        feedback="已保存 "+selected.key+"；使用默认布局资产时，重新打开页面即生效。";
                    });
                    if(GUILayout.Button("移除选中节点的覆盖（可撤销）"))Try(()=>{
                        Undo.RecordObject(layout,"移除 UI 布局覆盖");layout.entries.RemoveAll(e=>e.key==selected.key);EditorUtility.SetDirty(layout);AssetDatabase.SaveAssetIfDirty(layout);
                        feedback="覆盖已移除，刷新预览恢复默认布局。";
                    });
                }
                if(GUILayout.Button("检查预览：重复 ID / 文字裁切"))Try(InspectPreview);
            }
            if(!string.IsNullOrEmpty(feedback))EditorGUILayout.HelpBox(feedback,MessageType.None);
            EditorGUILayout.HelpBox("调整 RectTransform 后先记录，再刷新。自动排版的卡格、手牌和长文由外层分区控制。自定义副本仅用于预览；运行时读取 Resources/UI/AppUiTheme 与 AppUiLayout。",MessageType.None);
            scroll=EditorGUILayout.BeginScrollView(scroll);
            showTheme=EditorGUILayout.Foldout(showTheme,"主题参数",true);
            if(showTheme&&theme!=null){UnityEditor.Editor.CreateCachedEditor(theme,null,ref themeInspector);themeInspector.OnInspectorGUI();}
            showLayout=EditorGUILayout.Foldout(showLayout,"已保存的布局覆盖",true);
            if(showLayout&&layout!=null){UnityEditor.Editor.CreateCachedEditor(layout,null,ref layoutInspector);layoutInspector.OnInspectorGUI();}
            EditorGUILayout.EndScrollView();
        }
        private void Try(Action action){try{action();}catch(Exception e){feedback=e.Message;Debug.LogWarning("UI 工作台："+e.Message);}}
        private void OpenPreview()
        {
            theme.Validate();layout.Validate();
            if(!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())return;
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            previewRoot=UiPreviewFactory.Create(preview,theme,layout);Selection.activeGameObject=previewRoot;
            SceneView.RepaintAll();feedback="已创建独立预览。不会替换 Main 或加入构建列表；场景可以另存为设计稿。";
        }
        private void RefreshPreview()
        {
            if(previewRoot==null)return;theme.Validate();layout.Validate();
            if(!EditorUtility.DisplayDialog("刷新 UI 预览","未记录到布局资产的场景内调整会被替换。继续？","刷新","取消"))return;
            var scene=previewRoot.scene;
            var replacement=UiPreviewFactory.Create(preview,theme,layout);UnityEngine.SceneManagement.SceneManager.MoveGameObjectToScene(replacement,scene);
            Undo.DestroyObjectImmediate(previewRoot);Undo.RegisterCreatedObjectUndo(replacement,"刷新 UI 预览");previewRoot=replacement;
            EditorSceneManager.MarkSceneDirty(scene);Selection.activeGameObject=previewRoot;feedback="预览已刷新；可用 Undo 恢复上一版预览。";
        }
        private void InspectPreview()
        {
            theme.Validate();layout.Validate();if(previewRoot==null)throw new InvalidOperationException("请先打开预览场景。");
            Canvas.ForceUpdateCanvases();var nodes=previewRoot.GetComponentsInChildren<UiElement>(true);
            var duplicate=nodes.GroupBy(n=>n.key).Where(g=>g.Count()>1).Select(g=>g.Key).ToArray();
            var clipped=previewRoot.GetComponentsInChildren<Text>().Where(t=>t.verticalOverflow==VerticalWrapMode.Truncate&&t.preferredHeight>t.rectTransform.rect.height+1).Select(t=>t.GetComponent<UiElement>()?.key??t.name).ToArray();
            feedback="绑定节点 "+nodes.Length+"；重复 ID "+duplicate.Length+"；可能裁切 "+clipped.Length+"。\n"+string.Join("\n",duplicate.Concat(clipped).Take(12));
            Debug.Log(feedback,previewRoot);
        }
    }
}
