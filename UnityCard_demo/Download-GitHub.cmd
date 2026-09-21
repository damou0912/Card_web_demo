@echo off
setlocal
title UnityCard - Download from GitHub
echo Download the GitHub repository. Git for Windows is required.
echo Private repository: sign in using the Git credential window, not chat.
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo Git was not found. Install Git for Windows from https://git-scm.com/downloads/win
  pause
  exit /b 1
)
git -C "%~dp0." rev-parse --show-toplevel >nul 2>nul
if not errorlevel 1 (
  echo This file is inside an existing Git checkout.
  echo For a new download, copy this single file to a separate destination folder.
  echo To update an existing GitHub checkout, use UnityCard_demo\Update-GitHub.cmd.
  pause
  exit /b 1
)
set "CARD_DEMO_DEST=%~dp0Card_web_demo"
if exist "%CARD_DEMO_DEST%" (
  echo Destination already exists: "%CARD_DEMO_DEST%"
  echo Nothing was overwritten. Open that folder and use UnityCard_demo\Update-GitHub.cmd.
  pause
  exit /b 1
)
echo Destination: "%CARD_DEMO_DEST%"
git clone --origin origin --branch main --single-branch https://github.com/damou0912/Card_web_demo.git "%CARD_DEMO_DEST%"
if errorlevel 1 (
  echo Download failed. Check GitHub connectivity and Git sign-in if required.
  echo No existing project was overwritten.
  pause
  exit /b 1
)
echo.
echo Download complete. Add Card_web_demo\UnityCard_demo to Unity Hub.
echo Next time: close Unity, then double-click UnityCard_demo\Update-GitHub.cmd.
pause
exit /b 0
