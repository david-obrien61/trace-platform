import React from 'react';
import { fmt, ReconcileResult } from '../utils/receiptReconciliation';

interface ConflictDialogProps {
  reconcileState: ReconcileResult;
  onClose: () => void;
  onSaveAnyway: () => void;
  btnPrimaryStyle: React.CSSProperties;
  btnGhostStyle: React.CSSProperties;
}

// CENTERED per the platform modal standard (docs/standards/ui-control-standards.md → MODAL) — a
// decision dialog (use-site-value vs keep-mine) floats centered on every viewport, not anchored bottom.
const DIALOG_BACKDROP: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  boxSizing: 'border-box',
};

// 🔴 V4 (§8, R-148) — BOUNDED FLEX COLUMN, ACTIONS PINNED. This card used to be one box with
// `overflowY:'auto'`, so the two buttons scrolled with the evidence above them. **Of the eleven
// dialogs the 2026-09-12 survey measured, this is the one where a missed control costs most:**
// `Save anyway — I've checked the receipt` records a DURABLE override on a money discrepancy, and it
// sits below the numbers the reader must scroll through to judge it. G2's 2026-09-07 amendment,
// third instance — the bound must survive anything rendered above it inside its own box.
const DIALOG_CARD: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  width: '100%',
  maxWidth: 480,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
};
/** The evidence. Scrolls. */
const DIALOG_BODY: React.CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 20px 8px' };
/** The decision. Does NOT scroll — both paths are on screen whenever the dialog is. */
const DIALOG_ACTIONS: React.CSSProperties = { flexShrink: 0, padding: '14px 20px 20px', borderTop: '1px solid #e5e7eb', background: '#fff' };

export function ConflictDialog({ reconcileState, onClose, onSaveAnyway, btnPrimaryStyle, btnGhostStyle }: ConflictDialogProps) {
  return (
    <div style={DIALOG_BACKDROP} onClick={onClose}>
      <div style={DIALOG_CARD} onClick={e => e.stopPropagation()}>
        <div style={DIALOG_BODY}>
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

        </div>

        <div style={DIALOG_ACTIONS}>
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
    </div>
  );
}
