// BLE Bridge for Android WebView communication
// Gap 3.5 Fix: Extended to handle advisory events and device validation status
class BleBridge {
  constructor() {
    this.listeners = [];
    this.advisoryListeners = []; // Gap 3.5: Separate listeners for advisory events
    this.rssiHistory = new Map(); // For RSSI smoothing
    this.deviceStatus = { // Gap 3.5: Track device status for timeline
      deviceId: null,
      mode: 'HOTEL', // HOTEL | TRANSPORT
      isConnected: false,
      nearBarrier: false,
      bleSignal: null,
      lastValidation: null
    };
    
    this.zoneThresholds = {
      GATE: -65,    // Strong signal at gate
      KIOSK: -70,   // Medium signal at kiosk  
      ELEVATOR: -75, // Weaker signal at elevator
      ROOM: -60     // Very strong at room door
    };
    
    // Setup Android bridge listener
    window.onBleEvent = this.handleBleEvent.bind(this);
    // Gap 3.5: Setup advisory listener
    window.onAdvisoryEvent = this.handleAdvisoryEvent.bind(this);
  }

  // Subscribe to BLE events
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Gap 3.5 Fix: Subscribe to advisory events
  subscribeToAdvisory(callback) {
    this.advisoryListeners.push(callback);
    return () => {
      this.advisoryListeners = this.advisoryListeners.filter(cb => cb !== callback);
    };
  }

  // Gap 3.5 Fix: Get current device status for validation timeline
  getDeviceStatus() {
    return { ...this.deviceStatus };
  }

  // Handle incoming BLE events from Android
  handleBleEvent(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      const smoothedRssi = this.smoothRssi(data.deviceId, data.rssi);
      const zone = this.determineZone(data.deviceName, smoothedRssi);
      
      // Gap 3.5: Update device status
      this.deviceStatus.bleSignal = smoothedRssi;
      this.deviceStatus.nearBarrier = Math.abs(smoothedRssi) < 70; // Within 70dBm = near barrier
      
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

  // Gap 3.5 Fix: Handle advisory events from backend
  handleAdvisoryEvent(jsonData) {
    try {
      const advisory = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      console.log('[BLE Bridge] Advisory received:', advisory);
      
      // Update device status based on advisory
      this.deviceStatus.mode = advisory.validationRequired ? 'TRANSPORT' : 'HOTEL';
      this.deviceStatus.deviceId = advisory.deviceId;
      
      // Notify advisory listeners
      this.advisoryListeners.forEach(callback => callback(advisory));
      
      // Gap 4B: Send acknowledgement back to backend
      this.sendAdvisoryAck(advisory.journeyId, advisory.deviceId);
      
    } catch (error) {
      console.error('[BLE Bridge] Advisory handling error:', error);
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

  // Gap 4B Fix: Send advisory acknowledgement
  sendAdvisoryAck(journeyId, deviceId) {
    if (window.AndroidBLE && window.AndroidBLE.sendAdvisoryAck) {
      window.AndroidBLE.sendAdvisoryAck(JSON.stringify({
        journeyId,
        deviceId,
        ack: true,
        timestamp: Date.now()
      }));
    } else {
      // Fallback: Send ACK to backend directly
      this.sendAckToBackend(journeyId, deviceId);
    }
  }

  // Phase 2: Send ACK to backend via fetch API (fallback)
  async sendAckToBackend(journeyId, deviceId) {
    try {
      await fetch('/api/device/advisory-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId,
          deviceId,
          ack: true,
          timestamp: Date.now()
        })
      });
      console.log('[BLE Bridge] ACK sent to backend via API');
    } catch (error) {
      console.error('[BLE Bridge] ACK API error:', error);
    }
  }

  // Gap 3.5: Send validation result to backend
  sendValidationResult(journeyId, deviceId, validationStatus, method) {
    if (window.AndroidBLE && window.AndroidBLE.sendValidationResult) {
      const result = {
        journeyId,
        deviceId,
        validationStatus, // SUCCESS | FAILED
        method, // BLE | BIOMETRIC | NFC
        timestamp: Date.now()
      };
      
      // Update local device status
      this.deviceStatus.lastValidation = result;
      
      window.AndroidBLE.sendValidationResult(JSON.stringify(result));
      console.log('[BLE Bridge] Validation result sent:', result);
    } else {
      // Fallback: Send to backend directly via API
      this.sendValidationToBackend(journeyId, deviceId, validationStatus, method);
    }
  }

  // Phase 2: Send validation result to backend via fetch API (fallback)
  async sendValidationToBackend(journeyId, deviceId, validationStatus, method) {
    try {
      const response = await fetch('/api/device/validation-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          journeyId,
          validationStatus,
          method,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[BLE Bridge] Validation result sent to backend:', result);
        
        // Update local device status
        this.deviceStatus.lastValidation = {
          journeyId,
          deviceId,
          validationStatus,
          method,
          timestamp: Date.now()
        };
      } else {
        console.error('[BLE Bridge] Validation API failed:', await response.text());
      }
    } catch (error) {
      console.error('[BLE Bridge] Validation API error:', error);
    }
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