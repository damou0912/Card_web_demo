using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using CardDemo.ConfigTools;

internal static class WorkbookChecks
{
    private const string Ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private const string Rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static string Cell(string address, string value) { return "<c r=\"" + address + "\" t=\"inlineStr\"><is><t>" + System.Security.SecurityElement.Escape(value) + "</t></is></c>"; }
    private static string Num(string address, string value) { return "<c r=\"" + address + "\"><v>" + value + "</v></c>"; }
    private static string Row(int row, params string[] cells) { return "<row r=\"" + row + "\">" + string.Concat(cells) + "</row>"; }
    private static string Header { get { return Row(1, Cell("A1", "cardId"), Cell("B1", "cardName"), Cell("C1", "camp"), Cell("D1", "rarity"), Cell("E1", "baseAttack"), Cell("F1", "skill"), Cell("G1", "effect"), Cell("H1", "defaultOrder")); } }
    private static string Card { get { return Row(2, Cell("A2", "01101"), Cell("B2", "廖化"), Cell("C2", "三国~蜀"), Cell("D2", "普通"), Num("E2", "2"), Cell("F2", "整军"), Cell("G2", "原说明"), Num("H2", "1")); } }

    public static void RunAll(Action<string> log)
    {
        int cases = 0;
        using (var input = Fixture())
        {
            var result = PresentationWorkbook.Read(input);
            Require(CardContentCompiler.Compile(result.CardsCsv).Catalog.cards[0].id == "01101", "ID preserved");
            Require(input.CanRead, "caller stream retained"); cases++;
        }
        using (var input = Fixture(Header + Card.Replace(Cell("B2", "廖化"), "<c r=\"B2\" t=\"s\"><v>0</v></c>"), shared: "<si><r><t>廖</t></r><r><t>化</t></r><rPh><t>liao</t></rPh></si>"))
        { Require(CardContentCompiler.Compile(PresentationWorkbook.Read(input).CardsCsv).Catalog.cards[0].name == "廖化", "shared rich text"); cases++; }
        using (var input = Fixture(Header + Card + Row(4, "<c r=\"A4\"/>") + Row(5), strict: true, absolute: true))
        { Require(CardContentCompiler.Compile(PresentationWorkbook.Read(input).CardsCsv).Count == 1, "strict XML and blanks"); cases++; }
        using (var input = Fixture(Card + Header))
        { Require(CardContentCompiler.Compile(PresentationWorkbook.Read(input).CardsCsv).Count == 1, "coordinates"); cases++; }
        using (var input = Fixture(Header + Card.Replace(Num("E2", "2"), Num("E2", "9.9E1"))))
        { Require(CardContentCompiler.Compile(PresentationWorkbook.Read(input).CardsCsv).Catalog.cards[0].baseAttack == 99, "numeric normalization"); cases++; }
        using (var input = Fixture(Header + Card.Replace(Cell("G2", "原说明"), Cell("G2", "逗,号\"引号\"\n换行\\路径_x005F_x0041_"))))
        { Require(CardContentCompiler.Compile(PresentationWorkbook.Read(input).CardsCsv).Catalog.cards[0].effect == "逗,号\"引号\"\r\n换行\\路径_x0041_", "escaping"); cases++; }
        Reject(Header + Card.Replace(Cell("A2", "01101"), Num("A2", "1101")), "Card Basics!A2", ref cases);
        Reject(Header + Card.Replace(Num("E2", "2"), Cell("E2", "2")), "整数数字", ref cases);
        foreach (string value in new[] { "-1", "2.5", "100", "NaN" })
            Reject(Header + Card.Replace(Num("E2", "2"), Num("E2", value)), "整数数字", ref cases);
        Reject(Header + Card.Replace(Num("H2", "1"), Num("H2", "50001")), "整数数字", ref cases);
        Reject(Header + Card.Replace(Num("E2", "2"), "<c r=\"E2\"><f>1+1</f><v>2</v></c>"), "不能使用公式", ref cases);
        Reject(Header + Card.Replace(Num("E2", "2"), "<c r=\"E2\" t=\"d\"><v>2026-01-01</v></c>"), "整数数字", ref cases);
        Reject(Header + Card.Replace(Cell("B2", "廖化"), "<c r=\"B2\" t=\"e\"><v>#REF!</v></c>"), "必须为文本", ref cases);
        Reject(Header + Card.Replace(Cell("G2", "原说明"), ""), "空字段", ref cases);
        Reject(Header.Replace("cardId", "id") + Card, "第 1 行", ref cases);
        Reject(Header + Card + Row(3, Cell("I3", "多余内容")), "仅 A:H", ref cases);
        Reject(Header + Card + Card, "行号无效", ref cases);
        Reject(Header + Card.Replace("r=\"C2\"", "r=\"B2\""), "坐标无效或重复", ref cases);
        Reject(Header + Card.Replace("r=\"C2\"", "r=\"C3\""), "坐标无效", ref cases);
        Reject(Header + Card.Replace(Cell("B2", "廖化"), "<c r=\"B2\" t=\"s\"><v>99</v></c>"), "共享文本索引", ref cases);
        using (var input = Fixture(external: true)) { MustFail(() => PresentationWorkbook.Read(input), "外部文件引用"); cases++; }
        using (var input = Fixture(merge: true)) { MustFail(() => PresentationWorkbook.Read(input), "不能合并"); cases++; }
        using (var input = Fixture(missing: true)) { MustFail(() => PresentationWorkbook.Read(input), "只包含一个工作表"); cases++; }
        using (var input = Fixture(icons: true))
        {
            var result = PresentationWorkbook.Read(input);
            Require(!result.IsCardWorkbook && result.CardsCsv == null && result.BadgeCsv.Contains("UI/shu"), "standalone icons workbook"); cases++;
        }
        using (var input = Fixture(icons: true, missing: true))
        { MustFail(() => PresentationWorkbook.Read(input), "只包含一个工作表"); cases++; }
        using (var input = Fixture(combined: true))
        { MustFail(() => PresentationWorkbook.Read(input), "只包含一个工作表"); cases++; }
        using (var input = Fixture(icons: true, external: true))
        { MustFail(() => PresentationWorkbook.Read(input), "外部文件引用"); cases++; }
        using (var input = Fixture(icons: true, merge: true))
        { MustFail(() => PresentationWorkbook.Read(input), "不能合并"); cases++; }
        using (var input = Fixture(Header + Card.Replace(Num("E2", "2"), "<c r=\"E2\" s=\"0\"><v>2</v></c>"), dateStyle: true))
        { MustFail(() => PresentationWorkbook.Read(input), "不支持日期"); cases++; }
        MustFail(() => PresentationWorkbook.Read("unsupported.xls"), "只支持 .xlsx"); cases++;
        log("PASS Excel reader: " + cases + " cases (separate English workbooks, text IDs, numeric fields, safe parsing).");
    }

    private static void Reject(string rows, string message, ref int cases)
    { using (var input = Fixture(rows)) MustFail(() => PresentationWorkbook.Read(input), message); cases++; }
    private static void MustFail(Action action, string message)
    {
        try { action(); } catch (FormatException e) { Require(e.Message.Contains(message), e.Message); return; }
        throw new Exception("Expected failure: " + message);
    }
    private static void Require(bool ok, string message) { if (!ok) throw new Exception("Workbook test failed: " + message); }

    private static MemoryStream Fixture(string rows = null, string shared = null, bool strict = false,
        bool absolute = false, bool external = false, bool merge = false, bool missing = false, bool dateStyle = false,
        bool icons = false, bool combined = false)
    {
        string ns = strict ? "http://purl.oclc.org/ooxml/spreadsheetml/main" : Ns;
        string rel = strict ? "http://purl.oclc.org/ooxml/officeDocument/relationships" : Rel;
        var stream = new MemoryStream();
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Create, true))
        {
            string sheetName = icons ? PresentationWorkbook.BadgeSheetName : PresentationWorkbook.CardSheetName;
            Write(zip, "xl/workbook.xml", "<workbook xmlns=\"" + ns + "\" xmlns:r=\"" + rel + "\"><sheets><sheet name=\"" + (missing ? "错误" : sheetName) + "\" r:id=\"b\"/>"
                + (combined ? "<sheet name=\"Faction Icons\" r:id=\"a\"/>" : "") + "</sheets></workbook>");
            Write(zip, "xl/_rels/workbook.xml.rels", "<Relationships><Relationship Id=\"b\" Type=\"" + rel + "/worksheet\" Target=\"" + (absolute ? "/xl/" : "") + "worksheets/b.xml\"" + (external ? " TargetMode=\"External\"" : "") + "/>"
                + (shared == null ? "" : "<Relationship Id=\"s\" Type=\"" + rel + "/sharedStrings\" Target=\"sharedStrings.xml\"/>") + "</Relationships>");
            string iconRows = Row(1, Cell("A1", "camp"), Cell("B1", "displayName"), Cell("C1", "spritePath"))
                + Row(2, Cell("A2", "三国~蜀"), Cell("B2", "蜀"), Cell("C2", "UI/shu"));
            Write(zip, "xl/worksheets/b.xml", "<worksheet xmlns=\"" + ns + "\"><sheetData>" + (rows ?? (icons ? iconRows : Header + Card)) + "</sheetData>" + (merge ? "<mergeCells><mergeCell ref=\"A2:B2\"/></mergeCells>" : "") + "</worksheet>");
            if (shared != null) Write(zip, "xl/sharedStrings.xml", "<sst xmlns=\"" + ns + "\">" + shared + "</sst>");
            if (dateStyle) Write(zip, "xl/styles.xml", "<styleSheet xmlns=\"" + ns + "\"><cellXfs><xf numFmtId=\"14\"/></cellXfs></styleSheet>");
        }
        stream.Position = 0; return stream;
    }
    private static void Write(ZipArchive zip, string path, string xml)
    { using (var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false))) writer.Write(xml); }
}
