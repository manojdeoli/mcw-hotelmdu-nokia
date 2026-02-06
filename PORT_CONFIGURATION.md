# Port Configuration

## Hotel Application Ports

This application is configured to run on the following ports to avoid conflicts with the healthcare application:

### Ports Used:
- **React App**: `4001` - Main hotel dashboard and kiosk interface
- **Gateway Server**: `4000` - WebSocket server for BLE beacon events
- **API Server**: `4002` - OAuth redirect and token exchange endpoints

### Healthcare Application Ports (for reference):
- **React App**: `3000`
- **Gateway Server**: `3001`
- **API Server**: `3003`

## Running Both Applications Simultaneously

You can now run both healthcare and hotel applications at the same time without port conflicts.

### Start Hotel Application:
```bash
# Terminal 1 - Start Gateway Server (port 4000)
cd gateway-server
npm start

# Terminal 2 - Start React App (port 4001) and API Server (port 4002)
cd mcw-hotelmdu-nokia-master
npm run dev
```

### Start Healthcare Application:
```bash
# Terminal 3 - Start Gateway Server (port 3001)
cd healthcare-gateway-server
npm start

# Terminal 4 - Start React App (port 3000) and API Server (port 3003)
cd healthcare-app
npm run dev
```

## Access URLs

### Hotel Application:
- Dashboard: http://localhost:4001
- Kiosk: http://localhost:4001/kiosk
- API Server: http://localhost:4002
- Gateway: ws://localhost:4000

### Healthcare Application:
- Dashboard: http://localhost:3000
- ER Dashboard: http://localhost:3000/er-dashboard
- API Server: http://localhost:3003
- Gateway: ws://localhost:3001

## Environment Variables

The `.env` file contains:
```
PORT=4001
REACT_APP_GATEWAY_URL=http://localhost:4000
```

## Notes

- Make sure to start the gateway server first before starting the React app
- The gateway server must be running on port 4000 for BLE beacon functionality
- Both applications can run simultaneously without any conflicts
