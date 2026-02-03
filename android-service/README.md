# Android BLE Gateway Foreground Service

This implementation keeps the BLE Gateway app running in the background even when the phone is locked.

## Files Structure

```
android-service/
├── BLEGatewayService.java      # Main foreground service
├── MainActivity.java            # UI with start/stop buttons
├── AndroidManifest.xml          # Permissions and service declaration
├── activity_main.xml            # UI layout
├── build.gradle                 # Dependencies
└── README.md                    # This file
```

## Integration Steps

1. **Copy files to your Android project:**
   - Copy `BLEGatewayService.java` to `app/src/main/java/com/hotel/blegateway/`
   - Copy `MainActivity.java` to `app/src/main/java/com/hotel/blegateway/`
   - Copy `activity_main.xml` to `app/src/main/res/layout/`
   - Merge `AndroidManifest.xml` permissions and service declaration
   - Merge `build.gradle` dependencies

2. **Update your existing BLE Scanner and WebSocket Server:**
   - Move BLE scanning logic to be called from `BLEGatewayService`
   - Move WebSocket server initialization to `BLEGatewayService`

3. **Build and install the app**

4. **Grant permissions:**
   - Location permission (required for BLE scanning)
   - Notification permission (Android 13+)
   - Battery optimization exemption (will be prompted)

5. **Start the service:**
   - Tap "Start Service" button
   - Service will show persistent notification
   - Lock phone - service continues running

## Key Features

✅ **Foreground Service** - Persistent notification keeps service alive
✅ **Wake Lock** - Prevents CPU sleep during BLE scanning
✅ **Battery Optimization Exemption** - Prevents Android from killing the service
✅ **START_STICKY** - Service restarts if killed by system
✅ **Background Execution** - Works even when phone is locked

## Testing

1. Start the service
2. Lock the phone
3. Check laptop - WebSocket connection should remain active
4. BLE beacons should continue to be detected

## Troubleshooting

**Service stops when phone locks:**
- Ensure battery optimization is disabled for the app
- Check notification is showing (indicates foreground service is running)

**WebSocket disconnects:**
- Check WiFi doesn't sleep when phone locks (Settings → WiFi → Advanced)
- Ensure wake lock is acquired

**BLE scanning stops:**
- Verify location permission is granted
- Check Bluetooth is enabled
