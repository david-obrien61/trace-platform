/**
 * ── discountReview — the suggestions, the refusals, and the write that must not clobber ──
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not the arithmetic — `|amount| ÷ base` is a division nobody
 * was going to get wrong. Three things can hurt a real business here, and each has its own §:
 *
 *   ① A RATE THAT WAS AVERAGED INTO EXISTENCE (§A). A discount used at 10% forty times and at
 *      40% once averages to 10.7% — a number nobody ever granted, rendered as a confident
 *      suggestion. The tally must DISTRIBUTE, and the review must REFUSE a name whose rates
 *      disagree rather than pick one.
 *   ② A WRITE THAT DELETES THE SALES-TAX RATE (§E). `mergePricingConfig` is
 *      `{ ...current, ...patch }` and FAILS OPEN on an empty read: `data: null` with no error
 *      makes `current` `{}` and the write replaces the whole config. At LAWNS that deletes
 *      `taxRate: 0.0825` and every invoice after it charges $0 tax under a redline.
 *   ③ A SUGGESTION THE EDITOR WOULD REJECT (§I). `Discounts.validate()` forbids a duplicate
 *      tier name, an empty name and the reserved word `retail`. A patch that carries any of
 *      those writes a config the owner's own screen cannot then edit.
 *
 * ⚠️ §A FEEDS THE REAL PARSER, NOT A HAND-BUILT TALLY. The fixtures are Intuit-shaped JSON put
 * through `parseInvoiceList` → `summariseInvoices`, because the thing most likely to be wrong is
 * the assumption that a discount line's `Qty` is the dollar base — and a hand-built
 * `DiscountNameTally` would assert that assumption instead of testing it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/discountReview.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { parseInvoiceList, summariseInvoices } from '../quickbooks/invoiceList';
import {
  buildDiscountReview, buildAcceptancePatch, suggestTypeName, REVIEW_REFUSALS,
  type DiscountItemFact, type AcceptedTier,
} from './discountReview';
import { EMPTY_COST_CONFIG } from './CostToProduce';
import { normalizeDiscountTypes, resolveTier } from './tierPricing';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── Intuit-shaped fixtures ───────────────────────────────────────────────────────────────────
// A discount on these books is a SERVICE ITEM with a negative UnitPrice, used on an ordinary
// SalesItemLineDetail line whose `Qty` is the DOLLAR BASE. That is the whole mechanism, and it
// is why `Qty` is money here and a count everywhere else.
type Line = { name: string; qty: number | null; amount: number };
const sale = (name: string, qty: number, amount: number): Line => ({ name, qty, amount });
const disc = (name: string, base: number | null, amount: number): Line => ({ name, qty: base, amount });

function body(invoices: { doc: string; date: string | null; lines: Line[] }[]): string {
  return JSON.stringify({
    QueryResponse: {
      Invoice: invoices.map((inv, i) => ({
        Id: String(i + 1),
        DocNumber: inv.doc,
        TxnDate: inv.date,
        TotalAmt: inv.lines.reduce((s, l) => s + l.amount, 0),
        CustomerRef: { value: '7' },
        Line: inv.lines.map(l => ({
          DetailType: 'SalesItemLineDetail',
          Amount: l.amount,
          SalesItemLineDetail: { ItemRef: { value: '9', name: l.name }, Qty: l.qty },
        })),
      })),
    },
  });
}

const breakdownOf = (raw: string) => summariseInvoices(parseInvoiceList(raw).invoices).discounts;

const ITEMS: DiscountItemFact[] = [
  { id: '3', name: 'CD10%', description: 'Contractor Discount', unitPrice: -0.1 },
  { id: '4', name: 'CD15%', description: 'Contractor Discount', unitPrice: -0.15 },
  { id: '9', name: 'Military Discount 5', description: 'Military Discount', unitPrice: -0.05 },
];

// ══ §A THE PERCENT IS MEASURED AND DISTRIBUTED — NEVER AVERAGED ══════════════════════════════
{
  // 10% on four lines, 40% on one. An average would say 16%.
  const d = breakdownOf(body([
    { doc: '1', date: '2026-01-05', lines: [sale('Oak', 1, 1000), disc('CD10%', 1000, -100)] },
    { doc: '2', date: '2026-02-05', lines: [sale('Oak', 1, 2000), disc('CD10%', 2000, -200)] },
    { doc: '3', date: '2026-03-05', lines: [sale('Oak', 1, 500),  disc('CD10%', 500,  -50)] },
    { doc: '4', date: '2026-04-05', lines: [sale('Oak', 1, 800),  disc('CD10%', 800,  -80)] },
    { doc: '5', date: '2026-05-05', lines: [sale('Oak', 1, 100),  disc('CD10%', 100,  -40)] },
  ]));
  const row = d.byName.find(r => r.itemName === 'CD10%')!;
  ok(row.lines === 5, 'all five discount lines are counted');
  ok(row.percents.length === 2, '🔴 TWO rates are reported, not one blended number');
  ok(row.percents[0].pct === 10 && row.percents[0].lines === 4, 'the most-used rate leads: 10% on 4 lines');
  ok(row.percents[1].pct === 40 && row.percents[1].lines === 1, 'and the outlier is VISIBLE at 40% on 1 line');
  // ⚠️ THE ORDER ABOVE IS ALSO INSERTION ORDER, SO IT PROVES NOTHING ON ITS OWN. Here the outlier
  // arrives FIRST, so "most-used leads" can only hold if the list is genuinely sorted by use.
  const outlierFirst = breakdownOf(body([
    { doc: '1', date: '2026-01-05', lines: [sale('Oak', 1, 100),  disc('CD10%', 100,  -40)] },
    { doc: '2', date: '2026-02-05', lines: [sale('Oak', 1, 1000), disc('CD10%', 1000, -100)] },
    { doc: '3', date: '2026-03-05', lines: [sale('Oak', 1, 2000), disc('CD10%', 2000, -200)] },
  ])).byName.find(r => r.itemName === 'CD10%')!;
  ok(outlierFirst.percents[0].pct === 10 && outlierFirst.percents[0].lines === 2,
    '🔴 the 10% rate leads even though the 40% line was read FIRST — sorted by USE, not by arrival');
  ok(outlierFirst.percents[1].pct === 40, 'and the one-off outlier is second');
  // 🔴 THE AVERAGE TRAP, STATED AS TWO NUMBERS, BECAUSE THERE ARE TWO AND THE QUIETER ONE IS WORSE.
  // The UNWEIGHTED mean of the rates is 16% — visibly wrong, and a reader might catch it. The
  // WEIGHTED ratio (Σamount ÷ Σbase, the obvious "just divide the totals" implementation) is
  // 10.68%, because the 40% line was granted on a $100 base. It rounds to the clean rate. So the
  // aggregate does not merely report a rate nobody granted — it reports one that LOOKS RIGHT and
  // makes the outlier disappear. That is why the tally distributes.
  const weighted = Math.abs(row.amountTotal) / row.baseTotal * 100;
  const unweighted = row.percents.reduce((s, p) => s + p.pct * p.lines, 0) / row.lines;
  ok(Math.abs(unweighted - 16) < 0.01, 'the unweighted mean is 16% — a rate nobody ever granted');
  ok(Math.abs(weighted - 10.68) < 0.02,
    '🔴 and the WEIGHTED ratio is 10.68% — within a third of a point of the clean 10%, so the 40% ' +
    'outlier is INVISIBLE in the aggregate. The quiet failure, not the loud one');
  ok(!row.percents.some(p => Math.abs(p.pct - weighted) < 0.5),
    'neither aggregate is a rate that appears in the distribution');

  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(rev.sure.length === 0, 'so it is NOT suggested');
  ok(rev.needsHer.length === 1 && rev.needsHer[0].refusal === REVIEW_REFUSALS.ratesDisagree,
    '🔴 it is REFUSED with a reason she can act on — rates-disagree, not a silent omission');
  ok(rev.needsHer[0].percent === null, 'and it carries no number at all rather than a plausible one');
}

// ══ §B ONE RATE, EVERY TIME → the suggestion, with its evidence ══════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-08-19', lines: [sale('Oak', 1, 1000), disc('Military Discount 5', 1000, -50)] },
    { doc: '2', date: '2026-03-01', lines: [sale('Oak', 1, 600),  disc('Military Discount 5', 600,  -30)] },
    { doc: '3', date: '2025-11-11', lines: [sale('Oak', 1, 240),  disc('Military Discount 5', 240,  -12)] },
  ]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(rev.sure.length === 1, 'a clean rate is suggested');
  const r = rev.sure[0];
  ok(r.percent === 5, 'the rate is 5%, measured from |amount| ÷ base');
  ok(r.lines === 3 && r.measuredLines === 3, 'the line count is the evidence, and every line was measurable');
  ok(r.mostRecent === '2026-08-19',
    '🔴 the MOST RECENT date is the newest, not the last row read — ordering is by date, not by arrival');
  ok(r.tierName === 'Military Discount 5', 'the tier name is her books’ own item name, verbatim');
  ok(r.typeName === 'Military', 'the TYPE comes from the item description with the noise word dropped');
  ok(r.itemPercent === 5 && r.sourcesAgree === true,
    '🔴 TWO SOURCES AGREE — the item publishes −0.05 and the invoices did 5%. Neither alone is the claim');
}

// ══ §C TWO TIERS UNDER ONE TYPE, and the type is what groups them ════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-06-01', lines: [sale('Oak', 1, 1000), disc('CD10%', 1000, -100)] },
    { doc: '2', date: '2026-06-02', lines: [sale('Oak', 1, 2000), disc('CD15%', 2000, -300)] },
  ]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(rev.sure.length === 2, 'both are suggested');
  ok(rev.sure.every(r => r.typeName === 'Contractor'),
    'both land under ONE type — "Contractor Discount" minus the noise word, from the item record');
  const patch = buildAcceptancePatch({
    accepted: rev.sure.map(r => ({ typeName: r.typeName, tierName: r.tierName, percent: r.percent as number })),
    config: { taxRate: 0.0825 },
  });
  ok(patch.ok === true, 'the patch builds');
  if (patch.ok) {
    const types = patch.patch.discountTypes as { name: string; tiers: unknown[] }[];
    ok(types.length === 1 && types[0].name === 'Contractor' && types[0].tiers.length === 2,
      '🔴 ONE type carrying TWO tiers — not two types that happen to share a name');
  }
}

// ══ §D THE TYPE SUGGESTION NEVER INVENTS A WORD ══════════════════════════════════════════════
{
  ok(suggestTypeName('Contractor Discount') === 'Contractor', 'the noise word is dropped');
  ok(suggestTypeName('Military Discount 5') === 'Military', 'and so is a bare rate number');
  ok(suggestTypeName('DISCOUNT') === 'DISCOUNT',
    'a name that is ONLY the noise word survives untouched rather than becoming empty');
  ok(suggestTypeName('CD10%') === 'CD10%',
    '🔴 `CD10%` yields `CD10%` — we do NOT know that CD means contractor, and deciding it did would ' +
    'assert a fact about her business from two letters');
  ok(suggestTypeName(null) === '' && suggestTypeName('   ') === '',
    'absent stays absent — never a fabricated default');
}

// ══ §E 🔴 THE WRITE THAT MUST NOT DELETE THE SALES-TAX RATE ══════════════════════════════════
{
  const accepted: AcceptedTier[] = [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }];

  // ① The fail-open case. This is the one that costs money.
  const refused = buildAcceptancePatch({ accepted, config: null });
  ok(refused.ok === false, '🔴 a NULL config (the RLS-filtered read) REFUSES — it does not write');
  if (!refused.ok) ok(/tax/i.test(refused.reason), 'and the refusal says WHY, naming the tax rate it protected');

  // ② The patch never carries taxRate, and the assertion is on KEY ABSENCE, not on a null value:
  //    a `taxRate: null` in the patch would satisfy a value check and still wipe the rate.
  const built = buildAcceptancePatch({ accepted, config: { taxRate: 0.0825 } });
  ok(built.ok === true, 'a present config builds a patch');
  if (built.ok) {
    ok(!Object.prototype.hasOwnProperty.call(built.patch, 'taxRate'),
      '🔴 `taxRate` is ABSENT FROM THE PATCH KEYS — not null, not 0.0825, absent');
    ok(built.wroteTaxRate === false, 'and the result says so out loud');

    // ③ The merge, simulated exactly as mergePricingConfig performs it. This is the assertion
    //    that actually protects LAWNS: the real operand order, on the real live row.
    const merged = { ...{ taxRate: 0.0825 }, ...built.patch } as Record<string, unknown>;
    ok(merged.taxRate === 0.0825,
      '🔴 AFTER `{ ...current, ...patch }` THE 8.25% SURVIVES — the live LAWNS row, the real operand order');
    ok(Array.isArray(merged.discountTypes), 'and the discounts landed');
    ok(merged.margin !== undefined && merged.locations !== undefined,
      'and the plumbing came with it in the same single write');
  }

  // ④ EMPTY_COST_CONFIG must stay disjoint from the tax key, and the code must CHECK rather
  //    than assume it. If this ever fails, the constant grew a taxRate and the guard fired.
  ok(!Object.prototype.hasOwnProperty.call(EMPTY_COST_CONFIG, 'taxRate'),
    'EMPTY_COST_CONFIG carries no taxRate — the property the disjointness rests on');
}

// ══ §F PLUMBING IS WRITTEN ONLY WHERE IT IS ABSENT ═══════════════════════════════════════════
{
  const accepted: AcceptedTier[] = [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }];
  const ownersOwn = { baseline: 0.55, tiers: [{ name: 'mine', marginOverride: 0.55, isDefault: true }] };
  const r = buildAcceptancePatch({ accepted, config: { taxRate: 0.0825, margin: ownersOwn, version: 1 } });
  ok(r.ok === true, 'builds');
  if (r.ok) {
    ok(r.patch.margin === undefined,
      '🔴 an EXISTING margin is NOT in the patch — the owner’s 55% is not overwritten by the 40% default');
    ok(r.patch.version === undefined, 'nor is an existing version');
    ok(r.patch.locations !== undefined, 'but a genuinely absent key IS filled');
    ok(!r.plumbingWritten.includes('margin') && r.plumbingWritten.includes('locations'),
      'and the result reports exactly which keys it filled');
  }
  const bare = buildAcceptancePatch({ accepted, config: { taxRate: 0.0825 } });
  if (bare.ok) {
    ok(bare.plumbingWritten.length === Object.keys(EMPTY_COST_CONFIG).length,
      'on LAWNS’s one-key row every plumbing key is absent, so every one is filled — in ONE write');
    const loc = (bare.patch.locations as { labor: { rate: number | null; hours: number | null } }[])[0];
    ok(loc.labor.rate === null && loc.labor.hours === null,
      'the labour block arrives EMPTY — null, not 0, because a zero wage is a claim (D-9)');
    ok((bare.patch.margin as { baseline: number }).baseline === 0.40, 'margin baseline is 0.40');
  }
}

// ══ §G WHAT IS ALREADY CONFIGURED IS NEVER RE-OFFERED ════════════════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-06-01', lines: [sale('Oak', 1, 1000), disc('CD10%', 1000, -100)] },
    { doc: '2', date: '2026-06-02', lines: [sale('Oak', 1, 2000), disc('CD15%', 2000, -300)] },
  ]));
  const configured = {
    taxRate: 0.0825,
    discountTypes: [{ name: 'Contractor', tiers: [{ name: 'CD10%', basis: 'retail_minus_percent', discountPercent: 10 }] }],
  };
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: configured, statedTiers: [] });
  ok(rev.alreadyConfigured.length === 1 && rev.alreadyConfigured[0] === 'CD10%', 'the configured tier is reported');
  ok(rev.sure.length === 1 && rev.sure[0].tierName === 'CD15%', 'and only the NEW one is suggested');

  // The un-configured business must not read as configured just because the reader hands back a
  // seed. This is the difference between "she chose one Contractor tier at 0%" and "she has
  // chosen nothing", and the screen says opposite things about the two.
  const seedNames = normalizeDiscountTypes({ taxRate: 0.0825 }).flatMap(t => t.tiers.map(x => x.name));
  ok(seedNames.length > 0, 'normalizeDiscountTypes DOES return a seed for an unconfigured business');
  const bare = buildDiscountReview({ discounts: d, items: ITEMS, config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(bare.alreadyConfigured.length === 0,
    '🔴 and that seed is NOT counted as configured — an absence wearing a default is still an absence');
  ok(bare.sure.length === 2, 'so both tiers are offered to a business that has configured nothing');

  // 🔴 AND THE PROBE THAT CAN ACTUALLY FAIL — THE LEGACY BUSINESS. `normalizeDiscountTypes`
  // FORWARD-MIGRATES a flat `pricingTiers` when `discountTypes` is absent, so those tiers ARE
  // configured and resolve at checkout today. Keying "configured?" on `discountTypes` alone
  // re-offers her every tier she already has — and accepting one is then refused as a duplicate,
  // with nothing on screen explaining why. The probe above cannot see this: neither of ITS tally
  // names collides with the seed, so a broken rule filters nothing and still passes.
  const legacy = {
    taxRate: 0.0825,
    pricingTiers: [
      { name: 'retail', discountPercent: 0, isDefault: true },
      { name: 'CD10%', discountPercent: 10 },
    ],
  };
  ok(normalizeDiscountTypes(legacy).flatMap(t => t.tiers.map(x => x.name)).includes('CD10%'),
    'the legacy key really does forward-migrate — the premise this probe rests on, asserted not assumed');
  const leg = buildDiscountReview({ discounts: d, items: ITEMS, config: legacy, statedTiers: [] });
  ok(leg.alreadyConfigured.includes('CD10%'),
    '🔴 a tier configured the LEGACY way reads as configured — it is live at checkout, so offering it again is wrong');
  ok(leg.sure.length === 1 && leg.sure[0].tierName === 'CD15%', 'and only the genuinely new one is offered');

  // 🔴 AND THE OTHER HALF OF THE SAME RULE — the SEED itself must never suppress a real tier.
  // Hand-built for the same reason as §N: the seed's only tier is named `contractor`, which is
  // not in `DISCOUNT_ITEM_NAMES`, so a parsed fixture cannot collide with it and the assertion
  // would pass against a rule that never ran. That list is hand-kept and explicitly incomplete.
  const seedCollision = buildDiscountReview({
    discounts: {
      byName: [{
        itemName: 'contractor', lines: 6, withBase: 6, baseTotal: 6000, amountTotal: -600,
        verdicts: { equalsSubtotal: 6, belowSubtotal: 0, aboveSubtotal: 0, noBase: 0 },
        excludedFromBase: [], examples: [], percents: [{ pct: 10, lines: 6 }], mostRecent: '2026-08-01',
      }],
      unnamedDiscountLines: [],
    },
    items: [], config: { taxRate: 0.0825 }, statedTiers: [],
  });
  ok(seedNames.map(n => n.toLowerCase()).includes('contractor'),
    'the seed’s own tier really is named `contractor` — the collision this probe rests on');
  ok(seedCollision.alreadyConfigured.length === 0 && seedCollision.sure.length === 1,
    '🔴 a real discount named `contractor` is STILL OFFERED — the default the reader hands back for ' +
    'an unconfigured business cannot suppress a tier by sharing its name');
}

// ══ §H THE OWNER'S OWN NAMES, MEASURED AGAINST THE BOOKS ═════════════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-06-01', lines: [sale('Oak', 1, 1000), disc('CD10%', 1000, -100)] },
  ]));
  const rev = buildDiscountReview({
    discounts: d, items: ITEMS, config: { taxRate: 0.0825 },
    statedTiers: ['Contractor 35%', 'Contractor 25%'],
  });
  ok(rev.notSuggesting.length === 2, 'both stated tiers are ON the screen, not silently dropped');
  ok(rev.notSuggesting.every(s => s.invoiceLines === 0 && s.existsAsItem === false),
    '🔴 the ABSENCE is measured in both directions — no invoice line AND no item in her books');
  ok(rev.sure.every(s => s.tierName !== 'Contractor 35%'),
    'and neither is seeded — two real tiers beat four half-real ones');

  // A stated tier that DOES turn out to exist must report the difference, not the assumption.
  const rev2 = buildDiscountReview({ discounts: d, items: ITEMS, config: { taxRate: 0.0825 }, statedTiers: ['CD10%'] });
  ok(rev2.notSuggesting[0].invoiceLines === 1 && rev2.notSuggesting[0].existsAsItem === true,
    'a stated tier the books DO evidence reports its evidence rather than a blanket "not found"');
}

// ══ §I A SUGGESTION THE OWNER'S OWN EDITOR WOULD REJECT IS NEVER WRITTEN ═════════════════════
{
  const cfg = { taxRate: 0.0825 };
  const dup = buildAcceptancePatch({ accepted: [
    { typeName: 'Contractor', tierName: 'CD10%', percent: 10 },
    { typeName: 'Landscaper', tierName: 'cd10%', percent: 5 },
  ], config: cfg });
  ok(dup.ok === false, '🔴 duplicate tier names across DIFFERENT types are refused, case-insensitively');

  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: 'retail', percent: 10 }], config: cfg }).ok === false,
    '"retail" is refused — it is the reserved full-price floor');
  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: '  ', percent: 10 }], config: cfg }).ok === false,
    'an unnamed tier is refused');
  ok(buildAcceptancePatch({ accepted: [{ typeName: ' ', tierName: 'CD10%', percent: 10 }], config: cfg }).ok === false,
    'an unnamed TYPE is refused too — the tier would be unreachable under a blank heading');
  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: 'CD10%', percent: 101 }], config: cfg }).ok === false,
    'a percent over 100 is refused');
  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: 'CD10%', percent: -1 }], config: cfg }).ok === false,
    'and so is a negative one — a "discount" that charges more is not a discount');
  ok(buildAcceptancePatch({ accepted: [], config: cfg }).ok === false,
    'accepting nothing writes nothing');

  // ⚠️ BOTH ORDERINGS, BECAUSE ONE OF THEM PASSES ON A HALF-BROKEN CHECK. With the lookup
  // case-folded but the INSERT not (or vice versa), lower-then-upper passes while upper-then-lower
  // refuses. A single ordering tests whichever half happens to be right.
  const dupRev = buildAcceptancePatch({ accepted: [
    { typeName: 'Contractor', tierName: 'cd10%', percent: 10 },
    { typeName: 'Landscaper', tierName: 'CD10%', percent: 5 },
  ], config: cfg });
  ok(dupRev.ok === false,
    '🔴 and refused in the OTHER order too — the duplicate check must fold case on BOTH the lookup and the insert');
}

// ══ §O 🔴 ACCEPTING A SUGGESTION NEVER DELETES A TIER SHE SET UP HERSELF ═════════════════════
{
  // The patch REPLACES `config.discountTypes` wholesale (that is what a jsonb key write does), so
  // everything already configured has to be carried INTO it. Get this wrong and pressing "add the
  // 1 I've ticked" silently deletes every tier the owner typed by hand.
  const hers = {
    taxRate: 0.0825,
    discountTypes: [
      { name: 'Landscaper', tiers: [{ name: 'Landscaper tier 1', basis: 'retail_minus_percent', discountPercent: 5 }] },
      { name: 'Contractor', tiers: [{ name: 'Contractor tier 1', basis: 'retail_minus_percent', discountPercent: 12 }] },
    ],
  };
  const built = buildAcceptancePatch({
    accepted: [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }],
    config: hers,
  });
  ok(built.ok === true, 'builds');
  if (built.ok) {
    const types = built.patch.discountTypes as { name: string; tiers: { name: string; discountPercent: number }[] }[];
    const all = types.flatMap(t => t.tiers.map(x => x.name));
    ok(all.includes('Landscaper tier 1'),
      '🔴 her Landscaper tier SURVIVES — a type untouched by the acceptance is carried through whole');
    ok(all.includes('Contractor tier 1'),
      '🔴 and her hand-typed Contractor tier survives too, in the very type the new one joins');
    ok(all.includes('CD10%') && all.length === 3, 'the accepted tier is ADDED, making three, not replacing two');
    const contractor = types.find(t => t.name === 'Contractor')!;
    ok(contractor.tiers.length === 2,
      'and it lands INSIDE the existing Contractor type rather than minting a second type of the same name');
    ok(contractor.tiers.find(x => x.name === 'Contractor tier 1')!.discountPercent === 12,
      'her 12% is untouched — the merge adds, it does not re-rate what was there');

    // Through the real reader, since that is what checkout will do with it.
    const merged = { ...hers, ...built.patch };
    ok(resolveTier('Landscaper tier 1', normalizeDiscountTypes(merged)).discountPercent === 5,
      '🔴 and a customer already tagged `Landscaper tier 1` still resolves to 5% after the write');
  }
}

// ══ §J 🔴 THE ROUND TRIP — what is written is what checkout will charge ══════════════════════
{
  // The single most consequential fact on the screen: `customers.price_tier` is matched EXACTLY
  // and case-sensitively at tierPricing.ts:203. This proves the written name resolves, and that
  // one character off silently resolves to the retail floor at FULL PRICE.
  const built = buildAcceptancePatch({
    accepted: [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }],
    config: { taxRate: 0.0825 },
  });
  ok(built.ok === true, 'builds');
  if (built.ok) {
    const merged = { ...{ taxRate: 0.0825 }, ...built.patch };
    const types = normalizeDiscountTypes(merged);
    ok(resolveTier('CD10%', types).discountPercent === 10,
      '🔴 a customer tagged `CD10%` resolves to 10% off — through the SAME reader checkout uses');
    ok(resolveTier('cd10%', types).discountPercent === 0,
      '🔴 AND `cd10%` — one letter’s case off — resolves SILENTLY to the retail floor at full price. ' +
      'This is why the screen must show the exact string it writes');
    ok(resolveTier('CD10%', types).basis === 'retail_minus_percent',
      'the basis is percent-off-retail, so D-39 keeps it off services');
  }
}

// ══ §K AN EMPTY READ IS NOT AN EMPTY BUSINESS ════════════════════════════════════════════════
{
  const none = buildDiscountReview({ discounts: null, items: [], config: { taxRate: 0.0825 }, statedTiers: ['X'] });
  ok(none.sure.length === 0 && none.needsHer.length === 0,
    'no capture ⇒ no suggestions — the screen has nothing to claim and claims nothing');
  ok(none.notSuggesting.length === 1 && none.notSuggesting[0].invoiceLines === 0,
    'a stated tier still renders, honestly reporting zero evidence');
  ok(none.configRowPresent === true && none.taxRatePresent === true,
    'and the config facts are reported independently of the capture');
  const noRow = buildDiscountReview({ discounts: null, items: [], config: null, statedTiers: [] });
  ok(noRow.configRowPresent === false && noRow.taxRatePresent === false,
    'a MISSING ROW is distinguishable from a config that merely has no tax rate (A9 — absent is not empty)');
  ok(noRow.plumbingMissing.length === Object.keys(EMPTY_COST_CONFIG).length,
    'and every plumbing key reads as missing');
}

// ══ §L A DISCOUNT LINE WITH NO USABLE BASE IS COUNTED, NEVER MEASURED ════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-06-01', lines: [sale('Oak', 1, 1000), disc('CD10%', null, -100)] },
    { doc: '2', date: '2026-06-02', lines: [sale('Oak', 1, 1000), disc('CD10%', 0, -100)] },
  ]));
  const row = d.byName.find(r => r.itemName === 'CD10%')!;
  ok(row.lines === 2, 'both lines are counted');
  ok(row.percents.length === 0,
    '🔴 neither is MEASURED — a null base and a ZERO base both contribute nothing rather than ' +
    'dividing to Infinity and rendering as a confident number');
  ok(row.verdicts.noBase === 1, 'the null-base line is where it always was, in the verdicts');
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(rev.needsHer.length === 1 && rev.needsHer[0].refusal === REVIEW_REFUSALS.noMeasurableRate,
    'and the review refuses it with the reason she can act on');
  ok(rev.needsHer[0].measuredLines === 0 && rev.needsHer[0].lines === 2,
    '🔴 the screen can say "2 lines, none of them measurable" — the shortfall is visible, not hidden');
}

// ══ §N A DISCOUNT ITEM NAMED `retail` IS REFUSED BEFORE IT IS EVER SUGGESTED ════════════════
{
  // `retail` is the reserved full-price floor: `resolveTier` returns the floor for it and the
  // Discounts editor rejects it by name. A business whose books hold a discount item called
  // "Retail" must not be offered a tier the platform would read as "no discount at all".
  //
  // ⚠️ THIS ONE FIXTURE IS HAND-BUILT RATHER THAN PARSED, AND THE REASON MATTERS. The tally can
  // only ever hold a name from `DISCOUNT_ITEM_NAMES`, which today does not include `retail` — so
  // a parsed fixture could not reach this guard at all, and the probe would be asserting against
  // a code path it cannot enter (R-33). That list is HAND-KEPT and its own comment says it is not
  // assumed complete; the day `Retail` is added to it, this guard is what stands between that and
  // a suggested tier that silently charges full price. §A's parse-it-for-real reasoning is about
  // the Qty-is-the-base assumption and does not apply to a name check.
  const rev = buildDiscountReview({
    discounts: {
      byName: [{
        itemName: 'Retail', lines: 4, withBase: 4, baseTotal: 4000, amountTotal: -400,
        verdicts: { equalsSubtotal: 4, belowSubtotal: 0, aboveSubtotal: 0, noBase: 0 },
        excludedFromBase: [], examples: [], percents: [{ pct: 10, lines: 4 }], mostRecent: '2026-06-01',
      }],
      unnamedDiscountLines: [],
    },
    items: [], config: { taxRate: 0.0825 }, statedTiers: [],
  });
  ok(rev.sure.length === 0, '🔴 it is NOT suggested, even though its rate measured cleanly at 10%');
  ok(rev.needsHer.length === 1 && rev.needsHer[0].refusal === REVIEW_REFUSALS.reservedName,
    'it is refused by NAME, with the reserved-name reason');
  ok(rev.needsHer[0].percent === null,
    'and it carries no percent — a suggestion the editor would reject is not a suggestion');
}

// ══ §M THE ITEM'S PUBLISHED RATE IS READ, AND REFUSED WHEN IT IS NOT A FRACTION ══════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-06-01', lines: [sale('Oak', 1, 1000), disc('CD10%', 1000, -100)] },
  ]));
  const flat: DiscountItemFact[] = [{ id: '3', name: 'CD10%', description: 'Contractor Discount', unitPrice: -25 }];
  const rev = buildDiscountReview({ discounts: d, items: flat, config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(rev.sure[0].itemPercent === null,
    '🔴 a −$25 FLAT item is not read as "2500% off" — a value ≥ 1 is refused as a fraction');
  ok(rev.sure[0].sourcesAgree === false,
    'so the two sources do NOT claim agreement — two nulls are not a match, and neither is one');
  ok(rev.sure[0].percent === 10, 'while the INVOICE-measured rate still stands on its own evidence');

  const noItem = buildDiscountReview({ discounts: d, items: [], config: { taxRate: 0.0825 }, statedTiers: [] });
  ok(noItem.sure[0].item === null && noItem.sure[0].sourcesAgree === false,
    'an unmatched item leaves the row on ONE source, saying so, rather than dropping the row');
  ok(noItem.sure[0].typeName === 'CD10%',
    'and the type falls back to the item name — never to a word we made up');
}

console.log(`\n  discountReview — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
