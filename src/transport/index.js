// =============================================================================
// Transport Module — Public Entry Point
// src/transport/index.js
//
// This is the ONLY file App.js needs to import from the transport module.
//
// Usage in App.js:
//   import { useTransportJourney, TransportDashboard } from './transport';
//
//   const transport = useTransportJourney({
//     phoneNumber,
//     logApiInteraction,
//     addMessage,
//     onWaypointUpdate: (coords) => setUserGps(coords),
//   });
//
//   <TransportDashboard {...transport} />
// =============================================================================

export { useTransportJourney }        from './hooks/useTransportJourney.js';
export { useTrip }                    from './hooks/useTrip.js';
export { TransportDashboard }         from './components/TransportDashboard.js';
export { TripDashboard }              from './components/TripDashboard.js';
export { ValidationTimeline }         from './components/ValidationTimeline.js';
export { JOURNEY_STATUS }             from './core/JourneyStateMachine.js';
export { DETECTION_MODE }             from './core/GeofencingManager.js';
export { BILLING_STATUS }             from './core/ReachabilityChecker.js';
export { TRIP_STATUS, LEG_TYPE }      from './core/TripManager.js';
export { INTEGRITY_STATUS }           from './core/DeviceIntegrityChecker.js';
export { computeTransportConfidence } from './core/TransportModeConfidence.js';
export { correlate }                  from './core/TransportCorrelationEngine.js';
export { decide, DECISION_OUTCOME }   from './core/TransportDecisionEngine.js';
export { ValidationHandler,
         VALIDATION_STATUS,
         VALIDATION_METHOD,
         ACCESS_STATE }             from './core/ValidationHandler.js';
export { buildExplainabilityPayload } from './core/ExplainabilityFormatter.js';
export { explainabilityService }      from './core/ExplainabilityService.js';
export { getTravelTimeRanges }        from './api/travelTimeApiAdapter.js';
export { contextManager }             from './context/ContextManager.js';
export { contextValidator }           from './context/ContextValidator.js';
export { deviceAdvisoryService }      from './services/deviceAdvisoryService.js';
export { deviceSessionManager }       from './services/deviceSessionManager.js';
export { realTimeDeviceState }        from './services/realTimeDeviceState.js';
