// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the CUSTOMER-SPECIFIC half of the QuickBooks read — the shape of one customer row,
//   the FIELD-COVERAGE summary, and the DUPLICATE SIZING (how many records share a phone or an
//   email with another record). The entity-agnostic machinery — query building, counting,
//   paging, completeness, capture naming, failure classification — lives in ./qboRead and is
//   SHARED with the item read (§6 r8).
// DEPENDENCIES: ./qboRead (parseRows).
// OUTPUTS: QboCustomerRow · ParsedCustomerList · parseCustomerList · CustomerBreakdown ·
//   summariseCustomers · previewCustomers · normEmail · normPhone (exported 2026-09-06 so the
//   customer IMPORT flags the same pairs this read SIZES — one normaliser, not two that drift).
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THIS FILE HANDLES A DIFFERENT KIND OF THING FROM itemList.ts AND IS BUILT DIFFERENTLY
//   BECAUSE OF IT. The item list is a product catalogue. This is roughly 1,900 REAL PEOPLE —
//   names, street addresses, phone numbers, email — belonging to a customer's customers. Three
//   rules follow, and they are structural here rather than a discipline somebody remembers:
//
//   ① THE FULL LIST IS NEVER RENDERED. `summariseCustomers` returns COUNTS, and
//      `previewCustomers` returns a hard-capped handful so the operator can see the SHAPE of a
//      record. The complete data exists only in the raw capture file. A screen that paints
//      1,900 people is a screen someone screenshots.
//   ② NOTHING IS LOGGED. No name, no address, no email, no phone reaches a console line, here
//      or in the endpoint. A serverless log is a place personal data persists for a long time
//      without anyone having decided that it should.
//   ③ NOTHING IS STORED. R-23 clause (b): persisting a customer's book of customers is a
//      SEPARATE ruling nobody has made, and a read that quietly wrote a table would make it by
//      default. The file lands in the operator's own download folder, outside version control
//      by construction (clause c).
// ══════════════════════════════════════════════════════════════════════════════

import { parseRows } from './qboRead';

/**
 * One customer, reduced to what the two questions need: field coverage, and duplicate sizing.
 *
 * The identifying values ARE carried — a duplicate cannot be found without comparing them, and
 * the preview cannot show a shape without them — but they travel only as far as the summary
 * and the capped preview. Nothing downstream iterates this array onto a screen.
 */
export interface QboCustomerRow {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  /** A one-line rendering of BillAddr/ShipAddr — present-or-not is what the coverage counts. */
  address: string | null;
  companyName: string | null;
  active: boolean | null;
  /**
   * 🔴 THE NAME IN ITS PARTS — `GivenName` / `FamilyName`, ADDED 2026-09-08, AND THEY ARE WHAT
   * MAKE THE NAME-SHAPE CENSUS POSSIBLE AT ALL. `DisplayName` collapses a person, an organisation
   * and a bookkeeping entry into one string, so *"how many of these records are actually people"*
   * cannot be asked of it. MEASURED on the 2026-09-03 capture [STATED — a prior session's figures,
   * see `booksCensus` below]: **69 records carry a given name and no family name**, 47 are pure
   * organisations, 31 hold the company name in the given-name field, and 5 have no name at all.
   *
   * ⚠️ THEY ARE PERSONAL DATA AND TRAVEL EXACTLY AS FAR AS `displayName` ALREADY DOES — into the
   * summary, into the capped preview, into a duplicate GROUP on a screen, and never into a log,
   * never into a stored row, and never onto the printed report (R-24 b/c).
   */
  givenName: string | null;
  familyName: string | null;
  /**
   * The FIRST line of the address and the POSTCODE, separately from the joined `address` string.
   *
   * 🔴 THEY ARE TWO DIFFERENT CAPABILITIES AND A JOINED STRING CANNOT TELL THEM APART. Routing a
   * truck needs a line to drive to; distance pricing needs a postcode to measure from. A record
   * with `Leander, TX` and no postcode HAS an address by the old count and can do neither.
   */
  addressLine1: string | null;
  postalCode: string | null;
  /**
   * The sales-tax paperwork, as three separate facts, because they answer three questions:
   * `taxable` says what the invoice will do, `taxExemptionReason` says WHY it was switched off,
   * and `resaleNum` is the only one of the three that is evidence somebody could show an auditor.
   * ⚠️ `taxable` is Intuit's `Taxable`, and NULL is a real state — the field is absent on records
   * that predate its use, which is not the same as `false` (D-9 / A9).
   */
  taxable: boolean | null;
  taxExemptionReason: string | null;
  resaleNum: string | null;
  /** `CustomerTypeRef` — a classification the owner's books carry. Read to find out whether
   *  anything USES it; see the written-never-read finding. */
  customerType: string | null;
  /**
   * 🔴 A BOOLEAN. `Notes` IS FREE TEXT AN OWNER TYPED ABOUT A REAL PERSON, and on these books it
   * carries gate codes, dog warnings and site instructions. Read once, tested, DROPPED — the same
   * treatment `discountInDescription` gets on an invoice line, and for the same reason: the
   * finding is *"there is operational knowledge here that no screen in the platform shows"*, and
   * that is a COUNT question. The prose never reaches this row, a screen, a log or the report.
   */
  hasNotes: boolean;
}

export interface ParsedCustomerList {
  ok: boolean;
  customers: QboCustomerRow[];
  /** Set when the body could not be read. The body itself is NEVER in here. */
  parseError: string | null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** BillAddr first, ShipAddr as fallback — either one proves the record HAS an address. */
function addressOf(row: Record<string, unknown>): string | null {
  for (const key of ['BillAddr', 'ShipAddr']) {
    const a = row[key] as Record<string, unknown> | null | undefined;
    if (!a || typeof a !== 'object') continue;
    const parts = ['Line1', 'Line2', 'City', 'CountrySubDivisionCode', 'PostalCode']
      .map(k => str(a[k]))
      .filter((s): s is string => s !== null);
    if (parts.length > 0) return parts.join(', ');
  }
  return null;
}

/**
 * One FIELD of the address, BillAddr first and ShipAddr as fallback — the same precedence
 * `addressOf` uses, so the joined string and the parts can never describe different addresses.
 *
 * ⚠️ IT DOES NOT FALL THROUGH FIELD-BY-FIELD. If `BillAddr` exists, its `PostalCode` is the
 * answer even when it is absent — reaching into `ShipAddr` for the missing half would report a
 * billing line and a shipping postcode as one address, which is a place that does not exist.
 */
function addressPart(row: Record<string, unknown>, field: string): string | null {
  for (const key of ['BillAddr', 'ShipAddr']) {
    const a = row[key] as Record<string, unknown> | null | undefined;
    if (!a || typeof a !== 'object') continue;
    return str(a[field]);
  }
  return null;
}

/**
 * Parse ONE page of Intuit's `{ QueryResponse: { Customer: [...] } }` body.
 *
 * Same contract as the item parse and for the same reason: a company with no customers is a
 * TRUE empty answer (`ok:true`, zero rows), and a body we could not read must not be able to
 * hide inside it (D-9 / A9 — absent is not empty).
 */
export function parseCustomerList(rawBody: string): ParsedCustomerList {
  const page = parseRows(rawBody, 'Customer');
  if (!page.ok) return { ok: false, customers: [], parseError: page.parseError };

  const customers: QboCustomerRow[] = [];
  for (const c of page.rows) {
    const id = str(c?.Id);
    // No Id = not addressable as a CustomerRef, same reasoning as the item parse.
    if (!id) continue;
    const email = (c?.PrimaryEmailAddr ?? null) as { Address?: unknown } | null;
    const phone = (c?.PrimaryPhone ?? null) as { FreeFormNumber?: unknown } | null;
    const mobile = (c?.Mobile ?? null) as { FreeFormNumber?: unknown } | null;
    customers.push({
      id,
      displayName: str(c?.DisplayName) ?? str(c?.CompanyName) ?? '(unnamed)',
      email: str(email?.Address),
      phone: str(phone?.FreeFormNumber) ?? str(mobile?.FreeFormNumber),
      address: addressOf(c),
      companyName: str(c?.CompanyName),
      active: typeof c?.Active === 'boolean' ? (c.Active as boolean) : null,
      givenName: str(c?.GivenName),
      familyName: str(c?.FamilyName),
      addressLine1: addressPart(c, 'Line1'),
      postalCode: addressPart(c, 'PostalCode'),
      taxable: typeof c?.Taxable === 'boolean' ? (c.Taxable as boolean) : null,
      // Intuit returns an exemption REASON as a code on `TaxExemptionReasonId`. It is kept as the
      // string it arrived as and never translated: inventing a label for somebody else's code is
      // the retro-classification R-50 forbids, and the finding only needs present-or-absent.
      taxExemptionReason: str(c?.TaxExemptionReasonId),
      resaleNum: str(c?.ResaleNum),
      customerType: str((c?.CustomerTypeRef as { name?: unknown; value?: unknown } | null)?.name)
                 ?? str((c?.CustomerTypeRef as { name?: unknown; value?: unknown } | null)?.value),
      // Read, tested, discarded — the prose never reaches the returned row. See the field.
      hasNotes: str(c?.Notes) !== null,
    });
  }
  return { ok: true, customers, parseError: null };
}

/**
 * Compare emails case-insensitively. `Terry@LAWNS.com` and `terry@lawns.com` are one mailbox,
 * and a resolver that treats them as two people would mint the duplicate it exists to prevent
 * — which is D-47's own history (email-alone matching cross-billed nine real invoices).
 */
export function normEmail(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return s === '' ? null : s;
}

/**
 * Compare phones on DIGITS, keeping the last 10 (North American significant digits), so
 * `(512) 456-3632`, `512-456-3632` and `+1 5124563632` are one number.
 *
 * 🔴 A SHORT STRING IS NOT A PHONE NUMBER FOR THIS PURPOSE. Anything under 7 digits is
 * returned as null rather than compared — an extension or a fragment matching another
 * fragment would report a duplicate that is not one, and OVERSTATING the duplicate problem
 * is as misleading as missing it when the number is about to size a build.
 */
export function normPhone(v: string | null): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

export interface DuplicateTally {
  /** How many DISTINCT values are held by more than one record. */
  sharedValues: number;
  /** How many RECORDS sit on one of those values — the size of the merge problem. */
  recordsInvolved: number;
  /** The largest single cluster, so "1,900 customers, worst case 14 on one number" is sayable. */
  largestCluster: number;
}

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE CENSUS — WORDED AS CAPABILITIES, WHICH IS WHY IT IS A SEPARATE BLOCK.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * Every count here answers *"what can this business do with the records it has"*, never *"what is
 * missing from them". Campaigns and review requests run on an email or a phone; routing and
 * distance pricing need an address WITH a postcode. So the numbers are grouped by the capability
 * they switch on, and the finding that reads them leads with **how many are reachable**, not with
 * how many are not.
 *
 * ⚠️ `reach.withNeither` IS NOT `withNoContactAtAll` AND THE TWO WILL DISAGREE ON EVERY REAL SET.
 * `withNoContactAtAll` requires no email, no phone AND no address — a record with a street address
 * and nothing else is not in it. `reach.withNeither` is about being CONTACTABLE, so it ignores the
 * address entirely. On LAWNS that is 110 against 125 [STATED — a prior session's measurement]. Two
 * different questions; naming them the same thing is how one of them silently becomes the answer
 * to the other.
 */
export interface CustomerCensus {
  reach: {
    /** Email AND phone. */
    withBoth: number;
    /** Email OR phone — THE HEADLINE. What campaigns and review requests can run on. */
    withEither: number;
    /** Neither. Those two capabilities are switched off for these records, and nothing else is. */
    withNeither: number;
    emailOnly: number;
    phoneOnly: number;
    /** A first line to drive a truck to. */
    withAddressLine1: number;
    /** A line AND a postcode — what distance pricing needs. */
    withPostalCode: number;
    /** Has a line, has no postcode. Routable, not measurable. */
    addressWithoutPostalCode: number;
    withoutAddress: number;
  };
  /**
   * 🔴 WHAT SHAPE ARE THESE RECORDS. A customer list is not a list of people — it is a list of
   * people, companies, one-name entries and, on these books, a row called `Deposit`.
   */
  names: {
    /** A given name and NO family name. A mononym, or half a name somebody meant to finish. */
    givenNameOnly: number;
    /** `CompanyName` EQUALS `GivenName` — the company typed into the person field. */
    companyEqualsGivenName: number;
    /** A company name and no person parts at all: an organisation, unambiguously. */
    pureOrganisations: number;
    /** No given name, no family name, no company name. Not a party we could address. */
    noNameAtAll: number;
  };
  /** Classification and paperwork the books carry, counted to find out whether anything uses it. */
  paperwork: {
    nonTaxable: number;
    withExemptionReason: number;
    /** The only one of the three an auditor would accept as evidence. */
    withResaleNumber: number;
    withCustomerType: number;
    withNotes: number;
  };
}

export interface CustomerBreakdown {
  total: number;
  withEmail: number;
  withPhone: number;
  withAddress: number;
  withCompanyName: number;
  /** Carries NONE of email/phone/address — unreachable, and a resolver cannot match on it. */
  withNoContactAtAll: number;
  inactive: number;
  byEmail: DuplicateTally;
  byPhone: DuplicateTally;
  /** See `CustomerCensus`. Added 2026-09-08; every field is a capability, never a fault. */
  census: CustomerCensus;
}

function tally(values: (string | null)[]): DuplicateTally {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let sharedValues = 0, recordsInvolved = 0, largestCluster = 0;
  for (const n of counts.values()) {
    if (n > 1) { sharedValues++; recordsInvolved += n; }
    if (n > largestCluster) largestCluster = n;
  }
  // A list where every value is unique has a largest cluster of 1, which is true and useful;
  // an EMPTY list has no cluster at all and reports 0 rather than a fabricated 1.
  return { sharedValues, recordsInvolved, largestCluster };
}

/**
 * Field coverage and duplicate sizing — the two facts that decide whether a customer import is
 * a small job or a project, SIZED BEFORE anyone designs the resolver for it.
 *
 * 🔴 COUNTS ONLY. Nothing this returns names a person. It is what the screen renders.
 */
export function summariseCustomers(customers: QboCustomerRow[]): CustomerBreakdown {
  let withEmail = 0, withPhone = 0, withAddress = 0, withCompanyName = 0, withNoContactAtAll = 0, inactive = 0;
  let withBoth = 0, withEither = 0, withNeither = 0, emailOnly = 0, phoneOnly = 0;
  let withAddressLine1 = 0, withPostalCode = 0, addressWithoutPostalCode = 0, withoutAddress = 0;
  let givenNameOnly = 0, companyEqualsGivenName = 0, pureOrganisations = 0, noNameAtAll = 0;
  let nonTaxable = 0, withExemptionReason = 0, withResaleNumber = 0, withCustomerType = 0, withNotes = 0;

  for (const c of customers) {
    if (c.email) withEmail++;
    if (c.phone) withPhone++;
    if (c.address) withAddress++;
    if (c.companyName) withCompanyName++;
    if (!c.email && !c.phone && !c.address) withNoContactAtAll++;
    if (c.active === false) inactive++;

    // ── reach: what campaigns, review requests, routing and distance pricing can run on ──
    const e = !!c.email, p = !!c.phone;
    if (e && p) withBoth++;
    if (e || p) withEither++; else withNeither++;
    if (e && !p) emailOnly++;
    if (p && !e) phoneOnly++;
    const line1 = !!c.addressLine1, zip = !!c.postalCode;
    if (line1) withAddressLine1++;
    if (line1 && zip) withPostalCode++;
    if (line1 && !zip) addressWithoutPostalCode++;
    if (!line1) withoutAddress++;

    // ── shape: is this a person, a company, half a name, or nothing we could address ──
    // 🔴 THE FOUR ARE NOT MUTUALLY EXCLUSIVE AND ARE NOT MEANT TO BE. A record can be a pure
    // organisation and hold a company name in its given-name field on another books' data; each
    // count answers its own question over the whole population, and a reader is given the
    // denominator every time. Forcing them into one partition would require deciding which shape
    // a record "really" is, which is an inference about somebody else's records (R-50).
    const g = !!c.givenName, f = !!c.familyName, co = !!c.companyName;
    if (g && !f) givenNameOnly++;
    if (co && g && c.companyName === c.givenName) companyEqualsGivenName++;
    if (co && !g && !f) pureOrganisations++;
    if (!g && !f && !co) noNameAtAll++;

    // ── paperwork: what the books already classify, and whether anything backs it up ──
    if (c.taxable === false) nonTaxable++;
    if (c.taxExemptionReason) withExemptionReason++;
    if (c.resaleNum) withResaleNumber++;
    if (c.customerType) withCustomerType++;
    if (c.hasNotes) withNotes++;
  }

  return {
    total: customers.length,
    withEmail, withPhone, withAddress, withCompanyName, withNoContactAtAll, inactive,
    byEmail: tally(customers.map(c => normEmail(c.email))),
    byPhone: tally(customers.map(c => normPhone(c.phone))),
    census: {
      reach: { withBoth, withEither, withNeither, emailOnly, phoneOnly,
               withAddressLine1, withPostalCode, addressWithoutPostalCode, withoutAddress },
      names: { givenNameOnly, companyEqualsGivenName, pureOrganisations, noNameAtAll },
      paperwork: { nonTaxable, withExemptionReason, withResaleNumber, withCustomerType, withNotes },
    },
  };
}

/** The hard cap. Five rows show a shape; a hundred is a list, and a list is the thing we are not doing. */
export const CUSTOMER_PREVIEW_LIMIT = 5;

/**
 * The first few records so the operator can see what a customer record actually LOOKS like —
 * which fields Lauren's books fill in and which they leave blank.
 *
 * 🔴 THE CAP IS ENFORCED HERE, NOT AT THE CALL SITE. A limit that lives in the caller is a
 * limit one future caller forgets, and the failure mode is 1,900 people painted on a screen.
 * `limit` can only ever narrow it.
 */
export function previewCustomers(customers: QboCustomerRow[], limit = CUSTOMER_PREVIEW_LIMIT): QboCustomerRow[] {
  const n = Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : CUSTOMER_PREVIEW_LIMIT;
  return customers.slice(0, Math.min(n, CUSTOMER_PREVIEW_LIMIT));
}
