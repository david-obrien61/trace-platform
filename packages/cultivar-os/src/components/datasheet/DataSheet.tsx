// ============================================================
// DataSheet — the ONE editable-grid engine (Cultivar OS)
// PURPOSE:      A generic, config-driven datasheet grid extracted from the inventory
//               reconcile surface (board 5.1). Owns everything a business_* grid needs —
//               global search, status quick-filter, sortable columns, show/hide-columns
//               menu, per-row flag highlight + banner, optional row-expand, loading/error/
//               empty states, count pill, header actions — so /inventory AND /assets are
//               ONE engine + two column configs (AC-4 settle-once; kills the two-grid drift
//               where assets was the old pre-datasheet pattern lacking sort/search/hide).
// DEPENDENCIES: React only. NO supabase, NO business context — the engine is presentational.
//               Each consuming page owns its data fetch + write handlers and wires them into
//               the column render functions (which call the exported inline cell components).
// OUTPUTS:      Renders the page chrome (title + actions), the toolbar, and the table. Emits
//               nothing itself; writes happen inside the page's column render callbacks.
// PLACEMENT:    cultivar components/ (not the shared package) — both consumers are cultivar
//               pages and no second vertical consumes it yet. Promote to @trace/shared only
//               when a real second-vertical consumer appears (standard-by-value, §6 r10).
// INSTRUMENTATION (STD-003): the engine is silent; consumers emit `[TRACE:<area>]` on their
//               loads/writes (invsheet for inventory, assets for the asset grid).
// ============================================================
import { useState, useMemo, Fragment } from 'react';
import { ChevronRight, ChevronDown, SlidersHorizontal, Search } from 'lucide-react';

// ── Column descriptor: drives <thead>/<tbody> render, sort, and the show/hide menu ──
export interface DataSheetColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortVal?: (r: T) => string | number;
  hideable?: boolean;        // default true (structural cols like a flag icon pass false)
  defaultVisible?: boolean;  // default true
  render: (r: T) => React.ReactNode;
}

interface StatusFilterConfig<T> {
  label?: string;
  options: string[];
  get: (r: T) => string;
}

interface DataSheetProps<T> {
  title: string;
  rows: T[];
  loading: boolean;
  error: string | null;
  getRowId: (r: T) => string;
  columns: DataSheetColumn<T>[];
  /** Concatenated text a row matches global search against. */
  searchText: (r: T) => string;
  searchPlaceholder?: string;
  statusFilter?: StatusFilterConfig<T>;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  /** Highlight + count rows (e.g. dup-size collisions). */
  rowFlag?: (r: T) => boolean;
  flagBanner?: (count: number) => React.ReactNode;
  /** Optional per-row detail drawer. When present, a trailing expand toggle column appears. */
  renderExpand?: (r: T) => React.ReactNode;
  /** Header buttons (Add, Capture, Start count…). */
  actions?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  itemNoun?: string; // "items" / "assets"
}

export function DataSheet<T>(props: DataSheetProps<T>) {
  const {
    title, rows, loading, error, getRowId, columns, searchText, searchPlaceholder,
    statusFilter, defaultSortKey, defaultSortDir = 'asc', rowFlag, flagBanner,
    renderExpand, actions, emptyIcon, emptyText = 'Nothing here yet.', itemNoun = 'items',
  } = props;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns.find(c => c.sortable)?.key ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    for (const c of columns) v[c.key] = c.defaultVisible !== false;
    return v;
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleSort(key: string) {
    if (sortKey === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key); setSortDir('asc');
  }
  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const flagCount = useMemo(
    () => (rowFlag ? rows.filter(rowFlag).length : 0),
    [rows, rowFlag],
  );

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (statusFilter && status !== 'all') out = out.filter(r => statusFilter.get(r) === status);
    if (q) out = out.filter(r => searchText(r).toLowerCase().includes(q));
    const col = columns.find(c => c.key === sortKey);
    if (col?.sortVal) {
      const sv = col.sortVal;
      out = [...out].sort((a, b) => {
        const va = sv(a), vb = sv(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, search, status, statusFilter, sortKey, sortDir, columns, searchText]);

  const shownCols = columns.filter(c => visible[c.key]);
  const hideable = columns.filter(c => c.hideable !== false);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>{title}</h1>
        <div style={{ flex: 1 }} />
        {actions}
      </div>

      {/* Grid card */}
      <div style={S.card}>
        {loading && <p style={S.empty}>Loading…</p>}
        {error && <p style={{ ...S.empty, color: '#b91c1c' }}>Error: {error}</p>}
        {!loading && !error && rows.length === 0 && (
          <div style={S.empty}>
            {emptyIcon}
            <p style={{ margin: 0 }}>{emptyText}</p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Toolbar */}
            <div style={S.toolbar}>
              <div style={S.searchWrap}>
                <Search size={15} color="#9ca3af" />
                <input
                  style={S.searchInput}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={searchPlaceholder ?? 'Search…'}
                />
              </div>
              {statusFilter && (
                <select style={S.toolSelect} value={status} onChange={e => setStatus(e.target.value)} title={statusFilter.label ?? 'Filter by status'}>
                  <option value="all">All {statusFilter.label ?? 'statuses'}</option>
                  {statusFilter.options.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <div style={{ position: 'relative' }}>
                <button style={S.colBtn} onClick={() => setColMenuOpen(o => !o)}>
                  <SlidersHorizontal size={14} />
                  Columns
                </button>
                {colMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setColMenuOpen(false)} />
                    <div style={S.colMenu}>
                      {hideable.map(c => (
                        <label key={c.key} style={S.colMenuItem}>
                          <input type="checkbox" checked={!!visible[c.key]} onChange={() => setVisible(v => ({ ...v, [c.key]: !v[c.key] }))} />
                          {c.header || c.key}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <span style={S.countPill}>{view.length} of {rows.length}{status !== 'all' || search ? ' shown' : ` ${itemNoun}`}</span>
            </div>

            {rowFlag && flagCount > 0 && flagBanner && (
              <div style={S.dupBanner}>{flagBanner(flagCount)}</div>
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
                    {renderExpand && <th style={S.th}></th>}
                  </tr>
                </thead>
                <tbody>
                  {view.map(row => {
                    const id = getRowId(row);
                    const flagged = rowFlag ? rowFlag(row) : false;
                    const isOpen = expanded.has(id);
                    const tdStyle = { ...S.td, ...(flagged ? S.tdDup : {}) };
                    return (
                      <Fragment key={id}>
                        <tr>
                          {shownCols.map(col => (
                            <td key={col.key} style={tdStyle}>{col.render(row)}</td>
                          ))}
                          {renderExpand && (
                            <td style={tdStyle}>
                              <button style={S.expandBtn} onClick={() => toggleExpand(id)} title="Details">
                                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </button>
                            </td>
                          )}
                        </tr>
                        {renderExpand && isOpen && (
                          <tr style={S.expandRow}>
                            <td colSpan={shownCols.length + 1} style={{ padding: 0 }}>
                              {renderExpand(row)}
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
    </div>
  );
}

// ── Exported inline cell components (configs compose these in column.render) ──

/** Inline text cell — commits trimmed value on blur/Enter (null when blank). */
export function TextCell({ value, width, placeholder, onCommit }: { value: string | null; width?: number; placeholder?: string; onCommit: (v: string | null) => void }) {
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
export function NumberCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const commit = () => {
    const raw = text.replace(/[^0-9]/g, '');
    const n = parseInt(raw, 10);
    onCommit(raw === '' || !Number.isFinite(n) ? null : n);
  };
  return (
    <input
      inputMode="numeric"
      value={text}
      placeholder="—"
      onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      onBlur={commit}
      style={S.numCell}
    />
  );
}

/** Inline money cell — commits parsed number on blur/Enter (null when blank). "unknown" placeholder. */
export function AmountCell({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
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

interface SelectOption { value: string; label: string; }

/** Inline select — value/label options, immediate onChange write, optional per-value style. */
export function SelectCell({ value, options, onChange, styleFor, title, placeholderStyle }: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  styleFor?: (v: string) => React.CSSProperties;
  title?: string;
  /** extra style when the current value is the empty/placeholder option. */
  placeholderStyle?: React.CSSProperties;
}) {
  const base = { ...S.inlineSelect, ...(styleFor ? styleFor(value) : {}), ...(value === '' && placeholderStyle ? placeholderStyle : {}) };
  return (
    <select style={base} value={value} onChange={e => onChange(e.target.value)} title={title}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Shared styles (green theme; identical to the former inventory grid) ──
const S = {
  page: { minHeight: '100vh', background: '#EAF3DE', padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const } as React.CSSProperties,
  title: { fontSize: '1.25rem', fontWeight: 700, color: '#1a2e0a', margin: 0 } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: '1.25rem', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const } as React.CSSProperties,
  searchWrap: { display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.4rem 0.6rem', background: '#fff', minWidth: 220 } as React.CSSProperties,
  searchInput: { border: 'none', outline: 'none', fontSize: '0.9rem', color: '#111827', width: '100%', background: 'transparent' } as React.CSSProperties,
  toolSelect: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.85rem', color: '#111827', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  colBtn: { display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.7rem', background: '#fff', color: '#374151', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  colMenu: { position: 'absolute' as const, top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '0.5rem', zIndex: 50, minWidth: 190, maxHeight: 320, overflowY: 'auto' as const } as React.CSSProperties,
  colMenuItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.5rem', fontSize: '0.85rem', color: '#374151', cursor: 'pointer', borderRadius: 6 } as React.CSSProperties,
  countPill: { fontSize: '0.8rem', color: '#6b7280', marginLeft: 'auto' } as React.CSSProperties,
  dupBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.83rem', marginBottom: 12 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.5rem 0.6rem', borderBottom: '2px solid #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, userSelect: 'none' as const } as React.CSSProperties,
  thSortable: { cursor: 'pointer' } as React.CSSProperties,
  td: { padding: '0.45rem 0.6rem', borderBottom: '1px solid #f3f4f6', color: '#111827', verticalAlign: 'middle' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties,
  tdDup: { background: '#fffbeb' } as React.CSSProperties,
  sortArrow: { fontSize: '0.7rem', color: '#27500A', marginLeft: 3 } as React.CSSProperties,
  textCell: { width: 130, border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: '0.82rem', color: '#111827', background: '#fff' } as React.CSSProperties,
  numCell: { width: 60, border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: '0.82rem', color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  moneyCell: { width: 84, border: '1.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: '0.82rem', color: '#111827', background: '#fff', textAlign: 'right' as const } as React.CSSProperties,
  inlineSelect: { border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 5px', fontSize: '0.78rem', color: '#111827', background: '#fff', cursor: 'pointer', maxWidth: 170 } as React.CSSProperties,
  expandBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: '#6b7280' } as React.CSSProperties,
  expandRow: { background: '#fafaf9' } as React.CSSProperties,
  empty: { textAlign: 'center' as const, color: '#6b7280', padding: '2rem', fontSize: '0.9rem' } as React.CSSProperties,
};

/** Confidence-badge <select> style: red for weak (UNKNOWN/none), amber for est/derived, green for confirmed. */
export function confidenceStyleFor(v: string): React.CSSProperties {
  const weak = v === 'UNKNOWN' || v === '';
  const est = v === 'ESTIMATED' || v === 'DERIVED';
  return {
    border: '1.5px solid #d1d5db', borderRadius: 6, padding: '3px 5px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
    background: weak ? '#fee2e2' : est ? '#fef3c7' : '#dcfce7',
    color: weak ? '#991b1b' : est ? '#92400e' : '#166534',
    maxWidth: 130,
  };
}

/** Shared style tokens reused by consuming pages for their own chrome (add buttons, sheets, form fields). */
export const sheetStyles = {
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.5rem 0.875rem', color: '#27500A', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#27500A', border: '1.5px solid #27500A', borderRadius: 8, padding: '0.5rem 0.875rem', color: '#fff', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
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
  // CENTERED (the standing modal convention — #97 checkout pass): alignItems:center + padding
  // so the sheet floats centered on every viewport. This ONE style is the shared lever behind
  // the three datasheet add-sheets (Add Inventory / Add Customer / Add Asset) — changing it here
  // centers all three at once (compliance-audit rows #3/#5/#6, convention A "always center").
  modal: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' as const, zIndex: 100 } as React.CSSProperties,
  sheet: { background: '#fff', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto' as const } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' } as React.CSSProperties,
  // expand-drawer inner used by inventory
  expandInner: { padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 } as React.CSSProperties,
  metaGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '0.8rem', color: '#374151', alignContent: 'start' as const } as React.CSSProperties,
  metaKey: { color: '#6b7280', fontWeight: 600 } as React.CSSProperties,
  muted: { color: '#6b7280', fontSize: '0.8rem' } as React.CSSProperties,
  skuText: { fontSize: '0.78rem', color: '#6b7280' } as React.CSSProperties,
  dupTag: { display: 'inline-flex', alignItems: 'center', gap: 3, color: '#92400e', fontSize: '0.7rem', fontWeight: 700 } as React.CSSProperties,
};
