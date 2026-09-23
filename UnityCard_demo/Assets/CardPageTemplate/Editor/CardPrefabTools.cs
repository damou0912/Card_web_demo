using System;
using System.Linq;
using CardDemo.Core;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.CardPage.Editor
{
    public static class CardPrefabTools
    {
        public const string PrefabPath = "Assets/CardPageTemplate/Prefabs/EditableCard.prefab";

        [MenuItem("Card Demo/Tools/Card Prefab/1 - Open Editable Card")]
        public static void OpenPrefab()
        {
            var prefab = LoadPrefab();
            AssetDatabase.OpenAsset(prefab);
        }

        public static GameObject LoadPrefab()
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
            if (prefab == null) throw new InvalidOperationException("缺少卡牌预制体：" + PrefabPath);
            var view = prefab.GetComponent<CardPrefabView>();
            if (view == null) throw new InvalidOperationException("卡牌缺少 CardPrefabView。");
            view.ValidateBindings();
            return prefab;
        }

        [MenuItem("Card Demo/Tools/Card Prefab/2 - Create Preview Scene")]
        public static void CreatePreviewScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            { EditorUtility.DisplayDialog("先退出 Play", "请在编辑状态创建卡牌预览场景。", "知道了"); return; }
            var prefab = LoadPrefab();
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            string folder = CardPageTools.GeneratedFolder;
            if (!AssetDatabase.IsValidFolder(folder)) AssetDatabase.CreateFolder(CardPageTools.Root, "Generated");
            string path = AssetDatabase.GenerateUniqueAssetPath(folder + "/CardPrefabPreview.unity");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var camera = new GameObject("Main Camera", typeof(Camera)).GetComponent<Camera>();
            camera.gameObject.tag = "MainCamera"; camera.orthographic = true;
            camera.transform.position = new Vector3(0, 0, -10);
            camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color32(14, 22, 35, 255);
            var canvasObject = new GameObject("Card Preview Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1000, 800); scaler.matchWidthOrHeight = .5f;
            // Keep a genuine prefab instance, so future prefab edits propagate to the preview.
            var card = (GameObject)PrefabUtility.InstantiatePrefab(prefab, canvasObject.transform);
            Canvas.ForceUpdateCanvases();
            if (!EditorSceneManager.SaveScene(scene, path)) throw new InvalidOperationException("预览场景未能保存。");
            Selection.activeGameObject = card;
            Debug.Log("已创建卡牌预览场景：" + path + "。无需 Play 即可查看；双击原预制体编辑以更新全部实例。");
        }
    }

    [CustomEditor(typeof(CardPrefabView))]
    public sealed class CardPrefabViewInspector : UnityEditor.Editor
    {
        private CardPageData source;
        private string message;
        private string previewCardId = "01101";
        public override void OnInspectorGUI()
        {
            EditorGUILayout.HelpBox("这是单张卡牌预制体。双击 EditableCard.prefab，在 Hierarchy 选卡名、立绘或技能文字，使用 Rect 工具（T）调整。没有自动排版，也不会在 Play 时重建。", MessageType.Info);
            DrawDefaultInspector();
            EditorGUILayout.Space();
            source = (CardPageData)EditorGUILayout.ObjectField("可选：填入现有卡牌内容", source, typeof(CardPageData), false);
            var view = (CardPrefabView)target;
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("按真实卡牌势力预览角标", EditorStyles.boldLabel);
            previewCardId = EditorGUILayout.TextField("卡牌 ID", previewCardId);
            using (new EditorGUI.DisabledScope(EditorUtility.IsPersistent(view)))
            {
                if (GUILayout.Button("从卡牌资料填入并预览角标"))
                {
                    try
                    {
                        var asset = Resources.Load<TextAsset>("Data/web-card-catalog");
                        if (asset == null) throw new InvalidOperationException("正式卡牌资料文件缺失。");
                        var card = JsonUtility.FromJson<CardCatalog>(asset.text).cards.FirstOrDefault(c => c.id == previewCardId);
                        if (card == null) throw new InvalidOperationException("正式卡牌资料中找不到此 ID。");
                        Undo.RegisterFullObjectHierarchyUndo(view.gameObject, "预览势力角标");
                        view.ShowCard(card);
                        MarkChanges(view);
                        message = view.countryBadge != null && view.countryBadge.sprite != null
                            ? "已按卡牌的实际势力显示角标；位置和大小未改变。"
                            : "已填入卡牌，角标暂未加载，回退势力文字。请检查配表并导出 Lua。";
                    }
                    catch (Exception error) { message = error.Message; }
                }
            }
            using (new EditorGUI.DisabledScope(EditorUtility.IsPersistent(view) || view.artwork == null || view.artworkPlaceholder == null))
            {
                if (GUILayout.Button("换图后同步显示立绘 / 占位文字"))
                {
                    Undo.RegisterFullObjectHierarchyUndo(view.gameObject, "同步卡牌立绘显示");
                    bool hasArt = view.artwork.sprite != null;
                    view.artwork.enabled = hasArt; view.artworkPlaceholder.gameObject.SetActive(!hasArt);
                    MarkChanges(view);
                }
            }
            using (new EditorGUI.DisabledScope(source == null || EditorUtility.IsPersistent(view)))
            {
                if (GUILayout.Button("填入文字和图片（不改位置、大小、字体和颜色）"))
                {
                    try
                    {
                        source.Validate(); view.ValidateBindings();
                        Undo.RegisterFullObjectHierarchyUndo(view.gameObject, "填入卡牌内容");
                        view.ShowContent(source);
                        MarkChanges(view);
                        message = "已填入内容，排版保持不变。请保存 Prefab／场景；可 Ctrl+Z 撤销。";
                    }
                    catch (Exception error) { message = error.Message; }
                }
            }
            if (EditorUtility.IsPersistent(view)) EditorGUILayout.HelpBox("需要填入内容时，先双击预制体进入 Prefab 编辑模式。", MessageType.None);
            if (!string.IsNullOrEmpty(message)) EditorGUILayout.HelpBox(message, MessageType.Info);
        }

        private static void MarkChanges(CardPrefabView view)
        {
            foreach (var part in view.GetComponentsInChildren<Component>(true))
            {
                if (part == null) continue;
                EditorUtility.SetDirty(part); EditorUtility.SetDirty(part.gameObject);
                if (PrefabUtility.IsPartOfPrefabInstance(part))
                {
                    PrefabUtility.RecordPrefabInstancePropertyModifications(part);
                    PrefabUtility.RecordPrefabInstancePropertyModifications(part.gameObject);
                }
            }
            if (!Application.isPlaying) EditorSceneManager.MarkSceneDirty(view.gameObject.scene);
        }
    }
}
