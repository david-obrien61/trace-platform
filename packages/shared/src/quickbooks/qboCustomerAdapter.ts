// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: every DECISION the customer import makes, with no IO in the file. Turns the verbatim
//   `select * from Customer` bodies into rows shaped like the `customers` table, decides person
//   vs organization, carries the tax-exemption flag with its raw reason, and FLAGS the records
//   that share an email or a phone. Nothing here writes, reads a clock, or touches a client —
//   so every rule below is provable at a desk (`qboCustomerAdapter.test.ts`).
// DEPENDENCIES: ./customerList (normEmail · normPhone — the SAME normalisers the read's duplicate
//   SIZING uses, so the flagged pairs and the reported counts cannot disagree).
// OUTPUTS: CUSTOMER_IMPORT_SOURCE · REASON_NOT_IDENTIFIED · AdaptedCustomer · DuplicateFlag ·
//   CustomerAdaptation · parseCustomerRecords · adaptCustomers · flagDuplicates.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE EXEMPT FLAG COMES FROM THE CUSTOMER RECORD. IT IS NOT DERIVED FROM INVOICES.
// ══════════════════════════════════════════════════════════════════════════════════════════
// MEASURED against LAWNS's complete capture (`qbo-customers-9341455222430707-2026-09-04`, 1,946
// of 1,946, `complete: true`): `Taxable` is present on ALL 1,946 and is `false` on exactly 27,
// and every one of those 27 carries a `TaxExemptionReasonId`. No customer is one without the
// other — the crosstab has no third cell.
//
// 🔴 DERIVING IT FROM INVOICES INSTEAD FINDS 21 AND MISSES SIX. The 21 customers with an exempt
// INVOICE are a strict subset of the 27 (zero invoice-only, zero disagreements on the reason id).
// The six the invoices cannot show are exempt customers who have never yet been BILLED exempt —
// Austin Outdoor Design, Craig, Leaf Tree Services, Paul's Lawn & Landscape, Silver Drop
// Irrigation and Landscape Services LLC, The Austin Groundskeeper Inc. Import from the invoices
// and those six are charged tax on their next sale. That is the whole reason this file reads the
// customer record and never opens an invoice.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ TWO FIELDS SPELL "3" AND MEAN OPPOSITE THINGS. TAXABILITY READS OFF `Taxable`, NEVER OFF A 3.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `DefaultTaxCodeRef.value` is `"3"` on all 1,946 records INCLUDING every taxable one — it is the
// company's default tax code, not a statement about this customer. `TaxExemptionReasonId` is also
// `"3"`, on three cities, where it means an exemption reason. Reading the first as the second is
// what produced the "17 more carry a bare 3" in the recon prompt. This file never consults
// `DefaultTaxCodeRef` at all, and `exemptionOf` takes `Taxable` as the ONLY authority.
//
// ⚠️ AND THE SAME FACT HAS TWO NAMES ACROSS ENTITIES: the customer field is
// `TaxExemptionReasonId`; the invoice field is `TaxExemptionRef`. Keying the customer name
// against invoices returns 0 of 1,481 — indistinguishable from a true zero.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE FOUR READABLE REASONS ARE `ResaleNum` VALUES, SO NO INVOICE IS READ TO GET THEM.
// ══════════════════════════════════════════════════════════════════════════════════════════
// David ruled that only the four SEMANTIC labels join back — GOVT · School · Ag · City Of Liberty
// — and that the ten permit numbers are carried as values and never rendered as a reason name.
// MEASURED: all nine invoice labels are IDENTICAL to that customer's own `ResaleNum`. QuickBooks
// is echoing the customer field onto the invoice; it is not a second fact. So the join is
// unnecessary and this file does not do one.
//
// 🔴 THE TEST IS FORM, NOT MEANING, WHICH IS WHY IT IS NOT AN INTERPRETATION. A `ResaleNum`
// containing at least one letter is something a human typed as a WORD (GOVT, School, Ag,
// City Of Liberty); one containing none is a permit number (`32093937053`, `2-4629800259`,
// `#32063706967`, `#32038506344`, `17423370067`). Four have letters, five do not, and the split
// is exact on the live data. A hardcoded list of the four would be this realm's answer only.
//
// ⚠️ THE RAW REASON ID IS NEVER DROPPED. Every exempt row's reason string ends with
// `(QuickBooks reason <id>)`, labelled or not, so Lauren's cleanup can still see what the books
// actually said. Eighteen of the 27 have no `ResaleNum` at all and read "reason not identified";
// with the five permit-numbered ones that is 23 — and the certificate value is kept regardless,
// in `tax_exempt_cert_ref`.
// ─────────────────────────────────────────────────────────────────────────────
import { normEmail, normPhone } from './customerList';

/** Written to `customers.source` on every row this import creates. */
export const CUSTOMER_IMPORT_SOURCE = 'quickbooks-customers';

/**
 * The honest reading of a bare reason id. It is a SENTENCE, not an empty string and not a
 * fabricated category — D-9: an unknown must announce itself rather than read as a real value.
 */
export const REASON_NOT_IDENTIFIED = 'reason not identified';

export interface AdaptedCustomer {
  /** Intuit's `Customer.Id` — the import identity, and the upsert key. Present on all 1,946. */
  qb_customer_id: string;
  display_name: string;
  customer_type: 'person' | 'organization';
  first_name: string;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  tax_exempt: boolean;
  /** Null when the customer is taxable — a reason on a taxable row would be a contradiction. */
  tax_exempt_reason: string | null;
  /** The raw `ResaleNum`, verbatim, whether it reads as a word or a permit number. */
  tax_exempt_cert_ref: string | null;
  notes: string | null;
}

export interface DuplicateFlag {
  /** 'email' or 'phone' — WHICH value they share, so the reviewer knows what they are looking at. */
  on: 'email' | 'phone';
  /** The qb_customer_ids sharing it. Two or more, always. */
  members: string[];
  /** The display names, in the same order, so the pair is readable without a second lookup. */
  names: string[];
}

export interface CustomerAdaptation {
  customers: AdaptedCustomer[];
  /** Records the parse could not use, with the reason. Never silently dropped. */
  skipped: { reason: string; count: number }[];
  exemptCount: number;
  /** Of the exempt, how many carry a readable reason rather than "reason not identified". */
  exemptWithNamedReason: number;
  organizationCount: number;
  duplicates: DuplicateFlag[];
  /** Distinct records touched by ANY duplicate flag — the union across both keys, not a sum. */
  duplicateRecordCount: number;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * Parse ONE page of `{ QueryResponse: { Customer: [...] } }` into the RAW records.
 *
 * ⚠️ DELIBERATELY NOT `parseCustomerList`, AND THIS IS A STATED DIVERGENCE FROM §6 r8 RATHER THAN
 * AN OVERSIGHT. That parser's own header explains that its row is *"reduced to what the two
 * questions need"* — coverage counts and duplicate sizing — and that reduction is a PRIVACY
 * DESIGN for a screen that must never paint 1,900 people. It drops `Taxable`, `ResaleNum`,
 * `Notes`, and it flattens the address into one display string, so it cannot fill an address
 * column. Widening it would widen what the READ screen carries, to serve a writer. Different
 * operation, different shape; the shared half — the duplicate normalisers — IS imported.
 */
export function parseCustomerRecords(rawBody: string): { ok: boolean; rows: Record<string, unknown>[]; parseError: string | null } {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch (e: unknown) {
    return { ok: false, rows: [], parseError: e instanceof Error ? e.message : 'unparseable body' };
  }
  const q = (body as { QueryResponse?: { Customer?: unknown } } | null)?.QueryResponse;
  if (!q || typeof q !== 'object') return { ok: false, rows: [], parseError: 'no QueryResponse' };
  const list = (q as { Customer?: unknown }).Customer;
  // 🔴 A COMPANY WITH NO CUSTOMERS IS A TRUE EMPTY ANSWER, not a failure — same contract as the
  // read's parser. An absent key means zero rows; a body we could not read is `ok:false` above.
  if (list === undefined) return { ok: true, rows: [], parseError: null };
  if (!Array.isArray(list)) return { ok: false, rows: [], parseError: 'Customer is not an array' };
  return { ok: true, rows: list as Record<string, unknown>[], parseError: null };
}

/**
 * Person or organization.
 *
 * 🔴 `GivenName` IS NOT A PERSON SIGNAL AND THE DATA PROVES IT. QuickBooks splits a company name
 * into given/family: `"ABC Home and Pest Services"` arrives as Given `"ABC"`, Family
 * `"and Pest Services"`. 1,895 of 1,946 records carry a GivenName, so trusting it would call
 * almost every company a person.
 *
 * THE RULE: a record is an ORGANIZATION when it has a `CompanyName` AND that company is the
 * customer — i.e. the `DisplayName` IS the company name (513 records), or there is no personal
 * name at all (46 more). When both are present and DIFFER — `Aaron Harlan` at `Time and Space` —
 * the customer is the PERSON, who happens to work somewhere, and the company is kept in
 * `organization_name` rather than thrown away.
 *
 * ⚠️ THIS IS A STATED CHOICE, NOT A FACT QUICKBOOKS RECORDS. There is no person/organization flag
 * in the Customer entity; every importer has to decide, and deciding by DisplayName is the one
 * reading that matches what Lauren sees on her own screen.
 */
export function classifyCustomer(companyName: string | null, displayName: string, givenName: string | null): 'person' | 'organization' {
  if (!companyName) return 'person';
  if (displayName.trim().toLowerCase() === companyName.trim().toLowerCase()) return 'organization';
  if (!givenName) return 'organization';
  return 'person';
}

/** A value a human typed as a WORD has a letter in it; a permit number does not. Form, not meaning. */
export function readsAsAWord(v: string | null): boolean {
  return v !== null && /[A-Za-z]/.test(v);
}

/**
 * The exemption triple: the flag, the reason sentence, and the certificate value.
 *
 * `Taxable` is the ONLY authority on the flag. A missing `Taxable` is treated as TAXABLE — the
 * safe direction, because the failure mode of guessing wrong the other way is not charging tax
 * that is owed, which is the nursery's liability rather than an inconvenience.
 */
export function exemptionOf(raw: Record<string, unknown>): Pick<AdaptedCustomer, 'tax_exempt' | 'tax_exempt_reason' | 'tax_exempt_cert_ref'> {
  const taxable = raw.Taxable;
  const exempt = taxable === false;
  const cert = str(raw.ResaleNum);
  if (!exempt) {
    // A reason or a certificate on a TAXABLE row would assert an exemption that is not claimed.
    return { tax_exempt: false, tax_exempt_reason: null, tax_exempt_cert_ref: null };
  }
  const reasonId = str(raw.TaxExemptionReasonId);
  const label = readsAsAWord(cert) ? cert : REASON_NOT_IDENTIFIED;
  // The raw id ALWAYS rides along, labelled or not — it is what Lauren's cleanup works from.
  const reason = reasonId ? `${label} (QuickBooks reason ${reasonId})` : label;
  return { tax_exempt: true, tax_exempt_reason: reason, tax_exempt_cert_ref: cert };
}

/** BillAddr is the billing home; ShipAddr is a job site and is NOT a billing address. */
function billingOf(raw: Record<string, unknown>) {
  const a = (raw.BillAddr ?? null) as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') return { address_line1: null, city: null, state: null, zip: null };
  // ⚠️ Line2 is deliberately NOT folded into line1 — `customers` has `billing_line2` and the
  // party editor owns it; concatenating here would make this writer disagree with that one.
  return {
    address_line1: str(a.Line1),
    city: str(a.City),
    state: str(a.CountrySubDivisionCode),
    zip: str(a.PostalCode),
  };
}

/** One raw QuickBooks record → one row shaped like `customers`. Returns null when unusable. */
export function adaptCustomer(raw: Record<string, unknown>): AdaptedCustomer | null {
  const id = str(raw.Id);
  // No Id = not addressable as an upsert key. There is no second identity to fall back to.
  if (!id) return null;
  const displayName = str(raw.DisplayName) ?? str(raw.CompanyName) ?? str(raw.FullyQualifiedName);
  // A record with no name at all cannot be shown to anyone, and a fabricated "(unnamed)" in a
  // WRITE would put a placeholder in a real company's customer list. The read may render one;
  // the import refuses the row and counts it.
  if (!displayName) return null;
  const companyName = str(raw.CompanyName);
  const givenName = str(raw.GivenName);
  const type = classifyCustomer(companyName, displayName, givenName);
  const email = (raw.PrimaryEmailAddr ?? null) as { Address?: unknown } | null;
  const phone = (raw.PrimaryPhone ?? null) as { FreeFormNumber?: unknown } | null;
  const mobile = (raw.Mobile ?? null) as { FreeFormNumber?: unknown } | null;
  return {
    qb_customer_id: id,
    display_name: displayName,
    customer_type: type,
    // 🔴 `first_name` CARRIES THE DISPLAY NAME FOR AN ORGANIZATION, matching the three
    // organization rows already in LAWNS (all three have `first_name` set and
    // `organization_name` NULL). A company has no given name, and leaving the column empty
    // would blank the field every existing surface reads to label a customer.
    first_name: type === 'organization' ? displayName : (givenName ?? displayName),
    last_name: type === 'organization' ? null : str(raw.FamilyName),
    organization_name: companyName,
    email: str(email?.Address),
    phone: str(phone?.FreeFormNumber) ?? str(mobile?.FreeFormNumber),
    ...billingOf(raw),
    ...exemptionOf(raw),
    notes: str(raw.Notes),
  };
}

/**
 * Records that share an email or a phone — FLAGGED, NEVER MERGED (David, 2026-09-06).
 *
 * 🔴 MOST OF THESE ARE NOT DUPLICATES AND MERGING THEM WOULD DESTROY REAL RECORDS. A company and
 * its owner share a mailbox (Heller Landscapes Inc. / Ronnie Heller; ATX Property Management /
 * Brandon Diggs) — that is the one-person-many-accounts model, not a duplicate. Preston Culver
 * and Elisa Mesa share an email because they live together. Rick Rowen / Rick Rowell is a genuine
 * typo. Three different situations behind one signal, and only a human can tell them apart.
 *
 * ⚠️ AND MERGING IS BLOCKED BY THE SCHEMA ANYWAY, WHICH IS THE STRUCTURAL REASON RATHER THAN THE
 * editorial one: `customers.qb_customer_id` is SINGLE-VALUED, so collapsing two QuickBooks
 * customers onto one local row destroys the id the next import arrives on, and the row would be
 * re-created on the following run. Merge waits on a `customer_qb_links` join table.
 */
export function flagDuplicates(customers: AdaptedCustomer[]): DuplicateFlag[] {
  const flags: DuplicateFlag[] = [];
  const keyed: { on: 'email' | 'phone'; norm: (c: AdaptedCustomer) => string | null }[] = [
    { on: 'email', norm: c => normEmail(c.email) },
    { on: 'phone', norm: c => normPhone(c.phone) },
  ];
  for (const { on, norm } of keyed) {
    const groups = new Map<string, AdaptedCustomer[]>();
    for (const c of customers) {
      const k = norm(c);
      if (k === null) continue;
      const g = groups.get(k);
      if (g) g.push(c); else groups.set(k, [c]);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      flags.push({ on, members: g.map(c => c.qb_customer_id), names: g.map(c => c.display_name) });
    }
  }
  return flags;
}

/**
 * Every page of a verified capture → the rows to write, plus the counts that describe them.
 *
 * 🔴 A DUPLICATE `qb_customer_id` INSIDE ONE CAPTURE IS DROPPED AND COUNTED, not carried to the
 * writer. The upsert key is `(business_id, qb_customer_id)` and a payload holding the same id
 * twice makes Postgres reject the WHOLE batch — *"ON CONFLICT DO UPDATE command cannot affect row
 * a second time"* — so one impossible record would fail an otherwise good import of 1,945 others.
 * QuickBooks does not emit duplicate ids (1,946 records, 1,946 distinct, measured), so this is a
 * guard against a malformed or double-appended capture file rather than against Intuit.
 */
export function adaptCustomers(rawBodies: string[]): CustomerAdaptation {
  const customers: AdaptedCustomer[] = [];
  const seen = new Set<string>();
  let unparseable = 0, noId = 0, dupId = 0;
  for (const body of rawBodies) {
    const page = parseCustomerRecords(body);
    if (!page.ok) { unparseable++; continue; }
    for (const raw of page.rows) {
      const adapted = adaptCustomer(raw);
      if (!adapted) { noId++; continue; }
      if (seen.has(adapted.qb_customer_id)) { dupId++; continue; }
      seen.add(adapted.qb_customer_id);
      customers.push(adapted);
    }
  }
  const skipped: { reason: string; count: number }[] = [];
  if (unparseable) skipped.push({ reason: 'a page of the capture could not be read', count: unparseable });
  if (noId) skipped.push({ reason: 'no QuickBooks id, or no name of any kind', count: noId });
  if (dupId) skipped.push({ reason: 'the same QuickBooks id appeared twice in this capture', count: dupId });

  const duplicates = flagDuplicates(customers);
  const touched = new Set<string>();
  for (const f of duplicates) for (const m of f.members) touched.add(m);

  return {
    customers,
    skipped,
    exemptCount: customers.filter(c => c.tax_exempt).length,
    exemptWithNamedReason: customers.filter(c => c.tax_exempt && c.tax_exempt_reason !== null
      && !c.tax_exempt_reason.startsWith(REASON_NOT_IDENTIFIED)).length,
    organizationCount: customers.filter(c => c.customer_type === 'organization').length,
    duplicates,
    // 🔴 THE UNION, NOT THE SUM. 25 shared emails (50 records) plus 27 shared phones (54) is not
    // 104 people — the sets overlap and the honest number is 72. Reporting the sum would overstate
    // the review Lauren is being asked to do by nearly half.
    duplicateRecordCount: touched.size,
  };
}
