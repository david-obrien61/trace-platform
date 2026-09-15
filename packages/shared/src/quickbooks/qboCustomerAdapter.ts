// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: every DECISION the customer import makes, with no IO in the file. Turns the verbatim
//   `select * from Customer` bodies into rows shaped like the `customers` table, decides person
//   vs organization, carries the tax-exemption flag with its raw reason, and FLAGS the records
//   that share an email or a phone. Nothing here writes, reads a clock, or touches a client —
//   so every rule below is provable at a desk (`qboCustomerAdapter.test.ts`).
// DEPENDENCIES: ./customerList (normEmail · normPhone — the SAME normalisers the read's duplicate
//   SIZING uses, so the flagged pairs and the reported counts cannot disagree) · ./importFieldAudit
//   (classifyValueShape — the SAME classifier the import preview panel ships, so the panel and the
//   importer cannot disagree about whether a value looks like a street or a phone number).
// OUTPUTS: CUSTOMER_IMPORT_SOURCE · REASON_NOT_IDENTIFIED · ADDRESS_BRANCH_REASON ·
//   AdaptedCustomer · DuplicateFlag · CustomerAdaptation · AddressBranch ·
//   AddressResolutionTally · ResolvedBillingAddress · parseCustomerRecords · heldPhoneOf ·
//   resolveBillingAddress · adaptCustomerWithAddress · adaptCustomers · flagDuplicates.
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
import { auditImportFields, classifyValueShape, type ImportFieldAudit } from './importFieldAudit';

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
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  email: string | null;
  phone: string | null;
  // ✏️ RENAMED FROM `address_line1`/`city`/`state`/`zip` (ledger #335). Those four columns are
  // DROPPED from `customers`; `billing_*` is the derived view of the address list.
  billing_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
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
  /**
   * 🔴 THE TWO FIELD CHECKS, OVER THE RAW RECORDS — a source field carrying data that lands
   * nowhere, and a destination column holding values of the wrong shape. Computed HERE because
   * this is the last place that still holds the raw records; every layer above it has only the
   * adapted rows, and the whole point is what QuickBooks SENT rather than what we kept.
   *
   * ⚠️ It carries counts and MASKED examples only, so it is safe to put on a wire and on a screen
   * beside ~1,900 real people (`maskExample` — every letter `x`, every digit past the third `•`).
   */
  fieldAudit: ImportFieldAudit;
  /**
   * 🔴 WHERE EACH RECORD'S STREET CAME FROM — the per-record address branch, tallied.
   *
   * ⚠️ The five BRANCH counts are a PARTITION and sum to `customers.length`; a reader can check
   * the arithmetic without trusting this comment. `phoneRescued` is a CROSS-CUT, not a sixth
   * branch — it counts records inside `line2Street`/`noStreet` whose `Line1` phone was carried
   * into an empty `customers.phone`, so it does NOT belong in that sum.
   *
   * 🔴 `phoneWouldBeLost` IS THE NUMBER THAT NEEDS A RULING, and it is reported rather than
   * quietly absorbed: those records have a street one line down that we did NOT take, because
   * taking it would delete a phone number held nowhere else. Zero is a real and good answer here.
   */
  addressResolution: AddressResolutionTally;
}

/** The branch tally. One entry per `AddressBranch`, plus the cross-cut. */
export interface AddressResolutionTally {
  /** ① `Line1` was already a street. Untouched by this rule. */
  line1Street: number;
  /** ③ The street was recovered from `Line2` because `Line1` held a phone. */
  line2Street: number;
  /** ④ `Line1` held a phone and there was no `Line2` — imported blank, nothing invented. */
  noStreet: number;
  /** ⑤ A shape pair this rule does not reason about. Left exactly as today. */
  unchanged: number;
  /** The collision: a street in `Line2` NOT taken, because it would have cost a phone number. */
  phoneWouldBeLost: number;
  /** CROSS-CUT — records whose `Line1` phone was carried into an otherwise-empty `phone`. */
  phoneRescued: number;
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

// ═════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHICH `BillAddr` LINE HOLDS THE STREET IS DECIDED PER RECORD, FROM THE SHAPE OF THE VALUE.
// ═════════════════════════════════════════════════════════════════════════════════════
// LAWNS types a PHONE NUMBER into `BillAddr.Line1` and the street into `Line2`, on about a
// quarter of the book — and the importer wrote `Line1` straight into the street column, so a
// quarter of the customers arrived with a phone number where their street belongs.
//
// MEASURED against the complete 2026-09-10 capture (1,959 of 1,959, `complete: true`), each
// line classified by `classifyValueShape` — the SAME classifier the import preview panel ships,
// so the panel and this writer cannot disagree about what a value looks like:
//
//     Line1 street                962      Line2 street   462
//     Line1 phone                 484      Line2 phone      9
//     Line1 absent                499      Line2 absent 1,482
//     Line1 other/postcode/word    14      Line2 other/word 6
//
// 🔴 A BLANKET "LINE2 IS THE STREET" RULE IS WRONG IN BOTH DIRECTIONS AND THE DATA SAYS SO:
// it would overwrite a correct street with a PHONE on the 6 records shaped `street | phone`,
// and NULL the street on 953 records whose `Line1` is a street and whose `Line2` is empty.
// So the branch is chosen per record, from the pair of shapes, and never from a global rule.
//
// ═════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE PHONE IN `Line1` IS KEPT. IT IS THERE ON PURPOSE — IT PRINTS ON THE INVOICE.
// ═════════════════════════════════════════════════════════════════════════════════════
// Today the number survives by accident, in the wrong column. Taking the street stops that, so
// the resolver asks where the number GOES before it moves anything. MEASURED, same capture, of
// the 484 records whose `Line1` reads as a phone:
//
//     474  the SAME number is already in `PrimaryPhone`/`Mobile` → already kept, nothing to do
//       4  NO `PrimaryPhone` and NO `Mobile` at all → `customers.phone` is FREE, the number lands there
//       5  a DIFFERENT number is in `PrimaryPhone` → a genuine SECOND line, and there is nowhere to put it
//
// 🔴 THOSE LAST 5 ARE THE ONE PLACE THE TWO RULES COLLIDE, AND THE PHONE WINS. `customers` has
// ONE phone column; keeping both numbers needs a second one, which is a MIGRATION and is out of
// scope for this pass. So those records are left EXACTLY as they are today — phone still in
// the street column — and COUNTED as `phoneWouldBeLost`, because recovering 5 streets by deleting
// 5 phone numbers we hold nowhere else is not a repair. They are a ruling, not a default.
//
// ⚠️ THE PHONE IS NEVER OVERWRITTEN. The `Line1` number is written to `customers.phone` ONLY
// when that column would otherwise be null. A `PrimaryPhone` that already exists always wins —
// it is the field QuickBooks means as the phone, and this one is a number typed into an address.
//
// ⚠️ NOTHING IS INVENTED. A record with a phone in `Line1` and no `Line2` has NO STREET, and it
// imports BLANK rather than carrying a phone number in a street column (D-9 — an absent value
// must not read as a present one). 27 records, measured.

/**
 * Which branch the per-record rule took. Carried so the counts on the import report are the
 * decision itself rather than a second derivation of it.
 */
export type AddressBranch =
  /** `Line1` already reads as a street. Used as-is — 962 records. */
  | 'line1-street'
  /** `Line1` is a phone and `Line2` is the street. The street is recovered — 453 records. */
  | 'line2-street'
  /** `Line1` is a phone and there is no `Line2`. No street exists; imports blank — 27 records. */
  | 'no-street'
  /** Taking the street would discard a phone held nowhere else. Left exactly as today — 5 records. */
  | 'phone-would-be-lost'
  /** Every other shape pair. Left exactly as today, and counted — 517 records. */
  | 'unchanged';

/** One sentence per branch, for a report that has to explain itself to Lauren rather than to us. */
export const ADDRESS_BRANCH_REASON: Record<AddressBranch, string> = {
  'line1-street':       'the first address line is a street, and was used as it stands',
  'line2-street':       'the first address line is a phone number and the second is the street — the street was taken from the second line',
  'no-street':          'the only address line is a phone number, so this customer has no street on file — imported blank rather than guessed',
  'phone-would-be-lost': 'the second line is a street, but the first line holds a phone number we hold nowhere else — left unchanged so the number is not lost',
  'unchanged':          'the address lines do not match any known shape — left exactly as the previous import left them',
};

/**
 * Branch → the tally field it increments.
 *
 * ⚠️ DECLARED AS A TOTAL `Record`, so adding a branch to `AddressBranch` without giving it a
 * counter FAILS TO COMPILE rather than silently going uncounted. A tally that quietly loses a
 * category is exactly the shape of finding this build exists to fix.
 */
const BRANCH_TALLY_KEY: Record<AddressBranch, keyof Omit<AddressResolutionTally, 'phoneRescued'>> = {
  'line1-street': 'line1Street',
  'line2-street': 'line2Street',
  'no-street': 'noStreet',
  'phone-would-be-lost': 'phoneWouldBeLost',
  'unchanged': 'unchanged',
};

/**
 * The phone this record would land in `customers.phone` WITHOUT reading the address at all.
 *
 * Extracted so the resolver and `adaptCustomer` ask the same question once. `PrimaryPhone` first,
 * `Mobile` second — the order the adapter has always used.
 */
export function heldPhoneOf(raw: Record<string, unknown>): string | null {
  const phone = (raw.PrimaryPhone ?? null) as { FreeFormNumber?: unknown } | null;
  const mobile = (raw.Mobile ?? null) as { FreeFormNumber?: unknown } | null;
  return str(phone?.FreeFormNumber) ?? str(mobile?.FreeFormNumber);
}

export interface ResolvedBillingAddress {
  billing_line1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  /**
   * The `Line1` phone, when it must be carried into `customers.phone` to survive. NULL whenever
   * the number is already held — which is the common case, 474 of 484.
   */
  phone_from_line1: string | null;
  branch: AddressBranch;
}

/**
 * BillAddr is the billing home; ShipAddr is a job site and is NOT a billing address.
 *
 * Pure: the raw `BillAddr` plus the phone the record would otherwise carry, in — the resolved
 * address and the branch taken, out. No IO, no clock, so every rule above is provable at a desk.
 *
 * ⚠️ `Line2` is still NOT folded into `billing_line1` when `Line1` is a street. `customers` has
 * `billing_line2` and the party editor owns it; concatenating here would make this writer
 * disagree with that one. `Line2` is READ to decide which line is the street, never appended.
 */
export function resolveBillingAddress(raw: Record<string, unknown>, heldPhone: string | null): ResolvedBillingAddress {
  const a = (raw.BillAddr ?? null) as Record<string, unknown> | null;
  if (!a || typeof a !== 'object') {
    return { billing_line1: null, billing_city: null, billing_state: null, billing_zip: null, phone_from_line1: null, branch: 'unchanged' };
  }
  const rest = { billing_city: str(a.City), billing_state: str(a.CountrySubDivisionCode), billing_zip: str(a.PostalCode) };
  const line1 = str(a.Line1), line2 = str(a.Line2);
  // `classifyValueShape` answers 'other' for a value it cannot place, and 'other' is never a
  // verdict — an unrecognised line falls through to `unchanged`, which is today's behaviour.
  const s1 = line1 === null ? 'absent' : classifyValueShape(line1);
  const s2 = line2 === null ? 'absent' : classifyValueShape(line2);

  // ① The first line is a street. Nothing to repair. 962 records.
  if (s1 === 'street') return { ...rest, billing_line1: line1, phone_from_line1: null, branch: 'line1-street' };

  if (s1 === 'phone') {
    // Does the number in `Line1` survive if we stop writing it into the street column?
    // It survives when nothing else holds it (the free column takes it) or when the SAME number
    // is already held. It does NOT survive when a DIFFERENT number occupies the one phone column.
    const rescue = heldPhone === null ? line1 : null;
    const survives = heldPhone === null || normPhone(heldPhone) === normPhone(line1);

    // ③ The first line is a phone and the second is the street. 453 records.
    if (s2 === 'street') {
      if (!survives) return { ...rest, billing_line1: line1, phone_from_line1: null, branch: 'phone-would-be-lost' };
      return { ...rest, billing_line1: line2, phone_from_line1: rescue, branch: 'line2-street' };
    }
    // ④ The first line is a phone and there is no second line. There is NO STREET here. 27 records.
    if (s2 === 'absent') {
      if (!survives) return { ...rest, billing_line1: line1, phone_from_line1: null, branch: 'phone-would-be-lost' };
      return { ...rest, billing_line1: null, phone_from_line1: rescue, branch: 'no-street' };
    }
  }

  // ⑤ Anything else — including `phone | phone`, `other | street`, `street | phone` — is left
  // EXACTLY as the previous import left it, and counted. A shape we have not reasoned about is
  // not a shape we know how to repair.
  return { ...rest, billing_line1: line1, phone_from_line1: null, branch: 'unchanged' };
}

/**
 * One raw QuickBooks record → one row shaped like `customers`, WITH the address branch it took.
 *
 * 🔴 THE BRANCH IS RETURNED, NOT RE-DERIVED. The counts on the import report come from this
 * value, so the number on the screen is the decision that was actually made rather than a second
 * evaluation that could drift from it ([[R-33]] — a tally that cannot disagree with the write).
 */
export function adaptCustomerWithAddress(raw: Record<string, unknown>): { customer: AdaptedCustomer; branch: AddressBranch; phoneRescued: boolean } | null {
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
  // The phone this record carries on its own, before the address is read at all.
  const heldPhone = heldPhoneOf(raw);
  const billing = resolveBillingAddress(raw, heldPhone);
  return {
   customer: {
    qb_customer_id: id,
    display_name: displayName,
    customer_type: type,
    // ══════════════════════════════════════════════════════════════════════════════════════
    // ✏️ CHANGED 2026-09-07 BY LEDGER #277's SESSION, UNDER DAVID'S EXPLICIT RULING. NOT MY FILE —
    //    flagged here in full so this session sees exactly what moved and why (R-62).
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 DAVID, 2026-09-07: *"FOR AN ORGANIZATION: customer_type = 'organization', organization_name
    //    = the name, display_name = the name, first_name = NULL, last_name = NULL."*
    //
    // ⚠️ THE PRIOR COMMENT HERE — preserved because its reasoning was sound and only its PREMISE
    //    was overruled — said `first_name` carries the display name for an organization *"matching
    //    the three organization rows already in LAWNS (all three have `first_name` set and
    //    `organization_name` NULL)"*. **David has now ruled those three rows WRONG**: they carry the
    //    company name in `first_name` with `organization_name` and `display_name` both NULL, and he
    //    is leaving them alone only because two are vendor-invoice residue with a separate cleanup
    //    owed. Matching them would have baked the defect into 1,934 more rows.
    //
    // 🔴 THE REST OF THIS ADAPTER WAS ALREADY CORRECT AND IS UNTOUCHED — `display_name`,
    //    `customer_type`, `organization_name`, and `last_name: null` for an organization or for a
    //    person with no FamilyName. **It was the SCHEMA that was wrong**: `customers.last_name` was
    //    NOT NULL and refused the honest value, which is what killed the import on row 0.
    //    `20260907_customers_last_name_nullable.sql` fixes that.
    first_name: type === 'organization' ? null : (givenName ?? displayName),
    last_name: type === 'organization' ? null : str(raw.FamilyName),
    organization_name: companyName,
    email: str(email?.Address),
    // 🔴 THE HELD PHONE ALWAYS WINS. `phone_from_line1` is non-null ONLY when `heldPhone` was
    // null, so this can fill an empty column and can never overwrite a real `PrimaryPhone`.
    phone: heldPhone ?? billing.phone_from_line1,
    billing_line1: billing.billing_line1,
    billing_city: billing.billing_city,
    billing_state: billing.billing_state,
    billing_zip: billing.billing_zip,
    ...exemptionOf(raw),
    notes: str(raw.Notes),
   },
   branch: billing.branch,
   phoneRescued: billing.phone_from_line1 !== null,
  };
}

/**
 * One raw QuickBooks record → one row shaped like `customers`. Returns null when unusable.
 *
 * The long-standing entry point, kept because it is what every caller outside this file wants and
 * what the probes drive. It is a projection of `adaptCustomerWithAddress`, never a second
 * implementation — there is exactly one place the address decision is made.
 */
export function adaptCustomer(raw: Record<string, unknown>): AdaptedCustomer | null {
  return adaptCustomerWithAddress(raw)?.customer ?? null;
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
  // 🔴 THE RAW RECORDS ARE KEPT FOR THE FIELD AUDIT, AND THE POPULATION IS EVERY RECORD THE PAGE
  // YIELDED — including ones `adaptCustomer` then REFUSES. A field check asks what QuickBooks
  // sent; filtering it down to what we could use would hide a field from the check precisely
  // when the record carrying it was the one we could not read.
  const rawRecords: Record<string, unknown>[] = [];
  const addressResolution: AddressResolutionTally = {
    line1Street: 0, line2Street: 0, noStreet: 0, unchanged: 0, phoneWouldBeLost: 0, phoneRescued: 0,
  };
  let unparseable = 0, noId = 0, dupId = 0, retired = 0;
  for (const body of rawBodies) {
    const page = parseCustomerRecords(body);
    if (!page.ok) { unparseable++; continue; }
    for (const raw of page.rows) {
      rawRecords.push(raw);
      // 🔴 A CUSTOMER THE OWNER MADE INACTIVE IS NOT IMPORTED (#341) — pushed to `rawRecords`
      // first, so the field audit still sees every field QuickBooks sent. Until #341 the read never
      // returned one, so this preserves the import as it behaved; importing them would reopen every
      // record the owner merged or hid, and how `Active` reconciles with `customers.status` is
      // still unruled (the declaration in importFieldAudit.ts).
      if (raw.Active === false) { retired++; continue; }
      const adapted = adaptCustomerWithAddress(raw);
      if (!adapted) { noId++; continue; }
      if (seen.has(adapted.customer.qb_customer_id)) { dupId++; continue; }
      seen.add(adapted.customer.qb_customer_id);
      customers.push(adapted.customer);
      // Tallied from the SAME object that produced the row — see `adaptCustomerWithAddress`.
      addressResolution[BRANCH_TALLY_KEY[adapted.branch]]++;
      if (adapted.phoneRescued) addressResolution.phoneRescued++;
    }
  }
  const skipped: { reason: string; count: number }[] = [];
  if (unparseable) skipped.push({ reason: 'a page of the capture could not be read', count: unparseable });
  if (noId) skipped.push({ reason: 'no QuickBooks id, or no name of any kind', count: noId });
  if (dupId) skipped.push({ reason: 'the same QuickBooks id appeared twice in this capture', count: dupId });
  if (retired) skipped.push({ reason: 'made inactive in QuickBooks — not imported', count: retired });

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
    fieldAudit: auditImportFields({ records: rawRecords }),
    addressResolution,
  };
}
