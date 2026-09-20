using System;
using System.IO;
using System.Linq;
using CardDemo.Core;
using UnityEditor;
using UnityEngine;

namespace CardDemo.Editor
{
    public sealed class CardWorkshopWindow : EditorWindow
    {
        [SerializeField] private WorkshopLibrary library;
        [SerializeField] private string loadedText;
        [SerializeField] private int selectedCard, selectedDeck, tab;
        [SerializeField] private string search = "";
        [SerializeField] private string message;
        private Vector2 leftScroll, rightScroll;
        private string undoText;
        private string redoText;
        private int referenceIndex;
        private int templateIndex;

        [MenuItem("Card Demo/Tools/Card And Skill Workshop")]
        public static void Open() { GetWindow<CardWorkshopWindow>("卡牌与技能工坊").minSize = new Vector2(950, 640); }

        private void OnEnable() { if (library == null) Reload(); }
        private void Reload()
        {
            try
            {
                string text = File.ReadAllText(WorkshopStore.LibraryPath);
                var loaded = JsonUtility.FromJson<WorkshopLibrary>(text);
                WorkshopValidation.ThrowIfInvalid(loaded);
                loadedText = text; library = loaded; message = null; undoText = redoText = null;
            }
            catch (Exception error) { message = error.Message; }
        }

        private void OnGUI()
        {
            if (library == null) { EditorGUILayout.HelpBox(message ?? "无法加载制作库。", MessageType.Error); if (GUILayout.Button("重新读取")) Reload(); return; }
            string before = JsonUtility.ToJson(library);
            bool restoring = false;
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                if (GUILayout.Button("保存并校验", EditorStyles.toolbarButton)) Save();
                if (GUILayout.Button("重新读取", EditorStyles.toolbarButton)
                    && EditorUtility.DisplayDialog("重新读取", "将放弃当前未保存草稿。需要保留时先导出 JSON。", "放弃并读取", "取消")) { Reload(); restoring = true; }
                using (new EditorGUI.DisabledScope(undoText == null))
                    if (GUILayout.Button("撤销上次编辑", EditorStyles.toolbarButton)) { redoText = before; library = JsonUtility.FromJson<WorkshopLibrary>(undoText); undoText = null; restoring = true; }
                using (new EditorGUI.DisabledScope(redoText == null))
                    if (GUILayout.Button("重做", EditorStyles.toolbarButton)) { undoText = before; library = JsonUtility.FromJson<WorkshopLibrary>(redoText); redoText = null; restoring = true; }
                if (GUILayout.Button("导出 JSON", EditorStyles.toolbarButton)) Export();
                if (GUILayout.Button("导入 JSON", EditorStyles.toolbarButton)) Import();
                if (GUILayout.Button("战斗实验室", EditorStyles.toolbarButton)) BattleLabWindow.Open();
            }
            EditorGUILayout.HelpBox("制作库独立于正式网页卡表。配置的技能会实际执行；不是读取自然语言。关闭前请保存或导出。", MessageType.Info);
            if (!string.IsNullOrEmpty(message)) EditorGUILayout.HelpBox(message, MessageType.Info);
            tab = GUILayout.Toolbar(tab, new[] { "1 · 卡牌编辑", "2 · 技能组合", "3 · 测试卡组" });
            using (new EditorGUILayout.HorizontalScope())
            {
                using (new EditorGUILayout.VerticalScope(GUILayout.Width(250)))
                {
                    leftScroll = EditorGUILayout.BeginScrollView(leftScroll);
                    if (tab == 2) DrawDeckList(); else DrawCardList();
                    EditorGUILayout.EndScrollView();
                }
                using (new EditorGUILayout.VerticalScope())
                {
                    rightScroll = EditorGUILayout.BeginScrollView(rightScroll);
                    if (tab == 2) DrawDeck();
                    else if (library.cards != null && library.cards.Length > 0)
                    {
                        selectedCard = Mathf.Clamp(selectedCard, 0, library.cards.Length - 1);
                        if (tab == 0) DrawCard(library.cards[selectedCard]); else DrawSkills(library.cards[selectedCard]);
                    }
                    EditorGUILayout.EndScrollView();
                }
            }
            var errors = WorkshopValidation.Errors(library);
            EditorGUILayout.LabelField(errors.Count == 0 ? "结构校验通过 · 卡牌 " + library.cards.Length + " · 卡组 " + library.decks.Length
                : "校验错误 " + errors.Count + "：" + errors[0], EditorStyles.wordWrappedLabel);
            if (!restoring && before != JsonUtility.ToJson(library)) { undoText = before; redoText = null; Repaint(); }
            hasUnsavedChanges = JsonUtility.ToJson(library) != Compact(loadedText);
            saveChangesMessage = "卡牌／技能／卡组草稿尚未保存。保存会校验并备份旧制作库。";
        }

        private static string Compact(string text)
        {
            return string.IsNullOrEmpty(text) ? "" : JsonUtility.ToJson(JsonUtility.FromJson<WorkshopLibrary>(text));
        }

        public override void SaveChanges()
        {
            if (Save()) base.SaveChanges();
        }

        private void DrawCardList()
        {
            search = EditorGUILayout.TextField("搜索", search);
            for (int i = 0; i < library.cards.Length; i++)
            {
                var card = library.cards[i];
                if (!string.IsNullOrEmpty(search) && (card.id + card.name).IndexOf(search, StringComparison.OrdinalIgnoreCase) < 0) continue;
                if (GUILayout.Toggle(selectedCard == i, card.name + "\n" + card.id, "Button")) selectedCard = i;
            }
            if (GUILayout.Button("＋ 新建卡牌")) AddCard(new CardDefinition { name = "新卡牌", camp = "制作测试", rarity = "普通", baseAttack = 2, demoEffect = "None", abilities = new SkillDefinition[0] });
            if (library.cards.Length > 0 && GUILayout.Button("复制选中卡牌"))
                AddCard(WorkshopStore.Clone(library.cards[Mathf.Clamp(selectedCard, 0, library.cards.Length - 1)]));
        }

        private void AddCard(CardDefinition card)
        {
            card.id = "workshop_" + Guid.NewGuid().ToString("N").Substring(0, 8);
            library.cards = library.cards.Concat(new[] { card }).ToArray(); selectedCard = library.cards.Length - 1;
        }

        private void DrawCard(CardDefinition card)
        {
            EditorGUILayout.LabelField("卡牌资料", EditorStyles.boldLabel);
            // References remain stable: display IDs read-only instead of silently breaking decks.
            EditorGUILayout.SelectableLabel("稳定 ID：" + card.id, GUILayout.Height(20));
            card.name = EditorGUILayout.TextField("名称", card.name);
            card.camp = EditorGUILayout.TextField("势力", card.camp);
            string[] rarities = { "普通", "稀有", "史诗", "传说", "特殊" };
            int rarityIndex = Array.IndexOf(rarities, card.rarity);
            if (rarityIndex < 0) card.rarity = EditorGUILayout.TextField("品质", card.rarity);
            else card.rarity = rarities[EditorGUILayout.Popup("品质", rarityIndex, rarities)];
            card.baseAttack = EditorGUILayout.IntField("基础战力（0~99）", card.baseAttack);
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("实际技能说明（由组合步骤生成）", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(SkillText.Describe(card), MessageType.None);
            if (GUILayout.Button("编辑这张卡的技能")) tab = 1;
            if (GUILayout.Button("删除此卡（被卡组引用时禁止）"))
            {
                if (library.cards.Length <= 1) message = "制作库至少保留 1 张卡。";
                else if (library.decks.Any(d => d.cardIds.Contains(card.id))) message = "该卡仍被卡组引用，请先在测试卡组工具中移除。";
                else if (EditorUtility.DisplayDialog("删除卡牌", "删除草稿中的「" + card.name + "」？保存时会自动备份旧文件。", "删除", "取消"))
                { library.cards = library.cards.Where(c => c != card).ToArray(); selectedCard = 0; }
            }
            EditorGUILayout.Space();
            EditorGUILayout.LabelField("从正式参考库复制资料（不复制技能实现）", EditorStyles.boldLabel);
            var asset = AssetDatabase.LoadAssetAtPath<TextAsset>("Assets/Resources/Data/web-card-catalog.json");
            if (asset == null) return;
            var reference = JsonUtility.FromJson<CardCatalog>(asset.text);
            referenceIndex = EditorGUILayout.Popup("参考卡", Mathf.Clamp(referenceIndex, 0, reference.cards.Length - 1), reference.cards.Select(c => c.id + " " + c.name).ToArray());
            EditorGUILayout.HelpBox(reference.cards[referenceIndex].effect, MessageType.None);
            if (GUILayout.Button("以此资料新建空技能卡"))
            {
                var copied = WorkshopStore.Clone(reference.cards[referenceIndex]);
                copied.demoEffect = "None"; copied.abilities = new SkillDefinition[0]; copied.skill = "待制作"; copied.effect = "无技能。";
                copied.name += "（待制作）"; AddCard(copied);
                message = "只复制基础资料。请在技能组合页制作并验证技能；未改动正式参考库。";
            }
        }

        private static string Choice<T>(string label, string current) where T : struct
        {
            var values = Enum.GetNames(typeof(T)); int index = Array.IndexOf(values, current);
            // Invalid imported values are surfaced, never silently replaced by the first enum member.
            if (index < 0)
            {
                EditorGUILayout.HelpBox("未知值：" + current + "，请在下拉框重新选择。", MessageType.Error);
                var options = new[] { "请选择有效值" }.Concat(values.Select(SkillText.Label)).ToArray();
                int selected = EditorGUILayout.Popup(label, 0, options);
                return selected == 0 ? current : values[selected - 1];
            }
            return values[EditorGUILayout.Popup(label, index, values.Select(SkillText.Label).ToArray())];
        }

        private void DrawSkills(CardDefinition card)
        {
            EditorGUILayout.LabelField(card.name + " · 技能组合", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("同触发时机按技能列表顺序执行；每步重新选目标。遗志使用离场位置。技能摧毁的后续遗志排队执行。", MessageType.None);
            card.abilities = card.abilities ?? new SkillDefinition[0];
            templateIndex = EditorGUILayout.Popup("参考技能模板", templateIndex, SkillTemplates.Names);
            using (new EditorGUI.DisabledScope(card.abilities.Length >= 8))
                if (GUILayout.Button("从模板添加技能（不替换已有技能）")) card.abilities = card.abilities.Concat(new[] { SkillTemplates.Create(templateIndex) }).ToArray();
            for (int i = 0; i < card.abilities.Length; i++)
            {
                var skill = card.abilities[i];
                using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                {
                    EditorGUILayout.LabelField("技能 " + (i + 1), EditorStyles.boldLabel);
                    skill.name = EditorGUILayout.TextField("技能名", skill.name);
                    skill.trigger = Choice<SkillTrigger>("触发时机", skill.trigger);
                    skill.condition = Choice<SkillCondition>("触发条件", skill.condition);
                    if (skill.condition == "HandBelow") skill.conditionValue = EditorGUILayout.IntField("手牌阈值", skill.conditionValue);
                    skill.steps = skill.steps ?? new SkillStep[0];
                    for (int j = 0; j < skill.steps.Length; j++)
                    {
                        var step = skill.steps[j];
                        using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                        {
                            EditorGUILayout.LabelField("效果步骤 " + (j + 1));
                            string previousOperation = step.operation;
                            step.operation = Choice<SkillOperation>("效果", step.operation);
                            if (step.operation != previousOperation)
                            {
                                step.amount = 1; step.duration = "Permanent";
                                if (step.operation == "DrawCards" || step.operation == "AddActions") { step.target = "Self"; step.selection = "All"; }
                            }
                            bool playerEffect = step.operation == "DrawCards" || step.operation == "AddActions";
                            using (new EditorGUI.DisabledScope(playerEffect))
                            {
                                step.target = Choice<SkillTarget>("目标范围", step.target);
                                step.selection = Choice<TargetSelection>("目标选择", step.selection);
                            }
                            if (step.operation == "ModifyPower" || playerEffect) step.amount = EditorGUILayout.IntField("数值", step.amount);
                            if (step.operation == "ModifyPower") step.duration = Choice<PowerDuration>("持续时间", step.duration);
                            using (new EditorGUILayout.HorizontalScope())
                            {
                                using (new EditorGUI.DisabledScope(j == 0))
                                    if (GUILayout.Button("步骤上移")) { var temp = skill.steps[j - 1]; skill.steps[j - 1] = step; skill.steps[j] = temp; }
                                if (GUILayout.Button("复制步骤") && skill.steps.Length < 8) { skill.steps = skill.steps.Concat(new[] { WorkshopStore.Clone(step) }).ToArray(); break; }
                                if (GUILayout.Button("删除步骤")) { skill.steps = skill.steps.Where((s, n) => n != j).ToArray(); break; }
                            }
                        }
                    }
                    if (skill.steps.Length < 8 && GUILayout.Button("＋ 添加效果步骤")) skill.steps = skill.steps.Concat(new[] { new SkillStep() }).ToArray();
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        using (new EditorGUI.DisabledScope(i == 0))
                            if (GUILayout.Button("技能上移")) { var temp = card.abilities[i - 1]; card.abilities[i - 1] = skill; card.abilities[i] = temp; }
                        if (GUILayout.Button("删除技能")) { card.abilities = card.abilities.Where((s, n) => n != i).ToArray(); break; }
                    }
                }
            }
            if (card.abilities.Length < 8 && GUILayout.Button("＋ 新建技能")) card.abilities = card.abilities.Concat(new[] { new SkillDefinition() }).ToArray();
            EditorGUILayout.HelpBox(SkillText.Describe(card), MessageType.None);
        }

        private void DrawDeckList()
        {
            for (int i = 0; i < library.decks.Length; i++)
                if (GUILayout.Toggle(selectedDeck == i, library.decks[i].name + "\n" + library.decks[i].cardIds.Length + " 张", "Button")) selectedDeck = i;
            if (GUILayout.Button("＋ 新测试卡组"))
            {
                library.decks = library.decks.Concat(new[] { new WorkshopDeck { id = "deck_" + Guid.NewGuid().ToString("N").Substring(0, 8), name = "新测试卡组" } }).ToArray();
                selectedDeck = library.decks.Length - 1;
            }
        }

        private void DrawDeck()
        {
            EditorGUILayout.HelpBox("这是开发测试卡组：允许重复和跨势力，不代表正式玩家组卡规则。数量必须等于全局配置的牌库数量后才能用于 Play。", MessageType.Info);
            if (library.decks.Length == 0) return;
            selectedDeck = Mathf.Clamp(selectedDeck, 0, library.decks.Length - 1);
            var deck = library.decks[selectedDeck];
            EditorGUILayout.SelectableLabel("稳定 ID：" + deck.id, GUILayout.Height(20));
            deck.name = EditorGUILayout.TextField("卡组名", deck.name);
            EditorGUILayout.LabelField("当前数量 " + deck.cardIds.Length);
            foreach (var card in library.cards)
            {
                using (new EditorGUILayout.HorizontalScope())
                {
                    EditorGUILayout.LabelField(card.name + " · " + card.rarity);
                    int count = deck.cardIds.Count(id => id == card.id);
                    int next = Mathf.Clamp(EditorGUILayout.IntField(count, GUILayout.Width(70)), 0, 100);
                    if (next != count)
                    {
                        int total = deck.cardIds.Length - count + next;
                        if (total <= 100) deck.cardIds = deck.cardIds.Where(id => id != card.id).Concat(Enumerable.Repeat(card.id, next)).ToArray();
                        else message = "每套测试卡组最多 100 张。";
                    }
                }
            }
            if (GUILayout.Button("保存制作库，并设为玩家测试卡组")) AssignDeck(false);
            if (GUILayout.Button("保存制作库，并设为 AI 测试卡组")) AssignDeck(true);
            EditorGUILayout.HelpBox("第一次启用需要双方测试卡组都存在且数量正确。更改配置后重新进入 Play。", MessageType.None);
        }

        private bool Save()
        {
            try
            {
                string text = WorkshopStore.Normalize(library);
                WorkshopStore.SaveText(WorkshopStore.LibraryPath, text, loadedText);
                library = JsonUtility.FromJson<WorkshopLibrary>(text); loadedText = text;
                message = "已保存；旧文件备份在 Library/CardDemoBackups。重新 Play 或重建实验可使用最新配置。";
                return true;
            }
            catch (Exception error) { message = error.Message; return false; }
        }

        private void AssignDeck(bool ai)
        {
            try
            {
                string original = File.ReadAllText(WorkshopStore.ConfigPath);
                var config = JsonUtility.FromJson<GameConfig>(original);
                if (ai) config.aiDeckId = library.decks[selectedDeck].id; else config.playerDeckId = library.decks[selectedDeck].id;
                config.useWorkshopCards = true; config.Validate();
                library.ResolveDeck(config.playerDeckId, config.deckSize); library.ResolveDeck(config.aiDeckId, config.deckSize);
                if (!Save()) return;
                WorkshopStore.SaveText(WorkshopStore.ConfigPath, JsonUtility.ToJson(config, true) + "\n", original);
                message = "已启用制作库和测试卡组，退出再进入 Play 生效。";
            }
            catch (Exception error) { message = error.Message; }
        }

        private void Export()
        {
            string destination = EditorUtility.SaveFilePanel("导出制作库草稿", "", "workshop-library.json", "json");
            if (string.IsNullOrEmpty(destination)) return;
            try
            {
                if (Path.GetFullPath(destination) == Path.GetFullPath(WorkshopStore.LibraryPath)) { Save(); return; }
                WorkshopStore.SaveText(destination, JsonUtility.ToJson(library, true) + "\n", null);
                message = "已导出草稿（可能含待修正项），未改动实际运行数据。";
            }
            catch (Exception error) { message = error.Message; }
        }

        private void Import()
        {
            string source = EditorUtility.OpenFilePanel("导入制作库", "", "json");
            if (string.IsNullOrEmpty(source)) return;
            try
            {
                var imported = JsonUtility.FromJson<WorkshopLibrary>(File.ReadAllText(source));
                WorkshopValidation.ThrowIfInvalid(imported);
                if (!EditorUtility.DisplayDialog("替换草稿", "用导入文件替换当前草稿？磁盘制作库不会改变，直到点击保存。", "导入", "取消")) return;
                library = imported; selectedCard = selectedDeck = 0; message = "已载入导入草稿，保存前不会改变实际对局。";
            }
            catch (Exception error) { message = error.Message; }
        }
    }
}
