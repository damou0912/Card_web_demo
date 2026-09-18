[CmdletBinding()]
param(
    [switch]$InstallHub,
    [switch]$InstallDevTools,
    [switch]$OpenEditorInstall,
    [switch]$OpenProject,
    [string]$UnityPath
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$versionFile = Get-Content -LiteralPath (Join-Path $projectRoot 'ProjectSettings/ProjectVersion.txt') -Raw
$editorVersion = [regex]::Match($versionFile, 'm_EditorVersion: ([^\r\n]+)').Groups[1].Value
$revision = [regex]::Match($versionFile, '\(([a-f0-9]+)\)').Groups[1].Value
Write-Host "Project: $projectRoot"
Write-Host "Required Unity: $editorVersion ($revision)"

function Install-WingetPackage([string]$packageId) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'winget is unavailable. Install App Installer from Microsoft Store, or install tools from their official websites in README.md.'
    }
    & winget install --id $packageId --exact --source winget --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) { throw "winget failed for $packageId (exit $LASTEXITCODE)." }
}

# Installation is opt-in; default invocation is strictly a read-only diagnosis.
if ($InstallHub) { Install-WingetPackage 'Unity.UnityHub' }
if ($InstallDevTools) {
    Install-WingetPackage 'Git.Git'
    Install-WingetPackage 'Microsoft.VisualStudioCode'
    Install-WingetPackage 'Microsoft.DotNet.SDK.8'
    Install-WingetPackage 'OpenJS.NodeJS.LTS'
}

$hubPath = Join-Path ${env:ProgramFiles} 'Unity Hub/Unity Hub.exe'
Write-Host ("Unity Hub: " + $(if (Test-Path -LiteralPath $hubPath) { $hubPath } else { 'not found in default location; custom installation may be valid' }))
if (-not $UnityPath) { $UnityPath = Join-Path ${env:ProgramFiles} "Unity/Hub/Editor/$editorVersion/Editor/Unity.exe" }
Write-Host ("Unity Editor: " + $(if (Test-Path -LiteralPath $UnityPath) { $UnityPath } else { 'not found; install the pinned editor using Unity Hub' }))
foreach ($commandName in @('git', 'dotnet', 'node')) {
    $found = Get-Command $commandName -ErrorAction SilentlyContinue
    Write-Host ("Optional tool $commandName : " + $(if ($found) { $found.Source } else { 'not on PATH (restart terminal after installation)' }))
}

if ($OpenEditorInstall) {
    # Explicit user-requested interactive installer; license acceptance stays in Unity Hub.
    Start-Process -FilePath "unityhub://$editorVersion/$revision"
}
if ($OpenProject) {
    if (-not (Test-Path -LiteralPath $UnityPath)) { throw 'Unity editor not found. Use -UnityPath for a custom installation.' }
    # Explicit user-requested visible editor window.
    Start-Process -FilePath $UnityPath -ArgumentList @('-projectPath', ('"' + $projectRoot + '"'))
}
Write-Host 'No Unity license is activated by this script. Sign in and activate an eligible license in Unity Hub.'
Write-Host 'Open Assets/Scenes/Main.unity, then press Play. See Card Demo > Configuration.'
