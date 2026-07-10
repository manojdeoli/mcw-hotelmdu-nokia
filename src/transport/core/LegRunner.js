// =============================================================================
// LegRunner
// src/transport/core/LegRunner.js
//
// Executes a single trip leg using the correct API call order per Point 6:
//   a. Number Verification (logged at leg start)
//   b. SIM Swap
//   c. Device Swap
//   d. Location Verification × all transit stations (find entry)
//   e. Reachability Subscription create
//   f. Device Reachability Status
//   g. Location Verification × all stations mid-journey (all FALSE)
//   h. Location Verification × all stations at exit (find exit)
//   i. Carrier Billing (handled by TripManager)
//   j. Reachability Subscription delete (handled by TripManager)
// =============================================================================

import { JourneyStateMachine, JOURNEY_STATUS } from './JourneyStateMachine.js';
import { GeofencingManager, DETECTION_MODE }   from './GeofencingManager.js';
import { EventProcessor }                      from './EventProcessor.js';
import { JourneySimulator }                    from './JourneySimulator.js';
import { PricingEngine }                       from './PricingEngine.js';
import { DeviceIntegrityChecker }              from './DeviceIntegrityChecker.js';
import { LEG_TYPE }                            from './Trip.js';
import { contextManager }                      from '../context/ContextManager.js';
import { getTravelTimeRanges }    from '../api/travelTimeApiAdapter.js';
import { correlate }              from './TransportCorrelationEngine.js';
import travelTimeConfig           from '../config/travelTimeConfig.json';
import { buildExplainabilityPayload } from './ExplainabilityFormatter.js';
import { explainabilityService }  from './ExplainabilityService.js';
import { setTransportScanPhase,
         setTransportStationCoords } from '../api/transportApiAdapter.js';

import stationsConfig from '../config/stations.json';
import pricingConfig  from '../config/pricingRules.json';

// All transit-mode stations used for multi-station scanning
const transitStations = stationsConfig.stations.filter(
  s => s.mode === 'transit' || s.mode === 'trip'
);

const PARKING_DWELL_STEPS = [
  { progressAfterMs: 2000, progress: 0.5  },
  { progressAfterMs: 1500, progress: 0.85 },
];

export class LegRunner {
  /**
   * @param {object} options
   * @param {object}   options.apiAdapter       — transport API adapter
   * @param {function} options.onProgress       — callback(progress 0-1) for SVG map
   * @param {function} options.onLog            — callback(message) for activity log
   * @param {function} options.onFraudCheck     — callback(FraudResult)
   * @param {function} [options.logInteraction] — API log callback
   */
  constructor({ apiAdapter, onProgress, onLog, onIntegrityCheck, logInteraction = null }) {
    this._api            = apiAdapter;
    this._onProgress     = onProgress       || (() => {});
    this._onLog          = onLog            || (() => {});
    this._onIntegrity    = onIntegrityCheck || (() => {});
    this._logFn          = logInteraction;
    this._pricing        = new PricingEngine(pricingConfig);
    this._integrity      = new DeviceIntegrityChecker({ apiAdapter, logInteraction });
    this._sm             = null;
    this._geoMgr         = null;
    this._simulator      = null;
    this._stopped        = false;
  }

  /**
   * Runs a single leg to completion.
   *
   * @param {object} legDef — { type, entryStation, exitStation, simulatedDurationMinutes? }
   * @param {string} phoneNumber
   * @returns {Promise<LegResult>}
   */
  run(legDef, phoneNumber) {
    this._stopped = false;
    return new Promise((resolve, reject) => {
      const { type, entryStation, exitStation, simulatedDurationMinutes } = legDef;
      let midJourneyScanDone  = false;
      let locationConsistency = 'CONSISTENT'; // Gap 3.6: tracks mid-journey scan outcome

      this._sm = new JourneyStateMachine({
        exitTimeoutMs: stationsConfig.exitTimeoutMs,
        onStateChange: async (j) => {
          if (j.status === JOURNEY_STATUS.COMPLETED) {
            const charge = this._pricing.calculate(j.entryEvent, j.exitEvent);
            this._geoMgr?.deactivate();
            resolve(this._buildLegResult(type, charge, j, locationConsistency));
          }
          if (j.status === JOURNEY_STATUS.TIMED_OUT) {
            const charge = this._pricing.calculateTimeout(j.entryEvent);
            this._geoMgr?.deactivate();
            resolve(this._buildLegResult(type, charge, j, locationConsistency));
          }
          if (j.status === JOURNEY_STATUS.ERROR) {
            this._geoMgr?.deactivate();
            reject(new Error(j.errorReason));
          }
        },
      });

      this._geoMgr = new GeofencingManager({
        apiAdapter:     this._api,
        detectionMode:  stationsConfig.detectionMode === 'GEOFENCE'
          ? DETECTION_MODE.GEOFENCE
          : DETECTION_MODE.LOCATION_VERIFY,
        onZoneEntered:  (ev) => processor.processZoneEntered(ev),
        logInteraction: this._logFn,
      });

      const processor = new EventProcessor({
        stateMachine:      this._sm,
        getContext:        () => contextManager.getCurrentContext(),
        isContextReliable: () => contextManager.isContextReliable(),
        journeyMode:       type === LEG_TYPE.PARKING ? 'parking' : 'transit',
        onEntry: async (ev) => {
          this._onLog(`Leg: Entry confirmed at ${ev.station.name} [${ev.detectionMethod}]`);

          // Steps a–c: Number Verification + SIM Swap + Device Swap
          this._onLog('Leg: [a] Number Verification (confirmed at leg start)');
          this._onLog('Leg: [b–c] SIM Swap + Device Swap checks...');
          const integrityCheck = await this._integrity.check(phoneNumber, 'ENTRY');
          this._onIntegrity(integrityCheck);
          this._logIntegrityResult(integrityCheck);

          if (type === LEG_TYPE.PARKING) {
            await this._runParkingDwell(exitStation, phoneNumber, simulatedDurationMinutes);
          } else {
            // Step e–f: Reachability Subscription + status at leg entry
            await this._runReachabilityCheck(phoneNumber, 'ENTRY');
            // LOCATION_VERIFY only: activate exit station subscription.
            // GEOFENCE mode: exit is handled by simulator onStationReached.
            if (this._geoMgr.getMode() === DETECTION_MODE.LOCATION_VERIFY) {
              this._geoMgr.activateForStation(exitStation, phoneNumber);
            }
          }
        },
        onExit: async (ev) => {
          this._onLog(`Leg: Exit confirmed at ${ev.station.name} [${ev.detectionMethod}]`);
          // Steps b–c at exit: confirm identity hasn’t changed mid-leg
          this._onLog('Leg: [b–c] SIM Swap + Device Swap checks at exit...');
          const exitIntegrity = await this._integrity.check(phoneNumber, 'EXIT');
          this._onIntegrity(exitIntegrity);
          this._logIntegrityResult(exitIntegrity);
        },
      });

      // Steps d + start detection
      this._geoMgr.activateForStation(entryStation, phoneNumber).then(async () => {
        if (type === LEG_TYPE.TRANSIT) {
          // Arm the location verification mock for this leg's entry/exit stations
          setTransportStationCoords(entryStation.coordinates, exitStation.coordinates);
          setTransportScanPhase('ENTRY', entryStation.id, exitStation.id);

          // Step d: scan all stations to confirm entry
          this._onLog('Leg: [d] Scanning all stations to confirm entry...');
          const detectedEntry = await this._geoMgr.scanStationsForEntry(
            transitStations, phoneNumber, 'ENTRY SCAN'
          );
          const confirmedEntry = detectedEntry || entryStation;
          if (detectedEntry) {
            this._onLog(`Leg: [d] Entry confirmed at ${detectedEntry.name} ✓`);
          } else {
            this._onLog(`Leg: [d] No station matched — using selected entry (${entryStation.name})`);
          }

          // Confirm entry then immediately switch to IN_TRANSIT so mid-journey
          // scan returns FALSE for all stations
          if (this._geoMgr.getMode() === DETECTION_MODE.GEOFENCE) {
            this._geoMgr.confirmEntryImmediate(confirmedEntry);
          } else {
            await this._geoMgr.checkStationEntry(confirmedEntry, phoneNumber);
          }
          setTransportScanPhase('IN_TRANSIT', entryStation.id, exitStation.id);

          this._simulator = new JourneySimulator({
            onWaypointReached: async ({ stepIndex, totalSteps }) => {
              const progress = stepIndex / Math.max(totalSteps - 1, 1);
              this._onProgress(progress);

              // Step g: mid-journey scan at ~50% (once only)
              if (progress >= 0.5 && !midJourneyScanDone &&
                  this._sm?.getStatus() === JOURNEY_STATUS.IN_TRANSIT) {
                midJourneyScanDone = true;
                this._onLog('Leg: [g] Mid-journey scan — all stations should return FALSE...');
                const midMatch = await this._geoMgr.scanStationsForEntry(
                  transitStations, phoneNumber, 'MID-JOURNEY SCAN'
                );
                if (midMatch) {
                  locationConsistency = 'UNEXPECTED_MID_MATCH'; // Gap 3.6
                  this._onLog(`Leg: [g] Unexpected match at ${midMatch.name} mid-journey — flagged`);
                } else {
                  this._onLog('Leg: [g] All stations FALSE — device confirmed in transit ✓');
                }
              }
            },
            onStationReached: async (station) => {
              if (this._geoMgr.getMode() === DETECTION_MODE.LOCATION_VERIFY) {
                const isExit = station.id === exitStation.id;
                if (isExit) {
                  // Step h: scan all stations to identify actual exit
                  setTransportScanPhase('AT_EXIT', entryStation.id, exitStation.id);
                  this._onLog('Leg: [h] Exit scan — scanning all stations to identify exit...');
                  const detectedExit = await this._geoMgr.scanStationsForEntry(
                    transitStations, phoneNumber, 'EXIT SCAN'
                  );
                  const resolvedExit = detectedExit || exitStation;
                  this._onLog(`Leg: [h] Exit identified — ${resolvedExit.name} ✓`);
                  await this._geoMgr.checkStationEntry(resolvedExit, phoneNumber);
                  setTransportScanPhase('IDLE');
                } else {
                  await this._geoMgr.checkStationEntry(station, phoneNumber);
                }
              } else {
                // GEOFENCE mode: simulator drives waypoints — confirm exit immediately
                // when the exit station is reached, simulate pass-through for intermediate stations
                const isExitStation = station.id === exitStation.id;
                const subId         = this._geoMgr.getActiveSubId();
                if (isExitStation) {
                  await new Promise(r => setTimeout(r, 0)); // yield for progress to render
                  this._geoMgr.confirmEntryImmediate(station);
                } else {
                  // Intermediate station: simulate pass-through (AREA_ENTERED then AREA_LEFT)
                  this._onLog(`Leg: Train passing through ${station.name} — pass-through`);
                  this._geoMgr.handleGeofenceEvent(subId, station);
                  setTimeout(() => this._geoMgr?.handleGeofenceLeftEvent(subId, station), 3000);
                }
              }
            },
            onClockTick: () => {},
          });
          this._simulator.run(entryStation, exitStation, 20);
        } else {
          // Parking: trigger entry check immediately
          this._onLog('Leg: [d] Checking entry gate via Location Verification...');
          this._geoMgr.checkStationEntry(entryStation, phoneNumber);
        }
      });
    });
  }

  stop() {
    this._stopped = true;
    this._simulator?.stop();
    this._geoMgr?.deactivate();
    setTransportScanPhase('IDLE');
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  async _runReachabilityCheck(phoneNumber, label) {
    try {
      this._onLog(`Leg: [e] Creating Reachability Subscription at ${label}...`);
      const sub = await this._api.createReachabilitySubscription(phoneNumber, this._logFn);
      this._onLog(`Leg: [f] Device Reachability Status at ${label}...`);
      const status = await this._api.deviceReachability(phoneNumber, this._logFn);
      this._onLog(`Leg: [f] Reachable: ${status.reachable ? 'Yes ✓' : 'No ⚠'} — ${status.connectivityStatus}`);
      // Clean up subscription immediately after status check
      await this._api.deleteReachabilitySubscription(sub.subscriptionId, this._logFn);
    } catch (err) {
      this._onLog(`Leg: Reachability check failed at ${label} — ${err.message}`);
    }
  }

  async _runParkingDwell(exitStation, phoneNumber, simulatedDurationMinutes) {
    this._onLog(`Leg: Vehicle parked — simulating ${simulatedDurationMinutes} min stay...`);
    this._onProgress(0.1);

    for (const step of PARKING_DWELL_STEPS) {
      if (this._stopped) return;
      await this._delay(step.progressAfterMs);
      this._onProgress(step.progress);
    }

    if (this._stopped) return;

    // Back-date entry timestamp for correct duration-based pricing
    if (simulatedDurationMinutes && this._sm._journey.entryEvent) {
      const fakeEntryMs = Date.now() - simulatedDurationMinutes * 60 * 1000;
      this._sm._journey.entryEvent = {
        ...this._sm._journey.entryEvent,
        timestamp: new Date(fakeEntryMs).toISOString(),
      };
    }

    this._onLog(`Leg: Checking exit gate via Location Verification...`);
    await this._geoMgr.checkStationEntry(exitStation, phoneNumber);
  }

  _buildLegResult(type, charge, journey, locationConsistency = 'CONSISTENT') {
    // For parking legs, build a minimal explainability payload now (no correlation)
    let explainJourneyId = null;
    if (type === LEG_TYPE.PARKING) {
      explainJourneyId = `leg-parking-${Date.now()}`;
      const payload = buildExplainabilityPayload({
        journeyId:         explainJourneyId,
        entryEvent:        journey.entryEvent  ?? null,
        exitEvent:         journey.exitEvent   ?? null,
        confidenceResult:  null,
        correlationResult: null,
        decisionResult:    null,
        validationResult:  null,
      });
      explainabilityService.store(explainJourneyId, payload);
    }
    return {
      type,
      fromStation:      charge.fromStation,
      toStation:        charge.toStation,
      fare:             charge.fare,
      isFree:           charge.fare === 0,
      ruleApplied:      charge.ruleApplied,
      ruleLabel:        charge.ruleLabel,
      durationMinutes:  charge.durationMinutes,
      calculation:      charge.calculation,
      detectionMethod:  charge.detectionMethod,
      completedAt:      new Date().toISOString(),
      timedOut:         journey.status === JOURNEY_STATUS.TIMED_OUT,
      correlationResult: null,
      locationConsistency,           // Gap 3.6: passed into runCorrelation()
      explainJourneyId,
      // _journey kept separately — only used by runCorrelation(), not stored in trip snapshot
      _journey:          journey,
    };
  }

  /**
   * Runs correlation for a completed leg and attaches result.
   * Called post-pricing so it never affects fare calculation.
   * Feature-gated — skipped entirely if featureEnabled=false.
   *
   * @param {object}  legResult       — from _buildLegResult()
   * @param {object}  entryStation    — station object
   * @param {object}  exitStation     — station object
   * @param {number|null} simulatedDurationMinutes
   * @param {object}  journey         — from JourneyStateMachine
   * @returns {Promise<object>}       — legResult with correlationResult attached
   */
  async runCorrelation(legResult, entryStation, exitStation, simulatedDurationMinutes, journey) {
    if (!travelTimeConfig.featureEnabled) return legResult;
    if (legResult.type !== LEG_TYPE.TRANSIT)  return legResult; // parking uses duration pricing directly

    // Resolve actual duration: same logic as PricingEngine
    let actualDurationMinutes = simulatedDurationMinutes ?? null;
    if (actualDurationMinutes == null && journey.entryEvent?.timestamp && journey.exitEvent?.timestamp) {
      const entryMs = new Date(journey.entryEvent.timestamp).getTime();
      const exitMs  = new Date(journey.exitEvent.timestamp).getTime();
      actualDurationMinutes = parseFloat(((exitMs - entryMs) / 60000).toFixed(1));
    }
    // demoScenario override
    const scenario = travelTimeConfig.demoScenario;
    if (scenario && travelTimeConfig.mockData?.demoScenarioTimings?.[scenario] != null) {
      actualDurationMinutes = travelTimeConfig.mockData.demoScenarioTimings[scenario];
      this._onLog(`Leg: [CORRELATION] Demo scenario '${scenario}' active — using synthetic duration ${actualDurationMinutes} min`);
    }

    try {
      const travelTimeRanges = await getTravelTimeRanges({
        fromStation: entryStation,
        toStation:   exitStation,
        addLog:      this._onLog,
      });
      const correlationResult = correlate({
        actualDurationMinutes,
        travelTimeRanges,
        toleranceMarginMinutes: travelTimeConfig.toleranceMarginMinutes ?? 2,
        candidateModes:         travelTimeConfig.supportedModes ?? ['rail', 'road', 'bus'],
        featureEnabled:         travelTimeConfig.featureEnabled,
        locationConsistency:    legResult.locationConsistency ?? 'CONSISTENT', // Gap 3.6
      });

      this._logCorrelation(correlationResult);

      // Build and store explainability payload for this leg
      const legJourneyId = legResult.completedAt
        ? `leg-${entryStation.id}-${exitStation.id}-${Date.now()}`
        : `leg-${Date.now()}`;
      const payload = buildExplainabilityPayload({
        journeyId:         legJourneyId,
        entryEvent:        journey.entryEvent  ?? null,
        exitEvent:         journey.exitEvent   ?? null,
        confidenceResult:  journey.entryEvent?.metadata?.confidence ?? null,
        correlationResult,
        decisionResult:    null, // decision applied at TripManager level after this returns
        validationResult:  null,
      });
      explainabilityService.store(legJourneyId, payload);

      return { ...legResult, correlationResult, explainJourneyId: legJourneyId };
    } catch (err) {
      this._onLog(`Leg: [CORRELATION] Error — ${err.message}`);
      return legResult;
    }
  }

  _logCorrelation(result) {
    const pct = result.correlationConfidence;
    console.log(
      `[CORRELATION] Mode=${result.inferredMode} Confidence=${pct} ` +
      `Actual=${result.actualDurationMinutes}min Ambiguity=${result.ambiguity}`
    );
    result.reasoning.forEach(r => console.log(`[CORRELATION] └ ${r}`));
    result.warnings.forEach(w  => console.warn(`[CORRELATION][WARN] ${w}`));
    this._onLog(
      `Leg: [CORRELATION] Inferred=${result.inferredMode} ` +
      `Confidence=${pct} Ambiguity=${result.ambiguity} ` +
      `Actual=${result.actualDurationMinutes}min`
    );
  }

  _logIntegrityResult(result) {
    const icon = result.overallStatus === 'PASS'  ? '✅'
               : result.overallStatus === 'WARN'  ? '⚠️'
               : result.overallStatus === 'FRAUD' ? '🚫'
               : 'ℹ️';
    this._onLog(
      `Leg: Integrity [${result.checkPoint}] ${icon} ${result.overallStatus} — ` +
      `SIM: ${result.simSwapped ? 'SWAPPED' : result.simError ? 'ERR' : 'OK'} | ` +
      `Device: ${result.devSwapped ? 'SWAPPED' : result.devError ? 'ERR' : 'OK'} | ` +
      `Reachable: ${result.reachable === true ? 'YES' : result.reachable === false ? 'NO' : 'UNKNOWN'}`
    );
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
