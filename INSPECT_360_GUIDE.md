# 360° Digital Inspection & Labeling Solution

## Overview

The 360° Digital Inspection & Labeling Solution transforms standard smartphone 360° captures into an interactive, professional-grade 3D environment for vehicle assessment and customer transparency. This system is built on Babylon.js and provides inspectors with an immersive inspection experience.

## Features

### 1. **Multi-Angle Navigation**
- Switch between different viewing angles: Front, Left Side, Right Side, Rear, and Top
- Instant texture swapping without page reloads
- Seamless transition between camera positions

### 2. **Dynamic Data Hotspots**
- **Visual Indicators:** Glowing markers appear on areas requiring attention
- **Contextual Pop-ups:** Click markers to reveal specific data (PSI, Depth, Damage conditions)
- **Inspection State:** Markers change color based on status:
  - **Green** = Pass
  - **Yellow** = Warning
  - **Red** = Fail

### 3. **Interactive Labeling System**
- Add inspection labels directly to 360° images
- Attach metadata to each label (PSI readings, tread depth, damage descriptions)
- Labels are organized by viewing angle and severity

### 4. **Coordinate Finder Tool**
- Click directly on the 360° image to find exact 3D coordinates
- Useful for developers and lead inspectors to place labels precisely
- Manual coordinate entry for fine-tuning
- Copy coordinates to clipboard for reference

### 5. **Status Report Generation**
- Generate professional PDF reports of all inspection labels
- Includes vehicle information, summary statistics, and detailed findings
- Organized by severity level and viewing angle
- Timestamped for legal documentation

## How to Use

### Starting an Inspection

1. Navigate to the Inspection View page
2. Enter basic vehicle information (odometer, fuel level, tire conditions)
3. Click the **360°** button to switch to 360° mode
4. Upload or link your equirectangular 360° images for each angle

### Adding Labels

1. **Using Coordinate Picker:**
   - Click "Add Label" button
   - Click on the desired location in the 360° view
   - The coordinate finder will capture the exact position
   - Fill in the label details (text, severity, optional data)

2. **Manual Entry:**
   - Click the "Coordinate Finder" button to access the coordinate editor
   - Click "Start Picking" and select a location
   - Copy the coordinates if needed
   - Use the manual input fields to adjust (X, Y, Z)

### Label Details

Each label can contain:
- **Text Description:** What needs to be inspected or noted
- **Severity:** Pass, Warning, or Fail status
- **Optional Data:** Key-value pairs for specific measurements
  - Examples: "PSI: 32", "Depth: 4mm", "Condition: Good"

### Generating a Status Report

1. Complete all inspections and label all issues
2. Click **"Generate Status Report PDF"**
3. The system will create a comprehensive PDF including:
   - Vehicle information (License plate, customer name, odometer)
   - Summary statistics (Total issues, Pass/Warning/Fail counts)
   - Detailed findings organized by angle and severity
   - Generated date and time

## Technical Details

### Image Format Requirements

- **Format:** Equirectangular projection (2:1 aspect ratio recommended)
- **Minimum Resolution:** 4K (4096×2048) recommended for zoom clarity
- **File Types:** JPG, PNG supported
- **Source:** Insta360, Ricoh Theta, Panorama mode, or similar

### Hotspot System

Hotspots are 3D points in the scene that:
- Display as glowing spheres in the 360° view
- Can be clicked to reveal label information
- Change color based on severity status
- Are invisible until toggled on

### Coordinate System

The coordinate system uses standard Babylon.js 3D coordinates:
- **X-axis:** Horizontal (left-right)
- **Y-axis:** Vertical (up-down)
- **Z-axis:** Depth (toward-away camera)

All coordinates are stored with 3 decimal precision for accuracy.

## File Structure

```
src/
├── components/
│   ├── Inspection360View.tsx      # Main 360° inspection component
│   ├── CoordinateFinder.tsx       # Coordinate picker tool
│   ├── LabelEditor.tsx            # Label creation dialog
│   └── ...
├── lib/
│   ├── hotspotManager.ts          # Hotspot management system
│   ├── pdfGenerator.ts            # PDF report generation
│   └── ...
├── types/
│   └── index.ts                   # TypeScript type definitions
└── pages/
    └── InspectionView.tsx         # Main inspection page
```

## API Reference

### Inspection360View Component

```tsx
import Inspection360View from '@/components/Inspection360View';

<Inspection360View
  images={{
    front: 'url/to/front.jpg',
    left_side: 'url/to/left.jpg',
    right_side: 'url/to/right.jpg',
    rear: 'url/to/rear.jpg',
    top: 'url/to/top.jpg',
  }}
  initialLabels={[...]}
  onLabelClick={(label) => console.log(label)}
  showCoordinateFinder={true}
  onCoordinatePicked={(coords) => console.log(coords)}
/>
```

### generateStatusReportPDF

```tsx
import { generateStatusReportPDF } from '@/lib/pdfGenerator';

await generateStatusReportPDF(statusReport);
```

### HotspotManager

```tsx
import { HotspotManager } from '@/lib/hotspotManager';

const manager = new HotspotManager(scene);

manager.addHotspot({
  id: 'hotspot-1',
  position: { x: 1, y: 2, z: 3 },
  label: 'Engine Issue',
  onClick: () => { /* handle click */ }
}, 'front');

manager.setHotspotSeverityColor('hotspot-1', 'fail');
manager.removeHotspot('hotspot-1');
```

## Type Definitions

### InspectionLabel

```typescript
interface InspectionLabel {
  id: string;
  hotspot_id: string;
  angle: InspectionAngle;
  text: string;
  severity?: 'pass' | 'warning' | 'fail';
  data?: Record<string, any>;
}
```

### Inspection360

```typescript
interface Inspection360 {
  id: string;
  job_card_id: string;
  images: Record<InspectionAngle, string>;
  hotspots: Hotspot[];
  labels: InspectionLabel[];
  status: 'in_progress' | 'completed';
}
```

## Business Benefits

1. **Enhanced Transparency:** Customers can virtually stand with the inspector
2. **Consistency:** Every inspection follows a mapped path (Front → Side → Rear)
3. **Liability Protection:** High-resolution 360° captures provide time-stamped proof
4. **Hardware Agnostic:** Works on any modern web browser without app downloads
5. **Professional Documentation:** PDF reports provide legal protection

## Browser Compatibility

- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Images not loading
- Verify CORS settings on the server hosting images
- Check image URLs are correct
- Ensure images are in equirectangular format

### Hotspots not visible
- Toggle the "Add Label" button to enable hotspots
- Check if the label's angle matches the current view
- Verify severity color is not the same as background

### PDF generation fails
- Ensure all labels have text content
- Check browser's download permissions
- Verify jsPDF and html2canvas are installed

## Future Enhancements

- [ ] 3D model capture from 360° videos
- [ ] AR/VR preview mode
- [ ] Automatic issue detection using AI
- [ ] Multi-device synchronization
- [ ] Voice annotation support
- [ ] Damage estimation calculations

## Support

For issues, feature requests, or technical support, please contact the development team or create an issue in the project repository.

---

**Version:** 1.0.0  
**Last Updated:** March 10, 2026
