/**
 * ── loadListSubset — one load sheet per crew (ledger #354) ───────────────────────────
 *
 * David, 2026-09-18: two crews Saturday, and the load list could not be split. These probe the pick
 * (which stops a sheet carries) AND — the part that matters on a trailer — that the totals built from
 * a pick are that crew's totals, never the day's.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/loadListSubset.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { parseStopsParam, pickStops, stopsParamFor } from './loadListSubset';
import { buildLoadList, type LoadStopInput, type LoadListSettings } from './loadList';
import type { StopOrderItem } from './stopLoad';
import type { Ladder, Rung } from '@trace/shared/inventory';
import { OPERATIONS_DEFAULTS } from '@trace/shared/production';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ══ §P THE LINK'S `stops=` VALUE ══════════════════════════════════════════════════
{
  ok(parseStopsParam(null) === null && parseStopsParam(undefined) === null,
    '🔴 P1: no `stops=` means the WHOLE day — never an empty sheet');
  const empty = parseStopsParam('');
  ok(Array.isArray(empty) && empty.length === 0,
    '🔴 P2: `stops=` present but empty is "no stops chosen" — it does not fall back to the whole day');
  ok(JSON.stringify(parseStopsParam(' a, b,,a ,')) === JSON.stringify(['a', 'b']),
    'P3: ids are trimmed, blanks dropped, repeats counted once');
}

// ══ §K THE PICK ════════════════════════════════════════════════════════════════════
{
  const day = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ids = (xs: { id: string }[]) => xs.map(x => x.id).join(',');

  const whole = pickStops(day, null);
  ok(ids(whole.kept) === 'a,b,c' && whole.leftOff.length === 0 && !whole.isSubset,
    '🔴 K1: no request = the whole day, and it is NOT a partial sheet');

  const two = pickStops(day, ['c', 'a']);
  ok(ids(two.kept) === 'a,c', '🔴 K2: the kept stops print in the DAY\'s order (the saved route), not the link\'s');
  ok(ids(two.leftOff) === 'b' && two.isSubset, '🔴 K3: the stop not carried is named, and the sheet is partial');

  const foreign = pickStops(day, ['a', 'zz']);
  ok(ids(foreign.kept) === 'a' && foreign.unknown.join(',') === 'zz',
    '🔴 K4: an id that is not one of this day\'s stops is REFUSED and NAMED, never printed and never silently lost');

  const all = pickStops(day, ['a', 'b', 'c']);
  ok(!all.isSubset && all.leftOff.length === 0, 'K5: every stop ticked IS the whole day');
  const allPlus = pickStops(day, ['a', 'b', 'c', 'zz']);
  ok(allPlus.isSubset && allPlus.unknown.length === 1,
    'K6: …unless the link also names a stop from elsewhere — then the sheet says so');

  const none = pickStops(day, []);
  ok(none.kept.length === 0 && none.leftOff.length === 3 && none.isSubset,
    '🔴 K7: nothing ticked is an empty PARTIAL sheet, not the whole day');
}

// ══ §T TICKS → THE LINK ════════════════════════════════════════════════════════════
{
  const dayIds = ['a', 'b', 'c'];
  ok(stopsParamFor(dayIds, new Set(['a', 'b', 'c'])) === null,
    '🔴 T1: all ticked drops `stops=` — "all ticked" and "the day" are ONE sheet, not two that could differ');
  ok(stopsParamFor(dayIds, new Set(['c', 'a'])) === 'a,c', 'T2: the link lists the ticked stops in the day\'s order');
  ok(stopsParamFor(dayIds, new Set()) === '', 'T3: nothing ticked is an explicit empty list');
  ok(stopsParamFor([], new Set()) === null, 'T4: an empty day has no `stops=` at all');
}

// ══ §U THE TOTALS ON A CREW'S SHEET ARE THAT CREW'S ════════════════════════════════
{
  const rung = (label: string, sortOrder: number, volumeGallons: number | null, posts: number, aliases: string[] = []): Rung => ({
    label, aliases, sortOrder, volumeGallons, handlingMinutes: null, handlingBecause: 'test',
    installTPostsPerTree: posts, installTPostsBecause: 'test', caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set', active: true,
  });
  const LADDER: Ladder = [rung('15 gal', 40, 15, 2), rung('45 gal', 60, 45, 2), rung('95/100', 80, 95, 4, ['95 gallon'])];
  const SETTINGS: LoadListSettings = { ladder: LADDER, ops: OPERATIONS_DEFAULTS };
  const line = (orderId: string, quantity: number, description: string): StopOrderItem => ({
    order_id: orderId, quantity, description, sku: null, business_inventory_id: null, business_inventory: null,
  });
  const stop = (id: string, items: StopOrderItem[], installs: boolean): LoadStopInput => ({
    stopId: id, customerName: id, address: '1 Somewhere', serviceType: null, orderId: `o-${id}`,
    canReadLines: true, linesRead: true, items, deerFence: null, installs,
  });
  const DAY = [
    stop('a', [line('o-a', 2, 'Live Oak - 15 gallon')], true),
    stop('b', [line('o-b', 1, 'Cedar Elm - 45 gallon'), line('o-b', 1, 'Flat fee - Applied on Aug 9, 2026')], false),
    stop('c', [line('o-c', 1, 'Natchez Crape Myrtle - 95 gallon')], true),
  ];
  const day = buildLoadList('2026-09-19', DAY, SETTINGS);
  const pick = pickStops(DAY.map(s => ({ ...s, id: s.stopId })), ['a', 'c']);
  const crew = buildLoadList('2026-09-19', pick.kept, SETTINGS);
  const alone = buildLoadList('2026-09-19', [DAY[0], DAY[2]], SETTINGS);

  ok(day.stopCount === 3 && day.treeCount === 4, 'U0: the day, for reference — 3 stops, 4 trees');
  ok(crew.stopCount === 2 && crew.treeCount === 3, '🔴 U1: the crew sheet counts ITS stops and trees only (2 stops, 3 trees)');
  ok(crew.tPosts === 2 * 2 + 4 && day.tPosts === crew.tPosts + 2,
    '🔴 U2: T-posts are the crew\'s — 2×15 gal at 2 plus a 95 at 4 = 8, not the day\'s 10');
  ok(crew.mixGallons === (2 * 15 + 95) * OPERATIONS_DEFAULTS.installMixContainerVolumesPerTree && crew.mixGallons < day.mixGallons,
    '🔴 U3: the special mix is for the crew\'s trees only');
  ok(crew.ropeFeet === crew.tPosts * OPERATIONS_DEFAULTS.ropeFeetPerTPost, 'U4: rope follows the crew\'s posts');
  ok(crew.waterMonitors === 3 && day.waterMonitors === 3,
    'U5: water monitor kits are the crew\'s installed trees (the day\'s delivery stop adds none)');
  ok(crew.unresolved.length === 0 && day.unresolved.length === 1,
    '🔴 U6: a could-not-work-out line on ANOTHER crew\'s stop is not on this sheet');
  ok(JSON.stringify({ ...crew, stops: crew.stops.map(s => s.stopId) }) === JSON.stringify({ ...alone, stops: alone.stops.map(s => s.stopId) }),
    '🔴 U7: a crew sheet is EXACTLY the sheet those stops would make on their own — no day figure leaks in');
}

console.log(`\nloadListSubset: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
