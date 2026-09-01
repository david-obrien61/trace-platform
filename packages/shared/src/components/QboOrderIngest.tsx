// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the operator-facing half of "give the stops their load". PREVIEW first — every
//   order it would create, every line on it, and every stop it REFUSES — then INGEST on an
//   explicit press. Two steps, never one.
// DEPENDENCIES: `/api/qbo/orders/preview` and `/api/qbo/orders/ingest` (api/qbo/router.ts —
//   the SAME Vercel function as the reads and the delivery ingest, no new one) · authHeaders().
// OUTPUTS: <QboOrderIngest businessId /> — mounted in the Accounting card BELOW the delivery
//   ingest, because a stop must exist before it can have a load.
//
// 🔴 A SEPARATE COMPONENT, NOT A THIRD BUTTON ON THE DELIVERY PANEL. The two passes answer
//   different questions — *where does the truck go* and *what is on it* — they are gated by
//   different permissions (`deliveries:*` vs `orders:*`), and one can be run without the other.
//   Folding them into one panel would put a customer's purchase history behind a delivery
//   permission, which is a widening nobody asked for.
//
// 🔴 EVERY LINE IS RENDERED, NOT SAMPLED. Nineteen orders is small enough for a person to read,
//   and these become the seller's own sales record — what the dashboard reports as revenue.
//   A preview that summarised would hide exactly the row worth catching.
//
// 🔴 THE AVAILABILITY PROOF IS ON THE SCREEN AFTER A COMMIT, NOT ONLY IN A LOG. "Available to
//   sell did not move" is the single most important thing this pass can say, and a claim that
//   lives only in a serverless log is a claim the person responsible never reads.
//
// 🔴 SIX SURFACE STATES. Idle · loading · empty ("nothing owed a load") · error · blocked (the
//   migration precondition, which NAMES itself) · ready. None of them is a blank panel.
import React, { useState } from 'react';
import { authHeaders } from '../auth/authHeaders';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

interface PlannedLine {
  quantity: number; unitPrice: number; subtotal: number;
  description: string | null; sku: string | null;
}
interface PlannedOrder {
  deliveryId: string; invoiceId: string; docNumber: string | null;
  deliveryDate: string | null; saleDate: string | null;
  status: string; transportMethod: string;
  lineCount: number; lines: PlannedLine[]; notes: string[];
  subtotal: number; tax: number; total: number;
  arithmeticBalances: boolean; lineSum: number;
  subtotalSource: string; taxSource: string;
  counts: { goods: number; discount: number; note: number; runningTotal: number; notesKeptForMoney: number };
}
interface OrderRefusal {
  deliveryId: string; invoiceId: string | null; docNumber: string | null;
  deliveryDate: string | null; reason: string;
}
interface AlreadyOrdered {
  deliveryId: string; invoiceId: string; docNumber: string | null; linkRepaired: boolean;
}
interface PriorOrderFinding {
  deliveryId: string; invoiceId: string; docNumber: string | null; deliveryDate: string | null;
  kind: 'same-invoice' | 'probable' | 'ambiguous';
  orderId: string | null; rule: string; evidence: string; idRecorded?: boolean;
}
interface OrderIngestReport {
  ok?: boolean; blocker?: string | null;
  qbStops?: number;
  alreadyOrdered?: AlreadyOrdered[];
  planned?: PlannedOrder[];
  refusals?: OrderRefusal[];
  priorOrders?: PriorOrderFinding[];
  ordersWritten?: number; idsRecorded?: number; lineItemsWritten?: number; deliveriesLinked?: number;
  errors?: { deliveryId: string; invoiceId: string | null; step: string; message: string }[];
  availabilityUnchanged?: boolean | null;
  linesCarryingLot?: number;
  committed?: boolean;
  error?: string; code?: string; detail?: string;
}

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function QboOrderIngest({ businessId }: { businessId: string | null | undefined }) {
  const [busy, setBusy]     = useState<null | 'preview' | 'ingest'>(null);
  const [report, setReport] = useState<OrderIngestReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function call(kind: 'preview' | 'ingest') {
    if (!businessId) return;
    setBusy(kind); setFailed(null);
    try {
      const url = `/api/qbo/orders/${kind}?business_id=${encodeURIComponent(businessId)}`;
      const res = await fetch(url, { method: kind === 'ingest' ? 'POST' : 'GET', headers: await authHeaders() });
      const body = (await res.json()) as OrderIngestReport;
      if (!res.ok && !body.blocker) {
        setFailed(body.detail || body.error || `The ${kind} failed (HTTP ${res.status}).`);
        setReport(null);
      } else {
        setReport(body);
      }
    } catch (e: unknown) {
      setFailed(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setBusy(null);
    }
  }

  if (!businessId) {
    return (
      <p style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb',
                  color: GRAY, fontSize: '.85rem' }}>
        Loading this business — the delivery loads will appear here.
      </p>
    );
  }

  const planned   = report?.planned ?? [];
  const refusals  = report?.refusals ?? [];
  const priors    = report?.priorOrders ?? [];
  const priorSame = priors.filter(p => p.kind === 'same-invoice');
  const priorOpen = priors.filter(p => p.kind !== 'same-invoice');
  const already   = report?.alreadyOrdered ?? [];
  const committed = report?.committed === true;
  const toRepair  = already.filter(a => a.linkRepaired).length;
  const plannedTotal = planned.reduce((a, p) => a + (p.total ?? 0), 0);
  const plannedLines = planned.reduce((a, p) => a + (p.lineCount ?? 0), 0);
  const notBalancing = planned.filter(p => !p.arithmeticBalances);

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
      <h4 style={{ margin: '0 0 .25rem', color: DARK, fontSize: '1rem' }}>What is on each delivery</h4>
      <p style={{ margin: '0 0 .75rem', color: GRAY, fontSize: '.85rem', lineHeight: 1.5 }}>
        A stop with no load is a place a truck goes with nothing on it. This reads the{' '}
        <strong>lines of the same invoices</strong> the stops came from and records what was sold —
        so a day says whether it is a full one. These are recorded as{' '}
        <strong>history sales</strong>: already paid, already in QuickBooks.{' '}
        <strong>They never push back to QuickBooks and they never hold stock</strong> — an invoice
        that already has an order is left completely alone.
      </p>

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => void call('preview')}
          disabled={busy !== null}
          style={{ minHeight: 48, padding: '0 1.1rem', background: '#fff', color: GREEN,
                   border: `2px solid ${GREEN}`, borderRadius: 6, fontWeight: 700,
                   cursor: busy ? 'wait' : 'pointer' }}>
          {busy === 'preview' ? 'Reading QuickBooks…' : 'Preview the loads'}
        </button>
        <button
          onClick={() => void call('ingest')}
          disabled={busy !== null || (planned.length === 0 && toRepair === 0 && priorSame.length === 0) || report?.ok === false || committed}
          style={{ minHeight: 48, padding: '0 1.1rem',
                   background: ((planned.length === 0 && toRepair === 0 && priorSame.length === 0) || report?.ok === false || committed) ? '#d1d5db' : GREEN,
                   color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700,
                   cursor: busy ? 'wait' : (planned.length === 0 && toRepair === 0 && priorSame.length === 0) || committed ? 'not-allowed' : 'pointer' }}>
          {busy === 'ingest' ? 'Writing…' : `Record ${planned.length} load${planned.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {failed && <p style={{ marginTop: '.75rem', color: RED, fontSize: '.85rem' }}>⚠️ {failed}</p>}

      {report?.blocker && (
        <div style={{ marginTop: '.75rem', padding: '.75rem', background: '#fffbeb',
                      border: `1px solid ${AMBER}`, borderRadius: 6 }}>
          <strong style={{ color: AMBER, fontSize: '.85rem' }}>Not ready to write yet</strong>
          <p style={{ margin: '.35rem 0 0', color: AMBER, fontSize: '.82rem', lineHeight: 1.5 }}>{report.blocker}</p>
        </div>
      )}

      {report && !report.blocker && (
        <div style={{ marginTop: '.9rem' }}>
          <p style={{ margin: '0 0 .6rem', color: DARK, fontSize: '.85rem' }}>
            <strong>{report.qbStops ?? 0}</strong> stop{report.qbStops === 1 ? '' : 's'} on your calendar came from a QuickBooks invoice.{' '}
            {committed
              ? <>Recorded <strong style={{ color: GREEN }}>{report.ordersWritten ?? 0}</strong> load
                  {report.ordersWritten === 1 ? '' : 's'} · {report.lineItemsWritten ?? 0} line
                  {report.lineItemsWritten === 1 ? '' : 's'} · {report.deliveriesLinked ?? 0} stop
                  {report.deliveriesLinked === 1 ? '' : 's'} joined to their order
                  {(report.idsRecorded ?? 0) > 0 ? ` · ${report.idsRecorded} existing sale${report.idsRecorded === 1 ? '' : 's'} matched rather than duplicated` : ''}.</>
              : <>{planned.length} would be recorded ({plannedLines} line{plannedLines === 1 ? '' : 's'}, {money(plannedTotal)})
                  {already.length > 0 ? `, ${already.length} already have one` : ''}
                  {priors.length > 0 ? `, ${priors.length} already exist as a captured sale` : ''}
                  {toRepair > 0 ? ` (${toRepair} of those still need joining)` : ''}
                  {refusals.length > 0 ? `, ${refusals.length} need you` : ''}.</>}
          </p>

          {/* 🔴 THE PROOF, ON THE SCREEN. CARD 8's own question, answered by arithmetic. */}
          {committed && report.availabilityUnchanged !== null && report.availabilityUnchanged !== undefined && (
            <div style={{ marginBottom: '.9rem', padding: '.6rem .7rem', borderRadius: 6,
                          background: report.availabilityUnchanged ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${report.availabilityUnchanged ? '#bbf7d0' : '#fecaca'}` }}>
              <strong style={{ color: report.availabilityUnchanged ? GREEN : RED, fontSize: '.85rem' }}>
                {report.availabilityUnchanged
                  ? '✅ Available to sell did not move — measured across every lot, before and after'
                  : '🔴 AVAILABLE TO SELL CHANGED — a recorded history sale must never do this'}
              </strong>
              <p style={{ margin: '.3rem 0 0', color: report.availabilityUnchanged ? GRAY : RED,
                          fontSize: '.78rem', lineHeight: 1.5 }}>
                {report.availabilityUnchanged
                  ? 'These sales already happened, so none of them holds stock. Every lot’s on-hand and claimed quantity was fingerprinted before the first write and again after the last, and the two are identical.'
                  : 'Stop and report this before selling anything else — what the business can sell has changed, and nothing on this screen was supposed to change it.'}
              </p>
            </div>
          )}

          {/* 🔴 THE COLLISIONS GO ABOVE EVERYTHING, INCLUDING THE REFUSALS. A duplicate sale in
              the seller's own revenue reporting is the worst outcome this screen can produce,
              and "do not reconcile silently" is a requirement about THIS PANEL, not about a log. */}
          {priors.length > 0 && (
            <div style={{ marginBottom: '.9rem', padding: '.7rem .8rem',
                          background: priorOpen.length > 0 ? '#fffbeb' : '#f8fafc',
                          border: `1px solid ${priorOpen.length > 0 ? AMBER : '#e2e8f0'}`, borderRadius: 6 }}>
              <p style={{ margin: '0 0 .3rem', color: priorOpen.length > 0 ? AMBER : DARK, fontWeight: 700, fontSize: '.85rem' }}>
                {priors.length} of these sales are already recorded here — no second copy was created
              </p>
              <p style={{ margin: '0 0 .5rem', color: GRAY, fontSize: '.78rem', lineHeight: 1.5 }}>
                These invoices were <strong>photographed and captured</strong> before this ingest
                existed, so the order behind them carries no QuickBooks id and the usual check
                cannot see it. Each one below was matched on <strong>their own invoice number</strong>,
                corroborated by customer, date and amount.
              </p>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.78rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: GRAY }}>
                    <th style={{ padding: '.25rem .4rem' }}>Invoice</th>
                    <th style={{ padding: '.25rem .4rem' }}>Delivery</th>
                    <th style={{ padding: '.25rem .4rem' }}>What TRACE found</th>
                    <th style={{ padding: '.25rem .4rem' }}>What it did</th>
                  </tr>
                </thead>
                <tbody>
                  {priors.map(p => (
                    <tr key={p.deliveryId} style={{ borderTop: '1px solid #eef2f7' }}>
                      <td style={{ padding: '.3rem .4rem', color: DARK, whiteSpace: 'nowrap' }}>
                        {p.docNumber ? `#${p.docNumber}` : p.invoiceId}
                      </td>
                      <td style={{ padding: '.3rem .4rem', color: GRAY, whiteSpace: 'nowrap' }}>{p.deliveryDate || '—'}</td>
                      <td style={{ padding: '.3rem .4rem', color: DARK }}>
                        {p.evidence}
                        <div style={{ color: GRAY, fontSize: '.73rem', marginTop: '.1rem' }}>{p.rule}</div>
                      </td>
                      <td style={{ padding: '.3rem .4rem', whiteSpace: 'nowrap',
                                   color: p.kind === 'same-invoice' ? GREEN : AMBER, fontWeight: 600 }}>
                        {p.kind === 'same-invoice'
                          ? (committed
                              ? (p.idRecorded ? 'matched — invoice number recorded' : 'matched — already recorded')
                              : 'will match, not duplicate')
                          : '🔴 left for you'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {priorOpen.length > 0 && (
                <p style={{ margin: '.55rem 0 0', color: AMBER, fontSize: '.78rem', lineHeight: 1.5 }}>
                  🔴 <strong>{priorOpen.length} of these TRACE will not settle on its own.</strong> Either
                  the numbers disagree, or there is no invoice number to match on and only the customer,
                  date and amount line up. <strong>Nothing was written for them</strong> — no order, and
                  no id on the one that exists. Open the existing order beside the invoice and decide;
                  a wrong match here is permanent and invisible.
                </p>
              )}
              {priorSame.length > 0 && !committed && (
                <p style={{ margin: '.45rem 0 0', color: GRAY, fontSize: '.76rem', lineHeight: 1.5 }}>
                  For the {priorSame.length} matched above, recording will write <strong>only the
                  QuickBooks invoice number</strong> onto the order that already exists — never its
                  money, its status or its lines — and join the stop to it.
                </p>
              )}
            </div>
          )}

          {/* REFUSALS FIRST — the only part that needs a human. */}
          {refusals.length > 0 && (
            <div style={{ marginBottom: '.9rem' }}>
              <p style={{ margin: '0 0 .35rem', color: RED, fontWeight: 700, fontSize: '.85rem' }}>
                {refusals.length} stop{refusals.length === 1 ? '' : 's'} left for you — TRACE will not invent a load
              </p>
              {refusals.map(r => (
                <div key={r.deliveryId} style={{ padding: '.5rem .65rem', marginBottom: '.35rem',
                     background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: '.8rem' }}>
                  <div style={{ color: DARK, fontWeight: 600 }}>
                    {r.deliveryDate || 'no date'}{r.docNumber ? ` · invoice #${r.docNumber}` : ''}
                  </div>
                  <div style={{ color: RED, marginTop: '.15rem' }}>{r.reason}</div>
                </div>
              ))}
            </div>
          )}

          {notBalancing.length > 0 && (
            <div style={{ marginBottom: '.9rem', padding: '.6rem .7rem',
                          background: '#fffbeb', border: `1px solid ${AMBER}`, borderRadius: 6 }}>
              <strong style={{ color: AMBER, fontSize: '.85rem' }}>
                {notBalancing.length} invoice{notBalancing.length === 1 ? ' does' : 's do'} not add up
              </strong>
              <p style={{ margin: '.3rem 0 0', color: AMBER, fontSize: '.78rem', lineHeight: 1.5 }}>
                Recorded exactly as printed, never corrected — the invoice is the authority on a sale
                that already happened. Worth a look in QuickBooks:{' '}
                {notBalancing.map(p => p.docNumber ? `#${p.docNumber}` : p.invoiceId).join(', ')}.
              </p>
            </div>
          )}

          {planned.length === 0 && refusals.length === 0 && priorOpen.length === 0 && (
            <p style={{ color: GRAY, fontSize: '.85rem' }}>
              {already.length + priors.length > 0
                ? `Every one of these ${already.length + priors.length} stops already has its sale recorded — there is nothing to create.`
                : 'No stop on your calendar came from a QuickBooks invoice, so there is nothing to load.'}
            </p>
          )}

          {planned.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: GRAY, borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '.4rem .5rem' }}>Delivery</th>
                    <th style={{ padding: '.4rem .5rem' }}>Invoice</th>
                    <th style={{ padding: '.4rem .5rem' }}>Sold on</th>
                    <th style={{ padding: '.4rem .5rem' }}>Load</th>
                    <th style={{ padding: '.4rem .5rem' }}>Total</th>
                    <th style={{ padding: '.4rem .5rem' }}>Stock held</th>
                  </tr>
                </thead>
                <tbody>
                  {planned.map(p => (
                    <React.Fragment key={p.deliveryId}>
                      <tr style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                          onClick={() => setOpenId(openId === p.deliveryId ? null : p.deliveryId)}>
                        <td style={{ padding: '.4rem .5rem', whiteSpace: 'nowrap', color: DARK }}>
                          {p.deliveryDate || 'no date'}
                        </td>
                        <td style={{ padding: '.4rem .5rem', color: GRAY, whiteSpace: 'nowrap' }}>
                          {p.docNumber ? `#${p.docNumber}` : p.invoiceId}
                        </td>
                        <td style={{ padding: '.4rem .5rem', color: GRAY, whiteSpace: 'nowrap' }}>{p.saleDate || '—'}</td>
                        <td style={{ padding: '.4rem .5rem', color: DARK }}>
                          {p.lineCount} line{p.lineCount === 1 ? '' : 's'}
                          {p.notes.length > 0 && <span style={{ color: GRAY }}> · {p.notes.length} note{p.notes.length === 1 ? '' : 's'}</span>}
                          <span style={{ color: GRAY }}> · {openId === p.deliveryId ? 'hide' : 'show'}</span>
                        </td>
                        <td style={{ padding: '.4rem .5rem', color: DARK, whiteSpace: 'nowrap' }}>
                          {money(p.total)}
                          {!p.arithmeticBalances && <span style={{ color: AMBER }}> ⚠️</span>}
                        </td>
                        {/* The invariant, stated per row rather than only in a header. */}
                        <td style={{ padding: '.4rem .5rem', color: GRAY, whiteSpace: 'nowrap' }}>none</td>
                      </tr>
                      {openId === p.deliveryId && (
                        <tr>
                          <td colSpan={6} style={{ padding: '.35rem .5rem .8rem', background: '#fafafa' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.78rem' }}>
                              <tbody>
                                {p.lines.map((l, i) => (
                                  <tr key={i}>
                                    <td style={{ padding: '.2rem .4rem', color: GRAY, whiteSpace: 'nowrap',
                                                 fontFamily: 'ui-monospace, monospace' }}>{l.sku || '—'}</td>
                                    <td style={{ padding: '.2rem .4rem', color: DARK }}>{l.description || '(no description)'}</td>
                                    <td style={{ padding: '.2rem .4rem', color: DARK, whiteSpace: 'nowrap' }}>×{l.quantity}</td>
                                    <td style={{ padding: '.2rem .4rem', color: GRAY, whiteSpace: 'nowrap' }}>@ {money(l.unitPrice)}</td>
                                    <td style={{ padding: '.2rem .4rem', color: DARK, whiteSpace: 'nowrap' }}>{money(l.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {p.notes.length > 0 && (
                              <p style={{ margin: '.45rem 0 0', color: AMBER, fontSize: '.76rem', lineHeight: 1.5 }}>
                                <strong>On the invoice, not on the truck:</strong> {p.notes.join(' · ')}
                              </p>
                            )}
                            <p style={{ margin: '.4rem 0 0', color: GRAY, fontSize: '.74rem' }}>
                              subtotal {money(p.subtotal)} ({p.subtotalSource === 'running-total-line' ? 'from the invoice' : 'summed from the lines'})
                              {' · '}tax {money(p.tax)} ({p.taxSource === 'document' ? 'from the invoice' : 'derived'})
                              {' · '}total {money(p.total)}
                              {!p.arithmeticBalances && <span style={{ color: AMBER }}> · does not balance (lines add to {money(p.lineSum)}) — recorded as printed</span>}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(report.errors?.length ?? 0) > 0 && (
            <div style={{ marginTop: '.75rem' }}>
              <p style={{ margin: '0 0 .3rem', color: RED, fontWeight: 700, fontSize: '.85rem' }}>
                {report.errors!.length} did not complete — press again to retry just those
              </p>
              {report.errors!.map((e, i) => (
                <div key={`${e.deliveryId}-${e.step}-${i}`} style={{ color: RED, fontSize: '.78rem' }}>
                  invoice {e.invoiceId ?? '—'} · {e.step} · {e.message}
                </div>
              ))}
            </div>
          )}

          {planned.length > 0 && !committed && (
            <p style={{ marginTop: '.7rem', color: GRAY, fontSize: '.78rem', lineHeight: 1.5 }}>
              A trip charge and a late fee are lines on the invoice, so they are recorded on the sale —
              they are <strong>not</strong> things to put on a truck, and the day sheet decides that
              separately. Nothing here touches your stock: available to sell is measured before and
              after, and the result is shown above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
