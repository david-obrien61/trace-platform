/**
 * Action-permission vocabulary — permissions that gate a BEHAVIOR, not a tile (PURPOSE).
 *
 * Mirror of financialPermissions.ts. Some permissions don't gate a dashboard tile
 * (which is how registryPermissions() surfaces them) — they gate an ACTION the user
 * may take. Defining them here, ONE place, lets the role-config console union them
 * into its chip catalog (alongside registryPermissions() and ALL_FINANCIAL_PERMISSIONS)
 * so they are assignable, clone-not-mutate, and factory-resettable like any other chip,
 * with no hardcoded permission list anywhere.
 *
 * DEPENDENCIES: none (pure constants + a pure helper).
 * OUTPUTS: the action permission strings, ALL_ACTION_PERMISSIONS, role-default map,
 *   and actionDefaultsForRole.
 *
 * AC-1: these are string VALUES, never vertical nouns or TS identifiers of a vertical.
 */

// ── the action permissions ──────────────────────────────────────────────────

/**
 * Defer/use an asset against its PMI schedule (skip or push an overdue service,
 * run an asset that is due). Gates the OVERRIDE ACTION — the mechanism (the
 * defer/reason-required write) is NOT built yet; this only DECLARES the permission
 * so it exists and is assignable in the role console. Default OWNER + MANAGER.
 */
export const OVERRIDE_MAINTENANCE = 'override_maintenance';

/**
 * Read this business's CUSTOMERS (the roster + the order-entry lookup/attach typeahead).
 * A DATA-READ behavior, not a dashboard tile — the /customers roster route stays owner-only,
 * but a member holding this may READ customers to look one up and attach them during order
 * entry (customer-first Path A). Enforced at the DATA layer by the customers_member RLS
 * policy (is_active_member AND has_permission('view_customers'), 20260710). Default OWNER +
 * MANAGER; STAFF granted only if the owner chooses to in the /roles console.
 */
export const VIEW_CUSTOMERS = 'view_customers';

export const ACTION_PERMISSIONS = {
  OVERRIDE_MAINTENANCE,
  VIEW_CUSTOMERS,
} as const;

export type ActionPermission =
  (typeof ACTION_PERMISSIONS)[keyof typeof ACTION_PERMISSIONS];

/** Every behavior-gating action permission, in a stable order. */
export const ALL_ACTION_PERMISSIONS: string[] = [
  OVERRIDE_MAINTENANCE,
  VIEW_CUSTOMERS,
];

// ── role defaults (DEFAULT-DENY) ────────────────────────────────────────────

/**
 * Role string → its default action grants.
 *   OWNER   → override_maintenance.
 *   MANAGER → override_maintenance (runs the floor; may keep equipment moving).
 *   STAFF   → none.
 * Keys match the free-form `business_members.role` strings; an unlisted role gets [].
 */
export const ACTION_ROLE_DEFAULTS: Record<string, string[]> = {
  OWNER: [OVERRIDE_MAINTENANCE, VIEW_CUSTOMERS],
  MANAGER: [OVERRIDE_MAINTENANCE, VIEW_CUSTOMERS],
  STAFF: [],
};

/** Default action grants for a role string. DEFAULT-DENY on unknown roles. */
export function actionDefaultsForRole(role: string | null | undefined): string[] {
  if (!role) return [];
  return ACTION_ROLE_DEFAULTS[role] ?? [];
}
