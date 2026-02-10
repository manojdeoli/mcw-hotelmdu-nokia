import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import GuestTab from './components/GuestTab';
import * as api from './api';

const useSyncedState = (key, initialValue) => {
  const [state, setState] = useState(initialValue);
  const channelRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (!channelRef.current) {
        channelRef.current = new BroadcastChannel('hotel_mdu_sync');
        console.log('[KioskPage] BroadcastChannel created for key:', key);
      }
    }
    
    const channel = channelRef.current;

    const handler = (event) => {
      if (event.data.key === key) {
        console.log('[KioskPage] Received broadcast for', key, ':', event.data.value);
        setState(event.data.value);
      }
    };
    channel.addEventListener('message', handler);

    return () => {
      channel.removeEventListener('message', handler);
    };
  }, [key]);

  const setSyncedState = useCallback((newValue) => {
    setState((prev) => {
      const value = newValue instanceof Function ? newValue(prev) : newValue;
      console.log('[KioskPage] Broadcasting', key, ':', value);
      if (channelRef.current) {
        channelRef.current.postMessage({ key, value });
      }
      return value;
    });
  }, [key]);

  return [state, setSyncedState];
};

function KioskPage() {
  const [checkInStatus, setCheckInStatus] = useSyncedState('checkInStatus', 'Not Checked In');
  const [formState] = useSyncedState('formState', {});
  const [verifiedPhoneNumber] = useSyncedState('verifiedPhoneNumber', null);
  const [hasReachedHotel] = useSyncedState('hasReachedHotel', false);
  const [guestMessages, setGuestMessages] = useSyncedState('guestMessages', []);
  const [rfidStatus, setRfidStatus] = useSyncedState('rfidStatus', 'Unverified');
  const [museumMap, setMuseumMap] = useState(null);

  const addGuestMessage = useCallback((message, type = 'info') => {
    setGuestMessages(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        message,
        type
      }
    ]);
  }, [setGuestMessages]);

  const handleCheckInConsent = useCallback(() => {
    console.log('[KioskPage] Check-in consent button clicked');
    console.log('[KioskPage] Current check-in status:', checkInStatus);
    
    // Set consent in API
    api.setCheckInConsent(true);
    addGuestMessage('Check-in consent received. Processing...', 'processing');
    
    // Force check-in if not already checked in
    if (checkInStatus !== 'Checked In') {
      console.log('[KioskPage] Forcing check-in status update');
      setCheckInStatus('Checked In');
      setRfidStatus('Verified');
      
      // Reset RFID status after 3 seconds
      setTimeout(() => {
        setRfidStatus('Unverified');
        const guestName = formState.firstName || (formState.name ? formState.name.split(' ')[0] : 'Guest');
        addGuestMessage(`Check-in complete, ${guestName}! Welcome to Room 1337. Enjoy your stay!`, 'success');
      }, 3000);
    }
  }, [checkInStatus, setCheckInStatus, setRfidStatus, formState, addGuestMessage]);

  return (
    <div className="App" style={{ margin: 0, padding: 0 }}>
      <GuestTab 
        checkInStatus={checkInStatus}
        formState={formState}
        verifiedPhoneNumber={verifiedPhoneNumber}
        activeTab="guest"
        museumMap={museumMap}
        setMuseumMap={setMuseumMap}
        hasReachedHotel={hasReachedHotel}
        guestMessages={guestMessages}
        onCheckInConsent={handleCheckInConsent}
      />
    </div>
  );
}

export default KioskPage;
