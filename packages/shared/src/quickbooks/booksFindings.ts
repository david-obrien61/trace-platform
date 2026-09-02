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

/** Money before risk before tidiness. The array order IS the sort order. */
export const FINDING_TIERS = ['money', 'risk', 'tidiness'] as const;
export type FindingTier = (typeof FINDING_TIERS)[number];

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
}

interface Rule {
  id: string;
  tier: FindingTier;
  needs: Walk[];
  quoted: string;
  /** Returns the measured half. `of` of zero is reported as not-measured by the runner. */
  run: (x: BooksInput) => { matched: number; of: number; noun: string; sentence: string;
                            needsAnswer?: { question: string; options: string[] } } | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

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
    id: 'trip-charge-missing', tier: 'money', needs: ['invoices'],
    quoted: '40 invoices, about $6,000',
    // 🔴 DELIBERATELY UNCOMPUTED, AND THIS IS THE HONEST ANSWER RATHER THAN A LAZY ONE. The
    // rule needs to know WHICH ITEM MEANS "trip charge" in these books. Guessing it from item
    // names would produce a number that happens to be right on the rows we have looked at and
    // is a rule nobody agreed to — R-50's retro-classification, arriving as a helpful default.
    // The question goes to the owner, who knows.
    run: () => null,
  },
  {
    id: 'sold-below-price-card', tier: 'money', needs: ['items', 'invoices'],
    quoted: '53 rows, 32 items, 230 sales',
    run: (x) => {
      if (!x.items || !x.invoices) return null;
      // The price card, by item id. Only items that PUBLISH a price are in it — an item with
      // no price has no floor, and comparing against a null-read-as-zero would put every sale
      // "at or above list" and silently empty this finding.
      const card = new Map<string, number>();
      for (const it of x.items) if (it.unitPrice !== null) card.set(it.id, it.unitPrice);

      let below = 0, comparable = 0;
      const items = new Set<string>();
      for (const inv of x.invoices) {
        for (const l of pricedLines(inv)) {
          const floor = l.itemId === null ? undefined : card.get(l.itemId);
          if (floor === undefined) continue;         // no published price → not comparable
          comparable++;
          if ((l.unitPrice as number) < floor) { below++; if (l.itemName) items.add(l.itemName); }
        }
      }
      return {
        matched: below, of: comparable, noun: 'sales we could compare against a published price',
        sentence: `${plural(below, 'sale was', 'sales were')} charged below the price you have set for that item in QuickBooks — ${plural(items.size, 'product', 'products')} in total.`,
      };
    },
  },
  {
    id: 'discount-never-applied', tier: 'money', needs: ['invoices', 'customers'],
    quoted: '7 customers',
    // Also deliberately uncomputed: it needs the POLICY — who qualifies for which discount.
    // That is a rule about their business, not a pattern in their data, and the data cannot
    // be made to yield it without inventing the policy first.
    run: () => null,
  },
  {
    id: 'discounts-that-do-not-work', tier: 'money', needs: ['invoices'],
    quoted: '3 military, 2 broken',
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
    id: 'duplicate-invoice-numbers', tier: 'risk', needs: ['invoices'],
    quoted: '22 numbers, 44 invoices',
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
    id: 'invoices-without-delivery-date', tier: 'risk', needs: ['invoices'],
    quoted: '881 of 1,469',
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
    id: 'possible-duplicate-customers', tier: 'risk', needs: ['customers'],
    quoted: 'about 72',
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
    id: 'customers-with-no-contact', tier: 'risk', needs: ['customers'],
    quoted: '110 of 1,927',
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
    id: 'sold-at-more-than-one-price', tier: 'tidiness', needs: ['invoices'],
    quoted: '286 of 414',
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
    id: 'income-accounts-in-use', tier: 'tidiness', needs: ['items'],
    quoted: '41 accounts',
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
    id: 'never-sold', tier: 'tidiness', needs: ['items', 'invoices'],
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
];

/**
 * Evaluate every rule against whatever walks were actually read.
 *
 * 🔴 THE RETURN IS ALWAYS THE COMPLETE RULE SET, IN TIER ORDER, INCLUDING THE ONES THAT COULD
 * NOT RUN. Filtering out the unmeasurable ones would produce a shorter, cleaner list that
 * quietly asserts everything worth checking was checked — the exact failure the `measured`
 * flag exists to prevent. A rule the reader cannot see is a rule the reader assumes passed.
 *
 * `now` is not a parameter because nothing here depends on the clock; the "23 months" framing
 * in the quoted figure is a property of the CAPTURE's date range, which the invoice read
 * already reports above this panel.
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
      id: rule.id, tier: rule.tier, quoted: rule.quoted,
      needsAnswer: null as Finding['needsAnswer'],
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
        notMeasured: 'We cannot work this one out from your books on their own — it needs something only you can tell us.',
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
    });
  }

  // TIER ORDER, then the rules' own declared order. NEVER by count or dollar size — see ②.
  const tierIndex = (t: FindingTier) => FINDING_TIERS.indexOf(t);
  const ruleIndex = new Map(BOOKS_RULES.map((r, i) => [r.id, i]));
  return out.sort((a, b) =>
    tierIndex(a.tier) - tierIndex(b.tier) ||
    (ruleIndex.get(a.id) as number) - (ruleIndex.get(b.id) as number));
}
