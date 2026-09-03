// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: read what is actually in a business's own QuickBooks and say, in sentences its
//   owner would use, what is in there. Twelve questions, evaluated as DATA — a rule is a row
//   in a list, not a branch in a function — so a rule can be added, re-ordered or reported as
//   unmeasurable without touching the walk that feeds it.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow · DiscountBreakdown) · ./itemList (QboItemRow) ·
//   ./customerList (CustomerBreakdown) · ./shipmentIngest (QboShipmentRow). Pure: no db, no
//   network, no env, no clock it did not receive.
// OUTPUTS: FindingTier · Finding · BooksInput · BOOKS_RULES · evaluateBooks.
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
import type { QboItemRow } from './itemList';
import type { CustomerBreakdown } from './customerList';
import { QBO_DETAIL_TYPE } from './invoiceLineShapes';

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

export interface Finding {
  id: string;
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
}

export interface BooksInput {
  /** Absent = that walk was not run. NOT an empty array — the distinction is the point. */
  items?: QboItemRow[];
  customers?: CustomerBreakdown;
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
  tier: FindingTier;
  shape: Shape;
  needs: Walk[];
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
                            recommendation?: Recommendation } | null;
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
    id: 'trip-charge-missing', tier: 'money', shape: 'uncharged-money', needs: ['invoices'],
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
    id: 'sold-below-price-card', tier: 'money', shape: 'two-sources-disagree', needs: ['items', 'invoices'],
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
    id: 'sold-below-quickbooks-list', tier: 'money', shape: 'two-sources-disagree', needs: ['items', 'invoices'],
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
        sentence: `${plural(below, 'sale was', 'sales were')} charged below the price recorded on that product in QuickBooks — ${plural(products.size, 'product', 'products')} over ${plural(span, 'month', 'months')}, ${money(shortfall)} counted once per sale rather than per item. Typically people paid ${pct(Math.round(median * 100), 100)} of the recorded price.`,
        value: shortfall,
        recommendation,
      };
    },
  },
  {
    id: 'discount-never-applied', tier: 'money', shape: 'two-sources-disagree', needs: ['invoices', 'customers'],
    quoted: '7 customers',
    remeasured: 'NOT COMPUTABLE — it needs the discount policy, which is a rule about their business rather than a pattern in their data.',
    // Also deliberately uncomputed: it needs the POLICY — who qualifies for which discount.
    // That is a rule about their business, not a pattern in their data, and the data cannot
    // be made to yield it without inventing the policy first.
    run: () => null,
  },
  {
    id: 'discounts-that-do-not-work', tier: 'money', shape: 'written-never-read', needs: ['invoices'],
    quoted: '3 military, 2 broken',
    remeasured: '3 military discount items CONFIRMED. 5 discount items in total did not take their percentage off the whole invoice.',
    run: (x) => {
      if (!x.discounts) return null;
      // REUSES `summariseInvoices`' own DiscountBreakdown rather than re-deriving it (§6 r8).
      // A discount whose base does not equal the invoice subtotal is one that did not compute
      // the way it looks like it should — that is the whole finding, and the breakdown already
      // counts it four ways.
      const rows = x.discounts.byName;
      const broken = rows.filter(r => r.verdicts.belowSubtotal > 0 || r.verdicts.aboveSubtotal > 0);
      return {
        matched: broken.length, of: rows.length, noun: 'discount items in use',
        sentence: broken.length === 0
          ? 'Every discount item in your books took its percentage off the whole invoice, which is what they look like they should do.'
          : `${plural(broken.length, 'discount item did', 'discount items did')} not take their percentage off the whole invoice — they were worked out on part of it, so some customers got less off than the name suggests.`,
        needsAnswer: broken.length === 0 ? undefined : {
          question: 'These discount items are not doing what their names say. Fix them, or stop using them?',
          options: ['Fix them in QuickBooks', 'Retire them — stop offering these', 'Leave them as they are for now'],
        },
      };
    },
  },

  // ══ RISK ══════════════════════════════════════════════════════════════════
  {
    id: 'duplicate-invoice-numbers', tier: 'risk', shape: 'reused-unique-value', needs: ['invoices'],
    quoted: '22 numbers, 44 invoices',
    remeasured: 'CONFIRMED EXACT — 22 numbers across 44 invoices.',
    run: (x) => {
      if (!x.invoices) return null;
      const byNumber = new Map<string, number>();
      let numbered = 0;
      for (const inv of x.invoices) {
        if (!inv.docNumber) continue;               // an unnumbered invoice is not a collision
        numbered++;
        byNumber.set(inv.docNumber, (byNumber.get(inv.docNumber) ?? 0) + 1);
      }
      const dupNumbers = [...byNumber.values()].filter(n => n > 1);
      const dupInvoices = dupNumbers.reduce((a, b) => a + b, 0);
      return {
        matched: dupInvoices, of: numbered, noun: 'numbered invoices',
        // 🔴 THE SENTENCE STOPS AT WHAT IS TRUE. It does not say which is the real one, does
        // not call either a mistake, and does not say one should be deleted. Two invoices
        // sharing a number is a fact; what it MEANS is the owner's to say.
        sentence: `${plural(dupInvoices, 'invoice shares', 'invoices share')} an invoice number with another invoice — ${plural(dupNumbers.length, 'number is', 'numbers are')} used more than once.`,
      };
    },
  },
  {
    id: 'invoices-without-delivery-date', tier: 'risk', shape: 'field-adopted-midway', needs: ['invoices'],
    quoted: '881 of 1,469',
    remeasured: 'CONFIRMED EXACT — 881 of 1,469. Adoption 2% of the 570 invoices before 2025-09 and 64% of the 899 after.',
    run: (x) => {
      if (!x.invoices || !x.shipDates) return null;
      let without = 0, seen = 0;
      for (const inv of x.invoices) {
        if (!x.shipDates.has(inv.id)) continue;     // not covered by the shipment walk
        seen++;
        if (!x.shipDates.get(inv.id)) without++;
      }
      return {
        matched: without, of: seen, noun: 'invoices',
        sentence: `${plural(without, 'invoice does', 'invoices do')} not record the date the plants went out, so there is no way to tell from the invoice when the job actually happened.`,
      };
    },
  },
  {
    id: 'possible-duplicate-customers', tier: 'risk', shape: 'reused-unique-value', needs: ['customers'],
    quoted: 'about 72',
    remeasured: '54 — sharing an email address or a phone number with another record.',
    run: (x) => {
      if (!x.customers) return null;
      // 🔴 READ OFF THE TYPED BREAKDOWN, NOT A CAST. `summariseCustomers` already sizes this
      // and is the ONLY place that does (§6 r8) — a second duplicate-count here would be a
      // second answer to one question. `recordsInvolved` is the RECORD count, which is the
      // number a person cares about ("how many of my customers are affected"), not
      // `sharedValues`, which counts the shared email addresses.
      //
      // ⚠️ THE UNION IS DELIBERATELY *NOT* byEmail + byPhone. A customer entered twice usually
      // shares BOTH, so adding them would double-count exactly the records this is about and
      // report roughly twice the real figure. The two tallies overlap and this read cannot see
      // by how much — so it takes the LARGER of the two and says "at least", which is a claim
      // the data supports. A confident sum would not be.
      const c = x.customers;
      const dup = Math.max(c.byEmail.recordsInvolved, c.byPhone.recordsInvolved);
      return {
        matched: dup, of: c.total,
        noun: 'customers',
        sentence: `At least ${plural(dup, 'customer looks', 'customers look')} like they may be the same person entered twice — they share an email address or a phone number with another record — so their history is split in two.`,
        needsAnswer: dup === 0 ? undefined : {
          question: 'Should we join these up, or keep them as separate customers?',
          options: ['Join them — they are the same people', 'Keep them separate', 'Show me the list first'],
        },
      };
    },
  },
  {
    id: 'customers-with-no-contact', tier: 'risk', shape: 'implausible-distribution', needs: ['customers'],
    quoted: '110 of 1,927',
    remeasured: '110 of 1,936. The count was right and the DENOMINATOR was stale — the customer read is 1,936, and 1,927 had already been corrected once.',
    run: (x) => {
      if (!x.customers) return null;
      // `withNoContactAtAll` is the field's own name for exactly this: carries NONE of email,
      // phone or address. Not derived here as `total - withEmail`, which would be wrong — the
      // three coverage counts overlap, and subtracting one of them counts the customers who
      // have a phone but no email as unreachable.
      return {
        matched: x.customers.withNoContactAtAll, of: x.customers.total, noun: 'customers',
        sentence: `${plural(x.customers.withNoContactAtAll, 'customer has', 'customers have')} no address, phone number or email on their record, so there is no way to reach them or deliver to them.`,
      };
    },
  },

  // ══ TIDINESS ══════════════════════════════════════════════════════════════
  {
    id: 'sold-at-more-than-one-price', tier: 'tidiness', shape: 'implausible-distribution', needs: ['invoices'],
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
    id: 'income-accounts-in-use', tier: 'tidiness', shape: 'implausible-distribution', needs: ['items'],
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
    id: 'never-sold', tier: 'tidiness', shape: 'written-never-read', needs: ['items', 'invoices'],
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
    id: 'discount-in-wording', tier: 'money', shape: 'prose-not-a-field', needs: ['invoices'],
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

  // ── shape: formula-breaks-where-it-matters ─────────────────────────────────
  // A price list can be perfectly consistent and still describe nothing that happens. This
  // compares the rule the CATALOGUE follows against the rule the SALES follow, and it is a
  // money finding because the gap between them is the money.
  {
    id: 'markup-formula-not-achieved', tier: 'money',
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
    id: 'customers-who-bought-once', tier: 'tidiness',
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
    id: 'overdue-receivables', tier: 'money',
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

  const out: Finding[] = [];
  for (const rule of BOOKS_RULES) {
    const missing = rule.needs.filter(w => !present[w]);
    const base = {
      id: rule.id, tier: rule.tier, shape: rule.shape, quoted: rule.quoted,
      remeasured: rule.remeasured ?? null,
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
        ...base, measured: false,
        notMeasured: `Not checked — this needs ${missing.map(w => WALK_LABEL[w]).join(' and ')}, which ${missing.length === 1 ? 'has' : 'have'} not been read yet.`,
        sentence: '', population: { matched: 0, of: 0, noun: '' },
      });
      continue;
    }

    const r = rule.run(input);
    if (r === null) {
      out.push({
        ...base, measured: false,
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
        ...base, measured: false,
        notMeasured: `Nothing to check — there were no ${r.noun} in what we read.`,
        sentence: '', population: { matched: 0, of: 0, noun: r.noun },
      });
      continue;
    }

    out.push({
      ...base, measured: true, notMeasured: null,
      sentence: r.sentence,
      population: { matched: r.matched, of: r.of, noun: r.noun },
      needsAnswer: r.needsAnswer ?? null,
      value: r.value ?? null,
      recommendation: r.recommendation ?? null,
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
