import React, { useState, useEffect } from 'react';
import './AttractMode.css';

const AttractMode = () => {
  const [currentView, setCurrentView] = useState(0);
  const [kioskAvailable, setKioskAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const views = [
    { url: `${window.location.origin}/kiosk`, name: 'Hotel Kiosk' },
    { url: 'http://localhost:3000/#/er-dashboard', name: 'ER Dashboard' }
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

  useEffect(() => {
    if (!kioskAvailable || !isFullscreen) return;
    const interval = setInterval(() => {
      setCurrentView(prev => (prev + 1) % views.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [kioskAvailable, isFullscreen, views.length]);

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
    <div className={`attract-mode ${isFullscreen ? 'fullscreen' : ''}`} onClick={isFullscreen ? exitAttractMode : undefined}>
      <div className="attract-container">
        {kioskAvailable ? (
          views.map((view, index) => (
            <iframe
              key={index}
              src={view.url}
              className={`attract-iframe ${currentView === index ? 'active' : ''}`}
              title={view.name}
              frameBorder="0"
            />
          ))
        ) : (
          <iframe
            src={views[1].url}
            className="attract-iframe active"
            title={views[1].name}
            frameBorder="0"
          />
        )}
      </div>
      {isFullscreen ? (
        <div className="exit-hint">Press ESC or click anywhere to exit</div>
      ) : (
        <button className="fullscreen-button" onClick={enterFullscreen}>
          Enter Fullscreen Mode
        </button>
      )}
    </div>
  );
};

export default AttractMode;
