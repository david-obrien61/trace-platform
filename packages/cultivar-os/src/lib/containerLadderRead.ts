// ============================================================
// containerLadderRead — read this tenant's container ladder (ledger #326).
//
// PURPOSE:      One read, one shape. The planning model takes the ladder as DATA
//               (`packages/shared/src/inventory/containerLadder.ts` is a pure zero-dep leaf and
//               must stay one), so something has to fetch it. This is that something and it does
//               nothing else.
//
// 🔴 A FAILED READ IS NOT AN EMPTY LADDER, AND THE DIFFERENCE DECIDES WHAT THE SCREEN SAYS.
//   `phase: 'failed'` means we do not know what rungs exist; `phase: 'loaded'` with zero rungs
//   means this tenant genuinely has not set one up. Collapsing them would let a dropped connection
//   render as "this nursery has no container sizes", which is the shape `loadPlanLots` already
//   refuses in its own header.
//
// ⚠️ NO LADDER IS A LEGAL STATE. A tenant with none plans exactly as it did before this build —
//   `classifyLot(lot, null)` falls through to the numeric behaviour. That is why `rungs` is
//   `Ladder | null` at the call site rather than defaulting to `[]`: an empty array would claim
//   "a ladder exists and it has no rungs", which is a different and wrong statement.
//
// DEPENDENCIES: ./supabaseClient · shared/inventory/containerLadder (types only).
// OUTPUTS:      LadderRead · loadContainerLadder. (The field list lives in ./containerLadderFields —
//               split out so a probe can assert it without a database handle; tech-debt #179's lesson.)
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================
import { supabase } from './supabase';
import { LADDER_SELECT } from './containerLadderFields';
import { type Ladder, type Rung, validateLadder, type LadderConflict } from '@trace/shared/inventory';

interface LadderRow {
  id: string; label: string; aliases: string[] | null; sort_order: number;
  volume_gallons: number | string | null; handling_minutes: number | string | null;
  handling_because: string | null; active: boolean;
}

export type LadderRead =
  | { phase: 'loaded'; rungs: Ladder; conflicts: LadderConflict[] }
  | { phase: 'failed'; message: string };

const nOrNull = (v: number | string | null): number | null =>
  v == null ? null : (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Read one tenant's ladder, newest-ordered by its own `sort_order`.
 *
 * 🔴 RETIRED RUNGS ARE READ, NOT FILTERED OUT. `active=false` is carried through so `resolveRung`
 * can still place a past lot on a rung nobody offers any more (R-133). Filtering here would make
 * the retirement a deletion for every reader — the exact collapse the ladder module's two separate
 * functions (`resolveRung` vs `rungsAbove`) exist to keep apart.
 */
export async function loadContainerLadder(businessId: string): Promise<LadderRead> {
  const { data, error } = await supabase
    .from('container_ladder')
    .select(LADDER_SELECT)
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .returns<LadderRow[]>();

  if (error) {
    console.log('[TRACE:LADDER] ladder read FAILED', { businessId, code: (error as { code?: string })?.code, message: error.message });
    return {
      phase: 'failed',
      message: `Could not read the container sizes — ${error.message}. This is a failed read, NOT an empty ladder: which sizes this nursery runs is unknown right now.`,
    };
  }

  const rungs: Rung[] = (data ?? []).map((r) => ({
    label: r.label,
    aliases: r.aliases ?? [],
    sortOrder: r.sort_order,
    volumeGallons: nOrNull(r.volume_gallons),
    handlingMinutes: nOrNull(r.handling_minutes),
    handlingBecause: r.handling_because ?? 'not timed',
    active: r.active,
  }));

  // 🔴 A COLLIDING LADDER IS SURFACED AT READ TIME, NEVER SILENTLY FIRST-WINS. Two rungs claiming
  // one number makes which rung a lot lands on an accident of row order (R-96's shape).
  const conflicts = validateLadder(rungs);
  console.log('[TRACE:LADDER] ladder read', {
    businessId, rungs: rungs.length,
    offered: rungs.filter((r) => r.active).length,
    retired: rungs.filter((r) => !r.active).length,
    conflicts: conflicts.length,
  });
  if (conflicts.length) console.log('[TRACE:LADDER] ladder CONFLICTS', conflicts);

  return { phase: 'loaded', rungs, conflicts };
}
