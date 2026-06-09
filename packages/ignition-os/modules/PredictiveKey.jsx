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
import AIEngine from '@trace/shared/ai/AIEngine';

const STYLE_DEBUG = true;

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

const statusColor = (s) => ({
  OVERDUE:     '#ef4444',
  DUE_SOON:    '#fb923c',
  HEALTHY:     '#34d399',
  NO_SCHEDULE: '#64748b',
}[s] || '#64748b');

const riskColor = (r) => r > 70 ? '#ef4444' : r > 40 ? '#fb923c' : '#34d399';

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
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)',
      backdropFilter: 'blur(4px)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        backgroundColor: '#0f172a', border: '1px solid #334155',
        borderRadius: 24, padding: 24, width: '100%', maxWidth: 384, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', letterSpacing: '-0.05em', textTransform: 'uppercase', margin: 0 }}>
            Add Equipment
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} style={{ color: '#64748b' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Asset Name</p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Shop Compressor A"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="ign-input"
              style={{
                width: '100%', backgroundColor: '#000000', border: '1px solid #334155',
                borderRadius: 12, padding: '12px', fontSize: 14, color: '#ffffff',
                fontWeight: 700, boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Type</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['SHOP_EQUIPMENT', 'VEHICLE', 'TOOL'].map(t => (
                <button
                  key={t}
                  onClick={() => set('type', t)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 12,
                    fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                    border: form.type === t ? '1px solid #60a5fa' : '1px solid #334155',
                    backgroundColor: form.type === t ? '#2563eb' : '#1e293b',
                    color: form.type === t ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Managed By</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['SHOP', 'Shop-Managed'], ['CLIENT', 'Self-PMI (Client)']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => set('managedBy', val)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 12,
                    fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                    border: form.managedBy === val ? '1px solid #6ee7b7' : '1px solid #334155',
                    backgroundColor: form.managedBy === val ? '#059669' : '#1e293b',
                    color: form.managedBy === val ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                  }}
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
          style={{
            width: '100%', marginTop: 24,
            backgroundColor: form.name.trim().length < 2 ? '#1e293b' : '#2563eb',
            color: form.name.trim().length < 2 ? '#64748b' : '#ffffff',
            fontWeight: 900, padding: '16px 0', borderRadius: 12,
            fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em',
            border: 'none', cursor: form.name.trim().length < 2 ? 'not-allowed' : 'pointer',
            opacity: form.name.trim().length < 2 ? 0.6 : 1,
          }}
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
    const intervals = form.tasks.map(t => INTERVAL_DAYS[t.interval] || 30);
    const nextDays  = intervals.length > 0 ? Math.min(...intervals) : 30;
    const updated   = { ...asset, lastPMI: form.date, pmiDue: addDays(nextDays) };
    DataBridge.savePMIAsset(updated);
    onSave(updated);
  };

  const RESULT_STYLES = {
    PASS:            { bg: '#059669', bd: '#6ee7b7' },
    NEEDS_ATTENTION: { bg: '#d97706', bd: '#fcd34d' },
    FAIL:            { bg: '#dc2626', bd: '#f87171' },
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.80)',
      backdropFilter: 'blur(4px)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        backgroundColor: '#0f172a', border: '1px solid #334155',
        borderRadius: 24, padding: 24, width: '100%', maxWidth: 384,
        maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', letterSpacing: '-0.05em', textTransform: 'uppercase', margin: 0 }}>
              Log Inspection
            </h3>
            <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>{asset.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} style={{ color: '#64748b' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Date</p>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="ign-input"
                style={{
                  width: '100%', backgroundColor: '#000000', border: '1px solid #334155',
                  borderRadius: 12, padding: '12px', fontSize: 12, color: '#ffffff', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Technician</p>
              <input
                type="text"
                placeholder="Name"
                value={form.tech}
                onChange={e => set('tech', e.target.value)}
                className="ign-input"
                style={{
                  width: '100%', backgroundColor: '#000000', border: '1px solid #334155',
                  borderRadius: 12, padding: '12px', fontSize: 12, color: '#ffffff', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Overall Result</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['PASS', 'NEEDS_ATTENTION', 'FAIL'].map(r => {
                const s = RESULT_STYLES[r];
                const isActive = form.result === r;
                return (
                  <button
                    key={r}
                    onClick={() => set('result', r)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 12,
                      fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                      border: isActive ? `1px solid ${s.bd}` : '1px solid #334155',
                      backgroundColor: isActive ? s.bg : '#1e293b',
                      color: isActive ? '#ffffff' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    {r.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {form.tasks.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Task Checklist</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.tasks.map((task, i) => (
                  <div
                    key={i}
                    onClick={() => toggleTask(i)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: '#1e293b', padding: 12, borderRadius: 12,
                      border: '1px solid #334155', cursor: 'pointer',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#ffffff', margin: 0 }}>{task.name}</p>
                      <p style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>{task.interval}</p>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: task.passed ? '2px solid #6ee7b7' : '2px solid #475569',
                      backgroundColor: task.passed ? '#10b981' : '#334155',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {task.passed && <CheckCircle2 size={10} style={{ color: '#ffffff' }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Notes</p>
            <textarea
              placeholder="Observations, parts used, follow-up needed..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="ign-input"
              style={{
                width: '100%', backgroundColor: '#000000', border: '1px solid #334155',
                borderRadius: 12, padding: '12px', fontSize: 12, color: '#ffffff',
                resize: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          style={{
            width: '100%', marginTop: 24, backgroundColor: '#059669', color: '#ffffff',
            fontWeight: 900, padding: '16px 0', borderRadius: 12,
            fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em',
            border: 'none', cursor: 'pointer',
          }}
        >
          Save Inspection Log
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const PredictiveKey = ({ clientTier: propTier }) => {
  if (STYLE_DEBUG) console.log('[TRACE:STYLE] PredictiveKey mounted');

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

  const roi = (() => {
    const allLogs = Object.values(DataBridge.load('pmi_logs') || {}).flat();
    const passed  = allLogs.filter(l => l.result !== 'FAIL');
    return {
      savings:     passed.length * 450,
      downtime:    (passed.length * 2.5).toFixed(1),
      inspections: allLogs.length,
    };
  })();

  // Tier badge style
  const tierBadgeStyle = isElite
    ? { backgroundColor: '#7c3aed', color: '#ffffff' }
    : isPro
    ? { backgroundColor: '#2563eb', color: '#ffffff' }
    : { backgroundColor: '#1e293b', color: '#94a3b8' };

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
    <div style={{ padding: 24, backgroundColor: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>

      {/* HEADER */}
      <header style={{
        marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', letterSpacing: '-0.05em', textTransform: 'uppercase', margin: 0 }}>
            PRED // PMI Engine
          </h2>
          <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            Preventive Maintenance Intelligence
          </p>
          <div style={{ marginTop: 8 }}>
            <span style={{
              ...tierBadgeStyle,
              padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {isElite ? <Crown size={10}/> : isPro ? <Zap size={10}/> : <Shield size={10}/>}
              {rawTier === 'TRIAL' ? 'TRIAL — PRO PREVIEW' : `${clientTier} ACCESS`}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="ign-card-hover"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            backgroundColor: '#2563eb', color: '#ffffff',
            fontWeight: 900, fontSize: 10, padding: '8px 16px', borderRadius: 12,
            textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Plus size={12} /> Add Equipment
        </button>
      </header>

      {/* ROI DASHBOARD */}
      {isPro && (
        <section style={{ marginBottom: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{
            backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
            padding: 16, borderRadius: 16,
          }}>
            <p style={{ fontSize: 10, color: '#10b981', fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 }}>Repairs Avoided</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: 0 }}>${roi.savings.toLocaleString()}</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: 16, borderRadius: 16 }}>
            <p style={{ fontSize: 10, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 }}>Downtime Avoided</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: 0 }}>{roi.downtime} hrs</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: 16, borderRadius: 16 }}>
            <p style={{ fontSize: 10, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 }}>Inspections Logged</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: 0 }}>{roi.inspections}</p>
          </div>
        </section>
      )}

      {/* EMPTY STATE */}
      {assets.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64 }}>
          <Wrench size={36} style={{ color: '#334155', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, fontWeight: 900, color: '#475569', textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>No assets tracked yet</p>
          <p style={{ fontSize: 10, color: '#334155', marginTop: 8, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
            Click "Add Equipment" to register shop gear, or assets will appear automatically from active jobs.
          </p>
        </div>
      )}

      {/* ASSET LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {assets.map(asset => {
          const ps       = pmiStatus(asset.pmiDue);
          const schedule = schedules[asset.id];
          const isExp    = expandedId === asset.id;
          const isAiLoad = aiLoading[asset.id];
          const logs     = logCounts[asset.id] || 0;
          const cardBd   = ps.status === 'OVERDUE' ? 'rgba(239,68,68,0.3)' : '#334155';

          return (
            <div key={asset.id} style={{
              backgroundColor: '#1e293b', borderRadius: 16,
              border: `1px solid ${cardBd}`, boxShadow: '0 20px 25px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: 20 }}>

                {/* CARD HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                    <h3 style={{
                      fontSize: 16, fontWeight: 700, color: '#ffffff', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{asset.name}</h3>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 8, fontWeight: 900, padding: '2px 8px', borderRadius: 4,
                        border: '1px solid #475569', color: '#94a3b8', textTransform: 'uppercase',
                      }}>
                        {asset.type.replace(/_/g, ' ')}
                      </span>
                      <span style={{
                        fontSize: 8, fontWeight: 900, padding: '2px 8px', borderRadius: 4,
                        textTransform: 'uppercase',
                        border: asset.managedBy === 'CLIENT' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(59,130,246,0.3)',
                        color: asset.managedBy === 'CLIENT' ? '#f59e0b' : '#3b82f6',
                      }}>
                        {asset.managedBy === 'CLIENT' ? 'Self-PMI' : 'Shop-Managed'}
                      </span>
                      {asset.source === 'JOB' && (
                        <span style={{
                          fontSize: 8, fontWeight: 900, padding: '2px 8px', borderRadius: 4,
                          border: '1px solid #334155', color: '#475569', textTransform: 'uppercase',
                        }}>Job Asset</span>
                      )}
                    </div>
                  </div>

                  {/* RISK SCORE */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 9, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', margin: 0 }}>Health Risk</p>
                    {isPro && asset.telematicsRisk !== null ? (
                      <p style={{ fontSize: 24, fontWeight: 900, color: riskColor(asset.telematicsRisk), margin: 0 }}>
                        {asset.telematicsRisk}%
                      </p>
                    ) : isPro ? (
                      <p style={{ fontSize: 12, fontWeight: 900, color: '#475569', marginTop: 4 }}>— No data</p>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569', marginTop: 4 }}>
                        <Lock size={12} /><span style={{ fontSize: 9, fontWeight: 700 }}>PRO</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PMI STATUS ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    backgroundColor: 'rgba(15,23,42,0.5)', padding: 12, borderRadius: 12,
                    border: '1px solid #334155',
                  }}>
                    <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 900, marginBottom: 4 }}>Next PMI Due</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', margin: 0 }}>{asset.pmiDue || '—'}</p>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(15,23,42,0.5)', padding: 12, borderRadius: 12,
                    border: '1px solid #334155',
                  }}>
                    <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', fontWeight: 900, marginBottom: 4 }}>Status</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: statusColor(ps.status), margin: 0 }}>
                      {statusLabel(ps)}
                    </p>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setLogTarget(asset)}
                    style={{
                      flex: 1, backgroundColor: '#334155', color: '#ffffff',
                      fontSize: 9, fontWeight: 900, padding: '12px 0', borderRadius: 12,
                      textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                    }}
                  >
                    <ClipboardList size={12} />
                    {asset.managedBy === 'CLIENT' ? 'Log Self-Inspection' : 'Log Inspection'}
                    {logs > 0 && (
                      <span style={{
                        backgroundColor: '#475569', color: '#cbd5e1',
                        padding: '2px 6px', borderRadius: 4, fontSize: 8,
                      }}>{logs}</span>
                    )}
                  </button>

                  {!schedule ? (
                    <button
                      onClick={() => requestAISchedule(asset)}
                      disabled={isAiLoad}
                      style={{
                        backgroundColor: isAiLoad ? '#1e293b' : '#7c3aed',
                        color: isAiLoad ? '#64748b' : '#ffffff',
                        padding: '0 12px', borderRadius: 12,
                        fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                        border: 'none', cursor: isAiLoad ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                        opacity: isAiLoad ? 0.7 : 1,
                      }}
                    >
                      {isAiLoad
                        ? <span className="ign-pulse" style={{ color: '#94a3b8' }}>Thinking...</span>
                        : <>⚡ AI Schedule</>
                      }
                    </button>
                  ) : (
                    <button
                      onClick={() => setExpandedId(isExp ? null : asset.id)}
                      style={{
                        backgroundColor: '#334155', color: '#60a5fa',
                        padding: '0 12px', borderRadius: 12,
                        fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      Schedule
                    </button>
                  )}
                </div>
              </div>

              {/* INLINE SCHEDULE PANEL */}
              {isExp && schedule?.tasks && (
                <div style={{
                  borderTop: '1px solid #334155', backgroundColor: 'rgba(15,23,42,0.6)', padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                      ⚡ AI-Generated Schedule
                    </p>
                    {schedule.detected_type && (
                      <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#64748b' }}>{schedule.detected_type}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {schedule.tasks.map((task, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        backgroundColor: 'rgba(30,41,59,0.6)', padding: 12, borderRadius: 12,
                      }}>
                        <div style={{
                          backgroundColor: 'rgba(59,130,246,0.2)', color: '#60a5fa',
                          fontSize: 8, fontWeight: 900, padding: '4px 8px', borderRadius: 4,
                          textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {task.interval}
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#ffffff', margin: 0 }}>{task.name}</p>
                          {task.description && (
                            <p style={{ fontSize: 8, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>{task.description}</p>
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
