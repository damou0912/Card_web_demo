@echo off
setlocal
title UnityCard - Safe update from GitHub
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tools\Sync-GitHub.ps1" -Mode Update
set "CARD_DEMO_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CARD_DEMO_EXIT%
