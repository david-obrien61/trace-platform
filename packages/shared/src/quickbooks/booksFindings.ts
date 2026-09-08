// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: read what is actually in a business's own QuickBooks and say, in sentences its
//   owner would use, what is in there. Twelve questions, evaluated as DATA — a rule is a row
//   in a list, not a branch in a function — so a rule can be added, re-ordered or reported as
//   unmeasurable without touching the walk that feeds it.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow · DiscountBreakdown) · ./itemList (QboItemRow) ·
//   ./customerList (CustomerBreakdown) · ./shipmentIngest (QboShipmentRow). Pure: no db, no
//   network, no env, no clock it did not receive.
// OUTPUTS: FindingTier · Finding · FindingRow · FindingWindow · FINDING_ROW_LIMIT · BooksInput ·
//   BOOKS_RULES · RETIRED_RULE_IDS · evaluateBooks.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 FOUR CONSTRAINTS, AND EACH IS STRUCTURAL RATHER THAN PROMISED.
// ══════════════════════════════════════════════════════════════════════════════════════════
//
// ① **NO FINDING CAN BLOCK ANYTHING.** There is no `blocking` field, no `severity` that a
//    caller could threshold on, and no rule returns anything a caller could refuse on. If a
//    finding could stop the import, Lauren is stuck at 4pm on a Friday and phones David — and
//    the build has failed regardless of how good the finding was. Validation here is
//    ACKNOWLEDGEMENT, not correction.
//
// ② **THE ORDER IS MONEY → RISK → TIDINESS, NEVER WORST-FIRST.** Twelve things wrong with
//    her books, sorted by how wrong they are, reads as an audit of her work. Sorted by what
//    they are worth to her, it reads as help. `evaluateBooks` sorts by TIER and then by the
//    rules' own declared order — never by count, never by dollar size. Being useful comes
//    before asking for anything.
//
// ③ **EVERY FINDING NAMES ITS POPULATION.** `matched` AND `of`. "22 of 1,469 invoices", never
//    "some invoices". A rule that matched nothing over a population of ZERO did not pass — it
//    was never measured, and `measured: false` says so. A pass over an empty set is a failure.
//
// ④ **THE REVIEW SPANS THREE SEPARATE WALKS AND EVERY RULE DECLARES WHICH IT NEEDS** (R-24).
//    The price card is on the Item walk, duplicate customers on the Customer walk, the money
//    on the Invoice walk. A rule whose walk is absent reports `not-measured` WITH THE WALK
//    NAMED — it does not quietly return zero, because "no problems found" and "we did not
//    look" are the two answers a reader cannot tell apart unless the code refuses to conflate
//    them (D-9 / A9).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 AND EVERY QUOTED FIGURE IS CARRIED BESIDE THE MEASURED ONE, SO THE DRIFT IS VISIBLE.
// ══════════════════════════════════════════════════════════════════════════════════════════
//   The sixteen numbers in this file's `quoted` fields come from an analysis of the 29 August
//   capture. NONE of them was re-measured before being written here, they predate the ingest,
//   and by the time anyone reads this they are older still. A stale number restated as a
//   current fact is R-26 — a declaration nobody checked, steering a decision — and the fix is
//   not to delete them (they are useful: a large gap is itself a finding) but to make it
//   impossible to read one without the measurement beside it. `Finding.quoted` is
//   deliberately typed as a STRING, not a number: it is a QUOTE, and it must never be
//   arithmetically compared with the measurement as though the two were the same kind of thing.
//
// 🔴 THREE RULES CANNOT BE COMPUTED AND SAY SO RATHER THAN GUESSING. Trip-charge coverage and
//   discount ELIGIBILITY need vocabulary and policy this platform has not been told — which
//   item means "trip charge", and which customers qualified for which discount. Inferring
//   either from item names would be exactly the retro-classification R-50 forbids: it would
//   work on today's rows and be a rule nobody agreed to. They ship as `needs-input` findings
//   naming what is missing, because a question we cannot answer is a finding, not a silence.
// ─────────────────────────────────────────────────────────────────────────────
import type { QboInvoiceRow, DiscountBreakdown } from './invoiceList';
import { itemPercentOf } from '../business-logic/discountReview';
import type { QboItemRow } from './itemList';
import type { CustomerBreakdown, QboCustomerRow } from './customerList';
import { QBO_DETAIL_TYPE } from './invoiceLineShapes';
import { findDuplicateParties, DUP_AXES } from '../customers/duplicateParties';
import { censusGiveawayLines, GIVEAWAY_SHAPES } from './giveawayLines';
import { censusSameDocuments } from './sameDocument';
import { censusSizeReadability, censusCollisions } from './catalogueCensus';
import { censusDispatchDates } from './dispatchCensus';

/** Money before risk before tidiness. The array order IS the sort order. */
export const FINDING_TIERS = ['money', 'risk', 'tidiness'] as const;
export type FindingTier = (typeof FINDING_TIERS)[number];

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 THE EIGHT SHAPES. THESE ARE THE PRODUCT; THE FINDINGS ARE WHAT FALLS OUT OF THEM.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * A list of things found at one nursery makes the second customer's report worse — it would be
 * written by hand again, and it would find only what the first business happened to be doing
 * wrong. Encoding the SHAPE instead means the second customer gets a BETTER report than the
 * first, because their data trips rules the first one never did.
 *
 * ⚠️ THE TEST EVERY SHAPE MUST PASS: it is expressible WITHOUT NAMING A VERTICAL. No tree, no
 * gallon, no nursery. A shape that needs one of those words is a single business's finding
 * wearing a rule's clothes, and it will not survive contact with customer two. There is a probe
 * that holds this file to it rather than leaving it to a reader's discretion.
 */
export const SHAPES = {
  'two-sources-disagree':      'Two sources that should agree, and do not',
  'prose-not-a-field':         'Announced in prose, where it should be a field',
  'reused-unique-value':       'A value used twice that should be unique',
  'written-never-read':        'Written and never read',
  'implausible-distribution':  'A distribution that should not look like that',
  'uncharged-money':           'Money that should have been charged and was not',
  'field-adopted-midway':      'A field adopted part-way through the history',
  'formula-breaks-where-it-matters': 'A formula that holds everywhere except where it matters',
} as const;

export type Shape = keyof typeof SHAPES;

/**
 * A finding says THIS IS TRUE. A recommendation says: this is costing you, here is the fix,
 * here is what the fix costs, and here is the payback — all four, computed from their own
 * numbers.
 *
 * 🔴 A RECOMMENDATION WITH NO NUMBER IS AN OPINION. If the arithmetic cannot be done from their
 * books it stays a FINDING, and this field is absent. Nothing here may be authored.
 */
export interface Recommendation {
  /** What carrying on unchanged costs, over the period actually read. Computed. */
  statusQuoCost: number;
  /** The fix, in one sentence an owner would say. */
  remedy: string;
  /**
   * What the fix costs. 🔴 ZERO IS A REAL ANSWER AND IS STATED RATHER THAN HIDDEN — a remedy
   * that is a decision rather than a purchase genuinely costs nothing, and saying so plainly is
   * more honest than omitting the field and letting the reader wonder what was left out.
   */
  remedyCost: number;
  /** Whole months until the remedy pays for itself. 0 = immediately. */
  paybackMonths: number;
  /**
   * ⚠️ WHAT IT DOES NOT FIX. A recommendation that hides its limits gets found out on day two,
   * and then none of the others are believed either.
   */
  limits: string;
}

/** Which of the three reads a rule needs. R-24: they are not one walk and must not pretend to be. */
export type Walk = 'items' | 'customers' | 'invoices';

const WALK_LABEL: Record<Walk, string> = {
  items:     'your list of products & services',
  customers: 'your customer list',
  invoices:  'your invoice history',
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 ONE RECORD BEHIND A FINDING. THE ROWS ARE WHAT TURN 52 INTO 72.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * A count is a claim; the rows are the evidence, and without them a rule can only ever compare
 * tallies. The duplicate-customer rule read `max(byEmail, byPhone)` for exactly this reason — it
 * had two numbers and no records, and a UNION cannot be computed from two numbers.
 *
 * ⚠️ **THEY GO ON THE SCREEN AND NEVER ON THE PAPER (David's ruling, 2026-09-08).** The PDF says
 * *"we identified X potential duplicates — review your customers in Cultivar"* and carries not one
 * customer name; `renderBooksReportHtml` never reads this field, and there is a probe that fails if
 * a row label ever reaches the HTML. A count in a document an accountant keeps is analysis; a list
 * of a customer's customers in the same document is a data export nobody asked for.
 */
export interface FindingRow {
  /** The record's own id in the source system. Stable, and never rendered. */
  id: string;
  /** What a person would recognise. On a customer this is a NAME — screen only. */
  label: string;
  /** Records that belong together (one duplicate cluster). Null when rows stand alone. */
  group: string | null;
  /** Why this row is here, in one phrase — the axis, the reason. Never a field name. */
  note: string | null;
}

/**
 * 🔴 THE PERIOD A FINDING IS A FACT ABOUT — **COMPUTED FROM THE WALK, NEVER TYPED.**
 *
 * *"853 customers never bought"* and *"853 customers did not buy in the period we read"* are
 * different statements, and only the second one is true. The read is a window onto somebody's
 * business, and a finding that forgets to say so is making a claim about the years on either side
 * of it that nobody measured. `from`/`to` are the earliest and latest transaction dates in the
 * invoice walk — the walk's OWN extent, so it cannot be stated wrongly and cannot go stale.
 */
export interface FindingWindow {
  from: string;
  to: string;
  /** What the window is over, in the owner's words. */
  of: string;
}

/**
 * The cap on `rows`, enforced by the runner and not by any rule.
 *
 * 🔴 IT LIVES HERE FOR THE SAME REASON `CUSTOMER_PREVIEW_LIMIT` LIVES IN `customerList`: a limit
 * that lives in the caller is a limit one future caller forgets, and the failure mode is 1,900
 * real people painted onto a screen. A rule may return every row it found; only this many travel.
 */
export const FINDING_ROW_LIMIT = 200;

/**
 * 🔴 IDS THAT ONCE MEANT SOMETHING AND MUST NEVER BE REUSED.
 *
 * A rule whose DEFINITION changes gets a NEW id — never a new definition under the old one —
 * because stored results are compared on `(rule_id, rule_version)` and an id that has meant two
 * things makes every comparison across it a lie. These four were retired on 2026-09-08; each one's
 * reasoning sits at the site where it used to be, and a probe fails if any of them reappears in
 * `BOOKS_RULES`.
 */
export const RETIRED_RULE_IDS = [
  'duplicate-invoice-numbers',
  'invoices-without-delivery-date',
  'possible-duplicate-customers',
  'customers-with-no-contact',
] as const;

export interface Finding {
  id: string;
  /**
   * 🔴 THE RULE'S OWN VERSION, AND THE OTHER HALF OF THE COMPARISON KEY. Two runs of this review
   * are compared on `(id, version)` — the number that proves the product works is *"33 last month,
   * 13 today"*, and that comparison is worthless if the question changed underneath it. Bump this
   * for a change that leaves the QUESTION the same (wording, a widened denominator); mint a NEW ID
   * for a change that asks a different question. See `RETIRED_RULE_IDS`.
   */
  version: number;
  tier: FindingTier;
  /** Which of the eight shapes this rule is an instance of. Every rule states one. */
  shape: Shape;
  /**
   * 🔴 MONEY AT STAKE, COMPUTED FROM THEIR OWN NUMBERS — never a hardcoded weight and never a
   * proxy for how bad the finding is. It is what orders the list.
   *
   * `null` means this finding is not expressible in money (a duplicate customer is a real
   * problem and not a dollar figure). Null sorts LAST within its tier rather than as zero —
   * "worth nothing" and "not a money question" are different answers.
   */
  value: number | null;
  /** Present only when all four parts could be computed. See `Recommendation`. */
  recommendation: Recommendation | null;
  /** ONE sentence an owner understands. No field names, no `DocNumber`, no `UnitPrice`. */
  sentence: string;
  /** How many matched, and OUT OF WHAT. Both, always. */
  population: { matched: number; of: number; noun: string };
  /**
   * `false` when the rule could not run — its walk was not read, or the population was zero.
   * A rule that did not run is NOT a rule that found nothing.
   */
  measured: boolean;
  /** Named when `measured` is false, so the reader knows what to do about it. */
  notMeasured: string | null;
  /** The 2026-09-03 re-measurement of the quoted figure, where one was done. See `Rule`. */
  remeasured: string | null;
  /** The 29 August figure, VERBATIM, as a quote. Never compared arithmetically. */
  quoted: string;
  /**
   * The two findings that need Lauren's ANSWER rather than her acknowledgement. Everything
   * else is a thing she is being TOLD. A screen that asks twelve questions gets none answered.
   */
  needsAnswer: null | { question: string; options: string[] };
  /**
   * The records behind the count, capped at `FINDING_ROW_LIMIT`. **Screen only** — see `FindingRow`.
   * `null` when the rule has no rows to show, which is most of them: a count of income accounts has
   * no records a person would want to look at.
   */
  rows: FindingRow[] | null;
  /** How many rows the rule actually found, so a capped list can say *"showing 200 of 412"*
   *  rather than quietly presenting a subset as the whole answer. */
  rowsTotal: number;
  /** The period this finding is a fact about. See `FindingWindow`. Null when the finding is not
   *  about a period at all — a duplicate customer is a duplicate whatever the dates say. */
  window: FindingWindow | null;
  /**
   * 🔴 WHAT THIS SWITCHES OFF — **CAPABILITY NAMES, NEVER FAULT DESCRIPTIONS** (David, 2026-09-08).
   * *"Campaigns"* and *"Review requests"*, not *"125 customers have no contact details"*. The
   * finding already says what is true; this says what the business cannot do until it changes,
   * which is the half an owner can act on. Empty is the ordinary case and means nothing is blocked.
   */
  blocks: string[];
  /**
   * 🔴 THE RULE RAN AND FOUND NOTHING — **AND THAT RENDERS AS LOUDLY AS A FAULT.**
   *
   * A review that only shows problems teaches its reader that every line is a problem, and then
   * *"no duplicate invoices"* — a real, checked, earned result — is invisible. It is also the only
   * thing that makes the second run mean anything: a finding that was there and is now clean is the
   * product working, and it cannot be seen if clean findings are filtered out.
   *
   * ⚠️ IT IS NOT `matched === 0`. A rule that could not run has matched 0 as well, and calling that
   * clean would let an empty read certify a business. `clean` requires `measured`.
   */
  clean: boolean;
}

export interface BooksInput {
  /** Absent = that walk was not run. NOT an empty array — the distinction is the point. */
  items?: QboItemRow[];
  customers?: CustomerBreakdown;
  /**
   * 🔴 THE CUSTOMER RECORDS THEMSELVES — PARSED IN THE BROWSER FROM THE CAPTURE IT ALREADY HOLDS,
   * exactly as the invoices are, and for the same reason: a UNION cannot be computed from two
   * counts. The customer endpoint deliberately sends only a breakdown; the verbatim bodies travel
   * inside `capture` because the browser writes them to the operator's file, so parsing them here
   * costs no second read of a customer's book of customers and mints no `api/` function.
   *
   * ⚠️ ABSENT WHILE `customers` IS PRESENT IS A REAL AND REACHABLE STATE — a saved capture read
   * back through a path that summarised without keeping the rows. A rule needing rows then reports
   * itself uncomputed WITH ITS REASON rather than falling back to the weaker count, because a
   * silently weaker answer is the failure this whole file is built to refuse.
   */
  customerRows?: QboCustomerRow[];
  invoices?: QboInvoiceRow[];
  discounts?: DiscountBreakdown;
  /** Invoice id → whether the invoice carried a ShipDate. From the shipment walk. */
  shipDates?: Map<string, string | null>;
  /**
   * 🔴 THE DATE THE BOOKS WERE READ, `YYYY-MM-DD` — SUPPLIED, NEVER TAKEN FROM THE CLOCK.
   * Only the receivables rule needs it, and it needs it to mean *"past due as at the moment
   * this read happened"*. Reading `new Date()` here would make the same capture produce a
   * different answer tomorrow, and would make the finding untestable — a rule whose output
   * moves on its own cannot be probed (R-33). Absent = the rule reports itself uncomputed,
   * which is the honest answer rather than a silent substitution of today.
   */
  asOf?: string;
}

interface Rule {
  id: string;
  /** See `Finding.version`. Required — a rule with no version cannot be compared across runs. */
  version: number;
  tier: FindingTier;
  shape: Shape;
  needs: Walk[];
  /** Capability names this finding switches off. See `Finding.blocks`. Absent = nothing blocked. */
  blocks?: string[];
  /** What the 2026-08-29 analysis claimed. NEVER edited — it is the claim, not the answer. */
  quoted: string;
  /**
   * 🔴 WHAT THE SAME CAPTURE ACTUALLY SAYS, MEASURED 2026-09-03, AND WHY BOTH ARE KEPT.
   * David: *"Correct every one to your measurement and record BOTH values."* Overwriting
   * `quoted` would erase the drift and leave a corrected number nobody could tell had ever
   * been wrong — which is how a figure gets quoted confidently for a second time. Ten of the
   * 2026-08-29 figures were wrong, stale, or measured over an unstated population; fourteen
   * were exact. **Both outcomes are recorded, because "we checked and it held" is a result.**
   */
  remeasured?: string;
  /**
   * Shown when `run` returns null. Without it the runner uses its generic "only you can tell
   * us" sentence — true for a rule blocked on POLICY, wrong for one blocked on a field we did
   * not read. Those are different problems with different next steps, and a reader cannot act
   * on the wrong one.
   */
  cannotCompute?: string;
  /** Returns the measured half. `of` of zero is reported as not-measured by the runner. */
  run: (x: BooksInput) => { matched: number; of: number; noun: string; sentence: string;
                            needsAnswer?: { question: string; options: string[] };
                            /** Money at stake, computed. Omit when the finding is not a money question. */
                            value?: number | null;
                            recommendation?: Recommendation;
                            /** Screen-only evidence. The runner caps it; a rule returns all it found. */
                            rows?: FindingRow[] } | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Whole dollars. An owner reads $614,053, not 614052.87 — and never a bare number. */
const money = (n: number): string => `$${Math.round(n).toLocaleString()}`;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const pct = (n: number, of: number): string => `${of === 0 ? 0 : Math.round((n / of) * 100)}%`;

const plural = (n: number, one: string, many: string): string => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * The goods lines of an invoice: something was sold, at a stated price, in a stated quantity.
 *
 * ⚠️ IT REQUIRES A NON-NULL `unitPrice`, WHICH IS THE WHOLE FILTER. A DescriptionOnly note, a
 * subtotal and a discount line all have no unit price, and every pricing rule below would
 * otherwise treat them as sales at $0 — manufacturing the very "sold below list" finding it is
 * measuring. `unitPrice` is READ, never derived from amount/qty (see invoiceList.ts).
 */
function pricedLines(inv: QboInvoiceRow) {
  return inv.lines.filter(l => l.itemName !== null && l.unitPrice !== null && (l.amount ?? 0) > 0);
}

// ── the rules, in tier order ─────────────────────────────────────────────────

export const BOOKS_RULES: Rule[] = [

  // ══ MONEY ═════════════════════════════════════════════════════════════════
  {
    id: 'trip-charge-missing', version: 1, tier: 'money', shape: 'uncharged-money', needs: ['invoices'],
    quoted: '40 invoices, about $6,000',
    remeasured: 'NOT COMPUTABLE — and the quoted rate is not in their catalogue. The five delivery-shaped items are $125, $75, $50, $0 and $0; none is the $150 the $6,000 was priced at.',
    // 🔴 DELIBERATELY UNCOMPUTED, AND THIS IS THE HONEST ANSWER RATHER THAN A LAZY ONE. The
    // rule needs to know WHICH ITEM MEANS "trip charge" in these books. Guessing it from item
    // names would produce a number that happens to be right on the rows we have looked at and
    // is a rule nobody agreed to — R-50's retro-classification, arriving as a helpful default.
    // The question goes to the owner, who knows.
    run: () => null,
  },
  {
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 WITHDRAWN 2026-09-03 BY DAVID'S RULING. IT WAS TWO FINDINGS WEARING ONE SENTENCE.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // It was WORDED about the business's PUBLISHED PRICE CARD and COMPUTED against the
    // QuickBooks `UnitPrice`. Those are different floors, and only one of them is what the
    // sentence claimed. David: *"WITHDRAW the rule until it compares against the published
    // card. That is the finding David measured — 53 rows, 32 items, 230 sales — and it needs
    // the card, which these three reads do not carry."*
    //
    // 🔴 WHY WITHDRAWING MATTERED RATHER THAN RE-WORDING. Measured over LAWNS's 2026-08-29
    // capture it produced **$1,607,416 — 52% of their $3,187,796 of revenue** — and under R-66
    // (money-at-stake ordering) that sorts it FIRST, as the opening line of the document an
    // owner hands their accountant. David: *"Hand Terry that on page one and the report loses
    // its credibility before he reaches anything true."*
    //
    // ⚠️ THE HONEST SUCCESSOR IS THE NEXT RULE, AND IT IS A DIFFERENT RULE WITH A DIFFERENT
    // NAME — not this one repaired. Keeping this id alive with new arithmetic would leave the
    // corpus with one id that has meant two things.
    id: 'sold-below-price-card', version: 1, tier: 'money', shape: 'two-sources-disagree', needs: ['items', 'invoices'],
    quoted: '53 rows, 32 items, 230 sales',
    remeasured: 'NOT COMPUTABLE from these three reads — it needs the printed price card, which they do not carry.',
    cannotCompute: 'We cannot check your sales against your printed price list, because we have not been given it. What we can check is the price recorded on each product in QuickBooks, and that is the next line — it is not the same thing, and it should not be read as if it were.',
    run: () => null,
  },
  {
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 THE SUCCESSOR RULE, AND IT SAYS EXACTLY WHICH FLOOR IT USES IN ITS OWN SENTENCE.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // Two corrections David ruled into it, both of which change the number:
    //
    //   ① **A GIVEAWAY IS NOT A DISCOUNT.** 74 lines were charged exactly $0 and each was
    //      counted at its FULL list price, so a comped tree scored as the largest possible
    //      shortfall. Those lines are EXCLUDED and the exclusion is stated in `limits` — a
    //      line removed silently is a line the reader assumes was never there.
    //
    //   ② **PER-LINE OR PER-UNIT IS A CHOICE, AND THE REPORT MUST PICK ONE AND SAY WHICH.**
    //      The same books give **$761,504 per line** and **$1,657,696 once quantity is
    //      applied** — one fact told two ways, and 36 bulk lines carry the difference.
    //      🔴 **PER-LINE IS TAKEN.** Multiplying by quantity turns deliberate volume pricing
    //      into a headline loss, which is what made the withdrawn rule unshippable. The basis
    //      is NAMED in the sentence, not buried in a footnote.
    //
    // ⚠️ AND THE NUMBER UNDERNEATH IT, WHICH SURVIVES EITHER FRAMING: the median charged/list
    // ratio is **0.87**. That is the useful figure — the typical sale is 13% under the recorded
    // price — and it is reported BESIDE the total so a reader has a shape, not just a sum.
    id: 'sold-below-quickbooks-list', version: 1, tier: 'money', shape: 'two-sources-disagree', needs: ['items', 'invoices'],
    quoted: 'measured 2026-09-03: 1,966 lines, $761,504 per line',
    run: (x) => {
      if (!x.items || !x.invoices) return null;
      // Only items that PUBLISH a price are in the card. An item with no price has no floor,
      // and comparing against a null-read-as-zero would put every sale "at or above list".
      const card = new Map<string, number>();
      for (const it of x.items) if (it.unitPrice !== null) card.set(it.id, it.unitPrice);

      let below = 0, comparable = 0, shortfall = 0, freeLines = 0;
      const products = new Set<string>();
      const months = new Set<string>();
      const ratios: number[] = [];
      for (const inv of x.invoices) {
        // 🔴 THE GIVEAWAYS ARE COUNTED HERE, OFF THE RAW LINES, BECAUSE THAT IS WHERE THEY
        // STILL EXIST. Measured against the real capture: all 74 zero-priced lines carry an
        // AMOUNT of $0 too, so `pricedLines` — which requires `amount > 0` — has already
        // dropped every one of them before the loop below ever sees it. Counting them inside
        // that loop produced `freeLines === 0` and a `limits` sentence claiming an exclusion
        // that was doing nothing. **The exclusion was already correct; the REPORTING of it was
        // the lie**, and a sentence describing a filter that never fires is worse than silence.
        for (const l of inv.lines) {
          if (l.itemId === null || !card.has(l.itemId)) continue;
          if (l.unitPrice === 0) freeLines++;
        }
        for (const l of pricedLines(inv)) {
          const floor = l.itemId === null ? undefined : card.get(l.itemId);
          if (floor === undefined || floor <= 0) continue;   // no published price → not comparable
          const charged = l.unitPrice as number;
          // ① A GIVEAWAY IS NOT A DISCOUNT — never scored as a shortfall. Today `pricedLines`
          // has already removed every such line (see the count above), so this is a DEFENSIVE
          // guard for the shape that has not appeared yet: a $0 unit price on a line carrying a
          // positive amount. It is reachable, so it is probed.
          if (charged === 0) continue;
          comparable++;
          ratios.push(charged / floor);
          if (charged < floor) {
            below++;
            if (l.itemName) products.add(l.itemName);
            // ② PER LINE. No `* qty` — see the note above.
            shortfall += floor - charged;
            if (inv.txnDate) months.add(inv.txnDate.slice(0, 7));
          }
        }
      }
      if (comparable === 0) return null;
      ratios.sort((a, b) => a - b);
      const median = ratios[Math.floor(ratios.length / 2)];
      const span = Math.max(1, months.size);
      const recommendation = below === 0 ? undefined : {
        statusQuoCost: shortfall,
        remedy: 'Either charge the price recorded on the product, or change the recorded price to what you actually mean to charge. Today the two disagree and the invoice wins, so the recorded price is not telling you anything.',
        remedyCost: 0,
        paybackMonths: 0,
        limits: `This compares each sale against the price recorded on that product in QuickBooks — NOT against a printed price list, which we have not been given. It counts the gap ONCE PER LINE, not per item sold, so a discount given on fifty trees counts once. ${plural(freeLines, 'line that was', 'lines that were')} charged nothing at all ${freeLines === 1 ? 'is' : 'are'} left out entirely, because giving something away is a decision and not a pricing mistake. Many of the rest will be deliberate too.`,
      };
      return {
        matched: below, of: comparable, noun: 'sales we could compare against a recorded price',
        // 🔴 THE FINDING LEADS, THE TOTAL SUPPORTS IT (David, 2026-09-03). Read the other way
        // round an owner sees $724,273 first and hears *"you lost three-quarters of a million
        // dollars"*; what the finding actually says is that they discount routinely by about
        // 13%, and that arrived LAST. Same numbers, opposite meaning — the ORDER of the clauses
        // is the finding, which is why it is not a presentation detail.
        sentence: `Across ${plural(span, 'month', 'months')}, people typically paid ${pct(Math.round(median * 100), 100)} of the price recorded in QuickBooks. ${plural(below, 'sale', 'sales')} on ${plural(products.size, 'product', 'products')} ${below === 1 ? 'was' : 'were'} charged below it, ${money(shortfall)} below in total, counted once per sale.`,
        value: shortfall,
        recommendation,
      };
    },
  },
  {
    id: 'discount-never-applied', version: 1, tier: 'money', shape: 'two-sources-disagree', needs: ['invoices', 'customers'],
    quoted: '7 customers',
    remeasured: 'NOT COMPUTABLE — it needs the discount policy, which is a rule about their business rather than a pattern in their data.',
    // Also deliberately uncomputed: it needs the POLICY — who qualifies for which discount.
    // That is a rule about their business, not a pattern in their data, and the data cannot
    // be made to yield it without inventing the policy first.
    run: () => null,
  },
  {
    id: 'discounts-that-do-not-work', version: 1, tier: 'money', shape: 'two-sources-disagree', needs: ['invoices', 'items'],
    quoted: '3 military, 2 broken',
    remeasured: 'RETIRED AND REPLACED 2026-09-07 — BOTH the original rule and its 2026-09-06 rewording rested on a base that was never read. See below.',
    // ══════════════════════════════════════════════════════════════════════════════════════════
    // ✏️ REWRITTEN 2026-09-07, AND THIS SUPERSEDES YESTERDAY'S REWORDING OF THE SAME RULE.
    //
    // 🔴 THE ORIGINAL RULE FIRED ON `verdicts.belowSubtotal`, AND THAT VERDICT WAS AN ARTIFACT.
    // It compared a discount line's `Qty` — believed to be the dollar base — against the invoice
    // subtotal. MEASURED against LAWNS's 1,481-invoice export: **`Qty` is 1 on every one of the 21
    // discount item lines.** So the comparison was "$1.00 is less than $3,650", which is trivially
    // true, and the rule reported **19 of 21 lines as computed on part of the invoice**. Its
    // companion field `excludedFromBase` — which was supposed to NAME the line accounting for the
    // gap — was **empty on every row**, and that emptiness was the tell nobody read.
    //
    // ⚠️ SO YESTERDAY'S CORRECTION WAS RIGHT ABOUT THE OUTCOME AND WRONG ABOUT THE REASON. It said
    // *"a base below the subtotal is the tree-only rule working"*; in fact no base was being read
    // at all. Not accusing an owner of a defect was the right call either way — but a rule kept on
    // a false premise is a rule that will mislead again, so it is replaced rather than reworded.
    //
    // 🔴 WHAT REPLACES IT IS MEASURED, NOT INFERRED. `DiscountLineDetail` carries `PercentBased`
    // and `DiscountPercent`, so on 67 of LAWNS's 88 discount lines **the rate is stated and there
    // is nothing to derive.** The finding is now: **a rate her books granted that no item in her
    // product list names** — on LAWNS, 20% on 4 lines worth $15,173, 25% once and 50% once, none
    // of them a named programme. That is a real question with a real number, and it needs no
    // assumption about what a discount was taken off.
    //
    // ⚠️ FIXED-DOLLAR DISCOUNTS ARE REPORTED AS MONEY AND NEVER GIVEN A PERCENT (6 lines,
    // $1,162.03) — the line does not say what it was a percentage of, and inventing a base is the
    // whole class of error this rule was rewritten for.
    // ══════════════════════════════════════════════════════════════════════════════════════════
    run: (x) => {
      if (!x.discounts) return null;
      const rates = x.discounts.byRate;
      const fixed = x.discounts.fixedDollar;
      if (rates.length === 0 && fixed.lines === 0) return null;

      // 🔴 THE PUBLISHED RATE IS READ BY `itemPercentOf`, NOT BY A SECOND COPY OF ITS RULE.
      // The first draft of this rule re-implemented it inline — negative fraction, `< 1` guard,
      // ×100 — which is the same OPERATION in two places (§6 r8), and the copy that drifts is
      // never the one you are looking at. That rule is exactly where the "18250%" family of
      // errors lives, so it gets one home and one set of probes.
      const published = (x.items ?? [])
        .map(i => itemPercentOf({ id: i.id, name: i.name, description: i.description, unitPrice: i.unitPrice }))
        .filter((p): p is number => p !== null);
      const unnamed = rates.filter(r => !published.some(p => Math.abs(p - r.pct) < 0.005));
      const unnamedMoney = unnamed.reduce((s, r) => s + r.amountTotal, 0);
      const unnamedLines = unnamed.reduce((s, r) => s + r.lines, 0);

      const list = unnamed
        .sort((a, b) => b.amountTotal - a.amountTotal)
        .map(r => `${r.pct}% (${plural(r.lines, 'time', 'times')}, ${money(r.amountTotal)})`)
        .join(', ');
      const fixedClause = fixed.lines === 0 ? ''
        : ` ${plural(fixed.lines, 'discount was', 'discounts were')} given as a flat amount rather than a percentage, ${money(fixed.amountTotal)} in total — those are reported as money because the invoice does not say what they were a percentage of.`;

      return {
        matched: unnamed.length, of: rates.length, noun: 'discount rates used on invoices',
        sentence: unnamed.length === 0
          ? `Every discount rate on your invoices matches a product in your list, so each one has a name.${fixedClause}`
          : `${plural(unnamedLines, 'discount was', 'discounts were')} given at ${list} — ${unnamed.length === 1 ? 'a rate' : 'rates'} that nothing in your product list names, ${money(unnamedMoney)} in total. Discounts at a named rate are not counted here.${fixedClause}`,
        value: unnamed.length === 0 ? null : unnamedMoney,
        needsAnswer: unnamed.length === 0 ? undefined : {
          question: 'These discounts were given at rates none of your products name. Add them as discount types, or were they one-offs?',
          options: ['Add them as discount types', 'They were one-offs — leave them', 'Leave them as they are for now'],
        },
      };
    },
  },

  // ══ RISK ══════════════════════════════════════════════════════════════════
  //
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 `duplicate-invoice-numbers` STOOD HERE AND IS RETIRED (David's ruling, 2026-09-08).
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // It reported *"44 invoices share an invoice number — 22 numbers are used more than once"* under
  // **Things worth knowing before they cause trouble**, and it was an OBSERVATION wearing a risk
  // heading. **Lauren confirmed the bookkeeper created those numbers deliberately, because the
  // invoices had been renamed** — the October-2025 cluster and the 5120s block are that, and
  // nothing else. A repeated number in these books is the fingerprint of a renumbering.
  //
  // David: *"Comparing one field can only produce noise. Mint a NEW rule that compares what makes
  // two invoices the same document — CUSTOMER, DATE, LINE ITEMS, TOTALS. All four match = a
  // finding. Any differ = nothing to report."* That rule is directly below, under a NEW ID: the
  // question and the denominator both changed, so reusing this one would leave the corpus with an
  // id that has meant two things. The retired id is listed in `RETIRED_RULE_IDS` and a probe fails
  // if it ever comes back.
  {
    id: 'same-document-recorded-twice', version: 1, tier: 'risk', shape: 'reused-unique-value', needs: ['invoices'],
    quoted: 'the retired rule quoted 22 numbers across 44 invoices',
    remeasured: 'ONE pair — of 29 same-customer-same-day groups exactly one agrees on its total, and all 22 repeated-number groups carry DIFFERENT totals. [STATED: a prior session\'s measurement against the 2026-09-03 capture; this build could not re-measure.]',
    run: (x) => {
      if (!x.invoices) return null;
      const c = censusSameDocuments(x.invoices);
      if (c.comparable === 0) return null;

      // The retired question, said out loud rather than silently dropped. A reader who was shown
      // "44 invoices share a number" last month and sees nothing about it now would reasonably
      // conclude we stopped looking — and the reason we stopped is itself the useful part.
      const numbersClause = c.repeatedNumberGroups === 0 ? ''
        : ` ${plural(c.repeatedNumberGroups, 'invoice number is', 'invoice numbers are')} used more than once, and ${c.repeatedNumberGroupsAgreeingOnTotal === 0 ? 'not one of those pairs charges the same amount' : `${c.repeatedNumberGroupsAgreeingOnTotal} of them also agree on the amount`} — a number reused on two different invoices is how a renumbering looks, so it is not counted here.`;
      const notComparableClause = c.notComparable === 0 ? ''
        : ` ${plural(c.notComparable, 'invoice has', 'invoices have')} no customer or no date, so ${c.notComparable === 1 ? 'it' : 'they'} could not be compared at all.`;

      return {
        matched: c.recordsInvolved, of: c.comparable, noun: 'invoices we could compare',
        sentence: c.groups.length === 0
          ? `No two invoices in your history record the same customer, the same day, the same items AND the same total, so nothing here looks like one job billed twice.${numbersClause}${notComparableClause}`
          : `${plural(c.recordsInvolved, 'invoice', 'invoices')} — ${plural(c.groups.length, 'pair', 'sets')} — record the same customer, the same day, the same items and the same total as another invoice. That may be a genuine repeat order; it is worth one look each.${numbersClause}${notComparableClause}`,
        // The invoice NUMBER is not personal data (R-77) and it is the only thing that lets an
        // owner find the record. The customer is referenced nowhere, in any form.
        rows: c.groups.flatMap(g => g.invoiceIds.map((id, i) => ({
          id,
          label: g.docNumbers[i] ? `Invoice ${g.docNumbers[i]}` : `Invoice (no number) · ${g.txnDate ?? 'undated'}`,
          group: g.invoiceIds[0],
          note: `${g.txnDate ?? 'no date'} · ${g.totalAmt === null ? 'no total recorded' : money(g.totalAmt)}`,
        }))),
      };
    },
  },
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 `invoices-without-delivery-date` STOOD HERE AND IS RETIRED. IT COUNTED COLLECTIONS AS GAPS.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // It said *"881 invoices do not record the date the plants went out, so there is no way to tell
  // when the job actually happened"* — of a business where **most orders are collected by the
  // customer**, and where an invoice with nothing to dispatch is CORRECT to carry no dispatch date.
  // [STATED — a prior session's measurement: of 888, **639 are collections carrying $722,526** and
  // **249 are genuinely undated**.] The old rule told an owner that three-fifths of her history was
  // broken when it was right, which is the fastest way to make her stop believing the rest of the
  // page. New id: the denominator changed from *all invoices* to *invoices where something left*.
  {
    id: 'dispatched-with-no-date', version: 1, tier: 'risk', shape: 'field-adopted-midway', needs: ['invoices'],
    blocks: ['Delivery scheduling from your history', 'Knowing when a job actually happened'],
    quoted: 'the retired rule quoted 881 of 1,469',
    remeasured: '249 genuinely undated; 639 are collections carrying $722,526. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.invoices || !x.shipDates) return null;
      const c = censusDispatchDates(x.invoices, x.shipDates);
      if (c.seen === 0) return null;
      const undated = c.collectedWithoutDate + c.dispatchedWithoutDate;
      return {
        matched: c.dispatchedWithoutDate, of: c.seen, noun: 'invoices',
        // 🔴 THE PREDICATE IS IN THE SENTENCE, NOT IN A FOOTNOTE. The whole finding is the
        // SEPARATION, and a reader who cannot see how we told the two apart has been handed a
        // number to trust rather than a number to check.
        sentence: `${plural(undated, 'invoice records', 'invoices record')} no date for going out. ${plural(c.collectedWithoutDate, 'of them is', 'of them are')} an order nobody delivered — no delivery charge, no planting — so there is nothing to date, and ${c.collectedWithoutDate === 1 ? 'it is' : 'they are'} ${money(c.collectedAmount)} of your sales recorded correctly. The ${plural(c.dispatchedWithoutDate, 'other one', 'other')} did go out, ${money(c.dispatchedAmount)} of work, and ${c.dispatchedWithoutDate === 1 ? 'it does not say' : 'they do not say'} when. That is at least — an order delivered as a favour, with nothing charged for it and nothing written down, reads here as a collection.`,
      };
    },
  },
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 `possible-duplicate-customers` STOOD HERE AND IS RETIRED. `max()` WAS NOT THE UNION.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // It read `Math.max(byEmail.recordsInvolved, byPhone.recordsInvolved)` off the breakdown and
  // said *"at least"*. Its own comment reasoned correctly that ADDING the two would double-count —
  // and then took the larger, which **silently discards every record that shares a phone with one
  // person and nothing with anybody else.** [STATED — a prior session's measurement: the real union
  // of the email and phone axes is **72 records, not 52**.] Neither sum nor max can be computed
  // from two counts. A union needs the ROWS, which is why this rule takes `customerRows`.
  //
  // 🔴 AND IT ADDS A THIRD AXIS THE OTHER TWO CANNOT SEE. Six of the ten duplicate pairs David
  // found by eye share neither an email nor a phone. `personNamesMatch` — the one identity engine,
  // reused and never re-implemented — finds the ones whose names are the SAME; see
  // `duplicateParties.ts` for exactly which of those six it can and cannot reach, and why no fuzzy
  // matcher was added here.
  {
    id: 'customers-entered-more-than-once', version: 1, tier: 'risk', shape: 'reused-unique-value', needs: ['customers'],
    quoted: 'the retired rule quoted about 72, and computed 54',
    remeasured: '72 records on the email/phone union alone. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    cannotCompute: 'We can see how many of your customer records share an email address or a phone number, but not WHICH ones — the records themselves were not kept from this read, and a list of who is who cannot be worked out from a count.',
    run: (x) => {
      // 🔴 IT REFUSES TO FALL BACK TO THE BREAKDOWN. The counts are right here in `x.customers`
      // and using them would produce a plausible, smaller, wrong number with no sign that anything
      // had been substituted. A weaker answer that looks like the real one is the failure this
      // whole file exists to refuse.
      if (!x.customerRows || x.customerRows.length === 0) return null;
      const groups = findDuplicateParties(x.customerRows.map(c => ({
        id: c.id, label: c.displayName, email: c.email, phone: c.phone, name: c.displayName,
      })));
      const records = groups.reduce((n, g) => n + g.members.length, 0);
      const axisNames = (g: typeof groups[number]) => g.axes.map(a => DUP_AXES[a]).join(' and ');
      return {
        matched: records, of: x.customerRows.length, noun: 'customer records',
        sentence: records === 0
          ? 'No two of your customer records share an email address, a phone number or a name, so nobody appears to be in your list twice.'
          : `${plural(records, 'customer record looks', 'customer records look')} like the same person or company entered more than once — ${plural(groups.length, 'set', 'sets')} in all, matched on a shared email address, a shared phone number, or the same name. Their history is split across the copies, so neither copy shows what that customer has actually spent.`,
        // 🔴 SCREEN ONLY. The report says how many and sends her here; the names are on the grid.
        rows: groups.flatMap(g => g.members.map(m => ({
          id: m.id, label: m.label, group: g.key, note: axisNames(g),
        }))),
        needsAnswer: records === 0 ? undefined : {
          question: 'Should we join these up, or keep them as separate customers?',
          options: ['Join them — they are the same people', 'Keep them separate', 'Show me the list first'],
        },
      };
    },
  },
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 `customers-with-no-contact` STOOD HERE AND IS RETIRED — REPLACED BY TWO CAPABILITY RULES.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // It said *"110 customers have no address, phone number or email, so there is no way to reach
  // them or deliver to them"* — one sentence covering two unrelated capabilities, worded as a
  // fault, leading with the smallest and worst number on the page.
  //
  // David's ruling, 2026-09-08: **say what is switched off, not what is missing** — and *"THE
  // HEADLINE IS 1,828 REACHABLE, NOT 125 UNREACHABLE. Their contact data is GOOD and the report
  // should say so first."* So: two rules, each naming the capability it is about, each LEADING
  // with what the business can do.
  //
  // ⚠️ AND THE TWO NUMBERS DISAGREE ON PURPOSE. 110 required no email AND no phone AND no address;
  // 125 is about being CONTACTABLE and ignores the address. Different questions — see
  // `CustomerCensus` in `customerList.ts`, where the difference is stated once.
  {
    id: 'contact-reach', version: 1, tier: 'risk', shape: 'implausible-distribution', needs: ['customers'],
    blocks: ['Campaigns', 'Review requests'],
    quoted: 'the retired rule quoted 110 of 1,927 with nothing at all',
    remeasured: 'email 1,730 · any phone 1,480 · either 1,828 · neither 125. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.customers) return null;
      const r = x.customers.census.reach;
      const t = x.customers.total;
      return {
        matched: r.withNeither, of: t, noun: 'customer records',
        sentence: `${plural(r.withEither, 'of your customers can', 'of your customers can')} be reached — ${plural(x.customers.withEmail, 'by email', 'by email')} and ${plural(x.customers.withPhone, 'by phone', 'by phone')}, ${plural(r.withBoth, 'of them both ways', 'of them both ways')}. That is ${pct(r.withEither, t)} of your list, and it is what campaigns and review requests run on. ${r.withNeither === 0 ? 'Every record has one or the other.' : `${plural(r.withNeither, 'record has', 'records have')} neither, so those two things are switched off for ${r.withNeither === 1 ? 'that one' : 'them'} and for nothing else.`}`,
      };
    },
  },
  {
    id: 'address-reach', version: 1, tier: 'risk', shape: 'implausible-distribution', needs: ['customers'],
    blocks: ['Delivery routing', 'Distance-based pricing'],
    quoted: 'not previously computed',
    remeasured: 'address line 1,455 · with postcode 1,120 · line but no postcode 335 · no address 498. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.customers) return null;
      const r = x.customers.census.reach;
      const t = x.customers.total;
      return {
        matched: r.withoutAddress, of: t, noun: 'customer records',
        // TWO RUNGS, AND THEY ARE NOT THE SAME CAPABILITY. A line is somewhere to drive to; a
        // postcode is something to measure from. A record with a town and no postcode has an
        // address by any ordinary count and can do only the first.
        sentence: `${plural(r.withAddressLine1, 'of your customers has', 'of your customers have')} a street address, which is what a delivery route needs — ${pct(r.withAddressLine1, t)} of your list. ${plural(r.withPostalCode, 'of those also carries', 'of those also carry')} a postcode, which is what pricing by distance needs. ${r.addressWithoutPostalCode === 0 ? '' : `${plural(r.addressWithoutPostalCode, 'address has', 'addresses have')} no postcode, so those can be driven to but not measured. `}${r.withoutAddress === 0 ? '' : `${plural(r.withoutAddress, 'record has', 'records have')} no address at all.`}`,
      };
    },
  },
  {
    // 🔴 THREE FIELDS, THREE DIFFERENT STRENGTHS OF EVIDENCE, AND ONLY ONE OF THEM IS EVIDENCE.
    // A customer flagged not-taxable stops tax being charged. A reason says why somebody did it.
    // A resale number is the only one an auditor would accept, and it is the one that is missing.
    id: 'tax-exemption-without-evidence', version: 1, tier: 'risk', shape: 'prose-not-a-field', needs: ['customers'],
    blocks: ['Proving a sales-tax exemption at audit'],
    quoted: 'not previously computed',
    remeasured: '27 not taxable · 27 with a reason · 9 with a resale number. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.customers) return null;
      const pw = x.customers.census.paperwork;
      if (pw.nonTaxable === 0) return null;
      const unevidenced = Math.max(0, pw.nonTaxable - pw.withResaleNumber);
      return {
        matched: unevidenced, of: pw.nonTaxable, noun: 'customers you do not charge sales tax',
        sentence: `${plural(pw.nonTaxable, 'customer is', 'customers are')} set up so no sales tax is charged, and ${plural(pw.withExemptionReason, 'of them records', 'of them record')} a reason. ${plural(pw.withResaleNumber, 'carries', 'carry')} a resale number — the only one of the three a tax auditor treats as evidence. ${unevidenced === 0 ? '' : `So ${plural(unevidenced, 'exemption rests', 'exemptions rest')} on a setting rather than on a document.`}`,
      };
    },
  },

  // ══ TIDINESS ══════════════════════════════════════════════════════════════
  {
    id: 'sold-at-more-than-one-price', version: 1, tier: 'tidiness', shape: 'implausible-distribution', needs: ['invoices'],
    quoted: '286 of 414',
    remeasured: 'CONFIRMED EXACT — 286 of 414.',
    run: (x) => {
      if (!x.invoices) return null;
      const prices = new Map<string, Set<number>>();
      for (const inv of x.invoices) {
        for (const l of pricedLines(inv)) {
          const key = l.itemName as string;
          if (!prices.has(key)) prices.set(key, new Set());
          // ROUNDED TO THE CENT before the set. Two lines that agree to the penny must not
          // count as two prices because of floating point — that would manufacture the finding.
          (prices.get(key) as Set<number>).add(Math.round((l.unitPrice as number) * 100));
        }
      }
      const varied = [...prices.values()].filter(s => s.size > 1).length;
      return {
        matched: varied, of: prices.size, noun: 'products that were sold at least once',
        sentence: `${plural(varied, 'product was', 'products were')} sold at more than one price. That may be exactly right — trade pricing, an old quote honoured — but it means the price on the item is not what people actually pay.`,
      };
    },
  },
  {
    id: 'income-accounts-in-use', version: 1, tier: 'tidiness', shape: 'implausible-distribution', needs: ['items'],
    quoted: '41 accounts',
    remeasured: '13 accounts across the 685 products, 9 of which appear on an invoice line. 41 is not derivable from any of the three reads.',
    run: (x) => {
      if (!x.items) return null;
      const accounts = new Set<string>();
      for (const it of x.items) if (it.incomeAccount) accounts.add(it.incomeAccount);
      return {
        matched: accounts.size, of: x.items.length, noun: 'products & services',
        sentence: `Your sales are split across ${plural(accounts.size, 'income account', 'income accounts')}. That decides how your profit and loss reads, so it is worth knowing how many there are.`,
      };
    },
  },
  {
    id: 'never-sold', version: 1, tier: 'tidiness', shape: 'written-never-read', needs: ['items', 'invoices'],
    quoted: 'not previously computed',
    run: (x) => {
      if (!x.items || !x.invoices) return null;
      const sold = new Set<string>();
      for (const inv of x.invoices) for (const l of inv.lines) if (l.itemId) sold.add(l.itemId);
      // Categories are FOLDERS in QuickBooks and can never appear on an invoice line, so
      // counting them as "never sold" would be counting a filing cabinet as unsold stock.
      const sellable = x.items.filter(it => (it.type ?? '').toLowerCase() !== 'category');
      const never = sellable.filter(it => !sold.has(it.id)).length;
      return {
        matched: never, of: sellable.length, noun: 'products & services',
        sentence: `${plural(never, 'item in your list has', 'items in your list have')} not been sold once in the whole of the history we read.`,
      };
    },
  },
  {
    // 🔴 A QUESTION ABOUT PEOPLE THAT ONLY THE INVOICES CAN ANSWER, AND THE WORDING IS THE WHOLE
    // CARE HERE. *"853 customers never bought"* is not something these books can support: they
    // cover a period, and a customer who bought the month before it began is indistinguishable
    // from one who never bought at all. `window` carries the period and the sentence names it.
    id: 'customers-with-no-purchase-in-the-period', version: 1, tier: 'tidiness',
    shape: 'implausible-distribution', needs: ['customers', 'invoices'],
    quoted: 'not previously computed',
    remeasured: '853 of 1,953 with no purchase in the period read; 1,100 bought. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.customers || !x.invoices) return null;
      const bought = new Set<string>();
      for (const inv of x.invoices) if (inv.customerId) bought.add(inv.customerId);
      const total = x.customers.total;
      // Buyers whose customer record is not in the list we read are NOT subtracted from the total —
      // the two walks can legitimately disagree (a record deleted since, a walk read on a different
      // day), and deriving one population from the other would hide that rather than show it.
      const withPurchase = Math.min(bought.size, total);
      const without = Math.max(0, total - withPurchase);
      return {
        matched: without, of: total, noun: 'customer records',
        sentence: `${plural(withPurchase, 'of your customers bought', 'of your customers bought')} something in the period we read. The other ${plural(without, 'record shows', 'records show')} no purchase in that period — which is not the same as never having bought, because your books before this period were not read.`,
      };
    },
  },
  {
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 THE 33 UNREADABLE SIZES ARE 15, AND THE OTHER 18 ARE NOT A SMALLER PROBLEM.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // A discount has no size. Neither does a trip charge or a refund. Reporting 33 sends an owner
    // to fix eighteen rows that are already correct — and it makes the one number that proves this
    // product works impossible to produce: **the 33 → 13 loop cannot work until the denominator
    // only contains rows that can actually be fixed**, because a permanent floor of 18 unfixable
    // rows means the count never reaches zero and she concludes the tool is broken.
    //
    // ⚠️ THIS DOES NOT CONTRADICT THE `33` ON THE CATALOGUE IMPORT SCREEN AND NEITHER SHOULD BE
    // EDITED TO MATCH THE OTHER — see the header of `catalogueCensus.ts`. Two questions over two
    // populations, both stated.
    id: 'sizes-we-could-not-read', version: 1, tier: 'tidiness',
    shape: 'implausible-distribution', needs: ['items'],
    quoted: '33 items',
    remeasured: '15 PRODUCTS · 10 services · 6 discounts · 2 not-a-sale. [STATED — a prior session\'s measurement against the 685-item capture.]',
    run: (x) => {
      if (!x.items) return null;
      const c = censusSizeReadability(x.items);
      if (c.products === 0) return null;
      const naClause = c.notApplicableTotal === 0 ? ''
        : ` A further ${plural(c.notApplicableTotal, 'row', 'rows')} in your list also carries no readable size — ${c.notApplicable.service} ${c.notApplicable.service === 1 ? 'is a service' : 'are services'}, ${c.notApplicable.discount} ${c.notApplicable.discount === 1 ? 'is a discount' : 'are discounts'}, ${c.notApplicable['not-a-sale']} ${c.notApplicable['not-a-sale'] === 1 ? 'is bookkeeping' : 'are bookkeeping'} — and ${c.notApplicableTotal === 1 ? 'it is' : 'they are'} not counted above, because a discount has no size and neither does a delivery charge. There is nothing to fix on ${c.notApplicableTotal === 1 ? 'it' : 'them'}.`;
      return {
        matched: c.productsUnreadable, of: c.products, noun: 'products',
        sentence: `${plural(c.productsUnreadable, 'product carries', 'products carry')} something in the size position we could not read, so ${c.productsUnreadable === 1 ? 'it will arrive' : 'they will arrive'} without a size. ${plural(c.productsSized, 'product has', 'products have')} a size we read cleanly, and ${plural(c.productsNotStated, 'states', 'state')} no size at all, which is a different thing and is fine.${naClause}`,
      };
    },
  },
  {
    // 🔴 THE SAME COLLISION RULE THE `/inventory` GRID MARKS WITH (R-101), REACHED THROUGH THE ONE
    // DEFINITION. Two implementations of this operation is what made the import report find eleven
    // and the screen show none of them, for a fortnight, on the exact rows David found by eye.
    id: 'products-that-share-a-shelf', version: 1, tier: 'risk',
    shape: 'reused-unique-value', needs: ['items'],
    quoted: 'not previously computed',
    remeasured: '11 groups, 6 with a price difference, worst gap $875 (Lacey Oak 45 at $375 and $1,250). [STATED — a prior session\'s measurement against the 685-item capture.]',
    run: (x) => {
      if (!x.items) return null;
      const c = censusCollisions(x.items);
      if (c.sellable === 0) return null;
      return {
        matched: c.rowsInvolved, of: c.sellable, noun: 'products & services',
        sentence: c.groups === 0
          ? 'No two products in your list share a name and a size, so every row is distinguishable from every other one.'
          : `${plural(c.rowsInvolved, 'product', 'products')} — ${plural(c.groups, 'pair', 'sets')} — have the same name and the same size as another product, so nothing can tell them apart on a screen or a scan. ${c.groupsWithPriceDifference === 0 ? 'They all carry the same price, so which one gets picked does not change what a customer pays.' : `${plural(c.groupsWithPriceDifference, 'of those sets carries', 'of those sets carry')} two different prices, the widest being ${money(c.worstGap)} apart — so which row gets picked decides what the customer is charged.`}`,
        // 🔴 NOT A MONEY FIGURE. The gap is a price DIFFERENCE, not an amount at stake, and
        // rendering it as "$875 at stake" would put a number on this page that nobody lost.
        value: null,
      };
    },
  },
  {
    // Written and never read: a classification the books carry that nothing on either side uses.
    id: 'customer-types-nothing-uses', version: 1, tier: 'tidiness',
    shape: 'written-never-read', needs: ['customers'],
    quoted: 'not previously computed',
    remeasured: '34 records carry a customer type. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.customers) return null;
      const n = x.customers.census.paperwork.withCustomerType;
      return {
        matched: n, of: x.customers.total, noun: 'customer records',
        sentence: n === 0
          ? 'None of your customer records carries a customer type, so there is no classification here that anything is failing to use.'
          : `${plural(n, 'customer record carries', 'customer records carry')} a customer type in QuickBooks. Nothing on this side reads it today, so whatever you are using it to mean does not travel — it is worth knowing before it silently stops being true.`,
      };
    },
  },
  {
    // 🔴 THE COUNT ONLY, AND THE PROSE IS NEVER READ ANYWHERE. `hasNotes` is a boolean computed at
    // parse time; the note text does not exist in any structure this rule can see. On real books
    // these carry gate codes and dog warnings about a customer's own property, and the finding is
    // that the knowledge is real and reaches nobody — not what any particular note says.
    id: 'notes-that-reach-nobody', version: 1, tier: 'tidiness',
    shape: 'prose-not-a-field', needs: ['customers'],
    quoted: 'not previously computed',
    remeasured: '9 records carry operational notes. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.customers) return null;
      const n = x.customers.census.paperwork.withNotes;
      return {
        matched: n, of: x.customers.total, noun: 'customer records',
        sentence: n === 0
          ? 'None of your customer records carries a note, so there is nothing written down here that a driver would otherwise miss.'
          : `${plural(n, 'customer record has', 'customer records have')} a note typed against it in QuickBooks. Notes are where the things that only work if somebody remembers them get written down, and nothing on a delivery run or an order screen shows them today.`,
      };
    },
  },

  // ── shape: prose-not-a-field ───────────────────────────────────────────────
  // 🔴 THE LARGEST MONEY FINDING THERE IS, AND IT IS ABOUT MEASURABILITY RATHER THAN LOSS.
  // Nobody is being robbed. The point is that the business CANNOT ANSWER "what does discounting
  // cost me", because the discount was typed into a line's wording instead of recorded as a
  // discount — so it is invisible to every report they or their accountant will ever run.
  //
  // ⚠️ IT DOES NOT RECLASSIFY ANYTHING (R-50). `discountInDescription` says the WORDING mentions
  // a discount. It never asserts the line IS one, and the sentence below says "say" and "not
  // recorded as one" rather than calling them discounts.
  {
    id: 'discount-in-wording', version: 1, tier: 'money', shape: 'prose-not-a-field', needs: ['invoices'],
    quoted: '504 lines carrying $614,053, against 66 formal discount lines totalling $31,985',
    remeasured: '412 lines carrying $461,835, against 88 recorded discount lines totalling $36,287. (Counting raw discount LINES rather than discount ITEMS gives 66 and $31,985 — the quoted pair is right under that second definition, and this rule states which one it uses.)',
    run: (x) => {
      if (!x.invoices) return null;
      let wordingLines = 0, wordingAmount = 0, formalLines = 0, formalAmount = 0, allLines = 0;
      for (const inv of x.invoices) {
        for (const l of inv.lines) {
          allLines++;
          const formal = (l.detailType ?? '') === QBO_DETAIL_TYPE.discount || (l.amount ?? 0) < 0;
          if (formal) { formalLines++; formalAmount += Math.abs(l.amount ?? 0); }
          else if (l.discountInDescription) { wordingLines++; wordingAmount += Math.max(0, l.amount ?? 0); }
        }
      }
      return {
        matched: wordingLines, of: allLines, noun: 'invoice lines',
        // The money is the point, so the money is in the sentence.
        sentence: `${plural(wordingLines, 'line says', 'lines say')} a discount in their wording but ${wordingLines === 1 ? 'is' : 'are'} not recorded as one, covering ${money(wordingAmount)} of what you sold — against ${plural(formalLines, 'line', 'lines')} totalling ${money(formalAmount)} that ARE recorded as discounts. You cannot tell what discounting costs you, because most of it is done by editing the price.`,
        value: wordingAmount,
      };
    },
  },

  // ── shape: prose-not-a-field — AND THIS IS THE ONE DAVID MOST WANTED ON THE REPORT ────────
  //
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 THEY GIVE TREES AWAY UNDER WARRANTY, AND THEIR BOOKS HOLD NO FIGURE FOR WHAT IT COSTS.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // [STATED — a prior session's measurement: **49 lines charged $0 across 29 invoices**, between
  // 2025-04-30 and 2026-07-23, every one a plant given free under warranty, and recorded FOUR
  // different ways: a `WARRANTY` item (19), a `Tree Replacement` item (3), an item coded
  // `BPJ30REP` (1), and — the 26 that matter — **the tree itself at $0 with "(Replacement)" in the
  // description.** Nothing can add those up, so nobody can answer *"what does the warranty cost
  // us"*, which is a number that belongs in the price of every tree they sell.]
  //
  // 🔴 IT IS VALUED AT COST OR NOT AT ALL, AND THE RULE REFUSES RATHER THAN ESTIMATING. Those items
  // carry RETAIL prices. Totalling them would print roughly three times the true figure, and David
  // has already had one overstatement caught by Lauren. `censusGiveawayLines` populates a cost
  // total ONLY when every counted line's item publishes a purchase cost; otherwise this reports the
  // COUNT and says the money cannot be worked out. See `giveawayLines.ts`.
  //
  // ⚠️ THE METHOD IS STATED IN THE SENTENCE, INCLUDING WHAT IT CANNOT SEE. A $0 line whose item
  // says nothing and whose wording says nothing is counted as *neither names it* — so its owner can
  // tell us there is a FIFTH way, instead of us deciding silently that there is not.
  {
    id: 'given-away-and-recorded-more-than-one-way', version: 1, tier: 'money',
    shape: 'prose-not-a-field', needs: ['items', 'invoices'],
    blocks: ['Knowing what your warranty costs', 'Pricing the warranty into a tree'],
    quoted: 'not previously computed',
    remeasured: '49 lines across 29 invoices, recorded four ways. [STATED — a prior session\'s measurement against the 2026-09-03 capture.]',
    run: (x) => {
      if (!x.items || !x.invoices) return null;
      const c = censusGiveawayLines(x.invoices, x.items);
      // 🔴 THE DENOMINATOR IS EVERY INVOICE LINE, NOT THE GIVEAWAYS THEMSELVES — AND THE FIRST
      // DRAFT GOT THIS WRONG IN THE ONE WAY THIS FILE EXISTS TO CATCH. It returned `of: 1` on a
      // clean run so the clean sentence would render, which means an invoice walk containing NO
      // LINES AT ALL would have produced *"nothing was given away"* — a pass over an empty set,
      // certifying a business from a read that found nothing. With the real denominator the
      // runner's own `of === 0` guard catches that case, exactly as it does for every other rule.
      const allLines = x.invoices.reduce((n, i) => n + i.lines.length, 0);
      if (c.lines === 0) {
        // A TRUE CLEAN RESULT, and worth saying out loud on a page whose subject is what a
        // business cannot measure.
        return {
          matched: 0, of: allLines, noun: 'invoice lines',
          sentence: 'Nothing in your invoice history was charged at zero, so there is no giveaway here that your books are failing to add up.',
        };
      }
      const shapes = (Object.keys(GIVEAWAY_SHAPES) as (keyof typeof GIVEAWAY_SHAPES)[])
        .filter(k => c.byShape[k] > 0)
        .map(k => `${c.byShape[k]} where ${GIVEAWAY_SHAPES[k]}`)
        .join(', ');
      const period = c.first && c.last ? ` between ${c.first} and ${c.last}` : '';
      const moneyClause = c.costTotal !== null
        ? ` At what those items cost you, that is ${money(c.costTotal)} — your cost, not what you would have sold them for.`
        : ` We cannot tell you what that cost you: ${plural(c.linesWithoutCost, 'of those lines uses', 'of those lines use')} an item with no purchase cost recorded, and the only other figure available is the retail price, which would overstate it by whatever your markup is.`;
      const unread = c.byShape['nothing-names-it'];
      const unreadClause = unread === 0 ? ''
        : ` ${plural(unread, 'line is', 'lines are')} recorded in a way we could not read at all — the item code says nothing and neither does the wording — so if you have a fifth way of writing these down, that is where it is.`;
      return {
        matched: c.lines, of: allLines, noun: 'invoice lines',
        sentence: `${plural(c.lines, 'line', 'lines')} on ${plural(c.invoices, 'invoice', 'invoices')}${period} were charged nothing at all, and they are written down ${c.shapesInUse === 1 ? 'one way' : `${c.shapesInUse} different ways`} — ${shapes}. Because there is no single way of recording it, no report you or your accountant can run will ever add them up.${moneyClause}${unreadClause}`,
        value: c.costTotal,
      };
    },
  },

  // ── shape: formula-breaks-where-it-matters ─────────────────────────────────
  // A price list can be perfectly consistent and still describe nothing that happens. This
  // compares the rule the CATALOGUE follows against the rule the SALES follow, and it is a
  // money finding because the gap between them is the money.
  {
    id: 'markup-formula-not-achieved', version: 1, tier: 'money',
    shape: 'formula-breaks-where-it-matters', needs: ['items', 'invoices'],
    quoted: 'cost x 3 on 345 of 345 rows; actual sales run 2.81x',
    cannotCompute: 'We could not work out the markup your price list uses, because your products do not record both a cost and a list price.',
    run: (x) => {
      if (!x.items || !x.invoices) return null;
      const cost = new Map<string, number>();
      const ratios: number[] = [];
      for (const it of x.items) {
        if (it.purchaseCost !== null && it.purchaseCost > 0) {
          cost.set(it.id, it.purchaseCost);
          if (it.unitPrice !== null && it.unitPrice > 0) ratios.push(round2(it.unitPrice / it.purchaseCost));
        }
      }
      if (ratios.length === 0) return null;

      // Is there a FORMULA at all? The most common multiple, and how much of the list obeys it.
      const tally = new Map<number, number>();
      for (const r of ratios) tally.set(r, (tally.get(r) ?? 0) + 1);
      let formula = 0, holds = 0;
      for (const [r, n] of tally) if (n > holds) { formula = r; holds = n; }
      // 🔴 NO FORMULA IS NOT A FINDING OF THIS SHAPE. A catalogue priced item-by-item is a
      // legitimate way to run a business, and reporting it here would be inventing a rule the
      // owner never adopted and then telling them they broke it.
      if (holds / ratios.length < 0.9) return null;

      let costSum = 0, revSum = 0, lines = 0;
      for (const inv of x.invoices) {
        for (const l of pricedLines(inv)) {
          const c = l.itemId ? cost.get(l.itemId) : undefined;
          if (c === undefined) continue;
          const q = l.qty !== null && l.qty > 0 ? l.qty : 1;
          costSum += c * q;
          revSum  += (l.unitPrice as number) * q;
          lines++;
        }
      }
      if (lines === 0 || costSum === 0) return null;
      const achieved = revSum / costSum;
      const gap = (formula - achieved) * costSum;
      return {
        matched: holds, of: ratios.length, noun: 'products with both a cost and a list price',
        sentence: `Your price list marks up ${formula}x on cost, and it holds on ${holds} of ${ratios.length} products. What you actually sold ran ${round2(achieved)}x${gap > 0 ? ` — ${money(gap)} less than your own list price would have brought in over the invoices we read` : ''}.`,
        value: gap > 0 ? gap : null,
      };
    },
  },

  // ── shape: implausible-distribution ────────────────────────────────────────
  {
    id: 'customers-who-bought-once', version: 1, tier: 'tidiness',
    shape: 'implausible-distribution', needs: ['invoices'],
    quoted: '83% of customers bought exactly once, and they are 56% of revenue',
    remeasured: 'CONFIRMED EXACT — 905 of the 1,093 customers who have ever bought, 83%, and 56% of revenue.',
    run: (x) => {
      if (!x.invoices) return null;
      const perCustomer = new Map<string, number>();
      for (const inv of x.invoices) {
        if (inv.customerId) perCustomer.set(inv.customerId, (perCustomer.get(inv.customerId) ?? 0) + 1);
      }
      const total = perCustomer.size;
      const once = [...perCustomer.values()].filter(n => n === 1).length;
      return {
        matched: once, of: total, noun: 'customers who have bought',
        sentence: `${plural(once, 'customer has', 'customers have')} bought from you exactly once — ${pct(once, total)} of everyone who has ever bought.`,
        // Real, and not a dollar figure: what a repeat customer WOULD have spent is a forecast,
        // and a forecast dressed as a measurement is the thing this whole file refuses to do.
        value: null,
      };
    },
  },

  // ── shape: implausible-distribution — AND IT CANNOT BE COMPUTED, WHICH IS THE POINT ───
  // 🔴 THIS RULE EXISTS PRECISELY BECAUSE IT CANNOT RUN. It is the second-largest money finding
  // there is, and a silent omission would read as a clean bill of health on receivables. It
  // names the two fields that would answer it, so the next conversation starts from a request
  // rather than from a rediscovery.
  {
    // ══════════════════════════════════════════════════════════════════════════════════════
    // 🔴 BUILT 2026-09-03. THE `cannotCompute` THIS REPLACES WAS FALSE ABOUT OUR OWN READ.
    // ══════════════════════════════════════════════════════════════════════════════════════
    // It said: *"The invoice read does not include how much of each invoice is still unpaid,
    // or when it was due."* **`Balance` and `DueDate` are on 1,469 of 1,469 rows** of the
    // 2026-08-29 capture. What dropped them was `invoiceList.ts`'s parser, not Intuit — so the
    // sentence blamed a customer's books for something we did to them.
    //
    // 🔴 THAT IS WORSE THAN A MISSING FINDING, AND IT IS WHY THIS ONE WAS BUILT RATHER THAN
    // RE-WORDED. A missing finding is a silence. A false cannot-compute is an ASSERTION — it
    // tells an owner their data lacks something their data carries, and it forecloses the
    // question for every future reader who believes it.
    id: 'overdue-receivables', version: 1, tier: 'money',
    shape: 'implausible-distribution', needs: ['invoices'],
    quoted: '$30,736 outstanding, of which $11,157 more than 30 days past due',
    remeasured: 'CONFIRMED — $30,736 across 14 invoices, $11,158 of it on 6 invoices more than 30 days past due as at the 2026-08-29 read, oldest due 2026-04-22.',
    cannotCompute: 'We cannot tell you what you are owed, because we were not told what date to count from. Nothing here should be read as "your receivables are fine".',
    run: (x) => {
      if (!x.invoices || !x.asOf) return null;
      const asOf = Date.parse(`${x.asOf}T00:00:00Z`);
      if (!Number.isFinite(asOf)) return null;

      let openTotal = 0, openCount = 0, lateTotal = 0, lateCount = 0, undated = 0, unreadable = 0;
      let oldestDue: string | null = null;
      for (const inv of x.invoices) {
        // 🔴 A NULL BALANCE IS NOT A ZERO BALANCE, AND THE DIFFERENCE IS DECLARED RATHER THAN
        // ABSORBED. An invoice whose balance we could not read is not an invoice that is paid.
        // Skipping it silently and skipping a settled invoice silently produce the same total
        // and mean opposite things (D-9 / A9) — so the unreadable ones are COUNTED and the
        // sentence says how many, exactly as the undated ones are.
        if (inv.balance === null) { unreadable++; continue; }
        if (inv.balance <= 0) continue;
        openTotal += inv.balance; openCount++;
        if (!inv.dueDate) { undated++; continue; }
        const due = Date.parse(`${inv.dueDate}T00:00:00Z`);
        if (!Number.isFinite(due)) { undated++; continue; }
        if (oldestDue === null || inv.dueDate < oldestDue) oldestDue = inv.dueDate;
        if ((asOf - due) / 86_400_000 > 30) { lateTotal += inv.balance; lateCount++; }
      }
      if (openCount === 0) return null;

      const oldestClause = oldestDue === null ? ''
        : ` The oldest was due on ${oldestDue}.`;
      const undatedClause = undated === 0 ? ''
        : ` ${plural(undated, 'invoice has', 'invoices have')} no due date we could read, so ${undated === 1 ? 'it is' : 'they are'} counted in the total owed but not in the overdue figure.`;
      const unreadableClause = unreadable === 0 ? ''
        : ` A further ${plural(unreadable, 'invoice does', 'invoices do')} not record a balance we could read, so ${unreadable === 1 ? 'it is' : 'they are'} in neither figure — ${unreadable === 1 ? 'it is' : 'they are'} not known to be paid.`;
      return {
        matched: openCount, of: x.invoices.length, noun: 'invoices',
        sentence: `${money(openTotal)} is still owed to you across ${plural(openCount, 'invoice', 'invoices')}, and ${money(lateTotal)} of that — ${plural(lateCount, 'invoice', 'invoices')} — was more than 30 days past due when we read your books.${oldestClause}${undatedClause}${unreadableClause}`,
        value: openTotal,
      };
    },
  },
];

/**
 * Evaluate every rule against whatever walks were actually read.
 *
 * 🔴 THE RETURN IS ALWAYS THE COMPLETE RULE SET, IN TIER ORDER, INCLUDING THE ONES THAT COULD
 * NOT RUN. Filtering out the unmeasurable ones would produce a shorter, cleaner list that
 * quietly asserts everything worth checking was checked — the exact failure the `measured`
 * flag exists to prevent. A rule the reader cannot see is a rule the reader assumes passed.
 *
 * ⚠️ NOTHING HERE READS THE CLOCK. One rule — receivables — needs a date to measure "past due"
 * against, and it takes it as `input.asOf` (the date the books were READ). That keeps the same
 * capture producing the same answer next month, which is what makes the rule probeable at all:
 * a finding whose output drifts on its own cannot be asserted against (R-33). Absent `asOf`,
 * the rule reports itself uncomputed rather than quietly substituting today.
 */
export function evaluateBooks(input: BooksInput): Finding[] {
  const present: Record<Walk, boolean> = {
    items:     Array.isArray(input.items),
    customers: !!input.customers,
    invoices:  Array.isArray(input.invoices),
  };

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 THE WINDOW IS MEASURED OFF THE WALK, ONCE, HERE — AND NO RULE MAY TYPE ONE.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // It is the earliest and latest transaction date actually present in the invoices that were
  // read. Not the date of the read (that is a different fact and the report already prints it),
  // not a range somebody wrote down, and not `new Date()`. A rule cannot state it wrongly because
  // a rule is never asked to state it — which is what stops *"in the period we read"* drifting
  // into *"never"* the next time a sentence is edited.
  //
  // ⚠️ IT IS ATTACHED ONLY TO RULES THAT ACTUALLY READ THE INVOICE WALK. A duplicate customer is a
  // duplicate whatever the dates say; putting a period on it would imply the finding expires.
  const window: FindingWindow | null = (() => {
    const dates = (input.invoices ?? []).map(i => i.txnDate).filter((d): d is string => !!d).sort();
    if (dates.length === 0) return null;
    return { from: dates[0], to: dates[dates.length - 1], of: 'your invoice history' };
  })();

  const out: Finding[] = [];
  for (const rule of BOOKS_RULES) {
    const missing = rule.needs.filter(w => !present[w]);
    const base = {
      id: rule.id, version: rule.version, tier: rule.tier, shape: rule.shape, quoted: rule.quoted,
      remeasured: rule.remeasured ?? null,
      blocks: rule.blocks ?? [],
      // A rule that reads invoices carries the window whether it ran or not: "we could not work
      // this out" is also a statement about a period, and the reader deserves to know which one.
      window: rule.needs.includes('invoices') ? window : null,
      rows: null as FindingRow[] | null,
      rowsTotal: 0,
      needsAnswer: null as Finding['needsAnswer'],
      // A finding that could not run has no money at stake and no recommendation. Reporting
      // either as 0 would put it in the ordering as though it had been measured and found
      // worthless — the same conflation of "nothing" with "we did not look" this file exists
      // to refuse, arriving through the sort instead of through the text.
      value: null as number | null,
      recommendation: null as Recommendation | null,
    };

    if (missing.length > 0) {
      out.push({
        ...base, measured: false, clean: false,
        notMeasured: `Not checked — this needs ${missing.map(w => WALK_LABEL[w]).join(' and ')}, which ${missing.length === 1 ? 'has' : 'have'} not been read yet.`,
        sentence: '', population: { matched: 0, of: 0, noun: '' },
      });
      continue;
    }

    const r = rule.run(input);
    if (r === null) {
      out.push({
        ...base, measured: false, clean: false,
        notMeasured: rule.cannotCompute
          ?? 'We cannot work this one out from your books on their own — it needs something only you can tell us.',
        sentence: '', population: { matched: 0, of: 0, noun: '' },
      });
      continue;
    }

    // 🔴 A POPULATION OF ZERO IS NOT A PASS. Matching nothing out of nothing means the rule
    // never had anything to look at, and rendering that as a clean result would let an empty
    // read certify a business. This is D-49's own suite blessing the defect it was written to
    // prevent, in a different costume.
    if (r.of === 0) {
      out.push({
        ...base, measured: false, clean: false,
        notMeasured: `Nothing to check — there were no ${r.noun} in what we read.`,
        sentence: '', population: { matched: 0, of: 0, noun: r.noun },
      });
      continue;
    }

    // 🔴 THE CAP IS APPLIED HERE, NOT BY THE RULE (see `FINDING_ROW_LIMIT`), and `rowsTotal` keeps
    // what the cap removed VISIBLE — a truncated list presented as a whole one is the invoice-grid
    // defect (*"nothing found" for an invoice that exists*) arriving on a different screen.
    const found = r.rows ?? null;
    out.push({
      ...base, measured: true, notMeasured: null,
      sentence: r.sentence,
      population: { matched: r.matched, of: r.of, noun: r.noun },
      needsAnswer: r.needsAnswer ?? null,
      value: r.value ?? null,
      recommendation: r.recommendation ?? null,
      rows: found === null ? null : found.slice(0, FINDING_ROW_LIMIT),
      rowsTotal: found === null ? 0 : found.length,
      // 🔴 A CLEAN FINDING BLOCKS NOTHING, AND THE RUNNER ENFORCES THAT RATHER THAN EACH RULE
      // REMEMBERING TO. `blocks` on the rule is a DECLARATION — *these are the capabilities this
      // finding is about* — and it would be a lie on a run where the finding did not fire:
      // "Campaigns · Review requests" printed beside *"every record has an email or a phone"* says
      // the opposite of what the sentence says, in the half a reader skims.
      blocks: r.matched === 0 ? [] : (rule.blocks ?? []),
      // Ran, and found none of what it was looking for. See `Finding.clean`.
      clean: r.matched === 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 MONEY AT STAKE, COMPUTED — THEN RISK, THEN SHAPE, THEN WHAT COULD NOT BE COMPUTED.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⚠️ THIS IS A DELIBERATE CHANGE FROM THIS FILE'S ORIGINAL RULE, WHICH FORBADE SORTING BY
  // "count or dollar size" and used the rules' hand-written order instead. That prohibition was
  // aimed at WORST-FIRST — twelve things wrong with her books, sorted by how wrong they are,
  // reads as an audit of her work. Sorting by WHAT IT IS WORTH TO HER is a different axis and
  // reads as help: the ordering is hers, not ours. So the tier order stays exactly as it was
  // (money before risk before tidiness, never severity), and only the WITHIN-TIER order changes
  // from a number a person typed to a number computed from their own books.
  //
  // 🔴 AND UNMEASURED FINDINGS GO LAST, ACROSS ALL TIERS, RATHER THAN SORTING AS ZERO. "What we
  // could not work out" is the most valuable page in the report — it is the list of things the
  // business itself cannot answer — but it is not a finding about their money, and interleaving
  // it with findings that were measured makes both harder to read.
  //
  // A null value is NOT zero: "not a money question" and "worth nothing" are different answers,
  // so nulls sort after every measured value within their tier rather than below them.
  const tierIndex = (t: FindingTier) => FINDING_TIERS.indexOf(t);
  const ruleIndex = new Map(BOOKS_RULES.map((r, i) => [r.id, i]));
  const worth = (f: Finding) => (f.value === null ? -Infinity : f.value);
  return out.sort((a, b) =>
    Number(!a.measured) - Number(!b.measured) ||
    tierIndex(a.tier) - tierIndex(b.tier) ||
    worth(b) - worth(a) ||
    (ruleIndex.get(a.id) as number) - (ruleIndex.get(b.id) as number));
}
