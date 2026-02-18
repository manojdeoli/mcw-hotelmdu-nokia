# Runtime Proximity Configuration Guide

## ✅ No Rebuild Required!

You can now change BLE proximity detection settings **without rebuilding** the React app.

---

## Quick Start

### 1. Run the Configurator

```bash
CONFIGURE_PROXIMITY.bat
```

### 2. Select a Preset

- **Option 1: Default (Balanced)** - Recommended for most scenarios
- **Option 2: Aggressive (Fast)** - For crowded MWC environment
- **Option 3: Conservative (Stable)** - For noisy environments
- **Option 4: Custom** - Set your own values

### 3. Restart the App

```bash
# Stop the app (Ctrl+C)
npm start
```

**That's it!** New settings are applied automatically.

---

## Configuration Presets

### 1. Default (Balanced) ✅ Recommended
```
Buffer Size: 15 readings
Entry Stability: 2000ms (2 seconds)
Exit Stability: 5000ms (5 seconds)
Entry Threshold: -70 dBm (~2-3 meters)
Exit Threshold: -75 dBm
```

**Best for:**
- Normal demo environments
- Balanced speed and reliability
- General use

---

### 2. Aggressive (Fast) 🚀 MWC Recommended
```
Buffer Size: 10 readings
Entry Stability: 1500ms (1.5 seconds)
Exit Stability: 5000ms (5 seconds)
Entry Threshold: -65 dBm (~1-2 meters)
Exit Threshold: -70 dBm
```

**Best for:**
- Crowded MWC event
- Faster detection needed
- Closer proximity required
- Reduces false positives

**Trade-offs:**
- ✅ 25% faster detection
- ✅ Requires closer proximity (more intentional)
- ❌ User must be 1-2 meters from beacon

---

### 3. Conservative (Stable) 🛡️
```
Buffer Size: 20 readings
Entry Stability: 2500ms (2.5 seconds)
Exit Stability: 6000ms (6 seconds)
Entry Threshold: -75 dBm (~3-4 meters)
Exit Threshold: -80 dBm
```

**Best for:**
- Very noisy environments
- Maximum stability
- Longer detection range

**Trade-offs:**
- ✅ Most stable, fewest false positives
- ✅ Longer detection range
- ❌ Slower detection (25% slower)

---

## Custom Configuration

### Parameters Explained

#### Buffer Size (10-20)
- **What:** Number of RSSI readings to average
- **Lower (10):** Faster response, less smooth
- **Higher (20):** Slower response, more stable
- **Default:** 15

#### Entry Stability (ms)
- **What:** How long signal must stay strong to detect
- **Lower (1500):** Faster detection, more false positives
- **Higher (2500):** Slower detection, fewer false positives
- **Default:** 2000

#### Exit Stability (ms)
- **What:** How long to stay detected after signal drops
- **Lower (3000):** Loses detection quickly
- **Higher (7000):** Maintains detection longer
- **Default:** 5000

#### Entry Threshold (dBm)
- **What:** RSSI level to enter proximity
- **Higher (-65):** Closer proximity (~1-2m)
- **Lower (-75):** Further proximity (~3-4m)
- **Default:** -70 (~2-3m)

#### Exit Threshold (dBm)
- **What:** RSSI level to exit proximity
- **Should be 5dB lower than entry** (hysteresis)
- **Default:** -75

---

## RSSI Distance Reference

| RSSI (dBm) | Approximate Distance | Use Case |
|------------|---------------------|----------|
| -50 to -60 | < 1 meter | Very close, touching beacon |
| -60 to -70 | 1-2 meters | Close proximity, intentional |
| -70 to -80 | 2-4 meters | Medium range, comfortable |
| -80 to -90 | 4-8 meters | Far range, less reliable |
| < -90 | > 8 meters | Too far, unreliable |

---

## How It Works

### Configuration Flow

```
CONFIGURE_PROXIMITY.bat
        ↓
Creates .env.proximity file
        ↓
React app reads on startup
        ↓
proximityConfig.js uses env variables
        ↓
rssiProcessor.js applies settings
```

### Files Involved

1. **CONFIGURE_PROXIMITY.bat** - User-friendly configurator
2. **.env.proximity** - Generated config file (gitignored)
3. **src/proximityConfig.js** - Reads env variables
4. **src/rssiProcessor.js** - Applies settings

---

## Troubleshooting

### Settings Not Applied?

**Problem:** Changed settings but app still uses old values

**Solution:**
1. Make sure you **restarted the app** (Ctrl+C, then `npm start`)
2. Check browser console for: `[ProximityConfig] Using CUSTOM configuration`
3. Verify `.env.proximity` file exists in project root

---

### Reset to Defaults

**Option 1: Via Configurator**
```bash
CONFIGURE_PROXIMITY.bat
# Select option 6: Reset to Default
```

**Option 2: Manual**
```bash
# Delete the config file
del .env.proximity

# Restart app
npm start
```

---

### View Current Settings

**Option 1: Via Configurator**
```bash
CONFIGURE_PROXIMITY.bat
# Select option 5: View Current Config
```

**Option 2: Browser Console**
```javascript
// Open browser console (F12)
// Look for:
[ProximityConfig] Using CUSTOM configuration from environment variables
[ProximityConfig] Smoothed config: {bufferSize: 10, entryStabilityMs: 1500, ...}
```

---

## MWC Event Recommendations

### Before Event
1. Use **Default** settings for initial testing
2. Test in a crowded area (mall, train station)
3. Adjust if needed

### At MWC Venue
1. Arrive early, test with venue WiFi/BLE active
2. If too many false triggers → Switch to **Aggressive**
3. If detection too slow → Reduce entry stability to 1500ms
4. If losing detection → Increase exit stability to 6000ms

### Quick Adjustments at Venue

**Too sensitive (false triggers):**
```bash
CONFIGURE_PROXIMITY.bat
# Select: 2. Aggressive (Fast)
# Restart app
```

**Too slow:**
```bash
CONFIGURE_PROXIMITY.bat
# Select: 4. Custom
# Entry Stability: 1500
# Keep other defaults
# Restart app
```

**Losing detection:**
```bash
CONFIGURE_PROXIMITY.bat
# Select: 4. Custom
# Exit Stability: 6000 or 7000
# Keep other defaults
# Restart app
```

---

## Advanced: Manual Configuration

If you prefer to edit directly:

### Create .env.proximity file manually

```bash
# In project root, create .env.proximity
REACT_APP_BLE_BUFFER_SIZE=15
REACT_APP_BLE_ENTRY_STABILITY_MS=2000
REACT_APP_BLE_EXIT_STABILITY_MS=5000
REACT_APP_BLE_ENTRY_THRESHOLD=-70
REACT_APP_BLE_EXIT_THRESHOLD=-75
```

### Restart app
```bash
npm start
```

---

## Testing Your Configuration

### 1. Check Console Logs

Open browser console (F12) and look for:
```
[ProximityConfig] Using CUSTOM configuration from environment variables
[ProximityConfig] Smoothed config: {bufferSize: 10, entryStabilityMs: 1500, ...}
```

### 2. Test Detection

1. Place beacon near phone
2. Watch for detection in app
3. Move beacon away
4. Verify exit behavior

### 3. Verify Timing

- **Entry:** Should detect after configured stability time
- **Exit:** Should maintain detection for configured exit time

---

## Summary

✅ **No rebuild required** - Just run batch file and restart app  
✅ **3 presets** - Default, Aggressive, Conservative  
✅ **Custom settings** - Full control over all parameters  
✅ **Easy reset** - Back to defaults anytime  
✅ **MWC ready** - Quick adjustments at venue  

**Recommended for MWC:** Start with Default, switch to Aggressive if needed.
