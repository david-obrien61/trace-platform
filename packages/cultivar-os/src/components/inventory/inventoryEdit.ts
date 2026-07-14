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

const ARCHIVED_STATUS = 'archived';

// Columns that may not exist live yet (D-42's `20260713_inventory_decrement_and_reorder.sql` is
// GATED). A write carrying one of these degrades gracefully: on a missing-column error we strip
// the gated keys and retry, so the rest of the write still lands (the established deploy-window
// pattern — same shape #119 / D-40 / D-41 used).
const DEPLOY_GATED_COLUMNS = ['reorder_point'];

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '42703' || err.code === 'PGRST204' ||
    /column .* does not exist|reorder_point/i.test(err.message ?? '');
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
 */
export async function persistInventoryPatch(params: {
  id: string;
  businessId: string;
  patch: Record<string, unknown>;
}): Promise<{ error: string | null }> {
  const { id, businessId, patch } = params;
  console.log('[TRACE:INVENTORY] patch', { rowId: id, fields: Object.keys(patch) });
  let { error } = await supabase.from('business_inventory').update(patch).eq('id', id).eq('business_id', businessId);
  if (error && isMissingColumnError(error) && hasGated(patch)) {
    console.warn('[TRACE:INVENTORY] patch — gated column absent, retry without', DEPLOY_GATED_COLUMNS);
    ({ error } = await supabase.from('business_inventory').update(stripGated(patch)).eq('id', id).eq('business_id', businessId));
  }
  if (error) { console.error('[TRACE:INVENTORY] patch error', error.message); return { error: error.message }; }
  return { error: null };
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
  const row = { business_id: businessId, ...values };
  console.log('[TRACE:INVENTORY] insert', { businessId, fields: Object.keys(values) });
  let res = await supabase.from('business_inventory').insert(row).select('id').single();
  if (res.error && isMissingColumnError(res.error) && hasGated(row)) {
    console.warn('[TRACE:INVENTORY] insert — gated column absent, retry without', DEPLOY_GATED_COLUMNS);
    res = await supabase.from('business_inventory').insert(stripGated(row)).select('id').single();
  }
  if (res.error) { console.error('[TRACE:INVENTORY] insert error', res.error.message); return { error: res.error.message, id: null }; }
  return { error: null, id: (res.data as { id: string }).id };
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
}): Promise<{ error: string | null; scope: 'group' | 'single'; count: number }> {
  const { businessId, rowId, variantGroup, newName } = params;
  const name = newName.trim();
  if (!name) return { error: 'Name cannot be blank.', scope: 'single', count: 0 };
  const grp = variantGroup?.trim();
  if (grp) {
    const { data, error } = await supabase
      .from('business_inventory')
      .update({ name })
      .eq('business_id', businessId)
      .eq('variant_group', grp)
      .select('id');
    if (error) { console.error('[TRACE:INVENTORY] rename(group) error', error.message); return { error: error.message, scope: 'group', count: 0 }; }
    const count = (data ?? []).length;
    console.log('[TRACE:INVENTORY] rename', { scope: 'group', variantGroup: grp, to: name, rows: count });
    return { error: null, scope: 'group', count };
  }
  const { error } = await supabase.from('business_inventory').update({ name }).eq('id', rowId).eq('business_id', businessId);
  if (error) { console.error('[TRACE:INVENTORY] rename(single) error', error.message); return { error: error.message, scope: 'single', count: 0 }; }
  console.log('[TRACE:INVENTORY] rename', { scope: 'single', rowId, to: name });
  return { error: null, scope: 'single', count: 1 };
}

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

  if (referenced) {
    const { error } = await supabase
      .from('business_inventory')
      .update({ status: ARCHIVED_STATUS })
      .eq('id', id).eq('business_id', businessId);
    console.log('[TRACE:INVENTORY] delete', { rowId: id, mode: 'soft', orderRefs: oi.count ?? 0, plantRefs: cp.count ?? 0, probeError: probeError?.message ?? null });
    if (error) { console.error('[TRACE:INVENTORY] delete(soft) error', error.message); return { error: error.message, mode: null }; }
    return { error: null, mode: 'soft' };
  }

  const { error } = await supabase.from('business_inventory').delete().eq('id', id).eq('business_id', businessId);
  console.log('[TRACE:INVENTORY] delete', { rowId: id, mode: 'hard' });
  if (error) { console.error('[TRACE:INVENTORY] delete(hard) error', error.message); return { error: error.message, mode: null }; }
  return { error: null, mode: 'hard' };
}
