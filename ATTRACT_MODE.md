# Attract Mode

## Overview
The Attract Mode displays alternating views of the Hotel Kiosk and ER Dashboard applications with smooth slide transitions. It's designed for demo displays and kiosks.

## How to Access
Navigate to either:
- `http://localhost:4001/attract-mode` 
- `http://localhost:4001/#/attract-mode`

## Features
- **Automatic Detection**: Checks if Hotel Kiosk app is running
- **Smart Display**:
  - If both apps are available: Alternates between them every 8 seconds with smooth slide transitions
  - If only ER Dashboard is available: Displays just the ER Dashboard without transitions
- **Easy Exit**: Press ESC or click anywhere on the screen to return to the main app

## Testing
1. Start the application: `npm start`
2. Open `http://localhost:4001/#/attract-mode` in your browser
3. The attract mode should display with alternating views
4. Press ESC or click anywhere to exit

## Technical Details
- Uses iframe embedding to display both applications
- Smooth CSS transitions for professional appearance
- Fullscreen-friendly design
- Automatic health checks for app availability

## Usage Scenarios
1. **Demo Booth**: Display both applications in rotation at trade shows
2. **Kiosk Mode**: Attract customers with alternating content
3. **Presentation**: Show multiple app features automatically
