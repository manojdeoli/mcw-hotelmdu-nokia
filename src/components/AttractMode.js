import React, { useState, useEffect, useRef } from 'react';
import './AttractMode.css';

const AttractMode = () => {
  const [currentView, setCurrentView] = useState(0);
  const [kioskAvailable, setKioskAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [erSoundEnabled, setErSoundEnabled] = useState(false);
  const channelRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const iframeRefs = useRef([]);

  // Keep a persistent channel for sound toggles (not tied to fullscreen)
  useEffect(() => {
    const ch = new BroadcastChannel('attract_mode_sync');
    channelRef.current = ch;
    return () => { ch.close(); channelRef.current = null; };
  }, []);

  // Determine healthcare port based on environment
  const getHealthcarePort = () => {
    // Check if running in production (built app) by checking if we're on port 4002
    const currentPort = window.location.port;
    if (currentPort === '4002') {
      return '3003'; // Production port
    }
    return '3000'; // Development port
  };

  const views = [
    { url: `${window.location.origin}/kiosk`, name: 'Hotel Kiosk' },
    { url: `http://localhost:${getHealthcarePort()}/#/er-dashboard`, name: 'ER Dashboard' }
  ];

  const kioskAvailableRef = useRef(false);

  useEffect(() => {
    const checkKiosk = async () => {
      const port = getHealthcarePort();
      try {
        // Try to fetch the root page or manifest.json instead of hospital_logo.png
        const res = await fetch(`http://localhost:${port}/`, { 
          cache: 'no-store',
          method: 'HEAD' // Use HEAD to avoid downloading content
        });
        const available = res.ok;
        console.log(`[AttractMode] Healthcare app check: port ${port}, available: ${available}`);
        kioskAvailableRef.current = available;
        setKioskAvailable(available);
      } catch (error) {
        console.log(`[AttractMode] Healthcare app check failed: ${error.message}`);
        kioskAvailableRef.current = false;
        setKioskAvailable(false);
      }
    };
    checkKiosk();
    // Re-check every 30s so Healthcare coming online is detected
    const poll = setInterval(checkKiosk, 30000);
    return () => clearInterval(poll);
  }, []);

  // Send initial VIEW_CHANGED so Hotel iframe starts playing immediately
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[AttractMode] Sending initial VIEW_CHANGED for hotel');
      // Send VIEW_CHANGED to hotel iframe
      channelRef.current?.postMessage({ type: 'VIEW_CHANGED', activeView: 0, activeTarget: 'hotel' });
      // Immediately pause ER iframe since hotel is active initially
      if (iframeRefs.current[1]?.contentWindow) {
        console.log('[AttractMode] Pausing ER iframe initially');
        iframeRefs.current[1].contentWindow.postMessage({ type: 'PAUSE_ALL' }, '*');
      }
    }, 1000); // Increased delay to ensure iframes are loaded
    return () => clearTimeout(timer);
  }, []);

  // Always rotate — when Healthcare unavailable, stay on view 0 (Hotel only)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentView(prev => {
        console.log(`[AttractMode] Rotation tick: prev=${prev}, healthcare available=${kioskAvailableRef.current}`);
        if (!kioskAvailableRef.current) {
          // Hotel-only: keep view 0, just re-trigger VIEW_CHANGED so GuestTab rotates its video
          console.log('[AttractMode] Hotel-only mode: staying on view 0');
          channelRef.current?.postMessage({ type: 'VIEW_CHANGED', activeView: 0, activeTarget: 'hotel' });
          return 0;
        }
        // Both apps available: rotate between views
        const newView = (prev + 1) % views.length;
        const activeTarget = newView === 0 ? 'hotel' : 'er';
        console.log(`[AttractMode] Switching to view ${newView} (${activeTarget})`);
        
        // Pause the inactive iframe
        if (activeTarget === 'hotel') {
          iframeRefs.current[1]?.contentWindow?.postMessage({ type: 'PAUSE_ALL' }, '*');
        } else {
          // When switching to ER, pause hotel video
          channelRef.current?.postMessage({ type: 'PAUSE_ALL' });
        }
        
        // Send VIEW_CHANGED to both hotel (via BroadcastChannel) and ER (via postMessage)
        channelRef.current?.postMessage({ type: 'VIEW_CHANGED', activeView: newView, activeTarget });
        iframeRefs.current[1]?.contentWindow?.postMessage({ type: 'VIEW_CHANGED', activeView: newView, activeTarget }, '*');
        
        return newView;
      });
    }, 9000);

    return () => clearInterval(interval);
  }, [views.length]);

  // Handle TRY_NOW from iframe — exit fullscreen, focus opener, close presentation tab
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type !== 'TRY_NOW') return;
      const close = async () => {
        try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
        if (window.opener) {
          window.opener.focus();
          window.close();
        } else {
          window.location.hash = '#/';
        }
      };
      close();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') exitAttractMode();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Send via BroadcastChannel (same-origin Hotel iframe) + postMessage (cross-origin ER iframe)
  const broadcast = (msg) => {
    // Hotel is same-origin: use BroadcastChannel
    channelRef.current?.postMessage(msg);
    // ER is cross-origin: use postMessage (index 1 when ER available)
    if (kioskAvailable && iframeRefs.current[1]?.contentWindow) {
      iframeRefs.current[1].contentWindow.postMessage({ ...msg, source: 'attract_mode' }, '*');
    }
  };

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      soundEnabledRef.current = next;
      broadcast({ type: 'SOUND_TOGGLE', target: 'hotel', enabled: next });
      return next;
    });
  };

  const toggleErSound = () => {
    setErSoundEnabled(prev => {
      const next = !prev;
      broadcast({ type: 'SOUND_TOGGLE', target: 'er', enabled: next });
      return next;
    });
  };

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.log('Fullscreen failed:', error);
    }
  };

  const exitAttractMode = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
    window.location.hash = '#/';
  };

  return (
    <div className={`attract-mode ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="attract-container">
        {kioskAvailable ? (
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
          <iframe
            ref={el => iframeRefs.current[0] = el}
            src={views[0].url}
            className="attract-iframe active"
            title={views[0].name}
            allow="autoplay"
            frameBorder="0"
          />
        )}
      </div>
      {isFullscreen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            cursor: 'pointer'
          }}
          onClick={exitAttractMode}
        />
      )}
      {isFullscreen ? (
        null
      ) : (
        <>
          <button
            onClick={toggleErSound}
            style={{
              position: 'fixed',
              top: '20px',
              right: '290px',
              background: erSoundEnabled ? '#28a745' : 'rgba(0,0,0,0.7)',
              color: 'white',
              border: '2px solid #007bff',
              borderRadius: '20px',
              padding: '6px 12px',
              cursor: 'pointer',
              zIndex: 10002,
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            {erSoundEnabled ? '🔊' : '🔇'} ER Sound
          </button>
          <button
            onClick={toggleSound}
            style={{
              position: 'fixed',
              top: '20px',
              right: '160px',
              background: soundEnabled ? '#28a745' : 'rgba(0,0,0,0.7)',
              color: 'white',
              border: '2px solid #e80074',
              borderRadius: '20px',
              padding: '6px 12px',
              cursor: 'pointer',
              zIndex: 10002,
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            {soundEnabled ? '🔊' : '🔇'} Hotel Sound
          </button>
          <button className="fullscreen-button" onClick={enterFullscreen}>
            Fullscreen Mode
          </button>
        </>
      )}
    </div>
  );
};

export default AttractMode;
