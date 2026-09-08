import { MealSlot } from '../types';

/**
 * Maximum retention period for camera photos attached to custom meal plan entries.
 * Per specification: This image should not be stored longer than 30 days.
 */
export const IMAGE_RETENTION_DAYS = 30;

/**
 * Calculates capture and expiration timestamps based on the 30-day retention rule.
 */
export function calculateImageExpiration(capturedAtDate: Date | string = new Date()): {
  imageCapturedAt: string;
  imageExpiresAt: string;
} {
  const captured = typeof capturedAtDate === 'string' ? new Date(capturedAtDate) : capturedAtDate;
  const expires = new Date(captured.getTime() + IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  return {
    imageCapturedAt: captured.toISOString(),
    imageExpiresAt: expires.toISOString(),
  };
}

/**
 * Checks whether a custom meal image has exceeded the 30-day retention lifespan.
 */
export function isCustomMealImageExpired(
  slot: { imageExpiresAt?: string; imageCapturedAt?: string; imageUrl?: string } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!slot?.imageUrl) {
    return false;
  }

  // If explicit expiration timestamp exists
  if (slot.imageExpiresAt) {
    const expTime = new Date(slot.imageExpiresAt).getTime();
    if (!isNaN(expTime)) {
      return now.getTime() >= expTime;
    }
  }

  // If only captured timestamp exists, compute 30 days
  if (slot.imageCapturedAt) {
    const capTime = new Date(slot.imageCapturedAt).getTime();
    if (!isNaN(capTime)) {
      const expirationTime = capTime + IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      return now.getTime() >= expirationTime;
    }
  }

  // If an image has no retention metadata, assume it is expired to prevent indefinitely stored stale photos
  return true;
}

/**
 * Calculates the remaining retention days (0-30) for a custom meal image.
 */
export function getDaysRemaining(
  slot: { imageExpiresAt?: string; imageCapturedAt?: string } | null | undefined,
  now: Date = new Date()
): number {
  if (!slot) return 0;

  let targetTime: number | null = null;
  if (slot.imageExpiresAt) {
    targetTime = new Date(slot.imageExpiresAt).getTime();
  } else if (slot.imageCapturedAt) {
    targetTime = new Date(slot.imageCapturedAt).getTime() + IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  }

  if (!targetTime || isNaN(targetTime)) return 0;

  const diffMs = targetTime - now.getTime();
  if (diffMs <= 0) return 0;

  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Purges expired images from meal plan slots to enforce the 30-day storage ceiling.
 * Returns the cleaned days map and the count of purged images.
 */
export function cleanupExpiredMealSlotImages(
  days: { [dateStr: string]: MealSlot[] } | undefined,
  now: Date = new Date()
): {
  cleanedDays: { [dateStr: string]: MealSlot[] };
  expiredCount: number;
} {
  if (!days) {
    return { cleanedDays: {}, expiredCount: 0 };
  }

  let expiredCount = 0;
  const cleanedDays: { [dateStr: string]: MealSlot[] } = {};

  for (const [dateStr, slots] of Object.entries(days)) {
    if (!Array.isArray(slots)) continue;

    cleanedDays[dateStr] = slots.map((slot) => {
      if (slot.imageUrl && isCustomMealImageExpired(slot, now)) {
        expiredCount++;
        // Remove image properties so they are not persisted or stored
        const { imageUrl, imageCapturedAt, imageExpiresAt, ...rest } = slot;
        return rest as MealSlot;
      }
      return slot;
    });
  }

  return { cleanedDays, expiredCount };
}

/**
 * Compresses an image client-side to ensure it is lightweight, quick to transmit,
 * and within Firestore document size limits (< 100KB typical).
 */
export async function compressAndResizeImage(
  fileOrDataUrl: File | string,
  maxDimension = 960,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Helper to process data URL
    const processDataUrl = (dataUrl: string) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return resolve(dataUrl);
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(dataUrl);
        }

        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };

    if (typeof fileOrDataUrl === 'string') {
      processDataUrl(fileOrDataUrl);
    } else if (fileOrDataUrl instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          processDataUrl(result);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(fileOrDataUrl);
    } else {
      resolve('');
    }
  });
}
