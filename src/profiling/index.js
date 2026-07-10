// =============================================================================
// Profiling Engine — Public Entry Point
//
// This is the ONLY module App.js imports from the profiling system.
// It orchestrates the full classification flow:
//   1. Routes sessionContext to the correct Layer 1 classifier via strategy
//   2. Runs persona classification (trained from labelled dataset)
//   3. Fuses Layer 1 + Persona via fusion matrix → final domain profile
//   4. Returns the complete { layer1, layer2, persona } result
//
// FUSION (Gap 1 fix):
//   Layer 2 now depends on BOTH behaviour (Layer 1) AND persona.
//   Final Profile = f(Behaviour + Persona) via profileFusionRules.js
//
// App.js usage:
//   import { runProfiling, CLASSIFIER_TYPES } from './profiling/index';
//
//   const profileResult = runProfiling(sessionContext, {
//     classifier: CLASSIFIER_TYPES.RULE_BASED,  // or TREE_BASED
//   });
//   // profileResult.layer1  — ProfilingDecision (demographic + trace)
//   // profileResult.layer2  — Fused DomainProfile (behaviour × persona)
//   // profileResult.persona — ProfilingDecision (customerPersona + trace)
// =============================================================================

import { runClassifier, CLASSIFIER_TYPES } from './classifierStrategy.js';
import { mapToDomainProfile }              from '../domainProfileMapper.js';
import profileFusionRules                  from './config/profileFusionRules.js';

/**
 * Runs the full profiling pipeline with behaviour × persona fusion.
 *
 * @param {object} sessionContext         — frozen SessionContext from assembleSessionContext()
 * @param {object} [options]              — profiling options
 * @param {string} [options.classifier]   — CLASSIFIER_TYPES.RULE_BASED (default) | TREE_BASED
 * @param {object} [options.fusionRules]  — override fusion rules (optional, for testing)
 * @returns {{ layer1: ProfilingDecision, layer2: DomainProfile, persona: ProfilingDecision }}
 */
export function runProfiling(sessionContext, options = {}) {
  if (!sessionContext || typeof sessionContext !== 'object') {
    throw new Error('[runProfiling] sessionContext must be a non-null object');
  }

  // Layer 1 — demographic/behaviour classification
  const layer1 = runClassifier(sessionContext, options);

  // Persona — trained persona tree classification
  const persona = runClassifier(sessionContext, { classifier: CLASSIFIER_TYPES.PERSONA_TREE });

  // Layer 2 — fused domain profile (behaviour × persona)
  const fusionRules = options.fusionRules || profileFusionRules;
  const layer2 = mapToDomainProfile(layer1, persona, fusionRules);

  return { layer1, layer2, persona };
}

// Re-export CLASSIFIER_TYPES so App.js only needs one import from this module
export { CLASSIFIER_TYPES };
