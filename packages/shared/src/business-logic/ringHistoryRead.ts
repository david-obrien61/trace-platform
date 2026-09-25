// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Read what LAWNS actually charged for a trip, with where it went, so the rings can
//               be compared against the invoices instead of against the arithmetic that seeded them.
// DEPENDENCIES: locatedCustomers (the located addresses) · mapLayers/deliveryRings types.
// OUTPUTS:      TRIP_CHARGE_DESCRIPTIONS · readRingHistory()
//
// 🔴 THE CHARGE IS AN `order_items` LINE, NOT AN `order_service_selections` ROW — MEASURED, AND
// IT IS THE OPPOSITE OF WHAT I EXPECTED. `order_service_selections` is where checkout writes a
// service today, and on LAWNS it is **EMPTY**: zero rows. Every trip charge they have ever billed
// came in from QuickBooks as an INVOICE LINE — `description = 'Trip Charge'`, **549 of them**,
// $0.00 to $400.00. A comparison built on the table the code writes to would have read zero rows
// and reported "your rings match your invoices" about nothing at all.
//
// ⚠️ SO THIS MATCHES ON DESCRIPTION TEXT, WHICH IS A REAL WEAKNESS AND IS STATED RATHER THAN HIDDEN.
// The descriptions are QuickBooks item names typed by a person: `Trip Charge`, `Delivery`,
// `Tailgate Delivery  \n\n[WILL ONLY DROP…]` — three spellings of tailgate alone, differing by
// whitespace. Matching text is fragile in a way a foreign key is not. The alternative — linking
// each line to its `service_offerings` row — is tech-debt #139's missing link and does not exist.
// So: exact, trimmed, case-insensitive matching on a NAMED list, and the count of what matched is
// reported so a spelling nobody anticipated shows up as a smaller number rather than as silence.
// ─────────────────────────────────────────────────────────────────────────────
import { readLocatedAddresses } from './locatedCustomers';
import type { DeliveryObservation } from './deliveryRings';

/**
 * The invoice-line descriptions that ARE a trip charge.
 *
 * 🔴 ONLY THE TRIP CHARGE, DELIBERATELY. `Tailgate Delivery` and `Backyard Delivery` are priced
 * FLAT by David's ruling and are not supposed to follow distance, so including them would
 * manufacture disagreements with rings they were never meant to obey. `Delivery` (62 lines) is
 * excluded for a different reason: nobody has said what it is, and guessing is what this whole
 * comparison exists to avoid.
 */
export const TRIP_CHARGE_DESCRIPTIONS = ['trip charge'];

export interface RingHistoryRead {
  observations: DeliveryObservation[];
  /** Trip-charge lines found at all — the denominator for "how many could be compared". */
  linesFound: number;
  /** …of those, how many belong to a customer whose address has been located. */
  linesPlaced: number;
  failed: string | null;
}

/**
 * Every past trip charge, with a coordinate where we have one.
 *
 * ⚠️ THE COORDINATE IS THE CUSTOMER'S ADDRESS TODAY, NOT WHERE THE TRUCK WENT THAT DAY. For a
 * customer with one address those are the same thing; for a contractor with three job sites they
 * are not, and this cannot tell them apart — `deliveries` has carried no coordinate of its own
 * until `20260923d`, which is unapplied. Every such line is counted as unplaced rather than
 * guessed at, which is why `linesPlaced` is reported beside `linesFound`.
 */
export async function readRingHistory(db: any, businessId: string): Promise<RingHistoryRead> {
  try {
    const located = await readLocatedAddresses(db, businessId);
    if (located.failed) return { observations: [], linesFound: 0, linesPlaced: 0, failed: located.failed };

    // One located address per customer. A customer with SEVERAL is left out entirely — see above.
    const byCustomer = new Map<string, { latitude: number; longitude: number } | 'ambiguous'>();
    for (const a of located.addresses) {
      if (!a.customerId) continue;
      const seen = byCustomer.get(a.customerId);
      if (seen === undefined) byCustomer.set(a.customerId, { latitude: a.latitude, longitude: a.longitude });
      else byCustomer.set(a.customerId, 'ambiguous');
    }

    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('order_items')
        .select('id, description, subtotal, order_id, orders!inner(id, business_id, customer_id, sale_date, created_at, status)')
        .eq('orders.business_id', businessId)
        .order('id', { ascending: true }).range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }

    const observations: DeliveryObservation[] = [];
    let linesFound = 0, linesPlaced = 0;
    for (const r of rows) {
      const desc = String(r.description ?? '').trim().toLowerCase();
      if (!TRIP_CHARGE_DESCRIPTIONS.includes(desc)) continue;
      const order = r.orders as { customer_id?: string | null; status?: string | null; sale_date?: string | null; created_at?: string | null } | null;
      if (!order) continue;
      if ((order.status ?? '').toLowerCase() === 'cancelled') continue;
      const charge = Number(r.subtotal);
      // 🔴 A $0 TRIP CHARGE IS NOT A PRICE, IT IS A WAIVER. Comparing it to a ring would report a
      // disagreement every time somebody was done a favour, and bury the real ones.
      if (!Number.isFinite(charge) || charge <= 0) continue;
      linesFound++;
      const at = order.customer_id ? byCustomer.get(order.customer_id) : undefined;
      const placed = at && at !== 'ambiguous' ? at : null;
      if (placed) linesPlaced++;
      observations.push({
        charge,
        latitude: placed?.latitude ?? null,
        longitude: placed?.longitude ?? null,
        reference: (order.sale_date ?? order.created_at ?? '').slice(0, 10) || null,
      });
    }
    return { observations, linesFound, linesPlaced, failed: null };
  } catch (e) {
    return { observations: [], linesFound: 0, linesPlaced: 0, failed: (e as Error).message };
  }
}
