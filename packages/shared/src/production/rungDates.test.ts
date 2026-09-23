/**
 * ── rung dates — the entered date, the correction, and what it makes the lot ──
 *    2026-09-23 · ledger #391 · David's rulings 1 and 2 from LAWNS
 *
 * RED-FIRST. Every §-block was written against the un-built module and failed. The discipline is
 * R-33's: a check that cannot disagree is not a check, so the negative controls below are as
 * load-bearing as the positive ones and the ones that exist BECAUSE an earlier draft could not
 * fail are marked ⚠️ SELF-CATCH.
 *
 * Run: node_modules/.bin/esbuild packages/shared/src/production/rungDates.test.ts --bundle --platform=node --format=cjs | node
 */
import {
  currentRungDate, rungDateHistory, readinessOf, addMonthsISO, recordRungDate, rungDateProblems,
  RUNG_DATE_FIELDS, RUNG_DATE_SELECT, type RungDateRow,
} from './rungDates';

let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); console.error('   ✗ ' + m); } };

const row = (o: Partial<RungDateRow> = {}): RungDateRow => ({
  id: 'r1', inventory_id: 'L1', entered_on: '2026-06-25', unit_value: 4, note: null,
  recorded_by: 'u1', recorded_at: '2026-09-23T10:00:00Z', seq: 1, ...o,
});

// ══ §A CURRENT IS THE LATEST, AND NOTHING IS OVERWRITTEN ═══════════════════════════════════════
{
  ok(currentRungDate([]) === null, '§A an empty history has no current entry — null, not a fabricated date');

  const a = row({ id: 'a', entered_on: '2026-06-25', recorded_at: '2026-09-23T10:00:00Z', seq: 1 });
  const b = row({ id: 'b', entered_on: '2026-07-02', recorded_at: '2026-09-23T11:00:00Z', seq: 2 });
  ok(currentRungDate([a, b])!.entered_on === '2026-07-02', '🔴 §A the later row is current — a correction takes effect');
  ok(currentRungDate([b, a])!.entered_on === '2026-07-02', '§A …whatever order the rows arrive in');
  ok(rungDateHistory([a, b]).length === 2, '🔴 §A …and the original is still in the history — nothing is overwritten');
  ok(rungDateHistory([a, b])[0].id === 'b', '§A history is newest-first');

  // 🔴 THE TIE. Two corrections in ONE transaction share `recorded_at` — measured, not theoretical:
  // in PGlite, ordering on the uuid instead of `seq` picked the wrong row 7 times in 12.
  const t1 = row({ id: 'zzz', entered_on: '2026-06-25', recorded_at: '2026-09-23T10:00:00Z', seq: 1 });
  const t2 = row({ id: 'aaa', entered_on: '2026-07-02', recorded_at: '2026-09-23T10:00:00Z', seq: 2 });
  ok(currentRungDate([t1, t2])!.entered_on === '2026-07-02',
    '🔴 §A on an IDENTICAL timestamp `seq` decides, so "current" has exactly one answer');
  ok(currentRungDate([t2, t1])!.entered_on === '2026-07-02',
    '⚠️ §A SELF-CATCH: …and it is still right with the array reversed, so the probe is not passing on input order');
}

// ══ §B READINESS — FIVE STATES, AND THEY ARE NOT INTERCHANGEABLE ═══════════════════════════════
{
  ok(readinessOf('2026-06-25', 6, 'sold', '15 gal', '2027-01-01').state === 'sellable',
    '🔴 §B potted June + 6 months is sellable by January');
  const g = readinessOf('2026-06-25', 6, 'sold', '15 gal', '2026-10-01');
  ok(g.state === 'growing' && g.sellableFrom === '2026-12-25',
    '🔴 §B …and in October it is still growing, sellable from 2026-12-25');

  ok(readinessOf(null, 6, 'sold', '15 gal', '2026-10-01').state === 'no-date',
    '§B no date is its own state — not "not ready"');
  ok(readinessOf('2026-06-25', null, 'sold', '30 gal', '2026-10-01').state === 'no-grow',
    '§B an unmeasured rung is its own state — not "no date"');

  // 🔴 THE RULING. Not-sold wins over everything, checked before the date and before grow months.
  ok(readinessOf('2026-06-25', 6, 'never_sold', 'slip', '2027-01-01').state === 'not-sold',
    '🔴 §B a never-sold rung is NOT SOLD even with a date AND a grow figure — the settled fact wins');
  ok(readinessOf(null, null, 'never_sold', 'slip', '2027-01-01').state === 'not-sold',
    '§B …and with neither');
  ok(readinessOf('2026-06-25', 6, 'rarely_sold', '3/5 gal', '2027-01-01').state === 'sellable',
    '🔴 §B rarely_sold is SELLABLE — David: "3/5 gallon sells rarely and stays sellable"');

  // ⚠️ SELF-CATCH: the five states must be five. A probe that only ever saw two would pass against
  // a function that collapsed the other three.
  const seen = new Set([
    readinessOf('2026-06-25', 6, 'sold', '15 gal', '2027-01-01').state,
    readinessOf('2026-06-25', 6, 'sold', '15 gal', '2026-10-01').state,
    readinessOf(null, 6, 'sold', '15 gal', '2026-10-01').state,
    readinessOf('2026-06-25', null, 'sold', '30 gal', '2026-10-01').state,
    readinessOf('2026-06-25', 6, 'never_sold', 'slip', '2027-01-01').state,
  ]);
  ok(seen.size === 5, `⚠️ §B SELF-CATCH: all five states are reachable and distinct (got ${seen.size})`);
}

// ══ §C MONTH ARITHMETIC — THE SHORT-MONTH CLAMP ════════════════════════════════════════════════
{
  ok(addMonthsISO('2026-06-25', 6) === '2026-12-25', '§C six months from 25 June is 25 December');
  ok(addMonthsISO('2026-08-31', 6) === '2027-02-28',
    '🔴 §C 31 August + 6 CLAMPS to 28 February — it does NOT roll into March');
  ok(addMonthsISO('2024-08-31', 6) === '2025-02-28', '§C …and a leap-year-adjacent case still lands in February');
  ok(addMonthsISO('2026-12-15', 1) === '2027-01-15', '§C it crosses a year boundary');
  ok(addMonthsISO('2026-06-25', 0) === '2026-06-25', '§C zero months is the same day');
}

// ══ §D THE FIELD LIST IS THE SOURCE, THE SELECT IS DERIVED (#179) ══════════════════════════════
{
  ok(RUNG_DATE_SELECT === RUNG_DATE_FIELDS.join(', '), '§D the select string is derived from the list, never typed twice');
  ok(RUNG_DATE_FIELDS.includes('seq' as never), '🔴 §D `seq` is SELECTED — current-is-latest cannot be computed without it');
  ok(RUNG_DATE_FIELDS.includes('recorded_at' as never), '§D …and so is recorded_at');
}

async function asyncBlocks() {
// ══ §E THE WRITER — A WRITE THAT LANDED NOTHING MUST NOT SAY "SAVED" ═══════════════════════════
{
  const fake = (result: { data: unknown[] | null; error: { message: string } | null }) => ({
    from: () => ({ insert: () => ({ select: async () => result }) }),
  });
  const input = { businessId: 'b1', inventoryId: 'L1', enteredOn: '2026-06-25', unitValue: 4, note: ' liners ' };

  ok((await recordRungDate(fake({ data: [{ id: 'x' }], error: null }), input)).ok,
    '§E a write that returned a row reports success');

  // 🔴 THE DEFECT THIS EXISTS FOR (E5 / R-12 / tech-debt #74): PostgREST returns NO ERROR when RLS
  // refuses an insert — it returns an empty representation. A staff member without inventory:update
  // would otherwise be told the date was recorded.
  const refused = await recordRungDate(fake({ data: [], error: null }), input);
  ok(!refused.ok && /permission/.test(refused.message),
    '🔴 §E an insert RLS refused returns NO error and NO row — it must NOT report success, and must say why');

  const errored = await recordRungDate(fake({ data: null, error: { message: 'boom' } }), input);
  ok(!errored.ok && /Nothing changed/.test(errored.message), '§E a real error says nothing changed');

  // The note is trimmed and an empty one becomes null, not ''.
  let captured: Record<string, unknown> | null = null;
  const capture = { from: () => ({ insert: (v: Record<string, unknown>) => { captured = v; return { select: async () => ({ data: [{ id: 'x' }], error: null }) }; } }) };
  await recordRungDate(capture as never, input);
  ok((captured as unknown as Record<string, unknown>)?.note === 'liners', '§E the note is trimmed before it is written');
  await recordRungDate(capture as never, { ...input, note: '   ' });
  ok((captured as unknown as Record<string, unknown>)?.note === null, '§E …and a blank note is NULL, never an empty string');

  // 🔴 `recorded_by` MUST BE ABSENT FROM THE PAYLOAD, NOT PRESENT-AND-NULL. The column defaults to
  // `auth.uid()`; PostgREST sends whatever keys the object HAS, so a key present with a null value
  // would override the default with null and throw away the only record of who said it.
  // ⚠️ `'recorded_by' in payload` is the assertion, NOT `payload.recorded_by == null` — the second
  // passes in both cases and would be a check that cannot disagree (R-33).
  ok(!('recorded_by' in (captured as unknown as Record<string, unknown>)),
    '🔴 §E the payload OMITS recorded_by entirely, so the database stamps the real caller');
  ok(!('seq' in (captured as unknown as Record<string, unknown>)) && !('recorded_at' in (captured as unknown as Record<string, unknown>)),
    '§E …and the same for seq and recorded_at — the database owns all three');
}

// ══ §F WHAT THE WRITER REFUSES BEFORE IT WRITES ════════════════════════════════════════════════
{
  ok(rungDateProblems('2026-06-25', '2026-09-23').length === 0, '§F (negative control) a past date is fine');
  ok(rungDateProblems('2019-03-01', '2026-09-23').length === 0,
    '🔴 §F an OLD date is fine — LAWNS has stock older than the platform, and refusing it would lose the fact');
  ok(rungDateProblems('2026-12-01', '2026-09-23').some((p) => /future/.test(p)),
    '🔴 §F a FUTURE date is refused — a block cannot have been potted tomorrow');
  ok(rungDateProblems('', '2026-09-23').length === 1, '§F an empty date is refused');
  ok(rungDateProblems('25/06/2026', '2026-09-23').length === 1, '§F a non-ISO date is refused rather than mis-parsed');
}

}

// ⚠️ The §E/§F blocks live inside an async function because this repo bundles tests as CJS, which
// forbids top-level await. Nothing else about them changes.
void asyncBlocks().then(() => {
  console.log(`\n── rung dates: ${passed} passed, ${failed} failed ──`);
  if (failed > 0) { console.error(failures.map((f) => '  ✗ ' + f).join('\n')); process.exit(1); }
});
