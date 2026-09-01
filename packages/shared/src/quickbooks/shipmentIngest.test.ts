/**
 * ── shipmentIngest — the ship-to parse, and every place it must refuse ────────────────
 *
 * 🔴 §C IS THE ONE THAT MATTERS. A delivery at the wrong address sends a crew and a $7,000 tree
 * to the wrong house; a flagged row costs Lauren a minute. Every assertion in §C is a case where
 * a plausible guess was available and the parser declined it.
 *
 * 🔴 §A ASSERTS THE THING THE PROMPT SAID WAS TRUE, WHICH IS NOT THE SAME AS ASSUMING IT. David
 * measured the lines as name / phone / street / "City, ST ZIP". The parser does not READ them in
 * that order — it classifies each by shape — so §A also runs the SHUFFLED and the
 * PHONE-OMITTED blocks, which a position-keyed parse would get silently wrong.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/shipmentIngest.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  parseShipmentList, isPhoneLine, classifyAddressLine, parseCityStateZip, parseShipTo, addrLines,
  looksLikeOrganization, splitDisplayName, isOnOrAfter, selectFutureShipments,
  buildDeliveryPlan, resolveIngestCustomer, deliveryNoteFor, DELIVERY_INGEST_SOURCE,
  type QboAddr, type QboShipmentRow, type ExistingCustomer,
} from './shipmentIngest';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const freeform = (l1: string, l2: string, l3: string, l4: string): QboAddr =>
  ({ line1: l1, line2: l2, line3: l3, line4: l4, line5: null, city: null, state: null, zip: null });
const structured = (line1: string, city: string, state: string, zip: string): QboAddr =>
  ({ line1, line2: null, line3: null, line4: null, line5: null, city, state, zip });

// The block exactly as David measured it.
const LYDIA = freeform('Lydia Yustman', '(951) 323-3061', '105 Out Crop View Lane', 'Lakeway, TX  78738');

// ══ §A THE SHAPE — read rather than assumed, and NOT keyed on position ══════
{
  const r = parseShipTo(LYDIA, null);
  ok(r.ok, 'the measured four-line ship-to block parses');
  if (r.ok) {
    ok(r.addressLine1 === '105 Out Crop View Lane', 'the STREET is the street line, not the name line');
    ok(r.city === 'Lakeway' && r.state === 'TX' && r.zip === '78738', 'city / state / zip come off the "City, ST  ZIP" line — double space and all');
    ok(r.phone === '(951) 323-3061', '🔴 THE PHONE IS TAKEN — it is a contact number on a customer record that may carry none, and the call-ahead depends on it');
    ok(r.nameLine === 'Lydia Yustman', 'the name line is carried for corroboration');
    ok(r.cityStateZipFrom === 'ship-line', 'and the parse says WHERE it got the town, so the preview can show it');
  }

  // 🔴 THE POSITION TEST. Same four facts, different order — a Line3-is-the-street parser
  // returns a phone number as a street here and nothing notices.
  const shuffled = freeform('105 Out Crop View Lane', 'Lakeway, TX 78738', 'Lydia Yustman', '(951) 323-3061');
  const s = parseShipTo(shuffled, null);
  ok(s.ok && s.addressLine1 === '105 Out Crop View Lane' && s.zip === '78738' && s.phone === '(951) 323-3061',
     '🔴 the SAME block in a different order parses identically — position is used for nothing');

  // The phone omitted: every line shifts up by one. A positional parse mints an address here.
  const noPhone: QboAddr = { ...freeform('Lydia Yustman', '105 Out Crop View Lane', 'Lakeway, TX 78738', ''), line4: null };
  const n = parseShipTo(noPhone, null);
  ok(n.ok && n.addressLine1 === '105 Out Crop View Lane' && n.city === 'Lakeway',
     'a block with no phone line still parses — the shift does not corrupt the street');
  ok(n.ok && n.phone === null, 'and the missing phone is ABSENT, never invented (A9: absent is not empty)');
}

// ══ §B CLASSIFICATION — the exact shapes first, evidence-only for street ════
{
  ok(classifyAddressLine('(951) 323-3061') === 'phone', 'a formatted phone is a phone');
  ok(classifyAddressLine('951-323-3061') === 'phone', 'so is a dashed one');
  ok(classifyAddressLine('Lakeway, TX  78738') === 'city-state-zip', 'City, ST ZIP is recognised exactly');
  ok(classifyAddressLine('Leander, TX 78641-1234') === 'city-state-zip', 'a ZIP+4 is still a city line');
  ok(classifyAddressLine('105 Out Crop View Lane') === 'street', 'a line opening with a house number is a street — no suffix list needed');
  ok(classifyAddressLine('PO Box 41') === 'street', 'a numberless PO Box is rescued by the token list');
  ok(classifyAddressLine('County Road 200') === 'street', 'and a County Road');
  ok(classifyAddressLine('Lydia Yustman') === 'name', 'a bare name is a NAME — the classification that cannot cause a wrong delivery');
  ok(classifyAddressLine('Bishop Landscaping LLC') === 'name', 'a company name with no street evidence is a name, not a street');
  // 🔴 A ZIP MUST NEVER READ AS A PHONE and a house number must never read as one.
  ok(classifyAddressLine('78738') !== 'phone', '🔴 a five-digit ZIP is NOT a phone');
  // 🔴 THE REGRESSION BLOCK. The first version of this file classified with `normalizePhone`,
  // which its own header describes as a trimmer — it returns non-null for ANY non-blank string,
  // so every line in every address was a "phone" and no address had a street. These four
  // assertions are the shape of that bug, pinned so no future reuse can reintroduce it.
  ok(!isPhoneLine('Lydia Yustman'), '🔴 a NAME is not a phone line — the bug that made every address unparseable');
  ok(!isPhoneLine('2200 Ranch Road 620'), '🔴 a street with 7+ digits in it is not a phone line either');
  ok(!isPhoneLine('78738'), 'a ZIP is not a phone line');
  ok(isPhoneLine('(951) 323-3061') && isPhoneLine('9513233061') && isPhoneLine('1-951-323-3061'),
     'and the three shapes a real phone arrives in all are');
  ok(classifyAddressLine('105') !== 'phone', 'a house number is NOT a phone');
  ok(parseCityStateZip('Lakeway, TX  78738')!.state === 'TX', 'the state is upper-cased');
  ok(parseCityStateZip('Lakeway TX 78738') === null, 'without the comma it is not a city line — and it must not be guessed into one');
  ok(parseCityStateZip('') === null && parseCityStateZip(null) === null, 'empty and null are not city lines');
}

// ══ §C REFUSALS — every place a guess was available and declined ════════════
{
  const noStreet = parseShipTo(freeform('Lydia Yustman', '(951) 323-3061', 'Attn: back gate', 'Lakeway, TX 78738'), null);
  ok(!noStreet.ok, '🔴 no street line → REFUSED, not approximated');
  ok(!noStreet.ok && noStreet.lines.length === 4, 'and the refusal carries the RAW LINES, so Lauren can read what the parser saw');

  const twoStreets = parseShipTo(freeform('105 Out Crop View Lane', '(951) 323-3061', '2200 Ranch Road 620', 'Lakeway, TX 78738'), null);
  ok(!twoStreets.ok, '🔴 TWO street-shaped lines → REFUSED. Taking the first is right most of the time, and the rest of the time it is a crew at the wrong house');
  ok(!twoStreets.ok && /both look like a street/.test(twoStreets.reason), 'and the reason names the ambiguity rather than saying "parse error"');

  const noTown = parseShipTo(freeform('Lydia Yustman', '(951) 323-3061', '105 Out Crop View Lane', 'Texas'), null);
  ok(!noTown.ok, 'no readable city/state/zip → REFUSED');

  ok(!parseShipTo(null, structured('1 Main St', 'Leander', 'TX', '78641')).ok,
     '🔴 NO ship-to at all → REFUSED EVEN THOUGH A COMPLETE BILLING ADDRESS WAS SITTING RIGHT THERE. The bill goes to the billing address; the tree does not');

  ok(!parseShipTo({ line1: null, line2: null, line3: null, line4: null, line5: null, city: null, state: null, zip: null }, null).ok,
     'an empty ship-to block refuses');
}

// ══ §D THE BILLING FALLBACK — preferred, but never over a disagreement ══════
{
  // Free-form ship-to with NO city line; billing carries it properly typed.
  const shipNoTown = freeform('Lydia Yustman', '(951) 323-3061', '105 Out Crop View Lane', '');
  shipNoTown.line4 = null;
  const r = parseShipTo(shipNoTown, structured('105 Out Crop View Lane', 'Lakeway', 'tx', '78738'));
  ok(r.ok && r.city === 'Lakeway' && r.state === 'TX' && r.zip === '78738',
     'a properly STRUCTURED BillAddr supplies the town when the ship-to has no city line — a real field beats a regex');
  ok(r.ok && r.cityStateZipFrom === 'bill-structured', 'and the preview is told it came from billing');

  // 🔴 THE GUARD: billing says one town, the ship-to line says another.
  const conflict = parseShipTo(LYDIA, structured('9 Elsewhere Dr', 'Georgetown', 'TX', '78626'));
  ok(conflict.ok && conflict.city === 'Lakeway',
     '🔴 when the ship-to names its OWN town, the ship-to WINS — a structured billing city must never redirect a delivery, because being billed at home and delivered to a job site is ordinary here');
  ok(conflict.ok && /Georgetown/.test(conflict.note ?? ''),
     'and the disagreement is SURFACED rather than swallowed — Lauren sees the billing town without the row being blocked over it');
  ok(r.ok && r.note === null, 'when billing and ship-to agree there is no note to read');
  const shipNoTown2 = freeform('Lydia Yustman', '(951) 323-3061', '105 Out Crop View Lane', '');
  shipNoTown2.line4 = null;
  ok(parseShipTo(shipNoTown2, structured('9 Elsewhere Dr', 'Georgetown', 'TX', '78626')).ok,
     'with no competing ship-to town, the billing town is used rather than refusing — the fallback still earns its keep');

  const structuredShip = structured('105 Out Crop View Lane', 'Lakeway', 'TX', '78738');
  const s = parseShipTo(structuredShip, null);
  ok(s.ok && s.addressLine1 === '105 Out Crop View Lane' && s.cityStateZipFrom === 'ship-structured',
     'a fully STRUCTURED ship-to needs no line parsing at all, and Line1 is allowed to be the street there');
}

// ══ §E DATES — strings, never Date ══════════════════════════════════════════
{
  ok(isOnOrAfter('2026-09-05', '2026-08-31'), 'a September ship date is in the future on 31 August');
  ok(isOnOrAfter('2026-08-31', '2026-08-31'), '🔴 TODAY counts — a stop scheduled for this morning is still a stop');
  ok(!isOnOrAfter('2026-08-30', '2026-08-31'), 'yesterday does not');
  ok(!isOnOrAfter(null, '2026-08-31'), 'no ship date is not a future ship date');
  ok(!isOnOrAfter('', '2026-08-31') && !isOnOrAfter('09/05/2026', '2026-08-31'),
     'a malformed date is refused rather than coerced — the Date() version of this line is the timezone bug invoiceList already warns about');

  const rows = [
    { id: '3', shipDate: '2026-10-17' }, { id: '1', shipDate: '2026-09-05' },
    { id: '9', shipDate: null }, { id: '2', shipDate: '2026-09-05' }, { id: '0', shipDate: '2025-01-01' },
  ] as QboShipmentRow[];
  const sel = selectFutureShipments(rows, '2026-08-31');
  ok(sel.length === 3, 'only the future-dated rows are selected');
  ok(sel.map(r => r.id).join(',') === '1,2,3', 'oldest first, ties broken by invoice id — a stable order a person can re-read');
}

// ══ §F WHO THE CUSTOMER IS ═════════════════════════════════════════════════
{
  ok(looksLikeOrganization('Bishop Landscaping LLC'), 'an LLC is an organisation');
  ok(looksLikeOrganization('Cedar Park HOA'), 'so is an HOA');
  ok(!looksLikeOrganization('Lydia Yustman'), 'a person is not');
  ok(!looksLikeOrganization('Robert Dees'), 'nor is Robert Dees');

  const p = splitDisplayName('Lydia Yustman');
  ok(p.first === 'Lydia' && p.last === 'Yustman' && !p.isOrg, 'a person splits first/last');
  ok(splitDisplayName('Mary Anne Van Der Berg').last === 'Berg', 'a long name keeps everything but the last token in first_name');
  const o = splitDisplayName('Bishop Landscaping LLC');
  ok(o.first === 'Bishop Landscaping LLC' && o.last === '' && o.isOrg,
     '🔴 an ORG keeps its WHOLE name in first_name — customerUpsert\'s org branch matches on exactly that, and splitting it would break the dedup key it depends on');
  ok(splitDisplayName('Cher').first === 'Cher' && splitDisplayName('Cher').last === '', 'a one-word person name does not invent a surname');
  ok(splitDisplayName(null).first === '', 'a null display name yields an empty first name — which the planner then BLOCKS');
}

// ══ §G THE PLAN ════════════════════════════════════════════════════════════
const mk = (id: string, name: string, shipDate: string | null, ship: QboAddr | null, amt = 6600): QboShipmentRow => ({
  id, docNumber: `10${id}`, shipDate, txnDate: '2026-08-01', totalAmt: amt,
  customerId: `C${id}`, customerName: name, shipAddr: ship, billAddr: null,
  // Added 2026-08-31: the row now also carries the invoice's own lines and tax, because the
  // SAME walk feeds the order ingest. This fixture is about ADDRESSES, so both are empty —
  // and they are stated rather than omitted, so a reader is not left wondering.
  lines: [], totalTax: null,
});
{
  const rows = [
    mk('1', 'Lydia Yustman', '2026-10-17', LYDIA),
    mk('2', 'Robert Dees',   '2026-10-03', freeform('Robert Dees', '512-555-0101', '900 Bagdad Rd', 'Leander, TX 78641')),
    mk('3', 'Old Job',       '2025-05-05', LYDIA),                                   // past — filtered
    // ⚠️ 'Attn: back gate' and NOT 'no street here' — the first draft of this fixture used the
    // latter and it PARSED, because it contains the word "street". The fixture, not the parser,
    // was wrong; a test whose negative case is secretly a positive proves nothing.
    mk('4', 'Bad Address',   '2026-09-05', freeform('Someone', '512-555-0102', 'Attn: back gate', 'Leander, TX 78641')),
    mk('5', 'No Name',       '2026-09-05', LYDIA),
  ];
  rows[4].customerName = null;

  const plan = buildDeliveryPlan(rows, '2026-08-31');
  ok(plan.invoicesRead === 5, 'the DENOMINATOR is reported — "18 of 1,469" is a measurement, not a hope');
  ok(plan.futureShipDates === 4, 'the past-dated invoice is filtered out before anything else happens');
  ok(plan.stops.length === 2, 'two stops are writable');
  ok(plan.blocked.length === 2, 'and two are blocked — the unparseable address and the nameless invoice');
  ok(plan.blocked.some(b => /no line .* looks like a street/i.test(b.reason)), 'the address refusal is reported with its reason');
  ok(plan.blocked.some(b => /names no customer/.test(b.reason)), '🔴 an invoice with no customer BLOCKS — a stop with nobody to belong to is not a stop');
  ok(plan.stops[0].deliveryDate === '2026-10-03' && plan.stops[1].deliveryDate === '2026-10-17', 'stops come back in date order');
  ok(plan.stops.every(s => !s.alreadyIngested), 'with an empty ingested set, nothing reads as already done');

  // 🔴 IDEMPOTENCY, AT THE PLANNING LAYER. The second run must plan ZERO writes.
  const second = buildDeliveryPlan(rows, '2026-08-31', new Set(['1', '2']));
  ok(second.stops.length === 2 && second.stops.every(s => s.alreadyIngested),
     '🔴 RUN IT TWICE AND EVERY STOP READS "already ingested" — the second run plans no writes at all');
  const partial = buildDeliveryPlan(rows, '2026-08-31', new Set(['2']));
  ok(partial.stops.filter(s => !s.alreadyIngested).length === 1,
     'and a HALF-finished run resumes exactly where it stopped — which is what the key buys beyond de-duplication');

  ok(/invoice #101/.test(deliveryNoteFor(rows[0])) && /2026-10-17/.test(deliveryNoteFor(rows[0])),
     'every ingested row carries its own provenance — which invoice, which ship date');
  ok(DELIVERY_INGEST_SOURCE === 'qbo-shipdate',
     'and one source value names this ingest, so these rows stay distinguishable from Lauren\'s own forever');
}

// ══ §H CUSTOMER RESOLUTION — link on a guarantee, refuse on a guess ═════════
{
  const stop = buildDeliveryPlan([mk('7', 'Lydia Yustman', '2026-09-05', LYDIA)], '2026-08-31').stops[0];
  const c = (id: string, qb: string | null, f: string, l: string): ExistingCustomer =>
    ({ id, qb_customer_id: qb, first_name: f, last_name: l });

  const byQb = resolveIngestCustomer(stop, [c('u1', 'C7', 'Completely', 'Different'), c('u2', null, 'Lydia', 'Yustman')]);
  ok(byQb.action === 'link' && byQb.customerId === 'u1',
     '🔴 qb_customer_id WINS OVER A NAME MATCH — it is the one key QuickBooks guarantees, so a match on it is not an inference');

  const byName = resolveIngestCustomer(stop, [c('u2', null, 'Lydia', 'Yustman')]);
  ok(byName.action === 'link' && byName.customerId === 'u2', 'a UNIQUE name match links');

  const twoNames = resolveIngestCustomer(stop, [c('u2', null, 'Lydia', 'Yustman'), c('u3', null, 'Lydia', 'Yustman')]);
  ok(twoNames.action === 'surface',
     '🔴 TWO name matches → SURFACED, never merged. A wrong merge is silent and permanent; a flagged row costs a minute');

  const twoQb = resolveIngestCustomer(stop, [c('u1', 'C7', 'A', 'B'), c('u4', 'C7', 'C', 'D')]);
  ok(twoQb.action === 'surface', 'two rows carrying the SAME QuickBooks id is an ambiguity too — it does not pick one');

  ok(resolveIngestCustomer(stop, []).action === 'create', 'nobody matching → create');
  ok(resolveIngestCustomer(stop, [c('u9', 'C-OTHER', 'Someone', 'Else')]).action === 'create',
     'a different customer with a different QuickBooks id is not a match');
}

// ══ §I THE WIRE — Intuit's nesting, read rather than assumed ════════════════
{
  const body = JSON.stringify({ QueryResponse: { Invoice: [{
    Id: '2101', DocNumber: '3648', TxnDate: '2026-08-01', ShipDate: '2026-09-05', TotalAmt: 6600,
    CustomerRef: { value: '58', name: 'Lydia Yustman' },
    ShipAddr: { Id: '9', Line1: 'Lydia Yustman', Line2: '(951) 323-3061',
                Line3: '105 Out Crop View Lane', Line4: 'Lakeway, TX  78738' },
    BillAddr: { Id: '9', Line1: '105 Out Crop View Lane', City: 'Lakeway',
                CountrySubDivisionCode: 'TX', PostalCode: '78738' },
  }] }, time: 'x' });
  const p = parseShipmentList(body);
  ok(p.ok && p.shipments.length === 1, 'the invoice list unwraps');
  const r = p.shipments[0];
  ok(r.shipDate === '2026-09-05', '🔴 ShipDate is READ — it is her delivery date and it is already in QuickBooks');
  ok(r.txnDate === '2026-08-01' && r.shipDate !== r.txnDate,
     'and it is kept SEPARATE from TxnDate — they differ on 553 of the 588 that carry one, so it is a real field she fills in');
  ok(r.customerName === 'Lydia Yustman' && r.customerId === '58', 'CustomerRef gives both the id and the name');
  ok(addrLines(r.shipAddr).length === 4, 'the free-form ship-to lines come through in order, blanks dropped');
  ok(r.billAddr?.city === 'Lakeway' && r.billAddr?.state === 'TX', 'and the structured billing fields come through as fields');
  ok(!parseShipmentList('not json').ok, 'an unreadable body is reported, never thrown');
  ok(parseShipmentList('not json').parseError !== null && !/not json/.test(String(parseShipmentList('not json').parseError)),
     'and the failure names itself without carrying the body into the error');
}

console.log(`\nshipmentIngest: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
