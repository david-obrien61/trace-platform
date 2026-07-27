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
  // FLIPPED 2026-07-27 (20260727_rbac_resource_action_flip.sql). Each coarse `FOR ALL` policy
  // became verb-split policies, so the READ assertion names the SELECT policy and the fine
  // read string. The write verbs are asserted by cap #7, which is where they belong.
  ['cost_objects_member_select', 'costs:read'],
  ['business_inventory_member_select', 'inventory:read'],
  ['cost_object_edges_member_select', 'costs:read'],
  ['cost_object_assignments_member_select', 'costs:read'],
  ['business_service_log_member_select', 'pmi:read'],
  ['receipts_member_select', 'costs:read'],
  ['labor_resources_member_select', 'wages:read'],
  ['lrw_member_select', 'wages:read'], // labor_resource_wages
  ['bpc_member_select', 'pricing_recipe:read'], // business_pricing_config
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
  // FLIPPED 2026-07-27 — the `_member_all` policies were replaced by verb-split policies; dual
  // RLS is now proven by the SELECT half (the read path is what this cap exists to assert).
  ['receipts', 'receipts_member_select'],
  ['cost_objects', 'cost_objects_member_select'],
  ['business_inventory', 'business_inventory_member_select'],
  ['business_pmi_schedule', 'business_pmi_schedule_member_all'],
  ['business_service_log', 'business_service_log_member_select'],
  ['labor_resources', 'labor_resources_member_select'],
  ['cost_object_edges', 'cost_object_edges_member_select'],
  ['cost_object_assignments', 'cost_object_assignments_member_select'],
  ['deliveries', 'deliveries_member_select'],
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
  // FLIPPED 2026-07-27 — same wall, fine strings. The guard is unchanged in force: a member
  // WITHOUT the read string still matches zero rows (200 []).
  // 2026-07-27: the entry is now the RESOURCE, not one string per table. The coarse `FOR ALL`
  // policies split by verb, so a table's INSERT policy is gated on `<resource>:create` while its
  // SELECT is gated on `<resource>:read`. Asserting one string against every command would fail a
  // FINER wall as though it were a MISSING one — the wall did not weaken, it gained verbs.
  ['cost_objects', 'costs'],
  ['business_inventory', 'inventory'],
  ['business_pricing_config', 'pricing_recipe'],
];
function cap6(key, v) {
  if (!isMultiTenant(v)) return SKIP(v.scopeNote);
  const sql = concatSql(v.migrationsDir);
  const problems = [];
  for (const [table, resource] of HAR_COST_TABLES) {
    const readPerm = `${resource}:read`;
    let permGatedMemberPolicy = false;
    for (const name of policyNamesOnTable(sql, table)) {
      const body = effectivePolicy(sql, name); // null = dropped-last (no effect)
      if (!body) continue;
      if (/AS\s+RESTRICTIVE/i.test(body)) continue; // restrictive only narrows; cannot leak
      const ownerScoped = /owner_id\s*=\s*auth\.uid\(\)/.test(body);
      // ANY verb of this resource gates the policy; the READ half is asserted separately below.
      const permGated =
        new RegExp(`has_permission\\([^)]*'${resource}:[a-z_]+'`).test(body) ||
        new RegExp(`permissions\\s*\\?\\s*'${resource}:[a-z_]+'`).test(body);
      if (new RegExp(`has_permission\\([^)]*'${readPerm}'`).test(body)) permGatedMemberPolicy = true;
      // a permissive policy that is neither owner-scoped nor permission-gated = ungated read path
      if (!ownerScoped && !permGated) {
        problems.push(`${table}: permissive policy \`${name}\` is neither owner-scoped nor ${resource}:*-gated → ungated member read path (the leak re-opened)`);
      }
    }
    if (!permGatedMemberPolicy) {
      problems.push(`${table}: NO ${readPerm}-gated member SELECT policy — the cost wall for this table is GONE`);
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
  if (!/'costs:read'/.test(ep)) problems.push("cost-apply: gate does not reference 'costs:read'");
  // (b) RLS WITH CHECK write gate on the HAR triplet (write-side of cap #6)
  const sql = concatSql(v.migrationsDir);
  for (const [table, resource] of HAR_COST_TABLES) {
    // The write wall is now VERB-SPECIFIC: create/update (and delete where minted). Requiring the
    // READ string in WITH CHECK would demand the coarse policy back.
    const writeVerbs = '(create|update|delete|import_price)';
    let writeGated = false;
    for (const name of policyNamesOnTable(sql, table)) {
      const body = effectivePolicy(sql, name);
      if (!body || /AS\s+RESTRICTIVE/i.test(body)) continue;
      const wc = body.search(/WITH CHECK/i);
      if (wc < 0) continue;
      const after = body.slice(wc);
      if (new RegExp(`has_permission\\([^)]*'${resource}:${writeVerbs}'`).test(after) ||
          new RegExp(`permissions\\s*\\?\\s*'${resource}:${writeVerbs}'`).test(after)) writeGated = true;
    }
    if (!writeGated) problems.push(`${table}: no member policy with has_permission('${resource}:${writeVerbs}') in WITH CHECK → INSERT/UPDATE ungated`);
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
//   UPDATED 2026-07-23: tenant role writes now go through THE PERMISSION FUNNEL (save_role_permissions,
//   20260723_permission_funnel.sql), which writes the business_id-scoped tenant row AND
//   re-materializes member rows AND audits in one txn — never the floor. The RLS proof (floor
//   not tenant-writable, tenant rows owner-only + member-read-scoped) is unchanged.
// ════════════════════════════════════════════════════════════════════════════════
function capF(key, v) {
  if (!isMultiTenant(v)) return SKIP('role_definitions store is a Cultivar multi-tenant surface (out of scope for Ignition).');
  const sql = concatSql(v.migrationsDir);
  // The role editor is the agnostic MemberConsole (Roles tab), mounted by TeamConsole; it writes
  // through the funnel wrapper saveRolePermissions.
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
  // clone-not-mutate through the funnel: the funnel forces non-system tenant rows + inserts them
  // business_id-scoped (never the floor), and the console writes ONLY via the funnel wrapper.
  if (!/CREATE OR REPLACE FUNCTION public\.save_role_permissions/.test(sql)) problems.push('permission funnel (save_role_permissions) not present — role writes are not funneled');
  if (!/INSERT INTO public\.role_definitions[\s\S]*?false/.test(sql)) problems.push('funnel does not force is_system=false on a new tenant row');
  if (!/saveRolePermissions/.test(ui)) problems.push('console does not write roles via the funnel (saveRolePermissions)');
  if (/\b(?:upsertTenantRole|deleteTenantRole|updateMemberRole)\s*\(/.test(ui)) problems.push('console still CALLS a retired direct role writer (funnel bypass)');
  if (!/!role\.locked/.test(ui)) problems.push('console does not lock system roles from delete (locked-role check)');
  if (problems.length === 0) {
    return PASS('role_definitions: shared floor not tenant-writable; tenant rows owner-only + member-scoped (cross-tenant invisible, AC-3); all role writes funnel through save_role_permissions (business_id-scoped, non-system) and the console keeps no direct-write bypass.');
  }
  return FAIL(`role-store isolation/funnel gaps: ${problems.join('; ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY g — Factory-reset of a tuned system role DELETES the tenant override → the shared
//   floor shows through unchanged (NOT a snapshot restore). Promoted from ACCEPTANCE (g) → live.
//   UPDATED 2026-07-23: factory-reset now runs through the funnel (save_role_permissions op='reset'),
//   which DELETEs the business_id-scoped tenant row and re-materializes members to the floor.
// ════════════════════════════════════════════════════════════════════════════════
function capG(key, v) {
  if (!isMultiTenant(v)) return SKIP('role override / factory-reset is a Cultivar surface (out of scope for Ignition).');
  const sql = concatSql(v.migrationsDir);
  const ui  = read('packages/shared/src/components/team/MemberConsole.tsx');
  const problems = [];
  // the funnel's reset/delete branch is business_id-scoped so it can never touch the floor.
  if (!/DELETE FROM public\.role_definitions\s*\n?\s*WHERE business_id = p_business_id/.test(sql)) problems.push('funnel reset/delete not business_id-scoped (could touch the floor)');
  if (!/factoryReset/.test(ui) || !/'reset'/.test(ui)) problems.push('console factory-reset does not run the funnel reset op');
  if (problems.length === 0) {
    return PASS('factory-reset deletes the per-tenant override row through the funnel (business_id-scoped) → the shared floor shows through unchanged and members re-materialize to it; not a snapshot restore (MB_D-010).');
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
    'nav_services',   // the offerings editor's first-class nav destination (nav rewire 2026-07-07)
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
    '/', '/login', '/signup', '/join', '/device-handoff', '/reset-pin', '/privacy', '/terms',
    '/checkout/customer', '/checkout/review', '/checkout/confirm', '/checkout/addons',
    '/checkout/scan',         // sub-flow: multi-item scan-loop order entry, reached from /orders "New order"
    '/orders/:id',            // drill-in: order detail, reached by clicking a roster card on /orders
    '/customers/:id',         // drill-in: customer detail + order history, reached by clicking a name on /customers
    '/plant/:tagId', '/plant/:tagId/addons',
    '/demo/quickbooks-invoice', '/discovery/inspect',
    '/roles',                 // redirect → /team
    '/settings/:section',     // param alias; concrete sections (/settings/business|accounting|all) ARE nav'd
    '/onboarding',            // first-run flow
    '/assets/capture',        // sub-flow reached from /assets
    '/inventory/count',       // sub-flow reached from /inventory
    '/inventory/import',       // sub-flow reached from /inventory ("Import CSV" on the grid); VIEW_COSTS gate (import_pricing gates bulk price writes server-side)
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

// ════════════════════════════════════════════════════════════════════════════════
// CAPABILITY P — resource:action PERMISSION MODEL (spec v3 §7) — **WARN MODE**
//
//   THE METHOD FIX, STATED FIRST: this cap reads `packages/cultivar-os/api/**` as well as the
//   migrations, the router and the tile registry. Two prior analyses called `manage_orders`
//   theater because they scanned RLS and routes but NOT the API layer — the third enforcement
//   layer STD-020 names. A verifier that does not read the api layer REPRODUCES THE EXACT DEFECT
//   THIS REFIT EXISTS TO MAKE IMPOSSIBLE. See API_TEXT below.
//
//   SOURCE-BASED (spec R5). No DB connection; CI has no service key. The "is it actually applied
//   in this database" half stays a DAVID-QUERY at owner-prove, using the same pg_policies proof
//   the 20260724 migration used.
//
//   WARN MODE (spec §7 staging: describe → warn → close → fail): every finding is reported as a
//   KNOWN-GAP and the cap ALWAYS PASSES. It flips to FAIL at Phase 7 CONTRACT, once the findings
//   are closed or moved to ALLOWED_DIVERGENCE / declared-unwired with a recorded reason.
//
//   ACCEPTANCE TEST: capP carries its own PREDICTED flag list (build-plan §4, 16 flags) and
//   reports the DIFF between predicted and emitted. The prediction is NEVER edited to match the
//   output — a difference means the verifier is wrong, or the prediction under-counted, and
//   either way it is DAVID'S call, surfaced here rather than silently reconciled.
// ════════════════════════════════════════════════════════════════════════════════

// Build-plan §4's predicted first-run output. DO NOT EDIT TO MATCH REALITY.
const CAPP_PREDICTED = {
  P1:  'view_costs is coarse — one string, 6 FOR ALL policies, 4 routes (assertion 5)',
  P2:  'N1 social_drafts — route/table disagreement',
  P3:  'N2 campaigns — route/table disagreement',
  P4:  'N3 deliveries — route/table disagreement',
  P5:  'N4 PMI — route/table disagreement',
  P6:  'N5 customer write — route/table disagreement',
  P7:  'N6 anon residual — route/table disagreement',
  P8:  'service_offerings gate carries no permission string (assertion 2)',
  P9:  'inventory_ledger gate carries no permission string (assertion 2)',
  P10: 'get_business_tax_rate is membership-gated, no string (assertion 2)',
  P11: 'audit_log insert/read enforced with no declared string (assertion 2)',
  P12: 'manage_orders enforced at 4 api sites, zero RLS/route presence (assertion 1, api half)',
  P13: 'apply_discount declared, enforced by nothing (assertion 1) → UNWIRED',
  P14: 'override_maintenance declared, enforced by nothing (assertion 1) → UNWIRED',
  P15: 'view_dashboard / view_reports declared, no resource (assertion 1)',
  P16: 'view_margin / margin:read declared + confidential, enforced by no policy or RPC → derived',
  // ── AMENDED 16 → 20 (David's ruling, 2026-07-27) ────────────────────────────────────────────
  // capP's FIRST RUN surfaced four findings the build-plan §4 prediction did not contain. They are
  // recorded here as PREDICTED — found by the verifier, not by review — because Phase 7's
  // WARN→FAIL gate closes against this number and it cannot sit at a count we know is wrong.
  // The prediction is still never edited to MATCH output; it is amended by RULING, and that
  // distinction is the whole value of the acceptance test.
  P17: 'assets — no policy on business_assets checks any string resolving to assets:* (capP first run)',
  P18: 'settings — no policy on businesses checks any string resolving to settings:* (capP first run)',
  P19: 'team — no policy on role_definitions checks any string resolving to team:*; route+tile enforce it (capP first run)',
  P20: 'confidential-warning — 11 confidential permissions and MemberConsole has NO sensitivity-aware branch (spec §4, card N-5)',
};

/**
 * EXPECTED-BY-DESIGN, not a finding. `deliveries.route:update` is `declared-unwired` deliberately:
 * no route is persisted, so there is nothing to write. capP reports it as an unenforced resource,
 * which is correct and must NOT be counted as an open gap — it closes the day route persistence
 * ships, and until then it is held out of every bundle by R-B2/capQ.
 */
const CAPP_EXPECTED_BY_DESIGN = ['deliveries.route'];

/**
 * ALLOWED_DIVERGENCE — REQUIRED, NOT OPTIONAL (build-plan §4). Assertion 3 would otherwise fail
 * forever on two DELIBERATE designs. Every entry carries its recorded reason; a divergence list
 * with reasons is the mechanism that makes "recorded, not hidden" enforceable.
 */
const ALLOWED_DIVERGENCE = [
  {
    capability: '/orders',
    route: 'qr_checkout → orders:create',
    table: 'view_orders → orders:read',
    permanent: true,
    reason:
      'Note A, now PERMANENT under R1. Rule 1 is MODIFY-requires-read; create never requires ' +
      'read. A STAFF member may TAKE an order without browsing the business order history. The ' +
      'route and the table check different strings BY DESIGN, and a negative owner-test card ' +
      'proves the split stays true.',
  },
  {
    capability: '/costs',
    route: 'owner-only',
    table: 'view_costs → costs:read',
    permanent: true,
    reason:
      'D-009 — the deliberate moat. The route is STRICTER than the table: cost-to-produce is ' +
      'owner-only at the door while the underlying cost tables are permission-gated. Stricter-' +
      'at-the-route is the safe direction and is a recorded product decision.',
  },
];

// Resource → the table (or function) whose gate would enforce that resource's strings today.
// A resource whose gate checks NO permission string is a string with no enforcement — the
// "declared but nothing checks it" state assertion 1 exists to surface.
const RESOURCE_GATES = {
  orders: 'orders',
  order_items: 'order_items',
  order_service_selections: 'order_service_selections',
  order_compliance_records: 'order_compliance_records',
  customers: 'customers',
  service_offerings: 'service_offerings',
  inventory: 'business_inventory',
  inventory_ledger: 'inventory_ledger',
  deliveries: 'deliveries',
  'deliveries.route': 'deliveries',   // sub-resource — no table of its own (Rule 3)
  assets: 'business_assets',
  pmi: 'business_pmi_schedule',
  pricing_recipe: 'business_pricing_config',
  costs: 'cost_objects',
  wages: 'labor_resource_wages',
  settings: 'businesses',
  campaigns: 'campaigns',
  team: 'role_definitions',
  audit_log: 'audit_log',
};

/** Strip SQL line comments — a `has_permission(biz,'X')` inside a comment is NOT a gate. */
const stripSqlComments = (t) => t.replace(/--[^\n]*/g, '');
/** Strip JS/TS comments — same reason (a doc block naming a string is not an enforcement site). */
const stripJsComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** LIST every .ts under a dir tree (paths, not contents) — capK needs per-file verdicts. */
const listTreeFiles = (relDir) => {
  const abs = join(ROOT, relDir);
  if (!existsSync(abs)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ts')) out.push(full.slice(ROOT.length + 1));
    }
  };
  walk(abs);
  return out;
};
/** Immediate subdirectory names of a relative dir — used to discover each package api dir. */
const listDirs = (relDir) => {
  const abs = join(ROOT, relDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
};

/** Read every .ts under a dir tree (the api layer — the method fix). */
const readTree = (relDir) => {
  const abs = join(ROOT, relDir);
  if (!existsSync(abs)) return '';
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
        out.push(`\n-- FILE: ${full.slice(abs.length + 1)}\n` + readFileSync(full, 'utf8'));
      }
    }
  };
  walk(abs);
  return out.join('\n');
};

/** Parse the manifest SOURCE (the verifier has no TS runtime — same discipline as capF/capG). */
function parseManifest(src) {
  const model = {};        // permission → { resource, verb, status, sensitivity }
  const legacy = [];       // { legacy, replacements[], unwired }

  // RESOURCES block → four-verbs-per-resource, minus the dashes
  const rStart = src.indexOf('const RESOURCES: Record<string, EntrySeed> = {');
  const rEnd = src.indexOf('\n};', rStart);
  const rBlock = rStart >= 0 ? src.slice(rStart, rEnd) : '';
  const entryRe = /\n  '?([a-z_][a-z_.]*)'?: \{([\s\S]*?)\n  \},/g;
  let m;
  while ((m = entryRe.exec(rBlock))) {
    const [, resource, body] = m;
    const verbs = (body.match(/verbs: \[([^\]]*)\]/)?.[1] ?? '')
      .split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
    const sensitivity = body.match(/sensitivity: '([a-z-]+)'/)?.[1] ?? 'operational';
    const serverVerbs = (body.match(/server: \[([^\]]*)\]/)?.[1] ?? '')
      .split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
    const flatStatus = body.match(/status: '([a-z-]+)'/)?.[1] ?? null;
    const statusMap = {};
    const perVerb = body.match(/status: \{([^}]*)\}/)?.[1];
    if (perVerb) for (const s of perVerb.matchAll(/(\w+): '([a-z-]+)'/g)) statusMap[s[1]] = s[2];
    for (const verb of verbs) {
      model[`${resource}:${verb}`] = {
        resource, verb, sensitivity, server: serverVerbs.includes(verb),
        status: flatStatus ?? statusMap[verb] ?? 'enforced',
      };
    }
  }

  // CAPABILITY_VERBS block
  const cStart = src.indexOf('const CAPABILITY_VERBS');
  const cBlock = cStart >= 0 ? src.slice(cStart, src.indexOf('\n};', cStart)) : '';
  for (const c of cBlock.matchAll(/\n  '([a-z_]+:[a-z_]+)': \{([\s\S]*?)\n  \},/g)) {
    const [, permission, body] = c;
    const i = permission.lastIndexOf(':');
    model[permission] = {
      resource: permission.slice(0, i),
      verb: permission.slice(i + 1),
      status: body.match(/status: '([a-z-]+)'/)?.[1] ?? 'enforced',
      sensitivity: body.match(/sensitivity: '([a-z-]+)'/)?.[1] ?? 'operational',
      server: true,   // a capability verb is enforced by an RPC/api gate by definition
    };
  }

  // LEGACY_PERMISSIONS register
  const lStart = src.indexOf('export const LEGACY_PERMISSIONS');
  const lBlock = lStart >= 0 ? src.slice(lStart, src.indexOf('\n];', lStart)) : '';
  for (const l of lBlock.matchAll(/legacy: '([^']+)',\s*\n\s*replacements: \[([\s\S]*?)\],\s*\n\s*fate: '([a-z-]+)',\s*\n\s*unwired: (true|false)/g)) {
    legacy.push({
      legacy: l[1],
      replacements: l[2].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean),
      fate: l[3],
      unwired: l[4] === 'true',
    });
  }
  return { model, legacy };
}

// ════════════════════════════════════════════════════════════════════════════════
// capK — SERVICE-KEY WRITES MUST PROVE THE CALLER (MB_D-015). FAILS, not WARNS.
// NAME: David specified 'capR'. THE LETTER r IS ALREADY TAKEN by the nav-integrity cap
// (line ~669, matrix row #r), so this is capK — service-KEY authority. Renamed, not collided;
// two caps sharing a key would have silently overwritten one row of the matrix.
// ════════════════════════════════════════════════════════════════════════════════
// A handler that uses the SERVICE KEY bypasses RLS completely. On that path every policy in the
// platform is inert — the flip, the twenty *_owner_all policies, is_active_member,
// has_permission, all of it. So the handler must prove the CALLER's authority for the TARGET
// business ITSELF, from the AUTH CONTEXT (the Bearer token), NEVER from the request body. A
// forged businessId the caller does not belong to must fail.
//
// 🔴 WHY THIS CAP EXISTS. The doctrine was already written — verbatim, in
// packages/shared/src/auth/callerPermission.ts lines 2-9. orders/submit.ts obeys it FIFTEEN
// times. discovery/ingest.ts obeys it twice. SIX SIBLING ENDPOINTS IN THE SAME DIRECTORY IGNORED
// IT ENTIRELY, and nothing failed — no test, no gate, no review caught it, for months.
// A RULE ENFORCED BY MEMORY IS NOT ENFORCED. capK is what makes the 2026-07-27 sweep
// unrepeatable rather than a thing someone has to remember to redo.
//
// EXEMPTIONS ARE NAMED AND REASONED — never a bare path list (the ALLOWED_DIVERGENCE pattern).
const CAPK_EXEMPT = [
  {
    file: 'members/invite.ts',
    reason:
      'Authorises on a SINGLE-USE INVITE TOKEN carried in the body, which IS a credential. There ' +
      'is no session to read by construction — the invitee is not a member until they accept, so ' +
      'demanding a Bearer token here would make invitation impossible.',
  },
  {
    file: 'members/accept-invite.ts',
    reason: 'Same invite-token credential; the account does not exist yet at call time.',
  },
  {
    file: 'members/preview-invite.ts',
    reason: 'Same invite-token credential; read-only preview of the invitation the token names.',
  },
];

// Detectors extracted PURE so STD-022 probes can run them against planted bad input.
export const kUsesServiceKey = (src) => /SUPABASE_SERVICE_KEY|adminDb\s*\(\s*\)/.test(src);
export const kHasCallerGate = (src) =>
  /callerHoldsPermission|callerIsBusinessOwner|resolveCallerUid/.test(src) ||
  /headers\s*\??\.\s*authorization/i.test(src) ||
  /auth\s*\.\s*getUser\s*\(/.test(src);
/** Tenant id read off the request rather than resolved from the token — the forgeable surface. */
export const kTenantFromRequest = (src) =>
  src.split('\n').some((l) => /req\.(body|query)/.test(l) &&
    /\b(businessId|business_id|nurseryId|nursery_id|shopId|shop_id)\b/.test(l));
export const kIsExempt = (rel) => CAPK_EXEMPT.find((e) => rel.endsWith(e.file));

const K_PROBES = [
  ['detects-service-key',      () => kUsesServiceKey('const db = adminDb();') === true],
  ['detects-service-key-env',  () => kUsesServiceKey('process.env.SUPABASE_SERVICE_KEY!') === true],
  ['ignores-anon-handler',     () => kUsesServiceKey('createClient(url, ANON_KEY)') === false],
  ['detects-caller-gate',      () => kHasCallerGate('await callerIsBusinessOwner(authHeader, businessId)') === true],
  ['detects-raw-token-read',   () => kHasCallerGate('const t = req.headers?.authorization;') === true],
  ['planted-bad-endpoint',     () => {
    // the exact shape of the six: service key, tenant off the body, no gate. MUST be rejected.
    const bad = "const db = adminDb();\nconst { businessId } = req.body;\nawait db.from('x').insert({});";
    return kUsesServiceKey(bad) && !kHasCallerGate(bad) && kTenantFromRequest(bad);
  }],
  ['planted-good-endpoint',    () => {
    // orders/submit's shape. MUST NOT be rejected — a cap that flags everything is not a cap.
    const good = "const db = adminDb();\nconst { businessId } = req.body;\nif (!(await callerIsBusinessOwner(req.headers?.authorization, businessId))) return res.status(403).json({});";
    return kUsesServiceKey(good) && kHasCallerGate(good);
  }],
];

function capK(key, v) {
  if (!isMultiTenant(v)) return SKIP('service-key handlers are a Cultivar api-layer surface (Ignition is local-first PIN).');

  const dead = K_PROBES.filter(([, run]) => { try { return !run(); } catch { return true; } }).map(([n]) => n);
  if (dead.length) {
    return FAIL(
      `capK SELF-TEST FAILED — ${dead.length} detector(s) did not behave on planted input: ${dead.join(', ')}. ` +
      `The cap is NOT checking anything and any green from it is false.`,
      dead.map((n) => `probe '${n}' did not produce its engineered result.`),
    );
  }

  // CORPUS (STD-021): every .ts under the root api dir and each packages/<pkg>/api dir.
  const roots = ['api', ...listDirs('packages').map((d) => `packages/${d}/api`)];
  const files = [...new Set(roots.flatMap((r) => listTreeFiles(r)))];
  const gaps = [];
  let gated = 0, exempt = 0, anon = 0;

  for (const f of files) {
    const src = stripJsComments(read(f) || '');
    if (!kUsesServiceKey(src)) { anon++; continue; }
    const ex = kIsExempt(f);
    if (ex) { exempt++; continue; }
    if (kHasCallerGate(src)) { gated++; continue; }
    gaps.push(
      `${f} uses the SERVICE KEY (RLS bypassed) with NO caller-authority check` +
      `${kTenantFromRequest(src) ? ' AND takes the tenant id from the REQUEST' : ''} — ` +
      `authority must come from the AUTH CONTEXT, never the body (MB_D-015; the pattern is in orders/submit.ts).`,
    );
  }

  if (gaps.length) {
    return FAIL(
      `SERVICE-KEY AUTHORITY: ${gaps.length} handler(s) bypass RLS with no proof of the caller. ` +
      `${gated} gated · ${exempt} exempt-with-reason · ${anon} no-service-key. ` +
      `${K_PROBES.length}/${K_PROBES.length} planted probes behaved.`,
      gaps,
    );
  }
  return PASS(
    `every service-key handler proves the caller (${gated} gated · ${exempt} exempt-with-reason · ${anon} no-service-key). ` +
    `${K_PROBES.length}/${K_PROBES.length} planted probes behaved — the detectors are demonstrably running.`,
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// capQ — THE DECLARED-UNWIRED INVARIANT + THE `member` SENTINEL. FAILS, not WARNS.
// ════════════════════════════════════════════════════════════════════════════════
// NO default bundle and no role definition may hold a `declared-unwired` string, and the
// `member` sentinel may live in exactly one place. §7.1 filters a declared-unwired string out of
// the Roles-page catalog while MemberConsole.tsx:651 seeds its draft from the RESOLVED SET — so a
// held string with no chip survives every save and is UN-REMOVABLE without raw SQL.
//
// 🔴 THE DETECTORS ARE EXTRACTED PURE AND RUN AGAINST PLANTED BAD INPUT (STD-021, 2026-07-27).
// This cap reported PASS TWICE on checks that were not running — first a key pattern that
// required quotes (every unquoted resource entry invisible), then a list match truncated by a
// parenthesis inside a comment (zero strings captured). capP had done the same before it, and a
// close-out commit cited one of those greens as proof of correctness. An assertion never observed
// rejecting anything is not known to be running, and a silent detector is WORSE than no detector
// because the board shows green either way and the green is what people act on.
export const qParseUnwired = (manifestSrc) => {
  const unwired = new Set();
  // TWO ENTRY SHAPES, both required: quoted full-permission keys ('maintenance:override': {…})
  // and UNQUOTED resource keys (deliveries: {…}) carrying a per-verb status map.
  for (const m of manifestSrc.matchAll(/^  '?([a-z_.:]+)'?:\s*\{[\s\S]*?^  \},/gm)) {
    const [, resource] = m;
    const statusBlock = m[0].match(/status:\s*\{([^}]*)\}/);
    if (statusBlock) {
      for (const sm of statusBlock[1].matchAll(/(\w+):\s*'declared-unwired'/g)) unwired.add(`${resource}:${sm[1]}`);
    }
    if (/status:\s*'declared-unwired'/.test(m[0])) {
      if (resource.includes(':')) unwired.add(resource);
      else for (const vm of (m[0].match(/verbs:\s*\[([^\]]*)\]/) || [, ''])[1].matchAll(/'(\w+)'/g)) unwired.add(`${resource}:${vm[1]}`);
    }
  }
  return unwired;
};
export const qBundleViolations = (manifestSrc, unwired) => {
  const out = [];
  for (const name of ['MANAGER_DEFAULT_BUNDLE', 'STAFF_DEFAULT_BUNDLE']) {
    const block = manifestSrc.match(new RegExp(`export const ${name}: string\\[\\] = \\[([\\s\\S]*?)\\];`));
    if (!block) { out.push(`${name} not found — cannot assert the invariant over it.`); continue; }
    for (const pm of block[1].matchAll(/'([a-z_.]+:[a-z_]+)'/g)) {
      if (unwired.has(pm[1])) out.push(`${name} contains declared-unwired '${pm[1]}' — it would mint an UN-REMOVABLE grant (MemberConsole.tsx:651).`);
    }
  }
  return out;
};
export const qListViolations = (flipSql, unwired) => {
  const out = [];
  const notIn = flipSql.match(/a\.from_perm NOT IN \(([^)]*)\)/);
  if (!notIn) return ['the R-B2 `NOT IN (…)` output filter is missing or unparseable in the flip migration §5 — the floor rewrite would seed declared-unwired strings.'];
  const inSql = new Set([...notIn[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  for (const u of unwired) if (!inSql.has(u)) out.push(`declared-unwired '${u}' is NOT in the migration's R-B2 list — the floor rewrite would seed it.`);
  for (const q of inSql) if (!unwired.has(q)) out.push(`migration R-B2 excludes '${q}' but the manifest does not mark it declared-unwired — the list has rotted, or the status is wrong.`);
  return out;
};
export const qSentinelViolations = ({ routerSrc, manifestSrc, sqlAll }) => {
  const out = [];
  if (/PermissionRoute permission=["']member["']/.test(routerSrc)) out.push('`member` appears in a PermissionRoute — a route needing only membership needs NO gate. Legal home: tileRegistry required_permission ONLY.');
  if ([...manifestSrc.matchAll(/_BUNDLE[^=]*=\s*\[([\s\S]*?)\];/g)].some((b) => /'member'/.test(b[1]))) out.push('`member` appears in a default bundle — it is true by construction and must never be grantable.');
  if (/has_permission(?:_for)?\s*\([^)]*'member'/.test(sqlAll)) out.push('`member` is checked by an RLS policy or RPC — a tautology dressed as a gate.');
  return out;
};

// Each probe feeds a detector input ENGINEERED TO BE REJECTED. A clean return means the detector
// is dead. The two parser probes are the specific gaps that produced the two false greens.
const Q_PROBES = [
  ['parser/unquoted-key', () => qParseUnwired("  deliveries: {\n    verbs: ['read'],\n    status: { read: 'declared-unwired' },\n  },").size > 0],
  ['parser/quoted-key',   () => qParseUnwired("  'maintenance:override': {\n    status: 'declared-unwired',\n  },").size > 0],
  ['bundles',             () => qBundleViolations("export const MANAGER_DEFAULT_BUNDLE: string[] = [\n  'planted:bad',\n];", new Set(['planted:bad'])).length > 0],
  ['r-b2/missing-string', () => qListViolations("AND a.from_perm NOT IN ('other:thing')", new Set(['planted:bad'])).length > 0],
  ['r-b2/rotted-entry',   () => qListViolations("AND a.from_perm NOT IN ('planted:bad')", new Set()).length > 0],
  ['r-b2/unparseable',    () => qListViolations('no filter here at all', new Set()).length > 0],
  ['sentinel/route',      () => qSentinelViolations({ routerSrc: '<PermissionRoute permission="member" />', manifestSrc: '', sqlAll: '' }).length > 0],
  ['sentinel/bundle',     () => qSentinelViolations({ routerSrc: '', manifestSrc: "export const X_BUNDLE: string[] = [\n  'member',\n];", sqlAll: '' }).length > 0],
  ['sentinel/policy',     () => qSentinelViolations({ routerSrc: '', manifestSrc: '', sqlAll: "has_permission(business_id, 'member')" }).length > 0],
];

function capQ(key, v) {
  if (!isMultiTenant(v)) return SKIP('the resource:action permission model is a Cultivar multi-tenant-RLS surface.');

  // SELF-TEST FIRST — if a detector cannot reject planted bad input, nothing it says about the
  // real input means anything, so capQ fails BEFORE it reports on the real input.
  const dead = Q_PROBES.filter(([, run]) => { try { return !run(); } catch { return true; } }).map(([n]) => n);
  if (dead.length) {
    return FAIL(
      `capQ SELF-TEST FAILED — ${dead.length} detector(s) did NOT reject planted bad input: ${dead.join(', ')}. ` +
      `The invariant is NOT being checked and any green from it is false.`,
      dead.map((n) => `probe '${n}' returned clean against input engineered to be rejected — that detector is not running.`),
    );
  }

  const manifestSrc = read('packages/shared/src/auth/permissionManifest.ts');
  if (!manifestSrc) return FAIL('permissionManifest.ts not found — the invariant has no authority.');
  const flipSql = read('supabase/migrations/20260727_rbac_resource_action_flip.sql');
  if (!flipSql) return FAIL('20260727_rbac_resource_action_flip.sql not found — the R-B2 list cannot be reconciled.');

  const unwired = qParseUnwired(manifestSrc);
  const gaps = [
    ...qBundleViolations(manifestSrc, unwired),
    ...qListViolations(flipSql, unwired),
    ...qSentinelViolations({
      routerSrc: read('packages/cultivar-os/src/router.tsx') || '',
      manifestSrc,
      sqlAll: concatSql(v.migrationsDir),
    }),
  ];

  if (gaps.length) return FAIL(`declared-unwired invariant BROKEN — ${gaps.length} violation(s).`, gaps);
  return PASS(
    `declared-unwired invariant holds — ${unwired.size} string(s) [${[...unwired].sort().join(', ')}] absent from both bundles ` +
    `and reconciled with the migration's R-B2 list; \`member\` sentinel confined to tileRegistry. ` +
    `${Q_PROBES.length}/${Q_PROBES.length} planted-bad probes REJECTED — the detectors are demonstrably running.`,
  );
}

function capP(key, v) {
  if (!isMultiTenant(v)) return SKIP('the resource:action permission model is a Cultivar multi-tenant-RLS surface (Ignition is local-first PIN — out of scope).');

  const manifestSrc = read('packages/shared/src/auth/permissionManifest.ts');
  if (!manifestSrc) return FAIL('permissionManifest.ts not found — the model has no single source.');

  const sqlRaw    = concatSql(v.migrationsDir);
  const sql       = stripSqlComments(sqlRaw);
  const apiText   = stripJsComments(readTree('packages/cultivar-os/api'));   // ← THE METHOD FIX
  const router    = read('packages/cultivar-os/src/router.tsx');
  const registry  = read('packages/cultivar-os/src/registry/tileRegistry.ts');
  const console_  = read('packages/shared/src/components/team/MemberConsole.tsx');
  const mapDoc    = read('docs/standards/permission-enforcement-map.md');

  const { model, legacy } = parseManifest(manifestSrc);
  const flags = [];
  const FLAG = (id, text) => flags.push({ id, text });

  // alias resolution — a new string is enforced when a legacy antecedent gates it (spec §8)
  const aliasesOf = (perm) => {
    const out = [perm];
    for (const e of legacy) {
      if (e.legacy === perm) out.push(...e.replacements);
      if (e.replacements.includes(perm)) out.push(e.legacy);
    }
    return out;
  };
  // every permission string any gate actually CHECKS, per table
  const gatedStringsOn = (table) => {
    const strings = new Set();
    for (const name of policyNamesOnTable(sql, table)) {
      const body = effectivePolicy(sql, name);
      if (!body) continue;
      for (const g of body.matchAll(/has_permission(?:_for)?\s*\([^)]*?'([^']+)'\s*\)/g)) strings.add(g[1]);
    }
    return strings;
  };
  const allGatedStrings = new Set();
  for (const g of sql.matchAll(/has_permission(?:_for)?\s*\([^)]*?'([^']+)'\s*\)/g)) allGatedStrings.add(g[1]);
  const apiGatedStrings = new Set();
  // Capture the permission ARGUMENT of a caller-gate call — never a literal that merely happens
  // to sit near one. (The first pass spanned 200 chars and swallowed a `typeof x === 'object'`.)
  for (const g of apiText.matchAll(/callerHoldsPermission\s*\([^)]*?'([a-z_]+)'\s*\)/g)) apiGatedStrings.add(g[1]);
  for (const g of apiText.matchAll(/const\s+[A-Z_]+\s*=\s*'([a-z_]+)';/g)) apiGatedStrings.add(g[1]);
  const routeStrings = new Set([...router.matchAll(/permission=\{(?:LEGACY_PERMISSION\.[A-Z_]+|[A-Z_]+)\}/g)].map((x) => x[0]));
  const routerText = router + registry;

  // ── ASSERTION 1 — NO FAKE PILLS ───────────────────────────────────────────────
  // Every `enforced` string must be checked by a policy on ITS resource's table, an RPC, or an
  // api-layer gate — resolving through the alias layer. Reported per RESOURCE (a per-verb report
  // would say the same thing four times).
  // A verb the spec marks "✓ server" is enforced through an RPC / the api caller gate, NOT a
  // member table policy — a DELIBERATE, recorded design (§3), so it is not a gap. Flagging it
  // would report the checkout's service-key-after-proving-the-caller path as a missing gate.
  const unenforcedResources = new Set();
  for (const [perm, e] of Object.entries(model)) {
    if (e.status !== 'enforced' || e.server) continue;
    const table = RESOURCE_GATES[e.resource];
    const candidates = aliasesOf(perm);
    const onTable = table ? gatedStringsOn(table) : new Set();
    const enforced =
      candidates.some((c) => onTable.has(c)) ||
      candidates.some((c) => apiGatedStrings.has(c)) ||
      (!table && candidates.some((c) => allGatedStrings.has(c)));
    if (!enforced) unenforcedResources.add(e.resource);
  }
  const A1_PREDICTED = {
    service_offerings: 'P8', inventory_ledger: 'P9', tax_rate: 'P10', audit_log: 'P11',
    deliveries: 'P4', pmi: 'P5', campaigns: 'P3',
    // 2026-07-27 — the four capP's first run found that §4 had not predicted, promoted to
    // P17-P20 by David's ruling so the acceptance diff reconciles against the amended 20.
    assets: 'P17', settings: 'P18', team: 'P19',
  };
  for (const r of [...unenforcedResources].sort()) {
    // Rule 3: a dotted sub-resource has no table of its own. If its PARENT is already flagged,
    // reporting it again states one fact twice — the STD-011 defect, in a verifier.
    if (r.includes('.') && unenforcedResources.has(r.split('.')[0])) continue;
    // EXPECTED BY DESIGN — reported, but never counted as an open gap (see CAPP_EXPECTED_BY_DESIGN).
    if (CAPP_EXPECTED_BY_DESIGN.includes(r)) {
      FLAG(`BY-DESIGN:${r}`, `assertion 1 — resource '${r}': unenforced BY DESIGN. Its only write verb is declared-unwired (nothing persists a route), so there is nothing to gate. Held out of every bundle by R-B2/capQ; closes when route persistence ships.`);
      continue;
    }
    const id = A1_PREDICTED[r] ?? `EXTRA:${r}`;
    FLAG(id, `assertion 1 — resource '${r}': no policy on ${RESOURCE_GATES[r] ?? '(no table)'} checks any string that resolves to ${r}:* (membership-only or owner-only gate). The manifest names it; nothing enforces the name.`);
  }
  // the declared-unwired pair — declared, enforced by nothing (the fake pills)
  if (model['order_discount:apply']?.status === 'declared-unwired') {
    FLAG('P13', "assertion 1 — apply_discount / order_discount:apply is DECLARED and enforced by nothing: the capability IS gated at submit.ts:238, but by manage_orders. Made real in Phase 5 (re-point + the missing audit_log row).");
  }
  if (model['maintenance:override']?.status === 'declared-unwired') {
    FLAG('P14', "assertion 1 — override_maintenance / maintenance:override is DECLARED and enforced by nothing: NOTHING IN THE APP BLOCKS ON AN OVERDUE PMI, so there is no feature to override (R6). Hidden from the Roles page until the block is built.");
  }
  // retired strings still present in code
  const retired = legacy.filter((e) => e.fate === 'retire').map((e) => e.legacy);
  const retiredStillReferenced = retired.filter((r) => routerText.includes(`'${r}'`) || allGatedStrings.has(r));
  if (retiredStillReferenced.length) {
    FLAG('P15', `assertion 1 — RETIRED strings still referenced in code: ${retiredStillReferenced.join(', ')}. They map to no resource (R3) and are stripped at backfill (R-B).`);
  }
  // margin — declared + confidential, enforced by no policy or RPC
  if (model['margin:read']?.status === 'derived') {
    FLAG('P16', "assertion 1 — margin:read is CONFIDENTIAL and enforced by NO policy or RPC (client-only applyPermissionDependencies). Resolved as status `derived` (R9): enforced TRANSITIVELY via its Rule-2 prerequisite costs:read, which IS server-gated. Not `enforced`, and not a fake pill either.");
  }
  // the api-layer half — a string enforced ONLY in api/, invisible to an RLS+route scan
  const apiOnly = [...apiGatedStrings].filter((s) => !allGatedStrings.has(s) && !routerText.includes(`'${s}'`) && !routerText.includes(s.toUpperCase()));
  if (apiOnly.includes('manage_orders')) {
    FLAG('P12', "assertion 1 (API-LAYER HALF) — manage_orders is enforced at 4 sites in packages/cultivar-os/api/orders/submit.ts (1005 update, 1292 status, 1223 delete, 238 the discount path) with ZERO RLS and ZERO route presence. This is the flag two prior analyses could not produce because they never read the api layer. It is NOT theater; it maps to orders:update + orders:delete.");
  }

  // ── ASSERTION 2 — NO ORPHAN GATES ─────────────────────────────────────────────
  // Every string a gate checks must have a manifest home (model or legacy register).
  const known = new Set([...Object.keys(model), ...legacy.map((e) => e.legacy)]);
  // `p_perm` / `perm` / `X` are the RESOLVER's own parameter placeholders (has_permission's body
  // and its doc shape), not gate strings. Excluded by name, and stated so the exclusion is not a
  // silent swallow of a real orphan.
  const RESOLVER_PLACEHOLDERS = new Set(['perm', 'p_perm', '<perm>', 'X', 'permission']);
  const orphanGates = [...allGatedStrings, ...apiGatedStrings]
    .filter((s) => !known.has(s) && !RESOLVER_PLACEHOLDERS.has(s));
  if (orphanGates.length) {
    FLAG('EXTRA:orphan-gates', `assertion 2 — gate strings with NO manifest home: ${[...new Set(orphanGates)].join(', ')}. (audit_log's system INSERT writer is exempt by declaration — spec §3.)`);
  }

  // ── ASSERTION 3 — ROUTE == TABLE (STD-020), minus ALLOWED_DIVERGENCE ───────────
  // The recorded disagreements are read from the enforcement map — the artifact that OWNS this
  // reconciliation. capP gives the map teeth: a row recorded there is a flag here until closed.
  const disagreementBlock = mapDoc.slice(mapDoc.indexOf('## DISAGREEMENTS'));
  const recorded = [...disagreementBlock.matchAll(/^\| (N\d) \| \*\*([^*]+)\*\*/gm)].map((x) => ({ n: x[1], what: x[2].trim() }));
  const N_TO_P = { N1: 'P2', N2: 'P3', N3: 'P4', N4: 'P5', N5: 'P6', N6: 'P7' };
  for (const d of recorded) {
    const id = N_TO_P[d.n] ?? `EXTRA:${d.n}`;
    // N3/N4 also surface via assertion 1 (membership-only table) — report the map row once.
    if (flags.some((f) => f.id === id)) continue;
    FLAG(id, `assertion 3 — ${d.n} recorded in the enforcement map, still OPEN: ${d.what}. Route and table check different strings, and the divergence is NOT on ALLOWED_DIVERGENCE.`);
  }
  if (ALLOWED_DIVERGENCE.length < 2 || !ALLOWED_DIVERGENCE.every((d) => d.reason && d.reason.length > 40)) {
    FLAG('EXTRA:divergence-list', 'assertion 3 — ALLOWED_DIVERGENCE is missing an entry or a recorded reason. It is REQUIRED, not optional: without it assertion 3 fails forever on two deliberate designs.');
  }

  // ── ASSERTION 4 — DEPENDENCIES (all three classes) ────────────────────────────
  // The SQL floor's role definitions + the manifest bundles. create-without-read is NOT a
  // violation (R1) — it is REPORTED, for the Roles-page affordance.
  const depProblems = [];
  const bundleRe = /export const (MANAGER|STAFF)_DEFAULT_BUNDLE: string\[\] = \[([\s\S]*?)\];/g;
  let b;
  while ((b = bundleRe.exec(manifestSrc))) {
    const held = new Set(b[2].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean));
    for (const perm of held) {
      const e = model[perm];
      if (!e) { depProblems.push(`${b[1]} bundle holds '${perm}', which is not in the manifest (a dash, or a typo)`); continue; }
      if ((e.verb === 'update' || e.verb === 'delete') && !held.has(`${e.resource}:read`)) {
        depProblems.push(`${b[1]}: ${perm} without ${e.resource}:read (Rule 1)`);
      }
      if (e.resource.includes('.') && !held.has(`${e.resource.split('.')[0]}:read`)) {
        depProblems.push(`${b[1]}: ${perm} without ${e.resource.split('.')[0]}:read (Rule 3)`);
      }
    }
  }
  if (depProblems.length) FLAG('EXTRA:dependencies', `assertion 4 — dependency violations: ${depProblems.join('; ')}`);

  // create-without-read — REPORTED, never a violation (R1). This is the Roles-page affordance.
  const staffBlock = manifestSrc.match(/export const STAFF_DEFAULT_BUNDLE: string\[\] = \[([^\]]*)\]/)?.[1] ?? '';
  const staffHeld = staffBlock.split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
  const deliberate = staffHeld.filter((p) => p.endsWith(':create') && !staffHeld.includes(p.replace(/:create$/, ':read')));

  // ── ASSERTION 5 — VERB/COMMAND AGREEMENT + no string grants an absent verb ────
  const UNMINTABLE = ['customers:delete', 'service_offerings:delete', 'deliveries:delete', 'campaigns:delete', 'assets:delete'];
  // Scan EXECUTABLE positions only. The migration header, this cap, the manifest comments and
  // the owner-test cards all NAME these strings in order to assert their absence — a scan that
  // counts a doc mention would flag the documentation of the rule as a violation of it.
  const minted = UNMINTABLE.filter((p) =>
    p in model || sql.includes(`'${p}'`) || stripJsComments(routerText).includes(`'${p}'`) || apiText.includes(`'${p}'`));
  if (minted.length) {
    FLAG('EXTRA:unmintable', `assertion 5 — a verb the manifest marks ABSENT exists in code: ${minted.join(', ')}. R2/A3: these five have no tombstone, so the string must be unfindable.`);
  }
  // the coarse string — one permission, many FOR ALL policies, many routes
  // Count the DISTINCT tables whose effective member policy rides the one coarse string.
  const COARSE_TABLES = ['business_inventory', 'cost_objects', 'cost_object_edges',
                         'cost_object_assignments', 'business_service_log', 'receipts'];
  const coarse = COARSE_TABLES.filter((t) => gatedStringsOn(t).has('view_costs'));
  const forAllCount = coarse.length;
  const routeCount = [...router.matchAll(/permission=\{VIEW_COSTS\}/g)].length;
  if (forAllCount > 1) {
    FLAG('P1', `assertion 5 — view_costs is COARSE: ${forAllCount} tables (${coarse.join(', ')}) and ${routeCount} route gate(s) ride ONE string, so read and write cannot be separated and a read-only inventory viewer is inexpressible. This is the biggest split (1 → 14 strings across 5 resources).`);
  }

  // ── ASSERTION 6 — CONFIDENTIAL GRANTS SHOW THE HARD WARNING ───────────────────
  const confidential = Object.entries(model).filter(([, e]) => e.sensitivity === 'confidential').map(([p]) => p);
  const hasHardWarning = /sensitivit|confidential|exposes your/i.test(console_);
  if (confidential.length && !hasHardWarning) {
    FLAG('P20', `assertion 6 — ${confidential.length} confidential permissions (${[...new Set(confidential.map((p) => p.split(':')[0]))].join(', ')}) and MemberConsole.tsx has NO sensitivity-aware branch: granting cost/margin/wage access shows the same bland confirm as any other pill. This is the live defect spec §4 names.`);
  }

  // ── the acceptance diff: predicted vs emitted ─────────────────────────────────
  const emittedIds = new Set(flags.map((f) => f.id));
  const missing = Object.keys(CAPP_PREDICTED).filter((id) => !emittedIds.has(id));
  const extra = [...emittedIds].filter((id) => id.startsWith('EXTRA:'));
  const matched = Object.keys(CAPP_PREDICTED).filter((id) => emittedIds.has(id));

  const gaps = flags
    .sort((a, x) => a.id.localeCompare(x.id))
    .map((f) => `[${f.id}] ${f.text}`);
  gaps.push(`ACCEPTANCE DIFF — predicted ${Object.keys(CAPP_PREDICTED).length} · matched ${matched.length} · missing ${missing.length}${missing.length ? ` (${missing.join(', ')})` : ''} · EXTRA ${extra.length}${extra.length ? ` (${extra.map((e) => e.slice(6)).join(', ')})` : ''}. The prediction is NOT edited to match output — a difference is DAVID'S call.`);
  if (deliberate.length) {
    gaps.push(`REPORTED, NOT A VIOLATION (R1) — create-without-read grants for the Roles-page affordance: ${deliberate.join(', ')}. STAFF takes orders and cannot browse them; the page must name it as a deliberate choice, never a silent asymmetry.`);
  }
  gaps.push(`ALLOWED_DIVERGENCE (${ALLOWED_DIVERGENCE.length}, both permanent): ${ALLOWED_DIVERGENCE.map((d) => `${d.capability} [${d.route} vs ${d.table}]`).join(' · ')}`);

  return PASS(
    `WARN MODE — the model is asserted, nothing fails the build yet. Manifest: ${Object.keys(model).length} resource:verb strings, ${legacy.length} legacy strings registered, ${flags.length} finding(s). API layer READ (${apiText.length.toLocaleString()} chars) — the scan that would have caught the manage_orders misread. Flips to FAIL at Phase 7 CONTRACT.`,
    gaps,
  );
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
  ['p', 'resource:action permission model — manifest/policies/routes/API agree (spec v3 §7) [WARN]', capP],
  ['q', 'declared-unwired invariant — no bundle or role definition may hold an un-removable string', capQ],
  ['k', 'SERVICE-KEY handlers prove the caller — no RLS-bypassing write on an unproven identity (MB_D-015)', capK],
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
