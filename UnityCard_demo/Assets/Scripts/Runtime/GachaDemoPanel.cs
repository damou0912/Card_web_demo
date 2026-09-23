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
    // Free local recruitment. Saved acquisitions unlock extra cards; no real payments or Web account sync.
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
        private GachaProfile profile;
        private FileStream profileLock;
        private Dictionary<string, CardDefinition> cards;
        private readonly System.Random random = new System.Random();
        private Font font;
        private RectTransform safe, content;
        private Text balance, progress, shardTotal, fragmentHint, status, resultHeading, poolTitle, conversionStatus;
        private GridLayoutGroup results, collection;
        private Button draw, replay;
        private readonly Dictionary<string, Button> collectionTabs = new Dictionary<string, Button>();
        private string collectionCamp = "三国~魏";
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

        public static void ValidatePlayerDeck(IEnumerable<CardDefinition> deck)
        {
            var config = Read<GachaConfig>("Config/gacha-demo");
            var catalog = Read<CardCatalog>("Data/web-card-catalog");
            var engine = new GachaDemo(config, catalog.cards);
            string path = Path.Combine(Application.persistentDataPath, "gacha-profile.json");
            Directory.CreateDirectory(Application.persistentDataPath);
            using (var gate = new FileStream(path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
            {
                string legacy = GachaSaveFile.PathForPool(Application.persistentDataPath, config.poolId, "gacha-demo-v1.json");
                var inventory = GachaSaveFile.LoadProfile(path, legacy, config.poolId, engine, ReadProfileJson,
                    text => NormalizeState(JsonUtility.FromJson<GachaState>(text)), value => JsonUtility.ToJson(value, true));
                GachaInventory.ValidatePlayerDeck(deck, inventory, config);
            }
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
                savePath = Path.Combine(Application.persistentDataPath, "gacha-profile.json");
                profile = GachaProfiles.Open(GachaProfiles.New(), engine, config.poolId, null, out _);
                try
                {
                    Directory.CreateDirectory(Application.persistentDataPath);
                    profileLock = new FileStream(savePath + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                    string legacy = GachaSaveFile.PathForPool(Application.persistentDataPath, config.poolId, "gacha-demo-v1.json");
                    profile = GachaSaveFile.LoadProfile(savePath, legacy, config.poolId, engine,
                        ReadProfileJson, text => NormalizeState(JsonUtility.FromJson<GachaState>(text)), value => JsonUtility.ToJson(value, true));
                }
                catch (Exception error) { Debug.LogWarning(error.Message); loadError = "存档读取或结算失败。已暂停操作以保护各期进度与通用碎片，请修复存档或关闭另一实例后重开。"; }
                state = GachaProfiles.Current(profile, config.poolId);
                Refresh();
                status.text = loadError ?? (state.bundles == 0 ? "已领取 " + config.testCredit + " 测试元，可以开始招募。" : "已恢复本机的抽卡进度。");
            }
            catch (Exception error) { status.text = "抽卡 Demo 加载失败：" + error.Message; draw.interactable = false; Debug.LogException(error); }
        }
        private static T Read<T>(string resource)
        {
            var text = Resources.Load<TextAsset>(resource);
            if (text == null) throw new InvalidOperationException("缺少资源：" + resource);
            return JsonUtility.FromJson<T>(text.text);
        }
        private static GachaState NormalizeState(GachaState value)
        {
            if (value != null && !value.conversionDone && value.conversion != null
                && value.conversion.sourceShards == 0 && value.conversion.universalShards == 0) value.conversion = null;
            return value;
        }
        private static GachaProfile ReadProfileJson(string json)
        {
            var value = JsonUtility.FromJson<GachaProfile>(json);
            if (value != null)
            {
                if (value.pools != null) foreach (var period in value.pools) NormalizeState(period);
                if (value.archivedRuns != null) foreach (var period in value.archivedRuns) NormalizeState(period);
            }
            return value;
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
            // Fixed portrait composition fitted inside the safe area; only detail dialogs scroll.
            content = Box(safe, "Recruitment Single Screen", Paper);
            content.anchorMin = content.anchorMax = new Vector2(.5f, .5f);
            content.sizeDelta = new Vector2(1080, 1920);
            var layout = content.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.padding = new RectOffset(30, 30, 24, 24); layout.spacing = 12;
            layout.childControlHeight = layout.childControlWidth = true; layout.childForceExpandHeight = false;
            Height(Text(content, "三国 · 群英招募 / 免费测试 · 本机卡牌自动保存", 24, Muted), 36);
            poolTitle = Text(content, "群英招募", 50, Ink); Height(poolTitle, 66);
            balance = Text(content, "", 34, Green); Height(balance, 46);
            progress = Text(content, "", 28, Ink); Height(progress, 42);
            shardTotal = Text(content, "", 32, Green); Height(shardTotal, 84);
            Height(Text(content, "全部卡牌 · 兑换 / 点击卡牌查看技能", 32, Ink), 48);
            var tabs = Box(content, "Country Tabs (display only)", Color.clear); Height(tabs, 48);
            var tabLayout = tabs.gameObject.AddComponent<HorizontalLayoutGroup>(); tabLayout.spacing = 12;
            tabLayout.childControlWidth = tabLayout.childControlHeight = true; tabLayout.childForceExpandWidth = true;
            foreach (string camp in new[] { "三国~魏", "三国~蜀", "三国~吴" })
            {
                var button = Button(tabs, camp.Replace("~", "-"), () => SelectCollectionCamp(camp));
                button.GetComponent<LayoutElement>().minHeight = button.GetComponent<LayoutElement>().preferredHeight = 48;
                collectionTabs.Add(camp, button);
            }
            collection = Grid(content, "Collection");
            resultHeading = Text(content, "本次相逢", 28, Ink); Height(resultHeading, 46);
            results = Grid(content, "Rewards");
            fragmentHint = Text(content, "", 26, Green); Height(fragmentHint, 48);
            draw = Button(content, "招募五张 · 20 测试元", Draw, true);
            status = Text(content, "正在加载…", 24, Green); Height(status, 62);
            conversionStatus = Text(content, "", 24, Green); Height(conversionStatus, 72);
            var actions = Box(content, "Actions", Color.clear); Height(actions, 74);
            var row = actions.gameObject.AddComponent<HorizontalLayoutGroup>(); row.spacing = 12;
            row.childControlWidth = row.childControlHeight = true; row.childForceExpandWidth = true;
            replay = Button(actions, "重播", Replay);
            Button(actions, "规则", ShowRules);
            Button(actions, "关闭", Close);
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
            float scale = Mathf.Min(safe.rect.width / 1080, safe.rect.height / 1920);
            content.localScale = Vector3.one * scale;
            foreach (var grid in new[] { results, collection })
                SizeGrid(grid, 1020, grid == collection ? 280 : 190, 5);
            if (revealGrid != null) SizeRevealGrid();
            if (busy && Input.GetKeyDown(KeyCode.Escape)) skipReveal = true;
        }
        private static void SizeGrid(GridLayoutGroup grid, float width, float height, int fixedColumns = 0)
        {
            width = Mathf.Max(40, width);
            int columns = fixedColumns > 0 ? fixedColumns : width > 1400 ? 5 : width > 750 ? 3 : 2;
            grid.constraintCount = columns;
            grid.cellSize = new Vector2((width - (columns - 1) * 14) / columns, height);
            grid.GetComponent<LayoutElement>().preferredHeight = Mathf.Ceil(grid.transform.childCount / (float)columns) * (height + 14);
        }
        private void SizeRevealGrid()
        {
            float width = Mathf.Max(60, ((RectTransform)revealGrid.transform.parent).rect.width - 60);
            int columns = safe.rect.width > safe.rect.height ? 5 : 3;
            if (revealGrid.transform.childCount != 5) { revealGrid.enabled = true; SizeGrid(revealGrid, width, 300, columns); return; }
            revealGrid.enabled = false;
            float cellWidth = (width - (columns - 1) * 14) / columns;
            float cellHeight = Mathf.Min(370, cellWidth * 1.6f);
            int rows = columns == 5 ? 1 : 2;
            revealGrid.constraintCount = columns; revealGrid.cellSize = new Vector2(cellWidth, cellHeight);
            revealGrid.GetComponent<LayoutElement>().preferredHeight = rows * (cellHeight + 14);
            for (int i = 0; i < 5; i++)
            {
                var rect = (RectTransform)revealGrid.transform.GetChild(i);
                int row = i / columns, col = i % columns;
                float centerOffset = row == 1 ? (cellWidth + 14) / 2 : 0;
                rect.anchorMin = rect.anchorMax = rect.pivot = new Vector2(0, 1);
                rect.sizeDelta = new Vector2(cellWidth, cellHeight);
                rect.anchoredPosition = new Vector2(col * (cellWidth + 14) + centerOffset, -row * (cellHeight + 14));
            }
        }
        private Text RevealText(Transform parent, float bottom, float top, int size)
        {
            var text = Text(parent, "", size, Ink);
            text.rectTransform.anchorMin = new Vector2(.05f, bottom); text.rectTransform.anchorMax = new Vector2(.95f, top);
            text.rectTransform.offsetMin = text.rectTransform.offsetMax = Vector2.zero;
            text.alignment = TextAnchor.MiddleCenter; text.verticalOverflow = VerticalWrapMode.Truncate;
            text.resizeTextForBestFit = true; text.resizeTextMinSize = 18; text.resizeTextMaxSize = size;
            text.gameObject.SetActive(false); return text;
        }
        private void Fill(GridLayoutGroup grid, IEnumerable<Tuple<string, string, bool>> entries, bool forExchange = false)
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
                var qualityLabel = Text(band, card.camp.Replace("三国~", "") + " · " + card.rarity, 26, Ink); Stretch(qualityLabel.rectTransform);
                qualityLabel.fontStyle = FontStyle.Bold; qualityLabel.alignment = TextAnchor.MiddleCenter;
                if (forExchange && !entry.Item3)
                {
                    int cost = engine.ExchangeCost(id);
                    long available = (long)engine.ShardBalance(state) + GachaProfiles.UniversalBalance(profile);
                    label.rectTransform.offsetMin = new Vector2(14, 108);
                    var exchangeButton = Button(button.transform, cost + " 碎片\n" + (available >= cost ? "兑换" : "碎片不足"), () => AskExchange(id), true);
                    exchangeButton.interactable = !busy && loadError == null && available >= cost;
                    var rect = (RectTransform)exchangeButton.transform;
                    rect.anchorMin = Vector2.zero; rect.anchorMax = new Vector2(1, 0);
                    rect.offsetMin = new Vector2(10, 10); rect.offsetMax = new Vector2(-10, 100);
                    exchangeButton.GetComponentInChildren<Text>().fontSize = 23;
                }
            }
        }
        private void Refresh()
        {
            poolTitle.text = config.title;
            balance.text = "测试额度 " + engine.Remaining(state) + " 元　·　仅模拟，不产生真实扣款";
            progress.text = "完整卡牌总数 " + state.owned.Count + "/" + engine.CardCount + " 张　·　优先本期碎片，通用补足";
            int local = engine.ShardBalance(state), universal = GachaProfiles.UniversalBalance(profile);
            shardTotal.text = config.shardName + " " + local + " 枚\n通用碎片 " + universal + " 枚";
            conversionStatus.text = ConversionText();
            conversionStatus.gameObject.SetActive(state.conversion != null);
            int needed = config.groups.SelectMany(g => g.cardIds).Where(id => state.owned.All(c => c.cardId != id)).Sum(engine.ExchangeCost);
            fragmentHint.text = engine.Complete(state) ? "本期卡牌已齐，剩余碎片已转通用。" : local + (long)universal >= needed ? "碎片已足够兑换全部缺卡。" : "保底以本期碎片补足 · 补齐还需 " + (needed - local - universal) + " 碎片";
            draw.interactable = !busy && loadError == null && !engine.Complete(state) && engine.Remaining(state) >= config.bundlePrice;
            replay.interactable = !busy && loadError == null && state.lastRewards.Count > 0;
            draw.GetComponentInChildren<Text>().text = engine.Complete(state) ? "本期已集齐 · 卡牌已入藏" : engine.Remaining(state) < config.bundlePrice ? "抽取结束 · 请使用碎片兑换缺卡" : "招募五张 · 20 测试元";
            int grant = state.shardGrants.Where(g => g.bundles == state.bundles).Sum(g => g.amount);
            resultHeading.text = "本次相逢 · 第 " + state.bundles + " 次" + (grant > 0 ? " · 保底补足 " + grant + " 碎片" : "") + (state.lastRewards.Count > 5 ? " · 旧保底卡重播可见" : "");
            Fill(results, state.lastRewards.Take(5).Select(r => Tuple.Create(r.cardId, r.isNew ? "新卡" : "+" + r.shards + " 碎片", true)));
            var ids = config.groups.SelectMany(g => g.cardIds).OrderBy(id => id).ToArray();
            if (!ids.Any(id => cards[id].camp == collectionCamp)) collectionCamp = cards[ids[0]].camp;
            foreach (var tab in collectionTabs)
            {
                bool available = ids.Any(id => cards[id].camp == tab.Key), selected = tab.Key == collectionCamp;
                tab.Value.gameObject.SetActive(available); tab.Value.interactable = available && !busy;
                var tint = tab.Key == "三国~魏" ? new Color32(40, 95, 141, 255)
                    : tab.Key == "三国~蜀" ? new Color32(161, 87, 40, 255) : new Color32(57, 113, 80, 255);
                tab.Value.GetComponent<Image>().color = selected ? (Color)tint : new Color32(227, 231, 217, 255);
                var label = tab.Value.GetComponentInChildren<Text>();
                label.color = selected ? Paper : Ink; label.fontStyle = selected ? FontStyle.Bold : FontStyle.Normal;
            }
            Fill(collection, ids.Where(id => cards[id].camp == collectionCamp).Select(id => {
                var owned = state.owned.FirstOrDefault(c => c.cardId == id);
                return Tuple.Create(id, owned == null ? "未拥有" : "已拥有", owned != null);
            }), true);
        }
        private void SelectCollectionCamp(string camp)
        {
            if (busy || engine == null) return;
            collectionCamp = camp; Refresh();
        }
        private void Draw()
        {
            if (busy || engine == null || loadError != null) return;
            Commit(() => GachaProfiles.Draw(profile, engine, config.poolId, random.Next), "draw");
        }
        private static string PaymentText(int cost, int universal) { return (cost - universal) + " 枚本期碎片" + (universal > 0 ? " + " + universal + " 枚通用碎片" : ""); }
        private string ConversionText()
        {
            var c = state.conversion;
            return c == null ? "" : "本期已集齐：剩余 " + c.sourceShards + " 枚本期碎片已转为 " + c.universalShards + " 枚通用碎片（10:1，向下取整，余数舍去）。";
        }
        private void AskExchange(string id)
        {
            if (busy || engine == null || loadError != null) return;
            int local = engine.ShardBalance(state), universal = GachaProfiles.UniversalBalance(profile), revision = profile.revision;
            var quote = engine.Quote(state, id, universal);
            string poolId = config.poolId;
            if (!quote.canAfford) return;
            var body = Modal("确认兑换？");
            int left = local - quote.poolUsed;
            Text(body, "兑换「" + cards[id].name + "」需要 " + quote.cost + " 枚碎片。\n可用共 " + ((long)local + universal) + " 枚：" + config.shardName + " " + local + " 枚 + 通用碎片 " + universal
                + " 枚。\n本次将消耗：" + PaymentText(quote.cost, quote.universalUsed) + "。\n兑换后本期剩余 " + left + " 枚，通用剩余 " + (universal - quote.universalUsed)
                + " 枚。" + (state.owned.Count == engine.CardCount - 1 ? "\n本次将集齐，剩余本期碎片会转为 " + (left / 10) + " 枚通用碎片（余数舍去）。" : "")
                + "\n优先使用本期碎片，通用 1:1 补足。不扣测试额度，不推进消费保底。", 28, Ink);
            Button(body, "取消", Dismiss);
            Button(body, "确认兑换", () => {
                Dismiss();
                Commit(() => {
                    if (revision != profile.revision) throw new InvalidOperationException("进度已更新，请重新确认兑换。");
                    return GachaProfiles.Exchange(profile, engine, poolId, id, quote.universalUsed);
                }, "exchange", id);
            }, true);
        }
        private void Commit(Func<GachaProfile> transaction, string action, string cardId = null)
        {
            if (busy || loadError != null) return;
            busy = true;
            bool committed = false;
            try
            {
                var next = transaction();
                GachaSaveFile.Write(savePath, JsonUtility.ToJson(next, true)); profile = next; state = GachaProfiles.Current(profile, config.poolId);
                committed = true;
                status.text = action == "exchange" ? "兑换成功：" + cards[cardId].name + " · 已拥有。未消耗测试额度。"
                    : action == "reset" ? "已重置本期测试进度，通用碎片余额不变。" : engine.Complete(state) ? "本期卡牌已齐！共花费 " + engine.Spent(state) + " 测试元。" : "招募完成，卡牌与碎片已自动保存。";
                if (state.conversion != null) status.text += "\n" + ConversionText();
            }
            catch (Exception error) { status.text = "操作未完成，进度未更新：" + error.Message; Debug.LogWarning(error.Message); }
            finally { busy = false; }
            // Save and probability logic finish first. The coroutine only reads the saved snapshot.
            if (committed && action == "draw") BeginReveal(false);
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
                var qualities = new List<Text>(); var names = new List<Text>(); var skills = new List<Text>(); var captions = new List<Text>();
                foreach (var reward in rewards)
                {
                    var face = Box(revealGrid.transform, "Saved Reward", Green);
                    var outline = face.gameObject.AddComponent<Outline>(); outline.effectColor = Muted; outline.effectDistance = new Vector2(2, -2);
                    var label = Text(face, "三 国\n\n将\n\n群英录", 30, Paper); Stretch(label.rectTransform);
                    label.rectTransform.offsetMin = new Vector2(14, 10); label.rectTransform.offsetMax = new Vector2(-14, -10);
                    label.alignment = TextAnchor.MiddleCenter; label.resizeTextForBestFit = true; label.resizeTextMinSize = 18; label.resizeTextMaxSize = 30;
                    label.verticalOverflow = VerticalWrapMode.Truncate;
                    faces.Add(face); labels.Add(label);
                    qualities.Add(RevealText(face, .79f, .95f, 26));
                    names.Add(RevealText(face, .44f, .77f, 42));
                    skills.Add(RevealText(face, .30f, .44f, 24));
                    captions.Add(RevealText(face, .05f, .29f, 26));
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
                    string caption = reward.guarantee ? "保底补发 · 已拥有" : reward.isNew ? "新卡 · 已拥有" : "重复卡\n+" + reward.shards + " 碎片";
                    labels[i].gameObject.SetActive(false);
                    qualities[i].text = QualityName(card.rarity); names[i].text = card.name;
                    skills[i].text = card.skill; captions[i].text = caption;
                    foreach (var part in new[] { qualities[i], names[i], skills[i], captions[i] }) part.gameObject.SetActive(true);
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
                note.text = rewards.Count(r => r.isNew) + " 张新卡入藏 · 重复转 " + rewards.Sum(r => r.shards) + " 碎片 · 保底补足 " + state.shardGrants.Where(g => g.bundles == state.bundles).Sum(g => g.amount) + " 碎片";
                for (float t = 0; t < .65f && !skipReveal; t += Time.unscaledDeltaTime) yield return null;
                skip.GetComponentInChildren<Text>().text = "收下卡牌";
                while (!skipReveal) yield return null;
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
        private RectTransform DetailSection(Transform parent, string name, Color background)
        {
            var section = Box(parent, name, background);
            var layout = section.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.padding = new RectOffset(22, 22, 18, 18); layout.spacing = 12;
            layout.childControlWidth = layout.childControlHeight = true; layout.childForceExpandHeight = false;
            return section;
        }
        private void ShowCard(string id)
        {
            if (busy) return;
            var card = cards[id]; var body = Modal(card.name);
            Text(body, card.camp.Replace("~", "-") + " · " + card.rarity, 26, Orange);
            bool owned = state.owned.Any(c => c.cardId == id);
            var ownership = DetailSection(body, "Ownership Frame", owned ? new Color32(228, 236, 223, 255) : new Color32(238, 230, 215, 255));
            var outline = ownership.gameObject.AddComponent<Outline>();
            outline.effectColor = owned ? Green : Orange; outline.effectDistance = new Vector2(1, -1);
            Text(ownership, owned ? "已拥有" : "未拥有", 26, owned ? Green : Orange);
            var power = DetailSection(body, "Base Power", Green);
            Text(power, "基础战力", 22, new Color32(212, 223, 210, 255));
            Text(power, card.baseAttack.ToString(), 52, Paper);
            var skill = DetailSection(body, "Card Skill", new Color32(250, 248, 239, 255));
            Text(skill, "卡牌技能", 22, Muted);
            Text(skill, card.skill, 32, Ink);
            var effects = DetailSection(body, "Skill Effects", new Color32(234, 236, 225, 255));
            Text(effects, "技能效果", 22, Green);
            Text(effects, card.effect, 28, Ink);
            Text(body, "卡牌技能仅作展示，暂不接入对局。", 22, Muted);
            Button(body, "关闭详情", Dismiss);
        }
        private void ShowRules()
        {
            if (config == null || busy) return;
            var body = Modal("概率与规则");
            Text(body, string.Join("\n", config.groups.Select(g => g.rarity + " " + g.cardIds.Length + " 张 · " + (g.weight / 100.0).ToString("0.##") + "% · 重复得 " + g.duplicateShards + " 碎片 · 兑换消耗 " + g.exchangeCost)), 26, Ink);
            Text(body, "先抽品质，再在该品质中等概率选一张。每张独立，橙卡可以首抽获得，重复卡显示本次 +X 碎片。\n\n保底不直接送卡，按最便宜缺卡补足本期碎片：\n" + string.Join("\n", config.milestones.Select(m => "第 " + (m.spent / config.bundlePrice) + " 次五连：足够兑换至 " + m.uniqueCards + " 张"))
                + "\n每个节点仅结算一次；余额足够则补 0。本期共 " + engine.CardCount + " 张卡牌，同一奖池、共用本期碎片；国度页签只切换展示，不改变抽取范围。整套目标平均约 " + config.targetAverageCost + " 测试元，允许超过均价。保留 " + config.testCredit + " 测试元兜底，届时足够兑换整套，需手动确认。平均花费受策略及跨期通用碎片影响，不保证个人固定成本。\n\n重复卡转为本期碎片。集齐全套后在整次奖励结算完，将剩余本期碎片按 10:1 转通用，向下取整、余数舍去，仅一次。通用碎片跨期保留，1:1 抵任意期碎片，优先本期、再用通用补足，确认框列出明细。兑换不扣测试额度、不推进保底。\n\n浏览器与 Unity 存档独立，无账号、云同步或真实支付。", 25, Ink);
            Button(body, "知道了", Dismiss);
        }
        private void Close() { if (!busy) Destroy(gameObject); }
        private void OnDestroy() { if (profileLock != null) profileLock.Dispose(); if (Closed != null) Closed(); }
    }
}
