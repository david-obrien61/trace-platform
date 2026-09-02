/**
 * ── receiptDetail — the lines, what the reader read, and the owner's pencil ──────────────────
 *
 * Fixtures are the LIVE 2026-09-02 measurement, not invented data (populations stated at every
 * count and printed by this file when it runs):
 *   · 36 receipts rows across 3 tenants — LAWNS 17, `Test Dave's Tree Nest` 17, `Test David's
 *     new Business` 2. LAWNS vendors: LAWNS Tree Farm 9 · bwi 4 · Bailey Bark 3 · Sudderth 1.
 *   · `line_items` carries TWO keys on 171 of 171 stored lines (description, amount).
 *     `line_items_original` carries FIVE on 141 of 141 (+ quantity, unit_price, sku).
 *   · `line_items` is longer than the original on 30 of 36 rows; the extra line is the injected
 *     `Tax` on 30 of 30, absent from the original on 30 of 30, matching the parsed tax on 30/30.
 *   · The parsed OCR JSON is recoverable from `ocr_raw` on 35 of 36 rows; `tax` non-null on 30
 *     of 35, `subtotal` non-null on 30 of 35. ONE row carries an Anthropic-shaped envelope
 *     (`model|stop_reason|usage`) with NO recoverable inner JSON.
 *   · image_url: 28 jpg, 8 pdf, of 36. The Sudderth invoice is one of the PDFs.
 *
 * 🔴 WHY THE NEGATIVE CASES ARE HALF THIS FILE. Every stored reconcile row today reads `match`
 * with a zero delta, every current line carries exactly two keys, and every recoverable envelope
 * is Gemini-shaped. A suite built only from live rows would exercise ONE branch of each decision
 * and call the module proven. R-33: a check that cannot disagree is not a check.
 *
 * 🔴 §B EXISTS BECAUSE THE FIRST STAGE-0 PROBE WAS WRONG IN EXACTLY THIS WAY. It searched the
 * OUTER envelope for `"tax"`, found 0 of 36, and reported the figure absent — while the parsed
 * object sat one level down as an escaped string, present on 35 of 35. B4 is that bug, frozen as
 * a fixture: an envelope with no `candidates` must return null and must NOT be mistaken for a
 * successful read of a document that had no tax.
 *
 * PROBES BOTH DIRECTIONS (STD-022): every rule is asserted by a case that must pass AND a case
 * that must fail.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/receiptDetail.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RECEIPT_DETAIL_SELECT, recoverParsedOcr, ocrHeaderFigures, lineRowModel, receiptDetailModel,
  imagePanel, previewVerdict, vendorUnitQuestion, UNIT_ANSWERS,
  type RawReceiptDetailRow, type StoredLine,
} from './receiptDetail';
import { vendorKey } from './vendorKey';

const ROOT = process.cwd();
const MODEL_SRC = readFileSync(join(ROOT, 'packages/cultivar-os/src/lib/receiptDetail.ts'), 'utf8');
const RECON_SRC = readFileSync(join(ROOT, 'packages/cultivar-os/src/utils/receiptReconciliation.ts'), 'utf8');
const SQL_RAW   = readFileSync(join(ROOT, 'supabase/migrations/20260902_receipt_line_edit_and_vendor_preference.sql'), 'utf8');
// Comment lines stripped for the same reason KEEPER_SRC strips them: this migration DISCUSSES
// `line_items_original`, the owner check and the acknowledgement at length, so a probe matching
// the file as a whole would be satisfied by the prose defending the guard rather than the guard.
const SQL_SRC   = SQL_RAW.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
const KEEPER_RAW = readFileSync(join(ROOT, 'packages/cultivar-os/src/pages/ReceiptKeeper.tsx'), 'utf8');
// 🔴 COMMENTS STRIPPED BEFORE MATCHING, AND THAT IS NOT FUSSINESS — U10 FAILED ON ITS FIRST RUN
// FOR EXACTLY THIS REASON. The `|| 0` it forbids had been removed from the code and QUOTED in the
// comment explaining its removal, so the probe read the explanation as the defect. A probe that
// matches prose is testing the wrong artifact, and it fails and passes for the wrong reasons.
const KEEPER_SRC = KEEPER_RAW.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// fixtures — the real Sudderth row, verbatim from the live table
// ════════════════════════════════════════════════════════════════════════════════════════════
const SUDDERTH_ORIGINAL: StoredLine[] = [
  { sku: null, amount: 725.2,  quantity: 20.72, unit_price: 35,    description: 'Services Devin - 8/18/26 - Texas Materials Ticket #126179163 -20.72' },
  { sku: null, amount: 532.75, quantity: 21.31, unit_price: 25,    description: 'Services Devin - 8/19/26 - Collier Ticket #417386921.31' },
  { sku: null, amount: 44.03,  quantity: 1,     unit_price: 44.03, description: 'CREDIT CARD FEE PLEASE ADD 3.5% IF PAYING WITH A CREDIT CARD' },
];
// As actually stored — the confirm path dropped three of the five keys.
const SUDDERTH_CURRENT: StoredLine[] = SUDDERTH_ORIGINAL.map(l => ({ description: l.description, amount: l.amount }));

const geminiEnvelope = (parsed: unknown) => ({
  candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(parsed) + '\n```' }] } }],
  responseId: 'x', modelVersion: 'gemini', usageMetadata: {},
});

const SUDDERTH: RawReceiptDetailRow = {
  id: 'a6fdd143-5394-453c-8060-2b0f284840ca',
  business_id: 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74',
  vendor: 'Sudderth Brothers Contracting, Inc.', date: '2026-08-20',
  amount: 1301.98, category: 'other', created_at: '2026-09-01T00:00:00Z', updated_at: null,
  status: 'confirmed',
  image_url: 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74/a6fdd143-5394-453c-8060-2b0f284840ca.pdf',
  line_items: SUDDERTH_CURRENT, line_items_original: SUDDERTH_ORIGINAL,
  ocr_raw: geminiEnvelope({ vendor: 'Sudderth Brothers Contracting, Inc.', amount: 1301.98, subtotal: null, tax: null, line_items: SUDDERTH_ORIGINAL }),
  reconcile_status: 'match', reconcile_delta: 0, reconcile_overridden_at: null,
  accept_vs_edit: 'edited', amount_original: 1301.98, header_amount_edited: false,
};

console.log('── receiptDetail — populations behind these fixtures ──');
console.log('   36 receipts rows · 171 current lines (2 keys) · 141 original lines (5 keys)');
console.log('   parsed OCR recoverable on 35/36 · tax non-null 30/35 · 28 jpg + 8 pdf');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('\n§A · the projection');
// ════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WORD-BOUNDARY, NOT `.includes()`. `line_items` is a SUBSTRING of `line_items_original`, so
// an `includes` check stayed green when `line_items` was deleted from the projection — mutant M15
// survived on precisely that, and the page would have rendered no lines at all.
for (const col of ['line_items', 'line_items_original', 'ocr_raw', 'image_url', 'amount']) {
  ok(new RegExp(`(^|[\\s,])${col}([\\s,]|$)`).test(RECEIPT_DETAIL_SELECT),
    `A1 ${col} is selected as its own column — the detail view cannot render it otherwise`);
}
ok(!/orders\s*\(/.test(RECEIPT_DETAIL_SELECT),
  'A2 (negative): the order/delivery embed is NOT in this projection — that chain is the list’s job, and re-reading it here would be a second answer to one question');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§B · recovering the parsed reply out of the provider envelope');
// ════════════════════════════════════════════════════════════════════════════════════════════
ok(recoverParsedOcr(geminiEnvelope({ tax: 12.5 }))?.tax === 12.5, 'B1 a Gemini envelope yields the parsed object');
ok(recoverParsedOcr(geminiEnvelope({ subtotal: 100, tax: 8.25 }))?.subtotal === 100, 'B2 subtotal comes back');
ok(recoverParsedOcr(null) === null, 'B3 (negative): null envelope → null, not an empty object');
// 🔴 THE FROZEN BUG: the Anthropic-shaped envelope, 1 of 36 rows live.
ok(recoverParsedOcr({ model: 'claude', stop_reason: 'end_turn', usage: {} }) === null,
  'B4 (negative): an envelope with no candidates → null — the 1-of-36 row, and the exact shape the first Stage 0 probe mis-read');
ok(recoverParsedOcr({ candidates: [] }) === null, 'B5 (negative): empty candidates → null');
ok(recoverParsedOcr({ candidates: [{ content: { parts: [{ text: 'not json at all' }] } }] }) === null,
  'B6 (negative): unparseable text → null, never a half-built object');
ok(recoverParsedOcr({ candidates: [{ content: { parts: [{ text: '[1,2,3]' }] } }] }) === null,
  'B7 (negative): a JSON ARRAY is not a parsed document — refused rather than indexed into');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§C · subtotal and tax — three states, never collapsed to a zero');
// ════════════════════════════════════════════════════════════════════════════════════════════
const withFigures = { ...SUDDERTH, ocr_raw: geminiEnvelope({ subtotal: 1200, tax: 101.98 }) };
const hf1 = ocrHeaderFigures(withFigures);
ok(hf1.subtotalText === '$1,200.00' && hf1.taxText === '$101.98', 'C1 both figures render when the reader found them');
ok(hf1.subtotalNote === null && hf1.taxNote === null, 'C2 no note when there is a figure');

const noFigures = ocrHeaderFigures({ ...SUDDERTH, ocr_raw: geminiEnvelope({ subtotal: null, tax: null }) });
ok(noFigures.subtotalText === null && /No subtotal was printed/.test(noFigures.subtotalNote ?? ''),
  'C3 recovered-but-absent says the document had none');
const unreadable = ocrHeaderFigures({ ...SUDDERTH, ocr_raw: { model: 'claude', usage: {} } });
ok(unreadable.subtotalText === null && /Not recorded/.test(unreadable.subtotalNote ?? ''),
  'C4 the unreadable envelope says NOT RECORDED — a different sentence from "the document had none"');
ok(noFigures.subtotalNote !== unreadable.subtotalNote,
  'C5 (the load-bearing one): "the document had no subtotal" and "we cannot tell" are DIFFERENT statements and must not share a sentence');
ok(hf1.subtotalText !== '$0.00' && unreadable.subtotalText !== '$0.00',
  'C6 (negative): no path renders $0.00 for an absent subtotal — a zero would read as a measurement');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§D · field states — and the one that stops a false accusation');
// ════════════════════════════════════════════════════════════════════════════════════════════
const same = lineRowModel(0, { description: 'a', amount: 10 }, { description: 'a', amount: 10 }, null);
ok(same.fields.description.state === 'same' && same.fields.amount.state === 'same', 'D1 identical values read as same');

const changed = lineRowModel(0, { description: 'a', amount: 12 }, { description: 'a', amount: 10 }, null);
ok(changed.fields.amount.state === 'changed', 'D2 a differing amount reads as changed');
ok(changed.fields.amount.originalText === '$10.00' && changed.fields.amount.currentText === '$12.00',
  'D3 BOTH values are carried — showing only the current one wastes the snapshot banked since June');

// 🔴 the legacy shape: current has NO quantity key, original does
const legacy = lineRowModel(0, SUDDERTH_CURRENT[0], SUDDERTH_ORIGINAL[0], null);
ok(legacy.fields.quantity.state === 'never-carried',
  'D4 🔴 a key the saved copy NEVER CARRIED is not "changed" — reading it as changed tells Lauren she deleted a quantity she never touched');
ok(legacy.fields.unit_price.state === 'never-carried' && legacy.fields.unit_price.originalText === '$35.00',
  'D5 the Sudderth rate is recoverable and labelled as the reader’s, not as an edit');
ok(legacy.fields.description.state === 'same' && legacy.fields.amount.state === 'same',
  'D6 (negative): the two keys that WERE carried still compare normally — never-carried is not a blanket excuse');
ok(legacy.fields.sku.state === 'absent',
  'D7 (negative): a field null on BOTH sides says nothing at all — no note, no dash, no claim');

const nowEdited = lineRowModel(0, { ...SUDDERTH_CURRENT[0], quantity: 19 }, SUDDERTH_ORIGINAL[0], null);
ok(nowEdited.fields.quantity.state === 'changed',
  'D8 🔴 (the mirror of D4): once the key IS present and differs, it reads as changed — never-carried must not swallow a real edit');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§E · where a line came from');
// ════════════════════════════════════════════════════════════════════════════════════════════
const taxLine = lineRowModel(3, { description: 'Tax', amount: 8.25 }, undefined, 8.25);
ok(taxLine.origin === 'platform-tax' && /Added by the platform/.test(taxLine.originNote ?? ''),
  'E1 🔴 the injected Tax line says the PLATFORM added it — 30 of 36 rows have one, and calling it an owner’s line is the accusation this build removes');
const addedLine = lineRowModel(3, { description: 'Pallet charge', amount: 20 }, undefined, 8.25);
ok(addedLine.origin === 'added' && !/platform/i.test(addedLine.originNote ?? ''),
  'E2 (negative): a genuinely added line is NOT dressed as a platform line');
const taxWrongAmount = lineRowModel(3, { description: 'Tax', amount: 99 }, undefined, 8.25);
ok(taxWrongAmount.origin === 'added',
  'E3 (negative): a line called Tax whose amount does NOT match the parsed tax is not attributed to the platform — the name alone proves nothing');
const taxNoParsed = lineRowModel(3, { description: 'Tax', amount: 8.25 }, undefined, null);
ok(taxNoParsed.origin === 'added',
  'E4 (negative): with no parsed tax to compare against, the claim is not made');
ok(lineRowModel(0, SUDDERTH_CURRENT[0], SUDDERTH_ORIGINAL[0], null).origin === 'read',
  'E5 a line that WAS read carries no origin note');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§F · the document — 8 of 36 are PDFs');
// ════════════════════════════════════════════════════════════════════════════════════════════
ok(imagePanel('b/x.pdf').kind === 'pdf', 'F1 🔴 a .pdf is a pdf — an <img> with a pdf source renders nothing and reports nothing');
ok(imagePanel('b/x.PDF').kind === 'pdf', 'F2 case does not decide it');
ok(imagePanel('b/x.jpg').kind === 'image', 'F3 a jpg is an image');
ok(imagePanel(null).kind === 'none' && imagePanel(null).note !== null, 'F4 (negative): no image says so rather than rendering an empty frame');
ok(imagePanel('  ').kind === 'none', 'F5 (negative): a blank path is not a document');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§G · the preview verdict — and the blank that must not become a zero');
// ════════════════════════════════════════════════════════════════════════════════════════════
const L = (...amts: Array<number | null>): StoredLine[] => amts.map((a, i) => ({ description: 'l' + i, amount: a }));
ok(previewVerdict(L(725.2, 532.75, 44.03), 1301.98).readout?.text.includes('=') === true, 'G1 the Sudderth lines reconcile against its total');
ok(previewVerdict(L(100), 100).isLargeMismatch === false, 'G2 an exact match is not a mismatch');
ok(previewVerdict(L(100), 500).isLargeMismatch === true, 'G3 a large gap is flagged, not stamped as a match');
ok(previewVerdict(L(100), 103).isLargeMismatch === false, 'G4 (negative): a small gap is not escalated to a mismatch');

const blank = previewVerdict(L(100, null), 100);
ok(blank.readout === null && blank.incompleteNote !== null,
  'G5 🔴 a line with NO amount makes the sum unassertable — reported as incomplete, never summed as $0.00 and stamped `match`');
ok(blank.isLargeMismatch === false,
  'G6 (negative): an unassertable sum is not a mismatch either — it is an absence of a verdict, not a bad one');
const noTotal = previewVerdict(L(100), null);
ok(noTotal.readout === null && /no saved total/i.test(noTotal.incompleteNote ?? ''), 'G7 no total → the lines are checked against nothing, and it says so');
ok(previewVerdict([], 100).readout === null && previewVerdict([], 100).incompleteNote === null,
  'G8 (negative): no lines at all is silent — there is no claim to make');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§H · the vendor fold');
// ════════════════════════════════════════════════════════════════════════════════════════════
ok(vendorKey('Sudderth Brothers Contracting, Inc.') === vendorKey('Sudderth Brothers Contracting'),
  'H1 🔴 the corporate suffix does not make a second vendor — "one spelling away from asking twice" is the whole risk');
ok(vendorKey('bwi') === vendorKey('BWI'), 'H2 case folds');
ok(vendorKey('Bailey Bark Materials, Inc.') === 'bailey bark materials', 'H3 punctuation and suffix come off');
ok(vendorKey('bwi') !== vendorKey('Bailey Bark Materials, Inc.'),
  'H4 (negative): two genuinely different vendors do NOT fold together — a fold that collides everything asks nobody anything');
ok(vendorKey(null) === '' && vendorKey('   ') === '', 'H5 (negative): no vendor folds to empty, and the caller must not treat that as a vendor');
ok(vendorKey('Co-op Gardens') === 'co op gardens',
  'H6 (negative): a suffix word INSIDE a name is not stripped — only trailing ones, or "Co-op" becomes "op"');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§I · the question — asked about the vendor, once');
// ════════════════════════════════════════════════════════════════════════════════════════════
const unasked = vendorUnitQuestion('Sudderth Brothers Contracting, Inc.', null);
ok(unasked.answered === false && unasked.prompt.includes('Sudderth Brothers Contracting, Inc.'),
  'I1 the prompt names the VENDOR');
ok(!/20\.72|\d+\.\d\d/.test(unasked.prompt),
  'I2 🔴 (negative): the prompt names NO figure from the document — "is 20.72 yards or tons?" returns on every invoice forever');
const answered = vendorUnitQuestion('Sudderth Brothers Contracting, Inc.', {
  vendor_key: 'sudderth brothers contracting', vendor_label: 'Sudderth Brothers Contracting, Inc.',
  preference_kind: 'billing_unit', preference_value: 'ton', preference_note: null, answered_at: '2026-09-02',
});
ok(answered.answered === true && /by the ton/.test(answered.standingAnswerText ?? ''),
  'I3 the standing answer is what a later invoice shows — the point of asking once');
const notSure = vendorUnitQuestion('bwi', {
  vendor_key: 'bwi', vendor_label: 'bwi', preference_kind: 'billing_unit',
  preference_value: null, preference_note: null, answered_at: '2026-09-02',
});
ok(notSure.answered === true,
  'I4 🔴 (the subtle one): "not sure" is an ANSWER — the row exists, so it must not read as never-asked and re-prompt forever');
ok(notSure.answeredValue === null && notSure.standingAnswerText !== null,
  'I5 ...and it says nobody was sure, rather than asserting a unit');
ok(vendorUnitQuestion(null, null).vendorKey === null,
  'I6 (negative): no vendor → no question rendered at all');
// `String(a.value)` deliberately: the const-assertion already makes `=== 'hour'` a TYPE error
// (TS2367, "no overlap"), which is a STRONGER guarantee than this probe — but a type that
// forbids it today can be widened tomorrow by the edit that adds the option, and this assertion
// is what would go red in that same commit. Both, not either.
ok(!UNIT_ANSWERS.some(a => String(a.value) === 'hour'),
  'I7 🔴 (negative): `hour` is NOT offered — the unit taxonomy is a closed CHECK (container|volume|weight|length|each) and adding it is a separate decision');
ok(UNIT_ANSWERS.some(a => a.value === null),
  'I8 "not sure" is on the list — a question that only accepts confident answers manufactures confident data');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§J · the whole model over the real Sudderth row');
// ════════════════════════════════════════════════════════════════════════════════════════════
const m = receiptDetailModel(SUDDERTH);
ok(m.lines.length === 3, 'J1 all three Sudderth lines are present');
ok(m.lines[0].fields.quantity.originalText === '20.72', 'J2 🔴 the 20.72 is on the page — from a list this receipt is $1,301.98 of "Services"');
ok(m.lines[0].fields.unit_price.originalText === '$35.00' && m.lines[1].fields.unit_price.originalText === '$25.00',
  'J3 🔴 both rates are on the page — the two figures the cost model actually needs');
ok(m.image.kind === 'pdf', 'J4 the Sudderth capture is a PDF and is treated as one');
ok(m.legacyShape === true, 'J5 the row is flagged as pre-dating the five-key save, so the missing rates read as OUR omission');
ok(m.amountValue === 1301.98, 'J6 the total is carried as a FIGURE, not re-parsed out of its own formatting');
ok(m.bankedReadout !== null, 'J7 the banked verdict still displays as banked');

const notLegacy = receiptDetailModel({ ...SUDDERTH, line_items: SUDDERTH_ORIGINAL });
ok(notLegacy.legacyShape === false,
  'J8 (negative): a row saved WITH the five keys is not flagged legacy — otherwise the banner would show forever and mean nothing');

// ── 🔴 THE EDIT FORM MUST NOT TURN OUR OMISSION INTO HER DELETION ──────────────────────────
// Found by reading the save path, not by a probe: on a legacy row the form used to open on
// `storedLines`, whose lines have NO quantity key. Change a description, save, and the quantity
// goes from `never-carried` (correctly OUR omission) to `changed` against a blank — which says the
// OWNER DELETED IT. The same false accusation this surface exists to remove, arriving through the
// save path instead of the read path.
ok(m.editableLines[0].quantity === 20.72 && m.editableLines[0].unit_price === 35,
  'J10 🔴 the edit form SEEDS a key the saved copy never carried from what the reader read — otherwise saving an unrelated edit silently deletes the rate');
ok(m.storedLines[0].quantity === undefined,
  'J11 (negative): `storedLines` is NOT mutated — what is stored and what the form opens on stay two different things');
const blankKept = receiptDetailModel({
  ...SUDDERTH,
  line_items: [{ description: 'x', amount: 1, quantity: null }],
  line_items_original: [{ description: 'x', amount: 1, quantity: 9 }],
});
ok(blankKept.editableLines[0].quantity === null,
  'J12 🔴 (the distinction that makes J10 safe): a key that IS present and deliberately blank is LEFT blank — a null someone chose is an answer, not an omission to backfill');

const deletedLine = receiptDetailModel({ ...SUDDERTH, line_items: [SUDDERTH_CURRENT[0]] });
ok(deletedLine.lines.length === 3,
  'J9 🔴 a line the owner DELETED still gets a row — a deletion that leaves no trace on screen is the silence this surface exists to end');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§T · the two copies of one threshold agree (STD-011, watched rather than admitted)');
// ════════════════════════════════════════════════════════════════════════════════════════════
const tsMatch = RECON_SRC.match(/MATCH_TOLERANCE\s*=\s*([\d.]+)/);
const tsAbs   = RECON_SRC.match(/SMALL_GAP_ABS\s*=\s*([\d.]+)/);
const tsPct   = RECON_SRC.match(/SMALL_GAP_PCT\s*=\s*([\d.]+)/);
const sqlMatch = SQL_SRC.match(/v_abs\s*<=\s*([\d.]+)/);
const sqlAbs   = SQL_SRC.match(/v_abs\s*<\s*([\d.]+)/);
const sqlPct   = SQL_SRC.match(/v_abs\s*\/\s*v_total\)\s*<\s*([\d.]+)/);
ok(!!(tsMatch && sqlMatch) && parseFloat(tsMatch![1]) === parseFloat(sqlMatch![1]), 'T1 match tolerance agrees between client and server');
ok(!!(tsAbs && sqlAbs) && parseFloat(tsAbs![1]) === parseFloat(sqlAbs![1]), 'T2 small-gap absolute agrees');
ok(!!(tsPct && sqlPct) && parseFloat(tsPct![1]) === parseFloat(sqlPct![1]), 'T3 small-gap percentage agrees');

// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§U · the guarantees that are structural, not promised');
// ════════════════════════════════════════════════════════════════════════════════════════════
const rpc = SQL_SRC.slice(SQL_SRC.indexOf('CREATE OR REPLACE FUNCTION public.edit_receipt_line_items'));
// 🔴 THE SLICE USED TO END AT `rpc.indexOf('WHERE id = p_receipt_id')` — which finds the SELECT at
// the TOP of the body, BEFORE the UPDATE. End < start yields an EMPTY STRING, and every negative
// assertion below passed trivially against nothing at all. Mutants M9 and M17 both survived on it.
// Measured from the UPDATE to the semicolon that ends it, and asserted non-empty first.
const updStart = rpc.indexOf('UPDATE public.receipts');
const updateStmt = updStart === -1 ? '' : rpc.slice(updStart, rpc.indexOf(';', updStart));
ok(updateStmt.length > 40 && /SET line_items\s*=/.test(updateStmt),
  'U0 🔴 the UPDATE statement was actually located — a probe over an empty slice proves nothing, and this one did for a while');
ok(!/line_items_original/.test(updateStmt),
  'U1 🔴 the RPC’s UPDATE does not name line_items_original — the snapshot is not one edit away from being overwritten');
ok(!/amount_original/.test(updateStmt), 'U2 nor amount_original');
ok(/IF NEW\.line_items_original IS DISTINCT FROM OLD\.line_items_original THEN/.test(SQL_SRC),
  'U3 🔴 and a trigger refuses it on EVERY path — the CONDITION is asserted, not merely the comparison text: `IF false AND <comparison>` still contains the comparison (mutant M10 survived on that)');
// 🔴 THE BRANCH, NOT THE MESSAGE. `IF false THEN RAISE EXCEPTION 'only the business owner…'`
// keeps every string intact while admitting everyone — mutants M17 and M18 survived on exactly
// that. What is asserted is that the refusal is REACHED when the actor is not the owner.
ok((SQL_SRC.match(/IF NOT v_is_owner THEN/g) ?? []).length === 2,
  'U4 🔴 the owner check GUARDS BOTH PATHS — once in the RPC, once in the trigger — and it is the branch that is asserted, not the error message beneath it');
ok(/owner_id = auth\.uid\(\)/.test(rpc) && /only the business owner may edit receipt line items/.test(rpc),
  'U5 the RPC resolves ownership from `businesses.owner_id`, in the database, not in the component');
// 🔴 U6 IS THE INVERSE OF WHAT IT USED TO ASSERT, AND THE INVERSION IS THE FINDING.
// It read: `/receipt\.line_edit_denied/.test(SQL_SRC)` — i.e. that a STRING appeared somewhere in
// the file. It did, inside an INSERT that could never commit: the refusal block INSERTed an
// audit row and then RAISEd, and with no enclosing EXCEPTION block the RAISE aborts the
// transaction and rolls that INSERT back. The probe was structurally incapable of noticing,
// because a rolled-back statement is textually identical to a committed one.
// What is asserted now is the rule that actually holds: NOTHING IS WRITTEN INSIDE A BLOCK THAT
// ENDS IN A RAISE. The block is located and its contents are asserted, not the file's.
const refuseStart = rpc.indexOf('IF NOT v_is_owner THEN');
const refuseBlock = refuseStart === -1 ? '' : rpc.slice(refuseStart, rpc.indexOf('END IF;', refuseStart));
ok(refuseBlock.length > 40 && /RAISE EXCEPTION/.test(refuseBlock),
  'U6a the owner-refusal block was actually located and does raise — the slice is non-empty (U0’s lesson, applied to a second slice)');
ok(!/INSERT INTO/.test(refuseBlock),
  'U6b 🔴 the refusal writes NOTHING before it raises — a RAISE with no enclosing EXCEPTION block aborts the transaction, so any INSERT above it is rolled back and the row never exists. Shipping a statement that claims to record a refusal it cannot record is worse than not recording it (tech-debt #150)');
// 🔴 AGAINST `SQL_RAW`, NOT `SQL_SRC`, AND THE REASON IS THE PROBE'S OWN SUBJECT. `SQL_SRC` has
// its comments stripped — deliberately, because U10 had been reading an explanation of a defect
// AS the defect. But what this asserts is a NAMED GAP, and a named gap lives in a comment by
// nature. Run against the stripped copy this fails while the file plainly says it (it did, on
// the first run). Matching the wrong layer of a thing is the shape §6 warns about; here the
// layers are raw and stripped, and each probe has to say which one its claim lives in.
ok(/tech-debt #150/.test(SQL_RAW),
  'U6c and the gap it leaves is NAMED in the migration rather than silently absent — an unrecorded hole is a lie by omission (OP-14 clause 2)');
// One audit insert remains — the SUCCESS row — and it is written after the write it describes.
ok((rpc.match(/INSERT INTO public\.audit_log/g) ?? []).length === 1,
  'U7a exactly ONE audit insert survives in the RPC: the success row. The second one was a promise the transaction could not keep');
ok(rpc.lastIndexOf('INSERT INTO public.audit_log') > rpc.indexOf('UPDATE public.receipts'),
  'U7b the success audit row is written AFTER the write, in the SAME transaction — two client statements can half-land, one plpgsql body cannot');
ok(rpc.indexOf('INSERT INTO public.audit_log') > refuseStart && refuseStart !== -1,
  'U7c (negative): the surviving insert sits BELOW the refusal, not inside it — it is on the path that commits');

// ── the per-line diff must not invent changes out of two spellings of "absent" ───────────────
// 🔴 THE DEFECT THIS CATCHES, MEASURED: `->` yields SQL NULL for a key that is ABSENT and jsonb
// `null` for a key explicitly set to null, and `IS DISTINCT FROM` calls those two different.
// All 36 receipts captured before today store TWO keys per line; the edit form sends FIVE. So a
// one-word correction on the Sudderth invoice would have logged ONE real change and NINE
// phantom ones, and told the owner she changed ten values.
const diffCmp = SQL_SRC.slice(SQL_SRC.indexOf('v_old_v :='), SQL_SRC.indexOf('v_changes := v_changes ||'));
ok(diffCmp.length > 80, 'U11a the diff comparison was actually located');
ok(/COALESCE\(v_old_v,\s*'null'::jsonb\)\s*IS DISTINCT FROM\s*COALESCE\(v_new_v,\s*'null'::jsonb\)/.test(diffCmp),
  'U11b 🔴 an ABSENT key and a PRESENT null are folded onto each other before comparison — both mean "no value", and only one of them is a change');
// And the rule itself, executed rather than grepped. This models `->`'s two forms of absence the
// way Postgres returns them; it is a model, NOT a database, and it is labelled as one.
const pgArrow = (obj: Record<string, unknown> | undefined, k: string): 'sql-null' | 'json-null' | unknown =>
  obj === undefined || !(k in obj) ? 'sql-null' : (obj[k] === null ? 'json-null' : obj[k]);
const foldedDiffers = (a: unknown, b: unknown) => {
  const f = (v: unknown) => (v === 'sql-null' || v === 'json-null' ? 'ABSENT' : v);
  return f(a) !== f(b);
};
ok(pgArrow({ description: 'x' }, 'quantity') !== pgArrow({ description: 'x', quantity: null }, 'quantity'),
  'U11c (the premise) the two forms of absence ARE distinguishable — without this the fold would be testing nothing');
ok(!foldedDiffers(pgArrow({ description: 'x' }, 'quantity'), pgArrow({ description: 'x', quantity: null }, 'quantity')),
  'U11d a stored line missing `quantity` against a submitted line whose `quantity` is null is NOT a change');
ok(foldedDiffers(pgArrow({ quantity: null }, 'quantity'), pgArrow({ quantity: 20.72 }, 'quantity')),
  'U11e (negative) and a real value arriving where there was none STILL IS one — the fold does not swallow the change it exists beside');
ok(/IF NOT p_acknowledged_mismatch THEN/.test(rpc) && /large_mismatch_overridden/.test(rpc),
  'U8 🔴 a large mismatch must be acknowledged BEFORE it can be stored — the GUARD is asserted, not the parameter: the parameter survives its own `IF false` (mutant M11)');
// the capture path no longer throws the three keys away
// 🔴 THE SAVE SITE SPECIFICALLY. `quantity: item.quantity` appears TWICE — once building the
// editable state from the OCR read, once building what is WRITTEN. Only the second decides what
// `line_items` holds, and matching the file as a whole stayed green when the save site was
// stripped (mutant M12). The final map is the one identified, by the object it returns.
const finalMap = KEEPER_SRC.slice(KEEPER_SRC.indexOf('const finalLineItems'), KEEPER_SRC.indexOf('const dbReconcileStatus'));
ok(finalMap.length > 80, 'U9a the save-path map was actually located');
ok(/quantity:\s*item\.quantity/.test(finalMap) && /unit_price:\s*item\.unit_price/.test(finalMap) && /sku:\s*item\.sku/.test(finalMap),
  'U9b 🔴 the confirm path now WRITES quantity, unit_price and sku — this is the upstream defect, and the edit question was downstream of it');
ok(!/parseFloat\(item\.amount\)\s*\|\|\s*0/.test(finalMap),
  'U10 🔴 (negative): the `|| 0` that turned a blank amount into a real-looking $0.00 is gone from the SAVE path');
// the model does not quietly re-stamp the banked verdict
ok(/previewVerdict/.test(MODEL_SRC) && /preview/i.test(MODEL_SRC),
  'U11 the recompute is a labelled PREVIEW; the stored verdict comes back from the server');

// ════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE EXACT SPELLING `N passed, N failed` IS LOAD-BEARING, NOT DECORATION. `run-tests.mjs`
// parses it to roll the file's assertions into the suite total, and a file it cannot parse runs,
// can fail, and contributes ZERO to the count — which is how a build reports a total that silently
// omits its own new file. My first version printed "89 assertions passed" and the runner logged
// `(no summary line)`; the roll-up stayed at 3041 while I had written 89 new probes into the ledger.
// The runner's own comment records the same defect happening once before (compare.test.ts, 17
// assertions invisible). Caught by reading the runner output rather than the file's own green tick.
console.log(`\nreceiptDetail: ${passed} passed, ${failed} failed`);
console.log('  populations — 36 receipts rows across 3 tenants (LAWNS 17); 171 current line objects');
console.log('  carrying 2 keys, 141 original line objects carrying 5; parsed OCR recoverable on');
console.log('  35/36; tax non-null 30/35; 28 jpg + 8 pdf. All measured live 2026-09-02.');
if (failed > 0) { failures.forEach(f => console.error('   · ' + f)); process.exit(1); }
