@echo off
echo Starting Hotel MDU Application...
echo.
echo Starting Backend Server on port 4002...
start cmd /k "node server.js"
timeout /t 3 /nobreak >nul
echo.
echo Starting React Frontend...
npm start
pause
