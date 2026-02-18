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
// Can be overridden by environment variables set via CONFIGURE_PROXIMITY.bat
// DEFAULT: Ultra-fast for MWC demo - 3 readings, 0.5s stability
export const SMOOTHED_CONFIG = {
  bufferSize: parseInt(process.env.REACT_APP_BLE_BUFFER_SIZE) || 3,        // Ultra-fast: 3 readings
  entryStabilityMs: parseInt(process.env.REACT_APP_BLE_ENTRY_STABILITY_MS) || 500,  // Ultra-fast: 0.5s
  exitStabilityMs: parseInt(process.env.REACT_APP_BLE_EXIT_STABILITY_MS) || 2000,    // 2 seconds
  entryThreshold: parseInt(process.env.REACT_APP_BLE_ENTRY_THRESHOLD) || -55,  // Strict: ~1 meter
  exitThreshold: parseInt(process.env.REACT_APP_BLE_EXIT_THRESHOLD) || -60     // Hysteresis
};

class ProximityConfig {
  constructor() {
    // Default to smoothed mode
    this.mode = DETECTION_MODES.SMOOTHED;
    this.directThresholds = { ...DIRECT_THRESHOLDS };
    this.smoothedConfig = { ...SMOOTHED_CONFIG };
    
    // Log configuration source
    if (process.env.REACT_APP_BLE_ENTRY_THRESHOLD) {
      console.log('[ProximityConfig] Using CUSTOM configuration from environment variables');
    } else {
      console.log('[ProximityConfig] Using DEFAULT configuration');
    }
    console.log('[ProximityConfig] Smoothed config:', this.smoothedConfig);
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
