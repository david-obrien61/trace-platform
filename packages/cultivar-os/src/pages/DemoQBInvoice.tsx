import { useSearchParams } from 'react-router-dom';

export function DemoQBInvoice() {
  const [params] = useSearchParams();
  const total         = params.get('total') || '0';
  const invoiceNumber = params.get('invoiceNumber') || '—';

  const totalNum  = parseFloat(total) || 0;
  const subtotal  = totalNum / 1.0825;
  const tax       = totalNum - subtotal;
  const today     = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui, sans-serif' }}>
      {/* QB sandbox notice */}
      <div style={{ background: '#1d4ed8', color: '#fff', padding: '8px 16px', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.03em' }}>
        QuickBooks sandbox view — demo only
      </div>

      {/* QB-style nav bar */}
      <div style={{ background: '#2d9b45', padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, background: '#fff', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#2d9b45', letterSpacing: '-0.05em' }}>QB</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9375rem' }}>QuickBooks Online</span>
        </div>
        <span style={{ color: '#a7f3d0', fontSize: '0.8125rem' }}>Sandbox — LAWNS Tree Farm, LLC</span>
      </div>

      <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 16px' }}>
        {/* Invoice card */}
        <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          {/* Invoice header */}
          <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice</p>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>#{invoiceNumber}</h1>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>Date: {today}</p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0' }}>Due: {today} (Due on receipt)</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', padding: '6px 14px', background: '#dcfce7', color: '#166534', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600 }}>
                  OPEN
                </div>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '12px 0 0' }}>
                  ${totalNum.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '24px 32px', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>From</p>
              <p style={{ fontWeight: 600, color: '#1f2937', margin: '0 0 2px' }}>LAWNS Tree Farm, LLC</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>400 Honeycomb Mesa</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>Leander, TX 78641</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>(512) 450-3336</p>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Bill To</p>
              <p style={{ fontWeight: 600, color: '#1f2937', margin: '0 0 2px' }}>Customer</p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0' }}>Sent via email</p>
            </div>
          </div>

          {/* Line items */}
          <div style={{ padding: '24px 32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Description', 'Qty', 'Rate', 'Amount'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Description' ? 'left' : 'right', padding: '0 0 10px', fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '14px 0', fontSize: '0.9375rem', color: '#374151' }}>Shoal Creek Vitex — 30 gal</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>1</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>$400.00</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: 500, color: '#374151' }}>$400.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '14px 0', fontSize: '0.9375rem', color: '#374151' }}>Protective travel netting × 1</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>1</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>$10.00</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: 500, color: '#374151' }}>$10.00</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '14px 0', fontSize: '0.9375rem', color: '#374151' }}>Native compost blend × 1</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>1</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>$28.00</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: 500, color: '#374151' }}>$28.00</td>
                </tr>
                <tr>
                  <td style={{ padding: '14px 0', fontSize: '0.9375rem', color: '#374151' }}>Texas Sales Tax (8.25%)</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>1</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>${tax.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: 500, color: '#374151' }}>${tax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ borderTop: '2px solid #f3f4f6', marginTop: 16, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280, marginLeft: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>Tax</span><span>${tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.125rem', color: '#111827', paddingTop: 8, borderTop: '1.5px solid #e5e7eb' }}>
                <span>Total</span><span>${totalNum.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ background: '#f9fafb', padding: '16px 32px', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>
              Private note: Customer self-transporting. Protective netting applied per TX TCC Ch. 725. Source: QR scan — Cultivar OS.
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#9ca3af', marginTop: 20 }}>
          This is a demo view of what appears in QuickBooks Online sandbox.
          <br />In the live demo, Layna sees this invoice in her real QuickBooks account.
        </p>
      </div>
    </div>
  );
}
