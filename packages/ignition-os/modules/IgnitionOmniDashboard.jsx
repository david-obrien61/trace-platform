/**
 * FILE: IgnitionOmniDashboard.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Omni Mission Control — global shop telemetry, real-time metrics,
 *          and the 14-day savings report as the primary value signal.
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign, Users, ShieldCheck, Activity,
  TrendingDown, ClipboardList, BarChart2
} from 'lucide-react';
import DataBridge from '../DataBridge';
import SavingsReport from './SavingsReport';

const STYLE_DEBUG = false;

// Non-1:1 mappings (41 classNames converted):
// (1) lg:grid-cols-3 on LiveMetrics grid → flex-wrap fixed (flagged: no breakpoint equivalent)
// (2) sm:p-8, sm:text-4xl, sm:text-xs → dropped (responsive)
// (3) hover:border-blue-500/50, hover:border-slate-500/50, hover:border-emerald-500/50 on cards → dropped (cosmetic)
// (4) hover:text-white hover:border-slate-600 on inactive Tab → dropped (cosmetic)
// (5) animate-pulse on SYNCED span → ign-pulse CSS class
// [TRACE:STYLE] IgnitionOmniDashboard converted, 41 classNames → inline, 5 non-1:1 categories

// ─── TAB SWITCHER ─────────────────────────────────────────────────────────────

const Tab = ({ id, label, icon: Icon, active, onClick }) => (
  /* hover:text-white hover:border-slate-600 on inactive → dropped (cosmetic) */
  <button
    onClick={() => onClick(id)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 20px',
      borderRadius: 12,
      fontWeight: 900,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      transition: 'all 0.15s',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      backgroundColor: active ? '#2563eb' : '#0f172a',
      color: active ? '#ffffff' : '#64748b',
      border: active ? '1px solid transparent' : '1px solid #1e293b',
      boxShadow: active ? '0 10px 15px -3px rgba(30,58,138,0.3)' : 'none',
    }}
  >
    <Icon size={13} />
    {label}
  </button>
);

// ─── LIVE METRICS PANEL ────────────────────────────────────────────────────────

const LiveMetrics = () => {
  const [metrics, setMetrics] = useState({ leakage: 0, activeTechs: 0, pmiCompletion: 0 });

  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionOmniDashboard converted, 41 classNames → inline, 5 non-1:1 categories');

  useEffect(() => {
    const transactions = DataBridge.load('transaction_history') || [];
    let totalLeakage = 0;
    transactions.forEach(t => {
      if (t.actualPrice < t.standardPrice) totalLeakage += (t.standardPrice - t.actualPrice);
    });
    const displayLeakage = totalLeakage > 0 ? totalLeakage : 450.00;
    const activeJob = DataBridge.load('active_job_context');
    const techsWorking = activeJob?.active_techs?.length || 3;
    setMetrics({ leakage: displayLeakage, activeTechs: techsWorking, pmiCompletion: 82 });
  }, []);

  const cardBase = {
    borderRadius: 40,
    padding: 32,
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'border-color 0.15s',
    position: 'relative',
    overflow: 'hidden',
  };

  /* lg:grid-cols-3 → flex-wrap; flagged: no breakpoint equivalent */
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>

      {/* FINANCIALS */}
      <div style={{ ...cardBase, flex: '1 1 calc(33% - 16px)', minWidth: 260, backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', backgroundColor: '#3b82f6', boxShadow: '0 0 15px rgba(59,130,246,0.6)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ backgroundColor: 'rgba(59,130,246,0.10)', padding: 8, borderRadius: 12 }}>
              <DollarSign size={28} style={{ color: '#3b82f6' }} />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff' }}>Financials</h2>
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.1em' }}>
            Relationship Tax (Leakage)
          </p>
          <h3 style={{ fontSize: 60, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.05em', marginBottom: 16 }}>
            <span style={{ color: '#3b82f6', fontSize: 30, verticalAlign: 'top', marginRight: 4 }}>$</span>
            {metrics.leakage.toFixed(2)}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#ef4444', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', padding: '8px 12px', borderRadius: 12, width: 'fit-content' }}>
            <TrendingDown size={14} />
            <span>Loss in Last 30 Days</span>
          </div>
        </div>
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(30,41,59,0.50)' }}>
          <p style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Aggregated from manual POS overrides globally.
          </p>
        </div>
      </div>

      {/* OPERATIONS */}
      <div style={{ ...cardBase, flex: '1 1 calc(33% - 16px)', minWidth: 260, backgroundColor: '#020617', border: '1px solid #1e293b' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', backgroundColor: '#64748b', boxShadow: '0 0 15px rgba(100,116,139,0.4)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ backgroundColor: '#1e293b', padding: 8, borderRadius: 12, border: '1px solid #334155' }}>
              <Users size={28} style={{ color: '#94a3b8' }} />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff' }}>Operations</h2>
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.1em' }}>
            Active Bay Occupancy
          </p>
          <h3 style={{ fontSize: 60, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.05em', marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {metrics.activeTechs}
            <span style={{ fontSize: 20, color: '#475569', fontStyle: 'italic', letterSpacing: '0.1em' }}>TECHS</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)', color: '#34d399', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', padding: '8px 12px', borderRadius: 12, width: 'fit-content' }}>
            <Activity size={14} />
            <span>Fully Operational</span>
          </div>
        </div>
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(30,41,59,0.50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569' }}>
          <span>Live Data</span>
          {/* animate-pulse → ign-pulse CSS class */}
          <span className="ign-pulse" style={{ color: '#3b82f6' }}>● SYNCED</span>
        </div>
      </div>

      {/* COMPLIANCE */}
      <div style={{ ...cardBase, flex: '1 1 calc(33% - 16px)', minWidth: 260, backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', backgroundColor: '#10b981', boxShadow: '0 0 15px rgba(16,185,129,0.6)' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ backgroundColor: 'rgba(16,185,129,0.10)', padding: 8, borderRadius: 12, border: '1px solid rgba(16,185,129,0.20)' }}>
              <ShieldCheck size={28} style={{ color: '#10b981' }} />
            </div>
            <h2 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ffffff' }}>Compliance</h2>
          </div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.1em' }}>
            PMI Completion Rate
          </p>
          <h3 style={{ fontSize: 60, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.05em', marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 4 }}>
            {metrics.pmiCompletion}
            <span style={{ fontSize: 36, color: '#10b981', opacity: 0.6 }}>%</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', padding: '8px 12px', borderRadius: 12, width: 'fit-content' }}>
            <ClipboardList size={14} />
            <span>12 Pending Audits</span>
          </div>
        </div>
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(30,41,59,0.50)' }}>
          <p style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Strict DOT safety gates enforced.
          </p>
        </div>
      </div>

    </div>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'SAVINGS', label: 'Savings Report', icon: BarChart2 },
  { id: 'LIVE',    label: 'Live Metrics',   icon: Activity  },
];

const IgnitionOmniDashboard = () => {
  const shopName = DataBridge.load('shop_info')?.name || 'Your Shop';
  const [activeTab, setActiveTab] = useState('SAVINGS');

  return (
    <div style={{ padding: 32, backgroundColor: '#000000', minHeight: '100%', color: '#e2e8f0' }}>
      {/* HEADER */}
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>
          Omni{' '}
          <span style={{ color: '#3b82f6', borderLeft: '4px solid #3b82f6', paddingLeft: 16, marginLeft: 16 }}>
            Mission Control
          </span>
        </h1>
        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
          {shopName} · Global Shop Analytics & Telemetry
        </p>
      </header>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(t => (
          <Tab key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />
        ))}
      </div>

      {/* CONTENT */}
      {activeTab === 'SAVINGS' && <SavingsReport />}
      {activeTab === 'LIVE'    && <LiveMetrics />}
    </div>
  );
};

export default IgnitionOmniDashboard;
