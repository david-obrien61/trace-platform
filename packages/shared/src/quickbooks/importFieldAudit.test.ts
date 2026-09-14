/**
 * ── the import preview's two field checks ────────────────────────────────────────────────
 *
 * Covers `importFieldAudit.ts` and its wiring through `adaptCustomers`.
 *
 * 🔴 THE FOUR ASSERTIONS THAT MATTER, AND WHY THEY ARE NOT ABOUT CORRECTNESS-IN-GENERAL:
 *
 *   §A — THE MAP DECLARATION IS ASSERTED AGAINST THE ADAPTER, NOT TRUSTED. Every entry in
 *        `CUSTOMER_FIELD_MAP` is fed to `adaptCustomer` as the ONLY populated field and the
 *        claimed column is read back. A mapping this file claims and the adapter does not
 *        perform fails the build — tech-debt #185's shape (`write-paths-baseline.json` declares
 *        a writer that writes nothing), caught by behaviour instead of by care.
 *        §A2 asserts the probe TABLE covers every map entry, so adding a mapping without a
 *        probe is a build failure rather than a silent hole.
 *
 *   §E — THE MIRROR IS COUNTED ONCE. D-41 writes `address_line1` AND `billing_line1` from one
 *        source value. Counting both reports 972 phone numbers where there are 486 — R-110's
 *        exact shape, *a surface asserting a number it did not get from the operation it
 *        describes*. The probe asserts the count is 486 AND that no finding names a mirror as
 *        its own column.
 *
 *   §F — NEITHER CHECK IS SILENT WHEN IT FINDS NOTHING. A clean capture still returns
 *        `ran: true` and a headline that SAYS it checked. This is the clause David wrote the
 *        build around: a blank panel is indistinguishable from a check that did not run.
 *
 *   §H — A MUTANT THAT CHANGES THE POPULATION, NOT THE SUBJECT. Tech-debt #182: *"a scanner
 *        that reports a count it never states an expectation for"* cannot fail, and *"the
 *        mechanical fix is a mutant that changes the POPULATION — none of our 13 do."* §H feeds
 *        the audit an EMPTY record set and a set whose records carry none of the mapped paths,
 *        and asserts it says so rather than reporting a clean sweep over nothing.
 *
 * ⚠️ THE FIXTURE IS LAWNS-SHAPED, NOT LAWNS. The live capture is never committed (it is a
 * customer's own book of ~1,900 real people — `QboBooksReader`'s header, R-23). So the fixture is
 * built to the measured PROPORTIONS and every assertion is against the fixture's own
 * construction, which is a claim this file can actually keep. The live numbers close on David's
 * run, not here.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/importFieldAudit.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  auditImportFields, classifyValueShape, flattenPaths, maskExample,
  CUSTOMER_FIELD_MAP, CUSTOMER_IGNORED_SOURCE_FIELDS, EXPECTED_COLUMN_SHAPE,
  type ValueShape, type FieldMapEntry,
} from './importFieldAudit';
import { adaptCustomer, adaptCustomers, type AdaptedCustomer } from './qboCustomerAdapter';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; failures.push(msg); console.log(`  ✗ ${msg}`); }
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// THE FIXTURE — LAWNS-shaped, built from the 2026-09-11 measurement's proportions.
// ══════════════════════════════════════════════════════════════════════════════════════════
const TOTAL           = 1946;
const PHONE_IN_LINE1  = 486;   // measured: a phone sits in BillAddr.Line1, ON PURPOSE (it prints)
const STREET_IN_LINE2 = 458;   // measured: of those, the real street is one line down
const NO_LINE2        = PHONE_IN_LINE1 - STREET_IN_LINE2;  // 28, measured: no second line at all
const SUITE_IN_LINE2  = 13;    // ordinary suite numbers on records whose Line1 is already a street
const LINE2_VALUES    = STREET_IN_LINE2 + SUITE_IN_LINE2;  // 471
const WITH_SHIPADDR   = 223;   // measured: a routable ship-to that never came across
const WITH_PAYMENT_REF = 40;   // an UNDECLARED field — nothing in map, nothing in ignored

function phone(i: number): string { return `(512) ${String(400 + (i % 500)).padStart(3, '0')}-${String(1000 + (i % 8999)).padStart(4, '0')}`; }
function street(i: number): string { return `${100 + i} ${['Honeycomb Mesa', 'Ranch Road', 'Oak Grove Trail', 'County Road 279'][i % 4]}`; }

function lawnsShapedRecords(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const line1IsPhone = i < PHONE_IN_LINE1;
    const bill: Record<string, unknown> = {
      Id: `addr-${i}`,
      Line1: line1IsPhone ? phone(i) : street(i),
      City: 'Leander',
      CountrySubDivisionCode: 'TX',
      PostalCode: '78641',
      Country: 'USA',
    };
    if (line1IsPhone && i < STREET_IN_LINE2) bill.Line2 = street(i);
    else if (!line1IsPhone && i < PHONE_IN_LINE1 + SUITE_IN_LINE2) bill.Line2 = `Suite ${i % 40}`;
    // the remaining `NO_LINE2` phone-in-Line1 records get no Line2 at all — measured.

    const rec: Record<string, unknown> = {
      Id: String(1000 + i),
      DisplayName: `Customer ${i}`,
      GivenName: `First${i}`,
      FamilyName: `Last${i}`,
      Taxable: true,
      PrimaryPhone: { FreeFormNumber: phone(i) },
      PrimaryEmailAddr: { Address: `c${i}@example.com` },
      BillAddr: bill,
      // ── declared-ignored plumbing, on every record: must NEVER be reported ──
      SyncToken: '3',
      domain: 'QBO',
      sparse: false,
      MetaData: { CreateTime: '2024-03-01T10:00:00-08:00', LastUpdatedTime: '2026-09-01T09:00:00-07:00' },
      DefaultTaxCodeRef: { value: '3' },
      PreferredDeliveryMethod: 'Print',
    };
    if (i < WITH_SHIPADDR) {
      rec.ShipAddr = { Id: `ship-${i}`, Line1: street(i + 7), City: 'Georgetown', CountrySubDivisionCode: 'TX', PostalCode: '78626' };
    }
    if (i < WITH_PAYMENT_REF) rec.PaymentMethodRef = { value: '4', name: 'Check' };
    out.push(rec);
  }
  return out;
}

const RECORDS = lawnsShapedRecords();
const AUDIT = auditImportFields({ records: RECORDS });

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§A — THE MAP DECLARATION, ASSERTED AGAINST THE ADAPTER (tech-debt #185)');
// ══════════════════════════════════════════════════════════════════════════════════════════
/**
 * One probe per map entry: a record carrying that path and the bare minimum around it, plus what
 * the CLAIMED column must then hold. Some fields only mean anything in company — `ResaleNum` is
 * only read on an exempt record, `Mobile` only when `PrimaryPhone` is absent — so the probe
 * carries the context rather than pretending the field is independent.
 */
const MAP_PROBES: { path: string; record: Record<string, unknown>; expect: (c: AdaptedCustomer) => boolean }[] = [
  { path: 'Id',                          record: { Id: '77', DisplayName: 'D' },                                   expect: c => c.qb_customer_id === '77' },
  { path: 'DisplayName',                 record: { Id: '1', DisplayName: 'Terry Tree' },                            expect: c => c.display_name === 'Terry Tree' },
  { path: 'CompanyName',                 record: { Id: '1', DisplayName: 'Terry', GivenName: 'Terry', CompanyName: 'LAWNS' }, expect: c => c.organization_name === 'LAWNS' },
  { path: 'GivenName',                   record: { Id: '1', DisplayName: 'Terry T', GivenName: 'Terry' },            expect: c => c.first_name === 'Terry' },
  { path: 'FamilyName',                  record: { Id: '1', DisplayName: 'Terry T', GivenName: 'Terry', FamilyName: 'Tree' }, expect: c => c.last_name === 'Tree' },
  { path: 'PrimaryEmailAddr.Address',    record: { Id: '1', DisplayName: 'D', PrimaryEmailAddr: { Address: 'a@b.com' } }, expect: c => c.email === 'a@b.com' },
  { path: 'PrimaryPhone.FreeFormNumber', record: { Id: '1', DisplayName: 'D', PrimaryPhone: { FreeFormNumber: '(512) 456-3632' } }, expect: c => c.phone === '(512) 456-3632' },
  { path: 'Mobile.FreeFormNumber',       record: { Id: '1', DisplayName: 'D', Mobile: { FreeFormNumber: '(512) 111-2222' } }, expect: c => c.phone === '(512) 111-2222' },
  { path: 'Notes',                       record: { Id: '1', DisplayName: 'D', Notes: 'gate code 4411' },             expect: c => c.notes === 'gate code 4411' },
  { path: 'Taxable',                     record: { Id: '1', DisplayName: 'D', Taxable: false },                      expect: c => c.tax_exempt === true },
  { path: 'ResaleNum',                   record: { Id: '1', DisplayName: 'D', Taxable: false, ResaleNum: 'School' }, expect: c => c.tax_exempt_cert_ref === 'School' },
  { path: 'TaxExemptionReasonId',        record: { Id: '1', DisplayName: 'D', Taxable: false, TaxExemptionReasonId: '3' }, expect: c => (c.tax_exempt_reason ?? '').includes('3') },
  { path: 'BillAddr.Line1',                  record: { Id: '1', DisplayName: 'D', BillAddr: { Line1: '400 Honeycomb Mesa' } }, expect: c => c.address_line1 === '400 Honeycomb Mesa' },
  { path: 'BillAddr.City',                   record: { Id: '1', DisplayName: 'D', BillAddr: { City: 'Leander' } },       expect: c => c.city === 'Leander' },
  { path: 'BillAddr.CountrySubDivisionCode', record: { Id: '1', DisplayName: 'D', BillAddr: { CountrySubDivisionCode: 'TX' } }, expect: c => c.state === 'TX' },
  { path: 'BillAddr.PostalCode',             record: { Id: '1', DisplayName: 'D', BillAddr: { PostalCode: '78641' } },   expect: c => c.zip === '78641' },
];

for (const probe of MAP_PROBES) {
  const adapted = adaptCustomer(probe.record);
  const entry = CUSTOMER_FIELD_MAP.find(m => m.path === probe.path);
  ok(adapted !== null && entry !== undefined && probe.expect(adapted),
    `A — \`${probe.path}\` really does land in \`${entry?.column}\`, proven by running the adapter rather than by reading the declaration`);
}

// §A2 — the probe table is not allowed to fall behind the declaration.
const probedPaths = new Set(MAP_PROBES.map(p => p.path));
const unprobed = CUSTOMER_FIELD_MAP.filter(m => !probedPaths.has(m.path)).map(m => m.path);
ok(unprobed.length === 0,
  `A2 — every entry in CUSTOMER_FIELD_MAP has a behavioural probe. Unprobed: [${unprobed.join(', ')}]. A declaration nobody re-derives is tech-debt #73's whole lesson`);
ok(MAP_PROBES.length === CUSTOMER_FIELD_MAP.length,
  `A3 — ANCHOR: ${MAP_PROBES.length} probes against ${CUSTOMER_FIELD_MAP.length} declared mappings. A probe for a path that is no longer declared is as stale as a mapping with no probe`);

// §A4 — RED-FIRST, IN PLACE: a map entry that claims a column the adapter does not fill must
// FAIL. This is §6 r19 (b) — a check nobody has seen refuse is a claim, not a check.
{
  // ✏️ THE LIAR IS `BillAddr.Line9` AND NOT `WebAddr.URI`, BECAUSE THE CHECK WAS NARROWED.
  // `mapped-but-absent` now fires only on the RENAME fingerprint — the parent container still
  // arrives, the leaf has gone — after §F proved the broad form reported five findings against a
  // capture with nothing wrong with it. A probe aimed at the OLD behaviour would have been a probe
  // that could not fail on the new one.
  const liar: FieldMapEntry[] = [...CUSTOMER_FIELD_MAP, { path: 'BillAddr.Line9', column: 'address_line1' }];
  const withLie = auditImportFields({ records: RECORDS, map: liar });
  ok(withLie.declarationFindings.some(d => d.kind === 'mapped-but-absent' && d.path === 'BillAddr.Line9'),
    'A4 — RED-FIRST: a mapping whose PARENT arrives on every record and whose LEAF arrives on none is reported. That is what an upstream rename looks like from in here, and it is the direction a one-way check would miss');

  // 🔴 THE OTHER HALF OF THE SAME NARROWING, ASSERTED RATHER THAN ASSUMED: a TOP-LEVEL
  // mapping no record carries is NOT reported, because from inside one capture an empty optional
  // field carries no information about whether it was renamed.
  const topLevelLiar: FieldMapEntry[] = [...CUSTOMER_FIELD_MAP, { path: 'NoSuchTopLevelField', column: 'notes' }];
  const withTop = auditImportFields({ records: RECORDS, map: topLevelLiar });
  ok(!withTop.declarationFindings.some(d => d.path === 'NoSuchTopLevelField'),
    'A5 — and a TOP-LEVEL mapped field nobody fills in stays SILENT. A check that cries on ordinary data is tech-debt #73\'s gap list again');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§B — THE IGNORED DECLARATION (tech-debt #73 — a gap list that only grows stops being read)');
// ══════════════════════════════════════════════════════════════════════════════════════════
const reasonless = Object.entries(CUSTOMER_IGNORED_SOURCE_FIELDS).filter(([, r]) => !r || r.trim().length < 20);
ok(reasonless.length === 0,
  `B1 — every ignored field carries a real reason. Reasonless: [${reasonless.map(([k]) => k).join(', ')}]. "Ignored" with no reason is indistinguishable from "nobody looked"`);

const mappedSet = new Set(CUSTOMER_FIELD_MAP.map(m => m.path));
const contradictory = Object.keys(CUSTOMER_IGNORED_SOURCE_FIELDS).filter(p => mappedSet.has(p));
ok(contradictory.length === 0,
  `B2 — no path is both mapped and ignored. Contradictory: [${contradictory.join(', ')}]`);

{
  // RED-FIRST: the contradiction really is detected, not merely absent today.
  const bad = { ...CUSTOMER_IGNORED_SOURCE_FIELDS, 'BillAddr.Line1': 'a reason long enough to pass B1' };
  const a = auditImportFields({ records: RECORDS, ignored: bad });
  ok(a.declarationFindings.some(d => d.kind === 'ignored-and-mapped' && d.path === 'BillAddr.Line1'),
    'B3 — RED-FIRST: declaring a MAPPED path as ignored is caught. Without this the two declarations could disagree silently and the field would vanish from check ① while still being imported');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§C — THE SHAPE CLASSIFIER: form, not meaning — WITH its negative controls');
// ══════════════════════════════════════════════════════════════════════════════════════════
const SHAPE_CASES: [string, ValueShape, string][] = [
  ['(512) 456-3632',      'phone',    'the LAWNS form: punctuated, ten digits, no letters'],
  ['512-456-3632',        'phone',    'hyphenated'],
  ['5124563632',          'phone',    'bare ten digits'],
  ['1-512-456-3632',      'phone',    'eleven with a leading country 1'],
  ['400 Honeycomb Mesa',  'street',   'number then words — the commonest American street form'],
  ['County Road 279',     'street',   'a suffix word with the number LAST, which the number-first rule alone would miss'],
  ['PO Box 1183',         'street',   'a box is a mailing address, not "other"'],
  ['1234 Hwy 290',        'street',   '🔴 NEGATIVE CONTROL: seven digits after stripping — must NOT read as a phone'],
  ['78641',               'postcode', 'five digits'],
  ['78641-2201',          'postcode', 'ZIP+4'],
  ['78641',               'postcode', '🔴 NEGATIVE CONTROL: a five-digit zip must NOT reach the phone test'],
  ['lauren@example.com',  'email',    'an @ with a dotted domain'],
  ['Leander',             'wordlike', 'letters, no digits'],
  ['TX',                  'wordlike', 'a state code is wordlike, not "other"'],
  ['',                    'other',    'empty is not a shape'],
  ['???',                 'other',    '🔴 NEGATIVE CONTROL: an unclassifiable value is `other`, and `other` is NEVER reported as a finding — D-9, we do not fabricate a verdict'],
  ['n/a',                 'wordlike', '⚠️ A STATED BOUNDARY, NOT A BUG: "n/a" is letters-with-no-digits, so it reads wordlike and an "n/a" sitting in `city` is NOT flagged. Check ② finds a value of the WRONG SHAPE; a value of the right shape that means nothing is a different defect needing a different check'],
];
for (const [v, want, why] of SHAPE_CASES) {
  ok(classifyValueShape(v) === want, `C — "${v || '(empty)'}" → ${want}: ${why} (got ${classifyValueShape(v)})`);
}
ok(classifyValueShape(null) === 'other' && classifyValueShape(undefined) === 'other',
  'C2 — null and undefined are `other`, never a shape');

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§D — CHECK ①: A SOURCE FIELD WITH DATA, MAPPED TO NOTHING');
// ══════════════════════════════════════════════════════════════════════════════════════════
const byPath = new Map(AUDIT.unmappedWithData.map(u => [u.path, u]));

ok(byPath.get('BillAddr.Line2')?.withData === LINE2_VALUES,
  `D1 — THE HEADLINE FINDING: \`BillAddr.Line2\` has ${LINE2_VALUES} values and is mapped to nothing (got ${byPath.get('BillAddr.Line2')?.withData}). This is the field holding ${STREET_IN_LINE2} real streets`);

ok(byPath.get('ShipAddr.Line1')?.withData === WITH_SHIPADDR,
  `D2 — \`ShipAddr.Line1\` has ${WITH_SHIPADDR} values and is mapped to nothing (got ${byPath.get('ShipAddr.Line1')?.withData}). The importer reads BillAddr and ignores ShipAddr entirely`);

ok(byPath.get('PaymentMethodRef.value') !== undefined,
  'D3 — 🔴 THE POPULATION IS DERIVED, NOT DECLARED: `PaymentMethodRef.value` is in NEITHER declaration and is still reported. A field nobody has heard of must show up the first time a record carries one, or the check only ever finds what someone already knew about');

for (const ignoredPath of ['SyncToken', 'domain', 'MetaData.CreateTime', 'DefaultTaxCodeRef.value', 'PreferredDeliveryMethod']) {
  ok(!byPath.has(ignoredPath),
    `D4 — \`${ignoredPath}\` carries a value on all ${TOTAL} records and is NOT reported, because it is declared with a reason. Without this list the one finding that matters sits under twenty that do not (tech-debt #73)`);
}
for (const mappedPath of ['BillAddr.Line1', 'BillAddr.City', 'PrimaryPhone.FreeFormNumber']) {
  ok(!byPath.has(mappedPath), `D5 — \`${mappedPath}\` is mapped, so check ① is silent about it`);
}
ok(byPath.get('BillAddr.Line2')!.looksLike === 'street',
  'D6 — the finding says what the lost values LOOK like. "471 values" is a number; "471 values, mostly street addresses" is the reason to act');
ok(AUDIT.unmappedWithData[0].withData >= AUDIT.unmappedWithData[AUDIT.unmappedWithData.length - 1].withData,
  'D7 — findings are ordered by how much data is being lost, biggest first');

// 🔴 D8 — THE TWO CHECKS TOGETHER SAY SOMETHING NEITHER SAYS ALONE, AND IT IS THE ANSWER TO
// *"can we just read Line2 instead?"*. Check ② counts **486** broken street columns; of those,
// check ① finds only **458** streets sitting one line down. **The difference is 28 records that
// carry a phone in Line1 and NO Line2 at all** — a population NO remap can repair, because there
// is nothing to move. A build that swapped the two lines would leave those 28 with a NULL street
// and would call itself a fix.
{
  const brokenStreetColumns = AUDIT.columnShapeFindings
    .find(f => f.column === 'address_line1' && f.detected === 'phone')!.count;
  const streetsHidingInLine2 = STREET_IN_LINE2;
  ok(brokenStreetColumns - streetsHidingInLine2 === NO_LINE2,
    `D8 — ${brokenStreetColumns} broken street columns minus ${streetsHidingInLine2} streets recoverable from Line2 = ${NO_LINE2} records with NO street anywhere in the capture. Neither check states this on its own; the pair does`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§E — CHECK ②: A DESTINATION COLUMN HOLDING THE WRONG SHAPE — AND THE MIRROR COUNTED ONCE');
// ══════════════════════════════════════════════════════════════════════════════════════════
const line1Finding = AUDIT.columnShapeFindings.find(f => f.column === 'address_line1' && f.detected === 'phone');
ok(line1Finding?.count === PHONE_IN_LINE1,
  `E1 — THE GO-LIVE BLOCKER: ${PHONE_IN_LINE1} of the values mapped into \`address_line1\` look like phone numbers (got ${line1Finding?.count}). A stop addressed to a phone number cannot go on a truck`);
ok(line1Finding?.ofValues === TOTAL,
  `E2 — the finding carries its DENOMINATOR: ${PHONE_IN_LINE1} of ${TOTAL}, not a bare count. R-110 — a surface may only assert what it got from the operation it describes`);

// 🔴 THE R-110 GUARD, AND IT IS THE ASSERTION MOST LIKELY TO SAVE SOMEBODY LATER.
ok(line1Finding!.count !== PHONE_IN_LINE1 * 2,
  `E3 — THE MIRROR IS NOT DOUBLE-COUNTED. D-41 writes address_line1 AND billing_line1 from ONE source value; counting both reports ${PHONE_IN_LINE1 * 2} phone numbers where there are ${PHONE_IN_LINE1}`);
const mirrorColumns = new Set(CUSTOMER_FIELD_MAP.flatMap(m => m.mirrors ?? []));
ok(!AUDIT.columnShapeFindings.some(f => mirrorColumns.has(f.column)),
  `E4 — no finding is RAISED AGAINST a mirror column [${[...mirrorColumns].join(', ')}]. The mirrors are named inside the canonical finding instead`);
ok((line1Finding?.mirrors ?? []).includes('billing_line1'),
  'E5 — and the mirror IS named, so nobody reads the finding as "only one of the two columns is wrong"');

ok(!AUDIT.columnShapeFindings.some(f => f.column === 'city' || f.column === 'state' || f.column === 'zip' || f.column === 'email'),
  'E6 — the columns that are CORRECT report nothing. A check that flags everything is as useless as one that flags nothing');

{
  // RED-FIRST on check ②: make the city column hold phone numbers and watch it fire.
  const broken = RECORDS.map(r => ({ ...r, BillAddr: { ...(r.BillAddr as Record<string, unknown>), City: '(512) 555-0100' } }));
  const a = auditImportFields({ records: broken });
  const f = a.columnShapeFindings.find(x => x.column === 'city');
  ok(f?.detected === 'phone' && f.count === TOTAL,
    `E7 — RED-FIRST: put a phone in every City and check ② reports ${TOTAL} of ${TOTAL} against \`city\`. The check can refuse, which is the only reason its green means anything (§6 r19)`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§F — NEITHER CHECK IS EVER SILENT (David\'s clause, and the reason the type says `ran: true`)');
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  // A capture with nothing wrong with it: every mapped field correct, no unmapped data.
  const clean = [{
    Id: '1', DisplayName: 'Terry Tree', GivenName: 'Terry', FamilyName: 'Tree', Taxable: true,
    PrimaryPhone: { FreeFormNumber: '(512) 456-3632' },
    PrimaryEmailAddr: { Address: 'terry@example.com' },
    BillAddr: { Line1: '400 Honeycomb Mesa', City: 'Leander', CountrySubDivisionCode: 'TX', PostalCode: '78641' },
    SyncToken: '1',
  }];
  const a = auditImportFields({ records: clean });
  ok(a.ran === true, 'F1 — `ran` is true on a CLEAN capture. It is a literal on the type, so a panel can distinguish "checked, found nothing" from "never ran"');
  ok(a.unmappedWithData.length === 0 && a.columnShapeFindings.length === 0 && a.declarationFindings.length === 0,
    'F2 — a clean capture really does produce no findings, so F3 is testing the silent case and not a lucky one');
  ok(a.headline.length > 0 && /found nothing/i.test(a.headline) && a.headline.includes('1 record'),
    `F3 — 🔴 THE CLAUSE: a clean result STILL SAYS WHAT IT DID — "${a.headline}". A blank panel is indistinguishable from a check that did not run`);
  ok(a.sourceFieldsSeen > 0 && a.headline.includes(String(a.sourceFieldsSeen)),
    'F4 — and it states the SCOPE it covered, so "found nothing" can be weighed against how much was looked at');
}
ok(AUDIT.headline.length > 0 && /before you import/i.test(AUDIT.headline),
  `F5 — a DIRTY result says so in the same sentence position: "${AUDIT.headline}"`);

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§G — THE EXAMPLES ARE SAFE TO PUT ON A SCREEN BESIDE ~1,900 REAL PEOPLE (R-23)');
// ══════════════════════════════════════════════════════════════════════════════════════════
const allExamples = [
  ...AUDIT.unmappedWithData.flatMap(u => u.examples),
  ...AUDIT.columnShapeFindings.flatMap(f => f.examples),
];
ok(allExamples.length > 0, 'G0 — ANCHOR: there ARE examples to check. A masking assertion over an empty list passes on nothing (tech-debt #182)');
ok(!allExamples.some(e => /[A-WYZa-wyz]/.test(e)),
  `G1 — NO LETTER SURVIVES MASKING except the placeholder \`x\`. Samples: ${allExamples.slice(0, 3).join(' | ')}`);
ok(!allExamples.some(e => (e.replace(/[^0-9]/g, '').length > 3)),
  'G2 — at most three digits survive, so an area code is legible and a phone number is not reconstructable');
ok(maskExample('(512) 456-3632') === '(512) •••-••••',
  `G3 — the headline case reads as a phone and identifies nobody: ${maskExample('(512) 456-3632')}`);
ok(!/Honeycomb/.test(maskExample('400 Honeycomb Mesa')),
  `G4 — a street NAME does not survive: ${maskExample('400 Honeycomb Mesa')}`);
ok(maskExample('terry@example.com').indexOf('terry') === -1,
  `G5 — nor does a mailbox name: ${maskExample('terry@example.com')}`);

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§H — MUTANTS THAT CHANGE THE POPULATION, NOT THE SUBJECT (tech-debt #182)');
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const a = auditImportFields({ records: [] });
  ok(a.ran === true && a.recordsExamined === 0 && /no records/i.test(a.headline),
    `H1 — an EMPTY capture says "there were no records to check", not "found nothing". Those are different answers and only one of them is evidence — "${a.headline}"`);
  ok(a.declarationFindings.length === 0,
    'H2 — and it does NOT report all 16 mappings as `mapped-but-absent`. Over zero records every mapping is trivially absent, which would be sixteen findings about nothing');
}
{
  // 🔴 THE POPULATION KEEPS ITS SIZE AND LOSES ONE LEAF. This is the mutant that changes the
  // POPULATION rather than the subject — the exact shape tech-debt #182 says none of our 13
  // harnesses have. Every record still arrives, `BillAddr` still arrives, and `Line1` is gone:
  // the fingerprint of an upstream rename, at 1,946 records rather than in a two-row fixture.
  const renamed = RECORDS.map(r => {
    const bill = { ...(r.BillAddr as Record<string, unknown>) };
    delete bill.Line1;
    return { ...r, BillAddr: bill };
  });
  const a = auditImportFields({ records: renamed });
  ok(a.recordsExamined === TOTAL && a.declarationFindings.some(d => d.kind === 'mapped-but-absent' && d.path === 'BillAddr.Line1'),
    `H3 — ${TOTAL} records keep BillAddr and lose Line1, and the audit names \`BillAddr.Line1\` as mapped-but-absent. Without this the import would write ${TOTAL} empty street addresses and every count on the preview would still be right`);
  ok(!a.columnShapeFindings.some(f => f.column === 'address_line1'),
    'H4 — and the shape finding for `address_line1` GOES AWAY when the values do, rather than persisting off a stale tally');
}
{
  // The other population mutant: the records survive and carry almost nothing.
  const stripped = RECORDS.map(() => ({ Id: 'x', DisplayName: 'y' }));
  const a = auditImportFields({ records: stripped });
  ok(a.recordsExamined === TOTAL && a.sourceFieldsSeen === 2 && a.headline.includes('2 fields'),
    `H5 — 🔴 THE COUNT IS STATED WITH ITS SCOPE. ${TOTAL} records carrying TWO fields report "found nothing" — which is TRUE — and the headline says it looked at 2 fields, so a reader can see the sweep was empty rather than clean. A scanner that reports a count it never states an expectation for cannot fail (#182)`);
  ok(a.unmappedWithData.length === 0 && a.columnShapeFindings.length === 0,
    'H6 — and it invents no findings out of absent values');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§I — flattenPaths: the population is the SHAPE of the records, not their size');
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const paths = flattenPaths({ A: 1, B: { C: 2, D: { E: 3 } } });
  ok(paths.has('A') && paths.has('B.C') && paths.has('B.D.E') && !paths.has('B'),
    'I1 — nesting flattens to dotted scalar paths, and a container is not itself a path');
  const one  = flattenPaths({ L: [{ X: 1 }] });
  const many = flattenPaths({ L: [{ X: 1 }, { X: 2 }, { X: 3 }] });
  ok([...one.keys()].join() === [...many.keys()].join() && one.has('L[].X'),
    '🔴 I2 — an array collapses to ONE path ending `[]`. Indexed paths would make the discovered field set grow with the DATA, so a company with more of something would appear to have more unmapped fields');
  ok(many.get('L[].X')!.length === 3, 'I3 — and the VALUES still all arrive, so the count of records carrying data is right');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§J — THE WIRING: the audit reaches the preview through adaptCustomers');
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const body = JSON.stringify({ QueryResponse: { Customer: RECORDS.slice(0, 500) } });
  const adaptation = adaptCustomers([body]);
  ok(adaptation.fieldAudit.ran === true && adaptation.fieldAudit.recordsExamined === 500,
    'J1 — `adaptCustomers` computes the audit over the RAW records it parsed, which is the last layer that still holds them');
  ok(adaptation.fieldAudit.columnShapeFindings.some(f => f.column === 'address_line1'),
    'J2 — and the go-live finding survives the trip through the real entry point, not just the direct call (R-110: drive the real entry points)');
}
{
  // 🔴 THE POPULATION IS EVERY RECORD QUICKBOOKS SENT, INCLUDING ONES THE ADAPTER REFUSES.
  const refused = [{ DisplayName: 'no id at all', BillAddr: { Line2: '400 Honeycomb Mesa' } }];
  const body = JSON.stringify({ QueryResponse: { Customer: refused } });
  const adaptation = adaptCustomers([body]);
  ok(adaptation.customers.length === 0 && adaptation.fieldAudit.recordsExamined === 1,
    'J3 — a record the adapter REFUSES is still examined by the field check. Filtering to what we could use would hide a field precisely when the record carrying it was the one we could not read');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§K — EXPECTED_COLUMN_SHAPE covers the columns that have a shape, and says so');
// ══════════════════════════════════════════════════════════════════════════════════════════
{
  const checked = new Set(Object.keys(EXPECTED_COLUMN_SHAPE));
  const mappedCols = new Set(CUSTOMER_FIELD_MAP.map(m => m.column));
  const unchecked = [...mappedCols].filter(c => !checked.has(c)).sort();
  ok(unchecked.join(',') === 'display_name,first_name,last_name,notes,organization_name,qb_customer_id,tax_exempt,tax_exempt_cert_ref,tax_exempt_reason',
    `K1 — the UNCHECKED columns are exactly the ones a human can legitimately type anything into, plus PERSONAL NAMES (a surname can be anything) and the identity and tax triple. Got: [${unchecked.join(', ')}]. An "expected shape" for \`notes\` would manufacture findings out of ordinary data`);
  ok([...checked].every(c => mappedCols.has(c)),
    'K2 — no expectation is declared for a column nothing maps into. That would be an assertion that could never run — [[R-33]]');
}

console.log(`\n  importFieldAudit: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
