# Fix Android App Deployment Issue

## Problem
App still uses cached AppCompatActivity despite code changes.

## Solution Steps

### 1. Uninstall App from Emulator
- Open emulator
- Long press "Hotel MDU" app icon
- Drag to "Uninstall" or click "App info" → Uninstall

### 2. Clear All Caches in Android Studio
- Build → Clean Project
- File → Invalidate Caches and Restart → Invalidate and Restart

### 3. Verify Files Are Correct
- MainActivity.java: extends Activity (not AppCompatActivity)
- AndroidManifest.xml: uses @style/AppTheme
- themes.xml: uses android:Theme.Material.Light
- build.gradle.kts: no AppCompat dependencies

### 4. Fresh Build and Deploy
- Build → Rebuild Project
- Run → Run 'app'

## Expected Result
App should launch successfully with WebView showing React UI.

## If Still Failing
Create new Android Studio project and copy files manually.