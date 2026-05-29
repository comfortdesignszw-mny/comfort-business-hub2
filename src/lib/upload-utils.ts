import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { compressImage, validateImage } from './image-utils';

/**
 * Handles the complete flow of validating, compressing, and uploading an image
 */
export async function uploadAndCompressImage(
  file: File, 
  path: string, 
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<string> {
  const uploadPromise = async () => {
    // 1. Validate
    const error = validateImage(file);
    if (error) throw new Error(error);

    // 2. Compress
    const compressedBlob = await compressImage(file, {
      maxWidth: options.maxWidth || 800,
      maxHeight: options.maxHeight || 800,
      quality: options.quality || 0.7
    });

    // 3. Upload
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, compressedBlob, {
      contentType: 'image/jpeg'
    });

    // 4. Get URL
    return await getDownloadURL(storageRef);
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("Upload timed out after 30 seconds. Please check your connection and try again."));
    }, 30000);
  });

  return Promise.race([uploadPromise(), timeoutPromise]);
}
