// ============================================================
// ReceiptsList — the receipts that have been captured, newest first.
//
// PURPOSE:      /receipts could capture and could not show. Seventeen receipts exist at LAWNS,
//               six of them captured on one afternoon, and NOTHING rendered them — so a capture
//               that silently produced no order looked exactly like one that did. This is the
//               read surface: the receipt, the verdict the platform BANKED at save time (six
//               columns that have been write-only since 2026-06-14), and what the capture became
//               — its order, and that order's delivery.
//
//               🔴 READ-ONLY. This component issues ONE `.select()` and nothing else. It repairs
//               no duplicate, backfills no `receipt_id`, re-stamps no reconcile column, deletes
//               nothing, and adjudicates nothing: a receipt that produced no order says exactly
//               that and stops. Remediating live customer data is David's call and is not a step
//               inside a view build.
//
//               Every DECISION lives in `../../lib/receiptsList` where a probe can reach it; this
//               file renders the model it is handed and holds no logic of its own (tech-debt
//               #134 — a render condition inside a `.tsx` cannot be asserted).
//
// UI STANDARD (§6 r16 — name the standard, then decide):  the established pattern for a
//               homogeneous record set is a DATA GRID, and this platform has one (`<DataSheet>`,
//               §6 r14 — bounded scroll box, sticky header, frozen identifier column). DEVIATED
//               DELIBERATELY: each row carries a variable-length chain (0..n orders, each with
//               0..n deliveries), which a fixed-column grid can only render by truncating the
//               chain or by exploding one receipt into several rows — and a receipt appearing
//               twice because it has two orders is exactly the confusion this screen exists to
//               remove. The pattern taken instead is the standard SUMMARY ROW + INLINE DETAIL
//               (record list with disclosure): one card per receipt, the chain nested inside it.
//               At 17 rows against a 100-row cap there is nothing here that needs virtualising.
//
// DEPENDENCIES: `../../lib/supabase` (one select, RLS-enforced — `/receipts` already gates on
//               `costs:read` at router.tsx and `receipts` carries dual owner+member RLS on
//               `business_id`, 20260612_receipts.sql:31-63; no new endpoint, no new permission,
//               no migration) · `../../lib/receiptsList` (the model) ·
//               `../../utils/receiptReconciliation` (the severity styles, via the model).
//
// OUTPUTS:      <ReceiptsList businessId refreshToken /> — a list, a count that names its own
//               cap, and honest loading / empty / failed-read states.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  RECEIPTS_SELECT,
  RECEIPTS_PAGE_LIMIT,
  receiptListModel,
  type RawReceiptRow,
  type ReceiptListModel,
  type ReceiptRowModel,
  type OutcomeOrder,
} from '../../lib/receiptsList';

const TRACE_RECEIPTS_LIST = true; // [TRACE:receipts-list] STD-003 — ON until David owner-proves

// A read either produced data or FAILED. Keeping the two distinguishable is the whole point of
// the read-honesty ruling (2026-08-23): a failed read that renders as "no receipts" is a
// confident false statement about the tenant's data.
type ReadState =
  | { phase: 'loading' }
  | { phase: 'failed'; message: string }
  | { phase: 'loaded'; model: ReceiptListModel };

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '1.25rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
};
const H: React.CSSProperties = { fontSize: '1.125rem', fontWeight: 700, color: '#27500A', margin: 0 };
const COUNT: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b', marginTop: 4 };
const ROW: React.CSSProperties = {
  border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginTop: 12,
};
const LINE1: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between',
};
const VENDOR: React.CSSProperties = { fontWeight: 700, color: '#1f2937', fontSize: '0.9375rem' };
const VENDOR_LINK: React.CSSProperties = { ...VENDOR, color: '#27500A', textDecoration: 'none' };
// 48px min touch target (§6 r3) — this is the tap that opens the receipt on a phone.
const OPEN_LINK: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', minHeight: 48, marginTop: 2,
  fontSize: '0.8125rem', fontWeight: 600, color: '#27500A', textDecoration: 'none',
};
const META: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b' };
const AMOUNT: React.CSSProperties = { fontWeight: 700, color: '#27500A', fontSize: '0.9375rem' };
const NOTE: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b', marginTop: 4 };
const SECTION: React.CSSProperties = { marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e5e7eb' };
const SECTION_LABEL: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6,
};
const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  fontSize: '0.6875rem', fontWeight: 700, color, background: bg,
});
const ABSENCE: React.CSSProperties = {
  fontSize: '0.8125rem', color: '#6b7280', background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px',
};

function OrderBlock({ order }: { order: OutcomeOrder }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={badge(order.status.color, order.status.bg)}>{order.status.label}</span>
        <span style={META}>{order.kindText}</span>
        <span style={META}>#{order.docNumberText}</span>
        <span style={META}>{order.totalText}</span>
        <span style={META}>sold {order.saleDateText}</span>
      </div>
      {order.deliveryNote && <div style={{ ...ABSENCE, marginTop: 6 }}>{order.deliveryNote}</div>}
      {order.deliveries.map(d => (
        <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6, paddingLeft: 12, borderLeft: '2px solid #e5e7eb' }}>
          <span style={badge(d.status.color, d.status.bg)}>{d.status.label}</span>
          <span style={META}>{d.dateText}</span>
          <span style={META}>{d.serviceText}</span>
          <span style={META}>{d.sourceText}</span>
        </div>
      ))}
    </div>
  );
}

function ReceiptCard({ row }: { row: ReceiptRowModel }) {
  const { verdict, outcome } = row;
  return (
    <div style={ROW}>
      <div style={LINE1}>
        {/* The vendor string EXACTLY as stored. No derived document type, and no icon standing in
            for one — the table carries no origin/shape/source column (measured 2026-09-01). */}
        <Link to={`/receipts/${row.id}`} style={VENDOR_LINK}>{row.vendorText}</Link>
        <span style={AMOUNT}>{row.amountText}</span>
      </div>
      {/* The line the list cannot show. A receipt is $1,301.98 of "Services" from here; the
          detail view is where the quantity and the rate are, which is what the cost model needs. */}
      <Link to={`/receipts/${row.id}`} style={OPEN_LINK}>Open this receipt &rsaquo;</Link>
      <div style={META}>
        {row.dateText} · {row.categoryText} · captured {row.capturedAtText} · {row.statusText}
      </div>

      <div style={SECTION}>
        <div style={SECTION_LABEL}>What the platform banked at save time</div>
        {verdict.readout && <div style={verdict.readout.style}>{verdict.readout.text}</div>}
        {verdict.notes.map((n, i) => <div key={i} style={NOTE}>{n}</div>)}
      </div>

      <div style={SECTION}>
        <div style={SECTION_LABEL}>What it became</div>
        {outcome.multipleOrders && (
          <div style={{ ...ABSENCE, marginBottom: 6 }}>
            This receipt has {outcome.orders.length} orders against it.
          </div>
        )}
        {outcome.note && <div style={ABSENCE}>{outcome.note}</div>}
        {outcome.orders.map(o => <OrderBlock key={o.id} order={o} />)}
      </div>
    </div>
  );
}

export function ReceiptsList({ businessId, refreshToken }: { businessId: string | null; refreshToken?: string | null }) {
  const [state, setState] = useState<ReadState>({ phase: 'loading' });

  const load = useCallback(async () => {
    if (!businessId) { setState({ phase: 'loading' }); return; }
    setState({ phase: 'loading' });
    if (TRACE_RECEIPTS_LIST) console.log('[TRACE:receipts-list] read start', { businessId, limit: RECEIPTS_PAGE_LIMIT });

    // ONE read. `count: 'exact'` is what makes "showing N of M" possible — without the total,
    // a capped page can only print N, and an N under a bare label is a claim about a total
    // nobody measured.
    const { data, error, count } = await supabase
      .from('receipts')
      .select(RECEIPTS_SELECT, { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(RECEIPTS_PAGE_LIMIT);

    if (error) {
      if (TRACE_RECEIPTS_LIST) console.log('[TRACE:receipts-list] read FAILED', error.message);
      setState({ phase: 'failed', message: error.message });
      return;
    }

    const rows = (data ?? []) as unknown as RawReceiptRow[];
    const model = receiptListModel(rows, count ?? null);
    if (TRACE_RECEIPTS_LIST) {
      const orders = rows.reduce((n, r) => n + (r.orders?.length ?? 0), 0);
      const deliveries = rows.reduce((n, r) => n + (r.orders ?? []).reduce((m, o) => m + (o.deliveries?.length ?? 0), 0), 0);
      console.log('[TRACE:receipts-list] read ok', {
        rows: rows.length, total: count ?? 'not counted', capped: model.capped,
        withOrder: rows.filter(r => (r.orders?.length ?? 0) > 0).length,
        withoutOrder: rows.filter(r => (r.orders?.length ?? 0) === 0).length,
        orders, deliveries,
      });
    }
    setState({ phase: 'loaded', model });
  }, [businessId]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  return (
    <div style={CARD}>
      <div style={LINE1}>
        <h2 style={H}>Receipts captured</h2>
      </div>

      {state.phase === 'loading' && <div style={COUNT}>Loading receipts…</div>}

      {state.phase === 'failed' && (
        <div style={{ ...ABSENCE, marginTop: 8, color: '#A32D2D', background: '#fef2f2', borderColor: '#fca5a5' }}>
          Could not read receipts — {state.message}. This is a failed read, NOT an empty list:
          how many receipts exist is unknown right now.
        </div>
      )}

      {state.phase === 'loaded' && (
        <>
          <div style={COUNT}>{state.model.countText}</div>
          {state.model.emptyNote && <div style={{ ...ABSENCE, marginTop: 10 }}>{state.model.emptyNote}</div>}
          {state.model.rows.map(r => <ReceiptCard key={r.id} row={r} />)}
        </>
      )}
    </div>
  );
}
