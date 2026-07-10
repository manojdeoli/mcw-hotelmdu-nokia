# Offline Analysis — Customer Profiling

## Purpose

This folder contains **offline-only** analysis scripts that were used to derive
the configuration values in `src/profiling/config/`.

These scripts are **never imported by the React application** and **never run
in the browser**. They are run once by a developer to justify and document the
thresholds, rule ordering, and tree structure used at runtime.

---

## Dataset

**Source:** Kaggle — Customer Segmentation Data  
**URL:** https://www.kaggle.com/datasets/ravalsmit/customer-segmentation-data  
**Author:** ravalsmit  

**Columns in the full dataset:**
| Column | Type | Description |
|---|---|---|
| CustomerID | int | Anonymised identifier |
| Age | int | Customer age |
| Gender | string | M / F |
| Annual Income (k$) | int | Annual income in thousands |
| Spending Score (1-100) | int | Mall-assigned spending behaviour score |
| Profession | string | Customer profession |
| Work Experience | int | Years of work experience |
| Family Size | int | Number of family members |

**Usage in this project:**
- Treated as **illustrative reference material only**
- Used **offline** to derive feature importance rankings and split thresholds
- **Not embedded** in the application
- **Not accessed at runtime**
- Replaceable with any other public customer segmentation dataset

---

## Feature Mapping

The Kaggle dataset columns are mapped to `SessionContext` fields as follows:

| Kaggle Column | SessionContext Field | Mapping Logic |
|---|---|---|
| `Family Size > 1` | `groupPresence` | `familySize > 1 → true` |
| `Spending Score` | `interactionDurationSec` | Inverted: high score = fast/decisive = short duration. `120 - (score/100 * 120)` |
| `Work Experience` | `membershipTier` | `0-4 yrs → STANDARD`, `5-9 yrs → LOYALTY`, `10+ yrs → PREMIUM` |
| `Profession` | `timeOfDay` | Engineer/Manager/Executive/Doctor/Lawyer → `MORNING`, others → `AFTERNOON` |
| `Age` | pace signal validation | `25-45 → expected HIGH_PACE`, `55+ → expected SLOW_PACE` |

**Why these mappings?**
- `Spending Score` is the closest proxy for interaction decisiveness in the dataset
- `Work Experience` is the closest proxy for loyalty/membership tier
- `Profession` correlates with business-hours activity patterns
- `Family Size` directly maps to group presence

---

## Scripts

### `randomForestAnalysis.js`

Simulates a Random Forest analysis to derive:
- Feature importance rankings (which signals best separate segments)
- Optimal split thresholds for `interactionDurationSec`
- Confidence scores for each demographic label
- Justification for rule ordering in `demographicRules.js`

**Run:**
```bash
node src/profiling/offline/randomForestAnalysis.js
```

**Output informs:** `src/profiling/config/demographicRules.js`

---

### `decisionTreeAnalysis.js`

Simulates a CART Decision Tree analysis to derive:
- Optimal root split feature (highest Gini gain)
- Level-by-level branching structure
- Membership tier impact on classification paths
- Validation of the tree structure in `decisionTree.js`

**Run:**
```bash
node src/profiling/offline/decisionTreeAnalysis.js
```

**Output informs:** `src/profiling/config/decisionTree.js`

---

## Sample Data

`sampleData/customer_segmentation_sample.json` contains **30 anonymised records**
derived from the Kaggle dataset schema. It is used to:
- Validate the analysis scripts without requiring the full dataset download
- Demonstrate the feature mapping logic
- Provide a reproducible reference for the derived thresholds

**This sample is illustrative only.** For production-grade threshold derivation,
download the full Kaggle dataset and replace the sample path in both scripts.

---

## How Findings Flow Into Runtime Config

```
Offline Analysis                    Runtime Config
────────────────                    ──────────────
randomForestAnalysis.js
  Feature importance rankings   →   Rule ordering in demographicRules.js
  Optimal thresholds            →   { max: 30 }, { min: 60 }, { min: 90 }
  Confidence scores             →   confidence: 0.95, 0.82, 0.75 ...

decisionTreeAnalysis.js
  Root split: groupPresence     →   decisionTree.js root node
  Level 2: membershipTier       →   membership_check node
  Level 3: timeOfDay + duration →   standard_time_check + pace_check nodes
  Thresholds: 25s, 30s          →   lte: 25, lte: 30 in tree conditions
```

---

## Replacing the Dataset

To use a different dataset:

1. Update `sampleData/customer_segmentation_sample.json` with records from the new dataset
2. Update the `mapToSessionFeatures()` function in both scripts to match the new column names
3. Re-run both scripts and review the output
4. Update the threshold values and comments in `demographicRules.js` and `decisionTree.js`
5. No changes required to any classifier, strategy, or App.js code

---

## What This Folder Is NOT

- Not a training pipeline
- Not a model persistence layer
- Not a runtime dependency
- Not a data collection mechanism
- Not connected to live user data in any way
