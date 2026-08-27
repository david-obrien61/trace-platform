/**
 * ── historyOrder — a captured document becomes an order, without becoming a sale event ──
 *
 * Written against the live situation that produced it: a business went live, scanned six real
 * customer invoices, and its dashboard still read $0 sales and 0 installs because each scan
 * produced a customer and a delivery and NO ORDER.
 *
 * The tests that matter most here are NOT the happy path. They are §A and §D:
 *   §A pins the two invariants that stop a history order from moving inventory. If either one
 *      is ever edited away, the failure is SILENT in production — available-to-sell quietly
 *      drops with no decrement, no ledger row and nothing on any screen. A silent failure is
 *      exactly the kind that has to fail loudly in a test instead.
 *   §D pins "a document with no customer produces no order". After the cleanup pass there is no
 *      vendor receipt left in the tenant to demonstrate that on, so it is proven here rather
 *      than by pointing at data.
 *
 * Run (pure TS, no db, no network — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/historyOrder.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildHistoryOrder, decodeCapturedDocument, historyOrderLines,
  transportMethodForService, HISTORY_ORDER_KIND, HISTORY_ORDER_STATUS,
} from './historyOrder';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/** A real envelope shape: the payload is a JSON STRING nested inside the provider's response. */
function envelope(payload: any, wrap = true) {
  const text = wrap ? '```json\n' + JSON.stringify(payload) + '\n```' : JSON.stringify(payload);
  return { candidates: [{ content: { parts: [{ text }] } }], responseId: 'x', modelVersion: 'y', usageMetadata: {} };
}

// Paul Christ's real invoice, the one whose total is quoted in every report on this build.
const PAUL = {
  vendor: 'LAWNS Tree Farm, LLC.', customer_name: 'Paul Christ', receipt_number: '3648.629',
  date: '08/26/2026', delivery_date: '08/29/2026', subtotal: 1550.00, tax: 127.88, amount: 1677.88,
};
const PAUL_LINES = [
  { sku: 'MS45', amount: 1500, quantity: 1, unit_price: 1500, description: 'Mexican Sycamore - 45 gallon' },
  { sku: 'TC',   amount: 50,   quantity: 1, unit_price: 50,   description: 'Trip Charge' },
];
const build = (over: any = {}) => buildHistoryOrder({
  businessId: 'biz-1', customerId: 'cust-1', receiptId: 'rec-1',
  documentDate: '2026-08-26', documentTotal: 1677.88,
  lineItemsOriginal: PAUL_LINES, decoded: decodeCapturedDocument(envelope(PAUL)),
  deliveryDate: '2026-08-29', serviceType: 'planting', ...over,
});

// ══ §A THE TWO INVARIANTS — the silent-failure guards ════════════════════════
{
  const d = build();
  ok(d.order.status === 'fulfilled',
    'INVARIANT 2: status is fulfilled — the ONLY non-cancelled status the committed-stock derivation excludes. Any other value makes the order hold a commitment against stock it never touched');
  ok(HISTORY_ORDER_STATUS === 'fulfilled', 'the constant itself is fulfilled');
  ok(d.order.status !== 'invoiced',
    'and it is NOT "invoiced" — that status is absent from ORDER_STATUSES, so it looks safe today and starts counting as OPEN the day the enum is ratified');
  ok(d.items.length === 2 && d.items.every(l => l.businessInventoryId === null),
    'INVARIANT 1: every line carries a NULL business_inventory_id — a lot id here silently reduces available-to-sell with no decrement and nothing to reverse');
  ok(d.order.order_kind === 'history' && HISTORY_ORDER_KIND === 'history',
    'the discriminator is set — it is what the QuickBooks re-push gate keys on');
}

// ══ §B THE MONEY — the document is the authority ═════════════════════════════
{
  const d = build();
  ok(d.order.subtotal === 1550.00, "subtotal comes off the document");
  ok(d.order.tax_amount === 127.88, 'tax comes off the document');
  ok(d.order.total_amount === 1677.88, 'total is the receipt amount — Paul Christ reads 1,677.88');
  ok(d.moneySource === 'document', 'and it says WHERE the money came from');
  ok(d.arithmeticBalances === true, 'Σlines === subtotal AND subtotal + tax === total');
  ok(d.lineSum === 1550.00, 'the line sum is reported so a mismatch can be shown, not just flagged');
  ok(d.order.sale_date === '2026-08-26',
    'sale_date is the DOCUMENT date. This is the whole point: six invoices backfilled in one afternoon must not report as that afternoon\'s revenue');
  ok(d.order.addons_amount === 0 && d.order.netting_declined === false,
    'add-on fields take their column defaults — nothing about them is claimed');
}

// ══ §C THE ENVELOPE — two-step decode, and honest failure ════════════════════
{
  ok(decodeCapturedDocument(envelope(PAUL))?.sourceDocumentNumber === '3648.629', 'decodes a fenced JSON payload');
  ok(decodeCapturedDocument(envelope(PAUL, false))?.sourceDocumentNumber === '3648.629', 'decodes an unfenced payload too');
  ok(decodeCapturedDocument(null) === null, 'null envelope → null, never a zeroed object');
  ok(decodeCapturedDocument({ rawText: 'not this shape' }) === null,
    'THE CLAUDE-FALLBACK SHAPE returns null rather than pretending — the fallback discards rawText, so this path is real');
  ok(decodeCapturedDocument({ candidates: [{ content: { parts: [{ text: 'no json here' }] } }] }) === null,
    'unparseable text → null');
  ok(decodeCapturedDocument(envelope({ receipt_number: 1331 }))?.sourceDocumentNumber === '1331',
    'a NUMERIC document number survives as a string — Lauren Frazier\'s invoice is literally 1331');
  ok(decodeCapturedDocument(envelope({ subtotal: 'n/a' }))?.subtotal === null,
    'a non-numeric subtotal is null, NOT NaN and NOT 0 (D-9: a fabricated 0.00 on a money field is worse than an admitted gap)');
}

// ══ §D NO CUSTOMER → NO ORDER ═══════════════════════════════════════════════
// The vendor-receipt case. There is no longer a live example in the tenant, so this is the proof.
{
  const mccoys = { vendor: "MCCOY'S BUILDING SUPPLY", customer_name: null, receipt_number: '735152',
    subtotal: 23.38, tax: 1.93, amount: 25.31 };
  const decoded = decodeCapturedDocument(envelope(mccoys));
  ok(decoded !== null, 'a vendor receipt still DECODES — it is a real document, just not a sale to anyone');
  ok(decoded!.customerName === null,
    'THE GATE: customer_name is null, and that is what the OCR door branches on. A receipt for hose, oil or emitters resolves no customer, so it never reaches the endpoint that writes an order — and the endpoint itself refuses 400 without customer.first_name. Two independent reasons, neither of which anyone has to remember');
}

// ══ §E DERIVED MONEY — when the envelope will not decode ═════════════════════
{
  const d = build({ decoded: null });
  ok(d.moneySource === 'derived', 'an undecodable envelope switches to derivation and SAYS SO');
  ok(d.order.subtotal === 1550.00, 'subtotal derives from Σ line amounts — arithmetic over data we hold');
  ok(d.order.tax_amount === 127.88, 'tax derives as total − subtotal');
  ok(d.order.source_document_number === null,
    "and the document number is NULL rather than invented — we genuinely do not know it");
  ok(d.arithmeticBalances === true, 'the derived figures still balance');
  ok(d.order.sale_date === '2026-08-26',
    'sale_date SURVIVES an undecodable envelope, because it comes from receipts.date — a first-class typed column, not the blob. This is why the dashboard fix does not depend on OCR at all');
}

// ══ §F AN IMBALANCED DOCUMENT IS REPORTED, NEVER REPAIRED ═══════════════════
{
  const d = build({ decoded: decodeCapturedDocument(envelope({ ...PAUL, subtotal: 1400.00 })) });
  ok(d.arithmeticBalances === false, 'a document whose lines do not sum to its subtotal is flagged');
  ok(d.order.subtotal === 1400.00,
    'and it is recorded AS PRINTED. On a captured sale the DOCUMENT is the authority — silently "fixing" it to 1550 would overwrite what the customer was actually invoiced');
  ok(d.lineSum === 1550.00, 'both numbers are available so the discrepancy can be shown');
}
{
  // 🔴 THE CLAUSE THE FIRST VERSION OF THIS TEST NEVER PROVED, and the likeliest real failure of
  // the three: OCR DROPS A LINE. The header stays internally consistent — subtotal + tax == total,
  // because those three came off the printed header together — while the transcribed lines quietly
  // sum to less than the subtotal they claim to explain. The case above broke BOTH clauses at once,
  // so `arithmeticBalances` went false for the wrong reason and the line-sum check was never
  // exercised. Found by planting a defect that only disabled the line-sum half and watching every
  // assertion stay green.
  const dropped = buildHistoryOrder({
    businessId: 'b', customerId: 'c', receiptId: 'r',
    documentDate: '2026-08-26', documentTotal: 1677.88,
    lineItemsOriginal: [PAUL_LINES[0]],                       // the Trip Charge line never transcribed
    decoded: decodeCapturedDocument(envelope(PAUL)),          // header still says 1550 + 127.88 = 1677.88
  });
  ok(Math.abs(dropped.order.subtotal + dropped.order.tax_amount - dropped.order.total_amount) < 0.005,
    'the header half still balances — which is exactly why this defect is invisible without the line check');
  ok(dropped.lineSum === 1500.00, 'the transcribed lines sum to 1500, not 1550');
  ok(dropped.arithmeticBalances === false,
    'A DROPPED LINE IS CAUGHT: Σlines !== subtotal must fail on its own, independently of the header arithmetic');
}

// ══ §G TRANSPORT METHOD — required, no default, taken from the physical record ══
{
  ok(transportMethodForService('planting') === 'install',
    "'planting' → 'install': the business puts it in the ground, which is what install has always meant here");
  ok(transportMethodForService('delivery') === 'delivery', "'delivery' → 'delivery'");
  ok(transportMethodForService('delivery_only') === 'delivery', "the OCR door's own vocabulary maps too");
  ok(transportMethodForService(null) === 'delivery',
    'an unclassified delivery falls back to the WEAKER claim — asserting an install we cannot evidence would be the dishonest direction');
  ok(build({ serviceType: 'planting' }).order.transport_method === 'install', 'and it reaches the order row');
}

// ══ §H LINES — transcription, not interpretation ════════════════════════════
{
  ok(historyOrderLines(null).length === 0, 'null line array → no lines, no throw');
  ok(historyOrderLines([]).length === 0, 'empty stays empty');
  const l = historyOrderLines([{ sku: 'MS45', quantity: '3', unit_price: '10.5', amount: '31.5', description: 'x' }])[0];
  ok(l.quantity === 3 && l.unitPrice === 10.5 && l.subtotal === 31.5, 'string numerics off OCR are coerced');
  ok(historyOrderLines([{ quantity: 0 }])[0].quantity === 1,
    'quantity floors at 1 — order_items.quantity is NOT NULL and a zero-quantity sold line is not a thing a document can mean');
  ok(historyOrderLines([{}])[0].sku === null && historyOrderLines([{}])[0].description === null,
    'a line missing sku/description gets null, not an empty string that would read as a real blank value');
  ok(historyOrderLines([{ sku: 'A' }, { sku: 'B' }]).every(x => x.businessInventoryId === null),
    'and EVERY line, on every path into this function, carries a null lot id');
}

// ══ §I THE RE-PUSH GATE — read from SOURCE, because its failure is unrecoverable ═══
// This one is asserted against the real file rather than a fixture. A history order reaching
// QuickBooks creates a SECOND invoice for a sale the customer has already paid, in their real
// accounting, under the seller's real name — there is no undo for that, and the endpoint takes an
// arbitrary order_id with no UI caller policing it. A source probe is a weak test in general and
// the right one here: it fails the build the moment someone moves, weakens or deletes the guard.
{
  // Repo-root-relative, NOT __dirname: esbuild bundles this file elsewhere, so __dirname points at
  // the bundle. The runner executes from the repo root (scripts/run-tests.mjs).
  const src = readFileSync(join(process.cwd(), 'packages/cultivar-os/api/qbo/invoice/cultivar.ts'), 'utf8');
  // 🔴 SCOPED TO pushQboInvoice's BODY, and the first version of this probe was WRONG in a way
  // worth keeping: it searched the whole file for `method: 'POST'` and found one at line 38 — in a
  // helper DEFINED above pushQboInvoice but CALLED from inside it. Textual position is not control
  // flow. The probe failed, the code was correct, and the fix was to the probe.
  const body      = src.slice(src.indexOf('export async function pushQboInvoice'));
  const guardAt   = body.indexOf('order.order_kind === HISTORY_ORDER_KIND');
  const payloadAt = body.indexOf('buildInvoicePayload');
  const custAt    = body.indexOf('findOrCreateQBCustomer');
  const postAt    = body.indexOf('qbPost');
  const invoiceAt = body.indexOf('invoiceResp');

  ok(guardAt > -1, 'THE GUARD EXISTS — the re-push endpoint tests order_kind against the shared constant');
  ok(/HISTORY_ORDER_KIND\s*\}\s*from\s*'[^']*historyOrder'/.test(src),
    'and it imports that constant from the ONE module rather than re-typing the string \'history\' (a re-typed literal is a typo away from admitting everything)');
  ok(/status:\s*422/.test(body.slice(guardAt, guardAt + 900)),
    'it returns 422, not 403 — the caller IS authorised; the REQUEST is incoherent. A 403 sends someone hunting a permission that would never have helped');
  ok(/HISTORY_ORDER_NOT_PUSHABLE/.test(src), 'with a machine-readable code');
  ok(/\[TRACE:QBO\] REFUSED[^\n]*failed intent/.test(src),
    'and it LOGS THE FAILED INTENT — a refusal to complete a requested action is recorded, not dropped');
  ok(guardAt > -1 && invoiceAt > -1 && guardAt < invoiceAt,
    '🔴 THE ORDERING IS THE GUARANTEE: inside pushQboInvoice the refusal precedes the invoice POST');
  ok(guardAt > -1 && custAt > -1 && guardAt < custAt,
    'and it precedes findOrCreateQBCustomer — a history order must not even CREATE OR LINK a QuickBooks customer, which is already a write to the seller\'s real books before any invoice exists');
  ok(guardAt > -1 && postAt > -1 && guardAt < postAt,
    'and it precedes every qbPost in the function');
  ok(payloadAt === -1 || guardAt < payloadAt, 'and it precedes the invoice payload build');
}

// ══ §J THE OCR DOOR — the write exists and carries the invariants ═══════════
{
  const src = readFileSync(join(process.cwd(), 'packages/cultivar-os/api/customers/create.ts'), 'utf8');
  ok(/buildHistoryOrder/.test(src) && /historyOrder'/.test(src),
    'the OCR door builds its order through the SHARED builder — not a second hand-rolled copy (§6 r8)');
  ok(!/from\('orders'\)[\s\S]{0,400}status:\s*'pending'/.test(src),
    'and it does not hand-write a status that would make the order hold a commitment');
  ok(/business_inventory_id:\s*l\.businessInventoryId/.test(src),
    'the lot id comes from the builder (typed as literal null), never assembled at the call site');
  ok(/customer\.first_name/.test(src) && /return res\.status\(400\)/.test(src),
    'NO CUSTOMER → NO ORDER is structural: the handler refuses 400 without a customer before any write');
  // Compared against the CALL SITE, not the bare name: the first occurrence of `buildHistoryOrder`
  // is the import at the top of the file, which would make this assertion meaningless.
  ok(src.indexOf('customer.first_name') < src.indexOf('buildHistoryOrder({'),
    'and that refusal comes FIRST — a vendor receipt cannot reach the order write');
}

console.log(`\n  historyOrder: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
