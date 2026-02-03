# Guest Messages Implementation Guide

## Guest Message Triggers to Add

### 1. Phone Verification (validatePhone function)
- After successful verification: 
  `addGuestMessage(\`Welcome to Telstra Towers! Your reservation is confirmed for ${format(CHECK_IN_DATE, 'MMM dd')}. Check-in starts at 3:00 PM.\`, 'success');`

### 2. Arrival at Hotel (processBeaconDetection - Gate)
- When user arrives at gate:
  `addGuestMessage(\`Welcome ${formState.name || 'Guest'}! We're delighted to have you. Would you like to proceed with express check-in?\`, 'welcome');`

### 3. At Check-in Kiosk (processBeaconDetection - Kiosk)
- Before check-in:
  `addGuestMessage('Your room 1337 is ready! Tap your phone at the kiosk to complete check-in.', 'info');`
- During identity verification:
  `addGuestMessage('Verifying your identity... Please wait.', 'processing');`
- After identity verified:
  `addGuestMessage('Identity verified successfully! ✓', 'success');`

### 4. Payment Processing (handleStartSequence - arrival mode)
- Before payment:
  `addGuestMessage('Processing payment... Amount: $299.00 AUD', 'processing');`
- After payment:
  `addGuestMessage('Payment successful! ✓', 'success');`

### 5. Check-in Complete (setCheckInStatus)
- After check-in:
  `addGuestMessage(\`Check-in complete! Welcome to Telstra Towers, ${formState.name || 'Guest'}.\`, 'success');`
  `addGuestMessage(\`Your room: 1337 | Floor: 13 | Check-out: ${format(CHECK_OUT_DATE, 'MMM dd')} 11:00 AM\`, 'info');`
  `addGuestMessage('Your digital room key is now active. Use your phone to access the elevator and your room.', 'info');`

### 6. Elevator Access (processBeaconDetection - Elevator)
- Approaching elevator:
  `addGuestMessage('Approaching elevator... Verifying access.', 'processing');`
- Access granted:
  `addGuestMessage('Access granted! Elevator to Floor 13 is ready.', 'success');`
  `addGuestMessage('Enjoy your stay! Your room is on Floor 13.', 'info');`

### 7. Room Entry (processBeaconDetection - Room)
- At room door:
  `addGuestMessage('Welcome to Room 1337! Tap your phone on the door lock.', 'info');`
- Verifying:
  `addGuestMessage('Verifying identity...', 'processing');`
- Room unlocked:
  `addGuestMessage('Room unlocked! Enjoy your stay.', 'success');`

### 8. Check-out Process (handleStartSequence - departure mode)
- Start checkout:
  `addGuestMessage('Ready to check out? Processing your final bill...', 'processing');`
- Payment processing:
  `addGuestMessage('Processing final payment... Please wait.', 'processing');`
- Payment complete:
  `addGuestMessage('Payment processed successfully! ✓', 'success');`
- Checkout complete:
  `addGuestMessage(\`Thank you for staying with us, ${formState.name || 'Guest'}! We hope to see you again soon.\`, 'success');`
  `addGuestMessage('Your digital room key has been deactivated. Safe travels!', 'info');`

### 9. Error Messages
- Identity verification failed:
  `addGuestMessage('⚠️ Identity verification failed. Please contact reception for assistance.', 'error');`
- Payment declined:
  `addGuestMessage('⚠️ Payment declined. Please update your payment method or contact reception.', 'error');`

## Tab Structure Changes

### Current:
1. API Interaction
2. Hospital Dashboard  
3. All Details

### New:
1. API Interaction
2. Guest Information (NEW)
3. Hospital Dashboard
4. All Details

## Guest Information Tab UI

```jsx
{/* Tab 2: Guest Information */}
<div className={`dashboard-column ${activeTab === 'guest' ? '' : 'd-none'}`} style={{ width: '100%' }}>
  <div className="card">
    <h2 className="card-header">Guest Information</h2>
    <div className="p-3" style={{ maxHeight: '600px', overflowY: 'auto' }}>
      {guestMessages.length === 0 ? (
        <p className="text-center text-muted">No messages yet. Start your journey by verifying your phone number.</p>
      ) : (
        <div className="guest-messages-list">
          {guestMessages.map(msg => (
            <div key={msg.id} className={`alert alert-${msg.type === 'success' ? 'success' : msg.type === 'error' ? 'danger' : msg.type === 'processing' ? 'warning' : msg.type === 'welcome' ? 'primary' : 'info'} mb-3`}>
              <div className="d-flex justify-content-between align-items-start">
                <div style={{ flex: 1 }}>
                  <p className="mb-0" style={{ fontSize: '16px' }}>{msg.message}</p>
                </div>
                <small className="text-muted ml-3">{new Date(msg.timestamp).toLocaleTimeString()}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>
```

## Implementation Steps

1. Add guestMessages state (DONE)
2. Add addGuestMessage function (DONE)
3. Add guest message triggers in all functions
4. Update tab navigation to include "Guest Information"
5. Add Guest Information tab UI
6. Update activeTab conditions for dashboard and details tabs
7. Test all flows to ensure messages appear correctly
