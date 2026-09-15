/**
 * ── containerLadderFields — the select matches the migration, BOTH directions · 2026-09-14 (#326) ──
 *
 * 🔴 WHY THIS EXISTS. `VENDORS_SELECT` named 10 columns while its migration created 14 — the four
 * missing were the ADDRESS, and NOTHING we own could have caught it: a column with no reader and no
 * writer is invisible to tsc, eslint, knip and every probe (tech-debt #179). The class was left
 * open: *"a declarative list that does not match what its migration creates, across every `*_SELECT`
 * in the repo."* This is that check for the ladder, written at the same time as the list so the
 * list is never the only record of itself.
 *
 * BOTH DIRECTIONS, because one alone is the half that lets #179 happen again:
 *   ① a field the select ASKS FOR that the migration does not CREATE → the query 400s at runtime.
 *   ② 🔴 a column the migration CREATES that the select never asks for → #179's own direction, and
 *     the silent one: nothing fails, the data is simply never read.
 *
 * Run:  node_modules/.bin/esbuild packages/cultivar-os/src/lib/containerLadderFields.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { LADDER_FIELDS, LADDER_SELECT } from './containerLadderFields';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const MIGRATION = 'supabase/migrations/20260914_container_ladder.sql';
const sql = readFileSync(MIGRATION, 'utf8');

// Pull the CREATE TABLE body and read the column names out of it. Parsed, never transcribed —
// a transcribed copy is the thing that drifts.
const body = sql.slice(
  sql.indexOf('CREATE TABLE IF NOT EXISTS public.container_ladder'),
  sql.indexOf('CREATE UNIQUE INDEX'),
);
const created = new Set<string>();
for (const line of body.split('\n')) {
  const m = line.match(/^\s{2}([a-z_]+)\s{2,}(uuid|text|integer|numeric|boolean|timestamptz)/);
  if (m) created.add(m[1]);
}

ok(created.size >= 12, `§A the migration parse found the columns (found ${created.size}) — a parse that finds nothing would make every check below vacuously true`);
ok(created.has('label') && created.has('aliases') && created.has('sort_order'),
  '§A …and it really is THIS table — label, aliases and sort_order are all present');

// ── ① every field the select asks for exists ────────────────────────────────────────────────
for (const f of LADDER_FIELDS) {
  ok(created.has(f), `🔴 §B the select asks for "${f}" and the migration creates it`);
}

// ── ② 🔴 #179's OWN DIRECTION: every column the migration creates is either READ or DECLARED ──
// A column deliberately not read is declared here WITH ITS REASON, so the list is a decision and
// not an oversight. Anything else fails, which is the half that would have caught #179.
const NOT_READ: Record<string, string> = {
  business_id: 'the query filters on it; reading it back would tell the client what it already asked for',
  retired_at:  'not read yet — `active` is the flag the UI uses; this is the timestamp for the audit trail',
  created_at:  'not shown on any ladder surface',
  updated_at:  'not shown on any ladder surface',
};
for (const c of created) {
  if ((LADDER_FIELDS as readonly string[]).includes(c)) continue;
  ok(c in NOT_READ, `🔴 §C the migration creates "${c}" and the select neither reads it nor declares why — #179's exact shape`);
}

// ⚠️ SELF-CATCH: the declaration prunes itself. A declared column the migration no longer creates
// is a stale excuse, and a stale excuse is how a gap list rots into unread noise (tech-debt #73).
for (const c of Object.keys(NOT_READ)) {
  ok(created.has(c), `§C the not-read declaration for "${c}" is still live — a declaration for a column that no longer exists is STALE`);
}

// ── the select string is DERIVED, never typed twice ─────────────────────────────────────────
ok(LADDER_SELECT === LADDER_FIELDS.join(', '), '§D the select is derived from the list');
ok(LADDER_SELECT.split(', ').length === LADDER_FIELDS.length, '§D …and loses nothing on the way');
ok(!LADDER_SELECT.includes('*'), '🔴 §D the select never asks for `*` — a star cannot be checked against a migration at all');

console.log(`\n── containerLadderFields: ${passed} passed, ${failed} failed ──`);
if (failed) { failures.forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }
