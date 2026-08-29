// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: decide whether the QuickBooks invoice push is HELD for a business. One pure
//   predicate, read from an env var, so a live customer's books can be protected without a
//   migration, a UI, or a code change per tenant.
// DEPENDENCIES: none (the raw env string is passed in — this module never reads process.env,
//   which is what makes it testable and what keeps the server and the status endpoint reading
//   the same answer).
// OUTPUTS: QBO_PUSH_HOLD_ENV, isPushHeld(), pushHoldReason().
//
// 🔴 WHY THIS EXISTS, AND IT IS A LIVE CUSTOMER PROBLEM RATHER THAN AN ARCHITECTURAL ONE.
//   The invoice push is INLINE AND UNCONDITIONAL at the end of checkout
//   (`api/orders/submit.ts` → `pushQboInvoice`). There is no "send to QuickBooks" step a
//   person can decline. Meanwhile the push carries TWELVE hardcoded
//   `ItemRef: { value: '1', name: 'Services' }` literals, so the FIRST completed checkout on
//   LAWNS would book every line — trees included — as generic "Services" in a real company's
//   real books, collapsing the Sales-of-Nursery-Stock vs Services split their cost model rests
//   on. The verbal mitigation was *"create orders freely, do not send them to QuickBooks yet"*
//   — an instruction describing a choice the product does not offer. This is that choice.
//
// 🔴 IT IS A HOLD, NOT A DISABLE. The order completes in full and is correct; only the push is
//   skipped, and the screen SAYS SO in its own words (a fourth `held` state — NOT reused
//   `not_connected`, which would tell an owner to reconnect an already-connected QuickBooks:
//   the precise defect D-48 was built to end, see `Confirmation.tsx:110`).
//
// ⚠️ IT FAILS OPEN AND THAT IS STATED RATHER THAN HIDDEN. An unset variable means NO hold,
//   because defaulting to "hold everything" would silently stop pushes for every tenant on any
//   deploy that lacks the var — a bigger change than the one being asked for. A safety switch
//   whose error path is "allow" is only honest if it is VERIFIABLE, so the hold is reported by
//   `/api/qbo/status` (`push_held`) and can be confirmed WITHOUT completing a real order.
//   Reading it there is the check; trusting that the env var propagated is not.
//   (Cf. tech-debt #75 — a device check that fails open and says nothing is not a check.)
// ─────────────────────────────────────────────────────────────────────────────

/** The env var name, in ONE place so the server and the status endpoint cannot disagree. */
export const QBO_PUSH_HOLD_ENV = 'QBO_PUSH_HOLD';

/** Matches any business id — for a platform-wide hold. */
const HOLD_ALL = 'all';

/**
 * Is the QuickBooks push held for `businessId`?
 *
 * `raw` is the verbatim env value: unset/blank → no hold · `all` → every business ·
 * otherwise a comma-separated list of business ids.
 *
 * Comparison is trimmed and case-insensitive. A UUID is case-insensitive in Postgres and gets
 * copied out of a dashboard by hand, so a case difference must never be the reason a live
 * customer's books get written to.
 */
export function isPushHeld(raw: string | undefined | null, businessId: string | undefined | null): boolean {
  const value = String(raw ?? '').trim();
  if (!value) return false;                       // unset → no hold (stated above, not an oversight)
  if (value.toLowerCase() === HOLD_ALL) return true;

  const id = String(businessId ?? '').trim().toLowerCase();
  // 🔴 A HOLD LIST WITH NO BUSINESS TO MATCH IS NOT A LICENCE TO PUSH. If the caller could not
  // say which business this is, something is wrong upstream and the safe reading of an ACTIVE
  // hold list is "hold". The list being set is the operator saying "I am protecting something".
  if (!id) return true;

  return value
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(id);
}

/**
 * The owner-facing sentence for a held push. Named here so the Confirmation screen, the
 * re-push endpoint and the status readout cannot describe one state three ways (STD-011).
 * It says what happened, why, and — the part a refusal usually omits — WHO can lift it.
 */
export function pushHoldReason(): string {
  return 'Sending invoices to QuickBooks is paused for this business. The order is saved and correct — nothing was sent to QuickBooks, and nothing is wrong with it. David can lift the pause once invoice lines map to the right QuickBooks items.';
}
