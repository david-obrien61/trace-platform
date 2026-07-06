#!/usr/bin/env node
/**
 * verify-universals.mjs — CROSS-VERTICAL UNIVERSAL-CAPABILITY AUDIT + BUILD GATE
 *
 * PURPOSE: assert, MECHANICALLY and per vertical, that the five universal platform
 *   capabilities below are actually present in the repo. The capability list lives here
 *   AS ASSERTIONS (not as a prose doc) — the first run IS the cross-vertical audit. Wire
 *   into the build gate: `node scripts/verify-universals.mjs` exits NON-ZERO on any FAIL,
 *   naming the vertical + capability + the file/policy it checked.
 *
 *   This is a STRUCTURAL gate over the repo (migration SQL + source) — it needs NO live DB,
 *   NO service key, NO network. It verifies what version control DEFINES (append-only
 *   migrations: the effective policy = the last CREATE POLICY for a name). The live-catalog
 *   proof is the SEPARATE schema-verification gate (CLAUDE.md §9).
 *
 * THE UNIVERSALS (asserted below):
 *   1. Persistent identity indicator mounted in the per-page layout/header (not dashboard-only)
 *   2. Financial/cost tables gated by has_permission on every read path (RLS policy shape)
 *   3. Dual RLS (owner + is_active_member) on every tenant table
 *   4. Membership filters use the canonical is_active_member (no hand-spelled active checks)
 *   5. confidence enum honored (no silent $0)
 *   6. Cost-wall regression guard — READ side (Gate 3 / Staff HAR encoded structurally)
 *   7. WRITE-WALL — write side (Gate-3b): cost-apply service-key write is caller-permission-gated
 *      AND cost member policies carry has_permission in WITH CHECK. (Was acceptance (h); flipped live.)
 *
 * SCOPE PER VERTICAL (honest, not a rug): capabilities 2-5 are MULTI-TENANT-RLS capabilities.
 *   Cultivar OS is multi-tenant Supabase RLS → all five are IN SCOPE. Ignition OS is a
 *   single-device, local-first PIN vertical — its permissive RLS is an intentional, DOCUMENTED
 *   exception (CLAUDE.md "Auth Architecture — Locked Rule": "not a pattern to reuse in
 *   multi-tenant contexts"). For Ignition, 2-5 are reported SKIP-with-reason (visible in the
 *   matrix, NOT silently passed, NOT a hard FAIL). Capability 1 is in scope for both.
 *
 * ACCEPTANCE BLOCK (Role Machine definition-of-done, D-010..D-015): assertions (a)-(h)
 *   are the checkable definition-of-done for the not-yet-built Role Machine. They print
 *   SKIP-with-reason ("flip to live-assert when green"), do NOT enter the matrix, and NEVER
 *   touch the fail counter — so the gate is not chained on unbuilt work (green-then-guards:
 *   chain only when green). (h) is the write-side twin of cap #6 and is EXPECTED-FAIL once
 *   asserted live, until the Gate-3b write-wall lands.
 *
 * EXIT: non-zero iff any IN-SCOPE assertion FAILs. KNOWN-GAP sub-findings (documented,
 *   tracked product decisions) and the ACCEPTANCE block do not by themselves fail the gate.
 *
 * Usage:  node scripts/verify-universals.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── tiny repo readers (no deps) ────────────────────────────────────────────────
const read = (rel) => {
  try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return ''; }
};
/** Concatenate every .sql in a migrations dir, in filename (= chronological) order. */
const concatSql = (relDir) => {
  const abs = join(ROOT, relDir);
  if (!existsSync(abs)) return '';
  return readdirSync(abs)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => `\n-- FILE: ${f}\n` + readFileSync(join(abs, f), 'utf8'))
    .join('\n');
};
/** 1-based line of the first regex hit, or null. */
const lineOf = (text, re) => {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return null;
};
/**
 * Effective body of a policy across append-only migrations: the LAST `CREATE POLICY <name>`
 * statement (to its terminating `;`), but only if it is not DROP'd again afterward without
 * a later re-CREATE. Returns the statement text, or null if absent / dropped-last.
 */
const effectivePolicy = (sql, name) => {
  const q = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const createRe = new RegExp(`CREATE POLICY\\s+"?${q}"?\\b`, 'g');
  const dropRe = new RegExp(`DROP POLICY[^;]*\\b"?${q}"?\\b`, 'g');
  let lastCreate = -1, m;
  while ((m = createRe.exec(sql))) lastCreate = m.index;
  if (lastCreate < 0) return null;
  // any DROP after the last CREATE with no further CREATE => dropped-last
  let lastDrop = -1;
  while ((m = dropRe.exec(sql))) lastDrop = m.index;
  if (lastDrop > lastCreate) return null;
  const end = sql.indexOf(';', lastCreate);
  return sql.slice(lastCreate, end < 0 ? undefined : end + 1);
};
/** True if any `CREATE POLICY ... ON <table> ...` statement carries `owner_id = auth.uid()`. */
const tableHasOwnerPolicy = (sql, table) => {
  const re = new RegExp(`CREATE POLICY[\\s\\S]*?ON\\s+(?:public\\.)?${table}\\b[\\s\\S]*?;`, 'g');
  let m;
  while ((m = re.exec(sql))) if (/owner_id\s*=\s*auth\.uid\(\)/.test(m[0])) return true;
  return false;
};
/** Distinct policy NAMES ever declared on a table (any CREATE POLICY <name> ON <table>). */
const policyNamesOnTable = (sql, table) => {
  const re = new RegExp(`CREATE POLICY\\s+"?([A-Za-z0-9_]+)"?\\s+ON\\s+(?:public\\.)?${table}\\b`, 'g');
  const names = new Set();
  let m;
  while ((m = re.exec(sql))) names.add(m[1]);
  return [...names];
};

// ── verticals ───────────────────────────────────────────────────────────────────
const VERTICALS = {
  ignition: {
    label: 'Ignition OS',
    tenancy: 'local-first-pin',
    migrationsDir: 'packages/ignition-os/supabase/migrations',
    scopeNote:
      'single-device PIN vertical — multi-tenant RLS capabilities are an intentional, ' +
      'documented exception (CLAUDE.md "Auth Architecture — Locked Rule").',
  },
  cultivar: {
    label: 'Cultivar OS',
    tenancy: 'multi-tenant-rls',
    migrationsDir: 'supabase/migrations',
  },
};
const isMultiTenant = (v) => v.tenancy === 'multi-tenant-rls';

// ── result helpers ───────────────────────────────────────────────────────────────
const PASS = (detail, gaps = []) => ({ status: 'PASS', detail, gaps });
const FAIL = (detail, gaps = []) => ({ status: 'FAIL', detail, gaps });
const SKIP = (detail) => ({ status: 'SKIP', detail, gaps: [] });

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 1 — Persistent identity indicator mounted in the per-page layout/header
//   Signal: a layout/shell component that renders the business/shop identity AND is
//   mounted in the persistent route/app shell (wraps many pages — not a single dashboard).
// ════════════════════════════════════════════════════════════════════════════════
function cap1(key) {
  if (key === 'ignition') {
    // CoreApp.jsx is the persistent app shell: <header> + <ShopBanner name={shopName}/> + the
    // bottom <nav> tab bar all render around EVERY operational tab (not a dashboard-only view).
    const core = read('packages/ignition-os/CoreApp.jsx');
    const defined = /const\s+ShopBanner\s*=|function\s+ShopBanner\b/.test(core);
    const mounted = /<ShopBanner[\s/>]/.test(core);
    const shellNav = /<nav\b/.test(core) && /<header\b/.test(core);
    const identity = /shopName/.test(core);
    if (defined && mounted && shellNav && identity) {
      return PASS(
        `ShopBanner defined (CoreApp.jsx:${lineOf(core, /const\s+ShopBanner\s*=/)}) and mounted ` +
        `in the persistent app shell (CoreApp.jsx:${lineOf(core, /<ShopBanner[\s/>]/)}), ` +
        `alongside the shell <header>/<nav> — visible across all tabs, not dashboard-only.`,
      );
    }
    return FAIL(
      `CoreApp.jsx: ShopBanner ${mounted ? 'mounted' : 'NOT mounted'} / ${defined ? 'defined' : 'NOT defined'} / ` +
      `shell ${shellNav ? 'present' : 'MISSING'}.`,
    );
  }
  // cultivar: a persistent identity header (<AppHeader>) must be mounted ONCE as a layout
  // wrapping the private routes, and that header must render the business identity from the
  // canonical BusinessProvider context — not per-page, not from its own fetch.
  const router = read('packages/cultivar-os/src/router.tsx');
  const layout = read('packages/cultivar-os/src/components/layout/AppLayout.tsx');
  const header = read('packages/shared/src/components/AppHeader.tsx');

  // (a) a layout/shell route wraps the private routes in the router
  const routerWraps = /element=\{<(?:App)?(?:Layout|Shell|Chrome|NavBar|Header)[\s/>]/.test(router);
  // (b) that layout mounts the shared header AND the route <Outlet/> (one mount, wraps every page)
  const layoutMountsHeader = /<AppHeader[\s/>]/.test(layout) && /<Outlet[\s/>]/.test(layout);
  // (c) the header pulls identity from the canonical context — and does NOT fetch on its own
  const headerFromContext = /useBusinessContext/.test(header);
  const headerNoOwnFetch = !/supabase|\.from\(|fetch\(/.test(header);
  // (d) the header actually renders the identity: business name + the role badge
  const headerRendersIdentity = /business\??\.name|business\.name/.test(header) && /\brole\b/.test(header);

  if (routerWraps && layoutMountsHeader && headerFromContext && headerNoOwnFetch && headerRendersIdentity) {
    return PASS(
      `Persistent <AppHeader> mounted once via AppLayout wrapping the private routes ` +
      `(router.tsx:${lineOf(router, /element=\{<AppLayout/) || '?'}); it renders business name + ` +
      `email + role badge from the canonical BusinessProvider context (no own fetch) — visible on ` +
      `every authenticated page, not dashboard-only.`,
    );
  }
  return FAIL(
    `No persistent identity header mounted across pages. ` +
    `routerWraps=${routerWraps} layoutMountsHeader=${layoutMountsHeader} ` +
    `headerFromContext=${headerFromContext} headerNoOwnFetch=${headerNoOwnFetch} ` +
    `headerRendersIdentity=${headerRendersIdentity}. ` +
    `Fix: mount the shared <AppHeader> in a layout (AppLayout) wrapping the PrivateRoute routes.`,
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 2 — Financial/cost tables gated by has_permission on every read path
//   Signal: each financial/cost table's effective member RLS policy gates on the permission
//   (canonical has_permission(...,'perm') OR the equivalent inline `permissions ? 'perm'`).
// ════════════════════════════════════════════════════════════════════════════════
const FINANCIAL_POLICIES = [
  ['cost_objects_member_all', 'view_costs'],
  ['business_inventory_member_all', 'view_costs'],
  ['cost_object_edges_member_all', 'view_costs'],
  ['cost_object_assignments_member_all', 'view_costs'],
  ['business_service_log_member_all', 'view_costs'],
  ['receipts_member_all', 'view_costs'],
  ['labor_resources_member_all', 'view_wages'],
  ['lrw_member_view_wages', 'view_wages'], // labor_resource_wages
  ['bpc_member_view_pricing', 'view_pricing_config'], // business_pricing_config
];
function cap2(key, v) {
  if (!isMultiTenant(v)) return SKIP(v.scopeNote);
  const sql = concatSql(v.migrationsDir);
  const misses = [];
  for (const [policy, perm] of FINANCIAL_POLICIES) {
    const body = effectivePolicy(sql, policy);
    const gated =
      body &&
      (new RegExp(`has_permission\\([^)]*'${perm}'`).test(body) ||
        new RegExp(`permissions\\s*\\?\\s*'${perm}'`).test(body));
    if (!gated) misses.push(`${policy} (needs ${perm})${body ? '' : ' — policy absent'}`);
  }
  if (misses.length === 0) {
    return PASS(`all ${FINANCIAL_POLICIES.length} financial/cost member policies gate on their permission (has_permission / permissions ?).`);
  }
  return FAIL(`ungated financial read path(s): ${misses.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 3 — Dual RLS (owner + is_active_member) on every tenant table
//   Signal: each member-scoped tenant table has BOTH an owner policy (owner_id = auth.uid())
//   and a member policy referencing is_active_member. Owner-only operational tables (no member
//   policy yet — documented product decision, fail-closed) are reported as KNOWN-GAP.
// ════════════════════════════════════════════════════════════════════════════════
const DUAL_TABLES = [
  ['businesses', 'businesses_member_select'],
  ['receipts', 'receipts_member_all'],
  ['cost_objects', 'cost_objects_member_all'],
  ['business_inventory', 'business_inventory_member_all'],
  ['business_pmi_schedule', 'business_pmi_schedule_member_all'],
  ['business_service_log', 'business_service_log_member_all'],
  ['labor_resources', 'labor_resources_member_all'],
  ['cost_object_edges', 'cost_object_edges_member_all'],
  ['cost_object_assignments', 'cost_object_assignments_member_all'],
  ['deliveries', 'deliveries_member_all'],
  ['business_modules', 'business_modules_member_access'],
  ['cultivar_plants', 'cultivar_plants_owner_all'], // member branch fused (owner_id OR is_active_member)
];
// Documented owner-only operational tables (CLAUDE migration §"NOT TOUCHED"): member-read is a
// pending PRODUCT decision; they fail CLOSED today (not a leak). Tracked, not a hard FAIL.
const OWNER_ONLY_PENDING = [
  'orders', 'customers', 'order_items', 'order_service_selections',
  'order_compliance_records', 'nursery_profiles', 'plant_events',
  'addons', 'social_drafts',
];
function cap3(key, v) {
  if (!isMultiTenant(v)) return SKIP(v.scopeNote);
  const sql = concatSql(v.migrationsDir);
  const misses = [];
  for (const [table, memberPolicy] of DUAL_TABLES) {
    const body = effectivePolicy(sql, memberPolicy);
    const hasMember = body && /is_active_member\s*\(/.test(body);
    const hasOwner = tableHasOwnerPolicy(sql, table) || (body && /owner_id\s*=\s*auth\.uid\(\)/.test(body));
    if (!hasMember || !hasOwner) {
      misses.push(`${table}: ${hasOwner ? '' : 'owner policy MISSING; '}${hasMember ? '' : 'member is_active_member policy MISSING'}`.trim());
    }
  }
  const gaps = OWNER_ONLY_PENDING
    .filter((t) => tableHasOwnerPolicy(sql, t) && !DUAL_TABLES.some(([d]) => d === t))
    .map((t) => `${t}: owner-only (member-read pending — documented product decision, fail-closed)`);
  if (misses.length === 0) {
    return PASS(`all ${DUAL_TABLES.length} member-scoped tenant tables carry dual RLS (owner + is_active_member).`, gaps);
  }
  return FAIL(`tables missing dual RLS: ${misses.join(' | ')}`, gaps);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 4 — Membership filters use the canonical is_active_member (no hand-spelled active)
//   Signal: every effective member policy (financial + dual) calls is_active_member(...), not an
//   inline EXISTS(... active = true ...). Documented exception: member_devices.md_self is a
//   self-device (member_id) scope that intentionally keeps a narrow inline `active = true`.
// ════════════════════════════════════════════════════════════════════════════════
function cap4(key, v) {
  if (!isMultiTenant(v)) return SKIP(v.scopeNote);
  const sql = concatSql(v.migrationsDir);
  const policies = [...new Set([...DUAL_TABLES.map(([, p]) => p), ...FINANCIAL_POLICIES.map(([p]) => p)])];
  const handSpelled = [];
  for (const policy of policies) {
    const body = effectivePolicy(sql, policy);
    if (!body) continue; // absence is cap2/cap3's concern, not cap4's
    const usesCanonical = /is_active_member\s*\(/.test(body);
    const inlineActive = /active\s*=\s*true/.test(body);
    if (!usesCanonical && inlineActive) handSpelled.push(policy);
  }
  // md_self documented exception (self-device member_id scope)
  const mdSelf = effectivePolicy(sql, 'md_self');
  const mdNote = mdSelf && /active\s*=\s*true/.test(mdSelf)
    ? 'member_devices.md_self keeps a narrow inline `active = true` (self-device member_id scope — documented exception, not widened to is_active_member).'
    : '';
  if (handSpelled.length === 0) {
    return PASS(
      `all ${policies.length} effective member policies route membership through is_active_member().` +
      (mdNote ? ` Exception: ${mdNote}` : ''),
    );
  }
  return FAIL(`member policies still hand-spelling \`active = true\` instead of is_active_member(): ${handSpelled.join(', ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 5 — confidence enum honored (no silent $0)
//   Signal: the four-value confidence enum is defined (type + DB CHECK), amounts are nullable
//   ("null = UNKNOWN", never coerced to 0), and the discovery layer actively ENFORCES it
//   (CostConfidenceViolation thrown; "NEVER fabricate a number to fill a gap").
// ════════════════════════════════════════════════════════════════════════════════
function cap5(key, v) {
  if (!isMultiTenant(v)) {
    return SKIP(v.scopeNote + ' (cost-discovery confidence is a multi-tenant cost-model primitive; Ignition pricing uses MarginEngine, not this enum).');
  }
  const c2p = read('packages/shared/src/business-logic/CostToProduce.ts');
  const seam = read('packages/shared/src/business-logic/CountOnceSeam.ts');
  const disc = read('packages/shared/src/discovery/costDiscovery.ts');
  const mig = concatSql(v.migrationsDir);

  const ENUM = /'CONFIRMED'\s*\|\s*'DERIVED'\s*\|\s*'ESTIMATED'\s*\|\s*'UNKNOWN'/;
  const checks = {
    'CostConfidence type (4 values)': ENUM.test(c2p),
    'DB CHECK on cost_confidence (4 values)': /cost_confidence IN \('CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'\)/.test(mig),
    'seam amount typed nullable (null = UNKNOWN)': /amount:\s*number\s*\|\s*null/.test(seam),
    'discovery enforces (CostConfidenceViolation thrown)': /throw new CostConfidenceViolation\(/.test(disc),
    'no-fabrication rule present ("NEVER fabricate")': /NEVER fabricate a number/.test(disc),
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length === 0) {
    return PASS(`confidence enum defined + DB-checked; amounts nullable; discovery throws CostConfidenceViolation; unknown stays UNKNOWN (no silent $0).`);
  }
  return FAIL(`confidence/no-silent-$0 signals missing: ${failed.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 6 — Cost-wall regression guard (Gate 3 / Staff HAR, encoded permanently)
//   The Staff HAR proved a member WITHOUT view_costs got `200 []` on every cost read
//   (cost_objects, business_inventory…unit_cost, business_pricing_config). That runtime
//   "zero rows" is STRUCTURALLY GUARANTEED by the RLS policy shape: each table's member
//   policy gates on the permission AND there is NO other permissive member policy that
//   provides an ungated read path. This guard encodes the HAR so the leak cannot silently
//   re-open (e.g. someone adds a permissive `USING(is_active_member(...))` SELECT policy
//   without the permission gate — Postgres ORs permissive policies, so that would leak).
//   This is the structural form of the HAR; the live dual-session HAR remains the
//   owner-proof. It needs NO live session — it is decidable from the migration SQL.
// ════════════════════════════════════════════════════════════════════════════════
const HAR_COST_TABLES = [
  ['cost_objects', 'view_costs'],
  ['business_inventory', 'view_costs'],
  ['business_pricing_config', 'view_pricing_config'],
];
function cap6(key, v) {
  if (!isMultiTenant(v)) return SKIP(v.scopeNote);
  const sql = concatSql(v.migrationsDir);
  const problems = [];
  for (const [table, perm] of HAR_COST_TABLES) {
    let permGatedMemberPolicy = false;
    for (const name of policyNamesOnTable(sql, table)) {
      const body = effectivePolicy(sql, name); // null = dropped-last (no effect)
      if (!body) continue;
      if (/AS\s+RESTRICTIVE/i.test(body)) continue; // restrictive only narrows; cannot leak
      const ownerScoped = /owner_id\s*=\s*auth\.uid\(\)/.test(body);
      const permGated =
        new RegExp(`has_permission\\([^)]*'${perm}'`).test(body) ||
        new RegExp(`permissions\\s*\\?\\s*'${perm}'`).test(body);
      if (permGated) permGatedMemberPolicy = true;
      // a permissive policy that is neither owner-scoped nor permission-gated = ungated read path
      if (!ownerScoped && !permGated) {
        problems.push(`${table}: permissive policy \`${name}\` is neither owner-scoped nor ${perm}-gated → ungated member read path (the leak re-opened)`);
      }
    }
    if (!permGatedMemberPolicy) {
      problems.push(`${table}: NO ${perm}-gated member policy — the cost wall for this table is GONE`);
    }
  }
  if (problems.length === 0) {
    return PASS(
      `HAR triplet (cost_objects, business_inventory, business_pricing_config) has NO ungated ` +
      `member read path: a member without view_costs/view_pricing_config matches zero rows (200 []). ` +
      `Encodes the Staff HAR (tamper 3/0) as a permanent structural guard.`,
    );
  }
  return FAIL(`cost-wall regression — Gate 3 leak path re-opened: ${problems.join(' | ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY 7 — WRITE-WALL: cost WRITES are permission-gated (the write-side twin of cap #6)
//   Was acceptance assertion (h); flipped LIVE 2026-06-22 (Gate-3b). Two structural guarantees,
//   both decidable from source (no live DB):
//   (a) the only service-key cost write — cost-apply in api/discovery/ingest.ts — gates the CALLER
//       on view_costs (resolved from the auth context) BEFORE the applyCostReasoning write, and
//       emits [TRACE:WRITEWALL] on refusal. No ungated service-key bypass.
//   (b) the HAR-triplet member policies carry has_permission in WITH CHECK (not only USING), so
//       INSERT/UPDATE by a member lacking the permission is RLS-refused — the write-side of the wall.
//   Behavioral proof of (a): scripts/verify-write-wall.ts (deterministic, injected RPC seam).
// ════════════════════════════════════════════════════════════════════════════════
function cap7(key, v) {
  if (!isMultiTenant(v)) return SKIP(v.scopeNote);
  const problems = [];
  // (a) endpoint gate — the caller-permission check precedes the service-key write
  const ep = read('packages/cultivar-os/api/discovery/ingest.ts');
  const gateIdx = ep.indexOf('callerHoldsPermission(req');
  const writeIdx = ep.indexOf('applyCostReasoning(costLine');
  if (gateIdx < 0) problems.push('cost-apply: no callerHoldsPermission gate on the request');
  else if (writeIdx < 0) problems.push('cost-apply: applyCostReasoning write not found (endpoint shape changed?)');
  else if (gateIdx > writeIdx) problems.push('cost-apply: permission gate runs AFTER the write (bypass)');
  if (!/\[TRACE:WRITEWALL\]/.test(ep)) problems.push('cost-apply: no [TRACE:WRITEWALL] refusal emit');
  if (!/VIEW_COSTS/.test(ep)) problems.push('cost-apply: gate does not reference VIEW_COSTS');
  // (b) RLS WITH CHECK write gate on the HAR triplet (write-side of cap #6)
  const sql = concatSql(v.migrationsDir);
  for (const [table, perm] of HAR_COST_TABLES) {
    let writeGated = false;
    for (const name of policyNamesOnTable(sql, table)) {
      const body = effectivePolicy(sql, name);
      if (!body || /AS\s+RESTRICTIVE/i.test(body)) continue;
      const wc = body.search(/WITH CHECK/i);
      if (wc < 0) continue;
      const after = body.slice(wc);
      if (new RegExp(`has_permission\\([^)]*'${perm}'`).test(after) ||
          new RegExp(`permissions\\s*\\?\\s*'${perm}'`).test(after)) writeGated = true;
    }
    if (!writeGated) problems.push(`${table}: no member policy with has_permission('${perm}') in WITH CHECK → INSERT/UPDATE ungated`);
  }
  if (problems.length === 0) {
    return PASS(
      `cost WRITES are gated: cost-apply service-key write requires view_costs (caller-context, pre-write, ` +
      `[TRACE:WRITEWALL] on refusal); HAR-triplet member policies carry has_permission in WITH CHECK → RLS ` +
      `refuses INSERT/UPDATE for a member without the permission. Write-side twin of cap #6 (behavioral proof: scripts/verify-write-wall.ts).`,
    );
  }
  return FAIL(`write-wall gap (Gate-3b regression): ${problems.join(' | ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY a — Tile visibility driven by the SINGLE registry, not hardcoded (D-012)
//   Promoted from ACCEPTANCE (a) → live 2026-06-23 (Tile Registry STAGE 2). Structural,
//   source-decidable: the registry is the one declared source; the three drift-lists that used
//   to define the dashboard grid (MODULE_META, MODULE_ORDER, Dashboard routing switches) are
//   GONE; useModules + Dashboard read the registry.
// ════════════════════════════════════════════════════════════════════════════════
function capA(key, v) {
  if (!isMultiTenant(v)) return SKIP('tile registry is a Cultivar multi-surface concern; Ignition tiles render from CoreApp (out of scope).');
  const reg  = read('packages/cultivar-os/src/registry/tileRegistry.ts');
  const um   = read('packages/cultivar-os/src/hooks/useModules.ts');
  const dash = read('packages/cultivar-os/src/pages/Dashboard.tsx');
  const problems = [];
  // (i) the registry exists and IS the source
  if (!/export const TILE_REGISTRY/.test(reg)) problems.push('tileRegistry.ts: no exported TILE_REGISTRY');
  if (!/export function dashboardTiles\b/.test(reg)) problems.push('tileRegistry.ts: no dashboardTiles() selector');
  // (i.b) vertical scope: every entry declares a vertical from the known set; enablement is
  //       vertical-aware (general tiles + the business's own vertical). general tiles must exist.
  //       NOTE: count over the TILE_REGISTRY block only — NAV_IA nodes below also use `key:` but
  //       are nav nodes, not tiles (they carry no vertical/required_permission).
  const navIaStart = reg.indexOf('export const NAV_IA');
  const tileBlockA = navIaStart > 0 ? reg.slice(0, navIaStart) : reg;
  const entryCountA = (tileBlockA.match(/\bkey:\s*'/g) || []).length;
  const verticalDecls = tileBlockA.match(/vertical:\s*'(general|cultivar|ignition|conduit|kinna)'/g) || [];
  if (entryCountA === 0 || verticalDecls.length < entryCountA) {
    problems.push(`not every entry declares a vertical from the known set (${verticalDecls.length}/${entryCountA})`);
  }
  if (!verticalDecls.some((d) => /'general'/.test(d))) problems.push('no general-vertical tiles (the shared spine)');
  if (!/export function dashboardTilesForVerticals\b/.test(reg)) problems.push('no dashboardTilesForVerticals() — enablement is not vertical-aware');
  if (!/from '\.\.\/registry\/tileRegistry'/.test(um) || !/verticalsForBusinessType|dashboardTilesForVerticals/.test(um)) {
    problems.push('useModules.ts: does not scope tiles by the business vertical');
  }
  // (ii) useModules reads the registry and no longer owns the catalog/order
  if (!/from '\.\.\/registry\/tileRegistry'/.test(um)) problems.push('useModules.ts: does not import the registry');
  // match the DECLARATION, not a mention in a docstring (the doc names them to say they're gone)
  if (/const\s+MODULE_META\b/.test(um)) problems.push('useModules.ts: MODULE_META drift-list still declared');
  if (/const\s+MODULE_ORDER\b/.test(um)) problems.push('useModules.ts: MODULE_ORDER drift-list still declared');
  // (iii) Dashboard reads the registry and no longer hardcodes the routing switches
  if (!/registry\/tileRegistry/.test(dash)) problems.push('Dashboard.tsx: does not read the registry');
  if (/function handleEnable\b/.test(dash) || /function handleNavigate\b/.test(dash)) {
    problems.push('Dashboard.tsx: hardcoded handleEnable/handleNavigate switch still present (routing must come from registry route)');
  }
  if (problems.length === 0) {
    return PASS('dashboard tile visibility + routing come from the single tileRegistry.ts; MODULE_META / MODULE_ORDER / routing-switch drift-lists are gone (useModules + Dashboard read the registry).');
  }
  return FAIL(`tile-registry single-source not established: ${problems.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY e — A newly registered tile's required_permission is selectable in the
//   role-builder WITHOUT a separate edit (D-010/D-012). Promoted from ACCEPTANCE (e) → live
//   2026-06-23. Structural: every registry entry carries required_permission AND a single
//   enumerator (registryPermissions / allTiles) exposes the whole set — so a role-builder that
//   reads those selectors picks up a new tile's permission automatically (no second list to edit).
// ════════════════════════════════════════════════════════════════════════════════
function capE(key, v) {
  if (!isMultiTenant(v)) return SKIP('role-config/marketplace are Cultivar surfaces over the Cultivar registry (out of scope for Ignition).');
  const reg = read('packages/cultivar-os/src/registry/tileRegistry.ts');
  // The role-config surface is now the agnostic MemberConsole, mounted by the Cultivar TeamConsole
  // wrapper — the wrapper is where the registry-fed chip catalog is built (registryPermissions()).
  const console_ = read('packages/cultivar-os/src/pages/TeamConsole.tsx');
  const problems = [];
  if (!/required_permission:\s*string/.test(reg)) problems.push('TileEntry has no required_permission field');
  if (!/export function registryPermissions\b/.test(reg)) problems.push('no registryPermissions() enumerator (role-builder source)');
  if (!/export function allTiles\b/.test(reg)) problems.push('no allTiles() selector (role-config/marketplace source)');
  // every entry must actually declare required_permission (count entries vs occurrences).
  // Scope to the TILE_REGISTRY block — NAV_IA nodes below also use `key:` but are not tiles.
  const navIaStartE = reg.indexOf('export const NAV_IA');
  const tileBlockE = navIaStartE > 0 ? reg.slice(0, navIaStartE) : reg;
  const entryCount = (tileBlockE.match(/\bkey:\s*'/g) || []).length;
  const permCount  = (tileBlockE.match(/required_permission:\s*'/g) || []).length;
  if (entryCount === 0 || permCount < entryCount) {
    problems.push(`not every entry declares required_permission (${permCount}/${entryCount})`);
  }
  // NOW EXERCISED: the role-config console must actually FEED its chips from registryPermissions()
  // (B2 one-source guarantee) — not a hardcoded permission list. This is what makes (e) real.
  if (!console_) problems.push('Team console wrapper (TeamConsole.tsx) not found — (e) cannot be exercised');
  else if (!/registryPermissions\(\)/.test(console_)) problems.push('Team console does not read registryPermissions() (chip list must be registry-fed, not hardcoded)');
  if (problems.length === 0) {
    return PASS(`every registry entry declares required_permission; registryPermissions()/allTiles() expose the full set AND the role-config console feeds its chips from registryPermissions() → a newly registered tile's permission is role-builder-selectable with no separate edit.`);
  }
  return FAIL(`role-builder single-source not established: ${problems.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY s — SELF-GRANT CLOSED: a member cannot widen its OWN role/permissions
//   (the bm_self_update hole). Highest-priority new assertion. Source-decidable from the
//   migration: bm_self_update now carries a WITH CHECK (was USING-only) AND a BEFORE UPDATE
//   trigger makes role/permissions immutable except by the owner. MB_D-015 on the perm table.
// ════════════════════════════════════════════════════════════════════════════════
function capS(key, v) {
  if (!isMultiTenant(v)) return SKIP('business_members self-grant guard is a multi-tenant RLS concern; Ignition is PIN/local-first (out of scope).');
  const sql = concatSql(v.migrationsDir);
  const problems = [];
  // (i) bm_self_update now carries a WITH CHECK (the hole was USING-only → could widen own row)
  const selfUpd = effectivePolicy(sql, 'bm_self_update');
  if (!selfUpd) problems.push('bm_self_update policy not found');
  else if (!/WITH CHECK/i.test(selfUpd)) problems.push('bm_self_update still has no WITH CHECK (self-grant hole open)');
  // (ii) authority-immutability trigger + function block role/permissions change except by owner
  if (!/CREATE OR REPLACE FUNCTION\s+public\.enforce_member_authority_immutability/.test(sql))
    problems.push('enforce_member_authority_immutability() not defined');
  if (!/CREATE TRIGGER\s+trg_business_members_authority_guard[\s\S]*?ON\s+business_members/.test(sql))
    problems.push('authority-guard trigger not installed on business_members');
  // (iii) the trigger actually compares role/permissions OLD vs NEW (not a no-op)
  if (!/NEW\.role\s+IS DISTINCT FROM\s+OLD\.role/.test(sql) || !/NEW\.permissions\s+IS DISTINCT FROM\s+OLD\.permissions/.test(sql))
    problems.push('trigger does not compare role/permissions OLD vs NEW');
  if (problems.length === 0) {
    return PASS('bm_self_update carries a WITH CHECK and a BEFORE UPDATE trigger blocks self-elevation — a member cannot widen its own role/permissions; only the owner can change them (MB_D-015).');
  }
  return FAIL(`self-grant guard incomplete: ${problems.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY f — Tenant role override/custom not visible cross-tenant; a tenant edit never
//   mutates the shared floor (clone-not-mutate). Promoted from ACCEPTANCE (f) → live 2026-06-23.
//   Source-decidable: role_definitions RLS (floor not tenant-writable, tenant rows owner-only +
//   member-scoped) + the console writes tenant rows via upsertTenantRole, never the floor.
// ════════════════════════════════════════════════════════════════════════════════
function capF(key, v) {
  if (!isMultiTenant(v)) return SKIP('role_definitions store is a Cultivar multi-tenant surface (out of scope for Ignition).');
  const sql = concatSql(v.migrationsDir);
  const mod = read('packages/shared/src/auth/roleDefinitions.ts');
  // The role editor is now the agnostic MemberConsole (Roles tab), mounted by TeamConsole.
  const ui  = read('packages/shared/src/components/team/MemberConsole.tsx');
  const problems = [];
  if (!/CREATE TABLE IF NOT EXISTS role_definitions/.test(sql)) problems.push('role_definitions table not created');
  if (!/ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY/.test(sql)) problems.push('role_definitions RLS not enabled');
  // tenant writes owner-only AND business_id-scoped → floor (business_id NULL) not tenant-writable; cross-tenant invisible (AC-3)
  const ownerWrite = effectivePolicy(sql, 'rd_owner_write');
  if (!ownerWrite) problems.push('rd_owner_write policy not found');
  else {
    if (!/business_id IS NOT NULL/.test(ownerWrite)) problems.push('rd_owner_write does not exclude the shared floor (business_id IS NOT NULL missing)');
    if (!/owner_id\s*=\s*auth\.uid\(\)/.test(ownerWrite)) problems.push('rd_owner_write not owner-scoped');
  }
  const readPol = effectivePolicy(sql, 'rd_read');
  if (!readPol || !/is_active_member/.test(readPol)) problems.push('rd_read does not scope tenant rows to active members (cross-tenant leak)');
  // clone-not-mutate at the code layer: tenant writes force non-system rows; console never mutates the floor
  if (!/is_system\s*\?\?\s*false/.test(mod)) problems.push('roleDefinitions: tenant insert does not force is_system=false');
  if (!/upsertTenantRole/.test(ui)) problems.push('console does not write via upsertTenantRole (clone-not-mutate)');
  if (!/!role\.locked/.test(ui)) problems.push('console does not lock system roles from delete (locked-role check)');
  if (problems.length === 0) {
    return PASS('role_definitions: shared floor is not tenant-writable; tenant rows are owner-only + member-scoped (cross-tenant invisible, AC-3); the console clones-not-mutates and locks system roles.');
  }
  return FAIL(`role-store isolation/clone-not-mutate gaps: ${problems.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY g — Factory-reset of a tuned system role DELETES the tenant override → the shared
//   floor shows through unchanged (NOT a snapshot restore). Promoted from ACCEPTANCE (g) → live.
// ════════════════════════════════════════════════════════════════════════════════
function capG(key, v) {
  if (!isMultiTenant(v)) return SKIP('role override / factory-reset is a Cultivar surface (out of scope for Ignition).');
  const mod = read('packages/shared/src/auth/roleDefinitions.ts');
  const ui  = read('packages/shared/src/components/team/MemberConsole.tsx');
  const problems = [];
  if (!/export async function deleteTenantRole/.test(mod) || !/\.delete\(\)/.test(mod)) problems.push('deleteTenantRole (override delete) missing');
  if (!/\.eq\('business_id', businessId\)/.test(mod)) problems.push('deleteTenantRole not business_id-scoped (could touch the floor)');
  if (!/factoryReset/.test(ui) || !/deleteTenantRole/.test(ui)) problems.push('console factory-reset does not delete the tenant override');
  if (problems.length === 0) {
    return PASS('factory-reset deletes the per-tenant override row (business_id-scoped) → the shared floor shows through unchanged; not a snapshot restore (MB_D-010).');
  }
  return FAIL(`factory-reset gaps: ${problems.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY n — Navigation IA lives in the SINGLE registry; every navigable surface declares a
//   breadcrumb path; breadcrumb + nav-rail both read it; mounted ONCE in the app layout (Nav C2).
//   Structural, source-decidable: the IA (NAV_IA) is registry data — NOT a parallel nav config that
//   could drift (the same three-list failure killed for the tile grid). The key guarantee: a new
//   navigable surface cannot ship without an IA node (same force as the tile assertion, cap #a).
// ════════════════════════════════════════════════════════════════════════════════
function capN(key, v) {
  if (!isMultiTenant(v)) return SKIP('navigation IA + breadcrumb/nav-rail are Cultivar multi-surface concerns; Ignition renders nav from CoreApp (out of scope).');
  const reg    = read('packages/cultivar-os/src/registry/tileRegistry.ts');
  const layout = read('packages/cultivar-os/src/components/layout/AppLayout.tsx');
  const crumb  = read('packages/cultivar-os/src/components/nav/Breadcrumb.tsx');
  const nav    = read('packages/cultivar-os/src/components/nav/AppNav.tsx');
  const problems = [];
  // (i) the IA lives in the registry (one source) + its readers are exported
  if (!/export const NAV_IA/.test(reg)) problems.push('tileRegistry.ts: no exported NAV_IA (the IA is not registry data)');
  if (!/export function breadcrumbForPath\b/.test(reg)) problems.push('tileRegistry.ts: no breadcrumbForPath() selector');
  if (!/export function navSections\b/.test(reg)) problems.push('tileRegistry.ts: no navSections() selector');
  // (ii) BOTH renderings read the ONE registry IA (no parallel nav list)
  if (!/breadcrumbForPath/.test(crumb)) problems.push('Breadcrumb.tsx does not read breadcrumbForPath() from the registry');
  if (!/navSections/.test(nav)) problems.push('AppNav.tsx does not read navSections() from the registry');
  // (iii) both are mounted once in the app layout (one mount, wraps every page)
  if (!/<Breadcrumb[\s/>]/.test(layout) || !/<AppNav[\s/>]/.test(layout)) problems.push('AppLayout does not mount <AppNav/> + <Breadcrumb/>');
  // (iv) every navigable private surface declares an IA node — a surface cannot ship without nav.
  const navBlock = reg.slice(reg.indexOf('export const NAV_IA'));
  const REQUIRED_NAV_KEYS = [
    'sec_dashboard', 'sec_settings', 'sec_admin',
    'nav_orders', 'nav_delivery', 'nav_delivery_route', 'nav_operating_costs',
    'nav_assets', 'nav_inventory', 'nav_receipts', 'nav_pmi', 'nav_social',
    'nav_campaigns', 'nav_campaign_detail', 'nav_help', 'nav_team', 'nav_add_business', 'nav_cost_to_produce',
  ];
  const missing = REQUIRED_NAV_KEYS.filter((k) => !navBlock.includes(`'${k}'`));
  if (missing.length) problems.push(`navigable surfaces with no IA node: ${missing.join(', ')}`);
  if (problems.length === 0) {
    return PASS('navigation IA lives in the single tileRegistry (NAV_IA); breadcrumb + nav-rail both read it; AppLayout mounts both once; every navigable surface declares a breadcrumb path — a new surface cannot ship without nav.');
  }
  return FAIL(`navigation IA single-source not established: ${problems.join('; ')}`);
}

// ── (r) NAV-INTEGRITY: every reachable ROUTE has a discoverable NAV entry (and vice-versa) ──
// The router declares route PATHS (<Route path=…>); the registry declares the NAV IA (route: …).
// A private route with NO nav route is URL-only / orphaned — a surface a reorg can strand
// (exactly the class that produced the scattered member-management this build consolidates).
// FAIL on any private router path that is neither nav-reachable nor a documented exception.
// Documented exceptions (legitimately nav-less): public/auth/checkout/plant/demo/discovery,
// redirects (/roles → /team, / → /dashboard), the /settings/:section param alias (its concrete
// sections ARE nav'd), first-run (/onboarding), and sub-flows reached from a parent surface
// (/assets/capture from /assets, /inventory/count from /inventory).
function capR(key, v) {
  if (!isMultiTenant(v)) return SKIP('routes + nav IA are Cultivar multi-surface concerns; Ignition renders nav from CoreApp (out of scope).');
  const router = read('packages/cultivar-os/src/router.tsx');
  const reg    = read('packages/cultivar-os/src/registry/tileRegistry.ts');

  const routerPaths = [...router.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
  const navRoutes   = [...new Set([...reg.matchAll(/route:\s*'(\/[^']*)'/g)].map((m) => m[1]))];

  // segment-wise pattern match (':' = wildcard), either direction
  const seg = (a, b) => {
    const pa = a.split('/'), pb = b.split('/');
    if (pa.length !== pb.length) return false;
    return pa.every((s, i) => s.startsWith(':') || pb[i].startsWith(':') || s === pb[i]);
  };
  const navReachable = (p) => navRoutes.some((r) => seg(p, r));

  const EXCEPTIONS = new Set([
    '/', '/login', '/signup', '/join', '/reset-pin', '/privacy', '/terms',
    '/checkout/customer', '/checkout/review', '/checkout/confirm',
    '/plant/:tagId', '/plant/:tagId/addons',
    '/demo/quickbooks-invoice', '/discovery/inspect',
    '/roles',                 // redirect → /team
    '/settings/:section',     // param alias; concrete sections (/settings/business|accounting|all) ARE nav'd
    '/onboarding',            // first-run flow
    '/assets/capture',        // sub-flow reached from /assets
    '/inventory/count',       // sub-flow reached from /inventory
  ]);

  const orphans  = routerPaths.filter((p) => !EXCEPTIONS.has(p) && !navReachable(p));
  // reverse: a nav route pointing at no router route (dead nav link) — param-aware
  const routerReachable = (r) => routerPaths.some((p) => seg(r, p));
  const deadNav  = navRoutes.filter((r) => !routerReachable(r));

  const problems = [];
  if (orphans.length) problems.push(`routes reachable but with NO nav entry (URL-only/orphaned): ${orphans.join(', ')}`);
  if (deadNav.length) problems.push(`nav entries pointing at no route (dead link): ${deadNav.join(', ')}`);
  if (problems.length === 0) {
    return PASS(`route↔nav integrity: all ${routerPaths.length} router paths are nav-reachable or a documented exception (${EXCEPTIONS.size} exceptions: public/auth/checkout/redirect/param/sub-flow); no dead nav links.`);
  }
  return FAIL(`route↔nav integrity broken: ${problems.join(' | ')}`);
}

// ── capability registry ──────────────────────────────────────────────────────────
const CAPS = [
  ['1', 'Persistent identity indicator in per-page layout/header', cap1],
  ['2', 'Financial/cost tables gated by has_permission', cap2],
  ['3', 'Dual RLS (owner + is_active_member) on every tenant table', cap3],
  ['4', 'Membership filters use canonical is_active_member', cap4],
  ['5', 'confidence enum honored (no silent $0)', cap5],
  ['6', 'Cost-wall regression guard (Gate 3 / Staff HAR encoded — READ side)', cap6],
  ['7', 'WRITE-WALL: cost writes permission-gated (endpoint + RLS WITH CHECK)', cap7],
  ['s', 'SELF-GRANT CLOSED: member cannot widen own role/permissions (bm_self_update WITH CHECK + authority trigger)', capS],
  ['n', 'Navigation IA in the registry — every surface has a breadcrumb path (Nav C2)', capN],
  ['r', 'Nav-integrity — every reachable route has a discoverable nav entry (no URL-only orphans)', capR],
  ['a', 'Tile visibility driven by the registry, not hardcoded (D-012)', capA],
  ['e', "New tile's required_permission selectable in role-builder w/o separate edit (D-010/D-012)", capE],
  ['f', 'Tenant override/custom not cross-tenant; floor not tenant-writable; clone-not-mutate (D-010, AC-3)', capF],
  ['g', 'Factory-reset deletes the tenant override → shared floor unchanged (D-010)', capG],
];

// ── ACCEPTANCE — Role Machine definition-of-done (NOT yet built) ────────────────────
// Checkable acceptance for the Role Machine doctrine (MASTER_BRIEF D-010..D-015). These
// ARE the definition-of-done — but they are reported SKIP-with-reason today ("not yet
// built; acceptance test, flip to live-assert when green") so the run stays clean and the
// gate is NOT chained on unbuilt work (green-then-guards: chain only when green). They do
// NOT enter the matrix and NEVER touch the fail counter. Each names the decision it proves.
// (h) is the write-side twin of cap #6 (the read wall) — the one that is EXPECTED-FAIL once
// asserted live, until the Gate-3b write-wall lands.
// (cap #1, the persistent identity header, is the existing acceptance test for that piece.)
const ACCEPTANCE_REASON = 'not yet built — acceptance test (definition-of-done); flip to live-assert when green.';
const ACCEPTANCE = [
  // (a) Tile visibility driven by the registry — PROMOTED to live cap #a (Tile Registry STAGE 2,
  //     2026-06-23). No longer a SKIP: the single tileRegistry.ts is the source; the three
  //     drift-lists are gone. See cap #a.
  ['b', 'Activation authority defaults to owner; revocation live/immediate (D-011)', ACCEPTANCE_REASON],
  ['c', 'Every activation writes an audit row (D-011)', ACCEPTANCE_REASON],
  ['d', 'Lapsed tile data obscured (fuzzy) not deleted; countdown end date persists across reload; restore requires payment (D-013)', ACCEPTANCE_REASON],
  // (e) New tile's required_permission selectable in role-builder — PROMOTED to live cap #e
  //     (Tile Registry STAGE 2, 2026-06-23): every entry carries required_permission and
  //     registryPermissions()/allTiles() expose the full set; the role-config console now feeds
  //     its chips from registryPermissions() (exercised). See cap #e.
  // (f) Tenant override/custom NOT cross-tenant; tenant edit never mutates the shared floor —
  //     PROMOTED to live cap #f (role-config console, 2026-06-23): role_definitions RLS keeps the
  //     floor non-tenant-writable + tenant rows owner/member-scoped; the console clones-not-mutates.
  // (g) Reset of a tuned system role removes the override → floor shows through unchanged —
  //     PROMOTED to live cap #g (2026-06-23): deleteTenantRole is business_id-scoped; the console
  //     factory-reset deletes the override. (Audit-row on reset is activation-authority's concern,
  //     a later rung — NOT this visibility-axis pass.)
  // (h) WRITE-WALL — PROMOTED to live cap #7 (Gate-3b, 2026-06-22). No longer a SKIP: the data-layer
  //     write wall holds (RLS WITH CHECK has_permission) and the one service-key bypass (cost-apply)
  //     is now caller-permission-gated. See cap #7 + scripts/verify-write-wall.ts.
];

// ── run the audit ─────────────────────────────────────────────────────────────────
const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', dim: '\x1b[2m', yellow: '\x1b[33m', bold: '\x1b[1m' };
const mark = (s) => ({ PASS: `${C.green}PASS${C.reset}`, FAIL: `${C.red}FAIL${C.reset}`, SKIP: `${C.dim}SKIP${C.reset}` }[s]);

console.log(`${C.bold}verify-universals — cross-vertical capability audit${C.reset}`);
console.log(`${C.dim}repo: ${ROOT}${C.reset}\n`);

let fails = 0;
const matrix = [];
for (const [key, v] of Object.entries(VERTICALS)) {
  console.log(`${C.bold}▸ ${v.label}${C.reset} ${C.dim}(${v.tenancy})${C.reset}`);
  for (const [id, title, fn] of CAPS) {
    const r = fn(key, v);
    matrix.push([v.label, id, r.status]);
    if (r.status === 'FAIL') fails++;
    console.log(`  ${mark(r.status)}  #${id} ${title}`);
    console.log(`        ${C.dim}${r.detail}${C.reset}`);
    for (const g of r.gaps || []) console.log(`        ${C.yellow}↳ KNOWN-GAP:${C.reset} ${C.dim}${g}${C.reset}`);
  }
  console.log('');
}

// ── matrix summary ─────────────────────────────────────────────────────────────────
console.log(`${C.bold}MATRIX${C.reset}`);
const verts = Object.values(VERTICALS).map((v) => v.label);
const w = Math.max(...verts.map((s) => s.length));
console.log(`  ${' '.repeat(38)}${verts.map((s) => s.padEnd(w + 2)).join('')}`);
for (const [id, title] of CAPS) {
  const cells = verts.map((label) => {
    const cell = matrix.find(([l, i]) => l === label && i === id)[2];
    return mark(cell) + ' '.repeat(w + 2 - 4);
  });
  console.log(`  #${id} ${title.slice(0, 34).padEnd(35)}${cells.join('')}`);
}

// ── acceptance summary (Role Machine definition-of-done) ───────────────────────────
// All SKIP today — printed for visibility, NOT counted toward fails, NOT chained into the gate.
console.log('');
console.log(`${C.bold}ACCEPTANCE — Role Machine (definition-of-done, not yet built)${C.reset}`);
console.log(`${C.dim}SKIP today; flip each to a live assertion when its piece is green. NOT chained into the build gate.${C.reset}`);
for (const [id, title, reason] of ACCEPTANCE) {
  console.log(`  ${mark('SKIP')}  (${id}) ${title}`);
  console.log(`        ${C.dim}${reason}${C.reset}`);
}

console.log('');
if (fails > 0) {
  console.log(`${C.red}${C.bold}✗ ${fails} in-scope capability assertion(s) FAILED.${C.reset} See FAIL lines above.`);
  process.exit(1);
}
console.log(`${C.green}${C.bold}✓ all in-scope capability assertions passed.${C.reset}`);
process.exit(0);
