// =============================================================================
// Pricing Engine
// src/transport/core/PricingEngine.js
//
// Pure JavaScript — no React, no API, no app dependencies.
// Portable to any project that imports this file.
//
// Takes an entry event + exit event, looks up the zone pair in pricing rules,
// returns a ChargeSummary. Handles: ZONE_PAIR, SAME_ZONE, FALLBACK.
//
// Extensible: add new zone pairs to pricingRules.json — no code change needed.
// =============================================================================

export const RULE_APPLIED = Object.freeze({
  ZONE_PAIR:       'ZONE_PAIR',
  SAME_ZONE:       'SAME_ZONE',
  DURATION_BASED:  'DURATION_BASED',
  FALLBACK:        'FALLBACK',
  TIMED_OUT:       'TIMED_OUT',
});

export class PricingEngine {
  /**
   * @param {object} pricingConfig — contents of pricingRules.json
   */
  constructor(pricingConfig) {
    if (!pricingConfig || !Array.isArray(pricingConfig.rules)) {
      throw new Error('[PricingEngine] Invalid pricing config — rules array required');
    }
    this._rules    = pricingConfig.rules;
    this._currency = pricingConfig.currency || 'EUR';
    this._fallback = pricingConfig.fallbackFare ?? 2.00;
  }

  /**
   * Calculates the fare for a completed journey.
   *
   * @param {object} entryEvent — { station: { id, name, zoneId }, timestamp }
   * @param {object} exitEvent  — { station: { id, name, zoneId }, timestamp }
   * @returns {object} ChargeSummary
   */
  calculate(entryEvent, exitEvent) {
    if (!entryEvent || !exitEvent) {
      throw new Error('[PricingEngine] Both entryEvent and exitEvent are required');
    }

    const fromZone = entryEvent.station.zoneId;
    const toZone   = exitEvent.station.zoneId;
    const rule     = this._rules.find(r => r.fromZone === fromZone && r.toZone === toZone);

    let fare, ruleApplied, ruleLabel, durationMinutes, calculation;

    if (rule?.ruleType === RULE_APPLIED.DURATION_BASED) {
      // Use simulatedDurationMinutes from the exit event if present (parking demo).
      // This avoids the wall-clock problem where entry and exit timestamps are
      // only milliseconds apart during simulation.
      const hasSim = typeof exitEvent.simulatedDurationMinutes === 'number'
                     && exitEvent.simulatedDurationMinutes > 0;
      const entryMs   = new Date(entryEvent.timestamp).getTime();
      const exitMs    = new Date(exitEvent.timestamp).getTime();
      const hours     = hasSim
        ? exitEvent.simulatedDurationMinutes / 60
        : (exitMs - entryMs) / 3600000;
      durationMinutes = hasSim
        ? exitEvent.simulatedDurationMinutes
        : Math.round(hours * 60);
      const rawFare   = parseFloat((rule.ratePerHour * hours).toFixed(2));
      fare            = Math.max(rule.minimumFare, rawFare);
      ruleApplied     = RULE_APPLIED.DURATION_BASED;
      ruleLabel       = `${rule.label} — ${durationMinutes} min`;
      calculation     = {
        durationMinutes,
        hours:          parseFloat(hours.toFixed(4)),
        ratePerHour:    rule.ratePerHour,
        rawFare,
        minimumFare:    rule.minimumFare,
        minimumApplied: rawFare < rule.minimumFare,
        formula: `${durationMinutes} min ÷ 60 × €${rule.ratePerHour} = €${rawFare.toFixed(2)}${
          rawFare < rule.minimumFare ? ` (min €${rule.minimumFare})` : ''
        }`,
      };
    } else {
      fare        = rule ? rule.fare : this._fallback;
      ruleApplied = rule ? rule.ruleType : RULE_APPLIED.FALLBACK;
      ruleLabel   = rule ? rule.label   : `${fromZone} → ${toZone} (fallback)`;
      durationMinutes = null;
      calculation     = null;
    }

    return Object.freeze({
      journeyId:       entryEvent.journeyId || null,
      fromStation:     entryEvent.station.name,
      toStation:       exitEvent.station.name,
      fromZone,
      toZone,
      fare,
      currency:        this._currency,
      ruleApplied,
      ruleLabel,
      durationMinutes,
      calculation,
      detectionMethod: exitEvent.detectionMethod,
      calculatedAt:    new Date().toISOString(),
    });
  }

  /**
   * Returns a timeout charge summary when no exit was detected.
   *
   * @param {object} entryEvent
   * @returns {object} ChargeSummary
   */
  calculateTimeout(entryEvent) {
    return Object.freeze({
      journeyId:       entryEvent?.journeyId || null,
      fromStation:     entryEvent?.station?.name || 'Unknown',
      toStation:       'Unknown (timeout)',
      fromZone:        entryEvent?.station?.zoneId || 'Unknown',
      toZone:          'Unknown',
      fare:            this._fallback,
      currency:        this._currency,
      ruleApplied:     RULE_APPLIED.TIMED_OUT,
      ruleLabel:       'Timeout — fallback fare applied',
      detectionMethod: 'TIMEOUT',
      calculatedAt:    new Date().toISOString(),
    });
  }
}
