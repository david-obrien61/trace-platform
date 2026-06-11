import React from 'react';
import { fmt, ReconcileResult } from '../utils/receiptReconciliation';

interface ConflictDialogProps {
  reconcileState: ReconcileResult;
  onClose: () => void;
  onSaveAnyway: () => void;
  btnPrimaryStyle: React.CSSProperties;
  btnGhostStyle: React.CSSProperties;
}

const DIALOG_BACKDROP: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
};

const DIALOG_CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: '16px 16px 0 0',
  padding: '24px 20px 36px',
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
};

export function ConflictDialog({ reconcileState, onClose, onSaveAnyway, btnPrimaryStyle, btnGhostStyle }: ConflictDialogProps) {
  return (
    <div style={DIALOG_BACKDROP} onClick={onClose}>
      <div style={DIALOG_CARD} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#A32D2D', marginBottom: 10 }}>
          ⚠️ Line items don't match total
        </div>
        <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <strong>Lines sum to:</strong>
          <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fmt.format(reconcileState.lineSum)}</span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <strong>Total field:</strong>
          <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fmt.format(reconcileState.total)}</span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#A32D2D', lineHeight: 1.6, marginBottom: 18, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          <span>Difference:</span>
          <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{fmt.format(Math.abs(reconcileState.delta))}</span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
          Check the receipt and fix the numbers above, or save with the discrepancy recorded.
        </div>

        {/* Preferred path — go back and fix */}
        <button
          style={{ ...btnPrimaryStyle, marginTop: 0 }}
          onClick={onClose}
        >
          ← Go back and fix
        </button>

        {/* Allowed path — override recorded as durable decision */}
        <button
          style={{ ...btnGhostStyle, border: '1px solid #f59e0b', color: '#92400e', background: '#fffbeb', marginTop: 10 }}
          onClick={onSaveAnyway}
        >
          Save anyway — I've checked the receipt
        </button>
      </div>
    </div>
  );
}
