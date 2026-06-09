/**
 * MODULE: IgnitionVIN (Web stub)
 * VIN barcode scanning is only available in the mobile app.
 * On web, the eval flow uses manual VIN entry only.
 */
import React from 'react';

const STYLE_DEBUG = true;

export default function IgnitionVIN({ onVinScanned }) {
  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionVIN converted, 1 className → inline, 0 non-1:1');
  return (
    <div style={{
      textAlign: 'center',
      paddingTop: 24,
      paddingBottom: 24,
      color: '#94a3b8',
      fontSize: 14,
      border: '1px dashed #334155',
      borderRadius: 8,
    }}>
      Camera scanning requires the mobile app.
      <br />
      Enter VIN manually in the field above.
    </div>
  );
}
