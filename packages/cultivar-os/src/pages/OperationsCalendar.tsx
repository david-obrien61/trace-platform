/**
 * ── OPERATIONS CALENDAR — four weeks, one activity stream, and the mismatch ──────
 *
 * PURPOSE      The operations screen Joel runs the week from, and Terry reads from an RV.
 *              Four weeks (this one + three ahead), every day named, every piece of
 *              scheduled work shown with its KIND — and, where the work booked on a day
 *              contradicts the KIND OF DAY it is, a visible flag saying what the
 *              contradiction is. It REPLACES the day-grouped list at /delivery-schedule
 *              (David's ONE DELIVERY LIST ruling: there cannot be two things doing the
 *              same job) and keeps that list as the drill-in for a selected day, so every
 *              affordance Lauren already uses — inline date edit, edit customer, route the
 *              day — is unmoved.
 * DEPENDENCIES supabase; `deliveries` (the one live dated source) + `business_operating_days`
 *              (the day-type rules); ../lib/operationsCalendar (the whole model, pure and
 *              tested); ./DeliverySchedule (the day drill-in); SurfaceState (the six states).
 * OUTPUTS      The four-week grid; the day-type editor (write-gated on settings:update);
 *              the selected-day drill-in; the SOURCES footnote that states what this screen
 *              can and cannot see.
 *
 * 🔴 IT WARNS, IT NEVER BLOCKS. Nothing here refuses anything. A conflicted day is flagged
 *    and every one of its stops still renders, still edits, still routes. David's trailer
 *    flagged red for brake maintenance: "today I'm taking the damn trailer."
 *
 * 🔴 IT IS NOT A REPLACEMENT FOR GOOGLE CALENDAR. Lauren's carries a PTA meeting and
 *    birthdays. This is the OPERATIONS calendar — it imports nothing, syncs nothing, and
 *    owns none of her week.
 *
 * 🔴 THE SELECTED DAY IS THE SUBJECT, NOT A FOOTNOTE. The first build rendered the drill-in
 *    at the very bottom of the page, BELOW the sources footnote — so clicking a day produced
 *    a correct and complete day view that nobody could see, and the truncated name in the
 *    cell read as the whole answer. Two changes, both display: the day section is moved
 *    directly under the grid, and selecting a day BRINGS IT INTO VIEW. The drill-in itself is
 *    untouched — its green header ("Saturday, Aug 29, 2026 · 7 stops on this day") already
 *    reads as the subject of the page; it was in the wrong place, not the wrong shape.
 *
 * 🔴 AND THE WINDOW MOVES. Fixed at four weeks forward, the grid could not reach Saturday
 *    2026-08-29 — seven stops, ONE DAY before the window — while the drill-in beneath it
 *    counted "9 scheduled in total" and offered one. Back and forward a whole window at a
 *    time, plus one press home. ⚠️ THE CONTROL IS PLACED BY DEVICE, David's call and not a
 *    default: the desktop gets a dropdown (it already navigates by dropdown and does not need
 *    arrows), the phone and the tablet in the yard get arrows, where they are the whole
 *    interface. ONE mechanism (`offsetWeeks` in the model), two placements.
 *
 * ⚠️ SCOPE OF THE COUNT, STATED ON THE SCREEN AND NOT ONLY HERE: this reads `deliveries`
 *    ONLY. `orders.delivery_date` is a SECOND record of the same fact with no reliable key
 *    joining the two (tech-debt #108), so checkout-scheduled work that never produced a
 *    `deliveries` row is ABSENT — a known and NAMED gap. Inventing a dedupe rule inside a
 *    calendar build is how the calendar becomes where the duplicate-delivery bug lives.
 *
 * DEVICE: desktop. Declared per the 2026-08-23 capability ruling, using the owner-test
 *    board's `DEVICE:` vocabulary — the `TileEntry.capability` field that ruling calls for
 *    is still OPEN (a 33-tile backfill), and minting it inside a calendar build is not that.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, AlertTriangle, Truck, Sprout, Settings2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { NotPermitted, requirementText } from '@trace/shared/components/SurfaceState';
import { DeliverySchedule } from './DeliverySchedule';
import {
  buildCalendarModel, parseYmd, WEEKDAY_NAMES, WEEKDAY_SHORT,
  DAY_TYPE_CATALOG, ACTIVITY_SOURCES,
  OPERATING_DAY_SELECT, WINDOW_STEP_WEEKS, weekLabel, windowHeading, cellSummary,
  type ActivityItem, type StoredOperatingDayRule, type CalendarModel,
} from '../lib/operationsCalendar';

const TRACE_CALENDAR = true; // [TRACE:CALENDAR] STD-003 — ON until David owner-proves

const GREEN = '#27500A';
const SAGE  = '#EAF3DE';
const GRAY  = '#6b7280';
const DARK  = '#111827';
const RED   = '#A32D2D';
const AMBER = '#FEF3C7';

/** PostgREST codes for "that relation does not exist" — the gated-migration case. */
const TABLE_ABSENT = new Set(['42P01', 'PGRST205', 'PGRST204']);

type RuleState =
  | { kind: 'loading' }
  | { kind: 'ready'; rules: StoredOperatingDayRule[] }
  | { kind: 'unavailable' }          // the table is not there yet (migration gated)
  | { kind: 'error'; message: string };

interface DeliveryActivityRow {
  id: string;
  delivery_date: string | null;
  service_type: string | null;
  notes: string | null;
  address_line1: string | null;
  city: string | null;
  customers: { first_name: string; last_name: string } | null;
}

function monthDay(date: string): string {
  const d = parseYmd(date);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : date;
}

/**
 * Is the viewport narrow enough that a dropdown is the wrong control?
 *
 * ⚠️ DELIBERATELY NOT `ReceiptKeeper.useIsMobile`, and the reason is that they answer
 * DIFFERENT QUESTIONS. That one asks "can this device take a photo" — pointer coarseness and
 * user-agent, because a camera-first capture screen turns on the hardware. This asks "is there
 * room for a select", which is a width question and nothing else. Reusing it would have made a
 * desktop browser with a touchscreen navigate by arrows. §6 r8 extracts the same OPERATION in
 * two places; these are two operations that happen to both call `matchMedia`, and this is the
 * SECOND — the rule-of-three extraction is not yet earned and is named here so the third one
 * takes it rather than adding a fourth copy.
 *
 * 768px is the platform's existing desktop/tablet line (§6 r7, the tile grid).
 */
const NARROW_QUERY = '(max-width: 767px)';
function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState<boolean>(
    () => (typeof window === 'undefined' ? false : window.matchMedia?.(NARROW_QUERY)?.matches ?? false));
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW_QUERY);
    if (!mq) return;
    const recompute = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', recompute);
    return () => mq.removeEventListener?.('change', recompute);
  }, []);
  return narrow;
}

/**
 * The window `offsetWeeks` steps from home, as bare bounds. Half-open [start, end).
 *
 * Built from `buildCalendarModel` with no rules and no activities rather than from a second
 * copy of the date arithmetic — the bounds the query uses and the bounds the grid draws are
 * then the SAME bounds by construction, which is the property the first build already relied
 * on and the one a hand-rolled `+28 days` would quietly break.
 */
function windowFor(offsetWeeks: number): { start: string; end: string; lastDay: string } {
  const probe = buildCalendarModel({ offsetWeeks, rules: [], activities: [] });
  // `end` is EXCLUSIVE (the query's bound); `lastDay` is the inclusive last day (a label's).
  // Both come from the probe rather than one being derived from the other by hand — an
  // off-by-one between the bound and the label is the oldest bug in this file's family.
  return { start: probe.windowStart, end: probe.windowEnd, lastDay: probe.weeks[3].endDate };
}

/** How far the dropdown reaches either way: six windows back, six forward — about a year. */
const WINDOW_CHOICES = Array.from({ length: 13 }, (_, i) => (i - 6) * WINDOW_STEP_WEEKS);

export function OperationsCalendar() {
  const { businessId, can } = useBusinessContext();
  const canWriteRules = can('settings:update');

  const [ruleState, setRuleState] = useState<RuleState>({ kind: 'loading' });
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const isNarrow = useIsNarrow();
  const dayRef = useRef<HTMLDivElement | null>(null);

  // The model is rebuilt from whatever we actually have. Rules that failed to load are an
  // EMPTY rule set, not a fabricated one — an unreadable rule must never become a claim.
  const model: CalendarModel = useMemo(() => buildCalendarModel({
    offsetWeeks,
    rules: ruleState.kind === 'ready' ? ruleState.rules : [],
    activities: activities ?? [],
  }), [ruleState, activities, offsetWeeks]);

  // The query's bounds, derived from the offset ALONE so they do not depend on the model and
  // cannot loop through it. Same function the model uses.
  const bounds = useMemo(() => windowFor(offsetWeeks), [offsetWeeks]);

  useEffect(() => {
    if (!businessId) return;
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // 🔴 THE READ FOLLOWS THE WINDOW. The first build read once, bounded by a window that could
  // never move; moving the grid without re-reading would have drawn empty weeks over real work
  // — a calendar lying by omission, which is worse than the window that could not move.
  useEffect(() => {
    if (!businessId) return;
    void loadActivities(bounds.start, bounds.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, bounds.start, bounds.end]);

  /**
   * Bring the selected day into view. THE WHOLE OF DEFECT ①: the day view always rendered
   * correctly and completely — it was simply below four weeks of grid, so clicking a day
   * appeared to do nothing but highlight a cell, and the truncated name in that cell read as
   * the entire answer. The grid stays where it is; the day becomes what you are looking at.
   */
  useEffect(() => {
    if (!selected) return;
    dayRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] day selected — scrolled into view', selected);
  }, [selected]);

  /**
   * Move the window by whole windows. A selected day that the new window cannot show is
   * CLEARED rather than left below the grid: a day view whose day is nowhere on the calendar
   * above it is the kind of orphan that makes a reader distrust both.
   */
  function moveWindow(next: number) {
    const w = windowFor(next);
    setOffsetWeeks(next);
    if (selected && !(selected >= w.start && selected < w.end)) {
      setSelected(null);
      if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] selection cleared — outside the new window', { selected, ...w });
    }
    if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] window moved', { offsetWeeks: next, ...w });
  }

  async function loadRules() {
    setRuleState({ kind: 'loading' });
    const { data, error } = await supabase
      .from('business_operating_days')
      .select(OPERATING_DAY_SELECT)
      .eq('business_id', businessId!);
    if (error) {
      // 🔴 THE THREE OUTCOMES ARE KEPT APART. "The table isn't there yet" is a different
      // fact from "the read failed" and from "there are no rules", and collapsing them
      // would tell the owner their day types are unset when they are merely unreachable.
      const code = (error as { code?: string }).code ?? '';
      if (TABLE_ABSENT.has(code)) { setRuleState({ kind: 'unavailable' }); }
      else { setRuleState({ kind: 'error', message: error.message }); }
      if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] rules read failed', { code, message: error.message });
      return;
    }
    const rules = (data ?? []) as StoredOperatingDayRule[];
    setRuleState({ kind: 'ready', rules });
    if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] rules loaded —', rules.length, 'rule(s)');
  }

  async function loadActivities(windowStart: string, windowEnd: string) {
    setActivityError(null);
    // A window change is a RE-READ, and until it lands the page says "Loading…" rather than
    // holding the previous window's stops under the new window's dates.
    setActivities(null);
    // Bounded on BOTH sides. An unbounded `gte` is the defect the dashboard shipped: work
    // booked in September counted as this week's. The window is the model's own.
    const { data, error } = await supabase
      .from('deliveries')
      .select('id, delivery_date, service_type, notes, address_line1, city, customers ( first_name, last_name )')
      .eq('business_id', businessId!)
      .neq('status', 'cancelled')
      .gte('delivery_date', windowStart)
      .lt('delivery_date', windowEnd)
      .order('delivery_date', { ascending: true });
    if (error) {
      setActivities(null);
      setActivityError(error.message);
      if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] activity read failed', error.message);
      return;
    }
    const rows = (data ?? []) as unknown as DeliveryActivityRow[];
    const items: ActivityItem[] = rows
      .filter((r) => r.delivery_date)
      .map((r) => ({
        id: r.id,
        kind: 'delivery',
        date: r.delivery_date!,
        label: r.customers
          ? `${r.customers.first_name} ${r.customers.last_name}`.trim()
          : ([r.address_line1, r.city].filter(Boolean).join(', ') || 'Delivery'),
        detail: r.service_type,
        serviceType: r.service_type,
      }));
    setActivities(items);
    if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] activities loaded —', items.length, 'delivery item(s) in window',
      windowStart, '→', windowEnd, '(exclusive)');
  }

  /**
   * Set (or clear) a day-type rule. Weekly pattern when `weekday` is given, a date-level
   * exception when `onDate` is.
   *
   * Read-modify-write rather than an upsert: the uniqueness is enforced by a PARTIAL index,
   * which `onConflict` cannot name reliably. Every branch checks the rows it affected (A8) —
   * a PostgREST write matching zero rows returns success with no error, and on a permission
   * refusal that would leave the new value sitting on screen looking saved.
   */
  async function setRule(
    opts: { weekday?: number; onDate?: string },
    dayType: string | null,
  ) {
    if (ruleState.kind !== 'ready') return;
    const key = opts.weekday != null ? `w${opts.weekday}` : `d${opts.onDate}`;
    setWriteError(null);
    if (!canWriteRules) { setWriteError(requirementText('settings:update')); return; }
    setSavingKey(key);

    const existing = ruleState.rules.find((r) =>
      opts.weekday != null ? r.on_date == null && r.weekday === opts.weekday : r.on_date === opts.onDate);

    // 🔴 EVERY MUTATION IS ONE LITERAL STATEMENT, ADDRESSED BY ROW ID. The first draft routed
    // all three through a shared query builder with an `as any` to make the chaining
    // typecheck; the second replaced the cast with a ternary inside the chain. Both hid the
    // row-count check from verify-zero-row-writes — the first as NEEDS_CHECK, the second as
    // UNCHECKABLE — and the first hid it from the type system too. A write a cap cannot read
    // is a write the next person cannot read either, so the shape changed rather than the
    // declaration. `business_id` rides alongside the id: tenant scope is never implied by a
    // key that happens to be unique (AC-3).
    const REFUSED_SAVE = 'That day type was not saved — you may not have permission to change day types.';
    const REFUSED_CLEAR = 'That day type was not cleared — you may not have permission to change day types.';
    let failure: string | null = null;

    if (dayType === null) {
      if (existing) {
        const { data, error } = await supabase.from('business_operating_days')
          .delete().eq('id', existing.id).eq('business_id', businessId!).select('id');
        if (error) failure = error.message;
        else if (!data?.length) failure = REFUSED_CLEAR;
      }
    } else if (existing) {
      const { data, error } = await supabase.from('business_operating_days')
        .update({ day_type: dayType }).eq('id', existing.id).eq('business_id', businessId!).select('id');
      if (error) failure = error.message;
      else if (!data?.length) failure = REFUSED_SAVE;
    } else {
      const { data, error } = await supabase.from('business_operating_days')
        .insert({
          business_id: businessId!,
          weekday: opts.weekday ?? null,
          on_date: opts.onDate ?? null,
          day_type: dayType,
        })
        .select('id');
      if (error) failure = error.message;
      else if (!data?.length) failure = REFUSED_SAVE;
    }

    if (TRACE_CALENDAR) console.log('[TRACE:CALENDAR] rule write', { ...opts, dayType, failure });
    if (failure) { setWriteError(failure); setSavingKey(null); return; }
    await loadRules();
    setSavingKey(null);
  }

  if (!businessId) return null;

  const loading = ruleState.kind === 'loading' || (activities === null && activityError === null);

  return (
    <div style={{ background: SAGE, minHeight: '100vh', paddingBottom: 48 }}>
      <div style={{ background: GREEN, color: '#fff', padding: '18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <CalendarDays size={22} />
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Operations calendar</h1>

          {/* ── MOVING THE WINDOW ──────────────────────────────────────────────
              ⚠️ ONE MECHANISM, TWO PLACEMENTS — David's call. Arrows are the whole
              interface on a phone or the tablet in the yard; on the desktop, which
              already navigates by dropdown, they would be a third way to do what a
              select does better across a year. Both drive the same `moveWindow`.  */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {isNarrow ? (
              <>
                <button
                  onClick={() => moveWindow(offsetWeeks - WINDOW_STEP_WEEKS)}
                  aria-label={`Back ${WINDOW_STEP_WEEKS} weeks`}
                  style={navBtn}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => moveWindow(offsetWeeks + WINDOW_STEP_WEEKS)}
                  aria-label={`Forward ${WINDOW_STEP_WEEKS} weeks`}
                  style={navBtn}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            ) : (
              <select
                value={offsetWeeks}
                onChange={(e) => moveWindow(Number(e.target.value))}
                aria-label="Which four weeks"
                style={{ ...select, minHeight: 38, fontWeight: 600 }}
              >
                {WINDOW_CHOICES.map((off) => {
                  const w = windowFor(off);
                  return (
                    <option key={off} value={off}>
                      {monthDay(w.start)} – {monthDay(w.lastDay)}
                      {off === 0 ? ' · this week' : ''}
                    </option>
                  );
                })}
                {/* A window reached by arrows on a phone, then resized to desktop, would
                    otherwise have no option to sit on and the select would silently show
                    the wrong one. It stays selectable, named for what it is. */}
                {!WINDOW_CHOICES.includes(offsetWeeks) && (
                  <option value={offsetWeeks}>
                    {monthDay(model.windowStart)} – {monthDay(model.weeks[3].endDate)}
                  </option>
                )}
              </select>
            )}

            {/* 🔴 THE WAY HOME, and it is one press from anywhere — a reader four months out
                should not have to count their way back. Shown only when there is somewhere
                to come home from (§6 r18: a control that would do nothing says nothing). */}
            {offsetWeeks !== 0 && (
              <button onClick={() => moveWindow(0)} style={{ ...navBtn, width: 'auto', padding: '0 12px', fontWeight: 700 }}>
                This week
              </button>
            )}
          </div>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', opacity: 0.85 }}>
          {windowHeading(offsetWeeks)} — {monthDay(model.windowStart)} to {monthDay(model.weeks[3].endDate)}
        </p>
      </div>

      <div style={{ padding: 16 }}>
        {/* ── DAY-TYPE RULES ─────────────────────────────────────────────────── */}
        <div style={card}>
          <button
            onClick={() => setEditorOpen((v) => !v)}
            style={{ ...rowBtn, width: '100%' }}
          >
            <Settings2 size={16} color={GREEN} />
            <span style={{ fontWeight: 700, color: DARK }}>Day types</span>
            <span style={{ marginLeft: 'auto', color: GRAY, fontSize: '0.8125rem' }}>
              {ruleState.kind === 'ready'
                ? (ruleState.rules.length === 0 ? 'none set' : `${ruleState.rules.length} rule${ruleState.rules.length === 1 ? '' : 's'}`)
                : ruleState.kind === 'unavailable' ? 'not available yet'
                : ruleState.kind === 'error' ? 'could not be read' : 'loading…'}
            </span>
            <span style={{ color: GREEN, fontWeight: 700 }}>{editorOpen ? '▾' : '▸'}</span>
          </button>

          {/* Each of the four rule states says a DIFFERENT thing. None of them is silence. */}
          {ruleState.kind === 'unavailable' && (
            <p style={note}>
              Day types aren’t set up on this business yet — the operating-days rules haven’t been
              applied to the database. The calendar below still shows every scheduled day; it just
              can’t tell you which of them are the wrong kind of day for the work on them.
            </p>
          )}
          {ruleState.kind === 'error' && (
            <p style={{ ...note, color: RED }}>
              Day types could not be read: {ruleState.message}. Nothing below is flagged — that is a
              read failure, not a clean week.
            </p>
          )}
          {ruleState.kind === 'ready' && ruleState.rules.length === 0 && (
            <p style={note}>
              No day types set. Nothing is being checked — set the weekly pattern below and the
              calendar will start telling you when a day’s work doesn’t match the kind of day it is.
            </p>
          )}

          {editorOpen && ruleState.kind === 'ready' && (
            <div style={{ padding: '4px 14px 14px' }}>
              {!canWriteRules && (
                <NotPermitted permission="settings:update" what="Changing day types" inline
                  style={{ marginBottom: 10 }} />
              )}
              {writeError && <p style={{ ...note, color: RED, padding: '0 0 8px' }}>{writeError}</p>}
              <p style={{ ...note, padding: '0 0 10px' }}>The weekly pattern. A single day can be
                overridden without changing the pattern — pick a day in the calendar below.</p>
              {WEEKDAY_NAMES.map((name, wd) => {
                const rule = ruleState.rules.find((r) => r.on_date == null && r.weekday === wd);
                return (
                  <div key={wd} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                    <span style={{ width: 92, fontSize: '0.875rem', color: DARK }}>{name}</span>
                    <select
                      value={rule?.day_type ?? ''}
                      disabled={!canWriteRules || savingKey === `w${wd}`}
                      onChange={(e) => { void setRule({ weekday: wd }, e.target.value || null); }}
                      style={select}
                    >
                      <option value="">Not set</option>
                      {Object.values(DAY_TYPE_CATALOG).map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                      {/* A value the business typed itself stays selectable rather than being
                          silently rewritten to one of ours (AC-4). */}
                      {rule && !DAY_TYPE_CATALOG[rule.day_type] && (
                        <option value={rule.day_type}>{rule.day_type} (custom)</option>
                      )}
                    </select>
                    {rule && !DAY_TYPE_CATALOG[rule.day_type] && (
                      <span style={{ fontSize: '0.75rem', color: GRAY }}>not recognised — not checked</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── THE GRID ───────────────────────────────────────────────────────── */}
        {loading && <p style={{ textAlign: 'center', color: GRAY, paddingTop: 40 }}>Loading…</p>}

        {!loading && activityError && (
          <div style={{ ...card, padding: 20, textAlign: 'center' }}>
            <AlertTriangle size={28} color={RED} />
            <p style={{ margin: '10px 0 0', fontWeight: 700, color: RED }}>The schedule could not be read</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: GRAY }}>{activityError}</p>
            <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: GRAY }}>
              This is a failure, not an empty four weeks.
            </p>
          </div>
        )}

        {!loading && !activityError && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 2px 10px' }}>
              <span style={{ fontWeight: 700, color: DARK }}>
                {model.isEmpty
                  ? 'Nothing scheduled in the next four weeks'
                  : `${model.shownCount} scheduled ${model.shownCount === 1 ? 'item' : 'items'}`}
              </span>
              <span style={{ fontSize: '0.75rem', color: GRAY }}>
                deliveries only{model.outsideWindowCount > 0
                  ? ` · ${model.outsideWindowCount} more outside these four weeks`
                  : ''}
              </span>
            </div>

            {model.weeks.map((week) => (
              <div key={week.startDate} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.75rem', color: GRAY, fontWeight: 700, padding: '0 2px 6px' }}>
                  {weekLabel(week.relativeIndex)}
                  {' · '}{monthDay(week.startDate)} – {monthDay(week.endDate)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
                  {week.days.map((day) => {
                    const res = model.resolutions[day.date];
                    const items = model.byDate[day.date] ?? [];
                    const conflict = model.conflicts[day.date];
                    const isSel = selected === day.date;
                    // 🔴 DEFECT ①'s other half. A 90px cell printing three names printed
                    // three ellipses and identified nobody; the count is strictly more
                    // information, and the day view below carries the detail.
                    const summary = cellSummary(items);
                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelected(isSel ? null : day.date)}
                        style={{
                          textAlign: 'left', background: '#fff', cursor: 'pointer',
                          border: `2px solid ${isSel ? GREEN : conflict ? RED : '#e5e7eb'}`,
                          borderRadius: 10, padding: 8, minHeight: 108,
                          opacity: day.isPast ? 0.55 : 1,
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontSize: '0.6875rem', color: GRAY, fontWeight: 700 }}>
                            {WEEKDAY_SHORT[day.weekday]}
                          </span>
                          <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: day.isToday ? GREEN : DARK }}>
                            {parseYmd(day.date)?.getDate()}
                          </span>
                          {day.isToday && (
                            <span style={{ fontSize: '0.625rem', color: GREEN, fontWeight: 700 }}>TODAY</span>
                          )}
                        </div>

                        {/* The day type. "Not set" and "not recognised" are shown, never hidden —
                            a blank here would read as a checked, clean day. */}
                        <span style={{
                          fontSize: '0.625rem', fontWeight: 700, color: res.meta ? GREEN : GRAY,
                          background: res.meta ? SAGE : '#f3f4f6', borderRadius: 4,
                          padding: '2px 5px', alignSelf: 'flex-start',
                        }}>
                          {res.meta ? res.meta.label
                            : res.dayType ? `${res.dayType} · not checked`
                            : 'no day type'}
                          {res.source === 'exception' ? ' ·  override' : ''}
                        </span>

                        {summary.only && (
                          <span style={cellLine(summary.only.serviceType === 'planting')}>
                            {summary.only.serviceType === 'planting'
                              ? <Sprout size={11} color={GREEN} /> : <Truck size={11} color="#22d3ee" />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {summary.only.label}
                            </span>
                          </span>
                        )}
                        {summary.text && (
                          <span style={cellLine(summary.hasPlanting)}>
                            {summary.hasPlanting
                              ? <Sprout size={11} color={GREEN} /> : <Truck size={11} color="#22d3ee" />}
                            <span style={{ fontWeight: 700 }}>{summary.text}</span>
                          </span>
                        )}

                        {/* 🔴 THE MISMATCH — and it says WHAT the conflict is, never just that
                            there is one. It never blocks and it never hides a stop. */}
                        {conflict && (
                          <span style={{
                            marginTop: 'auto', background: AMBER, border: `1px solid ${RED}`,
                            borderRadius: 6, padding: '4px 5px', fontSize: '0.625rem', color: RED,
                            fontWeight: 600, lineHeight: 1.3,
                          }}>
                            {conflict.reasons.map((r) => r.text).join(' · ')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── THE SELECTED DAY — the subject, directly under the grid ──────────
            🔴 THE MOVE IS THE FIX. This block and the drill-in beneath it were correct and
            complete before this pass; they simply rendered at the BOTTOM of the page, below
            the sources footnote, so clicking a day scrolled nothing, appeared to do nothing,
            and left the truncated name in the cell reading as the whole answer. `dayRef` is
            what selecting a day scrolls to.
            ⚠️ IT MOUNTS OUTSIDE THE GRID'S LOADING BRANCH, DELIBERATELY. The drill-in reads
            `deliveries` for ITSELF and is unaffected by the calendar's own read — putting it
            inside would unmount and re-fetch the whole list on every window move, and would
            remove the delivery list entirely when the CALENDAR's read failed, which is a
            second failure invented out of the first (CARD 3).
            ⚠️ The date appears here as the day-type control's LABEL and again in the
            drill-in's green header one line below. Accepted deliberately rather than deduped:
            that header is CARD 9's proven text ("Saturday, Aug 29, 2026 · 7 stops on this
            day"), it is the heading that reads as the subject of the page, and rewriting it
            to remove a repeated date would break a standing card and touch the drill-in this
            pass is not allowed to touch. */}
        <div ref={dayRef} style={{ scrollMarginTop: 8 }}>
          {selected && !activityError && (
            <div style={{ ...card, padding: 14, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ color: DARK }}>
                  {WEEKDAY_NAMES[parseYmd(selected)?.getDay() ?? 0]} {monthDay(selected)}
                </strong>
                {ruleState.kind === 'ready' && (
                  <>
                    <span style={{ fontSize: '0.8125rem', color: GRAY }}>this day is:</span>
                    <select
                      value={ruleState.rules.find((r) => r.on_date === selected)?.day_type ?? ''}
                      disabled={!canWriteRules || savingKey === `d${selected}`}
                      onChange={(e) => { void setRule({ onDate: selected }, e.target.value || null); }}
                      style={select}
                    >
                      <option value="">Follow the weekly pattern</option>
                      {Object.values(DAY_TYPE_CATALOG).map((m) => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              {model.conflicts[selected] && (
                <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: RED }}>
                  {model.conflicts[selected].reasons.map((r) => r.text).join(' · ')} — nothing is blocked;
                  change the day’s type above, or move the work below.
                </p>
              )}
            </div>
          )}

          {/* ── THE DAY DRILL-IN — the SAME list, filtered. Not a second delivery list. ──
              UNCHANGED except for where it sits. Every affordance CARD 9 audited — inline
              date edit, Edit customer, Route this day, Capture an invoice, both route
              buttons — is gated on `can(...)` alone and none of them is touched here.
              The negative side margin cancels this container's 16px padding so the drill-in's
              own green header bar stays FULL-BLEED, exactly as it rendered at the foot of the
              page: the section moved, its shape did not (§6 r14's trick, same reason). */}
          <div style={{ margin: '0 -16px' }}>
            <DeliverySchedule filterDate={selected} />
          </div>
        </div>

        {/* ── WHAT THIS SCREEN CAN AND CANNOT SEE ────────────────────────────── */}
        <div style={{ ...card, padding: 14, marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: DARK, fontSize: '0.8125rem', marginBottom: 6 }}>
            What this calendar shows
          </div>
          {ACTIVITY_SOURCES.map((s) => (
            <div key={s.kind} style={{ display: 'flex', gap: 8, fontSize: '0.75rem', padding: '3px 0' }}>
              <span style={{ width: 14, color: s.state === 'live' ? GREEN : GRAY }}>
                {s.state === 'live' ? '●' : '○'}
              </span>
              <span style={{ width: 190, color: DARK, fontWeight: 600 }}>{s.label}</span>
              <span style={{ color: GRAY, flex: 1 }}>{s.source}</span>
            </div>
          ))}
          <p style={{ ...note, padding: '8px 0 0' }}>
            Deliveries scheduled from the counter that never produced a delivery record are not
            shown here (tech-debt #108). Recurring business obligations — payroll, sales tax — and
            crew or equipment assignment are not in this screen at all.
          </p>
        </div>
      </div>

    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 14,
};
const rowBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
  padding: '14px', cursor: 'pointer', minHeight: 48, textAlign: 'left',
};
const note: React.CSSProperties = {
  margin: 0, padding: '0 14px 14px', fontSize: '0.8125rem', color: GRAY, lineHeight: 1.45,
};
/** One line of work inside a day cell — a name when there is one, a count when there are more. */
function cellLine(planting: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '0.6875rem', color: DARK,
    borderLeft: `3px solid ${planting ? GREEN : '#22d3ee'}`,
    paddingLeft: 5, lineHeight: 1.3,
  };
}

/**
 * Arrows and the way home. 48px BOTH WAYS — §6 r3's touch target, and not negotiable here:
 * on the phone and the tablet in the yard these arrows ARE the navigation, pressed with a
 * glove on. The first draft had them at 40 and the comment said 48, which is the smaller
 * defect of the two and the one that would have survived review.
 */
const navBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 48, minWidth: 48, borderRadius: 8, cursor: 'pointer',
  background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.45)',
  color: '#fff', fontSize: '0.8125rem',
};
const select: React.CSSProperties = {
  minHeight: 34, borderRadius: 8, border: '1px solid #d1d5db', padding: '4px 8px',
  fontSize: '0.8125rem', background: '#fff', color: DARK,
};

