// Cultivar OS role definitions and permission bundles.
//
// Three roles cover the entire nursery staff hierarchy:
//   OWNER   — the nursery owner. Full access including settings and team management.
//   MANAGER — Lauren's role. Runs day-to-day ops: checkout, deliveries, campaigns.
//             Cannot change business settings or manage team members.
//   STAFF   — Seasonal / part-time. Can scan QR and run checkout. No admin views.
//
// Permissions are stored as string arrays in the business_members.permissions JSONB column.
// Use checkPermission(member.permissions, 'manage_settings') at call sites to gate UI.
//
// ⚠️ PERMISSIONS was RETIRED 2026-07-26 (Phase 0 of the resource:action RBAC refit). It was
// the FIFTH representation of one fact — beside financialPermissions.ts, actionPermissions.ts
// and the two UNWIRED_* lists — and STD-011 says one fact gets one home. Every string it
// held now lives in packages/shared/src/auth/permissionManifest.ts as LEGACY_PERMISSION,
// beside the resource:verb model those strings decompose into and the alias layer that
// bridges them. Route gates import LEGACY_PERMISSION; nothing imports a permission from
// this file. Source: docs/resource-action-permission-spec.md (v3).
//
// This file keeps what it alone owns: the Cultivar ROLE vocabulary and its labels.

export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type CultivarRole = typeof ROLES[number];

// ⚠️ DEFAULT_PERMISSIONS was RETIRED 2026-07-23 (David's ruling OPTION 1). It was a THIRD
// representation of role→permission facts (beside the role_definitions floor and the member
// rows) and was already stale — OWNER 17 / MANAGER 14 against a floor of 12/9 — which is exactly
// the STD-011 drift the funnel exists to end. Mints now READ THE RESOLVED FLOOR via
// resolveRoleDefaults(supabase, businessId, roleKey) (shared/auth/roleDefinitions.ts), the SAME
// resolution the Roles tab renders and the funnel writes. There is no client-side default map.

// Human-readable role labels for the invite UI.
export const ROLE_LABELS: Record<CultivarRole, string> = {
  OWNER:   'Owner',
  MANAGER: 'Manager',
  STAFF:   'Staff',
};

export const ROLE_DESCRIPTIONS: Record<CultivarRole, string> = {
  OWNER:   'Full access — settings, team, QB, all reports',
  MANAGER: 'Day-to-day ops — checkout, deliveries, campaigns, orders',
  STAFF:   'QR checkout and order history only',
};
