$ErrorActionPreference = 'Stop'
$project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../UnityCard_demo'))
$workbook = Join-Path $project 'ConfigTables/卡牌表现配置.xlsx'
$targets = @($workbook,
    (Join-Path $project 'ConfigTables/国度角标表.csv'),
    (Join-Path $project 'ConfigTables/卡牌效果表现表.csv'),
    (Join-Path $project 'Assets/Resources/Config/CardPresentation/country-badges.lua'),
    (Join-Path $project 'Assets/Resources/Config/CardPresentation/card-effects-presentation.lua'))
$before = @($targets | ForEach-Object { (Get-FileHash -LiteralPath $_).Hash })
$bad = Join-Path $PSScriptRoot 'invalid-faction.xlsx'
Copy-Item -LiteralPath $workbook -Destination $bad
$zip = [System.IO.Compression.ZipFile]::Open($bad, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    # Substitute only the first actual card faction with a non-existent faction.
    $entry = $zip.GetEntry('xl/worksheets/sheet1.xml')
    if ($null -eq $entry) { throw 'Expected workbook fixture.' }
    $reader = [System.IO.StreamReader]::new($entry.Open())
    [xml]$xml = $reader.ReadToEnd()
    $reader.Dispose()
    $faction = $xml.SelectNodes('//*[local-name()="v"]') | Where-Object { $_.InnerText -eq '三国~蜀' } | Select-Object -First 1
    if ($null -eq $faction) { throw 'Fixture faction missing.' }
    $faction.InnerText = '三国~错误势力'
    $entry.Delete()
    $writer = [System.IO.StreamWriter]::new($zip.CreateEntry('xl/worksheets/sheet1.xml').Open(), [System.Text.UTF8Encoding]::new($false))
    $writer.Write($xml.OuterXml)
    $writer.Dispose()
}
finally { $zip.Dispose() }
& dotnet run --project (Join-Path $project 'Tools/PresentationConfig/PresentationConfig.csproj') --configuration Release -- export $bad
if ($LASTEXITCODE -eq 0) { throw 'Invalid Excel export unexpectedly succeeded.' }
$after = @($targets | ForEach-Object { (Get-FileHash -LiteralPath $_).Hash })
if (@(Compare-Object $before $after).Count -ne 0) { throw 'Validation failure modified source/output files.' }
Write-Output 'PASS: invalid XLSX export returned an error and preserved all five source/output checksums.'

$zip = [System.IO.Compression.ZipFile]::OpenRead($workbook)
try {
    $stringsReader = [System.IO.StreamReader]::new($zip.GetEntry('xl/sharedStrings.xml').Open())
    [xml]$strings = $stringsReader.ReadToEnd()
    $stringsReader.Dispose()
    $tableCount = @($zip.Entries | Where-Object { $_.FullName -match '^xl/tables/table\d+\.xml$' }).Count
    if ($tableCount -ne 2) { throw 'Expected two filterable Excel tables.' }
    $ns = [System.Xml.XmlNamespaceManager]::new($strings.NameTable)
    $ns.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    foreach ($sheet in @('sheet1.xml', 'sheet2.xml')) {
        $reader = [System.IO.StreamReader]::new($zip.GetEntry("xl/worksheets/$sheet").Open())
        [xml]$xml = $reader.ReadToEnd()
        $reader.Dispose()
        $cells = @($xml.SelectNodes('//s:c[s:v or s:is]', $ns))
        if (@($cells | Where-Object { $_.GetAttribute('t') -notin @('s', 'str', 'inlineStr') }).Count -gt 0) { throw 'Non-text data found.' }
        if ($xml.SelectNodes('//s:f', $ns).Count -ne 0) { throw 'Unexpected formula.' }
        Write-Output "PASS: $sheet has $($cells.Count) saved text cells and no formulas."
    }
}
finally { $zip.Dispose() }
