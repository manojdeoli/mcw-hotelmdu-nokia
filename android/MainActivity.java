package com.hotel.mdu;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQUEST_CODE = 1;
    private WebView webView;
    private BluetoothLeScanner bleScanner;
    private boolean isScanning = false;
    
    private ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            try {
                String deviceName = result.getDevice().getName();
                if (deviceName == null) deviceName = "Unknown";
                
                // Filter for iBeacon/Eddystone or hotel beacons
                if (deviceName.contains("MWC") || deviceName.contains("Hotel") || 
                    deviceName.contains("Gate") || deviceName.contains("Kiosk") ||
                    deviceName.contains("Elevator") || deviceName.contains("Room")) {
                    
                    JSONObject bleEvent = new JSONObject();
                    bleEvent.put("deviceId", result.getDevice().getAddress());
                    bleEvent.put("deviceName", deviceName);
                    bleEvent.put("rssi", result.getRssi());
                    bleEvent.put("timestamp", System.currentTimeMillis());
                    
                    // Send to React via JavaScript bridge
                    runOnUiThread(() -> {
                        webView.evaluateJavascript(
                            "window.onBleEvent && window.onBleEvent('" + bleEvent.toString() + "');", 
                            null
                        );
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        setupWebView();
        setupBluetooth();
        requestPermissions();
    }

    private void setupWebView() {
        webView = findViewById(R.id.webview);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.addJavascriptInterface(new AndroidBLE(), "AndroidBLE");
        webView.setWebViewClient(new WebViewClient());
        
        // Load your React app (production build from assets)
        webView.loadUrl("file:///android_asset/build/index.html");
    }

    private void setupBluetooth() {
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter bluetoothAdapter = bluetoothManager.getAdapter();
        if (bluetoothAdapter != null) {
            bleScanner = bluetoothAdapter.getBluetoothLeScanner();
        }
    }

    private void requestPermissions() {
        String[] permissions = {
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        };
        
        ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
    }

    public class AndroidBLE {
        @JavascriptInterface
        public void startScan() {
            if (bleScanner != null && !isScanning && hasPermissions()) {
                ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build();
                bleScanner.startScan(null, settings, scanCallback);
                isScanning = true;
            }
        }

        @JavascriptInterface
        public void stopScan() {
            if (bleScanner != null && isScanning) {
                bleScanner.stopScan(scanCallback);
                isScanning = false;
            }
        }

        @JavascriptInterface
        public void requestScan() {
            // Perform single scan burst
            startScan();
            new android.os.Handler().postDelayed(() -> stopScan(), 3000);
        }
    }

    private boolean hasPermissions() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) 
               == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    protected void onDestroy() {
        if (isScanning) {
            bleScanner.stopScan(scanCallback);
        }
        super.onDestroy();
    }
}