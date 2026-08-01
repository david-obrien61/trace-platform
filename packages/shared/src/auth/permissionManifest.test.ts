/**
 * ── THE PERMISSION MANIFEST — model invariants + chip-catalog filter ──────────────────
 *
 * PURPOSE      Assert the RBAC model itself: the resource:action parse rule, the five
 *              unmintable deletes, Rules 1/2/3 (and that each BITES), status/sensitivity,
 *              the default bundles, the legacy register, the alias round-trip in BOTH
 *              directions, the three stripped classes, and the chip-catalog hidden set.
 *              Every check is an assertion the RBAC spec makes, expressed so that a
 *              manifest edit which breaks the model fails HERE rather than in production.
 * DEPENDENCIES ../auth/permissionManifest (the declarations under test). No DB, no React.
 * OUTPUTS      pass/fail counts; exits non-zero on any failure.
 *
 * ⚠️ WHY THIS FILE EXISTS SEPARATELY (2026-07-30 — the split, David's instruction):
 *   These 100+ assertions were written INSIDE `modules/pmiInterval.test.ts`, a file named
 *   for maintenance scheduling, because the PMI build was where `override_maintenance`
 *   first needed a chip-catalog check and the permission block grew there afterwards.
 *   The whole permission model was therefore under a filename nobody would ever open when
 *   asking "what proves the RBAC model?" — which is why the two stale STAFF-bundle
 *   assertions below sat unread. Home an assertion with the thing it asserts (STD-011's
 *   shape applied to tests): a check filed under the wrong subject is a check nobody runs.
 *
 * ✅ RESOLVED 2026-07-30 — the two Note A assertions that arrived here RED are DELETED by
 *   David's ruling (not inverted, not edited green). They asserted the PRE-RULING model:
 *   the Note A split was retired at 03497aa on 2026-07-27 and `orders:read` is in
 *   STAFF_DEFAULT_BUNDLE by that ruling. The TEST was stale, not the code — and it only
 *   surfaced because chaining the suite into `npm run verify` made a red assertion a build
 *   failure instead of a file nobody ran. See the deletion note at the bundle checks below.
 *
 * Run: node scripts/run-tests.mjs permissionManifest
 */

import {
  ALL_ACTION_PERMISSIONS, ALL_FINANCIAL_PERMISSIONS, HIDDEN_PERMISSIONS, OVERRIDE_MAINTENANCE,
  PERMISSION_MANIFEST, ALL_MODEL_PERMISSIONS, LEGACY_PERMISSIONS, ALIAS_PAIRS, MAPPABLE_LEGACY,
  STRIPPED_AT_BACKFILL, MANAGER_DEFAULT_BUNDLE, STAFF_DEFAULT_BUNDLE,
  OWNER_DEFAULT_BUNDLE, OWNER_LOCKED_SET, DECLARED_UNWIRED_PERMISSIONS, CATALOG_PERMISSIONS,
  PLANNED_PERMISSIONS, UNGRANTABLE_PERMISSIONS,
  splitPermission, unmetDependencies, createWithoutRead, applyPermissionDependencies,
  permissionCategory,
} from './permissionManifest';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
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
  // R6 + David's ruling 2026-07-31: `planned`, not `declared-unwired`. The PMI block is DELIBERATE
  // and unbuilt — a scoped feature, not an accident — so the chip renders "coming soon" instead of
  // vanishing. Flips to `enforced` in the same commit that ships the block.
  check('R6: maintenance:override is `planned` (the PMI block is scoped, not accidental)',
    PERMISSION_MANIFEST['maintenance:override'].status === 'planned');
  check('reports:read is MINTED and `planned` (it was used by a tile without existing at all)',
    PERMISSION_MANIFEST['reports:read']?.status === 'planned');
  check('deliveries.route:update is `planned` (its note already read as a roadmap item)',
    PERMISSION_MANIFEST['deliveries.route:update'].status === 'planned');
  check('campaigns:create STAYS declared-unwired — the next verb being obvious is not a scoped build',
    PERMISSION_MANIFEST['campaigns:create'].status === 'declared-unwired');
  check('team:create/update/delete STAY declared-unwired — a deliberate architectural NO, not a roadmap',
    ['team:create', 'team:update', 'team:delete'].every((p) => PERMISSION_MANIFEST[p].status === 'declared-unwired'));
  // THE INVARIANT THE FOURTH STATUS MUST NOT WEAKEN: planned renders, but nobody holds it.
  check('no `planned` string appears in ANY default bundle (un-grantable, same as declared-unwired)',
    PLANNED_PERMISSIONS.every((p) => ![...OWNER_DEFAULT_BUNDLE, ...MANAGER_DEFAULT_BUNDLE, ...STAFF_DEFAULT_BUNDLE].includes(p)));
  check('no `planned` string is in OWNER_LOCKED_SET — the owner holds nothing that does not exist',
    PLANNED_PERMISSIONS.every((p) => !OWNER_LOCKED_SET.includes(p)));
  check('every `planned` string IS in the rendered catalog — that is the whole point of the status',
    PLANNED_PERMISSIONS.every((p) => CATALOG_PERMISSIONS.includes(p)));
  check('no `planned` string is HIDDEN — hiding is what the status exists to stop',
    PLANNED_PERMISSIONS.every((p) => !HIDDEN_PERMISSIONS.includes(p)));
  check('UNGRANTABLE = declared-unwired ∪ planned, with no overlap between the two sets',
    UNGRANTABLE_PERMISSIONS.length === DECLARED_UNWIRED_PERMISSIONS.length + PLANNED_PERMISSIONS.length
    && !DECLARED_UNWIRED_PERMISSIONS.some((p) => PLANNED_PERMISSIONS.includes(p)));
  check('the four confidential resources are flagged confidential',
    ['pricing_recipe:read', 'costs:read', 'margin:read', 'wages:read']
      .every((p) => PERMISSION_MANIFEST[p].sensitivity === 'confidential'));
  check('audit_log:read is owner-only (never a grantable pill)', PERMISSION_MANIFEST['audit_log:read'].sensitivity === 'owner-only');
  check('inventory:read is operational, NOT confidential (the split is by field, not table)',
    PERMISSION_MANIFEST['inventory:read'].sensitivity === 'operational');

  // — the default bundles (§5) — seed data, and they must satisfy their own rules —
  check('MANAGER bundle satisfies every dependency class', unmetDependencies(MANAGER_DEFAULT_BUNDLE).length === 0);
  check('STAFF bundle satisfies every dependency class', unmetDependencies(STAFF_DEFAULT_BUNDLE).length === 0);
  // NOTE-A ASSERTIONS DELETED 2026-07-30 (David's ruling), NOT inverted. The Note A split —
  // STAFF takes an order at the tag and cannot browse order history — was RETIRED at 03497aa
  // on 2026-07-27 ("staff needs to view order — how else can they fill the order?").
  // Nothing to invert TO: the split no longer exists as a concept, so an inverted check would
  // assert the ABSENCE of a thing rather than a behaviour. STAFF's actual read scope is asserted
  // by 'STAFF bundle satisfies every dependency class' directly above and by the two negative
  // bundle checks directly below. `createWithoutRead` keeps its own coverage at R1-inverse.
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


  // — THE OWNER'S SET IS COMPUTED, NOT CURATED (ruling 2026-07-30) —
  // The header of OWNER_DEFAULT_BUNDLE has claimed since 2026-07-27 that "the accompanying test
  // asserts it still equals the computed set." THAT TEST DID NOT EXIST — a comment asserting a
  // check nobody wrote, which is #164's class and the exact thing capA is being built to stop.
  // It exists now. It is what keeps the SQL literal in 20260730a honest against the manifest.
  // PREDICATE CORRECTED 2026-07-31 with the fourth status: the exclusion is UN-GRANTABLE
  // (declared-unwired ∪ planned), not declared-unwired alone. This assertion is what CAUGHT the
  // derivation still reading the old predicate — which would have put `reports:read` in the
  // owner's set and demanded an APPLIED migration grow 52 → 55 to record a grant of nothing.
  check('OWNER_LOCKED_SET = every GRANTABLE manifest entry, PLUS the owner-only sentinel',
    OWNER_LOCKED_SET.length === Object.values(PERMISSION_MANIFEST)
      .filter((e) => !UNGRANTABLE_PERMISSIONS.includes(e.permission)).length + 1);
  // The stored array (business_members.permissions, backfilled by 20260730a) is the SERVER's copy.
  // It deliberately does NOT carry `owner-only`: that sentinel gates two CLIENT ROUTES and no SQL
  // policy checks it, so storing it would put a string in the database that nothing reads.
  check('OWNER_DEFAULT_BUNDLE (the stored materialisation) EQUALS the computed set minus the sentinel',
    JSON.stringify([...OWNER_DEFAULT_BUNDLE].sort())
      === JSON.stringify(OWNER_LOCKED_SET.filter((p) => p !== 'owner-only').sort()));
  check('the owner holds owner-only — without it, deleting the short-circuit strips /costs and /add-business',
    OWNER_LOCKED_SET.includes('owner-only'));
  check('owner-only is NOT grantable — it never appears as a Roles-page chip',
    HIDDEN_PERMISSIONS.includes('owner-only') && !CATALOG_PERMISSIONS.includes('owner-only'));
  check('the owner set holds tax_rate:read — the string whose absence produced "Tax: not identified"',
    OWNER_LOCKED_SET.includes('tax_rate:read'));
  check('the owner set holds NO declared-unwired string (un-removable phantom grant)',
    OWNER_LOCKED_SET.every((p) => !DECLARED_UNWIRED_PERMISSIONS.includes(p)));
  check('the owner set is NOT the membership sentinel',
    !OWNER_LOCKED_SET.includes('member'));

  // — subscription:* — the mint of 2026-08-01 (the model learns to say "may spend money") —
  // These assert the RULING, not the implementation: each one fails if a later edit quietly
  // widens who can change what the business pays for.
  check('subscription:read and subscription:update BOTH exist in the model',
    !!PERMISSION_MANIFEST['subscription:read'] && !!PERMISSION_MANIFEST['subscription:update']);
  check('🔴 there is NO subscription:delete — a module is disabled, never deleted (its row is billing history)',
    !PERMISSION_MANIFEST['subscription:delete']);
  check('the owner holds both — without them the marketplace admits nobody, including its owner',
    OWNER_LOCKED_SET.includes('subscription:read') && OWNER_LOCKED_SET.includes('subscription:update'));
  check('🔴 the MANAGER default bundle holds NEITHER — the disqualifying evidence against settings:update',
    !MANAGER_DEFAULT_BUNDLE.includes('subscription:read') && !MANAGER_DEFAULT_BUNDLE.includes('subscription:update'));
  check('🔴 the STAFF default bundle holds NEITHER',
    !STAFF_DEFAULT_BUNDLE.includes('subscription:read') && !STAFF_DEFAULT_BUNDLE.includes('subscription:update'));
  check('settings:update is STILL a manager string — the split did not narrow what a manager configures',
    MANAGER_DEFAULT_BUNDLE.includes('settings:update'));
  check('subscription is categorised `admin` — it renders beside Team on the Roles page',
    permissionCategory('subscription:update') === 'admin');
  // 🔴 NOT A CHIP, AND THIS ASSERTION IS THE RECORD OF A TENSION IN THE RULING, NOT A PASSING NOTE.
  // David ruled `sensitivity: 'owner-only'` AND described the string as "delegable through /roles".
  // In this model those are INCOMPATIBLE: CATALOG_PERMISSIONS filters out every `owner-only`
  // resource (spec §4), so the string can never render as a grantable pill — exactly like `team:*`
  // and `audit_log:read`. The ruling's SENSITIVITY is what shipped, because that is the half that
  // is unambiguous and the safe half: nobody but an OWNER-role member can hold it.
  // ⚠️ IF DELEGATION IS WANTED — Lauren granted the marketplace without being made an owner — the
  // sensitivity must become `operational` (or `confidential` with exposure copy) and this assertion
  // flips. That is a one-word change and DAVID'S CALL; it is asserted here so the day someone wants
  // it, the model says why it is not already true instead of looking like a bug.
  check('subscription:* is NOT a Roles-page chip — `owner-only` sensitivity is un-delegable by design',
    !CATALOG_PERMISSIONS.includes('subscription:update'));
  check('subscription:* is not declared-unwired — a string nothing enforces is un-removable once granted',
    !DECLARED_UNWIRED_PERMISSIONS.includes('subscription:update')
      && !UNGRANTABLE_PERMISSIONS.includes('subscription:update'));

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
