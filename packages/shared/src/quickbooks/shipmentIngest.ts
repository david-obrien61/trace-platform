// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: turn the SHIP-TO block of a QuickBooks invoice into a scheduled delivery — the
//   PURE half. Reads `ShipDate` (the delivery date Lauren has already been filling in),
//   classifies the free-form `ShipAddr` lines into street / city / state / zip / phone, and
//   builds a plan a person can read before anything is written. NO database, NO fetch, NO
//   Supabase client: every decision this file makes is reachable from a test.
// DEPENDENCIES: ./qboRead (parseRows) · ../utils/normalizePhone · ../utils/personName.
// OUTPUTS: QboShipmentRow · parseShipmentList · classifyAddressLine · parseCityStateZip ·
//   parseShipTo · looksLikeOrganization · splitDisplayName · selectFutureShipments ·
//   buildDeliveryPlan · DELIVERY_INGEST_SOURCE · deliveryNoteFor.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THIS FILE IS A SECOND, DELIBERATELY PERSONAL PARSE OF THE SAME ENTITY, AND THE
//   DIVERGENCE IS NAMED RATHER THAN QUIET. `invoiceList.ts` carries NO customer name and NO
//   address BY CONSTRUCTION — its §G test searches the whole serialised output for a name
//   that was in the input (R-24 c), because that read's product is a SUMMARY that reaches a
//   screen and a log. This read's product is a DELIVERY: a street a crew drives to and a
//   phone Lauren rings from the truck. It cannot be built out of a parse that refuses to
//   carry an address, so it does not try to. The safety moves instead of disappearing:
//   nothing here reaches a `console.log` body, nothing here is summarised for a screen of
//   1,900, and the only destination for these fields is the tenant's OWN `customers` and
//   `deliveries` rows — the same data their calendar already renders.
//
// 🔴 REFUSE RATHER THAN APPROXIMATE — THE ONE RULE THIS FILE IS ORGANISED AROUND. A delivery
//   at the wrong address sends a crew and a $7,000 tree to the wrong house; a flagged row
//   costs Lauren a minute. So every ambiguity — no street line, TWO street-shaped lines, a
//   billing city that disagrees with the ship-to city — ends as `blocked` with the reason and
//   the raw lines attached, never as a best guess. §1.6 item 3: an honest "unknown", never a
//   fabricated value.
//
// 🔴 AND THE ORDER OF THE LINES IS NOT TRUSTED, ONLY OBSERVED. David measured them as
//   name / phone / street / "City, ST ZIP" and that is what these books do — but a parse keyed
//   on POSITION silently mints an address the day one invoice omits the phone line and every
//   line shifts up by one. Each line is classified by its own SHAPE, and the position is used
//   for nothing.
// ══════════════════════════════════════════════════════════════════════════════
import { parseRows } from './qboRead';
import { parseInvoiceOrderLines, type QboOrderSourceLine } from './invoiceOrderLines';
import { normalizePhone } from '../utils/normalizePhone';
import { personNamesMatch } from '../utils/personName';

/** `deliveries.source` for every row this ingest writes — so they are distinguishable from
 *  Lauren's own hand-entered stops FOREVER, and so a re-run can find its own work. */
export const DELIVERY_INGEST_SOURCE = 'qbo-shipdate';

// ─── the row ─────────────────────────────────────────────────────────────────

/** One address block as Intuit sends it — free-form lines, or real structured fields, or both. */
export interface QboAddr {
  line1: string | null;
  line2: string | null;
  line3: string | null;
  line4: string | null;
  line5: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * One invoice, reduced to what a DELIVERY needs.
 *
 * 🔴 `customerName` IS PRESENT AND `invoiceList.QboInvoiceRow.customerId` HAS NO SUCH FIELD.
 * That is the divergence in the file header, made visible in the type: this row exists to
 * become a stop on a calendar, and a stop with no name on it is not a stop anyone can drive.
 */
export interface QboShipmentRow {
  id: string;
  docNumber: string | null;
  /** Intuit's `YYYY-MM-DD`, kept as the STRING it arrived as — never a `Date`. See `isFuture`. */
  shipDate: string | null;
  txnDate: string | null;
  totalAmt: number | null;
  customerId: string | null;
  customerName: string | null;
  shipAddr: QboAddr | null;
  billAddr: QboAddr | null;
  /**
   * The invoice's own `Line[]`, parsed one level deeper.
   *
   * 🔴 THE SAME READ, NOT A SECOND ONE. `ShipDate` is not a filterable field on Intuit's
   * Invoice query, so this ingest already walks EVERY invoice and already has each one's
   * nested lines in hand — it simply threw them away. Carrying them costs no Intuit call, no
   * new endpoint and no new Vercel function; it is the same 1,469 rows read one level deeper.
   * Without them a stop is a place a truck goes with nothing on it.
   */
  lines: QboOrderSourceLine[];
  /** `TxnTaxDetail.TotalTax` — the document's own tax, so it never has to be derived. */
  totalTax: number | null;
}

export interface ParsedShipmentList {
  ok: boolean;
  shipments: QboShipmentRow[];
  /** Set when the body could not be read. The body itself is NEVER in here. */
  parseError: string | null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function addr(raw: any): QboAddr | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    line1: str(raw.Line1), line2: str(raw.Line2), line3: str(raw.Line3),
    line4: str(raw.Line4), line5: str(raw.Line5),
    city:  str(raw.City),
    state: str(raw.CountrySubDivisionCode),
    zip:   str(raw.PostalCode),
  };
}

/** The free-form lines of an address block, in the order they arrived, blanks dropped. */
export function addrLines(a: QboAddr | null): string[] {
  if (!a) return [];
  return [a.line1, a.line2, a.line3, a.line4, a.line5].filter((l): l is string => !!l);
}

export function parseShipmentList(rawBody: string): ParsedShipmentList {
  const parsed = parseRows(rawBody, 'Invoice');
  if (!parsed.ok) return { ok: false, shipments: [], parseError: parsed.parseError };
  const shipments = parsed.rows.map((r: any): QboShipmentRow => ({
    id:           String(r?.Id ?? ''),
    docNumber:    str(r?.DocNumber),
    shipDate:     str(r?.ShipDate),
    txnDate:      str(r?.TxnDate),
    totalAmt:     num(r?.TotalAmt),
    customerId:   str(r?.CustomerRef?.value),
    customerName: str(r?.CustomerRef?.name),
    shipAddr:     addr(r?.ShipAddr),
    billAddr:     addr(r?.BillAddr),
    lines:        parseInvoiceOrderLines(r),
    totalTax:     num(r?.TxnTaxDetail?.TotalTax),
  }));
  return { ok: true, shipments, parseError: null };
}

// ─── line classification — by SHAPE, never by position ───────────────────────

export type AddressLineKind = 'phone' | 'city-state-zip' | 'street' | 'name';

/**
 * Street suffixes and prefixes seen in these books' own service area (Hill Country / Austin
 * metro). ⚠️ THIS LIST IS NOT ASSUMED COMPLETE AND THE CLASSIFIER DOES NOT DEPEND ON IT ALONE:
 * a line that OPENS WITH A HOUSE NUMBER is a street whether or not its suffix is listed, which
 * is what catches "105 Out Crop View Lane" without anybody having thought of "Out Crop". The
 * list only rescues the numberless minority (`PO Box 41`, `County Road 200`).
 */
const STREET_TOKENS = [
  'st', 'street', 'rd', 'road', 'dr', 'drive', 'ln', 'lane', 'ave', 'avenue', 'blvd', 'boulevard',
  'ct', 'court', 'cir', 'circle', 'cv', 'cove', 'trl', 'trail', 'way', 'pass', 'path', 'bend',
  'ridge', 'run', 'loop', 'pkwy', 'parkway', 'hwy', 'highway', 'ter', 'terrace', 'pl', 'place',
  'cyn', 'canyon', 'ranch', 'creek', 'hollow', 'hills', 'view', 'vista', 'crossing', 'xing',
  'box', 'cr', 'fm', 'rr', 'apt', 'suite', 'ste', 'unit',
];

const CITY_STATE_ZIP = /^\s*(.+?)\s*,\s*([A-Za-z]{2})\.?\s+(\d{5})(?:-\d{4})?\s*$/;

/** `"Lakeway, TX  78738"` → its three parts, or null. Whitespace between ST and ZIP is free. */
export function parseCityStateZip(line: string | null | undefined):
  { city: string; state: string; zip: string } | null {
  const m = CITY_STATE_ZIP.exec(line ?? '');
  if (!m) return null;
  const city = m[1].trim();
  if (!city) return null;
  return { city, state: m[2].toUpperCase(), zip: m[3] };
}

/**
 * What KIND of thing is this free-form line?
 *
 * Order matters and it is the safe order: the two SHAPES that can be recognised exactly —
 * a ten-digit phone and a `City, ST ZIP` — are tested first, so neither can ever be mistaken
 * for a street. Everything else is a street only on positive evidence (a leading house number,
 * or a listed street word); with no evidence at all it is a NAME, which is the classification
 * that cannot cause a wrong delivery.
 */
/**
 * Is this line A PHONE NUMBER AND NOTHING ELSE?
 *
 * ⚠️ WRITTEN BECAUSE THE OBVIOUS REUSE WAS WRONG, AND THE TESTS CAUGHT IT ON THE FIRST RUN.
 * `normalizePhone` LOOKS like the platform's phone reader and its name says so, but its own
 * header says what it actually is: a STORAGE normalizer that "only trims, collapses internal
 * whitespace, and maps empty → null". It returns a non-null value for *every* non-blank string,
 * so classifying with it made a customer's NAME a phone number and left every address with no
 * street line. `phoneMatchKey` is closer — but it accepts anything with 7+ digits, which
 * "2200 Ranch Road 620" satisfies.
 *
 * So the test is stated positively and narrowly: NO LETTERS AT ALL, and exactly ten digits (or
 * eleven behind a country-code 1). That refuses a ZIP (five), a house number, and any line that
 * carries words — and it is the shape a phone line in these books actually has.
 * ⚠️ It is a CLASSIFIER, not a normalizer: the value stored still goes through `normalizePhone`,
 * so there is still exactly one storage format in the platform (§6 r8).
 */
export function isPhoneLine(line: string): boolean {
  const s = line.trim();
  if (!s || /[A-Za-z]/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return true;
  return digits.length === 11 && digits.startsWith('1');
}

export function classifyAddressLine(line: string): AddressLineKind {
  const s = line.trim();
  // The two shapes that can be recognised EXACTLY go first, so neither can be read as a street.
  if (isPhoneLine(s)) return 'phone';
  if (parseCityStateZip(s)) return 'city-state-zip';
  if (/^\d/.test(s)) return 'street';
  const words = s.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.some(w => STREET_TOKENS.includes(w))) return 'street';
  return 'name';
}

// ─── the ship-to parse ───────────────────────────────────────────────────────

export interface ShipTo {
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  /** E.164-less normalized digits, or null. Absence is NEVER a refusal — it is just absent. */
  phone: string | null;
  /** The name line, when there was one. Used only as corroboration; never as the customer key. */
  nameLine: string | null;
  /** Which block the city/state/zip came from — carried so the preview can say so. */
  cityStateZipFrom: 'ship-structured' | 'bill-structured' | 'ship-line';
  /**
   * Set when the BILLING town disagrees with the ship-to town. NOT a refusal and not a defect —
   * a customer billed at home and delivered to a job site in another town is ordinary — but it
   * is worth Lauren seeing, so it is surfaced rather than swallowed.
   */
  note: string | null;
}

export interface ShipToRefusal {
  ok: false;
  /** Owner-actionable, in Lauren's words rather than the parser's. */
  reason: string;
  /** The lines as they arrived, so she can read what the parser could not. */
  lines: string[];
}

export type ShipToResult = ({ ok: true } & ShipTo) | ShipToRefusal;

/**
 * The ship-to block → a real street address, or a refusal that names what stopped it.
 *
 * 🔴 THE STREET COMES FROM `ShipAddr` AND ONLY FROM `ShipAddr`. `BillAddr` is where the bill
 * goes; `customerUpsert` already records the reason in its own org-dedup comment — one
 * contractor's ship-to varies per JOB SITE while their billing address does not. Taking a
 * billing street for a delivery is the wrong-house failure with extra steps.
 *
 * 🔴 THE CITY/STATE/ZIP MAY come from the structured `BillAddr` fields, because David measured
 * that they are frequently the properly-typed copy of the same thing and a real field beats a
 * regex. BUT — and this is the whole guard — if the ship-to ALSO carries its own
 * `City, ST ZIP` line and the two DISAGREE, that is not a preference, it is a conflict, and it
 * refuses. A crew sent to the billing town is the exact failure this ingest exists to avoid.
 */
export function parseShipTo(shipAddr: QboAddr | null, billAddr: QboAddr | null): ShipToResult {
  const lines = addrLines(shipAddr);
  const refuse = (reason: string): ShipToRefusal => ({ ok: false, reason, lines });

  if (!shipAddr) return refuse('This invoice has no ship-to address at all.');
  if (lines.length === 0 && !(shipAddr.city && shipAddr.state && shipAddr.zip)) {
    return refuse('The ship-to address block is empty.');
  }

  const kinds = lines.map(l => ({ line: l, kind: classifyAddressLine(l) }));

  // ── ① THE STREET ──────────────────────────────────────────────────────────
  const streets = kinds.filter(k => k.kind === 'street').map(k => k.line);
  // A structured ShipAddr keeps its street in Line1 even when Line1 reads like a name, so the
  // structured case is allowed to fall back to it — but ONLY when the block is genuinely
  // structured (real City/State/Zip fields), never as a rescue for a free-form block.
  const shipIsStructured = !!(shipAddr.city && shipAddr.state && shipAddr.zip);
  if (streets.length === 0 && !(shipIsStructured && shipAddr.line1)) {
    return refuse('No line in the ship-to address looks like a street.');
  }
  if (streets.length > 1) {
    // 🔴 REPORTED, NOT PICKED. Choosing the first would be right most of the time, and the
    // times it is wrong are a crew at the wrong house — the trade the prompt settles explicitly.
    return refuse(`Two lines in the ship-to address both look like a street (${streets.map(s => `"${s}"`).join(' and ')}) — pick the delivery one.`);
  }
  const addressLine1 = streets[0] ?? shipAddr.line1!;

  // ── ② CITY / STATE / ZIP ──────────────────────────────────────────────────
  const shipStructured = shipIsStructured
    ? { city: shipAddr.city!, state: shipAddr.state!.toUpperCase(), zip: shipAddr.zip! } : null;
  const billStructured = billAddr?.city && billAddr.state && billAddr.zip
    ? { city: billAddr.city, state: billAddr.state.toUpperCase(), zip: billAddr.zip } : null;
  const shipLineCsz = kinds.filter(k => k.kind === 'city-state-zip').map(k => parseCityStateZip(k.line)!);
  if (shipLineCsz.length > 1) {
    return refuse('Two lines in the ship-to address both look like "City, ST ZIP" — only one can be the delivery town.');
  }
  const shipLine = shipLineCsz[0] ?? null;

  // 🔴 PRECEDENCE, AND THE ORDER IS THE WHOLE SAFETY ARGUMENT.
  //   ① the ship-to's OWN structured fields — real typed fields, and they describe the ship-to
  //   ② the ship-to's OWN "City, ST ZIP" line — a regex, but it describes the ship-to
  //   ③ the structured BILLING fields — real fields, but they describe WHERE THE BILL GOES
  // David's guidance was "prefer the structured one, parse Line4 only where it does not exist",
  // and ①–② honour that within the ship-to block. ③ is deliberately LAST rather than second:
  // a customer billed at home and delivered to a job site in the next town is ordinary at this
  // business, and a billing town promoted over a stated ship-to town is a truck in the wrong
  // town on an entirely normal invoice. A billing address is a fallback for a MISSING town,
  // never a correction to a stated one.
  let chosen: { city: string; state: string; zip: string } | null = null;
  let from: ShipTo['cityStateZipFrom'] = 'ship-line';
  if (shipStructured)      { chosen = shipStructured; from = 'ship-structured'; }
  else if (shipLine)       { chosen = shipLine;       from = 'ship-line'; }
  else if (billStructured) { chosen = billStructured; from = 'bill-structured'; }

  if (!chosen) return refuse('The ship-to address has no city, state and ZIP that can be read.');

  // A structured SHIP-TO that disagrees with its own free-form line is a block edited in two
  // places and it genuinely cannot be resolved from here — one of the two is stale and only a
  // person knows which. ZIP is the field compared: it is the one that cannot be spelled two ways.
  if (from === 'ship-structured' && shipLine && shipLine.zip !== chosen.zip) {
    return refuse(`The ship-to address gives two different ZIPs (${chosen.zip} and ${shipLine.zip}) — one of them is out of date.`);
  }

  // Disagreement with BILLING is surfaced, never refused — see the precedence note above.
  let note: string | null = null;
  if (billStructured && billStructured.zip !== chosen.zip) {
    note = `Billed to ${billStructured.city}, ${billStructured.state} ${billStructured.zip} — delivering to the ship-to address above.`;
  }

  // ── ③ THE PHONE — a gift, never a gate ────────────────────────────────────
  const phoneLine = kinds.find(k => k.kind === 'phone')?.line ?? null;
  // Stored through the platform's ONE storage normalizer, which deliberately preserves the shape
  // a human typed — "(951) 323-3061" stays readable rather than becoming ten bare digits.
  const phone = normalizePhone(phoneLine);

  const nameLine = kinds.find(k => k.kind === 'name')?.line ?? null;

  return { ok: true, addressLine1, city: chosen.city, state: chosen.state, zip: chosen.zip, phone, nameLine, cityStateZipFrom: from, note };
}

// ─── who the customer is ─────────────────────────────────────────────────────

/**
 * Organisation tokens. Conservative BY DESIGN: a false "organization" skips the person spine
 * and changes the dedup key, so the list holds only words that are never part of a human name.
 * A missed org simply dedups as a person, which is the pre-existing behaviour for every
 * org that reached `findOrCreateCustomer` without a `customer_type`.
 */
export const ORG_NAME_TOKENS = [
  'llc', 'inc', 'incorporated', 'corp', 'corporation', 'ltd', 'lp', 'llp', 'pllc', 'co',
  'hoa', 'poa', 'association', 'company', 'services', 'service', 'landscaping', 'landscape',
  'nursery', 'nurseries', 'construction', 'builders', 'homes', 'properties', 'management',
  'design', 'designs', 'contracting', 'contractors', 'ranch', 'farms', 'group', 'partners',
];

export function looksLikeOrganization(displayName: string | null | undefined): boolean {
  const words = (displayName ?? '').toLowerCase().replace(/[^\w\s&]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.includes('&')) return true;
  return words.some(w => ORG_NAME_TOKENS.includes(w));
}

/**
 * A QuickBooks DisplayName → the first/last pair `customers` stores.
 *
 * An ORGANISATION keeps its whole name in `first_name` and an EMPTY `last_name` — that is not
 * this file's invention, it is exactly what `customerUpsert`'s org branch matches on
 * ("org name lives in first_name"), and splitting "Bishop Landscaping LLC" into a first and a
 * last name would break the dedup key that branch depends on.
 */
export function splitDisplayName(displayName: string | null | undefined):
  { first: string; last: string; isOrg: boolean } {
  const name = (displayName ?? '').trim();
  const isOrg = looksLikeOrganization(name);
  if (isOrg || !name) return { first: name, last: '', isOrg };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '', isOrg: false };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1], isOrg: false };
}

// ─── selection ───────────────────────────────────────────────────────────────

/**
 * Is `shipDate` on or after `today`? Compared as STRINGS, deliberately.
 *
 * `new Date('2026-09-05') < new Date()` is a timezone question and this is not one: Intuit
 * sends `YYYY-MM-DD`, which sorts lexicographically exactly as it sorts chronologically. The
 * `Date` version of this line is the seasonality bug `invoiceList` already carries a warning
 * about — plausible, and wrong west of Greenwich.
 */
export function isOnOrAfter(shipDate: string | null, today: string): boolean {
  if (!shipDate || !/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) return false;
  return shipDate >= today;
}

/** Every invoice carrying a ship date today or later, oldest first. */
export function selectFutureShipments(rows: QboShipmentRow[], today: string): QboShipmentRow[] {
  return rows
    .filter(r => isOnOrAfter(r.shipDate, today))
    .sort((a, b) => (a.shipDate! < b.shipDate! ? -1 : a.shipDate! > b.shipDate! ? 1 : a.id.localeCompare(b.id)));
}

// ─── the plan ────────────────────────────────────────────────────────────────

export interface PlannedStop {
  invoiceId: string;
  docNumber: string | null;
  deliveryDate: string;
  totalAmt: number | null;
  customerName: string | null;
  qbCustomerId: string | null;
  /** How the customer row will be reached. `null` until the writer resolves it. */
  customerType: 'person' | 'organization';
  firstName: string;
  lastName: string;
  shipTo: ShipTo;
  /** Already present in `deliveries` under this invoice id — the re-run case. Written by nobody. */
  alreadyIngested: boolean;
}

export interface BlockedStop {
  invoiceId: string;
  docNumber: string | null;
  deliveryDate: string;
  customerName: string | null;
  reason: string;
  lines: string[];
}

export interface DeliveryPlan {
  /** Invoices read, before any filtering — so "18 of 1,469" is provable on the screen. */
  invoicesRead: number;
  /** Those carrying a ship date today or later. */
  futureShipDates: number;
  stops: PlannedStop[];
  blocked: BlockedStop[];
}

/**
 * The note every ingested row carries. Provenance in the row itself, not only in `source`:
 * `source` says WHICH ingest, this says WHICH INVOICE, and Lauren reads the second one.
 */
export function deliveryNoteFor(row: QboShipmentRow): string {
  const doc = row.docNumber ? `#${row.docNumber}` : `id ${row.id}`;
  return `From QuickBooks invoice ${doc} · ship date ${row.shipDate} · ship-to address as entered in QuickBooks`;
}

/**
 * Everything the writer will do, decided before it does any of it.
 *
 * `alreadyIngestedInvoiceIds` is the set already sitting in `deliveries` — passed IN rather
 * than read here, because this file does no IO. It makes the second run of the ingest a
 * READ that reports "18 already there, 0 to write" instead of a write that has to be trusted
 * to conflict correctly.
 */
export function buildDeliveryPlan(
  rows: QboShipmentRow[],
  today: string,
  alreadyIngestedInvoiceIds: ReadonlySet<string> = new Set(),
): DeliveryPlan {
  const future = selectFutureShipments(rows, today);
  const stops: PlannedStop[] = [];
  const blocked: BlockedStop[] = [];

  for (const row of future) {
    const shipTo = parseShipTo(row.shipAddr, row.billAddr);
    if (!shipTo.ok) {
      blocked.push({
        invoiceId: row.id, docNumber: row.docNumber, deliveryDate: row.shipDate!,
        customerName: row.customerName, reason: shipTo.reason, lines: shipTo.lines,
      });
      continue;
    }
    const { first, last, isOrg } = splitDisplayName(row.customerName);
    if (!first) {
      blocked.push({
        invoiceId: row.id, docNumber: row.docNumber, deliveryDate: row.shipDate!,
        customerName: row.customerName,
        reason: 'This invoice names no customer, so the stop has nobody to belong to.',
        // The ship-to PARSED here — the refusal is about the customer — so the raw lines come
        // from the address block itself rather than from a refusal that does not exist.
        lines: addrLines(row.shipAddr),
      });
      continue;
    }
    stops.push({
      invoiceId: row.id, docNumber: row.docNumber, deliveryDate: row.shipDate!,
      totalAmt: row.totalAmt, customerName: row.customerName, qbCustomerId: row.customerId,
      customerType: isOrg ? 'organization' : 'person', firstName: first, lastName: last,
      shipTo: { ...shipTo },
      alreadyIngested: alreadyIngestedInvoiceIds.has(row.id),
    });
  }

  return { invoicesRead: rows.length, futureShipDates: future.length, stops, blocked };
}

/**
 * Resolve one planned stop against the tenant's existing customers.
 *
 * 🔴 `qb_customer_id` FIRST, AND IT IS THE ONLY KEY THAT LINKS ON ITS OWN. It is the id
 * QuickBooks itself assigned, so a match on it is not an inference. Everything after it is,
 * which is why the name path links only on a UNIQUE hit and REPORTS every collision instead
 * of merging. `customerUpsert`'s own scar is the reason: matching on a field the external
 * system permits to collide cross-billed nine real invoices (#53). Their list has 72 records
 * sharing a contact detail and most are households, not duplicates — a wrong merge is silent
 * and permanent, a flagged row costs a minute.
 */
export interface ExistingCustomer {
  id: string;
  qb_customer_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

export type CustomerVerdict =
  | { action: 'link'; customerId: string; rule: string }
  | { action: 'create'; rule: string }
  | { action: 'surface'; rule: string; reason: string };

export function resolveIngestCustomer(stop: PlannedStop, existing: ExistingCustomer[]): CustomerVerdict {
  if (stop.qbCustomerId) {
    const byQb = existing.filter(c => c.qb_customer_id === stop.qbCustomerId);
    if (byQb.length === 1) return { action: 'link', customerId: byQb[0].id, rule: 'qb_customer_id → LINK' };
    if (byQb.length > 1) {
      return {
        action: 'surface', rule: 'qb_customer_id matches more than one row → SURFACE',
        reason: `${byQb.length} customers already carry QuickBooks id ${stop.qbCustomerId}. TRACE will not guess which one this delivery belongs to.`,
      };
    }
  }
  const full = `${stop.firstName} ${stop.lastName}`.trim();
  const byName = existing.filter(c => personNamesMatch(`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(), full));
  if (byName.length === 1) return { action: 'link', customerId: byName[0].id, rule: 'unique name match → LINK' };
  if (byName.length > 1) {
    return {
      action: 'surface', rule: 'name matches more than one customer → SURFACE',
      reason: `"${full}" matches ${byName.length} existing customers. Most shared details at this business are households, not duplicates, so TRACE will not merge them.`,
    };
  }
  return { action: 'create', rule: 'no match → CREATE' };
}
