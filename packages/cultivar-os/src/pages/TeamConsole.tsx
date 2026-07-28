// PURPOSE:      Cultivar mount of the AGNOSTIC shared <MemberConsole/> (D-31 spine surface) at
//               /team. Supplies Cultivar's theme + the tileRegistry-derived permission catalog +
//               invite roles + business context. All member/role/device logic lives in the shared
//               console; this wrapper is config only (the same component Ignition can mount).
// DEPENDENCIES: @trace/shared/components/team/MemberConsole · useBusinessContext (businessId/
//               isOwner/can) · permissionManifest (ENFORCED_PERMISSIONS = the chip catalog, ONE
//               source; permissionLabel = the DERIVED pill label — no hand-maintained display map)
//               · tileRegistry (allTiles → chip GROUPING + the "used by" trail only, never catalog
//               membership)
//               · auth/roles (ROLE_LABELS/ROLE_DESCRIPTIONS) · lib/supabase.
// OUTPUTS:      <TeamConsole/> — owner-only console (route gated by PermissionRoute manage_settings).

import { useMemo } from 'react';
import { useBusinessContext } from '@trace/shared/context';
import { MemberConsole } from '@trace/shared/components/team/MemberConsole';
import type { PermChip, PermGroup, MemberConsoleTheme } from '@trace/shared/components/team/MemberConsole';
import { ENFORCED_PERMISSIONS, PERMISSION_MANIFEST, permissionLabel } from '@trace/shared/auth';
import { allTiles } from '../registry/tileRegistry';
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '../auth/roles';
import type { CultivarRole } from '../auth/roles';
import { supabase } from '../lib/supabase';

const THEME: MemberConsoleTheme = {
  primary: '#27500A', bg: '#EAF3DE', card: '#FFFFFF', border: '#D8E2C8',
  ink: '#1C2A12', sub: '#5B6B47', danger: '#A32D2D',
  chipOnBg: 'rgba(39,80,10,0.12)', chipOnBorder: '#27500A', chipOffBg: '#F4F6EE', chipOffBorder: '#D8E2C8',
};

const GROUP_ORDER = ['checkout', 'fulfilment', 'financial', 'growth', 'readout', 'settings', 'admin', 'planned', 'other'];
const GROUP_LABELS: Record<string, string> = {
  checkout: 'Checkout', fulfilment: 'Fulfilment', financial: 'Financial', growth: 'Growth',
  readout: 'Readouts', settings: 'Settings', admin: 'Admin', planned: 'Planned', other: 'Other',
};

export function TeamConsole() {
  const { businessId, isOwner, can } = useBusinessContext();

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // THE CHIP CATALOG IS THE MANIFEST'S ENFORCED SET. NOTHING ELSE. (N-4/N-3, David 2026-07-28)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // WHAT THIS REPLACES AND WHY. The catalog was a UNION — registryPermissions() ∪
  // ALL_FINANCIAL_PERMISSIONS ∪ ALL_ACTION_PERMISSIONS, minus HIDDEN_PERMISSIONS — which is three
  // sources filtered by a fourth, and it rendered BOTH VOCABULARIES AT ONCE: `Costs:Read` beside
  // `View Costs`, `Pmi:Read` beside `View Wages` / `View Pricing Config` / `View Margin`. RETIRED
  // legacy strings rendered as GRANTABLE PILLS on the surface whose job is to say what a role can
  // do. It offered 21 strings against a model of 60; MANAGER's card read "11 permissions" over a
  // 40-string array, so TWENTY-NINE of Lauren's permissions rendered NOWHERE.
  //
  // 🔴 THE LEGACY PILLS DISAPPEAR BECAUSE THEY ARE NOT IN THE MANIFEST — no removal list, no
  // exceptions file, nothing to keep in sync. `ENFORCED_PERMISSIONS` is `status==='enforced'`
  // minus HIDDEN (spec §7.1); `declared-unwired` and `derived` are excluded by the same rule that
  // defines them. A sixth hand-maintained list here would have joined the pile that went stale.
  //
  // THE COUNTS FOLLOW FOR FREE. MemberConsole counts `perms.filter(id => allChipIds.includes(id))`
  // (:802) and renders the owner row as `allChipIds.length of allChipIds.length` (:837) — both
  // already derive from THIS catalog. "11 permissions" was not a counting bug; it was this list
  // being wrong, and the count faithfully reporting it. One source, so they cannot disagree again.
  //
  // TILES STILL SUPPLY GROUPING AND THE "used by" TRAIL — but never MEMBERSHIP of the catalog. A
  // tile gating on a string the model does not declare is a finding for capP, not a pill: today
  // that is `reports:read` on `business_insights`, `status:'planned'`, no route. Its chip
  // correctly disappears — a pill for an unbuilt surface is the fake-pill class D-9 names, and the
  // same one #153 hid `view_reports` for.
  const permissionGroups = useMemo<PermGroup[]>(() => {
    const tilesByPerm: Record<string, string[]> = {};
    for (const t of allTiles()) (tilesByPerm[t.required_permission] ||= []).push(t.label);
    const ids = ENFORCED_PERMISSIONS;
    const chips: PermChip[] = ids.map((id) => {
      const fromTile = allTiles().find((t) => t.required_permission === id)?.group;
      const group = fromTile ?? (PERMISSION_MANIFEST[id]?.sensitivity === 'confidential' ? 'financial' : 'other');
      // LABEL IS DERIVED (permissionLabel = resource + verb). "View Costs" / "View Wages" /
      // "View Margin" were legacy DISPLAY names for retired strings — a label map would be the
      // sixth representation of something the string already contains.
      return { id, label: permissionLabel(id), group: GROUP_ORDER.includes(group) ? group : 'other', tiles: tilesByPerm[id] ?? [] };
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
      inviteBaseUrl={typeof window !== 'undefined' ? window.location.origin : ''}
      invitePath="/join"
      showDevices
      managePermission="manage_settings"
    />
  );
}
