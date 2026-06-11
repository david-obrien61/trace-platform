import { CSSProperties } from 'react';

// Reconciliation thresholds
const MATCH_TOLERANCE = 0.02;  // ≤$0.02 = match (rounding noise)
const SMALL_GAP_ABS   = 5.00;  // <$5 absolute gap = small (plausibly tax/tip)
const SMALL_GAP_PCT   = 0.10;  // <10% of total = small gap

export const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Editable line item — string amounts for free-form input; parsed to number on save
export interface LineItem {
  id: string;
  description: string;
  amount: string;
}

export interface ReconcileResult {
  status: 'no_lines' | 'match' | 'small_gap' | 'large_mismatch';
  lineSum: number;
  total: number;
  delta: number;   // lineSum − total; positive = lines exceed total
  gapNote: string | null;
}

export function computeReconcile(lineItems: LineItem[], totalAmount: string): ReconcileResult {
  if (lineItems.length === 0) {
    return { status: 'no_lines', lineSum: 0, total: 0, delta: 0, gapNote: null };
  }
  const lineSum = lineItems.reduce((acc, item) => {
    const n = parseFloat(item.amount);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
  const parsedTotal = parseFloat(totalAmount);
  const total = isNaN(parsedTotal) ? 0 : parsedTotal;
  const delta = lineSum - total;
  const absD  = Math.abs(delta);

  if (absD <= MATCH_TOLERANCE) {
    return { status: 'match', lineSum, total, delta, gapNote: null };
  }
  const isSmall = absD < SMALL_GAP_ABS || (total > 0 && absD / total < SMALL_GAP_PCT);
  if (isSmall) {
    const note = delta > 0
      ? `Lines exceed total by ${fmt.format(absD)} — possibly tax not in total`
      : `Total exceeds lines by ${fmt.format(absD)} — possibly tax or tip`;
    return { status: 'small_gap', lineSum, total, delta, gapNote: note };
  }
  return { status: 'large_mismatch', lineSum, total, delta, gapNote: null };
}

// Reconcile readout — severity-scaled color
export function reconcileReadoutStyle(status: ReconcileResult['status']): CSSProperties {
  if (status === 'match')          return { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '7px 10px', fontSize: '0.8125rem', color: '#166534', marginTop: 8 };
  if (status === 'small_gap')      return { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '7px 10px', fontSize: '0.8125rem', color: '#92400e', marginTop: 8 };
  if (status === 'large_mismatch') return { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '7px 10px', fontSize: '0.8125rem', color: '#A32D2D', marginTop: 8 };
  return { display: 'none' };
}

export function reconcileReadoutText(rs: ReconcileResult): string {
  if (rs.status === 'match') return `✓ Lines: ${fmt.format(rs.lineSum)} = Total: ${fmt.format(rs.total)}`;
  const absD = Math.abs(rs.delta);
  const dir  = rs.delta > 0 ? 'exceed' : 'below';
  const prefix = rs.status === 'large_mismatch' ? '⚠️ ' : '';
  return `${prefix}Lines ${fmt.format(rs.lineSum)} ${dir} total ${fmt.format(rs.total)} by ${fmt.format(absD)}`;
}
