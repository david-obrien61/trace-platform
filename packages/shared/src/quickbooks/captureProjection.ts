// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: turn a verified capture file into the SAME payload shape the live endpoint returns,
//   so every screen downstream of the read cannot tell which door the data came through. This
//   is the seam on which "David sees exactly what Lauren will see" either holds or quietly
//   stops holding.
// DEPENDENCIES: ./captureReplay (CaptureReplay) · ./itemList · ./customerList · ./invoiceList.
//   Pure: no db, no network, no env, no clock, no DOM.
// OUTPUTS: ProjectedRead · projectCapture · PROJECTED_KEYS.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE THREE ENTITIES RETURN THREE DIFFERENT SHAPES ON PURPOSE, AND THIS FILE COPIES THAT
//    ASYMMETRY RATHER THAN TIDYING IT AWAY.
// ══════════════════════════════════════════════════════════════════════════════════════════
//   Item     → `items` (the full parsed rows) + `breakdown`. An item is a product, not a person.
//   Customer → `breakdown` + a FIVE-ROW `preview`. Never the 1,900 records.
//   Invoice  → `breakdown` ONLY. Not even a preview: an invoice names the human who bought and
//              says what they paid.
//
// Making these uniform would be a tidier function and a worse one — the live payloads are not
// uniform, so a uniform projection would render a screen that does not exist in production, and
// the preview would be a preview of something Lauren never sees. `PROJECTED_KEYS` states the
// shape per entity as DATA so a probe can assert the two agree rather than a reader hoping so.
//
// ⚠️ THIS RUNS IN THE BROWSER, WHERE THE FULL DATA IS ALREADY PRESENT. The server's reason for
// withholding parsed customers and invoices is that they must not cross the wire into a payload;
// here the operator's own file is already open on their own machine, and `QboBooksReader`
// already parses invoices from it to feed the findings. So parsing here weakens nothing — but
// the OUTPUT still withholds them, because the screens downstream are built against the live
// shape and a projection that handed them more would be a different screen.
//
// 🔴 `pages_fetched` IS ROW PAGES, NOT `pages.length`. The live handler writes
// `walked.pages.length - 1` because page zero is the `select count(*)` response. `rowPageCount`
// already excludes it, so subtracting again here would under-report by one — the same
// off-by-one from the other side.
// ─────────────────────────────────────────────────────────────────────────────
import type { CaptureReplay } from './captureReplay';
import { parseItemList, summariseItems, type QboItemRow, type ItemBreakdown } from './itemList';
import { parseCustomerList, summariseCustomers, previewCustomers,
         type QboCustomerRow, type CustomerBreakdown } from './customerList';
import { parseInvoiceList, summariseInvoices, type InvoiceBreakdown } from './invoiceList';

/**
 * The keys each entity's LIVE payload carries, as data, so a probe can hold this file to it.
 *
 * 🔴 THESE ARE THE DIFFERENTIATING KEYS, AND SAYING SO IS NOT PEDANTRY — IT IS THE BUG.
 * `capture` is returned by all three live handlers identically, so it is not listed here, and
 * for two days it was not RETURNED here either: a shape stated as a set of differences cannot
 * describe a key that every shape shares, and neither can a probe built from that set. The
 * universal keys are enumerated separately, below, precisely so the next one cannot go missing
 * by being unremarkable.
 */
export const PROJECTED_KEYS = {
  Item:     ['items', 'breakdown'],
  Customer: ['breakdown', 'preview'],
  Invoice:  ['breakdown'],
} as const;

/**
 * The keys EVERY projected read carries, whatever the entity. `capture` earns its place here
 * rather than in the map above because it is the one the asymmetry hid.
 */
export const UNIVERSAL_PROJECTED_KEYS = [
  'ok', 'entity', 'realm_id', 'queried_at', 'expected_total', 'retrieved_total',
  'complete', 'pages_fetched', 'breakdown', 'stored', 'source', 'capture',
] as const;

export interface ProjectedRead {
  ok: true;
  entity: CaptureReplay['entity'];
  realm_id: string;
  queried_at: string | null;
  expected_total: number;
  retrieved_total: number;
  complete: true;
  pages_fetched: number;
  /** Item only — see the asymmetry note above. */
  items?: QboItemRow[];
  breakdown: ItemBreakdown | CustomerBreakdown | InvoiceBreakdown;
  /** Customer only. */
  preview?: QboCustomerRow[];
  /** Stated, never assumed: reading a file persists nothing, exactly as the live read does not. */
  stored: false;
  /** 🔴 The one field the live payload does NOT have. A screen must be able to say so. */
  source: CaptureReplay['source'];
  /**
   * 🔴 THE VERBATIM ROW BODIES, CARRIED THROUGH — THE FIELD WHOSE ABSENCE MADE THE FILE DOOR
   * A DIFFERENT DOOR.
   *
   * The live handlers all return `capture: done.capture`, and `QboBooksReader` parses the
   * invoice list out of it in the browser (the invoice endpoint deliberately never sends parsed
   * invoice records, so the raw bodies are the ONLY route to them). Dropping it here meant a
   * saved read rendered no invoice table and left every invoice-derived finding unmeasured —
   * on a file that held every invoice those findings needed.
   *
   * ⚠️ IT IS RECONSTRUCTED, NOT PASSED THROUGH, AND IT CARRIES ROW PAGES ONLY. `CaptureReplay`
   * keeps `rowBodies` and discards the `select count(*)` page once it has USED it to prove the
   * file complete. Row pages are what a parser wants and `pages_fetched` already counts exactly
   * them, so the two agree by construction instead of by an off-by-one nobody would see.
   *
   * ⚠️ IT EXPOSES NOTHING NEW. These bytes came off a file the operator opened on their own
   * machine; the browser held them before it called this function. The withholding that matters
   * — no parsed customer records, no parsed invoice records, no preview on the invoice path —
   * is unchanged, and §C of the probe file asserts it over every parsed field.
   */
  capture: {
    entity: CaptureReplay['entity'];
    realm_id: string;
    queried_at: string | null;
    expected_total: number;
    retrieved_total: number;
    complete: true;
    pages: { body: string }[];
  };
}

/**
 * Project a VERIFIED capture into the live payload shape.
 *
 * Takes a `CaptureReplay`, never a raw file: the type makes it impossible to project something
 * that has not been through the completeness and self-agreement gates, so there is no ordering
 * a caller can get wrong.
 */
export function projectCapture(replay: CaptureReplay): ProjectedRead {
  const base = {
    ok: true as const,
    entity: replay.entity,
    realm_id: replay.realmId,
    queried_at: replay.queriedAt,
    expected_total: replay.expectedTotal,
    retrieved_total: replay.retrievedTotal,
    complete: true as const,
    pages_fetched: replay.rowPageCount,
    stored: false as const,
    source: replay.source,
    // See the field doc above: row pages only, reconstructed from the bodies the gate verified.
    capture: {
      entity: replay.entity,
      realm_id: replay.realmId,
      queried_at: replay.queriedAt,
      expected_total: replay.expectedTotal,
      retrieved_total: replay.retrievedTotal,
      complete: true as const,
      pages: replay.rowBodies.map(body => ({ body })),
    },
  };

  if (replay.entity === 'Item') {
    const items = replay.rowBodies.flatMap(raw => parseItemList(raw).items);
    return { ...base, items, breakdown: summariseItems(items) };
  }
  if (replay.entity === 'Customer') {
    const customers = replay.rowBodies.flatMap(raw => parseCustomerList(raw).customers);
    return { ...base, breakdown: summariseCustomers(customers), preview: previewCustomers(customers) };
  }
  const invoices = replay.rowBodies.flatMap(raw => parseInvoiceList(raw).invoices);
  return { ...base, breakdown: summariseInvoices(invoices) };
}
