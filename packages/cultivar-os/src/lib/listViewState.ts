// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      A list's VIEW — what is typed in the search box, which quick-filters are set,
//               which column sorts and which way — carried in the URL instead of in component
//               state, so Back, a refresh and a pasted link all restore the same screen.
// DEPENDENCIES: none — pure. No React, no router, no DataSheet.
// OUTPUTS:      ListViewState · parseViewState() · viewStateToSearch() · viewStateIsDefault().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE DEFECT, AS DAVID HIT IT: filter the customers list to "dubec", open the customer, press
// Back — and the FULL UNFILTERED LIST returns. The view lived in `useState` inside the grid, so
// leaving the page destroyed it and coming back rebuilt the default. Nothing was saved anywhere
// a browser could restore from.
//
// This is R-170's shape one layer out. The URL is the thing that FULFILS "take me back to what I
// was looking at" — the browser, the Back button, a refresh and a shared link all read it. State
// held beside it in a component is a second copy the browser cannot see, and the copy the browser
// cannot see is the one that gets lost.
//
// ⚠️ KEPT DELIBERATELY SMALL AND STRINGLY-TYPED. These values land in a URL a person may edit,
// share or bookmark, so every field round-trips as text and an unreadable value falls back to the
// default rather than throwing — a malformed link must show the ordinary list, never an error.
// ⚠️ AND A DEFAULT VIEW WRITES NO PARAMETERS AT ALL (`viewStateIsDefault`): /customers stays
// /customers until you actually filter something. A URL that grows `?q=&sort=&dir=asc` on every
// page load is noise in the address bar and in every link anybody copies.
// ─────────────────────────────────────────────────────────────────────────────

// Not exported for the same reason as backTarget's `Journey`: the page holds it as `typeof view`
// and never names the type, so an exported alias nobody imports is dead weight (knip is right).
interface ListViewState {
  /** The search box. */
  q: string;
  /** The column key being sorted on ('' = the grid's own default). */
  sort: string;
  /** Sort direction. */
  dir: 'asc' | 'desc';
  /** The first quick-filter ('all' = off). */
  status: string;
  /** The second, independent quick-filter ('all' = off). */
  extra: string;
}

export const DEFAULT_VIEW_STATE: ListViewState = { q: '', sort: '', dir: 'asc', status: 'all', extra: 'all' };

/** Read a view out of a URL query string. Anything missing or unreadable takes its default. */
export function parseViewState(search: string | URLSearchParams): ListViewState {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search;
  const dirRaw = (p.get('dir') ?? '').toLowerCase();
  return {
    q: p.get('q') ?? '',
    sort: p.get('sort') ?? '',
    // 🔴 An unreadable direction is 'asc', not an error and not 'desc'. A person editing a link by
    // hand must never be able to produce a broken screen (D-9: honest default over a thrown page).
    dir: dirRaw === 'desc' ? 'desc' : 'asc',
    status: p.get('status') ?? 'all',
    extra: p.get('extra') ?? 'all',
  };
}

/** True when nothing is filtered or re-sorted — the view the page opens with. */
export function viewStateIsDefault(v: ListViewState): boolean {
  return v.q.trim() === '' && v.sort === '' && v.dir === 'asc' && v.status === 'all' && v.extra === 'all';
}

/**
 * The query string for a view — EMPTY when the view is the default one.
 *
 * Only non-default fields are written, so a link carries what was actually chosen and nothing
 * else. `q` is written with its whitespace trimmed off the ends but otherwise verbatim: a search
 * for "  dubec  " and one for "dubec" are the same search, and the URL should say so.
 */
export function viewStateToSearch(v: ListViewState): string {
  if (viewStateIsDefault(v)) return '';
  const p = new URLSearchParams();
  if (v.q.trim() !== '') p.set('q', v.q.trim());
  if (v.sort !== '') p.set('sort', v.sort);
  if (v.dir !== 'asc') p.set('dir', v.dir);
  if (v.status !== 'all') p.set('status', v.status);
  if (v.extra !== 'all') p.set('extra', v.extra);
  return p.toString();
}

/** The full path a link should carry to reproduce this view of this list. */
export function listHref(pathname: string, v: ListViewState): string {
  const s = viewStateToSearch(v);
  return s === '' ? pathname : `${pathname}?${s}`;
}
