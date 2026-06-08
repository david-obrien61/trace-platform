import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, DollarSign, Package, ArrowUpRight, TrendingUp,
  Mic, TrendingDown, UserPlus, QrCode, AlertCircle, Zap, Eye, EyeOff,
} from 'lucide-react';
import DataBridge from '../DataBridge';
import { supabase } from '../supabase';

const DEMO_LEAKAGE_ROWS = [
  { customer: 'Demo — Hansen Trucking', description: 'Engine Rebuild (8.0h)',      billed: 760,  target: 1000, leakage: 240, isDemo: true },
  { customer: 'Demo — Garcia Fleet',    description: 'Transmission Svc (3.5h)',    billed: 298,  target: 438,  leakage: 140, isDemo: true },
  { customer: 'Demo — Smith Auto',      description: 'Brake Overhaul (2.0h)',      billed: 220,  target: 250,  leakage: 30,  isDemo: true },
];

const StaffManagement = () => {
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [enrollLink, setEnrollLink]   = useState('');
  const keys = Object.keys(DataBridge.getSystemRoles());

  const createNewStaff = () => {
    if (!name) return alert("Name required");
    const enrollmentToken = Math.random().toString(36).substring(7);
    const newProfile = {
      id: `TECH_${Math.floor(Math.random() * 1000)}`,
      name,
      phone,
      permissions: selectedKeys,
      status: 'PENDING_ENROLLMENT',
      token: enrollmentToken,
    };
    const pending = DataBridge.load('pending_users') || [];
    pending.push(newProfile);
    DataBridge.save('pending_users', pending);
    setEnrollLink(`${window.location.origin}/?enroll=${enrollmentToken}`);
    setName(''); setPhone(''); setSelectedKeys([]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 mt-8 shadow-2xl">
      <h3 className="text-xs font-black uppercase text-slate-400 mb-8 flex items-center gap-3 tracking-widest">
        <UserPlus size={18} className="text-emerald-500" /> Staff Management & Enrollment
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <input placeholder="Staff Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm mb-4 text-white focus:border-blue-500 outline-none" />
          <input placeholder="Phone / Email" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm mb-6 text-white focus:border-blue-500 outline-none" />
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Assign Permission Keys</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {keys.map(k => (
              <button
                key={k}
                onClick={() => setSelectedKeys(prev => prev.includes(k) ? prev.filter(p => p !== k) : [...prev, k])}
                className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${selectedKeys.includes(k) ? 'bg-blue-600 border-blue-500 text-white drop-shadow-md' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}
              >
                {k}
              </button>
            ))}
          </div>
          <button onClick={createNewStaff} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] tracking-widest font-black uppercase px-8 py-4 rounded-2xl shadow-lg transition-colors">
            Generate Invite Link
          </button>
        </div>

        {enrollLink && (
          <div className="bg-black/40 p-8 rounded-[2rem] border-2 border-dashed border-emerald-500/30 flex flex-col items-center justify-center text-center">
            <QrCode size={56} className="text-emerald-500 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Pending Enrollment Secured</p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 w-full mb-4">
              <a href={enrollLink} className="text-[10px] text-blue-400 break-all font-mono hover:text-blue-300" target="_blank" rel="noreferrer">{enrollLink}</a>
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-2">Open this link on target device to assign PIN.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ComplianceGuard = () => {
  const [guardActive, setGuardActive] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [saving, setSaving]           = useState(false);
  const shopId = DataBridge.getShopId();

  useEffect(() => {
    if (!shopId) return;
    supabase.from('shops').select('is_dot_mandated').eq('id', shopId).single()
      .then(({ data }) => {
        if (data && data.is_dot_mandated !== null) setGuardActive(data.is_dot_mandated);
      });
  }, [shopId]);

  const setAndPersist = async (value) => {
    setSaving(true);
    await supabase.from('shops').update({ is_dot_mandated: value }).eq('id', shopId);
    setSaving(false);
    setGuardActive(value);
  };

  const handleToggle = () => {
    if (guardActive) setShowWarning(true);
    else setAndPersist(true);
  };

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl mt-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-black text-white uppercase italic">DOT Compliance Gate</h3>
          <p className="text-[10px] text-slate-500 uppercase">Forces digital DVIR before asset release</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`w-14 h-8 rounded-full transition-all relative disabled:opacity-50 ${guardActive ? 'bg-emerald-600' : 'bg-red-600'}`}
        >
          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${guardActive ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      {showWarning && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-[10px] font-black text-red-500 uppercase mb-2 animate-pulse tracking-widest">!!! CRITICAL WARNING !!!</p>
          <p className="text-xs text-slate-300 leading-tight mb-4">
            Disabling this gate removes the FMCSA-mandated inspection barrier. Assets can be released without safety documentation.
            <span className="text-white font-bold italic"> Disable at your own peril.</span>
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowWarning(false)} className="flex-1 bg-slate-800 text-white text-[10px] font-black py-3 rounded-lg">
              CANCEL
            </button>
            <button
              onClick={() => { setShowWarning(false); setAndPersist(false); DataBridge.smartSync('COMPLIANCE_BYPASS', { event: 'COMPLIANCE_BYPASS_ENABLED', timestamp: new Date().toISOString(), user: 'Owner_Admin', warning_displayed: true, status: 'DANGEROUS' }); }}
              className="flex-1 bg-red-600 text-white text-[10px] font-black py-3 rounded-lg"
            >
              I ACCEPT LIABILITY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LeakageAudit = ({ auditData, isDemo, marginConfig, onUpdateConfig }) => {
  const [editing, setEditing]   = useState(false);
  const [laborRate, setLaborRate] = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setLaborRate(String(marginConfig?.labor_rate ?? 125));
  }, [marginConfig]);

  const totalLeakage = auditData.reduce((sum, r) => sum + r.leakage, 0);

  const saveConfig = async () => {
    setSaving(true);
    await onUpdateConfig({ ...marginConfig, labor_rate: parseFloat(laborRate) || 125 });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="mt-8">
      {isDemo && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
          <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-[9px] font-black uppercase tracking-widest">
            Demo data shown — process real invoices to see live leakage
          </p>
        </div>
      )}

      {/* MARGIN TARGETS */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Target Rates</p>
          <button
            onClick={() => setEditing(!editing)}
            className="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors"
          >
            {editing ? 'Cancel' : 'Edit Rates'}
          </button>
        </div>

        {!editing ? (
          <div className="flex gap-8">
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">Labor Rate</p>
              <p className="text-base font-black text-white">${marginConfig?.labor_rate ?? 125}/hr</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">Parts Markup</p>
              <p className="text-base font-black text-white">{Math.round((marginConfig?.parts_markup ?? 0.40) * 100)}%</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                Target Labor Rate ($/hr)
              </label>
              <input
                type="number"
                value={laborRate}
                onChange={e => setLaborRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-black py-3 rounded-xl uppercase tracking-widest transition-colors"
            >
              {saving ? 'Saving...' : 'Save My Rates'}
            </button>
          </div>
        )}
      </div>

      {/* LEAKAGE TABLE */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 italic">
              <TrendingDown size={16} className="text-red-500" /> Margin Leakage Audit
            </h3>
            <p className="text-[9px] text-slate-500 font-mono uppercase">Target Rate vs. Billed Rate</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-red-500 uppercase">Potential Leakage</p>
            <p className="text-2xl font-black text-white">
              -${totalLeakage.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-4 text-[8px] font-black text-slate-600 uppercase pb-2 px-2">
            <span>Customer</span>
            <span>Service</span>
            <span>Billed</span>
            <span className="text-right">Leakage</span>
          </div>
          {auditData.map((row, i) => (
            <div key={i} className="grid grid-cols-4 items-center bg-black/40 p-3 rounded-xl border border-slate-800 text-[10px]">
              <span className="font-bold text-white uppercase tracking-tighter truncate">
                {row.customer}{row.isDemo ? ' *' : ''}
              </span>
              <span className="text-slate-400 truncate">{row.description}</span>
              <span className="font-mono text-slate-400">${row.billed.toFixed(0)}</span>
              <span className="text-right font-black text-red-500">-${row.leakage.toFixed(0)}</span>
            </div>
          ))}
        </div>

        {isDemo && (
          <p className="text-[9px] text-slate-600 mt-4 italic">
            * Demo rows — process real invoices to see your actual margin data.
          </p>
        )}

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
          <p className="text-[9px] text-slate-500 italic max-w-[200px]">
            Leakage = labor billed below your target rate.
          </p>
          <button className="bg-slate-800 hover:bg-red-900/20 hover:text-red-500 text-slate-400 text-[9px] font-black px-4 py-2 rounded-lg border border-slate-700 transition-all uppercase">
            Export for Tax/Marketing
          </button>
        </div>
      </div>
    </div>
  );
};

const DEMO_VELOCITY_ROWS = [
  { name: 'Demo — Martinez', efficiency: 118, flaggedHours: 9.4,  actualHours: 7.97, jobCount: 4, isDemo: true },
  { name: 'Demo — Johnson',  efficiency: 102, flaggedHours: 6.0,  actualHours: 5.88, jobCount: 3, isDemo: true },
  { name: 'Demo — Williams', efficiency:  87, flaggedHours: 5.2,  actualHours: 5.98, jobCount: 2, isDemo: true },
];

const effBadgeClass = (eff) =>
  eff >= 100
    ? 'text-emerald-400 border-emerald-500/30'
    : eff >= 85
    ? 'text-amber-400 border-amber-500/30'
    : 'text-red-400 border-red-500/30';

const VelocityLeaderboard = () => {
  const [visible, setVisible] = useState(false);
  const [rows, setRows]       = useState([]);
  const [isDemo, setIsDemo]   = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    const shopId = DataBridge.getShopId();
    if (!shopId) return;
    setLoading(true);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: entries } = await supabase
      .from('labor_entries')
      .select('tech_id, job_id, duration_minutes, shop_members(name)')
      .eq('shop_id', shopId)
      .gte('clocked_in', thirtyDaysAgo)
      .not('clocked_out', 'is', null)
      .gt('duration_minutes', 0);

    if (!entries || entries.length === 0) {
      setRows(DEMO_VELOCITY_ROWS);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    const jobIds = [...new Set(entries.map(e => e.job_id))];

    const { data: estimates } = await supabase
      .from('estimates')
      .select('id, job_id')
      .in('job_id', jobIds);

    const jobToEstimate = {};
    (estimates || []).forEach(e => { jobToEstimate[e.job_id] = e.id; });

    const estimateIds = Object.values(jobToEstimate);
    const estimateFlaggedHours = {};

    if (estimateIds.length > 0) {
      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('estimate_id, labor_hours')
        .in('estimate_id', estimateIds)
        .eq('item_type', 'labor')
        .eq('auth_status', 'authorized');

      (lineItems || []).forEach(li => {
        estimateFlaggedHours[li.estimate_id] =
          (estimateFlaggedHours[li.estimate_id] || 0) + parseFloat(li.labor_hours || 0);
      });
    }

    const techMap = {};
    entries.forEach(entry => {
      const techId   = entry.tech_id;
      const techName = entry.shop_members?.name || 'Unknown Tech';

      if (!techMap[techId]) {
        techMap[techId] = { name: techName, actualMinutes: 0, flaggedHours: 0, countedJobs: new Set(), jobCount: 0 };
      }
      techMap[techId].actualMinutes += entry.duration_minutes;

      if (!techMap[techId].countedJobs.has(entry.job_id)) {
        techMap[techId].countedJobs.add(entry.job_id);
        techMap[techId].jobCount += 1;
        const estId = jobToEstimate[entry.job_id];
        if (estId) techMap[techId].flaggedHours += estimateFlaggedHours[estId] || 0;
      }
    });

    const computed = Object.values(techMap)
      .map(t => {
        const actualHours = t.actualMinutes / 60;
        const efficiency  = actualHours > 0 ? Math.round((t.flaggedHours / actualHours) * 100) : 0;
        return { name: t.name, efficiency, flaggedHours: t.flaggedHours, actualHours, jobCount: t.jobCount };
      })
      .filter(t => t.actualHours > 0)
      .sort((a, b) => b.efficiency - a.efficiency);

    const useDemo = computed.length === 0;
    setRows(useDemo ? DEMO_VELOCITY_ROWS : computed);
    setIsDemo(useDemo);
    setLoading(false);
  }, []);

  const handleToggle = () => {
    if (!visible) fetchLeaderboard();
    setVisible(v => !v);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mt-8 shadow-2xl">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 tracking-tighter">
            <Zap size={16} className="text-amber-400" /> Velocity Leaderboard
          </h3>
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">
            Flagged hrs sold vs. clocked — last 30 days
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${
            visible
              ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              : 'bg-amber-600 border-amber-500 text-white hover:bg-amber-500'
          }`}
        >
          {visible ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
        </button>
      </div>

      {visible && (
        <div className="mt-6">
          {isDemo && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
              <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
              <p className="text-amber-400 text-[9px] font-black uppercase tracking-widest">
                Demo data — clock real labor entries to see live efficiency
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-slate-500 text-[10px] font-mono uppercase tracking-widest">
              Loading...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 text-[8px] font-black text-slate-600 uppercase px-3 pb-2 tracking-widest">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Tech</span>
                <span className="col-span-2 text-center">Jobs</span>
                <span className="col-span-2 text-center">Flagged</span>
                <span className="col-span-2 text-center">Clocked</span>
                <span className="col-span-1 text-right">Eff%</span>
              </div>

              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 items-center bg-black/40 p-3 rounded-xl border border-slate-800">
                    <span className="col-span-1 text-[10px] font-black text-slate-500">{i + 1}</span>
                    <span className="col-span-4 text-[10px] font-bold text-white uppercase tracking-tighter truncate pr-2">
                      {row.name}{row.isDemo ? ' *' : ''}
                    </span>
                    <span className="col-span-2 text-center text-[10px] font-mono text-slate-400">{row.jobCount}</span>
                    <span className="col-span-2 text-center text-[10px] font-mono text-slate-400">{row.flaggedHours.toFixed(1)}h</span>
                    <span className="col-span-2 text-center text-[10px] font-mono text-slate-400">{row.actualHours.toFixed(1)}h</span>
                    <span className={`col-span-1 text-right text-[10px] font-black ${effBadgeClass(row.efficiency).split(' ')[0]}`}>
                      {row.efficiency}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
                <p className="text-[9px] text-slate-500 italic max-w-[300px]">
                  Eff% = flagged hours sold ÷ actual clocked hours. Above 100% = faster than estimate.
                </p>
                {isDemo && (
                  <p className="text-[9px] text-slate-600 italic">* Demo</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const IgnitionOmni = ({ activeJob, onEnterKiosk }) => {
  const [trialModules, setTrialModules] = useState([]);
  const [auditData, setAuditData]       = useState([]);
  const [isAuditDemo, setIsAuditDemo]   = useState(false);
  const [marginConfig, setMarginConfig] = useState({ labor_rate: 125, parts_markup: 0.40 });
  const [stats, setStats]               = useState({ revenue: 0, jobCount: 0, inventoryValue: 0, efficiency: 0 });

  const fetchData = useCallback(async () => {
    const shopId = DataBridge.getShopId();
    if (!shopId) return;

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Jobs for stats
    const { data: monthJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('shop_id', shopId)
      .gte('created_at', monthStart.toISOString());

    const jobsList      = monthJobs || [];
    const completedJobs = jobsList.filter(j => ['closed','invoiced','COMPLETE','AUTHORIZED'].includes(j.status));

    const monthRevenue = completedJobs.reduce((sum, j) => {
      const parts = (j.suggestedParts || j.parts || []).reduce((s, p) => s + (p.retailPrice || p.retail_price || 0), 0);
      const labor = (j.tasks || j.labor || []).reduce((s, t) => s + ((t.billed_hours || 0) * (t.rate || 0)), 0);
      return sum + parts + labor;
    }, 0);

    const inventory    = DataBridge.load('inventory_items') || [];
    const inventoryVal = inventory.reduce((sum, i) => sum + ((i.cost || 0) * (i.qty || 0)), 0);
    const efficiency   = jobsList.length > 0 ? Math.round((completedJobs.length / jobsList.length) * 100) : 0;

    setStats({ revenue: monthRevenue, jobCount: jobsList.length, inventoryValue: inventoryVal, efficiency });

    // Subscriptions / trials
    const subs = DataBridge.load('system_subscriptions') || {};
    const trls = [];
    Object.keys(subs).forEach(key => {
      if (subs[key].trialActive) {
        const { daysRemaining } = DataBridge.checkTrialStatus(key);
        trls.push({ module: `${key} MODULE`, daysLeft: daysRemaining });
      }
    });
    setTrialModules(trls);

    // HONEST DEBT 🔴 (E): shops.margin_config {labor_rate, parts_markup} is display-only storage —
    //   not wired to any pricing calculation. Defer unification to Cost-to-Produce tile session.
    //   Migration checklist: docs/audits/margin-engine-migration-checklist-2026-06-10.md
    // Margin config from Supabase
    const { data: shopRow } = await supabase
      .from('shops')
      .select('margin_config')
      .eq('id', shopId)
      .single();
    const config = shopRow?.margin_config || { labor_rate: 125, parts_markup: 0.40 };
    setMarginConfig(config);

    // Real invoices + line items for leakage audit (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invoicesRaw } = await supabase
      .from('invoices')
      .select('id, total, customer_id, created_at, invoice_line_items(item_type, labor_hours, labor_rate, line_total)')
      .eq('shop_id', shopId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    // Customer names
    const custIds = [...new Set((invoicesRaw || []).map(i => i.customer_id).filter(Boolean))];
    let custMap = {};
    if (custIds.length > 0) {
      const { data: custs } = await supabase
        .from('customers')
        .select('id, first_name, last_name')
        .in('id', custIds);
      (custs || []).forEach(c => { custMap[c.id] = `${c.first_name} ${c.last_name || ''}`.trim(); });
    }

    const auditRows = [];
    for (const inv of (invoicesRaw || [])) {
      const laborItems = (inv.invoice_line_items || []).filter(
        li => li.item_type === 'labor' && li.labor_hours && li.line_total
      );
      if (laborItems.length === 0) continue;
      const totalHours  = laborItems.reduce((s, li) => s + parseFloat(li.labor_hours), 0);
      const actualBilled = laborItems.reduce((s, li) => s + parseFloat(li.line_total), 0);
      const targetBilled = totalHours * config.labor_rate;
      const leakage      = targetBilled - actualBilled;
      if (leakage <= 0) continue;
      auditRows.push({
        customer:    custMap[inv.customer_id] || 'Customer',
        description: `${totalHours.toFixed(1)}h labor`,
        billed:      actualBilled,
        target:      targetBilled,
        leakage,
        isDemo:      false,
      });
    }

    const useDemo = auditRows.length === 0;
    setIsAuditDemo(useDemo);
    setAuditData(useDemo ? DEMO_LEAKAGE_ROWS : auditRows);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // HONEST DEBT 🔴 (E): writes to shops.margin_config (display storage only — see read-path comment above).
  const handleUpdateMarginConfig = async (newConfig) => {
    const shopId = DataBridge.getShopId();
    if (!shopId) return;
    const { error } = await supabase.from('shops').update({ margin_config: newConfig }).eq('id', shopId);
    if (!error) { setMarginConfig(newConfig); fetchData(); }
  };

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">OMNI // Command</h2>
        <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">
          Shop Performance Metrics // {DataBridge.load('shop_info')?.name || 'Your Shop'}
        </p>
      </header>

      {/* TOP LEVEL TOTALS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Monthly Revenue',  val: `$${(stats.revenue / 1000).toFixed(1)}k`,         change: `${stats.jobCount} jobs`, icon: <DollarSign size={16}/> },
          { label: 'Active Trials',    val: trialModules.length.toString(),                    change: 'Tracking',               icon: <Users size={16}/> },
          { label: 'Inventory Value',  val: `$${(stats.inventoryValue / 1000).toFixed(1)}k`,  change: 'Live',                   icon: <Package size={16}/> },
          { label: 'Completion Rate',  val: stats.efficiency > 0 ? `${stats.efficiency}%` : '—', change: 'This Month',          icon: <TrendingUp size={16}/> },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-slate-800 rounded-lg text-blue-500">{stat.icon}</div>
              <span className="text-[10px] font-black text-emerald-500 flex items-center">{stat.change} <ArrowUpRight size={10}/></span>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase">{stat.label}</p>
            <p className="text-xl font-black text-white italic">{stat.val}</p>
          </div>
        ))}
      </div>

      {/* TRIAL & BLIND-SPOT TRACKER */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
        <h3 className="text-xs font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" /> Trial Conversion Pipeline
        </h3>
        <div className="space-y-4">
          {trialModules.length === 0 ? (
            <div className="text-center font-mono text-xs text-slate-500 italic p-6 border border-dashed border-slate-700 rounded-xl">
              No active test-flights or trials currently running. Check Marketplace.
            </div>
          ) : (
            trialModules.map((trial, i) => (
              <div key={i} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <p className="text-sm font-bold text-white uppercase">{trial.module}</p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">{trial.daysLeft} Days Remaining</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* LIVE INTELLIGENCE FEED */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
        <h3 className="text-xs font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
          <Mic size={16} className="text-blue-500" /> Live Feed (KOSK Sync)
        </h3>
        <div className="space-y-3">
          {activeJob?.notes && activeJob.notes.length > 0 ? (
            activeJob.notes.map((n, i) => (
              <div key={i} className="bg-black/50 p-4 rounded-xl border border-blue-500/20 text-emerald-400 font-mono text-xs shadow-inner shadow-blue-500/10">
                {n}
              </div>
            ))
          ) : (
            <div className="text-center font-mono text-xs text-slate-500 italic p-6 border border-dashed border-slate-800 rounded-xl">
              No technician transcriptions available on current active job.
            </div>
          )}
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={onEnterKiosk} className="bg-emerald-600 p-4 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-colors">
          Initialize KOSK Mode
        </button>
        <button className="bg-blue-600 p-4 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-blue-900/20">
          Generate Monthly ROI
        </button>
        <button className="bg-slate-800 p-4 rounded-2xl font-black uppercase italic text-xs border border-slate-700">
          Marketplace Tiers
        </button>
      </div>

      {/* COMPLIANCE GUARD PANEL */}
      <ComplianceGuard />

      {/* LEAKAGE AUDIT */}
      <LeakageAudit
        auditData={auditData}
        isDemo={isAuditDemo}
        marginConfig={marginConfig}
        onUpdateConfig={handleUpdateMarginConfig}
      />

      {/* VELOCITY LEADERBOARD */}
      <VelocityLeaderboard />

      {/* STAFF MANAGEMENT PANEL */}
      <StaffManagement />
    </div>
  );
};

export default IgnitionOmni;
