@echo off
echo ========================================
echo   Proximity Detection Configuration
echo ========================================
echo.
echo Current Mode: SMOOTHED (Stable Detection)
echo.
echo This tool allows you to switch to DIRECT mode (Legacy)
echo if needed for testing or compatibility.
echo.
echo Default SMOOTHED mode provides:
echo   - Stable detection without flickering
echo   - Moving average of RSSI readings
echo   - Configurable stability timers
echo.
echo ========================================
echo.

REM Find the main JavaScript file
for %%f in (static\js\main.*.js) do set MAIN_JS=%%f

if "%MAIN_JS%"=="" (
    echo ERROR: Could not find main JavaScript file
    pause
    exit /b 1
)

echo Detected file: %MAIN_JS%
echo.

REM Check current mode
findstr /C:"DETECTION_MODES.SMOOTHED" "%MAIN_JS%" >nul
if %ERRORLEVEL%==0 (
    set CURRENT_MODE=SMOOTHED
) else (
    set CURRENT_MODE=DIRECT
)

echo Current Detection Mode: %CURRENT_MODE%
echo.
echo Options:
echo   1. Keep SMOOTHED mode (recommended)
echo   2. Switch to DIRECT mode (legacy)
echo   3. Exit
echo.
set /p CHOICE="Enter your choice (1-3): "

if "%CHOICE%"=="1" goto KEEP_SMOOTHED
if "%CHOICE%"=="2" goto SWITCH_DIRECT
if "%CHOICE%"=="3" goto END
goto END

:KEEP_SMOOTHED
if "%CURRENT_MODE%"=="SMOOTHED" (
    echo.
    echo Already in SMOOTHED mode. No changes needed.
    echo.
    pause
    goto END
)
echo.
echo Switching to SMOOTHED mode...
powershell -Command "(Get-Content '%MAIN_JS%') -replace 'this\.mode=DETECTION_MODES\.DIRECT', 'this.mode=DETECTION_MODES.SMOOTHED' | Set-Content '%MAIN_JS%'"
echo.
echo ========================================
echo Mode switched to SMOOTHED successfully!
echo.
echo Restart the application (START_APP.bat) for changes to take effect.
echo ========================================
echo.
pause
goto END

:SWITCH_DIRECT
if "%CURRENT_MODE%"=="DIRECT" (
    echo.
    echo Already in DIRECT mode. No changes needed.
    echo.
    pause
    goto END
)
echo.
echo WARNING: DIRECT mode uses immediate RSSI comparison
echo which may cause flickering detection.
echo.
set /p CONFIRM="Are you sure? (Y/N): "
if /i not "%CONFIRM%"=="Y" goto END

echo.
echo Switching to DIRECT mode...
powershell -Command "(Get-Content '%MAIN_JS%') -replace 'this\.mode=DETECTION_MODES\.SMOOTHED', 'this.mode=DETECTION_MODES.DIRECT' | Set-Content '%MAIN_JS%'"
echo.
echo ========================================
echo Mode switched to DIRECT successfully!
echo.
echo You can now use CONFIGURE_PROXIMITY.bat to adjust DIRECT thresholds.
echo Restart the application (START_APP.bat) for changes to take effect.
echo ========================================
echo.
pause
goto END

:END
