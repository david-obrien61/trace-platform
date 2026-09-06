/**
 * ── customer import — the exempt flag, the run id, and the 72 that must NOT be merged ──
 *
 * Covers `qboCustomerAdapter.ts` (every decision) and `customerImportWriter.ts` (every write).
 *
 * 🔴 THE THREE ASSERTIONS THAT MATTER MOST, AND WHY THEY ARE NOT ABOUT CORRECTNESS-IN-GENERAL:
 *
 *   §B — TAXABILITY READS OFF `Taxable` AND NOTHING ELSE. `DefaultTaxCodeRef.value` is "3" on all
 *        1,946 LAWNS records INCLUDING every taxable one, while `TaxExemptionReasonId` is "3" on
 *        three cities. Same literal, two fields, opposite meanings. A probe that only ever fed
 *        exempt fixtures would pass with either field wired in, so §B feeds a TAXABLE record
 *        carrying `DefaultTaxCodeRef "3"` and asserts it comes back taxable.
 *
 *   §F — AN EXISTING CUSTOMER IS NEVER STAMPED WITH THE RUN ID. The naive one-upsert
 *        implementation stamps all 19 of LAWNS's pre-existing QuickBooks-linked rows, and the
 *        undo then DELETES REAL CUSTOMERS. The probe asserts the update payload has no
 *        `import_run_id` KEY — not that its value is null, which a `?? null` would satisfy.
 *
 *   §G — MERGING IS NOT IMPLEMENTED AND THE COUNT PROVES IT. 72 records share an email or a
 *        phone; a merge would silently destroy a company or its owner. The probe asserts every
 *        flagged record still arrives as its OWN row.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/customerImport.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  adaptCustomer, adaptCustomers, classifyCustomer, exemptionOf, flagDuplicates,
  parseCustomerRecords, readsAsAWord, REASON_NOT_IDENTIFIED, CUSTOMER_IMPORT_SOURCE,
} from './qboCustomerAdapter';
import {
  previewCustomerImport, commitCustomerImport, undoCustomerImport, rowForCustomer,
  CUSTOMER_INSERT_COLUMNS, CUSTOMER_RECONCILE_COLUMNS, CUSTOMER_INSERT_BATCH,
} from './customerImportWriter';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const body = (rows: unknown[]) => JSON.stringify({ QueryResponse: { Customer: rows }, time: 'x' });
const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const RUN = '11111111-2222-3333-4444-555555555555';

/** A person record shaped exactly like Intuit's, with the universal fields LAWNS actually carries. */
function person(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: '101', DisplayName: 'Rick Rowen', GivenName: 'Rick', FamilyName: 'Rowen',
    Taxable: true, DefaultTaxCodeRef: { value: '3' }, Active: true,
    PrimaryEmailAddr: { Address: 'rick@example.com' },
    PrimaryPhone: { FreeFormNumber: '(512) 555-0101' },
    BillAddr: { Id: '9', Line1: '1 Oak St', City: 'Leander', CountrySubDivisionCode: 'TX', PostalCode: '78641' },
    ...over,
  };
}

// ══ §A THE PARSE — a body we could not read is never an empty list ══════════════════════
{
  const good = parseCustomerRecords(body([person()]));
  ok(good.ok && good.rows.length === 1, 'a real page parses');

  const broken = parseCustomerRecords('{not json');
  ok(broken.ok === false && broken.rows.length === 0 && broken.parseError !== null,
    '🔴 an unreadable body is ok:false with a stated error — never an empty list, which would import zero customers and report success (D-9 / A9)');

  const trueEmpty = parseCustomerRecords(JSON.stringify({ QueryResponse: {} }));
  ok(trueEmpty.ok === true && trueEmpty.rows.length === 0,
    'a company with no customers is a TRUE empty answer, distinct from an unreadable one');

  const notArray = parseCustomerRecords(JSON.stringify({ QueryResponse: { Customer: 'nope' } }));
  ok(notArray.ok === false, 'a Customer key that is not an array is a parse failure, not zero rows');
}

// ══ §B THE EXEMPT FLAG — `Taxable` IS THE ONLY AUTHORITY ════════════════════════════════
{
  // 🔴 THE NEGATIVE THAT CARRIES THE WHOLE SECTION. This record is TAXABLE and carries
  // DefaultTaxCodeRef "3" — the exact literal that also appears as an exemption reason id.
  const taxable = adaptCustomer(person({ DefaultTaxCodeRef: { value: '3' } }))!;
  ok(taxable.tax_exempt === false,
    '🔴 a TAXABLE customer carrying DefaultTaxCodeRef "3" is NOT exempt — the two fields spell the same literal and mean opposite things; reading the tax CODE as a REASON is what produced "17 more carry a bare 3"');
  ok(taxable.tax_exempt_reason === null && taxable.tax_exempt_cert_ref === null,
    'a taxable row carries NO reason and NO certificate — either one would assert an exemption nobody claimed');
  // 🔴 THE FIXTURE THAT MAKES THAT ASSERTION MEAN SOMETHING. The plain taxable record above holds
  // no ResaleNum and no reason id, so a mutant that copies both through is INDISTINGUISHABLE on it
  // — mutant A3 survived exactly there. This one is taxable and carries BOTH, so the refusal has
  // something to refuse.
  const taxableWithStrays = adaptCustomer(person({ Taxable: true, TaxExemptionReasonId: '9', ResaleNum: 'GOVT' }))!;
  ok(taxableWithStrays.tax_exempt === false
    && taxableWithStrays.tax_exempt_reason === null
    && taxableWithStrays.tax_exempt_cert_ref === null,
    '🔴 a TAXABLE record carrying a leftover reason id AND a certificate still reports no exemption — the flag governs, and stale neighbours are not evidence');

  const exempt = adaptCustomer(person({ Taxable: false, TaxExemptionReasonId: '9' }))!;
  ok(exempt.tax_exempt === true, 'Taxable:false is the exempt flag');

  // A record with NO Taxable key at all — the safe direction is TAXABLE.
  const noFlag = adaptCustomer(person({ Taxable: undefined }))!;
  ok(noFlag.tax_exempt === false,
    '🔴 a MISSING Taxable is treated as taxable — guessing the other way means not charging tax that is owed, which is the nursery\'s liability');

  // The exemption is read off the raw record, so exemptionOf is probed directly both ways too.
  ok(exemptionOf({ Taxable: false, TaxExemptionReasonId: '2', ResaleNum: 'GOVT' }).tax_exempt === true
    && exemptionOf({ Taxable: true, TaxExemptionReasonId: '2', ResaleNum: 'GOVT' }).tax_exempt === false,
    'exemptionOf agrees with Taxable in BOTH directions on an otherwise identical record');
}

// ══ §C THE REASON — four readable, the rest honestly unnamed, raw id never dropped ══════
{
  ok(readsAsAWord('GOVT') && readsAsAWord('School') && readsAsAWord('Ag') && readsAsAWord('City Of Liberty'),
    'the four semantic labels read as WORDS');
  ok(!readsAsAWord('32093937053') && !readsAsAWord('2-4629800259') && !readsAsAWord('#32063706967')
    && !readsAsAWord('17423370067') && !readsAsAWord('#32038506344'),
    '🔴 all five permit numbers read as NUMBERS — the split is on FORM, not on a hardcoded list of this realm\'s four answers');
  ok(!readsAsAWord(null), 'no certificate at all is not a word');
  // 🔴 THE PROBE THAT SEPARATES A RULE FROM A LOOKUP TABLE. Every label above is one of LAWNS's
  // own four, so a hardcoded ['GOVT','School','Ag','City Of Liberty'] passes all of them —
  // mutant A6 survived exactly there. These are words this realm has never used.
  ok(readsAsAWord('Church') && readsAsAWord('Resale certificate') && readsAsAWord('Nonprofit'),
    '🔴 a word NO LAWNS customer has ever used still reads as a word — the test is FORM, not a list of the four answers we happen to have seen. A lookup table is correct at one tenant and silently wrong at the next');
  ok(!readsAsAWord('12345') && !readsAsAWord('-'),
    '…and an unseen NUMBER still reads as a number, so the rule holds in both directions');

  const govt = adaptCustomer(person({ Taxable: false, TaxExemptionReasonId: '2', ResaleNum: 'GOVT' }))!;
  ok(govt.tax_exempt_reason === 'GOVT (QuickBooks reason 2)',
    'a readable certificate becomes the reason, and the raw QuickBooks id rides along in it');

  const permit = adaptCustomer(person({ Taxable: false, TaxExemptionReasonId: '99', ResaleNum: '32093937053' }))!;
  ok(permit.tax_exempt_reason === `${REASON_NOT_IDENTIFIED} (QuickBooks reason 99)`,
    '🔴 a PERMIT NUMBER is never rendered as a reason name — it reads "reason not identified", per David 2026-09-06');
  ok(permit.tax_exempt_cert_ref === '32093937053',
    '…and the permit number is still CARRIED verbatim in the certificate column — do-not-interpret is not do-not-keep');

  const bare = adaptCustomer(person({ Taxable: false, TaxExemptionReasonId: '9' }))!;
  ok(bare.tax_exempt_reason === `${REASON_NOT_IDENTIFIED} (QuickBooks reason 9)` && bare.tax_exempt_cert_ref === null,
    'the 18 with no certificate at all read "reason not identified" and carry the raw id');

  const noId = adaptCustomer(person({ Taxable: false, ResaleNum: 'Ag' }))!;
  ok(noId.tax_exempt_reason === 'Ag',
    'an exempt record with no reason id reads the label alone — no "(QuickBooks reason undefined)" fabricated');
}

// ══ §D PERSON vs ORGANIZATION — GivenName is not a person signal ════════════════════════
{
  ok(classifyCustomer('ABC Home and Pest Services', 'ABC Home and Pest Services', 'ABC') === 'organization',
    '🔴 DisplayName == CompanyName is an ORGANIZATION even though QuickBooks split a GivenName out of the company name ("ABC" / "and Pest Services")');
  ok(classifyCustomer('Time and Space', 'Aaron Harlan', 'Aaron') === 'person',
    '🔴 a person who WORKS somewhere stays a PERSON — the company differs from the display name');
  ok(classifyCustomer(null, 'Vik', null) === 'person', 'no company at all is a person');
  ok(classifyCustomer('Twins Landscaping LLC', 'Twins Landscaping LLC', null) === 'organization',
    'a company with no personal name is an organization');

  const org = adaptCustomer(person({ Id: '7', DisplayName: 'Tree Amigos LLC', CompanyName: 'Tree Amigos LLC', GivenName: 'Tree', FamilyName: 'Amigos LLC' }))!;
  ok(org.customer_type === 'organization' && org.first_name === 'Tree Amigos LLC' && org.last_name === null,
    '🔴 an organization carries its display name in first_name — matching the three organization rows already live at LAWNS — and NO last name');
  ok(org.organization_name === 'Tree Amigos LLC', 'the company name is kept rather than discarded');

  const p = adaptCustomer(person({ CompanyName: 'Time and Space' }))!;
  ok(p.customer_type === 'person' && p.organization_name === 'Time and Space',
    'a person keeps their employer in organization_name — the fact is not thrown away by the classification');
}

// ══ §E REFUSALS AND THE ADDRESS — absent is not empty ═══════════════════════════════════
{
  ok(adaptCustomer({ DisplayName: 'No Id Here' }) === null, 'a record with no Id is refused — there is no second identity to upsert on');
  ok(adaptCustomer({ Id: '5' }) === null,
    '🔴 a record with no name of ANY kind is refused rather than written as "(unnamed)" — a placeholder in a WRITE lands in a real company\'s customer list');

  // ShipAddr is on all 1,946 LAWNS records but only 754 carry a Line1: the rest are id-only husks.
  const shipOnly = adaptCustomer(person({ BillAddr: undefined, ShipAddr: { Id: '4' } }))!;
  ok(shipOnly.address_line1 === null && shipOnly.city === null,
    '🔴 an id-only ShipAddr husk yields NO address — testing the OBJECT rather than a field counts 1,946 addresses where there are 1,448');
  // 🔴 THE FIXTURE THAT CATCHES THE FALLBACK. The husk above has no Line1, so reading it changes
  // nothing — mutant A9 survived there. This record has NO billing address and a REAL job-site
  // ShipAddr, which is the case where a fallback quietly bills a customer at a work site.
  const jobSiteOnly = adaptCustomer(person({
    BillAddr: undefined,
    ShipAddr: { Id: '4', Line1: '9 Job Site Rd', City: 'Georgetown', CountrySubDivisionCode: 'TX', PostalCode: '78626' },
  }))!;
  ok(jobSiteOnly.address_line1 === null && jobSiteOnly.city === null && jobSiteOnly.zip === null,
    '🔴 a real ShipAddr is NOT used as the billing address — ShipAddr is a JOB SITE (Dave\'s Tree Svs bills one office and ships to three sites), and billing an invoice to a work site is a wrong address that looks entirely plausible');
  const billed = adaptCustomer(person())!;
  ok(billed.address_line1 === '1 Oak St' && billed.city === 'Leander' && billed.state === 'TX' && billed.zip === '78641',
    'a real BillAddr fills all four columns');

  const a = adaptCustomers([body([person({ Id: '1' }), person({ Id: '1' })])]);
  ok(a.customers.length === 1 && a.skipped.some(s => /twice/.test(s.reason)),
    '🔴 the same qb_customer_id twice in one capture is dropped AND COUNTED — a payload holding it twice makes Postgres reject the WHOLE upsert batch ("cannot affect row a second time"), failing 1,945 good records for one bad one');

  const bad = adaptCustomers(['{not json', body([person()])]);
  ok(bad.customers.length === 1 && bad.skipped.some(s => /could not be read/.test(s.reason)),
    'an unreadable page is counted, not silently skipped — the operator is told the import saw less than the file holds');
}

// ══ §F DUPLICATES — flagged, counted as a UNION, and never merged ═══════════════════════
{
  const rows = [
    person({ Id: '1', DisplayName: 'Heller Landscapes Inc.', CompanyName: 'Heller Landscapes Inc.', PrimaryEmailAddr: { Address: 'ronnie@heller.com' }, PrimaryPhone: { FreeFormNumber: '512-555-0001' } }),
    person({ Id: '2', DisplayName: 'Ronnie Heller', PrimaryEmailAddr: { Address: 'RONNIE@Heller.com' }, PrimaryPhone: { FreeFormNumber: '512-555-0002' } }),
    person({ Id: '3', DisplayName: 'Preston Culver', PrimaryEmailAddr: { Address: 'house@example.com' }, PrimaryPhone: { FreeFormNumber: '(512) 555-0003' } }),
    person({ Id: '4', DisplayName: 'Elisa Mesa', PrimaryEmailAddr: { Address: 'house@example.com' }, PrimaryPhone: { FreeFormNumber: '+1 512 555 0003' } }),
    person({ Id: '5', DisplayName: 'Nobody Shared', PrimaryEmailAddr: { Address: 'solo@example.com' }, PrimaryPhone: { FreeFormNumber: '512-555-9999' } }),
  ];
  const a = adaptCustomers([body(rows)]);
  ok(a.customers.length === 5, '🔴 every flagged record still arrives as its OWN row — nothing is merged');

  const emails = a.duplicates.filter(d => d.on === 'email');
  ok(emails.length === 2, 'two shared email values: the Heller pair (case-insensitively) and the household pair');
  ok(emails.some(d => d.members.includes('1') && d.members.includes('2')),
    'a COMPANY and its OWNER sharing a mailbox is flagged — it is the one-person-many-accounts model, and only a human can tell it from a duplicate');

  const phones = a.duplicates.filter(d => d.on === 'phone');
  ok(phones.length === 1 && phones[0].members.includes('3') && phones[0].members.includes('4'),
    '(512) 555-0003 and +1 512 555 0003 are ONE number — normalised on the last 10 digits');

  // 🔴 THE UNION, NOT THE SUM. Ids 3 and 4 are flagged on BOTH keys; counting the flags would
  // report 6 records where there are 4. This is the 54-vs-72 correction, in miniature.
  ok(a.duplicateRecordCount === 4,
    '🔴 the record count is the UNION across both keys (4), not the sum of the flags (6) — the sum overstates the review a human is being asked to do');
  ok(a.duplicates.reduce((n, d) => n + d.members.length, 0) === 6,
    '…and the underlying flags really do total 6, so the union is doing work rather than agreeing by accident');

  ok(flagDuplicates([]).length === 0, 'no customers, no flags — not a fabricated cluster of 1');
  const noContact = adaptCustomers([body([person({ Id: '8', PrimaryEmailAddr: undefined, PrimaryPhone: undefined, Mobile: undefined })])]);
  ok(noContact.duplicates.length === 0, 'a record with no email and no phone cannot be a duplicate of anything');
}

// ══ THE DOUBLE — it models the UNIQUE INDEX, so it can refuse what Postgres refuses ═════
function makeDb(opts: {
  customers?: any[];
  /** Simulates an RLS refusal: no error, nothing changes — exactly what PostgREST returns. */
  refuseWrites?: boolean;
  /** 🔴 SIMULATES A DELETE THAT REPORTS ROWS AND LEAVES THEM THERE. Not contrived: a partial
   *  policy, or anything that re-materialises the row, produces exactly this — a caller reading
   *  only the returned rows would report a clean undo over a tenant that still holds them. It is
   *  the ONE state the post-delete re-read exists to catch, and without it in the double the
   *  re-read could be replaced by a constant and nothing would go red (§6 r19a). */
  phantomDelete?: boolean;
  failOn?: 'insert' | 'update' | 'delete' | null;
} = {}) {
  const calls: { table: string; verb: string; filters: [string, string, any][]; payload?: any }[] = [];
  const customers: any[] = (opts.customers ?? []).map(r => ({ ...r }));
  const other: Record<string, any[]> = {};
  let nextId = 1;

  function builder(table: string, verb: string, payload?: any) {
    const filters: [string, string, any][] = [];
    const rec = { table, verb, filters, payload };
    calls.push(rec);
    let headMode = false;
    const store = () => (table === 'customers' ? customers : (other[table] ??= []));
    const b: any = {
      select(_c?: string, o?: any) { if (o?.head) headMode = true; return b; },
      eq(c: string, v: any) { filters.push([c, 'eq', v]); return b; },
      not(c: string, op: string, v: any) { filters.push([c, `not.${op}`, v]); return b; },
      is(c: string, v: any) { filters.push([c, 'is', v]); return b; },
      range() { return b; },
      then(resolve: any) { return Promise.resolve(result()).then(resolve); },
    };
    function matches(row: any): boolean {
      for (const [c, op, v] of filters) {
        if (op === 'eq' && String(row[c]) !== String(v)) return false;
        if (op === 'not.is' && v === null && row[c] == null) return false;
        if (op === 'is' && v === null && row[c] != null) return false;
      }
      return true;
    }
    function result(): any {
      if (opts.failOn === verb) return { data: null, error: { message: `simulated ${verb} failure` }, count: null };
      const rows_ = store();
      if (verb === 'select') {
        const hits = rows_.filter(matches);
        return headMode ? { data: null, error: null, count: hits.length } : { data: hits, error: null, count: hits.length };
      }
      if (verb === 'insert') {
        const incoming = Array.isArray(payload) ? payload : [payload];
        if (opts.refuseWrites) return { data: [], error: null, count: 0 };
        // 🔴 THE UNIQUE INDEX, MODELLED. `customers_business_qb_customer_uidx` is NON-PARTIAL on
        // (business_id, qb_customer_id), so a second row for one id is REJECTED by the database.
        // A double that accepts it is more forgiving than the real system, and every assertion
        // resting on it is decoration (§6 r19a — tech-debt #138's exact shape).
        for (const r of incoming) {
          if (r.qb_customer_id == null) continue;
          if (rows_.some(x => x.business_id === r.business_id && String(x.qb_customer_id) === String(r.qb_customer_id))) {
            return { data: null, error: { message: 'duplicate key value violates unique constraint "customers_business_qb_customer_uidx"' }, count: null };
          }
        }
        const landed = incoming.map((r: any) => ({ ...r, id: `new-${nextId++}` }));
        rows_.push(...landed);
        return { data: landed, error: null, count: landed.length };
      }
      if (verb === 'update') {
        if (opts.refuseWrites) return { data: [], error: null, count: 0 };
        const hits = rows_.filter(matches);
        for (const r of hits) Object.assign(r, payload);
        return { data: hits, error: null, count: hits.length };
      }
      if (verb === 'delete') {
        if (opts.refuseWrites) return { data: [], error: null, count: 0 };
        const hits = rows_.filter(matches);
        // Reports the rows, removes nothing — see `phantomDelete` above.
        if (!opts.phantomDelete) for (const r of hits) rows_.splice(rows_.indexOf(r), 1);
        return { data: hits, error: null, count: hits.length };
      }
      return { data: [], error: null, count: 0 };
    }
    return b;
  }
  return {
    db: {
      from: (table: string) => ({
        select: (c?: string, o?: any) => builder(table, 'select').select(c, o),
        insert: (p: any) => builder(table, 'insert', p),
        update: (p: any) => builder(table, 'update', p),
        delete: () => builder(table, 'delete'),
      }),
    },
    calls, customers,
  };
}

async function main() {

// ══ §G THE RUN-ID TRAP — an existing customer is NEVER stamped ══════════════════════════
{
  // LAWNS's real shape in miniature: one customer already linked to QuickBooks id '101', one
  // local customer with no QuickBooks id at all, and an incoming capture holding '101' and '102'.
  const { db, calls, customers } = makeDb({ customers: [
    { id: 'old-1', business_id: BIZ, qb_customer_id: '101', import_run_id: null, tax_exempt: false, first_name: 'Rick', email: 'curated@example.com' },
    { id: 'old-2', business_id: BIZ, qb_customer_id: null,  import_run_id: null, tax_exempt: false, first_name: 'Walk In' },
  ] });
  const a = adaptCustomers([body([
    person({ Id: '101', Taxable: false, TaxExemptionReasonId: '9' }),
    person({ Id: '102', DisplayName: 'New Person', PrimaryEmailAddr: { Address: 'new@example.com' }, PrimaryPhone: { FreeFormNumber: '512-555-7777' } }),
  ])]);

  const plan = await previewCustomerImport(db as any, BIZ, a);
  ok(plan.toCreate === 1 && plan.toReconcile === 1,
    'the plan partitions on qb_customer_id: one new, one already here');
  ok(plan.wrote === false && !calls.some(c => c.verb !== 'select'),
    '🔴 a PREVIEW issues no write of any kind — asserted against the recorded calls, not against the word "preview"');

  const run = await commitCustomerImport(db as any, BIZ, a, RUN);
  ok(run.created === 1 && run.reconciled === 1, 'one created, one reconciled');

  const updates = calls.filter(c => c.table === 'customers' && c.verb === 'update');
  ok(updates.length === 1, 'exactly one existing row was updated');
  ok(!('import_run_id' in updates[0].payload),
    '🔴 THE UPDATE PAYLOAD HAS NO import_run_id KEY AT ALL. A single blind upsert stamps every pre-existing row, and the undo then DELETES REAL CUSTOMERS that predate the import. Asserted on KEY ABSENCE — a `?? null` would satisfy a value check');
  ok(Object.keys(updates[0].payload).sort().join(',') === [...CUSTOMER_RECONCILE_COLUMNS].sort().join(','),
    '🔴 an existing row receives the THREE exemption columns and nothing else — name, email, phone and address may have been curated locally and QuickBooks is not automatically the better copy');

  const old1 = customers.find(c => c.id === 'old-1');
  ok(old1.import_run_id === null, 'the pre-existing row is STILL unstamped after the commit');
  ok(old1.tax_exempt === true && /reason not identified \(QuickBooks reason 9\)/.test(old1.tax_exempt_reason),
    '…and its exemption WAS corrected — the one fact the local row could not have got right, and the reason this build exists');
  ok(old1.email === 'curated@example.com', 'the curated email survives — the reconcile does not clobber it');

  const created = customers.find(c => c.qb_customer_id === '102');
  ok(created.import_run_id === RUN && created.source === CUSTOMER_IMPORT_SOURCE,
    'the row this run created carries the run id and the import source');
}

// ══ §G2 CLAIMED vs OBSERVED — the re-read has to be able to disagree ═══════════════════
{
  // 🔴 A REFUSED INSERT: PostgREST returns no error and lands nothing, exactly as an RLS policy
  // declining the write does. `created` is what the run CLAIMS it sent; `stampedWithThisRun` is
  // re-read from the table afterwards. Nothing in the suite made those two disagree, so a mutant
  // computing the observed number from the plan survived (W10). Here they MUST differ.
  const { db } = makeDb({ customers: [], refuseWrites: true });
  const a = adaptCustomers([body([person({ Id: '901' }), person({ Id: '902', DisplayName: 'Two' })])]);
  const run = await commitCustomerImport(db as any, BIZ, a, RUN);
  ok(run.created === 2,
    'the run reports the two rows it SENT');
  ok(run.stampedWithThisRun === 0,
    '🔴 …and re-reads ZERO actually carrying the run id. The observed number is READ BACK from the table, never computed from the plan — otherwise a silently refused import reports a clean success (#274)');
  ok(run.created !== run.stampedWithThisRun,
    '🔴 claimed and observed are genuinely different values here — an assertion that can only ever compare a number to itself is not an assertion (R-33)');
}

// ══ §H THE WRITE BOUNDARY, EXHAUSTIVELY — against the recorder, not the comment ═════════
{
  const { db, calls } = makeDb({ customers: [] });
  const a = adaptCustomers([body([person({ Id: '201' }), person({ Id: '202', DisplayName: 'Two', PrimaryEmailAddr: undefined })])]);
  await commitCustomerImport(db as any, BIZ, a, RUN);

  const written = calls.filter(c => c.verb !== 'select');
  ok(written.every(c => c.table === 'customers'),
    '🔴 EVERY write goes to `customers`. Not `people`, not `orders`, not `business_inventory`, not the ledger — asserted over the recorded calls');
  ok(!calls.some(c => c.table === 'people'),
    '🔴 NOT ONE `people` ROW. `people` has no import_run_id (probed live: 9 columns, no run provenance), so a person row created here could never be undone — R-93\'s argument on a different table');
  ok(!written.some(c => c.verb === 'delete'),
    'a commit never deletes — the undo is the only path that does');
  ok(written.every(c => c.verb === 'insert' || c.verb === 'update'), 'insert and update are the only verbs a commit issues');

  const ins = calls.find(c => c.verb === 'insert')!;
  ok(Object.keys(ins.payload[0]).sort().join(',') === [...CUSTOMER_INSERT_COLUMNS].sort().join(','),
    'the INSERT payload matches the declared column list exactly — a wider write would be a visible edit, not a silent one');
  const row = rowForCustomer(BIZ, RUN, a.customers[0]);
  ok(row.billing_line1 === row.address_line1 && row.billing_city === row.city,
    '🔴 canonical + mirror (D-41): billing_* and the legacy four are written TOGETHER, or the invoice prints one address and the delivery route shows another');
  ok(row.business_id === BIZ, 'every row is scoped to the tenant (AC-3)');
}

// ══ §I THE DOUBLE CAN REFUSE — the unique index is real ════════════════════════════════
{
  const { db } = makeDb({ customers: [{ id: 'x', business_id: BIZ, qb_customer_id: '301', import_run_id: null }] });
  // Force the collision: adapt a record whose id is already held, then insert it as if NEW.
  const a = adaptCustomers([body([person({ Id: '301' })])]);
  let threw = false;
  try {
    // Bypass the partition deliberately — this is the state the unique index exists to refuse.
    await (db as any).from('customers').insert([rowForCustomer(BIZ, RUN, a.customers[0])])
      .then((r: any) => { if (r.error) throw new Error(r.error.message); });
  } catch (e: unknown) { threw = e instanceof Error && /customers_business_qb_customer_uidx/.test(e.message); }
  ok(threw,
    '🔴 THE DOUBLE REFUSES A DUPLICATE (business_id, qb_customer_id) exactly as the non-partial unique index does. A double more forgiving than the real system is a rubber stamp, and every green resting on it is decoration (tech-debt #138)');

  // …and the partition is what keeps the real path away from that state.
  const { db: db2 } = makeDb({ customers: [{ id: 'x', business_id: BIZ, qb_customer_id: '301', import_run_id: null }] });
  const run = await commitCustomerImport(db2 as any, BIZ, a, RUN);
  ok(run.created === 0 && run.reconciled === 1,
    '…so a capture containing an id the tenant already holds RECONCILES it rather than colliding on it');
}

// ══ §J THE UNDO — refuses with writes on, deletes only its own run ══════════════════════
{
  const { db, calls, customers } = makeDb({ customers: [
    { id: 'old', business_id: BIZ, qb_customer_id: '401', import_run_id: null },
    { id: 'mine', business_id: BIZ, qb_customer_id: '402', import_run_id: RUN },
    { id: 'earlier', business_id: BIZ, qb_customer_id: '403', import_run_id: 'a-previous-run' },
  ] });

  const before = calls.length;
  const refused = await undoCustomerImport(db as any, BIZ, RUN, undefined); // env unset → NO hold
  ok(refused.ok === false && refused.refusedBecause !== null,
    '🔴 the undo REFUSES while QuickBooks writes are on — a refusal, not a warning (R-95)');
  ok(!calls.slice(before).some(c => c.verb === 'delete'),
    '…and the refusal issues NOT ONE delete, asserted against the recorder rather than against the return value');
  ok(customers.length === 3, 'nothing was removed by the refused undo');

  const held = await undoCustomerImport(db as any, BIZ, RUN, 'all'); // hold ON → undo permitted
  ok(held.ok === true && held.deleted === 1 && held.remainingWithThisRun === 0, 'with writes held, the undo removes this run\'s row');
  ok(customers.some(c => c.id === 'old') && customers.some(c => c.id === 'earlier'),
    '🔴 a customer that PREDATES the run and one from an EARLIER run both survive — the scope is import_run_id, so they are outside the delete by construction rather than by a clause somebody could drop');
}

// ══ §K A REFUSED DELETE IS NOT A SUCCESSFUL ONE ════════════════════════════════════════
{
  const { db } = makeDb({
    customers: [{ id: 'mine', business_id: BIZ, qb_customer_id: '501', import_run_id: RUN }],
    refuseWrites: true,
  });
  const r = await undoCustomerImport(db as any, BIZ, RUN, 'all');
  ok(r.ok === false && r.remainingWithThisRun === 1,
    '🔴 an RLS-declined delete returns NO error and zero rows — identical to having nothing to do. Only the RE-READ tells them apart, and it reports ok:false with the row still there (#274)');
  // 🔴 ok:false ALONE IS NOT ENOUGH, AND TWO MUTANTS PROVED IT. With the refusal branch deleted
  // the report is STILL ok:false with the row still counted — the outcome is identical and only
  // the EXPLANATION disappears. An undo that fails silently and an undo that says "the database
  // declined this, nothing changed" are different products; the operator acts on the sentence.
  ok(r.refusedBecause !== null && /declined/.test(r.refusedBecause!)
    && /1 rows carry this run id/.test(r.refusedBecause!),
    '🔴 …and it SAYS a refusal happened, naming how many rows were left — a silent ok:false leaves the operator to guess whether the undo had nothing to do or was not allowed to do it');
  ok(r.deleted === 0, 'nothing is reported as deleted');
}

// ══ §K2 A DELETE THAT REPORTS ROWS AND LEAVES THEM IS NOT AN UNDO ══════════════════════
{
  const { db, customers } = makeDb({
    customers: [{ id: 'mine', business_id: BIZ, qb_customer_id: '601', import_run_id: RUN }],
    phantomDelete: true,
  });
  const r = await undoCustomerImport(db as any, BIZ, RUN, 'all');
  ok(r.deleted === 1,
    'the delete REPORTED one row removed — which is all a caller trusting the return value would ever see');
  ok(r.remainingWithThisRun === 1 && r.ok === false,
    '🔴 …and the RE-READ finds it still there, so the undo reports ok:false. This is the only state that tells a reported delete apart from a landed one, and it is why the count is re-read rather than inferred');
  ok(customers.length === 1, 'the row really did survive — the double is producing the state, not the assertion');
}

// ══ §L ERRORS SURFACE — a failed write is never a quiet partial ════════════════════════
{
  const { db } = makeDb({ customers: [], failOn: 'insert' });
  const a = adaptCustomers([body([person({ Id: '601' })])]);
  let msg = '';
  try { await commitCustomerImport(db as any, BIZ, a, RUN); } catch (e: unknown) { msg = e instanceof Error ? e.message : ''; }
  ok(/customer insert failed at row 0/.test(msg),
    'an insert failure throws and names the batch it stopped at — never a report claiming rows that did not land');

  ok(CUSTOMER_INSERT_BATCH > 0 && CUSTOMER_INSERT_BATCH <= 1000,
    'the batch size is bounded — 1,946 rows in one request body is how a serverless import fails at the far end');
}

} // end main

main().then(() => {
  console.log(`\n  customerImport: ${passed} passed, ${failed} failed`);
  if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
}).catch((e) => { console.error('  ✗ the suite itself threw:', e); process.exit(1); });
