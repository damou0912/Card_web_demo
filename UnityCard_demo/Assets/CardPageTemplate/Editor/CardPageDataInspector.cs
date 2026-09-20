using System;
using UnityEditor;
using UnityEngine;

namespace CardDemo.CardPage.Editor
{
    [CustomEditor(typeof(CardPageData))]
    public sealed class CardPageDataInspector : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            serializedObject.Update();
            EditorGUILayout.HelpBox("通用展示配置：改文字、拖入立绘即可使用。不修改卡牌技能或战斗规则。建议先复制示例资产，再编辑副本。", MessageType.Info);
            Group("页面与卡牌文字");
            Field("pageTitle", "页面标题"); Field("pageSubtitle", "页面副标题");
            Field("cardId", "卡牌 ID"); Field("cardName", "卡牌名称");
            Field("faction", "势力"); Field("rarity", "品质"); Field("power", "展示战力");
            Group("立绘预留区");
            Field("artwork", "卡牌立绘 Sprite"); Field("artworkPlaceholder", "无图片时的提示");
            Group("技能展示（不执行）");
            Field("skillTitle", "技能名称"); Field("skillDescription", "完整技能描述");
            Group("通用内容与业务按钮");
            Field("extraTitle", "扩展字段标题"); Field("extraFields", "扩展字段列表（label / value）");
            Field("showAction", "显示操作按钮"); Field("actionLabel", "按钮文字"); Field("footer", "底部说明");
            Group("尺寸与字体");
            Field("cardWidth", "卡片最大宽度"); Field("artworkHeight", "立绘区域高度");
            Field("titleFontSize", "标题字号"); Field("bodyFontSize", "正文字号");
            Group("通用颜色");
            Field("backgroundColor", "页面背景"); Field("surfaceColor", "卡片背景"); Field("artworkBackgroundColor", "立绘底色");
            Field("accentColor", "品质 / 强调色"); Field("textColor", "正文颜色"); Field("mutedTextColor", "辅助文字颜色"); Field("buttonTextColor", "按钮文字颜色");
            serializedObject.ApplyModifiedProperties();

            var data = (CardPageData)target;
            bool valid = true;
            try { data.Validate(); }
            catch (Exception error) { EditorGUILayout.HelpBox(error.Message, MessageType.Error); valid = false; }
            using (new EditorGUI.DisabledScope(!valid))
            {
                if (GUILayout.Button("保存资产并刷新已打开的页面"))
                { EditorUtility.SetDirty(data); AssetDatabase.SaveAssets(); CardPageTools.RefreshOpenPages(data); }
                if (GUILayout.Button("以这份配置生成可编辑页面场景"))
                { Selection.activeObject = data; CardPageTools.GenerateEditableScene(); }
            }
            EditorGUILayout.HelpBox("预览场景在 Play 后显示。生成的页面在编辑状态就有完整 UI 层级，可调整布局或另存为 Prefab。", MessageType.None);
        }

        private static void Group(string title) { EditorGUILayout.Space(); EditorGUILayout.LabelField(title, EditorStyles.boldLabel); }
        private void Field(string name, string label) { EditorGUILayout.PropertyField(serializedObject.FindProperty(name), new GUIContent(label), true); }
    }
}
