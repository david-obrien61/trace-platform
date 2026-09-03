// ============================================================
// ReceiptsList — the receipts that have been captured, newest DOCUMENT DATE first (G9).
//
// PURPOSE:      /receipts could capture and could not show. Seventeen receipts exist at LAWNS,
//               six of them captured on one afternoon, and NOTHING rendered them — so a capture
//               that silently produced no order looked exactly like one that did. This is the
//               read surface: the receipt, the verdict the platform BANKED at save time (six
//               columns that have been write-only since 2026-06-14), and what the capture became
//               — its order, and that order's delivery.
//
//               🔴 READ-ONLY. This component issues ONE `.select()` and nothing else. It repairs
//               no duplicate, backfills no `receipt_id`, re-stamps no reconcile column, deletes
//               nothing, and adjudicates nothing: a receipt that produced no order says exactly
//               that and stops. Remediating live customer data is David's call and is not a step
//               inside a view build.
//
//               Every DECISION lives in `../../lib/receiptsList` where a probe can reach it; this
//               file renders the model it is handed and holds no logic of its own (tech-debt
//               #134 — a render condition inside a `.tsx` cannot be asserted).
//
// UI STANDARD (§6 r16 — name the standard, then decide): ✅ **THE STANDARD IS TAKEN. This is a
//               `<DataSheet>` — one row per receipt, the chain in a `renderExpand` disclosure.**
//               David's ruling, 2026-09-03. There is no divergence here any more, and the
//               declaration that used to describe one is **MOVED OUT OF `divergences` into a
//               `converged` record** in `docs/decisions/ui-standard-divergences.json`. The cap's
//               own self-pruning check named this file the moment the import landed — *"NOW USES
//               THE SHARED CONTROL … the surface converged. Delete the entry."* — which is that
//               check firing on the GOOD outcome. ✏️ **It is MOVED and not DELETED on purpose:
//               the withdrawn premise and its correction are evidence about how we work, and
//               deleting the entry would erase that along with the divergence.**
//
//               🔴 IT USED TO BE A BESPOKE CARD STACK, AND THE REASON GIVEN WAS FALSE WHEN IT WAS
//               WRITTEN. It read: "each row carries a variable-length chain (0..n orders, each
//               with 0..n deliveries), which a fixed-column grid can only render by truncating
//               the chain or by exploding one receipt into several rows." `<DataSheet>` has
//               carried `renderExpand` — "Optional per-row detail drawer. When present, a
//               trailing expand toggle column appears." (DataSheet.tsx:81-82) — since
//               2026-07-01, commit `e3e6796`. The comment was written 2026-09-01, `ab617b2`:
//               two months later. ✏️ R-26's class — a written declaration nobody checked against
//               reality, steering a decision. The record is kept rather than deleted because a
//               claim that was once believed is evidence about how we work.
//
//               WHAT THE WITHDRAWN REASON GOT RIGHT, AND IT STILL BINDS: **a receipt must appear
//               ONCE.** Two LAWNS receipts are duplicate captures of one invoice (tech-debt #143)
//               and must never read as four rows. `renderExpand` satisfies that — one `<tr>` per
//               receipt, the orders and deliveries in the drawer beneath it.
//
//               WHAT THE MOVE BUYS, and it is the whole reason the shared control exists:
//               **G4 sortable columns · G6 global search + a quick status filter · G7 density in
//               a bounded scroll box**, all inherited from the engine rather than rebuilt here.
//               Those three were `owed` on this surface — recorded, unbuilt — and they arrive
//               with the grid. G1 sticky header · G2 reachable h-scrollbar · G3 frozen
//               identifier column arrive with it too.
//
//               ⚠️ TWO THINGS ARE DELIBERATELY *NOT* DECIDED HERE, BECAUSE THEY ARE
//               SHARED-CONTROL QUESTIONS AND THIS IS A SURFACE (R-74: doc → widget → surfaces):
//               ① the expand toggle is TRAILING and uses a chevron, not a leading plus/minus.
//               The industry-standard disclosure grid puts the toggle in a LEADING column; the
//               engine puts it last. **That is a change to `DataSheet.tsx` for every consumer,
//               and it is owed doc-first — not quietly forked into this file.**
//               ② the engine's count pill reads "N of M <noun>", which at the 100-row cap would
//               say "100 of 100" about a tenant holding 236. `itemNoun` is set so the pill makes
//               no claim about a total, and the honest capped count keeps its own line above the
//               grid (`model.countText`). A pill that can name a server-side cap is likewise a
//               widget change, owed doc-first.
//
// DEPENDENCIES: `../../lib/supabase` (one select, RLS-enforced — `/receipts` already gates on
//               `costs:read` at router.tsx and `receipts` carries dual owner+member RLS on
//               `business_id`, 20260612_receipts.sql:31-63; no new endpoint, no new permission,
//               no migration) · `../../lib/receiptsList` (the model) ·
//               `../../utils/receiptReconciliation` (the severity styles, via the model).
//
// OUTPUTS:      <ReceiptsList businessId refreshToken /> — a <DataSheet> grid with a disclosure
//               row per receipt, a count that names its own cap, and honest loading / empty /
//               failed-read states (§6 R1, BINDING since 2026-09-03).
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DataSheet, type DataSheetColumn } from '../datasheet/DataSheet';
import {
  RECEIPTS_SELECT,
  RECEIPTS_PAGE_LIMIT,
  receiptListModel,
  outcomeSummaryText,
  outcomeFilterValue,
  receiptSearchText,
  OUTCOME_FILTER_OPTIONS,
  type RawReceiptRow,
  type ReceiptListModel,
  type ReceiptRowModel,
  type OutcomeOrder,
  RECEIPT_LINES_SELECT,
  receiptLinesModel,
  linesProvenanceNote,
} from '../../lib/receiptsList';
import type { RawReceiptDetailRow, LineRowModel } from '../../lib/receiptDetail';

const TRACE_RECEIPTS_LIST = true; // [TRACE:receipts-list] STD-003 — ON until David owner-proves

// A read either produced data or FAILED. Keeping the two distinguishable is the whole point of
// the read-honesty ruling (2026-08-23), now §6 R1 of the UI standard and BINDING: a failed read
// that renders as "no receipts" is a confident false statement about the tenant's data. The
// engine keeps them apart too — its empty state is gated on `!loading && !error` — but the
// SENTENCE is ours, because "Error: <postgrest message>" does not tell an owner that the count
// they are looking at is unknown rather than zero.
type ReadState =
  | { phase: 'loading' }
  | { phase: 'failed'; message: string }
  | { phase: 'loaded'; model: ReceiptListModel };

const META: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b' };
const NOTE: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b', marginTop: 4 };
const AMOUNT: React.CSSProperties = { fontWeight: 700, color: '#27500A' };
const VENDOR_LINK: React.CSSProperties = { fontWeight: 700, color: '#27500A', textDecoration: 'none' };
const COUNT: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b', margin: '0 0 8px' };
const SECTION: React.CSSProperties = { marginTop: 10 };
const SECTION_LABEL: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6,
};
const EXPAND: React.CSSProperties = { padding: '12px 16px', background: '#f9fafb' };
const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 999,
  fontSize: '0.6875rem', fontWeight: 700, color, background: bg,
});
const ABSENCE: React.CSSProperties = {
  fontSize: '0.8125rem', color: '#6b7280', background: '#fff',
  border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px',
};

function OrderBlock({ order }: { order: OutcomeOrder }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={badge(order.status.color, order.status.bg)}>{order.status.label}</span>
        <span style={META}>{order.kindText}</span>
        <span style={META}>#{order.docNumberText}</span>
        <span style={META}>{order.totalText}</span>
        <span style={META}>sold {order.saleDateText}</span>
      </div>
      {order.deliveryNote && <div style={{ ...ABSENCE, marginTop: 6 }}>{order.deliveryNote}</div>}
      {order.deliveries.map(d => (
        <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6, paddingLeft: 12, borderLeft: '2px solid #e5e7eb' }}>
          <span style={badge(d.status.color, d.status.bg)}>{d.status.label}</span>
          <span style={META}>{d.dateText}</span>
          <span style={META}>{d.serviceText}</span>
          <span style={META}>{d.sourceText}</span>
        </div>
      ))}
    </div>
  );
}

/** The drawer: what the platform banked at save time, and what the capture became. */
// ── THE LINES, FETCHED WHEN THE DRAWER OPENS ────────────────────────────────────────────────
// 🔴 THIS IS A PER-ROW READ, NOT A LIST READ, AND THE DISTINCTION IS DAVID'S RULING. The list
// query still carries no `line_items` (probe A5), so re-deriving a banked verdict from the list
// remains impossible; this fetches ONE receipt's lines, only when its drawer opens, under the
// SAME projection and the SAME model `/receipts/:id` uses (§6 r8 — no second line model).
//
// `renderExpand` is called only when a row is open (`DataSheet.tsx`: `renderExpand && isOpen`),
// so mounting IS expanding and the effect needs no open-state of its own.
//
// AC-3: scoped on `business_id` as well as `id` — another tenant's receipt is NOT FOUND, never
// shown, exactly as `/receipts/:id` does it.
type LinesState =
  | { phase: 'loading' }
  | { phase: 'failed'; message: string }
  | { phase: 'loaded'; lines: LineRowModel[]; note: string | null };

function ReceiptLines({ receiptId, businessId }: { receiptId: string; businessId: string | null }) {
  const [state, setState] = useState<LinesState>({ phase: 'loading' });

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!businessId) return;
      if (TRACE_RECEIPTS_LIST) console.log('[TRACE:receipts-list] drawer lines read', { receiptId });
      const { data, error } = await supabase
        .from('receipts')
        .select(RECEIPT_LINES_SELECT)
        .eq('id', receiptId)
        .eq('business_id', businessId)
        .maybeSingle();
      if (!live) return;
      if (error || !data) {
        if (TRACE_RECEIPTS_LIST) console.log('[TRACE:receipts-list] drawer lines FAILED', error?.message);
        setState({ phase: 'failed', message: error?.message ?? 'the receipt could not be read' });
        return;
      }
      const lines = receiptLinesModel(data as unknown as RawReceiptDetailRow);
      setState({ phase: 'loaded', lines, note: linesProvenanceNote(lines) });
    })();
    return () => { live = false; };
  }, [receiptId, businessId]);

  if (state.phase === 'loading') return <div style={META}>Reading the lines…</div>;

  // §6 R1: a failed read must not read as an empty one. It says which of the two it is.
  if (state.phase === 'failed') {
    return (
      <div style={ABSENCE}>
        The lines could not be read — {state.message}. This is a failed read, NOT a receipt with no
        lines: how many lines it has is unknown right now.
      </div>
    );
  }

  if (state.lines.length === 0) {
    return <div style={ABSENCE}>No lines were captured for this receipt.</div>;
  }

  return (
    <>
      {/* 🔴 The caveat is COMPUTED, not hardcoded — it disappears the day a capture lands with the
          keys actually stored, instead of becoming furniture nobody reads. */}
      {state.note && <div style={{ ...ABSENCE, marginBottom: 8 }}>{state.note}</div>}
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            {['', 'Description', 'Qty', 'Rate', 'Amount'].map((h, i) => (
              <th key={i} style={{ textAlign: i > 1 ? 'right' : 'left', padding: '3px 8px', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.lines.map(l => (
            <tr key={l.index}>
              <td style={{ padding: '3px 8px', color: '#94a3b8' }}>{l.index + 1}</td>
              <td style={{ padding: '3px 8px' }}>
                <LineCell f={l.fields.description} />
                {l.originNote && <div style={{ ...META, fontStyle: 'italic' }}>{l.originNote}</div>}
              </td>
              <td style={{ padding: '3px 8px', textAlign: 'right' }}><LineCell f={l.fields.quantity} /></td>
              <td style={{ padding: '3px 8px', textAlign: 'right' }}><LineCell f={l.fields.unit_price} /></td>
              <td style={{ padding: '3px 8px', textAlign: 'right' }}><LineCell f={l.fields.amount} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// One cell, four states — the model decides, this only renders (tech-debt #134).
// 🔴 `never-carried` is shown in the UNCONFIRMED style and is NEVER dressed as a saved value:
// the figure is real, our record of it is not.
function LineCell({ f }: { f: LineRowModel['fields'][keyof LineRowModel['fields']] | undefined }) {
  if (!f) return null;
  if (f.state === 'absent') return <span style={META}>—</span>;
  if (f.state === 'never-carried') {
    return <span style={{ color: '#92400e' }} title="From the reader's scan — the saved copy never carried this value">{f.originalText}</span>;
  }
  if (f.state === 'changed') {
    return (
      <span>
        {f.currentText}
        <span style={{ ...META, marginLeft: 4 }} title="What the reader originally read">was {f.originalText}</span>
      </span>
    );
  }
  return <span>{f.currentText}</span>;
}

function ReceiptExpansion({ row, businessId }: { row: ReceiptRowModel; businessId: string | null }) {
  const { verdict, outcome } = row;
  return (
    <div style={EXPAND}>
      <div style={{ marginBottom: 10 }}>
        <div style={SECTION_LABEL}>What was on the document</div>
        <ReceiptLines receiptId={row.id} businessId={businessId} />
      </div>
      <div>
        <div style={SECTION_LABEL}>What the platform banked at save time</div>
        {verdict.readout && <div style={verdict.readout.style}>{verdict.readout.text}</div>}
        {verdict.notes.map((n, i) => <div key={i} style={NOTE}>{n}</div>)}
      </div>
      <div style={SECTION}>
        <div style={SECTION_LABEL}>What it became</div>
        {outcome.multipleOrders && (
          <div style={{ ...ABSENCE, marginBottom: 6 }}>
            This receipt has {outcome.orders.length} orders against it.
          </div>
        )}
        {outcome.note && <div style={ABSENCE}>{outcome.note}</div>}
        {outcome.orders.map(o => <OrderBlock key={o.id} order={o} />)}
      </div>
    </div>
  );
}

// ── THE COLUMN SET, AND WHERE IT CAME FROM ──────────────────────────────────────────────────
// ⚠️ THE DEFAULT-VISIBLE SET IS DAVID'S, RELAYED BY A PEER SESSION, AND I HAVE NOT READ THE
//    PROMPT IT CAME FROM. `trace-platform-e2` quoted its build prompt verbatim: "COLUMNS,
//    default: RECEIPT DATE · VENDOR · INVOICE NUMBER · TOTAL · LINES · CATEGORY · BECAME.
//    Available and off: captured, verdict, receipt id." The ruling I hold ("Grid. /receipts moves
//    to DataSheet with renderExpand … G4, G6 and G7 come with it") says nothing about columns, so
//    the peer's is the more specific instruction and I invented the set it corrects. `captured`
//    and `banked` are now available-and-OFF, and `receipt_id` is added in that state.
//    🔴 **THIS IS AN UNVERIFIED PREMISE AND IT IS FLAGGED RATHER THAN ABSORBED** — acting on a
//    quotation of a document I cannot read is the R-26 shape, which is this build's own subject.
//    It is taken because it is cheap, reversible, and the Columns menu (G5) makes it a click
//    either way. **David: if the relayed column set is not yours, say so and it flips back.**
//
// 🔴 TWO RULED COLUMNS ARE ABSENT, AND NEITHER IS AN OVERSIGHT:
//    · **INVOICE NUMBER** — blocked on `trace-platform-e2`'s migration; it does not exist to read
//      yet. The document number is reachable today only inside the drawer and through search.
//    · **LINES** — a line COUNT needs `line_items` in `RECEIPTS_SELECT`, and this file's own
//      invariant forbids it: *"`line_items` MUST NOT be present — its absence is what makes
//      re-evaluation impossible rather than merely discouraged"* (receiptsList.ts §1). Selecting
//      it would downgrade a STRUCTURAL guard to a review-only one — *we have the inputs and
//      choose not to re-derive* instead of *the inputs are not in hand*. **That is David's call,
//      it is not settled, and it is not being decided inside a column config.**
//
// ⚠️ ONE ORDERING DIFFERENCE IS DELIBERATE AND IS A STANDARD-BEATS-PROMPT CASE (R-74): the
//    relayed set leads with RECEIPT DATE; this grid leads with VENDOR because **G3 pins the
//    leading IDENTIFIER column** ("the leading name/id column pins on horizontal scroll") and a
//    date is not an identifier. Not silently reordered either way — surfaced for David.
//
// ── The columns. `sortVal` is what makes G4 real, and every column that carries an orderable
//    fact declares one. The identifier column is frozen with a RESERVED TRACK (§6 r14). ──
const columns: DataSheetColumn<ReceiptRowModel>[] = [
  {
    key: 'vendor', header: 'Vendor', frozen: true, frozenWidth: 200, hideable: false,
    sortable: true, sortVal: r => r.vendorText.toLowerCase(),
    render: r => <Link to={`/receipts/${r.id}`} style={VENDOR_LINK}>{r.vendorText}</Link>,
  },
  {
    // 🔴 THE COLUMN DAVID READS THIS SCREEN FOR (2026-09-03, ledger #270). `receipts.receipt_number`
    // arrived with 20260903c, applied 2026-09-03 — before it there was no column and the OCR's
    // answer was discarded at save on every capture since June.
    //
    // ⚠️ EVERY ROW CAPTURED BEFORE THE APPLY READS "No number captured", and that is CORRECT, not a
    // gap to fill: nothing was backfilled. The wording is deliberate and is NOT "None" or "—" — we
    // cannot see whether those documents carried a number, only that we never stored one, and a
    // dash would leave the reader to guess which of the two it meant (D-9 / A9, and the same
    // absence-is-a-sentence rule as "No vendor recorded" beside it).
    //
    // Sorted on `invoiceNumberSort` — the RAW value — never on the displayed string, or the
    // placeholder would sort among real numbers starting with N.
    key: 'invoice_number', header: 'Invoice #', sortable: true,
    sortVal: r => r.invoiceNumberSort,
    render: r => (r.invoiceNumberText === 'No number captured'
      ? <span style={META}>{r.invoiceNumberText}</span>
      : <span style={{ fontFamily: 'monospace' }}>{r.invoiceNumberText}</span>),
  },
  {
    // 🔴 G9's column. `sortVal` is the SAME key the model sorts by — the document's date, falling
    // back to the capture DAY when there is none — so re-sorting by this header cannot disagree
    // with the default order the list arrives in.
    key: 'date', header: 'Date', sortable: true, sortVal: r => r.sortKey,
    render: r => r.dateText,
  },
  { key: 'amount', header: 'Amount', sortable: true, sortVal: r => r.amountSort,
    render: r => <span style={AMOUNT}>{r.amountText}</span> },
  { key: 'category', header: 'Category', sortable: true, sortVal: r => r.categoryText.toLowerCase(),
    render: r => r.categoryText },
  {
    key: 'outcome', header: 'What it became', sortable: true,
    sortVal: r => outcomeSummaryText(r.outcome),
    render: r => <span style={META}>{outcomeSummaryText(r.outcome)}</span>,
  },
  {
    key: 'banked', header: 'Banked verdict', sortable: true, defaultVisible: false,
    sortVal: r => r.verdict.readout?.text ?? '',
    render: r => (r.verdict.readout
      ? <span style={r.verdict.readout.style}>{r.verdict.readout.text}</span>
      : <span style={META}>Nothing banked</span>),
  },
  { key: 'captured', header: 'Captured', sortable: true, defaultVisible: false,
    sortVal: r => r.capturedAtText,
    render: r => <span style={META}>{r.capturedAtText}</span> },
  // Available and OFF. A provenance handle an owner reaches for when reconciling against another
  // record, never something they read by default.
  // ⚠️ THE KEY IS `id`, NOT `receipt_id`, AND THAT IS A CORRECTNESS CHOICE RATHER THAN A NAMING
  // ONE. DataSheet locks a column by looking its KEY up in the system-managed registry and
  // rendering that registry's explanation (F2: the popover must say WHAT sets the field and WHY).
  // The registry's `receipt_id` reads "Linked by the receipt/invoice-scan flow; ties the row to
  // its source receipt" — true on /inventory, and FALSE here, where the value is the receipt's
  // OWN id and links to nothing. `id` reads "System row identifier, assigned automatically",
  // which is exactly what this is. A lock that explains itself wrongly is worse than no lock: it
  // is a confident sentence about the wrong field.
  { key: 'id', header: 'Receipt id', sortable: true, defaultVisible: false,
    sortVal: r => r.id, render: r => <span style={META}>{r.id}</span> },
  { key: 'status', header: 'Status', sortable: true, sortVal: r => r.statusText,
    defaultVisible: false, render: r => <span style={META}>{r.statusText}</span> },
];

export function ReceiptsList({ businessId, refreshToken }: { businessId: string | null; refreshToken?: string | null }) {
  const [state, setState] = useState<ReadState>({ phase: 'loading' });

  const load = useCallback(async () => {
    if (!businessId) { setState({ phase: 'loading' }); return; }
    setState({ phase: 'loading' });
    if (TRACE_RECEIPTS_LIST) console.log('[TRACE:receipts-list] read start', { businessId, limit: RECEIPTS_PAGE_LIMIT });

    // ONE read. `count: 'exact'` is what makes "showing N of M" possible — without the total,
    // a capped page can only print N, and an N under a bare label is a claim about a total
    // nobody measured.
    const { data, error, count } = await supabase
      .from('receipts')
      .select(RECEIPTS_SELECT, { count: 'exact' })
      .eq('business_id', businessId)
      // 🔴 G9 — ordered by the DOCUMENT's date, not the capture timestamp (David, 2026-09-03).
      // `created_at` is the tiebreak, not the key. The display order is recomputed by
      // `compareReceiptsForDisplay` in the model where a probe can reach it; this ordering is
      // what decides WHICH rows a capped page contains.
      //
      // ⚠️ `nullsFirst: true` IS DELIBERATE AND IS ABOUT THE CAP, NOT ABOUT THE DISPLAY. A row
      // whose date the OCR failed to read is the row most needing attention; sending undated
      // rows to the bottom would make them the first dropped once the tenant passes 100
      // receipts — rebuilding, at the cap, the invisibility this whole surface was built to
      // fix. The client then places them by capture day.
      //
      // 🔴 AND IT IS NOT HYPOTHETICAL — CORRECTED 2026-09-03 AFTER A PEER SESSION MEASURED IT.
      // This comment first read "not live at 17 rows", which was true of LAWNS and false of the
      // table: `receipts.date` is NULL on **1 of 37 rows** — `H-E-B`, created 2026-06-28, on
      // **Test Dave's tenant, which is the tenant David tests on**. 0 on LAWNS. So the undated
      // path has a live row behind it today, and probes E7c/E7d cover real data rather than a
      // shape nobody occupies. ✏️ *"Not live" was a claim about the tenant I happened to be
      // looking at, stated as a claim about the table* — the same shape as everything else this
      // build is about.
      .order('date', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(RECEIPTS_PAGE_LIMIT);

    if (error) {
      if (TRACE_RECEIPTS_LIST) console.log('[TRACE:receipts-list] read FAILED', error.message);
      setState({ phase: 'failed', message: error.message });
      return;
    }

    const rows = (data ?? []) as unknown as RawReceiptRow[];
    const model = receiptListModel(rows, count ?? null);
    if (TRACE_RECEIPTS_LIST) {
      const orders = rows.reduce((n, r) => n + (r.orders?.length ?? 0), 0);
      const deliveries = rows.reduce((n, r) => n + (r.orders ?? []).reduce((m, o) => m + (o.deliveries?.length ?? 0), 0), 0);
      console.log('[TRACE:receipts-list] read ok', {
        rows: rows.length, total: count ?? 'not counted', capped: model.capped,
        withOrder: rows.filter(r => (r.orders?.length ?? 0) > 0).length,
        withoutOrder: rows.filter(r => (r.orders?.length ?? 0) === 0).length,
        orders, deliveries, grid: 'DataSheet',
      });
    }
    setState({ phase: 'loaded', model });
  }, [businessId]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const loaded = state.phase === 'loaded' ? state.model : null;

  return (
    <>
      {/* The honest count keeps its OWN line. The engine's pill counts the rows it was handed
          ("N of M"), which at the cap would assert a total the read never measured. This line is
          the one that names the cap. */}
      {loaded && <p style={COUNT}>{loaded.countText}</p>}

      <DataSheet<ReceiptRowModel>
        title="Receipts captured"
        rows={loaded?.rows ?? []}
        loading={state.phase === 'loading'}
        // 🔴 §6 R1 (BINDING): a failed read must not read as an empty one. The engine renders
        // this string instead of the empty state, and the string says which of the two it is.
        error={state.phase === 'failed'
          ? `could not read receipts — ${state.message}. This is a failed read, NOT an empty list: how many receipts exist is unknown right now.`
          : null}
        getRowId={r => r.id}
        columns={columns}
        searchText={receiptSearchText}
        searchPlaceholder="Search vendor, amount, order number…"
        statusFilter={{
          label: 'outcomes',
          options: [...OUTCOME_FILTER_OPTIONS],
          get: r => outcomeFilterValue(r.outcome),
        }}
        defaultSortKey="date"
        defaultSortDir="desc"
        renderExpand={r => <ReceiptExpansion row={r} businessId={businessId} />}
        itemNoun="on this page"
        emptyIcon={<Receipt size={32} color="#d1d5db" style={{ marginBottom: 8 }} />}
        emptyText="No receipts captured yet."
      />
    </>
  );
}
