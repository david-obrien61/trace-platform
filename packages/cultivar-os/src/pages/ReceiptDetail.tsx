// ============================================================
// ReceiptDetail — /receipts/:id — one receipt, every line, the document, and the owner's pencil.
//
// PURPOSE:      Without the lines, the Sudderth invoice is $1,301.98 of "Services". With them it
//               is 20.72 of something at $35.00 and 21.31 of something at $25.00 plus a card fee
//               — which is what the cost model actually consumes, and it could not be reached
//               from a list. `ProjectCostDrillIn`'s `openReceipt` has wanted this route since
//               before it existed.
//
//               Four things on one page: every line as read (with the quantity and the rate);
//               what the OCR originally read beside anything that differs; the document image;
//               and — for the OWNER only — a pencil, because a misread 20.72 that nobody can
//               correct becomes a permanent input to every cost derived from it.
//
// 🔴 AUTHORITY IS THE DATABASE'S, NOT THIS FILE'S. `isOwner` here decides what is RENDERED.
//    Whether an edit LANDS is decided by `edit_receipt_line_items` (owner check, SECURITY
//    DEFINER) and by `trg_receipts_snapshot_and_line_guard`, which refuses a non-owner's change
//    to `line_items` on ANY path including a direct PostgREST update that never loads this page.
//    This is not the `isOwner ||` bypass retired by the 2026-07-30 ruling — that was an OR that
//    WIDENED access past a permission check. This narrows, and the server is authoritative.
//
// UI STANDARD (§6 r16 — name the standard, then decide): the established pattern for "a record,
//    its line items, and an inline correction" is the DETAIL VIEW WITH AN EDITABLE TABLE and an
//    explicit edit mode (view → edit → save/cancel), as every invoicing product does it. Taken
//    as standard, with one deliberate addition: a REVISION COLUMN showing what the machine read
//    beside what is stored, which most products do not have because most products never banked
//    the original. We did, in June, and have never shown it.
//
// DEPENDENCIES: `../lib/receiptDetail` (every decision — the model, the field states, the preview
//               verdict, the vendor question) · `../lib/vendorKey` · `../lib/supabase` (one
//               select, one signed URL, two RPC/upsert writes — all RLS-enforced) ·
//               `useBusinessContext` (businessId + isOwner, for RENDERING) · `../utils/
//               receiptReconciliation` (the severity styles, via the model). No new api/
//               function — the 12/12 ceiling is untouched (§6 r11).
//
// OUTPUTS:      <ReceiptDetail /> at /receipts/:id, behind the same `costs:read` route gate as
//               /receipts.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import {
  RECEIPT_DETAIL_SELECT,
  receiptDetailModel,
  previewVerdict,
  vendorUnitQuestion,
  UNIT_ANSWERS,
  type RawReceiptDetailRow,
  type ReceiptDetailModel,
  type StoredLine,
  type StoredVendorPreference,
  type LineField,
} from '../lib/receiptDetail';
import { vendorKey } from '../lib/vendorKey';

const TRACE_RECEIPT_DETAIL = true; // [TRACE:receipt-detail] STD-003 — ON until David owner-proves

type ReadState =
  | { phase: 'loading' }
  | { phase: 'failed'; message: string }
  | { phase: 'loaded'; model: ReceiptDetailModel };

const PAGE: React.CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: '1rem' };
const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: '1.25rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
};
const H: React.CSSProperties = { fontSize: '1.125rem', fontWeight: 700, color: '#27500A', margin: 0 };
const META: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b' };
const LABEL: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6,
};
const NOTE: React.CSSProperties = { fontSize: '0.8125rem', color: '#64748b', marginTop: 4 };
const ABSENCE: React.CSSProperties = {
  fontSize: '0.8125rem', color: '#6b7280', background: '#f9fafb',
  border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px',
};
const WAS: React.CSSProperties = {
  fontSize: '0.75rem', color: '#92400e', background: '#fffbeb',
  border: '1px solid #fcd34d', borderRadius: 4, padding: '1px 6px', marginTop: 3,
  display: 'inline-block',
};
const BTN: React.CSSProperties = {
  minHeight: 48, padding: '0 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#27500A', color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
};
const BTN_GHOST: React.CSSProperties = {
  ...BTN, background: '#fff', color: '#27500A', border: '1px solid #27500A',
};
const INPUT: React.CSSProperties = {
  width: '100%', minHeight: 44, padding: '6px 8px', borderRadius: 6,
  border: '1px solid #cbd5e1', fontSize: '0.875rem', boxSizing: 'border-box',
};
const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: '#94a3b8', padding: '6px 8px', borderBottom: '1px solid #e5e7eb',
  position: 'sticky', top: 0, background: '#fff',
};
const TD: React.CSSProperties = { padding: '8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top', fontSize: '0.875rem' };

const COLUMNS: Array<{ field: LineField; head: string; numeric: boolean }> = [
  { field: 'description', head: 'Description', numeric: false },
  { field: 'quantity',    head: 'Quantity',    numeric: true  },
  { field: 'unit_price',  head: 'Rate',        numeric: true  },
  { field: 'amount',      head: 'Amount',      numeric: true  },
  { field: 'sku',         head: 'SKU',         numeric: false },
];

/** Editable buffer — strings, so a field can be genuinely EMPTY rather than zero. */
type Draft = Record<LineField, string>;

const draftFrom = (l: StoredLine): Draft => ({
  description: l.description == null ? '' : String(l.description),
  quantity:    l.quantity    == null ? '' : String(l.quantity),
  unit_price:  l.unit_price  == null ? '' : String(l.unit_price),
  amount:      l.amount      == null ? '' : String(l.amount),
  sku:         l.sku         == null ? '' : String(l.sku),
});

/**
 * A draft back to a stored line.
 *
 * 🔴 AN EMPTY FIELD BECOMES `null`, NEVER `0` AND NEVER `""`. "She may leave a material or a unit
 * unknown, and the cost reports as incomplete rather than computed from a guess" — a blank
 * quantity coerced to 0 would be a measurement nobody took.
 */
function storedFrom(d: Draft): StoredLine {
  const num = (v: string) => (v.trim() === '' ? null : (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null));
  return {
    description: d.description.trim(),
    quantity:    num(d.quantity),
    unit_price:  num(d.unit_price),
    amount:      num(d.amount),
    sku:         d.sku.trim() === '' ? null : d.sku.trim(),
  };
}

export function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const { businessId, isOwner } = useBusinessContext();

  const [state, setState]       = useState<ReadState>({ phase: 'loading' });
  const [imgUrl, setImgUrl]     = useState<string | null>(null);
  const [imgErr, setImgErr]     = useState<string | null>(null);
  const [pref, setPref]         = useState<StoredVendorPreference | null>(null);
  const [editing, setEditing]   = useState(false);
  const [drafts, setDrafts]     = useState<Draft[]>([]);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);

  // ── the read ────────────────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id || !businessId) return;
    setState({ phase: 'loading' });
    if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] read start', { id, businessId });

    const { data, error } = await supabase
      .from('receipts')
      .select(RECEIPT_DETAIL_SELECT)
      .eq('id', id)
      .eq('business_id', businessId)   // AC-3: another tenant's receipt is NOT FOUND, never shown
      .maybeSingle();

    if (error) {
      if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] read FAILED', error.message);
      setState({ phase: 'failed', message: error.message });
      return;
    }
    if (!data) {
      setState({ phase: 'failed', message: 'No receipt with that id exists for this business.' });
      return;
    }

    const model = receiptDetailModel(data as unknown as RawReceiptDetailRow);
    if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] read ok', {
      id, lines: model.lines.length, legacyShape: model.legacyShape,
      image: model.image.kind, banked: (data as any).reconcile_status,
    });
    setState({ phase: 'loaded', model });
    setDrafts(model.editableLines.map(draftFrom));   // seeded, not stored — see editableLines

    // ── the document. A private bucket, so a signed URL — the receipts_storage_select policy
    //    has existed since 2026-06-13 and NOTHING has ever used it until now.
    if (model.image.path) {
      const { data: signed, error: sErr } = await supabase.storage
        .from('receipts').createSignedUrl(model.image.path, 60 * 10);
      if (sErr) { setImgErr(sErr.message); setImgUrl(null); }
      else { setImgUrl(signed?.signedUrl ?? null); setImgErr(null); }
    }

    // ── the standing vendor answer, if one was ever given
    const vk = vendorKey((data as any).vendor);
    if (vk) {
      const { data: p } = await supabase
        .from('vendor_preferences')
        .select('vendor_key, vendor_label, preference_kind, preference_value, preference_note, answered_at')
        .eq('business_id', businessId).eq('vendor_key', vk).eq('preference_kind', 'billing_unit')
        .maybeSingle();
      setPref((p as StoredVendorPreference) ?? null);
    }
  }, [id, businessId]);

  useEffect(() => { void load(); }, [load]);

  const model = state.phase === 'loaded' ? state.model : null;

  const preview = useMemo(
    () => (model && editing ? previewVerdict(drafts.map(storedFrom), model.amountValue) : null),
    [model, editing, drafts],
  );

  const question = useMemo(
    () => (model ? vendorUnitQuestion(model.vendorText === 'Vendor not recorded' ? null : model.vendorText, pref) : null),
    [model, pref],
  );

  // ── the write ───────────────────────────────────────────────────────────────────────────────
  async function save(acknowledge: boolean) {
    if (!model) return;
    setSaving(true); setSaveErr(null); setNotice(null);
    const payload = drafts.map(storedFrom);
    if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] edit submit', {
      id: model.id, lines: payload.length, acknowledge,
    });

    const { data, error } = await supabase.rpc('edit_receipt_line_items', {
      p_receipt_id: model.id,
      p_line_items: payload,
      p_acknowledged_mismatch: acknowledge,
    });

    setSaving(false);
    if (error) {
      // The server's refusal is shown VERBATIM. A large mismatch, a non-owner, a line with no
      // description — each says which, and none of them is flattened into "could not save".
      if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] edit REFUSED', error.message);
      setSaveErr(error.message);
      return;
    }
    if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] edit saved', data);
    const changed = (data as any)?.change_count ?? 0;
    setNotice(changed === 0
      ? 'Saved. Nothing on any line was different, so nothing changed.'
      : `Saved — ${changed} ${changed === 1 ? 'value' : 'values'} changed, and the change is in the audit trail.`);
    setEditing(false);
    await load();
  }

  async function answerVendorUnit(value: string | null) {
    if (!model || !question?.vendorKey || !businessId) return;
    if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] vendor unit answer', { vendorKey: question.vendorKey, value });
    // 🔴 `.select('id')` IS LOAD-BEARING, NOT DECORATION. Without it a write REFUSED BY RLS returns
    // no error and no rows, and the page would report the answer saved while nothing was written —
    // which is exactly what a member holding `costs:read` but not `costs:update` would experience.
    // An empty result is treated as the failure it is (A8).
    const { data: written, error } = await supabase.from('vendor_preferences').upsert({
      business_id: businessId,
      vendor_key: question.vendorKey,
      vendor_label: question.vendorLabel,
      preference_kind: 'billing_unit',
      preference_value: value,
      preferred: true,
    }, { onConflict: 'business_id,vendor_key,preference_kind' }).select('id');

    if (error) { setSaveErr(error.message); return; }
    if (!written || written.length === 0) {
      if (TRACE_RECEIPT_DETAIL) console.log('[TRACE:receipt-detail] vendor unit answer REFUSED — zero rows written');
      setSaveErr('That answer was not saved — you do not have permission to change how this vendor bills.');
      return;
    }
    await load();
  }

  // ── render ──────────────────────────────────────────────────────────────────────────────────
  if (state.phase === 'loading') return <div style={PAGE}><div style={CARD}>Loading receipt…</div></div>;

  if (state.phase === 'failed') return (
    <div style={PAGE}><div style={CARD}>
      <div style={{ ...ABSENCE, color: '#A32D2D', background: '#fef2f2', borderColor: '#fca5a5' }}>
        Could not read this receipt — {state.message}. This is a failed read, not an empty one.
      </div>
      <Link to="/receipts" style={{ ...BTN_GHOST, display: 'inline-flex', alignItems: 'center', marginTop: 12, textDecoration: 'none' }}>
        Back to receipts
      </Link>
    </div></div>
  );

  const m = model!;

  return (
    <div style={PAGE}>
      <Link to="/receipts" style={{ ...META, display: 'inline-block', marginBottom: 8 }}>&lsaquo; All receipts</Link>

      {/* ── the header ─────────────────────────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={H}>{m.vendorText}</h1>
          <span style={{ fontWeight: 700, color: '#27500A', fontSize: '1.125rem' }}>{m.amountText}</span>
        </div>
        <div style={META}>{m.dateText} · {m.categoryText} · captured {m.capturedAtText}</div>

        <div style={{ ...LABEL, marginTop: 14 }}>What the reader recorded for this document</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={META}>Subtotal</div>
            {m.header.subtotalText
              ? <div style={{ fontWeight: 700 }}>{m.header.subtotalText}</div>
              : <div style={NOTE}>{m.header.subtotalNote}</div>}
          </div>
          <div>
            <div style={META}>Tax</div>
            {m.header.taxText
              ? <div style={{ fontWeight: 700 }}>{m.header.taxText}</div>
              : <div style={NOTE}>{m.header.taxNote}</div>}
          </div>
        </div>
        {/* Neither figure has a column on `receipts` (21 columns, measured) — both are read back
            out of the stored provider reply, and where that is unreadable the page says so
            instead of printing a zero that would look like a measurement. */}
        <div style={{ ...NOTE, marginTop: 8 }}>
          Tax also appears as a line below when the reader found one — the platform adds that line
          itself; it is not printed on the document.
        </div>
      </div>

      {/* ── the lines ──────────────────────────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={H}>Lines</h2>
          {!editing && isOwner && (
            <button style={BTN_GHOST} onClick={() => { setEditing(true); setSaveErr(null); setNotice(null); }}>
              Correct a line
            </button>
          )}
        </div>

        {!isOwner && (
          <div style={{ ...ABSENCE, marginTop: 8 }}>
            Only the business owner can change these lines. You are seeing them as saved.
          </div>
        )}

        {m.legacyShape && (
          <div style={{ ...ABSENCE, marginTop: 8 }}>
            This receipt was captured before the platform kept quantities and rates on the saved
            copy — it dropped them on save. The quantity and rate below are what the reader read.
          </div>
        )}

        {notice && <div style={{ ...ABSENCE, marginTop: 8, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>{notice}</div>}
        {saveErr && <div style={{ ...ABSENCE, marginTop: 8, background: '#fef2f2', borderColor: '#fca5a5', color: '#A32D2D' }}>{saveErr}</div>}

        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr>{COLUMNS.map(c => <th key={c.field} style={{ ...TH, textAlign: c.numeric ? 'right' : 'left' }}>{c.head}</th>)}</tr></thead>
            <tbody>
              {m.lines.length === 0 && (
                <tr><td colSpan={COLUMNS.length} style={TD}>
                  <span style={ABSENCE}>No line items were stored for this receipt.</span>
                </td></tr>
              )}
              {m.lines.map(line => {
                const draft = drafts[line.index];
                const deleted = draft === undefined;
                return (
                  <tr key={line.index}>
                    {COLUMNS.map(c => {
                      const f = line.fields[c.field];
                      return (
                        <td key={c.field} style={{ ...TD, textAlign: c.numeric ? 'right' : 'left' }}>
                          {editing && !deleted ? (
                            <input
                              style={{ ...INPUT, textAlign: c.numeric ? 'right' : 'left' }}
                              value={draft[c.field]}
                              inputMode={c.numeric ? 'decimal' : 'text'}
                              onChange={e => setDrafts(prev => prev.map((d, i) => i === line.index ? { ...d, [c.field]: e.target.value } : d))}
                            />
                          ) : (
                            <span>{f.currentText ?? <span style={{ color: '#94a3b8' }}>—</span>}</span>
                          )}

                          {/* 🔴 WHAT THE READER READ, WHERE IT DIFFERS. `line_items_original` has
                              been stored on every row since June and has never been shown. */}
                          {f.state === 'changed' && (
                            <div style={WAS}>reader read {f.originalText ?? 'nothing'}</div>
                          )}
                          {f.state === 'never-carried' && (
                            <div style={WAS}>reader read {f.originalText} — the saved copy never carried it</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {m.lines.map(line => line.originNote && (
          <div key={`o-${line.index}`} style={NOTE}>Line {line.index + 1}: {line.originNote}</div>
        ))}

        {/* ── the verdict ─────────────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed #e5e7eb' }}>
          <div style={LABEL}>{editing ? 'If you save this' : 'What the platform banked at save time'}</div>
          {editing ? (
            <>
              {preview?.readout && <div style={preview.readout.style}>{preview.readout.text}</div>}
              {preview?.incompleteNote && <div style={{ ...ABSENCE, marginTop: 6 }}>{preview.incompleteNote}</div>}
              {preview?.isLargeMismatch && (
                <div style={{ ...ABSENCE, marginTop: 6, background: '#fef2f2', borderColor: '#fca5a5', color: '#A32D2D' }}>
                  These lines no longer add up to the saved total. Saving records that you were
                  shown this and chose to save anyway — it will not be recorded as a match.
                </div>
              )}
              <div style={{ ...NOTE }}>
                A preview. The stored verdict is recomputed by the server when you save.
              </div>
            </>
          ) : (
            <>
              {m.bankedReadout && <div style={m.bankedReadout.style}>{m.bankedReadout.text}</div>}
              {m.bankedNotes.map((n, i) => <div key={i} style={NOTE}>{n}</div>)}
            </>
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button style={BTN} disabled={saving} onClick={() => void save(preview?.isLargeMismatch === true)}>
              {saving ? 'Saving…' : preview?.isLargeMismatch ? 'Save anyway' : 'Save changes'}
            </button>
            <button style={BTN_GHOST} disabled={saving} onClick={() => { setEditing(false); setDrafts(m.editableLines.map(draftFrom)); setSaveErr(null); }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── the vendor question ────────────────────────────────────────────────────────────── */}
      {question?.vendorKey && (
        <div style={CARD}>
          <div style={LABEL}>How this vendor bills</div>
          {question.answered ? (
            <>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{question.standingAnswerText}</div>
              <div style={NOTE}>Answered once. Every future invoice from this vendor uses it.</div>
              {isOwner && (
                <button style={{ ...BTN_GHOST, marginTop: 10 }} onClick={() => setPref(null)}>Change this</button>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{question.prompt}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {UNIT_ANSWERS.map(a => (
                  <button key={String(a.value)} style={BTN_GHOST} onClick={() => void answerVendorUnit(a.value)}>
                    {a.label}
                  </button>
                ))}
              </div>
              {/* Asked about the VENDOR, never about the number on this page — "is 20.72 yards or
                  tons?" comes back on every invoice forever; this comes back once. */}
              <div style={NOTE}>Asked once. Every future invoice from this vendor will use the answer.</div>
            </>
          )}
        </div>
      )}

      {/* ── the document ───────────────────────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={LABEL}>The document</div>
        {m.image.kind === 'none' && <div style={ABSENCE}>{m.image.note}</div>}
        {imgErr && <div style={{ ...ABSENCE, color: '#A32D2D', background: '#fef2f2', borderColor: '#fca5a5' }}>
          The document is stored but could not be opened — {imgErr}.
        </div>}
        {!imgErr && imgUrl && m.image.kind === 'image' && (
          <img src={imgUrl} alt="The captured receipt" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }} />
        )}
        {!imgErr && imgUrl && m.image.kind === 'pdf' && (
          <>
            {/* 8 of 36 captures are PDFs — including Sudderth, this surface's own worked example.
                An <img> with a .pdf source renders nothing and reports nothing. */}
            <iframe src={imgUrl} title="The captured receipt" style={{ width: '100%', height: 600, border: '1px solid #e5e7eb', borderRadius: 8 }} />
            <a href={imgUrl} target="_blank" rel="noreferrer" style={{ ...BTN_GHOST, display: 'inline-flex', alignItems: 'center', marginTop: 10, textDecoration: 'none' }}>
              Open the PDF
            </a>
          </>
        )}
      </div>
    </div>
  );
}
