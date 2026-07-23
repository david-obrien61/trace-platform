// ============================================================
// InventoryImport — the CSV catalog-import surface (/inventory/import) — desktop.
// ACCESS:       Reached from the inventory grid; gated by VIEW_COSTS (same as /inventory) so a
//               manager with inventory access can import QUANTITIES. BULK PRICE import is a
//               separate authority (`import_pricing`, David's ruling 2026-07-23) — defaults
//               owner-only, grantable to a manager on /team. Without it, prices are mapped and
//               shown in the plan but NOT written (the server refuses; the marker here is a
//               courtesy). NOT a price wall — a view_costs manager can already edit sell_price
//               one cell at a time on the grid; this gates the bulk write only.
// PURPOSE:      The SECOND HALF of onboarding: load a grower's price-list CSV, map its columns to
//               the catalog spine, review a per-row PLAN, and only on Accept write it — on-hand
//               through the D-50 ledger RPCs, price/attributes through the patch path. It is its
//               OWN door: it does NOT touch ReceiptKeeper and is not reachable from "Snap a
//               receipt" (2026-06-21 record §2.6 — a CSV import is a separate Import surface).
// CONTRACT:     Two steps, NOTHING written until Accept — the same contract as /inventory/reconcile,
//               which is why that screen was provable. HELD rows (AMBIGUOUS / CONFLICT / REFUSED)
//               are excluded from the Accept count until the owner resolves them in place.
// DEPENDENCIES: @trace/shared/import (parse · map · resolve — all PURE), importWrites (the writes),
//               stockLineResolver (the catalog SELECT), useBusinessContext, supabase.
// NO SCHEMA:    the 20260723 columns are applied separately; ZERO new api function (parse in the
//               browser, resolve in a pure module, write through existing RPCs).
// INSTRUMENTATION (STD-003): `[TRACE:IMPORT]` on parse, map, plan, accept — ON by default.
// ============================================================
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ArrowLeft, Check, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { sheetStyles as SS } from '../components/datasheet/DataSheet';
import {
  parseCsv, mapColumns, duplicateSpineTargets, projectRows, resolveImportPlan, planAgainstLot,
  type ColumnMapping, type MapTarget, type MappedRow, type ImportRowPlan, type ImportVerdict,
} from '@trace/shared/import';
import { STOCK_LINE_IMPORT_COLUMNS, type StockLineRow } from '@trace/shared/inventory/stockLineResolver';
import { applyImportPlan, type ExecWrite, type ApplyResult } from './importWrites';

type Step = 'upload' | 'map' | 'plan' | 'done';

const TARGET_OPTIONS: { value: MapTarget; label: string }[] = [
  { value: 'name', label: 'Plant name' },
  { value: 'size', label: 'Size / container' },
  { value: 'qty', label: 'Quantity on hand' },
  { value: 'sell_price', label: 'Sell price' },
  { value: 'sku', label: 'Item # / SKU' },
  { value: 'attribute', label: 'Keep as a note (attribute)' },
  { value: 'ignore', label: 'Ignore this column' },
];
const RUNG_LABEL: Record<ColumnMapping['rung'], string> = {
  exact: 'exact match', synonym: 'known synonym', shape: 'guessed from the values', unmapped: 'no match',
};
const BASIS_OPTIONS = ['each', 'per tree', 'per foot of height', 'per caliper inch', 'per gallon', 'per flat'];

const VERDICT_STYLE: Record<ImportVerdict, { bg: string; fg: string }> = {
  FILL:      { bg: '#dcfce7', fg: '#166534' },
  UPDATE:    { bg: '#dbeafe', fg: '#1e40af' },
  CREATE:    { bg: '#e0e7ff', fg: '#3730a3' },
  AMBIGUOUS: { bg: '#fef3c7', fg: '#92400e' },
  CONFLICT:  { bg: '#fee2e2', fg: '#b91c1c' },
  REFUSED:   { bg: '#f3f4f6', fg: '#6b7280' },
};

interface RowChoice { include: boolean; overwrite: boolean; pickedLotId: string | null }

export function InventoryImport() {
  const { businessId, can } = useBusinessContext();
  const navigate = useNavigate();

  // Bulk price import is a grantable authority (import_pricing). Owner ⇒ can() short-circuits true.
  // A manager without it can still import quantities; price columns are shown as won't-be-saved.
  // This is a COURTESY marker only — the server (import_write_price) is the authority.
  const canImportPricing = can('import_pricing');

  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fileName, setFileName] = useState('');
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [basis, setBasis] = useState<string>('');          // '' = not chosen; DONT_KNOW = explicit null
  const DONT_KNOW = '__dont_know__';

  const [catalog, setCatalog] = useState<StockLineRow[]>([]);
  const [countedIds, setCountedIds] = useState<Set<string>>(new Set());
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [plan, setPlan] = useState<ImportRowPlan[]>([]);
  const [choices, setChoices] = useState<Record<number, RowChoice>>({});
  const [result, setResult] = useState<ApplyResult | null>(null);

  // ── STEP: upload ────────────────────────────────────────────────────────────────
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) { setError('That file has no readable header row.'); return; }
      if (parsed.rows.length === 0) { setError('That file has a header but no data rows.'); return; }
      const sample = parsed.headers.map((_, i) => parsed.rows.map(r => r[i] ?? ''));
      console.log('[TRACE:IMPORT] parsed', { file: file.name, headers: parsed.headers.length, rows: parsed.rows.length });
      setFileName(file.name);
      setDataRows(parsed.rows);
      setMappings(mapColumns(parsed.headers, sample));
      setStep('map');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  function setTarget(index: number, target: MapTarget) {
    // Any explicit pick confirms the column — a proposed (guessed) mapping is no longer pending.
    setMappings(ms => ms.map(m => m.index === index
      ? { ...m, target, rung: m.rung === 'shape' && target === m.target ? 'shape' : (m.rung), proposed: false } : m));
  }
  function confirmProposed(index: number) {
    setMappings(ms => ms.map(m => m.index === index ? { ...m, proposed: false } : m));
  }

  const dupTargets = useMemo(() => duplicateSpineTargets(mappings), [mappings]);
  const hasName = mappings.some(m => m.target === 'name' && !m.proposed);
  const basisChosen = basis !== '';
  // A price column is mapped but this member cannot bulk-import prices → they won't be written.
  const priceMapped = mappings.some(m => m.target === 'sell_price' && !m.proposed);
  const priceWontWrite = priceMapped && !canImportPricing;

  // ── STEP: map → plan ──────────────────────────────────────────────────────────────
  async function buildPlan() {
    if (dupTargets.length > 0) { setError(`Two columns are mapped to the same field: ${dupTargets.join(', ')}. Pick one.`); return; }
    if (!hasName) { setError('Map one column to Plant name — an import needs a name per row.'); return; }
    if (!basisChosen) { setError('Answer the price-basis question once below (or choose "I don\'t know").'); return; }
    if (!businessId) { setError('No business in context — reload and try again.'); return; }
    setBusy(true); setError(null);
    try {
      const fileBasis = basis === DONT_KNOW ? null : basis;
      const rows = projectRows(dataRows, mappings, fileBasis);

      // The tenant's catalog (business_id-scoped — RLS + explicit filter, AC-3).
      const { data: cat, error: catErr } = await supabase
        .from('business_inventory').select(STOCK_LINE_IMPORT_COLUMNS)
        .eq('business_id', businessId).neq('status', 'deleted');
      if (catErr) throw new Error(catErr.message);
      const catalogRows = (cat ?? []) as unknown as StockLineRow[];

      // Which lots carry a PHYSICAL count (a count_reconcile ledger event) — the CONFLICT signal.
      const { data: led } = await supabase
        .from('business_inventory_ledger').select('inventory_id')
        .eq('business_id', businessId).eq('kind', 'count_reconcile');
      const counted = new Set<string>(((led ?? []) as Array<{ inventory_id: string | null }>)
        .map(r => r.inventory_id).filter((x): x is string => !!x));

      const p = resolveImportPlan({ rows, catalog: catalogRows, countedLotIds: counted });
      const init: Record<number, RowChoice> = {};
      for (const r of p.rows) init[r.rowIndex] = { include: true, overwrite: false, pickedLotId: null };
      console.log('[TRACE:IMPORT] plan', { file: fileName, counts: p.counts, held: p.rows.filter(r => ['AMBIGUOUS', 'CONFLICT', 'REFUSED'].includes(r.verdict)).map(r => r.rowIndex) });

      setCatalog(catalogRows); setCountedIds(counted); setMappedRows(rows);
      setPlan(p.rows); setChoices(init); setStep('plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the plan.');
    } finally { setBusy(false); }
  }

  // Turn the plan + the owner's per-row choices into the exact writes to execute.
  const writes = useMemo<ExecWrite[]>(() => {
    const out: ExecWrite[] = [];
    for (const p of plan) {
      const c = choices[p.rowIndex];
      if (!c) continue;
      if (p.verdict === 'REFUSED') continue;
      if (p.verdict === 'CREATE' && c.include && p.create) {
        out.push({ op: 'create', rowIndex: p.rowIndex, name: p.create.name, size: p.create.size, variantGroup: p.create.variantGroup, sku: p.create.sku, qty: p.qtyTo ?? null, patch: p.patch, regroup: p.create.regroup });
      } else if ((p.verdict === 'FILL' || p.verdict === 'UPDATE') && c.include && p.lotId) {
        out.push({ op: 'setLot', rowIndex: p.rowIndex, lotId: p.lotId, newQty: p.qtyChanges ? (p.qtyTo ?? null) : null, patch: p.patch });
      } else if (p.verdict === 'CONFLICT' && c.overwrite && p.lotId) {
        out.push({ op: 'setLot', rowIndex: p.rowIndex, lotId: p.lotId, newQty: p.qtyTo ?? null, patch: p.patch });
      } else if (p.verdict === 'AMBIGUOUS' && c.pickedLotId) {
        const lot = catalog.find(l => l.id === c.pickedLotId);
        const row = mappedRows.find(m => m.rowIndex === p.rowIndex);
        if (!lot || !row) continue;
        const r = planAgainstLot(row, lot, countedIds);
        if (r.verdict === 'CONFLICT' && !c.overwrite) continue;   // picked a counted lot → needs overwrite too
        out.push({ op: 'setLot', rowIndex: p.rowIndex, lotId: r.lotId!, newQty: (r.qtyChanges || r.verdict === 'CONFLICT') ? (r.qtyTo ?? null) : null, patch: r.patch });
      }
    }
    return out;
  }, [plan, choices, catalog, mappedRows, countedIds]);

  async function accept() {
    if (!businessId) return;
    setBusy(true); setError(null);
    console.log('[TRACE:IMPORT] accept', { writes: writes.length, file: fileName });
    const res = await applyImportPlan(writes, { businessId, fileName });
    setResult(res);
    setStep('done');
    setBusy(false);
  }

  // ── render ────────────────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <div style={hdr}>
        <button style={SS.addBtn} onClick={() => navigate('/inventory')}><ArrowLeft size={16} /> Inventory</button>
        <h1 style={pageTitle}>Import a catalog (CSV)</h1>
      </div>

      {error && <div style={SS.error}>{error}</div>}

      {priceWontWrite && (step === 'map' || step === 'plan') && (
        <div style={priceNotice}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Prices won't be saved.</strong> A price column is mapped, but you don't have
            permission to import prices in bulk. Quantities and details will still import. Ask the
            owner to grant <strong>bulk price import</strong> on the Team page, then run the file again.
          </span>
        </div>
      )}

      {step === 'upload' && (
        <div style={card}>
          <p style={{ color: '#374151', marginTop: 0 }}>
            Upload a grower price list as a <strong>.csv</strong> file. You'll map its columns and
            review every row before anything is saved. One file at a time.
          </p>
          <label style={{ ...SS.primaryBtn, display: 'inline-flex', cursor: 'pointer' }}>
            <Upload size={16} /> Choose a CSV file
            <input type="file" accept=".csv,text/csv" onChange={e => void onFile(e)} style={{ display: 'none' }} />
          </label>
        </div>
      )}

      {step === 'map' && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#374151' }}>
              <FileText size={16} /> <strong>{fileName}</strong> — {dataRows.length} rows. Step 1 of 2: map the columns.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={mapTh}>Their column</th><th style={mapTh}>Example</th>
                  <th style={mapTh}>Maps to</th><th style={mapTh}>Why</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m.index}>
                    <td style={mapTd}><strong>{m.header || <em style={{ color: '#9ca3af' }}>(blank)</em>}</strong></td>
                    <td style={{ ...mapTd, color: '#6b7280' }}>{m.sample.slice(0, 2).join(', ') || '—'}</td>
                    <td style={mapTd}>
                      <select value={m.target} onChange={e => setTarget(m.index, e.target.value as MapTarget)} style={inlineSel}>
                        {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={mapTd}>
                      {m.proposed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#92400e' }}>
                          <AlertTriangle size={13} /> guessed —
                          <button onClick={() => confirmProposed(m.index)} style={confirmBtn}>confirm</button>
                        </span>
                      ) : m.loadBearing ? (
                        <span style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <AlertTriangle size={13} /> looks like money — kept as a note, nothing computes on it
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>{RUNG_LABEL[m.rung]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dupTargets.length > 0 && <div style={{ ...SS.error, marginTop: 12, marginBottom: 0 }}>Two columns map to: {dupTargets.join(', ')}. Pick one for each.</div>}
          </div>

          <div style={card}>
            <label style={SS.label}>What does each price apply to? <span style={{ color: '#6b7280', fontWeight: 400 }}>(asked once, for the whole file)</span></label>
            <select value={basis} onChange={e => setBasis(e.target.value)} style={SS.select}>
              <option value="">Choose one…</option>
              {BASIS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              <option value={DONT_KNOW}>I don't know — leave it blank</option>
            </select>
            {basis === DONT_KNOW && <p style={{ ...SS.muted, marginBottom: 0, marginTop: 8 }}>Prices will be saved without a unit. That's honest — not a guess.</p>}
          </div>

          <button style={busy ? SS.submitBtnDisabled : SS.submitBtn} disabled={busy} onClick={() => void buildPlan()}>
            {busy ? 'Reading your catalog…' : 'Preview the plan →'}
          </button>
        </>
      )}

      {step === 'plan' && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              {(['CREATE', 'UPDATE', 'FILL', 'AMBIGUOUS', 'CONFLICT', 'REFUSED'] as ImportVerdict[]).map(v => {
                const n = plan.filter(p => p.verdict === v).length;
                if (n === 0) return null;
                return <span key={v} style={{ ...chip, background: VERDICT_STYLE[v].bg, color: VERDICT_STYLE[v].fg }}>{n} {v.toLowerCase()}</span>;
              })}
            </div>
            <p style={{ ...SS.muted, margin: 0 }}>Step 2 of 2. Nothing is saved until you Accept. Held rows (amber / red) don't count until you resolve them.</p>
          </div>

          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr><th style={mapTh}></th><th style={mapTh}>Row</th><th style={mapTh}>What happens</th></tr>
              </thead>
              <tbody>
                {plan.map(p => {
                  const c = choices[p.rowIndex];
                  const vs = VERDICT_STYLE[p.verdict];
                  return (
                    <tr key={p.rowIndex}>
                      <td style={{ ...mapTd, width: 24 }}>
                        {(p.verdict === 'CREATE' || p.verdict === 'UPDATE' || p.verdict === 'FILL') && (
                          <input type="checkbox" checked={c?.include ?? true} onChange={e => setChoices(s => ({ ...s, [p.rowIndex]: { ...s[p.rowIndex], include: e.target.checked } }))} />
                        )}
                      </td>
                      <td style={{ ...mapTd, whiteSpace: 'normal' }}>
                        <div><strong>{p.name || <em style={{ color: '#9ca3af' }}>(no name)</em>}</strong>{p.size ? ` · ${p.size}` : ''}</div>
                        <span style={{ ...chip, background: vs.bg, color: vs.fg, fontSize: '0.7rem' }}>{p.verdict}</span>
                      </td>
                      <td style={{ ...mapTd, whiteSpace: 'normal', color: '#374151' }}>
                        <div>{p.reason}</div>
                        {p.fieldDeltas.length > 0 && (
                          <div style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: 2 }}>
                            {p.fieldDeltas.map(d => `${d.field}: ${d.from ?? '—'} → ${d.to ?? '—'}`).join('  ·  ')}
                          </div>
                        )}
                        {p.verdict === 'AMBIGUOUS' && (
                          <div style={{ marginTop: 6 }}>
                            <select value={c?.pickedLotId ?? ''} onChange={e => setChoices(s => ({ ...s, [p.rowIndex]: { ...s[p.rowIndex], pickedLotId: e.target.value || null } }))} style={inlineSel}>
                              <option value="">Pick a size / skip…</option>
                              {(p.candidates ?? []).map(cd => <option key={cd.lotId} value={cd.lotId}>{cd.size ?? '(no size)'}</option>)}
                            </select>
                          </div>
                        )}
                        {p.verdict === 'CONFLICT' && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#b91c1c' }}>
                            <input type="checkbox" checked={c?.overwrite ?? false} onChange={e => setChoices(s => ({ ...s, [p.rowIndex]: { ...s[p.rowIndex], overwrite: e.target.checked } }))} />
                            Overwrite the physical count with {p.qtyTo}
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button style={busy || writes.length === 0 ? SS.submitBtnDisabled : SS.submitBtn} disabled={busy || writes.length === 0} onClick={() => void accept()}>
            {busy ? 'Saving…' : `Accept ${writes.length} row${writes.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}

      {step === 'done' && result && (
        <div style={card}>
          <div style={result.failed === 0 ? SS.success : SS.error}>
            <Check size={16} style={{ verticalAlign: 'middle' }} /> {result.applied} row{result.applied === 1 ? '' : 's'} saved
            {result.failed > 0 && `, ${result.failed} failed`}.
          </div>
          {result.outcomes.filter(o => !o.ok).length > 0 && (
            <ul style={{ color: '#b91c1c', fontSize: '0.85rem' }}>
              {result.outcomes.filter(o => !o.ok).map(o => <li key={o.rowIndex}>Row {o.rowIndex}: {o.detail}</li>)}
            </ul>
          )}
          {/* Rows that saved but whose PRICE was held (permission) — surfaced honestly, not swallowed. */}
          {result.outcomes.filter(o => o.ok && /held|prices not saved/i.test(o.detail)).length > 0 && (
            <div style={{ ...priceNotice, marginTop: 12 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Quantities and details saved, but <strong>prices were not written</strong> on
                {' '}{result.outcomes.filter(o => o.ok && /held|prices not saved/i.test(o.detail)).length} row(s)
                {' '}— bulk price import needs the owner's permission (Team page).</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={SS.primaryBtn} onClick={() => navigate('/inventory')}>Back to inventory</button>
            <button style={SS.addBtn} onClick={() => { setStep('upload'); setResult(null); setPlan([]); setError(null); }}>Import another</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Local layout styles — sheetStyles (SS) is modal/form-scoped; the import surface is a full page,
// so page/header/title/card/inlineSelect are defined here (mirrors the DataSheet page styles).
const page: React.CSSProperties = { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' };
const hdr: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' };
const pageTitle: React.CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '1.25rem', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
const inlineSel: React.CSSProperties = { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 5px', fontSize: '0.82rem', color: '#111827', background: '#fff', cursor: 'pointer', maxWidth: 200 };
const mapTh: React.CSSProperties = { textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' };
const mapTd: React.CSSProperties = { padding: '0.45rem 0.5rem', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'top', whiteSpace: 'nowrap' };
const chip: React.CSSProperties = { display: 'inline-block', borderRadius: 6, padding: '2px 7px', fontSize: '0.75rem', fontWeight: 700, marginTop: 3 };
const confirmBtn: React.CSSProperties = { background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 6, padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' };
const priceNotice: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: 16, fontSize: '0.88rem', lineHeight: 1.45 };
