/**
 * MODULE: PRED (Predictive PMI Engine)
 * VERSION: v2.0.0
 * DESC: AI-powered preventive maintenance scheduling. Assets surface from active jobs
 *       and manual entries. Inspection logs, AI schedule generation via Claude Haiku,
 *       ROI tracking (savings + downtime avoided).
 */

import React, { useState } from 'react';
import {
  Activity, Shield, Zap, Crown, Wrench,
  AlertCircle, CheckCircle2, TrendingUp, Lock,
  Plus, ClipboardList, ChevronDown, ChevronUp, X
} from 'lucide-react';
import DataBridge from '../DataBridge';
import AIEngine from '../AIEngine';

// ── Utilities ─────────────────────────────────────────────────────────────────

const INTERVAL_DAYS = { daily: 1, weekly: 7, monthly: 30, quarterly: 90, annually: 365 };

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

const pmiStatus = (pmiDue) => {
  if (!pmiDue) return { status: 'NO_SCHEDULE', days: null };
  const diff = Math.floor((new Date(pmiDue) - new Date()) / 86400000);
  if (diff < 0)   return { status: 'OVERDUE',   days: Math.abs(diff) };
  if (diff <= 14) return { status: 'DUE_SOON',  days: diff };
  return { status: 'HEALTHY', days: diff };
};

const statusLabel = ({ status, days }) => {
  if (status === 'OVERDUE')    return `OVERDUE ${days}d`;
  if (status === 'DUE_SOON')   return `DUE IN ${days}d`;
  if (status === 'HEALTHY')    return 'HEALTHY';
  return 'NO SCHEDULE';
};

const statusCls = (s) => ({
  OVERDUE:     'text-red-500',
  DUE_SOON:    'text-orange-400',
  HEALTHY:     'text-emerald-400',
  NO_SCHEDULE: 'text-slate-500',
}[s] || 'text-slate-500');

const riskCls = (r) => r > 70 ? 'text-red-500' : r > 40 ? 'text-orange-400' : 'text-emerald-400';

// ── Add Equipment Modal ───────────────────────────────────────────────────────

const AddAssetModal = ({ onSave, onClose }) => {
  const [form, setForm] = useState({ name: '', type: 'SHOP_EQUIPMENT', managedBy: 'SHOP' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (form.name.trim().length < 2) return;
    const asset = {
      id: `ASSET-${Date.now()}`,
      name: form.name.trim(),
      type: form.type,
      managedBy: form.managedBy,
      telematicsRisk: null,
      lastPMI: null,
      pmiDue: null,
      savingsAvoided: 0,
      createdAt: new Date().toISOString(),
      source: 'MANUAL',
    };
    DataBridge.savePMIAsset(asset);
    onSave(asset);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Add Equipment</h3>
          <button onClick={onClose}><X size={16} className="text-slate-500 hover:text-white" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Asset Name</p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Shop Compressor A"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full bg-black border border-slate-700 rounded-xl p-3 text-sm text-white font-bold"
            />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Type</p>
            <div className="flex gap-2">
              {['SHOP_EQUIPMENT', 'VEHICLE', 'TOOL'].map(t => (
                <button
                  key={t}
                  onClick={() => set('type', t)}
                  className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase border transition-colors ${
                    form.type === t
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Managed By</p>
            <div className="flex gap-2">
              {[['SHOP', 'Shop-Managed'], ['CLIENT', 'Self-PMI (Client)']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => set('managedBy', val)}
                  className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase border transition-colors ${
                    form.managedBy === val
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={form.name.trim().length < 2}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-colors"
        >
          Save Asset
        </button>
      </div>
    </div>
  );
};

// ── Log Inspection Modal ──────────────────────────────────────────────────────

const LogModal = ({ asset, schedule, onSave, onClose }) => {
  const currentUser = DataBridge.load('current_user') || {};
  const [form, setForm] = useState({
    date:   new Date().toISOString().split('T')[0],
    tech:   currentUser.name || '',
    notes:  '',
    result: 'PASS',
    tasks:  (schedule?.tasks || []).map(t => ({ ...t, passed: true })),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleTask = (i) => setForm(f => ({
    ...f,
    tasks: f.tasks.map((t, idx) => idx === i ? { ...t, passed: !t.passed } : t),
  }));

  const handleSave = () => {
    const entry = { ...form, assetId: asset.id, assetName: asset.name };
    DataBridge.logPMIInspection(asset.id, entry);

    // Compute next due: shortest interval among scheduled tasks (default 30d)
    const intervals = form.tasks.map(t => INTERVAL_DAYS[t.interval] || 30);
    const nextDays  = intervals.length > 0 ? Math.min(...intervals) : 30;
    const updated   = { ...asset, lastPMI: form.date, pmiDue: addDays(nextDays) };
    DataBridge.savePMIAsset(updated);
    onSave(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Log Inspection</h3>
            <p className="text-[9px] text-slate-500 uppercase mt-0.5">{asset.name}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-slate-500 hover:text-white" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Date</p>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full bg-black border border-slate-700 rounded-xl p-3 text-xs text-white"
              />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Technician</p>
              <input
                type="text"
                placeholder="Name"
                value={form.tech}
                onChange={e => set('tech', e.target.value)}
                className="w-full bg-black border border-slate-700 rounded-xl p-3 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Overall Result</p>
            <div className="flex gap-2">
              {[['PASS', 'bg-emerald-600 border-emerald-400'], ['NEEDS_ATTENTION', 'bg-orange-600 border-orange-400'], ['FAIL', 'bg-red-600 border-red-400']].map(([r, cls]) => (
                <button
                  key={r}
                  onClick={() => set('result', r)}
                  className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase border transition-colors ${
                    form.result === r ? `${cls} text-white` : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'
                  }`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {form.tasks.length > 0 && (
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Task Checklist</p>
              <div className="space-y-2">
                {form.tasks.map((task, i) => (
                  <div
                    key={i}
                    onClick={() => toggleTask(i)}
                    className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 cursor-pointer hover:border-slate-600"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-white">{task.name}</p>
                      <p className="text-[8px] text-slate-500 uppercase">{task.interval}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      task.passed ? 'bg-emerald-500 border-emerald-400' : 'bg-slate-700 border-slate-600'
                    }`}>
                      {task.passed && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Notes</p>
            <textarea
              placeholder="Observations, parts used, follow-up needed..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="w-full bg-black border border-slate-700 rounded-xl p-3 text-xs text-white resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-colors"
        >
          Save Inspection Log
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const PredictiveKey = ({ clientTier: propTier }) => {
  const shopInfo   = DataBridge.load('shop_info') || {};
  const rawTier    = propTier || shopInfo.tier || 'TRIAL';
  const clientTier = rawTier === 'TRIAL' ? 'PRO' : rawTier;
  const isPro      = ['PRO', 'ELITE'].includes(clientTier);
  const isElite    = clientTier === 'ELITE';
  const shopId     = DataBridge.getShopId();

  const [assets,          setAssets]          = useState(() => DataBridge.getPMIAssets());
  const [schedules,       setSchedules]       = useState(() => DataBridge.load('pmi_schedules') || {});
  const [expandedId,      setExpandedId]      = useState(null);
  const [aiLoading,       setAiLoading]       = useState({});
  const [logTarget,       setLogTarget]       = useState(null);
  const [showAdd,         setShowAdd]         = useState(false);
  const [logCounts,       setLogCounts]       = useState(() => {
    const all = DataBridge.load('pmi_logs') || {};
    return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.length]));
  });

  // ROI — recalculated from live log store each render
  const roi = (() => {
    const allLogs = Object.values(DataBridge.load('pmi_logs') || {}).flat();
    const passed  = allLogs.filter(l => l.result !== 'FAIL');
    return {
      savings:     passed.length * 450,
      downtime:    (passed.length * 2.5).toFixed(1),
      inspections: allLogs.length,
    };
  })();

  const requestAISchedule = async (asset) => {
    setAiLoading(prev => ({ ...prev, [asset.id]: true }));
    try {
      const result = await AIEngine.suggestPMI(
        { id: asset.id, name: asset.name, type: asset.type },
        shopId,
        clientTier
      );
      if (result?.tasks?.length) {
        DataBridge.savePMISchedule(asset.id, result);
        setSchedules(prev => ({ ...prev, [asset.id]: result }));
        setExpandedId(asset.id);
      }
    } catch (err) {
      console.error('[PMI] AI schedule request failed:', err);
    } finally {
      setAiLoading(prev => ({ ...prev, [asset.id]: false }));
    }
  };

  const onLogSaved = (updatedAsset) => {
    setAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    setLogCounts(prev => ({ ...prev, [updatedAsset.id]: (prev[updatedAsset.id] || 0) + 1 }));
    setLogTarget(null);
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-200 min-h-screen">

      {/* HEADER */}
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">PRED // PMI Engine</h2>
          <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">Preventive Maintenance Intelligence</p>
          <div className="mt-2">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black inline-flex items-center gap-1 ${
              isElite ? 'bg-purple-600 text-white'
              : isPro ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400'
            }`}>
              {isElite ? <Crown size={10}/> : isPro ? <Zap size={10}/> : <Shield size={10}/>}
              {rawTier === 'TRIAL' ? 'TRIAL — PRO PREVIEW' : `${clientTier} ACCESS`}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] py-2 px-4 rounded-xl uppercase tracking-widest transition-colors flex-shrink-0"
        >
          <Plus size={12} /> Add Equipment
        </button>
      </header>

      {/* ROI DASHBOARD */}
      {isPro && (
        <section className="mb-8 grid grid-cols-3 gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
            <p className="text-[10px] text-emerald-500 font-black uppercase mb-1">Repairs Avoided</p>
            <p className="text-2xl font-black text-white">${roi.savings.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl">
            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Downtime Avoided</p>
            <p className="text-2xl font-black text-white">{roi.downtime} hrs</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl">
            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Inspections Logged</p>
            <p className="text-2xl font-black text-white">{roi.inspections}</p>
          </div>
        </section>
      )}

      {/* EMPTY STATE */}
      {assets.length === 0 && (
        <div className="text-center py-16">
          <Wrench size={36} className="text-slate-700 mx-auto mb-4" />
          <p className="text-sm font-black text-slate-600 uppercase italic">No assets tracked yet</p>
          <p className="text-[10px] text-slate-700 mt-2 max-w-xs mx-auto">
            Click "Add Equipment" to register shop gear, or assets will appear automatically from active jobs.
          </p>
        </div>
      )}

      {/* ASSET LIST */}
      <div className="grid gap-4">
        {assets.map(asset => {
          const ps       = pmiStatus(asset.pmiDue);
          const schedule = schedules[asset.id];
          const isExp    = expandedId === asset.id;
          const isAiLoad = aiLoading[asset.id];
          const logs     = logCounts[asset.id] || 0;

          return (
            <div key={asset.id} className={`bg-slate-800 rounded-2xl border shadow-xl overflow-hidden ${
              ps.status === 'OVERDUE' ? 'border-red-500/30' : 'border-slate-700'
            }`}>
              <div className="p-5">

                {/* CARD HEADER */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-base font-bold text-white truncate">{asset.name}</h3>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[8px] font-black px-2 py-0.5 rounded border border-slate-600 text-slate-400 uppercase">
                        {asset.type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${
                        asset.managedBy === 'CLIENT'
                          ? 'border-amber-500/30 text-amber-500'
                          : 'border-blue-500/30 text-blue-500'
                      }`}>
                        {asset.managedBy === 'CLIENT' ? 'Self-PMI' : 'Shop-Managed'}
                      </span>
                      {asset.source === 'JOB' && (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded border border-slate-700 text-slate-600 uppercase">Job Asset</span>
                      )}
                    </div>
                  </div>

                  {/* RISK SCORE */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] text-slate-500 font-black uppercase">Health Risk</p>
                    {isPro && asset.telematicsRisk !== null ? (
                      <p className={`text-2xl font-black ${riskCls(asset.telematicsRisk)}`}>
                        {asset.telematicsRisk}%
                      </p>
                    ) : isPro ? (
                      <p className="text-xs font-black text-slate-600 mt-1">— No data</p>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-600 mt-1">
                        <Lock size={12} /><span className="text-[9px] font-bold">PRO</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PMI STATUS ROW */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Next PMI Due</p>
                    <p className="text-sm font-bold text-slate-200">{asset.pmiDue || '—'}</p>
                  </div>
                  <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                    <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Status</p>
                    <p className={`text-sm font-black ${statusCls(ps.status)}`}>
                      {statusLabel(ps)}
                    </p>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogTarget(asset)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[9px] font-black py-3 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-1.5"
                  >
                    <ClipboardList size={12} />
                    {asset.managedBy === 'CLIENT' ? 'Log Self-Inspection' : 'Log Inspection'}
                    {logs > 0 && (
                      <span className="bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded text-[8px]">{logs}</span>
                    )}
                  </button>

                  {!schedule ? (
                    <button
                      onClick={() => requestAISchedule(asset)}
                      disabled={isAiLoad}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-3 rounded-xl transition-all text-[9px] font-black uppercase flex items-center gap-1 whitespace-nowrap"
                    >
                      {isAiLoad ? <span className="animate-pulse text-slate-400">Thinking...</span> : <>⚡ AI Schedule</>}
                    </button>
                  ) : (
                    <button
                      onClick={() => setExpandedId(isExp ? null : asset.id)}
                      className="bg-slate-700 hover:bg-slate-600 text-blue-400 px-3 rounded-xl transition-all text-[9px] font-black uppercase flex items-center gap-1"
                    >
                      {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Schedule
                    </button>
                  )}
                </div>
              </div>

              {/* INLINE SCHEDULE PANEL */}
              {isExp && schedule?.tasks && (
                <div className="border-t border-slate-700 bg-slate-900/60 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">⚡ AI-Generated Schedule</p>
                    {schedule.detected_type && (
                      <span className="text-[8px] font-mono text-slate-500">{schedule.detected_type}</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {schedule.tasks.map((task, i) => (
                      <div key={i} className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-xl">
                        <div className="bg-blue-500/20 text-blue-400 text-[8px] font-black px-2 py-1 rounded uppercase whitespace-nowrap flex-shrink-0">
                          {task.interval}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-white">{task.name}</p>
                          {task.description && (
                            <p className="text-[8px] text-slate-500 mt-0.5 leading-relaxed">{task.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODALS */}
      {showAdd && (
        <AddAssetModal
          onSave={(asset) => { setAssets(prev => [...prev, asset]); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
      {logTarget && (
        <LogModal
          asset={logTarget}
          schedule={schedules[logTarget.id]}
          onSave={onLogSaved}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
};

export default PredictiveKey;
