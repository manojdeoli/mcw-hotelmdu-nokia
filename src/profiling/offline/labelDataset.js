/**
 * =============================================================================
 * OFFLINE LABELING — Customer Persona Assignment
 * =============================================================================
 *
 * PURPOSE:
 *   Reads the customer segmentation sample dataset and assigns a supervised
 *   learning label "customerPersona" to each record using deterministic rules.
 *
 * RUNTIME: Node.js (offline only — never imported by the React app)
 * USAGE:   node src/profiling/offline/labelDataset.js
 *
 * OUTPUT:
 *   - src/profiling/offline/sampleData/customer_segmentation_sample.json (updated in-place)
 *   - src/profiling/offline/output/label_stats.json (stats only)
 *
 * LABELING RULES:
 *   Rule 1: familySize > 1 → FAMILY_CUSTOMER (0.95)
 *   Rule 2: solo + business profession/experience + high spender → BUSINESS_TRAVELLER (0.85–0.92)
 *   Rule 3: solo + moderate spender (40–70) → LEISURE_TRAVELLER (0.70–0.80)
 *   Rule 4: fallback → LEISURE_TRAVELLER (0.65)
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { BUSINESS_PROFESSIONS } = require('../config/featureMapping.cjs');

const DATA_PATH  = path.join(__dirname, 'sampleData', 'customer_segmentation_sample.json');
const STATS_PATH = path.join(__dirname, 'output', 'label_stats.json');

function assignPersona(record) {
  // Rule 1: Family
  if (record.familySize > 1) {
    return {
      customerPersona: 'FAMILY_CUSTOMER',
      _labelConfidence: 0.95,
      _labelReason: 'familySize > 1 — group/family indicator',
    };
  }

  // Rule 2: Business traveller
  const isBusinessProfession = BUSINESS_PROFESSIONS.includes(record.profession);
  const hasExperience = record.workExperience >= 7;
  if ((isBusinessProfession || hasExperience) && record.spendingScore >= 70) {
    const confidence = ['PREMIUM', 'LOYALTY'].includes(record._membershipTier) ? 0.92 : 0.85;
    return {
      customerPersona: 'BUSINESS_TRAVELLER',
      _labelConfidence: confidence,
      _labelReason: `solo + ${isBusinessProfession ? 'business profession' : 'high experience'} + high spendingScore (${record.spendingScore})`,
    };
  }

  // Rule 3: Leisure traveller (moderate spender)
  if (record.spendingScore >= 40 && record.spendingScore <= 70) {
    const confidence = record.spendingScore >= 55 ? 0.80 : 0.70;
    return {
      customerPersona: 'LEISURE_TRAVELLER',
      _labelConfidence: confidence,
      _labelReason: `solo + moderate spendingScore (${record.spendingScore}) in 40–70 range`,
    };
  }

  // Rule 4: Fallback
  return {
    customerPersona: 'LEISURE_TRAVELLER',
    _labelConfidence: 0.65,
    _labelReason: 'fallback — no strong business or family signal',
  };
}

function run() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const allRecords = JSON.parse(raw);

  // Separate metadata (first element) from data records
  const metadata = allRecords.find(r => r._note);
  const records = allRecords.filter(r => typeof r.id === 'number');

  // Label each record
  const labelled = records.map(record => ({
    ...record,
    ...assignPersona(record),
  }));

  // Build output with updated metadata
  const outputMetadata = {
    ...metadata,
    _labelFields: {
      customerPersona: 'BUSINESS_TRAVELLER | LEISURE_TRAVELLER | FAMILY_CUSTOMER',
      _labelConfidence: '0–1 confidence score for the assigned persona',
      _labelReason: 'Short rule explanation for the label assignment',
    },
  };
  const output = [outputMetadata, ...labelled];

  // Write labelled dataset back to source file (single source of truth)
  fs.writeFileSync(DATA_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Labelled dataset written to: ${DATA_PATH}`);
  console.log(`Total records labelled: ${labelled.length}`);

  // Compute and write stats
  const stats = { total: labelled.length, distribution: {} };
  labelled.forEach(r => {
    const p = r.customerPersona;
    if (!stats.distribution[p]) stats.distribution[p] = { count: 0, avgConfidence: 0 };
    stats.distribution[p].count++;
    stats.distribution[p].avgConfidence += r._labelConfidence;
  });
  Object.keys(stats.distribution).forEach(p => {
    const d = stats.distribution[p];
    d.percentage = ((d.count / stats.total) * 100).toFixed(1) + '%';
    d.avgConfidence = Math.round((d.avgConfidence / d.count) * 100) / 100;
  });

  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`Label stats written to: ${STATS_PATH}`);
  console.log('\nDistribution:');
  Object.entries(stats.distribution).forEach(([persona, d]) => {
    console.log(`  ${persona.padEnd(22)} ${d.count} records (${d.percentage})  avg confidence: ${d.avgConfidence}`);
  });
}

run();
