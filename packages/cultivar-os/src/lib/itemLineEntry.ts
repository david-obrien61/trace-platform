// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      The pure half of counter item entry: given the tenant's rows and what Lauren has
//               typed, WHICH rows show, in what order, and WHAT EACH ROW SAYS ABOUT ITSELF.
//               The component owns the keyboard and the DOM; every decision is here so it can be
//               asserted without a browser (tech-debt #134).
//
// 🔴 IT DOES NOT MATCH. Matching is `matchesHaystack` in the shared searchSpec — the same rule
//               `/inventory` runs (David's ruling, 2026-09-23). This module decides ORDER and
//               ANNOTATION, which is what a till needs and a grid does not.
//
// THE THREE THINGS A COUNTER NEEDS THAT THE ROSTER DOES NOT:
//   · SELLABLE, SHOWN AND MARKED — never hidden. David: *"a zero on hand is what sends someone to
//     count"* (D-9). Live on LAWNS: **133 of 632 live rows cannot be sold right now** (no stock or
//     no price). Hiding them answers "why isn't it in the list?" with silence.
//   · SIZE, AND WHEN THERE ISN'T ONE — **107 of 632 LAWNS rows carry no size at all**, and 402 of
//     632 share a name with another row where SIZE is the only difference. A row with no size
//     inside such a group cannot be told apart by typing, and the screen says so rather than
//     offering an indistinguishable list.
//   · ORDER — sellable first, then by name. A till's first row is the one most likely to be taken
//     by pressing Enter, so it must not be one that cannot be sold.
//
// DEPENDENCIES: shared searchSpec (matchesHaystack, searchHaystack) · ./checkoutSearchSpec. Pure.
// OUTPUTS:      ItemRow · ItemChoice · rankItemChoices · sellabilityOf.
// ─────────────────────────────────────────────────────────────────────────────
import { matchesHaystack, searchHaystack } from '@trace/shared/components/datasheet/searchSpec';
import { CHECKOUT_ITEM_SEARCH, type CheckoutSearchRow } from './checkoutSearchSpec';

/** What the entry list needs from a `business_inventory` row. */
export interface ItemRow extends CheckoutSearchRow {
  id: string;
  qty?: number | null;
  sell_price?: number | null;
}

/** Why a row cannot be sold, in the words the list shows. `null` = it can. */
export type Unsellable = 'none in stock' | 'no price set' | 'none in stock · no price set' | null;

/**
 * Can this row be sold right now, and if not, why?
 *
 * 🔴 BOTH REASONS ARE NAMED WHEN BOTH APPLY. "Not available" collapses two different problems
 * with two different fixes — count it, or price it — into one word that suggests neither.
 */
export function sellabilityOf(row: ItemRow): Unsellable {
  const noStock = !(Number(row.qty) > 0);
  const noPrice = !(Number(row.sell_price) > 0);
  if (noStock && noPrice) return 'none in stock · no price set';
  if (noStock) return 'none in stock';
  if (noPrice) return 'no price set';
  return null;
}

/** One row as the list renders it. */
export interface ItemChoice {
  row: ItemRow;
  /** Null when it can be sold; otherwise why not — SHOWN, never used to hide. */
  unsellable: Unsellable;
  /**
   * True when this row carries no size AND at least one other row shown shares its name — so
   * typing more cannot separate them. The list says so instead of offering a silent duplicate.
   */
  indistinguishable: boolean;
}

const nameKey = (r: ItemRow): string => (r.name ?? '').trim().toLowerCase();

/**
 * Which rows to show, in order.
 *
 * ORDER: sellable first, then by name, then by size. **Sellable first is load-bearing** — the
 * first row is what Enter takes, and it must never be one that cannot be sold.
 *
 * ⚠️ AN EMPTY TERM RETURNS NOTHING, NOT EVERYTHING. At a till, 632 rows under the cursor is not a
 * starting point, it is noise; the list appears when she starts typing. (A GRID is the opposite,
 * which is why this decision lives here and not in the shared matcher.)
 */
export function rankItemChoices(rows: readonly ItemRow[], term: string, limit = 12): ItemChoice[] {
  if (term.trim() === '') return [];

  const hit = rows.filter(r => matchesHaystack(searchHaystack(CHECKOUT_ITEM_SEARCH, r), term));

  // How many SHOWN rows share each name — the denominator for "can typing separate these?".
  const byName = new Map<string, number>();
  for (const r of hit) byName.set(nameKey(r), (byName.get(nameKey(r)) ?? 0) + 1);

  const choices: ItemChoice[] = hit.map(r => ({
    row: r,
    unsellable: sellabilityOf(r),
    indistinguishable: !(r.size ?? '').trim() && (byName.get(nameKey(r)) ?? 0) > 1,
  }));

  choices.sort((a, b) => {
    // 1. sellable first
    const as = a.unsellable ? 1 : 0, bs = b.unsellable ? 1 : 0;
    if (as !== bs) return as - bs;
    // 2. name, numeric-aware so "15 gal" sorts before "100 gal"
    const n = (a.row.name ?? '').localeCompare(b.row.name ?? '', undefined, { numeric: true });
    if (n !== 0) return n;
    // 3. size, same comparison
    return (a.row.size ?? '').localeCompare(b.row.size ?? '', undefined, { numeric: true });
  });

  return choices.slice(0, limit);
}
