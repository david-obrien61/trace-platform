// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      What the back control on a detail page should SAY and where it should GO —
//               derived from the journey the person actually took, not typed beside the button.
// DEPENDENCIES: none — pure. No React, no router; the caller passes `location.state`.
// OUTPUTS:      Journey · backTarget() · journeyTo().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE DEFECT, AS DAVID HIT IT: open a customer, click one of their orders, and the back
// control on the order page reads **"Orders"** — and goes to /orders. He came from a customer.
// The label named a place he had not been, and pressing it took him somewhere he had not been
// either, discarding the list he was working through.
//
// `OrderDetail.tsx:316` was `navigate('/orders')` with the word "Orders" written next to it, and
// `CustomerDetail.tsx:156` the same shape with "Customers". Both are R-170: a promise on a
// surface typed beside the control rather than derived from the thing that fulfils it. There is
// no way for a hardcoded label to be right, because the same page is reachable from several
// places — the orders list, a customer, a delivery stop, a search result.
//
// So the ORIGIN states where it is sending you from, and the destination reads it back.
//
// ⚠️ IT FALLS BACK, ALWAYS, AND THE FALLBACK IS NOT A FAILURE. A page opened from a pasted link,
// a bookmark or a hard refresh has no journey — `history.state` is empty. That is the ordinary
// case, not an error: the control then names the list the record belongs to, which is exactly
// what today's hardcoded version does. The fallback is the OLD behaviour, kept as the floor.
// ─────────────────────────────────────────────────────────────────────────────

export interface Journey {
  /** What the back control says — "Regina & David O'Brien", "Customers", "Orders". */
  label: string;
  /** Where it goes. Carries the list's query string, so the filtered view is restored. */
  href: string;
}

/** The shape an origin page puts into `navigate(to, { state })`. */
export interface JourneyState {
  from?: unknown;
}

function cleanText(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * Where "back" goes and what it is called.
 *
 * `state` is whatever the router hands over — untrusted by design. It survives a refresh in
 * `history.state`, it can be stale, and a person can navigate with anything in it, so every field
 * is validated and a malformed journey is treated as no journey at all rather than rendered.
 */
export function backTarget(state: unknown, fallback: Journey): Journey {
  const from = (state as JourneyState | null | undefined)?.from as Record<string, unknown> | undefined;
  if (!from || typeof from !== 'object') return fallback;
  const label = cleanText(from.label);
  const href = cleanText(from.href);
  // 🔴 BOTH OR NEITHER. A label without a destination is a button that lies about where it goes;
  // a destination without a label is the unnamed control this exists to remove. Half a journey is
  // worse than none, because the missing half gets filled in by the hardcoded default and the two
  // then disagree — the label says one place and the click goes to another.
  if (!label || !href) return fallback;
  // A journey must stay inside the app. An absolute URL in history state is either a mistake or
  // someone else's idea, and a back control is not an exit.
  if (!href.startsWith('/') || href.startsWith('//')) return fallback;
  return { label, href };
}

/** Build the state an origin page passes when it sends someone to a detail page. */
export function journeyTo(label: string, href: string): { from: Journey } | undefined {
  const l = cleanText(label);
  const h = cleanText(href);
  if (!l || !h) return undefined;   // nothing rather than half — see above
  return { from: { label: l, href: h } };
}

/** The sentence the control renders. Kept here so every back control words it identically. */
export function backLabel(t: Journey): string {
  return `Back to ${t.label}`;
}
