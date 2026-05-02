/**
 * Image Utilities for ultra-fast client-side processing
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: string;
}

/**
 * Compresses an image file client-side using high-speed Canvas API
 */
export async function compressImage(file: File, options: CompressionOptions = {}): Promise<Blob> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.5,
    type = 'image/jpeg'
  } = options;

  try {
    // 1. Create ImageBitmap (async and off-thread)
    const img = await createImageBitmap(file);
    
    // 2. Calculate dimensions keeping aspect ratio
    let width = img.width;
    let height = img.height;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);

    // 3. Use OffscreenCanvas if available
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    }
    
    if (!ctx) throw new Error('Failed to get context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(img, 0, 0, width, height);

    // 4. Release bitmap memory
    img.close();

    // 5. Fast conversion to Blob
    if (canvas instanceof OffscreenCanvas) {
      return await canvas.convertToBlob({ type, quality });
    } else {
      return new Promise((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Conversion failed')),
          type,
          quality
        );
      });
    }
  } catch (err) {
    console.error('Fast-compress error:', err);
    throw err;
  }
}

/**
 * Validates if a file is an image and below a reasonable size
 */
export function validateImage(file: File): string | null {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return 'Invalid format. Use JPG, PNG, or WebP.';
  }

  const maxSize = 20 * 1024 * 1024; // 20MB raw limit
  if (file.size > maxSize) {
    return 'Image too large (max 20MB).';
  }

  return null;
}
