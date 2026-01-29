import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import { format } from 'date-fns';
import * as api from './api';
import { formFields } from './formFields';
import gatewayClient from './gatewayClient';


// --- Fix for Leaflet's default icon ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});
// --- End of fix ---

// --- Dummy Booking Data & Initial Time ---
const CHECK_IN_DATE = new Date();
CHECK_IN_DATE.setHours(15, 0, 0, 0); // Today at 3:00 PM

const CHECK_OUT_DATE = new Date(CHECK_IN_DATE);
CHECK_OUT_DATE.setDate(CHECK_OUT_DATE.getDate() + 1);
CHECK_OUT_DATE.setHours(11, 0, 0, 0); // Tomorrow at 11:00 AM

const getInitialArtificialTime = (mode) => {
  if (mode === 'arrival') {
    return new Date(CHECK_IN_DATE.getTime() - 30 * 60 * 1000); // Start clock 30 minutes before check-in
  }
  return new Date(CHECK_OUT_DATE.getTime() - 30 * 60 * 1000); // Start clock 30 minutes before check-out
};
// --- End of Data & Initial Time ---

// --- Location Simulation Data ---


const generateRoute = (start, end, sections = 10) => {
  if (!start) return [end];
  const route = [start];
  const latDiff = (end.lat - start.lat) / sections;
  const lngDiff = (end.lng - start.lng) / sections;

  for (let i = 1; i < sections; i++) {
    route.push({
      lat: start.lat + latDiff * i,
      lng: start.lng + lngDiff * i,
    });
  }
  route.push(end);
  return route;
};

// --- End of Location Simulation Data ---

// --- Custom Hook for State Synchronization ---
const useSyncedState = (key, initialValue) => {
  const [state, setState] = useState(initialValue);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!channelRef.current) {
      channelRef.current = new BroadcastChannel('hotel_mdu_sync');
    }
    const channel = channelRef.current;

    const handler = (event) => {
      if (event.data.key === key) {
        setState(event.data.value);
      }
    };
    channel.addEventListener('message', handler);

    return () => {
      channel.removeEventListener('message', handler);
      // Channel is not closed here to prevent issues with other hooks.
      // It will be closed when the page/tab is closed.
    };
  }, [key]);

  const setSyncedState = useCallback((newValue) => {
    setState((prev) => {
      const value = newValue instanceof Function ? newValue(prev) : newValue;
      if (channelRef.current) {
        channelRef.current.postMessage({ key, value });
      }
      return value;
    });
  }, [key]);

  return [state, setSyncedState];
};
// --- End of Custom Hook ---

function getDistance(coords1, coords2) {
  const R = 6371e3; // metres
  const φ1 = coords1.lat * Math.PI / 180;
  const φ2 = coords2.lat * Math.PI / 180;
  const Δφ = (coords2.lat - coords1.lat) * Math.PI / 180;
  const Δλ = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function App() {
  const mapUpdateThrottle = useRef(null);
  
  // --- Shared State (Synced across windows) ---
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useSyncedState('verifiedPhoneNumber', null);
  const [kycMatchResponse, setKycMatchResponse] = useSyncedState('kycMatchResponse', null);
  // Skip the unused 'location' variable to avoid ESLint errors
  const [, setLocation] = useSyncedState('location', null);
  const [simulationMode, setSimulationMode] = useSyncedState('simulationMode', 'arrival');
  const [registrationStatus, setRegistrationStatus] = useSyncedState('registrationStatus', 'Not Registered');
  const [artificialTime, setArtificialTime] = useSyncedState('artificialTime', null);
  const [identityIntegrity, setIdentityIntegrity] = useSyncedState('identityIntegrity', 'Bad');
  const [checkInStatus, setCheckInStatus] = useSyncedState('checkInStatus', 'Not Checked In');
  const [paymentStatus, setPaymentStatus] = useSyncedState('paymentStatus', 'Not Paid');
  const [rfidStatus, setRfidStatus] = useSyncedState('rfidStatus', 'Unverified');
  const [elevatorAccess, setElevatorAccess] = useSyncedState('elevatorAccess', 'No');
  const [roomAccess, setRoomAccess] = useSyncedState('roomAccess', 'No');
  const [hotelLocation, setHotelLocation] = useSyncedState('hotelLocation', null);
  const [userGps, setUserGps] = useSyncedState('userGps', null);
  const [initialUserLocation, setInitialUserLocation] = useSyncedState('initialUserLocation', null);
  const [lastIntegrityCheckTime, setLastIntegrityCheckTime] = useSyncedState('lastIntegrityCheckTime', null);
  const [bleStatus, setBleStatus] = useSyncedState('bleStatus', 'Disconnected');
  const [, setGatewayConnected] = useSyncedState('gatewayConnected', false);
  const [secondUserGps, setSecondUserGps] = useSyncedState('secondUserGps', null);
  const [messages, setMessages] = useSyncedState('messages', []);
  const [apiLogs, setApiLogs] = useSyncedState('apiLogs', []);
  const [formState, setFormState] = useSyncedState('formState',
    formFields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})
  );

  // --- Local State (Specific to this window/monitor) ---
  const [isLoading, setIsLoading] = useState(false);
  const [map, setMap] = useState(null);
  const [activeTab, setActiveTab] = useState('api');
  const [isSequenceRunning, setIsSequenceRunning] = useState(false); // Only the driver window runs the sequence logic
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  const logApiInteraction = useCallback((title, method, url, request, response) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      title,
      method,
      url,
      request,
      response
    };
    setApiLogs(prev => [logEntry, ...prev]);
  }, [setApiLogs]);

  const addMessage = useCallback((message) => {
    setMessages(prevMessages => {
      const newMessage = `${new Date().toLocaleTimeString()}: ${message}`;
      if (prevMessages.includes(newMessage)) {
        return prevMessages;
      }
      return [...prevMessages, newMessage];
    });
  }, [setMessages]);

  // --- State Persistence Logic ---
  // On component mount, load state from localStorage

  const responseContainerRef = useRef(null);
  const userProfileRef = useRef(null);

  // --- Refs for Event Listeners (to avoid stale closures in Auto-Scan) ---
  const checkInStatusRef = useRef(checkInStatus);
  const elevatorAccessRef = useRef(elevatorAccess);
  const roomAccessRef = useRef(roomAccess);
  const hotelLocationRef = useRef(hotelLocation);
  const verifiedPhoneNumberRef = useRef(verifiedPhoneNumber);

  useEffect(() => { checkInStatusRef.current = checkInStatus; }, [checkInStatus]);
  useEffect(() => { elevatorAccessRef.current = elevatorAccess; }, [elevatorAccess]);
  useEffect(() => { roomAccessRef.current = roomAccess; }, [roomAccess]);
  useEffect(() => { hotelLocationRef.current = hotelLocation; }, [hotelLocation]);
  useEffect(() => { verifiedPhoneNumberRef.current = verifiedPhoneNumber; }, [verifiedPhoneNumber]);
  const bleUnsubscribeRef = useRef(null);

  // Connect to Gateway Server when phone is verified
  useEffect(() => {
    if (verifiedPhoneNumber) {
      addMessage(`Connecting to Gateway Server...`);
      gatewayClient.connect(verifiedPhoneNumber);
      setGatewayConnected(true);
      setBleStatus('Connected');
      addMessage(`Connected to Gateway: ${gatewayClient.getGatewayUrl()}`);
    } else {
      if (gatewayClient.isConnected()) {
        gatewayClient.disconnect();
        setGatewayConnected(false);
        setBleStatus('Disconnected');
      }
    }
    
    return () => {
      if (gatewayClient.isConnected()) {
        gatewayClient.disconnect();
      }
    };
  }, [verifiedPhoneNumber, addMessage, setGatewayConnected, setBleStatus]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
    if (kycMatchResponse) {
      setKycMatchResponse(null);
    }
  };

  useEffect(() => {
    if (responseContainerRef.current) {
      responseContainerRef.current.scrollTop = responseContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (checkInStatus === 'Checked Out') { // Only show checkout message here
      addMessage('Thank you for staying with us! Your check-out is complete');
    }
  }, [verifiedPhoneNumber, checkInStatus, kycMatchResponse, addMessage]);

  const handleRegistrationSequence = async () => {
    if (!verifiedPhoneNumber) {
      alert('Please verify your phone number first to start registration.');
      return;
    }
    addMessage("Starting Registration Sequence...");

    // 1. Use KYC Fill to partially populate
    addMessage("Partially populating form with KYC Fill...");
    const kycData = await api.kycFill(verifiedPhoneNumber, logApiInteraction);
    setFormState(kycData);

    // 3. Wait and call KYC Match
    await new Promise(resolve => setTimeout(resolve, 5000));
    addMessage("Calling KYC Match...");
    const kycMatchReq = { // Use kycData directly
      phoneNumber: verifiedPhoneNumber,
      email: kycData.email,
      address: kycData.address,
      birthdate: kycData.birthdate,
      name: kycData.name
    };
    const kycMatchData = await api.kycMatch(kycMatchReq, logApiInteraction);
    setKycMatchResponse(kycMatchData);

    await new Promise(resolve => setTimeout(resolve, 2000));
    const allFieldsMatch = !Object.values(kycMatchData).includes('false');
    if (allFieldsMatch) {
      addMessage('KYC Match successful. Proceed with check-in.');
      setRegistrationStatus('Registered');
    } else {
      setRegistrationStatus('Not Registered'); // Explicitly ensure status is not registered
      addMessage('KYC Match failed for some fields. Please correct and re-submit.');
      await new Promise(resolve => setTimeout(resolve, 5000));
      userProfileRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const submitKyc = async () => {
    if (!verifiedPhoneNumber) {
      alert('Please verify your phone number first.');
      return;
    }

    setIsLoading(true);
    try {
      const kycMatchReq = {
        phoneNumber: verifiedPhoneNumber,
        email: formState.email,
        address: formState.address,
        birthdate: formState.birthdate,
        name: formState.name
      };
      const kycData = await api.kycMatch(kycMatchReq, logApiInteraction);

      setKycMatchResponse(kycData);

      // Check if all fields are true after the match
      const allFieldsMatch = !Object.values(kycData).includes('false');
      if (allFieldsMatch) {
        setRegistrationStatus('Registered');
        addMessage('KYC Match successful. Proceed with check-in.');
      }

    } catch (err) {
      console.error('KYC Match failed:', err);
      addMessage(`KYC Match API Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkIdentityIntegrity = useCallback(async (loader, checkInStatus, autoGrant = true) => {
    if (!verifiedPhoneNumberRef.current) {
      alert('Please verify phone number first.');
      return false;
    }
    if (loader) setIsLoading(true);
    setIdentityIntegrity('Checking...');
    try {
      const simSwapResult = await api.simSwap(verifiedPhoneNumberRef.current, logApiInteraction);
      const deviceSwapResult = await api.deviceSwap(verifiedPhoneNumberRef.current, logApiInteraction);

      if (simSwapResult.swapped === true || deviceSwapResult.swapped === true) {
        setIdentityIntegrity('Good');
      } else {
        setIdentityIntegrity('Good');
        if (artificialTime) setLastIntegrityCheckTime(new Date(artificialTime.getTime()));
      }
      if (autoGrant && checkInStatus === 'Checked In') {
        setElevatorAccess('Yes, Floor 13');
        setRoomAccess('Granted');
      }
      return true;
    } catch (err) {
      console.error('Identity integrity check failed:', err);
      setIdentityIntegrity('Bad');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [artificialTime, logApiInteraction, setIdentityIntegrity, setElevatorAccess, setRoomAccess, setLastIntegrityCheckTime]);

  // --- Centralized Beacon Logic (Used by Manual & Auto Scan) ---
  const processBeaconDetection = useCallback(async (deviceName, rssi = null) => {
      const currentHotelLoc = hotelLocationRef.current || { lat: -33.8688, lng: 151.2093 };
      const baseLat = currentHotelLoc.lat;
      const baseLng = currentHotelLoc.lng;
      if (!hotelLocationRef.current) setHotelLocation(currentHotelLoc);
      
      let newLocation = null;
      let locationLabel = "Unknown Area";

      // --- Decision Logic based on Beacon Name ---
      if (deviceName.includes("Entry") || deviceName.includes("Gate")) {
        locationLabel = "Hotel Entry Gate";
        newLocation = { lat: baseLat, lng: baseLng };
        addMessage("Context: User arrived at Entry Gate.");
        
      } else if (deviceName.includes("Kiosk") || deviceName.includes("Lobby")) {
        locationLabel = "Check-in Kiosk";
        newLocation = { lat: baseLat + 0.0001, lng: baseLng };
        addMessage("Context: User is at the Check-in Kiosk.");
        
        if (checkInStatusRef.current !== 'Checked In') {
            addMessage("Beacon Trigger: Initiating Check-in...");
            setCheckInStatus("Checked In");
            setRfidStatus("Verified");
            setTimeout(() => setRfidStatus("Unverified"), 3000);
        }

      } else if (deviceName.includes("Elevator") || deviceName.includes("Lift")) {
        locationLabel = "Elevator Lobby";
        newLocation = { lat: baseLat + 0.0001, lng: baseLng + 0.0001 };
        addMessage("Context: User is at the Elevator.");
        
        // Auto-trigger Elevator Access
        if (elevatorAccessRef.current !== 'Yes, Floor 13') {
            addMessage("Beacon Trigger: Verifying Identity for Elevator...");
            const identityResult = await checkIdentityIntegrity(false, 'Checked In', false);
            if (identityResult) {
                setElevatorAccess('Yes, Floor 13');
                addMessage("Access Granted: Elevator to Floor 13.");
            }
        }

      } else if (deviceName.includes("Room") || deviceName.includes("Door")) {
        locationLabel = "Room 1337";
        newLocation = { lat: baseLat + 0.0002, lng: baseLng + 0.0002 };
        addMessage("Context: User is at the Room Door.");
        
        // Auto-trigger Room Access
        if (roomAccessRef.current !== 'Granted') {
             addMessage("Beacon Trigger: Verifying Identity for Room...");
             const identityResult = await checkIdentityIntegrity(false, 'Checked In', false);
             if (identityResult) {
                 setRoomAccess('Granted');
                 setRfidStatus('Verified');
                 setTimeout(() => setRfidStatus('Unverified'), 3000);
                 addMessage("Access Granted: Room 1337 Unlocked.");
             }
        }
      }
      
      if (newLocation) setUserGps(newLocation);
      if (rssi) {
        addMessage(`Auto-Tracked: ${locationLabel} (RSSI: ${rssi})`);
      } else {
        addMessage(`Location Verified via BLE: ${locationLabel}`);
      }
  }, [addMessage, setHotelLocation, setCheckInStatus, setRfidStatus, setElevatorAccess, setRoomAccess, setUserGps, checkIdentityIntegrity]);

  // --- Manual Scan (Not needed with Gateway) ---
  const scanForBeacon = async () => {
    addMessage("Manual scan not available - using Gateway auto-tracking");
  };

  // --- Test Gateway Connection ---
  const testAndroidBridge = async () => {
    if (gatewayClient.isConnected()) {
      addMessage(`Gateway connected: ${gatewayClient.getGatewayUrl()}`);
    } else {
      addMessage("Gateway not connected. Verify phone number first.");
    }
  };

  // --- Auto Scan (Gateway WebSocket) ---
  const toggleAutoScan = async () => {
    if (isAutoScanning) {
      // Stop Scanning
      if (bleUnsubscribeRef.current) {
        bleUnsubscribeRef.current();
        bleUnsubscribeRef.current = null;
      }
      setIsAutoScanning(false);
      addMessage("Auto-Tracking Stopped.");
    } else {
      // Start Scanning
      if (!gatewayClient.isConnected()) {
        addMessage("Gateway not connected. Please verify phone number first.");
        return;
      }
      
      try {
        addMessage("Starting Auto-Tracking (Gateway WebSocket)...");
        
        // Subscribe to Gateway BLE events
        bleUnsubscribeRef.current = gatewayClient.subscribe((data) => {
          const { rssi, zone } = data;
          addMessage(`BLE Event: ${zone} (RSSI: ${rssi})`);
          // Use zone from Gateway instead of parsing beaconName
          processBeaconDetection(zone, rssi);
        });
        
        setIsAutoScanning(true);
      } catch (error) {
        addMessage(`Auto-Scan Error: ${error.message}`);
      }
    }
  };

  const enableRealLocation = () => {
    if (!navigator.geolocation) {
      addMessage("Geolocation is not supported by your browser");
      return;
    }
    addMessage("Getting real device location...");
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserGps({ lat: latitude, lng: longitude });
        addMessage(`Device Location updated: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }, (error) => {
        addMessage(`Unable to retrieve location: ${error.message}`);
    });
  };

  const toggleSecondUser = () => {
    if (secondUserGps) {
      setSecondUserGps(null);
      addMessage("Removed mock second user.");
    } else {
      const baseLat = userGps ? userGps.lat : (hotelLocation ? hotelLocation.lat : -33.8688);
      const baseLng = userGps ? userGps.lng : (hotelLocation ? hotelLocation.lng : 151.2093);
      setSecondUserGps({ lat: baseLat + 0.0005, lng: baseLng + 0.0005 });
      addMessage("Added mock second user nearby.");
    }
  };

  const handleAccessSequence = async (passedLocation) => {
    // Use passed location if available (from API callback), otherwise fallback to state
    const currentLocation = (passedLocation && passedLocation.lat) ? passedLocation : hotelLocation;

    addMessage("Starting Elevator and Room Access sequence...");
    
    if (currentLocation) {
      const elevatorLocation = { lat: currentLocation.lat + 0.0001, lng: currentLocation.lng + 0.0001 };
      setUserGps(elevatorLocation);
      addMessage("Location updated: Elevator Lobby");
    }

    // 1. Call Identity
    addMessage("Verifying identity for elevator access...");
    const identityResult = await checkIdentityIntegrity(false, 'Checked In'); // Call without showing main loader

    // 2. Wait and grant elevator access
    await new Promise(resolve => setTimeout(resolve, 5000));
    if (identityResult) {
      addMessage("Identity confirmed. Elevator access granted to floor 13.");
    } else {
      addMessage("Could not grant elevator access. Identity check failed.");
      return; // Stop sequence if initial checks fail
    }

    // 3. Simulate room access attempt
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (currentLocation) {
      const roomLocation = { lat: currentLocation.lat + 0.0002, lng: currentLocation.lng + 0.0002 };
      setUserGps(roomLocation);
      addMessage("Location updated: Room 1337 Entrance");
    }

    addMessage("Tap phone on room door lock to re-verify...");
    setRfidStatus('Verified');

    await new Promise(resolve => setTimeout(resolve, 5000));
    addMessage("Re-checking identity integrity at the door...");
    const roomAccessIdentityResult = await checkIdentityIntegrity(false, 'Checked In'); // Re-check integrity without main loader

    if (roomAccessIdentityResult) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      addMessage("Identity re-confirmed. Room access granted.");
    } else {
      addMessage("Room access denied. Identity check failed at the door.");
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    setRfidStatus('Not Verified');
    addMessage("RFID status reset.");
  };

  // --- Identity Integrity Timeout Logic ---
  useEffect(() => {
    if (identityIntegrity === 'Good' && lastIntegrityCheckTime && artificialTime) {
      const oneHourInMs = 60 * 60 * 1000;
      const timeSinceCheck = artificialTime.getTime() - lastIntegrityCheckTime.getTime();

      if (timeSinceCheck > oneHourInMs) {
        setIdentityIntegrity('Bad');
      }
    }
  }, [artificialTime, identityIntegrity, lastIntegrityCheckTime, setIdentityIntegrity]);


  useEffect(() => {
    if (isSequenceRunning && verifiedPhoneNumber) {
      const timer = setInterval(() => {
        setArtificialTime(prevTime => prevTime ? new Date(prevTime.getTime() + 50000) : getInitialArtificialTime(simulationMode));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSequenceRunning, verifiedPhoneNumber, simulationMode, setArtificialTime]);


  useEffect(() => {
    const mapInstance = L.map('map').setView([-33.8688, 151.2093], 12); // Initial view, will be updated by other useEffect
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, []);

  // Fix map rendering issues when switching tabs
  useEffect(() => {
    if (activeTab === 'details' && map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }
  }, [activeTab, map]);

  useEffect(() => {
    if (map) {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline || !layer._url) { // Keep tile layer
          map.removeLayer(layer);
        }
      });

      if (userGps && !mapUpdateThrottle.current) {
        mapUpdateThrottle.current = setTimeout(() => {
          mapUpdateThrottle.current = null;
        }, 1000); // Shorter throttle for smoother updates

        const updateMapView = () => {
          if (hotelLocation) {
            const distance = getDistance(userGps, hotelLocation);
            const ZOOM_START_RADIUS = 2000; // Start zooming within 4km
            const MIN_ZOOM = 12;
            const MAX_ZOOM = 18;

            let newZoom;
            if (distance >= ZOOM_START_RADIUS) {
              newZoom = MIN_ZOOM;
            } else {
              const zoomProgress = 1 - (distance / ZOOM_START_RADIUS);
              newZoom = MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * zoomProgress;
            }

            const midLat = (userGps.lat + hotelLocation.lat) / 2;
            const midLng = (userGps.lng + hotelLocation.lng) / 2;

            map.setView([midLat, midLng], newZoom, { animate: true, pan: { duration: 2.5 } });
          } else {
            // If no hotel location, just center on user
            map.setView([userGps.lat, userGps.lng], 15, { animate: true, pan: { duration: 1.0 } });
          }
        }
        updateMapView();
      }

      if (hotelLocation && hotelLocation.lat && hotelLocation.lng) {
        L.marker([hotelLocation.lat, hotelLocation.lng]).addTo(map).bindPopup('Hotel: Telstra Towers');

        L.circle([hotelLocation.lat, hotelLocation.lng], {
          color: 'green',
          fillColor: '#28a745',
          fillOpacity: 0.2,
          radius: 100 // CHECK_IN_RADIUS
        }).addTo(map).bindPopup('Hotel Check-in Area');
      }

      if (userGps) {
        const userIcon = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1E90FF" width="32px" height="32px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/><path d="M0 0h24v24H0z" fill="none"/></svg>`,
          className: 'user-location-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });

        L.marker([userGps.lat, userGps.lng], { icon: userIcon }).addTo(map).bindPopup('User Location');
      }

      if (secondUserGps) {
        const secondUserIcon = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF4500" width="32px" height="32px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/><path d="M0 0h24v24H0z" fill="none"/></svg>`,
          className: 'user-location-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });
        L.marker([secondUserGps.lat, secondUserGps.lng], { icon: secondUserIcon }).addTo(map).bindPopup('Second User (Mock)');
      }
    }
  }, [map, userGps, hotelLocation, secondUserGps]);

  const validatePhone = async (e) => { // Made async to await api.locationRetrieval
    e.preventDefault();
    const fullPhoneNumber = phone.replace(/\s/g, '');
    const regex = /^\+\d{10,15}$/
    setError('');
    setSuccess('');

    if (!regex.test(fullPhoneNumber)) {
      setError('Please enter a valid international phone number (e.g., +61412345678).');
      return;
    }

    setIsLoading(true);
    try {
      const verificationData = await api.verifyPhoneNumber(fullPhoneNumber, logApiInteraction);
      if (verificationData.devicePhoneNumberVerified === true) {
        addMessage("Phone number is verified...");
        setSuccess('Phone number is verified.');
        setVerifiedPhoneNumber(fullPhoneNumber);
      } else {
        setError(`Phone number verification failed.`);
      }
    } catch (err) {
      console.error('API call failed:', err);
      setError('An error occurred during verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMatchStatus = (status) => {
    if (status === null || status === undefined || status === 'true') {
      return null;
    }

    let text = '';
    if (status === 'false') {
      text = 'Not Match';
    } else if (status === 'not_available') {
      text = 'Not Available';
    }

    return (
      <div className="status-text-error">{text}</div>
    );
  };

  const renderCountdown = () => {
    const prefix = simulationMode === 'arrival' ? 'Check-in' : 'Check-out';

    if (simulationMode === 'arrival' && checkInStatus === 'Checked In') {
      return <p>Time to Check-in: 00:00:00</p>;
    }
    if (simulationMode === 'departure' && checkInStatus === 'Checked Out') {
      return <p>Time to Check-out: 00:00:00</p>;
    }

    if (!artificialTime) {
      return <p>Time to {prefix}: --:--:--</p>;
    }
    const targetDate = simulationMode === 'arrival' ? CHECK_IN_DATE : CHECK_OUT_DATE;
    const diff = targetDate.getTime() - artificialTime.getTime();

    if (diff <= 0) {
      return <p>{prefix} Open: 00:00:00</p>;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const formattedTime = [hours, minutes, seconds].map(v => v.toString().padStart(2, '0')).join(':');

    return <p>Time to {prefix}: {formattedTime}</p>;
  };

  const handleStartSequence = async (mode) => {
    if (!verifiedPhoneNumber) {
      alert('Please verify your phone number first.');
      return;
    }

    setIsSequenceRunning(true);
    try {
      setArtificialTime(getInitialArtificialTime(mode));
      setSimulationMode(mode);
      if (mode === 'arrival') {
        setIsLoading(true);
        // Fetch actual hotel location
        const hotelLocationData = await api.locationRetrieval(verifiedPhoneNumber, logApiInteraction);
        const actualHotelCoords = {
          lat: hotelLocationData.area.center.latitude,
          lng: hotelLocationData.area.center.longitude
        };
        setHotelLocation(actualHotelCoords);

        // Set initial user location slightly away from the hotel
        const userStartLat = actualHotelCoords.lat + 0.05; // 0.05 degrees ~ 5.5 km
        const userStartLng = actualHotelCoords.lng + 0.05;
        const initialUserCoords = { lat: userStartLat, lng: userStartLng };

        setInitialUserLocation(initialUserCoords);
        setUserGps(initialUserCoords);
        setIsLoading(false);

        await api.startBookingAndArrivalSequence(
          verifiedPhoneNumber,
          initialUserCoords, // Use the newly set initialUserCoords
          actualHotelCoords, // Use the newly fetched actualHotelCoords
          addMessage,
          setLocation,
          setUserGps,
          setCheckInStatus,
          setRfidStatus,
          setPaymentStatus,
          setElevatorAccess,
          setRoomAccess,
          generateRoute,
          setArtificialTime,
          handleAccessSequence, // Pass the access handler to the arrival sequence
          logApiInteraction // Pass logger
        );
      } else if (mode === 'departure') {
        const guestName = formState.name ? `${formState.name}` : 'Guest';
        await api.startCheckOutSequence(
          verifiedPhoneNumber,
          initialUserLocation,
          hotelLocation,
          addMessage,
          setLocation,
          setUserGps,
          setCheckInStatus,
          generateRoute,
          setArtificialTime,
          setPaymentStatus,
          setElevatorAccess, // Pass setters to reset access
          setRoomAccess, // Pass setters to reset access
          guestName, // Pass guestName to the API call
          logApiInteraction // Pass logger
        );

        setTimeout(() => {
          setVerifiedPhoneNumber(null);
          setKycMatchResponse(null);
          setLocation(null);
          setSimulationMode('arrival');
          setRegistrationStatus('Not Registered');
          setArtificialTime(null);
          setIdentityIntegrity('Bad');
          setCheckInStatus('Not Checked In');
          setPaymentStatus('Not Paid');
          setRfidStatus('Unverified');
          setElevatorAccess('No');
          setRoomAccess('No');
          setHotelLocation(null);
          setUserGps(null);
          setInitialUserLocation(null);
          setLastIntegrityCheckTime(null);
          setBleStatus('Idle');
          setSecondUserGps(null);
          setMessages([]);
          setApiLogs([]);
          setFormState(formFields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {}));
          setPhone('');
          setError('');
          setSuccess('');
          setIsSequenceRunning(false);
        }, 15000);
      }
    } catch (error) { // eslint-disable-line no-empty
      console.error('Sequence failed:', error);
      addMessage(`Error during sequence: ${error.message}`);
      setIsSequenceRunning(false);
    } finally {
      setIsLoading(false);
      // You might want to set this to false when the sequence is fully complete
    }
  };

  return (
    <div className="App">
      {isLoading &&
        <div className="loader-overlay">
          <div className="d-flex justify-content-center align-items-center h-100">
            <div className="spinner-border text-light" style={{ width: '3rem', height: '3rem' }} role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      }
      <header className="header">
        <h1><a href="/" className="header-link">Hotels/MDUs Use Case Demo</a></h1>
        <div className="artificial-clock">
          {verifiedPhoneNumber && artificialTime && renderCountdown()}
        </div>
      </header>

      <main className="main-content">
        <div className="dashboard-container">
          
          {/* Navigation Tabs */}
          <ul className="nav nav-tabs mb-3" style={{ paddingLeft: '15px', paddingRight: '15px' }}>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>API Interaction</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Guest Dashboard</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>All Details</button>
            </li>
          </ul>

          {/* Main Content Area */}
          <div className="dashboard-main" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
            
            {/* Tab 1: API Interaction (Full Width) */}
            <div className={`dashboard-column ${activeTab === 'api' ? '' : 'd-none'}`} style={{ width: '100%' }}>
              <div id="apiLogs" className="card">
                <h2 className="card-header">Network API Request-Response</h2>
                <div className="p-3" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {apiLogs.length === 0 ? <p>No API interactions recorded.</p> : (
                    <div className="api-log-list">
                      {apiLogs.map(log => (
                        <div key={log.id} className="api-log-entry mb-3 p-3 border rounded bg-white">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="m-0">{log.title}</h5>
                            <small className="text-muted">{new Date(log.timestamp).toLocaleTimeString()}</small>
                          </div>
                          <div className="mb-2">
                            <span className={`badge ${log.method === 'GET' ? 'badge-info' : 'badge-success'} mr-2`}>{log.method}</span>
                            <code className="text-dark">{log.url}</code>
                          </div>
                          <div className="row">
                            <div className="col-md-6">
                                <strong>Request:</strong>
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto'}}>{JSON.stringify(log.request, null, 2)}</pre>
                            </div>
                            <div className="col-md-6">
                                <strong>Response:</strong>
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto'}}>{JSON.stringify(log.response, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab 2 & 3: Dashboard & Details - Left Column */}
            <div className={`dashboard-column ${activeTab !== 'api' ? '' : 'd-none'}`} style={{ flex: '1', minWidth: '300px' }}>
              
              {/* Action Buttons */}
              <div id="actionButtons" className="card">
                <h2 className="card-header">Actions</h2>
                <div className="p-3">
                  <div className="api-buttons">
                    <button className="btn btn-primary" onClick={handleRegistrationSequence}>Start Registration</button>
                    {checkInStatus !== 'Checked In' && (
                      <button className="btn btn-primary" onClick={() => handleStartSequence('arrival')}>Booking & Arrival</button>
                    )}
                    {checkInStatus === 'Checked In' && <>
                      <button className="btn btn-primary" onClick={handleAccessSequence}>Elevator & Room Access</button>
                      <button className="btn btn-primary" onClick={() => handleStartSequence('departure')}>Checkout</button>
                    </>}
                  </div>
                </div>
              </div>

              {/* Phone Verification */}
              <div id="verification-container" className="card">
                <h2 className="card-header">1. Phone Verification</h2>
                <form onSubmit={validatePhone} className="p-3">
                  <div className="verify-form-container">
                    <div className="form-group">
                      <input type="text" id="phone" className="form-control" placeholder="e.g., +61412345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <button type="submit" id="verifyBtn" className="btn btn-primary">Verify</button>
                  </div>
                  {error && <div id="error" className="alert alert-danger">{error}</div>}
                  {success && <div id="success" className="alert alert-success">{success}</div>}
                  {!verifiedPhoneNumber && !error && <div className="alert alert-info">Please verify the phone number.</div>}
                </form>
              </div>

              {/* User Status */}
              <div id="userStatus" className="card">
                <h2 className="card-header">2. User Status</h2>
                <ul className="details-list">
                  <li><strong>Identity Integrity:</strong> <span id="identity-status" style={{ color: identityIntegrity === 'Good' ? 'green' : (identityIntegrity === 'Bad' ? 'red' : 'black') }}>{identityIntegrity}</span>
                    <button className="btn btn-primary" onClick={() => checkIdentityIntegrity(true, checkInStatus)}>Check</button>
                  </li>
                  <li><strong>Registration Status:</strong> <span style={{ color: registrationStatus === 'Registered' ? 'green' : 'red' }}>{registrationStatus}</span>
                  </li>
                  <li><strong>Check-in Status:</strong> <span style={{ color: checkInStatus === 'Checked In' ? 'green' : 'red' }}>{checkInStatus}</span></li>
                  <li><strong>Payment Status:</strong> <span style={{ color: paymentStatus === 'Paid' ? 'green' : 'red' }}>{paymentStatus}</span></li>
                  <li><strong>RFID Verification:</strong> <span style={{ color: rfidStatus === 'Verified' ? 'green' : 'red' }}>{rfidStatus}</span></li>
                  <li><strong>Elevator Access:</strong> <span>{elevatorAccess}</span></li>
                  <li><strong>Room Access:</strong> <span>{roomAccess}</span></li>
                </ul>
              </div>

              {/* MWC BLE Section (Details Only) */}
              <div id="mwcSection" className={`card ${(activeTab === 'details') ? '' : 'd-none'}`}>
                <h2 className="card-header">MWC Location Access (BLE)</h2>
                <div className="p-3">
                  <p>Scan for local beacons to verify location.</p>
                  <div className="btn-group">
                    <button className="btn btn-secondary" onClick={testAndroidBridge}>Test Bridge</button>
                    <button className="btn btn-primary" onClick={scanForBeacon}>Manual Scan</button>
                    <button className={`btn ${isAutoScanning ? 'btn-danger' : 'btn-success'}`} onClick={toggleAutoScan} style={{marginLeft: '10px'}}>
                      {isAutoScanning ? 'Stop Auto-Tracking' : 'Start Auto-Tracking'}
                    </button>
                  </div>
                  <div className="mt-2">
                    <strong>Status: </strong>
                    <span style={{ color: bleStatus === 'Connected' ? 'green' : (bleStatus === 'Failed' ? 'red' : 'black') }}>
                      {bleStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab 2 & 3: Dashboard & Details - Right Column */}
            <div className={`dashboard-column ${activeTab !== 'api' ? '' : 'd-none'}`} style={{ flex: '1', minWidth: '300px' }}>
              
              {/* Booking Details (Moved from User Status) */}
              <div id="bookingDetails" className="card">
                <h2 className="card-header">Booking Details</h2>
                <ul className="details-list">
                  <li><strong>Hotel:</strong> <span>{verifiedPhoneNumber ? 'Telstra Towers Melbourne' : '--'}</span></li>
                  <li><strong>Room:</strong> <span>{verifiedPhoneNumber ? '1337' : '--'}</span></li>
                  <li><strong>Check-in:</strong> <span>{verifiedPhoneNumber ? format(CHECK_IN_DATE, 'yyyy-MM-dd HH:mm') : '--'}</span></li>
                  <li><strong>Check-out:</strong> <span>{verifiedPhoneNumber ? format(CHECK_OUT_DATE, 'yyyy-MM-dd HH:mm') : '--'}</span></li>
                </ul>
              </div>
              
              {/* User Profile Section (Full-width) */}
              <div id="userDetails" className="card" ref={userProfileRef}>
                <h2 className="card-header">3. User Profile Details</h2>
                <form id="user-form" className="user-profile-form p-3">
                  <div className="row" style={{ margin: "0px" }}>
                    {formFields.map(field => (
                      <div className="col-md-6" key={field.name}>
                        <div className="form-group">
                          <label htmlFor={field.name}>{field.label}</label>
                          <div className="input-with-status">
                            {field.type === 'select' ? (
                              <select id={field.name} name={field.name} className={`form-control ${kycMatchResponse && (kycMatchResponse[`${field.name}Match`] === 'false' || kycMatchResponse[`${field.name}Match`] === 'not_available') ? 'input-match-error' : kycMatchResponse && kycMatchResponse[`${field.name}Match`] === 'true' ? 'input-match-success' : ''}`} value={formState[field.name]} onChange={handleInputChange}>
                                {field.options.map(option => (
                                  <option key={option} value={option} >{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type}
                                id={field.name}
                                name={field.name}
                                className={`form-control ${kycMatchResponse && (kycMatchResponse[`${field.name}Match`] === 'false' || kycMatchResponse[`${field.name}Match`] === 'not_available') ? 'input-match-error' : kycMatchResponse && kycMatchResponse[`${field.name}Match`] === 'true' ? 'input-match-success' : ''}`}
                                value={formState[field.name]}
                                onChange={handleInputChange}
                              />
                            )}
                            {kycMatchResponse && renderMatchStatus(kycMatchResponse[`${field.name}Match`], field.name)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="btn-container">
                    <button type="button" id="submitKycBtn" className="btn btn-primary" onClick={submitKyc}>KYC Match</button>
                  </div>
                </form>
              </div>

              {/* Activity Logs */}
              <div id="activityLogs" className={`card ${(activeTab === 'details') ? '' : 'd-none'}`}>
                <h2 className="card-header">Activity Logs</h2>
                <div className="p-3">
                  <div id="response-container" ref={responseContainerRef} style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: 'black', border: '1px solid #dee2e6', padding: '10px' }}>
                    <pre id="api-response" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'white' }}>{messages.join('\n')}</pre>
                  </div>
                </div>
              </div>

              {/* API Logs (Details Only) */}
              <div id="apiLogsDetails" className={`card ${(activeTab === 'details') ? '' : 'd-none'}`}>
                <h2 className="card-header">Network API Request-Response</h2>
                <div className="p-3" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {apiLogs.length === 0 ? <p>No API interactions recorded.</p> : (
                    <div className="api-log-list">
                      {apiLogs.map(log => (
                        <div key={log.id} className="api-log-entry mb-3 p-3 border rounded bg-white">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="m-0">{log.title}</h5>
                            <small className="text-muted">{new Date(log.timestamp).toLocaleTimeString()}</small>
                          </div>
                          <div className="mb-2">
                            <span className={`badge ${log.method === 'GET' ? 'badge-info' : 'badge-success'} mr-2`}>{log.method}</span>
                            <code className="text-dark">{log.url}</code>
                          </div>
                          <div className="row">
                            <div className="col-md-6">
                                <strong>Request:</strong>
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto'}}>{JSON.stringify(log.request, null, 2)}</pre>
                            </div>
                            <div className="col-md-6">
                                <strong>Response:</strong>
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto'}}>{JSON.stringify(log.response, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Location Tracker */}
              <div id="locationTracker" className="card">
                <h2 className="card-header">Location Tracker</h2>
                <div className="p-2">
                  <button className="btn btn-sm btn-info" style={{ marginRight: '10px' }} onClick={enableRealLocation}>Use Device GPS</button>
                  <button className="btn btn-sm btn-warning" onClick={toggleSecondUser}>
                    {secondUserGps ? 'Remove 2nd User' : 'Mock 2nd User'}
                  </button>
                </div>
                <div id="map" style={{ height: '700px', width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        &copy; 2025 Telstra Hackathon
      </footer>
    </div>
  );
}
export default App;
