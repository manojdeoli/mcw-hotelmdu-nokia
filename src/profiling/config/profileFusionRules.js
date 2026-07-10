// =============================================================================
// Profile Fusion Rules — Behaviour × Persona → Final Domain Profile
//
// This config defines how Layer 1 (behaviour) and Persona (trained model)
// combine to produce the final hotel domain profile.
//
// FUSION LOGIC:
//   1. Exact match: behaviour + persona → specific profile
//   2. Wildcard persona ('*'): behaviour + any persona → fallback for that behaviour
//   3. Ultimate fallback: '*' + '*' → GENERIC_GUEST
//
// FALLBACK STRATEGY:
//   'BEHAVIOUR_PRIORITY' — if no fusion match, fall back to behaviour-only mapping
//   (preserves backward compatibility with existing Layer 2 logic)
//
// CONFIDENCE AGGREGATION:
//   finalConfidence = (behaviour.confidence × 0.6) + (persona.confidence × 0.4)
//
// CONSTRAINTS:
//   - This layer influences ONLY presentation (amenities, tone, UI variant)
//   - MUST NOT affect access control, identity verification, or fraud detection
// =============================================================================

const profileFusionRules = {
  domain: 'HOTEL',
  fallbackStrategy: 'BEHAVIOUR_PRIORITY',
  confidenceWeights: { behaviour: 0.6, persona: 0.4 },

  matrix: [
    // --- HIGH_PACE_INTERACTION combinations ---
    {
      behaviour: 'HIGH_PACE_INTERACTION',
      persona: 'BUSINESS_TRAVELLER',
      domainProfile: 'BUSINESS_TRAVELER',
      contentHints: {
        amenityPriority: ['express_checkout', 'business_centre', 'spa', 'fitness'],
        messagingTone: 'efficient_professional',
        uiVariant: 'business',
      },
    },
    {
      behaviour: 'HIGH_PACE_INTERACTION',
      persona: 'LEISURE_TRAVELLER',
      domainProfile: 'FAST_LEISURE',
      contentHints: {
        amenityPriority: ['express_checkout', 'local_attractions', 'pool', 'spa'],
        messagingTone: 'energetic_exploratory',
        uiVariant: 'fast_leisure',
      },
    },
    {
      behaviour: 'HIGH_PACE_INTERACTION',
      persona: 'FAMILY_CUSTOMER',
      domainProfile: 'EFFICIENT_FAMILY',
      contentHints: {
        amenityPriority: ['express_checkout', 'kids_club', 'pool', 'restaurant'],
        messagingTone: 'efficient_family',
        uiVariant: 'efficient_family',
      },
    },
    {
      behaviour: 'HIGH_PACE_INTERACTION',
      persona: '*',
      domainProfile: 'BUSINESS_TRAVELER',
      contentHints: {
        amenityPriority: ['express_checkout', 'business_centre', 'spa', 'fitness'],
        messagingTone: 'efficient_professional',
        uiVariant: 'business',
      },
    },

    // --- GROUP_PRESENT combinations ---
    {
      behaviour: 'GROUP_PRESENT',
      persona: 'FAMILY_CUSTOMER',
      domainProfile: 'FAMILY_GROUP',
      contentHints: {
        amenityPriority: ['pool', 'kids_club', 'restaurant', 'spa'],
        messagingTone: 'warm_family',
        uiVariant: 'family',
      },
    },
    {
      behaviour: 'GROUP_PRESENT',
      persona: 'LEISURE_TRAVELLER',
      domainProfile: 'GROUP_LEISURE',
      contentHints: {
        amenityPriority: ['pool', 'local_attractions', 'restaurant', 'spa'],
        messagingTone: 'relaxed_group',
        uiVariant: 'group_leisure',
      },
    },
    {
      behaviour: 'GROUP_PRESENT',
      persona: '*',
      domainProfile: 'FAMILY_GROUP',
      contentHints: {
        amenityPriority: ['pool', 'kids_club', 'restaurant', 'spa'],
        messagingTone: 'warm_family',
        uiVariant: 'family',
      },
    },

    // --- SLOW_PACE_INTERACTION combinations ---
    {
      behaviour: 'SLOW_PACE_INTERACTION',
      persona: 'LEISURE_TRAVELLER',
      domainProfile: 'RELAXED_GUEST',
      contentHints: {
        amenityPriority: ['spa', 'pool', 'local_attractions', 'restaurant'],
        messagingTone: 'calm_unhurried',
        uiVariant: 'relaxed',
      },
    },
    {
      behaviour: 'SLOW_PACE_INTERACTION',
      persona: 'BUSINESS_TRAVELLER',
      domainProfile: 'EXTENDED_BUSINESS',
      contentHints: {
        amenityPriority: ['business_centre', 'spa', 'restaurant', 'concierge'],
        messagingTone: 'professional_relaxed',
        uiVariant: 'extended_business',
      },
    },
    {
      behaviour: 'SLOW_PACE_INTERACTION',
      persona: '*',
      domainProfile: 'SENIOR_GUEST',
      contentHints: {
        amenityPriority: ['spa', 'restaurant', 'concierge', 'pool'],
        messagingTone: 'warm_assisted',
        uiVariant: 'senior',
      },
    },

    // --- SOLO_ADULT_PRESENT combinations ---
    {
      behaviour: 'SOLO_ADULT_PRESENT',
      persona: 'BUSINESS_TRAVELLER',
      domainProfile: 'SOLO_BUSINESS',
      contentHints: {
        amenityPriority: ['business_centre', 'fitness', 'express_checkout', 'spa'],
        messagingTone: 'professional_concise',
        uiVariant: 'solo_business',
      },
    },
    {
      behaviour: 'SOLO_ADULT_PRESENT',
      persona: 'LEISURE_TRAVELLER',
      domainProfile: 'LEISURE_GUEST',
      contentHints: {
        amenityPriority: ['pool', 'spa', 'local_attractions', 'restaurant'],
        messagingTone: 'relaxed_exploratory',
        uiVariant: 'leisure',
      },
    },
    {
      behaviour: 'SOLO_ADULT_PRESENT',
      persona: '*',
      domainProfile: 'LEISURE_GUEST',
      contentHints: {
        amenityPriority: ['pool', 'spa', 'local_attractions', 'restaurant'],
        messagingTone: 'relaxed_exploratory',
        uiVariant: 'leisure',
      },
    },

    // --- GENERIC_DEMOGRAPHIC combinations ---
    {
      behaviour: 'GENERIC_DEMOGRAPHIC',
      persona: 'BUSINESS_TRAVELLER',
      domainProfile: 'BUSINESS_TRAVELER',
      contentHints: {
        amenityPriority: ['express_checkout', 'business_centre', 'spa', 'fitness'],
        messagingTone: 'efficient_professional',
        uiVariant: 'business',
      },
    },
    {
      behaviour: 'GENERIC_DEMOGRAPHIC',
      persona: 'FAMILY_CUSTOMER',
      domainProfile: 'FAMILY_GROUP',
      contentHints: {
        amenityPriority: ['pool', 'kids_club', 'restaurant', 'spa'],
        messagingTone: 'warm_family',
        uiVariant: 'family',
      },
    },
    {
      behaviour: 'GENERIC_DEMOGRAPHIC',
      persona: '*',
      domainProfile: 'GENERIC_GUEST',
      contentHints: {
        amenityPriority: ['restaurant', 'pool', 'spa', 'fitness'],
        messagingTone: 'neutral_welcoming',
        uiVariant: 'default',
      },
    },

    // --- Ultimate fallback ---
    {
      behaviour: '*',
      persona: '*',
      domainProfile: 'GENERIC_GUEST',
      contentHints: {
        amenityPriority: ['restaurant', 'pool', 'spa', 'fitness'],
        messagingTone: 'neutral_welcoming',
        uiVariant: 'default',
      },
    },
  ],
};

export default profileFusionRules;
