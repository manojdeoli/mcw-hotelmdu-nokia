// =============================================================================
// Reachability Checker
// src/transport/core/ReachabilityChecker.js
//
// Pure JavaScript — no React, no app dependencies.
// Portable to any project that imports this file.
//
// Mirrors the healthcare use case pattern:
//   deviceStatus()       → checks reachability
//   deviceConnectivity() → checks connectivity status
//   createDeviceReachabilitySubscription() → subscription lifecycle
//
// At exit zone detection, before carrier billing:
//   1. Create reachability subscription (logged to API panel)
//   2. Check device reachability
//   3. If REACHABLE → proceed to billing immediately
//   4. If NOT REACHABLE → retry up to maxRetries with retryIntervalMs delay
//   5. If still unreachable after retries → DEFERRED (fallback fare logged)
//   6. Delete subscription on completion
//
// BILLING_STATUS values:
//   PENDING    — check not yet started
//   CHECKING   — reachability check in progress
//   REACHABLE  — device reachable, billing can proceed
//   RETRYING   — device unreachable, retrying
//   DEFERRED   — max retries exceeded, billing deferred
// =============================================================================

export const BILLING_STATUS = Object.freeze({
  PENDING:   'PENDING',
  CHECKING:  'CHECKING',
  REACHABLE: 'REACHABLE',
  RETRYING:  'RETRYING',
  DEFERRED:  'DEFERRED',
});

export class ReachabilityChecker {
  /**
   * @param {object} options
   * @param {object}   options.apiAdapter        — injected transport API adapter
   * @param {number}   [options.maxRetries]       — max retry attempts (default 3)
   * @param {number}   [options.retryIntervalMs]  — ms between retries (default 5000)
   * @param {function} [options.onStatusChange]   — callback(billingStatus, attempt)
   * @param {function} [options.logInteraction]   — API log callback
   */
  constructor({
    apiAdapter,
    maxRetries      = 3,
    retryIntervalMs = 5000,
    onStatusChange  = null,
    logInteraction  = null,
  }) {
    if (!apiAdapter) throw new Error('[ReachabilityChecker] apiAdapter is required');
    this._api            = apiAdapter;
    this._maxRetries     = maxRetries;
    this._retryIntervalMs = retryIntervalMs;
    this._onStatusChange = onStatusChange;
    this._log            = logInteraction;
    this._subId          = null;
  }

  /**
   * Checks device reachability before billing.
   * Creates a subscription, polls reachability with retries, cleans up subscription.
   *
   * @param {string} phoneNumber
   * @returns {Promise<{ status: BILLING_STATUS, attempts: number }>}
   */
  async checkBeforeBilling(phoneNumber) {
    // Create reachability subscription (mirrors healthcare pattern)
    const sub = await this._api.createReachabilitySubscription(phoneNumber, this._log);
    this._subId = sub.subscriptionId;

    this._notify(BILLING_STATUS.CHECKING, 0);

    let attempt = 0;
    let result  = BILLING_STATUS.DEFERRED;

    while (attempt <= this._maxRetries) {
      const status = await this._api.deviceReachability(phoneNumber, this._log);
      const isReachable = status.reachable === true || status.reachable === 'true';

      if (isReachable) {
        result = BILLING_STATUS.REACHABLE;
        this._notify(BILLING_STATUS.REACHABLE, attempt);
        break;
      }

      attempt++;
      if (attempt <= this._maxRetries) {
        this._notify(BILLING_STATUS.RETRYING, attempt);
        await this._delay(this._retryIntervalMs);
      }
    }

    if (result !== BILLING_STATUS.REACHABLE) {
      this._notify(BILLING_STATUS.DEFERRED, attempt);
    }

    // Always clean up subscription
    await this._api.deleteReachabilitySubscription(this._subId, this._log);
    this._subId = null;

    return { status: result, attempts: attempt };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  _notify(status, attempt) {
    if (typeof this._onStatusChange === 'function') {
      this._onStatusChange(status, attempt);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
