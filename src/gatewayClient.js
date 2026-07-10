// Gateway Server URL - Check for runtime override first
let GATEWAY_URL = 'http://localhost:8080'; // fallback

// ---------------------------------------------------------------------------
// Sanitise a gateway URL:
//   1. Ensure it starts with http:// or https:// (never ws://)
//   2. Remove any trailing slash
//   3. Collapse duplicate port repetitions, e.g. :8080:8080:8080 → :8080
//      This can occur when window.GATEWAY_URL_OVERRIDE is set from a server
//      injection that has already appended the port, and the value is then
//      further processed by URL-building code that appends it again.
// ---------------------------------------------------------------------------
function sanitiseGatewayUrl(raw) {
  if (!raw || typeof raw !== 'string') return 'http://localhost:8080';
  let url = raw.trim();
  // Collapse any repeated port pattern: (:PORT)+ → :PORT
  // Handles :8080:8080, :8080:8080:8080:8080, etc.
  url = url.replace(/(:\d+)\1+/g, '$1');
  // Remove trailing slash
  url = url.replace(/\/$/, '');
  return url;
}

// Check for runtime override from server injection
if (typeof window !== 'undefined' && window.GATEWAY_URL_OVERRIDE) {
  GATEWAY_URL = sanitiseGatewayUrl(window.GATEWAY_URL_OVERRIDE);
  console.log('[Gateway] Using runtime override URL:', GATEWAY_URL);
} else if (typeof window !== 'undefined' && window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.gatewayUrl) {
  GATEWAY_URL = sanitiseGatewayUrl(window.RUNTIME_CONFIG.gatewayUrl);
  console.log('[Gateway] Using runtime config URL:', GATEWAY_URL);
} else if (process.env.REACT_APP_GATEWAY_URL) {
  GATEWAY_URL = sanitiseGatewayUrl(process.env.REACT_APP_GATEWAY_URL);
  console.log('[Gateway] Using env config URL:', GATEWAY_URL);
}

// Fixed demo subscription ID - all web app instances use this
const DEMO_SUBSCRIPTION_ID = 'hotel-demo-subscription';

class GatewayClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.subscribers = [];
    this.userId = null;
  }

  // Connect to Gateway Server with fixed demo subscription
  connect(userPhoneNumber = null) {
    if (this.ws) {
      this.disconnect();
    }

    // Always use the fixed demo subscription ID
    this.userId = DEMO_SUBSCRIPTION_ID;

    // Build the WebSocket URL from the sanitised GATEWAY_URL.
    // Use URL parsing to avoid fragile string replacement that can produce
    // malformed URLs like ws://host:8080:8080/ on repeated connect() calls.
    let wsUrl;
    try {
      const parsed = new URL(GATEWAY_URL);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      parsed.pathname = '/';
      wsUrl = parsed.toString();
    } catch (_) {
      // Fallback for environments where URL constructor is unavailable
      wsUrl = GATEWAY_URL
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://')
        .replace(/\/$/, '') + '/';
    }

    console.log('[Gateway] Connecting to:', wsUrl);
    console.log('[Gateway] Using demo subscription ID:', this.userId);
    if (userPhoneNumber) {
      console.log('[Gateway] User phone number (display only):', userPhoneNumber);
    }
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Gateway] Connected to server');
        this.connected = true;
        
        // Subscribe to shared demo BLE events
        this.ws.send(JSON.stringify({ type: 'subscribe', userId: this.userId }));

        // Notify reconnect listeners after a short tick to ensure readyState=OPEN
        // before any listener calls sendAdvisory() — prevents isConnected() race.
        // Use 500ms to also ensure the validation subscriber is set up in
        // useTransportJourney before any biometric result arrives from Android.
        setTimeout(() => {
          if (this._reconnectListeners) {
            this._reconnectListeners.forEach(fn => { try { fn(); } catch (_) {} });
          }
        }, 500);
      };

      this.ws.onclose = (event) => {
        console.log('[Gateway] Disconnected from server', event.code, event.reason);
        this.connected = false;
        
        // Auto-reconnect after 2 seconds
        console.log('[Gateway] Reconnecting in 2 seconds...');
        setTimeout(() => {
          this.connect();
        }, 2000);
      };

      this.ws.onerror = (error) => {
        console.error('[Gateway] Connection error:', error);
      };

      // Listen for BLE and context events from Gateway
      this.ws.onmessage = (event) => {
        console.log('[Gateway] Raw message received:', event.data);
        try {
          const data = JSON.parse(event.data);

          // Route context events to ContextManager — additive, does not affect BLE flow
          if (data.eventType === 'context' && data.data) {
            try {
              // Lazy import to avoid circular dependency
              import('./transport/context/ContextManager.js').then(({ contextManager }) => {
                contextManager.updateContext(data.data);
              });
            } catch (_) {}
            return; // context events are not forwarded to BLE subscribers
          }

          // Route validation events from phone to subscribers
          if (data.eventType === 'validation' || data.eventType === 'validationReason') {
            console.log('[Gateway] Validation event received:', data);
            // Persist to backend so reconnect polling can recover it
            if (data.eventType === 'validation' && data.status === 'SUCCESS' && data.journeyId) {
              fetch('/api/device/validation-result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  deviceId:         data.deviceId  || 'unknown',
                  journeyId:        data.journeyId,
                  validationStatus: 'SUCCESS',
                  method:           data.method    || 'BIOMETRIC',
                  tagId:            data.tagId     || null,
                  timestamp:        data.timestamp || Date.now(),
                }),
              }).catch(() => {});
            }
            this.notifySubscribers(data);
            return;
          }

          // Existing BLE event handling — unchanged
          console.log('[Gateway] BLE event parsed successfully:', data);
          console.log('[Gateway] Event details - beaconName:', data.beaconName, 'zone:', data.zone, 'rssi:', data.rssi);
          console.log('[Gateway] Notifying', this.subscribers.length, 'subscribers');
          this.notifySubscribers(data);
        } catch (error) {
          console.error('[Gateway] Error parsing message:', error);
          console.error('[Gateway] Raw message that failed to parse:', event.data);
        }
      };
    } catch (error) {
      console.error('[Gateway] Failed to create WebSocket:', error);
    }

    return this.ws;
  }

  // Subscribe to BLE events
  subscribe(callback) {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Register a callback that fires every time the WebSocket reconnects.
   * Used by the validation subscriber in useTransportJourney to re-arm
   * after a 1006 disconnect mid-validation so no NFC event is missed.
   * Returns an unsubscribe function.
   */
  onReconnect(callback) {
    if (!this._reconnectListeners) this._reconnectListeners = [];
    this._reconnectListeners.push(callback);
    return () => {
      if (this._reconnectListeners) {
        this._reconnectListeners = this._reconnectListeners.filter(fn => fn !== callback);
      }
    };
  }

  // Notify all subscribers
  notifySubscribers(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[Gateway] Subscriber error:', error);
      }
    });
  }

  // Disconnect from Gateway
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.userId = null;
    }
  }

  // Send advisory to phone's BLE Scanner app via WebSocket.
  // Uses the clean advisory contract: validationSignal replaces rfDetectionRequired.
  // Device reads validationRequired to decide whether to activate NFC dispatch.
  sendAdvisory(advisory) {
    if (!this.isConnected()) {
      console.error('[Gateway] Cannot send advisory — not connected');
      return false;
    }
    const message = JSON.stringify({
      validationRequired:    advisory.validationRequired    ?? false,
      rfDetectionRequired:   advisory.validationRequired    ?? false,  // mirrors validationRequired — activates TRANSPORT mode on device
      validationSignal:      advisory.validationSignal      ?? 'CLEAR',
      correlationConfidence: advisory.correlationConfidence ?? 'HIGH',
      ambiguity:             advisory.ambiguity             ?? false,
      reason:                advisory.reason                ?? 'HIGH_CONFIDENCE',
      stage:                 advisory.stage                 ?? 'EXIT',
      journeyId:             advisory.journeyId             ?? null,
      expiresInMs:           advisory.expiresInMs           ?? 30000,
      riskLevel:             'LOW',  // required by BackendAdvisory.isValid() old-style fallback
    });
    this.ws.send(message);
    console.log('[Gateway] Advisory sent to device:', message);
    return true;
  }

  // Check connection status
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Get Gateway URL
  getGatewayUrl() {
    return GATEWAY_URL;
  }
}

// Export singleton instance
const gatewayClient = new GatewayClient();
export default gatewayClient;
