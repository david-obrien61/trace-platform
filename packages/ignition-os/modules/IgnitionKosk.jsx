/**
 * MODULE: KOSK (Technician Kiosk)
 * VERSION: v1.0.1
 * DESC: Simplified, high-contrast UI for shop-floor operations.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Barcode, ClipboardList, Mic, Play, Square, CheckCircle, Unlock, Activity, AlertOctagon, Microscope, Wrench, Shield } from 'lucide-react';
import DataBridge from '../DataBridge';
import { useIgnitionVoice } from '../hooks/useIgnitionVoice';
import IgnitionHandover from './IgnitionHandover';
import { usePowerSense } from '../hooks/usePowerSense';
import SlideToComplete from './SlideToComplete';
import { supabase } from '../supabase';

const STYLE_DEBUG = true;

// [TRACE:WORKFLOW] ON — teardown instrumentation (KOSK: authorized→in_repair transitions). Comment out after migration.
const TRACE_WORKFLOW = true;

// Non-1:1 mappings (68 classNames converted):
// (1) border-[6px]/shadow-[0_0_120px...inset]/rounded-[2rem] (toolbox mode) → inline custom values
// (2) shadow-[0_0_15px_rgba(59,130,246,0.8)] on listening bar → inline boxShadow
// (3) animate-pulse on listening bar + handover label → ign-pulse CSS class
// (4) hover:text-slate-500 on escape hatch → dropped (cosmetic)
// (5) hover:border-orange-500 on suspend button → dropped (cosmetic)
// (6) hover:border-blue-500 on begin eval button → dropped (cosmetic)
// (7) hover:bg-emerald-600 hover:text-white on all action icon buttons → dropped (cosmetic)
// (8) hover:bg-orange-600/hover:bg-amber-600 on supplement/bypass buttons → dropped (cosmetic)
// (9) active:scale-95 → ign-card-hover CSS class on primary buttons
// (10) active:bg-slate-700 on Dictate button → dropped (cosmetic)
// (11) backdrop-blur-md → backdropFilter: 'blur(12px)'
// (12) grid grid-cols-1 gap-4 flex-1 → flex column + gap (functionally identical)
// (13) tabular-nums → fontVariantNumeric: 'tabular-nums'
// (14) line-through → textDecoration: 'line-through'
// (15) w-fit → width: 'fit-content'
// (16) focus:border-amber-500 on bypass input → dropped (flagged: no ign-input-amber class)
// (17) shadow-lg shadow-emerald-900/20 → boxShadow inline
// [TRACE:STYLE] IgnitionKosk converted, 68 classNames → inline, 17 non-1:1 categories

const IgnitionKosk = ({ activeJob, onUpdateJob, onExitKiosk, onStartEval }) => {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const isDotMandated = (() => {
    const val = DataBridge.load('is_dot_mandated');
    return val === null ? true : val;
  })();

  const [showHandover, setShowHandover] = useState(false);
  const [laborEntryId, setLaborEntryId] = useState(null);
  const [repairTasks, setRepairTasks] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState([]);
  const [qcChecked, setQcChecked] = useState(false);
  const [custodyEnabled, setCustodyEnabled] = useState(false);
  const [shopTools, setShopTools] = useState([]);
  const [toolAckIds, setToolAckIds] = useState([]);
  const [pendingBypass, setPendingBypass] = useState(null);
  const [bypassReason, setBypassReason] = useState('');
  const [bypassSaving, setBypassSaving] = useState(false);

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionKosk converted, 68 classNames → inline, 17 non-1:1 categories');

  useEffect(() => {
    if (!activeJob?.id) return;
    const techId = DataBridge.load('current_user')?.id || 'TECH_01';
    supabase.from('labor_entries')
      .select('id')
      .eq('job_id', activeJob.id)
      .eq('tech_id', techId)
      .is('clocked_out', null)
      .maybeSingle()
      .then(({ data }) => {
         if (data) { setIsClockedIn(true); setLaborEntryId(data.id); }
         else { setIsClockedIn(false); setLaborEntryId(null); }
      });
  }, [activeJob?.id]);

  useEffect(() => {
    const policy = DataBridge.load('shop_policy') || {};
    if (!policy.enable_bay_custody) return;
    setCustodyEnabled(true);
    const shopId = DataBridge.getShopId();
    if (!shopId) return;
    supabase.from('tools').select('id, name, type, status').eq('shop_id', shopId).eq('status', 'ACTIVE')
      .then(({ data }) => setShopTools(data || []));
  }, []);

  useEffect(() => {
    if (activeJob?.id && ['AUTHORIZED', 'in_repair', 'supplement', 'repair_done'].includes(activeJob.status?.toUpperCase() || '')) {
      supabase.from('estimate_line_items').select('*').eq('job_id', activeJob.id).eq('auth_status', 'approved')
        .then(({ data }) => setRepairTasks(data || []));
      supabase.from('repair_logs').select('estimate_line_item_id').eq('job_id', activeJob.id)
        .then(({ data }) => setCompletedTaskIds((data || []).map(d => d.estimate_line_item_id)));
    } else {
      setRepairTasks([]);
    }
  }, [activeJob?.id, activeJob?.status]);

  const handleVoiceCommand = (cmd) => {
    if (cmd === 'suspend') setShowHandover(true);
  };

  const executeHandover = ({ note, isOperable }) => {
    const updatedJob = { ...activeJob, status: 'SUSPENDED', handover: { note, isOperable, timestamp: Date.now() } };
    onUpdateJob(updatedJob);
    setShowHandover(false);
  };

  const { isToolboxMode, voiceMode, autoLockEnabled } = usePowerSense();
  const { isListening } = useIgnitionVoice(handleVoiceCommand, voiceMode);

  const handleDictate = () => {
    const note = prompt("🎤 Simulating Voice Transcription.\nSpeak now (type your note):");
    if (note) {
      onUpdateJob({
        ...activeJob,
        notes: [...(activeJob.notes || []), `[${new Date().toLocaleTimeString()}] TRANSCRIPT: "${note}"`]
      });
    }
  };

  // Toolbox mode adds a colored border ring around the whole kiosk
  const toolboxStyle = isToolboxMode
    ? { border: '6px solid #3b82f6', boxShadow: '0 0 120px rgba(59,130,246,0.3) inset', borderRadius: '2rem' }
    : { borderTop: '4px solid #0f172a', borderRadius: 0 };

  return (
    <div style={{ padding: 16, backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', width: '100%', height: '100%', transition: 'all 0.7s', ...toolboxStyle }}>
      {showHandover && (
        <IgnitionHandover activeJob={activeJob} onSubmit={executeHandover} onCancel={() => setShowHandover(false)} />
      )}

      {/* KIOSK ESCAPE HATCH — hover:text-slate-500 → dropped (cosmetic) */}
      <button
        onClick={onExitKiosk}
        style={{ position: 'absolute', top: 32, right: 24, color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer', zIndex: 50, transition: 'color 0.15s' }}
      >
        <Unlock size={20} />
      </button>

      {/* KIOSK HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 24, borderRadius: 24, border: '1px solid #1e293b', marginBottom: 24, marginTop: 16, position: 'relative', overflow: 'hidden' }}>
        {/* animate-pulse on listening indicator → ign-pulse */}
        {isListening && (
          <div className="ign-pulse" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#3b82f6', boxShadow: '0 0 15px rgba(59,130,246,0.8)' }} />
        )}
        <div>
          {/* animate-pulse on label when listening → ign-pulse */}
          <p className={isListening ? 'ign-pulse' : ''} style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3b82f6' }}>
            {isListening ? 'Tech Station 01 (Listening)' : 'Tech Station 01'}
          </p>
          <h2 style={{ fontSize: 30, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Current Status</p>
          <span style={{
            fontSize: 12, fontWeight: 900, padding: '4px 12px', borderRadius: 9999,
            backgroundColor: isClockedIn ? '#10b981' : '#ef4444',
            color: isClockedIn ? '#000000' : '#ffffff',
          }}>
            {isClockedIn ? 'ON THE CLOCK' : 'CLOCKED OUT'}
          </span>
        </div>
      </header>

      {/* PRIMARY KIOSK ACTIONS — grid grid-cols-1 → flex column (identical single column) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

        {/* BEGIN REPAIR — active:scale-95 → ign-card-hover */}
        {!isClockedIn && activeJob?.status === 'AUTHORIZED' && (
          <button
            onClick={async () => {
              const techId = DataBridge.load('current_user')?.id || 'TECH_01';
              const assignedSize = activeJob?.assigned_crew_size || 1;
              const currentTechs = activeJob?.active_techs?.length || 0;
              if (assignedSize !== 'ALL' && currentTechs >= assignedSize) {
                alert(`CREW CAP REACHED: Work Order designated for ${assignedSize} mechanic(s) maximum.`);
                return;
              }
              const { data } = await supabase.from('labor_entries').insert({
                job_id: activeJob.id,
                shop_id: DataBridge.getShopId(),
                tech_id: techId,
                phase: 'REPAIR',
                clocked_in: new Date().toISOString()
              }).select('id').single();
              if (data) setLaborEntryId(data.id);
              const newTechs = [...(activeJob?.active_techs || []), techId];
              if (TRACE_WORKFLOW) console.log('[TRACE:WORKFLOW] IgnitionKosk BEGIN REPAIR → onUpdateJob(status=in_repair): jobId=%s techId=%s techCount=%o — WORKFLOW STEP 5 (authorized→in_repair); labor_entries row created: %s', activeJob.id, techId, newTechs.length, data?.id);
              onUpdateJob({ ...activeJob, active_techs: newTechs, status: 'in_repair' });
              setIsClockedIn(true);
            }}
            className="ign-card-hover"
            style={{ height: 128, backgroundColor: '#059669', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', boxShadow: '0 10px 15px -3px rgba(6,78,59,0.20)', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Play size={32} fill="white" />
            <span style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff' }}>Parts in Bay: Acknowledge &amp; Begin Repair</span>
          </button>
        )}

        {/* SUSPEND — hover:border-orange-500 → dropped; active:scale-95 → ign-card-hover */}
        {isClockedIn && (
          <button
            onClick={async () => {
              const techId = DataBridge.load('current_user')?.id || 'TECH_01';
              if (laborEntryId) {
                await supabase.from('labor_entries').update({ clocked_out: new Date().toISOString() }).eq('id', laborEntryId);
              }
              const newTechs = (activeJob?.active_techs || []).filter(t => t !== techId);
              onUpdateJob({ ...activeJob, active_techs: newTechs });
              setIsClockedIn(false);
              setLaborEntryId(null);
            }}
            className="ign-card-hover"
            style={{ height: 128, backgroundColor: '#1e293b', border: '2px solid #334155', borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <AlertOctagon size={32} style={{ color: '#f97316' }} />
            <span style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff' }}>Suspend / Coffee Break</span>
          </button>
        )}

        {/* SCAN PART — active:scale-95 → ign-card-hover */}
        <button
          className="ign-card-hover"
          style={{ height: 112, backgroundColor: '#1e293b', borderRadius: 24, border: '2px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
        >
          <Barcode size={32} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff' }}>Scan Part / Bin</span>
        </button>

        {/* BEGIN EVAL — hover:border-blue-500 → dropped; active:scale-95 → ign-card-hover */}
        {isClockedIn && onStartEval && (
          <button
            onClick={onStartEval}
            className="ign-card-hover"
            style={{ height: 112, backgroundColor: '#0f172a', borderRadius: 24, border: '2px solid rgba(59,130,246,0.40)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Microscope size={32} style={{ color: '#60a5fa' }} />
            <span style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em', color: '#ffffff' }}>Begin Eval</span>
          </button>
        )}

        {/* REPAIR CHECKLIST */}
        {repairTasks.length > 0 && (
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} /> Repair Checklist
            </h3>
            {repairTasks.map(task => {
              const isCompleted = completedTaskIds.includes(task.id);
              return (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, border: isCompleted ? '1px solid rgba(16,185,129,0.30)' : '1px solid #334155', borderRadius: 16, backgroundColor: isCompleted ? 'rgba(16,185,129,0.10)' : '#1e293b' }}>
                  <div>
                    <p style={{ fontWeight: 700, color: isCompleted ? '#10b981' : '#ffffff', textDecoration: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.7 : 1 }}>{task.item_type} - {task.description}</p>
                    {task.labor_hours && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{task.labor_hours} hours booked</p>}
                  </div>
                  {!isCompleted && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* hover:bg-emerald-600 hover:text-white → dropped; active:scale-95 → ign-card-hover */}
                      <button onClick={async () => {
                        const techId = DataBridge.load('current_user')?.id || 'TECH_01';
                        await supabase.from('repair_logs').insert({ job_id: activeJob.id, shop_id: DataBridge.getShopId(), tech_id: techId, estimate_line_item_id: task.id, description: task.description, outcome: 'completed' });
                        setCompletedTaskIds(prev => [...prev, task.id]);
                      }} className="ign-card-hover" style={{ backgroundColor: 'rgba(5,150,105,0.20)', color: '#10b981', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <CheckCircle size={24} />
                      </button>
                      <button onClick={async () => {
                        const note = prompt("Flag Supplement for " + task.description + "\nEnter reason:");
                        if (!note) return;
                        const techId = DataBridge.load('current_user')?.id || 'TECH_01';
                        await supabase.from('repair_logs').insert({ job_id: activeJob.id, shop_id: DataBridge.getShopId(), tech_id: techId, estimate_line_item_id: task.id, description: task.description, outcome: 'supplement', tech_notes: note });
                        setCompletedTaskIds(prev => [...prev, task.id]);
                        onUpdateJob({ ...activeJob, status: 'supplement' });
                      }} className="ign-card-hover" style={{ backgroundColor: 'rgba(234,88,12,0.20)', color: '#f97316', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <AlertOctagon size={24} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* MANDATORY QC GATE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, border: qcChecked ? '1px solid rgba(16,185,129,0.30)' : '1px solid rgba(249,115,22,0.40)', borderRadius: 16, backgroundColor: qcChecked ? 'rgba(16,185,129,0.10)' : '#1e293b' }}>
              <div>
                <p style={{ fontWeight: 700, color: qcChecked ? '#10b981' : '#fb923c', textDecoration: qcChecked ? 'line-through' : 'none', opacity: qcChecked ? 0.7 : 1 }}>MANDATORY: QC / Test Drive Completed</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Required to close out repair</p>
              </div>
              {!qcChecked && (
                <button onClick={() => setQcChecked(true)} className="ign-card-hover" style={{ backgroundColor: 'rgba(5,150,105,0.20)', color: '#10b981', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <CheckCircle size={24} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE TASK / PMI WORKFLOW */}
        <div style={{ backgroundColor: '#0f172a', borderRadius: 24, border: '1px solid #1e293b', padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={14} /> Active Work Order
              </h3>
              <span style={{ backgroundColor: 'rgba(37,99,235,0.20)', color: '#3b82f6', fontSize: 10, padding: '4px 8px', borderRadius: 4, fontWeight: 700 }}>Priority</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginBottom: 4 }}>{activeJob.unit} - {activeJob.id}</p>
            <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Bay 4 // Engine Shop</p>

            {/* PINNED DIGITAL NOTE — animate-pulse on label → ign-pulse */}
            {activeJob?.status === 'SUSPENDED' && activeJob?.handover && (
              <div style={{ marginTop: 16, marginBottom: 16, borderLeft: `4px solid ${activeJob.handover.isOperable ? '#eab308' : '#ea580c'}`, padding: 16, borderRadius: '0 16px 16px 0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: activeJob.handover.isOperable ? 'rgba(234,179,8,0.10)' : 'rgba(234,88,12,0.20)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 className={!activeJob.handover.isOperable ? 'ign-pulse' : ''} style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: activeJob.handover.isOperable ? '#eab308' : '#f97316' }}>
                    {activeJob.handover.isOperable ? 'Shift Handover Note' : 'CRITICAL: DO NOT MOVE'}
                  </h3>
                </div>
                <p style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: 14, lineHeight: 1.625 }}>{activeJob.handover.note}</p>
              </div>
            )}

            {/* STATUS BADGE — w-fit → width: fit-content */}
            <div style={{
              marginTop: 8,
              fontSize: 10,
              fontWeight: 900,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              border: activeJob.status === 'AUTHORIZED' ? '1px solid rgba(16,185,129,0.20)' : '1px solid rgba(249,115,22,0.20)',
              backgroundColor: activeJob.status === 'AUTHORIZED' ? 'rgba(16,185,129,0.10)' : 'rgba(249,115,22,0.10)',
              color: activeJob.status === 'AUTHORIZED' ? '#10b981' : '#fb923c',
              width: 'fit-content',
              padding: '4px 8px',
              borderRadius: 4,
            }}>
              Workflow Status: {activeJob.status}
            </div>
          </div>

          {/* TRANSCRIBED NOTES */}
          {activeJob.notes && activeJob.notes.length > 0 && (
            <div style={{ marginTop: 16, backgroundColor: 'rgba(0,0,0,0.50)', padding: 12, borderRadius: 8, border: '1px solid #1e293b', maxHeight: 96, overflowY: 'auto' }}>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 900, marginBottom: 4 }}>TRANSCRIBED NOTES:</p>
              {activeJob.notes.map((n, i) => (
                <p key={i} style={{ fontSize: 10, color: '#34d399', fontStyle: 'italic', fontFamily: 'monospace', marginBottom: 4 }}>{n}</p>
              ))}
            </div>
          )}

          {/* DICTATE NOTES — active:bg-slate-700 → dropped (cosmetic) */}
          <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
            <button onClick={handleDictate} style={{ flex: 1, backgroundColor: '#1e293b', padding: 16, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid #334155', cursor: 'pointer' }}>
              <Mic size={20} style={{ color: '#3b82f6' }} />
              <span style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Dictate Notes</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOOL ACCOUNTABILITY */}
      {custodyEnabled && shopTools.length > 0 && isClockedIn && (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: 12, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wrench size={14} /> Tool Accountability
          </h3>
          {shopTools.map(tool => {
            const isAcked = toolAckIds.includes(tool.id);
            const isBypassing = pendingBypass === tool.id;
            return (
              <div key={tool.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, border: isAcked ? '1px solid rgba(16,185,129,0.30)' : '1px solid #334155', borderRadius: 16, backgroundColor: isAcked ? 'rgba(16,185,129,0.10)' : '#1e293b' }}>
                  <div>
                    <p style={{ fontWeight: 700, color: isAcked ? '#10b981' : '#ffffff', textDecoration: isAcked ? 'line-through' : 'none', opacity: isAcked ? 0.7 : 1 }}>{tool.name}</p>
                    {tool.type && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{tool.type}</p>}
                  </div>
                  {!isAcked && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* hover:bg-emerald-600 → dropped; active:scale-95 → ign-card-hover */}
                      <button onClick={async () => {
                        const techName = DataBridge.load('current_user')?.name || 'TECH';
                        await supabase.from('tool_signout_log').insert({ shop_id: DataBridge.getShopId(), tool_id: tool.id, tool_name: tool.name, tech_name: techName, job_id: activeJob?.id || null, action: 'CHECKED_IN' });
                        setToolAckIds(prev => [...prev, tool.id]);
                      }} className="ign-card-hover" style={{ backgroundColor: 'rgba(5,150,105,0.20)', color: '#10b981', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <CheckCircle size={24} />
                      </button>
                      {/* hover:bg-amber-600 → dropped; active:scale-95 → ign-card-hover */}
                      <button onClick={() => setPendingBypass(tool.id)} className="ign-card-hover" style={{ backgroundColor: 'rgba(217,119,6,0.20)', color: '#f59e0b', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <Shield size={24} />
                      </button>
                    </div>
                  )}
                </div>

                {isBypassing && (
                  <div style={{ marginTop: 8, backgroundColor: '#1e293b', border: '1px solid rgba(217,119,6,0.30)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ color: '#f59e0b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Manager Override Required</p>
                    {/* focus:border-amber-500 → dropped (no ign-input-amber class; flagged) */}
                    <input
                      placeholder="Reason for override (required)"
                      value={bypassReason}
                      onChange={e => setBypassReason(e.target.value)}
                      style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '12px 16px', color: '#ffffff', fontSize: 14, outline: 'none', transition: 'border-color 0.15s' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      {/* active:scale-95 → ign-card-hover; disabled:opacity-50 → inline */}
                      <button
                        onClick={async () => {
                          if (!bypassReason.trim()) return;
                          setBypassSaving(true);
                          const manager = DataBridge.load('current_user');
                          await supabase.from('tool_signout_log').insert({ shop_id: DataBridge.getShopId(), tool_id: tool.id, tool_name: tool.name, tech_name: manager?.name || 'TECH', job_id: activeJob?.id || null, action: 'CHECKED_IN', is_manager_bypass: true, bypass_by: manager?.name || 'Manager', bypass_reason: bypassReason.trim() });
                          setToolAckIds(prev => [...prev, tool.id]);
                          setPendingBypass(null);
                          setBypassReason('');
                          setBypassSaving(false);
                        }}
                        disabled={bypassSaving || !bypassReason.trim()}
                        className="ign-card-hover"
                        style={{ flex: 1, backgroundColor: '#d97706', color: '#ffffff', padding: '12px 0', borderRadius: 12, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', cursor: (bypassSaving || !bypassReason.trim()) ? 'not-allowed' : 'pointer', opacity: (bypassSaving || !bypassReason.trim()) ? 0.5 : 1 }}
                      >
                        {bypassSaving ? 'Saving...' : 'Confirm Override'}
                      </button>
                      <button
                        onClick={() => { setPendingBypass(null); setBypassReason(''); }}
                        style={{ padding: '12px 16px', backgroundColor: '#334155', color: '#cbd5e1', borderRadius: 12, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAST-ACTION BAR — backdrop-blur-md → backdropFilter inline */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(15,23,42,0.90)', backdropFilter: 'blur(12px)', paddingBottom: 96 }}>
        <SlideToComplete
          disabled={
            (repairTasks.length > 0 && !qcChecked) ||
            (custodyEnabled && shopTools.length > 0 && shopTools.some(t => !toolAckIds.includes(t.id)))
          }
          onComplete={async () => {
            if (repairTasks.length > 0 && !qcChecked) { alert("QC / Test Drive is required before completion."); return; }
            if (isDotMandated) { alert("DOT MANDATE ACTIVE: Digital Inspection Form Required before completion."); return; }
            if (isClockedIn && laborEntryId) {
              await supabase.from('labor_entries').update({ clocked_out: new Date().toISOString() }).eq('id', laborEntryId);
              setIsClockedIn(false);
              setLaborEntryId(null);
            }
            const techId = DataBridge.load('current_user')?.id || 'TECH_01';
            const newTechs = (activeJob?.active_techs || []).filter(t => t !== techId);
            onUpdateJob({ ...activeJob, active_techs: newTechs, status: 'repair_done' });
          }}
        />
        {repairTasks.length > 0 && !qcChecked && (
          <p style={{ textAlign: 'center', color: '#f97316', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', marginTop: 8 }}>Finish QC to unlock completion slider</p>
        )}
        {custodyEnabled && shopTools.length > 0 && shopTools.some(t => !toolAckIds.includes(t.id)) && (
          <p style={{ textAlign: 'center', color: '#f59e0b', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', marginTop: 8 }}>Acknowledge all tools to unlock completion</p>
        )}
      </div>
    </div>
  );
};

export default IgnitionKosk;
