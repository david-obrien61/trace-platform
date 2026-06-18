/**
 * ── PROJECT COST DRILL-IN (Cultivar OS) · THUNDER D-14 Phase 1 · 2026-06-18 ──────
 *
 * PURPOSE
 *   The per-project cost-to-produce drill-in (D-14 Phase 1, COST-ONLY). Select one project
 *   group in the By-project tree → see ITS cost in isolation: the monthly pool + one-time
 *   capital, the monthly pool broken down by category (Labor / Other recurring), capital
 *   shown separately, and the confidence mix for THIS project's rows. It is the company
 *   "What we know — honestly" view scoped to one project — same honest data, one cut.
 *
 *   ZERO SCHEMA, ZERO RECOMPUTE OF THE TOTALS. The two headline figures are taken VERBATIM
 *   from the group's existing rollup (group.rollup.poolKnownMonthly / .capexKnown) — the
 *   SAME NodeRollup the tree already shows — so the number CANNOT change between tree and
 *   drill-in (the reconciliation contract). The category split is a pure view-layer group-by
 *   over the project's child cost rows, normalized through the SAME shared fromCostObject the
 *   rollup uses, with "Other recurring" derived as the remainder (pool − labor) so the parts
 *   ALWAYS sum to the authoritative pool total.
 *
 *   NO pricing / margin / N / sensitivity here (D-14: cost truth ≠ price strategy). Phase 2
 *   adds the pricing layer (settable N + margin + cross-branch carve-out). Per Surface
 *   Honesty there is NO dead pricing panel — it is OMITTED, not stubbed.
 *
 * DEPENDENCIES
 *   - @trace/shared/business-logic fromCostObject (per-row monthly/capex normalization —
 *     the SAME adapter the rollup feeds, so the split reconciles to the rollup totals)
 *   - @trace/shared/business-logic ProjectGroup / ProjectLensRow (the group + its child rows)
 *
 * OUTPUTS
 *   - Read-only modal. No DB writes. Reads group.rollup (authoritative totals) + group.children
 *     (cost_category carried at runtime) and renders the scoped cost picture.
 *
 * INSTRUMENTATION (STD-003): emits `[TRACE:PROJECTLENS] drill-in open` with projectId, the two
 *   headline figures, the category split, and the confidence mix. ON BY DEFAULT until David
 *   owner-proves it through the UI under RLS; comment out then — do not delete. A reconciliation
 *   flag (🟡 [TRACE:PROJECTLENS] reconcile-drift) fires if the confidence mix sum diverges from
 *   the authoritative pool (a possible seam-merged duplicate) — surfaced, never silently hidden.
 */
import { useEffect } from 'react';
import { X, Calculator, AlertTriangle } from 'lucide-react';
import { fromCostObject } from '@trace/shared/business-logic';
import type { ProjectGroup, ProjectLensRow } from '@trace/shared/business-logic';

const GREEN = '#27500A';
const GRAY = '#6b7280';
const DARK = '#111827';
const AMBER = '#b45309';

/** A lens child row carrying cost_category (real column, fetched by the tree; not on the base type). */
export type DrillChild = ProjectLensRow & { cost_category?: string | null };

/** Existing money standard: Intl USD, right-aligned at the call site. */
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (n: number) => usd.format(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

const isLaborCat = (c?: string | null) => c === 'labor' || c === 'contract-labor';
const FLOOR_GRADES = new Set(['CONFIRMED', 'DERIVED']);

interface DrillSummary {
  poolKnownMonthly: number;     // authoritative — from group.rollup
  capexKnown: number;           // authoritative — from group.rollup
  laborMonthly: number;         // labor/contract-labor rows, monthly (count-once normalized)
  otherRecurringMonthly: number;// remainder: poolKnownMonthly − laborMonthly (always reconciles)
  floorMonthly: number;         // CONFIRMED+DERIVED monthly pool (of which)
  estimatedMonthly: number;     // ESTIMATED monthly pool (of which)
  unknownLabels: string[];      // rows with no amount — surfaced, never $0
  reconcileDrift: number;       // |floor+estimated − pool|, >0.02 ⇒ likely seam-merged dup
}

/**
 * Pure: derive the scoped cost picture from the group's authoritative rollup + its child rows.
 * Headline totals come straight from the rollup (reconciliation guarantee); only the breakdown
 * is computed here, via the SAME fromCostObject normalization the rollup itself uses.
 */
export function summarizeGroup(group: ProjectGroup, children: DrillChild[]): DrillSummary {
  const poolKnownMonthly = round2(group.rollup.poolKnownMonthly);
  const capexKnown = round2(group.rollup.capexKnown);

  let laborMonthly = 0;
  let floorMonthly = 0;
  let estimatedMonthly = 0;
  const unknownLabels: string[] = [];

  for (const c of children) {
    for (const e of fromCostObject(c)) {
      if (e.amount == null) { unknownLabels.push(c.label); continue; }
      if (e.bucket === 'MONTHLY_POOL') {
        if (isLaborCat(c.cost_category)) laborMonthly += e.amount;
        if (FLOOR_GRADES.has(e.amountConfidence)) floorMonthly += e.amount;
        else if (e.amountConfidence === 'ESTIMATED') estimatedMonthly += e.amount;
      }
      // CAPEX is reflected wholesale by capexKnown (authoritative) — no per-row capital sum needed.
    }
  }

  laborMonthly = round2(laborMonthly);
  // Derive "other recurring" as the remainder so labor + other == pool to the penny (reconciles).
  const otherRecurringMonthly = round2(poolKnownMonthly - laborMonthly);
  const reconcileDrift = round2(Math.abs(round2(floorMonthly + estimatedMonthly) - poolKnownMonthly));

  return {
    poolKnownMonthly, capexKnown, laborMonthly, otherRecurringMonthly,
    floorMonthly: round2(floorMonthly), estimatedMonthly: round2(estimatedMonthly),
    unknownLabels, reconcileDrift,
  };
}

export function ProjectCostDrillIn({
  group, businessName, onClose,
}: {
  group: ProjectGroup;
  businessName?: string;
  onClose: () => void;
}) {
  const children = group.children as DrillChild[]; // runtime carries cost_category (tree fetched it)
  const s = summarizeGroup(group, children);

  useEffect(() => {
    // [TRACE:PROJECTLENS] (STD-003, on by default until OWNER-PROVEN).
    console.log('[TRACE:PROJECTLENS] drill-in open', {
      projectId: group.id,
      label: group.label,
      poolKnownMonthly: s.poolKnownMonthly,
      capexKnown: s.capexKnown,
      categorySplit: { labor: s.laborMonthly, otherRecurring: s.otherRecurringMonthly, capital: s.capexKnown },
      confidenceMix: { floorMonthly: s.floorMonthly, estimatedMonthly: s.estimatedMonthly, unknownCount: s.unknownLabels.length },
      childRows: children.length,
    });
    if (s.reconcileDrift > 0.02) {
      // 🟡 Honest Debt: confidence-mix sum diverges from the authoritative pool — likely a
      // seam-merged duplicate within this project. Surfaced, not hidden. (grep: reconcile-drift)
      console.warn('[TRACE:PROJECTLENS] reconcile-drift', { projectId: group.id, drift: s.reconcileDrift, poolKnownMonthly: s.poolKnownMonthly });
    }
  }, [group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMonthly = s.poolKnownMonthly > 0;
  const hasCapital = s.capexKnown > 0;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}>
          <div>
            {businessName && <p style={S.tenant}>{businessName}</p>}
            <p style={S.title}><Calculator size={16} color={GREEN} /> {group.label} — cost to produce</p>
          </div>
          <button style={S.close} onClick={onClose} title="Close"><X size={18} color={GRAY} /></button>
        </div>

        {/* Two headline figures — VERBATIM from the rollup the tree shows (reconciliation contract). */}
        <div style={S.figRow}>
          <Figure label="Monthly pool" value={money(s.poolKnownMonthly)} accent />
          <Figure label="One-time capital" value={money(s.capexKnown)} />
        </div>

        {/* Monthly pool broken down by category (view-layer group-by; sums to the pool above). */}
        <Section title="Monthly pool — by category">
          {hasMonthly ? (
            <>
              <LineRow label="Labor" value={money(s.laborMonthly)} />
              <LineRow label="Other recurring" value={money(s.otherRecurringMonthly)} />
              <LineRow label="Monthly pool (total)" value={money(s.poolKnownMonthly)} strong />
            </>
          ) : (
            <p style={S.muted}>No recurring monthly cost assigned to this project yet.</p>
          )}
        </Section>

        {/* Capital is one-time — shown separately; never divides into the monthly pool. */}
        <Section title="Capital (one-time)">
          {hasCapital ? (
            <LineRow label="Captured capital" value={money(s.capexKnown)} strong />
          ) : (
            <p style={S.muted}>No one-time capital assigned to this project yet.</p>
          )}
          <p style={S.note}>One-time capital is shown separately and never divides into the monthly cost.</p>
        </Section>

        {/* Confidence mix for THIS project — mirrors the company "What we know — honestly" card. */}
        <Section title="What we know — honestly">
          <LineRow label="Confirmed + derived (floor)" value={`${money(s.floorMonthly)}/mo`} strong />
          {s.estimatedMonthly > 0 && <LineRow label="Estimated (soft)" value={`+ ${money(s.estimatedMonthly)}/mo`} />}
          {s.unknownLabels.length > 0 && (
            <div style={S.unknownBlock}>
              <span style={S.unknownHead}>
                <AlertTriangle size={13} /> {s.unknownLabels.length} unquantified cost{s.unknownLabels.length === 1 ? '' : 's'} — this project's real cost is higher
              </span>
              <span style={S.unknownBody}>{s.unknownLabels.join(' · ')}</span>
              <span style={S.unknownFoot}>Shown as unknown, never counted as $0.</span>
            </div>
          )}
        </Section>

        <p style={S.footNote}>
          This is {group.label}'s cost in isolation. Pricing — fair-share platform cost, margin, and per-customer
          spread — comes next (D-14 Phase 2); it is intentionally not shown here.
        </p>
      </div>
    </div>
  );
}

// ── presentational helpers ──
function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={S.fig}>
      <p style={S.figLabel}>{label}</p>
      <p style={{ ...S.figValue, color: accent ? GREEN : DARK }}>{value}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <p style={S.sectionTitle}>{title}</p>
      {children}
    </div>
  );
}
function LineRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={S.lineRow}>
      <span style={{ fontSize: '0.875rem', color: strong ? DARK : GRAY, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: '0.9375rem', color: strong ? GREEN : DARK, fontWeight: strong ? 800 : 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 },
  card: { background: '#fff', borderRadius: 14, padding: '18px 16px', border: '1px solid #e5e7eb', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  tenant: { fontSize: '0.625rem', color: GRAY, margin: 0, letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' },
  title: { fontSize: '1.0625rem', fontWeight: 800, color: DARK, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 7 },
  close: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
  figRow: { display: 'flex', gap: 10, marginBottom: 6 },
  fig: { flex: 1, background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 12, padding: '12px 14px' },
  figLabel: { fontSize: '0.625rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 },
  figValue: { fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0', textAlign: 'right' },
  section: { borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 12 },
  sectionTitle: { fontSize: '0.6875rem', fontWeight: 700, color: GRAY, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' },
  lineRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' },
  muted: { color: GRAY, fontSize: '0.8125rem', margin: 0 },
  note: { fontSize: '0.6875rem', color: GRAY, lineHeight: 1.5, margin: '8px 0 0' },
  footNote: { fontSize: '0.6875rem', color: GRAY, lineHeight: 1.5, margin: '16px 0 0', fontStyle: 'italic' },
  unknownBlock: { display: 'flex', flexDirection: 'column', gap: 4, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 12px', marginTop: 10 },
  unknownHead: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 700, color: AMBER },
  unknownBody: { fontSize: '0.75rem', color: '#9a6a2c', lineHeight: 1.6 },
  unknownFoot: { fontSize: '0.6875rem', color: '#9a6a2c' },
};
