// ============================================================
// QBInvoicePreview (route /demo/quickbooks-invoice) — the QuickBooks sandbox PREVIEW of an order.
// PURPOSE: render the QB-styled invoice for the REAL order (orderId is passed by Confirmation),
//   matching what the real push (api/qbo/invoice/cultivar.ts) sends to QuickBooks. Previously this
//   was a hardcoded stub (Vitex $400 / netting $10 / compost $28 + "Layna" + LAWNS identity) shown
//   for EVERY order — a demo-killer + tenant/identity leak (HARDCODED-REGISTER H1). Now every order
//   shows ITS OWN correct lines + the REAL business identity (AC-1), read under owner RLS.
// DEPENDENCIES: react-router (orderId query), supabase (owner-RLS read), orderItemName (D-34 dual
//   anchor — the SAME resolver the roster/detail/real-push use, never forked).
// OUTPUTS: an order-backed QB invoice preview. Display-only — does NOT touch the real integration.
// ============================================================
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { orderItemName, orderItemTag } from '../lib/orderItemName';
import { describeTaxLine, type TaxStatus } from '@trace/shared/business-logic';

interface PreviewLine { description: string; qty: number; rate: number; amount: number; }
interface PreviewData {
  invoiceNumber: string;
  date:          string;
  total:         number;
  subtotal:      number;
  tax:           number;
  // D-40 (FIX 2): the persisted tax state → the preview renders the three-state tax line via the
  // SHARED presenter (never a silent "Sales Tax $0.00" with no reason on an exempt invoice).
  taxStatus:     TaxStatus;
  taxReason:     string | null;
  taxCertRef:    string | null;
  bizName:       string | null;
  bizAddress:    string | null;
  bizPhone:      string | null;
  billToName:    string | null;
  billToEmail:   string | null;
  lines:         PreviewLine[];
}

function QBInvoicePreview() {
  const [params] = useSearchParams();
  const orderId       = params.get('orderId') || '';
  const queryTotal    = parseFloat(params.get('total') || '0') || 0;
  const queryInvoice  = params.get('invoiceNumber') || '—';

  const [data, setData]       = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orderId) { setLoading(false); setNotFound(true); return; }
      setLoading(true);

      // Order + customer (owner RLS — the preview is an owner-facing surface).
      const { data: order } = await supabase
        .from('orders')
        .select('id, business_id, subtotal, tax_amount, total_amount, notes, tax_exempt_applied, tax_exempt_reason, tax_exempt_cert_ref, customers(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) { if (!cancelled) { setLoading(false); setNotFound(true); } return; }

      const o = order as any;

      // Plant lines — anchored to the business_inventory lot (D-34; order_items.plant_id dropped
      // 20260709), named by the SAME resolver as the roster/detail/real-push. D-43: also read the
      // STORED per-line breakdown (retail_unit/discount_pct/discount_amt) so the invoice SHOWS the
      // discount as its own line (goods at retail → discount line), never a silently-net rate. The
      // breakdown cols are gated (20260713); fall back to the net-only select on a missing-column error.
      const ITEM_CORE = 'quantity, unit_price, subtotal, business_inventory_id, business_inventory ( name, size, sku )';
      let itemsRaw: any = null; let itemsErr: any = null;
      ({ data: itemsRaw, error: itemsErr } = await supabase
        .from('order_items')
        .select(`${ITEM_CORE}, retail_unit, discount_pct, discount_amt`)
        .eq('order_id', orderId));
      if (itemsErr && (itemsErr.code === '42703' || itemsErr.code === 'PGRST204')) {
        ({ data: itemsRaw } = await supabase.from('order_items').select(ITEM_CORE).eq('order_id', orderId));
      }

      // Service lines — real service_offerings.name (never a CHOICE_META branch label).
      const { data: selsRaw } = await supabase
        .from('order_service_selections')
        .select('quantity, unit_price_at_time, subtotal, service_offerings(name)')
        .eq('order_id', orderId);

      // Business identity (name/address/phone) from the businesses row (AC-1).
      const { data: biz } = await supabase
        .from('businesses')
        .select('name, address, phone')
        .eq('id', o.business_id)
        .maybeSingle();

      // D-43: when every goods line stored a retail_unit AND a discount was applied, show goods at
      // RETAIL and add ONE explicit discount line (mirrors QBO's list-price + discount convention +
      // the Review/Confirmation receipt). Historical/pre-migration rows (null retail_unit) → render
      // net only, no discount line (omit-not-fake, D-9). All from STORED columns — no recompute.
      const goodsItems  = (itemsRaw ?? []) as any[];
      const hasBreakdown = goodsItems.length > 0 && goodsItems.every(it => it.retail_unit != null);
      const discountTotal = hasBreakdown
        ? Math.round(goodsItems.reduce((s, it) => s + Number(it.discount_amt ?? 0), 0) * 100) / 100 : 0;
      const showDiscount = hasBreakdown && discountTotal > 0;
      const discPct = goodsItems.find(it => Number(it.discount_amt ?? 0) > 0)?.discount_pct ?? 0;

      const lines: PreviewLine[] = [];
      for (const it of goodsItems) {
        const name      = orderItemName(it);
        const container = it.business_inventory?.size ?? null;
        const tag       = orderItemTag(it);
        const label     = container ? `${name} — ${container}` : (name === 'Unknown plant' && tag !== '—' ? tag : name);
        const rate   = showDiscount ? Number(it.retail_unit) : Number(it.unit_price ?? 0);
        const amount = showDiscount
          ? Math.round(Number(it.retail_unit) * Number(it.quantity ?? 1) * 100) / 100
          : Number(it.subtotal ?? 0);
        lines.push({ description: label, qty: Number(it.quantity ?? 1), rate, amount });
      }
      if (showDiscount) {
        lines.push({
          description: `Discount${discPct > 0 ? ` (${discPct}% off)` : ''}`,
          qty: 1, rate: -discountTotal, amount: -discountTotal,
        });
      }
      for (const s of (selsRaw ?? []) as any[]) {
        const svcName = s.service_offerings?.name ?? 'Service';
        const amt = Number(s.subtotal ?? 0);
        lines.push({
          description: Number(s.quantity ?? 1) > 1 ? `${svcName} × ${s.quantity}` : svcName,
          qty:  Number(s.quantity ?? 1),
          rate: Number(s.unit_price_at_time ?? 0),
          amount: amt,
        });
      }

      const subtotal = Number(o.subtotal ?? 0);
      const tax      = Number(o.tax_amount ?? 0);
      const total    = Number(o.total_amount ?? subtotal + tax);
      const cust     = o.customers;

      // FIX 2 (D-40): derive the three-state tax status from the persisted facts (deriving an enum
      // from stored fields is not recomputing a charge — the money is unchanged).
      const taxStatus: TaxStatus = o.tax_exempt_applied
        ? 'exempt'
        : (tax > 0 ? 'taxed' : 'not_identified');

      if (!cancelled) {
        setData({
          invoiceNumber: o.notes || queryInvoice,
          date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          total, subtotal, tax,
          taxStatus,
          taxReason:  o.tax_exempt_reason ?? null,
          taxCertRef: o.tax_exempt_cert_ref ?? null,
          bizName:    biz?.name ?? null,
          bizAddress: biz?.address ?? null,
          bizPhone:   biz?.phone ?? null,
          billToName:  cust ? `${cust.first_name ?? ''} ${cust.last_name ?? ''}`.trim() || null : null,
          billToEmail: cust?.email ?? null,
          lines,
        });
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orderId, queryInvoice]);

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.03em' }}>
        QuickBooks sandbox view — demo only
      </div>
      <div style={{ background: '#2d9b45', padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#2d9b45', letterSpacing: '-0.05em' }}>QB</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem' }}>QuickBooks Online</span>
        </div>
        <span style={{ color: '#a7f3d0', fontSize: '0.8125rem' }}>
          Sandbox{data?.bizName ? ` — ${data.bizName}` : ''}
        </span>
      </div>
      <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>{children}</div>
    </div>
  );

  if (loading) {
    return wrap(<p style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>Loading invoice…</p>);
  }

  if (notFound || !data) {
    return wrap(
      <div style={{ background: '#fff', borderRadius: 8, padding: '28px 32px', textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>
          Couldn't load this order's invoice preview{queryTotal > 0 ? ` (order total $${queryTotal.toFixed(2)})` : ''}.
        </p>
      </div>,
    );
  }

  // D-40 (FIX 2): the ONE three-state tax presenter, from the persisted state. not_identified →
  // no tax line on the invoice (the redline lives pre-invoice, in the app); exempt → a $0 line that
  // STATES the reason (audit-trail, never a silent $0.00); taxed → the derived %.
  const taxView = describeTaxLine({ taxStatus: data.taxStatus, tax: data.tax, taxableSubtotal: data.subtotal, taxRate: null, reason: data.taxReason, certRef: data.taxCertRef });

  return wrap(
    <>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        {/* Invoice header */}
        <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice</p>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>#{data.invoiceNumber}</h1>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Date: {data.date}</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0' }}>Due: {data.date} (Due on receipt)</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-block', padding: '6px 14px', background: '#dcfce7', color: '#166534', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600 }}>OPEN</div>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '12px 0 0' }}>${data.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* From / To — real business + real customer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '24px 32px', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>From</p>
            <p style={{ fontWeight: 600, color: '#1f2937', margin: '0 0 2px' }}>{data.bizName ?? '—'}</p>
            {data.bizAddress && <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>{data.bizAddress}</p>}
            {data.bizPhone && <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>{data.bizPhone}</p>}
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Bill To</p>
            <p style={{ fontWeight: 600, color: '#1f2937', margin: '0 0 2px' }}>{data.billToName ?? 'Customer'}</p>
            {data.billToEmail && <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>{data.billToEmail}</p>}
          </div>
        </div>

        {/* Line items — REAL order lines */}
        <div style={{ padding: '24px 32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                {['Description', 'Qty', 'Rate', 'Amount'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Description' ? 'left' : 'right', padding: '0 0 10px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l, i) => {
                const isDiscount = l.amount < 0;
                const fmt = (n: number) => (n < 0 ? `−$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '14px 0', fontSize: '0.9375rem', color: isDiscount ? '#166534' : '#374151', fontWeight: isDiscount ? 600 : 400 }}>{l.description}</td>
                    <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>{isDiscount ? '' : l.qty}</td>
                    <td style={{ textAlign: 'right', padding: '14px 0', color: isDiscount ? '#166534' : '#374151' }}>{isDiscount ? '' : fmt(l.rate)}</td>
                    <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: isDiscount ? 600 : 500, color: isDiscount ? '#166534' : '#374151' }}>{fmt(l.amount)}</td>
                  </tr>
                );
              })}
              {/* D-40 three-state tax line (FIX 2). not_identified → omit (no tax was charged);
                  exempt → a $0 line stating the reason; taxed → the tax with derived %. */}
              {taxView.state !== 'not_identified' && (
                <tr>
                  <td style={{ padding: '14px 0', fontSize: '0.9375rem', color: '#374151' }}>{taxView.label}</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}></td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}></td>
                  <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: 500, color: '#374151' }}>{taxView.amount}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ borderTop: '2px solid #f3f4f6', marginTop: 16, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Subtotal</span><span>${data.subtotal.toFixed(2)}</span>
            </div>
            {taxView.state === 'not_identified' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#92400e', fontWeight: 600 }}>
                <span>⚠ Tax: not identified</span><span></span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>{taxView.state === 'exempt' ? 'Tax exempt' : 'Tax'}</span><span>{taxView.amount}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.125rem', color: '#111827', paddingTop: 8, borderTop: '1.5px solid #e5e7eb' }}>
              <span>Total</span><span>${data.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#9ca3af', marginTop: 20 }}>
        This is a demo view of what appears in QuickBooks Online sandbox — the same lines the live push sends.
      </p>
    </>
  );
}

// Back-compat alias — router still imports { DemoQBInvoice }.
export { QBInvoicePreview as DemoQBInvoice };
