// ============================================================
// QboHistoryLoad — bring the business's WHOLE invoice history in, as orders and lines.
// PURPOSE:      the step after the books import on the one path (connect → preview → import →
//               undo). The catalogue import brings WHAT they sell; this brings WHAT THEY SOLD —
//               1,510 invoices at LAWNS — so a customer record can show real order history and a
//               lifetime value that is theirs rather than zero.
// DEPENDENCIES: /api/qbo/history/preview and /history/ingest (router branches, NO new Vercel
//               function — api/ is 12 of 12) · authHeaders · useBusinessContext · ownerAuthority.
// OUTPUTS:      <QboHistoryLoad businessId />
//
// 🔴 PREVIEW IS NOT OPTIONAL AND THE IMPORT BUTTON STAYS DISABLED UNTIL IT HAS RUN. The numbers
//    it prints — how many invoices QuickBooks holds TODAY, how many would import, how many are
//    skipped and WHY — are the only thing that makes the press an informed one. A capture taken
//    five days ago is not today's books.
//
// 🔴 IT BELONGS TO THE LOAD (R-165). The orders it writes carry the SAME `import_run_id` as the
//    customers and products, so the wipe removes the whole load in ONE operation. The panel says
//    so, because an owner deciding whether to press this needs to know it is undoable.
// ============================================================
import React, { useState } from 'react';
import { authHeaders } from '../auth/authHeaders';
import { useBusinessContext } from '../context';
import { holdsOwnerAuthority } from '../auth/ownerAuthority';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';
const AMBER = '#92400e';

interface RelinkReport {
  ok: boolean; blocker: string | null; runId: string | null;
  capturesRead: number; linked: number;
  matches: Array<{ documentNumber: string; corroboratedOn: string[] }>;
  refusalCounts: Record<string, number>;
  refusals: Array<{ documentNumber: string | null; reason: string; detail: string }>;
  committed?: boolean; error?: string;
}

const RELINK_REFUSAL_COPY: Record<string, string> = {
  'no-document-number': 'no document number on the capture — nothing to match it by',
  'no-invoice': 'no invoice in QuickBooks carries that number',
  'ambiguous-invoice': 'more than one invoice carries that number and more than one agrees — left for you',
  'no-corroboration': 'the number exists but neither the date nor the amount agrees',
  'no-customer-row': 'the invoice names a customer that is not in your list',
  'already-linked': 'already on the right customer',
};

interface LoadReport {
  ok: boolean; blocker: string | null; runId: string | null;
  invoicesRead: number; ordersWritten: number; linesWritten: number;
  skipCounts: Record<string, number>; runningTotalsDropped: number;
  chunksDone: number; chunksTotal: number;
  committed?: boolean; error?: string;
}

const SKIP_COPY: Record<string, string> = {
  'already-ordered':  'already imported — the invoice number matched an order you already have',
  'captured-by-hand': 'captured by hand — you photographed this invoice, and importing it again would double the sale',
  'no-customer':      'no matching customer — reported rather than guessed at',
};

export function QboHistoryLoad({ businessId }: { businessId: string | null | undefined }) {
  const { role } = useBusinessContext();
  const isOwner = holdsOwnerAuthority(role);
  const [busy, setBusy]     = useState<null | 'preview' | 'ingest'>(null);
  const [report, setReport] = useState<LoadReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [rBusy, setRBusy]   = useState<null | 'preview' | 'run'>(null);
  const [rRep, setRRep]     = useState<RelinkReport | null>(null);
  const [rFail, setRFail]   = useState<string | null>(null);
  const [rPrev, setRPrev]   = useState(false);

  async function relink(kind: 'preview' | 'run') {
    if (!businessId) return;
    setRBusy(kind); setRFail(null);
    try {
      const url = `/api/qbo/relink/${kind}?business_id=${encodeURIComponent(businessId)}`;
      const res = await fetch(url, { method: kind === 'run' ? 'POST' : 'GET', headers: await authHeaders() });
      const body = (await res.json()) as RelinkReport;
      if (!res.ok && !body.blocker) { setRFail(body.error || `The ${kind} failed (HTTP ${res.status}).`); setRRep(null); }
      else { setRRep(body); if (kind === 'preview') setRPrev(true); }
      console.log('[TRACE:RELINK] ' + kind, body);
    } catch (e: unknown) {
      setRFail(e instanceof Error ? e.message : String(e)); setRRep(null);
    } finally { setRBusy(null); }
  }

  async function call(kind: 'preview' | 'ingest') {
    if (!businessId) return;
    setBusy(kind); setFailed(null);
    try {
      const url = `/api/qbo/history/${kind}?business_id=${encodeURIComponent(businessId)}`;
      const res = await fetch(url, { method: kind === 'ingest' ? 'POST' : 'GET', headers: await authHeaders() });
      const body = (await res.json()) as LoadReport;
      if (!res.ok && !body.blocker) { setFailed(body.error || `The ${kind} failed (HTTP ${res.status}).`); setReport(null); }
      else { setReport(body); if (kind === 'preview') setPreviewed(true); }
      console.log('[TRACE:HISTORYLOAD] ' + kind, body);
    } catch (e: unknown) {
      setFailed(e instanceof Error ? e.message : String(e)); setReport(null);
    } finally { setBusy(null); }
  }

  if (!businessId) return null;

  const wrap: React.CSSProperties = {
    marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb',
  };
  const btn = (primary: boolean): React.CSSProperties => ({
    minHeight: 48, padding: '0 1.1rem', borderRadius: 8, fontWeight: 700, fontSize: '.9rem',
    border: primary ? 'none' : `1px solid ${GREEN}`,
    background: primary ? GREEN : '#fff', color: primary ? '#fff' : GREEN,
    cursor: 'pointer', marginRight: '.6rem',
  });

  const skipTotal = report ? Object.values(report.skipCounts ?? {}).reduce((a, b) => a + b, 0) : 0;
  const wouldImport = report ? report.invoicesRead - skipTotal : 0;

  return (
    <div style={wrap}>
      <p style={{ margin: 0, fontWeight: 700, color: DARK, fontSize: '.95rem' }}>Import your sales history</p>
      <p style={{ margin: '.3rem 0 .8rem', color: GRAY, fontSize: '.85rem' }}>
        Every invoice in QuickBooks becomes an order here, attached to the customer who bought it.
        That is what puts real order history and a lifetime value on a customer&rsquo;s record.{' '}
        <strong>It belongs to the same import as your customers and products</strong>, so wiping
        that import removes this too.
      </p>

      {!isOwner ? (
        <p style={{ margin: 0, color: GRAY, fontSize: '.85rem' }}>
          Importing a company&rsquo;s books is done by the account owner.
        </p>
      ) : (
        <>
          <button style={btn(false)} disabled={busy !== null} onClick={() => void call('preview')}>
            {busy === 'preview' ? 'Reading your books…' : 'Preview'}
          </button>
          <button
            style={{ ...btn(true), opacity: previewed && !busy ? 1 : .45,
                     cursor: previewed && !busy ? 'pointer' : 'not-allowed' }}
            disabled={!previewed || busy !== null}
            onClick={() => void call('ingest')}>
            {busy === 'ingest' ? 'Importing…' : 'Import history'}
          </button>
          {!previewed && (
            <p style={{ margin: '.5rem 0 0', color: GRAY, fontSize: '.8rem' }}>
              Preview first — it says how many invoices are in your books today and what would be skipped.
            </p>
          )}
        </>
      )}

      {failed && (
        <p style={{ marginTop: '.8rem', color: RED, fontSize: '.85rem' }}>{failed}</p>
      )}

      {report?.blocker && (
        <p style={{ marginTop: '.8rem', color: AMBER, fontSize: '.85rem' }}>{report.blocker}</p>
      )}

      {/* ── THE RE-LINK ─────────────────────────────────────────────────────────────────────
          🔴 A SECOND STEP OF THE SAME LOAD, NOT A SECOND FEATURE. When a customer was invoiced
          AND their invoice was photographed, two rows exist for one person: the one the
          photograph made, and the one the books import brought in. Lauren opens the second and
          it is empty. This moves the order onto it. It writes no sale. */}
      {isOwner && (
        <div style={{ marginTop: '1.1rem', paddingTop: '.9rem', borderTop: '1px dashed #e5e7eb' }}>
          <p style={{ margin: 0, fontWeight: 700, color: DARK, fontSize: '.9rem' }}>
            Attach photographed invoices to the right customer
          </p>
          <p style={{ margin: '.3rem 0 .7rem', color: GRAY, fontSize: '.82rem' }}>
            An invoice you photographed created its own customer record. Importing your books created
            another for the same person. This moves the sale onto the one from QuickBooks, so their
            record shows it. <strong>It is matched by invoice number and only when the date or the
            amount agrees</strong> — anything else is listed for you rather than guessed at.
          </p>
          <button style={btn(false)} disabled={rBusy !== null} onClick={() => void relink('preview')}>
            {rBusy === 'preview' ? 'Checking…' : 'Check what would move'}
          </button>
          <button
            style={{ ...btn(true), opacity: rPrev && !rBusy ? 1 : .45,
                     cursor: rPrev && !rBusy ? 'pointer' : 'not-allowed' }}
            disabled={!rPrev || rBusy !== null}
            onClick={() => void relink('run')}>
            {rBusy === 'run' ? 'Moving…' : 'Attach them'}
          </button>
          {rFail && <p style={{ marginTop: '.7rem', color: RED, fontSize: '.85rem' }}>{rFail}</p>}
          {rRep?.blocker && <p style={{ marginTop: '.7rem', color: AMBER, fontSize: '.85rem' }}>{rRep.blocker}</p>}
          {rRep && !rRep.blocker && (
            <div style={{ marginTop: '.8rem', fontSize: '.84rem', color: DARK }}>
              <p style={{ margin: '0 0 .35rem' }}>
                {rRep.committed
                  ? <>Attached <strong style={{ color: GREEN }}>{rRep.linked}</strong> of{' '}
                      <strong>{rRep.matches.length}</strong>.</>
                  : <><strong>{rRep.matches.length}</strong> would move,{' '}
                      <strong>{rRep.refusals.length}</strong> listed for you.</>}
              </p>
              {rRep.matches.length > 0 && (
                <ul style={{ margin: '.2rem 0 .4rem', paddingLeft: '1.1rem', color: GRAY }}>
                  {rRep.matches.slice(0, 25).map(m => (
                    <li key={m.documentNumber}>
                      invoice <strong>#{m.documentNumber}</strong> — agrees on{' '}
                      {m.corroboratedOn.map(f => f === 'sale_date' ? 'the date' : 'the amount').join(' and ')}
                    </li>
                  ))}
                </ul>
              )}
              {rRep.refusals.length > 0 && (
                <ul style={{ margin: '.2rem 0 0', paddingLeft: '1.1rem', color: AMBER }}>
                  {rRep.refusals.slice(0, 25).map((r, i) => (
                    <li key={`${r.documentNumber}-${i}`}>
                      {r.documentNumber ? <>invoice <strong>#{r.documentNumber}</strong></> : 'a capture with no number'}
                      {' '}— {RELINK_REFUSAL_COPY[r.reason] ?? r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {report && !report.blocker && (
        <div style={{ marginTop: '.9rem', fontSize: '.85rem', color: DARK }}>
          <p style={{ margin: '0 0 .4rem' }}>
            <strong>{report.invoicesRead}</strong> invoice{report.invoicesRead === 1 ? '' : 's'} in your
            QuickBooks today.{' '}
            {report.committed
              ? <>Imported <strong style={{ color: GREEN }}>{report.ordersWritten}</strong> as orders,
                  with <strong>{report.linesWritten}</strong> line{report.linesWritten === 1 ? '' : 's'}.</>
              : <><strong>{wouldImport}</strong> would import.</>}
          </p>
          {skipTotal > 0 && (
            <ul style={{ margin: '.3rem 0 0', paddingLeft: '1.1rem', color: GRAY }}>
              {Object.entries(report.skipCounts).filter(([, n]) => n > 0).map(([k, n]) => (
                <li key={k}><strong>{n}</strong> {SKIP_COPY[k] ?? k}</li>
              ))}
            </ul>
          )}
          {/* 🔴 SAID OUT LOUD SO THE GAP IS NEVER READ AS A DROP. One running total per invoice is
              derived and already on the order; storing it would be a second copy of one fact. */}
          {report.runningTotalsDropped > 0 && (
            <p style={{ margin: '.5rem 0 0', color: GRAY, fontSize: '.8rem' }}>
              {report.runningTotalsDropped} running-total lines were not stored — QuickBooks writes one
              per invoice and it is already the order&rsquo;s subtotal.
            </p>
          )}
          {report.committed && report.chunksDone < report.chunksTotal && (
            <p style={{ margin: '.5rem 0 0', color: AMBER }}>
              Stopped after {report.chunksDone} of {report.chunksTotal} batches. Press Import history
              again — what already landed is skipped, not duplicated.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
