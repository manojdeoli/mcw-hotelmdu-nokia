// Proximity Detection Configuration
// Supports both Direct RSSI and Smoothed (Moving Average) detection modes

export const DETECTION_MODES = {
  DIRECT: 'DIRECT',           // Legacy: Direct RSSI comparison
  SMOOTHED: 'SMOOTHED'        // New: Moving average with stability
};

// Direct RSSI thresholds (legacy mode)
export const DIRECT_THRESHOLDS = {
  IMMEDIATE: -55,
  NEAR: -65,
  FAR: -75,
  OUT_OF_RANGE: -85
};

// Smoothed detection configuration (new mode)
export const SMOOTHED_CONFIG = {
  bufferSize: 15,              // Number of readings to average
  entryStabilityMs: 2000,      // Must stay above threshold for 2s to detect
  exitStabilityMs: 5000,       // Stay detected for 5s after signal drops
  entryThreshold: -70,         // RSSI threshold to enter proximity
  exitThreshold: -75           // RSSI threshold to exit (5dB hysteresis)
};

class ProximityConfig {
  constructor() {
    // Default to smoothed mode
    this.mode = DETECTION_MODES.SMOOTHED;
    this.directThresholds = { ...DIRECT_THRESHOLDS };
    this.smoothedConfig = { ...SMOOTHED_CONFIG };
  }

  setMode(mode) {
    if (Object.values(DETECTION_MODES).includes(mode)) {
      this.mode = mode;
      console.log(`[ProximityConfig] Detection mode set to: ${mode}`);
    }
  }

  getMode() {
    return this.mode;
  }

  isDirectMode() {
    return this.mode === DETECTION_MODES.DIRECT;
  }

  isSmoothedMode() {
    return this.mode === DETECTION_MODES.SMOOTHED;
  }

  // Update direct thresholds (for legacy mode)
  updateDirectThresholds(thresholds) {
    this.directThresholds = { ...this.directThresholds, ...thresholds };
    console.log('[ProximityConfig] Direct thresholds updated:', this.directThresholds);
  }

  getDirectThresholds() {
    return this.directThresholds;
  }

  // Update smoothed config (for new mode)
  updateSmoothedConfig(config) {
    this.smoothedConfig = { ...this.smoothedConfig, ...config };
    console.log('[ProximityConfig] Smoothed config updated:', this.smoothedConfig);
  }

  getSmoothedConfig() {
    return this.smoothedConfig;
  }

  // Get current active threshold for immediate proximity
  getImmediateThreshold() {
    return this.isDirectMode() 
      ? this.directThresholds.IMMEDIATE 
      : this.smoothedConfig.entryThreshold;
  }
}

// Singleton instance
const proximityConfig = new ProximityConfig();
export default proximityConfig;
