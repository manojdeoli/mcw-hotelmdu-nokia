// =============================================================================
// Cluster Centroids Configuration — Phase 3 Placeholder
// Used by: clusterBasedClassifier.js (Phase 3 — NOT IMPLEMENTED)
//
// OFFLINE ALGORITHM PROVENANCE:
//   Centroids to be derived offline via K-Means clustering (k=5) on the
//   Kaggle Customer Segmentation Data dataset.
//   Each centroid represents the feature-space centre of a natural guest segment.
//
// CENTROID SCHEMA (when populated):
//   Each centroid object should contain:
//   {
//     id:                    string   — centroid identifier e.g. 'C1'
//     demographic:           string   — demographic label for this cluster
//     confidence:            number   — average within-cluster confidence
//     reason:                string   — human-readable cluster description
//     features: {
//       groupPresence:        number   — 0.0 (solo) to 1.0 (group) — normalised
//       interactionDurationSec: number — normalised 0.0 – 1.0
//       timeOfDayEncoded:     number   — MORNING=0, AFTERNOON=0.33, EVENING=0.66, NIGHT=1.0
//       membershipTierEncoded: number  — null=0, STANDARD=0.33, LOYALTY=0.66, PREMIUM=1.0
//     }
//   }
//
// RUNTIME USAGE (Phase 3):
//   The clusterBasedClassifier will compute Euclidean distance from the
//   normalised sessionContext vector to each centroid and assign the nearest.
//   No training, no model file — just arithmetic on these static values.
//
// CURRENT STATE: Empty — populate after offline K-Means analysis.
// =============================================================================

const clusterCentroids = [
  // Populate after offline K-Means run on Kaggle Customer Segmentation Data.
  // Example structure (illustrative — not validated):
  //
  // {
  //   id: 'C1',
  //   demographic: 'HIGH_PACE_INTERACTION',
  //   confidence: 0.88,
  //   reason: 'Cluster 1: Solo fast-interaction guests — business segment',
  //   features: {
  //     groupPresence: 0.05,
  //     interactionDurationSec: 0.18,
  //     timeOfDayEncoded: 0.0,
  //     membershipTierEncoded: 0.66,
  //   },
  // },
];

export default clusterCentroids;
