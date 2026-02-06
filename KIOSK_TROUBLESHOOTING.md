# Kiosk Troubleshooting Guide

## Issues Fixed:

### 1. Background Image Not Showing
**Problem**: `Hotel_entrance.png` file is missing from `/public` folder

**Solution**: 
- Added fallback gradient background (blue gradient)
- Image will show automatically when you add `Hotel_entrance.png` to `/public` folder
- See `/public/README_ADD_IMAGE.md` for instructions

### 2. State Updates Not Syncing
**Problem**: BroadcastChannel messages not being received properly

**Solution**:
- Added `useCallback` to prevent stale closures
- Added console logging to debug sync issues
- Check browser console for `[KioskPage]` messages to see if broadcasts are working

### 3. Check-in Button Not Working
**Problem**: `onCheckInConsent` callback not triggering state updates

**Current Flow**:
1. Click "Check In Now" button in kiosk
2. Calls `api.setCheckInConsent(true)`
3. Adds guest message
4. Main app should detect consent and complete check-in

**To Debug**:
- Open browser console in both windows
- Click "Check In Now" in kiosk
- Look for broadcast messages in console
- Check if main app receives the consent

## How to Test:

### Step 1: Open Both Windows
1. Start app: `npm start`
2. Go to Hotel Dashboard tab
3. Click "🏨 Open Hotel Kiosk" button
4. Position windows side-by-side

### Step 2: Verify Phone
1. In main dashboard, enter phone: `+61412345678`
2. Click "Verify"
3. Kiosk should update to show "Welcome, [Name]!"

### Step 3: Start Booking & Arrival
1. In main dashboard, click "Booking & Arrival"
2. Wait for "Proceed to Kiosk" button
3. Click it
4. Kiosk should show check-in form with guest details

### Step 4: Check In
1. In kiosk, click "Check In Now"
2. Main dashboard should update check-in status
3. After 3 seconds, kiosk shows success screen with amenities

## Console Debugging:

Open browser console (F12) and look for:
- `[KioskPage] BroadcastChannel created` - Channel initialized
- `[KioskPage] Received broadcast: checkInStatus Checked In` - State received
- `[KioskPage] Broadcasting: guestMessages [...]` - State sent

## Common Issues:

### Kiosk Shows "Welcome to Hotel Barcelona Sol" (idle state)
- Phone not verified in main dashboard
- State not syncing - check console for broadcast messages

### Check-in Button Doesn't Work
- Check browser console for errors
- Verify BroadcastChannel is working (see console logs)
- Try clicking "Proceed to Kiosk" in main dashboard first

### Background is Blue Gradient Instead of Image
- This is normal! Image file is missing
- Add `Hotel_entrance.png` to `/public` folder
- Gradient is the fallback design

## Files Modified:

1. **App.js** - Added "Open Hotel Kiosk" button
2. **KioskPage.js** - Added console logging for debugging
3. **App.css** - Added fallback gradient background
4. **GuestTab.js** - Uses inline style for background image

## Next Steps:

1. Add `Hotel_entrance.png` to `/public` folder for background
2. Test state synchronization with console open
3. Report any console errors you see
