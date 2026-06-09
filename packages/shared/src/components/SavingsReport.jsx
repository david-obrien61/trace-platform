/**
 * FILE: modules/SavingsReport.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: 14-day trial savings report. Shows the shop owner exactly what Ignition OS
 *          caught and protected in dollar terms — the conversion hook to paid subscription.
 *          Works from day 1 using wizard data, improves with real transaction history.
 */

import React, { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Clock, Zap,
  ShieldCheck, AlertCircle, ChevronRight, BarChart2
} from 'lucide-react';
import DataBridge from '../DataBridge';
import { MarginEngine } from '../MarginEngine';
import ExternalBridge from '../ExternalBridge';

const STYLE_DEBUG = true; // [TRACE:STYLE] STD-003

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt$ = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt$(n);

const SIZE_MAP = { 'text-4xl': 36, 'text-2xl': 24, 'text-xl': 20, 'text-lg': 18 };
const COLOR_MAP = {
  'text-white': '#fff', 'text-emerald-400': '#34d399', 'text-red-400': '#f87171',
  'text-blue-400': '#60a5fa', 'text-orange-400': '#fb923c',
};

const Stat = ({ label, value, sub, color = 'text-white', size = 'text-4xl' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
    <p style={{ fontSize: SIZE_MAP[size] ?? 36, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.05em', color: COLOR_MAP[color] ?? '#fff' }}>{value}</p>
    {sub && <p style={{ fontSize: 9, color: '#475569' }}>{sub}</p>}
  </div>
);

// ─── DATA ENGINE ─────────────────────────────────────────────────────────────

const useSavingsData = () => {
  return useMemo(() => {
    const policy      = DataBridge.load('shop_policy') || {};
    const startedAt   = policy.onboarding_completed_at
      ? new Date(policy.onboarding_completed_at)
      : new Date();
    const now         = new Date();
    const daysActive  = Math.max(1, Math.floor((now - startedAt) / (1000 * 60 * 60 * 24)));
    const daysLeft    = Math.max(0, 14 - daysActive);
    const trialPct    = Math.min(100, (daysActive / 14) * 100);

    const transactions  = DataBridge.load('transaction_history') || [];
    const withinTrial   = transactions.filter(tx => tx.timestamp >= startedAt.getTime());

    let realCaptured  = 0;
    let realLeakage   = 0;
    let realRevenue   = 0;

    withinTrial.forEach(tx => {
      const { suggested, leakage } = MarginEngine.analyzeTransaction(tx);
      realRevenue   += tx.actualPrice || 0;
      realCaptured  += tx.actualPrice - (tx.cost || 0);
      realLeakage   += leakage;
    });

    const wizardCheck   = policy.first_margin_check;
    let projectedAnnual = 0;
    let wizardLeakage   = 0;

    if (wizardCheck) {
      wizardLeakage   = wizardCheck.leakagePerPart || 0;
      const weekly    = wizardCheck.weeklyParts || 10;
      projectedAnnual = wizardLeakage * weekly * 52;
    }

    const quarterlyData = ExternalBridge.analytics.getQuarterlyMargins();
    const changeImpact  = ExternalBridge.analytics.getChangeImpact();

    const hasRealData      = withinTrial.length > 0;
    const displayRevenue   = hasRealData ? realRevenue  : 0;
    const displayCaptured  = hasRealData ? realCaptured : 0;
    const displayLeakage   = hasRealData ? realLeakage  : wizardLeakage;
    const displayProjected = projectedAnnual;

    const engineValue = hasRealData
      ? withinTrial.reduce((s, tx) => {
          const { suggested } = MarginEngine.analyzeTransaction(tx);
          return s + Math.max(0, suggested - (tx.actualPrice || 0) + (tx.actualPrice - (tx.cost || 0)));
        }, 0)
      : (wizardCheck ? (MarginEngine.calculateRetail(wizardCheck.costPaid) - wizardCheck.costPaid) : 0);

    return {
      daysActive, daysLeft, trialPct, startedAt,
      hasRealData, transactions: withinTrial,
      displayRevenue, displayCaptured, displayLeakage, displayProjected,
      engineValue, wizardCheck, quarterlyData, changeImpact,
    };
  }, []);
};

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────

const TrialCountdown = ({ daysLeft, daysActive, trialPct }) => {
  const strokeColor = daysLeft > 7 ? '#3b82f6' : daysLeft > 3 ? '#f97316' : '#ef4444';

  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          <svg style={{ width: 64, height: 64, transform: 'rotate(-90deg)' }} viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke={strokeColor}
              strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - trialPct / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{daysLeft}</span>
          </div>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Free Trial</p>
        <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
          {daysLeft > 0 ? `${daysLeft} Days Left` : 'Trial Complete'}
        </p>
        <p style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
          Day {daysActive} of 14 · {daysLeft > 0 ? 'Data collecting automatically' : 'Ready for full report'}
        </p>
      </div>
      {daysLeft <= 3 && daysLeft > 0 && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 12, padding: '8px 16px' }}>
          <AlertCircle size={14} color="#fb923c" />
          <p style={{ fontSize: 9, fontWeight: 900, color: '#fb923c', textTransform: 'uppercase' }}>Trial ending soon</p>
        </div>
      )}
    </div>
  );
};

const ValueSummary = ({ data }) => {
  const { hasRealData, displayCaptured, displayLeakage, displayProjected, wizardCheck } = data;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* CAPTURED MARGIN */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: '#10b981', boxShadow: '0 0 15px rgba(16,185,129,0.5)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={16} color="#34d399" />
          <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {hasRealData ? 'Gross Profit Captured' : 'Projected Annual Value'}
          </p>
        </div>
        <p style={{ fontSize: 48, fontWeight: 900, fontStyle: 'italic', color: '#34d399', letterSpacing: '-0.05em', marginBottom: 8 }}>
          {hasRealData ? fmtK(displayCaptured) : fmtK(displayProjected)}
        </p>
        <p style={{ fontSize: 9, color: '#64748b' }}>
          {hasRealData
            ? `From ${data.transactions.length} job${data.transactions.length !== 1 ? 's' : ''} this trial period`
            : 'Based on your margin check during setup'}
        </p>
        {!hasRealData && wizardCheck && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e293b', fontSize: 9, color: '#475569' }}>
            <p>{fmt$(wizardCheck.leakagePerPart)}/part × {wizardCheck.weeklyParts} parts/week × 52 weeks</p>
          </div>
        )}
      </div>

      {/* LEAKAGE DETECTED */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: '#ef4444', boxShadow: '0 0 15px rgba(239,68,68,0.4)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingDown size={16} color="#f87171" />
          <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {hasRealData ? 'Margin Leakage Detected' : 'Leakage Per Part'}
          </p>
        </div>
        <p style={{ fontSize: 48, fontWeight: 900, fontStyle: 'italic', color: '#f87171', letterSpacing: '-0.05em', marginBottom: 8 }}>
          {hasRealData ? fmtK(displayLeakage) : fmt$(displayLeakage)}
        </p>
        <p style={{ fontSize: 9, color: '#64748b' }}>
          {hasRealData
            ? 'Revenue below suggested pricing this period'
            : "Gap between your price and the engine's suggestion"}
        </p>
        {displayLeakage > 0 && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 12, padding: '8px 12px' }}>
            <AlertCircle size={12} color="#f87171" />
            <p style={{ fontSize: 8, fontWeight: 900, color: '#f87171', textTransform: 'uppercase' }}>
              {hasRealData ? 'Override pricing was used on these jobs' : 'Pricing rules will close this gap automatically'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const WizardFinding = ({ wizardCheck }) => {
  if (!wizardCheck) return null;
  const suggested = MarginEngine.calculateRetail(wizardCheck.costPaid);

  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Zap size={14} color="#60a5fa" />
        <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Setup Discovery — {wizardCheck.partName}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div>
          <p style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>You Paid Vendor</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#cbd5e1' }}>{fmt$(wizardCheck.costPaid)}</p>
        </div>
        <div>
          <p style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>You Charged</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{fmt$(wizardCheck.priceCharged)}</p>
        </div>
        <div>
          <p style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Engine Suggests</p>
          <p style={{ fontSize: 20, fontWeight: 900, color: '#34d399' }}>{fmt$(suggested)}</p>
        </div>
      </div>
      {wizardCheck.leakagePerPart > 0 && (
        <p style={{ fontSize: 9, color: '#64748b', marginTop: 12 }}>
          Ignition OS priced this at <span style={{ color: '#34d399', fontWeight: 900 }}>{fmt$(suggested)}</span> automatically —
          {' '}<span style={{ color: '#34d399', fontWeight: 900 }}>{fmt$(wizardCheck.leakagePerPart)} more</span> than you charged manually.
        </p>
      )}
    </div>
  );
};

const QuarterlyChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxRevenue = Math.max(...data.map(q => q.totalRevenue), 1);

  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <BarChart2 size={14} color="#60a5fa" />
        <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quarterly Revenue History</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 128 }}>
        {data.map((q) => {
          const heightPct = (q.totalRevenue / maxRevenue) * 100;
          return (
            <div key={q.quarter} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <p style={{ fontSize: 8, fontWeight: 900, color: '#34d399' }}>{q.avgMarginPct}%</p>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 80 }}>
                <div
                  style={{ width: '100%', backgroundColor: 'rgba(37,99,235,0.6)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px 6px 0 0', height: `${heightPct}%` }}
                />
              </div>
              <p style={{ fontSize: 8, fontFamily: 'monospace', color: '#64748b' }}>{q.quarter}</p>
              <p style={{ fontSize: 8, fontWeight: 900, color: '#94a3b8' }}>{fmtK(q.totalRevenue)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChangeImpactLog = ({ changes }) => {
  if (!changes || changes.length === 0) return null;
  const relevant = changes.filter(c => c.beforeCount > 0 || c.afterCount > 0);
  if (relevant.length === 0) return null;

  return (
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <ShieldCheck size={14} color="#c084fc" />
        <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pricing Change Impact</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {relevant.slice(0, 5).map((c, i) => {
          const improved = c.afterAvgMargin > c.beforeAvgMargin;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, backgroundColor: '#000', border: '1px solid #1e293b', borderRadius: 16, padding: '12px 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.field_changed}</p>
                <p style={{ fontSize: 8, color: '#475569' }}>{c.changed_by} · {new Date(c.changed_at).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}>
                <span style={{ color: '#64748b' }}>{c.beforeAvgMargin ?? '—'}%</span>
                <ChevronRight size={12} color="#334155" />
                <span style={{ color: improved ? '#34d399' : '#f87171' }}>
                  {c.afterAvgMargin ?? '—'}%
                </span>
              </div>
              {c.afterAvgMargin && c.beforeAvgMargin && (
                <span style={{ fontSize: 8, fontWeight: 900, padding: '4px 8px', borderRadius: 999, flexShrink: 0, backgroundColor: improved ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: improved ? '#34d399' : '#f87171' }}>
                  {improved ? '+' : ''}{(c.afterAvgMargin - c.beforeAvgMargin).toFixed(1)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConversionCTA = ({ daysLeft, annualValue }) => (
  <div style={{ background: 'linear-gradient(135deg, rgba(30,58,138,0.4), #0f172a)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 24, padding: 32, textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
    <Zap size={32} color="#60a5fa" style={{ display: 'block', margin: '0 auto 16px' }} />
    <h3 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>
      {daysLeft > 0 ? `${daysLeft} Days to Decide` : 'Your Trial Data Is Ready'}
    </h3>
    <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 384, margin: '0 auto 8px' }}>
      {annualValue > 0
        ? `Ignition OS is tracking ${fmtK(annualValue)} in annual margin opportunity for your shop.`
        : 'Ignition OS is actively protecting your pricing on every job.'}
    </p>
    <p style={{ fontSize: 9, color: '#475569', marginBottom: 24 }}>Full version includes multi-user access, QuickBooks sync, and compliance reporting.</p>
    <button className="ign-card-hover" style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '16px 40px', borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, boxShadow: '0 20px 25px rgba(30,58,138,0.4)', border: 'none', cursor: 'pointer' }}>
      Activate Full Version
    </button>
    <p style={{ fontSize: 8, color: '#475569', marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>No data lost · Pricing rules carry over</p>
  </div>
);

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const SavingsReport = () => {
  const data = useSavingsData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
            Trial Savings Report
          </h2>
          <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
            Since {data.startedAt.toLocaleDateString()} · {data.daysActive} day{data.daysActive !== 1 ? 's' : ''} of data
          </p>
        </div>
        {!data.hasRealData && (
          <span style={{ fontSize: 8, fontWeight: 900, color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', padding: '6px 12px', borderRadius: 999, textTransform: 'uppercase' }}>
            Projected · Create jobs to see real data
          </span>
        )}
      </div>

      <TrialCountdown daysLeft={data.daysLeft} daysActive={data.daysActive} trialPct={data.trialPct} />
      <ValueSummary data={data} />
      {data.wizardCheck && <WizardFinding wizardCheck={data.wizardCheck} />}
      {data.quarterlyData?.length > 0 && <QuarterlyChart data={data.quarterlyData} />}
      {data.changeImpact?.length > 0 && <ChangeImpactLog changes={data.changeImpact} />}
      <ConversionCTA daysLeft={data.daysLeft} annualValue={data.displayProjected} />
    </div>
  );
};

export default SavingsReport;
