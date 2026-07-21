// ============================================================
// BusinessInventory — inventory DATASHEET (Cultivar OS) — board 5.1 reconcile surface
// PURPOSE:      The desktop-primary RECONCILE + full-CRUD surface for business_inventory. The grid
//               is the LIST/READ surface (editable, sortable, filterable, column-hideable — fix qty /
//               size / variant_group / location / unit_cost / status / reorder_point inline). Create,
//               Update, Delete, and "+ Add size" all run through ONE grouped InventoryEditor
//               (mode create|edit — STD-011, the #119 CustomerPartyEditor pattern); the old flat
//               Add-Item sheet is RETIRED. The count flow (InventoryCount.tsx) is the phone CAPTURE
//               tool; this is the desk RECONCILE tool (capture=mobile, reconcile=desktop).
// CRUD (D-46):  • CREATE — "Add Item" opens the editor empty (create mode).
//               • READ   — the grid; shows size + variant_group + qty + price + reorder point.
//               • UPDATE — per-row "Edit" opens the editor (full surface); the grid keeps fast inline
//                          cell edits. Name edits are GROUP-AWARE (renameVariety) so size-siblings
//                          stay linked. "+ Add size" opens the editor seeded from the row (inherits
//                          name + variant_group, auto-groups the parent if it had none) so the
//                          size-picker fires by construction.
//               • DELETE — per-row delete: referenced-by-orders → SOFT (status='archived', history
//                          intact via ON-DELETE-SET-NULL FKs); never-sold → HARD delete. Confirm-first.
// ENGINE:       Renders through the SHARED <DataSheet> engine. All write ops live in the shared
//               inventoryEdit helper (insert/patch/rename/delete) so grid + editor never drift (STD-011).
// DEPENDENCIES: supabase (business_inventory, business_id-scoped), useBusinessContext, InventoryEditor +
//               inventoryEdit helpers, findDuplicateSizeGroups (dup-size flag), DataSheet cells.
// OUTPUTS:      Per-field UPDATE / INSERT / DELETE on business_inventory (UUID-keyed + business_id-
//               scoped — never sku-keyed). No schema / migration / RLS touched here (reorder_point is
//               written deploy-window-safe; its D-42 migration is gated).
// INSTRUMENTATION (STD-003): `[TRACE:invsheet]` on grid load + inline writes; `[TRACE:INVENTORY]` on
//               insert / patch / rename / delete (via inventoryEdit); `[TRACE:PRICE]` on sell_price.
//               ON BY DEFAULT.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Archive, ScanLine, AlertTriangle, Pencil, CopyPlus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { findDuplicateSizeGroups, sizeGroupKey } from '@trace/shared/discovery/dupSize';
import {
  DataSheet, TextCell, NumberCell, AmountCell, SelectCell, confidenceStyleFor, sheetStyles as SS,
  type DataSheetColumn,
} from '../components/datasheet/DataSheet';
import { InventoryEditor, BLANK_INVENTORY_ITEM, type EditorInventoryItem, type InventoryPeer } from '../components/inventory/InventoryEditor';
import { persistInventoryPatch, renameVariety, deleteInventoryRow } from '../components/inventory/inventoryEdit';
import { fetchCommittedByLot, availableFrom, type CommittedByLot } from '../lib/inventoryStates';

type CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN';
const CONFIDENCE_OPTS: CostConfidence[] = ['CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'];
// 'archived' is the SOFT-DELETE value (status is plain text, no CHECK — AC-1 string value, no migration).
const STATUS_OPTIONS = ['available', 'reserved', 'depleted', 'damaged', 'returned', 'archived'];

interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  qty: number;
  unit_cost: number | null;
  sell_price: number | null;
  location: string | null;
  status: string;
  serial_number: string | null;
  cost_confidence: CostConfidence | null;
  size: string | null;
  variant_group: string | null;
  reorder_point: number | null;
  received_at: string | null;
  receipt_id: string | null;
  notes: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

// SELECT column sets. reorder_point is a DEPLOY-GATED column (D-42 migration is gated) — the load
// tries the FULL set and, on a missing-column error, falls back to CORE so the grid still renders
// (deploy-window-safe, mirrors D-41's FULL→CORE fallback).
const CORE_COLS = 'id,name,sku,qty,unit_cost,sell_price,location,status,serial_number,cost_confidence,size,variant_group,received_at,receipt_id,notes,description,created_at,updated_at';
const FULL_COLS = `${CORE_COLS},reorder_point`;

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

// Map a grid row → the editor's item shape (the owner-editable subset).
function toEditorItem(r: InventoryRow): EditorInventoryItem {
  return {
    id: r.id, name: r.name, sku: r.sku, qty: r.qty, size: r.size, variant_group: r.variant_group,
    sell_price: r.sell_price, unit_cost: r.unit_cost, cost_confidence: r.cost_confidence,
    reorder_point: r.reorder_point, location: r.location, status: r.status, notes: r.notes,
  };
}

type EditorState =
  | { mode: 'create'; item: EditorInventoryItem; addSizeParent?: { id: string; name: string; variant_group: string | null; sku: string | null } }
  | { mode: 'edit'; item: EditorInventoryItem };

export function BusinessInventory() {
  const { businessId } = useBusinessContext();
  const navigate = useNavigate();

  const [items, setItems] = useState<InventoryRow[]>([]);
  // D-52: lot → committed units (open orders). DERIVED, never stored and never written back —
  // this grid EDITS on-hand, and committed/available are read-only consequences of it.
  const [committedByLot, setCommittedByLot] = useState<CommittedByLot>(new Map());
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    loadItems();
  }, [businessId]);

  async function loadItems() {
    setListLoading(true);
    setListError(null);
    const full = await supabase
      .from('business_inventory')
      .select(FULL_COLS)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    let data: unknown = full.data;
    let error = full.error;
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /reorder_point|does not exist/i.test(error.message))) {
      console.warn('[TRACE:invsheet] reorder_point absent — FULL→CORE fallback (migration pending)');
      const core = await supabase
        .from('business_inventory')
        .select(CORE_COLS)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });
      data = core.data; error = core.error;
    }
    if (error) { console.error('[TRACE:invsheet] load error', error.message); setListError(error.message); setListLoading(false); return; }
    const rows = ((data ?? []) as Partial<InventoryRow>[]).map(r => ({ reorder_point: null, ...r })) as InventoryRow[];
    console.log('[TRACE:invsheet] load ok', { businessId, rows: rows.length });
    setItems(rows);
    // D-52: committed is re-derived on every load, INCLUDING after an on-hand edit, so Available
    // recomputes the moment Qty changes. Through the ONE shared derivation (§6 r8) — the grid and
    // the checkout oversell guard read committed the same way or they will eventually disagree.
    setCommittedByLot(await fetchCommittedByLot(supabase, businessId!));
    setListLoading(false);
  }

  function toast(msg: string) { setFlash(msg); setTimeout(() => setFlash(null), 2600); }

  // ── Inline write: one immediate UPDATE per field, via the shared helper (STD-011). ──
  async function doPatch(row: InventoryRow, patch: Record<string, unknown>) {
    const res = await persistInventoryPatch({ id: row.id, businessId: businessId!, patch });
    if (res.error) { setListError(res.error); return; }
    await loadItems();
  }
  // Name is GROUP-AWARE — renaming a grouped row renames its size-siblings too (keeps them linked).
  async function doRename(row: InventoryRow, raw: string) {
    const name = (raw ?? '').trim();
    if (name === '' || name === row.name) return; // NOT NULL — refuse to blank it
    const res = await renameVariety({ businessId: businessId!, rowId: row.id, variantGroup: row.variant_group, newName: name });
    if (res.error) { setListError(res.error); return; }
    if (res.scope === 'group' && res.count > 1) toast(`Renamed all ${res.count} sizes of this variety.`);
    await loadItems();
  }
  function onText(row: InventoryRow, field: 'size' | 'variant_group' | 'location' | 'serial_number' | 'notes' | 'description', raw: string | null) {
    const trimmed = (raw ?? '').trim();
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
  function onReorderPoint(row: InventoryRow, value: number | null) {
    if (value != null && (!Number.isFinite(value) || value < 0)) return;
    if (value === (row.reorder_point ?? null)) return;
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'reorder_point', to: value });
    void doPatch(row, { reorder_point: value });
  }
  function onStatus(row: InventoryRow, value: string) {
    if (value === row.status) return;
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'status', from: row.status, to: value });
    void doPatch(row, { status: value });
  }
  function onUnitCost(row: InventoryRow, value: number | null) {
    if (value === (row.unit_cost ?? null)) return;
    const patch = value == null ? { unit_cost: null, cost_confidence: 'UNKNOWN' } : { unit_cost: value, cost_confidence: 'CONFIRMED' };
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'unit_cost', from: row.unit_cost, to: value, cost_confidence: value == null ? 'UNKNOWN' : 'CONFIRMED' });
    void doPatch(row, patch);
  }
  function onSellPrice(row: InventoryRow, value: number | null) {
    if (value === (row.sell_price ?? null)) return;
    console.log('[TRACE:PRICE] datasheet write sell_price', { rowId: row.id, name: row.name, from: row.sell_price, to: value });
    void doPatch(row, { sell_price: value });
  }
  function onConfidence(row: InventoryRow, conf: CostConfidence) {
    if (conf === row.cost_confidence) return;
    const patch = conf === 'UNKNOWN' ? { cost_confidence: 'UNKNOWN', unit_cost: null } : { cost_confidence: conf };
    console.log('[TRACE:invsheet] edit', { rowId: row.id, field: 'cost_confidence', from: row.cost_confidence, to: conf, clearedCost: conf === 'UNKNOWN' });
    void doPatch(row, patch);
  }

  // ── Delete (confirm-first). deleteInventoryRow decides soft (archived, referenced) vs hard. ──
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteInventoryRow({ id: deleteTarget.id, businessId: businessId! });
    setDeleting(false);
    if (res.error) { setListError(res.error); setDeleteTarget(null); return; }
    toast(res.mode === 'soft'
      ? 'Item has order history — archived (kept for records), not sellable.'
      : 'Item removed.');
    setDeleteTarget(null);
    await loadItems();
  }

  // ── Dup-size flag: reuse the shared CASE-5 detector; flag any row whose (variant_group,size)
  //    collides. Computed over ALL items, deliberately: a collision is a fact about the CATALOG,
  //    so a row must not stop being flagged just because its twin was filtered out of view. Only
  //    the BANNER's count is view-scoped (partitionFlagged, in the engine) — that is the defect
  //    fixed this pass, and the distinction is the whole point. ──
  const dupKeys = useMemo(() => {
    const groups = findDuplicateSizeGroups(items.map(r => ({ name: r.name, size: r.size, variant_group: r.variant_group })));
    const set = new Set<string>();
    for (const g of groups) { const k = sizeGroupKey(g.variantGroup, g.size); if (k) set.add(k); }
    // The copy counts ROWS and this trace used to count GROUPS, so the banner said "2 size
    // collisions" while the trace said `collisions: Array(1)`. It is ONE collision involving TWO
    // rows. Both nouns are now reported and named, so the trace and the copy cannot disagree —
    // a number that contradicts its own trace is how the next session misdiagnoses this.
    if (groups.length > 0) {
      const flaggedRows = groups.reduce((n, g) => n + g.count, 0);
      console.log('[TRACE:invsheet] dup-size flags', {
        collisions: groups.length, flaggedRows,
        pairs: groups.map(g => `${g.variantGroup}/${g.size}×${g.count}`),
      });
    }
    return set;
  }, [items]);
  const isDup = (r: InventoryRow) => { const k = sizeGroupKey(r.variant_group, r.size); return k != null && dupKeys.has(k); };

  // The tenant's rows, as the editor's uniqueness guards need them (SKU + (variant_group, size)).
  // ONE prop: the editor derives BOTH guards and excludes the row being edited itself — a caller
  // cannot supply one guard's data and forget the other's, which is precisely how the size guard
  // came to be missing while the SKU guard shipped (ledger #135).
  const editorPeers = useMemo<InventoryPeer[]>(
    () => items.map(r => ({ id: r.id, size: r.size, variant_group: r.variant_group, sku: r.sku, name: r.name })),
    [items],
  );

  // ── Row actions (Edit · + Add size · Delete). Rendered by the SHARED DataSheet engine in a
  //    LEFT-PINNED column pinned adjacent to the frozen Name column (STD-011 engine behavior), so
  //    they stay reachable regardless of horizontal scroll — no more scrolling past every column. ──
  const rowActions = (r: InventoryRow) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button style={rowActionBtn} title="Edit item" onClick={() => setEditor({ mode: 'edit', item: toEditorItem(r) })}>
        <Pencil size={14} />
      </button>
      <button style={rowActionBtn} title="Add another size of this variety"
        onClick={() => setEditor({ mode: 'create', item: { ...BLANK_INVENTORY_ITEM }, addSizeParent: { id: r.id, name: r.name, variant_group: r.variant_group, sku: r.sku } })}>
        <CopyPlus size={14} />
      </button>
      <button style={{ ...rowActionBtn, color: '#b91c1c', borderColor: '#fca5a5' }} title="Delete item" onClick={() => setDeleteTarget(r)}>
        <Trash2 size={14} />
      </button>
    </div>
  );

  // ── Column config ──
  const columns: DataSheetColumn<InventoryRow>[] = [
    { key: 'flag', header: '', sortable: false, hideable: false, frozen: true, frozenWidth: 34,
      render: r => isDup(r) ? <span style={SS.dupTag} title="Duplicate (variant group, size) — uncountable by scan until you disambiguate the size or variant group."><AlertTriangle size={13} /></span> : null },
    { key: 'name', header: 'Name', sortable: true, sortVal: r => r.name.toLowerCase(), frozen: true, frozenWidth: 180,
      render: r => <TextCell key={`name-${r.id}-${r.updated_at}`} value={r.name} width={150} onCommit={v => doRename(r, v ?? '')} /> },
    { key: 'sku', header: 'SKU', sortable: true, sortVal: r => (r.sku ?? '').toLowerCase(),
      render: r => r.sku ? <span style={SS.skuText}>{r.sku}</span> : <span style={SS.muted}>—</span> },
    // D-52 — the three numbers, side by side. On-hand ("Qty") is the ONLY editable one; Committed
    // and Available are DERIVED and locked (§6 r13: a non-editable field reads as system-managed
    // WITH a reason, never as a mystery-greyed cell). They sit immediately beside Qty because the
    // whole point is the comparison — "I have 12, but only 4 are actually sellable" is unreadable
    // if the numbers are columns apart. Committed renders muted at 0 so a busy lot stands out.
    { key: 'qty', header: 'On hand', sortable: true, sortVal: r => r.qty,
      render: r => <NumberCell key={`qty-${r.id}-${r.updated_at}`} value={r.qty} onCommit={v => onQty(r, v)} /> },
    { key: 'committed', header: 'Committed', sortable: true, systemManaged: true,
      lockReason: 'Units on orders that are placed but not yet fulfilled. Counted up from those open orders every time this page loads, so it is never edited here — cancel or fulfil the order and this follows.',
      sortVal: r => committedByLot.get(r.id) ?? 0,
      render: r => {
        const c = committedByLot.get(r.id) ?? 0;
        return c > 0 ? <span>{c}</span> : <span style={SS.muted}>—</span>;
      } },
    { key: 'available', header: 'Available', sortable: true, systemManaged: true,
      lockReason: 'On hand minus committed — what a new order can actually take. Calculated from the two, so it is not editable: change On hand, or fulfil/cancel an order, and this follows.',
      sortVal: r => availableFrom(r.qty, committedByLot.get(r.id) ?? 0),
      render: r => {
        const c = committedByLot.get(r.id) ?? 0;
        const a = availableFrom(r.qty, c);
        // Amber when stock is present but fully spoken for — the state most likely to be misread
        // as "in stock" at a glance, and the one that causes a refused sale at the counter.
        return <span style={a === 0 && r.qty > 0 ? SS.dupTag : undefined}>{a}</span>;
      } },
    { key: 'size', header: 'Size', sortable: true, sortVal: r => (r.size ?? '').toLowerCase(),
      render: r => <TextCell key={`size-${r.id}-${r.updated_at}`} value={r.size} width={80} placeholder="—" onCommit={v => onText(r, 'size', v)} /> },
    { key: 'variant_group', header: 'Variant grp', sortable: true, sortVal: r => (r.variant_group ?? '').toLowerCase(),
      render: r => <TextCell key={`vg-${r.id}-${r.updated_at}`} value={r.variant_group} width={110} placeholder="—" onCommit={v => onText(r, 'variant_group', v)} /> },
    { key: 'unit_cost', header: 'Unit cost', sortable: true, sortVal: r => r.unit_cost ?? -1,
      render: r => <AmountCell key={`cost-${r.id}-${r.updated_at}`} value={r.unit_cost} onCommit={v => onUnitCost(r, v)} /> },
    { key: 'sell_price', header: 'Sell price', sortable: true, sortVal: r => r.sell_price ?? -1,
      render: r => <AmountCell key={`sell-${r.id}-${r.updated_at}`} value={r.sell_price} onCommit={v => onSellPrice(r, v)} /> },
    { key: 'reorder_point', header: 'Reorder at', sortable: true, sortVal: r => r.reorder_point ?? -1, defaultVisible: false,
      render: r => <NumberCell key={`rop-${r.id}-${r.updated_at}`} value={r.reorder_point} onCommit={v => onReorderPoint(r, v)} /> },
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

  return (
    <>
      {flash && <div style={flashStyle}>{flash}</div>}
      <DataSheet<InventoryRow>
        title="Inventory"
        rows={items}
        loading={listLoading}
        error={listError}
        getRowId={r => r.id}
        columns={columns}
        rowActions={rowActions}
        rowActionsHeader="Actions"
        rowActionsWidth={122}
        searchText={r => [r.name, r.sku, r.size, r.variant_group, r.location, r.serial_number, r.notes].filter(Boolean).join(' ')}
        searchPlaceholder="Search name, SKU, size, location…"
        statusFilter={{ label: 'statuses', options: STATUS_OPTIONS, get: r => r.status }}
        defaultSortKey="name"
        rowFlag={isDup}
        /* The banner describes the rows ON SCREEN. It used to count flagged rows over the WHOLE
           catalog and render the number above whatever the filter had narrowed to — so filtering to
           the clean "alley" rows still shouted "2 size collisions … edit a flagged row", about
           Acoma, elsewhere, with no flagged row in sight to edit. D-9 inverted: the number was true,
           the place was a lie. `inView` and `elsewhere` are now two separate honest facts and the
           copy never lets one masquerade as the other. It counts ROWS throughout — the noun the flag
           icon marks and the noun the trace reports. */
        flagBanner={(inView, elsewhere) => (
          <>
            <AlertTriangle size={15} />
            {inView > 0 ? (
              <>
                {inView} flagged {inView === 1 ? 'row' : 'rows'} here — each shares a variant group and size with another row, so the scanner can’t tell them apart. Edit the <b>&nbsp;size&nbsp;</b> or <b>&nbsp;variant group&nbsp;</b> on a flagged row to fix it.
                {elsewhere > 0 && <> {elsewhere} more {elsewhere === 1 ? 'is' : 'are'} outside this filter.</>}
              </>
            ) : (
              <>
                {elsewhere} flagged {elsewhere === 1 ? 'row' : 'rows'} <b>&nbsp;elsewhere&nbsp;</b> in your inventory share a variant group and size — nothing on this screen is affected. Clear the search or status filter to see {elsewhere === 1 ? 'it' : 'them'}.
              </>
            )}
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
              <span style={SS.metaKey}>Reorder at</span><span>{r.reorder_point ?? '—'}</span>
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
            <button style={SS.addBtn} onClick={() => setEditor({ mode: 'create', item: { ...BLANK_INVENTORY_ITEM } })}>
              <Plus size={16} /> Add Item
            </button>
          </>
        }
      />

      {/* ONE editor — create / edit / add-size (STD-011). Retires the old flat Add-Item form. */}
      {editor && (
        <InventoryEditor
          item={editor.item}
          mode={editor.mode}
          statusOptions={STATUS_OPTIONS}
          addSizeParent={editor.mode === 'create' ? editor.addSizeParent : undefined}
          peers={editorPeers}
          onClose={() => setEditor(null)}
          onSaved={() => { void loadItems(); }}
        />
      )}

      {/* Delete confirm — soft (archived, order history intact) vs hard is decided server-side. */}
      {deleteTarget && (
        <div style={SS.modal} onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null); }}>
          <div style={{ ...SS.sheet, maxWidth: 440 }}>
            <div style={SS.sheetHeader}>
              <h2 style={{ ...SS.sectionTitle, margin: 0 }}>Delete item</h2>
            </div>
            <p style={{ fontSize: '0.92rem', color: '#374151', margin: '0 0 8px' }}>
              Delete <b>{deleteTarget.name}</b>{deleteTarget.size ? ` — ${deleteTarget.size}` : ''}?
            </p>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 16px' }}>
              If this item has order history it is <b>archived</b> (kept for your records, no longer sellable).
              If it was never sold it is <b>removed permanently</b>. Other sizes of the variety are untouched.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...SS.addBtn, flex: 1, justifyContent: 'center' }} disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ ...SS.submitBtn, flex: 1, background: '#b91c1c', minHeight: 40 }} disabled={deleting} onClick={() => { void confirmDelete(); }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const rowActionBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, background: '#fff', border: '1.5px solid #d1d5db', borderRadius: 7,
  color: '#374151', cursor: 'pointer', padding: 0,
};
const flashStyle: React.CSSProperties = {
  position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
  background: '#111827', color: '#fff', padding: '0.6rem 1rem', borderRadius: 10,
  fontSize: '0.86rem', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
};
