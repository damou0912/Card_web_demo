param(
    [string]$ReleaseDirectory = 'D:\Card_web_demo-main\发布',
    [string]$NsisCompiler = (Join-Path $PSScriptRoot 'build\installer-tools\nsis-3.13\makensis.exe')
)
$ErrorActionPreference = 'Stop'
$ReleaseDirectory = (Resolve-Path -LiteralPath $ReleaseDirectory).Path
if (-not (Test-Path -LiteralPath $NsisCompiler)) { throw 'Provide the NSIS 3.13 compiler using -NsisCompiler.' }
foreach ($requiredFile in @('GitHub中文同步助手.exe', '使用说明.md', 'Git-LICENSE.txt')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ReleaseDirectory $requiredFile))) { throw ('Missing release file: ' + $requiredFile) }
}
$setupOutput = Join-Path $ReleaseDirectory 'GitHub中文同步助手-安装包.exe'
Push-Location -LiteralPath $PSScriptRoot
try {
    & $NsisCompiler /V3 /WX /INPUTCHARSET UTF8 /OUTPUTCHARSET UTF8 ('/DRELEASE_DIR=' + $ReleaseDirectory) ('/DSETUP_OUTPUT=' + $setupOutput) (Join-Path $PSScriptRoot 'installer.nsi')
    if ($LASTEXITCODE -ne 0) { throw 'NSIS installer build failed.' }
} finally { Pop-Location }
Get-Item -LiteralPath $setupOutput | Select-Object FullName,Length
Get-FileHash -LiteralPath $setupOutput -Algorithm SHA256
