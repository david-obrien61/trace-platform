// Image compression before OCR: reduce payload to avoid Vercel body limits + speed up Gemini.

export const COMPRESS_TYPES     = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
export const COMPRESS_THRESHOLD = 2.5 * 1024 * 1024; // 2.5MB — McCoy's 2.2MB passes through raw; files >2.5MB still compress
export const COMPRESS_MAX_DIM   = 1200;
export const COMPRESS_QUALITY   = 0.82;

export async function resizeAndCompressImage(file: File): Promise<{ base64: string; sizeBytes: number; mimeType: string }> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (!COMPRESS_TYPES.has(file.type) || file.size <= COMPRESS_THRESHOLD) {
    return { base64: raw, sizeBytes: file.size, mimeType: file.type || 'image/jpeg' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const maxDim = COMPRESS_MAX_DIM;
      let w = width, h = height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else       { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) { resolve({ base64: raw, sizeBytes: file.size, mimeType: file.type }); return; }
        const reader2 = new FileReader();
        reader2.onload = () => {
          const b64 = (reader2.result as string).split(',')[1];
          resolve({ base64: b64, sizeBytes: blob.size, mimeType: 'image/jpeg' });
        };
        reader2.onerror = () => resolve({ base64: raw, sizeBytes: file.size, mimeType: file.type });
        reader2.readAsDataURL(blob);
      }, 'image/jpeg', COMPRESS_QUALITY);
    };
    img.onerror = () => resolve({ base64: raw, sizeBytes: file.size, mimeType: file.type });
    img.src = 'data:' + file.type + ';base64,' + raw;
  });
}
