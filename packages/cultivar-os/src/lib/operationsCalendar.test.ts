/**
 * ── operationsCalendar — the grid, the resolution, and THE MISMATCH ──────────────
 *
 * Written against the live Stage 0 measurements rather than invented data:
 *   · LAWNS has SEVEN stops on Saturday 2026-08-29 (measured — not the eleven the build
 *     prompt allowed for), one on Wed 08-26 and one on Sat 09-12.
 *   · Test Dave's has three real maintenance-Monday conflicts — 06-29, 07-13, 07-20 —
 *     and every one of them is in the PAST, outside the four-week window. That is why the
 *     conflict owner-test card says a conflict must be CREATED rather than observed, and
 *     it is asserted here so the claim is checked rather than remembered.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/operationsCalendar.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  parseYmd, weekdayOf, fourWeekGrid, resolveDayType, conflictsFor, buildCalendarModel,
  dayTypeMeta, DAY_TYPE_CATALOG, ACTIVITY_SOURCES,
  WINDOW_STEP_WEEKS, weekLabel, windowHeading, cellSummary,
  type OperatingDayRule, type ActivityItem,
} from './operationsCalendar';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

/** Lauren's schedule, as she wrote it. The first real instance of the pattern. */
const LAUREN: OperatingDayRule[] = [
  { weekday: 1, on_date: null, day_type: 'service',            note: 'equipment day' },
  { weekday: 2, on_date: null, day_type: 'delivery_only',      note: null },
  { weekday: 3, on_date: null, day_type: 'delivery_only',      note: null },
  { weekday: 4, on_date: null, day_type: 'delivery_placement', note: null },
  { weekday: 5, on_date: null, day_type: 'delivery_placement', note: null },
  { weekday: 6, on_date: null, day_type: 'delivery_placement', note: null },
  { weekday: 0, on_date: null, day_type: 'delivery_placement', note: null },
];

const delivery = (id: string, date: string, serviceType: string | null = 'planting'): ActivityItem =>
  ({ id, kind: 'delivery', date, label: `Stop ${id}`, serviceType });

// ══ §A DATES ARE LOCAL CALENDAR DAYS, NOT UTC INSTANTS ══════════════════════════
{
  const d = parseYmd('2026-08-29');
  ok(d !== null && d.getFullYear() === 2026 && d.getMonth() === 7 && d.getDate() === 29,
    'parseYmd reads 2026-08-29 as local Aug 29 — new Date(str) would land Aug 28 west of Greenwich');
  ok(weekdayOf('2026-08-29') === 6, "Saturday 2026-08-29 is weekday 6 — LAWNS's install day");
  ok(weekdayOf('2026-08-31') === 1, '2026-08-31 is a Monday');
  ok(parseYmd('') === null && parseYmd('not-a-date') === null, 'an unparseable date is null, never a fabricated day');
  ok(weekdayOf('rubbish') === null, 'weekdayOf refuses rather than defaulting to Sunday');
}

// ══ §B THE GRID — FOUR WEEKS, CURRENT FIRST ═════════════════════════════════════
{
  const g = fourWeekGrid(at(2026, 8, 28));           // a Friday
  ok(g.length === 4, 'four weeks, no more');
  ok(g.every((w) => w.days.length === 7), 'seven days in each');
  ok(g[0].days[0].date === '2026-08-23', 'the current week starts Sunday 08-23, not today');
  ok(g[0].days[0].weekday === 0 && g[0].days[6].weekday === 6, 'each row runs Sunday → Saturday');
  ok(g[3].days[6].date === '2026-09-19', 'three weeks ahead ends Saturday 09-19');
  const all = g.flatMap((w) => w.days.map((d) => d.date));
  ok(new Set(all).size === 28, '28 distinct days, none repeated across the week boundary');
  ok(all.every((d, i) => i === 0 || d > all[i - 1]), 'strictly ascending — no gap, no overlap');
}
{
  const g = fourWeekGrid(at(2026, 8, 28));
  const today = g[0].days.find((d) => d.date === '2026-08-28');
  ok(today?.isToday === true, 'today is marked');
  ok(g[0].days.filter((d) => d.isToday).length === 1, 'exactly one day is today');
  ok(g.flatMap((w) => w.days).filter((d) => d.isToday).length === 1, 'and only one in the whole grid');
  ok(g[0].days[0].isPast === true, 'Sunday 08-23 is past');
  ok(today?.isPast === false, 'today is NOT past — the boundary belongs to today');
  ok(g[1].days[0].isPast === false, 'next week is not past');
}
{
  // 🔴 "TODAY" IS A LOCAL CALENDAR DAY, AT EVERY HOUR OF IT. Added after the red-first pass
  // MISSED a planted `toISOString()` defect: every probe stood at noon, where a UTC-based
  // today still lands on the right date. It stops landing there in the evening — and the
  // evening is exactly when someone checks tomorrow's schedule. Both ends of the day are
  // probed so the defect is caught whichever side of UTC the machine sits on.
  const late = fourWeekGrid(at(2026, 8, 28, 21));
  const lateToday = late.flatMap((w) => w.days).filter((d) => d.isToday);
  ok(lateToday.length === 1 && lateToday[0].date === '2026-08-28',
    'at 21:00 local, today is still 08-28 — a UTC-derived today would mark 08-29 west of Greenwich');
  ok(late.flatMap((w) => w.days).find((d) => d.date === '2026-08-28')?.isPast === false,
    'and 08-28 is not yet in the past at 21:00');

  const early = fourWeekGrid(at(2026, 8, 28, 1));
  const earlyToday = early.flatMap((w) => w.days).filter((d) => d.isToday);
  ok(earlyToday.length === 1 && earlyToday[0].date === '2026-08-28',
    'at 01:00 local, today is 08-28 — a UTC-derived today would mark 08-27 east of Greenwich');
  ok(early.flatMap((w) => w.days).find((d) => d.date === '2026-08-27')?.isPast === true,
    'and 08-27 is past even in the small hours');
}
{
  // Standing ON the Sunday, the current week is that Sunday's week — not the one before.
  const g = fourWeekGrid(at(2026, 8, 23));
  ok(g[0].days[0].date === '2026-08-23', 'on Sunday, the week starts today');
  ok(g[0].days[0].isPast === false, 'and today is not in the past');
}
{
  // Late Saturday night is still that week — the boundary that bit the dashboard.
  const g = fourWeekGrid(at(2026, 8, 29, 23));
  ok(g[0].days[0].date === '2026-08-23', 'Saturday 23:00 still belongs to the week beginning 08-23');
}
{
  // A grid built across a month boundary must not renumber days.
  const g = fourWeekGrid(at(2026, 12, 30));
  const all = g.flatMap((w) => w.days.map((d) => d.date));
  ok(all.includes('2026-12-31') && all.includes('2027-01-01'), 'the grid crosses the year end');
  ok(all.every((d, i) => i === 0 || d > all[i - 1]), 'and stays ascending across it');
}

// ══ §C RESOLUTION — EXCEPTION WINS, AND "UNSET" IS AN ANSWER ════════════════════
{
  const r = resolveDayType(LAUREN, '2026-08-31');    // a Monday
  ok(r.dayType === 'service', "Monday resolves to Lauren's service day");
  ok(r.source === 'pattern', 'from the weekly pattern');
  ok(r.recognised === true && r.meta?.key === 'service', 'and it is a type the code knows how to check');
  ok(r.note === 'equipment day', 'the note travels with it');
}
{
  const withException: OperatingDayRule[] = [
    ...LAUREN,
    { weekday: null, on_date: '2026-08-31', day_type: 'delivery_placement', note: 'big Ashcraft job' },
  ];
  const r = resolveDayType(withException, '2026-08-31');
  ok(r.dayType === 'delivery_placement', '🔴 THE EXCEPTION WINS — one Monday moves without touching the pattern');
  ok(r.source === 'exception', 'and it says so, so the reader knows this Monday is special');
  ok(r.note === 'big Ashcraft job', 'the exception carries its own reason');
  ok(resolveDayType(withException, '2026-09-07').dayType === 'service',
    '🔴 AND EVERY OTHER MONDAY IS UNMOVED — the defect an exception exists to avoid');
}
{
  const r = resolveDayType([], '2026-08-31');
  ok(r.dayType === null && r.source === 'unset', 'no rules at all → unset, never a fabricated default');
  ok(r.meta === null && r.recognised === false, 'and nothing pretends to know what the day is for');
}
{
  const custom: OperatingDayRule[] = [{ weekday: 1, on_date: null, day_type: 'nursery propagation', note: null }];
  const r = resolveDayType(custom, '2026-08-31');
  ok(r.dayType === 'nursery propagation', 'AC-4 — a business may store its own word');
  ok(r.source === 'pattern', 'it resolves normally');
  ok(r.recognised === false && r.meta === null, 'but it is reported as NOT recognised, not silently treated as safe');
}
{
  // A rule for a different weekday must never leak onto this day.
  const r = resolveDayType([{ weekday: 3, on_date: null, day_type: 'closed', note: null }], '2026-08-31');
  ok(r.source === 'unset', "Wednesday's rule does not apply to Monday");
  // An exception for a different DATE must not leak either.
  const r2 = resolveDayType([{ weekday: null, on_date: '2026-09-01', day_type: 'closed', note: null }], '2026-08-31');
  ok(r2.source === 'unset', "another day's exception does not apply here");
}

// ══ §D THE MISMATCH — THE FEATURE ═══════════════════════════════════════════════
{
  // FOUR DELIVERIES ON A MAINTENANCE MONDAY — the case the build prompt names.
  const monday = '2026-08-31';
  const items = ['a', 'b', 'c', 'd'].map((id) => delivery(id, monday));
  const c = conflictsFor(resolveDayType(LAUREN, monday), items);
  ok(c !== null, '🔴 four deliveries on a maintenance Monday RAISE THE FLAG');
  ok(c!.reasons.length === 1, 'one reason, not one per delivery');
  ok(c!.reasons[0].text.includes('Monday is a service / maintenance day'), 'the reason names the day type');
  ok(c!.reasons[0].text.includes('4 deliveries'), 'and counts the work that contradicts it');
  ok(c!.reasons[0].offendingIds.length === 4, 'every offending item is identified, so the UI can mark the rows');
  ok(c!.dayTypeLabel === 'Service / maintenance', 'the conflict carries the label the header shows');
}
{
  // ONE delivery — the singular must not read "1 deliveries".
  const c = conflictsFor(resolveDayType(LAUREN, '2026-08-31'), [delivery('a', '2026-08-31')]);
  ok(c!.reasons[0].text.includes('1 delivery '), 'singular reads "1 delivery", not "1 deliveries"');
  ok(!c!.reasons[0].text.includes('1 deliveries'), 'and definitely not that');
}
{
  // PLANTING ON A DELIVERY-ONLY DAY — the second axis: right kind, wrong flavour.
  const tue = '2026-09-01';
  ok(weekdayOf(tue) === 2, 'sanity: 2026-09-01 is a Tuesday');
  const res = resolveDayType(LAUREN, tue);
  ok(res.dayType === 'delivery_only', 'Tuesday is delivery-only');
  const c = conflictsFor(res, [delivery('a', tue, 'planting'), delivery('b', tue, 'delivery_only')]);
  ok(c !== null, 'a planting job on a delivery-only day raises the flag');
  ok(c!.reasons[0].text.includes('1 stop is a planting / install job'), 'and names what is wrong with it');
  ok(c!.reasons[0].offendingIds.length === 1 && c!.reasons[0].offendingIds[0] === 'a',
    '🔴 ONLY the planting stop is flagged — the plain drop-off beside it is fine and is not accused');
}
{
  const tue = '2026-09-01';
  const c = conflictsFor(resolveDayType(LAUREN, tue), [delivery('a', tue, 'planting'), delivery('b', tue, 'planting')]);
  ok(c!.reasons[0].text.includes('2 stops are planting / install jobs'), 'plural form of the service-type reason');
}
{
  // A delivery-only stop on a delivery-only day is CLEAN. The flag must not fire on the
  // work the day is actually for — a flag that fires on a non-problem stops being read.
  const tue = '2026-09-01';
  ok(conflictsFor(resolveDayType(LAUREN, tue), [delivery('a', tue, 'delivery_only')]) === null,
    'a drop-off on a delivery-only day is not flagged');
  const sat = '2026-08-29';
  ok(conflictsFor(resolveDayType(LAUREN, sat), [delivery('a', sat, 'planting')]) === null,
    'a planting job on a delivery/placement Saturday is not flagged');
}
{
  // CLOSED excludes everything, including the kinds that have no data yet.
  const rules: OperatingDayRule[] = [{ weekday: 4, on_date: null, day_type: 'closed', note: 'Thanksgiving' }];
  const thu = '2026-11-26';
  ok(weekdayOf(thu) === 4, 'sanity: 2026-11-26 is a Thursday');
  const items: ActivityItem[] = [
    delivery('a', thu, 'delivery_only'),
    { id: 'p', kind: 'pmi', date: thu, label: 'Tractor service' },
  ];
  const c = conflictsFor(resolveDayType(rules, thu), items);
  ok(c !== null && c.reasons[0].offendingIds.length === 2, 'a closed day excludes every kind, not only deliveries');
}
{
  // 🔴 THE TWO SILENCES THAT ARE HONEST, ASSERTED SO THEY CANNOT DRIFT INTO GUESSES.
  const monday = '2026-08-31';
  const four = ['a', 'b', 'c', 'd'].map((id) => delivery(id, monday));
  ok(conflictsFor(resolveDayType([], monday), four) === null,
    'NO day type → nothing to contradict → no flag (never a default that starts making claims)');
  const custom: OperatingDayRule[] = [{ weekday: 1, on_date: null, day_type: 'propagation', note: null }];
  const res = resolveDayType(custom, monday);
  ok(conflictsFor(res, four) === null, 'an UNRECOGNISED day type is not flagged — we do not know what it excludes');
  ok(res.recognised === false,
    '🔴 and it is REPORTED as unrecognised, so the UI can say "conflicts not checked" rather than imply a clean day');
}
{
  // Both axes can fire on the same day, and both must be reported.
  const rules: OperatingDayRule[] = [{ weekday: 1, on_date: null, day_type: 'service', note: null }];
  const monday = '2026-08-31';
  const c = conflictsFor(resolveDayType(rules, monday), [delivery('a', monday, 'planting')]);
  ok(c!.reasons.length === 1,
    'on a service day the delivery itself is the conflict — the service-type reason is not stacked on top of it');
}
{
  // An empty day never produces a conflict, whatever the type.
  for (const key of Object.keys(DAY_TYPE_CATALOG)) {
    const rules: OperatingDayRule[] = [{ weekday: 1, on_date: null, day_type: key, note: null }];
    ok(conflictsFor(resolveDayType(rules, '2026-08-31'), []) === null, `an empty ${key} day is never a conflict`);
  }
}

// ══ §E THE MODEL — WINDOW, BUCKETING, AND WHAT IT ADMITS IT IS NOT SHOWING ══════
{
  // The seven real Saturday stops, measured live 2026-08-28.
  const sat = '2026-08-29';
  const seven = ['1', '2', '3', '4', '5', '6', '7'].map((id) => delivery(id, sat));
  const m = buildCalendarModel({ now: at(2026, 8, 28), rules: LAUREN, activities: seven });
  ok(m.byDate[sat]?.length === 7, "all SEVEN of Saturday's stops land on Saturday");
  ok(m.shownCount === 7 && m.outsideWindowCount === 0, 'seven shown, none dropped');
  ok(m.isEmpty === false, 'a week with work is not empty');
  ok(!m.conflicts[sat], 'and Saturday is a delivery/placement day, so nothing is flagged');
}
{
  // The half-open far edge — the dashboard's own defect, one screen over.
  const m = buildCalendarModel({
    now: at(2026, 8, 28),
    rules: [],
    activities: [
      delivery('in-first', '2026-08-23'),   // the very first day
      delivery('in-last', '2026-09-19'),    // the very last day
      delivery('out-after', '2026-09-20'),  // the day AFTER the window
      delivery('out-before', '2026-08-22'), // the day BEFORE it
    ],
  });
  ok(m.windowStart === '2026-08-23', 'the window opens on the first grid day');
  ok(m.windowEnd === '2026-09-20', 'and closes EXCLUSIVE on the day after the last');
  ok(m.byDate['2026-08-23']?.length === 1 && m.byDate['2026-09-19']?.length === 1, 'both edge days are included');
  ok(m.shownCount === 2, 'two items are on the grid');
  ok(m.outsideWindowCount === 2,
    '🔴 the two outside are COUNTED, not silently dropped — the count is what lets the UI say what it is not showing');
  ok(m.byDate['2026-09-20'] === undefined, 'and nothing leaks past the far edge');
}
{
  // A WEEK WITH NOTHING IN IT SAYS SO — and empty is not error.
  const m = buildCalendarModel({ now: at(2026, 8, 28), rules: LAUREN, activities: [] });
  ok(m.isEmpty === true, 'four empty weeks report isEmpty');
  ok(m.shownCount === 0 && m.outsideWindowCount === 0, 'with an honest zero on both counts');
  ok(m.weeks.length === 4, 'the grid still renders — an empty calendar is four empty weeks, never a blank screen');
  ok(Object.keys(m.resolutions).length === 28, 'and every day still knows what kind of day it is');
  ok(Object.keys(m.conflicts).length === 0, 'nothing to contradict');
}
{
  // Day types with no activity at all: still resolved, still zero conflicts.
  const m = buildCalendarModel({ now: at(2026, 8, 28), rules: LAUREN, activities: [] });
  ok(m.resolutions['2026-08-31'].dayType === 'service', 'a Monday in the window resolves even with no work on it');
  ok(m.resolutions['2026-08-29'].dayType === 'delivery_placement', 'and so does the Saturday');
}
{
  // 🔴 THE CONFLICT CARD'S PREMISE, ASSERTED RATHER THAN REMEMBERED.
  // Test Dave's three real maintenance-Monday conflicts are 06-29, 07-13 and 07-20 — all
  // in the past. Standing on 2026-08-28 they are OUTSIDE the four weeks, which is why the
  // owner-test says a conflict must be CREATED and cannot be observed.
  const past = ['2026-06-29', '2026-07-13', '2026-07-20'].map((d, i) => delivery(`m${i}`, d));
  const m = buildCalendarModel({ now: at(2026, 8, 28), rules: LAUREN, activities: past });
  ok(past.every((p) => weekdayOf(p.date) === 1), 'all three really are Mondays');
  ok(m.shownCount === 0 && m.outsideWindowCount === 3,
    "🔴 and all three fall OUTSIDE the window — there is no conflict to observe in the current four weeks");
  ok(Object.keys(m.conflicts).length === 0, 'so the grid shows no flag, correctly');
}
{
  // ...and the moment one IS created inside the window, the flag fires.
  const created = delivery('created', '2026-08-31');
  const m = buildCalendarModel({ now: at(2026, 8, 28), rules: LAUREN, activities: [created] });
  ok(m.conflicts['2026-08-31'] !== undefined, 'a delivery moved onto Monday 08-31 raises the flag');
  ok(m.shownCount === 1, 'and the delivery is still shown — flagged, never hidden');
}

// ══ §F THE SEAM — DECLARED, NOT COMMENTED ═══════════════════════════════════════
{
  ok(ACTIVITY_SOURCES.length === 5, 'all five named kinds of work are declared');
  const byKind = Object.fromEntries(ACTIVITY_SOURCES.map((s) => [s.kind, s]));
  ok(byKind.delivery.state === 'live', 'deliveries are the one live dated source');
  ok(byKind.pmi.state === 'no-data', 'PMI is declared as having no dated data — not as missing, and not as working');
  ok(byKind.planting.state === 'derived', 'planting is declared as an attribute of a delivery, not its own source');
  ok(byKind.spray.state === 'unbuilt', 'spray is declared absent');
  ok(byKind.graduation.shape === 'window',
    '🔴 a graduation is a WINDOW, not a point — the uppot window is two months wide and must never render as a day');
  ok(ACTIVITY_SOURCES.filter((s) => s.shape === 'window').length === 1, 'it is the only window-shaped source');
  ok(ACTIVITY_SOURCES.every((s) => s.source.length > 20),
    'every source states where it comes from or exactly why it does not exist');
}
{
  ok(dayTypeMeta('service')?.key === 'service', 'the catalog resolves a known type');
  ok(dayTypeMeta('propagation') === null, 'and returns null for one it does not know');
  ok(dayTypeMeta(null) === null && dayTypeMeta(undefined) === null, 'null and undefined are handled, not thrown on');
  ok(Object.entries(DAY_TYPE_CATALOG).every(([k, v]) => v.key === k),
    'every catalog entry knows its own key — the key and the value cannot drift apart');
  ok(Object.values(DAY_TYPE_CATALOG).every((v) => v.purpose.length > 0),
    'every type states what the day IS for, so a header can make a checkable claim (§6 r18)');
}

// ══ §G THE WINDOW MOVES — AND THE DAY THAT COULD NOT BE REACHED ═════════════════
//
// 🔴 THE DEFECT, STATED AS A DATE. Standing on Monday 2026-08-31, the home window is
//    Aug 30 → Sep 26. Saturday 2026-08-29 — SEVEN stops, six made, one rescheduled, the day
//    David spent a week trying to reconstruct — is ONE DAY before it, and before this pass
//    there was no way back at all. These probes fail if that ever becomes true again.
{
  const NOW = at(2026, 8, 31);                       // the Monday the defect was reported

  const home = buildCalendarModel({ now: NOW, rules: [], activities: [] });
  ok(home.windowStart === '2026-08-30', 'home starts Sunday 2026-08-30 — the window as it shipped');
  ok(home.weeks[3].endDate === '2026-09-26', 'and ends Sat 2026-09-26 — "this week and the three ahead"');
  ok(!('2026-08-29' >= home.windowStart && '2026-08-29' < home.windowEnd),
    '🔴 Saturday 2026-08-29 is NOT in the home window — this is the defect, asserted rather than remembered');

  const back = buildCalendarModel({ now: NOW, offsetWeeks: -WINDOW_STEP_WEEKS, rules: [], activities: [] });
  ok(back.windowStart === '2026-08-02', 'one press back moves a WHOLE window — Aug 2');
  ok(back.weeks[3].endDate === '2026-08-29',
    '🔴 AND SATURDAY 2026-08-29 IS ITS LAST DAY — "move back four weeks and open Saturday 29 August" is reachable in one press');
  ok('2026-08-29' >= back.windowStart && '2026-08-29' < back.windowEnd,
    'the day sits inside the half-open bounds the query uses, not merely on the drawn grid');

  const oneBack = buildCalendarModel({ now: NOW, offsetWeeks: -1, rules: [], activities: [] });
  ok(oneBack.windowStart === '2026-08-23' && oneBack.weeks[3].endDate === '2026-09-19',
    'a one-week step also works — the step size is the control, not the mechanism');

  const fwd = buildCalendarModel({ now: NOW, offsetWeeks: WINDOW_STEP_WEEKS, rules: [], activities: [] });
  ok(fwd.windowStart === '2026-09-27', 'forward past Sep 26 — the other wall, gone');
  ok(fwd.windowEnd === '2026-10-25', 'and its exclusive end is the day after its last day, as everywhere else');

  ok(home.windowEnd === fwd.windowStart,
    "consecutive windows abut: home's exclusive end IS the next window's first day — nothing skipped, nothing shown twice");
  ok(back.windowEnd === home.windowStart,
    'and the same going back — the previous window ends exactly where home begins');
}
{
  // Windows are ADJACENT and non-overlapping across a long walk, which is what makes a step
  // of four safe: a reader pressing back six times sees every day exactly once.
  const NOW = at(2026, 8, 31);
  let overlaps = 0, gaps = 0;
  for (let i = -6; i < 6; i++) {
    const a = buildCalendarModel({ now: NOW, offsetWeeks: i * WINDOW_STEP_WEEKS, rules: [], activities: [] });
    const b = buildCalendarModel({ now: NOW, offsetWeeks: (i + 1) * WINDOW_STEP_WEEKS, rules: [], activities: [] });
    if (a.windowEnd > b.windowStart) overlaps++;
    if (a.windowEnd < b.windowStart) gaps++;
  }
  ok(overlaps === 0 && gaps === 0, 'twelve consecutive windows tile the year with no overlap and no gap');
  ok(WINDOW_STEP_WEEKS === 4, 'the step is a whole window — a partial step would show the same week twice');
}
{
  // TODAY stays anchored to today wherever the window is. A past window is entirely past and
  // says so; it must never mint a second "TODAY".
  const NOW = at(2026, 8, 31);
  const back = fourWeekGrid(NOW, -WINDOW_STEP_WEEKS);
  const home = fourWeekGrid(NOW, 0);
  const all = (ws: ReturnType<typeof fourWeekGrid>) => ws.flatMap((w) => w.days);
  ok(all(back).every((d) => !d.isToday), 'no day in a past window is marked TODAY');
  ok(all(back).every((d) => d.isPast), 'and every one of its days is past — the dimming is honest, not decorative');
  ok(all(home).filter((d) => d.isToday).length === 1, 'exactly one day is TODAY in the home window');
  ok(all(fourWeekGrid(NOW, WINDOW_STEP_WEEKS)).every((d) => !d.isPast && !d.isToday),
    'a future window holds no past day and no today');
}

// ══ §H THE WEEK LABEL AND THE HEADER'S CLAIM (§6 r18) ═══════════════════════════
{
  const NOW = at(2026, 8, 31);
  const back = fourWeekGrid(NOW, -WINDOW_STEP_WEEKS);
  ok(back.map((w) => w.relativeIndex).join(',') === '-4,-3,-2,-1',
    '🔴 a week knows how far it is from TODAY, not where it sits in the grid — the row-index label called a four-weeks-ago week "This week"');
  ok(fourWeekGrid(NOW, 0).map((w) => w.relativeIndex).join(',') === '0,1,2,3', 'and the home window is unchanged');

  ok(weekLabel(0) === 'This week', 'week 0 is This week');
  ok(weekLabel(1) === 'Next week' && weekLabel(-1) === 'Last week',
    'one either way is said the way a person says it, not as "In 1 week"');
  ok(weekLabel(3) === 'In 3 weeks' && weekLabel(-3) === '3 weeks ago', 'further out reads forward and back');
  ok(weekLabel(-4) !== weekLabel(4), 'back and ahead are never the same words');
}
{
  ok(windowHeading(0) === 'This week and the three ahead',
    'at home the heading is the sentence the screen already shipped — nothing regresses');
  ok(!windowHeading(-4).includes('This week'),
    '🔴 §6 r18 — "this week and the three ahead" is TRUE of exactly one window and must not be printed over any other');
  ok(windowHeading(-4) === 'Four weeks · 4 weeks back', 'away from home the heading states the distance');
  ok(windowHeading(4) === 'Four weeks · 4 weeks ahead', 'and its direction');
  ok(windowHeading(-1) === 'Four weeks · 1 week back', 'singular is singular');
  ok(buildCalendarModel({ rules: [], activities: [] }).isCurrentWindow,
    'the model states whether it is the window the home heading describes');
  ok(!buildCalendarModel({ offsetWeeks: -4, rules: [], activities: [] }).isCurrentWindow,
    'and says so when it is not');
  ok(buildCalendarModel({ offsetWeeks: -4, rules: [], activities: [] }).offsetWeeks === -4,
    'the offset is carried on the model, so nothing has to re-derive where the window sits');
}

// ══ §I WHAT A CELL PRINTS — THE COUNT, NOT THREE ELLIPSES ═══════════════════════
{
  const s0 = cellSummary([]);
  ok(s0.only === null && s0.text === null, 'an empty day prints nothing — the cell is empty, not "0 stops"');

  const one = delivery('a', '2026-09-12', null);
  const s1 = cellSummary([one]);
  ok(s1.only === one && s1.text === null,
    'ONE stop still prints its name — a single label fits, and who is on an otherwise empty day is the glance');

  const s3 = cellSummary([
    delivery('a', '2026-08-29', null), delivery('b', '2026-08-29', null), delivery('c', '2026-08-29', null)]);
  ok(s3.only === null && s3.text === '3 stops',
    '🔴 three stops say "3 stops" — "Josh Ph…" three times identified nobody and read as a rendering fault');
  ok(!/…/.test(s3.text ?? ''), 'and it carries no ellipsis at all');

  const mixed = cellSummary([
    delivery('a', '2026-08-29', null), delivery('b', '2026-08-29', 'planting'), delivery('c', '2026-08-29', null)]);
  ok(mixed.text === '3 stops · 1 planting',
    'the planting sub-count survives, because it is the axis the day-type flag is about to use');
  ok(mixed.hasPlanting, 'and the cell can pick its icon from the mix rather than from the first row');

  const allPlanting = cellSummary([delivery('a', '2026-08-29'), delivery('b', '2026-08-29')]);
  ok(allPlanting.text === '2 stops · all planting',
    'all of them is said as "all", not as "2 stops · 2 planting" — the reader should not have to do the division');

  const seven = cellSummary(Array.from({ length: 7 }, (_, i) => delivery(`s${i}`, '2026-08-29', null)));
  ok(seven.text === '7 stops', "🔴 Saturday 2026-08-29's seven stops read as SEVEN, in a cell that can hold the word");

  const withPmi = cellSummary([
    delivery('a', '2026-08-29', null),
    { id: 'p', kind: 'pmi', date: '2026-08-29', label: 'Trailer brakes', serviceType: null },
  ]);
  ok(withPmi.text === '1 delivery and 1 maintenance job',
    'a mixed-KIND day falls through to the same phrasing the conflict flag uses (§6 r8) — the cell and the flag cannot disagree');
}
{
  // The counts a cell prints are the counts the model placed there — one source, not two.
  const items = [delivery('a', '2026-08-29', null), delivery('b', '2026-08-29', 'planting')];
  const m = buildCalendarModel({ now: at(2026, 8, 31), offsetWeeks: -WINDOW_STEP_WEEKS, rules: LAUREN, activities: items });
  ok(m.byDate['2026-08-29']?.length === 2, 'both stops land on the day inside the moved window');
  ok(cellSummary(m.byDate['2026-08-29']).text === '2 stops · 1 planting', 'and the cell counts exactly those');
  ok(m.shownCount === 2 && m.outsideWindowCount === 0,
    'nothing is counted as outside a window that now contains it — the count follows the window');
  ok(buildCalendarModel({ now: at(2026, 8, 31), rules: LAUREN, activities: items }).outsideWindowCount === 2,
    '🔴 and in the HOME window both are outside it — counted, never silently dropped');
}

console.log(`\n  operationsCalendar: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
