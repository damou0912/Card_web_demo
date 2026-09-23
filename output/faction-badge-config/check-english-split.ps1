$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../UnityCard_demo'))
$before = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $PSScriptRoot 'catalog-before-consolidation.json') | ConvertFrom-Json
$after = Get-Content -Encoding UTF8 -Raw -LiteralPath (Join-Path $project 'Assets/Resources/Data/web-card-catalog.json') | ConvertFrom-Json
if (($before | ConvertTo-Json -Depth 20 -Compress) -cne ($after | ConvertTo-Json -Depth 20 -Compress)) { throw 'Card data changed.' }
$files = @('ConfigTables/Card Basics.xlsx','ConfigTables/Faction Icons.xlsx','Assets/Resources/Config/CardPresentation/cards.lua','Assets/Resources/Config/CardPresentation/country-badges.lua','Assets/Resources/Data/web-card-catalog.json') | ForEach-Object { Join-Path $project $_ }
$hashes = @($files | ForEach-Object { (Get-FileHash -LiteralPath $_).Hash })
$temporary = Join-Path $PSScriptRoot 'english-split-tests'
New-Item -ItemType Directory -Path $temporary -Force | Out-Null
foreach ($name in @('Card Basics', 'Faction Icons')) {
    $copy = Join-Path $temporary ($name.Replace(' ', '-') + '-custom-name.xlsx')
    Copy-Item -LiteralPath (Join-Path $project "ConfigTables/$name.xlsx") -Destination $copy
    & dotnet run --project (Join-Path $project 'Tools/PresentationConfig') --configuration Release -- check $copy
    if ($LASTEXITCODE -ne 0) { throw 'Override filename must not determine workbook type.' }
    $zip = [IO.Compression.ZipFile]::Open($copy, [IO.Compression.ZipArchiveMode]::Update)
    try {
        $entryName = if ($name -eq 'Card Basics') { 'xl/worksheets/sheet1.xml' } else { 'xl/worksheets/sheet2.xml' }
        $entry = $zip.GetEntry($entryName)
        $reader = [IO.StreamReader]::new($entry.Open())
        try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($name -eq 'Card Basics') {
            $xml.SelectSingleNode('//*[local-name()="c" and @r="E2"]/*[local-name()="v"]').InnerText = '-1'
        } else {
            $cell = $xml.SelectSingleNode('//*[local-name()="c" and @r="C2"]')
            foreach ($child in @($cell.ChildNodes)) { $cell.RemoveChild($child) | Out-Null }
            $cell.SetAttribute('t', 'inlineStr')
            $inline = $xml.CreateElement('is', $cell.NamespaceURI)
            $text = $xml.CreateElement('t', $cell.NamespaceURI); $text.InnerText = '../outside'
            $inline.AppendChild($text) | Out-Null; $cell.AppendChild($inline) | Out-Null
        }
        $entry.Delete()
        $writer = [IO.StreamWriter]::new($zip.CreateEntry($entryName).Open(), [Text.UTF8Encoding]::new($false))
        try { $writer.Write($xml.OuterXml) } finally { $writer.Dispose() }
    } finally { $zip.Dispose() }
    $messages = & dotnet run --project (Join-Path $project 'Tools/PresentationConfig') --configuration Release -- export $copy 2>&1
    if ($LASTEXITCODE -eq 0) { throw 'Invalid workbook accepted.' }
    $expected = if ($name -eq 'Card Basics') { 'Card Basics!E2' } else { '图片路径必须' }
    if (($messages | Out-String) -notmatch [regex]::Escape($expected)) { throw 'Unexpected validation error.' }
    if (@(Compare-Object $hashes @($files | ForEach-Object { (Get-FileHash -LiteralPath $_).Hash })).Count -ne 0) { throw 'Failed export changed source or output.' }
    Write-Output "PASS negative input: $name; outputs untouched."
}
Write-Output 'PASS: all 90 cards/defaults/metadata unchanged; both workbook roles and custom filenames verified.'
exit 0
