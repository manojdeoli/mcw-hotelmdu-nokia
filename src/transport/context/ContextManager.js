// =============================================================================
// ContextManager
// src/transport/context/ContextManager.js
//
// Pure JavaScript — no React, no app dependencies.
//
// Receives context events streamed from the Android app via WebSocket and
// maintains the latest context state. Provides reliability checks based on
// confidence threshold and staleness window from contextConfig.json.
//
// Context event format (from Android ContextEvent.java):
// {
//   "eventType": "context",
//   "data": {
//     "mode": "CAR" | "TRANSIT" | "WALKING" | "UNCERTAIN",
//     "confidence": 0-100,
//     "signals": {
//       "bluetoothConnected": boolean,
//       "connectedDeviceName": string | null,
//       "speed": number,           // km/h
//       "speedAvailable": boolean,
//       "motion": "STILL" | "WALKING" | "VEHICLE" | "UNKNOWN",
//       "bleProximity": boolean
//     },
//     "timestamp": number          // epoch ms from Android
//   }
// }
//
// Fallback: if no context event received, or last event is stale or
// low-confidence, isContextReliable() returns false and the system falls
// back to network-only logic — zero impact on existing behaviour.
// =============================================================================

import contextConfig from './contextConfig.json';

export class ContextManager {
  constructor() {
    this._context   = null;
    this._listeners = [];
  }

  // ---------------------------------------------------------------------------
  // Event ingestion — called by gatewayClient when eventType === 'context'
  // ---------------------------------------------------------------------------

  updateContext(contextData) {
    this._context = { ...contextData, receivedAt: Date.now() };
    this._notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getCurrentContext() { return this._context; }
  getMode()           { return this._context?.mode       ?? null; }
  getConfidence()     { return this._context?.confidence ?? 0;    }
  getSignals()        { return this._context?.signals    ?? null; }

  /**
   * Returns true when context is reliable enough to influence decisions.
   * Requires: received + confidence >= threshold + not stale + mode !== UNCERTAIN.
   * When false the system falls back to network-only logic unchanged.
   */
  isContextReliable() {
    if (!this._context) return false;
    const ageMs = Date.now() - (this._context.timestamp ?? 0);
    return (
      (this._context.confidence ?? 0) >= contextConfig.confidenceThreshold &&
      ageMs <= contextConfig.staleThresholdMs &&
      this._context.mode !== 'UNCERTAIN'
    );
  }

  /**
   * Human-readable status for the UI badge.
   * 'RELIABLE' | 'UNCERTAIN' | 'STALE' | 'NO_SIGNAL'
   */
  getReliabilityStatus() {
    if (!this._context) return 'NO_SIGNAL';
    const ageMs = Date.now() - (this._context.timestamp ?? 0);
    if (ageMs > contextConfig.staleThresholdMs)                        return 'STALE';
    if (this._context.mode === 'UNCERTAIN')                            return 'UNCERTAIN';
    if ((this._context.confidence ?? 0) < contextConfig.confidenceThreshold) return 'UNCERTAIN';
    return 'RELIABLE';
  }

  // ---------------------------------------------------------------------------
  // Listener management — for React state updates
  // ---------------------------------------------------------------------------

  addListener(fn)    { this._listeners.push(fn); }
  removeListener(fn) { this._listeners = this._listeners.filter(l => l !== fn); }
  _notifyListeners() { this._listeners.forEach(fn => { try { fn(this._context); } catch (_) {} }); }
}

// Singleton — shared across the entire transport module
export const contextManager = new ContextManager();
