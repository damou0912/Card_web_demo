using System;
using System.IO;
using System.Text;

namespace CardDemo.Core
{
    public static class GachaSaveFile
    {
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
