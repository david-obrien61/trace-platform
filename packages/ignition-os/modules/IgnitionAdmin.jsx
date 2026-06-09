/**
 * FILE: modules/IgnitionAdmin.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Full staff management, role editor, and shop settings.
 *          Gated to ADMIN permission. Replaces the React Native placeholder.
 */

import React, { useState, useEffect } from 'react';
import {
  Users, ShieldCheck, Settings, Plus, Trash2, Save, Lock,
  AlertTriangle, CheckCircle, Eye, EyeOff,
  UserMinus, UserPlus, Edit3, X, Phone, Send,
  KeyRound, Copy, RefreshCw, QrCode, Smartphone, User, Shield,
  WifiOff, Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

const STYLE_DEBUG = true; // [TRACE:STYLE] STD-003: set true to enable style logs

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  { id: 'view_omni',        label: 'View OMNI (Command)',      group: 'Modules' },
  { id: 'view_hub',         label: 'View HUB (Dispatch)',      group: 'Modules' },
  { id: 'view_flux',        label: 'View FLUX (Workflow)',     group: 'Modules' },
  { id: 'view_cipher',      label: 'View CIPHER (DTC)',        group: 'Modules' },
  { id: 'view_stok',        label: 'View STOK (Inventory)',   group: 'Modules' },
  { id: 'view_proc',        label: 'View PROC (Vendors)',      group: 'Modules' },
  { id: 'view_prot',        label: 'View PROT (Margins)',      group: 'Modules' },
  { id: 'view_port',        label: 'View PORT (Estimates)',    group: 'Modules' },
  { id: 'view_crm',         label: 'View CRM (Clients)',       group: 'Modules' },
  { id: 'view_predictive',  label: 'View PREDICTIVE',          group: 'Modules' },
  { id: 'view_marketplace', label: 'View Marketplace',         group: 'Modules' },
  { id: 'PRICING_AUTHORITY',label: 'Edit Pricing Slabs',       group: 'Financial' },
  { id: 'edit_margins',     label: 'Edit Margins (Legacy)',    group: 'Financial' },
  { id: 'approve_payroll',  label: 'Approve Payroll',          group: 'Financial' },
  { id: 'manage_users',     label: 'Manage Staff',             group: 'Admin' },
  { id: 'scan_parts',       label: 'Scan Parts',               group: 'Tech Ops' },
  { id: 'update_flux',      label: 'Update Job Status',        group: 'Tech Ops' },
  { id: 'sign_estimates',   label: 'Sign Estimates',           group: 'Customer' },
  { id: 'pay_invoice',      label: 'Pay Invoice',              group: 'Customer' },
];

const PERM_GROUPS = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

const ROLE_PRESETS = {
  ADMIN:    ['view_omni','view_hub','view_flux','view_predictive','view_cipher','view_stok','view_proc','view_prot','view_port','view_crm','view_marketplace','edit_margins','PRICING_AUTHORITY','manage_users','approve_payroll','scan_parts','update_flux'],
  TECH:     ['view_hub','view_flux','view_cipher','view_stok','scan_parts','update_flux'],
  SERVICE:  ['view_port','view_crm','view_cipher','view_stok','sign_estimates'],
  CUSTOMER: ['view_port','sign_estimates','pay_invoice'],
};

const SUB_ROLES = {
  TECH:     ['SR_TECH', 'BAY_TECH', 'APPRENTICE'],
  SERVICE:  ['ADVISOR', 'CASHIER'],
  ADMIN:    [],
  CUSTOMER: [],
};

const formatLastSeen = (ts) => {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days} days ago`;
  return new Date(ts).toLocaleDateString();
};

// ─── STYLE CONSTANTS ──────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
};

const modalCardBase = {
  backgroundColor: '#020617', border: '1px solid #1e293b',
  borderRadius: 32, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', width: '100%',
};

const inputStyle = {
  width: '100%', backgroundColor: '#000', border: '1px solid #1e293b',
  borderRadius: 12, padding: '12px 16px', color: '#fff',
  fontWeight: 700, fontSize: 14,
};

const selectStyle = {
  width: '100%', backgroundColor: '#000', border: '1px solid #1e293b',
  borderRadius: 12, padding: '12px 16px', color: '#fff',
  fontWeight: 700, fontSize: 14,
};

const sectionLabel = {
  fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase',
  letterSpacing: '0.1em', display: 'block', marginBottom: 8,
};

const permGroupLabel = {
  fontSize: 8, fontWeight: 900, color: '#334155', textTransform: 'uppercase',
  letterSpacing: '0.1em', marginBottom: 8,
};

const BADGE_COLORS = {
  blue:    { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.2)'  },
  emerald: { bg: 'rgba(16,185,129,0.1)', color: '#34d399', border: 'rgba(16,185,129,0.2)' },
  orange:  { bg: 'rgba(249,115,22,0.1)', color: '#fb923c', border: 'rgba(249,115,22,0.2)'  },
  red:     { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.2)'   },
  slate:   { bg: '#1e293b',              color: '#94a3b8', border: '#334155'               },
  purple:  { bg: 'rgba(168,85,247,0.1)', color: '#c084fc', border: 'rgba(168,85,247,0.2)'  },
};

const toggleBtn = (active) => ({
  fontSize: 9, fontWeight: 900, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
  backgroundColor: active ? 'rgba(37,99,235,0.2)' : '#0f172a',
  border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1e293b',
  color: active ? '#60a5fa' : '#475569',
});

const rolePresetBtn = (active) => ({
  fontSize: 9, fontWeight: 900, padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
  textTransform: 'uppercase', letterSpacing: '0.1em',
  backgroundColor: active ? 'rgba(37,99,235,0.2)' : '#0f172a',
  border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1e293b',
  color: active ? '#60a5fa' : '#64748b',
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const Tab = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 20px', borderRadius: 12, cursor: 'pointer',
      fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
      whiteSpace: 'nowrap',
      backgroundColor: active ? '#2563eb' : '#0f172a',
      border: active ? '1px solid #2563eb' : '1px solid #1e293b',
      color: active ? '#fff' : '#64748b',
      boxShadow: active ? '0 4px 16px rgba(30,58,138,0.3)' : 'none',
    }}
  >
    <Icon size={13} />
    {label}
  </button>
);

const Badge = ({ label, color = 'slate' }) => {
  const c = BADGE_COLORS[color] || BADGE_COLORS.slate;
  return (
    <span style={{
      fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 999,
      border: `1px solid ${c.border}`,
      backgroundColor: c.bg, color: c.color,
    }}>
      {label}
    </span>
  );
};

const roleColor = (role) => {
  if (role === 'ADMIN' || role === 'OWNER') return 'blue';
  if (role === 'TECH' || role === 'TECHNICIAN') return 'emerald';
  if (role === 'SERVICE') return 'orange';
  if (role === 'DEVELOPER') return 'purple';
  return 'slate';
};

const SaveBanner = ({ saved }) =>
  saved ? (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    }}>
      <CheckCircle size={14} style={{ color: '#34d399' }} />
      <span style={{ fontSize: 10, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Changes saved
      </span>
    </div>
  ) : null;

// ─── ADD STAFF MODAL ─────────────────────────────────────────────────────────

const AddStaffModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', role: 'TECH', pin: '', permissions: [...ROLE_PRESETS.TECH] });
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = (role) => {
    setForm(f => ({ ...f, role, permissions: [...(ROLE_PRESETS[role] || [])] }));
  };

  const togglePerm = (permId) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId]
    }));
  };

  const save = () => {
    if (!form.name.trim()) return setError('Name is required.');
    if (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) return setError('PIN must be exactly 4 digits.');
    const profiles = DataBridge.getProfiles();
    if (profiles[form.pin]) return setError(`PIN ${form.pin} is already in use by ${profiles[form.pin].name}.`);

    const newProfile = {
      id: form.pin,
      name: form.name.toUpperCase().trim(),
      role: form.role,
      permissions: form.permissions,
      allowed: form.permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')),
      hasSignedWaiver: false,
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] },
      createdAt: new Date().toISOString(),
    };

    const allProfiles = { ...profiles, [form.pin]: newProfile };
    DataBridge.save('user_profiles', allProfiles);
    onSaved(newProfile);
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 512, maxHeight: '80dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Add Staff Member
          </h3>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px' }}>
              <AlertTriangle size={13} style={{ color: '#f87171' }} />
              <p style={{ fontSize: 10, fontWeight: 900, color: '#f87171' }}>{error}</p>
            </div>
          )}

          <div>
            <label style={sectionLabel}>Full Name</label>
            <input
              className="ign-input"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              placeholder="J. SMITH"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={sectionLabel}>Role</label>
              <select
                className="ign-input"
                value={form.role}
                onChange={e => applyPreset(e.target.value)}
                style={selectStyle}
              >
                {Object.keys(ROLE_PRESETS).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={sectionLabel}>4-Digit PIN</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="ign-input"
                  type={showPin ? 'text' : 'password'}
                  value={form.pin}
                  onChange={e => { setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })); setError(''); }}
                  placeholder="----"
                  maxLength={4}
                  style={{ ...inputStyle, paddingRight: 40, fontWeight: 900, fontSize: 20, letterSpacing: '0.4em', textAlign: 'center' }}
                />
                <button
                  onClick={() => setShowPin(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ ...sectionLabel, marginBottom: 0 }}>Permissions</label>
              <p style={{ fontSize: 9, color: '#475569' }}>{form.permissions.length} active</p>
            </div>
            {PERM_GROUPS.map(group => (
              <div key={group} style={{ marginBottom: 12 }}>
                <p style={permGroupLabel}>{group}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                    const on = form.permissions.includes(perm.id);
                    return (
                      <button key={perm.id} onClick={() => togglePerm(perm.id)} style={toggleBtn(on)}>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={save} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            <UserPlus size={13} /> Add Member
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── INVITE STAFF MODAL ──────────────────────────────────────────────────────

const InviteStaffModal = ({ onClose }) => {
  const shopId = DataBridge.load('shop_info')?.id || DataBridge.load('shop_policy')?.shop_id;
  const [form, setForm] = useState({ name: '', role: 'TECH', sub_role: '', team_id: '', phone: '', permissions: [...ROLE_PRESETS.TECH] });
  const [teams, setTeams] = useState([]);
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    supabase.from('teams').select('id, name').eq('shop_id', shopId).order('name')
      .then(({ data }) => setTeams(data || []));
  }, [shopId]);

  const applyRolePreset = (role) => {
    setForm(f => ({ ...f, role, sub_role: '', permissions: [...(ROLE_PRESETS[role] || [])] }));
  };

  const togglePerm = (permId) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId],
    }));
  };

  const generate = async () => {
    if (!form.name.trim()) return setError('Name is required.');
    if (!shopId) return setError('Shop not initialized. Complete onboarding first.');
    setLoading(true);
    setError('');

    const token = crypto.randomUUID();
    const { data: invite, error: inviteErr } = await supabase
      .from('shop_invites')
      .insert({ token, shop_id: shopId, name: form.name.trim().toUpperCase(), role: form.role, phone: form.phone.trim() || null })
      .select('id')
      .single();

    if (inviteErr) {
      setError('Failed to generate invite. Check connection.');
      setLoading(false);
      return;
    }

    const { error: memberErr } = await supabase.from('shop_members').insert({
      shop_id: shopId, invite_id: invite.id,
      name: form.name.trim().toUpperCase(), role: form.role,
      sub_role: form.sub_role || null, team_id: form.team_id || null,
      phone: form.phone.trim() || null, permissions: form.permissions, active: false,
    });

    if (memberErr) {
      setError('Invite created but member record failed. Check connection.');
      setLoading(false);
      return;
    }

    setInviteLink(`${window.location.origin}/?join=${shopId}&invite=${token}`);
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendSms = () => {
    const msg = `You've been invited to join the team on Ignition OS. Tap to set up your profile: ${inviteLink}`;
    const phone = form.phone.replace(/\D/g, '');
    window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`);
  };

  const subRoles = SUB_ROLES[form.role] || [];

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 512, maxHeight: '80dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Invite Staff Member
          </h3>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px' }}>
              <AlertTriangle size={13} style={{ color: '#f87171' }} />
              <p style={{ fontSize: 10, fontWeight: 900, color: '#f87171' }}>{error}</p>
            </div>
          )}

          {!inviteLink ? (
            <>
              <div>
                <label style={sectionLabel}>Full Name *</label>
                <input className="ign-input" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }} placeholder="MIKE SMITH" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={sectionLabel}>Role</label>
                  <select className="ign-input" value={form.role} onChange={e => applyRolePreset(e.target.value)} style={selectStyle}>
                    <option value="TECH">Technician</option>
                    <option value="SERVICE">Front Office</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={sectionLabel}>Tier</label>
                  <select className="ign-input" value={form.sub_role} onChange={e => setForm(f => ({ ...f, sub_role: e.target.value }))} disabled={subRoles.length === 0} style={{ ...selectStyle, opacity: subRoles.length === 0 ? 0.4 : 1, cursor: subRoles.length === 0 ? 'not-allowed' : 'pointer' }}>
                    <option value="">No tier</option>
                    {subRoles.map(sr => <option key={sr} value={sr}>{sr.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={sectionLabel}>Team</label>
                  <select className="ign-input" value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} style={selectStyle}>
                    <option value="">No team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sectionLabel}>Phone (SMS)</label>
                  <input className="ign-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="512-555-0100" type="tel" style={inputStyle} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ ...sectionLabel, marginBottom: 0 }}>Permissions</label>
                  <p style={{ fontSize: 9, color: '#475569' }}>{form.permissions.length} active · set before invite is sent</p>
                </div>
                {PERM_GROUPS.map(group => (
                  <div key={group} style={{ marginBottom: 12 }}>
                    <p style={permGroupLabel}>{group}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                        const on = form.permissions.includes(perm.id);
                        return (
                          <button key={perm.id} onClick={() => togglePerm(perm.id)} style={toggleBtn(on)}>
                            {perm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ backgroundColor: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 16 }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Invite generated for {form.name}
                </p>
                <p style={{ fontSize: 10, color: '#94a3b8', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.625 }}>{inviteLink}</p>
              </div>
              <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, backgroundColor: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <QRCodeSVG value={inviteLink} size={28} bgColor="#ffffff" fgColor="#000000" level="M" />
                </div>
                <p style={{ fontSize: 9, color: '#64748b' }}>QR code above or share the link · single-use · {form.name} sets their own PIN</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button onClick={copy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
                  <Copy size={13} /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={sendSms} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
                  <Send size={13} /> Send SMS
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 24, borderTop: '1px solid #1e293b', display: 'flex', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            {inviteLink ? 'Done' : 'Cancel'}
          </button>
          {!inviteLink && (
            <button
              onClick={generate}
              disabled={loading || !form.name.trim()}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: loading || !form.name.trim() ? 'not-allowed' : 'pointer', opacity: loading || !form.name.trim() ? 0.5 : 1 }}
            >
              {loading ? 'Generating...' : <><Send size={13} /> Generate Invite</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CREATE TEAM MODAL ───────────────────────────────────────────────────────

const CreateTeamModal = ({ shopId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) return setError('Team name is required.');
    setLoading(true);
    const { error: err } = await supabase.from('teams').insert({
      shop_id: shopId, name: name.trim().toUpperCase(), description: description.trim() || null,
    });
    setLoading(false);
    if (err) { setError('Failed to create team. Check connection.'); return; }
    onCreated();
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 384 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #1e293b' }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Create Team</h3>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px' }}>
              <AlertTriangle size={13} style={{ color: '#f87171' }} />
              <p style={{ fontSize: 10, fontWeight: 900, color: '#f87171' }}>{error}</p>
            </div>
          )}
          <div>
            <label style={sectionLabel}>Team Name *</label>
            <input className="ign-input" value={name} onChange={e => { setName(e.target.value.toUpperCase()); setError(''); }} placeholder="TECH TEAM" style={inputStyle} />
          </div>
          <div>
            <label style={sectionLabel}>Description</label>
            <input className="ign-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
        </div>
        <div style={{ padding: 24, borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={loading || !name.trim()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: loading || !name.trim() ? 'not-allowed' : 'pointer', opacity: loading || !name.trim() ? 0.5 : 1 }}>
            <Layers size={13} /> {loading ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MANAGE MEMBER MODAL ──────────────────────────────────────────────────────

const ManageMemberModal = ({ member, shopId, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [form, setForm] = useState({
    name: member.name, role: member.role,
    sub_role: member.sub_role || '', phone: member.phone || '', team_id: member.team_id || '',
  });
  const [permissions, setPermissions] = useState([...(member.permissions || [])]);
  const [teams, setTeams]     = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [saved, setSaved]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('id, name').eq('shop_id', shopId).order('name'),
      supabase.from('member_devices').select('*').eq('member_id', member.id).order('created_at', { ascending: false }),
    ]).then(([teamsRes, devicesRes]) => {
      setTeams(teamsRes.data || []);
      setDevices(devicesRes.data || []);
    });
  }, [member.id, shopId]);

  const applyRolePreset = (role) => {
    setForm(f => ({ ...f, role, sub_role: '' }));
    setPermissions([...(ROLE_PRESETS[role] || [])]);
  };

  const togglePerm = (permId) => {
    setPermissions(p => p.includes(permId) ? p.filter(x => x !== permId) : [...p, permId]);
  };

  const save = async () => {
    setLoading(true); setError('');
    const { error: err } = await supabase.from('shop_members').update({
      name: form.name.trim().toUpperCase(), role: form.role, sub_role: form.sub_role || null,
      phone: form.phone.trim() || null, team_id: form.team_id || null, permissions,
    }).eq('id', member.id);
    setLoading(false);
    if (err) { setError('Failed to save. Check connection.'); return; }
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1200);
  };

  const disableDevice = async (id) => {
    await supabase.from('member_devices').update({ is_active: false }).eq('id', id);
    setDevices(d => d.map(dev => dev.id === id ? { ...dev, is_active: false } : dev));
  };
  const enableDevice = async (id) => {
    await supabase.from('member_devices').update({ is_active: true }).eq('id', id);
    setDevices(d => d.map(dev => dev.id === id ? { ...dev, is_active: true } : dev));
  };
  const deleteDevice = async (id) => {
    await supabase.from('member_devices').delete().eq('id', id);
    setDevices(d => d.filter(dev => dev.id !== id));
    setConfirmDelete(null);
  };

  const subRoles = SUB_ROLES[form.role] || [];
  const MANAGE_TABS = [
    { id: 'profile',     label: 'Profile',     Icon: User },
    { id: 'permissions', label: 'Permissions', Icon: Shield },
    { id: 'devices',     label: `Devices (${devices.length})`, Icon: Smartphone },
  ];

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 512, maxHeight: '80dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{member.name}</h3>
            <p style={{ fontSize: 9, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manage Member</p>
          </div>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '16px 24px 0', flexShrink: 0 }}>
          {MANAGE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 12, cursor: 'pointer',
                fontWeight: 900, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
                backgroundColor: activeTab === id ? '#2563eb' : '#0f172a',
                border: activeTab === id ? '1px solid #2563eb' : '1px solid #1e293b',
                color: activeTab === id ? '#fff' : '#64748b',
              }}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px' }}>
              <AlertTriangle size={13} style={{ color: '#f87171' }} />
              <p style={{ fontSize: 10, fontWeight: 900, color: '#f87171' }}>{error}</p>
            </div>
          )}
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px' }}>
              <CheckCircle size={13} style={{ color: '#34d399' }} />
              <p style={{ fontSize: 10, fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Saved</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <>
              <div>
                <label style={sectionLabel}>Full Name</label>
                <input className="ign-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={sectionLabel}>Role</label>
                  <select className="ign-input" value={form.role} onChange={e => applyRolePreset(e.target.value)} style={selectStyle}>
                    <option value="TECH">Technician</option>
                    <option value="SERVICE">Front Office</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={sectionLabel}>Tier</label>
                  <select className="ign-input" value={form.sub_role} onChange={e => setForm(f => ({ ...f, sub_role: e.target.value }))} disabled={subRoles.length === 0} style={{ ...selectStyle, opacity: subRoles.length === 0 ? 0.4 : 1, cursor: subRoles.length === 0 ? 'not-allowed' : 'pointer' }}>
                    <option value="">No tier</option>
                    {subRoles.map(sr => <option key={sr} value={sr}>{sr.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={sectionLabel}>Team</label>
                  <select className="ign-input" value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} style={selectStyle}>
                    <option value="">No team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={sectionLabel}>Phone</label>
                  <input className="ign-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} type="tel" placeholder="512-555-0100" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'permissions' && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                {Object.keys(ROLE_PRESETS).map(r => (
                  <button key={r} onClick={() => { setForm(f => ({ ...f, role: r })); setPermissions([...ROLE_PRESETS[r]]); }} style={rolePresetBtn(form.role === r)}>
                    {r}
                  </button>
                ))}
              </div>
              {PERM_GROUPS.map(group => (
                <div key={group} style={{ marginBottom: 12 }}>
                  <p style={permGroupLabel}>{group}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                      const on = permissions.includes(perm.id);
                      return (
                        <button key={perm.id} onClick={() => togglePerm(perm.id)} style={toggleBtn(on)}>
                          {perm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'devices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {devices.length === 0 && (
                <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                  <Smartphone size={28} style={{ color: '#334155', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No devices enrolled</p>
                  <p style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>Devices appear here after the member logs in</p>
                </div>
              )}
              {devices.map(dev => (
                <div key={dev.id} style={{ backgroundColor: '#0f172a', border: `1px solid ${dev.is_active ? '#1e293b' : 'rgba(239,68,68,0.2)'}`, borderRadius: 16, padding: '16px 20px', opacity: dev.is_active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 16, border: `1px solid ${dev.is_active ? '#334155' : 'rgba(239,68,68,0.2)'}`, backgroundColor: dev.is_active ? '#1e293b' : 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {dev.is_active ? <Smartphone size={16} style={{ color: '#94a3b8' }} /> : <WifiOff size={16} style={{ color: '#f87171' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>{dev.device_label || 'Unknown Device'}</p>
                        {!dev.is_active && <Badge label="Disabled" color="red" />}
                        {dev.biometric_enrolled && <Badge label="Biometrics" color="emerald" />}
                      </div>
                      <p style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>Last seen: {formatLastSeen(dev.last_seen)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {dev.is_active ? (
                        <button onClick={() => disableDevice(dev.id)} title="Disable this device" style={{ fontSize: 9, fontWeight: 900, backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', padding: '8px 12px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                          Disable
                        </button>
                      ) : (
                        <>
                          <button onClick={() => enableDevice(dev.id)} style={{ fontSize: 9, fontWeight: 900, backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399', padding: '8px 12px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                            Re-enable
                          </button>
                          {confirmDelete === dev.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button onClick={() => deleteDevice(dev.id)} style={{ fontSize: 9, fontWeight: 900, backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', padding: '8px 12px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                                Confirm Delete
                              </button>
                              <button onClick={() => setConfirmDelete(null)} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}><X size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(dev.id)} style={{ fontSize: 9, fontWeight: 900, backgroundColor: '#1e293b', border: '1px solid #334155', color: '#64748b', padding: '8px 12px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 9, color: '#334155', textAlign: 'center', paddingTop: 8 }}>Disable = device locked out but recoverable · Delete = permanent</p>
            </div>
          )}
        </div>

        {activeTab !== 'devices' && (
          <div style={{ padding: 24, borderTop: '1px solid #1e293b', display: 'flex', gap: 12, flexShrink: 0 }}>
            <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={save} disabled={loading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
              <Save size={13} /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
        {activeTab === 'devices' && (
          <div style={{ padding: 24, borderTop: '1px solid #1e293b', flexShrink: 0 }}>
            <button onClick={onClose} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── REVOKE MODAL ─────────────────────────────────────────────────────────────

const RevokeModal = ({ user, onClose, onRevoked }) => {
  const [confirm, setConfirm] = useState('');
  const ready = confirm === 'REVOKE';

  const revoke = () => {
    if (!ready) return;
    const profiles = DataBridge.getProfiles();
    const { [user.id]: removed, ...rest } = profiles;
    DataBridge.save('user_profiles', rest);

    const log = DataBridge.load('admin_audit_log') || [];
    log.push({ action: 'USER_REVOKED', userId: user.id, userName: user.name, timestamp: Date.now() });
    DataBridge.save('admin_audit_log', log);

    const current = DataBridge.load('current_user');
    if (current?.id === user.id) DataBridge.save('current_user', null);

    onRevoked(user.id);
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 384, border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <UserMinus size={40} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Revoke Access</h3>
          <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 24 }}>
            This will permanently remove <span style={{ color: '#fff', fontWeight: 900 }}>{user.name}</span>'s identity from the system. They will be logged out immediately.
          </p>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Type <span style={{ color: '#f87171', fontWeight: 900 }}>REVOKE</span> to confirm
            </p>
            <input
              className="ign-input"
              value={confirm}
              onChange={e => setConfirm(e.target.value.toUpperCase())}
              placeholder="REVOKE"
              style={{ ...inputStyle, textAlign: 'center', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={revoke} disabled={!ready} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: !ready ? 'not-allowed' : 'pointer', opacity: !ready ? 0.3 : 1 }}>
              <UserMinus size={13} /> Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── EDIT PERMISSIONS MODAL ───────────────────────────────────────────────────

const EditPermissionsModal = ({ user, onClose, onSaved }) => {
  const [permissions, setPermissions] = useState([...(user.permissions || [])]);
  const [role, setRole] = useState(user.role || 'TECH');

  const applyPreset = (r) => {
    setRole(r);
    setPermissions([...(ROLE_PRESETS[r] || [])]);
  };

  const togglePerm = (permId) => {
    setPermissions(p => p.includes(permId) ? p.filter(x => x !== permId) : [...p, permId]);
  };

  const save = () => {
    const profiles = DataBridge.getProfiles();
    const updated = { ...profiles[user.id], role, permissions, allowed: permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')) };
    DataBridge.save('user_profiles', { ...profiles, [user.id]: updated });
    onSaved(updated);
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 512, maxHeight: '80dvh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottom: '1px solid #1e293b' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Edit: {user.name}</h3>
            <p style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>PIN {user.id}</p>
          </div>
          <button onClick={onClose} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={sectionLabel}>Role Template</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.keys(ROLE_PRESETS).map(r => (
                <button key={r} onClick={() => applyPreset(r)} style={rolePresetBtn(role === r)}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ ...sectionLabel, marginBottom: 12 }}>
              Permissions <span style={{ color: '#475569', fontWeight: 400 }}>({permissions.length} active)</span>
            </label>
            {PERM_GROUPS.map(group => (
              <div key={group} style={{ marginBottom: 12 }}>
                <p style={permGroupLabel}>{group}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                    const on = permissions.includes(perm.id);
                    return (
                      <button key={perm.id} onClick={() => togglePerm(perm.id)} style={toggleBtn(on)}>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 24, borderTop: '1px solid #1e293b', display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            <Save size={13} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── REVOKE MEMBER MODAL (Supabase) ──────────────────────────────────────────

const RevokeMemberModal = ({ member, onClose, onRevoked }) => {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ready = confirm === 'REVOKE';

  const revoke = async () => {
    if (!ready) return;
    setLoading(true);
    const { error: err } = await supabase.from('shop_members').delete().eq('id', member.id);
    if (err) { setError('Failed to revoke. Check connection.'); setLoading(false); return; }
    if (member.invite_id) {
      await supabase.from('shop_invites').update({ used: true }).eq('id', member.invite_id);
    }
    setLoading(false);
    onRevoked();
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalCardBase, maxWidth: 384, border: '1px solid rgba(239,68,68,0.3)' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <UserMinus size={40} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Revoke Access</h3>
          <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 24 }}>
            This permanently removes <span style={{ color: '#fff', fontWeight: 900 }}>{member.name}</span> from the shop. All enrolled devices will lose access immediately.
          </p>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
              <AlertTriangle size={13} style={{ color: '#f87171' }} />
              <p style={{ fontSize: 10, fontWeight: 900, color: '#f87171' }}>{error}</p>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Type <span style={{ color: '#f87171', fontWeight: 900 }}>REVOKE</span> to confirm
            </p>
            <input
              className="ign-input"
              value={confirm}
              onChange={e => setConfirm(e.target.value.toUpperCase())}
              placeholder="REVOKE"
              style={{ ...inputStyle, textAlign: 'center', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onClose} style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>Cancel</button>
            <button onClick={revoke} disabled={!ready || loading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', color: '#fff', fontWeight: 900, padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: !ready || loading ? 'not-allowed' : 'pointer', opacity: !ready || loading ? 0.3 : 1 }}>
              <UserMinus size={13} /> {loading ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TAB 1: STAFF ─────────────────────────────────────────────────────────────

const StaffTab = () => {
  const shopId = DataBridge.load('shop_info')?.id || DataBridge.load('shop_policy')?.shop_id;
  const [members, setMembers]               = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [showInvite, setShowInvite]         = useState(false);
  const [manageTarget, setManageTarget]     = useState(null);
  const [revokeTarget, setRevokeTarget]     = useState(null);
  const [resetCodeData, setResetCodeData]   = useState(null);
  const [generatingReset, setGeneratingReset] = useState(null);

  const refresh = async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    const [membersRes, invitesRes] = await Promise.all([
      supabase.from('shop_members').select('*').eq('shop_id', shopId).order('joined_at', { ascending: false }),
      supabase.from('shop_invites').select('*').eq('shop_id', shopId).eq('used', false).order('created_at', { ascending: false }),
    ]);
    setMembers(membersRes.data || []);
    setPendingInvites(invitesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [shopId]);

  const generateReset = async (member) => {
    setGeneratingReset(member.id);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabase.from('pin_resets').insert({
      reset_code: code, shop_id: shopId, member_id: member.id,
      member_name: member.name, member_role: member.role,
      permissions: member.permissions || [], expires_at: expiresAt,
    });
    setGeneratingReset(null);
    if (!error) setResetCodeData({ code, name: member.name });
  };

  const revokeInvite = async (inviteId) => {
    await supabase.from('shop_invites').update({ used: true }).eq('id', inviteId);
    setPendingInvites(inv => inv.filter(i => i.id !== inviteId));
  };

  const activeCount  = members.filter(m => m.active).length;
  const pendingCount = members.filter(m => !m.active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {loading ? '...' : `${activeCount} Active · ${pendingCount} Pending`}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} title="Refresh" style={{ padding: 8, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', cursor: 'pointer' }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '8px 16px', borderRadius: 12, border: 'none', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            <Plus size={12} /> Invite Staff
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ign-pulse" style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loading staff...</div>
      ) : members.length === 0 ? (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <Users size={32} style={{ color: '#334155', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No staff members yet</p>
          <p style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>Invite a team member to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => (
            <MemberCard key={m.id} member={m} onManage={setManageTarget} onReset={generateReset} onRevoke={setRevokeTarget} resetting={generatingReset} />
          ))}
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            {pendingInvites.length} Pending Invite{pendingInvites.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingInvites.map(invite => (
              <div key={invite.id} style={{ backgroundColor: '#0f172a', border: '1px solid rgba(30,41,59,0.8)', borderRadius: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>{invite.name}</p>
                    <Badge label={invite.role} color={roleColor(invite.role)} />
                    <Badge label="Awaiting Enrollment" color="orange" />
                  </div>
                  {invite.phone && <p style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{invite.phone}</p>}
                </div>
                <button onClick={() => revokeInvite(invite.id)} title="Cancel invite" style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInvite && <InviteStaffModal onClose={() => { setShowInvite(false); refresh(); }} />}
      {manageTarget && (
        <ManageMemberModal member={manageTarget} shopId={shopId} onClose={() => setManageTarget(null)} onSaved={() => { setManageTarget(null); refresh(); }} />
      )}
      {revokeTarget && (
        <RevokeMemberModal member={revokeTarget} onClose={() => setRevokeTarget(null)} onRevoked={() => { setRevokeTarget(null); refresh(); }} />
      )}

      {resetCodeData && (
        <div style={overlayStyle}>
          <div style={{ ...modalCardBase, maxWidth: 384, border: '1px solid rgba(249,115,22,0.3)' }}>
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <KeyRound size={28} style={{ color: '#fb923c' }} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>PIN Reset Code</p>
              <p style={{ fontSize: 9, color: '#64748b', marginBottom: 24 }}>
                Read this code aloud to <span style={{ color: '#fff', fontWeight: 900 }}>{resetCodeData.name}</span>.<br />
                Valid for 15 minutes · Single use.
              </p>
              <div style={{ backgroundColor: '#000', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 16, padding: '24px 0', marginBottom: 20 }}>
                <p style={{ fontSize: 48, fontWeight: 900, color: '#fb923c', letterSpacing: '0.3em' }}>{resetCodeData.code}</p>
              </div>
              <p style={{ fontSize: 9, color: '#475569', marginBottom: 24 }}>They'll enter this on the "Forgot PIN" screen to set a new PIN.</p>
              <button onClick={() => setResetCodeData(null)} style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '12px 0', borderRadius: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── MEMBER CARD ──────────────────────────────────────────────────────────────

const MemberCard = ({ member, onManage, onReset, onRevoke, resetting }) => (
  <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>
        {member.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
      </span>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>{member.name}</p>
        <Badge label={member.role} color={roleColor(member.role)} />
        {member.sub_role && <Badge label={member.sub_role.replace(/_/g, ' ')} color="slate" />}
        {!member.active && <Badge label="Pending" color="orange" />}
      </div>
      {member.phone && (
        <p style={{ fontSize: 9, color: '#475569', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Phone size={9} /> {member.phone}
        </p>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      {onManage && (
        <button onClick={() => onManage(member)} title="Manage member" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontWeight: 900, padding: '8px 12px', borderRadius: 12, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
          <Edit3 size={11} /> Manage
        </button>
      )}
      {onReset && member.active && (
        <button onClick={() => onReset(member)} disabled={resetting === member.id} title="Generate PIN reset code" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontWeight: 900, padding: '8px 12px', borderRadius: 12, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: resetting === member.id ? 'not-allowed' : 'pointer', opacity: resetting === member.id ? 0.5 : 1 }}>
          <KeyRound size={11} />
          {resetting === member.id ? '...' : 'Reset PIN'}
        </button>
      )}
      {onRevoke && (
        <button onClick={() => onRevoke(member)} title="Revoke access" style={{ padding: 8, backgroundColor: '#1e293b', border: '1px solid #334155', color: '#64748b', borderRadius: 12, cursor: 'pointer' }}>
          <UserMinus size={13} />
        </button>
      )}
    </div>
  </div>
);

// ─── TAB: TEAM ────────────────────────────────────────────────────────────────

const TeamTab = () => {
  const shopId = DataBridge.load('shop_info')?.id || DataBridge.load('shop_policy')?.shop_id;
  const joinUrl = shopId ? `${window.location.origin}/?join=${shopId}` : '';

  const [teams, setTeams]           = useState([]);
  const [members, setMembers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied]         = useState(false);

  const refresh = async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    const [teamsRes, membersRes] = await Promise.all([
      supabase.from('teams').select('*').eq('shop_id', shopId).order('name'),
      supabase.from('shop_members').select('*').eq('shop_id', shopId).order('joined_at', { ascending: false }),
    ]);
    setTeams(teamsRes.data || []);
    setMembers(membersRes.data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [shopId]);

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const membersByTeam = teams.map(team => ({
    team,
    members: members.filter(m => m.team_id === team.id),
  }));
  const unassigned = members.filter(m => !m.team_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Shop QR Code */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Shop Join Code</p>
            <p style={{ fontSize: 9, color: '#475569' }}>Team members scan to join this shop</p>
          </div>
          <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#1e293b', color: '#cbd5e1', fontWeight: 900, padding: '8px 12px', borderRadius: 12, border: 'none', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}>
            <Copy size={11} /> {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {shopId ? (
            <div style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
              <QRCodeSVG value={joinUrl} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
            </div>
          ) : (
            <div style={{ width: 160, height: 160, backgroundColor: '#1e293b', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', textAlign: 'center', padding: '0 16px' }}>Complete onboarding to get QR</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {loading ? '...' : `${members.length} Member${members.length !== 1 ? 's' : ''} · ${teams.length} Team${teams.length !== 1 ? 's' : ''}`}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} title="Refresh" style={{ padding: 8, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#64748b', cursor: 'pointer' }}>
            <RefreshCw size={12} />
          </button>
          <button onClick={() => setShowCreateTeam(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '8px 16px', borderRadius: 12, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            <Layers size={12} /> New Team
          </button>
          <button onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '8px 16px', borderRadius: 12, border: 'none', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
            <Plus size={12} /> Invite
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(30,41,59,0.6)', borderRadius: 12, padding: '10px 16px' }}>
        <p style={{ fontSize: 9, color: '#475569' }}>Team view shows grouping only. Go to <span style={{ color: '#94a3b8', fontWeight: 900 }}>Staff</span> tab to manage members, change permissions, or reset PINs.</p>
      </div>

      {loading ? (
        <div className="ign-pulse" style={{ textAlign: 'center', padding: '32px 0', color: '#475569', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loading teams...</div>
      ) : members.length === 0 && teams.length === 0 ? (
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <Users size={32} style={{ color: '#334155', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No teams yet</p>
          <p style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>Create a team then invite members, or invite directly</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {membersByTeam.map(({ team, members: teamMembers }) => (
            <div key={team.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Layers size={12} style={{ color: '#475569' }} />
                <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{team.name}</p>
                <span style={{ fontSize: 9, color: '#334155' }}>{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
              </div>
              {teamMembers.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(30,41,59,0.5)', borderRadius: 12, padding: '16px 20px', fontSize: 9, color: '#334155', fontStyle: 'italic' }}>No members in this team yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teamMembers.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
              )}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Users size={12} style={{ color: '#475569' }} />
                <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Unassigned</p>
                <span style={{ fontSize: 9, color: '#334155' }}>{unassigned.length} member{unassigned.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {unassigned.map(m => <MemberCard key={m.id} member={m} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateTeam && <CreateTeamModal shopId={shopId} onClose={() => setShowCreateTeam(false)} onCreated={refresh} />}
      {showInvite     && <InviteStaffModal onClose={() => { setShowInvite(false); refresh(); }} />}
    </div>
  );
};

// ─── TAB 2: ROLES ─────────────────────────────────────────────────────────────

const RolesTab = () => {
  const [roles, setRoles] = useState(() => DataBridge.getSystemRoles());
  const [saved, setSaved] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const togglePerm = (roleName, permId) => {
    setRoles(r => {
      const perms = r[roleName] || [];
      return { ...r, [roleName]: perms.includes(permId) ? perms.filter(p => p !== permId) : [...perms, permId] };
    });
    setSaved(false);
  };

  const addRole = () => {
    const name = newRoleName.trim().toUpperCase();
    if (!name || roles[name]) return;
    setRoles(r => ({ ...r, [name]: [] }));
    setNewRoleName('');
  };

  const removeRole = (name) => {
    if (['ADMIN', 'TECH', 'CUSTOMER'].includes(name)) return;
    setRoles(r => { const { [name]: _, ...rest } = r; return rest; });
    setSaved(false);
  };

  const save = () => {
    const config = DataBridge.load('system_config') || {};
    config.roles = roles;
    DataBridge.save('system_config', config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SaveBanner saved={saved} />

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Add Custom Role</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="ign-input"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value.toUpperCase().replace(/\s/g, '_'))}
            placeholder="ROLE_NAME"
            style={{ ...inputStyle, fontWeight: 900, fontFamily: 'monospace', textTransform: 'uppercase' }}
          />
          <button onClick={addRole} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '12px 20px', borderRadius: 12, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {Object.entries(roles).map(([roleName, perms]) => {
          const isCore = ['ADMIN', 'TECH', 'CUSTOMER'].includes(roleName);
          return (
            <div key={roleName} style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Badge label={roleName} color={roleColor(roleName)} />
                  <span style={{ fontSize: 9, color: '#475569' }}>{perms.length} permissions</span>
                  {isCore && <span style={{ fontSize: 8, color: '#334155', textTransform: 'uppercase' }}>system role</span>}
                </div>
                {!isCore && (
                  <button onClick={() => removeRole(roleName)} style={{ color: '#334155', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {PERM_GROUPS.map(group => (
                <div key={group} style={{ marginBottom: 12 }}>
                  <p style={permGroupLabel}>{group}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                      const on = perms.includes(perm.id);
                      return (
                        <button key={perm.id} onClick={() => togglePerm(roleName, perm.id)} style={{ fontSize: 8, fontWeight: 900, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', backgroundColor: on ? 'rgba(37,99,235,0.2)' : '#020617', border: on ? '1px solid rgba(59,130,246,0.4)' : '1px solid #1e293b', color: on ? '#60a5fa' : '#334155' }}>
                          {perm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        className="ign-card-hover"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '20px 0', borderRadius: 16, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 8px 24px rgba(30,58,138,0.3)' }}
      >
        <Save size={14} /> Save Role Definitions
      </button>
    </div>
  );
};

// ─── TAB 3: SHOP SETTINGS ────────────────────────────────────────────────────

const ShopTab = () => {
  const [info, setInfo] = useState(() => DataBridge.load('shop_info') || { name: '', global_contact: { phone: '', email: '', address: '' } });
  const [policy, setPolicy] = useState(() => DataBridge.load('shop_policy') || {});
  const [saved, setSaved] = useState(false);

  const saveAll = async () => {
    DataBridge.save('shop_info', info);
    DataBridge.save('shop_policy', policy);

    const shopId = DataBridge.getShopId();
    if (shopId) {
      const c = info.global_contact || {};
      await supabase.from('shops').update({
        name: info.name || null, phone: c.phone || null, email: c.email || null,
        address: c.address || null, usdot: c.usdot || null,
      }).eq('id', shopId);
      DataBridge.setShopName(info.name || '');
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const setContact = (field, value) => {
    setInfo(i => ({ ...i, global_contact: { ...i.global_contact, [field]: value } }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SaveBanner saved={saved} />

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Shop Identity</h3>

        <div>
          <label style={sectionLabel}>Shop Name</label>
          <input className="ign-input" value={info.name || ''} onChange={e => setInfo(i => ({ ...i, name: e.target.value }))} placeholder="Leander Diesel & Truck" style={inputStyle} />
        </div>

        {[
          { key: 'phone',   label: 'Phone',    placeholder: '512-555-0100' },
          { key: 'email',   label: 'Email',    placeholder: 'service@yourshop.com' },
          { key: 'address', label: 'Address',  placeholder: '123 Main St, Leander, TX 78641' },
          { key: 'usdot',   label: 'USDOT #',  placeholder: 'Optional' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label style={sectionLabel}>{label}</label>
            <input className="ign-input" value={info.global_contact?.[key] || ''} onChange={e => setContact(key, e.target.value)} placeholder={placeholder} style={inputStyle} />
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Policy</h3>

        {[
          { key: 'enable_price_audit', label: 'Price Audit Mode', desc: 'Flag jobs where actual price is below engine suggestion' },
          { key: 'enable_bay_custody', label: 'Bay Custody Tracking', desc: 'Require tech check-in/out for each bay' },
          { key: 'autoLockEnabled',    label: 'Auto-Lock Screen', desc: 'Lock the system after 10 minutes of inactivity' },
          { key: 'is_dot_mandated',    label: 'DOT Mandated Shop', desc: 'Enforce DOT compliance gates before job completion' },
        ].map(({ key, label, desc }) => {
          const val = key === 'is_dot_mandated' ? DataBridge.load('is_dot_mandated') : policy[key];
          const toggle = () => {
            if (key === 'is_dot_mandated') {
              DataBridge.save('is_dot_mandated', !val);
            } else {
              setPolicy(p => ({ ...p, [key]: !p[key] }));
            }
          };
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
                <p style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{desc}</p>
              </div>
              <button
                onClick={toggle}
                style={{ position: 'relative', width: 48, height: 24, borderRadius: 999, border: `1px solid ${val ? '#3b82f6' : '#334155'}`, backgroundColor: val ? '#2563eb' : '#1e293b', flexShrink: 0, cursor: 'pointer', padding: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: val ? 24 : 2, width: 18, height: 18, borderRadius: 999, backgroundColor: val ? '#fff' : '#475569', transition: 'left 0.15s ease' }} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 24, padding: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 900, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Danger Zone</h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Restart Onboarding</p>
            <p style={{ fontSize: 9, color: '#64748b' }}>Resets shop setup and PIN. Job data is kept.</p>
          </div>
          <button
            onClick={() => { if (window.confirm('Restart onboarding? Your jobs and settings are preserved — only shop registration and login will reset.')) { DataBridge.resetOnboarding(); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fb923c', fontWeight: 900, padding: '8px 16px', borderRadius: 12, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
          >
            <AlertTriangle size={12} /> Restart
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Simulate Trial Day</p>
            <p style={{ fontSize: 9, color: '#64748b' }}>Jump to any day to preview trial banners &amp; gates.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[0, 7, 12, 15, 30].map(day => (
              <button key={day} onClick={() => DataBridge.simulateTrialDay(day)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 900, padding: '6px 12px', borderRadius: 8, fontSize: 9, textTransform: 'uppercase', cursor: 'pointer' }}>
                D{day}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #1e293b', paddingTop: 16 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Factory Reset</p>
            <p style={{ fontSize: 9, color: '#475569' }}>Wipes all local data. Cannot be undone.</p>
          </div>
          <button
            onClick={() => { if (window.confirm('FACTORY RESET: This permanently deletes all data. Are you absolutely sure?')) { DataBridge.factoryReset(); } }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 900, padding: '8px 16px', borderRadius: 12, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
          >
            <AlertTriangle size={12} /> Reset
          </button>
        </div>
      </div>

      <button
        onClick={saveAll}
        className="ign-card-hover"
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2563eb', color: '#fff', fontWeight: 900, padding: '20px 0', borderRadius: 16, border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 8px 24px rgba(30,58,138,0.3)' }}
      >
        <Save size={14} /> Save Settings
      </button>
    </div>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'TEAM',  label: 'Team',          icon: QrCode      },
  { id: 'STAFF', label: 'Staff',         icon: Users       },
  { id: 'ROLES', label: 'Roles',         icon: ShieldCheck },
  { id: 'SHOP',  label: 'Shop Settings', icon: Settings    },
];

const IgnitionAdmin = () => {
  const currentUser = DataBridge.load('current_user');
  const [activeTab, setActiveTab] = useState('TEAM');

  const isAdmin = currentUser?.permissions?.includes('ADMIN') || currentUser?.permissions?.includes('manage_users');

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32, textAlign: 'center' }}>
        <Lock size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>Admin Access Required</h2>
        <p style={{ color: '#64748b', fontSize: 12, maxWidth: 320 }}>Your identity matrix does not have the manage_users permission.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, backgroundColor: '#000', minHeight: '100%', color: '#e2e8f0' }}>
      <header style={{ marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 24 }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', color: '#fff', textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 4 }}>
          Admin{' '}
          <span style={{ color: '#3b82f6', borderLeft: '4px solid #3b82f6', paddingLeft: 16, marginLeft: 16 }}>
            Command Center
          </span>
        </h1>
        <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
          Staff Management · Role Configuration · Shop Policy
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(t => (
          <Tab key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />
        ))}
      </div>

      {activeTab === 'TEAM'  && <TeamTab />}
      {activeTab === 'STAFF' && <StaffTab />}
      {activeTab === 'ROLES' && <RolesTab />}
      {activeTab === 'SHOP'  && <ShopTab />}
    </div>
  );
};

export default IgnitionAdmin;
