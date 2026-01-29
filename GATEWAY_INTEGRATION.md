# React App - Gateway Integration

## Changes Made

### 1. **Removed Android WebView Dependencies**
   - Removed `bleBridge.js` dependency
   - No longer requires Android app wrapper
   - Pure web application

### 2. **Added Gateway Client**
   - New file: `src/gatewayClient.js`
   - WebSocket connection to Gateway Server
   - Real-time BLE event streaming

### 3. **Updated App.js**
   - Connects to Gateway when phone verified
   - Subscribes to BLE events via WebSocket
   - Processes beacon detections from Gateway

## Configuration

### Local Testing

1. **Start Gateway Server** (in separate terminal):
```bash
cd ../ble-gateway-server
npm start
```

2. **Start React App**:
```bash
npm start
```

3. **Access**: http://localhost:3000

### Production Deployment

1. **Update Gateway URL** in `.env`:
```env
REACT_APP_GATEWAY_URL=https://your-gateway-server.com
```

2. **Build React App**:
```bash
npm run build
```

3. **Deploy** `build/` folder to:
   - On-premise web server (Nginx/Apache)
   - AWS S3 + CloudFront
   - Netlify / Vercel
   - Azure Static Web Apps

## How It Works

```
1. User verifies phone number
   ↓
2. React app connects to Gateway Server via WebSocket
   ↓
3. Gateway subscribes React app to user's BLE events
   ↓
4. Android BLE Scanner sends beacon data to Gateway
   ↓
5. Gateway processes and forwards to React app
   ↓
6. React app updates UI with zone/location
```

## Testing Without Android Scanner

You can test the Gateway integration using the Gateway Server's REST API:

```bash
# Simulate BLE scan
curl -X POST http://localhost:3001/api/ble/scan \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "+61412345678",
    "beaconName": "HotelGate",
    "rssi": -65
  }'
```

The React app will receive the event via WebSocket and update the UI.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| REACT_APP_GATEWAY_URL | Gateway Server WebSocket URL | http://localhost:3001 |

## Features

- ✅ Real-time BLE event streaming
- ✅ Automatic reconnection
- ✅ Multi-device support
- ✅ Zone-based beacon detection
- ✅ RSSI smoothing (handled by Gateway)
- ✅ Works on any device (desktop, mobile, tablet)

## Next Steps

1. Deploy Gateway Server to cloud
2. Update `REACT_APP_GATEWAY_URL` in `.env`
3. Build and deploy React app
4. Create Android BLE Scanner app
5. Test end-to-end flow
