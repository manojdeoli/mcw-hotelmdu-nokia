# AttractMode_new.js Implementation

## Overview
Enhanced presentation sequence for hotel demo with structured video playback, freeze transitions, and proper video rotation.

## Sequence Flow

### Complete Sequence (8 steps):
1. **Hotel Video 1** → 3-second freeze → transition
2. **Hotel Video 2** → 3-second freeze → transition  
3. **Hotel Static Slide** (5 seconds) → transition
4. **Wipro Logo** (2 seconds) → transition
5. **Healthcare ER Video 1** → 3-second freeze → transition
6. **Healthcare ER Video 2** → 3-second freeze → transition
7. **Healthcare Static Slide** (5 seconds) → transition
8. **Wipro Logo** (2 seconds) → **Loop back to step 1**

## Key Features

### Video Rotation Logic
- **3 Hotel Videos Available**: `Hotel_Entrance_Veo_1.mp4`, `Hotel_Entrance_Veo_2.mp4`, `Hotel_Entrance_Veo_3.mp4`
- **Per Sequence**: Selects 2 different videos randomly
- **No Repetition**: Within a single sequence, no video repeats
- **Good Rotation**: Across sequences, ensures all videos get used

### Freeze Functionality
- **3-Second Freeze**: After each video completes
- **Visual Indicator**: "❄️ Transitioning..." overlay
- **Message System**: `FREEZE_START` → wait 3s → `FREEZE_END`
- **Iframe Control**: Videos pause during freeze, resume after

### Static Slides
- **No Background Video**: Clean static display
- **Configurable Duration**: 5 seconds for content slides, 2 seconds for logo
- **Fade Transitions**: Smooth entry/exit animations
- **Full Screen**: Covers entire viewport

## Configuration

```javascript
const SEQUENCE_CONFIG = {
  HOTEL_SLIDE_DURATION: 5000,      // 5 seconds
  HEALTHCARE_SLIDE_DURATION: 5000, // 5 seconds  
  WIPRO_LOGO_DURATION: 2000,       // 2 seconds
  FREEZE_DURATION: 3000,           // 3 seconds freeze
  FADE_DURATION: 1200              // 1.2 seconds transitions
};
```

## Message System

### From AttractMode to Iframes:
- `VIEW_CHANGED`: Switch active view with specific video
- `SOUND_TOGGLE`: Enable/disable audio
- `FREEZE_START`: Pause video for freeze period
- `FREEZE_END`: Resume video after freeze

### From Iframes to AttractMode:
- `VIDEO_ENDED`: Notify when video completes
- `TRY_NOW`: Exit presentation mode

## Required Assets

### Images (to be added to /public):
1. **wipro-logo.png** - Wipro company logo
   - Format: PNG
   - Size: 1920x1080 recommended
   - Content: Clean Wipro logo on white/transparent background

2. **hotel-healthcare-slide.png** - Combined use case slide
   - Format: PNG  
   - Size: 1920x1080 recommended
   - Content: Hotel and Healthcare use case information

## Usage

### To Use New Implementation:
1. Replace `AttractMode.js` import with `AttractMode_new.js` in routing
2. Add required image assets to `/public` folder
3. Test sequence flow and video rotation

### Fallback:
- Original `AttractMode.js` remains as backup
- Can switch back by changing import

## Technical Details

### Video Selection Algorithm:
```javascript
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
  
  return selected;
};
```

### Freeze Implementation:
1. Video completes → `handleVideoComplete()`
2. Send `FREEZE_START` → iframe pauses video
3. Wait 3 seconds → show freeze overlay
4. Send `FREEZE_END` → iframe can resume
5. Proceed to next sequence step

## Benefits

1. **Structured Presentation**: Clear separation between use cases
2. **Professional Transitions**: 3-second freeze creates polished feel
3. **Good Video Rotation**: Ensures variety without repetition
4. **Clean Slides**: Static content without video distraction
5. **Configurable Timing**: Easy to adjust durations
6. **Backward Compatible**: Original AttractMode preserved