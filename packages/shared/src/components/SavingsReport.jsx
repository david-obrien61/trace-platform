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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt$ = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtK = (n) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt$(n);

const Stat = ({ label, value, sub, color = 'text-white', size = 'text-4xl' }) => (
  <div className="flex flex-col gap-1">
    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
    <p className={`${size} font-black italic tracking-tighter ${color}`}>{value}</p>
    {sub && <p className="text-[9px] text-slate-600">{sub}</p>}
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

    // ── Real transaction data ──────────────────────────────────────────────
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

    // ── Wizard baseline (used when no real transactions yet) ───────────────
    const wizardCheck   = policy.first_margin_check;
    let projectedAnnual = 0;
    let wizardLeakage   = 0;

    if (wizardCheck) {
      wizardLeakage   = wizardCheck.leakagePerPart || 0;
      const weekly    = wizardCheck.weeklyParts || 10;
      projectedAnnual = wizardLeakage * weekly * 52;
    }

    // ── Quarterly analytics from ExternalBridge ────────────────────────────
    const quarterlyData = ExternalBridge.analytics.getQuarterlyMargins();

    // ── Change log impact ──────────────────────────────────────────────────
    const changeImpact = ExternalBridge.analytics.getChangeImpact();

    // ── Summary numbers to display ─────────────────────────────────────────
    const hasRealData   = withinTrial.length > 0;
    const displayRevenue      = hasRealData ? realRevenue       : 0;
    const displayCaptured     = hasRealData ? realCaptured      : 0;
    const displayLeakage      = hasRealData ? realLeakage       : wizardLeakage;
    const displayProjected    = projectedAnnual;

    // Margin engine value: what the system suggested vs what was actually billed
    // If real data exists, this is measured. Otherwise, project from wizard.
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
  const color = daysLeft > 7 ? 'bg-blue-500' : daysLeft > 3 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center gap-6">
      <div className="flex-shrink-0">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke={daysLeft > 7 ? '#3b82f6' : daysLeft > 3 ? '#f97316' : '#ef4444'}
              strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - trialPct / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-white">{daysLeft}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Free Trial</p>
        <p className="text-lg font-black text-white italic uppercase tracking-tighter">
          {daysLeft > 0 ? `${daysLeft} Days Left` : 'Trial Complete'}
        </p>
        <p className="text-[9px] text-slate-500 mt-0.5">
          Day {daysActive} of 14 · {daysLeft > 0 ? 'Data collecting automatically' : 'Ready for full report'}
        </p>
      </div>
      {daysLeft <= 3 && daysLeft > 0 && (
        <div className="ml-auto flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2">
          <AlertCircle size={14} className="text-orange-400" />
          <p className="text-[9px] font-black text-orange-400 uppercase">Trial ending soon</p>
        </div>
      )}
    </div>
  );
};

const ValueSummary = ({ data }) => {
  const { hasRealData, displayRevenue, displayCaptured, displayLeakage, displayProjected, wizardCheck } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* CAPTURED MARGIN */}
      <div className="bg-slate-900 border border-emerald-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-emerald-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {hasRealData ? 'Gross Profit Captured' : 'Projected Annual Value'}
          </p>
        </div>
        <p className="text-5xl font-black italic text-emerald-400 tracking-tighter mb-2">
          {hasRealData ? fmtK(displayCaptured) : fmtK(displayProjected)}
        </p>
        <p className="text-[9px] text-slate-500">
          {hasRealData
            ? `From ${data.transactions.length} job${data.transactions.length !== 1 ? 's' : ''} this trial period`
            : 'Based on your margin check during setup'}
        </p>
        {!hasRealData && wizardCheck && (
          <div className="mt-4 pt-4 border-t border-slate-800 text-[9px] text-slate-600">
            <p>{fmt$(wizardCheck.leakagePerPart)}/part × {wizardCheck.weeklyParts} parts/week × 52 weeks</p>
          </div>
        )}
      </div>

      {/* LEAKAGE DETECTED */}
      <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={16} className="text-red-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {hasRealData ? 'Margin Leakage Detected' : 'Leakage Per Part'}
          </p>
        </div>
        <p className="text-5xl font-black italic text-red-400 tracking-tighter mb-2">
          {hasRealData ? fmtK(displayLeakage) : fmt$(displayLeakage)}
        </p>
        <p className="text-[9px] text-slate-500">
          {hasRealData
            ? 'Revenue below suggested pricing this period'
            : 'Gap between your price and the engine\'s suggestion'}
        </p>
        {displayLeakage > 0 && (
          <div className="mt-4 flex items-center gap-2 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
            <AlertCircle size={12} className="text-red-400" />
            <p className="text-[8px] font-black text-red-400 uppercase">
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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} className="text-blue-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setup Discovery — {wizardCheck.partName}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-[8px] text-slate-600 uppercase mb-1">You Paid Vendor</p>
          <p className="text-xl font-black text-slate-300">{fmt$(wizardCheck.costPaid)}</p>
        </div>
        <div>
          <p className="text-[8px] text-slate-600 uppercase mb-1">You Charged</p>
          <p className="text-xl font-black text-white">{fmt$(wizardCheck.priceCharged)}</p>
        </div>
        <div>
          <p className="text-[8px] text-slate-600 uppercase mb-1">Engine Suggests</p>
          <p className="text-xl font-black text-emerald-400">{fmt$(suggested)}</p>
        </div>
      </div>
      {wizardCheck.leakagePerPart > 0 && (
        <p className="text-[9px] text-slate-500 mt-3">
          Ignition OS priced this at <span className="text-emerald-400 font-black">{fmt$(suggested)}</span> automatically —
          {' '}<span className="text-emerald-400 font-black">{fmt$(wizardCheck.leakagePerPart)} more</span> than you charged manually.
        </p>
      )}
    </div>
  );
};

const QuarterlyChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxRevenue = Math.max(...data.map(q => q.totalRevenue), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart2 size={14} className="text-blue-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quarterly Revenue History</p>
      </div>
      <div className="flex items-end gap-3 h-32">
        {data.map((q) => {
          const heightPct = (q.totalRevenue / maxRevenue) * 100;
          return (
            <div key={q.quarter} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-[8px] font-black text-emerald-400">{q.avgMarginPct}%</p>
              <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                <div
                  className="w-full bg-blue-600/60 border border-blue-500/30 rounded-t-lg transition-all hover:bg-blue-500/60"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <p className="text-[8px] font-mono text-slate-500">{q.quarter}</p>
              <p className="text-[8px] font-black text-slate-400">{fmtK(q.totalRevenue)}</p>
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
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={14} className="text-purple-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pricing Change Impact</p>
      </div>
      <div className="space-y-3">
        {relevant.slice(0, 5).map((c, i) => {
          const improved = c.afterAvgMargin > c.beforeAvgMargin;
          return (
            <div key={i} className="flex items-center gap-4 bg-black border border-slate-800 rounded-2xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate">{c.field_changed}</p>
                <p className="text-[8px] text-slate-600">{c.changed_by} · {new Date(c.changed_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono flex-shrink-0">
                <span className="text-slate-500">{c.beforeAvgMargin ?? '—'}%</span>
                <ChevronRight size={12} className="text-slate-700" />
                <span className={improved ? 'text-emerald-400' : 'text-red-400'}>
                  {c.afterAvgMargin ?? '—'}%
                </span>
              </div>
              {c.afterAvgMargin && c.beforeAvgMargin && (
                <span className={`text-[8px] font-black px-2 py-1 rounded-full flex-shrink-0 ${improved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
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
  <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-3xl p-8 text-center shadow-2xl">
    <Zap size={32} className="text-blue-400 mx-auto mb-4" />
    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">
      {daysLeft > 0 ? `${daysLeft} Days to Decide` : 'Your Trial Data Is Ready'}
    </h3>
    <p className="text-sm text-slate-400 mb-2 max-w-sm mx-auto">
      {annualValue > 0
        ? `Ignition OS is tracking ${fmtK(annualValue)} in annual margin opportunity for your shop.`
        : 'Ignition OS is actively protecting your pricing on every job.'}
    </p>
    <p className="text-[9px] text-slate-600 mb-6">Full version includes multi-user access, QuickBooks sync, and compliance reporting.</p>
    <button className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/40 active:scale-95">
      Activate Full Version
    </button>
    <p className="text-[8px] text-slate-600 mt-3 uppercase tracking-wider">No data lost · Pricing rules carry over</p>
  </div>
);

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const SavingsReport = () => {
  const data = useSavingsData();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black italic text-white uppercase tracking-tighter">
            Trial Savings Report
          </h2>
          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">
            Since {data.startedAt.toLocaleDateString()} · {data.daysActive} day{data.daysActive !== 1 ? 's' : ''} of data
          </p>
        </div>
        {!data.hasRealData && (
          <span className="text-[8px] font-black text-blue-400 bg-blue-400/10 border border-blue-400/20 px-3 py-1.5 rounded-full uppercase">
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
