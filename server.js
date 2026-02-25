const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const https = require('https');
const fs = require('fs');

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

// Function to get gateway URL from .env file
function getGatewayUrl() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const gatewayLine = content.split('\n').find(line => line.startsWith('REACT_APP_GATEWAY_URL='));
      if (gatewayLine) {
        return gatewayLine.split('=')[1].trim();
      }
    } catch (error) {
      console.error('[Server] Error reading .env:', error);
    }
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(__dirname));
  
  app.get('*', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    
    // Get current configurations
    const gatewayUrl = getGatewayUrl() || process.env.REACT_APP_GATEWAY_URL || 'http://localhost:8080';
    const proximityConfig = getProximityConfig();
    
    // Inject runtime configuration script
    let configScript = '<script>';
    configScript += `window.GATEWAY_URL_OVERRIDE = '${gatewayUrl}'; console.log('[Runtime] Gateway URL set to:', '${gatewayUrl}');`;
    if (proximityConfig) {
      configScript += `window.PROXIMITY_CONFIG_OVERRIDE = ${JSON.stringify(proximityConfig)}; console.log('[Runtime] Proximity config set to:', ${JSON.stringify(proximityConfig)});`;
    }
    configScript += '</script>';
    
    html = html.replace('<head>', '<head>' + configScript);
    
    res.send(html);
  });
}

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  console.log(`🚀 Hotel API Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('📱 React app: http://localhost:4001');
    console.log('🔧 API server: http://localhost:4002');
  }
});
