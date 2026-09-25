// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Turn a delivery stop into the shape the load builder wants — ONE mapping, for
//               every caller that needs to know what is on a stop.
// DEPENDENCIES: lib/stopRead (StopRow, StopRead) · lib/loadList (LoadStopInput) ·
//               lib/loadListChecks (stopChecks) · lib/stopWrites · shared/utils/personName.
// OUTPUTS:      loadInputFor()
//
// 🔴 EXTRACTED FROM `LoadList.tsx`, NOT COPIED (§6 r8, 2026-09-25). Its own comment already said
// "ONE MAPPING, TWO CALLERS" — and it was a private function inside a page, so the third caller
// (PLAN THE DAY, which needs each stop's gallons) could not reach it without either importing a
// page or re-typing the mapping. Re-typing it is how a crew plan would start quietly disagreeing
// with the load sheet for the same day, which is precisely what the original comment warns about.
// Nothing about the mapping changed in the move.
// ─────────────────────────────────────────────────────────────────────────────
import { customerDisplayName } from '@trace/shared/utils/personName';
import { stopChecks } from './loadListChecks';
import { shipToLine, billingAsShipTo } from './stopWrites';
import type { StopRow, StopRead } from './stopRead';
import type { LoadStopInput } from './loadList';

/**
 * One stop, as the load builder wants it.
 *
 * 🔴 ONE MAPPING, TWO CALLERS (§6 r8). The whole-day sheet and every per-team section build their
 *    models from THIS function, so a team's section cannot describe a stop differently from the way
 *    the day's sheet describes it. Two copies of this mapping is precisely how a per-crew sheet would
 *    start quietly disagreeing with the day it came from.
 */
export function loadInputFor(s: StopRow, dayRead: StopRead): LoadStopInput {
  return {
    stopId: s.id,
    customerName: customerDisplayName(s.customers ?? {}, 'Customer'),
    address: shipToLine(s) || shipToLine(billingAsShipTo(s.customers)),
    serviceType: s.service_type,
    orderId: s.order_id,
    canReadLines: dayRead.canReadLines,
    linesRead: dayRead.linesRead,
    items: (s.order_id ? dayRead.linesByOrderId.get(s.order_id) : undefined) ?? [],
    // 🔴 INSTALL MATERIALS FOLLOW THE SERVICE, NOT THE TREE (David, 2026-09-25) — so this is no
    // longer just `transport_method === 'install'`. THREE things can say a stop is planted: its own
    // mark, a TRIP CHARGE on its order (TC pairs with install), or a WARRANTY REPLACEMENT tree.
    // ⚠️ Before this, a TC-only install loaded NO mix, NO posts and NO monitors — Stallings on
    // Saturday 2026-09-26 — because only the first of the three was read.
    // The judgement is `stopChecks`, so it is probed rather than inlined here (§6 r19).
    installs: stopChecks({
      stopId: s.id,
      customerName: customerDisplayName(s.customers ?? {}, 'Customer'),
      serviceType: s.service_type,
      markedInstall: s.order_id ? dayRead.transportByOrderId.get(s.order_id) === 'install' : false,
      lines: (s.order_id ? dayRead.linesByOrderId.get(s.order_id) : undefined) ?? [],
    }).basis !== null,
    // Nothing stored marks a stop as fenced (measured 2026-09-12) — so the data cannot tell.
    deerFence: null,
  };
}
