// =============================================================================
// CAMARA API Adapter — Transport
// src/transport/api/transportApiAdapter.js
//
// Geofencing Subscription: REAL CAMARA API (same endpoint as healthcare usecase)
//   POST   https://network-as-code.p-eu.rapidapi.com/geofencing-subscriptions/v0.3/subscriptions
//   DELETE https://network-as-code.p-eu.rapidapi.com/geofencing-subscriptions/v0.3/subscriptions/{id}
//
// All other functions re-exported from api.js or mocked where noted.
//
// ── Detection Modes ──────────────────────────────────────────────────────────
//
// GEOFENCE mode (detectionMode: "GEOFENCE" in stations.json):
//   Real CAMARA Geofencing Subscription created at journey start.
//   Network pushes AREA_ENTERED events to the webhook endpoint.
//   Falls back to LOCATION_VERIFY automatically if subscription creation fails.
//
// LOCATION_VERIFY mode (detectionMode: "LOCATION_VERIFY" in stations.json):
//   JourneySimulator drives waypoints → checkStationEntry() → Location Verification.
//   No geofencing subscription created.
// =============================================================================

import axios from 'axios';
import { locationVerification, locationRetrieval, carrierBilling, simSwap, deviceSwap,
         setTransportScanPhase, setTransportStationCoords } from '../../api.js';

const GEOFENCE_BASE_URL = 'https://network-as-code.p-eu.rapidapi.com/geofencing-subscriptions/v0.3/subscriptions';
const API_KEY           = 'a1dee25b3dmsh933c9f572c08b1cp1e7225jsna6c0a404fd8e';

const geofenceHeaders = {
  'Content-Type':    'application/json',
  'x-rapidapi-host': 'network-as-code.nokia.rapidapi.com',
  'x-rapidapi-key':  API_KEY,
};

// =============================================================================
// Geofencing Subscription — REAL API (mirrors healthcare/api.js)
// =============================================================================

/**
 * Creates a real CAMARA Geofencing Subscription.
 * Exact same pattern as createGeofencingSubscription() in healthcare/api.js.
 *
 * @param {object}   data   — { device, area, subscriptionDetail }
 * @param {function} [logFn]
 * @returns {Promise<{ subscriptionId: string }>}
 */
export async function createGeofenceSubscription(data, logFn) {
  const requestPayload = {
    protocol: 'HTTP',
    sink:     'https://notificationSendServer12.supertelco.com',
    types:    [
      'org.camaraproject.geofencing-subscriptions.v0.area-entered',
      'org.camaraproject.geofencing-subscriptions.v0.area-left',
    ],
    config: {
      subscriptionDetail: {
        device: data.device,
        area:   data.area,
      },
      initialEvent:           true,
      subscriptionMaxEvents:  10,
      subscriptionExpireTime: '2045-03-22T05:40:58.469Z',
    },
  };

  try {
    const response = await axios.post(GEOFENCE_BASE_URL, requestPayload, { headers: geofenceHeaders });
    const result = response.data;
    // API returns either .id or .subscriptionId depending on version
    const subscriptionId = result.id || result.subscriptionId;

    if (logFn) {
      logFn(
        'Geofencing Subscription (Create)',
        'POST',
        '/geofencing-subscriptions/v0.3/subscriptions',
        requestPayload,
        result
      );
    }
    return { ...result, subscriptionId };
  } catch (err) {
    const errorResponse = err.response
      ? { status: err.response.status, data: err.response.data }
      : { error: err.message };
    if (logFn) {
      logFn(
        'Geofencing Subscription (Create) — FAILED',
        'POST',
        '/geofencing-subscriptions/v0.3/subscriptions',
        requestPayload,
        errorResponse
      );
    }
    throw err; // GeofencingManager catches this and falls back to LOCATION_VERIFY
  }
}

/**
 * Deletes a real CAMARA Geofencing Subscription.
 * Exact same pattern as deleteGeofencingSubscription() in healthcare/api.js.
 *
 * @param {string}   subscriptionId
 * @param {function} [logFn]
 * @returns {Promise<void>}
 */
export async function deleteGeofenceSubscription(subscriptionId, logFn) {
  const url = `${GEOFENCE_BASE_URL}/${subscriptionId}`;
  try {
    const response = await axios.delete(url, { headers: geofenceHeaders });
    const result = response.data || { status: 'DELETED' };
    if (logFn) {
      logFn(
        'Geofencing Subscription (Delete)',
        'DELETE',
        `/geofencing-subscriptions/v0.3/subscriptions/${subscriptionId}`,
        { subscriptionId },
        result
      );
    }
  } catch (err) {
    const errorResponse = err.response
      ? { status: err.response.status, data: err.response.data }
      : { error: err.message };
    if (logFn) {
      logFn(
        'Geofencing Subscription (Delete) — FAILED',
        'DELETE',
        `/geofencing-subscriptions/v0.3/subscriptions/${subscriptionId}`,
        { subscriptionId },
        errorResponse
      );
    }
    // Do not throw — cleanup failure must not break the journey flow
  }
}

// =============================================================================
// Device Reachability — mocked (real API commented for reference)
// =============================================================================

export function deviceReachability(phoneNumber, logFn) {
  const requestPayload = { device: { phoneNumber } };
  // Real: POST /device-status/device-reachability-status/v1/retrieve
  return new Promise(resolve => {
    setTimeout(() => {
      const response = {
        reachable:          true,
        connectivity:       ['DATA'],
        connectivityStatus: 'CONNECTED_DATA',
        lastStatusTime:     new Date().toISOString(),
      };
      if (logFn) logFn('Device Reachability Status', 'POST',
        '/device-status/device-reachability-status/v1/retrieve', requestPayload, response);
      resolve(response);
    }, 400);
  });
}

export function createReachabilitySubscription(phoneNumber, logFn) {
  const requestPayload = {
    protocol: 'HTTPS',
    sink:     'https://transport-app.example.com/callback',
    types:    ['org.camara.device-reachability-status.v0.reachability-status-change'],
    config: {
      subscriptionDetail:     { device: { phoneNumber } },
      initialEvent:           true,
      subscriptionExpireTime: new Date(Date.now() + 86400000).toISOString(),
    },
  };
  return new Promise(resolve => {
    setTimeout(() => {
      const response = {
        subscriptionId: `sub-reach-${Date.now()}`,
        startsAt:       new Date().toISOString(),
        expiresAt:      new Date(Date.now() + 86400000).toISOString(),
      };
      if (logFn) logFn('Device Reachability Subscription (Create)', 'POST',
        '/device-status/device-reachability-status-subscriptions/v0.7/subscriptions',
        requestPayload, response);
      resolve(response);
    }, 300);
  });
}

export function deleteReachabilitySubscription(subscriptionId, logFn) {
  return new Promise(resolve => {
    setTimeout(() => {
      if (logFn) logFn('Device Reachability Subscription (Delete)', 'DELETE',
        `/device-status/device-reachability-status-subscriptions/v0.7/subscriptions/${subscriptionId}`,
        { subscriptionId }, { status: 'DELETED' });
      resolve();
    }, 200);
  });
}

// =============================================================================
// Re-exports + adapter factory
// =============================================================================

export { locationVerification, locationRetrieval, carrierBilling, simSwap, deviceSwap,
         setTransportScanPhase, setTransportStationCoords };

export function createTransportApiAdapter() {
  return {
    locationVerification,
    locationRetrieval,
    carrierBilling,
    simSwap,
    deviceSwap,
    createGeofenceSubscription,
    deleteGeofenceSubscription,
    deviceReachability,
    createReachabilitySubscription,
    deleteReachabilitySubscription,
    setTransportScanPhase,
    setTransportStationCoords,
  };
}
