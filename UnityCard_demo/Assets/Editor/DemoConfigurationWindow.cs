using System;
using System.IO;
using System.Linq;
using CardDemo.Core;
using UnityEditor;
using UnityEngine;

namespace CardDemo.Editor
{
    public sealed class DemoConfigurationWindow : EditorWindow
    {
        private const string ConfigPath = "Assets/Resources/Config/game-config.json";
        private GameConfig config;
        private CardCatalog catalog;
        private Vector2 scroll;
        private string query = "";
        private string error;
        private bool showCatalog;

        [MenuItem("Card Demo/Configuration")]
        public static void Open() { GetWindow<DemoConfigurationWindow>("Card Demo 配置"); }

        private void OnEnable() { Reload(); }

        private void Reload()
        {
            try
            {
                config = JsonUtility.FromJson<GameConfig>(File.ReadAllText(ConfigPath));
                catalog = JsonUtility.FromJson<CardCatalog>(File.ReadAllText("Assets/Resources/Data/web-card-catalog.json"));
                error = null;
            }
            catch (Exception exception) { error = exception.Message; }
        }

        private void OnGUI()
        {
            scroll = EditorGUILayout.BeginScrollView(scroll);
            EditorGUILayout.LabelField("UnityCard_demo · 起步工程", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("当前可玩内容是 5 种独立演示卡。正式卡表仅供查阅，正式技能、账号、联网及微信 SDK 尚未迁移。", MessageType.Info);
            if (!string.IsNullOrEmpty(error)) EditorGUILayout.HelpBox(error, MessageType.Error);
            if (config != null)
            {
                EditorGUILayout.Space();
                EditorGUILayout.LabelField("基础配置（保存后重新开始 Play 生效）", EditorStyles.boldLabel);
                config.title = EditorGUILayout.TextField("游戏标题", config.title);
                config.playerId = EditorGUILayout.TextField("玩家 ID", config.playerId);
                config.aiId = EditorGUILayout.TextField("AI ID", config.aiId);
                config.boardSize = EditorGUILayout.IntPopup("棋盘尺寸", config.boardSize, new[] { "4 × 4", "5 × 5" }, new[] { 4, 5 });
                config.turnSeconds = EditorGUILayout.IntField("每回合秒数", config.turnSeconds);
                config.maxTurns = EditorGUILayout.IntField("全局回合上限", config.maxTurns);
                config.deckSize = EditorGUILayout.IntField("每方牌库数量", config.deckSize);
                config.handLimit = EditorGUILayout.IntField("手牌上限", config.handLimit);
                config.seed = EditorGUILayout.IntField("随机种子（0 为随机）", config.seed);
                config.aiDelaySeconds = EditorGUILayout.FloatField("AI 行动间隔（秒）", config.aiDelaySeconds);
                EditorGUILayout.Space();
                EditorGUILayout.LabelField("后续联网预留（当前不发起连接）", EditorStyles.boldLabel);
                config.serverUrl = EditorGUILayout.TextField("HTTPS / WSS 地址", config.serverUrl);
                config.wechatAppId = EditorGUILayout.TextField("微信 AppID", config.wechatAppId);
                EditorGUILayout.HelpBox("不要填写 AppSecret、数据库密码或访问令牌。资源文件会进入客户端构建。", MessageType.Warning);
                using (new EditorGUILayout.HorizontalScope())
                {
                    if (GUILayout.Button("保存配置")) Save();
                    if (GUILayout.Button("重新读取")) Reload();
                    if (GUILayout.Button("打开演示场景")) ProjectTools.OpenScene();
                }
            }
            EditorGUILayout.Space();
            showCatalog = EditorGUILayout.Foldout(showCatalog, "正式网页卡牌参考库（仅资料，不参与演示结算）", true);
            if (showCatalog && catalog != null && catalog.cards != null)
            {
                query = EditorGUILayout.TextField("搜索 ID / 名称 / 势力", query);
                var filtered = catalog.cards.Where(c => string.IsNullOrEmpty(query)
                    || (c.id + c.name + c.camp).IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0);
                EditorGUILayout.LabelField("已导入 " + catalog.cards.Length + " 张资料");
                foreach (var card in filtered)
                {
                    using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                    {
                        EditorGUILayout.LabelField(card.id + " · " + card.name + " · " + card.camp, EditorStyles.boldLabel);
                        EditorGUILayout.LabelField(card.rarity + "  /  战力 " + card.baseAttack + "  /  " + card.skill);
                        EditorGUILayout.LabelField(card.effect, EditorStyles.wordWrappedLabel);
                    }
                }
            }
            EditorGUILayout.EndScrollView();
        }

        private void Save()
        {
            try
            {
                config.Validate();
                File.WriteAllText(ConfigPath, JsonUtility.ToJson(config, true) + "\n");
                AssetDatabase.Refresh(); error = null;
                ShowNotification(new GUIContent("已保存；重新 Play 后生效"));
            }
            catch (Exception exception) { error = exception.Message; }
        }
    }
}
