// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the ITEM-SPECIFIC half of the QuickBooks read — the shape of one item row, the
//   interpretation of Intuit's fields, and the breakdown that answers the mapping question
//   (is there an item with Id '1'? how many are Categories rather than sellable things? what
//   is the full split by income account?). The entity-agnostic machinery — query building,
//   counting, paging, completeness, capture naming, failure classification — lives in
//   ./qboRead and is SHARED with the customer read (§6 r8).
// DEPENDENCIES: ./qboRead (parseRows).
// OUTPUTS: QboItemRow · ParsedItemList · parseItemList · ItemBreakdown · summariseItems.
//
// 🔴 WHY THIS EXISTS AT ALL — THE ARMED LANDMINE. The invoice push carries TWELVE hardcoded
//   `ItemRef: { value: '1', name: 'Services' }` literals (`api/qbo/invoice/cultivar.ts`).
//   Nothing has pushed to LAWNS yet, so their books are clean; the next completed checkout is
//   the first real push and would land every line — the trees included — as generic
//   "Services", corrupting the Sales of Nursery Stock vs Services split the cost model rests
//   on. Reading their actual item list is what tells us the real ids. THIS PASS READS ONLY.
//
// 🔴 THE TWELVE LITERALS ASSERT `Id = '1'` TWELVE TIMES AND THE FIRST HUNDRED ROWS DID NOT
//   CONTAIN IT. That is not proof it is absent — the first hundred was a TRUNCATED page — and
//   it is exactly why `summariseItems` answers the question against the COMPLETE list rather
//   than leaving a human to scan a table for one id.
//
// 🔴 NOTHING HERE PERSISTS AND NOTHING HERE LOGS A BODY (R-23 clauses b and c).
// ─────────────────────────────────────────────────────────────────────────────
import { parseRows } from './qboRead';

/** One item, reduced to the fields that answer "what should a tree map to?" and "what IS this
 *  product?". `description` and `fullyQualifiedName` were added 2026-09-06 for the catalogue
 *  import: the first carries the product's real name and size, the second tells two
 *  identically-named items apart. */
export interface QboItemRow {
  id: string;
  name: string;
  /** 'Service' | 'Inventory' | 'NonInventory' | 'Category' | … — Intuit's vocabulary, not ours. */
  type: string | null;
  /** The revenue bucket. This is the field that makes the Nursery-Stock/Services split real. */
  incomeAccount: string | null;
  active: boolean | null;
  /**
   * The item's own published price — Intuit's `UnitPrice` on the Item record.
   *
   * 🔴 THIS IS THE PRICE CARD, AND IT IS THE OTHER HALF OF EVERY PRICING FINDING. An invoice
   * line says what was CHARGED; only this says what the business decided to charge. Neither
   * alone can answer "did we sell below our own price"; the two together can, and nothing else
   * in these books can.
   *
   * ⚠️ NULL MEANS THE ITEM DOES NOT PUBLISH A PRICE, which is entirely normal for a Category
   * folder, for a service billed by quote, and for an item somebody never filled in. It is a
   * fact to report, never a zero to compare against — a floor of $0.00 would make every sale
   * "at or above list" and quietly empty the finding.
   */
  unitPrice: number | null;
  /** What it costs the business, where QuickBooks holds one. Reported, never used as a floor —
   *  selling below cost is a different (and worse) finding than selling below list, and this
   *  build does not make that claim on a customer's behalf. */
  purchaseCost: number | null;
  /**
   * Intuit's `Sku`.
   *
   * 🔴 CORRECTED 2026-09-06 — THIS IS NOT A JOIN KEY AND THE OLD COMMENT HERE SAID IT WAS.
   * MEASURED against LAWNS's complete 685-item capture (2026-09-04): **`Sku` is present on 2 of
   * 685.** The prior sentence — *"the join key that already works — 248 of 250 rows in the
   * pricing tab match a catalogue name exactly"* — described a match on the item's NAME and then
   * called the result a SKU. Two different fields, one claim, and the claim steered a build.
   * `docs/RULINGS.md` R-70 and `retireAndReplace.ts` carried the same false statement; all three
   * are corrected in this pass. Keep the field — 2 rows do carry one — but never key on it.
   */
  sku: string | null;
  /**
   * Intuit's `Description`.
   *
   * 🔴 THIS IS THE FIELD THAT CARRIES THE PRODUCT. MEASURED: present on 632 of 685, and at LAWNS
   * it is TRACE's own name and size concatenated — item `AP45` has the description
   * *"Afgan Black Pine, 45 Gallon"*. `Name` is the shorthand code the office types; `Description`
   * is what a person would call the thing. A catalogue built from `Name` would show Lauren 647
   * rows reading "AP45", "NZCM30", "BPJ30REP".
   *
   * ⚠️ NULL IS A REAL STATE — 15 of the 647 sellable items have no description at all — and it
   * must stay distinguishable from an empty string, because "the field is absent" and "somebody
   * typed nothing" are different facts about someone else's books (D-9 / A9).
   */
  description: string | null;
  /**
   * Intuit's `FullyQualifiedName` — the item's path through the category hierarchy, e.g.
   * `Crape Myrtle:NZCM30`. Present on 685 of 685.
   *
   * 🔴 IT IS THE ONLY THING THAT TELLS TWO IDENTICALLY-NAMED ITEMS APART ON SCREEN. LAWNS has
   * two items both named `NZCM30`: Id 859 (`Crape Myrtle:NZCM30`, NonInventory, $900) and Id 150
   * (`NZCM30`, Service, $350). Reported so a collision can be shown to the owner as two
   * distinguishable rows rather than as one row and a silent choice.
   */
  fullyQualifiedName: string | null;
}

export interface ParsedItemList {
  ok: boolean;
  items: QboItemRow[];
  /** Set when the body could not be read as an item list. The body itself is NEVER in here. */
  parseError: string | null;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/**
 * A number, or null.
 *
 * 🔴 AN UNREADABLE VALUE BECOMES NULL, NEVER 0. Intuit sends prices as JSON numbers, but this
 * parse also runs over hand-saved capture files and over whatever a future minorversion sends;
 * coercing `"n/a"` or `""` to zero would publish a price card of free items, and every
 * below-the-floor finding downstream would then be measured against it. Absent is not empty.
 */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse ONE page of Intuit's `{ QueryResponse: { Item: [...] } }` body.
 *
 * 🔴 AN EMPTY ITEM LIST AND A FAILED PARSE ARE DIFFERENT FACTS AND MUST NOT RENDER THE SAME
 * (D-9 / A9 — absent is not empty). A QuickBooks company with no items returns
 * `QueryResponse: {}` with NO `Item` key at all, which is a true, readable answer: ok, zero
 * rows. A body we could not read is `ok:false` and says so. Reporting "0 items" for a
 * response we failed to understand would be the confident-label-over-unread-data defect one
 * more time, in the one place whose whole job is reading someone else's books.
 */
export function parseItemList(rawBody: string): ParsedItemList {
  const page = parseRows(rawBody, 'Item');
  if (!page.ok) return { ok: false, items: [], parseError: page.parseError };

  const items: QboItemRow[] = [];
  for (const it of page.rows) {
    const id = str(it?.Id);
    // An item with no Id cannot be an ItemRef target — which is the ONLY thing we want these
    // for — so it is dropped rather than rendered as a row that looks usable.
    if (!id) continue;
    const income = (it?.IncomeAccountRef ?? null) as { name?: unknown } | null;
    items.push({
      id,
      name: str(it?.Name) ?? '(unnamed)',
      type: str(it?.Type),
      incomeAccount: str(income?.name),
      active: typeof it?.Active === 'boolean' ? (it.Active as boolean) : null,
      unitPrice: num(it?.UnitPrice),
      purchaseCost: num(it?.PurchaseCost),
      sku: str(it?.Sku),
      description: str(it?.Description),
      fullyQualifiedName: str(it?.FullyQualifiedName),
    });
  }
  return { ok: true, items, parseError: null };
}

export interface IncomeAccountTally {
  /** `null` renders as "Not set" — an item with no income account is a real, reportable state. */
  account: string | null;
  count: number;
}

export interface ItemBreakdown {
  total: number;
  /** A Category is a FOLDER in QuickBooks. It cannot be an invoice line's ItemRef. */
  categories: number;
  /** Everything that is not a Category — i.e. everything an ItemRef could legally point at. */
  sellable: number;
  inactive: number;
  /** 🔴 The twelve literals assert this id exists. This is the answer, from the whole list. */
  itemId1: QboItemRow | null;
  /** Every income account with its count, biggest first, ties broken by name for stability. */
  byIncomeAccount: IncomeAccountTally[];
}

/**
 * The breakdown the mapping pass needs, computed once so the screen and any later consumer
 * cannot describe the same list differently.
 *
 * 🔴 `itemId1` IS THE HEADLINE. Twelve invoice lines assert `ItemRef.value === '1'`. If this
 * comes back `null` against a list proven complete, every one of those twelve is pointing at
 * an item that does not exist in this company — which is a different and worse defect than
 * "they all point at the wrong item", because Intuit rejects the push outright rather than
 * mis-filing it. If it comes back with a row, its NAME and INCOME ACCOUNT say what the push
 * has been about to do.
 */
export function summariseItems(items: QboItemRow[]): ItemBreakdown {
  const tally = new Map<string, { account: string | null; count: number }>();
  let categories = 0, inactive = 0;
  let itemId1: QboItemRow | null = null;

  for (const it of items) {
    // Case-insensitive: 'Category' is Intuit's spelling today, and a vocabulary comparison
    // that depends on their casing is the class of bug `normalizeSize` was written for.
    if ((it.type ?? '').toLowerCase() === 'category') categories++;
    if (it.active === false) inactive++;
    if (it.id === '1' && itemId1 === null) itemId1 = it;

    // The key is namespaced so an item whose income account is literally named "not set"
    // cannot merge with the rows that genuinely have none.
    const key = it.incomeAccount === null ? 'null:' : `set:${it.incomeAccount}`;
    const row = tally.get(key);
    if (row) row.count++;
    else tally.set(key, { account: it.incomeAccount, count: 1 });
  }

  // Biggest first; on a tie a NAMED account beats the "Not set" residual, then alphabetical.
  // The nulls-last clause is deliberate: `(a.account ?? '')` alone sorts the empty string FIRST,
  // so a tie floated "Not set" to the top of a breakdown whose whole job is naming real buckets.
  const byIncomeAccount = [...tally.values()].sort((a, b) =>
    b.count - a.count
    || (a.account === null ? 1 : 0) - (b.account === null ? 1 : 0)
    || (a.account ?? '').localeCompare(b.account ?? ''),
  );

  return { total: items.length, categories, sellable: items.length - categories, inactive, itemId1, byIncomeAccount };
}
