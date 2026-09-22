#!/usr/bin/env node
/**
 * PURPOSE:      a PAGED read (`.range()`) must end its ORDER BY on a UNIQUE column, or the pages
 *               are not a partition of the rows — the same row can come back twice and another
 *               can be skipped, with nothing to see.
 * DEPENDENCIES: none. Reads the repo.
 * OUTPUTS:      exit 1 on any paged read whose order does not end unique; --self-test probes both
 *               directions.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE DEFECT THIS EXISTS FOR, MEASURED 2026-09-21 ON LAWNS.
 *   `/customers` read `.order('created_at', desc).range(from, from+999)`. The reload writes its
 *   rows in one burst: **2,005 customers across 46 distinct timestamps, 500 sharing a single
 *   microsecond.** Postgres need not break a tie the same way twice, so the read fetched
 *   **2005 rows holding 1969 distinct ids — 36 duplicated, and ~36 others silently missing.**
 *
 * 🔴 AND IT DID NOT LOOK LIKE A PAGING BUG, WHICH IS THE WHOLE ARGUMENT FOR A CAP.
 *   The grid's row key is the customer id, so a duplicated id is a duplicated REACT KEY, and React
 *   cannot diff a keyed list that has them. Searching `highland` left dozens of orphaned rows on
 *   screen while the count pill correctly said 2. It was read as a broken filter and a broken sort
 *   for a day; the filter and the sort were correct the whole time.
 *
 * ⚠️ A `.range()` with NO ORDER BY AT ALL IS WORSE, NOT SAFER — Postgres guarantees nothing about
 *   row order between two queries. Four of the five paged reads in this repo had none; they
 *   measured clean only because heap order happens to be stable on an untouched table.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Columns that are unique per row, so an order ending on one is a TOTAL order. */
const UNIQUE_COLUMNS = ['id'];

const ROOTS = ['packages/shared/src', 'packages/cultivar-os/src', 'packages/cultivar-os/api', 'api'];
const SKIP = /\.test\.[tj]sx?$|\/ignition-os\//;

function walk(dir, out = []) {
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (/\.[tj]sx?$/.test(p) && !SKIP.test(p)) out.push(p);
  }
  return out;
}

/** The statement a `.range(` sits in: back to the `.from(` that starts it. */
function statementAround(src, rangeIdx) {
  const from = src.lastIndexOf('.from(', rangeIdx);
  if (from === -1) return null;
  return src.slice(from, rangeIdx + 40);
}

export function findings(files, read = readFileSync) {
  const out = [];
  for (const f of files) {
    const src = String(read(f, 'utf8'));
    let i = -1;
    while ((i = src.indexOf('.range(', i + 1)) !== -1) {
      // a comment mentioning .range() is not a read
      const lineStart = src.lastIndexOf('\n', i) + 1;
      const line = src.slice(lineStart, src.indexOf('\n', i));
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      const stmt = statementAround(src, i);
      if (!stmt) continue;
      const orders = [...stmt.matchAll(/\.order\(\s*['"]([a-z_]+)['"]/g)].map(m => m[1]);
      const lineNo = src.slice(0, i).split('\n').length;
      if (orders.length === 0) {
        out.push({ file: f, line: lineNo, why: 'a paged read with NO ORDER BY — Postgres guarantees nothing about row order between queries' });
      } else if (!UNIQUE_COLUMNS.includes(orders[orders.length - 1])) {
        out.push({ file: f, line: lineNo, why: `ORDER BY ends on '${orders[orders.length - 1]}', which is not unique — append .order('id')` });
      }
    }
  }
  return out;
}

if (process.argv.includes('--self-test')) {
  const fake = (m) => (f) => m[f];
  let pass = 0, fail = 0;
  const probe = (name, files, map, expected) => {
    const got = findings(files, fake(map)).length;
    const ok = got === expected;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} — expected ${expected}, got ${got}`);
    ok ? pass++ : fail++;
  };
  probe('P1 🔴 THE REAL DEFECT — created_at only → REFUSED', ['a.ts'],
    { 'a.ts': `db.from('customers').select('*').order('created_at',{ascending:false}).range(0,999)` }, 1);
  probe('P2 the fix — created_at then id → accepted', ['a.ts'],
    { 'a.ts': `db.from('customers').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).range(0,999)` }, 0);
  probe('P3 🔴 NO ORDER AT ALL → REFUSED (worse, not safer)', ['a.ts'],
    { 'a.ts': `db.from('orders').select('*').eq('business_id',b).range(0,999)` }, 1);
  probe('P4 id alone → accepted', ['a.ts'],
    { 'a.ts': `db.from('orders').select('*').order('id').range(0,999)` }, 0);
  probe('P5 a COMMENT about .range() is not a read', ['a.ts'],
    { 'a.ts': `// the .range() then pages until the rows run out\nconst x = 1;` }, 0);
  probe('P6 two reads in one file are judged separately', ['a.ts'],
    { 'a.ts': `db.from('a').select('*').order('id').range(0,9)\ndb.from('b').select('*').order('created_at').range(0,9)` }, 1);
  probe('P7 NEGATIVE CONTROL — a file with no paged read at all', ['a.ts'],
    { 'a.ts': `db.from('customers').select('*').eq('id', x).single()` }, 0);
  probe('P8 order after range still counts (chain order is not fixed)', ['a.ts'],
    { 'a.ts': `db.from('a').select('*').order('created_at').order('id').range(0,9)` }, 0);
  console.log(`\nverify-stable-paging --self-test — ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

const files = ROOTS.flatMap(r => walk(r));
const found = findings(files);
console.log(`verify-stable-paging — ${files.length} files scanned, ${found.length} finding(s)`);
if (found.length) {
  for (const f of found) console.log(`  🔴 ${f.file}:${f.line}\n       ${f.why}`);
  console.log('\nTHE RULE: pages are only a partition of the rows if the sort is TOTAL. End the');
  console.log('ORDER BY on a unique column (id). Measured on LAWNS 2026-09-21: created_at alone');
  console.log('returned 2005 rows holding 1969 distinct ids — 36 duplicated, ~36 silently missing.');
  process.exit(1);
}
console.log('✓ every paged read ends its ORDER BY on a unique column.');
