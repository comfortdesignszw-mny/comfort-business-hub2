import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { compressImage, validateImage } from './image-utils';

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image to Data URL"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Creates an instant, highly-compressed local preview Data URL (< 150KB)
 * for immediate display in the UI and instant local DB persistence.
 */
export async function createInstantLocalImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<string> {
  const error = validateImage(file);
  if (error) throw new Error(error);

  const compressedBlob = await compressImage(file, {
    maxWidth: options.maxWidth || 800,
    maxHeight: options.maxHeight || 800,
    quality: options.quality || 0.65
  });

  return await blobToDataUrl(compressedBlob);
}

/**
 * Background worker to upload an image to Firebase Storage without blocking UI interactions.
 */
export function uploadImageInBackground(
  file: File,
  path: string,
  onUploaded?: (remoteUrl: string) => void,
  onError?: (err: any) => void
): void {
  if (!navigator.onLine) {
    return;
  }

  (async () => {
    try {
      const compressedBlob = await compressImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.65
      });
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, compressedBlob, {
        contentType: compressedBlob.type || 'image/jpeg'
      });
      const downloadURL = await getDownloadURL(storageRef);
      if (onUploaded) onUploaded(downloadURL);
    } catch (err) {
      console.warn('[Image Upload Background] Upload postponed or failed:', err);
      if (onError) onError(err);
    }
  })();
}

/**
 * Handles the complete flow of validating, compressing, and uploading an image.
 * Uses Firebase Storage with automatic fallback to high-compression Data URL if Storage is slow/unavailable.
 */
export async function uploadAndCompressImage(
  file: File, 
  path: string, 
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<string> {
  // 1. Validate format and raw size
  const error = validateImage(file);
  if (error) throw new Error(error);

  // 2. Fast client-side compression
  const compressedBlob = await compressImage(file, {
    maxWidth: options.maxWidth || 1000,
    maxHeight: options.maxHeight || 1000,
    quality: options.quality || 0.65
  });

  // 3. Attempt Firebase Storage upload with a 4-second timeout
  const tryFirebaseUpload = async (): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, compressedBlob, {
      contentType: compressedBlob.type || 'image/jpeg'
    });
    return await getDownloadURL(storageRef);
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Firebase Storage timeout"));
    }, 4000);
  });

  try {
    return await Promise.race([tryFirebaseUpload(), timeoutPromise]);
  } catch (err) {
    // Instant Fallback: Convert compressed blob to Data URL
    return await blobToDataUrl(compressedBlob);
  }
}

