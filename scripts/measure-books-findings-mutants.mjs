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
  { id: 'M3', why: '🔴 the sort becomes worst-first — the review reads as an audit of her work',
    from: '    tierIndex(a.tier) - tierIndex(b.tier) ||\n    (ruleIndex.get(a.id) as number) - (ruleIndex.get(b.id) as number));',
    to:   '    b.population.matched - a.population.matched);' },
  { id: 'M4', why: 'an unmeasured finding still carries a sentence with a zero in it',
    from: "        sentence: '', population: { matched: 0, of: 0, noun: '' },\n      });\n      continue;\n    }\n\n    const r = rule.run(input);",
    to:   "        sentence: 'Nothing found.', population: { matched: 0, of: 0, noun: '' },\n      });\n      continue;\n    }\n\n    const r = rule.run(input);" },
  { id: 'M5', why: '🔴 an unpriced item is compared against a floor of $0 — every sale reads at-or-above list',
    from: '          if (floor === undefined) continue;         // no published price → not comparable',
    to:   '          const f2 = floor ?? 0; if (false) continue;' },
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
