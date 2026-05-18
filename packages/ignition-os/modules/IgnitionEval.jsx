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

// ─── constants ────────────────────────────────────────────────────────────────

const DTC_SYSTEMS   = ['POWERTRAIN', 'CHASSIS', 'BODY', 'NETWORK'];
const DTC_SEVERITY  = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_STYLE = {
  HIGH:   'text-red-400 border-red-500/30 bg-red-500/10',
  MEDIUM: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  LOW:    'text-blue-400 border-blue-500/30 bg-blue-500/10',
  INFO:   'text-slate-400 border-slate-600 bg-slate-800',
};

const SectionLabel = ({ icon: Icon, children, action }) => (
  <div className="flex items-center justify-between mb-3">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
      <Icon size={12} />{children}
    </p>
    {action}
  </div>
);

const AddBtn = ({ onClick, label = 'Add' }) => (
  <button
    onClick={onClick}
    className="text-[9px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
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

  const [addingDtc, setAddingDtc]             = useState(false);
  const [newDtc, setNewDtc]                   = useState({ code: '', description: '', system: 'POWERTRAIN', severity: 'MEDIUM' });
  const [addingWorkItem, setAddingWorkItem]   = useState(false);
  const [newWorkItem, setNewWorkItem]         = useState('');

  const fileInputRef = useRef(null);
  const clockDisplay = useClock(clockedInAt);

  const cust = job?.customer || {};
  const veh  = job?.vehicle  || {};

  // ── init: create/fetch draft eval + clock in ───────────────────────────────

  useEffect(() => { initEval(); }, []);

  const initEval = async () => {
    setLoading(true);
    try {
      // 1. Find existing draft eval or create one
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

      // 2. Find open labor entry or wait for VIN validation to create one
      const { data: openEntry } = await supabase.from('labor_entries').select('*')
        .eq('job_id', job.id).eq('shop_id', shopId).is('clocked_out', null).limit(1);

      if (openEntry?.length) {
        setLaborEntryId(openEntry[0].id);
        setClockedInAt(openEntry[0].clocked_in);
        setVinValidated(true); // Already clocked in, skip VIN gate
      }

      // 3. Advance job to in_eval if still at intake/queued
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-10 text-center shadow-2xl shadow-emerald-900/10">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={28} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">Eval Submitted</h2>
        <p className="text-slate-500 text-xs mb-1">Job moved to estimate queue.</p>
        <p className="text-slate-600 text-[10px] font-mono uppercase tracking-widest">Status: eval_done</p>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 size={24} className="text-blue-500 animate-spin" />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: VIN GATE
  // ─────────────────────────────────────────────────────────────────────────

  if (!vinValidated) return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900">
        <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 text-xs font-black uppercase">
          <ArrowLeft size={16} /> Cancel Eval
        </button>
        <span className="text-blue-500 font-black italic uppercase tracking-widest text-xs">Step 1: Validate Vehicle</span>
      </div>
      <div className="flex-1 relative">
        <IgnitionVIN 
          jobData={{ jobId: job.id, name: job.customer?.name, vin: job.vehicle?.vin, year: job.vehicle?.year, make: job.vehicle?.make, model: job.vehicle?.model }} 
          onComplete={async (decodedResult) => {
            try {
              // Start the clock and lock in the phase
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
              setVinValidated(true); // Let them through anyway
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
    <div className="min-h-screen bg-slate-950 pb-40">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={suspendEval} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-2 rounded-xl">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black italic text-white uppercase tracking-tighter">Tech Evaluation</h1>
            <p className="text-[9px] font-mono text-slate-500">
              {job?.wo_number || job?.id?.slice(0, 8)} // {currentUser?.name || 'Tech'}
            </p>
          </div>
          {clockedInAt && (
            <div className="text-right flex-shrink-0 flex items-center gap-4">
              <div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5 flex items-center gap-1 justify-end">
                  <Clock size={8} /> Eval Time
                </p>
                <span className="text-emerald-400 font-black font-mono text-sm tabular-nums">{clockDisplay}</span>
              </div>
              <button onClick={suspendEval} className="bg-orange-600/20 text-orange-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                Pause
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs font-bold flex-1">{error}</p>
            <button onClick={() => setError('')}><X size={14} className="text-red-500" /></button>
          </div>
        )}

        {/* Job summary card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Customer</p>
            <p className="text-white font-bold text-sm">{cust.name || '—'}</p>
          </div>
          <div>
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Vehicle</p>
            <p className="text-white font-bold text-sm">{[veh.year, veh.make, veh.model].filter(Boolean).join(' ') || '—'}</p>
            {veh.vin && <p className="text-slate-600 text-[9px] font-mono">…{veh.vin.slice(-6)}</p>}
          </div>
          {job?.complaint && (
            <div className="col-span-2 border-t border-slate-800 pt-3">
              <p className="text-[8px] font-black text-amber-500/70 uppercase tracking-widest mb-0.5">Customer Complaint</p>
              <p className="text-slate-300 text-xs">{job.complaint}</p>
            </div>
          )}
        </div>

        {/* ── Tech Notes ── */}
        <div className="mb-6">
          <SectionLabel icon={ClipboardList}>
            Tech Notes
            {savingNotes && <span className="text-[8px] text-slate-600 font-mono ml-2">saving…</span>}
          </SectionLabel>
          <textarea
            rows={4}
            value={techNotes}
            onChange={e => setTechNotes(e.target.value)}
            onBlur={() => saveTechNotes(techNotes)}
            placeholder="Describe findings, inspection results, and recommended repairs…"
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-white text-sm outline-none resize-none placeholder-slate-700 transition-colors"
          />
        </div>

        {/* ── DTC Fault Codes ── */}
        <div className="mb-6">
          <SectionLabel icon={Zap} action={<AddBtn onClick={() => setAddingDtc(true)} label="Add Code" />}>
            DTC Fault Codes
          </SectionLabel>

          {addingDtc && (
            <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 mb-3 space-y-3">
              <div className="flex gap-3">
                <input
                  autoFocus
                  placeholder="Code (e.g. P0171)"
                  value={newDtc.code}
                  onChange={e => setNewDtc(p => ({ ...p, code: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addDtc()}
                  className="w-36 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono uppercase outline-none focus:border-blue-500"
                />
                <input
                  placeholder="Description"
                  value={newDtc.description}
                  onChange={e => setNewDtc(p => ({ ...p, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addDtc()}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={newDtc.system}
                  onChange={e => setNewDtc(p => ({ ...p, system: e.target.value }))}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-bold outline-none"
                >
                  {DTC_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={newDtc.severity}
                  onChange={e => setNewDtc(p => ({ ...p, severity: e.target.value }))}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-bold outline-none"
                >
                  {DTC_SEVERITY.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={addDtc} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg transition-colors">
                  <Check size={14} />
                </button>
                <button onClick={() => setAddingDtc(false)} className="text-slate-600 hover:text-slate-400 px-2 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {dtcCodes.length === 0 && !addingDtc && (
            <p className="text-slate-700 text-xs italic px-1 mb-2">No codes — tap "Add Code" to log fault codes</p>
          )}
          <div className="space-y-2">
            {dtcCodes.map(dtc => (
              <div key={dtc.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 group">
                <span className="font-mono font-black text-white text-sm w-20 flex-shrink-0">{dtc.code}</span>
                <span className="flex-1 text-slate-400 text-xs truncate">{dtc.description || '—'}</span>
                <span className="text-[8px] font-black text-slate-600 uppercase hidden sm:block">{dtc.system}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded border flex-shrink-0 ${SEVERITY_STYLE[dtc.severity] || SEVERITY_STYLE.INFO}`}>
                  {dtc.severity}
                </span>
                <button
                  onClick={() => removeDtc(dtc.id)}
                  className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Work Items (feeds estimate agent) ── */}
        <div className="mb-6">
          <SectionLabel icon={FileSearch} action={<AddBtn onClick={() => setAddingWorkItem(true)} label="Add Item" />}>
            Recommended Work Items
          </SectionLabel>
          <p className="text-[9px] text-slate-700 mb-3 px-1">These feed the AI estimate agent — be specific.</p>

          {addingWorkItem && (
            <div className="flex gap-2 mb-3">
              <input
                autoFocus
                placeholder="e.g. Replace front brake pads and rotors"
                value={newWorkItem}
                onChange={e => setNewWorkItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addWorkItem(); if (e.key === 'Escape') setAddingWorkItem(false); }}
                className="flex-1 bg-slate-900 border border-blue-500/40 rounded-xl px-4 py-2 text-white text-sm outline-none"
              />
              <button onClick={addWorkItem} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl transition-colors">
                <Check size={14} />
              </button>
              <button onClick={() => setAddingWorkItem(false)} className="text-slate-600 px-2">
                <X size={14} />
              </button>
            </div>
          )}

          {workItems.length === 0 && !addingWorkItem && (
            <p className="text-slate-700 text-xs italic px-1">No work items yet</p>
          )}
          <div className="space-y-2">
            {workItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 group">
                <span className="w-5 h-5 rounded-full border border-slate-700 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[8px] font-black text-slate-600">{idx + 1}</span>
                </span>
                <span className="flex-1 text-white text-sm">{item.description}</span>
                <button
                  onClick={() => removeWorkItem(idx)}
                  className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Photos ── */}
        <div className="mb-8">
          <SectionLabel
            icon={Camera}
            action={
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="text-[9px] font-black text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                {uploadingPhoto ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
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
            className="hidden"
            onChange={handlePhotoSelect}
          />

          {photos.length === 0 && (
            <p className="text-slate-700 text-xs italic px-1 mb-3">No photos — tap "Add Photo" to use the camera</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                <img src={photo.storage_url} alt={photo.caption || 'eval photo'} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <button
                    onClick={() => removePhoto(photo.id, photo.storage_url)}
                    className="opacity-0 group-hover:opacity-100 bg-red-600 rounded-full p-1.5 transition-all"
                  >
                    <X size={12} className="text-white" />
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
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          {submitting ? 'Submitting…' : 'Submit Evaluation'}
        </button>
        <p className="text-center text-[9px] text-slate-700 mt-3">
          Submitting clocks you out and moves the job to the estimate queue
        </p>

      </div>
    </div>
  );
}
