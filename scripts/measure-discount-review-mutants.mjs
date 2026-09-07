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
  // ── THE TALLY: where a rate is measured ──────────────────────────────────────────────────
  { id: 'T1', file: TALLY, why: '🔴 a ZERO base divides to Infinity — a discount renders as an infinite percent off',
    from: '        if (l.qty !== null && l.qty > 0 && l.amount !== null) {',
    to:   '        if (l.qty !== null && l.amount !== null) {' },
  { id: 'T2', file: TALLY, why: '🔴 every line mints its own entry — the distribution stops distributing and one rate reads as many',
    from: '          const seen = row.percents.find(x => x.pct === pct);\n          if (seen) seen.lines++; else row.percents.push({ pct, lines: 1 });',
    to:   '          row.percents.push({ pct, lines: 1 });' },
  { id: 'T3', file: TALLY, why: '🔴 `mostRecent` becomes the OLDEST date — "last used" would report a discount as stale that is in weekly use',
    from: "        if (inv.txnDate && (row.mostRecent === null || inv.txnDate.localeCompare(row.mostRecent) > 0)) {",
    to:   "        if (inv.txnDate && (row.mostRecent === null || inv.txnDate.localeCompare(row.mostRecent) < 0)) {" },
  { id: 'T4', file: TALLY, why: 'the last invoice read wins instead of the latest one — order of arrival mistaken for order of time',
    from: "        if (inv.txnDate && (row.mostRecent === null || inv.txnDate.localeCompare(row.mostRecent) > 0)) {",
    to:   "        if (inv.txnDate) {" },
  { id: 'T5', file: TALLY, why: '🔴 the sign is dropped — a −$100 discount on a $1000 base reports as −10% off',
    from: '          const pct = Math.round((Math.abs(l.amount) / l.qty) * 100 * 100) / 100;',
    to:   '          const pct = Math.round((l.amount / l.qty) * 100 * 100) / 100;' },
  { id: 'T6', file: TALLY, why: 'the rates stop being ordered by use — the OUTLIER could lead and read as the usual rate',
    from: '        .map(r => ({ ...r, percents: [...r.percents].sort((a, b) => b.lines - a.lines || a.pct - b.pct) }))',
    to:   '        .map(r => ({ ...r, percents: [...r.percents] }))' },

  // ── THE REVIEW: what gets suggested ──────────────────────────────────────────────────────
  { id: 'R1', file: REVIEW, why: '🔴 THE HEADLINE — a discount used at TWO different rates is suggested anyway, at whichever one happened to be commonest',
    from: '  else if (rates.length > 1) refusal = REVIEW_REFUSALS.ratesDisagree;',
    to:   '  else if (rates.length > 99) refusal = REVIEW_REFUSALS.ratesDisagree;' },
  { id: 'R2', file: REVIEW, why: '🔴 a discount whose rate could NOT be measured is suggested with no number at all',
    from: '  if (rates.length === 0) refusal = REVIEW_REFUSALS.noMeasurableRate;',
    to:   '  if (false) refusal = REVIEW_REFUSALS.noMeasurableRate;' },
  { id: 'R3', file: REVIEW, why: '🔴 the refusal is ignored at the split — everything lands in "we\'re sure", refusals included',
    from: '    if (r.refusal === null && r.percent !== null) sure.push(r); else needsHer.push(r);',
    to:   '    if (r.percent !== null || r.refusal !== null) sure.push(r); else needsHer.push(r);' },
  { id: 'R4', file: REVIEW, why: 'an ALREADY-CONFIGURED tier is offered again in a different case — she accepts it and the write is refused as a duplicate',
    from: '    if (configured.has(r.tierName.trim().toLowerCase())) { alreadyConfigured.push(r.tierName); continue; }',
    to:   '    if (configured.has(r.tierName)) { alreadyConfigured.push(r.tierName); continue; }' },
  { id: 'R5', file: REVIEW, why: '🔴 a LEGACY business (flat `pricingTiers`, no `discountTypes`) is re-offered every tier it already has — and accepting one is then refused as a duplicate with nothing on screen saying why',
    from: '  const seeded = !config || (config.discountTypes === undefined && config.pricingTiers === undefined);',
    to:   '  const seeded = !config || config.discountTypes === undefined;' },
  { id: 'R5b', file: REVIEW, why: '🔴 the SEED reads as configured — a business that has set up nothing is told its tiers are already there',
    from: '  const configured = seeded ? new Set<string>() : configuredNames;',
    to:   '  const configured = configuredNames;' },
  { id: 'R6', file: REVIEW, why: '🔴 a −$25 FLAT discount item is read as "2500% off" — a confident number from a field that never meant a fraction',
    from: '  if (!Number.isFinite(p) || p <= 0 || p >= 1) return null;',
    to:   '  if (!Number.isFinite(p) || p <= 0) return null;' },
  { id: 'R7', file: REVIEW, why: 'two sources "agree" when only one of them produced a number — a corroboration claim with nothing behind it',
    from: '    sourcesAgree: percent !== null && itemPercent !== null && Math.abs(percent - itemPercent) < 0.005,',
    to:   '    sourcesAgree: percent !== null || itemPercent !== null,' },
  { id: 'R8', file: REVIEW, why: 'the type suggestion keeps the noise word — every tier lands under a type called "Contractor Discount"',
    from: "    .filter(w => !/^discounts?$/i.test(w) && !/^disc\\.?$/i.test(w))",
    to:   '    .filter(() => true)' },
  { id: 'R9', file: REVIEW, why: '🔴 a name we could not improve on becomes EMPTY rather than itself — the type silently blanks and the write refuses',
    from: '  return kept || src;',
    to:   '  return kept;' },
  { id: 'R10', file: REVIEW, why: 'a stated tier that DOES exist in the books reports zero evidence — the absence stops being measured',
    from: '      invoiceLines: tally?.lines ?? 0,',
    to:   '      invoiceLines: 0,' },
  { id: 'R11', file: REVIEW, why: 'the reserved `retail` name is suggested as a tier — the editor would reject it and checkout reads it as no discount',
    from: "  if (tally.itemName.trim().toLowerCase() === RETAIL_TIER_NAME) {",
    to:   '  if (false) {' },
  { id: 'R12', file: REVIEW, why: 'a MISSING config row is indistinguishable from one that merely has no tax rate (A9 — absent is not empty)',
    from: '    configRowPresent: config !== null,',
    to:   '    configRowPresent: true,' },

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
  { id: 'P4', file: REVIEW, why: '🔴 duplicate tier names differing only in CASE are written — two tiers, one customer tag, and only one of them ever resolves',
    from: '    if (seen.has(tier.toLowerCase())) {',
    to:   '    if (seen.has(tier)) {' },
  { id: 'P4b', file: REVIEW, why: '🔴 the same defect from the INSERT side — the lookup folds case and the store does not, so the check half-works and one ordering slips through',
    from: '    seen.add(tier.toLowerCase());',
    to:   '    seen.add(tier);' },
  { id: 'P5', file: REVIEW, why: 'the reserved `retail` floor can be written as a discount tier',
    from: "    if (tier.toLowerCase() === RETAIL_TIER_NAME) {",
    to:   '    if (false) {' },
  { id: 'P6', file: REVIEW, why: '🔴 a percent outside 0–100 is written — a 101% discount pays the customer to take the tree',
    from: '    if (!Number.isFinite(a.percent) || a.percent < 0 || a.percent > 100) {',
    to:   '    if (!Number.isFinite(a.percent)) {' },
  { id: 'P7', file: REVIEW, why: '🔴 accepted tiers REPLACE the configured ones instead of merging — every tier she set up by hand is deleted by accepting one suggestion',
    from: '  for (const ty of existing) byType.set(ty.name.trim().toLowerCase(), { name: ty.name, tiers: [...ty.tiers] });',
    to:   '  void existing;' },
  { id: 'P8', file: REVIEW, why: 'accepting NOTHING still writes — a config rewritten by a button press that selected no rows',
    from: '  if (accepted.length === 0) {',
    to:   '  if (false) {' },
  { id: 'P9', file: REVIEW, why: 'an unnamed TYPE is written — the tier lands under a blank heading and cannot be found again',
    from: "    if (!type) return { ok: false, reason: `\"${tier}\" has no discount type — name the type or remove the row.` };",
    to:   '' },
  { id: 'P10', file: REVIEW, why: 'the basis stops being percent-off-retail — D-39 would no longer keep the discount off services',
    from: "    ty.tiers.push({ name: a.tierName.trim(), basis: 'retail_minus_percent', discountPercent: a.percent });",
    to:   "    ty.tiers.push({ name: a.tierName.trim(), basis: 'at_cost', discountPercent: a.percent });" },

  // ── THE FINDING: the correction that started this ────────────────────────────────────────
  { id: 'F1', file: FINDINGS, why: '🔴 THE CORRECTION REVERTED — a discount taken off the trees and not off the delivery is reported as broken, and the finding offers to "fix" it into discounting her own labour',
    from: '      const unstated = rows.filter(r => r.verdicts.noBase > 0);',
    to:   '      const unstated = rows.filter(r => r.verdicts.belowSubtotal > 0);' },
  { id: 'F2', file: FINDINGS, why: '🔴 a base ABOVE the whole invoice stops firing — a percentage of more than everything is reported as fine',
    from: '      const overRun  = rows.filter(r => r.verdicts.aboveSubtotal > 0);',
    to:   '      const overRun  = [];' },
  { id: 'F3', file: FINDINGS, why: 'the sentence stops saying tree-only is CORRECT — the next reader re-files it as a defect, which is how it got filed the first time',
    from: '      const treeClause = treeOnly.length',
    to:   '      const treeClause = false' },
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
