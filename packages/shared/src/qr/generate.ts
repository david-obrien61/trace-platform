import QRCode from 'qrcode';

export interface QROptions {
  width?: number;        // pixels — default 300
  margin?: number;       // quiet zone modules — default 2
  color?: {
    dark?: string;       // hex — default #000000
    light?: string;      // hex — default #FFFFFF
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';  // default 'M'
}

export interface QRResult {
  dataUrl: string;       // data:image/png;base64,...
  plantId: string;
  url: string;
}

export async function generatePlantQR(
  plantId: string,
  baseUrl: string,
  options: QROptions = {}
): Promise<QRResult> {
  const url = `${baseUrl}/plant/${plantId}`;
  const dataUrl = await QRCode.toDataURL(url, {
    width: options.width ?? 300,
    margin: options.margin ?? 2,
    color: {
      dark: options.color?.dark ?? '#000000',
      light: options.color?.light ?? '#FFFFFF',
    },
    errorCorrectionLevel: options.errorCorrectionLevel ?? 'M',
  });
  return { dataUrl, plantId, url };
}

export async function generateQR(
  content: string,
  options: QROptions = {}
): Promise<string> {
  return QRCode.toDataURL(content, {
    width: options.width ?? 300,
    margin: options.margin ?? 2,
    color: {
      dark: options.color?.dark ?? '#000000',
      light: options.color?.light ?? '#FFFFFF',
    },
    errorCorrectionLevel: options.errorCorrectionLevel ?? 'M',
  });
}
