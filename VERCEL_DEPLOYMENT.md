# Deploy React App to Vercel

## ✅ Code Pushed to GitHub
Repository: https://github.com/manojdeoli/hotel-mdu1

## Deploy to Vercel

### Step 1: Go to Vercel
Visit: https://vercel.com

### Step 2: Sign Up / Login
- Click "Sign Up" or "Login"
- Choose "Continue with GitHub"
- Authorize Vercel to access your GitHub

### Step 3: Import Project
1. Click "Add New..." → "Project"
2. Find "manojdeoli/hotel-mdu1" in the list
3. Click "Import"

### Step 4: Configure Project
**Project Name:** `hotel-mdu1` (or any name you prefer)

**Framework Preset:** Create React App (should auto-detect)

**Root Directory:** `./` (leave as is)

**Build Command:** `npm run build` (auto-detected)

**Output Directory:** `build` (auto-detected)

**Install Command:** `npm install` (auto-detected)

### Step 5: Add Environment Variable
Click "Environment Variables" and add:

**Key:** `REACT_APP_GATEWAY_URL`
**Value:** `https://web.production-f04c1.up.railway.app`

(Use your actual Railway Gateway URL)

### Step 6: Deploy
Click "Deploy"

Wait 2-3 minutes for deployment to complete.

### Step 7: Get Your URL
After deployment, you'll get a URL like:
```
https://hotel-mdu1.vercel.app
```

or
```
https://hotel-mdu1-manojdeoli.vercel.app
```

## Test Your Deployment

### Test 1: Open in Browser
Visit your Vercel URL: `https://hotel-mdu1.vercel.app`

Should see the Hotel MDU app!

### Test 2: Verify Phone Number
1. Enter phone: `+61400500800`
2. Click "Verify Phone"
3. Should connect to Gateway

### Test 3: Check Browser Console
Press F12 → Console

Should see:
```
[Gateway] Connected to server
```

## Complete Testing Setup

Now you have:
- ✅ Gateway Server: Railway (https://web.production-f04c1.up.railway.app)
- ✅ React App: Vercel (https://hotel-mdu1.vercel.app)
- ✅ BLE Scanner: Android APK

### Testing Flow:

**Phone 1 (BLE Scanner):**
- Gateway URL: `https://web.production-f04c1.up.railway.app`
- Phone: `+61400500800`
- Connect & Start Scanning

**Phone 2 (Beacon Simulator):**
- nRF Connect → Advertiser
- Device name: `HotelGate`
- Start advertising

**Any Device (React App):**
- Open: `https://hotel-mdu1.vercel.app`
- Phone: `+61400500800`
- Verify Phone
- Start Auto-Tracking

**Result:**
- BLE Scanner detects beacon
- Sends to Railway Gateway
- Gateway forwards to React App
- React App updates in real-time!

## Network Diagram

```
┌─────────────────────────────────────┐
│         Internet / Cloud            │
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │   Railway    │  │   Vercel    │ │
│  │   Gateway    │  │  React App  │ │
│  └──────┬───────┘  └──────┬──────┘ │
└─────────┼──────────────────┼────────┘
          │                  │
          │                  │
    ┌─────┴──────┐    ┌──────┴─────┐
    │  Phone 1   │    │  Phone 3   │
    │    BLE     │    │   React    │
    │  Scanner   │    │    App     │
    └────────────┘    └────────────┘
          │
    ┌─────┴──────┐
    │  Phone 2   │
    │   Beacon   │
    │ Simulator  │
    └────────────┘
```

## Advantages of Cloud Deployment

✅ **No local server needed** - Everything in cloud
✅ **Access from anywhere** - Any device, any network
✅ **No firewall issues** - Public HTTPS endpoints
✅ **Always available** - 24/7 uptime
✅ **Easy to share** - Just share the URL
✅ **Professional** - Production-ready setup

## Update Deployment

If you make changes to the code:

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Update app"
   git push
   ```

2. **Vercel auto-deploys!**
   - Vercel watches your GitHub repo
   - Automatically rebuilds and deploys
   - Takes 2-3 minutes

## Custom Domain (Optional)

You can add a custom domain:
1. Vercel Dashboard → Your Project → Settings
2. Domains → Add Domain
3. Follow instructions to configure DNS

## Environment Variables

To update Gateway URL:
1. Vercel Dashboard → Your Project → Settings
2. Environment Variables
3. Edit `REACT_APP_GATEWAY_URL`
4. Redeploy (Deployments → ... → Redeploy)

## Troubleshooting

### Deployment Failed
- Check build logs in Vercel dashboard
- Verify package.json has all dependencies
- Check for syntax errors

### App Loads but Can't Connect to Gateway
- Check environment variable is set correctly
- Test Gateway URL: `https://YOUR-RAILWAY-URL/health`
- Check browser console for errors

### Changes Not Showing
- Wait for Vercel to finish deploying
- Hard refresh browser (Ctrl+Shift+R)
- Check Vercel dashboard for deployment status

## Your URLs

**GitHub Repository:**
https://github.com/manojdeoli/hotel-mdu1

**Vercel Dashboard:**
https://vercel.com/dashboard

**React App (after deployment):**
https://hotel-mdu1.vercel.app

**Gateway Server (Railway):**
https://web.production-f04c1.up.railway.app

## Testing Checklist

- [ ] Vercel deployment successful
- [ ] React app loads at Vercel URL
- [ ] Phone verification works
- [ ] Gateway connection works
- [ ] BLE Scanner connects to Railway
- [ ] Beacon detection works
- [ ] React app receives BLE events
- [ ] UI updates in real-time

## Next Steps

1. Deploy to Vercel (follow steps above)
2. Test React app at Vercel URL
3. Test BLE Scanner → Railway → Vercel flow
4. Share Vercel URL with team/stakeholders
5. Demo the complete system!

---

**Everything is now in the cloud!** 🚀
No local servers, no firewall issues, accessible from anywhere!
