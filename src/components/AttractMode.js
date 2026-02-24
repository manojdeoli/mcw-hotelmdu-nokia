import React, { useState, useEffect, useRef } from 'react';
import './AttractMode.css';

const AttractMode = () => {
  const [currentView, setCurrentView] = useState(0);
  const [kioskAvailable, setKioskAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const channelRef = useRef(null);
  const soundEnabledRef = useRef(false);

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

  useEffect(() => {
    const checkKiosk = () => {
      const img = new Image();
      img.onload = () => setKioskAvailable(true);
      img.onerror = () => setKioskAvailable(false);
      img.src = `${window.location.origin}/hotel_logo.png?` + Date.now();
    };
    checkKiosk();
  }, []);

  // Tell ER iframe it's inactive as soon as it's available (presentation view + fullscreen)
  useEffect(() => {
    if (!kioskAvailable) return;
    const timer = setTimeout(() => {
      iframeRefs.current[1]?.contentWindow?.postMessage({ type: 'VIEW_CHANGED', activeView: 0, activeTarget: 'hotel' }, '*');
    }, 500);
    return () => clearTimeout(timer);
  }, [kioskAvailable]);

  useEffect(() => {
    if (!kioskAvailable) return;

    const interval = setInterval(() => {
      setCurrentView(prev => {
        const newView = (prev + 1) % views.length;
        const activeTarget = newView === 0 ? 'hotel' : 'er';
        if (activeTarget === 'hotel') {
          iframeRefs.current[1]?.contentWindow?.postMessage({ type: 'PAUSE_ALL' }, '*');
        }
        channelRef.current?.postMessage({ type: 'VIEW_CHANGED', activeView: newView, activeTarget });
        iframeRefs.current[1]?.contentWindow?.postMessage({ type: 'VIEW_CHANGED', activeView: newView, activeTarget }, '*');
        return newView;
      });
    }, 9000);

    return () => clearInterval(interval);
  }, [kioskAvailable, views.length]);

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

  const [erSoundEnabled, setErSoundEnabled] = useState(false);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      soundEnabledRef.current = next;
      channelRef.current?.postMessage({ type: 'SOUND_TOGGLE', target: 'hotel', enabled: next });
      return next;
    });
  };

  const iframeRefs = useRef([]);

  const toggleErSound = () => {
    setErSoundEnabled(prev => {
      const next = !prev;
      // ER iframe is index 1 (healthcare, different origin) - must use postMessage
      const erIframe = iframeRefs.current[1];
      if (erIframe?.contentWindow) {
        erIframe.contentWindow.postMessage({ type: 'SOUND_TOGGLE', target: 'er', enabled: next }, '*');
      }
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
            ref={el => iframeRefs.current[1] = el}
            src={views[1].url}
            className="attract-iframe active"
            title={views[1].name}
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
        <button className="fullscreen-button" onClick={enterFullscreen}>
          Fullscreen Mode
        </button>
      )}
      <button
        onClick={toggleSound}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: soundEnabled ? '#28a745' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '25px',
          padding: '12px 20px',
          cursor: 'pointer',
          zIndex: 10002,
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        {soundEnabled ? '🔊' : '🔇'} Hotel Sound
      </button>
      <button
        onClick={toggleErSound}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '170px',
          background: erSoundEnabled ? '#28a745' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '25px',
          padding: '12px 20px',
          cursor: 'pointer',
          zIndex: 10002,
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        {erSoundEnabled ? '🔊' : '🔇'} ER Sound
      </button>
    </div>
  );
};

export default AttractMode;
