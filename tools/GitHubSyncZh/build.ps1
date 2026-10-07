param(
    [string]$GitRoot = '',
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'dist'),
    [switch]$SkipBundle
)
$ErrorActionPreference = 'Stop'
$buildDirectory = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Force -Path $buildDirectory, $OutputDirectory | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x C# compiler not found.' }
$zipPath = Join-Path $buildDirectory 'portable-git.zip'
if (-not $SkipBundle) {
    if (-not $GitRoot) {
        $desktopRoot = Join-Path $env:LOCALAPPDATA 'GitHubDesktop'
        $installed = Get-ChildItem -LiteralPath $desktopRoot -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending
        foreach ($app in $installed) {
            $candidate = Join-Path $app.FullName 'resources\app\git'
            if (Test-Path -LiteralPath (Join-Path $candidate 'cmd\git.exe')) { $GitRoot = $candidate; break }
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $GitRoot 'mingw64\bin\git-credential-manager.exe'))) { throw 'Provide a portable Git folder that includes Git Credential Manager.' }
    if (-not (Test-Path -LiteralPath $zipPath)) {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($GitRoot, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    }
}
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 64,64
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(45,103,216))
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White),6
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawArc($pen,14,14,36,36,205,135)
$graphics.DrawArc($pen,14,14,36,36,25,135)
$graphics.DrawLine($pen,49,22,49,12)
$graphics.DrawLine($pen,49,22,39,22)
$graphics.DrawLine($pen,15,42,15,52)
$graphics.DrawLine($pen,15,42,25,42)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $buildDirectory 'app.ico'
$iconStream = [System.IO.File]::Create($iconPath)
$icon.Save($iconStream)
$iconStream.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $pen.Dispose()
$exe = Join-Path $OutputDirectory 'GitHub中文同步助手.exe'
$arguments = @('/nologo','/target:winexe','/platform:x64','/optimize+','/utf8output',('/out:' + $exe),('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')),('/win32icon:' + $iconPath),'/r:System.dll','/r:System.Core.dll','/r:System.Drawing.dll','/r:System.Windows.Forms.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll')
if (-not $SkipBundle) { $arguments += '/resource:' + $zipPath + ',portable-git.zip' }
$arguments += (Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.cs' | ForEach-Object FullName)
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
Get-Item -LiteralPath $exe | Select-Object FullName,Length
