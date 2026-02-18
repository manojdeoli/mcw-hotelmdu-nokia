// RSSI Signal Processing with Moving Average and State Stability
// Based on Oliver's recommendations for stable proximity detection

class RSSIProcessor {
  constructor(config = {}) {
    this.bufferSize = config.bufferSize || 3;       // Ultra-fast: 3 readings for demo
    this.entryStabilityMs = config.entryStabilityMs || 500;  // Ultra-fast: 0.5 second
    this.exitStabilityMs = config.exitStabilityMs || 2000;    // 2 seconds
    this.entryThreshold = config.entryThreshold || -55;  // Strict: Only very close proximity (~1 meter)
    this.exitThreshold = config.exitThreshold || -60;    // Hysteresis: 5dB gap
    
    // Per-beacon data storage
    this.beaconData = new Map();
    
    // Log configuration for debugging
    console.log('[RSSIProcessor] Initialized with config:', {
      bufferSize: this.bufferSize,
      entryStabilityMs: this.entryStabilityMs,
      exitStabilityMs: this.exitStabilityMs,
      entryThreshold: this.entryThreshold,
      exitThreshold: this.exitThreshold
    });
  }

  addReading(beaconName, rssi) {
    if (!this.beaconData.has(beaconName)) {
      this.beaconData.set(beaconName, {
        rssiBuffer: [],
        state: 'NOT_DETECTED',
        stateChangeTime: Date.now(),
        aboveThresholdSince: null,
        belowThresholdSince: null
      });
    }

    const data = this.beaconData.get(beaconName);
    
    // Add to buffer
    data.rssiBuffer.push({ rssi, timestamp: Date.now() });
    
    // Keep only last N readings
    if (data.rssiBuffer.length > this.bufferSize) {
      data.rssiBuffer.shift();
    }

    // Calculate moving average
    const avgRssi = this.getMovingAverage(beaconName);
    
    // Update state with stability logic
    this.updateState(beaconName, avgRssi);
    
    return {
      beaconName,
      rawRssi: rssi,
      avgRssi,
      state: data.state,
      bufferSize: data.rssiBuffer.length
    };
  }

  getMovingAverage(beaconName) {
    const data = this.beaconData.get(beaconName);
    if (!data || data.rssiBuffer.length === 0) return null;
    
    const sum = data.rssiBuffer.reduce((acc, reading) => acc + reading.rssi, 0);
    return sum / data.rssiBuffer.length;
  }

  updateState(beaconName, avgRssi) {
    const data = this.beaconData.get(beaconName);
    const now = Date.now();
    
    if (avgRssi >= this.entryThreshold) {
      // Signal is strong
      if (!data.aboveThresholdSince) {
        data.aboveThresholdSince = now;
      }
      data.belowThresholdSince = null;
      
      // Check if stable enough to enter DETECTED state
      if (data.state === 'NOT_DETECTED') {
        const stableDuration = now - data.aboveThresholdSince;
        if (stableDuration >= this.entryStabilityMs) {
          data.state = 'DETECTED';
          data.stateChangeTime = now;
        }
      }
    } else if (avgRssi <= this.exitThreshold) {
      // Signal is weak
      if (!data.belowThresholdSince) {
        data.belowThresholdSince = now;
      }
      data.aboveThresholdSince = null;
      
      // Check if stable enough to exit DETECTED state
      if (data.state === 'DETECTED') {
        const stableDuration = now - data.belowThresholdSince;
        if (stableDuration >= this.exitStabilityMs) {
          data.state = 'NOT_DETECTED';
          data.stateChangeTime = now;
        }
      }
    } else {
      // In hysteresis zone - maintain current state
      data.aboveThresholdSince = null;
      data.belowThresholdSince = null;
    }
  }

  isDetected(beaconName) {
    const data = this.beaconData.get(beaconName);
    return data ? data.state === 'DETECTED' : false;
  }

  // Get strongest beacon (highest RSSI) that meets threshold
  getStrongestBeacon() {
    let strongest = null;
    let highestRssi = -Infinity;
    
    for (const [beaconName, data] of this.beaconData.entries()) {
      const avgRssi = this.getMovingAverage(beaconName);
      if (avgRssi && avgRssi >= this.entryThreshold && avgRssi > highestRssi) {
        highestRssi = avgRssi;
        strongest = beaconName;
      }
    }
    
    return strongest;
  }

  getState(beaconName) {
    const data = this.beaconData.get(beaconName);
    return data ? data.state : 'NOT_DETECTED';
  }

  reset(beaconName) {
    if (beaconName) {
      this.beaconData.delete(beaconName);
    } else {
      this.beaconData.clear();
    }
  }

  // Cleanup old beacons not seen recently
  cleanup(maxAgeMs = 30000) {
    const now = Date.now();
    for (const [beaconName, data] of this.beaconData.entries()) {
      if (data.rssiBuffer.length > 0) {
        const lastReading = data.rssiBuffer[data.rssiBuffer.length - 1];
        if (now - lastReading.timestamp > maxAgeMs) {
          this.beaconData.delete(beaconName);
        }
      }
    }
  }
}

export default RSSIProcessor;
