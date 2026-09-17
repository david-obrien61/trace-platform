// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the TEST-MODE half of the opening stock seed (ledger #342). Sets `qty` on rows the
//   QuickBooks import created and writes NOTHING to `business_inventory_ledger` — David's ruling
//   of 2026-09-16: *"we must never allow them to write to the actual record during testing."*
//   The live half is unchanged and stays in OpeningStockSeed.tsx, on `adjust_inventory_manual`.
// DEPENDENCIES: ./itemImportWriter (DbLike) · ./openingStock (SeedStep). A supabase client is
//   passed in. RLS applies: the member update policy on business_inventory is `inventory:update`.
// OUTPUTS: seedQtyWithoutLedger · SEED_TEST_CHUNK.
// STORY: *The imported catalogue can be sold from* (`user_stories.md`, ARC: cost-to-produce).
// INSTRUMENTATION (STD-003): `[TRACE:SEED]` per chunk. ON BY DEFAULT.
//
// 🔴 THE FILTERS ARE THE GUARANTEE, NOT THE PLAN. The planner already chose imported, empty,
//   history-free rows — but a plan is a snapshot and the table moves. So every UPDATE re-asserts
//   what it may touch, AT THE DATABASE: this tenant · these ids · `import_run_id IS NOT NULL` ·
//   not retired · `qty = 0` · a status the RPC would also re-derive. A row that stopped matching
//   between plan and press is not written, and the shortfall is REPORTED rather than silent.
//
// ⚠️ IT IS A DIRECT `UPDATE qty` — THE THING R-93's NEIGHBOUR DECLARATION WARNS AGAINST — AND
//   THAT IS THE RULING, NOT AN ACCIDENT. In test mode there must be no provenance line, because
//   the line would be permanent and the number is practice. The debt is named: the opening line
//   is owed after the switch, and nothing writes it yet (tech-debt #308).
// ─────────────────────────────────────────────────────────────────────────────
import type { DbLike } from './itemImportWriter';
import type { SeedStep } from './openingStock';

/** Ids per UPDATE — well under PostgREST's URL ceiling for an `in.(…)` of uuids. */
export const SEED_TEST_CHUNK = 100;

/** The statuses `adjust_inventory_manual` re-derives from qty. Any other (damaged, returned,
 *  deleted…) is a human's statement and is left alone, exactly as the RPC leaves it. */
const DERIVED_STATUSES = ['available', 'depleted', 'reserved'];

export interface TestSeedReport {
  ok: boolean;
  written: number;
  planned: number;
  error: string | null;
}

export async function seedQtyWithoutLedger(
  db: DbLike, businessId: string, steps: SeedStep[],
): Promise<TestSeedReport> {
  const planned = steps.length;
  if (steps.some(s => s.writesLedger)) {
    // A live step handed to the test writer is a wiring defect; refusing it is cheaper than a guess.
    return { ok: false, written: 0, planned, error: 'A step that must write the stock record was sent to the test-mode writer. Nothing was changed.' };
  }
  const qtys = new Set(steps.map(s => s.newQty));
  if (qtys.size > 1) {
    return { ok: false, written: 0, planned, error: 'A seed sets one starting number for every product. Nothing was changed.' };
  }
  const qty = steps[0]?.newQty ?? 0;
  let written = 0;
  for (let i = 0; i < steps.length; i += SEED_TEST_CHUNK) {
    const ids = steps.slice(i, i + SEED_TEST_CHUNK).map(s => s.lotId);
    const { data, error } = await db.from('business_inventory')
      .update({ qty, status: 'available' })
      .eq('business_id', businessId)
      .in('id', ids)
      .not('import_run_id', 'is', null)
      .is('retired_at', null)
      .eq('qty', 0)
      .in('status', DERIVED_STATUSES)
      .select('id');
    if (error) {
      console.log('[TRACE:SEED] test-mode chunk FAILED', { businessId, done: written, of: planned, message: error.message });
      return { ok: false, written, planned, error: `Stopped after ${written} of ${planned}: ${error.message}. Nothing was written to your stock record; pressing again picks up where this stopped.` };
    }
    // 🔴 A WHOLE CHUNK THAT WROTE NOTHING IS A REFUSAL UNTIL PROVEN OTHERWISE (R-12 / A8) — stop.
    if ((data ?? []).length === 0) {
      console.log('[TRACE:SEED] test-mode chunk wrote ZERO rows — stopping', { businessId, done: written, of: planned });
      return { ok: false, written, planned, error: `Set ${written} of ${planned}, then a batch of ${ids.length} was not written at all — your permissions refused it, or those products changed since this screen loaded. Nothing was written to your stock record.` };
    }
    const n = (data ?? []).length;
    written += n;
    console.log('[TRACE:SEED] test-mode chunk — qty set, NO ledger row (ruling ②)', { businessId, chunk: ids.length, written: n, qty });
  }
  // 🔴 A SHORTFALL IS REPORTED, NEVER ROUNDED UP (R-12 / A8): a zero-row UPDATE is what an RLS
  // refusal looks like, and a row changed since the screen loaded looks the same.
  if (written !== planned) {
    return { ok: false, written, planned, error: `Set ${written} of ${planned}. The rest were not written — either they changed since this screen loaded, or your permissions refused the change. Nothing was written to your stock record.` };
  }
  return { ok: true, written, planned, error: null };
}
