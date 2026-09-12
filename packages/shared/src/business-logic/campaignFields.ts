// ============================================================
// campaignFields — THE DECLARATIVE COLUMN LISTS FOR A CAMPAIGN (A4)
//
// PURPOSE:      The two reads this build adds get their column lists from HERE and nowhere else.
//               #179 is the reason the rule exists: `VENDORS_SELECT` named TEN columns while its
//               migration created FOURTEEN, and the four missing were the address — a column with no
//               reader and no writer is invisible to tsc, eslint, knip and every probe.
//
//               It lives in its own module on purpose. `verify-field-lists` treats a column string
//               declared in the file that uses it as a HAND-WRITTEN enumeration and an IMPORTED one
//               as a derivation — the same lesson `customerAddressFields.ts` records from #303,
//               where the cap went red on a constant sitting beside its call sites and was right.
//
// DEPENDENCIES: none.
// OUTPUTS:      CAMPAIGN_TERMS_COLUMNS · CAMPAIGN_EDIT_ECHO_COLUMNS
// ============================================================

/**
 * The campaign's own TERMS — what the generator needs to write posts for an EXISTING campaign.
 *
 * 🔴 THIS LIST IS WHY R-147 IS SAFE. On append, the endpoint regenerates from the campaign's stored
 * terms rather than from the request body, so a client asking for "more posts" cannot quietly change
 * the dates or the focus it generates against. `campaignLifecycle.test.ts` §F asserts the endpoint
 * reads the row; this names exactly what it reads.
 *
 * Deliberately NOT `*`: a select-star read would silently start carrying any column a future
 * migration adds into an AI prompt, which is how a private note ends up in a caption.
 */
export const CAMPAIGN_TERMS_COLUMNS =
  'id, name, campaign_type, start_date, end_date, target_category, description';

/**
 * What an edit reads back to PROVE it wrote (R-12 — a PostgREST update matching zero rows returns
 * success with no error, so the returned representation is the only evidence).
 *
 * It is the three editable fields plus `id`, and it is exactly `CAMPAIGN_EDITABLE_FIELDS` + id by
 * intent: echoing back a column an edit cannot change would invite a reader to think it could.
 */
export const CAMPAIGN_EDIT_ECHO_COLUMNS = 'id, start_date, end_date, target_category';
