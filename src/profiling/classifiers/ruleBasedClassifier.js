// =============================================================================
// Rule-Based Classifier
// Used by: classifierStrategy.js
//
// Evaluates demographicRules top-to-bottom against a SessionContext.
// First rule where ALL conditions pass wins. GENERIC_DEMOGRAPHIC is the
// unconditional fallback (always last in the rules array).
//
// This is the DEFAULT classifier. Its behaviour is identical to the original
// classifyDemographic() function — zero regression risk.
//
// OFFLINE ALGORITHM PROVENANCE:
//   Rule thresholds and feature ordering were informed by an offline
//   Random Forest analysis of the Kaggle Customer Segmentation Data dataset.
//   Feature importance rankings determined rule ordering.
//   No model runs at runtime.
//
// OUTPUT: ProfilingDecision with classifierType: 'RULE_BASED'
//   trace.matchedRule — the exact rule object that fired (for audit/replay)
// =============================================================================

import { createProfilingDecision, CLASSIFIER_TYPES } from '../ProfilingDecision.js';

// ---------------------------------------------------------------------------
// Condition evaluator — supports exact, array-includes, and range checks
// ---------------------------------------------------------------------------

/**
 * Evaluates a single condition value against a context field value.
 *
 * @param {*}      contextValue   — value from sessionContext
 * @param {*}      conditionValue — value from rule condition
 * @returns {boolean}
 */
function evaluateCondition(contextValue, conditionValue) {
  // Range check: { min?, max? }
  if (
    conditionValue !== null &&
    typeof conditionValue === 'object' &&
    !Array.isArray(conditionValue)
  ) {
    const { min, max } = conditionValue;
    if (min !== undefined && contextValue < min) return false;
    if (max !== undefined && contextValue > max) return false;
    return true;
  }

  // Array-includes check: field value must be one of the listed values
  if (Array.isArray(conditionValue)) {
    return conditionValue.includes(contextValue);
  }

  // Exact match
  return contextValue === conditionValue;
}

/**
 * Returns true if ALL conditions in a rule match the session context.
 *
 * @param {object} context    — frozen SessionContext
 * @param {object} conditions — rule.conditions object
 * @returns {boolean}
 */
function ruleMatches(context, conditions) {
  return Object.entries(conditions).every(([field, conditionValue]) =>
    evaluateCondition(context[field], conditionValue)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies a SessionContext using the rule-based engine.
 * Rules are evaluated top-to-bottom; first full match wins.
 *
 * @param {object} sessionContext — frozen SessionContext from assembleSessionContext()
 * @param {Array}  rules          — demographicRules array
 * @returns {object} ProfilingDecision
 */
export function ruleBasedClassifier(sessionContext, rules) {
  if (!sessionContext || typeof sessionContext !== 'object') {
    throw new Error('[ruleBasedClassifier] sessionContext must be a non-null object');
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('[ruleBasedClassifier] rules must be a non-empty array');
  }

  for (const rule of rules) {
    if (ruleMatches(sessionContext, rule.conditions)) {
      return createProfilingDecision({
        demographic:         rule.demographic,
        confidence:          rule.confidence,
        reason:              rule.reason,
        classifierType:      CLASSIFIER_TYPES.RULE_BASED,
        trace: {
          matchedRule: rule,
        },
        membershipInfluenced: false,
        membershipTier:       sessionContext.membershipTier || null,
        sessionContext,
      });
    }
  }

  // Defensive fallback — should never reach here if rules ends with
  // GENERIC_DEMOGRAPHIC (empty conditions), but guard robustly.
  return createProfilingDecision({
    demographic:         'GENERIC_DEMOGRAPHIC',
    confidence:          0.50,
    reason:              'No rule matched — defensive fallback applied',
    classifierType:      CLASSIFIER_TYPES.RULE_BASED,
    trace: {
      matchedRule: null,
    },
    membershipInfluenced: false,
    membershipTier:       sessionContext.membershipTier || null,
    sessionContext,
  });
}
