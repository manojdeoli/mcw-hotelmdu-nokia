package com.hotel.blegateway;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import android.util.Log;
import org.json.JSONObject;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.SelectionKey;
import java.nio.channels.Selector;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class BLEGatewayService extends Service {
    private static final String TAG = "BLEGatewayService";
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "ble_gateway_channel";
    private static final int WEBSOCKET_PORT = 3001;
    
    private PowerManager.WakeLock wakeLock;
    private BluetoothLeScanner bleScanner;
    private boolean isScanning = false;
    private Thread wsServerThread;
    private volatile boolean isServerRunning = false;
    private Set<SocketChannel> wsClients = ConcurrentHashMap.newKeySet();
    
    private ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            try {
                String deviceName = result.getDevice().getName();
                if (deviceName == null) deviceName = "Unknown";
                
                if (deviceName.contains("MWC") || deviceName.contains("Hotel") || 
                    deviceName.contains("Gate") || deviceName.contains("Kiosk") ||
                    deviceName.contains("Elevator") || deviceName.contains("Room")) {
                    
                    JSONObject bleEvent = new JSONObject();
                    bleEvent.put("deviceId", result.getDevice().getAddress());
                    bleEvent.put("beaconName", deviceName);
                    bleEvent.put("rssi", result.getRssi());
                    bleEvent.put("zone", deviceName);
                    bleEvent.put("timestamp", System.currentTimeMillis());
                    
                    broadcastToClients(bleEvent.toString());
                    Log.d(TAG, "BLE Event: " + bleEvent.toString());
                }
            } catch (Exception e) {
                Log.e(TAG, "Error processing scan result", e);
            }
        }
    };
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "BLEGateway::WakeLock"
        );
        wakeLock.acquire();
        
        setupBluetooth();
        startWebSocketServer();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service started");
        
        createNotificationChannel();
        
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE
        );
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Hotel BLE Gateway")
            .setContentText("Scanning for beacons - Running in background")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
        
        startForeground(NOTIFICATION_ID, notification);
        startBLEScanning();
        
        return START_STICKY;
    }
    
    private void setupBluetooth() {
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            BluetoothAdapter bluetoothAdapter = bluetoothManager.getAdapter();
            if (bluetoothAdapter != null) {
                bleScanner = bluetoothAdapter.getBluetoothLeScanner();
            }
        }
    }
    
    private void startBLEScanning() {
        if (bleScanner != null && !isScanning) {
            try {
                ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .setReportDelay(0)
                    .build();
                bleScanner.startScan(null, settings, scanCallback);
                isScanning = true;
                Log.d(TAG, "BLE scanning started");
            } catch (SecurityException e) {
                Log.e(TAG, "Permission denied for BLE scanning", e);
            }
        }
    }
    
    private void stopBLEScanning() {
        if (bleScanner != null && isScanning) {
            try {
                bleScanner.stopScan(scanCallback);
                isScanning = false;
                Log.d(TAG, "BLE scanning stopped");
            } catch (SecurityException e) {
                Log.e(TAG, "Error stopping BLE scan", e);
            }
        }
    }
    
    private void startWebSocketServer() {
        isServerRunning = true;
        wsServerThread = new Thread(() -> {
            try {
                ServerSocketChannel serverChannel = ServerSocketChannel.open();
                serverChannel.bind(new InetSocketAddress(WEBSOCKET_PORT));
                serverChannel.configureBlocking(false);
                
                Selector selector = Selector.open();
                serverChannel.register(selector, SelectionKey.OP_ACCEPT);
                
                Log.d(TAG, "WebSocket server started on port " + WEBSOCKET_PORT);
                
                while (isServerRunning) {
                    selector.select(1000);
                    Set<SelectionKey> keys = selector.selectedKeys();
                    Iterator<SelectionKey> iterator = keys.iterator();
                    
                    while (iterator.hasNext()) {
                        SelectionKey key = iterator.next();
                        iterator.remove();
                        
                        if (key.isAcceptable()) {
                            SocketChannel client = serverChannel.accept();
                            client.configureBlocking(false);
                            wsClients.add(client);
                            Log.d(TAG, "WebSocket client connected");
                        }
                    }
                }
                
                serverChannel.close();
            } catch (IOException e) {
                Log.e(TAG, "WebSocket server error", e);
            }
        });
        wsServerThread.start();
    }
    
    private void broadcastToClients(String message) {
        for (SocketChannel client : wsClients) {
            try {
                if (client.isConnected()) {
                    ByteBuffer buffer = ByteBuffer.wrap(message.getBytes());
                    client.write(buffer);
                }
            } catch (IOException e) {
                wsClients.remove(client);
                try { client.close(); } catch (IOException ex) {}
            }
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Service destroyed");
        
        stopBLEScanning();
        
        isServerRunning = false;
        if (wsServerThread != null) {
            wsServerThread.interrupt();
        }
        
        for (SocketChannel client : wsClients) {
            try { client.close(); } catch (IOException e) {}
        }
        wsClients.clear();
        
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "BLE Gateway Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps BLE scanning running in background");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
