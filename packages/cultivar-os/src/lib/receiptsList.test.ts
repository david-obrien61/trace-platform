/**
 * ── receiptsList — the banked verdict, and what the capture became ──────────────────────────
 *
 * Fixtures are the LIVE 2026-09-01 measurement, not invented data (populations stated at every
 * count, printed by this file when it runs):
 *   · 17 LAWNS receipts of 36 across all tenants.
 *   · 11 produced an order (10 `history/invoiced`, 1 `history/fulfilled`); 6 produced none.
 *   · TWO duplicate captures by (vendor, date, amount): bwi 2026-07-29 $1,283.88 and Bailey Bark
 *     2026-07-07 $2,316.03. The bwi pair produced orders `eb3ab2b0` and `dc943a79` — one order
 *     EACH, both carrying document number 19837964 and a delivery with `delivery_date` NULL.
 *     0 of 17 receipts carry more than one order.
 *   · reconcile_status = `match` on 17/17, reconcile_delta = 0 on 17/17, accept_vs_edit =
 *     `edited` on 17/17, reconcile_overridden_at populated on 0/17, header_amount_edited true on
 *     0/17, amount_original populated on 17/17.
 *
 * 🔴 THE LIVE DATA EXERCISES ONE PATH OF SEVERAL. Every stored reconcile row today reads `match`
 * with a zero delta, so a suite built only from live rows would assert the one branch that
 * cannot fail and call the module proven. The `small_gap`, `large_mismatch_overridden`, unknown,
 * NULL-status and NULL-amount cases below are constructed for exactly that reason — R-33: a
 * check that cannot disagree is not a check.
 *
 * PROBES BOTH DIRECTIONS (STD-022): every rule is asserted by a case that must pass AND a case
 * that must fail.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/receiptsList.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RECEIPTS_SELECT,
  RECEIPT_LINES_SELECT,
  receiptLinesModel,
  linesProvenanceNote, RECEIPTS_PAGE_LIMIT,
  bankedVerdict, captureOutcome, receiptRowModel, receiptListModel, countLabel, listVisibleForStep,
  receiptSortKey, compareReceiptsForDisplay,
  outcomeSummaryText, outcomeFilterValue, receiptSearchText, OUTCOME_FILTER_OPTIONS,
  type RawReceiptRow, type RawOrderRow,
} from './receiptsList';

// Repo-root-relative, NOT __dirname/import.meta: esbuild bundles this file elsewhere, so only
// process.cwd() reliably points at the repo root. Same convention as deliveryFulfilment.test.ts.
const SELF = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/lib/receiptsList.ts'), 'utf8');
// The grid's own source. Read for the same reason SELF is: the column CONFIG is a decision, it
// lives in a .tsx, and a decision inside a component cannot be asserted any other way
// (tech-debt #134). This reads the config as TEXT — it does not render anything.
const GRID = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/components/receipts/ReceiptsList.tsx'), 'utf8');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── fixtures, from the live rows ────────────────────────────────────────────────────────────
const base: RawReceiptRow = {
  id: 'r-1', vendor: 'bwi', date: '2026-07-29', amount: 1283.88, category: 'supplies',
  created_at: '2026-09-01T15:51:00.000Z', status: 'confirmed',
  reconcile_status: 'match', reconcile_delta: 0, reconcile_overridden_at: null,
  accept_vs_edit: 'edited', amount_original: 1283.88, header_amount_edited: false,
  receipt_number: null,
  orders: [],
};
const R = (over: Partial<RawReceiptRow>): RawReceiptRow => ({ ...base, ...over });

const bwiOrder: RawOrderRow = {
  id: 'eb3ab2b0', order_kind: 'history', status: 'invoiced', total_amount: 1283.88,
  sale_date: '2026-07-29', source_document_number: '19837964',
  deliveries: [{ id: 'd-1', delivery_date: null, status: 'scheduled', service_type: 'delivery_only', source: 'ocr-invoice' }],
};

// ══ §A THE PROJECTION — the joins are the build, and their absence is silent ═════════════════
// 🔴 These two are the probes that catch a reverted join. Without the `orders` embed EVERY row
// reads "No order recorded" — not a blank, a confident false statement — and nothing else in
// this suite would notice, because every other probe is fed its rows directly.
{
  ok(/\borders\s*\(/.test(RECEIPTS_SELECT),
    '🔴 A1: RECEIPTS_SELECT MUST embed orders — without it every receipt reads "no order recorded", which is false for 11 of 17 live rows');
  ok(/\bdeliveries\s*\(/.test(RECEIPTS_SELECT),
    '🔴 A2: RECEIPTS_SELECT MUST embed deliveries — without it every order reads "no delivery recorded", which is false for 11 of 11 receipt-linked live orders');
  // The deliveries embed must be INSIDE the orders embed: deliveries reach a receipt only
  // through orders.receipt_id → orders.id ← deliveries.order_id. A sibling embed would not
  // resolve at all, and the two-level nesting is the thing verified live on 2026-09-01.
  const ordersBlock = /orders\s*\(([\s\S]*)\)/.exec(RECEIPTS_SELECT)?.[1] ?? '';
  ok(/\bdeliveries\s*\(/.test(ordersBlock),
    '🔴 A3: deliveries is embedded INSIDE orders — the chain is receipt → order → delivery, there is no direct receipt↔delivery key');

  for (const col of ['reconcile_status', 'reconcile_delta', 'reconcile_overridden_at', 'accept_vs_edit', 'amount_original', 'header_amount_edited']) {
    ok(RECEIPTS_SELECT.includes(col), `A4: the projection selects ${col} — one of the six write-only columns this surface exists to read (population: 6 columns)`);
  }
  // A5 (negative) — the guarantee behind "does not re-evaluate" is mechanical, not a promise:
  // the inputs a re-evaluation needs are not fetched.
  ok(!/\bline_items\b/.test(RECEIPTS_SELECT),
    '🔴 A5 (negative): line_items is NOT selected — re-running computeReconcile over a stored row is impossible, not merely discouraged');
  // A6 — asserted on the IMPORT LIST, not on the whole file: the module's own header discusses
  // computeReconcile at length in explaining why it does not run it, and a probe that failed on
  // the explanation would push the reasoning out of the code to satisfy the check.
  const imports = /import\s*\{([\s\S]*?)\}\s*from\s*'\.\.\/utils\/receiptReconciliation'/.exec(SELF)?.[1] ?? '';
  ok(imports.length > 0 && !/computeReconcile/.test(imports),
    '🔴 A6 (negative): computeReconcile is NOT imported — the verdict on screen is the one that was banked, and re-deriving it here is not one edit away');
  ok(/reconcileReadoutStyle/.test(imports) && /reconcileReadoutText/.test(imports),
    'A7: the severity colours and prose are REUSED from receiptReconciliation, not re-spelt (§6 r8)');
}

// ══ §B THE COUNT — a cap that does not name itself is the defect ═════════════════════════════
{
  ok(countLabel(17, 17) === '17 receipts', 'B1: uncapped reads as a plain count');
  ok(countLabel(1, 1) === '1 receipt', 'B2: singular');
  ok(countLabel(0, 0) === '0 receipts', 'B3: zero is a count, not an error');
  // B3b — the cap the screen actually runs at is the one the label names. A probe that only ever
  // passes its own limit would agree with itself while the default drifted.
  ok(countLabel(RECEIPTS_PAGE_LIMIT, RECEIPTS_PAGE_LIMIT + 1).includes(`capped at ${RECEIPTS_PAGE_LIMIT}`),
    `🔴 B3b: the DEFAULT cap (${RECEIPTS_PAGE_LIMIT}) is the one named on screen — the label is not fed a number the query never uses`);

  const capped = countLabel(100, 236, 100);
  ok(capped.includes('100') && capped.includes('236'), '🔴 B4: a capped list shows BOTH numbers');
  ok(/cap/i.test(capped), '🔴 B5: a capped list NAMES the cap — a silent .limit() under a count label is the live defect on two other screens');
  ok(!/^\s*100 receipts/.test(capped), '🔴 B5b (negative): a capped list must NOT read as a plain total');

  const uncounted = countLabel(100, null, 100);
  ok(/not counted/i.test(uncounted), '🔴 B6: an uncountable total says so rather than printing a number nobody measured');
  ok(/cap/i.test(uncounted), 'B7: …and still names the cap when the page is full');
  ok(!/cap/i.test(countLabel(4, null, 100)), 'B8 (negative): a short page with no count does not claim to be capped');

  ok(receiptListModel([base], 1, 100).capped === false, 'B9 (negative): 1 of 1 read is NOT capped… ');
  ok(countLabel(4, 17, 100) === 'Showing 4 of 17 receipts',
    '🔴 B9b: a short read against a bigger total reports the gap but does NOT blame the cap it never reached — a confident wrong explanation is worse than none');
  ok(receiptListModel(Array.from({ length: 100 }, (_, i) => R({ id: `x${i}` })), 236, 100).capped === true,
    'B10: …and 100 of 236 is');
}

// ══ §C THE BANKED VERDICT — displayed, never recomputed ══════════════════════════════════════
{
  // C1/C2 — the live shape: match, zero delta. lineSum is RECONSTRUCTED as amount + delta.
  const v = bankedVerdict(base);
  ok(v.readout !== null, 'C1: a banked `match` renders a readout');
  ok(v.readout!.text.includes('$1,283.88'), 'C2: the readout carries the banked figure (lineSum = amount + delta, exactly)');
  ok((v.readout!.style as { background?: string }).background === '#f0fdf4', 'C3: `match` takes the green severity from reconcileReadoutStyle — reused, not re-spelt');

  // C4 — the reconstruction is arithmetic on two banked numbers, and it must survive a non-zero
  // delta. No live row exercises this today; that is why it is here.
  const gap = bankedVerdict(R({ reconcile_status: 'small_gap', reconcile_delta: -4.5, amount: 100 }));
  ok(gap.readout!.text.includes('$95.50') && gap.readout!.text.includes('$100.00'),
    '🔴 C4: lineSum reconstructs to 95.50 from amount 100 + delta −4.50 — the definition in 20260614:51-55');
  ok((gap.readout!.style as { background?: string }).background === '#fffbeb', 'C5: `small_gap` takes the amber severity');

  // C6/C7 — the stored vocabulary is NOT the in-flight vocabulary. `large_mismatch_overridden`
  // carries an extra fact and folding it into a colour would lose it.
  const over = bankedVerdict(R({ reconcile_status: 'large_mismatch_overridden', reconcile_delta: 400, amount: 100, reconcile_overridden_at: '2026-07-01T10:00:00Z' }));
  ok((over.readout!.style as { background?: string }).background === '#fef2f2', 'C6: `large_mismatch_overridden` maps onto the red severity');
  ok(over.notes.some(n => /shown the conflict/i.test(n) && n.includes('2026-07-01')),
    '🔴 C7: the override is surfaced as its own note WITH its timestamp — the colour cannot carry it');
  const overNoTs = bankedVerdict(R({ reconcile_status: 'large_mismatch_overridden', reconcile_delta: 400, amount: 100, reconcile_overridden_at: null }));
  ok(overNoTs.notes.some(n => /no override timestamp/i.test(n)),
    '🔴 C8: an override with no timestamp says the timestamp is missing — it does not invent one and does not go quiet');

  // C9/C10 — absent is not empty (A9 / D-9).
  const none = bankedVerdict(R({ reconcile_status: null, reconcile_delta: null }));
  ok(none.readout === null, 'C9 (negative): no banked status → no readout');
  ok(none.notes.some(n => /no reconciliation was recorded/i.test(n)),
    '🔴 C10: …and it SAYS no reconciliation was recorded, rather than leaving a blank a reader will take for "nothing was wrong"');

  const weird = bankedVerdict(R({ reconcile_status: 'something_else' }));
  ok(weird.readout === null && weird.notes.some(n => n.includes('something_else')),
    '🔴 C11: an unrecognised stored status renders under its own raw name, never forced into a known bucket');

  // C12 — a verdict whose arithmetic is absent must not print $0.00, which reads as a real figure.
  const noAmount = bankedVerdict(R({ amount: null }));
  ok(noAmount.readout === null, 'C12 (negative): a match with no stored total renders no readout…');
  ok(noAmount.notes.some(n => /cannot be shown/i.test(n)), 'C13: …and says the figures cannot be shown');
  ok(!noAmount.notes.some(n => /\$0\.00/.test(n)), '🔴 C14 (negative): $0.00 is never printed in place of an absent total (D-9)');

  // C15–C18 — the OCR snapshot, the other write-only pair.
  ok(bankedVerdict(base).notes.some(n => /unchanged/i.test(n)), 'C15: an unedited total says the OCR figure is unchanged (17/17 live rows)');
  ok(bankedVerdict(R({ amount_original: 1000, amount: 1283.88 })).notes.some(n => n.includes('$1,000.00') && n.includes('$1,283.88')),
    'C16: an edited total shows BOTH figures — what was read and what was saved');
  ok(bankedVerdict(R({ amount_original: null })).notes.some(n => /no ocr total was snapshotted/i.test(n)),
    'C17: a legacy row with no snapshot says so');
  ok(bankedVerdict(R({ accept_vs_edit: 'accepted_as_is' })).notes.some(n => /exactly as read/i.test(n)), 'C18: accepted_as_is reads back');
  ok(bankedVerdict(R({ accept_vs_edit: null })).notes.some(n => /not recorded/i.test(n)), 'C19: an unrecorded accept/edit flag says it is unrecorded');
  ok(bankedVerdict(R({ header_amount_edited: true })).notes.some(n => /total field itself/i.test(n)),
    'C20: header_amount_edited surfaces separately from accept_vs_edit — measured `edited` 17/17 while header_amount_edited is false 17/17, so they are NOT the same fact');
  ok(!bankedVerdict(base).notes.some(n => /total field itself/i.test(n)), 'C21 (negative): …and it stays silent when false');
}

// ══ §D WHAT IT BECAME — and the silence where nothing did ════════════════════════════════════
{
  const withOrder = captureOutcome(R({ orders: [bwiOrder] }));
  ok(withOrder.orders.length === 1 && withOrder.note === null, 'D1: a receipt with an order shows the order and no note');
  ok(withOrder.orders[0].docNumberText === '19837964', 'D2: the source document number is shown (live: bwi 19837964)');
  ok(withOrder.orders[0].status.label === 'Invoiced', 'D3: the order status is labelled by orderStatusMeta — reused, not re-spelt');
  ok(withOrder.orders[0].kindText === 'history', 'D4: the order kind is shown as stored');
  ok(captureOutcome(R({ orders: [{ ...bwiOrder, order_kind: null }] })).orders[0].kindText === 'Checkout order',
    'D5: a NULL order_kind reads as the meaning the migration DECLARES for it (20260827:37-38), not as a guess');

  // 🔴 D6/D7 — the deliveries half. These are the probes a reverted deliveries join fails and a
  // reverted orders join cannot reach: they assert on the delivery rendered UNDER an order.
  ok(withOrder.orders[0].deliveries.length === 1,
    '🔴 D6: the delivery under the order is rendered — 11 of 11 receipt-linked live orders carry one');
  ok(withOrder.orders[0].deliveries[0].dateText === 'No date set',
    '🔴 D7: a delivery with delivery_date NULL SAYS it has no date — this is the state both duplicate-capture deliveries are in, and a blank would hide it');
  ok(withOrder.orders[0].deliveries[0].status.label === 'Scheduled', 'D8: the delivery status is labelled by deliveryStatusMeta — reused');
  ok(withOrder.orders[0].deliveryNote === null, 'D9 (negative): an order WITH a delivery carries no "no delivery" note');

  const orderNoDelivery = captureOutcome(R({ orders: [{ ...bwiOrder, deliveries: [] }] }));
  ok(orderNoDelivery.orders[0].deliveryNote === 'No delivery recorded for this order.',
    '🔴 D10: an order with no delivery says so');
  ok(captureOutcome(R({ orders: [{ ...bwiOrder, deliveries: null }] })).orders[0].deliveryNote !== null,
    'D11: a MISSING deliveries array is treated the same as an empty one — PostgREST returns either');

  // D12–D14 — the six that produced nothing. Fact, not verdict.
  const nothing = captureOutcome(base);
  ok(nothing.orders.length === 0, 'D12: no order, no orders');
  ok(nothing.note === 'No order recorded for this receipt.',
    '🔴 D13: the absence is STATED — 6 of 17 live receipts are in this state');
  ok(!/orphan|missing|unlinked|error|should|fail|problem/i.test(nothing.note!),
    '🔴 D14 (negative): the note passes NO judgement — six of these read as vendor purchase invoices, which correctly should not become customer orders, and that reading is not this screen’s to encode');

  // D15/D16 — one receipt with two orders. Surfaced; not called a duplicate, not repaired.
  const two = captureOutcome(R({ orders: [bwiOrder, { ...bwiOrder, id: 'dc943a79' }] }));
  ok(two.multipleOrders === true, 'D15: more than one order on one receipt is FLAGGED for the reader');
  ok(two.orders.length === 2, 'D16: …and both are rendered — measured 0 of 17 live receipts, so this is a reachable shape rather than an occupied one');
  ok(captureOutcome(R({ orders: [bwiOrder] })).multipleOrders === false, 'D17 (negative): one order is not "multiple"');
}

// ══ §E THE ROW AND THE LIST ══════════════════════════════════════════════════════════════════
{
  const m = receiptRowModel(R({ orders: [bwiOrder] }));
  ok(m.vendorText === 'bwi', '🔴 E1: the vendor string is displayed EXACTLY as stored — no derived document type, and none is derivable (the table has no origin/shape/source column)');
  ok(receiptRowModel(R({ vendor: 'LAWNS Tree Farm, LLC.' })).vendorText === 'LAWNS Tree Farm, LLC.',
    '🔴 E2: the tenant’s OWN name as a vendor is displayed as stored too — reading it as "therefore a sales invoice" works on these 17 rows and is not a rule');
  ok(m.amountText === '$1,283.88', 'E3: the amount is formatted');
  ok(receiptRowModel(R({ amount: null })).amountText === 'No amount recorded', 'E4 (negative): an absent amount says so rather than reading $0.00');
  ok(receiptRowModel(R({ vendor: null })).vendorText === 'No vendor recorded', 'E5 (negative): an absent vendor says so');

  // 🔴 E5b/E5c — a SURVIVING MUTANT closed. The first pass asserted "never fabricate a figure"
  // only against `null`, which short-circuits on the first guard — so a coercion returning 0 for
  // an UNPARSEABLE value survived every probe. The claim was about absent values; the guarantee
  // has to cover unusable ones too, or it is a guarantee about one input.
  ok(receiptRowModel(R({ amount: 'not a number' })).amountText === 'No amount recorded',
    '🔴 E5b (negative): an unparseable amount reads as absent, never as $0.00 — a coercion that invents a zero is the exact D-9 failure this surface exists to stop');
  ok(bankedVerdict(R({ reconcile_delta: 'x' })).readout === null,
    '🔴 E5c (negative): an unparseable delta yields no readout rather than a reconstructed figure built on a fabricated zero');
  ok(receiptRowModel(R({ category: null })).categoryText === 'No category', 'E6 (negative): an absent category says so');

  // ══ E7 — G9: THE DOCUMENT'S DATE ORDERS THE LIST, NOT THE CAPTURE TIMESTAMP ════════════════
  //
  // 🔴 THE OLD E7 COULD NOT HAVE CAUGHT THIS AND IS THE REASON THIS BLOCK IS WRITTEN THE WAY IT
  // IS. It varied `created_at` ALONE across three rows that all carried the fixture's single
  // `date`, so the two candidate orders agreed on every input it supplied — it would have gone
  // GREEN against a capture-time sort and GREEN against a document-date sort alike. R-33: a
  // check that cannot disagree is not a check. The inputs below are built so the two orders
  // DISAGREE, which is the only construction that tests which one is implemented.
  //
  // The dates are LAWNS's own: the 2026-07-02 bwi invoice was captured AFTER the 2026-07-29 one.
  const g9 = receiptListModel([
    R({ id: 'jul02-captured-last',  date: '2026-07-02', created_at: '2026-09-01T15:51:00.000Z' }),
    R({ id: 'jul29-captured-first', date: '2026-07-29', created_at: '2026-08-26T20:50:00.000Z' }),
  ], 2);
  ok(g9.rows.map(r => r.id).join(',') === 'jul29-captured-first,jul02-captured-last',
    '🔴 E7: G9 — the DOCUMENT date orders the list. These two rows are ordered one way by `date` and the OPPOSITE way by `created_at`, so this assertion fails against a capture-time sort — which is what the previous probe could not do');

  // E7b — the tiebreak, and it is the ONLY thing `created_at` still decides.
  const tie = receiptListModel([
    R({ id: 'same-day-early', date: '2026-07-29', created_at: '2026-08-26T08:00:00.000Z' }),
    R({ id: 'same-day-late',  date: '2026-07-29', created_at: '2026-08-26T20:50:00.000Z' }),
  ], 2);
  ok(tie.rows.map(r => r.id).join(',') === 'same-day-late,same-day-early',
    'E7b: two receipts dated the same day fall back to capture time, later first');

  // E7c — an undated row is POSITIONED by its capture day and still SAYS it has no date. The
  // fallback buys a position, never a displayed value (D-9 / A9 — absent is not empty).
  const undated = receiptListModel([
    R({ id: 'dated-june',  date: '2026-06-01', created_at: '2026-06-01T09:00:00.000Z' }),
    R({ id: 'no-date-aug', date: null,         created_at: '2026-08-26T20:50:00.000Z' }),
  ], 2);
  ok(undated.rows.map(r => r.id).join(',') === 'no-date-aug,dated-june',
    'E7c: an undated row is placed by its capture day rather than dropped to the bottom — the row whose date the OCR missed is the one needing attention');
  ok(undated.rows[0].dateText === 'No date recorded',
    '🔴 E7d (negative): the capture-day fallback is a POSITION only — the undated row must still say it has no date, never render its capture time as though it were the document date');

  // E7e — the comparator is total and stable on rows carrying neither date. It must not throw
  // and must not invent an order that depends on input sequence.
  ok(compareReceiptsForDisplay({ date: null, created_at: null }, { date: null, created_at: null }) === 0,
    'E7e (negative): two rows with no date and no capture time compare EQUAL rather than throwing or guessing');
  ok(receiptSortKey({ date: '2026-07-29', created_at: '2026-09-01T15:51:00.000Z' }) === '2026-07-29',
    'E7f: the sort key is the document date when one exists');
  ok(receiptSortKey({ date: null, created_at: '2026-09-01T15:51:00.000Z' }) === '2026-09-01',
    'E7g: the sort key falls back to the capture DAY — sliced to 10 chars so a YYYY-MM-DD date and a full ISO timestamp are comparable at all, rather than ranked by string length');

  const list = receiptListModel([
    R({ id: 'old', date: '2026-06-01' }),
    R({ id: 'new', date: '2026-08-01' }),
    R({ id: 'mid', date: '2026-07-01' }),
  ], 3);
  ok(list.rows.map(r => r.id).join(',') === 'new,mid,old', 'E7h: newest document date first');
  ok(list.countText === '3 receipts', 'E8: the count reads plainly when nothing is capped');
  ok(list.emptyNote === null, 'E9 (negative): a non-empty list carries no empty note');

  const empty = receiptListModel([], 0);
  ok(empty.rows.length === 0 && empty.emptyNote === 'No receipts captured yet.', 'E10: an empty list says it is empty (distinct from a failed read)');
}

// ══ §G THE GRID CONTRACT — the surface moved onto <DataSheet>, and these are the ways that
//    move could have quietly broken something ═══════════════════════════════════════════════
{
  // ── G1 THE SORT KEYS ARE ORDERABLE, NOT DISPLAY STRINGS ──────────────────────────────────
  // 🔴 The defect this prevents is silent and looks fine on screen: sorting the RENDERED text.
  // `"$1,283.88" < "$920.13"` is TRUE as a string comparison, so a money column sorted on its
  // own label puts nine hundred dollars above twelve hundred and nothing about the page looks
  // wrong.
  const big   = receiptRowModel(R({ amount: 1283.88 }));
  const small = receiptRowModel(R({ amount: 920.13 }));
  ok(big.amountSort > small.amountSort,
    '🔴 G1: $1,283.88 sorts ABOVE $920.13. As display strings it is the other way round — which is what sorting the rendered label would have done');
  ok(big.amountText < small.amountText,
    '🔴 G1b (the negative control that gives G1 its teeth): the DISPLAY strings really do compare backwards, so G1 is testing a live hazard rather than an imaginary one');

  // ── G2 AN UNPARSEABLE AMOUNT SORTS SOMEWHERE, AND IS STILL NOT A NUMBER ──────────────────
  const junk = receiptRowModel(R({ amount: 'x' }));
  ok(junk.amountText === 'No amount recorded',
    'G2: an unparseable amount still SAYS it is absent — the sort key does not leak into the display');
  ok(junk.amountSort === Number.NEGATIVE_INFINITY,
    'G2b: …and it is not coerced to 0, which would sort it among genuinely-zero receipts and read as a fact (D-9)');
  ok(receiptRowModel(R({ amount: 0 })).amountSort > junk.amountSort,
    '🔴 G2c (negative): a REAL $0.00 receipt sorts above an unreadable one. If absent were coerced to 0 these two would be indistinguishable — which is the whole D-9 failure');

  // ── G3 THE COLUMN'S SORT KEY IS G9's KEY ─────────────────────────────────────────────────
  ok(receiptRowModel(R({ date: '2026-07-29' })).sortKey === receiptSortKey({ date: '2026-07-29', created_at: null }),
    'G3: the Date column sorts on the SAME key the list is ordered by, so re-sorting by that header cannot disagree with the order the list arrives in');

  // ── G4 THE ENGINE'S SINGLE-KEY SORT PRESERVES G9's TIEBREAK ──────────────────────────────
  // 🔴 THIS IS THE COMPOSITION RISK OF THE WHOLE MOVE AND IT IS ASSERTED RATHER THAN ASSUMED.
  // The model sorts by (date, then capture time). The engine re-sorts by ONE key. That is only
  // safe because Array.prototype.sort is stable (ES2019) — equal dates keep the order they
  // arrived in. If it were not, two same-day receipts would silently reorder on every render.
  const sameDay = receiptListModel([
    R({ id: 'early', date: '2026-07-29', created_at: '2026-08-26T08:00:00.000Z' }),
    R({ id: 'late',  date: '2026-07-29', created_at: '2026-08-26T20:50:00.000Z' }),
  ], 2).rows;
  const engineSorted = [...sameDay].sort((a, b) => {
    const va = a.sortKey, vb = b.sortKey;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return -cmp;                       // DataSheet.tsx:153-157, desc — the engine's own comparator
  });
  ok(engineSorted.map(r => r.id).join(',') === 'late,early',
    '🔴 G4: the engine re-sorting by the date key alone PRESERVES the capture-time tiebreak the model applied. Stable sort — asserted, not assumed');

  // ── G5 THE OUTCOME SUMMARY NAMES NO FAULT ────────────────────────────────────────────────
  // D13/D14's vocabulary rule, applied to the new column and the new filter. The screen exists
  // because captures that produced no order looked like captures that did; saying so must not
  // tip into saying something is WRONG. Six of 17 live rows are in that state and they read as
  // vendor purchase invoices — a READING, not a fact (R-54: we surface, the owner decides).
  const none = outcomeSummaryText(captureOutcome(R({ orders: [] })));
  ok(none === 'No order recorded', 'G5: a receipt with no order says exactly that');
  ok(!/orphan|missing|unlinked|error|should|fail|problem|invalid|broken/i.test(none),
    '🔴 G5b (negative): …and it names no fault. The vocabulary is asserted, not trusted to whoever edits the string next');
  for (const opt of OUTCOME_FILTER_OPTIONS) {
    ok(!/orphan|missing|unlinked|error|should|fail|problem/i.test(opt),
      `G5c (negative): the filter option "${opt}" names no fault either — a dropdown is copy too`);
  }
  ok(outcomeSummaryText(captureOutcome(R({ orders: [bwiOrder] }))).startsWith('1 order'),
    'G5d: one order reads as one order, singular');
  ok(outcomeFilterValue(captureOutcome(R({ orders: [bwiOrder] }))) === OUTCOME_FILTER_OPTIONS[0]
    && outcomeFilterValue(captureOutcome(R({ orders: [] }))) === OUTCOME_FILTER_OPTIONS[1],
    'G5e: the filter partitions on a FACT — an orders row exists, or it does not. Nothing inferred');

  // ── G6 SEARCH REACHES INTO THE DRAWER ────────────────────────────────────────────────────
  // 🔴 A disclosure grid hides most of its own text by default. A search that reads only the
  // visible row answers "not found" about data that is present one click away — read-honesty
  // failure in the shape of a search box.
  const withChain = receiptSearchText(receiptRowModel(R({ orders: [bwiOrder] })));
  ok(withChain.includes('19837964'),
    '🔴 G6: the order document number is searchable even though it lives in the collapsed drawer');
  ok(withChain.includes('bwi'), 'G6b: the summary row is searchable too');
  ok(!receiptSearchText(receiptRowModel(R({ orders: [] }))).includes('19837964'),
    'G6c (negative): a receipt WITHOUT that order does not match it — the corpus is per-row, not global');

  // ── G7 EVERY SORTABLE COLUMN DECLARES A SORT VALUE ───────────────────────────────────────
  // Read from the grid's source: a column marked `sortable: true` with no `sortVal` renders a
  // clickable header that does nothing. DataSheet.tsx:151 sorts only `if (col?.sortVal)`, so the
  // failure is a dead control, and a dead control is silent.
  // ⚠️ `[a-z_]+`, not `[a-z]+`. The first draft of this pattern could not match a key containing
  // an underscore, so a `receipt_id` column would have been SKIPPED BY THE LOOP ENTIRELY and its
  // missing sortVal would have passed silently — a check that quietly declines to look at the
  // thing it was pointed at (R-33). Found while adding exactly such a column.
  const cols = [...GRID.matchAll(/\{\s*(?:\/\/[^\n]*\n\s*)*key:\s*'([a-z_]+)'[\s\S]*?render:/g)];
  ok(cols.length >= 7, `G7 setup: the column config parsed (${cols.length} columns found) — if this drops to 0 the checks below are vacuous`);
  for (const m of cols) {
    const block = m[0];
    if (/sortable:\s*true/.test(block)) {
      ok(/sortVal:/.test(block),
        `🔴 G7: column '${m[1]}' is marked sortable and declares a sortVal — without one DataSheet renders a header that looks clickable and does nothing`);
      ok(!/sortVal:\s*r\s*=>\s*r\.(amountText|dateText)\b/.test(block),
        `🔴 G7b (negative): column '${m[1]}' does not sort on a FORMATTED display string — that is the G1 defect entering through the config`);
    }
  }

  // ── G8 THE FAILED-READ SENTENCE SURVIVED THE MOVE ────────────────────────────────────────
  // §6 R1 is BINDING as of 2026-09-03. The engine keeps failed and empty apart structurally
  // (its empty state is gated on `!loading && !error`), but the SENTENCE is the surface's.
  ok(/NOT an empty list/.test(GRID),
    '🔴 G8: the failed read still says it is a failed read and not an empty one — the sentence was not lost when the card stack was replaced');
  ok(/emptyText="No receipts captured yet\."/.test(GRID),
    'G8b: and the genuinely-empty state still says something DIFFERENT from the failure');

  // ── G9 THE DIVERGENCE IS GONE, AND THE FALSE REASON IS NOT REINSTATED ────────────────────
  // ⚠️ ASSERTS THE @trace/shared PATH, NOT A RELATIVE ONE — TIGHTENED 2026-09-03 (#272), when the
  // engine was promoted out of cultivar-os. The previous form matched `'../datasheet/DataSheet'`,
  // which encoded the ENGINE'S ADDRESS as if it were the assertion; the assertion was always "this
  // surface uses the shared engine rather than a hand-rolled grid." Naming the shared package is
  // STRICTLY STRONGER than the old form: it now also fails if someone forks a local copy back into
  // cultivar-os and imports that, which the relative-path version would have happily accepted.
  ok(/from '@trace\/shared\/components\/datasheet\/DataSheet'/.test(GRID),
    'G9: the surface imports the shared grid engine FROM @trace/shared. The divergence declaration is deleted, and the cap fails the build if one is left claiming otherwise');
  ok(/renderExpand=/.test(GRID),
    '🔴 G9b: one row per receipt with the chain in a disclosure drawer — which is what the withdrawn reason claimed a grid could not do');
  ok(/FALSE WHEN IT WAS WRITTEN|withdrawn/i.test(GRID),
    'G9c: the withdrawn claim is recorded rather than deleted — a claim that was once believed is evidence about how we work (R-26)');
}

// ══ §F THE RULINGS ARE RECORDED AT THE CODE, NOT ONLY IN A LEDGER ROW ════════════════════════
// R-26's family: a decision that lives only in prose gets re-derived by the next session.
{
  ok(/does not re-evaluate|DOES NOT RE-EVALUATE/i.test(SELF), 'F1: the no-re-evaluation ruling is stated beside the code');
  ok(/DOES NOT ADJUDICATE/i.test(SELF), 'F2: the no-adjudication ruling is stated beside the code');
  ok(/one pipeline, two doors/i.test(SELF), 'F3: the document-type question points at David’s 2026-07-07 ruling rather than being answered here');
  ok(/20260614_receipts_reconciliation\.sql/.test(SELF) && /20260827_history_orders\.sql/.test(SELF),
    '🔴 F4: every schema claim in this module cites the migration that creates it');
  ok(!/\.update\(|\.insert\(|\.upsert\(|\.delete\(/.test(SELF), '🔴 F5 (negative): this module writes NOTHING');
}

// ══ §G WHEN THE LIST IS ON SCREEN ════════════════════════════════════════════════════════════
{
  ok(listVisibleForStep('idle'), 'G1: the list is on screen at idle — this is what /receipts is now for');
  ok(listVisibleForStep('done'), '🔴 G2: …and after a save, which is how a just-captured receipt is SEEN to have landed');
  ok(listVisibleForStep('error'), 'G3: …and on a capture error, where the question "did the last one land?" is most likely');
  ok(!listVisibleForStep('confirm'), '🔴 G4 (negative): NOT while the owner is filling the confirm form — a hundred cards above it push the form below the fold');
  ok(!listVisibleForStep('ocr_running'), 'G5 (negative): not mid-OCR');
  ok(!listVisibleForStep('saving'), 'G6 (negative): not mid-save');
  ok(!listVisibleForStep(''), 'G7 (negative): an unknown step does not open the list by accident');
}

// ══ §J THE DRAWER'S LINES (#270) — a PER-ROW read, and the guard that actually carries weight ═
// 🔴 Proven RED first, each by reverting the thing it asserts:
//   J1 — strip line_items from RECEIPT_LINES_SELECT        -> J1 fails
//   J3 — return null from linesProvenanceNote              -> J3 fails
//   J4 — return a constant string from linesProvenanceNote -> J4 fails
//   J5 — pass null for parsedTax inside receiptDetailModel -> J5 fails
//   A6b — call computeReconcile( in either file            -> A6b fails
{
  const detail = (over: Partial<Parameters<typeof receiptLinesModel>[0]>) => ({
    id: 'r-1', business_id: 'b-1', vendor: 'bwi', date: '2026-07-29', amount: 100,
    category: 'supplies', created_at: '2026-09-01T00:00:00Z', updated_at: null, status: 'confirmed',
    image_url: null, line_items: null, line_items_original: null, ocr_raw: null,
    reconcile_status: 'match', reconcile_delta: 0, reconcile_overridden_at: null,
    accept_vs_edit: 'accepted', amount_original: 100, header_amount_edited: false,
    ...over,
  });

  ok(/\bline_items\b/.test(RECEIPT_LINES_SELECT) && /\bline_items_original\b/.test(RECEIPT_LINES_SELECT),
    '🔴 J1: the DRAWER projection carries BOTH line stores — the current copy and the reader\'s scan. Without the second, quantity and rate are invisible on all 37 rows, which is the whole reason the drawer exists');

  ok(/\bocr_raw\b/.test(RECEIPT_LINES_SELECT),
    '🔴 J2: it carries ocr_raw — without the parsed tax, lineRowModel cannot tell a PLATFORM-injected tax line from one the OWNER added, and would accuse Lauren of adding a line we added on ~30 of 35 receipts');

  // The live shape: the saved copy carries two keys, the scan carries five.
  const legacy = receiptLinesModel(detail({
    line_items: [{ description: 'Osmocote 50 lb', amount: 68.24 }],
    line_items_original: [{ description: 'Osmocote 50 lb', amount: 68.24, quantity: 1, unit_price: 68.24, sku: '099' }],
  }) as any);
  ok(legacy[0].fields.quantity.state === 'never-carried',
    'J3a: on the live shape, quantity is never-carried — NOT "changed", which would tell Lauren she deleted a quantity she never touched');

  const note = linesProvenanceNote(legacy);
  ok(note !== null && /reader's original scan/.test(note) && /nobody has confirmed/.test(note),
    '🔴 J3: the drawer SAYS the quantity and rate are the scan\'s reading and nobody confirmed them — David\'s caveat, carried on the surface rather than left for the reader to infer (D-9)');
  ok(note !== null && /rate/.test(note) && /quantity/.test(note),
    'J3b: the note NAMES which figures are unconfirmed rather than waving at the whole table');

  // Both stores carrying the same five keys is what a capture on the fixed writer (#257) produces.
  const confirmed = receiptLinesModel(detail({
    line_items: [{ description: 'Osmocote 50 lb', amount: 68.24, quantity: 1, unit_price: 68.24, sku: '099' }],
    line_items_original: [{ description: 'Osmocote 50 lb', amount: 68.24, quantity: 1, unit_price: 68.24, sku: '099' }],
  }) as any);
  ok(linesProvenanceNote(confirmed) === null,
    '🔴 J4: the caveat DISAPPEARS when the saved copy carries the figures — it is computed from the modelled state, not hardcoded, so it cannot rot into permanent furniture nobody reads');

  // 🔴 A6b — THE GUARD THAT ACTUALLY CARRIES THE WEIGHT, strengthened in this build.
  // A6 inspects only the import from '../utils/receiptReconciliation'. This file now imports
  // `receiptDetail`, WHICH ITSELF IMPORTS computeReconcile — so the old probe would keep passing
  // while "re-deriving is not one edit away" quietly stopped being true. This asserts the property
  // itself: the function is never CALLED on the list path, in either file.
  ok(!/computeReconcile\s*\(/.test(SELF) && !/computeReconcile\s*\(/.test(GRID),
    '🔴 A6b: computeReconcile is never CALLED on the list path — neither in the model nor in the grid. The verdict on screen stays the one that was banked, and reusing receiptDetail (which does import it) did not quietly buy a second verdict');

  ok(/\.eq\('business_id', businessId\)/.test(GRID),
    '🔴 J6: the drawer read is tenant-scoped — AC-3, another tenant\'s receipt is NOT FOUND rather than shown');
}

// ══ §I THE INVOICE NUMBER (#270) — the column David reads this screen for ════════════════════
// 🔴 Every probe here was proven RED first, by reverting the thing it asserts:
//   I1 — drop `receipt_number` from RECEIPTS_SELECT  -> I1 fails
//   I2 — render `row.receipt_number ?? '—'`          -> I2/I3 fail
//   I4 — sort on `invoiceNumberText` not the raw     -> I4 fails
//   I6 — drop it from receiptSearchText              -> I6 fails
// A green run against the unmodified file is only meaningful because each was seen to go red.
{
  ok(/\breceipt_number\b/.test(RECEIPTS_SELECT),
    '🔴 I1: receipt_number IS selected — without it the column renders "No number captured" on EVERY row, which is a confident false statement about rows that DO carry a number');

  const withNum = receiptRowModel(R({ receipt_number: '4417453' }));
  ok(withNum.invoiceNumberText === '4417453',
    'I2: a stored number is displayed EXACTLY as stored — no formatting, no prefix');

  ok(receiptRowModel(R({ receipt_number: null })).invoiceNumberText === 'No number captured',
    '🔴 I3: an absent number is a SENTENCE, not a blank and not a dash — "No number captured" is a claim about OUR record, because a row captured before 20260903c could not store one and we cannot see whether the paper had it (D-9/A9)');

  ok(receiptRowModel(R({ receipt_number: '   ' })).invoiceNumberText === 'No number captured',
    'I3b: whitespace is absence, not a value — a blank-looking cell must not read as a captured number');

  // The defect this catches: sorting the DISPLAY string ranks the placeholder among genuine
  // numbers beginning with N, i.e. it sorts a sentence about our record as if it were a number.
  ok(receiptRowModel(R({ receipt_number: null })).invoiceNumberSort === '',
    '🔴 I4: the sort key for an absent number is EMPTY — a POSITION, never the placeholder text');
  ok(receiptRowModel(R({ receipt_number: 'N-900' })).invoiceNumberSort === 'n-900',
    'I5: the sort key is the RAW value lowercased, so ordering never depends on how the cell is rendered');

  ok(receiptSearchText(receiptRowModel(R({ receipt_number: '4417453' }))).includes('4417453'),
    '🔴 I6: the number is SEARCHABLE — finding a receipt by the number printed on it is the reason the column was asked for');

  ok(/key: 'invoice_number'/.test(GRID) && /sortVal: r => r\.invoiceNumberSort/.test(GRID),
    '🔴 I7: the grid declares the column AND sorts it on the raw key — a render condition in a .tsx is unreachable to a probe (tech-debt #134), so this reads the config as text');
}

console.log(`\nreceiptsList: ${passed} passed, ${failed} failed`);
console.log(`  populations — fixtures derived from 17 LAWNS receipts (36 across all tenants), 11 receipt-linked orders, 11 ocr-invoice deliveries, all measured live 2026-09-01.`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
