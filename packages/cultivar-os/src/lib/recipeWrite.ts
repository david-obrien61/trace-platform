// ============================================================
// recipeWrite — READING AND WRITING A MADE ITEM'S RECIPE (ledger #370)
//
// PURPOSE:      Load a recipe for an inventory item, save it, confirm a purchase against one of its
//               components, and flag the item as made-by-us. Nothing else — there is no delete here
//               and no delete policy on either table (R-133's shape: a recipe a build run already
//               consumed against must not vanish).
//
// 🔴 PERMISSION IS THE DATABASE'S. Insert and update are gated server-side on `settings:update` by
//   the policies in 20260921; the screen hides nothing it cannot enforce. A refused write returns
//   NO error and NO row, so every write here SELECTS BACK and counts (E5 / R-12 / tech-debt #74).
//
// 🔴 IDENTITY IS `qb_item_id`, NEVER THE ROW ID, for anything that came from a catalogue load. The
//   re-import of 2026-09-21 replaced all 632 row ids and kept every QuickBooks id; a recipe keyed on
//   a row id would be rubbish after the next reload, and the database now refuses to make one
//   (`recipe_link_must_survive_a_wipe`). This file therefore never sends `component_inventory_id`.
//
// DEPENDENCIES: ./supabase · @trace/shared/costing (types only) · ./recipeDraft · ./recipeFields
//               (the ONE field declaration — every select here is DERIVED, never hand-written) ·
//               ../components/inventory/inventoryEdit (the ONE `business_inventory` writer).
// OUTPUTS:      loadRecipe · saveRecipe · confirmComponentPurchase · setItemType · ITEM_TYPES ·
//               componentIdsByPosition · readMadeItemLabel · readReceiptsForMatching ·
//               DEFAULT_MADE_ITEM_LABEL.
// INSTRUMENTATION (STD-003): [TRACE:RECIPE] — ON.
// ============================================================
import { supabase } from './supabase';
import { draftToComponentRows, draftToRecipeRow, NOT_TIMED, type ComponentDraft, type RecipeDraft } from './recipeDraft';
import type { CapturedReceipt } from '@trace/shared/costing/receiptMatch';
import { persistInventoryPatch } from '../components/inventory/inventoryEdit';
import {
  COMPONENT_PURCHASE_LINK_SELECT, ITEM_RECIPE_SELECT, MATCH_RECEIPT_SELECT, RECIPE_COMPONENT_SELECT,
} from './recipeFields';

const TRACE = true; // [TRACE:RECIPE] STD-003 — ON until David owner-proves

export const ITEM_TYPES = ['purchased', 'grown', 'manufactured'] as const;
export type ItemType = typeof ITEM_TYPES[number];

interface Outcome { ok: boolean; message: string }

const refused = (what: string, error: { message: string } | null): Outcome => ({
  ok: false,
  message: error
    ? `${what} was not saved — ${error.message}. Nothing changed.`
    : `${what} was not saved: the write returned no row, which usually means permission was refused. Nothing changed.`,
});

/** Not exported: `loadRecipe`'s callers destructure it and none names the type. Export it the day
 *  one does — an exported name nothing imports is a claim that something depends on it. */
interface LoadedRecipe {
  recipeId: string;
  draft: RecipeDraft;
}

/** The recipe for an item, or null when it has none yet. Keyed the way the row is keyed. */
export async function loadRecipe(
  businessId: string,
  item: { qbItemId: string | null; inventoryId: string },
): Promise<{ ok: true; recipe: LoadedRecipe | null } | { ok: false; message: string }> {
  const q = supabase.from('item_recipes')
    .select(ITEM_RECIPE_SELECT)
    .eq('business_id', businessId);
  const { data, error } = item.qbItemId
    ? await q.eq('qb_item_id', item.qbItemId).maybeSingle()
    : await q.eq('inventory_id', item.inventoryId).maybeSingle();
  if (error) return { ok: false, message: `Could not read this item's recipe — ${error.message}` };
  if (!data) return { ok: true, recipe: null };

  const { data: comps, error: compErr } = await supabase.from('recipe_components')
    .select(RECIPE_COMPONENT_SELECT)
    .eq('recipe_id', data.id).order('position');
  if (compErr) return { ok: false, message: `Could not read the components — ${compErr.message}` };

  // The confirmed purchases behind those components — the tenant config that survives a wipe.
  const ids = (comps ?? []).map(c => c.id);
  const { data: links } = ids.length
    ? await supabase.from('component_purchase_links')
        .select(COMPONENT_PURCHASE_LINK_SELECT)
        .in('component_id', ids).order('confirmed_at', { ascending: false })
    : { data: [] as Array<Record<string, unknown>> };
  const newest = new Map<string, Record<string, unknown>>();
  for (const l of links ?? []) if (!newest.has(String(l.component_id))) newest.set(String(l.component_id), l);

  const components: ComponentDraft[] = (comps ?? []).map(c => {
    const l = newest.get(c.id);
    return {
      name: c.name,
      quantity: String(c.quantity),
      unit: c.unit,
      componentQbItemId: c.component_qb_item_id ?? null,
      typedPrice: c.typed_pack_cost == null ? null : {
        packCost: String(c.typed_pack_cost), packSize: String(c.typed_pack_size ?? ''),
        packUnit: c.typed_pack_unit ?? '', because: c.typed_because ?? '',
      },
      // ⚠️ The landed figures are NOT stored — they are recomputed from the receipt at read time, so
      // a corrected receipt corrects every recipe that reads it (20260921's header says why).
      purchase: l ? {
        landedPackCostEqualPerItem: null, landedPackCostProRataByValue: null,
        packSize: l.pack_size == null ? null : Number(l.pack_size),
        packUnit: (l.pack_unit as string | null) ?? null,
        purchasedOn: (l.purchased_on as string | null) ?? null,
        documentKey: (l.document_key as string | null) ?? null,
      } : null,
      confirmed: l ? {
        receiptId: String(l.receipt_id ?? ''), lineIndex: Number(l.receipt_line_index ?? 0),
        documentKey: String(l.document_key ?? ''),
        spread: (l.freight_spread as 'equal_per_item' | 'pro_rata_by_value') ?? 'equal_per_item',
      } : null,
    };
  });

  return {
    ok: true,
    recipe: {
      recipeId: data.id,
      draft: {
        qbItemId: data.qb_item_id, inventoryId: data.inventory_id,
        // ⚠️ `yield_quantity` / `yield_unit` are NOT read back into the draft. They are a DERIVED
        // SNAPSHOT the database function needs (see `draftToRecipeRow`); the modal re-derives from
        // the components every time it opens. Reading them would create a second answer to a
        // question that has one.
        actualYieldCubicYards: data.actual_yield_cubic_yards == null ? '' : String(data.actual_yield_cubic_yards),
        actualYieldBecause: data.actual_yield_because ?? '',
        measuredBuildMinutes: data.build_minutes == null ? '' : String(data.build_minutes),
        measuredBuildBecause: data.build_minutes_because === NOT_TIMED ? '' : (data.build_minutes_because ?? ''),
        notes: data.notes ?? '',
        components,
      },
    },
  };
}

/**
 * Save a recipe and its components. An existing recipe keeps its id; its components are REPLACED by
 * what is on screen, which is why the confirmed purchases are re-attached by the caller afterwards.
 * ⚠️ Not one RPC, and that is said rather than hidden: a component row and its link are two writes,
 * and a part-applied save leaves a recipe whose components are right and whose prices are not. The
 * durable form is one plpgsql call taking the whole recipe as jsonb — tech-debt #69's shape, and it
 * is not minted inside a settings modal.
 */
export async function saveRecipe(
  businessId: string, draft: RecipeDraft, existingRecipeId: string | null,
  /** What the recipe currently derives, in cubic yards — the caller has already computed it. */
  derivedYieldCubicYards: number | null,
): Promise<Outcome & { recipeId?: string }> {
  const row = draftToRecipeRow(draft, businessId, derivedYieldCubicYards);
  let recipeId = existingRecipeId;

  if (recipeId) {
    const { data, error } = await supabase.from('item_recipes')
      .update(row).eq('id', recipeId).eq('business_id', businessId).select('id');
    if (error || !data || data.length === 0) return refused('This recipe', error);
  } else {
    const { data, error } = await supabase.from('item_recipes').insert(row).select('id');
    if (error || !data || data.length === 0) return refused('This recipe', error);
    recipeId = data[0].id;
  }

  // 🔴 A REFUSED DELETE IS SILENT, AND THIS IS THE ONE PLACE IT WOULD DOUBLE THE DATA (A8 / R-12).
  // A policy refusal returns NO error and removes NOTHING — and the insert below would then add a
  // second copy of every component beside the ones still there. So the rows are COUNTED first and
  // the delete is required to account for all of them. Checking `error` alone, which is what this
  // first did, could not tell "deleted seven" from "deleted none". Found by
  // `npm run verify:zero-row-writes`, which flagged the delete as UNCHECKABLE.
  const { data: before, error: readErr } = await supabase.from('recipe_components')
    .select('id').eq('recipe_id', recipeId);
  if (readErr) return refused('The components', readErr);
  const expected = (before ?? []).length;

  const { data: removed, error: delErr } = await supabase.from('recipe_components')
    .delete().eq('recipe_id', recipeId).select('id');
  if (delErr) return refused('The components', delErr);
  if ((removed ?? []).length !== expected) {
    // Stop BEFORE the insert. A half-cleared list plus a full insert is worse than no save at all,
    // and the recipe row itself is already correct — so the person is told exactly that.
    return {
      ok: false,
      message: `The components were not replaced: ${(removed ?? []).length} of ${expected} old rows could be removed, `
        + 'which usually means permission was refused. Nothing was added, so the list is unchanged — try again or ask an owner.',
    };
  }

  const rows = draftToComponentRows(draft, recipeId!);
  if (rows.length > 0) {
    const { data, error } = await supabase.from('recipe_components').insert(rows).select('id');
    if (error || !data || data.length !== rows.length) return refused('The components', error);
  }
  if (TRACE) console.log('[TRACE:RECIPE] saved', { businessId, recipeId, components: rows.length });
  return { ok: true, recipeId: recipeId!, message:
    `Saved. A batch makes about ${derivedYieldCubicYards == null ? 'an unknown amount' : `${Math.round((derivedYieldCubicYards) * 10) / 10} yards`} and this is what it consumes.` };
}

/**
 * Record that a person said YES to a proposed purchase.
 * 🔴 THE DOCUMENT KEY IS WRITTEN WITH IT (tech-debt #143): the same invoice is captured more than
 * once, so "what did we last pay" must be able to tell one purchase from one photograph of it.
 */
export async function confirmComponentPurchase(
  businessId: string,
  componentId: string,
  proposal: {
    receiptId: string; lineIndex: number; documentKey: string; vendorId?: string | null;
    matchedDescription: string; packSize: number | null; packUnit: string | null;
    lineUnitPrice: number | null; purchasedOn: string | null;
    spread?: 'equal_per_item' | 'pro_rata_by_value';
  },
): Promise<Outcome> {
  const { data, error } = await supabase.from('component_purchase_links').insert({
    business_id: businessId,
    component_id: componentId,
    receipt_id: proposal.receiptId,
    document_key: proposal.documentKey,
    receipt_line_index: proposal.lineIndex,
    matched_description: proposal.matchedDescription,
    vendor_id: proposal.vendorId ?? null,
    pack_size: proposal.packSize,
    pack_unit: proposal.packUnit,
    line_unit_price: proposal.lineUnitPrice,
    purchased_on: proposal.purchasedOn,
    freight_spread: proposal.spread ?? 'equal_per_item',
  }).select('id');
  if (error || !data || data.length === 0) return refused('That match', error);
  if (TRACE) console.log('[TRACE:RECIPE] match confirmed', { componentId, documentKey: proposal.documentKey });
  return { ok: true, message: `Recorded. ${proposal.matchedDescription} is what this component costs, from ${proposal.purchasedOn ?? 'that receipt'}.` };
}

/**
 * Flag an item as made by us — or back again. THE FLAG IS THE IDENTIFIER (R-118): it is how the
 * system knows the row needs a build list, and it is never parsed out of a SKU.
 */
export async function setItemType(businessId: string, inventoryId: string, itemType: ItemType): Promise<Outcome> {
  // 🔴 THROUGH THE ONE INVENTORY WRITER, NOT A SECOND ONE (§6 r8 / §1.6 item 8). This first issued
  // its own UPDATE on `business_inventory`, and `npm run verify:write-paths` refused it: that table
  // already has a writer, and a second one is how two paths come to disagree about what a write to
  // one table entails. `persistInventoryPatch` carries the unit projection, the deploy-gated-column
  // retry and the zero-row refusal check that this copy would have had to grow for itself.
  const { error } = await persistInventoryPatch({ id: inventoryId, businessId, patch: { item_type: itemType } });
  if (error) return { ok: false, message: `${error} Nothing changed.` };
  if (TRACE) console.log('[TRACE:RECIPE] item type', { inventoryId, itemType });
  return { ok: true, message: itemType === 'manufactured'
    ? 'Marked as made here. Add what goes into it, and a build will take those out and put the finished units in.'
    : 'No longer marked as made here. Any recipe it had is kept, not deleted.' };
}

/**
 * The word THIS BUSINESS uses for a made item. LAWNS says "homemade"; the migration seeds it and
 * every tenant gets one, so this never invents a label — a read that fails falls back to the seeded
 * word rather than to a blank, because a control with no noun on it is unreadable.
 * ⚠️ `business_operations_config` is gated `settings:read` and STAFF hold no `settings:*` string
 * (tech-debt #188), so a staff read returns NO ROW. That is indistinguishable from "nothing saved",
 * which is why the fallback is the seeded default and not an error — the label is a noun, not a fact
 * anyone can be misled by.
 */
export const DEFAULT_MADE_ITEM_LABEL = 'homemade';

export async function readMadeItemLabel(businessId: string): Promise<string> {
  const { data } = await supabase.from('business_operations_config')
    .select('config').eq('business_id', businessId).maybeSingle();
  const label = (data?.config as Record<string, unknown> | undefined)?.madeItemLabel;
  return typeof label === 'string' && label.trim() ? label.trim() : DEFAULT_MADE_ITEM_LABEL;
}

/** The receipt fields the matcher needs, and no more — it never pulls `ocr_raw` or the images. */

/**
 * The captured receipts a component's purchase could be on.
 * ⚠️ NOT PAGED, and the reason is a measurement: LAWNS holds 89 receipts (2026-09-21). A `.range()`
 * read would need a total order to be safe (`verify-stable-paging`), and a matcher that silently
 * read only the first page would propose off a subset while looking complete. If this ever grows
 * past a page, it gets an explicit order ending on `id` — it does not get a silent limit.
 */
export async function readReceiptsForMatching(
  businessId: string,
): Promise<{ ok: true; receipts: CapturedReceipt[] } | { ok: false; message: string }> {
  const { data, error } = await supabase.from('receipts')
    .select(MATCH_RECEIPT_SELECT)
    .eq('business_id', businessId)
    .order('date', { ascending: false });
  if (error) return { ok: false, message: `Could not read your receipts — ${error.message}. No purchase can be proposed.` };
  const receipts = (data ?? []).map(r => ({
    id: String(r.id), vendor: r.vendor ?? null, date: r.date ?? null, amount: r.amount ?? null,
    receiptNumber: r.receipt_number ?? null, createdAt: r.created_at ?? null,
    lineItems: Array.isArray(r.line_items) ? r.line_items : null,
  })) as CapturedReceipt[];
  if (TRACE) console.log('[TRACE:RECIPE] receipts for matching', { businessId, receipts: receipts.length });
  return { ok: true, receipts };
}

/**
 * The saved components' ids, by the position they were typed in. The modal needs these to re-attach
 * confirmed purchases after a save, because `saveRecipe` REPLACES the component rows — so the ids
 * a person confirmed against no longer exist. Position is the join, and it is stable because the
 * rows are written in the order they appear on screen.
 */
export async function componentIdsByPosition(recipeId: string): Promise<Map<number, string>> {
  const { data } = await supabase.from('recipe_components')
    .select('id, position').eq('recipe_id', recipeId).order('position');
  return new Map((data ?? []).map(r => [Number(r.position), String(r.id)]));
}

/**
 * 🔴 ④ THE ITEM PICKER'S SEARCH — WITHOUT THIS A BUILD RUN CONSUMES NOTHING.
 * David, 2026-09-22: *"link each component to its product by qb_item_id so a build run consumes
 * shelf stock."* `record_build_run` resolves what to take off the shelf via
 * `COALESCE(component_inventory_id, lookup by component_qb_item_id)`. The modal set NEITHER, so
 * every component saved from it had a NULL stock row and the run consumed nothing — it reported
 * them as unlinked, honestly, and moved no stock. Osmocote and MicroMax are retail items at LAWNS;
 * building mix has to take them off the shelf.
 * ⚠️ RETIRED ROWS ARE EXCLUDED. A retired row still RESOLVES for history (R-133) but must never be
 * OFFERED as the thing a future build consumes.
 */
export const PRODUCT_PICK_SELECT = 'id, name, sku, qb_item_name, qb_item_id, size, qty';

export interface PickableProduct {
  inventoryId: string;
  qbItemId: string | null;
  name: string;
  sku: string | null;
  size: string | null;
  qty: number;
}

export async function searchProducts(
  businessId: string, term: string,
): Promise<{ ok: true; products: PickableProduct[] } | { ok: false; message: string }> {
  const t = term.trim();
  if (t.length < 2) return { ok: true, products: [] };
  const like = `%${t.replace(/[%_]/g, m => '\\' + m)}%`;
  const { data, error } = await supabase.from('business_inventory')
    .select(PRODUCT_PICK_SELECT)
    .eq('business_id', businessId)
    .is('retired_at', null)
    .or(`name.ilike.${like},sku.ilike.${like},qb_item_name.ilike.${like}`)
    .order('name')
    .limit(20);
  if (error) return { ok: false, message: `Could not search your products — ${error.message}` };
  const products = (data ?? []).map(r => ({
    inventoryId: String(r.id), qbItemId: r.qb_item_id ?? null,
    name: String(r.name), sku: r.sku ?? null, size: r.size ?? null, qty: Number(r.qty ?? 0),
  }));
  if (TRACE) console.log('[TRACE:RECIPE] product search', { term: t, found: products.length });
  return { ok: true, products };
}
