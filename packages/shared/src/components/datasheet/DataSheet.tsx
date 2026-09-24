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
import { matchesHaystack } from './searchSpec';
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
import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { countPillText } from './countPill';
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
  /** 🔴 GROUP THE LIST INTO A–Z SECTIONS INSIDE ONE SCROLL, with a letter index that JUMPS to
   *  them — the contacts-app pattern (David, 2026-09-22). OPT-IN: a consumer that does not pass
   *  this renders EXACTLY as it did, which is what keeps the engine's other seven screens out of
   *  this build (probe AZ7 is the negative control).
   *
   *  · `keyOf`  — which section a row belongs to ('A'–'Z', '#').
   *  · `keys`   — every section the index offers, in strip order (empty ones render disabled).
   *  · `sortKey`— the COLUMN whose ascending sort actually produces those groups.
   *
   *  ⚠️ `sortKey` IS NOT BOOKKEEPING. A section heading is a claim that everything under it
   *  belongs to that letter (§6 r18), and that is only true while the grid is sorted that way.
   *  Sort by "Added" and the headings would be scattered lies, so they are WITHDRAWN instead —
   *  and pressing a letter restores the grouping sort before it jumps, so the index never
   *  silently does nothing.
   *
   *  🔴 IT LIVES IN THE GRID BECAUSE THE GRID OWNS THE COUNT CLAIM. Doing this outside — filtering
   *  the rows and handing over the subset — was the first design and it was measured dishonest:
   *  with 77 of LAWNS's 2,005 customers passed in, `countPillText` sees `loaded 77 < total 2005`
   *  and renders **"showing 77 of 2005 customers"**, the sentence that means *the read was
   *  truncated* — the exact lie `countPill.ts` exists to prevent (it shipped `1000 of 1000` over
   *  1,964 rows). Only the grid holds both numbers, so only the grid can tell a reader's choice
   *  from a short read. */
  sectionIndex?: { keyOf: (row: T) => string; keys: readonly string[]; sortKey: string; label?: string };
  /** 🔴 LIFT THE VIEW OUT OF THE GRID so the consumer can put it in the URL. Optional: a grid
   *  that does not pass it keeps its own state and behaves exactly as before.
   *
   *  WHY IT IS A PROP AND NOT A ROUTER CALL INSIDE THIS FILE: this engine is presentational by
   *  contract — no supabase, no business context, no permission hook, NO ROUTER (see the header).
   *  Reading `useSearchParams` here would put react-router into eight screens' shared dependency
   *  for the sake of one of them. The page owns the URL; the grid owns the grid.
   *
   *  The defect it fixes: filter the customer list, open a customer, press Back — the full
   *  unfiltered list returns, because the view lived in `useState` and leaving the page destroyed
   *  it. The browser cannot restore state it was never shown. */
  viewState?: { q: string; status: string; extra: string; sort: string; dir: 'asc' | 'desc' };
  onViewStateChange?: (next: { q: string; status: string; extra: string; sort: string; dir: 'asc' | 'desc' }) => void;
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
  /**
   * 🔴 THE TRUE ROW COUNT IN THE TABLE, when `rows` is only a PAGE of it.
   *
   * `rows.length` is what the grid was HANDED, which is not the same claim as how many exist.
   * PostgREST caps an unbounded `.select()` at 1000, so a 1,964-row customers table rendered
   * `1000 of 1000` — the list reporting its own cap as the truth, and the 1,000th customer was
   * the last one that existed as far as anyone reading the screen could tell. It was honest on
   * `/inventory` (647 rows) for the sole reason that 647 is under the cap.
   *
   * A consumer that reads a bounded page passes the `count: 'exact'` total here and the pill says
   * `showing N of TOTAL`. Omitted → the grid holds everything and `rows.length` IS the total
   * (D-9: a surface may only assert what it was actually given). */
  totalRows?: number | null;
}

export function DataSheet<T>(props: DataSheetProps<T>) {
  const {
    title, rows, loading, error, getRowId, columns, searchText, searchPlaceholder,
    statusFilter, extraFilter, sectionIndex, viewState, onViewStateChange, defaultSortKey, defaultSortDir = 'asc', rowFlag, flagBanner,
    renderExpand, rowActions, rowActionsHeader = '', rowActionsWidth = 128,
    actions, emptyIcon, emptyText = 'Nothing here yet.', itemNoun = 'items', totalRows = null,
  } = props;

  const [searchOwn, setSearchOwn] = useState('');
  const [statusOwn, setStatusOwn] = useState('all');
  const [extraOwn, setExtraOwn] = useState('all');
  // The letter a press asked to reach. Held in state rather than scrolled immediately, because
  // a press may first have to restore the grouping sort — the heading it wants does not exist in
  // the DOM until that render has happened. Cleared by the effect that performs the jump.
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [sortKeyOwn, setSortKeyOwn] = useState<string>(defaultSortKey ?? columns.find(c => c.sortable)?.key ?? '');
  const [sortDirOwn, setSortDirOwn] = useState<'asc' | 'desc'>(defaultSortDir);

  // ── CONTROLLED OR NOT, decided once, here ──────────────────────────────────────────────────
  // With `viewState` the page is the source of truth (and puts it in the URL); without it the
  // grid keeps its own. Every read below goes through these five names, so no call site has to
  // know which mode it is in — and a half-controlled grid, where some controls write to the URL
  // and others to local state, is not representable.
  const controlled = !!viewState && !!onViewStateChange;
  const search  = controlled ? viewState!.q : searchOwn;
  const status  = controlled ? viewState!.status : statusOwn;
  const extra   = controlled ? viewState!.extra : extraOwn;
  // An empty `sort` in the URL means "the grid's default", not "no sort" — so a link that
  // carries no sort still opens the list the way the page opens it.
  const sortKey = controlled && viewState!.sort !== '' ? viewState!.sort : sortKeyOwn;
  const sortDir = controlled ? viewState!.dir : sortDirOwn;
  const emit = (patch: Partial<{ q: string; status: string; extra: string; sort: string; dir: 'asc' | 'desc' }>) =>
    onViewStateChange!({ q: search, status, extra, sort: sortKey, dir: sortDir, ...patch });
  const setSearch = (v: string) => (controlled ? emit({ q: v }) : setSearchOwn(v));
  const setStatus = (v: string) => (controlled ? emit({ status: v }) : setStatusOwn(v));
  const setExtra  = (v: string) => (controlled ? emit({ extra: v }) : setExtraOwn(v));
  const setSortDir = (v: 'asc' | 'desc') => (controlled ? emit({ dir: v }) : setSortDirOwn(v));
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
    // Value, not updater: the setters above may write to the page's URL state, which has no
    // functional form — and reading `sortDir` here is equivalent because it is already resolved.
    if (sortKey === key) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); return; }
    // 🔴 ONE EMIT, NOT TWO. In controlled mode each setter sends the WHOLE view, built from the
    // values of this render — so `setSortKey(key)` followed by `setSortDir('asc')` would send the
    // new key, then immediately send the OLD key again with the new direction, silently undoing
    // the first. Changing two fields at once has to be one message.
    if (controlled) { emit({ sort: key, dir: 'asc' }); return; }
    setSortKeyOwn(key); setSortDirOwn('asc');
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
    // 🔴 ONE MATCHER, EVERY SURFACE (ledger #388, David 2026-09-23). This was
    // `searchText(r).toLowerCase().includes(q)` — a plain substring, which meant the roster could
    // not match "creek shoal" against "Shoal Creek Vitex" (checkout's own search always could),
    // and could not find "Centre Court" when Lauren typed "Center". `matchesHaystack` is the
    // SHARED rule: folded substring, then token subset. **Every DataSheet consumer gains both.**
    if (q) out = out.filter(r => matchesHaystack(searchText(r), q));
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
  // 🔴 GROUPING IS A PROPERTY OF THE CURRENT SORT, NOT A SETTING. Headings may only appear while
  // the grid is actually ordered by the column that produces them; under any other sort the
  // sections would be scattered and each heading would be a false claim about the rows beneath it.
  const grouped = !!sectionIndex && sortKey === sectionIndex.sortKey && sortDir === 'asc';

  // How many rows sit under each letter — counted over `view`, the rows a reader can actually
  // reach, because a jump can only land on a heading that is rendered. A letter holding rows that
  // the search has hidden must read 0 and refuse the press, or it is a control that does nothing.
  const sectionCounts = useMemo(
    () => {
      const m = new Map<string, number>();
      if (!sectionIndex) return m;
      for (const k of sectionIndex.keys) m.set(k, 0);
      for (const r of view) { const k = sectionIndex.keyOf(r); m.set(k, (m.get(k) ?? 0) + 1); }
      return m;
    },
    [view, sectionIndex],
  );

  // The scroll box and one ref per rendered heading, so a jump can measure rather than guess.
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const headRowRef = useRef<HTMLTableSectionElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  /** Press a letter: restore the grouping sort if it is not active, then jump once it renders. */
  function jumpToSection(k: string): void {
    if (!sectionIndex) return;
    if (!grouped) {
      if (controlled) emit({ sort: sectionIndex.sortKey, dir: 'asc' });
      else { setSortKeyOwn(sectionIndex.sortKey); setSortDirOwn('asc'); }
    }
    setPendingJump(k);
  }

  useEffect(() => {
    if (!pendingJump) return;
    const box = scrollBoxRef.current;
    const row = sectionRefs.current.get(pendingJump);
    // The heading is not in the DOM yet on the render that restored the sort — keep the request
    // and let the next render satisfy it, rather than silently dropping the press.
    if (!box || !row) return;
    // Measured, not computed from row heights: the header is sticky and its height is whatever the
    // consumer's columns make it, so the only honest offset is the one the browser reports.
    const stick = headRowRef.current?.getBoundingClientRect().height ?? 0;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - stick;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    setPendingJump(null);
  }, [pendingJump, grouped, view]);

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
              {/* 🔴 THE PILL MAY ONLY CLAIM WHAT IT WAS GIVEN — the arithmetic lives in
                  `countPill.ts` so a probe can reach it, not inline here where it shipped
                  `1000 of 1000` over 1,964 rows. */}
              <span style={S.countPill}>{countPillText({
                visible: view.length, loaded: rows.length, total: totalRows,
                // 🔴 EVERY DIMENSION THAT NARROWS THE VIEW COUNTS AS FILTERED — `extra` WAS MISSING.
                // Picking a value in the SECOND dropdown alone made the pill read `12 of 647 items`
                // — the POPULATION sentence — while a filter was active (§6 r18: a header's
                // assertion must hold for every row the section can contain). That is live on
                // /inventory today, found while building the A–Z index and fixed in passing
                // because this build touches this exact claim (§1.6 fix-all-in-one-pass).
                // ⚠️ THE LETTER INDEX IS DELIBERATELY NOT IN THIS LIST: it JUMPS, it does not
                // filter, so every row is still shown and the pill must not claim otherwise.
                filtered: status !== 'all' || extra !== 'all' || !!search, itemNoun,
              })}</span>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════════════
                A–Z STRIP. Rendered only when a consumer asks for one.

                🔴 IT FILTERS; IT DOES NOT SCROLL TO A SECTION — A DELIBERATE DIVERGENCE (§6 r16).
                The industry standard for an alphabetical index over a long list is a JUMP: the
                iOS section index, the Windows jump list, Material's fast-scroll all scroll the
                list to that letter's first row and leave the rest in place. Filtering is not
                that, and the difference is recorded rather than discovered.
                WHY THE DIVERGENCE: a jump needs the engine to hold a ref per row and expose a
                scroll API — a change to the one grid /inventory, /assets and six other screens
                render, for an ergonomic gain over a list that already has a search box. Filtering
                reaches the same outcome ("show me the Ms") with a `filter` that cannot break the
                frozen-column track, the sticky header or the bounded scroll box (§6 r14).
                CONVERGE WHEN: the roster wants section headings inside ONE scroll, which filtering
                genuinely cannot do — then the jump is the right build, on its own.

                ⚠️ A LETTER NOBODY USES IS DISABLED, NOT HIDDEN. Hiding empty letters makes a
                complete alphabet look like it has gaps; leaving them live is a control that does
                nothing when pressed (§1.6 item 5, no dead affordance). It renders greyed with its
                zero in the title, which is the honest third option.
                ══════════════════════════════════════════════════════════════════════════════ */}
            {sectionIndex && (
              <div style={S.alphaStrip} role="group" aria-label={sectionIndex.label ?? 'Jump to a letter'}>
                {sectionIndex.keys.map(k => {
                  const n = sectionCounts.get(k) ?? 0;
                  const empty = n === 0;
                  return (
                    <button
                      key={k}
                      disabled={empty}
                      style={empty ? S.alphaKeyOff : S.alphaKey}
                      onClick={() => jumpToSection(k)}
                      title={empty ? `No ${itemNoun} under ${k}` : `Jump to ${k} — ${n} ${itemNoun}`}
                    >{k}</button>
                  );
                })}
                {!grouped && (
                  // 🔴 SAY WHAT THE PRESS WILL DO, BEFORE IT DOES IT. The reader sorted by another
                  // column; pressing a letter will put the list back in filing order. Doing that
                  // silently would look like the grid undoing their sort by itself.
                  <span style={S.alphaNote}>sorted another way — a letter returns to A–Z order</span>
                )}
              </div>
            )}

            {/* 🔴 ONE FLEX CHILD, NOT N — see `dupBannerText` for why. */}
            {rowFlag && flagBanner && (flags.inView > 0 || flags.elsewhere > 0) && (
              <div style={S.dupBanner}><span style={S.dupBannerText}>{flagBanner(flags.inView, flags.elsewhere)}</span></div>
            )}

            {/* Table — bounded scroll box: sticky header (top) + frozen identifier column (left),
                so the horizontal scrollbar sits at the bottom of the VIEWPORT-BOUNDED box (reachable
                without scrolling past every row) and you never lose the header row or which row you're on. */}
            <div style={S.scroll} ref={scrollBoxRef}>
              <table style={S.table}>
                <thead ref={headRowRef}>
                  <tr>
                    {plan.pinned.map(t => pinnedHeader(t))}
                    {scrollCols.map(headerCell)}
                  </tr>
                </thead>
                <tbody>
                  {view.map((row, i) => {
                    const id = getRowId(row);
                    // ── A–Z SECTION HEADING ────────────────────────────────────────────────
                    // Emitted when the section CHANGES between two consecutive rows, so the
                    // headings are derived from the order actually on screen rather than from a
                    // second grouping pass that could disagree with it. Only while `grouped` —
                    // under any other sort a heading would be a false claim (§6 r18).
                    const sectionKey = grouped && sectionIndex ? sectionIndex.keyOf(row) : null;
                    const startsSection = sectionKey !== null
                      && (i === 0 || sectionIndex!.keyOf(view[i - 1]) !== sectionKey);
                    const flagged = rowFlag ? rowFlag(row) : false;
                    const isOpen = expanded.has(id);
                    const tdStyle = { ...S.td, ...(flagged ? S.tdDup : {}) };
                    return (
                      <Fragment key={id}>
                        {startsSection && (
                          <tr
                            ref={el => { if (el && sectionKey) sectionRefs.current.set(sectionKey, el); }}
                            style={S.sectionRow}
                          >
                            <td colSpan={scrollCols.length + pinnedCount} style={S.sectionCell}>
                              {/* Pinned to the left edge of the BOX, not of the table, so the
                                  letter stays readable when the grid is scrolled sideways — the
                                  same reasoning as the frozen identifier column (§6 r14). */}
                              <span style={S.sectionLabel}>{sectionKey}</span>
                            </td>
                          </tr>
                        )}
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
  // A dense index control: 27 targets on one line. The 48px touch minimum (§1.6 item 5) is
  // deliberately NOT applied here and the reason is arithmetic — 27 × 48px is 1,296px, wider than
  // the screen, so the rule's own goal (a target you can hit) is better served by a compact strip
  // on a surface that is desktop-first by ruling (capture = mobile, reconcile = desktop).
  sectionRow: { background: '#f3f6ee' } as React.CSSProperties,
  sectionCell: { padding: 0, borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  sectionLabel: { position: 'sticky' as const, left: 0, display: 'inline-block', padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 800, color: '#27500A', letterSpacing: '0.04em' } as React.CSSProperties,
  alphaNote: { alignSelf: 'center', marginLeft: 6, fontSize: '0.75rem', color: '#6b7280' } as React.CSSProperties,
  alphaStrip: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 12 } as React.CSSProperties,
  alphaKey: { minWidth: 30, minHeight: 32, padding: '0.3rem 0.4rem', border: '1.5px solid #d1d5db', borderRadius: 7, background: '#fff', color: '#374151', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  alphaKeyOn: { minWidth: 30, minHeight: 32, padding: '0.3rem 0.4rem', border: '1.5px solid #27500A', borderRadius: 7, background: '#27500A', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
  alphaKeyOff: { minWidth: 30, minHeight: 32, padding: '0.3rem 0.4rem', border: '1.5px solid #f3f4f6', borderRadius: 7, background: '#f9fafb', color: '#d1d5db', fontSize: '0.8rem', fontWeight: 700, cursor: 'not-allowed' } as React.CSSProperties,
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
  // 🔴 V4 (§8, R-150, 2026-09-12) — THE SHEET IS A BOUNDED FLEX COLUMN AND ITS ACTION ROW DOES NOT
  // SCROLL. It used to be ONE box with `overflowY:'auto'`, so the header, the fields AND the Save/Cancel
  // row scrolled together: a tall dialog pushed its own commit controls below the visible area and the
  // reader had to scroll INSIDE the modal to find them. Reported live on Edit customer 2026-09-12.
  //
  // ⚠️ **THIS IS G2's 2026-09-07 AMENDMENT FOR THE THIRD TIME, NOT A NEW IDEA** — *"the bound must
  // survive anything rendered above the box inside its own card … a fixed maxHeight is bounded but not
  // robust: it cannot know about a banner, a notice or a second filter row added later."* Same defect,
  // three surfaces: the inventory h-scrollbar (G2), the save-a-site panel (§8 V1–V3), a dialog's action
  // row (V4). **The shape is the one already correct at DataSheet.tsx:580** — the card is a flex column
  // carrying the bound, the scrolling region takes the remainder (`flex:1; minHeight:0`), and anything
  // pinned is a sibling that SHRINKS the scroll box instead of displacing it. No magic number to re-tune.
  //
  // Consumers compose three parts: `sheetHeader` (pinned) · `sheetBody` (scrolls) · `sheetActions` (pinned).
  // Padding moved OFF the sheet and onto the parts, so the scrollbar runs the full height of the body.
  sheet: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh',
           display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' as const,
           boxSizing: 'border-box' as const } as React.CSSProperties,
  /** The scrolling region. `minHeight:0` is load-bearing — without it a flex child refuses to shrink. */
  sheetBody: { flex: 1, minHeight: 0, overflowY: 'auto' as const, padding: '0 1.5rem 1.25rem' } as React.CSSProperties,
  /** The commit controls. Pinned: V4 — a dialog that hides its own Save is the §8 defect one level down. */
  sheetActions: { flexShrink: 0, display: 'flex', gap: 10, padding: '1rem 1.5rem',
                  borderTop: '1px solid #e5e7eb', background: '#fff' } as React.CSSProperties,
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '1.5rem 1.5rem 1rem' } as React.CSSProperties,
  // expand-drawer inner used by inventory
  expandInner: { padding: '0.75rem 1rem', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 } as React.CSSProperties,
  metaGrid: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: '0.8rem', color: '#374151', alignContent: 'start' as const } as React.CSSProperties,
  metaKey: { color: '#6b7280', fontWeight: 600 } as React.CSSProperties,
  muted: { color: '#6b7280', fontSize: '0.8rem' } as React.CSSProperties,
  skuText: { fontSize: '0.78rem', color: '#6b7280' } as React.CSSProperties,
  dupTag: { display: 'inline-flex', alignItems: 'center', gap: 3, color: '#92400e', fontSize: '0.7rem', fontWeight: 700 } as React.CSSProperties,
};
