// =============================================================================
// Travel Time API Adapter
// src/transport/api/travelTimeApiAdapter.js
//
// Gap 3.6: providerReliability added to every result mode.
//   GOOGLE = MEDIUM (best-effort only, per Oliver's caution)
//   MOCK   = HIGH   (deterministic config data)
//   TFL    = HIGH   (official schedule data)
//   MAPBOX = MEDIUM (road estimates only)
//
// Gap 3.7: Multi-source priority model.
//   Priority: TFL > GOOGLE > MAPBOX > MOCK
//   resolveProvider() now walks the priority list and uses the first available.
// =============================================================================

import travelTimeConfig from '../config/travelTimeConfig.json';

// ---------------------------------------------------------------------------
// Null result — returned when no data is available for a route
// ---------------------------------------------------------------------------
// Gap 3.6: Provider reliability levels
const PROVIDER_RELIABILITY = Object.freeze({
  MOCK:   'HIGH',    // deterministic config data
  GOOGLE: 'MEDIUM',  // best-effort estimates (per Oliver's caution)
  MAPBOX: 'MEDIUM',  // road estimates only
  TFL:    'HIGH',    // official schedule data
});

function nullModeResult(source) {
  return {
    optimisticMinutes: null, pessimisticMinutes: null, bestEstimateMinutes: null,
    source,
    providerReliability: PROVIDER_RELIABILITY[source] ?? 'MEDIUM',
  };
}

function nullResult(source = 'MOCK') {
  return {
    rail: nullModeResult(source),
    road: nullModeResult(source),
    bus:  nullModeResult(source),
  };
}

function shapeEntry(entry, source) {
  if (!entry) return nullModeResult(source);
  return {
    optimisticMinutes:   entry.optimistic  ?? null,
    pessimisticMinutes:  entry.pessimistic ?? null,
    bestEstimateMinutes: entry.best        ?? null,
    source,
    providerReliability: PROVIDER_RELIABILITY[source] ?? 'MEDIUM',
  };
}

// =============================================================================
// MOCK Provider — fully implemented, reads entirely from travelTimeConfig.json
// =============================================================================
function MockTravelTimeProvider() {
  const cfg = travelTimeConfig.mockData;

  function isAvailable() { return true; }

  async function getTravelTimeRanges({ fromStation, toStation }) {
    const source = 'MOCK';

    // 1. Exact station pair
    const pairKey = `${fromStation.id}_${toStation.id}`;
    const pairMatch = cfg.routePairs?.find(r => r.key === pairKey);
    if (pairMatch) {
      return {
        rail: shapeEntry(pairMatch.rail, source),
        road: shapeEntry(pairMatch.road, source),
        bus:  shapeEntry(pairMatch.bus,  source),
      };
    }

    // 2. Zone pair fallback
    const zoneMatch = cfg.zonePairFallbacks?.find(
      z => z.fromZone === fromStation.zoneId && z.toZone === toStation.zoneId
    );
    if (zoneMatch) {
      return {
        rail: shapeEntry(zoneMatch.rail, source),
        road: shapeEntry(zoneMatch.road, source),
        bus:  shapeEntry(zoneMatch.bus,  source),
      };
    }

    // 3. No data
    return nullResult(source);
  }

  return { isAvailable, getTravelTimeRanges, name: 'MOCK' };
}

// =============================================================================
// GOOGLE Provider — live implementation
// Calls Google Directions API for road + transit estimates.
// Falls back to MOCK automatically on any error or missing credentials.
// =============================================================================
function GoogleTravelTimeProvider() {
  const cfg = travelTimeConfig.providers?.google ?? {};

  function isAvailable() {
    // API key lives server-side in .env — only check enabled flag
    return !!(cfg.enabled);
  }

  /**
   * Fetches travel time ranges from Google Directions API.
   *
   * Road  — driving mode:  uses duration + duration_in_traffic to build range
   * Rail  — transit mode:  uses scheduled transit duration (deterministic)
   * Bus   — transit mode:  bus-only variant
   *
   * Pessimistic road = best estimate × pessimisticMultiplier (config)
   * Optimistic  road = raw duration (no traffic)
   */
  async function getTravelTimeRanges({ fromStation, toStation, timestamp }) {
    const { lat: oLat, lng: oLng } = fromStation.coordinates;
    const { lat: dLat, lng: dLng } = toStation.coordinates;
    const origin      = `${oLat},${oLng}`;
    const destination = `${dLat},${dLng}`;
    const pessimisticMultiplier = cfg.pessimisticMultiplier ?? 1.4;

    // Call the server-side proxy — avoids CORS and keeps the API key off the browser
    async function fetchDirections(mode, transitMode = null) {
      let url = `/api/transport/directions?origin=${encodeURIComponent(origin)}` +
                `&destination=${encodeURIComponent(destination)}&mode=${mode}&departure_time=now`;
      if (transitMode) url += `&transit_mode=${transitMode}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Directions proxy HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.status !== 'OK' || !data.routes?.length) {
        throw new Error(`Google API status: ${data.status}`);
      }
      return data.routes[0].legs[0];
    }

    // ── Road ────────────────────────────────────────────────────────────────
    let road = nullModeResult('GOOGLE');
    try {
      const leg        = await fetchDirections('driving');
      const optimistic = Math.round(leg.duration.value / 60);          // no traffic
      const best       = leg.duration_in_traffic
        ? Math.round(leg.duration_in_traffic.value / 60)
        : optimistic;
      const pessimistic = Math.round(best * pessimisticMultiplier);
      road = { optimisticMinutes: optimistic, pessimisticMinutes: pessimistic, bestEstimateMinutes: best, source: 'GOOGLE', providerReliability: 'MEDIUM' };
      console.log(`[TravelTimeAdapter][GOOGLE] Road: ${optimistic}-${pessimistic} min (best: ${best})`);
    } catch (err) {
      console.warn(`[TravelTimeAdapter][GOOGLE] Road fetch failed: ${err.message}`);
    }

    // Rail
    let rail = nullModeResult('GOOGLE');
    try {
      const leg      = await fetchDirections('transit', 'rail');
      const duration = Math.round(leg.duration.value / 60);
      rail = { optimisticMinutes: duration, pessimisticMinutes: Math.round(duration * 1.1), bestEstimateMinutes: duration, source: 'GOOGLE', providerReliability: 'MEDIUM' };
      console.log(`[TravelTimeAdapter][GOOGLE] Rail: ${duration} min`);
    } catch (err) {
      console.warn(`[TravelTimeAdapter][GOOGLE] Rail fetch failed: ${err.message}`);
    }

    // Bus
    let bus = nullModeResult('GOOGLE');
    try {
      const leg  = await fetchDirections('transit', 'bus');
      const best = Math.round(leg.duration.value / 60);
      bus = { optimisticMinutes: best, pessimisticMinutes: Math.round(best * 1.2), bestEstimateMinutes: best, source: 'GOOGLE', providerReliability: 'MEDIUM' };
      console.log(`[TravelTimeAdapter][GOOGLE] Bus: ${best} min`);
    } catch (err) {
      console.warn(`[TravelTimeAdapter][GOOGLE] Bus fetch failed: ${err.message}`);
    }

    return { rail, road, bus };
  }

  return { isAvailable, getTravelTimeRanges, name: 'GOOGLE' };
}

// =============================================================================
// MAPBOX Provider — Phase 4 stub
// Returns null result until credentials are configured and enabled.
// Note: Mapbox does not provide rail/transit — road only.
// =============================================================================
function MapboxTravelTimeProvider() {
  const cfg = travelTimeConfig.providers?.mapbox ?? {};

  function isAvailable() {
    return !!(cfg.enabled && cfg.token && cfg.token.length > 0);
  }

  /**
   * TODO Phase 4 — Implementation notes:
   *
   * Road only (Mapbox has no native rail/transit support):
   *   GET {endpoint}/driving/{fromLng},{fromLat};{toLng},{toLat}
   *          ?access_token={token}&annotations=duration
   *   Parse: routes[0].duration (seconds → divide by 60 for minutes)
   *   Build optimistic/pessimistic by applying ±20% band around the estimate.
   *   Rail and bus ranges: return null (not supported by Mapbox).
   */
  async function getTravelTimeRanges(/* { fromStation, toStation, modes, timestamp } */) {
    return nullResult('MAPBOX');
  }

  return { isAvailable, getTravelTimeRanges, name: 'MAPBOX' };
}

// =============================================================================
// TFL Provider — Phase 4 stub (London-area routes only)
// Returns null result until credentials are configured and enabled.
// =============================================================================
function TflTravelTimeProvider() {
  const cfg = travelTimeConfig.providers?.tfl ?? {};

  function isAvailable() {
    return !!(cfg.enabled && cfg.appKey && cfg.appKey.length > 0);
  }

  /**
   * TODO Phase 4 — Implementation notes:
   *
   * TfL Unified API (rail + bus + road for London only):
   *   GET {endpoint}/{fromLat},{fromLng}/to/{toLat},{toLng}
   *          ?app_key={appKey}&mode=tube,overground,bus,walking
   *   Parse: journeys[0].duration (minutes, already in minutes)
   *   Build optimistic from fastest journey option.
   *   Build pessimistic from slowest journey option.
   *   Best estimate = median duration across returned journeys.
   *
   * Scope check: only activate when coordinates are within London bounding box
   *   lat: 51.28–51.69  lng: -0.51–0.33
   */
  async function getTravelTimeRanges(/* { fromStation, toStation, modes, timestamp } */) {
    return nullResult('TFL');
  }

  return { isAvailable, getTravelTimeRanges, name: 'TFL' };
}

// Provider registry
const PROVIDERS = {
  MOCK:   MockTravelTimeProvider,
  GOOGLE: GoogleTravelTimeProvider,
  MAPBOX: MapboxTravelTimeProvider,
  TFL:    TflTravelTimeProvider,
};

// =============================================================================
// Gap 3.7: Multi-source priority model
// Priority order: TFL > GOOGLE > MAPBOX > MOCK
// resolveProvider() walks the list and returns the first available provider.
// This makes the priority explicit and configurable via dataSourcePriority.
// =============================================================================
const DEFAULT_PRIORITY = ['TFL', 'GOOGLE', 'MAPBOX', 'MOCK'];

function resolveProvider() {
  // Allow config to override priority order
  const priorityOrder =
    travelTimeConfig.dataSourcePriority ?? DEFAULT_PRIORITY;

  for (const name of priorityOrder) {
    const Factory = PROVIDERS[name.toUpperCase()];
    if (!Factory) continue;
    const provider = Factory();
    if (provider.isAvailable()) {
      if (name.toUpperCase() !== 'MOCK') {
        console.log(`[TravelTimeAdapter] Using provider: ${provider.name} (reliability: ${PROVIDER_RELIABILITY[provider.name] ?? 'MEDIUM'})`);
      }
      return provider;
    }
  }

  // Final safety fallback
  console.warn('[TravelTimeAdapter] No configured provider available - using MOCK');
  return MockTravelTimeProvider();
}

// =============================================================================
// Public API — single exported function used by correlation engine
// =============================================================================

/**
 * Fetches travel time ranges for a station pair using the configured provider.
 *
 * Returns null ranges (not an error) when no data is available for the route.
 * The correlation engine handles null ranges gracefully.
 *
 * @param {object} params
 * @param {object}   params.fromStation  — { id, name, coordinates, zoneId }
 * @param {object}   params.toStation    — { id, name, coordinates, zoneId }
 * @param {string[]} [params.modes]      — subset of supportedModes from config
 * @param {string}   [params.timestamp]  — ISO string for time-of-day context (future use)
 * @returns {Promise<TravelTimeResult>}
 */
export async function getTravelTimeRanges({ fromStation, toStation, modes, timestamp, addLog }) {
  const log = addLog ?? (() => {});

  if (!travelTimeConfig.featureEnabled) {
    return nullResult('DISABLED');
  }

  if (!fromStation || !toStation) {
    return nullResult('MOCK');
  }

  // demoScenario injects a synthetic actual duration calibrated against real
  // Google Directions API ranges for this route. Google is always called so
  // the live API call is visible in the demo. The synthetic duration is chosen
  // to sit clearly inside the target mode's real Google range.
  // See travelTimeConfig.json demoScenarioTimings for calibration values.
  const provider = resolveProvider();
  log(`Transport: [TRAVEL-TIME] Provider selected — ${provider.name}${travelTimeConfig.demoScenario ? ` (demoScenario='${travelTimeConfig.demoScenario}')` : ''}`);

  try {
    const result = await provider.getTravelTimeRanges({
      fromStation,
      toStation,
      modes: modes ?? travelTimeConfig.supportedModes,
      timestamp,
    });
    // If Google returned all-null ranges (e.g. CORS error / no transit available)
    // fall back to MOCK so correlation still has data to work with
    const allNull = ['rail','road','bus'].every(
      m => result[m]?.optimisticMinutes == null
    );
    if (allNull && provider.name !== 'MOCK') {
      log(`Transport: [TRAVEL-TIME] ${provider.name} returned no data (possible CORS block) — falling back to MOCK`);
      console.warn(`[TravelTimeAdapter] ${provider.name} returned no data — falling back to MOCK`);
      return MockTravelTimeProvider().getTravelTimeRanges({ fromStation, toStation, modes, timestamp });
    }
    if (provider.name !== 'MOCK') {
      log(`Transport: [TRAVEL-TIME] ${provider.name} data received ✓`);
    }
    return result;
  } catch (err) {
    log(`Transport: [TRAVEL-TIME] ${provider.name} error — ${err.message} — falling back to MOCK`);
    console.error(`[TravelTimeAdapter] Provider ${provider.name} error — ${err.message} — falling back to MOCK`);
    return MockTravelTimeProvider().getTravelTimeRanges({ fromStation, toStation, modes, timestamp });
  }
}
