$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../UnityCard_demo'))
$folder = Join-Path $project 'ConfigTables'
$source = Join-Path $folder '卡牌配置.xlsx'
$output = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../outputs/card-tables-english-20260923'))
$backup = Join-Path $project 'Artifacts/ConfigTableBackups/before-english-split-20260923.xlsx'
foreach ($name in @('Card Basics', 'Faction Icons')) {
    if (Test-Path -LiteralPath (Join-Path $folder "$name.xlsx")) { throw "Refusing to overwrite existing $name.xlsx" }
}
if (!(Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $source -Destination $backup }
if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $backup).Hash) { throw 'Backup mismatch.' }
New-Item -ItemType Directory -Path $output -Force | Out-Null
$zip = [IO.Compression.ZipFile]::OpenRead($source)
try {
    # Mechanical OOXML split: keep each retained worksheet and its styles/validation bytes unchanged.
    $parts = @{}
    foreach ($entry in $zip.Entries) {
        $stream = $entry.Open()
        $memory = [IO.MemoryStream]::new()
        try { $stream.CopyTo($memory); $parts[$entry.FullName] = $memory.ToArray() }
        finally { $stream.Dispose(); $memory.Dispose() }
    }
    [xml]$original = [Text.Encoding]::UTF8.GetString($parts['xl/workbook.xml']).TrimStart([char]0xFEFF)
    $sheets = @($original.SelectNodes('//*[local-name()="sheet"]'))
    if ($sheets.Count -ne 2 -or $sheets[0].name -ne '卡牌' -or $sheets[1].name -ne '势力角标') { throw 'Unexpected source sheets.' }
    if ($original.SelectNodes('//*[local-name()="definedName"]').Count -ne 0) { throw 'Named ranges need separate migration.' }
    for ($index = 0; $index -lt 2; $index++) {
        $name = @('Card Basics', 'Faction Icons')[$index]
        $remove = 2 - $index
        $removeParts = @("xl/worksheets/sheet$remove.xml", "xl/worksheets/_rels/sheet$remove.xml.rels", "xl/tables/table$remove.xml")
        [xml]$workbook = [Text.Encoding]::UTF8.GetString($parts['xl/workbook.xml']).TrimStart([char]0xFEFF)
        $sheetNodes = @($workbook.SelectNodes('//*[local-name()="sheet"]'))
        $sheetNodes[$index].SetAttribute('name', $name)
        $other = $sheetNodes[1 - $index]
        $removedId = $other.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $other.ParentNode.RemoveChild($other) | Out-Null
        [xml]$links = [Text.Encoding]::UTF8.GetString($parts['xl/_rels/workbook.xml.rels']).TrimStart([char]0xFEFF)
        foreach ($link in @($links.DocumentElement.ChildNodes)) {
            if ($link.Id -eq $removedId) { $link.ParentNode.RemoveChild($link) | Out-Null }
        }
        [xml]$types = [Text.Encoding]::UTF8.GetString($parts['[Content_Types].xml']).TrimStart([char]0xFEFF)
        foreach ($node in @($types.DocumentElement.ChildNodes)) {
            if ($removeParts -contains $node.GetAttribute('PartName').TrimStart('/')) { $node.ParentNode.RemoveChild($node) | Out-Null }
        }
        $edits = @{
            'xl/workbook.xml' = [Text.Encoding]::UTF8.GetBytes($workbook.OuterXml)
            'xl/_rels/workbook.xml.rels' = [Text.Encoding]::UTF8.GetBytes($links.OuterXml)
            '[Content_Types].xml' = [Text.Encoding]::UTF8.GetBytes($types.OuterXml)
        }
        $artifact = Join-Path $output "$name.xlsx"
        $file = [IO.File]::Open($artifact, [IO.FileMode]::CreateNew)
        $result = [IO.Compression.ZipArchive]::new($file, [IO.Compression.ZipArchiveMode]::Create, $false)
        try {
            foreach ($part in $parts.Keys) {
                if ($removeParts -contains $part) { continue }
                $bytes = if ($edits.ContainsKey($part)) { $edits[$part] } else { $parts[$part] }
                $stream = $result.CreateEntry($part).Open()
                try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
            }
        } finally { $result.Dispose(); $file.Dispose() }
        $check = [IO.Compression.ZipFile]::OpenRead($artifact)
        try {
            foreach ($entry in $check.Entries) {
                if ($edits.ContainsKey($entry.FullName)) { continue }
                $memory = [IO.MemoryStream]::new(); $stream = $entry.Open()
                try {
                    $stream.CopyTo($memory)
                    if ([Convert]::ToBase64String($memory.ToArray()) -cne [Convert]::ToBase64String($parts[$entry.FullName])) { throw "Changed original part: $($entry.FullName)" }
                } finally { $memory.Dispose(); $stream.Dispose() }
            }
        } finally { $check.Dispose() }
        Copy-Item -LiteralPath $artifact -Destination (Join-Path $folder "$name.xlsx")
        Write-Output "PASS split: $name.xlsx (original worksheet, table, formats and validation preserved)"
    }
} finally { $zip.Dispose() }
