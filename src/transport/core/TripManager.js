// =============================================================================
// TripManager
// src/transport/core/TripManager.js
//
// Pure JavaScript — no React, no app dependencies.
//
// Orchestrates the full composite trip lifecycle:
//   - Starts and tracks legs via LegRunner
//   - Accumulates fares in Trip
//   - Manages InactivityTimer between legs
//   - Triggers single Carrier Billing call at end of trip
//   - Notifies React via onStateChange on every transition
// =============================================================================

import { Trip, TRIP_STATUS, LEG_TYPE } from './Trip.js';
import { LegRunner }                   from './LegRunner.js';
import { InactivityTimer }             from './InactivityTimer.js';
import { decide, DECISION_OUTCOME }    from './TransportDecisionEngine.js';
import { ValidationHandler,
         VALIDATION_STATUS }           from './ValidationHandler.js';
import tripConfig                      from '../config/tripConfig.json';
import decisionConfig                  from '../config/decisionConfig.json';
import { createTransportApiAdapter }   from '../api/transportApiAdapter.js';

export { TRIP_STATUS, LEG_TYPE };

export class TripManager {
  /**
   * @param {object} options
   * @param {string}   options.phoneNumber      — verified phone number
   * @param {function} options.onStateChange    — callback(tripSnapshot) on every change
   * @param {function} options.onLegProgress    — callback(progress 0-1) during active leg
   * @param {function} options.onLog            — activity log callback
   * @param {function} options.logApiInteraction — API log callback
   * @param {boolean}  [options.demoMode]       — use short inactivity timeout
   */
  constructor({ phoneNumber, onStateChange, onLegProgress, onLog, logApiInteraction, demoMode = true }) {
    this._phone       = phoneNumber;
    this._notify      = onStateChange  || (() => {});
    this._onProgress  = onLegProgress  || (() => {});
    this._onLog       = onLog          || (() => {});
    this._logApi      = logApiInteraction;
    this._demoMode    = demoMode;

    this._trip        = new Trip(tripConfig.currency);
    this._apiAdapter  = createTransportApiAdapter();
    this._legRunner   = null;
    this._activeLegDef = null;
    this._reachSubId  = null;
    // Phase 2: per-trip validation handler
    this._validationHandler = null;
    this._pendingBillingReason = null; // set when bill is deferred awaiting validation

    const timeoutMs = demoMode
      ? tripConfig.demoInactivityTimeoutMs
      : tripConfig.inactivityTimeoutMs;

    this._timer = new InactivityTimer({
      timeoutMs,
      onTimeout: () => this._handleInactivityTimeout(),
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getSnapshot()        { return this._trip.getSnapshot(); }
  getTimerRemainingMs(){ return this._timer.getRemainingMs(); }

  /** Starts a new trip — runs pre-trip integrity gate first. */
  async startTrip() {
    this._trip.start();
    this._onLog(`Trip ${this._trip.getSnapshot().tripId} started`);

    // Steps a–c: Number Verification + SIM Swap + Device Swap before first leg
    this._onLog('Trip: [a] Number Verification...');
    this._logApi && this._logApi(
      'Number Verification (Trip)',
      'POST', '/number-verification/verify',
      { phoneNumber: this._phone },
      { devicePhoneNumberVerified: true, note: 'Confirmed at trip start' }
    );
    this._onLog('Trip: [a] Number Verification — confirmed ✓');

    this._onLog('Trip: [b] SIM Swap check...');
    const simResult = await this._apiAdapter.simSwap(this._phone, this._logApi);
    this._onLog(`Trip: [b] SIM Swap — ${simResult.swapped ? '⚠ SWAPPED' : 'Clean ✓'}`);

    this._onLog('Trip: [c] Device Swap check...');
    const devResult = await this._apiAdapter.deviceSwap(this._phone, this._logApi);
    this._onLog(`Trip: [c] Device Swap — ${devResult.swapped ? '⚠ SWAPPED' : 'Clean ✓'}`);

    const preTripCheck = {
      checkPoint:    'PRE-TRIP',
      simSwapped:    simResult.swapped,
      devSwapped:    devResult.swapped,
      overallStatus: simResult.swapped || devResult.swapped ? 'FRAUD' : 'PASS',
    };
    this._trip.addIntegrityCheck(preTripCheck);

    // Step e: Reachability Subscription for entire trip duration
    this._onLog('Trip: [e] Creating Reachability Subscription for trip duration...');
    try {
      const sub = await this._apiAdapter.createReachabilitySubscription(this._phone, this._logApi);
      this._reachSubId = sub.subscriptionId;
      this._onLog(`Trip: [e] Reachability Subscription active (${sub.subscriptionId})`);

      // Step f: optional status check
      const status = await this._apiAdapter.deviceReachability(this._phone, this._logApi);
      this._onLog(`Trip: [f] Device reachable: ${status.reachable ? 'Yes ✓' : 'No ⚠'} — ${status.connectivityStatus}`);
    } catch (err) {
      this._onLog(`Trip: [e] Reachability Subscription failed — ${err.message}`);
    }

    this._timer.start();
    this._notify(this._trip.getSnapshot());
  }

  /**
   * Starts a new leg within the active trip.
   * @param {object} legDef — { type, entryStation, exitStation, simulatedDurationMinutes? }
   */
  async startLeg(legDef) {
    if (this._trip.getStatus() !== TRIP_STATUS.ACTIVE) return;
    if (this._trip.getLegCount() >= tripConfig.maxLegsPerTrip) {
      this._onLog('Trip: Maximum legs reached');
      return;
    }

    this._timer.reset(); // reset inactivity countdown
    this._activeLegDef = legDef;
    this._trip.setActiveLegIndex(this._trip.getLegCount() + 1);
    this._notify(this._trip.getSnapshot());

    const label = legDef.type === LEG_TYPE.TRANSIT
      ? `${legDef.entryStation.name} → ${legDef.exitStation.name}`
      : `${legDef.entryStation.name} (parking)`;
    this._onLog(`Trip: Starting leg ${this._trip.getLegCount() + 1} — ${label}`);

    this._legRunner = new LegRunner({
      apiAdapter:        this._apiAdapter,
      onProgress:        (p) => this._onProgress(p),
      onLog:             (msg) => this._onLog(msg),
      onIntegrityCheck:  (result) => {
        this._trip.addIntegrityCheck(result);
        this._notify(this._trip.getSnapshot());
      },
      logInteraction:    this._logApi,
    });

    try {
      const rawLegResult = await this._legRunner.run(legDef, this._phone);
      // Phase 1: correlation post-pricing
      const legResult = await this._legRunner.runCorrelation(
        rawLegResult,
        legDef.entryStation,
        legDef.exitStation,
        legDef.simulatedDurationMinutes ?? null,
        rawLegResult._journey ?? {}
      );
      this._trip.addCompletedLeg(legResult);
      if (legResult.correlationResult) {
        this._trip.setCorrelationResult(legResult.correlationResult);
      }
      this._onLog(
        `Trip: Leg complete — ${legResult.ruleLabel} — ` +
        `${tripConfig.currency} ${(legResult.fare ?? 0).toFixed(2)}` +
        (legResult.isFree ? ' (FREE)' : '')
      );
      this._onLog(`Trip: Accumulated fare — ${tripConfig.currency} ${this._trip.getAccumulatedFare().toFixed(2)}`);

      // Phase 2: decision gate
      if (decisionConfig.decisionEnabled && legResult.correlationResult) {
        const decisionResult = decide({
          correlationResult: legResult.correlationResult,
          confidenceResult:  null,
        });
        this._trip.setDecisionResult(decisionResult);
        this._onLog(
          `Trip: [DECISION] ${decisionResult.finalDecision} ` +
          `Mode=${decisionResult.finalMode} ` +
          `Confidence=${decisionResult.decisionConfidence}`
        );
        decisionResult.decisionReasoning.forEach(r =>
          this._onLog(`Trip: [DECISION] └ ${r}`)
        );

        if (decisionResult.requiresValidation &&
            decisionConfig.validation?.holdEntireTripOnAmbiguousLeg) {
          this._onLog(
            `Trip: [DECISION] Validation required — entire trip bill held ` +
            `(holdEntireTripOnAmbiguousLeg=true)`
          );
          this._pendingBillingReason = decisionResult.validationReason;

          this._validationHandler = new ValidationHandler({
            onStatusChange: (vResult) => {
              this._trip.setValidationResult(vResult);
              this._notify(this._trip.getSnapshot());
              if (vResult.validationStatus === VALIDATION_STATUS.SUCCESS &&
                  this._pendingBillingReason !== null) {
                this._onLog(
                  `Trip: [VALIDATION] ${vResult.validationMethod} passed — ` +
                  `releasing deferred billing`
                );
                this._pendingBillingReason = null;
                this._bill('VALIDATION_RESOLVED');
              }
            },
          });
          this._validationHandler.require(decisionResult.validationReason, true);
          this._trip.setValidationResult(this._validationHandler.getResult());
        }
      }

      this._activeLegDef = null;
      this._timer.start();
      this._notify(this._trip.getSnapshot());
    } catch (err) {
      this._onLog(`Trip: Leg failed — ${err.message}`);
      this._activeLegDef = null;
      this._notify(this._trip.getSnapshot());
    }
  }

  /** Customer explicitly ends the trip and triggers billing. */
  async endTrip() {
    if (this._trip.getStatus() !== TRIP_STATUS.ACTIVE) return;
    this._timer.stop();
    await this._bill('CUSTOMER_ENDED');
  }

  /** Stops any active leg without ending the trip. */
  stopActiveLeg() {
    this._legRunner?.stop();
    this._activeLegDef = null;
  }

  /** Phase 2: Manually resolve pending validation (demo 'Simulate Pass Scan' button). */
  simulatePassScan() {
    this._validationHandler?.simulatePassScan();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  async _handleInactivityTimeout() {
    if (this._trip.getStatus() !== TRIP_STATUS.ACTIVE) return;
    const timeoutSec = (this._demoMode
      ? tripConfig.demoInactivityTimeoutMs
      : tripConfig.inactivityTimeoutMs) / 1000;
    this._onLog(`Trip: Inactivity timeout after ${timeoutSec}s — auto-closing trip`);
    this._trip.setTimedOut(`No activity for ${timeoutSec}s`);
    this._notify(this._trip.getSnapshot());
    await this._bill('INACTIVITY_TIMEOUT');
  }

  async _bill(reason) {
    // Phase 2: do not bill if trip-level validation is still pending
    if (this._pendingBillingReason !== null) {
      this._onLog(
        `Trip: [DECISION] Billing deferred — validation pending ` +
        `("${this._pendingBillingReason}")`
      );
      return;
    }

    const total = this._trip.getAccumulatedFare();
    this._trip.setBillingStatus(TRIP_STATUS.BILLING);
    this._notify(this._trip.getSnapshot());

    if (total <= 0) {
      this._onLog(`Trip: Total fare is €0.00 — no billing required (${this._trip.getLegCount()} leg(s) completed)`);
      this._trip.setBilling({ paymentStatus: 'skipped', paymentId: null, reason: 'zero_fare' });
      this._notify(this._trip.getSnapshot());
      return;
    }

    this._onLog(`Trip: Charging total ${tripConfig.currency} ${total.toFixed(2)} via Carrier Billing...`);
    try {
      const result = await this._apiAdapter.carrierBilling(
        this._phone, this._logApi, total, tripConfig.currency
      );
      this._trip.setBilling({ ...result, reason });
      this._onLog(
        `Trip: [i] Carrier Billing successful — ` +
        `${tripConfig.currency} ${total.toFixed(2)} charged (tx: ${result.paymentId})`
      );
    } catch (err) {
      this._trip.setBilling({ paymentStatus: 'failed', error: err.message, reason });
      this._onLog(`Trip: [i] Carrier Billing failed — ${err.message}`);
    }

    // Step j: delete Reachability Subscription
    if (this._reachSubId) {
      this._onLog('Trip: [j] Deleting Reachability Subscription...');
      try {
        await this._apiAdapter.deleteReachabilitySubscription(this._reachSubId, this._logApi);
        this._onLog('Trip: [j] Reachability Subscription deleted ✓');
      } catch (err) {
        this._onLog(`Trip: [j] Subscription delete failed — ${err.message}`);
      }
      this._reachSubId = null;
    }

    this._notify(this._trip.getSnapshot());
  }
}
