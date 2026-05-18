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
         if (data) {
           setIsClockedIn(true);
           setLaborEntryId(data.id);
         } else {
           setIsClockedIn(false);
           setLaborEntryId(null);
         }
      });
  }, [activeJob?.id]);

  useEffect(() => {
    const policy = DataBridge.load('shop_policy') || {};
    if (!policy.enable_bay_custody) return;
    setCustodyEnabled(true);
    const shopId = DataBridge.getShopId();
    if (!shopId) return;
    supabase
      .from('tools')
      .select('id, name, type, status')
      .eq('shop_id', shopId)
      .eq('status', 'ACTIVE')
      .then(({ data }) => setShopTools(data || []));
  }, []);

  useEffect(() => {
    if (activeJob?.id && ['AUTHORIZED', 'in_repair', 'supplement', 'repair_done'].includes(activeJob.status?.toUpperCase() || '')) {
      supabase.from('estimate_line_items')
        .select('*')
        .eq('job_id', activeJob.id)
        .eq('auth_status', 'approved')
        .then(({ data }) => setRepairTasks(data || []));
        
      supabase.from('repair_logs')
        .select('estimate_line_item_id')
        .eq('job_id', activeJob.id)
        .then(({ data }) => setCompletedTaskIds((data || []).map(d => d.estimate_line_item_id)));
    } else {
      setRepairTasks([]);
    }
  }, [activeJob?.id, activeJob?.status]);

  const handleVoiceCommand = (cmd) => {
    if (cmd === 'suspend') {
      setShowHandover(true);
    }
  };

  const executeHandover = ({ note, isOperable }) => {
     const updatedJob = {
        ...activeJob,
        status: 'SUSPENDED',
        handover: { note, isOperable, timestamp: Date.now() }
     };
     onUpdateJob(updatedJob);
     setShowHandover(false);
  };

  const { isToolboxMode, voiceMode, autoLockEnabled } = usePowerSense();
  const { isListening } = useIgnitionVoice(handleVoiceCommand, voiceMode);

  const handleDictate = () => {
    const note = prompt("🎤 Simulating Voice Transcription.\nSpeak now (type your note):");
    if (note) {
      const updatedJob = {
        ...activeJob,
        notes: [...(activeJob.notes || []), `[${new Date().toLocaleTimeString()}] TRANSCRIPT: "${note}"`]
      };
      
      // Hoisted state update
      onUpdateJob(updatedJob);
    }
  };

  return (
    <div className={`p-4 bg-black text-white min-h-screen flex flex-col relative w-full h-full transition-all duration-700 ${
      isToolboxMode 
        ? 'border-[6px] border-blue-500 shadow-[0_0_120px_rgba(59,130,246,0.3)_inset] rounded-[2rem]' 
        : 'border-t-4 border-slate-900 rounded-none'
    }`}>
      {showHandover && (
        <IgnitionHandover 
          activeJob={activeJob} 
          onSubmit={executeHandover} 
          onCancel={() => setShowHandover(false)} 
        />
      )}

      {/* KIOSK ESCAPE HATCH */}
      <button onClick={onExitKiosk} className="absolute top-8 right-6 text-slate-800 hover:text-slate-500 transition-colors z-50">
        <Unlock size={20} />
      </button>

      {/* KIOSK HEADER: TIME & STATUS */}
      <header className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 mb-6 mt-4 relative overflow-hidden">
        {isListening && (
           <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
        )}
        <div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isListening ? 'text-blue-500 animate-pulse' : 'text-blue-500'}`}>
            {isListening ? 'Tech Station 01 (Listening)' : 'Tech Station 01'}
          </p>
          <h2 className="text-3xl font-black tabular-nums">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Current Status</p>
          <span className={`text-xs font-black px-3 py-1 rounded-full ${isClockedIn ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {isClockedIn ? 'ON THE CLOCK' : 'CLOCKED OUT'}
          </span>
        </div>
      </header>

      {/* PRIMARY KIOSK ACTIONS */}
      <div className="grid grid-cols-1 gap-4 flex-1">
        
        {/* SOFT-GATED REPAIR CLOCK: PARTS ACKNOWLEDGMENT */}
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
              onUpdateJob({ ...activeJob, active_techs: newTechs, status: 'in_repair' });
              setIsClockedIn(true);
            }}
            className="h-32 bg-emerald-600 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/20 w-full"
          >
            <Play size={32} fill="white" />
            <span className="text-xl font-black uppercase italic tracking-tighter text-white">Parts in Bay: Acknowledge & Begin Repair</span>
          </button>
        )}

        {isClockedIn && (
          <button 
            onClick={async () => {
              const techId = DataBridge.load('current_user')?.id || 'TECH_01';
              if (laborEntryId) {
                await supabase.from('labor_entries').update({
                  clocked_out: new Date().toISOString()
                }).eq('id', laborEntryId);
              }
              const newTechs = (activeJob?.active_techs || []).filter(t => t !== techId);
              onUpdateJob({ ...activeJob, active_techs: newTechs });
              setIsClockedIn(false);
              setLaborEntryId(null);
            }}
            className="h-32 bg-slate-800 border-2 border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all hover:border-orange-500 active:scale-95 w-full"
          >
            <AlertOctagon size={32} className="text-orange-500" />
            <span className="text-xl font-black uppercase italic tracking-tighter text-white">Suspend / Coffee Break</span>
          </button>
        )}

        {/* SCAN / INVENTORY ACTION */}
        <button className="h-28 bg-slate-800 rounded-3xl border-2 border-slate-700 flex flex-col items-center justify-center gap-2 active:scale-95">
          <Barcode size={32} className="text-blue-500" />
          <span className="text-lg font-black uppercase italic tracking-tighter text-white">Scan Part / Bin</span>
        </button>

        {/* BEGIN EVALUATION */}
        {isClockedIn && onStartEval && (
          <button
            onClick={onStartEval}
            className="h-28 bg-slate-900 rounded-3xl border-2 border-blue-500/40 hover:border-blue-500 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Microscope size={32} className="text-blue-400" />
            <span className="text-lg font-black uppercase italic tracking-tighter text-white">Begin Eval</span>
          </button>
        )}

        {/* REPAIR CHECKLIST (Visible when authorized or in_repair) */}
        {repairTasks.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
            <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2"><Activity size={14} /> Repair Checklist</h3>
            {repairTasks.map(task => {
              const isCompleted = completedTaskIds.includes(task.id);
              return (
                <div key={task.id} className={`flex justify-between items-center p-4 border rounded-2xl ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
                  <div>
                    <p className={`font-bold ${isCompleted ? 'text-emerald-500 line-through opacity-70' : 'text-white'}`}>{task.item_type} - {task.description}</p>
                    {task.labor_hours && <p className="text-xs text-slate-400 mt-1">{task.labor_hours} hours booked</p>}
                  </div>
                  {!isCompleted && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                         const techId = DataBridge.load('current_user')?.id || 'TECH_01';
                         await supabase.from('repair_logs').insert({
                            job_id: activeJob.id,
                            shop_id: DataBridge.getShopId(),
                            tech_id: techId,
                            estimate_line_item_id: task.id,
                            description: task.description,
                            outcome: 'completed'
                         });
                         setCompletedTaskIds(prev => [...prev, task.id]);
                      }} className="bg-emerald-600/20 text-emerald-500 p-3 rounded-xl hover:bg-emerald-600 hover:text-white transition-colors active:scale-95">
                        <CheckCircle size={24} />
                      </button>
                      <button onClick={async () => {
                         const note = prompt("Flag Supplement for " + task.description + "\nEnter reason:");
                         if (!note) return;
                         const techId = DataBridge.load('current_user')?.id || 'TECH_01';
                         await supabase.from('repair_logs').insert({
                            job_id: activeJob.id,
                            shop_id: DataBridge.getShopId(),
                            tech_id: techId,
                            estimate_line_item_id: task.id,
                            description: task.description,
                            outcome: 'supplement',
                            tech_notes: note
                         });
                         setCompletedTaskIds(prev => [...prev, task.id]);
                         onUpdateJob({ ...activeJob, status: 'supplement' });
                      }} className="bg-orange-600/20 text-orange-500 p-3 rounded-xl hover:bg-orange-600 hover:text-white transition-colors active:scale-95">
                        <AlertOctagon size={24} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            
            {/* MANDATORY QC GATE */}
            <div className={`flex justify-between items-center p-4 border rounded-2xl ${qcChecked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-orange-500/40'}`}>
              <div>
                <p className={`font-bold ${qcChecked ? 'text-emerald-500 line-through opacity-70' : 'text-orange-400'}`}>MANDATORY: QC / Test Drive Completed</p>
                <p className="text-xs text-slate-400 mt-1">Required to close out repair</p>
              </div>
              {!qcChecked && (
                <button onClick={() => setQcChecked(true)} className="bg-emerald-600/20 text-emerald-500 p-3 rounded-xl hover:bg-emerald-600 hover:text-white transition-colors active:scale-95">
                  <CheckCircle size={24} />
                </button>
              )}
            </div>

          </div>
        )}

        {/* ACTIVE TASK / PMI WORKFLOW */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
                <ClipboardList size={14} /> Active Work Order
              </h3>
              <span className="bg-blue-600/20 text-blue-500 text-[10px] px-2 py-1 rounded font-bold">Priority</span>
            </div>
            <p className="text-xl font-black text-white mb-1">{activeJob.unit} - {activeJob.id}</p>
            <p className="text-xs text-slate-500 mb-2">Bay 4 // Engine Shop</p>
            
            {/* PINNED DIGITAL NOTE (High-Visibility Safety Injection) */}
            {activeJob?.status === 'SUSPENDED' && activeJob?.handover && (
              <div className={`mt-4 mb-4 border-l-4 p-4 rounded-r-2xl shadow-lg ${
                activeJob.handover.isOperable ? 'bg-yellow-500/10 border-yellow-500' : 'bg-orange-600/20 border-orange-600'
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${
                    activeJob.handover.isOperable ? 'text-yellow-500' : 'text-orange-500 animate-pulse'
                  }`}>
                    {activeJob.handover.isOperable ? 'Shift Handover Note' : 'CRITICAL: DO NOT MOVE'}
                  </h3>
                </div>
                <p className="text-white font-mono text-sm leading-relaxed">{activeJob.handover.note}</p>
              </div>
            )}

            <div className={`mt-2 text-[10px] font-black uppercase flex items-center gap-1 border w-fit px-2 py-1 rounded ${
              activeJob.status === 'AUTHORIZED' 
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' 
                : 'border-orange-500/20 bg-orange-500/10 text-orange-400'
            }`}>
              Workflow Status: {activeJob.status}
            </div>
          </div>
          
          {/* Notes display inside Kosk */}
          {activeJob.notes && activeJob.notes.length > 0 && (
            <div className="mt-4 bg-black/50 p-3 rounded-lg border border-slate-800 max-h-24 overflow-y-auto">
              <p className="text-[10px] text-slate-500 font-black mb-1">TRANSCRIBED NOTES:</p>
              {activeJob.notes.map((n, i) => (
                <p key={i} className="text-[10px] text-emerald-400 italic font-mono mb-1">{n}</p>
              ))}
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button onClick={handleDictate} className="flex-1 bg-slate-800 p-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 active:bg-slate-700">
              <Mic size={20} className="text-blue-500" />
              <span className="text-xs font-black uppercase">Dictate Notes</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOOL ACCOUNTABILITY (only when bay custody is enabled and clocked in) */}
      {custodyEnabled && shopTools.length > 0 && isClockedIn && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
          <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
            <Wrench size={14} /> Tool Accountability
          </h3>
          {shopTools.map(tool => {
            const isAcked = toolAckIds.includes(tool.id);
            const isBypassing = pendingBypass === tool.id;
            return (
              <div key={tool.id}>
                <div className={`flex justify-between items-center p-4 border rounded-2xl ${isAcked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
                  <div>
                    <p className={`font-bold ${isAcked ? 'text-emerald-500 line-through opacity-70' : 'text-white'}`}>{tool.name}</p>
                    {tool.type && <p className="text-xs text-slate-400 mt-1">{tool.type}</p>}
                  </div>
                  {!isAcked && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const techName = DataBridge.load('current_user')?.name || 'TECH';
                          await supabase.from('tool_signout_log').insert({
                            shop_id: DataBridge.getShopId(),
                            tool_id: tool.id,
                            tool_name: tool.name,
                            tech_name: techName,
                            job_id: activeJob?.id || null,
                            action: 'CHECKED_IN',
                          });
                          setToolAckIds(prev => [...prev, tool.id]);
                        }}
                        className="bg-emerald-600/20 text-emerald-500 p-3 rounded-xl hover:bg-emerald-600 hover:text-white transition-colors active:scale-95"
                      >
                        <CheckCircle size={24} />
                      </button>
                      <button
                        onClick={() => setPendingBypass(tool.id)}
                        className="bg-amber-600/20 text-amber-500 p-3 rounded-xl hover:bg-amber-600 hover:text-white transition-colors active:scale-95"
                      >
                        <Shield size={24} />
                      </button>
                    </div>
                  )}
                </div>
                {isBypassing && (
                  <div className="mt-2 bg-slate-800 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3">
                    <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Manager Override Required</p>
                    <input
                      placeholder="Reason for override (required)"
                      value={bypassReason}
                      onChange={e => setBypassReason(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (!bypassReason.trim()) return;
                          setBypassSaving(true);
                          const manager = DataBridge.load('current_user');
                          await supabase.from('tool_signout_log').insert({
                            shop_id: DataBridge.getShopId(),
                            tool_id: tool.id,
                            tool_name: tool.name,
                            tech_name: manager?.name || 'TECH',
                            job_id: activeJob?.id || null,
                            action: 'CHECKED_IN',
                            is_manager_bypass: true,
                            bypass_by: manager?.name || 'Manager',
                            bypass_reason: bypassReason.trim(),
                          });
                          setToolAckIds(prev => [...prev, tool.id]);
                          setPendingBypass(null);
                          setBypassReason('');
                          setBypassSaving(false);
                        }}
                        disabled={bypassSaving || !bypassReason.trim()}
                        className="flex-1 bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                      >
                        {bypassSaving ? 'Saving...' : 'Confirm Override'}
                      </button>
                      <button
                        onClick={() => { setPendingBypass(null); setBypassReason(''); }}
                        className="px-4 py-3 bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase"
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

      {/* THE GREASEMONKEY FAST-ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-md pb-24">
        <SlideToComplete
          disabled={
            (repairTasks.length > 0 && !qcChecked) ||
            (custodyEnabled && shopTools.length > 0 && shopTools.some(t => !toolAckIds.includes(t.id)))
          }
          onComplete={async () => {
            if (repairTasks.length > 0 && !qcChecked) {
                alert("QC / Test Drive is required before completion.");
                return;
            }
            if (isDotMandated) {
                alert("DOT MANDATE ACTIVE: Digital Inspection Form Required before completion.");
                return;
            }
            if (isClockedIn && laborEntryId) {
               await supabase.from('labor_entries').update({
                 clocked_out: new Date().toISOString()
               }).eq('id', laborEntryId);
               setIsClockedIn(false);
               setLaborEntryId(null);
            }
            
            const techId = DataBridge.load('current_user')?.id || 'TECH_01';
            const newTechs = (activeJob?.active_techs || []).filter(t => t !== techId);
            onUpdateJob({ ...activeJob, active_techs: newTechs, status: 'repair_done' });
          }}
        />
        {repairTasks.length > 0 && !qcChecked && (
          <p className="text-center text-orange-500 text-[10px] font-black uppercase mt-2">Finish QC to unlock completion slider</p>
        )}
        {custodyEnabled && shopTools.length > 0 && shopTools.some(t => !toolAckIds.includes(t.id)) && (
          <p className="text-center text-amber-500 text-[10px] font-black uppercase mt-2">Acknowledge all tools to unlock completion</p>
        )}
      </div>

    </div>
  );
};

export default IgnitionKosk;
