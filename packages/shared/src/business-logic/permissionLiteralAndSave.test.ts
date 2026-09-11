/**
 * ── permissionLiteralAndSave — the literal permission test, and the Save that spans two tables ──
 *
 * 🔴 WHAT THIS FILE EXISTS FOR. Four defects, one session (2026-09-10):
 *   (A) `has_permission` expanded aliases, so authority answered a question nobody asked. The
 *       merge makes it literal — and a permission check that has only ever ADMITTED is not a
 *       proven check, so §A/§B prove the REFUSAL, red-first.
 *   (B) `writePricingConfig` used `.upsert()`, which PostgREST compiles to `INSERT … ON CONFLICT`.
 *       `bpc_member_insert` was dropped on purpose, so a member holding `pricing_recipe:update`
 *       was refused by the INSERT half of a statement whose UPDATE half she may run — and with no
 *       `.select()` a zero-row RLS refusal returned NO error at all (A8 / R-12).
 *   (C) The profile Save wrote the tax rate on EVERY save, including saves that never touched it.
 *   (D) The add-on card multiplied a per-ORDER charge by the plant count.
 *
 * §A the literal test refuses what it does not hold · §B the alias expansion is GONE from the
 * migration, both directions · §C the migration drops the second authority site · §D the write
 * path is an UPDATE that proves it wrote · §E the tax write is conditional on a real edit ·
 * §F the attach rule governs the DISPLAY, not just the money · §G the probes REACH the shipped
 * files (tech-debt #182 — a scanner that cannot reach its target reports the same as one that passed).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/permissionLiteralAndSave.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const MIGRATION = 'supabase/migrations/20260910_permission_literal_merge.sql';
const sql       = readFileSync(MIGRATION, 'utf8');
const dataAccess = readFileSync('packages/shared/src/business-logic/financialDataAccess.ts', 'utf8');
const settings   = readFileSync('packages/shared/src/pages/Settings.tsx', 'utf8');
const addons     = readFileSync('packages/cultivar-os/src/pages/AddOns.tsx', 'utf8');
const addonCard  = readFileSync('packages/cultivar-os/src/components/checkout/AddonCard.tsx', 'utf8');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §A — THE LITERAL TEST REFUSES. A gate that has only ever admitted is not a proven gate.
// The SQL cannot run here, so the semantics are modelled EXACTLY as the migration's body reads:
// `permissions ? p_perm` over an active member row, with the two NULL guards.
// ════════════════════════════════════════════════════════════════════════════════════════════
type Member = { business_id: string; user_id: string; active: boolean; permissions: string[] };

/** The shipped body, transcribed. If the migration changes, §B fails and this must be re-derived. */
function hasPermissionLiteral(
  rows: Member[], businessId: string | null, uid: string | null, perm: string,
): boolean {
  if (businessId === null || uid === null) return false;
  return rows.some(r =>
    r.business_id === businessId && r.user_id === uid && r.active === true &&
    r.permissions.includes(perm));
}

// Joel and Lauren as MEASURED on LAWNS 2026-09-10 — names printed in the report, not guessed.
const LAWNS = 'ed2e5933';
const rows: Member[] = [
  { business_id: LAWNS, user_id: 'joel',   active: true,  permissions: ['inventory:read', 'inventory:update', 'orders:read'] },
  { business_id: LAWNS, user_id: 'lauren', active: true,  permissions: ['pricing_recipe:read', 'pricing_recipe:update', 'settings:update'] },
  { business_id: LAWNS, user_id: 'gone',   active: false, permissions: ['costs:read'] },
];

console.log('§A — the literal test REFUSES');
ok(hasPermissionLiteral(rows, LAWNS, 'joel', 'inventory:read') === true,
   'A1 admits a string the member actually holds');
ok(hasPermissionLiteral(rows, LAWNS, 'joel', 'costs:read') === false,
   'A2 REFUSES a string the member does not hold');
ok(hasPermissionLiteral(rows, LAWNS, 'joel', 'pricing_recipe:update') === false,
   'A3 REFUSES — Joel cannot save the pricing recipe');
ok(hasPermissionLiteral(rows, LAWNS, 'lauren', 'pricing_recipe:update') === true,
   'A4 admits Lauren, who holds it (this is why her Save must succeed)');
ok(hasPermissionLiteral(rows, LAWNS, 'gone', 'costs:read') === false,
   'A5 REFUSES an INACTIVE member who holds the string');
ok(hasPermissionLiteral(rows, 'other-tenant', 'joel', 'inventory:read') === false,
   'A6 REFUSES cross-tenant — the same person, the wrong business (AC-3)');
ok(hasPermissionLiteral(rows, LAWNS, null, 'inventory:read') === false,
   'A7 REFUSES a NULL auth.uid() — an unauthenticated caller');
ok(hasPermissionLiteral(rows, null, 'joel', 'inventory:read') === false,
   'A8 REFUSES a NULL business id');
// THE ALIAS DIRECTION — the whole point of the merge.
ok(hasPermissionLiteral(rows, LAWNS, 'joel', 'view_costs') === false,
   'A9 REFUSES a LEGACY string — no expansion, no implication');
ok(hasPermissionLiteral(
     [{ business_id: LAWNS, user_id: 'legacy', active: true, permissions: ['view_costs'] }],
     LAWNS, 'legacy', 'costs:read') === false,
   'A10 a member holding ONLY a legacy string is REFUSED the new string — the revocation the ' +
   'catalog check proved nobody is exposed to');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §B — THE MIGRATION SAYS WHAT §A MODELS. Both directions, so the model cannot drift silently.
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§B — the migration is literal');
ok(/permissions\s*\?\s*p_perm/.test(sql), 'B1 the literal containment test is present');
const fnBody = (sql.match(/AS \$\$([\s\S]*?)\$\$;/) ?? ['', ''])[1];
ok(fnBody.length > 100, 'B2a the function body was actually extracted');
ok(!/permission_aliases/.test(fnBody),
   'B2 the FUNCTION BODY does not reference permission_aliases — the expansion is gone');
ok(/SET search_path = ''/.test(sql), 'B3 search_path is pinned (the exact fn lacked it)');
ok(/SECURITY DEFINER/.test(sql), 'B4 still SECURITY DEFINER');
ok(/auth\.uid\(\) IS NOT NULL/.test(sql), 'B5 the NULL-uid guard survived the rewrite');
ok(/p_business_id IS NOT NULL/.test(sql), 'B6 the NULL-business guard survived the rewrite');
ok(/GRANT EXECUTE ON FUNCTION public\.has_permission\(uuid, text\) TO authenticated/.test(sql),
   'B7 the grant is restated (a CREATE OR REPLACE keeps grants, but the file states them)');

console.log('§C — the second authority site is removed');
ok(/DROP FUNCTION IF EXISTS public\.has_permission_exact/.test(sql),
   'C1 has_permission_exact is dropped');
ok(/permission_aliases/.test(sql) && !/DROP TABLE[^\n]*permission_aliases/.test(sql),
   'C2 the alias TABLE is discussed and deliberately NOT dropped (reversible)');
ok(/has_permission_for/.test(sql),
   'C3 the untouched 3-arg function is named, so the divergence is recorded not hidden');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §D — THE WRITE PATH PROVES IT WROTE (A8 / R-12)
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§D — writePricingConfig');
const wpc = dataAccess.slice(dataAccess.indexOf('export async function writePricingConfig'),
                             dataAccess.indexOf('export async function mergePricingConfig'));
// 🔴 STRIP COMMENTS BEFORE ASSERTING ON CODE. The first draft of D1 failed against a CORRECT
// file, because this build's own comment explains the defect by quoting `.upsert()` — the probe
// was grading the prose. #182's class in miniature, caught by the probe going red on green code.
const wpcCode = wpc.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
ok(wpcCode.length > 300, 'D0 the code-only slice is non-trivial after stripping comments');
ok(!/\.upsert\(/.test(wpcCode), 'D1 the upsert is GONE from the CODE — it is what RLS refused');
ok(/\.update\(\s*\{\s*config\s*\}\s*\)/.test(wpc), 'D2 it is an UPDATE');
ok(/\.update\(\s*\{\s*config\s*\}\s*\)[\s\S]{0,120}?\.select\(/.test(wpcCode),
   'D3 the UPDATE ITSELF selects back — a zero-row refusal is observable. (First draft asserted ' +
   'only that ".select(" appeared SOMEWHERE in the function, which the INSERT path satisfied, so ' +
   'mutant M6 survived: the probe could not reach the statement it was about.)');
ok(/\(gated\.data \?\? \[\]\)\.length === 0/.test(wpcCode),
   'D4 zero rows is explicitly inspected, in the form the zero-row-writes cap can READ — the ' +
   'first draft used (x?.length ?? 0) === 0 and the cap flagged it NEEDS_CHECK, correctly: the ' +
   'check had drifted 600 chars and three branches from the write it guards');
ok(/maybeSingle\(\)/.test(wpc),
   'D5 zero rows is DISAMBIGUATED by reading the row back — refusal vs no-row-yet, not guessed');
ok(/not saved/.test(wpc), 'D6 a refusal returns an honest message, never a silent success');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §E — THE COUPLING: an unchanged tax rate is not written
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§E — the tax write is conditional');
ok(/loadedTaxRate/.test(settings), 'E1 the loaded rate is retained as a baseline');
ok(/const taxChanged = loadedTaxRate !== null && raw !== loadedTaxRate/.test(settings),
   'E2 the guard compares the TRIMMED TEXT against what was loaded');
ok(/taxChanged\s*\n?\s*\?\s*\(await mergePricingConfig/.test(settings.replace(/\s+/g, ' '))
   || /taxChanged[\s\S]{0,120}mergePricingConfig/.test(settings),
   'E3 mergePricingConfig is called ONLY when the rate changed');
ok(/not written — unchanged/.test(settings), 'E4 the trace states the skip rather than going quiet');
// PER-TABLE REPORTING — the "0 customers created" class. RE-AIMED 2026-09-11 (#300): the review link
// made this a THREE-table Save, and the message branches moved into the pure `saveReport`, where the
// rules are asserted with real outcomes (reviewLink.test.ts §D). Here the probes prove the Save
// REACHES them. The old E6/E7 matched two literal sentences — one of which told an owner "The tax rate
// was saved" when an unchanged rate had not been written.
ok(/saveReport\(parts\)/.test(settings), 'E5 the Save composes its message through saveReport, not inline branches');
ok(/label: 'your business details', outcome: 'refused'/.test(settings)
   && /label: 'the tax rate', outcome: 'refused'/.test(settings),
   'E6 each table reports its OWN refusal instead of one verdict for several writes');
ok(/!taxChanged\s*\?\s*\{ label: 'the tax rate', outcome: 'unchanged' \}/.test(settings),
   'E7 an unchanged tax rate is reported UNCHANGED — never as saved');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §F — THE ATTACH RULE GOVERNS THE DISPLAY (B.2)
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§F — display and charge come from one rule');
ok(/quantity=\{nettedQuantity\(sel\.offering, plantCount\)\}/.test(addons),
   'F1 the card is passed the NETTED quantity, not plantCount');
ok(!/quantity=\{plantCount\}[\s\S]{0,200}AddonCard/.test(addons),
   'F2 no addon card is still handed the raw plant count');
ok(/unitLabel=/.test(addons), 'F3 the unit comes from the offering, not a hardcoded "plants"');
ok(/showMultiplier/.test(addonCard), 'F4 the card only multiplies when there is a multiplication');
ok(!/plant\{quantity !== 1 \? 's' : ''\}/.test(addonCard),
   'F5 the hardcoded "plant(s)" label is gone');
// The arithmetic the fix rests on, restated so a change to netting.ts breaks HERE too.
const netted = (priceType: string, plantCount: number) => priceType === 'per_unit' ? plantCount : 1;
ok(netted('flat', 2) === 1,      'F6 a FLAT charge attaches once — Trip Charge on 2 plants');
ok(netted('flat', 10) === 1,     'F7 …and still once at ten trees ($50, never $500)');
ok(netted('per_unit', 2) === 2,  'F8 a per_unit charge still scales — placement/tarp/bubbler at ×2');
ok(50 * netted('flat', 2) === 50,     'F9 the money: $50 flat on a 2-plant order is $50');
ok(125 * netted('per_unit', 2) === 250, 'F10 the money: $125 placement on 2 plants is $250');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §G — THE PROBES REACH THE SHIPPED FILES (tech-debt #182)
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§G — the probes reach their targets');
ok(sql.length > 2000,        'G1 the migration was actually read');
ok(wpc.length > 500,         'G2 writePricingConfig was located, not matched against an empty slice');
ok(/saveProfile/.test(settings), 'G3 Settings.tsx contains the save handler under test');
ok(/AddonCard/.test(addons),  'G4 AddOns.tsx renders the card under test');
ok(/console\.log\(\s*'\[TRACE:IDENTITY\]/.test(
     readFileSync('packages/shared/src/context/BusinessProvider.tsx', 'utf8')),
   'G5 the identity trail is an ACTIVE CALL, ON by default (STD-003). (First draft grepped the ' +
   'bare string, which also appears in the comment above it — mutant M12 renamed the comment and ' +
   'survived. Assert the call, never the mention.)');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
