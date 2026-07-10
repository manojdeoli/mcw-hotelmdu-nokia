// =============================================================================
// TransportCorrelationEngine
// src/transport/core/TransportCorrelationEngine.js
//
// Pure JavaScript — no API calls, no side effects, no React dependencies.
//
// Gap 3.1: Cross-mode consistency check added — "outside one range AND within
//   another" is now an explicit HIGH-confidence rule, not just implied.
//   crossModeConfirmed flag added to output so DecisionEngine can tag it.
// Gap 3.2: Overlap measurement added — ambiguity is only true when the overlap
//   between in-range modes exceeds ambiguityOverlapThresholdMinutes (config).
//   Small overlaps are resolvable by tiebreak (MEDIUM, no validation needed).
// Gap 3.4: Provider reliability surfaced into reasoning[] when source is
//   GOOGLE or MAPBOX — "best-effort, not schedule-based" per Oliver's note.
// Gap 3.6: locationConsistency optional hint input — if a mid-journey scan
//   returned an unexpected match, correlationConfidence is capped at MEDIUM
//   and a warning is added, even when correlation would otherwise be HIGH.
// =============================================================================

import travelTimeConfig from '../config/travelTimeConfig.json';

const MODE_LABEL = Object.freeze({ rail: 'RAIL', road: 'CAR', bus: 'BUS' });

// ---------------------------------------------------------------------------
// Evaluate a single mode candidate against the actual duration
// ---------------------------------------------------------------------------
function evaluateCandidate(mode, actualMinutes, ranges, toleranceMinutes) {
  const entry = ranges[mode];
  if (!entry || entry.optimisticMinutes == null || entry.pessimisticMinutes == null) {
    return {
      optimisticMinutes: null, pessimisticMinutes: null, bestEstimateMinutes: null,
      inRange: false, deltaToBestEstimate: null, hasData: false,
    };
  }
  const lo      = entry.optimisticMinutes  - toleranceMinutes;
  const hi      = entry.pessimisticMinutes + toleranceMinutes;
  const inRange = actualMinutes >= lo && actualMinutes <= hi;
  const delta   = entry.bestEstimateMinutes != null
    ? parseFloat((actualMinutes - entry.bestEstimateMinutes).toFixed(1))
    : null;
  return {
    optimisticMinutes:   entry.optimisticMinutes,
    pessimisticMinutes:  entry.pessimisticMinutes,
    bestEstimateMinutes: entry.bestEstimateMinutes ?? null,
    inRange,
    deltaToBestEstimate: delta,
    hasData: true,
  };
}

// ---------------------------------------------------------------------------
// Build per-candidate reasoning line
// ---------------------------------------------------------------------------
function buildCandidateReasoning(mode, actual, candidate) {
  const label = MODE_LABEL[mode] ?? mode.toUpperCase();
  if (!candidate.hasData) return `No travel time data available for ${label} mode`;
  const rangeStr  = `${candidate.optimisticMinutes}-${candidate.pessimisticMinutes} min`;
  const bestStr   = candidate.bestEstimateMinutes != null ? ` (best: ${candidate.bestEstimateMinutes} min` : '';
  const deltaStr  = candidate.deltaToBestEstimate != null
    ? `, delta: ${candidate.deltaToBestEstimate > 0 ? '+' : ''}${candidate.deltaToBestEstimate} min)`
    : bestStr ? ')' : '';
  const verdict   = candidate.inRange ? 'in range' : 'outside range';
  return `Actual ${actual} min is ${candidate.inRange ? 'within' : 'outside'} ${label} expected range ${rangeStr}${bestStr}${deltaStr} - ${verdict}`;
}

// ---------------------------------------------------------------------------
// Gap 3.2: Measure overlap between the two widest in-range mode ranges
// Returns { overlapMinutes, overlapPercentage }
// ---------------------------------------------------------------------------
function measureOverlap(modesInRange, candidates) {
  const withData = modesInRange.filter(m => candidates[m].optimisticMinutes != null);
  if (withData.length < 2) return { overlapMinutes: 0, overlapPercentage: 0 };

  const sorted = [...withData].sort((a, b) =>
    candidates[a].optimisticMinutes - candidates[b].optimisticMinutes
  );
  const lo   = sorted[0];
  const hi   = sorted[sorted.length - 1];
  const oLo  = Math.max(candidates[lo].optimisticMinutes,  candidates[hi].optimisticMinutes);
  const oHi  = Math.min(candidates[lo].pessimisticMinutes, candidates[hi].pessimisticMinutes);
  const overlapMinutes = Math.max(0, oHi - oLo);

  const span = Math.max(candidates[lo].pessimisticMinutes, candidates[hi].pessimisticMinutes)
             - Math.min(candidates[lo].optimisticMinutes,  candidates[hi].optimisticMinutes);
  const overlapPercentage = span > 0 ? parseFloat(((overlapMinutes / span) * 100).toFixed(1)) : 0;
  return { overlapMinutes, overlapPercentage };
}

// ---------------------------------------------------------------------------
// Pick closest mode to best estimate from a list
// ---------------------------------------------------------------------------
function pickClosest(modesInRange, candidates) {
  const ranked = modesInRange
    .filter(m => candidates[m].deltaToBestEstimate != null)
    .sort((a, b) => Math.abs(candidates[a].deltaToBestEstimate) - Math.abs(candidates[b].deltaToBestEstimate));
  return ranked.length > 0 ? ranked[0] : null;
}

// =============================================================================
// Public API
// =============================================================================
// ---------------------------------------------------------------------------
// Gap 3.4: Emit a reasoning line when travel time data comes from a
// best-effort provider (GOOGLE / MAPBOX) rather than schedule data.
// Reads source from the first mode entry that has it.
// ---------------------------------------------------------------------------
function buildProviderReliabilityReasoning(travelTimeRanges) {
  const source = travelTimeRanges?.rail?.source
    ?? travelTimeRanges?.road?.source
    ?? travelTimeRanges?.bus?.source
    ?? null;
  if (!source) return null;
  const reliability = travelTimeRanges?.rail?.providerReliability
    ?? travelTimeRanges?.road?.providerReliability
    ?? travelTimeRanges?.bus?.providerReliability
    ?? 'UNKNOWN';
  if (source === 'GOOGLE' || source === 'MAPBOX') {
    return `Travel time data from ${source} (reliability: ${reliability}) — best-effort estimates, not schedule-based. Ranges may vary.`;
  }
  return null;
}

export function correlate({
  actualDurationMinutes,
  travelTimeRanges,
  toleranceMarginMinutes  = 2,
  candidateModes          = ['rail', 'road', 'bus'],
  featureEnabled          = true,
  locationConsistency     = 'CONSISTENT', // Gap 3.6: 'CONSISTENT' | 'UNEXPECTED_MID_MATCH' | 'UNKNOWN'
}) {
  const reasoning = [];
  const warnings  = [];

  if (!featureEnabled) {
    return Object.freeze({
      actualDurationMinutes, candidates: Object.freeze({}),
      inferredMode: 'UNKNOWN', ambiguity: false, crossModeConfirmed: false,
      correlationConfidence: 'LOW', overlapMinutes: 0, overlapPercentage: 0,
      locationConsistency: 'UNKNOWN',
      reasoning: Object.freeze(['Correlation feature disabled']), warnings: Object.freeze([]),
    });
  }

  if (actualDurationMinutes == null || typeof actualDurationMinutes !== 'number' || actualDurationMinutes <= 0) {
    warnings.push(`Invalid actual duration: ${actualDurationMinutes}`);
    return Object.freeze({
      actualDurationMinutes, candidates: Object.freeze({}),
      inferredMode: 'UNKNOWN', ambiguity: false, crossModeConfirmed: false,
      correlationConfidence: 'LOW', overlapMinutes: 0, overlapPercentage: 0,
      locationConsistency: 'UNKNOWN',
      reasoning: Object.freeze(['No valid journey duration - correlation skipped']),
      warnings: Object.freeze(warnings),
    });
  }

  if (!travelTimeRanges) {
    warnings.push('No travel time ranges provided');
    return Object.freeze({
      actualDurationMinutes, candidates: Object.freeze({}),
      inferredMode: 'UNKNOWN', ambiguity: false, crossModeConfirmed: false,
      correlationConfidence: 'LOW', overlapMinutes: 0, overlapPercentage: 0,
      locationConsistency: 'UNKNOWN',
      reasoning: Object.freeze(['No travel time data available - correlation skipped']),
      warnings: Object.freeze(warnings),
    });
  }

  // Gap 3.4: provider reliability note — emitted before candidate evaluation
  // so it appears at the top of the reasoning chain.
  const providerNote = buildProviderReliabilityReasoning(travelTimeRanges);
  if (providerNote) reasoning.push(providerNote);

  // Evaluate each mode
  const candidates = {};
  let hasAnyData   = false;
  for (const mode of candidateModes) {
    const candidate = evaluateCandidate(mode, actualDurationMinutes, travelTimeRanges, toleranceMarginMinutes);
    candidates[mode] = candidate;
    if (candidate.hasData) hasAnyData = true;
    reasoning.push(buildCandidateReasoning(mode, actualDurationMinutes, candidate));
  }

  if (!hasAnyData) {
    warnings.push('No travel time data found for any candidate mode');
    return Object.freeze({
      actualDurationMinutes,
      candidates: Object.freeze(candidates),
      inferredMode: 'UNKNOWN', ambiguity: false, crossModeConfirmed: false,
      correlationConfidence: 'LOW', overlapMinutes: 0, overlapPercentage: 0,
      locationConsistency: locationConsistency ?? 'UNKNOWN',
      reasoning: Object.freeze([...reasoning, 'No travel time data available for this route - correlation skipped']),
      warnings: Object.freeze(warnings),
    });
  }

  const modesInRange    = candidateModes.filter(m => candidates[m].inRange  && candidates[m].hasData);
  const modesOutOfRange = candidateModes.filter(m => !candidates[m].inRange && candidates[m].hasData);

  // ---------------------------------------------------------------------------
  // Gap 3.1: Cross-mode consistency check
  // "Outside range A AND within range B" = explicit HIGH-confidence rule.
  // This fires before the generic path so the rule is deterministic.
  // crossModeConfirmed is set on the output so DecisionEngine can tag it.
  // ---------------------------------------------------------------------------
  let crossModeWinner   = null;
  let crossModeConfirmed = false;
  if (modesInRange.length === 1 && modesOutOfRange.length >= 1) {
    crossModeWinner    = modesInRange[0];
    crossModeConfirmed = true;
    const outLabels = modesOutOfRange
      .map(m => `${MODE_LABEL[m]} (${candidates[m].optimisticMinutes}-${candidates[m].pessimisticMinutes} min)`)
      .join(', ');
    reasoning.push(
      `Cross-mode consistency: actual ${actualDurationMinutes} min is outside ${outLabels} ` +
      `and within ${MODE_LABEL[crossModeWinner]} range - strong inference`
    );
  }

  // ---------------------------------------------------------------------------
  // Gap 3.2: Overlap measurement
  // Small overlap (< threshold) = resolvable by tiebreak, no validation needed.
  // Large overlap (>= threshold) = true ambiguity, trigger validation.
  // ---------------------------------------------------------------------------
  const overlapThreshold = travelTimeConfig?.ambiguityOverlapThresholdMinutes ?? 5;
  let overlapMinutes    = 0;
  let overlapPercentage = 0;
  let trueAmbiguity     = false;

  if (modesInRange.length > 1) {
    const overlap = measureOverlap(modesInRange, candidates);
    overlapMinutes    = overlap.overlapMinutes;
    overlapPercentage = overlap.overlapPercentage;
    trueAmbiguity     = overlapMinutes >= overlapThreshold;
    reasoning.push(
      `Overlap analysis: ${overlapMinutes} min (${overlapPercentage}%) between in-range modes - ` +
      (trueAmbiguity
        ? `exceeds threshold (${overlapThreshold} min) - TRUE ambiguity`
        : `below threshold (${overlapThreshold} min) - resolvable by tiebreak`)
    );
  }

  const ambiguity = modesInRange.length > 1 && trueAmbiguity;

  // ---------------------------------------------------------------------------
  // Mode inference — priority order
  // ---------------------------------------------------------------------------
  let inferredMode          = 'UNKNOWN';
  let correlationConfidence = 'LOW';

  if (crossModeWinner !== null) {
    // Gap 3.1: strongest rule — explicit cross-mode confirmation
    inferredMode          = MODE_LABEL[crossModeWinner] ?? 'UNKNOWN';
    correlationConfidence = 'HIGH';
    reasoning.push(`Inferred ${inferredMode} with HIGH confidence via cross-mode consistency rule`);

  } else if (modesInRange.length === 1) {
    inferredMode          = MODE_LABEL[modesInRange[0]] ?? 'UNKNOWN';
    correlationConfidence = 'HIGH';
    reasoning.push(`Single mode in range - inferred ${inferredMode} with HIGH correlation confidence`);

  } else if (modesInRange.length > 1 && !trueAmbiguity) {
    // Gap 3.2: small overlap - tiebreak resolves, MEDIUM confidence, no validation
    correlationConfidence = 'MEDIUM';
    const winner = pickClosest(modesInRange, candidates);
    if (winner) {
      inferredMode = MODE_LABEL[winner] ?? 'UNKNOWN';
      reasoning.push(
        `Small overlap (${overlapMinutes} min < threshold ${overlapThreshold} min) - ` +
        `tiebreak resolves to ${inferredMode} ` +
        `(delta: ${candidates[winner].deltaToBestEstimate > 0 ? '+' : ''}${candidates[winner].deltaToBestEstimate} min) - MEDIUM confidence`
      );
    } else {
      inferredMode = 'UNKNOWN';
      reasoning.push('Small overlap but no best estimate to tiebreak - UNKNOWN');
    }

  } else if (modesInRange.length > 1 && trueAmbiguity) {
    // Gap 3.2: large overlap - true ambiguity, pick closest but flag
    correlationConfidence = 'MEDIUM';
    const winner = pickClosest(modesInRange, candidates);
    const rangeDescriptions = modesInRange
      .map(m => `${MODE_LABEL[m]} (${candidates[m].optimisticMinutes}-${candidates[m].pessimisticMinutes} min)`)
      .join(', ');
    if (winner) {
      inferredMode = MODE_LABEL[winner] ?? 'UNKNOWN';
      reasoning.push(
        `True ambiguity (overlap ${overlapMinutes} min >= threshold ${overlapThreshold} min) - ` +
        `actual ${actualDurationMinutes} min within: ${rangeDescriptions}`
      );
      reasoning.push(
        `Closest to best estimate: ${inferredMode} ` +
        `(delta: ${candidates[winner].deltaToBestEstimate > 0 ? '+' : ''}${candidates[winner].deltaToBestEstimate} min) - validation recommended`
      );
      warnings.push(
        `True ambiguity - overlap ${overlapMinutes} min (${overlapPercentage}%) >= threshold ${overlapThreshold} min - step-up validation recommended`
      );
    } else {
      inferredMode = 'UNKNOWN';
      reasoning.push('True ambiguity - no best estimate to tiebreak');
      warnings.push('Cannot resolve ambiguity - missing best estimate data');
    }

  } else {
    correlationConfidence = 'LOW';
    inferredMode          = 'UNKNOWN';
    reasoning.push(`Actual duration ${actualDurationMinutes} min is outside all candidate mode ranges - inferredMode UNKNOWN`);
    warnings.push('Journey duration outside all expected ranges - possible data quality issue or unusual journey');
  }

  // ---------------------------------------------------------------------------
  // Gap 3.6: Location consistency cap
  // If the mid-journey scan returned an unexpected station match, cap
  // correlationConfidence at MEDIUM regardless of what correlation computed.
  // A device appearing at a non-route station mid-journey is a signal conflict.
  // ---------------------------------------------------------------------------
  if (locationConsistency === 'UNEXPECTED_MID_MATCH' && correlationConfidence === 'HIGH') {
    correlationConfidence = 'MEDIUM';
    reasoning.push(
      `Location consistency check: mid-journey scan returned unexpected station match — ` +
      `correlationConfidence capped at MEDIUM (was HIGH)`
    );
    warnings.push(
      `UNEXPECTED_MID_MATCH: device appeared at a non-route station mid-journey — ` +
      `location data may be unreliable`
    );
  }

  // Strip internal hasData flag from output
  const cleanCandidates = {};
  for (const mode of candidateModes) {
    const { hasData, ...rest } = candidates[mode]; // eslint-disable-line no-unused-vars
    cleanCandidates[mode] = Object.freeze(rest);
  }

  return Object.freeze({
    actualDurationMinutes,
    candidates:           Object.freeze(cleanCandidates),
    inferredMode,
    ambiguity,
    crossModeConfirmed,          // Gap 3.1: true when cross-mode consistency rule fired
    overlapMinutes,
    overlapPercentage,
    correlationConfidence,
    locationConsistency:  locationConsistency ?? 'CONSISTENT', // Gap 3.6: echoed for audit trail
    reasoning:  Object.freeze([...reasoning]),
    warnings:   Object.freeze([...warnings]),
  });
}
