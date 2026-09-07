@echo off
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
  start "TuinBooks local server" /D "%~dp0" cmd /k py -m http.server 8765
  timeout /t 2 /nobreak >nul
  start "" http://localhost:8765/desktop.html
  exit /b
)
where python >nul 2>&1
if %errorlevel%==0 (
  start "TuinBooks local server" /D "%~dp0" cmd /k python -m http.server 8765
  timeout /t 2 /nobreak >nul
  start "" http://localhost:8765/desktop.html
  exit /b
)
echo Python was not found. Open desktop.html directly while online, or install Python and run this file again.
pause
