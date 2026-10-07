@echo off
setlocal
cd /d "%~dp0"
set "CARD_DESIGNER_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "CARD_DESIGNER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Please install Node.js 18 or newer from https://nodejs.org/
    pause
    exit /b 1
  )
)
echo Card Appearance Studio: http://127.0.0.1:5192/
echo Open this address in your browser. Close this window to stop the server.
"%CARD_DESIGNER_NODE%" card-designer/server.cjs
pause
