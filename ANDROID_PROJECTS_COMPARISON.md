# Android Projects Comparison & Build Guide

## Two Android Projects Comparison

### Project 1: `android-ble-scanner` ✅ RECOMMENDED
**Location:** `C:\My Work\OneDrive_1_15-1-2026\android-ble-scanner`

**Status:** ✅ Complete and ready to build

**Features:**
- ✅ Complete Android Studio project structure
- ✅ All Gradle files configured
- ✅ Uses NanoHTTPD WebSocket library (stable)
- ✅ Simple and working implementation
- ❌ NO beacon filtering (broadcasts ALL BLE devices)

**Main File:** `GatewayServer.java`
- WebSocket server on port 3001
- Broadcasts all BLE beacon data
- Maps beacons to zones

### Project 2: `Hotel MDU/android-service` ⚠️ INCOMPLETE
**Location:** `c:\My Work\OneDrive_1_15-1-2026\HotelMDU-Nokia\Hotel MDU\android-service`

**Status:** ⚠️ Missing project structure files

**Features:**
- ✅ **Has beacon filtering** (only allows specific devices)
- ✅ Maps Easy Reach devices (ER26B00001-004) to hotel zones
- ✅ Foreground service (better background operation)
- ❌ Missing complete Gradle setup
- ❌ Missing proper project structure

**Main File:** `BLEGatewayService.java`
- Filters for: ER26B00001, ER26B00002, ER26B00003, ER26B00004
- Maps to: HotelGate, HotelKiosk, HotelElevator, HotelRoom

## Recommendation: Build android-ble-scanner

The `android-ble-scanner` project is complete and ready to build immediately.

## Quick Build Steps

### 1. Open in Android Studio
```
1. Launch Android Studio
2. File → Open
3. Navigate to: C:\My Work\OneDrive_1_15-1-2026\android-ble-scanner
4. Click OK
```

### 2. Sync Gradle
```
- Android Studio will prompt "Gradle files have changed"
- Click "Sync Now"
- Wait 2-5 minutes for dependencies to download
```

### 3. Build APK
```
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

**APK Location:**
```
C:\My Work\OneDrive_1_15-1-2026\android-ble-scanner\app\build\outputs\apk\debug\app-debug.apk
```

### 4. Install on Phone
```
1. Enable Developer Options (tap Build Number 7 times)
2. Enable USB Debugging
3. Connect phone via USB
4. Click Run (green play button) in Android Studio
```

## Adding Beacon Filtering (Optional)

If you want to add the beacon filtering from BLEGatewayService.java to the android-ble-scanner project:

### Update GatewayServer.java

Add these methods to filter beacons:

```java
// Add to GatewayServer.java

private boolean isAllowedDevice(String deviceName) {
    if (deviceName == null) return false;
    
    // Allow hotel beacon names
    if (deviceName.equals("HotelGate") || deviceName.equals("HotelKiosk") ||
        deviceName.equals("HotelElevator") || deviceName.equals("HotelRoom")) {
        return true;
    }
    
    // Allow Easy Reach devices
    if (deviceName.equals("ER26B00001") || deviceName.equals("ER26B00002") ||
        deviceName.equals("ER26B00003") || deviceName.equals("ER26B00004")) {
        return true;
    }
    
    return false;
}

private String mapDeviceToZone(String deviceName) {
    switch (deviceName) {
        case "ER26B00001":
            return "HotelGate";
        case "ER26B00002":
            return "HotelKiosk";
        case "ER26B00003":
            return "HotelElevator";
        case "ER26B00004":
            return "HotelRoom";
        default:
            return deviceName;
    }
}
```

Then update the `broadcastBLEEvent` method to use filtering:

```java
public void broadcastBLEEvent(String beaconName, int rssi) {
    // Add filtering
    if (!isAllowedDevice(beaconName)) {
        return; // Ignore this beacon
    }
    
    // Map device to zone
    String mappedName = mapDeviceToZone(beaconName);
    
    // Continue with existing logic...
    BLEData data = processBLEData(mappedName, rssi);
    // ... rest of the method
}
```

## Testing

1. **Start Gateway Server** (if separate)
2. **Install APK** on Android phone
3. **Grant permissions**: Bluetooth, Location, Internet
4. **Connect to Gateway**: Enter phone number and Gateway URL
5. **Start Scanning**: Click "Start Scanning"
6. **Test with beacons**: Place phone near BLE beacons
7. **Verify in React app**: Check if zones update

## Summary

✅ **Use:** `android-ble-scanner` - Complete and ready to build
⚠️ **Reference:** `android-service/BLEGatewayService.java` - For beacon filtering logic

The android-ble-scanner project is production-ready and can be built immediately in Android Studio.
