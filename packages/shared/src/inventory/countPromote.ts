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
// DEPENDENCIES: variantGroup.ts (deriveSiblingSku — the ONE SKU-lineage convention, STD-011).
//               No DB, no React, no vertical noun (AC-1).
// OUTPUTS:      isVarietyStub · sameSizeLabel · baseSkuOf · resolveCountTarget → CountTarget.
// ============================================================

import { deriveSiblingSku } from './variantGroup';

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

/**
 * Size is a FREE LABEL — compare case/whitespace-insensitively. Moved here from
 * InventoryCount's local copy so the count path and this decision share ONE definition
 * (STD-011); it is also the single place the known size-VOCABULARY defect gets fixed.
 *
 * KNOWN LIMIT, RECORDED NOT FIXED (tech-debt #56): this is exact string equality after
 * trim/case-fold. The live catalog already carries mixed size vocabulary — 'Sierra' Mexican
 * Red Oak is live with sizes ["15", "30 gal"] — so counting "15 gal" against a "15" row does
 * NOT match here and mints a THIRD row: two spellings of one physical size in the picker.
 * D-45 built resolve-before-create so varied NAME spellings converge; the same was never done
 * for SIZES. A normalizeSize exists in the scrape parser, not on the count path. Deliberately
 * NOT fixed in this pass (it is its own defect, its own blast radius, its own RED test).
 */
export function sameSizeLabel(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

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
 *  MUST be backfilled to `variantGroup` in the same pass — that is the invariant, expressed. */
export type CountTarget =
  | { action: 'update';      rowId: string; variantGroup: string | null }
  | { action: 'fill';        rowId: string; size: string; variantGroup: string | null }
  | { action: 'create';      size: string | null; variantGroup: string; sku: string | null; regroup: string[] }
  | { action: 'record-only' };

/**
 * The family's BASE SKU — the lineage root a size-sibling's SKU derives from.
 * Shortest non-blank SKU wins: within ONE variety's family a derived sibling SKU is always its
 * base plus a suffix ("DISC-1001" → "DISC-1001-30G"), so the base is always the shortest.
 * Returns null when no sibling carries a SKU — D-9 omit-not-fake: never invent a base.
 */
export function baseSkuOf(siblings: Array<{ sku: string | null }>): string | null {
  const skus = siblings.map(s => (s.sku ?? '').trim()).filter(Boolean);
  if (skus.length === 0) return null;
  return skus.reduce((a, b) => (b.length < a.length ? b : a));
}

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

  // (0) Exact (variety × size) → UPDATE on-hand. A physical count SETS qty (never a decrement),
  //     and confirms/backfills the group on the row it touches.
  const exact = siblings.find(s => sameSizeLabel(s.size, size));
  if (exact) return { action: 'update', rowId: exact.id, variantGroup: groupKey };

  // (1) STUB FILL (D-49) — the one resolved row is a variety PLACEHOLDER and the count supplies
  //     the first real size. Fill it; do NOT mint a sibling beside it. A no-size count can never
  //     reach here (it matched the stub at (0) — sameSizeLabel(null, null) is true).
  if (size !== null && siblings.length === 1 && isVarietyStub(siblings[0])) {
    return { action: 'fill', rowId: siblings[0].id, size, variantGroup: groupKey };
  }

  // (2) CREATE a genuine size-sibling — and leave the family picker-ready BY CONSTRUCTION:
  //     every blank-group row in the family is regrouped onto the same key, and the new row
  //     inherits the family's SKU lineage. Without the regroup the next scan sees a mixed-group
  //     family, detectSizeCollision refuses, and the variety goes UNKNOWN.
  if (groupKey) {
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
