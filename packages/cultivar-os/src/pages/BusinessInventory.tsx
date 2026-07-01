// ============================================================
// BusinessInventory — inventory DATASHEET (Cultivar OS) — board 5.1 reconcile surface
// PURPOSE:      The desktop-primary RECONCILE surface for business_inventory. Turns the former
//               read-only list into an editable, sortable, filterable, column-hideable grid (v1):
//               fix qty / name / size / variant_group / location / unit_cost / status inline, in
//               place, on the correct row. The count flow (InventoryCount.tsx) is the phone CAPTURE
//               tool; this is the desk RECONCILE tool (banked principle: capture=mobile, reconcile=
//               desktop). Create still happens via the "Add Item" bottom sheet (unchanged path).
// DEPENDENCIES: supabase (business_inventory rows — per-row immediate UPDATE, UUID-keyed +
//               business_id-scoped), useBusinessContext (businessId → RLS scope), findDuplicateSizeGroups
//               from @trace/shared/discovery/dupSize (zero-dep leaf — the CASE-5 (variant_group,size)
//               dup detector, reused here as an inline amber flag).
// OUTPUTS:      Per-field UPDATE on business_inventory (.eq('id', row.id).eq('business_id', businessId)
//               — never sku-keyed; sku is DISPLAY-ONLY because populate REPLACE keys on DISC-% and the
//               count L2 resolves on exact sku). Manual unit_cost edit → cost_confidence=CONFIRMED
//               (overridable, badge shown); clearing the cost → UNKNOWN (Surface Honesty coherence).
// GATE:         Inherits the /inventory VIEW_COSTS route gate + business_inventory RLS (owner_all +
//               member_all FOR ALL under view_costs) — the SAME gate the count flow already writes
//               under. No manage_inventory permission (that read/write split, if ever wanted, is a v2
//               pass hitting count + datasheet together). No schema / migration / RLS touched here.
// DUP-SIZE:     A (variant_group, size) collision makes a variety silently uncountable-by-scan
//               (detectSizeCollision needs DISTINCT sizes per group). This surface FLAGS such rows
//               amber (detection only, via findDuplicateSizeGroups) — the fix is the human editing
//               the size/variant_group cell to disambiguate. detectSizeCollision / size-picker /
//               populate / count flow are UNTOUCHED. Closes the ledger #74 CASE-5 loop at reconcile.
// MOBILE:       overflow-x scroll, non-broken/readable, NOT optimized — this is a desk surface.
// INSTRUMENTATION (STD-003): `[TRACE:invsheet]` on grid load + every inline write (field, row id,
//               old→new, cost_confidence transitions). ON BY DEFAULT (standing owner TRACE hold).
// DEFERRED v2:  CSV export, bulk-edit, saved views, frozen panes, column reorder, per-column typed
//               filters (v1 filter = global search + status quick-filter), virtualization.
// ============================================================
import { useState, useEffect, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Archive, ScanLine, AlertTriangle, ChevronRight, ChevronDown, SlidersHorizontal, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { findDuplicateSizeGroups } from '@trace/shared/discovery/dupSize';

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
  name: string;
  sku: string;
  qty: string;
  unit_cost: string;
  location: string;
  status: string;
  serial_number: string;
  cost_confidence: CostConfidence;
  received_at: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  qty: '0',
  unit_cost: '',
  location: '',
  status: 'available',
  serial_number: '',
  cost_confidence: 'UNKNOWN', // no cost typed yet = UNKNOWN (Surface Honesty); typing a cost → CONFIRMED
  received_at: '',
  notes: '',
};

// receipt_id is intentionally absent from manual form — linked by receipt flow later.

// The grid's default column visibility. Hidden-by-default columns are reachable via the columns menu.
const DEFAULT_VISIBLE: Record<string, boolean> = {
  flag: true, name: true, sku: true, qty: true, size: true, variant_group: true,
  unit_cost: true, cost_confidence: true, status: true, location: true, updated_at: true,
  serial_number: false, notes: false, received_at: false, receipt_id: false, created_at: false,
};

function dupKey(vg: string | null, size: string | null): string | null {
  if (!vg || !vg.trim() || !size || !size.trim()) return null;
  return `${vg}||${size.trim().toLowerCase()}`;
}

const S = {
  page: { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const } as React.CSSProperties,
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: '1.25rem', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#27500A', margin: '0 0 1rem' } as React.CSSProperties,
  field: { marginBottom: 14 } as React.CSSProperties,
  label: { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 } as React.CSSProperties,
  input: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff' } as React.CSSProperties,
  select: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  textarea: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.95rem', color: '#111827', boxSizing: 'border-box', background: '#fff', minHeight: 72, resize: 'vertical' as const } as React.CSSProperties,
  hint: { fontSize: '0.75rem', color: '#6b7280', marginTop: 3 } as React.CSSProperties,
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 } as React.CSSProperties,
  submitBtn: { width: '100%', minHeight: 48, background: '#27500A', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  submitBtnDisabled: { width: '100%', minHeight: 48, background: '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, fontSize: '1rem', fontWeight: 600, cursor: 'not-allowed' } as React.CSSProperties,
  error: { color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.88rem', marginBottom: 12 } as React.CSSProperties,
  success: { color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '0.6rem 0.875rem', fontSize: '0.88rem', marginBottom: 12 } as React.CSSProperties,
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.5rem 0.875rem', color: '#27500A', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  countBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#27500A', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.5rem 0.875rem', color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,

  // Toolbar
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const } as React.CSSProperties,
  searchWrap: { display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.4rem 0.6rem', background: '#fff', minWidth: 220 } as React.CSSProperties,
  searchInput: { border: 'none', outline: 'none', fontSize: '0.9rem', color: '#111827', width: '100%', background: 'transparent' } as React.CSSProperties,
  toolSelect: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.85rem', color: '#111827', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  colBtn: { display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.7rem', background: '#fff', color: '#374151', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  colMenu: { position: 'absolute' as const, top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '0.5rem', zIndex: 50, minWidth: 190, maxHeight: 320, overflowY: 'auto' as const } as React.CSSProperties,
  colMenuItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.5rem', fontSize: '0.85rem', color: '#374151', cursor: 'pointer', borderRadius: 6 } as React.CSSProperties,
  countPill: { fontSize: '0.8rem', color: '#6b7280', marginLeft: 'auto' } as React.CSSProperties,
  dupBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.83rem', marginBottom: 12 } as React.CSSProperties,

  // Grid
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.5rem 0.6rem', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, userSelect: 'none' as const } as React.CSSProperties,
  thSortable: { cursor: 'pointer' } as React.CSSProperties,
  td: { padding: '0.45rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  tdDup: { background: '#fffbeb' } as React.CSSProperties,
  sortArrow: { fontSize: '0.7rem', color: '#27500A', marginLeft: 3 } as React.CSSProperties,
  textCell: { width: 130, border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: '0.82rem', color: '#111827', background: '#fff' } as React.CSSProperties,
  numCell: { width: 60, border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: '0.82rem', color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  moneyCell: { width: 76, border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: '0.82rem', color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  inlineSelect: { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 5px', fontSize: '0.78rem', color: '#111827', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  confSelect: (c: CostConfidence | null): React.CSSProperties => {
    const weak = c === 'UNKNOWN' || c == null;
    const est  = c === 'ESTIMATED' || c === 'DERIVED';
    return { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', background: weak ? '#fee2e2' : est ? '#fef3c7' : '#dcfce7', color: weak ? '#991b1b' : est ? '#92400e' : '#166534' };
  },
  skuText: { fontSize: '0.78rem', color: '#6b7280' } as React.CSSProperties,
  muted: { color: '#6b7280', fontSize: '0.8rem' } as React.CSSProperties,
  expandBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: '#6b7280' } as React.CSSProperties,
  dupTag: { display: 'inline-flex', alignItems: 'center', gap: 3, color: '#92400e', fontSize: '0.7rem', fontWeight: 700 } as React.CSSProperties,
  expandRow: { background: '#fafaf9' } as React.CSSProperties,
  expandInner: { padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 } as React.CSSProperties,
  metaGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '0.8rem', color: '#374151', alignContent: 'start' as const } as React.CSSProperties,
  metaKey: { color: '#6b7280', fontWeight: 600 } as React.CSSProperties,
  empty: { textAlign: 'center' as const, color: '#6b7280', padding: '2rem', fontSize: '0.9rem' } as React.CSSProperties,
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 } as React.CSSProperties,
  sheet: { background: '#fff', borderRadius: '16px 16px 0 0', padding: '1.5rem', width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
};

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

// ── Column descriptor: drives <thead>/<tbody> render, sort, and the show/hide menu ──
interface Column {
  key: string;
  header: string;
  sortable: boolean;
  sortVal?: (r: InventoryRow) => string | number;
}
const COLUMNS: Column[] = [
  { key: 'flag',          header: '',            sortable: false },
  { key: 'name',          header: 'Name',        sortable: true, sortVal: r => r.name.toLowerCase() },
  { key: 'sku',           header: 'SKU',         sortable: true, sortVal: r => (r.sku ?? '').toLowerCase() },
  { key: 'qty',           header: 'Qty',         sortable: true, sortVal: r => r.qty },
  { key: 'size',          header: 'Size',        sortable: true, sortVal: r => (r.size ?? '').toLowerCase() },
  { key: 'variant_group', header: 'Variant grp', sortable: true, sortVal: r => (r.variant_group ?? '').toLowerCase() },
  { key: 'unit_cost',     header: 'Unit cost',   sortable: true, sortVal: r => r.unit_cost ?? -1 },
  { key: 'cost_confidence', header: 'Conf.',     sortable: true, sortVal: r => r.cost_confidence ?? '' },
  { key: 'status',        header: 'Status',      sortable: true, sortVal: r => r.status },
  { key: 'location',      header: 'Location',    sortable: true, sortVal: r => (r.location ?? '').toLowerCase() },
  { key: 'serial_number', header: 'Serial',      sortable: true, sortVal: r => (r.serial_number ?? '').toLowerCase() },
  { key: 'notes',         header: 'Notes',       sortable: false },
  { key: 'received_at',   header: 'Received',    sortable: true, sortVal: r => r.received_at ?? '' },
  { key: 'receipt_id',    header: 'Receipt',     sortable: false },
  { key: 'created_at',    header: 'Added',       sortable: true, sortVal: r => r.created_at },
  { key: 'updated_at',    header: 'Last touched', sortable: true, sortVal: r => r.updated_at ?? '' },
];
// Columns the show/hide menu offers (flag is structural, always on).
const HIDEABLE = COLUMNS.filter(c => c.key !== 'flag');

export function BusinessInventory() {
  const { businessId } = useBusinessContext();
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Grid controls
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [visible, setVisible] = useState<Record<string, boolean>>(DEFAULT_VISIBLE);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Add-Item sheet
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

  // ── Inline write: one immediate UPDATE per field. UUID-keyed + business_id-scoped, NEVER sku-keyed
  //    (Case 1 / Case 3). Reload after → dup flags + derived views recompute from fresh rows. ──
  async function writeField(row: InventoryRow, patch: Record<string, unknown>, field: string, to: unknown) {
    const from = (row as unknown as Record<string, unknown>)[field];
    if (from === to) return;
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field, from, to });
    const { error } = await supabase
      .from('business_inventory')
      .update(patch)
      .eq('id', row.id)
      .eq('business_id', businessId);
    if (error) { console.error('[TRACE:invsheet] edit error', field, error.message); setListError(error.message); return; }
    await loadItems();
  }

  // Text fields (name required-non-empty; others nullable-on-blank).
  function onText(row: InventoryRow, field: 'name' | 'size' | 'variant_group' | 'location' | 'serial_number' | 'notes' | 'description', raw: string) {
    const trimmed = raw.trim();
    if (field === 'name' && trimmed === '') return; // name is NOT NULL — refuse to blank it
    const value = trimmed === '' ? null : trimmed;
    void writeField(row, { [field]: value }, field, value);
  }
  function onQty(row: InventoryRow, value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    void writeField(row, { qty: value }, 'qty', value);
  }
  function onStatus(row: InventoryRow, value: string) {
    void writeField(row, { status: value }, 'status', value);
  }
  // Coherence (decision 2): a deliberately-typed cost → CONFIRMED (overridable); clearing → UNKNOWN.
  function onUnitCost(row: InventoryRow, value: number | null) {
    if (value === (row.unit_cost ?? null)) return;
    const patch = value == null
      ? { unit_cost: null, cost_confidence: 'UNKNOWN' }
      : { unit_cost: value, cost_confidence: 'CONFIRMED' };
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'unit_cost', from: row.unit_cost, to: value, cost_confidence: value == null ? 'UNKNOWN' : 'CONFIRMED' });
    void doPatch(row, patch);
  }
  // Confidence override: UNKNOWN clears the cost; any other grade keeps it (Surface Honesty).
  function onConfidence(row: InventoryRow, conf: CostConfidence) {
    if (conf === row.cost_confidence) return;
    const patch = conf === 'UNKNOWN' ? { cost_confidence: 'UNKNOWN', unit_cost: null } : { cost_confidence: conf };
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'cost_confidence', from: row.cost_confidence, to: conf, clearedCost: conf === 'UNKNOWN' });
    void doPatch(row, patch);
  }
  // Shared write for the coupled cost/confidence pair (already logged by callers).
  async function doPatch(row: InventoryRow, patch: Record<string, unknown>) {
    const { error } = await supabase
      .from('business_inventory')
      .update(patch)
      .eq('id', row.id)
      .eq('business_id', businessId);
    if (error) { console.error('[TRACE:invsheet] edit error', error.message); setListError(error.message); return; }
    await loadItems();
  }

  function toggleSort(key: string) {
    if (sortKey === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key); setSortDir('asc');
  }
  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  }

  // ── Dup-size flag: reuse the shared CASE-5 detector; flag any row whose (variant_group,size) collides. ──
  const dupKeys = useMemo(() => {
    const groups = findDuplicateSizeGroups(items.map(r => ({ name: r.name, size: r.size, variant_group: r.variant_group })));
    const set = new Set<string>();
    for (const g of groups) { const k = dupKey(g.variantGroup, g.size); if (k) set.add(k); }
    if (groups.length > 0) console.log('[TRACE:invsheet] dup-size flags', { groups: groups.length, collisions: groups.map(g => `${g.variantGroup}/${g.size}×${g.count}`) });
    return set;
  }, [items]);
  const dupCount = dupKeys.size;
  const isDup = (r: InventoryRow) => { const k = dupKey(r.variant_group, r.size); return k != null && dupKeys.has(k); };

  // ── Derived: filter (global search + status) then sort ──
  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items;
    if (statusFilter !== 'all') rows = rows.filter(r => r.status === statusFilter);
    if (q) {
      rows = rows.filter(r =>
        [r.name, r.sku, r.size, r.variant_group, r.location, r.serial_number, r.notes]
          .some(v => (v ?? '').toLowerCase().includes(q)));
    }
    const col = COLUMNS.find(c => c.key === sortKey);
    if (col?.sortVal) {
      const sv = col.sortVal;
      rows = [...rows].sort((a, b) => {
        const va = sv(a), vb = sv(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [items, search, statusFilter, sortKey, sortDir]);

  const shownCols = COLUMNS.filter(c => visible[c.key]);

  // ── Add-Item form (create path — unchanged flow, aligned to the CONFIRMED-cost rule) ──
  function set(field: keyof FormState, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value };
      // Decision 2: typing a cost → CONFIRMED (overridable). Clearing confidence to UNKNOWN clears the cost.
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

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: Record<string, unknown> = {
      business_id: businessId,
      name: form.name.trim(),
      qty,
      status: form.status,
      cost_confidence: form.cost_confidence,
      // receipt_id intentionally absent — linked by receipt flow later
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

    if (error) {
      console.error('[TRACE:invsheet] add error', error.message);
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    setSaveSuccess(true);
    setSaving(false);
    setForm(EMPTY_FORM);
    setTimeout(() => {
      setShowForm(false);
      setSaveSuccess(false);
      loadItems();
    }, 900);
  }

  // ── Cell renderer per (column, row) ──
  function renderCell(col: Column, row: InventoryRow): React.ReactNode {
    switch (col.key) {
      case 'flag':
        return isDup(row)
          ? <span style={S.dupTag} title="Duplicate (variant group, size) — uncountable by scan until you disambiguate the size or variant group."><AlertTriangle size={13} /></span>
          : null;
      case 'name':
        return <TextCell key={`name-${row.updated_at}`} value={row.name} width={150} onCommit={v => onText(row, 'name', v ?? '')} />;
      case 'sku':
        return row.sku ? <span style={S.skuText}>{row.sku}</span> : <span style={S.muted}>—</span>; // DISPLAY-ONLY
      case 'qty':
        return <NumberCell key={`qty-${row.updated_at}`} value={row.qty} onCommit={v => v != null && onQty(row, v)} />;
      case 'size':
        return <TextCell key={`size-${row.updated_at}`} value={row.size} width={80} placeholder="—" onCommit={v => onText(row, 'size', v ?? '')} />;
      case 'variant_group':
        return <TextCell key={`vg-${row.updated_at}`} value={row.variant_group} width={110} placeholder="—" onCommit={v => onText(row, 'variant_group', v ?? '')} />;
      case 'unit_cost':
        return <AmountCell key={`cost-${row.updated_at}`} value={row.unit_cost} onCommit={v => onUnitCost(row, v)} />;
      case 'cost_confidence':
        return (
          <select style={S.confSelect(row.cost_confidence)} value={row.cost_confidence ?? 'UNKNOWN'} onChange={e => onConfidence(row, e.target.value as CostConfidence)} title={confidenceLabel(row.cost_confidence)}>
            {CONFIDENCE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'status':
        return (
          <select style={S.inlineSelect} value={row.status} onChange={e => onStatus(row, e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      case 'location':
        return <TextCell key={`loc-${row.updated_at}`} value={row.location} width={110} placeholder="—" onCommit={v => onText(row, 'location', v ?? '')} />;
      case 'serial_number':
        return <TextCell key={`sn-${row.updated_at}`} value={row.serial_number} width={110} placeholder="—" onCommit={v => onText(row, 'serial_number', v ?? '')} />;
      case 'notes':
        return <TextCell key={`notes-${row.updated_at}`} value={row.notes} width={160} placeholder="—" onCommit={v => onText(row, 'notes', v ?? '')} />;
      case 'received_at':
        return <span style={S.muted}>{fmtDate(row.received_at)}</span>;
      case 'receipt_id':
        return row.receipt_id ? <a href="/receipts" title={`Receipt ${row.receipt_id}`} style={{ textDecoration: 'none' }}>🧾</a> : <span style={S.muted}>—</span>;
      case 'created_at':
        return <span style={S.muted}>{fmtDate(row.created_at)}</span>;
      case 'updated_at':
        return <span style={S.muted}>{fmtDate(row.updated_at)}</span>;
      default:
        return null;
    }
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Inventory</h1>
        <div style={{ flex: 1 }} />
        <button style={S.countBtn} onClick={() => navigate('/inventory/count')}>
          <ScanLine size={16} />
          Start count
        </button>
        <button style={S.addBtn} onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}>
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {/* Grid card */}
      <div style={S.card}>
        {listLoading && <p style={S.empty}>Loading…</p>}
        {listError && <p style={{ ...S.empty, color: '#b91c1c' }}>Error: {listError}</p>}
        {!listLoading && !listError && items.length === 0 && (
          <div style={S.empty}>
            <Archive size={32} color="#d1d5db" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No inventory yet. Add your first item.</p>
          </div>
        )}

        {!listLoading && items.length > 0 && (
          <>
            {/* Toolbar */}
            <div style={S.toolbar}>
              <div style={S.searchWrap}>
                <Search size={15} color="#9ca3af" />
                <input style={S.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SKU, size, location…" />
              </div>
              <select style={S.toolSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} title="Filter by status">
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ position: 'relative' }}>
                <button style={S.colBtn} onClick={() => setColMenuOpen(o => !o)}>
                  <SlidersHorizontal size={14} />
                  Columns
                </button>
                {colMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setColMenuOpen(false)} />
                    <div style={S.colMenu}>
                      {HIDEABLE.map(c => (
                        <label key={c.key} style={S.colMenuItem}>
                          <input type="checkbox" checked={!!visible[c.key]} onChange={() => setVisible(v => ({ ...v, [c.key]: !v[c.key] }))} />
                          {c.header || c.key}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <span style={S.countPill}>{view.length} of {items.length}{statusFilter !== 'all' || search ? ' shown' : ' items'}</span>
            </div>

            {dupCount > 0 && (
              <div style={S.dupBanner}>
                <AlertTriangle size={15} />
                {dupCount} size {dupCount === 1 ? 'collision' : 'collisions'} — two rows share a variant group and size, so the scanner can’t tell them apart. Edit the <b>size</b> or <b>variant group</b> on a flagged row to fix it.
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {shownCols.map(col => (
                      <th
                        key={col.key}
                        style={{ ...S.th, ...(col.sortable ? S.thSortable : {}) }}
                        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      >
                        {col.header}
                        {col.sortable && sortKey === col.key && <span style={S.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </th>
                    ))}
                    <th style={S.th}></th>{/* expand toggle */}
                  </tr>
                </thead>
                <tbody>
                  {view.map(row => {
                    const dup = isDup(row);
                    const isOpen = expanded.has(row.id);
                    return (
                      <Fragment key={row.id}>
                        <tr>
                          {shownCols.map(col => (
                            <td key={col.key} style={{ ...S.td, ...(dup ? S.tdDup : {}) }}>{renderCell(col, row)}</td>
                          ))}
                          <td style={{ ...S.td, ...(dup ? S.tdDup : {}) }}>
                            <button style={S.expandBtn} onClick={() => toggleExpand(row.id)} title="Details">
                              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr style={S.expandRow}>
                            <td colSpan={shownCols.length + 1} style={{ padding: 0 }}>
                              <div style={S.expandInner}>
                                <div>
                                  <label style={S.label}>Description</label>
                                  <textarea
                                    key={`desc-${row.id}-${row.updated_at}`}
                                    style={S.textarea}
                                    defaultValue={row.description ?? ''}
                                    placeholder="Longer description, supplier, storage notes…"
                                    onBlur={e => onText(row, 'description', e.target.value)}
                                  />
                                </div>
                                <div style={S.metaGrid}>
                                  <span style={S.metaKey}>SKU</span><span>{row.sku ?? '—'}</span>
                                  <span style={S.metaKey}>Received</span><span>{fmtDate(row.received_at)}</span>
                                  <span style={S.metaKey}>Receipt</span><span>{row.receipt_id ? <a href="/receipts">🧾 linked</a> : '—'}</span>
                                  <span style={S.metaKey}>Added</span><span>{fmtDateTime(row.created_at)}</span>
                                  <span style={S.metaKey}>Last touched</span><span>{fmtDateTime(row.updated_at)}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add Inventory bottom sheet — create path (unchanged) */}
      {showForm && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={S.sheet}>
            <div style={S.sheetHeader}>
              <h2 style={{ ...S.sectionTitle, margin: 0 }}>Add Inventory Item</h2>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} onClick={() => setShowForm(false)}>
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {saveError && <div style={S.error}>{saveError}</div>}
            {saveSuccess && <div style={S.success}>Item saved.</div>}

            <form onSubmit={handleSubmit}>
              <div style={S.field}>
                <label style={S.label}>Name *</label>
                <input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fertilizer 10-10-10, Netting 6×12" required />
              </div>

              <div style={{ ...S.row3, ...S.field }}>
                <div>
                  <label style={S.label}>SKU</label>
                  <input style={S.input} value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label style={S.label}>Qty *</label>
                  <input style={S.input} type="number" min="0" value={form.qty} onChange={e => set('qty', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select style={S.select} value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Unit Cost</label>
                  <input
                    style={S.input}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_cost}
                    onChange={e => set('unit_cost', e.target.value)}
                    placeholder={form.cost_confidence === 'UNKNOWN' ? 'unknown' : '0.00'}
                    disabled={form.cost_confidence === 'UNKNOWN'}
                  />
                </div>
                <div>
                  <label style={S.label}>Cost Confidence</label>
                  <select style={S.select} value={form.cost_confidence} onChange={e => set('cost_confidence', e.target.value as CostConfidence)}>
                    {CONFIDENCE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <p style={S.hint}>A cost you type = Confirmed. Change it if it’s a guess. No cost = Unknown.</p>
                </div>
              </div>

              <div style={{ ...S.row2, ...S.field }}>
                <div>
                  <label style={S.label}>Location</label>
                  <input style={S.input} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Shed A, Greenhouse 2" />
                </div>
                <div>
                  <label style={S.label}>Serial Number</label>
                  <input style={S.input} value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Optional" />
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Date Received</label>
                <input style={S.input} type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)} />
              </div>

              <div style={S.field}>
                <label style={S.label}>Notes</label>
                <textarea style={S.textarea} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Supplier, purchase context, storage notes…" />
              </div>

              <button type="submit" style={saving ? S.submitBtnDisabled : S.submitBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline text cell — commits trimmed value on blur/Enter (null when blank). Re-syncs via key on reload. */
function TextCell({ value, width, placeholder, onCommit }: { value: string | null; width?: number; placeholder?: string; onCommit: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  return (
    <input
      value={text}
      placeholder={placeholder ?? ''}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      onBlur={() => { const t = text.trim(); onCommit(t === '' ? null : t); }}
      style={{ ...S.textCell, ...(width ? { width } : {}) }}
    />
  );
}

/** Inline integer cell — commits parsed int on blur/Enter (null when blank/invalid). */
function NumberCell({ value, onCommit }: { value: number; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const raw = text.replace(/[^0-9]/g, '');
    const n = parseInt(raw, 10);
    onCommit(raw === '' || !Number.isFinite(n) ? null : n);
  };
  return (
    <input
      inputMode="numeric"
      value={text}
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      onBlur={commit}
      style={S.numCell}
    />
  );
}

/** Inline money cell — commits parsed number on blur/Enter (null when blank). Mirrors OperatingCosts. */
function AmountCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const commit = () => {
    const raw = text.replace(/[^0-9.]/g, '');
    const n = parseFloat(raw);
    onCommit(raw === '' || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
  };
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder="unknown"
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      onBlur={commit}
      style={S.moneyCell}
    />
  );
}
