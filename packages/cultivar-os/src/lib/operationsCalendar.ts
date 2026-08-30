// ============================================================
// operationsCalendar — the four-week grid, the day-type rules, and THE MISMATCH
// ============================================================
// PURPOSE:      Pure model behind the operations calendar. Three jobs: lay out four weeks
//               (current + three ahead), resolve WHAT KIND OF DAY each day is, and surface
//               where the work booked on a day CONTRADICTS the kind of day it is.
// DEPENDENCIES: ./dashboardWindows (ymd · weekWindow — the Sunday-based, half-open week
//               math already proven by 23 probes; NOT re-derived here, §6 r8).
//               Otherwise pure — `now` is an argument so a test can stand anywhere in time.
// OUTPUTS:      parseYmd · WEEKDAY_NAMES · DAY_TYPE_CATALOG · dayTypeMeta · resolveDayType
//               · fourWeekGrid · conflictsFor · buildCalendarModel · ACTIVITY_SOURCES.
//
// 🔴 THE POINT OF THE DAY TYPES IS THE MISMATCH, NOT THE COLOUR. A calendar that renders
//    "Monday — maintenance" as a label and stays silent while four deliveries sit on that
//    Monday has built the decoration and skipped the feature. `conflictsFor` IS the feature.
//
// 🔴 IT WARNS, IT NEVER BLOCKS. Nothing in this file returns a veto. Every function returns
//    a DESCRIPTION of a contradiction for a human to read and overrule — David's trailer
//    flagged red for brake maintenance: "today I'm taking the damn trailer." Surface, don't
//    decide (2026-08-23, attribution over approval).
//
// ⚠️ WHY THIS LIVES IN cultivar-os AND NOT packages/shared, stated so it is a decision and
//    not an oversight: the CONCEPT is platform-generic (a print shop with a Monday
//    press-maintenance day is the same table), but there is exactly ONE consumer today.
//    §6 r8 extracts on the rule of three, and §6 r10 names premature generalisation as its
//    own cost. PROMOTION TRIGGER: the second vertical that wants day types — at which point
//    this file moves to packages/shared/src/business-logic/ unchanged, because it already
//    imports nothing vertical and names nothing vertical (AC-1).
// ============================================================
import { ymd, weekWindow } from './dashboardWindows';

/** Sunday-first, matching Date.getDay() and `weekWindow`'s week start. ONE convention. */
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Parse 'YYYY-MM-DD' as LOCAL midnight.
 *
 * 🔴 NOT `new Date(str)`, which parses a bare date as UTC and lands the day BEFORE anywhere
 * west of Greenwich — the defect `ymd` exists to prevent on the writing side. Consolidated
 * here from the copy that was inline in DeliverySchedule.formatDay (§6 r8: same operation,
 * two places, one definition).
 */
export function parseYmd(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Day-of-week for a 'YYYY-MM-DD' string, 0=Sunday. null when unparseable. */
export function weekdayOf(dateStr: string): number | null {
  return parseYmd(dateStr)?.getDay() ?? null;
}

// ════════════════════════════════════════════════════════════════════════════════
// THE ACTIVITY STREAM — one stream, every item carries its KIND
// ════════════════════════════════════════════════════════════════════════════════

export type ActivityKind = 'delivery' | 'pmi' | 'graduation' | 'planting' | 'spray';

/**
 * ⚠️ THE FIVE TYPES BELOW ARE DELIBERATELY NOT EXPORTED — same call `dashboardWindows` makes
 * about its `Window`: nothing outside this module names them, and exporting a type nobody
 * names invites a hand-rolled copy at a call site, which is the drift the module exists to
 * prevent. They are fully inferred at every boundary that returns one. Export one the day a
 * real consumer needs to name it.
 */
export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  /** 'YYYY-MM-DD'. A point event. Window-shaped work does NOT come through here — see below. */
  date: string;
  label: string;
  detail?: string | null;
  /** Deliveries only: 'planting' | 'delivery_only' | null. The day-type check reads it. */
  serviceType?: string | null;
}

/**
 * 🔴 THE NAMED SEAM. Five kinds of work were named; two have a table and only one has dated
 * rows. This registry is the honest statement of that, it RENDERS ON THE PAGE (a footnote
 * naming what the calendar can and cannot show), and it is where a new source plugs in.
 *
 * NOTHING IS MATERIALISED. Deliveries stay in `deliveries`, PMI stays in its own table, and
 * a future source stays in its own — the stream is a read-time union. A materialised
 * activity table would be a second copy of every one of these facts, and the copy is the
 * one that drifts.
 *
 * ⚠️ `shape: 'window'` IS THE PART THAT IS NOT DECORATION. Terry's uppot window runs
 * November to March and is TWO MONTHS WIDE for a batch. A graduation is not a day and must
 * never be rendered as one — when it lands it is a PENDING DECISION ("Lacey Oak 3/5 → 15
 * gal — window open, needs scheduling") sitting beside the grid, not inside a cell. The
 * type system carries that distinction now so the first graduation build cannot quietly
 * flatten it into a date.
 */
interface ActivitySourceDecl {
  kind: ActivityKind;
  label: string;
  shape: 'point' | 'window';
  state: 'live' | 'derived' | 'no-data' | 'unbuilt';
  /** Where it comes from — or, when it does not exist, exactly why not. */
  source: string;
}

export const ACTIVITY_SOURCES: ActivitySourceDecl[] = [
  { kind: 'delivery', label: 'Deliveries', shape: 'point', state: 'live',
    source: 'deliveries.delivery_date' },
  { kind: 'planting', label: 'Planting / install', shape: 'point', state: 'derived',
    source: "not its own source — it is deliveries.service_type = 'planting', an attribute of a delivery" },
  { kind: 'pmi', label: 'Equipment maintenance (PMI)', shape: 'point', state: 'no-data',
    source: 'business_pmi_schedule has no date column — a due date derives from last_service_at + interval_days, and last_service_at is null on every row (business_service_log is empty)' },
  { kind: 'graduation', label: 'Uppotting / graduation', shape: 'window', state: 'unbuilt',
    source: 'no dated table — plant_events is empty and its occurred_at records the past. A graduation is a WINDOW (Nov-Mar), so it will render as a pending decision, never as a day' },
  { kind: 'spray', label: 'Spray', shape: 'point', state: 'unbuilt',
    source: 'nothing anywhere — no table, no column, no ledger kind' },
];

// ════════════════════════════════════════════════════════════════════════════════
// DAY TYPES — the vocabulary the UI offers, and what each type EXCLUDES
// ════════════════════════════════════════════════════════════════════════════════

interface DayTypeMeta {
  key: string;
  label: string;
  /** What the day IS for — the header's claim, so a section header can be checked (§6 r18). */
  purpose: string;
  /** Activity kinds this day is NOT for. An item of such a kind here is a conflict. */
  excludesKinds: ActivityKind[];
  /** Deliveries only: service_type values this day is NOT for. */
  excludesDeliveryServiceTypes: string[];
}

/**
 * The four types the editor offers. `day_type` is FREE TEXT with no CHECK (AC-4) — a
 * business may store its own word, and an unrecognised one is handled honestly rather than
 * guessed at (see `dayTypeMeta` / `resolveDayType().recognised`).
 *
 * ⚠️ PMI IS NEVER EXCLUDED BY A DELIVERY DAY, deliberately. A maintenance job done on a
 * Saturday is not a mistake anyone needs telling about, and a flag that fires on
 * a non-problem is how a flag stops being read. Only `closed` excludes everything.
 */
export const DAY_TYPE_CATALOG: Record<string, DayTypeMeta> = {
  service: {
    key: 'service', label: 'Service / maintenance',
    purpose: 'equipment and site work — no customer deliveries',
    excludesKinds: ['delivery'], excludesDeliveryServiceTypes: [],
  },
  delivery_only: {
    key: 'delivery_only', label: 'Delivery only',
    purpose: 'drop-offs — no planting or placement crews out',
    excludesKinds: [], excludesDeliveryServiceTypes: ['planting'],
  },
  delivery_placement: {
    key: 'delivery_placement', label: 'Delivery / placement',
    purpose: 'deliveries and planting / placement jobs',
    excludesKinds: [], excludesDeliveryServiceTypes: [],
  },
  closed: {
    key: 'closed', label: 'Closed',
    purpose: 'nothing scheduled',
    excludesKinds: ['delivery', 'pmi', 'graduation', 'planting', 'spray'],
    excludesDeliveryServiceTypes: [],
  },
};

/** The catalog entry for a stored day_type, or null when the business typed its own word. */
export function dayTypeMeta(dayType: string | null | undefined): DayTypeMeta | null {
  if (!dayType) return null;
  return DAY_TYPE_CATALOG[dayType] ?? null;
}

// ════════════════════════════════════════════════════════════════════════════════
// RESOLUTION — exception wins over pattern, and "unset" is a real answer
// ════════════════════════════════════════════════════════════════════════════════

/** One row of `business_operating_days`. Exactly one of weekday / on_date is set. */
export interface OperatingDayRule {
  weekday: number | null;
  on_date: string | null;
  day_type: string;
  note?: string | null;
}

/**
 * A rule as STORED — the model shape plus the row id writes address.
 *
 * ⚠️ AND THE COLUMN LIST LIVES BESIDE IT, DELIBERATELY (A4). `verify-field-lists` flagged the
 * first draft's inline `select('id, weekday, …')` as a new hand-written enumeration, and it was
 * right to: the entity had a shape in one place and a column list in another, which is the
 * two-representations-of-one-fact class that made `customers` carry six parallel lists. One
 * definition, every reader derives from it — including the second reader that does not exist
 * yet. Derived rather than declared, because deriving it is cheap here and a declaration would
 * have been a decision recorded instead of a defect removed.
 */
export interface StoredOperatingDayRule extends OperatingDayRule { id: string }
export const OPERATING_DAY_SELECT = 'id, weekday, on_date, day_type, note';

type DayTypeSource = 'exception' | 'pattern' | 'unset';

export interface DayTypeResolution {
  date: string;
  dayType: string | null;
  source: DayTypeSource;
  note: string | null;
  /** Is the stored value one this code knows how to check? */
  recognised: boolean;
  meta: DayTypeMeta | null;
}

/**
 * What kind of day is this? A DATE-LEVEL EXCEPTION WINS over the weekly pattern — that is
 * the whole reason exceptions exist: a big delivery WILL land on a maintenance Monday, and
 * the answer is one exception row, not an edit to the pattern that silently moves every
 * other Monday too.
 *
 * `unset` is returned honestly rather than defaulted to anything. A business with no rules
 * gets a calendar that flags nothing and SAYS it is flagging nothing (D-9) — never a
 * fabricated "delivery/placement" that quietly starts making claims nobody configured.
 */
export function resolveDayType(rules: OperatingDayRule[], date: string): DayTypeResolution {
  const exception = rules.find((r) => r.on_date === date);
  const wd = weekdayOf(date);
  const pattern = wd === null ? undefined : rules.find((r) => r.on_date == null && r.weekday === wd);
  const hit = exception ?? pattern;
  if (!hit) return { date, dayType: null, source: 'unset', note: null, recognised: false, meta: null };
  const meta = dayTypeMeta(hit.day_type);
  return {
    date,
    dayType: hit.day_type,
    source: exception ? 'exception' : 'pattern',
    note: hit.note ?? null,
    recognised: meta !== null,
    meta,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// THE MISMATCH
// ════════════════════════════════════════════════════════════════════════════════

interface ConflictReason {
  text: string;
  offendingIds: string[];
}

export interface DayConflict {
  date: string;
  dayTypeLabel: string;
  reasons: ConflictReason[];
}

/** Noun for each activity kind, so a conflict names the WORK and not a type-system word. */
const KIND_NOUN: Record<ActivityKind, [string, string]> = {
  delivery:   ['delivery', 'deliveries'],
  planting:   ['planting job', 'planting jobs'],
  pmi:        ['maintenance job', 'maintenance jobs'],
  graduation: ['graduation', 'graduations'],
  spray:      ['spray', 'sprays'],
};

/** "1 delivery" / "4 deliveries" — counted per kind, listed in a stable order. */
function countPhrase(items: ActivityItem[]): string {
  const order: ActivityKind[] = ['delivery', 'planting', 'pmi', 'graduation', 'spray'];
  const parts: string[] = [];
  for (const k of order) {
    const n = items.filter((i) => i.kind === k).length;
    if (n > 0) parts.push(`${n} ${KIND_NOUN[k][n === 1 ? 0 : 1]}`);
  }
  return parts.join(' and ');
}

/**
 * Where does this day's work contradict the kind of day it is?
 *
 * Returns null when there is nothing to say — INCLUDING the two cases where saying nothing
 * is the honest answer rather than the clean one:
 *   · the day has NO type (nothing to contradict), and
 *   · the day's type is not in the catalog, so this code genuinely does not know what the
 *     day excludes. It does NOT pass the day silently: `resolveDayType().recognised` is
 *     false and the UI says "type not recognised — conflicts not checked". Claiming to
 *     check what we cannot check is exactly the lie §6 r18 is about.
 */
export function conflictsFor(res: DayTypeResolution, items: ActivityItem[]): DayConflict | null {
  const meta = res.meta;
  if (!meta) return null;

  const reasons: ConflictReason[] = [];

  const wrongKind = items.filter((i) => meta.excludesKinds.includes(i.kind));
  if (wrongKind.length > 0) {
    reasons.push({
      text: `${WEEKDAY_NAMES[weekdayOf(res.date) ?? 0]} is ${lowerArticle(meta.label)} — `
        + `${countPhrase(wrongKind)} scheduled`,
      offendingIds: wrongKind.map((i) => i.id),
    });
  }

  // The second axis: the right KIND of work, the wrong FLAVOUR of it. A planting job on a
  // delivery-only day is the case Lauren actually described — the truck goes out either
  // way, but the placement crew does not.
  const wrongService = items.filter(
    (i) => i.kind === 'delivery'
      && !meta.excludesKinds.includes('delivery')
      && i.serviceType != null
      && meta.excludesDeliveryServiceTypes.includes(i.serviceType),
  );
  if (wrongService.length > 0) {
    const n = wrongService.length;
    reasons.push({
      text: `${meta.label} day — ${n === 1 ? '1 stop is a planting / install job' : `${n} stops are planting / install jobs`}`,
      offendingIds: wrongService.map((i) => i.id),
    });
  }

  if (reasons.length === 0) return null;
  return { date: res.date, dayTypeLabel: meta.label, reasons };
}

function lowerArticle(label: string): string {
  const l = label.toLowerCase();
  return /^[aeiou]/.test(l) ? `an ${l} day` : `a ${l} day`;
}

// ════════════════════════════════════════════════════════════════════════════════
// THE GRID
// ════════════════════════════════════════════════════════════════════════════════

interface CalendarDay {
  date: string;
  weekday: number;
  isToday: boolean;
  isPast: boolean;
}

export interface CalendarWeek {
  startDate: string;
  /** Inclusive last day, for the week's own label. The MODEL window stays half-open. */
  endDate: string;
  days: CalendarDay[];
}

/** Four weeks — the current one first (Sunday-based, matching `weekWindow`), then three ahead. */
export function fourWeekGrid(now: Date = new Date()): CalendarWeek[] {
  const first = weekWindow(now).startDate;
  const start = parseYmd(first)!;
  const today = ymd(now);
  const weeks: CalendarWeek[] = [];
  for (let w = 0; w < 4; w++) {
    const days: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(cur.getDate() + w * 7 + d);
      const date = ymd(cur);
      days.push({ date, weekday: cur.getDay(), isToday: date === today, isPast: date < today });
    }
    weeks.push({ startDate: days[0].date, endDate: days[6].date, days });
  }
  return weeks;
}

export interface CalendarModel {
  weeks: CalendarWeek[];
  /** Half-open [windowStart, windowEnd) — the far edge is EXCLUSIVE (dashboardWindows' lesson). */
  windowStart: string;
  windowEnd: string;
  byDate: Record<string, ActivityItem[]>;
  resolutions: Record<string, DayTypeResolution>;
  conflicts: Record<string, DayConflict>;
  /** Items placed on the grid. */
  shownCount: number;
  /** Items the caller supplied that fall OUTSIDE the four weeks — counted, never hidden. */
  outsideWindowCount: number;
  /** True when the whole four weeks hold nothing. EMPTY is a state, not an error. */
  isEmpty: boolean;
}

export function buildCalendarModel(input: {
  now?: Date;
  rules: OperatingDayRule[];
  activities: ActivityItem[];
}): CalendarModel {
  const weeks = fourWeekGrid(input.now ?? new Date());
  const windowStart = weeks[0].days[0].date;
  const lastDay = weeks[3].days[6].date;
  const endEx = parseYmd(lastDay)!;
  endEx.setDate(endEx.getDate() + 1);
  const windowEnd = ymd(endEx); // EXCLUSIVE

  const byDate: Record<string, ActivityItem[]> = {};
  let shownCount = 0;
  let outsideWindowCount = 0;
  for (const a of input.activities) {
    if (a.date >= windowStart && a.date < windowEnd) {
      (byDate[a.date] ??= []).push(a);
      shownCount++;
    } else {
      outsideWindowCount++;
    }
  }

  const resolutions: Record<string, DayTypeResolution> = {};
  const conflicts: Record<string, DayConflict> = {};
  for (const w of weeks) {
    for (const d of w.days) {
      const res = resolveDayType(input.rules, d.date);
      resolutions[d.date] = res;
      const c = conflictsFor(res, byDate[d.date] ?? []);
      if (c) conflicts[d.date] = c;
    }
  }

  return {
    weeks, windowStart, windowEnd, byDate, resolutions, conflicts,
    shownCount, outsideWindowCount, isEmpty: shownCount === 0,
  };
}
