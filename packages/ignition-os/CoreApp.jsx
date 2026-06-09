/**
 * MODULE: CoreApp (The Umbrella)
 * VERSION: v0.8.0
 * DESC: Master Controller for Ignition OS.
 * Features: Global State Hoisting, Subscription Gatekeeping, and Blurred Trial Previews.
 */

import React, { useState, useEffect } from 'react';
import DataBridge from './DataBridge';
import { supabase } from './supabase';
import OnboardingWizard from './modules/OnboardingWizard';
import DemoWizard from './OnboardingWizard';
import { useBusinessContext } from '@trace/shared/context';
import IgnitionFlux from './modules/IgnitionFlux';
import PredictiveKey from './modules/PredictiveKey';
import AdminSubscription from './modules/AdminSubscription';
import IgnitionCipher from './modules/IgnitionCipher';
import IgnitionStok from './modules/IgnitionStok';
import IgnitionOmni from './modules/IgnitionOmni';
import IgnitionKosk from './modules/IgnitionKosk';
import IgnitionProt from './modules/IgnitionProt';
import IgnitionPort from './modules/IgnitionPort';
import IgnitionHub from './modules/IgnitionHub';
import IgnitionProc from './modules/IgnitionProc';
import IgnitionCRM from './modules/IgnitionCRM';
import IgnitionCompliance from './modules/IgnitionCompliance';
import IgnitionAdmin from './modules/IgnitionAdmin';
import IgnitionAudit from './modules/IgnitionAudit';
import IgnitionIntake from './modules/IgnitionIntake';
import IgnitionEstimate from './modules/IgnitionEstimate';
import IgnitionEval from './modules/IgnitionEval';
import IgnitionInvoice from './modules/IgnitionInvoice';
import IgnitionTools from './modules/IgnitionTools';
import { Lock, LayoutDashboard, Truck, Activity, ShoppingCart, Search, Package, BarChart3, ShieldCheck, Users, Map, Store, ScanLine, QrCode, DollarSign, RefreshCw, UserPlus, ClipboardCheck, Cog, FileSearch, CheckCircle, ChevronRight, FilePlus, ClipboardList, Microscope, Receipt, Wrench } from 'lucide-react';

const STYLE_DEBUG = true; // [TRACE:STYLE]

const GRID_BG = {
  backgroundImage: 'linear-gradient(rgba(30,41,59,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.3) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
};

const ROLE_COLOR_MAP = {
  blue:   { cardBg: 'rgba(37,99,235,0.1)',  cardBorder: 'rgba(59,130,246,0.2)',  iconColor: '#60a5fa' },
  purple: { cardBg: 'rgba(147,51,234,0.1)', cardBorder: 'rgba(168,85,247,0.2)', iconColor: '#c084fc' },
};

const DASH_APPS = [
  { id: 'INTAKE',      label: 'New RO',     icon: FilePlus,       iconColor: '#34d399' },
  { id: 'ESTIMATES',   label: 'Estimates',  icon: ClipboardList,  iconColor: '#38bdf8' },
  { id: 'EVAL',        label: 'Tech Eval',  icon: Microscope,     iconColor: '#60a5fa' },
  { id: 'INVOICE',     label: 'Invoice',    icon: Receipt,        iconColor: '#34d399' },
  { id: 'OMNI',        label: 'Command',    icon: BarChart3,      iconColor: '#fbbf24' },
  { id: 'HUB',         label: 'Dispatch',   icon: Map,            iconColor: '#3b82f6' },
  { id: 'FLUX',        label: 'Workflow',   icon: Truck,          iconColor: '#38bdf8' },
  { id: 'PREDICTIVE',  label: 'Predict',    icon: Activity,       iconColor: '#a855f7' },
  { id: 'CIPHER',      label: 'Cipher',     icon: Search,         iconColor: '#818cf8' },
  { id: 'STOK',        label: 'Inventory',  icon: Package,        iconColor: '#10b981' },
  { id: 'PROC',        label: 'Vendors',    icon: Store,          iconColor: '#f97316' },
  { id: 'CRM',         label: 'Clients',    icon: Users,          iconColor: '#818cf8' },
  { id: 'PROT',        label: 'Margins',    icon: ShieldCheck,    iconColor: '#2dd4bf' },
  { id: 'PORT',        label: 'Estimates',  icon: DollarSign,     iconColor: '#34d399' },
  { id: 'COMPLIANCE',  label: 'Compliance', icon: ClipboardCheck, iconColor: '#ef4444' },
  { id: 'MARKETPLACE', label: 'Market',     icon: ShoppingCart,   iconColor: '#ec4899' },
  { id: 'AUDIT',       label: 'Audit',      icon: FileSearch,     iconColor: '#fb7185' },
  { id: 'ADMIN',       label: 'Admin',      icon: Cog,            iconColor: '#94a3b8' },
  { id: 'TOOLS',       label: 'Tools',      icon: Wrench,         iconColor: '#fb923c' },
];

const NAV_ITEMS = [
  { id: 'DASHBOARD', label: 'Home',      Icon: LayoutDashboard, activeColor: '#3b82f6' },
  { id: 'INTAKE',    label: 'New RO',    Icon: FilePlus,        activeColor: '#34d399' },
  { id: 'ESTIMATES', label: 'Estimates', Icon: ClipboardList,   activeColor: '#38bdf8' },
  { id: 'FLUX',      label: 'Flux',      Icon: Truck,           activeColor: '#3b82f6' },
  { id: 'HUB',       label: 'HUB',       Icon: Map,             activeColor: '#3b82f6' },
  { id: 'PORT',      label: 'Estimates', Icon: DollarSign,      activeColor: '#0ea5e9' },
  { id: 'OMNI',      label: 'Omni',      Icon: BarChart3,       activeColor: '#eab308' },
];

/**
 * UI: Forgot PIN flow — staff enters 6-digit reset code from admin, sets new PIN
 */
const ForgotPinFlow = ({ onCancel }) => {
  const shopId = DataBridge.load('shop_info')?.id || DataBridge.load('shop_policy')?.shop_id;
  const [phase, setPhase]         = useState('code');
  const [code, setCode]           = useState('');
  const [newPin, setNewPin]       = useState('');
  const [resetData, setResetData] = useState(null);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const verifyCode = async () => {
    if (code.length !== 6) return setError('Enter the 6-digit code from your manager.');
    setLoading(true); setError('');
    const { data, error: dbErr } = await supabase
      .from('pin_resets').select('*')
      .eq('reset_code', code).eq('shop_id', shopId).eq('used', false)
      .gte('expires_at', new Date().toISOString()).single();
    setLoading(false);
    if (dbErr || !data) { setError('Invalid or expired code. Ask your manager for a new one.'); return; }
    setResetData(data);
    setPhase('newpin');
  };

  const applyNewPin = async () => {
    if (newPin.length !== 4) return setError('PIN must be 4 digits.');
    const profiles = DataBridge.getProfiles();
    if (profiles[newPin]) return setError('That PIN is already in use — choose another.');
    const cleanProfiles = { ...profiles };
    const oldEntry = Object.entries(profiles).find(([, p]) => p.name === resetData.member_name);
    if (oldEntry) delete cleanProfiles[oldEntry[0]];
    const perms = resetData.permissions || [];
    const newProfile = {
      id: newPin, name: resetData.member_name, role: resetData.member_role,
      permissions: perms,
      allowed: perms.filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')),
      hasSignedWaiver: false,
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] },
    };
    DataBridge.save('user_profiles', { ...cleanProfiles, [newPin]: newProfile });
    DataBridge.save('current_user', newProfile);
    await supabase.from('pin_resets').update({ used: true }).eq('id', resetData.id);
    setPhase('done');
    setTimeout(() => window.location.reload(), 1500);
  };

  if (phase === 'done') return (
    <div style={{ textAlign: 'center' }}>
      <CheckCircle size={48} style={{ color: '#34d399', display: 'block', margin: '0 auto 16px' }} />
      <p style={{ color: '#fff', fontWeight: 900, fontSize: '1.125rem', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.04em' }}>PIN Updated</p>
      <p style={{ color: '#64748b', fontSize: '0.625rem', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Logging you in...</p>
    </div>
  );

  const isDisabled = loading || (phase === 'code' && code.length !== 6) || (phase === 'newpin' && newPin.length !== 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: '0.5625rem', fontWeight: 900, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Forgot PIN</p>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.04em' }}>
          {phase === 'code' ? 'Enter Reset Code' : 'Set New PIN'}
        </h2>
        {phase === 'code' && (
          <p style={{ fontSize: '0.5625rem', color: '#475569', marginTop: 8, lineHeight: 1.6 }}>
            Ask your manager to generate a reset code in Admin → Team.
          </p>
        )}
        {phase === 'newpin' && resetData && (
          <p style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: 4 }}>
            Welcome back, <span style={{ color: '#fff', fontWeight: 900 }}>{resetData.member_name}</span>
          </p>
        )}
      </div>

      {phase === 'code' && (
        <input
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          placeholder="000000" maxLength={6}
          style={{ width: '100%', background: '#020617', border: '1.5px solid #1e293b', borderRadius: 16, padding: 20, color: '#fff', fontWeight: 900, fontSize: '1.875rem', letterSpacing: '0.3em', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
        />
      )}
      {phase === 'newpin' && (
        <input
          type="password" value={newPin}
          onChange={e => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
          placeholder="••••" maxLength={4}
          style={{ width: '100%', background: '#020617', border: '1.5px solid #1e293b', borderRadius: 16, padding: 20, color: '#fff', fontWeight: 900, fontSize: '1.875rem', letterSpacing: '1em', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
        />
      )}

      {error && <p style={{ color: '#f87171', fontSize: '0.625rem', fontWeight: 700, textAlign: 'center' }}>{error}</p>}

      <button
        onClick={phase === 'code' ? verifyCode : applyNewPin}
        disabled={isDisabled}
        className="ign-card-hover"
        style={{ width: '100%', background: isDisabled ? '#1e293b' : '#ea580c', color: isDisabled ? '#475569' : '#fff', fontWeight: 900, padding: 16, borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
      >
        {loading ? 'Verifying...' : phase === 'code' ? 'Verify Code' : 'Set New PIN'}
      </button>

      <button onClick={onCancel} style={{ width: '100%', color: '#475569', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer' }}>
        ← Back to Login
      </button>
    </div>
  );
};

/**
 * UI: Join Flow — tech/staff scan owner's QR code, pick role, set PIN, land in app
 */
const JoinFlow = ({ shopId, inviteToken }) => {
  const [phase, setPhase]             = useState(inviteToken ? 'loading' : 'role');
  const [role, setRole]               = useState(null);
  const [name, setName]               = useState('');
  const [phone, setPhone]             = useState('');
  const [pin, setPin]                 = useState('');
  const [shopName, setShopName]       = useState('');
  const [inviteData, setInviteData]   = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [error, setError]             = useState('');

  useEffect(() => {
    supabase.from('shops').select('name').eq('id', shopId).single()
      .then(({ data }) => { if (data?.name) setShopName(data.name); });
  }, [shopId]);

  useEffect(() => {
    if (!inviteToken) return;
    supabase.from('shop_invites').select('*').eq('token', inviteToken).eq('used', false).single()
      .then(({ data, error: err }) => {
        if (err || !data) { setInviteError('This invite link has already been used or is invalid.'); setPhase('role'); return; }
        setInviteData(data);
        setName(data.name);
        setRole(data.role);
        setPhone(data.phone || '');
        setPhase('pin');
      });
  }, [inviteToken]);

  const ROLES = [
    { id: 'TECH',    label: 'Technician',  color: 'blue',   desc: 'Intake · VIN · Voice · Workflow' },
    { id: 'SERVICE', label: 'Front Office', color: 'purple', desc: 'Queue · Estimates · Customers' },
  ];

  const finalize = async () => {
    if (pin.length !== 4) return setError('PIN must be 4 digits.');
    if (!name.trim())     return setError('Your name is required.');
    setError('');
    DataBridge.setShopId(shopId);
    const pinHash = await DataBridge.hashPin(shopId, pin);
    let member;

    if (inviteToken && inviteData) {
      const { data, error } = await supabase
        .from('shop_members').update({ pin_hash: pinHash, active: true })
        .eq('invite_id', inviteData.id).select('*').single();
      if (error || !data) return setError('Enrollment failed — please try again.');
      member = data;
      await supabase.from('shop_invites').update({ used: true }).eq('id', inviteData.id);
    } else {
      const { data: collision } = await supabase
        .from('shop_members').select('id').eq('shop_id', shopId).eq('pin_hash', pinHash).maybeSingle();
      if (collision) return setError('That PIN is already taken — choose another.');
      const defaultPerms = role === 'TECH'
        ? ['view_hub','view_flux','view_cipher','view_stok','scan_parts','update_flux']
        : role === 'SERVICE'
        ? ['view_port','view_crm','view_cipher','view_stok','sign_estimates']
        : [];
      const { data, error } = await supabase
        .from('shop_members').insert({ shop_id: shopId, name: name.trim().toUpperCase(), role: role || 'TECH', phone: phone.trim() || null, pin_hash: pinHash, active: true, permissions: defaultPerms })
        .select('*').single();
      if (error || !data) return setError('Failed to create profile — please try again.');
      member = data;
    }

    await DataBridge.autoEnrollDevice(member.id, shopId);
    const session = {
      id: member.id, member_id: member.id, shop_id: shopId, name: member.name,
      role: member.role, sub_role: member.sub_role || null,
      permissions: member.permissions || [],
      allowed: (member.permissions || []).filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')),
      cached_at: new Date().toISOString(),
    };
    DataBridge.save('current_user', session);
    setPhase('done');
    setTimeout(() => { window.location.href = '/'; }, 1200);
  };

  if (phase === 'loading') return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="ign-pulse" style={{ color: '#475569', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Verifying invite...</p>
    </div>
  );

  if (phase === 'done') return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 80, height: 80, background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <CheckCircle size={40} style={{ color: '#34d399' }} />
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.04em', marginBottom: 8 }}>You're In</h1>
      <p style={{ color: '#475569', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading {shopName}...</p>
    </div>
  );

  const pinDisabled = pin.length !== 4 || !name.trim();

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...GRID_BG }} />
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 384 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: '0.5625rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Ignition OS</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.04em' }}>
            {shopName ? `Join ${shopName}` : 'Join Shop'}
          </h1>
          {inviteData && <p style={{ fontSize: '0.5625rem', color: '#34d399', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Invite accepted</p>}
          {inviteError && <p style={{ fontSize: '0.5625rem', color: '#fb923c', fontWeight: 700, marginTop: 8 }}>{inviteError}</p>}
        </div>

        {phase === 'role' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ROLES.map(({ id, label, color, desc }) => {
              const rc = ROLE_COLOR_MAP[color];
              return (
                <button
                  key={id}
                  onClick={() => { setRole(id); setPhase('pin'); }}
                  className="ign-card-hover"
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: rc.cardBg, border: `1px solid ${rc.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={20} style={{ color: rc.iconColor }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.04em' }}>{label}</p>
                    <p style={{ fontSize: '0.5625rem', color: '#475569', marginTop: 2 }}>{desc}</p>
                  </div>
                  <ChevronRight size={16} style={{ color: '#475569', marginLeft: 'auto' }} />
                </button>
              );
            })}
          </div>
        )}

        {phase === 'pin' && (
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: '0.625rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Your Name</label>
              <input
                value={name}
                onChange={e => !inviteData && setName(e.target.value)}
                readOnly={!!inviteData}
                placeholder="First name or nickname"
                style={{ width: '100%', background: '#000', border: `1px solid ${inviteData ? '#334155' : '#1e293b'}`, borderRadius: 12, padding: 16, color: '#fff', fontWeight: 700, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', opacity: inviteData ? 0.6 : 1, cursor: inviteData ? 'not-allowed' : 'text' }}
              />
              {inviteData && <p style={{ fontSize: '0.5625rem', color: '#475569', marginTop: 4 }}>Pre-filled from invite</p>}
            </div>
            <div>
              <label style={{ fontSize: '0.625rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                Phone <span style={{ color: '#334155', textTransform: 'none' }}>(optional)</span>
              </label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="512-555-0100" type="tel"
                style={{ width: '100%', background: '#000', border: '1px solid #1e293b', borderRadius: 12, padding: 16, color: '#fff', fontWeight: 700, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.625rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Create Your 4-Digit PIN</label>
              <input
                type="password" value={pin} maxLength={4}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                placeholder="••••"
                style={{ width: '100%', background: '#000', border: '1px solid #1e293b', borderRadius: 12, padding: 16, color: '#fff', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '1em', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {error && <p style={{ color: '#f87171', fontSize: '0.625rem', fontWeight: 700 }}>{error}</p>}
            <button
              onClick={finalize} disabled={pinDisabled}
              className="ign-card-hover"
              style={{ width: '100%', background: pinDisabled ? '#1e293b' : '#2563eb', color: pinDisabled ? '#475569' : '#fff', fontWeight: 900, padding: 16, borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', border: 'none', cursor: pinDisabled ? 'not-allowed' : 'pointer' }}
            >
              Join Shop
            </button>
            {!inviteData && (
              <button onClick={() => setPhase('role')} style={{ width: '100%', color: '#475569', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Change Role
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * UI: The Enrollment Generator & Gate
 */
const EnrollmentGate = ({ token }) => {
  const [pin, setPin]           = useState('');
  const [enrolled, setEnrolled] = useState(false);
  const [profile]               = useState(() => {
    const pending = DataBridge.load('pending_users') || [];
    return pending.find(p => p.token === token);
  });

  if (!profile) return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '-0.04em' }}>Fault: Invalid or Expired Enrollment Token.</h1>
    </div>
  );

  const finalize = () => {
    if (pin.length !== 4) return alert('PIN must be exactly 4 digits.');
    const users = DataBridge.load('users_table') || [];
    const finalProfile = { ...profile, pin, status: 'ACTIVE' };
    delete finalProfile.token;
    users.push(finalProfile);
    DataBridge.save('users_table', users);
    const pending = DataBridge.load('pending_users') || [];
    DataBridge.save('pending_users', pending.filter(p => p.token !== token));
    setEnrolled(true);
  };

  if (enrolled) return (
    <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,0.3)', padding: 48, borderRadius: 48, boxShadow: '0 25px 50px rgba(6,78,59,0.2)', maxWidth: 384, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ background: '#000', padding: 24, borderRadius: 24, border: '1px solid #1e293b', marginBottom: 32, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
          <QrCode size={100} style={{ color: '#10b981' }} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', fontStyle: 'italic', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '-0.04em' }}>Enrollment Complete</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em', marginBottom: 32 }}>Identity Matrix Synced to Registry</p>
        <div style={{ background: '#020617', padding: '16px 32px', borderRadius: 12, border: '1px solid #1e293b', marginBottom: 32 }}>
          <p style={{ fontFamily: 'monospace', color: '#10b981', fontSize: '1.875rem', fontWeight: 900, letterSpacing: '0.5em' }}>{pin}</p>
        </div>
        <p style={{ fontSize: '0.5625rem', color: '#475569', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em', marginBottom: 32 }}>Scan this badge to bind to a physical terminal, or use your PIN.</p>
        <a href="/" style={{ background: '#2563eb', color: '#fff', padding: '20px 32px', borderRadius: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', width: '100%', display: 'block', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>
          Initialize System (Login)
        </a>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...GRID_BG }} />
      <div style={{ zIndex: 10, background: '#0f172a', padding: 40, borderRadius: 48, border: '1px solid #1e293b', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: '100%', maxWidth: 384, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', fontStyle: 'italic', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '-0.04em' }}>Secure Initialization</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.1em', marginBottom: 32 }}>
          Welcome, <span style={{ color: '#60a5fa', fontWeight: 900 }}>{profile.name}</span>.<br />Set your 4-Digit Identity PIN.
        </p>
        <input
          type="password" value={pin}
          onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
          maxLength={4}
          style={{ background: '#020617', border: '1px solid #334155', borderRadius: 16, color: '#fff', fontSize: '2.25rem', letterSpacing: '1em', textAlign: 'center', width: '100%', padding: 24, marginBottom: 32, outline: 'none', boxSizing: 'border-box' }}
          placeholder="----"
        />
        <button onClick={finalize} style={{ background: '#059669', color: '#fff', padding: '20px 32px', borderRadius: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', width: '100%', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(5,150,105,0.4)' }}>
          <UserPlus size={16} /> Secure Profile
        </button>
      </div>
    </div>
  );
};

/**
 * LOGIC: The Access Gatekeeper
 */
const AccessGatekeeper = ({ requiredPermissions, children }) => {
  const currentUser = DataBridge.load('current_user');
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideMode, setOverrideMode]     = useState(false);

  if (!currentUser) return null;

  const rolesRegistry  = DataBridge.getSystemRoles();
  const userCapabilities = currentUser.permissions.flatMap(role => rolesRegistry[role] || []);
  const hasAccess = requiredPermissions.some(rp => userCapabilities.includes(rp)) || overrideActive;

  if (hasAccess) return children;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 24, textAlign: 'center' }}>
      <ShieldCheck size={80} style={{ color: '#ef4444', marginBottom: 24, filter: 'drop-shadow(0 0 15px rgba(239,68,68,0.5))' }} />
      <h2 style={{ fontSize: '1.875rem', fontWeight: 900, textTransform: 'uppercase', color: '#fff', marginBottom: 8, letterSpacing: '-0.04em' }}>Access Denied</h2>
      <p style={{ color: '#94a3b8', marginBottom: 32, maxWidth: 320, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.6 }}>
        Your identity matrix lacks clearance for: <span style={{ color: '#f87171', fontWeight: 700 }}>{requiredPermissions.join(' or ')}</span>.
      </p>
      {!overrideMode ? (
        <button onClick={() => setOverrideMode(true)} style={{ background: '#0f172a', color: '#cbd5e1', padding: '16px 32px', borderRadius: 16, border: '1px solid #334155', fontWeight: 900, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 20px 25px rgba(0,0,0,0.5)' }}>
          Request Manager Override
        </button>
      ) : (
        <div style={{ background: '#0f172a', border: '1px solid #334155', padding: 32, borderRadius: 32, width: '100%', maxWidth: 320, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
          <p className="ign-pulse" style={{ fontSize: '0.625rem', textTransform: 'uppercase', fontWeight: 900, color: '#f97316', marginBottom: 24, letterSpacing: '0.1em' }}>Awaiting Manager Scan</p>
          <div
            style={{ width: '100%', aspectRatio: '1 / 1', background: '#000', border: '2px dashed #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 24, marginBottom: 24, cursor: 'pointer' }}
            onClick={() => {
              DataBridge.smartSync('MANAGER_OVERRIDE_GRANTED', { timestamp: Date.now(), requestedBy: currentUser.id });
              setOverrideActive(true);
              alert('Manager Override Granted for single session.');
            }}
          >
            <ScanLine size={48} style={{ color: '#475569', marginBottom: 8 }} />
            <p style={{ fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: '#475569' }}>Tap to Simulate QR</p>
          </div>
          <p style={{ fontSize: '0.5625rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>A system log will be generated.</p>
        </div>
      )}
    </div>
  );
};

/**
 * UI: Shop name header strip
 */
const ShopBanner = ({ name }) => {
  if (!name) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px', background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: '-0.04em' }}>{name}</span>
      <span style={{ fontSize: '0.5rem', fontWeight: 900, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.2em' }}>Powered by Ignition OS</span>
    </div>
  );
};

/**
 * UI: The PIN Login Block — with biometric (Face ID / Touch ID) support
 */
const IdentityMatrix = ({ onLogin, shopName }) => {
  const [pin, setPin]                     = useState('');
  const [loginError, setLoginError]       = useState('');
  const [loading, setLoading]             = useState(false);
  const [showForgot, setShowForgot]       = useState(false);
  const [bioAvailable, setBioAvailable]   = useState(false);
  const [bioCredId]                       = useState(() => localStorage.getItem('bio_cred_id'));
  const [bioError, setBioError]           = useState('');
  const [showBioEnroll, setShowBioEnroll] = useState(false);
  const [pendingUser, setPendingUser]     = useState(null);

  useEffect(() => {
    window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
      .then(ok => setBioAvailable(ok)).catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (pin.length < 4 || pin.length > 6) return;
    setLoading(true); setLoginError('');
    const user = await DataBridge.authenticate(pin);
    setLoading(false);
    if (!user) { setLoginError('Invalid PIN — try again.'); setPin(''); return; }
    if (bioAvailable && !bioCredId) { setPendingUser(user); setShowBioEnroll(true); }
    else { onLogin(user); }
  };

  const enrollBio = async () => {
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Ignition OS', id: window.location.hostname },
          user: { id: new TextEncoder().encode(pendingUser.id), name: pendingUser.name, displayName: pendingUser.name },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000,
        }
      });
      const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem('bio_cred_id', credId);
      localStorage.setItem('bio_member_id', pendingUser.member_id || pendingUser.id);
    } catch (_) { /* user declined */ }
    onLogin(pendingUser);
  };

  const loginWithBio = async () => {
    setBioError('');
    try {
      const credIdBytes = Uint8Array.from(atob(bioCredId), c => c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          allowCredentials: [{ type: 'public-key', id: credIdBytes }],
          userVerification: 'required', timeout: 60000,
        }
      });
      const storedId = localStorage.getItem('bio_member_id');
      if (!storedId) { setBioError('Profile not found — use PIN.'); return; }
      const { data: member } = await supabase.from('shop_members').select('*').eq('id', storedId).single();
      if (!member) { setBioError('Profile not found — use PIN.'); return; }
      await DataBridge.autoEnrollDevice(member.id, member.shop_id);
      const session = {
        id: member.id, member_id: member.id, shop_id: member.shop_id,
        name: member.name, role: member.role, sub_role: member.sub_role || null,
        permissions: member.permissions || [],
        allowed: (member.permissions || []).filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')),
        cached_at: new Date().toISOString(),
      };
      DataBridge.save('current_user', session);
      onLogin(session);
    } catch (_) { setBioError('Biometric cancelled — enter PIN.'); }
  };

  const fullScreenBase = { height: '100vh', width: '100vw', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' };
  const cardBase       = { zIndex: 10, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)', padding: 40, borderRadius: 48, border: '1px solid #1e293b', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: '100%', maxWidth: 384, textAlign: 'center' };

  if (showBioEnroll) return (
    <div style={fullScreenBase}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...GRID_BG }} />
      <div style={cardBase}>
        <div style={{ fontSize: '3.75rem', marginBottom: 24 }}>🔒</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.04em', marginBottom: 8 }}>Enable Biometrics?</h2>
        <p style={{ fontSize: '0.5625rem', color: '#475569', marginBottom: 32, textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.6 }}>
          Use Face ID or Touch ID to log in — no PIN needed on future visits.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={enrollBio}
            className="ign-card-hover"
            style={{ width: '100%', background: '#2563eb', color: '#fff', fontWeight: 900, padding: '20px 0', borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(37,99,235,0.4)' }}
          >
            Enable Face ID / Touch ID
          </button>
          <button
            onClick={() => { setShowBioEnroll(false); onLogin(pendingUser); }}
            style={{ width: '100%', color: '#475569', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          >
            Skip — use PIN every time
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={fullScreenBase}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...GRID_BG }} />
      <div style={cardBase}>
        {!showForgot ? (
          <>
            <div style={{ width: 96, height: 96, margin: '0 auto', background: '#020617', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1e293b', boxShadow: '0 20px 25px rgba(0,0,0,0.5)', marginBottom: 32 }}>
              <Lock size={40} style={{ color: '#3b82f6' }} />
            </div>
            {shopName && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #1e293b' }}>
                <p style={{ fontSize: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#475569', marginBottom: 4 }}>Accessing</p>
                <p style={{ fontSize: '1.125rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.25 }}>{shopName}</p>
              </div>
            )}
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.04em', marginBottom: 8 }}>Identity Matrix</h1>
            <p style={{ fontSize: '0.5625rem', fontFamily: 'monospace', color: '#475569', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Enter 4-Digit Security Authorization</p>

            {bioCredId && (
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={loginWithBio}
                  className="ign-card-hover"
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontWeight: 900, padding: 16, borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.125rem' }}>🔒</span> Use Face ID / Touch ID
                </button>
                {bioError && <p style={{ color: '#f87171', fontSize: '0.5625rem', fontWeight: 700, marginTop: 8 }}>{bioError}</p>}
                <p style={{ fontSize: '0.5rem', color: '#1e293b', marginTop: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>— or enter PIN —</p>
              </div>
            )}

            <input
              type="password" placeholder="----" value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setLoginError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              maxLength={4}
              style={{ width: '100%', background: '#020617', border: `1.5px solid ${loginError ? '#ef4444' : '#1e293b'}`, borderRadius: 16, padding: 24, textAlign: 'center', letterSpacing: '1em', fontSize: '1.875rem', color: '#fff', fontWeight: 900, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
            />
            {loginError && <p style={{ color: '#f87171', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>{loginError}</p>}
            {!loginError && <div style={{ marginBottom: 16 }} />}

            <button
              onClick={handleLogin}
              disabled={pin.length !== 4 || loading}
              className="ign-card-hover"
              style={{ width: '100%', background: '#2563eb', color: '#fff', fontWeight: 900, padding: 20, borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.625rem', opacity: (pin.length !== 4 || loading) ? 0.5 : 1, boxShadow: '0 10px 25px rgba(37,99,235,0.4)', border: 'none', cursor: (pin.length !== 4 || loading) ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Verifying...' : 'Authenticate'}
            </button>

            <button
              onClick={() => setShowForgot(true)}
              style={{ display: 'block', width: '100%', marginTop: 16, fontSize: '0.5625rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Forgot PIN?
            </button>
          </>
        ) : (
          <ForgotPinFlow onCancel={() => setShowForgot(false)} />
        )}
      </div>
    </div>
  );
};

const CoreApp = () => {
  const { businessId: ownerBusinessId } = useBusinessContext();

  const [onboardingDone, setOnboardingDone] = useState(() => {
    const policy = DataBridge.load('shop_policy');
    return policy?.onboarding_complete === true;
  });
  const [subscriptions, setSubscriptions] = useState(DataBridge.load('system_subscriptions') || {});
  const [activeJob, setActiveJob] = useState(DataBridge.load('active_job_context') || {
    id: 'JOB-1102', unit: 'Unit 1102', status: 'MOBILE_FIELD',
    inventory: { specialized: [], baseConfirmed: true },
    assigned_crew_size: 1, active_techs: [], tasks: [], labor_ledger: [],
  });
  const [activeModule, setActiveModule]     = useState('DASHBOARD');
  const [stokSearchQuery, setStokSearchQuery] = useState('');
  const [currentUser, setCurrentUser]       = useState(DataBridge.load('current_user') || null);
  const [allJobs, setAllJobs]               = useState([]);
  const [isKioskMode, setIsKioskMode]       = useState(false);
  const [trialStatus, setTrialStatus]       = useState(() => DataBridge.getShopTrialStatus());
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [shopName, setShopName]             = useState(DataBridge.getShopName() || '');
  const [shopReady, setShopReady]           = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return !!DataBridge.getShopId() || !!p.get('join') || !!p.get('enroll') || !!p.get('invite');
  });

  useEffect(() => {
    const latestSubs = DataBridge.load('system_subscriptions');
    if (latestSubs) setSubscriptions(latestSubs);
  }, [activeModule]);

  useEffect(() => {
    if (!ownerBusinessId) return;
    if (DataBridge.getShopId()) return;
    DataBridge.setShopId(ownerBusinessId);
    supabase.from('shops').select('name').eq('id', ownerBusinessId).single()
      .then(({ data }) => {
        if (data?.name) { DataBridge.setShopName(data.name); setShopName(data.name); }
        DataBridge.save('shop_policy', { ...(DataBridge.load('shop_policy') || {}), onboarding_complete: true });
        setOnboardingDone(true);
        setShopReady(true);
      });
  }, [ownerBusinessId]);

  const fetchCloudData = () => {
    DataBridge.pullCloudSync().then(serverJobs => {
      if (serverJobs && serverJobs.length > 0) {
        setAllJobs(serverJobs);
        const currentId = activeJob?.jobId || activeJob?.id;
        const updated = serverJobs.find(j => j.jobId === currentId || j.id === currentId);
        setActiveJob(updated || serverJobs[serverJobs.length - 1]);
      }
    });
  };

  const handleUpdateJob = (job) => {
    setActiveJob(job);
    DataBridge.save('active_job_context', job);
    setAllJobs(prev => prev.map(j => (j.id === job.id ? job : j)));
    DataBridge.pushCloudSync([job]);
  };

  useEffect(() => { fetchCloudData(); }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sParam = p.get('s');
    if (p.get('join') || p.get('enroll') || p.get('invite')) return;
    if (sParam) {
      supabase.from('shops').select('id, name').eq('id', sParam).maybeSingle()
        .then(({ data }) => {
          if (data) { DataBridge.setShopId(data.id); DataBridge.setShopName(data.name); setShopName(data.name); }
          else { const mkt = import.meta.env.VITE_MARKETING_URL; if (mkt) window.location.href = mkt; }
          setShopReady(true);
        });
    } else {
      const storedId = DataBridge.getShopId();
      if (!storedId) {
        const mkt = import.meta.env.VITE_MARKETING_URL;
        if (mkt) { window.location.href = mkt; return; }
        setShopReady(true);
      } else {
        const cached = DataBridge.getShopName();
        if (cached) { setShopName(cached); setShopReady(true); }
        supabase.from('shops').select('name').eq('id', storedId).single()
          .then(({ data }) => {
            if (data?.name) { DataBridge.setShopName(data.name); setShopName(data.name); }
            if (!cached) setShopReady(true);
          });
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const policy = DataBridge.load('shop_policy') || {};
    if (!policy.autoLockEnabled) return;
    const TIMEOUT = 10 * 60 * 1000;
    const lock = () => { DataBridge.save('current_user', null); setCurrentUser(null); };
    let timer = setTimeout(lock, TIMEOUT);
    const reset = () => { clearTimeout(timer); timer = setTimeout(lock, TIMEOUT); };
    const events = ['click', 'touchstart', 'keydown', 'scroll'];
    events.forEach(e => document.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(timer); events.forEach(e => document.removeEventListener(e, reset)); };
  }, [currentUser]);

  const urlParams   = new URLSearchParams(window.location.search);
  const joinShopId  = urlParams.get('join');
  const inviteToken = urlParams.get('invite');

  if (joinShopId) return <JoinFlow shopId={joinShopId} inviteToken={inviteToken} />;

  const demoMode = urlParams.get('demo');
  if (demoMode) {
    const clearDemoParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('demo');
      window.history.replaceState({}, '', url.toString());
    };
    return (
      <DemoWizard
        quickMode={demoMode === 'quick'}
        onComplete={() => {
          clearDemoParam();
          const session = DataBridge.load('current_user');
          setOnboardingDone(true); setShopReady(true);
          if (session) setCurrentUser(session);
        }}
      />
    );
  }

  if (!onboardingDone) {
    return (
      <OnboardingWizard
        onComplete={() => {
          const session = DataBridge.load('current_user');
          setOnboardingDone(true); setShopReady(true);
          if (session) setCurrentUser(session);
        }}
      />
    );
  }

  const enrollToken = urlParams.get('enroll');
  if (enrollToken) return <EnrollmentGate token={enrollToken} />;

  if (!shopReady) return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p className="ign-pulse" style={{ color: '#334155', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Initializing...</p>
    </div>
  );

  if (!currentUser) {
    return (
      <IdentityMatrix shopName={shopName} onLogin={(user) => {
        DataBridge.save('current_user', user);
        setCurrentUser(user);
      }} />
    );
  }

  // GATEKEEPER WRAPPER: Handles trial blur logic
  const TrialGatekeeper = ({ children, moduleKey, moduleName }) => {
    if (currentUser?.permissions?.includes('ADMIN')) return children;
    const status = DataBridge.checkTrialStatus(moduleKey);
    const mod    = subscriptions[moduleKey];
    if (!mod || (!mod.active && !mod.trialActive)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#020617', color: '#475569', padding: 40 }}>
          <Lock size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase' }}>Module Locked</h3>
          <p style={{ fontSize: '0.75rem', marginBottom: 24 }}>Subscription required to access {moduleName}.</p>
          <button onClick={() => setActiveModule('MARKETPLACE')} style={{ background: '#2563eb', color: '#fff', padding: '8px 24px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}>Visit Marketplace</button>
        </div>
      );
    }
    if (status.isExpired) {
      return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
          <div style={{ filter: 'blur(24px)', opacity: 0.2, pointerEvents: 'none', userSelect: 'none', height: '100%' }}>{children}</div>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.4)', backdropFilter: 'blur(4px)', padding: 24, textAlign: 'center', zIndex: 50 }}>
            <div style={{ maxWidth: 448, background: '#0f172a', border: '1px solid rgba(59,130,246,0.3)', padding: 32, borderRadius: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', fontStyle: 'italic', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '-0.04em' }}>Access Expired</h3>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: 24 }}>Your 30-day "Deep Integration" trial for {moduleName} has concluded. Your data is saved but currently hidden.</p>
              <button onClick={() => setActiveModule('MARKETPLACE')} style={{ width: '100%', background: '#2563eb', color: '#fff', fontWeight: 900, padding: 16, borderRadius: 12, boxShadow: '0 10px 25px rgba(37,99,235,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.75rem', border: 'none', cursor: 'pointer' }}>Restore Full Access</button>
            </div>
          </div>
        </div>
      );
    }
    return children;
  };

  if (isKioskMode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', color: '#cbd5e1', overflow: 'hidden' }}>
        <IgnitionKosk
          activeJob={activeJob} onUpdateJob={handleUpdateJob}
          onExitKiosk={() => setIsKioskMode(false)}
          onStartEval={() => { setIsKioskMode(false); setActiveModule('EVAL'); }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', color: '#cbd5e1', overflow: 'hidden', position: 'relative' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #1e293b', background: '#020617' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => {
              if (allJobs.length < 2) return;
              const currentIndex = allJobs.findIndex(j => (j.jobId || j.id) === (activeJob?.jobId || activeJob?.id));
              const nextJob = allJobs[(currentIndex + 1) % allJobs.length];
              setActiveJob(nextJob);
              DataBridge.save('active_job_context', nextJob);
            }}
            className="ign-card-hover"
            style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
          >
            <span style={{ display: 'block', fontSize: '0.5rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', marginBottom: 2 }}>Active Asset (Tap to Cycle)</span>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>{activeJob?.jobId || activeJob?.id || 'NO JOB'} // {activeJob?.year || '????'} {activeJob?.make || 'Unknown'}</span>
          </button>

          <button
            onClick={fetchCloudData}
            className="ign-card-hover"
            style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
          >
            <RefreshCw size={14} style={{ color: '#3b82f6', marginBottom: 2 }} />
            <span style={{ fontSize: '0.5rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>Sync</span>
          </button>

          <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.5rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>Identity Matrix</span>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase' }}>{currentUser.name}</span>
            </div>
            <button onClick={() => { DataBridge.save('current_user', null); setCurrentUser(null); }} style={{ padding: 8, background: '#020617', borderRadius: 8, color: '#475569', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Lock size={12} />
            </button>
          </div>
        </div>
      </header>

      <ShopBanner name={shopName} />

      {/* ── TRIAL BANNER ── */}
      {!trialStatus.isPaid && !isKioskMode && (() => {
        const { day, daysRemaining, isWarning, isBlurred, isArchived, showNudge, showReport } = trialStatus;

        if (isArchived) return (
          <div style={{ background: '#0f172a', borderBottom: '1px solid rgba(239,68,68,0.3)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Trial ended {day - 14} days ago — your data is archived</p>
            <button onClick={() => setActiveModule('MARKETPLACE')} style={{ background: '#dc2626', color: '#fff', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 16px', borderRadius: 12, flexShrink: 0, border: 'none', cursor: 'pointer' }}>Restore Access</button>
          </div>
        );

        if (isBlurred) return (
          <div style={{ background: '#0f172a', borderBottom: '1px solid rgba(249,115,22,0.4)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#fb923c', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Trial expired — your data is safe but locked</p>
              <p style={{ fontSize: '0.625rem', color: '#475569' }}>Subscribe to unlock everything. Data archived in {30 - day} days.</p>
            </div>
            <button onClick={() => setActiveModule('MARKETPLACE')} style={{ background: '#f97316', color: '#fff', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 16px', borderRadius: 12, flexShrink: 0, border: 'none', cursor: 'pointer' }}>Subscribe Now</button>
          </div>
        );

        if (showReport && !nudgeDismissed) return (
          <div style={{ background: '#172554', borderBottom: '1px solid rgba(59,130,246,0.4)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>⚡ {daysRemaining} days left — your savings report is ready</p>
              <p style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Review what Ignition flagged this trial before access ends.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => { setActiveModule('OMNI'); setNudgeDismissed(true); }} style={{ background: '#2563eb', color: '#fff', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 16px', borderRadius: 12, border: 'none', cursor: 'pointer' }}>View Report</button>
              <button onClick={() => setNudgeDismissed(true)} style={{ color: '#475569', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        );

        if (showNudge && !nudgeDismissed) return (
          <div style={{ background: '#022c22', borderBottom: '1px solid rgba(16,185,129,0.3)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <p style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Trial active — {daysRemaining} days remaining · Full PREMIER access</p>
            <button onClick={() => setNudgeDismissed(true)} style={{ color: '#475569', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        );

        if (isWarning) return (
          <div style={{ background: '#450a0a', borderBottom: '1px solid rgba(239,68,68,0.4)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>⚠ {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left — trial ending soon</p>
              <p style={{ fontSize: '0.625rem', color: '#94a3b8' }}>Subscribe now to keep your jobs, customers, and AI features.</p>
            </div>
            <button onClick={() => setActiveModule('MARKETPLACE')} style={{ background: '#dc2626', color: '#fff', fontSize: '0.625rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 16px', borderRadius: 12, flexShrink: 0, border: 'none', cursor: 'pointer' }}>Subscribe</button>
          </div>
        );

        return null;
      })()}

      {/* ── DAY 15 BLUR GATE ── */}
      {trialStatus.isBlurred && !trialStatus.isPaid && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.95)', backdropFilter: 'blur(4px)', padding: 24, textAlign: 'center' }}>
          <div style={{ maxWidth: 448, background: '#0f172a', border: '1px solid rgba(59,130,246,0.2)', padding: 40, borderRadius: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Lock size={32} style={{ color: '#60a5fa' }} />
            </div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.04em', marginBottom: 8 }}>Trial Complete</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 8, lineHeight: 1.6 }}>Your 14-day PREMIER trial has ended.</p>
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 32 }}>Your data is safe. Subscribe to unlock full access. Data archived in {Math.max(0, 30 - trialStatus.day)} days.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => setActiveModule('MARKETPLACE')} className="ign-card-hover" style={{ width: '100%', background: '#2563eb', color: '#fff', fontWeight: 900, padding: 16, borderRadius: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem', boxShadow: '0 10px 25px rgba(37,99,235,0.4)', border: 'none', cursor: 'pointer' }}>
                Subscribe — From $149/mo
              </button>
              <p style={{ fontSize: '0.625rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cancel any time · Data restored instantly</p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {activeModule === 'INTAKE' && (
          <AccessGatekeeper requiredPermissions={['view_flux']}>
            <IgnitionIntake
              onBack={() => setActiveModule('DASHBOARD')}
              onJobCreated={(job) => {
                const updated = [job, ...allJobs];
                setAllJobs(updated); setActiveJob(job);
                DataBridge.save('active_job_context', job);
                setActiveModule('FLUX');
              }}
            />
          </AccessGatekeeper>
        )}
        {activeModule === 'ESTIMATES' && (
          <AccessGatekeeper requiredPermissions={['view_port']}>
            <IgnitionEstimate />
          </AccessGatekeeper>
        )}
        {activeModule === 'INVOICE' && (
          <AccessGatekeeper requiredPermissions={['view_port']}>
            <IgnitionInvoice onBack={() => setActiveModule('DASHBOARD')} />
          </AccessGatekeeper>
        )}
        {activeModule === 'EVAL' && (
          <AccessGatekeeper requiredPermissions={['view_flux']}>
            <IgnitionEval job={activeJob} onBack={() => setActiveModule('FLUX')} onEvalSubmitted={() => setActiveModule('FLUX')} />
          </AccessGatekeeper>
        )}
        {activeModule === 'OMNI' && (
          <AccessGatekeeper requiredPermissions={['view_omni']}>
            <IgnitionOmni activeJob={activeJob} onEnterKiosk={() => setIsKioskMode(true)} />
          </AccessGatekeeper>
        )}
        {activeModule === 'PORT' && (
          <AccessGatekeeper requiredPermissions={['view_port']}>
            <IgnitionPort activeJob={activeJob} allJobs={allJobs} onUpdateJob={handleUpdateJob} onSelectJob={(j) => { setActiveJob(j); DataBridge.save('active_job_context', j); }} />
          </AccessGatekeeper>
        )}
        {activeModule === 'HUB' && (
          <AccessGatekeeper requiredPermissions={['view_hub']}>
            <IgnitionHub activeJob={activeJob} />
          </AccessGatekeeper>
        )}
        {activeModule === 'PROC' && (
          <AccessGatekeeper requiredPermissions={['view_proc']}>
            <TrialGatekeeper moduleKey="PROC" moduleName="PROC // Vendor Shadowing">
              <IgnitionProc />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}
        {activeModule === 'CRM' && (
          <AccessGatekeeper requiredPermissions={['view_crm']}>
            <TrialGatekeeper moduleKey="CRM" moduleName="CRM // Client Directory">
              <IgnitionCRM />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

        {activeModule === 'DASHBOARD' && (
          <div style={{ padding: '32px 32px 128px' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, fontStyle: 'italic', marginBottom: 8, color: '#fff' }}>IGNITION OS</h1>
            <p style={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 48 }}>
              Operational Command Grid // {shopName || DataBridge.load('shop_info')?.name || 'Your Shop'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', columnGap: 16, rowGap: 32, justifyItems: 'center' }}>
              {DASH_APPS.map(app => {
                const { isExpired } = DataBridge.checkTrialStatus(app.id);
                const mod     = subscriptions[app.id];
                const isAdmin = currentUser?.permissions?.includes('ADMIN');
                const isLocked = !isAdmin && (!mod || (!mod.active && !mod.trialActive) || isExpired);
                const AppIcon = app.icon;
                return (
                  <button
                    key={app.id}
                    onClick={() => setActiveModule(app.id)}
                    className="ign-card-hover"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'relative', width: 64, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div style={{ width: 60, height: 60, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid rgba(51,65,85,0.8)', background: '#1e293b', opacity: isLocked ? 0.4 : 1, filter: isLocked ? 'grayscale(1)' : 'none', position: 'relative' }}>
                      {isLocked && (
                        <div style={{ position: 'absolute', top: -4, right: -4, background: '#0f172a', border: '1px solid #334155', padding: 6, borderRadius: '50%', zIndex: 10, boxShadow: '0 20px 25px rgba(0,0,0,0.5)' }}>
                          <Lock size={12} style={{ color: '#ef4444' }} />
                        </div>
                      )}
                      <AppIcon size={28} style={{ color: app.iconColor }} />
                    </div>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{app.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeModule === 'FLUX' && (
          <AccessGatekeeper requiredPermissions={['view_flux']}>
            <TrialGatekeeper moduleKey="FLUX" moduleName="Ignition Flux">
              <IgnitionFlux onNavigate={(module) => setActiveModule(module)} onSelectJob={(j) => { setActiveJob(j); DataBridge.save('active_job_context', j); }} onEnterKiosk={() => setIsKioskMode(true)} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}
        {activeModule === 'PREDICTIVE' && (
          <AccessGatekeeper requiredPermissions={['view_predictive']}>
            <TrialGatekeeper moduleKey="PREDICTIVE" moduleName="Predictive Fleet Key">
              <PredictiveKey clientTier={subscriptions['PREDICTIVE']?.tier || 'BASIC'} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}
        {activeModule === 'CIPHER' && (
          <AccessGatekeeper requiredPermissions={['view_cipher']}>
            <TrialGatekeeper moduleKey="CODE" moduleName="CODE // DTC Cipher">
              <IgnitionCipher activeJob={activeJob} onUpdateJob={handleUpdateJob} onNavigateToStok={(query) => { setStokSearchQuery(query); setActiveModule('STOK'); }} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}
        {activeModule === 'STOK' && (
          <AccessGatekeeper requiredPermissions={['view_stok']}>
            <TrialGatekeeper moduleKey="STOK" moduleName="STOK // Inventory Matrix">
              <IgnitionStok initialSearchTerm={stokSearchQuery} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}
        {activeModule === 'PROT' && (
          <AccessGatekeeper requiredPermissions={['view_prot']}>
            <TrialGatekeeper moduleKey="PROT" moduleName="PROT // Margin Matrix">
              <IgnitionProt />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}
        {activeModule === 'COMPLIANCE' && (
          <AccessGatekeeper requiredPermissions={[]}>
            <IgnitionCompliance onComplete={() => setActiveModule('DASHBOARD')} />
          </AccessGatekeeper>
        )}
        {activeModule === 'MARKETPLACE' && (
          <AccessGatekeeper requiredPermissions={['view_marketplace']}>
            <AdminSubscription />
          </AccessGatekeeper>
        )}
        {activeModule === 'AUDIT' && (
          <AccessGatekeeper requiredPermissions={['view_omni']}>
            <IgnitionAudit />
          </AccessGatekeeper>
        )}
        {activeModule === 'ADMIN' && (
          <AccessGatekeeper requiredPermissions={['manage_users']}>
            <IgnitionAdmin />
          </AccessGatekeeper>
        )}
        {activeModule === 'TOOLS' && (
          <AccessGatekeeper requiredPermissions={['manage_users']}>
            <IgnitionTools />
          </AccessGatekeeper>
        )}
      </main>

      {/* GLOBAL FOOTER NAVIGATION */}
      <nav style={{ height: 80, background: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '0 16px', overflowX: 'auto', position: 'relative', zIndex: 50 }}>
        {NAV_ITEMS.map(nav => (
          <button
            key={nav.id}
            onClick={() => setActiveModule(nav.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: activeModule === nav.id ? nav.activeColor : '#475569', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <nav.Icon size={20} />
            <span style={{ fontSize: '0.5625rem', fontWeight: 900, textTransform: 'uppercase' }}>{nav.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default CoreApp;
