// ============================================================
// orderStatus — the order lifecycle (ONE source: roster badge, roster FILTER, detail
//   transitions, server validate).
// PURPOSE: orders.status is a live-only text column with NO CHECK (the pre-D-37 payment
//   CHECK was dropped by 20260715 — see that migration for why a DB CHECK on a business
//   vocabulary is the anti-pattern). This file is the SINGLE canonical statement of the
//   vocabulary; the server (submit.ts action='status') validates against ORDER_STATUSES so
//   a bad value cannot land, and the roster filter DERIVES its chips from it so a status
//   can never exist without a way to reach the rows carrying it.
//
// ✅ RATIFIED 2026-08-28 (David) — R-STATUS IS CLOSED. The set is these four and matches
//   QuickBooks' own vocabulary. `confirmed` is RETIRED; `invoiced` takes its place as the
//   committed state. Out of `pending` an order goes to `invoiced` and onto the schedule —
//   scheduling lives on the DELIVERY row, not in a fifth status.
//
// 🔴 `invoiced` IS AN OPEN STATUS AND IT HOLDS A COMMITMENT. It was already live on real
//   rows before ratification, written only by the QuickBooks push, and ABSENT from this
//   array — which meant `inventoryStates.fetchCommittedByLot` (an allow-list built from
//   ORDER_STATUSES) could not see those rows at all. Ratifying the set admits them to the
//   committed-stock derivation. That is a CORRECTION, not a regression, and the twelve
//   affected rows were audited and settled one by one before this landed — see
//   `scripts/migrate-order-status-vocabulary.mjs` and ledger #225.
//
// DEPENDENCIES: none (pure).
// OUTPUTS: ORDER_STATUSES, ORDER_STATUS_META, isOrderStatus, orderStatusMeta.
// ============================================================

export const ORDER_STATUSES = ['pending', 'invoiced', 'fulfilled', 'cancelled'] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#92600A', bg: '#FEF3C7' },
  invoiced:  { label: 'Invoiced',  color: '#1E40AF', bg: '#DBEAFE' },
  fulfilled: { label: 'Fulfilled', color: '#27500A', bg: '#DCFCE7' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
};

/** Is this string one of the canonical four? The server's validate and the roster's
 *  "is this row reachable" check ask the same question, so they ask it here. */
export function isOrderStatus(s: string | null | undefined): s is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(String(s ?? ''));
}

/**
 * Badge presentation for ANY status string, including one this vocabulary does not know.
 *
 * An unknown value renders in neutral grey UNDER ITS OWN RAW NAME rather than being
 * silently dropped or relabelled as something recognised — a status we cannot explain is a
 * fact about the data, and hiding it would be the D-9 failure of showing a confident label
 * over a value nobody looked at. This is the ONE place that fallback is defined; three
 * surfaces used to spell it out identically (STD-011).
 */
export function orderStatusMeta(status: string | null | undefined): { label: string; color: string; bg: string } {
  const key = String(status ?? '');
  return ORDER_STATUS_META[key] ?? { label: key || 'No status', color: '#6b7280', bg: '#f3f4f6' };
}
