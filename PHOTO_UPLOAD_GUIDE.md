# Photo Upload & Capture System

## Overview

The Royal Tyres Inspection system now includes a complete **Photo Upload & Capture System** for 360° inspections. This allows mechanics to capture or upload equirectangular images directly from their devices instead of using placeholder images.

## Features

### 1. **File Upload**
- Upload pre-captured 360° images from your device
- Supports JPG, PNG formats
- Maximum file size: 10MB per image
- Automatic validation and error handling

### 2. **Camera Capture**
- Use your device's camera to capture photos in real-time
- Works on both desktop and mobile browsers
- Automatic capture at optimal resolution
- Seamless integration with the inspection workflow

### 3. **Multi-Angle Support**
- Upload or capture all 5 angles: Front, Left, Right, Rear, Top
- Progress tracking (e.g., "3 of 5 photos ready")
- Individual image management (preview, remove, recapture)
- Sequential workflow

### 4. **Quality Assurance**
- Image format validation
- File size checks
- Resolution recommendations displayed
- Success notifications for each upload

## How to Use

### Step 1: Enable 360° Mode

In the Inspection View page:
1. Scroll to "Damage Inspection" section
2. Click the **360°** button to enable 360° inspection mode

### Step 2: Upload Photos

The Photo Upload interface will appear with 5 tiles (one for each angle):

#### Using File Upload:
1. Click the **Upload** button on any angle tile
2. Select an equirectangular image from your device
3. Image will be previewed and stored
4. Repeat for other angles

#### Using Camera Capture:
1. Click the **Capture** button on any angle tile
2. Browser will request camera permission (click "Allow")
3. A camera preview will appear
4. Frame your scene and click **Capture** button
5. Image is automatically saved to that angle
6. Back camera is used on mobile devices

### Step 3: View Progress

- Progress bar shows completion status
- "3 of 5 photos ready" indicator updates as you add images
- ✓ badge shows on completed angles
- "Pending" badge shows on remaining angles

### Step 4: Start Inspection

Once all 5 angles have images:
1. Click **"Start Inspection"** button
2. Photo360Uploader will close
3. Interactive 360° viewer will load
4. You can now add labels and hotspots to your photos

### Step 5: Manage Images

While viewing:
- **Re-upload:** Click on the image preview and hover to see remove button
- **Remove:** Click the X button that appears on hover
- **Recapture:** Use the Capture button again to replace an image

## Image Specifications

### Recommended Format
- **Format:** Equirectangular projection (2:1 aspect ratio)
- **Resolution:** 4K minimum (4096×2048)
- **File Types:** JPG (recommended), PNG
- **Compression:** JPEG quality 90-95 for best results
- **File Size:** 2-5MB per image

### Good vs. Bad Examples

✅ **GOOD - Equirectangular Image**
- 4096 × 2048 pixels (2:1 aspect ratio)
- Clear, well-lit scene
- Vehicle fully visible from 360° perspective
- Minimal distortion at poles

❌ **BAD - Regular Photo**
- Standard camera output (1920×1080)
- Not equirectangular format
- Only shows one angle
- Will not project correctly

### How to Capture Equirectangular Images

#### Option 1: Using a 360° Camera
- **Insta360 ONE** - Professional 360° camera
- **Ricoh Theta** - Consumer-friendly option
- **GIROPTIC iO** - Mobile-focused

#### Option 2: Using Phone Panorama Mode (iOS/Android)
While not true equirectangular, panorama mode can work:
1. Open Camera app → Panorama mode
2. Rotate phone to capture 360° sweep
3. Face same direction for consistent capture
4. Generate 2:1 ratio panoramic image

#### Option 3: Using 360° Camera Apps
- **Google Street View** app (Android/iOS)
- **Kamba 360°** (Android)
- **360° Panorama** (iOS)

## Technical Details

### Browser Permissions Required

When using **Camera Capture**, your browser needs:
- **Video Stream Access** - To access your camera
- **Canvas API** - To capture the photo

Browsers will display a permission prompt. Click **"Allow"** to proceed.

### Supported Browsers

| Browser | Desktop | Mobile | Camera Capture |
|---------|---------|--------|-----------------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ⚠️ Limited |
| Edge | ✅ | ✅ | ✅ |
| Samsung Internet | — | ✅ | ✅ |

**Note:** Safari on iOS has limitations with camera access for security reasons.

### Image Encoding

When uploading, images are automatically:
1. Validated for format and size
2. Converted to base64 data URLs
3. Stored in the inspection state
4. Used by Babylon.js PhotoDome for rendering

### File Size Management

- Upload size limit: 10MB
- Recommended: 2-5MB (balances quality vs. performance)
- Base64 encoding increases size by ~33%
- Local storage only (files not uploaded to server in this version)

## Workflow

```
Start Inspection
        ↓
Click 360° Mode
        ↓
Photo Upload Interface Appears
        ↓
Upload/Capture 5 Angles (Front, Left, Right, Rear, Top)
        ↓
All Images Ready?
    ├─ NO → Continue uploading
    └─ YES ↓
        ↓
    Click "Start Inspection"
        ↓
    Interactive 360° Viewer Activates
        ↓
    Add Labels & Hotspots
        ↓
    Generate Status Report PDF
        ↓
    Submit Inspection
```

## Error Handling

### Common Error Messages

**"File size must be less than 10MB"**
- Solution: Reduce image resolution or use higher compression

**"Please select a valid image file"**
- Solution: Make sure file is JPG, PNG, or other standard image format
- Check: File extension is correct (.jpg, .jpeg, .png)

**"Could not access camera. Please check permissions."**
- Solution: Grant camera permission when browser asks
- Troubleshooting:
  - Close other apps using camera
  - Check browser settings for camera permissions
  - Restart browser if issues persist
  - Try USB camera if using desktop

**"Photo captured for [angle] view"** (Success)
- Image was successfully saved
- Ready for next angle or to continue inspection

## Advanced Tips

### For Best Photo Quality

1. **Lighting**
   - Bright daylight or well-lit area (500+ lux)
   - Avoid harsh shadows
   - Face away from direct sun

2. **Positioning**
   - Stand on flat, level surface
   - Keep camera height consistent across angles
   - Maintain same distance from vehicle (5-10 meters)

3. **Technique**
   - Rotate slowly and steadily
   - Keep horizon level (use phone's level app)
   - Complete full 360° rotation
   - Allow overlap at start/end for stitching

### Mobile Optimization

On mobile devices:
- **Portrait Mode:** Better for selfies/close inspection
- **Landscape Mode:** Better for full vehicle capture
- **Back Camera:** Use for vehicle inspection (front for damage details)
- **Grid Lines:** Enable on-screen grid for consistent framing

### Desktop Webcam Issues

If desktop camera not detected:
1. Check USB camera is connected
2. Verify camera drivers are installed
3. Check browser has camera permission in settings
4. Try different browser
5. Restart computer if needed

## Integration with Inspection System

Once photos are uploaded:
1. **Coordinate Finder** uses front image for precise hotspot placement
2. **Multi-angle Navigation** switches between uploaded images
3. **Labels** are organized by angle and severity
4. **Status Report** includes metadata from all angles
5. **PDF Export** contains complete inspection record

## Data Storage

### Current Release
- Images stored in React state (in-memory)
- Data persists during inspection session
- Cleared when page refreshes
- Not backed up to server

### Future Enhancement
- Server-side image storage
- Image versioning
- Multi-device sync
- Cloud backup integration

## Performance Considerations

### Large Image Optimization

For 4K images on slower systems:
1. **Babylon.js** automatically downsample if needed
2. Performance monitoring in browser console
3. Frame rate indication in 3D view
4. Automatic quality adjustment

### Memory Usage

- Single 4K image: ~12-15MB in memory (base64)
- 5 images total: ~60-75MB
- Browser may warn on limited devices
- Consider closing other tabs

### Network (Future)

When server push is implemented:
- Estimated upload time: 2-5 seconds per 4K image (on 4G)
- Batch upload support
- Automatic retry on failure
- Resume capability

## Troubleshooting

### Photos Not Appearing

1. Check upload success message
2. Verify file format (JPG/PNG)
3. Try re-uploading
4. Check browser console for errors (F12)

### Camera Won't Turn On

1. Close other camera apps
2. Check browser permissions (Settings)
3. Try different browser
4. Restart device
5. Check USB connection (desktop)

### Images Look Distorted

1. Ensure equirectangular format (2:1 aspect ratio)
2. Check for compression artifacts
3. Try lossless format (PNG)
4. Re-capture if possible

### Upload Very Slow

1. Check internet connection
2. Reduce image file size
3. Close other downloads
4. Try uploading smaller test image first

## FAQ

**Q: Can I edit images after uploading?**  
A: Currently, you can remove and re-upload. Image editing in-app is a future feature.

**Q: Do I need 360° camera or can I use panorama mode?**  
A: Either works. True 360° cameras produce better results, but panorama mode is acceptable.

**Q: Are my images uploaded to servers?**  
A: No, images stay local in your browser during inspection. Future versions will allow optional cloud backup.

**Q: Can I use the same photos for multiple inspections?**  
A: Yes, you can re-upload the same images for different job cards.

**Q: What's the maximum image resolution supported?**  
A: Babylon.js supports up to 8K. Recommended is 4K for best performance/quality balance.

**Q: Can I mix different image types (photo + panorama)?**  
A: Yes, you can use a mix of formats as long as all are near 2:1 aspect ratio.

## Support & Documentation

- **Full Guide:** [INSPECT_360_GUIDE.md](INSPECT_360_GUIDE.md)
- **Quick Reference:** [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Implementation Details:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Code Examples:** [Example360Inspection.tsx](src/components/Example360Inspection.tsx)

---

**Version:** 1.0.0  
**Last Updated:** March 10, 2026  
**Status:** Production Ready
