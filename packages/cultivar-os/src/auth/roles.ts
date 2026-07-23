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
// FINANCIAL-DATA permissions (view_costs/view_pricing_config/view_wages/view_margin) are
// defined ONCE in the shared module and imported here so the role wall's vocabulary cannot
// drift between the chokepoint, these bundles, the backfill script, and the RLS layer.
// Source: docs/decisions/2026-06-21-role-financial-permissions.md.

import {
  VIEW_COSTS,
  VIEW_PRICING_CONFIG,
  VIEW_WAGES,
  VIEW_MARGIN,
} from '@trace/shared/auth/financialPermissions';
import { OVERRIDE_MAINTENANCE, VIEW_CUSTOMERS, APPLY_TAX_EXEMPT, APPLY_DISCOUNT } from '@trace/shared/auth/actionPermissions';

export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type CultivarRole = typeof ROLES[number];

export const PERMISSIONS = {
  VIEW_DASHBOARD:    'view_dashboard',
  QR_CHECKOUT:       'qr_checkout',
  VIEW_ORDERS:       'view_orders',
  MANAGE_ORDERS:     'manage_orders',      // edit / delete / status-change an order (roster CRUD); owner + manager
  MANAGE_DELIVERIES: 'manage_deliveries',
  MANAGE_CUSTOMERS:  'manage_customers',
  MANAGE_CAMPAIGNS:  'manage_campaigns',
  VIEW_REPORTS:      'view_reports',
  MANAGE_SETTINGS:   'manage_settings',   // settings page, QB connect, team management
  VIEW_CUSTOMERS,                          // read customers (roster + order-entry lookup/attach); RLS-gated (20260710). owner + manager
  // ── financial-data wall (v1) — default-deny; backfilled onto existing members ──
  VIEW_COSTS,                              // operational unit_cost (shaping)
  VIEW_PRICING_CONFIG,                     // pricing recipe / moat (hard wall)
  VIEW_WAGES,                              // HR pay (hard wall)
  VIEW_MARGIN,                             // margin verdict (shaping; requires VIEW_COSTS)
  // ── action permissions (gate a behavior, not a tile) ──
  OVERRIDE_MAINTENANCE,                    // defer/use an asset against its PMI schedule (mechanism not yet built)
  APPLY_TAX_EXEMPT,                        // zero an order's tax via a documented exemption (D-40); owner + manager
  APPLY_DISCOUNT,                          // apply a discount / owner price-override on an order (D-40 matched pair); owner + manager
} as const;

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
