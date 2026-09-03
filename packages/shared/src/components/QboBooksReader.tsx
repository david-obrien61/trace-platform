// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the operator-facing half of the QuickBooks reads. Three buttons — ITEMS, CUSTOMERS
//   and INVOICE HISTORY — each: GET the COMPLETE list → SAVE THE VERBATIM BODIES TO A FILE →
//   then render a summary. Read-only against Intuit; stores nothing on our side.
// DEPENDENCIES: `/api/qbo/items`, `/api/qbo/customers`, `/api/qbo/invoices` (api/qbo/router.ts —
//   ONE Vercel function, three routes) · authHeaders() · the pure helpers in
//   ../quickbooks/qboRead, ../quickbooks/itemList, ../quickbooks/customerList, ../quickbooks/invoiceList.
// OUTPUTS: <QboBooksReader businessId /> — mounted in the Accounting card once connected.
//
// 🔴 WHY THE ITEM READ EXISTS. The invoice push carries TWELVE hardcoded
//   `ItemRef: { value: '1', name: 'Services' }` literals. Nothing has pushed to the live
//   company yet; the next completed checkout is the first real push, and it would land every
//   line — the trees included — as generic "Services", collapsing the Sales-of-Nursery-Stock
//   vs Services split the cost model rests on. This screen reads the REAL ids so the next pass
//   can map to them instead of assuming. It changes none of the twelve.
//
// 🔴 WHY IT NOW PAGINATES, AND WHY COMPLETENESS IS RED. The first version asked for one page.
//   Intuit's silent default returned exactly 100 rows carrying ids past 1127 — a TRUNCATED
//   list that looked like a whole one, caught only because a human read the ids. The endpoint
//   now counts first and refuses a shortfall, and this screen shows EXPECTED vs RETRIEVED on
//   every successful read: the number is on screen even when it agrees, because a completeness
//   claim nobody can see is a completeness claim nobody checks.
//
// 🔴 THE FILE IS NOT A CONVENIENCE, IT IS THE POINT — AND IT SAVES ITSELF. Every response is
//   written to disk the moment it arrives, BEFORE anything is rendered, success or failure.
//   Two reasons, and the second is the load-bearing one: (1) re-reading a customer's books
//   must never require re-querying a customer's books; (2) the download lands in the browser's
//   own folder, which is OUTSIDE this repository — so a copy of live accounting data can never
//   be swept into a commit. That is the same class of hazard as the service_role JWT that sat
//   in a settings file: the fix is not to redact it, it is to keep it somewhere git cannot see.
//   ⚠️ A summary on screen is ON TOP OF the file, never instead of it. (R-23.)
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THE THREE READS ARE NOT THE SAME KIND OF THING AND THIS SCREEN TREATS THEM DIFFERENTLY.
//   · ITEMS — a product catalogue, shown IN FULL, because finding one id in it is the job.
//   · CUSTOMERS — roughly 1,900 REAL PEOPLE with addresses, phones and email, belonging to a
//     customer's customers. NEVER rendered in full: count, field coverage, duplicate sizing and
//     FIVE example rows. The endpoint does not even send the parsed records.
//   · INVOICES — what those people bought and what they paid. NOT ONE RECORD IS RENDERED, and
//     there is no preview either: only the date range, the seasonality curve, what sold in what
//     quantity, and what the discounts were computed on. The complete data exists in the
//     downloaded file and nowhere else.
//
// 🔴 WHY THE INVOICE READ IS THE ONE THAT MATTERED. An item row says a thing exists and a
//   customer row says a person exists; neither says what was SOLD. An invoice carries the items,
//   the quantities, the prices and the buyer on ONE record — so it is the only place in these
//   books that can answer *"how many trees did we plant last year"*, which Terry has never been
//   able to ask his own system. THE DATE RANGE IS REPORTED FIRST, ABOVE EVERY OTHER NUMBER,
//   because every figure below it is meaningless without the span it covers.
// ══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { authHeaders } from '../auth/authHeaders';
import { rawCaptureFileName, QBO_ROUTE, QBO_ENTITIES, type QboEntity } from '../quickbooks/qboRead';
import type { QboItemRow, ItemBreakdown } from '../quickbooks/itemList';
import type { QboCustomerRow, CustomerBreakdown } from '../quickbooks/customerList';
import { BUNDLE_ITEM_NAMES, parseInvoiceList, invoiceRowsForDisplay, type InvoiceBreakdown, type QboInvoiceRow } from '../quickbooks/invoiceList';
import { parseShipmentList } from '../quickbooks/shipmentIngest';
import { evaluateBooks, type BooksInput, type Finding } from '../quickbooks/booksFindings';
import { BooksReview } from './BooksReview';
import { readCaptureFile, REPLAY_SOURCE } from '../quickbooks/captureReplay';
import { projectCapture } from '../quickbooks/captureProjection';
import { buildBooksReport, renderBooksReportHtml, type WalkState } from '../quickbooks/booksReport';

// The bundle items are NAMED BY THE MODULE THAT COUNTS THEM. A second list typed into this
// screen is a second representation of one fact (STD-011), and it is the copy that drifts — a
// heading naming three items above a table counting two.
const BUNDLE_LABEL = BUNDLE_ITEM_NAMES.join(' / ');

/** The owner's word for each entity. Never `Item`/`Customer`/`Invoice` on a screen she reads. */
const ENTITY_NOUN: Record<QboEntity, string> = {
  Item: 'products & services', Customer: 'customers', Invoice: 'invoices',
};

/**
 * How many invoice rows the screen shows. It is a DISPLAY cap, never a read cap — the walk is
 * always complete and the count beside the table says so, per R-24: a list that cannot prove it
 * is the whole list is a failure, and a list that IS capped must say what it is capped to.
 */
export const INVOICE_ROWS_SHOWN = 100;

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

/**
 * One line of the read narration. `kind` drives the colour and nothing else — the TEXT carries
 * the meaning, so a screenshot with no colour still reads correctly.
 */
interface NarrationLine {
  kind: 'notice' | 'working' | 'done' | 'failed';
  text: string;
}

interface ReadResponse {
  ok?: boolean;
  entity?: QboEntity;
  realm_id?: string;
  queried_at?: string;
  expected_total?: number | null;
  retrieved_total?: number;
  complete?: boolean;
  pages_fetched?: number;
  items?: QboItemRow[];
  breakdown?: ItemBreakdown | CustomerBreakdown | InvoiceBreakdown;
  preview?: QboCustomerRow[];
  headline?: string;
  points_at?: string;
  error?: string;
  detail?: string;
  code?: string;
  /** Set only on a TOO_MANY refusal — the size we will pull in one go. */
  ceiling?: number;
  /** The verbatim page bodies. Written to the file; never rendered. */
  capture?: unknown;
  /**
   * 🔴 PRESENT ONLY ON A READ THAT CAME BACK FROM A FILE. The live endpoint never sets it, so
   * `source === REPLAY_SOURCE` is a POSITIVE test for "this is a saved read" rather than an
   * absence a screen has to remember to check. It is on the response type rather than held
   * beside it because every consumer of a read must be able to tell the two apart — a file
   * presented as a live pull is the one way this harness could mislead the person using it.
   */
  source?: typeof REPLAY_SOURCE;
}

/**
 * Write `text` to a file in the viewer's own download folder. Returns the file name so the
 * screen can NAME what it saved — an unnamed save is indistinguishable from no save.
 *
 * Deliberately a plain object-URL download rather than anything server-side: this data must
 * not touch our storage, and a browser download is the one path that puts it on the operator's
 * disk without it passing through a table, a bucket, or a log line.
 */
function saveRawToFile(text: string, fileName: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick — revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

const cell: React.CSSProperties = { padding: '9px 11px', color: DARK };
const head: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#f9fafb', textAlign: 'left', padding: '9px 11px',
  fontWeight: 700, color: DARK, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb',
};

function Stat({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <div style={{ padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, minWidth: 120 }}>
      <div style={{ fontSize: '1.125rem', fontWeight: 800, color: DARK }}>
        {value.toLocaleString()}
        {of !== undefined && of > 0 && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: GRAY }}> · {Math.round((value / of) * 100)}%</span>
        )}
      </div>
      <div style={{ fontSize: '0.75rem', color: GRAY }}>{label}</div>
    </div>
  );
}

interface ReadState {
  entity: QboEntity;
  body: ReadResponse;
  savedAs: string | null;
  saveFailed: boolean;
  error: string | null;
  note: string | null;
}

export function QboBooksReader({ businessId }: { businessId: string | null | undefined }) {
  const [loading, setLoading] = useState<QboEntity | null>(null);
  const [state, setState] = useState<ReadState | null>(null);
  // ══════════════════════════════════════════════════════════════════════════════
  // 🔴 THE REVIEW SPANS THREE WALKS, SO THE READS MUST ACCUMULATE (R-24).
  // ══════════════════════════════════════════════════════════════════════════════
  // `state` above holds the ONE read currently on screen and is replaced on every button
  // press — which is right for the panels below, and useless for a review whose price card is
  // on the Item walk, whose duplicate customers are on the Customer walk and whose money is on
  // the Invoice walk. This map keeps the last COMPLETE read of each entity, so the findings
  // panel improves as the walks are done and, crucially, can say WHICH walk is still missing
  // rather than reporting a clean result over books it has only half read.
  //
  // ⚠️ IT KEEPS ONLY `ok` READS. A refusal — an INCOMPLETE walk, a 401, a partial page — is
  // deliberately NOT accumulated: the entire reason this endpoint counts first and refuses a
  // shortfall is that a partial list must never be presented as a list, and feeding one to the
  // findings would launder exactly that (R-24 clause a).
  const [reads, setReads] = useState<Partial<Record<QboEntity, ReadResponse>>>({});
  /** What the last file load did. A refusal is shown here and nothing is loaded. */
  const [fileNote, setFileNote] = useState<{ ok: boolean; text: string } | null>(null);
  /** The narration trail for the one-button read. Append-only within a run; see `readAll`. */
  const [narration, setNarration] = useState<NarrationLine[]>([]);

  async function read(entity: QboEntity): Promise<ReadResponse | null> {
    if (!businessId || loading) return null;
    setLoading(entity);
    setState(null);
    // 🔴 THE ROUTE COMES FROM THE SHARED MAP, NOT A TERNARY. This line used to read
    // `entity === 'Customer' ? 'customers' : 'items'`, under which the invoice read would have
    // fetched the ITEM endpoint and painted an item list under an invoice heading — a screen
    // confidently answering a question nobody asked. Same defect as the capture file name had,
    // in a second copy of the same fact.
    const route = QBO_ROUTE[entity];
    try {
      const res = await fetch(`/api/qbo/${route}?business_id=${encodeURIComponent(businessId)}`, {
        headers: await authHeaders(),
      });
      const body = (await res.json()) as ReadResponse;

      // ── THE FILE FIRST, ALWAYS, BEFORE ANY RENDERING DECISION ──────────────
      // Including on failure: Intuit's verbatim Fault body is exactly what distinguishes a 401
      // (the token-refresh path) from a 403 (the granted scope), and losing it means running
      // the query against the customer's books a second time to find out. It also holds every
      // page retrieved before a mid-walk failure, which is the part that is expensive to redo.
      let savedAs: string | null = null;
      let saveFailed = false;
      if (body.capture !== undefined && body.capture !== null) {
        const name = rawCaptureFileName(entity, body.realm_id ?? 'unknown-realm', new Date());
        if (saveRawToFile(JSON.stringify(body.capture, null, 2), name)) savedAs = name; else saveFailed = true;
      }

      const failed = !res.ok || body.ok === false;
      // Accumulate ONLY a complete, successful read — see the note at `reads`.
      if (!failed && body.ok) setReads(prev => ({ ...prev, [entity]: body }));
      setState({
        entity, body, savedAs, saveFailed,
        // Every refusal names ITSELF. A generic "the read failed" would send someone hunting
        // the wrong problem, which is the whole reason the server classifies 401 vs 403 and
        // separates INCOMPLETE from UNREADABLE_PAGE.
        error: failed ? (body.headline || body.detail || body.error || `The read failed (HTTP ${res.status}).`) : null,
        note: body.points_at ? `Points at: ${body.points_at}` : null,
      });
      return failed ? null : body;
    } catch (e: any) {
      setState({ entity, body: {}, savedAs: null, saveFailed: false,
        error: `The read could not complete: ${String(e?.message ?? e)}`, note: null });
      return null;
    } finally {
      setLoading(null);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 🔴 ONE BUTTON, AND A NARRATION THAT ONLY EVER REPORTS WHAT HAPPENED (§7 W1–W5).
  // ══════════════════════════════════════════════════════════════════════════════
  // The owner presses ONE thing and waits through three reads. Everything about how that wait
  // is described is now a filed standard rather than this component's opinion —
  // `ui-control-standards.md` §7, minted BEFORE this code was written (R-74's order: the doc
  // moves, then the widget, then the surface).
  //
  // W1 — THE RANGE GOES UP BEFORE THE FIRST REQUEST, not after the first walk returns. The
  //   silent gap at the FRONT is the part that reads as broken, so covering only the middle
  //   would be covering the wrong half. "A few minutes" and not "twenty seconds", because a
  //   range that is beaten is honest and a number that is missed is not — and three walks over
  //   a connection we do not control is not ours to promise to the second.
  //
  // W4 — 🔴 THE GRANULARITY IS PER WALK, DELIBERATELY, AND THIS IS THE CLAUSE THAT COST
  //   SOMETHING. "reading customers, 1,000 of 1,927" cannot be emitted: `readAllPages` counts,
  //   pages and returns INSIDE ONE REQUEST, so the browser learns nothing until the walk lands.
  //   The only way to obtain a running count is to drive the paging from here — which moves the
  //   completeness refusal into the browser, and that refusal existing on the SERVER is exactly
  //   what R-24 clause (a) is. A progress number is not worth relocating a refusal, so the
  //   coarser honest form ships and no finer one is simulated.
  //
  // W5 — a refused walk STOPS the sequence and the line says which walk stopped it. Carrying on
  //   would leave a later success painted over an earlier failure, and a narration that simply
  //   goes quiet is indistinguishable from one still working.
  async function readAll() {
    if (!businessId || loading) return;
    // W1: BEFORE the first fetch. Not after, not concurrently — before.
    setNarration([{ kind: 'notice', text: 'This will take a few minutes. Reading your QuickBooks company now — nothing is being changed there, and nothing is saved here.' }]);
    for (const entity of QBO_ENTITIES) {
      setNarration(prev => [...prev, { kind: 'working', text: `Reading your ${ENTITY_NOUN[entity]}…` }]);
      const body = await read(entity);
      if (!body) {
        // W5. The sequence halts and names the walk; the panel below carries the real reason.
        setNarration(prev => [...prev.slice(0, -1), {
          kind: 'failed',
          text: `Stopped while reading your ${ENTITY_NOUN[entity]}. The reads after this one were not attempted, so nothing below describes them.`,
        }]);
        return;
      }
      // W3: the real count, and the walk states that it is WHOLE. The endpoint has already
      // REFUSED anything short of its own pre-counted total (R-24), so this is surfacing a
      // proof rather than making a claim — and it is on screen even when it agrees, because a
      // completeness claim nobody can see is a completeness claim nobody checks.
      setNarration(prev => [...prev.slice(0, -1), {
        kind: 'done',
        text: `Read ${(body.retrieved_total ?? 0).toLocaleString()} ${ENTITY_NOUN[entity]} — that is all of them.`,
      }]);
    }
    setNarration(prev => [...prev, { kind: 'notice', text: 'All three reads finished. Everything below came from your own books.' }]);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 🔴 THE FILE DOOR. A SAVED READ GOES THROUGH THE SAME SCREENS AS A LIVE ONE.
  // ══════════════════════════════════════════════════════════════════════════════
  // David cannot be the first person to run this against LAWNS — if he runs it, there is
  // nothing left for Lauren to show him, and SHE running it is the actual test. So he previews
  // on a different company loading LAWNS's own saved file: same data, different destination.
  //
  // It writes into the SAME `reads` accumulator and the SAME `state` the live path writes, so
  // the display, the findings, the corrections and the report below cannot tell the difference
  // — which is the whole point. A parallel "file mode" rendering path would be a preview of
  // something other than what Lauren gets.
  //
  // ⚠️ THE GATE IS `readCaptureFile`, AND IT IS STRICTER THAN THE LIVE PATH, NOT LOOSER. The
  // live read counts its own pages; a file came off a disk and every number in it is re-derived
  // from the pages underneath it before a single row is shown.
  async function loadFile(f: File | null | undefined) {
    if (!f || loading) return;
    setFileNote(null);
    let text: string;
    try {
      text = await f.text();
    } catch (e: any) {
      setFileNote({ ok: false, text: `That file could not be read from this device (${String(e?.message ?? e)}).` });
      return;
    }

    const replayed = readCaptureFile(text);
    if (!replayed.ok) {
      // The refusal is shown VERBATIM and nothing is loaded. A file that half-loads behind a
      // warning is the defect the counting-first design exists to prevent, arriving by post.
      console.log('[TRACE:QBO] capture file REFUSED', { file: f.name, code: replayed.code });
      setFileNote({ ok: false, text: replayed.headline });
      return;
    }

    const projected = projectCapture(replayed);
    console.log('[TRACE:QBO] capture file loaded', {
      file: f.name, entity: projected.entity, realm_id: projected.realm_id,
      expected: projected.expected_total, retrieved: projected.retrieved_total,
      row_pages: projected.pages_fetched, source: projected.source,
    });
    setReads(prev => ({ ...prev, [projected.entity]: projected as ReadResponse }));
    setState({
      entity: projected.entity, body: projected as ReadResponse,
      savedAs: null, saveFailed: false, error: null,
      note: `Loaded from ${f.name} — a saved read, not a live pull.`,
    });
    setFileNote({
      ok: true,
      text: `Loaded ${projected.retrieved_total.toLocaleString()} ${ENTITY_NOUN[projected.entity]} from ${f.name}. QuickBooks was not contacted.`,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // 🔴 VISUALIZE — THE REPORT IS A PAGE, NOT A FILE, AND THAT IS A FEATURE.
  // ══════════════════════════════════════════════════════════════════════════════
  // A print stylesheet plus `window.print()` (the `qr/print.ts` precedent) rather than a PDF
  // dependency. Which means it can be REGENERATED after they fix something — and the second run
  // showing fewer findings is the best demonstration this product has, so the button stays
  // available afterwards rather than being consumed by pressing it.
  //
  // ⚠️ THE DOCUMENT ASKS FOR NOTHING. No Accept, no Ingest, no script. The screen is where the
  // decision gets made; this is what they keep and show an accountant.
  //
  // ⚠️ CORRECTIONS ARE PASSED AS AN EMPTY LIST BECAUSE NOTHING RECORDS THEM YET. The report
  // then STATES that it reflects no corrections, which is true and is the honest rendering —
  // the alternative, omitting the line, would read as "none were needed".
  function visualize() {
    const walks: WalkState[] = QBO_ENTITIES.map(e => {
      const r = reads[e];
      return {
        entity: e,
        read: r !== undefined,
        expected: r?.expected_total ?? null,
        retrieved: r?.retrieved_total ?? 0,
        complete: r?.complete === true,
        fromFile: r?.source === REPLAY_SOURCE,
      };
    });
    const html = renderBooksReportHtml(buildBooksReport({
      generatedAt: new Date(), walks, findings, corrections: [],
    }));
    console.log('[TRACE:QBO] visualize — report generated', {
      walks_read: walks.filter(w => w.read).length,
      measured: findings.filter(f => f.measured).length, total_rules: findings.length,
    });
    const w = window.open('', '_blank');
    if (!w) {
      // A blocked pop-up is SILENT otherwise, and the owner would conclude the button is broken.
      setFileNote({ ok: false, text: 'Your browser blocked the report window. Allow pop-ups for this site and press Visualize again.' });
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  const btn: React.CSSProperties = {
    flex: 1, minHeight: 48, padding: '13px 16px',
    background: loading || !businessId ? '#e5e7eb' : GREEN,
    color: loading || !businessId ? GRAY : '#fff',
    fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
    cursor: loading || !businessId ? 'default' : 'pointer',
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // 🔴 THE INVOICES ARE PARSED HERE, IN THE BROWSER, FROM THE CAPTURE THE BROWSER ALREADY HAS.
  // ══════════════════════════════════════════════════════════════════════════════
  // The invoice endpoint deliberately never sends parsed invoice records — it sends a breakdown
  // and the verbatim bodies, because an invoice names the human who bought and what they paid.
  // That constraint is not weakened here: `parseInvoiceList` produces `QboInvoiceRow`, which
  // carries a `customerId` and NO customer name, address, email or line description at all —
  // the field is absent from the type, so no finding can name a person even if a future rule
  // tried. The bodies are already in this component (it writes them to the operator's file);
  // parsing them costs no second call to a customer's books and mints no api/ function.
  //
  // ⚠️ THE SHIPMENT PARSE IS USED FOR ONE FIELD AND THE ROWS ARE DISCARDED IMMEDIATELY.
  // `QboShipmentRow` DOES carry names and addresses — it is the delivery ingest's shape — so
  // only `id → shipDate` survives this expression. Nothing else is held and nothing is rendered.
  const parsed = (() => {
    const inv = reads.Invoice;
    if (!inv?.capture) return { invoices: undefined as QboInvoiceRow[] | undefined, shipDates: undefined as Map<string, string | null> | undefined };
    const pages = (inv.capture as { pages?: { body?: string }[] }).pages ?? [];
    const bodies = pages.map(p => p.body ?? '').filter(Boolean);
    return {
      invoices: bodies.flatMap(raw => parseInvoiceList(raw).invoices),
      shipDates: new Map(bodies.flatMap(raw => parseShipmentList(raw).shipments).map(sh => [sh.id, sh.shipDate])),
    };
  })();

  const findings: Finding[] = (() => {
    const input: BooksInput = {
      items:     reads.Item?.items,
      customers: reads.Customer?.breakdown as CustomerBreakdown | undefined,
      invoices:  parsed.invoices,
      discounts: (reads.Invoice?.breakdown as InvoiceBreakdown | undefined)?.discounts,
      shipDates: parsed.shipDates,
      // 🔴 THE DATE THE BOOKS WERE READ, NOT TODAY. The receivables rule measures "past due"
      // against the moment of the read, so a capture re-opened next month still describes the
      // day it was taken rather than silently ageing every invoice in it.
      asOf: (reads.Invoice?.queried_at ?? '').slice(0, 10) || undefined,
    };
    return evaluateBooks(input);
  })();

  const b = state?.body;
  const itemBreak = state?.entity === 'Item' ? (b?.breakdown as ItemBreakdown | undefined) : undefined;
  const custBreak = state?.entity === 'Customer' ? (b?.breakdown as CustomerBreakdown | undefined) : undefined;
  const invBreak  = state?.entity === 'Invoice' ? (b?.breakdown as InvoiceBreakdown | undefined) : undefined;
  const peakMonth = invBreak ? Math.max(1, ...invBreak.byMonth.map(m => m.invoices)) : 1;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
      <p style={{ fontSize: '0.875rem', color: DARK, fontWeight: 700, margin: '0 0 4px' }}>
        Read from QuickBooks
      </p>
      <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 12px', lineHeight: 1.5 }}>
        Reads the complete list of products &amp; services, of customers, or of past invoices from
        your QuickBooks company. Nothing is changed in QuickBooks and nothing is saved here — the
        full response downloads to this device.
      </p>

      {/* 🔴 THE ONE BUTTON. Everything else on this row is the operator's own path and is
          demoted below it — Lauren presses this and waits. */}
      <button
        onClick={() => void readAll()}
        disabled={!!loading || !businessId}
        style={{ ...btn, width: '100%', flex: 'none', minHeight: 56, fontSize: '1rem', marginBottom: 12 }}
      >
        {loading ? 'Reading your QuickBooks data…' : 'Read my QuickBooks data'}
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          THE NARRATION (§7 W1–W5). Real counts only; no bar, no countdown (W2).
          ══════════════════════════════════════════════════════════════════════ */}
      {narration.length > 0 && (
        <div style={{ margin: '0 0 14px', padding: '12px 14px', background: '#f9fafb',
                      border: '1px solid #e5e7eb', borderRadius: 10 }}>
          {narration.map((n, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '6px 0 0', fontSize: '0.8125rem', lineHeight: 1.5,
              color: n.kind === 'failed' ? RED : n.kind === 'done' ? GREEN : n.kind === 'working' ? DARK : GRAY,
              fontWeight: n.kind === 'done' || n.kind === 'failed' ? 700 : 400,
            }}>
              {n.kind === 'done' ? '✓ ' : n.kind === 'working' ? '· ' : ''}{n.text}
            </p>
          ))}
        </div>
      )}

      <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 6px' }}>
        Or read one list at a time:
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => void read('Item')} disabled={!!loading || !businessId} style={btn}>
          {loading === 'Item' ? 'Reading items…' : 'Read item list'}
        </button>
        <button onClick={() => void read('Customer')} disabled={!!loading || !businessId} style={btn}>
          {loading === 'Customer' ? 'Reading customers…' : 'Read customer list'}
        </button>
        <button onClick={() => void read('Invoice')} disabled={!!loading || !businessId} style={btn}>
          {loading === 'Invoice' ? 'Reading invoice history…' : 'Read invoice history'}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          🔴 THE FILE DOOR — DELIBERATELY UGLY, AND THAT IS A FEATURE.
          ══════════════════════════════════════════════════════════════════════
          It is dashed, amber, and says what it is for in the first four words. A file loader
          that looked like the rest of the page would become how people import things — someone
          would mail a colleague a JSON file instead of connecting their books, and we would
          find out months later. It sits BELOW the live buttons so the ordinary path is the
          first thing reached, and it names its one legitimate use rather than describing a
          capability. */}
      <div style={{
        marginTop: 14, padding: '12px 14px', borderRadius: 10,
        border: `1px dashed ${AMBER}`, background: '#fffbeb',
      }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: AMBER, margin: '0 0 4px' }}>
          TEST FACILITY — load a saved read instead of connecting
        </p>
        <p style={{ fontSize: '0.8125rem', color: DARK, margin: '0 0 10px', lineHeight: 1.5 }}>
          This is for rehearsing the review on books that have already been read once. It opens a
          file this screen saved earlier and runs it through exactly the same steps as a live
          read — the same counts, the same checks, the same findings. <strong>QuickBooks is not
          contacted and nothing is imported.</strong> It is not a way to bring data in.
        </p>
        <input
          type="file" accept="application/json,.json" disabled={!!loading}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void loadFile(f); }}
          style={{ fontSize: '0.8125rem', color: DARK, minHeight: 44 }}
        />
        {fileNote && (
          <p style={{
            fontSize: '0.8125rem', margin: '8px 0 0', lineHeight: 1.5,
            color: fileNote.ok ? GREEN : RED, fontWeight: fileNote.ok ? 600 : 700,
          }}>
            {fileNote.ok ? '✓ ' : '✗ '}{fileNote.text}
          </p>
        )}
      </div>

      {/* 🔴 A READ THAT CAME FROM A FILE SAYS SO WHEREVER IT IS SHOWN. The panels below are
          shape-identical to the live ones by design, so without this line a saved read and a
          live pull are indistinguishable on screen — and someone would eventually read a
          rehearsal as their real books. */}
      {state?.body?.source === REPLAY_SOURCE && (
        <p style={{
          fontSize: '0.8125rem', fontWeight: 700, color: AMBER, margin: '10px 0 0',
          padding: '7px 10px', background: '#fffbeb', border: `1px solid ${AMBER}`, borderRadius: 8,
        }}>
          Showing a SAVED read loaded from a file — not a live pull from QuickBooks.
        </p>
      )}

      {/* 🔴 VISUALIZE IS OFFERED ONLY ONCE A READ EXISTS. A report over nothing would be a
          document full of "not read", which is honest and useless — and it would teach her
          that the button does not work. */}
      {Object.keys(reads).length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button onClick={visualize} style={{ ...btn, background: DARK, color: '#fff', flex: 'none', width: '100%' }}>
            Visualize — open the first-look report
          </button>
          <p style={{ fontSize: '0.75rem', color: GRAY, margin: '6px 0 0', lineHeight: 1.5 }}>
            Opens a printable report of everything read so far. Use your browser&apos;s Print
            dialog to save it as a PDF. It asks for nothing and changes nothing — and you can
            open it again at any time, including after importing.
          </p>
        </div>
      )}

      {/* 🔴 THE REVIEW SITS BETWEEN THE READS AND THE IMPORT PANELS BELOW, AND BESIDE THEM
          RATHER THAN IN FRONT OF THEM. It has no acknowledge-to-continue and nothing on it can
          disable an ingest button: a finding that could stop Lauren is a finding that makes her
          phone David, and then the build has failed however good the finding was. */}
      {/* ══════════════════════════════════════════════════════════════════════════════
          🔴 HER OWN INVOICES — NUMBER, DATE AND TOTAL. NO BUYER NAME. (David, OPTION B.)
          ══════════════════════════════════════════════════════════════════════════════
          The build prompt asked for her customers' NAMES here and called their absence "the
          gap you measured". It is not a gap, it is R-24 clause (b) — *"a read of personal data
          is summarised, never listed"* — and the sentence the prompt quoted as evidence was the
          comment implementing it. David ruled OPTION B: recognition comes from her ITEM NAMES
          and her INVOICE NUMBERS, and neither of those is personal data, so R-24 stays where it
          was ruled rather than being stretched to a case it did not consider.

          🔴 THE ABSENCE IS STATED, NOT LEFT TO BE INFERRED. David: *"say on the screen what is
          NOT shown and why — an absence a reader has to interpret is the defect, not the fix."*

          ⚠️ IT CANNOT SHOW A NAME EVEN IF SOMEONE LATER TRIED. `QboInvoiceRow` has no customer
          name field at all (`invoiceList.ts` reads `CustomerRef.value` and never `.name`), so
          the constraint is structural and does not depend on this JSX staying careful.

          🔴 IT IS NOT `<DataSheet>`, AND THE REASON PREVIOUSLY WRITTEN HERE WAS FALSE. This said
          the plain table was "a deliberate limit rather than a choice" because the grid engine lived
          in `packages/cultivar-os` and shared never imports the app. The fact was true; the word
          "limit" was not. **A package placement is not a structural constraint — it is a decision
          somebody made, and this sentence dressed it as physics.** Measured when it was finally
          questioned (2026-09-03, #272): the engine's ENTIRE dependency closure was `react`,
          `lucide-react` and two zero-import siblings. Nothing had ever held it in cultivar-os.
          `DataSheet.tsx` now lives at `@trace/shared/components/datasheet/DataSheet` and IS
          reachable from here.
          ⚠️ THIS TABLE IS STILL PLAIN, AND THAT IS NOW A CHOICE RATHER THAN A LIMIT — the promotion
          did not convert this surface, deliberately: that is a separate build against G1-G7 with its
          own owner-test cards, not a drive-by inside a move whose whole virtue is that `verify`
          proves it changed no behaviour. Converting it is OWED, not done.
          ✏️ FILED AS ITS OWN LESSON because it is the second time in a week a component comment
          asserted a constraint its own repo contradicted (tech-debt #61 was the first, the
          `ReceiptsList` divergence the second): a reason written once and never re-read becomes a
          fact nobody checks. */}
      {parsed.invoices && parsed.invoices.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: '0.875rem', color: DARK, fontWeight: 700, margin: '0 0 4px' }}>
            Your invoices
          </p>
          <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 10px', lineHeight: 1.5 }}>
            {/* The cap NAMES itself. A capped list that reports a bare total is a list quietly
                claiming to be whole — the same defect the walk's own completeness refusal
                exists to prevent, arriving one layer up in the display. */}
            Showing the {Math.min(INVOICE_ROWS_SHOWN, parsed.invoices.length).toLocaleString()} most
            recent of {parsed.invoices.length.toLocaleString()} invoices, newest first.
            {' '}<strong>We do not list your customers&rsquo; details here</strong> — who bought is
            not shown on this screen. The complete records, including every buyer, are in the file
            that downloaded to this device.
          </p>
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  {/* The module's own `head`/`cell` styles, not a second copy — this file
                      already had both for its other tables (§6 r8). */}
                  {['Invoice number', 'Date', 'Total'].map((h, i) => (
                    <th key={h} style={{ ...head, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoiceRowsForDisplay(parsed.invoices, INVOICE_ROWS_SHOWN).map(inv => (
                  <tr key={inv.id}>
                    <td style={cell}>{inv.docNumber ?? <span style={{ color: GRAY }}>No number</span>}</td>
                    {/* D-9 / A9 — a missing date is NEVER rendered as a real one. */}
                    <td style={cell}>{inv.txnDate ?? <span style={{ color: GRAY }}>No date recorded</span>}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>
                      {inv.totalAmt === null
                        ? <span style={{ color: GRAY }}>Not recorded</span>
                        : `$${inv.totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BooksReview findings={findings} />

      {state?.savedAs && (
        <p style={{ fontSize: '0.8125rem', color: GREEN, margin: '10px 0 0', wordBreak: 'break-all' }}>
          ↓ Full response saved to your downloads folder as <strong>{state.savedAs}</strong>
          {/* 🔴 The warning follows the DATA, not the button. The invoice file holds Intuit's
              verbatim bodies, and a raw invoice names the person who bought it — so the capture
              is as personal as the customer one even though the screen above it never is. */}
          {state.entity !== 'Item' && (
            <span style={{ color: AMBER, display: 'block', marginTop: 4 }}>
              ⚠ That file holds your customers&apos; names
              {state.entity === 'Invoice' ? ', what each of them bought and what they paid' : ', addresses, phone numbers and email'}.
              It is outside this application and outside the code repository — keep it that way.
            </span>
          )}
        </p>
      )}
      {state?.saveFailed && (
        // Surfaced, never silent: if the file did not save, the operator must know BEFORE they
        // close the tab and assume they have a copy.
        <p style={{ fontSize: '0.8125rem', color: RED, margin: '10px 0 0' }}>
          ⚠ The response could not be saved to a file — it is not on disk. Run the read again.
        </p>
      )}

      {state?.error && (
        <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: `1px solid ${RED}`, borderRadius: 9 }}>
          <p style={{ fontSize: '0.8125rem', color: RED, margin: 0, lineHeight: 1.5, fontWeight: 600 }}>{state.error}</p>
          {state.note && <p style={{ fontSize: '0.75rem', color: GRAY, margin: '6px 0 0' }}>{state.note}</p>}
          {b?.expected_total !== undefined && b?.expected_total !== null && (
            <p style={{ fontSize: '0.75rem', color: GRAY, margin: '6px 0 0' }}>
              {/* A DELIBERATE stop and a walk that BROKE are different events, and "retrieved
                  before it stopped" describes only the second. Saying it of a refusal that never
                  started reads as a failure mid-read and sends someone hunting a fault. */}
              {b.code === 'TOO_MANY'
                ? `QuickBooks reports ${b.expected_total.toLocaleString()} records. Nothing was downloaded — this read stops above ${(b.ceiling ?? 0).toLocaleString()}.`
                : `QuickBooks reported ${b.expected_total.toLocaleString()} · ${(b.retrieved_total ?? 0).toLocaleString()} retrieved before it stopped.`}
            </p>
          )}
        </div>
      )}

      {/* ── COMPLETENESS, SHOWN EVEN WHEN IT AGREES ─────────────────────────────
          The number is on screen on every successful read, not only on a mismatch. A
          completeness claim nobody can see is a completeness claim nobody checks — which is
          precisely how 100 rows passed for the whole list. */}
      {b?.ok && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0fdf4', border: `1px solid ${GREEN}`, borderRadius: 9 }}>
          <p style={{ fontSize: '0.8125rem', color: GREEN, margin: 0, fontWeight: 700 }}>
            Complete — QuickBooks reports {(b.expected_total ?? 0).toLocaleString()} and{' '}
            {(b.retrieved_total ?? 0).toLocaleString()} were retrieved
            {b.pages_fetched ? ` across ${b.pages_fetched} page${b.pages_fetched === 1 ? '' : 's'}` : ''}.
          </p>
        </div>
      )}

      {/* ── ITEMS: the breakdown, then the full table ─────────────────────────── */}
      {itemBreak && (
        <div style={{ marginTop: 12 }}>
          {/* 🔴 THE HEADLINE ANSWER. Twelve invoice lines assert ItemRef.value === '1'. */}
          <div style={{
            padding: '10px 12px', borderRadius: 9, marginBottom: 12,
            background: itemBreak.itemId1 ? '#f9fafb' : '#fffbeb',
            border: `1px solid ${itemBreak.itemId1 ? '#e5e7eb' : AMBER}`,
          }}>
            <p style={{ fontSize: '0.8125rem', color: itemBreak.itemId1 ? DARK : AMBER, margin: 0, lineHeight: 1.5 }}>
              {itemBreak.itemId1 ? (
                <>
                  <strong>Item Id 1 exists</strong> — “{itemBreak.itemId1.name}”, type{' '}
                  {itemBreak.itemId1.type ?? 'Not set'}, income account{' '}
                  {itemBreak.itemId1.incomeAccount ?? 'Not set'}. Every invoice line the push writes
                  currently lands here.
                </>
              ) : (
                <>
                  <strong>There is no item with Id 1 in this company.</strong> The invoice push asserts
                  it twelve times, so a push today would be rejected by QuickBooks rather than
                  mis-filed.
                </>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="items" value={itemBreak.total} />
            <Stat label="sellable" value={itemBreak.sellable} of={itemBreak.total} />
            <Stat label="categories (folders)" value={itemBreak.categories} of={itemBreak.total} />
            <Stat label="inactive" value={itemBreak.inactive} of={itemBreak.total} />
          </div>

          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 6px' }}>By income account</p>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 9, marginBottom: 14 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}><th style={head}>Income account</th><th style={head}>Items</th></tr></thead>
              <tbody>
                {itemBreak.byIncomeAccount.map(a => (
                  <tr key={a.account ?? '__not_set__'} style={{ borderTop: '1px solid #f3f4f6' }}>
                    {/* An account QuickBooks did not send reads "Not set" — never a blank cell
                        that looks like a rendering bug, and never a plausible guess (D-9 / A9). */}
                    <td style={{ ...cell, color: a.account ? DARK : '#9ca3af' }}>{a.account ?? 'Not set'}</td>
                    <td style={cell}>{a.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state?.entity === 'Item' && b?.ok && (b.items?.length ?? 0) === 0 && (
        // EMPTY is its own surface and it says which of the two empties it is: the read
        // succeeded and the company has no items. It is never the rendering of a failed read.
        <p style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 12 }}>
          The read succeeded and this QuickBooks company has no items on it.
        </p>
      )}

      {state?.entity === 'Item' && b?.items && b.items.length > 0 && (
        // Bounded scroll box so both scrollbars live on the box, not the page (§6 r14).
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 360, border: '1px solid #e5e7eb', borderRadius: 9 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Id', 'Name', 'Type', 'Income account', 'Active'].map(h => <th key={h} style={head}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.items.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{it.id}</td>
                  <td style={cell}>{it.name}</td>
                  <td style={{ ...cell, color: it.type ? DARK : '#9ca3af' }}>{it.type ?? 'Not set'}</td>
                  <td style={{ ...cell, color: it.incomeAccount ? DARK : '#9ca3af' }}>{it.incomeAccount ?? 'Not set'}</td>
                  <td style={{ ...cell, color: it.active === null ? '#9ca3af' : DARK }}>
                    {it.active === null ? 'Not set' : it.active ? 'Yes' : 'No'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CUSTOMERS: counts, coverage, duplicate sizing, five example rows. NEVER a list. ── */}
      {custBreak && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="customers" value={custBreak.total} />
            <Stat label="with email" value={custBreak.withEmail} of={custBreak.total} />
            <Stat label="with phone" value={custBreak.withPhone} of={custBreak.total} />
            <Stat label="with address" value={custBreak.withAddress} of={custBreak.total} />
            <Stat label="with company name" value={custBreak.withCompanyName} of={custBreak.total} />
            <Stat label="no email/phone/address" value={custBreak.withNoContactAtAll} of={custBreak.total} />
            <Stat label="inactive" value={custBreak.inactive} of={custBreak.total} />
          </div>

          {/* The duplicate problem, SIZED before anyone designs a resolver for it. */}
          <div style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 9, marginBottom: 12 }}>
            <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 6px' }}>Records sharing a contact detail</p>
            <p style={{ fontSize: '0.8125rem', color: GRAY, margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: DARK }}>Email:</strong> {custBreak.byEmail.recordsInvolved.toLocaleString()} record
              {custBreak.byEmail.recordsInvolved === 1 ? '' : 's'} across {custBreak.byEmail.sharedValues.toLocaleString()} shared
              address{custBreak.byEmail.sharedValues === 1 ? '' : 'es'} · largest group {custBreak.byEmail.largestCluster}
              <br />
              <strong style={{ color: DARK }}>Phone:</strong> {custBreak.byPhone.recordsInvolved.toLocaleString()} record
              {custBreak.byPhone.recordsInvolved === 1 ? '' : 's'} across {custBreak.byPhone.sharedValues.toLocaleString()} shared
              number{custBreak.byPhone.sharedValues === 1 ? '' : 's'} · largest group {custBreak.byPhone.largestCluster}
            </p>
            <p style={{ fontSize: '0.75rem', color: GRAY, margin: '8px 0 0', lineHeight: 1.5 }}>
              Compared case-insensitively on email and on the last 10 digits of a phone. A shared
              detail is not proof of a duplicate — a household or a company can legitimately share
              one — it is the size of the pile somebody would have to look through.
            </p>
          </div>

          {b?.preview && b.preview.length > 0 && (
            <>
              <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 4px' }}>
                What a record looks like
              </p>
              <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 6px' }}>
                The first {b.preview.length} of {custBreak.total.toLocaleString()}. The full list is in
                the downloaded file and is deliberately not shown here.
              </p>
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 9 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {['Id', 'Display name', 'Email', 'Phone', 'Address'].map(h => <th key={h} style={head}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {b.preview.map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ ...cell, fontFamily: 'monospace' }}>{c.id}</td>
                        <td style={cell}>{c.displayName}</td>
                        <td style={{ ...cell, color: c.email ? DARK : '#9ca3af' }}>{c.email ?? 'Not set'}</td>
                        <td style={{ ...cell, color: c.phone ? DARK : '#9ca3af' }}>{c.phone ?? 'Not set'}</td>
                        <td style={{ ...cell, color: c.address ? DARK : '#9ca3af' }}>{c.address ?? 'Not set'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {custBreak.total === 0 && (
            <p style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 12 }}>
              The read succeeded and this QuickBooks company has no customers on it.
            </p>
          )}
        </div>
      )}

      {/* ══ INVOICES: the date range FIRST, then what sold. NEVER a record. ══════ */}
      {invBreak && invBreak.invoices > 0 && (
        <div style={{ marginTop: 12 }}>
          {/* 🔴 THE DATE RANGE IS THE HEADLINE AND IT IS DELIBERATELY ABOVE EVERY OTHER NUMBER.
              Every figure below is meaningless without the span it covers — "412 Shumard oaks"
              is a different fact over ten years than over eight months. */}
          <div style={{ padding: '12px 14px', background: '#f0fdf4', border: `1px solid ${GREEN}`, borderRadius: 9, marginBottom: 12 }}>
            <p style={{ fontSize: '0.75rem', color: GREEN, fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.04em' }}>
              HOW FAR BACK THE HISTORY GOES
            </p>
            <p style={{ fontSize: '1rem', color: DARK, fontWeight: 800, margin: 0 }}>
              {invBreak.dateRange.earliest ?? 'no dated invoice'} → {invBreak.dateRange.latest ?? 'no dated invoice'}
            </p>
            <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '4px 0 0', lineHeight: 1.5 }}>
              {invBreak.invoices.toLocaleString()} invoice{invBreak.invoices === 1 ? '' : 's'} across{' '}
              {invBreak.dateRange.monthsSpanned} month{invBreak.dateRange.monthsSpanned === 1 ? '' : 's'}
              {invBreak.dateRange.undated > 0 && (
                // Reported, never folded into the range — an invoice with no readable date is
                // outside every month below, and a total that quietly includes it lies twice.
                <span style={{ color: AMBER }}>
                  {' '}· {invBreak.dateRange.undated.toLocaleString()} carried no readable date and are in none of the months below
                </span>
              )}
            </p>
          </div>

          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 6px' }}>Invoices by year</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {invBreak.byYear.map(y => <Stat key={y.year} label={y.year} value={y.invoices} />)}
          </div>

          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 2px' }}>Invoices by month</p>
          <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 6px' }}>
            Every month in the span, including the ones with none — the empty months are the seasonality answer.
          </p>
          <div style={{ overflowY: 'auto', maxHeight: 300, border: '1px solid #e5e7eb', borderRadius: 9, padding: '8px 10px', marginBottom: 14 }}>
            {invBreak.byMonth.map(m => (
              <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: GRAY, width: 62, flexShrink: 0 }}>{m.month}</span>
                <span style={{ background: m.invoices ? GREEN : 'transparent', height: 10, borderRadius: 3,
                  width: `${(m.invoices / peakMonth) * 100}%`, minWidth: m.invoices ? 3 : 0, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: m.invoices ? DARK : '#9ca3af' }}>{m.invoices}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Stat label="lines" value={invBreak.linesTotal} />
            <Stat label="lines with an item" value={invBreak.linesWithItemRef} of={invBreak.linesTotal} />
            <Stat label="lines on item 1 (generic)" value={invBreak.linesOnItemId1} of={invBreak.linesTotal} />
            <Stat label="distinct items sold" value={invBreak.distinctItemsSold} />
            <Stat label="total quantity sold" value={invBreak.totalQtySold} />
            <Stat label="distinct customers" value={invBreak.distinctCustomers} />
          </div>

          {/* 🔴 TERRY'S QUESTION. "How many trees did we plant last year" — first answerable here. */}
          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 2px' }}>
            Top items by quantity sold
          </p>
          <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 6px' }}>
            The {invBreak.topItemsByQty.length} largest of {invBreak.distinctItemsSold.toLocaleString()} distinct items.
            Discount lines are excluded — their quantity is a dollar base, not a count.
          </p>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 320, border: '1px solid #e5e7eb', borderRadius: 9, marginBottom: 14 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                {['Item', 'Id', 'Qty', 'Lines', 'Amount'].map(h => <th key={h} style={head}>{h}</th>)}
              </tr></thead>
              <tbody>
                {invBreak.topItemsByQty.map(i => (
                  <tr key={`${i.itemId ?? '-'}::${i.itemName}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={cell}>{i.itemName}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', color: i.itemId ? DARK : '#9ca3af' }}>{i.itemId ?? 'Not set'}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{i.qty.toLocaleString()}</td>
                    <td style={cell}>{i.lines.toLocaleString()}</td>
                    <td style={cell}>${Math.round(i.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* The $0 bundle items — how much installation is hidden inside a tree sale. */}
          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 6px' }}>
            Bundle lines ({BUNDLE_LABEL})
          </p>
          {invBreak.bundleItems.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 14px' }}>
              No {BUNDLE_LABEL} lines in this history. That is an answer, not an empty table — the
              installation-inside-the-tree-price question does not arise on these invoices.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 9, marginBottom: 14 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Item', 'Lines', 'At $0', 'Carrying money', 'Qty', 'Amount'].map(h => <th key={h} style={head}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {invBreak.bundleItems.map(bi => (
                    <tr key={bi.itemName} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={cell}>{bi.itemName}</td>
                      <td style={cell}>{bi.lines.toLocaleString()}</td>
                      <td style={cell}>{bi.zeroAmount.toLocaleString()}</td>
                      {/* Counted, not assumed: "the $0 bundle items" is a claim about their
                          books, and a bundle line carrying money is a different finding. */}
                      <td style={{ ...cell, color: bi.nonZeroAmount ? AMBER : GRAY, fontWeight: bi.nonZeroAmount ? 700 : 400 }}>
                        {bi.nonZeroAmount.toLocaleString()}
                      </td>
                      <td style={cell}>{bi.qtyTotal.toLocaleString()}</td>
                      <td style={cell}>${Math.round(bi.amountTotal).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 🔴 WHAT THE DISCOUNT LINES WERE COMPUTED ON — answered from their history. */}
          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 2px' }}>
            What each discount was calculated on
          </p>
          <p style={{ fontSize: '0.75rem', color: GRAY, margin: '0 0 6px', lineHeight: 1.5 }}>
            The <strong>base</strong> is the Qty carried on the discount line. Compared against the
            invoice&apos;s own subtotal: <strong>equal</strong> means the discount covered everything on
            that invoice, <strong>below</strong> means something was left out — and the last column
            names what.
          </p>
          {invBreak.discounts.byName.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 10px' }}>
              No discount lines in this history.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 9, marginBottom: 10 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  {['Discount', 'Lines', 'Base = subtotal', 'Base below', 'Base above', 'No base', 'Excluded from the base'].map(h => <th key={h} style={head}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {invBreak.discounts.byName.map(d => (
                    <tr key={d.itemName} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={cell}>{d.itemName}</td>
                      <td style={cell}>{d.lines.toLocaleString()}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{d.verdicts.equalsSubtotal.toLocaleString()}</td>
                      <td style={{ ...cell, fontWeight: 700, color: d.verdicts.belowSubtotal ? AMBER : DARK }}>{d.verdicts.belowSubtotal.toLocaleString()}</td>
                      <td style={cell}>{d.verdicts.aboveSubtotal.toLocaleString()}</td>
                      <td style={{ ...cell, color: d.verdicts.noBase ? AMBER : GRAY }}>{d.verdicts.noBase.toLocaleString()}</td>
                      <td style={{ ...cell, color: d.excludedFromBase.length ? DARK : '#9ca3af' }}>
                        {d.excludedFromBase.length === 0
                          ? '—'
                          : d.excludedFromBase.slice(0, 3).map(e => `${e.itemName} (${e.times})`).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 🔴 The seven names are a hand-kept list. This row is how it reports its own gaps. */}
          {invBreak.discounts.unnamedDiscountLines.length > 0 && (
            <div style={{ padding: '10px 12px', background: '#fffbeb', border: `1px solid ${AMBER}`, borderRadius: 9, marginBottom: 12 }}>
              <p style={{ fontSize: '0.8125rem', color: AMBER, margin: 0, lineHeight: 1.5 }}>
                <strong>Discount-shaped lines that are not on the named list:</strong>{' '}
                {invBreak.discounts.unnamedDiscountLines.map(u => `${u.itemName} (${u.lines})`).join(', ')}.
                These were kept out of the sales figures but are not analysed above — the seven
                names came from a list, and this is the list reporting what it missed.
              </p>
            </div>
          )}

          <p style={{ fontSize: '0.8125rem', color: DARK, fontWeight: 700, margin: '0 0 6px' }}>Every line type in the history</p>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 9 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}><th style={head}>QuickBooks line type</th><th style={head}>Lines</th></tr></thead>
              <tbody>
                {invBreak.byDetailType.map(d => (
                  <tr key={d.detailType} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={cell}>{d.detailType}</td>
                    <td style={cell}>{d.lines.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.75rem', color: GRAY, margin: '6px 0 0', lineHeight: 1.5 }}>
            This table adds to {invBreak.linesTotal.toLocaleString()} — every line is in it. A line
            type this read does not interpret appears here under its own name rather than going
            missing from the totals.
          </p>
        </div>
      )}

      {state?.entity === 'Invoice' && b?.ok && invBreak?.invoices === 0 && (
        <p style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 12 }}>
          The read succeeded and this QuickBooks company has no invoices on it.
        </p>
      )}
    </div>
  );
}
