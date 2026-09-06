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
  for (const c of customers) {
    if (c.email) withEmail++;
    if (c.phone) withPhone++;
    if (c.address) withAddress++;
    if (c.companyName) withCompanyName++;
    if (!c.email && !c.phone && !c.address) withNoContactAtAll++;
    if (c.active === false) inactive++;
  }
  return {
    total: customers.length,
    withEmail, withPhone, withAddress, withCompanyName, withNoContactAtAll, inactive,
    byEmail: tally(customers.map(c => normEmail(c.email))),
    byPhone: tally(customers.map(c => normPhone(c.phone))),
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
