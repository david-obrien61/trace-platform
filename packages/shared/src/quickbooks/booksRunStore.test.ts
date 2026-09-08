/**
 * ── booksRunStore — the run that was not recorded must not look like one that was ─────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not the mapping — that is seven fields. What is under test is
 * the FOUR ways a save can fail while looking exactly like a success, every one of which is live:
 *   §B  the tables do not exist yet (David applies the migration by hand — this is the ordinary
 *       state between builder-complete and his SQL editor), and PostgREST answers with no error
 *   §C  RLS refuses the insert: zero rows, `error: null`
 *   §D  a PARTIAL insert — some result rows accepted, some refused — which would leave a run whose
 *       findings are half stored and a comparison that still runs and is silently wrong
 *   §E  the client throws, and the throw takes the report screen with it
 *
 * 🔴 AND THE DOUBLE MODELS THOSE REFUSALS RATHER THAN STAMPING EVERY INSERT (§6 r19 / [[R-33]]).
 * A fake more forgiving than the real system is a rubber stamp, and the assertions resting on it
 * are decoration — which is exactly how a partial-index defect passed 87 green assertions.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/booksRunStore.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { planBooksRun, saveBooksRun } from './booksRunStore';
import type { Finding } from './booksFindings';
import type { WalkState } from './booksReport';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const walk = (entity: WalkState['entity'], o: Partial<WalkState> = {}): WalkState =>
  ({ entity, read: true, expected: 10, retrieved: 10, complete: true, fromFile: false,
     queriedAt: '2026-09-08T09:00:00.000Z', ...o });

const finding = (o: Partial<Finding> = {}): Finding => ({
  id: 'sizes-we-could-not-read', version: 1, tier: 'tidiness', shape: 'implausible-distribution',
  sentence: '15 products carry something in the size position we could not read.',
  population: { matched: 15, of: 564, noun: 'products' },
  measured: true, notMeasured: null, quoted: '33 items', remeasured: null, value: null,
  recommendation: null, needsAnswer: null,
  rows: null, rowsTotal: 0, window: null, blocks: [], clean: false, ...o,
});

// ── the double. It REFUSES what the real system refuses; nothing here stamps. ──
type Refusal = 'none' | 'missing-table' | 'rls' | 'partial' | 'throw';
function fakeSupabase(mode: Refusal, seen: { table: string; rows: unknown[] }[] = []) {
  return {
    seen,
    from(table: string) {
      return {
        insert(payload: unknown) {
          const rows = Array.isArray(payload) ? payload : [payload];
          seen.push({ table, rows });
          return {
            select(_cols: string) {
              if (mode === 'throw') throw new Error('network is down');
              // 🔴 A MISSING TABLE AND AN RLS REFUSAL PRODUCE THE SAME SHAPE THROUGH POSTGREST:
              // no error, no rows. Modelling them separately would be modelling our hopes.
              if (mode === 'missing-table' || mode === 'rls') return Promise.resolve({ data: [], error: null });
              if (mode === 'partial' && table === 'books_report_results') {
                return Promise.resolve({ data: rows.slice(0, 1).map((_, i) => ({ id: `r${i}` })), error: null });
              }
              return Promise.resolve({ data: rows.map((_, i) => ({ id: table === 'books_report_runs' ? 'run-1' : `r${i}` })), error: null });
            },
          };
        },
      };
    },
  } as never;
}

// ══ §A THE MAPPING — COUNTS ONLY, AND EVERY FINDING ════════════════════════════════════════
{
  const findings = [
    finding(),
    finding({ id: 'trip-charge-missing', measured: false, population: { matched: 0, of: 0, noun: '' } }),
    finding({ id: 'customers-entered-more-than-once', value: null,
              rows: [{ id: 'c1', label: 'Rebeca Cedillos', group: 'g1', note: 'a shared email address' }],
              rowsTotal: 1 }),
  ];
  const plan = planBooksRun(findings, [walk('Item'), walk('Customer'), walk('Invoice')]);
  ok(plan.results.length === 3,
    '🔴 EVERY FINDING IS STORED, INCLUDING THE ONE THAT COULD NOT RUN. Dropping it makes a rule that FAILED this month indistinguishable from a rule that was fixed — the comparison would read a broken walk as an improvement');
  ok(plan.results[0].rule_id === 'sizes-we-could-not-read' && plan.results[0].rule_version === 1,
    'and each carries the id AND the version, which together are the comparison key');
  ok(plan.results[0].matched === 15 && plan.results[0].of === 564 && plan.results[0].noun === 'products',
    'with the population it was measured over');

  const json = JSON.stringify(plan.results);
  ok(!json.includes('Rebeca Cedillos') && !json.includes('shared email'),
    '🔴 NO CUSTOMER DATA IS PERSISTED. The finding carries the records; the stored row carries counts. Storing a customer\'s book of customers is a separate ruling nobody has made (R-23 b)');
  ok(!json.includes('sentence') && !json.includes('size position'),
    'and the SENTENCE is not stored either — prose is regenerated from the rule, and a stored copy is the one that goes stale');
  ok(!JSON.stringify(plan).includes('ran_at'),
    '🔴 `ran_at` IS NOT SET HERE. The database\'s `now()` is the only clock that cannot be a browser with the wrong date on it, and it is the axis the whole comparison is ordered on');

  ok(plan.complete === true, 'three complete walks make a complete run');
  ok(planBooksRun(findings, [walk('Item'), walk('Customer', { complete: false })]).complete === false,
    '🔴 AND ONE INCOMPLETE WALK MAKES THE RUN INCOMPLETE. Comparing a partial read against a whole one reports a business improving when it only read less');
  ok(planBooksRun(findings, []).complete === false,
    'no walks at all is not "complete" — an empty read must never certify anything');
}

// ── §B–§F are ASYNC. `run-tests.mjs` bundles to CJS, where top-level await is not
//    available, so they live in one function that is awaited before the tally prints —
//    a tally printed before the assertions ran would report 'all passed' on nothing.
async function main(): Promise<void> {
  // ══ §B 🔴 THE TABLES DO NOT EXIST YET — THE ORDINARY STATE, AND IT IS SILENT ═══════════════
  {
    const plan = planBooksRun([finding()], [walk('Item')]);
    const v = await saveBooksRun(fakeSupabase('missing-table'), 'biz-1', plan);
    ok(v.saved === false,
      '🔴 A MISSING TABLE IS NOT A SAVED RUN. David applies the migration by hand, so between this build and that moment the tables genuinely are not there — and PostgREST answers with no error and no rows, which is indistinguishable from success unless the count is read');
    ok(v.saved === false && /not recorded/.test(v.reason),
      'and the reason is one an owner can act on, not a status code');
    ok(v.saved === false && /Nothing else on this screen is affected/.test(v.reason),
      '🔴 AND IT SAYS THE REPORT IS STILL FINE. A bookkeeping row failing to write must not read as the document having failed (R-57\'s reasoning, one step stronger)');
  }

  // ══ §C 🔴 RLS REFUSAL — ZERO ROWS, NO ERROR ════════════════════════════════════════════════
  {
    const v = await saveBooksRun(fakeSupabase('rls'), 'biz-1', planBooksRun([finding()], [walk('Item')]));
    ok(v.saved === false,
      'a refused insert reports zero rows and `error: null`, and the only thing that can tell it from a success is the count');
  }

  // ══ §D 🔴 A PARTIAL INSERT IS A FAILURE, NOT A SUCCESS ═════════════════════════════════════
  {
    const plan = planBooksRun([finding(), finding({ id: 'never-sold' }), finding({ id: 'contact-reach' })], [walk('Item')]);
    const v = await saveBooksRun(fakeSupabase('partial'), 'biz-1', plan);
    ok(v.saved === false,
      '🔴 ONE OF THREE RESULT ROWS LANDING IS NOT A SAVE. `length !== sent` is strictly stronger than `length === 0`: a run whose findings are half stored is worse than one not stored at all, because the comparison still runs and is silently wrong');
  }

  // ══ §E 🔴 A THROW IS A REFUSAL, NOT A CRASH ════════════════════════════════════════════════
  {
    const v = await saveBooksRun(fakeSupabase('throw'), 'biz-1', planBooksRun([finding()], [walk('Item')]));
    ok(v.saved === false && /network is down/.test(v.reason),
      'a client that throws is reported as a refusal with its own message — this runs immediately after a report is rendered for a customer, and an unhandled rejection would take the screen with it over a bookkeeping row');
  }

  // ══ §F THE HAPPY PATH — AND THE DOUBLE MUST BE ABLE TO SAY YES ═════════════════════════════
  {
    const seen: { table: string; rows: unknown[] }[] = [];
    const plan = planBooksRun([finding(), finding({ id: 'never-sold' })], [walk('Item'), walk('Customer'), walk('Invoice')]);
    const v = await saveBooksRun(fakeSupabase('none', seen), 'biz-1', plan);
    ok(v.saved === true && v.results === 2,
      '🔴 THE NEGATIVE CONTROL ON EVERY REFUSAL ABOVE: the double CAN return a success, so the four failures are the code deciding and not the fake refusing everything');
    ok(seen[0].table === 'books_report_runs' && seen[1].table === 'books_report_results',
      'the run is written first, because a result row with no run to hang on has nowhere to be');
    ok((seen[1].rows as { run_id: string }[]).every(r => r.run_id === 'run-1'),
      'and every result carries the id the run actually came back with, never one the client made up');

    const empty = await saveBooksRun(fakeSupabase('none'), 'biz-1', planBooksRun([], [walk('Item')]));
    ok(empty.saved === true && empty.results === 0,
      'a run with no findings writes the run and no results, rather than sending an empty insert');
  }
}

void main().then(() => {
  console.log(`\n  booksRunStore — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}).catch((e: unknown) => {
  // A throw ESCAPING the suite must fail it. Without this the process exits 0 and the
  // runner reads a crashed file as a passing one — [[R-33]] in the harness itself.
  console.error('   ✗ the suite itself threw:', e);
  process.exit(1);
});
