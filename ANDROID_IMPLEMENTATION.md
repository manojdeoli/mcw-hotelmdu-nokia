# Hotel MDU - Android WebView + BLE Implementation

## Changes Made

### 1. React App Changes (Minimal)
- **bleBridge.js**: New module that handles Android-to-React communication
- **App.js**: Updated BLE scanning functions to use Android bridge instead of Chrome Web Bluetooth API

### 2. Android App Structure
- **MainActivity.java**: WebView host with native BLE scanner
- **activity_main.xml**: Simple layout with WebView
- **AndroidManifest.xml**: Required BLE permissions
- **build.gradle**: Android project configuration

## Implementation Steps

### React App (Already Updated)
1. The BLE bridge automatically handles RSSI smoothing and zone mapping
2. Manual scan now triggers Android native scan
3. Auto-scan uses Android's continuous BLE scanning

### Android App Setup
1. Create new Android Studio project
2. Copy files from `/android` folder to appropriate locations:
   - `MainActivity.java` → `app/src/main/java/com/hotel/mdu/`
   - `activity_main.xml` → `app/src/main/res/layout/`
   - `AndroidManifest.xml` → `app/src/main/`
   - `build.gradle` → `app/`

3. For development: Start React dev server (`npm start`) and update WebView URL
4. For production: Build React app (`npm run build`) and copy to `assets/build/`

## BLE Event Flow
1. Android scans for beacons (iBeacon/Eddystone)
2. Filters by device name (Gate, Kiosk, Elevator, Room)
3. Sends JSON events to React via JavaScript bridge
4. React processes events through bleBridge.js
5. Triggers same hotel actions (check-in, elevator access, etc.)

## Key Benefits
- Native BLE scanning (no Chrome flags needed)
- Better RSSI accuracy and range
- Works on all Android devices
- Minimal React code changes
- Same hotel workflow preserved