// PURPOSE:      Cultivar mount of the AGNOSTIC shared <MemberConsole/> (D-31 spine surface) at
//               /team. Supplies Cultivar's theme + the tileRegistry-derived permission catalog +
//               invite roles + business context. All member/role/device logic lives in the shared
//               console; this wrapper is config only (the same component Ignition can mount).
// DEPENDENCIES: @trace/shared/components/team/MemberConsole · useBusinessContext (businessId/
//               isOwner/can) · tileRegistry (allTiles/registryPermissions → chip catalog, ONE
//               source, no hardcoded permission list) · shared financial/action permission consts
//               · auth/roles (DEFAULT_PERMISSIONS/ROLE_LABELS/ROLE_DESCRIPTIONS) · lib/supabase.
// OUTPUTS:      <TeamConsole/> — owner-only console (route gated by PermissionRoute manage_settings).

import { useMemo } from 'react';
import { useBusinessContext } from '@trace/shared/context';
import { MemberConsole } from '@trace/shared/components/team/MemberConsole';
import type { PermChip, PermGroup, MemberConsoleTheme } from '@trace/shared/components/team/MemberConsole';
import { ALL_FINANCIAL_PERMISSIONS, ALL_ACTION_PERMISSIONS } from '@trace/shared/auth';
import { allTiles, registryPermissions } from '../registry/tileRegistry';
import { ROLES, DEFAULT_PERMISSIONS, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../auth/roles';
import type { CultivarRole } from '../auth/roles';
import { supabase } from '../lib/supabase';

const THEME: MemberConsoleTheme = {
  primary: '#27500A', bg: '#EAF3DE', card: '#FFFFFF', border: '#D8E2C8',
  ink: '#1C2A12', sub: '#5B6B47', danger: '#A32D2D',
  chipOnBg: 'rgba(39,80,10,0.12)', chipOnBorder: '#27500A', chipOffBg: '#F4F6EE', chipOffBorder: '#D8E2C8',
};

const humanize = (p: string): string => p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const GROUP_ORDER = ['checkout', 'fulfilment', 'financial', 'growth', 'readout', 'settings', 'admin', 'planned', 'other'];
const GROUP_LABELS: Record<string, string> = {
  checkout: 'Checkout', fulfilment: 'Fulfilment', financial: 'Financial', growth: 'Growth',
  readout: 'Readouts', settings: 'Settings', admin: 'Admin', planned: 'Planned', other: 'Other',
};

export function TeamConsole() {
  const { businessId, isOwner, can } = useBusinessContext();

  // Registry-fed chip catalog (ONE source — same construction as the old RoleConfig): a newly
  // registered tile surfaces its permission as a chip with no edit here.
  const permissionGroups = useMemo<PermGroup[]>(() => {
    const tilesByPerm: Record<string, string[]> = {};
    for (const t of allTiles()) (tilesByPerm[t.required_permission] ||= []).push(t.label);
    const ids = [...new Set([...registryPermissions(), ...ALL_FINANCIAL_PERMISSIONS, ...ALL_ACTION_PERMISSIONS])].filter((p) => p !== 'owner-only');
    const chips: PermChip[] = ids.map((id) => {
      const fromTile = allTiles().find((t) => t.required_permission === id)?.group;
      const group = fromTile ?? (ALL_FINANCIAL_PERMISSIONS.includes(id) ? 'financial' : ALL_ACTION_PERMISSIONS.includes(id) ? 'fulfilment' : 'other');
      return { id, label: humanize(id), group: GROUP_ORDER.includes(group) ? group : 'other', tiles: tilesByPerm[id] ?? [] };
    });
    const byGroup: Record<string, PermChip[]> = {};
    for (const c of chips) (byGroup[c.group] ||= []).push(c);
    return GROUP_ORDER.filter((k) => byGroup[k]?.length).map((k) => ({ key: k, label: GROUP_LABELS[k], chips: byGroup[k] }));
  }, []);

  const inviteRoleOptions = useMemo(
    () => (ROLES.filter((r) => r !== 'OWNER') as CultivarRole[]).map((r) => ({ role_key: r, label: ROLE_LABELS[r], description: ROLE_DESCRIPTIONS[r] })),
    [],
  );

  if (!businessId) return null;

  return (
    <MemberConsole
      supabase={supabase}
      businessId={businessId}
      isOwner={isOwner}
      can={can}
      theme={THEME}
      permissionGroups={permissionGroups}
      inviteRoleOptions={inviteRoleOptions}
      defaultPermissionsFor={(rk) => DEFAULT_PERMISSIONS[rk as CultivarRole] ?? []}
      inviteBaseUrl={typeof window !== 'undefined' ? window.location.origin : ''}
      invitePath="/join"
      showDevices
      managePermission="manage_settings"
    />
  );
}
