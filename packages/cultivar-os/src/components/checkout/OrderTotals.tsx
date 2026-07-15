// ============================================================
// OrderTotals — the ONE canonical show-the-work totals block (STD-011 / STD-012 persistence clause).
// PURPOSE: render the SAME D-39 grouped structure on every POST-TRANSACTION surface (Confirmation +
//   order-detail + — via the shared tax presenter — QBO), from the D-43 STORED breakdown. No surface
//   recomputes; each maps its stored fact into these props and this renders it identically:
//     Goods subtotal (retail) → Discount — N% off (−$X) → Goods after discount →
//     SERVICES (each line, not discounted, $0.00 shown explicitly) →
//     Subtotal (after discount) → Tax line (D-40 three-state via describeTaxLine) → Total
//   Historical orders with no stored breakdown (discountTotal 0, no retail) render net-only — no
//   fabricated discount line (D-9 omit-not-fake). This is STD-017 scar #2: order-detail + QBO had
//   drifted from the structure Review/Confirm render; ONE renderer stops the drift.
// DEPENDENCIES: describeTaxLine (@trace/shared/business-logic) — the SINGLE tax-line presenter.
// OUTPUTS: <OrderTotals> — presentational only (no data fetch, no compute of charges).
// ============================================================
import { describeTaxLine, type TaxStatus } from '@trace/shared/business-logic';

interface TotalsService {
  name: string;
  amount: number;
  /** optional detail line (e.g. "transport · per plant · ×3") — order-detail passes it, Confirmation omits it */
  sublabel?: string | null;
}

interface OrderTotalsProps {
  goodsRetailSubtotal: number;
  discountTotal: number;
  discountLabel: string | null;
  /** ALL selected services incl. $0 ones (FIX 3/4 — never dropped, never em-dash) */
  services: TotalsService[];
  /** the after-discount subtotal (= order.subtotal / pricing.discountedSubtotal) */
  subtotal: number;
  total: number;
  // D-40 tax inputs → describeTaxLine (the ONE tax presenter). taxStatus derived-from-stored is fine
  // (deriving an enum from persisted facts is not recomputing a charge).
  taxStatus: TaxStatus;
  tax: number;
  taxableSubtotal?: number | null;
  taxRate?: number | null;
  taxReason?: string | null;
  taxCertRef?: string | null;
}

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

export function OrderTotals(props: OrderTotalsProps) {
  const { goodsRetailSubtotal, discountTotal, discountLabel, services, subtotal, total,
          taxStatus, tax, taxableSubtotal, taxRate, taxReason, taxCertRef } = props;
  const hasDiscount = discountTotal > 0;
  const taxView = describeTaxLine({ taxStatus, tax, taxableSubtotal, taxRate, reason: taxReason, certRef: taxCertRef });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Goods subtotal → discount → goods after (only when a discount applies; retail stays clean) */}
      {hasDiscount && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
          <div style={rowStyle('#6b7280')}>
            <span>Goods subtotal (retail)</span><span>{money(goodsRetailSubtotal)}</span>
          </div>
          <div style={{ ...rowStyle('#27500A'), fontWeight: 600 }}>
            <span>{discountLabel ?? 'Discount'}</span><span>−{money(discountTotal)}</span>
          </div>
          <div style={{ ...rowStyle('#374151'), fontWeight: 600 }}>
            <span>Goods after discount</span><span>{money(goodsRetailSubtotal - discountTotal)}</span>
          </div>
        </div>
      )}

      {/* Services — not discounted. ALL lines incl. $0 (FIX 3), zero shown as $0.00 (FIX 4). */}
      {services.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: hasDiscount ? 8 : 0, borderTop: hasDiscount ? '1px solid #f3f4f6' : 'none' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>
            Services <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#b0b7c0' }}>· not discounted</span>
          </p>
          {services.map((s, i) => (
            <div key={`svc-${i}`} style={rowStyle('#374151')}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {s.name}
                {s.sublabel ? <span style={{ display: 'block', fontSize: '0.72rem', color: '#9ca3af' }}>{s.sublabel}</span> : null}
              </span>
              <span>{money(s.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Subtotal (after discount) → tax (three-state) → total */}
      <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={rowStyle('#6b7280')}>
          <span>{hasDiscount ? 'Subtotal (after discount)' : 'Subtotal'}</span><span>{money(subtotal)}</span>
        </div>
        <div style={{ ...rowStyle(taxView.redline ? '#92400e' : '#6b7280'), fontWeight: taxView.redline ? 600 : 400 }}>
          <span>{taxView.redline ? '⚠ ' : ''}{taxView.label}</span><span>{taxView.amount ?? ''}</span>
        </div>
        {taxView.state === 'not_identified' && (
          <p style={{ fontSize: '0.72rem', color: '#92400e', margin: '0 0 2px' }}>
            No tax was applied — set your business's sales tax rate in Settings so the invoice is correct.
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.0625rem', fontWeight: 700, color: '#1f2937', paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
          <span>Total{taxView.state === 'not_identified' ? ' (tax not included)' : ''}</span><span>{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

function rowStyle(color: string): React.CSSProperties {
  return { display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color };
}
