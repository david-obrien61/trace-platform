// ============================================================
// customerAddressFields — THE ONE DECLARATIVE FIELD LIST FOR A SAVED SITE (A4)
//
// PURPOSE:      `customer_addresses` gets its column list from HERE and nowhere else, so no reader
//               can drift from what the migration creates (#179: `VENDORS_SELECT` named ten columns
//               while its migration made fourteen, and the four missing were the ADDRESS — a column
//               with no reader and no writer is invisible to tsc, eslint, knip and every probe).
//
//               It lives in its own module rather than beside its readers on purpose:
//               `verify-field-lists` treats a column string declared in the file that uses it as a
//               hand-written enumeration, and an IMPORTED one as a derivation. That distinction is
//               the cap teaching the right shape — and it went RED on the first draft of this build,
//               which had the constant sitting beside its two call sites.
//
// DEPENDENCIES: none.
// OUTPUTS:      CUSTOMER_ADDRESS_COLUMNS
// ============================================================

/**
 * Every column this table is built from — `20260911b` CREATES the first fourteen and `20260923c`
 * ADDS the four coordinate columns. A table is built by every migration that touches it.
 *
 * 🔴 `customerAddresses.test.ts` §G PARSES THE MIGRATION and fails in BOTH directions — a column
 * the migration creates that this string omits, and a name here the migration does not create.
 * The migration is the source; this is the derivation.
 */
export const CUSTOMER_ADDRESS_COLUMNS =
  'id, business_id, customer_id, label, line1, line2, city, state, zip, notes, is_default, active, created_at, updated_at, kind, source, import_run_id, latitude, longitude, geocoded_at, geocode_status';

/**
 * The five fields the geocode run needs to BUILD AN ADDRESS LINE and write the answer back.
 *
 * 🔴 A PROJECTION, DELIBERATELY NOT THE RECORD SHAPE. The bulk run reads every unlocated address
 * — ~1,500 of them — and `CUSTOMER_ADDRESS_COLUMNS` would pull 21 columns across the wire for
 * each one to use five. It lives HERE, beside the full list, so it is still ONE place that knows
 * what a customer address is made of (#179: the list is the source, the select is derived).
 */
export const CUSTOMER_ADDRESS_GEOCODE_COLUMNS = 'id, line1, city, state, zip';


/**
 * Compare two address parts the way a person would: case and punctuation are not a difference.
 *
 * 🔴 IT LIVES HERE, NOT IN `customerAddresses`, BECAUSE `contactWriter` NEEDS IT TOO and
 * `customerAddresses` already imports FROM `contactWriter` — putting it there and importing it
 * back would be a cycle. This module holds the field list and imports nothing, so both can reach
 * it. `customerAddresses` re-exports it, so every existing caller is unchanged and there is still
 * exactly ONE implementation (§6 r8).
 */
export function normalizeAddressPart(v: string | null): string {
  if (!v) return '';
  return v.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}
