// =============================================================================
// useTransportJourney — React Hook
// src/transport/hooks/useTransportJourney.js
//
// API call order per Point 6 of the design review:
//   a. Number Verification
//   b. SIM Swap
//   c. Device Swap
//   d. Location Verification × all stations (find entry station)
//   e. Reachability Subscription create
//   f. Device Reachability Status (optional confirmation)
//   g. Location Verification × all stations mid-journey (all FALSE = in transit)
//   h. Location Verification × all stations at exit (one TRUE = exit station)
//   i. Carrier Billing
//   j. Reachability Subscription delete
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';

import stationsConfig  from '../config/stations.json';
import pricingConfig   from '../config/pricingRules.json';
import travelTimeConfig from '../config/travelTimeConfig.json';

import { JourneyStateMachine, JOURNEY_STATUS } from '../core/JourneyStateMachine.js';
import { PricingEngine }                        from '../core/PricingEngine.js';
import { GeofencingManager, DETECTION_MODE }    from '../core/GeofencingManager.js';
import { EventProcessor }                       from '../core/EventProcessor.js';
import { JourneySimulator }                     from '../core/JourneySimulator.js';
import { BILLING_STATUS }                       from '../core/ReachabilityChecker.js';
import { createTransportApiAdapter,
         setTransportScanPhase,
         setTransportStationCoords }       from '../api/transportApiAdapter.js';
import { getTravelTimeRanges }                  from '../api/travelTimeApiAdapter.js';
import { correlate }                            from '../core/TransportCorrelationEngine.js';
import { decide, DECISION_OUTCOME }             from '../core/TransportDecisionEngine.js';
import { ValidationHandler,
         VALIDATION_STATUS }                   from '../core/ValidationHandler.js';
import { buildExplainabilityPayload }           from '../core/ExplainabilityFormatter.js';
import { explainabilityService }               from '../core/ExplainabilityService.js';
import { contextManager }                       from '../context/ContextManager.js';
import { contextValidator }                     from '../context/ContextValidator.js';

const allStations     = stationsConfig.stations;
const transitStations = allStations.filter(s => s.mode === 'transit');
const exitTimeout     = stationsConfig.exitTimeoutMs;
const defaultRoute    = stationsConfig.defaultRoute;
const defaultParking  = stationsConfig.defaultParkingRoute;

const _delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export function useTransportJourney({ phoneNumber, logApiInteraction, addMessage, onWaypointUpdate }) {

  const [journey,            setJourney]            = useState(null);
  const [chargeResult,       setChargeResult]       = useState(null);
  const [billingResult,      setBillingResult]      = useState(null);
  const [isRunning,          setIsRunning]          = useState(false);
  const [errorMessage,       setErrorMessage]       = useState(null);
  const [reachabilityStatus, setReachabilityStatus] = useState(null);
  const [billingStatus,      setBillingStatus]      = useState(BILLING_STATUS.PENDING);
  const [mode,               setMode]               = useState('transit');
  const [routeProgress,      setRouteProgress]      = useState(0);
  const [fraudChecks,        setFraudChecks]        = useState([]);
  const [correlationResult,  setCorrelationResult]  = useState(null); // Phase 1
  const [decisionResult,     setDecisionResult]     = useState(null); // Phase 2
  const [validationResult,   setValidationResult]   = useState(null); // Phase 2
  const [explainPayload,     setExplainPayload]     = useState(null); // Phase 3
  const [contextState,       setContextState]       = useState(null);

  // Subscribe to context updates so UI re-renders when Android sends new events
  useEffect(() => {
    const listener = (ctx) => setContextState(ctx ? { ...ctx } : null);
    contextManager.addListener(listener);
    return () => contextManager.removeListener(listener);
  }, []);

  const smRef              = useRef(null);
  const processorRef       = useRef(null);
  const geoMgrRef          = useRef(null);
  const simulatorRef       = useRef(null);
  const reachSubIdRef      = useRef(null);
  const validationHandlerRef = useRef(null); // Phase 2
  const pricingRef         = useRef(new PricingEngine(pricingConfig));

  const stations = allStations.filter(s => s.mode === mode);

  // ---------------------------------------------------------------------------
  // Step a–c: Number Verification + SIM Swap + Device Swap
  // Run at the very start before any location check.
  // ---------------------------------------------------------------------------
  const runPreJourneyIntegrity = useCallback(async (apiAdapter) => {
    addMessage('Transport: [a] Number Verification...');
    // Number Verification reuses the existing verified phone — we log it as a
    // confirmation step rather than re-triggering OAuth. In production this
    // would be a fresh CAMARA Number Verification call.
    logApiInteraction(
      'Number Verification (Transport)',
      'POST',
      '/number-verification/verify',
      { phoneNumber },
      { devicePhoneNumberVerified: true, note: 'Confirmed at journey start' }
    );
    addMessage('Transport: [a] Number Verification — confirmed ✓');

    addMessage('Transport: [b] SIM Swap check...');
    const simResult = await apiAdapter.simSwap(phoneNumber, logApiInteraction);
    addMessage(`Transport: [b] SIM Swap — ${simResult.swapped ? '⚠ SWAPPED' : 'Clean ✓'}`);

    addMessage('Transport: [c] Device Swap check...');
    const devResult = await apiAdapter.deviceSwap(phoneNumber, logApiInteraction);
    addMessage(`Transport: [c] Device Swap — ${devResult.swapped ? '⚠ SWAPPED' : 'Clean ✓'}`);

    const check = {
      checkPoint:    'PRE-JOURNEY',
      simSwapped:    simResult.swapped,
      deviceSwapped: devResult.swapped,
      status: simResult.swapped || devResult.swapped ? 'FRAUD_RISK' : 'CLEAN',
    };
    setFraudChecks(prev => [...prev, check]);
    return check;
  }, [phoneNumber, logApiInteraction, addMessage]);

  // ---------------------------------------------------------------------------
  // Step d: Location Verification × all transit stations — find entry station
  // ---------------------------------------------------------------------------
  const scanForEntryStation = useCallback(async (geoMgr, candidateStations) => {
    addMessage('Transport: [d] Location Verification — scanning all stations to identify entry...');
    const matched = await geoMgr.scanStationsForEntry(candidateStations, phoneNumber, 'ENTRY SCAN');
    if (matched) {
      addMessage(`Transport: [d] Entry station identified — ${matched.name} ✓`);
    } else {
      addMessage('Transport: [d] No station matched — using selected station as fallback');
    }
    return matched;
  }, [phoneNumber, addMessage]);

  // ---------------------------------------------------------------------------
  // Step e–f: Reachability Subscription create + optional status check
  // ---------------------------------------------------------------------------
  const createReachabilitySub = useCallback(async (apiAdapter) => {
    addMessage('Transport: [e] Creating Reachability Subscription...');
    try {
      const sub = await apiAdapter.createReachabilitySubscription(phoneNumber, logApiInteraction);
      reachSubIdRef.current = sub.subscriptionId;
      addMessage(`Transport: [e] Reachability Subscription active (${sub.subscriptionId})`);

      addMessage('Transport: [f] Device Reachability Status check...');
      const status = await apiAdapter.deviceReachability(phoneNumber, logApiInteraction);
      addMessage(`Transport: [f] Device reachable: ${status.reachable ? 'Yes ✓' : 'No ⚠'} — ${status.connectivityStatus}`);
      setReachabilityStatus(status.reachable ? BILLING_STATUS.REACHABLE : BILLING_STATUS.RETRYING);
    } catch (err) {
      addMessage(`Transport: [e] Reachability Subscription failed — ${err.message}`);
    }
  }, [phoneNumber, logApiInteraction, addMessage]);

  // ---------------------------------------------------------------------------
  // Step g: Mid-journey scan — all stations should return FALSE
  // Called at ~50% route progress to confirm device is genuinely in transit.
  // ---------------------------------------------------------------------------
  const runMidJourneyScan = useCallback(async (geoMgr, candidateStations) => {
    addMessage('Transport: [g] Mid-journey Location Verification — confirming device is in transit...');
    const matched = await geoMgr.scanStationsForEntry(candidateStations, phoneNumber, 'MID-JOURNEY SCAN');
    if (!matched) {
      addMessage('Transport: [g] All stations returned FALSE — device confirmed in transit ✓');
    } else {
      addMessage(`Transport: [g] Unexpected match at ${matched.name} mid-journey — flagged`);
    }
  }, [phoneNumber, addMessage]);

  // ---------------------------------------------------------------------------
  // Step h: Exit scan — scan all stations to find which one returned TRUE
  // ---------------------------------------------------------------------------
  const scanForExitStation = useCallback(async (geoMgr, candidateStations, expectedExit) => {
    addMessage('Transport: [h] Location Verification — scanning all stations to identify exit...');
    const matched = await geoMgr.scanStationsForEntry(candidateStations, phoneNumber, 'EXIT SCAN');
    if (matched) {
      addMessage(`Transport: [h] Exit station identified — ${matched.name} ✓`);
      return matched;
    }
    addMessage(`Transport: [h] No station matched — using expected exit station (${expectedExit.name})`);
    return expectedExit;
  }, [phoneNumber, addMessage]);

  // ---------------------------------------------------------------------------
  // Step i–j: Carrier Billing + Reachability Subscription delete
  // ---------------------------------------------------------------------------
  const runBillingAndCleanup = useCallback(async (charge, apiAdapter) => {
    addMessage(`Transport: [i] Carrier Billing — ${charge.currency} ${charge.fare.toFixed(2)}...`);
    setBillingStatus(BILLING_STATUS.CHECKING);
    try {
      const result = await apiAdapter.carrierBilling(
        phoneNumber, logApiInteraction, charge.fare, charge.currency
      );
      setBillingResult(result);
      setBillingStatus(BILLING_STATUS.REACHABLE);
      addMessage(`Transport: [i] Carrier Billing successful — tx: ${result.paymentId}`);
    } catch (err) {
      addMessage(`Transport: [i] Carrier Billing failed — ${err.message}`);
      setBillingStatus(BILLING_STATUS.DEFERRED);
    }

    if (reachSubIdRef.current) {
      addMessage('Transport: [j] Deleting Reachability Subscription...');
      try {
        await apiAdapter.deleteReachabilitySubscription(reachSubIdRef.current, logApiInteraction);
        addMessage('Transport: [j] Reachability Subscription deleted ✓');
      } catch (err) {
        addMessage(`Transport: [j] Subscription delete failed — ${err.message}`);
      }
      reachSubIdRef.current = null;
    }
  }, [phoneNumber, logApiInteraction, addMessage]);

// =============================================================================
// Phase 1+2: Correlation then Decision — runs post-completion.
// Gap Fixes: Advisory generation with device session management
// Feature-gated. Correlation never affects fare.
// Decision gates billing when REQUIRE_VALIDATION.
// =============================================================================
const runCorrelationForJourney = useCallback(async (
  j, entryStation, exitStation, simulatedDurationMinutes, charge, apiAdapter
) => {
  if (!travelTimeConfig.featureEnabled) return null;

  // Parking: no travel time correlation, but still build an explainability record
  if (mode === 'parking') {
    const payload = buildExplainabilityPayload({
      journeyId:         j.journeyId,
      entryEvent:        j.entryEvent,
      exitEvent:         j.exitEvent,
      confidenceResult:  null,
      correlationResult: null,
      decisionResult:    null,
      validationResult:  null,
    });
    explainabilityService.store(j.journeyId, payload);
    setExplainPayload(payload);
    await runBillingAndCleanup(charge, apiAdapter);
    return null;
  }

  // Resolve duration
  let actualDurationMinutes = simulatedDurationMinutes ?? null;
  if (actualDurationMinutes == null && j.entryEvent?.timestamp && j.exitEvent?.timestamp) {
    const entryMs = new Date(j.entryEvent.timestamp).getTime();
    const exitMs  = new Date(j.exitEvent.timestamp).getTime();
    actualDurationMinutes = parseFloat(((exitMs - entryMs) / 60000).toFixed(1));
  }
  const scenario = travelTimeConfig.demoScenario;
  if (scenario && travelTimeConfig.mockData?.demoScenarioTimings?.[scenario] != null) {
    actualDurationMinutes = travelTimeConfig.mockData.demoScenarioTimings[scenario];
    addMessage(`Transport: [CORRELATION] Demo scenario '${scenario}' — synthetic duration ${actualDurationMinutes} min`);
  }

  let correlation = null;
  try {
    const ranges = await getTravelTimeRanges({ fromStation: entryStation, toStation: exitStation, addLog: addMessage });
    correlation = correlate({
      actualDurationMinutes,
      travelTimeRanges:       ranges,
      toleranceMarginMinutes: travelTimeConfig.toleranceMarginMinutes ?? 2,
      candidateModes:         travelTimeConfig.supportedModes ?? ['rail', 'road', 'bus'],
      featureEnabled:         travelTimeConfig.featureEnabled,
      locationConsistency:    'CONSISTENT', // hook path has no mid-journey tracking; always consistent
    });
    setCorrelationResult(correlation);
    addMessage(
      `Transport: [CORRELATION] Inferred=${correlation.inferredMode} ` +
      `Confidence=${correlation.correlationConfidence} ` +
      `Ambiguity=${correlation.ambiguity} ` +
      `Actual=${correlation.actualDurationMinutes}min`
    );
    correlation.reasoning.forEach(r => addMessage(`Transport: [CORRELATION] └ ${r}`));
  } catch (err) {
    addMessage(`Transport: [CORRELATION] Error — ${err.message}`);
    return null;
  }

  // Phase 2: Decision gate
  const decision = decide({
    correlationResult: correlation,
    confidenceResult:  j.entryEvent?.metadata?.confidence ?? null,
  });
  setDecisionResult(decision);
  addMessage(
    `Transport: [DECISION] ${decision.finalDecision} ` +
    `Mode=${decision.finalMode} ` +
    `Confidence=${decision.decisionConfidence}`
  );
  decision.decisionReasoning.forEach(r => addMessage(`Transport: [DECISION] └ ${r}`));

  // Phase 1 Gap Fix: Generate device advisory instead of direct validation

  // Helper: build + store explainability after validation resolves.
  // Defined here so it closes over j, correlation, decision from this call.
  function _buildAndStoreExplainPayload(journeyObj, corr, dec, handler) {
    const payload = buildExplainabilityPayload({
      journeyId:         journeyObj.journeyId,
      entryEvent:        journeyObj.entryEvent,
      exitEvent:         journeyObj.exitEvent,
      confidenceResult:  journeyObj.entryEvent?.metadata?.confidence ?? null,
      correlationResult: corr,
      decisionResult:    dec,
      validationResult:  handler?.getResult() ?? null,
    });
    explainabilityService.store(journeyObj.journeyId, payload);
    setExplainPayload(payload);
    fetch('/api/transport/explain', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    }).catch(() => {});
  }

  try {
    const { deviceAdvisoryService } = await import('../services/deviceAdvisoryService.js');
    
    // Generate advisory with all gap fixes applied
    const advisory = deviceAdvisoryService.generateAdvisory(
      correlation, decision, j.journeyId, phoneNumber
    );
    
    addMessage(
      `Transport: [ADVISORY] Generated - ValidationRequired=${advisory.validationRequired} ` +
      `Signal=${advisory.validationSignal} Confidence=${advisory.correlationConfidence} ` +
      `Ambiguity=${advisory.ambiguity} Stage=${advisory.stage}`
    );
    
    // Use gatewayClient directly — phone is connected via WebSocket, not backend session
    const { default: gatewayClient } = await import('../../gatewayClient.js');
    
    // Send advisory — if not connected, wait for next reconnect event (event-driven, not polling)
    let advisorySent = gatewayClient.sendAdvisory(advisory);

    if (!advisorySent) {
      addMessage(`Transport: [ADVISORY] Not connected — waiting for reconnect to send advisory...`);
      advisorySent = await new Promise((resolve) => {
        // Timeout after 15 seconds — give reconnect cycle enough time
        const timeout = setTimeout(() => {
          unsub();
          resolve(false);
        }, 15000);
        const unsub = gatewayClient.onReconnect(() => {
          clearTimeout(timeout);
          unsub();
          const sent = gatewayClient.sendAdvisory(advisory);
          addMessage(`Transport: [ADVISORY] Reconnect send result: ${sent ? 'SUCCESS' : 'FAILED'}`);
          resolve(sent);
        });
      });
    }
    addMessage(`Transport: [ADVISORY] Send result: ${advisorySent ? 'SUCCESS' : 'FAILED — device offline'}`);
    
    if (!advisorySent) {
      addMessage(`Transport: [FALLBACK] Device offline — advisory not delivered.`);

      if (decision.requiresValidation) {
        // Validation is required but device is not connected.
        // Enter PENDING state — user must click Simulate Barrier Detection.
        // autoResolve=false: the button is the ONLY way to resolve in demo mode.
        // A 60s safety-net timeout fires if neither button nor device responds.
        addMessage(`Transport: [VALIDATION] Pending — click 'Simulate Barrier Detection' to proceed`);
        validationHandlerRef.current?.dispose();
        validationHandlerRef.current = new ValidationHandler({
          onStatusChange: async (vResult) => {
            setValidationResult({ ...vResult });
            if (vResult.validationStatus === VALIDATION_STATUS.SUCCESS) {
              addMessage(`Transport: [VALIDATION] ${vResult.validationMethod} passed — proceeding to billing`);
              const billingDecision = deviceAdvisoryService.shouldAutoBill(true, 'SUCCESS');
              if (billingDecision.autoBill) {
                await runBillingAndCleanup(charge, apiAdapter);
              } else {
                setBillingStatus(BILLING_STATUS.DEFERRED);
              }
              _buildAndStoreExplainPayload(j, correlation, decision, validationHandlerRef.current);
            } else if (vResult.validationStatus === VALIDATION_STATUS.FAILED) {
              addMessage(`Transport: [VALIDATION] Failed — billing deferred for manual review`);
              setBillingStatus(BILLING_STATUS.DEFERRED);
              _buildAndStoreExplainPayload(j, correlation, decision, validationHandlerRef.current);
            }
          },
        });
        // autoResolve=false — button-driven only; no hidden timer competing with the button
        validationHandlerRef.current.require(decision.validationReason, false);
        setValidationResult({ ...validationHandlerRef.current.getResult() });
      } else {
        addMessage(`Transport: [FALLBACK] No validation required — proceeding with network-only billing`);
        setValidationResult({ validationRequired: false, validationStatus: 'NOT_REQUIRED',
          reason: 'Device offline — network-only mode' });
        await runBillingAndCleanup(charge, apiAdapter);
        _buildAndStoreExplainPayload(j, correlation, decision, null);
      }
    } else {
      if (decision.requiresValidation) {
        // Advisory sent to device. Wait for NFC validation event from phone.
        // autoResolve=false — device must respond. 60s safety-net handled below.
        addMessage(`Transport: [VALIDATION] Pending — waiting for device NFC tap...`);
        validationHandlerRef.current?.dispose();
        validationHandlerRef.current = new ValidationHandler({
          onStatusChange: async (vResult) => {
            setValidationResult({ ...vResult });
            if (vResult.validationStatus === VALIDATION_STATUS.SUCCESS) {
              addMessage(`Transport: [VALIDATION] ${vResult.validationMethod} passed — proceeding to billing`);
              const billingDecision = deviceAdvisoryService.shouldAutoBill(true, 'SUCCESS');
              if (billingDecision.autoBill) {
                await runBillingAndCleanup(charge, apiAdapter);
              } else {
                addMessage(`Transport: [BILLING] ${billingDecision.reason} - action: ${billingDecision.action}`);
                setBillingStatus(BILLING_STATUS.DEFERRED);
              }
              _buildAndStoreExplainPayload(j, correlation, decision, validationHandlerRef.current);
            } else if (vResult.validationStatus === VALIDATION_STATUS.FAILED) {
              addMessage(`Transport: [VALIDATION] Failed — billing deferred for manual review`);
              setBillingStatus(BILLING_STATUS.DEFERRED);
              _buildAndStoreExplainPayload(j, correlation, decision, validationHandlerRef.current);
            }
          },
        });
        validationHandlerRef.current.require(decision.validationReason, false);
        setValidationResult({ ...validationHandlerRef.current.getResult() });

        // Listen for NFC/biometric validation event from phone via WebSocket.
        // onReconnect re-arms the check after a 1006 disconnect so no event
        // is missed during the reconnect window.
        const unsubValidation = gatewayClient.subscribe((data) => {
          if (data.eventType === 'validation' && data.status === 'SUCCESS' &&
              validationHandlerRef.current?.getStatus() === VALIDATION_STATUS.PENDING) {
            const method = data.method === 'NFC' ? 'NFC' : 'BIOMETRIC';
            validationHandlerRef.current.resolve(method);
            unsubValidation();
            unsubReconnect();
          }
        });
        // On reconnect, check if validation was resolved while disconnected
        // by re-polling the backend validation result endpoint.
        const unsubReconnect = gatewayClient.onReconnect(async () => {
          if (validationHandlerRef.current?.getStatus() !== VALIDATION_STATUS.PENDING) return;
          try {
            const resp = await fetch(`/api/device/validation-result/${j.journeyId}`);
            if (resp.ok) {
              const result = await resp.json();
              if (result.validationStatus === 'SUCCESS' &&
                  validationHandlerRef.current?.getStatus() === VALIDATION_STATUS.PENDING) {
                const method = result.method === 'NFC' ? 'NFC' : 'BIOMETRIC';
                addMessage(`Transport: [VALIDATION] Recovered ${method} result after reconnect`);
                validationHandlerRef.current.resolve(method);
                unsubValidation();
                unsubReconnect();
              }
            }
          } catch (_) {}
        });
      } else {
        setValidationResult({ validationRequired: false, validationStatus: 'NOT_REQUIRED' });
        await runBillingAndCleanup(charge, apiAdapter);
        _buildAndStoreExplainPayload(j, correlation, decision, null);
      }
    }
    
  } catch (error) {
    addMessage(`Transport: [ADVISORY] Service error - ${error.message} - falling back to button-driven validation`);
    if (decision.requiresValidation) {
      validationHandlerRef.current?.dispose();
      validationHandlerRef.current = new ValidationHandler({
        onStatusChange: (vResult) => {
          setValidationResult({ ...vResult });
          if (vResult.validationStatus === VALIDATION_STATUS.SUCCESS) {
            addMessage(`Transport: [VALIDATION] ${vResult.validationMethod} passed — proceeding to billing`);
            runBillingAndCleanup(charge, apiAdapter);
            _buildAndStoreExplainPayload(j, correlation, decision, validationHandlerRef.current);
          } else if (vResult.validationStatus === VALIDATION_STATUS.FAILED) {
            addMessage(`Transport: [VALIDATION] Failed — billing deferred`);
            setBillingStatus(BILLING_STATUS.DEFERRED);
            _buildAndStoreExplainPayload(j, correlation, decision, validationHandlerRef.current);
          }
        },
      });
      // autoResolve=false — button-driven only, consistent with all other paths
      validationHandlerRef.current.require(decision.validationReason, false);
      setValidationResult({ ...validationHandlerRef.current.getResult() });
      addMessage(`Transport: [VALIDATION] Pending — click 'Simulate Barrier Detection' to proceed`);
    } else {
      setValidationResult({ validationRequired: false, validationStatus: 'NOT_REQUIRED' });
      await runBillingAndCleanup(charge, apiAdapter);
      _buildAndStoreExplainPayload(j, correlation, decision, null);
    }
  }

  return correlation;

}, [mode, addMessage, runBillingAndCleanup, phoneNumber]); // end runCorrelationForJourney

  // ---------------------------------------------------------------------------
  // Core journey runner — transit and parking
  // ---------------------------------------------------------------------------
  const runJourney = useCallback(async (entryStation, exitStation, apiAdapter, simulatedDurationMinutes = null) => {
    setErrorMessage(null);
    setChargeResult(null);
    setBillingResult(null);
    setReachabilityStatus(null);
    setBillingStatus(BILLING_STATUS.PENDING);
    setRouteProgress(0);
    setFraudChecks([]);
    setCorrelationResult(null); // Phase 1 reset
    setDecisionResult(null);    // Phase 2 reset
    setValidationResult(null);  // Phase 2 reset
    setExplainPayload(null);    // Phase 3 reset
    validationHandlerRef.current?.dispose();
    validationHandlerRef.current = null;
    setIsRunning(true);

    // Steps a–c: pre-journey integrity
    await runPreJourneyIntegrity(apiAdapter);

    // Arm the location verification mock for this journey
    setTransportStationCoords(entryStation.coordinates, exitStation.coordinates);
    setTransportScanPhase('ENTRY', entryStation.id, exitStation.id);

    // Geofencing manager — shared across steps d, g, h
    geoMgrRef.current = new GeofencingManager({
      apiAdapter,
      detectionMode: stationsConfig.detectionMode === 'GEOFENCE'
        ? DETECTION_MODE.GEOFENCE
        : DETECTION_MODE.LOCATION_VERIFY,
      onZoneEntered:  (ev) => processorRef.current?.processZoneEntered(ev),
      onPassThrough:  (station) => {
        addMessage(`Transport: Pass-through detected at ${station.name} — dwell threshold not met, discarding`);
      },
      logInteraction: logApiInteraction,
    });

    addMessage(`Transport: Journey starting — ${entryStation.name} → ${exitStation.name}`);

    // Step e–f: Reachability Subscription + status
    await createReachabilitySub(apiAdapter);

    let midJourneyScanDone = false;

    smRef.current = new JourneyStateMachine({
      exitTimeoutMs: exitTimeout,
      onStateChange: async (j) => {
        setJourney({ ...j });

        if (j.status === JOURNEY_STATUS.COMPLETED) {
          const charge = pricingRef.current.calculate(j.entryEvent, j.exitEvent);
          setChargeResult(charge);
          addMessage(`Transport: Fare — ${charge.ruleLabel} — ${charge.currency} ${charge.fare.toFixed(2)}`);
          geoMgrRef.current?.deactivate();
          setIsRunning(false);
          // Phase 1+2: correlation + decision gate; billing called inside
          await runCorrelationForJourney(
            j, entryStation, exitStation, simulatedDurationMinutes, charge, apiAdapter
          );
        }
        if (j.status === JOURNEY_STATUS.TIMED_OUT) {
          const charge = pricingRef.current.calculateTimeout(j.entryEvent);
          setChargeResult(charge);
          addMessage('Transport: Journey timed out — fallback fare applied');
          geoMgrRef.current?.deactivate();
          setIsRunning(false);
          await runCorrelationForJourney(
            j, entryStation, exitStation, simulatedDurationMinutes, charge, apiAdapter
          );
        }
        if (j.status === JOURNEY_STATUS.ERROR) {
          setErrorMessage(j.errorReason);
          geoMgrRef.current?.deactivate();
          setIsRunning(false);
        }
      },
    });

    processorRef.current = new EventProcessor({
      stateMachine:      smRef.current,
      getContext:        () => contextManager.getCurrentContext(),
      isContextReliable: () => contextManager.isContextReliable(),
      journeyMode:       mode,
      onEntry: async (ev) => {
        addMessage(`Transport: Entry confirmed at ${ev.station.name} [${ev.detectionMethod}]`);

        const ctxResult = contextValidator.validateEntry(
          mode, contextManager.getCurrentContext(), contextManager.isContextReliable()
        );
        addMessage(`Transport: Context [ENTRY] ${ctxResult.source} — ${ctxResult.reason}`);

        if (mode === 'parking') {
          const assoc = contextValidator.validateParkingAssociation(
            'ENTRY', contextManager.getCurrentContext(), contextManager.isContextReliable()
          );
          addMessage(`Transport: Parking Association [ENTRY] ${assoc.source} — ${assoc.reason}`);
        }

        if (geoMgrRef.current?.getMode() === DETECTION_MODE.LOCATION_VERIFY) {
          addMessage(`Transport: Activating exit zone detection at ${exitStation.name}...`);
          await geoMgrRef.current?.activateForStation(exitStation, phoneNumber);
        } else {
          // GEOFENCE mode + transit: the exit is confirmed by the simulator
          // reaching the exit station waypoint (onStationReached below).
          // No subscription switch needed — confirmEntryImmediate fires directly.
          // Nothing to do here.
        }
      },
      onExit: async (ev) => {
        addMessage(`Transport: Exit confirmed at ${ev.station.name} [${ev.detectionMethod}]`);

        // Context validation at exit — additive only, never blocks
        const ctxResult = contextValidator.validateExit(
          mode, contextManager.getCurrentContext(), contextManager.isContextReliable()
        );
        addMessage(`Transport: Context [EXIT] ${ctxResult.source} — ${ctxResult.reason}`);

        // Parking phone-to-car association check at exit
        if (mode === 'parking') {
          const assoc = contextValidator.validateParkingAssociation(
            'EXIT', contextManager.getCurrentContext(), contextManager.isContextReliable()
          );
          addMessage(`Transport: Parking Association [EXIT] ${assoc.source} — ${assoc.reason}`);
        }
      },
    });

    simulatorRef.current = new JourneySimulator({
      onWaypointReached: async ({ coords, stepIndex, totalSteps }) => {
        const progress = stepIndex / Math.max(totalSteps - 1, 1);
        setRouteProgress(progress);
        if (onWaypointUpdate) onWaypointUpdate(coords);

        // Step g: mid-journey scan at ~50% progress (once only)
        if (progress >= 0.5 && !midJourneyScanDone &&
            smRef.current?.getStatus() === JOURNEY_STATUS.IN_TRANSIT) {
          midJourneyScanDone = true;
          setTransportScanPhase('IN_TRANSIT', entryStation.id, exitStation.id); // all stations FALSE
          await runMidJourneyScan(geoMgrRef.current, transitStations);
          setTransportScanPhase('AT_EXIT', entryStation.id, exitStation.id);    // ready for exit

          // Context mid-journey validation — additive
          const ctxResult = contextValidator.validateMidJourney(
            mode, contextManager.getCurrentContext(), contextManager.isContextReliable()
          );
          addMessage(`Transport: Context [MID-JOURNEY] ${ctxResult.source} — ${ctxResult.reason}`);
        }
      },
      onStationReached: async (station) => {
        const detectionMode = geoMgrRef.current.getMode();

        if (detectionMode === DETECTION_MODE.LOCATION_VERIFY) {
          const isExitWaypoint = station.id === exitStation.id;
          if (isExitWaypoint) {
            setTransportScanPhase('AT_EXIT', entryStation.id, exitStation.id);
            await scanForExitStation(geoMgrRef.current, transitStations, exitStation);
            await geoMgrRef.current.checkStationEntry(exitStation, phoneNumber);
          } else {
            await geoMgrRef.current.checkStationEntry(station, phoneNumber);
          }
        } else {
          const isExitStation    = station.id === exitStation.id;
          const isParkingStation = !station.dwellConfirmMs;
          const subId            = geoMgrRef.current.getActiveSubId();

          if (isExitStation) {
            // Yield one event-loop tick so setRouteProgress(1.0) from
            // onWaypointReached renders before the journey completes.
            await new Promise(r => setTimeout(r, 0));
            geoMgrRef.current.confirmEntryImmediate(station);
          } else if (isParkingStation) {
            geoMgrRef.current.confirmEntryImmediate(station);
          } else {
            // Transit intermediate station: simulate pass-through.
            addMessage(`Transport: Train passing through ${station.name} — simulating AREA_LEFT in 3s...`);
            geoMgrRef.current.handleGeofenceEvent(subId, station);
            setTimeout(() => {
              geoMgrRef.current?.handleGeofenceLeftEvent(subId, station);
            }, 3000);
          }
        }
      },
      onClockTick: () => {},
    });

    // Step d: scan all transit stations to identify actual entry station.
    // activateForStation is called first so the geofence subscription is live.
    // Both calls happen AFTER processorRef is set so onZoneEntered is handled.
    await geoMgrRef.current.activateForStation(entryStation, phoneNumber);
    await scanForEntryStation(geoMgrRef.current, transitStations);

    // Trigger entry detection then start the simulator.
    // Parking and transit are handled differently:
    //
    // PARKING: entry + dwell + exit are all sequential — run them fully before
    // the simulator starts (simulator is not used for parking progress).
    //
    // TRANSIT GEOFENCE: confirm entry immediately, then run simulator which
    // drives routeProgress and fires exit at the final waypoint.
    //
    // TRANSIT LOCATION_VERIFY: check entry station, then run simulator which
    // calls checkStationEntry at each waypoint.

    if (mode === 'parking') {
      // Entry
      if (geoMgrRef.current.getMode() === DETECTION_MODE.GEOFENCE) {
        geoMgrRef.current.confirmEntryImmediate(entryStation);
      } else {
        await geoMgrRef.current.checkStationEntry(entryStation, phoneNumber);
      }

      // Dwell simulation — progress 0 → 0.1 → 0.5 → 0.85
      addMessage(`Transport: Vehicle parked — simulating ${simulatedDurationMinutes} min stay...`);
      setRouteProgress(0.1);
      await _delay(2000);
      setRouteProgress(0.5);
      await _delay(1500);
      setRouteProgress(0.85);

      // Back-date entry timestamp so duration-based pricing is correct
      if (simulatedDurationMinutes && smRef.current._journey.entryEvent) {
        const fakeEntryMs = Date.now() - simulatedDurationMinutes * 60 * 1000;
        smRef.current._journey.entryEvent = {
          ...smRef.current._journey.entryEvent,
          timestamp: new Date(fakeEntryMs).toISOString(),
        };
      }

      // Exit
      addMessage('Transport: Checking exit gate via Location Verification...');
      await geoMgrRef.current.checkStationEntry(exitStation, phoneNumber);
      setRouteProgress(1.0);

    } else {
      // Transit: confirm entry then run simulator
      if (geoMgrRef.current.getMode() === DETECTION_MODE.GEOFENCE) {
        geoMgrRef.current.confirmEntryImmediate(entryStation);
      } else {
        setTransportScanPhase('ENTRY', entryStation.id, exitStation.id);
        await geoMgrRef.current.checkStationEntry(entryStation, phoneNumber);
        // After entry confirmed, switch to IN_TRANSIT — mid-journey scan will switch to AT_EXIT
        setTransportScanPhase('IN_TRANSIT', entryStation.id, exitStation.id);
      }
      await simulatorRef.current.run(entryStation, exitStation, 20, simulatedDurationMinutes);
      // Journey complete — reset phase
      setTransportScanPhase('IDLE');
    }

  }, [phoneNumber, logApiInteraction, addMessage, onWaypointUpdate,
      runPreJourneyIntegrity, scanForEntryStation, createReachabilitySub,
      runMidJourneyScan, scanForExitStation, runBillingAndCleanup,
      runCorrelationForJourney, mode]);

  // ---------------------------------------------------------------------------
  // Start transit journey
  // ---------------------------------------------------------------------------
  const startJourney = useCallback(async (entryStationId, exitStationId) => {
    if (!phoneNumber) { setErrorMessage('Phone number required'); return; }
    const entryStation = allStations.find(s => s.id === (entryStationId || defaultRoute.entryStationId));
    const exitStation  = allStations.find(s => s.id === (exitStationId  || defaultRoute.exitStationId));
    if (!entryStation || !exitStation) { setErrorMessage('Invalid station configuration'); return; }
    await runJourney(entryStation, exitStation, createTransportApiAdapter());
  }, [phoneNumber, runJourney]);

  // ---------------------------------------------------------------------------
  // Start parking
  // ---------------------------------------------------------------------------
  const startParking = useCallback(async () => {
    if (!phoneNumber) { setErrorMessage('Phone number required'); return; }
    const entryStation = allStations.find(s => s.id === defaultParking.entryStationId);
    const exitStation  = allStations.find(s => s.id === defaultParking.exitStationId);
    if (!entryStation || !exitStation) { setErrorMessage('Parking station config missing'); return; }
    const simulatedDurationMins = (Math.floor(Math.random() * 13) + 4) * 15;
    addMessage(`Transport: Simulated parking duration — ${simulatedDurationMins} min`);
    await runJourney(entryStation, exitStation, createTransportApiAdapter(), simulatedDurationMins);
  }, [phoneNumber, runJourney, addMessage]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const resetJourney = useCallback(() => {
    simulatorRef.current?.stop();
    geoMgrRef.current?.deactivate();
    smRef.current?.reset();
    validationHandlerRef.current?.dispose();
    validationHandlerRef.current = null;
    setTransportScanPhase('IDLE'); // reset mock phase
    setJourney(null);
    setChargeResult(null);
    setBillingResult(null);
    setIsRunning(false);
    setErrorMessage(null);
    setReachabilityStatus(null);
    setBillingStatus(BILLING_STATUS.PENDING);
    setRouteProgress(0);
    setFraudChecks([]);
    setCorrelationResult(null);
    setDecisionResult(null);   // Phase 2
    setValidationResult(null); // Phase 2
    setExplainPayload(null);   // Phase 3
  }, []);

  return {
    journey,
    chargeResult,
    billingResult,
    isRunning,
    errorMessage,
    reachabilityStatus,
    billingStatus,
    mode,
    setMode,
    stations,
    startJourney,
    startParking,
    resetJourney,
    routeProgress,
    fraudChecks,
    correlationResult,
    decisionResult,
    validationResult,
    explainPayload,
    simulatePassScan: () => validationHandlerRef.current?.simulatePassScan(),
    detectionFallback:       geoMgrRef.current?.didFallback() ?? false,
    journeyStatus:           journey?.status || JOURNEY_STATUS.IDLE,
    contextState,
    contextReliability:      contextManager.getReliabilityStatus(),
  };
}
