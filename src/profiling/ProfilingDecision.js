// =============================================================================
// ProfilingDecision — Common Output Contract
//
// Every classifier (rule-based, tree-based, cluster-based) MUST return an
// object produced by createProfilingDecision(). This guarantees a consistent
// shape for all downstream consumers: App.js, logApiInteraction, GuestTab.
//
// No consumer ever needs to know which classifier ran — they depend only on
// this contract.
//
// Fields:
//   demographic          string   — Layer 1 label (domain-agnostic)
//   confidence           number   — 0.0 – 1.0
//   reason               string   — human-readable explanation
//   classifierType       string   — 'RULE_BASED' | 'TREE_BASED' | 'CLUSTER_BASED'
//   trace                object   — explainability trace (shape varies per classifier)
//   membershipInfluenced boolean  — true if a membership/rewards node was decisive
//   membershipTier       string|null — 'PREMIUM' | 'LOYALTY' | 'STANDARD' | null
//   algorithmSource      object   — offline algorithm provenance for demo explainability
//   sessionContext       object   — frozen snapshot for replay and audit
// =============================================================================

// ---------------------------------------------------------------------------
// Valid classifier types — single source of truth
// ---------------------------------------------------------------------------
export const CLASSIFIER_TYPES = Object.freeze({
  RULE_BASED:    'RULE_BASED',
  TREE_BASED:    'TREE_BASED',
  CLUSTER_BASED: 'CLUSTER_BASED',
  PERSONA_TREE:  'PERSONA_TREE',
});

// ---------------------------------------------------------------------------
// Valid demographic labels — single source of truth
// ---------------------------------------------------------------------------
export const DEMOGRAPHIC_LABELS = Object.freeze({
  GROUP_PRESENT:        'GROUP_PRESENT',
  HIGH_PACE_INTERACTION: 'HIGH_PACE_INTERACTION',
  SLOW_PACE_INTERACTION: 'SLOW_PACE_INTERACTION',
  SOLO_ADULT_PRESENT:   'SOLO_ADULT_PRESENT',
  GENERIC_DEMOGRAPHIC:  'GENERIC_DEMOGRAPHIC',
});

// ---------------------------------------------------------------------------
// Valid membership tiers — single source of truth
// ---------------------------------------------------------------------------
export const MEMBERSHIP_TIERS = Object.freeze({
  PREMIUM:  'PREMIUM',
  LOYALTY:  'LOYALTY',
  STANDARD: 'STANDARD',
});

// ---------------------------------------------------------------------------
// Offline algorithm provenance descriptors
// ---------------------------------------------------------------------------
const ALGORITHM_SOURCE = Object.freeze({
  RANDOM_FOREST: Object.freeze({
    offlineAlgorithm: 'RANDOM_FOREST',
    datasetReference: 'Kaggle — Customer Segmentation Data (ravalsmit)',
    note: 'Feature importance and thresholds derived offline. No model runs at runtime.',
  }),
  DECISION_TREE: Object.freeze({
    offlineAlgorithm: 'DECISION_TREE',
    datasetReference: 'Kaggle — Customer Segmentation Data (ravalsmit)',
    note: 'Tree structure transcribed from offline analysis. No model runs at runtime.',
  }),
  K_MEANS: Object.freeze({
    offlineAlgorithm: 'K_MEANS',
    datasetReference: 'Kaggle — Customer Segmentation Data (ravalsmit)',
    note: 'Cluster centroids derived offline. No model runs at runtime.',
  }),
  PERSONA_TREE: Object.freeze({
    offlineAlgorithm: 'PERSONA_DECISION_TREE',
    datasetReference: 'Kaggle — Customer Segmentation Data (ravalsmit)',
    note: 'Persona tree trained from labelled dataset. No model runs at runtime.',
    modelSource: 'trained_from_labelled_data',
    trainingMode: 'rule-derived-supervised-learning',
    trainingDisclaimer: 'Model replicates rule-based labelling; enables transition to real data later.',
    dataType: 'synthetic-labelled-proxy-dataset',
  }),
});

// ---------------------------------------------------------------------------
// Factory function — the ONLY way classifiers should construct their output
// ---------------------------------------------------------------------------

/**
 * Creates a validated, frozen ProfilingDecision object.
 *
 * @param {object} fields
 * @param {string}      fields.demographic          — one of DEMOGRAPHIC_LABELS
 * @param {number}      fields.confidence            — 0.0 – 1.0
 * @param {string}      fields.reason                — human-readable explanation
 * @param {string}      fields.classifierType        — one of CLASSIFIER_TYPES
 * @param {object}      fields.trace                 — explainability trace
 * @param {boolean}     [fields.membershipInfluenced] — default false
 * @param {string|null} [fields.membershipTier]       — default null
 * @param {object}      fields.sessionContext         — frozen SessionContext
 * @returns {object} frozen ProfilingDecision
 */
export function createProfilingDecision({
  demographic,
  confidence,
  reason,
  classifierType,
  trace,
  membershipInfluenced = false,
  membershipTier = null,
  sessionContext,
}) {
  // --- Validation ---
  if (!Object.values(DEMOGRAPHIC_LABELS).includes(demographic)) {
    console.warn(`[ProfilingDecision] Unknown demographic label: "${demographic}". Falling back to GENERIC_DEMOGRAPHIC.`);
    demographic = DEMOGRAPHIC_LABELS.GENERIC_DEMOGRAPHIC;
  }

  if (!Object.values(CLASSIFIER_TYPES).includes(classifierType)) {
    throw new Error(`[ProfilingDecision] Invalid classifierType: "${classifierType}"`);
  }

  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    console.warn(`[ProfilingDecision] Invalid confidence value: ${confidence}. Clamping to [0, 1].`);
    confidence = Math.max(0, Math.min(1, Number(confidence) || 0.5));
  }

  // Resolve algorithm source from classifier type
  const algorithmSourceMap = {
    [CLASSIFIER_TYPES.RULE_BASED]:    ALGORITHM_SOURCE.RANDOM_FOREST,
    [CLASSIFIER_TYPES.TREE_BASED]:    ALGORITHM_SOURCE.DECISION_TREE,
    [CLASSIFIER_TYPES.CLUSTER_BASED]: ALGORITHM_SOURCE.K_MEANS,
    [CLASSIFIER_TYPES.PERSONA_TREE]:  ALGORITHM_SOURCE.PERSONA_TREE,
  };

  return Object.freeze({
    demographic,
    confidence,
    reason: reason || 'No reason provided',
    classifierType,
    trace: Object.freeze(trace || {}),
    membershipInfluenced: Boolean(membershipInfluenced),
    membershipTier: membershipTier || null,
    algorithmSource: algorithmSourceMap[classifierType],
    sessionContext,
  });
}
