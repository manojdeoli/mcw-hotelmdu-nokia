// =============================================================================
// useTrip — React Hook
// src/transport/hooks/useTrip.js
//
// Wires TripManager to React state.
// This is the ONLY file in the trip module that imports React.
// All core logic lives in TripManager — this hook is just the React adapter.
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { TripManager, TRIP_STATUS, LEG_TYPE }       from '../core/TripManager.js';
import { explainabilityService }                    from '../core/ExplainabilityService.js';
import stationsConfig                               from '../config/stations.json';

const tripStations = stationsConfig.stations.filter(s => s.mode === 'trip');
const transitStations = tripStations.filter(s => s.zoneId !== 'PKG_ZONE' && s.zoneId !== 'FREE_ZONE');
const parkingStations = tripStations.filter(s => s.zoneId === 'PKG_ZONE' || s.zoneId === 'FREE_ZONE');

export function useTrip({ phoneNumber, logApiInteraction, addMessage }) {

  const [tripSnapshot,   setTripSnapshot]   = useState(null);
  const [legProgress,    setLegProgress]    = useState(0);
  const [isLegRunning,   setIsLegRunning]   = useState(false);
  const [countdown,      setCountdown]      = useState(null); // ms remaining

  const managerRef = useRef(null);

  // Countdown ticker — updates every second while timer is running
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = managerRef.current?.getTimerRemainingMs() ?? null;
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Start trip
  // ---------------------------------------------------------------------------
  const startTrip = useCallback(() => {
    if (!phoneNumber) { addMessage('Trip: Phone number required'); return; }

    managerRef.current = new TripManager({
      phoneNumber,
      onStateChange:     (snap) => {
        setTripSnapshot({ ...snap });
        setIsLegRunning(snap.activeLegIndex !== null);
      },
      onLegProgress:     (p) => setLegProgress(p),
      onLog:             (msg) => addMessage(msg),
      logApiInteraction,
      demoMode:          true,
    });

    managerRef.current.startTrip();
    setLegProgress(0);
    setTripSnapshot(managerRef.current.getSnapshot());
  }, [phoneNumber, logApiInteraction, addMessage]);

  // ---------------------------------------------------------------------------
  // Start a transit leg
  // ---------------------------------------------------------------------------
  const startTransitLeg = useCallback(async (entryStationId, exitStationId) => {
    if (!managerRef.current) return;
    const entry = tripStations.find(s => s.id === entryStationId);
    const exit  = tripStations.find(s => s.id === exitStationId);
    if (!entry || !exit) { addMessage('Trip: Invalid station selection'); return; }

    setLegProgress(0);
    await managerRef.current.startLeg({
      type:         LEG_TYPE.TRANSIT,
      entryStation: entry,
      exitStation:  exit,
    });
  }, [addMessage]);

  // ---------------------------------------------------------------------------
  // Start a parking leg
  // ---------------------------------------------------------------------------
  const startParkingLeg = useCallback(async (stationId) => {
    if (!managerRef.current) return;
    const station = tripStations.find(s => s.id === stationId);
    if (!station) { addMessage('Trip: Invalid parking station'); return; }

    // Randomise duration 60–240 min for demo
    const simulatedDurationMinutes = (Math.floor(Math.random() * 13) + 4) * 15;
    addMessage(`Trip: Simulated parking duration — ${simulatedDurationMinutes} min`);

    setLegProgress(0);
    await managerRef.current.startLeg({
      type:                    LEG_TYPE.PARKING,
      entryStation:            station,
      exitStation:             station, // same station — entry/exit same gate
      simulatedDurationMinutes,
    });
  }, [addMessage]);

  // ---------------------------------------------------------------------------
  // End trip
  // ---------------------------------------------------------------------------
  const endTrip = useCallback(async () => {
    if (!managerRef.current) return;
    await managerRef.current.endTrip();
  }, []);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const resetTrip = useCallback(() => {
    managerRef.current?.stopActiveLeg();
    managerRef.current = null;
    setTripSnapshot(null);
    setLegProgress(0);
    setIsLegRunning(false);
    setCountdown(null);
  }, []);

  return {
    tripSnapshot,
    legProgress,
    isLegRunning,
    countdown,
    transitStations,
    parkingStations,
    tripStatus: tripSnapshot?.status || TRIP_STATUS.IDLE,
    startTrip,
    startTransitLeg,
    startParkingLeg,
    endTrip,
    resetTrip,
    getExplainPayload: (journeyId) => explainabilityService.retrieve(journeyId),
  };
}
