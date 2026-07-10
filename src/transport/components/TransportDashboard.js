// =============================================================================
// TransportDashboard — UI Component
// src/transport/components/TransportDashboard.js
// =============================================================================

import React, { useState } from 'react';
import { JOURNEY_STATUS } from '../core/JourneyStateMachine.js';
import { TripDashboard }  from './TripDashboard.js';
import { ValidationTimeline } from './ValidationTimeline.js';
import { useTrip }        from '../hooks/useTrip.js';
import { BILLING_STATUS } from '../core/ReachabilityChecker.js';

const STATUS_COLOR = {
  [JOURNEY_STATUS.IDLE]:       '#6c757d',
  [JOURNEY_STATUS.IN_TRANSIT]: '#007bff',
  [JOURNEY_STATUS.COMPLETED]:  '#28a745',
  [JOURNEY_STATUS.TIMED_OUT]:  '#fd7e14',
  [JOURNEY_STATUS.ERROR]:      '#dc3545',
};

const STATUS_LABEL = {
  [JOURNEY_STATUS.IDLE]:       'Ready',
  [JOURNEY_STATUS.IN_TRANSIT]: 'In Transit',
  [JOURNEY_STATUS.COMPLETED]:  'Completed',
  [JOURNEY_STATUS.TIMED_OUT]:  'Timed Out',
  [JOURNEY_STATUS.ERROR]:      'Error',
};

const BILLING_BADGE = {
  [BILLING_STATUS.PENDING]:   { color: '#6c757d', label: 'Pending'   },
  [BILLING_STATUS.CHECKING]:  { color: '#007bff', label: 'Checking'  },
  [BILLING_STATUS.REACHABLE]: { color: '#28a745', label: 'Reachable' },
  [BILLING_STATUS.RETRYING]:  { color: '#fd7e14', label: 'Retrying'  },
  [BILLING_STATUS.DEFERRED]:  { color: '#dc3545', label: 'Deferred'  },
};

const RULE_BADGE = {
  ZONE_PAIR:      { color: '#28a745', label: 'Zone Pair'      },
  SAME_ZONE:      { color: '#17a2b8', label: 'Same Zone'      },
  DURATION_BASED: { color: '#6f42c1', label: 'Duration Based' },
  FALLBACK:       { color: '#fd7e14', label: 'Fallback'       },
  TIMED_OUT:      { color: '#dc3545', label: 'Timeout'        },
};

// ---------------------------------------------------------------------------
// SVG Route Map — Transit
// ---------------------------------------------------------------------------
const MAP_WIDTH  = 850;
const MAP_HEIGHT = 72;
const TRACK_Y    = 32;
const MARGIN     = 44;

function RouteMap({ stations, entryId, exitId, routeProgress, journeyStatus }) {
  const entryIdx = stations.findIndex(s => s.id === entryId);
  const exitIdx  = stations.findIndex(s => s.id === exitId);
  const fromIdx  = Math.min(entryIdx, exitIdx);
  const toIdx    = Math.max(entryIdx, exitIdx);
  const visible  = stations.slice(fromIdx, toIdx + 1);

  const trackWidth = MAP_WIDTH - MARGIN * 2;
  const stationX = (i) =>
    visible.length === 1 ? MAP_WIDTH / 2 : MARGIN + (i / (visible.length - 1)) * trackWidth;

  const startX   = stationX(0);
  const endX     = stationX(visible.length - 1);
  const vehicleX = startX + routeProgress * (endX - startX);
  const isActive = journeyStatus === JOURNEY_STATUS.IN_TRANSIT;
  const isDone   = journeyStatus === JOURNEY_STATUS.COMPLETED;

  return (
    <svg width="100%" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      style={{ display: 'block', maxWidth: '850px', background: '#f0f4f8', borderRadius: '6px', marginBottom: '12px' }}>
      <line x1={stationX(0)} y1={TRACK_Y} x2={stationX(visible.length - 1)} y2={TRACK_Y}
        stroke="#ced4da" strokeWidth="4" strokeLinecap="round" />
      {(isActive || isDone) && (
        <line x1={stationX(0)} y1={TRACK_Y}
          x2={isDone ? stationX(visible.length - 1) : vehicleX} y2={TRACK_Y}
          stroke="#007bff" strokeWidth="4" strokeLinecap="round" />
      )}
      {visible.map((station, i) => {
        const x = stationX(i);
        const isPassed  = isActive && vehicleX > x + 2;
        const nodeColor = isDone || isPassed ? station.color : (isActive && i === 0 ? station.color : '#ced4da');
        return (
          <g key={station.id}>
            <circle cx={x} cy={TRACK_Y} r={10} fill="#fff" stroke={station.color} strokeWidth="2" />
            <circle cx={x} cy={TRACK_Y} r={6}  fill={nodeColor} />
            <text x={x} y={TRACK_Y + 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="#495057">{station.shortName}</text>
            <text x={x} y={TRACK_Y + 30} textAnchor="middle" fontSize="8" fill="#6c757d">{station.zoneId}</text>
          </g>
        );
      })}
      {isActive && (
        <g>
          <circle cx={vehicleX} cy={TRACK_Y} r={9} fill="none" stroke="#007bff" strokeWidth="1.5" opacity="0.4" />
          <circle cx={vehicleX} cy={TRACK_Y} r={6} fill="#007bff" />
          <rect x={vehicleX - 3.5} y={TRACK_Y - 3} width="7" height="5" rx="1.5" fill="#fff" opacity="0.9" />
          <rect x={vehicleX - 2.5} y={TRACK_Y + 2} width="1.8" height="1.5" rx="0.5" fill="#fff" opacity="0.7" />
          <rect x={vehicleX + 0.7} y={TRACK_Y + 2} width="1.8" height="1.5" rx="0.5" fill="#fff" opacity="0.7" />
        </g>
      )}
      {isDone && (
        <g>
          <circle cx={stationX(visible.length - 1)} cy={TRACK_Y} r={10} fill="#28a745" />
          <text x={stationX(visible.length - 1)} y={TRACK_Y + 4} textAnchor="middle" fontSize="10" fill="#fff">✓</text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SVG Parking Map — Entry → [parked] → Exit
// ---------------------------------------------------------------------------
const PKG_WIDTH  = 850;
const PKG_HEIGHT = 72;
const PKG_Y      = 32;

function ParkingMap({ routeProgress, journeyStatus }) {
  const entryX  = 60;
  const exitX   = PKG_WIDTH - 60;
  const midX    = PKG_WIDTH / 2;
  const isActive = journeyStatus === JOURNEY_STATUS.IN_TRANSIT;
  const isDone   = journeyStatus === JOURNEY_STATUS.COMPLETED;

  // Car X: 0→0.1 entry, 0.1→0.85 parked (stays at mid), 0.85→1 exit
  let carX;
  if (routeProgress <= 0.1) {
    carX = entryX + (routeProgress / 0.1) * (midX - entryX);
  } else if (routeProgress <= 0.85) {
    carX = midX;
  } else {
    carX = midX + ((routeProgress - 0.85) / 0.15) * (exitX - midX);
  }

  const fillX = entryX + routeProgress * (exitX - entryX);

  return (
    <svg width="100%" viewBox={`0 0 ${PKG_WIDTH} ${PKG_HEIGHT}`}
      style={{ display: 'block', maxWidth: '850px', background: '#f0f4f8', borderRadius: '6px', marginBottom: '12px' }}>

      {/* Track */}
      <line x1={entryX} y1={PKG_Y} x2={exitX} y2={PKG_Y} stroke="#ced4da" strokeWidth="4" strokeLinecap="round" />

      {/* Progress fill */}
      {(isActive || isDone) && (
        <line x1={entryX} y1={PKG_Y} x2={isDone ? exitX : fillX} y2={PKG_Y}
          stroke="#6f42c1" strokeWidth="4" strokeLinecap="round" />
      )}

      {/* Parking bay area */}
      <rect x={midX - 60} y={PKG_Y - 18} width="120" height="36" rx="4"
        fill="#e8f4fd" stroke="#b8daff" strokeWidth="1.5" strokeDasharray="4,3" />
      <text x={midX} y={PKG_Y + 4} textAnchor="middle" fontSize="9" fill="#6c757d" fontWeight="600">PARKING BAY</text>

      {/* Entry node */}
      <circle cx={entryX} cy={PKG_Y} r={10} fill="#fff" stroke="#1E90FF" strokeWidth="2" />
      <circle cx={entryX} cy={PKG_Y} r={6}  fill={isActive || isDone ? '#1E90FF' : '#ced4da'} />
      <text x={entryX} y={PKG_Y + 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="#495057">Entry</text>
      <text x={entryX} y={PKG_Y + 30} textAnchor="middle" fontSize="8" fill="#6c757d">PKG_ZONE</text>

      {/* Exit node */}
      <circle cx={exitX} cy={PKG_Y} r={10} fill="#fff" stroke="#28a745" strokeWidth="2" />
      <circle cx={exitX} cy={PKG_Y} r={6}  fill={isDone ? '#28a745' : '#ced4da'} />
      <text x={exitX} y={PKG_Y + 20} textAnchor="middle" fontSize="9" fontWeight="600" fill="#495057">Exit</text>
      <text x={exitX} y={PKG_Y + 30} textAnchor="middle" fontSize="8" fill="#6c757d">PKG_ZONE</text>

      {/* Car icon */}
      {isActive && (
        <g>
          <circle cx={carX} cy={PKG_Y} r={9} fill="none" stroke="#6f42c1" strokeWidth="1.5" opacity="0.4" />
          <circle cx={carX} cy={PKG_Y} r={6} fill="#6f42c1" />
          <rect x={carX - 3.5} y={PKG_Y - 3} width="7" height="5" rx="1.5" fill="#fff" opacity="0.9" />
          <rect x={carX - 2.5} y={PKG_Y + 2} width="1.8" height="1.5" rx="0.5" fill="#fff" opacity="0.7" />
          <rect x={carX + 0.7} y={PKG_Y + 2} width="1.8" height="1.5" rx="0.5" fill="#fff" opacity="0.7" />
        </g>
      )}
      {isDone && (
        <g>
          <circle cx={exitX} cy={PKG_Y} r={10} fill="#28a745" />
          <text x={exitX} y={PKG_Y + 4} textAnchor="middle" fontSize="10" fill="#fff">✓</text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Fraud Detection Panel
// ---------------------------------------------------------------------------
const FRAUD_CHECK_ICON = {
  CLEAN:          { icon: '✅', color: '#155724', bg: '#d4edda', border: '#c3e6cb' },
  SIM_SWAPPED:    { icon: '⚠️', color: '#721c24', bg: '#f8d7da', border: '#f5c6cb' },
  DEVICE_SWAPPED: { icon: '⚠️', color: '#721c24', bg: '#f8d7da', border: '#f5c6cb' },
  BOTH_SWAPPED:   { icon: '🚫', color: '#721c24', bg: '#f8d7da', border: '#f5c6cb' },
  CHECK_FAILED:   { icon: 'ℹ️', color: '#856404', bg: '#fff3cd', border: '#ffeeba' },
};

function FraudPanel({ fraudChecks }) {
  if (!fraudChecks || fraudChecks.length === 0) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '0.8em', fontWeight: 700, color: '#495057', marginBottom: '4px' }}>
        🔍 Identity Fraud Checks
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {fraudChecks.map((fc, i) => {
          const style = FRAUD_CHECK_ICON[fc.status] || FRAUD_CHECK_ICON.CHECK_FAILED;
          return (
            <div key={i} style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.8em',
              minWidth: '180px',
            }}>
              <div style={{ fontWeight: 700, color: style.color, marginBottom: '4px' }}>
                {style.icon} {fc.checkPoint} — {fc.status.replace('_', ' ')}
              </div>
              <div style={{ color: style.color, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span>SIM Swap: <strong>{fc.simSwapped ? 'DETECTED' : fc.simError ? 'Error' : 'Clear'}</strong></span>
                <span>Device Swap: <strong>{fc.deviceSwapped ? 'DETECTED' : fc.deviceError ? 'Error' : 'Clear'}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo Controls Panel — simulates hardware events for end-to-end testing
// Shows different controls per active sub-tab and journey state
// ---------------------------------------------------------------------------
function DemoControlsPanel({
  subTab, mode, journeyStatus, isRunning,
  startJourney, startParking, resetJourney,
  simulatePassScan, validationResult,
  transitStations, entryId, exitId,
  tripControls,
  phoneNumber,
  onSimulateBarrier,
}) {
  const [open, setOpen] = React.useState(false);
  // Tracks the interval ID for vehicle motion simulation so Stop can cancel it
  const motionIntervalRef = React.useRef(null);
  const [motionActive, setMotionActive] = React.useState(false);

  // Start streaming fake vehicle context events every 3 seconds.
  // This keeps the Android Context strip showing RELIABLE for as long as
  // the simulation is running — matching what the real Android app does.
  function startMotionSimulation() {
    if (motionIntervalRef.current) return; // already running
    const inject = () => {
      import('../context/ContextManager.js').then(({ contextManager }) => {
        contextManager.updateContext({
          mode:       'CAR',
          confidence: 85,
          timestamp:  Date.now(),
          signals: {
            motion:              'VEHICLE',
            speed:               48.5 + (Math.random() * 5 - 2.5), // slight variation
            speedAvailable:      true,
            bluetoothConnected:  false,
            connectedDeviceName: null,
            bleProximity:        false,
          },
        });
      });
    };
    inject(); // fire immediately on click
    motionIntervalRef.current = setInterval(inject, 3000); // then every 3s
    setMotionActive(true);
  }

  function stopMotionSimulation() {
    if (motionIntervalRef.current) {
      clearInterval(motionIntervalRef.current);
      motionIntervalRef.current = null;
    }
    import('../context/ContextManager.js').then(({ contextManager }) => {
      contextManager.updateContext({
        mode:       'UNCERTAIN',
        confidence: 0,
        timestamp:  Date.now(),
        signals: {
          motion:              'STILL',
          speed:               0,
          speedAvailable:      false,
          bluetoothConnected:  false,
          connectedDeviceName: null,
          bleProximity:        false,
        },
      });
    });
    setMotionActive(false);
  }

  // Auto-stop vehicle simulation when journey completes — just clear the
  // interval without injecting an UNCERTAIN reset, so the strip freezes on
  // its last CAR reading rather than flipping back and forth.
  React.useEffect(() => {
    if (['COMPLETED', 'TIMED_OUT', 'ERROR'].includes(journeyStatus)) {
      if (motionIntervalRef.current) {
        clearInterval(motionIntervalRef.current);
        motionIntervalRef.current = null;
        setMotionActive(false);
      }
    }
  }, [journeyStatus]);

  // Clean up interval on unmount
  React.useEffect(() => () => {
    if (motionIntervalRef.current) clearInterval(motionIntervalRef.current);
  }, []);

  const isIdle              = journeyStatus === 'IDLE';
  const isInTransit         = journeyStatus === 'IN_TRANSIT';
  const isDone              = ['COMPLETED','TIMED_OUT','ERROR'].includes(journeyStatus);
  const isPendingValidation = validationResult?.validationStatus === 'PENDING';

  return (
    <div style={{ marginBottom: '14px', border: '2px dashed #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#f8f9fa', border: 'none',
          padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
          fontWeight: 700, fontSize: '0.85em', color: '#6c757d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>🧪 Demo Controls — Simulate Hardware Events</span>
        <span style={{ fontSize: '0.75em', marginLeft: '8px', fontWeight: 400 }}>
          {open ? '▲ hide' : '▼ show'}
        </span>
      </button>

      {open && (
        <div style={{ padding: '12px', background: '#fff' }}>

          {/* ───── PUBLIC TRANSIT ───── */}
          {subTab === 'transit' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#495057', marginBottom: '8px' }}>
                �de8 Public Transit Simulation
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isIdle && (
                  <button className="btn btn-sm btn-primary"
                    onClick={() => startJourney(entryId, exitId)} disabled={isRunning}>
                    ▶ Start Transit Journey
                  </button>
                )}
                {isDone && (
                  <button className="btn btn-sm btn-secondary" onClick={resetJourney}>
                    🔄 Reset Journey
                  </button>
                )}
                {isPendingValidation && (
                  <button className="btn btn-sm"
                    style={{ background: '#6f42c1', color: '#fff', borderColor: '#6f42c1' }}
                    onClick={simulatePassScan}>
                    🔑 Simulate Barrier Scan (resolve validation)
                  </button>
                )}
                {isInTransit && (
                  <span style={{ fontSize: '0.8em', color: '#007bff', alignSelf: 'center' }}>
                    ⌛ Journey in progress — simulator is running automatically
                  </span>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75em', color: '#6c757d' }}>
                ℹ️ Entry detected by CAMARA geofence → simulator animates route → exit detected at destination
              </div>
            </div>
          )}

          {/* ───── CAR PARKING ───── */}
          {subTab === 'parking' && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#495057', marginBottom: '8px' }}>
                🄿 Car Parking Simulation
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {isIdle && (
                  <button className="btn btn-sm btn-primary"
                    style={{ background: '#6f42c1', borderColor: '#6f42c1' }}
                    onClick={startParking} disabled={isRunning}>
                    🚗 Simulate: Drive to Entry Gate
                  </button>
                )}
                {isDone && (
                  <button className="btn btn-sm btn-secondary" onClick={resetJourney}>
                    🔄 New Parking Session
                  </button>
                )}
                {isInTransit && (
                  <span style={{ fontSize: '0.8em', color: '#6f42c1', alignSelf: 'center' }}>
                    ⌛ Vehicle parked — dwell simulation running...
                  </span>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75em', color: '#6c757d' }}>
                ℹ️ Entry gate detected → simulated dwell (random 1–4 hrs) → exit gate detected → duration billing
              </div>
            </div>
          )}

          {/* ───── TRIP PLANNER ───── */}
          {subTab === 'trip' && tripControls && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#495057', marginBottom: '8px' }}>
                🗺 Trip Planner Simulation
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {tripControls.tripStatus === 'IDLE' && (
                  <button className="btn btn-sm btn-primary" onClick={tripControls.startTrip}>
                    ▶ Start Trip
                  </button>
                )}
                {tripControls.tripStatus === 'ACTIVE' && !tripControls.isLegRunning && (
                  <>
                    <button className="btn btn-sm btn-primary"
                      onClick={() => tripControls.startTransitLeg(
                        tripControls.transitStations[0]?.id,
                        tripControls.transitStations[tripControls.transitStations.length - 1]?.id
                      )}>
                      �de8 Add Transit Leg (Sants → Airport)
                    </button>
                    <button className="btn btn-sm"
                      style={{ background: '#6f42c1', color: '#fff', borderColor: '#6f42c1' }}
                      onClick={() => tripControls.startParkingLeg(tripControls.parkingStations[0]?.id)}>
                      🄿 Add Parking Stop
                    </button>
                    <button className="btn btn-sm btn-danger"
                      onClick={tripControls.endTrip}>
                      ✓ End Trip &amp; Pay
                    </button>
                  </>
                )}
                {['COMPLETED','TIMED_OUT'].includes(tripControls.tripStatus) && (
                  <button className="btn btn-sm btn-secondary" onClick={tripControls.resetTrip}>
                    🔄 New Trip
                  </button>
                )}
                {tripControls.isLegRunning && (
                  <span style={{ fontSize: '0.8em', color: '#007bff', alignSelf: 'center' }}>
                    ⌛ Leg in progress...
                  </span>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75em', color: '#6c757d' }}>
                ℹ️ Each leg runs full CAMARA API sequence. Billing fires once at trip end.
              </div>
            </div>
          )}

          {/* ───── DEVICE SENSOR SIMULATION ───── */}
          <div style={{ borderTop: '1px solid #dee2e6', marginTop: '10px', paddingTop: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.82em', color: '#495057', marginBottom: '8px' }}>
              📱 Device Sensor Simulation
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Simulate Barrier Detection — only meaningful when validation is pending */}
              <button
                className="btn btn-sm btn-warning"
                disabled={!isPendingValidation}
                title={isPendingValidation
                  ? 'Trigger barrier proximity + resolve NFC validation'
                  : validationResult?.validationStatus === 'SUCCESS'
                    ? 'Validation already completed by device'
                    : 'Only active when validation is PENDING — start an AMBIGUOUS journey first'}
                onClick={() => { if (onSimulateBarrier) onSimulateBarrier(); }}>
                📡 Simulate Barrier Detection
              </button>
              <button
                className={`btn btn-sm ${motionActive ? 'btn-success' : 'btn-warning'}`}
                onClick={startMotionSimulation}
                title="Streams vehicle context events every 3s — keeps Android Context strip RELIABLE">
                {motionActive ? '🚗 Vehicle Simulation Running...' : '🚗 Simulate Vehicle Movement'}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={stopMotionSimulation}
                disabled={!motionActive}>
                ⏹ Stop Motion Simulation
              </button>
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.75em', color: '#6c757d' }}>
              ℹ️ <strong>Simulate Barrier Detection</strong>: resolves pending NFC validation in the timeline (only active when validation is PENDING).<br/>
              ℹ️ <strong>Simulate Vehicle Movement</strong>: streams CAR/VEHICLE context events every 3s, keeping the Android Context strip RELIABLE. Demonstrates the supporting context layer without the Android app.
            </div>
          </div>

          {/* ───── DETECTION MODE INDICATOR ───── */}
          <div style={{
            marginTop: '10px', padding: '6px 10px',
            background: '#f0f4f8', borderRadius: '4px',
            fontSize: '0.75em', color: '#6c757d',
            display: 'flex', gap: '16px', flexWrap: 'wrap',
          }}>
            <span>📡 Detection: <strong>CAMARA Geofencing</strong> (auto-simulated)</span>
            <span>📁 Stations: <strong>Barcelona Sants, Gràcia, Airport</strong></span>
            <span>🧉 No BLE/RFID hardware required — all events simulated</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 3: Explainability Panel — collapsible drilldown
// ---------------------------------------------------------------------------
function ExplainabilityPanel({ payload }) {
  const [open, setOpen] = React.useState(false);
  if (!payload) return null;
  const ex   = payload.explainability;
  const corr = ex.correlation;

  function RangeRow({ label, range, actual }) {
    if (range.optimisticMinutes == null) return null;
    const verdict = range.inRange
      ? { icon: '✅', color: '#155724' }
      : { icon: '❌', color: '#721c24' };
    return (
      <tr style={{ borderBottom: '1px solid #dee2e6', fontSize: '0.82em' }}>
        <td style={{ padding: '4px 8px', fontWeight: 600 }}>{label}</td>
        <td style={{ padding: '4px 8px' }}>{range.optimisticMinutes}–{range.pessimisticMinutes} min</td>
        <td style={{ padding: '4px 8px' }}>{range.bestEstimateMinutes} min</td>
        <td style={{ padding: '4px 8px', color: verdict.color }}>
          {verdict.icon} {range.inRange ? 'In range' : 'Outside'}
          {range.deltaToBestEstimate != null && (
            <span style={{ marginLeft: '6px', color: '#6c757d' }}>
              ({range.deltaToBestEstimate > 0 ? '+' : ''}{range.deltaToBestEstimate} min)
            </span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div style={{ marginBottom: '12px', border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#f8f9fa', border: 'none',
          padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
          fontWeight: 600, fontSize: '0.85em', color: '#495057',
          display: 'flex', justifyContent: 'space-between',
        }}
      >
        <span>🔍 View Explainability — {payload.journeyId}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '12px', background: '#fff', fontSize: '0.82em' }}>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{
              background: ex.decision.finalDecision === 'AUTO_PROCESS' ? '#28a745' : '#fd7e14',
              color: '#fff', borderRadius: '4px', padding: '2px 8px', fontWeight: 600,
            }}>
              {ex.decision.finalDecision}
            </span>
            <span style={{ background: '#17a2b8', color: '#fff', borderRadius: '4px', padding: '2px 8px', fontWeight: 600 }}>
              Mode: {payload.modeDetected}
            </span>
            <span style={{ background: '#6c757d', color: '#fff', borderRadius: '4px', padding: '2px 8px' }}>
              Confidence: {ex.decision.confidence}
            </span>
            {corr.actualDurationMinutes != null && (
              <span style={{ background: '#495057', color: '#fff', borderRadius: '4px', padding: '2px 8px' }}>
                Actual: {corr.actualDurationMinutes} min
              </span>
            )}
            <span style={{
              background: payload.travelTimeProvider === 'GOOGLE' ? '#4285F4'
                        : payload.travelTimeProvider === 'MOCK'   ? '#6c757d'
                        : payload.travelTimeProvider === 'TFL'    ? '#003466'
                        : payload.travelTimeProvider === 'MAPBOX' ? '#000'
                        : '#6c757d',
              color: '#fff', borderRadius: '4px', padding: '2px 8px', fontSize: '0.88em',
            }}>
              📡 {payload.travelTimeProvider ?? 'N/A'}
            </span>
          </div>

          {/* Summary narrative */}
          <div style={{ marginBottom: '10px', color: '#495057', fontStyle: 'italic', fontSize: '0.9em' }}>
            {payload.summary}
          </div>

          {/* No correlation — parking */}
          {corr.actualDurationMinutes == null && (
            <div style={{
              background: '#f0f7ff', border: '1px solid #b8daff',
              borderRadius: '4px', padding: '6px 10px', marginBottom: '10px',
              fontSize: '0.82em', color: '#004085',
            }}>
              ℹ️ Travel time correlation is not applicable for parking.
              Fare is calculated by duration-based pricing rules.
            </div>
          )}

          {/* Range table — transit only */}
          {corr.actualDurationMinutes != null && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, color: '#495057', marginBottom: '4px' }}>Expected Ranges vs Actual</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', fontSize: '0.8em', color: '#6c757d' }}>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Mode</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Range</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Best Est.</th>
                    <th style={{ padding: '4px 8px', textAlign: 'left' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <RangeRow label="Rail"  range={corr.railRange} actual={corr.actualDurationMinutes} />
                  <RangeRow label="Road"  range={corr.roadRange} actual={corr.actualDurationMinutes} />
                  <RangeRow label="Bus"   range={corr.busRange}  actual={corr.actualDurationMinutes} />
                </tbody>
              </table>
            </div>
          )}

          {/* Reasoning list */}
          {ex.reasoning?.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: 700, color: '#495057', marginBottom: '4px' }}>Reasoning</div>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#495057' }}>
                {ex.reasoning.map((r, i) => <li key={i} style={{ marginBottom: '2px' }}>{r}</li>)}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {ex.warnings?.length > 0 && (
            <div style={{ background: '#fff3cd', borderRadius: '4px', padding: '6px 10px' }}>
              <div style={{ fontWeight: 700, color: '#856404', marginBottom: '2px' }}>⚠ Warnings</div>
              {ex.warnings.map((w, i) => (
                <div key={i} style={{ color: '#856404', fontSize: '0.82em' }}>{w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Billing Result Panel — shared by both modes
// ---------------------------------------------------------------------------
function BillingPanel({ billingResult, chargeResult }) {
  if (!billingResult) return null;
  const ok = billingResult.paymentStatus === 'succeeded';
  return (
    <div style={{
      background: ok ? '#d4edda' : '#f8d7da',
      border: `1px solid ${ok ? '#c3e6cb' : '#f5c6cb'}`,
      borderRadius: '6px',
      padding: '10px 14px',
      marginBottom: '12px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        <strong style={{ color: ok ? '#155724' : '#721c24' }}>
          {ok ? '✓ Carrier Billing Successful' : '✗ Carrier Billing Failed'}
        </strong>
        {ok && (
          <div style={{ fontSize: '0.82em', color: '#155724', marginTop: '2px' }}>
            Transaction ID: {billingResult.paymentId}
          </div>
        )}
      </div>
      {ok && chargeResult && (
        <div style={{ fontWeight: 700, fontSize: '1.2em', color: '#155724' }}>
          {chargeResult.currency} {chargeResult.fare.toFixed(2)} charged
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export function TransportDashboard({
  journey,
  chargeResult,
  billingResult,
  fraudChecks,
  isRunning,
  errorMessage,
  stations,
  reachabilityStatus,
  billingStatus,
  mode,
  setMode,
  startJourney,
  startParking,
  resetJourney,
  journeyStatus,
  detectionFallback,
  routeProgress,
  contextState,
  contextReliability,
  decisionResult,
  correlationResult,
  validationResult,
  simulatePassScan,
  explainPayload,
  // passed through for Trip Planner
  phoneNumber,
  logApiInteraction,
  addMessage,
}) {
  const [subTab, setSubTab] = useState('transit'); // 'transit' | 'parking' | 'trip'
  const transitStations = stations.filter(s => s.mode === 'transit');
  const [entryId, setEntryId] = useState(transitStations[0]?.id || '');
  const [exitId,  setExitId]  = useState(transitStations[transitStations.length - 1]?.id || '');

  // Simulated barrier proximity state — set to true when "Simulate Barrier Detection"
  // is clicked, reset when validation resolves or journey resets.
  const [simulatedNearBarrier, setSimulatedNearBarrier] = React.useState(false);

  // When validation resolves (SUCCESS or FAILED) clear the simulated barrier state
  React.useEffect(() => {
    if (validationResult?.validationStatus === 'SUCCESS' ||
        validationResult?.validationStatus === 'FAILED'  ||
        validationResult?.validationStatus === 'NOT_REQUIRED') {
      setSimulatedNearBarrier(false);
    }
  }, [validationResult?.validationStatus]);

  // Simulate barrier: mark device as near barrier AND resolve validation as NFC
  const handleSimulateBarrier = React.useCallback(() => {
    setSimulatedNearBarrier(true);
    // Short delay so the timeline renders step 3 → in-progress before resolving
    setTimeout(() => {
      simulatePassScan(); // resolves ValidationHandler with method='MOCK' (NFC stand-in)
    }, 600);
  }, [simulatePassScan]);

  // Trip Planner hook
  const trip = useTrip({ phoneNumber, logApiInteraction, addMessage });

  const statusColor = STATUS_COLOR[journeyStatus] || '#6c757d';
  const statusLabel = STATUS_LABEL[journeyStatus] || journeyStatus;
  const isIdle      = journeyStatus === JOURNEY_STATUS.IDLE;
  const isDone      = journeyStatus === JOURNEY_STATUS.COMPLETED ||
                      journeyStatus === JOURNEY_STATUS.TIMED_OUT ||
                      journeyStatus === JOURNEY_STATUS.ERROR;

  const mapEntryId = journey?.entryEvent?.station?.id || entryId;
  const mapExitId  = journey?.exitEvent?.station?.id  || exitId;

  const handleModeSwitch = (newMode) => {
    if (isRunning) return;
    setMode(newMode);
    resetJourney();
  };

  return (
    <div className="card" style={{ marginBottom: '16px', maxWidth: '880px' }}>
      <h2 className="card-header">Mobility &amp; Payments — CAMARA Network APIs</h2>
      <div className="p-3">

        {/* Android Context Strip */}
        {(() => {
          const RELIABILITY_STYLE = {
            RELIABLE:  { bg: '#d4edda', border: '#c3e6cb', color: '#155724', badge: '#28a745', icon: '✅' },
            UNCERTAIN: { bg: '#fff3cd', border: '#ffeeba', color: '#856404', badge: '#fd7e14', icon: '⚠️' },
            STALE:     { bg: '#f8d7da', border: '#f5c6cb', color: '#721c24', badge: '#dc3545', icon: '🔴' },
            NO_SIGNAL: { bg: '#f8f9fa', border: '#dee2e6', color: '#6c757d', badge: '#6c757d', icon: '⚪' },
          };
          const rel = contextReliability || 'NO_SIGNAL';
          const s   = RELIABILITY_STYLE[rel] || RELIABILITY_STYLE.NO_SIGNAL;
          const sig = contextState?.signals;
          return (
            <div style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: '6px', padding: '8px 12px', marginBottom: '14px',
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              fontSize: '0.82em',
            }}>
              <span style={{ fontWeight: 700, color: s.color }}>
                {s.icon} Android Context:
              </span>
              <span style={{
                background: s.badge, color: '#fff',
                borderRadius: '4px', padding: '1px 8px', fontWeight: 700,
              }}>
                {contextState ? `${contextState.mode} (${contextState.confidence}%)` : 'No Signal'}
              </span>
              {sig && (
                <>
                  <span style={{ color: s.color }}>
                    Motion: <strong>{sig.motion}</strong>
                  </span>
                  {sig.speedAvailable && (
                    <span style={{ color: s.color }}>
                      Speed: <strong>{sig.speed?.toFixed(1)} km/h</strong>
                    </span>
                  )}
                  {sig.bluetoothConnected && (
                    <span style={{ color: s.color }}>
                      🔵 BT: <strong>{sig.connectedDeviceName || 'Connected'}</strong>
                    </span>
                  )}
                </>
              )}
              <span style={{ color: s.color, marginLeft: 'auto' }}>
                {rel === 'RELIABLE'  && '✅ Reliable'}
                {rel === 'UNCERTAIN' && '⚠️ Uncertain'}
                {rel === 'STALE'    && '🔴 Stale'}
                {rel === 'NO_SIGNAL'&& '⚪ No Signal — network-only mode'}
              </span>
            </div>
          );
        })()}

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #dee2e6' }}>
          {[
            { key: 'transit', label: '🚌 Public Transit' },
            { key: 'parking', label: '🅿 Car Parking' },
            { key: 'trip',    label: '🗺 Trip Planner' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => {
                setSubTab(key);
                if (key !== 'trip') { setMode(key); resetJourney(); }
              }}
              style={{
                padding: '6px 20px', border: 'none',
                borderBottom: subTab === key ? '2px solid #007bff' : '2px solid transparent',
                background: 'none',
                fontWeight: subTab === key ? 700 : 400,
                color: subTab === key ? '#007bff' : '#6c757d',
                cursor: 'pointer', marginBottom: '-2px',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Trip Planner Tab */}
        {subTab === 'trip' && (
          <>
            <DemoControlsPanel
              subTab={subTab} mode={mode} journeyStatus={journeyStatus}
              isRunning={isRunning}
              startJourney={startJourney} startParking={startParking}
              resetJourney={resetJourney}
              simulatePassScan={simulatePassScan} validationResult={validationResult}
              transitStations={transitStations} entryId={entryId} exitId={exitId}
              tripControls={trip}
              phoneNumber={phoneNumber}
              onSimulateBarrier={handleSimulateBarrier}
            />
            <TripDashboard {...trip} getExplainPayload={trip.getExplainPayload} />
          </>
        )}

        {/* Transit / Parking content */}
        {subTab !== 'trip' && (<>

        {/* Demo Controls — always visible at top of transit/parking tab */}
        <DemoControlsPanel
          subTab={subTab} mode={mode} journeyStatus={journeyStatus}
          isRunning={isRunning}
          startJourney={startJourney} startParking={startParking}
          resetJourney={resetJourney}
          simulatePassScan={simulatePassScan} validationResult={validationResult}
          transitStations={transitStations} entryId={entryId} exitId={exitId}
          tripControls={null}
          phoneNumber={phoneNumber}
          onSimulateBarrier={handleSimulateBarrier}
        />

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor }} />
          <strong>Status:</strong>
          <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
          {/* Hybrid Detection — confidence badge (shown once a journey event has fired) */}
          {journey?.entryEvent?.metadata?.confidence && (() => {
            const c = journey.entryEvent.metadata.confidence;
            const pct = Math.round(c.confidenceScore * 100);
            const isNetworkOnly = c.source === 'NETWORK_ONLY';
            const badgeColor = isNetworkOnly ? '#6c757d' : (pct >= 80 ? '#28a745' : pct >= 60 ? '#fd7e14' : '#6c757d');
            const modeLabel   = isNetworkOnly
              ? `Network-Only Signal (${pct}%)`
              : `Detected Mode: ${c.mode} (${pct}%)`;
            return (
              <>
                <span style={{
                  marginLeft: '8px',
                  background: badgeColor,
                  color: '#fff',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.78em',
                  fontWeight: 600,
                }}>
                  {modeLabel}
                </span>
                {c.warning && (
                  <span style={{
                    marginLeft: '6px',
                    background: '#fff3cd',
                    color: '#856404',
                    border: '1px solid #ffeeba',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.75em',
                    fontWeight: 500,
                  }}>
                    ⚠ {c.warning}
                  </span>
                )}
              </>
            );
          })()}

          {/* Phase 2: Decision badge */}
          {decisionResult && (() => {
            const isAuto       = decisionResult.finalDecision === 'AUTO_PROCESS';
            const isPending    = validationResult?.validationStatus === 'PENDING';
            const isValidated  = validationResult?.validationStatus === 'SUCCESS';
            if (isAuto && !isPending && !isValidated) {
              return (
                <span style={{
                  marginLeft: '6px', background: '#28a745', color: '#fff',
                  borderRadius: '4px', padding: '2px 8px', fontSize: '0.78em', fontWeight: 600,
                }}>
                  ✓ Auto Processed
                </span>
              );
            }
            if (isPending) {
              return (
                <>
                  <span style={{
                    marginLeft: '6px', background: '#fd7e14', color: '#fff',
                    borderRadius: '4px', padding: '2px 8px', fontSize: '0.78em', fontWeight: 600,
                  }}>
                    ⚠ Validation Required
                  </span>
                  <button
                    className="btn btn-sm"
                    style={{
                      marginLeft: '6px', background: '#6f42c1', color: '#fff',
                      borderColor: '#6f42c1', fontSize: '0.75em', padding: '1px 8px',
                    }}
                    onClick={simulatePassScan}
                  >
                    Simulate Pass Scan
                  </button>
                </>
              );
            }
            if (isValidated) {
              return (
                <span style={{
                  marginLeft: '6px', background: '#17a2b8', color: '#fff',
                  borderRadius: '4px', padding: '2px 8px', fontSize: '0.78em', fontWeight: 600,
                }}>
                  ✓ Validated ({validationResult.validationMethod || validationResult.method})
                </span>
              );
            }
            return null;
          })()}
        </div>

        {/* Transit: station dropdowns */}
        {mode === 'transit' && isIdle && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>Entry Station</label>
              <select className="form-control" value={entryId} onChange={e => setEntryId(e.target.value)}>
                {stations.filter(s => s.mode === 'transit').map(s => <option key={s.id} value={s.id}>{s.name} ({s.zoneId})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label>Exit Station</label>
              <select className="form-control" value={exitId} onChange={e => setExitId(e.target.value)}>
                {stations.filter(s => s.mode === 'transit').map(s => <option key={s.id} value={s.id}>{s.name} ({s.zoneId})</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Parking: info panel */}
        {mode === 'parking' && isIdle && (
          <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px',
            padding: '10px 14px', marginBottom: '14px', fontSize: '0.88em', color: '#495057' }}>
            <strong>Barcelona City Centre Car Park</strong>
            <div style={{ marginTop: '4px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span>📍 Entry Gate → Exit Gate</span>
              <span>💶 €2.50 / hour</span>
              <span>📡 CAMARA Location Verification</span>
              <span>💳 Carrier Billing on exit</span>
              <span>🎲 Duration randomised 1–4 hrs</span>
            </div>
          </div>
        )}

        {/* SVG Map — show during journey and after completion */}
        {!isIdle && mode === 'transit' && (
          <RouteMap stations={stations.filter(s => s.mode === 'transit')} entryId={mapEntryId} exitId={mapExitId}
            routeProgress={routeProgress || 0} journeyStatus={journeyStatus} />
        )}
        {!isIdle && mode === 'parking' && (
          <ParkingMap routeProgress={routeProgress || 0} journeyStatus={journeyStatus} />
        )}

        {/* Journey / Parking info */}
        {journey?.entryEvent && (
          <ul className="details-list" style={{ marginBottom: '10px' }}>
            <li>
              <strong>{mode === 'parking' ? 'Entry:' : 'Entry:'}</strong>
              <span>{journey.entryEvent.station.name}</span>
              <small style={{ color: '#6c757d', marginLeft: '8px' }}>[{journey.entryEvent.detectionMethod}]</small>
            </li>
            {journey.exitEvent && (
              <li>
                <strong>Exit:</strong>
                <span>{journey.exitEvent.station.name}</span>
                <small style={{ color: '#6c757d', marginLeft: '8px' }}>[{journey.exitEvent.detectionMethod}]</small>
              </li>
            )}
          </ul>
        )}

        {/* Charge Summary */}
        {chargeResult && (
          <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px',
            padding: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{chargeResult.fromStation}</strong>
                <span style={{ margin: '0 8px', color: '#6c757d' }}>→</span>
                <strong>{chargeResult.toStation}</strong>
                {chargeResult.durationMinutes !== null && chargeResult.durationMinutes !== undefined && (
                  <span style={{ marginLeft: '10px', color: '#6c757d', fontSize: '0.85em' }}>
                    ⏱ {chargeResult.durationMinutes} min
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.4em', fontWeight: 700, color: '#28a745' }}>
                {chargeResult.currency} {chargeResult.fare.toFixed(2)}
              </div>
            </div>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {RULE_BADGE[chargeResult.ruleApplied] && (
                <span style={{ background: RULE_BADGE[chargeResult.ruleApplied].color, color: '#fff',
                  borderRadius: '4px', padding: '2px 8px', fontSize: '0.78em', fontWeight: 600 }}>
                  {RULE_BADGE[chargeResult.ruleApplied].label}
                </span>
              )}
              <small style={{ color: '#6c757d' }}>Detected via {chargeResult.detectionMethod}</small>
              {detectionFallback && (
                <small style={{ color: '#fd7e14' }}>⚠ Geofence unavailable — fell back to Location Verify</small>
              )}
            </div>
            {/* Calculation breakdown — parking only */}
            {chargeResult.calculation && (
              <div style={{
                marginTop: '10px',
                padding: '8px 10px',
                background: '#f0ebfa',
                borderRadius: '4px',
                fontSize: '0.82em',
                color: '#4a2c7a',
                borderLeft: '3px solid #6f42c1',
              }}>
                <strong>Fare Calculation:</strong>
                <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>Duration: <strong>{chargeResult.calculation.durationMinutes} min</strong> ({chargeResult.calculation.hours.toFixed(2)} hrs)</span>
                  <span>Rate: <strong>€{chargeResult.calculation.ratePerHour.toFixed(2)} / hr</strong></span>
                  <span>Calculation: <strong>{chargeResult.calculation.formula}</strong></span>
                  {chargeResult.calculation.minimumApplied && (
                    <span style={{ color: '#856404' }}>⚠ Minimum fare of €{chargeResult.calculation.minimumFare.toFixed(2)} applied</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reachability + Billing Status */}
        {chargeResult && billingStatus && billingStatus !== BILLING_STATUS.PENDING && (
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '6px',
            padding: '10px 12px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}>
            <strong style={{ fontSize: '0.9em' }}>Device Reachability:</strong>
            {BILLING_BADGE[billingStatus] && (
              <span style={{
                background: BILLING_BADGE[billingStatus].color,
                color: '#fff',
                borderRadius: '4px',
                padding: '2px 10px',
                fontSize: '0.82em',
                fontWeight: 600,
              }}>
                {BILLING_BADGE[billingStatus].label}
              </span>
            )}
            <span style={{ fontSize: '0.82em', color: '#6c757d' }}>
              {billingStatus === BILLING_STATUS.CHECKING  && 'Checking device reachability before billing...'}
              {billingStatus === BILLING_STATUS.RETRYING  && 'Device unreachable — retrying...'}
              {billingStatus === BILLING_STATUS.REACHABLE && (chargeResult?.billed ? 'Billing successful' : 'Device reachable — billing in progress')}
              {billingStatus === BILLING_STATUS.DEFERRED  && 'Billing deferred — device not reachable after retries'}
            </span>
          </div>
        )}

        {/* Fraud Detection Results */}
        <FraudPanel fraudChecks={fraudChecks} />

        {/* Carrier Billing Result */}
        <BillingPanel billingResult={billingResult} chargeResult={chargeResult} />

        {/* Phase 1: ValidationTimeline - shows from journey start, updates live */}
        {/* Show as soon as journey has started (not idle) — steps light up progressively */}
        {journeyStatus !== JOURNEY_STATUS.IDLE && (
          <ValidationTimeline
            advisoryData={decisionResult ? {
              journeyId: journey?.journeyId,
              deviceId: phoneNumber,
              stage:                decisionResult.stage ?? 'EXIT',
              validationRequired:   decisionResult.requiresValidation,
              validationSignal:     decisionResult.validationSignal ?? (correlationResult?.ambiguity ? 'AMBIGUOUS' : 'CLEAR'),
              correlationConfidence: correlationResult?.correlationConfidence ?? 'HIGH',
              ambiguity:            correlationResult?.ambiguity ?? false,
              reason: correlationResult?.ambiguity ? 'AMBIGUOUS_CORRELATION' : 'HIGH_CONFIDENCE',
              timestamp: Date.now()
            } : null}
            deviceStatus={{
              deviceId: phoneNumber,
              mode: decisionResult?.requiresValidation ? 'TRANSPORT' : 'HOTEL',
              isConnected: true,
              nearBarrier: validationResult?.validationStatus === 'PENDING' || simulatedNearBarrier,
              bleSignal: -65
            }}
            validationResult={validationResult ? {
              ...validationResult,
              validationMethod: validationResult.validationMethod || validationResult.method,
              tagId: validationResult.tagId || null
            } : null}
            journeyStatus={journeyStatus}
          />
        )}

        {/* Phase 3: Explainability drilldown — shows as soon as correlation data available */}
        {/* Uses explainPayload when fully built (post-journey), or builds a live preview */}
        {/* from correlationResult + decisionResult during the journey */}
        <ExplainabilityPanel payload={
          explainPayload ??
          // Live preview: build a minimal payload from whatever is available mid-journey
          (correlationResult ? {
            journeyId:     journey?.journeyId ?? 'in-progress',
            modeDetected:  decisionResult?.finalMode ?? correlationResult.inferredMode ?? 'UNKNOWN',
            finalDecision: decisionResult?.finalDecision ?? 'UNKNOWN',
            travelTimeProvider: correlationResult.candidates?.rail?.source ??
                                correlationResult.candidates?.road?.source ?? 'UNKNOWN',
            summary: decisionResult
              ? `Journey classified as ${decisionResult.finalMode}. ${decisionResult.finalDecision === 'REQUIRE_VALIDATION' ? 'Step-up validation required.' : 'Auto-processed.'}`
              : `Correlation complete — inferredMode=${correlationResult.inferredMode}, confidence=${correlationResult.correlationConfidence}.`,
            generatedAt: new Date().toISOString(),
            explainability: {
              signals:     { network: {}, context: {}, trajectory: {} },
              correlation: {
                actualDurationMinutes: correlationResult.actualDurationMinutes,
                railRange: correlationResult.candidates?.rail ?? {},
                roadRange: correlationResult.candidates?.road ?? {},
                busRange:  correlationResult.candidates?.bus  ?? {},
                ambiguity:             correlationResult.ambiguity,
                overlapMinutes:        correlationResult.overlapMinutes,
                overlapPercentage:     correlationResult.overlapPercentage,
                inferredMode:          correlationResult.inferredMode,
                correlationConfidence: correlationResult.correlationConfidence,
              },
              decision: {
                finalDecision:      decisionResult?.finalDecision      ?? 'UNKNOWN',
                finalMode:          decisionResult?.finalMode          ?? 'UNKNOWN',
                confidence:         decisionResult?.decisionConfidence ?? 'UNKNOWN',
                requiresValidation: decisionResult?.requiresValidation ?? false,
                validationReason:   decisionResult?.validationReason   ?? null,
                decisionTags:       decisionResult?.decisionTags       ?? [],
                validationSignal:   decisionResult?.validationSignal   ?? 'CLEAR',
                barrierDecision:    decisionResult?.validationSignal === 'AMBIGUOUS' ? 'CLOSED' : 'OPEN',
                validationTriggered: decisionResult?.requiresValidation ?? false,
                stage:              decisionResult?.stage               ?? 'EXIT',
              },
              validation: {
                validationRequired:  validationResult?.validationRequired  ?? false,
                validationStatus:    validationResult?.validationStatus    ?? 'NOT_REQUIRED',
                validationMethod:    validationResult?.validationMethod    ?? 'UNKNOWN',
                validationTimestamp: validationResult?.validationTimestamp ?? null,
                accessState:         validationResult?.accessState         ?? 'ALLOWED',
              },
              reasoning: [
                ...(correlationResult.reasoning ?? []).map(r => `Correlation: ${r}`),
                ...(decisionResult?.decisionReasoning ?? []).map(r => `Decision: ${r}`),
              ],
              warnings: correlationResult.warnings ?? [],
            },
          } : null)
        } />

        {/* Error */}
        {errorMessage && (
          <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{errorMessage}</div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {isIdle && mode === 'transit' && (
            <button className="btn btn-primary" onClick={() => startJourney(entryId, exitId)} disabled={isRunning}>
              Start Journey
            </button>
          )}
          {isIdle && mode === 'parking' && (
            <button className="btn btn-primary" style={{ background: '#6f42c1', borderColor: '#6f42c1' }}
              onClick={() => startParking()} disabled={isRunning}>
              🅿 Enter Car Park
            </button>
          )}
          {isDone && (
            <button className="btn btn-secondary" onClick={resetJourney}>
              {mode === 'parking' ? 'New Parking Session' : 'New Journey'}
            </button>
          )}
          {journeyStatus === JOURNEY_STATUS.IN_TRANSIT && (
            <span style={{ color: mode === 'parking' ? '#6f42c1' : '#007bff', fontStyle: 'italic', alignSelf: 'center' }}>
              {mode === 'parking' ? '🅿 Vehicle parked — waiting to exit...' : 'Journey in progress...'}
            </span>
          )}
        </div>

        </>)}
      </div>
    </div>
  );
}
