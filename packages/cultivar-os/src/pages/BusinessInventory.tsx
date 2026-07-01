// ============================================================
// BusinessInventory — inventory DATASHEET (Cultivar OS) — board 5.1 reconcile surface
// PURPOSE:      The desktop-primary RECONCILE surface for business_inventory: an editable,
//               sortable, filterable, column-hideable grid — fix qty / name / size /
//               variant_group / location / unit_cost / status inline, on the correct row.
//               The count flow (InventoryCount.tsx) is the phone CAPTURE tool; this is the
//               desk RECONCILE tool (banked: capture=mobile, reconcile=desktop). Create still
//               happens via the "Add Item" bottom sheet.
// ENGINE:       Renders through the SHARED <DataSheet> engine (components/datasheet/DataSheet)
//               — the SAME engine /assets now uses (one engine, two configs). Search/sort/
//               column-hide/flag-highlight/expand all come from the engine; this file only
//               supplies the inventory column config + the fetch/write handlers + the Add sheet.
// DEPENDENCIES: supabase (business_inventory rows — per-row immediate UPDATE, UUID-keyed +
//               business_id-scoped), useBusinessContext (businessId → RLS scope), findDuplicateSizeGroups
//               from @trace/shared/discovery/dupSize (the CASE-5 (variant_group,size) dup detector,
//               reused as an inline amber flag), DataSheet cell components (TextCell/NumberCell/
//               AmountCell/SelectCell).
// OUTPUTS:      Per-field UPDATE on business_inventory (.eq('id', row.id).eq('business_id', businessId)
//               — never sku-keyed; sku is DISPLAY-ONLY). Manual unit_cost edit → cost_confidence=CONFIRMED
//               (overridable); clearing the cost → UNKNOWN (Surface Honesty coherence).
// GATE:         Inherits the /inventory VIEW_COSTS route gate + business_inventory RLS (owner_all +
//               member_all FOR ALL under view_costs). No schema / migration / RLS touched here.
// INSTRUMENTATION (STD-003): `[TRACE:invsheet]` on grid load + every inline write. ON BY DEFAULT.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Archive, ScanLine, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { findDuplicateSizeGroups } from '@trace/shared/discovery/dupSize';
import {
  DataSheet, TextCell, NumberCell, AmountCell, SelectCell, confidenceStyleFor, sheetStyles as SS,
  type DataSheetColumn,
} from '../components/datasheet/DataSheet';

type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';
const CONFIDENCE_OPTS: CostConfidence[] = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'];
const STATUS_OPTIONS = ['available', 'reserved', 'depleted', 'damaged', 'returned'];

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  qty: number;
  unit_cost: number | null;
  location: string | null;
  status: string;
  serial_number: string | null;
  cost_confidence: CostConfidence | null;
  size: string | null;
  variant_group: string | null;
  received_at: string | null;
  receipt_id: string | null;
  notes: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

interface FormState {
  name: string; sku: string; qty: string; unit_cost: string; location: string;
  status: string; serial_number: string; cost_confidence: CostConfidence; received_at: string; notes: string;
}
const EMPTY_FORM: FormState = {
  name: '', sku: '', qty: '0', unit_cost: '', location: '',
  status: 'available', serial_number: '', cost_confidence: 'UNKNOWN', received_at: '', notes: '',
};

function dupKey(vg: string | null, size: string | null): string | null {
  if (!vg || !vg.trim() || !size || !size.trim()) return null;
  return `${vg}||${size.trim().toLowerCase()}`;
}
function confidenceLabel(c: CostConfidence | null): string {
  if (!c) return '—';
  return { CONFIRMED: 'Confirmed', DERIVED: 'AI-Derived', ESTIMATED: 'Estimated', UNKNOWN: 'Unknown' }[c];
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function BusinessInventory() {
  const { businessId } = useBusinessContext();
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    loadItems();
  }, [businessId]);

  async function loadItems() {
    setListLoading(true);
    setListError(null);
    const { data, error } = await supabase
      .from('business_inventory')
      .select('id,name,sku,qty,unit_cost,location,status,serial_number,cost_confidence,size,variant_group,received_at,receipt_id,notes,description,created_at,updated_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[TRACE:invsheet] load error', error.message); setListError(error.message); setListLoading(false); return; }
    const rows = (data ?? []) as InventoryRow[];
    console.log('[TRACE:invsheet] load ok', { businessId, rows: rows.length });
    setItems(rows);
    setListLoading(false);
  }

  // ── Inline write: one immediate UPDATE per field. UUID-keyed + business_id-scoped, NEVER sku-keyed. ──
  async function doPatch(row: InventoryRow, patch: Record<string, unknown>) {
    const { error } = await supabase
      .from('business_inventory')
      .update(patch)
      .eq('id', row.id)
      .eq('business_id', businessId);
    if (error) { console.error('[TRACE:invsheet] edit error', error.message); setListError(error.message); return; }
    await loadItems();
  }
  function onText(row: InventoryRow, field: 'name' | 'size' | 'variant_group' | 'location' | 'serial_number' | 'notes' | 'description', raw: string | null) {
    const trimmed = (raw ?? '').trim();
    if (field === 'name' && trimmed === '') return; // name is NOT NULL — refuse to blank it
    const value = trimmed === '' ? null : trimmed;
    if (value === (row as unknown as Record<string, unknown>)[field]) return;
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field, to: value });
    void doPatch(row, { [field]: value });
  }
  function onQty(row: InventoryRow, value: number | null) {
    if (value == null || !Number.isFinite(value) || value < 0 || value === row.qty) return;
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'qty', from: row.qty, to: value });
    void doPatch(row, { qty: value });
  }
  function onStatus(row: InventoryRow, value: string) {
    if (value === row.status) return;
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'status', from: row.status, to: value });
    void doPatch(row, { status: value });
  }
  // Coherence: a deliberately-typed cost → CONFIRMED (overridable); clearing → UNKNOWN.
  function onUnitCost(row: InventoryRow, value: number | null) {
    if (value === (row.unit_cost ?? null)) return;
    const patch = value == null ? { unit_cost: null, cost_confidence: 'UNKNOWN' } : { unit_cost: value, cost_confidence: 'CONFIRMED' };
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'unit_cost', from: row.unit_cost, to: value, cost_confidence: value == null ? 'UNKNOWN' : 'CONFIRMED' });
    void doPatch(row, patch);
  }
  // Confidence override: UNKNOWN clears the cost; any other grade keeps it.
  function onConfidence(row: InventoryRow, conf: CostConfidence) {
    if (conf === row.cost_confidence) return;
    const patch = conf === 'UNKNOWN' ? { cost_confidence: 'UNKNOWN', unit_cost: null } : { cost_confidence: conf };
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'cost_confidence', from: row.cost_confidence, to: conf, clearedCost: conf === 'UNKNOWN' });
    void doPatch(row, patch);
  }

  // ── Dup-size flag: reuse the shared CASE-5 detector; flag any row whose (variant_group,size) collides. ──
  const dupKeys = useMemo(() => {
    const groups = findDuplicateSizeGroups(items.map(r => ({ name: r.name, size: r.size, variant_group: r.variant_group })));
    const set = new Set<string>();
    for (const g of groups) { const k = dupKey(g.variantGroup, g.size); if (k) set.add(k); }
    if (groups.length > 0) console.log('[TRACE:invsheet] dup-size flags', { groups: groups.length, collisions: groups.map(g => `${g.variantGroup}/${g.size}×${g.count}`) });
    return set;
  }, [items]);
  const isDup = (r: InventoryRow) => { const k = dupKey(r.variant_group, r.size); return k != null && dupKeys.has(k); };

  // ── Column config ──
  const columns: DataSheetColumn<InventoryRow>[] = [
    { key: 'flag', header: '', sortable: false, hideable: false,
      render: r => isDup(r) ? <span style={SS.dupTag} title="Duplicate (variant group, size) — uncountable by scan until you disambiguate the size or variant group."><AlertTriangle size={13} /></span> : null },
    { key: 'name', header: 'Name', sortable: true, sortVal: r => r.name.toLowerCase(),
      render: r => <TextCell key={`name-${r.id}-${r.updated_at}`} value={r.name} width={150} onCommit={v => onText(r, 'name', v)} /> },
    { key: 'sku', header: 'SKU', sortable: true, sortVal: r => (r.sku ?? '').toLowerCase(),
      render: r => r.sku ? <span style={SS.skuText}>{r.sku}</span> : <span style={SS.muted}>—</span> },
    { key: 'qty', header: 'Qty', sortable: true, sortVal: r => r.qty,
      render: r => <NumberCell key={`qty-${r.id}-${r.updated_at}`} value={r.qty} onCommit={v => onQty(r, v)} /> },
    { key: 'size', header: 'Size', sortable: true, sortVal: r => (r.size ?? '').toLowerCase(),
      render: r => <TextCell key={`size-${r.id}-${r.updated_at}`} value={r.size} width={80} placeholder="—" onCommit={v => onText(r, 'size', v)} /> },
    { key: 'variant_group', header: 'Variant grp', sortable: true, sortVal: r => (r.variant_group ?? '').toLowerCase(),
      render: r => <TextCell key={`vg-${r.id}-${r.updated_at}`} value={r.variant_group} width={110} placeholder="—" onCommit={v => onText(r, 'variant_group', v)} /> },
    { key: 'unit_cost', header: 'Unit cost', sortable: true, sortVal: r => r.unit_cost ?? -1,
      render: r => <AmountCell key={`cost-${r.id}-${r.updated_at}`} value={r.unit_cost} onCommit={v => onUnitCost(r, v)} /> },
    { key: 'cost_confidence', header: 'Conf.', sortable: true, sortVal: r => r.cost_confidence ?? '',
      render: r => <SelectCell value={r.cost_confidence ?? 'UNKNOWN'} options={CONFIDENCE_OPTS.map(o => ({ value: o, label: o }))} onChange={v => onConfidence(r, v as CostConfidence)} styleFor={confidenceStyleFor} title={confidenceLabel(r.cost_confidence)} /> },
    { key: 'status', header: 'Status', sortable: true, sortVal: r => r.status,
      render: r => <SelectCell value={r.status} options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} onChange={v => onStatus(r, v)} /> },
    { key: 'location', header: 'Location', sortable: true, sortVal: r => (r.location ?? '').toLowerCase(),
      render: r => <TextCell key={`loc-${r.id}-${r.updated_at}`} value={r.location} width={110} placeholder="—" onCommit={v => onText(r, 'location', v)} /> },
    { key: 'serial_number', header: 'Serial', sortable: true, sortVal: r => (r.serial_number ?? '').toLowerCase(), defaultVisible: false,
      render: r => <TextCell key={`sn-${r.id}-${r.updated_at}`} value={r.serial_number} width={110} placeholder="—" onCommit={v => onText(r, 'serial_number', v)} /> },
    { key: 'notes', header: 'Notes', sortable: false, defaultVisible: false,
      render: r => <TextCell key={`notes-${r.id}-${r.updated_at}`} value={r.notes} width={160} placeholder="—" onCommit={v => onText(r, 'notes', v)} /> },
    { key: 'received_at', header: 'Received', sortable: true, sortVal: r => r.received_at ?? '', defaultVisible: false,
      render: r => <span style={SS.muted}>{fmtDate(r.received_at)}</span> },
    { key: 'receipt_id', header: 'Receipt', sortable: false, defaultVisible: false,
      render: r => r.receipt_id ? <a href="/receipts" title={`Receipt ${r.receipt_id}`} style={{ textDecoration: 'none' }}>🧾</a> : <span style={SS.muted}>—</span> },
    { key: 'created_at', header: 'Added', sortable: true, sortVal: r => r.created_at, defaultVisible: false,
      render: r => <span style={SS.muted}>{fmtDate(r.created_at)}</span> },
    { key: 'updated_at', header: 'Last touched', sortable: true, sortVal: r => r.updated_at ?? '',
      render: r => <span style={SS.muted}>{fmtDate(r.updated_at)}</span> },
  ];

  // ── Add-Item form (create path — unchanged flow) ──
  function set(field: keyof FormState, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value };
      if (field === 'unit_cost' && value.trim() !== '' && f.cost_confidence === 'UNKNOWN') next.cost_confidence = 'CONFIRMED';
      if (field === 'cost_confidence' && value === 'UNKNOWN') next.unit_cost = '';
      return next;
    });
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim()) { setSaveError('Name is required.'); return; }
    const qty = parseInt(form.qty, 10);
    if (isNaN(qty) || qty < 0) { setSaveError('Quantity must be 0 or greater.'); return; }
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    const payload: Record<string, unknown> = {
      business_id: businessId, name: form.name.trim(), qty, status: form.status, cost_confidence: form.cost_confidence,
    };
    if (form.sku.trim())           payload.sku           = form.sku.trim();
    if (form.location.trim())      payload.location      = form.location.trim();
    if (form.serial_number.trim()) payload.serial_number = form.serial_number.trim();
    if (form.notes.trim())         payload.notes         = form.notes.trim();
    if (form.received_at)          payload.received_at   = form.received_at;
    if (form.cost_confidence !== 'UNKNOWN' && form.unit_cost.trim()) {
      const parsed = parseFloat(form.unit_cost);
      if (!isNaN(parsed)) payload.unit_cost = parsed;
    }
    console.log('[TRACE:invsheet] add → insert', { name: payload.name, qty, cost_confidence: payload.cost_confidence });
    const { error } = await supabase.from('business_inventory').insert(payload);
    if (error) { console.error('[TRACE:invsheet] add error', error.message); setSaveError(error.message); setSaving(false); return; }
    setSaveSuccess(true); setSaving(false); setForm(EMPTY_FORM);
    setTimeout(() => { setShowForm(false); setSaveSuccess(false); loadItems(); }, 900);
  }

  return (
    <>
      <DataSheet<InventoryRow>
        title="Inventory"
        rows={items}
        loading={listLoading}
        error={listError}
        getRowId={r => r.id}
        columns={columns}
        searchText={r => [r.name, r.sku, r.size, r.variant_group, r.location, r.serial_number, r.notes].filter(Boolean).join(' ')}
        searchPlaceholder="Search name, SKU, size, location…"
        statusFilter={{ label: 'statuses', options: STATUS_OPTIONS, get: r => r.status }}
        defaultSortKey="name"
        rowFlag={isDup}
        flagBanner={n => (
          <>
            <AlertTriangle size={15} />
            {n} size {n === 1 ? 'collision' : 'collisions'} — two rows share a variant group and size, so the scanner can’t tell them apart. Edit the <b>&nbsp;size&nbsp;</b> or <b>&nbsp;variant group&nbsp;</b> on a flagged row to fix it.
          </>
        )}
        itemNoun="items"
        emptyIcon={<Archive size={32} color="#d1d5db" style={{ marginBottom: 8 }} />}
        emptyText="No inventory yet. Add your first item."
        renderExpand={r => (
          <div style={SS.expandInner}>
            <div>
              <label style={SS.label}>Description</label>
              <textarea
                key={`desc-${r.id}-${r.updated_at}`}
                style={SS.textarea}
                defaultValue={r.description ?? ''}
                placeholder="Longer description, supplier, storage notes…"
                onBlur={e => onText(r, 'description', e.target.value)}
              />
            </div>
            <div style={SS.metaGrid}>
              <span style={SS.metaKey}>SKU</span><span>{r.sku ?? '—'}</span>
              <span style={SS.metaKey}>Received</span><span>{fmtDate(r.received_at)}</span>
              <span style={SS.metaKey}>Receipt</span><span>{r.receipt_id ? <a href="/receipts">🧾 linked</a> : '—'}</span>
              <span style={SS.metaKey}>Added</span><span>{fmtDateTime(r.created_at)}</span>
              <span style={SS.metaKey}>Last touched</span><span>{fmtDateTime(r.updated_at)}</span>
            </div>
          </div>
        )}
        actions={
          <>
            <button style={SS.primaryBtn} onClick={() => navigate('/inventory/count')}>
              <ScanLine size={16} /> Start count
            </button>
            <button style={SS.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
              <Plus size={16} /> Add Item
            </button>
          </>
        }
      />

      {/* Add Inventory bottom sheet — create path (unchanged) */}
      {showForm && (
        <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={SS.sheet}>
            <div style={SS.sheetHeader}>
              <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Add Inventory Item</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setShowForm(false)}>
                <X size={20} color="#6b7280" />
              </button>
            </div>
            {saveError && <div style={SS.error}>{saveError}</div>}
            {saveSuccess && <div style={SS.success}>Item saved.</div>}
            <form onSubmit={handleSubmit}>
              <div style={SS.field}>
                <label style={SS.label}>Name *</label>
                <input style={SS.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fertilizer 10-10-10, Netting 6×12" required />
              </div>
              <div style={{ ...SS.row3, ...SS.field }}>
                <div>
                  <label style={SS.label}>SKU</label>
                  <input style={SS.input} value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label style={SS.label}>Qty *</label>
                  <input style={SS.input} type="number" min="0" value={form.qty} onChange={e => set('qty', e.target.value)} />
                </div>
                <div>
                  <label style={SS.label}>Status</label>
                  <select style={SS.select} value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Unit Cost</label>
                  <input style={SS.input} type="number" step="0.01" min="0" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)}
                    placeholder={form.cost_confidence === 'UNKNOWN' ? 'unknown' : '0.00'} disabled={form.cost_confidence === 'UNKNOWN'} />
                </div>
                <div>
                  <label style={SS.label}>Cost Confidence</label>
                  <select style={SS.select} value={form.cost_confidence} onChange={e => set('cost_confidence', e.target.value as CostConfidence)}>
                    {CONFIDENCE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <p style={SS.hint}>A cost you type = Confirmed. Change it if it’s a guess. No cost = Unknown.</p>
                </div>
              </div>
              <div style={{ ...SS.row2, ...SS.field }}>
                <div>
                  <label style={SS.label}>Location</label>
                  <input style={SS.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Shed A, Greenhouse 2" />
                </div>
                <div>
                  <label style={SS.label}>Serial Number</label>
                  <input style={SS.input} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <div style={SS.field}>
                <label style={SS.label}>Date Received</label>
                <input style={SS.input} type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} />
              </div>
              <div style={SS.field}>
                <label style={SS.label}>Notes</label>
                <textarea style={SS.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Supplier, purchase context, storage notes…" />
              </div>
              <button type="submit" style={saving ? SS.submitBtnDisabled : SS.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
