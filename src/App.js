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
import GuestTab from './components/GuestTab';
import authService from './auth';
import RSSIProcessor from './rssiProcessor';
import proximityConfig from './proximityConfig';


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

// --- Proximity Detection Configuration ---
const PROXIMITY_THRESHOLDS = {
  IMMEDIATE: -55,    // ~0.5 meter (trigger actions when RSSI >= -50, very close proximity)
  NEAR: -65,         // ~1 meter  
  FAR: -75,          // ~2+ meters 
  OUT_OF_RANGE: -85  // Ignore
};

// Track active beacons for strongest signal priority
const activeBeacons = new Map();
// --- End of Proximity Detection Configuration ---

// --- Custom Hook for State Synchronization ---
const useSyncedState = (key, initialValue) => {
  const [state, setState] = useState(initialValue);
  const channelRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (!channelRef.current) {
        channelRef.current = new BroadcastChannel('hotel_mdu_sync');
        console.log('[App] BroadcastChannel created for key:', key);
      }
    }
    
    const channel = channelRef.current;

    const handler = (event) => {
      if (event.data.key === key) {
        console.log('[App] Received broadcast for', key, ':', event.data.value);
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
      console.log('[App] Broadcasting', key, ':', value);
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
  const authCheckExecuted = useRef(false);
  
  // OAuth Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [tokenExpirySeconds, setTokenExpirySeconds] = useState(0);
  
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
  const [guestMessages, setGuestMessages] = useSyncedState('guestMessages', []);
  const [formState, setFormState] = useSyncedState('formState',
    formFields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})
  );
  const [checkInConsent, setCheckInConsent] = useSyncedState('checkInConsent', false);

  // --- Local State (Specific to this window/monitor) ---
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [map, setMap] = useState(null);
  const [activeTab, setActiveTab] = useState('api');
  
  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab]);
  const [isSequenceRunning, setIsSequenceRunning] = useSyncedState('isSequenceRunning', false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [museumMap, setMuseumMap] = useState(null);
  const [hasReachedHotel, setHasReachedHotel] = useSyncedState('hasReachedHotel', false);
  const [processedBeacons, setProcessedBeacons] = useSyncedState('processedBeacons', []);
  const [showManualGateButton, setShowManualGateButton] = useState(false);
  const [currentWaitingStage, setCurrentWaitingStage] = useState(null);

  // Track current waiting stage from API
  useEffect(() => {
    const interval = setInterval(() => {
      const stage = api.getCurrentWaitingStage();
      setCurrentWaitingStage(stage);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // OAuth Authentication Effect
  useEffect(() => {
    // Prevent double execution in StrictMode
    if (authCheckExecuted.current) {
      console.log('⚠️ Auth check already executed, skipping...');
      return;
    }
    authCheckExecuted.current = true;
    
    console.log('🚀 App mounted, checking authentication...');
    
    // Redirect from /redirect to / if no code
    if (window.location.pathname === '/redirect' && !window.location.search.includes('code=')) {
      console.log('⚠️ On /redirect without code, redirecting to /');
      window.location.href = '/';
      return;
    }
    
    const checkAuth = async () => {
      const authResult = await authService.checkAndHandleCallback();
      
      if (authResult) {
        if (authResult.success) {
          setIsAuthenticated(true);
          setAuthError(null);
          localStorage.setItem('has_authenticated', 'true');
          sessionStorage.removeItem('auth_in_progress');
          console.log('✅ Authentication successful, token set');
          
          // Restore app state after re-authentication
          const savedState = authService.restoreAppState();
          if (savedState && savedState.activeTab) {
            console.log('💾 Restoring app state:', savedState);
            setActiveTab(savedState.activeTab);
            localStorage.setItem('activeTab', savedState.activeTab);
            // Restore phone number if it was saved
            if (savedState.phoneNumber) {
              setPhone(savedState.phoneNumber);
              // Auto-trigger phone verification after re-authentication
              setTimeout(() => {
                const verifyBtn = document.getElementById('verifyBtn');
                if (verifyBtn && !sessionStorage.getItem('verify_triggered')) {
                  sessionStorage.setItem('verify_triggered', 'true');
                  verifyBtn.click();
                  // Clear flag after 2 seconds
                  setTimeout(() => sessionStorage.removeItem('verify_triggered'), 2000);
                }
              }, 500);
            }
          }
        } else if (authResult.error) {
          setAuthError(authResult.error);
          localStorage.removeItem('has_authenticated');
          sessionStorage.removeItem('auth_in_progress');
        }
        setIsAuthenticating(false);
        return;
      }
      
      if (authService.isAuthenticated()) {
        console.log('✅ Token still valid, restoring authentication state');
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        sessionStorage.removeItem('auth_in_progress');
        return;
      }
      
      // Check if authentication is already in progress
      if (sessionStorage.getItem('auth_in_progress')) {
        console.log('⚠️ Authentication already in progress, skipping...');
        setIsAuthenticating(false);
        return;
      }
      
      // Auto-authenticate only on first visit (when flag doesn't exist)
      const hasAuthenticated = localStorage.getItem('has_authenticated');
      if (!hasAuthenticated) {
        console.log('🔐 First visit - triggering auto-authentication');
        sessionStorage.setItem('auth_in_progress', 'true');
        const phoneToUse = '+99999991000';
        setTimeout(async () => {
          try {
            await authService.authenticate(phoneToUse);
          } catch (error) {
            console.error('Auto-authentication failed:', error);
            setAuthError(error.message);
            sessionStorage.removeItem('auth_in_progress');
            setIsAuthenticating(false);
          }
        }, 100);
      } else {
        console.log('⚠️ Token expired but has_authenticated flag exists - user needs to re-verify');
        sessionStorage.removeItem('auth_in_progress');
        setIsAuthenticating(false);
      }
    };
    
    checkAuth();
  }, []);

  // Token expiry countdown
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      const seconds = authService.getTimeUntilExpiry();
      setTokenExpirySeconds(seconds);
      if (seconds <= 0) {
        setIsAuthenticated(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
  const processBeaconDetectionRef = useRef(null);
  const rssiProcessorRef = useRef(new RSSIProcessor(proximityConfig.getSmoothedConfig()));

  // Connect to Gateway Server when phone is verified (but don't start BLE tracking yet)
  useEffect(() => {
    if (verifiedPhoneNumber) {
      addMessage(`Connected to Gateway Server with demo subscription`);
      gatewayClient.connect(verifiedPhoneNumber); // Pass phone for logging, but uses fixed demo ID internally
      setGatewayConnected(true);
      setBleStatus('Connected');
      
      // Set up BLE subscription that persists across reconnections
      const unsubscribe = gatewayClient.subscribe((data) => {
        const { beaconName, rssi, zone } = data;
        console.log('[App.js subscription] BLE Event received:', beaconName, zone, rssi);
        console.log('[App.js subscription] Full data object:', data);
        console.log('[App.js subscription] isSequenceRunning:', isSequenceRunning, 'hasReachedHotel:', hasReachedHotel);
        // Notify api.js waiting system with beaconName
        console.log('[App.js subscription] Calling api.notifyBeaconDetection with:', beaconName);
        api.notifyBeaconDetection(beaconName);
        // Also call processBeaconDetection for UI updates
        console.log('[App.js subscription] Calling processBeaconDetection with:', beaconName, rssi);
        if (processBeaconDetectionRef.current) {
          processBeaconDetectionRef.current(beaconName, rssi);
        }
      });
      
      // Store unsubscribe function
      bleUnsubscribeRef.current = unsubscribe;
    } else {
      // Stop tracking and disconnect when phone is unverified
      if (bleUnsubscribeRef.current) {
        bleUnsubscribeRef.current();
        bleUnsubscribeRef.current = null;
      }
      setIsAutoScanning(false);
      
      if (gatewayClient.isConnected()) {
        gatewayClient.disconnect();
        setGatewayConnected(false);
        setBleStatus('Disconnected');
      }
    }
    
    return () => {
      if (bleUnsubscribeRef.current) {
        bleUnsubscribeRef.current();
      }
      if (gatewayClient.isConnected()) {
        gatewayClient.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const guestName = formState.name ? formState.name.split(' ')[0] : 'Guest';
      addGuestMessage(`Thank you for staying at Hotel Barcelona Sol, ${guestName}! We hope to see you again soon!`, 'success');
    }
  }, [verifiedPhoneNumber, checkInStatus, kycMatchResponse, formState.name, addMessage, addGuestMessage]);

  const handleRegistrationSequence = async () => {
    if (!verifiedPhoneNumber) {
      alert('Please verify your phone number first to start registration.');
      return;
    }
    
    // Reset all workflow flags for fresh demo run
    setCheckInConsent(false);
    setHasReachedHotel(false);
    setCheckInStatus('Not Checked In');
    setIsSequenceRunning(false);
    
    addMessage("Registration: Starting Process");
    addGuestMessage('Starting your registration process...', 'processing');

    addMessage("Registration: Populating Form with KYC Data");
    const kycData = await api.kycFill(verifiedPhoneNumber, logApiInteraction);
    setFormState(kycData);

    await new Promise(resolve => setTimeout(resolve, 2000));
    const guestName = kycData.name ? kycData.name.split(' ')[0] : 'Guest';
    addMessage('Registration: Form Populated - Ready for Verification');
    addGuestMessage(`Registration form populated, ${guestName}! Please verify your information.`, 'info');
    
    // Set registration status to Registered
    setRegistrationStatus('Registered');
    addMessage('Registration: Status Updated to Registered');
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
        // Don't auto-set registration status - user must click Start Registration
        addMessage('KYC Match: Successful - Ready for Registration');
        addGuestMessage('Your information has been verified successfully!', 'success');
      } else {
        addGuestMessage('Some information could not be verified. Please check and update.', 'error');
      }

    } catch (err) {
      console.error('KYC Match failed:', err);
      addMessage(`KYC Match API Error: ${err.message}`);
      addGuestMessage('Verification failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const checkIdentityIntegrity = useCallback(async (loader, checkInStatus, autoGrant = true, accessType = 'both') => {
    if (!verifiedPhoneNumberRef.current) {
      alert('Please verify phone number first.');
      return false;
    }
    if (loader) setIsLoading(true);
    setIdentityIntegrity('Checking...');
    try {
      const simSwapResult = await api.simSwap(verifiedPhoneNumberRef.current, logApiInteraction);
      const deviceSwapResult = await api.deviceSwap(verifiedPhoneNumberRef.current, logApiInteraction);

      // Check if both SIM and Device are not swapped (good integrity)
      const isGoodIntegrity = !simSwapResult.swapped && !deviceSwapResult.swapped;
      
      if (isGoodIntegrity) {
        setIdentityIntegrity('Good');
        if (artificialTime) setLastIntegrityCheckTime(new Date(artificialTime.getTime()));
        addMessage('Identity Integrity Check: Verified - No SIM/Device swap detected');
        
        // Location Verification after Identity Integrity checks
        if (autoGrant && checkInStatus === 'Checked In' && hotelLocationRef.current) {
          if (accessType === 'elevator' || accessType === 'both') {
            const elevatorRadius = 100;
            addMessage(`Location Verification: Checking elevator access (${elevatorRadius}m radius)...`);
            const elevatorLocationData = {
              device: { phoneNumber: verifiedPhoneNumberRef.current },
              area: {
                areaType: "CIRCLE",
                center: { latitude: hotelLocationRef.current.lat, longitude: hotelLocationRef.current.lng },
                radius: elevatorRadius
              }
            };
            const elevatorVerification = await api.locationVerification(elevatorLocationData, logApiInteraction);
            if (elevatorVerification.verificationResult === "TRUE") {
              addMessage('Location Verification: Elevator access confirmed');
              setElevatorAccess('Yes, Floor 13');
            } else {
              addMessage('Location Verification: Elevator access denied - outside range');
              return false;
            }
          }
          if (accessType === 'room' || accessType === 'both') {
            const roomRadius = 50;
            addMessage(`Location Verification: Checking room access (${roomRadius}m radius)...`);
            const roomLocationData = {
              device: { phoneNumber: verifiedPhoneNumberRef.current },
              area: {
                areaType: "CIRCLE",
                center: { latitude: hotelLocationRef.current.lat, longitude: hotelLocationRef.current.lng },
                radius: roomRadius
              }
            };
            const roomVerification = await api.locationVerification(roomLocationData, logApiInteraction);
            if (roomVerification.verificationResult === "TRUE") {
              addMessage('Location Verification: Room access confirmed');
              setRoomAccess('Granted');
            } else {
              addMessage('Location Verification: Room access denied - outside range');
              return false;
            }
          }
        }
        return true;
      } else {
        setIdentityIntegrity('Bad');
        addMessage('Identity Integrity Check: Failed - SIM/Device swap detected');
        return false;
      }
    } catch (err) {
      console.error('Identity integrity check failed:', err);
      setIdentityIntegrity('Bad');
      addMessage(`Identity Integrity Check: API Error - ${err.message}`);
      return false;
    } finally {
      if (loader) setIsLoading(false);
    }
  }, [artificialTime, logApiInteraction, setIdentityIntegrity, setElevatorAccess, setRoomAccess, setLastIntegrityCheckTime, addMessage]);

  // --- Centralized Beacon Logic with Proximity Detection ---
  const processBeaconDetection = useCallback(async (deviceName, rssi = null) => {
      console.log('[App.js] processBeaconDetection called with:', deviceName, rssi);
      console.log('[App.js] isSequenceRunning:', isSequenceRunning, 'hasReachedHotel:', hasReachedHotel);
      console.log('[App.js] checkInStatus:', checkInStatusRef.current);
      
      // Only process BLE events if arrival sequence is running AND (guest verified at hotel OR it's a Gate beacon)
      if (!isSequenceRunning) {
        console.log('[App.js] Ignoring BLE event - arrival sequence not running yet');
        return;
      }
      
      // Check if it's a Gate beacon
      const isGateBeacon = deviceName.toLowerCase().includes("entry") || deviceName.toLowerCase().includes("gate");
      console.log('[App.js] isGateBeacon check:', isGateBeacon, 'deviceName.toLowerCase():', deviceName.toLowerCase());
      
      if (!hasReachedHotel && !isGateBeacon) {
        console.log('[App.js] Ignoring non-Gate BLE event - guest location not verified yet');
        return;
      }
      
      // Notify the api.js waiting system if there's an active waiting stage
      if (api.getCurrentWaitingStage()) {
        api.notifyBeaconDetection(deviceName);
        console.log('[App.js] Called api.notifyBeaconDetection for waiting stage:', api.getCurrentWaitingStage());
      }
      
      // --- PROXIMITY DETECTION LOGIC ---
      if (rssi !== null) {
        if (proximityConfig.isDirectMode()) {
          // DIRECT MODE: Legacy immediate comparison
          activeBeacons.set(deviceName, { rssi, timestamp: Date.now() });
          
          const now = Date.now();
          for (const [name, data] of activeBeacons.entries()) {
            if (now - data.timestamp > 5000) {
              activeBeacons.delete(name);
            }
          }
          
          const validBeacons = [...activeBeacons.entries()]
            .filter(([name, data]) => data.rssi >= proximityConfig.getDirectThresholds().IMMEDIATE)
            .sort((a, b) => b[1].rssi - a[1].rssi);
          
          if (validBeacons.length === 0) {
            console.log('[App.js] DIRECT: No beacons meet threshold');
            return;
          }
          
          const [closestBeacon, closestData] = validBeacons[0];
          if (closestBeacon !== deviceName) {
            console.log(`[App.js] DIRECT: ${deviceName} not closest`);
            return;
          }
          
          console.log(`[App.js] DIRECT: Processing ${deviceName} (RSSI: ${rssi})`);
          
        } else {
          // SMOOTHED MODE: Moving average with stability
          const result = rssiProcessorRef.current.addReading(deviceName, rssi);
          
          console.log(`[App.js] SMOOTHED: ${deviceName} - Raw: ${rssi}, Avg: ${result.avgRssi?.toFixed(1)}, State: ${result.state}`);
          
          if (!rssiProcessorRef.current.isDetected(deviceName)) {
            console.log('[App.js] SMOOTHED: Beacon not in DETECTED state yet');
            return;
          }
          
          console.log(`[App.js] SMOOTHED: Processing ${deviceName} (stable detection)`);
        }
      }
      
      // Always process BLE events for UI updates (status changes, messages)
      console.log('[App.js] Processing BLE event for UI updates');
      
      const currentHotelLoc = hotelLocationRef.current || { lat: 41.40104, lng: 2.1394 };
      const baseLat = currentHotelLoc.lat;
      const baseLng = currentHotelLoc.lng;
      if (!hotelLocationRef.current) setHotelLocation(currentHotelLoc);
      
      let newLocation = null;
      let locationLabel = "Unknown Area";
      const guestName = formState.name ? formState.name.split(' ')[0] : 'Guest';

      // --- Decision Logic based on Beacon Name with Workflow State Guards ---
      if (deviceName.toLowerCase().includes("entry") || deviceName.toLowerCase().includes("gate")) {
        locationLabel = "Hotel Entry Gate";
        newLocation = { lat: baseLat, lng: baseLng };
        
        // Gate welcome only shows at start OR after checkout (workflow state guard)
        if (checkInStatusRef.current === 'Not Checked In' || checkInStatusRef.current === 'Checked Out') {
          addMessage("Arrived at Hospital Entry Gate");
          addGuestMessage(`Welcome to Hospital de Llobregat, ${guestName}! You have arrived at the hospital entrance.`, 'info');
          
          // Only set status to 'At Kiosk' if patient has been verified at hospital location
          if (checkInStatusRef.current !== 'Checked In' && hasReachedHotel) {
              console.log('[App.js] Setting checkInStatus to At Kiosk due to Gate beacon (patient verified at hospital)');
              setCheckInStatus('At Kiosk');
              addMessage('Gate Access: Kiosk Available');
          }
        } else {
          console.log('[App.js] Gate beacon ignored - user already checked in');
          addMessage("At Hospital Entry Gate (already checked in)");
        }
        
      } else if (deviceName.toLowerCase().includes("kiosk") || deviceName.toLowerCase().includes("lobby")) {
        locationLabel = "Check-in Kiosk";
        newLocation = { lat: baseLat + 0.00005, lng: baseLng + 0.00003 };
        
        // Only log kiosk location if user hasn't progressed beyond check-in (no elevator access yet)
        if (elevatorAccessRef.current === 'No') {
            addMessage("At Check-in Kiosk");
        }
        
        // Only trigger check-in if consent has been given and not already checked in
        if (checkInStatusRef.current !== 'Checked In' && checkInConsent) {
            addMessage("Check-in Process: Starting");
            addGuestMessage('Processing your check-in...', 'processing');
            setCheckInStatus("Checked In");
            setRfidStatus("Verified");
            
            // Skip any waiting beacon in API sequence
            if (api.getCurrentWaitingStage()) {
                api.skipCurrentBeacon();
            }
            
            setTimeout(() => {
              setRfidStatus("Unverified");
              addGuestMessage(`Check-in complete, ${guestName}! Welcome to Room 1337. Enjoy your stay!`, 'success');
            }, 3000);
        } else if (checkInStatusRef.current !== 'Checked In') {
            addGuestMessage('Please confirm your check-in on the Guest Information tab.', 'info');
        }

      } else if (deviceName.toLowerCase().includes("elevator") || deviceName.toLowerCase().includes("lift")) {
        console.log('[App.js] Detected Elevator beacon:', deviceName);
        console.log('[App.js] checkInStatus:', checkInStatusRef.current, 'elevatorAccess:', elevatorAccessRef.current);
        locationLabel = "Elevator Lobby";
        newLocation = { lat: baseLat + 0.00008, lng: baseLng + 0.00005 };
        
        // Only log location if user is checked in
        if (checkInStatusRef.current === 'Checked In') {
            addMessage("At Elevator Lobby");
        }
        
        // BLE-triggered Elevator Access - only after check-in and if not already granted
        if (checkInStatusRef.current === 'Checked In' && elevatorAccessRef.current !== 'Yes, Floor 13') {
            console.log('[App.js] Triggering elevator access verification');
            addMessage("Elevator Access: Verifying Identity");
            addGuestMessage('Verifying your identity for elevator access...', 'processing');
            const identityResult = await checkIdentityIntegrity(false, 'Checked In', true, 'elevator'); // Only grant elevator access
            if (identityResult) {
                setElevatorAccess('Yes, Floor 13');
                addMessage("Elevator Access: Granted to Floor 13");
                addGuestMessage('Elevator access granted! Proceeding to Floor 13.', 'success');
            } else {
                addMessage("Elevator Access: Denied");
                addGuestMessage('Elevator access denied. Please contact reception.', 'error');
            }
        } else if (checkInStatusRef.current !== 'Checked In') {
            console.log('[App.js] Elevator access denied - not checked in');
            addGuestMessage('Please complete check-in first to access the elevator.', 'info');
        } else {
            console.log('[App.js] Elevator access already granted');
        }

      } else if (deviceName.toLowerCase().includes("room") || deviceName.toLowerCase().includes("door")) {
        console.log('[App.js] Detected Room beacon:', deviceName);
        console.log('[App.js] checkInStatus:', checkInStatusRef.current, 'roomAccess:', roomAccessRef.current, 'elevatorAccess:', elevatorAccessRef.current);
        locationLabel = "Room 1337";
        newLocation = { lat: baseLat + 0.00012, lng: baseLng + 0.00008 };
        
        // Only log location if user is checked in
        if (checkInStatusRef.current === 'Checked In') {
            addMessage("At Room 1337 Door");
        }
        
        // BLE-triggered Room Access - only after check-in, elevator access granted, and room access not already granted
        if (checkInStatusRef.current === 'Checked In' && elevatorAccessRef.current === 'Yes, Floor 13' && roomAccessRef.current !== 'Granted') {
             console.log('[App.js] Triggering room access verification');
             addMessage("Room Access: Verifying Identity");
             addGuestMessage('Verifying your identity for room access...', 'processing');
             const identityResult = await checkIdentityIntegrity(false, 'Checked In', true, 'room'); // Only grant room access
             if (identityResult) {
                 setRoomAccess('Granted');
                 setRfidStatus('Verified');
                 setTimeout(() => setRfidStatus('Unverified'), 3000);
                 addMessage("Room Access: Granted - Door Unlocked");
                 addGuestMessage(`Welcome to your room, ${guestName}! Door unlocked. Enjoy your stay!`, 'success');
             } else {
                 addMessage("Room Access: Denied");
                 addGuestMessage('Room access denied. Please contact reception.', 'error');
             }
        } else if (checkInStatusRef.current !== 'Checked In') {
            console.log('[App.js] Room access denied - not checked in');
            addGuestMessage('Please complete check-in first to access your room.', 'info');
        } else if (elevatorAccessRef.current !== 'Yes, Floor 13') {
            console.log('[App.js] Room access denied - elevator access required first');
            addGuestMessage('Please obtain elevator access first to reach your floor.', 'info');
        } else {
            console.log('[App.js] Room access already granted');
        }
      }
      
      if (newLocation) setUserGps(newLocation);
  }, [addMessage, addGuestMessage, formState.name, setHotelLocation, setCheckInStatus, setRfidStatus, setElevatorAccess, setRoomAccess, setUserGps, checkIdentityIntegrity, isSequenceRunning, hasReachedHotel, checkInConsent]);

  // Show manual Gate button after 3 seconds if waiting for gate
  useEffect(() => {
    if (isSequenceRunning && hasReachedHotel && currentWaitingStage === 'gate') {
      const timer = setTimeout(() => {
        setShowManualGateButton(true);
        addMessage('Manual Gate button available - BLE not detected for 3 seconds');
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowManualGateButton(false);
    }
  }, [isSequenceRunning, hasReachedHotel, currentWaitingStage, addMessage]);

  // Update ref whenever processBeaconDetection changes
  useEffect(() => {
    processBeaconDetectionRef.current = processBeaconDetection;
  }, [processBeaconDetection]);







  const handleAccessSequence = async (passedLocation) => {
    const currentLocation = (passedLocation && passedLocation.lat) ? passedLocation : hotelLocation;
    const guestName = formState.name ? formState.name.split(' ')[0] : 'Guest';

    addMessage("Access Sequence: Starting Elevator & Room Access");
    
    // 1. Move to elevator and verify
    if (currentLocation) {
      const elevatorLocation = { lat: currentLocation.lat + 0.00008, lng: currentLocation.lng + 0.00005 };
      setUserGps(elevatorLocation);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    addMessage("Elevator Access: Verifying Identity");
    addGuestMessage('Verifying your identity for elevator access...', 'processing');
    const elevatorIdentityResult = await checkIdentityIntegrity(false, 'Checked In', true, 'elevator');

    await new Promise(resolve => setTimeout(resolve, 3000));
    if (elevatorIdentityResult) {
      addMessage("Elevator Access: Granted to Floor 13");
      addGuestMessage('Elevator access granted! Proceeding to Floor 13.', 'success');
    } else {
      addMessage("Elevator Access: Denied - Identity Check Failed");
      addGuestMessage('Elevator access denied. Please contact reception.', 'error');
      return;
    }

    // 2. Move to room and verify
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (currentLocation) {
      const roomLocation = { lat: currentLocation.lat + 0.00012, lng: currentLocation.lng + 0.00008 };
      setUserGps(roomLocation);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    addMessage("Room Access: Verifying Identity");
    addGuestMessage('Verifying your identity for room access...', 'processing');
    setRfidStatus('Verified');

    await new Promise(resolve => setTimeout(resolve, 3000));
    const roomAccessIdentityResult = await checkIdentityIntegrity(false, 'Checked In', true, 'room');

    if (roomAccessIdentityResult) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      addMessage("Room Access: Granted - Door Unlocked");
      addGuestMessage(`Welcome to your room, ${guestName}! Door unlocked. Enjoy your stay!`, 'success');
    } else {
      addMessage("Room Access: Denied - Identity Check Failed");
      addGuestMessage('Room access denied. Please contact reception.', 'error');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    setRfidStatus('Unverified');
  };

  // --- Identity Integrity Timeout Logic ---
  useEffect(() => {
    if (identityIntegrity === 'Good' && lastIntegrityCheckTime && artificialTime) {
      const oneHourInMs = 60 * 60 * 1000;
      const timeSinceCheck = artificialTime.getTime() - lastIntegrityCheckTime.getTime();

      // Don't reset to Bad during checkout - user has already been verified multiple times
      if (timeSinceCheck > oneHourInMs && checkInStatus !== 'Checked Out') {
        setIdentityIntegrity('Bad');
      }
    }
  }, [artificialTime, identityIntegrity, lastIntegrityCheckTime, checkInStatus, setIdentityIntegrity]);


  useEffect(() => {
    if (isSequenceRunning && verifiedPhoneNumber) {
      const timer = setInterval(() => {
        setArtificialTime(prevTime => prevTime ? new Date(prevTime.getTime() + 1000) : getInitialArtificialTime(simulationMode));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSequenceRunning, verifiedPhoneNumber, simulationMode, setArtificialTime]);


  useEffect(() => {
    const mapInstance = L.map('map').setView([41.39256127381875, 2.178483834574889], 12); // Barcelona coordinates
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
    if ((activeTab === 'details' || activeTab === 'dashboard') && map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }
  }, [activeTab, map]);

  useEffect(() => {
    if (map) {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline || !layer._url) {
          map.removeLayer(layer);
        }
      });

      const defaultHotelCoords = { lat: 41.40104, lng: 2.1394 };
      const currentHotelLoc = hotelLocation || defaultHotelCoords;
      const hotelIcon = L.icon({
        iconUrl: `${process.env.PUBLIC_URL}/hotel_logo.png`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });
      L.marker([currentHotelLoc.lat, currentHotelLoc.lng], { icon: hotelIcon }).addTo(map).bindPopup('Hospital de Llobregat');

      if (hotelLocation && hotelLocation.lat && hotelLocation.lng) {
        L.circle([hotelLocation.lat, hotelLocation.lng], {
          color: 'green',
          fillColor: '#28a745',
          fillOpacity: 0.2,
          radius: 100
        }).addTo(map).bindPopup('Hotel Check-in Area');
      }

      if (userGps) {
        const distance = hotelLocation ? getDistance(userGps, hotelLocation) : null;
        
        const updateMapView = () => {
          if (hotelLocation && distance !== null) {
            const ZOOM_START_RADIUS = 2000;
            const MIN_ZOOM = 12;
            const MAX_ZOOM = 15;
            const HOTEL_ZOOM = 16.5;

            let newZoom;
            if (distance >= ZOOM_START_RADIUS) {
              newZoom = MIN_ZOOM;
            } else if (distance <= 100) {
              newZoom = HOTEL_ZOOM;
            } else {
              const zoomProgress = 1 - (distance / ZOOM_START_RADIUS);
              newZoom = MIN_ZOOM + (MAX_ZOOM - MIN_ZOOM) * zoomProgress;
            }

            if (distance <= 100) {
              map.setView([hotelLocation.lat, hotelLocation.lng], newZoom, { animate: true, pan: { duration: 2.5 } });
            } else {
              const midLat = (userGps.lat + hotelLocation.lat) / 2;
              const midLng = (userGps.lng + hotelLocation.lng) / 2;
              map.setView([midLat, midLng], newZoom, { animate: true, pan: { duration: 2.5 } });
            }
          } else {
            map.setView([userGps.lat, userGps.lng], 15, { animate: true, pan: { duration: 1.0 } });
          }
        }
        updateMapView();

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
    setIsVerifying(true); // Set verifying state immediately

    // Reset form fields and all status when starting fresh verification with new number
    setFormState(formFields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {}));
    setKycMatchResponse(null);
    setHasReachedHotel(false); // Reset hotel arrival status
    // Don't reset identity integrity if user is checked out - they were already verified
    if (checkInStatus !== 'Checked Out') {
      setIdentityIntegrity('Bad'); // Reset identity integrity status
    }
    setRegistrationStatus('Not Registered'); // Reset registration status
    setCheckInStatus('Not Checked In'); // Reset check-in status
    setPaymentStatus('Not Paid'); // Reset payment status
    setRfidStatus('Unverified'); // Reset RFID status
    setElevatorAccess('No'); // Reset elevator access
    setRoomAccess('No'); // Reset room access
    setMessages([]); // Reset activity logs
    setApiLogs([]); // Reset API interaction logs

    if (!regex.test(fullPhoneNumber)) {
      setError('Please enter a valid international phone number (e.g., +61412345678).');
      setIsVerifying(false);
      return;
    }

    // Check if authenticated before proceeding
    if (!authService.isTokenValid()) {
      // Save app state before re-authentication
      const appState = {
        activeTab: activeTab,
        phoneNumber: fullPhoneNumber,
        timestamp: Date.now()
      };
      authService.saveAppState(appState);
      
      const phoneToUse = fullPhoneNumber || '+99999991000';
      setTimeout(() => {
        authService.authenticate(phoneToUse);
      }, 100);
      setIsVerifying(false);
      return;
    }

    setIsLoading(true);
    try {
      const verificationData = await api.verifyPhoneNumber(fullPhoneNumber, logApiInteraction);
      if (verificationData.devicePhoneNumberVerified === true) {
        addMessage("Phone Number: Verified");
        setSuccess('Phone number is verified.');
        setVerifiedPhoneNumber(fullPhoneNumber);
        addGuestMessage('Welcome! Your phone number has been verified successfully.', 'welcome');
      } else {
        setError(`Phone number verification failed.`);
        addGuestMessage('Phone verification failed. Please try again.', 'error');
      }
    } catch (err) {
      console.error('API call failed:', err);
      setError('An error occurred during verification. Please try again.');
      addGuestMessage('An error occurred during verification. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setIsVerifying(false);
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
      return null;
    }
    if (simulationMode === 'departure' && checkInStatus === 'Checked Out') {
      return null;
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

    // Reset workflow flags when starting new sequence
    setCheckInConsent(false);
    setHasReachedHotel(false);
    setShowManualGateButton(false);
    // Only reset check-in status for arrival mode, not for departure
    if (mode === 'arrival') {
      setCheckInStatus('Not Checked In');
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

        // Set initial user location at Sants-Montjuïc (on land)
        const initialUserCoords = { lat: 41.37544, lng: 2.13551 };

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
          logApiInteraction, // Pass logger
          addGuestMessage, // Pass guest message function
          formState.name ? formState.name.split(' ')[0] : 'Guest', // Pass guest name
          gatewayClient, // Pass gateway client
          processBeaconDetection, // Pass beacon detection function
          setIsAutoScanning, // Pass setIsAutoScanning
          bleUnsubscribeRef, // Pass bleUnsubscribeRef
          setHasReachedHotel // Pass setHasReachedHotel to be set by Location Verification API
        );
        
        // Sequence completed - keep isSequenceRunning true for BLE processing
        addMessage('Arrival sequence completed. BLE-controlled access now active.');
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
          setRfidStatus, // Pass setRfidStatus
          guestName, // Pass guestName to the API call
          logApiInteraction, // Pass logger
          addGuestMessage, // Pass guest message function
          setIdentityIntegrity, // Pass setIdentityIntegrity to preserve status
          identityIntegrity // Pass current Identity Integrity value
        );

        setTimeout(() => {
          if (museumMap) {
            try {
              museumMap.remove();
            } catch (e) {
              console.log('Museum map cleanup');
            }
            setMuseumMap(null);
          }
          // Only reset essential flow control states, preserve User Status and Booking Details
          setKycMatchResponse(null);
          setLocation(null);
          setSimulationMode('arrival');
          setArtificialTime(null);
          setHotelLocation(null);
          setUserGps(null);
          setInitialUserLocation(null);
          setLastIntegrityCheckTime(null);
          setBleStatus('Idle');
          setSecondUserGps(null);
          setError('');
          setSuccess('');
          setIsSequenceRunning(false);
          setHasReachedHotel(false);
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
      {isAuthenticating && (
        <div className="loader-overlay">
          <div className="d-flex justify-content-center align-items-center h-100">
            <div className="spinner-border text-light" style={{ width: '3rem', height: '3rem' }} role="status">
              <span className="sr-only">Authenticating...</span>
            </div>
          </div>
        </div>
      )}
      {authError && (
        <div className="alert alert-danger" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
          Authentication Error: {authError}
        </div>
      )}
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
      </header>

      <main className="main-content">
        <div className="dashboard-container">
          
          {/* Navigation Tabs */}
          <ul className="nav nav-tabs mb-3" style={{ paddingLeft: '15px', paddingRight: '15px' }}>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'api' ? 'active' : ''}`} onClick={() => setActiveTab('api')}>API Interactions</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Management Dashboard</button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Management Dashboard (Detailed Version)</button>
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
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>{JSON.stringify(log.request, null, 2)}</pre>
                            </div>
                            <div className="col-md-6">
                                <strong>Response:</strong>
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>{JSON.stringify(log.response, null, 2)}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab 2: Guest Information - Opens in new window */}
            {/* Content removed - opens in separate kiosk window */}

            {/* Tab 3 & 4: Dashboard & Details - Left Column */}
            <div className={`dashboard-column ${activeTab === 'dashboard' || activeTab === 'details' ? '' : 'd-none'}`} style={{ flex: '1', minWidth: '300px' }}>
              
              {/* Action Buttons */}
              <div id="actionButtons" className="card">
                <h2 className="card-header">Actions</h2>
                <div className="p-3">
                  <div className="api-buttons">
                    <button className="btn btn-info" onClick={() => window.open(window.location.origin + '/kiosk', '_blank')}>
                      <img src={`${process.env.PUBLIC_URL}/hotel_logo.png`} alt="Hotel" style={{ width: '20px', height: '20px', marginRight: '8px', verticalAlign: 'middle' }} />
                      Open Hotel Kiosk View
                    </button>
                    <button className="btn btn-primary" onClick={handleRegistrationSequence}>Registration Routine</button>
                    {checkInStatus !== 'Checked In' && (
                      <button className="btn btn-primary" onClick={() => handleStartSequence('arrival')}>Booking and Arrival Routine</button>
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
                <h2 className="card-header">1. Number Verification</h2>
                <form onSubmit={validatePhone} className="p-3">
                  <div className="verify-form-container">
                    <div className="form-group">
                      <input type="text" id="phone" className="form-control" placeholder="e.g., +61412345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <button type="submit" id="verifyBtn" className="btn btn-primary" disabled={isVerifying}>
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
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
                  <li><strong>Check-in Status:</strong> <span style={{ color: checkInStatus === 'Checked In' ? 'green' : 'red' }}>{checkInStatus}</span>
                    {showManualGateButton ? (
                      <button className="btn btn-sm btn-primary ml-2" onClick={() => { addMessage('Manual Gate skip triggered'); setCheckInStatus('At Kiosk'); api.skipCurrentBeacon(); setShowManualGateButton(false); }}>Proceed to Kiosk</button>
                    ) : null}
                    {(checkInStatus === 'At Kiosk' && isSequenceRunning) && checkInStatus !== 'Checked In' && (
                      <button className="btn btn-sm btn-success ml-2" onClick={() => { 
                        addMessage('Manual check-in triggered from Management Dashboard'); 
                        setCheckInConsent(true);
                        setCheckInStatus('Checked In');
                        setRfidStatus('Verified');
                        const guestName = formState.name ? formState.name.split(' ')[0] : 'Guest';
                        setTimeout(() => {
                          setRfidStatus('Unverified');
                          addGuestMessage(`Check-in complete, ${guestName}! Welcome to Room 1337. Enjoy your stay!`, 'success');
                        }, 3000);
                        if (api.getCurrentWaitingStage() === 'kiosk') api.skipCurrentBeacon(); 
                      }}>Complete Check-in</button>
                    )}
                  </li>
                  <li><strong>Payment Status:</strong> <span style={{ color: paymentStatus === 'Paid' ? 'green' : 'red' }}>{paymentStatus}</span></li>
                  <li><strong>RFID Verification:</strong> <span style={{ color: rfidStatus === 'Verified' ? 'green' : 'red' }}>{rfidStatus}</span></li>
                  <li><strong>Elevator Access:</strong> <span>{elevatorAccess}</span>
                  </li>
                  <li><strong>Room Access:</strong> <span>{roomAccess}</span>
                  </li>
                </ul>
              </div>

              {/* User Profile Section */}
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

              {/* BLE Status Display (Hidden - can be enabled later if needed) */}
              <div id="bleSection" className="d-none">
                <h2 className="card-header">BLE Auto-Tracking</h2>
                <div className="p-3">
                  <p>BLE tracking is automatically enabled when phone is verified.</p>
                  <div className="mt-2">
                    <strong>Status: </strong>
                    <span style={{ color: bleStatus === 'Connected' ? 'green' : (bleStatus === 'Failed' ? 'red' : 'black') }}>
                      {bleStatus}
                    </span>
                    {isAutoScanning && <span className="ml-2">(Tracking Active)</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab 3 & 4: Dashboard & Details - Right Column */}
            <div className={`dashboard-column ${activeTab === 'dashboard' || activeTab === 'details' ? '' : 'd-none'}`} style={{ flex: '1', minWidth: '300px' }}>
              
              {/* Booking Details */}
              <div id="bookingDetails" className="card">
                <h2 className="card-header">4. Booking Details</h2>
                <ul className="details-list">
                  <li><strong>Hotel:</strong> <span>{isSequenceRunning ? 'Hotel Barcelona Sol' : '--'}</span></li>
                  <li><strong>Room:</strong> <span>{isSequenceRunning ? '1337' : '--'}</span></li>
                  <li><strong>Check-in:</strong> <span>{isSequenceRunning ? format(CHECK_IN_DATE, 'yyyy-MM-dd HH:mm') : '--'}</span></li>
                  <li><strong>Check-out:</strong> <span>{isSequenceRunning ? format(CHECK_OUT_DATE, 'yyyy-MM-dd HH:mm') : '--'}</span></li>
                </ul>
              </div>
              
              {/* Activity Logs */}
              <div id="activityLogs" className={`card ${(activeTab === 'details') ? '' : 'd-none'}`}>
                <h2 className="card-header">5. Activity Log</h2>
                <div className="p-3">
                  <div id="response-container" ref={responseContainerRef} style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: 'black', border: '1px solid #dee2e6', padding: '10px' }}>
                    <pre id="api-response" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'white' }}>{messages.join('\n')}</pre>
                  </div>
                </div>
              </div>

              {/* API Logs (Details Only) */}
              <div id="apiLogsDetails" className={`card ${(activeTab === 'details') ? '' : 'd-none'}`}>
                <h2 className="card-header">6. Network API Request-Response</h2>
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
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>{JSON.stringify(log.request, null, 2)}</pre>
                            </div>
                            <div className="col-md-6">
                                <strong>Response:</strong>
                                <pre className="bg-light p-2 border rounded small" style={{maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>{JSON.stringify(log.response, null, 2)}</pre>
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
                <h2 className="card-header">{activeTab === 'details' ? '7. Location Tracker' : '5. Location Tracker'}</h2>
                <div id="map" style={{ height: '400px', width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        &copy; 2026 MWC Event
      </footer>
    </div>
  );
}
export default App;
