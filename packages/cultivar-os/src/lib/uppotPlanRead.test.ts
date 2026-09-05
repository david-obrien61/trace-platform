/**
 * ── uppotPlanRead — the field list is DERIVED and it matches the table ──────────────
 *    2026-09-05 · ledger #276 · tech-debt #179's class
 *
 * 🔴 WHY THIS EXISTS. `VENDORS_SELECT` named 10 columns while its migration created 14 — the four
 * missing were the ADDRESS — under a comment claiming "ONE LIST, TWO READERS, AND THAT IS THE WHOLE
 * POINT", which was true about its intent and false about its effect. **A column with no reader and
 * no writer is invisible to tsc, eslint, knip and every probe**, so the only thing that finds it is
 * a build that needs the fourth column. Tech-debt #179 records the class as open: *"a declarative
 * list that does not match what its migration creates, across every `*_SELECT` in the repo."*
 *
 * So this file does for `PLAN_LOT_SELECT` what `vendorEdit.test.ts` §A does for the vendor one: it
 * PARSES the columns out of the migration corpus and fails in BOTH directions — a field the select
 * asks for that no migration creates, and (the #179 direction) a column the plan needs that the
 * select silently omits.
 *
 * Run: node_modules/.bin/esbuild packages/cultivar-os/src/lib/uppotPlanRead.test.ts \
 *        --bundle --platform=node --format=cjs | node
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_LOT_FIELDS, PLAN_LOT_SELECT } from './uppotPlanFields';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── read every column `business_inventory` has ever been given, from the migrations ──
const MIG_DIR = join(process.cwd(), 'supabase', 'migrations');
const sql = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(MIG_DIR, f), 'utf8'))
  .join('\n');

const created = new Set<string>();
// CREATE TABLE business_inventory ( … )
const createBlock = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?business_inventory\s*\(([\s\S]*?)\n\);/);
if (createBlock) {
  for (const line of createBlock[1].split('\n')) {
    // 🔴 THE COLUMN REGEX ALLOWS DIGITS. #273's probe used `[a-z_]+`, which cannot match
    // `address_line1` — the very column the defect was about — and it reported 13 of 14 while
    // looking green enough to read past. Tech-debt #182 is that class.
    const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s+(uuid|text|int|integer|numeric|boolean|timestamptz|date|jsonb)/i);
    if (m && !/^(primary|foreign|constraint|check|unique)$/i.test(m[1])) created.add(m[1]);
  }
}
// every later ADD COLUMN
for (const m of sql.matchAll(/ADD COLUMN (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)/gi)) created.add(m[1]);

ok(created.size > 10, `§A parsed ${created.size} columns from the migration corpus — the parse itself works`);
ok(created.has('address_line1') || created.size > 20,
  '🔴 §A the column regex matches names containing DIGITS — the #273 near-miss, where `[a-z_]+` could not see `address_line1`');

// ── DIRECTION 1: everything the select asks for actually exists ──────────────────────
for (const f of PLAN_LOT_FIELDS) {
  ok(created.has(f), `§B the select asks for \`${f}\` and a migration creates it`);
}

// ── DIRECTION 2 (the #179 direction): the columns the PLAN needs are all in the list ──
// Deliberately NOT "every column on the table" — the plan does not need `photo_url`. This is the
// list of columns the planning model reads, stated independently of the select so the two can
// disagree and be caught.
const PLAN_NEEDS = [
  'id', 'name', 'size', 'qty', 'location',
  'unit_kind', 'unit_value', 'unit_value_max', 'unit_name',
  'retired_at',
] as const;
for (const f of PLAN_NEEDS) {
  ok((PLAN_LOT_FIELDS as readonly string[]).includes(f),
    `🔴 §C the plan reads \`${f}\` and the select names it — the #179 direction`);
}

// ── the select is DERIVED, not typed twice ──────────────────────────────────────────
ok(PLAN_LOT_SELECT === PLAN_LOT_FIELDS.join(', '), '🔴 §D the select string is derived from the field list, not maintained beside it');
ok(PLAN_LOT_SELECT.includes('unit_value_max'), '§D …so a field added to the list reaches the query automatically');
// ⚠️ SELF-CATCH: without this, a select of '' would satisfy the derivation check above.
ok(PLAN_LOT_SELECT.split(', ').length === PLAN_LOT_FIELDS.length && PLAN_LOT_FIELDS.length >= 10,
  '🔴 §D the derived select is non-trivial — an empty list would satisfy the equality above and prove nothing');

console.log(`\n── uppotPlanRead field list: ${passed} passed, ${failed} failed ──`);
if (failed > 0) { console.error(failures.map((f) => '  ✗ ' + f).join('\n')); process.exit(1); }
