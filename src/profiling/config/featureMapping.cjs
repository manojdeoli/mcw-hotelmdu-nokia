// =============================================================================
// Feature Mapping — CommonJS wrapper for offline Node.js scripts
//
// This file re-exports the same mapping logic as featureMapping.js (ES module)
// but in CommonJS format for use by offline training/analysis scripts.
//
// GUARANTEE: Same functions, same semantics. Single source of truth.
// =============================================================================

'use strict';

const BUSINESS_PROFESSIONS = Object.freeze([
  'Engineer', 'Manager', 'Executive', 'Doctor', 'Lawyer',
]);

// --- Booking data mappings (runtime) ---

function mapSpendToInteractionDuration(avgSpendPerNight) {
  const spendScore = Math.min(100, Math.round((avgSpendPerNight / 300) * 100));
  return Math.round(120 - (spendScore / 100) * 120);
}

function mapStaysToMembershipTier(totalPreviousStays) {
  if (totalPreviousStays >= 10) return 'PREMIUM';
  if (totalPreviousStays >= 5) return 'LOYALTY';
  return 'STANDARD';
}

function mapLoyaltyToTimeOfDay(loyaltyTier) {
  return ['PLATINUM', 'GOLD'].includes(loyaltyTier) ? 'MORNING' : 'AFTERNOON';
}

function mapGuestsToGroupPresence(guestsInBooking) {
  return guestsInBooking > 1;
}

// --- Kaggle dataset mappings (offline) ---

function mapSpendingScoreToInteractionDuration(spendingScore) {
  return Math.round(120 - (spendingScore / 100) * 120);
}

function mapWorkExperienceToMembershipTier(workExperience) {
  if (workExperience >= 10) return 'PREMIUM';
  if (workExperience >= 5) return 'LOYALTY';
  return 'STANDARD';
}

function mapProfessionToTimeOfDay(profession) {
  return BUSINESS_PROFESSIONS.includes(profession) ? 'MORNING' : 'AFTERNOON';
}

module.exports = {
  BUSINESS_PROFESSIONS,
  mapSpendToInteractionDuration,
  mapStaysToMembershipTier,
  mapLoyaltyToTimeOfDay,
  mapGuestsToGroupPresence,
  mapSpendingScoreToInteractionDuration,
  mapWorkExperienceToMembershipTier,
  mapProfessionToTimeOfDay,
};
