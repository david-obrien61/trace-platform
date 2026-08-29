// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the operator-facing half of the QuickBooks item-list read. One button →
//   GET /api/qbo/items → SAVE THE VERBATIM BODY TO A FILE → then render the parsed rows
//   (Id · Name · Type · Income account · Active). Read-only against Intuit; stores nothing
//   on our side.
// DEPENDENCIES: `/api/qbo/items` (api/qbo/router.ts, _route=items) · authHeaders() ·
//   the pure parse/naming helpers in ../quickbooks/itemList.
// OUTPUTS: <QboItemListReader businessId /> — mounted in the Accounting card once connected.
//
// 🔴 WHY THIS SCREEN EXISTS. The invoice push carries TWELVE hardcoded
//   `ItemRef: { value: '1', name: 'Services' }` literals. Nothing has pushed to the live
//   company yet; the next completed checkout is the first real push, and it would land every
//   line — the trees included — as generic "Services", collapsing the Sales-of-Nursery-Stock
//   vs Services split the cost model rests on. This screen reads the REAL ids so the next
//   pass can map to them instead of assuming. It changes none of the twelve.
//
// 🔴 THE FILE IS NOT A CONVENIENCE, IT IS THE POINT — AND IT SAVES ITSELF. Every response is
//   written to disk the moment it arrives, BEFORE anything is rendered, success or failure.
//   Two reasons, and the second is the load-bearing one: (1) re-reading a customer's books
//   must never require re-querying a customer's books; (2) the download lands in the browser's
//   own folder, which is OUTSIDE this repository — so a copy of live accounting data can never
//   be swept into a commit. That is the same class of hazard as the service_role JWT that sat
//   in a settings file: the fix is not to redact it, it is to keep it somewhere git cannot see.
//   ⚠️ A parsed table on screen is ON TOP OF the file, never instead of it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { authHeaders } from '../auth/authHeaders';
import { rawCaptureFileName, type QboItemRow } from '../quickbooks/itemList';

const GREEN = '#27500A';
const GRAY  = '#6b7280';
const RED   = '#A32D2D';
const DARK  = '#111827';

interface ItemsResponse {
  ok?: boolean;
  realm_id?: string;
  queried_at?: string;
  http_status?: number;
  item_count?: number;
  items?: QboItemRow[];
  parse_error?: string | null;
  headline?: string;
  points_at?: string;
  error?: string;
  detail?: string;
  code?: string;
  raw?: string;
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

export function QboItemListReader({ businessId }: { businessId: string | null | undefined }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QboItemRow[] | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function read() {
    if (!businessId || loading) return;
    setLoading(true);
    setItems(null); setError(null); setNote(null); setSavedAs(null); setSaveFailed(false);
    try {
      const res = await fetch(`/api/qbo/items?business_id=${encodeURIComponent(businessId)}`, {
        headers: await authHeaders(),
      });
      const body = (await res.json()) as ItemsResponse;

      // ── THE FILE FIRST, ALWAYS, BEFORE ANY RENDERING DECISION ──────────────
      // Including on failure: Intuit's verbatim Fault body is exactly what distinguishes a 401
      // (the token-refresh path) from a 403 (the granted scope), and losing it means running
      // the query against the customer's books a second time to find out.
      if (typeof body.raw === 'string') {
        const name = rawCaptureFileName(body.realm_id ?? 'unknown-realm', new Date());
        if (saveRawToFile(body.raw, name)) setSavedAs(name); else setSaveFailed(true);
      }

      if (!res.ok || body.ok === false) {
        // Every refusal names ITSELF. A generic "the read failed" would send someone hunting
        // the wrong problem, which is the whole reason the server classifies 401 vs 403.
        setError(body.headline || body.detail || body.error || `The read failed (HTTP ${res.status}).`);
        if (body.points_at) setNote(`Points at: ${body.points_at}`);
        else if (body.parse_error) setNote(body.parse_error);
        return;
      }
      setItems(body.items ?? []);
      if (body.parse_error) setNote(body.parse_error);
    } catch (e: any) {
      setError(`The read could not complete: ${String(e?.message ?? e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
      <p style={{ fontSize: '0.875rem', color: DARK, fontWeight: 700, margin: '0 0 4px' }}>
        QuickBooks item list
      </p>
      <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 12px', lineHeight: 1.5 }}>
        Reads the products and services in your QuickBooks company, so invoice lines can be
        matched to the right ones. Nothing is changed in QuickBooks and nothing is saved here —
        the full response downloads to this device.
      </p>

      <button
        onClick={() => void read()}
        disabled={loading || !businessId}
        style={{
          width: '100%', minHeight: 48, padding: '13px 20px',
          background: loading || !businessId ? '#e5e7eb' : GREEN,
          color: loading || !businessId ? GRAY : '#fff',
          fontWeight: 700, fontSize: '0.9375rem', borderRadius: 10, border: 'none',
          cursor: loading || !businessId ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Reading QuickBooks…' : 'Read item list'}
      </button>

      {savedAs && (
        <p style={{ fontSize: '0.8125rem', color: GREEN, margin: '10px 0 0', wordBreak: 'break-all' }}>
          ↓ Full response saved to your downloads folder as <strong>{savedAs}</strong>
        </p>
      )}
      {saveFailed && (
        // Surfaced, never silent: if the file did not save, the operator must know BEFORE they
        // close the tab and assume they have a copy.
        <p style={{ fontSize: '0.8125rem', color: RED, margin: '10px 0 0' }}>
          ⚠ The response could not be saved to a file — it is shown below, but it is not on disk.
        </p>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: `1px solid ${RED}`, borderRadius: 9 }}>
          <p style={{ fontSize: '0.8125rem', color: RED, margin: 0, lineHeight: 1.5 }}>{error}</p>
          {note && <p style={{ fontSize: '0.75rem', color: GRAY, margin: '6px 0 0' }}>{note}</p>}
        </div>
      )}

      {items && items.length === 0 && !error && (
        // EMPTY is its own surface and it says which of the two empties it is: the read
        // succeeded and the company has no items. It is never the rendering of a failed read.
        <p style={{ fontSize: '0.8125rem', color: GRAY, marginTop: 12 }}>
          The read succeeded and this QuickBooks company has no items on it.
        </p>
      )}

      {items && items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: '0.8125rem', color: GRAY, margin: '0 0 8px' }}>
            {items.length} item{items.length === 1 ? '' : 's'}
            {note ? ` · ${note}` : ''}
          </p>
          {/* Bounded scroll box so both scrollbars live on the box, not the page (§6 r14). */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 360, border: '1px solid #e5e7eb', borderRadius: 9 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Id', 'Name', 'Type', 'Income account', 'Active'].map(h => (
                    <th key={h} style={{ position: 'sticky', top: 0, background: '#f9fafb', textAlign: 'left', padding: '9px 11px', fontWeight: 700, color: DARK, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 11px', fontFamily: 'monospace', color: DARK }}>{it.id}</td>
                    <td style={{ padding: '9px 11px', color: DARK }}>{it.name}</td>
                    {/* A field QuickBooks did not send reads "Not set" — never a blank cell that
                        looks like a rendering bug, and never a plausible guess (D-9 / A9). */}
                    <td style={{ padding: '9px 11px', color: it.type ? DARK : '#9ca3af' }}>{it.type ?? 'Not set'}</td>
                    <td style={{ padding: '9px 11px', color: it.incomeAccount ? DARK : '#9ca3af' }}>{it.incomeAccount ?? 'Not set'}</td>
                    <td style={{ padding: '9px 11px', color: it.active === null ? '#9ca3af' : DARK }}>
                      {it.active === null ? 'Not set' : it.active ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
