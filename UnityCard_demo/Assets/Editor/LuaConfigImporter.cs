using System.IO;
using System.Text;
using System;
using System.Collections.Generic;
using CardDemo.Core;
using CardDemo.ConfigTools;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;

namespace CardDemo.Editor
{
    // Keeps true .lua filenames while making the data available to Resources.Load<TextAsset>.
    [ScriptedImporter(1, "lua")]
    public sealed class LuaConfigImporter : ScriptedImporter
    {
        public override void OnImportAsset(AssetImportContext context)
        {
            var asset = new TextAsset(File.ReadAllText(context.assetPath, Encoding.UTF8));
            asset.name = Path.GetFileNameWithoutExtension(context.assetPath);
            context.AddObjectToAsset("lua-data", asset);
            context.SetMainObject(asset);
        }
    }

    public static class CardPresentationExport
    {
        [MenuItem("Card Demo/Tools/Presentation/Export Tables to Lua")]
        public static void Export()
        {
            string root = Path.GetDirectoryName(Application.dataPath);
            var plan = CardConfigExportPlan.Build(root,
                path => JsonUtility.FromJson<CardCatalog>(File.ReadAllText(path)),
                path => AssetDatabase.LoadAssetAtPath<Sprite>("Assets/Resources/" + path + ".png") != null);
            foreach (var output in plan.Outputs)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(output.Key));
                File.WriteAllText(output.Key, output.Value, new UTF8Encoding(false));
            }
            AssetDatabase.Refresh();
            Debug.Log("卡牌配置已导出：" + plan.CardCount + " 张卡的属性、技能展示及 " + plan.BadgeCount + " 个角标。运行中的对局请退出后重新进入。");
        }

        [MenuItem("Card Demo/Tools/Presentation/Open Source Tables")]
        public static void OpenSource()
        { EditorUtility.RevealInFinder(Path.Combine(Path.GetDirectoryName(Application.dataPath), "ConfigTables", PresentationWorkbook.CardFileName)); }

        [MenuItem("Card Demo/Tools/Presentation/Open Faction Icons")]
        public static void OpenIcons()
        { EditorUtility.RevealInFinder(Path.Combine(Path.GetDirectoryName(Application.dataPath), "ConfigTables", PresentationWorkbook.BadgeFileName)); }
    }
}
