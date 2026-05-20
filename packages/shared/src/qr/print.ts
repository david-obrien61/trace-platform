import { generatePlantQR, generateQR, type QROptions } from './generate';

export interface PrintLabelOptions extends QROptions {
  labelText?: string;     // line printed below QR code
  nurseryName?: string;
  copies?: number;        // default 1
}

export interface PrintResult {
  success: boolean;
  printedAt?: Date;
  error?: string;
}

export async function printPlantLabel(
  plantId: string,
  baseUrl: string,
  options: PrintLabelOptions = {}
): Promise<PrintResult> {
  try {
    const { dataUrl, url } = await generatePlantQR(plantId, baseUrl, options);
    openPrintWindow(dataUrl, {
      labelText: options.labelText ?? plantId,
      nurseryName: options.nurseryName,
      url,
      copies: options.copies ?? 1,
    });
    return { success: true, printedAt: new Date() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Print failed',
    };
  }
}

export async function printQRLabel(
  content: string,
  labelText: string,
  options: PrintLabelOptions = {}
): Promise<PrintResult> {
  try {
    const dataUrl = await generateQR(content, options);
    openPrintWindow(dataUrl, {
      labelText,
      nurseryName: options.nurseryName,
      url: content,
      copies: options.copies ?? 1,
    });
    return { success: true, printedAt: new Date() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Print failed',
    };
  }
}

interface PrintWindowOptions {
  dataUrl: string;
  labelText: string;
  nurseryName?: string;
  url: string;
  copies: number;
}

function openPrintWindow(
  dataUrl: string,
  { labelText, nurseryName, url, copies }: PrintWindowOptions
): void {
  const win = window.open('', '_blank', 'width=400,height=500');
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to print labels');

  const labelsHtml = Array.from({ length: copies }, () => `
    <div class="label">
      <img src="${dataUrl}" alt="QR code for ${labelText}" />
      ${nurseryName ? `<div class="nursery">${nurseryName}</div>` : ''}
      <div class="plant-id">${labelText}</div>
      <div class="url">${url}</div>
    </div>
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print QR Label — ${labelText}</title>
      <style>
        body { margin: 0; font-family: system-ui, sans-serif; }
        .label { text-align: center; padding: 16px; page-break-after: always; }
        .label img { width: 200px; height: 200px; display: block; margin: 0 auto; }
        .nursery { font-size: 14px; font-weight: 600; margin-top: 8px; }
        .plant-id { font-size: 18px; font-weight: 700; margin-top: 4px; }
        .url { font-size: 9px; color: #666; margin-top: 4px; word-break: break-all; }
        @media print { .label { page-break-after: always; } }
      </style>
    </head>
    <body>${labelsHtml}<script>window.onload = () => { window.print(); window.close(); }<\/script></body>
    </html>
  `);
  win.document.close();
}
