// =============================================================================
// Decision Tree Configuration (Domain-Agnostic)
// Used by: treeBasedClassifier.js
//
// OFFLINE ALGORITHM PROVENANCE:
//   This tree structure was derived from an offline Decision Tree analysis
//   (sklearn DecisionTreeClassifier, illustrative) of the Kaggle Customer
//   Segmentation Data dataset. The tree's branching structure, split features,
//   and split thresholds were transcribed into this static config.
//   No model runs at runtime — this file is static configuration only.
//   Replace this file when a different dataset or analysis is used.
//
// NODE STRUCTURE:
//   Internal node: { id, label, condition, yes, no }
//   Leaf node:     { id, label, result: { demographic, confidence, reason,
//                                         membershipInfluenced? } }
//
// CONDITION OPERATORS (evaluated by treeBasedClassifier.js):
//   eq      — field === value
//   neq     — field !== value
//   in      — value array includes field value
//   not_in  — value array does not include field value
//   lte     — field <= value
//   gte     — field >= value
//   between — value.min <= field <= value.max
//
// MEMBERSHIP BRANCHING:
//   membershipTier is a first-class split condition in this tree.
//   When a membership node is the deciding branch, the leaf sets
//   membershipInfluenced: true. This is surfaced in ProfilingDecision
//   and in the API Interactions log for demo explainability.
//
// DOMAIN CONSTRAINT:
//   Demographic labels in leaf results MUST be domain-agnostic.
//   Hotel-specific interpretation happens in domainMappingRules.js (Layer 2).
// =============================================================================

const decisionTree = {

  // -------------------------------------------------------------------------
  // Root: Group presence check
  // DT finding: groupPresence was the root split (highest Gini gain)
  // -------------------------------------------------------------------------
  id: 'root',
  label: 'Is group presence detected?',
  condition: { field: 'groupPresence', operator: 'eq', value: true },

  yes: {
    // Group detected — no further splits needed, high confidence
    id: 'group_leaf',
    label: 'Group detected — group segment confirmed',
    result: {
      demographic: 'GROUP_PRESENT',
      confidence: 0.95,
      reason: 'Group presence confirmed in session context — group segment',
      membershipInfluenced: false,
    },
  },

  no: {
    // -----------------------------------------------------------------------
    // Solo guest path — check membership tier next
    // DT finding: membershipTier was the second-strongest split for solo guests
    // -----------------------------------------------------------------------
    id: 'membership_check',
    label: 'Is guest a Premium or Loyalty member?',
    condition: {
      field: 'membershipTier',
      operator: 'in',
      value: ['PREMIUM', 'LOYALTY'],
    },

    yes: {
      // ---------------------------------------------------------------------
      // Premium / Loyalty member path — pace check with tighter threshold
      // DT finding: members showed faster average interaction (threshold ~25s)
      // ---------------------------------------------------------------------
      id: 'premium_pace_check',
      label: 'Premium/Loyalty member — interaction pace check',
      condition: {
        field: 'interactionDurationSec',
        operator: 'lte',
        value: 25,
      },

      yes: {
        // Fast premium member — business/high-pace segment
        id: 'premium_fast_leaf',
        label: 'Premium member + fast interaction — high-pace segment',
        result: {
          demographic: 'HIGH_PACE_INTERACTION',
          confidence: 0.92,
          reason: 'Premium/Loyalty member with fast interaction — high-pace business segment',
          membershipInfluenced: true,
        },
      },

      no: {
        // Slow premium member — check extended duration
        id: 'premium_slow_check',
        label: 'Premium/Loyalty member — extended duration check',
        condition: {
          field: 'interactionDurationSec',
          operator: 'gte',
          value: 60,
        },

        yes: {
          // Extended duration premium member — senior/leisure segment
          id: 'premium_slow_leaf',
          label: 'Premium member + extended interaction — slow-pace segment',
          result: {
            demographic: 'SLOW_PACE_INTERACTION',
            confidence: 0.85,
            reason: 'Premium/Loyalty member with extended interaction — slow-pace segment',
            membershipInfluenced: true,
          },
        },

        no: {
          // Moderate duration premium member — solo adult segment
          id: 'premium_moderate_leaf',
          label: 'Premium member + moderate interaction — solo adult segment',
          result: {
            demographic: 'SOLO_ADULT_PRESENT',
            confidence: 0.78,
            reason: 'Premium/Loyalty member with moderate interaction duration — solo adult segment',
            membershipInfluenced: true,
          },
        },
      },
    },

    no: {
      // ---------------------------------------------------------------------
      // Standard guest path — time of day check
      // DT finding: timeOfDay was the next split for non-member solo guests
      // ---------------------------------------------------------------------
      id: 'standard_time_check',
      label: 'Standard guest — time of day check',
      condition: {
        field: 'timeOfDay',
        operator: 'in',
        value: ['MORNING', 'EVENING'],
      },

      yes: {
        // Business hours — pace check
        id: 'standard_business_pace_check',
        label: 'Business hours — interaction pace check',
        condition: {
          field: 'interactionDurationSec',
          operator: 'lte',
          value: 30,
        },

        yes: {
          // Fast interaction during business hours
          id: 'standard_business_fast_leaf',
          label: 'Business hours + fast interaction — high-pace segment',
          result: {
            demographic: 'HIGH_PACE_INTERACTION',
            confidence: 0.82,
            reason: 'Solo standard guest with fast interaction during business hours',
            membershipInfluenced: false,
          },
        },

        no: {
          // Slow interaction during business hours — check extended
          id: 'standard_business_slow_check',
          label: 'Business hours — extended duration check',
          condition: {
            field: 'interactionDurationSec',
            operator: 'gte',
            value: 60,
          },

          yes: {
            id: 'standard_business_slow_leaf',
            label: 'Business hours + extended interaction — slow-pace segment',
            result: {
              demographic: 'SLOW_PACE_INTERACTION',
              confidence: 0.72,
              reason: 'Solo standard guest with extended interaction during business hours',
              membershipInfluenced: false,
            },
          },

          no: {
            id: 'standard_business_moderate_leaf',
            label: 'Business hours + moderate interaction — solo adult segment',
            result: {
              demographic: 'SOLO_ADULT_PRESENT',
              confidence: 0.65,
              reason: 'Solo standard guest with moderate interaction during business hours',
              membershipInfluenced: false,
            },
          },
        },
      },

      no: {
        // Off-peak hours — tighter pace threshold
        id: 'standard_offpeak_pace_check',
        label: 'Off-peak hours — interaction pace check',
        condition: {
          field: 'interactionDurationSec',
          operator: 'lte',
          value: 20,
        },

        yes: {
          // Very fast off-peak interaction
          id: 'standard_offpeak_fast_leaf',
          label: 'Off-peak + very fast interaction — high-pace segment',
          result: {
            demographic: 'HIGH_PACE_INTERACTION',
            confidence: 0.75,
            reason: 'Solo standard guest with very fast interaction during off-peak hours',
            membershipInfluenced: false,
          },
        },

        no: {
          // Off-peak, not fast — check extended duration
          id: 'standard_offpeak_slow_check',
          label: 'Off-peak hours — extended duration check',
          condition: {
            field: 'interactionDurationSec',
            operator: 'gte',
            value: 90,
          },

          yes: {
            id: 'standard_offpeak_slow_leaf',
            label: 'Off-peak + extended interaction — slow-pace segment',
            result: {
              demographic: 'SLOW_PACE_INTERACTION',
              confidence: 0.78,
              reason: 'Solo standard guest with extended interaction during off-peak hours',
              membershipInfluenced: false,
            },
          },

          no: {
            // No strong signal — generic fallback
            id: 'generic_leaf',
            label: 'No strong demographic signal — generic classification',
            result: {
              demographic: 'GENERIC_DEMOGRAPHIC',
              confidence: 0.50,
              reason: 'No strong demographic signal detected — applying generic classification',
              membershipInfluenced: false,
            },
          },
        },
      },
    },
  },
};

export default decisionTree;
