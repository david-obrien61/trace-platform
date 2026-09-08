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

// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 M7, M8 AND M11 STOOD HERE AND WERE REMOVED ON 2026-09-08, NOT WEAKENED — THEIR TARGETS ARE
//    GONE, AND A MUTANT THAT NEVER APPLIES IS AN ERROR THIS HARNESS ALREADY FAILS ON.
// ══════════════════════════════════════════════════════════════════════════════════════════
// They mutated `possible-duplicate-customers` (summing the two duplicate tallies), the
// `customers-with-no-contact` derivation, and the `duplicate-invoice-numbers` sentence. All three
// rules were RETIRED that day, so their from-text no longer exists in the source. Their defects
// did not go away with them and are re-aimed at the successors: N1 is M7's shape at the union,
// N17 is M8's at the reach rule, N12 is M11's at the same-document rule. Deleting a mutant whose
// rule was retired is honest; deleting one whose rule still exists would be a rubber stamp.
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
    from: '      id: rule.id, version: rule.version, tier: rule.tier, shape: rule.shape, quoted: rule.quoted,',
    to:   "      id: rule.id, version: rule.version, tier: rule.tier, shape: 'written-never-read' as never, quoted: rule.quoted," },
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
  { id: 'M9', why: 'a finding gains a `blocking` flag — something a caller could stop the import on',
    from: '      needsAnswer: null as Finding[\'needsAnswer\'],',
    to:   '      needsAnswer: null as Finding[\'needsAnswer\'], blocking: true,' },
  { id: 'M10', why: 'Category folders count as never-sold stock',
    from: "      const sellable = x.items.filter(it => (it.type ?? '').toLowerCase() !== 'category');",
    to:   '      const sellable = x.items;' },

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

  // ── 2026-09-08: the FIVE PROPERTIES and the FOUR RULE-LEVEL FIXES. Every mutant below makes
  //    the review SHORTER, TIDIER or MORE CONFIDENT than the truth — a union collapsing back into
  //    a max(), a clean result quietly vanishing, a window forgotten so "in the period we read"
  //    becomes "never", a retired rule coming back to life.
  { id: 'N1', why: '🔴 THE UNION COLLAPSES BACK INTO max() — the exact defect that reported 52 where the answer was 72, silently discarding every record one axis found and the other did not',
    from: '      const records = groups.reduce((n, g) => n + g.members.length, 0);',
    to:   '      const records = Math.max(0, ...groups.map(g => g.members.length));' },
  { id: 'N2', why: '🔴 the duplicate rule FALLS BACK to the breakdown when it has no rows — a plausible, smaller, wrong number with nothing on screen saying anything was substituted',
    from: '      if (!x.customerRows || x.customerRows.length === 0) return null;',
    to:   '      if (!x.customerRows || x.customerRows.length === 0) return x.customers ? { matched: Math.max(x.customers.byEmail.recordsInvolved, x.customers.byPhone.recordsInvolved), of: x.customers.total, noun: \'customer records\', sentence: \'At least some customers look like duplicates.\' } : null;' },
  { id: 'N3', why: '🔴 the rows lose their AXIS — a merge decision made without knowing whether the evidence was a shared email or a spelling',
    from: '          id: m.id, label: m.label, group: g.key, note: axisNames(g),',
    to:   '          id: m.id, label: m.label, group: g.key, note: null,' },
  { id: 'N4', why: '🔴 the row CAP moves from the runner into nothing at all — 1,900 real people painted onto a screen',
    from: '      rows: found === null ? null : found.slice(0, FINDING_ROW_LIMIT),',
    to:   '      rows: found,' },
  { id: 'N5', why: '🔴 `rowsTotal` reports what SURVIVED the cap rather than what was found — a truncated list presented as the whole answer',
    from: '      rowsTotal: found === null ? 0 : found.length,',
    to:   '      rowsTotal: found === null ? 0 : Math.min(found.length, FINDING_ROW_LIMIT),' },
  { id: 'N6', why: '🔴 `clean` becomes matched === 0 WITHOUT requiring `measured` — a rule that could not run certifies the business',
    from: '      clean: r.matched === 0,',
    to:   '      clean: true,' },
  { id: 'N7', why: '🔴 a CLEAN finding still declares the capabilities it blocks — "Campaigns · Review requests" printed beside "every record has an email or a phone"',
    from: '      blocks: r.matched === 0 ? [] : (rule.blocks ?? []),',
    to:   '      blocks: rule.blocks ?? [],' },
  { id: 'N8', why: '🔴 the WINDOW is read from the clock instead of the walk — "the period we read" becomes today, and the same capture answers differently tomorrow',
    from: '    const dates = (input.invoices ?? []).map(i => i.txnDate).filter((d): d is string => !!d).sort();\n    if (dates.length === 0) return null;\n    return { from: dates[0], to: dates[dates.length - 1], of: \'your invoice history\' };',
    to:   '    const dates = (input.invoices ?? []).map(i => i.txnDate).filter((d): d is string => !!d).sort();\n    if (dates.length === 0) return null;\n    return { from: dates[0], to: new Date().toISOString().slice(0, 10), of: \'your invoice history\' };' },
  { id: 'N9', why: '🔴 a rule that could not run LOSES its window — "we could not work this out" stops saying which period it could not work it out for',
    from: "      window: rule.needs.includes('invoices') ? window : null,",
    to:   '      window: null,' },
  { id: 'N10', why: '🔴 EVERY rule gets a window, including the ones that never read a dated walk — a duplicate customer given an expiry date',
    from: "      window: rule.needs.includes('invoices') ? window : null,",
    to:   '      window,' },
  { id: 'N11', why: '🔴 the retired `duplicate-invoice-numbers` COMES BACK TO LIFE — one field compared, 44 invoices under a risk heading, and a bookkeeper\'s deliberate renumbering reported as a defect',
    from: "export const RETIRED_RULE_IDS = [\n  'duplicate-invoice-numbers',",
    to:   "export const RETIRED_RULE_IDS = [\n  'duplicate-invoice-numbers-x'," },
  { id: 'N12', why: '🔴 the same-document rule keys on the DOCUMENT NUMBER again, so a renumbered pair reads as a duplicate and a genuinely duplicated document goes invisible the moment somebody renumbers one of the two',
    from: '        matched: c.recordsInvolved, of: c.comparable, noun: \'invoices we could compare\',',
    to:   '        matched: c.repeatedNumberGroups * 2, of: c.comparable, noun: \'invoices we could compare\',' },
  { id: 'N13', why: '🔴 collections are counted as missing delivery dates again — three-fifths of her history reported as broken when it is correct',
    from: '        matched: c.dispatchedWithoutDate, of: c.seen, noun: \'invoices\',',
    to:   '        matched: c.dispatchedWithoutDate + c.collectedWithoutDate, of: c.seen, noun: \'invoices\',' },
  { id: 'N14', why: '🔴 the unreadable-size denominator goes back to EVERY row — the 33 that are 15, and a count that can never reach zero because 18 of them are unfixable',
    from: '        matched: c.productsUnreadable, of: c.products, noun: \'products\',',
    to:   '        matched: c.unreadableAcrossEverything, of: c.products, noun: \'products\',' },
  { id: 'N15', why: '🔴 the giveaway finding is valued at RETAIL — "$48,000 of warranty" for something that cost them a third of that, the overstatement Lauren already caught once',
    from: '        value: c.costTotal,',
    to:   '        value: c.retailTotalNotToBeQuoted,' },
  { id: 'N16', why: '🔴 the giveaway denominator goes back to the giveaways themselves, so an invoice walk with NO LINES AT ALL reports "nothing was given away" — a pass over an empty set',
    from: '      const allLines = x.invoices.reduce((n, i) => n + i.lines.length, 0);',
    to:   '      const allLines = Math.max(1, x.invoices.reduce((n, i) => n + i.lines.length, 0));' },
  { id: 'N17', why: '🔴 the reach finding leads with the UNREACHABLE count — "125 customers cannot be reached" instead of "1,828 can", same numbers, opposite meaning',
    from: "        sentence: `${plural(r.withEither, 'of your customers can', 'of your customers can')} be reached",
    to:   "        sentence: `${plural(r.withNeither, 'of your customers cannot', 'of your customers cannot')} be reached" },
  { id: 'N18', why: '🔴 the no-purchase finding says "never bought" — a claim about the years before the window that nobody measured',
    from: "which is not the same as never having bought, because your books before this period were not read.`,",
    to:   "and have never bought anything from you.`," },
  { id: 'N19', why: '🔴 a rule\'s VERSION is dropped from the finding, so stored results cannot be paired with the question that produced them',
    from: '      id: rule.id, version: rule.version, tier: rule.tier,',
    to:   '      id: rule.id, version: 0, tier: rule.tier,' },
  { id: 'N20', why: '🔴 the tax finding counts the exemption REASON as evidence — a note somebody typed standing in for a document an auditor accepts',
    from: '      const unevidenced = Math.max(0, pw.nonTaxable - pw.withResaleNumber);',
    to:   '      const unevidenced = Math.max(0, pw.nonTaxable - pw.withExemptionReason);' },
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
