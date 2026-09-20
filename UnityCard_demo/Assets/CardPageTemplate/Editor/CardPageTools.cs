using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;

namespace CardDemo.CardPage.Editor
{
    public static class CardPageTools
    {
        public const string Root = "Assets/CardPageTemplate";
        public const string SamplePath = Root + "/Samples/ExampleCardPage.asset";
        public const string PreviewScene = Root + "/Scenes/CardPagePreview.unity";
        public const string GeneratedFolder = Root + "/Generated";

        [MenuItem("Card Demo/Tools/Card Page/1 - Edit Example Content")]
        public static void EditExample()
        {
            Selection.activeObject = LoadSample();
            EditorGUIUtility.PingObject(Selection.activeObject);
        }

        [MenuItem("Card Demo/Tools/Card Page/2 - Open Preview Scene")]
        public static void OpenPreview()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            EditorSceneManager.OpenScene(PreviewScene);
        }

        [MenuItem("Card Demo/Tools/Card Page/3 - Generate Editable Page Scene")]
        public static void GenerateEditableScene()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            { EditorUtility.DisplayDialog("请先退出 Play", "页面生成只在编辑状态执行。", "知道了"); return; }
            var data = Selection.activeObject as CardPageData;
            if (data == null) data = LoadSample();
            data.Validate();
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            if (!AssetDatabase.IsValidFolder(GeneratedFolder)) AssetDatabase.CreateFolder(Root, "Generated");
            // Never overwrite a previously customized page. Each invocation gets a new asset path.
            string destination = AssetDatabase.GenerateUniqueAssetPath(GeneratedFolder + "/CardPageEditable.unity");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var cameraObject = new GameObject("Main Camera", typeof(Camera)); cameraObject.tag = "MainCamera";
            var camera = cameraObject.GetComponent<Camera>(); camera.orthographic = true;
            camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = data.backgroundColor;
            cameraObject.transform.position = new Vector3(0, 0, -10);
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            var view = CardPageFactory.Create(data);
            Canvas.ForceUpdateCanvases();
            if (!EditorSceneManager.SaveScene(scene, destination)) throw new InvalidOperationException("无法保存生成的页面场景：" + destination);
            Selection.activeGameObject = view.gameObject;
            EditorGUIUtility.PingObject(AssetDatabase.LoadAssetAtPath<SceneAsset>(destination));
            Debug.Log("已生成可编辑卡牌页面：" + destination + "。可直接调整 Hierarchy 下的 UI；原预览场景保持不变。", view);
        }

        [MenuItem("Card Demo/Tools/Card Page/4 - Validate Template")]
        public static void ValidateTemplate()
        {
            LoadSample().Validate();
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(PreviewScene) == null) throw new InvalidOperationException("缺少卡牌页面预览场景。");
            Debug.Log("卡牌页面示例配置与预览场景存在。请打开场景 Play 检查实际布局。");
        }

        public static CardPageData LoadSample()
        {
            var data = AssetDatabase.LoadAssetAtPath<CardPageData>(SamplePath);
            if (data == null) throw new InvalidOperationException("缺少页面内容资产：" + SamplePath);
            return data;
        }

        public static void RefreshOpenPages(CardPageData data)
        {
            foreach (var view in Resources.FindObjectsOfTypeAll<CardPageView>())
            {
                if (view.content != data || EditorUtility.IsPersistent(view) || !view.gameObject.scene.IsValid() || !view.gameObject.scene.isLoaded) continue;
                if (!Application.isPlaying) Undo.RegisterFullObjectHierarchyUndo(view.gameObject, "刷新卡牌页面内容");
                view.Bind(data);
                if (!Application.isPlaying) EditorSceneManager.MarkSceneDirty(view.gameObject.scene);
            }
            Canvas.ForceUpdateCanvases();
        }
    }
}
