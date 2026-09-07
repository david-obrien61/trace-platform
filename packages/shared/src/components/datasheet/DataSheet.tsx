// ============================================================
// DataSheet — the ONE editable-grid engine (PLATFORM — @trace/shared)
// PURPOSE:      A generic, config-driven datasheet grid extracted from the inventory
//               reconcile surface (board 5.1). Owns everything a business_* grid needs —
//               global search, status quick-filter, sortable columns, show/hide-columns
//               menu, per-row flag highlight + banner, optional row-expand, loading/error/
//               empty states, count pill, header actions — so /inventory AND /assets are
//               ONE engine + N column configs (AC-4 settle-once; kills the two-grid drift
//               where assets was the old pre-datasheet pattern lacking sort/search/hide).
//               8 consumers today, all cultivar-os; it is reachable from any vertical and from
//               `packages/shared` itself since the 2026-09-03 promotion.
// DEPENDENCIES: `react` + `lucide-react` (icons) + the two files beside it, which import NOTHING.
//               NO supabase, NO business context, NO permission hook, NO router — presentational.
//               Each consuming page owns its data fetch + write handlers and wires them into
//               the column render functions (which call the exported inline cell components).
// OUTPUTS:      Renders the page chrome (title + actions), the toolbar, and the table. Emits
//               nothing itself; writes happen inside the page's column render callbacks.
// PLACEMENT:    @trace/shared/components/datasheet — PROMOTED 2026-09-03 (#272), David's ruling.
// 🔴 THE PRIOR PLACEMENT NOTE HERE WAS RIGHT WHEN WRITTEN AND WENT STALE WITHOUT ANYONE RE-READING IT.
//               It said: "both consumers are cultivar pages and no second vertical consumes it yet —
//               promote only when a real second-vertical consumer appears." That trigger HAD fired.
//               `QboBooksReader.tsx` lives in packages/shared, wanted this grid, could not reach it
//               (shared does not import the app) and shipped a plain bounded table instead. **The
//               note assumed the second consumer would be a VERTICAL; it arrived from inside SHARED
//               — a case the condition did not contemplate, so the condition read as unmet.**
//               A trigger nobody re-reads is a decision that defaults silently (R-26's shape).
// ⚠️ WHAT THE MOVE COST, MEASURED, because "it depends on cultivar" was the assumed obstacle and was
//               false: the ENTIRE transitive closure is `react`, `lucide-react`, and the two sibling
//               files beside this one — both of which import NOTHING. No supabase, no business
//               context, no permission hook, no router, no tile registry. 8 consumer import lines.
// ⚠️ THE DIRECTORY NAME `datasheet/` IS LOAD-BEARING AND MUST NOT BE RENAMED. The divergence cap
//               (`verify-ui-standard-divergence.mjs`) detects a consumer by the path fragment
//               `datasheet/DataSheet`; rename the folder and all 8 consumers silently become
//               undeclared bespoke surfaces. Its carrier list keys on the full path too —
//               `docs/standards/ui-control-standards.md` lines 18-19 move WITH this file or the
//               engine is measured as a divergence from itself.
// ⚠️ CULTIVAR COLOURS REMAIN IN `sheetStyles` (7x #27500A, 1x #EAF3DE) — an AC-4 debt CARRIED here,
//               not created here: packages/shared already held 35 occurrences across 20 files before
//               this file arrived. The fix is `design-system/tokens.ts` (which exports a per-vertical
//               palette and has ZERO importers), and it is owed against SHARED, not against this
//               component. Do not fix it here alone — 7 of 42 is a clean component in a package that
//               is not clean.
// INSTRUMENTATION (STD-003): the engine is silent; consumers emit `[TRACE:<area>]` on their
//               loads/writes (invsheet for inventory, assets for the asset grid).
// ============================================================
import { useState, useMemo, useEffect, Fragment } from 'react';
import { Plus, Minus, SlidersHorizontal, Search, Lock } from 'lucide-react';
import { lockInfoFor, type SystemFieldInfo } from './systemManagedFields';
import { planTracks, type PinnedTrack } from './columnOrder';
import { partitionFlagged } from './flagCounts';

/** G10's reserved track: the border-box width of the leading disclosure-toggle column. A fixed,
 *  deterministic width is the whole point — §6 r14's rule is that a pinned column's width must be
 *  its ACTUAL rendered width, or the left offsets stop accumulating and the scrolling columns pass
 *  underneath the pinned block (the #104/#105 defect). 36px holds a 14px glyph plus its padding. */
const EXPAND_TRACK_W = 36;

// ── Column descriptor: drives <thead>/<tbody> render, sort, the show/hide menu, the frozen-column
//    pin, and the system-managed lock. ──
export interface DataSheetColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortVal?: (r: T) => string | number;
  hideable?: boolean;        // default true (structural cols like a flag icon pass false)
  defaultVisible?: boolean;  // default true
  /** Pin this column to the left so it stays put on horizontal scroll (the name/identifier column).
   *  Only the LEADING contiguous run of frozen columns is pinned. */
  frozen?: boolean;
  /** RESERVED TRACK WIDTH (px, border-box incl. cell padding) of a frozen column. This is the frozen
   *  column's ACTUAL rendered width — it locks the cell width AND sets the next frozen col's left offset
   *  AND defines where the scrolling region begins (its right edge), so scrolling columns lay out BESIDE
   *  the frozen column and never render beneath it. Set it ≥ the cell content width (fixed-width input +
   *  ~19px padding). Required on EVERY frozen column for a deterministic track; defaults to 160 if omitted. */
  frozenWidth?: number;
  /** 🔴 G11 — THE RECORD'S IDENTIFIER COLUMN (Name / Item / Invoice #). EXACTLY ONE PER GRID.
   *  The pinned ACTIONS track is reserved immediately BEFORE it, which is what makes every grid on
   *  the platform read ACTIONS · NAME · DATA without any consumer choosing an order. Declaring it
   *  is not optional decoration: a grid that declares none falls back to actions-first (still
   *  conforming, see columnOrder.ts) and the grid-standard probe fails the file. */
  identifier?: boolean;
  /** Force the system-managed lock on/off, overriding the registry. Default: registry decides by key
   *  (see systemManagedFields.ts — the single source). `false` = force editable; `true` = force locked. */
  systemManaged?: boolean;
  /** Custom lock-popover text (overrides the registry reason). */
  lockReason?: string;
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
  /** A SECOND, independent quick-filter. Added 2026-09-07 for R-101: "needs a look" and "status"
   *  are different questions about a row, and folding them into one control would make
   *  `available` and `price disagreement` mutually exclusive when a row is routinely both.
   *  Optional and additive — every existing consumer renders exactly as before. */
  extraFilter?: StatusFilterConfig<T>;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  /** Highlight + count rows (e.g. dup-size collisions). Evaluated against the FULL row set — a flag
   *  is a fact about the data, not about the filter, so a row stays flagged when its twin is
   *  filtered out. */
  rowFlag?: (r: T) => boolean;
  /** Renders the banner, given the flagged rows the owner can SEE (`inView`) and those the active
   *  filter/search is hiding (`elsewhere`) — as two separate facts. Consumers must not add them
   *  together and call the sum "here": a banner naming a defect that is not in what the owner is
   *  looking at is D-9 inverted (it mis-attributes a real value rather than fabricating one), and
   *  it tells them to fix a row that is not on screen. Shown whenever either count is > 0. */
  flagBanner?: (inView: number, elsewhere: number) => React.ReactNode;
  /** Optional per-row detail drawer. When present, a trailing expand toggle column appears. */
  renderExpand?: (r: T) => React.ReactNode;
  /** Optional per-row action buttons (Edit / Add / Delete). When present, the engine renders them in
   *  a LEFT-PINNED track immediately BEFORE the column that declares `identifier: true` — G11's
   *  ACTIONS · NAME · DATA — so the actions stay reachable regardless of horizontal scroll AND land
   *  in the same place on every grid (STD-011 — one engine behavior, every consumer inherits it). */
  rowActions?: (r: T) => React.ReactNode;
  rowActionsHeader?: string;   // default '' (blank header)
  rowActionsWidth?: number;    // reserved-track width of the pinned actions column, px (default 128)
  /** Header buttons (Add, Capture, Start count…). */
  actions?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  itemNoun?: string; // "items" / "assets"
}

export function DataSheet<T>(props: DataSheetProps<T>) {
  const {
    title, rows, loading, error, getRowId, columns, searchText, searchPlaceholder,
    statusFilter, extraFilter, defaultSortKey, defaultSortDir = 'asc', rowFlag, flagBanner,
    renderExpand, rowActions, rowActionsHeader = '', rowActionsWidth = 128,
    actions, emptyIcon, emptyText = 'Nothing here yet.', itemNoun = 'items',
  } = props;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [extra, setExtra] = useState('all');
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns.find(c => c.sortable)?.key ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    for (const c of columns) v[c.key] = c.defaultVisible !== false;
    return v;
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Lock popover for a system-managed column — positioned fixed (escapes the scroll container's clip).
  const [lockPop, setLockPop] = useState<{ info: SystemFieldInfo; top: number; left: number } | null>(null);

  // [TRACE:datasheet] — one emit per mount/config: what the engine is rendering + how many columns
  // are pinned / system-locked. ON BY DEFAULT (standing owner instruction).
  useEffect(() => {
    console.log('[TRACE:datasheet] render', {
      title,
      columns: columns.length,
      frozen: columns.filter(c => c.frozen).length,
      systemManaged: columns.filter(c => lockInfoFor(c)).length,
      pinnedActions: !!rowActions,
      // G11 — the RESOLVED pinned order, left to right, and the identifier the actions track was
      // placed against. This is the one fact that used to be visible only by opening the app and
      // looking; a grid whose `identifier` is missing prints `identifier: null` here and lands
      // actions-first, which is the fallback saying so out loud rather than silently.
      identifier: columns.find(c => c.identifier)?.key ?? null,
      pinnedOrder: planTracks(columns.filter(c => c.defaultVisible !== false), {
        expandWidth: renderExpand ? EXPAND_TRACK_W : null,
        actionsWidth: rowActions ? rowActionsWidth : null,
      }).pinned.map(t => t.key).join(' · '),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  function openLock(e: React.MouseEvent, info: SystemFieldInfo) {
    e.stopPropagation(); // never trigger the column sort
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setLockPop({ info, top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 4, window.innerWidth - 288)) });
  }

  function toggleSort(key: string) {
    if (sortKey === key) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return; }
    setSortKey(key); setSortDir('asc');
  }
  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const view = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows;
    if (statusFilter && status !== 'all') out = out.filter(r => statusFilter.get(r) === status);
    // The second dimension is AND-ed with the first: they are different questions, so a row
    // must satisfy both to survive. Independent state, so clearing one does not clear the other.
    if (extraFilter && extra !== 'all') out = out.filter(r => extraFilter.get(r) === extra);
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
  }, [rows, search, status, statusFilter, extra, extraFilter, sortKey, sortDir, columns, searchText]);

  // Flagged rows, split by what the filter/search actually SHOWS. Computed AFTER `view` — deriving
  // it from `rows` (as it did) is exactly the defect: the count was of the whole catalog while the
  // banner rendered above the filtered view, so a clean screen still carried a red banner about a
  // collision somewhere else. The rule is pure and lives in flagCounts.ts, because it was
  // unreachable by any test while it lived inside this memo.
  const flags = useMemo(
    () => (rowFlag ? partitionFlagged(rows, view, rowFlag, getRowId) : { inView: 0, elsewhere: 0 }),
    [rows, view, rowFlag, getRowId],
  );

  const shownCols = columns.filter(c => visible[c.key]);
  const hideable = columns.filter(c => c.hideable !== false);

  // ── The pinned segment. THE ORDER IS G11's AND IT IS DECIDED IN `columnOrder.ts`, NOT HERE ──────
  //    [G10 toggle] · [gutter marks] · [ACTIONS] · [IDENTIFIER] · [rest of the frozen run] · scrolling.
  //    Each pinned track RESERVES its width (border-box), so the `left` offsets accumulate exactly and
  //    the scrolling region begins at the pinned block's right edge — scrolling columns lay out BESIDE
  //    the pinned block, never beneath it (§6 r14; the #104/#105 defect). The RIGHTMOST pinned track
  //    carries the freeze line + shadow. Computed over SHOWN columns, so hiding a column is safe.
  //
  // 🔴 THE ARITHMETIC LEFT THIS FILE ON PURPOSE (2026-09-07, G11). It used to be three `let`s and a
  //    loop sitting between two JSX blocks — a rule inside a .tsx, which is tech-debt #134's shape:
  //    unreachable by any probe, so the only way to know what order a grid rendered in was to open
  //    the app. `planTracks` is the same arithmetic with a test suite and a mutant board behind it.
  const plan = planTracks(shownCols, {
    expandWidth: renderExpand ? EXPAND_TRACK_W : null,
    actionsWidth: rowActions ? rowActionsWidth : null,
  });
  const scrollCols = plan.scrollKeys.map(k => shownCols.find(c => c.key === k)!);
  const frozenMap = new Map<string, { left: number; width: number; last: boolean }>();
  for (const t of plan.pinned) {
    if (t.kind === 'column') frozenMap.set(t.key, { left: t.left, width: t.width, last: t.last });
  }
  const pinnedCount = plan.pinned.length;

  // ── Shared header/body cell renderers (used by the frozen + scrolling segments alike). ──
  const headerCell = (col: DataSheetColumn<T>) => {
    const fz = frozenMap.get(col.key);
    const lock = lockInfoFor(col);
    const thStyle: React.CSSProperties = {
      ...S.th,
      ...(col.sortable ? S.thSortable : {}),
      ...(fz ? { left: fz.left, width: fz.width, minWidth: fz.width, boxSizing: 'border-box', zIndex: 3, background: '#fff', ...(fz.last ? S.frozenEdgeTh : {}) } : {}),
    };
    return (
      <th key={col.key} style={thStyle} onClick={col.sortable ? () => toggleSort(col.key) : undefined}>
        {col.header}
        {lock && (
          <button
            type="button"
            style={S.lockBtn}
            onClick={e => openLock(e, lock)}
            title="System-managed field — tap to learn why it isn't editable"
            aria-label={`${col.header || col.key}: system-managed, not editable — details`}
          >
            <Lock size={11} />
          </button>
        )}
        {col.sortable && sortKey === col.key && <span style={S.sortArrow}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </th>
    );
  };
  const bodyCell = (col: DataSheetColumn<T>, row: T, tdStyle: React.CSSProperties, flagged: boolean) => {
    const fz = frozenMap.get(col.key);
    const cellStyle = fz
      ? { ...tdStyle, left: fz.left, width: fz.width, minWidth: fz.width, boxSizing: 'border-box' as const, position: 'sticky' as const, zIndex: 1, background: flagged ? '#fffbeb' : '#fff', ...(fz.last ? S.frozenEdgeTd : {}) }
      : tdStyle;
    return <td key={col.key} style={cellStyle}>{col.render(row)}</td>;
  };

  // ── The pinned segment renders straight off the plan, so ORDER is never re-decided here (G11).
  //    A track is one of three kinds and each knows its own left/width; the plan already marked the
  //    rightmost one, which is the only track that carries the freeze edge. ──
  const pinnedHeader = (t: PinnedTrack) => {
    if (t.kind === 'column') return headerCell(shownCols.find(c => c.key === t.key)!);
    const style: React.CSSProperties = {
      ...S.th, left: t.left, width: t.width, minWidth: t.width, boxSizing: 'border-box',
      zIndex: 3, background: '#fff', ...(t.last ? S.frozenEdgeTh : {}),
    };
    return t.kind === 'expand'
      ? <th key={t.key} style={style} aria-label="Details" />
      : <th key={t.key} style={style}>{rowActionsHeader}</th>;
  };
  const pinnedCell = (
    t: PinnedTrack, row: T, tdStyle: React.CSSProperties, flagged: boolean, id: string, isOpen: boolean,
  ) => {
    if (t.kind === 'column') return bodyCell(shownCols.find(c => c.key === t.key)!, row, tdStyle, flagged);
    const style = {
      ...tdStyle, left: t.left, width: t.width, minWidth: t.width, boxSizing: 'border-box' as const,
      position: 'sticky' as const, zIndex: 1, background: flagged ? '#fffbeb' : '#fff',
      ...(t.last ? S.frozenEdgeTd : {}),
    };
    if (t.kind === 'actions') return <td key={t.key} style={style}>{rowActions!(row)}</td>;
    return (
      <td key={t.key} style={style}>
        <button
          style={S.expandBtn}
          onClick={ev => { ev.stopPropagation(); toggleExpand(id); }}
          aria-expanded={isOpen}
          title={isOpen ? 'Hide details' : 'Show details'}
        >
          {isOpen ? <Minus size={14} /> : <Plus size={14} />}
        </button>
      </td>
    );
  };

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
              {extraFilter && (
                <select style={S.toolSelect} value={extra} onChange={e => setExtra(e.target.value)} title={extraFilter.label ?? 'Filter'}>
                  <option value="all">All {extraFilter.label ?? 'rows'}</option>
                  {extraFilter.options.map(o => <option key={o} value={o}>{o}</option>)}
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

            {/* 🔴 ONE FLEX CHILD, NOT N — see `dupBannerText` for why. */}
            {rowFlag && flagBanner && (flags.inView > 0 || flags.elsewhere > 0) && (
              <div style={S.dupBanner}><span style={S.dupBannerText}>{flagBanner(flags.inView, flags.elsewhere)}</span></div>
            )}

            {/* Table — bounded scroll box: sticky header (top) + frozen identifier column (left),
                so the horizontal scrollbar sits at the bottom of the VIEWPORT-BOUNDED box (reachable
                without scrolling past every row) and you never lose the header row or which row you're on. */}
            <div style={S.scroll}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {plan.pinned.map(t => pinnedHeader(t))}
                    {scrollCols.map(headerCell)}
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
                        {/* 🔴 G10 second half — THE ROW IS THE CLICK TARGET, and the guard is the
                            load-bearing part. `closest()` walks up from whatever was actually
                            clicked, so a click that STARTED in an input, button, link, select or
                            label never reaches the toggle. Without it this swallows inline edit
                            (G8) on the six editable consumers and every in-cell link — the reason
                            the clause carries that exclusion in writing. A grid with no
                            `renderExpand` gets no handler at all, so no mystery click target. */}
                        <tr
                          onClick={renderExpand ? (e => {
                            if ((e.target as HTMLElement).closest('input,button,a,select,label,textarea,[role="button"]')) return;
                            toggleExpand(id);
                          }) : undefined}
                          style={renderExpand ? { cursor: 'pointer' } : undefined}
                        >
                          {plan.pinned.map(t => pinnedCell(t, row, tdStyle, flagged, id, isOpen))}
                          {scrollCols.map(col => bodyCell(col, row, tdStyle, flagged))}
                        </tr>
                        {renderExpand && isOpen && (
                          <tr style={S.expandRow}>
                            <td colSpan={scrollCols.length + pinnedCount} style={{ padding: 0 }}>
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

      {/* System-managed lock popover — fixed so the scroll container can't clip it. */}
      {lockPop && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setLockPop(null)} />
          <div style={{ ...S.lockCard, top: lockPop.top, left: lockPop.left }}>
            <div style={S.lockCardHead}><Lock size={13} /> System-managed — not editable</div>
            <p style={S.lockCardBody}><b>{lockPop.info.label}.</b> {lockPop.info.reason}</p>
          </div>
        </>
      )}
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
  // 🔴 THE CARD CARRIES THE BOUND, AND THE SCROLL BOX TAKES WHAT IS LEFT (G2, amended 2026-09-07).
  // It used to be the other way round: the box owned a fixed `calc(100vh - 280px)` and the card
  // grew to fit it. That is bounded but NOT ROBUST — the number cannot know about anything rendered
  // ABOVE the box inside this card, so the "needs a look" banner made the grid taller and pushed
  // the box's bottom edge, **and its horizontal scrollbar**, below the fold. David, live:
  // *"nobody scrolls to the bottom of a page to find the control that scrolls right"* — and the
  // columns past that fold were price, size and variant group, the exact three the banner tells
  // her to edit. A flag naming a fix she cannot reach.
  // As a flex column the card absorbs the banner, the toolbar and anything added later by SHRINKING
  // the box rather than displacing it, and there is no per-consumer number to re-tune.
  card: { background: '#fff', borderRadius: 12, padding: '1.25rem', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 190px)' } as React.CSSProperties,
  toolbar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const } as React.CSSProperties,
  searchWrap: { display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.4rem 0.6rem', background: '#fff', minWidth: 220 } as React.CSSProperties,
  searchInput: { border: 'none', outline: 'none', fontSize: '0.9rem', color: '#111827', width: '100%', background: 'transparent' } as React.CSSProperties,
  toolSelect: { border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.85rem', color: '#111827', background: '#fff', cursor: 'pointer' } as React.CSSProperties,
  colBtn: { display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.7rem', background: '#fff', color: '#374151', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  colMenu: { position: 'absolute' as const, top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: '0.5rem', zIndex: 50, minWidth: 190, maxHeight: 320, overflowY: 'auto' as const } as React.CSSProperties,
  colMenuItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0.5rem', fontSize: '0.85rem', color: '#374151', cursor: 'pointer', borderRadius: 6 } as React.CSSProperties,
  countPill: { fontSize: '0.8rem', color: '#6b7280', marginLeft: 'auto' } as React.CSSProperties,
  // 🔴 ONE FLEX CHILD, NOT N. `dupBanner` is `display:flex` with a gap, so EVERY element a consumer
  // puts in its banner — each emphasis tag, each text run — became its own flex item, and the
  // sentence rendered ONE WORD PER LINE. David, 2026-09-07, reading the inventory banner off a
  // printout: *"Edit the / price / , / the / size / , / the / variant group."* Wrapping the
  // consumer's output in a single block makes it one item and lets the text flow normally.
  // Fixed in the ENGINE so all eight consumers inherit it (STD-011) — a banner carrying inline
  // emphasis is the ordinary case, not a special one, and every consumer would have hit this.
  dupBannerText: { display: 'block', lineHeight: 1.55 } as React.CSSProperties,
  dupBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.83rem', marginBottom: 12 } as React.CSSProperties,
  // Bounded scroll box: BOTH scrollbars live on this container (not the page), so the horizontal
  // scrollbar is reachable within the viewport instead of below all N rows. The offset leaves room
  // for the AppLayout header + breadcrumb + page title + toolbar chrome above, so the box bottom
  // (and its horizontal scrollbar) stays on-screen (tune the offset if chrome height changes).
  // Negative horizontal margin bleeds the grid FLUSH to the card edges (cancels the card's 1.25rem
  // side padding) — zero left gutter, so the frozen identifier column gets that reclaimed room and
  // more columns fit before horizontal scroll kicks in. Cell padding keeps content off the edge.
  // `flex:1` takes the remainder of the card; `minHeight:0` is LOAD-BEARING — a flex item defaults
  // to `min-height:auto`, which refuses to shrink below its content and would let the table push
  // the box past the card's bound, undoing the whole thing.
  scroll: { overflow: 'auto', flex: 1, minHeight: 0, position: 'relative' as const, margin: '0 -1.25rem' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.85rem' } as React.CSSProperties,
  // Sticky header row — stays visible on vertical scroll. box-shadow (not just borderBottom) keeps the
  // underline drawn during scroll under border-collapse. Opaque bg so body rows don't show through.
  th: { textAlign: 'left' as const, padding: '0.5rem 0.6rem', borderBottom: '2px solid #e5e7eb', boxShadow: 'inset 0 -2px 0 #e5e7eb', color: '#374151', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, userSelect: 'none' as const, position: 'sticky' as const, top: 0, zIndex: 2, background: '#fff' } as React.CSSProperties,
  thSortable: { cursor: 'pointer' } as React.CSSProperties,
  // Freeze boundary on the last frozen (pinned) column: a crisp 1px line (1px 0 0 0) marks the freeze
  // edge — the standard "frozen pane" affordance — and the soft depth shadow delineates the pinned block
  // from the scrolling columns behind it. The th variant also re-declares the sticky-header underline
  // (spread wins). borderCollapse eats real borders on scroll, so the line is drawn via box-shadow.
  frozenEdgeTh: { boxShadow: 'inset 0 -2px 0 #e5e7eb, 1px 0 0 0 #d1d5db, 8px 0 8px -5px rgba(0,0,0,0.14)' } as React.CSSProperties,
  frozenEdgeTd: { boxShadow: '1px 0 0 0 #d1d5db, 8px 0 8px -5px rgba(0,0,0,0.10)' } as React.CSSProperties,
  // System-managed lock affordance + its popover.
  lockBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 5, color: '#9ca3af', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' } as React.CSSProperties,
  lockCard: { position: 'fixed' as const, zIndex: 201, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.16)', padding: '0.75rem 0.85rem', maxWidth: 272 } as React.CSSProperties,
  lockCardHead: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'none' as const } as React.CSSProperties,
  lockCardBody: { margin: 0, fontSize: '0.8rem', lineHeight: 1.45, color: '#4b5563', textTransform: 'none' as const } as React.CSSProperties,
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
