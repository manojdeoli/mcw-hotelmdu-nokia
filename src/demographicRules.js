// =============================================================================
// LAYER 1 — Demographic Classification Rules (Domain-Agnostic)
//
// Rules are evaluated top-to-bottom. First full match wins.
// GENERIC_DEMOGRAPHIC is always last and has no conditions (unconditional fallback).
//
// Condition types supported by the classifier:
//   exact match   — { fieldName: value }
//   array match   — { fieldName: ["VALUE_A", "VALUE_B"] }  (field must be IN the array)
//   range match   — { fieldName: { min: n } | { max: n } | { min: n, max: n } }
//
// These rules MUST NOT reference any hotel-specific concepts.
// They MUST be reusable unchanged across Hotel, Retail, Healthcare, Transport.
// =============================================================================

const demographicRules = [
  {
    demographic: 'GROUP_PRESENT',
    conditions: {
      groupPresence: true,
    },
    confidence: 0.95,
    reason: 'Multiple users detected in session context via group presence signal',
  },

  {
    demographic: 'HIGH_PACE_INTERACTION',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { max: 30 },
      timeOfDay: ['MORNING', 'EVENING'],
    },
    confidence: 0.82,
    reason: 'Solo user with fast interaction during business-hours time window',
  },

  {
    demographic: 'HIGH_PACE_INTERACTION',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { max: 20 },
    },
    confidence: 0.75,
    reason: 'Solo user with very fast interaction regardless of time of day',
  },

  {
    demographic: 'SLOW_PACE_INTERACTION',
    conditions: {
      interactionDurationSec: { min: 90 },
    },
    confidence: 0.80,
    reason: 'Extended interaction duration observed across all user types',
  },

  {
    demographic: 'SLOW_PACE_INTERACTION',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { min: 60 },
    },
    confidence: 0.72,
    reason: 'Solo user with above-average interaction duration',
  },

  {
    demographic: 'SOLO_ADULT_PRESENT',
    conditions: {
      groupPresence: false,
      interactionDurationSec: { min: 21, max: 59 },
    },
    confidence: 0.68,
    reason: 'Solo user with moderate interaction duration — no strong pace signal',
  },

  {
    demographic: 'SOLO_ADULT_PRESENT',
    conditions: {
      groupPresence: false,
    },
    confidence: 0.60,
    reason: 'Single user session with no group presence detected',
  },

  // Unconditional fallback — must always be last
  {
    demographic: 'GENERIC_DEMOGRAPHIC',
    conditions: {},
    confidence: 0.50,
    reason: 'No specific demographic signals matched — applying generic classification',
  },
];

export default demographicRules;
