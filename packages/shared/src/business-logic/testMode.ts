// ============================================================
// testMode — is this business still trying the platform out, or is it live?
// ============================================================
// PURPOSE:      One answer to "does what this business does right now reach their real
//               accounting?", and the owner-facing sentences that go with it. A business
//               evaluating the platform rings up fake orders for a week to see what comes
//               out; those orders must be born marked, excluded from every count, and refused
//               at the QuickBooks seam. Live is the same platform with the switch flipped.
// DEPENDENCIES: ./orderKind (TEST_ORDER_KIND — imported, never re-spelled). Pure: no db, no
//               env, no network. Every input is passed in, which is what makes the server and
//               the banner incapable of reaching different conclusions.
// OUTPUTS:      isTestMode · orderKindForMode · pushPermitted · TEST_MODE_BANNER ·
//               testModeExplanation · writeSwitchConfirmation · LIVE_MODE_CONFIRMED.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE FAILURE THIS MODULE IS SHAPED AROUND IS NOT THE ONE PEOPLE EXPECT.
// ══════════════════════════════════════════════════════════════════════════════════════════
//   The obvious fear is test data reaching a customer's books. It is real and it is guarded at
//   `pushQboInvoice`, above BOTH the invoice POST and `findOrCreateQBCustomer`.
//
//   The expensive failure is THE REVERSE. Somebody works in test mode for a week believing
//   they are live. None of their real sales ever reaches QuickBooks. Two weeks later their
//   bookkeeper finds a hole, and nobody can say which invoices are missing because nothing
//   ever recorded that the sales were tests. Every design choice below follows from that:
//
//     · the banner is NOT DISMISSABLE — a mode you can hide is a mode you can be wrong about
//     · it says WHAT IS AND IS NOT HAPPENING, not merely "test mode"
//     · turning writes ON states what changes BEFORE it happens, in a full sentence
//     · a test order is marked IN THE DATA (`order_kind`), not merely in a UI state, so the
//       exclusion survives a page reload, a different screen, and this module being deleted
//
// 🔴 THE BANNER IS THE FEATURE; THE TOGGLE IS THE DETAIL. If only one of the two ships, ship
//   the banner. A switch nobody can see the position of is worse than no switch.
// ============================================================
import { TEST_ORDER_KIND } from './orderKind';

/**
 * Is this business in test mode?
 *
 * Deliberately derived from the STORED per-business flag and nothing else — not from a URL
 * parameter, not from an env var, not from a React state. A mode that can be entered by a
 * query string is a mode a customer can be put into by a link.
 *
 * ⚠️ A MISSING VALUE MEANS TEST MODE, AND THAT IS THE SAFE DIRECTION rather than an oversight.
 * `qbo_writes_enabled` is NOT NULL DEFAULT false in the schema, so `undefined` here means the
 * row was not read — a deploy mid-migration, a `select()` that omitted the column, a failed
 * fetch. Reading an unknown as "live" would push a real invoice on the strength of a value
 * nobody actually saw. Fail toward not-writing-to-someone's-accounts.
 */
export function isTestMode(qboWritesEnabled: boolean | null | undefined): boolean {
  return qboWritesEnabled !== true;
}

/**
 * What `order_kind` should an order born right now carry?
 *
 * Returns `null` for live, which is the value an ordinary checkout order has always had
 * (20260827 added the column with no DEFAULT and stated that NULL means exactly this). So
 * going live changes nothing about the rows a live business writes — it stops adding a mark,
 * rather than starting to add a different one.
 */
export function orderKindForMode(qboWritesEnabled: boolean | null | undefined): string | null {
  return isTestMode(qboWritesEnabled) ? TEST_ORDER_KIND : null;
}

/**
 * May an invoice for this business be pushed to QuickBooks at all?
 *
 * 🔴 TWO SWITCHES, AND-ED, BECAUSE THEY BELONG TO DIFFERENT PEOPLE. `platformHeld` is David's
 * `QBO_PUSH_HOLD` env var — an operator's hold over a tenant whose line mapping he has not yet
 * watched land. `writesEnabled` is the OWNER's own decision about their own books. Either one
 * saying no means no. Neither can override the other, and that is the point: a customer cannot
 * switch their way past an operator hold, and an operator's forgotten env var cannot make a
 * customer live before they said so.
 *
 * ⚠️ THIS IS THE BUSINESS-LEVEL QUESTION, NOT THE ORDER-LEVEL ONE. An individual order can
 * still be unpushable when this returns true — a captured invoice, a test order left over from
 * before go-live. That question is `mayPushToQuickBooks(order_kind)` in ./orderKind, asked at
 * the seam. Two questions, two predicates; do not collapse them, because one is about a
 * BUSINESS's state today and the other about a ROW's origin forever.
 */
export function pushPermitted(x: { writesEnabled: boolean | null | undefined; platformHeld: boolean }): boolean {
  return !x.platformHeld && !isTestMode(x.writesEnabled);
}

/**
 * The banner sentence, on every screen that touches money, for as long as the mode lasts.
 *
 * 🔴 DAVID'S WORDING, VERBATIM (2026-09-02, [[R-63]]) — DO NOT PARAPHRASE IT. It answers the
 * question this build raised and deliberately did not decide: *does a test order deplete stock?*
 * The answer is NO, and his own clause was that **if the answer is no, the screen must say so**.
 * This is the screen saying so.
 *
 * It names THREE halves now, not two. The header of this file already argued the banner must say
 * what IS and IS NOT happening; the ruling agrees with that argument and extends the list from
 * (QuickBooks / orders saved) to (QuickBooks / orders saved / **stock**).
 *
 * ⚠️ IT MUST NOT BE SHORTENED TO "stock is unaffected." That reads as a FEATURE — as though not
 * moving stock were a protection being offered. It is not: a capability she cares about is
 * deliberately not being exercised yet, and the second sentence (`TEST_MODE_STOCK_CAVEAT`) is the
 * one that says so. See its own note — it is the load-bearing half.
 */
export const TEST_MODE_BANNER =
  'TEST MODE — nothing you do here reaches QuickBooks, and your tree counts do not change.';

/**
 * 🔴 THE SENTENCE THAT SAYS WHAT IS *NOT* BEING PROVEN — and it is the one that matters.
 *
 * David's wording, verbatim, and his reasoning with it: a screen that only says what it PROTECTS
 * lets somebody conclude they have tested something they have not. The first sentence states the
 * protection. This one states the gap.
 *
 * The failure it prevents is specific and it is the more expensive of the two: an owner rings up
 * a week of practice orders, watches the system behave, and concludes it tracks her trees —
 * because nothing on any screen told her that the one capability she cares about most was the one
 * deliberately switched off. She finds out after go-live, on real stock.
 *
 * ⚠️ IT BELONGS WHERE AN ORDER IS RUNG UP, NOT IN THE GLOBAL BANNER. Two reasons, and the second
 * is why it is a separate export rather than a longer banner: it is only TRUE of the ring-up act
 * (nothing about reading a dashboard is a test of stock tracking), and a global banner carrying
 * both sentences would put a paragraph on every page — which is how a standing notice becomes
 * wallpaper, costing the FIRST sentence the attention it needs.
 */
export const TEST_MODE_STOCK_CAVEAT =
  'Because stock does not move in test mode, this is not a test of whether the system tracks your trees. That happens after you switch writes on.';

/**
 * The longer form, for the settings screen where there is room to explain.
 *
 * ⚠️ CORRECTED 2026-09-02 WITH THE BANNER, BECAUSE IT CONTRADICTED IT. The first line read
 * *"you can use every part of the system exactly as you would in the real thing"* — which is
 * now false in the one way that matters: stock does not move, so the part of the system she
 * most wants to try is precisely the part not being exercised. A banner and an explanation
 * disagreeing about the same mode is the STD-011 defect where it does the most damage: the
 * longer text is the one a careful reader trusts, and it was the wrong one.
 */
export function testModeExplanation(): string {
  return [
    'While test mode is on you can ring up orders, price them, tax them, print them and look at what comes out — none of it reaches QuickBooks, and none of it lands in your sales totals, your add-on alerts or your campaign figures.',
    TEST_MODE_STOCK_CAVEAT,
    'Test orders stay marked as tests forever, so they will never quietly join your numbers later.',
  ].join(' ');
}

/**
 * 🔴 WHAT CHANGES, SAID BEFORE IT HAPPENS. Shown in the confirmation an owner must accept to
 * turn writes on.
 *
 * It is written in the second person and in the FUTURE tense on purpose: the owner is being
 * asked to consent to a consequence, not to confirm an intention they already stated. "Are you
 * sure?" is not consent to anything — it asks a person to re-affirm a decision without telling
 * them what it does.
 *
 * ⚠️ IT ALSO SAYS WHAT DOES **NOT** HAPPEN, which is the half a confirmation usually omits and
 * the half this owner will worry about: their week of test orders does not suddenly become
 * real. It cannot — the mark is in the row.
 */
export function writeSwitchConfirmation(businessName?: string | null): string {
  const who = businessName && businessName.trim() ? businessName.trim() : 'this business';
  return [
    `From now on, every order you ring up for ${who} will be written to QuickBooks as a real invoice.`,
    'Sending an invoice cannot be undone from here — an invoice you delete in QuickBooks still uses up its number and stays in the record your accountant sees.',
    'The test orders you have already made are NOT affected: they stay marked as tests, they are never sent, and they never join your sales figures.',
  ].join(' ');
}

/**
 * The banner that replaces it once writes are on. A mode change is worth stating ONCE on the
 * surface that made it; it is deliberately NOT a standing banner, because a permanent notice
 * that everything is normal is a notice people stop reading — and the whole value of the test
 * banner is that a standing notice on this platform means something.
 */
export const LIVE_MODE_CONFIRMED =
  'QuickBooks writing is on. New orders will be sent to QuickBooks as invoices.';
