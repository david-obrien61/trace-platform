// ============================================================
// recipeFields — THE ONE FIELD DECLARATION FOR THE RECIPE TABLES (ledger #370, A4)
//
// PURPOSE:      Each recipe table's columns, named ONCE. Every select derives from these lists;
//               nothing hand-writes a second column string. `npm run verify:field-lists` refused
//               the first version of `recipeWrite.ts` for exactly that — four hand-written
//               enumerations, one per table — and the rule it cites is worth more than the
//               declaration it also offers: *"a field added to the form but missed in a
//               hand-written column list reads back null forever, and nothing in the codebase can
//               notice."*
//
// 🔴 THE LIST IS THE SOURCE AND THE SELECT IS DERIVED — tech-debt #179's fix, applied on arrival
//   rather than after the defect. `VENDORS_SELECT` named 10 columns while its migration created 14,
//   and the four it missed were the ADDRESS; nothing we own could have caught it, because a column
//   with no reader and no writer is invisible to tsc, eslint, knip and every probe. So the probe
//   for this file PARSES `20260921_recipes_made_items.sql` and fails BOTH directions: a column in
//   the migration and not here, and a column here that the migration never creates.
//
// ⚠️ THESE ARE READ LISTS, NOT WRITE LISTS. `created_at` / `updated_at` / `confirmed_at` are the
//   server's, and `id` is read but never sent. What a write may SET is a different question and is
//   answered by `recipeDraft.ts`, which builds the row from what a person typed.
//
// DEPENDENCIES: none. Pure strings — importable from a probe without dragging in a database client.
// OUTPUTS:      ITEM_RECIPE_FIELDS · RECIPE_COMPONENT_FIELDS · COMPONENT_PURCHASE_LINK_FIELDS,
//               and the four selects derived from them. `MATCH_RECEIPT_FIELDS` is NOT exported —
//               `receipts` owns its declaration elsewhere and this is a narrowed read of it.
// ============================================================

/** Every column `item_recipes` carries. Read lists below are subsets, named by what they omit. */
export const ITEM_RECIPE_FIELDS = [
  'id', 'business_id', 'qb_item_id', 'inventory_id',
  'yield_quantity', 'yield_unit', 'build_minutes', 'build_minutes_because', 'notes',
  'created_at', 'updated_at',
] as const;

export const RECIPE_COMPONENT_FIELDS = [
  'id', 'recipe_id', 'position', 'name', 'quantity', 'unit',
  'component_qb_item_id', 'component_inventory_id', 'note',
  'created_at', 'updated_at',
] as const;

export const COMPONENT_PURCHASE_LINK_FIELDS = [
  'id', 'business_id', 'component_id', 'receipt_id', 'document_key', 'receipt_line_index',
  'matched_description', 'vendor_id', 'pack_size', 'pack_unit', 'line_unit_price',
  'purchased_on', 'freight_spread', 'confirmed_by', 'confirmed_at', 'created_at',
] as const;

/**
 * The `receipts` columns the matcher decides on. NOT every column, and NOT exported — `receipts`
 * already has its own field declaration elsewhere (`RECEIPT_DETAIL_SELECT`), so this is a NARROWED
 * read, not a second registry for that table. Its probe asserts the derived select instead.
 */
const MATCH_RECEIPT_FIELDS = [
  'id', 'vendor', 'date', 'amount', 'receipt_number', 'created_at', 'line_items',
] as const;

const sel = (fields: readonly string[], omit: readonly string[] = []): string =>
  fields.filter(f => !omit.includes(f)).join(', ');

/**
 * The recipe row as the modal reads it. `business_id` is omitted because the query already filters
 * on it — reading a value back to confirm the filter you just applied is noise, not evidence.
 */
export const ITEM_RECIPE_SELECT = sel(ITEM_RECIPE_FIELDS, ['business_id', 'created_at', 'updated_at']);

/** The components, in the order they were typed. */
export const RECIPE_COMPONENT_SELECT = sel(RECIPE_COMPONENT_FIELDS, ['note', 'created_at', 'updated_at']);

/**
 * The confirmed purchase behind a component.
 * ⚠️ The LANDED figures are deliberately absent from this table and so from this list: they are
 * recomputed from the receipt at read time, so a corrected receipt corrects every recipe reading it.
 */
export const COMPONENT_PURCHASE_LINK_SELECT = sel(COMPONENT_PURCHASE_LINK_FIELDS,
  ['id', 'business_id', 'matched_description', 'vendor_id', 'confirmed_by', 'confirmed_at', 'created_at']);

/**
 * The receipts the matcher reads.
 * 🔴 DELIBERATELY NARROW, and this one is a decision rather than an omission: `ocr_raw` and
 * `image_url` are NOT here. A matcher reads lines, not photographs, and pulling the OCR blob for
 * every receipt to rank one component against them is a cost with no reader.
 */
export const MATCH_RECEIPT_SELECT = sel(MATCH_RECEIPT_FIELDS);
