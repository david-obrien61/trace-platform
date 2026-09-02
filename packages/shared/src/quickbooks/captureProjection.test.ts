/**
 * ── captureProjection — is the file door really the same door? ────────────────────────
 *
 * 🔴 WHAT IS UNDER TEST IS A CLAIM ABOUT TWO CODE PATHS, NOT AN ARITHMETIC. The whole harness
 * rests on "David sees exactly what Lauren will see." That is true only while the projected
 * payload has the SAME SHAPE as the live one — and the live shapes are deliberately NOT uniform
 * (Item ships rows, Customer ships five, Invoice ships none). A projection that tidied that
 * asymmetry away would render a screen that does not exist in production, and nothing would
 * look wrong: the preview would simply be a preview of something else.
 *
 * 🔴 THE EXPECTED SHAPES ARE WRITTEN OUT AS LITERALS HERE, NOT IMPORTED FROM `PROJECTED_KEYS`.
 * A test that asserts a module against that module's own constant cannot disagree with it — one
 * mutant changing both would pass green (R-33). These literals were read off the three live
 * handlers in `packages/cultivar-os/api/qbo/router.ts` (handleItems / handleCustomers /
 * handleInvoices) and are the independent witness.
 *
 * §A  Item     — rows + breakdown, and NO preview
 * §B  Customer — breakdown + a five-row preview, and NO full record list
 * §C  Invoice  — breakdown ONLY: not even a preview
 * §D  the counts and the `pages_fetched` off-by-one
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/captureProjection.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { projectCapture } from './captureProjection';
import { readCaptureFile, type CaptureReplay } from './captureReplay';
import { qboCountQuery } from './qboRead';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

type Ent = 'Item' | 'Customer' | 'Invoice';

const ITEM = (i: number) => ({ Id: String(i), Name: `Live Oak ${i}`, Type: 'Inventory',
  IncomeAccountRef: { name: 'Sales of Nursery Stock' }, Active: true, UnitPrice: 300, PurchaseCost: 100, Sku: `SKU-${i}` });
const CUST = (i: number) => ({ Id: String(i), DisplayName: `Customer ${i}`,
  PrimaryEmailAddr: { Address: `c${i}@example.com` }, PrimaryPhone: { FreeFormNumber: `512-555-${1000 + i}` }, Active: true });
const INV  = (i: number) => ({ Id: String(i), DocNumber: String(3000 + i), TxnDate: '2026-05-01', TotalAmt: 100,
  CustomerRef: { value: 'c1' },
  Line: [{ DetailType: 'SalesItemLineDetail', Amount: 100,
           SalesItemLineDetail: { ItemRef: { value: '1', name: 'Live Oak 1' }, Qty: 1, UnitPrice: 100 } }] });

const ROW: Record<Ent, (i: number) => unknown> = { Item: ITEM, Customer: CUST, Invoice: INV };

/** Build a well-formed capture and push it through the real gate — never a hand-made replay. */
function replay(entity: Ent, n: number): CaptureReplay {
  const file = {
    entity, realm_id: '9341455222430707', queried_at: '2026-09-02T10:00:00.000Z',
    expected_total: n, retrieved_total: n, complete: true,
    pages: [
      { query: qboCountQuery(entity), start_position: 0, http_status: 200,
        body: JSON.stringify({ QueryResponse: { totalCount: n } }) },
      { query: `select * from ${entity} startposition 1 maxresults 1000`, start_position: 1, http_status: 200,
        body: JSON.stringify({ QueryResponse: { [entity]: Array.from({ length: n }, (_, k) => ROW[entity](k + 1)) } }) },
    ],
  };
  const r = readCaptureFile(file);
  if (!r.ok) throw new Error(`fixture did not pass the gate: ${r.code}`);
  return r;
}

// ── §A Item ──────────────────────────────────────────────────────────────────
{
  const p = projectCapture(replay('Item', 4)) as Record<string, unknown>;
  ok(Array.isArray(p.items) && (p.items as unknown[]).length === 4, 'Item projects the full parsed rows');
  ok(p.breakdown !== undefined, 'Item carries a breakdown');
  ok(!('preview' in p), 'Item has NO preview — the live Item payload has none, and an extra key is a different screen');
  ok((p.items as { sku: string }[])[0].sku === 'SKU-1', 'and the rows went through the real parser, SKUs and all');
}

// ── §B Customer ──────────────────────────────────────────────────────────────
{
  const p = projectCapture(replay('Customer', 40)) as Record<string, unknown>;
  ok(p.breakdown !== undefined, 'Customer carries a breakdown');
  ok(Array.isArray(p.preview), 'Customer carries a preview');
  ok((p.preview as unknown[]).length === 5,
    '🔴 the preview is FIVE rows out of forty — not the list, and not a number the projection chose for itself');
  ok(!('items' in p),
    '🔴 Customer does NOT project the 40 parsed records — the live payload withholds them and so does this');
  ok((p.breakdown as { total: number }).total === 40, 'while the breakdown still counts all forty');
}

// ── §C Invoice — the strongest withholding ───────────────────────────────────
{
  const p = projectCapture(replay('Invoice', 12)) as Record<string, unknown>;
  ok(p.breakdown !== undefined, 'Invoice carries a breakdown');
  ok(!('items' in p) && !('preview' in p),
    '🔴 Invoice projects NEITHER records NOR a preview — an invoice names the human who bought and says what they paid');
  ok(JSON.stringify(p).indexOf('3001') === -1,
    'and no invoice number leaks into the projected payload at all');
}

// ── §D the counts, and the off-by-one that would be silent ───────────────────
{
  const p = projectCapture(replay('Item', 685));
  ok(p.expected_total === 685 && p.retrieved_total === 685, 'the counts come through at 685');
  ok(p.pages_fetched === 1,
    '🔴 `pages_fetched` is ROW pages (1), not `pages.length` (2) and not a second subtraction (0) — the count page is already excluded upstream');
  ok(p.stored === false, 'reading a file persists nothing, and the payload SAYS so rather than leaving it assumed');
  ok(p.source === 'capture-file',
    '🔴 the projection is STAMPED as a file — this is the one key the live payload does not have, and it is how a screen can refuse to call a file a live pull');
  ok(p.complete === true, 'and it is complete, because an incomplete file cannot become a CaptureReplay in the first place');
}

// ── the shapes, stated independently of the module ───────────────────────────
{
  const EXPECTED: Record<Ent, string[]> = {
    Item:     ['items', 'breakdown'],
    Customer: ['breakdown', 'preview'],
    Invoice:  ['breakdown'],
  };
  const OPTIONAL = ['items', 'preview'];
  ok((Object.keys(EXPECTED) as Ent[]).every(e => {
    const p = projectCapture(replay(e, 6)) as Record<string, unknown>;
    const present = OPTIONAL.filter(k => k in p).concat('breakdown').sort();
    return present.join(',') === [...EXPECTED[e]].sort().join(',');
  }), '🔴 all three projected shapes match the live handlers exactly — no entity gains or loses a key');
}

console.log(`\n  captureProjection — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
