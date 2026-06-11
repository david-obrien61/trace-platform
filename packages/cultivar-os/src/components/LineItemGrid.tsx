import React from 'react';
import {
  LineItem,
  ReconcileResult,
  reconcileReadoutStyle,
  reconcileReadoutText,
} from '../utils/receiptReconciliation';

interface LineItemGridProps {
  lineItems: LineItem[];
  onUpdate: (id: string, field: 'description' | 'amount', value: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  reconcileState: ReconcileResult | null;
  labelStyle: React.CSSProperties;
}

const LINE_ITEMS_SECTION: React.CSSProperties = { marginBottom: 16 };

const LINE_ITEM_HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const LINE_ITEM_ROW: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 6,
  alignItems: 'center',
};

const LINE_DESC_INPUT: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '7px 8px',
  fontSize: '0.875rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
};

const LINE_AMT_INPUT: React.CSSProperties = {
  width: 76,
  flexShrink: 0,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '7px 6px',
  fontSize: '0.875rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'right',
};

const LINE_DELETE_BTN: React.CSSProperties = {
  width: 28,
  height: 28,
  flexShrink: 0,
  border: 'none',
  borderRadius: 6,
  background: '#fee2e2',
  color: '#A32D2D',
  cursor: 'pointer',
  fontSize: '1rem',
  lineHeight: '1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};

const ADD_ROW_BTN: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px dashed #a7c985',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: '0.8125rem',
  color: '#4b7a2e',
  cursor: 'pointer',
  marginTop: 4,
};

export function LineItemGrid({ lineItems, onUpdate, onDelete, onAdd, reconcileState, labelStyle }: LineItemGridProps) {
  return (
    <div style={LINE_ITEMS_SECTION}>
      <div style={LINE_ITEM_HEADER}>
        <label style={labelStyle}>Line Items</label>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {lineItems.length === 0
            ? 'none captured'
            : `${lineItems.length} item${lineItems.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {lineItems.length === 0 && (
        <div style={{ fontSize: '0.8125rem', color: '#94a3b8', padding: '8px 12px', background: '#f9fafb', borderRadius: 6, textAlign: 'center', marginBottom: 6 }}>
          No line items captured — add manually if needed
        </div>
      )}

      {lineItems.map(item => (
        <div key={item.id} style={LINE_ITEM_ROW}>
          <input
            style={LINE_DESC_INPUT}
            value={item.description}
            onChange={e => onUpdate(item.id, 'description', e.target.value)}
            placeholder="Description"
          />
          <input
            style={LINE_AMT_INPUT as React.CSSProperties}
            type="number"
            step="0.01"
            min="0"
            value={item.amount}
            onChange={e => onUpdate(item.id, 'amount', e.target.value)}
            placeholder="0.00"
          />
          <button
            style={LINE_DELETE_BTN}
            onClick={() => onDelete(item.id)}
            aria-label="Delete line item"
          >
            ×
          </button>
        </div>
      ))}

      <button style={ADD_ROW_BTN} onClick={onAdd}>
        + Add line item
      </button>

      {/* Live reconcile readout — below grid, above Total Amount */}
      {reconcileState && reconcileState.status !== 'no_lines' && (
        <div style={reconcileReadoutStyle(reconcileState.status)}>
          {reconcileReadoutText(reconcileState)}
          {reconcileState.gapNote && (
            <div style={{ marginTop: 3, opacity: 0.8 }}>{reconcileState.gapNote}</div>
          )}
        </div>
      )}
    </div>
  );
}
