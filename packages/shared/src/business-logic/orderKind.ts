// ============================================================
// orderKind — the ONE answer to "which orders count?"
// ============================================================
// PURPOSE:      `orders.order_kind` says where an order came from, and DIFFERENT READERS OWE
//               DIFFERENT ANSWERS TO IT. A test order is not revenue. A history order is real
//               revenue but was never assessed for add-on leakage. Neither of those facts is
//               obvious at a call site, and eleven call sites remembering them independently is
//               how they stop agreeing. This module holds the vocabulary and the predicates over
//               it, in one place, for every reader.
// DEPENDENCIES: ./historyOrder (HISTORY_ORDER_KIND — imported, never re-spelled).
// OUTPUTS:      TEST_ORDER_KIND · isRealBusiness · isAssessable · mayPushToQuickBooks ·
//               REAL_BUSINESS_PGRST · ASSESSABLE_PGRST · describeOrderKind.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY IT EXISTS — A LIVE DEFECT, MEASURED, NOT ANTICIPATED.
// ══════════════════════════════════════════════════════════════════════════════════════════
//   `api/dashboard.ts` selected EVERY order for the business with NO kind filter at all and
//   counted `leakage_flag` over the lot. `Dashboard.tsx` filtered `order_kind !== 'history'`
//   in JavaScript, with a comment explaining exactly why that matters. So one number was
//   computed two ways, and the two ways disagreed the moment the first captured invoice
//   landed. ⚠️ The server copy has NO CALLER today (nothing fetches `/api/dashboard`), which
//   makes the divergence LATENT rather than live — and latent is precisely the state in which
//   a defect survives to meet its first consumer.
//
// 🔴 AND THE COMMENT ON THE CLIENT SIDE HAD ALREADY DRIFTED FROM ITS OWN CODE. It said the
//   read excludes history via `order_kind=is.null`. The query does no such thing — it filters
//   `status != 'cancelled'` and the exclusion happens later in JS as `!== 'history'`. Those
//   are not the same rule: `is.null` would have excluded a test order too, and `!== 'history'`
//   admits one. A prose description of a filter is not the filter (R-26).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 TWO REPRESENTATIONS, ONE SOURCE — AND THAT IS THE LOAD-BEARING PART OF THIS FILE.
// ══════════════════════════════════════════════════════════════════════════════════════════
//   Some readers hold rows in hand and want a predicate; others must exclude AT THE QUERY,
//   because a `.limit(50)` applied before a JS filter silently returns fewer than 50 of the
//   thing that was asked for (`api/social/generate-posts.ts` is exactly that shape). So both
//   forms exist — and BOTH ARE DERIVED FROM THE SAME ARRAY below, never typed out twice.
//   `orderKind.test.ts` §D asserts they agree on every kind, so a value added to one and
//   forgotten in the other fails the build rather than diverging quietly (STD-011).
//
// 🔴 THE POSTGREST NULL TRAP, WHICH IS THE REASON THE FILTER IS NOT WRITTEN AT CALL SITES.
//   `.neq('order_kind', 'test')` DROPS EVERY ROW WHERE `order_kind` IS NULL — SQL `NULL <>
//   'test'` is NULL, not true, and PostgREST passes that straight through. NULL is the value
//   carried by every ordinary checkout order (20260827_history_orders.sql deliberately added
//   the column with no DEFAULT), so the obvious spelling of "not a test order" excludes the
//   entire real business and keeps nothing but the captured invoices. The `.or(...)` form here
//   is correct and it does not look correct, which is the best possible argument for it having
//   exactly one home.
// ============================================================
import { HISTORY_ORDER_KIND } from './historyOrder';

/**
 * An order rung up to SEE WHAT COMES OUT — while the owner is still deciding whether to buy.
 *
 * 🔴 NO MIGRATION MINTS THIS VALUE AND NONE IS NEEDED. `20260827_history_orders.sql` added
 * `order_kind` as nullable `text` with NO CHECK and NO DEFAULT, and said why in its own words:
 * *"The vocabulary is young… a CHECK minted today is a constraint we would be editing next
 * month, and §6 r1 makes migrations append-only. The writers own the vocabulary; this column
 * stores it."* This module is that writer. `idx_orders_kind` already indexes the column.
 */
export const TEST_ORDER_KIND = 'test';

// ── the two exclusion sets, and every export below is derived from them ──────────────────
//
// 🔴 THE DEFAULT FOR AN UNKNOWN KIND IS *INCLUDE*, AND THAT IS DELIBERATE IN BOTH DIRECTIONS.
// These are DENY-lists, not allow-lists, which is the opposite of the choice `fetchCommittedByLot`
// made for statuses — and the reason is that the failure modes are mirror images. A status
// missing from an allow-list silently stops holding stock (it oversells, invisibly). A kind
// missing from a deny-list merely counts toward revenue it may not belong in — visible, and
// wrong in the direction a human notices. Excluding an unrecognised kind by default would
// instead make a whole new order type vanish from every report on the day it ships, which is
// the failure nobody would find.

/** Kinds that are NOT business the company actually transacted. */
const NOT_REAL_BUSINESS: readonly string[] = [TEST_ORDER_KIND];

/**
 * Kinds whose `leakage_flag` was never evaluated, so it may not be read as a verdict.
 *
 * History is here for a reason worth keeping in front of the reader: leakage is computed at
 * checkout from resolved catalog lines and container sizes, and a line transcribed off a
 * document has neither. `leakage_flag` is NOT NULL, so an unassessed order reads `false` —
 * and false meaning UNEVALUATED is indistinguishable from false meaning "nothing leaked"
 * unless it is excluded here. Counting them would let unassessed sales prove a clean bill of
 * health, which is the exact shape of D-9's forbidden fabricated value.
 */
const NOT_ASSESSABLE: readonly string[] = [HISTORY_ORDER_KIND, TEST_ORDER_KIND];

/**
 * Is this order business the company ACTUALLY DID — money it took, stock it moved?
 *
 * Revenue, order counts, campaign attribution, delivery routes: everything that reports what
 * the business did asks this. A history order IS real business (a paid sale, correctly dated by
 * `sale_date`); a test order is not and never becomes one.
 */
export function isRealBusiness(orderKind: string | null | undefined): boolean {
  return !NOT_REAL_BUSINESS.includes(String(orderKind ?? ''));
}

/**
 * Was this order created through a path that EVALUATED add-on leakage?
 *
 * Only ask this of a reader that reads `leakage_flag`. It is strictly narrower than
 * `isRealBusiness` — every non-assessable kind is excluded from assessment, and one of them
 * (history) is still real money.
 */
export function isAssessable(orderKind: string | null | undefined): boolean {
  return !NOT_ASSESSABLE.includes(String(orderKind ?? ''));
}

/**
 * May this order be written to the customer's QuickBooks?
 *
 * 🔴 THIS IS AN ALLOW-QUESTION WEARING A DENY-LIST'S CLOTHES, AND THE ASYMMETRY IS THE POINT.
 * `isRealBusiness` guards a NUMBER ON A SCREEN; this guards A WRITE INTO A REAL COMPANY'S
 * ACCOUNTING. A history order is refused because it is already invoiced in those same books
 * (a push would duplicate a settled sale); a test order is refused because it describes
 * nothing that happened. Both refusals are enforced at `pushQboInvoice`, upstream of the
 * invoice POST *and* upstream of `findOrCreateQBCustomer` — see the guard there, and
 * `historyOrder.test.ts` §I, which asserts the ordering rather than assuming it.
 */
export function mayPushToQuickBooks(orderKind: string | null | undefined): boolean {
  const kind = String(orderKind ?? '');
  return kind !== HISTORY_ORDER_KIND && kind !== TEST_ORDER_KIND;
}

/**
 * Build the PostgREST `.or()` argument that excludes `kinds` AT THE QUERY.
 *
 * The `order_kind.is.null` disjunct is not optional and not defensive — see the NULL trap in
 * the file header. Every ordinary checkout order carries NULL here.
 */
function pgrstExcluding(kinds: readonly string[]): string {
  return ['order_kind.is.null', `order_kind.not.in.(${kinds.join(',')})`].join(',');
}

/** Pass to `.or()`: keeps only orders that are real business. Derived — never typed out. */
export const REAL_BUSINESS_PGRST = pgrstExcluding(NOT_REAL_BUSINESS);

/** Pass to `.or()`: keeps only orders whose `leakage_flag` means something. Derived. */
export const ASSESSABLE_PGRST = pgrstExcluding(NOT_ASSESSABLE);

/**
 * The owner-facing name for a kind — so a roster, a banner and a printed sheet cannot spell
 * one fact three ways (STD-011).
 *
 * An unrecognised kind renders UNDER ITS OWN RAW NAME rather than being relabelled as
 * something recognised, matching `orderStatusMeta`'s handling of an unknown status: a value we
 * cannot explain is a fact about the data, and hiding it is the D-9 failure.
 */
export function describeOrderKind(orderKind: string | null | undefined): string {
  const kind = String(orderKind ?? '');
  if (kind === '') return 'Checkout order';
  if (kind === HISTORY_ORDER_KIND) return 'Captured invoice';
  if (kind === TEST_ORDER_KIND) return 'Test order';
  return kind;
}

/** Re-exported so a reader asking about kinds has ONE import, not two. */
export { HISTORY_ORDER_KIND };
