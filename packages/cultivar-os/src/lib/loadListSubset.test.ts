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
import { parseStopsParam, pickStops, stopsParamFor, groupStopsByTeam, sheetIsSectioned } from './loadListSubset';
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
    installTPostsPerTree: posts, installTPostsBecause: 'test', caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set',
    installPrice: null, installPriceBecause: 'not set',
    pytPrice: null, pytPriceBecause: 'not set',
    growMonths: null, growBecause: 'not set', holdMonths: null, holdBecause: 'not set',
    sellability: 'sold' as const, sellabilityBecause: 'not set', active: true,
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

// ══ §T ONE SECTION PER TEAM (ledger #373, teams piece 4) ═══════════════════════════
// David, 2026-09-21: one section per team, same allow-list and roll-up rules as today. The rules are
// inherited by CONSTRUCTION — a section's totals are `buildLoadList` over that section's stops — so
// what these probe is the part that can actually go wrong: that the sections ACCOUNT FOR EVERY STOP.
{
  type S = { id: string; team_id?: string | null };
  const ids = (xs: { id: string }[]) => xs.map(x => x.id).join(',');
  const DAY: S[] = [
    { id: 'a', team_id: 't1' }, { id: 'b', team_id: 't2' }, { id: 'c', team_id: 't1' },
    { id: 'd', team_id: null }, { id: 'e', team_id: 't2' },
  ];
  const secs = groupStopsByTeam(DAY);

  // 🔴 THE LOAD-BEARING ONE. A stop left off every sheet is the real risk (ledger #354's own words);
  // sectioning is a new way to drop one, so the invariant is asserted directly rather than implied.
  const flat = secs.flatMap(x => x.stops.map(y => y.id)).sort();
  ok(flat.join(',') === 'a,b,c,d,e' && flat.length === DAY.length,
    '🔴 T1: every stop appears in EXACTLY ONE section — none dropped, none duplicated');

  ok(secs.length === 3, 'T2: three sections — Team 1, Team 2, and the stops with no team');
  ok(ids(secs[0].stops) === 'a,c' && secs[0].teamId === 't1',
    'T3: a section keeps the DAY\'s order inside it (a before c), not the order teams were seen in');
  ok(secs[secs.length - 1].teamId === null && ids(secs[2].stops) === 'd',
    '🔴 T4: the stops with NO team are a SECTION and it comes LAST — never filtered away (D-9/A9)');
  ok(secs[0].teamId === 't1' && secs[1].teamId === 't2',
    'T5: teams appear in the order they first appear in the day');

  // 🔴 THE UNSPLIT DAY IS UNCHANGED — piece 2's `route.unsplit-day-still-works`, on paper.
  const noTeams = groupStopsByTeam([{ id: 'a' }, { id: 'b', team_id: null }]);
  ok(noTeams.length === 1 && noTeams[0].teamId === null && sheetIsSectioned(noTeams) === false,
    '🔴 T6: a business that never splits a day gets ONE section and NO team headers — the sheet it always had');
  ok(sheetIsSectioned(secs) === true && sheetIsSectioned(groupStopsByTeam([{ id: 'a', team_id: 't1' }])) === true,
    'T7: a sheet with any teamed stop IS sectioned, including when one team takes the whole day');
  ok(groupStopsByTeam([]).length === 0 && sheetIsSectioned([]) === false,
    'T8: no stops means no sections — not one empty "No team" section');

  // A team that is retired, or no longer listed at all, still carries its stops ([[R-133]]).
  const gone = groupStopsByTeam([{ id: 'a', team_id: 'retired-or-deleted' }]);
  ok(gone.length === 1 && gone[0].teamId === 'retired-or-deleted',
    '🔴 T9: this function never filters by whether a team still exists — the stop carries it, so the paper says so');
  ok(ids(groupStopsByTeam([{ id: 'x' }])[0].stops) === 'x',
    'T10: an ABSENT team_id (undefined, not null) is the no-team section, not a section named "undefined"');

  // 🔴 GROUPING COMPOSES WITH THE TICK — it runs on the KEPT stops, never on the whole day.
  const picked = pickStops(DAY, ['a', 'b', 'd']);
  const pickedSecs = groupStopsByTeam(picked.kept);
  ok(pickedSecs.flatMap(x => x.stops.map(y => y.id)).join(',') === 'a,b,d',
    '🔴 T11: sections are built from the stops the sheet CARRIES — a left-off stop is in no section');
  ok(!pickedSecs.some(x => x.stops.some(y => y.id === 'c' || y.id === 'e')),
    '🔴 T12: a stop Lauren un-ticked cannot reappear because it shares a team with one she kept');
}

// ══ §V A SECTION'S TOTALS ARE THAT TEAM'S ══════════════════════════════════════════
{
  const rung = (label: string, sortOrder: number, volumeGallons: number | null, posts: number): Rung => ({
    label, aliases: [], sortOrder, volumeGallons, handlingMinutes: null, handlingBecause: 'test',
    installTPostsPerTree: posts, installTPostsBecause: 'test', caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set',
    installPrice: null, installPriceBecause: 'not set',
    pytPrice: null, pytPriceBecause: 'not set',
    growMonths: null, growBecause: 'not set', holdMonths: null, holdBecause: 'not set',
    sellability: 'sold' as const, sellabilityBecause: 'not set', active: true,
  });
  const LADDER: Ladder = [rung('15 gal', 40, 15, 2), rung('45 gal', 60, 45, 2)];
  const SETTINGS: LoadListSettings = { ladder: LADDER, ops: OPERATIONS_DEFAULTS };
  const line = (orderId: string, quantity: number, description: string): StopOrderItem => ({
    order_id: orderId, quantity, description, sku: null, business_inventory_id: null, business_inventory: null,
  });
  const stop = (id: string, team: string | null, items: StopOrderItem[]): LoadStopInput & { id: string; team_id: string | null } => ({
    id, team_id: team,
    stopId: id, customerName: id, address: '1 Somewhere', serviceType: null, orderId: `o-${id}`,
    canReadLines: true, linesRead: true, items, deerFence: null, installs: true,
  });
  const DAY = [
    stop('a', 't1', [line('o-a', 2, 'Live Oak - 15 gallon')]),
    stop('b', 't2', [line('o-b', 4, 'Cedar Elm - 45 gallon')]),
    stop('c', 't1', [line('o-c', 1, 'Live Oak - 15 gallon')]),
  ];
  const secs = groupStopsByTeam(DAY);
  const whole = buildLoadList('2026-09-21', DAY, SETTINGS);
  const t1 = buildLoadList('2026-09-21', secs[0].stops, SETTINGS);
  const t2 = buildLoadList('2026-09-21', secs[1].stops, SETTINGS);

  ok(t1.treeCount === 3 && t2.treeCount === 4 && whole.treeCount === 7,
    '🔴 V1: a section counts ITS trees — 3 and 4, and the day is still 7');
  ok(t1.tPosts + t2.tPosts === whole.tPosts && t1.mixGallons + t2.mixGallons === whole.mixGallons,
    '🔴 V2: the sections ADD UP to the day — nothing is double-counted and nothing is lost');
  const alone = buildLoadList('2026-09-21', [DAY[0], DAY[2]], SETTINGS);
  ok(JSON.stringify({ ...t1, stops: t1.stops.map(s => s.stopId) }) === JSON.stringify({ ...alone, stops: alone.stops.map(s => s.stopId) }),
    '🔴 V3: a team\'s section is EXACTLY the sheet those stops make alone — the allow-list and every roll-up rule are inherited, not re-stated');
}

console.log(`\nloadListSubset: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
