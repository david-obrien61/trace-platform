// ============================================================
// OperationsSettings — Settings → Operations. The constants the plan runs on.
//
// PURPOSE:      Set once, read by every plan. Volumes, times, crew, rates of work, months,
//               percentages, pot recovery and the working window — plus the ONE money value that
//               crosses the wall by ruling: the blended mix cost per cubic yard.
//
// 🔴 A PLAN IS NOT A SETTING, AND THIS IS THE SETTING HALF. David's placement ruling: the
//   constants live here; the per-variety decision lives on Inventory → Uppot plan, "where the
//   production manager works." Nothing on this screen decides how many trees move.
//
// 🔴 THE MONEY SPLIT, AND WHO IT IS ACTUALLY ABOUT (R-85). Measured live at LAWNS 2026-09-05:
//   MANAGER holds `settings:read` and `settings:update` and holds NO `pricing_recipe:read`,
//   `costs:*` or `wages:*`. So a manager reaches this screen and edits everything on it EXCEPT the
//   labour rates, which render withheld-with-a-reason. David's correction to the recon framing is
//   worth carrying: it is not Lauren who is blocked — she is an OWNER at LAWNS — it is **Joel, the
//   production manager, the person who runs this plan.**
//   The mix cost is the ruled exception: *"the plan's entire right side is meaningless without it
//   and Joel is the person who would notice bark going up."*
//
// 🔴 EVERY FIELD SAYS WHAT ITS NUMBER IS WORTH (R-89). A guessed default and a measured one look
//   identical in an input box, and this screen is where the guesses are most dangerous because
//   they propagate into every plan. So each row renders its basis, and the guesses say plainly
//   that nobody has measured them — which is the invitation to correct them.
//
// COMMIT MODEL (E2/E3): this is a FORM — the whole record is the unit of work — so it buffers
//   every field and commits on ONE explicit Save, and the copy says so. It does NOT auto-save per
//   field: these constants are interdependent (crew sizes, the window and the departure date are
//   read together), and a half-applied revision is exactly the thing E2 exists to prevent.
//
// DEPENDENCIES: @trace/shared/production · ../../lib/supabase.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  OPERATIONS_DEFAULTS, OPERATIONS_BASIS, WITHHELD_REASON,
  minutesPerPot, arithmeticCheck, resolveConfig,
  type OperationsConfig,
} from '@trace/shared/production';

const GREEN = '#27500A';

interface Props { businessId: string; canWrite: boolean; canReadMoney: boolean; }

type NumKey = {
  [K in keyof OperationsConfig]: OperationsConfig[K] extends number ? K : never
}[keyof OperationsConfig];

const GROUPS: Array<{ title: string; note?: string; keys: NumKey[] }> = [
  { title: 'Volume', keys: ['tradeGallonFactor', 'trueGallonsPerCubicYard', 'mixShrinkPct'] },
  {
    title: 'Time',
    note: 'Setup is paid once per run; handling is paid per pot. That is why batch size changes the cost of a plan and crew size does not.',
    keys: ['setupMinutesPerRun', 'handlingMinutesPerPot', 'productiveHoursPerDay'],
  },
  {
    title: 'Crew',
    note: 'The plan is costed at the WINTER crew whenever the window runs past the day the seasonal staff leave — which at a November-to-February window is almost always.',
    keys: ['crewSizeInSeason', 'crewSizeWinter', 'mixerCubicYardsPerHour', 'peopleMakingMix'],
  },
  {
    title: 'Holding back',
    note: 'Months of cover defaults to the grow time, because cover exists to bridge the gap until the uppotted stock is ready. Leave the override blank to keep them tied.',
    keys: ['growMonthsDefault', 'cushionPctDefault', 'survivalRate', 'potRecoveryRate'],
  },
];

const LABELS: Partial<Record<NumKey, string>> = {
  tradeGallonFactor: 'Trade gallon → true gallons',
  trueGallonsPerCubicYard: 'True gallons in a cubic yard',
  mixShrinkPct: 'Mix shrink and spill (share)',
  setupMinutesPerRun: 'Minutes to set up a run',
  handlingMinutesPerPot: 'Minutes to handle one pot',
  productiveHoursPerDay: 'Productive hours a day',
  crewSizeInSeason: 'People uppotting, in season',
  crewSizeWinter: 'People uppotting, after the seasonal staff leave',
  mixerCubicYardsPerHour: 'Mixer output (yd³/hr)',
  peopleMakingMix: 'People making mix',
  growMonthsDefault: 'Months to sellable',
  cushionPctDefault: 'Cushion (share)',
  survivalRate: 'Survive the move (share)',
  potRecoveryRate: 'Pots recovered rather than binned (share)',
};

export default function OperationsSettings({ businessId, canWrite, canReadMoney }: Props) {
  const [ops, setOps] = useState<OperationsConfig>(OPERATIONS_DEFAULTS);
  const [mixCost, setMixCost] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void (async () => {
      const [o, m] = await Promise.all([
        supabase.from('business_operations_config').select('config').eq('business_id', businessId).maybeSingle(),
        supabase.from('business_pricing_config').select('config').eq('business_id', businessId).maybeSingle(),
      ]);
      setOps({ ...OPERATIONS_DEFAULTS, ...((o.data?.config ?? {}) as Partial<OperationsConfig>) });
      setMixCost(((m.data?.config as any)?.production?.blendedMixCostPerCubicYard ?? null) as number | null);
      console.log('[TRACE:UPPOT] operations settings loaded', { businessId, hasRow: !!o.data });
    })();
  }, [businessId]);

  const set = <K extends keyof OperationsConfig>(k: K, v: OperationsConfig[K]) => {
    setOps((p) => ({ ...p, [k]: v })); setDirty(true); setNotice(null);
  };

  const save = useCallback(async () => {
    setSaving(true);
    // 🔴 E5 / R-12 — a write that changed nothing must not report success. An upsert refused by
    // policy returns NO error, so the returned row is what is checked, never the absence of one.
    const { data, error } = await supabase
      .from('business_operations_config')
      .upsert({ business_id: businessId, config: ops as unknown as Record<string, unknown> }, { onConflict: 'business_id' })
      .select('business_id');
    setSaving(false);
    if (error || !data || data.length === 0) {
      console.log('[TRACE:UPPOT] operations settings write landed NOTHING', { businessId, code: (error as any)?.code });
      setNotice(error
        ? `Not saved — ${error.message}. Nothing changed.`
        : 'Not saved: the write returned no row, which usually means permission was refused. Nothing changed.');
      return;
    }
    setDirty(false);
    setNotice('Saved. Every plan built from now on uses these numbers; plans already committed keep the numbers they were built with.');
    console.log('[TRACE:UPPOT] operations settings saved', { businessId });
  }, [businessId, ops]);

  const checks = arithmeticCheck(resolveConfig(ops, { blendedMixCostPerCubicYard: mixCost }, true));

  return (
    <section style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>
      <h2 style={{ color: GREEN, marginTop: 0 }}>Operations</h2>
      <p style={{ color: '#444', lineHeight: 1.5, maxWidth: 760, marginTop: 0 }}>
        The numbers every uppot plan is built from. <strong>Changes save when you press Save</strong>,
        not as you type. Each one says how good a number it is — the guesses are the ones worth
        correcting first.
      </p>

      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 2 }}>{g.title}</h3>
          {g.note && <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px', lineHeight: 1.5, maxWidth: 760 }}>{g.note}</p>}
          {/* 🔴 THE DECOMPOSITION MADE LEGIBLE. Two numbers in two boxes do not show what they do
              together; this line does, and it is the whole of R-86 in one row. */}
          {g.title === 'Time' && (
            <p style={{ fontSize: 12, color: GREEN, margin: '0 0 10px', lineHeight: 1.6, maxWidth: 760 }}>
              At these numbers a pot costs{' '}
              {[10, 20, 60, 120].map((n, i) => (
                <span key={n}>
                  {i > 0 && ' · '}
                  <strong>{minutesPerPot(n, ops)?.toFixed(1)} min</strong> in runs of {n}
                </span>
              ))}
              . Batch size is the lever, not crew size.
            </p>
          )}
          {g.keys.map((k) => {
            const b = OPERATIONS_BASIS[k];
            const tone = b.basis === 'fact' ? GREEN : b.basis === 'guess' ? '#8a6d00' : '#4a4a4a';
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 0', flexWrap: 'wrap' }}>
                <label style={{ flex: '1 1 300px', fontSize: 14 }}>{LABELS[k] ?? k}</label>
                <input type="number" step="any" value={String(ops[k] ?? '')} disabled={!canWrite}
                  onChange={(e) => set(k, Number(e.target.value) as OperationsConfig[NumKey])}
                  style={{ width: 120, minHeight: 44, fontSize: 16, padding: '4px 8px' }} />
                <span style={{ flex: '1 1 260px', fontSize: 11, color: tone, lineHeight: 1.4 }}>
                  <strong style={{ textTransform: 'uppercase' }}>{b.basis}</strong> — {b.because}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── THE WINDOW ── */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>The uppotting window</h3>
        {([['windowStart', 'Window opens'], ['windowEnd', 'Window closes'], ['seasonalStaffLastDay', 'Last day the seasonal staff are here']] as const).map(([k, label]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '6px 0', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 300px', fontSize: 14 }}>{label}</label>
            <input type="date" value={ops[k] ?? ''} disabled={!canWrite}
              onChange={(e) => set(k, (e.target.value || null) as OperationsConfig['windowStart'])}
              style={{ minHeight: 44, fontSize: 16, padding: '4px 8px' }} />
          </div>
        ))}
      </div>

      {/* ── THE ONE MONEY VALUE THAT CROSSES THE WALL ── */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 2 }}>Mix cost</h3>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px', maxWidth: 760, lineHeight: 1.5 }}>
          Stored with the cost settings, shown here because a plan without it cannot cost anything.
          Labour rates and pot prices are not shown on this screen.
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 300px', fontSize: 14 }}>Blended mix, delivered ($/yd³)</label>
          <input type="number" step="any" value={mixCost ?? ''} disabled
            style={{ width: 120, minHeight: 44, fontSize: 16, padding: '4px 8px', background: '#f4f4f4' }} />
          <span style={{ flex: '1 1 260px', fontSize: 11, color: '#8a6d00', lineHeight: 1.4 }}>
            Edited on the cost settings, not here. {!canReadMoney && WITHHELD_REASON}
          </span>
        </div>
        {checks.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {checks.map((c) => (
              <div key={c.label} style={{ color: c.passes ? GREEN : '#A32D2D' }}>
                {c.passes ? '✓' : '✗'} {c.label}: ${c.actual.toFixed(2)} — you had ${c.expected.toFixed(2)}
                {c.difference !== 0 && ` (${c.difference > 0 ? '+' : ''}${c.difference.toFixed(2)})`}
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => { void save(); }} disabled={!canWrite || saving || !dirty}
        style={{
          minHeight: 48, padding: '0 24px', fontSize: 15, fontWeight: 700, borderRadius: 6, border: 'none',
          background: canWrite && dirty ? GREEN : '#d1d5db', color: '#fff',
          cursor: canWrite && dirty ? 'pointer' : 'not-allowed',
        }}>
        {saving ? 'Saving…' : dirty ? 'Save operations settings' : 'Nothing to save'}
      </button>
      {/* §6 r13 — locked WITH an explanation, never silently greyed. */}
      {!canWrite && (
        <p style={{ fontSize: 12, color: '#8a6d00', marginTop: 8, lineHeight: 1.5 }}>
          You can read these and you cannot change them. Editing business settings is a separate
          permission from reading them.
        </p>
      )}
      {notice && <p style={{ fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>{notice}</p>}
    </section>
  );
}
