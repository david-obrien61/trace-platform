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
 * What enforces a string (spec §7.1). FOUR values — the fourth was added 2026-07-31 by David's
 * ruling, which is the ruling the old "do NOT add a fourth without one" comment was waiting for.
 *   enforced         — a policy, RPC, or api-layer gate checks this string, or checks a
 *                      legacy antecedent that resolves to it through the alias layer.
 *   declared-unwired — the string exists, NOTHING enforces it, and it is filtered out of
 *                      the Roles page catalog (never rendered as a grantable pill).
 *   derived          — enforced TRANSITIVELY by its Rule-2 prerequisite; no gate of its
 *                      own. `margin:read` is the only member (R9).
 *   planned          — the feature is SCOPED and NOT BUILT. The string will be enforced when it
 *                      ships. It RENDERS in the catalog, visually distinct, and is NOT GRANTABLE.
 *
 * ═══ WHY `planned` EXISTS (David's ruling, 2026-07-31) ═══
 * `declared-unwired` conflated two different facts, and the model contradicted itself in one
 * conversation because of it. The same morning's SIX-STATE ruling says BEING BUILT renders
 * distinctly with a "coming soon" hover; §7.1 then said an unwired string is FILTERED OUT of the
 * catalog. Opposite answers about the same string.
 *
 * David's resolution: **THE PILL IS REAL, THE FEATURE IS NOT BUILT — and that is not a fake pill.**
 * A fake pill claims something works when it does not. A PLANNED pill says a thing is coming,
 * which is TRUE, and it is the conversation starter: the customer sees it, taps it, and tells us
 * what they actually need from it before we build the wrong thing.
 *
 * `planned` and `declared-unwired` share the UN-GRANTABLE invariant and differ in rendering — a
 * counter-argument that was raised, and knowingly rejected: **they also differ in INTENT, and
 * intent is what a reader needs.** One is scoped and coming; the other is an accident or a
 * deliberate no. That is a semantic difference, not a presentational one.
 *
 * 🔴 THE FLOOR — `planned` REQUIRES A BUILD BEHIND IT (David, same ruling): a named gap, a card,
 * a slot, or a decision. Anything else STAYS `declared-unwired` until it earns the status.
 * Without that floor everything imaginable becomes `planned` and the distinction dies. This is
 * why `campaigns:create` is NOT planned — "the next verb is obvious" is not a scoped build.
 *
 * OPTION A WAS CHOSEN OVER a `roadmap: true` second axis, for the reason the week supplied: every
 * consumer here is status-keyed, and a second axis is a second thing to forget. Every drift paid
 * for this week came from two representations of one fact.
 */
export type PermissionStatus = 'enforced' | 'declared-unwired' | 'derived' | 'planned';

/**
 * THE `member` SENTINEL — a DECLARED ABSENCE OF REQUIREMENT (David, 2026-07-27).
 *
 * Not a permission and not a status: a fourth concept alongside enforced / declared-unwired /
 * derived. It is what R3 turned `view_dashboard` into. That string retired because it gated
 * nothing a member lacked — but seven navigation surfaces DECLARED it, and after the flip nobody
 * holds a retired string, so those surfaces would have VANISHED for every member. `member` says
 * the true thing instead: this surface requires membership and nothing more.
 *
 * `can()` returns true for it after the owner check (BusinessProvider.tsx). Reaching `can()` at
 * all means an active membership resolved for the business, so it is true BY CONSTRUCTION.
 *
 * 🔴 THEREFORE IT MUST NEVER BE GRANTABLE OR ENFORCEABLE. It may appear in EXACTLY ONE PLACE —
 * `tileRegistry.ts` `required_permission`. Never in a PermissionRoute (a route needing only
 * membership needs no gate — leave it ungated rather than gate it on a tautology). Never in an
 * RLS policy, an RPC, a role definition, or a default bundle: a string that returns true by
 * construction, sitting in a permissions array, reads as a granted capability and is not one.
 * Enforced by capQ assertion (c).
 */
export const MEMBERSHIP_SENTINEL = 'member';

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
  /** Roles-page section, declared on the resource seed. Never inferred from a tile. */
  category: string;
  /** Everything before the LAST colon — may contain dots. */
  resource: string;
  /** Everything after the LAST colon. */
  verb: string;
  status: PermissionStatus;
  /** §4 — what granting this hands over. Present on `confidential` entries; capQ (e) requires it. */
  exposure?: string;
  /**
   * TRUE when this resource's read is enforced at the ROUTE (and/or an RPC) rather than by a
   * member table policy — because the table read is membership-by-necessity. Declared, never
   * inferred: capP's assertion 1 would otherwise report a missing gate where the design is
   * deliberate. STD-020 wants the layer STATED, not identical everywhere.
   */
  routeEnforced?: boolean;
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
  /**
   * WHICH SECTION OF THE ROLES PAGE THIS RESOURCE'S PILLS LAND IN (David's ruling 2026-07-28).
   *
   * 🔴 DECLARED HERE, ON THE RESOURCE, AND NOWHERE ELSE. The Roles page used to group chips by
   * looking up a TILE that happened to gate on the same string — so the 31 permissions with no
   * tile (the whole order family, customers, every inventory and delivery WRITE) fell into a
   * bucket called "Other", and the page read as a curated list plus a dump. The obvious fix — a
   * category map in the component — would have been the SIXTH hand-maintained list duplicating
   * something derivable, shipped in the build that closed the fifth.
   *
   * Declaring it on the seed keeps ONE declaration per resource, in the object that already
   * declares everything else about it, and costs the UI nothing: a new resource lands in a real
   * section with NO UI EDIT. capP asserts every declared category appears in
   * PERMISSION_CATEGORY_ORDER, so a new one cannot silently fall off the page.
   */
  category: string;
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
  /**
   * REQUIRED on every `confidential` resource: the SPECIFIC exposure a grant creates, in the
   * owner's words. Rendered verbatim in the Roles-page confirm. Absent on operational resources.
   * capQ (e) FAILS when a confidential resource has none — a generic caution is not a warning.
   */
  exposure?: string;
  status?: PermissionStatus | Partial<Record<string, PermissionStatus>>;
  /**
   * TRUE when the read is enforced at the ROUTE (and/or an RPC) rather than by a member table
   * policy, because the table read is membership-BY-NECESSITY. Declared, never inferred.
   */
  routeEnforced?: boolean;
  content?: Record<string, string[]>;
  inheritance?: string[];
  note?: string;
}

const RESOURCES: Record<string, EntrySeed> = {
  // ── the order family (spec §3) ────────────────────────────────────────────────
  orders: {
    category: 'checkout',
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
    category: 'checkout',
    verbs: ['read', 'create', 'update', 'delete'],
    server: ['create', 'update', 'delete'],
    sensitivity: 'operational',
    note: 'lifecycle owned by the order RPCs; read is the member-facing verb.',
  },
  order_service_selections: {
    category: 'checkout',
    verbs: ['read', 'create', 'update', 'delete'],
    server: ['create', 'update', 'delete'],
    sensitivity: 'operational',
    note: 'the netting/add-ons on an order; same lifecycle as order_items.',
  },
  order_compliance_records: {
    category: 'checkout',
    // delete — : effectively write-once at sale (the Regina netting-warning record).
    verbs: ['read', 'create', 'update'],
    server: ['create', 'update'],
    sensitivity: 'operational',
    note: 'the netting-warning record (Regina anchor); write-once at sale, so no delete verb.',
  },

  // ── customers (R2 — NO delete verb) ──────────────────────────────────────────
  customers: {
    category: 'customers',
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    // create/update FLIPPED declared-unwired → enforced 2026-07-27: the flip added customers_member_insert / _update gated on these strings (N5, David's ruling). Wired in the same pass that grants them.
    status: { read: 'enforced', create: 'enforced', update: 'enforced' },
    note:
      'R2: no delete verb — no tombstone (the `status` column is lifecycle, not a ' +
      'tombstone; A3). A future customers:delete is a scoped build gated on first ' +
      'answering the FK-cascade query. create/update are declared-unwired until the N5 ' +
      'member WRITE policy lands (Phase 2) — customers_member is SELECT-only today.',
  },

  // ── the sell-side menu (R2 — NO delete verb) ─────────────────────────────────
  service_offerings: {
    category: 'checkout',
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
    category: 'inventory',
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
    category: 'inventory',
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
    category: 'fulfilment',
    verbs: ['read', 'create', 'update'],
    sensitivity: 'operational',
    // create = SERVER-ENFORCED (§3's "✓ server" shape), RECLASSIFIED 2026-07-27 in the commit
    // that earned it. It was briefly `declared-unwired` — correctly, because the sole INSERT is
    // service-key (api/customers/create.ts) and NOTHING checked the caller. That was rider A's
    // bad branch: not a status question but an UNGATED WRITE PATH. Now `customers/create` calls
    // callerCan(auth, businessId, 'deliveries:create') before the insert, so the verb is enforced
    // INSIDE THE FUNCTION rather than at the table — which is exactly what `server` declares.
    // There is still no member INSERT policy, and that remains deliberate.
    server: ['create'],
    status: { read: 'enforced', update: 'enforced', create: 'enforced' },
    note:
      'R2: no delete verb — no tombstone (the `status` column is lifecycle: ' +
      'pending/delivered; A3). Table is membership-only today while the ROUTE checks a ' +
      'permission — disagreement N3, closed in Phase 2.',
  },
  'deliveries.route': {
    category: 'fulfilment',
    // create/delete — : a route has no independent existence apart from its deliveries.
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    inheritance: ['deliveries:read'],
    // STATUS SPLIT (2026-07-27, corpus stated — do NOT collapse these to one value):
    //   read   = ENFORCED at TWO layers. router.tsx:140-143 splits the single manage_deliveries
    //            PermissionRoute so /deliveries gates on this string; tileRegistry.ts:346
    //            `nav_delivery_route` repoints to it. Route and tile ARE enforcement (STD-020) —
    //            concluding "unwired" from the table layer alone is the manage_orders mistake.
    //   update = DECLARED-UNWIRED. No route is persisted: DeliveryRoute.tsx:385 is a SELECT, and
    //            nothing writes a route. CORPUS: packages/cultivar-os/src, packages/cultivar-os/api,
    //            packages/shared/src, api/, supabase/migrations (RPCs) — zero writers.
    //            Held out of every bundle and every role definition (R-B2) until a writer exists.
    // update: declared-unwired → **planned** 2026-07-31 (David's ruling). It CLEARS THE FLOOR: the
    // note below already said "re-add it in the same commit that ships a route writer" — a roadmap
    // item written as a prohibition. `/deliveries/route` exists and reads; nothing PERSISTS a
    // route. That is a scoped, named, unbuilt feature, which is exactly what `planned` means.
    status: { read: 'enforced', update: 'planned' },
    note:
      'SUB-RESOURCE of deliveries (the dotted name signals the parent). Rule 3: any ' +
      'deliveries.route:* grant requires deliveries:read — no deliveries, no route. Kept ' +
      'as a sub-resource rather than a peer for exactly that reason.',
  },

  // ── assets + pmi (R4 — operational, NOT financial) ───────────────────────────
  // ── RETIRED 2026-07-27 (David's ruling) ────────────────────────────────────────
  // `assets` was minted by R4 from a description of `business_assets` — A TABLE RENAMED TO
  // `cost_objects` ON 2026-06-15, six weeks before the ruling. The resource lived in three
  // bundles and no schema. R4's "operational, not financial" argument was about a table that no
  // longer exists.
  //
  // The /assets surface reads `cost_objects` (BusinessAssets.tsx:122), which is CONFIDENTIAL per
  // §4 and gated on `costs:read`. So the route now gates on `costs:read` too — door matches vault.
  // Until this ruling a MANAGER held `assets:read` (bundle) and not `costs:read` (confidential),
  // so they passed the door and read ZERO ROWS: #153's defect, reintroduced by the BUILD 2 route
  // split, landing on the first tenant created from the aligned floor.
  //
  // `assets:*` RETURNS when 3b's projection makes an operational/financial split inside
  // cost_objects real. STRINGS LAND WHEN ENFORCED, NOT BEFORE.

  pmi: {
    category: 'maintenance',
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    note:
      'business_pmi_schedule — service cadence and due dates. read+update (you do not ' +
      'create or delete a schedule slot as an authority act). This is the parent ' +
      'maintenance:override hangs from (R4).',
  },

  // ── the narrow money reads (spec §4 / §5) ────────────────────────────────────
  tax_rate: {
    category: 'settings',
    verbs: ['read', 'update'],
    sensitivity: 'operational',
    // update FLIPPED declared-unwired → enforced 2026-07-27: set_business_tax_rate gates on it (§3 of the flip) and writes ONLY config->'taxRate'.
    status: { read: 'enforced', update: 'enforced' },
    note:
      "a single value inside business_pricing_config. The READ exists as a narrow " +
      'SECURITY DEFINER function (get_business_tax_rate, applied 2026-07-24) returning ' +
      "ONLY config->>'taxRate' — NEVER the recipe. The WRITE does not exist yet " +
      '(set_business_tax_rate, Phase 1), hence declared-unwired.',
  },
  pricing_recipe: {
    category: 'financial',
    verbs: ['read', 'update'],
    sensitivity: 'confidential',
    // What the OWNER is actually handing over. Rendered verbatim in the grant confirm.
    exposure:
      'the PRICING RECIPE — the baseline margin, the tier overrides, the reference price and the cost structure. They can see, and change, how every price on the platform is decided.',
    note:
      'baseline margin, reference price, markup — the confidential recipe inside ' +
      'business_pricing_config. THE LEVER: this is the only write path that moves margin ' +
      'health (spec §4.1). Owner-confidential; the moat (D-009).',
  },
  costs: {
    category: 'financial',
    verbs: ['read', 'create', 'update', 'delete'],
    sensitivity: 'confidential',
    // What the OWNER is actually handing over. Rendered verbatim in the grant confirm.
    exposure:
      'the COST BASIS — what each item actually cost you. Margins, supplier pricing and your negotiating position are all derivable from it.',
    note: 'cost_objects, receipts — cost basis / unit cost. Confidential.',
  },
  margin: {
    category: 'financial',
    // create/update/delete — : margin is COMPUTED, never stored. The lever is the recipe.
    verbs: ['read'],
    sensitivity: 'confidential',
    // What the OWNER is actually handing over. Rendered verbatim in the grant confirm.
    exposure:
      'the MARGIN VERDICT on every item — which lines make money and which do not. It requires costs:read, so granting it grants the basis too (Rule 2).',
    status: 'derived',
    content: { read: ['costs:read'] },
    note:
      'the R/Y/G health signal — a computed judgment, not stored data. STATUS `derived` ' +
      '(R9): margin has no table, no policy and no RPC; the only thing enforcing it is a ' +
      'client-side filter, and render-only is not enforcement. ' +
      '🔴 CORRECTED 2026-07-30 — THIS NOTE PREVIOUSLY ASSERTED A SECURITY PROPERTY THAT DOES ' +
      'NOT EXIST. It said margin is computed FROM unit_cost, "which IS server-gated, so a ' +
      'member without costs:read cannot produce the verdict regardless of what the client ' +
      'hands them." unit_cost is NOT server-gated. RLS is ROW-level: ' +
      '`business_inventory_member_select` gates the whole ROW on inventory:read, and no ' +
      'column-level GRANT or narrowed view exists for this table. PROVEN under a real anon ' +
      'session (scripts/rls/inventory-read-model.rls.mjs): a MANAGER holding inventory:read ' +
      'and NOT costs:read read 14 unit costs in one query. See tech-debt #81. ' +
      'SO, TODAY: `derived` rests on a client-side filter ALONE, and a member who wants the ' +
      'margin verdict can compute it themselves from the cost they can already read. The ' +
      'Rule-2 content dependency (margin:read requires costs:read) is enforced when the ROLES ' +
      'PAGE grants, not when the DATA is read — it governs what an owner can hand over, not ' +
      'what a holder can obtain. ' +
      'ONCE #81 OPTION (b) LANDS — unit_cost moved to a costs:read-gated side table, the ' +
      'labor_resource_wages shape — this note becomes TRUE AS ORIGINALLY WRITTEN, because the ' +
      'basis really will be unreachable without costs:read and Rule 2 really will make it ' +
      'structural. `derived` was CORRECT IN INTENT AND PREMATURE IN FACT: it described the ' +
      'model we designed rather than the one we had shipped. Do not re-mint margin:read as ' +
      '`enforced` when (b) lands — derived is the right status; it just needs its premise built. ' +
      'THERE IS DELIBERATELY NO margin:update — you do not edit a verdict, you edit the ' +
      'recipe and the signal recomputes (spec §4.1).',
  },
  wages: {
    category: 'financial',
    verbs: ['read', 'create', 'update', 'delete'],
    sensitivity: 'confidential',
    // What the OWNER is actually handing over. Rendered verbatim in the grant confirm.
    exposure:
      'PAYROLL — labour resources and their wage rates. What every person on the team is paid.',
    note: "labor_resource_wages. Confidential; Andrew's case (read without write).",
  },

  // ── business surfaces ────────────────────────────────────────────────────────
  settings: {
    category: 'settings',
    verbs: ['read', 'update'],
    // ROUTE-ENFORCED, NOT TABLE-ENFORCED, and that is correct (David's ruling 2026-07-27).
    // `businesses_member_select` is USING(is_active_member(id)) — membership-only BY NECESSITY:
    // BusinessProvider resolves EVERY member's business from it, so gating it on settings:read
    // would break a STAFF session outright. settings:read is enforced at the /settings route and
    // by get_business_tax_rate; settings:update by the narrow set_business_profile RPC. Recorded
    // so capP's assertion 1 reads a DECLARED enforcement layer rather than a missing one.
    routeEnforced: true,
    sensitivity: 'operational',
    note: 'business profile — name, address, hours. read+update.',
  },
  campaigns: {
    category: 'growth',
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
    category: 'admin',
    verbs: ['read', 'create', 'update', 'delete'],
    // ROUTE-ENFORCED, NOT TABLE-ENFORCED, and that is correct (David's ruling 2026-07-27).
    // `rd_read` is USING(business_id IS NULL OR is_active_member(...)) — membership-only BY
    // NECESSITY: it is the role CATALOG the Roles page renders for everyone. team:read is
    // enforced at the /team route; team:create/update/delete are declared-unwired because the
    // funnel is the only writer.
    routeEnforced: true,
    sensitivity: 'owner-only',
    status: { read: 'enforced', create: 'declared-unwired', update: 'declared-unwired', delete: 'declared-unwired' },
    note:
      'business_members + role_definitions. WRITE is the permission FUNNEL ONLY (#152) — ' +
      'direct writes are blocked by the authority-immutability trigger, so no member-held ' +
      'string authorizes them. Granting/revoking is itself an owner-only capability.',
  },
  audit_log: {
    category: 'admin',
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

  // ── reports (MINTED 2026-07-31 as `planned` — David's ruling, #88) ────────────
  // 🔴 THIS STRING WAS BEING USED WITHOUT EXISTING. `tileRegistry.ts:204` gates the
  // `business_insights` tile on `reports:read`, and the string was in NO manifest — current or
  // legacy — so capA assertion 5 reported it as "shaped like a permission but NOT in the model".
  // Minting it as `planned` IS the resolution: the tile has carried `status:'planned'` all along,
  // so the SURFACE half could say "coming soon" and the PERMISSION half had no way to say it.
  // CLEARS THE `planned` FLOOR: a named tile, a declared surface, and an owner-test card. The
  // status flips to `enforced` in the SAME commit that ships the Insights readout.
  reports: {
    category: 'financial',
    verbs: ['read'],
    sensitivity: 'confidential',
    // CONFIDENTIAL BY ANTICIPATION, not by later remembering: insights are DERIVED from sales,
    // cost and margin, so the exposure warning is correct on the day it ships. Category is
    // `financial` for the same reason — a one-chip 'insights' section would have to be added to
    // PERMISSION_CATEGORY_ORDER, and the owner looks for cost-derived numbers under financial.
    // A small call, easily overturned; it is NOT a claim that reports are only ever financial.
    exposure: 'Business insights are derived from sales, cost and margin — reading them is reading the numbers underneath.',
    status: 'planned',
    note:
      'read the derived business-insights readout. PLANNED: the `business_insights` tile ' +
      'exists (tileRegistry.ts:204, status:\'planned\', no route) and nothing serves it yet. ' +
      'R2: no write verbs — a report is derived, never authored.',
  },
};

/**
 * CAPABILITY VERBS (spec §3, second table) — named authorities that are not CRUD on a
 * resource. First-class permission strings obeying the same manifest rules.
 */
const CAPABILITY_VERBS: Record<string, Omit<ManifestEntry, 'resource' | 'verb' | 'server'>> = {
  'inventory:import_price': {
    category: 'inventory',
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
    category: 'checkout',
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
    category: 'checkout',
    permission: 'order_discount:apply',
    // STATUS FLIPPED declared-unwired → enforced 2026-07-27, in the SAME commit that wired it:
    // submit.ts:238 now returns 403 FORBIDDEN_DISCOUNT instead of silently discarding the
    // override. capQ blocks granting a declared-unwired string, so this flip and the wiring
    // are inseparable — MANAGER is 43 only because both landed together.
    status: 'enforced',
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
    category: 'maintenance',
    permission: 'maintenance:override',
    // declared-unwired → **planned** 2026-07-31 (David's ruling; he called this "the interesting
    // one" and he was right). R6 says the PMI block is DELIBERATE and unbuilt — which is a scoped
    // feature, not an accident. The note below was accurate about the mechanism and WRONG about
    // the consequence: "hidden from the Roles page until the block is built" is precisely the
    // treatment the ruling overturns. An owner who sees this chip learns the PMI block is coming;
    // an owner who sees nothing learns nothing at all.
    status: 'planned',
    sensitivity: 'operational',
    structural: [],
    content: ['pmi:read'],
    inheritance: [],
    note:
      'authorize an asset to be used with overdue PMI. PLANNED (R6): NOTHING IN THE APP ' +
      'BLOCKS ON AN OVERDUE PMI YET, so there is nothing to override TODAY — the block is ' +
      'scoped, not accidental. Rendered on the Roles page as a coming-soon chip that cannot ' +
      'be granted; its dependency (pmi:read) stays dormant until the block ships, and the ' +
      'status flips to enforced in the SAME commit that ships it.',
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
        category: seed.category,
        status,
        exposure: seed.exposure,
        routeEnforced: seed.routeEnforced,
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
/**
 * THE `declared-unwired` SET — resource:verb strings ONLY (no legacy, no owner-only sentinel).
 *
 * 🔴 THE INVARIANT (David's ruling, 2026-07-27): **no default bundle and no role definition —
 * floor or tenant — may contain a string from this set, and no member array may hold one.**
 *
 * WHY it is stronger than "a fake pill is untidy": §7.1 filters a declared-unwired string out of
 * the Roles-page catalog, and `MemberConsole.tsx:651` seeds its draft from the RESOLVED SET, not
 * from the rendered chips. So a held string with no chip is submitted unchanged by every save and
 * is **UN-REMOVABLE THROUGH THE UI**. Granting one does not create a harmless fake pill; it
 * creates a permanent grant nobody can revoke without SQL.
 *
 * This is the SINGLE AUTHORITY for the set. The `NOT IN (…)` literal in
 * `20260727_rbac_resource_action_flip.sql` §5 (R-B2) is a hand-made snapshot of it, and capQ
 * FAILS when the two diverge — so adding a string here breaks the build until the migration
 * agrees. Three enforcement surfaces (bundles, the migration list, role_definitions/members via
 * that migration's V5/V5b), one source.
 */
export const DECLARED_UNWIRED_PERMISSIONS: string[] = Object.values(PERMISSION_MANIFEST)
  .filter((e) => e.status === 'declared-unwired')
  .map((e) => e.permission);

/**
 * THE `planned` SET — scoped, unbuilt, RENDERED, and NOT GRANTABLE (David's ruling, 2026-07-31).
 *
 * Kept SEPARATE from DECLARED_UNWIRED_PERMISSIONS on purpose. The two sets share one invariant and
 * differ in one behaviour, and collapsing them would lose the fact a reader actually needs:
 *   · SHARED — neither may appear in a bundle, a role definition, or a member array. Enforced by
 *     capQ over UNGRANTABLE_PERMISSIONS below.
 *   · DIFFERENT — a `planned` string RENDERS in the catalog (visually distinct, non-interactive);
 *     a `declared-unwired` string is filtered out entirely.
 *
 * THE FLOOR: a string earns `planned` only with a build behind it — a named gap, a card, a slot,
 * or a decision. `campaigns:create` is the worked counter-example: the next verb being obvious is
 * NOT a scoped build, so it stays declared-unwired. Without that floor everything imaginable
 * becomes planned and the status means nothing.
 */
export const PLANNED_PERMISSIONS: string[] = Object.values(PERMISSION_MANIFEST)
  .filter((e) => e.status === 'planned')
  .map((e) => e.permission);

/**
 * UN-GRANTABLE — the union, and the set the INVARIANT is actually about.
 *
 * 🔴 THE INVARIANT (David 2026-07-27, extended to `planned` 2026-07-31): **no default bundle and
 * no role definition — floor or tenant — may contain a string from this set, and no member array
 * may hold one.** Rendering is not holding: a `planned` chip appears on the Roles page and still
 * may not be written to anybody, because an owner who believes he granted access to a feature
 * that does not exist is the exact defect the status was created to avoid.
 *
 * WHY THE UNION AND NOT THE TWO SETS SEPARATELY: capQ reconciles this against the R-B2 `NOT IN`
 * literal in the APPLIED migration `20260727_rbac_resource_action_flip.sql`, which §6 r1 forbids
 * editing. Reconciling against `declared-unwired` ALONE would fail the moment a string moved to
 * `planned` — it would leave the manifest set while remaining in the migration's list. Against
 * the UNION, a status move is invisible to the reconciliation, which is correct: both statuses
 * are stripped at backfill for the same reason.
 */
export const UNGRANTABLE_PERMISSIONS: string[] = [
  ...DECLARED_UNWIRED_PERMISSIONS,
  ...PLANNED_PERMISSIONS,
];

/**
 * THE CONFIDENTIAL EXPOSURE COPY — resource → what granting it actually hands over.
 *
 * 🔴 WHY IT IS DATA AND NOT UI TEXT (David's ruling, 2026-07-27). Eleven confidential permissions
 * showed the SAME BLAND CONFIRM as a dashboard toggle. Granting `costs:read` on that screen looked
 * exactly like granting `orders:read`, on the surface the owner uses to give a manager the cost
 * basis. Spec §4 says a confidential read is an owner GRANT that shows the hard warning; the
 * warning did not exist.
 *
 * Driven by the manifest so a TWELFTH confidential permission inherits it WITH NO UI EDIT — the
 * same reason the Roles page renders its chips from here. A hardcoded list in the component would
 * be a fifth representation, and it would go stale the way every other one this week did.
 */
export const CONFIDENTIAL_EXPOSURE: Record<string, string> = Object.fromEntries(
  Object.values(PERMISSION_MANIFEST)
    .filter((e) => e.sensitivity === 'confidential' && e.exposure)
    .map((e) => [e.resource, e.exposure as string]),
);

/**
 * ⚠️ `planned` IS DELIBERATELY ABSENT FROM THIS LIST (2026-07-31). Hiding is exactly what the
 * status exists to stop — a planned string renders, non-interactively. Only `declared-unwired`
 * is hidden. If you are adding a status here, check first that you do not mean UNGRANTABLE.
 */
export const HIDDEN_PERMISSIONS: string[] = [
  'owner-only',
  ...LEGACY_PERMISSIONS.filter((e) => e.unwired && e.fate !== 'unmapped-orphan').map((e) => e.legacy),
  ...Object.values(PERMISSION_MANIFEST)
    .filter((e) => e.status === 'declared-unwired')
    .map((e) => e.permission),
];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ROLES-PAGE CATALOG — every string an owner may grant, and NOTHING ELSE (N-4/N-3).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * `status === 'enforced'` per §7.1, minus HIDDEN_PERMISSIONS. `declared-unwired` and `derived`
 * are excluded BY THE SAME RULE that defines them, not by a removal list:
 *   · `declared-unwired` — the string exists and NOTHING enforces it. A pill for it is a fake
 *     surface (D-9) and, worse, an UN-REMOVABLE one: the Roles tab seeds its draft from the
 *     RESOLVED SET (`MemberConsole.tsx:654`), so a held string with no chip survives every save.
 *     Rendering one mints the exact defect R-B2 and capQ exist to prevent.
 *   · `derived` (`margin:read`) — enforced transitively by its Rule-2 prerequisite, with no gate
 *     of its own. Granting it directly would imply an authority the model does not hand out.
 *
 * 🔴 THE POINT: the legacy pills (`view_costs`, `view_wages`, `view_margin`, …) disappear because
 * they are NOT IN THE MANIFEST — no removal list, no exceptions file, nothing to keep in sync.
 * That is the whole design. A sixth hand-maintained list would have joined
 * PRICING_RECIPE_PROTECTED_PATHS, the R-B2 list, OWNER_ONLY_PENDING, the bundles and the old chip
 * catalog on the pile of things that duplicate something derivable and then go stale.
 *
 * capP asserts the rendered catalog is EXACTLY this set — not a subset, not a superset — so a pill
 * that gates nothing fails the build.
 */
export const CATALOG_PERMISSIONS: string[] = Object.values(PERMISSION_MANIFEST)
  // `planned` JOINED THIS FILTER 2026-07-31 (David's ruling). It is the whole point of the status:
  // a planned string RENDERS — "the pill is real, the feature is not built" — where a
  // declared-unwired string is still filtered out. The two share the un-grantable invariant and
  // differ HERE, which is the one place the difference is supposed to show.
  .filter((e) => e.status === 'enforced' || e.status === 'derived' || e.status === 'planned')
  .filter((e) => e.sensitivity !== 'owner-only')
  .map((e) => e.permission)
  .filter((p) => !HIDDEN_PERMISSIONS.includes(p));

/**
 * The catalog members that are RENDERED BUT NOT TOGGLEABLE (R9). A `derived` string has no gate
 * of its own — it is enforced transitively by its Rule-2 prerequisite — so it is shown, counted,
 * and explained, but an owner cannot grant or revoke it directly. Granting the prerequisite is
 * the act; this pill is the consequence, made visible.
 */
export const DERIVED_PERMISSIONS: string[] = Object.values(PERMISSION_MANIFEST)
  .filter((e) => e.status === 'derived')
  .map((e) => e.permission);

/**
 * What a `derived` string is implied BY — its Rule-2 (content) prerequisite. `margin:read` →
 * `costs:read`. Used for the pill's explanatory label, so the page says WHY the string is held
 * rather than showing a chip nobody can move.
 */
export function impliedBy(permission: string): string[] {
  const e = PERMISSION_MANIFEST[permission];
  return e ? [...e.content, ...e.inheritance] : [];
}

/** Roles-page section for a permission, declared on its resource seed. Never inferred. */
export function permissionCategory(permission: string): string {
  return PERMISSION_MANIFEST[permission]?.category ?? 'other';
}

/**
 * THE SECTION ORDER — the one presentation decision that cannot be derived.
 *
 * MEMBERSHIP is derived (each resource declares its own `category`); ORDER is not, because
 * "which section comes first" is a judgement about how an owner reads the page, not a fact about
 * the model. It lives here rather than in the component so the UI still needs no edit, and capP
 * asserts every category any resource declares appears in this array — so a new category cannot
 * silently fall off the end of the page the way `Other` silently swallowed thirty-one strings.
 */
export const PERMISSION_CATEGORY_ORDER: string[] = [
  'checkout', 'customers', 'inventory', 'fulfilment', 'maintenance',
  'financial', 'growth', 'settings', 'admin',
];

/**
 * THE PILL LABEL — DERIVED from `resource` + `verb`, never a hand-maintained display map.
 *
 * 🔴 WHY DERIVED (David's ruling, 2026-07-28). The page was showing "View Costs" / "View Wages" /
 * "View Margin" — LEGACY display names for strings the model has retired — beside their
 * replacements, so the owner read both vocabularies at once and could not tell which one the gates
 * actually consult. A label map would be the sixth list duplicating something derivable.
 *
 * The label is therefore a pure function of the string itself: dots and underscores become spaces,
 * each word is capitalised, and the verb is separated by a middot. `tax_rate:update` →
 * "Tax Rate · Update"; `deliveries.route:read` → "Deliveries Route · Read". A new permission gets
 * its label the moment it enters the manifest, with NO EDIT ANYWHERE — which is the property that
 * made every other derived surface stop drifting.
 *
 * Some read a little mechanically ("Order Discount · Apply"). That is the accepted cost: a label
 * that is always true beats a prettier one that silently describes a string nobody enforces.
 */
export function permissionLabel(permission: string): string {
  const entry = PERMISSION_MANIFEST[permission];
  const [resource, verb] = entry
    ? [entry.resource, entry.verb]
    : [permission.slice(0, permission.lastIndexOf(':')), permission.slice(permission.lastIndexOf(':') + 1)];
  const words = (s: string): string =>
    s.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return resource ? `${words(resource)} · ${words(verb)}` : words(permission);
}


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

/**
 * MANAGER — on by default (spec §5). A starting grant, changeable verb-by-verb.
 *
 * ⚠️ `deliveries.route:update` was REMOVED 2026-07-27. It is `declared-unwired`, and a bundle
 * carrying one MINTS an un-removable grant: §7.1 hides the chip, and MemberConsole.tsx:651 seeds
 * the draft from the resolved set, so it survives every save with no way to toggle it off.
 * Enforced by capQ. Re-add it in the same commit that ships a route writer — not before.
 *
 * NOTE ON PLACEMENT: this note lives ABOVE the array, never inside it. capP parses the literal
 * and reads an inline comment as a permission string.
 */
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
  'deliveries.route:read',
  'pmi:read', 'pmi:update',
  'tax_rate:read', 'tax_rate:update',
  'settings:read', 'settings:update',
  'campaigns:read', 'campaigns:update',
];

/**
 * STAFF — THE FULFILMENT SET (David's ruling 2026-07-27). Previously the two strings
 * orders-create and inventory-read, written when R1's Note A still withheld the order read.
 * David retired that case with one question: "staff needs to view order — how else can they fill
 * the order?" A staff member READS what the work requires and WRITES nothing without an explicit
 * grant. The same question answered customers: a driver needs the address, and duplicating it
 * onto a delivery record to dodge the permission is STD-011.
 *
 * NOTE ON PLACEMENT: this lives ABOVE the array, never inside it. capQ and capP parse the LITERAL,
 * so a quoted permission string in an inline comment is counted as a member — the first draft of
 * this note made the bundle read as 12 strings instead of 10.
 */
export const STAFF_DEFAULT_BUNDLE: string[] = [
  'orders:create',
  'orders:read', 'order_items:read',
  'order_service_selections:read', 'order_compliance_records:read',  // the netting/planting add-ons
  'customers:read',                                                  // where to deliver
  'inventory:read',                                                  // which lot to pull
  'deliveries:read', 'deliveries:update',                            // see the stop, mark it done
  'deliveries.route:read',
  // deliveries.route:update is HELD — declared-unwired, nothing persists a route (R-B2/capQ).
];

/** Fresh-role seed by role key. OWNER is absent BY DESIGN — owner authority is owner_id. */
/**
 * OWNER — every ENFORCED string. ADDED 2026-07-27 (David's ruling A).
 *
 * The bundles used to omit OWNER on the theory that owner authority is `businesses.owner_id`.
 * That theory is FALSE for one reachable state, established two days earlier: `assign_member_role`
 * accepts `p_role_key = 'OWNER'` for any role that resolves, so a member can hold role OWNER
 * WITHOUT being `businesses.owner_id` — and that person gets NO bypass at the table, api or route
 * layer. Their array is all they have. The OWNER floor row must therefore stay populated.
 *
 * WHY IN THE BUNDLE RATHER THAN EXCLUDED FROM THE DERIVATION: excluding it would leave the OWNER
 * floor row with NO authority holding it — unmanaged, unreconciled, free to drift. That is exactly
 * the shape this whole alignment exists to close (the 2026-07-10 floor drift). A role the system
 * can assign is a role the source must define.
 *
 * CONTENT IS NOT A JUDGEMENT CALL: it is every permission in PERMISSION_MANIFEST whose status is
 * not `declared-unwired` — **52 of 60 today**. Materialised as a literal so capQ can reconcile it
 * against the floor-seeding migration the same way it reconciles the R-B2 list.
 *
 * 🔧 TWO CORRECTIONS (2026-07-30, found while building the owner ruling — both in this paragraph):
 *   · The count read "55 of 63". It is 52 of 60, and had been since the model last moved.
 *   · "the accompanying test asserts it still equals the computed set" — **THAT TEST DID NOT
 *     EXIST.** A comment asserting a check nobody wrote is #164's class, sitting in the file whose
 *     job is to be the one true source. It exists now (`permissionManifest.test.ts`, 5 assertions
 *     against `OWNER_LOCKED_SET`), and the sentence is true for the first time.
 */
export const OWNER_DEFAULT_BUNDLE: string[] = [
  'audit_log:read',
  'campaigns:read',
  'campaigns:update',
  'costs:create',
  'costs:delete',
  'costs:read',
  'costs:update',
  'customers:create',
  'customers:read',
  'customers:update',
  'deliveries.route:read',
  'deliveries:create',
  'deliveries:read',
  'deliveries:update',
  'inventory:create',
  'inventory:delete',
  'inventory:import_price',
  'inventory:read',
  'inventory:update',
  'inventory_ledger:read',
  'margin:read',
  'order_compliance_records:create',
  'order_compliance_records:read',
  'order_compliance_records:update',
  'order_discount:apply',
  'order_items:create',
  'order_items:delete',
  'order_items:read',
  'order_items:update',
  'order_service_selections:create',
  'order_service_selections:delete',
  'order_service_selections:read',
  'order_service_selections:update',
  'orders:create',
  'orders:delete',
  'orders:read',
  'orders:update',
  'pmi:read',
  'pmi:update',
  'pricing_recipe:read',
  'pricing_recipe:update',
  'service_offerings:read',
  'settings:read',
  'settings:update',
  'tax_exempt:apply',
  'tax_rate:read',
  'tax_rate:update',
  'team:read',
  'wages:create',
  'wages:delete',
  'wages:read',
  'wages:update',
];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE OWNER'S SET — COMPUTED, NOT CURATED. THE CLIENT READS THIS, NOT THE STORED ARRAY.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * RULING (David, 2026-07-30): "The OWNER role holds every enforced permission, LOCKED — computed
 * from the manifest, not stored, so a new permission is inherited automatically and nobody can
 * remove one." `businesses.owner_id` is a FACT ABOUT WHO OWNS THE BUSINESS; it is NOT an authority
 * mechanism. Two owners = two members holding this same locked set. Nothing special-cased.
 *
 * WHY COMPUTED AND STORED BOTH EXIST, AND WHY THAT IS NOT STD-011 DRIFT:
 *   · THIS (computed) is what `can()` reads on the CLIENT. Add a permission to the manifest and
 *     every owner holds it on the next page load — no migration, no backfill, no drift window.
 *   · The STORED array (`business_members.permissions`, backfilled by 20260730a) is what the
 *     SERVER reads — `has_permission` is SQL and cannot import a TS module.
 *   They are two MATERIALISATIONS of one authority, not two authorities, and the direction of
 *   truth is one-way: the manifest is the source, the array is a copy. capA assertion 3 FAILS the
 *   build when the copy disagrees, which is the only thing that makes the arrangement safe.
 *
 * DERIVATION: every entry whose status is not `declared-unwired`. `derived` members (margin:read)
 * ARE included — the owner holds the prerequisite, so the derived string resolves true anyway;
 * excluding it would make the owner's set disagree with its own dependency rule. `declared-unwired`
 * is excluded by the same invariant that governs every other role: a string nothing enforces is
 * un-removable through the UI, so granting one creates a permanent phantom (ruling 2026-07-27).
 *
 * 🔴 NOT the MEMBERSHIP_SENTINEL. `member` is a declared absence of requirement, never a held
 * string — `can()` answers it before consulting any set at all.
 *
 * ── THE `owner-only` SENTINEL IS A MEMBER OF THIS SET, AND THAT IS THE RULING, NOT AN EXCEPTION ──
 * `owner-only` is the route sentinel guarding `/costs` and `/add-business` (router.tsx:230). It is
 * NOT a manifest entry, so the derivation above cannot produce it — and until 2026-07-30 it did not
 * need to, because `can()` short-circuited before ever looking. Delete the short-circuit without
 * this line and the owner silently loses Cost-to-Produce and Add Business.
 *
 * It is appended HERE rather than special-cased at the gate because that is the difference between
 * a permission and an exception path: it is a STRING IN A SET, checked exactly like the other 52.
 * A second OWNER-role member holds it (two owners, by ruling). A manager does not, and cannot be
 * given it — it stays in HIDDEN_PERMISSIONS, so it is never a grantable chip on the Roles page.
 * "Owner-level access" is now a permission somebody holds, not an identity somebody is.
 */
export const OWNER_ONLY_SENTINEL = 'owner-only';

export const OWNER_LOCKED_SET: string[] = [
  ...Object.values(PERMISSION_MANIFEST)
    // 🔴 `planned` JOINED THIS EXCLUSION 2026-07-31, and the test caught it before the commit did.
    // The filter used to read `!== 'declared-unwired'`, so the three new `planned` strings would
    // have entered the OWNER'S COMPUTED SET — the owner would "hold" `reports:read` for a readout
    // that does not exist, capA assertion 3 would then demand the SQL literal grow 52 → 55, and an
    // APPLIED migration would need editing to record a grant of nothing. **Nobody holds a planned
    // string, including the owner, because there is nothing to hold.** The correct predicate is
    // UN-GRANTABLE, not declared-unwired — the same conflation the fourth status exists to end,
    // reappearing one derivation later.
    .filter((e) => !UNGRANTABLE_PERMISSIONS.includes(e.permission))
    .map((e) => e.permission),
  OWNER_ONLY_SENTINEL,
].sort();

export const DEFAULT_BUNDLES: Record<string, string[]> = {
  OWNER: OWNER_DEFAULT_BUNDLE,
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
