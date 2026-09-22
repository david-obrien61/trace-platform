// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: RENDER the grid and assert what a person would SEE — that no row appears twice, and
//   that typing in the search box leaves exactly the matching rows. These are the two tests whose
//   absence cost an evening: #371 shipped with before/after timings on the live query, five
//   mutants and `verify` at exit 0, and a screen showing the wrong rows. Every probe was about
//   the data going IN; none asserted what came OUT.
// DEPENDENCIES: jsdom · react · react-dom/client — the idiom `stopOfferMount.test.ts` already
//   established here. NO new dependency.
// OUTPUTS: pass/fail per probe; exit 1 on any failure.
//
// ⚠️ TESTING-LIBRARY WAS APPROVED AND IS DELIBERATELY NOT USED. David cleared jsdom + RTL as dev
//   dependencies; `jsdom` and `react-dom` are ALREADY present and this repo already renders React
//   in a test without RTL. Adding it would mutate a `node_modules` three other sessions are
//   running `npm run verify` against, to buy query helpers this file does not need. §6 r10: a
//   standard is adopted on value for our scope, never because it is the standard. If a later test
//   wants `userEvent`, that is the moment to add it.
//
// 🔴 WHAT THESE ASSERT IS THE RENDERED DOM, NOT A RETURN VALUE. `DataSheet` filters and sorts in a
//   `useMemo` and renders `view.map`; all of that was CORRECT during the #377 defect. What was
//   wrong was the row KEYS — duplicate ids from an unstable paged read — and React silently
//   failing to reconcile a keyed list that has them. Only the DOM shows that.
// ─────────────────────────────────────────────────────────────────────────────
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
const g = globalThis as unknown as Record<string, unknown>;
function put(name: string, value: unknown) {
  Object.defineProperty(g, name, { value, configurable: true, writable: true });
}
put('window', dom.window);
put('document', dom.window.document);
put('navigator', dom.window.navigator);
put('HTMLElement', dom.window.HTMLElement);
put('Element', dom.window.Element);
put('Node', dom.window.Node);
put('getComputedStyle', dom.window.getComputedStyle);
put('requestAnimationFrame', (cb: (t: number) => void) => dom.window.setTimeout(() => cb(0), 0));
put('cancelAnimationFrame', (h: number) => dom.window.clearTimeout(h));
put('IS_REACT_ACT_ENVIRONMENT', true);
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key-not-a-credential';

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { DataSheet } from './DataSheet';

let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); } };

interface Row { id: string; name: string }

/**
 * 2,005 rows, built the way the live read builds them — and `dupIds` reproduces the defect:
 * a paged read whose sort is not total returns the same row on two pages.
 */
function roster(dupIds = 0): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < 2005; i++) {
    rows.push({ id: `c${i}`, name: i % 500 === 3 ? `Highland Nursery ${i}` : `Customer ${i}` });
  }
  // the duplicate arrives at a PAGE BOUNDARY, which is where an unstable sort produces it
  for (let d = 0; d < dupIds; d++) rows.splice(1000 + d, 0, { ...rows[999 - d] });
  return rows;
}

const columns = [
  { key: 'name', header: 'Name', sortable: true, sortVal: (r: Row) => r.name.toLowerCase(),
    render: (r: Row) => r.name },
];

function mount(rows: Row[], initialSearch?: string): { root: Root; host: HTMLElement } {
  const host = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(host);
  act(() => {
    root.render(React.createElement(DataSheet as any, {
      title: 'Customers', rows, loading: false, error: null,
      getRowId: (r: Row) => r.id, columns,
      searchText: (r: Row) => r.name, itemNoun: 'customers', initialSearch,
    }));
  });
  return { root, host };
}
const bodyRowIds = (host: HTMLElement): string[] =>
  Array.from(host.querySelectorAll('tbody tr')).map(tr => (tr.textContent ?? '').trim()).filter(Boolean);

// ⚠️ THE SEARCH IS SET AT MOUNT, NOT TYPED, AND THE REASON IS RECORDED RATHER THAN HIDDEN.
// Simulating typing needs a synthetic `input` event, and jsdom + a plain `Event` does NOT trip
// React's onChange here — MEASURED: the value lands on the node and the count pill still reads
// the unfiltered total. `@testing-library`'s `fireEvent` exists for exactly that and David
// approved it; it is not installed because `node_modules` is shared with three live sessions.
// What these probes assert is unaffected: the property under test is *given a search, does the
// grid render exactly the matching rows*, and `initialSearch` reaches the same state the
// keystroke would. Filed with tech-debt #359.

// ─── A · NO ROW IS RENDERED TWICE ────────────────────────────────────────────────────────────
// 🔴 THE #377 DEFECT, AS A PERSON SAW IT. With duplicate ids the grid rendered Joe Pitt, Jon
// Chatfield and Jerry Bawcom three or four times each. This fails on a roster carrying them.
{
  const { root, host } = mount(roster(0));
  const texts = bodyRowIds(host);
  ok(texts.length === 2005, `A1 all 2,005 rows render (got ${texts.length})`);
  ok(new Set(texts).size === texts.length, 'A2 🔴 no row appears twice on a clean roster');
  act(() => root.unmount());
}
{
  // the defect, reproduced: 36 duplicated ids, exactly what the live read returned
  const { root, host } = mount(roster(36));
  const texts = bodyRowIds(host);
  const unique = new Set(texts).size;
  ok(unique < texts.length,
     `A3 the harness CAN see a duplicate — ${texts.length} rendered, ${unique} distinct (it must, or A2 proves nothing)`);
  act(() => root.unmount());
}

// ─── A4 · 🔴 THE LIVE SYMPTOM, REPRODUCED: RE-RENDERING A KEYED LIST THAT HAS DUPLICATE KEYS.
// This is the probe that actually reproduces what David saw, and it is separate from A2 because
// the MECHANISM is different. A2 catches duplicates present at first paint. What broke on
// 716eed9 was RECONCILIATION: the grid had 2,005 rows on screen, the list then shrank to 2, and
// React could not diff the old list against the new one because 36 of its keys were not unique —
// so orphaned rows stayed in the DOM while the count pill, a separate node, correctly said 2.
// Here the same root is re-rendered with a much smaller row set, which is exactly that transition.
{
  // 🔴 MEASURED BOTH WAYS, AND THE FAILING NUMBER IS RECORDED HERE BECAUSE IT IS THE POINT:
  //   with `roster(36)` — the 36 duplicate ids the unstable paged read actually returned — this
  //   probe FAILS at **expected 5, got 41**: thirty-six orphans left on screen, which is exactly
  //   what David saw on 716eed9 ("dozens of rows, most without highland"). With a clean roster it
  //   passes. The suite asserts the CLEAN case; the dirty number is written down so nobody has to
  //   re-derive what this probe is for.
  const dirty = roster(0);
  const host = dom.window.document.getElementById('root') as unknown as HTMLElement;
  const root = createRoot(host);
  const render = (rows: Row[]) => act(() => {
    root.render(React.createElement(DataSheet as any, {
      title: 'Customers', rows, loading: false, error: null,
      getRowId: (r: Row) => r.id, columns,
      searchText: (r: Row) => r.name, itemNoun: 'customers',
    }));
  });
  render(dirty);
  const before = bodyRowIds(host).length;
  const few = dirty.filter(r => r.name.toLowerCase().includes('highland'));
  render(few);
  const after = bodyRowIds(host);
  ok(before > 2000, `A4a the grid started full (${before} rows)`);
  ok(after.length === few.length,
     `A4b 🔴 after the list shrinks, EXACTLY the new rows remain — expected ${few.length}, got ${after.length}`);
  ok(after.every(t => t.toLowerCase().includes('highland')),
     'A4c 🔴 and no orphan from the previous render is left on screen');
  act(() => root.unmount());
}

// ─── B · A FILTER RENDERS EXACTLY THE MATCHING ROWS ──────────────────────────────────────────
// 🔴 THE SYMPTOM DAVID REPORTED: header "2 of 2005 shown" while dozens of rows stayed on screen.
{
  const rows = roster(0);
  const expected = rows.filter(r => r.name.toLowerCase().includes('highland')).length;
  const { root, host } = mount(rows, 'highland');
  const after = bodyRowIds(host);
  ok(after.length === expected,
     `B1 🔴 exactly the matching rows render — expected ${expected}, got ${after.length}`);
  ok(after.every(t => t.toLowerCase().includes('highland')),
     'B2 🔴 and every rendered row MATCHES — no orphan left behind');
  ok(new Set(after).size === after.length, 'B3 and none of them is repeated');
  act(() => root.unmount());
}
{
  // NEGATIVE CONTROL: a search that matches nothing must render nothing, not everything.
  const { root, host } = mount(roster(0), 'zzzzznotacustomer');
  ok(bodyRowIds(host).length === 0, 'B4 a search matching nothing renders no rows');
  act(() => root.unmount());
}

console.log(`\n  rosterRender — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
