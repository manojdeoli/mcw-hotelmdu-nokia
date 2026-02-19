import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { format } from 'date-fns';

const CHECK_IN_DATE = new Date('2026-03-02T14:00:00');
const CHECK_OUT_DATE = new Date('2026-03-06T11:00:00');

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
  checkInConsent
}) => {
  
  const mapInitialized = useRef(false);
  const [showCheckedInContent, setShowCheckedInContent] = useState(false);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollContainerRef = useRef(null);
  const [showAttribution, setShowAttribution] = useState(false);
  
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
      verifiedPhoneNumber,
      hasReachedHotel,
      firstName: formState.firstName || formState.name
    });
  }, [checkInStatus, verifiedPhoneNumber, hasReachedHotel, formState]);
  
  // Show checked-in content with delay after check-in
  useEffect(() => {
    if (checkInStatus === 'Checked In' && !showCheckedInContent) {
      const timer = setTimeout(() => {
        setShowCheckedInContent(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else if (checkInStatus !== 'Checked In') {
      setShowCheckedInContent(false);
    }
  }, [checkInStatus, showCheckedInContent]);
  
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
    if (checkInStatus !== 'Checked In' && mapInitialized.current && museumMap) {
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
      {/* Static Background Image - Hotel Entrance */}
      <div className="kiosk-background" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/Hotel_entrance.png)`, backgroundPosition: 'center top', backgroundSize: 'cover' }}></div>
      
      {/* Attribution Button */}
      <button
        onClick={() => setShowAttribution(!showAttribution)}
        style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          padding: '5px 10px',
          fontSize: '0.7rem',
          cursor: 'pointer',
          zIndex: 10
        }}
      >
        ℹ️ Image Attribution
      </button>

      {/* Attribution Popup */}
      {showAttribution && (
        <div
          style={{
            position: 'fixed',
            bottom: '50px',
            left: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '2px solid #007bff',
            borderRadius: '8px',
            padding: '15px',
            maxWidth: '350px',
            zIndex: 11,
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
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Image Source:</div>
          <div style={{ marginBottom: '10px' }}>AI-generated using OpenAI DALL·E</div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Generation Method:</div>
          <div style={{ marginBottom: '10px' }}>Created from a custom prompt describing a photorealistic hotel entrance and lobby environment designed for UI overlay demonstrations.</div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Content Note:</div>
          <div>The image is fully synthetic and created for internal demonstration and visualization purposes.</div>
        </div>
      )}
      
      {/* Embedded Kiosk Screen */}
      <div className="kiosk-screen-frame" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/kiosk.png)` }}>
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
          <div className="kiosk-welcome-idle">
            <h3>Welcome, {firstName}!</h3>
            <p>Approaching hotel entrance...</p>
          </div>
        )}

        {checkInStatus === 'Checked Out' && (
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

        {verifiedPhoneNumber && checkInStatus === 'At Kiosk' && isSequenceRunning && checkInStatus !== 'Checked In' && checkInStatus !== 'Checked Out' && (
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
                <span className="info-value">{format(CHECK_IN_DATE, 'MMM dd, yyyy • HH:mm')}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Check-out:</span>
                <span className="info-value">{format(CHECK_OUT_DATE, 'MMM dd, yyyy • HH:mm')}</span>
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

        {checkInStatus === 'Checked In' && showCheckedInContent && (
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
              <h3>🏨 Hotel Amenities</h3>
              <div className="amenity-grid">
                <div className="amenity-card">
                  <div className="amenity-icon">🍽️</div>
                  <h4>La Cocina del Sol</h4>
                  <p>Free starter with main course</p>
                  <span className="amenity-location">Ground Floor</span>
                </div>
                <div className="amenity-card">
                  <div className="amenity-icon">💆</div>
                  <h4>Sol Wellness Spa</h4>
                  <p>20% off all treatments</p>
                  <span className="amenity-location">Level 6</span>
                </div>
                <div className="amenity-card">
                  <div className="amenity-icon">💪</div>
                  <h4>Fitness Center</h4>
                  <p>Free 24/7 access</p>
                  <span className="amenity-location">Level 4</span>
                </div>
                <div className="amenity-card">
                  <div className="amenity-icon">🏊</div>
                  <h4>Rooftop Pool & Bar</h4>
                  <p>Free welcome cocktail</p>
                  <span className="amenity-location">Level 5</span>
                </div>
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
      </div>
      
      {/* Fixed Scroll Buttons */}
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
  );
};

export default GuestTab;
