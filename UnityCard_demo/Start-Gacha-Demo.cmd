@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where dotnet >nul 2>nul
if errorlevel 1 (
  echo 请先安装 .NET 8 SDK，再启动抽卡 Demo。
  pause
  exit /b 1
)
echo 抽卡 Demo：免费测试额度，不产生真实扣款。
echo 启动后在浏览器打开 http://127.0.0.1:5186/
echo 保持此窗口开启。退出请按 Ctrl+C。
dotnet run --project Tools\GachaDemo\GachaDemo.csproj --configuration Release -- serve
if errorlevel 1 pause
