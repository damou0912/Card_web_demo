@echo off
setlocal
cd /d "%~dp0"
set "WORKSHOP_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "WORKSHOP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Please install Node.js 18 or newer from https://nodejs.org/
    pause
    exit /b 1
  )
)
echo Card Workshop: http://127.0.0.1:5190/
echo Open this address in your browser. Close this window to stop the local server.
"%WORKSHOP_NODE%" card-workshop/server.cjs
pause
