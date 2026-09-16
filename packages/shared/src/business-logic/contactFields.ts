// ============================================================
// contactFields — THE DECLARATIVE COLUMN LISTS FOR THE CONTACT LISTS (A4, ledger #335)
//
// PURPOSE:      `customer_phones` and `customer_emails` get their column lists from HERE, and the
//               contact import's already-held read of `customer_addresses` gets its narrow list
//               from here too. Same shape, and the same reason, as `customerAddressFields.ts`:
//               `verify-field-lists` treats a column string declared in the file that uses it as a
//               hand-written enumeration and an IMPORTED one as a derivation — and it went RED when
//               these sat beside the reads `contactWriter.ts` gained for tech-debt #306.
//
// DEPENDENCIES: none.
// OUTPUTS:      CONTACT_PHONE_COLUMNS · CONTACT_EMAIL_COLUMNS · CONTACT_ADDRESS_READ_COLUMNS
// ============================================================

/** Every column `20260915_contact_record.sql` creates on `customer_phones`, bar the timestamps.
 *  🔴 `contactWriter.test.ts` §E parses the migration and fails in BOTH directions (#179). */
export const CONTACT_PHONE_COLUMNS = 'id,business_id,customer_id,label,value,value_norm,is_primary,source,active';

/** The same, for `customer_emails`. Asserted the same way. */
export const CONTACT_EMAIL_COLUMNS = 'id,business_id,customer_id,label,value,value_norm,is_primary,source,active';

/** What the import's already-held check reads from `customer_addresses`. NARROW on purpose — not
 *  `CUSTOMER_ADDRESS_COLUMNS`, which predates `source` and `kind` (both added by `20260915`), and
 *  `source` is what tells a migration seed from a row a person typed. Asserted by §E4. */
export const CONTACT_ADDRESS_READ_COLUMNS = 'id,label,kind,line1,city,zip,is_default,source';
