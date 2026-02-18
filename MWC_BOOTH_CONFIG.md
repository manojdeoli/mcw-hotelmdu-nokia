# MWC Small Booth Configuration

## ✅ Optimized for Small Booth Scenario

Your configuration is now **correctly set** for a small MWC booth where all beacons are close together.

---

## Current Default Settings

```javascript
Entry Threshold: -55 dBm  // Very close proximity (~1 meter)
Exit Threshold: -60 dBm   // Hysteresis
```

### **Why These Settings?**

**Problem:** In a small booth, if you stand in the center:
- All beacons are within 2-3 meters
- With relaxed thresholds (-70), ALL beacons would detect simultaneously ❌
- Demo flow breaks (can't distinguish which beacon user is near)

**Solution:** Strict thresholds (-55):
- Only detects beacon within ~1 meter ✅
- User must intentionally move close to specific beacon ✅
- Clear, sequential demo flow ✅

---

## RSSI Detection Behavior

| RSSI Value | Distance | Detection Status | Use Case |
|------------|----------|------------------|----------|
| -39 to -45 | < 0.5m | ✅ **DETECTED** | Touching beacon |
| -45 to -55 | 0.5-1m | ✅ **DETECTED** | Very close, intentional |
| -55 to -65 | 1-2m | ❌ NOT detected | Standing nearby |
| -65 to -75 | 2-3m | ❌ NOT detected | Across booth |
| < -75 | > 3m | ❌ NOT detected | Far away |

---

## MWC Booth Layout Example

```
┌─────────────────────────────────┐
│         MWC Booth (3m x 3m)     │
│                                 │
│  Gate      Kiosk                │
│   🔵        🔵                   │
│      (1m)                       │
│        👤 Person                │
│      (1m)                       │
│  Elevator  Room                 │
│   🔵        🔵                   │
│                                 │
└─────────────────────────────────┘
```

**With -55 threshold:**
- Person at center: NO beacons detected ✅
- Person moves to Gate beacon (< 1m): ONLY Gate detected ✅
- Person moves to Kiosk (< 1m): ONLY Kiosk detected ✅

**With -70 threshold (wrong for booth):**
- Person at center: ALL 4 beacons detected ❌
- Can't distinguish which beacon user is near ❌

---

## Configuration Presets

### 1. Default (MWC Booth) ✅ **RECOMMENDED**
```
Entry: -55 dBm (~1 meter, VERY CLOSE)
Exit: -60 dBm
Use: Small booth, beacons close together
```

### 2. Relaxed (Larger Area)
```
Entry: -65 dBm (~2 meters, CLOSE)
Exit: -70 dBm
Use: Larger booth or testing
```

### 3. Very Relaxed (Testing)
```
Entry: -70 dBm (~3 meters, MEDIUM)
Exit: -75 dBm
Use: Open area testing
```

---

## When to Adjust

### Use Default (-55) When:
✅ Small booth (< 5m x 5m)  
✅ Beacons close together (< 3m apart)  
✅ Need clear sequential detection  
✅ MWC demo scenario  

### Use Relaxed (-65) When:
- Larger booth (5m x 5m to 10m x 10m)
- Beacons further apart (3-5m)
- More forgiving detection needed

### Use Very Relaxed (-70) When:
- Open area testing
- Beacons far apart (> 5m)
- Development/debugging

---

## Testing Your Setup

### 1. Stand in Center of Booth
**Expected:** NO beacons detected  
**If all beacons detect:** Threshold too relaxed, use -55

### 2. Move Close to Gate Beacon (< 1m)
**Expected:** ONLY Gate beacon detected  
**If multiple beacons:** Threshold too relaxed

### 3. Move to Kiosk Beacon (< 1m)
**Expected:** Gate exits, ONLY Kiosk detected  
**If both detect:** Threshold too relaxed

### 4. Walk Between Beacons
**Expected:** Clear transitions, one at a time  
**If overlapping:** Threshold too relaxed

---

## Quick Adjustment at MWC

If detection behavior is wrong at venue:

### Too Sensitive (Multiple Beacons Detect)
```bash
# Already at strictest (-55)
# Solution: Increase beacon spacing or reduce beacon power
```

### Not Sensitive Enough (Must Touch Beacon)
```bash
CONFIGURE_PROXIMITY.bat
# Select: 2. Relaxed (Larger Area)
# Entry: -65 dBm (~2 meters)
npm start
```

### For Testing/Demo Prep
```bash
CONFIGURE_PROXIMITY.bat
# Select: 3. Very Relaxed (Testing)
# Entry: -70 dBm (~3 meters)
npm start
```

---

## Beacon Placement Tips

### Optimal Spacing for -55 Threshold:
- **Minimum:** 2 meters apart
- **Recommended:** 3 meters apart
- **Ideal:** 4+ meters apart

### Booth Layout:
```
Gate ←─── 3m ───→ Kiosk
  ↑                 ↑
  │                 │
 3m                3m
  │                 │
  ↓                 ↓
Elevator ←─ 3m ──→ Room
```

### Beacon Height:
- **Recommended:** 1-1.5 meters (waist to chest height)
- **Avoid:** Floor level (signal blocked by people)
- **Avoid:** Above 2m (too far from phone)

---

## Troubleshooting

### Problem: All Beacons Detect at Once

**Cause:** Beacons too close or threshold too relaxed

**Solutions:**
1. Increase beacon spacing to 3+ meters
2. Already using strictest threshold (-55)
3. Reduce beacon transmission power (if possible)
4. Use directional beacon placement

---

### Problem: Must Touch Beacon to Detect

**Cause:** Threshold too strict or weak beacon signal

**Solutions:**
```bash
CONFIGURE_PROXIMITY.bat
# Select: 2. Relaxed (-65)
npm start
```

Or increase beacon transmission power

---

### Problem: Detection Too Slow

**Cause:** 2-second stability requirement

**Solutions:**
```bash
CONFIGURE_PROXIMITY.bat
# Select: 4. Custom
# Entry Stability: 1500ms (instead of 2000ms)
npm start
```

---

## Summary

✅ **Default -55 threshold is CORRECT for your MWC small booth**  
✅ Only detects beacons within ~1 meter (very close)  
✅ Prevents detecting all beacons simultaneously  
✅ Ensures clear, sequential demo flow  
✅ User must intentionally approach each beacon  

**Your original observation was correct!** The strict threshold is exactly what you need for a small booth scenario.

---

## Quick Reference

| Scenario | Threshold | Detection Range | Command |
|----------|-----------|-----------------|---------|
| **MWC Booth** | **-55** | **~1m** | **Default** |
| Larger Area | -65 | ~2m | Option 2 |
| Testing | -70 | ~3m | Option 3 |
| Custom | Your value | Variable | Option 4 |

**Current setting: -55 (Perfect for MWC booth!) ✅**
