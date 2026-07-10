// =============================================================================
// LAYER 2 — Domain Profile Mapper (Fusion-Enabled)
//
// Exports one pure function:
//   mapToDomainProfile(layer1Result, personaResult, fusionRules)
//
// FUSION LOGIC:
//   Final Profile = f(Behaviour + Persona)
//   1. Exact match in fusion matrix (behaviour + persona)
//   2. Wildcard persona match (behaviour + '*')
//   3. Ultimate fallback ('*' + '*')
//
// CONFIDENCE AGGREGATION:
//   finalConfidence = (behaviour.confidence × weight) + (persona.confidence × weight)
//
// EXPLAINABILITY (Gap D):
//   Output includes separated behaviour/persona/fusion explanations.
//
// CONSTRAINTS:
//   - MUST NOT influence access control, identity verification, or fraud detection
//   - contentHints influences ONLY: screen content, amenity ordering, messaging tone
//
// BACKWARD COMPATIBILITY:
//   If personaResult or fusionRules are not provided, falls back to behaviour-only
//   mapping using legacy domainMappingRules.
// =============================================================================

import profileFusionRules from './profiling/config/profileFusionRules.js';

/**
 * Looks up the fusion matrix for a matching entry.
 * Priority: exact match → wildcard persona → wildcard behaviour → ultimate fallback.
 *
 * @param {Array}  matrix    — fusion matrix entries
 * @param {string} behaviour — Layer 1 demographic label
 * @param {string} persona   — Persona label (customerPersona field)
 * @returns {object|null} matched fusion entry
 */
function lookupFusion(matrix, behaviour, persona) {
  // 1. Exact match
  const exact = matrix.find(
    m => m.behaviour === behaviour && m.persona === persona
  );
  if (exact) return { entry: exact, matchType: 'exact' };

  // 2. Wildcard persona for this behaviour
  const wildcardPersona = matrix.find(
    m => m.behaviour === behaviour && m.persona === '*'
  );
  if (wildcardPersona) return { entry: wildcardPersona, matchType: 'wildcard_persona' };

  // 3. Wildcard behaviour for this persona
  const wildcardBehaviour = matrix.find(
    m => m.behaviour === '*' && m.persona === persona
  );
  if (wildcardBehaviour) return { entry: wildcardBehaviour, matchType: 'wildcard_behaviour' };

  // 4. Ultimate fallback
  const ultimate = matrix.find(
    m => m.behaviour === '*' && m.persona === '*'
  );
  if (ultimate) return { entry: ultimate, matchType: 'ultimate_fallback' };

  return null;
}

/**
 * Computes weighted average confidence from behaviour and persona scores.
 *
 * @param {number} behaviourConfidence — Layer 1 confidence (0–1)
 * @param {number} personaConfidence   — Persona confidence (0–1)
 * @param {object} weights             — { behaviour: 0.6, persona: 0.4 }
 * @returns {number} finalConfidence (0–1, rounded to 2 decimals)
 */
function computeFinalConfidence(behaviourConfidence, personaConfidence, weights) {
  const raw = (behaviourConfidence * weights.behaviour) + (personaConfidence * weights.persona);
  return Math.round(raw * 100) / 100;
}

/**
 * Maps Layer 1 behaviour + Persona to a fused domain profile.
 *
 * @param {object} layer1Result   — ProfilingDecision from Layer 1 classifier
 * @param {object} personaResult  — ProfilingDecision from persona tree (optional)
 * @param {object} [fusionRules]  — fusion config (optional, defaults to profileFusionRules)
 * @returns {object} DomainProfile with explainability
 */
export function mapToDomainProfile(layer1Result, personaResult, fusionRules) {
  const rules = fusionRules || profileFusionRules;

  // Extract labels
  const behaviour = layer1Result.demographic;
  const persona = personaResult?.demographic || null;
  const behaviourConfidence = layer1Result.confidence || 0.5;
  const personaConfidence = personaResult?.confidence || 0.5;

  // Attempt fusion lookup
  const fusionMatch = persona
    ? lookupFusion(rules.matrix, behaviour, persona)
    : null;

  // If fusion matched, use fused result
  if (fusionMatch) {
    const { entry, matchType } = fusionMatch;
    const finalConfidence = computeFinalConfidence(
      behaviourConfidence,
      personaConfidence,
      rules.confidenceWeights
    );

    const fusionRule = matchType === 'exact'
      ? `${behaviour} + ${persona} → ${entry.domainProfile}`
      : matchType === 'wildcard_persona'
        ? `${behaviour} + *(wildcard) → ${entry.domainProfile}`
        : matchType === 'wildcard_behaviour'
          ? `*(wildcard) + ${persona} → ${entry.domainProfile}`
          : `*(fallback) + *(fallback) → ${entry.domainProfile}`;

    return {
      domainProfile: entry.domainProfile,
      derivedFrom: { behaviour, persona },
      finalConfidence,
      contentHints: entry.contentHints,
      explainability: {
        behaviour: {
          demographic: layer1Result.demographic,
          confidence: layer1Result.confidence,
          reason: layer1Result.reason,
          classifierType: layer1Result.classifierType,
          trace: layer1Result.trace,
        },
        persona: {
          demographic: personaResult?.demographic || 'UNKNOWN',
          confidence: personaResult?.confidence || 0,
          reason: personaResult?.reason || 'No persona classification available',
          classifierType: personaResult?.classifierType || 'NONE',
          trace: personaResult?.trace || {},
        },
        fusion: {
          ruleApplied: fusionRule,
          matchType,
          fallbackUsed: matchType !== 'exact',
          confidenceWeights: rules.confidenceWeights,
        },
      },
    };
  }

  // Fallback: behaviour-only mapping (backward compatibility)
  const fallbackContentHints = {
    amenityPriority: ['restaurant', 'pool', 'spa', 'fitness'],
    messagingTone: 'neutral_welcoming',
    uiVariant: 'default',
  };

  return {
    domainProfile: 'GENERIC_GUEST',
    derivedFrom: { behaviour, persona: persona || 'NONE' },
    finalConfidence: behaviourConfidence,
    contentHints: fallbackContentHints,
    explainability: {
      behaviour: {
        demographic: layer1Result.demographic,
        confidence: layer1Result.confidence,
        reason: layer1Result.reason,
        classifierType: layer1Result.classifierType,
        trace: layer1Result.trace,
      },
      persona: {
        demographic: 'NONE',
        confidence: 0,
        reason: 'No persona or fusion rules available — behaviour-only fallback',
        classifierType: 'NONE',
        trace: {},
      },
      fusion: {
        ruleApplied: `${behaviour} → GENERIC_GUEST (no fusion match)`,
        matchType: 'behaviour_only_fallback',
        fallbackUsed: true,
        confidenceWeights: rules.confidenceWeights,
      },
    },
  };
}
