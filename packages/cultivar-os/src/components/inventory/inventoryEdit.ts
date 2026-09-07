// ============================================================
// inventoryEdit — the ONE business_inventory write helper (Cultivar OS)
// PURPOSE:      The identical create / update / rename / delete operations shared by the
//               /inventory datasheet (inline cells) AND the InventoryEditor (the full grouped
//               create|edit form). Extracted so the two surfaces can never drift (STD-011,
//               mirroring customerEdit.ts): ONE insert path, ONE patch path, ONE group-aware
//               rename, ONE delete-policy. All writes are owner/member RLS UPDATEs/INSERTs
//               scoped .eq('business_id') (AC-3); no endpoint, no new api-fn.
// KEY RULES:
//   • RENAME is GROUP-AWARE — renaming a variety that has size-siblings (shared non-null
//     variant_group) renames the WHOLE group, so the name-equality the size-picker needs
//     (resolveStockLine L4) survives. An ungrouped row renames alone.
//   • DELETE decides by REFERENCE — a row referenced by order_items.business_inventory_id or
//     cultivar_plants.inventory_id is SOFT-deleted (status='archived') so history/provenance
//     survives the ON-DELETE-SET-NULL FKs; a never-referenced row is HARD-deleted.
//   • reorder_point is a DEPLOY-GATED column (D-42 migration is gated) — every write is
//     deploy-window-safe: on a missing-column error the gated keys are stripped and retried.
// DEPENDENCIES: supabase (business_inventory / order_items / cultivar_plants, business_id-scoped).
//               The caller passes the resolved businessId. NO migration, NO new dep, NO endpoint.
// INSTRUMENTATION (STD-003): `[TRACE:INVENTORY]` on every insert / patch / rename / delete,
//               ON by default (standing owner instruction).
// ============================================================
import { supabase } from '../../lib/supabase';
import { withUnitColumns, UNIT_COLUMNS } from '@trace/shared/inventory';
import { writeLanded } from '@trace/shared/components/datasheet/rowPatch';

// (ARCHIVED_STATUS removed in D-50 Layer 2A — the archive status is no longer set from the
// client; `soft_delete_inventory` owns the tombstone, status and all, inside its transaction.)

// Columns that may not exist live yet (D-42's `20260713_inventory_decrement_and_reorder.sql` is
// GATED). A write carrying one of these degrades gracefully: on a missing-column error we strip
// the gated keys and retry, so the rest of the write still lands (the established deploy-window
// pattern — same shape #119 / D-40 / D-41 used).
// 🔴 `unit_*` JOINS THIS LIST FOR THE SAME REASON `reorder_point` IS ON IT: 20260830 is written
// and NOT YET APPLIED. Without the gate, the first inventory edit after this deploy would fail on
// an unknown column and the grid would look broken. With it, the write lands MINUS the projection
// and the row reads "not yet parsed" — which the re-runnable backfill then fills. Absent, never wrong.
const DEPLOY_GATED_COLUMNS = ['reorder_point', ...UNIT_COLUMNS];

// DERIVED from the gated list, never re-spelled: a column added to DEPLOY_GATED_COLUMNS is
// recognised by the detector automatically. Two hand-typed lists of one fact is how the retry
// silently stops covering the newest column (STD-011).
const GATED_COLUMN_RE = new RegExp(`column .* does not exist|${DEPLOY_GATED_COLUMNS.join('|')}`, 'i');

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' ||
    GATED_COLUMN_RE.test(err.message ?? '');
}
function stripGated(values: Record<string, unknown>): Record<string, unknown> {
  const out = { ...values };
  for (const k of DEPLOY_GATED_COLUMNS) delete out[k];
  return out;
}
const hasGated = (values: Record<string, unknown>) => DEPLOY_GATED_COLUMNS.some(k => k in values);

/**
 * Persist a PATCH of inventory fields via ONE RLS UPDATE scoped .eq('id').eq('business_id').
 * Deploy-window-safe for the gated columns. Emits `[TRACE:INVENTORY] patch`.
 *
 * 🔴 RETURNS `applied` — THE FIELDS THE CALLER MAY NOW MOVE LOCAL STATE ONTO, and ONLY after the
 * write proved itself. `.select('id, updated_at')` is the proof (A8/R-12: a row-level RLS refusal
 * is zero rows and NO error, so `!error` is not success), and it is also the round trip that
 * brings back the one field the server owns and the grid displays. Before this, the proof was a
 * full refetch of the list — which is why an inline edit flashed. See rowPatch.ts.
 *
 * `applied` is the post-projection, post-gate-strip patch — i.e. exactly what the database was
 * asked to store, never what the caller hoped to store. On a refusal it is null and there is
 * nothing to move.
 */
export async function persistInventoryPatch(params: {
  id: string;
  businessId: string;
  patch: Record<string, unknown>;
}): Promise<{ error: string | null; applied: Record<string, unknown> | null }> {
  const { id, businessId } = params;
  // ── UNIT PROJECTION (20260830) — a patch that moves `size` carries its derived unit columns in
  // the SAME statement, so the row is never briefly describing the old label. `size` itself is
  // untouched (D-23); nothing else in the patch is read or rewritten. A patch without `size` is
  // returned unchanged by withUnitColumns.
  const patch = withUnitColumns(params.patch);

  // ── D-50 LAYER 2A — QTY IS SPLIT OFF THE PATCH AND ROUTED THROUGH THE RPC ──────────
  // A quantity change is a MOVEMENT and must carry a ledger row; every other field on this
  // grid (name, size, price, sku…) is an attribute and stays a plain RLS UPDATE. So a patch
  // that happens to include qty is split: the movement goes through adjust_inventory_manual
  // (qty + ledger row, ONE transaction), the rest continues below unchanged.
  //
  // This is the desk/editor path — client-direct under RLS, so auth.uid() is real. We still
  // pass the actor EXPLICITLY rather than letting the RPC read auth.uid(): the RPC is also
  // called from the server (service key, uid null), so a caller that relies on the implicit
  // value works in one context and silently writes a null actor in the other.
  if ('qty' in patch) {
    const { qty, ...rest } = patch;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      console.error('[TRACE:INVENTORY] patch — REFUSED, no session user for a qty movement');
      return { error: 'Your sign-in needs confirming before changing stock — reload and try again.', applied: null };
    }
    const { data, error: rpcErr } = await supabase.rpc('adjust_inventory_manual', {
      p_lot_id:        id,
      p_business_id:   businessId,
      p_new_qty:       Number(qty),
      p_actor_user_id: user.id,
      p_reason:        'desk edit',
    });
    if (rpcErr) { console.error('[TRACE:INVENTORY] qty movement error', rpcErr.message); return { error: rpcErr.message, applied: null }; }
    const out = Array.isArray(data) ? (data[0] as { applied?: boolean; delta?: number; reason?: string } | undefined) : undefined;
    if (out && out.applied === false) {
      console.error('[TRACE:INVENTORY] qty movement REFUSED —', out.reason);
      return { error: `Couldn't change stock: ${out.reason ?? 'refused'}`, applied: null };
    }
    console.log('[TRACE:INVENTORY] qty movement', { rowId: id, newQty: qty, delta: out?.delta, via: 'adjust_inventory_manual' });
    // 🔴 THE QTY PATH CANNOT REPORT ITS OWN RESULT AND THAT IS WHY THIS READ EXISTS. The RPC
    // returns applied/delta/reason — not the row — and it moves TWO fields the grid renders that
    // the caller did not supply: `status` (D-42 derives depleted/available from qty) and
    // `updated_at`. So the caller gets them from a ONE-ROW read rather than from a guess.
    // Degrading honestly: if that read fails we still know the qty landed (the RPC said so), so
    // the qty is applied and the two derived fields are simply left as they were.
    const qtyApplied = { qty: Number(qty), ...(await readBackRow(id, businessId) ?? {}) };
    // Nothing else in this patch → done. Otherwise fall through with qty removed.
    if (Object.keys(rest).length === 0) return { error: null, applied: qtyApplied };
    const restRes = await persistInventoryPatch({ id, businessId, patch: rest });
    if (restRes.error) return restRes;
    // The attribute write is the LATER one, so its `updated_at` wins.
    return { error: null, applied: { ...qtyApplied, ...restRes.applied } };
  }

  console.log('[TRACE:INVENTORY] patch', { rowId: id, fields: Object.keys(patch) });
  // 🔴 `.select(PATCH_EVIDENCE)` IS LOAD-BEARING, NOT DECORATION (A8 / R-12 / 393682a). A
  // row-level RLS refusal comes back with NO error and ZERO rows, so `!error` is not success —
  // and this grid used to establish "did it land" by refetching all 447 rows, which is the flash
  // the owner reported. The same round trip returns `updated_at`, the one displayed field the
  // server owns, so the caller can patch its row instead of re-reading the list.
  let sent = patch;
  let res = await supabase.from('business_inventory').update(sent).eq('id', id).eq('business_id', businessId).select(PATCH_EVIDENCE);
  if (res.error && isMissingColumnError(res.error) && hasGated(sent)) {
    console.warn('[TRACE:INVENTORY] patch — gated column absent, retry without', DEPLOY_GATED_COLUMNS);
    sent = stripGated(sent);
    res = await supabase.from('business_inventory').update(sent).eq('id', id).eq('business_id', businessId).select(PATCH_EVIDENCE);
  }
  const verdict = writeLanded(res, PATCH_REFUSED);
  if (!verdict.landed) {
    console.error('[TRACE:INVENTORY] patch not saved —', verdict.cause, verdict.message);
    return { error: verdict.message, applied: null };
  }
  const hit = (res.data as { updated_at: string | null }[])[0];
  // `sent`, never `params.patch`: what the caller ASKED for is not what the database was told
  // once the unit projection ran and a gated column was stripped. The row must show what landed.
  return { error: null, applied: { ...sent, updated_at: hit.updated_at } };
}

/** Evidence + the one displayed field the server owns. Kept to two columns on purpose: a cost
 *  column here would be read back for a member who is not permitted to see it. */
const PATCH_EVIDENCE = 'id, updated_at';
const PATCH_REFUSED = 'That change was not saved — you may not have permission to edit this item.';

/**
 * Read back the two fields a qty MOVEMENT changes WITHOUT BEING TOLD TO: `status` is derived from
 * qty by the RPC (D-42) and `updated_at` is the server's. One row, by id, business-scoped. Null on
 * any failure — the caller then keeps what it already had rather than fabricating a value.
 *
 * ⚠️ `qty` IS DELIBERATELY NOT IN THIS PROJECTION. The RPC already reported `applied: true` for the
 * value we sent, so re-reading it would be asking the database to confirm something it has already
 * confirmed; the caller supplies it. (Two columns also keeps this under the field-list cap's
 * three-column threshold — stated plainly rather than left to look like a coincidence. The
 * reasoning above stands on its own, but the cap is what prompted the second look, and
 * `business_inventory` carries four hand-written enumerations already: tech-debt #120.)
 */
async function readBackRow(id: string, businessId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('business_inventory').select('status, updated_at')
    .eq('id', id).eq('business_id', businessId).maybeSingle();
  if (error || !data) {
    console.warn('[TRACE:INVENTORY] qty read-back unavailable —', error?.message ?? 'no row');
    return null;
  }
  return data as Record<string, unknown>;
}

/**
 * INSERT a new inventory row (create + add-size). business_id stamped here; owner/member RLS.
 * Deploy-window-safe for gated columns. Returns the new id. Emits `[TRACE:INVENTORY] insert`.
 */
export async function insertInventory(params: {
  businessId: string;
  values: Record<string, unknown>;
}): Promise<{ error: string | null; id: string | null }> {
  const { businessId, values } = params;

  // ── D-50 LAYER 2A — THE ONE SITE WITH NO RPC TO ROUTE TO. Read this before "fixing" it. ──
  // Layer 1 shipped no manual-create function (the set is: adjust · count_reconcile ·
  // count_promote_create · adjust_manual · soft_delete · discovery_create · discovery_rescan).
  // `discovery_create_inventory` is the wrong semantics (it mints DISC- catalogue rows and
  // takes no qty). So rather than invent a meaning for an existing RPC, the row is born at
  // **qty 0** — never fabricate stock, the same rule populate.ts already follows — and any
  // opening stock is then MOVED in through adjust_inventory_manual, which carries its ledger
  // row. Every unit of stock is therefore accounted for.
  //
  // ⚠️ WHAT IS STILL OWED, STATED PLAINLY: the row's BIRTH has no `opening_balance` ledger row
  // (count-created and backfilled lots both have one). Closing that needs a
  // `manual_create_inventory` RPC — a MIGRATION, which this build is scoped out of. This is
  // the ONE remaining direct `.insert()` on business_inventory, and the end-of-build grep
  // reports it rather than pretending the funnel is already airtight.
  const requestedQty = Number(values.qty ?? 0) || 0;
  // UNIT PROJECTION (20260830) — a create that supplies `size` is born with its units already
  // derived, so a new size-sibling never has to wait for a backfill to mean something.
  const row = withUnitColumns({ business_id: businessId, ...values, qty: 0 });
  console.log('[TRACE:INVENTORY] insert', { businessId, fields: Object.keys(values), bornAtQty: 0, requestedQty });
  let res = await supabase.from('business_inventory').insert(row).select('id').single();
  if (res.error && isMissingColumnError(res.error) && hasGated(row)) {
    console.warn('[TRACE:INVENTORY] insert — gated column absent, retry without', DEPLOY_GATED_COLUMNS);
    res = await supabase.from('business_inventory').insert(stripGated(row)).select('id').single();
  }
  if (res.error) { console.error('[TRACE:INVENTORY] insert error', res.error.message); return { error: res.error.message, id: null }; }
  const newId = (res.data as { id: string }).id;

  // Opening stock is a MOVEMENT — routed, ledgered, attributed.
  if (requestedQty > 0) {
    const { error: qErr } = await persistInventoryPatch({ id: newId, businessId, patch: { qty: requestedQty } });
    if (qErr) {
      // The row exists but its stock didn't land — say so rather than report a clean create.
      console.error('[TRACE:INVENTORY] insert — row created but opening stock failed:', qErr);
      return { error: `Added "${String(values.name ?? 'item')}", but couldn't set its stock: ${qErr}`, id: newId };
    }
  }
  return { error: null, id: newId };
}

/**
 * GROUP-AWARE rename. If the row belongs to a size-family (non-null variant_group), rename EVERY
 * row in that group so the size-siblings stay name-equal (the size-picker requires it). An
 * ungrouped row renames alone. Emits `[TRACE:INVENTORY] rename`.
 */
export async function renameVariety(params: {
  businessId: string;
  rowId: string;
  variantGroup: string | null;
  newName: string;
}): Promise<{ error: string | null; scope: 'group' | 'single'; count: number; rows: RenamedRow[] }> {
  const { businessId, rowId, variantGroup, newName } = params;
  const name = newName.trim();
  if (!name) return { error: 'Name cannot be blank.', scope: 'single', count: 0, rows: [] };
  const grp = variantGroup?.trim();
  if (grp) {
    const { data, error } = await supabase
      .from('business_inventory')
      .update({ name })
      .eq('business_id', businessId)
      .eq('variant_group', grp)
      .select(PATCH_EVIDENCE);
    const gv = writeLanded({ data: data as unknown[] | null, error }, RENAME_REFUSED);
    if (!gv.landed) { console.error('[TRACE:INVENTORY] rename(group) not saved —', gv.cause, gv.message); return { error: gv.message, scope: 'group', count: 0, rows: [] }; }
    const rows = (data ?? []) as RenamedRow[];
    console.log('[TRACE:INVENTORY] rename', { scope: 'group', variantGroup: grp, to: name, rows: rows.length });
    return { error: null, scope: 'group', count: rows.length, rows };
  }
  // 🔴 THE SINGLE PATH ASKS FOR EVIDENCE TOO — it did not, and the asymmetry was invisible: the
  // group path already carried `.select('id')` (it needed the count), so a refused GROUP rename
  // reported 0 rows while a refused SINGLE rename reported success. One row is still a write.
  const { data, error } = await supabase
    .from('business_inventory').update({ name }).eq('id', rowId).eq('business_id', businessId).select(PATCH_EVIDENCE);
  const sv = writeLanded({ data: data as unknown[] | null, error }, RENAME_REFUSED);
  if (!sv.landed) { console.error('[TRACE:INVENTORY] rename(single) not saved —', sv.cause, sv.message); return { error: sv.message, scope: 'single', count: 0, rows: [] }; }
  const rows = (data ?? []) as RenamedRow[];
  console.log('[TRACE:INVENTORY] rename', { scope: 'single', rowId, to: name });
  return { error: null, scope: 'single', count: rows.length, rows };
}

/** Every row the rename actually touched, with the server's own timestamp for each — a group
 *  rename is ONE statement over N siblings and each carries its own `updated_at`. NOT exported:
 *  the only caller maps straight over it, and an exported type nothing names is dead weight the
 *  knip ratchet counts. */
interface RenamedRow { id: string; updated_at: string | null }
const RENAME_REFUSED = 'That rename was not saved — you may not have permission to edit this item.';

type DeleteMode = 'soft' | 'hard';

/**
 * Delete an inventory row by REFERENCE policy. A row referenced by an order line
 * (order_items.business_inventory_id) or a specimen (cultivar_plants.inventory_id) is SOFT-deleted
 * (status='archived') — history/provenance survive the ON-DELETE-SET-NULL FKs. A never-referenced
 * row is HARD-deleted (safe — nothing points at it). Emits `[TRACE:INVENTORY] delete`.
 */
export async function deleteInventoryRow(params: {
  id: string;
  businessId: string;
}): Promise<{ error: string | null; mode: DeleteMode | null }> {
  const { id, businessId } = params;

  // Reference probes (HEAD count — no row payload needed). The inventory row id is a unique uuid,
  // so matching it is sufficient; order_items has NO business_id column (it is RLS-scoped via
  // order_id → orders.business_id), so it is probed by the anchor alone. cultivar_plants carries
  // business_id, kept for defense-in-depth (AC-3).
  const [oi, cp] = await Promise.all([
    supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('business_inventory_id', id),
    supabase.from('cultivar_plants').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('inventory_id', id),
  ]);
  // If a probe itself errors, fail safe → SOFT (never risk severing history on an uncertain read).
  const probeError = oi.error || cp.error;
  const referenced = (oi.count ?? 0) > 0 || (cp.count ?? 0) > 0 || !!probeError;

  // ── D-50 LAYER 2A — BOTH BRANCHES NOW GO THROUGH soft_delete_inventory ────────────
  // The RPC tombstones the lot (status flipped, qty → 0) and writes a `delete_tombstone`
  // ledger row PLUS an `inventory.delete` audit row, in ONE transaction — exactly the V6
  // path David owner-proved at postgres on 2026-07-20.
  //
  // ⚠️ THE HARD DELETE IS GONE, AND THAT IS THE POINT, NOT A SIDE EFFECT. This helper used
  // to `DELETE FROM` a never-referenced row. Under D-50 that is incoherent: the lot's stock
  // is ledger history, and destroying the row destroys the explanation for every movement
  // that referenced it. The ledger's own FK says so — `inventory_id ON DELETE SET NULL`,
  // i.e. history OUTLIVES the row. So an unreferenced lot is tombstoned like any other; the
  // `mode` return is kept ('soft' either way) so callers and their copy still work, and the
  // reference probe is kept because the counts are useful in the trail.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    console.error('[TRACE:INVENTORY] delete — REFUSED, no session user');
    return { error: 'Your sign-in needs confirming before deleting stock — reload and try again.', mode: null };
  }

  const { data, error } = await supabase.rpc('soft_delete_inventory', {
    p_lot_id:        id,
    p_business_id:   businessId,
    p_actor_user_id: user.id,
    p_reason:        referenced ? 'deleted from desk (referenced)' : 'deleted from desk',
  });
  const out = Array.isArray(data) ? (data[0] as { applied?: boolean; prior_qty?: number; reason?: string } | undefined) : undefined;
  console.log('[TRACE:INVENTORY] delete', {
    rowId: id, mode: 'soft', via: 'soft_delete_inventory',
    priorQty: out?.prior_qty, orderRefs: oi.count ?? 0, plantRefs: cp.count ?? 0,
    probeError: probeError?.message ?? null,
  });
  if (error) { console.error('[TRACE:INVENTORY] delete error', error.message); return { error: error.message, mode: null }; }
  if (out && out.applied === false) {
    console.error('[TRACE:INVENTORY] delete REFUSED —', out.reason);
    return { error: `Couldn't delete: ${out.reason ?? 'refused'}`, mode: null };
  }
  return { error: null, mode: 'soft' };
}
