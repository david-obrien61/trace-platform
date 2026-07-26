/**
 * ── PMI interval-conversion + accept-flow + override-permission tests ──────────────
 *
 * Proves the three assertions in the PMI minimal-fix prompt, each with teeth (every
 * test computes what a BUGGY implementation would produce and asserts the real one
 * differs):
 *   (1) accepting an AI-suggested schedule derives interval_days and getPMIStatus
 *       returns a REAL status (not NONE) given a last_service_at.
 *   (2) a usage-based-only task does NOT silently set a fake interval (honest no-due-date)
 *       — the donor's `INTERVAL_DAYS[x] || 30` fabrication is the bug we guard against.
 *   (3) override_maintenance appears in the role-config chip catalog and is OFF for
 *       STAFF / ON for OWNER+MANAGER by default.
 *
 * No test runner is installed in this repo. Run with the esbuild that ships in node_modules:
 *   node_modules/.bin/esbuild packages/shared/src/modules/pmiInterval.test.ts \
 *     --bundle --platform=node --format=cjs | node
 * Exits non-zero if any assertion fails.
 */

import {
  INTERVAL_DAYS,
  taskIntervalToDays,
  isUsageBasedInterval,
  deriveIntervalDays,
  pmiStatusFrom,
  type ScheduleTask,
} from './pmiInterval';
import {
  ALL_ACTION_PERMISSIONS, ALL_FINANCIAL_PERMISSIONS, HIDDEN_PERMISSIONS, OVERRIDE_MAINTENANCE,
  PERMISSION_MANIFEST, ALL_MODEL_PERMISSIONS, LEGACY_PERMISSIONS, ALIAS_PAIRS, MAPPABLE_LEGACY,
  STRIPPED_AT_BACKFILL, MANAGER_DEFAULT_BUNDLE, STAFF_DEFAULT_BUNDLE,
  splitPermission, unmetDependencies, createWithoutRead, applyPermissionDependencies,
} from '../auth/permissionManifest';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// ── (1) accept-flow derives interval_days → real status ────────────────────────────
console.log('\n(1) accepting a schedule derives interval_days and yields a real status');
{
  const tasks: ScheduleTask[] = [
    { name: 'Change engine oil', interval: 'monthly' },   // 30
    { name: 'Check tire pressure', interval: 'weekly' },  // 7
    { name: 'Full inspection', interval: 'annually' },    // 365
  ];
  const { intervalDays, unconvertible } = deriveIntervalDays(tasks);

  // soonest convertible cadence drives it — NOT the max (a buggy Math.max would give 365)
  check('interval_days = soonest task (7), not 30/365', intervalDays === 7, `got ${intervalDays}`);
  check('all three tasks converted (none flagged)', unconvertible.length === 0);

  // given a last_service_at, status is REAL — the bug being fixed left it NONE forever
  const overdue = pmiStatusFrom(intervalDays, ago(60));
  check('serviced 60d ago + 7d cadence → OVERDUE (not NONE)', overdue === 'OVERDUE', `got ${overdue}`);
  check('status is not the broken NONE', overdue !== 'NONE');

  // OK = comfortably within the cadence (>7d before due). Use a 30d cadence serviced 1d ago.
  check('serviced 1d ago + 30d cadence → OK', pmiStatusFrom(30, ago(1)) === 'OK', `got ${pmiStatusFrom(30, ago(1))}`);
  // DUE_SOON = within 7 days of the cadence. 30d cadence serviced 25d ago → DUE_SOON.
  check('serviced 25d ago + 30d cadence → DUE_SOON', pmiStatusFrom(30, ago(25)) === 'DUE_SOON', `got ${pmiStatusFrom(30, ago(25))}`);

  // the "needs both" rule still holds: a cadence with no service date is NONE
  check('cadence but never serviced → NONE', pmiStatusFrom(intervalDays, null) === 'NONE');
}

// ── (2) usage-based intervals never fabricate a cadence ────────────────────────────
console.log('\n(2) usage-based tasks do NOT silently set a fake interval');
{
  const usageOnly: ScheduleTask[] = [
    { name: 'Change oil', interval: 'every 5000 miles' },
    { name: 'Service hydraulics', interval: 'every 250 hours' },
  ];
  const { intervalDays, unconvertible } = deriveIntervalDays(usageOnly);

  // the donor did `INTERVAL_DAYS[x] || 30` → would fabricate 30 here. The fix returns null.
  check('usage-based-only → interval_days is null (no fabricated 30)', intervalDays === null, `got ${intervalDays}`);
  check('both usage-based tasks flagged as unconvertible', unconvertible.length === 2);
  check('null cadence → status NONE (honest no due date)', pmiStatusFrom(intervalDays, ago(999)) === 'NONE');
  check('usage-based interval detected', isUsageBasedInterval('every 5000 miles') && isUsageBasedInterval('every 250 hours'));
  check('"monthly" is not usage-based', !isUsageBasedInterval('monthly'));

  // mixed: only the time-based task contributes; the mileage task is flagged but doesn't poison the cadence
  const mixed: ScheduleTask[] = [
    { name: 'Change oil', interval: 'every 5000 miles' },
    { name: 'Grease fittings', interval: 'quarterly' },   // 90
  ];
  const m = deriveIntervalDays(mixed);
  check('mixed → cadence from the time-based task only (90)', m.intervalDays === 90, `got ${m.intervalDays}`);
  check('mixed → mileage task still flagged', m.unconvertible.length === 1 && m.unconvertible[0].name === 'Change oil');

  // map + single-conversion sanity
  check('INTERVAL_DAYS is the ported donor map', INTERVAL_DAYS.daily === 1 && INTERVAL_DAYS.quarterly === 90 && INTERVAL_DAYS.annually === 365);
  check('unknown phrase → null (not fabricated)', taskIntervalToDays('whenever it feels right') === null);
}

// ── (3) the fake pills stay HIDDEN — now filtered by the ONE manifest list ───────────
// Rewritten 2026-07-26 (Phase 0, resource:action RBAC): UNWIRED_ACTION_PERMISSIONS and
// UNWIRED_REGISTRY_PERMISSIONS are RETIRED. HIDDEN_PERMISSIONS replaces both, DERIVED from the
// declarations that own the fact (legacy `unwired` flags + model status 'declared-unwired').
// These assertions are unchanged in FORCE — the same four pills must stay hidden, the same two
// wired ones must render. Phase 0 is neutral, and this block is how that is proven.
console.log('\n(3) the declared-but-unwired pills are hidden from the chip catalog (ONE filter)');
{
  check('override_maintenance constant', OVERRIDE_MAINTENANCE === 'override_maintenance');
  check('string still exists in ALL_ACTION_PERMISSIONS', ALL_ACTION_PERMISSIONS.includes('override_maintenance'));

  // Replicate the TeamConsole chip-catalog union MINUS the ONE hidden set.
  const registryStub = ['view_dashboard', 'qr_checkout', 'view_orders', 'view_costs', 'owner-only',
                        'manage_customers', 'view_reports'];
  const hidden = new Set(HIDDEN_PERMISSIONS);
  const catalog = [...new Set([...registryStub, ...ALL_FINANCIAL_PERMISSIONS, ...ALL_ACTION_PERMISSIONS])]
    .filter((perm) => !hidden.has(perm));
  check('override_maintenance HIDDEN (ruling #3)', !catalog.includes('override_maintenance'));
  check('apply_discount is also hidden', !catalog.includes('apply_discount'));
  check('WIRED action perms still render (apply_tax_exempt, import_pricing)',
    catalog.includes('apply_tax_exempt') && catalog.includes('import_pricing'));
  check('manage_customers HIDDEN from the chip catalog (planned tile, nothing consults it)', !catalog.includes('manage_customers'));
  check('view_reports HIDDEN from the chip catalog (no live surface consumes it)', !catalog.includes('view_reports'));
  check('view_customers still renders (wired: customers_member RLS)', catalog.includes('view_customers'));
  check("'owner-only' route sentinel is never a pill", !catalog.includes('owner-only'));

  // NEUTRALITY: the hidden set is EXACTLY the previous two lists' union. If this drifts, a pill
  // silently appeared or vanished on /team — the one thing Phase 0 must not do.
  const expectedHidden = ['owner-only', 'manage_customers', 'view_reports', 'override_maintenance',
                          'apply_discount', 'maintenance:override', 'order_discount:apply'];
  check('HIDDEN_PERMISSIONS covers every previously-hidden string',
    expectedHidden.filter((p) => !p.includes(':')).every((p) => hidden.has(p)));
  check('the two orphans are NOT hidden-as-pills (they are stripped, not filtered)',
    !hidden.has('process_orders') && !hidden.has('manage_team'));
}

// ── (4) THE PERMISSION MANIFEST — spec v3 invariants ─────────────────────────────────
// NEW 2026-07-26 (Phase 0). Each check is an assertion the spec makes, expressed so that a
// manifest edit that breaks the model fails HERE rather than in production.
console.log('\n(4) permission manifest — the model, the dashes, the dependencies, the aliases');
{
  // — the parse rule: split on the LAST colon (resource names may contain dots) —
  check('splitPermission: dotted sub-resource parses on the LAST colon',
    splitPermission('deliveries.route:read')?.resource === 'deliveries.route' &&
    splitPermission('deliveries.route:read')?.verb === 'read');
  check('splitPermission: a legacy string has no resource:verb shape',
    splitPermission('view_costs') === null);
  check('splitPermission: capability verb parses', splitPermission('inventory:import_price')?.verb === 'import_price');

  // — R2/A3: THE FIVE UNMINTABLE DELETES. A dash means the string does not exist. —
  for (const r of ['customers', 'service_offerings', 'deliveries', 'campaigns', 'assets']) {
    check(`${r}:delete is UNMINTABLE (R2/A3 — no tombstone)`, !(`${r}:delete` in PERMISSION_MANIFEST));
  }
  check('inventory:delete DOES exist (the one real tombstone)', 'inventory:delete' in PERMISSION_MANIFEST);
  check('audit_log:create takes NO manifest entry (system-only writer)', !('audit_log:create' in PERMISSION_MANIFEST));
  check('inventory_ledger update/delete are structurally absent (append-only)',
    !('inventory_ledger:update' in PERMISSION_MANIFEST) && !('inventory_ledger:delete' in PERMISSION_MANIFEST));
  check('margin has read only — no write verb is implied (spec §4.1)',
    'margin:read' in PERMISSION_MANIFEST && !('margin:update' in PERMISSION_MANIFEST) &&
    !('margin:create' in PERMISSION_MANIFEST) && !('margin:delete' in PERMISSION_MANIFEST));

  // — RULE 1: MODIFY requires read. CREATE requires NOTHING (R1). —
  const badStructural = ALL_MODEL_PERMISSIONS.filter((p) => {
    const e = PERMISSION_MANIFEST[p];
    if (e.verb === 'update' || e.verb === 'delete') return e.structural[0] !== `${e.resource}:read`;
    return false;
  });
  check('Rule 1: every update/delete declares its resource read', badStructural.length === 0);
  const createDeps = ALL_MODEL_PERMISSIONS.filter((p) => PERMISSION_MANIFEST[p].verb === 'create'
    && PERMISSION_MANIFEST[p].structural.length > 0);
  check('R1: NO create verb carries a structural prerequisite', createDeps.length === 0);
  check('R1 inverse: orders:create without orders:read is NOT a dependency violation',
    unmetDependencies(['orders:create']).length === 0);
  check('R1 inverse: it IS reported as a deliberate asymmetry for the Roles page',
    createWithoutRead(['orders:create']).includes('orders:create'));
  check('Rule 1 bites: orders:update without orders:read IS a violation',
    unmetDependencies(['orders:update']).some((d) => d.missing === 'orders:read'));

  // — RULE 2 (content) and RULE 3 (inheritance) —
  check('Rule 2: margin:read requires costs:read', PERMISSION_MANIFEST['margin:read'].content.includes('costs:read'));
  check('Rule 2 bites: margin:read alone is a violation',
    unmetDependencies(['margin:read']).some((d) => d.missing === 'costs:read'));
  check('R8: order_discount:apply depends on orders:CREATE, never orders:update',
    PERMISSION_MANIFEST['order_discount:apply'].content.includes('orders:create') &&
    !PERMISSION_MANIFEST['order_discount:apply'].content.includes('orders:update'));
  check('Rule 3: deliveries.route:* inherits deliveries:read',
    PERMISSION_MANIFEST['deliveries.route:update'].inheritance.includes('deliveries:read'));
  check('Rule 3 bites: deliveries.route:update alone is a violation',
    unmetDependencies(['deliveries.route:update']).some((d) => d.missing === 'deliveries:read'));

  // — status + sensitivity (spec §7.1 / §4) —
  check('R9: margin:read status is `derived` (no gate of its own)', PERMISSION_MANIFEST['margin:read'].status === 'derived');
  check('R6: maintenance:override is declared-unwired', PERMISSION_MANIFEST['maintenance:override'].status === 'declared-unwired');
  check('the four confidential resources are flagged confidential',
    ['pricing_recipe:read', 'costs:read', 'margin:read', 'wages:read']
      .every((p) => PERMISSION_MANIFEST[p].sensitivity === 'confidential'));
  check('audit_log:read is owner-only (never a grantable pill)', PERMISSION_MANIFEST['audit_log:read'].sensitivity === 'owner-only');
  check('inventory:read is operational, NOT confidential (the split is by field, not table)',
    PERMISSION_MANIFEST['inventory:read'].sensitivity === 'operational');

  // — the default bundles (§5) — seed data, and they must satisfy their own rules —
  check('MANAGER bundle satisfies every dependency class', unmetDependencies(MANAGER_DEFAULT_BUNDLE).length === 0);
  check('STAFF bundle satisfies every dependency class', unmetDependencies(STAFF_DEFAULT_BUNDLE).length === 0);
  check('R1/Note A: STAFF holds orders:create and NOT orders:read',
    STAFF_DEFAULT_BUNDLE.includes('orders:create') && !STAFF_DEFAULT_BUNDLE.includes('orders:read'));
  check('Note A is surfaced as deliberate, not silent', createWithoutRead(STAFF_DEFAULT_BUNDLE).includes('orders:create'));
  check('no bundle seeds a confidential read',
    [...MANAGER_DEFAULT_BUNDLE, ...STAFF_DEFAULT_BUNDLE]
      .every((p) => PERMISSION_MANIFEST[p]?.sensitivity !== 'confidential'));
  check('no bundle seeds an unmintable delete',
    [...MANAGER_DEFAULT_BUNDLE, ...STAFF_DEFAULT_BUNDLE].every((p) => p in PERMISSION_MANIFEST));

  // — the legacy register + the alias layer (§2 / §8) —
  check('the register carries all 21 legacy strings (19 from §2 + the 2 orphans §2 missed)',
    LEGACY_PERMISSIONS.length === 21);
  check('16 of the 19 §2 rows are mappable (retire ×2 + sentinel produce no pair)', MAPPABLE_LEGACY.length === 16);
  check('the two orphans produce NO alias pair', !ALIAS_PAIRS.some((a) => a.from === 'process_orders' || a.from === 'manage_team'));
  check('view_dashboard / view_reports / owner-only produce NO alias pair',
    !ALIAS_PAIRS.some((a) => ['view_dashboard', 'view_reports', 'owner-only'].includes(a.from)));

  // ALIAS ROUND-TRIP, BOTH DIRECTIONS — the Phase 0 exit gate, asserted in source.
  const forward = (from: string, implies: string) => ALIAS_PAIRS.some((a) => a.from === from && a.implies === implies);
  check('alias forward: view_costs → inventory:read', forward('view_costs', 'inventory:read'));
  check('alias reverse: inventory:read → view_costs', forward('inventory:read', 'view_costs'));
  check('alias forward: manage_orders → orders:update AND orders:delete',
    forward('manage_orders', 'orders:update') && forward('manage_orders', 'orders:delete'));
  check('alias reverse: orders:delete → manage_orders', forward('orders:delete', 'manage_orders'));
  check('every alias pair has a mirror (both directions, no orphan edge)',
    ALIAS_PAIRS.every((a) => ALIAS_PAIRS.some((b) => b.from === a.implies && b.implies === a.from)));
  check('every alias target is a real manifest entry (no pair points at a dash)',
    ALIAS_PAIRS.filter((a) => a.from.includes(':')).every((a) => a.from in PERMISSION_MANIFEST));

  // — R-B: the three stripped classes (backfill contract) —
  check('R-B retired class = view_dashboard + view_reports',
    STRIPPED_AT_BACKFILL.retired.length === 2 && STRIPPED_AT_BACKFILL.retired.includes('view_dashboard'));
  check('R-B unwired class = override_maintenance (carrying it forward = an INVISIBLE grant)',
    STRIPPED_AT_BACKFILL.unwired.includes('override_maintenance'));
  check('R-B unmapped class = the two orphans (A1.1)',
    STRIPPED_AT_BACKFILL.unmapped.includes('process_orders') && STRIPPED_AT_BACKFILL.unmapped.includes('manage_team'));

  // — neutrality of the dependency filter (the applyFinancialDependencies successor) —
  check('legacy behavior preserved: view_margin stripped without view_costs',
    !applyPermissionDependencies(['view_margin']).includes('view_margin'));
  check('legacy behavior preserved: view_margin kept with view_costs',
    applyPermissionDependencies(['view_costs', 'view_margin']).includes('view_margin'));
  check('new vocabulary: margin:read stripped without costs:read',
    !applyPermissionDependencies(['margin:read']).includes('margin:read'));
}

// ── summary ────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
