import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a base64 data URL to Firebase Storage and returns the public download URL.
 * Path format: job_photos/{jobId}/{angle}
 */
export async function uploadJobPhoto(
  jobId: string,
  angle: string,
  dataUrl: string
): Promise<string> {
  const storageRef = ref(storage, `job_photos/${jobId}/${angle}`);
  await uploadString(storageRef, dataUrl, 'data_url');
  return getDownloadURL(storageRef);
}

/**
 * Uploads all angles for a job to Firebase Storage.
 * Returns a map of angle → download URL.
 * If a Storage upload fails for an angle, falls back to storing the original
 * data URL so that photos are never silently dropped.
 */
export async function uploadJobPhotos(
  jobId: string,
  photos: Partial<Record<string, string>>
): Promise<Partial<Record<string, string>>> {
  const entries = Object.entries(photos);
  const results = await Promise.all(
    entries.map(async ([angle, dataUrl]) => {
      if (!dataUrl) return [angle, undefined] as const;
      // Already an HTTPS URL — already uploaded, keep as-is
      if (dataUrl.startsWith('https://')) return [angle, dataUrl] as const;
      try {
        const url = await uploadJobPhoto(jobId, angle, dataUrl);
        return [angle, url] as const;
      } catch (err) {
        console.error(`[Storage] Failed to upload ${angle} for job ${jobId}, falling back to data URL:`, err);
        return [angle, dataUrl] as const;
      }
    })
  );
  return Object.fromEntries(results.filter(([, v]) => v !== undefined));
}

/**
 * Uploads 360° inspection images to Firebase Storage.
 * Path format: inspections360/{inspectionId}/{angle}
 * Falls back to data URL on individual upload failure.
 */
export async function upload360Photos(
  inspectionId: string,
  images: Partial<Record<string, string>>
): Promise<Partial<Record<string, string>>> {
  const entries = Object.entries(images);
  const results = await Promise.all(
    entries.map(async ([angle, dataUrl]) => {
      if (!dataUrl) return [angle, undefined] as const;
      if (dataUrl.startsWith('https://')) return [angle, dataUrl] as const;
      try {
        const storageRef = ref(storage, `inspections360/${inspectionId}/${angle}`);
        await uploadString(storageRef, dataUrl, 'data_url');
        const url = await getDownloadURL(storageRef);
        return [angle, url] as const;
      } catch (err) {
        console.error(`[Storage] Failed to upload 360 image ${angle} for inspection ${inspectionId}:`, err);
        return [angle, dataUrl] as const;
      }
    })
  );
  return Object.fromEntries(results.filter(([, v]) => v !== undefined));
}

/**
 * Deletes all photos for a job from Firebase Storage.
 */
export async function deleteJobPhotos(jobId: string, angles: string[]): Promise<void> {
  await Promise.allSettled(
    angles.map((angle) => deleteObject(ref(storage, `job_photos/${jobId}/${angle}`)))
  );
}

/**
 * Deletes all photos for a job from Firebase Storage.
 */
export async function deleteJobPhotos(jobId: string, angles: string[]): Promise<void> {
  await Promise.allSettled(
    angles.map((angle) => deleteObject(ref(storage, `job_photos/${jobId}/${angle}`)))
  );
}
