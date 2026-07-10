const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const https = require('https');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

// Function to read proximity configuration from .env.proximity file
function getProximityConfig() {
  const proximityEnvPath = path.join(__dirname, '.env.proximity');
  if (fs.existsSync(proximityEnvPath)) {
    try {
      const content = fs.readFileSync(proximityEnvPath, 'utf8');
      const config = {};
      content.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          const cleanKey = key.trim();
          const cleanValue = value.trim();
          if (cleanKey === 'REACT_APP_BLE_BUFFER_SIZE') config.bufferSize = cleanValue;
          if (cleanKey === 'REACT_APP_BLE_ENTRY_STABILITY_MS') config.entryStabilityMs = cleanValue;
          if (cleanKey === 'REACT_APP_BLE_EXIT_STABILITY_MS') config.exitStabilityMs = cleanValue;
          if (cleanKey === 'REACT_APP_BLE_ENTRY_THRESHOLD') config.entryThreshold = cleanValue;
          if (cleanKey === 'REACT_APP_BLE_EXIT_THRESHOLD') config.exitThreshold = cleanValue;
        }
      });
      console.log('[Server] Loaded proximity config from .env.proximity:', config);
      return config;
    } catch (error) {
      console.error('[Server] Error reading .env.proximity:', error);
    }
  }
  return null;
}

// Function to get Google Directions API key from .env file
function getGoogleApiKey() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const line = content.split('\n').find(l => l.startsWith('GOOGLE_DIRECTIONS_API_KEY='));
      if (line) return line.split('=')[1].trim();
    } catch (error) {
      console.error('[Server] Error reading Google API key from .env:', error);
    }
  }
  return null;
}

function getBeaconConfigUrl() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const line = content.split('\n').find(l => l.startsWith('REACT_APP_BEACON_CONFIG_URL='));
      if (line) return line.split('=').slice(1).join('=').trim();
    } catch (error) {
      console.error('[Server] Error reading beacon config URL from .env:', error);
    }
  }
  return null;
}

function getGatewayUrl() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      // Find ALL occurrences and use the LAST one — START_APP.bat uses append (>>)
      // so multiple runs produce duplicate lines; the last entry is always the
      // most recently entered IP.
      const lines = content.split('\n').filter(l => l.startsWith('REACT_APP_GATEWAY_URL='));
      if (lines.length > 0) {
        const raw = lines[lines.length - 1].split('=').slice(1).join('=').trim();
        // Collapse duplicate port repetitions e.g. :8080:8080 → :8080
        return raw.replace(/(:\d+)\1+/g, '$1');
      }
    } catch (error) {
      console.error('[Server] Error reading .env:', error);
    }
  }
  return null;
}

// Function to get classifier override from .env file
// Set by START_APP.bat when user selects classifier at terminal prompt.
// Valid values: 'RULE_BASED' | 'TREE_BASED'
function getClassifierOverride() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const line = content.split('\n').find(l => l.startsWith('REACT_APP_DEFAULT_CLASSIFIER='));
      if (line) {
        const value = line.split('=')[1].trim();
        if (['RULE_BASED', 'TREE_BASED'].includes(value)) return value;
      }
    } catch (error) {
      console.error('[Server] Error reading classifier override from .env:', error);
    }
  }
  return null;
}

const app = express();
const server = http.createServer(app); // Create HTTP server for WebSocket upgrade

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================================
// Phase 1: Device Advisory WebSocket Server
// Handles device connections and advisory delivery
// =============================================================================
const wss = new WebSocket.Server({ server, path: '/device-advisory' });
const deviceConnections = new Map(); // deviceId -> WebSocket connection
const advisoryTracking = new Map(); // journeyId -> { sent, acknowledged, deviceId, timestamps }

wss.on('connection', (ws, req) => {
  let deviceId = null;
  
  console.log('[DeviceWS] New connection from:', req.socket.remoteAddress);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'REGISTER') {
        deviceId = data.deviceId;
        if (!deviceId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'deviceId required for registration' }));
          return;
        }
        
        // Gap 3.4 Fix: Validate deviceId format (UUID or test format)
        const isValidDeviceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId) ||
                               deviceId.startsWith('test-') || deviceId.startsWith('demo-') ||
                               deviceId.length >= 8; // Allow phone numbers for backward compatibility
        
        if (!isValidDeviceId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid deviceId format' }));
          return;
        }
        
        // Store connection
        deviceConnections.set(deviceId, ws);
        console.log(`[DeviceWS] Device registered: ${deviceId.substring(0, 8)}...`);
        
        // Send confirmation
        ws.send(JSON.stringify({
          type: 'REGISTERED',
          deviceId,
          timestamp: Date.now()
        }));
        
      } else if (data.type === 'ACK') {
        // Gap 3.3 Fix: Track advisory acknowledgements
        console.log(`[DeviceWS] Advisory ACK received from ${deviceId}:`, data);
        
        if (data.journeyId) {
          const tracking = advisoryTracking.get(data.journeyId);
          if (tracking) {
            tracking.acknowledged = true;
            tracking.acknowledgedAt = Date.now();
            tracking.responseTimeMs = tracking.acknowledgedAt - tracking.sentAt;
            advisoryTracking.set(data.journeyId, tracking);
            
            console.log(`[DeviceWS] Advisory acknowledged for journey ${data.journeyId} (${tracking.responseTimeMs}ms response time)`);
          }
        }
        
      } else if (data.type === 'VALIDATION_RESULT') {
        console.log(`[DeviceWS] Validation result received from ${deviceId}:`, data);
        
        // Store validation result
        if (data.journeyId && data.validationStatus) {
          const result = {
            deviceId: deviceId || data.deviceId,
            journeyId: data.journeyId,
            validationStatus: data.validationStatus,
            method: data.method || 'UNKNOWN',     // BLE | BIOMETRIC | NFC
            tagId: data.tagId || null,             // NFC: uppercase hex UID, e.g. "A3F204BC"
            timestamp: data.timestamp || Date.now(),
            receivedAt: new Date().toISOString()
          };
          
          validationResults.set(data.journeyId, result);
          console.log(`[DeviceWS] Stored validation result for journey ${data.journeyId} method=${result.method}${result.tagId ? ' tagId=' + result.tagId : ''}`);
        }
        
      } else {
        console.log(`[DeviceWS] Unknown message type from ${deviceId}:`, data.type);
      }
      
    } catch (error) {
      console.error('[DeviceWS] Message parsing error:', error);
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
    }
  });
  
  ws.on('close', () => {
    if (deviceId) {
      deviceConnections.delete(deviceId);
      console.log(`[DeviceWS] Device disconnected: ${deviceId.substring(0, 8)}...`);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`[DeviceWS] Connection error for ${deviceId}:`, error);
  });
});

// Function to send advisory to specific device
function sendAdvisoryToDevice(deviceId, advisory) {
  const connection = deviceConnections.get(deviceId);
  
  if (!connection || connection.readyState !== WebSocket.OPEN) {
    console.warn(`[DeviceWS] Cannot send advisory to ${deviceId.substring(0, 8)}... - not connected`);
    return false;
  }
  
  try {
    const message = {
      type: 'ADVISORY',
      payload: advisory,
      timestamp: Date.now()
    };
    
    // Gap 3.3 Fix: Track advisory as sent
    advisoryTracking.set(advisory.journeyId, {
      sent: true,
      acknowledged: false,
      sentAt: Date.now(),
      deviceId: deviceId
    });
    
    connection.send(JSON.stringify(message));
    console.log(`[DeviceWS] Advisory sent to ${deviceId.substring(0, 8)}...:`, {
      journeyId:            advisory.journeyId,
      stage:                advisory.stage,
      validationRequired:   advisory.validationRequired,
      validationSignal:     advisory.validationSignal,
      correlationConfidence: advisory.correlationConfidence,
      ambiguity:            advisory.ambiguity,
      reason:               advisory.reason,
    });
    
    return true;
  } catch (error) {
    console.error(`[DeviceWS] Failed to send advisory to ${deviceId.substring(0, 8)}...:`, error);
    return false;
  }
}

// Expose function for API endpoints
app.sendAdvisoryToDevice = sendAdvisoryToDevice;

app.get('/redirect', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    res.redirect(`/?error=${encodeURIComponent(error)}`);
  } else if (code) {
    res.redirect(`/?code=${encodeURIComponent(code)}`);
  } else {
    res.redirect('/');
  }
});

app.post('/api/token-exchange', async (req, res) => {
  try {
    const { tokenEndpoint, authHeader, body } = req.body;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader
      },
      body: body,
      agent: new https.Agent({ rejectUnauthorized: false })
    });
    const responseText = await response.text();
    if (response.ok) {
      res.json(JSON.parse(responseText));
    } else {
      res.status(response.status).json({ error: responseText });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Push beacon config server URL to Android app via WebSocket
// Called once after server starts — Android app stores it in SharedPreferences
// and uses it for all subsequent beacon config fetches
app.post('/config/push-server-url', (req, res) => {
  const beaconConfigUrl = getBeaconConfigUrl();
  if (!beaconConfigUrl) {
    return res.status(404).json({ error: 'REACT_APP_BEACON_CONFIG_URL not set in .env' });
  }
  // Broadcast to all connected WebSocket clients (the Android BLE scanner)
  let sent = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'SERVER_URL', beaconConfigUrl }));
      sent++;
    }
  });
  console.log('[BeaconConfig] Pushed server URL to', sent, 'device(s):', beaconConfigUrl);
  res.json({ pushed: true, beaconConfigUrl, clients: sent });
});

// Beacon device configuration endpoint — read by Android app on startup
// Serves beacon_config.json written by CONFIGURE_BEACONS.bat
// Returns 404 if no custom config — Android falls back to hardcoded defaults
app.get('/config/beacons', (req, res) => {
  const configPath = path.join(__dirname, 'beacon_config.json');
  if (!fs.existsSync(configPath)) {
    return res.status(404).json({ error: 'No custom beacon config — using device defaults' });
  }
  try {
    const json = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(json);
    console.log('[BeaconConfig] Served config version:', config.version, '(' + (config.beacons?.length ?? 0) + ' entries)');
    res.setHeader('Content-Type', 'application/json');
    res.send(json);
  } catch (err) {
    console.error('[BeaconConfig] Error reading beacon_config.json:', err.message);
    res.status(500).json({ error: 'Failed to read beacon config' });
  }
});

// Live reload — push updated beacon_config.json to connected Android app immediately.
// Called by CONFIGURE_BEACONS.bat after writing a new entry so the app updates
// without requiring a restart.
// Connects to the Android app's WebSocket on port 8080 and sends the raw JSON.
// GatewayServer.onMessage() detects the "beacons" key and routes to
// BLEScanService.onBeaconConfigReceived() which applies + restarts scan filters.
app.post('/config/beacons/reload', (req, res) => {
  const configPath = path.join(__dirname, 'beacon_config.json');
  if (!fs.existsSync(configPath)) {
    return res.status(404).json({ error: 'No beacon_config.json to push' });
  }
  let json;
  try {
    json = fs.readFileSync(configPath, 'utf8');
    JSON.parse(json); // validate before pushing
  } catch (err) {
    return res.status(500).json({ error: 'Invalid beacon_config.json: ' + err.message });
  }

  const gatewayUrl = getGatewayUrl(); // e.g. http://192.168.1.100:8080
  if (!gatewayUrl) {
    return res.status(503).json({ error: 'REACT_APP_GATEWAY_URL not set — cannot reach Android app' });
  }

  // Connect to Android app WebSocket (NanoWSD on port 8080) and send config JSON
  const wsUrl = gatewayUrl.replace(/^http/, 'ws') + '/';
  const wsClient = new WebSocket(wsUrl);
  let responded = false;

  wsClient.on('open', () => {
    wsClient.send(json);
    wsClient.close();
    if (!responded) {
      responded = true;
      const version = JSON.parse(json).version || 'unknown';
      console.log('[BeaconConfig] Live reload pushed to Android app, version:', version);
      res.json({ pushed: true, version, target: wsUrl });
    }
  });

  wsClient.on('error', (err) => {
    if (!responded) {
      responded = true;
      console.warn('[BeaconConfig] Could not reach Android app:', err.message);
      res.status(503).json({
        pushed: false,
        error: 'Android app not reachable: ' + err.message,
        note: 'Config saved — will apply on next app start'
      });
    }
  });

  // Timeout after 5s
  setTimeout(() => {
    if (!responded) {
      responded = true;
      wsClient.terminate();
      res.status(504).json({ pushed: false, error: 'Timeout connecting to Android app' });
    }
  }, 5000);
});

// Development mode proximity configuration endpoint
app.get('/api/proximity-config', (req, res) => {
  const proximityConfig = getProximityConfig();
  const gatewayUrl = getGatewayUrl();
  
  res.json({
    proximityConfig: proximityConfig,
    gatewayUrl: gatewayUrl,
    timestamp: Date.now()
  });
});

// =============================================================================
// Google Directions proxy
// Forwards requests to Google Maps Directions API server-side to avoid CORS.
// GET /api/transport/directions?origin=...&destination=...&mode=...&transit_mode=...
// =============================================================================
app.get('/api/transport/directions', async (req, res) => {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    console.error('[Directions] GOOGLE_DIRECTIONS_API_KEY not found in .env');
    return res.status(503).json({ error: 'Google API key not configured on server' });
  }
  try {
    const { origin, destination, mode, transit_mode, departure_time } = req.query;
    let url = `https://maps.googleapis.com/maps/api/directions/json` +
              `?origin=${encodeURIComponent(origin)}` +
              `&destination=${encodeURIComponent(destination)}` +
              `&mode=${mode}` +
              `&departure_time=${departure_time || 'now'}` +
              `&key=${apiKey}`;
    if (transit_mode) url += `&transit_mode=${transit_mode}`;

    console.log(`[Directions] ${mode}${transit_mode ? '+' + transit_mode : ''} | ${origin} → ${destination}`);
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Directions] Fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// Phase 3: Explainability API
// In-memory store — payloads pushed by React app after each journey completes.
// GET  /api/transport/explain           — list all payloads
// GET  /api/transport/explain/:journeyId — retrieve single payload
// POST /api/transport/explain           — React app pushes payload
// =============================================================================
const explainabilityStore = new Map();

// =============================================================================
// Gap 3.3 & 3.4 Fix: Device Registration and Validation Result Storage
// =============================================================================
const deviceSessions = new Map(); // deviceId -> session info
const validationResults = new Map(); // journeyId -> validation result

app.post('/api/transport/explain', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.journeyId) {
    return res.status(400).json({ error: 'journeyId required' });
  }
  explainabilityStore.set(payload.journeyId, { ...payload, receivedAt: new Date().toISOString() });
  console.log(`[Explainability] Stored payload for journeyId=${payload.journeyId}`);
  res.status(201).json({ stored: true, journeyId: payload.journeyId });
});

app.get('/api/transport/explain/:journeyId', (req, res) => {
  const payload = explainabilityStore.get(req.params.journeyId);
  if (!payload) {
    return res.status(404).json({ error: `No explainability data for journeyId=${req.params.journeyId}` });
  }
  res.json(payload);
});

app.get('/api/transport/explain', (req, res) => {
  const all = [...explainabilityStore.values()].reverse();
  res.json({ count: all.length, payloads: all });
});

// =============================================================================
// Gap 3.3 Fix: Device Registration Endpoint
// POST /api/device/register
// =============================================================================
app.post('/api/device/register', (req, res) => {
  const { deviceId, userId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId required' });
  }

  const session = {
    deviceId,
    userId: userId || null,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    isConnected: deviceConnections.has(deviceId),
    journeyId: null
  };

  deviceSessions.set(deviceId, session);
  console.log(`[Device] Registered deviceId=${deviceId}, userId=${userId}, connected=${session.isConnected}`);
  
  res.status(201).json({ registered: true, deviceId, session });
});

// =============================================================================
// Phase 1: Device Advisory Endpoint
// POST /api/device/advisory
//
// Receives the pre-built advisory from DeviceAdvisoryService (frontend) and
// forwards it to the connected Android device via WebSocket.
// Does NOT rebuild the advisory — that is the frontend service's responsibility.
// =============================================================================
app.post('/api/device/advisory', (req, res) => {
  const {
    deviceId,
    journeyId,
    stage,
    validationRequired,
    validationSignal,
    correlationConfidence,
    ambiguity,
    inferredMode,
    reason,
    expiresInMs,
  } = req.body;

  if (!deviceId || !journeyId) {
    return res.status(400).json({ error: 'deviceId and journeyId required' });
  }

  // Reconstruct the clean advisory payload to forward to device.
  // Canonical rule enforced: validationRequired === (ambiguity === true)
  const advisory = {
    journeyId,
    deviceId,
    stage:                stage                ?? 'EXIT',
    validationRequired:   validationRequired   ?? false,
    validationSignal:     validationSignal      ?? 'CLEAR',
    correlationConfidence: correlationConfidence ?? 'HIGH',
    ambiguity:            ambiguity             ?? false,
    inferredMode:         inferredMode          ?? 'UNKNOWN',
    reason:               reason                ?? 'HIGH_CONFIDENCE',
    expiresInMs:          expiresInMs           ?? 30000,
    timestamp:            Date.now(),
    // simulation is passed through unchanged — never constructed here.
    // Absent in production requests; present only for demo simulation flows.
    simulation:           req.body.simulation   ?? null,
  };

  // Check device connectivity and send
  const isConnected = deviceConnections.has(deviceId);

  if (isConnected) {
    const sent = sendAdvisoryToDevice(deviceId, advisory);

    if (sent) {
      const session = deviceSessions.get(deviceId);
      if (session) {
        session.journeyId = journeyId;
        session.lastSeen  = new Date().toISOString();
        deviceSessions.set(deviceId, session);
      }
      res.status(200).json({
        advisory,
        sent:     true,
        strategy: 'HYBRID',
        message:  'Advisory sent to device successfully'
      });
    } else {
      res.status(500).json({
        advisory,
        sent:     false,
        strategy: 'NETWORK_ONLY',
        message:  'Failed to send advisory — connection issue'
      });
    }
  } else {
    // Gap 3.6: Fallback — device offline, journey proceeds network-only
    res.status(200).json({
      advisory,
      sent:             false,
      strategy:         'NETWORK_ONLY',
      fallback:         true,
      billingConfidence: 'MEDIUM',
      message:          'Device offline — fallback to network-only mode'
    });
  }
});

// =============================================================================
// Gap 3.4 Fix: Validation Result Endpoint
// POST /api/device/validation-result
// =============================================================================
app.post('/api/device/validation-result', (req, res) => {
  const { deviceId, journeyId, validationStatus, method, timestamp } = req.body;
  
  if (!deviceId || !journeyId || !validationStatus) {
    return res.status(400).json({ 
      error: 'deviceId, journeyId, and validationStatus required' 
    });
  }

  const { tagId } = req.body; // NFC card UID — present only for method=NFC

  const result = {
    deviceId,
    journeyId,
    validationStatus,             // SUCCESS | FAILED
    method: method || 'UNKNOWN',  // BLE | BIOMETRIC | NFC
    tagId: tagId || null,         // NFC: uppercase hex UID, e.g. "A3F204BC"
    timestamp: timestamp || Date.now(),
    receivedAt: new Date().toISOString()
  };

  validationResults.set(journeyId, result);
  
  // Update device session
  const session = deviceSessions.get(deviceId);
  if (session) {
    session.lastSeen = new Date().toISOString();
    session.journeyId = journeyId;
    deviceSessions.set(deviceId, session);
  }

  console.log(`[Validation] Result received: journeyId=${journeyId}, status=${validationStatus}, method=${method}${tagId ? ', tagId=' + tagId : ''}`);

  // Billing gate: validation required but not passed → manual review
  const validationRequired = req.body.validationRequired ?? false;
  const billingAction = (validationRequired && validationStatus !== 'SUCCESS')
    ? 'MANUAL_REVIEW'
    : 'AUTO_BILL';

  // Structured outcome field for clean frontend consumption
  const validationOutcome = validationStatus === 'SUCCESS' ? 'PASSED'
                          : validationStatus === 'FAILED'  ? 'FAILED'
                          : 'NOT_REQUIRED';

  res.status(201).json({
    stored:            true,
    journeyId,
    billingAction,
    validationOutcome,
    tagId:             tagId || null,
    message: billingAction === 'AUTO_BILL'
      ? `Validation ${validationOutcome} via ${method || 'UNKNOWN'} — journey approved for billing`
      : `Validation ${validationOutcome} via ${method || 'UNKNOWN'} — journey flagged for manual review`
  });
});

// =============================================================================
// Gap 3.4: Get Validation Result for Journey
// GET /api/device/validation-result/:journeyId
// =============================================================================
app.get('/api/device/validation-result/:journeyId', (req, res) => {
  const result = validationResults.get(req.params.journeyId);
  if (!result) {
    return res.status(404).json({ 
      error: `No validation result for journeyId=${req.params.journeyId}` 
    });
  }
  res.json(result);
});

// =============================================================================
// Gap 3.3: Advisory Tracking API
// GET /api/device/advisory-status/:journeyId
// =============================================================================
app.get('/api/device/advisory-status/:journeyId', (req, res) => {
  const tracking = advisoryTracking.get(req.params.journeyId);
  if (!tracking) {
    return res.status(404).json({ 
      error: `No advisory tracking for journeyId=${req.params.journeyId}`,
      status: 'NOT_SENT'
    });
  }
  
  let status = 'UNKNOWN';
  if (tracking.acknowledged) {
    status = 'ACKNOWLEDGED';
  } else if (tracking.sent) {
    const elapsed = Date.now() - tracking.sentAt;
    status = elapsed > 10000 ? 'TIMEOUT' : 'PENDING_ACK';
  } else {
    status = 'FAILED';
  }
  
  res.json({
    ...tracking,
    status,
    responseTime: tracking.responseTimeMs || null,
    elapsedMs: tracking.sentAt ? Date.now() - tracking.sentAt : null
  });
});

// =============================================================================
// Gap 3.3: Advisory ACK Endpoint (fallback for web)
// POST /api/device/advisory-ack
// =============================================================================
app.post('/api/device/advisory-ack', (req, res) => {
  const { journeyId, deviceId } = req.body;
  
  if (!journeyId || !deviceId) {
    return res.status(400).json({ error: 'journeyId and deviceId required' });
  }
  
  const tracking = advisoryTracking.get(journeyId);
  if (tracking) {
    tracking.acknowledged = true;
    tracking.acknowledgedAt = Date.now();
    tracking.responseTimeMs = tracking.acknowledgedAt - tracking.sentAt;
    advisoryTracking.set(journeyId, tracking);
    
    console.log(`[Advisory] ACK received via API for journey ${journeyId} (${tracking.responseTimeMs}ms response time)`);
    
    res.status(200).json({
      acknowledged: true,
      journeyId,
      responseTime: tracking.responseTimeMs
    });
  } else {
    res.status(404).json({ error: `No advisory found for journey ${journeyId}` });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(__dirname));
  
  app.get('*', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    
    // Get current configurations
    const gatewayUrl = getGatewayUrl() || process.env.REACT_APP_GATEWAY_URL || 'http://localhost:8080';
    const proximityConfig = getProximityConfig();
    const beaconConfigUrl = getBeaconConfigUrl();
    
    // Inject runtime configuration script
    const classifierOverride = getClassifierOverride();
    let configScript = '<script>';
    configScript += `window.GATEWAY_URL_OVERRIDE = '${gatewayUrl}'; console.log('[Runtime] Gateway URL set to:', '${gatewayUrl}');`;
    if (beaconConfigUrl) {
      configScript += `window.BEACON_CONFIG_URL = '${beaconConfigUrl}'; console.log('[Runtime] Beacon config URL set to:', '${beaconConfigUrl}');`;
    }
    if (proximityConfig) {
      configScript += `window.PROXIMITY_CONFIG_OVERRIDE = ${JSON.stringify(proximityConfig)}; console.log('[Runtime] Proximity config set to:', ${JSON.stringify(proximityConfig)});`;
    }
    if (classifierOverride) {
      configScript += `window.DEFAULT_CLASSIFIER_OVERRIDE = '${classifierOverride}'; console.log('[Runtime] Classifier set to:', '${classifierOverride}');`;
    }
    configScript += '</script>';
    
    html = html.replace('<head>', '<head>' + configScript);
    
    res.send(html);
  });
}

const PORT = process.env.PORT || 4002;
server.listen(PORT, () => {
  console.log(`🚀 Hotel API Server running on port ${PORT}`);
  console.log(`📱 Device Advisory WebSocket: ws://localhost:${PORT}/device-advisory`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('📱 React app: http://localhost:4001');
    console.log('🔧 API server: http://localhost:4002');
  }
});
