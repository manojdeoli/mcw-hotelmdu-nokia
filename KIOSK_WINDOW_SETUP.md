# Kiosk Separate Window Implementation

## Changes Made

### 1. Guest Information Tab → Separate Window
- Changed "Guest Information" tab button to open kiosk in new window
- Button now opens `/kiosk` route in popup window (1200x800)
- No longer shows as tab in main application

### 2. New Files Created

#### KioskPage.js
- Standalone kiosk page component
- Uses BroadcastChannel to sync state with main app
- Displays GuestTab component in full-screen kiosk mode
- Syncs: checkInStatus, formState, verifiedPhoneNumber, hasReachedHotel, guestMessages

### 3. Modified Files

#### index.js
- Added simple routing logic
- Shows KioskPage when pathname is `/kiosk`
- Shows App for all other routes

#### App.js
- Changed Guest Information tab button to open new window
- Removed GuestTab component from main app tabs
- Button: `window.open(window.location.origin + '/kiosk', '_blank', 'width=1200,height=800')`

## How It Works

1. **Main Dashboard**: User works in main application (API Interaction, Hotel Dashboard, All Details tabs)

2. **Open Kiosk**: Click "Guest Information (Kiosk)" button → Opens new window at `/kiosk`

3. **State Synchronization**: Both windows stay in sync via BroadcastChannel
   - Phone verification in main app → Kiosk updates
   - Check-in button in kiosk → Main app updates
   - All state changes sync automatically

4. **Independent Display**: Kiosk window shows full-screen hotel entrance interface without navigation tabs

## Benefits

✅ Kiosk doesn't interfere with main dashboard navigation
✅ Can position kiosk window on second monitor (MWC booth setup)
✅ Both windows stay synchronized in real-time
✅ Main dashboard remains fully functional
✅ Kiosk provides immersive full-screen experience

## Usage

1. Start application: `npm start`
2. Main dashboard opens at `http://localhost:3000`
3. Click "Guest Information (Kiosk)" button
4. Kiosk opens in new window at `http://localhost:3000/kiosk`
5. Both windows work together seamlessly

## For MWC Booth

- Main dashboard on laptop/tablet for staff
- Kiosk window on large display for guests
- Both stay synchronized automatically
- Professional, booth-ready setup
