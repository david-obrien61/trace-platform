// PURPOSE:      Role-config console (VISIBILITY AXIS only) — the owner defines which tiles each
//               role may SEE/use. Cultivar-native rebuild of Ignition's RolesTab visual.
//               NOT activation authority (who may spend), NOT the marketplace, NOT trial/Stripe.
// DEPENDENCIES: tileRegistry (registryPermissions/allTiles → chip catalog, ONE source, no hardcoded
//               permission list) · shared roleDefinitions store (three-tier: floor/override/custom)
//               · useBusinessContext.can()/isOwner (the single permission chokepoint) ·
//               shared updateMemberRole()/getMembersByBusiness() (member→role assignment, reused).
// OUTPUTS:      Owner-only console at /roles. Writes per-tenant role_definitions rows (RLS owner-only),
//               assigns members to roles via business_members. The shared floor is never mutated
//               (clone-not-mutate); factory-reset deletes the tenant override.

import { useEffect, useMemo, useState } from 'react';
import { useBusinessContext } from '@trace/shared/context';
import {
  getRoleDefinitions,
  resolveRoles,
  upsertTenantRole,
  deleteTenantRole,
  getMembersByBusiness,
  updateMemberRole,
  ALL_FINANCIAL_PERMISSIONS,
} from '@trace/shared/auth';
import type { ResolvedRole, RoleDefinitionRow, Member } from '@trace/shared/auth';
import { allTiles, registryPermissions } from '../registry/tileRegistry';
import { supabase } from '../lib/supabase';

// ── forest-green tokens (CLAUDE.md §6 — no hardcoded brand literals scattered) ──────
const T = {
  primary: '#27500A',
  bg: '#EAF3DE',
  card: '#FFFFFF',
  border: '#D8E2C8',
  ink: '#1C2A12',
  sub: '#5B6B47',
  chipOnBg: 'rgba(39,80,10,0.12)',
  chipOnBorder: '#27500A',
  chipOffBg: '#F4F6EE',
  chipOffBorder: '#D8E2C8',
  danger: '#A32D2D',
};

const roleBadgeColor = (key: string): string =>
  ({ OWNER: '#27500A', MANAGER: '#2563EB', STAFF: '#64748B' } as Record<string, string>)[key] ?? '#7C3AED';

const humanize = (p: string): string => p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// chip grouping by the tile's registry `group`; financial-wall perms (no tile) → 'financial'
const GROUP_ORDER = ['checkout', 'fulfilment', 'financial', 'growth', 'readout', 'settings', 'admin', 'planned', 'other'];
const GROUP_LABELS: Record<string, string> = {
  checkout: 'Checkout', fulfilment: 'Fulfilment', financial: 'Financial', growth: 'Growth',
  readout: 'Readouts', settings: 'Settings', admin: 'Admin', planned: 'Planned', other: 'Other',
};

interface PermChip { id: string; label: string; group: string; tiles: string[]; }

export function RoleConfig() {
  const { businessId, isOwner, can } = useBusinessContext();

  const [resolved, setResolved] = useState<ResolvedRole[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<Member[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedKey, setSavedKey] = useState('');

  // ── REGISTRY-FED chip catalog (B2): the ONE source. registryPermissions() = the tile-gating
  // permissions; ALL_FINANCIAL_PERMISSIONS = the canonical financial-wall perms (defined ONCE in
  // the shared module, they gate DATA at the RLS layer rather than a tile). NO hardcoded list here
  // — both sources are canonical exports, so registering a new tile surfaces its permission as a
  // chip with no edit to this file (verify-universals cap #e). 'owner-only' is a structural owner
  // gate, not a grantable permission → excluded.
  const catalog = useMemo<PermChip[]>(() => {
    const tilesByPerm: Record<string, string[]> = {};
    for (const t of allTiles()) (tilesByPerm[t.required_permission] ||= []).push(t.label);
    const ids = [...new Set([...registryPermissions(), ...ALL_FINANCIAL_PERMISSIONS])].filter((p) => p !== 'owner-only');
    return ids.map((id) => {
      const tiles = tilesByPerm[id] ?? [];
      const fromTile = allTiles().find((t) => t.required_permission === id)?.group;
      const group = fromTile ?? (ALL_FINANCIAL_PERMISSIONS.includes(id) ? 'financial' : 'other');
      return { id, label: humanize(id), group: GROUP_ORDER.includes(group) ? group : 'other', tiles };
    });
  }, []);

  const catalogByGroup = useMemo(() => {
    const g: Record<string, PermChip[]> = {};
    for (const c of catalog) (g[c.group] ||= []).push(c);
    return GROUP_ORDER.filter((k) => g[k]?.length).map((k) => ({ key: k, label: GROUP_LABELS[k], chips: g[k] }));
  }, [catalog]);

  async function reload() {
    if (!businessId) return;
    try {
      const { floor, tenant } = await getRoleDefinitions(supabase, businessId);
      const roles = resolveRoles(floor as RoleDefinitionRow[], tenant as RoleDefinitionRow[]);
      setResolved(roles);
      setDraft(Object.fromEntries(roles.map((r) => [r.role_key, [...r.permissions]])));
      setDirty(new Set());
      const m = await getMembersByBusiness(supabase, businessId);
      setMembers(m);
      setLoadError('');
      console.log('[TRACE:ROLECFG] loaded', { businessId, roles: roles.map((r) => ({ k: r.role_key, src: r.source, n: r.permissions.length })) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load roles';
      // relation-missing → migration not yet applied (mirror Settings' friendly guidance)
      if (/role_definitions/.test(msg) && /(does not exist|relation|schema cache)/.test(msg)) {
        setLoadError('Role configuration becomes available once the role_definitions migration is applied.');
      } else {
        setLoadError(msg);
      }
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [businessId]);

  // ── chip toggle → local draft (system roles edit into an OVERRIDE on save; floor untouched) ──
  function togglePerm(roleKey: string, permId: string) {
    setDraft((d) => {
      const cur = d[roleKey] ?? [];
      const next = cur.includes(permId) ? cur.filter((p) => p !== permId) : [...cur, permId];
      return { ...d, [roleKey]: next };
    });
    setDirty((s) => new Set(s).add(roleKey));
  }

  async function saveRole(role: ResolvedRole) {
    if (!businessId) return;
    setBusy(true);
    try {
      // System role_key → writes a per-tenant OVERRIDE (clone-not-mutate: the floor row is never
      // touched). Custom role_key → updates the custom row. Either way upsertTenantRole writes a
      // tenant-scoped row, owner-only by RLS.
      await upsertTenantRole(supabase, businessId, role.role_key, {
        is_system: false,
        label: role.label,
        description: role.description,
        permissions: draft[role.role_key] ?? [],
      });
      console.log('[TRACE:ROLECFG] saveRole', { roleKey: role.role_key, source: role.source, perms: (draft[role.role_key] ?? []).length });
      setSavedKey(role.role_key);
      setTimeout(() => setSavedKey(''), 2500);
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Save failed');
    } finally { setBusy(false); }
  }

  async function addCustomRole() {
    if (!businessId) return;
    const key = newRoleName.trim().toUpperCase().replace(/\s+/g, '_');
    if (!key || resolved.some((r) => r.role_key === key)) return;
    setBusy(true);
    try {
      await upsertTenantRole(supabase, businessId, key, { is_system: false, label: key, permissions: [] });
      console.log('[TRACE:ROLECFG] addCustomRole', { roleKey: key });
      setNewRoleName('');
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Create failed');
    } finally { setBusy(false); }
  }

  // CLONE-NOT-MUTATE: clone a system role into a NEW custom role pre-filled with its current
  // effective permissions, then extend. The system role itself is never edited in place.
  async function cloneSystemRole(role: ResolvedRole) {
    if (!businessId) return;
    let key = `${role.role_key}_COPY`;
    let n = 2;
    while (resolved.some((r) => r.role_key === key)) key = `${role.role_key}_COPY_${n++}`;
    setBusy(true);
    try {
      await upsertTenantRole(supabase, businessId, key, {
        is_system: false,
        label: key,
        description: `Cloned from ${role.role_key}`,
        permissions: [...(draft[role.role_key] ?? role.permissions)],
      });
      console.log('[TRACE:ROLECFG] cloneSystemRole', { from: role.role_key, to: key });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Clone failed');
    } finally { setBusy(false); }
  }

  // FACTORY-RESET a tuned system role: delete the tenant override → the shared floor shows through.
  async function factoryReset(role: ResolvedRole) {
    if (!businessId) return;
    if (!window.confirm(`Reset ${role.role_key} to the standard definition? Your tenant changes to this role will be removed.`)) return;
    setBusy(true);
    try {
      await deleteTenantRole(supabase, businessId, role.role_key);
      console.log('[TRACE:ROLECFG] factoryReset', { roleKey: role.role_key });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Reset failed');
    } finally { setBusy(false); }
  }

  async function deleteCustom(role: ResolvedRole) {
    if (!businessId) return;
    if (!window.confirm(`Delete custom role ${role.role_key}? Members on this role keep their current permissions until reassigned.`)) return;
    setBusy(true);
    try {
      await deleteTenantRole(supabase, businessId, role.role_key);
      console.log('[TRACE:ROLECFG] deleteCustom', { roleKey: role.role_key });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Delete failed');
    } finally { setBusy(false); }
  }

  // MEMBER → ROLE assignment: reuse the existing shared updateMemberRole(). Applies the role's
  // currently-resolved permission set to the member's own business_members.permissions (the final
  // layer of the resolution chain). The new self-grant trigger permits this because the OWNER is
  // the caller — a member could not do this to itself.
  async function assignMemberRole(member: Member, roleKey: string) {
    if (!businessId) return;
    const role = resolved.find((r) => r.role_key === roleKey);
    if (!role) return;
    setBusy(true);
    try {
      await updateMemberRole(supabase, member.id, roleKey, role.permissions);
      console.log('[TRACE:ROLECFG] assignMemberRole', { memberId: member.id, roleKey, perms: role.permissions.length });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Assignment failed');
    } finally { setBusy(false); }
  }

  // ── render ─────────────────────────────────────────────────────────────────────
  if (!can('manage_settings') && !isOwner) {
    return <div style={{ padding: 24, color: T.sub }}>Role configuration is available to the business owner.</div>;
  }

  return (
    <div style={{ backgroundColor: T.bg, minHeight: '100%', padding: 20 }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h1 style={{ color: T.primary, fontSize: 22, fontWeight: 800, margin: '4px 0 2px' }}>Roles &amp; permissions</h1>
        <p style={{ color: T.sub, fontSize: 13, marginBottom: 18 }}>
          Choose which tiles each role can see and use. System roles are locked — clone one to make a custom role,
          or tune a system role for your business (reset returns it to standard).
        </p>

        {loadError && (
          <div style={{ background: '#FFF4F4', border: `1px solid ${T.danger}`, color: T.danger, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {/* Add custom role */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Add custom role</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              placeholder="ROLE_NAME"
              style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700, padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 14 }}
            />
            <button onClick={addCustomRole} disabled={busy || !newRoleName.trim()}
              style={{ background: T.primary, color: '#fff', fontWeight: 800, padding: '10px 18px', borderRadius: 10, border: 'none', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: busy || !newRoleName.trim() ? 0.5 : 1 }}>
              + Add
            </button>
          </div>
        </div>

        {/* Role cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {resolved.map((role) => {
            const perms = draft[role.role_key] ?? [];
            const isDirty = dirty.has(role.role_key);
            return (
              <div key={role.role_key} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ background: roleBadgeColor(role.role_key), color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 8, letterSpacing: '0.05em' }}>{role.role_key}</span>
                    <span style={{ fontSize: 11, color: T.sub }}>{perms.length} permissions</span>
                    {role.locked && <span style={{ fontSize: 10, color: T.sub, textTransform: 'uppercase', border: `1px solid ${T.border}`, borderRadius: 6, padding: '1px 6px' }}>system role</span>}
                    {role.isOverridden && <span style={{ fontSize: 10, color: T.primary, textTransform: 'uppercase' }}>tuned</span>}
                    {role.source === 'custom' && <span style={{ fontSize: 10, color: '#7C3AED', textTransform: 'uppercase' }}>custom</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {role.locked && (
                      <button onClick={() => cloneSystemRole(role)} disabled={busy}
                        style={{ background: 'none', border: `1px solid ${T.border}`, color: T.primary, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                        Clone to custom
                      </button>
                    )}
                    {role.isOverridden && (
                      <button onClick={() => factoryReset(role)} disabled={busy}
                        style={{ background: 'none', border: `1px solid ${T.border}`, color: T.sub, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                        Reset to standard
                      </button>
                    )}
                    {!role.locked && (
                      <button onClick={() => deleteCustom(role)} disabled={busy}
                        style={{ background: 'none', border: `1px solid ${T.border}`, color: T.danger, fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {catalogByGroup.map((grp) => (
                  <div key={grp.key} style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{grp.label}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {grp.chips.map((chip) => {
                        const on = perms.includes(chip.id);
                        return (
                          <button key={chip.id} onClick={() => togglePerm(role.role_key, chip.id)} disabled={busy}
                            title={chip.tiles.length ? `Unlocks: ${chip.tiles.join(', ')}` : 'Data-layer permission'}
                            style={{
                              fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                              background: on ? T.chipOnBg : T.chipOffBg,
                              border: `1px solid ${on ? T.chipOnBorder : T.chipOffBorder}`,
                              color: on ? T.primary : T.sub,
                            }}>
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => saveRole(role)} disabled={busy || !isDirty}
                    style={{ background: isDirty ? T.primary : '#C7D3B5', color: '#fff', fontWeight: 800, padding: '9px 18px', borderRadius: 10, border: 'none', fontSize: 12, cursor: isDirty ? 'pointer' : 'default' }}>
                    Save {role.role_key}
                  </button>
                  {savedKey === role.role_key && <span style={{ color: T.primary, fontSize: 12, fontWeight: 700 }}>Saved ✓</span>}
                  {role.locked && isDirty && <span style={{ color: T.sub, fontSize: 11 }}>Saving tunes this role for your business (system standard is preserved).</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Member → role assignment (reuses shared updateMemberRole) */}
        {members.length > 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Assign members to a role</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: T.ink }}>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    {m.email && <span style={{ color: T.sub }}> · {m.email}</span>}
                    {!m.active && <span style={{ color: T.sub, fontSize: 11 }}> · invited</span>}
                  </div>
                  <select value={(m.role ?? '').toUpperCase()} disabled={busy}
                    onChange={(e) => assignMemberRole(m, e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, background: '#fff' }}>
                    <option value="" disabled>Select role…</option>
                    {resolved.map((r) => <option key={r.role_key} value={r.role_key}>{r.role_key}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: T.sub, marginTop: 10 }}>Changing a member's role applies that role's current permissions to the member.</p>
          </div>
        )}
      </div>
    </div>
  );
}
