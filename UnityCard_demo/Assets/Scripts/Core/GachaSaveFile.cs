using System;
using System.IO;
using System.Text;
using System.Linq;

namespace CardDemo.Core
{
    public static class GachaSaveFile
    {
        public static GachaProfile LoadProfile(string path, string legacyPath, string poolId, GachaDemo engine,
            Func<string, GachaProfile> readProfile, Func<string, GachaState> readState, Func<GachaProfile, string> serialize)
        {
            var profile = GachaProfiles.New(); GachaState legacy = null;
            if (File.Exists(path))
            {
                string json = File.ReadAllText(path); profile = readProfile(json);
                if (profile != null && profile.pools == null)
                {
                    legacy = readState(json); profile = GachaProfiles.New();
                    if (legacy == null || legacy.poolId != poolId) throw new ArgumentException("旧奖池存档不匹配。");
                }
                GachaProfiles.Validate(profile);
            }
            if (legacy == null && !profile.pools.Any(p => p.poolId == poolId)
                && !string.Equals(Path.GetFullPath(path), Path.GetFullPath(legacyPath), StringComparison.OrdinalIgnoreCase)
                && File.Exists(legacyPath)) legacy = readState(File.ReadAllText(legacyPath));
            bool converted;
            var next = GachaProfiles.Open(profile, engine, poolId, legacy, out converted);
            // A previously complete legacy pool is converted once before exposing the new wallet balance.
            if (converted) Write(path, serialize(next));
            return next;
        }
        public static bool IsPoolId(string poolId)
        {
            if (string.IsNullOrEmpty(poolId) || poolId.Length > 80) return false;
            foreach (char c in poolId)
                if (!(c >= 'a' && c <= 'z') && !(c >= '0' && c <= '9') && c != '-') return false;
            return true;
        }
        public static string PathForPool(string directory, string poolId, string legacyName)
        {
            if (!IsPoolId(poolId) || string.IsNullOrEmpty(legacyName) || Path.GetFileName(legacyName) != legacyName)
                throw new ArgumentException("奖池存档路径无效。");
            // Preserve the first demo's existing save; all subsequent periods get distinct files.
            return Path.Combine(directory, poolId == "shu-demo-v1" ? legacyName : "pool-" + poolId + ".json");
        }
        // Write fully before replacement. Leave the prior save intact if writing fails.
        public static void Write(string path, string json)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    byte[] data = new UTF8Encoding(false).GetBytes(json);
                    stream.Write(data, 0, data.Length); stream.Flush(true);
                }
                if (File.Exists(path)) File.Replace(temporary, path, null);
                else File.Move(temporary, path);
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
    }
}
