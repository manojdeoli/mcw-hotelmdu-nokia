// =============================================================================
// Classifier Strategy
// Used by: profiling/index.js
//
// Single routing function that selects and invokes the correct classifier
// based on options.classifier. Neither classifier knows about the other.
// No caller outside this module should invoke a classifier directly.
//
// DEFAULT: RULE_BASED — preserves existing behaviour, zero regression risk.
// SWITCH:  Change DEFAULT_CLASSIFIER in App.js to 'TREE_BASED' for demo.
//
// Adding a new classifier in the future:
//   1. Create the classifier in profiling/classifiers/
//   2. Add its key to CLASSIFIER_TYPES in ProfilingDecision.js
//   3. Add a case here — no other files need to change
// =============================================================================

import { CLASSIFIER_TYPES } from './ProfilingDecision.js';
import { ruleBasedClassifier }    from './classifiers/ruleBasedClassifier.js';
import { treeBasedClassifier }    from './classifiers/treeBasedClassifier.js';
import { clusterBasedClassifier } from './classifiers/clusterBasedClassifier.js';
import demographicRules           from './config/demographicRules.js';
import decisionTree               from './config/decisionTree.js';
import personaDecisionTree        from './config/personaDecisionTree.js';
import clusterCentroids           from './config/clusterCentroids.js';

/**
 * Routes a SessionContext to the appropriate classifier and returns a
 * ProfilingDecision. All classifiers emit the same output contract.
 *
 * @param {object} sessionContext         — frozen SessionContext
 * @param {object} [options]              — routing options
 * @param {string} [options.classifier]   — one of CLASSIFIER_TYPES, default RULE_BASED
 * @returns {object} ProfilingDecision
 */
export function runClassifier(sessionContext, options = {}) {
  const classifierType = options.classifier || CLASSIFIER_TYPES.RULE_BASED;

  switch (classifierType) {

    case CLASSIFIER_TYPES.TREE_BASED:
      return treeBasedClassifier(sessionContext, decisionTree);

    case CLASSIFIER_TYPES.PERSONA_TREE:
      return treeBasedClassifier(sessionContext, personaDecisionTree);

    case CLASSIFIER_TYPES.CLUSTER_BASED:
      // Phase 3 — will throw a descriptive not-implemented error
      return clusterBasedClassifier(sessionContext, clusterCentroids);

    case CLASSIFIER_TYPES.RULE_BASED:
    default:
      // Default path — identical behaviour to original classifyDemographic()
      return ruleBasedClassifier(sessionContext, demographicRules);
  }
}

// Re-export CLASSIFIER_TYPES so App.js only needs one import
export { CLASSIFIER_TYPES };
