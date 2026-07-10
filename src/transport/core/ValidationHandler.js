// =============================================================================
// ValidationHandler
// src/transport/core/ValidationHandler.js
//
// Manages the validation-required state lifecycle for a single journey/leg.
//
// States:
//   NOT_REQUIRED → initial state, no validation needed
//   PENDING      → validation triggered, awaiting response
//   SUCCESS      → validation passed, journey may proceed to billing
//   FAILED       → validation failed
//
// Validation methods (current):
//   MOCK         — simulated auto-resolve after configurable delay (demo)
//   NFC          — ISO 14443 / 15693 card tap at barrier (Android RfidNfcReader)
//
// Validation methods (future plug-in — no code changes to business logic):
//   BLE          — Bluetooth proximity confirmation
//   BARRIER_SCAN — QR or barcode scan at gate
//
// IMPORTANT:
//   - Does NOT affect CAMARA detection, pricing, or fraud checks
//   - Does NOT modify JourneyStateMachine
//   - Is instantiated per journey/leg — not a singleton
// =============================================================================

import decisionConfig from '../config/decisionConfig.json';

export const VALIDATION_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING:      'PENDING',
  SUCCESS:      'SUCCESS',
  FAILED:       'FAILED',
});

export const VALIDATION_METHOD = Object.freeze({
  MOCK:         'MOCK',
  NFC:          'NFC',          // ISO 14443-A/B, ISO 15693, FeliCa — card tap at barrier
  BLE:          'BLE',
  BARRIER_SCAN: 'BARRIER_SCAN',
  BIOMETRIC:    'BIOMETRIC',    // Android BiometricPrompt result
  UNKNOWN:      'UNKNOWN',
});

// Gap 3.4: Barrier interaction model — makes validation state visible to UI
// and ready for real barrier integration without any business logic changes.
export const ACCESS_STATE = Object.freeze({
  ALLOWED:                  'ALLOWED',                  // no validation needed
  BLOCKED_PENDING_VALIDATION: 'BLOCKED_PENDING_VALIDATION', // waiting for scan
  ALLOWED_AFTER_VALIDATION: 'ALLOWED_AFTER_VALIDATION', // passed validation
  BLOCKED_FAILED:           'BLOCKED_FAILED',           // validation failed
});

export class ValidationHandler {
  /**
   * @param {object}   [options]
   * @param {function} [options.onStatusChange] — callback(validationResult) on every state change
   */
  constructor({ onStatusChange = null } = {}) {
    this._onStatusChange = onStatusChange;
    this._status         = VALIDATION_STATUS.NOT_REQUIRED;
    this._method         = VALIDATION_METHOD.UNKNOWN;
    this._reason         = null;
    this._timestamp      = null;
    this._autoResolveTimer = null;
    // Gap 3.4: barrier state derived from validation status
    this._accessState    = ACCESS_STATE.ALLOWED;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Returns current validation result snapshot. */
  getResult() {
    return Object.freeze({
      validationRequired:  this._status !== VALIDATION_STATUS.NOT_REQUIRED,
      validationStatus:    this._status,
      validationMethod:    this._method,
      validationReason:    this._reason,
      validationTimestamp: this._timestamp,
      accessState:         this._accessState, // Gap 3.4
    });
  }

  getStatus() { return this._status; }

  /**
   * Transitions to PENDING — validation is required.
   * In demo mode, schedules an auto-resolve after demoAutoResolveMs.
   *
   * @param {string} reason         — human-readable reason from decision engine
   * @param {boolean} [autoResolve] — true in demo mode (default from config)
   */
  require(reason, autoResolve = true) {
    this._clearAutoResolve();
    this._status      = VALIDATION_STATUS.PENDING;
    this._method      = VALIDATION_METHOD.UNKNOWN;
    this._reason      = reason;
    this._timestamp   = new Date().toISOString();
    this._accessState = ACCESS_STATE.BLOCKED_PENDING_VALIDATION; // Gap 3.4
    this._notify();
    console.log(`[VALIDATION] Status=PENDING AccessState=BLOCKED_PENDING_VALIDATION Reason="${reason}"`);
    if (autoResolve && decisionConfig.validation?.demoAutoResolveMs > 0) {
      const delayMs = decisionConfig.validation.demoAutoResolveMs;
      const method  = decisionConfig.validation.demoAutoResolveMethod ?? 'MOCK';
      console.log(`[VALIDATION] Demo auto-resolve scheduled in ${delayMs}ms via ${method}`);
      this._autoResolveTimer = setTimeout(() => { this.resolve(method); }, delayMs);
    }
  }

  /**
   * Resolves validation as SUCCESS.
   * Called by: demo auto-resolve timer, or future RFID/BLE handler.
   *
   * @param {string} [method] — how validation was completed
   */
  resolve(method = VALIDATION_METHOD.MOCK) {
    this._clearAutoResolve();
    this._status      = VALIDATION_STATUS.SUCCESS;
    this._method      = method;
    this._timestamp   = new Date().toISOString();
    this._accessState = ACCESS_STATE.ALLOWED_AFTER_VALIDATION; // Gap 3.4
    this._notify();
    console.log(`[VALIDATION] Status=SUCCESS AccessState=ALLOWED_AFTER_VALIDATION Method=${method}`);
  }

  /**
   * Marks validation as FAILED.
   * @param {string} [reason]
   */
  fail(reason = 'Validation failed') {
    this._clearAutoResolve();
    this._status      = VALIDATION_STATUS.FAILED;
    this._timestamp   = new Date().toISOString();
    this._reason      = reason;
    this._accessState = ACCESS_STATE.BLOCKED_FAILED; // Gap 3.4
    this._notify();
    console.warn(`[VALIDATION] Status=FAILED AccessState=BLOCKED_FAILED Reason="${reason}"`);
  }

  /**
   * Manually triggers mock validation (demo "Simulate Pass Scan" button).
   * Safe to call at any time — no-op if not PENDING.
   */
  simulatePassScan() {
    if (this._status !== VALIDATION_STATUS.PENDING) return;
    this._clearAutoResolve();
    this.resolve(VALIDATION_METHOD.MOCK);
  }

  /** Cleans up any pending timers. Call on journey reset. */
  dispose() {
    this._clearAutoResolve();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  _clearAutoResolve() {
    if (this._autoResolveTimer) {
      clearTimeout(this._autoResolveTimer);
      this._autoResolveTimer = null;
    }
  }

  _notify() {
    if (typeof this._onStatusChange === 'function') {
      this._onStatusChange(this.getResult());
    }
  }
}
