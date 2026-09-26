// ============================================================
// PlanTheDayPanel — TRACE proposes the crew split; Lauren decides (COMPONENT — cultivar-os)
// PURPOSE:      For one day: route first, then crews. Cluster the stops, add drive time to
//               planting time (minutes per gallon), compare against the day limit, run one crew
//               until it goes over and then two — and show the working. Lauren accepts, moves a
//               stop between crews (the totals re-balance), or overrides and does nothing.
// DEPENDENCIES: shared/business-logic/planTheDay (pure, already tested) · lib/planDayRead (the
//               gather) · lib/teams (assignStopsTeam — the ONE writer). No routing engine here.
// OUTPUTS:      <PlanTheDayPanel>
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 IT PROPOSES. LAUREN DECIDES. NOTHING IS WRITTEN UNTIL SHE PRESSES ACCEPT.
// ═════════════════════════════════════════════════════════════════════════════
// Everything on this panel is a draft held in this component. Accept calls `assignStopsTeam` —
// the existing writer, which enforces `deliveries:update` server-side — once per crew. Moving a
// stop before accepting changes only the draft, and the totals recompute from the SAME pure
// function that made the proposal, so the numbers she accepts are the numbers she was shown.
//
// ── ⚠️ THE DRIVE TIME IS AN ESTIMATE AND EVERY LINE SAYS SO ─────────────────────────────────
// `planTheDay` takes an optional real-optimiser callback. There isn't one to give it: the
// Directions call lives inside a React component on the route page and is asynchronous, while the
// planner needs a synchronous figure ~n² times while it searches for the best split. So this uses
// the built-in crow's-flight estimate, and `driveBasis` renders as "estimated" wherever a drive
// figure appears. Wiring the real optimiser means extracting it first — the morning file says so.
//
// ── 🔴 A STOP THAT CANNOT BE PLACED IS LISTED, NEVER PLANNED ────────────────────────────────
// It is not quietly dropped into whichever crew has room. An invented location produces a plan
// that is wrong and looks entirely reasonable, which is the worst shape of wrong there is.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@trace/shared/supabase/client';
import { planTheDay, type DayPlan } from '@trace/shared/business-logic/planTheDay';
import { readPlanDay, type PlanDayInputs } from '../../lib/planDayRead';
import type { Team } from '../../lib/teams';
import { acceptPlan } from '../../lib/planAccept';

const TRACE_PLAN = true;   // STD-003: on by default until owner-proven.

interface Props {
  businessId: string;
  date: string;
  teams: Team[];
  canWrite: boolean;
  onAccepted?: () => void;
}

/** Which crew each stop is assigned to IN THE DRAFT — 0-based crew index. */
type Draft = Map<string, number>;

export function PlanTheDayPanel({ businessId, date, teams, canWrite, onAccepted }: Props) {
  const [inputs, setInputs] = useState<PlanDayInputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [crewTeam, setCrewTeam] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true); setDraft(null); setNote('');
      const got = await readPlanDay(supabase, businessId, date);
      if (!alive) return;
      setInputs(got); setLoading(false);
    })();
    return () => { alive = false; };
  }, [businessId, date]);

  // ── the proposal ──────────────────────────────────────────────────────────────────────────
  const proposal: DayPlan | null = useMemo(() => {
    if (!inputs || inputs.failed) return null;
    return planTheDay({
      stops: inputs.stops, depot: inputs.depot,
      minutesPerGallon: inputs.minutesPerGallon,
      dayLimitHours: inputs.dayLimitHours,
      maxCrews: 2,
    });
  }, [inputs]);

  // The draft starts as the proposal, and only Lauren changes it after that.
  useEffect(() => {
    if (!proposal) return;
    const d: Draft = new Map();
    proposal.crews.forEach((c, i) => c.stopIds.forEach(id => d.set(id, i)));
    setDraft(d);
  }, [proposal]);

  /**
   * 🔴 THE TOTALS AFTER A MOVE COME FROM THE SAME FUNCTION AS THE PROPOSAL, not from adding and
   * subtracting the moved stop's minutes. Re-deriving the arithmetic here would be a second author
   * for one calculation, and the two would drift the first time the drive estimate changed.
   * `maxCrews: 1` per crew is how a fixed set of stops is summarised without being re-split.
   */
  const crewNow = useCallback((crewIndex: number): DayPlan | null => {
    if (!inputs || !draft) return null;
    const mine = inputs.stops.filter(s => draft.get(s.id) === crewIndex);
    if (mine.length === 0) return null;
    return planTheDay({
      stops: mine, depot: inputs.depot,
      minutesPerGallon: inputs.minutesPerGallon,
      dayLimitHours: inputs.dayLimitHours,
      maxCrews: 1,
    });
  }, [inputs, draft]);

  const crewCount = proposal?.crews.length ?? 0;
  const crews = useMemo(
    () => Array.from({ length: Math.max(crewCount, 1) }, (_, i) => ({ index: i, plan: crewNow(i) })),
    [crewCount, crewNow],
  );

  function move(stopId: string, toCrew: number) {
    setDraft(prev => { const next = new Map(prev); next.set(stopId, toCrew); return next; });
    setNote('');
  }

  async function accept() {
    if (!inputs || !draft) return;
    setSaving(true); setNote('');
    // 🔴 THE WRITE LIVES IN `acceptPlan`, NOT HERE — `verify:writer-registry` refuses a capture
    // path whose logic a test cannot reach, and it was right: the partial-failure behaviour is
    // only provable once it is out of a click handler.
    const out = await acceptPlan(supabase, businessId, crews.map(c => ({
      crew: c.index + 1,
      teamId: crewTeam[c.index] || null,
      stopIds: inputs.stops.filter(s => draft.get(s.id) === c.index).map(s => s.id),
    })));
    setSaving(false);
    setNote(out.message);
    if (TRACE_PLAN) console.log('[TRACE:PLAN] accept', { ok: out.ok, assigned: out.assigned });
    if (out.ok && out.assigned.length > 0) onAccepted?.();
  }


  if (loading) return <p style={hint}>Working out the day…</p>;
  if (!inputs) return null;
  if (inputs.failed) {
    return <div style={warn}><strong>Could not read that day.</strong> {inputs.failed} — no plan is being shown, which is not the same as a day with nothing on it.</div>;
  }
  if (!inputs.depot) {
    return <div style={warn}><strong>Your own address has no location yet.</strong> Every distance is measured from the yard, so that address has to be found first — Settings → Business profile.</div>;
  }

  return (
    <div style={{ border: '1px solid #d8e3c8', background: '#F6FAF0', borderRadius: 10, padding: '0.9rem', margin: '0 0 12px' }}>
      <div style={{ fontWeight: 700, color: '#27500A', marginBottom: 6 }}>Plan the day</div>

      <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0 0 8px', lineHeight: 1.5 }}>
        {proposal?.message ?? 'Nothing to plan.'}
      </p>

      {/* 🔴 SHOW THE WORKING — which figures were used, and where each came from. */}
      <p style={hint}>
        Day limit <strong>{inputs.dayLimitHours} h</strong>
        {inputs.limitIsStored ? ' (your setting)' : ' — the platform default; there is no Settings field for this yet, so it is NOT your 7'}.
        {' '}Planting <strong>{inputs.minutesPerGallon} min per gallon</strong>.
        {' '}Drive time is a <strong>straight-line estimate</strong>, not the optimiser's — a real
        route differs.
        {inputs.treesSizeUnknown > 0 && (
          <> {inputs.treesSizeUnknown} tree{inputs.treesSizeUnknown === 1 ? '' : 's'} on this day
          {' '}<strong>have no readable size</strong>, so their planting time is missing and every
          total below is <em>at least</em> what it says.</>
        )}
      </p>

      {/* ── the crews ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(crews.length, 1)}, minmax(220px, 1fr))`, gap: 12, marginTop: 10 }}>
        {crews.map(c => (
          <div key={c.index} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>Crew {c.index + 1}</div>
            {c.plan?.crews[0] ? (
              <p style={{ ...hint, margin: '0 0 6px' }}>
                <strong style={{ color: c.plan.crews[0].overLimit ? '#A32D2D' : '#27500A' }}>
                  {hours(c.plan.crews[0].totalMinutes)}
                </strong>{' '}of {inputs.dayLimitHours} h · {hours(c.plan.crews[0].driveMinutes)} driving (estimated)
                {' + '}{hours(c.plan.crews[0].plantingMinutes)} planting · {c.plan.crews[0].stops} stops, {c.plan.crews[0].trees} trees
                {c.plan.crews[0].overLimit && <> — <strong>over the day</strong></>}
              </p>
            ) : <p style={{ ...hint, margin: '0 0 6px' }}>No stops.</p>}

            <label style={{ ...hint, display: 'block', margin: '0 0 6px' }}>
              Who goes out
              <select
                value={crewTeam[c.index] ?? ''}
                onChange={e => setCrewTeam(prev => ({ ...prev, [c.index]: e.target.value }))}
                style={{ display: 'block', width: '100%', padding: '5px 7px', marginTop: 2, border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.85rem' }}
              >
                <option value="">Choose a crew…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {inputs.stops.filter(s => draft?.get(s.id) === c.index).map(s => (
                <li key={s.id} style={{ fontSize: '0.8125rem', padding: '3px 0', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span>{s.name ?? s.id} <span style={{ color: '#9ca3af' }}>({s.trees} tree{s.trees === 1 ? '' : 's'}, {Math.round(s.gallons)} gal)</span></span>
                  {crews.length > 1 && canWrite && (
                    <button
                      onClick={() => move(s.id, c.index === 0 ? 1 : 0)}
                      style={{ background: 'none', border: 'none', color: '#27500A', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline', padding: 0 }}
                    >
                      → crew {c.index === 0 ? 2 : 1}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 🔴 SHOWN, NEVER PLANNED. */}
      {inputs.unplaceable.length > 0 && (
        <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#92400e' }}>
            {inputs.unplaceable.length} stop{inputs.unplaceable.length === 1 ? '' : 's'} could not be placed and {inputs.unplaceable.length === 1 ? 'is' : 'are'} not in the plan
          </div>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: '0.8rem', color: '#92400e' }}>
            {inputs.unplaceable.map(u => <li key={u.id}>{u.name} — {u.why}</li>)}
          </ul>
          <p style={{ ...hint, color: '#92400e', margin: '4px 0 0' }}>
            They still have to go out. Give them to a crew by hand on the stop itself — guessing
            where they are would make the split above look right while being wrong.
          </p>
        </div>
      )}

      {/* ⚠️ THE HOOK, NAMED BUT NOT BUILT. */}
      <p style={hint}>
        ⏱ Customer time windows (“before noon”) are <strong>not part of this plan</strong> — nothing
        stores them yet, so nothing here can honour one.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={!canWrite || saving || !draft} onClick={() => void accept()}>
          {saving ? 'Saving…' : 'Accept this plan'}
        </button>
        <button className="btn" style={{ minHeight: 44 }} disabled={saving} onClick={() => { setDraft(() => { const d: Draft = new Map(); proposal?.crews.forEach((c, i) => c.stopIds.forEach(id => d.set(id, i))); return d; }); setNote('Back to what TRACE proposed.'); }}>
          Start over
        </button>
        {!canWrite && <span style={hint}>You can look, but assigning crews needs delivery edit rights.</span>}
      </div>
      {note && <p style={{ ...hint, color: /Stopped|first/.test(note) ? '#A32D2D' : '#27500A' }}>{note}</p>}
    </div>
  );
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const hint: React.CSSProperties = { fontSize: '0.75rem', color: '#6b7280', margin: '6px 0 0', lineHeight: 1.45 };
const warn: React.CSSProperties = {
  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8,
  padding: '0.9rem', fontSize: '0.85rem', color: '#92400e', margin: '0 0 12px',
};
