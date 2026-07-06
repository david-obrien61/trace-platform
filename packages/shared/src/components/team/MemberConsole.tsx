// PURPOSE:      The AGNOSTIC member/device management console (D-31 spine surface). ONE shared,
//               vertical-neutral, tabbed surface both verticals mount: USERS (invite + list +
//               per-member role, PRESELECTED) · ROLES (visibility-axis permission editor) ·
//               DEVICES (member_devices: lockout/delete). Fixes the role-source split — the
//               member-role dropdown reads business_members.role (the ONE source) and preselects
//               it against the seeded role_definitions catalog, resilient to a role missing from
//               the catalog (never silently drops a real role — Surface Honesty).
// DEPENDENCIES: shared auth backend (reused verbatim, NOT rewritten): createInvitation /
//               getPendingInvitations / revokeInvitation / getMembersByBusiness / updateMemberRole
//               / removeMember / getRoleDefinitions / resolveRoles / upsertTenantRole /
//               deleteTenantRole · device spine (listDevicesByBusiness / setDeviceActive /
//               deleteDevice). ALL vertical-specific inputs arrive as PROPS (theme, permission
//               catalog, invite roles, supabase, businessId/isOwner) — NO Cultivar/Ignition imports.
// OUTPUTS:      <MemberConsole/> — Cultivar mounts it at /team; Ignition can mount the same
//               component with its own theme + permission catalog + supabase client.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getMembersByBusiness, updateMemberRole, removeMember,
  createInvitation, getPendingInvitations, revokeInvitation,
  getRoleDefinitions, resolveRoles, upsertTenantRole, deleteTenantRole,
  listDevicesByBusiness, setDeviceActive, deleteDevice,
} from '../../auth';
import type { Member, Invitation, Device, ResolvedRole, RoleDefinitionRow } from '../../auth';

// ── theming (vertical passes its own tokens — AC-4: only color/vocabulary vary) ────────
export interface MemberConsoleTheme {
  primary: string; bg: string; card: string; border: string;
  ink: string; sub: string; danger: string;
  chipOnBg: string; chipOnBorder: string; chipOffBg: string; chipOffBorder: string;
}

/** A permission the vertical exposes for role editing (built from the vertical's tile registry). */
export interface PermChip { id: string; label: string; group: string; tiles: string[]; }
/** Group ordering + labels for the Roles tab (vertical-supplied). */
export interface PermGroup { key: string; label: string; chips: PermChip[]; }
/** A role offerable at invite time. */
export interface InviteRoleOption { role_key: string; label: string; description: string; }

export interface MemberConsoleProps {
  supabase: SupabaseClient;
  businessId: string;
  isOwner: boolean;
  can: (perm: string) => boolean;
  theme: MemberConsoleTheme;
  /** Permission chips (grouped) for the Roles tab — the vertical's registry, injected. */
  permissionGroups: PermGroup[];
  /** Roles offerable at invite (OWNER excluded by the caller). */
  inviteRoleOptions: InviteRoleOption[];
  /** Role → default permission set, used when creating an invite. */
  defaultPermissionsFor: (roleKey: string) => string[];
  inviteBaseUrl: string;
  invitePath?: string;
  showDevices?: boolean;
  /** Permission that gates the console (for the access guard message). Default 'manage_settings'. */
  managePermission?: string;
}

type Tab = 'users' | 'roles' | 'devices';
const badge = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
  background: bg, color: fg, textTransform: 'uppercase', letterSpacing: '0.04em',
});

export function MemberConsole(props: MemberConsoleProps) {
  const {
    supabase, businessId, isOwner, can, theme: T,
    permissionGroups, inviteRoleOptions, defaultPermissionsFor,
    inviteBaseUrl, invitePath = '/join', showDevices = true,
    managePermission = 'manage_settings',
  } = props;

  const [tab, setTab] = useState<Tab>('users');
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Invitation[]>([]);
  const [resolved, setResolved] = useState<ResolvedRole[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!businessId) return;
    try {
      const [m, p, defs] = await Promise.all([
        getMembersByBusiness(supabase, businessId),
        getPendingInvitations(supabase, businessId),
        getRoleDefinitions(supabase, businessId),
      ]);
      setMembers(m);
      setPending(p);
      const roles = resolveRoles(defs.floor as RoleDefinitionRow[], defs.tenant as RoleDefinitionRow[]);
      setResolved(roles);
      if (showDevices) {
        try { setDevices(await listDevicesByBusiness(supabase, businessId)); }
        catch { setDevices([]); /* device spine optional — never blocks the console */ }
      }
      setLoadError('');
      console.log('[TRACE:MEMBERCONSOLE] loaded', {
        businessId, members: m.length, pending: p.length, roles: roles.map((r) => r.role_key),
        catalogEmpty: roles.length === 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      if (/(schema cache|does not exist|42P01)/.test(msg)) {
        setLoadError('Team management becomes available once the member/role migrations are applied.');
      } else { setLoadError(msg); }
    }
  }, [supabase, businessId, showDevices]);

  useEffect(() => { void reload(); }, [reload]);

  if (!isOwner && !can(managePermission)) {
    return <div style={{ padding: 24, color: T.sub }}>Team management is available to the business owner.</div>;
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'roles', label: 'Roles' },
    ...(showDevices ? [{ id: 'devices' as Tab, label: 'Devices' }] : []),
  ];

  return (
    <div style={{ backgroundColor: T.bg, minHeight: '100%', padding: 20 }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ color: T.primary, fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>Team &amp; roles</h1>
        <p style={{ color: T.sub, fontSize: 13, marginBottom: 16 }}>
          Invite people, set who can do what, and manage the devices they sign in on — one place.
        </p>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                fontSize: 13, fontWeight: 800, padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${tab === t.id ? T.primary : T.border}`,
                background: tab === t.id ? T.primary : T.card,
                color: tab === t.id ? '#fff' : T.sub,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div style={{ background: '#FFF4F4', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {tab === 'users' && (
          <UsersTab
            T={T} supabase={supabase} businessId={businessId}
            members={members} pending={pending} resolved={resolved}
            inviteRoleOptions={inviteRoleOptions} defaultPermissionsFor={defaultPermissionsFor}
            inviteBaseUrl={inviteBaseUrl} invitePath={invitePath}
            busy={busy} setBusy={setBusy} reload={reload} setLoadError={setLoadError}
          />
        )}
        {tab === 'roles' && (
          <RolesTab
            T={T} supabase={supabase} businessId={businessId} isOwner={isOwner}
            resolved={resolved} permissionGroups={permissionGroups}
            busy={busy} setBusy={setBusy} reload={reload} setLoadError={setLoadError}
          />
        )}
        {tab === 'devices' && showDevices && (
          <DevicesTab
            T={T} supabase={supabase} devices={devices} members={members}
            busy={busy} setBusy={setBusy} reload={reload} setLoadError={setLoadError}
          />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// USERS — invite (reuses the proven backend) + member list with PRESELECTED per-member role
// ══════════════════════════════════════════════════════════════════════════════════════
type InvitePhase = 'list' | 'form' | 'link';

function UsersTab(p: {
  T: MemberConsoleTheme; supabase: SupabaseClient; businessId: string;
  members: Member[]; pending: Invitation[]; resolved: ResolvedRole[];
  inviteRoleOptions: InviteRoleOption[]; defaultPermissionsFor: (r: string) => string[];
  inviteBaseUrl: string; invitePath: string;
  busy: boolean; setBusy: (b: boolean) => void; reload: () => Promise<void>; setLoadError: (s: string) => void;
}) {
  const { T, supabase, businessId, members, pending, resolved, inviteRoleOptions, defaultPermissionsFor, inviteBaseUrl, invitePath, busy, setBusy, reload, setLoadError } = p;
  const [phase, setPhase] = useState<InvitePhase>('list');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(inviteRoleOptions[0]?.role_key ?? 'STAFF');
  const [inviteError, setInviteError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
    border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 15, outline: 'none', color: T.ink, background: '#fff',
  };

  // The dropdown options = the seeded role catalog. If a member holds a role NOT in the catalog
  // (orphaned/legacy), we STILL surface it (never silently drop a real role — Surface Honesty).
  function roleOptions(memberRole: string | null): string[] {
    const keys = resolved.map((r) => r.role_key);
    const cur = (memberRole ?? '').toUpperCase();
    return cur && !keys.includes(cur) ? [cur, ...keys] : keys;
  }

  async function assignRole(m: Member, roleKey: string) {
    const target = resolved.find((r) => r.role_key === roleKey);
    setBusy(true);
    try {
      // Applies that role's current permission set to the member's own row. business_members.role
      // is the ONE source; updateMemberRole writes role AND permissions. Owner-only by RLS.
      await updateMemberRole(supabase, m.id, roleKey, target?.permissions ?? defaultPermissionsFor(roleKey));
      console.log('[TRACE:MEMBERCONSOLE] assignRole', { memberId: m.id, roleKey, fromCatalog: !!target });
      await reload();
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Assignment failed'); }
    finally { setBusy(false); }
  }

  async function handleRemove(id: string) {
    setWorking(id);
    try { await removeMember(supabase, id); await reload(); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Remove failed'); }
    finally { setWorking(null); }
  }

  async function handleRevoke(id: string) {
    setWorking(id);
    try { await revokeInvitation(supabase, id); await reload(); }
    catch { /* list refreshes on reload */ }
    finally { setWorking(null); }
  }

  async function sendInvite() {
    if (!name.trim()) { setInviteError('Name is required.'); return; }
    setBusy(true); setInviteError('');
    try {
      const { inviteLink } = await createInvitation(
        supabase,
        { businessId, name: name.trim(), email: email.trim() || undefined, role, permissions: defaultPermissionsFor(role) },
        inviteBaseUrl, invitePath,
      );
      console.log('[TRACE:MEMBERCONSOLE] invite created', { role });
      setLink(inviteLink); setPhase('link'); await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create invite';
      setInviteError(/(schema cache|does not exist|42P01)/.test(msg) ? 'Migrations not yet applied.' : msg);
    } finally { setBusy(false); }
  }

  function resetForm() { setPhase('list'); setName(''); setEmail(''); setRole(inviteRoleOptions[0]?.role_key ?? 'STAFF'); setInviteError(''); setLink(''); setCopied(false); }

  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18 };

  if (phase === 'form' || phase === 'link') {
    return (
      <div style={card}>
        {phase === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: T.ink }}>Invite a team member</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lauren Bishop" style={input} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>Email (optional — pre-fills the join page)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="lauren@example.com" style={input} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>Role</label>
              {inviteRoleOptions.map((r) => (
                <label key={r.role_key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 9,
                  border: `1.5px solid ${role === r.role_key ? T.primary : T.border}`, background: role === r.role_key ? T.chipOnBg : '#fff',
                }}>
                  <input type="radio" name="invite-role" checked={role === r.role_key} onChange={() => setRole(r.role_key)} style={{ marginTop: 2, accentColor: T.primary }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.ink }}>{r.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: T.sub }}>{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {inviteError && <p style={{ color: T.danger, fontSize: 13 }}>{inviteError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { void sendInvite(); }} disabled={busy} style={{ background: T.primary, color: '#fff', fontWeight: 800, padding: '11px 18px', borderRadius: 10, border: 'none', fontSize: 13, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                {busy ? 'Generating…' : 'Generate invite link'}
              </button>
              <button onClick={resetForm} disabled={busy} style={{ background: 'none', color: T.sub, fontWeight: 700, padding: '11px 18px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: T.ink }}>Invite link ready</p>
            <p style={{ margin: 0, fontSize: 13, color: T.sub }}>Send this to your team member. They pick a password and join. Expires in 7 days.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input readOnly value={link} style={{ ...input, fontFamily: 'monospace', fontSize: 12 }} onFocus={(e) => e.currentTarget.select()} />
              <button onClick={() => { navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ background: T.primary, color: '#fff', fontWeight: 800, padding: '0 16px', borderRadius: 9, border: 'none', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button onClick={resetForm} style={{ alignSelf: 'flex-start', background: 'none', color: T.primary, fontWeight: 700, padding: '8px 0', border: 'none', fontSize: 13, cursor: 'pointer' }}>← Back to team</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Team members ({members.length})</p>
          <button onClick={() => setPhase('form')} style={{ background: T.primary, color: '#fff', fontWeight: 800, padding: '8px 16px', borderRadius: 9, border: 'none', fontSize: 13, cursor: 'pointer' }}>+ Invite</button>
        </div>

        {members.length === 0 && <p style={{ fontSize: 14, color: T.sub, textAlign: 'center', padding: '12px 0' }}>No team members yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: T.chipOffBg, borderRadius: 10, border: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.ink }}>{m.name}</p>
                {m.email && <p style={{ margin: '2px 0 0', fontSize: 12, color: T.sub, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={badge(m.active ? '#dcfce7' : '#f3f4f6', m.active ? '#166534' : T.sub)}>{m.active ? 'Active' : 'Invited'}</span>
                {/* PRESELECTED from business_members.role (the ONE source); catalog-backed + resilient. */}
                <select value={(m.role ?? '').toUpperCase()} disabled={busy}
                  onChange={(e) => { void assignRole(m, e.target.value); }}
                  style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, background: '#fff', color: T.ink }}>
                  {resolved.length === 0 && <option value={(m.role ?? '').toUpperCase()}>{(m.role ?? '—').toUpperCase()}</option>}
                  {roleOptions(m.role).map((rk) => <option key={rk} value={rk}>{rk}</option>)}
                </select>
                {m.role !== 'OWNER' && (
                  <button onClick={() => { void handleRemove(m.id); }} disabled={working === m.id} title="Remove member"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.sub, fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>
                    {working === m.id ? '…' : '×'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pending.length > 0 && (
        <div style={card}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pending invites</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fcd34d' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.ink }}>{inv.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => { void handleRevoke(inv.id); }} disabled={working === inv.id}
                  style={{ background: '#fef2f2', border: 'none', borderRadius: 7, padding: '6px 12px', color: T.danger, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {working === inv.id ? '…' : 'Revoke'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ROLES — visibility-axis permission editor (clone-not-mutate; floor never mutated)
// ══════════════════════════════════════════════════════════════════════════════════════
function RolesTab(p: {
  T: MemberConsoleTheme; supabase: SupabaseClient; businessId: string; isOwner: boolean;
  resolved: ResolvedRole[]; permissionGroups: PermGroup[];
  busy: boolean; setBusy: (b: boolean) => void; reload: () => Promise<void>; setLoadError: (s: string) => void;
}) {
  const { T, supabase, businessId, resolved, permissionGroups, busy, setBusy, reload, setLoadError } = p;
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [savedKey, setSavedKey] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  useEffect(() => {
    setDraft(Object.fromEntries(resolved.map((r) => [r.role_key, [...r.permissions]])));
    setDirty(new Set());
  }, [resolved]);

  const roleBadge = (key: string): string =>
    ({ OWNER: T.primary, MANAGER: '#2563EB', STAFF: '#64748B' } as Record<string, string>)[key] ?? '#7C3AED';

  function toggle(roleKey: string, permId: string) {
    setDraft((d) => {
      const cur = d[roleKey] ?? [];
      return { ...d, [roleKey]: cur.includes(permId) ? cur.filter((x) => x !== permId) : [...cur, permId] };
    });
    setDirty((s) => new Set(s).add(roleKey));
  }

  async function save(role: ResolvedRole) {
    setBusy(true);
    try {
      await upsertTenantRole(supabase, businessId, role.role_key, {
        is_system: false, label: role.label, description: role.description, permissions: draft[role.role_key] ?? [],
      });
      console.log('[TRACE:MEMBERCONSOLE] saveRole', { roleKey: role.role_key, source: role.source });
      setSavedKey(role.role_key); setTimeout(() => setSavedKey(''), 2500);
      await reload();
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setBusy(false); }
  }

  async function clone(role: ResolvedRole) {
    let key = `${role.role_key}_COPY`; let n = 2;
    while (resolved.some((r) => r.role_key === key)) key = `${role.role_key}_COPY_${n++}`;
    setBusy(true);
    try {
      await upsertTenantRole(supabase, businessId, key, { is_system: false, label: key, description: `Cloned from ${role.role_key}`, permissions: [...(draft[role.role_key] ?? role.permissions)] });
      console.log('[TRACE:MEMBERCONSOLE] cloneRole', { from: role.role_key, to: key });
      await reload();
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Clone failed'); }
    finally { setBusy(false); }
  }

  async function factoryReset(role: ResolvedRole) {
    if (!window.confirm(`Reset ${role.role_key} to the standard definition?`)) return;
    setBusy(true);
    try { await deleteTenantRole(supabase, businessId, role.role_key); await reload(); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Reset failed'); }
    finally { setBusy(false); }
  }

  async function del(role: ResolvedRole) {
    if (!window.confirm(`Delete custom role ${role.role_key}?`)) return;
    setBusy(true);
    try { await deleteTenantRole(supabase, businessId, role.role_key); await reload(); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Delete failed'); }
    finally { setBusy(false); }
  }

  async function addCustom() {
    const key = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!key || resolved.some((r) => r.role_key === key)) return;
    setBusy(true);
    try { await upsertTenantRole(supabase, businessId, key, { is_system: false, label: key, permissions: [] }); setNewRoleName(''); await reload(); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Create failed'); }
    finally { setBusy(false); }
  }

  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {resolved.length === 0 && (
        <div style={{ ...card, color: T.sub, fontSize: 13 }}>No roles defined yet.</div>
      )}

      <div style={{ ...card, padding: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Add custom role</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value.toUpperCase().replace(/\s+/g, '_'))} placeholder="ROLE_NAME"
            style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700, padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 14 }} />
          <button onClick={() => { void addCustom(); }} disabled={busy || !newRoleName.trim()} style={{ background: T.primary, color: '#fff', fontWeight: 800, padding: '10px 18px', borderRadius: 10, border: 'none', fontSize: 12, cursor: 'pointer', opacity: busy || !newRoleName.trim() ? 0.5 : 1 }}>+ Add</button>
        </div>
      </div>

      {resolved.map((role) => {
        const perms = draft[role.role_key] ?? [];
        const isDirty = dirty.has(role.role_key);
        return (
          <div key={role.role_key} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: roleBadge(role.role_key), color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8 }}>{role.role_key}</span>
                <span style={{ fontSize: 11, color: T.sub }}>{perms.length} permissions</span>
                {role.locked && <span style={{ fontSize: 10, color: T.sub, textTransform: 'uppercase', border: `1px solid ${T.border}`, borderRadius: 6, padding: '1px 6px' }}>system role</span>}
                {role.isOverridden && <span style={{ fontSize: 10, color: T.primary, textTransform: 'uppercase' }}>tuned</span>}
                {role.source === 'custom' && <span style={{ fontSize: 10, color: '#7C3AED', textTransform: 'uppercase' }}>custom</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {role.locked && <button onClick={() => { void clone(role); }} disabled={busy} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.primary, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>Clone to custom</button>}
                {role.isOverridden && <button onClick={() => { void factoryReset(role); }} disabled={busy} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.sub, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>Reset to standard</button>}
                {!role.locked && <button onClick={() => { void del(role); }} disabled={busy} style={{ background: 'none', border: `1px solid ${T.border}`, color: T.danger, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>Delete</button>}
              </div>
            </div>
            {permissionGroups.map((grp) => (
              <div key={grp.key} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{grp.label}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {grp.chips.map((chip) => {
                    const on = perms.includes(chip.id);
                    return (
                      <button key={chip.id} onClick={() => toggle(role.role_key, chip.id)} disabled={busy}
                        title={chip.tiles.length ? `Unlocks: ${chip.tiles.join(', ')}` : 'Data-layer permission'}
                        style={{ fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', background: on ? T.chipOnBg : T.chipOffBg, border: `1px solid ${on ? T.chipOnBorder : T.chipOffBorder}`, color: on ? T.primary : T.sub }}>
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => { void save(role); }} disabled={busy || !isDirty} style={{ background: isDirty ? T.primary : '#C7D3B5', color: '#fff', fontWeight: 800, padding: '9px 18px', borderRadius: 10, border: 'none', fontSize: 12, cursor: isDirty ? 'pointer' : 'default' }}>Save {role.role_key}</button>
              {savedKey === role.role_key && <span style={{ color: T.primary, fontSize: 12, fontWeight: 700 }}>Saved ✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// DEVICES — member_devices spine (lockout / delete). Owner-scoped by RLS md_owner_all.
// ══════════════════════════════════════════════════════════════════════════════════════
function DevicesTab(p: {
  T: MemberConsoleTheme; supabase: SupabaseClient; devices: Device[]; members: Member[];
  busy: boolean; setBusy: (b: boolean) => void; reload: () => Promise<void>; setLoadError: (s: string) => void;
}) {
  const { T, supabase, devices, members, setBusy, reload, setLoadError } = p;
  const [working, setWorking] = useState<string | null>(null);
  const memberName = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);

  async function toggle(d: Device) {
    setWorking(d.id); setBusy(true);
    try { await setDeviceActive(supabase, d.id, !d.is_active); console.log('[TRACE:MEMBERCONSOLE] deviceToggle', { deviceId: d.id, to: !d.is_active }); await reload(); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Device update failed'); }
    finally { setWorking(null); setBusy(false); }
  }
  async function remove(d: Device) {
    if (!window.confirm(`Remove ${d.device_label ?? 'this device'}? A fresh sign-in re-enrolls it.`)) return;
    setWorking(d.id); setBusy(true);
    try { await deleteDevice(supabase, d.id); await reload(); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Device delete failed'); }
    finally { setWorking(null); setBusy(false); }
  }

  const card: React.CSSProperties = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18 };
  const rel = (ts: string | null) => ts ? new Date(ts).toLocaleString() : 'never';

  return (
    <div style={card}>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Enrolled devices ({devices.length})</p>
      {devices.length === 0 && <p style={{ fontSize: 14, color: T.sub, textAlign: 'center', padding: '12px 0' }}>No devices enrolled yet. Devices appear here after a team member signs in.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {devices.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', background: T.chipOffBg, borderRadius: 10, border: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.ink }}>{d.device_label ?? 'Unknown device'}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: T.sub }}>{memberName[d.member_id] ?? 'Unknown member'} · last seen {rel(d.last_seen)}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={badge(d.is_active ? '#dcfce7' : '#fee2e2', d.is_active ? '#166534' : T.danger)}>{d.is_active ? 'Active' : 'Locked'}</span>
              {d.biometric_enrolled && <span style={badge('#dbeafe', '#1e40af')}>Biometric</span>}
              <button onClick={() => { void toggle(d); }} disabled={working === d.id} style={{ background: 'none', border: `1px solid ${T.border}`, color: d.is_active ? T.danger : T.primary, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                {working === d.id ? '…' : d.is_active ? 'Lock out' : 'Re-enable'}
              </button>
              <button onClick={() => { void remove(d); }} disabled={working === d.id} title="Remove device" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.sub, fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
