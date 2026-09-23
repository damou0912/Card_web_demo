@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where dotnet >nul 2>nul
if errorlevel 1 (
  echo 请先安装 .NET 8 SDK：https://dotnet.microsoft.com/download/dotnet/8.0
  echo 或使用 Unity 菜单：Card Demo / Tools / Presentation / Export Tables to Lua。
  pause
  exit /b 1
)
echo 请先保存 Excel。正在将配置工作簿导出为 Lua...
if "%~1"=="" (
  dotnet run --project Tools\PresentationConfig\PresentationConfig.csproj --configuration Release -- export
) else (
  dotnet run --project Tools\PresentationConfig\PresentationConfig.csproj --configuration Release -- export "%~f1"
)
set "presentationExitCode=%ERRORLEVEL%"
if not "%presentationExitCode%"=="0" echo 导出失败，请查看上方错误。数据校验未通过时不会改写原有导出文件。
pause
exit /b %presentationExitCode%
