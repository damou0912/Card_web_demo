@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 18 or newer from https://nodejs.org/
  pause
  exit /b 1
)
echo Card Workshop: http://127.0.0.1:5190/
echo Open this address in your browser. Close this window to stop the local server.
node card-workshop/server.cjs
pause
