# Setup & Testing Guide

## Required Software

### 1. Android Studio
- Download: https://developer.android.com/studio
- Install with Android SDK (API 33)
- Enable USB Debugging on Android device

### 2. Node.js (Already have)
- Current React app uses Node.js

## Testing Steps

### Phase 1: Desktop Testing (Current)
```bash
# Test React app locally
npm start
# Access: http://localhost:3000
```

### Phase 2: Android Emulator Testing
1. Open Android Studio
2. Create new project: "Hotel MDU"
3. Copy android files to project
4. Run on emulator
5. WebView loads React from localhost:3000

### Phase 3: Device Testing
1. Enable Developer Options on Android phone
2. Enable USB Debugging
3. Connect phone via USB
4. Deploy app from Android Studio
5. Test with real BLE beacons

## Quick Start Commands

### React Build for Production
```bash
npm run build
# Copy build/ folder to android/app/src/main/assets/
```

### Android Studio Setup
1. File → New → New Project
2. Choose "Empty Activity"
3. Package name: com.hotel.mdu
4. Replace generated files with provided android files
5. Build → Make Project
6. Run → Run 'app'

## BLE Testing Without Beacons
- Use BLE simulator apps
- Mock beacon names: "Hotel_Gate", "Hotel_Kiosk", "Hotel_Elevator", "Hotel_Room"
- Test RSSI values: -60 to -80 dBm range

## Hybrid App Testing Strategy

### 1. Testing React Logic (Browser)
You don't need the Android device to test the UI flow.
1. Run `npm start`
2. Open Chrome DevTools (F12)
3. Paste the **Mock Snippet** found at the bottom of `src/bleBridge.js` into the console.
4. Click "Start Auto-Tracking" in the UI. The mock will simulate a beacon detection.

### 2. Testing Integration (Device)
1. If you changed **Java/Kotlin** code: Rebuild and Install APK.
2. If you changed **React** code (and use dev server): Just reload the app on the phone.

## Real-Time Multi-Device Testing Guide

**Scenario:** You have 3 mobile devices.
- **Device 1 & 2:** Will run the Hotel App (User A & User B).
- **Device 3:** Will act as the BLE Beacon Simulator (Triggering location changes).

### Step 1: Network Setup
1. Ensure your PC (running Node.js) and all 3 mobile devices are connected to the **same Wi-Fi network**.
2. Find your PC's local IP address:
   - Windows: Run `ipconfig` in terminal (look for IPv4 Address, e.g., `192.168.1.15`).
   - Mac/Linux: Run `ifconfig`.

### Step 2: Host the Web App
1. Run `npm start` on your PC.
2. Verify access: Open Chrome on Device 1 and navigate to `http://<YOUR_PC_IP>:3000`. The app should load.
   - *Note: If it doesn't load, check your PC's firewall settings.*

### Step 3: Configure & Install Android App
1. Open the Android project in Android Studio.
2. Navigate to the WebView configuration (usually `MainActivity.java`).
3. Update the URL to point to your PC: `webView.loadUrl("http://<YOUR_PC_IP>:3000");`.
4. **Important:** Ensure `AndroidManifest.xml` has `android:usesCleartextTraffic="true"` (required for HTTP).
5. Connect Device 1 via USB -> Build & Run.
6. Connect Device 2 via USB -> Build & Run.
7. Disconnect USBs. Both devices now have the app installed.

### Step 4: Setup Beacon Simulator (Device 3)
1. On Device 3, install a **Beacon Simulator** app (e.g., "Beacon Simulator" or "nRF Connect").
2. Configure it to broadcast/advertise a BLE signal.
3. **Crucial:** Set the **Device Name** (Local Name) to match the app's triggers:
   - **Gate:** "MWC Entry Gate"
   - **Kiosk:** "MWC Check-in Kiosk"
   - **Elevator:** "MWC Elevator Lift"
   - **Room:** "MWC Room Door"

### Step 5: Execute Test
1. Open the Hotel App on **Device 1** and **Device 2**.
2. Tap **"Start Auto-Tracking"** on both devices.
3. Bring **Device 3** (simulating "Entry Gate") close to Device 1 & 2.
4. **Result:** Both apps should detect the beacon and update the UI to "Hotel Entry Gate".
5. On Device 3, stop "Entry Gate" and start advertising "MWC Check-in Kiosk".
6. **Result:** Both apps should transition to "Check-in Kiosk" and trigger the Check-in logic.