// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the operator-facing half of the ShipDate → delivery ingest. PREVIEW first — the
//   stops it would create, the addresses it parsed, and every row it REFUSED — then INGEST on
//   an explicit press. Two steps, never one.
// DEPENDENCIES: `/api/qbo/deliveries/preview` and `/api/qbo/deliveries/ingest`
//   (api/qbo/router.ts — the SAME Vercel function as the three reads, no new one) · authHeaders().
// OUTPUTS: <QboDeliveryIngest businessId /> — mounted in the Accounting card below the reads.
//
// 🔴 EIGHTEEN ROWS IS SMALL ENOUGH FOR A PERSON TO READ, AND THAT IS THE DESIGN. The customer
//   read shows five examples out of 1,900 because nobody can check 1,900. This one shows every
//   row it is about to write, because somebody CAN check eighteen — and because these rows
//   become places a truck drives to. A preview that samples would be the wrong shape here.
//
// 🔴 THE REFUSALS ARE RENDERED ABOVE THE STOPS, NOT BELOW THEM. A row the parser could not read
//   is the only part of this screen that needs a human, so it is the part that is not scrolled
//   past. It shows the RAW LINES beside the reason: "could not parse" without the thing that
//   could not be parsed asks Lauren to guess what the machine saw (D-9).
//
// 🔴 SIX SURFACE STATES. Idle · loading · empty ("nothing to schedule") · error · blocked (the
//   migration precondition, which NAMES itself) · ready. None of them is a blank panel, and the
//   blocked state says what to do rather than just refusing.
import React, { useState } from 'react';
import { authHeaders } from '../auth/authHeaders';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

interface PreviewStop {
  invoiceId: string; docNumber: string | null; deliveryDate: string; totalAmt: number | null;
  customerName: string | null; qbCustomerId: string | null;
  customerType: 'person' | 'organization';
  address: string; phone: string | null; cityStateZipFrom: string; note: string | null;
  customerAction: 'link' | 'create'; customerRule: string; alreadyIngested: boolean;
}
interface PreviewRefusal {
  invoiceId: string; docNumber: string | null; deliveryDate: string;
  customerName: string | null; reason: string; lines: string[];
}
interface DateConflict {
  invoiceId: string; docNumber: string | null; customerName: string | null;
  appDate: string | null; quickbooksDate: string; differs: boolean;
}
interface IngestReport {
  ok?: boolean; blocker?: string | null;
  invoicesRead?: number; futureShipDates?: number; alreadyIngested?: number;
  stops?: PreviewStop[]; refusals?: PreviewRefusal[]; conflicts?: DateConflict[];
  written?: number; customersCreated?: number; customersLinked?: number;
  errors?: { invoiceId: string; step: string; message: string }[];
  committed?: boolean;
  error?: string; code?: string; detail?: string;
}

const money = (n: number | null) =>
  n === null || n === undefined ? '—' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The operator's OWN date, not the server's. It decides which stops count as still ahead. */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// `businessId` is nullable because the business context is — the same signature QboBooksReader
// carries. A panel that renders its buttons before the tenant has resolved would fire a read
// against `business_id=` and get a 400 back; it says it is still loading instead (six states).
export function QboDeliveryIngest({ businessId }: { businessId: string | null | undefined }) {
  const [busy, setBusy]       = useState<null | 'preview' | 'ingest'>(null);
  const [report, setReport]   = useState<IngestReport | null>(null);
  const [failed, setFailed]   = useState<string | null>(null);

  async function call(kind: 'preview' | 'ingest') {
    // Narrowed HERE as well as at render: the render guard cannot narrow a closure, and a read
    // fired with an empty business_id is a 400 that reads like a broken feature.
    if (!businessId) return;
    setBusy(kind); setFailed(null);
    try {
      const url = `/api/qbo/deliveries/${kind}?business_id=${encodeURIComponent(businessId)}&today=${localToday()}`;
      const res  = await fetch(url, {
        method: kind === 'ingest' ? 'POST' : 'GET',
        headers: await authHeaders(),
      });
      const body = (await res.json()) as IngestReport;
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
        Loading this business — the QuickBooks delivery ingest will appear here.
      </p>
    );
  }

  const stops    = report?.stops ?? [];
  const refusals = report?.refusals ?? [];
  const conflicts = report?.conflicts ?? [];
  const toWrite  = stops.filter(s => !s.alreadyIngested);
  const already  = stops.filter(s => s.alreadyIngested);
  const committed = report?.committed === true;

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb' }}>
      <h4 style={{ margin: '0 0 .25rem', color: DARK, fontSize: '1rem' }}>Scheduled deliveries from QuickBooks</h4>
      <p style={{ margin: '0 0 .75rem', color: GRAY, fontSize: '.85rem', lineHeight: 1.5 }}>
        Every invoice with a <strong>ship date</strong> today or later becomes a stop on the calendar,
        with the ship-to address and phone as they are entered in QuickBooks. Nothing is written until
        you press Ingest, and running it twice never creates a second copy of a stop.
        {' '}<strong>This is a one-time seed, not a sync</strong> — a stop that already exists is left
        exactly as it is, including its date. Cultivar owns the delivery date; QuickBooks owns the money.
      </p>

      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => void call('preview')}
          disabled={busy !== null}
          style={{ minHeight: 48, padding: '0 1.1rem', background: '#fff', color: GREEN,
                   border: `2px solid ${GREEN}`, borderRadius: 6, fontWeight: 700,
                   cursor: busy ? 'wait' : 'pointer' }}>
          {busy === 'preview' ? 'Reading QuickBooks…' : 'Preview scheduled deliveries'}
        </button>
        <button
          onClick={() => void call('ingest')}
          disabled={busy !== null || toWrite.length === 0 || report?.ok === false || committed}
          style={{ minHeight: 48, padding: '0 1.1rem',
                   background: (toWrite.length === 0 || report?.ok === false || committed) ? '#d1d5db' : GREEN,
                   color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700,
                   cursor: busy ? 'wait' : (toWrite.length === 0 || committed) ? 'not-allowed' : 'pointer' }}>
          {busy === 'ingest' ? 'Writing…' : `Ingest ${toWrite.length} stop${toWrite.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {failed && (
        <p style={{ marginTop: '.75rem', color: RED, fontSize: '.85rem' }}>⚠️ {failed}</p>
      )}

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
            <strong>{report.futureShipDates ?? 0}</strong> of <strong>{report.invoicesRead ?? 0}</strong> invoices
            carry a ship date today or later.{' '}
            {committed
              ? <>Wrote <strong style={{ color: GREEN }}>{report.written ?? 0}</strong> stop{report.written === 1 ? '' : 's'} —{' '}
                  {report.customersCreated ?? 0} customer{report.customersCreated === 1 ? '' : 's'} created,{' '}
                  {report.customersLinked ?? 0} matched to existing records.</>
              : <>{toWrite.length} would be written{already.length > 0 ? `, ${already.length} already scheduled` : ''}
                  {conflicts.length > 0 ? `, ${conflicts.length} already on your calendar and left alone` : ''}
                  {refusals.length > 0 ? `, ${refusals.length} need you` : ''}.</>}
          </p>

          {/* REFUSALS FIRST — the only part that needs a human. */}
          {refusals.length > 0 && (
            <div style={{ marginBottom: '.9rem' }}>
              <p style={{ margin: '0 0 .35rem', color: RED, fontWeight: 700, fontSize: '.85rem' }}>
                {refusals.length} left for you — TRACE will not guess an address
              </p>
              {refusals.map(r => (
                <div key={r.invoiceId} style={{ padding: '.5rem .65rem', marginBottom: '.35rem',
                     background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: '.8rem' }}>
                  <div style={{ color: DARK, fontWeight: 600 }}>
                    {r.customerName || '(no customer named)'} · {r.deliveryDate}
                    {r.docNumber ? ` · invoice #${r.docNumber}` : ''}
                  </div>
                  <div style={{ color: RED, marginTop: '.15rem' }}>{r.reason}</div>
                  {r.lines.length > 0 && (
                    <div style={{ color: GRAY, marginTop: '.25rem', fontFamily: 'ui-monospace, monospace', fontSize: '.75rem' }}>
                      {r.lines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {conflicts.length > 0 && (
            <div style={{ marginBottom: '.9rem', padding: '.6rem .7rem',
                          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
              <p style={{ margin: '0 0 .35rem', color: DARK, fontWeight: 700, fontSize: '.85rem' }}>
                {conflicts.length} stop{conflicts.length === 1 ? ' is' : 's are'} already on your calendar — left untouched
              </p>
              <p style={{ margin: '0 0 .45rem', color: GRAY, fontSize: '.78rem', lineHeight: 1.5 }}>
                Where the two dates differ, <strong>your calendar is the one that stands</strong> — you moved
                it, the invoice did not catch up. Nothing here was changed.
              </p>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.79rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: GRAY }}>
                    <th style={{ padding: '.25rem .4rem' }}>Customer</th>
                    <th style={{ padding: '.25rem .4rem' }}>On your calendar</th>
                    <th style={{ padding: '.25rem .4rem' }}>On the invoice</th>
                    <th style={{ padding: '.25rem .4rem' }}>Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map(c => (
                    <tr key={c.invoiceId}>
                      <td style={{ padding: '.25rem .4rem', color: DARK }}>{c.customerName || '—'}</td>
                      <td style={{ padding: '.25rem .4rem', color: c.differs ? GREEN : DARK, fontWeight: c.differs ? 700 : 400 }}>
                        {c.appDate || 'no date set'}
                      </td>
                      <td style={{ padding: '.25rem .4rem', color: c.differs ? AMBER : GRAY }}>
                        {c.quickbooksDate}{c.differs ? ' (stale)' : ''}
                      </td>
                      <td style={{ padding: '.25rem .4rem', color: GRAY }}>{c.docNumber ? `#${c.docNumber}` : c.invoiceId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stops.length === 0 && refusals.length === 0 && conflicts.length === 0 && (
            <p style={{ color: GRAY, fontSize: '.85rem' }}>
              No invoice in QuickBooks carries a ship date today or later — there is nothing to schedule.
            </p>
          )}

          {stops.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '.8rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: GRAY, borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '.4rem .5rem' }}>Date</th>
                    <th style={{ padding: '.4rem .5rem' }}>Customer</th>
                    <th style={{ padding: '.4rem .5rem' }}>Delivery address</th>
                    <th style={{ padding: '.4rem .5rem' }}>Phone</th>
                    <th style={{ padding: '.4rem .5rem' }}>Invoice</th>
                    <th style={{ padding: '.4rem .5rem' }}>Customer record</th>
                  </tr>
                </thead>
                <tbody>
                  {stops.map(s => (
                    <tr key={s.invoiceId} style={{ borderBottom: '1px solid #f3f4f6',
                         opacity: s.alreadyIngested ? 0.55 : 1 }}>
                      <td style={{ padding: '.4rem .5rem', whiteSpace: 'nowrap', color: DARK }}>{s.deliveryDate}</td>
                      <td style={{ padding: '.4rem .5rem', color: DARK }}>
                        {s.customerName || '—'}
                        {s.customerType === 'organization' && <span style={{ color: GRAY }}> (business)</span>}
                      </td>
                      <td style={{ padding: '.4rem .5rem', color: DARK }}>
                        {s.address}
                        {/* A billing town that differs is shown, not hidden and not blocked on. */}
                        {s.note && <div style={{ color: AMBER, fontSize: '.72rem', marginTop: '.15rem' }}>{s.note}</div>}
                      </td>
                      {/* A phone we did not find is stated as absent, never as an empty cell. */}
                      <td style={{ padding: '.4rem .5rem', color: s.phone ? DARK : GRAY }}>{s.phone || 'none on the invoice'}</td>
                      <td style={{ padding: '.4rem .5rem', color: GRAY, whiteSpace: 'nowrap' }}>
                        {s.docNumber ? `#${s.docNumber}` : s.invoiceId} · {money(s.totalAmt)}
                      </td>
                      <td style={{ padding: '.4rem .5rem', color: s.alreadyIngested ? GRAY : (s.customerAction === 'create' ? GREEN : GRAY) }}>
                        {s.alreadyIngested ? 'already scheduled' : (s.customerAction === 'create' ? 'new customer' : 'existing customer')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(report.errors?.length ?? 0) > 0 && (
            <div style={{ marginTop: '.75rem' }}>
              <p style={{ margin: '0 0 .3rem', color: RED, fontWeight: 700, fontSize: '.85rem' }}>
                {report.errors!.length} stop{report.errors!.length === 1 ? '' : 's'} did not complete — press Ingest again to retry just those
              </p>
              {report.errors!.map(e => (
                <div key={`${e.invoiceId}-${e.step}`} style={{ color: RED, fontSize: '.78rem' }}>
                  invoice {e.invoiceId} · {e.step} · {e.message}
                </div>
              ))}
            </div>
          )}

          {/* The one thing the invoice cannot tell us, said out loud rather than guessed. */}
          {toWrite.length > 0 && !committed && (
            <p style={{ marginTop: '.7rem', color: GRAY, fontSize: '.78rem', lineHeight: 1.5 }}>
              An invoice does not say whether a stop is a <strong>planting</strong> or a <strong>drop-off</strong>,
              so TRACE leaves that unset rather than guessing — set it per stop on the delivery schedule.
              This step creates <strong>calendar stops only</strong> — no inventory moves, and no sale is
              recorded. What is <em>on</em> each stop is the next panel down.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
