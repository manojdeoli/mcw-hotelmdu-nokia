// =============================================================================
// TransportModeConfidence
// src/transport/core/TransportModeConfidence.js
//
// Pure JavaScript — no API calls, no side effects, no React dependencies.
// Portable to any project that imports this file.
//
// Hybrid Detection Model — Confidence Scoring Layer
// ─────────────────────────────────────────────────
// Network signals (CAMARA) are ALWAYS authoritative and drive all state
// transitions. This module only produces a confidence score + inferred mode
// as METADATA attached to events for observability and demo visibility.
//
// It NEVER blocks, delays, or alters any journey flow.
//
// Input:
//   {
//     detectionMethod:   string,        — 'LOCATION_VERIFY' | 'GEOFENCE_SUB' | 'TIMEOUT'
//     context:           object | null, — Android context from ContextManager (optional)
//     isContextReliable: boolean,       — from ContextManager.isContextReliable()
//     expectedMode:      string | null, — 'transit' | 'parking' | null
//     trajectoryHint:    string,        — 'RAIL_CORRIDOR' | 'ROAD_CORRIDOR' | 'UNKNOWN'
//     networkHints:      object,        — { signalStrengthCategory: 'LOW'|'MEDIUM'|'HIGH'|'UNKNOWN' }
//   }
//
// Output:
//   {
//     mode:            'RAIL' | 'CAR' | 'WALKING' | 'UNKNOWN',
//     confidenceScore: number,          — 0.0 – 1.0 (after boost + dampening)
//     source:          'NETWORK_ONLY' | 'NETWORK+CONTEXT',
//     trajectoryHint:  string,          — echoed from input for log visibility
//     signalSummary: {
//       usesContext:   boolean,         — false = fully network-driven, no device signals used
//       hasMotion:     boolean,
//       hasBluetooth:  boolean,
//       speedCategory: 'STATIONARY' | 'SLOW' | 'MODERATE' | 'FAST' | 'UNKNOWN',
//       signalStrengthCategory: string, — from networkHints (future CAMARA capability)
//     },
//     warning: string | null,           — anomaly description when mode contradicts expected
//   }
// =============================================================================

import contextConfig from '../context/contextConfig.json';

// Scoring weights — read entirely from contextConfig.json, no hardcoding.
// All values can be tuned in config without any code change.
const W = contextConfig.confidenceWeights;

// ---------------------------------------------------------------------------
// Speed thresholds (km/h) — kept in code as these are physical constants,
// not tunable demo parameters.
// ---------------------------------------------------------------------------
const SPEED_THRESHOLDS = { STATIONARY: 2, SLOW: 15, MODERATE: 60 };

// ---------------------------------------------------------------------------
// Expected transport modes per journey type (for warning computation)
// ---------------------------------------------------------------------------
const EXPECTED_MODES_BY_JOURNEY = { transit: ['RAIL'], parking: ['CAR'] };

// =============================================================================
// Private helpers
// =============================================================================

function categoriseSpeed(speedKmh) {
  if (speedKmh == null || typeof speedKmh !== 'number') return 'UNKNOWN';
  if (speedKmh <= SPEED_THRESHOLDS.STATIONARY) return 'STATIONARY';
  if (speedKmh <= SPEED_THRESHOLDS.SLOW)       return 'SLOW';
  if (speedKmh <= SPEED_THRESHOLDS.MODERATE)   return 'MODERATE';
  return 'FAST';
}

// ---------------------------------------------------------------------------
// Trajectory-aware mode inference
// Resolves the rail/road ambiguity: a car parallel to a rail corridor would
// previously be misclassified as RAIL. trajectoryHint from stations.json
// provides the path context needed to override that.
// ---------------------------------------------------------------------------
function inferModeFromContext(contextMode, motionType, speedCat, trajectoryHint) {
  const isVehicleMotion = motionType === 'VEHICLE';

  if (contextMode === 'TRANSIT' && isVehicleMotion) {
    if (trajectoryHint === 'RAIL_CORRIDOR') return 'RAIL';
    if (trajectoryHint === 'ROAD_CORRIDOR') return 'CAR';
    return (speedCat === 'FAST' || speedCat === 'MODERATE') ? 'RAIL' : 'CAR';
  }
  if (contextMode === 'TRANSIT') {
    return trajectoryHint === 'ROAD_CORRIDOR' ? 'CAR' : 'RAIL';
  }
  if (contextMode === 'CAR' || (isVehicleMotion && trajectoryHint === 'ROAD_CORRIDOR')) {
    return 'CAR';
  }
  if (isVehicleMotion) return 'CAR';
  if (contextMode === 'WALKING' || motionType === 'WALKING') return 'WALKING';
  return null;
}

// ---------------------------------------------------------------------------
// C. Config-driven boost — all weights from contextConfig.confidenceWeights
// ---------------------------------------------------------------------------
function contextBoostDelta(signals, speedCat) {
  let boost = W.boostBase;
  if (signals.speedAvailable && speedCat !== 'UNKNOWN' && speedCat !== 'STATIONARY') boost += W.boostSpeed;
  if (signals.bluetoothConnected) boost += W.boostBluetooth;
  if (signals.motion && signals.motion !== 'UNKNOWN')                                boost += W.boostMotion;
  return Math.min(W.boostMax, boost);
}

// ---------------------------------------------------------------------------
// C. Config-driven dampening — all weights from contextConfig.confidenceWeights
// B. Includes networkHints.signalStrengthCategory dampening (future CAMARA)
// ---------------------------------------------------------------------------
function confidenceDampeningDelta(
  inferredMode, detectionMethod, motionType, speedCat,
  trajectoryHint, contextMode, signalStrengthCategory
) {
  let dampen = 0;

  // Rail/road ambiguity: vehicle motion + GEOFENCE_SUB + unknown trajectory
  if (detectionMethod === 'GEOFENCE_SUB' && motionType === 'VEHICLE' && trajectoryHint === 'UNKNOWN') {
    dampen += W.dampenRailRoadAmbiguity;
  }
  // Context mode contradicts inferred mode
  if (inferredMode === 'CAR'  && contextMode === 'TRANSIT') dampen += W.dampenModeMismatch;
  if (inferredMode === 'RAIL' && contextMode === 'CAR')     dampen += W.dampenModeMismatch;

  // Vehicle motion but no speed measurement available
  if (motionType === 'VEHICLE' && speedCat === 'UNKNOWN') dampen += W.dampenNoSpeedOnVehicle;

  // Road corridor station but TRANSIT context — path/mode mismatch
  if (trajectoryHint === 'ROAD_CORRIDOR' && contextMode === 'TRANSIT') dampen += W.dampenRoadCorridorTransit;

  // B. Network signal strength — placeholder for future CAMARA signal-strength API.
  // LOW signal (e.g. Faraday cage / underground) reduces location fix reliability.
  const sigDampen = W.networkSignalStrengthDampen?.[signalStrengthCategory] ?? 0;
  dampen += sigDampen;

  return Math.min(W.dampenMax, dampen);
}

// ---------------------------------------------------------------------------
// Soft warning — anomaly detection (non-blocking, metadata only)
// ---------------------------------------------------------------------------
function computeWarning(inferredMode, expectedMode, trajectoryHint, contextMode) {
  if (!inferredMode || inferredMode === 'UNKNOWN') return null;
  const expectedModes = EXPECTED_MODES_BY_JOURNEY[expectedMode] ?? [];

  if (expectedModes.length > 0 && !expectedModes.includes(inferredMode)) {
    if (inferredMode === 'CAR' && expectedModes.includes('RAIL')) {
      return trajectoryHint === 'ROAD_CORRIDOR'
        ? 'Possible road-parallel detection — device on road corridor near rail station'
        : 'Mode mismatch — inferred CAR for transit journey — possible parallel vehicle';
    }
    if (inferredMode === 'WALKING' && expectedModes.includes('RAIL')) {
      return 'Walking motion detected during transit journey — possible device separation';
    }
    return `Mode mismatch — inferred ${inferredMode} but expected ${expectedModes.join('/')} for ${expectedMode} journey`;
  }
  if (trajectoryHint === 'RAIL_CORRIDOR' && contextMode === 'CAR') {
    return 'Context reports CAR mode at rail corridor station — possible misclassification';
  }
  return null;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Computes a transport mode confidence result for a zone event.
 *
 * Pure function — same inputs always produce the same output.
 * No state stored between calls.
 *
 * @param {object}      input
 * @param {string}      input.detectionMethod      — 'LOCATION_VERIFY' | 'GEOFENCE_SUB' | 'TIMEOUT'
 * @param {object|null} input.context              — Android context (may be null)
 * @param {boolean}     input.isContextReliable    — from ContextManager.isContextReliable()
 * @param {string}      [input.expectedMode]       — 'transit' | 'parking' | null
 * @param {string}      [input.trajectoryHint]     — 'RAIL_CORRIDOR' | 'ROAD_CORRIDOR' | 'UNKNOWN'
 * @param {object}      [input.networkHints]       — { signalStrengthCategory: 'LOW'|'MEDIUM'|'HIGH'|'UNKNOWN' }
 * @returns {ConfidenceResult}
 */
export function computeTransportConfidence({
  detectionMethod,
  context,
  isContextReliable,
  expectedMode   = null,
  trajectoryHint = 'UNKNOWN',
  networkHints   = {},
}) {
  const baseScore              = W[detectionMethod] ?? W.DEFAULT;
  const signalStrengthCategory = networkHints?.signalStrengthCategory ?? 'UNKNOWN';

  // A. usesContext: explicitly false when operating network-only.
  // This directly supports the "we can operate without device signals" narrative.
  const signalSummary = {
    usesContext:            false,
    hasMotion:              false,
    hasBluetooth:           false,
    speedCategory:          'UNKNOWN',
    signalStrengthCategory,   // B. network hint — echoed for log/UI visibility
  };

  // ── Network-only path ─────────────────────────────────────────────────────
  // B. Signal strength dampening still applies even without context —
  // a weak network signal reduces location fix reliability regardless.
  if (!isContextReliable || !context) {
    const netDampen  = W.networkSignalStrengthDampen?.[signalStrengthCategory] ?? 0;
    const finalScore = parseFloat(Math.min(1.0, Math.max(0.1, baseScore - netDampen)).toFixed(2));
    return Object.freeze({
      mode:            'UNKNOWN',
      confidenceScore: finalScore,
      source:          'NETWORK_ONLY',   // A. explicit — fully network-driven, no device signals
      trajectoryHint,
      signalSummary:   Object.freeze(signalSummary),
      warning:         null,
    });
  }

  // ── Hybrid path ───────────────────────────────────────────────────────────
  const signals    = context.signals ?? {};
  const speedKmh   = signals.speedAvailable ? (signals.speed ?? null) : null;
  const speedCat   = categoriseSpeed(speedKmh);
  const motionType = signals.motion ?? 'UNKNOWN';

  // A. usesContext = true — device signals are contributing to this result
  signalSummary.usesContext    = true;
  signalSummary.hasMotion      = motionType !== 'UNKNOWN';
  signalSummary.hasBluetooth   = !!signals.bluetoothConnected;
  signalSummary.speedCategory  = speedCat;

  const inferredMode = inferModeFromContext(context.mode, motionType, speedCat, trajectoryHint);
  const boost        = contextBoostDelta(signals, speedCat);
  const dampen       = confidenceDampeningDelta(
    inferredMode, detectionMethod, motionType, speedCat,
    trajectoryHint, context.mode, signalStrengthCategory
  );
  const finalScore   = parseFloat(Math.min(1.0, Math.max(0.1, baseScore + boost - dampen)).toFixed(2));
  const warning      = computeWarning(inferredMode, expectedMode, trajectoryHint, context.mode);

  return Object.freeze({
    mode:            inferredMode ?? 'UNKNOWN',
    confidenceScore: finalScore,
    source:          'NETWORK+CONTEXT',
    trajectoryHint,
    signalSummary:   Object.freeze({ ...signalSummary }),
    warning,
  });
}
