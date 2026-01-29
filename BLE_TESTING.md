# BLE Testing Guide

## Without Real Beacons
1. Install "BLE Scanner" app on another phone
2. Set device name to "Hotel_Gate", "Hotel_Kiosk", etc.
3. Enable advertising mode
4. Test proximity detection

## With Real Beacons
1. Configure iBeacon/Eddystone with hotel names
2. Place beacons at different locations
3. Walk between beacons to test zone transitions
4. Monitor RSSI values in app logs

## Expected Behavior
- Manual Scan: Single beacon detection
- Auto Scan: Continuous monitoring
- Zone Detection: Gate → Kiosk → Elevator → Room
- Hotel Actions: Check-in, elevator access, room unlock