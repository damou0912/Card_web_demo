using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace CardDemo.ConfigTools
{
    // Data-only XLSX reader shared by the editor and standalone exporter.
    // No Excel installation, COM automation, package restore or formula execution.
    public sealed class PresentationWorkbook
    {
        public const string CardFileName = "Card Basics.xlsx";
        public const string BadgeFileName = "Faction Icons.xlsx";
        public const string CardSheetName = "Card Basics";
        public const string BadgeSheetName = "Faction Icons";
        // Identifies a standalone workbook by its worksheet, never by the chosen filename.
        public bool IsCardWorkbook { get { return CardsCsv != null; } }
        public string BadgeCsv { get; private set; }
        public string CardsCsv { get; private set; }
        public static readonly string[] CardHeaders = { "cardId", "cardName", "camp", "rarity", "baseAttack", "skill", "effect", "defaultOrder" };

        public static PresentationWorkbook Read(string path)
        {
            if (!string.Equals(Path.GetExtension(path), ".xlsx", StringComparison.OrdinalIgnoreCase))
                throw new FormatException("只支持 .xlsx，请用 Excel/WPS 另存为 Excel 工作簿。");
            using (var stream = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                return Read(stream);
        }

        public static PresentationWorkbook Read(Stream stream)
        {
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read, true))
            {
                if (zip.Entries.Count > 4096 || zip.Entries.Sum(e => e.Length) > 64L * 1024 * 1024)
                    throw new FormatException("Excel 内容过大，请仅保留配置数据。");
                if (zip.Entries.GroupBy(e => e.FullName, StringComparer.Ordinal).Any(g => g.Count() > 1))
                    throw new FormatException("Excel 压缩包含重复文件。");
                var workbook = ReadXml(zip, "xl/workbook.xml");
                var links = ReadXml(zip, "xl/_rels/workbook.xml.rels").Root.Elements()
                    .Where(e => e.Name.LocalName == "Relationship")
                    .ToDictionary(e => (string)e.Attribute("Id"), StringComparer.Ordinal);
                var sheets = workbook.Root.Elements().Single(e => e.Name.LocalName == "sheets").Elements()
                    .ToDictionary(e => (string)e.Attribute("name"), StringComparer.Ordinal);
                var strings = new List<string>();
                var stringLink = links.Values.SingleOrDefault(e => ((string)e.Attribute("Type") ?? "").EndsWith("/sharedStrings", StringComparison.Ordinal));
                if (stringLink != null)
                {
                    var shared = ReadXml(zip, ResolveTarget(stringLink));
                    strings.AddRange(shared.Root.Elements().Where(e => e.Name.LocalName == "si").Select(ReadText));
                }
                if (sheets.Count != 1 || (!sheets.ContainsKey(CardSheetName) && !sheets.ContainsKey(BadgeSheetName)))
                    throw new FormatException("每份 Excel 必须只包含一个工作表：Card Basics 或 Faction Icons。请使用拆分后的配置文件。");
                return sheets.ContainsKey(CardSheetName)
                    ? new PresentationWorkbook { CardsCsv = ReadSheet(zip, sheets, links, strings, CardSheetName, CardHeaders, 4, 7) }
                    : new PresentationWorkbook { BadgeCsv = ReadSheet(zip, sheets, links, strings, BadgeSheetName, new[] { "camp", "displayName", "spritePath" }) };
            }
        }

        private static XDocument ReadXml(ZipArchive zip, string path)
        {
            var entry = zip.GetEntry(path);
            if (entry == null) throw new FormatException("Excel 缺少内部文件：" + path);
            if (entry.Length > 8 * 1024 * 1024) throw new FormatException("Excel 内部文件过大：" + path);
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 8 * 1024 * 1024 };
            using (var input = entry.Open())
            using (var reader = XmlReader.Create(input, settings)) return XDocument.Load(reader);
        }

        private static string ResolveTarget(XElement link)
        {
            string target = (string)link.Attribute("Target");
            if (string.Equals((string)link.Attribute("TargetMode"), "External", StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrEmpty(target) || target.IndexOfAny(new[] { ':', '\\', '?', '#', '%' }) >= 0)
                throw new FormatException("Excel 配置不支持外部文件引用。");
            var parts = new List<string>();
            foreach (string part in (target.StartsWith("/", StringComparison.Ordinal) ? target.Substring(1) : "xl/" + target).Split('/'))
            {
                if (part == "." || part == "") continue;
                if (part == "..")
                {
                    if (parts.Count == 0) throw new FormatException("Excel 内部路径越界。");
                    parts.RemoveAt(parts.Count - 1);
                }
                else parts.Add(part);
            }
            return string.Join("/", parts);
        }

        private static string ReadSheet(ZipArchive zip, Dictionary<string, XElement> sheets,
            Dictionary<string, XElement> links, List<string> strings, string name, string[] headers, params int[] integerColumns)
        {
            XElement sheet;
            if (!sheets.TryGetValue(name, out sheet)) throw new FormatException("Excel 缺少工作表：" + name);
            string id = (string)sheet.Attributes().Single(a => a.Name.LocalName == "id");
            XElement link;
            if (!links.TryGetValue(id, out link) || !((string)link.Attribute("Type") ?? "").EndsWith("/worksheet", StringComparison.Ordinal))
                throw new FormatException("Excel 工作表关系无效：" + name);
            var document = ReadXml(zip, ResolveTarget(link));
            XNamespace ns = document.Root.Name.Namespace;
            if (document.Descendants(ns + "mergeCell").Any()) throw new FormatException(name + "：数据表不能合并单元格。");
            var data = document.Root.Element(ns + "sheetData");
            if (data == null) throw new FormatException(name + "：没有表格数据。");
            var rows = new SortedDictionary<int, string[]>();
            foreach (var row in data.Elements(ns + "row"))
            {
                int index;
                if (!int.TryParse((string)row.Attribute("r"), out index) || index < 1 || index > 50000 || rows.ContainsKey(index))
                    throw new FormatException(name + "：行号无效、重复或超过 50000 行。");
                var values = Enumerable.Repeat("", headers.Length).ToArray();
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (var cell in row.Elements(ns + "c"))
                {
                    string address = (string)cell.Attribute("r") ?? "";
                    var match = Regex.Match(address, @"\A([A-Z]{1,3})([1-9][0-9]*)\z");
                    if (!match.Success || match.Groups[2].Value != index.ToString(CultureInfo.InvariantCulture) || !seen.Add(address))
                        throw new FormatException(name + "：单元格坐标无效或重复：" + address);
                    string location = name + "!" + address;
                    if (cell.Element(ns + "f") != null)
                        throw new FormatException(location + "：不能使用公式，请复制并粘贴为文本值后导出。");
                    string column = match.Groups[1].Value;
                    int columnIndex = column.Length == 1 ? column[0] - 'A' : -1;
                    bool integer = index > 1 && integerColumns.Contains(columnIndex);
                    if (integer && cell.Element(ns + "v") != null)
                        ValidateNumberStyle(zip, cell, location);
                    string value = ReadCell(cell, strings, location, integer, columnIndex == 7 ? 50000 : 99);
                    if (columnIndex >= 0 && columnIndex < headers.Length) values[columnIndex] = value;
                    else if (value.Length != 0) throw new FormatException(location + "：仅 A:" + (char)('A' + headers.Length - 1) + " 参与配置，请不要在数据列外填内容。");
                }
                rows.Add(index, values);
            }
            string[] first;
            if (!rows.TryGetValue(1, out first) || !first.SequenceEqual(headers))
                throw new FormatException(name + "：第 1 行必须是 " + string.Join(",", headers));
            var csv = new StringBuilder("\uFEFF");
            foreach (var row in rows.Where(r => r.Key == 1 || r.Value.Any(v => v.Length != 0)))
            {
                if (row.Value.Any(string.IsNullOrWhiteSpace)) throw new FormatException(name + "：第 " + row.Key + " 行存在空字段。");
                csv.Append(string.Join(",", row.Value.Select(v => "\"" + v.Replace("\"", "\"\"") + "\""))).Append("\r\n");
            }
            return csv.ToString();
        }

        private static string ReadCell(XElement cell, List<string> strings, string location, bool integer = false, int maximum = 99)
        {
            XNamespace ns = cell.Name.Namespace;
            string type = (string)cell.Attribute("t");
            string value = (string)cell.Element(ns + "v") ?? "";
            if (integer)
            {
                if (value.Length == 0 && cell.Element(ns + "is") == null && type != "s") return "";
                decimal number;
                if ((type != null && type != "n") || !decimal.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out number)
                    || number < 0 || number > maximum || number != decimal.Truncate(number))
                    throw new FormatException(location + "：必须是 0~" + maximum + " 的整数数字，不能是文本、日期或公式。");
                return number.ToString("0", CultureInfo.InvariantCulture);
            }
            if (type == "inlineStr") return ReadText(cell.Element(ns + "is"));
            if (type == "s")
            {
                int index;
                if (!int.TryParse(value, out index) || index < 0 || index >= strings.Count)
                    throw new FormatException(location + "：共享文本索引无效。");
                return strings[index];
            }
            if (type == "str") return DecodeText(value);
            if (value.Length == 0) return ""; // Style-only empty cells are harmless.
            throw new FormatException(location + "：必须为文本，不能是数字、日期、布尔值或错误值。请先设置单元格格式为文本，再重新输入完整值（含 ID 前导零）。");
        }

        private static void ValidateNumberStyle(ZipArchive zip, XElement cell, string location)
        {
            int index;
            if (!int.TryParse((string)cell.Attribute("s") ?? "0", out index) || index < 0)
                throw new FormatException(location + "：数字样式索引无效。");
            if (zip.GetEntry("xl/styles.xml") == null)
            {
                if (index == 0) return;
                throw new FormatException(location + "：缺少数字样式。");
            }
            var styles = ReadXml(zip, "xl/styles.xml");
            XNamespace ns = styles.Root.Name.Namespace;
            var formats = styles.Root.Element(ns + "cellXfs")?.Elements(ns + "xf").ToArray();
            if (formats == null || index >= formats.Length) throw new FormatException(location + "：数字样式索引越界。");
            int format;
            if (!int.TryParse((string)formats[index].Attribute("numFmtId") ?? "0", out format))
                throw new FormatException(location + "：数字格式无效。");
            if (format >= 0 && format <= 4) return; // General and ordinary numeric formats only.
            string code = (string)styles.Root.Element(ns + "numFmts")?.Elements(ns + "numFmt")
                .FirstOrDefault(e => (string)e.Attribute("numFmtId") == format.ToString(CultureInfo.InvariantCulture))?.Attribute("formatCode");
            if (new[] { "General", "0", "0.00", "#,##0", "#,##0.00" }.Contains(code)) return;
            throw new FormatException(location + "：请使用常规或数字格式，不支持日期、百分比或其他格式。");
        }

        private static string ReadText(XElement element)
        {
            if (element == null) return "";
            XNamespace ns = element.Name.Namespace;
            // Ignore phonetic guide text (rPh), retain rich-text runs in order.
            return DecodeText(string.Concat(element.Elements().SelectMany(e => e.Name == ns + "t"
                ? new[] { e.Value } : e.Name == ns + "r" ? e.Elements(ns + "t").Select(t => t.Value) : Enumerable.Empty<string>())));
        }

        private static string DecodeText(string text)
        {
            return Regex.Replace(text, "_x([0-9A-Fa-f]{4})_", m => ((char)int.Parse(m.Groups[1].Value, NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToString());
        }
    }
}
