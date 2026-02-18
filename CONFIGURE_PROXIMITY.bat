@echo off
echo ========================================
echo   BLE Proximity Detection Configurator
echo ========================================
echo.

:menu
echo Current Settings:
echo.
echo 1. Default (MWC Booth)     - Entry: -55, Very Close (~1m)
echo 2. Relaxed (Larger Area)  - Entry: -65, Close (~2m)
echo 3. Very Relaxed (Testing) - Entry: -70, Medium (~3m)
echo 4. Custom Settings
echo 5. View Current Config
echo 6. Reset to Default
echo 7. Exit
echo.

set /p choice="Select option (1-7): "

if "%choice%"=="1" goto default
if "%choice%"=="2" goto aggressive
if "%choice%"=="3" goto conservative
if "%choice%"=="4" goto custom
if "%choice%"=="5" goto view
if "%choice%"=="6" goto reset
if "%choice%"=="7" goto end
goto menu

:default
echo.
echo Setting DEFAULT configuration (MWC Booth)...
(
echo REACT_APP_BLE_BUFFER_SIZE=15
echo REACT_APP_BLE_ENTRY_STABILITY_MS=2000
echo REACT_APP_BLE_EXIT_STABILITY_MS=5000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-55
echo REACT_APP_BLE_EXIT_THRESHOLD=-60
) > .env.proximity
echo.
echo ✓ Default settings applied (MWC Booth)
echo   - Buffer Size: 15 readings
echo   - Entry Stability: 2000ms
echo   - Exit Stability: 5000ms
echo   - Entry Threshold: -55 dBm (~1 meter, VERY CLOSE)
echo   - Exit Threshold: -60 dBm
echo   - Use Case: Small booth, avoid detecting all beacons
echo.
goto restart

:aggressive
echo.
echo Setting RELAXED configuration (Larger Area)...
(
echo REACT_APP_BLE_BUFFER_SIZE=15
echo REACT_APP_BLE_ENTRY_STABILITY_MS=2000
echo REACT_APP_BLE_EXIT_STABILITY_MS=5000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-65
echo REACT_APP_BLE_EXIT_THRESHOLD=-70
) > .env.proximity
echo.
echo ✓ Relaxed settings applied
echo   - Buffer Size: 15 readings
echo   - Entry Stability: 2000ms
echo   - Exit Stability: 5000ms
echo   - Entry Threshold: -65 dBm (~2 meters, CLOSE)
echo   - Exit Threshold: -70 dBm
echo   - Use Case: Larger booth or testing
echo.
goto restart

:conservative
echo.
echo Setting VERY RELAXED configuration (Testing)...
(
echo REACT_APP_BLE_BUFFER_SIZE=15
echo REACT_APP_BLE_ENTRY_STABILITY_MS=2000
echo REACT_APP_BLE_EXIT_STABILITY_MS=5000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-70
echo REACT_APP_BLE_EXIT_THRESHOLD=-75
) > .env.proximity
echo.
echo ✓ Very Relaxed settings applied
echo   - Buffer Size: 15 readings
echo   - Entry Stability: 2000ms
echo   - Exit Stability: 5000ms
echo   - Entry Threshold: -70 dBm (~3 meters, MEDIUM)
echo   - Exit Threshold: -75 dBm
echo   - Use Case: Testing or large open area
echo.
goto restart

:custom
echo.
echo === Custom Configuration ===
echo.
set /p buffer="Buffer Size (10-20, default 15): "
set /p entryStab="Entry Stability (ms, default 2000): "
set /p exitStab="Exit Stability (ms, default 5000): "
set /p entryThresh="Entry Threshold (dBm, e.g. -70): "
set /p exitThresh="Exit Threshold (dBm, e.g. -75): "
echo.
(
echo REACT_APP_BLE_BUFFER_SIZE=%buffer%
echo REACT_APP_BLE_ENTRY_STABILITY_MS=%entryStab%
echo REACT_APP_BLE_EXIT_STABILITY_MS=%exitStab%
echo REACT_APP_BLE_ENTRY_THRESHOLD=%entryThresh%
echo REACT_APP_BLE_EXIT_THRESHOLD=%exitThresh%
) > .env.proximity
echo.
echo ✓ Custom settings applied
goto restart

:view
echo.
echo === Current Configuration ===
if exist .env.proximity (
    type .env.proximity
) else (
    echo No custom configuration found. Using defaults from proximityConfig.js
)
echo.
pause
goto menu

:reset
echo.
echo Resetting to default configuration...
if exist .env.proximity del .env.proximity
echo ✓ Configuration reset. App will use defaults from proximityConfig.js
echo.
goto restart

:restart
echo.
echo ========================================
echo   Configuration Updated!
echo ========================================
echo.
echo IMPORTANT: Restart the React app for changes to take effect:
echo   1. Stop the app (Ctrl+C in terminal)
echo   2. Run: npm start
echo.
echo The new settings will be loaded automatically.
echo.
pause
goto menu

:end
echo.
echo Exiting configurator...
exit
