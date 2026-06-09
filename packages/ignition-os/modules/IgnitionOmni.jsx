import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, DollarSign, Package, ArrowUpRight, TrendingUp,
  Mic, TrendingDown, UserPlus, QrCode, AlertCircle, Zap, Eye, EyeOff,
} from 'lucide-react';
import DataBridge from '../DataBridge';
import { supabase } from '../supabase';

const STYLE_DEBUG = false;

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
    <div style={{
      backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 32,
      padding: 32, marginTop: 32, boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    }}>
      <h3 style={{
        fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8',
        marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12, letterSpacing: '0.1em',
      }}>
        <UserPlus size={18} style={{ color: '#10b981' }} /> Staff Management &amp; Enrollment
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <input
            placeholder="Staff Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="ign-input"
            style={{
              width: '100%', backgroundColor: '#020617', padding: 16, borderRadius: 16,
              border: '1px solid #1e293b', fontSize: 14, marginBottom: 16, color: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
          <input
            placeholder="Phone / Email"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="ign-input"
            style={{
              width: '100%', backgroundColor: '#020617', padding: 16, borderRadius: 16,
              border: '1px solid #1e293b', fontSize: 14, marginBottom: 24, color: '#ffffff',
              boxSizing: 'border-box',
            }}
          />
          <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            Assign Permission Keys
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {keys.map(k => {
              const isSelected = selectedKeys.includes(k);
              return (
                <button
                  key={k}
                  onClick={() => setSelectedKeys(prev => prev.includes(k) ? prev.filter(p => p !== k) : [...prev, k])}
                  style={{
                    padding: '8px 16px', borderRadius: 9999, fontSize: 9, fontWeight: 900,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    border: isSelected ? '1px solid #3b82f6' : '1px solid #334155',
                    backgroundColor: isSelected ? '#2563eb' : '#1e293b',
                    color: isSelected ? '#ffffff' : '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>
          <button
            onClick={createNewStaff}
            style={{
              backgroundColor: '#059669', color: '#ffffff', fontSize: 10,
              letterSpacing: '0.1em', fontWeight: 900, textTransform: 'uppercase',
              padding: '16px 32px', borderRadius: 16, border: 'none', cursor: 'pointer',
              boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
            }}
          >
            Generate Invite Link
          </button>
        </div>

        {enrollLink && (
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.4)', padding: 32, borderRadius: 32,
            border: '2px dashed rgba(16,185,129,0.3)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center',
          }}>
            <QrCode size={56} style={{ color: '#10b981', marginBottom: 24, filter: 'drop-shadow(0 0 15px rgba(16,185,129,0.5))' }} />
            <p style={{ fontSize: 12, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
              Pending Enrollment Secured
            </p>
            <div style={{ backgroundColor: '#020617', padding: 16, borderRadius: 12, border: '1px solid #1e293b', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}>
              <a href={enrollLink} style={{ fontSize: 10, color: '#60a5fa', wordBreak: 'break-all', fontFamily: 'monospace' }} target="_blank" rel="noreferrer">{enrollLink}</a>
            </div>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 8 }}>
              Open this link on target device to assign PIN.
            </p>
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
    <div style={{ backgroundColor: '#0f172a', padding: 24, borderRadius: 24, border: '1px solid #1e293b', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', marginTop: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>DOT Compliance Gate</h3>
          <p style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Forces digital DVIR before asset release</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          style={{
            width: 56, height: 32, borderRadius: 9999, position: 'relative',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            backgroundColor: guardActive ? '#059669' : '#dc2626',
            opacity: saving ? 0.5 : 1,
          }}
        >
          <div style={{
            position: 'absolute', top: 4, width: 24, height: 24,
            backgroundColor: '#ffffff', borderRadius: '50%',
            left: guardActive ? 28 : 4, transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {showWarning && (
        <div style={{ marginTop: 16, padding: 16, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12 }}>
          <p className="ign-pulse" style={{ fontSize: 10, fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.1em' }}>
            !!! CRITICAL WARNING !!!
          </p>
          <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4, marginBottom: 16 }}>
            Disabling this gate removes the FMCSA-mandated inspection barrier. Assets can be released without safety documentation.
            <span style={{ color: '#ffffff', fontWeight: 700, fontStyle: 'italic' }}> Disable at your own peril.</span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowWarning(false)}
              style={{ flex: 1, backgroundColor: '#1e293b', color: '#ffffff', fontSize: 10, fontWeight: 900, padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              CANCEL
            </button>
            <button
              onClick={() => { setShowWarning(false); setAndPersist(false); DataBridge.smartSync('COMPLIANCE_BYPASS', { event: 'COMPLIANCE_BYPASS_ENABLED', timestamp: new Date().toISOString(), user: 'Owner_Admin', warning_displayed: true, status: 'DANGEROUS' }); }}
              style={{ flex: 1, backgroundColor: '#dc2626', color: '#ffffff', fontSize: 10, fontWeight: 900, padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer' }}
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
    <div style={{ marginTop: 32 }}>
      {isDemo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <AlertCircle size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <p style={{ fontSize: 9, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Demo data shown — process real invoices to see live leakage
          </p>
        </div>
      )}

      {/* MARGIN TARGETS */}
      <div style={{ backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid #1e293b', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Your Target Rates</p>
          <button
            onClick={() => setEditing(!editing)}
            style={{ fontSize: 9, fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {editing ? 'Cancel' : 'Edit Rates'}
          </button>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Labor Rate</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', margin: 0 }}>${marginConfig?.labor_rate ?? 125}/hr</p>
            </div>
            <div>
              <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Parts Markup</p>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', margin: 0 }}>{Math.round((marginConfig?.parts_markup ?? 0.40) * 100)}%</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 4 }}>
                Target Labor Rate ($/hr)
              </label>
              <input
                type="number"
                value={laborRate}
                onChange={e => setLaborRate(e.target.value)}
                className="ign-input"
                style={{
                  width: '100%', backgroundColor: '#020617', border: '1px solid #334155',
                  borderRadius: 12, padding: 12, color: '#ffffff', fontWeight: 700,
                  fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={saveConfig}
              disabled={saving}
              style={{
                width: '100%', backgroundColor: saving ? '#1e293b' : '#2563eb',
                color: saving ? '#64748b' : '#ffffff', fontSize: 10, fontWeight: 900,
                padding: '12px 0', borderRadius: 12, textTransform: 'uppercase',
                letterSpacing: '0.1em', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save My Rates'}
            </button>
          </div>
        )}
      </div>

      {/* LEAKAGE TABLE */}
      <div style={{ backgroundColor: '#0f172a', borderRadius: 24, border: '1px solid #1e293b', padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, fontStyle: 'italic', margin: 0 }}>
              <TrendingDown size={16} style={{ color: '#ef4444' }} /> Margin Leakage Audit
            </h3>
            <p style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase' }}>Target Rate vs. Billed Rate</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', margin: 0 }}>Potential Leakage</p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', margin: 0 }}>
              -${totalLeakage.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase', paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
            <span>Customer</span>
            <span>Service</span>
            <span>Billed</span>
            <span style={{ textAlign: 'right' }}>Leakage</span>
          </div>
          {auditData.map((row, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 12,
              border: '1px solid #1e293b', fontSize: 10,
            }}>
              <span style={{ fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.customer}{row.isDemo ? ' *' : ''}
              </span>
              <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</span>
              <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>${row.billed.toFixed(0)}</span>
              <span style={{ textAlign: 'right', fontWeight: 900, color: '#ef4444' }}>-${row.leakage.toFixed(0)}</span>
            </div>
          ))}
        </div>

        {isDemo && (
          <p style={{ fontSize: 9, color: '#475569', marginTop: 16, fontStyle: 'italic' }}>
            * Demo rows — process real invoices to see your actual margin data.
          </p>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', maxWidth: 200 }}>
            Leakage = labor billed below your target rate.
          </p>
          <button style={{
            backgroundColor: '#1e293b', color: '#94a3b8', fontSize: 9, fontWeight: 900,
            padding: '8px 16px', borderRadius: 8, border: '1px solid #334155',
            textTransform: 'uppercase', cursor: 'pointer',
          }}>
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

const effColor = (eff) =>
  eff >= 100 ? '#34d399' : eff >= 85 ? '#fbbf24' : '#f87171';

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
    <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, marginTop: 32, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.05em', margin: 0 }}>
            <Zap size={16} style={{ color: '#fbbf24' }} /> Velocity Leaderboard
          </h3>
          <p style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Flagged hrs sold vs. clocked — last 30 days
          </p>
        </div>
        <button
          onClick={handleToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '8px 16px', borderRadius: 12,
            border: visible ? '1px solid #334155' : '1px solid #d97706',
            backgroundColor: visible ? '#1e293b' : '#d97706',
            color: visible ? '#cbd5e1' : '#ffffff',
            cursor: 'pointer',
          }}
        >
          {visible ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
        </button>
      </div>

      {visible && (
        <div style={{ marginTop: 24 }}>
          {isDemo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <AlertCircle size={12} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <p style={{ fontSize: 9, fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Demo data — clock real labor entries to see live efficiency
              </p>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Loading...
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 4fr 2fr 2fr 2fr 1fr',
                fontSize: 8, fontWeight: 900, color: '#475569', textTransform: 'uppercase',
                padding: '0 12px 8px', letterSpacing: '0.1em',
              }}>
                <span>#</span>
                <span>Tech</span>
                <span style={{ textAlign: 'center' }}>Jobs</span>
                <span style={{ textAlign: 'center' }}>Flagged</span>
                <span style={{ textAlign: 'center' }}>Clocked</span>
                <span style={{ textAlign: 'right' }}>Eff%</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rows.map((row, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 4fr 2fr 2fr 2fr 1fr',
                    alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)',
                    padding: 12, borderRadius: 12, border: '1px solid #1e293b',
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b' }}>{i + 1}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                      {row.name}{row.isDemo ? ' *' : ''}
                    </span>
                    <span style={{ textAlign: 'center', fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{row.jobCount}</span>
                    <span style={{ textAlign: 'center', fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{row.flaggedHours.toFixed(1)}h</span>
                    <span style={{ textAlign: 'center', fontSize: 10, fontFamily: 'monospace', color: '#94a3b8' }}>{row.actualHours.toFixed(1)}h</span>
                    <span style={{ textAlign: 'right', fontSize: 10, fontWeight: 900, color: effColor(row.efficiency) }}>
                      {row.efficiency}%
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <p style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', maxWidth: 300 }}>
                  Eff% = flagged hours sold ÷ actual clocked hours. Above 100% = faster than estimate.
                </p>
                {isDemo && <p style={{ fontSize: 9, color: '#475569', fontStyle: 'italic' }}>* Demo</p>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const IgnitionOmni = ({ activeJob, onEnterKiosk }) => {
  if (STYLE_DEBUG) console.log('[TRACE:STYLE] IgnitionOmni mounted');

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
    const { data: shopRow } = await supabase
      .from('shops')
      .select('margin_config')
      .eq('id', shopId)
      .single();
    const config = shopRow?.margin_config || { labor_rate: 125, parts_markup: 0.40 };
    setMarginConfig(config);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invoicesRaw } = await supabase
      .from('invoices')
      .select('id, total, customer_id, created_at, invoice_line_items(item_type, labor_hours, labor_rate, line_total)')
      .eq('shop_id', shopId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(20);

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

  const STAT_TILES = [
    { label: 'Monthly Revenue',  val: `$${(stats.revenue / 1000).toFixed(1)}k`,         change: `${stats.jobCount} jobs`, icon: <DollarSign size={16}/> },
    { label: 'Active Trials',    val: trialModules.length.toString(),                    change: 'Tracking',               icon: <Users size={16}/> },
    { label: 'Inventory Value',  val: `$${(stats.inventoryValue / 1000).toFixed(1)}k`,  change: 'Live',                   icon: <Package size={16}/> },
    { label: 'Completion Rate',  val: stats.efficiency > 0 ? `${stats.efficiency}%` : '—', change: 'This Month',          icon: <TrendingUp size={16}/> },
  ];

  return (
    <div style={{ padding: 24, backgroundColor: '#020617', color: '#e2e8f0', minHeight: '100vh' }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 24 }}>
        <h2 style={{ fontSize: 30, fontWeight: 900, fontStyle: 'italic', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.05em', margin: 0 }}>
          OMNI // Command
        </h2>
        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Shop Performance Metrics // {DataBridge.load('shop_info')?.name || 'Your Shop'}
        </p>
      </header>

      {/* TOP LEVEL TOTALS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {STAT_TILES.map((stat, i) => (
          <div key={i} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: 16, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ padding: 8, backgroundColor: '#1e293b', borderRadius: 8, color: '#3b82f6' }}>{stat.icon}</div>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#10b981', display: 'flex', alignItems: 'center' }}>
                {stat.change} <ArrowUpRight size={10}/>
              </span>
            </div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>{stat.label}</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', fontStyle: 'italic', margin: 0 }}>{stat.val}</p>
          </div>
        ))}
      </div>

      {/* TRIAL & BLIND-SPOT TRACKER */}
      <section style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={16} style={{ color: '#3b82f6' }} /> Trial Conversion Pipeline
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {trialModules.length === 0 ? (
            <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#64748b', fontStyle: 'italic', padding: 24, border: '1px dashed #334155', borderRadius: 12 }}>
              No active test-flights or trials currently running. Check Marketplace.
            </div>
          ) : (
            trialModules.map((trial, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', margin: 0 }}>{trial.module}</p>
                  <p style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', margin: 0 }}>{trial.daysLeft} Days Remaining</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* LIVE INTELLIGENCE FEED */}
      <section style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mic size={16} style={{ color: '#3b82f6' }} /> Live Feed (KOSK Sync)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeJob?.notes && activeJob.notes.length > 0 ? (
            activeJob.notes.map((n, i) => (
              <div key={i} style={{
                backgroundColor: 'rgba(0,0,0,0.5)', padding: 16, borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.2)', color: '#34d399',
                fontFamily: 'monospace', fontSize: 12,
                boxShadow: 'inset 0 2px 4px rgba(59,130,246,0.1)',
              }}>
                {n}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#64748b', fontStyle: 'italic', padding: 24, border: '1px dashed #1e293b', borderRadius: 12 }}>
              No technician transcriptions available on current active job.
            </div>
          )}
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <button
          onClick={onEnterKiosk}
          className="ign-card-hover"
          style={{
            backgroundColor: '#059669', padding: 16, borderRadius: 16,
            fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', fontSize: 12,
            boxShadow: '0 10px 15px rgba(5,150,105,0.2)', border: 'none', cursor: 'pointer',
            color: '#ffffff',
          }}
        >
          Initialize KOSK Mode
        </button>
        <button style={{
          backgroundColor: '#2563eb', padding: 16, borderRadius: 16,
          fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', fontSize: 12,
          boxShadow: '0 10px 15px rgba(37,99,235,0.2)', border: 'none', cursor: 'pointer',
          color: '#ffffff',
        }}>
          Generate Monthly ROI
        </button>
        <button style={{
          backgroundColor: '#1e293b', padding: 16, borderRadius: 16,
          fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', fontSize: 12,
          border: '1px solid #334155', cursor: 'pointer', color: '#e2e8f0',
        }}>
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
