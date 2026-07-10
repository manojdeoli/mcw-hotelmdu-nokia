# Customer Classification Pipeline

## End-to-End ML Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OFFLINE (Developer workstation)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [ Kaggle Dataset (proxy/synthetic) ]                               │
│         │                                                            │
│         ▼                                                            │
│  [ featureMapping.cjs — canonical feature semantics ]               │
│         │                                                            │
│         ▼                                                            │
│  [ labelDataset.js — rule-derived supervised labelling ]            │
│         │                                                            │
│         ▼                                                            │
│  [ Labelled Dataset (customer_segmentation_sample.json) ]           │
│         │                                                            │
│         ├──────────────────────────┐                                │
│         ▼                          ▼                                │
│  [ trainPersonaModel.js ]   [ randomForestAnalysis.js ]             │
│  [ CART Decision Tree ]     [ decisionTreeAnalysis.js ]             │
│         │                          │                                │
│         ▼                          ▼                                │
│  [ personaDecisionTree.js ] [ demographicRules.js ]                 │
│  [ modelMeta.json ]         [ decisionTree.js ]                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RUNTIME (Browser)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [ featureMapping.js — same semantics as offline ]                   │
│         │                                                            │
│         ▼                                                            │
│  [ api.js: getProfilingHints() — booking → session signals ]        │
│         │                                                            │
│         ▼                                                            │
│  [ customerProfiler.js: assembleSessionContext() ]                  │
│         │                                                            │
│         ▼                                                            │
│  [ profiling/index.js: runProfiling() ]                             │
│         │                                                            │
│         ├─────────────────────────────────┐                         │
│         ▼                                 ▼                         │
│  [ Layer 1: Behaviour ]            [ Persona Tree ]                 │
│  [ ruleBasedClassifier ]           [ treeBasedClassifier ]          │
│  [ OR treeBasedClassifier ]        [ personaDecisionTree.js ]       │
│         │                                 │                         │
│         ▼                                 ▼                         │
│  ┌─────────────────────────────────────────────┐                    │
│  │  FUSION (domainProfileMapper.js)            │                    │
│  │  Behaviour × Persona → Final Domain Profile │                    │
│  │  profileFusionRules.js (matrix config)      │                    │
│  └─────────────────────────────────────────────┘                    │
│         │                                                            │
│         ▼                                                            │
│  [ GuestTab.js — amenity ordering, messaging tone, UI variant ]     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Explicit Positioning Statements

### Training Mode: Rule-Derived Supervised Learning

> **"Model is learning the same rules used to label the dataset."**

The persona decision tree is trained from labels that were assigned by deterministic rules
(`labelDataset.js`). This is intentional and explicitly acknowledged:

- The model replicates rule-based labelling
- This enables transition to real data later
- When real hotel/PMS data becomes available, the same pipeline re-runs with real labels
- No changes needed to runtime classifiers or fusion logic

### Dataset: Synthetic-Labelled Proxy

> **"Dataset doesn't contain real domain labels… we mimic it… then later adapt to real data."**

- Source: Kaggle Customer Segmentation Data (ravalsmit) — public, no PII
- Type: `synthetic-labelled-proxy-dataset`
- Labels are assigned by rules, not by domain experts observing real hotel guests
- Replaceable: swap the dataset, re-run `labelDataset.js` + `trainPersonaModel.js`
- No runtime code changes required

### Feature Mapping Guarantee

> **Same feature semantics used in training AND runtime.**

- Single source of truth: `src/profiling/config/featureMapping.js` (ES module)
- CommonJS mirror: `src/profiling/config/featureMapping.cjs` (for Node.js offline scripts)
- Both runtime (`api.js`) and offline scripts import from this shared module
- If a mapping changes, both training and inference automatically stay aligned

---

## Fusion Logic (Behaviour × Persona → Final Profile)

The final domain profile is NOT determined by behaviour alone. It is the product of:

1. **Layer 1 (Behaviour):** What the guest IS DOING (pace, group presence)
2. **Persona (Trained Model):** What the guest IS (business traveller, family, leisure)
3. **Fusion Matrix:** Combines both signals into a differentiated final profile

### Example Fusion Outcomes

| Behaviour | Persona | Final Profile | Why Different |
|-----------|---------|---------------|---------------|
| HIGH_PACE | BUSINESS_TRAVELLER | BUSINESS_TRAVELER | Confirmed business |
| HIGH_PACE | LEISURE_TRAVELLER | FAST_LEISURE | Fast but not business — different amenities |
| SLOW_PACE | LEISURE_TRAVELLER | RELAXED_GUEST | Unhurried leisure — spa focus |
| SLOW_PACE | BUSINESS_TRAVELLER | EXTENDED_BUSINESS | Long meeting/work session |
| GROUP | FAMILY_CUSTOMER | FAMILY_GROUP | Confirmed family |
| GROUP | LEISURE_TRAVELLER | GROUP_LEISURE | Friends travelling together |

### Fallback Strategy

- If no exact fusion match: wildcard persona (`*`) for that behaviour
- If no wildcard match: `BEHAVIOUR_PRIORITY` — use behaviour-only mapping
- Ultimate fallback: `GENERIC_GUEST`

### Confidence Aggregation

```
finalConfidence = (behaviour.confidence × 0.6) + (persona.confidence × 0.4)
```

---

## Explainability Output

Every classification produces a structured explainability object:

```json
{
  "explainability": {
    "behaviour": {
      "demographic": "HIGH_PACE_INTERACTION",
      "confidence": 0.82,
      "reason": "Solo user with fast interaction during business-hours time window",
      "classifierType": "RULE_BASED",
      "trace": { "matchedRule": { "id": "rule_high_pace_business_hours" } }
    },
    "persona": {
      "demographic": "BUSINESS_TRAVELLER",
      "confidence": 1.0,
      "reason": "9 training samples, 100% purity",
      "classifierType": "TREE_BASED",
      "trace": { "path": ["groupPresence eq true?", "timeOfDay in [...]?", "membershipTier in [...]?", "Leaf: BUSINESS_TRAVELLER (100%)"] }
    },
    "fusion": {
      "ruleApplied": "HIGH_PACE_INTERACTION + BUSINESS_TRAVELLER → BUSINESS_TRAVELER",
      "matchType": "exact",
      "fallbackUsed": false,
      "confidenceWeights": { "behaviour": 0.6, "persona": 0.4 }
    }
  }
}
```

---

## How to Replace the Dataset

1. Obtain real hotel/PMS guest data (anonymised)
2. Update `sampleData/customer_segmentation_sample.json`
3. Run `node src/profiling/offline/labelDataset.js` (or use real labels)
4. Run `node src/profiling/offline/trainPersonaModel.js`
5. Verify `personaDecisionTree.js` and `modelMeta.json` are regenerated
6. No changes to runtime code — classifiers, fusion, and UI adapt automatically

---

## File Reference

| File | Role | Layer |
|------|------|-------|
| `featureMapping.js` / `.cjs` | Shared mapping functions | Foundation |
| `demographicRules.js` | Rule-based classifier config | Layer 1 |
| `decisionTree.js` | Tree-based classifier config | Layer 1 |
| `personaDecisionTree.js` | Trained persona tree | Persona |
| `profileFusionRules.js` | Fusion matrix config | Layer 2 |
| `domainProfileMapper.js` | Fusion engine | Layer 2 |
| `profiling/index.js` | Pipeline orchestrator | All |
| `modelMeta.json` | Training metadata + provenance | Audit |
