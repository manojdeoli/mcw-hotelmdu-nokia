// =============================================================================
// Journey State Machine
// src/transport/core/JourneyStateMachine.js
//
// Pure JavaScript — no React, no API, no app dependencies.
// Portable to any project that imports this file.
//
// States:   IDLE → IN_TRANSIT → COMPLETED | TIMED_OUT | ERROR
//
// Journey object ownership:
//   The Journey object is owned and persisted entirely by this class in
//   this._journey. The hook receives a frozen snapshot via onStateChange()
//   and copies it into React state — it does NOT hold the authoritative copy.
//   Fields: journeyId, status, entryEvent, exitEvent, chargeResult,
//           startedAt, completedAt, errorReason.
//
// Timeout ownership:
//   The exit timeout is managed exclusively by this class (_startExitTimeout,
//   _clearExitTimeout). The hook has no timeout logic. Timeout fires after
//   exitTimeoutMs ms with no exit event, transitioning to TIMED_OUT.
//
// Guard conditions enforced:
//   - Duplicate entry events ignored
//   - Exit without entry ignored
//   - Same-station exit allowed (base fare applied by PricingEngine)
//   - Timeout transitions to TIMED_OUT if no exit within window
// =============================================================================

export const JOURNEY_STATUS = Object.freeze({
  IDLE:       'IDLE',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED:  'COMPLETED',
  TIMED_OUT:  'TIMED_OUT',
  ERROR:      'ERROR',
});

export class JourneyStateMachine {
  /**
   * @param {object} options
   * @param {number} options.exitTimeoutMs   — ms to wait for exit before TIMED_OUT (default 30s)
   * @param {function} options.onStateChange — callback(journey) fired on every transition
   */
  constructor({ exitTimeoutMs = 30000, onStateChange = null } = {}) {
    this._exitTimeoutMs = exitTimeoutMs;
    this._onStateChange = onStateChange;
    this._timeoutHandle = null;
    this._journey = this._createEmptyJourney();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Returns a frozen snapshot of the current journey. */
  getJourney() {
    return Object.freeze({ ...this._journey });
  }

  /** Returns current status string. */
  getStatus() {
    return this._journey.status;
  }

  /**
   * Processes an entry event.
   * Guard: ignored if journey is already IN_TRANSIT or beyond.
   *
   * @param {object} entryEvent — { station, timestamp, detectionMethod }
   * @returns {boolean} true if transition occurred
   */
  onEntry(entryEvent) {
    if (this._journey.status !== JOURNEY_STATUS.IDLE) {
      console.warn(`[JourneyStateMachine] Entry ignored — current status: ${this._journey.status}`);
      return false;
    }

    this._journey = {
      ...this._journey,
      status:      JOURNEY_STATUS.IN_TRANSIT,
      entryEvent,
      startedAt:   entryEvent.timestamp,
    };

    this._startExitTimeout();
    this._notify();
    return true;
  }

  /**
   * Processes an exit event.
   * Guard: ignored if journey is not IN_TRANSIT.
   *
   * @param {object} exitEvent — { station, timestamp, detectionMethod }
   * @returns {boolean} true if transition occurred
   */
  onExit(exitEvent) {
    if (this._journey.status !== JOURNEY_STATUS.IN_TRANSIT) {
      console.warn(`[JourneyStateMachine] Exit ignored — current status: ${this._journey.status}`);
      return false;
    }

    this._clearExitTimeout();
    this._journey = {
      ...this._journey,
      status:      JOURNEY_STATUS.COMPLETED,
      exitEvent,
      completedAt: exitEvent.timestamp,
    };

    this._notify();
    return true;
  }

  /**
   * Resets the machine to IDLE for a new journey.
   */
  reset() {
    this._clearExitTimeout();
    this._journey = this._createEmptyJourney();
    this._notify();
  }

  /**
   * Transitions to ERROR with a reason message.
   * @param {string} reason
   */
  onError(reason) {
    this._clearExitTimeout();
    this._journey = {
      ...this._journey,
      status: JOURNEY_STATUS.ERROR,
      errorReason: reason,
    };
    this._notify();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  _createEmptyJourney() {
    return {
      journeyId:    `journey-${Date.now()}`,
      status:       JOURNEY_STATUS.IDLE,
      detectionMode: null,
      entryEvent:   null,
      exitEvent:    null,
      chargeResult: null,
      startedAt:    null,
      completedAt:  null,
      errorReason:  null,
    };
  }

  _startExitTimeout() {
    this._clearExitTimeout();
    this._timeoutHandle = setTimeout(() => {
      if (this._journey.status === JOURNEY_STATUS.IN_TRANSIT) {
        console.warn('[JourneyStateMachine] Exit timeout — transitioning to TIMED_OUT');
        this._journey = {
          ...this._journey,
          status:      JOURNEY_STATUS.TIMED_OUT,
          completedAt: new Date().toISOString(),
          errorReason: `No exit detected within ${this._exitTimeoutMs / 1000}s`,
        };
        this._notify();
      }
    }, this._exitTimeoutMs);
  }

  _clearExitTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  _notify() {
    if (typeof this._onStateChange === 'function') {
      this._onStateChange(this.getJourney());
    }
  }
}
