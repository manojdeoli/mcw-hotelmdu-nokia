@echo off
echo ========================================
echo   Hotel MDU Demo Application
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
echo PORT=4001 > .env
echo REACT_APP_GATEWAY_URL=http://%MOBILE_IP%:8080 >> .env
echo DANGEROUSLY_DISABLE_HOST_CHECK=true >> .env

echo Configuration updated successfully!
echo Gateway URL: http://%MOBILE_IP%:8080
echo.

echo Starting React app...
npm start
