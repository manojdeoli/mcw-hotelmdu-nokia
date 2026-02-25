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
  // Check for runtime override from server injection
  if (typeof window !== 'undefined' && window.PROXIMITY_CONFIG_OVERRIDE) {
    console.log('[ProximityConfig] Using runtime override config:', window.PROXIMITY_CONFIG_OVERRIDE);
    return window.PROXIMITY_CONFIG_OVERRIDE;
  } else if (typeof window !== 'undefined' && window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.proximityConfig) {
    console.log('[ProximityConfig] Using runtime config:', window.RUNTIME_CONFIG.proximityConfig);
    return window.RUNTIME_CONFIG.proximityConfig;
  }
  return null;
}

// Async function to fetch development mode configuration
async function fetchDevConfig() {
  try {
    const response = await fetch('/api/proximity-config');
    if (response.ok) {
      const data = await response.json();
      if (data.proximityConfig) {
        console.log('[ProximityConfig] Fetched dev config:', data.proximityConfig);
        return data.proximityConfig;
      }
    }
  } catch (error) {
    console.log('[ProximityConfig] Dev config fetch failed:', error.message);
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
    this.lastDevConfigFetch = 0;
    this.refreshConfig();
  }
  
  // Refresh configuration from runtime sources
  async refreshConfig() {
    // Try runtime config first
    const runtimeConfig = getRuntimeProximityConfig();
    if (runtimeConfig) {
      this.smoothedConfig = {
        bufferSize: parseInt(runtimeConfig.bufferSize) || 3,
        entryStabilityMs: parseInt(runtimeConfig.entryStabilityMs) || 500,
        exitStabilityMs: parseInt(runtimeConfig.exitStabilityMs) || 2000,
        entryThreshold: parseInt(runtimeConfig.entryThreshold) || -55,
        exitThreshold: parseInt(runtimeConfig.exitThreshold) || -60
      };
      console.log('[ProximityConfig] Using RUNTIME configuration');
      console.log('[ProximityConfig] Smoothed config:', this.smoothedConfig);
      return;
    }
    
    // Try development mode API fetch (with caching)
    const now = Date.now();
    if (now - this.lastDevConfigFetch > 1000) { // Cache for 1 second
      this.lastDevConfigFetch = now;
      const devConfig = await fetchDevConfig();
      if (devConfig) {
        this.devConfigCache = devConfig;
      }
    }
    
    if (this.devConfigCache) {
      this.smoothedConfig = {
        bufferSize: parseInt(this.devConfigCache.bufferSize) || 3,
        entryStabilityMs: parseInt(this.devConfigCache.entryStabilityMs) || 500,
        exitStabilityMs: parseInt(this.devConfigCache.exitStabilityMs) || 2000,
        entryThreshold: parseInt(this.devConfigCache.entryThreshold) || -55,
        exitThreshold: parseInt(this.devConfigCache.exitThreshold) || -60
      };
      console.log('[ProximityConfig] Using DEV API configuration');
      console.log('[ProximityConfig] Smoothed config:', this.smoothedConfig);
      return;
    }
    
    // Fallback to environment variables
    this.smoothedConfig = {
      bufferSize: parseInt(process.env.REACT_APP_BLE_BUFFER_SIZE) || 3,
      entryStabilityMs: parseInt(process.env.REACT_APP_BLE_ENTRY_STABILITY_MS) || 500,
      exitStabilityMs: parseInt(process.env.REACT_APP_BLE_EXIT_STABILITY_MS) || 2000,
      entryThreshold: parseInt(process.env.REACT_APP_BLE_ENTRY_THRESHOLD) || -55,
      exitThreshold: parseInt(process.env.REACT_APP_BLE_EXIT_THRESHOLD) || -60
    };
    
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
    // Always refresh to get latest runtime config
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
