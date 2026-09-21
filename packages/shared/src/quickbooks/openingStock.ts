// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: answer one question from a business's own invoice history — *how much does a typical
//   item of ours move in a month* — and turn that answer into a LOW opening-stock number the
//   owner chooses, so an imported product list stops reading "None in stock" on all 647 rows.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow · goodsLines · monthOf · monthsBetween). PURE: no
//   db, no network, no env, and no clock it did not receive.
// OUTPUTS: OpeningStockMeasurement · SEED_CAP · measureOpeningStock · suggestOpeningStock ·
//   seedRefusal · planOpeningStockSeed · SEED_LEDGER_KIND · SeedMode · seedModeFor.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LEDGER #342 — IN TEST MODE THE SEED WRITES NO LEDGER ROW (David, 2026-09-16, ruling ②).
// ══════════════════════════════════════════════════════════════════════════════════════════
// *"We must never allow them to write to the actual record during testing."* So in TEST mode the
// plan touches ONLY rows the QuickBooks import created (`import_run_id IS NOT NULL`), and its
// steps set qty WITHOUT a ledger line (`writesLedger: false`). The opening ledger entry is written
// once, AFTER the switch. Out of test mode, nothing here changes. SEED_CAP holds in both.
// ⚠️ The after-the-switch writer is NOT built — tech-debt #308. Until it is, a test-seeded lot
// carries qty with no ledger line, and the reconcile screen reads it in `baseline` mode.
// STORY: *The imported catalogue can be sold from* (`user_stories.md`, ARC: cost-to-produce).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE PROBLEM THIS EXISTS FOR, AND IT IS NOT A COSMETIC ONE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The catalogue import writes `qty 0` BY DESIGN — R-93: *"this import brings a PRODUCT LIST, not
// stock."* That is correct and must not change. The consequence is that every imported row fails
// `checkSellable` with `none_available`, renders *"None in stock"*, and the add control is
// disabled. **A price card is not an inventory**, and a business cannot be demonstrated, let alone
// run, from one.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 A SEEDED NUMBER IS NOT A COUNT, AND THAT IS ENFORCED STRUCTURALLY RATHER THAN PROMISED.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Three mechanisms, none of them a convention a later writer can forget:
//   ① it writes its OWN ledger kind — `opening_stock_seed`, never `opening_balance`. An
//      `opening_balance` asserts a position the business KNEW. This asserts one nobody counted.
//   ② it writes NO `inventory_counts` row, so it can never become a reconcile's `prior` count.
//      The reconcile reads its priors from `inventory_counts` and will not find one here.
//   ③ it is a POSITION, not a movement (`isMovement` is false for it, exactly as for
//      `opening_balance`) — so a later reconcile can never replay the placeholder as if stock
//      had freshly arrived. That is tech-debt #70's live defect, and this kind is born immune.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT THIS DELIBERATELY DOES NOT DO: DERIVE A PER-ITEM FIGURE FROM PURCHASES MINUS SALES.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Ruled 2026-09-01. Purchases minus sales is a NET MOVEMENT, not a BALANCE — it is only a balance
// if you know the opening figure, and nobody knows what was standing in the field in October
// 2024. The arithmetic would produce a number no more trustworthy than a placeholder **while
// looking far more trustworthy**, which is worse than the placeholder: a placeholder invites a
// count, and a derived figure invites belief. So the measurement below is deliberately
// BUSINESS-WIDE and produces ONE number, not 647.
//
// ⚠️ AND THE BUSINESS-WIDE SHAPE IS ALSO WHAT R-23 CLAUSE (b) REQUIRES. The rows behind a count
// are not stored — so a finding names a NUMBER, never which records it counted. A per-item table
// would be exactly the stored book-of-their-business that clause forbids.
// ─────────────────────────────────────────────────────────────────────────────
import type { QboInvoiceRow } from './invoiceList';
import { goodsLines, monthOf, monthsBetween } from './invoiceList';
import { classifyDestination, DESTINATIONS, isGoodsAccount, isStockAccount } from '../business-logic/serviceReview';

/**
 * The ledger `kind` a seed writes.
 *
 * 🔴 IT NEEDS NO MIGRATION, AND THAT IS A PROPERTY OF THE SCHEMA RATHER THAN AN ASSUMPTION.
 * `business_inventory_ledger.kind` carries NO CHECK constraint, deliberately — its own migration
 * says so at `20260720_inventory_movement_ledger.sql:159`: *"the value set grows without a
 * migration."* So this build adds a vocabulary word and changes no schema, no policy and no
 * permission string.
 */
export const SEED_LEDGER_KIND = 'opening_stock_seed';

/**
 * The books rule whose stored result the seed screen reads back.
 *
 * 🔴 IT LIVES HERE, NOT ON THE SCREEN, AND THAT IS NOT TIDINESS. A screen importing it from a
 * component drags the supabase client into every test that wants to assert the id exists — and the
 * assertion that MATTERS is `booksRunStore.test.ts` §F11: the id the screen reads by must be an id
 * `BOOKS_RULES` actually declares. A mismatch makes the screen fall back to *"we have no sales
 * history"* forever, which looks exactly like the honest path and is not it.
 */
export const OPENING_STOCK_RULE_ID = 'opening-stock-suggestion';

/**
 * 🔴 THE CEILING, AND IT IS THE MECHANISM'S OWN SURVIVAL CONDITION.
 *
 * The seed is useful BECAUSE it runs out. A blocked sale is what sends somebody out to the lot to
 * count, and the count is the only thing that ever makes these numbers real. With no ceiling
 * somebody types 500 to stop the blocking — and then nothing ever blocks, nobody ever counts, and
 * the placeholder quietly becomes the permanent answer while looking like stock.
 *
 * ⚠️ 50 IS A NUMBER WE CHOSE, NOT ONE A STANDARD GAVE US (§6 r10). It is high enough not to
 * obstruct a demonstration and low enough that an ordinary week of selling reaches it.
 */
export const SEED_CAP = 50;

/** Never seed zero — a zero seed is just the state they are already in, written down. */
export const SEED_MIN = 1;

export interface OpeningStockMeasurement {
  /** Units a month for a typical item — the MEDIAN across items, rounded to one decimal. */
  median: number;
  /** The spread, as the quieter and busier quarters. A median with no spread hides a long tail. */
  p25: number;
  p75: number;
  /** How many distinct items the median is taken across. This is the finding's `of`. */
  items: number;
  /** Months of history the rate is computed over, business-wide. */
  months: number;
  /** `YYYY-MM` bounds of the history read. */
  firstMonth: string;
  lastMonth: string;
  /**
   * How many products move at or BELOW the number we would suggest. The finding's `matched`, and
   * a genuine proportion rather than a decorative one: it says how much of the catalogue a
   * one-month seed actually covers.
   */
  atOrBelowSuggestion: number;
  /**
   * Goods lines that named no item and could therefore not be attributed to one. Reported rather
   * than silently dropped — a rate computed over an unstated exclusion is a rate nobody can check.
   */
  unattributableLines: number;
}

/** The p-th percentile of a SORTED ascending array, by linear interpolation. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Units a month for a typical item, measured from the invoice history.
 *
 * 🔴 RETURNS `null` WHEN THERE IS NO SALES HISTORY TO GO ON, AND THAT IS THE HONEST PATH RATHER
 * THAN A FAILURE. A business that has just started, or whose books were never kept in
 * QuickBooks, has nothing for this to read. The screen then says *we have no sales to go on* and
 * the owner chooses the number themselves — which is a worse suggestion and a better answer than
 * a fabricated one. Every caller must treat `null` as "we did not look", never as zero.
 *
 * 🔴 THE DENOMINATOR IS PER ITEM, FROM ITS OWN FIRST SALE — NOT THE WHOLE WINDOW. An item first
 * sold last month has one month of history, not fourteen. Dividing it by the business's whole
 * window would report it moving a fourteenth of what it moves, and the median would drift down
 * with every new product the business ever adds. The window before an item's first sale carries
 * NO information about it: we do not know that it sold nothing, we know it was not on the books.
 *
 * ⚠️ ITEMS ARE KEYED ON `itemId`, NEVER ON `itemName` ([[R-40]]'s reasoning). Two products can
 * legitimately share a description; merging them would average two different things and nothing
 * about the result would look wrong. A line with no `itemId` is COUNTED and REPORTED as
 * unattributable rather than dropped in silence.
 */
export function measureOpeningStock(invoices: QboInvoiceRow[]): OpeningStockMeasurement | null {
  /** itemId → { units, firstMonth } */
  const byItem = new Map<string, { units: number; firstMonth: string }>();
  let unattributableLines = 0;
  let firstMonth: string | null = null;
  let lastMonth: string | null = null;

  for (const inv of invoices) {
    const month = monthOf(inv.txnDate);
    // An undated invoice cannot contribute to a RATE — there is no month to divide by. It is not
    // an error and it is not a zero; it simply carries no information about timing.
    if (month === null) continue;
    if (firstMonth === null || month < firstMonth) firstMonth = month;
    if (lastMonth === null || month > lastMonth) lastMonth = month;

    for (const line of goodsLines(inv)) {
      const units = Number(line.qty ?? 0);
      // A goods line with no quantity states a charge, not a count of anything.
      if (!Number.isFinite(units) || units <= 0) continue;
      if (line.itemId === null) { unattributableLines++; continue; }
      const cur = byItem.get(line.itemId);
      if (cur === undefined) byItem.set(line.itemId, { units, firstMonth: month });
      else {
        cur.units += units;
        if (month < cur.firstMonth) cur.firstMonth = month;
      }
    }
  }

  if (firstMonth === null || lastMonth === null) return null;
  if (byItem.size === 0) return null;

  const rates: number[] = [];
  for (const { units, firstMonth: itemFirst } of byItem.values()) {
    // Inclusive of both ends: an item sold only in one month has ONE month of history, not zero.
    const months = monthsBetween(itemFirst, lastMonth).length;
    rates.push(units / Math.max(months, 1));
  }
  rates.sort((a, b) => a - b);

  const median = round1(percentile(rates, 0.5));
  // The suggestion is a function of the median alone, so it can be computed here without a cycle
  // through `suggestOpeningStock` — which takes a whole measurement. Kept in ONE expression, and
  // `openingStock.test.ts` §D asserts the two agree rather than trusting that they do (§6 r8).
  const suggested = Math.min(SEED_CAP, Math.max(SEED_MIN, Math.round(median)));

  return {
    median,
    p25: round1(percentile(rates, 0.25)),
    p75: round1(percentile(rates, 0.75)),
    items: byItem.size,
    atOrBelowSuggestion: rates.filter(r => r <= suggested).length,
    months: monthsBetween(firstMonth, lastMonth).length,
    firstMonth,
    lastMonth,
    unattributableLines,
  };
}

/**
 * The number we SUGGEST — deliberately low, and the screen states the reason beside it.
 *
 * 🔴 LOW IS THE POINT, NOT A HEDGE. Ruled 2026-09-01: a low number blocks a sale sooner, and a
 * blocked sale is what sends someone out to the lot to count. That is how the real numbers get
 * into the system. A generous seed feels helpful and quietly removes the only event that ever
 * produces a true figure.
 *
 * About one month of typical movement is what that means in practice: the first item to sell
 * through blocks within roughly a month of ordinary trading.
 *
 * ⚠️ FLOORED AT 1 AND CAPPED AT `SEED_CAP`. A median below one unit a month is real (most of a
 * long catalogue barely moves) but a zero seed is the state they are already in.
 */
export function suggestOpeningStock(m: OpeningStockMeasurement | null): number | null {
  if (m === null) return null;
  return Math.min(SEED_CAP, Math.max(SEED_MIN, Math.round(m.median)));
}

/**
 * Why a chosen number cannot be used — or `null` when it can.
 *
 * ⚠️ THE CAP IS ENFORCED HERE AND IN THE DATABASE'S ABSENCE, WHICH IS STATED RATHER THAN IMPLIED.
 * There is no `api/` function for this (the Vercel Hobby ceiling is at 12 of 12 — §6 r11), so the
 * seed drives the same RPCs the desk grid drives, under the same RLS. A caller invoking
 * `adjust_inventory_manual` directly is not bound by `SEED_CAP`; they are bound by the permission
 * the RPC already checks. This function is what the SCREEN cannot get around, not what the
 * DATABASE cannot.
 */
export function seedRefusal(qty: number): string | null {
  if (!Number.isFinite(qty) || !Number.isInteger(qty)) {
    return 'Enter a whole number of units.';
  }
  if (qty < SEED_MIN) {
    return `Enter at least ${SEED_MIN} — a starting number of zero is the state you are already in.`;
  }
  if (qty > SEED_CAP) {
    return `${SEED_CAP} is the most we will start you at. A starting number is a placeholder, and a big one stops anything ever running out — which is what would otherwise send someone out to count.`;
  }
  return null;
}

/**
 * Which record a seed may write. `test` = the business has not switched QuickBooks writes on:
 * qty only, imported rows only, no ledger. `live` = today's behaviour, through the ledger RPC.
 */
export type SeedMode = 'test' | 'live';

/** The mode from the stored switch. An UNREAD switch is test mode — the side that writes no ledger. */
export function seedModeFor(qboWritesEnabled: boolean | null | undefined): SeedMode {
  return qboWritesEnabled === true ? 'live' : 'test';
}

/** A lot the seed may touch, as the planner needs to see it. */
/** The owner's own marker for a plant that is still growing. Case-insensitive, and matched
 *  anywhere in the name because it appears both mid-name and at the end. 75 rows at LAWNS. */
const UNDER_PRODUCTION = /\(under\s+production\)/i;

export interface SeedCandidate {
  id: string;
  name: string;
  qty: number;
  /** TRUE if this lot already has ANY ledger history. Such a lot is never seeded. */
  hasHistory: boolean;
  /** TRUE if the QuickBooks import created it (`import_run_id IS NOT NULL`). In TEST mode only
   *  these are seeded; a row somebody made by hand is never touched there. */
  imported?: boolean;
  /** 🔴 WHAT THE OWNER'S BOOKS SAY THIS IS — `qb_item_type` and `qb_income_account`, stored by
   *  the import since `20260920b`. The ACCOUNT leads and the type assists: at LAWNS 91 of 134
   *  `Service`-typed rows are real plants, so type alone would withhold stock from trees. */
  qbType?: string | null;
  qbIncomeAccount?: string | null;
  /** 🔴 THE OWNER'S OWN "this is not stock" OVERRIDE for this row, read from her settings — NOT a
   *  list in code (David, 2026-09-22). Some rows are MISBOOKED in QuickBooks: a Gift Certificate
   *  filed under Sales of Nursery Stock reads as a tree to any rule that believes the books. The
   *  override is how she says otherwise until the books are corrected at source, and each entry
   *  carries its reason so nobody later wonders why a row is held back. */
  notStockOverride?: boolean;
  /** Both are needed to recognise a DISCOUNT row, which `isDiscountItem` reads by name, text
   *  and a negative price — a discount seeded to 10 is stock that can never be picked. */
  description?: string | null;
  sellPrice?: number | null;
}

export interface SeedStep {
  lotId: string;
  name: string;
  /** ABSOLUTE target on-hand. Both inventory RPCs take an absolute qty and derive the delta
   *  themselves under a `FOR UPDATE` lock — we never pass a delta (reconcileMath's own rule). */
  newQty: number;
  kind: typeof SEED_LEDGER_KIND;
  reason: string;
  /** 🔴 FALSE IN TEST MODE: the step sets qty and appends NOTHING to the ledger (ruling ②). */
  writesLedger: boolean;
}

export type SeedPlan =
  | { ok: true; mode: SeedMode; steps: SeedStep[]; skipped: { withStock: number; withHistory: number; notImported: number; notAProduct: number; underProduction: number; markedNotStock: number } }
  | { ok: false; error: string };

/**
 * The ordered writes a seed performs. PURE — the screen makes the calls.
 *
 * 🔴 TWO POPULATIONS ARE EXCLUDED AND BOTH EXCLUSIONS ARE COUNTED RATHER THAN SILENT.
 *   · **a lot that already holds stock** — seeding it would overwrite a real number with a
 *     placeholder, which is the one thing this must never do;
 *   · **a lot with any ledger history** — something has already happened to it, so its zero is a
 *     measured zero (it sold out) and not an unknown. Replacing a measured zero with a
 *     placeholder would erase the only true quantity on the row.
 * The counts are returned so the screen can say *"1 of your 648 already had stock"* instead of
 * quietly doing 647 of 648 (D-9 / A9 — an unexplained absence reads as a defect).
 */
export function planOpeningStockSeed(candidates: SeedCandidate[], qty: number, mode: SeedMode): SeedPlan {
  // 🔴 THE CAP IS CHECKED FIRST, IN BOTH MODES — a test-mode number is still a placeholder.
  const refusal = seedRefusal(qty);
  if (refusal !== null) return { ok: false, error: refusal };

  let withStock = 0, withHistory = 0, notImported = 0, notAProduct = 0, underProduction = 0, markedNotStock = 0;
  const steps: SeedStep[] = [];
  for (const c of candidates) {
    if (Number(c.qty ?? 0) > 0) { withStock++; continue; }
    if (c.hasHistory) { withHistory++; continue; }
    // 🔴 TEST MODE TOUCHES ONLY WHAT THE IMPORT MADE. `imported` must be TRUE, not merely truthy-
    // absent: a candidate built without the field is treated as hand-made and left alone.
    if (mode === 'test' && c.imported !== true) { notImported++; continue; }

    // ── 🔴 IS THIS A THING YOU SELL AT ALL? (tech-debt #352) ──────────────────────────────────
    // Twice in a row a reload gave "10 in stock" to trip charges, labour, discounts and
    // bookkeeping lines, and twice a hand-written migration took it off again. The rule is not a
    // name list — it is the one the Services review already applies, so the two screens cannot
    // disagree about what a row is (§6 r8): INCOME ACCOUNT FIRST, TYPE SECOND.
    //
    // ⚠️ AND IT ONLY RUNS WHEN THE BOOKS ACTUALLY SAID SOMETHING. Both fields are NULL on every
    // row imported before `20260920b`, and `classifyDestination` reads a missing account as an
    // unknown it will not call a product — so applying it blind would withhold a starting number
    // from the WHOLE catalogue the first time this ran. A row we know nothing about keeps the old
    // behaviour; silence is not evidence.
    // 🔴 THE OWNER'S OVERRIDE BEATS HER BOOKS, because she is correcting them. It is checked
    // FIRST so a misbooked row cannot be argued back in by an account name.
    if (c.notStockOverride === true) { markedNotStock++; continue; }

    const booksSaidSomething = (c.qbIncomeAccount ?? '').trim() !== '' || (c.qbType ?? '').trim() !== '';
    if (booksSaidSomething) {
      const read = classifyDestination({
        id: c.id, name: c.name, description: c.description ?? null,
        unitPrice: c.sellPrice ?? null, type: c.qbType ?? null,
        incomeAccountName: c.qbIncomeAccount ?? null,
      });
      // 🔴 A GOODS ACCOUNT IS STOCK FOR THIS QUESTION (David, 2026-09-22). The Services review
      // calls "Sales of Product Income" ambiguous and refuses to tick it, because it cannot tell
      // a bag from a service for PRICING. The seed asks something narrower — is it on a shelf —
      // and for 43 LAWNS rows (compost, fertiliser, bubblers, staking kits, T-posts) the answer
      // is plainly yes. Without this, those 43 would keep a 0 they never earned.
      const goodsIsStock = isGoodsAccount(c.qbIncomeAccount);
      // 🔴 AND A POSITIVELY-PRICED ROW BOOKED TO PLANT STOCK IS STOCK, WHATEVER IT IS CALLED.
      // `classifyDestination` tests the NAME for discount words before it reads the account —
      // correct for the services review, wrong here: LAWNS sells three trees called "Discounted
      // Live Oak" at $200, $250 and $300, booked to Sales of Nursery Stock. Reading the name
      // first would leave real trees at zero on a shelf that has them. The price guard is what
      // keeps a REAL discount out: LAWNS's discount rows are priced 0 or negative, never above.
      const pricedStock = isStockAccount(c.qbIncomeAccount) && (c.sellPrice ?? 0) > 0;
      if (read.destination !== DESTINATIONS.product && !goodsIsStock && !pricedStock) { notAProduct++; continue; }
    }

    // ── 🔴 AND IS IT FINISHED? (David, 2026-09-18) ────────────────────────────────────────────
    // 75 LAWNS rows carry "(UNDER PRODUCTION)" in the name. They are booked to Sales of Nursery
    // Stock, so the account rule above calls them products — correctly, because they WILL be one.
    // They are not sellable yet: David ruled they belong on the grow ladder, not in inventory.
    //
    // ⚠️ THIS IS A NAME MARKER AND IT IS ONE ON PURPOSE, RECORDED AS DEBT RATHER THAN DRESSED UP:
    // there is no column anywhere that says a row is still growing, so the owner's own convention
    // in the NAME is the only signal that exists today. It is the weakest kind of rule we have —
    // a rename silently changes behaviour — and it should be replaced by a real state the moment
    // one exists (the grow ladder's own, when it lands).
    if (UNDER_PRODUCTION.test(c.name)) { underProduction++; continue; }
    steps.push({
      lotId: c.id,
      name: c.name,
      newQty: qty,
      kind: SEED_LEDGER_KIND,
      // The human-readable half of the ledger row. D-50: a reason cannot be derived or
      // backfilled, so it is written at the moment the choice is made, in the owner's terms.
      reason: `Starting number chosen at setup — a placeholder, not a count`,
      writesLedger: mode === 'live',
    });
  }

  if (steps.length === 0) {
    return { ok: false, error: mode === 'test'
      ? 'Nothing to start — in test mode only products your QuickBooks import created are given a starting number, and every one of those already holds stock or has been counted or sold.'
      : 'Nothing to start — every product either already holds stock or has already been counted or sold.' };
  }
  return { ok: true, mode, steps, skipped: { withStock, withHistory, notImported, notAProduct, underProduction, markedNotStock } };
}
