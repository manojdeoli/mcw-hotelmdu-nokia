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

// Get runtime proximity configuration - Check for runtime override first
function getRuntimeProximityConfig() {
  if (typeof window !== 'undefined' && window.PROXIMITY_CONFIG_OVERRIDE) {
    return window.PROXIMITY_CONFIG_OVERRIDE;
  } else if (typeof window !== 'undefined' && window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.proximityConfig) {
    return window.RUNTIME_CONFIG.proximityConfig;
  }
  return null;
}



// Smoothed detection configuration (new mode)
// Can be overridden by runtime configuration or environment variables
// DEFAULT: Ultra-fast for MWC demo - 3 readings, 0.5s stability
function getSmoothedConfig() {
  const runtimeConfig = getRuntimeProximityConfig();
  if (runtimeConfig) {
    return {
      bufferSize: parseInt(runtimeConfig.bufferSize) || 3,
      entryStabilityMs: parseInt(runtimeConfig.entryStabilityMs) || 500,
      exitStabilityMs: parseInt(runtimeConfig.exitStabilityMs) || 2000,
      entryThreshold: parseInt(runtimeConfig.entryThreshold) || -55,
      exitThreshold: parseInt(runtimeConfig.exitThreshold) || -60
    };
  }
  
  // Fallback to environment variables
  return {
    bufferSize: parseInt(process.env.REACT_APP_BLE_BUFFER_SIZE) || 3,        // Ultra-fast: 3 readings
    entryStabilityMs: parseInt(process.env.REACT_APP_BLE_ENTRY_STABILITY_MS) || 500,  // Ultra-fast: 0.5s
    exitStabilityMs: parseInt(process.env.REACT_APP_BLE_EXIT_STABILITY_MS) || 2000,    // 2 seconds
    entryThreshold: parseInt(process.env.REACT_APP_BLE_ENTRY_THRESHOLD) || -55,  // Strict: ~1 meter
    exitThreshold: parseInt(process.env.REACT_APP_BLE_EXIT_THRESHOLD) || -60     // Hysteresis
  };
}

export const SMOOTHED_CONFIG = getSmoothedConfig();

class ProximityConfig {
  constructor() {
    // Default to smoothed mode
    this.mode = DETECTION_MODES.SMOOTHED;
    this.directThresholds = { ...DIRECT_THRESHOLDS };
    this.devConfigCache = null;
    this.refreshConfig();
  }
  
  async refreshConfig() {
    const runtimeConfig = getRuntimeProximityConfig();
    if (runtimeConfig) {
      this.smoothedConfig = {
        bufferSize: parseInt(runtimeConfig.bufferSize) || 3,
        entryStabilityMs: parseInt(runtimeConfig.entryStabilityMs) || 500,
        exitStabilityMs: parseInt(runtimeConfig.exitStabilityMs) || 2000,
        entryThreshold: parseInt(runtimeConfig.entryThreshold) || -55,
        exitThreshold: parseInt(runtimeConfig.exitThreshold) || -60
      };
      return;
    }
    
    this.smoothedConfig = {
      bufferSize: parseInt(process.env.REACT_APP_BLE_BUFFER_SIZE) || 3,
      entryStabilityMs: parseInt(process.env.REACT_APP_BLE_ENTRY_STABILITY_MS) || 500,
      exitStabilityMs: parseInt(process.env.REACT_APP_BLE_EXIT_STABILITY_MS) || 2000,
      entryThreshold: parseInt(process.env.REACT_APP_BLE_ENTRY_THRESHOLD) || -55,
      exitThreshold: parseInt(process.env.REACT_APP_BLE_EXIT_THRESHOLD) || -60
    };
  }

  setMode(mode) {
    if (Object.values(DETECTION_MODES).includes(mode)) {
      this.mode = mode;
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

  updateDirectThresholds(thresholds) {
    this.directThresholds = { ...this.directThresholds, ...thresholds };
  }

  getDirectThresholds() {
    return this.directThresholds;
  }

  updateSmoothedConfig(config) {
    this.smoothedConfig = { ...this.smoothedConfig, ...config };
  }

  getSmoothedConfig() {
    this.refreshConfig();
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
