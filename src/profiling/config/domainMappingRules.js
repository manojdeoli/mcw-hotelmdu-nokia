// =============================================================================
// LAYER 2 — Domain Mapping Rules (Hotel Domain)
// Used by: domainProfileMapper.js
//
// This config maps Layer 1 demographic labels → hotel-specific presentation
// profiles and content hints.
//
// IMPORTANT CONSTRAINTS:
//   - This layer consumes ONLY Layer 1 output labels (demographic field).
//   - It MUST NOT re-read raw session context signals.
//   - It MUST NOT influence access control, identity verification, or fraud detection.
//   - contentHints influences ONLY: screen content, amenity ordering, messaging tone.
//
// TO ADAPT FOR A DIFFERENT DOMAIN (Retail, Healthcare, Transport):
//   - Create a new domain mapping file with the same shape.
//   - Pass it to mapToDomainProfile() instead of this one.
//   - Layer 1 classifiers and configs remain completely unchanged.
//
// amenityPriority: ordered list of amenity keys — GuestTab renders these first.
// messagingTone:   hint for greeting/copy tone — no functional effect on logic.
// uiVariant:       passed as a prop to GuestTab for conditional rendering.
// =============================================================================

const hotelDomainMappingRules = {
  domain: 'HOTEL',
  mappings: [
    {
      demographic: 'GROUP_PRESENT',
      domainProfile: 'FAMILY_GROUP',
      contentHints: {
        amenityPriority: ['pool', 'kids_club', 'restaurant', 'spa'],
        messagingTone: 'warm_family',
        uiVariant: 'family',
      },
    },

    {
      demographic: 'HIGH_PACE_INTERACTION',
      domainProfile: 'BUSINESS_TRAVELER',
      contentHints: {
        amenityPriority: ['express_checkout', 'business_centre', 'spa', 'fitness'],
        messagingTone: 'efficient_professional',
        uiVariant: 'business',
      },
    },

    {
      demographic: 'SLOW_PACE_INTERACTION',
      domainProfile: 'SENIOR_GUEST',
      contentHints: {
        amenityPriority: ['spa', 'restaurant', 'concierge', 'pool'],
        messagingTone: 'warm_assisted',
        uiVariant: 'senior',
      },
    },

    {
      demographic: 'SOLO_ADULT_PRESENT',
      domainProfile: 'LEISURE_GUEST',
      contentHints: {
        amenityPriority: ['pool', 'spa', 'local_attractions', 'restaurant'],
        messagingTone: 'relaxed_exploratory',
        uiVariant: 'leisure',
      },
    },

    // Fallback — must always be last
    {
      demographic: 'GENERIC_DEMOGRAPHIC',
      domainProfile: 'GENERIC_GUEST',
      contentHints: {
        amenityPriority: ['restaurant', 'pool', 'spa', 'fitness'],
        messagingTone: 'neutral_welcoming',
        uiVariant: 'default',
      },
    },
  ],
};

export default hotelDomainMappingRules;
