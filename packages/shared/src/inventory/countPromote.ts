// ============================================================
// countPromote — the ONE pure decision behind a count's promote into business_inventory.
//
// PURPOSE:      A physical count resolves a VARIETY and supplies (size, qty). Something must
//               decide WHICH row that lands on: update an existing (variety × size), fill a
//               variety placeholder, or mint a size-sibling. That decision was inline in
//               InventoryCount.commitCount — unreachable by a test, and it shipped a defect
//               that made counting a variety permanently unscannable (D-49).
//               This is that decision, extracted PURE (D-47's proven shape: the decision lives
//               in shared and is testable without a database; the IO stays in the caller).
//
// THE INVARIANT (D-49 — state it once, it governs every branch):
//   ANY path that mints a size-sibling must leave the family in a state where the size-picker
//   fires BY CONSTRUCTION — a non-blank variant_group on EVERY row of the family, a distinct
//   non-empty size on EVERY row, and SKU lineage from the family's base SKU.
//   That is exactly detectSizeCollision's contract (stockLineResolver.ts). A mint that leaves
//   the family half-grouped or size-less does not merely look untidy: the next scan of that
//   variety returns >1 token-equal rows, detectSizeCollision correctly REFUSES to guess, and
//   the variety resolves UNKNOWN. Counting it made it uncountable.
//
// WHY TWO BRANCHES, NOT ONE PATCH (both are the same invariant, proven on live data 2026-07-16):
//   (1) STUB (qty 0, size null, variant_group null) → FILL IN PLACE, never sibling. The scrape
//       (populate.ts) minted ~103 of these under the D-9 honesty contract — qty 0, no cost, no
//       size — because scrape-reads-variations was never built. Under D-34 (the LOT is the SKU,
//       qty is the COUNT) a row with no size and no stock IS NOT A LOT; it is a variety
//       placeholder wearing a lot's clothes. The first count FILLS it. D-49 does not bend D-34
//       — it enforces it.
//   (2) UNGROUPED NON-STUB (variant_group null, size present — a real lot) → CREATE is CORRECT,
//       but the parent MUST be auto-grouped in the same pass. Proven by the live data: 'Sierra'
//       Mexican Red Oak and Arizona Cypress Blue Ice were BOTH minted by this same count-promote
//       CREATE (their siblings carry sku NULL, which only this path produces) and BOTH WORK —
//       because their parents already carried a group. CREATE is not the defect;
//       CREATE-while-leaving-the-parent-ungrouped is. This is D-46's own rule (#126, "auto-groups
//       the parent if its group was null so the size-picker fires by construction") applied to
//       the path that skipped it — commitCount backfilled variant_group on the MATCH branch only.
//
// SIZE IS REQUIRED (ledger #135 — the invariant's other half, proven live 2026-07-16):
//   The invariant says every row of the family carries a DISTINCT NON-EMPTY size. D-49 enforced the
//   "distinct" half and left "non-empty" to the UI, where the field was optional and the save button
//   did not argue. David counted Alley Cat with the size box EMPTY and it minted
//   `created {size: null, qty: 60}` beside 15/30/45 — and the re-scan went UNKNOWN. A variety that
//   was clean at 16:59 was broken at 17:03, by the branch that was supposed to be the fix. Same
//   destination as the Basham's scar, different road.
//   So the refusal lives HERE, in the decision, not only in the sheet: the UI asks this same
//   function what it may do, so the two gates agree BY CONSTRUCTION rather than by parallel
//   spelling (D-48's shape; §1.6 item 3 — validated before the WRITE, not merely hidden in the UI).
//
// DEPENDENCIES: variantGroup.ts (baseSkuOf + deriveSiblingSku — the ONE SKU-lineage convention,
//               STD-011). No DB, no React, no vertical noun (AC-1).
// OUTPUTS:      isVarietyStub · sameSizeLabel · resolveCountTarget → CountTarget.
// ============================================================

import { baseSkuOf, deriveSiblingSku } from './variantGroup';
import { sameSizeLabel } from '../utils/sizeLabel';

// sameSizeLabel now lives in the ONE shared home (STD-011) — `utils/sizeLabel` — so the count path,
// the import matcher, and the L5 size-picker fold sizes the SAME way. Re-exported to keep this
// module's public API (inventory/index + tests) stable.
export { sameSizeLabel };

/** The minimum a stub check reads. Satisfied by a StockLineRow, a grid row, or a count sibling. */
export interface StubCandidate {
  qty?:           number | null;
  size?:          string | null;
  variant_group?: string | null;
}

/**
 * A VARIETY PLACEHOLDER, not a stock line (D-49). qty 0 AND no size AND no variant_group.
 *
 * THE ONE canonical spelling of this predicate (STD-011) — do NOT re-spell
 * `qty === 0 && !size && !variant_group` inline at a call site. It is read by the count's
 * promote decision and is the shape the discovery scrape mints.
 *
 * Why these three together, and why it is safe: under D-34 the lot IS the SKU and qty is the
 * COUNT, so a row with no size AND no stock AND no size-family cannot be a lot — there is
 * nothing for it to be the lot OF. A sold-out real lot keeps its size (qty 0 alone is NOT a
 * stub). A hand-made row with all three blank is a placeholder in substance whatever the
 * intent. The promote additionally only fills when the resolver returned EXACTLY ONE row, so
 * this never picks between candidates.
 */
export function isVarietyStub(row: StubCandidate): boolean {
  return (row.qty ?? 0) === 0
    && (row.size ?? '').trim() === ''
    && (row.variant_group ?? '').trim() === '';
}

// Size comparison (sameSizeLabel) is the shared, size-normalizing test imported + re-exported above
// (tech-debt #56 — the mixed-vocabulary defect — is CLOSED there: "15" now equals "15 gal" because
// both fold through normalizeSize before comparison, exactly as D-45 did for names).

/** A sibling row of one variety, as the count decision needs it (DB field names — matches
 *  StockLineRow, so callers map nothing). */
export interface CountSibling {
  id:             string;
  size:           string | null;
  qty:            number | null;
  variant_group:  string | null;
  sku:            string | null;
}

/** The decision. `regroup` carries the ids of family rows whose variant_group is blank and
 *  MUST be backfilled to `variantGroup` in the same pass — that is the invariant, expressed.
 *  `create.size` is a non-null string: the decision cannot mint a size-less row into a family,
 *  because the type does not let it (the blank case exits at `refuse` above). */
export type CountTarget =
  | { action: 'update';      rowId: string; variantGroup: string | null }
  | { action: 'fill';        rowId: string; size: string; variantGroup: string | null }
  | { action: 'create';      size: string; variantGroup: string; sku: string | null; regroup: string[] }
  | { action: 'refuse';      reason: 'size-required' }
  | { action: 'record-only' };

/** The message a refusal shows the counter. Homed with the rule that produces it (STD-011) so the
 *  sheet cannot drift into explaining the refusal differently from the gate that made it. */
export const SIZE_REQUIRED_MESSAGE =
  'Which size? Pick one above or type it — a count has to say which size it counted.';

/**
 * Decide where a counted (variety × size, qty) lands. Pure — no DB, no side effects.
 *
 * @param siblings  the resolved variety's existing rows (0, 1, or many)
 * @param groupKey  the variant_group to converge the family on: an existing sibling's group ??
 *                  the scanned QR slug ?? variantGroupSlug(typed name) — the D-45 convention
 * @param size      the size the counter supplied (free label; null = they gave none)
 */
export function resolveCountTarget(params: {
  siblings: CountSibling[];
  groupKey: string | null;
  size:     string | null;
}): CountTarget {
  const { siblings, groupKey } = params;
  const size = (params.size ?? '').trim() || null;

  // (R) SIZE REQUIRED — the invariant's "non-empty" half, and it must come FIRST.
  //
  //     A count that will touch a business_inventory row must say WHICH SIZE it counted. Under
  //     D-34 the lot IS the SKU and SIZE is the distinguishing attribute, so a lot with no size is
  //     not identifiable — every commerce platform refuses a variant with an empty required option
  //     value (§6 r16). "Writes a row" is exactly "not record-only": a plant tag with no linked lot
  //     writes nothing to inventory, so it needs no size (its size is decorative — it lands in the
  //     count's item_label and nowhere else).
  //
  //     ⚠️ THIS RUNS BEFORE (0) DELIBERATELY, and that ordering is the fix, not a detail.
  //     A blank size MATCHES a size-less row at (0) — sameSizeLabel(null, null) is true — so a stub
  //     counted with no size used to take a plain `update`: qty landed on a row that still had no
  //     size, turning a harmless placeholder into a size-LESS LOT. That is the Basham's shape minted
  //     through `update` instead of `create`, and D-49's own suite asserted it as CORRECT
  //     ("stub counted with NO size → plain update"). The defect was tested in and blessed — the
  //     D-48 scar, verbatim. Refusing after (0) would fix the create branch and leave that one live.
  if (size === null && (groupKey != null || siblings.length > 0)) {
    return { action: 'refuse', reason: 'size-required' };
  }

  // (0) Exact (variety × size) → UPDATE on-hand. A physical count SETS qty (never a decrement),
  //     and confirms/backfills the group on the row it touches.
  const exact = siblings.find(s => sameSizeLabel(s.size, size));
  if (exact) return { action: 'update', rowId: exact.id, variantGroup: groupKey };

  // (1) STUB FILL (D-49) — the one resolved row is a variety PLACEHOLDER and the count supplies
  //     the first real size. Fill it; do NOT mint a sibling beside it. A no-size count can never
  //     reach here — it is refused at (R) above.
  if (size !== null && siblings.length === 1 && isVarietyStub(siblings[0])) {
    return { action: 'fill', rowId: siblings[0].id, size, variantGroup: groupKey };
  }

  // (2) CREATE a genuine size-sibling — and leave the family picker-ready BY CONSTRUCTION:
  //     every blank-group row in the family is regrouped onto the same key, and the new row
  //     inherits the family's SKU lineage. Without the regroup the next scan sees a mixed-group
  //     family, detectSizeCollision refuses, and the variety goes UNKNOWN.
  if (groupKey && size !== null) {
    const regroup = siblings.filter(s => (s.variant_group ?? '').trim() === '').map(s => s.id);
    return {
      action: 'create',
      size,
      variantGroup: groupKey,
      sku: deriveSiblingSku(baseSkuOf(siblings), size),
      regroup,
    };
  }

  // (3) No group key AND no sibling (a plant tag with no linked lot) → nothing to write to
  //     inventory; the count is still recorded (append-only history).
  return { action: 'record-only' };
}
