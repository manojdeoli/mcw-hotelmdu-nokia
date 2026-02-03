# Hotel MDU - OAuth & Nokia API Integration Restored

## Changes Made

### 1. OAuth Authentication (auth.js)
- Created AuthService class with OAuth flow methods
- Client credentials: f3a0e2b1-4c5d-6e7f-8a9b-0c1d2e3f4a5b
- Redirect URI: http://localhost:3000/callback
- Token validation with 30-second buffer
- Auto re-authentication on token expiry

### 2. Real Nokia API Integration (api.js)
- API Base URL: https://network-as-code.p-eu.rapidapi.com/passthrough/camara/v1
- API Key: 5f2dbafafamsh87b419851b02d59p1c9ce3jsncbbd0bf87a70
- Real implementations for:
  - verifyPhoneNumber (with OAuth token)
  - simSwap
  - deviceSwap
  - kycMatch (with storedKycFillData validation)
  - kycFill
  - locationRetrieval
  - locationVerification
  - carrierBilling
- BLE beacon detection system with waitForBeacon
- Booking & arrival sequence with auto-tracking
- Check-out sequence with carrier billing

### 3. Backend Proxy Server (server.js)
- Express server on port 3003
- /api/token-exchange endpoint for OAuth
- Handles CORS issues for token exchange

### 4. Proxy Middleware (setupProxy.js)
- Routes /api requests to localhost:3003
- Enables frontend to call backend without CORS issues

### 5. App.js Updates
- OAuth authentication state management
- Auto-authentication on first visit
- Token expiry countdown in header
- OAuth callback handling
- Authentication loading overlay
- Error display for auth failures

### 6. Package.json Updates
- Added dependencies:
  - express: ^4.18.2
  - cors: ^2.8.5
  - concurrently: ^8.2.2
  - http-proxy-middleware: ^2.0.6
- Added scripts:
  - "server": "node server.js"
  - "dev": "concurrently \"npm run server\" \"npm start\""

## How to Run

1. Install dependencies:
   ```
   npm install
   ```

2. Run both frontend and backend:
   ```
   npm run dev
   ```

   Or run separately:
   - Frontend: `npm start` (port 3000)
   - Backend: `npm run server` (port 3003)

## OAuth Flow

1. On first visit, app auto-triggers OAuth authentication
2. User redirected to Nokia authorization endpoint
3. After authorization, redirected back with code
4. Backend exchanges code for access token
5. Token stored in localStorage
6. Token validated before each API call
7. Auto re-authentication when token expires

## API Configuration

All API calls now use real Nokia CSP simulator endpoints with proper OAuth authorization headers.
