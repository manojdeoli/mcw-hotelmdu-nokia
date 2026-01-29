import { io } from 'socket.io-client';

// Gateway Server URL - Update this when deployed to cloud
const GATEWAY_URL = process.env.REACT_APP_GATEWAY_URL || 'http://localhost:3001';

class GatewayClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.subscribers = [];
    this.userId = null;
  }

  // Connect to Gateway Server
  connect(userId) {
    if (this.socket) {
      this.disconnect();
    }

    this.userId = userId;
    this.socket = io(GATEWAY_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('[Gateway] Connected to server');
      this.connected = true;
      
      // Subscribe to user's BLE events
      this.socket.emit('subscribe', { userId: this.userId });
    });

    this.socket.on('disconnect', () => {
      console.log('[Gateway] Disconnected from server');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Gateway] Connection error:', error.message);
    });

    // Listen for BLE events from Gateway
    this.socket.on('ble_event', (data) => {
      console.log('[Gateway] BLE event received:', data);
      this.notifySubscribers(data);
    });

    return this.socket;
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.subscribers = [];
    }
  }

  // Check connection status
  isConnected() {
    return this.connected;
  }

  // Get Gateway URL
  getGatewayUrl() {
    return GATEWAY_URL;
  }
}

// Export singleton instance
const gatewayClient = new GatewayClient();
export default gatewayClient;
