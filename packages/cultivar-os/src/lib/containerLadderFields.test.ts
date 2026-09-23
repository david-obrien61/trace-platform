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
import { readFileSync, readdirSync } from 'node:fs';
import { LADDER_FIELDS, LADDER_SELECT } from './containerLadderFields';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ✏️ CHANGED 2026-09-16 (ledger #343). This read ONE file — `20260914_container_ladder.sql` — so a
// column added by a LATER migration (`20260916_container_ladder_install_t_posts.sql`) failed §B as
// "the select asks for a column the migration does not create", which is false: the corpus creates
// it, one file later. The table is now the REPLAY of every migration that touches it, in filename
// order: the CREATE TABLE body, then each `ADD COLUMN`, minus each `DROP COLUMN`.
const DIR = 'supabase/migrations';
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const created = new Set<string>();
let createdIn: string | null = null;
for (const f of files) {
  const sql = readFileSync(`${DIR}/${f}`, 'utf8');
  const at = sql.indexOf('CREATE TABLE IF NOT EXISTS public.container_ladder');
  if (at >= 0) {
    createdIn = f;
    // Parsed, never transcribed — a transcribed copy is the thing that drifts.
    const body = sql.slice(at, sql.indexOf(');', at));
    for (const line of body.split('\n')) {
      const m = line.match(/^\s{2}([a-z_]+)\s{2,}(uuid|text|integer|numeric|boolean|timestamptz)/);
      if (m) created.add(m[1]);
    }
  }
  const code = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
  // 🔴 EVERY COLUMN OF A MULTI-COLUMN ALTER, NOT JUST THE FIRST (ledger #386).
  // WAS: /ALTER TABLE …container_ladder\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_]+)/g — anchored
  // on `ALTER TABLE`, so a statement of the legal and ordinary form
  //     ALTER TABLE container_ladder
  //       ADD COLUMN IF NOT EXISTS install_price numeric(10,2),
  //       ADD COLUMN IF NOT EXISTS install_price_because text NOT NULL DEFAULT '';
  // contributed ONLY `install_price`. Every ladder migration before 2026-09-23 used one ALTER per
  // column, so the hole never bit — it was found by `20260923` walking into it, not by review.
  // ⚠️ THE DANGEROUS DIRECTION IS §C, NOT §B. §B goes RED when a column the select READS is missed,
  // which is loud. §C asks "is every created column read or declared?" — and a column this parser
  // cannot see is a column §C cannot ask about, so a second ADD COLUMN could have introduced an
  // unread field with the cap staying green. That is #179's exact shape, inside #179's own cap.
  for (const stmt of code.matchAll(/ALTER TABLE\s+(?:public\.)?container_ladder\b([\s\S]*?);/g)) {
    for (const m of stmt[1].matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_]+)/g)) created.add(m[1]);
    for (const m of stmt[1].matchAll(/DROP COLUMN\s+(?:IF EXISTS\s+)?([a-z_]+)/g)) created.delete(m[1]);
  }
}

ok(createdIn === '20260914_container_ladder.sql', `§A the replay found the migration that CREATES the table (found ${createdIn})`);
ok(created.has('install_t_posts_per_tree') && created.has('install_t_posts_because') && created.has('is_large'),
  '🔴 §A the replay sees the columns a LATER migration adds — the one-file read could not (ledger #343)');
ok(created.size >= 14, `§A the migration parse found the columns (found ${created.size}) — a parse that finds nothing would make every check below vacuously true`);
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
  // ledger #343 — PREPARED, not read: the leakage flag keeps submit.ts LARGE_CONTAINERS until David
  // confirms the switch (tech-debt #310). Reading it before then would imply a use it does not have.
  is_large:         'prepared for the leakage flag; not read until David confirms it (tech-debt #310)',
  is_large_because: 'the source of is_large; not read for the same reason',
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

// ── §E — 🔴 THE PARSER CAN SEE A MULTI-COLUMN ALTER, PROVEN BOTH WAYS (§6 r19) ────────────────
// A cap nobody has watched refuse is a claim. This runs the OLD matcher and the NEW one over the
// same synthetic statement and asserts they DISAGREE, so if someone "simplifies" the parser back
// to the anchored form this goes red and names exactly what was lost.
{
  const sample = `ALTER TABLE container_ladder
  ADD COLUMN IF NOT EXISTS alpha numeric(10,2),
  ADD COLUMN IF NOT EXISTS beta text NOT NULL DEFAULT '';`;

  const oldWay = new Set<string>();
  for (const m of sample.matchAll(/ALTER TABLE\s+(?:public\.)?container_ladder\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_]+)/g)) oldWay.add(m[1]);

  const newWay = new Set<string>();
  for (const stmt of sample.matchAll(/ALTER TABLE\s+(?:public\.)?container_ladder\b([\s\S]*?);/g)) {
    for (const m of stmt[1].matchAll(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_]+)/g)) newWay.add(m[1]);
  }

  ok(oldWay.has('alpha') && !oldWay.has('beta'),
    '🔴 §E the OLD matcher saw only the FIRST column of a multi-column ALTER — the hole, reproduced');
  ok(newWay.has('alpha') && newWay.has('beta'),
    '🔴 §E the NEW matcher sees both — this assertion is what stops the anchored form coming back');
  ok(created.has('install_price') && created.has('install_price_because'),
    '§E and on the real corpus both columns of 20260923\'s multi-column ALTER are in the replay');
}

console.log(`\n── containerLadderFields: ${passed} passed, ${failed} failed ──`);
if (failed) { failures.forEach((f) => console.error('  ✗ ' + f)); process.exit(1); }
