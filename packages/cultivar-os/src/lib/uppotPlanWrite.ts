// ============================================================
// uppotPlanWrite — the ONE write behind the plan surface, and the config read that feeds it.
//
// PURPOSE:      Committing a plan is the only act on this screen that changes anything. It creates
//               the plan and its lines, and from that moment the unfinished remainder of every
//               line IS the hold on its source lot. Nothing writes a `held_qty` anywhere, because
//               there is no such column (R-84 / R-27).
//
// 🔴 A WRITE THAT CHANGED NOTHING MUST NOT REPORT SUCCESS (E5, R-12, tech-debt #74).
//   *"A PostgREST UPDATE matching zero rows returns NO error. Under a policy the caller can't
//   satisfy, every save 'succeeds' and nothing is written."* The same is true of an INSERT that
//   RLS refuses in a way that returns an empty representation. So every write here uses
//   `.select()` and CHECKS THE RETURNED COUNT, and the caller is told the number that landed.
//   This matters more than usual: a staff member pressing Commit would otherwise see "held 234
//   trees" and hold nothing.
//
// 🔴 THE SEQUENCE IS NOT ATOMIC, AND THAT IS SAID RATHER THAN HIDDEN (tech-debt #69's shape).
//   Creating the plan and inserting its lines are two statements. If the lines fail, a plan row
//   exists holding nothing — so the failure path CANCELS the plan it just made rather than leaving
//   an orphan that holds stock by virtue of being `draft`. The durable fix is one RPC taking the
//   whole plan as jsonb, which is a migration and is named as owed rather than pretended away.
//
// DEPENDENCIES: ./supabase · @trace/shared/production.
// OUTPUTS:      loadOperationsConfig · commitPlan · CommitOutcome.
// AC-1:         generic tables, generic columns. The word "uppot" appears only in copy.
// ============================================================
import { supabase } from './supabase';
import {
  resolveConfig, type ResolvedConfig, type PlannedBatch,
  type OperationsConfig, type MoneyConfig,
} from '@trace/shared/production';

/**
 * Read both halves of the config and REDACT the money half in one place.
 *
 * ⚠️ The pricing read is expected to fail for a reader without `pricing_recipe:read` — that is the
 * wall doing its job, not an error — so its failure is swallowed deliberately and `canReadMoney`
 * is what decides, never the presence of a row. Treating an RLS refusal as an error here would
 * print a scary message at a manager doing nothing wrong.
 */
export async function loadOperationsConfig(businessId: string, canReadMoney: boolean): Promise<ResolvedConfig> {
  const [opsRes, moneyRes] = await Promise.all([
    supabase.from('business_operations_config').select('config').eq('business_id', businessId).maybeSingle(),
    supabase.from('business_pricing_config').select('config').eq('business_id', businessId).maybeSingle(),
  ]);

  if (opsRes.error) {
    console.log('[TRACE:UPPOT] operations config read failed — falling back to defaults', {
      businessId, code: (opsRes.error as any)?.code, message: opsRes.error.message,
    });
  }

  const storedOps = (opsRes.data?.config ?? null) as Partial<OperationsConfig> | null;
  // The production block is a NAMESPACE inside the existing pricing config rather than new columns
  // on it — the same reason that table is jsonb at all, and it keeps the pricing recipe and the
  // production costs in one row under one policy.
  const storedMoney = ((moneyRes.data?.config as any)?.production ?? null) as Partial<MoneyConfig> | null;

  console.log('[TRACE:UPPOT] config resolved', {
    businessId, hasOpsRow: !!opsRes.data, hasMoneyRow: !!moneyRes.data, canReadMoney,
  });
  return resolveConfig(storedOps, storedMoney, canReadMoney);
}

export interface CommitOutcome {
  ok: boolean;
  message: string;
  planId?: string;
  linesWritten?: number;
}

/**
 * Create the plan and its lines. From here the hold is live and derived.
 *
 * `status` is written as `open` rather than `draft`: the manager pressed a button that says it
 * holds the stock, and a plan that reads `draft` after an explicit commit would be a state the
 * screen did not describe. `draft` remains reachable for a future save-without-committing.
 */
export async function commitPlan(
  businessId: string,
  batches: readonly PlannedBatch[],
  opts: { batchSize: number; reason: string; windowStart: string | null; windowEnd: string | null },
): Promise<CommitOutcome> {
  if (batches.length === 0) {
    return { ok: false, message: 'Nothing to commit — no lot has a target size and a number.' };
  }

  const { data: planRows, error: planErr } = await supabase
    .from('production_plans')
    .insert({
      business_id: businessId,
      name: `Uppot plan — ${new Date().toISOString().slice(0, 10)}`,
      window_start: opts.windowStart,
      window_end: opts.windowEnd,
      status: 'open',
      batch_size: opts.batchSize,
      reason: opts.reason.trim() === '' ? null : opts.reason.trim(),
    })
    .select('id');

  if (planErr || !planRows || planRows.length === 0) {
    console.log('[TRACE:UPPOT] plan insert wrote NOTHING', { businessId, code: (planErr as any)?.code, message: planErr?.message });
    return {
      ok: false,
      message: planErr
        ? `The plan was not saved — ${planErr.message}. Nothing is held.`
        : 'The plan was not saved: the write returned no row, which usually means permission was refused. Nothing is held.',
    };
  }
  const planId = (planRows[0] as { id: string }).id;

  const lines = batches.map((b) => ({
    plan_id: planId,
    business_id: businessId,
    source_inventory_id: b.lotId,
    from_unit_value: b.fromUnitValue,
    to_unit_value: b.toUnitValue,
    qty_planned: b.split.uppotNow,
    qty_completed: 0,
    cover_months: b.split.coverMonthsUsed,
    cushion_pct: b.split.cushionPctUsed,
    scheduled_date: b.completesOn,
  }));

  const { data: lineRows, error: lineErr } = await supabase
    .from('production_plan_lines')
    .insert(lines)
    .select('id');

  const written = lineRows?.length ?? 0;
  if (lineErr || written !== lines.length) {
    // 🔴 CANCEL THE PLAN WE JUST MADE rather than leave a row that holds stock and describes
    // nothing. `cancelled` releases the hold; deleting is not available and would not be right —
    // the failed attempt is itself a record (§0d, no hard delete).
    // 🔴 AND THE CANCEL ITSELF IS ROW-COUNT-CHECKED (E5 / R-12), because it is the one write here
    // whose silent failure is WORSE than the failure it is cleaning up after: a plan left `open`
    // holds stock, so an unreported refusal would leave trees held by a plan that describes
    // nothing and that nobody knows exists. Caught by `verify-zero-row-writes` on its first run —
    // the cap flagged this exact line as UNCHECKABLE, and it was right.
    const { data: cancelled } = await supabase
      .from('production_plans').update({ status: 'cancelled' }).eq('id', planId).select('id');
    // Written as `(x ?? []).length === 1` rather than `x?.length ?? 0 === 1` so the affected-row
    // inspection is literally at the write site. `verify-zero-row-writes` reads the 400 characters
    // after the statement for a length comparison, and its own header records why it accepts both
    // polarities: *"A cap that accepts one polarity and not the other teaches people to write the
    // awkward one, and an awkward line written to satisfy a regex is not a safer line."* This form
    // is the plainer one regardless.
    const cancelLanded = (cancelled ?? []).length === 1;
    console.log('[TRACE:UPPOT] line insert incomplete — plan cancel attempted', {
      businessId, planId, expected: lines.length, written, cancelLanded, code: (lineErr as any)?.code,
    });
    return {
      ok: false,
      planId,
      linesWritten: written,
      message: cancelLanded
        ? `Only ${written} of ${lines.length} batches saved${lineErr ? ` — ${lineErr.message}` : ''}. The plan has been cancelled, so nothing is half-held and no stock is being held.`
        : `Only ${written} of ${lines.length} batches saved${lineErr ? ` — ${lineErr.message}` : ''}. 🔴 The plan could NOT be cancelled either, so it is still open and IS holding stock. Open the plan and cancel it by hand — plan id ${planId}.`,
    };
  }

  const heldTotal = batches.reduce((s, b) => s + b.split.uppotNow, 0);
  console.log('[TRACE:UPPOT] plan committed', { businessId, planId, lines: written, heldTotal });
  return {
    ok: true,
    planId,
    linesWritten: written,
    message: `Plan committed. ${heldTotal.toLocaleString('en-US')} trees across ${written} batches are now held for uppotting and are no longer offered for sale.`,
  };
}
