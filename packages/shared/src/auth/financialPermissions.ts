/**
 * Financial-data permission vocabulary — the v1 role-wall (PURPOSE).
 *
 * SOURCE OF TRUTH: docs/decisions/2026-06-21-role-financial-permissions.md
 * (recon: data/grower-scan/role-enforcement-ground-truth.md).
 *
 * Four permissions, DEFAULT-DENY. This file is the ONE place the four strings,
 * their role defaults, and the view_margin⊆view_costs dependency are defined, so
 * the chokepoint, the role bundles, the backfill script, and the later
 * data-layer wall all reference the SAME constants and cannot drift.
 *
 * DEPENDENCIES: none (pure constants + pure functions — safe to import into
 *   low-level constants files and into Vercel/Node scripts).
 * OUTPUTS: the four permission strings, role-default map, and two pure helpers
 *   (financialDefaultsForRole, applyFinancialDependencies).
 *
 * AC-1: these are string VALUES, never vertical nouns or TS identifiers of a vertical.
 */

// ── the four permissions ────────────────────────────────────────────────────

/** Operational unit_cost (/costs, /inventory, /assets, /operating-costs). SHAPING. */
export const VIEW_COSTS = 'view_costs';
/** The pricing recipe / moat — business_modules.config pricing blob. HARD WALL. */
export const VIEW_PRICING_CONFIG = 'view_pricing_config';
/** HR pay — labor_resources.base_wage/burden/cost_rate/bill_rate/rate. HARD WALL. */
export const VIEW_WAGES = 'view_wages';
/** The margin verdict (cost-vs-sell). SHAPING. REQUIRES view_costs (never the
 *  verdict to a session denied its inputs). */
export const VIEW_MARGIN = 'view_margin';

export const FINANCIAL_PERMISSIONS = {
  VIEW_COSTS,
  VIEW_PRICING_CONFIG,
  VIEW_WAGES,
  VIEW_MARGIN,
} as const;

export type FinancialPermission =
  (typeof FINANCIAL_PERMISSIONS)[keyof typeof FINANCIAL_PERMISSIONS];

/** All four, in a stable order (wall pair first, then the shaping pair). */
export const ALL_FINANCIAL_PERMISSIONS: string[] = [
  VIEW_WAGES,
  VIEW_PRICING_CONFIG,
  VIEW_COSTS,
  VIEW_MARGIN,
];

// ── role defaults (DEFAULT-DENY) ────────────────────────────────────────────

/**
 * Role string → its default financial grants.
 *   OWNER   → all four.
 *   MANAGER → view_costs + view_margin (ops must see what's selling short;
 *             NOT the pricing recipe, NOT payroll).
 *   STAFF   → none (the "tech → none unless explicitly granted" default).
 * Keys match the free-form `business_members.role` strings. A role NOT listed
 * here gets [] — DEFAULT-DENY, by design. Ignition roles snap in here when that
 * vertical adopts the wall.
 */
export const FINANCIAL_ROLE_DEFAULTS: Record<string, string[]> = {
  OWNER: [VIEW_WAGES, VIEW_PRICING_CONFIG, VIEW_COSTS, VIEW_MARGIN],
  MANAGER: [VIEW_COSTS, VIEW_MARGIN],
  STAFF: [],
};

/** Default financial grants for a role string. DEFAULT-DENY on unknown roles. */
export function financialDefaultsForRole(role: string | null | undefined): string[] {
  if (!role) return [];
  return FINANCIAL_ROLE_DEFAULTS[role] ?? [];
}

// ── dependency rule ─────────────────────────────────────────────────────────

/**
 * Enforce view_margin ⊆ view_costs: the margin verdict is never surfaced to a
 * session that lacks the cost inputs it is derived from. Returns the list with
 * view_margin stripped when view_costs is absent. Pure — does not mutate.
 */
export function applyFinancialDependencies(permissions: string[]): string[] {
  if (permissions.includes(VIEW_MARGIN) && !permissions.includes(VIEW_COSTS)) {
    return permissions.filter((p) => p !== VIEW_MARGIN);
  }
  return permissions;
}
