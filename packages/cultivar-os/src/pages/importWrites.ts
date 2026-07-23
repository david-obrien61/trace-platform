// ============================================================
// importWrites — execute an ACCEPTED CSV-import plan through the EXISTING writes. Cultivar OS.
//
// PURPOSE:      The pure core (@trace/shared/import) decides WHAT each row does; this is the only
//               place that DOES it — because only the app holds supabase + the session actor. It
//               is deliberately thin: it invents no new write path and, crucially, NO new api
//               function (12/12 ceiling held). Every qty change rides the D-50 Layer-1 RPCs;
//               every field change rides the ONE inventory patch helper.
//
// TWO MECHANISMS, NEVER MERGED (the prompt's contract):
//   • qty / on-hand → the LEDGER RPCs. A CREATE is `count_promote_create_inventory` at qty 0
//     (a born-empty opening_balance — never fabricate stock) followed by `adjust_inventory_manual`
//     with p_kind='import' to MOVE the stock in with its own ledger row. An existing lot's qty is
//     `adjust_inventory_manual`, p_kind='import', p_reason naming the file. NO bare UPDATE, ever.
//     WHY qty-0-then-import and not count_promote(qty=N): count_promote stamps its genesis
//     'count_reconcile', and that is the exact signal the import CONFLICT rule keys on to protect
//     David's PHYSICAL counts. An import must never masquerade as a physical count — so it is born
//     empty (opening_balance) and its stock arrives as an honest kind='import' movement. Provenance
//     stays clean and a re-import cannot false-CONFLICT against an import's own genesis.
//   • sell_price / price_basis / attributes / size → persistInventoryPatch (the shared patch path).
//     A price is not a movement; it writes NO ledger row.
//
// PARTIAL FAILURE IS SURFACED PER ROW (#69): the sequence of RPCs for one row is NOT one
// transaction, and the ledger is append-only — earlier steps cannot be rolled back. So each row's
// outcome names exactly where it stopped, and the run continues to the next row rather than
// swallowing the rest. The surface shows every outcome.
//
// INSTRUMENTATION (STD-003): `[TRACE:IMPORT]` on every row, ON by default.
// ============================================================
import { supabase } from '../lib/supabase';
import { persistInventoryPatch } from '../components/inventory/inventoryEdit';

/** A CREATE: mint a lot (born empty) + patch its fields + move its stock in + regroup the parent. */
export interface ExecCreate {
  op: 'create';
  rowIndex: number;
  name: string;
  size: string;
  variantGroup: string;
  sku: string | null;
  qty: number | null;                     // null / 0 → no stock movement (born empty)
  patch: Record<string, unknown>;         // sell_price / price_basis / attributes (never qty/size)
  regroup: string[];                      // sibling ids whose blank variant_group must be backfilled
}
/** A SET-LOT: patch an existing lot's fields + (if it changes) set its on-hand via an import move.
 *  Covers FILL, UPDATE, an owner-overwritten CONFLICT, and a resolved AMBIGUOUS pick. */
export interface ExecSetLot {
  op: 'setLot';
  rowIndex: number;
  lotId: string;
  newQty: number | null;                  // null → no qty movement (missing qty, or agrees already)
  patch: Record<string, unknown>;         // may include size (fill), price, basis, attributes
}
export type ExecWrite = ExecCreate | ExecSetLot;

export interface ApplyOutcome { rowIndex: number; ok: boolean; detail: string; }
export interface ApplyResult { applied: number; failed: number; outcomes: ApplyOutcome[] }

const importReason = (fileName: string) => `CSV import: ${fileName}`;

async function patchIfAny(id: string, businessId: string, patch: Record<string, unknown>): Promise<string | null> {
  if (!patch || Object.keys(patch).length === 0) return null;
  const { error } = await persistInventoryPatch({ id, businessId, patch });
  return error;
}

/** Move an existing lot's on-hand to `newQty` via the import-kinded ledger RPC. Returns an error
 *  string or null. A no-op (delta 0) returns null — the RPC records nothing, correctly. */
async function moveQtyImport(
  lotId: string, businessId: string, actorId: string, newQty: number, fileName: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('adjust_inventory_manual', {
    p_lot_id: lotId, p_business_id: businessId, p_new_qty: newQty,
    p_actor_user_id: actorId, p_reason: importReason(fileName), p_kind: 'import',
  });
  if (error) return error.message;
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.applied === false) return `stock move refused: ${row.reason ?? 'refused'}`;
  return null;
}

/**
 * Execute the accepted writes in order. Owner-only surface; the RPCs are additionally member-checked
 * server-side (assert_movement_actor), and RLS scopes every write to business_id (AC-3).
 */
export async function applyImportPlan(
  writes: ExecWrite[],
  ctx: { businessId: string; fileName: string },
): Promise<ApplyResult> {
  const { businessId, fileName } = ctx;
  const { data: { user } } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;

  const outcomes: ApplyOutcome[] = [];
  if (!actorId) {
    // No session actor → we cannot attribute a single write; refuse the whole run honestly.
    for (const w of writes) outcomes.push({ rowIndex: w.rowIndex, ok: false, detail: 'Sign-in not confirmed — reload and try again.' });
    return { applied: 0, failed: writes.length, outcomes };
  }

  console.log('[TRACE:IMPORT] apply — start', { rows: writes.length, file: fileName, actor: actorId });

  for (const w of writes) {
    const stop = (detail: string) => { outcomes.push({ rowIndex: w.rowIndex, ok: false, detail }); };
    try {
      if (w.op === 'create') {
        // 1 — mint the lot, born empty, with its opening_balance genesis (never fabricate stock).
        const { data, error } = await supabase.rpc('count_promote_create_inventory', {
          p_business_id: businessId, p_actor_user_id: actorId, p_name: w.name, p_qty: 0,
          p_size: w.size, p_variant_group: w.variantGroup, p_sku: w.sku,
          p_reason: importReason(fileName), p_source_id: null,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row?.inventory_id) { stop(`couldn't create the lot: ${error?.message ?? row?.reason ?? 'refused'}`); continue; }
        const newId = row.inventory_id as string;
        console.log('[TRACE:IMPORT] create', { rowIndex: w.rowIndex, id: newId, name: w.name, size: w.size });

        // 2 — its fields (price/basis/attributes).
        const pErr = await patchIfAny(newId, businessId, w.patch);
        if (pErr) { stop(`created the lot, but its price/details didn't save: ${pErr}`); continue; }

        // 3 — its opening stock as an import movement.
        if ((w.qty ?? 0) > 0) {
          const qErr = await moveQtyImport(newId, businessId, actorId, w.qty as number, fileName);
          if (qErr) { stop(`created the lot, but its stock didn't land: ${qErr}. The empty lot is on the catalog.`); continue; }
        }

        // 4 — regroup the parent(s) so the size-picker fires by construction (D-49).
        for (const sibId of w.regroup) {
          const gErr = await patchIfAny(sibId, businessId, { variant_group: w.variantGroup });
          if (gErr) { stop(`created + stocked the lot, but grouping its family failed: ${gErr}`); break; }
        }
        outcomes.push({ rowIndex: w.rowIndex, ok: true, detail: `created "${w.name}" (${w.size})` });
        continue;
      }

      // setLot — an existing lot (FILL / UPDATE / overwritten CONFLICT / resolved AMBIGUOUS).
      const pErr = await patchIfAny(w.lotId, businessId, w.patch);
      if (pErr) { stop(`details didn't save: ${pErr}`); continue; }
      if (w.newQty != null) {
        const qErr = await moveQtyImport(w.lotId, businessId, actorId, w.newQty, fileName);
        if (qErr) { stop(`its details saved, but the stock change failed: ${qErr}`); continue; }
      }
      console.log('[TRACE:IMPORT] setLot', { rowIndex: w.rowIndex, lotId: w.lotId, newQty: w.newQty });
      outcomes.push({ rowIndex: w.rowIndex, ok: true, detail: 'updated' });
    } catch (e) {
      stop(e instanceof Error ? e.message : String(e));
    }
  }

  const applied = outcomes.filter(o => o.ok).length;
  const failed = outcomes.length - applied;
  console.log('[TRACE:IMPORT] apply — done', { applied, failed });
  return { applied, failed, outcomes };
}
