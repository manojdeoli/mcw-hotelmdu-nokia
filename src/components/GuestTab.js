import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { format } from 'date-fns';

const CHECK_IN_DATE = new Date('2026-03-02T14:00:00');
const CHECK_OUT_DATE = new Date('2026-03-06T11:00:00');

// =============================================================================
// Amenity catalogue — full set of hotel amenities keyed by amenityPriority keys
// from domainMappingRules.js. All 4 original cards are preserved exactly.
// New cards (kids_club, business_centre, express_checkout, concierge) are added.
// Rendering always shows exactly 4 cards, ordered by the profile's amenityPriority.
// GENERIC_GUEST fallback order matches the original hardcoded order.
// =============================================================================
const AMENITY_CATALOGUE = {
  restaurant:       { icon: '🍽️', name: 'La Cocina del Sol',      offer: 'Free starter with main course',          location: 'Ground Floor' },
  spa:              { icon: '💆', name: 'Sol Wellness Spa',        offer: '20% off all treatments',                 location: 'Level 6'      },
  fitness:          { icon: '💪', name: 'Fitness Center',          offer: 'Free 24/7 access',                       location: 'Level 4'      },
  pool:             { icon: '🏊', name: 'Rooftop Pool & Bar',      offer: 'Free welcome cocktail',                  location: 'Level 5'      },
  kids_club:        { icon: '🧒', name: 'Kids Club & Play Zone',   offer: 'Free supervised activities daily',       location: 'Level 2'      },
  business_centre:  { icon: '💼', name: 'Business Centre',         offer: 'Free printing & meeting rooms',          location: 'Level 1'      },
  express_checkout: { icon: '⚡', name: 'Express Checkout',        offer: 'Skip the queue — checkout via app',      location: 'Reception'    },
  concierge:        { icon: '🛎️', name: 'Concierge Service',       offer: 'Personalised city tours & bookings',     location: 'Lobby'        },
  local_attractions: { icon: '🗺️', name: 'Local Attractions',        offer: 'Exclusive discounts on top Barcelona sights', location: 'Concierge'  },
};

// Profile badge config — maps Layer 2 domainProfile to a display label + colour
const PROFILE_BADGE = {
  BUSINESS_TRAVELER: { label: '🧳 Business Traveler', color: '#1a73e8' },
  FAMILY_GROUP:      { label: '👨‍👩‍👧 Family Group',      color: '#e8710a' },
  LEISURE_GUEST:     { label: '🌴 Leisure Guest',      color: '#1e8e3e' },
  SENIOR_GUEST:      { label: '🛎️ Senior Guest',       color: '#9334e6' },
  GENERIC_GUEST:     { label: '🏨 Hotel Guest',         color: '#5f6368' },
  // Fused profiles (behaviour × persona)
  FAST_LEISURE:      { label: '⚡ Fast Leisure',       color: '#0d904f' },
  EFFICIENT_FAMILY:  { label: '⚡👨‍👩‍👧 Efficient Family', color: '#c5221f' },
  GROUP_LEISURE:     { label: '🌴👥 Group Leisure',    color: '#e8710a' },
  RELAXED_GUEST:     { label: '🧘 Relaxed Guest',      color: '#7b1fa2' },
  EXTENDED_BUSINESS: { label: '🧳🕐 Extended Business', color: '#1565c0' },
  SOLO_BUSINESS:     { label: '💼 Solo Business',      color: '#0277bd' },
};

// Returns the 4 amenity objects to render, ordered by profile priority.
// Falls back gracefully if customerProfile is null or a key is missing.
function getOrderedAmenities(customerProfile) {
  const defaultOrder = ['restaurant', 'spa', 'fitness', 'pool'];
  const priority = customerProfile?.layer2?.contentHints?.amenityPriority || defaultOrder;
  // Take the first 4 valid keys from priority, then pad with defaults if needed
  const ordered = priority
    .filter(key => AMENITY_CATALOGUE[key])
    .slice(0, 4);
  const padKeys = defaultOrder.filter(k => !ordered.includes(k));
  const final = [...ordered, ...padKeys].slice(0, 4);
  return final.map(key => ({ key, ...AMENITY_CATALOGUE[key] }));
}

const GuestTab = ({ 
  checkInStatus, 
  formState, 
  verifiedPhoneNumber,
  activeTab,
  museumMap,
  setMuseumMap,
  hasReachedHotel,
  onCheckInConsent,
  guestMessages,
  isSequenceRunning,
  checkInConsent,
  bookingCheckIn,
  bookingCheckOut,
  customerProfile,
}) => {
  
  const mapInitialized = useRef(false);
  const [showCheckedInContent, setShowCheckedInContent] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollContainerRef = useRef(null);
  const [showAttribution, setShowAttribution] = useState(false);
  const [showCheckoutMessage, setShowCheckoutMessage] = useState(true);
  const [displayStatus, setDisplayStatus] = useState(checkInStatus);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [backgroundVideo, setBackgroundVideo] = useState(() => {
    const videos = ['Hotel_Entrance_Veo_1.mp4', 'Hotel_Entrance_Veo_2.mp4', 'Hotel_Entrance_Veo_3.mp4'];
    return videos[Math.floor(Math.random() * videos.length)];
  });
  const videoRef = useRef(null);
  const videoRef2 = useRef(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(false);
  const currentVideoRef = useRef(backgroundVideo);
  
  const isInIframe = window !== window.top;
  const isAttractMode = window.location.hash === '#/attract-mode' || window.location.pathname === '/kiosk' || isInIframe;
  const isActiveRef = useRef(true); // true by default; set to false only when VIEW_CHANGED says hotel is inactive

  // Initialize audio state from localStorage on mount
  useEffect(() => {
    if (isInIframe) {
      // Always start with Hotel audio disabled by default
      console.log('🎵 GuestTab: Setting Hotel audio to disabled by default');
      audioEnabledRef.current = false;
      setAudioEnabled(false);
      localStorage.setItem('hotel_audio_enabled', 'false');
    }
  }, [isInIframe]);

  // Save audio state to localStorage whenever it changes
  useEffect(() => {
    if (isInIframe) {
      localStorage.setItem('hotel_audio_enabled', audioEnabledRef.current.toString());
      console.log('🎵 GuestTab: Saved audio state to localStorage:', audioEnabledRef.current);
    }
  }, [audioEnabled, isInIframe]);

  // Listen for VIEW_CHANGED, SOUND_TOGGLE, FREEZE_START/END from AttractMode parent
  useEffect(() => {
    if (!isInIframe) return;

    const handleMsg = (data) => {
      const video = videoRef.current;
      if (!video) return;
      
      if (data.type === 'VIEW_CHANGED') {
        const isHotelActive = data.activeTarget
          ? data.activeTarget === 'hotel'
          : data.activeView === 0;
        isActiveRef.current = isHotelActive;
        
        if (isHotelActive) {
          // Use specific video if provided, otherwise random selection
          let newVideo;
          if (data.specificVideo) {
            newVideo = data.specificVideo;
            console.log('[GuestTab] Using specific video:', newVideo);
          } else {
            const videos = ['Hotel_Entrance_Veo_1.mp4', 'Hotel_Entrance_Veo_2.mp4', 'Hotel_Entrance_Veo_3.mp4'];
            do {
              newVideo = videos[Math.floor(Math.random() * videos.length)];
            } while (newVideo === currentVideoRef.current && videos.length > 1);
          }
          
          // Preserve current audio state during video change
          const currentAudioState = audioEnabledRef.current;
          
          currentVideoRef.current = newVideo;
          const nextVideo = activeVideoIndex === 0 ? videoRef2.current : videoRef.current;
          const currentVideo = video;
          
          nextVideo.muted = !currentAudioState;
          nextVideo.volume = currentAudioState ? 1.0 : 0;
          nextVideo.style.opacity = '0';
          
          const onCanPlay = () => { 
            nextVideo.removeEventListener('canplay', onCanPlay);
            nextVideo.muted = !audioEnabledRef.current;
            nextVideo.volume = audioEnabledRef.current ? 1.0 : 0;
            if (isActiveRef.current) {
              nextVideo.style.zIndex = '2';
              currentVideo.style.zIndex = '1';
              nextVideo.play().catch(() => {});
              requestAnimationFrame(() => {
                nextVideo.style.transition = 'opacity 1s ease-in-out';
                nextVideo.style.opacity = '1';
              });
              setTimeout(() => {
                currentVideo.pause();
                currentVideo.style.transition = 'none';
                currentVideo.style.opacity = '0';
                setActiveVideoIndex(prev => prev === 0 ? 1 : 0);
              }, 1000);
            }
          };
          nextVideo.addEventListener('canplay', onCanPlay);
          nextVideo.src = `${process.env.PUBLIC_URL}/${newVideo}`;
          nextVideo.load();
        } else {
          console.log('🎵 GuestTab: Muting video because Hotel is not active');
          video.pause();
          video.muted = true;
          video.volume = 0;
        }
      } else if (data.type === 'SOUND_TOGGLE') {
        if (data.target && data.target !== 'hotel') return;
        const newState = data.enabled;
        console.log('🎵 GuestTab: SOUND_TOGGLE for Hotel - newState:', newState);
        
        audioEnabledRef.current = newState;
        setAudioEnabled(newState);
        
        // Immediately save to localStorage
        localStorage.setItem('hotel_audio_enabled', newState.toString());
        console.log('🎵 GuestTab: Immediately saved audio state to localStorage:', newState);
        
        if (video) {
          console.log('🎵 GuestTab: Applying audio state to video - muted:', !newState, 'volume:', newState ? 1.0 : 0);
          video.muted = !newState;
          video.volume = newState ? 1.0 : 0;
        }
      } else if (data.type === 'PAUSE_ALL') {
        video.pause();
        video.muted = true;
      } else if (data.type === 'FREEZE_START') {
        console.log('❄️ [GuestTab] FREEZE_START received - pausing video');
        video.pause();
      } else if (data.type === 'FREEZE_END') {
        console.log('🔓 [GuestTab] FREEZE_END received - resuming if active');
        if (isActiveRef.current) {
          video.play().catch(() => {});
        }
      }
    };

    // Same-origin (Hotel's own AttractMode): BroadcastChannel
    const channel = new BroadcastChannel('attract_mode_sync');
    channel.onmessage = (event) => handleMsg(event.data);

    // Cross-origin (Healthcare's AttractMode): postMessage
    const onPostMessage = (event) => {
      if (event.data && event.data.source === 'attract_mode') handleMsg(event.data);
    };
    window.addEventListener('message', onPostMessage);

    return () => {
      channel.close();
      window.removeEventListener('message', onPostMessage);
    };
  }, [isInIframe]);
  
  // Sync audioEnabledRef and apply mute directly to DOM element (React muted prop doesn't update after mount)
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    const video1 = videoRef.current;
    const video2 = videoRef2.current;
    if (!isInIframe) {
      // Apply audio state to both videos
      if (video1) {
        video1.muted = !audioEnabled;
        video1.volume = audioEnabled ? 1.0 : 0;
      }
      if (video2) {
        video2.muted = !audioEnabled;
        video2.volume = audioEnabled ? 1.0 : 0;
      }
    }
  }, [audioEnabled, isInIframe]);

  const toggleAudio = () => setAudioEnabled(prev => !prev);

  // Initial video setup only - no auto-transitions
  useEffect(() => {
    const video1 = videoRef.current;
    if (!video1 || isInIframe) return;
    
    // Ensure first video plays on mount with correct audio state
    const playFirstVideo = () => {
      video1.muted = !audioEnabledRef.current;
      video1.volume = audioEnabledRef.current ? 1.0 : 0;
      video1.play().catch(() => {});
    };
    
    // Try to play immediately
    playFirstVideo();
    
    // Also try after a short delay to ensure audio state is applied
    const timer = setTimeout(playFirstVideo, 100);
    return () => clearTimeout(timer);
  }, [isInIframe]);

  // Watchdog: resume video if browser suspends/stalls it while hotel view is active
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const resume = () => {
      if (isActiveRef.current && video.paused && !video.ended) {
        video.play().catch(() => {});
      }
    };
    video.addEventListener('stalled', resume);
    video.addEventListener('suspend', resume);
    video.addEventListener('waiting', resume);
    return () => {
      video.removeEventListener('stalled', resume);
      video.removeEventListener('suspend', resume);
      video.removeEventListener('waiting', resume);
    };
  }, []);

  const handleVideoEnd = (videoIndex) => {
    console.log('[VIDEO] handleVideoEnd called - videoIndex:', videoIndex, 'activeVideoIndex:', activeVideoIndex);
    // Use ref to get current active index to avoid stale closure
    const currentActiveIndex = videoIndex === 0 ? (videoRef.current?.style.zIndex === '2' ? 0 : 1) : (videoRef2.current?.style.zIndex === '2' ? 1 : 0);
    if (videoIndex !== currentActiveIndex) {
      console.log('[VIDEO] Video end ignored - not the active video (zIndex check)');
      return;
    }
    
    if (isInIframe) {
      console.log('[VIDEO] In iframe mode - notifying parent and pausing');
      window.parent.postMessage({ type: 'VIDEO_ENDED' }, '*');
      const currentVideo = activeVideoIndex === 0 ? videoRef.current : videoRef2.current;
      currentVideo?.pause();
      return;
    }
    
    console.log('[VIDEO] Selecting next video...');
    const videos = ['Hotel_Entrance_Veo_1.mp4', 'Hotel_Entrance_Veo_2.mp4', 'Hotel_Entrance_Veo_3.mp4'];
    let newVideo;
    do {
      newVideo = videos[Math.floor(Math.random() * videos.length)];
    } while (newVideo === currentVideoRef.current && videos.length > 1);
    console.log('[VIDEO] Next video selected:', newVideo, '(previous was:', currentVideoRef.current, ')');
    currentVideoRef.current = newVideo;
    
    // Preload next video into the inactive video element before current ends
    const inactiveVideo = videoIndex === 0 ? videoRef2.current : videoRef.current;
    const currentVideo = videoIndex === 0 ? videoRef.current : videoRef2.current;
    
    if (inactiveVideo) {
      console.log('[VIDEO] Preloading next video into inactive element');
      inactiveVideo.src = `${process.env.PUBLIC_URL}/${newVideo}`;
      inactiveVideo.load();
      inactiveVideo.muted = !audioEnabledRef.current;
      inactiveVideo.volume = audioEnabledRef.current ? 1.0 : 0;
      inactiveVideo.style.opacity = '1';
      inactiveVideo.style.transition = 'none';
      inactiveVideo.style.transform = 'translateX(100%)';
      
      // Wait for preload, then trigger slide transition
      const onCanPlay = () => {
        inactiveVideo.removeEventListener('canplay', onCanPlay);
        console.log('[VIDEO] Preloaded video ready, starting slide transition');
        inactiveVideo.style.zIndex = '2';
        currentVideo.style.zIndex = '1';
        inactiveVideo.play().catch(() => {});
        requestAnimationFrame(() => {
          inactiveVideo.style.transition = 'transform 1s ease-in-out';
          inactiveVideo.style.transform = 'translateX(0)';
          currentVideo.style.transition = 'transform 1s ease-in-out';
          currentVideo.style.transform = 'translateX(-100%)';
        });
        setTimeout(() => {
          currentVideo.pause();
          currentVideo.style.transition = 'none';
          currentVideo.style.transform = 'translateX(0)';
          currentVideo.currentTime = 0;
          setActiveVideoIndex(prev => prev === 0 ? 1 : 0);
        }, 1000);
      };
      inactiveVideo.addEventListener('canplay', onCanPlay);
    }
  };
  
  // Check scroll position to show/hide scroll indicators
  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowScrollUp(scrollTop > 0);
      setShowScrollDown(scrollTop < scrollHeight - clientHeight - 10);
    }
  };

  // Scroll functions
  const scrollUp = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: -200, behavior: 'smooth' });
    }
  };

  const scrollDown = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ top: 200, behavior: 'smooth' });
    }
  };

  // Check scroll position on mount and content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      checkScrollPosition();
      // Force show scroll down initially if content overflows
      if (scrollContainerRef.current) {
        const { scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight > clientHeight) {
          setShowScrollDown(true);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [checkInStatus, showCheckedInContent]);

  // Debug logging
  useEffect(() => {
    console.log('[GuestTab] State updated:', {
      checkInStatus,
      displayStatus,
      showCheckedInContent,
      verifiedPhoneNumber,
      hasReachedHotel,
      firstName: formState.firstName || formState.name
    });
  }, [checkInStatus, displayStatus, showCheckedInContent, verifiedPhoneNumber, hasReachedHotel, formState]);
  
  // Update display status only when new content is ready
  useEffect(() => {
    if (checkInStatus === 'Checked In' && !showCheckedInContent) {
      const timer = setTimeout(() => {
        setShowCheckedInContent(true);
        setDisplayStatus('Checked In');
      }, 3000);
      return () => clearTimeout(timer);
    } else if (checkInStatus === 'Checked In' && showCheckedInContent) {
      setDisplayStatus('Checked In');
    } else if (checkInStatus === 'Checked Out') {
      setDisplayStatus('Checked Out');
      // Don't set showCheckedInContent to false - keep content visible
    } else if (checkInStatus !== 'Checked In' && checkInStatus !== 'Checked Out') {
      setShowCheckedInContent(false);
      setDisplayStatus(checkInStatus);
    }
  }, [checkInStatus, showCheckedInContent]);

  // Auto-dismiss checkout message after 30 seconds
  useEffect(() => {
    if (checkInStatus === 'Checked Out') {
      setShowCheckoutMessage(true);
      const timer = setTimeout(() => {
        setShowCheckoutMessage(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [checkInStatus]);
  
  // Initialize maps when tab is active and checked in
  useEffect(() => {
    if (activeTab === 'guest' && checkInStatus === 'Checked In' && showCheckedInContent && !mapInitialized.current) {
      setTimeout(() => {
        const hotelCoords = [41.3874, 2.1686];
        
        // Museum Map
        const museumMapElement = document.getElementById('museum-map');
        if (museumMapElement && !museumMap) {
          console.log('Initializing museum map');
          const museumCoords = [41.3851, 2.1734];
          
          try {
            const museumMapInstance = L.map('museum-map').setView([(museumCoords[0] + hotelCoords[0])/2, (museumCoords[1] + hotelCoords[1])/2], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors'
            }).addTo(museumMapInstance);
            
            const hotelIcon = L.divIcon({
              html: '<div style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🏨</div>',
              className: '',
              iconSize: [30, 30]
            });
            L.marker(hotelCoords, { icon: hotelIcon }).addTo(museumMapInstance).bindPopup('Hotel Barcelona Sol');
            
            const museumIcon = L.divIcon({
              html: '<div style="background: #e80074; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🎨</div>',
              className: '',
              iconSize: [30, 30]
            });
            L.marker(museumCoords, { icon: museumIcon }).addTo(museumMapInstance).bindPopup('Museu Picasso Barcelona');
            
            L.polyline([hotelCoords, museumCoords], {
              color: '#007bff',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 10'
            }).addTo(museumMapInstance);
            
            setMuseumMap(museumMapInstance);
          } catch (error) {
            console.error('Error initializing museum map:', error);
          }
        }
        
        // Beach Map
        const beachMapElement = document.getElementById('beach-map');
        if (beachMapElement) {
          console.log('Initializing beach map');
          const beachCoords = [41.3806, 2.1896];
          
          try {
            const beachMapInstance = L.map('beach-map').setView([(beachCoords[0] + hotelCoords[0])/2, (beachCoords[1] + hotelCoords[1])/2], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors'
            }).addTo(beachMapInstance);
            
            const hotelIcon2 = L.divIcon({
              html: '<div style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🏨</div>',
              className: '',
              iconSize: [30, 30]
            });
            L.marker(hotelCoords, { icon: hotelIcon2 }).addTo(beachMapInstance).bindPopup('Hotel Barcelona Sol');
            
            const beachIcon = L.divIcon({
              html: '<div style="background: #20c997; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🏖️</div>',
              className: '',
              iconSize: [30, 30]
            });
            L.marker(beachCoords, { icon: beachIcon }).addTo(beachMapInstance).bindPopup('Barceloneta Beach');
            
            L.polyline([hotelCoords, beachCoords], {
              color: '#20c997',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 10'
            }).addTo(beachMapInstance);
          } catch (error) {
            console.error('Error initializing beach map:', error);
          }
        }
        
        mapInitialized.current = true;
      }, 1000);
    }
    
    // Cleanup when component unmounts or check-in status changes to not checked in
    // Don't cleanup during checkout transition - wait for displayStatus to update
    if (checkInStatus !== 'Checked In' && checkInStatus !== 'Checked Out' && mapInitialized.current && museumMap) {
      try {
        museumMap.remove();
      } catch (e) {
        console.log('Museum map cleanup');
      }
      setMuseumMap(null);
      mapInitialized.current = false;
    }
  }, [activeTab, checkInStatus, showCheckedInContent, museumMap, setMuseumMap]);

  const guestName = formState.firstName && formState.lastName 
    ? `${formState.firstName} ${formState.lastName}` 
    : formState.name || 'Guest';
  const firstName = formState.firstName || (formState.name ? formState.name.split(' ')[0] : 'Guest');

  return (
    <div className="kiosk-container">
      {/* Background Videos - Two videos for crossfade */}
      <video ref={videoRef} className="kiosk-background-video" autoPlay muted playsInline src={`${process.env.PUBLIC_URL}/${backgroundVideo}`} onEnded={() => handleVideoEnd(0)} style={{ opacity: activeVideoIndex === 0 ? 1 : 0, zIndex: activeVideoIndex === 0 ? 2 : 1 }} />
      <video ref={videoRef2} className="kiosk-background-video" muted playsInline onEnded={() => handleVideoEnd(1)} style={{ opacity: activeVideoIndex === 1 ? 1 : 0, zIndex: activeVideoIndex === 1 ? 2 : 1 }} />
      
      {/* Attribution Button */}
      <button
        onClick={() => setShowAttribution(!showAttribution)}
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          padding: '5px 10px',
          fontSize: '0.7rem',
          cursor: 'pointer',
          zIndex: 16
        }}
      >
        ℹ️ Video Attribution
      </button>

      {/* Wipro Logo */}
      <img 
        src={`${process.env.PUBLIC_URL}/Wipro_Secondary_Logo.png`} 
        alt="Wipro" 
        style={{
          position: 'fixed',
          top: '-5px',
          right: '70px',
          height: '80px',
          zIndex: 16,
          mixBlendMode: 'screen',
          opacity: 0.85,
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
        }} 
      />

      {/* Attribution Popup */}
      {showAttribution && (
        <div
          style={{
            position: 'fixed',
            top: '45px',
            left: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #007bff',
            borderRadius: '8px',
            padding: '15px',
            maxWidth: '400px',
            zIndex: 17,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontSize: '0.75rem',
            color: '#000'
          }}
        >
          <button
            onClick={() => setShowAttribution(false)}
            style={{
              position: 'absolute',
              top: '5px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
          <div>Video generated by Oliver Holland using Google Gemini (Veo 3.1), 19 February 2026, using the prompt: "Create a 20 second video of a hotel entrance hall and reception from the stationary camera perspective of just inside the entrance door. Don't focus on any specific individuals or interactions"</div>
        </div>
      )}
      
      {/* Audio Control Button - only show when not embedded in AttractMode */}
      {!isInIframe && (
        <button
          onClick={toggleAudio}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: audioEnabled ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            zIndex: 1000,
            fontSize: '18px',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>
      )}
      
      {/* Demo Banner - Show in presentation/fullscreen (iframe) only, not in kiosk view */}
      {isInIframe && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          color: 'white',
          padding: '15px 20px',
          fontSize: '0.75rem',
          lineHeight: '1.4',
          zIndex: 15,
          textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '0.8rem' }}>Enhanced Premises Access Systems Using Network APIs</div>
          <div style={{ marginBottom: '5px' }}>Demonstrates a fully automated hotel guest journey—from arrival to check out. Leverages CAMARA Network APIs and aggregators to enable secure, seamless processes.</div>
          <div>• Automates registration, arrival detection, check in, elevator and room access.</div>
          <div>• Delivers personalized guest information throughout the stay.</div>
          <div>• Supports automated check out and billing without manual intervention.</div>
          {isInIframe && (
            <button
              onClick={() => window.parent.postMessage({ type: 'TRY_NOW' }, '*')}
              style={{
                marginTop: '8px',
                background: 'rgba(232, 0, 116, 0.85)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: '20px',
                padding: '5px 16px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                textShadow: 'none'
              }}
            >
              ▶ Try Now
            </button>
          )}
        </div>
      )}
      
      {/* Embedded Kiosk Screen */}
      <div className={`kiosk-screen-frame${isAttractMode ? ' kiosk-screen-frame--scene' : ''}`} style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/kiosk.png)` }}>
        <div className="kiosk-screen-content" ref={scrollContainerRef} onScroll={checkScrollPosition}>
          <div className="kiosk-header">
            <div className="hotel-logo">
              <img src={`${process.env.PUBLIC_URL}/hotel_logo.png`} alt="Hotel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <h1 className="kiosk-hotel-name">Hotel Barcelona Sol</h1>
            <div className="hotel-stars">⭐⭐⭐⭐⭐</div>
          </div>

        {!verifiedPhoneNumber && (
          <div className="kiosk-welcome-idle kiosk-welcome-compact">
            <h3>Welcome to Hotel Barcelona Sol</h3>
          </div>
        )}

        {verifiedPhoneNumber && !hasReachedHotel && checkInStatus !== 'Checked Out' && (
          <div className="kiosk-welcome-idle kiosk-welcome-compact">
            <h3>Welcome to Hotel Barcelona Sol</h3>
          </div>
        )}

        {verifiedPhoneNumber && hasReachedHotel && displayStatus !== 'Checked In' && displayStatus !== 'At Kiosk' && displayStatus !== 'Checked Out' && (
          <div className="kiosk-welcome-idle">
            <h3>Welcome, {firstName}!</h3>
            <p>Please proceed to the kiosk to check in</p>
          </div>
        )}

        {displayStatus === 'Checked Out' && showCheckoutMessage && (
          <div className="kiosk-success-section">
            <div className="success-header">
              <div className="success-icon">👋</div>
              <h3>Thank You for Staying With Us!</h3>
              <p>We hope you enjoyed your stay, {firstName}</p>
            </div>
            <div className="kiosk-directions-with-visual">
              <div className="directions-content">
                <h3>✨ Check-out Complete</h3>
                <p className="directions-text">
                  Your payment has been processed successfully. We hope you had a wonderful experience at Hotel Barcelona Sol.
                  We look forward to welcoming you back soon!
                </p>
              </div>
            </div>
          </div>
        )}

        {displayStatus === 'Checked Out' && !showCheckoutMessage && (
          <div className="kiosk-welcome-idle kiosk-welcome-compact">
            <h3>Welcome to Hotel Barcelona Sol</h3>
          </div>
        )}

        {verifiedPhoneNumber && displayStatus === 'At Kiosk' && isSequenceRunning && displayStatus !== 'Checked In' && displayStatus !== 'Checked Out' && (
          <div className="kiosk-checkin-section">
            <div className="kiosk-welcome-message">
              <h3>Welcome, {firstName}!</h3>
              <p className="kiosk-subtitle">We're delighted to have you at Hotel Barcelona Sol</p>
            </div>

            <div className="kiosk-guest-info">
              <div className="info-row">
                <span className="info-label">Guest Name:</span>
                <span className="info-value">{guestName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Phone:</span>
                <span className="info-value">{verifiedPhoneNumber}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Room Number:</span>
                <span className="info-value">1337</span>
              </div>
              <div className="info-row">
                <span className="info-label">Check-in:</span>
                <span className="info-value">{bookingCheckIn ? format(new Date(bookingCheckIn), 'MMM dd, yyyy • HH:mm') : format(CHECK_IN_DATE, 'MMM dd, yyyy • HH:mm')}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Check-out:</span>
                <span className="info-value">{bookingCheckOut ? format(new Date(bookingCheckOut), 'MMM dd, yyyy • HH:mm') : format(CHECK_OUT_DATE, 'MMM dd, yyyy • HH:mm')}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="status-badge status-pending">Ready for Check-in</span>
              </div>
            </div>

            <div className="kiosk-action">
              {!checkInConsent && (
                <button className="kiosk-checkin-btn" onClick={onCheckInConsent}>
                  <span className="btn-icon">✓</span>
                  Check In Now
                </button>
              )}
              {checkInConsent && (
                <div className="consent-given-message">
                  <p style={{ color: '#28a745', fontWeight: 'bold', margin: '20px 0', textAlign: 'center' }}>
                    ✓ Check-in consent received. Waiting for verification...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {((displayStatus === 'Checked In' && showCheckedInContent) || (checkInStatus === 'Checked In' && displayStatus === 'Checked Out')) && (
          <div className="kiosk-success-section">
            <div className="success-header">
              <div className="success-icon">✓</div>
              <h3>Check-in Complete!</h3>
              <p>Welcome to Hotel Barcelona Sol, {firstName}</p>
            </div>

            <div className="kiosk-directions-with-visual">
              <div className="directions-content">
                <h3>🗺️ Your Room: 1337 • Floor 13</h3>
                <p className="directions-text">
                  From the lobby, proceed to the main elevator bank. Take the elevator to Floor 13. 
                  Turn left when you exit, and your room is the 7th door on the right.
                </p>
              </div>
              <div className="wayfinding-diagram">
                <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
                  {/* Floor corridor */}
                  <rect x="10" y="50" width="180" height="60" fill="#f0f0f0" stroke="#333" strokeWidth="2"/>
                  {/* Elevator */}
                  <rect x="85" y="50" width="30" height="20" fill="#007bff" stroke="#333" strokeWidth="1"/>
                  <text x="100" y="63" fontSize="10" fill="white" textAnchor="middle">🛗</text>
                  {/* Arrow path */}
                  <path d="M 100 70 L 100 85 L 30 85" stroke="#e80074" strokeWidth="3" fill="none" markerEnd="url(#arrowhead)"/>
                  {/* Room doors */}
                  <rect x="15" y="55" width="8" height="15" fill="#ddd" stroke="#666" strokeWidth="1"/>
                  <rect x="15" y="70" width="8" height="15" fill="#ddd" stroke="#666" strokeWidth="1"/>
                  <rect x="15" y="85" width="8" height="15" fill="#28a745" stroke="#666" strokeWidth="2"/>
                  <text x="19" y="95" fontSize="8" fill="white" fontWeight="bold">1337</text>
                  {/* Arrow marker */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                      <polygon points="0 0, 10 3, 0 6" fill="#e80074" />
                    </marker>
                  </defs>
                  {/* Labels */}
                  <text x="100" y="45" fontSize="10" fill="#333" textAnchor="middle" fontWeight="bold">Elevator</text>
                  <text x="30" y="125" fontSize="10" fill="#28a745" textAnchor="middle" fontWeight="bold">Your Room</text>
                  <text x="150" y="80" fontSize="9" fill="#666" textAnchor="middle">← Turn Left</text>
                </svg>
              </div>
            </div>

            <div className="kiosk-amenities">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>🏨 Hotel Amenities</h3>
                {customerProfile?.layer2 && (() => {
                  const badge = PROFILE_BADGE[customerProfile.layer2.domainProfile] || PROFILE_BADGE.GENERIC_GUEST;
                  return (
                    <span style={{
                      background: badge.color,
                      color: 'white',
                      borderRadius: '12px',
                      padding: '3px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}>
                      {badge.label}{customerProfile.layer2.finalConfidence ? ` (${Math.round(customerProfile.layer2.finalConfidence * 100)}%)` : ''}
                    </span>
                  );
                })()}
              </div>
              {customerProfile?.layer2?.explainability?.fusion && (
                <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 10px 0', fontStyle: 'italic' }}>
                  {customerProfile.layer2.explainability.fusion.ruleApplied}
                </p>
              )}
              <div className="amenity-grid">
                {getOrderedAmenities(customerProfile).map(amenity => (
                  <div className="amenity-card" key={amenity.key}>
                    <div className="amenity-icon">{amenity.icon}</div>
                    <h4>{amenity.name}</h4>
                    <p>{amenity.offer}</p>
                    <span className="amenity-location">{amenity.location}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="kiosk-attractions">
              <h3>🌍 Local Attractions</h3>
              
              <div className="attraction-card">
                <div className="attraction-info">
                  <h4>Museu Picasso Barcelona</h4>
                  <p className="attraction-offer">Save 15% when you book via mobile!</p>
                  <p className="attraction-distance">📍 2.5km • 🚶 30 min walk • 🚕 8 min drive</p>
                </div>
                <div className="attraction-map">
                  <div id="museum-map" style={{ height: '150px', width: '100%', borderRadius: '8px' }}></div>
                </div>
              </div>

              <div className="attraction-card">
                <div className="attraction-info">
                  <h4>Barceloneta Beach</h4>
                  <p className="attraction-offer">Free beach towel rental with hotel key!</p>
                  <p className="attraction-distance">🏖️ 3km • 🚶 35 min walk • 🚕 10 min drive</p>
                </div>
                <div className="attraction-map">
                  <div id="beach-map" style={{ height: '150px', width: '100%', borderRadius: '8px' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        
        {/* Scroll Buttons inside kiosk frame */}
        {showScrollUp && (
          <button className="scroll-indicator scroll-up" onClick={scrollUp}>
            ↑
          </button>
        )}
        {showScrollDown && (
          <button className="scroll-indicator scroll-down" onClick={scrollDown}>
            ↓
          </button>
        )}
      </div>
    </div>
  );
};

export default GuestTab;
