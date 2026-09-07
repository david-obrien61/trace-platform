/**
 * ── rowPatch — prove, THEN move · the inline-edit reload · 2026-09-07 ─────────────────────────
 *
 * David, reporting the defect on /inventory:
 *
 *   "an inline edit flashes and reloads. The cause is almost certainly a full refetch after the
 *    write, and the refetch is there to prove the write landed. THAT PROOF ALREADY EXISTS IN A
 *    BETTER FORM: 393682a's pattern writes with .select('id') for evidence and moves local state
 *    only after the write is proven. So patch the single row from the write's own response — no
 *    refetch, no flash, same honesty.
 *    ⚠️ Do NOT fix it by moving local state before the write is proven. That is the defect Pass 1
 *    removed from four write sites."
 *
 * Both halves are asserted here, and the SECOND one is the one that can be got wrong quietly: a
 * zero-row RLS refusal comes back from PostgREST with NO error, so `!error` is not success. Before
 * this pass /assets asked only `if (error)` and the refetch was the only thing that ever
 * contradicted it — remove the refetch without adding the evidence and a refused edit becomes a
 * clean lie instead of a confusing snap-back.
 *
 * Run: node_modules/.bin/esbuild packages/shared/src/components/datasheet/rowPatch.test.ts \
 *        --bundle --platform=node --format=cjs | node
 */

import { writeLanded, applyRowPatch, applyRowPatches } from './rowPatch';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const REFUSED = 'That change was not saved — you may not have permission to edit this item.';

// ══ §A — THE THREE OUTCOMES OF A WRITE, AND THE SILENT ONE ═══════════════════
ok(writeLanded({ data: [{ id: 'a' }], error: null }, REFUSED).landed,
   '§A one affected row is the only thing that counts as landed');
{
  const v = writeLanded({ data: [], error: null }, REFUSED);
  ok(!v.landed, '🔴 §A ZERO ROWS AND NO ERROR IS A REFUSAL — the whole reason `.select` is on the write');
  ok(v.cause === 'refused' && v.message === REFUSED,
     '§A …and it is reported in the caller\'s own words, not as a database error it never was');
}
{
  const v = writeLanded({ data: null, error: { message: 'permission denied for table x' } }, REFUSED);
  ok(!v.landed && v.cause === 'error' && v.message === 'permission denied for table x',
     '§A a real error carries ITS OWN message through — the two failures are not merged');
}
ok(!writeLanded({ data: null, error: null }, REFUSED).landed,
   '§A a null payload with no error is not success either (a `.select()` nobody asked for)');
// 🔴 The negative control that keeps this honest: an error WITH rows is still a failure. A double
// that returns both must not be read as "well, something came back".
ok(!writeLanded({ data: [{ id: 'a' }], error: { message: 'boom' } }, REFUSED).landed,
   '§A rows returned alongside an error is still a failure — the error is checked first');

// ══ §B — THE ROW MOVES, AND ONLY THE ROW ════════════════════════════════════
// The half that kills the flash: every untouched row keeps its OBJECT IDENTITY, so React
// re-renders one row instead of 447. A `map` that rebuilt each row would pass a value check and
// fail this one.
interface Row { id: string; name: string; qty: number; updated_at?: string | null }
const ROWS: Row[] = [
  { id: 'r1', name: 'Lacey Oak', qty: 4 },
  { id: 'r2', name: 'Shumard Red Oak', qty: 9 },
  { id: 'r3', name: 'Lacey Oak', qty: 1 },
];
{
  const out = applyRowPatch(ROWS, 'r2', { qty: 12, updated_at: '2026-09-07T10:00:00Z' });
  ok(out[1].qty === 12 && out[1].updated_at === '2026-09-07T10:00:00Z', '§B the edited row carries what landed');
  ok(out !== ROWS, '§B a NEW array is returned — React state is not mutated in place');
  ok(out[0] === ROWS[0] && out[2] === ROWS[2],
     '🔴 §B every untouched row keeps its OBJECT IDENTITY — this is the assertion that is the fix');
  ok(ROWS[1].qty === 9, '§B …and the input array is untouched');
}
{
  // A patch for a row that is no longer on screen must not manufacture a re-render, and must
  // certainly not append a phantom row.
  const out = applyRowPatch(ROWS, 'gone', { qty: 99 });
  ok(out === ROWS, '§B an unknown id returns the SAME array — no re-render, no phantom row');
  ok(out.length === 3, '§B …and nothing was appended');
}

// ══ §C — A GROUP RENAME IS ONE STATEMENT OVER N ROWS ════════════════════════
// Each sibling comes back with its OWN updated_at. Stamping one row's timestamp onto its siblings
// would be fabricating a value, which is the thing we do not do.
{
  const out = applyRowPatches(ROWS, [
    { id: 'r1', applied: { name: 'Lacey Oak (TX)', updated_at: 't1' } },
    { id: 'r3', applied: { name: 'Lacey Oak (TX)', updated_at: 't3' } },
  ]);
  ok(out[0].name === 'Lacey Oak (TX)' && out[2].name === 'Lacey Oak (TX)', '§C both siblings are renamed');
  ok(out[0].updated_at === 't1' && out[2].updated_at === 't3',
     '🔴 §C each sibling keeps ITS OWN timestamp — one shared patch object would have stamped one row\'s onto the other');
  ok(out[1] === ROWS[1], '§C the row outside the group is untouched, identity and all');
}
ok(applyRowPatches(ROWS, []) === ROWS, '§C an empty patch list is a no-op, not an array rebuild');
ok(applyRowPatches(ROWS, [{ id: 'gone', applied: { name: 'x' } }]) === ROWS,
   '§C …and a patch list that matches nothing is a no-op too');

// ══ §D — THE ORDER: PROVE, THEN MOVE ════════════════════════════════════════
// The rule stated as the caller must implement it. A refused write leaves state EXACTLY as it was,
// which is what makes "no refetch" safe: the screen keeps showing what the database still holds.
{
  const verdict = writeLanded({ data: [], error: null }, REFUSED);
  const next = verdict.landed ? applyRowPatch(ROWS, 'r2', { qty: 12 }) : ROWS;
  ok(next === ROWS && next[1].qty === 9,
     '🔴 §D A REFUSED WRITE MOVES NOTHING — the old value stays on screen, because it is still the true one');
}

console.log(`\nrowPatch: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
