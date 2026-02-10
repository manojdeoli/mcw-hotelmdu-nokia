// Gateway Server URL - Update this when deployed to cloud
const GATEWAY_URL = process.env.REACT_APP_GATEWAY_URL || 'http://192.168.1.4:3001';

class GatewayClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.subscribers = [];
    this.userId = null;
  }

  // Connect to Gateway Server
  connect(userId) {
    if (this.ws) {
      this.disconnect();
    }

    this.userId = userId;
    // Convert HTTP URL to WebSocket URL and ensure proper path
    let wsUrl = GATEWAY_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    // Remove trailing slash if present, then add it back for consistency
    wsUrl = wsUrl.replace(/\/$/, '') + '/';
    
    console.log('[Gateway] Connecting to:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Gateway] Connected to server');
        this.connected = true;
        
        // Subscribe to user's BLE events
        this.ws.send(JSON.stringify({ type: 'subscribe', userId: this.userId }));
      };

      this.ws.onclose = (event) => {
        console.log('[Gateway] Disconnected from server', event.code, event.reason);
        this.connected = false;
        
        // Auto-reconnect after 2 seconds if userId is still set
        if (this.userId) {
          console.log('[Gateway] Reconnecting in 2 seconds...');
          setTimeout(() => {
            if (this.userId) {
              this.connect(this.userId);
            }
          }, 2000);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Gateway] Connection error:', error);
      };

      // Listen for BLE events from Gateway
      this.ws.onmessage = (event) => {
        console.log('[Gateway] Raw message received:', event.data);
        console.log('[Gateway] Message type:', typeof event.data);
        console.log('[Gateway] Message length:', event.data.length);
        try {
          const data = JSON.parse(event.data);
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
    this.userId = null; // Clear userId to prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      // Don't clear subscribers - they should persist across reconnections
      // this.subscribers = [];
    }
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
