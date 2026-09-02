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
import { rawCaptureFileName, QBO_ROUTE, type QboEntity } from '../quickbooks/qboRead';
import type { QboItemRow, ItemBreakdown } from '../quickbooks/itemList';
import type { QboCustomerRow, CustomerBreakdown } from '../quickbooks/customerList';
import { BUNDLE_ITEM_NAMES, parseInvoiceList, type InvoiceBreakdown, type QboInvoiceRow } from '../quickbooks/invoiceList';
import { parseShipmentList } from '../quickbooks/shipmentIngest';
import { evaluateBooks, type BooksInput, type Finding } from '../quickbooks/booksFindings';
import { BooksReview } from './BooksReview';

// The bundle items are NAMED BY THE MODULE THAT COUNTS THEM. A second list typed into this
// screen is a second representation of one fact (STD-011), and it is the copy that drifts — a
// heading naming three items above a table counting two.
const BUNDLE_LABEL = BUNDLE_ITEM_NAMES.join(' / ');

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

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

  async function read(entity: QboEntity) {
    if (!businessId || loading) return;
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
    } catch (e: any) {
      setState({ entity, body: {}, savedAs: null, saveFailed: false,
        error: `The read could not complete: ${String(e?.message ?? e)}`, note: null });
    } finally {
      setLoading(null);
    }
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
  const findings: Finding[] = (() => {
    const inv = reads.Invoice;
    let invoices: QboInvoiceRow[] | undefined;
    let shipDates: Map<string, string | null> | undefined;
    if (inv?.capture) {
      const pages = (inv.capture as { pages?: { body?: string }[] }).pages ?? [];
      const bodies = pages.map(p => p.body ?? '').filter(Boolean);
      invoices = bodies.flatMap(raw => parseInvoiceList(raw).invoices);
      shipDates = new Map(bodies.flatMap(raw => parseShipmentList(raw).shipments).map(sh => [sh.id, sh.shipDate]));
    }
    const input: BooksInput = {
      items:     reads.Item?.items,
      customers: reads.Customer?.breakdown as CustomerBreakdown | undefined,
      invoices,
      discounts: (reads.Invoice?.breakdown as InvoiceBreakdown | undefined)?.discounts,
      shipDates,
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

      {/* 🔴 THE REVIEW SITS BETWEEN THE READS AND THE IMPORT PANELS BELOW, AND BESIDE THEM
          RATHER THAN IN FRONT OF THEM. It has no acknowledge-to-continue and nothing on it can
          disable an ingest button: a finding that could stop Lauren is a finding that makes her
          phone David, and then the build has failed however good the finding was. */}
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
