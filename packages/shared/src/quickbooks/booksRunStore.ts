// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: remember what the books review said, so the NEXT run can be compared with it. One row
//   per run, one row per finding, append-only. The comparison is the product — *"33 sizes we could
//   not read last month, 13 today"* — and a screen that remembers nothing can never produce it.
// DEPENDENCIES: ./booksFindings (Finding) · ./booksReport (WalkState) · @supabase/supabase-js
//   (type only). `planBooksRun` is PURE; `saveBooksRun` is the only thing here that touches a
//   database, and it takes its client as an argument.
// OUTPUTS: BooksRunPlan · BooksResultRow · SaveRunVerdict · planBooksRun · saveBooksRun.
// STORY: *David rehearses the import on a saved copy* (`user_stories.md`, ARC: ocr-doc-routing).
// TABLES: `books_report_runs` · `books_report_results` (`20260908_books_report_runs.sql`).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 CLIENT-SIDE, AND NO `api/` FUNCTION IS MINTED (David's ruling, 2026-09-08).
// ══════════════════════════════════════════════════════════════════════════════════════════
// The browser already holds everything this needs: the findings are computed there, from capture
// bodies it already has, and the tables are `business_id`-scoped under RLS like every other table
// the app writes. An endpoint would add a network hop, a second copy of the mapping, and — the
// binding constraint — **function #13 against a 12-of-12 Vercel Hobby ceiling**, where the deploy
// does not error, it silently serves the last-good bundle (§6 r11).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A REFUSED WRITE IS NOT A SUCCESSFUL ONE, AND THIS IS THE PATH WHERE THAT MATTERS MOST.
// ══════════════════════════════════════════════════════════════════════════════════════════
// PostgREST returns NO ERROR when an insert is refused by RLS — zero rows, `error: null` (A8, and
// tech-debt #216: a head-only read returns 204 with `error: null` for a table that does not
// EXIST). Two failure modes are live here and both look identical to success:
//   ① **the migration has not been applied** — David applies it by hand, so between this build and
//      that moment the tables genuinely are not there;
//   ② a member without the permission the policy names.
// So every insert carries `.select('id')` and its verdict is READ. The screen then says the report
// was produced and NOT recorded, which is the truth — and is very different from the review
// silently never accumulating a history while appearing to work perfectly.
//
// ⚠️ AND A FAILED SAVE NEVER BLOCKS THE REPORT. R-57: no finding may block an ingest, and the same
// reasoning is stronger here — a bookkeeping row failing to write must not cost Lauren the document
// she pressed the button for. `saveBooksRun` returns a verdict; nothing calls it for permission.
//
// ⚠️ NO CUSTOMER DATA IS PERSISTED. `Finding.rows` is screen-only and is not mapped here — storing
// a customer's book of customers is a separate ruling nobody has made (R-23 clause b). What lands
// is counts, and counts name nobody. A probe asserts the mapped row has no field that could carry
// one, rather than leaving it to this paragraph.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Finding } from './booksFindings';
import type { WalkState } from './booksReport';

/** One finding, reduced to the columns `books_report_results` holds. Counts only. */
export interface BooksResultRow {
  rule_id: string;
  rule_version: number;
  matched: number;
  /** Named `of` to map one-for-one onto `Finding.population.of` and onto the column. */
  of: number;
  noun: string;
  value: number | null;
  measured: boolean;
}

export interface BooksRunPlan {
  /**
   * 🔴 WERE ALL THREE WALKS READ *AND* COMPLETE. A run built on a partial read is not comparable
   * with one built on a whole read, and comparing across the two reports a business improving when
   * it only read less. This flag is what lets a future reader refuse the comparison.
   */
  complete: boolean;
  /** The three reads verbatim, as `WalkState[]`. Stored as jsonb — a record, not a model. */
  walks: WalkState[];
  results: BooksResultRow[];
}

export type SaveRunVerdict =
  | { saved: true; runId: string; results: number }
  | { saved: false; reason: string };

/**
 * Map a completed evaluation onto the two tables. PURE — no clock, no client, no id generation.
 *
 * ⚠️ `ran_at` IS NOT SET HERE. The database's own `now()` is the only clock that cannot be a
 * browser with the wrong date on it, and a run's timestamp is the axis the whole comparison is
 * ordered on.
 *
 * ⚠️ EVERY FINDING IS STORED, INCLUDING THE ONES THAT COULD NOT RUN. Dropping them would make a
 * rule that FAILED this month indistinguishable from a rule that was fixed — the comparison would
 * read a broken walk as an improvement, which is the single worst thing these tables could do.
 */
export function planBooksRun(findings: Finding[], walks: WalkState[]): BooksRunPlan {
  return {
    complete: walks.length > 0 && walks.every(w => w.read && w.complete),
    walks,
    results: findings.map(f => ({
      rule_id: f.id,
      rule_version: f.version,
      matched: f.population.matched,
      of: f.population.of,
      noun: f.population.noun,
      value: f.value,
      measured: f.measured,
    })),
  };
}

const REFUSED_RUN =
  'The report was produced, but this run was not recorded — the books-report tables may not exist yet, '
  + 'or your account may not be allowed to write to them. Nothing else on this screen is affected.';

/**
 * Append one run and its results. Returns a verdict; it never throws and never blocks.
 *
 * 🔴 THE RESULTS ARE INSERTED AS ONE STATEMENT AND THE RETURNED COUNT IS COMPARED WITH WHAT WAS
 * SENT. `length !== plan.results.length` is stronger than `length === 0`: a partial insert — some
 * rows refused by a row-level policy and the rest accepted — would otherwise be reported as a
 * success, and a run whose findings are half stored is worse than one that is not stored at all,
 * because the comparison would still run and would silently be wrong.
 */
export async function saveBooksRun(
  supabase: SupabaseClient,
  businessId: string,
  plan: BooksRunPlan,
): Promise<SaveRunVerdict> {
  try {
    const run = await supabase
      .from('books_report_runs')
      .insert({ business_id: businessId, walks: plan.walks, complete: plan.complete })
      .select('id');
    if (run.error) return { saved: false, reason: run.error.message };
    // A8 — zero rows and no error is exactly what an RLS refusal looks like, and exactly what a
    // missing table looks like through PostgREST. Neither is a saved run.
    if (!run.data || run.data.length !== 1) return { saved: false, reason: REFUSED_RUN };
    const runId = String((run.data[0] as { id: unknown }).id);

    if (plan.results.length === 0) return { saved: true, runId, results: 0 };

    const res = await supabase
      .from('books_report_results')
      .insert(plan.results.map(r => ({ ...r, run_id: runId })))
      .select('id');
    if (res.error) return { saved: false, reason: res.error.message };
    if (!res.data || res.data.length !== plan.results.length) {
      return { saved: false, reason: REFUSED_RUN };
    }
    return { saved: true, runId, results: res.data.length };
  } catch (e: unknown) {
    // 🔴 A THROW IS A REFUSAL, NOT A CRASH. This runs immediately after a report is rendered for a
    // customer; an unhandled rejection here would take the screen with it over a bookkeeping row.
    return { saved: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
