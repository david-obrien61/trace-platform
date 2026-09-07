/**
 * ── measure-discount-review-mutants — can we suggest a rate nobody granted, or delete the tax? ──
 *
 * PURPOSE:      Every mutant here either invents a discount rate, suggests one the owner never
 *               agreed to, silently re-offers something already configured, or breaks the one
 *               write-safety gate that stands between this screen and a deleted sales-tax rate.
 *               The two that matter most are P1 and F1:
 *                 · P1 removes the null-config refusal. `mergePricingConfig` FAILS OPEN on an
 *                   empty read — `data:null` with no error makes its `current` `{}` and the write
 *                   REPLACES the whole config. At LAWNS that deletes `taxRate: 0.0825` and every
 *                   invoice after it charges $0 tax under a redline.
 *                 · F1 reverts the books-rule correction, so a discount taken off the trees and
 *                   not off the delivery is reported to the owner as broken — and the finding
 *                   then offers to "fix" it into discounting her own labour.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, AND A MUTANT THAT NEVER APPLIED IS AN ERROR, NOT A PASS. A mutant that
 *    cannot reach its target has proven nothing, and reporting it as CAUGHT is the same false
 *    green as a probe that cannot fail (tech-debt #182 / #186 / R-33).
 *
 * ⚠️ THE ANCHOR IS VERIFIED IN-WINDOW — the applied file is re-read and compared before the
 *    suites run, rather than trusting that `replace` did what it was asked.
 *
 * Run: node scripts/measure-discount-review-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const ESB  = ROOT + 'node_modules/.bin/esbuild';

const REVIEW   = ROOT + 'packages/shared/src/business-logic/discountReview.ts';
const TALLY    = ROOT + 'packages/shared/src/quickbooks/invoiceList.ts';
const FINDINGS = ROOT + 'packages/shared/src/quickbooks/booksFindings.ts';
const CONFIG   = ROOT + 'packages/shared/src/business-logic/CostToProduce.ts';
const PARSER   = TALLY;   // the parse and the tally live in one file; named apart for readability

const SUITES = [
  'packages/shared/src/business-logic/discountReview.test.ts',
  'packages/shared/src/quickbooks/booksFindings.test.ts',
  'packages/shared/src/quickbooks/invoiceList.test.ts',
];

function suitesAreGreen() {
  for (const s of SUITES) {
    try {
      execSync(`${ESB} ${s} --bundle --platform=node --format=cjs --log-level=error 2>/dev/null | node`,
        { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    } catch { return false; }
  }
  return true;
}

const MUTANTS = [
  // ── THE TALLY: where a rate is derived ───────────────────────────────────────────────────
  { id: 'T1', file: TALLY, why: '🔴 THE SHIPPED DEFECT ITSELF — the base becomes the line\'s Qty (always 1), so $182.50 renders as 18250%',
    from: '        const base = otherChargedCents > 0 ? otherChargedCents / 100 : null;',
    to:   '        const base = l.qty && l.qty > 0 ? l.qty : null;' },
  { id: 'T2', file: TALLY, why: '🔴 the division disappears entirely — every amount becomes a percent',
    from: '          derivedPct = Math.round((Math.abs(amt) / base) * 100 * 100) / 100;',
    to:   '          derivedPct = Math.round(Math.abs(amt) * 100 * 100) / 100;' },
  { id: 'T3', file: TALLY, why: '🔴 the base includes the DISCOUNT lines — a discount is measured against a total inflated by itself',
    from: '      if (isAnyDiscount(l)) continue;\n      if ((l.detailType ?? \'\') === \'SubTotalLineDetail\') continue;',
    to:   '      if ((l.detailType ?? \'\') === \'SubTotalLineDetail\') continue;' },
  { id: 'T4', file: TALLY, why: "🔴 Intuit's SubTotal line is counted as a charge — every base doubles and every derived rate halves",
    from: "      if ((l.detailType ?? '') === 'SubTotalLineDetail') continue;\n      const c = cents(l.amount);",
    to:   '      const c = cents(l.amount);' },
  { id: 'T5', file: TALLY, why: '🔴 a $0 giveaway is rated at 0% — dragging a clean 5% programme into "rates disagree" and refusing a good suggestion',
    from: '        if (amt === 0) {',
    to:   '        if (false) {' },
  { id: 'T6', file: TALLY, why: 'every line mints its own entry — the distribution stops distributing and one rate reads as many',
    from: '          const seen = row.percents.find(x => x.pct === derivedPct);\n          if (seen) seen.lines++; else row.percents.push({ pct: derivedPct, lines: 1 });',
    to:   '          row.percents.push({ pct: derivedPct, lines: 1 });' },
  { id: 'T7', file: TALLY, why: '🔴 `mostRecent` becomes the OLDEST date — "last used" reports a live discount as stale',
    from: "        if (inv.txnDate && (row.mostRecent === null || inv.txnDate.localeCompare(row.mostRecent) > 0)) {",
    to:   "        if (inv.txnDate && (row.mostRecent === null || inv.txnDate.localeCompare(row.mostRecent) < 0)) {" },
  { id: 'T8', file: TALLY, why: '🔴 the base is accumulated in DOLLARS while being divided as CENTS — every derived rate comes out 100× too big, which is the shipped defect arriving by a different route',
    from: '      if (c !== null && c > 0) otherChargedCents += c;',
    to:   '      if (c !== null && c > 0) otherChargedCents += c / 100;' },

  // ── THE NATIVE POPULATION: the rate QuickBooks states ────────────────────────────────────
  { id: 'N1', file: TALLY, why: '🔴 THE OTHER HALF OF THE DEFECT — native discount lines are not read at all, so CD10% and CD15% have no evidence and 67 of 88 discounts stay invisible',
    from: "      if ((l.detailType ?? '') === QBO_DETAIL_TYPE.discount) {",
    to:   '      if (false) {' },
  { id: 'N2', file: TALLY, why: '🔴 a FIXED-DOLLAR discount is read as a percentage — $461.96 becomes a rate',
    from: '        if (l.percentBased === true && l.discountPercent !== null) {',
    to:   '        if (l.discountPercent !== null || l.percentBased === false) {' },
  { id: 'N3', file: TALLY, why: 'fixed-dollar discounts stop being reported at all — money given away, invisible',
    from: '          fixedDollarLines++;\n          fixedDollarTotal += amt;',
    to:   '          fixedDollarTotal += amt;' },
  { id: 'N4', file: TALLY, why: 'the rates are ordered by COUNT, so the largest money is buried — 28 lines at 5% ($2,906) above 4 at 20% ($15,173)',
    from: '        .sort((a, b) => b.amountTotal - a.amountTotal || a.pct - b.pct),',
    to:   '        .sort((a, b) => b.lines - a.lines || a.pct - b.pct),' },
  { id: 'N5', file: TALLY, why: 'the customer count becomes a line count — "26 customers" when it was 28 lines to 26 people',
    from: '          if (inv.customerId) r.customers.add(inv.customerId);',
    to:   '          if (inv.customerId) r.customers.add(inv.customerId + String(r.lines));' },
  { id: 'N6', file: PARSER, why: '🔴 the stated rate is never parsed — every native line falls back to being unreadable',
    from: '        discountPercent: num(detail?.DiscountPercent),',
    to:   '        discountPercent: null,' },
  { id: 'N7', file: PARSER, why: 'PercentBased is ignored, so a flat-dollar discount is treated as percent-based',
    from: "        percentBased: typeof detail?.PercentBased === 'boolean' ? (detail.PercentBased as boolean) : null,",
    to:   '        percentBased: true,' },

  // ── THE REVIEW ───────────────────────────────────────────────────────────────────────────
  { id: 'R1', file: REVIEW, why: '🔴 THE PRICE CARD IS IGNORED — the suggestion falls back to a derived rate, and CD10%/CD15% (no item lines at all) lose their percent',
    from: '  let percent = published;',
    to:   '  let percent = derived.length === 1 ? derived[0].pct : null;' },
  { id: 'R2', file: REVIEW, why: '🔴 an item publishing NO rate is suggested anyway — MD10 at $0 is offered as a tier with no percent',
    from: '  if (published === null) {\n    refusal = REVIEW_REFUSALS.noPublishedRate;',
    to:   '  if (false) {\n    refusal = REVIEW_REFUSALS.noPublishedRate;' },
  { id: 'R3', file: REVIEW, why: '🔴 a line that gave MORE than the programme says no longer refuses — the anomaly is suggested as if clean',
    from: '  } else if (derivedAbove > 0) {',
    to:   '  } else if (false) {' },
  { id: 'R5', file: REVIEW, why: '🔴 the AMBIGUITY is hidden — "14 lines at 10%" is presented as evidence for CD10% when three items publish 10%',
    from: '  const sharesRateWith = published === null ? [] : allItems',
    to:   '  const sharesRateWith = published === null ? [] : ([] as DiscountItemFact[])' },
  { id: 'R6', file: REVIEW, why: '🔴 a −$25 FLAT item is read as "2500% off" — the same 100× family, one field over',
    from: '  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;',
    to:   '  if (!Number.isFinite(p) || p <= 0) return null;' },
  { id: 'R7', file: REVIEW, why: '🔴 MD10 is dropped from the screen entirely — a real discount programme, invisible, because its price is $0 rather than negative',
    from: "  if (/^(CD|FD|MD)\\d/i.test(name)) return true;",
    to:   '  if (false) return true;' },
  { id: 'R8', file: REVIEW, why: 'a rate her books granted that nothing names stops being reported — LAWNS\'s $15,173 at 20% disappears',
    from: '  const unnamedRates: UnnamedRate[] = rates',
    to:   '  const unnamedRates: UnnamedRate[] = ([] as typeof rates)' },
  { id: 'R9', file: REVIEW, why: 'a NAMED rate is also listed as unnamed — every rate she uses is reported as a mystery',
    from: '    .filter(r => !publishedRates.some(p => Math.abs(p - r.pct) < 0.005))',
    to:   '    .filter(() => true)' },
  { id: 'R10', file: REVIEW, why: 'the type suggestion keeps the noise word — every tier lands under "Contractor Discount, 10%"',
    from: "    .filter(w => !/^discounts?,?$/i.test(w) && !/^disc\\.?$/i.test(w) && !/^off$/i.test(w))",
    to:   '    .filter(() => true)' },
  { id: 'R11', file: REVIEW, why: '🔴 a name we could not improve on becomes EMPTY rather than itself — the type silently blanks and the write refuses',
    from: '  return kept || src;',
    to:   '  return kept;' },
  { id: 'R12', file: REVIEW, why: 'the reserved `retail` name is offered as a tier — checkout reads it as NO discount',
    from: "  if (item.name.trim().toLowerCase() === RETAIL_TIER_NAME) {",
    to:   '  if (false) {' },
  { id: 'R13', file: REVIEW, why: '🔴 a LEGACY business (flat `pricingTiers`) is re-offered every tier it already has',
    from: '  const seeded = !config || (config.discountTypes === undefined && config.pricingTiers === undefined);',
    to:   '  const seeded = !config || config.discountTypes === undefined;' },
  { id: 'R14', file: REVIEW, why: '🔴 the SEED reads as configured — a business that set up nothing is told its tiers are already there',
    from: '  const configured = seeded ? new Set<string>() : configuredNames;',
    to:   '  const configured = configuredNames;' },
  { id: 'R15', file: REVIEW, why: 'an ALREADY-CONFIGURED tier is offered again in a different case, then refused as a duplicate',
    from: '    if (configured.has(r.tierName.trim().toLowerCase())) { alreadyConfigured.push(r.tierName); continue; }',
    to:   '    if (configured.has(r.tierName)) { alreadyConfigured.push(r.tierName); continue; }' },
  { id: 'R16', file: REVIEW, why: 'a MISSING config row is indistinguishable from one that merely has no tax rate (A9)',
    from: '    configRowPresent: config !== null,',
    to:   '    configRowPresent: true,' },
  { id: 'R17', file: REVIEW, why: 'a stated tier that DOES exist in her books reports zero evidence — the absence stops being measured',
    from: '      existsAsItem: items.some(i => i.name.trim().toLowerCase() === k),',
    to:   '      existsAsItem: false,' },

  // ── THE PATCH: the write that must not clobber ───────────────────────────────────────────
  { id: 'P1', file: REVIEW, why: '🔴 THE MONEY ONE — an unreadable config no longer refuses. mergePricingConfig fails open, the write replaces the whole record, and LAWNS loses taxRate 0.0825',
    from: '  if (config === null) {',
    to:   '  if (false) {' },
  { id: 'P2', file: REVIEW, why: "🔴 plumbing is written UNCONDITIONALLY — the owner's own 55% margin is overwritten by the 40% platform default",
    from: '    if (config[k] === undefined) { patch[k] = v; plumbingWritten.push(k); }',
    to:   '    { patch[k] = v; plumbingWritten.push(k); }' },
  { id: 'P3', file: CONFIG, why: '🔴 EMPTY_COST_CONFIG grows a taxRate — the key sets stop being disjoint and the plumbing write would overwrite a live sales-tax rate',
    from: "export const EMPTY_COST_CONFIG: CostToProduceConfig = {\n  version: 1,",
    to:   "export const EMPTY_COST_CONFIG: CostToProduceConfig = {\n  taxRate: 0,\n  version: 1," },
  { id: 'P4', file: REVIEW, why: '🔴 THE CEILING IS GONE AT THE WRITE — 18250% is written as a discount percent',
    from: '    if (!Number.isFinite(a.percent) || a.percent < 0 || a.percent > PERCENT_CEILING) {',
    to:   '    if (!Number.isFinite(a.percent) || a.percent < 0) {' },
  { id: 'P5', file: REVIEW, why: 'duplicate tier names differing only in CASE are written — two tiers, one customer tag',
    from: '    if (seen.has(tier.toLowerCase())) {',
    to:   '    if (seen.has(tier)) {' },
  { id: 'P6', file: REVIEW, why: 'the same defect from the INSERT side — the lookup folds case and the store does not, so one ordering slips through',
    from: '    seen.add(tier.toLowerCase());',
    to:   '    seen.add(tier);' },
  { id: 'P7', file: REVIEW, why: 'the reserved `retail` floor can be written as a discount tier',
    from: "    if (tier.toLowerCase() === RETAIL_TIER_NAME) {",
    to:   '    if (false) {' },
  { id: 'P8', file: REVIEW, why: '🔴 accepted tiers REPLACE the configured ones — every tier she set up by hand is deleted by accepting one suggestion',
    from: '  for (const ty of existing) byType.set(ty.name.trim().toLowerCase(), { name: ty.name, tiers: [...ty.tiers] });',
    to:   '  void existing;' },
  { id: 'P9', file: REVIEW, why: 'accepting NOTHING still writes — a config rewritten by a press that selected no rows',
    from: '  if (accepted.length === 0) {',
    to:   '  if (false) {' },
  { id: 'P10', file: REVIEW, why: 'an unnamed TYPE is written — the tier lands under a blank heading and cannot be found again',
    from: "    if (!type) return { ok: false, reason: `\"${tier}\" has no discount type — name the type or remove the row.` };",
    to:   '' },
  { id: 'P11', file: REVIEW, why: 'the basis stops being percent-off-retail — D-39 would no longer keep the discount off services',
    from: "    ty.tiers.push({ name: a.tierName.trim(), basis: 'retail_minus_percent', discountPercent: a.percent });",
    to:   "    ty.tiers.push({ name: a.tierName.trim(), basis: 'at_cost', discountPercent: a.percent });" },

  // ── THE FINDING ──────────────────────────────────────────────────────────────────────────
  { id: 'F1', file: FINDINGS, why: '🔴 a rate that IS named is reported as unnamed — every discount she uses becomes a finding',
    from: '      const unnamed = rates.filter(r => !published.some(p => Math.abs(p - r.pct) < 0.005));',
    to:   '      const unnamed = rates;' },
  { id: 'F2', file: FINDINGS, why: '🔴 nothing is ever flagged — $15,173 given at a rate nothing names is reported as clean',
    from: '      const unnamed = rates.filter(r => !published.some(p => Math.abs(p - r.pct) < 0.005));',
    to:   '      const unnamed = [] as typeof rates;' },
  { id: 'F3', file: FINDINGS, why: '🔴 the finding stops reading the published rate through the ONE shared reader — a second copy of the rule that produced "18250%" would grow back here',
    from: '        .map(i => itemPercentOf({ id: i.id, name: i.name, description: i.description, unitPrice: i.unitPrice }))',
    to:   '        .map(i => (i.unitPrice === null ? null : Math.round(Math.abs(i.unitPrice) * 10000) / 100))' },
  { id: 'F4', file: FINDINGS, why: 'the fixed-dollar clause disappears — money given away as flat amounts is never mentioned',
    from: "      const fixedClause = fixed.lines === 0 ? ''",
    to:   "      const fixedClause = true ? ''" },
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
