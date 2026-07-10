// =============================================================================
// ExplainabilityFormatter
// src/transport/core/ExplainabilityFormatter.js
//
// Pure JavaScript - no API calls, no side effects, no React dependencies.
//
// Gap 3.5: Added unified summary narrative - a single human-readable sentence
//   that business users read first, before the detailed reasoning array.
//   Example: "Journey classified as RAIL because actual duration (22 min) falls
//   within rail range (20-30 min) and outside road range (25-55 min).
//   No validation required."
// =============================================================================

export function buildExplainabilityPayload({
  journeyId,
  entryEvent,
  exitEvent,
  confidenceResult,
  correlationResult,
  decisionResult,
  validationResult,
}) {
  const reasoning = [];
  const warnings  = [];

  // Signals section (Approach 1)
  const confidence = confidenceResult ?? null;
  const ss         = confidence?.signalSummary ?? {};

  const signals = {
    network: {
      detectionMethod:        entryEvent?.detectionMethod  ?? 'UNKNOWN',
      trajectoryHint:         confidence?.trajectoryHint   ?? 'UNKNOWN',
      signalStrengthCategory: ss.signalStrengthCategory    ?? 'UNKNOWN',
      source:                 confidence?.source           ?? 'UNKNOWN',
    },
    context: {
      usesContext:   ss.usesContext   ?? false,
      hasMotion:     ss.hasMotion     ?? false,
      hasBluetooth:  ss.hasBluetooth  ?? false,
      speedCategory: ss.speedCategory ?? 'UNKNOWN',
    },
    trajectory: {
      trajectoryHint:  confidence?.trajectoryHint  ?? 'UNKNOWN',
      inferredMode:    confidence?.mode            ?? 'UNKNOWN',
      confidenceScore: confidence?.confidenceScore ?? null,
      warning:         confidence?.warning         ?? null,
    },
  };

  if (confidence) {
    reasoning.push(
      `Approach1: mode=${confidence.mode} score=${confidence.confidenceScore} ` +
      `source=${confidence.source} trajectory=${confidence.trajectoryHint}`
    );
    if (confidence.warning) warnings.push(`Approach1 warning: ${confidence.warning}`);
  } else {
    reasoning.push('Approach1: no confidence result available');
  }

  // Correlation section (Phase 1)
  const corr = correlationResult ?? null;

  const correlation = {
    actualDurationMinutes:  corr?.actualDurationMinutes  ?? null,
    railRange:              _rangeFromCandidate(corr?.candidates?.rail),
    roadRange:              _rangeFromCandidate(corr?.candidates?.road),
    busRange:               _rangeFromCandidate(corr?.candidates?.bus),
    ambiguity:              corr?.ambiguity               ?? false,
    overlapMinutes:         corr?.overlapMinutes          ?? 0,
    overlapPercentage:      corr?.overlapPercentage       ?? 0,
    inferredMode:           corr?.inferredMode            ?? 'UNKNOWN',
    correlationConfidence:  corr?.correlationConfidence   ?? 'LOW',
  };

  if (corr) {
    corr.reasoning?.forEach(r => reasoning.push(`Correlation: ${r}`));
    corr.warnings?.forEach(w  => warnings.push(`Correlation warning: ${w}`));
  } else {
    reasoning.push('Correlation: no correlation result available (feature disabled or parking mode)');
  }

  // Decision section (Phase 2)
  const dec = decisionResult ?? null;

  // ---------------------------------------------------------------------------
  // barrierDecision — internal derived value, NOT part of advisory payload.
  // Derived from validationSignal using the canonical rule:
  //   validationSignal = 'AMBIGUOUS' → barrierDecision = 'CLOSED' (NFC required)
  //   validationSignal = 'CLEAR'     → barrierDecision = 'OPEN'   (pass through)
  // Kept explicit here so the audit trail is unambiguous about what happened.
  // ---------------------------------------------------------------------------
  const _validationSignal = dec?.validationSignal ?? 'CLEAR';
  const barrierDecision   = _validationSignal === 'AMBIGUOUS' ? 'CLOSED' : 'OPEN';

  const decision = {
    finalDecision:      dec?.finalDecision      ?? 'UNKNOWN',
    finalMode:          dec?.finalMode          ?? 'UNKNOWN',
    confidence:         dec?.decisionConfidence ?? 'UNKNOWN',
    requiresValidation: dec?.requiresValidation ?? false,
    validationReason:   dec?.validationReason   ?? null,
    decisionTags:       dec?.decisionTags       ?? [],
    // Barrier decision fields — answers WHY barrier opened or stayed closed
    validationSignal:    _validationSignal,          // 'CLEAR' | 'AMBIGUOUS'
    barrierDecision,                                 // 'OPEN' | 'CLOSED' — derived, never from advisory
    validationTriggered: dec?.requiresValidation ?? false,
    stage:               dec?.stage              ?? 'EXIT',
  };

  if (dec) {
    dec.decisionReasoning?.forEach(r => reasoning.push(`Decision: ${r}`));
    if (dec.decisionTags?.length) {
      reasoning.push(`Decision tags: [${dec.decisionTags.join(', ')}]`);
    }
    // Explicit barrier outcome in reasoning chain
    reasoning.push(
      `Barrier: ${barrierDecision} — validationSignal=${_validationSignal}` +
      ` (${barrierDecision === 'CLOSED' ? 'NFC required at exit' : 'pass through, no NFC'})`
    );
  } else {
    reasoning.push('Decision: no decision result available (feature disabled or auto-process default)');
  }

  // Validation section (Phase 2)
  const val = validationResult ?? null;

  const validation = {
    validationRequired:  val?.validationRequired  ?? false,
    validationStatus:    val?.validationStatus     ?? 'NOT_REQUIRED',
    validationMethod:    val?.validationMethod     ?? 'UNKNOWN',
    validationTimestamp: val?.validationTimestamp  ?? null,
    accessState:         val?.accessState          ?? 'ALLOWED',
  };

  if (val?.validationStatus && val.validationStatus !== 'NOT_REQUIRED') {
    reasoning.push(
      `Validation: status=${val.validationStatus} method=${val.validationMethod} accessState=${val.accessState}`
    );
  }

  // Gap 3.5: unified summary narrative - the single sentence business users read first
  const summary = _buildSummary(corr, dec, val);

  // Derive travel time provider from correlation range source fields
  const travelTimeProvider =
    corr?.candidates?.rail?.source ??
    corr?.candidates?.road?.source ??
    corr?.candidates?.bus?.source  ??
    'UNKNOWN';

  return Object.freeze({
    journeyId:          journeyId ?? 'UNKNOWN',
    modeDetected:       dec?.finalMode ?? corr?.inferredMode ?? confidence?.mode ?? 'UNKNOWN',
    finalDecision:      dec?.finalDecision ?? 'UNKNOWN',
    travelTimeProvider,
    summary,
    generatedAt:        new Date().toISOString(),
    explainability: Object.freeze({
      signals:     Object.freeze(signals),
      correlation: Object.freeze(correlation),
      decision:    Object.freeze(decision),
      validation:  Object.freeze(validation),
      reasoning:   Object.freeze([...reasoning]),
      warnings:    Object.freeze([...warnings]),
    }),
  });
}

// ---------------------------------------------------------------------------
// Gap 3.5: Build a single unified narrative sentence
// ---------------------------------------------------------------------------
function _buildSummary(corr, dec, val) {
  const actual   = corr?.actualDurationMinutes;
  const mode     = dec?.finalMode ?? corr?.inferredMode ?? 'UNKNOWN';
  const decision = dec?.finalDecision ?? 'UNKNOWN';

  if (!corr || actual == null) {
    if (decision === 'AUTO_PROCESS') {
      return `Journey processed automatically. No travel time correlation data was available.`;
    }
    return `Journey outcome: ${decision}. No travel time correlation data was available.`;
  }

  const candidates = corr.candidates ?? {};
  const inRangeParts  = [];
  const outRangeParts = [];

  const modeNames = { rail: 'rail', road: 'road', bus: 'bus' };
  const modeLabels = { rail: 'RAIL', road: 'CAR', bus: 'BUS' };

  for (const [key, label] of Object.entries(modeNames)) {
    const c = candidates[key];
    if (!c || c.optimisticMinutes == null) continue;
    const rangeStr = `${c.optimisticMinutes}-${c.pessimisticMinutes} min`;
    if (c.inRange) {
      inRangeParts.push(`within ${modeLabels[key]} range (${rangeStr})`);
    } else {
      outRangeParts.push(`outside ${modeLabels[key]} range (${rangeStr})`);
    }
  }

  let locationSentence = `Actual duration (${actual} min)`;
  const allParts = [...inRangeParts, ...outRangeParts];
  if (allParts.length > 0) {
    locationSentence += ` falls ${allParts.join(' and ')}.`;
  } else {
    locationSentence += ` could not be matched against known ranges.`;
  }

  let decisionSentence;
  if (decision === 'AUTO_PROCESS') {
    decisionSentence = `Journey classified as ${mode} and processed automatically.`;
  } else if (decision === 'REQUIRE_VALIDATION') {
    const vStatus = val?.validationStatus ?? 'PENDING';
    if (vStatus === 'SUCCESS') {
      decisionSentence = `Step-up validation was required and passed (${val.validationMethod ?? 'MOCK'}). Journey proceeded.`;
    } else if (vStatus === 'FAILED') {
      decisionSentence = `Step-up validation was required but failed. Journey blocked.`;
    } else if (mode === 'UNKNOWN' && corr?.correlationConfidence === 'LOW') {
      decisionSentence = `Journey duration falls outside all known transport ranges — mode could not be inferred. Step-up validation required.`;
    } else if (corr?.ambiguity) {
      decisionSentence = `Ambiguous timing: duration matches multiple transport modes. Step-up validation required.`;
    } else {
      decisionSentence = `Step-up validation required before processing.`;
    }
  } else {
    decisionSentence = `Journey outcome: ${decision}.`;
  }

  return `${locationSentence} ${decisionSentence}`;
}

// ---------------------------------------------------------------------------
// Extract range fields from a candidate object
// ---------------------------------------------------------------------------
function _rangeFromCandidate(candidate) {
  if (!candidate) {
    return {
      optimisticMinutes: null, pessimisticMinutes: null,
      bestEstimateMinutes: null, inRange: false, deltaToBestEstimate: null,
    };
  }
  return {
    optimisticMinutes:   candidate.optimisticMinutes   ?? null,
    pessimisticMinutes:  candidate.pessimisticMinutes  ?? null,
    bestEstimateMinutes: candidate.bestEstimateMinutes ?? null,
    inRange:             candidate.inRange             ?? false,
    deltaToBestEstimate: candidate.deltaToBestEstimate ?? null,
  };
}
