# Storage & Cache Optimization Guide

## Problem: Storage Overload Issues

The app was experiencing storage overload caused by:

1. **Large Base64 Signatures** - Signature canvas exports as PNG (~200KB+ per signature)
2. **360° Panorama Images** - Multiple high-res equirectangular images stored locally
3. **React Query In-Memory Cache** - Caches all API responses indefinitely
4. **Firebase SDK Caching** - Auth state and user data cached in localStorage
5. **Browser IndexedDB Bloat** - Service worker caches and app data accumulating

## Solutions Implemented

### 1. Signature Optimization

**File**: `src/lib/cacheManager.ts` → `SignatureOptimizer`

- **Automatically trims** signatures over 200KB before storage
- **No manual action needed** - happens during inspection submission
- Signature canvas PNG converted to JPEG for ~50% size reduction

```typescript
// Automatic in InspectionView.tsx
let signatureData = sigCanvas.current?.toDataURL();
signatureData = SignatureOptimizer.trimSignature(signatureData); // Optimized!
```

### 2. Cache Management

**File**: `src/lib/cacheManager.ts` → `CacheManager`

Use when app storage gets too high:

```typescript
// Clear localStorage
CacheManager.clearLocalStorage();

// Clear all caches
await CacheManager.clearAllCaches();

// Clear Firebase cache
CacheManager.clearFirebaseCache();

// Full cleanup (clears everything)
await CacheManager.fullCleanup();
```

### 3. Storage Monitoring

Monitor storage usage in real-time:

```typescript
import { CacheManager } from '@/lib/cacheManager';

// Get current usage
const usage = await CacheManager.getStorageUsage();
console.log(usage); // { usage: "45.32 MB", quota: "50 MB", percentUsed: "90.64%" }

// Start continuous monitoring (logs every 30 seconds)
CacheManager.startStorageMonitoring(30000);
```

### 4. Image Compression

For 360° panorama images:

```typescript
import { ImageOptimizer } from '@/lib/cacheManager';

// Compress before storing
const compressed = await ImageOptimizer.compressImage(base64, 0.7);

// Get size
const sizeKB = ImageOptimizer.getBase64Size(base64);
```

## Firestore Storage Limits

**Document Size**: Max 1MB per document
**Field Size**: Strings limited by document size
**Recommendations**:
- Keep signatures < 200KB (handled automatically)
- Store large images in Cloud Storage, not Firestore
- Keep inspection reports lean (only essential data)

## Browser Storage Limits

| Browser | LocalStorage | IndexedDB | Cache API |
|---------|-------------|----------|-----------|
| Chrome | 10MB | 50MB+ | 50MB+ |
| Firefox | 10MB | 50MB+ | 50MB+ |
| Safari | 5MB | 50MB+ | 50MB+ |
| Edge | 10MB | 50MB+ | 50MB+ |

**Note**: Limits vary by browser and user grants. Quota is shared across all apps from same origin.

## Best Practices

### ✅ DO:
- Clear old inspection reports regularly
- Compress images before storing
- Monitor storage usage in production
- Use Cloud Storage for large files
- Set cache TTL (time-to-live) limits

### ❌ DON'T:
- Store full-resolution photos as base64 in Firestore
- Keep unlimited React Query cache
- Store duplicate data in multiple places
- Ignore IndexedDB accumulation

## Debugging Storage Issues

### Check Storage Usage
```javascript
await CacheManager.getStorageUsage();
```

### View LocalStorage
```javascript
console.table(Object.entries(localStorage));
```

### View Firebase Cache Keys
```javascript
Object.keys(localStorage)
  .filter(k => k.includes('firebase'))
  .forEach(k => console.log(k, localStorage[k]?.length));
```

### Clear Everything
```javascript
await CacheManager.fullCleanup(); // Auto-refreshes page
```

## Production Recommendations

1. **Implement Periodic Cleanup**
   ```typescript
   // Clear old reports older than 30 days
   const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
   await JobCardModel.delete(cardId); // Remove old job cards
   ```

2. **Add Storage Quota Alerts**
   ```typescript
   CacheManager.startStorageMonitoring();
   // Monitor console for ⚠️ warnings when >80%
   ```

3. **Implement Cloud Storage for Images**
   - Use Firebase Cloud Storage for large images
   - Keep only image URLs in Firestore (not base64)

4. **Auto-Cleanup Service Worker Cache**
   ```typescript
   // In service worker or background sync
   caches.keys().then(names => {
     names.forEach(name => {
       if (name !== 'current-cache-v1') {
         caches.delete(name); // Keep only latest
       }
     });
   });
   ```

## API Reference

### CacheManager
- `clearLocalStorage()` - Clear all localStorage
- `clearSessionStorage()` - Clear session storage
- `clearAllCaches()` - Clear service worker caches
- `clearIndexedDB()` - Delete all IndexedDB databases
- `clearFirebaseCache()` - Remove Firebase-related keys
- `fullCleanup()` - Nuclear option: clear everything
- `getStorageUsage()` - Get storage estimate
- `startStorageMonitoring(intervalMs)` - Continuous monitoring

### ImageOptimizer
- `base64ToBlob(base64, mimeType)` - Convert base64 to Blob
- `compressImage(base64, quality)` - Compress to JPEG
- `getBase64Size(base64)` - Get size in KB

### SignatureOptimizer
- `trimSignature(dataUrl)` - Trim to 200KB limit
- `compressSignature(dataUrl, quality)` - Compress to JPEG

## Related Files
- [cacheManager.ts](../src/lib/cacheManager.ts) - Implementation
- [InspectionView.tsx](../src/pages/InspectionView.tsx) - Usage example
- [firestore.ts](../src/lib/firestore.ts) - Database operations

