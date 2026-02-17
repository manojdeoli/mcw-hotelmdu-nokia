# Proximity Detection Implementation Guide

## Overview
Implement dual-mode BLE proximity detection:
1. **DIRECT mode** (Legacy): Immediate RSSI comparison
2. **SMOOTHED mode** (New/Default): Moving average with stability

## Files Created
- `rssiProcessor.js`: Moving average and state stability logic
- `proximityConfig.js`: Configuration manager for both modes

## Implementation Steps

### Step 1: Import New Modules in App.js
```javascript
import RSSIProcessor from './rssiProcessor';
import proximityConfig, { DETECTION_MODES } from './proximityConfig';
```

### Step 2: Initialize RSSI Processor
```javascript
// Add after other useRef declarations
const rssiProcessorRef = useRef(new RSSIProcessor(proximityConfig.getSmoothedConfig()));
```

### Step 3: Modify processBeaconDetection Function
Replace the existing PROXIMITY DETECTION LOGIC section (lines ~600-650) with:

```javascript
// --- PROXIMITY DETECTION LOGIC ---
if (rssi !== null) {
  if (proximityConfig.isDirectMode()) {
    // DIRECT MODE: Legacy immediate comparison
    activeBeacons.set(deviceName, { rssi, timestamp: Date.now() });
    
    const now = Date.now();
    for (const [name, data] of activeBeacons.entries()) {
      if (now - data.timestamp > 5000) {
        activeBeacons.delete(name);
      }
    }
    
    const validBeacons = [...activeBeacons.entries()]
      .filter(([name, data]) => data.rssi >= proximityConfig.getDirectThresholds().IMMEDIATE)
      .sort((a, b) => b[1].rssi - a[1].rssi);
    
    if (validBeacons.length === 0) {
      console.log('[App.js] DIRECT: No beacons meet threshold');
      return;
    }
    
    const [closestBeacon, closestData] = validBeacons[0];
    if (closestBeacon !== deviceName) {
      console.log(`[App.js] DIRECT: ${deviceName} not closest`);
      return;
    }
    
    console.log(`[App.js] DIRECT: Processing ${deviceName} (RSSI: ${rssi})`);
    
  } else {
    // SMOOTHED MODE: Moving average with stability
    const result = rssiProcessorRef.current.addReading(deviceName, rssi);
    
    console.log(`[App.js] SMOOTHED: ${deviceName} - Raw: ${rssi}, Avg: ${result.avgRssi?.toFixed(1)}, State: ${result.state}`);
    
    if (!rssiProcessorRef.current.isDetected(deviceName)) {
      console.log('[App.js] SMOOTHED: Beacon not in DETECTED state yet');
      return;
    }
    
    console.log(`[App.js] SMOOTHED: Processing ${deviceName} (stable detection)`);
  }
}
```

### Step 4: Add Mode Toggle UI (Optional)
Add to Action Buttons section:

```javascript
<div className="mt-2">
  <label>Detection Mode:</label>
  <select 
    className="form-control" 
    value={proximityConfig.getMode()}
    onChange={(e) => {
      proximityConfig.setMode(e.target.value);
      rssiProcessorRef.current.reset();
      addMessage(`Switched to ${e.target.value} detection mode`);
    }}
  >
    <option value="SMOOTHED">Smoothed (Stable)</option>
    <option value="DIRECT">Direct (Legacy)</option>
  </select>
</div>
```

### Step 5: Update CONFIGURE_PROXIMITY.bat
The batch file already exists and works for DIRECT mode thresholds.
For SMOOTHED mode configuration, add environment variables or UI controls.

## Configuration Parameters

### Direct Mode (Legacy)
- IMMEDIATE: -55 dBm
- NEAR: -65 dBm  
- FAR: -75 dBm
- OUT_OF_RANGE: -85 dBm

### Smoothed Mode (Default)
- bufferSize: 15 readings
- entryStabilityMs: 2000ms (2 seconds)
- exitStabilityMs: 5000ms (5 seconds)
- entryThreshold: -55 dBm
- exitThreshold: -60 dBm (hysteresis)

## Testing
1. Default behavior: SMOOTHED mode active
2. Switch to DIRECT mode via UI or config
3. CONFIGURE_PROXIMITY.bat updates DIRECT thresholds
4. Both modes coexist without interference

## Benefits
- Eliminates "ping-pong" effect in SMOOTHED mode
- Maintains backward compatibility with DIRECT mode
- Easy switching for demos and testing
- Configurable parameters for both modes
