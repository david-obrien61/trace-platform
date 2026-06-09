/**
 * FILE: IgnitionInvoice.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Invoice generation and payment processing for authorized repair orders.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';
import { Receipt, CreditCard, Banknote, Building2, CheckCircle2, ChevronLeft, ArrowRight, Printer } from 'lucide-react';

const STYLE_DEBUG = true;

// [TRACE:WORKFLOW] ON — teardown instrumentation (invoice path: invoiced→paid→closed). Comment out after migration.
const TRACE_WORKFLOW = true;

// Non-1:1 mappings (63 classNames converted):
// (1) hover:text-white on Back button → dropped (cosmetic)
// (2) hover:border-slate-600 on job selector button → dropped (cosmetic)
// (3) hover:bg-slate-800/30 on line item rows → dropped (cosmetic)
// (4) hover:bg-blue-500 on Generate Invoice button → dropped (cosmetic)
// (5) hover:border-slate-600 on payment method buttons → dropped (cosmetic)
// (6) hover:bg-emerald-500 on Process Payment button → dropped (cosmetic)
// (7) hover:bg-slate-700 on Download PDF button → dropped (cosmetic)
// (8) focus:border-blue-500 on mileage input → ign-input CSS class
// (9) disabled:opacity-50 / disabled:bg-slate-800 / disabled:text-slate-500 → inline conditional styles
// (10) lg:flex-row → always row (no breakpoint equivalent; flagged)
// (11) lg:w-80 → always 320px (no breakpoint equivalent; flagged)
// (12) space-y-3/4/6 → flexDirection:column + gap equivalents
// [TRACE:STYLE] IgnitionInvoice converted, 63 classNames → inline, 12 non-1:1 categories

export default function IgnitionInvoice({ onBack }) {
  const [shopId] = useState(() => DataBridge.load('shop_info')?.id || DataBridge.load('shop_policy')?.shop_id);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  const [estimate, setEstimate] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [mileageOut, setMileageOut] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Fixed pilot tax rate
  const TAX_RATE = 0.0825;

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionInvoice converted, 63 classNames → inline, 12 non-1:1 categories');

  useEffect(() => {
    loadJobs();
  }, [shopId]);

  useEffect(() => {
    if (selectedJob) {
      loadJobDetails(selectedJob);
    }
  }, [selectedJob]);

  const loadJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('shop_id', shopId)
      .in('status', ['authorized', 'in_repair', 'repair_done', 'invoiced'])
      .order('created_at', { ascending: false });

    if (data) setJobs(data);
    setLoading(false);
  };

  const loadJobDetails = async (job) => {
    setProcessing(true);
    setEstimate(null);
    setLineItems([]);
    setInvoice(null);
    setInvoiceItems([]);

    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('job_id', job.id)
      .single();

    if (existingInvoice) {
      setInvoice(existingInvoice);
      const { data: invItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', existingInvoice.id)
        .order('sort_order');
      if (invItems) setInvoiceItems(invItems);
      setProcessing(false);
      return;
    }

    const { data: estData } = await supabase
      .from('estimates')
      .select('*')
      .eq('job_id', job.id)
      .in('status', ['authorized', 'sent', 'ready'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (estData) {
      setEstimate(estData);
      const { data: estItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estData.id)
        .eq('auth_status', 'approved')
        .order('sort_order');

      if (estItems) setLineItems(estItems);
    }

    setProcessing(false);
  };

  const generateInvoice = async () => {
    if (!estimate || !lineItems.length) return;
    setProcessing(true);

    const partsTotal = lineItems.filter(l => l.item_type === 'PART').reduce((s, l) => s + (l.line_total || 0), 0);
    const subtotal = lineItems.reduce((s, l) => s + (l.line_total || 0), 0);
    const tax = +(partsTotal * TAX_RATE).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);

    const { data: newInvoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        job_id: selectedJob.id,
        shop_id: shopId,
        estimate_id: estimate.id,
        customer_id: selectedJob.customer_id,
        status: 'open',
        subtotal,
        tax,
        total
      })
      .select()
      .single();

    if (invError || !newInvoice) {
      alert("Failed to generate invoice");
      setProcessing(false);
      return;
    }

    const invItemsData = lineItems.map(item => ({
      invoice_id: newInvoice.id,
      job_id: selectedJob.id,
      shop_id: shopId,
      source_line_item_id: item.id,
      item_type: item.item_type,
      description: item.description,
      part_number: item.part_number,
      quantity: item.quantity,
      unit_price: item.unit_price,
      labor_hours: item.labor_hours,
      labor_rate: item.labor_rate,
      line_total: item.line_total,
      sort_order: item.sort_order
    }));

    const { data: newInvItems } = await supabase
      .from('invoice_line_items')
      .insert(invItemsData)
      .select();

    if (TRACE_WORKFLOW) console.log('[TRACE:WORKFLOW] IgnitionInvoice.generateInvoice → jobs.update(status=invoiced): jobId=%s invoiceId=%s total=%o lineItems=%o — WORKFLOW STEP 7 (repair_done→invoiced)', selectedJob.id, newInvoice.id, total, invItemsData.length);
    await supabase.from('jobs').update({ status: 'invoiced' }).eq('id', selectedJob.id);

    setInvoice(newInvoice);
    setInvoiceItems(newInvItems || []);
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'invoiced' } : j));
    setSelectedJob(prev => ({ ...prev, status: 'invoiced' }));

    setProcessing(false);
  };

  const downloadPdf = async () => {
    if (!invoice) return;
    setDownloadingPdf(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/invoices/${invoice.id}/pdf`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.id.slice(0, 8).toUpperCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[PDF]', e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const processPaymentAndClose = async () => {
    if (!invoice || !mileageOut) {
      alert("Please enter the Mileage Out value before closing the job.");
      return;
    }
    setProcessing(true);

    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        payment_method: paymentMethod,
        paid_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    if (TRACE_WORKFLOW) console.log('[TRACE:WORKFLOW] IgnitionInvoice.processPaymentAndClose → jobs.update(status=closed): jobId=%s invoiceId=%s paymentMethod=%s — WORKFLOW STEP 8 (invoiced→paid→closed; RO lifecycle terminal)', selectedJob.id, invoice.id, paymentMethod);
    await supabase
      .from('jobs')
      .update({
        status: 'closed',
        mileage_out: parseInt(mileageOut, 10)
      })
      .eq('id', selectedJob.id);

    setInvoice(prev => ({ ...prev, status: 'paid', payment_method: paymentMethod }));
    setJobs(prev => prev.filter(j => j.id !== selectedJob.id));
    setSelectedJob(null);
    setProcessing(false);
  };

  const renderJobSelector = () => (
    <div style={{ width: '33.333%', borderRight: '1px solid #1e293b', backgroundColor: 'rgba(15,23,42,0.50)', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 24, borderBottom: '1px solid #1e293b', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff' }}>Invoicing</h2>
        <Receipt style={{ color: '#3b82f6' }} />
      </div>
      {/* hover:border-slate-600 on job buttons → dropped (cosmetic) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', padding: 16, textAlign: 'center' }}>Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', padding: 16, textAlign: 'center' }}>No jobs ready for invoice</p>
        ) : (
          jobs.map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 16,
                borderRadius: 16,
                border: selectedJob?.id === job.id ? '1px solid rgba(59,130,246,0.50)' : '1px solid #1e293b',
                backgroundColor: selectedJob?.id === job.id ? 'rgba(30,58,138,0.20)' : '#0f172a',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <p style={{ color: '#ffffff', fontWeight: 900, textTransform: 'uppercase', fontSize: 14 }}>{job.customer?.name || 'Unknown Customer'}</p>
                <span style={{
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  padding: '4px 8px',
                  borderRadius: 4,
                  ...(job.status === 'invoiced'
                    ? { backgroundColor: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.30)', color: '#fb923c' }
                    : { backgroundColor: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.30)', color: '#60a5fa' })
                }}>
                  {job.status}
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>{job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}</p>
              <p style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>RO: {job.id.slice(0, 8)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderInvoicePreview = () => {
    const activeItems = invoice ? invoiceItems : lineItems;
    const subtotal = invoice ? invoice.subtotal : activeItems.reduce((s, l) => s + (l.line_total || 0), 0);
    const tax = invoice ? invoice.tax : +(activeItems.filter(l => l.item_type === 'PART').reduce((s, l) => s + (l.line_total || 0), 0) * TAX_RATE).toFixed(2);
    const total = invoice ? invoice.total : +(subtotal + tax).toFixed(2);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#000000' }}>
        {/* Header */}
        <div style={{ padding: 24, borderBottom: '1px solid #1e293b', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', color: '#ffffff', letterSpacing: '-0.05em' }}>
              {invoice ? `Invoice #${invoice.id.slice(0, 8).toUpperCase()}` : 'Final Invoice Preview'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {selectedJob.customer?.name} • {selectedJob.vehicle?.year} {selectedJob.vehicle?.make}
            </p>
          </div>
          {onBack && (
            /* hover:text-white → dropped (cosmetic) */
            <button onClick={onBack} style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
        </div>

        {/* Invoice Body — lg:flex-row → always row; flagged: no breakpoint equivalent */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', flexDirection: 'row', gap: 32 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, overflow: 'hidden' }}>
              <div style={{ padding: 16, borderBottom: '1px solid #1e293b', backgroundColor: '#020617', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Approved Line Items</span>
                {!invoice && <span style={{ fontSize: 10, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12}/> Ready to Generate</span>}
              </div>
              <div>
                {activeItems.length === 0 ? (
                  <p style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 12 }}>No approved line items found.</p>
                ) : (
                  activeItems.map((item, idx) => (
                    /* hover:bg-slate-800/30 → dropped (cosmetic) */
                    <div key={idx} style={{ padding: 16, borderBottom: '1px solid rgba(30,41,59,0.50)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', backgroundColor: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: 4 }}>{item.item_type}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{item.description}</span>
                        </div>
                        {item.item_type === 'PART' && <p style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>PN: {item.part_number || 'N/A'} • Qty: {item.quantity}</p>}
                        {item.item_type === 'LABOR' && <p style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{item.labor_hours} hrs @ ${item.labor_rate}/hr</p>}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>${item.line_total?.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div style={{ padding: 24, backgroundColor: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, borderTop: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: 192, fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: 192, fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                  <span>Tax (Parts Only)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: 192, fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
                  <span>Total</span>
                  <span style={{ color: '#34d399' }}>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Panel — lg:w-80 → always 320px; flagged: no breakpoint equivalent */}
          <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!invoice ? (
               <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                 <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', marginBottom: 16 }}>Generate Snapshot</h3>
                 <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24, lineHeight: 1.6 }}>
                   Generating the invoice will create an immutable snapshot of all approved lines. This action cannot be reversed.
                 </p>
                 {/* hover:bg-blue-500 → dropped (cosmetic); disabled:opacity-50 → inline conditional */}
                 <button
                   onClick={generateInvoice}
                   disabled={processing || activeItems.length === 0}
                   style={{
                     width: '100%',
                     backgroundColor: (processing || activeItems.length === 0) ? '#1e293b' : '#2563eb',
                     color: (processing || activeItems.length === 0) ? '#475569' : '#ffffff',
                     opacity: 1,
                     fontWeight: 900,
                     padding: 16,
                     borderRadius: 16,
                     textTransform: 'uppercase',
                     letterSpacing: '0.1em',
                     fontSize: 10,
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: 8,
                     border: 'none',
                     cursor: (processing || activeItems.length === 0) ? 'not-allowed' : 'pointer',
                     transition: 'all 0.15s',
                   }}
                 >
                   {processing ? 'Generating...' : 'Generate Final Invoice'}
                 </button>
               </div>
            ) : invoice.status === 'open' ? (
               <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(59,130,246,0.30)', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px -12px rgba(30,58,138,0.20)' }}>
                 <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#60a5fa', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><CreditCard size={14} /> Process Payment</h3>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>Payment Method</label>
                      {/* grid grid-cols-3 → flex with equal flex children; hover:border-slate-600 → dropped */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['CARD', 'CASH', 'FINANCING'].map(method => (
                          <button
                            key={method}
                            onClick={() => setPaymentMethod(method)}
                            style={{
                              flex: 1,
                              padding: '12px 0',
                              borderRadius: 12,
                              fontSize: 10,
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                              transition: 'all 0.15s',
                              border: paymentMethod === method ? '1px solid #3b82f6' : '1px solid #1e293b',
                              backgroundColor: paymentMethod === method ? '#2563eb' : '#020617',
                              color: paymentMethod === method ? '#ffffff' : '#94a3b8',
                              cursor: 'pointer',
                            }}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>Mileage Out <span style={{ color: '#f87171' }}>*</span></label>
                      {/* focus:border-blue-500 → ign-input CSS class */}
                      <input
                        type="number"
                        value={mileageOut}
                        onChange={e => setMileageOut(e.target.value)}
                        placeholder="Current Odometer"
                        className="ign-input"
                        style={{ width: '100%', backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: 12, padding: 16, color: '#ffffff', fontWeight: 700, fontSize: 14, outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
                      />
                    </div>
                 </div>

                 {/* hover:bg-emerald-500 → dropped; disabled states → inline conditional */}
                 <button
                   onClick={processPaymentAndClose}
                   disabled={processing || !mileageOut}
                   style={{
                     width: '100%',
                     backgroundColor: (processing || !mileageOut) ? '#1e293b' : '#059669',
                     color: (processing || !mileageOut) ? '#64748b' : '#ffffff',
                     fontWeight: 900,
                     padding: 16,
                     borderRadius: 16,
                     textTransform: 'uppercase',
                     letterSpacing: '0.1em',
                     fontSize: 10,
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: 8,
                     border: 'none',
                     cursor: (processing || !mileageOut) ? 'not-allowed' : 'pointer',
                     transition: 'all 0.15s',
                   }}
                 >
                   {processing ? 'Processing...' : 'Process Payment & Close'}
                 </button>
               </div>
            ) : (
               <div style={{ backgroundColor: 'rgba(6,78,59,0.20)', border: '1px solid rgba(16,185,129,0.30)', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                 <CheckCircle2 size={48} style={{ color: '#34d399', marginBottom: 16 }} />
                 <h3 style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff', marginBottom: 4 }}>Invoice Paid</h3>
                 <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: 24 }}>Job Closed • {invoice.payment_method}</p>
                 {/* hover:bg-slate-700 → dropped; disabled:opacity-50 → inline conditional */}
                 <button
                   onClick={downloadPdf}
                   disabled={downloadingPdf}
                   style={{
                     width: '100%',
                     backgroundColor: downloadingPdf ? '#0f172a' : '#1e293b',
                     color: '#ffffff',
                     opacity: downloadingPdf ? 0.5 : 1,
                     fontWeight: 900,
                     padding: 16,
                     borderRadius: 16,
                     textTransform: 'uppercase',
                     letterSpacing: '0.1em',
                     fontSize: 10,
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: 8,
                     border: 'none',
                     cursor: downloadingPdf ? 'not-allowed' : 'pointer',
                     transition: 'all 0.15s',
                   }}
                 >
                   <Printer size={14}/> {downloadingPdf ? 'Generating...' : 'Download Invoice PDF'}
                 </button>
               </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: '#000000', overflow: 'hidden' }}>
      {renderJobSelector()}
      {selectedJob ? (
        renderInvoicePreview()
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', padding: 32, textAlign: 'center' }}>
          <Receipt size={64} style={{ marginBottom: 24, opacity: 0.2 }} />
          <h3 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8, color: '#64748b' }}>Invoice Generation</h3>
          <p style={{ fontSize: 14 }}>Select a job from the queue to generate an invoice or process payment.</p>
        </div>
      )}
    </div>
  );
}
