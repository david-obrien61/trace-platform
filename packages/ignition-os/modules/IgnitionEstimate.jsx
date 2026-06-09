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

const STYLE_DEBUG = true;

// ─── constants ────────────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// NON-1:1: STATUS_BADGE.color was a Tailwind class string → refactored to bg/color/border hex values
const STATUS_BADGE = {
  eval_done:    { label: 'Awaiting Estimate', bg: 'rgba(245,158,11,0.2)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)'  },
  estimating:   { label: 'Building…',         bg: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  ready:        { label: 'Ready to Review',   bg: 'rgba(16,185,129,0.2)', color: '#34d399', border: 'rgba(16,185,129,0.3)' },
  pending_auth: { label: 'Awaiting Customer', bg: 'rgba(168,85,247,0.2)', color: '#c084fc', border: 'rgba(168,85,247,0.3)' },
};

// NON-1:1: ITEM_TYPE_META.color was 'text-blue-400' etc. → refactored to hex values
const ITEM_TYPE_META = {
  LABOR:  { label: 'Labor',  icon: Wrench,      color: '#60a5fa' },
  PART:   { label: 'Part',   icon: Package,     color: '#34d399' },
  SUBLET: { label: 'Sublet', icon: Car,         color: '#fbbf24' },
  FEE:    { label: 'Fee',    icon: ReceiptText, color: '#94a3b8' },
  MISC:   { label: 'Misc',   icon: FileText,    color: '#64748b' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => n != null ? `$${Number(n).toFixed(2)}` : '—';

const SectionDivider = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
    <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
    <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569' }}>{children}</span>
    <div style={{ flex: 1, height: '1px', background: '#1e293b' }} />
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
      style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
    >
      {prefix && <span style={{ color: '#475569' }}>{prefix}</span>}
      <span>{value ?? '—'}</span>
      <Edit3 size={10} style={{ color: '#334155', flexShrink: 0 }} />
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
      className="ign-input"
      style={{ background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '4px', padding: '2px 8px', color: '#ffffff', fontSize: '12px', width: '100%', outline: 'none' }}
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

  const openJob = async (job) => {
    setSelectedJob(job);
    setError('');
    setEstimate(null);
    setLineItems([]);
    setView('REVIEW');
    const { data: ests } = await supabase.from('estimates').select('*')
      .eq('job_id', job.id)
      .not('status', 'eq', 'voided')
      .order('created_at', { ascending: false })
      .limit(1);
    if (ests?.length) {
      const est = ests[0];
      setEstimate(est);
      if (est.status !== 'building') { await loadLineItems(est.id); }
    }
  };

  const loadLineItems = async (estimateId) => {
    const { data } = await supabase.from('estimate_line_items').select('*')
      .eq('estimate_id', estimateId).order('sort_order');
    setLineItems(data || []);
  };

  const buildEstimate = async () => {
    setBuilding(true); setError('');
    try {
      let est = estimate;
      if (!est) {
        const { data: evals } = await supabase.from('evaluations').select('id')
          .eq('job_id', selectedJob.id).eq('status', 'submitted')
          .order('created_at', { ascending: false }).limit(1);
        const evalId = evals?.[0]?.id || null;
        const { data: newEst, error: insErr } = await supabase.from('estimates').insert({
          job_id: selectedJob.id, shop_id: shopId, evaluation_id: evalId, status: 'building',
        }).select().single();
        if (insErr) throw insErr;
        est = newEst; setEstimate(est);
      } else {
        await supabase.from('estimates').update({ status: 'building' }).eq('id', est.id);
        await supabase.from('estimate_line_items').delete().eq('estimate_id', est.id);
        setLineItems([]);
      }
      const res = await fetch(`${API_URL}/api/estimate/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimate_id: est.id, shop_id: shopId, labor_rate: laborRate, markup_percent: markupPercent, tax_rate: taxRate }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.detail || `Agent returned ${res.status}`); }
      const result = await res.json();
      const { data: fresh } = await supabase.from('estimates').select('*').eq('id', est.id).single();
      setEstimate(fresh); setLineItems(result.line_items || []);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'estimating' } : j));
      setSelectedJob(prev => ({ ...prev, status: 'estimating' }));
    } catch (err) {
      setError(err.message || 'Estimate agent failed. Check Railway logs.');
      if (estimate?.id) { await supabase.from('estimates').update({ status: 'building' }).eq('id', estimate.id); }
    } finally { setBuilding(false); }
  };

  const markSaving = (id, on) => setSavingIds(prev => { const next = new Set(prev); on ? next.add(id) : next.delete(id); return next; });

  const updateLineItem = async (id, field, value) => {
    markSaving(id, true);
    const item = lineItems.find(l => l.id === id);
    const updates = { [field]: value };
    if (field === 'labor_hours' || field === 'unit_price' || field === 'quantity') {
      const hours = field === 'labor_hours' ? value : item.labor_hours;
      const price = field === 'unit_price'  ? value : item.unit_price;
      const qty   = field === 'quantity'    ? value : item.quantity;
      if (item.item_type === 'LABOR' && hours) { updates.line_total = +(hours * laborRate).toFixed(2); updates.unit_price = laborRate; }
      else if (price && qty) { updates.line_total = +(price * qty).toFixed(2); }
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
    const updates = { unit_price: finalPrice, line_total: newTotal, is_manual_override: isOverride, original_calculated_price: suggestedPrice, price_leakage: isOverride ? leakage : 0 };
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
    const current = lineItems.map(l => l.id === changedId ? { ...l, ...changedUpdates } : l);
    const partsTotal = current.filter(l => l.item_type === 'PART').reduce((s, l) => s + (l.line_total || 0), 0);
    const sub = current.reduce((s, l) => s + (l.line_total || 0), 0);
    const tax = +(partsTotal * taxRate).toFixed(2);
    const total = +(sub + tax).toFixed(2);
    if (estimate?.id) {
      await supabase.from('estimates').update({ subtotal: +sub.toFixed(2), tax, total }).eq('id', estimate.id);
      setEstimate(prev => prev ? { ...prev, subtotal: +sub.toFixed(2), tax, total } : prev);
    }
  };

  const commitNewRow = async () => {
    if (!newRow.description.trim()) return;
    if (!estimate?.id) return;
    const qty   = parseFloat(newRow.quantity) || 1;
    const hours = newRow.item_type === 'LABOR' ? parseFloat(newRow.labor_hours) || null : null;
    const price = newRow.item_type !== 'LABOR' ? parseFloat(newRow.unit_price) || null : laborRate;
    const total = hours ? +(hours * laborRate).toFixed(2) : price ? +(price * qty).toFixed(2) : 0;
    const row = { estimate_id: estimate.id, job_id: selectedJob.id, shop_id: shopId, item_type: newRow.item_type, description: newRow.description.trim(), quantity: qty, labor_hours: hours, labor_rate: hours ? laborRate : null, unit_price: price, line_total: total, auth_status: 'pending', sort_order: lineItems.length };
    const { data } = await supabase.from('estimate_line_items').insert(row).select().single();
    if (data) setLineItems(prev => [...prev, data]);
    setNewRow({ item_type: 'LABOR', description: '', labor_hours: '', unit_price: '', quantity: 1 });
    setAddingRow(false);
    await syncTotals();
  };

  const handleAuthorized = async () => {
    setPortalOpen(false);
    if (estimate?.id) {
      const { data: fresh } = await supabase.from('estimates').select('*').eq('id', estimate.id).single();
      if (fresh) setEstimate(fresh);
      const { data: freshItems } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', estimate.id).order('sort_order');
      if (freshItems) {
        setLineItems(freshItems);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        try { await fetch(`${apiUrl}/api/jobs/${selectedJob?.id}/generate-pos`, { method: 'POST' }); console.log('[PROC] Auto-PO generation triggered.'); }
        catch (e) { console.error('[PROC] Auto-PO error:', e); }
      }
    }
    if (selectedJob?.id) {
      const { data: freshJob } = await supabase.from('jobs').select('*').eq('id', selectedJob.id).single();
      if (freshJob) { setSelectedJob(freshJob); setJobs(prev => prev.map(j => j.id === freshJob.id ? freshJob : j)); }
    }
    setView('AUTHORIZED');
  };

  const sendToCustomer = async () => {
    setSending(true);
    await supabase.from('estimates').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', estimate.id);
    await supabase.from('jobs').update({ status: 'pending_auth' }).eq('id', selectedJob.id);
    setEstimate(prev => ({ ...prev, status: 'sent' }));
    setSelectedJob(prev => ({ ...prev, status: 'pending_auth' }));
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, status: 'pending_auth' } : j));
    setSending(false); setView('SENT');
  };

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
    <div style={{ minHeight: '100vh', background: '#020617', padding: '24px', paddingBottom: '128px' }}>
      <div style={{ maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Estimate Queue</h1>
            <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Service Writer // Zone 3 Entry</p>
          </div>
          {/* NON-1:1: hover:text-white → dropped; animate-spin → ign-spin */}
          <button onClick={loadQueue} style={{ padding: '8px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
            <RefreshCw size={16} className={loadingQueue ? 'ign-spin' : ''} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: '#f87171', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loadingQueue && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            {/* NON-1:1: animate-spin → ign-spin */}
            <Loader2 size={24} className="ign-spin" style={{ color: '#3b82f6' }} />
          </div>
        )}

        {!loadingQueue && jobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#475569' }}>
            <FileText size={40} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '14px' }}>No jobs awaiting estimates</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>Jobs move here after tech submits evaluation</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {jobs.map(job => {
            const badge = STATUS_BADGE[job.status] || { label: job.status, bg: 'rgba(30,41,59,1)', color: '#94a3b8', border: '#334155' };
            const cust  = job.customer || {};
            const veh   = job.vehicle  || {};
            return (
              <div
                key={job.id}
                className="ign-card-hover"
                style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', cursor: 'pointer' }}
                onClick={() => openJob(job)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${badge.border}`, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#475569' }}>{job.wo_number || job.id?.slice(0, 8)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <User size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                      {/* NON-1:1: truncate → overflow hidden ellipsis */}
                      <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.name || 'Unknown Customer'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Car size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>{[veh.year, veh.make, veh.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}</span>
                    </div>
                    {job.complaint && (
                      <p style={{ color: '#475569', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={10} style={{ color: 'rgba(245,158,11,0.6)', flexShrink: 0 }} />
                        {job.complaint}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} style={{ color: '#334155', flexShrink: 0, marginTop: '4px' }} />
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
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '24rem', width: '100%', background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px rgba(6,78,59,0.1)' }}>
        <div style={{ width: '64px', height: '64px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginRight: 'auto', marginBottom: '24px' }}>
          <Send size={28} style={{ color: '#34d399' }} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: '8px' }}>Estimate Sent</h2>
        <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>{selectedJob?.customer?.name || 'Customer'} has been notified.</p>
        <p style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px' }}>Status: Awaiting Authorization</p>
        <button onClick={() => { setView('QUEUE'); loadQueue(); }} style={{ width: '100%', background: '#1e293b', color: '#ffffff', fontWeight: 900, padding: '16px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', border: 'none', cursor: 'pointer' }}>
          Back to Queue
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: AUTHORIZED CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'AUTHORIZED') return (
    <div style={{ minHeight: '100vh', background: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '24rem', width: '100%', background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 25px 50px rgba(30,58,138,0.1)' }}>
        <div style={{ width: '64px', height: '64px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginRight: 'auto', marginBottom: '24px' }}>
          <ClipboardCheck size={28} style={{ color: '#60a5fa' }} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: '8px' }}>Authorized</h2>
        <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>{selectedJob?.customer?.name || 'Customer'} has authorized the repair.</p>
        <p style={{ color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '32px' }}>Job Status: Authorized</p>
        <button onClick={() => { setView('QUEUE'); loadQueue(); }} style={{ width: '100%', background: '#1e293b', color: '#ffffff', fontWeight: 900, padding: '16px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', border: 'none', cursor: 'pointer' }}>
          Back to Queue
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: REVIEW
  // ─────────────────────────────────────────────────────────────────────────

  const canSend = estimate && lineItems.length > 0 && ['ready', 'building'].includes(estimate.status) && !building;
  const isSent  = estimate?.status === 'sent' || selectedJob?.status === 'pending_auth';
  const cust    = selectedJob?.customer || {};
  const veh     = selectedJob?.vehicle  || {};

  const estBadge = STATUS_BADGE[estimate?.status] || { bg: 'rgba(30,41,59,1)', color: '#94a3b8', border: '#334155', label: estimate?.status };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', paddingBottom: '128px' }}>
      <div style={{ maxWidth: '48rem', marginLeft: 'auto', marginRight: 'auto', padding: '24px' }}>

        {/* Back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          {/* NON-1:1: hover:text-white → dropped */}
          <button onClick={() => setView('QUEUE')} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Estimate Review</h1>
            <p style={{ fontSize: '9px', fontFamily: 'monospace', color: '#64748b' }}>
              {selectedJob?.wo_number || selectedJob?.id?.slice(0, 8)} // {currentUser?.name}
            </p>
          </div>
          {estimate && (
            <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: '4px', background: estBadge.bg, color: estBadge.color, border: `1px solid ${estBadge.border}` }}>
              {estBadge.label}
            </span>
          )}
        </div>

        {error && (
          <div style={{ background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
            <p style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, flex: 1 }}>{error}</p>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} style={{ color: '#ef4444' }} /></button>
          </div>
        )}

        {/* Job summary card */}
        {/* NON-1:1: grid-cols-2 col-span-2 → grid with gridColumn span */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '9px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Customer</p>
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px' }}>{cust.name || '—'}</p>
            <p style={{ color: '#64748b', fontSize: '12px' }}>{cust.phone || ''}</p>
          </div>
          <div>
            <p style={{ fontSize: '9px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Vehicle</p>
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px' }}>{[veh.year, veh.make, veh.model].filter(Boolean).join(' ') || '—'}</p>
            {veh.vin && <p style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>…{veh.vin.slice(-6)}</p>}
          </div>
          {selectedJob?.complaint && (
            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
              <p style={{ fontSize: '9px', fontWeight: 900, color: 'rgba(245,158,11,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Complaint</p>
              <p style={{ color: '#cbd5e1', fontSize: '12px' }}>{selectedJob.complaint}</p>
            </div>
          )}
        </div>

        {/* Build trigger */}
        {(!estimate || estimate.status === 'building') && !building && (
          <button
            onClick={buildEstimate}
            className="ign-card-hover"
            style={{ width: '100%', marginBottom: '24px', background: '#2563eb', color: '#ffffff', fontWeight: 900, padding: '20px', borderRadius: '16px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 15px rgba(30,58,138,0.3)', border: 'none', cursor: 'pointer' }}
          >
            <Zap size={16} /> Build Estimate with AI
          </button>
        )}

        {building && (
          <div style={{ width: '100%', marginBottom: '24px', background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            {/* NON-1:1: animate-spin → ign-spin */}
            <Loader2 size={16} className="ign-spin" style={{ color: '#60a5fa' }} />
            <span style={{ color: '#60a5fa', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Agent running…</span>
          </div>
        )}

        {estimate && estimate.status !== 'building' && !isSent && !building && (
          <button
            onClick={buildEstimate}
            style={{ width: '100%', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#475569', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
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
                <div key={type} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingLeft: '4px' }}>
                    <Icon size={12} style={{ color: meta.color }} />
                    <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: meta.color }}>{meta.label}</span>
                  </div>

                  <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                    {items.map((item, itemIdx) => (
                      type === 'PART' ? (
                        // NON-1:1: last:border-0 → conditional border check
                        <div key={item.id} style={{ borderBottom: itemIdx < items.length - 1 ? '1px solid #1e293b' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                                {isSent ? item.description : (
                                  <EditableCell value={item.description} onSave={v => updateLineItem(item.id, 'description', v)} />
                                )}
                              </div>
                              {item.part_number && <p style={{ color: '#475569', fontSize: '10px', fontFamily: 'monospace' }}>#{item.part_number}</p>}
                              {item.notes && <p style={{ color: '#475569', fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>{item.notes}</p>}
                            </div>
                            <div style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {isSent ? `×${item.quantity}` : (
                                  <EditableCell value={item.quantity} type="number" onSave={v => updateLineItem(item.id, 'quantity', v)} />
                                )}
                              </div>
                            </div>
                            <div style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px' }}>{fmt(item.line_total)}</span>
                              {/* NON-1:1: animate-spin → ign-spin */}
                              {savingIds.has(item.id) && <Loader2 size={10} className="ign-spin" style={{ color: '#60a5fa', display: 'inline', marginLeft: '4px' }} />}
                              {item.is_manual_override && <span style={{ fontSize: '8px', fontWeight: 900, color: '#f97316', textTransform: 'uppercase', display: 'block', marginTop: '2px' }}>Override</span>}
                            </div>
                            {!isSent && (
                              // NON-1:1: opacity-0 group-hover:opacity-100 → always 50% opacity
                              <button onClick={() => deleteLineItem(item.id)} style={{ color: '#334155', opacity: 0.5, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <div style={{ padding: '0 16px 16px' }}>
                            {!isSent ? (
                              <PriceField cost={item.unit_cost || 0} initialPrice={item.unit_price} onUpdate={d => handlePriceOverride(item.id, d)} />
                            ) : item.unit_price != null && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
                                <span style={{ color: '#64748b', fontSize: '10px' }}>{fmt(item.unit_price)}/ea</span>
                                {item.is_manual_override && (
                                  <span style={{ fontSize: '8px', fontWeight: 900, color: 'rgba(249,115,22,0.7)', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(249,115,22,0.2)' }}>Relationship Tax</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderBottom: itemIdx < items.length - 1 ? '1px solid #1e293b' : 'none' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                              {isSent ? item.description : (
                                <EditableCell value={item.description} onSave={v => updateLineItem(item.id, 'description', v)} />
                              )}
                            </div>
                            {item.part_number && <p style={{ color: '#475569', fontSize: '10px', fontFamily: 'monospace' }}>#{item.part_number}</p>}
                            {item.notes && <p style={{ color: '#475569', fontSize: '10px', fontStyle: 'italic', marginTop: '2px' }}>{item.notes}</p>}
                          </div>
                          <div style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>
                            {item.item_type === 'LABOR' ? (
                              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {isSent ? `${item.labor_hours}h` : (
                                  <EditableCell value={item.labor_hours} type="number" onSave={v => updateLineItem(item.id, 'labor_hours', v)} />
                                )}
                              </div>
                            ) : (
                              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {isSent ? `×${item.quantity}` : (
                                  <EditableCell value={item.quantity} type="number" onSave={v => updateLineItem(item.id, 'quantity', v)} />
                                )}
                              </div>
                            )}
                          </div>
                          <div style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                              {isSent ? fmt(item.unit_price) : (
                                <EditableCell value={item.unit_price != null ? +item.unit_price.toFixed(2) : null} type="number" onSave={v => updateLineItem(item.id, 'unit_price', v)} />
                              )}
                            </div>
                          </div>
                          <div style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '14px' }}>{fmt(item.line_total)}</span>
                            {savingIds.has(item.id) && <Loader2 size={10} className="ign-spin" style={{ color: '#60a5fa', display: 'inline', marginLeft: '4px' }} />}
                          </div>
                          {!isSent && (
                            <button onClick={() => deleteLineItem(item.id)} style={{ color: '#334155', opacity: 0.5, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
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
              <div style={{ marginBottom: '24px' }}>
                {!addingRow ? (
                  <button
                    onClick={() => setAddingRow(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px dashed #334155', color: '#475569', fontWeight: 900, padding: '12px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '9px', background: 'none', cursor: 'pointer' }}
                  >
                    <Plus size={12} /> Add Line Item
                  </button>
                ) : (
                  <div style={{ background: '#0f172a', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <select
                        value={newRow.item_type}
                        onChange={e => setNewRow(p => ({ ...p, item_type: e.target.value }))}
                        className="ign-input"
                        style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                      >
                        {Object.keys(ITEM_TYPE_META).map(t => (
                          <option key={t} value={t}>{ITEM_TYPE_META[t].label}</option>
                        ))}
                      </select>
                      {/* NON-1:1: focus:border-blue-500 → ign-input */}
                      <input
                        autoFocus
                        placeholder="Description"
                        value={newRow.description}
                        onChange={e => setNewRow(p => ({ ...p, description: e.target.value }))}
                        className="ign-input"
                        style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {newRow.item_type === 'LABOR' ? (
                        <input
                          type="number"
                          placeholder="Labor hours"
                          value={newRow.labor_hours}
                          onChange={e => setNewRow(p => ({ ...p, labor_hours: e.target.value }))}
                          className="ign-input"
                          style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
                        />
                      ) : (
                        <>
                          <input
                            type="number"
                            placeholder="Qty"
                            value={newRow.quantity}
                            onChange={e => setNewRow(p => ({ ...p, quantity: e.target.value }))}
                            className="ign-input"
                            style={{ width: '80px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
                          />
                          <input
                            type="number"
                            placeholder="Unit price"
                            value={newRow.unit_price}
                            onChange={e => setNewRow(p => ({ ...p, unit_price: e.target.value }))}
                            className="ign-input"
                            style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
                          />
                        </>
                      )}
                      <button onClick={commitNewRow} style={{ background: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                        <Check size={14} />
                      </button>
                      <button onClick={() => setAddingRow(false)} style={{ color: '#475569', padding: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Labor</span>
                  <span>{fmt(groupedItems.LABOR.reduce((s, l) => s + (l.line_total || 0), 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Parts</span>
                  <span>{fmt(partsTotal)}</span>
                </div>
                {(groupedItems.FEE.length + groupedItems.SUBLET.length + groupedItems.MISC.length) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Fees / Other</span>
                    <span>{fmt([...groupedItems.FEE, ...groupedItems.SUBLET, ...groupedItems.MISC].reduce((s, l) => s + (l.line_total || 0), 0))}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px' }}>
                  <span>Tax ({(taxRate * 100).toFixed(2)}% on parts)</span>
                  <span>{fmt(tax)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                <span style={{ color: '#34d399', fontWeight: 900, fontSize: '24px' }}>{fmt(total)}</span>
              </div>
            </div>

            {estimate?.agent_notes && (
              <p style={{ color: '#334155', fontSize: '9px', fontFamily: 'monospace', marginBottom: '24px', textAlign: 'center' }}>{estimate.agent_notes}</p>
            )}

            {!isSent ? (
              <button
                onClick={sendToCustomer}
                disabled={sending || !canSend}
                className="ign-card-hover"
                style={{ width: '100%', background: '#059669', color: '#ffffff', fontWeight: 900, padding: '20px', borderRadius: '16px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 15px rgba(6,78,59,0.3)', border: 'none', cursor: sending || !canSend ? 'not-allowed' : 'pointer', opacity: sending || !canSend ? 0.4 : 1 }}
              >
                {sending ? <Loader2 size={16} className="ign-spin" /> : <Send size={16} />}
                {sending ? 'Sending…' : 'Send to Customer'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '16px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#34d399', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  <Check size={14} /> Estimate Sent — Awaiting Authorization
                </div>
                <button
                  onClick={() => setPortalOpen(true)}
                  className="ign-card-hover"
                  style={{ width: '100%', background: '#2563eb', color: '#ffffff', fontWeight: 900, padding: '20px', borderRadius: '16px', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxShadow: '0 10px 15px rgba(30,58,138,0.3)', border: 'none', cursor: 'pointer' }}
                >
                  <ClipboardCheck size={16} /> Open Customer Authorization Portal
                </button>
              </div>
            )}
          </>
        )}

        {estimate && lineItems.length === 0 && !building && estimate.status !== 'building' && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#475569' }}>
            <FileText size={32} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: '12px', opacity: 0.3 }} />
            <p style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>No line items yet</p>
            <p style={{ fontSize: '10px', marginTop: '4px' }}>Click "Build Estimate with AI" to generate them</p>
          </div>
        )}

      </div>

      {/* Customer Authorization Portal */}
      {portalOpen && estimate?.id && selectedJob?.id && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
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
