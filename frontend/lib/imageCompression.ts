/**
 * Client-side image compression for OCR upload payloads.
 *
 * Large phone photos (8-15MB) previously took ~40s just to transmit to the
 * backend before Vision OCR even started. This module downscales and
 * re-encodes images in the browser via HTML5 Canvas BEFORE upload:
 *
 *   - Max dimension: 1200px (longest side, aspect ratio preserved)
 *   - Format: JPEG at quality 0.75
 *   - Target size: under 500KB (iteratively lowers quality/scale to get there)
 *
 * Non-image files (PDFs, .txt) pass through untouched. Any compression
 * failure silently falls back to the original file — compression must never
 * block an upload.
 */

export const IMAGE_MAX_DIMENSION = 1200;
export const IMAGE_UPLOAD_QUALITY = 0.75;
export const IMAGE_TARGET_MAX_BYTES = 500 * 1024; // 500KB

const MIN_QUALITY = 0.3;
const MIN_SCALE = 0.25;
const MAX_ITERATIONS = 8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image in the browser'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Compresses an image File for upload. Returns the original file untouched
 * for non-image inputs, or when compression cannot beat the original size.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const img = await loadImage(file);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return file;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Never upscale; cap the longest side at IMAGE_MAX_DIMENSION.
    let scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(srcW, srcH));
    let quality = IMAGE_UPLOAD_QUALITY;
    let best: Blob | null = null;

    // Lower JPEG quality first, then shrink dimensions, until the blob fits
    // under the target size or both floors are reached.
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      canvas.width = w;
      canvas.height = h;

      // Flatten transparency onto white so JPEG encoding keeps text legible.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await canvasToBlob(canvas, quality);
      if (!blob) break;
      best = blob;

      if (blob.size <= IMAGE_TARGET_MAX_BYTES) break;
      if (quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.15);
      } else if (scale > MIN_SCALE) {
        scale = Math.max(MIN_SCALE, scale * 0.75);
      } else {
        break; // Floors reached — use the smallest blob we produced.
      }
    }

    if (!best || best.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload';
    return new File([best], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    // Compression must never block the upload — fall back to the original.
    return file;
  }
}
