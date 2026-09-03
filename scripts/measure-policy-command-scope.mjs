#!/usr/bin/env node
/**
 * ── measure-policy-command-scope — which RLS policies omit a FOR clause? ──────────────
 *
 * PURPOSE:      `receipts_member_all` has no `FOR` clause, so Postgres defaults it to ALL and
 *               any active member holding `costs:read` may UPDATE and DELETE a receipt row —
 *               a write scope nobody chose, arrived at by omission. David asked whether that is
 *               the only one. This answers it over the whole migration corpus and REPORTS;
 *               it fixes nothing. Read-only, offline, no database.
 *
 * DEPENDENCIES: supabase/migrations/*.sql only. No network, no credentials, no node_modules.
 *
 * OUTPUTS:      The population examined, the policies whose final definition omits `FOR`, and
 *               the ones that omit it while ALSO carrying a WITH CHECK (i.e. demonstrably
 *               write-capable). Exit 0 always — this is a measurement, not a gate.
 *
 * 🔴 IT REPLAYS RATHER THAN GREPS. A policy is CREATEd and DROPped repeatedly across the corpus
 * (`receipts_member_all` is created three times), so a naive grep counts superseded definitions
 * as live ones. Migrations are replayed in filename order and only the LAST definition of each
 * (table, policyname) is judged — which is what the database actually holds.
 *
 * ⚠️ IT READS THE REPO, NOT THE CATALOG — the same blind spot verify-universals.mjs states about
 * itself. A policy created outside the migration path is invisible here (§6 r17's class).
 *
 * Run: node scripts/measure-policy-command-scope.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../supabase/migrations/', import.meta.url).pathname;
const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort();

/** (table, policyname) -> { file, body, dropped } — last write wins, exactly as Postgres sees it. */
const live = new Map();
const key = (t, p) => `${t.toLowerCase()}::${p.toLowerCase()}`;

// CREATE POLICY <name> ON <table> ... up to the terminating semicolon at depth 0.
const CREATE = /CREATE\s+POLICY\s+("?[\w.]+"?)\s+ON\s+("?[\w.]+"?(?:\."?[\w]+"?)?)/gi;
const DROP   = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?("?[\w.]+"?)\s+ON\s+("?[\w.]+"?(?:\."?[\w]+"?)?)/gi;
const unq = s => s.replace(/"/g, '').replace(/^(public|storage)\./, '');

let created = 0, dropped = 0;
for (const f of files) {
  const sql = readFileSync(join(DIR, f), 'utf8');
  // Strip line comments so a commented-out example is not counted as a definition.
  const code = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');

  for (const m of code.matchAll(DROP)) { dropped++; live.delete(key(unq(m[2]), unq(m[1]))); }

  for (const m of code.matchAll(CREATE)) {
    created++;
    // Body = from the match to the next semicolon that ends the statement.
    const start = m.index;
    const end = code.indexOf(';', start);
    const body = code.slice(start, end === -1 ? code.length : end);
    live.set(key(unq(m[2]), unq(m[1])), { table: unq(m[2]), name: unq(m[1]), file: f, body });
  }
}

const FOR_CLAUSE = /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i;
const rows = [...live.values()];
const noFor = rows.filter(r => !FOR_CLAUSE.test(r.body));
const noForWithCheck = noFor.filter(r => /\bWITH\s+CHECK\b/i.test(r.body));
const explicitAll = rows.filter(r => /\bFOR\s+ALL\b/i.test(r.body));

console.log('── RLS POLICY COMMAND SCOPE — migration corpus ─────────────────────────────');
console.log(`POPULATION: ${files.length} migration files · ${created} CREATE POLICY statements · ${dropped} DROP POLICY statements`);
console.log(`            ${rows.length} policies live after replay (a policy created and never re-dropped)\n`);
console.log(`NO \`FOR\` CLAUSE → Postgres defaults to ALL : ${noFor.length} of ${rows.length}`);
console.log(`  ...of those, also carrying WITH CHECK     : ${noForWithCheck.length}  (demonstrably write-capable)`);
console.log(`EXPLICIT \`FOR ALL\` (a chosen write scope)  : ${explicitAll.length} of ${rows.length}\n`);

if (noFor.length === 0) {
  console.log('  (none — and an empty result here would itself be the surprising answer)');
} else {
  const byTable = new Map();
  for (const r of noFor) { if (!byTable.has(r.table)) byTable.set(r.table, []); byTable.get(r.table).push(r); }
  for (const [table, list] of [...byTable].sort()) {
    console.log(`  ${table}`);
    for (const r of list.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`     · ${r.name}${/\bWITH\s+CHECK\b/i.test(r.body) ? '  [WITH CHECK]' : ''}   ← ${r.file}`);
    }
  }
}
console.log('\n⚠️ READS THE REPO, NOT THE CATALOG. A policy created outside the migration path is');
console.log('   invisible to this sweep (§6 r17). REPORTED, NOT FIXED — beyond receipts_member_all,');
console.log('   which this build narrows, every row above is left exactly as it is.');
