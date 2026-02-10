# BLE Beacon Filtering Configuration

## Overview
The gateway server now filters BLE advertisements to only process specific hotel beacons, preventing interference from thousands of devices at the MCW event.

## Allowed Devices

### Hotel Beacon Names
The gateway will only process beacons with these exact names:
- `HotelGate` - Hotel entrance gate
- `HotelKiosk` - Check-in kiosk
- `HotelElevator` - Elevator lobby
- `HotelRoom` - Guest room door

### Easy Reach Devices
The gateway also accepts Easy Reach devices and maps them to hotel zones:

| Device ID | Mapped To | Zone Description |
|-----------|-----------|------------------|
| ER26B00001 | HotelGate | Hotel entrance gate |
| ER26B00002 | HotelKiosk | Check-in kiosk |
| ER26B00003 | HotelElevator | Elevator lobby |
| ER26B00004 | HotelRoom | Guest room door |

## How It Works

### 1. Device Filtering
The `isAllowedDevice()` method checks if a detected beacon matches:
- One of the 4 hotel beacon names (HotelGate, HotelKiosk, HotelElevator, HotelRoom)
- One of the 4 Easy Reach device IDs (ER26B00001-ER26B00004)

If the device doesn't match, it's ignored completely.

### 2. Device Mapping
The `mapDeviceToZone()` method automatically converts Easy Reach device IDs to their corresponding hotel zone names:
- ER26B00001 → HotelGate
- ER26B00002 → HotelKiosk
- ER26B00003 → HotelElevator
- ER26B00004 → HotelRoom

### 3. Event Broadcasting
Only filtered and mapped devices are broadcast to connected clients (React app).

## Benefits

✅ **Noise Reduction**: Ignores thousands of other BLE devices at MCW event
✅ **Consistent Naming**: Easy Reach devices appear with standard hotel zone names
✅ **Reliable Tracking**: Only processes intended beacons for guest journey
✅ **Performance**: Reduces processing overhead by filtering early

## Configuration

### Adding New Devices
To add more allowed devices, update the `isAllowedDevice()` method:

```java
// Add new hotel beacon
if (deviceName.equals("HotelNewZone")) {
    return true;
}

// Add new Easy Reach device
if (deviceName.equals("ER26B00005")) {
    return true;
}
```

### Adding New Mappings
To map new Easy Reach devices, update the `mapDeviceToZone()` method:

```java
case "ER26B00005":
    return "HotelNewZone";
```

## Testing

### Verify Filtering
1. Start the gateway service
2. Check logs for "BLE Event:" messages
3. Confirm only allowed devices appear
4. Verify Easy Reach devices show mapped names

### Expected Log Output
```
BLE Event: {"deviceId":"XX:XX:XX:XX:XX:XX","beaconName":"HotelGate","rssi":-65,"zone":"HotelGate","timestamp":1234567890}
BLE Event: {"deviceId":"YY:YY:YY:YY:YY:YY","beaconName":"HotelKiosk","rssi":-72,"zone":"HotelKiosk","timestamp":1234567891}
```

## Notes

- Device names must match **exactly** (case-sensitive)
- Unknown devices are completely ignored (not logged)
- Mapping happens before broadcasting to clients
- React app receives consistent zone names regardless of physical device type
