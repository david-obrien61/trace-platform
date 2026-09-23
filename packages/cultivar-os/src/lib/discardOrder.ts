// ============================================================
// discardOrder — what leaving a half-built order means, and what discarding one SAYS.
//
// PURPOSE:  Separate the two acts a single control used to perform. Until 2026-09-23 the header
//           of `/checkout/scan` rendered an `<ArrowLeft>` wired to `exit()`, which was
//           `clear(); navigate('/orders')` — **a back arrow that discarded the whole order, with
//           no confirmation, no undo and nothing persisted to go back to.**
//
// 🔴 THE CLASS, IN DAVID'S WORDS (2026-09-23): *"A control that looks like 'back' and performs
//           'discard everything' is the dead-affordance class and Lauren will lose a customer's
//           order in front of them."* It is the §6 r18 family one step out of copy and into
//           behaviour: the control's APPEARANCE is a claim, and this one's was false.
//
// 🔴 THE ROOT, RECORDED BECAUSE IT EXPLAINS MORE THAN THIS ONE BUTTON: checkout was built
//           SCAN-FIRST FOR THE YARD, and Lauren works COUNTER-FIRST AT A DESK. In the lot,
//           abandoning a scan is the common act and a fast discard is right. At a counter, the
//           order IS the work and losing it in front of a customer is the worst thing the screen
//           can do. Same button, opposite defaults.
//
// WHAT THIS MODULE IS: the pure half — how many lines and plants are at stake, whether a confirm
//           is owed at all, and the words. The page owns navigation and state; nothing here
//           touches the cart, the router or the DOM, so the copy can be asserted without one.
//
// ⚠️ WHAT IT DELIBERATELY DOES NOT DO: persist anything. Leaving the screen keeps the cart in
//           memory (zustand module scope), so BACK-then-RETURN restores the lines within the same
//           page session — but a refresh, a new tab or an evicted tab still loses it. **Parked
//           orders (ledger #389) is the fix for that** and is a separate build; this one stops the
//           button destroying work on purpose.
//
// DEPENDENCIES: ../types/order (CartItem). Pure.
// OUTPUTS:  discardStake · needsDiscardConfirm · discardConfirmCopy. (`DiscardStake` is the
//           return shape and is deliberately not exported — nothing imports it.)
// ============================================================
import type { CartItem } from '../types/order';

/** What would be lost. Both numbers, because one line can carry twenty plants.
 *  ⚠️ NOT EXPORTED: nothing imports it by name, and knip is right to say so. The shape still
 *  reaches every caller through `discardStake`'s inferred return type, so exporting it would be
 *  a second way to say one thing — and a dead one. Export it the day something imports it. */
interface DiscardStake {
  lines: number;
  plants: number;
}

export function discardStake(items: readonly CartItem[]): DiscardStake {
  return {
    lines: items.length,
    plants: items.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0),
  };
}

/**
 * Is a confirmation owed?
 *
 * 🔴 ONLY WHEN THERE IS SOMETHING TO LOSE. A confirm on an empty order is the dialog everybody
 * learns to dismiss without reading, and the one that teaches a person to dismiss the one that
 * mattered. An empty cancel is just leaving.
 */
export function needsDiscardConfirm(items: readonly CartItem[]): boolean {
  return discardStake(items).lines > 0;
}

/**
 * The words. It NAMES THE COUNT — David's ruling — because "Are you sure?" asks a person to
 * remember what they are holding, and the screen already knows.
 *
 * ⚠️ THE ACTION BUTTON CARRIES THE COUNT TOO, not just the title. On a phone the title can be
 * scrolled off; the button is what the thumb is over.
 */
export function discardConfirmCopy(items: readonly CartItem[]): {
  title: string; body: string; confirmLabel: string; keepLabel: string;
} {
  const { lines, plants } = discardStake(items);
  const lineWord  = lines === 1 ? 'item' : 'items';
  const plantWord = plants === 1 ? 'plant' : 'plants';
  // Plants are named separately ONLY when they differ from the line count — "1 item (1 plant)"
  // is noise, and noise in a confirmation is what makes it unreadable.
  const detail = plants !== lines ? ` (${plants} ${plantWord})` : '';
  return {
    title: `Discard this order?`,
    body: `${lines} ${lineWord}${detail} will be removed and cannot be brought back. `
        + `If you just want to leave this screen, use the back arrow — the order stays as it is.`,
    confirmLabel: `Discard ${lines} ${lineWord}`,
    keepLabel: 'Keep the order',
  };
}
