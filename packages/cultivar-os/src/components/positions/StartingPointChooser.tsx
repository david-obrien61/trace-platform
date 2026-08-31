/**
 * StartingPointChooser — NEVER START FROM NOTHING (rendered on /admin/positions/:id).
 *
 * PURPOSE:      The six starting points plus "start blank", each showing how many rows it ticks
 *               FOR THIS BUSINESS. Picking one pre-ticks its set and drops the owner into the
 *               list to adjust; every tick and untick from there is theirs.
 * DEPENDENCIES: positionStartingPoints (the sets, the resolver, and the render guard) ·
 *               responsibilityCatalogue (the rows this business can see, passed in). No fetch,
 *               no context, no router — everything it needs arrives as props.
 * OUTPUTS:      `onPick(startingPoint)`. It decides nothing and writes nothing.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IT IS ITS OWN FILE BECAUSE THE INLINE VERSION COULD NOT BE ASSERTED, AND THAT IS WHY IT
 *    SHIPPED BROKEN-SHAPED.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * #241 shipped 25 assertions about starting points. **Not one of them put the chooser on a
 * screen.** They all tested `startingPointIds` — the SETS — and the sets were never the risk:
 * the risk was the twenty lines of JSX between a correct set and an owner's eyes, and those lines
 * lived inside a page component that reads context, calls Supabase and needs a router. Nothing in
 * this repo can render that in a test, so nothing did.
 *
 * A component with **no context, no fetch and no router** can be rendered to HTML by
 * `react-dom/server` inside the repo's own esbuild runner, with no new dependency — which is
 * exactly what `startingPointChooser.test.ts` now does. **The extraction IS the testability.**
 * ⚠️ So do not fold this back into the page for tidiness: the seam is the assertion.
 *
 * 🔴 THE COUNT ON EACH BUTTON IS `.length` OF THE RESOLVED SET, NEVER A TYPED NUMBER. An owner
 * choosing between starting points is deciding how much reading to commit to, and a count that
 * drifted from the set it labels would be worse than no count (STD-011).
 */
import type { Responsibility } from '@trace/shared/positions/responsibilityCatalogue';
import {
  POSITION_STARTING_POINTS, startingPointIds, type PositionStartingPoint,
} from '@trace/shared/positions/positionStartingPoints';

interface StartingPointChooserProps {
  /** The rows this business can SEE — already vertical-filtered by the page. */
  visible: readonly Responsibility[];
  onPick: (sp: PositionStartingPoint) => void;
}

export function StartingPointChooser({ visible, onPick }: StartingPointChooserProps) {
  return (
    <div data-testid="starting-point-chooser"
      style={{
        background: '#f7faf3', border: '1px solid #dbe8cd', borderRadius: 10,
        padding: 16, marginBottom: 12,
      }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px', color: '#111827' }}>
        Start from a set
      </h2>
      <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: '0 0 14px' }}>
        Pick the job this is closest to and we will tick a starting set. Then change whatever is
        wrong — every tick and untick from there is yours.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {POSITION_STARTING_POINTS.map((sp) => {
          const n = startingPointIds(sp, visible).length;
          return (
            <button key={sp.key} type="button" data-key={sp.key} onClick={() => onPick(sp)}
              style={{
                display: 'flex', width: '100%', minHeight: 48, alignItems: 'center', gap: 12,
                padding: '12px 14px', background: '#fff', cursor: 'pointer',
                border: '1px solid #dbe8cd', borderRadius: 8, textAlign: 'left',
              }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
                  {sp.label}
                  {sp.kind !== 'blank' && (
                    <span style={{ fontWeight: 500, color: '#4b5563' }}>{`, ${n} to start`}</span>
                  )}
                </span>
                <span style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280' }}>{sp.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '12px 0 0' }}>
        A starting point is a suggestion, not a rule, and it is not saved until you press Save. It
        creates no role and gives nobody access to anything.
      </p>
    </div>
  );
}
