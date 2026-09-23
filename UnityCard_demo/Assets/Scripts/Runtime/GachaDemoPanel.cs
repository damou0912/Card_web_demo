using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace CardDemo
{
    // A self-contained test page. Never changes battle cards, accounts or production balances.
    public sealed class GachaDemoPanel : MonoBehaviour
    {
        private static readonly Color Paper = new Color32(243, 240, 231, 255);
        private static readonly Color Ink = new Color32(39, 48, 43, 255);
        private static readonly Color Green = new Color32(52, 76, 64, 255);
        private static readonly Color Muted = new Color32(119, 121, 109, 255);
        private static readonly Color Orange = new Color32(167, 86, 41, 255);
        private GachaConfig config;
        private GachaDemo engine;
        private GachaState state;
        private Dictionary<string, CardDefinition> cards;
        private readonly System.Random random = new System.Random();
        private Font font;
        private RectTransform safe, content;
        private Text balance, progress, shardTotal, milestones, status, resultHeading;
        private GridLayoutGroup results, collection, exchange;
        private Button draw, replay;
        private GameObject modal, revealLayer;
        private GridLayoutGroup revealGrid;
        private string savePath, loadError;
        private bool busy, skipReveal;
        public Action Closed;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (SceneManager.GetActiveScene().name == "GachaDemo" && FindObjectOfType<GachaDemoPanel>() == null) Open(null);
        }
        public static void Open(Action onClose)
        {
            if (FindObjectOfType<GachaDemoPanel>() != null) return;
            var view = new GameObject("Gacha Demo (test credit only)").AddComponent<GachaDemoPanel>();
            view.Closed = onClose;
        }
        private void Awake()
        {
            font = Resources.Load<Font>("Fonts/NotoSansSC-Regular");
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildPage();
            try
            {
                config = Read<GachaConfig>("Config/gacha-demo");
                cards = Read<CardCatalog>("Data/web-card-catalog").cards.ToDictionary(c => c.id);
                engine = new GachaDemo(config, cards.Values);
                savePath = Path.Combine(Application.persistentDataPath, "gacha-demo-v1.json");
                state = engine.NewState();
                if (File.Exists(savePath))
                {
                    try { state = JsonUtility.FromJson<GachaState>(File.ReadAllText(savePath)); engine.ValidateState(state); }
                    catch (Exception error)
                    {
                        Debug.LogWarning(error.Message); state = engine.NewState();
                        loadError = "旧存档不兼容或损坏，未覆盖。请确认重置此 Demo。";
                    }
                }
                Refresh();
                status.text = loadError ?? (state.bundles == 0 ? "已领取 500 测试元，可以开始招募。" : "已恢复本机的抽卡进度。");
            }
            catch (Exception error) { status.text = "抽卡 Demo 加载失败：" + error.Message; draw.interactable = false; Debug.LogException(error); }
        }
        private static T Read<T>(string resource)
        {
            var text = Resources.Load<TextAsset>(resource);
            if (text == null) throw new InvalidOperationException("缺少资源：" + resource);
            return JsonUtility.FromJson<T>(text.text);
        }
        private RectTransform Box(Transform parent, string name, Color color)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(Image)); obj.transform.SetParent(parent, false);
            obj.GetComponent<Image>().color = color; return (RectTransform)obj.transform;
        }
        private void Stretch(RectTransform rect)
        { rect.anchorMin = Vector2.zero; rect.anchorMax = Vector2.one; rect.offsetMin = rect.offsetMax = Vector2.zero; }
        private Text Text(Transform parent, string value, int size, Color color)
        {
            var obj = new GameObject("Text", typeof(RectTransform), typeof(Text)); obj.transform.SetParent(parent, false);
            var text = obj.GetComponent<Text>(); text.font = font; text.fontSize = size; text.text = value;
            text.color = color; text.supportRichText = false; text.raycastTarget = false;
            text.alignment = TextAnchor.MiddleLeft; text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow; return text;
        }
        private static void Height(Component item, float height)
        { var layout = item.gameObject.AddComponent<LayoutElement>(); layout.minHeight = height; layout.preferredHeight = height; }
        private Button Button(Transform parent, string label, Action action, bool primary = false)
        {
            var rect = Box(parent, label, primary ? Green : new Color32(227, 231, 217, 255));
            var button = rect.gameObject.AddComponent<Button>(); button.targetGraphic = rect.GetComponent<Image>();
            var text = Text(rect, label, 26, primary ? Paper : Ink); Stretch(text.rectTransform);
            text.rectTransform.offsetMin = new Vector2(14, 8); text.rectTransform.offsetMax = new Vector2(-14, -8);
            text.alignment = TextAnchor.MiddleCenter; text.verticalOverflow = VerticalWrapMode.Truncate;
            Height(rect, 74); button.onClick.AddListener(() => action()); return button;
        }
        private RectTransform Scroll(Transform parent, string name)
        {
            var view = Box(parent, name, Paper); Stretch(view); view.gameObject.AddComponent<RectMask2D>();
            var scroll = view.gameObject.AddComponent<ScrollRect>();
            var body = new GameObject("Content", typeof(RectTransform), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
            body.transform.SetParent(view, false); var rect = (RectTransform)body.transform;
            rect.anchorMin = new Vector2(0, 1); rect.anchorMax = Vector2.one; rect.pivot = new Vector2(.5f, 1);
            rect.offsetMin = rect.offsetMax = Vector2.zero;
            var layout = body.GetComponent<VerticalLayoutGroup>(); layout.padding = new RectOffset(30, 30, 28, 30); layout.spacing = 18;
            layout.childControlHeight = true; layout.childControlWidth = true; layout.childForceExpandHeight = false;
            body.GetComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scroll.content = rect; scroll.viewport = view; scroll.horizontal = false; scroll.scrollSensitivity = 50;
            scroll.movementType = ScrollRect.MovementType.Clamped; return rect;
        }
        private void BuildPage()
        {
            if (FindObjectOfType<EventSystem>() == null) new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            var canvasObject = new GameObject("Gacha Canvas", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false); var canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 50;
            var scaler = canvasObject.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920); scaler.matchWidthOrHeight = .5f;
            safe = Box(canvas.transform, "Safe Area", Paper); Stretch(safe);
            content = Scroll(safe, "Recruitment");
            Text(content, "三国 · 卡牌试作 / RECRUITMENT", 22, Muted);
            Text(content, "蜀汉 · 群英招募", 50, Ink);
            Text(content, "免费测试额度，金额仅为模拟，不产生真实扣款。\n与游戏账号、组卡、对局库存无关。", 25, Orange);
            balance = Text(content, "", 36, Green);
            progress = Text(content, "", 26, Ink);
            shardTotal = Text(content, "", 32, Green);
            milestones = Text(content, "", 24, Muted);
            draw = Button(content, "招募五张 · 20 测试元", Draw, true);
            status = Text(content, "正在加载…", 24, Green);
            resultHeading = Text(content, "本次相逢", 32, Ink);
            replay = Button(content, "重播本次 · 不消耗额度", Replay);
            results = Grid(content, "Rewards");
            Text(content, "全部卡牌 · 点击查看技能", 32, Ink);
            collection = Grid(content, "Collection");
            Text(content, "卡牌下方只显示完整卡数量。重复卡已转为碎片，不计作额外完整卡。", 22, Muted);
            Text(content, "兑换卡牌", 32, Ink);
            Text(content, "兑换区与抽卡在同一页面；下方展示未拥有的卡牌。碎片通用规则与兑换价格待确认，暂不扣除碎片或赠送卡牌。", 24, Muted);
            exchange = Grid(content, "Exchange Candidates");
            Button(content, "兑换规则待确认 · 暂未开放", () => { }).interactable = false;
            Button(content, "概率与保底规则", ShowRules);
            Button(content, "重置此 Demo", AskReset);
            Button(content, "关闭抽卡 Demo", Close);
        }
        private GridLayoutGroup Grid(Transform parent, string name)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(GridLayoutGroup), typeof(LayoutElement)); obj.transform.SetParent(parent, false);
            var grid = obj.GetComponent<GridLayoutGroup>(); grid.spacing = new Vector2(14, 14);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount; grid.constraintCount = 3; return grid;
        }
        private void Update()
        {
            if (safe == null || Screen.width == 0 || Screen.height == 0) return;
            Rect area = Screen.safeArea;
            safe.anchorMin = new Vector2(area.xMin / Screen.width, area.yMin / Screen.height);
            safe.anchorMax = new Vector2(area.xMax / Screen.width, area.yMax / Screen.height);
            foreach (var grid in new[] { results, collection, exchange })
            {
                SizeGrid(grid, content.rect.width - 60, 190);
            }
            if (revealGrid != null) SizeGrid(revealGrid, ((RectTransform)revealGrid.transform.parent).rect.width - 60, 250);
            if (busy && Input.GetKeyDown(KeyCode.Escape)) skipReveal = true;
        }
        private static void SizeGrid(GridLayoutGroup grid, float width, float height)
        {
            width = Mathf.Max(40, width);
            int columns = width > 1400 ? 5 : width > 750 ? 3 : 2;
            grid.constraintCount = columns;
            grid.cellSize = new Vector2((width - (columns - 1) * 14) / columns, height);
            grid.GetComponent<LayoutElement>().preferredHeight = Mathf.Ceil(grid.transform.childCount / (float)columns) * (height + 14);
        }
        private void Fill(GridLayoutGroup grid, IEnumerable<Tuple<string, string, bool>> entries)
        {
            // Detach before deferred destruction so layout immediately sees the new child count.
            foreach (Transform child in grid.transform.Cast<Transform>().ToArray()) { child.SetParent(null); Destroy(child.gameObject); }
            foreach (var entry in entries)
            {
                string id = entry.Item1; var card = cards[id];
                var button = Button(grid.transform, card.name + "\n" + entry.Item2, () => ShowCard(id));
                button.GetComponent<Image>().color = entry.Item3 ? Color.Lerp(Paper, RarityColor(card.rarity), .22f) : new Color32(218, 220, 210, 255);
                var label = button.GetComponentInChildren<Text>(); label.rectTransform.offsetMax = new Vector2(-14, -56);
                var band = Box(button.transform, "Quality Badge", RarityColor(card.rarity));
                band.anchorMin = new Vector2(0, 1); band.anchorMax = Vector2.one; band.pivot = new Vector2(.5f, 1);
                band.offsetMin = new Vector2(0, -48); band.offsetMax = Vector2.zero;
                var qualityLabel = Text(band, QualityName(card.rarity), 26, Ink); Stretch(qualityLabel.rectTransform);
                qualityLabel.fontStyle = FontStyle.Bold; qualityLabel.alignment = TextAnchor.MiddleCenter;
            }
        }
        private void Refresh()
        {
            balance.text = "剩余 " + engine.Remaining(state) + " 测试元　/　已花费 " + engine.Spent(state);
            progress.text = "完整卡牌总数 " + state.owned.Count + "/10 张　·　第 " + state.bundles + "/25 次五连";
            shardTotal.text = "碎片总数 " + state.owned.Sum(c => c.shards) + " 枚";
            milestones.text = string.Join("\n", config.milestones.Select(m => (engine.Spent(state) >= m.spent ? "✓ " : "○ ") + m.spent + " 测试元：至少 " + m.uniqueCards + "/10 张"));
            draw.interactable = !busy && loadError == null && !engine.Complete(state);
            replay.interactable = !busy && loadError == null && state.lastRewards.Count > 0;
            draw.GetComponentInChildren<Text>().text = engine.Complete(state) ? "本期已集齐 · 可重置体验" : "招募五张 · 20 测试元";
            resultHeading.text = "本次相逢 · " + state.lastRewards.Count(r => !r.guarantee) + " 抽取 + " + state.lastRewards.Count(r => r.guarantee) + " 补发\n"
                + string.Join(" / ", state.lastRewards.GroupBy(r => cards[r.cardId].rarity).Select(g => QualityName(g.Key) + " × " + g.Count()));
            Fill(results, state.lastRewards.Select(r => Tuple.Create(r.cardId, r.guarantee ? "保底补发 · 拥有 1 张" : r.isNew ? "新卡 · 拥有 1 张" : "重复卡 · 拥有 1 张", true)));
            Fill(collection, config.groups.SelectMany(g => g.cardIds).Select(id => {
                var owned = state.owned.FirstOrDefault(c => c.cardId == id);
                return Tuple.Create(id, "拥有 " + (owned == null ? "0" : "1") + " 张", owned != null);
            }));
            Fill(exchange, config.groups.SelectMany(g => g.cardIds).Where(id => state.owned.All(c => c.cardId != id)).Select(id => Tuple.Create(id, "拥有 0 张", false)));
        }
        private void Draw()
        {
            if (busy || engine == null || loadError != null) return;
            Commit(() => engine.Draw(state, random.Next), false);
        }
        private void Commit(Func<GachaState> transaction, bool reset)
        {
            busy = true;
            bool committed = false;
            try
            {
                var next = transaction();
                if (reset && loadError != null && File.Exists(savePath)) File.Copy(savePath, savePath + ".invalid-" + Guid.NewGuid().ToString("N"));
                GachaSaveFile.Write(savePath, JsonUtility.ToJson(next, true)); state = next; loadError = null;
                committed = true;
                status.text = reset ? "已重置抽卡 Demo，恢复免费测试额度。" : engine.Complete(state) ? "十将已齐！共花费 " + engine.Spent(state) + " 测试元。" : "招募完成，卡牌与碎片已自动保存。";
            }
            catch (Exception error) { status.text = "操作未完成，进度未更新：" + error.Message; Debug.LogWarning(error.Message); }
            finally { busy = false; }
            // Save and probability logic finish first. The coroutine only reads the saved snapshot.
            if (committed && !reset) BeginReveal(false);
            else Refresh();
        }
        private void Replay()
        {
            if (busy || engine == null || loadError != null || state.lastRewards.Count == 0) return;
            BeginReveal(true);
        }
        private void BeginReveal(bool isReplay)
        {
            busy = true; skipReveal = false; draw.interactable = replay.interactable = false;
            StartCoroutine(RevealRoutine(isReplay));
        }
        private static Color RarityColor(string rarity)
        {
            switch (rarity)
            {
                case "稀有": return new Color32(104, 186, 255, 255);
                case "史诗": return new Color32(193, 133, 255, 255);
                case "传说": return new Color32(255, 177, 59, 255);
                case "特殊": return new Color32(85, 216, 189, 255);
                default: return new Color32(227, 227, 215, 255);
            }
        }
        private static string QualityName(string rarity)
        {
            switch (rarity)
            {
                case "稀有": return "稀有 · 蓝";
                case "史诗": return "史诗 · 紫";
                case "传说": return "传说 · 橙";
                case "特殊": return "特殊 · 青绿";
                default: return "普通 · 白";
            }
        }
        private IEnumerator RevealRoutine(bool isReplay)
        {
            bool finished = false;
            try
            {
                Dismiss();
                var rewards = state.lastRewards.ToArray();
                var stage = Box(safe, "Recruitment Reveal", new Color32(25, 42, 37, 255));
                Stretch(stage); revealLayer = stage.gameObject;
                var title = Text(stage, "墨起 · 群英将至", 40, Paper);
                title.rectTransform.anchorMin = new Vector2(.06f, .88f); title.rectTransform.anchorMax = new Vector2(.7f, .98f);
                title.rectTransform.offsetMin = title.rectTransform.offsetMax = Vector2.zero;
                var skip = Button(stage, "跳过动画", () => skipReveal = true);
                var skipRect = (RectTransform)skip.transform;
                skipRect.anchorMin = new Vector2(.72f, .90f); skipRect.anchorMax = new Vector2(.94f, .96f);
                skipRect.offsetMin = skipRect.offsetMax = Vector2.zero;
                if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(skip.gameObject);
                var note = Text(stage, "结果已保存，正在揭晓…", 24, new Color32(199, 205, 186, 255));
                note.rectTransform.anchorMin = new Vector2(.06f, .82f); note.rectTransform.anchorMax = new Vector2(.94f, .88f);
                note.rectTransform.offsetMin = note.rectTransform.offsetMax = Vector2.zero;
                var frame = Box(stage, "Reveal Scroll Frame", Color.clear);
                frame.anchorMin = new Vector2(.03f, .08f); frame.anchorMax = new Vector2(.97f, .82f);
                frame.offsetMin = frame.offsetMax = Vector2.zero;
                var body = Scroll(frame, "Reveal Scroll"); body.parent.GetComponent<Image>().color = Color.clear;
                var sigil = Text(body, "三 国\n\n将\n\n群英赴约", 56, new Color32(216, 203, 155, 255));
                sigil.alignment = TextAnchor.MiddleCenter; Height(sigil, 420);
                revealGrid = Grid(body, "Reveal Cards"); revealGrid.gameObject.SetActive(false);
                var faces = new List<RectTransform>(); var labels = new List<Text>();
                foreach (var reward in rewards)
                {
                    var face = Box(revealGrid.transform, "Saved Reward", Green);
                    var outline = face.gameObject.AddComponent<Outline>(); outline.effectColor = Muted; outline.effectDistance = new Vector2(2, -2);
                    var label = Text(face, "三 国\n\n将\n\n群英录", 30, Paper); Stretch(label.rectTransform);
                    label.rectTransform.offsetMin = new Vector2(14, 10); label.rectTransform.offsetMax = new Vector2(-14, -10);
                    label.alignment = TextAnchor.MiddleCenter; label.resizeTextForBestFit = true; label.resizeTextMinSize = 18; label.resizeTextMaxSize = 30;
                    label.verticalOverflow = VerticalWrapMode.Truncate;
                    faces.Add(face); labels.Add(label);
                }
                var footer = Text(stage, "跳过 / 重播不改变卡牌与碎片，不消耗额外测试额度", 20, new Color32(174, 185, 164, 255));
                footer.rectTransform.anchorMin = new Vector2(.06f, .01f); footer.rectTransform.anchorMax = new Vector2(.94f, .07f);
                footer.rectTransform.offsetMin = footer.rectTransform.offsetMax = Vector2.zero;
                footer.alignment = TextAnchor.MiddleCenter;
                // A dedicated close-up leaves the skip control unobstructed.
                var focus = Box(stage, "Quality Close Up", Ink);
                focus.anchorMin = new Vector2(.04f, .10f); focus.anchorMax = new Vector2(.96f, .81f);
                focus.offsetMin = focus.offsetMax = Vector2.zero;
                var focusTitle = Text(focus, "", 68, Paper);
                focusTitle.rectTransform.anchorMin = new Vector2(.05f, .75f); focusTitle.rectTransform.anchorMax = new Vector2(.95f, .98f);
                focusTitle.rectTransform.offsetMin = focusTitle.rectTransform.offsetMax = Vector2.zero; focusTitle.alignment = TextAnchor.MiddleCenter;
                var hero = Box(focus, "Featured Card", Paper);
                hero.anchorMin = new Vector2(.17f, .09f); hero.anchorMax = new Vector2(.83f, .72f);
                hero.offsetMin = hero.offsetMax = Vector2.zero;
                var heroOutline = hero.gameObject.AddComponent<Outline>(); heroOutline.effectDistance = new Vector2(8, -8);
                var heroText = Text(hero, "", 44, Ink); Stretch(heroText.rectTransform);
                heroText.rectTransform.offsetMin = new Vector2(20, 20); heroText.rectTransform.offsetMax = new Vector2(-20, -20);
                heroText.alignment = TextAnchor.MiddleCenter; heroText.resizeTextForBestFit = true; heroText.resizeTextMinSize = 22; heroText.resizeTextMaxSize = 44;
                heroText.verticalOverflow = VerticalWrapMode.Truncate;
                focus.gameObject.SetActive(false);
                for (float t = 0; t < .65f && !skipReveal; t += Time.unscaledDeltaTime)
                {
                    sigil.rectTransform.localScale = Vector3.one * Mathf.Lerp(.75f, 1, Mathf.SmoothStep(0, 1, t / .65f));
                    yield return null;
                }
                sigil.gameObject.SetActive(false); revealGrid.gameObject.SetActive(true); title.text = "展卷 · 与君相逢";
                for (float t = 0; t < .35f && !skipReveal; t += Time.unscaledDeltaTime)
                {
                    foreach (var face in faces) face.localScale = Vector3.one * Mathf.Lerp(.82f, 1, Mathf.SmoothStep(0, 1, t / .35f));
                    yield return null;
                }
                foreach (var face in faces) face.localScale = Vector3.one;
                for (int i = 0; i < rewards.Length; i++)
                {
                    var reward = rewards[i]; var card = cards[reward.cardId]; var face = faces[i];
                    focus.gameObject.SetActive(false);
                    bool legendary = card.rarity == "传说", epic = card.rarity == "史诗";
                    Color qualityColor = RarityColor(card.rarity);
                    var outline = face.GetComponent<Outline>(); outline.effectColor = qualityColor;
                    outline.effectDistance = new Vector2(5, -5);
                    face.GetComponent<Image>().color = Color.Lerp(Green, qualityColor, .28f);
                    labels[i].text = "三 国\n\n将\n\n" + QualityName(card.rarity); labels[i].color = qualityColor;
                    title.text = QualityName(card.rarity) + " · 即将揭晓"; title.color = qualityColor;
                    stage.GetComponent<Image>().color = Color.Lerp(Ink, qualityColor, .13f);
                    // Bring wrapped bonus rows into view without moving the fixed skip button.
                    Canvas.ForceUpdateCanvases();
                    var scroll = body.parent.GetComponent<ScrollRect>();
                    if (!skipReveal && body.rect.height > scroll.viewport.rect.height)
                    {
                        int row = i / revealGrid.constraintCount;
                        float offset = row * (revealGrid.cellSize.y + revealGrid.spacing.y);
                        scroll.verticalNormalizedPosition = 1 - Mathf.Clamp01(offset / (body.rect.height - scroll.viewport.rect.height));
                    }
                    float cue = legendary ? .7f : epic ? .38f : card.rarity == "普通" ? 0 : .18f;
                    for (float t = 0; t < cue && !skipReveal; t += Time.unscaledDeltaTime)
                    { outline.effectDistance = new Vector2(5, -5) * (1 + t / cue); yield return null; }
                    for (float t = 0; t < .12f && !skipReveal; t += Time.unscaledDeltaTime)
                    { face.localScale = new Vector3(Mathf.Lerp(1, .04f, t / .12f), 1, 1); yield return null; }
                    face.GetComponent<Image>().color = Color.Lerp(Paper, qualityColor, .40f);
                    string caption = reward.guarantee ? "保底补发 · 拥有 1 张" : reward.isNew ? "新卡 · 拥有 1 张" : "重复卡 · 拥有 1 张";
                    labels[i].text = QualityName(card.rarity) + "\n" + card.name + "\n" + card.skill + "\n\n" + caption;
                    labels[i].color = Ink;
                    note.text = (i + 1) + "/" + rewards.Length + " · " + card.rarity + " · " + card.name + " · " + caption;
                    title.text = QualityName(card.rarity) + " · " + card.name;
                    for (float t = 0; t < .16f && !skipReveal; t += Time.unscaledDeltaTime)
                    { face.localScale = new Vector3(Mathf.Lerp(.04f, 1, t / .16f), 1, 1); yield return null; }
                    face.localScale = Vector3.one;
                    if ((legendary || epic) && !skipReveal)
                    {
                        focus.gameObject.SetActive(true); focus.GetComponent<Image>().color = Color.Lerp(Ink, qualityColor, .18f);
                        focusTitle.text = legendary ? "传 说 降 临" : "史 诗 相 逢"; focusTitle.color = qualityColor;
                        hero.GetComponent<Image>().color = Color.Lerp(Paper, qualityColor, .35f); heroOutline.effectColor = qualityColor;
                        heroText.text = QualityName(card.rarity) + "\n\n" + card.name + "\n" + card.skill + "\n\n" + caption;
                    }
                    float hold = legendary ? 2.12f : epic ? 1.22f : card.rarity == "稀有" ? .37f : card.rarity == "特殊" ? .47f : .14f;
                    for (float t = 0; t < hold && !skipReveal; t += Time.unscaledDeltaTime)
                    {
                        if (legendary || epic) hero.localScale = Vector3.one * Mathf.Lerp(.86f, 1, Mathf.SmoothStep(0, 1, Mathf.Min(1, t / .3f)));
                        yield return null;
                    }
                    outline.effectDistance = new Vector2(4, -4);
                }
                focus.gameObject.SetActive(false); stage.GetComponent<Image>().color = Ink;
                title.text = "本次招募完成"; title.color = Paper;
                note.text = rewards.Count(r => r.isNew) + " 张新卡入藏 · 获得 " + rewards.Sum(r => r.shards) + " 枚同名碎片";
                for (float t = 0; t < .65f && !skipReveal; t += Time.unscaledDeltaTime) yield return null;
                finished = true;
            }
            finally
            {
                if (revealLayer != null) Destroy(revealLayer);
                revealLayer = null; revealGrid = null; busy = false;
                if (this != null && isActiveAndEnabled)
                {
                    Refresh();
                    if (!finished) status.text = "结果已保存，动画未完成；可重播本次。";
                    else if (isReplay) status.text = "已重播本次结果，未消耗测试额度。";
                    if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(replay.gameObject);
                }
            }
        }
        private RectTransform Modal(string title)
        {
            if (modal != null) Destroy(modal);
            var backdrop = Box(safe, "Dialog", new Color(0, 0, 0, .65f)); Stretch(backdrop); modal = backdrop.gameObject;
            var frame = Box(backdrop, "Dialog Body", Paper); frame.anchorMin = new Vector2(.05f, .10f); frame.anchorMax = new Vector2(.95f, .90f);
            frame.offsetMin = frame.offsetMax = Vector2.zero;
            var body = Scroll(frame, "Dialog Scroll"); Text(body, title, 34, Ink); return body;
        }
        private void Dismiss() { if (modal != null) Destroy(modal); modal = null; }
        private void ShowCard(string id)
        {
            if (busy) return;
            var card = cards[id]; var body = Modal(card.name);
            Text(body, card.camp + " / " + card.rarity + " / ID " + card.id + "\n基础战力 " + card.baseAttack, 26, Orange);
            Text(body, card.skill + "\n\n" + card.effect, 28, Ink);
            Text(body, "正式技能在此仅为展示，不自动接入演示对局。", 22, Muted);
            Button(body, "关闭详情", Dismiss);
        }
        private void ShowRules()
        {
            if (config == null || busy) return;
            var body = Modal("概率与规则");
            Text(body, string.Join("\n", config.groups.Select(g => g.rarity + " " + g.cardIds.Length + " 张 · " + (g.weight / 100.0).ToString("0.##") + "% · 重复 " + g.duplicateShards + " 同名碎片")), 26, Ink);
            Text(body, "先抽品质，再在该品质中等概率选一张。每张独立，橙卡（传说）可以首抽获得。\n\n300 / 400 / 500 测试元时，正常五张结算后按缺卡原始相对权重额外补发至 8 / 9 / 10 张。最终补齐所有卡，包括橙卡。\n\n集齐即停止。350 元是长期均价目标，不是每人的固定消费；最高 500 测试元。碎片仅预留升级用途，不可解锁新卡。\n\n浏览器与 Unity 存档独立，无账号、云同步或真实支付。", 25, Ink);
            Button(body, "知道了", Dismiss);
        }
        private void AskReset()
        {
            if (engine == null || busy) return;
            var body = Modal("重新开始测试？");
            Text(body, "仅清空此抽卡 Demo 的卡牌、碎片和模拟花费，恢复 500 测试元。不影响游戏账号、卡组或对局。", 28, Ink);
            Button(body, "取消", Dismiss);
            Button(body, "确认重置", () => { Dismiss(); Commit(() => engine.NewState(checked(state.revision + 1)), true); }, true);
        }
        private void Close() { if (!busy) Destroy(gameObject); }
        private void OnDestroy() { if (Closed != null) Closed(); }
    }
}
