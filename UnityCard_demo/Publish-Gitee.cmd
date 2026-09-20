@echo off
setlocal
title UnityCard - Publish committed Unity changes
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Tools\Sync-Gitee.ps1" -Mode Publish
set "CARD_DEMO_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CARD_DEMO_EXIT%
