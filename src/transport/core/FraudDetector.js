// =============================================================================
// FraudDetector
// src/transport/core/FraudDetector.js
//
// Pure JavaScript — no React, no app dependencies.
// Runs CAMARA SIM Swap and Device Swap checks at journey entry and exit.
// Returns a structured FraudResult — never throws, always resolves.
//
// Fraud scenarios detected:
//   SIM_SWAPPED    — SIM was replaced recently (identity hijack risk)
//   DEVICE_SWAPPED — Device changed recently (stolen phone risk)
//   CLEAN          — Both checks passed, identity consistent
//
// Used by useTransportJourney at:
//   - Entry: block journey start if fraud detected
//   - Exit:  flag result before billing; billing still runs but result is marked
// =============================================================================

export const FRAUD_STATUS = Object.freeze({
  CLEAN:          'CLEAN',
  SIM_SWAPPED:    'SIM_SWAPPED',
  DEVICE_SWAPPED: 'DEVICE_SWAPPED',
  BOTH_SWAPPED:   'BOTH_SWAPPED',
  CHECK_FAILED:   'CHECK_FAILED',
});

export class FraudDetector {
  /**
   * @param {object} options
   * @param {object}   options.apiAdapter     — injected transport API adapter
   * @param {function} [options.logInteraction] — optional API log callback
   */
  constructor({ apiAdapter, logInteraction = null }) {
    if (!apiAdapter) throw new Error('[FraudDetector] apiAdapter is required');
    this._api = apiAdapter;
    this._log = logInteraction;
  }

  /**
   * Runs SIM Swap + Device Swap checks for a phone number.
   * Always resolves — errors are captured in the result.
   *
   * @param {string} phoneNumber
   * @param {string} checkPoint — 'ENTRY' | 'EXIT' (for labelling only)
   * @returns {Promise<FraudResult>}
   */
  async check(phoneNumber, checkPoint = 'ENTRY') {
    let simResult   = null;
    let deviceResult = null;
    let simError    = null;
    let deviceError = null;

    try {
      simResult = await this._api.simSwap(phoneNumber, this._log);
    } catch (err) {
      simError = err.message;
    }

    try {
      deviceResult = await this._api.deviceSwap(phoneNumber, this._log);
    } catch (err) {
      deviceError = err.message;
    }

    const simSwapped    = simResult?.swapped    === true;
    const deviceSwapped = deviceResult?.swapped === true;
    const checkFailed   = !!simError || !!deviceError;

    let status;
    if (checkFailed)                    status = FRAUD_STATUS.CHECK_FAILED;
    else if (simSwapped && deviceSwapped) status = FRAUD_STATUS.BOTH_SWAPPED;
    else if (simSwapped)                  status = FRAUD_STATUS.SIM_SWAPPED;
    else if (deviceSwapped)               status = FRAUD_STATUS.DEVICE_SWAPPED;
    else                                  status = FRAUD_STATUS.CLEAN;

    return Object.freeze({
      checkPoint,
      status,
      isFraud:       status !== FRAUD_STATUS.CLEAN && status !== FRAUD_STATUS.CHECK_FAILED,
      simSwapped,
      deviceSwapped,
      simError,
      deviceError,
      checkedAt:     new Date().toISOString(),
    });
  }
}
