// =============================================================================
// Journey Simulator
// src/transport/core/JourneySimulator.js
//
// Pure JavaScript — no React, no app dependencies.
// Portable to any project that imports this file.
//
// Reuses the same route interpolation pattern as the hotel transport flow.
// Fires zone events at station waypoints via the injected onWaypointReached
// and onStationReached callbacks — the simulator does not know about the
// GeofencingManager or StateMachine directly.
// =============================================================================

const STEP_DELAY_MS = 1200;

export class JourneySimulator {
  /**
   * @param {object} options
   * @param {function} options.onWaypointReached — callback({ coords, stepIndex, totalSteps })
   * @param {function} options.onStationReached  — callback(station) fired at station waypoints
   * @param {function} options.onClockTick       — callback(simulatedDate) for clock updates
   * @param {number}   [options.stepDelayMs]     — ms between waypoints (default 300)
   */
  constructor({ onWaypointReached, onStationReached, onClockTick, stepDelayMs = STEP_DELAY_MS }) {
    this._onWaypointReached = onWaypointReached || (() => {});
    this._onStationReached  = onStationReached  || (() => {});
    this._onClockTick       = onClockTick       || (() => {});
    this._stepDelayMs       = stepDelayMs;
    this._running           = false;
  }

  /**
   * Runs the simulated journey from entry station to exit station.
   * Generates interpolated waypoints and fires station events at the
   * entry and exit station coordinates.
   *
   * @param {object} entryStation — station config object
   * @param {object} exitStation  — station config object
   * @param {number} [sections]   — number of route segments (default 10)
   * @param {number} [simulatedDurationMinutes] — if set, passed to exit station event
   *                                              for duration-based pricing (parking)
   */
  async run(entryStation, exitStation, sections = 10, simulatedDurationMinutes = null) {
    this._running = true;
    const route   = this._generateRoute(entryStation, exitStation, sections);
    const startMs = Date.now();

    for (let i = 0; i < route.length; i++) {
      if (!this._running) break;

      const waypoint = route[i];

      // Advance simulated clock proportionally
      const progressRatio = i / (route.length - 1);
      const simulatedMs   = startMs + progressRatio * 20 * 60 * 1000; // 20 min journey
      this._onClockTick(new Date(simulatedMs));

      // Notify map — always fires for every waypoint
      this._onWaypointReached({ coords: waypoint.coords, stepIndex: i, totalSteps: route.length });

      // Guard: only fire station detection at explicitly marked station waypoints.
      if (waypoint.isStation) {
        // Pass simulatedDurationMinutes only to the exit station (last waypoint)
        const isExit = i === route.length - 1;
        this._onStationReached(waypoint.station, isExit ? simulatedDurationMinutes : null);
      }

      await this._delay(this._stepDelayMs);
    }

    this._running = false;
  }

  stop() {
    this._running = false;
  }

  // ---------------------------------------------------------------------------
  // Private — route generation (same pattern as hotel transport flow)
  // ---------------------------------------------------------------------------

  // Builds a waypoint array where each entry is { coords, isStation, station }.
  // Only the first and last waypoints are marked isStation: true — all others
  // are interpolated intermediate points and must never trigger zone detection.
  _generateRoute(entryStation, exitStation, sections) {
    const start = entryStation.coordinates;
    const end   = exitStation.coordinates;

    const latDiff = (end.lat - start.lat) / sections;
    const lngDiff = (end.lng - start.lng) / sections;

    const route = [{ coords: start, isStation: true, station: entryStation }];

    for (let i = 1; i < sections; i++) {
      route.push({
        coords:    { lat: start.lat + latDiff * i, lng: start.lng + lngDiff * i },
        isStation: false,
        station:   null,
      });
    }

    route.push({ coords: end, isStation: true, station: exitStation });
    return route;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
