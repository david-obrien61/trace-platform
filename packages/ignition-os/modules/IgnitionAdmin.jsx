/**
 * FILE: modules/IgnitionAdmin.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Full staff management, role editor, and shop settings.
 *          Gated to ADMIN permission. Replaces the React Native placeholder.
 */

import React, { useState, useEffect } from 'react';
import {
  Users, ShieldCheck, Settings, Plus, Trash2, Save, Lock,
  AlertTriangle, CheckCircle, Eye, EyeOff, ChevronDown,
  ChevronUp, UserMinus, UserPlus, Edit3, X, Phone, Send,
  KeyRound, Copy, RefreshCw, QrCode, Smartphone, User, Shield,
  WifiOff, Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabase';
import DataBridge from '../DataBridge';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  { id: 'view_omni',        label: 'View OMNI (Command)',      group: 'Modules' },
  { id: 'view_hub',         label: 'View HUB (Dispatch)',      group: 'Modules' },
  { id: 'view_flux',        label: 'View FLUX (Workflow)',      group: 'Modules' },
  { id: 'view_cipher',      label: 'View CIPHER (DTC)',        group: 'Modules' },
  { id: 'view_stok',        label: 'View STOK (Inventory)',    group: 'Modules' },
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
  ADMIN:      ['view_omni','view_hub','view_flux','view_predictive','view_cipher','view_stok','view_proc','view_prot','view_port','view_crm','view_marketplace','edit_margins','PRICING_AUTHORITY','manage_users','approve_payroll','scan_parts','update_flux'],
  TECH:       ['view_hub','view_flux','view_cipher','view_stok','scan_parts','update_flux'],
  SERVICE:    ['view_port','view_crm','view_cipher','view_stok','sign_estimates'],
  CUSTOMER:   ['view_port','sign_estimates','pay_invoice'],
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const Tab = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
        : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
    }`}
  >
    <Icon size={13} />
    {label}
  </button>
);

const Badge = ({ label, color = 'slate' }) => {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    slate: 'bg-slate-800 text-slate-400 border-slate-700',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${colors[color] || colors.slate}`}>
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
    <div className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4">
      <CheckCircle size={14} className="text-emerald-400" />
      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Changes saved</span>
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Add Staff Member</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-black text-red-400">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Full Name</label>
            <input
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              placeholder="J. SMITH"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Role + PIN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Role</label>
              <select
                value={form.role}
                onChange={e => applyPreset(e.target.value)}
                className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {Object.keys(ROLE_PRESETS).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">4-Digit PIN</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={form.pin}
                  onChange={e => { setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })); setError(''); }}
                  placeholder="----"
                  maxLength={4}
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 pr-10 text-white font-black text-xl tracking-[0.4em] text-center focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Permissions</label>
              <p className="text-[9px] text-slate-600">{form.permissions.length} active</p>
            </div>
            {PERM_GROUPS.map(group => (
              <div key={group} className="mb-3">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                    const on = form.permissions.includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePerm(perm.id)}
                        className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all ${
                          on
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                            : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'
                        }`}
                      >
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
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

    // 1. Create invite token first
    const token = crypto.randomUUID();
    const { data: invite, error: inviteErr } = await supabase
      .from('shop_invites')
      .insert({
        token,
        shop_id: shopId,
        name: form.name.trim().toUpperCase(),
        role: form.role,
        phone: form.phone.trim() || null,
      })
      .select('id')
      .single();

    if (inviteErr) {
      setError('Failed to generate invite. Check connection.');
      setLoading(false);
      return;
    }

    // 2. Create shop_members row (active=false) — owner sets identity before member enrolls
    const { error: memberErr } = await supabase.from('shop_members').insert({
      shop_id: shopId,
      invite_id: invite.id,
      name: form.name.trim().toUpperCase(),
      role: form.role,
      sub_role: form.sub_role || null,
      team_id: form.team_id || null,
      phone: form.phone.trim() || null,
      permissions: form.permissions,
      active: false,
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Invite Staff Member</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-black text-red-400">{error}</p>
            </div>
          )}

          {!inviteLink ? (
            <>
              {/* Name */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Full Name *</label>
                <input
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
                  placeholder="MIKE SMITH"
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Role + Sub Role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Role</label>
                  <select
                    value={form.role}
                    onChange={e => applyRolePreset(e.target.value)}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="TECH">Technician</option>
                    <option value="SERVICE">Front Office</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Tier</label>
                  <select
                    value={form.sub_role}
                    onChange={e => setForm(f => ({ ...f, sub_role: e.target.value }))}
                    disabled={subRoles.length === 0}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40"
                  >
                    <option value="">No tier</option>
                    {subRoles.map(sr => <option key={sr} value={sr}>{sr.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Team + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Team</label>
                  <select
                    value={form.team_id}
                    onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">No team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Phone (SMS)</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="512-555-0100"
                    type="tel"
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Permissions</label>
                  <p className="text-[9px] text-slate-600">{form.permissions.length} active · set before invite is sent</p>
                </div>
                {PERM_GROUPS.map(group => (
                  <div key={group} className="mb-3">
                    <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                        const on = form.permissions.includes(perm.id);
                        return (
                          <button
                            key={perm.id}
                            onClick={() => togglePerm(perm.id)}
                            className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all ${
                              on ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'
                            }`}
                          >
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
            <div className="space-y-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">Invite generated for {form.name}</p>
                <p className="text-[10px] text-slate-400 break-all font-mono leading-relaxed">{inviteLink}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <QRCodeSVG value={inviteLink} size={28} bgColor="#ffffff" fgColor="#000000" level="M" />
                </div>
                <p className="text-[9px] text-slate-500">QR code above or share the link · single-use · {form.name} sets their own PIN</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={copy} className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
                  <Copy size={13} /> {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button onClick={sendSms} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors">
                  <Send size={13} /> Send SMS
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
            {inviteLink ? 'Done' : 'Cancel'}
          </button>
          {!inviteLink && (
            <button
              onClick={generate}
              disabled={loading || !form.name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
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
      shop_id: shopId,
      name: name.trim().toUpperCase(),
      description: description.trim() || null,
    });
    setLoading(false);
    if (err) { setError('Failed to create team. Check connection.'); return; }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Create Team</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-black text-red-400">{error}</p>
            </div>
          )}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Team Name *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value.toUpperCase()); setError(''); }}
              placeholder="TECH TEAM"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={save} disabled={loading || !name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
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
    name:     member.name,
    role:     member.role,
    sub_role: member.sub_role || '',
    phone:    member.phone || '',
    team_id:  member.team_id || '',
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
    setLoading(true);
    setError('');
    const { error: err } = await supabase.from('shop_members').update({
      name:        form.name.trim().toUpperCase(),
      role:        form.role,
      sub_role:    form.sub_role || null,
      phone:       form.phone.trim() || null,
      team_id:     form.team_id || null,
      permissions,
    }).eq('id', member.id);
    setLoading(false);
    if (err) { setError('Failed to save. Check connection.'); return; }
    setSaved(true);
    setTimeout(() => { setSaved(false); onSaved(); }, 1200);
  };

  const disableDevice  = async (id) => {
    await supabase.from('member_devices').update({ is_active: false }).eq('id', id);
    setDevices(d => d.map(dev => dev.id === id ? { ...dev, is_active: false } : dev));
  };
  const enableDevice   = async (id) => {
    await supabase.from('member_devices').update({ is_active: true }).eq('id', id);
    setDevices(d => d.map(dev => dev.id === id ? { ...dev, is_active: true } : dev));
  };
  const deleteDevice   = async (id) => {
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80dvh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{member.name}</h3>
            <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wider">Manage Member</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
          {MANAGE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${
                activeTab === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
              }`}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-black text-red-400">{error}</p>
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle size={13} className="text-emerald-400" />
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Saved</p>
            </div>
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Full Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Role</label>
                  <select
                    value={form.role}
                    onChange={e => applyRolePreset(e.target.value)}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="TECH">Technician</option>
                    <option value="SERVICE">Front Office</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Tier</label>
                  <select
                    value={form.sub_role}
                    onChange={e => setForm(f => ({ ...f, sub_role: e.target.value }))}
                    disabled={subRoles.length === 0}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-40"
                  >
                    <option value="">No tier</option>
                    {subRoles.map(sr => <option key={sr} value={sr}>{sr.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Team</label>
                  <select
                    value={form.team_id}
                    onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">No team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    type="tel"
                    placeholder="512-555-0100"
                    className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── PERMISSIONS TAB ── */}
          {activeTab === 'permissions' && (
            <>
              <div className="flex gap-2 flex-wrap mb-1">
                {Object.keys(ROLE_PRESETS).map(r => (
                  <button key={r} onClick={() => { setForm(f => ({ ...f, role: r })); setPermissions([...ROLE_PRESETS[r]]); }}
                    className={`text-[9px] font-black px-4 py-2 rounded-xl border transition-all uppercase ${form.role === r ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                    {r}
                  </button>
                ))}
              </div>
              {PERM_GROUPS.map(group => (
                <div key={group} className="mb-3">
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                      const on = permissions.includes(perm.id);
                      return (
                        <button key={perm.id} onClick={() => togglePerm(perm.id)}
                          className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all ${on ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'}`}>
                          {perm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── DEVICES TAB ── */}
          {activeTab === 'devices' && (
            <div className="space-y-3">
              {devices.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                  <Smartphone size={28} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">No devices enrolled</p>
                  <p className="text-[9px] text-slate-700 mt-1">Devices appear here after the member logs in</p>
                </div>
              )}
              {devices.map(dev => (
                <div key={dev.id} className={`bg-slate-900 border rounded-2xl px-5 py-4 transition-colors ${dev.is_active ? 'border-slate-800' : 'border-red-500/20 opacity-60'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center flex-shrink-0 ${dev.is_active ? 'bg-slate-800 border-slate-700' : 'bg-red-500/10 border-red-500/20'}`}>
                      {dev.is_active ? <Smartphone size={16} className="text-slate-400" /> : <WifiOff size={16} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-white uppercase">{dev.device_label || 'Unknown Device'}</p>
                        {!dev.is_active && <Badge label="Disabled" color="red" />}
                        {dev.biometric_enrolled && <Badge label="Biometrics" color="emerald" />}
                      </div>
                      <p className="text-[9px] text-slate-600 mt-0.5">Last seen: {formatLastSeen(dev.last_seen)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {dev.is_active ? (
                        <button onClick={() => disableDevice(dev.id)}
                          className="text-[9px] font-black bg-slate-800 hover:bg-orange-600/20 border border-slate-700 hover:border-orange-500/40 text-slate-400 hover:text-orange-400 px-3 py-2 rounded-xl uppercase tracking-wider transition-all"
                          title="Disable this device">
                          Disable
                        </button>
                      ) : (
                        <>
                          <button onClick={() => enableDevice(dev.id)}
                            className="text-[9px] font-black bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 px-3 py-2 rounded-xl uppercase tracking-wider transition-all">
                            Re-enable
                          </button>
                          {confirmDelete === dev.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteDevice(dev.id)}
                                className="text-[9px] font-black bg-red-600/20 border border-red-500/40 text-red-400 px-3 py-2 rounded-xl uppercase tracking-wider hover:bg-red-600/30 transition-all">
                                Confirm Delete
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="text-slate-600 hover:text-white p-1.5"><X size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(dev.id)}
                              className="text-[9px] font-black bg-slate-800 hover:bg-red-600/20 border border-slate-700 hover:border-red-500/40 text-slate-500 hover:text-red-400 px-3 py-2 rounded-xl uppercase tracking-wider transition-all">
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-slate-700 text-center pt-2">Disable = device locked out but recoverable · Delete = permanent</p>
            </div>
          )}
        </div>

        {/* Footer — save only for profile/permissions tabs */}
        {activeTab !== 'devices' && (
          <div className="p-6 border-t border-slate-800 flex gap-3 flex-shrink-0">
            <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button onClick={save} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
              <Save size={13} /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
        {activeTab === 'devices' && (
          <div className="p-6 border-t border-slate-800 flex-shrink-0">
            <button onClick={onClose} className="w-full bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
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

    // Log the revocation
    const log = DataBridge.load('admin_audit_log') || [];
    log.push({ action: 'USER_REVOKED', userId: user.id, userName: user.name, timestamp: Date.now() });
    DataBridge.save('admin_audit_log', log);

    // Force logout if they're the active user
    const current = DataBridge.load('current_user');
    if (current?.id === user.id) DataBridge.save('current_user', null);

    onRevoked(user.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-red-500/30 rounded-[2rem] shadow-2xl w-full max-w-sm">
        <div className="p-6 text-center">
          <UserMinus size={40} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Revoke Access</h3>
          <p className="text-[10px] text-slate-400 mb-6">
            This will permanently remove <span className="text-white font-black">{user.name}</span>'s identity from the system. They will be logged out immediately.
          </p>

          <div className="mb-4">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Type <span className="text-red-400 font-black">REVOKE</span> to confirm</p>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value.toUpperCase())}
              placeholder="REVOKE"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-black text-center focus:outline-none focus:border-red-500 transition-colors tracking-widest uppercase"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={revoke}
              disabled={!ready}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
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
    setPermissions(p =>
      p.includes(permId) ? p.filter(x => x !== permId) : [...p, permId]
    );
  };

  const save = () => {
    const profiles = DataBridge.getProfiles();
    const updated = { ...profiles[user.id], role, permissions, allowed: permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')) };
    DataBridge.save('user_profiles', { ...profiles, [user.id]: updated });
    onSaved(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Edit: {user.name}</h3>
            <p className="text-[9px] text-slate-500 mt-0.5">PIN {user.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Role Template</label>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(ROLE_PRESETS).map(r => (
                <button key={r} onClick={() => applyPreset(r)}
                  className={`text-[9px] font-black px-4 py-2 rounded-xl border transition-all uppercase ${role === r ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">
              Permissions <span className="text-slate-600">({permissions.length} active)</span>
            </label>
            {PERM_GROUPS.map(group => (
              <div key={group} className="mb-3">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                    const on = permissions.includes(perm.id);
                    return (
                      <button key={perm.id} onClick={() => togglePerm(perm.id)}
                        className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all ${on ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'}`}>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-red-500/30 rounded-[2rem] shadow-2xl w-full max-w-sm">
        <div className="p-6 text-center">
          <UserMinus size={40} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Revoke Access</h3>
          <p className="text-[10px] text-slate-400 mb-6">
            This permanently removes <span className="text-white font-black">{member.name}</span> from the shop. All enrolled devices will lose access immediately.
          </p>
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-black text-red-400">{error}</p>
            </div>
          )}
          <div className="mb-5">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Type <span className="text-red-400 font-black">REVOKE</span> to confirm</p>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value.toUpperCase())}
              placeholder="REVOKE"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-black text-center focus:outline-none focus:border-red-500 transition-colors tracking-widest uppercase"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={revoke}
              disabled={!ready || loading}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
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
  const [members, setMembers]           = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showInvite, setShowInvite]     = useState(false);
  const [manageTarget, setManageTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [resetCodeData, setResetCodeData] = useState(null);
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
      reset_code:  code,
      shop_id:     shopId,
      member_id:   member.id,
      member_name: member.name,
      member_role: member.role,
      permissions: member.permissions || [],
      expires_at:  expiresAt,
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
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          {loading ? '...' : `${activeCount} Active · ${pendingCount} Pending`}
        </p>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors" title="Refresh">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest transition-colors"
          >
            <Plus size={12} /> Invite Staff
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-600 text-[10px] uppercase tracking-wider animate-pulse">Loading staff...</div>
      ) : members.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Users size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">No staff members yet</p>
          <p className="text-[9px] text-slate-700 mt-1">Invite a team member to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              onManage={setManageTarget}
              onReset={generateReset}
              onRevoke={setRevokeTarget}
              resetting={generatingReset}
            />
          ))}
        </div>
      )}

      {/* Pending Invites — not yet enrolled */}
      {pendingInvites.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            {pendingInvites.length} Pending Invite{pendingInvites.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="bg-slate-900 border border-slate-800/80 rounded-2xl px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-white uppercase">{invite.name}</p>
                    <Badge label={invite.role} color={roleColor(invite.role)} />
                    <Badge label="Awaiting Enrollment" color="orange" />
                  </div>
                  {invite.phone && <p className="text-[9px] text-slate-600 mt-0.5">{invite.phone}</p>}
                </div>
                <button onClick={() => revokeInvite(invite.id)} className="text-slate-600 hover:text-red-400 transition-colors p-2" title="Cancel invite">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showInvite && <InviteStaffModal onClose={() => { setShowInvite(false); refresh(); }} />}
      {manageTarget && (
        <ManageMemberModal
          member={manageTarget}
          shopId={shopId}
          onClose={() => setManageTarget(null)}
          onSaved={() => { setManageTarget(null); refresh(); }}
        />
      )}
      {revokeTarget && (
        <RevokeMemberModal
          member={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={() => { setRevokeTarget(null); refresh(); }}
        />
      )}

      {/* PIN Reset Code display */}
      {resetCodeData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-950 border border-orange-500/30 rounded-[2rem] shadow-2xl w-full max-w-sm">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <KeyRound size={28} className="text-orange-400" />
              </div>
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">PIN Reset Code</p>
              <p className="text-[9px] text-slate-500 mb-6">
                Read this code aloud to <span className="text-white font-black">{resetCodeData.name}</span>.<br />
                Valid for 15 minutes · Single use.
              </p>
              <div className="bg-black border border-orange-500/20 rounded-2xl py-6 mb-5">
                <p className="text-5xl font-black text-orange-400 tracking-[0.3em]">{resetCodeData.code}</p>
              </div>
              <p className="text-[9px] text-slate-600 mb-6">They'll enter this on the "Forgot PIN" screen to set a new PIN.</p>
              <button onClick={() => setResetCodeData(null)} className="w-full bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TAB: TEAM ────────────────────────────────────────────────────────────────

const MemberCard = ({ member, onManage, onReset, onRevoke, resetting }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-slate-700 transition-colors">
    <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-black text-slate-400 uppercase">
        {member.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-black text-white uppercase">{member.name}</p>
        <Badge label={member.role} color={roleColor(member.role)} />
        {member.sub_role && <Badge label={member.sub_role.replace(/_/g, ' ')} color="slate" />}
        {!member.active && <Badge label="Pending" color="orange" />}
      </div>
      {member.phone && (
        <p className="text-[9px] text-slate-600 mt-0.5 flex items-center gap-1">
          <Phone size={9} /> {member.phone}
        </p>
      )}
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {onManage && (
        <button
          onClick={() => onManage(member)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/40 text-slate-400 hover:text-blue-400 font-black px-3 py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all"
          title="Manage member"
        >
          <Edit3 size={11} /> Manage
        </button>
      )}
      {onReset && member.active && (
        <button
          onClick={() => onReset(member)}
          disabled={resetting === member.id}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-orange-600/20 border border-slate-700 hover:border-orange-500/40 text-slate-400 hover:text-orange-400 font-black px-3 py-2 rounded-xl text-[9px] uppercase tracking-wider transition-all disabled:opacity-50"
          title="Generate PIN reset code"
        >
          <KeyRound size={11} />
          {resetting === member.id ? '...' : 'Reset PIN'}
        </button>
      )}
      {onRevoke && (
        <button
          onClick={() => onRevoke(member)}
          className="p-2 bg-slate-800 hover:bg-red-600/20 border border-slate-700 hover:border-red-500/40 text-slate-500 hover:text-red-400 rounded-xl transition-all"
          title="Revoke access"
        >
          <UserMinus size={13} />
        </button>
      )}
    </div>
  </div>
);

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
    <div className="space-y-6">
      {/* Shop QR Code */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Shop Join Code</p>
            <p className="text-[9px] text-slate-600">Team members scan to join this shop</p>
          </div>
          <button onClick={copyLink} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black px-3 py-2 rounded-xl text-[9px] uppercase tracking-wider transition-colors">
            <Copy size={11} /> {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div className="flex justify-center">
          {shopId ? (
            <div className="bg-white p-4 rounded-2xl shadow-lg">
              <QRCodeSVG value={joinUrl} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
            </div>
          ) : (
            <div className="w-40 h-40 bg-slate-800 rounded-2xl flex items-center justify-center">
              <p className="text-[9px] text-slate-600 uppercase text-center px-4">Complete onboarding to get QR</p>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          {loading ? '...' : `${members.length} Member${members.length !== 1 ? 's' : ''} · ${teams.length} Team${teams.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors" title="Refresh">
            <RefreshCw size={12} />
          </button>
          <button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest transition-colors">
            <Layers size={12} /> New Team
          </button>
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest transition-colors">
            <Plus size={12} /> Invite
          </button>
        </div>
      </div>

      {/* Helper hint */}
      <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/60 rounded-xl px-4 py-2.5">
        <p className="text-[9px] text-slate-600">Team view shows grouping only. Go to <span className="text-slate-400 font-black">Staff</span> tab to manage members, change permissions, or reset PINs.</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-600 text-[10px] uppercase tracking-wider animate-pulse">Loading teams...</div>
      ) : members.length === 0 && teams.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <Users size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">No teams yet</p>
          <p className="text-[9px] text-slate-700 mt-1">Create a team then invite members, or invite directly</p>
        </div>
      ) : (
        <div className="space-y-6">
          {membersByTeam.map(({ team, members: teamMembers }) => (
            <div key={team.id}>
              <div className="flex items-center gap-3 mb-3">
                <Layers size={12} className="text-slate-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{team.name}</p>
                <span className="text-[9px] text-slate-700">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
              </div>
              {teamMembers.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-5 py-4 text-[9px] text-slate-700 italic">No members in this team yet</div>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map(m => (
                    <MemberCard key={m.id} member={m} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {unassigned.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Users size={12} className="text-slate-600" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unassigned</p>
                <span className="text-[9px] text-slate-700">{unassigned.length} member{unassigned.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {unassigned.map(m => (
                  <MemberCard key={m.id} member={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
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
      return {
        ...r,
        [roleName]: perms.includes(permId) ? perms.filter(p => p !== permId) : [...perms, permId]
      };
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
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Add Custom Role</p>
        <div className="flex gap-3">
          <input
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value.toUpperCase().replace(/\s/g, '_'))}
            placeholder="ROLE_NAME"
            className="flex-1 bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-black font-mono uppercase text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button onClick={addRole} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(roles).map(([roleName, perms]) => {
          const isCore = ['ADMIN', 'TECH', 'CUSTOMER'].includes(roleName);
          return (
            <div key={roleName} className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <Badge label={roleName} color={roleColor(roleName)} />
                  <span className="text-[9px] text-slate-600">{perms.length} permissions</span>
                  {isCore && <span className="text-[8px] text-slate-700 uppercase">system role</span>}
                </div>
                {!isCore && (
                  <button onClick={() => removeRole(roleName)} className="text-slate-700 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {PERM_GROUPS.map(group => (
                <div key={group} className="mb-3">
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                      const on = perms.includes(perm.id);
                      return (
                        <button
                          key={perm.id}
                          onClick={() => togglePerm(roleName, perm.id)}
                          className={`text-[8px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                            on
                              ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                              : 'bg-slate-950 border-slate-800 text-slate-700 hover:border-slate-600 hover:text-slate-500'
                          }`}
                        >
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
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2"
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
        name:    info.name    || null,
        phone:   c.phone     || null,
        email:   c.email     || null,
        address: c.address   || null,
        usdot:   c.usdot     || null,
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
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      {/* Shop Identity */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-widest">Shop Identity</h3>

        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Shop Name</label>
          <input
            value={info.name || ''}
            onChange={e => setInfo(i => ({ ...i, name: e.target.value }))}
            placeholder="Leander Diesel & Truck"
            className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {[
          { key: 'phone', label: 'Phone', placeholder: '512-555-0100' },
          { key: 'email', label: 'Email', placeholder: 'service@yourshop.com' },
          { key: 'address', label: 'Address', placeholder: '123 Main St, Leander, TX 78641' },
          { key: 'usdot', label: 'USDOT #', placeholder: 'Optional' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{label}</label>
            <input
              value={info.global_contact?.[key] || ''}
              onChange={e => setContact(key, e.target.value)}
              placeholder={placeholder}
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        ))}
      </div>

      {/* Policy Toggles */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-widest">System Policy</h3>

        {[
          { key: 'enable_price_audit', label: 'Price Audit Mode', desc: 'Flag jobs where actual price is below engine suggestion' },
          { key: 'enable_bay_custody', label: 'Bay Custody Tracking', desc: 'Require tech check-in/out for each bay' },
          { key: 'autoLockEnabled', label: 'Auto-Lock Screen', desc: 'Lock the system after 10 minutes of inactivity' },
          { key: 'is_dot_mandated', label: 'DOT Mandated Shop', desc: 'Enforce DOT compliance gates before job completion' },
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
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">{label}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={toggle}
                className={`relative w-12 h-6 rounded-full border transition-colors flex-shrink-0 ${
                  val ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${val ? 'left-6 bg-white' : 'left-0.5 bg-slate-600'}`} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Danger Zone */}
      <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xs font-black text-red-400 uppercase tracking-widest">Danger Zone</h3>

        {/* Restart Onboarding */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-white uppercase">Restart Onboarding</p>
            <p className="text-[9px] text-slate-500">Resets shop setup and PIN. Job data is kept.</p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Restart onboarding? Your jobs and settings are preserved — only shop registration and login will reset.')) {
                DataBridge.resetOnboarding();
              }
            }}
            className="flex items-center gap-2 bg-orange-600/10 border border-orange-500/20 text-orange-400 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest hover:bg-orange-600/20 transition-colors"
          >
            <AlertTriangle size={12} /> Restart
          </button>
        </div>

        {/* Simulate Trial Day */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-white uppercase">Simulate Trial Day</p>
            <p className="text-[9px] text-slate-500">Jump to any day to preview trial banners &amp; gates.</p>
          </div>
          <div className="flex items-center gap-2">
            {[0, 7, 12, 15, 30].map(day => (
              <button
                key={day}
                onClick={() => DataBridge.simulateTrialDay(day)}
                className="bg-slate-800 border border-slate-700 text-slate-300 font-black px-3 py-1.5 rounded-lg text-[9px] uppercase hover:bg-slate-700 transition-colors"
              >
                D{day}
              </button>
            ))}
          </div>
        </div>

        {/* Factory Reset */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <div>
            <p className="text-[10px] font-black text-white uppercase">Factory Reset</p>
            <p className="text-[9px] text-slate-600">Wipes all local data. Cannot be undone.</p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('FACTORY RESET: This permanently deletes all data. Are you absolutely sure?')) {
                DataBridge.factoryReset();
              }
            }}
            className="flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-400 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest hover:bg-red-600/20 transition-colors"
          >
            <AlertTriangle size={12} /> Reset
          </button>
        </div>
      </div>

      <button
        onClick={saveAll}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2"
      >
        <Save size={14} /> Save Settings
      </button>
    </div>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'TEAM',  label: 'Team',         icon: QrCode     },
  { id: 'STAFF', label: 'Staff',        icon: Users      },
  { id: 'ROLES', label: 'Roles',        icon: ShieldCheck },
  { id: 'SHOP',  label: 'Shop Settings', icon: Settings   },
];

const IgnitionAdmin = () => {
  const currentUser = DataBridge.load('current_user');
  const [activeTab, setActiveTab] = useState('TEAM');

  const isAdmin = currentUser?.permissions?.includes('ADMIN') || currentUser?.permissions?.includes('manage_users');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Lock size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Admin Access Required</h2>
        <p className="text-slate-500 text-xs max-w-xs">Your identity matrix does not have the manage_users permission.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-black min-h-full text-slate-200">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter mb-1">
          Admin <span className="text-blue-500 border-l-4 border-blue-500 pl-4 ml-4">Command Center</span>
        </h1>
        <p className="text-[10px] sm:text-xs font-mono text-slate-500 uppercase tracking-[0.3em]">
          Staff Management · Role Configuration · Shop Policy
        </p>
      </header>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
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
