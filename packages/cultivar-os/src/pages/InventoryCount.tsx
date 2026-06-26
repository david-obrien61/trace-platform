// ============================================================
// InventoryCount — the walk-and-count loop (scan → resolve → qty → save → next → complete).
// PURPOSE:  Lauren walks the lot, scans a plant tag QR, the app strips the URL and
//           resolves the item, she enters the counted qty, Save→Next reopens the
//           camera; Complete ends the session. One item at a time, full focus (D-21).
// DEPENDENCIES: QrScanner (jsQR camera), business_inventory (on-hand qty), cultivar_plants
//           (tag→identity→lot), inventory_count_sessions + inventory_counts (durable record,
//           gated migration 20260626 — degrades gracefully if not yet applied).
// OUTPUTS:  SETS business_inventory.qty for the resolved lot; records each count in
//           inventory_counts under a session. [TRACE:COUNT] on every step.
// SCOPE:    count loop ONLY. Reconciliation (counted vs expected) is DEFERRED.
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, X, ScanLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { QrScanner } from '../components/inventory/QrScanner';

const TRACE_COUNT = true; // [TRACE:COUNT] STD-003 — on until OWNER-PROVEN

type Phase = 'idle' | 'scanning' | 'reviewing' | 'unknown' | 'done';

interface Resolved {
  inventoryId: string | null;   // the business_inventory lot to set qty on (null = no linked lot)
  plantTagId:  string | null;   // the scanned cultivar_plants.tag_id, if resolved via a plant tag
  label:       string;          // "Shoal Creek Vitex, 30 gal"
  currentQty:  number | null;   // current on-hand (prefilled into the qty input)
  rawScan:     string;          // the raw decoded string, for the count record
}

interface CountedItem { label: string; qty: number; unknown: boolean; }

// Scanned QR holds a URL like https://…/plant/SCV-0031 — strip the URL, keep the tag.
function extractTag(raw: string): string {
  const trimmed = raw.trim();
  const m = trimmed.match(/\/plant\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  // Not a /plant/ URL — if it's any other URL, take the last path segment; else use as-is.
  try {
    const u = new URL(trimmed);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length) return decodeURIComponent(segs[segs.length - 1]);
  } catch { /* not a URL — a bare code */ }
  return trimmed;
}

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST204') return true;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find the table');
}

export function InventoryCount() {
  const navigate = useNavigate();
  const { businessId } = useBusinessContext();

  const [phase, setPhase]         = useState<Phase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tablesAbsent, setTablesAbsent] = useState(false); // migration not yet applied — degrade
  const [resolved, setResolved]   = useState<Resolved | null>(null);
  const [qtyInput, setQtyInput]   = useState('');
  const [unknownRaw, setUnknownRaw] = useState('');
  const [unknownTag, setUnknownTag] = useState('');
  const [unknownLabel, setUnknownLabel] = useState('');
  const [counted, setCounted]     = useState<CountedItem[]>([]);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── START ─────────────────────────────────────────────────
  async function startCount() {
    if (!businessId) return;
    setBusy(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error: insErr } = await supabase
      .from('inventory_count_sessions')
      .insert({ business_id: businessId, status: 'in_progress', counted_by: user?.id ?? null })
      .select('id')
      .single();

    if (insErr) {
      if (isMissingTable(insErr)) {
        // Deploy window: migration 20260626 not applied yet. On-hand updates still work;
        // count records are skipped with a loud warning until David applies the migration.
        if (TRACE_COUNT) console.warn('[TRACE:COUNT] session start — count tables ABSENT (apply migration 20260626); on-hand will update without an audit record');
        setTablesAbsent(true);
        setSessionId(null);
      } else {
        setError(insErr.message); setBusy(false); return;
      }
    } else {
      setSessionId(data!.id);
      if (TRACE_COUNT) console.log('[TRACE:COUNT] session start —', data!.id);
    }
    setCounted([]);
    setPhase('scanning');
    setBusy(false);
  }

  // ── RESOLVE (after a scan) ────────────────────────────────
  async function handleScan(raw: string) {
    if (!businessId) return;
    const tag = extractTag(raw);
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolve attempt — raw:', raw, 'tag:', tag);

    // (1) Plant tag → identity + linked lot.
    const { data: plant } = await supabase
      .from('cultivar_plants')
      .select('id, common_name, species, current_container, inventory_id, business_inventory ( id, name, sku, qty )')
      .eq('business_id', businessId)
      .ilike('tag_id', tag)
      .maybeSingle();

    if (plant) {
      const lot = (plant as any).business_inventory as { id: string; name: string; sku: string | null; qty: number } | null;
      const name = (plant as any).common_name || (plant as any).species || 'Plant';
      const size = (plant as any).current_container;
      const label = size ? `${name}, ${size}` : name;
      const r: Resolved = {
        inventoryId: lot?.id ?? (plant as any).inventory_id ?? null,
        plantTagId:  tag,
        label,
        currentQty:  lot?.qty ?? null,
        rawScan:     raw,
      };
      openReview(r);
      return;
    }

    // (2) Fall back to an inventory SKU (some QRs encode a SKU, not a plant tag).
    const { data: lot } = await supabase
      .from('business_inventory')
      .select('id, name, sku, qty')
      .eq('business_id', businessId)
      .ilike('sku', tag)
      .maybeSingle();

    if (lot) {
      openReview({
        inventoryId: (lot as any).id,
        plantTagId:  null,
        label:       (lot as any).name + ((lot as any).sku ? ` (SKU ${(lot as any).sku})` : ''),
        currentQty:  (lot as any).qty ?? null,
        rawScan:     raw,
      });
      return;
    }

    // (3) Unknown — don't dead-end the loop.
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolve UNKNOWN — tag:', tag);
    setUnknownRaw(raw);
    setUnknownTag(tag);
    setUnknownLabel('');
    setPhase('unknown');
  }

  function openReview(r: Resolved) {
    setResolved(r);
    setQtyInput(r.currentQty != null ? String(r.currentQty) : '');
    setError(null);
    setPhase('reviewing');
    if (TRACE_COUNT) console.log('[TRACE:COUNT] resolved —', r.label, 'lot:', r.inventoryId, 'currentQty:', r.currentQty);
  }

  // ── SAVE → NEXT (known item) ──────────────────────────────
  async function saveAndNext() {
    if (!resolved || !businessId) return;
    const qty = parseInt(qtyInput, 10);
    if (isNaN(qty) || qty < 0) { setError('Enter a count of 0 or more.'); return; }
    setBusy(true); setError(null);

    // (i) SET the on-hand for the resolved lot (a physical count sets on-hand).
    if (resolved.inventoryId) {
      const { error: upErr } = await supabase
        .from('business_inventory')
        .update({ qty })
        .eq('id', resolved.inventoryId)
        .eq('business_id', businessId);
      if (upErr) { setError(`Couldn't update on-hand: ${upErr.message}`); setBusy(false); return; }
    }

    // (ii) Record the durable count (skipped only in the pre-migration deploy window).
    await recordCount({
      inventory_id: resolved.inventoryId,
      plant_tag_id: resolved.plantTagId,
      item_label:   resolved.label,
      counted_qty:  qty,
      was_unknown:  false,
      raw_scan:     resolved.rawScan,
    });

    if (TRACE_COUNT) console.log('[TRACE:COUNT] save —', resolved.label, 'qty:', qty, 'lot:', resolved.inventoryId);
    setCounted(c => [...c, { label: resolved.label, qty, unknown: false }]);
    setResolved(null);
    setQtyInput('');
    setBusy(false);
    setPhase('scanning'); // → next
  }

  // ── UNKNOWN branch: enter quickly, or skip & flag ─────────
  async function saveUnknown(withLabel: boolean) {
    if (!businessId) return;
    setBusy(true); setError(null);
    let qty = 0;
    let label = `Unrecognized — flagged (${unknownTag})`;
    if (withLabel) {
      if (!unknownLabel.trim()) { setError('Enter a variety/size, or choose Skip & flag.'); setBusy(false); return; }
      qty = parseInt(qtyInput, 10);
      if (isNaN(qty) || qty < 0) { setError('Enter a count of 0 or more.'); setBusy(false); return; }
      label = unknownLabel.trim();
    }

    await recordCount({
      inventory_id: null,            // no lot — unknown items aren't auto-created (intake's job)
      plant_tag_id: unknownTag || null,
      item_label:   label,
      counted_qty:  qty,
      was_unknown:  true,
      raw_scan:     unknownRaw,
    });

    if (TRACE_COUNT) console.log('[TRACE:COUNT] save UNKNOWN —', label, 'qty:', qty, 'flaggedOnly:', !withLabel);
    setCounted(c => [...c, { label, qty, unknown: true }]);
    setUnknownLabel(''); setUnknownTag(''); setUnknownRaw(''); setQtyInput('');
    setBusy(false);
    setPhase('scanning'); // → next
  }

  // Shared insert into inventory_counts + session item_count bump (graceful if tables absent).
  async function recordCount(row: {
    inventory_id: string | null; plant_tag_id: string | null; item_label: string;
    counted_qty: number; was_unknown: boolean; raw_scan: string;
  }) {
    if (tablesAbsent || !sessionId) {
      if (TRACE_COUNT) console.warn('[TRACE:COUNT] count record SKIPPED (tables absent / no session) — on-hand only:', row.item_label);
      return;
    }
    const { error: insErr } = await supabase.from('inventory_counts').insert({
      session_id: sessionId, business_id: businessId, ...row,
    });
    if (insErr) {
      if (isMissingTable(insErr)) { setTablesAbsent(true); return; }
      // A real failure to record is worth surfacing, but the on-hand already moved — log loudly.
      if (TRACE_COUNT) console.error('[TRACE:COUNT] count record FAILED —', insErr.message);
      return;
    }
    await supabase
      .from('inventory_count_sessions')
      .update({ item_count: counted.length + 1 })
      .eq('id', sessionId);
  }

  // ── COMPLETE ──────────────────────────────────────────────
  async function complete() {
    setBusy(true);
    if (sessionId && !tablesAbsent) {
      await supabase
        .from('inventory_count_sessions')
        .update({ status: 'completed', completed_at: new Date().toISOString(), item_count: counted.length })
        .eq('id', sessionId);
    }
    if (TRACE_COUNT) console.log('[TRACE:COUNT] complete —', counted.length, 'items, session:', sessionId);
    setBusy(false);
    setPhase('done');
  }

  function exit() { navigate('/inventory'); }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={exit} aria-label="Back to inventory"><ArrowLeft size={22} color="#1a2e0a" /></button>
        <h1 style={S.title}>Walk &amp; count</h1>
        <div style={{ flex: 1 }} />
        {(phase === 'scanning' || phase === 'reviewing' || phase === 'unknown') && (
          <span style={S.tally}>{counted.length} counted</span>
        )}
      </div>

      {tablesAbsent && (phase !== 'idle' && phase !== 'done') && (
        <div style={S.warn}>Counting on-hand now. Audit history will record once the count tables are applied.</div>
      )}

      {/* IDLE — Start */}
      {phase === 'idle' && (
        <div style={S.card}>
          <ScanLine size={40} color="#27500A" style={{ marginBottom: 12 }} />
          <p style={S.lead}>Walk the lot and scan each plant tag. Enter how many you count, save, and move to the next. Hit Complete when you're done.</p>
          <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void startCount()}>
            {busy ? 'Starting…' : 'Start count'}
          </button>
        </div>
      )}

      {/* SCANNING / REVIEWING / UNKNOWN — camera stays mounted, sheets overlay */}
      {(phase === 'scanning' || phase === 'reviewing' || phase === 'unknown') && (
        <>
          <div style={S.card}>
            <QrScanner active={phase === 'scanning'} onScan={raw => void handleScan(raw)} />
          </div>
          <button style={S.completeBtn} onClick={() => void complete()} disabled={busy}>
            <CheckCircle2 size={18} /> Complete count{counted.length ? ` (${counted.length})` : ''}
          </button>
        </>
      )}

      {/* REVIEW sheet — resolved item + qty */}
      {phase === 'reviewing' && resolved && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) { setPhase('scanning'); setResolved(null); } }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>{resolved.label}</h2>
              <button style={S.iconBtn} onClick={() => { setPhase('scanning'); setResolved(null); }} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            {resolved.inventoryId == null && (
              <div style={S.note}>No stock lot is linked to this tag — your count is recorded, but there's no on-hand to update.</div>
            )}
            {resolved.currentQty != null && (
              <p style={S.subtle}>On-hand now: <strong>{resolved.currentQty}</strong></p>
            )}
            {error && <div style={S.error}>{error}</div>}
            <label style={S.label}>How many did you count?</label>
            <input
              style={S.qtyInput}
              type="number"
              inputMode="numeric"
              min="0"
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              autoFocus
            />
            <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void saveAndNext()}>
              {busy ? 'Saving…' : 'Save → Next'}
            </button>
          </div>
        </div>
      )}

      {/* UNKNOWN sheet */}
      {phase === 'unknown' && (
        <div style={S.modal}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={S.sheetTitle}>Didn't recognize this</h2>
              <button style={S.iconBtn} onClick={() => setPhase('scanning')} aria-label="Cancel"><X size={20} color="#6b7280" /></button>
            </div>
            <p style={S.subtle}>Scanned: <code style={S.code}>{unknownTag}</code></p>
            {error && <div style={S.error}>{error}</div>}
            <label style={S.label}>Enter variety &amp; size (optional)</label>
            <input
              style={S.input}
              value={unknownLabel}
              onChange={e => setUnknownLabel(e.target.value)}
              placeholder="e.g. Live Oak, 45 gal"
            />
            <label style={S.label}>Count</label>
            <input
              style={S.qtyInput}
              type="number"
              inputMode="numeric"
              min="0"
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
            />
            <button style={busy ? S.btnDisabled : S.btnPrimary} disabled={busy} onClick={() => void saveUnknown(true)}>
              {busy ? 'Saving…' : 'Save → Next'}
            </button>
            <button style={S.btnGhost} disabled={busy} onClick={() => void saveUnknown(false)}>
              Skip &amp; flag for later
            </button>
          </div>
        </div>
      )}

      {/* DONE */}
      {phase === 'done' && (
        <div style={S.card}>
          <CheckCircle2 size={40} color="#27500A" style={{ marginBottom: 12 }} />
          <h2 style={S.doneTitle}>Count complete</h2>
          <p style={S.lead}>{counted.length} {counted.length === 1 ? 'item' : 'items'} counted.</p>
          {counted.length > 0 && (
            <div style={S.summaryList}>
              {counted.map((c, i) => (
                <div key={i} style={S.summaryRow}>
                  <span style={c.unknown ? S.summaryLabelFlag : S.summaryLabel}>{c.label}</span>
                  <span style={S.summaryQty}>{c.qty}</span>
                </div>
              ))}
            </div>
          )}
          <button style={S.btnPrimary} onClick={exit}>Back to inventory</button>
        </div>
      )}
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 } as React.CSSProperties,
  backBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } as React.CSSProperties,
  title:      { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  tally:      { background: '#27500A', color: '#fff', borderRadius: 20, padding: '3px 12px', fontSize: '0.82rem', fontWeight: 700 } as React.CSSProperties,
  warn:       { background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '0.6rem 0.875rem', fontSize: '0.82rem', marginBottom: 12 } as React.CSSProperties,
  card:       { background: '#fff', borderRadius: 14, padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 14 } as React.CSSProperties,
  lead:       { color: '#374151', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.25rem' } as React.CSSProperties,
  btnPrimary: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  btnDisabled:{ width: '100%', minHeight: 48, background: '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 700, cursor: 'not-allowed' } as React.CSSProperties,
  btnGhost:   { width: '100%', minHeight: 44, background: 'none', color: '#6b7280', border: '1.5px solid #d1d5db', borderRadius: 10, fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', marginTop: 10 } as React.CSSProperties,
  completeBtn:{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 48, background: 'none', color: '#27500A', border: '2px solid #27500A', borderRadius: 10, fontSize: '0.98rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  modal:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet:      { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 560 } as React.CSSProperties,
  sheetHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' } as React.CSSProperties,
  sheetTitle: { fontSize: '1.15rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', padding: 4 } as React.CSSProperties,
  subtle:     { color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1rem' } as React.CSSProperties,
  note:       { background: '#eef2ff', color: '#3730a3', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: 12 } as React.CSSProperties,
  code:       { background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', fontSize: '0.82rem', color: '#374151' } as React.CSSProperties,
  label:      { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: 6 } as React.CSSProperties,
  input:      { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.7rem 0.85rem', fontSize: '1rem', color: '#111827', boxSizing: 'border-box', marginBottom: 14 } as React.CSSProperties,
  qtyInput:   { width: '100%', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.8rem 0.85rem', fontSize: '1.5rem', fontWeight: 700, color: '#111827', boxSizing: 'border-box', marginBottom: 16, textAlign: 'center' } as React.CSSProperties,
  error:      { color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.86rem', marginBottom: 12 } as React.CSSProperties,
  doneTitle:  { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: '0 0 0.5rem' } as React.CSSProperties,
  summaryList:{ textAlign: 'left', margin: '0 0 1.25rem', maxHeight: '40vh', overflowY: 'auto' } as React.CSSProperties,
  summaryRow: { display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  summaryLabel:    { color: '#111827', fontSize: '0.9rem' } as React.CSSProperties,
  summaryLabelFlag:{ color: '#92400e', fontSize: '0.9rem' } as React.CSSProperties,
  summaryQty: { fontWeight: 700, color: '#27500A', fontSize: '0.9rem' } as React.CSSProperties,
};
