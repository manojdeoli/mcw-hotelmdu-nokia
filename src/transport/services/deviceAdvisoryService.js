// =============================================================================
// Device Advisory Service
// src/transport/services/deviceAdvisoryService.js
//
// Generates the advisory payload sent from backend to Android device.
//
// ARCHITECTURE CONTRACT:
//   Backend is the SINGLE SOURCE OF TRUTH for whether validation is needed.
//   The advisory is the ONLY interface between backend and device.
//   Device role: execute validation when validationRequired=true; report result.
//   Device does NOT decide whether to validate. Backend decides via correlation.
//
// CANONICAL MAPPING RULE (enforced here, nowhere else):
//   ambiguity === true  →  validationRequired = true,  validationSignal = 'AMBIGUOUS'
//   ambiguity === false →  validationRequired = false, validationSignal = 'CLEAR'
//
//   These two fields are ALWAYS derived from the same single boolean expression.
//   They can never contradict each other by construction.
//
// FIELDS INTENTIONALLY ABSENT FROM ADVISORY:
//   biometricCheckRequired  — device-internal; backend must not control this
//   biometricFreshnessMinutes — device-internal config; backend must not set this
//   rfDetectionRequired     — implicit from validationRequired; removed to avoid confusion
//   nfcEnabled              — device decides its own validation method (NFC, RFID, OTHER)
//   riskLevel               — unused by device for any decision; noise
//   validationWindowSeconds — device manages its own timing window
// =============================================================================

export class DeviceAdvisoryService {

  /**
   * Generate advisory payload for the Android device.
   *
   * All fields are derived from correlationResult and decisionResult only.
   * No device-control fields. No biometric fields.
   *
   * @param {object} correlationResult — from TransportCorrelationEngine
   * @param {object} decisionResult   — from TransportDecisionEngine
   * @param {string} journeyId
   * @param {string} deviceId
   * @returns {object} advisory payload
   */
  generateAdvisory(correlationResult, decisionResult, journeyId, deviceId, simulationOptions = null) {
    // ---------------------------------------------------------------------------
    // CANONICAL MAPPING RULE — single derivation point, always consistent.
    // Both validationRequired and validationSignal come from the same expression.
    // ---------------------------------------------------------------------------
    const ambiguity          = correlationResult.ambiguity === true;
    const validationRequired = ambiguity;
    const validationSignal   = ambiguity ? 'AMBIGUOUS' : 'CLEAR';

    const advisory = {
      journeyId,
      deviceId,
      stage: 'EXIT',
      validationRequired,
      validationSignal,
      correlationConfidence: correlationResult.correlationConfidence,
      ambiguity,
      inferredMode:          correlationResult.inferredMode,
      reason: ambiguity ? 'AMBIGUOUS_CORRELATION' : 'HIGH_CONFIDENCE',
      expiresInMs: 30000,
      timestamp: Date.now(),
    };

    // Attach simulation block only when explicitly provided (demo mode only).
    // Absent in production — device treats absent simulation field as no-op.
    if (simulationOptions != null) {
      advisory.simulation = simulationOptions;
    }

    console.log('[Advisory] Generated:', {
      journeyId,
      deviceId,
      stage:                advisory.stage,
      validationRequired:   advisory.validationRequired,
      validationSignal:     advisory.validationSignal,
      correlationConfidence: advisory.correlationConfidence,
      ambiguity:            advisory.ambiguity,
      inferredMode:         advisory.inferredMode,
      reason:               advisory.reason,
      simulation:           advisory.simulation ?? null,
    });

    return advisory;
  }

  /**
   * Determine if a journey should be auto-billed based on validation outcome.
   *
   * Rule: if validation was required but the device did not report SUCCESS,
   * defer billing to manual review. Any other combination proceeds to auto-bill.
   *
   * @param {boolean} validationRequired — was device validation required?
   * @param {string}  validationStatus   — 'SUCCESS' | 'FAILED' | 'NOT_REQUIRED'
   * @returns {{ autoBill: boolean, reason: string, action: string }}
   */
  shouldAutoBill(validationRequired, validationStatus) {
    if (validationRequired && validationStatus !== 'SUCCESS') {
      return {
        autoBill: false,
        reason:   'Validation required but not successful',
        action:   'MANUAL_REVIEW',
      };
    }
    return {
      autoBill: true,
      reason:   validationRequired ? 'Validation successful' : 'No validation required',
      action:   'AUTO_PROCESS',
    };
  }
}

export const deviceAdvisoryService = new DeviceAdvisoryService();
