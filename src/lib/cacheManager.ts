/**
 * Cache Management & Storage Optimization
 * 
 * Addresses storage overload issues from:
 * - Base64 encoded images and signatures
 * - React Query in-memory cache
 * - Firebase SDK caching
 * - Browser IndexedDB/LocalStorage bloat
 */

export const CacheManager = {
  /**
   * Clear all local storage
   */
  clearLocalStorage() {
    try {
      localStorage.clear();
      console.log('✓ LocalStorage cleared');
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },

  /**
   * Clear session storage
   */
  clearSessionStorage() {
    try {
      sessionStorage.clear();
      console.log('✓ SessionStorage cleared');
    } catch (error) {
      console.error('Failed to clear sessionStorage:', error);
    }
  },

  /**
   * Clear all browser caches
   */
  async clearAllCaches() {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log(`✓ Cleared ${cacheNames.length} service worker caches`);
      }
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  },

  /**
   * Clear IndexedDB
   */
  async clearIndexedDB() {
    try {
      const dbs = await window.indexedDB.databases?.() || [];
      for (const db of dbs) {
        window.indexedDB.deleteDatabase(db.name);
      }
      console.log(`✓ Cleared ${dbs.length} IndexedDB databases`);
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error);
    }
  },

  /**
   * Clear Firebase caching
   * Call this after importing Firebase auth/firestore
   */
  async clearFirebaseCache() {
    try {
      // Firebase automatically caches auth state in localStorage under specific keys
      const firebaseKeys = Object.keys(localStorage).filter(key =>
        key.includes('firebase') || key.includes('auth')
      );
      firebaseKeys.forEach(key => localStorage.removeItem(key));
      console.log(`✓ Cleared ${firebaseKeys.length} Firebase cache entries`);
    } catch (error) {
      console.error('Failed to clear Firebase cache:', error);
    }
  },

  /**
   * Get current storage usage estimate
   */
  async getStorageUsage() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentUsed = ((usage / quota) * 100).toFixed(2);
        
        return {
          usage: `${(usage / 1024 / 1024).toFixed(2)} MB`,
          quota: `${(quota / 1024 / 1024).toFixed(2)} MB`,
          percentUsed: `${percentUsed}%`,
          raw: { usage, quota },
        };
      }
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
    }
    return null;
  },

  /**
   * Full cleanup: clear everything
   */
  async fullCleanup() {
    console.warn('🧹 Performing full cache cleanup...');
    this.clearLocalStorage();
    this.clearSessionStorage();
    await this.clearAllCaches();
    await this.clearIndexedDB();
    this.clearFirebaseCache();
    console.log('✓ Full cleanup complete - page will reload in 2 seconds');
    setTimeout(() => window.location.reload(), 2000);
  },

  /**
   * Monitor storage in real-time
   */
  startStorageMonitoring(intervalMs = 30000) {
    setInterval(async () => {
      const usage = await this.getStorageUsage();
      if (usage) {
        console.log(`📊 Storage: ${usage.usage} / ${usage.quota} (${usage.percentUsed}%)`);
        
        // Warn if over 80%
        if (parseFloat(usage.percentUsed) > 80) {
          console.warn('⚠️ Storage usage is high - consider clearing cache');
        }
      }
    }, intervalMs);
  },
};

/**
 * Optimize Image Storage
 * Converts large base64 images to blobs for efficient storage
 */
export const ImageOptimizer = {
  /**
   * Convert base64 to Blob
   */
  base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
    const binaryString = atob(base64.split(',')[1] || base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  },

  /**
   * Compress image before storage
   */
  async compressImage(base64: string, quality = 0.7): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
    });
  },

  /**
   * Get size of base64 string in KB
   */
  getBase64Size(base64: string): number {
    const sizeInBytes = base64.length * 0.75; // base64 is ~33% larger
    return Math.round(sizeInBytes / 1024); // Convert to KB
  },
};

/**
 * Cleanup utility for signature data
 */
export const SignatureOptimizer = {
  /**
   * Maximum recommended signature size in bytes
   */
  MAX_SIGNATURE_SIZE: 200 * 1024, // 200KB

  /**
   * Trim signature if too large
   */
  trimSignature(dataUrl: string): string {
    if (dataUrl.length > this.MAX_SIGNATURE_SIZE) {
      console.warn(
        `Signature too large (${(dataUrl.length / 1024).toFixed(2)}KB), trimming...`
      );
      return dataUrl.substring(0, this.MAX_SIGNATURE_SIZE);
    }
    return dataUrl;
  },

  /**
   * Compress signature canvas output
   */
  async compressSignature(dataUrl: string, quality = 0.8): Promise<string> {
    if (dataUrl.startsWith('data:image/png')) {
      // Convert PNG to JPEG for smaller size
      return ImageOptimizer.compressImage(dataUrl, quality);
    }
    return dataUrl;
  },
};

export default CacheManager;
