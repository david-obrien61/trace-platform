/**
 * ── parseCsv — RFC-4180 reader · CSV catalog import · 2026-07-23 ──
 *
 * RED-first (STD-002): every messy case the grower fixture deliberately carries is asserted
 * here as an INVARIANT of the parse, not a pinned snapshot count — quoted commas, embedded
 * newlines, escaped quotes, CRLF/CR/LF, a BOM, blank lines, padded short rows.
 *
 * Run (pure TS, no React — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/import/parseCsv.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { parseCsv } from './parseCsv';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const eq = (a: unknown, b: unknown, msg: string) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)})`);

// ── A — the basics ────────────────────────────────────────────────────────────
{
  const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6');
  eq(headers, ['a', 'b', 'c'], 'header row is the first record');
  eq(rows, [['1', '2', '3'], ['4', '5', '6']], 'two data rows, split on commas');
}

// ── B — CRLF + BOM (the Windows-spreadsheet shape) ──────────────────────────────
{
  const { headers, rows } = parseCsv('﻿Item #,Name\r\nDISC-1,Vitex\r\n');
  eq(headers, ['Item #', 'Name'], 'BOM stripped from the first header — not "﻿Item #"');
  eq(rows, [['DISC-1', 'Vitex']], 'CRLF splits records; trailing CRLF makes no empty row');
}
{
  const { rows } = parseCsv('a,b\r1,2\r3,4');   // bare CR line endings
  eq(rows, [['1', '2'], ['3', '4']], 'bare CR is a record separator');
}

// ── C — quoted fields: embedded comma, newline, escaped quote ───────────────────
{
  const { rows } = parseCsv('name,notes\nSun,"Full sun, part shade"');
  eq(rows[0], ['Sun', 'Full sun, part shade'], 'a comma inside quotes is literal, not a split');
}
{
  const { headers, rows } = parseCsv('name,notes\n"\'Sierra\' Oak","Drought tolerant\nDeep roots"');
  eq(headers, ['name', 'notes'], 'header intact');
  eq(rows.length, 1, 'an embedded newline inside quotes does NOT start a new record');
  eq(rows[0][1], 'Drought tolerant\nDeep roots', 'the embedded newline is preserved verbatim');
  ok(rows[0][0] === "'Sierra' Oak", 'a wrapping-quoted name keeps its inner apostrophes');
}
{
  const { rows } = parseCsv('a\n"she said ""hi"""');
  eq(rows[0], ['she said "hi"'], 'a doubled quote inside quotes is one literal quote');
}

// ── D — blank lines, padded short rows, ragged extras ───────────────────────────
{
  const { rows } = parseCsv('a,b,c\n1,2,3\n\n4,5,6\n');
  eq(rows, [['1', '2', '3'], ['4', '5', '6']], 'a blank physical line is dropped, not a row of empties');
}
{
  const { rows } = parseCsv('a,b,c\n1,2');
  eq(rows[0], ['1', '2', ''], 'a short row is padded to header width');
}
{
  const { rows } = parseCsv('a,b\n1,2,3,4');
  eq(rows[0], ['1', '2'], 'ragged trailing fields beyond the header are dropped');
}

// ── E — whitespace is preserved (trimming is a downstream decision) ─────────────
{
  const { rows } = parseCsv('name\n  Shoal Creek Vitex  ');
  ok(rows[0][0] === '  Shoal Creek Vitex  ', 'leading/trailing whitespace preserved verbatim');
}

// ── F — degenerate inputs never throw ───────────────────────────────────────────
{
  eq(parseCsv('').rows, [], 'empty text → no rows');
  eq(parseCsv('﻿').rows, [], 'a file of only a BOM → no rows');
  eq(parseCsv('only,a,header').rows, [], 'a header with no data rows → empty rows');
}

console.log(`\nparseCsv — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
