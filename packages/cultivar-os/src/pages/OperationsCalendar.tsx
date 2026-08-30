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
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, AlertTriangle, Truck, Sprout, Settings2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessContext } from '@trace/shared/context';
import { NotPermitted, requirementText } from '@trace/shared/components/SurfaceState';
import { DeliverySchedule } from './DeliverySchedule';
import {
  buildCalendarModel, parseYmd, WEEKDAY_NAMES, WEEKDAY_SHORT,
  DAY_TYPE_CATALOG, ACTIVITY_SOURCES,
  OPERATING_DAY_SELECT,
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

  // The model is rebuilt from whatever we actually have. Rules that failed to load are an
  // EMPTY rule set, not a fabricated one — an unreadable rule must never become a claim.
  const model: CalendarModel = useMemo(() => buildCalendarModel({
    rules: ruleState.kind === 'ready' ? ruleState.rules : [],
    activities: activities ?? [],
  }), [ruleState, activities]);

  useEffect(() => {
    if (!businessId) return;
    void loadRules();
    void loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

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

  async function loadActivities() {
    setActivityError(null);
    // Bounded on BOTH sides. An unbounded `gte` is the defect the dashboard shipped: work
    // booked in September counted as this week's. The window is the model's own.
    const probe = buildCalendarModel({ rules: [], activities: [] });
    const { data, error } = await supabase
      .from('deliveries')
      .select('id, delivery_date, service_type, notes, address_line1, city, customers ( first_name, last_name )')
      .eq('business_id', businessId!)
      .neq('status', 'cancelled')
      .gte('delivery_date', probe.windowStart)
      .lt('delivery_date', probe.windowEnd)
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
      probe.windowStart, '→', probe.windowEnd, '(exclusive)');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CalendarDays size={22} />
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>Operations calendar</h1>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', opacity: 0.85 }}>
          This week and the three ahead — {monthDay(model.windowStart)} to {monthDay(model.weeks[3].endDate)}
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

            {model.weeks.map((week, wi) => (
              <div key={week.startDate} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.75rem', color: GRAY, fontWeight: 700, padding: '0 2px 6px' }}>
                  {wi === 0 ? 'This week' : `In ${wi} week${wi === 1 ? '' : 's'}`}
                  {' · '}{monthDay(week.startDate)} – {monthDay(week.endDate)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
                  {week.days.map((day) => {
                    const res = model.resolutions[day.date];
                    const items = model.byDate[day.date] ?? [];
                    const conflict = model.conflicts[day.date];
                    const isSel = selected === day.date;
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

                        {items.map((it) => (
                          <span key={it.id} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: '0.6875rem', color: DARK,
                            borderLeft: `3px solid ${it.serviceType === 'planting' ? GREEN : '#22d3ee'}`,
                            paddingLeft: 5, lineHeight: 1.3,
                          }}>
                            {it.serviceType === 'planting' ? <Sprout size={11} color={GREEN} /> : <Truck size={11} color="#22d3ee" />}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {it.label}
                            </span>
                          </span>
                        ))}

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

            {/* ── THE SELECTED DAY, and its exception control ─────────────────── */}
            {selected && (
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
          </>
        )}

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

      {/* ── THE DAY DRILL-IN — the SAME list, filtered. Not a second delivery list. ── */}
      <DeliverySchedule filterDate={selected} />
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
const select: React.CSSProperties = {
  minHeight: 34, borderRadius: 8, border: '1px solid #d1d5db', padding: '4px 8px',
  fontSize: '0.8125rem', background: '#fff', color: DARK,
};

