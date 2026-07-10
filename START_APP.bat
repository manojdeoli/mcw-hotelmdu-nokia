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

REM Create/Update .env file — overwrite completely each run to prevent
REM duplicate REACT_APP_GATEWAY_URL entries from repeated runs.
REM Using >> (append) would stack lines causing ws://ip:8080:8080:8080 corruption.
REM REACT_APP_BEACON_CONFIG_URL is written by CONFIGURE_BEACONS.bat — preserved here if exists.
for /f "tokens=2 delims==" %%a in ('findstr /i "REACT_APP_BEACON_CONFIG_URL" .env 2^>nul') do set EXISTING_BEACON_URL=%%a

(
echo PORT=4002
echo REACT_APP_GATEWAY_URL=http://%MOBILE_IP%:8080
if defined EXISTING_BEACON_URL echo REACT_APP_BEACON_CONFIG_URL=%EXISTING_BEACON_URL%
echo DANGEROUSLY_DISABLE_HOST_CHECK=true
echo GOOGLE_DIRECTIONS_API_KEY=AIzaSyDg0fNA0VL1kLmdIKBLd-nusu4j6bjZ7sk
) > .env

REM Replace any IP address pattern in compiled JavaScript with new Gateway IP
echo Updating compiled JavaScript with new Gateway IP...
powershell -Command "$files = Get-ChildItem 'static\js\main.*.js'; foreach($file in $files) { (Get-Content $file.FullName -Raw) -replace '\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:8080', '%MOBILE_IP%:8080' | Set-Content $file.FullName -NoNewline }"

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
