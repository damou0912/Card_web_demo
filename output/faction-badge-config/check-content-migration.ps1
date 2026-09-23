$ErrorActionPreference = 'Stop'
$project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../UnityCard_demo'))
$tables = Join-Path $project 'ConfigTables'
$before = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'catalog-before-consolidation.json') | ConvertFrom-Json
$after = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $project 'Assets/Resources/Data/web-card-catalog.json') | ConvertFrom-Json
if (($before | ConvertTo-Json -Depth 20 -Compress) -cne ($after | ConvertTo-Json -Depth 20 -Compress)) { throw 'Migration changed original data.' }
Write-Output 'PASS: all 90 cards, text, numeric attributes, metadata and default-deck order are identical.'
$files = @((Get-ChildItem -LiteralPath $tables -File | Where-Object {$_.Extension -in '.xlsx','.csv','.json'}).FullName)
$files += @((Get-ChildItem -LiteralPath (Join-Path $project 'Assets/Resources/Config/CardPresentation') -Filter '*.lua' -File).FullName)
$files += Join-Path $project 'Assets/Resources/Data/web-card-catalog.json'
$hashes = @($files | ForEach-Object {(Get-FileHash -LiteralPath $_).Hash})
$temporary = Join-Path $PSScriptRoot 'consolidation-negative-test'
New-Item -ItemType Directory -Path $temporary -Force | Out-Null
$bad = Join-Path $temporary 'invalid-cards.xlsx'
Copy-Item -LiteralPath (Join-Path $tables '卡牌配置.xlsx') -Destination $bad
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($bad, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    $entry = $zip.GetEntry('xl/worksheets/sheet1.xml')
    $reader = [System.IO.StreamReader]::new($entry.Open())
    [xml]$xml = $reader.ReadToEnd()
    $reader.Dispose()
    $cell = $xml.SelectSingleNode('//*[local-name()="c" and @r="E2"]/*[local-name()="v"]')
    if ($null -eq $cell) { throw 'Numeric fixture missing.' }
    $cell.InnerText = '-1'
    $entry.Delete()
    $writer = [System.IO.StreamWriter]::new($zip.CreateEntry('xl/worksheets/sheet1.xml').Open(), [System.Text.UTF8Encoding]::new($false))
    $writer.Write($xml.OuterXml)
    $writer.Dispose()
} finally { $zip.Dispose() }
$messages = & dotnet run --project (Join-Path $project 'Tools/PresentationConfig/PresentationConfig.csproj') --configuration Release -- export $bad 2>&1
if ($LASTEXITCODE -eq 0) { throw 'Negative attack was accepted.' }
if (($messages | Out-String) -notmatch '卡牌!E2') { throw 'Failure did not identify the invalid cell.' }
$messages | ForEach-Object { Write-Output "$_" }
if (@(Compare-Object $hashes @($files | ForEach-Object {(Get-FileHash -LiteralPath $_).Hash})).Count -ne 0) { throw 'Failed export changed project sources/outputs.' }
Write-Output 'PASS: invalid numeric workbook reports cell E2, and all source/generated checksums remain unchanged.'
exit 0
