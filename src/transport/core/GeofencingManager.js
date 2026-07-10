// =============================================================================
// Geofencing Manager
// src/transport/core/GeofencingManager.js
//
// Pure JavaScript — no React, no app dependencies.
//
// Abstracts two detection strategies:
//   GEOFENCE        — CAMARA Geofencing Subscriptions (primary)
//   LOCATION_VERIFY — CAMARA Location Verification (fallback)
//
// Pass-Through Detection (Approach 3 + 1+4):
// ─────────────────────────────────────────
// PRIMARY — Geofencing AREA_LEFT event:
//   When AREA_ENTERED fires, a dwell timer starts (station.dwellConfirmMs).
//   If AREA_LEFT fires before the timer expires → pass-through → discard.
//   If the timer expires first → device has dwelled → genuine stop → confirm.
//
// FALLBACK — Schedule awareness (Approach 4):
//   In LOCATION_VERIFY mode, only the selected exit station is checked.
//   Intermediate stations are never checked — eliminates pass-through entirely
//   for pre-selected routes without any additional API calls.
//
// DEFAULT_DWELL_MS = 20000 (20s) — covers trains at 60 km/h through 150m radius.
// Per-station override via station.dwellConfirmMs in stations.json.
// =============================================================================

import stationsConfig from '../config/stations.json';

export const DETECTION_MODE = Object.freeze({
  GEOFENCE:        'GEOFENCE',
  LOCATION_VERIFY: 'LOCATION_VERIFY',
});

export const DETECTION_METHOD = Object.freeze({
  GEOFENCE_SUB:    'GEOFENCE_SUB',
  LOCATION_VERIFY: 'LOCATION_VERIFY',
});

const DEFAULT_DWELL_MS = 20000;
const DEMO_DWELL_MS    = stationsConfig.demoDwellConfirmMs ?? DEFAULT_DWELL_MS;

export class GeofencingManager {
  /**
   * @param {object} options
   * @param {object}   options.apiAdapter       — injected CAMARA API adapter
   * @param {string}   options.detectionMode    — GEOFENCE | LOCATION_VERIFY
   * @param {function} options.onZoneEntered    — callback({ station, detectionMethod })
   * @param {function} [options.onPassThrough]  — optional callback(station) when pass-through detected
   * @param {function} [options.logInteraction] — optional API log callback
   */
  constructor({ apiAdapter, detectionMode, onZoneEntered, onPassThrough = null, logInteraction = null }) {
    if (!apiAdapter)    throw new Error('[GeofencingManager] apiAdapter is required');
    if (!onZoneEntered) throw new Error('[GeofencingManager] onZoneEntered callback is required');

    this._api                  = apiAdapter;
    this._mode                 = detectionMode || DETECTION_MODE.LOCATION_VERIFY;
    this._onZoneEntered        = onZoneEntered;
    this._onPassThrough        = onPassThrough;
    this._log                  = logInteraction;
    this._activeSubId          = null;
    this._activeStation        = null;
    this._modeFallbackOccurred = false;

    // Dwell timer state — one active timer at a time
    this._dwellTimer           = null;
    this._dwellStation         = null;
  }

  // ---------------------------------------------------------------------------
  // Public getters
  // ---------------------------------------------------------------------------

  getMode()        { return this._mode; }
  getActiveSubId() { return this._activeSubId; }
  didFallback()    { return this._modeFallbackOccurred; }

  /**
   * Confirms zone entry immediately without a dwell timer.
   * Used for parking gates where hardware detection is instant
   * and pass-through is not a concern.
   */
  confirmEntryImmediate(station) {
    this._onZoneEntered({ station, detectionMethod: DETECTION_METHOD.GEOFENCE_SUB });
  }

  // ---------------------------------------------------------------------------
  // Multi-station scan (step [d], [g], [h])
  // ---------------------------------------------------------------------------

  /**
   * Scans all stations sequentially via Location Verification.
   * Returns the first station that returns TRUE, or null.
   */
  async scanStationsForEntry(stations, phoneNumber, label = 'SCAN') {
    for (const station of stations) {
      try {
        const result = await this._api.locationVerification({
          device: { phoneNumber },
          area: {
            areaType: 'CIRCLE',
            center: { latitude: station.coordinates.lat, longitude: station.coordinates.lng },
            radius: station.geofenceRadius,
          },
        }, this._log);

        const matched = result.verificationResult === 'TRUE';
        console.log(`[GeofencingManager] ${label} — ${station.name}: ${matched ? 'TRUE ✓' : 'FALSE'}`);
        if (matched) return station;
      } catch (err) {
        console.error(`[GeofencingManager] ${label} scan failed for ${station.name}:`, err.message);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Station activation
  // ---------------------------------------------------------------------------

  async activateForStation(station, phoneNumber) {
    await this.deactivate();
    this._activeStation = station;

    if (this._mode === DETECTION_MODE.GEOFENCE) {
      await this._createGeofenceSubscription(station, phoneNumber);
    }
  }

  // ---------------------------------------------------------------------------
  // Location Verification mode — single station check
  // ---------------------------------------------------------------------------

  async checkStationEntry(station, phoneNumber, simulatedDurationMinutes = null) {
    try {
      const result = await this._api.locationVerification({
        device: { phoneNumber },
        area: {
          areaType: 'CIRCLE',
          center: { latitude: station.coordinates.lat, longitude: station.coordinates.lng },
          radius: station.geofenceRadius,
        },
      }, this._log);

      const entered = result.verificationResult === 'TRUE';
      if (entered) {
        this._onZoneEntered({
          station,
          detectionMethod: DETECTION_METHOD.LOCATION_VERIFY,
          simulatedDurationMinutes,
        });
      }
      return entered;
    } catch (err) {
      console.error('[GeofencingManager] Location Verification failed:', err.message);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Geofencing mode — event handlers
  // ---------------------------------------------------------------------------

  /**
   * Called by the simulator (or a real webhook) when AREA_ENTERED fires.
   *
   * Starts the dwell timer. If AREA_LEFT fires before the timer expires,
   * the entry is discarded as a pass-through. If the timer expires first,
   * the entry is confirmed as a genuine stop.
   *
   * @param {string} subscriptionId
   * @param {object} station
   */
  handleGeofenceEvent(subscriptionId, station) {
    if (subscriptionId !== this._activeSubId) return;

    const dwellMs = stationsConfig.demoDwellConfirmMs
      ?? station.dwellConfirmMs
      ?? DEFAULT_DWELL_MS;
    console.log(`[GeofencingManager] AREA_ENTERED at ${station.name} — dwell timer started (${dwellMs}ms)`);

    this._clearDwellTimer();
    this._dwellStation = station;

    this._dwellTimer = setTimeout(() => {
      console.log(`[GeofencingManager] Dwell confirmed at ${station.name} — genuine stop ✓`);
      this._dwellTimer   = null;
      this._dwellStation = null;
      this._onZoneEntered({ station, detectionMethod: DETECTION_METHOD.GEOFENCE_SUB });
    }, dwellMs);
  }

  /**
   * Called by the simulator (or a real webhook) when AREA_LEFT fires.
   *
   * If the dwell timer is still running, the device left before the dwell
   * threshold — this was a pass-through. Cancel the timer and discard.
   *
   * @param {string} subscriptionId
   * @param {object} station
   */
  handleGeofenceLeftEvent(subscriptionId, station) {
    if (subscriptionId !== this._activeSubId) return;
    if (!this._dwellTimer) return; // no pending dwell — nothing to cancel

    console.log(`[GeofencingManager] AREA_LEFT at ${station.name} before dwell expired — pass-through detected, discarding`);
    this._clearDwellTimer();

    if (typeof this._onPassThrough === 'function') {
      this._onPassThrough(station);
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  async deactivate() {
    this._clearDwellTimer();

    if (this._activeSubId && this._mode === DETECTION_MODE.GEOFENCE) {
      try {
        await this._api.deleteGeofenceSubscription(this._activeSubId, this._log);
      } catch (err) {
        console.warn('[GeofencingManager] Failed to delete subscription:', err.message);
      }
    }
    this._activeSubId   = null;
    this._activeStation = null;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  async _createGeofenceSubscription(station, phoneNumber) {
    try {
      const response = await this._api.createGeofenceSubscription({
        device: { phoneNumber },
        area: {
          areaType: 'CIRCLE',
          center: { latitude: station.coordinates.lat, longitude: station.coordinates.lng },
          radius: station.geofenceRadius,
        },
        subscriptionDetail: { eventTypes: ['AREA_ENTERED', 'AREA_LEFT'] },
      }, this._log);

      this._activeSubId = response.subscriptionId;
      console.log(`[GeofencingManager] Subscription created for ${station.name}: ${this._activeSubId}`);
    } catch (err) {
      console.error('[GeofencingManager] Subscription creation failed — falling back to LOCATION_VERIFY:', err.message);
      this._mode                 = DETECTION_MODE.LOCATION_VERIFY;
      this._modeFallbackOccurred = true;
    }
  }

  _clearDwellTimer() {
    if (this._dwellTimer) {
      clearTimeout(this._dwellTimer);
      this._dwellTimer   = null;
      this._dwellStation = null;
    }
  }
}
