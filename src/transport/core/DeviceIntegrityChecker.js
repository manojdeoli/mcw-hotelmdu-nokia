// =============================================================================
// DeviceIntegrityChecker
// src/transport/core/DeviceIntegrityChecker.js
//
// Pure JavaScript — no React, no app dependencies.
//
// Runs all three device integrity checks in parallel at any checkpoint:
//   1. SIM Swap      — CAMARA SIM Swap API
//   2. Device Swap   — CAMARA Device Swap API
//   3. Reachability  — CAMARA Device Reachability (single check, no retry)
//
// Used by LegRunner at ENTRY and EXIT of every leg in a trip.
// Returns a single IntegrityResult — never throws, always resolves.
//
// IntegrityResult.overallStatus:
//   PASS         — all three checks clean
//   WARN         — reachability uncertain but no swap detected
//   FRAUD        — SIM or device swap detected
//   CHECK_FAILED — one or more checks could not complete
// =============================================================================

export const INTEGRITY_STATUS = Object.freeze({
  PASS:         'PASS',
  WARN:         'WARN',
  FRAUD:        'FRAUD',
  CHECK_FAILED: 'CHECK_FAILED',
});

export class DeviceIntegrityChecker {
  /**
   * @param {object} options
   * @param {object}   options.apiAdapter       — transport API adapter
   * @param {function} [options.logInteraction] — API log callback
   */
  constructor({ apiAdapter, logInteraction = null }) {
    if (!apiAdapter) throw new Error('[DeviceIntegrityChecker] apiAdapter is required');
    this._api = apiAdapter;
    this._log = logInteraction;
  }

  /**
   * Runs SIM Swap + Device Swap + Reachability in parallel.
   * Always resolves — errors captured in result fields.
   *
   * @param {string} phoneNumber
   * @param {string} checkPoint — 'ENTRY' | 'EXIT' | label string
   * @returns {Promise<IntegrityResult>}
   */
  async check(phoneNumber, checkPoint) {
    const [simResult, deviceResult, reachResult] = await Promise.allSettled([
      this._api.simSwap(phoneNumber, this._log),
      this._api.deviceSwap(phoneNumber, this._log),
      this._api.deviceReachability(phoneNumber, this._log),
    ]);

    // SIM Swap
    const simSwapped  = simResult.status === 'fulfilled'
      ? simResult.value?.swapped === true
      : false;
    const simError    = simResult.status === 'rejected' ? simResult.reason?.message : null;

    // Device Swap
    const devSwapped  = deviceResult.status === 'fulfilled'
      ? deviceResult.value?.swapped === true
      : false;
    const devError    = deviceResult.status === 'rejected' ? deviceResult.reason?.message : null;

    // Reachability
    const reachValue  = reachResult.status === 'fulfilled' ? reachResult.value : null;
    const reachable   = reachValue != null
      ? (reachValue.reachable === true || reachValue.reachable === 'true')
      : null; // null = check failed / promise rejected
    const reachError  = reachResult.status === 'rejected' ? reachResult.reason?.message : null;

    // Overall status
    const anyFraud    = simSwapped || devSwapped;
    const anyError    = !!simError || !!devError || !!reachError;
    const reachWarn   = reachable === false; // explicitly unreachable

    let overallStatus;
    if (anyFraud)                         overallStatus = INTEGRITY_STATUS.FRAUD;
    else if (anyError)                    overallStatus = INTEGRITY_STATUS.CHECK_FAILED;
    else if (reachWarn)                   overallStatus = INTEGRITY_STATUS.WARN;
    else                                  overallStatus = INTEGRITY_STATUS.PASS;

    return Object.freeze({
      checkPoint,
      overallStatus,
      simSwapped,
      devSwapped,
      reachable,
      simError,
      devError,
      reachError,
      checkedAt: new Date().toISOString(),
    });
  }
}
