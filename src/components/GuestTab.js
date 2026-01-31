import React, { useEffect } from 'react';
import L from 'leaflet';

const GuestTab = ({ 
  checkInStatus, 
  formState, 
  verifiedPhoneNumber,
  activeTab,
  museumMap,
  setMuseumMap,
  hasReachedHotel
}) => {
  
  // Initialize museum map when tab is active and checked in
  useEffect(() => {
    if (activeTab === 'guest' && checkInStatus === 'Checked In' && !museumMap) {
      setTimeout(() => {
        const mapElement = document.getElementById('museum-map');
        if (mapElement && !museumMap) {
          const museumCoords = [41.3851, 2.1734];
          const hotelCoords = [41.3874, 2.1686];
          
          const mapInstance = L.map('museum-map').setView([(museumCoords[0] + hotelCoords[0])/2, (museumCoords[1] + hotelCoords[1])/2], 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(mapInstance);
          
          const hotelIcon = L.divIcon({
            html: '<div style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🏨</div>',
            className: '',
            iconSize: [30, 30]
          });
          L.marker(hotelCoords, { icon: hotelIcon }).addTo(mapInstance).bindPopup('Hotel Barcelona Sol');
          
          const museumIcon = L.divIcon({
            html: '<div style="background: #e80074; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white;">🎨</div>',
            className: '',
            iconSize: [30, 30]
          });
          L.marker(museumCoords, { icon: museumIcon }).addTo(mapInstance).bindPopup('Museu Picasso Barcelona');
          
          L.polyline([hotelCoords, museumCoords], {
            color: '#007bff',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
          }).addTo(mapInstance);
          
          setMuseumMap(mapInstance);
        }
      }, 300);
    }
    
    return () => {
      if (museumMap && activeTab !== 'guest') {
        museumMap.remove();
        setMuseumMap(null);
      }
    };
  }, [activeTab, checkInStatus, museumMap, setMuseumMap]);

  return (
    <div className="guest-tab-container">
      <div className="hotel-header">
        <div className="hotel-logo-placeholder">🏨</div>
        <h1 className="hotel-name">Hotel Barcelona Sol</h1>
        <div className="hotel-rating">⭐⭐⭐⭐⭐</div>
      </div>

      <div className="welcome-section">
        <h2>Welcome{formState.name ? `, ${formState.name.split(' ')[0]}` : ''}!</h2>
        {verifiedPhoneNumber && hasReachedHotel && checkInStatus !== 'Checked In' && (
          <div className="checkin-prompt-container">
            <div className="checkin-text">
              <p>Ready to begin your stay?</p>
              <p className="checkin-subtitle">Complete your check-in process to access your room and hotel amenities.</p>
            </div>
            <div className="checkin-button-wrapper">
              <button className="btn btn-primary btn-lg">Tap here to check in for your stay</button>
            </div>
          </div>
        )}
      </div>

      {checkInStatus === 'Checked In' && (
        <div className="wayfinding-section">
          <h3>🗺️ Directions to Your Room</h3>
          <div className="content-with-visual">
            <div className="text-content">
              <p className="room-number">Room 1337 • Floor 13</p>
              <p className="directions-text">
                From the lobby, proceed to the main elevator bank. Take the elevator to Floor 13. 
                Turn left when you exit the elevator, and your room is the 7th door on the right.
              </p>
            </div>
            <div className="visual-content">
              <div className="floor-plan">
                <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="380" height="180" fill="#f8f9fa" stroke="#333" strokeWidth="2"/>
                  <rect x="180" y="10" width="40" height="40" fill="#007bff" stroke="#333" strokeWidth="1"/>
                  <text x="200" y="35" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">🛗</text>
                  <line x1="200" y1="50" x2="200" y2="100" stroke="#666" strokeWidth="3" strokeDasharray="5,5"/>
                  <path d="M 200 100 L 220 90 M 200 100 L 220 110" stroke="#007bff" strokeWidth="3" fill="none"/>
                  <line x1="200" y1="100" x2="320" y2="100" stroke="#666" strokeWidth="3" strokeDasharray="5,5"/>
                  <rect x="340" y="60" width="30" height="25" fill="#e9ecef" stroke="#333" strokeWidth="1"/>
                  <text x="355" y="77" textAnchor="middle" fontSize="8">1331</text>
                  <rect x="340" y="90" width="30" height="25" fill="#e9ecef" stroke="#333" strokeWidth="1"/>
                  <text x="355" y="107" textAnchor="middle" fontSize="8">1333</text>
                  <rect x="340" y="120" width="30" height="25" fill="#e9ecef" stroke="#333" strokeWidth="1"/>
                  <text x="355" y="137" textAnchor="middle" fontSize="8">1335</text>
                  <rect x="290" y="60" width="30" height="25" fill="#e9ecef" stroke="#333" strokeWidth="1"/>
                  <text x="305" y="77" textAnchor="middle" fontSize="8">1332</text>
                  <rect x="290" y="90" width="30" height="25" fill="#e9ecef" stroke="#333" strokeWidth="1"/>
                  <text x="305" y="107" textAnchor="middle" fontSize="8">1334</text>
                  <rect x="290" y="120" width="30" height="25" fill="#e9ecef" stroke="#333" strokeWidth="1"/>
                  <text x="305" y="137" textAnchor="middle" fontSize="8">1336</text>
                  <rect x="290" y="150" width="30" height="25" fill="#28a745" stroke="#333" strokeWidth="2"/>
                  <text x="305" y="167" textAnchor="middle" fontSize="8" fontWeight="bold">1337</text>
                  <text x="305" y="180" textAnchor="middle" fontSize="10" fill="#28a745">📍 Your Room</text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkInStatus === 'Checked In' && (
        <div className="offers-section">
          <h3>🏨 Hotel Amenities & Offers</h3>
          
          <div className="offer-item">
            <div className="content-with-visual">
              <div className="text-content">
                <h4>🍽️ La Cocina del Sol</h4>
                <p className="offer-subtitle">Award-winning Mediterranean restaurant</p>
                <div className="ratings">
                  <span>⭐ 4.8/5 on TripAdvisor</span>
                  <span className="ml-3">⭐ 4.7/5 on Google</span>
                </div>
                <p className="offer-details">Enjoy one complimentary starter when you order a main course!</p>
                <p className="offer-hours">📅 Open: 7:00 AM - 11:00 PM • Ground Floor</p>
                <p className="terms">*Terms and conditions apply</p>
              </div>
              <div className="visual-content">
                <div className="offer-badge">
                  <div className="badge-icon">🍽️</div>
                  <div className="badge-text">Free Starter</div>
                </div>
              </div>
            </div>
          </div>

          <div className="offer-item">
            <div className="content-with-visual">
              <div className="text-content">
                <h4>💆 Sol Wellness Spa</h4>
                <p className="offer-subtitle">Luxury spa & wellness center</p>
                <p className="offer-details">20% off all spa treatments for hotel guests!</p>
                <p className="offer-features">✨ Massage • Facial • Sauna • Hot Tub</p>
                <p className="offer-hours">📅 Open: 9:00 AM - 9:00 PM • Level 6</p>
                <p className="terms">*Advance booking recommended</p>
              </div>
              <div className="visual-content">
                <div className="offer-badge">
                  <div className="badge-icon">💆</div>
                  <div className="badge-text">20% Off</div>
                </div>
              </div>
            </div>
          </div>

          <div className="offer-item">
            <div className="content-with-visual">
              <div className="text-content">
                <h4>💪 Barcelona Fitness Center</h4>
                <p className="offer-subtitle">State-of-the-art gym facilities</p>
                <p className="offer-details">Complimentary access for all hotel guests!</p>
                <p className="offer-features">🏋️ Cardio • Weights • Yoga Studio • Personal Trainer</p>
                <p className="offer-hours">📅 Open: 24/7 • Level 4</p>
                <p className="terms">*Personal training sessions available at extra cost</p>
              </div>
              <div className="visual-content">
                <div className="offer-badge">
                  <div className="badge-icon">💪</div>
                  <div className="badge-text">Free Access</div>
                </div>
              </div>
            </div>
          </div>

          <div className="offer-item">
            <div className="content-with-visual">
              <div className="text-content">
                <h4>🏊 Rooftop Pool & Bar</h4>
                <p className="offer-subtitle">Infinity pool with panoramic city views</p>
                <p className="offer-details">Free welcome cocktail at the pool bar!</p>
                <p className="offer-features">🍹 Pool Bar • Sun Loungers • Towel Service</p>
                <p className="offer-hours">📅 Open: 8:00 AM - 10:00 PM • Level 5</p>
                <p className="terms">*One cocktail per guest per stay</p>
              </div>
              <div className="visual-content">
                <div className="offer-badge">
                  <div className="badge-icon">🏊</div>
                  <div className="badge-text">Free Cocktail</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {checkInStatus === 'Checked In' && (
        <div className="partner-offers-section">
          <h3>🎨 Local Attractions</h3>
          <div className="content-with-visual">
            <div className="text-content">
              <h4>Museu Picasso Barcelona</h4>
              <p className="offer-subtitle">Award-winning art museum</p>
              <p className="offer-details">Save 15% when you book via mobile phone!</p>
              <p className="location-info">📍 Just 2.5km from the hotel • 🚶 30 min walk • 🚕 8 min drive</p>
              <p className="terms">*Terms and conditions apply</p>
            </div>
            <div className="visual-content">
              <div className="location-map">
                <div id="museum-map" style={{ height: '100%', width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!verifiedPhoneNumber && (
        <div className="welcome-message">
        </div>
      )}
    </div>
  );
};

export default GuestTab;
