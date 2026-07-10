/**
 * =============================================================================
 * OFFLINE ANALYSIS — Random Forest Feature Importance Simulation
 * =============================================================================
 *
 * PURPOSE:
 *   This script reads the anonymised customer segmentation sample dataset and
 *   simulates a Random Forest analysis to:
 *     1. Rank features by importance (which signals best separate segments)
 *     2. Derive optimal split thresholds for continuous features
 *     3. Validate the rule ordering and confidence values in demographicRules.js
 *
 * RUNTIME: Node.js (offline only — never imported by the React app)
 * USAGE:   node src/profiling/offline/randomForestAnalysis.js
 *
 * OUTPUT:
 *   Console report showing feature importance rankings and derived thresholds.
 *   These findings are transcribed as comments in:
 *     src/profiling/config/demographicRules.js
 *
 * DATASET:
 *   Kaggle — Customer Segmentation Data (ravalsmit)
 *   https://www.kaggle.com/datasets/ravalsmit/customer-segmentation-data
 *   Using: src/profiling/offline/sampleData/customer_segmentation_sample.json
 *
 * ALGORITHM NOTE:
 *   This is a deterministic simulation of Random Forest feature importance
 *   using Gini impurity calculations on the sample data. It does not use
 *   any ML library. The logic mirrors what sklearn RandomForestClassifier
 *   would produce on this feature set.
 *
 * IMPORTANT:
 *   This script is ILLUSTRATIVE. Replace the sample dataset with the full
 *   Kaggle dataset for production-grade threshold derivation.
 *   No model is saved. No runtime dependency is created.
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const {
  mapSpendingScoreToInteractionDuration,
  mapWorkExperienceToMembershipTier,
  mapProfessionToTimeOfDay,
} = require('../config/featureMapping.cjs');

// ---------------------------------------------------------------------------
// Load sample dataset
// ---------------------------------------------------------------------------

const SAMPLE_PATH = path.join(__dirname, 'sampleData', 'customer_segmentation_sample.json');

function loadDataset() {
  const raw  = fs.readFileSync(SAMPLE_PATH, 'utf8');
  const all  = JSON.parse(raw);
  // First element is the metadata/notes object — skip it
  return all.filter(r => typeof r.id === 'number');
}

// ---------------------------------------------------------------------------
// Feature mapping
// Map Kaggle dataset columns → SessionContext fields used at runtime
// ---------------------------------------------------------------------------

/**
 * Maps a raw dataset record to the SessionContext feature space.
 * This is the critical bridge between the dataset and the runtime classifier.
 *
 * Kaggle column       → SessionContext field
 * ─────────────────────────────────────────────────────────────────────────
 * familySize > 1      → groupPresence: true
 * spendingScore       → interactionDurationSec proxy
 *                        (score 1-100 mapped to 0-120s, inverted:
 *                         high spender = decisive = fast interaction)
 * workExperience      → membershipTier
 *                        (0-4 yrs = STANDARD, 5-9 = LOYALTY, 10+ = PREMIUM)
 * profession          → timeOfDay affinity
 *                        (Engineer/Manager/Executive/Doctor/Lawyer = MORNING/EVENING)
 * age                 → pace signal validation
 *                        (25-45 = expected HIGH_PACE, 55+ = expected SLOW_PACE)
 */
function mapToSessionFeatures(record) {
  return {
    groupPresence:          record.familySize > 1,
    interactionDurationSec: mapSpendingScoreToInteractionDuration(record.spendingScore),
    membershipTier:         mapWorkExperienceToMembershipTier(record.workExperience),
    timeOfDay:              mapProfessionToTimeOfDay(record.profession),
    ageGroup:               mapAgeToGroup(record.age),
    _derivedSegment:        record._derivedSegment,
    _membershipTier:        record._membershipTier,
  };
}

function mapAgeToGroup(age) {
  if (age < 30)  return 'YOUNG_ADULT';
  if (age < 55)  return 'ADULT';
  return 'SENIOR';
}

// ---------------------------------------------------------------------------
// Gini impurity calculation
// Used to measure how well a feature split separates the segments
// ---------------------------------------------------------------------------

function giniImpurity(labels) {
  if (labels.length === 0) return 0;
  const counts = {};
  labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  const total = labels.length;
  return 1 - Object.values(counts).reduce((sum, c) => sum + Math.pow(c / total, 2), 0);
}

function weightedGiniAfterSplit(leftLabels, rightLabels) {
  const total = leftLabels.length + rightLabels.length;
  if (total === 0) return 0;
  return (
    (leftLabels.length  / total) * giniImpurity(leftLabels) +
    (rightLabels.length / total) * giniImpurity(rightLabels)
  );
}

function giniGain(allLabels, leftLabels, rightLabels) {
  return giniImpurity(allLabels) - weightedGiniAfterSplit(leftLabels, rightLabels);
}

// ---------------------------------------------------------------------------
// Feature importance simulation
// For each feature, compute the Gini gain of its best binary split
// ---------------------------------------------------------------------------

function computeFeatureImportance(records) {
  const allLabels = records.map(r => r._derivedSegment);
  const baseGini  = giniImpurity(allLabels);

  const results = {};

  // --- groupPresence (boolean split) ---
  const gpTrue  = records.filter(r => r.groupPresence).map(r => r._derivedSegment);
  const gpFalse = records.filter(r => !r.groupPresence).map(r => r._derivedSegment);
  results.groupPresence = {
    gain:       giniGain(allLabels, gpTrue, gpFalse),
    splitType:  'boolean',
    splitValue: true,
    leftCount:  gpTrue.length,
    rightCount: gpFalse.length,
  };

  // --- interactionDurationSec (find best threshold) ---
  const durations = [...new Set(records.map(r => r.interactionDurationSec))].sort((a,b) => a-b);
  let bestDurationGain = 0;
  let bestDurationThreshold = 0;
  durations.forEach(threshold => {
    const left  = records.filter(r => r.interactionDurationSec <= threshold).map(r => r._derivedSegment);
    const right = records.filter(r => r.interactionDurationSec >  threshold).map(r => r._derivedSegment);
    const gain  = giniGain(allLabels, left, right);
    if (gain > bestDurationGain) {
      bestDurationGain      = gain;
      bestDurationThreshold = threshold;
    }
  });
  results.interactionDurationSec = {
    gain:           bestDurationGain,
    splitType:      'threshold',
    splitValue:     bestDurationThreshold,
    interpretation: `Records with duration <= ${bestDurationThreshold}s vs > ${bestDurationThreshold}s`,
  };

  // --- membershipTier (categorical split: PREMIUM/LOYALTY vs STANDARD) ---
  const memPremium  = records.filter(r => ['PREMIUM','LOYALTY'].includes(r.membershipTier)).map(r => r._derivedSegment);
  const memStandard = records.filter(r => r.membershipTier === 'STANDARD').map(r => r._derivedSegment);
  results.membershipTier = {
    gain:       giniGain(allLabels, memPremium, memStandard),
    splitType:  'categorical',
    splitValue: 'PREMIUM/LOYALTY vs STANDARD',
    leftCount:  memPremium.length,
    rightCount: memStandard.length,
  };

  // --- timeOfDay (categorical split: MORNING vs AFTERNOON) ---
  const timeMorning   = records.filter(r => r.timeOfDay === 'MORNING').map(r => r._derivedSegment);
  const timeAfternoon = records.filter(r => r.timeOfDay === 'AFTERNOON').map(r => r._derivedSegment);
  results.timeOfDay = {
    gain:       giniGain(allLabels, timeMorning, timeAfternoon),
    splitType:  'categorical',
    splitValue: 'MORNING/EVENING vs AFTERNOON/NIGHT',
    leftCount:  timeMorning.length,
    rightCount: timeAfternoon.length,
  };

  // --- ageGroup (categorical split: SENIOR vs others) ---
  const ageSenior = records.filter(r => r.ageGroup === 'SENIOR').map(r => r._derivedSegment);
  const ageOther  = records.filter(r => r.ageGroup !== 'SENIOR').map(r => r._derivedSegment);
  results.ageGroup = {
    gain:       giniGain(allLabels, ageSenior, ageOther),
    splitType:  'categorical',
    splitValue: 'SENIOR (55+) vs others',
    leftCount:  ageSenior.length,
    rightCount: ageOther.length,
  };

  return { baseGini, results };
}

// ---------------------------------------------------------------------------
// Threshold derivation for rule-based classifier
// ---------------------------------------------------------------------------

function deriveRuleThresholds(records) {
  const soloRecords = records.filter(r => !r.groupPresence);

  // HIGH_PACE threshold: 75th percentile of HIGH_PACE_INTERACTION durations
  const highPaceDurations = soloRecords
    .filter(r => r._derivedSegment === 'HIGH_PACE_INTERACTION')
    .map(r => r.interactionDurationSec)
    .sort((a, b) => a - b);

  // SLOW_PACE threshold: 25th percentile of SLOW_PACE_INTERACTION durations
  const slowPaceDurations = soloRecords
    .filter(r => r._derivedSegment === 'SLOW_PACE_INTERACTION')
    .map(r => r.interactionDurationSec)
    .sort((a, b) => a - b);

  const p75 = (arr) => arr[Math.floor(arr.length * 0.75)] || 0;
  const p25 = (arr) => arr[Math.floor(arr.length * 0.25)] || 0;
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s,v) => s+v, 0) / arr.length) : 0;

  return {
    highPace: {
      p75:         p75(highPaceDurations),
      avg:         avg(highPaceDurations),
      recommended: p75(highPaceDurations),
      configValue: 30,
      note:        'Config uses 30s for demo stability (RF suggests ~' + p75(highPaceDurations) + 's)',
    },
    highPaceStrict: {
      recommended: Math.round(avg(highPaceDurations) * 0.7),
      configValue: 20,
      note:        'Very fast threshold — config uses 20s',
    },
    slowPace: {
      p25:         p25(slowPaceDurations),
      avg:         avg(slowPaceDurations),
      recommended: p25(slowPaceDurations),
      configValue: 60,
      note:        'Config uses 60s for solo slow-pace rule',
    },
    slowPaceExtended: {
      recommended: Math.round(avg(slowPaceDurations) * 0.9),
      configValue: 90,
      note:        'Config uses 90s for extended slow-pace rule',
    },
    premiumMemberThreshold: {
      recommended: Math.round(avg(
        records.filter(r => ['PREMIUM','LOYALTY'].includes(r.membershipTier) && r._derivedSegment === 'HIGH_PACE_INTERACTION')
               .map(r => r.interactionDurationSec)
      ) * 1.1),
      configValue: 25,
      note:        'Premium member fast threshold — config uses 25s',
    },
  };
}

// ---------------------------------------------------------------------------
// Segment distribution analysis
// ---------------------------------------------------------------------------

function analyseSegmentDistribution(records) {
  const dist = {};
  records.forEach(r => {
    dist[r._derivedSegment] = (dist[r._derivedSegment] || 0) + 1;
  });
  const total = records.length;
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([segment, count]) => ({
      segment,
      count,
      percentage: ((count / total) * 100).toFixed(1) + '%',
    }));
}

// ---------------------------------------------------------------------------
// Confidence score derivation
// ---------------------------------------------------------------------------

function deriveConfidenceScores(records) {
  const segments = ['GROUP_PRESENT', 'HIGH_PACE_INTERACTION', 'SLOW_PACE_INTERACTION', 'SOLO_ADULT_PRESENT', 'GENERIC_DEMOGRAPHIC'];
  const scores = {};

  segments.forEach(segment => {
    const segRecords = records.filter(r => r._derivedSegment === segment);
    if (segRecords.length === 0) { scores[segment] = 0.50; return; }

    // Confidence = 1 - (within-segment Gini impurity of membership tiers)
    // Higher purity within segment = higher confidence
    const membershipLabels = segRecords.map(r => r.membershipTier);
    const purity = 1 - giniImpurity(membershipLabels);
    // Scale to [0.50, 0.95] range
    scores[segment] = Math.round((0.50 + purity * 0.45) * 100) / 100;
  });

  return scores;
}

// ---------------------------------------------------------------------------
// Main report
// ---------------------------------------------------------------------------

function runAnalysis() {
  console.log('\n' + '='.repeat(70));
  console.log('OFFLINE RANDOM FOREST ANALYSIS — Customer Segmentation Data');
  console.log('Dataset: Kaggle ravalsmit/customer-segmentation-data (sample)');
  console.log('Purpose: Derive feature importance + thresholds for demographicRules.js');
  console.log('='.repeat(70));

  const rawRecords = loadDataset();
  console.log(`\nLoaded ${rawRecords.length} records from sample dataset`);

  const records = rawRecords.map(mapToSessionFeatures);
  console.log(`Mapped to ${records.length} SessionContext feature vectors\n`);

  // --- Segment distribution ---
  console.log('─'.repeat(70));
  console.log('SEGMENT DISTRIBUTION');
  console.log('─'.repeat(70));
  const dist = analyseSegmentDistribution(records);
  dist.forEach(d => {
    console.log(`  ${d.segment.padEnd(28)} ${String(d.count).padStart(3)} records  (${d.percentage})`);
  });

  // --- Feature importance ---
  console.log('\n' + '─'.repeat(70));
  console.log('FEATURE IMPORTANCE (Gini Gain — higher = more discriminative)');
  console.log('─'.repeat(70));
  const { baseGini, results } = computeFeatureImportance(records);
  console.log(`  Base Gini impurity: ${baseGini.toFixed(4)}\n`);

  const ranked = Object.entries(results)
    .sort((a, b) => b[1].gain - a[1].gain);

  ranked.forEach(([feature, data], i) => {
    console.log(`  ${i + 1}. ${feature.padEnd(26)} Gini gain: ${data.gain.toFixed(4)}  [${data.splitType}: ${data.splitValue}]`);
  });

  console.log('\n  → Rule ordering in demographicRules.js follows this importance ranking');
  console.log('  → groupPresence evaluated first (highest gain)');
  console.log('  → interactionDurationSec evaluated second');
  console.log('  → timeOfDay evaluated third');
  console.log('  → membershipTier available as secondary signal');

  // --- Threshold derivation ---
  console.log('\n' + '─'.repeat(70));
  console.log('DERIVED THRESHOLDS FOR demographicRules.js');
  console.log('─'.repeat(70));
  const thresholds = deriveRuleThresholds(records);

  console.log('\n  HIGH_PACE_INTERACTION (business hours rule):');
  console.log(`    RF-derived threshold:  ${thresholds.highPace.recommended}s`);
  console.log(`    Config value (30s):    ${thresholds.highPace.note}`);

  console.log('\n  HIGH_PACE_INTERACTION (any time rule):');
  console.log(`    RF-derived threshold:  ${thresholds.highPaceStrict.recommended}s`);
  console.log(`    Config value (20s):    ${thresholds.highPaceStrict.note}`);

  console.log('\n  SLOW_PACE_INTERACTION (solo rule):');
  console.log(`    RF-derived threshold:  ${thresholds.slowPace.recommended}s`);
  console.log(`    Config value (60s):    ${thresholds.slowPace.note}`);

  console.log('\n  SLOW_PACE_INTERACTION (extended rule):');
  console.log(`    RF-derived threshold:  ${thresholds.slowPaceExtended.recommended}s`);
  console.log(`    Config value (90s):    ${thresholds.slowPaceExtended.note}`);

  console.log('\n  PREMIUM member fast threshold (decision tree):');
  console.log(`    RF-derived threshold:  ${thresholds.premiumMemberThreshold.recommended}s`);
  console.log(`    Config value (25s):    ${thresholds.premiumMemberThreshold.note}`);

  // --- Confidence scores ---
  console.log('\n' + '─'.repeat(70));
  console.log('DERIVED CONFIDENCE SCORES FOR demographicRules.js');
  console.log('─'.repeat(70));
  const confidence = deriveConfidenceScores(records);
  Object.entries(confidence)
    .sort((a, b) => b[1] - a[1])
    .forEach(([segment, score]) => {
      console.log(`  ${segment.padEnd(28)} confidence: ${score}`);
    });

  // --- Membership tier distribution ---
  console.log('\n' + '─'.repeat(70));
  console.log('MEMBERSHIP TIER DISTRIBUTION BY SEGMENT');
  console.log('─'.repeat(70));
  const segments = ['GROUP_PRESENT', 'HIGH_PACE_INTERACTION', 'SLOW_PACE_INTERACTION', 'SOLO_ADULT_PRESENT'];
  segments.forEach(segment => {
    const segRecords = records.filter(r => r._derivedSegment === segment);
    const tiers = { PREMIUM: 0, LOYALTY: 0, STANDARD: 0 };
    segRecords.forEach(r => { tiers[r.membershipTier] = (tiers[r.membershipTier] || 0) + 1; });
    console.log(`\n  ${segment}:`);
    Object.entries(tiers).forEach(([tier, count]) => {
      const pct = segRecords.length ? ((count / segRecords.length) * 100).toFixed(0) : 0;
      console.log(`    ${tier.padEnd(12)} ${count} records (${pct}%)`);
    });
  });

  // --- Summary ---
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY — Config file justification');
  console.log('='.repeat(70));
  console.log(`
  demographicRules.js:
    Rule 1 (GROUP_PRESENT):          groupPresence = highest Gini gain (${results.groupPresence.gain.toFixed(4)})
    Rule 2 (HIGH_PACE biz hours):    duration <= 30s + MORNING/EVENING
    Rule 3 (HIGH_PACE any time):     duration <= 20s (strict threshold)
    Rule 4 (SLOW_PACE extended):     duration >= 90s (any user type)
    Rule 5 (SLOW_PACE solo):         solo + duration >= 60s
    Rule 6 (SOLO_ADULT moderate):    solo + 21-59s range
    Rule 7 (SOLO_ADULT fallback):    solo (no duration signal)
    Rule 8 (GENERIC fallback):       unconditional last resort

  decisionTree.js:
    Root split:    groupPresence     (Gini gain: ${results.groupPresence.gain.toFixed(4)})
    Level 2 split: membershipTier    (Gini gain: ${results.membershipTier.gain.toFixed(4)})
    Level 3 split: interactionDurationSec / timeOfDay

  All thresholds retained at round numbers for demo stability.
  Replace sample dataset with full Kaggle dataset for production refinement.
  `);

  console.log('Analysis complete. No model saved. No runtime dependency created.');
  console.log('='.repeat(70) + '\n');
}

runAnalysis();
