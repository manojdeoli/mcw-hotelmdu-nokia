@echo off
echo ========================================
echo   BLE Beacon Device Configurator
echo ========================================
echo.

REM Auto-detect PC IP once at startup — written to .env for Android app to fetch config
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set PC_IP_RAW=%%a
    goto :ip_found
)
:ip_found
for /f "tokens=* delims= " %%b in ("%PC_IP_RAW%") do set PC_IP=%%b
echo PC IP auto-detected: %PC_IP%

REM Write PC IP to .env so server serves beacon config to Android app
REM Preserves existing .env entries, only updates REACT_APP_BEACON_CONFIG_URL
if exist .env (
    powershell -Command "$c = Get-Content '.env' -Raw; if ($c -match 'REACT_APP_BEACON_CONFIG_URL') { $c = $c -replace 'REACT_APP_BEACON_CONFIG_URL=.*', 'REACT_APP_BEACON_CONFIG_URL=http://%PC_IP%:4002' } else { $c = $c.TrimEnd() + [System.Environment]::NewLine + 'REACT_APP_BEACON_CONFIG_URL=http://%PC_IP%:4002' }; $c | Set-Content '.env' -NoNewline"
) else (
    echo REACT_APP_BEACON_CONFIG_URL=http://%PC_IP%:4002 > .env
)
echo Beacon config URL set to: http://%PC_IP%:4002
echo.

:menu
echo Options:
echo.
echo 1. Add a new BLE device to a zone
echo 2. View current configuration
echo 3. Reset to factory defaults
echo 4. Exit
echo.
set /p choice="Select option (1-4): "

if "%choice%"=="1" goto add_device
if "%choice%"=="2" goto view
if "%choice%"=="3" goto reset
if "%choice%"=="4" goto end
goto menu

REM ============================================================
:add_device
echo.
echo Which zone should this device be assigned to?
echo.
echo 1. Hotel Entry Gate  [BARRIER - triggers biometric validation]
echo 2. Check-in Kiosk
echo 3. Elevator Lobby
echo 4. Hotel Room
echo.
set /p zone_choice="Select zone (1-4): "

if "%zone_choice%"=="1" (
    set LOGICAL_NAME=HotelGate
    set ZONE_DESC=Hotel Entry Gate
    set IS_BARRIER=true
)
if "%zone_choice%"=="2" (
    set LOGICAL_NAME=HotelKiosk
    set ZONE_DESC=Check-in Kiosk
    set IS_BARRIER=false
)
if "%zone_choice%"=="3" (
    set LOGICAL_NAME=HotelElevator
    set ZONE_DESC=Elevator Lobby
    set IS_BARRIER=false
)
if "%zone_choice%"=="4" (
    set LOGICAL_NAME=HotelRoom
    set ZONE_DESC=Room 1337
    set IS_BARRIER=false
)

if "%LOGICAL_NAME%"=="" (
    echo Invalid selection.
    goto add_device
)

echo.
echo Enter the BLE advertised name exactly as shown in nRF Connect or your beacon app.
echo.
set /p NEW_ID="New device BLE name: "

if "%NEW_ID%"=="" (
    echo Device name cannot be empty.
    goto add_device
)

echo.
echo   Device : %NEW_ID%
echo   Zone   : %ZONE_DESC%
echo   Barrier: %IS_BARRIER%
echo.
set /p confirm="Apply? (y/n): "
if /i not "%confirm%"=="y" goto menu

REM Bootstrap defaults if no config file yet
if not exist beacon_config.json call :write_defaults

REM Append new entry via PowerShell and bump version
powershell -Command "$cfg = Get-Content 'beacon_config.json' -Raw -Encoding UTF8 | ConvertFrom-Json; $entry = [PSCustomObject]@{ matchType='EXACT'; identifier='%NEW_ID%'; logicalName='%LOGICAL_NAME%'; zone='%ZONE_DESC%'; isBarrier=[System.Convert]::ToBoolean('%IS_BARRIER%') }; $cfg.beacons += $entry; $n = if ($cfg.version -match 'v(\d+)$') { [int]$Matches[1] + 1 } else { 2 }; $cfg.version = (Get-Date -Format 'yyyy-MM-dd') + '-v' + $n; [System.IO.File]::WriteAllText((Resolve-Path 'beacon_config.json'), ($cfg | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))"

echo.
echo ✓ '%NEW_ID%' added to %ZONE_DESC%
echo ✓ Saved to beacon_config.json
echo.
echo Pushing live update to Android app...
powershell -Command "$r = Invoke-WebRequest -Uri 'http://localhost:4002/config/beacons/reload' -Method POST -UseBasicParsing -ErrorAction SilentlyContinue; if ($r -and $r.StatusCode -lt 500) { $j = $r.Content | ConvertFrom-Json; if ($j.pushed -eq $true) { Write-Host '✓ Android app updated live (version:' $j.version ')' } else { Write-Host '⚠ Android app not reachable — config saved, will apply on next app start' } } else { Write-Host '⚠ Server not reachable — config saved, will apply on next app start' }"
echo.
pause
goto menu

REM ============================================================
:view
echo.
echo ========================================
echo   Current Beacon Configuration
echo ========================================
echo.
if exist beacon_config.json (
    type beacon_config.json
) else (
    echo No custom config — Android app is using factory defaults:
    echo.
    echo   HotelGate     ^<-- HotelGate, ER26B00001, BCPro_212364  [BARRIER]
    echo   HotelKiosk    ^<-- HotelKiosk, ER26B00002
    echo   HotelElevator ^<-- HotelElevator, ER26B00003
    echo   HotelRoom     ^<-- HotelRoom, ER26B00004
)
echo.
pause
goto menu

REM ============================================================
:reset
echo.
if exist beacon_config.json del beacon_config.json
echo ✓ Custom config removed. Android app will use factory defaults on next start.
echo.
pause
goto menu

REM ============================================================
:write_defaults
(
echo {
echo   "version": "factory-defaults",
echo   "beacons": [
echo     { "matchType": "EXACT", "identifier": "HotelGate",     "logicalName": "HotelGate",     "zone": "Hotel Entry Gate", "isBarrier": true  },
echo     { "matchType": "EXACT", "identifier": "ER26B00001",    "logicalName": "HotelGate",     "zone": "Hotel Entry Gate", "isBarrier": true  },
echo     { "matchType": "EXACT", "identifier": "BCPro_212364",  "logicalName": "HotelGate",     "zone": "Hotel Entry Gate", "isBarrier": true  },
echo     { "matchType": "EXACT", "identifier": "HotelKiosk",    "logicalName": "HotelKiosk",    "zone": "Check-in Kiosk",   "isBarrier": false },
echo     { "matchType": "EXACT", "identifier": "ER26B00002",    "logicalName": "HotelKiosk",    "zone": "Check-in Kiosk",   "isBarrier": false },
echo     { "matchType": "EXACT", "identifier": "HotelElevator", "logicalName": "HotelElevator", "zone": "Elevator Lobby",   "isBarrier": false },
echo     { "matchType": "EXACT", "identifier": "ER26B00003",    "logicalName": "HotelElevator", "zone": "Elevator Lobby",   "isBarrier": false },
echo     { "matchType": "EXACT", "identifier": "HotelRoom",     "logicalName": "HotelRoom",     "zone": "Room 1337",        "isBarrier": false },
echo     { "matchType": "EXACT", "identifier": "ER26B00004",    "logicalName": "HotelRoom",     "zone": "Room 1337",        "isBarrier": false }
echo   ]
echo }
) > beacon_config.json
goto :eof

:end
exit
