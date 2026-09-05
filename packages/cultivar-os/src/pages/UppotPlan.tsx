// ============================================================
// UppotPlan — where the production manager decides how much of each variety moves up a size.
//
// PURPOSE:      The four-way split, his number, and what it costs in mix, pots, hours and days.
//               This is stage ① — it READS the catalogue and WRITES NOTHING. Committing the plan
//               (stage ②) is the one button that writes, and it is the E7 moment.
//
// 🔴 THE CELL STAYS A CELL, AND DAVID RULED THE REASONING SO IT IS NOT RE-LITIGATED (E7 / R-83).
//   E7 says *"A CONTROL THAT CHANGES ONE RECORD LIVES WHERE THAT RECORD IS OPENED, NOT ON THE
//   ROW"* — and it says in the same clause that *"a cell edited in a list of many stays a cell."*
//   David's ruling names which side this falls: **the record being decided is THE PLAN, not the
//   lot.** Ten to fourteen cells are inputs to ONE decision, compared against each other while
//   scanning, and E2's own worked example is the precedent — *"a Save button per row would be
//   absurd."* COMMITTING the plan is the E7 moment, and that is where the reason lives: one
//   reason for the batch, not fourteen. That commit also carries the audit row.
//
// 🔴 EVERY NUMBER SHOWS ITS BASIS, IN THE SAME BREATH (R-89). David: *"they had a feeling, we have
//   facts"* — followed by the correction that makes it safe: most of these are NOT facts. A
//   suggested number rendered like a measured one is what destroys trust, and the first one Terry
//   catches discredits the rest. So `<Number>` below renders the basis line beneath every figure
//   and there is no way to render one without it.
//
// 🔴 THREE READ STATES, NOT TWO (ui-control-standards §6/R1). Measured live at LAWNS 2026-09-05:
//   447 rows, **2 with a real count and each holding ONE TREE**, 445 never counted. So the empty
//   screen is the NORMAL case here and a failed read that looked the same would be invisible
//   forever. `loadPlanLots` returns a discriminated union and this component renders all three
//   arms — a 445-row screen of zeros is the exact defect that clause names.
//
// UI STANDARD (§6 r16 — name it, then decide): the established pattern for "many rows, one
//   editable numeric cell, live totals" is the spreadsheet — and we adopt it, because the manager
//   IS comparing rows against each other and a form-per-row would break exactly the comparison the
//   screen exists for. Where we diverge: the totals are not a footer row but a sticky panel, since
//   the pot cascade and the window check are not column sums and rendering them as one would
//   imply an arithmetic relationship to the columns above that does not exist.
//
// DEPENDENCIES: @trace/shared/production (the whole model) · ../lib/uppotPlanRead (the one read) ·
//               ../lib/uppotPlanWrite (the one write) · useBusinessContext.
// OUTPUTS:      the /inventory/uppot route.
// PERMISSIONS:  `inventory:read` to reach it (route-gated), `inventory:create` to commit. NO NEW
//               PERMISSION STRING — measured live at LAWNS, MANAGER holds read/create/update and
//               STAFF holds read ALONE, so staff may look and may not hold stock. The Commit
//               button is disabled-with-a-reason for staff rather than hidden (§6 r13).
// AC-1:         the WORD "uppot" lives here, in a cultivar-os surface, and nowhere in shared. The
//               precedent is `responsibilityCatalogue.ts`, where "Uppot or graduate a lot" is a
//               `text` VALUE on a row whose `vertical` FIELD carries the identity.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBusinessContext } from '@trace/shared/context';
import {
  planLots, arithmeticCheck, basisSentence, splitPenalty, minutesPerPot,
  WITHHELD_REASON,
  type LotInput, type ResolvedConfig, type Estimate,
} from '@trace/shared/production';
import { loadPlanLots, type PlanLotsRead } from '../lib/uppotPlanRead';
import { loadOperationsConfig, commitPlan, type CommitOutcome } from '../lib/uppotPlanWrite';

const GREEN = '#27500A';
const SAGE = '#EAF3DE';

const money = (n: number | null) => (n == null ? '—' : `$${n.toFixed(2)}`);
const n0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** A number and, beneath it, how we arrived at it. There is no way to render one without the other. */
function Figure({ label, value, estimate }: { label: string; value: string; estimate?: Estimate<unknown> }) {
  const tone = estimate?.basis === 'fact' ? GREEN : estimate?.basis === 'guess' ? '#8a6d00' : '#4a4a4a';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#555', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#111' }}>{value}</div>
      {estimate && (
        <div style={{ fontSize: 12, color: tone, marginTop: 2, lineHeight: 1.35 }}>
          <strong style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>{estimate.basis}</strong>
          {' — '}{basisSentence(estimate)}
        </div>
      )}
    </div>
  );
}

export default function UppotPlan() {
  const { businessId, can } = useBusinessContext();
  const [read, setRead] = useState<PlanLotsRead>({ phase: 'loading' });
  const [cfg, setCfg] = useState<ResolvedConfig | null>(null);
  const [typed, setTyped] = useState<Record<string, number | null>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [batchSize, setBatchSize] = useState(40);
  const [reason, setReason] = useState('');
  const [committing, setCommitting] = useState(false);
  const [outcome, setOutcome] = useState<CommitOutcome | null>(null);

  const canReadMoney = can('pricing_recipe:read');
  const canCommit = can('inventory:create');

  useEffect(() => {
    if (!businessId) return;
    let live = true;
    void (async () => {
      const [lots, opsCfg] = await Promise.all([
        loadPlanLots(businessId),
        loadOperationsConfig(businessId, canReadMoney),
      ]);
      if (!live) return;
      setRead(lots);
      setCfg(opsCfg);
    })();
    return () => { live = false; };
  }, [businessId, canReadMoney]);

  // Wrapped rather than computed inline: a fresh [] on every render would make the plan below
  // recompute on every keystroke of an unrelated field, and the plan is the expensive part.
  const lots: LotInput[] = useMemo(
    () => (read.phase === 'loaded' ? read.lots : []),
    [read],
  );

  // The plan recomputes on every keystroke. It writes nothing, so this is free and it is the
  // point — the manager types 50 instead of 144 and watches the hours, the pots and the window
  // move together. A "Recalculate" button here would break the comparison the screen is for.
  const plan = useMemo(() => {
    if (!cfg) return null;
    return planLots(lots, cfg, {
      managerNumbers: typed, targets, batchSize,
      startDate: cfg.ops.windowStart,
    });
  }, [lots, cfg, typed, targets, batchSize]);

  const checks = cfg ? arithmeticCheck(cfg) : [];

  const onCommit = useCallback(async () => {
    if (!businessId || !plan || !cfg) return;
    setCommitting(true);
    const res = await commitPlan(businessId, plan.batches, {
      batchSize, reason,
      windowStart: cfg.ops.windowStart, windowEnd: cfg.ops.windowEnd,
    });
    setOutcome(res);
    setCommitting(false);
    if (res.ok) setRead(await loadPlanLots(businessId));
  }, [businessId, plan, cfg, batchSize, reason]);

  // ── THE THREE READ STATES ────────────────────────────────────────────────────────
  if (read.phase === 'loading') {
    return <div style={{ padding: 24 }}>Reading the catalogue…</div>;
  }
  if (read.phase === 'failed') {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ color: GREEN }}>Uppot plan</h1>
        <div style={{ padding: 16, border: '1px solid #A32D2D', background: '#fff4f4', borderRadius: 8, maxWidth: 720 }}>
          <strong style={{ color: '#A32D2D' }}>Could not read the catalogue.</strong>
          <p style={{ margin: '8px 0 0', lineHeight: 1.5 }}>{read.message}</p>
        </div>
      </div>
    );
  }

  const planned = plan?.batches ?? [];
  const totals = plan?.totals;

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <h1 style={{ color: GREEN, marginBottom: 4 }}>Uppot plan</h1>
      <p style={{ color: '#444', marginTop: 0, lineHeight: 1.5, maxWidth: 860 }}>
        How much of each variety moves up a container size. Nothing here is saved until you commit
        the plan — type a number and watch the mix, the pots, the hours and the window move.
      </p>

      {/* ── POPULATION, ALWAYS. Every count on this screen names what it counted. ── */}
      <div style={{ background: SAGE, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
        <strong>{n0(read.totalRows)} lots in the catalogue.</strong>{' '}
        {read.neverCounted > 0 && (
          <span>
            <strong style={{ color: '#8a6d00' }}>{n0(read.neverCounted)} have never been counted</strong> —
            that is not a count of zero, and a lot with no count cannot be planned. Walk them with the
            count screen first.{' '}
          </span>
        )}
        {read.retiredHidden > 0 && <span>{n0(read.retiredHidden)} retired lots are hidden. </span>}
        {plan && <span>{n0(plan.refused.length)} cannot be planned for other reasons — listed below.</span>}
      </div>

      {/* ── THE ARITHMETIC SELF-CHECK — David's must-build ── */}
      {checks.length > 0 && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: `1px solid ${checks.every((c) => c.passes) ? '#cfe0bd' : '#A32D2D'}`, background: checks.every((c) => c.passes) ? '#f6faf1' : '#fff4f4' }}>
          <strong style={{ fontSize: 13 }}>Does the arithmetic still match your own figures?</strong>
          {checks.map((c) => (
            <div key={c.label} style={{ fontSize: 13, marginTop: 4 }}>
              {c.passes ? '✓' : '✗'} {c.label}: <strong>{money(c.actual)}</strong> — you had {money(c.expected)}
              {c.difference !== 0 && <span style={{ color: '#8a6d00' }}> ({c.difference > 0 ? '+' : ''}{c.difference.toFixed(2)})</span>}
            </div>
          ))}
        </div>
      )}
      {checks.length === 0 && (
        <div style={{ marginBottom: 16, fontSize: 13, color: '#8a6d00' }}>
          The arithmetic check needs the mix cost per yard, which is not set in Settings → Operations yet.
        </div>
      )}

      {/* ── THE BATCH-SIZE LEVER ── */}
      <div style={{ marginBottom: 16, padding: 12, background: '#fff', border: '1px solid #ddd', borderRadius: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Pots per run{' '}
          <input type="number" min={1} value={batchSize}
            onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 90, minHeight: 44, fontSize: 16, padding: '4px 8px', marginLeft: 8 }} />
        </label>
        <div style={{ fontSize: 13, color: '#444', marginTop: 6, lineHeight: 1.5 }}>
          {cfg && (
            <>At {batchSize} pots a run that is <strong>{minutesPerPot(batchSize, cfg.ops)?.toFixed(1)} minutes a pot</strong> —
            {' '}{cfg.ops.setupMinutesPerRun} minutes to set the run up, then {cfg.ops.handlingMinutesPerPot} a pot.
            {' '}Splitting a run in two costs another {splitPenalty(2, cfg.ops).extraMinutes} minutes, whatever its size.</>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── THE GRID ── */}
        <div style={{ flex: '1 1 720px', minWidth: 340, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, background: '#fff' }}>
            <thead>
              <tr style={{ background: SAGE, textAlign: 'left' }}>
                {['Variety', 'In now', 'Going to', 'On hand', 'Keep', 'Cushion', 'Could pot', 'UPPOT NOW', 'Still sellable', 'Mix yd³', 'Hours'].map((h) => (
                  <th key={h} style={{ padding: '8px 6px', borderBottom: '2px solid #cfe0bd', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => {
                const batch = planned.find((b) => b.lotId === lot.id);
                const refusal = plan?.refused.find((r) => r.lot.id === lot.id);
                if (refusal) return null;
                return (
                  <tr key={lot.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px', fontWeight: 600 }}>{lot.name}<div style={{ fontSize: 11, color: '#888' }}>{lot.size}</div></td>
                    <td style={{ padding: '6px' }}>{lot.unitValue}</td>
                    <td style={{ padding: '6px' }}>
                      <input type="number" value={targets[lot.id] ?? ''} placeholder="—"
                        onChange={(e) => setTargets((t) => ({ ...t, [lot.id]: Number(e.target.value) }))}
                        style={{ width: 68, minHeight: 44, fontSize: 15 }} />
                    </td>
                    <td style={{ padding: '6px' }}>{lot.qty == null ? <em style={{ color: '#8a6d00' }}>never counted</em> : n0(lot.qty)}</td>
                    <td style={{ padding: '6px' }}>{batch ? n0(batch.split.mustKeepSellable) : '—'}</td>
                    <td style={{ padding: '6px' }}>{batch ? n0(batch.split.cushion) : '—'}</td>
                    <td style={{ padding: '6px' }}>{batch ? n0(batch.split.delta) : '—'}</td>
                    {/* THE ONE EDITABLE CELL. Commits on change, no per-row Save — E2's model. */}
                    <td style={{ padding: '6px', background: '#fdf6e3' }}>
                      <input type="number" min={0} value={typed[lot.id] ?? (batch ? batch.split.uppotNow : '')}
                        onChange={(e) => setTyped((t) => ({ ...t, [lot.id]: e.target.value === '' ? null : Number(e.target.value) }))}
                        style={{ width: 80, minHeight: 44, fontSize: 16, fontWeight: 700 }} />
                      {batch?.split.clamped && (
                        <div style={{ fontSize: 11, color: '#A32D2D' }}>capped at {n0(batch.split.delta)}</div>
                      )}
                    </td>
                    <td style={{ padding: '6px' }}>{batch ? n0(batch.split.stillSellable) : '—'}</td>
                    <td style={{ padding: '6px' }}>{batch ? batch.mixTotal.toFixed(2) : '—'}</td>
                    <td style={{ padding: '6px' }}>{batch ? batch.crewHoursAtBatch.toFixed(1) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── WHAT CANNOT BE PLANNED, AND WHY. Never silently dropped. ── */}
          {plan && plan.refused.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, color: '#8a6d00' }}>{n0(plan.refused.length)} lots cannot be planned</h3>
              <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 20 }}>
                {plan.refused.slice(0, 40).map(({ lot, refusal }) => (
                  <li key={lot.id}><strong>{lot.name}</strong> — {!refusal.ok && refusal.detail}</li>
                ))}
              </ul>
              {plan.refused.length > 40 && <p style={{ fontSize: 12, color: '#666' }}>…and {n0(plan.refused.length - 40)} more of the same kinds.</p>}
            </div>
          )}
        </div>

        {/* ── THE TOTALS PANEL ── */}
        <div style={{ flex: '0 1 340px', minWidth: 300, background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
          <h2 style={{ fontSize: 16, marginTop: 0, color: GREEN }}>What this plan costs</h2>
          {!totals || totals.pots === 0 ? (
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
              Nothing is planned yet. Set a target size on a row that has a count.
            </p>
          ) : (
            <>
              <Figure label="Pots to move" value={n0(totals.pots)} />
              <Figure label="Mix needed" value={`${totals.mixCubicYards.toFixed(2)} yd³`} />
              <Figure label="Mix cost" value={totals.mixCost ? money(totals.mixCost.value) : '—'} estimate={totals.mixCost ?? undefined} />
              <Figure label="Crew hours" value={totals.crewHours.value.toFixed(1)} estimate={totals.crewHours} />
              <Figure label="Working days" value={n0(Math.ceil(totals.workingDays.value))} estimate={totals.workingDays} />
              <div style={{ fontSize: 12, color: '#444', marginBottom: 12 }}>{totals.crewReason}</div>

              {totals.overrunsWindow && (
                <div style={{ padding: 10, border: '1px solid #A32D2D', background: '#fff4f4', borderRadius: 6, marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
                  <strong style={{ color: '#A32D2D' }}>This plan runs past your window.</strong> The last batch
                  finishes {totals.lastCompletion} and the window closes {cfg?.ops.windowEnd}. Cut the numbers,
                  add people, or move the end date.
                </div>
              )}

              {/* ── THE POT CASCADE ── */}
              <h3 style={{ fontSize: 14, marginBottom: 4 }}>Pots</h3>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 8px' }}>
                Working <strong>down the ladder</strong> — biggest size first — you buy{' '}
                <strong>{n0(totals.cascade.totalBuyDownTheLadder)}</strong> pots.
                {totals.cascade.potsSavedBySequence > 0 && (
                  <> Doing it the other way round you would buy {n0(totals.cascade.totalBuyWorstOrder)} —{' '}
                    <strong>{n0(totals.cascade.potsSavedBySequence)} pots saved by sequence alone</strong>,
                    same work, same trees, same window.</>
                )}
              </p>
              <table style={{ fontSize: 12, width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left' }}><th>Size</th><th>Need</th><th>Freed</th><th>Reuse</th><th>Buy</th></tr></thead>
                <tbody>
                  {totals.cascade.rungs.map((r) => (
                    <tr key={r.unitValue}>
                      <td>{r.unitValue} gal</td><td>{n0(r.needed)}</td><td>{n0(r.freed)}</td>
                      <td>{n0(r.reusable)}</td><td><strong>{n0(r.buy)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!canReadMoney && (
                <p style={{ fontSize: 12, color: '#8a6d00', marginTop: 12, lineHeight: 1.5 }}>{WITHHELD_REASON}</p>
              )}

              {/* ── THE COMMIT — the E7 moment, and the one write on this screen ── */}
              <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Why this plan? <span style={{ fontWeight: 400, color: '#666' }}>(one reason for the whole plan)</span>
                </label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                  style={{ width: '100%', fontSize: 14, padding: 6 }} />
                <button type="button" onClick={() => { void onCommit(); }} disabled={!canCommit || committing || totals.pots === 0}
                  style={{
                    marginTop: 8, width: '100%', minHeight: 48, fontSize: 15, fontWeight: 700,
                    background: canCommit && totals.pots > 0 ? GREEN : '#d1d5db',
                    color: '#fff', border: 'none', borderRadius: 6,
                    cursor: canCommit && totals.pots > 0 ? 'pointer' : 'not-allowed',
                  }}>
                  {committing ? 'Holding the stock…' : `Commit the plan — hold ${n0(totals.pots)} trees`}
                </button>
                {/* §6 r13 — locked WITH an explanation, never a silently dead button. */}
                {!canCommit && (
                  <p style={{ fontSize: 12, color: '#8a6d00', marginTop: 6, lineHeight: 1.5 }}>
                    You can look at this plan and you cannot commit it. Holding stock takes it off the
                    market, so it needs permission to add to inventory.
                  </p>
                )}
                {outcome && (
                  <p style={{ fontSize: 13, marginTop: 8, color: outcome.ok ? GREEN : '#A32D2D', lineHeight: 1.5 }}>
                    {outcome.message}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
