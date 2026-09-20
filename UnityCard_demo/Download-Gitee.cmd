@echo off
setlocal
title UnityCard - Download from Gitee
echo Download Unity project from Gitee. Git for Windows is required.
echo Private repository: sign in using the Git credential window, not chat.
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo Git was not found. Install Git for Windows from https://git-scm.com/downloads/win
  pause
  exit /b 1
)
set "CARD_DEMO_DEST=%~dp0UnityCard_project"
if exist "%CARD_DEMO_DEST%" (
  echo Destination already exists: "%CARD_DEMO_DEST%"
  echo Nothing was overwritten. Open that folder and use Update-Gitee.cmd.
  pause
  exit /b 1
)
echo Destination: "%CARD_DEMO_DEST%"
git clone --origin gitee --branch main --single-branch https://gitee.com/damou_0912_0/unity-card-demo.git "%CARD_DEMO_DEST%"
if errorlevel 1 (
  echo Download failed. Check Gitee sign-in and whether main has been published.
  echo No existing project was overwritten.
  pause
  exit /b 1
)
echo.
echo Download complete. Add the UnityCard_project folder to Unity Hub.
echo Next time: close Unity, then double-click Update-Gitee.cmd inside that folder.
pause
exit /b 0
