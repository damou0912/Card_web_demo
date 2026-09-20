using System;
using System.IO;
using CardDemo.Core;
using UnityEditor;
using UnityEngine;

namespace CardDemo.Editor
{
    // Draft is serialized with the EditorWindow so a domain reload does not discard edits.
    // Disk writes validate first, detect external changes, and retain a backup before replace.
    public static class WorkshopStore
    {
        public const string LibraryPath = "Assets/Resources/Data/workshop-library.json";
        public const string ConfigPath = "Assets/Resources/Config/game-config.json";
        public static T Clone<T>(T value) { return JsonUtility.FromJson<T>(JsonUtility.ToJson(value)); }
        public static WorkshopLibrary Load() { return JsonUtility.FromJson<WorkshopLibrary>(File.ReadAllText(LibraryPath)); }

        public static string Normalize(WorkshopLibrary library)
        {
            WorkshopValidation.ThrowIfInvalid(library);
            var result = Clone(library);
            foreach (var card in result.cards)
            {
                card.effect = SkillText.Describe(card);
                card.skill = card.abilities == null || card.abilities.Length == 0 ? "无" : string.Join(" / ", Array.ConvertAll(card.abilities, s => s.name));
            }
            return JsonUtility.ToJson(result, true) + "\n";
        }

        public static void SaveText(string destination, string contents, string expectedDisk)
        {
            string current = File.Exists(destination) ? File.ReadAllText(destination) : "";
            if (expectedDisk != null && current != expectedDisk)
                throw new InvalidOperationException("磁盘文件已被其他窗口或程序修改，未覆盖。请导出当前草稿后重新读取，再合并修改。");
            string backupDirectory = "Library/CardDemoBackups";
            Directory.CreateDirectory(backupDirectory);
            string backup = Path.Combine(backupDirectory, Path.GetFileNameWithoutExtension(destination) + "-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N") + ".json");
            string temp = destination + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                File.WriteAllText(temp, contents);
                if (File.Exists(destination))
                {
                    File.Copy(destination, backup, false);
                    File.Replace(temp, destination, null);
                }
                else File.Move(temp, destination);
            }
            finally { if (File.Exists(temp)) File.Delete(temp); }
            AssetDatabase.Refresh();
        }
    }
}
