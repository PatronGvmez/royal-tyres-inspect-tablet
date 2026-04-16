# 360° Inspection System - Quick Reference Card

## 🚀 Quick Start

### Enable 360° Mode in Inspection
```tsx
// In InspectionView.tsx, click the "360°" button to switch modes
setUse360(!use360);
```

## 📦 Core Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `Inspection360View` | Main 360° viewer | `images`, `labels`, `onLabelClick`, `onCoordinatePicked` |
| `CoordinateFinder` | Pick 3D coordinates | `imageUrl`, `angle`, `onCoordinateSelected` |
| `LabelEditor` | Create/edit labels | `open`, `angle`, `coordinates`, `onSave` |

## 🔧 Utilities

### PDF Generation
```tsx
import { generateStatusReportPDF, generateSummaryStats } from '@/lib/pdfGenerator';

// Generate PDF report
const report = {
  id: 'RPT-123',
  inspection_id: 'INS360-123',
  job_card_id: 'JC-123',
  vehicle_info: { license_plate, customer_name, odometer },
  labels: inspectionLabels,
  summary: generateSummaryStats(inspectionLabels),
  generated_at: new Date().toISOString(),
};

await generateStatusReportPDF(report);
```

### Hotspot Management
```tsx
import { HotspotManager } from '@/lib/hotspotManager';

const manager = new HotspotManager(scene);

// Add hotspot
manager.addHotspot({
  id: 'hotspot-1',
  position: { x: 1, y: 2, z: 3 },
  label: 'Issue name',
  onClick: () => { }
}, 'front');

// Change severity color
manager.setHotspotSeverityColor('hotspot-1', 'fail');

// Remove hotspot
manager.removeHotspot('hotspot-1');
```

## 📝 Type Definitions

### InspectionAngle
```typescript
type InspectionAngle = 'front' | 'left_side' | 'right_side' | 'rear' | 'top';
```

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

## 🎨 Color Coding

| Color | Meaning | Hex Value |
|-------|---------|-----------|
| 🟢 Green | Pass | `#22c55e` |
| 🟡 Yellow | Warning | `#eab308` |
| 🔴 Red | Fail | `#ef4444` |
| 🟠 Orange | Info/Default | `#f97316` |

## 📸 Image Requirements

- **Codec:** Equirectangular projection
- **Aspect Ratio:** 2:1 (recommended)
- **Resolution:** 4K minimum (4096×2048)
- **File Types:** JPG, PNG
- **CORS:** Enabled on server

## 🔄 Workflow Steps

1. **Enable 360° Mode**
   - Click "360°" button in Damage Inspection section
   
2. **Add Labels**
   - Use "Add Label" or "Coordinate Finder"
   - Pick location in 360° view
   - Fill in label details
   - Select severity level
   - Add optional metadata

3. **Switch Views**
   - Click angle buttons (Front, Left, Right, Rear, Top)
   - Labels update automatically for current view

4. **Generate Report**
   - Click "Generate Status Report PDF"
   - PDF downloads automatically
   - Includes all labels and summary

## 🎯 Coordinate System

```
     Y (Up)
     |
     |
Z(Back) ----- O ----- Z(Front)
     |
     |  X (Right)
```

All coordinates stored with 3 decimal precision (e.g., `1.234`)

## 💾 Label Data Examples

### Tire Inspection
```json
{
  "text": "Front left tire - worn tread",
  "severity": "warning",
  "data": {
    "tread_depth": "2mm",
    "PSI": "32",
    "condition": "Replace within month"
  }
}
```

### Engine Issue
```json
{
  "text": "Engine oil level low",
  "severity": "fail",
  "data": {
    "current_level": "MIN",
    "recommended": "MAX",
    "action": "Top up immediately"
  }
}
```

### Cosmetic Damage
```json
{
  "text": "Light scratch on door",
  "severity": "pass",
  "data": {
    "size": "10cm",
    "depth": "Surface only",
    "repair_needed": "No"
  }
}
```

## 🔍 Coordinate Finder: Step by Step

1. Click "Coordinate Finder" button
2. In the 360° modal, click "Start Picking"
3. Click the exact location in the image
4. Coordinates appear: X, Y, Z values
5. Copy or manually adjust if needed
6. Click "Use These Coordinates"
7. Opens label editor with coordinates filled

## 📊 Summary Statistics

After inspection, generate report with:
- **Total Issues:** All labels count
- **Pass:** Green severity labels
- **Warning:** Yellow severity labels
- **Fail:** Red severity labels

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Images not loading | Check CORS headers, verify URLs |
| Hotspots invisible | Toggle "Add Label", check severity color |
| PDF not generating | Check browser permissions, verify data |
| Coordinates wrong | Use CoordinateFinder for precision |
| Slow performance | Reduce image resolution, minimize glow |

## 📱 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✅ Full Support |
| Firefox | Latest | ✅ Full Support |
| Safari | Latest | ✅ Full Support |
| Edge | Latest | ✅ Full Support |
| Mobile Chrome | Latest | ✅ Full Support |

## 📚 Documentation Links

- 📖 **Full Guide:** [INSPECT_360_GUIDE.md](INSPECT_360_GUIDE.md)
- 📋 **Implementation Details:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- 💻 **Code Examples:** [src/components/Example360Inspection.tsx](src/components/Example360Inspection.tsx)

## 🔌 API Endpoints Reference

### State Management
```typescript
// In InspectionView.tsx
use360                          // Toggle 360° mode
inspection360                   // Current inspection data
showLabelEditor                 // Label editor visibility
selectedCoordinates             // Picked coordinates
selectedAngle                   // Current viewing angle
```

### Handlers
```typescript
handleAddLabel(angle)           // Start new label
handleSaveLabel(label)          // Save label to inspection
handleRemoveLabel(labelId)      // Delete label
handleCoordinateSelected(coords)// Process picked coordinates
handleGenerateStatusReport()    // Create PDF
```

## ⚡ Performance Tips

- Use WebP images for faster loading
- Limit glow layers to 5-10 hotspots
- Batch hotspot creation
- Cache PDF templates
- Minimize re-renders with useCallback

## 🎓 Learning Path

1. Read [INSPECT_360_GUIDE.md](INSPECT_360_GUIDE.md) - Understanding
2. Study [Example360Inspection.tsx](src/components/Example360Inspection.tsx) - Practice
3. Review [hotspotManager.ts](src/lib/hotspotManager.ts) - Deep Dive
4. Implement feature - Application

## 📞 Support Checklist

- [ ] Images optimized and CORS enabled
- [ ] All 5 angles have image URLs
- [ ] Labels have meaningful descriptions
- [ ] Severity levels assigned correctly
- [ ] Metadata validated and relevant
- [ ] PDF generation tested
- [ ] Mobile testing completed
- [ ] Performance benchmarked

---

**Version:** 1.0.0 | **Last Updated:** March 10, 2026
