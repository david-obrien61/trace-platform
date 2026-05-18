import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';
import { Receipt, CreditCard, Banknote, Building2, CheckCircle2, ChevronLeft, ArrowRight, Printer } from 'lucide-react';

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
    // For pilot, we fetch 'authorized', 'in_repair', 'repair_done', and 'invoiced' jobs
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
    
    // Check if an invoice already exists for this job
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

    // No invoice yet, load the authorized estimate
    const { data: estData } = await supabase
      .from('estimates')
      .select('*')
      .eq('job_id', job.id)
      .in('status', ['authorized', 'sent', 'ready']) // Fallback statuses just in case
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (estData) {
      setEstimate(estData);
      // Load only approved items
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

    // Create Invoice
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

    // Clone line items to invoice_line_items
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

    // Update job status
    await supabase.from('jobs').update({ status: 'invoiced' }).eq('id', selectedJob.id);

    // Refresh state
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

    // Update Invoice to paid
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        payment_method: paymentMethod,
        paid_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    // Update Job to closed
    await supabase
      .from('jobs')
      .update({
        status: 'closed',
        mileage_out: parseInt(mileageOut, 10)
      })
      .eq('id', selectedJob.id);

    // Refresh everything
    setInvoice(prev => ({ ...prev, status: 'paid', payment_method: paymentMethod }));
    setJobs(prev => prev.filter(j => j.id !== selectedJob.id)); // Remove from list since it's closed
    setSelectedJob(null);
    setProcessing(false);
  };

  const renderJobSelector = () => (
    <div className="w-1/3 border-r border-slate-800 bg-slate-900/50 flex flex-col h-full">
      <div className="p-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Invoicing</h2>
        <Receipt className="text-blue-500" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-500 uppercase tracking-widest p-4 text-center">Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <p className="text-xs text-slate-500 uppercase tracking-widest p-4 text-center">No jobs ready for invoice</p>
        ) : (
          jobs.map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedJob?.id === job.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-600'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-white font-black uppercase text-sm">{job.customer?.name || 'Unknown Customer'}</p>
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${job.status === 'invoiced' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                  {job.status}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-bold">{job.vehicle?.year} {job.vehicle?.make} {job.vehicle?.model}</p>
              <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-2">RO: {job.id.slice(0, 8)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderInvoicePreview = () => {
    // Determine the source of items (either existing invoice or approved estimate)
    const activeItems = invoice ? invoiceItems : lineItems;
    const subtotal = invoice ? invoice.subtotal : activeItems.reduce((s, l) => s + (l.line_total || 0), 0);
    const tax = invoice ? invoice.tax : +(activeItems.filter(l => l.item_type === 'PART').reduce((s, l) => s + (l.line_total || 0), 0) * TAX_RATE).toFixed(2);
    const total = invoice ? invoice.total : +(subtotal + tax).toFixed(2);

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-black">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
              {invoice ? `Invoice #${invoice.id.slice(0, 8).toUpperCase()}` : 'Final Invoice Preview'}
            </h2>
            <p className="text-slate-400 text-xs font-bold mt-1">
              {selectedJob.customer?.name} • {selectedJob.vehicle?.year} {selectedJob.vehicle?.make}
            </p>
          </div>
          {onBack && (
            <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-800 px-4 py-2 rounded-xl">
              <ChevronLeft size={14} /> Back
            </button>
          )}
        </div>

        {/* Invoice Body */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Approved Line Items</span>
                {!invoice && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12}/> Ready to Generate</span>}
              </div>
              <div className="p-0">
                {activeItems.length === 0 ? (
                  <p className="p-6 text-center text-slate-500 text-xs">No approved line items found.</p>
                ) : (
                  activeItems.map((item, idx) => (
                    <div key={idx} className="p-4 border-b border-slate-800/50 flex justify-between items-start hover:bg-slate-800/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{item.item_type}</span>
                          <span className="text-sm font-bold text-slate-200">{item.description}</span>
                        </div>
                        {item.item_type === 'PART' && <p className="text-[10px] text-slate-500 font-mono">PN: {item.part_number || 'N/A'} • Qty: {item.quantity}</p>}
                        {item.item_type === 'LABOR' && <p className="text-[10px] text-slate-500 font-mono">{item.labor_hours} hrs @ ${item.labor_rate}/hr</p>}
                      </div>
                      <span className="text-sm font-black text-white">${item.line_total?.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
              
              {/* Totals */}
              <div className="p-6 bg-slate-950 flex flex-col items-end gap-2 border-t border-slate-800">
                <div className="flex justify-between w-48 text-sm font-bold text-slate-400">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-sm font-bold text-slate-400">
                  <span>Tax (Parts Only)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between w-48 text-xl font-black text-white mt-2 pt-2 border-t border-slate-800">
                  <span>Total</span>
                  <span className="text-emerald-400">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="w-full lg:w-80 space-y-4">
            {!invoice ? (
               <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Generate Snapshot</h3>
                 <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                   Generating the invoice will create an immutable snapshot of all approved lines. This action cannot be reversed.
                 </p>
                 <button
                   onClick={generateInvoice}
                   disabled={processing || activeItems.length === 0}
                   className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2"
                 >
                   {processing ? 'Generating...' : 'Generate Final Invoice'}
                 </button>
               </div>
            ) : invoice.status === 'open' ? (
               <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 shadow-2xl shadow-blue-900/20">
                 <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2"><CreditCard size={14} /> Process Payment</h3>
                 
                 <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Payment Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['CARD', 'CASH', 'FINANCING'].map(method => (
                          <button
                            key={method}
                            onClick={() => setPaymentMethod(method)}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${paymentMethod === method ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Mileage Out <span className="text-red-400">*</span></label>
                      <input 
                        type="number"
                        value={mileageOut}
                        onChange={e => setMileageOut(e.target.value)}
                        placeholder="Current Odometer"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                 </div>

                 <button
                   onClick={processPaymentAndClose}
                   disabled={processing || !mileageOut}
                   className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2"
                 >
                   {processing ? 'Processing...' : 'Process Payment & Close'}
                 </button>
               </div>
            ) : (
               <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
                 <CheckCircle2 size={48} className="text-emerald-400 mb-4" />
                 <h3 className="text-lg font-black italic uppercase tracking-tighter text-white mb-1">Invoice Paid</h3>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Job Closed • {invoice.payment_method}</p>
                 <button
                   onClick={downloadPdf}
                   disabled={downloadingPdf}
                   className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors flex items-center justify-center gap-2"
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
    <div className="flex h-full w-full bg-black overflow-hidden">
      {renderJobSelector()}
      {selectedJob ? (
        renderInvoicePreview()
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8 text-center">
          <Receipt size={64} className="mb-6 opacity-20" />
          <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-slate-500">Invoice Generation</h3>
          <p className="text-sm">Select a job from the queue to generate an invoice or process payment.</p>
        </div>
      )}
    </div>
  );
}
