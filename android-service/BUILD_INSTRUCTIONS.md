# Android BLE Gateway - Build Instructions

## Prerequisites

1. **Install Android Studio**
   - Download from: https://developer.android.com/studio
   - Install with default settings

2. **Install Java Development Kit (JDK)**
   - Android Studio includes JDK, or download JDK 11 or higher

## Step-by-Step Build Process

### 1. Open Project in Android Studio

1. Launch Android Studio
2. Click **"Open"** (not "New Project")
3. Navigate to: `c:\My Work\OneDrive_1_15-1-2026\HotelMDU-Nokia\Hotel MDU\android-service`
4. Click **"OK"**

### 2. Create Project Structure (if needed)

If Android Studio shows errors about missing files, create this structure:

```
android-service/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       │   └── com/
│   │       │       └── hotel/
│   │       │           └── blegateway/
│   │       │               ├── MainActivity.java
│   │       │               └── BLEGatewayService.java
│   │       ├── res/
│   │       │   └── layout/
│   │       │       └── activity_main.xml
│   │       └── AndroidManifest.xml
│   └── build.gradle
├── build.gradle (project level)
└── settings.gradle
```

### 3. Sync Gradle Files

1. Android Studio will prompt: **"Gradle files have changed"**
2. Click **"Sync Now"**
3. Wait for sync to complete (may take 2-5 minutes first time)

### 4. Configure Build Settings

1. Go to **File → Project Structure**
2. Verify:
   - **Compile SDK Version**: 34
   - **Build Tools Version**: Latest
   - **Min SDK**: 21
   - **Target SDK**: 34

### 5. Build the APK

**Option A: Build APK (for testing)**
1. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait for build to complete
3. Click **"locate"** in the notification to find the APK
4. APK location: `android-service/app/build/outputs/apk/debug/app-debug.apk`

**Option B: Build Signed APK (for distribution)**
1. Go to **Build → Generate Signed Bundle / APK**
2. Select **APK**
3. Create or select keystore
4. Fill in key details
5. Select **release** build variant
6. Click **Finish**

### 6. Install on Android Device

**Via USB:**
1. Enable **Developer Options** on your Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
2. Enable **USB Debugging**:
   - Settings → Developer Options → USB Debugging
3. Connect phone via USB
4. Click **Run** (green play button) in Android Studio
5. Select your device from the list

**Via APK File:**
1. Copy `app-debug.apk` to your phone
2. Open the APK file on your phone
3. Allow installation from unknown sources if prompted
4. Tap **Install**

## Build Using Command Line (Alternative)

If you prefer command line:

```bash
cd "c:\My Work\OneDrive_1_15-1-2026\HotelMDU-Nokia\Hotel MDU\android-service"

# Build debug APK
gradlew assembleDebug

# Build release APK
gradlew assembleRelease

# Install on connected device
gradlew installDebug
```

## Troubleshooting

### Gradle Sync Failed
- Check internet connection (Gradle downloads dependencies)
- Try: **File → Invalidate Caches / Restart**

### SDK Not Found
- Go to **Tools → SDK Manager**
- Install Android SDK Platform 34
- Install Android SDK Build-Tools

### Build Failed - Missing Dependencies
- Open `build.gradle`
- Click **"Sync Now"** at the top
- Wait for dependencies to download

### Device Not Detected
- Ensure USB debugging is enabled
- Try different USB cable/port
- Install device drivers (if Windows)

## After Installation

1. Open the app on your phone
2. Grant all permissions:
   - Location (required for BLE)
   - Notifications (Android 13+)
   - Battery optimization exemption
3. Tap **"Start Service"**
4. Verify persistent notification appears
5. Test BLE beacon detection

## App Configuration

The app runs a WebSocket server on port **8765**. Ensure your React app connects to:
```
ws://<PHONE_IP_ADDRESS>:8765
```

Find phone IP: Settings → About Phone → Status → IP Address

## Next Steps

- Test beacon detection with BLE beacons
- Verify WebSocket connection from React app
- Test with phone locked (service should continue running)
- Check beacon filtering is working correctly
