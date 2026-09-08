/**
 * ── measure-service-review-mutants — can we put a price on a checkout menu her books never said? ──
 *
 * PURPOSE:      Every mutant here either invents a service price, puts a $0 on a live service,
 *               routes a tree or a discount onto a checkout menu, or lets a second pass overwrite
 *               what the first one wrote. The four that matter most:
 *                 · W1 removes the $0 refusal. `service_offerings.price` is NOT NULL, so a row
 *                   saved at zero tells a customer that planting is FREE — and it is one toggle
 *                   away from being live on a screen that never says why it is off.
 *                 · W3 removes the duplicate-name refusal, which is the whole of "a second pass
 *                   does not eat the first pass's work": without it, running the screen twice
 *                   puts a second row on her menu with a different price and nothing says which
 *                   one checkout uses.
 *                 · C2 routes a DISCOUNT to the services screen. `Military Discount 5%` carries
 *                   UnitPrice −0.05, so accepting it would put a NEGATIVE-priced row on checkout.
 *                 · P1 reverts the majority rule to "the most common price", which is the shape
 *                   of #280's defect: a number that looks measured and was not. Tree removal —
 *                   $50 on 19 of 83 lines — would be published as a $50 service.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, AND A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. A mutant that
 *    cannot reach its target has proven nothing, and reporting it as CAUGHT is the same false
 *    green as a probe that cannot fail (tech-debt #182 / #186 / #210 · R-33 · §6 r19).
 *
 * Run: node scripts/measure-service-review-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const REVIEW = ROOT + 'packages/shared/src/business-logic/serviceReview.ts';
const PARSER = ROOT + 'packages/shared/src/quickbooks/invoiceList.ts';

const SUITES = [
  'packages/shared/src/business-logic/serviceReview.test.ts',
  'packages/shared/src/quickbooks/invoiceList.test.ts',
];

function suitesAreGreen() {
  for (const s of SUITES) {
    try {
      execSync(`set -o pipefail; ${ESB} ${s} --bundle --platform=node --format=cjs --log-level=error 2>/dev/null | node`,
        { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    } catch { return false; }
  }
  return true;
}

const MUTANTS = [
  // ── THE PRICE VERDICT: where a number becomes a suggestion ───────────────────────────────
  { id: 'P1', file: REVIEW, why: '🔴 #280\'s SHAPE — the majority test goes, so "the most common price" is published as fact: tree removal, $50 on 19 of 83 lines, becomes a $50 service',
    from: '  if (share > PRICE_MAJORITY && top.lines >= MIN_AGREEING_LINES) {',
    to:   '  if (top.lines >= 1) {' },
  { id: 'P2', file: REVIEW, why: '🔴 one sale is a price — a tree sold ONCE at $1,250 reports 100% agreement and outranks a service billed eighty times',
    from: '  if (share > PRICE_MAJORITY && top.lines >= MIN_AGREEING_LINES) {',
    to:   '  if (share > PRICE_MAJORITY) {' },
  { id: 'P3', file: REVIEW, why: '🔴 a plurality is treated as a majority — the threshold flips to "at least as often as any other price"',
    from: '  if (share > PRICE_MAJORITY && top.lines >= MIN_AGREEING_LINES) {',
    to:   '  if (share > 0 && top.lines >= MIN_AGREEING_LINES) {' },
  { id: 'P4', file: REVIEW, why: '🔴 $0 lines are counted as a price — a service given away nineteen times reports a $0 rate and the warranty becomes a free product',
    from: '  if (pricedLines === 0) {',
    to:   '  if (false) {' },
  { id: 'P5', file: REVIEW, why: 'the prices are ordered by VALUE not by frequency, so the "most common" price is whichever is cheapest',
    from: '  const priced = [...tally.prices].sort((a, b) => b.lines - a.lines || a.price - b.price);',
    to:   '  const priced = [...tally.prices].sort((a, b) => a.price - b.price);' },
  { id: 'P6', file: REVIEW, why: 'a never-billed item is priced from its list price — her product list becomes evidence of what she charges',
    from: "    return { confidence: 'never-billed', price: null, ...none, refusal: SERVICE_REFUSALS.neverBilled };",
    to:   "    return { confidence: 'sure', price: 1, ...none, refusal: null };" },
  { id: 'P7', file: REVIEW, why: 'the two refusals collapse — "we have not watched this enough" and "she negotiates every job" read the same on screen',
    from: '    refusal: share > PRICE_MAJORITY ? SERVICE_REFUSALS.noInvoicePrice : SERVICE_REFUSALS.pricesDisagree,',
    to:   '    refusal: SERVICE_REFUSALS.pricesDisagree,' },

  // ── THE CLASSIFICATION: what may reach a checkout menu at all ────────────────────────────
  { id: 'C1', file: REVIEW, why: '🔴 A TREE REACHES THE SERVICES MENU — Lacey Oak 45G is typed `Service` in QuickBooks and booked to nursery stock',
    from: '  if (ACCOUNT_STOCK.test(acct)) {',
    to:   '  if (false) {' },
  { id: 'C2', file: REVIEW, why: '🔴 A DISCOUNT REACHES THE SERVICES MENU — `Military Discount 5%` carries UnitPrice −0.05, so accepting it puts a NEGATIVE-priced row on checkout',
    from: "  if (isDiscountItem({ name: item.name, description: item.description, unitPrice: item.unitPrice })\n      || ACCOUNT_DISCOUNT.test(acct)) {",
    to:   '  if (false) {' },
  { id: 'C3', file: REVIEW, why: '🔴 the discount test drops the ACCOUNT clause, so an item her books file under "Discounts given" but whose name says nothing is offered as a service',
    from: '      || ACCOUNT_DISCOUNT.test(acct)) {',
    to:   '      || false) {' },
  { id: 'C4', file: REVIEW, why: 'a refund or a late fee is offered as a sellable service',
    from: '  if (ACCOUNT_NOT_A_SALE.test(acct)) {',
    to:   '  if (false) {' },
  { id: 'C5', file: REVIEW, why: '🔴 the account is matched by ID rather than by NAME — a tenant literal, correct at LAWNS and wrong at every other customer',
    from: 'const ACCOUNT_STOCK = /nursery\\s+stock|plant\\s+sales/i;',
    to:   'const ACCOUNT_STOCK = /^94$/;' },
  { id: 'C6', file: REVIEW, why: '🔴 an item whose account says nothing is silently treated as settled — the row gets pre-ticked on a question her books left open',
    from: "  return { destination: DESTINATIONS.service, contested: true,\n    reason: acct",
    to:   "  return { destination: DESTINATIONS.service, contested: false,\n    reason: acct" },
  { id: 'C7', file: REVIEW, why: 'a `Sales of Product Income` row is treated as settled, so bags and bubblers are both pre-ticked as services',
    from: '  if (ACCOUNT_GOODS.test(acct)) {\n    return { destination: DESTINATIONS.service, contested: true,',
    to:   '  if (ACCOUNT_GOODS.test(acct)) {\n    return { destination: DESTINATIONS.service, contested: false,' },
  { id: 'C8', file: REVIEW, why: 'a QuickBooks FOLDER becomes a product — the arithmetic that turned 685 into "647" in the first place',
    from: "  if ((item.type ?? '').toLowerCase() === 'category') {",
    to:   '  if (false) {' },

  // ── PRE-SELECTION: what is ticked FOR her ────────────────────────────────────────────────
  { id: 'S1', file: REVIEW, why: '🔴 a contested row is sorted as if settled — the rows her books could not classify crowd out the ones they could',
    from: '    Number(a.destination.contested) - Number(b.destination.contested)\n    || b.amountTotal - a.amountTotal',
    to:   '    b.amountTotal - a.amountTotal' },
  { id: 'S2', file: REVIEW, why: '🔴 a bundle is offered for acceptance — DIW, $64,466 across 21 different prices, gets a price box',
    from: "  const notSuggesting = candidates.filter(r =>\n    r.bundle || r.price.confidence === 'free').sort(byMoney);",
    to:   '  const notSuggesting = ([] as ServiceRow[]);' },
  { id: 'S3', file: REVIEW, why: '🔴 the bundle test fires on THREE lines — `Backyard Delivery` at three different prices is told it cannot be priced at all, instead of asking her for the price',
    from: '    const bundle = (price.pricedLines >= MIN_AGREEING_LINES * 2',
    to:   '    const bundle = (price.pricedLines >= 1' },
  { id: 'S4', file: REVIEW, why: '🔴 the bundle test keys on the top price\'s share again — tree removal (85 invoices) is reclassified as a bundle and she loses the ability to price it',
    from: '                    && price.distinctPrices / price.pricedLines >= BUNDLE_DISTINCT_SHARE)',
    to:   '                    && price.agreeing / price.pricedLines < 0.25)' },
  { id: 'S5', file: REVIEW, why: 'the NAMED-bundle fallback goes, so a bundle is only ever caught by measurement — kept as a check that the measurement really does the work',
    from: '                || BUNDLE_ITEM_NAMES.some(n => n.toLowerCase() === item.name.trim().toLowerCase());',
    to:   '                || false;' },
  { id: 'S6', file: REVIEW, why: '🔴 something ALREADY on her menu is offered again — the same service twice, at two prices, with nothing saying which one checkout uses',
    from: '  const candidates = rows.filter(r => r.destination.destination === DESTINATIONS.service && !r.alreadyOffered);',
    to:   '  const candidates = rows.filter(r => r.destination.destination === DESTINATIONS.service);' },

  // ── THE UNIT ─────────────────────────────────────────────────────────────────────────────
  { id: 'U1', file: REVIEW, why: '🔴 everything is charged per plant — the trip charge, billed once per order on 516 of 523 lines, multiplies by the number of trees',
    from: '  if (share >= UNIT_ORDER_SHARE) return { unit: \'order\', priceType: \'flat\', ...base, unknown: false };',
    to:   '  if (false) return { unit: \'order\', priceType: \'flat\', ...base, unknown: false };' },
  { id: 'U2', file: REVIEW, why: '🔴 the middle band is decided FOR her — a service charged once on some jobs and per tree on others is silently given one rule',
    from: '  return { unit: null, priceType: null, ...base, unknown: true };',
    to:   "  return { unit: 'order', priceType: 'flat', ...base, unknown: false };" },
  { id: 'U3', file: REVIEW, why: 'an absent Qty stops counting as one — Intuit omits it on single-unit lines, so every per-order service reads as per-plant',
    from: '      if (l.qty === null || l.qty === 1) a.qtyOneLines++;',
    to:   '      if (l.qty === 1) a.qtyOneLines++;' },

  // ── THE LADDER ───────────────────────────────────────────────────────────────────────────
  { id: 'L1', file: REVIEW, why: '🔴 the sizes are pooled UNFOLDED — `15 gallon` and `15 Gallon` become two rungs, one pot split in half with two wrong premiums (tech-debt #56\'s defect, new address)',
    from: '    const folded = normalizeSize(r.size);',
    to:   '    const folded = r.size ?? \'\';' },
  { id: 'L2', file: REVIEW, why: '🔴 a rung evidenced ONCE is printed beside one evidenced 259 times, at the same weight',
    from: '    .filter(([, e]) => e.lines >= MIN_AGREEING_LINES)',
    to:   '    .filter(() => true)' },
  { id: 'L3', file: REVIEW, why: '🔴 the premium is computed against plants sold ONLY installed — a difference measured against a price that does not exist',
    from: '  const both = [...perItem.values()].filter(r => r.inst.length > 0 && r.bare.length > 0);',
    to:   '  const both = [...perItem.values()].filter(r => r.inst.length > 0);' },
  { id: 'L4', file: REVIEW, why: 'the premium becomes a RATIO printed as dollars — "installed costs 2× more" rendered as "$2 a tree"',
    from: '    const delta = median(r.inst) - median(r.bare);',
    to:   '    const delta = median(r.inst) / median(r.bare);' },
  { id: 'L5', file: REVIEW, why: 'a size fragment that is not a container size is printed as a rung — `24 inch box` gets a planting price',
    from: "    if (!/^\\d+(?:\\.\\d+)? Gallon$/.test(folded)) continue;",
    to:   '    if (folded === \'\') continue;' },
  { id: 'L6', file: REVIEW, why: 'the rungs are unordered, so a ladder reads 45 · 7 · 95 · 15 and stops being a ladder',
    from: '    .sort((a, b) => parseFloat(a.size) - parseFloat(b.size));',
    to:   '    .sort(() => 0);' },

  // ── THE WRITE ────────────────────────────────────────────────────────────────────────────
  { id: 'W1', file: REVIEW, why: '🔴 A $0 PRICE IS WRITTEN TO A LIVE SERVICE — which tells a customer that planting a 95-gallon oak is free',
    from: '    if (!Number.isFinite(a.price) || a.price <= 0) {',
    to:   '    if (false) {' },
  { id: 'W2', file: REVIEW, why: '🔴 a NEGATIVE price is written — exactly what a discount item becomes if one ever reaches this screen',
    from: '    if (!Number.isFinite(a.price) || a.price <= 0) {',
    to:   '    if (!Number.isFinite(a.price)) {' },
  { id: 'W3', file: REVIEW, why: '🔴 A SECOND PASS OVERWRITES THE FIRST — the duplicate-name refusal goes, so running the screen twice puts two rows on her menu at two prices',
    from: '    if (taken.has(k)) {',
    to:   '    if (false) {' },
  { id: 'W4', file: REVIEW, why: '🔴 the duplicate test becomes case-SENSITIVE — "tc" and "TC" are written as two services',
    from: '  const taken = new Set(existing.map(e => e.name.trim().toLowerCase()));',
    to:   '  const taken = new Set(existing.map(e => e.name.trim()));' },
  { id: 'W5', file: REVIEW, why: '🔴 a category Postgres will REFUSE is written — `uncategorized` fails the CHECK and the insert is lost, which is what `seedServiceOfferings` does today',
    from: '    if (!(SERVICE_CATEGORIES as readonly string[]).includes(a.category)) {',
    to:   '    if (false) {' },
  { id: 'W6', file: REVIEW, why: 'a price_unit outside the CHECK is written — the same rejection, one column over',
    from: '    if (!(PRICE_UNITS as readonly string[]).includes(a.priceUnit)) {',
    to:   '    if (false) {' },
  { id: 'W7', file: REVIEW, why: '🔴 the write is no longer all-or-nothing — one bad row lands the others, so the screen and the menu disagree with nothing saying so',
    from: '      return { ok: false, reason: `"${name}" is already on your services list. Nothing was written — edit the existing one on the Services card below instead.` };',
    to:   '      continue;' },
  { id: 'W8', file: REVIEW, why: 'an unscoped insert — the row lands with no business_id and RLS decides where it goes',
    from: "  if (!businessId) return { ok: false, reason: 'No business is selected, so nothing was written.' };",
    to:   '  if (false) return { ok: false, reason: \'\' };' },
  { id: 'W9', file: REVIEW, why: '🔴 `price_type` stops being derived from `price_unit` — the two columns can now disagree, and checkout reads one while the screen showed the other',
    from: "      price_type: a.priceUnit === 'order' ? 'flat' : 'per_unit',",
    to:   "      price_type: 'flat'," },
  { id: 'W10', file: REVIEW, why: 'the row lands INACTIVE — she presses the button, nothing appears at checkout, and nothing says why',
    from: '      is_active: true,',
    to:   '      is_active: false,' },
  { id: 'W11', file: REVIEW, why: 'a nameless service is written — a blank row on a checkout menu nobody can find again',
    from: "    if (!name) return { ok: false, reason: 'A service with no name cannot be saved — name it or untick it.' };",
    to:   '' },

  // ── THE SECOND SOURCE ────────────────────────────────────────────────────────────────────
  { id: 'B1', file: REVIEW, why: '🔴 an unread website reports as read — an empty list becomes "we checked your site and found nothing"',
    from: '  const siteServices_ = siteServices\n    .map(s => s.trim())\n    .filter(s => s.length > 0)',
    to:   "  const siteServices_ = ['(none found)']\n    .map(s => s.trim())\n    .filter(s => s.length > 0)" },
  { id: 'B2', file: REVIEW, why: '🔴 the wording match inverts — a service her site names and her books bill is reported as unmatched, and vice versa',
    from: '      matchedItem: haystack.some(h => h.includes(name.toLowerCase())),',
    to:   '      matchedItem: !haystack.some(h => h.includes(name.toLowerCase())),' },

  // ── THE PARSER ───────────────────────────────────────────────────────────────────────────
  { id: 'X1', file: PARSER, why: '🔴 the install wording is never read, so NO line counts as planted and the whole placement ladder disappears',
    from: '        installInDescription: mentionsInstall(str(l?.Description)),',
    to:   '        installInDescription: false,' },
  { id: 'X2', file: PARSER, why: '🔴 EVERY line counts as planted — there is no bare price left to subtract and the premium collapses to nothing',
    from: '        installInDescription: mentionsInstall(str(l?.Description)),',
    to:   '        installInDescription: true,' },
  { id: 'X3', file: PARSER, why: '🔴 `warranty` alone counts as planting — a warranty is sold on collected trees too, so bare sales are marked installed and the measured premium is crushed toward zero',
    from: "export const INSTALL_WORDING = /\\binstall(?:ed|ation|s)?\\b|\\bplanted\\b|\\bDIW\\b|\\bFDIW\\b/i;",
    to:   'export const INSTALL_WORDING = /warranty/i;' },
  { id: 'X4', file: PARSER, why: 'the line\'s own income account is dropped — the classification loses the axis it reads from',
    from: '        itemAccountName: str((detail?.ItemAccountRef as { name?: unknown } | null)?.name),',
    to:   '        itemAccountName: null,' },
  { id: 'X5', file: PARSER, why: 'the size is no longer read from the line, so the ladder has no rungs to pool by',
    from: '        sizeFromDescription: readProductFromDescription(str(l?.Description)).size,',
    to:   '        sizeFromDescription: null,' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const originals = new Map(FILES.map(f => [f, readFileSync(f, 'utf8')]));
let caught = 0, survived = 0, errored = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suitesAreGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    const original = originals.get(m.file);
    const occurrences = original.split(m.from).length - 1;
    if (occurrences === 0) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    if (occurrences > 1) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text appears ${occurrences}× — the mutant cannot say which site it changed`);
      errored++; continue;
    }
    const mutated = original.replace(m.from, m.to);
    writeFileSync(m.file, mutated);
    if (readFileSync(m.file, 'utf8') !== mutated) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the mutated file did not read back as written`);
      errored++; writeFileSync(m.file, original); continue;
    }
    if (suitesAreGreen()) { survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); }
    else                  { caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); }
    writeFileSync(m.file, original);
  }
} finally {
  for (const [f, o] of originals) writeFileSync(f, o);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
