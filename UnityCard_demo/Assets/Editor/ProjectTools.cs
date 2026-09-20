using System;
using System.IO;
using System.Linq;
using CardDemo.Core;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace CardDemo.Editor
{
    [InitializeOnLoad]
    public static class ProjectTools
    {
        public const string MainScene = "Assets/Scenes/Main.unity";
        private const string SetupStamp = "ProjectSettings/CardDemoSetup.json";

        static ProjectTools()
        {
            EditorApplication.delayCall += () =>
            {
                if (EditorApplication.isPlayingOrWillChangePlaymode) return;
                // Unity generates platform defaults on first import; commit explicit project identity once.
                if (!File.Exists(SetupStamp)) ApplyDefaults();
                if (EditorBuildSettings.scenes.Length == 0)
                    EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MainScene, true) };
            };
        }

        [MenuItem("Card Demo/Apply Project Defaults")]
        public static void ApplyDefaults()
        {
            PlayerSettings.companyName = "CardDemo";
            PlayerSettings.productName = "UnityCard_demo";
            PlayerSettings.bundleVersion = "0.1.0";
            PlayerSettings.defaultScreenWidth = 1600;
            PlayerSettings.defaultScreenHeight = 1000;
            PlayerSettings.defaultIsNativeResolution = false;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.runInBackground = true;
            // uGUI StandaloneInputModule uses the legacy input manager included in this project.
            var playerSettingsAssets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (playerSettingsAssets.Length > 0)
            {
                var settings = new SerializedObject(playerSettingsAssets[0]);
                var inputHandling = settings.FindProperty("activeInputHandler");
                if (inputHandling != null) { inputHandling.intValue = 0; settings.ApplyModifiedPropertiesWithoutUndo(); }
            }
            EditorSettings.serializationMode = SerializationMode.ForceText;
            AssetDatabase.SaveAssets();
            File.WriteAllText(SetupStamp, "{\"schemaVersion\":1}\n");
        }

        [MenuItem("Card Demo/Open Demo Scene")]
        public static void OpenScene()
        {
            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) EditorSceneManager.OpenScene(MainScene);
        }

        [MenuItem("Card Demo/Validate Project")]
        public static void ValidateProject()
        {
            if (!File.Exists(SetupStamp)) ApplyDefaults();
            var config = JsonUtility.FromJson<GameConfig>(File.ReadAllText("Assets/Resources/Config/game-config.json"));
            config.Validate();
            var demo = JsonUtility.FromJson<CardCatalog>(File.ReadAllText("Assets/Resources/Data/demo-cards.json"));
            new GameEngine(config, demo.cards, 1);
            var workshop = WorkshopStore.Load();
            WorkshopValidation.ThrowIfInvalid(workshop);
            if (config.useWorkshopCards)
                new GameEngine(config, workshop.cards, 1, workshop.ResolveDeck(config.playerDeckId, config.deckSize), workshop.ResolveDeck(config.aiDeckId, config.deckSize));
            var web = JsonUtility.FromJson<CardCatalog>(File.ReadAllText("Assets/Resources/Data/web-card-catalog.json"));
            if (web.cards == null || web.cards.Length < 60 || web.cards.Select(c => c.id).Distinct().Count() != web.cards.Length)
                throw new InvalidOperationException("正式卡牌参考数据不完整或 ID 重复。");
            if (Resources.Load<Font>("Fonts/NotoSansSC-Regular") == null)
                throw new InvalidOperationException("缺少随项目分发的中文字体。");
            if (!File.Exists(MainScene)) throw new InvalidOperationException("缺少 Main 场景。");
            Debug.Log("UnityCard_demo validation passed. Reference cards: " + web.cards.Length);
        }

        [MenuItem("Card Demo/Build/Windows x64 Demo")]
        public static void BuildWindows()
        {
            Build(BuildTarget.StandaloneWindows64, "Builds/Windows/UnityCard_demo.exe");
        }

        [MenuItem("Card Demo/Build/WebGL Demo (not WeChat)")]
        public static void BuildWebGL()
        {
            Build(BuildTarget.WebGL, "Builds/WebGL");
        }

        private static void Build(BuildTarget target, string destination)
        {
            ValidateProject();
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroupFor(target), target))
                throw new InvalidOperationException("请在 Unity Hub 中为该编辑器安装目标平台模块：" + target);
            Directory.CreateDirectory(Path.GetDirectoryName(destination));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { MainScene }, locationPathName = destination,
                target = target, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("构建失败：" + report.summary.result);
            Debug.Log("Build succeeded: " + Path.GetFullPath(destination));
        }

        private static BuildTargetGroup BuildTargetGroupFor(BuildTarget target)
        {
            return target == BuildTarget.WebGL ? BuildTargetGroup.WebGL : BuildTargetGroup.Standalone;
        }
    }
}
