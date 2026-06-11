// Receipt image normalization before OCR.
// Uses browser-image-compression — no hand-tuned byte thresholds.
// Every receipt image is normalized to ≤1800px / ~500KB / JPEG before upload.
// This keeps Gemini well within its processing time budget regardless of camera resolution.

import imageCompression from 'browser-image-compression';

const COMPRESS_OPTIONS = {
  maxWidthOrHeight: 1800,
  maxSizeMB:        0.5,    // ~500KB target output
  useWebWorker:     true,
  fileType:         'image/jpeg' as const,
  initialQuality:   0.82,
};

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function resizeAndCompressImage(
  file: File
): Promise<{ base64: string; sizeBytes: number; mimeType: string }> {
  // PDF cannot be rendered to canvas in-browser — pass through raw
  if (file.type === 'application/pdf') {
    const raw = await fileToBase64(file);
    return { base64: raw, sizeBytes: file.size, mimeType: file.type };
  }

  try {
    const compressed = await imageCompression(file, COMPRESS_OPTIONS);
    const base64 = await fileToBase64(compressed);
    return { base64, sizeBytes: compressed.size, mimeType: 'image/jpeg' };
  } catch {
    // Fail-safe: compression failed — send the original rather than blocking OCR
    const raw = await fileToBase64(file);
    return { base64: raw, sizeBytes: file.size, mimeType: file.type || 'image/jpeg' };
  }
}
