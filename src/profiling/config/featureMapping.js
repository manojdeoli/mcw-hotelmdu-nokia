// =============================================================================
// Feature Mapping — Single Source of Truth
//
// This module defines the canonical feature transformation logic used by BOTH:
//   - Runtime: api.js mapBookingToSessionSignals()
//   - Offline: trainPersonaModel.js, randomForestAnalysis.js, decisionTreeAnalysis.js
//
// GUARANTEE: Same feature semantics in training and inference.
// If you change a mapping here, re-run offline scripts to regenerate configs.
//
// Two mapping sets:
//   1. Booking data (runtime) — hotel PMS fields → SessionContext
//   2. Kaggle data (offline) — dataset columns → SessionContext
// =============================================================================

// Business professions — shared constant
const BUSINESS_PROFESSIONS = Object.freeze([
  'Engineer', 'Manager', 'Executive', 'Doctor', 'Lawyer',
]);

// =============================================================================
// BOOKING DATA MAPPINGS (Runtime — used by api.js)
// =============================================================================

/**
 * Maps avgSpendPerNight (0–300+) to interactionDurationSec.
 * High spend = decisive/fast interaction = short duration.
 * @param {number} avgSpendPerNight
 * @returns {number} interactionDurationSec (0–120)
 */
function mapSpendToInteractionDuration(avgSpendPerNight) {
  const spendScore = Math.min(100, Math.round((avgSpendPerNight / 300) * 100));
  return Math.round(120 - (spendScore / 100) * 120);
}

/**
 * Maps totalPreviousStays to membershipTier.
 * @param {number} totalPreviousStays
 * @returns {string} 'PREMIUM' | 'LOYALTY' | 'STANDARD'
 */
function mapStaysToMembershipTier(totalPreviousStays) {
  if (totalPreviousStays >= 10) return 'PREMIUM';
  if (totalPreviousStays >= 5) return 'LOYALTY';
  return 'STANDARD';
}

/**
 * Maps hotel loyaltyTier to timeOfDay hint.
 * Premium tiers correlate with business travel patterns.
 * @param {string} loyaltyTier
 * @returns {string} 'MORNING' | 'AFTERNOON'
 */
function mapLoyaltyToTimeOfDay(loyaltyTier) {
  return ['PLATINUM', 'GOLD'].includes(loyaltyTier) ? 'MORNING' : 'AFTERNOON';
}

/**
 * Maps guestsInBooking to groupPresence boolean.
 * @param {number} guestsInBooking
 * @returns {boolean}
 */
function mapGuestsToGroupPresence(guestsInBooking) {
  return guestsInBooking > 1;
}

// =============================================================================
// KAGGLE DATASET MAPPINGS (Offline — used by training/analysis scripts)
// =============================================================================

/**
 * Maps Kaggle spendingScore (1–100) to interactionDurationSec.
 * High spending score = decisive buyer = short interaction.
 * @param {number} spendingScore
 * @returns {number} interactionDurationSec (0–120)
 */
function mapSpendingScoreToInteractionDuration(spendingScore) {
  return Math.round(120 - (spendingScore / 100) * 120);
}

/**
 * Maps Kaggle workExperience (years) to membershipTier.
 * @param {number} workExperience
 * @returns {string} 'PREMIUM' | 'LOYALTY' | 'STANDARD'
 */
function mapWorkExperienceToMembershipTier(workExperience) {
  if (workExperience >= 10) return 'PREMIUM';
  if (workExperience >= 5) return 'LOYALTY';
  return 'STANDARD';
}

/**
 * Maps Kaggle profession to timeOfDay affinity.
 * Business professions correlate with MORNING/EVENING activity.
 * @param {string} profession
 * @returns {string} 'MORNING' | 'AFTERNOON'
 */
function mapProfessionToTimeOfDay(profession) {
  return BUSINESS_PROFESSIONS.includes(profession) ? 'MORNING' : 'AFTERNOON';
}

// =============================================================================
// Exports — ES module for runtime, CommonJS-compatible via named exports
// =============================================================================

export {
  BUSINESS_PROFESSIONS,
  // Booking data (runtime)
  mapSpendToInteractionDuration,
  mapStaysToMembershipTier,
  mapLoyaltyToTimeOfDay,
  mapGuestsToGroupPresence,
  // Kaggle data (offline)
  mapSpendingScoreToInteractionDuration,
  mapWorkExperienceToMembershipTier,
  mapProfessionToTimeOfDay,
};
