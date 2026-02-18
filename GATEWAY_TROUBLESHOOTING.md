# Gateway Connection Troubleshooting

## Error: WebSocket connection failed

### Quick Checklist

1. ✅ **Gateway app running on tablet?**
2. ✅ **Both devices on same WiFi?**
3. ✅ **Correct IP address?**
4. ✅ **Port 8080 accessible?**

---

## Step-by-Step Diagnosis

### 1. Verify Gateway App is Running

**On Samsung Tablet:**
- Open the BLE Scanner app
- Press "Start Scanning"
- Check status shows: "Status: Scanning..."
- Note the IP address shown: "Server URL: http://X.X.X.X:8080"

**Expected:** App should show IP address and "Scanning..." status

---

### 2. Verify IP Address

**On Tablet:**
- Look at the app screen
- Find: "Server URL: http://10.247.130.116:8080"
- This is your Gateway IP

**On Laptop:**
- Open `src/gatewayClient.js`
- Check line 2: `const GATEWAY_URL = process.env.REACT_APP_GATEWAY_URL || 'http://10.247.130.116:8080';`
- **IP must match tablet's IP exactly**

**If IPs don't match:**
```javascript
// Update gatewayClient.js line 2:
const GATEWAY_URL = process.env.REACT_APP_GATEWAY_URL || 'http://YOUR_TABLET_IP:8080';
```

---

### 3. Test Connection

**Run diagnostic tool:**
```bash
TEST_GATEWAY_CONNECTION.bat
# Enter tablet IP when prompted
```

**Expected results:**
- ✅ HTTP endpoint returns: `{"status":"ok",...}`
- ✅ Ping succeeds: `Reply from X.X.X.X`
- ✅ Port 8080 open: `TcpTestSucceeded : True`

---

### 4. Check Network

**Both devices must be on SAME WiFi:**

**On Tablet:**
- Settings → WiFi
- Note network name (e.g., "Office-WiFi")

**On Laptop:**
- WiFi icon → Check connected network
- Must match tablet's network

**If on different networks:**
- Connect both to same WiFi
- Restart Gateway app on tablet
- Note new IP address

---

### 5. Test HTTP First (Before WebSocket)

**Open browser on laptop:**
```
http://10.247.130.116:8080/health
```

**Expected response:**
```json
{
  "status": "ok",
  "webClients": 0,
  "timestamp": 1234567890
}
```

**If this fails:**
- Gateway server is not running or not accessible
- Check firewall settings

---

## Common Issues & Solutions

### Issue 1: "Connection refused"

**Cause:** Gateway app not running on tablet

**Solution:**
1. Open BLE Scanner app on tablet
2. Press "Start Scanning"
3. Verify status shows "Scanning..."
4. Try connection again

---

### Issue 2: "Connection timeout"

**Cause:** Firewall blocking port 8080

**Solution (Temporary for testing):**
```bash
# On laptop, run as Administrator:
netsh advfirewall set allprofiles state off

# Test connection
# Then turn firewall back on:
netsh advfirewall set allprofiles state on
```

**Solution (Permanent):**
```bash
# Add firewall rule for port 8080:
netsh advfirewall firewall add rule name="BLE Gateway" dir=in action=allow protocol=TCP localport=8080
```

---

### Issue 3: "Network unreachable"

**Cause:** Devices on different networks

**Solution:**
1. Check both devices are on same WiFi
2. Tablet: Settings → WiFi → Note network name
3. Laptop: WiFi settings → Connect to same network
4. Restart Gateway app on tablet (IP may change)
5. Update IP in `gatewayClient.js`

---

### Issue 4: IP Address Changed

**Cause:** Tablet got new IP from DHCP

**Solution:**
1. Check tablet app for current IP
2. Update `gatewayClient.js`:
   ```javascript
   const GATEWAY_URL = 'http://NEW_IP:8080';
   ```
3. Restart React app

**Or use environment variable:**
```bash
# Create .env.local file:
REACT_APP_GATEWAY_URL=http://10.247.130.116:8080

# Restart app
npm start
```

---

### Issue 5: WebSocket Upgrade Failed

**Cause:** HTTP works but WebSocket doesn't

**Check in browser console:**
```
[Gateway] Connecting to: ws://10.247.130.116:8080/
```

**Solution:**
1. Verify Gateway app uses NanoWSD (WebSocket support)
2. Check Android app logs:
   ```bash
   adb logcat | grep GatewayServer
   ```
3. Look for: "WebSocket opened: client_xxx"

---

## Alternative: Use Mobile Hotspot

If WiFi issues persist:

### 1. Enable Hotspot on Tablet
- Settings → Connections → Mobile Hotspot
- Turn ON
- Note hotspot name and password

### 2. Connect Laptop to Tablet Hotspot
- Laptop WiFi → Connect to tablet's hotspot
- Enter password

### 3. Check New IP
- Tablet app will show new IP (usually 192.168.43.1)
- Update `gatewayClient.js` with new IP

### 4. Test Connection
- Should work immediately
- No firewall issues with hotspot

---

## Quick Fix: Use Environment Variable

**Instead of editing code, use .env.local:**

### 1. Create .env.local file in project root:
```bash
REACT_APP_GATEWAY_URL=http://10.247.130.116:8080
```

### 2. Restart app:
```bash
npm start
```

### 3. Change IP anytime without code changes:
```bash
# Edit .env.local
REACT_APP_GATEWAY_URL=http://NEW_IP:8080

# Restart app
npm start
```

---

## Verification Steps

### 1. Check Gateway Status

**Browser:**
```
http://10.247.130.116:8080/health
```

**Expected:**
```json
{"status":"ok","webClients":0,"timestamp":1234567890}
```

### 2. Check WebSocket Connection

**Browser Console (F12):**
```
[Gateway] Connecting to: ws://10.247.130.116:8080/
[Gateway] Connected to server
[Gateway] Using demo subscription ID: hotel-demo-subscription
```

### 3. Test BLE Detection

**Place beacon near tablet:**
- Tablet should show: "Detected: ER26B00001 (RSSI: -65)"
- Browser console should show: "[Gateway] BLE event parsed successfully"
- React app should process beacon

---

## Still Not Working?

### Last Resort Checklist:

1. **Restart everything:**
   - Close Gateway app on tablet
   - Close React app on laptop
   - Start Gateway app on tablet
   - Note IP address
   - Update gatewayClient.js if needed
   - Start React app

2. **Use USB debugging:**
   ```bash
   # Connect tablet via USB
   adb forward tcp:8080 tcp:8080
   
   # Update gatewayClient.js:
   const GATEWAY_URL = 'http://localhost:8080';
   ```

3. **Check Android logs:**
   ```bash
   adb logcat | grep -E "GatewayServer|BLEScanner"
   ```

4. **Try different port:**
   - Modify Android app to use port 8081
   - Update gatewayClient.js to match
   - Rebuild Android APK

---

## Contact Information

If issue persists, provide:
1. Tablet IP address
2. Laptop IP address
3. Network name (WiFi)
4. Browser console logs
5. Android logcat output
6. Screenshot of tablet app

---

## Summary

**Most common cause:** IP address mismatch or Gateway app not running

**Quick fix:**
1. Verify Gateway app is running on tablet
2. Check IP address matches in gatewayClient.js
3. Test HTTP endpoint first: http://IP:8080/health
4. If HTTP works but WebSocket fails, check firewall
5. Use mobile hotspot as alternative
