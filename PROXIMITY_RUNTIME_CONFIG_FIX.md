# Proximity Configuration Runtime Update Fix

## Problem
Proximity parameters were only read from environment variables at build time, requiring a full rebuild whenever users ran CONFIGURE_PROXIMITY.bat to update BLE detection settings.

## Solution
Implemented runtime configuration injection similar to the Gateway IP address fix, allowing proximity parameters to be updated without rebuilding the application.

## Changes Made

### 1. proximityConfig.js
- Added `getRuntimeProximityConfig()` function to check for runtime overrides
- Modified `getSmoothedConfig()` to use runtime configuration first, then fall back to environment variables
- Added `refreshConfig()` method to reload configuration from runtime sources
- Updated `getSmoothedConfig()` to always refresh configuration before returning values

### 2. server.js
- Added `getProximityConfig()` function to read .env.proximity file
- Modified production route handler to inject proximity configuration into HTML
- Added runtime configuration script injection alongside Gateway URL override

### 3. rssiProcessor.js
- Added import for proximityConfig
- Modified constructor to use proximityConfig.getSmoothedConfig() when no explicit config provided
- Added `updateConfig()` method to refresh configuration at runtime
- Configuration updates now reset all beacon data to apply new thresholds immediately

### 4. App.js
- Added `refreshProximityConfig()` callback function
- Added periodic configuration check (every 2 seconds) to detect runtime changes
- Automatic configuration refresh when changes are detected
- Added logging for configuration updates

### 5. CONFIGURE_PROXIMITY.bat
- Updated restart message to explain runtime configuration injection
- Added information about production vs development mode behavior
- Added server.js existence check for troubleshooting

## How It Works

1. **Configuration Storage**: CONFIGURE_PROXIMITY.bat writes settings to `.env.proximity` file
2. **Server Injection**: server.js reads `.env.proximity` and injects config into HTML as `window.PROXIMITY_CONFIG_OVERRIDE`
3. **Runtime Detection**: proximityConfig.js checks for runtime overrides before using environment variables
4. **Automatic Updates**: App.js periodically checks for configuration changes and updates RSSIProcessor
5. **Immediate Effect**: New settings take effect without requiring app restart or rebuild

## Configuration Priority (Highest to Lowest)
1. `window.PROXIMITY_CONFIG_OVERRIDE` (Runtime injection from .env.proximity)
2. `window.RUNTIME_CONFIG.proximityConfig` (Alternative runtime config)
3. `process.env.REACT_APP_BLE_*` (Build-time environment variables)
4. Default values (Ultra-fast demo settings)

## Testing
Created test `.env.proximity` file with balanced detection settings:
- Buffer Size: 15 readings
- Entry Stability: 2000ms
- Exit Stability: 5000ms
- Entry Threshold: -65 dBm
- Exit Threshold: -70 dBm

## Benefits
- No rebuild required for proximity parameter changes
- Immediate configuration updates in production
- Maintains backward compatibility with environment variables
- Consistent with existing Gateway IP address update pattern
- Automatic detection and application of configuration changes