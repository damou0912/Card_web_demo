[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$UnityPath,
    [ValidateSet('Validate', 'Test', 'Windows', 'WebGL')][string]$Task = 'Validate'
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not (Test-Path -LiteralPath $UnityPath -PathType Leaf)) { throw 'Unity executable not found.' }
$artifactRoot = Join-Path $projectRoot 'Artifacts'
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
$logPath = Join-Path $artifactRoot "$Task.log"
$resultPath = Join-Path $artifactRoot ("EditMode-" + [Guid]::NewGuid().ToString('N') + '.xml')
$arguments = @('-batchmode', '-nographics', '-projectPath', ('"' + $projectRoot + '"'), '-logFile', ('"' + $logPath + '"'))
switch ($Task) {
    'Validate' { $arguments += @('-quit', '-executeMethod', 'CardDemo.Editor.ProjectTools.ValidateProject') }
    'Windows' { $arguments += @('-quit', '-buildTarget', 'Win64', '-executeMethod', 'CardDemo.Editor.ProjectTools.BuildWindows') }
    'WebGL' { $arguments += @('-quit', '-buildTarget', 'WebGL', '-executeMethod', 'CardDemo.Editor.ProjectTools.BuildWebGL') }
    'Test' { $arguments += @('-runTests', '-testPlatform', 'EditMode', '-testResults', ('"' + $resultPath + '"')) }
}
$process = Start-Process -FilePath $UnityPath -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "Unity task failed (exit $($process.ExitCode)). See $logPath" }
if ($Task -eq 'Test') {
    if (-not (Test-Path -LiteralPath $resultPath)) { throw "Unity produced no test results. See $logPath" }
    [xml]$results = Get-Content -LiteralPath $resultPath -Raw
    if ([int]$results.'test-run'.total -lt 1 -or $results.'test-run'.result -ne 'Passed') { throw "Tests did not pass. See $resultPath" }
}
Write-Host "Completed $Task. Log: $logPath"
