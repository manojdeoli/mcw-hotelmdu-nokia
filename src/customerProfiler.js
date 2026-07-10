// =============================================================================
// Customer Profiler — Session Context Assembler
//
// This file now has ONE responsibility: assembleSessionContext().
// Classification has moved to src/profiling/ (classifierStrategy + classifiers).
//
// assembleSessionContext() maps existing App.js state fields to the canonical
// SessionContext schema. No new data is collected — every field is derived
// from state already present in the application.
//
// SessionContext schema:
// {
//   sessionId              string   — generated at sequence start
//   phoneVerified          boolean  — !!verifiedPhoneNumber
//   kycStatus              string   — 'MATCHED' | 'PARTIAL' | 'UNMATCHED'
//   simIntegrity           string   — 'OK' | 'SWAPPED' | 'UNKNOWN'
//   deviceIntegrity        string   — 'OK' | 'SWAPPED' | 'UNKNOWN'
//   locationVerified       boolean  — hasReachedHotel
//   currentZone            string   — 'ENTRY' | 'KIOSK' | 'ELEVATOR' | 'ROOM' | 'UNKNOWN'
//   journeyStage           string   — 'ARRIVAL' | 'CHECKIN' | 'IN_STAY' | 'CHECKOUT'
//   timeOfDay              string   — 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT'
//   groupPresence          boolean  — secondUserGps !== null
//   interactionDurationSec number   — elapsed seconds since sequence started
//   membershipTier         string|null — 'PREMIUM' | 'LOYALTY' | 'STANDARD' | null
// }
// =============================================================================

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function deriveTimeOfDay() {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 12) return 'MORNING';
  if (hour >= 12 && hour < 17) return 'AFTERNOON';
  if (hour >= 17 && hour < 21) return 'EVENING';
  return 'NIGHT';
}

function deriveCurrentZone(checkInStatus, elevatorAccess, roomAccess) {
  if (roomAccess === 'Granted')                                          return 'ROOM';
  if (elevatorAccess !== 'No')                                           return 'ELEVATOR';
  if (checkInStatus === 'At Kiosk' || checkInStatus === 'Checked In')   return 'KIOSK';
  if (checkInStatus === 'Not Checked In')                                return 'ENTRY';
  return 'UNKNOWN';
}

function deriveJourneyStage(checkInStatus) {
  if (checkInStatus === 'Checked Out') return 'CHECKOUT';
  if (checkInStatus === 'Checked In')  return 'IN_STAY';
  if (checkInStatus === 'At Kiosk')    return 'CHECKIN';
  return 'ARRIVAL';
}

function deriveKycStatus(kycMatchResponse) {
  if (!kycMatchResponse) return 'UNMATCHED';
  const values = Object.values(kycMatchResponse);
  if (values.length === 0)                    return 'UNMATCHED';
  if (values.every(v => v === 'true'))        return 'MATCHED';
  if (values.some(v  => v === 'true'))        return 'PARTIAL';
  return 'UNMATCHED';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assembles a frozen SessionContext from existing App.js state.
 * No new data is collected — all fields are derived from state already present.
 *
 * @param {object} appState
 * @param {string}      appState.sessionId
 * @param {string|null} appState.verifiedPhoneNumber
 * @param {object|null} appState.kycMatchResponse
 * @param {string}      appState.identityIntegrity
 * @param {boolean}     appState.hasReachedHotel
 * @param {string}      appState.checkInStatus
 * @param {string}      appState.elevatorAccess
 * @param {string}      appState.roomAccess
 * @param {object|null} appState.secondUserGps
 * @param {number|null} appState.sequenceStartTime  — Date.now() timestamp
 * @param {string|null} appState.membershipTier     — 'PREMIUM'|'LOYALTY'|'STANDARD'|null
 * @param {string|null} appState.timeOfDayOverride  — 'MORNING'|'AFTERNOON'|'EVENING'|'NIGHT'|null
 * @returns {object} frozen SessionContext
 */
export function assembleSessionContext({
  sessionId,
  verifiedPhoneNumber,
  kycMatchResponse,
  identityIntegrity,
  hasReachedHotel,
  checkInStatus,
  elevatorAccess,
  roomAccess,
  secondUserGps,
  sequenceStartTime,
  membershipTier = null,
  timeOfDayOverride = null,
}) {
  const now = Date.now();
  const interactionDurationSec = sequenceStartTime
    ? Math.floor((now - sequenceStartTime) / 1000)
    : 0;

  return Object.freeze({
    sessionId:             sessionId || 'unknown',
    phoneVerified:         !!verifiedPhoneNumber,
    kycStatus:             deriveKycStatus(kycMatchResponse),
    simIntegrity:          identityIntegrity === 'Good'        ? 'OK'
                         : identityIntegrity === 'Checking...' ? 'UNKNOWN'
                         : 'SWAPPED',
    deviceIntegrity:       identityIntegrity === 'Good'        ? 'OK'
                         : identityIntegrity === 'Checking...' ? 'UNKNOWN'
                         : 'SWAPPED',
    locationVerified:      !!hasReachedHotel,
    currentZone:           deriveCurrentZone(checkInStatus, elevatorAccess, roomAccess),
    journeyStage:          deriveJourneyStage(checkInStatus),
    timeOfDay:             timeOfDayOverride || deriveTimeOfDay(),
    groupPresence:         secondUserGps !== null && secondUserGps !== undefined,
    interactionDurationSec,
    membershipTier:        membershipTier || null,
  });
}
