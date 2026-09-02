/**
 * ── captureReplay — loading somebody's books from a file instead of from their books ──────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST, AND IT IS NOT THE HAPPY PATH. A capture file is the one
 * input to this system that did not come from Intuit — it came from a disk, and it can be
 * truncated by a failed download, hand-edited, or simply be the wrong file. The failure that
 * matters is therefore ACCEPTANCE, not rejection: a bad file that loads produces a books
 * review over a partial list, and every finding computed from it is confidently wrong about a
 * real business. So the refusals below outnumber the acceptances deliberately.
 *
 * §A  the happy path, and that the count page is NOT counted as rows
 * §B  the envelope refusals — not JSON, not a capture, unknown entity, no pages
 * §C  🔴 the self-disagreement refusals — the file's own header vs its own pages
 * §D  the completeness refusal, re-run over the file rather than read out of it
 * §E  that a refusal is never silently a success (no ok:true leaks a partial list)
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/captureReplay.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readCaptureFile, REPLAY_SOURCE } from './captureReplay';
import { qboCountQuery } from './qboRead';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const countPage = (entity: 'Item' | 'Customer' | 'Invoice', total: number) => ({
  query: qboCountQuery(entity), start_position: 0, http_status: 200,
  body: JSON.stringify({ QueryResponse: { totalCount: total } }),
});
const rowPage = (entity: 'Item' | 'Customer' | 'Invoice', n: number, start = 1) => ({
  query: `select * from ${entity} startposition ${start} maxresults 1000`,
  start_position: start, http_status: 200,
  body: JSON.stringify({ QueryResponse: { [entity]: Array.from({ length: n }, (_, i) => ({ Id: String(start + i) })) } }),
});
const file = (entity: 'Item' | 'Customer' | 'Invoice', total: number, rows: number[], over: Record<string, unknown> = {}) => ({
  entity, realm_id: '9341455222430707', queried_at: '2026-09-02T10:00:00.000Z',
  expected_total: total, retrieved_total: rows.reduce((a, b) => a + b, 0), complete: true,
  pages: [countPage(entity, total), ...rows.map((n, i) => rowPage(entity, n, 1 + i * 1000))],
  ...over,
});

// ── §A the happy path ────────────────────────────────────────────────────────
{
  const r = readCaptureFile(file('Item', 685, [685]));
  ok(r.ok === true, 'a complete, self-consistent capture loads');
  if (r.ok) {
    ok(r.entity === 'Item', 'the entity comes off the file');
    ok(r.expectedTotal === 685 && r.retrievedTotal === 685, 'expected and retrieved both re-derived at 685');
    ok(r.source === REPLAY_SOURCE, 'a replayed read is STAMPED as a file — a screen must never present it as a live pull');
    // 🔴 THE SILENT ONE. The count page sits in `pages` alongside the row pages. Parsing it as
    // rows yields zero, so including it would break nothing and quietly make every re-count
    // one page short of honest.
    ok(r.rowPageCount === 1, 'the COUNT page is not counted as a page of rows');
    ok(r.rowBodies.length === 1, 'and it is not handed downstream as a body to parse');
    ok(r.rowBodies.every(b => !b.includes('totalCount')), 'the count body specifically is not among the row bodies');
  }
}
{
  const r = readCaptureFile(file('Invoice', 1469, [1000, 469]));
  ok(r.ok === true && r.retrievedTotal === 1469 && r.rowPageCount === 2,
    'a multi-page invoice capture re-counts across pages');
}
{
  // A STRING is accepted, because "not JSON" and "not a capture" are two different problems
  // and a caller collapsing them would report one wrong sentence for both.
  const r = readCaptureFile(JSON.stringify(file('Customer', 1936, [1000, 936])));
  ok(r.ok === true && r.retrievedTotal === 1936, 'raw text is parsed, and 1,936 customers re-count');
}

// ── §B the envelope refusals ─────────────────────────────────────────────────
{
  const notJson = readCaptureFile('this is not json at all {');
  ok(notJson.ok === false && notJson.code === 'NOT_JSON', 'text that is not JSON is refused as NOT_JSON');
  const notCapture = readCaptureFile('[1,2,3]');
  ok(notCapture.ok === false && notCapture.code === 'NOT_A_CAPTURE', 'JSON that is not a capture envelope is refused separately');
  const noEntity = readCaptureFile({ ...file('Item', 1, [1]), entity: undefined });
  ok(noEntity.ok === false && noEntity.code === 'UNKNOWN_ENTITY', 'a file that does not say what it holds is refused');
  const wrongEntity = readCaptureFile({ ...file('Item', 1, [1]), entity: 'Payment' });
  ok(wrongEntity.ok === false && wrongEntity.code === 'UNKNOWN_ENTITY', 'an entity this platform does not read is refused, not guessed at');
  const noPages = readCaptureFile({ ...file('Item', 1, [1]), pages: [] });
  ok(noPages.ok === false && noPages.code === 'NO_PAGES', 'an empty pages array is refused');
  const noCount = readCaptureFile({ ...file('Item', 5, [5]), pages: [rowPage('Item', 5)] });
  ok(noCount.ok === false && noCount.code === 'NO_COUNT_PAGE',
    '🔴 a file with rows but NO saved count is refused — completeness is unprovable, and "probably fine" is the posture that let 100 rows pass for 1,127');
}

// ── §C the self-disagreement refusals ────────────────────────────────────────
{
  // The header says 1,469; the count page says 1,200. One of them is a lie and we cannot tell
  // which, so neither is used.
  const f = file('Invoice', 1469, [1469]);
  f.pages[0] = countPage('Invoice', 1200);
  const r = readCaptureFile(f);
  ok(r.ok === false && r.code === 'COUNT_DISAGREES',
    '🔴 a header total that disagrees with the saved count page is refused');
}
{
  // The header claims 1,469 retrieved. The pages hold 900. This is EXACTLY what a truncated
  // download looks like, and it is the shape that would produce a confident review of 61% of
  // a business's invoices.
  const r = readCaptureFile(file('Invoice', 1469, [900], { retrieved_total: 1469 }));
  ok(r.ok === false, '🔴 a header claiming more rows than the file holds is refused');
  ok(r.ok === false && (r.code === 'ROWS_DISAGREE' || r.code === 'INCOMPLETE'),
    'and it is refused by name — a truncated download is not a warning above a table');
}
{
  const r = readCaptureFile(file('Item', 685, [685], { complete: false }));
  ok(r.ok === true,
    '🔴 `complete:false` in the file does NOT by itself refuse — the flag is a claim about a check, and the check is re-run');
}
{
  const f = file('Item', 685, [685]);
  (f.pages[1] as { http_status: number }).http_status = 401;
  const r = readCaptureFile(f);
  ok(r.ok === false && r.code === 'UNREADABLE_PAGE', 'a saved page that is a failure, not records, is refused');
}
{
  const f = file('Item', 685, [685]);
  (f.pages[1] as { body: string }).body = '{ not json';
  const r = readCaptureFile(f);
  ok(r.ok === false && r.code === 'UNREADABLE_PAGE', 'a saved page that will not parse is refused');
}

// ── §D completeness, RE-RUN rather than read ─────────────────────────────────
{
  // Header and pages agree with each other at 900 — the file is internally consistent — but
  // QuickBooks said 1,469. Internal consistency is not completeness.
  const r = readCaptureFile(file('Invoice', 1469, [900], { retrieved_total: 900 }));
  ok(r.ok === false && r.code === 'INCOMPLETE',
    '🔴 a SELF-CONSISTENT file that is still short of the count is refused as INCOMPLETE — the live refusal, re-run over the file');
  ok(r.ok === false && /1,?469/.test(r.headline) && /900/.test(r.headline),
    'and the refusal names both numbers, so the reader knows how short it fell');
}
{
  const f = file('Item', 685, [685]);
  f.pages[0] = { ...countPage('Item', 685), body: '{ "QueryResponse": {} }' };
  const r = readCaptureFile(f);
  ok(r.ok === false && r.code === 'NO_COUNT_PAGE',
    'an unreadable count is not silently treated as zero, nor as "no ceiling" — it is a refusal');
}

// ── §E no refusal leaks a list ───────────────────────────────────────────────
{
  const bad: unknown[] = [
    'not json {', '[1,2,3]',
    { ...file('Item', 1, [1]), entity: 'Payment' },
    { ...file('Item', 1, [1]), pages: [] },
    file('Invoice', 1469, [900], { retrieved_total: 1469 }),
    file('Invoice', 1469, [900], { retrieved_total: 900 }),
  ];
  ok(bad.every(b => {
    const r = readCaptureFile(b);
    return r.ok === false && typeof r.headline === 'string' && r.headline.length > 0;
  }), 'every refusal is ok:false AND carries a sentence — none returns rows, none returns a bare false');
  ok(bad.every(b => !('rowBodies' in (readCaptureFile(b) as object))),
    '🔴 and no refusal carries rowBodies — a partial list cannot reach a caller that forgot to check `ok`');
}

// ── §F the invariant that makes the projection's two count fields interchangeable ────────
{
  // 🔴 THIS PROBE EXISTS TO GUARD AN EQUIVALENCE CLAIM MADE ELSEWHERE. The projection mutant P8
  // (`retrieved_total: replay.expectedTotal`) SURVIVES its suite, and the reason is not a hole:
  // the gate refuses anything where the two differ, so on a `CaptureReplay` they are always the
  // same number and the substitution cannot be observed. That is a real equivalence — but it is
  // a property of THIS gate, not a law, and if the completeness refusal is ever relaxed the
  // equivalence silently becomes a defect. So the property is asserted here rather than
  // reasoned about in a comment, and this probe goes red the moment it stops holding.
  const cases: [number, number[]][] = [[685, [685]], [1469, [1000, 469]], [1936, [1000, 936]], [1, [1]]];
  ok(cases.every(([total, rows]) => {
    const r = readCaptureFile(file('Item', total, rows));
    return r.ok === true && r.expectedTotal === r.retrievedTotal;
  }), '🔴 every capture the gate ACCEPTS has expectedTotal === retrievedTotal — the completeness refusal makes any other pair unreachable');
  ok(readCaptureFile(file('Item', 685, [600], { retrieved_total: 600 })).ok === false,
    'and a pair that differs is refused rather than returned, which is what makes the invariant hold');
}

console.log(`\n  captureReplay — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
