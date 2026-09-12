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
 * Every column `20260911b_customer_addresses.sql` creates, in order.
 *
 * 🔴 `customerAddresses.test.ts` §G PARSES THE MIGRATION and fails in BOTH directions — a column
 * the migration creates that this string omits, and a name here the migration does not create.
 * The migration is the source; this is the derivation.
 */
export const CUSTOMER_ADDRESS_COLUMNS =
  'id, business_id, customer_id, label, line1, line2, city, state, zip, notes, is_default, active, created_at, updated_at';
