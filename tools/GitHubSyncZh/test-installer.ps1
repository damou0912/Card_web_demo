param([string]$Setup = 'D:\Card_web_demo-main\发布\GitHub中文同步助手-安装包.exe')
$ErrorActionPreference = 'Stop'
$testBase = Join-Path $PSScriptRoot 'test-output\installer'
$installRoot = [System.IO.Path]::GetFullPath((Join-Path $testBase ('安装测试 ' + [guid]::NewGuid().ToString('N'))))
$allowedRoot = [System.IO.Path]::GetFullPath($testBase).TrimEnd('\') + '\'
if (-not $installRoot.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Test install path outside workspace.' }
New-Item -ItemType Directory -Path $testBase -Force | Out-Null
$checks = [System.Collections.Generic.List[string]]::new()
function Assert-Installer([bool]$condition, [string]$description) {
    if (-not $condition) { throw ('FAIL: ' + $description) }
    $checks.Add('PASS: ' + $description)
}
$argsText = '/S /TEST /D=' + $installRoot
$installed = Start-Process -FilePath $Setup -ArgumentList $argsText -WindowStyle Hidden -Wait -PassThru
Assert-Installer ($installed.ExitCode -eq 0) '中文和空格路径安装成功'
$installedApp = Join-Path $installRoot 'GitHub中文同步助手.exe'
$originalApp = Join-Path (Split-Path -Parent $Setup) 'GitHub中文同步助手.exe'
Assert-Installer ((Get-FileHash -LiteralPath $installedApp).Hash -eq (Get-FileHash -LiteralPath $originalApp).Hash) '安装后的程序与发布版本完全一致'
Assert-Installer (Test-Path -LiteralPath (Join-Path $installRoot '使用说明.md')) '中文使用说明已安装'
Assert-Installer (Test-Path -LiteralPath (Join-Path $installRoot 'Git-LICENSE.txt')) '组件许可文件已安装'
$wsh = New-Object -ComObject WScript.Shell
foreach ($linkName in @('test-shortcuts\桌面快捷方式.lnk', 'test-shortcuts\StartMenu\GitHub 中文同步助手.lnk')) {
    $linkFile = Join-Path $installRoot $linkName
    Assert-Installer (Test-Path -LiteralPath $linkFile) ('已创建快捷方式：' + $linkName)
    $link = $wsh.CreateShortcut($linkFile)
    Assert-Installer ($link.TargetPath -eq $installedApp) ('快捷方式指向正确程序：' + $linkName)
}
$sentinel = Join-Path $installRoot '我的项目\请保留.txt'
New-Item -ItemType Directory -Path (Split-Path -Parent $sentinel) -Force | Out-Null
Set-Content -LiteralPath $sentinel -Value 'installer-preservation-fixture' -Encoding utf8
$updated = Start-Process -FilePath $Setup -ArgumentList $argsText -WindowStyle Hidden -Wait -PassThru
Assert-Installer ($updated.ExitCode -eq 0) '可以覆盖更新原安装目录'
Assert-Installer (Test-Path -LiteralPath $sentinel) '更新保留用户项目文件'
$uninstaller = Join-Path $installRoot '卸载.exe'
Assert-Installer (Test-Path -LiteralPath $uninstaller) '已生成独立卸载程序'
$uninstalled = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
$deadline = [DateTime]::UtcNow.AddSeconds(20)
while ((Test-Path -LiteralPath $uninstaller) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
Assert-Installer (-not (Test-Path -LiteralPath $installedApp)) '卸载移除程序文件'
Assert-Installer (-not (Test-Path -LiteralPath (Join-Path $installRoot 'test-shortcuts\桌面快捷方式.lnk'))) '卸载移除桌面快捷方式'
Assert-Installer (-not (Test-Path -LiteralPath (Join-Path $installRoot 'test-shortcuts\StartMenu'))) '卸载移除开始菜单快捷方式'
Assert-Installer ((Get-Content -LiteralPath $sentinel -Raw).Trim() -eq 'installer-preservation-fixture') '卸载完整保留用户项目文件'
$checks.Add('说明：通过安装包的 /TEST 模式把快捷方式放在测试目录，未写入真实桌面、开始菜单和卸载注册表。')
$checks | Set-Content -LiteralPath (Join-Path $testBase '安装包测试报告.txt') -Encoding utf8
$checks
