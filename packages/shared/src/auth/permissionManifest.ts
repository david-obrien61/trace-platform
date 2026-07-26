/**
 * THE PERMISSION MANIFEST — the ONE source for what a permission is (PURPOSE).
 *
 * SOURCE OF TRUTH: docs/resource-action-permission-spec.md (v3, 2026-07-26 — David's
 *   rulings R1–R9) + docs/decisions/2026-07-26-rbac-build-plan.md (§2 the legacy map,
 *   §4 the verifier, §6 the cards). Standard: resource:action RBAC.
 *
 * WHAT THIS MODULE RETIRES AND ABSORBS (STD-011 — five representations of one fact → one):
 *   · financialPermissions.ts       (the four view_* strings + their role defaults + the
 *                                    view_margin ⊆ view_costs dependency)
 *   · actionPermissions.ts          (the five action strings + their role defaults)
 *   · UNWIRED_ACTION_PERMISSIONS    (fake-pill list #1)   → derived from `unwired` below
 *   · UNWIRED_REGISTRY_PERMISSIONS  (fake-pill list #2)   → derived from `unwired` below
 *   · roles.ts PERMISSIONS          (the cultivar string map)
 *
 * TWO SECTIONS, ONE MODULE — and the distinction is load-bearing:
 *
 *   1. THE MODEL (`PERMISSION_MANIFEST`) — every `resource:verb` and capability verb the
 *      spec defines, with its status, sensitivity and dependencies. This is the TARGET
 *      vocabulary. It is what capP asserts against and what the Roles page will render
 *      FROM once card N-4 lands.
 *
 *   2. THE LEGACY REGISTER (`LEGACY_PERMISSIONS`) — build-plan §2's map: each legacy
 *      string, what it decomposes into, its fate, and whether it is unwired TODAY. This
 *      is what the Roles page reads today (so Phase 0 changes NO behavior) and what seeds
 *      the `permission_aliases` table. The SQL seed in
 *      supabase/migrations/20260726_permission_alias_layer.sql MIRRORS this register —
 *      if the two ever disagree, the register is the source and the migration is wrong.
 *
 * PHASE 0 IS NEUTRAL BY CONSTRUCTION. No gate string changes in this commit. Every
 * consumer that imported a legacy constant imports it from here instead, and
 * HIDDEN_PERMISSIONS reproduces the previous two unwired lists exactly.
 *
 * DEPENDENCIES: none (pure data + pure functions — safe to import into api/ handlers,
 *   Node scripts, and the client bundle alike).
 * OUTPUTS: PERMISSION_MANIFEST, LEGACY_PERMISSIONS, ALIAS_PAIRS, HIDDEN_PERMISSIONS,
 *   MANAGER_DEFAULT_BUNDLE, STAFF_DEFAULT_BUNDLE, splitPermission, dependenciesOf,
 *   applyPermissionDependencies, + the legacy string constants during the migration window.
 *
 * AC-1: every permission is a string VALUE. No vertical noun appears as an identifier.
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

/**
 * What enforces a string (spec §7.1). Exactly three values — do NOT add a fourth
 * without a ruling; the three exist so assertion 1 can be TRUTHFUL mid-migration
 * instead of failing until the last phase.
 *   enforced         — a policy, RPC, or api-layer gate checks this string, or checks a
 *                      legacy antecedent that resolves to it through the alias layer.
 *   declared-unwired — the string exists, NOTHING enforces it, and it is filtered out of
 *                      the Roles page catalog (never rendered as a grantable pill).
 *   derived          — enforced TRANSITIVELY by its Rule-2 prerequisite; no gate of its
 *                      own. `margin:read` is the only member (R9).
 */
export type PermissionStatus = 'enforced' | 'declared-unwired' | 'derived';

/**
 * How confidential a READ is (spec §4).
 *   operational  — granted to MANAGER by default.
 *   confidential — an owner GRANT, off by default; granting it shows the HARD warning.
 *   owner-only   — never a grantable pill; authority comes from businesses.owner_id.
 */
export type PermissionSensitivity = 'operational' | 'confidential' | 'owner-only';

/** What a legacy string becomes under the new model (build-plan §2, "Fate" column). */
export type LegacyFate =
  | 'rename'          // 1:1 — one legacy string, one resource:verb
  | 'split'           // 1→many
  | 'retire'          // no replacement; the string ceases to exist
  | 'sentinel'        // not a permission at all (the `owner-only` route sentinel)
  | 'unmapped-orphan'; // in LIVE member arrays, read by NOTHING (A1.1)

export interface ManifestEntry {
  /** The full string, e.g. `deliveries.route:update`. */
  permission: string;
  /** Everything before the LAST colon — may contain dots. */
  resource: string;
  /** Everything after the LAST colon. */
  verb: string;
  status: PermissionStatus;
  sensitivity: PermissionSensitivity;
  /** TRUE when the spec marks this verb "✓ server" — enforced by an RPC/api gate, not a policy. */
  server: boolean;
  /** Class 1 — STRUCTURAL (Rule 1). Generated: update/delete require read. */
  structural: string[];
  /** Class 2 — CONTENT (Rule 2). Declared per-entry. */
  content: string[];
  /** Class 3 — INHERITANCE (Rule 3). A dotted sub-resource requires its parent's read. */
  inheritance: string[];
  /** Why this entry carries the status/sensitivity it does. */
  note?: string;
}

export interface LegacyEntry {
  legacy: string;
  /** The resource:verb string(s) this decomposes into. EMPTY for retire/sentinel/orphan. */
  replacements: string[];
  fate: LegacyFate;
  /**
   * TRUE if nothing enforces this string TODAY. Drives HIDDEN_PERMISSIONS, which is the
   * exact replacement for UNWIRED_ACTION_PERMISSIONS + UNWIRED_REGISTRY_PERMISSIONS.
   * ⚠️ WIRING ONE = FLIP THIS TO FALSE in the SAME commit its enforcement lands.
   */
  unwired: boolean;
  /** Evidence: what enforces it today, or the documented absence of enforcement. */
  evidence: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// THE PARSE RULE — written ONCE, used by every consumer (spec §6)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Split a permission on the LAST colon. Resource names may contain DOTS
 * (`deliveries.route:read` → resource `deliveries.route`, verb `read`), so a naive
 * split on the FIRST colon is wrong. Returns null for a string with no colon (every
 * legacy string, e.g. `view_costs`) — legacy strings are not resource:verb and must
 * not be forced into that shape.
 */
export function splitPermission(permission: string): { resource: string; verb: string } | null {
  const i = permission.lastIndexOf(':');
  if (i <= 0 || i === permission.length - 1) return null;
  return { resource: permission.slice(0, i), verb: permission.slice(i + 1) };
}

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 1 — THE MODEL (spec §3)
// ════════════════════════════════════════════════════════════════════════════════
//
// A verb the spec marks with a DASH DOES NOT APPEAR HERE — not as an entry, not as a
// commented-out entry, not as a "future" list. `customers:delete` must be UNFINDABLE by
// grep in this file. That is what makes R2's dashes real (verifier assertion 5).
//
// THE FIVE UNMINTABLE DELETES (R2 + A3, all five tombstone-verified 2026-07-26):
//   customers · service_offerings · deliveries · campaigns · assets
// A `status` column is NOT a tombstone. customers/deliveries/campaigns each HAVE a
// `status` column, and it carries LIFECYCLE meaning (pending/delivered, draft/ended). A
// tombstone is column + writer RPC + ledger row + audit row + read filters — what
// soft_delete_inventory is and these have none of. A future delete build adds a SEPARATE
// tombstone column; overloading lifecycle would be one column carrying two facts, which
// is the STD-011 defect this program exists to end.
//
// `audit_log:create` takes NO ENTRY (spec §3): audit rows are written ONLY inside the
// funnel/RPCs as a side effect of an audited action. No member ever holds it. It is a
// SYSTEM WRITER and is exempt from verifier assertion 2.

interface EntrySeed {
  verbs: string[];
  /**
   * Verbs the spec marks "✓ server" (§3): enforcement is a SECURITY DEFINER RPC or the api
   * layer's caller gate, NOT a member table policy. Declaring them is what lets the verifier
   * tell a DELIBERATE server-authoritative path apart from a missing gate — the difference
   * between "the checkout writes with the service key after proving the caller" and "nobody
   * gated this". A server verb still exists and is still grantable; only its ENFORCEMENT LAYER
   * differs, and STD-020 requires that layer be stated, not inferred.
   */
  server?: string[];
  sensitivity: PermissionSensitivity;
  status?: PermissionStatus | Partial<Record<string, PermissionStatus>>;
  content?: Record<string, string[]>;
  inheritance?: string[];
  note?: string;
}

const RESOURCES: Record<string, EntrySeed> = {
  // ── the order family (spec §3) ────────────────────────────────────────────────
  orders: {
    verbs: ['read', 'create', 'update', 'delete'],
    server: ['create', 'update', 'delete'],
    sensitivity: 'operational',
    note:
      'create is server-authoritative (checkout RPC). update/delete are REAL and ' +
      'server-enforced TODAY at packages/cultivar-os/api/orders/submit.ts 1005 ' +
      '(handleUpdate), 1292 (handleStatus), 1223 (handleDelete) via callerCanManageOrders ' +
      '— the corrected manage_orders mapping. NOTE (A1.2): that gate falls through to ' +
      'businesses.owner_id FIRST (submit.ts:37), so the OWNER passes with no member-row ' +
      'dependency; a MANAGER passes only by holding the string.',
  },
  order_items: {
    verbs: ['read', 'create', 'update', 'delete'],
    server: ['create', 'update', 'delete'],
    sensitivity: 'operational',
    note: 'lifecycle owned by the order RPCs; read is the member-facing verb.',
  },
  order_service_selections: {
    verbs: ['read', 'create', 'update', 'delete'],
    server: ['create', 'update', 'delete'],
    sensitivity: 'operational',
    note: 'the netting/add-ons on an order; same lifecycle as order_items.',
  },
  order_compliance_records: {
    // delete — : effectively write-once at sale (the Regina netting-warning record).
    verbs: ['read', 'create', 'update'],
    server: ['create', 'update'],
    sensitivity: 'operational',
    note: 'the netting-warning record (Regina anchor); write-once at sale, so no delete verb.',
  },

  // ── customers (R2 — NO delete verb) ──────────────────────────────────────────
  customers: {
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    status: { read: 'enforced', create: 'declared-unwired', update: 'declared-unwired' },
    note:
      'R2: no delete verb — no tombstone (the `status` column is lifecycle, not a ' +
      'tombstone; A3). A future customers:delete is a scoped build gated on first ' +
      'answering the FK-cascade query. create/update are declared-unwired until the N5 ' +
      'member WRITE policy lands (Phase 2) — customers_member is SELECT-only today.',
  },

  // ── the sell-side menu (R2 — NO delete verb) ─────────────────────────────────
  service_offerings: {
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    status: { read: 'enforced', create: 'declared-unwired', update: 'declared-unwired' },
    note:
      'read is the membership-gated sell-side catalog (map Note B — printed to the ' +
      'customer, carries no cost/margin column). Writes are owner-only today, so ' +
      'create/update gate nothing a member can hold. R2: no delete verb — retire-by-flag ' +
      'is the likely eventual shape.',
  },

  // ── inventory — the big split, and the ONE real tombstone ────────────────────
  inventory: {
    verbs: ['read', 'create', 'update', 'delete'],
    sensitivity: 'operational',
    note:
      'business_inventory. delete is REAL and it TOMBSTONES: soft_delete_inventory sets ' +
      "status='deleted', zeroes qty, and writes BOTH a ledger row and an audit row " +
      '(20260720). This is the pattern the other resources must match before they earn a ' +
      'delete verb. `read` returns identity/operational fields; unit_cost moves behind ' +
      'costs:read at Phase 3b (spec §4 — the field-level split).',
  },
  inventory_ledger: {
    // create/update/delete — : append-only. The immutability trigger rejects even postgres.
    verbs: ['read'],
    sensitivity: 'operational',
    note:
      'append-only (D-50). create is via the movement RPCs, never direct; update/delete ' +
      'are structurally blocked by the immutability trigger for EVERYONE including postgres ' +
      '— absent by design, not by grant.',
  },

  // ── deliveries + its sub-resource (R2 — NO delete verb) ──────────────────────
  deliveries: {
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    note:
      'R2: no delete verb — no tombstone (the `status` column is lifecycle: ' +
      'pending/delivered; A3). Table is membership-only today while the ROUTE checks a ' +
      'permission — disagreement N3, closed in Phase 2.',
  },
  'deliveries.route': {
    // create/delete — : a route has no independent existence apart from its deliveries.
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    inheritance: ['deliveries:read'],
    note:
      'SUB-RESOURCE of deliveries (the dotted name signals the parent). Rule 3: any ' +
      'deliveries.route:* grant requires deliveries:read — no deliveries, no route. Kept ' +
      'as a sub-resource rather than a peer for exactly that reason.',
  },

  // ── assets + pmi (R4 — operational, NOT financial) ───────────────────────────
  assets: {
    // delete — : A3, tombstone query returned NOTHING for business_assets.
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    note:
      'business_assets — trucks, equipment. Operational, not financial: the table is ' +
      'already membership-gated and only the ROUTE is view_costs-stricter (disagreement ' +
      'N4). A3: the tombstone query returned NOTHING — no deleted_at, no is_deleted, no ' +
      'status, no archived_at — so assets:delete DOES NOT MINT. It joins the unmintable five.',
  },
  pmi: {
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    note:
      'business_pmi_schedule — service cadence and due dates. read+update (you do not ' +
      'create or delete a schedule slot as an authority act). This is the parent ' +
      'maintenance:override hangs from (R4).',
  },

  // ── the narrow money reads (spec §4 / §5) ────────────────────────────────────
  tax_rate: {
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    status: { read: 'enforced', update: 'declared-unwired' },
    note:
      "a single value inside business_pricing_config. The READ exists as a narrow " +
      'SECURITY DEFINER function (get_business_tax_rate, applied 2026-07-24) returning ' +
      "ONLY config->>'taxRate' — NEVER the recipe. The WRITE does not exist yet " +
      '(set_business_tax_rate, Phase 1), hence declared-unwired.',
  },
  pricing_recipe: {
    verbs: ['read', 'update'],
    sensitivity: 'confidential',
    note:
      'baseline margin, reference price, markup — the confidential recipe inside ' +
      'business_pricing_config. THE LEVER: this is the only write path that moves margin ' +
      'health (spec §4.1). Owner-confidential; the moat (D-009).',
  },
  costs: {
    verbs: ['read', 'create', 'update', 'delete'],
    sensitivity: 'confidential',
    note: 'cost_objects, receipts — cost basis / unit cost. Confidential.',
  },
  margin: {
    // create/update/delete — : margin is COMPUTED, never stored. The lever is the recipe.
    verbs: ['read'],
    sensitivity: 'confidential',
    status: 'derived',
    content: { read: ['costs:read'] },
    note:
      'the R/Y/G health signal — a computed judgment, not stored data. STATUS `derived` ' +
      '(R9): margin has no table, no policy and no RPC; the only thing enforcing it is a ' +
      'client-side filter, and render-only is not enforcement. But margin is computed FROM ' +
      'unit_cost, which IS server-gated, so a member without costs:read cannot produce the ' +
      'verdict regardless of what the client hands them. Rule 2 makes that structural. ' +
      'THERE IS DELIBERATELY NO margin:update — you do not edit a verdict, you edit the ' +
      'recipe and the signal recomputes (spec §4.1).',
  },
  wages: {
    verbs: ['read', 'create', 'update', 'delete'],
    sensitivity: 'confidential',
    note: "labor_resource_wages. Confidential; Andrew's case (read without write).",
  },

  // ── business surfaces ────────────────────────────────────────────────────────
  settings: {
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    note: 'business profile — name, address, hours. read+update.',
  },
  campaigns: {
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    status: { read: 'enforced', create: 'declared-unwired', update: 'enforced' },
    note:
      'R2: no delete verb — no tombstone (the `status` column is lifecycle: draft/ended; ' +
      "A3) and per David's ruling LIKELY NEVER: a deleted campaign destroys its own " +
      'history. read/update ride manage_campaigns at the route today; the tables are ' +
      'owner-only (disagreements N1/N2), closed in Phase 4.',
  },
  team: {
    verbs: ['read', 'create', 'update', 'delete'],
    sensitivity: 'owner-only',
    status: { read: 'enforced', create: 'declared-unwired', update: 'declared-unwired', delete: 'declared-unwired' },
    note:
      'business_members + role_definitions. WRITE is the permission FUNNEL ONLY (#152) — ' +
      'direct writes are blocked by the authority-immutability trigger, so no member-held ' +
      'string authorizes them. Granting/revoking is itself an owner-only capability.',
  },
  audit_log: {
    // create — : NOT a grantable user verb. System-only writer (spec §3). No entry.
    // update/delete — : structurally blocked by the immutability trigger.
    verbs: ['read'],
    sensitivity: 'owner-only',
    note:
      'read is owner-only BY DESIGN (accountability). `create` is deliberately absent from ' +
      'this manifest: audit rows are written only inside the funnel/RPCs as a side effect ' +
      'of an audited action, so no member ever holds audit_log:create and the audit_insert ' +
      'policy is exempt from verifier assertion 2 as a SYSTEM WRITER.',
  },
};

/**
 * CAPABILITY VERBS (spec §3, second table) — named authorities that are not CRUD on a
 * resource. First-class permission strings obeying the same manifest rules.
 */
const CAPABILITY_VERBS: Record<string, Omit<ManifestEntry, 'resource' | 'verb' | 'server'>> = {
  'inventory:import_price': {
    permission: 'inventory:import_price',
    status: 'enforced',
    sensitivity: 'operational',
    structural: [],
    content: ['inventory:update'],
    inheritance: [],
    note:
      'BULK price write from a CSV — a BLAST-RADIUS authority, distinct from single-cell ' +
      'edits, not a new price authority. ENFORCED server-side: the import_write_price RPC ' +
      'checks has_permission_for on the PASSED actor (20260723). Bulk write requires ' +
      'single write (Rule 2 in spirit).',
  },
  'tax_exempt:apply': {
    permission: 'tax_exempt:apply',
    status: 'enforced',
    sensitivity: 'operational',
    structural: [],
    content: ['orders:create'],
    inheritance: [],
    note:
      'zero an order tax via a documented exemption (D-40), reason REQUIRED. ENFORCED at ' +
      'submit.ts:298, token-verified and tamper-defended — an anon/public checkout can ' +
      'never self-exempt.',
  },
  'order_discount:apply': {
    permission: 'order_discount:apply',
    status: 'declared-unwired',
    sensitivity: 'operational',
    structural: [],
    content: ['orders:create'],
    inheritance: [],
    note:
      'price-tier invoke + per-service price override at checkout. DECLARED-UNWIRED: the ' +
      'gate EXISTS at submit.ts:238 but checks manage_orders, so this string enforces ' +
      'nothing of its own — the fake-pill state. Made real in Phase 5 (re-point + the ' +
      'missing audit_log row). R8: the dependency is orders:CREATE, not orders:update — ' +
      'the discount is carried ENTIRELY by the INSERT (handleSubmit 196→562); handleUpdate ' +
      'accepts no tier and no overrides, so you cannot discount an order by editing it. ' +
      'Depending on orders:update would grant that verb (and via Rule 1, orders:read) ' +
      'purely to satisfy a paper prerequisite — a silent widening of access. The ' +
      '"discounting is a manager act" force lives in the default bundle, where this is OFF.',
  },
  'maintenance:override': {
    permission: 'maintenance:override',
    status: 'declared-unwired',
    sensitivity: 'operational',
    structural: [],
    content: ['pmi:read'],
    inheritance: [],
    note:
      'authorize an asset to be used with overdue PMI. DECLARED-UNWIRED (R6): NOTHING IN ' +
      'THE APP BLOCKS ON AN OVERDUE PMI, so there is no feature to override. An override ' +
      'permission with nothing to override is not a permission — it is a name. Hidden from ' +
      'the Roles page until the block is built; its dependency is dormant until then.',
  },
};

/** Build the model: four verbs per resource except where a verb is structurally absent. */
function buildManifest(): Record<string, ManifestEntry> {
  const out: Record<string, ManifestEntry> = {};
  for (const [resource, seed] of Object.entries(RESOURCES)) {
    for (const verb of seed.verbs) {
      const permission = `${resource}:${verb}`;
      const status: PermissionStatus =
        typeof seed.status === 'string'
          ? seed.status
          : (seed.status?.[verb] as PermissionStatus | undefined) ?? 'enforced';
      out[permission] = {
        permission,
        resource,
        verb,
        status,
        sensitivity: seed.sensitivity,
        // Class 1 — STRUCTURAL. Generated, never hand-listed: modify requires read.
        // `create` requires NOTHING (R1) — deliberately, and the verifier must not
        // flag create-without-read as an error.
        structural: verb === 'update' || verb === 'delete' ? [`${resource}:read`] : [],
        server: (seed.server ?? []).includes(verb),
        content: seed.content?.[verb] ?? [],
        inheritance: seed.inheritance ?? [],
        note: seed.note,
      };
    }
  }
  for (const [permission, entry] of Object.entries(CAPABILITY_VERBS)) {
    const parts = splitPermission(permission)!;
    out[permission] = { ...entry, server: true, resource: parts.resource, verb: parts.verb };
  }
  return out;
}

/** THE MODEL — every resource:verb and capability verb, keyed by the full string. */
export const PERMISSION_MANIFEST: Record<string, ManifestEntry> = buildManifest();

/** Every modelled permission string, in declaration order. */
export const ALL_MODEL_PERMISSIONS: string[] = Object.keys(PERMISSION_MANIFEST);

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 2 — THE LEGACY REGISTER (build-plan §2) — seeds `permission_aliases`
// ════════════════════════════════════════════════════════════════════════════════
//
// 19 rows from §2 (18 permission strings + the owner-only route sentinel), PLUS the two
// orphans §2 missed. §2's inventory was built from CODE and never checked against DATA —
// process_orders and manage_team are in LIVE member arrays and in no plan document.
//
// THREE ROWS PRODUCE NO ALIAS PAIRS, and that is arithmetic, not omission:
//   view_dashboard (retire) · view_reports (retire) · owner-only (sentinel)
// A retired string has no resource:verb on the other side; a route sentinel is not a
// permission. 16 of the 19 are mappable. The two orphans add no pairs either (nothing
// reads them) — they are stripped at backfill, not aliased (R-B).

export const LEGACY_PERMISSIONS: LegacyEntry[] = [
  {
    legacy: 'view_dashboard',
    replacements: [],
    fate: 'retire',
    unwired: false,
    evidence:
      '4 tiles + 2 IA nodes in tileRegistry.ts; router.tsx:113 calls it "OPEN to every ' +
      'authenticated session". R3: it grants nothing a member lacks → folds into ' +
      'is_active_member and RETIRES. No alias pair — there is nothing on the other side.',
  },
  {
    legacy: 'qr_checkout',
    replacements: ['orders:create'],
    fate: 'rename',
    unwired: false,
    evidence: 'route /orders* (router.tsx:134) + the qr_checkout tile.',
  },
  {
    legacy: 'view_orders',
    replacements: [
      'orders:read',
      'order_items:read',
      'order_service_selections:read',
      'order_compliance_records:read',
    ],
    fate: 'split',
    unwired: false,
    evidence: '4 RLS SELECT policies, all checking view_orders (20260724: 65, 79, 101, 115).',
  },
  {
    legacy: 'manage_orders',
    replacements: ['orders:update', 'orders:delete'],
    fate: 'split',
    unwired: false,
    evidence:
      'REAL, NOT THEATER — packages/cultivar-os/api/orders/submit.ts 1005 (update), 1292 ' +
      '(status), 1223 (delete) via callerCanManageOrders. Two prior analyses called it ' +
      'vestigial because they scanned RLS and routes but NOT the api layer — the third ' +
      'enforcement layer STD-020 names.',
  },
  {
    legacy: 'manage_deliveries',
    replacements: [
      'deliveries:read',
      'deliveries:update',
      'deliveries.route:read',
      'deliveries.route:update',
    ],
    fate: 'split',
    unwired: false,
    evidence:
      'route only (router.tsx:141); deliveries_member_all is MEMBERSHIP-only, so the ' +
      'string is theater AT THE DATA LAYER — disagreement N3, wired in Phase 2.',
  },
  {
    legacy: 'manage_customers',
    replacements: ['customers:create', 'customers:update'],
    fate: 'split',
    unwired: true,
    evidence:
      'NOTHING enforces it — a grantable pill reaching no capability. HIDDEN at #153 ' +
      '(reversible default) pending N5, which is the customer WRITE policy and Lauren\'s ' +
      'actual job at LAWNS.',
  },
  {
    legacy: 'view_customers',
    replacements: ['customers:read'],
    fate: 'rename',
    unwired: false,
    evidence: 'customers_member SELECT (20260710:36) + the route (router.tsx:211).',
  },
  {
    legacy: 'manage_campaigns',
    replacements: ['campaigns:read', 'campaigns:update'],
    fate: 'split',
    unwired: false,
    evidence:
      'route only (router.tsx:149); campaigns/social_drafts tables are OWNER-only — the ' +
      'two remaining open-at-the-door-locked-at-the-vault gaps (N1/N2), closed in Phase 4.',
  },
  {
    legacy: 'manage_settings',
    replacements: [
      'settings:read',
      'settings:update',
      'team:read',
      'team:update',
      'pricing_recipe:update',
    ],
    fate: 'split',
    unwired: false,
    evidence:
      'routes /settings, /admin, /team, /discounts (router.tsx:161); 8 settings tiles + ' +
      'qb_status. The /discounts surface is why pricing_recipe:update is in this split.',
  },
  {
    legacy: 'view_reports',
    replacements: [],
    fate: 'retire',
    unwired: true,
    evidence:
      'NOTHING enforces it; one status:"planned", nav_eligible:false tile. STEP 0 at #153 ' +
      'found no live surface consumes it → HIDDEN, and now RETIRED. No alias pair.',
  },
  {
    legacy: 'view_costs',
    replacements: [
      'inventory:read',
      'inventory:create',
      'inventory:update',
      'inventory:delete',
      'costs:read',
      'costs:create',
      'costs:update',
      'costs:delete',
      'inventory_ledger:read',
      'assets:read',
      'assets:create',
      'assets:update',
      'pmi:read',
      'pmi:update',
    ],
    fate: 'split',
    unwired: false,
    evidence:
      'THE BIG SPLIT — 6 *_member_all FOR ALL policies (20260622:141-152): ' +
      'business_inventory, cost_objects/_edges/_assignments, business_service_log, ' +
      'receipts; routes /inventory*, /receipts, /assets*, /operating-costs, /pmi; 6 tiles. ' +
      'One coarse string meaning FOR ALL becomes 14 verbs across 5 resources.',
  },
  {
    legacy: 'view_pricing_config',
    replacements: ['pricing_recipe:read', 'pricing_recipe:update'],
    fate: 'split',
    unwired: false,
    evidence: 'business_pricing_config member policy — the moat (D-009), stays confidential.',
  },
  {
    legacy: 'view_wages',
    replacements: ['wages:read', 'wages:create', 'wages:update', 'wages:delete'],
    fate: 'split',
    unwired: false,
    evidence: 'labor_resources / labor_resource_wages. Stays confidential.',
  },
  {
    legacy: 'view_margin',
    replacements: ['margin:read'],
    fate: 'rename',
    unwired: false,
    evidence:
      'applyFinancialDependencies (client-side) — Rule 2\'s EXISTING implementation. The ' +
      'dependency is implemented; the GATE is not. Hence status `derived` (R9).',
  },
  {
    legacy: 'override_maintenance',
    replacements: ['maintenance:override'],
    fate: 'rename',
    unwired: true,
    evidence: 'NOTHING enforces it — the PMI block it would gate does not exist (R6).',
  },
  {
    legacy: 'apply_tax_exempt',
    replacements: ['tax_exempt:apply'],
    fate: 'rename',
    unwired: false,
    evidence: 'submit.ts:298 via callerCanApplyTaxExempt — token-verified, tamper-defended.',
  },
  {
    legacy: 'apply_discount',
    replacements: ['order_discount:apply'],
    fate: 'rename',
    unwired: true,
    evidence:
      'declared only — the discount path actually rides manage_orders at submit.ts:238. ' +
      'Made real in Phase 5.',
  },
  {
    legacy: 'import_pricing',
    replacements: ['inventory:import_price'],
    fate: 'rename',
    unwired: false,
    evidence: 'import_write_price RPC (20260723:123) — real, server-enforced, 3 owner-test cards.',
  },
  {
    legacy: 'owner-only',
    replacements: [],
    fate: 'sentinel',
    unwired: false,
    evidence:
      'router.tsx:199 + 3 tiles. NOT A PERMISSION — resolved from businesses.owner_id, ' +
      'never from the permissions array. No alias pair.',
  },

  // ── A1.1 — THE TWO ORPHANS §2 MISSED (in live arrays, read by NOTHING) ────────
  {
    legacy: 'process_orders',
    replacements: [],
    fate: 'unmapped-orphan',
    unwired: true,
    evidence:
      'MINTED at packages/cultivar-os/src/pages/SignUp.tsx:34 and AddBusiness.tsx:23 ' +
      '(ownerPermissions literal) and present in live OWNER arrays. READ BY NOTHING: zero ' +
      'hits across supabase/migrations, router.tsx, tileRegistry.ts, packages/cultivar-os/api ' +
      'and packages/shared/src (grepped 2026-07-26). NO ALIAS PAIR — stripped at backfill (R-B). ' +
      '⚠️ The two mint sites still inject it: Phase 7 zero-check cannot stay green until ' +
      'they read the resolved floor, as Settings.tsx/OnboardingWizard.tsx already do (#152).',
  },
  {
    legacy: 'manage_team',
    replacements: [],
    fate: 'unmapped-orphan',
    unwired: true,
    evidence:
      'Same two mint sites (SignUp.tsx:34, AddBusiness.tsx:23) and live OWNER arrays. READ ' +
      'BY NOTHING in Cultivar — team authority is the D-50 funnel (owner-resolved), not a ' +
      'string. Distinct from Ignition\'s manage_team, which is out of scope (donor-only, ' +
      'not multi-tenant-RLS). NO ALIAS PAIR — stripped at backfill (R-B).',
  },
];

/**
 * THE ALIAS PAIRS — the exact content of `permission_aliases`, BOTH DIRECTIONS.
 * The SQL seed mirrors this; if they disagree, this is the source.
 *
 * ⚠️ REVERSE RESOLUTION ON A 1→many SPLIT IS A REAL, TEMPORARY WIDENING. A holder of
 * `inventory:read` satisfies a `view_costs` policy, which during the window also admits
 * cost_objects / receipts. Two invariants close it, and BOTH must hold:
 *   (i)  BACKFILL IS RENAME-ONLY (R-A) — no member receives a string whose legacy
 *        antecedent they did not already hold. NO BUNDLE SEEDING.
 *   (ii) ALL CAPABILITY FLIPS (Phases 1–5) COMPLETE BEFORE BACKFILL (Phase 6) — so no
 *        legacy policy survives for the reverse direction to resolve into.
 * Anyone later seeding default bundles into an EXISTING tenant breaks (i) and reopens
 * this. That is why the note also lives on the table itself.
 */
export const ALIAS_PAIRS: Array<{ from: string; implies: string }> = LEGACY_PERMISSIONS.flatMap(
  (e) =>
    e.replacements.flatMap((r) => [
      { from: e.legacy, implies: r }, // forward: legacy holder passes a new-string check
      { from: r, implies: e.legacy }, // reverse: new-string holder passes a legacy check
    ]),
);

/** Legacy strings that map to at least one resource:verb (the 16 of 19). */
export const MAPPABLE_LEGACY: string[] = LEGACY_PERMISSIONS.filter(
  (e) => e.replacements.length > 0,
).map((e) => e.legacy);

/**
 * Strings STRIPPED at backfill, not aliased — three classes (R-B), each audited through
 * the funnel. Carrying any of these forward would create an INVISIBLE grant: a
 * declared-unwired string is filtered out of the Roles page, so a member would hold
 * something no screen can show or revoke.
 */
export const STRIPPED_AT_BACKFILL: Record<'retired' | 'unwired' | 'unmapped', string[]> = {
  retired: LEGACY_PERMISSIONS.filter((e) => e.fate === 'retire').map((e) => e.legacy),
  unwired: ['override_maintenance'],
  unmapped: LEGACY_PERMISSIONS.filter((e) => e.fate === 'unmapped-orphan').map((e) => e.legacy),
};

// ════════════════════════════════════════════════════════════════════════════════
// THE ROLES-PAGE FILTER — the single replacement for the two UNWIRED lists
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Strings that must NOT render as a grantable pill. ONE list, derived from the two
 * declarations that own the fact (STD-011 — this replaces UNWIRED_ACTION_PERMISSIONS and
 * UNWIRED_REGISTRY_PERMISSIONS, which were two ad-hoc lists of one thing):
 *   · a LEGACY entry flagged `unwired: true`  (nothing enforces it today)
 *   · a MODEL entry with status `declared-unwired` (spec §7.1)
 *   · the `owner-only` route sentinel (never a member-held permission)
 * ⚠️ WIRING ONE = flip its `unwired`/`status` in the SAME commit its enforcement lands.
 */
export const HIDDEN_PERMISSIONS: string[] = [
  'owner-only',
  ...LEGACY_PERMISSIONS.filter((e) => e.unwired && e.fate !== 'unmapped-orphan').map((e) => e.legacy),
  ...Object.values(PERMISSION_MANIFEST)
    .filter((e) => e.status === 'declared-unwired')
    .map((e) => e.permission),
];

// ════════════════════════════════════════════════════════════════════════════════
// THE DEFAULT BUNDLES (spec §5) — SEED DATA FOR A FRESH ROLE, NOT A MIGRATION TARGET
// ════════════════════════════════════════════════════════════════════════════════
//
// 🔴 R-A: THESE ARE NOT BACKFILL INPUTS. They seed a FRESH role. The live tenant is
// backfilled RENAME-ONLY from what each member's array actually holds. Live STAFF holds
// no inventory:read; MANAGER_DEFAULT_BUNDLE/STAFF_DEFAULT_BUNDLE contain strings no live
// member holds, and seeding them into an existing tenant would GRANT those strings — and
// reopen the alias widening documented on ALIAS_PAIRS. Any divergence between a live
// array and a bundle is a SEPARATE owner act through the funnel, AFTER Contract, with its
// own audit row. Backfill never silently means re-permission.

/** MANAGER — on by default (spec §5). A starting grant, changeable verb-by-verb. */
export const MANAGER_DEFAULT_BUNDLE: string[] = [
  'orders:read', 'orders:create', 'orders:update',
  'order_items:read',
  'order_service_selections:read',
  'order_compliance_records:read',
  'customers:read', 'customers:create', 'customers:update',
  'service_offerings:read',
  'inventory:read', 'inventory:create', 'inventory:update',
  'inventory_ledger:read',
  'deliveries:read', 'deliveries:update',
  'deliveries.route:read', 'deliveries.route:update',
  'assets:read', 'assets:create', 'assets:update',
  'pmi:read', 'pmi:update',
  'tax_rate:read', 'tax_rate:update',
  'settings:read', 'settings:update',
  'campaigns:read', 'campaigns:update',
];

/**
 * STAFF — the small subset (spec §5).
 * ⚠️ STAFF DELIBERATELY DOES NOT HOLD `orders:read` (R1). This is the Note A split: a
 * seasonal hire can TAKE an order at the tag and cannot browse the business's order
 * history — customer names, totals, discounts. Rule 1 permits it because create never
 * requires read. The Roles page surfaces it as a deliberate choice, and a negative
 * owner-test card proves it stays true.
 */
export const STAFF_DEFAULT_BUNDLE: string[] = ['orders:create', 'inventory:read'];

/** Fresh-role seed by role key. OWNER is absent BY DESIGN — owner authority is owner_id. */
export const DEFAULT_BUNDLES: Record<string, string[]> = {
  MANAGER: MANAGER_DEFAULT_BUNDLE,
  STAFF: STAFF_DEFAULT_BUNDLE,
};

// ════════════════════════════════════════════════════════════════════════════════
// DEPENDENCIES (spec §6) — the three classes, and the rule that create is FREE
// ════════════════════════════════════════════════════════════════════════════════

/** Every prerequisite of a permission, across all three classes. */
export function dependenciesOf(permission: string): string[] {
  const e = PERMISSION_MANIFEST[permission];
  if (!e) return [];
  return [...e.structural, ...e.content, ...e.inheritance];
}

/**
 * A grant of `R:create` WITHOUT `R:read` — legitimate but unusual (R1). NOT a violation:
 * the verifier reports it so the Roles page can name the state ("takes orders, cannot
 * browse them") as a DELIBERATE CHOICE. An intentional asymmetry that looks like a
 * mistake will eventually be "fixed" by someone who does not know it was on purpose.
 */
export function createWithoutRead(permissions: string[]): string[] {
  const held = new Set(permissions);
  return permissions.filter((p) => {
    const parts = splitPermission(p);
    return parts?.verb === 'create' && !held.has(`${parts.resource}:read`);
  });
}

/**
 * Every unmet prerequisite in a permission set, as `dependent → missing` pairs.
 * `create`-without-`read` is NEVER reported here (R1) — see createWithoutRead.
 */
export function unmetDependencies(permissions: string[]): Array<{ permission: string; missing: string }> {
  const held = new Set(permissions);
  const out: Array<{ permission: string; missing: string }> = [];
  for (const p of permissions) {
    for (const need of dependenciesOf(p)) {
      if (!held.has(need)) out.push({ permission: p, missing: need });
    }
  }
  return out;
}

/**
 * Enforce CONTENT dependencies (Rule 2) on an effective permission set — the judgment is
 * never surfaced to a session denied its basis. Pure; does not mutate.
 *
 * ⚠️ NEUTRALITY: this is the exact successor of financialPermissions.applyFinancialDependencies
 * and it reproduces that behavior for the LEGACY vocabulary (view_margin stripped when
 * view_costs is absent) while also covering the new vocabulary (margin:read stripped when
 * costs:read is absent). Same shape, one implementation, both vocabularies.
 */
export function applyPermissionDependencies(permissions: string[]): string[] {
  const held = new Set(permissions);
  return permissions.filter((p) => {
    // legacy pair — kept until CONTRACT retires the string
    if (p === VIEW_MARGIN && !held.has(VIEW_COSTS)) return false;
    // new vocabulary — the same rule, declared in the manifest
    const content = PERMISSION_MANIFEST[p]?.content ?? [];
    return content.every((need) => held.has(need));
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// THE LEGACY STRING CONSTANTS — one home for the migration window
// ════════════════════════════════════════════════════════════════════════════════
//
// These were spread across financialPermissions.ts, actionPermissions.ts and roles.ts.
// They live HERE now, and they stay until Phase 7 CONTRACT drops them. Every gate in the
// repo still checks these strings — Phase 0 flips NO gate. Deleting them today would not
// be a simplification, it would be a behavior change with a permission model attached.

/** Operational unit_cost (/costs, /inventory, /assets, /operating-costs). SHAPING. */
export const VIEW_COSTS = 'view_costs';
/** The pricing recipe / moat. HARD WALL. */
export const VIEW_PRICING_CONFIG = 'view_pricing_config';
/** HR pay — labor_resources wage columns. HARD WALL. */
export const VIEW_WAGES = 'view_wages';
/** The margin verdict. SHAPING. REQUIRES view_costs. */
export const VIEW_MARGIN = 'view_margin';
/** Read this business's customers (roster + order-entry lookup/attach). */
export const VIEW_CUSTOMERS = 'view_customers';
/** Defer/use an asset against its PMI schedule. Mechanism NOT built (R6). */
export const OVERRIDE_MAINTENANCE = 'override_maintenance';
/** Zero an order's tax via a documented exemption (D-40). Server-enforced. */
export const APPLY_TAX_EXEMPT = 'apply_tax_exempt';
/** Apply a discount / price override on an order. Rides manage_orders today. */
export const APPLY_DISCOUNT = 'apply_discount';
/** Bulk-import the catalog's PRICES from a CSV. Server-enforced (import_write_price). */
export const IMPORT_PRICING = 'import_pricing';

/**
 * Every legacy string, by its old identifier name. This is the successor of
 * `packages/cultivar-os/src/auth/roles.ts` PERMISSIONS — the fifth representation STD-011
 * folds in. Route gates and tile registrations read from here until Phase 7 CONTRACT.
 * ⚠️ Adding a string here does NOT make it enforced; add it to LEGACY_PERMISSIONS with
 * its evidence, or the verifier will flag it as a fake pill.
 */
export const LEGACY_PERMISSION = {
  VIEW_DASHBOARD:    'view_dashboard',
  QR_CHECKOUT:       'qr_checkout',
  VIEW_ORDERS:       'view_orders',
  MANAGE_ORDERS:     'manage_orders',
  MANAGE_DELIVERIES: 'manage_deliveries',
  MANAGE_CUSTOMERS:  'manage_customers',
  MANAGE_CAMPAIGNS:  'manage_campaigns',
  VIEW_REPORTS:      'view_reports',
  MANAGE_SETTINGS:   'manage_settings',
  VIEW_CUSTOMERS,
  VIEW_COSTS,
  VIEW_PRICING_CONFIG,
  VIEW_WAGES,
  VIEW_MARGIN,
  OVERRIDE_MAINTENANCE,
  APPLY_TAX_EXEMPT,
  APPLY_DISCOUNT,
  IMPORT_PRICING,
} as const;

/** The four financial strings, wall pair first then the shaping pair (stable order). */
export const ALL_FINANCIAL_PERMISSIONS: string[] = [
  VIEW_WAGES,
  VIEW_PRICING_CONFIG,
  VIEW_COSTS,
  VIEW_MARGIN,
];

/** Every behavior-gating action permission, in a stable order. */
export const ALL_ACTION_PERMISSIONS: string[] = [
  OVERRIDE_MAINTENANCE,
  VIEW_CUSTOMERS,
  APPLY_TAX_EXEMPT,
  APPLY_DISCOUNT,
  IMPORT_PRICING,
];

/** Every legacy string that exists today, including the two orphans (the CENSUS basis, R-C). */
export const ALL_LEGACY_PERMISSIONS: string[] = LEGACY_PERMISSIONS.map((e) => e.legacy);
