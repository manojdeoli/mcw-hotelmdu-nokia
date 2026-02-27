import React, { useState, useEffect, useRef } from 'react';
import './AttractMode.css';

// Presentation sequence configuration
const SEQUENCE_CONFIG = {
  HOTEL_SLIDE_DURATION: 5000, // 5 seconds
  HEALTHCARE_SLIDE_DURATION: 5000, // 5 seconds
  WIPRO_LOGO_DURATION: 2000, // 2 seconds
  FREEZE_DURATION: 3000, // 3 seconds freeze after video
  FADE_DURATION: 1200 // 1.2 seconds for transitions
};

// Hotel videos for rotation
const HOTEL_VIDEOS = ['Hotel_Entrance_Veo_1.mp4', 'Hotel_Entrance_Veo_2.mp4', 'Hotel_Entrance_Veo_3.mp4'];

// Presentation sequence steps
const SEQUENCE_STEPS = [
  { type: 'HOTEL_VIDEO_1', target: 'hotel' },
  { type: 'HOTEL_VIDEO_2', target: 'hotel' },
  { type: 'HOTEL_SLIDE', duration: SEQUENCE_CONFIG.HOTEL_SLIDE_DURATION },
  { type: 'WIPRO_LOGO', duration: SEQUENCE_CONFIG.WIPRO_LOGO_DURATION },
  { type: 'ER_VIDEO_1', target: 'er' },
  { type: 'ER_VIDEO_2', target: 'er' },
  { type: 'HEALTHCARE_SLIDE', duration: SEQUENCE_CONFIG.HEALTHCARE_SLIDE_DURATION },
  { type: 'WIPRO_LOGO', duration: SEQUENCE_CONFIG.WIPRO_LOGO_DURATION }
];

const AttractMode = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isShowingSlide, setIsShowingSlide] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(null);
  const [slideExiting, setSlideExiting] = useState(false);
  const [healthcareAvailable, setHealthcareAvailable] = useState(false);
  const [healthcarePort, setHealthcarePort] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hotelSoundEnabled, setHotelSoundEnabled] = useState(() => {
    return localStorage.getItem('hotel_audio_enabled') === 'true';
  });
  const [erSoundEnabled, setErSoundEnabled] = useState(() => {
    return localStorage.getItem('er_audio_enabled') === 'true';
  });
  const [isFrozen, setIsFrozen] = useState(false);
  const [currentHotelVideos, setCurrentHotelVideos] = useState([]);
  
  const iframeRefs = useRef([]);
  const stepTimerRef = useRef(null);
  const currentStepRef = useRef(0);
  const frozenRef = useRef(false);
  const healthcareAvailableRef = useRef(false);
  const healthcarePortRef = useRef(null);
  const hotelVideoIndexRef = useRef(0);

  // Video rotation logic - select 2 different videos from 3 available
  const selectHotelVideos = () => {
    const availableVideos = [...HOTEL_VIDEOS];
    const selected = [];
    
    // Pick first video randomly
    const firstIndex = Math.floor(Math.random() * availableVideos.length);
    selected.push(availableVideos[firstIndex]);
    availableVideos.splice(firstIndex, 1);
    
    // Pick second video from remaining
    const secondIndex = Math.floor(Math.random() * availableVideos.length);
    selected.push(availableVideos[secondIndex]);
    
    console.log('[AttractMode] Selected hotel videos for this sequence:', selected);
    return selected;
  };

  // Initialize hotel videos for first sequence
  useEffect(() => {
    setCurrentHotelVideos(selectHotelVideos());
  }, []);

  // Get current sequence step
  const getCurrentStep = () => SEQUENCE_STEPS[currentStep];
  const step = getCurrentStep();

  // Determine if we should show iframe content
  const shouldShowIframe = step.type.includes('VIDEO') && !isShowingSlide;
  const activeTarget = step.target;
  const currentView = step.target === 'hotel' ? 0 : 1;

  const getViews = () => [
    { url: `${window.location.origin}/kiosk`, name: 'Hotel Kiosk' },
    { url: healthcarePort ? `http://localhost:${healthcarePort}/#/er-dashboard` : null, name: 'ER Dashboard' }
  ].filter(view => view.url);

  // Send via BroadcastChannel (same-origin Hotel iframe) + postMessage (cross-origin ER iframe)
  const broadcast = (msg) => {
    console.log('📡 AttractMode broadcasting:', msg);
    // Hotel is same-origin: use BroadcastChannel
    const ch = new BroadcastChannel('attract_mode_sync');
    ch.postMessage(msg);
    ch.close();
    // ER is cross-origin: use postMessage
    iframeRefs.current.forEach((iframe, i) => {
      const views = getViews();
      if (views[i]?.name === 'ER Dashboard' && iframe?.contentWindow) {
        console.log('📤 Sending to ER iframe:', msg);
        iframe.contentWindow.postMessage({ ...msg, source: 'attract_mode' }, '*');
      }
    });
  };

  // Move to next step in sequence
  const nextStep = () => {
    setCurrentStep(prev => {
      const next = (prev + 1) % SEQUENCE_STEPS.length;
      currentStepRef.current = next;
      
      // If we're starting a new sequence (back to step 0), select new hotel videos
      if (next === 0) {
        console.log('[AttractMode] Starting new sequence - selecting new hotel videos');
        setCurrentHotelVideos(selectHotelVideos());
        hotelVideoIndexRef.current = 0;
      }
      
      return next;
    });
  };

  // Handle slide display
  const showSlide = (slideType, duration) => {
    setSlideExiting(false);
    setIsShowingSlide(true);
    setCurrentSlide(slideType);
    
    stepTimerRef.current = setTimeout(() => {
      // Start exit animation
      setSlideExiting(true);
      
      // Wait for exit animation to complete before moving to next step
      setTimeout(() => {
        setIsShowingSlide(false);
        setCurrentSlide(null);
        setSlideExiting(false);
        nextStep();
      }, SEQUENCE_CONFIG.FADE_DURATION);
    }, duration - SEQUENCE_CONFIG.FADE_DURATION);
  };

  // Handle video completion with freeze
  const handleVideoComplete = () => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
    }
    
    console.log('🎬 Video completed, starting freeze sequence');
    
    // Send FREEZE_START to iframe
    broadcast({ type: 'FREEZE_START' });
    setIsFrozen(true);
    
    // Wait for freeze duration, then proceed
    stepTimerRef.current = setTimeout(() => {
      console.log('❄️ Freeze complete, proceeding to next step');
      broadcast({ type: 'FREEZE_END' });
      setIsFrozen(false);
      nextStep();
    }, SEQUENCE_CONFIG.FREEZE_DURATION);
  };

  // Healthcare detection
  useEffect(() => {
    const getHealthcarePort = () => {
      const currentPort = window.location.port;
      return currentPort === '4002' ? '3003' : '3000';
    };

    const checkHealthcare = async () => {
      const port = getHealthcarePort();
      try {
        const check = await fetch(`http://localhost:${port}/`, { 
          cache: 'no-store',
          method: 'HEAD'
        });
        if (check.ok) {
          console.log(`Healthcare available on port ${port}`);
          healthcarePortRef.current = port;
          healthcareAvailableRef.current = true;
          setHealthcarePort(port);
          setHealthcareAvailable(true);
          return;
        }
      } catch {
        console.log(`Healthcare not available on port ${port}`);
      }
      console.log('Healthcare not available, showing only Hotel');
      healthcareAvailableRef.current = false;
      setHealthcareAvailable(false);
    };
    
    checkHealthcare();
    const poll = setInterval(checkHealthcare, 30000);
    return () => clearInterval(poll);
  }, []);

  // Main sequence controller
  useEffect(() => {
    const step = getCurrentStep();
    
    if (step.type.includes('SLIDE') || step.type === 'WIPRO_LOGO') {
      // Show static slide
      showSlide(step.type, step.duration);
    } else if (step.type.includes('VIDEO')) {
      // Show video iframe
      setIsShowingSlide(false);
      setCurrentSlide(null);
      
      const activeTarget = step.target;
      const activeView = step.target === 'hotel' ? 0 : 1;
      
      // Determine video number and specific video for hotel
      let videoNumber = 1;
      let specificVideo = null;
      
      if (step.type.includes('VIDEO_1')) {
        videoNumber = 1;
        if (activeTarget === 'hotel') {
          specificVideo = currentHotelVideos[0];
          hotelVideoIndexRef.current = 0;
        }
      } else if (step.type.includes('VIDEO_2')) {
        videoNumber = 2;
        if (activeTarget === 'hotel') {
          specificVideo = currentHotelVideos[1];
          hotelVideoIndexRef.current = 1;
        }
      }
      
      // Broadcast immediately to iframe with current audio state
      broadcast({ 
        type: 'VIEW_CHANGED', 
        activeView, 
        activeTarget,
        videoNumber,
        specificVideo
      });
      
      // Ensure audio state is applied after VIEW_CHANGED
      setTimeout(() => {
        const audioEnabled = activeTarget === 'hotel' ? hotelSoundEnabled : erSoundEnabled;
        broadcast({ 
          type: 'SOUND_TOGGLE', 
          target: activeTarget, 
          enabled: audioEnabled 
        });
      }, 100);
      
      // Set timeout for video duration (will be overridden by actual video end)
      stepTimerRef.current = setTimeout(() => {
        handleVideoComplete();
      }, 8000);
    }
    
    return () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
      }
    };
  }, [currentStep, currentHotelVideos, hotelSoundEnabled, erSoundEnabled]);

  // Start sequence on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const step = getCurrentStep();
      if (step.type.includes('VIDEO')) {
        const specificVideo = step.target === 'hotel' ? currentHotelVideos[0] : null;
        broadcast({ 
          type: 'VIEW_CHANGED', 
          activeView: step.target === 'hotel' ? 0 : 1, 
          activeTarget: step.target,
          videoNumber: 1,
          specificVideo
        });
        
        // Ensure audio state is applied after initial VIEW_CHANGED
        setTimeout(() => {
          const audioEnabled = step.target === 'hotel' ? hotelSoundEnabled : erSoundEnabled;
          broadcast({ 
            type: 'SOUND_TOGGLE', 
            target: step.target, 
            enabled: audioEnabled 
          });
        }, 200);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentHotelVideos, hotelSoundEnabled, erSoundEnabled]);

  // Handle messages from iframes
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'TRY_NOW') {
        const close = async () => {
          try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
          if (window.opener) {
            window.opener.focus();
            window.close();
          } else {
            window.location.hash = '/';
          }
        };
        close();
      } else if (event.data?.type === 'VIDEO_ENDED') {
        console.log('📺 Received VIDEO_ENDED from iframe');
        handleVideoComplete();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Handle exit on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        exitAttractMode();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleHotelSound = (e) => {
    e.stopPropagation();
    setHotelSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('hotel_audio_enabled', next.toString());
      broadcast({ type: 'SOUND_TOGGLE', target: 'hotel', enabled: next });
      return next;
    });
  };

  const toggleErSound = (e) => {
    e.stopPropagation();
    setErSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('er_audio_enabled', next.toString());
      broadcast({ type: 'SOUND_TOGGLE', target: 'er', enabled: next });
      return next;
    });
  };

  const enterFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen request failed:', error);
    }
  };

  const exitAttractMode = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.log('Exit fullscreen failed:', error);
    }
    window.location.hash = '/';
  };

  return (
    <div className="attract-mode">
      {/* Slide Display */}
      {isShowingSlide && (
        <div className={`slide-container ${slideExiting ? 'slide-out' : ''}`} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#fff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <img
            src={currentSlide === 'WIPRO_LOGO' ? '/wipro-logo.png' : 
                 currentSlide === 'HOTEL_SLIDE' ? '/AdunaSlideforDemo.png' : '/NokiaSlideforDemo.png'}
            alt={currentSlide === 'WIPRO_LOGO' ? 'Wipro Logo' : 
                 currentSlide === 'HOTEL_SLIDE' ? 'Aduna Demo Slide' : 'Nokia Demo Slide'}
            style={{
              maxWidth: '100vw',
              maxHeight: '100vh',
              objectFit: 'contain'
            }}
          />
        </div>
      )}
      

      
      {/* Iframe Content */}
      {shouldShowIframe && (
        <div className="attract-container">
          {(() => {
            const views = getViews();
            return healthcareAvailable ? (
              views.map((view, index) => (
                <iframe
                  key={index}
                  ref={el => iframeRefs.current[index] = el}
                  src={view.url}
                  className={`attract-iframe ${currentView === index ? 'active' : ''}`}
                  title={view.name}
                  allow="autoplay"
                  frameBorder="0"
                />
              ))
            ) : (
              // Show only Hotel when Healthcare is not available
              <iframe
                ref={el => iframeRefs.current[0] = el}
                src={views[0].url}
                className="attract-iframe active"
                title={views[0].name}
                allow="autoplay"
                frameBorder="0"
              />
            );
          })()}
        </div>
      )}
      
      {isFullscreen && (
        <div className="click-overlay" onClick={exitAttractMode}></div>
      )}
      
      {!isFullscreen && (
        <>
          <button className="fullscreen-button" onClick={enterFullscreen}>
            Fullscreen Mode
          </button>
          <button
            onClick={toggleHotelSound}
            style={{
              position: 'fixed',
              top: '20px',
              right: '160px',
              background: hotelSoundEnabled ? '#28a745' : 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: '2px solid #e80074',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '14px',
              cursor: 'pointer',
              zIndex: 10002,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
            }}
            title="Toggle Hotel sound"
          >
            {hotelSoundEnabled ? '🔊' : '🔇'} <span style={{ fontSize: '11px' }}>Hotel Sound</span>
          </button>
          {healthcareAvailable && (
            <button
              onClick={toggleErSound}
              style={{
                position: 'fixed',
                top: '20px',
                right: '290px',
                background: erSoundEnabled ? '#28a745' : 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: '2px solid #007bff',
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '14px',
                cursor: 'pointer',
                zIndex: 10002,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}
              title="Toggle Healthcare ER sound"
            >
              {erSoundEnabled ? '🔊' : '🔇'} <span style={{ fontSize: '11px' }}>ER Sound</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AttractMode;