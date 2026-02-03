# BLE Gateway Service - Sleep Mode Fix

## Problem
BLE beacons were not being detected when the mobile device went into sleep mode because the scanning process was stopped by Android's power management.

## Solution
Implemented a foreground service with wake lock that keeps BLE scanning active even when the device sleeps.

## Key Features

### 1. Foreground Service
- Runs with persistent notification
- Uses `START_STICKY` to restart if killed
- Declared with `foregroundServiceType="connectedDevice"`

### 2. Wake Lock
- `PARTIAL_WAKE_LOCK` keeps CPU running
- Prevents Android from stopping BLE scanning
- Automatically released when service stops

### 3. Battery Optimization Exemption
- Requests user to disable battery optimization
- Prevents Android from killing the service
- Required for reliable background operation

### 4. BLE Scanning
- Continuous low-latency scanning
- Filters for hotel beacons (Gate, Kiosk, Elevator, Room)
- Broadcasts events via WebSocket to React app

### 5. WebSocket Server
- Runs on port 3001
- Non-blocking I/O for efficiency
- Broadcasts BLE events to all connected clients

## Permissions Required

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## Usage

### Starting the Service

```java
Intent serviceIntent = new Intent(this, BLEGatewayService.class);
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    startForegroundService(serviceIntent);
} else {
    startService(serviceIntent);
}
```

### Stopping the Service

```java
Intent serviceIntent = new Intent(this, BLEGatewayService.class);
stopService(serviceIntent);
```

## Testing Sleep Mode

1. Start the service from MainActivity
2. Lock the device screen
3. Wait for device to enter deep sleep (2-3 minutes)
4. Move near a BLE beacon
5. Check logs: `adb logcat | grep BLEGatewayService`
6. Verify beacon events are still being detected

## Important Notes

### Android 12+ (API 31+)
- Must request `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` at runtime
- User must grant permissions before service starts

### Android 14+ (API 34+)
- Must declare `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission
- Service type must be specified in manifest

### Battery Optimization
- Service will request exemption on first launch
- User should allow to ensure reliable operation
- Can be manually enabled in Settings > Apps > Special Access > Battery Optimization

### Doze Mode
- Wake lock keeps CPU active during Doze
- Service continues scanning even in deep sleep
- Network access may be restricted (WebSocket may disconnect)

## Troubleshooting

### Service Stops After Screen Lock
- Check battery optimization is disabled
- Verify wake lock is acquired (check logs)
- Ensure all permissions are granted

### BLE Events Not Detected
- Verify Bluetooth is enabled
- Check scan permissions are granted
- Ensure beacons are in range and advertising
- Check beacon name filters in scanCallback

### WebSocket Disconnects
- Normal during Doze mode
- Clients should reconnect automatically
- Consider using FCM for critical notifications

## Build Configuration

Add to `build.gradle`:

```gradle
android {
    compileSdk 34
    
    defaultConfig {
        minSdk 26
        targetSdk 34
    }
}

dependencies {
    implementation 'androidx.core:core:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
```

## Performance Impact

- CPU: Minimal (wake lock only prevents deep sleep)
- Battery: ~5-10% per hour (depends on scan frequency)
- Memory: ~10-20 MB (service + BLE stack)

## Recommendations

1. Use `SCAN_MODE_LOW_POWER` for better battery life if real-time detection isn't critical
2. Implement adaptive scanning (increase frequency when near hotel)
3. Stop service when user checks out
4. Consider using geofencing to start/stop service automatically
