# End-to-End Testing Guide - Complete Cloud Setup

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CLOUD SERVICES                     │
│                                                     │
│  ┌──────────────────────┐  ┌────────────────────┐  │
│  │   Railway.app        │  │   Vercel.com       │  │
│  │   Gateway Server     │  │   React Web App    │  │
│  │   (WebSocket)        │  │   (Frontend)       │  │
│  └──────────┬───────────┘  └─────────┬──────────┘  │
└─────────────┼──────────────────────────┼────────────┘
              │                          │
              │ WebSocket                │ HTTPS
              │                          │
    ┌─────────┴──────────┐      ┌────────┴─────────┐
    │                    │      │                  │
┌───┴────────┐    ┌──────┴───┐  │  ┌──────────────┴┐
│  Phone 1   │    │ Phone 2  │  │  │  Any Device   │
│    BLE     │    │  Beacon  │  │  │  (Laptop/     │
│  Scanner   │    │Simulator │  │  │   Phone)      │
│   (APK)    │    │(nRF App) │  │  │  React App    │
└────────────┘    └──────────┘  │  └───────────────┘
                                │
                         ┌──────┴──────┐
                         │  Phone 3    │
                         │  React App  │
                         └─────────────┘
```

## Prerequisites

### 1. Gateway Server (Railway)
- ✅ Deployed at: `https://web.production-f04c1.up.railway.app`
- ✅ Status: Active
- ✅ Test: Visit `/health` endpoint

### 2. React App (Vercel)
- ⏳ Deploy now (see VERCEL_DEPLOYMENT.md)
- ⏳ URL: `https://hotel-mdu1.vercel.app`
- ⏳ Environment variable: `REACT_APP_GATEWAY_URL` set to Railway URL

### 3. BLE Scanner App (Android)
- ✅ APK built
- ⏳ Install on Phone 1
- ⏳ Configure Gateway URL

### 4. Beacon Simulator (nRF Connect)
- ⏳ Install on Phone 2
- ⏳ Configure device name

## Setup Steps

### Step 1: Deploy React App to Vercel

1. Go to https://vercel.com
2. Login with GitHub
3. Import project: `manojdeoli/hotel-mdu1`
4. Add environment variable:
   - Key: `REACT_APP_GATEWAY_URL`
   - Value: `https://web.production-f04c1.up.railway.app`
5. Deploy
6. Get URL: `https://hotel-mdu1.vercel.app`

### Step 2: Install BLE Scanner on Phone 1

1. Transfer APK to Phone 1
2. Install APK
3. Grant permissions (Bluetooth, Location)
4. Configure:
   - Phone: `+61400500800`
   - Gateway URL: `https://web.production-f04c1.up.railway.app`

### Step 3: Setup Beacon Simulator on Phone 2

1. Install nRF Connect from Play Store
2. Open app → Advertiser tab
3. Create new advertising packet
4. Set device name: `HotelGate`
5. Start advertising

### Step 4: Open React App on Any Device

**Option A: Personal Laptop**
- Open browser
- Visit: `https://hotel-mdu1.vercel.app`

**Option B: Phone 3**
- Open browser
- Visit: `https://hotel-mdu1.vercel.app`

**Option C: Corporate Laptop**
- Open browser
- Visit: `https://hotel-mdu1.vercel.app`

## End-to-End Test

### Test 1: Gateway Server Health

**Action:** Visit `https://web.production-f04c1.up.railway.app/health`

**Expected Result:**
```json
{
  "status": "ok",
  "devices": 0,
  "webClients": 0,
  "timestamp": "2024-01-29T..."
}
```

### Test 2: React App Loads

**Action:** Visit `https://hotel-mdu1.vercel.app`

**Expected Result:**
- App loads successfully
- Shows "Hotels/MDUs Use Case Demo" header
- Shows phone verification form

### Test 3: BLE Scanner Connects

**On Phone 1 (BLE Scanner):**
1. Open BLE Scanner app
2. Phone: `+61400500800`
3. Gateway URL: `https://web.production-f04c1.up.railway.app`
4. Click "Connect to Gateway"

**Expected Result:**
- Status: "Connected to Gateway"
- Log: "Connected to Gateway"
- Log: "Device registered successfully"
- "Start Scanning" button enabled

**Check Railway Logs:**
```
[WebSocket] Client connected: <socket-id>
[Device] Registered: +61400500800
```

### Test 4: React App Connects

**On Any Device (React App):**
1. Enter phone: `+61400500800`
2. Click "Verify Phone"
3. Wait for connection

**Expected Result:**
- Success message: "Phone number is verified"
- Activity log: "Connected to Gateway: https://web.production-f04c1.up.railway.app"

**Check Railway Logs:**
```
[WebSocket] Client connected: <socket-id>
[Web Client] Subscribed to user: +61400500800
```

**Check Browser Console (F12):**
```
[Gateway] Connected to server
```

### Test 5: Start Auto-Tracking

**On React App:**
1. Scroll to "MWC Location Access (BLE)" section
2. Click "Start Auto-Tracking"

**Expected Result:**
- Button changes to "Stop Auto-Tracking"
- Activity log: "Starting Auto-Tracking (Gateway WebSocket)..."

### Test 6: Start BLE Scanning

**On Phone 1 (BLE Scanner):**
1. Click "Start Scanning"

**Expected Result:**
- Status: "Scanning for beacons..."
- Button changes to "Stop Scanning"
- Log: "Started BLE scanning"

### Test 7: Start Beacon Broadcasting

**On Phone 2 (nRF Connect):**
1. Go to Advertiser tab
2. Tap Play button on "HotelGate" packet

**Expected Result:**
- Shows "Advertising..."
- Green indicator

### Test 8: Beacon Detection

**Bring Phone 2 close to Phone 1 (within 5 meters)**

**On Phone 1 (BLE Scanner):**
- Log should show: "Detected: HotelGate (RSSI: -XX)"

**Check Railway Logs:**
```
[BLE] +61400500800 detected HotelGate (RSSI: -65)
```

**On React App:**
- Activity log: "BLE Event: Hotel Entry Gate (RSSI: -65)"
- Activity log: "Context: User arrived at Entry Gate."
- Map updates to show user at hotel location

**Browser Console:**
```
[Gateway] BLE event received: {beaconName: "HotelGate", rssi: -65, zone: "Hotel Entry Gate"}
```

### Test 9: Test Different Zones

**Change beacon name on Phone 2:**

**Test Kiosk:**
1. Stop advertising
2. Change device name to: `HotelKiosk`
3. Start advertising
4. React app should show: "Check-in Kiosk"

**Test Elevator:**
1. Change device name to: `HotelElevator`
2. React app should show: "Elevator Lobby"

**Test Room:**
1. Change device name to: `HotelRoom`
2. React app should show: "Room 1337"

### Test 10: Multiple Clients

**Open React App on multiple devices:**
- Laptop: `https://hotel-mdu1.vercel.app`
- Phone 3: `https://hotel-mdu1.vercel.app`
- Phone 4: `https://hotel-mdu1.vercel.app`

**All use same phone number:** `+61400500800`

**Expected Result:**
- All devices receive same BLE events
- All devices update simultaneously
- Real-time synchronization

## Success Criteria

✅ **Gateway Server:**
- Health endpoint returns OK
- Accepts WebSocket connections
- Logs show device registrations
- Logs show BLE events

✅ **BLE Scanner:**
- Connects to Railway Gateway
- Detects beacons
- Sends data to Gateway
- Shows detection logs

✅ **React App:**
- Loads from Vercel
- Connects to Railway Gateway
- Receives BLE events
- Updates UI in real-time
- Works on any device

✅ **End-to-End Flow:**
- Beacon detected by BLE Scanner
- Data sent to Railway Gateway
- Gateway processes and maps zone
- React App receives event
- UI updates with location

## Troubleshooting

### Gateway Server Issues

**Problem:** Health endpoint doesn't work
**Solution:** Check Railway dashboard, service might be sleeping

**Problem:** WebSocket connection fails
**Solution:** Check Railway logs for errors

### BLE Scanner Issues

**Problem:** Can't connect to Gateway
**Solution:** 
- Check Gateway URL is correct
- Check internet connection
- Check Railway service is active

**Problem:** Not detecting beacons
**Solution:**
- Check Bluetooth is ON
- Check Location permission granted
- Check beacon is actually advertising

### React App Issues

**Problem:** App doesn't load
**Solution:**
- Check Vercel deployment status
- Check browser console for errors
- Try different browser

**Problem:** Can't connect to Gateway
**Solution:**
- Check environment variable is set
- Check Gateway URL in browser console
- Check Railway service is active

**Problem:** Not receiving BLE events
**Solution:**
- Check "Start Auto-Tracking" is clicked
- Check phone numbers match
- Check browser console for errors

## Demo Script

### For Stakeholders:

**1. Introduction (1 min)**
"This is a hotel guest tracking system using BLE beacons and cloud services."

**2. Show Architecture (1 min)**
"We have three components:
- BLE Scanner on phone (detects beacons)
- Gateway Server on Railway (processes data)
- React App on Vercel (displays location)"

**3. Live Demo (5 min)**

**Step 1:** Show React app on laptop
- "This is the guest dashboard, accessible from any device"

**Step 2:** Show BLE Scanner on phone
- "This app scans for BLE beacons in the hotel"

**Step 3:** Show beacon simulator
- "This simulates a beacon at the hotel entrance"

**Step 4:** Demonstrate detection
- "When the guest approaches the entrance..."
- Move phones close together
- "The system detects their location in real-time"

**Step 5:** Show different zones
- Change beacon name
- "Now they're at the check-in kiosk"
- "Now at the elevator"
- "Now at their room door"

**4. Highlight Features (2 min)**
- Real-time tracking
- Cloud-based (no local servers)
- Works on any device
- Scalable to multiple guests
- Secure WebSocket communication

**5. Q&A**

## Next Steps

After successful testing:

1. **Production Deployment:**
   - Use real BLE beacons
   - Configure production domains
   - Add authentication
   - Add database for tracking history

2. **Scaling:**
   - Deploy multiple BLE scanners
   - Support multiple hotels
   - Add admin dashboard

3. **Features:**
   - Push notifications
   - Guest preferences
   - Automated check-in
   - Room access control

## Summary

**Current Setup:**
- ✅ Gateway Server: Railway (cloud)
- ⏳ React App: Vercel (cloud)
- ✅ BLE Scanner: Android APK
- ✅ Beacon Simulator: nRF Connect

**Testing:**
- All components in cloud
- No local servers needed
- No firewall issues
- Accessible from anywhere
- Production-ready architecture

**Ready to demo!** 🚀
