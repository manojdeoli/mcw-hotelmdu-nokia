// =============================================================================
// TripDashboard — UI Component
// src/transport/components/TripDashboard.js
// =============================================================================

import React, { useState } from 'react';
import { TRIP_STATUS, LEG_TYPE } from '../core/TripManager.js';

// ---------------------------------------------------------------------------
// Leg Explainability Panel — mirrors TransportDashboard's ExplainabilityPanel
// ---------------------------------------------------------------------------
function LegExplainabilityPanel({ payload }) {
  const [open, setOpen] = useState(false);
  if (!payload) return null;
  const ex   = payload.explainability;
  const corr = ex.correlation;
  const isParkingOrNoCorr = corr.actualDurationMinutes == null;

  const providerColor = {
    GOOGLE: '#4285F4', MOCK: '#6c757d', TFL: '#003466', MAPBOX: '#000',
  };

  return (
    <div style={{ marginTop: '6px', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', background: '#f8f9fa', border: 'none',
        padding: '5px 10px', textAlign: 'left', cursor: 'pointer',
        fontWeight: 600, fontSize: '0.78em', color: '#495057',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>🔍 Explainability</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '10px', background: '#fff', fontSize: '0.78em' }}>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
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
              background: providerColor[payload.travelTimeProvider] ?? '#6c757d',
              color: '#fff', borderRadius: '4px', padding: '2px 8px',
            }}>
              📡 {payload.travelTimeProvider ?? 'N/A'}
            </span>
          </div>

          {/* Summary narrative */}
          <div style={{ marginBottom: '8px', color: '#495057', fontStyle: 'italic' }}>
            {payload.summary}
          </div>

          {/* Range table — transit only */}
          {!isParkingOrNoCorr && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', color: '#6c757d' }}>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Mode</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Range</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Best Est.</th>
                  <th style={{ padding: '3px 6px', textAlign: 'left' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {[['Rail', corr.railRange], ['Road', corr.roadRange], ['Bus', corr.busRange]].map(([label, range]) => {
                  if (!range || range.optimisticMinutes == null) return null;
                  const ok = range.inRange;
                  return (
                    <tr key={label} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '3px 6px', fontWeight: 600 }}>{label}</td>
                      <td style={{ padding: '3px 6px' }}>{range.optimisticMinutes}–{range.pessimisticMinutes} min</td>
                      <td style={{ padding: '3px 6px' }}>{range.bestEstimateMinutes} min</td>
                      <td style={{ padding: '3px 6px', color: ok ? '#155724' : '#721c24' }}>
                        {ok ? '✅ In range' : '❌ Outside'}
                        {range.deltaToBestEstimate != null && (
                          <span style={{ color: '#6c757d', marginLeft: '4px' }}>
                            ({range.deltaToBestEstimate > 0 ? '+' : ''}{range.deltaToBestEstimate} min)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {isParkingOrNoCorr && (
            <div style={{ color: '#6c757d', fontStyle: 'italic', marginBottom: '6px' }}>
              Duration-based pricing — no travel time correlation applicable
            </div>
          )}

          {/* Warnings */}
          {ex.warnings?.length > 0 && (
            <div style={{ background: '#fff3cd', borderRadius: '4px', padding: '5px 8px' }}>
              {ex.warnings.map((w, i) => (
                <div key={i} style={{ color: '#856404' }}>⚠ {w}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TRIP_COLOR = {
  [TRIP_STATUS.IDLE]:      '#6c757d',
  [TRIP_STATUS.ACTIVE]:    '#007bff',
  [TRIP_STATUS.BILLING]:   '#fd7e14',
  [TRIP_STATUS.COMPLETED]: '#28a745',
  [TRIP_STATUS.TIMED_OUT]: '#dc3545',
};

const TRIP_LABEL = {
  [TRIP_STATUS.IDLE]:      'Not Started',
  [TRIP_STATUS.ACTIVE]:    'Active',
  [TRIP_STATUS.BILLING]:   'Processing Payment...',
  [TRIP_STATUS.COMPLETED]: 'Completed',
  [TRIP_STATUS.TIMED_OUT]: 'Timed Out',
};

// ---------------------------------------------------------------------------
// Mini SVG progress bar — used for active leg
// ---------------------------------------------------------------------------
function LegProgressBar({ progress, type }) {
  const color  = type === LEG_TYPE.PARKING ? '#6f42c1' : '#007bff';
  const width  = 400;
  const filled = Math.round(progress * width);
  return (
    <svg width="100%" viewBox={`0 0 ${width} 12`}
      style={{ display: 'block', borderRadius: '6px', marginTop: '6px' }}>
      <rect x={0} y={0} width={width} height={12} rx={6} fill="#e9ecef" />
      <rect x={0} y={0} width={filled} height={12} rx={6} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Device Integrity Panel — shown per leg in the trip timeline
// ---------------------------------------------------------------------------
const INTEGRITY_ICON = {
  PASS:         { icon: '✅', color: '#155724', bg: '#d4edda', border: '#c3e6cb', label: 'PASS'         },
  WARN:         { icon: '⚠️', color: '#856404', bg: '#fff3cd', border: '#ffeeba', label: 'WARN'         },
  FRAUD:        { icon: '🚫', color: '#721c24', bg: '#f8d7da', border: '#f5c6cb', label: 'FRAUD'        },
  CHECK_FAILED: { icon: 'ℹ️', color: '#0c5460', bg: '#d1ecf1', border: '#bee5eb', label: 'CHECK FAILED' },
};

function IntegrityPanel({ integrityChecks }) {
  if (!integrityChecks || integrityChecks.length === 0) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '0.8em', fontWeight: 700, color: '#495057', marginBottom: '6px' }}>
        🔒 Device Integrity Checks (SIM Swap + Device Swap + Reachability)
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {integrityChecks.map((ic, i) => {
          const s = INTEGRITY_ICON[ic.overallStatus] || INTEGRITY_ICON.CHECK_FAILED;
          return (
            <div key={i} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: '6px', padding: '8px 12px',
              fontSize: '0.78em', minWidth: '200px',
            }}>
              <div style={{ fontWeight: 700, color: s.color, marginBottom: '5px' }}>
                {s.icon} {ic.checkPoint} — {s.label}
              </div>
              <div style={{ color: s.color, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>📱 SIM Swap:
                  <strong> {ic.simSwapped ? '⚠ DETECTED' : ic.simError ? 'Error' : '✓ Clear'}</strong>
                </span>
                <span>💻 Device Swap:
                  <strong> {ic.devSwapped ? '⚠ DETECTED' : ic.devError ? 'Error' : '✓ Clear'}</strong>
                </span>
                {'reachable' in ic && (
                  <span>📡 Reachable:
                    <strong> {ic.reachable === true ? '✓ Yes' : ic.reachable === false ? '⚠ No' : 'Unknown'}</strong>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip Timeline — completed legs
// ---------------------------------------------------------------------------
function TripTimeline({ legs, activeLegIndex, getExplainPayload }) {
  if (!legs || legs.length === 0) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '0.8em', fontWeight: 700, color: '#495057', marginBottom: '6px' }}>
        Trip Timeline
      </div>
      <table style={{ width: '100%', fontSize: '0.82em', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', color: '#6c757d' }}>
            <th style={th}>#</th>
            <th style={th}>Type</th>
            <th style={th}>Route / Location</th>
            <th style={th}>Duration</th>
            <th style={{ ...th, textAlign: 'right' }}>Fare</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => (
            <React.Fragment key={i}>
              <tr style={{ borderBottom: leg.explainJourneyId ? 'none' : '1px solid #dee2e6' }}>
                <td style={td}>{leg.legIndex}</td>
                <td style={td}>
                  <span style={{
                    background: leg.type === LEG_TYPE.TRANSIT ? '#007bff' : (leg.isFree ? '#17a2b8' : '#6f42c1'),
                    color: '#fff', borderRadius: '3px', padding: '1px 6px', fontSize: '0.78em',
                  }}>
                    {leg.type === LEG_TYPE.TRANSIT ? '🚌' : '🈿'} {leg.type}
                  </span>
                </td>
                <td style={td}>{leg.fromStation} → {leg.toStation}</td>
                <td style={td}>{leg.durationMinutes ? `${leg.durationMinutes} min` : '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700,
                  color: leg.isFree ? '#17a2b8' : '#28a745' }}>
                  {leg.isFree ? 'FREE' : `€${leg.fare.toFixed(2)}`}
                </td>
              </tr>
              {leg.explainJourneyId && getExplainPayload && (
                <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td colSpan={5} style={{ padding: '0 8px 6px 8px' }}>
                    <LegExplainabilityPanel payload={getExplainPayload(leg.explainJourneyId)} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { padding: '4px 8px', textAlign: 'left', fontWeight: 600 };
const td = { padding: '5px 8px' };

// ---------------------------------------------------------------------------
// Consolidated Bill
// ---------------------------------------------------------------------------
function ConsolidatedBill({ tripSnapshot }) {
  if (!tripSnapshot?.billingResult) return null;
  const { billingResult, accumulatedFare, currency, tripId, legs } = tripSnapshot;
  const ok = billingResult.paymentStatus === 'succeeded';
  const skipped = billingResult.paymentStatus === 'skipped';

  return (
    <div style={{
      background: ok ? '#d4edda' : skipped ? '#d1ecf1' : '#f8d7da',
      border: `1px solid ${ok ? '#c3e6cb' : skipped ? '#bee5eb' : '#f5c6cb'}`,
      borderRadius: '6px', padding: '12px 14px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ color: ok ? '#155724' : skipped ? '#0c5460' : '#721c24', fontSize: '1em' }}>
            {ok ? '✓ Trip Complete — Carrier Billing Successful'
              : skipped ? 'ℹ Trip Complete — No Charge (€0.00)'
              : '✗ Billing Failed'}
          </strong>
          <div style={{ fontSize: '0.8em', color: '#6c757d', marginTop: '2px' }}>
            Trip ID: {tripId}
            {ok && ` | Transaction: ${billingResult.paymentId}`}
          </div>
        </div>
        <div style={{ fontSize: '1.5em', fontWeight: 700, color: ok ? '#155724' : '#6c757d' }}>
          {currency} {accumulatedFare.toFixed(2)}
        </div>
      </div>
      {/* Breakdown */}
      <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#495057' }}>
        {legs.map((leg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
            padding: '2px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span>
              {leg.type === LEG_TYPE.TRANSIT ? '🚌' : '🅿'} {leg.fromStation} → {leg.toStation}
              {leg.durationMinutes ? ` (${leg.durationMinutes} min)` : ''}
            </span>
            <span style={{ fontWeight: 600, color: leg.isFree ? '#17a2b8' : '#28a745' }}>
              {leg.isFree ? 'FREE' : `€${leg.fare.toFixed(2)}`}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between',
          marginTop: '4px', fontWeight: 700, fontSize: '1.05em' }}>
          <span>Total</span>
          <span style={{ color: '#28a745' }}>{currency} {accumulatedFare.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inactivity Countdown Warning
// ---------------------------------------------------------------------------
function InactivityWarning({ countdown, onEndNow }) {
  if (countdown === null || countdown <= 0) return null;
  const secs = Math.ceil(countdown / 1000);
  const isUrgent = secs <= 10;
  return (
    <div style={{
      background: isUrgent ? '#f8d7da' : '#fff3cd',
      border: `1px solid ${isUrgent ? '#f5c6cb' : '#ffeeba'}`,
      borderRadius: '6px', padding: '8px 12px', marginBottom: '12px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: '0.85em',
    }}>
      <span style={{ color: isUrgent ? '#721c24' : '#856404' }}>
        ⏱ Trip auto-closes in <strong>{secs}s</strong> — start a new leg or end the trip
      </span>
      <button className="btn btn-sm btn-warning" onClick={onEndNow}
        style={{ marginLeft: '12px', fontSize: '0.8em' }}>
        End Trip Now
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main TripDashboard
// ---------------------------------------------------------------------------
export function TripDashboard({
  tripSnapshot,
  legProgress,
  isLegRunning,
  countdown,
  transitStations,
  parkingStations,
  tripStatus,
  startTrip,
  startTransitLeg,
  startParkingLeg,
  endTrip,
  resetTrip,
  getExplainPayload,
}) {
  const [transitEntry, setTransitEntry] = useState(transitStations[0]?.id || '');
  const [transitExit,  setTransitExit]  = useState(transitStations[transitStations.length - 1]?.id || '');

  const isIdle      = tripStatus === TRIP_STATUS.IDLE;
  const isActive    = tripStatus === TRIP_STATUS.ACTIVE;
  const isDone      = tripStatus === TRIP_STATUS.COMPLETED || tripStatus === TRIP_STATUS.TIMED_OUT;
  const isBilling   = tripStatus === TRIP_STATUS.BILLING;
  const statusColor = TRIP_COLOR[tripStatus] || '#6c757d';
  const legs        = tripSnapshot?.legs || [];
  const accumulated = tripSnapshot?.accumulatedFare ?? 0;

  return (
    <div style={{ padding: '4px 0' }}>

      {/* Trip Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%',
            background: statusColor, display: 'inline-block' }} />
          <strong>Trip Status:</strong>
          <span style={{ color: statusColor, fontWeight: 600 }}>{TRIP_LABEL[tripStatus]}</span>
          {isActive && (
            <span style={{ color: '#6c757d', fontSize: '0.85em' }}>
              | {legs.length} leg{legs.length !== 1 ? 's' : ''} completed
              | Accumulated: <strong style={{ color: '#28a745' }}>€{accumulated.toFixed(2)}</strong>
            </span>
          )}
        </div>
        {isActive && !isLegRunning && (
          <button className="btn btn-sm btn-danger" onClick={endTrip}>
            End Trip &amp; Pay €{accumulated.toFixed(2)}
          </button>
        )}
      </div>

      {/* Inactivity Warning */}
      {isActive && !isLegRunning && (
        <InactivityWarning countdown={countdown} onEndNow={endTrip} />
      )}

      {/* Active Leg Progress */}
      {isLegRunning && tripSnapshot?.activeLegIndex && (
        <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6',
          borderRadius: '6px', padding: '10px 12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '0.82em', fontWeight: 700, color: '#495057', marginBottom: '4px' }}>
            Leg {tripSnapshot.activeLegIndex} — In Progress
          </div>
          <LegProgressBar progress={legProgress}
            type={legs.length < (tripSnapshot.activeLegIndex - 1) ? LEG_TYPE.TRANSIT : LEG_TYPE.TRANSIT} />
          <div style={{ fontSize: '0.78em', color: '#6c757d', marginTop: '4px' }}>
            Running fraud checks + location verification...
          </div>
        </div>
      )}

      {/* Trip Timeline */}
      <TripTimeline legs={legs} activeLegIndex={tripSnapshot?.activeLegIndex} getExplainPayload={getExplainPayload} />

      {/* Consolidated Bill */}
      <ConsolidatedBill tripSnapshot={tripSnapshot} />

      {/* Device Integrity Checks */}
      <IntegrityPanel integrityChecks={tripSnapshot?.integrityChecks} />

      {/* Leg Controls — only shown when trip is active and no leg running */}
      {isActive && !isLegRunning && !isBilling && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>

          {/* Transit Leg */}
          <div style={{ flex: 1, minWidth: '220px', background: '#f0f7ff',
            border: '1px solid #b8daff', borderRadius: '6px', padding: '10px 12px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85em', marginBottom: '8px', color: '#004085' }}>
              🚌 Add Transit Leg
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <select className="form-control form-control-sm" value={transitEntry}
                onChange={e => setTransitEntry(e.target.value)}>
                {transitStations.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select className="form-control form-control-sm" value={transitExit}
                onChange={e => setTransitExit(e.target.value)}>
                {transitStations.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-sm btn-primary" style={{ width: '100%' }}
              onClick={() => startTransitLeg(transitEntry, transitExit)}>
              Start Transit
            </button>
          </div>
        </div>
      )}

      {/* Start / Reset Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {isIdle && (
          <button className="btn btn-primary" onClick={startTrip}>
            🗺 Start Trip
          </button>
        )}
        {isBilling && (
          <span style={{ color: '#fd7e14', fontStyle: 'italic', alignSelf: 'center' }}>
            Processing payment...
          </span>
        )}
        {isDone && (
          <button className="btn btn-secondary" onClick={resetTrip}>
            New Trip
          </button>
        )}
      </div>

    </div>
  );
}
