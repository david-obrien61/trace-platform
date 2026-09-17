// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the two arithmetic checks the customer import preview runs over the RAW QuickBooks
//   records, before anything is written. ① a SOURCE FIELD that carries data and is mapped to
//   nothing. ② a DESTINATION COLUMN whose values do not look like what that column holds.
//   Pure — no IO, no clock, no client — so every rule below is provable at a desk.
// DEPENDENCIES: none. Deliberately: this file must be runnable against a fixture with nothing
//   mocked, because it is the thing that decides whether an import is safe to press.
// OUTPUTS: CUSTOMER_FIELD_MAP · CUSTOMER_IGNORED_SOURCE_FIELDS · EXPECTED_COLUMN_SHAPE ·
//   flattenPaths · classifyValueShape · maskExample · auditImportFields · ImportFieldAudit.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS: 486 PHONE NUMBERS ARE SITTING IN A STREET COLUMN AND EVERY NUMBER ON THE
//    PREVIEW SCREEN WAS CORRECT.
// ══════════════════════════════════════════════════════════════════════════════════════════
// MEASURED at LAWNS, 2026-09-11: **486 customers carry a PHONE in `BillAddr.Line1`**, and **458
// carry the real street in `BillAddr.Line2`** — a field the importer does not read at all. The
// preview reported `toCreate`, `toReconcile` and `existingCustomers`, all three of them right,
// and said nothing. **A stop addressed to a phone number cannot go on a truck.**
//
// 🔴 THE PHONE IS IN LINE1 ON PURPOSE AND MUST NOT BE SWAPPED OR DISCARDED. It prints on the
// invoice. The platform needs the STREET for routing and the PHONE for the invoice, from two
// different lines. It is mechanical rather than accidental: 477 of 481 carry the identical phone
// in BOTH address blocks and 469 match `PrimaryPhone`.
//
// ⚠️ AND THE OBVIOUS FIX IS A LARGER DATA-LOSS EVENT THAN THE DEFECT. `address_line1 = Line2`
// would give the **1,473 whose Line1 is already a real street** their suite number instead — and
// the **28 with no Line2 at all** a NULL. This file does not repair anything. It COUNTS, so the
// two populations are visible on screen before anyone writes a remap.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 NEITHER CHECK MAY BE SILENT WHEN IT FINDS NOTHING (David's instruction, and it is the one
//    clause that shapes the return type).
// ══════════════════════════════════════════════════════════════════════════════════════════
// `headline` is NEVER null and never empty. A preview showing no warnings says *"checked 1,946
// records across 41 fields — nothing to report"*, because **a blank panel is indistinguishable
// from a check that did not run.** That is D-9 applied to our own confidence, and it is why
// `ran` is a literal `true` on the type rather than a boolean somebody could forget to set.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ THE POPULATION IS DERIVED FROM THE DATA; ONLY THE *MAPPING* IS DECLARED.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Check ① does NOT compare against a hand-written list of every QuickBooks field — that list
// would rot the first time Intuit added one, and a field nobody declared would be INVISIBLE
// rather than flagged. The source fields are discovered by walking the records themselves, so a
// field we have never heard of shows up the first time a record carries it. The only declaration
// is which paths are MAPPED and which are deliberately IGNORED, and both are asserted against
// the adapter's real behaviour in `importFieldAudit.test.ts` (§A/§B).
//
// This matters because of tech-debt **#182**: a scanner that reports a count it never states an
// expectation for cannot fail. Here the expectation is stated in both directions — a mapped path
// that NO record carries is reported too (`mappedButAbsent`), which is what catches Intuit
// renaming a field and the import silently writing nulls.
// ─────────────────────────────────────────────────────────────────────────────

/** What a value LOOKS like. Form, not meaning — the same discipline as `readsAsAWord`. */
export type ValueShape = 'phone' | 'email' | 'postcode' | 'street' | 'wordlike' | 'other';

/** One declared source→destination mapping. */
export interface FieldMapEntry {
  /** Dot path into the raw QuickBooks record, e.g. `BillAddr.Line1`. */
  path: string;
  /** The `customers` column it lands in — the CANONICAL one. */
  column: string;
  /**
   * 🔴 THE MIRROR COLUMNS, DECLARED — an R-110 guard rather than bookkeeping: a source value
   * written into TWO columns must be counted ONCE, or the surface asserts a number it did not get
   * from the operation it describes (counting both reported 916 phone numbers where there were
   * 458). ⚠️ **NO ENTRY USES THIS TODAY** (ledger #335): D-41's canonical+mirror pair was the only
   * mirror in the corpus and it is gone. The mechanism is KEPT because the hazard is general and
   * the guard is three lines; it is recorded as currently unused rather than left to look active.
   */
  mirrors?: string[];
}

/** A source field that carries data and lands nowhere — CHECK ①. */
export interface UnmappedSourceField {
  path: string;
  /** How many records carry a non-empty value at this path. */
  withData: number;
  /** Of the records examined. Carried so the finding is a RATIO, not a bare number. */
  ofRecords: number;
  examples: string[];
  /** The shape most of those values take, when they agree. Null when they do not. */
  looksLike: ValueShape | null;
}

/** A destination column carrying values of the wrong shape — CHECK ②. */
export interface ColumnShapeFinding {
  column: string;
  mirrors: string[];
  fromPath: string;
  expected: ValueShape;
  detected: ValueShape;
  /** How many of the mapped values take the DETECTED shape rather than the expected one. */
  count: number;
  /** Non-empty values mapped into this column. The denominator for `count`. */
  ofValues: number;
  examples: string[];
}

/** A declaration that contradicts itself or the data. Both directions — see the header. */
export interface DeclarationFinding {
  kind: 'ignored-and-mapped' | 'mapped-but-absent';
  path: string;
  detail: string;
}

export interface ImportFieldAudit {
  /** A literal `true`. The panel renders off this, so "did not run" cannot look like "found none". */
  ran: true;
  recordsExamined: number;
  sourceFieldsSeen: number;
  unmappedWithData: UnmappedSourceField[];
  columnShapeFindings: ColumnShapeFinding[];
  declarationFindings: DeclarationFinding[];
  /** NEVER empty. Says what ran and what it found, including when it found nothing. */
  headline: string;
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// THE DECLARATIONS
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Every source path `adaptCustomer` actually reads, and where it puts it.
 *
 * ⚠️ THIS IS A DECLARATION AND DECLARATIONS DRIFT (tech-debt #185, #73). It is held honest by
 * `importFieldAudit.test.ts` §A, which feeds `adaptCustomer` a record carrying ONLY that path and
 * asserts the claimed column comes back holding it. A mapping this file claims and the adapter
 * does not perform fails the build.
 */
export const CUSTOMER_FIELD_MAP: FieldMapEntry[] = [
  { path: 'Id',                          column: 'qb_customer_id' },
  { path: 'DisplayName',                 column: 'display_name' },
  { path: 'CompanyName',                 column: 'organization_name' },
  { path: 'GivenName',                   column: 'first_name' },
  { path: 'FamilyName',                  column: 'last_name' },
  { path: 'PrimaryEmailAddr.Address',    column: 'email' },
  { path: 'PrimaryPhone.FreeFormNumber', column: 'phone' },
  { path: 'Mobile.FreeFormNumber',       column: 'phone' },
  { path: 'Notes',                       column: 'notes' },
  { path: 'Taxable',                     column: 'tax_exempt' },
  { path: 'ResaleNum',                   column: 'tax_exempt_cert_ref' },
  { path: 'TaxExemptionReasonId',        column: 'tax_exempt_reason' },
  // ✏️ NO MIRROR ANY MORE (ledger #335). These four declared `column: 'address_line1'` with
  // `mirrors: ['billing_line1']` because D-41 wrote ONE source value into TWO columns. The legacy
  // four are dropped and `billing_*` is the derived view of the address list, so there is one
  // destination per source and nothing that could be double-counted.
  { path: 'BillAddr.Line1',                    column: 'billing_line1' },
  { path: 'BillAddr.City',                     column: 'billing_city'  },
  { path: 'BillAddr.CountrySubDivisionCode',   column: 'billing_state' },
  { path: 'BillAddr.PostalCode',               column: 'billing_zip'   },
];

/**
 * Source paths deliberately NOT imported, each with the reason.
 *
 * 🔴 WITHOUT THIS LIST CHECK ① IS NOISE ON ITS FIRST RUN, WHICH IS HOW A GAP LIST STOPS BEING
 * READ — tech-debt #73's whole lesson (`OWNER_ONLY_PENDING` prints on every build and six of its
 * nine entries are stale). QuickBooks sends bookkeeping plumbing on every record; flagging
 * `SyncToken` beside 471 lost street addresses buries the one that matters.
 *
 * ⚠️ A REASON IS REQUIRED AND IS ASSERTED (§C). *"Ignored"* with no reason is indistinguishable
 * from *"nobody looked"*, and the next reader cannot tell which they are holding.
 */
export const CUSTOMER_IGNORED_SOURCE_FIELDS: Record<string, string> = {
  // ── Intuit plumbing: describes the RECORD, not the customer ──
  'SyncToken':                'Intuit optimistic-concurrency token. Meaningless outside QuickBooks.',
  'domain':                   'Always "QBO". A constant, not a fact about this customer.',
  'sparse':                   'Says whether Intuit sent a partial record, not anything about the customer.',
  'MetaData.CreateTime':      'When the row was made IN QUICKBOOKS. `customers.created_at` is when it was made HERE, and conflating them would date our record to a book we do not own.',
  'MetaData.LastUpdatedTime': 'When the row last changed IN QUICKBOOKS. As MetaData.CreateTime: that is their clock, and `customers.updated_at` is ours.',
  'FullyQualifiedName':       'DisplayName with the parent job prefixed. Already carried by display_name; a second copy would be the one that drifts (STD-011).',
  'PrintOnCheckName':         'A cheque-printing preference. We do not print cheques.',
  // ── Real facts with nowhere to put them yet. These are DEFERRALS, and they say so. ──
  'Active':                   'QuickBooks\' own active flag. READ to skip: a customer made inactive in QuickBooks is not imported (#341). Not STORED: `customers.status` exists and nothing has ruled how the two reconcile — writing it would pick that ruling by accident.',
  'Balance':                  'An accounts-receivable figure that belongs to QuickBooks and goes stale the moment it is copied. Read live, never stored.',
  'BalanceWithJobs':          'An accounts-receivable figure including sub-customer jobs. As Balance: it belongs to QuickBooks and goes stale the moment it is copied.',
  'Job':                      'Marks a sub-customer. The parent/child model is not built here; see ParentRef.',
  'BillWithParent':           'A billing-rollup preference that only means anything with the job hierarchy.',
  'ParentRef.value':          'The sub-customer parent. `customers` is flat today; importing this would create a dangling reference.',
  'Level':                    'Depth in the job hierarchy. Meaningless without the hierarchy.',
  'PreferredDeliveryMethod':  'How Intuit sends the INVOICE (print/email/none). Not a delivery method for a truck, and naming it one is exactly the confusion to avoid.',
  'CurrencyRef.value':        'Single-currency business. A column for it would be a field with one value forever.',
  'CurrencyRef.name':         'The display name of the currency. As CurrencyRef.value: a single-currency business, so a column for it would hold one value forever.',
  'DefaultTaxCodeRef.value':  'The COMPANY default tax code — "3" on all 1,946 records including every taxable one. `qboCustomerAdapter` refuses to read it and this is the same refusal, stated where a reader is asking why it is not imported.',
  'AlternatePhone.FreeFormNumber': 'A second phone. `customers.phone` is single-valued; a second number needs a decision about which one a delivery calls.',
  'Fax.FreeFormNumber':       'A fax number. No surface would show it.',
  'WebAddr.URI':              'A website. No column, and no surface asks for one.',
  'MiddleName':               'No column. Folding it into first_name would change a name we display.',
  'Suffix':                   'No column, and folding it into last_name would change a name we display. As MiddleName.',
  'Title':                    'No column, and folding it into first_name would change a name we display. As MiddleName.',
  'BillAddr.Id':              'Intuit\'s internal id for the address row. Not an address.',
  'BillAddr.Country':         'Single-country business. As CurrencyRef.',
  'BillAddr.Lat':             'Intuit\'s own geocode. Tech-debt: a geocoder EXISTS in DeliveryRoute and discards coordinates; adopting Intuit\'s would need a decision about which is authoritative.',
  // ⚠️ THE SHIP-TO PLUMBING ONLY. The four fields that make a ship-to ROUTABLE — Line1, City,
  // CountrySubDivisionCode, PostalCode — are deliberately LEFT UNDECLARED so check ① reports
  // them: 223 customers carry a routable ship-to that has never come across, and that is the
  // finding. Declaring the whole of `ShipAddr` to quieten the panel would hide it.
  'ShipAddr.Id':              'Intuit\'s internal id for the ship-to address row. Not an address, and not a key anything here could resolve.',
  'ShipAddr.Country':         'Single-country business. As BillAddr.Country.',
  'ShipAddr.Lat':             'Intuit\'s own geocode for the ship-to. As BillAddr.Lat: which geocoder is authoritative is an open decision.',
  'ShipAddr.Long':            'The longitude half of Intuit\'s ship-to geocode. As BillAddr.Long.',
  'BillAddr.Long':            'The longitude half of Intuit\'s own geocode. As BillAddr.Lat: adopting it needs a decision about which geocoder is authoritative.',
};

/**
 * What each destination column is SUPPOSED to hold — CHECK ②'s expectation.
 *
 * ⚠️ A COLUMN WITH NO ENTRY HERE IS NOT CHECKED, AND THAT IS DELIBERATE RATHER THAN AN OMISSION.
 * `display_name`, `notes` and `organization_name` can legitimately hold anything a human typed,
 * so an "expected shape" for them would manufacture findings out of ordinary data — the opposite
 * of what a check is for.
 */
export const EXPECTED_COLUMN_SHAPE: Record<string, ValueShape> = {
  billing_line1: 'street',
  billing_city:  'wordlike',
  billing_state: 'wordlike',
  billing_zip:   'postcode',
  email:         'email',
  phone:         'phone',
};

// ══════════════════════════════════════════════════════════════════════════════════════════
// THE ARITHMETIC
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Street-suffix vocabulary. Form, not meaning: these are words that appear in typed addresses. */
const STREET_WORDS = /\b(st|street|rd|road|dr|drive|ln|lane|ave|avenue|blvd|boulevard|hwy|highway|ct|court|cir|circle|way|trl|trail|pkwy|parkway|ste|suite|apt|unit|box|loop|cove|cv|pass|path|bend|ridge|creek|park|plaza|terrace|ter|place|pl|county|cr|fm|rr)\b/i;

/**
 * What does this value LOOK like?
 *
 * 🔴 ORDER IS LOAD-BEARING. `phone` is tested before `street` because a street begins with digits
 * too — "400 Honeycomb Mesa" and "(512) 456-3632" are both *number-first*. What separates them is
 * that a street has a WORD after the number and a phone has none, so the phone test requires the
 * value to carry no letters at all.
 */
export function classifyValueShape(raw: unknown): ValueShape {
  if (raw === null || raw === undefined) return 'other';
  const v = String(raw).trim();
  if (v === '') return 'other';

  // Email: an @ with something either side and a dot in the domain half.
  const at = v.indexOf('@');
  if (at > 0 && at < v.length - 1 && !/\s/.test(v) && v.slice(at + 1).includes('.')) return 'email';

  const hasLetter = /[A-Za-z]/.test(v);
  const digits = v.replace(/\D/g, '');

  // Phone: NO letters, and 10 digits (or 11 beginning with a country 1). A 5-digit zip cannot
  // reach this, and neither can a house number.
  if (!hasLetter && (digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) return 'phone';

  // Postcode: NO letters, 5 digits, or ZIP+4 written with a hyphen.
  if (!hasLetter && (/^\d{5}$/.test(v) || /^\d{5}-\d{4}$/.test(v))) return 'postcode';

  if (hasLetter) {
    // Number-then-word is the commonest American street form; a suffix word carries the rest.
    if (/^\d+[A-Za-z]?\s+\S*[A-Za-z]/.test(v)) return 'street';
    if (STREET_WORDS.test(v)) return 'street';
    // Letters and nothing numeric: a city, a state, a name.
    if (!/\d/.test(v)) return 'wordlike';
  }
  // 🔴 'other' IS AN HONEST ANSWER AND IT IS NEVER REPORTED AS A FINDING. A value we cannot
  // classify is not a value we know to be wrong (D-9 — do not fabricate a verdict).
  return 'other';
}

/**
 * An example safe to render beside ~1,900 real people's records.
 *
 * 🔴 THIS SCREEN'S STANDING DESIGN IS THAT THE CUSTOMER LIST IS NEVER PAINTED (`QboBooksReader`'s
 * header: *"roughly 1,900 REAL PEOPLE… NEVER rendered in full"*). An example exists to prove the
 * classifier read the shape correctly, and the SHAPE is all it needs to show. Every letter
 * becomes `x` and every digit past the first three becomes `•` — so an area code survives (it
 * makes the phone finding legible and identifies nobody) and a street name does not.
 */
export function maskExample(raw: unknown): string {
  let seen = 0;
  return String(raw).trim().replace(/[A-Za-z0-9]/g, ch => {
    if (/[0-9]/.test(ch)) { seen += 1; return seen <= 3 ? ch : '•'; }
    return 'x';
  }).slice(0, 40);
}

/** Is a value present at all? Whitespace and empty string are absent, `false` and `0` are present. */
function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

/**
 * Every scalar path in a record, dotted. `{BillAddr:{Line1:'x'}}` → `BillAddr.Line1`.
 *
 * ⚠️ AN ARRAY COLLAPSES TO ONE PATH ENDING `[]` rather than becoming `Foo.0`, `Foo.1`… Indexed
 * paths would make the discovered field set grow with the DATA, so a company with more of
 * something would appear to have more unmapped fields. The population must describe the SHAPE of
 * the records, not their size.
 */
export function flattenPaths(record: unknown, prefix = '', out: Map<string, unknown[]> = new Map()): Map<string, unknown[]> {
  if (record === null || typeof record !== 'object') {
    if (prefix) { const g = out.get(prefix); if (g) g.push(record); else out.set(prefix, [record]); }
    return out;
  }
  if (Array.isArray(record)) {
    for (const el of record) flattenPaths(el, prefix ? `${prefix}[]` : '[]', out);
    return out;
  }
  for (const [k, v] of Object.entries(record as Record<string, unknown>)) {
    flattenPaths(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/** Read a dotted path out of one record. Returns undefined for anything missing on the way down. */
function valueAt(record: Record<string, unknown>, path: string): unknown {
  let cur: unknown = record;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** The shape the majority of these values take, or null when there is no majority. */
function dominantShape(values: unknown[]): ValueShape | null {
  const tally = new Map<ValueShape, number>();
  for (const v of values) {
    const s = classifyValueShape(v);
    tally.set(s, (tally.get(s) ?? 0) + 1);
  }
  let best: ValueShape | null = null, bestN = 0;
  for (const [s, n] of tally) if (n > bestN) { best = s; bestN = n; }
  // A bare plurality is not a claim worth making; more than half is.
  return best !== null && bestN * 2 > values.length ? best : null;
}

export interface AuditInput {
  /** The RAW QuickBooks records, exactly as parsed. Not the adapted rows — the point is what was SENT. */
  records: Record<string, unknown>[];
  map?: FieldMapEntry[];
  ignored?: Record<string, string>;
  expected?: Record<string, ValueShape>;
  /** How many masked examples to carry per finding. Three is enough to show a pattern. */
  exampleLimit?: number;
}

/**
 * Run both checks. Reads nothing, writes nothing, and always answers.
 *
 * 🔴 THE TWO CHECKS ARE COMPUTED FROM THE SAME PASS OVER THE SAME RECORDS, so the counts they
 * report cannot disagree about how many records there were — R-110's shape.
 */
export function auditImportFields(input: AuditInput): ImportFieldAudit {
  const records = input.records ?? [];
  const map = input.map ?? CUSTOMER_FIELD_MAP;
  const ignored = input.ignored ?? CUSTOMER_IGNORED_SOURCE_FIELDS;
  const expected = input.expected ?? EXPECTED_COLUMN_SHAPE;
  const limit = input.exampleLimit ?? 3;

  // ── the population: every path any record actually carries ──────────────────
  const seen = new Map<string, unknown[]>();
  for (const r of records) {
    for (const [path, vals] of flattenPaths(r)) {
      const g = seen.get(path);
      if (g) for (const v of vals) g.push(v); else seen.set(path, [...vals]);
    }
  }
  const mappedPaths = new Set(map.map(m => m.path));

  // ── CHECK ① — a source field with data, mapped to nothing ───────────────────
  const unmappedWithData: UnmappedSourceField[] = [];
  for (const [path, values] of seen) {
    if (mappedPaths.has(path)) continue;
    if (Object.prototype.hasOwnProperty.call(ignored, path)) continue;
    const withData = values.filter(present);
    if (withData.length === 0) continue;
    unmappedWithData.push({
      path,
      withData: withData.length,
      ofRecords: records.length,
      looksLike: dominantShape(withData),
      examples: withData.slice(0, limit).map(maskExample),
    });
  }
  unmappedWithData.sort((a, b) => b.withData - a.withData || a.path.localeCompare(b.path));

  // ── CHECK ② — a destination column holding the wrong shape ──────────────────
  const columnShapeFindings: ColumnShapeFinding[] = [];
  for (const entry of map) {
    const want = expected[entry.column];
    if (!want) continue;                       // no stated expectation → nothing to check
    const values: unknown[] = [];
    for (const r of records) { const v = valueAt(r, entry.path); if (present(v)) values.push(v); }
    if (values.length === 0) continue;
    const byShape = new Map<ValueShape, unknown[]>();
    for (const v of values) {
      const s = classifyValueShape(v);
      if (s === want || s === 'other') continue;   // 'other' is never a verdict — see classifyValueShape
      const g = byShape.get(s); if (g) g.push(v); else byShape.set(s, [v]);
    }
    for (const [detected, offenders] of byShape) {
      columnShapeFindings.push({
        column: entry.column,
        mirrors: entry.mirrors ?? [],
        fromPath: entry.path,
        expected: want,
        detected,
        count: offenders.length,
        ofValues: values.length,
        examples: offenders.slice(0, limit).map(maskExample),
      });
    }
  }
  columnShapeFindings.sort((a, b) => b.count - a.count || a.column.localeCompare(b.column));

  // ── the declarations, asserted BOTH DIRECTIONS (the #182 half) ──────────────
  const declarationFindings: DeclarationFinding[] = [];
  for (const entry of map) {
    if (Object.prototype.hasOwnProperty.call(ignored, entry.path)) {
      declarationFindings.push({
        kind: 'ignored-and-mapped', path: entry.path,
        detail: `declared ignored AND mapped to ${entry.column} — the two declarations contradict each other`,
      });
    }
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 A MAPPED PATH NO RECORD CARRIES — BUT ONLY WHEN ITS SIBLINGS ARE THERE.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // ✏️ NARROWED AFTER §F WENT RED, AND THE FIRST VERSION WAS WRONG IN THE NOISY DIRECTION.
    // It reported EVERY mapped path absent from the capture, so a book where nobody had filled in
    // `CompanyName` or `Notes` produced five red declaration findings and a CLEAN capture could
    // not report itself clean. **An optional field nobody filled in is not evidence of anything**,
    // and a check that cries on ordinary data is tech-debt #73's gap list all over again.
    //
    // The signal actually worth having is an upstream RENAME, and a rename has a fingerprint: the
    // PARENT container still arrives and the LEAF has gone. `BillAddr` present on 1,946 records
    // with `BillAddr.Line1` on none is a renamed field; a top-level `CompanyName` on none is a
    // company whose customers are people. So this fires ONLY for a nested path whose parent is
    // present somewhere — and a top-level mapping is deliberately never reported here, because
    // from inside one capture its absence carries no information.
    const dot = entry.path.lastIndexOf('.');
    if (records.length > 0 && dot > 0 && !seen.has(entry.path)) {
      const parent = entry.path.slice(0, dot);
      const parentPresent = [...seen.keys()].some(k => k.startsWith(parent + '.'));
      if (parentPresent) {
        declarationFindings.push({
          kind: 'mapped-but-absent', path: entry.path,
          detail: `mapped to ${entry.column}, and not one of the ${records.length} records carries it — `
                + `though \`${parent}\` does arrive, so ${entry.column} would be imported empty`,
        });
      }
    }
  }

  // ── the headline. NEVER empty. ──────────────────────────────────────────────
  const total = unmappedWithData.length + columnShapeFindings.length + declarationFindings.length;
  const scope = `Checked ${records.length.toLocaleString('en-US')} record${records.length === 1 ? '' : 's'} across ${seen.size} field${seen.size === 1 ? '' : 's'}`;
  const headline = records.length === 0
    ? 'Both field checks ran. There were no records to check.'
    : total === 0
      ? `${scope}. Both checks ran and found nothing.`
      : `${scope}. ${total} thing${total === 1 ? '' : 's'} to look at before you import.`;

  console.log('[TRACE:CUSTIMPORT] field audit', {
    records: records.length, fields: seen.size,
    unmapped: unmappedWithData.length, shape: columnShapeFindings.length, declarations: declarationFindings.length,
  });

  return {
    ran: true,
    recordsExamined: records.length,
    sourceFieldsSeen: seen.size,
    unmappedWithData,
    columnShapeFindings,
    declarationFindings,
    headline,
  };
}
