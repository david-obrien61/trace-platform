/**
 * Permission check helpers — pure functions, no vertical knowledge.
 *
 * Role names and permission strings are string VALUES (AC-1: no vertical nouns
 * as TypeScript identifiers or union types). Each vertical passes its own
 * PermissionPolicy as config data.
 *
 * Two permission formats exist in the wild:
 *   (A) Role-badge format: permissions = ["ADMIN", "TECH"]
 *       Used with expandRoles() to resolve role → capability strings.
 *       DataBridge.getSystemRoles() produces this shape.
 *
 *   (B) Capability-string format: permissions = ["view_hub", "scan_parts"]
 *       Stored directly in shop_members.permissions by IgnitionAdmin ROLE_PRESETS.
 *       auth.ts authenticate() derives `allowed` from these by stripping 'view_'.
 *
 * Both formats work with can() and checkPermission() — the caller decides which
 * string to test.
 *
 * Existing checkPermission() in members.ts covers the raw-array case.
 * This module adds session-aware wrappers and the role-expansion pattern.
 */

// ── types ─────────────────────────────────────────────────────────────────────

/**
 * A vertical's role configuration — maps role name strings to their default
 * permission string arrays.
 *
 * Role names are string values (e.g. "TECH", "ADMIN") — not TypeScript identifiers.
 * Each vertical defines its own role names and associated permissions.
 *
 * Example (Ignition OS):
 * ```ts
 * const IGNITION_POLICY: PermissionPolicy = {
 *   roles: {
 *     ADMIN: ['view_omni','view_hub','edit_margins','manage_users', ...],
 *     TECH:  ['view_kosk','view_cipher','view_hub','scan_parts', ...],
 *     SERVICE: ['view_port','view_crm','view_cipher','sign_estimates'],
 *   }
 * };
 * ```
 */
export interface PermissionPolicy {
  /** Role name → permission strings for that role */
  roles: Record<string, string[]>;
}

/** Minimal session shape understood by these helpers. */
export interface SessionLike {
  role: string;
  permissions: string[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Check whether a session holds a specific permission string.
 * Works for both role-badge format ("ADMIN") and capability-string format ("view_hub").
 * Null-safe — returns false for missing session.
 */
export function can(
  session: Pick<SessionLike, 'permissions'> | null | undefined,
  permissionId: string,
): boolean {
  return session?.permissions.includes(permissionId) ?? false;
}

/**
 * Check whether a session's role field matches a given role name.
 * Null-safe — returns false for missing session.
 */
export function hasRole(
  session: Pick<SessionLike, 'role'> | null | undefined,
  roleName: string,
): boolean {
  return session?.role === roleName;
}

/**
 * Check module-navigation access via the `allowed` shortlist.
 * `allowed` is derived by auth.ts authenticate() from view_* permissions:
 *   allowed = permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', ''))
 *
 * This check is specific to Ignition's AuthSession pattern. Pass session.allowed directly.
 * Null-safe — returns false for missing or empty allowed array.
 *
 * @example
 *   canAccessModule(session.allowed, 'flux')  // true if 'view_flux' was in permissions
 */
export function canAccessModule(
  allowed: string[] | null | undefined,
  moduleKey: string,
): boolean {
  return allowed?.includes(moduleKey) ?? false;
}

/**
 * Expand a list of role-badge strings into the flat union of their permission strings.
 *
 * Replaces the DataBridge.getSystemRoles() + flatMap pattern in CoreApp.jsx.
 * Unknown role names are silently skipped (they produce an empty contribution).
 *
 * @example
 *   expandRoles(IGNITION_POLICY, ['ADMIN']) → ['view_omni', 'edit_margins', ...]
 *   expandRoles(IGNITION_POLICY, ['TECH', 'PRICING_AUTHORITY']) → deduped union
 */
export function expandRoles(
  policy: PermissionPolicy,
  roleNames: string[],
): string[] {
  return [...new Set(roleNames.flatMap(r => policy.roles[r] ?? []))];
}

/**
 * Derive the `allowed` module-key list from a permissions array.
 * Strips the 'view_' prefix from all capability strings that start with it.
 * Matches the derivation in auth.ts authenticate() and CoreApp.jsx JoinFlow.
 *
 * @example
 *   deriveAllowed(['view_hub', 'scan_parts', 'view_flux']) → ['hub', 'flux']
 */
export function deriveAllowed(permissions: string[]): string[] {
  return permissions
    .filter(p => p.startsWith('view_'))
    .map(p => p.replace('view_', ''));
}
