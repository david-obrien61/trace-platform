// ============================================================
// orderStatus — the order lifecycle (ONE source: roster badge, detail transitions, server validate).
// PURPOSE: orders.status is a live-only text column with NO CHECK (submit.ts writes 'pending';
//   no status-transition code existed anywhere — as-built recon §7). This defines a minimal,
//   RATIFICATION-PENDING lifecycle so an owner/manager can move an order off 'pending'. The
//   server (submit.ts action='status') validates against ORDER_STATUSES so a bad value can't land.
//   ⚠️ R-STATUS (open decision): the enum below is a minimal proposal — David ratifies the set
//   (and whether 'cancelled' should auto-release inventory, which the server currently does).
// DEPENDENCIES: none (pure).
// OUTPUTS: ORDER_STATUSES, ORDER_STATUS_META, isOrderStatus.
// ============================================================

export const ORDER_STATUSES = ['pending', 'confirmed', 'fulfilled', 'cancelled'] as const;

export const ORDER_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#92600A', bg: '#FEF3C7' },
  confirmed: { label: 'Confirmed', color: '#1E40AF', bg: '#DBEAFE' },
  fulfilled: { label: 'Fulfilled', color: '#27500A', bg: '#DCFCE7' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
};
