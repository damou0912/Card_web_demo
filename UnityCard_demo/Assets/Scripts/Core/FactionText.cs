namespace CardDemo.Core
{
    // Presentation only. Never rewrite CardDefinition.camp or use display text as a deck/rules key.
    public static class FactionText
    {
        public static string DisplayName(string camp)
        {
            if (string.IsNullOrWhiteSpace(camp)) return "未设置";
            string value = camp.Trim();
            switch (value)
            {
                case "三国~魏": return "魏";
                case "三国~蜀": return "蜀";
                case "三国~吴": return "吴";
                default: return value;
            }
        }
    }
}
