// =============================================================================
// TransportDecisionEngine
// src/transport/core/TransportDecisionEngine.js
//
// Gap 3.3: Explicit confidence source hierarchy implemented.
//   Correlation result is PRIMARY authority.
//   Approach 1 confidence is SUPPORTING only.
//
// Priority order (strict):
//   1. trueAmbiguity (correlation)    -> REQUIRE_VALIDATION
//   2. BUS rule (config)              -> REQUIRE_VALIDATION  ← checked before AUTO_PROCESS paths
//   3. HIGH correlation, no ambiguity -> AUTO_PROCESS
//   4. MEDIUM correlation, no ambiguity -> AUTO_PROCESS (tiebreak resolved)
//   5. UNKNOWN mode (config action)   -> AUTO_PROCESS or REQUIRE_VALIDATION
//   6. LOW correlation confidence     -> apply config action
//
// BUS rule is at priority 2 (before AUTO_PROCESS rules 3+4) so it cannot be
// bypassed by a MEDIUM tiebreak resolving to BUS.
// =============================================================================

import decisionConfig from '../config/decisionConfig.json';

import { deviceAdvisoryService } from '../services/deviceAdvisoryService.js';

export const DECISION_OUTCOME = Object.freeze({
  AUTO_PROCESS:       'AUTO_PROCESS',
  REQUIRE_VALIDATION: 'REQUIRE_VALIDATION', 
  HOLD_FOR_REVIEW:    'HOLD_FOR_REVIEW',
  UNKNOWN:            'UNKNOWN',
});

// ---------------------------------------------------------------------------
// Decision result shape helpers.
//
// validationSignal is the canonical signal the advisory layer reads:
//   'CLEAR'     — backend has high confidence, barrier passes through
//   'AMBIGUOUS' — correlation ambiguous, device must validate at exit
//
// stage is always 'EXIT' — all correlation/validation runs post-completion.
// Entry is always CLEAR; advisory is never sent at entry.
//
// IMPORTANT: validationRequired and validationSignal are ALWAYS derived from
// the same single expression (ambiguity flag). They can never contradict.
// biometricCheckRequired and rfDetectionRequired are intentionally absent —
// the backend does not control device-side identity method selection.
// ---------------------------------------------------------------------------
function autoProcess(finalMode, reasoning, tags = []) {
  return Object.freeze({
    finalMode,
    finalDecision:      DECISION_OUTCOME.AUTO_PROCESS,
    decisionConfidence: 'HIGH',
    decisionReasoning:  Object.freeze([...reasoning]),
    decisionTags:       Object.freeze([...tags, 'AUTO_PROCESSED']),
    requiresValidation: false,
    validationReason:   null,
    advisoryType:       'AUTO_PROCESS',
    // Canonical signal: HIGH confidence → CLEAR exit → no device interaction needed
    validationSignal:   'CLEAR',
    stage:              'EXIT',
  });
}

function requireValidation(finalMode, reason, reasoning, confidence = 'MEDIUM', tags = []) {
  return Object.freeze({
    finalMode,
    finalDecision:      DECISION_OUTCOME.REQUIRE_VALIDATION,
    decisionConfidence: confidence,
    decisionReasoning:  Object.freeze([...reasoning]),
    decisionTags:       Object.freeze([...tags, 'VALIDATION_REQUIRED']),
    requiresValidation: true,
    validationReason:   reason,
    advisoryType:       'VALIDATION_REQUIRED',
    // Canonical signal: ambiguous exit → device must validate before billing
    validationSignal:   'AMBIGUOUS',
    stage:              'EXIT',
  });
}

export function decide({ correlationResult, confidenceResult }) {
  const cfg      = decisionConfig;
  const rules    = cfg.rules;
  const reasoning = [];
  const tags      = []; // Gap 3.7: structured machine-readable tags

  if (!cfg.decisionEnabled) {
    return autoProcess('UNKNOWN', ['Decision engine disabled - AUTO_PROCESS by default'], ['ENGINE_DISABLED']);
  }

  if (!correlationResult) {
    reasoning.push('No correlation data available - defaulting to AUTO_PROCESS');
    return autoProcess('UNKNOWN', reasoning, ['NO_CORRELATION_DATA']);
  }

  const { inferredMode, ambiguity, correlationConfidence } = correlationResult;
  const confidenceScore = confidenceResult?.confidenceScore ?? null;

  // Gap 3.3: log correlation as PRIMARY, confidence as SUPPORTING
  reasoning.push(
    `[PRIMARY] Correlation: inferredMode=${inferredMode} confidence=${correlationConfidence} ambiguity=${ambiguity}`
  );
  if (confidenceScore != null) {
    reasoning.push(
      `[SUPPORTING] Approach1: mode=${confidenceResult.mode} score=${confidenceScore} source=${confidenceResult.source}`
    );
  } else {
    reasoning.push('[SUPPORTING] Approach1: not available - correlation-only decision');
  }

  // Gap 3.7: tag the inferred mode and range position
  tags.push(`INFERRED_${inferredMode}`);
  const candidates = correlationResult.candidates ?? {};
  for (const [m, c] of Object.entries(candidates)) {
    if (c.inRange)  tags.push(`WITHIN_${m.toUpperCase()}_RANGE`);
    else            tags.push(`OUTSIDE_${m.toUpperCase()}_RANGE`);
  }
  if (correlationResult.crossModeConfirmed) tags.push('CROSS_MODE_CONFIRMED');
  if (correlationResult.locationConsistency === 'UNEXPECTED_MID_MATCH') tags.push('UNEXPECTED_MID_MATCH');

  // ---------------------------------------------------------------------------
  // Gap 3.3 Rule 1: True ambiguity -> REQUIRE_VALIDATION (correlation PRIMARY)
  // Context override only applies when explicitly configured AND score is high
  // ---------------------------------------------------------------------------
  if (ambiguity && rules.ambiguityRequiresValidation) {
    const inRangeModes = Object.entries(candidates)
      .filter(([, c]) => c.inRange)
      .map(([m]) => m.toUpperCase())
      .join(', ');
    const validationReason =
      `True ambiguity - actual duration ${correlationResult.actualDurationMinutes} min ` +
      `falls within overlapping ranges (${inRangeModes}) - step-up validation required`;

    reasoning.push('[PRIMARY] Rule: true ambiguity -> REQUIRE_VALIDATION');
    if (correlationResult.overlapMinutes != null) {
      reasoning.push(
        `Overlap: ${correlationResult.overlapMinutes} min (${correlationResult.overlapPercentage}%)`
      );
    }

    tags.push('AMBIGUITY_OVERLAP');

    // Gap 3.3: context override is explicitly secondary — only overrides when configured
    if (rules.contextBoostCanOverride && confidenceScore != null && confidenceScore >= rules.contextOverrideMinScore) {
      reasoning.push(
        `[SUPPORTING override] Approach1 score ${confidenceScore} >= ${rules.contextOverrideMinScore} ` +
        `- downgrading REQUIRE_VALIDATION to AUTO_PROCESS`
      );
      tags.push('CONTEXT_OVERRIDE_APPLIED');
      return autoProcess(inferredMode, reasoning, tags);
    }

    return requireValidation(inferredMode, validationReason, reasoning, 'MEDIUM', tags);
  }

  // ---------------------------------------------------------------------------
  // Rule 2: BUS policy — checked BEFORE AUTO_PROCESS rules so it cannot be
  // bypassed by a MEDIUM tiebreak that resolves to BUS.
  // ---------------------------------------------------------------------------
  if (inferredMode === 'BUS' && rules.busAlwaysRequiresValidation) {
    const validationReason = 'Bus journey always requires step-up validation per configuration';
    reasoning.push('Rule: busAlwaysRequiresValidation=true -> REQUIRE_VALIDATION');
    tags.push('BUS_POLICY_VALIDATION');
    return requireValidation(inferredMode, validationReason, reasoning, 'MEDIUM', tags);
  }

  // ---------------------------------------------------------------------------
  // Rule 3: HIGH correlation, no ambiguity -> AUTO_PROCESS (correlation PRIMARY)
  // ---------------------------------------------------------------------------
  if (correlationConfidence === 'HIGH' && !ambiguity) {
    reasoning.push(
      `[PRIMARY] AUTO_PROCESS - single mode ${inferredMode} confirmed by ` +
      (correlationResult.crossModeConfirmed
        ? 'cross-mode consistency rule'
        : 'single in-range result') +
      ` - HIGH correlation confidence`
    );
    if (!correlationResult.crossModeConfirmed) tags.push('SINGLE_MODE_IN_RANGE');
    return autoProcess(inferredMode, reasoning, tags);
  }

  // ---------------------------------------------------------------------------
  // Rule 4: MEDIUM correlation, no ambiguity -> AUTO_PROCESS (tiebreak resolved)
  // ---------------------------------------------------------------------------
  if (correlationConfidence === 'MEDIUM' && !ambiguity) {
    reasoning.push(
      `[PRIMARY] AUTO_PROCESS - MEDIUM confidence, tiebreak resolved to ${inferredMode}, ambiguity=false`
    );
    tags.push('TIEBREAK_RESOLVED');
    return autoProcess(inferredMode, reasoning, tags);
  }

  // ---------------------------------------------------------------------------
  // Rule 5: UNKNOWN mode -> apply config action
  // ---------------------------------------------------------------------------
  if (inferredMode === 'UNKNOWN') {
    reasoning.push(`Inferred mode UNKNOWN - applying unknownModeAction=${rules.unknownModeAction}`);
    tags.push('MODE_UNKNOWN');
    if (rules.unknownModeAction === DECISION_OUTCOME.REQUIRE_VALIDATION) {
      return requireValidation(
        'UNKNOWN', 'Journey mode could not be inferred - validation required per configuration',
        reasoning, 'LOW', tags
      );
    }
    return autoProcess('UNKNOWN', [...reasoning, 'AUTO_PROCESS - unknownModeAction=AUTO_PROCESS'], tags);
  }

  // ---------------------------------------------------------------------------
  // Rule 6: LOW correlation confidence -> apply config action
  // Gap 3.3: Approach 1 can optionally SUPPORT this decision when correlation is LOW
  // ---------------------------------------------------------------------------
  if (correlationConfidence === 'LOW') {
    reasoning.push(`Correlation confidence LOW - applying lowCorrelationConfidenceAction=${rules.lowCorrelationConfidenceAction}`);
    tags.push('LOW_CORRELATION_CONFIDENCE');

    // Gap 3.3: if Approach 1 is available and strong, note it as supporting evidence
    if (confidenceScore != null && confidenceScore >= (cfg.thresholds?.highCorrelationMinScore ?? 0.75)) {
      reasoning.push(
        `[SUPPORTING] Approach1 score ${confidenceScore} is strong - supporting LOW-confidence correlation result`
      );
    }

    if (rules.lowCorrelationConfidenceAction === DECISION_OUTCOME.REQUIRE_VALIDATION) {
      return requireValidation(
        inferredMode, 'Low correlation confidence - validation required per configuration',
        reasoning, 'LOW', tags
      );
    }
    return autoProcess(inferredMode, [...reasoning, 'AUTO_PROCESS - lowCorrelationConfidenceAction=AUTO_PROCESS'], tags);
  }

  // Fallback
  reasoning.push('AUTO_PROCESS - no matching rule triggered (fallback)');
  tags.push('FALLBACK_RULE');
  return autoProcess(inferredMode, reasoning, tags);
}
