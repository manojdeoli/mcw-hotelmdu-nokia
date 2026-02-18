@echo off
echo ========================================
echo   Gateway Connection Diagnostics
echo ========================================
echo.

set /p gateway_ip="Enter Gateway IP (e.g., 10.247.130.116): "

echo.
echo Testing connection to %gateway_ip%:8080...
echo.

echo 1. Testing HTTP endpoint...
curl -v http://%gateway_ip%:8080/health 2>&1
echo.

echo 2. Testing ping...
ping -n 2 %gateway_ip%
echo.

echo 3. Testing port 8080...
powershell -Command "Test-NetConnection -ComputerName %gateway_ip% -Port 8080"
echo.

echo ========================================
echo   Diagnostics Complete
echo ========================================
echo.
echo If all tests failed:
echo   1. Check if Gateway app is running on tablet
echo   2. Check if tablet and laptop are on same WiFi
echo   3. Check tablet's IP address in the app
echo   4. Try disabling Windows Firewall temporarily
echo.
pause
