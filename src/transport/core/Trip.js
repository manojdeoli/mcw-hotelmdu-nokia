// =============================================================================
// Trip
// src/transport/core/Trip.js
//
// Pure JavaScript data model — no React, no API, no app dependencies.
//
// Holds the full state of a composite trip:
//   - Ordered list of completed legs
//   - Accumulated fare across all legs
//   - Fraud flags from all leg checks
//   - Single billing result at end
//
// TripManager owns and mutates this object.
// useTrip receives frozen snapshots via onStateChange.
// =============================================================================

export const TRIP_STATUS = Object.freeze({
  IDLE:       'IDLE',
  ACTIVE:     'ACTIVE',
  BILLING:    'BILLING',
  COMPLETED:  'COMPLETED',
  TIMED_OUT:  'TIMED_OUT',
});

export const LEG_TYPE = Object.freeze({
  TRANSIT: 'TRANSIT',
  PARKING: 'PARKING',
});

export class Trip {
  constructor(currency = 'EUR') {
    this._currency = currency;
    this._reset();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getSnapshot() {
    return Object.freeze({
      tripId:           this._tripId,
      status:           this._status,
      startedAt:        this._startedAt,
      completedAt:      this._completedAt,
      legs:             Object.freeze([...this._legs]),
      activeLegIndex:   this._activeLegIndex,
      accumulatedFare:  this._accumulatedFare,
      currency:         this._currency,
      integrityChecks:  Object.freeze([...this._integrityChecks]),
      billingResult:    this._billingResult,
      inactivityReason: this._inactivityReason,
      // ── Hybrid Detection Model (Approach 1) — observability only ──
      entryConfidence:   this._entryConfidence,
      exitConfidence:    this._exitConfidence,
      // ── Phase 1: Correlation — observability only, no pricing impact ──
      correlationResult: this._correlationResult,
      // ── Phase 2: Decision + Validation — observability + billing gate ──
      decisionResult:       this._decisionResult,
      validationResult:     this._validationResult,
      // ── Phase 3: Explainability payload ──
      explainabilityPayload: this._explainabilityPayload,
    });
  }

  getStatus()          { return this._status; }
  getAccumulatedFare() { return this._accumulatedFare; }
  getLegCount()        { return this._legs.length; }

  start() {
    this._reset();
    this._status    = TRIP_STATUS.ACTIVE;
    this._startedAt = new Date().toISOString();
  }

  /**
   * Stores confidence metadata from the entry event.
   * Observability only — no effect on pricing or billing.
   * @param {object} confidenceResult — from computeTransportConfidence()
   */
  setEntryConfidence(confidenceResult) {
    this._entryConfidence = confidenceResult ? Object.freeze({ ...confidenceResult }) : null;
  }

  /**
   * Stores confidence metadata from the exit event.
   * Observability only — no effect on pricing or billing.
   * @param {object} confidenceResult — from computeTransportConfidence()
   */
  setExitConfidence(confidenceResult) {
    this._exitConfidence = confidenceResult ? Object.freeze({ ...confidenceResult }) : null;
  }

  /**
   * Stores correlation result for a leg or trip.
   * Phase 1 observability only — no effect on pricing or billing.
   * @param {object} result — from TransportCorrelationEngine.correlate()
   */
  setCorrelationResult(result) {
    this._correlationResult = result ? Object.freeze({ ...result }) : null;
  }

  /** Phase 2: Stores decision result. Observability + billing gate. */
  setDecisionResult(result) {
    this._decisionResult = result ? Object.freeze({ ...result }) : null;
  }

  /** Phase 2: Stores validation result. Observability only. */
  setValidationResult(result) {
    this._validationResult = result ? Object.freeze({ ...result }) : null;
  }

  /** Phase 3: Stores the assembled explainability payload. */
  setExplainabilityPayload(payload) {
    this._explainabilityPayload = payload ?? null;
  }

  addCompletedLeg(legResult) {
    // Strip the internal _journey reference — it's only used by LegRunner.runCorrelation()
    // and must not be frozen into the trip snapshot (circular refs, dead weight)
    const { _journey, ...legData } = legResult;
    this._legs.push(Object.freeze({ ...legData, legIndex: this._legs.length + 1 }));
    this._accumulatedFare = parseFloat(
      (this._accumulatedFare + (legResult.fare || 0)).toFixed(2)
    );
    this._activeLegIndex = null;
  }

  setActiveLegIndex(index) {
    this._activeLegIndex = index;
  }

  addIntegrityCheck(result) {
    this._integrityChecks.push(Object.freeze({ ...result }));
  }

  addFraudFlag(result) {
    // kept for backward compatibility with single-leg flow
    this._integrityChecks.push(Object.freeze({ ...result }));
  }

  setBilling(billingResult) {
    this._billingResult = Object.freeze({ ...billingResult });
    this._status        = TRIP_STATUS.COMPLETED;
    this._completedAt   = new Date().toISOString();
  }

  setBillingStatus(status) {
    this._status      = status;
    this._completedAt = new Date().toISOString();
  }

  setTimedOut(reason) {
    this._status           = TRIP_STATUS.TIMED_OUT;
    this._completedAt      = new Date().toISOString();
    this._inactivityReason = reason;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  _reset() {
    this._tripId           = `TXB-${Date.now()}`;
    this._status           = TRIP_STATUS.IDLE;
    this._startedAt        = null;
    this._completedAt      = null;
    this._legs             = [];
    this._activeLegIndex   = null;
    this._accumulatedFare  = 0;
    this._integrityChecks  = [];
    this._billingResult    = null;
    this._inactivityReason = null;
    // Hybrid Detection Model — confidence metadata (observability only)
    this._entryConfidence    = null;
    this._exitConfidence     = null;
    // Phase 1: Correlation metadata (observability only)
    this._correlationResult  = null;
    // Phase 2: Decision + Validation metadata
    this._decisionResult     = null;
    this._validationResult   = null;
    // Phase 3: Explainability payload
    this._explainabilityPayload = null;
  }
}
