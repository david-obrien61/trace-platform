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
  RECEIPTS_SELECT, RECEIPTS_PAGE_LIMIT,
  bankedVerdict, captureOutcome, receiptRowModel, receiptListModel, countLabel, listVisibleForStep,
  receiptSortKey, compareReceiptsForDisplay,
  type RawReceiptRow, type RawOrderRow,
} from './receiptsList';

// Repo-root-relative, NOT __dirname/import.meta: esbuild bundles this file elsewhere, so only
// process.cwd() reliably points at the repo root. Same convention as deliveryFulfilment.test.ts.
const SELF = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/lib/receiptsList.ts'), 'utf8');

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

console.log(`\nreceiptsList: ${passed} passed, ${failed} failed`);
console.log(`  populations — fixtures derived from 17 LAWNS receipts (36 across all tenants), 11 receipt-linked orders, 11 ocr-invoice deliveries, all measured live 2026-09-01.`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
