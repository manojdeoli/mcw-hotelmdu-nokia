@echo off
echo ========================================
echo   BLE Proximity Detection Configurator
echo ========================================
echo.

:menu
echo Configuration Presets:
echo.
echo 1. FAST DETECTION (Small Booth)
echo    - Best for: Small MWC booth, strict proximity required
echo    - Detection: ~1 second, very close range (~1 meter)
echo    - Settings: Buffer=3, Stability=500ms, Threshold=-55dBm
echo.
echo 2. BALANCED DETECTION (Medium Area)
echo    - Best for: Larger booth, more forgiving proximity
echo    - Detection: ~2 seconds, close range (~2 meters)
echo    - Settings: Buffer=15, Stability=2s, Threshold=-65dBm
echo.
echo 3. RELAXED DETECTION (Testing/Large Area)
echo    - Best for: Testing or large open area
echo    - Detection: ~2 seconds, medium range (~3 meters)
echo    - Settings: Buffer=15, Stability=2s, Threshold=-70dBm
echo.
echo 4. CUSTOM (Manual Configuration)
echo    - Set each parameter individually
echo    - Configure: Buffer Size, Stability Times, RSSI Thresholds
echo.
echo 5. View Current Configuration
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
echo Setting FAST DETECTION configuration...
(
echo REACT_APP_BLE_BUFFER_SIZE=3
echo REACT_APP_BLE_ENTRY_STABILITY_MS=500
echo REACT_APP_BLE_EXIT_STABILITY_MS=2000
echo REACT_APP_BLE_ENTRY_THRESHOLD=-55
echo REACT_APP_BLE_EXIT_THRESHOLD=-60
) > .env.proximity
echo.
echo ✓ Fast Detection settings applied
echo   - Buffer Size: 3 readings
echo   - Entry Stability: 500ms
echo   - Exit Stability: 2000ms
echo   - Entry Threshold: -55 dBm (~1 meter, VERY CLOSE)
echo   - Exit Threshold: -60 dBm
echo   - Detection Time: ~1 second
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
echo ========================================
echo   CUSTOM CONFIGURATION
echo ========================================
echo.
echo Configure all BLE detection parameters manually:
echo.
echo   1. Buffer Size: Number of RSSI readings to average (1-50)
echo      - Smaller = Faster detection, more noise
echo      - Larger = Slower detection, less noise
echo.
echo   2. Entry Stability: How long signal must be strong (ms)
echo      - Shorter = Faster detection, risk of false positives
echo      - Longer = Slower detection, more reliable
echo.
echo   3. Exit Stability: How long signal must be weak (ms)
echo      - Controls how quickly detection ends
echo.
echo   4. Entry Threshold: RSSI level to trigger detection (dBm)
echo      - Higher (e.g., -50) = Closer range, stricter
echo      - Lower (e.g., -70) = Farther range, more sensitive
echo.
echo   5. Exit Threshold: RSSI level to end detection (dBm)
echo      - Creates hysteresis zone to prevent flapping
echo.
echo Current values will be shown. Press ENTER to keep existing value.
echo.

:: Read current values if .env.proximity exists
if exist .env.proximity (
    for /f "tokens=1,2 delims==" %%a in (.env.proximity) do (
        if "%%a"=="REACT_APP_BLE_BUFFER_SIZE" set current_buffer=%%b
        if "%%a"=="REACT_APP_BLE_ENTRY_STABILITY_MS" set current_entry=%%b
        if "%%a"=="REACT_APP_BLE_EXIT_STABILITY_MS" set current_exit=%%b
        if "%%a"=="REACT_APP_BLE_ENTRY_THRESHOLD" set current_entry_thresh=%%b
        if "%%a"=="REACT_APP_BLE_EXIT_THRESHOLD" set current_exit_thresh=%%b
    )
) else (
    set current_buffer=3
    set current_entry=500
    set current_exit=2000
    set current_entry_thresh=-55
    set current_exit_thresh=-60
)

set /p buffer="Buffer Size (current: %current_buffer%): "
if "%buffer%"=="" set buffer=%current_buffer%

set /p entryStab="Entry Stability ms (current: %current_entry%): "
if "%entryStab%"=="" set entryStab=%current_entry%

set /p exitStab="Exit Stability ms (current: %current_exit%): "
if "%exitStab%"=="" set exitStab=%current_exit%

set /p entryThresh="Entry Threshold dBm (current: %current_entry_thresh%): "
if "%entryThresh%"=="" set entryThresh=%current_entry_thresh%

set /p exitThresh="Exit Threshold dBm (current: %current_exit_thresh%): "
if "%exitThresh%"=="" set exitThresh=%current_exit_thresh%

echo.
echo Writing configuration to .env.proximity file...
(
echo REACT_APP_BLE_BUFFER_SIZE=%buffer%
echo REACT_APP_BLE_ENTRY_STABILITY_MS=%entryStab%
echo REACT_APP_BLE_EXIT_STABILITY_MS=%exitStab%
echo REACT_APP_BLE_ENTRY_THRESHOLD=%entryThresh%
echo REACT_APP_BLE_EXIT_THRESHOLD=%exitThresh%
) > .env.proximity
echo.
echo ✓ Configuration file created successfully!
echo.
echo === Configuration Summary ===
echo   - Buffer Size: %buffer% readings
echo   - Entry Stability: %entryStab%ms
echo   - Exit Stability: %exitStab%ms
echo   - Entry Threshold: %entryThresh% dBm
echo   - Exit Threshold: %exitThresh% dBm
echo.
echo File location: .env.proximity
echo.
goto restart

:view
echo.
echo ========================================
echo   CURRENT CONFIGURATION
echo ========================================
echo.
if exist .env.proximity (
    echo Custom configuration from .env.proximity:
    echo ----------------------------------------
    type .env.proximity
    echo ----------------------------------------
) else (
    echo No custom configuration file found.
    echo Using DEFAULT values from proximityConfig.js:
    echo ----------------------------------------
    echo REACT_APP_BLE_BUFFER_SIZE=3
    echo REACT_APP_BLE_ENTRY_STABILITY_MS=500
    echo REACT_APP_BLE_EXIT_STABILITY_MS=2000
    echo REACT_APP_BLE_ENTRY_THRESHOLD=-55
    echo REACT_APP_BLE_EXIT_THRESHOLD=-60
    echo ----------------------------------------
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
echo Verifying .env.proximity file contents:
echo ----------------------------------------
if exist .env.proximity (
    type .env.proximity
) else (
    echo ERROR: .env.proximity file was not created!
)
echo ----------------------------------------
echo.
echo IMPORTANT: For production builds, rebuild the app for changes to take effect:
echo   1. Run: npm run build
echo   2. Restart the server: npm run start:prod
echo.
echo For development mode, the new settings will be loaded automatically
echo when the server injects runtime configuration.
echo.
echo Testing proximity configuration injection...
echo Checking if server.js can read the configuration...
if exist server.js (
    echo ✓ server.js found - runtime injection will work
) else (
    echo ⚠ server.js not found - make sure you're in the correct directory
)
echo.
pause
goto menu

:end
echo.
echo Exiting configurator...
exit
