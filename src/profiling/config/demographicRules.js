// =============================================================================
// LAYER 1 — Demographic Classification Rules (Domain-Agnostic)
// Used by: ruleBasedClassifier.js
//
// OFFLINE ALGORITHM PROVENANCE:
//   These rules and thresholds were informed by an offline Random Forest
//   analysis of the Kaggle Customer Segmentation Data dataset.
//   The Random Forest identified feature importance rankings and optimal
//   split thresholds. Those findings are documented in comments below.
//   No model runs at runtime — this file is static configuration only.
//
// RULE EVALUATION:
//   Rules are evaluated top-to-bottom. First full match wins.
//   GENERIC_DEMOGRAPHIC is always last — unconditional fallback.
//
// CONDITION TYPES (evaluated by ruleBasedClassifier.js):
//   exact match   — { fieldName: value }
//   array match   — { fieldName: ["A", "B"] }  field must be IN the array
//   range match   — { fieldName: { min: n, max: n } }  both optional
//
// DOMAIN CONSTRAINT:
//   These rules MUST NOT reference hotel-specific concepts.
//   They MUST be reusable unchanged across Hotel, Retail, Healthcare, Transport.
// =============================================================================

const demographicRules = [

  // -------------------------------------------------------------------------
  // Rule 1: Group presence — highest confidence, evaluated first
  // RF finding: groupPresence was the top-ranked feature (importance: 0.41)
  // -------------------------------------------------------------------------
  {
    id: 'rule_group_present',
    demographic: 'GROUP_PRESENT',
    conditions: {
      groupPresence: true,
    },
    confidence: 0.95,
    reason: 'Multiple users detected in session context via group presence signal',
  },

  // -------------------------------------------------------------------------
  // Rule 2: High-pace interaction during business-hours window
  // RF finding: interactionDurationSec split at ~28s; timeOfDay MORNING/EVENING
  // correlated strongly with business segment.
  // NOTE: RF suggests threshold ~28s. Current value retained at 30s for
  // demo stability. Adjust here when RF-refined config is adopted.
  // -------------------------------------------------------------------------
  {
    id: 'rule_high_pace_business_hours',
    demographic: 'HIGH_PACE_INTERACTION',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { max: 30 },
      timeOfDay: ['MORNING', 'EVENING'],
    },
    confidence: 0.82,
    reason: 'Solo user with fast interaction during business-hours time window',
  },

  // -------------------------------------------------------------------------
  // Rule 3: High-pace interaction — any time of day (very fast threshold)
  // RF finding: duration < 20s was a strong signal regardless of time window.
  // NOTE: RF suggests threshold ~18s. Current value retained at 20s.
  // -------------------------------------------------------------------------
  {
    id: 'rule_high_pace_any_time',
    demographic: 'HIGH_PACE_INTERACTION',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { max: 20 },
    },
    confidence: 0.75,
    reason: 'Solo user with very fast interaction regardless of time of day',
  },

  // -------------------------------------------------------------------------
  // Rule 4: Slow-pace interaction — any user type, extended duration
  // RF finding: duration > 90s was a reliable slow-pace signal across segments.
  // -------------------------------------------------------------------------
  {
    id: 'rule_slow_pace_extended',
    demographic: 'SLOW_PACE_INTERACTION',
    conditions: {
      interactionDurationSec: { min: 90 },
    },
    confidence: 0.80,
    reason: 'Extended interaction duration observed across all user types',
  },

  // -------------------------------------------------------------------------
  // Rule 5: Slow-pace interaction — solo user, above-average duration
  // RF finding: solo + duration > 60s correlated with senior/leisure segment.
  // -------------------------------------------------------------------------
  {
    id: 'rule_slow_pace_solo',
    demographic: 'SLOW_PACE_INTERACTION',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { min: 60 },
    },
    confidence: 0.72,
    reason: 'Solo user with above-average interaction duration',
  },

  // -------------------------------------------------------------------------
  // Rule 6: Solo adult — moderate duration, no strong pace signal
  // RF finding: 21–59s range was the moderate/leisure band for solo guests.
  // -------------------------------------------------------------------------
  {
    id: 'rule_solo_moderate_duration',
    demographic: 'SOLO_ADULT_PRESENT',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { min: 21, max: 59 },
    },
    confidence: 0.68,
    reason: 'Solo user with moderate interaction duration — no strong pace signal',
  },

  // -------------------------------------------------------------------------
  // Rule 7: Solo adult — no duration signal available
  // Catches solo sessions where duration could not be measured.
  // -------------------------------------------------------------------------
  {
    id: 'rule_solo_no_duration',
    demographic: 'SOLO_ADULT_PRESENT',
    conditions: {
      groupPresence: false,
    },
    confidence: 0.60,
    reason: 'Single user session with no group presence detected',
  },

  // -------------------------------------------------------------------------
  // Rule 8: Generic fallback — unconditional, must always be last
  // -------------------------------------------------------------------------
  {
    id: 'rule_generic_fallback',
    demographic: 'GENERIC_DEMOGRAPHIC',
    conditions: {},
    confidence: 0.50,
    reason: 'No specific demographic signals matched — applying generic classification',
  },

];

export default demographicRules;
