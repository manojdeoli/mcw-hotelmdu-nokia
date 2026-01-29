// BLE Bridge for Android WebView communication
class BleBridge {
  constructor() {
    this.listeners = [];
    this.rssiHistory = new Map(); // For RSSI smoothing
    this.zoneThresholds = {
      GATE: -65,    // Strong signal at gate
      KIOSK: -70,   // Medium signal at kiosk  
      ELEVATOR: -75, // Weaker signal at elevator
      ROOM: -60     // Very strong at room door
    };
    
    // Setup Android bridge listener
    window.onBleEvent = this.handleBleEvent.bind(this);
  }

  // Subscribe to BLE events
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Handle incoming BLE events from Android
  handleBleEvent(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      const smoothedRssi = this.smoothRssi(data.deviceId, data.rssi);
      const zone = this.determineZone(data.deviceName, smoothedRssi);
      
      const event = {
        ...data,
        rssi: smoothedRssi,
        zone,
        timestamp: Date.now()
      };
      
      this.listeners.forEach(callback => callback(event));
    } catch (error) {
      console.error('BLE Bridge error:', error);
    }
  }

  // RSSI smoothing using moving average
  smoothRssi(deviceId, newRssi) {
    if (!this.rssiHistory.has(deviceId)) {
      this.rssiHistory.set(deviceId, []);
    }
    
    const history = this.rssiHistory.get(deviceId);
    history.push(newRssi);
    
    // Keep only last 3 readings
    if (history.length > 3) {
      history.shift();
    }
    
    return Math.round(history.reduce((sum, val) => sum + val, 0) / history.length);
  }

  // Determine zone based on beacon name and RSSI
  determineZone(deviceName, rssi) {
    const name = deviceName.toLowerCase();
    
    if (name.includes('gate') || name.includes('entry')) {
      return rssi > this.zoneThresholds.GATE ? 'GATE' : 'APPROACHING_GATE';
    }
    if (name.includes('kiosk') || name.includes('lobby')) {
      return rssi > this.zoneThresholds.KIOSK ? 'KIOSK' : 'APPROACHING_KIOSK';
    }
    if (name.includes('elevator') || name.includes('lift')) {
      return rssi > this.zoneThresholds.ELEVATOR ? 'ELEVATOR' : 'APPROACHING_ELEVATOR';
    }
    if (name.includes('room') || name.includes('door')) {
      return rssi > this.zoneThresholds.ROOM ? 'ROOM' : 'APPROACHING_ROOM';
    }
    
    return 'UNKNOWN';
  }

  // --- Android Interface Methods ---

  requestScan() {
    if (window.AndroidBLE && window.AndroidBLE.requestScan) {
      window.AndroidBLE.requestScan();
      return true;
    }
    return false;
  }

  startScan() {
    if (window.AndroidBLE && window.AndroidBLE.startScan) {
      window.AndroidBLE.startScan();
      return true;
    }
    return false;
  }

  stopScan() {
    if (window.AndroidBLE && window.AndroidBLE.stopScan) {
      window.AndroidBLE.stopScan();
      return true;
    }
    return false;
  }

  testConnection() {
    if (window.AndroidBLE && window.AndroidBLE.testConnection) {
      window.AndroidBLE.testConnection();
      return true;
    }
    return false;
  }
}

export default new BleBridge();

/*
  --- TESTING IN BROWSER (MOCK) ---
  To test the UI without the Android device, paste this into your Chrome Console:

  window.AndroidBLE = {
    startScan: () => {
      console.log("Android: Start Scan");
      // Simulate finding a beacon after 1.5 seconds
      setTimeout(() => {
        if (window.onBleEvent) {
          window.onBleEvent(JSON.stringify({
            deviceName: "MWC Entry Gate",
            deviceId: "mock-id-01",
            rssi: -60
          }));
        }
      }, 1500);
    },
    stopScan: () => console.log("Android: Stop Scan"),
    requestScan: () => console.log("Android: Request Scan"),
    testConnection: () => alert("Android Bridge Connected!")
  };
*/