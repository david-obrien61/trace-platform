/**
 * MODULE: IgnitionEstimate (Web)
 * VERSION: v1.0.0
 * DESC: Service writer estimate review station.
 *       Reads jobs from Supabase, triggers the Railway estimate agent,
 *       shows editable line items, and sends the estimate to the customer.
 *
 * Views: QUEUE → REVIEW → SENT
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Zap, Send, Plus, Trash2, Edit3, Check, X,
  Car, User, AlertCircle, Loader2, ChevronRight, ArrowLeft,
  Wrench, Package, DollarSign, ReceiptText, RefreshCw, ClipboardCheck,
} from 'lucide-react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';
import CustomerApprovalPortal from './CustomerApprovalPortal';
import PriceField from '../PriceField';

// ─── constants ────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STATUS_BADGE = {
  eval_done:    { label: 'Awaiting Estimate', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  estimating:   { label: 'Building…',         color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  ready:        { label: 'Ready to Review',   color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  pending_auth: { label: 'Awaiting Customer', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

const ITEM_TYPE_META = {
  LABOR:  { label: 'Labor',      icon: Wrench,      color: 'text-blue-400' },
  PART:   { label: 'Part',       icon: Package,     color: 'text-emerald-400' },
  SUBLET: { label: 'Sublet',     icon: Car,         color: 'text-amber-400' },
  FEE:    { label: 'Fee',        icon: ReceiptText, color: 'text-slate-400' },
  MISC:   { label: 'Misc',       icon: FileText,    color: 'text-slate-500' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => n != null ? `$${Number(n).toFixed(2)}` : '—';

const SectionDivider = ({ children }) => (
  <div className="flex items-center gap-3 my-5">
    <div className="flex-1 h-px bg-slate-800" />
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{children}</span>
    <div className="flex-1 h-px bg-slate-800" />
  </div>
);

// ─── inline cell editor ───────────────────────────────────────────────────────

const EditableCell = ({ value, onSave, type = 'text', prefix }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value ?? '');

  const commit = () => {
    setEditing(false);
    const v = type === 'number' ? parseFloat(draft) || 0 : draft;
    if (v !== value) onSave(v);
  };

  if (!editing) return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      className="text-left hover:text-white transition-colors group flex items-center gap-1"
    >
      {prefix && <span className="text-slate-600">{prefix}</span>}
      <span>{value ?? '—'}</span>
      <Edit3 size={10} className="text-slate-700 group-hover:text-slate-500 flex-shrink-0" />
    </button>
  );

  return (
    <input
      autoFocus
      type={type === 'number' ? 'number' : 'text'}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className="bg-slate-800 border border-blue-500 rounded px-2 py-0.5 text-white text-xs w-full outline-none"
    />
  );
};

// ─── main component ───────────────────────────────────────────────────────────

export default function IgnitionEstimate() {
  const currentUser = DataBridge.load('current_user');
  const shopId      = currentUser?.shop_id || DataBridge.load('shop_info')?.id;
  const shopPolicy  = DataBridge.load('shop_policy') || {};

  const laborRate     = shopPolicy.labor_rate     || 125;
  // HONEST DEBT 🔴 (D): markupPercent is a flat-percent fallback; retire after migrating to
  //   shared MarginEngine slab model. Migration checklist: docs/audits/margin-engine-migration-checklist-2026-06-10.md
  const markupPercent = shopPolicy.markup_percent || 40;
  const taxRate       = shopPolicy.tax_rate       || 0.0825;

  const [view, setView]               = useState('QUEUE');
  const [jobs, setJobs]               = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [estimate, setEstimate]       = useState(null);
  const [lineItems, setLineItems]     = useState([]);
  const [building, setBuilding]       = useState(false);
  const [sending, setSending]         = useState(false);
  const [addingRow, setAddingRow]     = useState(false);
  const [newRow, setNewRow]           = useState({ item_type: 'LABOR', description: '', labor_hours: '', unit_price: '', quantity: 1 });
  const [error, setError]             = useState('');
  const [savingIds, setSavingIds]     = useState(new Set());
  const [portalOpen, setPortalOpen]   = useState(false);

  // ── load job queue ─────────────────────────────────────────────────────────

  const loadQueue = useCallback(async () => {
    if (!shopId) return;
    setLoadingQueue(true);
    const { data } = await supabase.from('jobs').select('*')
      .eq('shop_id', shopId)
      .in('status', ['eval_done', 'estimating', 'ready', 'pending_auth'])
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoadingQueue(false);
  }, [shopId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // ── open a job for review ──────────────────────────────────────────────────

  const openJob = async (job) => {
    setSelectedJob(job);
    setError('');
    setEstimate(null);
    setLineItems([]);
    setView('REVIEW');

    // Load estimate for this job
    const { data: ests } = await supabase.from('estimates').select('*')
      .eq('job_id', job.id)
      .not('status', 'eq', 'voided')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ests?.length) {
      const est = ests[0];
      setEstimate(est);
      if (est.status !== 'building') {
        await loadLineItems(est.id);
      }
    }
  };

  const loadLineItems = async (estimateId) => {
    const { data } = await supabase.from('estimate_line_items').select('*')
      .eq('estimate_id', estimateId)
      .order('sort_order');
    setLineItems(data || []);
  };

  // ── trigger estimate agent ─────────────────────────────────────────────────

  const buildEstimate = async () => {
    setBuilding(true);
    setError('');

    try {
      // Create the estimate row if it doesn't exist
      let est = estimate;
      if (!est) {
        // Find the most recent submitted evaluation
        const { data: evals } = await supabase.from('evaluations').select('id')
          .eq('job_id', selectedJob.id).eq('status', 'submitted')
          .order('created_at', { ascending: false }).limit(1);

        const evalId = evals?.[0]?.id || null;

        const { data: newEst, error: insErr } = await supabase.from('estimates').insert({
          job_id:        selectedJob.id,
          shop_id:       shopId,
          evaluation_id: evalId,
          status:        'building',
        }).select().single();

        if (insErr) throw insErr;
        est = newEst;
        setEstimate(est);
      } else {
        // Reset existing estimate
        await supabase.from('estimates').update({ status: 'building' }).eq('id', est.id);
        await supabase.from('estimate_line_items').delete().eq('estimate_id', est.id);
        setLineItems([]);
      }

      // Call Railway agent
      const res = await fetch(`${API_URL}/api/estimate/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimate_id:    est.id,
          shop_id:        shopId,
          labor_rate:     laborRate,
          markup_percent: markupPercent,
          tax_rate:       taxRate,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Agent returned ${res.status}`);
      }

      const result = await res.json();

      // Refresh estimate + line items from Supabase (source of truth)
      const { data: fresh } = await supabase.from('estimates').select('*').eq('id', est.id).single();
      setEstimate(fresh);
      setLineItems(result.line_items || []);

      // Update job status in local list
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'estimating' } : j));
      setSelectedJob(prev => ({ ...prev, status: 'estimating' }));

    } catch (err) {
      setError(err.message || 'Estimate agent failed. Check Railway logs.');
      // Revert estimate status
      if (estimate?.id) {
        await supabase.from('estimates').update({ status: 'building' }).eq('id', estimate.id);
      }
    } finally {
      setBuilding(false);
    }
  };

  // ── line item editing ──────────────────────────────────────────────────────

  const markSaving = (id, on) => setSavingIds(prev => {
    const next = new Set(prev);
    on ? next.add(id) : next.delete(id);
    return next;
  });

  const updateLineItem = async (id, field, value) => {
    markSaving(id, true);
    const item = lineItems.find(l => l.id === id);
    const updates = { [field]: value };

    // Recalculate line_total on price/hours change
    if (field === 'labor_hours' || field === 'unit_price' || field === 'quantity') {
      const hours   = field === 'labor_hours' ? value : item.labor_hours;
      const price   = field === 'unit_price'  ? value : item.unit_price;
      const qty     = field === 'quantity'    ? value : item.quantity;
      if (item.item_type === 'LABOR' && hours) {
        updates.line_total = +(hours * laborRate).toFixed(2);
        updates.unit_price = laborRate;
      } else if (price && qty) {
        updates.line_total = +(price * qty).toFixed(2);
      }
    }

    setLineItems(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    await supabase.from('estimate_line_items').update(updates).eq('id', id);
    await syncTotals(id, updates);
    markSaving(id, false);
  };

  const handlePriceOverride = async (id, { finalPrice, isOverride, suggestedPrice, leakage }) => {
    markSaving(id, true);
    const item = lineItems.find(l => l.id === id);
    const qty = item?.quantity || 1;
    const newTotal = +(finalPrice * qty).toFixed(2);
    const updates = {
      unit_price:                  finalPrice,
      line_total:                  newTotal,
      is_manual_override:          isOverride,
      original_calculated_price:   suggestedPrice,
      price_leakage:               isOverride ? leakage : 0,
    };
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    const { error: upErr } = await supabase.from('estimate_line_items').update(updates).eq('id', id);
    if (upErr) console.error('[PriceOverride] Supabase write failed:', upErr);
    await syncTotals(id, updates);
    markSaving(id, false);
  };

  const deleteLineItem = async (id) => {
    setLineItems(prev => prev.filter(l => l.id !== id));
    await supabase.from('estimate_line_items').delete().eq('id', id);
    await syncTotals();
  };

  const syncTotals = async (changedId, changedUpdates) => {
    // Recalculate totals from current lineItems state
    const current = lineItems.map(l =>
      l.id === changedId ? { ...l, ...changedUpdates } : l
    );
    const partsTotal = current.filter(l => l.item_type === 'PART').reduce((s, l) => s + (l.line_total || 0), 0);
    const sub = current.reduce((s, l) => s + (l.line_total || 0), 0);
    const tax = +(partsTotal * taxRate).toFixed(2);
    const total = +(sub + tax).toFixed(2);

    if (estimate?.id) {
      await supabase.from('estimates').update({
        subtotal: +sub.toFixed(2), tax, total,
      }).eq('id', estimate.id);
      setEstimate(prev => prev ? { ...prev, subtotal: +sub.toFixed(2), tax, total } : prev);
    }
  };

  // ── add manual line item ───────────────────────────────────────────────────

  const commitNewRow = async () => {
    if (!newRow.description.trim()) return;
    if (!estimate?.id) return;

    const qty    = parseFloat(newRow.quantity) || 1;
    const hours  = newRow.item_type === 'LABOR' ? parseFloat(newRow.labor_hours) || null : null;
    const price  = newRow.item_type !== 'LABOR' ? parseFloat(newRow.unit_price) || null : laborRate;
    const total  = hours
      ? +(hours * laborRate).toFixed(2)
      : price ? +(price * qty).toFixed(2) : 0;

    const row = {
      estimate_id:  estimate.id,
      job_id:       selectedJob.id,
      shop_id:      shopId,
      item_type:    newRow.item_type,
      description:  newRow.description.trim(),
      quantity:     qty,
      labor_hours:  hours,
      labor_rate:   hours ? laborRate : null,
      unit_price:   price,
      line_total:   total,
      auth_status:  'pending',
      sort_order:   lineItems.length,
    };

    const { data } = await supabase.from('estimate_line_items').insert(row).select().single();
    if (data) setLineItems(prev => [...prev, data]);
    setNewRow({ item_type: 'LABOR', description: '', labor_hours: '', unit_price: '', quantity: 1 });
    setAddingRow(false);
    await syncTotals();
  };

  // ── handle customer authorization callback ────────────────────────────────

  const handleAuthorized = async () => {
    setPortalOpen(false);
    // Re-fetch estimate + line items to reflect updated auth_status values
    if (estimate?.id) {
      const { data: fresh } = await supabase.from('estimates').select('*').eq('id', estimate.id).single();
      if (fresh) setEstimate(fresh);
      
      const { data: freshItems } = await supabase.from('estimate_line_items').select('*')
        .eq('estimate_id', estimate.id)
        .order('sort_order');
        
      if (freshItems) {
        setLineItems(freshItems);
        
        // Parts Sourcing Trigger (moved to backend)
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        try {
          await fetch(`${apiUrl}/api/jobs/${selectedJob?.id}/generate-pos`, {
            method: 'POST'
          });
          console.log('[PROC] Auto-PO generation triggered.');
        } catch (e) {
          console.error('[PROC] Auto-PO error:', e);
        }
      }
    }
    
    if (selectedJob?.id) {
      const { data: freshJob } = await supabase.from('jobs').select('*').eq('id', selectedJob.id).single();
      if (freshJob) {
        setSelectedJob(freshJob);
        setJobs(prev => prev.map(j => j.id === freshJob.id ? freshJob : j));
      }
    }
    setView('AUTHORIZED');
  };

  // ── send estimate to customer ──────────────────────────────────────────────

  const sendToCustomer = async () => {
    setSending(true);
    await supabase.from('estimates').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', estimate.id);
    await supabase.from('jobs').update({ status: 'pending_auth' }).eq('id', selectedJob.id);
    setEstimate(prev => ({ ...prev, status: 'sent' }));
    setSelectedJob(prev => ({ ...prev, status: 'pending_auth' }));
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'pending_auth' } : j));
    setSending(false);
    setView('SENT');
  };

  // ─── derived totals from current lineItems ────────────────────────────────
  const partsTotal = lineItems.filter(l => l.item_type === 'PART').reduce((s, l) => s + (l.line_total || 0), 0);
  const subtotal   = lineItems.reduce((s, l) => s + (l.line_total || 0), 0);
  const tax        = +(partsTotal * taxRate).toFixed(2);
  const total      = +(subtotal + tax).toFixed(2);

  const groupedItems = {
    LABOR:  lineItems.filter(l => l.item_type === 'LABOR'),
    PART:   lineItems.filter(l => l.item_type === 'PART'),
    SUBLET: lineItems.filter(l => l.item_type === 'SUBLET'),
    FEE:    lineItems.filter(l => l.item_type === 'FEE'),
    MISC:   lineItems.filter(l => l.item_type === 'MISC'),
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: QUEUE
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'QUEUE') return (
    <div className="min-h-screen bg-slate-950 p-6 pb-32">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">Estimate Queue</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Service Writer // Zone 3 Entry</p>
          </div>
          <button onClick={loadQueue} className="p-2 text-slate-500 hover:text-white transition-colors">
            <RefreshCw size={16} className={loadingQueue ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl px-4 py-3 mb-6 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loadingQueue && (
          <div className="flex justify-center py-20">
            <Loader2 size={24} className="text-blue-500 animate-spin" />
          </div>
        )}

        {!loadingQueue && jobs.length === 0 && (
          <div className="text-center py-20 text-slate-600">
            <FileText size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-black uppercase tracking-widest text-sm">No jobs awaiting estimates</p>
            <p className="text-xs mt-2">Jobs move here after tech submits evaluation</p>
          </div>
        )}

        <div className="space-y-4">
          {jobs.map(job => {
            const badge = STATUS_BADGE[job.status] || { label: job.status, color: 'bg-slate-800 text-slate-400 border-slate-700' };
            const cust  = job.customer || {};
            const veh   = job.vehicle  || {};
            return (
              <div
                key={job.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all cursor-pointer group"
                onClick={() => openJob(job)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600">{job.wo_number || job.id?.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <User size={12} className="text-slate-500 flex-shrink-0" />
                      <span className="text-white font-bold text-sm truncate">{cust.name || 'Unknown Customer'}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Car size={12} className="text-slate-500 flex-shrink-0" />
                      <span className="text-slate-400 text-xs">{[veh.year, veh.make, veh.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}</span>
                    </div>
                    {job.complaint && (
                      <p className="text-slate-600 text-xs truncate flex items-center gap-1">
                        <AlertCircle size={10} className="text-amber-500/60 flex-shrink-0" />
                        {job.complaint}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: SENT CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'SENT') return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-10 text-center shadow-2xl shadow-emerald-900/10">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Send size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">Estimate Sent</h2>
        <p className="text-slate-500 text-xs mb-2">
          {selectedJob?.customer?.name || 'Customer'} has been notified.
        </p>
        <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-8">Status: Awaiting Authorization</p>
        <button
          onClick={() => { setView('QUEUE'); loadQueue(); }}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all"
        >
          Back to Queue
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: AUTHORIZED CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'AUTHORIZED') return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-slate-900 border border-blue-500/30 rounded-3xl p-10 text-center shadow-2xl shadow-blue-900/10">
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ClipboardCheck size={28} className="text-blue-400" />
        </div>
        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">Authorized</h2>
        <p className="text-slate-500 text-xs mb-2">
          {selectedJob?.customer?.name || 'Customer'} has authorized the repair.
        </p>
        <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-8">Job Status: Authorized</p>
        <button
          onClick={() => { setView('QUEUE'); loadQueue(); }}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[10px] transition-all"
        >
          Back to Queue
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: REVIEW
  // ─────────────────────────────────────────────────────────────────────────

  const canSend = estimate && lineItems.length > 0 &&
    ['ready', 'building'].includes(estimate.status) &&
    !building;

  const isSent = estimate?.status === 'sent' || selectedJob?.status === 'pending_auth';

  const cust = selectedJob?.customer || {};
  const veh  = selectedJob?.vehicle  || {};

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      <div className="max-w-3xl mx-auto p-6">

        {/* Back + title */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setView('QUEUE')} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black italic text-white uppercase tracking-tighter">Estimate Review</h1>
            <p className="text-[9px] font-mono text-slate-500">
              {selectedJob?.wo_number || selectedJob?.id?.slice(0, 8)} // {currentUser?.name}
            </p>
          </div>
          {estimate && (
            <span className={`ml-auto text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
              STATUS_BADGE[estimate.status]?.color || 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {STATUS_BADGE[estimate.status]?.label || estimate.status}
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs font-bold flex-1">{error}</p>
            <button onClick={() => setError('')}><X size={14} className="text-red-500" /></button>
          </div>
        )}

        {/* Job summary card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Customer</p>
            <p className="text-white font-bold text-sm">{cust.name || '—'}</p>
            <p className="text-slate-500 text-xs">{cust.phone || ''}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Vehicle</p>
            <p className="text-white font-bold text-sm">
              {[veh.year, veh.make, veh.model].filter(Boolean).join(' ') || '—'}
            </p>
            {veh.vin && <p className="text-slate-500 text-xs font-mono">…{veh.vin.slice(-6)}</p>}
          </div>
          {selectedJob?.complaint && (
            <div className="col-span-2 border-t border-slate-800 pt-3">
              <p className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest mb-1">Complaint</p>
              <p className="text-slate-300 text-xs">{selectedJob.complaint}</p>
            </div>
          )}
        </div>

        {/* Build trigger — shown when no estimate yet OR estimate failed */}
        {(!estimate || estimate.status === 'building') && !building && (
          <button
            onClick={buildEstimate}
            className="w-full mb-6 bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
          >
            <Zap size={16} /> Build Estimate with AI
          </button>
        )}

        {building && (
          <div className="w-full mb-6 bg-slate-900 border border-blue-500/30 rounded-2xl py-5 flex items-center justify-center gap-3">
            <Loader2 size={16} className="text-blue-400 animate-spin" />
            <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest">Agent running…</span>
          </div>
        )}

        {/* Rebuild button — shown when estimate already exists and not sent */}
        {estimate && estimate.status !== 'building' && !isSent && !building && (
          <button
            onClick={buildEstimate}
            className="w-full mb-4 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-400 text-[9px] font-black uppercase tracking-widest py-2 transition-colors"
          >
            <RefreshCw size={11} /> Rebuild with AI
          </button>
        )}

        {/* Line items */}
        {lineItems.length > 0 && (
          <>
            {['LABOR', 'PART', 'SUBLET', 'FEE', 'MISC'].map(type => {
              const items = groupedItems[type];
              if (!items.length) return null;
              const meta = ITEM_TYPE_META[type];
              const Icon = meta.icon;
              return (
                <div key={type} className="mb-2">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Icon size={12} className={meta.color} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4">
                    {items.map(item => (
                      type === 'PART' ? (
                        <div key={item.id} className="border-b border-slate-800 last:border-0">
                          <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-900/50 group">
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-sm font-semibold mb-0.5">
                                {isSent ? item.description : (
                                  <EditableCell
                                    value={item.description}
                                    onSave={v => updateLineItem(item.id, 'description', v)}
                                  />
                                )}
                              </div>
                              {item.part_number && (
                                <p className="text-slate-600 text-[10px] font-mono">#{item.part_number}</p>
                              )}
                              {item.notes && (
                                <p className="text-slate-600 text-[10px] italic mt-0.5">{item.notes}</p>
                              )}
                            </div>
                            <div className="w-16 text-right flex-shrink-0">
                              <div className="text-slate-400 text-xs">
                                {isSent ? `×${item.quantity}` : (
                                  <EditableCell
                                    value={item.quantity}
                                    type="number"
                                    onSave={v => updateLineItem(item.id, 'quantity', v)}
                                  />
                                )}
                              </div>
                            </div>
                            <div className="w-20 text-right flex-shrink-0">
                              <span className="text-white font-bold text-sm">{fmt(item.line_total)}</span>
                              {savingIds.has(item.id) && <Loader2 size={10} className="text-blue-400 animate-spin inline ml-1" />}
                              {item.is_manual_override && (
                                <span className="text-[8px] font-black text-orange-500 uppercase block mt-0.5">Override</span>
                              )}
                            </div>
                            {!isSent && (
                              <button
                                onClick={() => deleteLineItem(item.id)}
                                className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <div className="px-4 pb-4">
                            {!isSent ? (
                              <PriceField
                                cost={item.unit_cost || 0}
                                initialPrice={item.unit_price}
                                onUpdate={d => handlePriceOverride(item.id, d)}
                              />
                            ) : item.unit_price != null && (
                              <div className="flex items-center gap-2 pb-1">
                                <span className="text-slate-500 text-[10px]">{fmt(item.unit_price)}/ea</span>
                                {item.is_manual_override && (
                                  <span className="text-[8px] font-black text-orange-500/70 uppercase px-1.5 py-0.5 rounded border border-orange-500/20">Relationship Tax</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-800 last:border-0 hover:bg-slate-900/50 group">
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-sm font-semibold mb-0.5">
                              {isSent ? item.description : (
                                <EditableCell
                                  value={item.description}
                                  onSave={v => updateLineItem(item.id, 'description', v)}
                                />
                              )}
                            </div>
                            {item.part_number && (
                              <p className="text-slate-600 text-[10px] font-mono">#{item.part_number}</p>
                            )}
                            {item.notes && (
                              <p className="text-slate-600 text-[10px] italic mt-0.5">{item.notes}</p>
                            )}
                          </div>
                          <div className="w-16 text-right flex-shrink-0">
                            {item.item_type === 'LABOR' ? (
                              <div className="text-slate-400 text-xs">
                                {isSent ? `${item.labor_hours}h` : (
                                  <EditableCell
                                    value={item.labor_hours}
                                    type="number"
                                    onSave={v => updateLineItem(item.id, 'labor_hours', v)}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="text-slate-400 text-xs">
                                {isSent ? `×${item.quantity}` : (
                                  <EditableCell
                                    value={item.quantity}
                                    type="number"
                                    onSave={v => updateLineItem(item.id, 'quantity', v)}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="w-20 text-right flex-shrink-0">
                            <div className="text-slate-400 text-xs">
                              {isSent ? fmt(item.unit_price) : (
                                <EditableCell
                                  value={item.unit_price != null ? +item.unit_price.toFixed(2) : null}
                                  type="number"
                                  onSave={v => updateLineItem(item.id, 'unit_price', v)}
                                />
                              )}
                            </div>
                          </div>
                          <div className="w-20 text-right flex-shrink-0">
                            <span className="text-white font-bold text-sm">{fmt(item.line_total)}</span>
                            {savingIds.has(item.id) && <Loader2 size={10} className="text-blue-400 animate-spin inline ml-1" />}
                          </div>
                          {!isSent && (
                            <button
                              onClick={() => deleteLineItem(item.id)}
                              className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add line item */}
            {!isSent && (
              <div className="mb-6">
                {!addingRow ? (
                  <button
                    onClick={() => setAddingRow(true)}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-slate-500 text-slate-600 hover:text-slate-400 font-black py-3 rounded-xl uppercase tracking-widest text-[9px] transition-all"
                  >
                    <Plus size={12} /> Add Line Item
                  </button>
                ) : (
                  <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3">
                    <div className="flex gap-3">
                      <select
                        value={newRow.item_type}
                        onChange={e => setNewRow(p => ({ ...p, item_type: e.target.value }))}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-bold outline-none"
                      >
                        {Object.keys(ITEM_TYPE_META).map(t => (
                          <option key={t} value={t}>{ITEM_TYPE_META[t].label}</option>
                        ))}
                      </select>
                      <input
                        autoFocus
                        placeholder="Description"
                        value={newRow.description}
                        onChange={e => setNewRow(p => ({ ...p, description: e.target.value }))}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex gap-3">
                      {newRow.item_type === 'LABOR' ? (
                        <input
                          type="number"
                          placeholder="Labor hours"
                          value={newRow.labor_hours}
                          onChange={e => setNewRow(p => ({ ...p, labor_hours: e.target.value }))}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                        />
                      ) : (
                        <>
                          <input
                            type="number"
                            placeholder="Qty"
                            value={newRow.quantity}
                            onChange={e => setNewRow(p => ({ ...p, quantity: e.target.value }))}
                            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                          />
                          <input
                            type="number"
                            placeholder="Unit price"
                            value={newRow.unit_price}
                            onChange={e => setNewRow(p => ({ ...p, unit_price: e.target.value }))}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                          />
                        </>
                      )}
                      <button onClick={commitNewRow} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setAddingRow(false)} className="text-slate-600 hover:text-slate-400 px-2 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>Labor</span>
                  <span>{fmt(groupedItems.LABOR.reduce((s, l) => s + (l.line_total || 0), 0))}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Parts</span>
                  <span>{fmt(partsTotal)}</span>
                </div>
                {(groupedItems.FEE.length + groupedItems.SUBLET.length + groupedItems.MISC.length) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Fees / Other</span>
                    <span>{fmt([...groupedItems.FEE, ...groupedItems.SUBLET, ...groupedItems.MISC].reduce((s, l) => s + (l.line_total || 0), 0))}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 text-xs">
                  <span>Tax ({(taxRate * 100).toFixed(2)}% on parts)</span>
                  <span>{fmt(tax)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                <span className="text-white font-black text-lg uppercase tracking-wider">Total</span>
                <span className="text-emerald-400 font-black text-2xl">{fmt(total)}</span>
              </div>
            </div>

            {/* Agent notes */}
            {estimate?.agent_notes && (
              <p className="text-slate-700 text-[9px] font-mono mb-6 text-center">{estimate.agent_notes}</p>
            )}

            {/* Send to customer / Open portal */}
            {!isSent ? (
              <button
                onClick={sendToCustomer}
                disabled={sending || !canSend}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? 'Sending…' : 'Send to Customer'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="w-full bg-slate-900 border border-emerald-500/30 rounded-2xl py-3 flex items-center justify-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-widest">
                  <Check size={14} /> Estimate Sent — Awaiting Authorization
                </div>
                <button
                  onClick={() => setPortalOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-900/30"
                >
                  <ClipboardCheck size={16} /> Open Customer Authorization Portal
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state — estimate exists but no line items yet */}
        {estimate && lineItems.length === 0 && !building && estimate.status !== 'building' && (
          <div className="text-center py-12 text-slate-600">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-xs font-black uppercase tracking-widest">No line items yet</p>
            <p className="text-[10px] mt-1">Click "Build Estimate with AI" to generate them</p>
          </div>
        )}

      </div>

      {/* Customer Authorization Portal — fullscreen overlay */}
      {portalOpen && estimate?.id && selectedJob?.id && (
        <div className="fixed inset-0 z-50">
          <CustomerApprovalPortal
            estimateId={estimate.id}
            jobId={selectedJob.id}
            shopId={shopId}
            onAuthorized={handleAuthorized}
            onClose={() => setPortalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
