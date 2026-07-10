// =============================================================================
// ContextValidator
// src/transport/context/ContextValidator.js
//
// Pure JavaScript — no React, no app dependencies.
//
// Combines network signals (location, geofence) with Android context signals
// (mode, confidence, Bluetooth, motion, speed) to produce a validation result.
//
// Rules:
//   - Context NEVER blocks a journey — it only boosts confidence or flags
//   - Network result is always authoritative
//   - When context is unreliable, source is 'NETWORK_ONLY' — no change to flow
//   - All mode mappings and parking rules read from contextConfig.json
//
// Validation result shape:
// {
//   allow:      true,                          // always true — context never blocks
//   confidence: 0-100,                         // combined score
//   source:     'NETWORK_ONLY'                 // context unavailable/unreliable
//             | 'CONTEXT_BOOSTED'              // context confirms network signal
//             | 'CONTEXT_FLAGGED',             // context contradicts network signal
//   reason:     string,                        // human-readable, shown in log + UI
//
//   // ── Extended fields (Hybrid Detection Model — additive only) ──────────
//   contextConfidenceScore: number (0.0–1.0) | null,
//   derivedMovementProfile: {
//     speed:        number | null,
//     movementType: 'STATIONARY' | 'WALKING' | 'VEHICLE' | 'UNKNOWN',
//   } | null,
// }
// =============================================================================

import contextConfig from './contextConfig.json';

// ---------------------------------------------------------------------------
// Internal helper — derives a structured movement profile from context signals.
// Returns null when context is unavailable or unreliable.
// ---------------------------------------------------------------------------
function deriveMovementProfile(context, isReliable) {
  if (!isReliable || !context) return null;
  const signals = context.signals ?? {};
  const speed   = signals.speedAvailable ? (signals.speed ?? null) : null;

  let movementType = 'UNKNOWN';
  if (signals.motion === 'STILL')   movementType = 'STATIONARY';
  else if (signals.motion === 'WALKING') movementType = 'WALKING';
  else if (signals.motion === 'VEHICLE') movementType = 'VEHICLE';

  return Object.freeze({ speed, movementType });
}

// ---------------------------------------------------------------------------
// Internal helper — normalises confidence (0-100) to a 0.0–1.0 score.
// ---------------------------------------------------------------------------
function normaliseScore(confidence0to100) {
  return parseFloat((Math.min(100, Math.max(0, confidence0to100)) / 100).toFixed(2));
}

export class ContextValidator {

  // ---------------------------------------------------------------------------
  // Entry validation — called after Location Verification / Geofence confirms entry
  // ---------------------------------------------------------------------------

  /**
   * @param {string}  journeyType  — 'transit' | 'parking'
   * @param {object}  context      — from ContextManager.getCurrentContext()
   * @param {boolean} isReliable   — from ContextManager.isContextReliable()
   * @returns {ValidationResult}
   */
  validateEntry(journeyType, context, isReliable) {
    const movementProfile = deriveMovementProfile(context, isReliable);

    if (!isReliable || !context) {
      return this._networkOnly('Context unavailable — using network signals only');
    }

    const expectedModes = contextConfig.journeyTypeModes[journeyType] ?? [];
    const modeMatches   = expectedModes.includes(context.mode);

    if (modeMatches) {
      const boostedConfidence = Math.min(100, 70 + Math.round(context.confidence * 0.3));
      return {
        allow:                  true,
        confidence:             boostedConfidence,
        source:                 'CONTEXT_BOOSTED',
        reason:                 `Context confirms ${journeyType} entry — mode: ${context.mode} (${context.confidence}%)`,
        contextConfidenceScore: normaliseScore(boostedConfidence),
        derivedMovementProfile: movementProfile,
      };
    }

    return {
      allow:                  true,
      confidence:             50,
      source:                 'CONTEXT_FLAGGED',
      reason:                 `Context mode mismatch at entry — expected ${expectedModes.join('/')} but got ${context.mode} (${context.confidence}%) — proceeding with network signal`,
      contextConfidenceScore: normaliseScore(50),
      derivedMovementProfile: movementProfile,
    };
  }

  // ---------------------------------------------------------------------------
  // Mid-journey validation — called at ~50% route progress
  // ---------------------------------------------------------------------------

  validateMidJourney(journeyType, context, isReliable) {
    const movementProfile = deriveMovementProfile(context, isReliable);

    if (!isReliable || !context) {
      return this._networkOnly('Context unavailable mid-journey');
    }

    const expectedModes = contextConfig.journeyTypeModes[journeyType] ?? [];
    const modeMatches   = expectedModes.includes(context.mode);
    const signals       = context.signals ?? {};

    if (modeMatches) {
      const speedNote = signals.speedAvailable ? ` | speed: ${signals.speed?.toFixed(1)} km/h` : '';
      return {
        allow:                  true,
        confidence:             context.confidence,
        source:                 'CONTEXT_BOOSTED',
        reason:                 `Mid-journey context consistent — mode: ${context.mode}${speedNote}`,
        contextConfidenceScore: normaliseScore(context.confidence),
        derivedMovementProfile: movementProfile,
      };
    }

    // Walking mode during a vehicle journey is a strong anomaly signal
    if (context.mode === 'WALKING') {
      return {
        allow:                  true,
        confidence:             30,
        source:                 'CONTEXT_FLAGGED',
        reason:                 `Mid-journey anomaly — context shows WALKING during ${journeyType} journey — possible device separation`,
        contextConfidenceScore: normaliseScore(30),
        derivedMovementProfile: movementProfile,
      };
    }

    return {
      allow:                  true,
      confidence:             50,
      source:                 'CONTEXT_FLAGGED',
      reason:                 `Mid-journey context mismatch — mode: ${context.mode} for ${journeyType} journey`,
      contextConfidenceScore: normaliseScore(50),
      derivedMovementProfile: movementProfile,
    };
  }

  // ---------------------------------------------------------------------------
  // Exit validation — called before billing
  // ---------------------------------------------------------------------------

  validateExit(journeyType, context, isReliable) {
    const movementProfile = deriveMovementProfile(context, isReliable);

    if (!isReliable || !context) {
      return this._networkOnly('Context unavailable at exit — proceeding with network signal');
    }

    const expectedModes = contextConfig.journeyTypeModes[journeyType] ?? [];
    const modeMatches   = expectedModes.includes(context.mode);

    if (modeMatches) {
      return {
        allow:                  true,
        confidence:             context.confidence,
        source:                 'CONTEXT_BOOSTED',
        reason:                 `Exit context confirmed — mode: ${context.mode} (${context.confidence}%)`,
        contextConfidenceScore: normaliseScore(context.confidence),
        derivedMovementProfile: movementProfile,
      };
    }

    return {
      allow:                  true,
      confidence:             40,
      source:                 'CONTEXT_FLAGGED',
      reason:                 `Exit context mismatch — mode: ${context.mode} inconsistent with ${journeyType} — billing proceeds, flagged for review`,
      contextConfidenceScore: normaliseScore(40),
      derivedMovementProfile: movementProfile,
    };
  }

  // ---------------------------------------------------------------------------
  // Parking phone-to-car association
  // Uses bluetoothConnected + connectedDeviceName + motion signals to confirm
  // the phone is with the car, not just nearby.
  // ---------------------------------------------------------------------------

  /**
   * Validates that the phone is associated with the parked car.
   * Called at parking entry and exit.
   *
   * @param {'ENTRY'|'EXIT'} checkPoint
   * @param {object}  context    — from ContextManager.getCurrentContext()
   * @param {boolean} isReliable — from ContextManager.isContextReliable()
   * @returns {ParkingAssociationResult}
   */
  validateParkingAssociation(checkPoint, context, isReliable) {
    if (!isReliable || !context) {
      return {
        associated: true,   // assume associated when no context — don't block
        confidence: 50,
        source:     'NETWORK_ONLY',
        reason:     'No context signal — assuming phone is with vehicle',
      };
    }

    const signals = context.signals ?? {};
    const cfg     = contextConfig.parkingAssociation;

    if (checkPoint === 'ENTRY') {
      return this._validateParkingEntry(signals, cfg, context.confidence);
    }
    return this._validateParkingExit(signals, cfg, context.confidence);
  }

  // ---------------------------------------------------------------------------
  // Private — parking association helpers
  // ---------------------------------------------------------------------------

  _validateParkingEntry(signals, cfg, confidence) {
    // Strong association: Bluetooth connected to a named device (car stereo)
    if (signals.bluetoothConnected && signals.connectedDeviceName) {
      return {
        associated: true,
        confidence: Math.min(100, confidence + 20),
        source:     'CONTEXT_BOOSTED',
        reason:     `Phone connected to car Bluetooth: "${signals.connectedDeviceName}" — strong vehicle association`,
      };
    }

    // Moderate association: vehicle motion or CAR mode
    if (signals.motion === 'VEHICLE' || signals.motion === 'STILL') {
      return {
        associated: true,
        confidence,
        source:     'CONTEXT_BOOSTED',
        reason:     `Motion: ${signals.motion} — phone likely with vehicle`,
      };
    }

    // Weak: walking motion at entry — person may have walked to car park without car
    if (signals.motion === 'WALKING') {
      return {
        associated: true,   // still allow — don't block
        confidence: 40,
        source:     'CONTEXT_FLAGGED',
        reason:     `Walking motion at parking entry — phone may not be in vehicle`,
      };
    }

    return {
      associated: true,
      confidence: 50,
      source:     'NETWORK_ONLY',
      reason:     'Insufficient context signals for vehicle association',
    };
  }

  _validateParkingExit(signals, cfg, confidence) {
    // Strong exit signal: Bluetooth disconnected (person left car)
    if (cfg.bluetoothDisconnectIsExit && !signals.bluetoothConnected) {
      return {
        associated: false,  // person has left the car
        confidence: Math.min(100, confidence + 15),
        source:     'CONTEXT_BOOSTED',
        reason:     'Bluetooth disconnected — person has left the vehicle',
      };
    }

    // Walking motion = person left car
    if (cfg.walkingMotionIsPersonLeft && signals.motion === 'WALKING') {
      return {
        associated: false,
        confidence,
        source:     'CONTEXT_BOOSTED',
        reason:     `Walking motion detected — person has left the vehicle`,
      };
    }

    // Vehicle motion = car is moving = genuine exit
    if (cfg.requiredMotionWhenExiting.includes(signals.motion)) {
      return {
        associated: true,
        confidence: Math.min(100, confidence + 10),
        source:     'CONTEXT_BOOSTED',
        reason:     `Vehicle motion at exit — car is moving out`,
      };
    }

    // Still + Bluetooth connected = still parked, not exiting
    if (signals.motion === 'STILL' && signals.bluetoothConnected) {
      return {
        associated: true,
        confidence: 60,
        source:     'CONTEXT_FLAGGED',
        reason:     `Still + Bluetooth connected — car may still be parked, not exiting`,
      };
    }

    return {
      associated: true,
      confidence: 50,
      source:     'NETWORK_ONLY',
      reason:     'Insufficient context signals for exit association',
    };
  }

  _networkOnly(reason) {
    return {
      allow:                  true,
      confidence:             50,
      source:                 'NETWORK_ONLY',
      reason,
      contextConfidenceScore: null,
      derivedMovementProfile: null,
    };
  }
}

// Singleton
export const contextValidator = new ContextValidator();
