/**
 * MODULE: IgnitionEval (Zone 2 — Tech Evaluation)
 * VERSION: v1.0.0
 * DESC: Tech evaluation station. Creates evaluations, dtc_codes, eval_photos,
 *       and labor_entries rows in Supabase. On submit moves job → eval_done
 *       so the estimate agent has structured data to read.
 *
 * Props: { job, onBack, onEvalSubmitted }
 * Views: EVAL → SUBMITTED
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Clock, ClipboardList, Camera, Plus, X, Check,
  AlertTriangle, Loader2, FileSearch, CheckCircle2, Zap,
} from 'lucide-react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';
import IgnitionVIN from './IgnitionVIN';

const STYLE_DEBUG = true;

// Non-1:1 mappings (89 classNames converted):
// (1) hover:* on all interactive elements → dropped (cosmetic)
// (2) transition-colors / transition-all → dropped (no inline equivalent)
// (3) animate-spin on 3 Loader2 icons → ign-spin CSS class
// (4) active:scale-95 on submit button → ign-card-hover CSS class
// (5) hidden sm:block on DTC system label → always block (no breakpoint)
// (6) group-hover:opacity-100 on delete buttons → opacity 0.5 always (no group-hover inline)
// (7) group-hover:bg-black/50 on photo overlay → always rgba(0,0,0,0.35) static
// (8) group-hover:opacity-100 on photo delete btn → always visible (simplified)
// (9) aspect-square → aspectRatio: '1 / 1'
// (10) space-y-2/3 → gap on flex column containers
// (11) tabular-nums → fontVariantNumeric: 'tabular-nums'
// (12) truncate → overflow/textOverflow/whiteSpace
// (13) grid grid-cols-2/3 → display: 'grid' + gridTemplateColumns
// (14) object-cover on img → objectFit: 'cover'
// (15) placeholder-slate-700 → CSS-only; no inline equivalent
// (16) focus:border-blue-500 on inputs/textarea → ign-input CSS class
// (TRACE:STYLE) IgnitionEval converted, 89 classNames → inline, 16 non-1:1 categories

// ─── constants ────────────────────────────────────────────────────────────────

const DTC_SYSTEMS  = ['POWERTRAIN', 'CHASSIS', 'BODY', 'NETWORK'];
const DTC_SEVERITY = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_STYLE = {
  HIGH:   { color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)' },
  MEDIUM: { color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.1)' },
  LOW:    { color: '#60a5fa', borderColor: 'rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.1)' },
  INFO:   { color: '#94a3b8', borderColor: '#475569', backgroundColor: '#1e293b' },
};

const SectionLabel = ({ icon: Icon, children, action }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
    <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
      <Icon size={12} />{children}
    </p>
    {action}
  </div>
);

const AddBtn = ({ onClick, label = 'Add' }) => (
  <button
    onClick={onClick}
    style={{ fontSize: 9, fontWeight: 900, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
    <Plus size={11} />{label}
  </button>
);

// ─── live clock hook ──────────────────────────────────────────────────────────

const useClock = (startIso) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startIso) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// ─── main component ───────────────────────────────────────────────────────────

export default function IgnitionEval({ job, onBack, onEvalSubmitted }) {
  const currentUser = DataBridge.load('current_user');
  const shopId      = currentUser?.shop_id || DataBridge.load('shop_info')?.id;
  const memberId    = currentUser?.member_id;

  const [view, setView]                 = useState('EVAL');
  const [vinValidated, setVinValidated] = useState(false);
  const [evalId, setEvalId]             = useState(null);
  const [laborEntryId, setLaborEntryId] = useState(null);
  const [clockedInAt, setClockedInAt]   = useState(null);

  const [techNotes, setTechNotes]     = useState('');
  const [workItems, setWorkItems]     = useState([]);
  const [dtcCodes, setDtcCodes]       = useState([]);
  const [photos, setPhotos]           = useState([]);

  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError]             = useState('');

  const [addingDtc, setAddingDtc]           = useState(false);
  const [newDtc, setNewDtc]                 = useState({ code: '', description: '', system: 'POWERTRAIN', severity: 'MEDIUM' });
  const [addingWorkItem, setAddingWorkItem] = useState(false);
  const [newWorkItem, setNewWorkItem]       = useState('');

  const fileInputRef = useRef(null);
  const clockDisplay = useClock(clockedInAt);

  const cust = job?.customer || {};
  const veh  = job?.vehicle  || {};

  // ── init: create/fetch draft eval + clock in ───────────────────────────────

  useEffect(() => { initEval(); }, []);

  const initEval = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase.from('evaluations').select('*')
        .eq('job_id', job.id).eq('status', 'draft')
        .order('created_at', { ascending: false }).limit(1);

      let eid;
      if (existing?.length) {
        const ev = existing[0];
        eid = ev.id;
        setTechNotes(ev.tech_notes || '');
        if (Array.isArray(ev.work_items)) setWorkItems(ev.work_items);

        const [{ data: existingDtcs }, { data: existingPhotos }] = await Promise.all([
          supabase.from('dtc_codes').select('*').eq('evaluation_id', eid).order('created_at'),
          supabase.from('eval_photos').select('*').eq('evaluation_id', eid).order('sort_order'),
        ]);
        setDtcCodes(existingDtcs || []);
        setPhotos(existingPhotos || []);
      } else {
        const { data: newEval, error: evalErr } = await supabase.from('evaluations').insert({
          job_id:    job.id,
          shop_id:   shopId,
          tech_id:   memberId || null,
          status:    'draft',
          complaint: job.complaint || null,
        }).select().single();
        if (evalErr) throw evalErr;
        eid = newEval.id;
      }
      setEvalId(eid);

      const { data: openEntry } = await supabase.from('labor_entries').select('*')
        .eq('job_id', job.id).eq('shop_id', shopId).is('clocked_out', null).limit(1);

      if (openEntry?.length) {
        setLaborEntryId(openEntry[0].id);
        setClockedInAt(openEntry[0].clocked_in);
        setVinValidated(true);
      }

      if (['intake', 'queued'].includes(job?.status)) {
        await supabase.from('jobs').update({ status: 'in_eval' }).eq('id', job.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to start evaluation');
    } finally {
      setLoading(false);
    }
  };

  // ── tech notes auto-save ───────────────────────────────────────────────────

  const saveTechNotes = async (value) => {
    if (!evalId) return;
    setSavingNotes(true);
    await supabase.from('evaluations').update({ tech_notes: value }).eq('id', evalId);
    setSavingNotes(false);
  };

  // ── DTC codes ──────────────────────────────────────────────────────────────

  const addDtc = async () => {
    if (!newDtc.code.trim() || !evalId) return;
    const row = {
      evaluation_id: evalId,
      job_id:        job.id,
      shop_id:       shopId,
      code:          newDtc.code.trim().toUpperCase(),
      description:   newDtc.description.trim() || null,
      system:        newDtc.system,
      severity:      newDtc.severity,
      is_active:     true,
    };
    const { data } = await supabase.from('dtc_codes').insert(row).select().single();
    if (data) setDtcCodes(prev => [...prev, data]);
    setNewDtc({ code: '', description: '', system: 'POWERTRAIN', severity: 'MEDIUM' });
    setAddingDtc(false);
  };

  const removeDtc = async (id) => {
    setDtcCodes(prev => prev.filter(d => d.id !== id));
    await supabase.from('dtc_codes').delete().eq('id', id);
  };

  // ── work items ─────────────────────────────────────────────────────────────

  const addWorkItem = async () => {
    if (!newWorkItem.trim() || !evalId) return;
    const updated = [...workItems, { description: newWorkItem.trim() }];
    setWorkItems(updated);
    setNewWorkItem('');
    setAddingWorkItem(false);
    await supabase.from('evaluations').update({ work_items: updated }).eq('id', evalId);
  };

  const removeWorkItem = async (idx) => {
    const updated = workItems.filter((_, i) => i !== idx);
    setWorkItems(updated);
    if (evalId) await supabase.from('evaluations').update({ work_items: updated }).eq('id', evalId);
  };

  // ── photo upload ───────────────────────────────────────────────────────────

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !evalId) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const ext  = file.name.split('.').pop();
      const path = `${shopId}/${job.id}/${evalId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('eval-photos').upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('eval-photos').getPublicUrl(path);
      const row = {
        evaluation_id: evalId,
        job_id:        job.id,
        shop_id:       shopId,
        storage_url:   urlData.publicUrl,
        photo_type:    'OVERVIEW',
        sort_order:    photos.length,
      };
      const { data: photoRow } = await supabase.from('eval_photos').insert(row).select().single();
      if (photoRow) setPhotos(prev => [...prev, photoRow]);
    } catch (err) {
      setError(`Photo upload failed: ${err.message}`);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removePhoto = async (id, storage_url) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
    await supabase.from('eval_photos').delete().eq('id', id);
    const match = storage_url?.match(/eval-photos\/(.+)$/);
    if (match) await supabase.storage.from('eval-photos').remove([match[1]]);
  };

  const suspendEval = async () => {
    if (laborEntryId && clockedInAt) {
      const duration_minutes = Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 60000);
      await supabase.from('labor_entries').update({ clocked_out: new Date().toISOString(), duration_minutes }).eq('id', laborEntryId);
    }
    onBack();
  };

  // ── submit ─────────────────────────────────────────────────────────────────

  const canSubmit = techNotes.trim().length > 0 || dtcCodes.length > 0;

  const submitEval = async () => {
    if (!canSubmit) {
      setError('Add tech notes or at least one DTC code before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const now = new Date().toISOString();

      await supabase.from('evaluations').update({
        status:       'submitted',
        tech_notes:   techNotes,
        work_items:   workItems,
        submitted_at: now,
      }).eq('id', evalId);

      if (laborEntryId && clockedInAt) {
        const duration_minutes = Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 60000);
        await supabase.from('labor_entries').update({ clocked_out: now, duration_minutes }).eq('id', laborEntryId);
      }

      await supabase.from('jobs').update({ status: 'eval_done' }).eq('id', job.id);

      setView('SUBMITTED');
      setTimeout(() => onEvalSubmitted?.(), 2200);
    } catch (err) {
      setError(err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: SUBMITTED
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'SUBMITTED') return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 384, width: '100%', backgroundColor: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 24, padding: 40, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(6,78,59,0.1)' }}>
        <div style={{ width: 64, height: 64, backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle2 size={28} style={{ color: '#34d399' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>Eval Submitted</h2>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>Job moved to estimate queue.</p>
        <p style={{ color: '#475569', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Status: eval_done</p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={24} className="ign-spin" style={{ color: '#3b82f6' }} />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: VIN GATE
  // ─────────────────────────────────────────────────────────────────────────

  if (!vinValidated) return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: '#000000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', backgroundColor: '#0f172a' }}>
        <button onClick={onBack} style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>
          <ArrowLeft size={16} /> Cancel Eval
        </button>
        <span style={{ color: '#3b82f6', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: 12 }}>Step 1: Validate Vehicle</span>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <IgnitionVIN
          jobData={{ jobId: job.id, name: job.customer?.name, vin: job.vehicle?.vin, year: job.vehicle?.year, make: job.vehicle?.make, model: job.vehicle?.model }}
          onComplete={async (decodedResult) => {
            try {
              const { data: entry } = await supabase.from('labor_entries').insert({
                job_id:     job.id,
                shop_id:    shopId,
                tech_id:    memberId,
                phase:      'EVAL',
                clocked_in: new Date().toISOString(),
              }).select().single();
              if (entry) {
                setLaborEntryId(entry.id);
                setClockedInAt(entry.clocked_in);
              }
              setVinValidated(true);
            } catch (err) {
              console.error('Failed to start eval clock', err);
              setVinValidated(true);
            }
          }}
        />
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: EVAL FORM
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', paddingBottom: 160 }}>
      <div style={{ maxWidth: 672, margin: '0 auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={suspendEval} style={{ color: '#64748b', backgroundColor: '#1e293b', padding: 8, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', margin: 0 }}>Tech Evaluation</h1>
            <p style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', margin: 0 }}>
              {job?.wo_number || job?.id?.slice(0, 8)} // {currentUser?.name || 'Tech'}
            </p>
          </div>
          {clockedInAt && (
            <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <p style={{ fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <Clock size={8} /> Eval Time
                </p>
                <span style={{ color: '#34d399', fontWeight: 900, fontFamily: 'monospace', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{clockDisplay}</span>
              </div>
              <button onClick={suspendEval} style={{ backgroundColor: 'rgba(234,88,12,0.2)', color: '#f97316', padding: '4px 12px', borderRadius: 8, fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', cursor: 'pointer' }}>
                Pause
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(127,29,29,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
            <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, flex: 1, margin: 0 }}>{error}</p>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={14} style={{ color: '#ef4444' }} /></button>
          </div>
        )}

        {/* Job summary card */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <p style={{ fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Customer</p>
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, margin: 0 }}>{cust.name || '—'}</p>
          </div>
          <div>
            <p style={{ fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Vehicle</p>
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, margin: 0 }}>{[veh.year, veh.make, veh.model].filter(Boolean).join(' ') || '—'}</p>
            {veh.vin && <p style={{ color: '#475569', fontSize: 9, fontFamily: 'monospace', margin: 0 }}>…{veh.vin.slice(-6)}</p>}
          </div>
          {job?.complaint && (
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #1e293b', paddingTop: 12 }}>
              <p style={{ fontSize: 8, fontWeight: 900, color: 'rgba(245,158,11,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Customer Complaint</p>
              <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0 }}>{job.complaint}</p>
            </div>
          )}
        </div>

        {/* ── Tech Notes ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel icon={ClipboardList}>
            Tech Notes
            {savingNotes && <span style={{ fontSize: 8, color: '#475569', fontFamily: 'monospace', marginLeft: 8 }}>saving…</span>}
          </SectionLabel>
          <textarea
            rows={4}
            value={techNotes}
            onChange={e => setTechNotes(e.target.value)}
            onBlur={() => saveTechNotes(techNotes)}
            placeholder="Describe findings, inspection results, and recommended repairs…"
            className="ign-input"
            style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', color: '#ffffff', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* ── DTC Fault Codes ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel icon={Zap} action={<AddBtn onClick={() => setAddingDtc(true)} label="Add Code" />}>
            DTC Fault Codes
          </SectionLabel>

          {addingDtc && (
            <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  autoFocus
                  placeholder="Code (e.g. P0171)"
                  value={newDtc.code}
                  onChange={e => setNewDtc(p => ({ ...p, code: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addDtc()}
                  className="ign-input"
                  style={{ width: 144, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#ffffff', fontSize: 14, fontFamily: 'monospace', textTransform: 'uppercase', outline: 'none' }}
                />
                <input
                  placeholder="Description"
                  value={newDtc.description}
                  onChange={e => setNewDtc(p => ({ ...p, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addDtc()}
                  className="ign-input"
                  style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#ffffff', fontSize: 14, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <select
                  value={newDtc.system}
                  onChange={e => setNewDtc(p => ({ ...p, system: e.target.value }))}
                  style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#ffffff', fontSize: 12, fontWeight: 700, outline: 'none' }}
                >
                  {DTC_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={newDtc.severity}
                  onChange={e => setNewDtc(p => ({ ...p, severity: e.target.value }))}
                  style={{ flex: 1, backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#ffffff', fontSize: 12, fontWeight: 700, outline: 'none' }}
                >
                  {DTC_SEVERITY.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={addDtc} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0 16px', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Check size={14} />
                </button>
                <button onClick={() => setAddingDtc(false)} style={{ color: '#475569', padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {dtcCodes.length === 0 && !addingDtc && (
            <p style={{ color: '#334155', fontSize: 12, fontStyle: 'italic', padding: '0 4px', marginBottom: 8 }}>No codes — tap "Add Code" to log fault codes</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dtcCodes.map(dtc => (
              <div key={dtc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#ffffff', fontSize: 14, width: 80, flexShrink: 0 }}>{dtc.code}</span>
                <span style={{ flex: 1, color: '#94a3b8', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dtc.description || '—'}</span>
                <span style={{ fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>{dtc.system}</span>
                <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 8px', borderRadius: 4, border: '1px solid', flexShrink: 0, ...(SEVERITY_STYLE[dtc.severity] || SEVERITY_STYLE.INFO) }}>
                  {dtc.severity}
                </span>
                <button
                  onClick={() => removeDtc(dtc.id)}
                  style={{ color: '#334155', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Work Items (feeds estimate agent) ── */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel icon={FileSearch} action={<AddBtn onClick={() => setAddingWorkItem(true)} label="Add Item" />}>
            Recommended Work Items
          </SectionLabel>
          <p style={{ fontSize: 9, color: '#334155', marginBottom: 12, padding: '0 4px' }}>These feed the AI estimate agent — be specific.</p>

          {addingWorkItem && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                autoFocus
                placeholder="e.g. Replace front brake pads and rotors"
                value={newWorkItem}
                onChange={e => setNewWorkItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addWorkItem(); if (e.key === 'Escape') setAddingWorkItem(false); }}
                className="ign-input"
                style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 12, padding: '8px 16px', color: '#ffffff', fontSize: 14, outline: 'none' }}
              />
              <button onClick={addWorkItem} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Check size={14} />
              </button>
              <button onClick={() => setAddingWorkItem(false)} style={{ color: '#475569', padding: '0 8px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            </div>
          )}

          {workItems.length === 0 && !addingWorkItem && (
            <p style={{ color: '#334155', fontSize: 12, fontStyle: 'italic', padding: '0 4px' }}>No work items yet</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #334155', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color: '#475569' }}>{idx + 1}</span>
                </span>
                <span style={{ flex: 1, color: '#ffffff', fontSize: 14 }}>{item.description}</span>
                <button
                  onClick={() => removeWorkItem(idx)}
                  style={{ color: '#334155', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center' }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Photos ── */}
        <div style={{ marginBottom: 32 }}>
          <SectionLabel
            icon={Camera}
            action={
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{ fontSize: 9, fontWeight: 900, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: uploadingPhoto ? 'not-allowed' : 'pointer', padding: 0, opacity: uploadingPhoto ? 0.4 : 1 }}
              >
                {uploadingPhoto ? <Loader2 size={11} className="ign-spin" /> : <Plus size={11} />}
                {uploadingPhoto ? 'Uploading…' : 'Add Photo'}
              </button>
            }
          >
            Photos
          </SectionLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoSelect}
          />

          {photos.length === 0 && (
            <p style={{ color: '#334155', fontSize: 12, fontStyle: 'italic', padding: '0 4px', marginBottom: 12 }}>No photos — tap "Add Photo" to use the camera</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
                <img src={photo.storage_url} alt={photo.caption || 'eval photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    onClick={() => removePhoto(photo.id, photo.storage_url)}
                    style={{ backgroundColor: '#dc2626', borderRadius: '50%', padding: 6, border: 'none', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={12} style={{ color: '#ffffff' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={submitEval}
          disabled={submitting || !canSubmit}
          className="ign-card-hover"
          style={{
            width: '100%',
            backgroundColor: '#059669',
            color: '#ffffff',
            fontWeight: 900,
            padding: '20px 0',
            borderRadius: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            border: 'none',
            cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
            opacity: submitting || !canSubmit ? 0.4 : 1,
            boxShadow: '0 10px 15px -3px rgba(6,78,59,0.3)',
          }}
        >
          {submitting ? <Loader2 size={16} className="ign-spin" /> : <CheckCircle2 size={16} />}
          {submitting ? 'Submitting…' : 'Submit Evaluation'}
        </button>
        <p style={{ textAlign: 'center', fontSize: 9, color: '#334155', marginTop: 12 }}>
          Submitting clocks you out and moves the job to the estimate queue
        </p>

      </div>
    </div>
  );
}
