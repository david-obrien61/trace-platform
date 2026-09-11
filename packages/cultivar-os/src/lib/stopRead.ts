// ============================================================
// stopRead — THE ONE READ OF A STOP, FOR EVERY SCREEN THAT SHOWS ONE.
//
// PURPOSE:      /delivery-schedule, /deliveries?date= and /orders/:id each composed their own view of
//               a stop from `deliveries` + `orders` + `customers`, fetching whatever they needed the
//               day they were written — which is why the schedule asked for `orders(id, status)` and
//               never the lines, and the route asked for a name and an address. David, 2026-09-11:
//               *"ORDERS, DELIVERY and ROUTE … on route I can't do anything or see anything except
//               name and location."* STD-017: a capability is right only when it is right on every
//               surface it touches. The DATA SPLIT is correct and unchanged — D-41 L1 puts billing on
//               the customer and snapshots the ship-to per order onto the stop. The defect was the
//               composition, and it is fixed here, once.
//
//               Three queries, each the narrowest that answers its question:
//                 1. the stops, with their customer — scoped to a day, a window, or one order;
//                 2. the linked orders' STATUS, for the open-order notice (deliveryFulfilment §2b);
//                 3. the linked orders' LINES — a TOP-LEVEL `order_items` read, deliberately NOT an
//                    `orders ( order_items (…) )` embed. OrderDetail.tsx:75-79 records a nested
//                    order_items embed under an orders read returning ZERO lines while its sibling
//                    embed populated; a top-level read has never done that. The columns the spec named
//                    (`quantity, description, sku`) plus the lot's `name, size` — a checkout line
//                    carries a lot and no description (`submit.ts` §8) and would render nameless.
//
// DEPENDENCIES: a supabase client passed in (type only — nothing constructed here) · ./stopLoad.
// OUTPUTS:      StopRow · StopRead · readStops · stopLoadOf · orderStatusOf
//
// 🔴 READ HONESTY: `readLines: false` (the viewer lacks `order_items:read`) SKIPS query 3. Under RLS it
//    would return zero rows, and zero rows is what "No items recorded on this order" asserts.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { stopLoadModel, type StopLoad, type StopOrderItem } from './stopLoad';

const TRACE_STOP = true; // [TRACE:STOP] STD-003 — ON until David owner-proves

export interface StopRow {
  id: string;
  customer_id: string | null;
  delivery_date: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  service_type: string | null;
  notes: string | null;
  order_id: string | null;
  created_at: string;
  // Added by 20260831d (applied, measured 2026-09-02). Undefined when the fallback read ran.
  started_at: string | null;
  completed_at: string | null;
  review_asked_at: string | null;
  review_ask_outcome: string | null;
  customers: {
    first_name: string; last_name: string; phone: string | null; email: string | null;
    address_line1: string | null; city: string | null; state: string | null; zip: string | null;
  } | null;
}

type StopScope =
  | { kind: 'day'; date: string }
  | { kind: 'window'; from: string }
  | { kind: 'order'; orderId: string };

export interface StopRead {
  stops: StopRow[];
  /** False when 20260831d's four columns were absent and the core read ran instead. */
  fulfilmentColumns: boolean;
  orderStatusById: Map<string, string>;
  /** order_id → its lines. With `linesRead` true, an absent key means the order has none. */
  linesByOrderId: Map<string, StopOrderItem[]>;
  linesRead: boolean;
  canReadLines: boolean;
}

// The customer join is WIDE on purpose: the "Edit customer" affordance opens the full record, and the
// billing columns tell the card nothing it should render as the ship-to (that is on the stop).
const CUSTOMER_JOIN =
  'customers ( first_name, last_name, phone, email, address_line1, city, state, zip, billing_line1, billing_city, billing_state, billing_zip )';
const STOP_COLS_CORE =
  `id, customer_id, delivery_date, address_line1, city, state, zip, status, service_type, notes, order_id, created_at, ${CUSTOMER_JOIN}`;
const STOP_COLS_FULL =
  `id, customer_id, delivery_date, address_line1, city, state, zip, status, service_type, notes, order_id, created_at, started_at, completed_at, review_asked_at, review_ask_outcome, ${CUSTOMER_JOIN}`;
const STOP_LINE_COLS =
  'order_id, quantity, description, sku, business_inventory_id, business_inventory ( name, size )';

export async function readStops(
  db: SupabaseClient, businessId: string, scope: StopScope, opts: { readLines: boolean },
): Promise<{ ok: true; value: StopRead } | { ok: false; error: string }> {
  const q = (cols: string) => {
    let b = db.from('deliveries').select(cols).eq('business_id', businessId).neq('status', 'cancelled');
    if (scope.kind === 'day') b = b.eq('delivery_date', scope.date);
    // `.or(is null, gte)`, not a bare floor: undated stops are grouped LAST by the schedule, and a bare
    // `.gte` would silently drop a state the screen already handles.
    else if (scope.kind === 'window') b = b.or(`delivery_date.is.null,delivery_date.gte.${scope.from}`);
    else b = b.eq('order_id', scope.orderId);
    return b.order('delivery_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(200);
  };

  let { data, error } = await q(STOP_COLS_FULL);
  let fulfilmentColumns = true;
  // 42703 = undefined_column, PGRST204 = not in the schema cache: 20260831d is not applied. Fall back
  // rather than blank every screen, and REMEMBER it, so the tap can say why it is missing.
  const code = (error as { code?: string } | null)?.code;
  if (error && (code === '42703' || code === 'PGRST204')) {
    fulfilmentColumns = false;
    ({ data, error } = await q(STOP_COLS_CORE));
  }
  if (error) {
    if (TRACE_STOP) console.log('[TRACE:STOP] read FAILED', { scope, message: error.message });
    return { ok: false, error: error.message };
  }
  const stops = (data ?? []) as unknown as StopRow[];

  const orderIds = [...new Set(stops.map(s => s.order_id).filter((x): x is string => !!x))];
  const orderStatusById = new Map<string, string>();
  const linesByOrderId = new Map<string, StopOrderItem[]>();
  let linesRead = true;

  if (orderIds.length) {
    const statuses = await db.from('orders').select('id, status').eq('business_id', businessId).in('id', orderIds);
    if (statuses.error) {
      // Degrade to SILENCE, not to a guess: no status means no open-order notice, which is honest.
      if (TRACE_STOP) console.log('[TRACE:STOP] linked-order status read FAILED — notice suppressed, not guessed', { message: statuses.error.message });
    } else {
      for (const o of (statuses.data ?? []) as { id: string; status: string | null }[]) if (o.status) orderStatusById.set(o.id, o.status);
    }

    if (opts.readLines) {
      const lines = await db.from('order_items').select(STOP_LINE_COLS).in('order_id', orderIds);
      if (lines.error) {
        linesRead = false;
        if (TRACE_STOP) console.log('[TRACE:STOP] lines read FAILED — every linked stop says so, none says "no items"', { message: lines.error.message });
      } else {
        for (const l of (lines.data ?? []) as unknown as StopOrderItem[]) {
          const list = linesByOrderId.get(l.order_id);
          if (list) list.push(l); else linesByOrderId.set(l.order_id, [l]);
        }
      }
    }
  }

  if (TRACE_STOP) console.log('[TRACE:STOP] read', {
    scope, stops: stops.length, linkedOrders: orderIds.length,
    ordersWithLines: linesByOrderId.size, linesRead, readLines: opts.readLines, fulfilmentColumns,
  });
  return {
    ok: true,
    value: { stops, fulfilmentColumns, orderStatusById, linesByOrderId, linesRead, canReadLines: opts.readLines },
  };
}

export function stopLoadOf(read: StopRead, stop: StopRow): StopLoad {
  return stopLoadModel({
    orderId: stop.order_id,
    canReadLines: read.canReadLines,
    linesRead: read.linesRead,
    items: stop.order_id ? read.linesByOrderId.get(stop.order_id) ?? [] : [],
  });
}

export function orderStatusOf(read: StopRead, stop: StopRow): string | null {
  return stop.order_id ? read.orderStatusById.get(stop.order_id) ?? null : null;
}
