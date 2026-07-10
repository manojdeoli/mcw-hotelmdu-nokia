/**
 * =============================================================================
 * OFFLINE TRAINING — Persona Decision Tree Model
 * =============================================================================
 *
 * PURPOSE:
 *   Reads the labelled customer segmentation dataset and trains a CART decision
 *   tree that predicts customerPersona from SessionContext features.
 *
 * RUNTIME: Node.js (offline only — never imported by the React app)
 * USAGE:   node src/profiling/offline/trainPersonaModel.js
 *
 * INPUT:
 *   src/profiling/offline/sampleData/customer_segmentation_sample.json
 *
 * OUTPUT:
 *   src/profiling/config/personaDecisionTree.js  — trained tree config
 *   src/profiling/config/modelMeta.json          — training metadata
 *
 * ALGORITHM:
 *   CART Decision Tree using Gini impurity, max_depth=5, min_samples=2.
 *   Target label: customerPersona
 *   Features: groupPresence, interactionDurationSec, membershipTier, timeOfDay
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  BUSINESS_PROFESSIONS,
  mapSpendingScoreToInteractionDuration,
  mapWorkExperienceToMembershipTier,
  mapProfessionToTimeOfDay,
} = require('../config/featureMapping.cjs');

const SAMPLE_PATH = path.join(__dirname, 'sampleData', 'customer_segmentation_sample.json');
const TREE_OUTPUT = path.join(__dirname, '..', 'config', 'personaDecisionTree.js');
const META_OUTPUT = path.join(__dirname, '..', 'config', 'modelMeta.json');

const MAX_DEPTH = 5;
const MIN_SAMPLES = 2;

// ---------------------------------------------------------------------------
// Load and map dataset
// ---------------------------------------------------------------------------

function loadDataset() {
  const raw = fs.readFileSync(SAMPLE_PATH, 'utf8');
  const all = JSON.parse(raw);
  return all.filter(r => typeof r.id === 'number');
}

function mapToSessionFeatures(record) {
  return {
    groupPresence:          record.familySize > 1,
    interactionDurationSec: mapSpendingScoreToInteractionDuration(record.spendingScore),
    membershipTier:         mapWorkExperienceToMembershipTier(record.workExperience),
    timeOfDay:              mapProfessionToTimeOfDay(record.profession),
    _label:                 record.customerPersona,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDataset(records) {
  const errors = [];

  const missing = records.filter(r => !r._label);
  if (missing.length > 0) {
    errors.push(`${missing.length} records missing customerPersona label`);
  }

  const classes = [...new Set(records.map(r => r._label).filter(Boolean))];
  if (classes.length < 2) {
    errors.push(`Need at least 2 persona classes, found: ${classes.length}`);
  }

  if (errors.length > 0) {
    console.error('DATASET VALIDATION FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  return classes;
}

// ---------------------------------------------------------------------------
// Gini impurity
// ---------------------------------------------------------------------------

function giniImpurity(labels) {
  if (labels.length === 0) return 0;
  const counts = {};
  labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  const total = labels.length;
  return 1 - Object.values(counts).reduce((sum, c) => sum + Math.pow(c / total, 2), 0);
}

function giniGain(allLabels, leftLabels, rightLabels) {
  const total = leftLabels.length + rightLabels.length;
  if (total === 0) return 0;
  const weightedChild = (leftLabels.length / total) * giniImpurity(leftLabels) +
                        (rightLabels.length / total) * giniImpurity(rightLabels);
  return giniImpurity(allLabels) - weightedChild;
}

// ---------------------------------------------------------------------------
// Find best split
// ---------------------------------------------------------------------------

function findBestSplit(records) {
  const allLabels = records.map(r => r._label);
  let bestGain = 0;
  let bestSplit = null;

  // groupPresence (boolean)
  const gpLeft  = records.filter(r => r.groupPresence);
  const gpRight = records.filter(r => !r.groupPresence);
  const gpGain  = giniGain(allLabels, gpLeft.map(r => r._label), gpRight.map(r => r._label));
  if (gpGain > bestGain) {
    bestGain = gpGain;
    bestSplit = { feature: 'groupPresence', operator: 'eq', value: true, gain: gpGain };
  }

  // membershipTier (PREMIUM/LOYALTY vs STANDARD)
  const memLeft  = records.filter(r => ['PREMIUM', 'LOYALTY'].includes(r.membershipTier));
  const memRight = records.filter(r => r.membershipTier === 'STANDARD');
  const memGain  = giniGain(allLabels, memLeft.map(r => r._label), memRight.map(r => r._label));
  if (memGain > bestGain) {
    bestGain = memGain;
    bestSplit = { feature: 'membershipTier', operator: 'in', value: ['PREMIUM', 'LOYALTY'], gain: memGain };
  }

  // timeOfDay (MORNING vs AFTERNOON)
  const timeLeft  = records.filter(r => r.timeOfDay === 'MORNING');
  const timeRight = records.filter(r => r.timeOfDay !== 'MORNING');
  const timeGain  = giniGain(allLabels, timeLeft.map(r => r._label), timeRight.map(r => r._label));
  if (timeGain > bestGain) {
    bestGain = timeGain;
    bestSplit = { feature: 'timeOfDay', operator: 'in', value: ['MORNING', 'EVENING'], gain: timeGain };
  }

  // interactionDurationSec (find best threshold)
  const durations = [...new Set(records.map(r => r.interactionDurationSec))].sort((a, b) => a - b);
  for (const threshold of durations) {
    const left  = records.filter(r => r.interactionDurationSec <= threshold);
    const right = records.filter(r => r.interactionDurationSec > threshold);
    if (left.length === 0 || right.length === 0) continue;
    const gain = giniGain(allLabels, left.map(r => r._label), right.map(r => r._label));
    if (gain > bestGain) {
      bestGain = gain;
      bestSplit = { feature: 'interactionDurationSec', operator: 'lte', value: threshold, gain };
    }
  }

  return bestSplit;
}

// ---------------------------------------------------------------------------
// Majority class + confidence
// ---------------------------------------------------------------------------

function majorityClass(records) {
  const counts = {};
  records.forEach(r => { counts[r._label] = (counts[r._label] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { label: sorted[0][0], confidence: Math.round((sorted[0][1] / records.length) * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Build tree recursively
// ---------------------------------------------------------------------------

let nodeCounter = 0;

function buildTree(records, depth) {
  const { label, confidence } = majorityClass(records);

  // Stop conditions
  if (confidence === 1.0 || records.length < MIN_SAMPLES || depth >= MAX_DEPTH) {
    const nodeId = `persona_leaf_${nodeCounter++}`;
    return {
      id: nodeId,
      label: `Leaf: ${label} (${(confidence * 100).toFixed(0)}%)`,
      result: {
        customerPersona: label,
        confidence,
        reason: `${records.length} training samples, ${(confidence * 100).toFixed(0)}% purity`,
        membershipInfluenced: false,
      },
    };
  }

  const split = findBestSplit(records);
  if (!split || split.gain < 0.001) {
    const nodeId = `persona_leaf_${nodeCounter++}`;
    return {
      id: nodeId,
      label: `Leaf: ${label} (no beneficial split)`,
      result: {
        customerPersona: label,
        confidence,
        reason: `No further split improves classification (${records.length} samples)`,
        membershipInfluenced: false,
      },
    };
  }

  // Split records
  let leftRecords, rightRecords;
  if (split.feature === 'groupPresence') {
    leftRecords  = records.filter(r => r.groupPresence);
    rightRecords = records.filter(r => !r.groupPresence);
  } else if (split.feature === 'membershipTier') {
    leftRecords  = records.filter(r => ['PREMIUM', 'LOYALTY'].includes(r.membershipTier));
    rightRecords = records.filter(r => r.membershipTier === 'STANDARD');
  } else if (split.feature === 'timeOfDay') {
    leftRecords  = records.filter(r => r.timeOfDay === 'MORNING');
    rightRecords = records.filter(r => r.timeOfDay !== 'MORNING');
  } else {
    leftRecords  = records.filter(r => r.interactionDurationSec <= split.value);
    rightRecords = records.filter(r => r.interactionDurationSec > split.value);
  }

  // Mark membership influence on leaves under membership split
  const nodeId = `persona_node_${nodeCounter++}`;
  const conditionLabel = split.feature === 'interactionDurationSec'
    ? `${split.feature} <= ${split.value}s?`
    : `${split.feature} ${split.operator} ${JSON.stringify(split.value)}?`;

  const yesNode = buildTree(leftRecords, depth + 1);
  const noNode  = buildTree(rightRecords, depth + 1);

  // If this split is on membershipTier, mark downstream leaves
  if (split.feature === 'membershipTier') {
    markMembershipInfluence(yesNode);
  }

  return {
    id: nodeId,
    label: conditionLabel,
    condition: { field: split.feature, operator: split.operator, value: split.value },
    yes: yesNode,
    no: noNode,
  };
}

function markMembershipInfluence(node) {
  if (node.result) {
    node.result.membershipInfluenced = true;
    return;
  }
  if (node.yes) markMembershipInfluence(node.yes);
  if (node.no) markMembershipInfluence(node.no);
}

// ---------------------------------------------------------------------------
// Validate generated tree
// ---------------------------------------------------------------------------

function validateTree(tree) {
  const errors = [];
  let branchCount = 0;
  let maxDepth = 0;
  const reachablePersonas = new Set();

  function walk(node, depth) {
    if (depth > maxDepth) maxDepth = depth;
    if (node.result) {
      reachablePersonas.add(node.result.customerPersona);
      return;
    }
    branchCount++;
    if (node.yes) walk(node.yes, depth + 1);
    if (node.no) walk(node.no, depth + 1);
  }
  walk(tree, 0);

  if (branchCount < 2) errors.push(`Tree has fewer than 2 branches (${branchCount})`);
  if (maxDepth > MAX_DEPTH) errors.push(`Tree depth ${maxDepth} exceeds max ${MAX_DEPTH}`);
  if (reachablePersonas.size < 2) errors.push(`Only ${reachablePersonas.size} persona(s) reachable in tree`);

  if (errors.length > 0) {
    console.error('MODEL VALIDATION FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  return { branchCount, maxDepth, reachablePersonas: [...reachablePersonas] };
}

// ---------------------------------------------------------------------------
// Serialize tree to JS module
// ---------------------------------------------------------------------------

function serializeTree(tree) {
  const json = JSON.stringify(tree, null, 2);
  return `// =============================================================================
// Persona Decision Tree — GENERATED by trainPersonaModel.js
// DO NOT EDIT MANUALLY — re-run training script to regenerate.
//
// Target label: customerPersona
// Features: groupPresence, interactionDurationSec, membershipTier, timeOfDay
// Algorithm: CART (Gini impurity), max_depth=${MAX_DEPTH}, min_samples=${MIN_SAMPLES}
// Generated: ${new Date().toISOString()}
// =============================================================================

const personaDecisionTree = ${json};

export default personaDecisionTree;
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run() {
  console.log('\n' + '='.repeat(70));
  console.log('PERSONA MODEL TRAINING — Decision Tree from Labelled Dataset');
  console.log('='.repeat(70));

  // Load and map
  const rawRecords = loadDataset();
  console.log(`\nLoaded ${rawRecords.length} records`);

  const records = rawRecords.map(mapToSessionFeatures);
  const classes = validateDataset(records);
  console.log(`Persona classes found: ${classes.join(', ')}`);

  // Label distribution
  const dist = {};
  records.forEach(r => { dist[r._label] = (dist[r._label] || 0) + 1; });
  console.log('\nLabel distribution:');
  Object.entries(dist).forEach(([label, count]) => {
    console.log(`  ${label.padEnd(22)} ${count} records (${((count / records.length) * 100).toFixed(0)}%)`);
  });

  // Train
  console.log('\nTraining decision tree...');
  nodeCounter = 0;
  const tree = buildTree(records, 0);

  // Validate
  const validation = validateTree(tree);
  console.log(`\nTree validation PASSED:`);
  console.log(`  Branches: ${validation.branchCount}`);
  console.log(`  Max depth: ${validation.maxDepth}`);
  console.log(`  Reachable personas: ${validation.reachablePersonas.join(', ')}`);

  // Write tree config
  const treeSource = serializeTree(tree);
  fs.writeFileSync(TREE_OUTPUT, treeSource, 'utf8');
  console.log(`\nTree config written to: ${TREE_OUTPUT}`);

  // Write model metadata
  const datasetContent = fs.readFileSync(SAMPLE_PATH, 'utf8');
  const datasetHash = 'sha256:' + crypto.createHash('sha256').update(datasetContent).digest('hex').substring(0, 16);

  const meta = {
    trainedOn: 'customer_segmentation_sample.json',
    targetLabel: 'customerPersona',
    createdAt: new Date().toISOString(),
    algorithm: 'CART_DECISION_TREE',
    maxDepth: MAX_DEPTH,
    minSamples: MIN_SAMPLES,
    featuresUsed: ['groupPresence', 'interactionDurationSec', 'membershipTier', 'timeOfDay'],
    trainingMode: 'rule-derived-supervised-learning',
    trainingDisclaimer: 'Model replicates rule-based labelling; enables transition to real data later.',
    dataType: 'synthetic-labelled-proxy-dataset',
    generalizationNote: 'Works for demo. Replaceable with real hotel/PMS data when available. Dataset does not contain real domain labels — we mimic them, then later adapt to real data.',
    datasetHash,
    recordCount: records.length,
    labelDistribution: dist,
    totalRecords: records.length,
    validation,
    featureMappingSource: 'src/profiling/config/featureMapping.js',
    featureMappingGuarantee: 'Same mapping functions used in training (offline) and inference (runtime).',
  };
  fs.writeFileSync(META_OUTPUT, JSON.stringify(meta, null, 2), 'utf8');
  console.log(`Model metadata written to: ${META_OUTPUT}`);

  console.log('\n' + '='.repeat(70));
  console.log('Training complete. No runtime dependency created.');
  console.log('='.repeat(70) + '\n');
}

run();
