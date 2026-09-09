// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Build the payload for a WHOLE-COLUMN write to
//               `business_pricing_config.config` without deleting the keys the writing screen
//               does not own.
// DEPENDENCIES: ./CostToProduce (EMPTY_COST_CONFIG) — the shape the cost panel edits.
// OUTPUTS:      COST_PANEL_OWNED_KEYS · mergeOwnedOverConfig · describeCarry
//
// 🔴 THE INVERSION, AND WHY IT IS THE WHOLE POINT.
// The Cost-to-Produce panel used to name the keys it would PRESERVE — `discountTypes`,
// `pricingTiers`, `aiBiEnabled` — and write everything else wholesale. That list is a claim about
// every OTHER screen's data, and no author can make it correctly: it was written before `taxRate`
// lived in this column, before `production` did, and it was never revisited. Anything absent from
// it is deleted by a Save pressed for an unrelated reason. LAWNS's 8.25% sales-tax rate sat one
// such Save away from deletion, and it prints on every invoice a customer reads.
//
// So the enumeration is inverted. A screen names the keys IT OWNS — a claim it is qualified to
// make — and every other top-level key is carried through untouched. A key nobody has heard of
// survives by default, which is the only default that is safe.
//
// ⚠️ TOP-LEVEL GRANULARITY, DELIBERATELY. An owned key is replaced WHOLESALE, never deep-merged:
// the panel must be able to REMOVE something it owns — a deleted location has to stay deleted, and
// a deep merge would resurrect it. Unowned keys are carried by reference and never merged into,
// so this function cannot half-edit a neighbour's data either. The two sets are disjoint by
// construction and each is handled in exactly one way.
//
// 🔴 THE OWNED SET IS DERIVED FROM THE SHAPE, NOT TYPED OUT (#179's lesson: `VENDORS_SELECT` named
// ten columns while its migration created fourteen, and nothing we own could see the difference).
// `EMPTY_COST_CONFIG` IS the cost recipe's definition — the panel loads it as its fallback and
// `discountReview` already reads it to ask "which keys does the cost panel own". Reading the key
// set off it means the two cannot drift: add a field to the config shape and it is owned the same
// day, with no second list to remember.
import { EMPTY_COST_CONFIG } from './CostToProduce';

/**
 * The top-level keys of `business_pricing_config.config` that the Cost-to-Produce panel owns.
 * DERIVED — every key of the cost-recipe shape, and nothing else.
 */
export const COST_PANEL_OWNED_KEYS: readonly string[] =
  Object.freeze(Object.keys(EMPTY_COST_CONFIG));

/**
 * Build the config to write: the screen's own keys over whatever is stored, every other
 * top-level key carried through untouched.
 *
 * @param current  the config as it is stored RIGHT NOW (re-read immediately before the write —
 *                 a stale copy is how one screen clobbers another). `null`/non-object ⇒ `{}`,
 *                 which is the correct reading of "this tenant has no config row yet".
 * @param edited   the screen's in-memory config. Only its OWNED keys are taken; anything else it
 *                 happens to be carrying is ignored, so a stale copy of a NEIGHBOUR's key can
 *                 never be written back over a fresher one.
 * @param ownedKeys the keys this screen owns. Defaults to the cost panel's set.
 */
export function mergeOwnedOverConfig(
  current: unknown,
  edited: Record<string, unknown>,
  ownedKeys: readonly string[] = COST_PANEL_OWNED_KEYS,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  for (const k of ownedKeys) {
    // Present-only: an owned key the screen is not carrying leaves the stored value alone rather
    // than writing `undefined` over it (which jsonb serialisation would turn into a deletion).
    // The panel always carries all of them — `describeCarry` is how a caller notices if it stops.
    if (edited[k] !== undefined) base[k] = edited[k];
  }
  return base;
}

/**
 * What a write is about to do to the column's top-level key set, for instrumentation. Reports the
 * keys carried through untouched and — the one that must always be empty — any key that would be
 * LOST by this write.
 */
export function describeCarry(
  current: unknown,
  next: Record<string, unknown>,
): { carried: string[]; dropped: string[]; ownedMissing: string[] } {
  const cur = (current && typeof current === 'object' && !Array.isArray(current))
    ? (current as Record<string, unknown>) : {};
  const before = Object.keys(cur);
  const after = new Set(Object.keys(next));
  const owned = new Set(COST_PANEL_OWNED_KEYS);
  return {
    carried: before.filter((k) => !owned.has(k) && after.has(k)),
    dropped: before.filter((k) => !after.has(k)),
    ownedMissing: COST_PANEL_OWNED_KEYS.filter((k) => !after.has(k)),
  };
}
