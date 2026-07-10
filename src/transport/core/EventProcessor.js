// =============================================================================
// Event Processor
// src/transport/core/EventProcessor.js
//
// Pure JavaScript — no React, no API, no app dependencies.
// Portable to any project that imports this file.
//
// Bridges the GeofencingManager and JourneyStateMachine.
// Enriches raw zone events with timestamp, journeyId, and detection method.
// Routes entry/exit events to the correct state machine transition.
//
// Hybrid Detection Model — Confidence Layer (non-intrusive)
// ─────────────────────────────────────────────────────────
// computeTransportConfidence() is called AFTER enrichment and BEFORE the
// state machine transition. Its result is attached as event.metadata only.
// It NEVER influences routing, state transitions, or billing.
// =============================================================================

import { computeTransportConfidence } from './TransportModeConfidence.js';

export class EventProcessor {
  /**
   * @param {object} options
   * @param {object}   options.stateMachine        — JourneyStateMachine instance
   * @param {function} options.onEntry             — callback(entryEvent) after state transition
   * @param {function} options.onExit              — callback(exitEvent) after state transition
   * @param {function} [options.getContext]        — optional () => context from ContextManager
   * @param {function} [options.isContextReliable] — optional () => boolean
   * @param {string}   [options.journeyMode]       — 'transit' | 'parking' | null
   * @param {function} [options.getNetworkHints]   — optional () => { signalStrengthCategory }
   */
  constructor({ stateMachine, onEntry, onExit, getContext = null, isContextReliable = null, journeyMode = null, getNetworkHints = null }) {
    if (!stateMachine) throw new Error('[EventProcessor] stateMachine is required');
    this._sm                = stateMachine;
    this._onEntry           = onEntry           || (() => {});
    this._onExit            = onExit            || (() => {});
    this._getContext        = getContext        || (() => null);
    this._isContextReliable = isContextReliable || (() => false);
    this._journeyMode       = journeyMode;
    this._getNetworkHints   = getNetworkHints   || (() => ({}));
  }

  /**
   * Processes a zone entered event.
   * Determines whether it is an entry or exit based on current journey state.
   *
   * @param {object} zoneEvent — { station, detectionMethod, simulatedDurationMinutes? }
   */
  processZoneEntered(zoneEvent) {
    const status   = this._sm.getStatus();
    const enriched = this._enrich(zoneEvent);

    // ── Hybrid confidence layer (metadata only — does NOT affect routing) ──
    const confidence = computeTransportConfidence({
      detectionMethod:   enriched.detectionMethod ?? 'DEFAULT',
      context:           this._getContext(),
      isContextReliable: this._isContextReliable(),
      expectedMode:      this._journeyMode,
      trajectoryHint:    enriched.station?.trajectoryHint ?? 'UNKNOWN',
      networkHints:      this._getNetworkHints(),
    });
    enriched.metadata = Object.freeze({ confidence });
    this._logConfidence(confidence, status);
    // ── End confidence layer ───────────────────────────────────────────────

    if (status === 'IDLE') {
      const transitioned = this._sm.onEntry(enriched);
      if (transitioned) this._onEntry(enriched);
    } else if (status === 'IN_TRANSIT') {
      const transitioned = this._sm.onExit(enriched);
      if (transitioned) this._onExit(enriched);
    } else {
      console.warn(`[EventProcessor] Zone event ignored — status: ${status}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  _enrich(zoneEvent) {
    return {
      ...zoneEvent,
      journeyId: this._sm.getJourney().journeyId,
      timestamp: new Date().toISOString(),
      // simulatedDurationMinutes is passed through if present (parking exit)
    };
  }

  /**
   * Emits a structured [CONFIDENCE] log line for demo / debug visibility.
   *
   * Network-only example:
   *   [CONFIDENCE] Mode=UNKNOWN Score=0.70 (70%) Source=NETWORK_ONLY → Fully network-driven detection
   *
   * Hybrid example:
   *   [CONFIDENCE] Mode=RAIL Score=0.82 (82%) Source=NETWORK+CONTEXT CheckPoint=ENTRY
   *                Trajectory=RAIL_CORRIDOR UsesContext=true Motion=YES BT=NO Speed=MODERATE SignalStrength=HIGH
   */
  _logConfidence(confidence, journeyStatus) {
    const checkPoint = journeyStatus === 'IDLE' ? 'ENTRY' : 'EXIT';
    const score      = (confidence.confidenceScore * 100).toFixed(0);
    const ss         = confidence.signalSummary;

    if (confidence.source === 'NETWORK_ONLY') {
      // A. Explicit network-only label — supports "we can operate without device signals"
      console.log(
        `[CONFIDENCE] Mode=${confidence.mode} Score=${confidence.confidenceScore} (${score}%) ` +
        `Source=NETWORK_ONLY → Fully network-driven detection ` +
        `CheckPoint=${checkPoint} Trajectory=${confidence.trajectoryHint} ` +
        `SignalStrength=${ss.signalStrengthCategory}`
      );
    } else {
      console.log(
        `[CONFIDENCE] Mode=${confidence.mode} Score=${confidence.confidenceScore} (${score}%) ` +
        `Source=${confidence.source} CheckPoint=${checkPoint} ` +
        `Trajectory=${confidence.trajectoryHint} ` +
        `UsesContext=${ss.usesContext} ` +
        `Motion=${ss.hasMotion ? 'YES' : 'NO'} ` +
        `BT=${ss.hasBluetooth ? 'YES' : 'NO'} ` +
        `Speed=${ss.speedCategory} ` +
        `SignalStrength=${ss.signalStrengthCategory}`
      );
    }
    if (confidence.warning) {
      console.warn(`[CONFIDENCE][WARN] ${confidence.warning}`);
    }
  }
}
