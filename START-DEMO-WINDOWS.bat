@echo off
setlocal
cd /d "%~dp0"
where tsc >nul 2>nul || (
  echo ERROR: TypeScript tsc is not installed on PATH.
  exit /b 1
)
call npm run check || exit /b 1
echo.
echo Desktop demo:    http://localhost:5173/?demo=1
echo Field Mobile:    http://localhost:5173/mobile.html?demo=field
echo Owner Mobile:    http://localhost:5173/mobile.html?demo=owner
echo Press Ctrl+C to stop the server.
python -m http.server 5173 -d dist
