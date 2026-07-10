// =============================================================================
// ClusteringClassifier — Interface Contract (Phase 3 Placeholder)
//
// This file defines the interface that a cluster-based classifier must satisfy.
// It is NOT implemented. Calling clusterBasedClassifier() will throw a
// descriptive error.
//
// PURPOSE:
//   Ensures Phase 3 implementation requires zero changes to classifierStrategy.js,
//   profiling/index.js, App.js, or any downstream consumer.
//   The interface is defined now so the contract is clear before implementation.
//
// PHASE 3 REQUIREMENTS (before implementation):
//   1. Offline K-Means run on labeled session data (min ~500 sessions)
//   2. clusterCentroids.js populated with k centroid objects
//   3. Feature normalisation function implemented (sessionContext → vector)
//   4. Euclidean distance computation implemented
//   5. Nearest centroid assignment implemented
//
// EXPECTED BEHAVIOUR (when implemented):
//   - Normalise sessionContext fields to [0, 1] range
//   - Compute Euclidean distance to each centroid in clusterCentroids.js
//   - Assign the demographic label of the nearest centroid
//   - Return a ProfilingDecision with:
//       classifierType: 'CLUSTER_BASED'
//       trace: { nearestCentroid: 'C1', distance: 0.34, allDistances: {...} }
//       algorithmSource.offlineAlgorithm: 'K_MEANS'
//
// RUNTIME CONSTRAINT:
//   No training, no model file, no probabilistic outputs.
//   Only arithmetic on static centroid values from clusterCentroids.js.
// =============================================================================

import { CLASSIFIER_TYPES } from '../ProfilingDecision.js';

/**
 * Phase 3 cluster-based classifier — NOT IMPLEMENTED.
 *
 * @param {object} sessionContext — frozen SessionContext from assembleSessionContext()
 * @param {Array}  centroidConfig — array of centroid objects from clusterCentroids.js
 * @returns {object} ProfilingDecision — when implemented
 * @throws {Error} always — until Phase 3 is implemented
 */
export function clusterBasedClassifier(sessionContext, centroidConfig) {
  throw new Error(
    '[ClusterBasedClassifier] Not implemented — Phase 3 only. ' +
    'Requires offline K-Means centroid derivation from labeled session data. ' +
    'See src/profiling/interfaces/ClusteringClassifier.js for requirements. ' +
    `Classifier type requested: ${CLASSIFIER_TYPES.CLUSTER_BASED}`
  );
}

/**
 * Normalises a sessionContext into a numeric feature vector for distance computation.
 * Phase 3 implementation stub — documents the normalisation contract.
 *
 * @param {object} sessionContext
 * @returns {object} normalised feature vector
 */
export function normaliseSessionContext(sessionContext) {
  // Phase 3 implementation:
  // return {
  //   groupPresence:          sessionContext.groupPresence ? 1.0 : 0.0,
  //   interactionDurationSec: Math.min(sessionContext.interactionDurationSec / 120, 1.0),
  //   timeOfDayEncoded:       { MORNING: 0.0, AFTERNOON: 0.33, EVENING: 0.66, NIGHT: 1.0 }
  //                           [sessionContext.timeOfDay] ?? 0.5,
  //   membershipTierEncoded:  { null: 0.0, STANDARD: 0.33, LOYALTY: 0.66, PREMIUM: 1.0 }
  //                           [sessionContext.membershipTier] ?? 0.0,
  // };
  throw new Error('[normaliseSessionContext] Not implemented — Phase 3 only.');
}

/**
 * Computes Euclidean distance between two normalised feature vectors.
 * Phase 3 implementation stub.
 *
 * @param {object} vectorA
 * @param {object} vectorB
 * @returns {number} Euclidean distance
 */
export function euclideanDistance(vectorA, vectorB) {
  // Phase 3 implementation:
  // return Math.sqrt(
  //   Object.keys(vectorA).reduce((sum, key) => {
  //     return sum + Math.pow((vectorA[key] || 0) - (vectorB[key] || 0), 2);
  //   }, 0)
  // );
  throw new Error('[euclideanDistance] Not implemented — Phase 3 only.');
}
