// =============================================================================
// Cluster-Based Classifier — Phase 3 Placeholder
// Used by: classifierStrategy.js (routes here when CLUSTER_BASED is selected)
//
// NOT IMPLEMENTED. Calling classify() will throw a descriptive error.
//
// See src/profiling/interfaces/ClusteringClassifier.js for the full
// interface contract and Phase 3 implementation requirements.
//
// OFFLINE ALGORITHM PROVENANCE (when implemented):
//   Cluster centroids to be derived offline via K-Means (k=5) on the
//   Kaggle Customer Segmentation Data dataset.
//   Runtime: compute Euclidean distance from normalised sessionContext
//   vector to each centroid. Assign nearest centroid's demographic label.
//   No training, no model file — only arithmetic on static centroid values.
// =============================================================================

import { CLASSIFIER_TYPES } from '../ProfilingDecision.js';

/**
 * Phase 3 cluster-based classifier — NOT IMPLEMENTED.
 * Throws a descriptive error to prevent silent failures.
 *
 * @param {object} sessionContext — frozen SessionContext
 * @param {Array}  centroidConfig — array from clusterCentroids.js
 * @throws {Error} always
 */
export function clusterBasedClassifier(sessionContext, centroidConfig) {
  throw new Error(
    '[ClusterBasedClassifier] Not implemented — Phase 3 only.\n' +
    'Requirements before implementation:\n' +
    '  1. Run K-Means (k=5) offline on labeled session data (min ~500 sessions)\n' +
    '  2. Populate src/profiling/config/clusterCentroids.js with centroid objects\n' +
    '  3. Implement normaliseSessionContext() in interfaces/ClusteringClassifier.js\n' +
    '  4. Implement euclideanDistance() in interfaces/ClusteringClassifier.js\n' +
    `  5. Set classifier option to "${CLASSIFIER_TYPES.CLUSTER_BASED}" in App.js\n` +
    'See src/profiling/interfaces/ClusteringClassifier.js for full contract.'
  );
}
