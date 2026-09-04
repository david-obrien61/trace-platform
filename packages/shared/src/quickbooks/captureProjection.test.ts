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
 * §E  🔴 THE VERBATIM BODIES SURVIVE THE PROJECTION — the seam the whole harness rests on
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/captureProjection.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { projectCapture } from './captureProjection';
import { parseInvoiceList } from './invoiceList';
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
  // 🔴 THIS ASSERTION WAS RE-SCOPED 2026-09-04, AND THE RE-SCOPING IS THE FINDING.
  // It used to read `JSON.stringify(p).indexOf('3001') === -1` over the WHOLE payload, and it
  // passed only because the projection was dropping `capture` — the defect this file now fixes.
  // The claim it made ("no invoice number leaks into the projected payload at all") is FALSE
  // ABOUT THE LIVE PAYLOAD IT CLAIMS TO MIRROR: `handleInvoices` returns `capture: done.capture`,
  // whose pages are Intuit's verbatim bodies, every DocNumber and every buyer among them. So the
  // probe was asserting the FILE door is STRICTER than the live one — which is not a safer door,
  // it is a DIFFERENT door, and this module exists to make them the same one.
  // What the withholding actually means, and all it ever meant, is that the projection adds no
  // PARSED record list and no preview. That is what is asserted now, over everything but the
  // raw capture the browser already had in its hands before it called this function.
  const { capture: _raw, ...parsedOnly } = p;
  ok(JSON.stringify(parsedOnly).indexOf('3001') === -1,
    'no invoice number leaks into any PARSED field of the projected payload — the raw capture is excluded, because the live payload carries those same bytes');
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

// ══════════════════════════════════════════════════════════════════════════════════════════
// §E 🔴 THE VERBATIM BODIES SURVIVE THE PROJECTION — AND THE PROBE RUNS THE SCREEN'S OWN LINE
// ══════════════════════════════════════════════════════════════════════════════════════════
// THE DEFECT THIS EXISTS FOR, stated so it cannot be re-introduced quietly: `projectCapture`
// returned eleven keys and `capture` was not among them, while `QboBooksReader` parses invoices
// out of `reads.Invoice.capture`. So a saved read rendered NO invoice table, and 13 of the 16
// findings — every rule declaring `needs: ['invoices']` — reported "could not work this out" on
// a file that contained every invoice they needed. The rehearsal path was dark for the whole
// money half of the review, and it looked exactly like a quiet, honest, clean result.
//
// 🔴 WHY NOTHING CAUGHT IT, WHICH IS THE PART WORTH KEEPING. There was a probe file and a
// mutation harness over this module, and neither could have failed: no assertion in either ever
// READ the field. A mutation harness measures whether probes notice a changed line; it says
// nothing about a line that no probe reaches. Coverage of the module was not coverage of the seam.
//
// So these assertions deliberately do NOT check `'capture' in p` and stop there. They run the
// EXPRESSION THE SCREEN RUNS — `(capture as { pages?: { body?: string }[] }).pages`, flat-mapped
// through `parseInvoiceList` — because the thing under test is not a key's presence, it is
// whether the file door and the live door hand the same screen the same invoices.
{
  const N = 12;
  const p = projectCapture(replay('Invoice', N)) as Record<string, unknown>;

  ok(p.capture !== undefined && p.capture !== null,
    '🔴 a projected read carries `capture` — the live payload does (`capture: done.capture`), so a file that dropped it was a different door wearing the same shape');

  // ── the screen's own line, verbatim from QboBooksReader ──────────────────────────────
  const pages = (p.capture as { pages?: { body?: string }[] } | undefined)?.pages ?? [];
  const bodies = pages.map(pg => pg.body ?? '').filter(Boolean);
  const invoices = bodies.flatMap(raw => parseInvoiceList(raw).invoices);

  ok(invoices.length === N,
    `🔴 the screen's own expression yields all ${N} invoices off a saved read — this is the assertion that was missing, and it is the one that fails when the seam breaks`);
  // NOT `.every()` — an `every` over an empty array is vacuously true, so on the very payload
  // this section exists to catch it would have passed. Count the rows that really carry a line.
  ok(invoices.filter(i => i.lines.length > 0).length === N,
    `and all ${N} rows arrive WITH their lines, so the per-invoice drawer has its detail without a second read`);
  ok(invoices.some(i => i.docNumber === '3001'),
    'and the invoice NUMBERS are there — the identifiers R-77 permits on screen, which is what recognition is built on');

  // ── the capture envelope agrees with the counts beside it ────────────────────────────
  ok(bodies.length === (p.pages_fetched as number),
    'the reconstructed capture holds exactly `pages_fetched` row pages — the count page is excluded on both sides of the door, not once');
  ok(invoices.length === (p.retrieved_total as number),
    '🔴 and what the bodies actually re-parse to EQUALS `retrieved_total` — the projection cannot report a completeness it does not carry the rows for');

  // 🔴 THE ENVELOPE'S OWN NUMBERS, NOT JUST THE PAYLOAD'S — ADDED AFTER A MUTANT SURVIVED.
  // The assertion above reads the TOP-LEVEL `retrieved_total`, so a mutant that inflated the
  // count INSIDE `capture` passed green (P11). The capture is a self-describing envelope: it is
  // written to a file, re-opened later, and re-verified against its own header by `readCaptureFile`
  // — a header disagreeing with its bodies is the `ROWS_DISAGREE` refusal, manufactured here and
  // shipped to disk. So the inner numbers are held to the bodies too, not merely copied.
  const env = p.capture as { expected_total: number; retrieved_total: number; complete: boolean;
                             entity: string; realm_id: string; queried_at: string | null };
  ok(env.retrieved_total === invoices.length,
    '🔴 the capture envelope\'s OWN `retrieved_total` matches what its OWN bodies parse to — a header that disagrees with its rows is the refusal this file would otherwise write to disk');
  ok(env.expected_total === (p.expected_total as number) && env.complete === true,
    'and its expected/complete agree with the payload wrapping it — one read, not two claims about one read');
  ok(env.entity === p.entity && env.realm_id === p.realm_id && env.queried_at === p.queried_at,
    'and it is attributed to the same company, entity and moment — an envelope that names a different read is a file that reopens as someone else\'s books');

  // ── THE NEGATIVE CONTROL: could this section have failed? (R-33) ─────────────────────
  // A green here means nothing unless the same assertions go red on a payload with the field
  // removed. This models the defect exactly as it shipped — the eleven-key projection.
  const stripped = { ...p } as Record<string, unknown>;
  delete stripped.capture;
  const brokenPages = (stripped.capture as { pages?: { body?: string }[] } | undefined)?.pages ?? [];
  const brokenInvoices = brokenPages.map(pg => pg.body ?? '').filter(Boolean)
    .flatMap(raw => parseInvoiceList(raw).invoices);
  ok(brokenInvoices.length === 0,
    '🔴 NEGATIVE CONTROL — with `capture` removed the same expression yields ZERO invoices, which is precisely the screen that shipped: these probes can fail, so their passing is evidence');
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// §E2 THE OTHER TWO ENTITIES CARRY IT TOO, AND ITEM PROVES IT IS NOT INVOICE-SPECIAL
// ══════════════════════════════════════════════════════════════════════════════════════════
// Only the invoice path read `capture` when the defect was found, so fixing only Invoice would
// have been a repair sized to the symptom. The live handlers return it for all three; a file
// that carried it for one would be a door that is the same door only on Tuesdays.
{
  for (const e of ['Item', 'Customer', 'Invoice'] as Ent[]) {
    const p = projectCapture(replay(e, 4)) as Record<string, unknown>;
    const pages = (p.capture as { pages?: { body?: string }[] } | undefined)?.pages ?? [];
    ok(pages.length === 1 && typeof pages[0]?.body === 'string' && pages[0].body.length > 0,
      `${e} projects a capture holding its verbatim row page`);
  }
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

  // 🔴 AND THE KEY THAT IS NOT DIFFERENTIATING, WHICH IS EXACTLY WHY IT WENT MISSING.
  // The witness above enumerates the keys that DIFFER between entities, because the asymmetry is
  // what it was written to defend. `capture` is on all three live payloads identically, so it
  // never appeared in a list of differences — and a shape check built only out of differences
  // cannot see a key that is missing from every shape at once. That is the blind spot that let
  // the file door render nothing for two days (R-33: a check that cannot disagree is not a check).
  ok((Object.keys(EXPECTED) as Ent[]).every(e =>
    'capture' in (projectCapture(replay(e, 6)) as Record<string, unknown>)),
    '🔴 every entity projects `capture` — the live handlers all return `capture: done.capture`, and a key common to all three is invisible to a witness made of differences');
}

console.log(`\n  captureProjection — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
