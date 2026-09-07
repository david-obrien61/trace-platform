/**
 * ── columnOrder — G11: ACTIONS · NAME · DATA, on every grid · 2026-09-07 ──────────────────────
 *
 * David ruled the shape after finding four grids with three of them:
 *
 *   "THE INVENTORY GRID IS THE REFERENCE: ACTIONS · NAME · DATA. Customers conforms to it. Every
 *    DataSheet consumer conforms to it. File it as a clause — the G-clauses cover sort, filter and
 *    the read-only mark and say nothing about column order, which is why four grids have three
 *    different shapes."
 *
 * The order was never a decision anybody made. It FELL OUT of where each config happened to put
 * its frozen run: the engine pinned the actions track after the frozen columns, so /customers
 * (one frozen column, Name) rendered NAME · ACTIONS and /inventory (whose frozen run had been
 * broken down to just the flag glyph) rendered ACTIONS · … · NAME. Two shapes, one engine, no
 * author.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE THE RULE USED TO BE UNREACHABLE. The arithmetic lived between two
 * JSX blocks inside DataSheet.tsx — tech-debt #134's shape — so the only way to know what order a
 * grid rendered in was to open the app and look, which is exactly how a silent G3 failure
 * (/inventory's Name declared `frozen: true` and not pinned) survived on the reference grid.
 *
 * Run (pure TS, no React imported — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/components/datasheet/columnOrder.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { planTracks, identifierOf, DEFAULT_FROZEN_WIDTH, type TrackColumn } from './columnOrder';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const order = (p: ReturnType<typeof planTracks>) => p.pinned.map(t => t.key).join(' · ');

// The two real configs, reduced to the facts the planner reads.
const INVENTORY: TrackColumn[] = [
  { key: 'flag', frozen: true, frozenWidth: 34 },
  { key: 'name', frozen: true, frozenWidth: 180, identifier: true },
  { key: 'needs' }, { key: 'sku' }, { key: 'qty' },
];
const CUSTOMERS: TrackColumn[] = [
  { key: 'first_name', frozen: true, frozenWidth: 200, identifier: true },
  { key: 'customer_type' }, { key: 'price_tier' },
];

// ══ §A — THE RULING, ON BOTH GRIDS ═══════════════════════════════════════════
// The clause in one assertion each: actions immediately before the identifier, data after.
{
  const p = planTracks(INVENTORY, { actionsWidth: 122 });
  ok(order(p) === 'flag · __actions__ · name',
     '§A /inventory pins flag · ACTIONS · name — the mark leads, then the actions, then the identifier');
  ok(p.scrollKeys.join(',') === 'needs,sku,qty', '§A everything after the identifier scrolls as DATA');
}
{
  const p = planTracks(CUSTOMERS, { actionsWidth: 78 });
  ok(order(p) === '__actions__ · first_name',
     '§A /customers now pins ACTIONS · name — this is the row that used to render NAME · ACTIONS');
}
// 🔴 THE MUTATION THAT MATTERS: the OLD engine put actions after the frozen run. If that ever
// comes back, these two grids disagree again — and this is the assertion that says so.
{
  const inv = planTracks(INVENTORY, { actionsWidth: 122 }).pinned;
  const cus = planTracks(CUSTOMERS, { actionsWidth: 78 }).pinned;
  const beforeId = (ts: typeof inv, id: string) =>
    ts.findIndex(t => t.kind === 'actions') === ts.findIndex(t => t.key === id) - 1;
  ok(beforeId(inv, 'name') && beforeId(cus, 'first_name'),
     '§A on BOTH grids the actions track is the track immediately before the identifier — one shape, not two');
}

// ══ §B — THE RESERVED TRACKS STILL ACCUMULATE EXACTLY (§6 r14) ═══════════════
// Inserting a track in the middle of the pinned run is precisely where the #104/#105 defect came
// from: an offset that does not account for a neighbour, so scrolling columns pass underneath.
{
  const p = planTracks(INVENTORY, { actionsWidth: 122, expandWidth: 36 });
  ok(order(p) === '__expand__ · flag · __actions__ · name',
     '§B G10 keeps track 0 — the disclosure toggle still leads, ahead of the actions');
  const lefts = p.pinned.map(t => t.left);
  ok(JSON.stringify(lefts) === JSON.stringify([0, 36, 70, 192]),
     '§B every left offset is the running sum of the widths before it (0, 36, 36+34, 36+34+122)');
  const widths = p.pinned.map(t => t.width);
  ok(JSON.stringify(widths) === JSON.stringify([36, 34, 122, 180]), '§B each track reserves its own declared width');
  ok(p.pinned.filter(t => t.last).length === 1 && p.pinned[p.pinned.length - 1].last,
     '§B exactly ONE track carries the freeze edge, and it is the rightmost');
}
{
  // A frozen column with no declared width still gets a deterministic track — §6 r14's default.
  const p = planTracks([{ key: 'n', frozen: true, identifier: true }, { key: 'x' }], { actionsWidth: 100 });
  ok(p.pinned[1].width === DEFAULT_FROZEN_WIDTH && p.pinned[1].left === 100,
     '§B an undeclared frozenWidth falls back to the default rather than to zero');
}

// ══ §C — G3: ONLY A CONTIGUOUS LEADING RUN PINS, AND THAT IS THE LIVE DEFECT ═
// 🔴 THE REGRESSION THIS BUILD FIXED, ASSERTED AS A FACT ABOUT THE ENGINE. /inventory's
// "Needs a look" column sat between `flag` and `name`. `name` carried `frozen: true` and was NOT
// pinned, because the run stops at the first non-frozen column — and NOTHING said so.
{
  const BROKEN: TrackColumn[] = [
    { key: 'flag', frozen: true, frozenWidth: 34 },
    { key: 'needs' },
    { key: 'name', frozen: true, frozenWidth: 180, identifier: true },
  ];
  const p = planTracks(BROKEN, { actionsWidth: 122 });
  ok(!p.pinned.some(t => t.key === 'name'),
     '§C a frozen identifier BEHIND a non-frozen column is not pinned — the silent G3 failure, reproduced');
  ok(p.scrollKeys.includes('name'), '§C …it scrolls away with the data, which is what nobody could see');
  ok(order(p) === '__actions__ · flag',
     '§C and the actions track falls back to LEADING the pinned run — never after the mark, which would be a third shape');
}

// ══ §D — THE FALLBACK IS THE SAFE DIRECTION ═════════════════════════════════
// A consumer that forgets `identifier` must still conform. It must NOT silently render
// NAME · ACTIONS, which is the shape the clause exists to remove.
{
  const NO_ID: TrackColumn[] = [{ key: 'name', frozen: true, frozenWidth: 180 }, { key: 'x' }];
  const p = planTracks(NO_ID, { actionsWidth: 90 });
  ok(order(p) === '__actions__ · name',
     '§D no identifier declared → actions lead. Still ACTIONS-before-NAME; never the old shape');
  ok(identifierOf(NO_ID).ok === false && identifierOf(NO_ID).count === 0,
     '§D …and identifierOf reports it, so the grid-standard probe fails the file rather than the screen looking fine');
}
{
  const TWO: TrackColumn[] = [
    { key: 'a', frozen: true, frozenWidth: 50, identifier: true },
    { key: 'b', frozen: true, frozenWidth: 50, identifier: true },
  ];
  ok(identifierOf(TWO).count === 2 && identifierOf(TWO).ok === false,
     '§D two identifiers is a configuration mistake that renders fine — reported, not tolerated');
  ok(planTracks(TWO, { actionsWidth: 40 }).pinned[0].key === '__actions__',
     '§D …and the FIRST one wins the placement, deterministically, rather than the last');
}

// ══ §E — EDGES ══════════════════════════════════════════════════════════════
{
  const p = planTracks(INVENTORY, {});
  ok(!p.pinned.some(t => t.kind === 'actions'), '§E a grid with no row actions gets no actions track');
  ok(order(p) === 'flag · name' && p.pinned[1].last,
     '§E …and the freeze edge falls back to the last frozen column');
}
{
  const p = planTracks([{ key: 'a' }, { key: 'b' }], { actionsWidth: 60 });
  ok(order(p) === '__actions__' && p.pinned[0].left === 0,
     '§E a grid with row actions and NO frozen columns still pins its actions track at left 0');
  ok(p.scrollKeys.join(',') === 'a,b', '§E …and every column scrolls');
}
{
  const p = planTracks([], { actionsWidth: 60, expandWidth: 36 });
  ok(p.pinned.map(t => t.key).join(' · ') === '__expand__ · __actions__',
     '§E no columns at all → the two gutters still lay out in order and neither is dropped');
}
{
  // Hiding the identifier via the show/hide menu must not produce a broken layout. It falls back.
  const shown = INVENTORY.filter(c => c.key !== 'name');
  ok(order(planTracks(shown, { actionsWidth: 122 })) === '__actions__ · flag',
     '§E hiding the identifier column degrades to actions-first, not to an actions track with no neighbour');
}

console.log(`\ncolumnOrder: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
