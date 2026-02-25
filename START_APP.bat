@echo off
echo ========================================
echo   Hotel MDU Application Launcher
echo ========================================
echo.
echo This demo requires the Mobile IP address where the gateway server is running.
echo.

REM Prompt for Mobile IP address
set /p MOBILE_IP="Enter Mobile IP address (e.g., 192.168.1.4): "

echo.
echo Updating configuration with Mobile IP: %MOBILE_IP%
echo.

REM Create/Update .env file
echo PORT=4002 > .env
echo REACT_APP_GATEWAY_URL=http://%MOBILE_IP%:8080 >> .env
echo DANGEROUSLY_DISABLE_HOST_CHECK=true >> .env

REM Replace hardcoded IP in compiled JavaScript
echo Updating compiled JavaScript with new Gateway IP...
powershell -Command "$files = Get-ChildItem 'static\js\main.*.js'; foreach($file in $files) { (Get-Content $file.FullName -Raw) -replace '10\.247\.130\.116', '%MOBILE_IP%' | Set-Content $file.FullName -NoNewline }"

echo Configuration updated successfully!
echo.

REM Kill any existing Node.js processes on port 4002
echo Checking for existing servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4002') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Any existing servers stopped.
echo.

echo Starting server...
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Start the server
echo Server starting on http://localhost:4002
echo Gateway URL: http://%MOBILE_IP%:8080
echo.
echo Opening browser in 3 seconds...
echo Press Ctrl+C to stop the server
echo.

start /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:4002"
set NODE_ENV=production
node server.js

pause
