@echo off
echo ========================================
echo   Gateway IP Address Configurator
echo ========================================
echo.

:: Read current IP from .env file
set current_ip=10.247.130.116
for /f "tokens=2 delims=/" %%a in ('findstr "REACT_APP_GATEWAY_URL" .env 2^>nul') do (
    for /f "tokens=1 delims=:" %%b in ("%%a") do set current_ip=%%b
)

echo Current Gateway IP: %current_ip%
echo.
echo Enter the new Gateway IP address from your Android device:
echo (Check the Gateway app on your tablet/phone for the correct IP)
echo.
set /p new_ip="New Gateway IP: "

if "%new_ip%"=="" (
    echo No IP entered. Exiting...
    pause
    exit
)

echo.
echo Updating .env file...

:: Create temporary file with updated content
(
echo PORT=4001
echo REACT_APP_GATEWAY_URL=http://%new_ip%:8080
echo DANGEROUSLY_DISABLE_HOST_CHECK=true
) > .env.temp

:: Replace original .env file
move .env.temp .env

echo.
echo ✓ Gateway IP updated successfully!
echo.
echo New configuration:
echo ----------------------------------------
type .env
echo ----------------------------------------
echo.
echo IMPORTANT: Restart the React app for changes to take effect:
echo   1. Stop the app (Ctrl+C in terminal)
echo   2. Run: npm start
echo.
echo Testing connection to new Gateway...
echo.
curl -v http://%new_ip%:8080/health 2>nul || echo Warning: Could not connect to Gateway. Make sure it's running on the Android device.
echo.
pause