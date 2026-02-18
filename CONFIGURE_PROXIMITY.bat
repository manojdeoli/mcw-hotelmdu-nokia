@echo off
echo ========================================
echo   BLE Proximity Detection Configurator
echo ========================================
echo.

:menu
echo Current Settings:
echo.
echo 1. Default (Balanced)      - Entry: -70, Stability: 2s
echo 2. Aggressive (Fast)       - Entry: -65, Stability: 1.5s
echo 3. Conservative (Stable)   - Entry: -75, Stability: 2.5s
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
echo Setting DEFAULT configuration...
(
echo REACT_APP_BLE_BUFFER_SIZE=15
echo REACT_APP_BLE_ENTRY_STABILITY_MS=2000
echo REACT_APP_BLE_EXIT_STABILITY_MS=5000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-70
echo REACT_APP_BLE_EXIT_THRESHOLD=-75
) > .env.proximity
echo.
echo ✓ Default settings applied
echo   - Buffer Size: 15 readings
echo   - Entry Stability: 2000ms
echo   - Exit Stability: 5000ms
echo   - Entry Threshold: -70 dBm (~2-3 meters)
echo   - Exit Threshold: -75 dBm
echo.
goto restart

:aggressive
echo.
echo Setting AGGRESSIVE configuration...
(
echo REACT_APP_BLE_BUFFER_SIZE=10
echo REACT_APP_BLE_ENTRY_STABILITY_MS=1500
echo REACT_APP_BLE_EXIT_STABILITY_MS=5000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-65
echo REACT_APP_BLE_EXIT_THRESHOLD=-70
) > .env.proximity
echo.
echo ✓ Aggressive settings applied
echo   - Buffer Size: 10 readings (faster)
echo   - Entry Stability: 1500ms (quicker)
echo   - Exit Stability: 5000ms
echo   - Entry Threshold: -65 dBm (~1-2 meters, closer)
echo   - Exit Threshold: -70 dBm
echo.
goto restart

:conservative
echo.
echo Setting CONSERVATIVE configuration...
(
echo REACT_APP_BLE_BUFFER_SIZE=20
echo REACT_APP_BLE_ENTRY_STABILITY_MS=2500
echo REACT_APP_BLE_EXIT_STABILITY_MS=6000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-75
echo REACT_APP_BLE_EXIT_THRESHOLD=-80
) > .env.proximity
echo.
echo ✓ Conservative settings applied
echo   - Buffer Size: 20 readings (more stable)
echo   - Entry Stability: 2500ms (longer)
echo   - Exit Stability: 6000ms
echo   - Entry Threshold: -75 dBm (~3-4 meters, further)
echo   - Exit Threshold: -80 dBm
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
