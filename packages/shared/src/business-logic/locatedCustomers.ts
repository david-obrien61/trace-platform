// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Read what the Map page draws — every located customer address for a business,
//               the count of the ones nobody has placed, and the orders/deliveries behind the
//               three status filters.
// DEPENDENCIES: customerAddressFields (the column lists) · mapLayers (the pure derivation).
// OUTPUTS:      readLocatedAddresses() · readCustomerMapData()
//
// 🔴 EXTRACTED FROM `Settings.tsx`, NOT COPIED (§6 r8). Settings → Delivery had this read inline;
// the Map page needed the same rows, and a second copy of a business-wide located read is how the
// two screens come to disagree about how many customers we can find. Settings now calls this too.
//
// 🔴 THE UNLOCATED COUNT IS RETURNED, NEVER INFERRED FROM THE DOTS. `dots.length` says how many we
// drew, which is capped; it cannot tell you how many are missing. On LAWNS today the gap is the
// story: measured 2026-09-25, **208 of 1,497 addresses are located** and 1,282 have never been
// attempted, because the bulk run is browser-driven and stopped when the page was left. A map
// that quietly drew 208 dots would look like a small customer book rather than an unfinished job.
//
// ⚠️ PAGED, AND THE ORDER IS LOAD-BEARING. PostgREST returns at most 1,000 rows; a `.range()` with
// no `ORDER BY` can repeat or SKIP a row between pages, because Postgres guarantees nothing about
// heap order. The pattern (and the reasoning) is `historyLoad.ts:206`.
// ─────────────────────────────────────────────────────────────────────────────
import { CUSTOMER_ADDRESS_DOT_COLUMNS } from './customerAddressFields';
import { summariseCustomers, type CustomerSummary, type OrderFact, type DeliveryFact } from './mapLayers';

const PAGE = 1000;

/**
 * The columns the three status filters are DERIVED from — named here, not typed into the query.
 * #179: the list is the source and the select is derived from it, so a column that moves is a
 * change in one place rather than a silently short read.
 */
const ORDER_FACT_COLUMNS = 'id, customer_id, sale_date, created_at, status, transport_method, order_kind';
const DELIVERY_FACT_COLUMNS = 'id, customer_id, status, completed_at, service_type';

export interface LocatedAddress {
  id: string;
  customerId: string | null;
  line1: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
}

export interface LocatedRead {
  addresses: LocatedAddress[];
  /** Addresses with no verdict at all — nobody has tried to place them. */
  neverAttempted: number;
  /** Addresses Google could not place. A different fact from "not tried". */
  cannotPlace: number;
  /** Null when the read FAILED — which is not the same as "none", and must not render as none. */
  failed: string | null;
}

/**
 * Page through a query. **The caller builds the query, so the TABLE NAME stays a literal.**
 *
 * 🔴 IT TOOK A `table: string` IN THE FIRST DRAFT AND THE BUILD REFUSED IT. `contactRecord.test.ts`
 * §G6 asserts that no file touching a contact table reaches one through a VARIABLE — because a
 * `db.from(table)` is invisible to every cap that reads which tables a file touches, and the
 * write-path ratchet is built on exactly that grep. The guard was right and the fix is better
 * code: the literal lives at each call site, where a reader can see it.
 */
async function pageAll(make: (from: number, to: number) => any, what: string): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read ${what}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

/** Every located address for a business, plus the two honest counts of the ones that are not. */
export async function readLocatedAddresses(db: any, businessId: string): Promise<LocatedRead> {
  try {
    const rows = await pageAll((a, b) => db.from('customer_addresses')
      .select(CUSTOMER_ADDRESS_DOT_COLUMNS).eq('business_id', businessId)
      .eq('geocode_status', 'found').not('latitude', 'is', null)
      .order('id', { ascending: true }).range(a, b), 'customer addresses');
    const addresses: LocatedAddress[] = rows.map(r => ({
      id: String(r.id),
      customerId: r.customer_id ? String(r.customer_id) : null,
      line1: r.line1 ?? null,
      city: r.city ?? null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    })).filter(a => Number.isFinite(a.latitude) && Number.isFinite(a.longitude));

    const never = await db.from('customer_addresses').select('*', { count: 'exact', head: true })
      .eq('business_id', businessId).is('geocode_status', null);
    const cannot = await db.from('customer_addresses').select('*', { count: 'exact', head: true })
      .eq('business_id', businessId).eq('geocode_status', 'not_found');

    return {
      addresses,
      neverAttempted: never.count ?? 0,
      cannotPlace: cannot.count ?? 0,
      failed: null,
    };
  } catch (e) {
    // 🔴 A FAILED READ IS NOT AN EMPTY MAP. Returning `[]` here would draw no dots and say
    // nothing, which is indistinguishable from a business with no located customers.
    return { addresses: [], neverAttempted: 0, cannotPlace: 0, failed: (e as Error).message };
  }
}

export interface CustomerMapData {
  addresses: LocatedAddress[];
  summaries: Map<string, CustomerSummary>;
  neverAttempted: number;
  cannotPlace: number;
  /** The customers we hold at all — so "located" can be read as a fraction of something. */
  failed: string | null;
}

/**
 * Everything the Map page's CUSTOMERS layer needs, in three reads.
 *
 * ⚠️ IT DOES NOT READ ORDER LINES. *What* a customer bought is wanted only for the handful of rows
 * in the near-the-route list, and pulling every line for every order to draw a dot would make the
 * page slow for a fact almost none of the dots ever show. The list fetches that on demand.
 */
export async function readCustomerMapData(db: any, businessId: string): Promise<CustomerMapData> {
  const located = await readLocatedAddresses(db, businessId);
  if (located.failed) {
    return { addresses: [], summaries: new Map(), neverAttempted: 0, cannotPlace: 0, failed: located.failed };
  }
  try {
    const orders = await pageAll((a, b) => db.from('orders')
      .select(ORDER_FACT_COLUMNS).eq('business_id', businessId)
      .order('id', { ascending: true }).range(a, b), 'orders') as OrderFact[];
    const deliveries = await pageAll((a, b) => db.from('deliveries')
      .select(DELIVERY_FACT_COLUMNS).eq('business_id', businessId)
      .order('id', { ascending: true }).range(a, b), 'deliveries') as DeliveryFact[];
    return {
      addresses: located.addresses,
      summaries: summariseCustomers(orders, deliveries),
      neverAttempted: located.neverAttempted,
      cannotPlace: located.cannotPlace,
      failed: null,
    };
  } catch (e) {
    // The dots are real even when the history read fails — but every status filter would then be
    // a lie, so the caller is told rather than being handed dots with empty summaries.
    return {
      addresses: located.addresses, summaries: new Map(),
      neverAttempted: located.neverAttempted, cannotPlace: located.cannotPlace,
      failed: (e as Error).message,
    };
  }
}
