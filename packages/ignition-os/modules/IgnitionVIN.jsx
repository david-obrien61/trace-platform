/**
 * MODULE: IgnitionVIN (Web stub)
 * VIN barcode scanning is only available in the mobile app.
 * On web, the eval flow uses manual VIN entry only.
 */
import React from 'react';

export default function IgnitionVIN({ onVinScanned }) {
  return (
    <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-700 rounded-lg">
      Camera scanning requires the mobile app.
      <br />
      Enter VIN manually in the field above.
    </div>
  );
}
