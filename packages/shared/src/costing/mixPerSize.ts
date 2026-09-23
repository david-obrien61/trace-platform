// ============================================================
// mixPerSize — WHAT THE PLANTING MIX COSTS AT EVERY CONTAINER SIZE (ledger #370)
//
// PURPOSE:      For each rung on the tenant's container ladder: how many gallons of mix a tree of
//               that size takes at install, and what that mix costs. David, 2026-09-22, ruling ⑥:
//               *"Per-size mix cost NOT stored: for each container_ladder rung, rung volume ×
//               installMixContainerVolumesPerTree × cost per gallon; a new rung appears
//               automatically."*
//
// 🔴 NOTHING HERE IS STORED, AND THAT IS THE WHOLE DESIGN. A per-size cost table would be a fourth
//   place a size lives ([[R-157]]: *"If Terry starts running 7 gallon it must appear EVERYWHERE
//   immediately"*), and it would go stale the moment a receipt is corrected. The ladder supplies
//   the sizes, Operations supplies the ratio, the recipe supplies the cost per gallon, and this
//   multiplies them. **A rung added in Settings appears here on the next render with no migration,
//   no backfill and nobody remembering to update a list.**
//
// 🔴 THIS IS [[R-155]]'s OUTSTANDING HALF. Its own status cell reads: *"2.0 IS IMPLEMENTED FOR
//   LOADING AND LIVE; NO MODEL APPLIES IT TO COST YET, AND NONE EVER HAS."* The load list has
//   multiplied rung volume by the ratio since ledger #343 — to decide what goes on the trailer.
//   Nothing had ever multiplied it by a PRICE. This does, and it reads the same two inputs the
//   load list reads, so the yard sheet and the cost report cannot disagree about how much mix a
//   30 gallon tree takes.
//
// ⚠️ A RUNG WITH NO VOLUME PRINTS AS UNKNOWN, NEVER AS ZERO. `volumeGallons` is nullable and a
//   rung nobody has measured is a real state; costing it at $0.00 would say a 95 gallon oak takes
//   no mix. It is named instead, the way the load list names an unresolved line.
//
// DEPENDENCIES: ../inventory (Rung, type only) — pure arithmetic, no database, no clock.
// OUTPUTS:      mixCostPerSize · MixCostForSize.
// AC-1:         generic. A ladder is a ladder; nothing here names a vertical.
// ============================================================
import type { Rung } from '../inventory/containerLadder';

export interface MixCostForSize {
  /** The rung's own label, exactly as the ladder holds it — never re-derived from a number. */
  label: string;
  /** The rung's volume in gallons, or null when nobody has recorded one. */
  containerGallons: number | null;
  /** Gallons of mix ONE tree of this size takes at install. Null when the rung has no volume. */
  mixGallons: number | null;
  /** What that mix costs. Null when either the rung or the recipe cannot supply its half. */
  cost: number | null;
  /** Why there is no figure, in the reader's words. Null when there is one. */
  refusal: string | null;
  /** True when the cost is real but built on an incomplete recipe — shown, and shown as partial. */
  partial: boolean;
  /** Retired rungs still resolve for history and are never OFFERED (R-133). */
  active: boolean;
}

export interface MixCostInput {
  /** The tenant's ladder, retired rungs included — the caller decides what to show. */
  ladder: readonly Rung[];
  /** `installMixContainerVolumesPerTree` — 2.0 at LAWNS (R-155). */
  mixContainerVolumesPerTree: number;
  /** The recipe's cost per GALLON of mix, or null when the recipe cannot be costed at all. */
  costPerGallon: number | null;
  /** True when that per-gallon figure excludes something — it travels DOWN to every size. */
  recipeIncomplete: boolean;
}

/**
 * One row per rung, in the ladder's own order.
 * ⚠️ The caller filters retired rungs if it wants to; they are returned with `active: false` rather
 * than dropped, because a report of what every size costs that silently omits sizes is worse than
 * one that shows them marked.
 */
export function mixCostPerSize(input: MixCostInput): MixCostForSize[] {
  const { ladder, mixContainerVolumesPerTree: ratio, costPerGallon, recipeIncomplete } = input;
  return ladder.map(rung => {
    const base: MixCostForSize = {
      label: rung.label, containerGallons: rung.volumeGallons,
      mixGallons: null, cost: null, refusal: null, partial: false, active: rung.active,
    };
    if (rung.volumeGallons == null) {
      return { ...base, refusal: `No volume recorded for ${rung.label}, so the mix it takes cannot be worked out. Set it in Settings → Container sizes.` };
    }
    if (!(ratio > 0)) {
      return { ...base, refusal: 'Settings → Operations has no mix ratio, so the mix per tree cannot be worked out.' };
    }
    const mixGallons = rung.volumeGallons * ratio;
    if (costPerGallon == null) {
      return { ...base, mixGallons,
        refusal: `${round1(mixGallons)} gallons of mix, but the recipe has no cost per gallon yet.` };
    }
    return {
      ...base, mixGallons,
      cost: Math.round(mixGallons * costPerGallon * 100) / 100,
      partial: recipeIncomplete,
    };
  });
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
