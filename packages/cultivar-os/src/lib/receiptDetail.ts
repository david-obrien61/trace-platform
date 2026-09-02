// ============================================================
// receiptDetail — one receipt, every line, and what the reader originally made of it.
//
// PURPOSE:      The list (#252) shows that a capture exists. It cannot show what is ON it, and
//               that is where the costing question actually lives. The Sudderth invoice is
//               $1,301.98 of "Services" from a list; opened, it is 20.72 of something at $35.00
//               and 21.31 of something at $25.00 plus a card fee — which is the cost model's
//               input. `ProjectCostDrillIn` has wanted this route since before it existed
//               (`openReceipt` navigates to `/receipts` under a comment saying so).
//
// 🔴 MEASURED 2026-09-02 AGAINST THE LIVE TENANT, AND EVERY DECISION BELOW FOLLOWS FROM IT:
//
//   ① TAX IS A LINE, NOT A FIELD. `receipts` has 21 columns and NEITHER `subtotal` NOR `tax`.
//      The OCR parses both (non-null on 30 of 35 rows whose parsed JSON is recoverable), and the
//      capture path INJECTS the tax as a synthesised line item — `{description:'Tax', amount}` —
//      matching the parsed figure on 30 of 30, and absent from `line_items_original` on 30 of 30.
//      So the tax on screen comes from a LINE, and that line was written by us, not read.
//
//   ② `line_items` AND `line_items_original` ARE NOT THE SAME SHAPE. Current carries TWO keys on
//      171 of 171 stored lines (`description`, `amount`); original carries FIVE on 141 of 141
//      (`description`, `amount`, `quantity`, `unit_price`, `sku`). The confirm path DROPPED
//      quantity, unit_price and sku on save. This build stops the dropping — but every row
//      captured BEFORE it still has the two-key shape, and `fieldState` below exists so those
//      rows read honestly instead of reporting that someone deleted a quantity.
//
//   ③ SUBTOTAL IS IN NO FIELD AT ALL. It is recoverable only from the model's raw reply nested
//      inside `ocr_raw.candidates[0].content.parts[].text` — on 35 of 36 rows. ONE row carries a
//      differently-shaped provider envelope (`model|stop_reason|usage`) with no recoverable inner
//      JSON. That row must say the subtotal was not recorded. It must NOT show $0.00.
//
// 🔴 WHY THIS FILE MAY RE-EVALUATE WHEN `receiptsList.ts` MAY NOT — the contracts genuinely
//    differ and the difference is not a loosening. The list displays a HISTORICAL verdict: the
//    one the owner was shown at save time, which must not be silently replaced by a second
//    verdict computed today. This surface is an EDITOR: it shows a LIVE PREVIEW of what the
//    server will store if the owner saves, labelled as a preview and never written from here.
//    The STORED verdict still comes from `edit_receipt_line_items`, server-authoritative
//    (§1.6 item 10). Preview and stored are two different claims and are labelled as two.
//
// DEPENDENCIES: `../utils/receiptReconciliation` (`computeReconcile` + the severity styles —
//               the SAME function the capture path uses, not a second copy: §6 r8) ·
//               `./vendorKey` (the ask-once fold). Otherwise pure — no React, no Supabase, no
//               DOM, no clock. A render condition inside a `.tsx` cannot be asserted
//               (tech-debt #134), so every decision lives here.
//
// OUTPUTS:      RECEIPT_DETAIL_SELECT · RawReceiptDetailRow · recoverParsedOcr · ocrHeaderFigures
//               · lineRowModel · receiptDetailModel · imagePanel · previewVerdict ·
//               vendorUnitQuestion · UNIT_ANSWERS
// ============================================================

import {
  computeReconcile,
  fmt,
  reconcileReadoutStyle,
  reconcileReadoutText,
  type ReconcileResult,
} from '../utils/receiptReconciliation';
import { vendorKey } from './vendorKey';
import type { CSSProperties } from 'react';

// ════════════════════════════════════════════════════════════════════════════════════════════
// §1 THE READ
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The detail projection.
 *
 * 🔴 IT SELECTS `line_items` AND `ocr_raw`, WHICH THE LIST DELIBERATELY DOES NOT. That is not a
 * relaxation of the list's rule — it is the difference between a screen that DISPLAYS a banked
 * verdict and a screen that lets the owner change the inputs to it. `receiptsList.test.ts` A5/A6
 * assert the list's projection stays narrow; those probes are untouched by this one.
 */
export const RECEIPT_DETAIL_SELECT = `
  id, business_id, vendor, date, amount, category, created_at, updated_at, status, image_url,
  line_items, line_items_original, ocr_raw,
  reconcile_status, reconcile_delta, reconcile_overridden_at,
  accept_vs_edit, amount_original, header_amount_edited
`;

/** A line as stored. Legacy rows carry only two of these five; absence is meaningful (see ②). */
export interface StoredLine {
  description?: string | null;
  amount?: number | string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  sku?: string | null;
}

export interface RawReceiptDetailRow {
  id: string;
  business_id: string;
  vendor: string | null;
  date: string | null;
  amount: number | string | null;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
  image_url: string | null;
  line_items: StoredLine[] | null;
  line_items_original: StoredLine[] | null;
  ocr_raw: unknown;
  reconcile_status: string | null;
  reconcile_delta: number | string | null;
  reconcile_overridden_at: string | null;
  accept_vs_edit: string | null;
  amount_original: number | string | null;
  header_amount_edited: boolean | null;
}

/** Absent stays absent. `null` in, `null` out — never 0, never NaN dressed as a figure (D-9). */
function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §2 THE HEADER FIGURES THE TABLE NEVER STORED — subtotal and tax, out of the provider envelope
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Dig the model's own JSON reply out of the provider envelope.
 *
 * ⚠️ THIS FUNCTION EXISTS BECAUSE I GOT IT WRONG ONCE. The first Stage 0 probe searched
 * `JSON.stringify(ocr_raw)` for `"tax"` and reported ZERO of 36 — a confident false negative,
 * because the parsed object is a nested ESCAPED STRING inside `candidates[].content.parts[].text`
 * and the quotes it was matching on are backslashed at that depth. Re-probed properly: 35 of 35.
 * A search that cannot reach the thing it is searching for returns "absent" just as readily as
 * it returns "present" — the same class the platform is already carrying as an open question.
 *
 * Returns null when nothing is recoverable — which is a REAL state (1 of 36 rows, a differently
 * shaped provider envelope) and must never be rendered as zeroes.
 */
export function recoverParsedOcr(ocrRaw: unknown): Record<string, unknown> | null {
  if (!ocrRaw || typeof ocrRaw !== 'object') return null;
  const env = ocrRaw as Record<string, any>;

  const candidates = env.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  const text = parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
  if (!text) return null;

  // The reply is JSON, sometimes fenced. Take the outermost object and refuse the rest.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export interface HeaderFigures {
  /** Formatted subtotal, or null when there is no figure to show. */
  subtotalText: string | null;
  taxText: string | null;
  /** Why a figure is missing — rendered INSTEAD of the figure, never beside a zero. */
  subtotalNote: string | null;
  taxNote: string | null;
}

/**
 * What the reader recorded for subtotal and tax.
 *
 * Three distinct states per figure, and collapsing any two of them is the D-9 defect:
 *   · a number          → show it
 *   · recovered, absent → "the reader did not find one on this document"
 *   · not recoverable   → "not recorded" (the row whose envelope holds no parsed reply)
 */
export function ocrHeaderFigures(row: RawReceiptDetailRow): HeaderFigures {
  const parsed = recoverParsedOcr(row.ocr_raw);
  if (parsed === null) {
    const note = 'Not recorded — this capture stored no readable copy of what the reader parsed.';
    return { subtotalText: null, taxText: null, subtotalNote: note, taxNote: note };
  }
  const sub = toNum(parsed.subtotal as any);
  const tax = toNum(parsed.tax as any);
  return {
    subtotalText: sub === null ? null : fmt.format(sub),
    taxText: tax === null ? null : fmt.format(tax),
    subtotalNote: sub === null ? 'No subtotal was printed on this document.' : null,
    taxNote: tax === null ? 'No tax was printed on this document.' : null,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §3 THE LINES — current beside what the reader made of it
// ════════════════════════════════════════════════════════════════════════════════════════════

export const LINE_FIELDS = ['description', 'quantity', 'unit_price', 'amount', 'sku'] as const;
export type LineField = typeof LINE_FIELDS[number];

/**
 * 🔴 FOUR STATES, AND THE THIRD IS THE ONE THAT STOPS A LIE.
 *
 *   'same'              — current equals what was read.
 *   'changed'           — they differ, and BOTH are shown. This is the whole point of having
 *                         banked `line_items_original` since June.
 *   'never-carried'     — the ORIGINAL has a value and the current line has NO SUCH KEY. On every
 *                         row captured before this build that is true of quantity, unit_price and
 *                         sku on all 141 original lines, because the save path dropped them.
 *                         🔴 Rendering that as 'changed' would tell Lauren she deleted a quantity
 *                         she never touched. The value was thrown away by US, and the honest
 *                         reading is "the saved copy never carried this; here is what was read".
 *   'absent'            — neither side has a value. Nothing to say, and nothing said.
 */
type FieldState = 'same' | 'changed' | 'never-carried' | 'absent';

interface LineFieldModel {
  field: LineField;
  state: FieldState;
  /** The current value as text, or null when there is none to show. */
  currentText: string | null;
  /** What the reader read, as text — shown whenever it differs or was never carried. */
  originalText: string | null;
}

/** Where a line came from. A line WE added must not read as one the owner added. */
type LineOrigin = 'read' | 'platform-tax' | 'added';

export interface LineRowModel {
  index: number;
  origin: LineOrigin;
  originNote: string | null;
  fields: Record<LineField, LineFieldModel>;
}

const isMoney = (f: LineField) => f === 'amount' || f === 'unit_price';

function present(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function text(field: LineField, v: unknown): string | null {
  if (!present(v)) return null;
  if (isMoney(field)) {
    const n = toNum(v as any);
    // An unreadable money value is shown AS STORED rather than coerced — a coercion to 0 here is
    // precisely the mutant that survived #252's first probe run.
    return n === null ? String(v) : fmt.format(n);
  }
  if (field === 'quantity') {
    const n = toNum(v as any);
    return n === null ? String(v) : String(n);
  }
  return String(v);
}

function sameValue(field: LineField, a: unknown, b: unknown): boolean {
  if (isMoney(field) || field === 'quantity') {
    const na = toNum(a as any);
    const nb = toNum(b as any);
    if (na !== null && nb !== null) return Math.abs(na - nb) < 0.005;
    return na === nb;
  }
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * One line, current against original.
 *
 * `original` is `undefined` when the current array is longer than the read — the injected tax
 * line, or a line the owner added. It is NEVER matched by content: index alignment is what the
 * capture path itself used (`countEditedLineItems`), and inventing a fuzzy match here would make
 * this screen disagree with the flag the capture path stored.
 */
export function lineRowModel(
  index: number,
  current: StoredLine | undefined,
  original: StoredLine | undefined,
  parsedTax: number | null,
): LineRowModel {
  const fields = {} as Record<LineField, LineFieldModel>;

  for (const field of LINE_FIELDS) {
    const hasCurrentKey = current !== undefined && field in current;
    const cur = current?.[field];
    const org = original?.[field];
    const curPresent = present(cur);
    const orgPresent = present(org);

    let state: FieldState;
    if (!curPresent && !orgPresent) {
      state = 'absent';
    } else if (!hasCurrentKey && orgPresent) {
      state = 'never-carried';
    } else if (original === undefined) {
      // No original line at all — the row's ORIGIN note explains it once; the field is not
      // "changed" against a read that never happened.
      state = curPresent ? 'same' : 'absent';
    } else if (sameValue(field, cur, org)) {
      state = 'same';
    } else {
      state = 'changed';
    }

    fields[field] = {
      field,
      state,
      currentText: text(field, cur),
      originalText: text(field, org),
    };
  }

  // ── origin ────────────────────────────────────────────────────────────────────────────────
  let origin: LineOrigin = 'read';
  let originNote: string | null = null;
  if (original === undefined) {
    const desc = String(current?.description ?? '');
    const amt = toNum(current?.amount as any);
    const looksLikeTax = /tax/i.test(desc);
    // 🔴 The platform injects this line itself (ReceiptKeeper's confirm path pushes
    // {description:'Tax'} when the OCR found a tax not already among the lines). Measured: it
    // matches the parsed tax on 30 of 30 rows. Saying "the owner added a line" about a line the
    // platform added is the same class of false accusation as the list's old edit sentence.
    if (looksLikeTax && parsedTax !== null && amt !== null && Math.abs(amt - parsedTax) < 0.005) {
      origin = 'platform-tax';
      originNote = 'Added by the platform from the tax the reader found — it was not a line on the document.';
    } else {
      origin = 'added';
      originNote = 'Not among the lines the reader read.';
    }
  }

  return { index, origin, originNote, fields };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §4 THE IMAGE — 8 of 36 captures are PDFs
// ════════════════════════════════════════════════════════════════════════════════════════════

type ImageKind = 'image' | 'pdf' | 'none';

export interface ImagePanel {
  kind: ImageKind;
  /** The storage path, or null. Signing happens at the edge; this module stays pure. */
  path: string | null;
  note: string | null;
}

/**
 * What kind of document is attached.
 *
 * 🔴 MEASURED: 28 jpg and 8 pdf across 36 rows — and the Sudderth invoice, the worked example
 * for this whole surface, is one of the PDFs. An `<img src="… .pdf">` renders NOTHING and reports
 * nothing; the page would simply have a hole in it where the acceptance criterion is.
 */
export function imagePanel(imageUrl: string | null | undefined): ImagePanel {
  if (!imageUrl || imageUrl.trim() === '') {
    return { kind: 'none', path: null, note: 'No document image was stored with this capture.' };
  }
  const ext = imageUrl.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { kind: 'pdf', path: imageUrl, note: null };
  return { kind: 'image', path: imageUrl, note: null };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §5 THE PREVIEW VERDICT — what the server will store if this is saved
// ════════════════════════════════════════════════════════════════════════════════════════════

interface PreviewVerdict {
  readout: { style: CSSProperties; text: string } | null;
  /** True when the arithmetic no longer holds — the save must acknowledge it, not paper over it. */
  isLargeMismatch: boolean;
  /** Set when the sum cannot be asserted at all. A verdict is NOT computed from a blank. */
  incompleteNote: string | null;
}

/**
 * Recompute over the lines being edited.
 *
 * 🔴 A LINE WITH NO AMOUNT MAKES THE SUM UNASSERTABLE, AND THAT IS REPORTED RATHER THAN GUESSED.
 * `computeReconcile` treats an unparseable amount as 0 — correct for its own caller, where the
 * field is a controlled input, and WRONG here, where a blank is a legitimate answer ("she may
 * leave a material or a unit unknown"). Summing a blank as zero would compute a verdict from a
 * guess and stamp `match` on a receipt nobody reconciled. The server refuses the same way.
 */
export function previewVerdict(lines: StoredLine[], totalAmount: number | string | null): PreviewVerdict {
  if (lines.length === 0) {
    return { readout: null, isLargeMismatch: false, incompleteNote: null };
  }
  const anyBlankAmount = lines.some(l => !present(l.amount) || toNum(l.amount as any) === null);
  const total = toNum(totalAmount);

  if (anyBlankAmount || total === null) {
    return {
      readout: null,
      isLargeMismatch: false,
      incompleteNote: anyBlankAmount
        ? 'A line has no amount, so the lines cannot be checked against the total. This will save as unreconciled rather than as a match.'
        : 'This receipt has no saved total, so the lines cannot be checked against one.',
    };
  }

  const rs: ReconcileResult = computeReconcile(
    lines.map((l, i) => ({ id: String(i), description: String(l.description ?? ''), amount: String(toNum(l.amount as any)) })),
    String(total),
  );
  return {
    readout: { style: reconcileReadoutStyle(rs.status), text: reconcileReadoutText(rs) },
    isLargeMismatch: rs.status === 'large_mismatch',
    incompleteNote: null,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §6 THE VENDOR UNIT QUESTION — asked about the VENDOR, once
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔴 `hour` IS NOT OFFERED, AND THE REASON IS NOT SQUEAMISHNESS. The platform's unit taxonomy is
 * a CLOSED set behind the named `business_inventory_unit_kind_check` — container | volume |
 * weight | length | each (20260830_inventory_unit_of_measure.sql). `yard`→volume and `load`→each
 * fit; `ton`→weight fits the axis though the size parser reads only lb/oz; `hour` fits NOTHING,
 * and adding it is an enum change and a separate decision (David, 2026-09-02).
 *
 * "Not sure" is a first-class answer, stored as a row with a NULL value — which is how "asked and
 * she did not know" stays distinguishable from "never asked". A question that only accepts
 * confident answers manufactures confident data.
 */
export const UNIT_ANSWERS = [
  { value: 'yard', label: 'the yard' },
  { value: 'ton', label: 'the ton' },
  { value: 'load', label: 'the load' },
  { value: null, label: "not sure" },
] as const;

interface VendorUnitQuestion {
  /** null when there is no vendor to ask about — the question is not rendered at all. */
  vendorKey: string | null;
  vendorLabel: string | null;
  prompt: string;
  /** The stored answer, or null when it has never been asked. */
  answeredValue: string | null;
  answered: boolean;
  answerNote: string | null;
  /** What to show on a LATER receipt from the same vendor — the whole point of asking once. */
  standingAnswerText: string | null;
}

export interface StoredVendorPreference {
  vendor_key: string;
  vendor_label: string;
  preference_kind: string;
  preference_value: string | null;
  preference_note: string | null;
  answered_at: string | null;
}

/**
 * 🔴 ASKED ABOUT THE VENDOR, NEVER ABOUT THE NUMBER. "Is 20.72 yards or tons?" returns on every
 * invoice forever; "When Sudderth bills you, is it by the yard or the ton?" returns once. The
 * prompt below names the vendor and never names a figure from the document.
 */
export function vendorUnitQuestion(
  vendorLabel: string | null,
  stored: StoredVendorPreference | null,
): VendorUnitQuestion {
  const key = vendorKey(vendorLabel);
  if (key === '') {
    return {
      vendorKey: null, vendorLabel: null,
      prompt: '', answeredValue: null, answered: false,
      answerNote: null, standingAnswerText: null,
    };
  }
  const label = (vendorLabel ?? '').trim();
  const answered = stored !== null;
  const value = stored?.preference_value ?? null;

  const chosen = UNIT_ANSWERS.find(a => a.value === value);
  const standing = !answered
    ? null
    : value === null
      ? `Nobody was sure how ${label} bills. Answer it here and every future ${label} invoice will use it.`
      : `${label} bills by ${chosen?.label ?? value}.`;

  return {
    vendorKey: key,
    vendorLabel: label,
    prompt: `When ${label} bills you, is it by the —`,
    answeredValue: value,
    answered,
    answerNote: stored?.preference_note ?? null,
    standingAnswerText: standing,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §7 THE WHOLE MODEL
// ════════════════════════════════════════════════════════════════════════════════════════════

export interface ReceiptDetailModel {
  id: string;
  businessId: string;
  vendorText: string;
  dateText: string;
  amountText: string;
  /** The saved total as a FIGURE. The editor's arithmetic needs the number, and re-parsing it
   *  back out of `amountText` would be deriving data from its own presentation. */
  amountValue: number | null;
  categoryText: string;
  capturedAtText: string;
  header: HeaderFigures;
  lines: LineRowModel[];
  /** The lines as stored, handed to the editor unchanged. */
  storedLines: StoredLine[];
  /** What the reader read, index-aligned. The editor SEEDS from this for any key the saved copy
   *  never carried — see `editableLines`. */
  originalLines: StoredLine[];
  /** 🔴 THE LINES THE EDIT FORM OPENS ON, AND THEY ARE NOT `storedLines`.
   *
   *  On a pre-2026-09-02 row the saved line has NO `quantity` key while the read had one. If the
   *  form opened on the stored line, the owner could press Correct-a-line, change a description,
   *  save — and the quantity would go from `never-carried` (OUR omission, correctly labelled) to
   *  `changed` against a blank, which says the OWNER DELETED IT. That is the same false accusation
   *  this whole surface exists to remove, arriving through the save path instead of the read path.
   *
   *  So a key the saved copy never carried is SEEDED from what the reader read. A key that is
   *  present and empty is left empty — that is a real answer someone gave (D-9), not an omission. */
  editableLines: StoredLine[];
  image: ImagePanel;
  /** The verdict as BANKED — the one the owner was shown at save time. Never recomputed here. */
  bankedReadout: { style: CSSProperties; text: string } | null;
  bankedNotes: string[];
  /** True when this row predates line_items carrying quantity / unit_price / sku. */
  legacyShape: boolean;
}

const STORED_STATUS_TO_SEVERITY: Record<string, ReconcileResult['status']> = {
  match: 'match',
  small_gap: 'small_gap',
  large_mismatch_overridden: 'large_mismatch',
};

export function receiptDetailModel(row: RawReceiptDetailRow): ReceiptDetailModel {
  const current = Array.isArray(row.line_items) ? row.line_items : [];
  const original = Array.isArray(row.line_items_original) ? row.line_items_original : [];
  const parsed = recoverParsedOcr(row.ocr_raw);
  const parsedTax = parsed ? toNum(parsed.tax as any) : null;

  const count = Math.max(current.length, original.length);
  const lines: LineRowModel[] = [];
  for (let i = 0; i < count; i++) {
    // A line present in the READ and absent from the current array was DELETED by the owner —
    // it still gets a row, because a deletion that leaves no trace on screen is the same silence
    // this surface exists to end.
    lines.push(lineRowModel(i, current[i], original[i], parsedTax));
  }

  // ── the banked verdict, displayed as banked (the list's rule, and it still holds here) ─────
  const bankedNotes: string[] = [];
  const stored = row.reconcile_status;
  const severity = stored ? STORED_STATUS_TO_SEVERITY[stored] : undefined;
  const total = toNum(row.amount);
  const delta = toNum(row.reconcile_delta);
  let bankedReadout: ReceiptDetailModel['bankedReadout'] = null;

  if (!stored) {
    bankedNotes.push('No reconciliation was recorded for this capture.');
  } else if (!severity) {
    bankedNotes.push(`Reconciliation recorded as "${stored}" — a status this screen does not recognise.`);
  } else if (total === null || delta === null) {
    bankedNotes.push(`Reconciliation recorded as "${stored}", but the figures were not stored.`);
  } else {
    bankedReadout = {
      style: reconcileReadoutStyle(severity),
      text: reconcileReadoutText({ status: severity, lineSum: total + delta, total, delta, gapNote: null }),
    };
  }
  if (stored === 'large_mismatch_overridden') {
    bankedNotes.push(
      row.reconcile_overridden_at
        ? `The owner was shown the conflict and saved anyway — ${row.reconcile_overridden_at}.`
        : 'A large mismatch was overridden, but no override timestamp was stored.',
    );
  }

  // 🔴 A legacy row is one whose current lines carry NO quantity key while the read had one. It is
  // named on screen so the missing rates read as OUR omission rather than as the owner's deletion.
  const legacyShape =
    current.length > 0 &&
    current.every(l => !('quantity' in l) && !('unit_price' in l)) &&
    original.some(l => present(l.quantity) || present(l.unit_price));

  // Seed only where the CURRENT line lacks the key entirely. `'quantity' in l` distinguishes
  // "never carried" from "carried and deliberately blank"; `null` is a value someone chose.
  const editableLines: StoredLine[] = current.map((line, i) => {
    const org = original[i];
    if (!org) return line;
    const seeded: StoredLine = { ...line };
    for (const f of ['quantity', 'unit_price', 'sku'] as const) {
      if (!(f in line) && present(org[f])) (seeded as Record<string, unknown>)[f] = org[f];
    }
    return seeded;
  });

  return {
    id: row.id,
    businessId: row.business_id,
    vendorText: row.vendor?.trim() || 'Vendor not recorded',
    dateText: row.date ?? 'No date recorded',
    amountText: total === null ? 'No total recorded' : fmt.format(total),
    amountValue: total,
    categoryText: row.category?.trim() || 'Uncategorised',
    capturedAtText: row.created_at ?? 'unknown',
    header: ocrHeaderFigures(row),
    lines,
    storedLines: current,
    originalLines: original,
    editableLines,
    image: imagePanel(row.image_url),
    bankedReadout,
    bankedNotes,
    legacyShape,
  };
}
