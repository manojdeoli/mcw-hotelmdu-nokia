# BLE Configuration Architecture - Visual Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MWC BOOTH SETUP                              │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ HotelGate    │  │ HotelKiosk   │  │ HotelElevator│              │
│  │ BLE Beacon   │  │ BLE Beacon   │  │ BLE Beacon   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
│         └──────────────────┴──────────────────┘                      │
│                            │                                          │
│                    BLE Broadcasts                                    │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ANDROID TABLET (Gateway)                          │
│                                                                       │
│  MainActivity.java - BLE Scanner                                     │
│    - Mode: LOW_LATENCY (fastest, ~1 Hz)                             │
│    - Hardware Filters: 8 allowed devices                             │
│    ⚠️ SCAN FREQUENCY CONTROLLED HERE (not in React app)             │
│                            │                                          │
│  GatewayServer.java - WebSocket Server (Port 8080)                  │
│    - Broadcasts to all connected clients                             │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                    WebSocket Connection
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REACT APP (Hotel Dashboard)                       │
│                                                                       │
│  gatewayClient.js → App.js → rssiProcessor.js                       │
│                                                                       │
│  Configuration (from proximityConfig.js):                            │
│    ✅ bufferSize: 3 readings                                        │
│    ✅ entryStabilityMs: 500ms                                       │
│    ✅ exitStabilityMs: 2000ms                                       │
│    ✅ entryThreshold: -55 dBm                                       │
│    ✅ exitThreshold: -60 dBm                                        │
│                            │                                          │
│  Reads from: .env.proximity file                                     │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION SYSTEM                              │
│                                                                       │
│  CONFIGURE_PROXIMITY.bat → .env.proximity                           │
│                                                                       │
│  ✅ NO CODE REBUILD REQUIRED                                        │
│  ✅ JUST RESTART REACT APP (~30 seconds)                            │
└───────────────────────────────────────────────────────────────────────┘
```

## Oliver's 4 Parameters - Status

| Parameter | Status | Configurable Via |
|-----------|--------|------------------|
| 1. RSSI Threshold | ✅ DONE | CONFIGURE_PROXIMITY.bat |
| 2. Sampling Interval | ⚠️ CLARIFY | Android controls, not React |
| 3. Buffer Size | ✅ DONE | CONFIGURE_PROXIMITY.bat |
| 4. Stability Time | ✅ DONE | CONFIGURE_PROXIMITY.bat |

## Configuration Parameters Explained

### Buffer Size (Number of Samples)

**Small Buffer (3):**
- Fast response (~1 second)
- More noise sensitivity
- Good for MWC demo

**Large Buffer (15):**
- Slow response (~3 seconds)
- Better noise rejection
- Good for high interference

### Entry Stability Time

**Short (500ms):**
- Fast detection
- Risk of false positives

**Long (2000ms):**
- Slow detection
- Better false positive rejection

### Entry Threshold

**Strict (-55 dBm):**
- Only very close proximity (~1 meter)
- Prevents detecting multiple beacons

**Relaxed (-65 dBm):**
- Larger detection area (~2 meters)
- Risk of detecting all beacons

## On-Site Configuration (2 Minutes)

```
1. Stop React App (Ctrl+C)
2. Run CONFIGURE_PROXIMITY.bat
3. Select preset or custom values
4. Restart React App (npm start)
5. Test detection
```

## Key Takeaway

**You already have everything Oliver asked for** except clarification on "sampling interval" which is controlled by Android BLE scanner, not React app.
