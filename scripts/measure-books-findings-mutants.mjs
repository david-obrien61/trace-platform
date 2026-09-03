/**
 * ── measure-books-findings-mutants — can the findings suite catch a comfortable lie? ──
 *
 * PURPOSE:      Every mutant here makes the review screen SHORTER, CLEANER and MORE CONFIDENT
 *               than the truth — a rule that quietly passes over an empty set, a rule that
 *               vanishes when it cannot run, a sort that becomes worst-first, a finding that
 *               drops its denominator. None of them looks wrong on screen, which is exactly why
 *               they have to be caught by something other than looking.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-books-findings-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/quickbooks/booksFindings.ts';
const SUITE  = 'packages/shared/src/quickbooks/booksFindings.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'M1', why: '🔴 a population of ZERO reports a clean result instead of not-measured',
    from: '    if (r.of === 0) {', to: '    if (false) {' },
  { id: 'M2', why: '🔴 rules that could not run are FILTERED OUT — a shorter, more confident list',
    from: '  return out.sort((a, b) =>', to: '  return out.filter(f => f.measured).sort((a, b) =>' },
  { id: 'M3', why: '🔴 the sort becomes worst-first by COUNT — the review reads as an audit of her work',
    from: '    Number(!a.measured) - Number(!b.measured) ||\n    tierIndex(a.tier) - tierIndex(b.tier) ||\n    worth(b) - worth(a) ||\n    (ruleIndex.get(a.id) as number) - (ruleIndex.get(b.id) as number));',
    to:   '    b.population.matched - a.population.matched);' },
  { id: 'M12', why: '🔴 the within-tier order stops using MONEY AT STAKE and reverts to the order a person typed',
    from: '    worth(b) - worth(a) ||',
    to:   '' },
  { id: 'M13', why: '🔴 findings that could not be computed are interleaved instead of coming last',
    from: '    Number(!a.measured) - Number(!b.measured) ||',
    to:   '' },
  { id: 'M14', why: '🔴 a NULL value sorts as ZERO — "not a money question" becomes "worth nothing"',
    from: '  const worth = (f: Finding) => (f.value === null ? -Infinity : f.value);',
    to:   '  const worth = (f: Finding) => (f.value ?? 0);' },
  { id: 'M15', why: '🔴 the recommendation\'s status-quo cost is AUTHORED rather than computed',
    from: '        statusQuoCost: shortfall,',
    to:   '        statusQuoCost: 6000,' },
  { id: 'M16', why: 'a finding loses its shape — a one-off finding wearing a rule\'s clothes',
    from: '      id: rule.id, tier: rule.tier, shape: rule.shape, quoted: rule.quoted,',
    to:   "      id: rule.id, tier: rule.tier, shape: 'written-never-read' as never, quoted: rule.quoted," },
  { id: 'M17', why: 'a rule blocked on a FIELD reports the generic blocked-on-policy sentence',
    from: '        notMeasured: rule.cannotCompute\n          ?? \'We cannot work this one out from your books on their own — it needs something only you can tell us.\',',
    to:   "        notMeasured: 'We cannot work this one out from your books on their own — it needs something only you can tell us.'," },
  { id: 'M18', why: '🔴 a measured finding\'s computed value is dropped, so the ordering silently flattens',
    from: '      value: r.value ?? null,',
    to:   '      value: null,' },
  { id: 'M19', why: 'the wording rule counts lines RECORDED as discounts as though they announced one',
    from: '          if (formal) { formalLines++; formalAmount += Math.abs(l.amount ?? 0); }\n          else if (l.discountInDescription) { wordingLines++; wordingAmount += Math.max(0, l.amount ?? 0); }',
    to:   '          if (l.discountInDescription) { wordingLines++; wordingAmount += Math.max(0, l.amount ?? 0); }\n          if (formal) { formalLines++; formalAmount += Math.abs(l.amount ?? 0); }' },
  { id: 'M20', why: '🔴 a catalogue with NO markup formula gets one invented and is then told it broke it',
    from: '      if (holds / ratios.length < 0.9) return null;',
    to:   '      if (false) return null;' },
  { id: 'M4', why: 'an unmeasured finding still carries a sentence with a zero in it',
    from: "        sentence: '', population: { matched: 0, of: 0, noun: '' },\n      });\n      continue;\n    }\n\n    const r = rule.run(input);",
    to:   "        sentence: 'Nothing found.', population: { matched: 0, of: 0, noun: '' },\n      });\n      continue;\n    }\n\n    const r = rule.run(input);" },
  { id: 'M5', why: '🔴 an unpriced item is compared against a floor of $0 — every sale reads at-or-above list',
    from: '          if (floor === undefined || floor <= 0) continue;   // no published price → not comparable',
    to:   '          if (false) continue;' },
  { id: 'M6', why: '🔴 notes, discounts and subtotals count as sales at $0 — findings manufactured from one invoice',
    from: '  return inv.lines.filter(l => l.itemName !== null && l.unitPrice !== null && (l.amount ?? 0) > 0);',
    to:   '  return inv.lines.filter(l => l.itemName !== null) as never;' },
  { id: 'M7', why: 'the duplicate-customer count SUMS the two tallies, double-counting the same records',
    from: '      const dup = Math.max(c.byEmail.recordsInvolved, c.byPhone.recordsInvolved);',
    to:   '      const dup = c.byEmail.recordsInvolved + c.byPhone.recordsInvolved;' },
  { id: 'M8', why: 'unreachable customers derived by subtraction instead of the field that means it',
    from: '        matched: x.customers.withNoContactAtAll, of: x.customers.total, noun: \'customers\',',
    to:   '        matched: x.customers.total - x.customers.withEmail, of: x.customers.total, noun: \'customers\',' },
  { id: 'M9', why: 'a finding gains a `blocking` flag — something a caller could stop the import on',
    from: '      needsAnswer: null as Finding[\'needsAnswer\'],',
    to:   '      needsAnswer: null as Finding[\'needsAnswer\'], blocking: true,' },
  { id: 'M10', why: 'Category folders count as never-sold stock',
    from: "      const sellable = x.items.filter(it => (it.type ?? '').toLowerCase() !== 'category');",
    to:   '      const sellable = x.items;' },
  { id: 'M11', why: 'a sentence leaks a QuickBooks field name to a nursery owner',
    from: "        sentence: `${plural(dupInvoices, 'invoice shares', 'invoices share')} an invoice number",
    to:   "        sentence: `${plural(dupInvoices, 'invoice shares', 'invoices share')} a DocNumber" },

  // ── 2026-09-03: the withdrawn price-card rule, the per-line basis, the giveaway
  //    exclusion, and the receivables rule whose old refusal was false. Every one of these
  //    makes the screen MORE confident: a bigger headline, a fuller-looking list, or a
  //    question quietly closed.
  { id: 'M19', why: '🔴 THE WITHDRAWN PRICE-CARD RULE COMES BACK TO LIFE, restoring a $1.6M headline worded about a price card it never read',
    from: "    cannotCompute: 'We cannot check your sales against your printed price list, because we have not been given it. What we can check is the price recorded on each product in QuickBooks, and that is the next line — it is not the same thing, and it should not be read as if it were.',\n    run: () => null,",
    to:   "    cannotCompute: 'We cannot check your sales against your printed price list, because we have not been given it. What we can check is the price recorded on each product in QuickBooks, and that is the next line — it is not the same thing, and it should not be read as if it were.',\n    run: (x) => x.items && x.invoices ? { matched: 1, of: 3, noun: 'sales', sentence: 'sales were charged below your price card.', value: 1607416 } : null," },
  { id: 'M20', why: '🔴 the shortfall goes back to being multiplied by QUANTITY — deliberate volume pricing rendered as a headline loss',
    from: '            shortfall += floor - charged;',
    to:   '            shortfall += (floor - charged) * (l.qty !== null && l.qty > 0 ? l.qty : 1);' },
  { id: 'M21', why: '🔴 a line charged EXACTLY $0 is scored as a sale below list — a giveaway counted at the full list price, the largest gap possible',
    from: '          if (charged === 0) continue;',
    to:   '          if (charged === 0) { /* scored */ }' },
  { id: 'M21b', why: '🔴 giveaways are counted inside the priced loop again, where pricedLines has already removed all 74 of them — freeLines becomes 0 and `limits` describes a filter that never fired',
    from: '          if (l.unitPrice === 0) freeLines++;',
    to:   '          if (l.unitPrice === 0 && false) freeLines++;' },
  { id: 'M27', why: '🔴 the sentence leads with the TOTAL again — an owner reads $724,273 first and hears "you lost three-quarters of a million dollars", when what the data says is "we discount routinely by about 13%"',
    from: 'sentence: `Across ${plural(span,',
    to:   'sentence: `${money(shortfall)} below list. Across ${plural(span,' },
  { id: 'M22', why: '🔴 the successor rule stops naming WHICH price it compares against — the exact defect that made the withdrawn rule unshippable',
    from: 'of the price recorded in QuickBooks',
    to:   'of your price list' },
  { id: 'M23', why: '🔴 receivables reads the CLOCK instead of the supplied read date — the same capture answers differently tomorrow and nothing can assert against it',
    from: '      if (!x.invoices || !x.asOf) return null;\n      const asOf = Date.parse(`${x.asOf}T00:00:00Z`);',
    to:   '      if (!x.invoices) return null;\n      const asOf = Date.parse(new Date().toISOString().slice(0, 10) + `T00:00:00Z`);' },
  { id: 'M24', why: '🔴 an invoice whose balance we could not read is ABSORBED into the same silence as a settled one — a null read as a zero, and the reader cannot tell "paid" from "we could not see"',
    from: '        if (inv.balance === null) { unreadable++; continue; }',
    to:   '        if (inv.balance === null) { continue; }' },
  { id: 'M25', why: '🔴 EVERY open invoice is reported as more than 30 days past due — alarming, and wrong',
    from: '        if ((asOf - due) / 86_400_000 > 30) { lateTotal += inv.balance; lateCount++; }',
    to:   '        { lateTotal += inv.balance; lateCount++; }' },
  { id: 'M26', why: '🔴 the invoice with no readable due date is dropped from the total owed instead of declared',
    from: '        if (!inv.dueDate) { undated++; continue; }',
    to:   '        if (!inv.dueDate) { continue; }' },
];

const original = readFileSync(TARGET, 'utf8');
let caught = 0, survived = 0, errored = 0;
try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    if (!original.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in the source — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(TARGET, original.replace(m.from, m.to));
    if (suiteIsGreen()) { survived++; console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); }
    else               { caught++;  console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); }
  }
} finally {
  writeFileSync(TARGET, original);
}

console.log(`\n  ── ${caught}/${MUTANTS.length} caught · ${survived} survived · ${errored} never applied ──`);
if (survived > 0 || errored > 0) process.exit(1);
