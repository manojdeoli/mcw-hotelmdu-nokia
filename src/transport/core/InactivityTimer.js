// =============================================================================
// InactivityTimer
// src/transport/core/InactivityTimer.js
//
// Pure JavaScript — no React, no app dependencies.
//
// Fires onTimeout if no leg is started within timeoutMs after the last
// leg completed. Reset by calling reset() when a new leg becomes active.
// Stopped by calling stop() when the trip ends normally.
// =============================================================================

export class InactivityTimer {
  /**
   * @param {object} options
   * @param {number}   options.timeoutMs  — ms of inactivity before timeout fires
   * @param {function} options.onTimeout  — callback fired on timeout
   */
  constructor({ timeoutMs, onTimeout }) {
    if (!onTimeout) throw new Error('[InactivityTimer] onTimeout is required');
    this._timeoutMs = timeoutMs;
    this._onTimeout = onTimeout;
    this._handle    = null;
    this._remaining = null; // for UI countdown
  }

  /** Starts or restarts the inactivity countdown. */
  start() {
    this._clear();
    this._startedAt = Date.now();
    this._handle = setTimeout(() => {
      this._handle    = null;
      this._remaining = 0;
      this._onTimeout();
    }, this._timeoutMs);
  }

  /** Resets the countdown — call when a new leg becomes active. */
  reset() {
    this.start();
  }

  /** Stops the timer — call when trip ends normally. */
  stop() {
    this._clear();
  }

  /**
   * Returns remaining ms until timeout, or null if not running.
   * Used by UI to show countdown warning.
   */
  getRemainingMs() {
    if (!this._handle || !this._startedAt) return null;
    const elapsed = Date.now() - this._startedAt;
    return Math.max(0, this._timeoutMs - elapsed);
  }

  _clear() {
    if (this._handle) {
      clearTimeout(this._handle);
      this._handle    = null;
      this._startedAt = null;
    }
  }
}
