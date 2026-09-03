/**
 * ── measure-books-report-mutants — can a section go missing without anyone noticing? ──
 *
 * PURPOSE:      This document gets emailed to an accountant and nobody who reads it can ask it
 *               a question. Every mutant here REMOVES or WEAKENS something the page must state
 *               — a read that was never run, the denominator under a count, the line that says
 *               no corrections were made, the escaping that keeps a catalogue from breaking the
 *               markup. Each produces a shorter, calmer, more confident document, and reading it
 *               would not reveal any of them: a report with a section missing looks complete.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-books-report-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/quickbooks/booksReport.ts';
const SUITE  = 'packages/shared/src/quickbooks/booksReport.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'R1', why: '🔴 a read that was NEVER RUN is omitted instead of named — it reads as "nothing to report"',
    from: "    return `<li><strong>${esc(WALK_TITLE[w.entity])}</strong> — not read.",
    to:   "    return ``; return `<li><strong>${esc(WALK_TITLE[w.entity])}</strong> — not read." },
  { id: 'R2', why: '🔴 the "no corrections were made" line is dropped — its absence reads as "none were needed"',
    from: '  const corrections = r.corrections.length === 0',
    to:   '  const corrections = false' },
  { id: 'R3', why: 'the generation stamp becomes a precise timestamp — an analysis dressed as a transaction record',
    from: '    generatedAt: input.generatedAt.toISOString().slice(0, 10),',
    to:   '    generatedAt: input.generatedAt.toISOString(),' },
  { id: 'R4', why: '🔴 a count loses its denominator — "9" alone reads as a verdict rather than a proportion',
    from: '    <p class="p">${f.population.matched.toLocaleString()} of ${f.population.of.toLocaleString()} ${esc(f.population.noun)}</p></li>`;',
    to:   '    <p class="p">${f.population.matched.toLocaleString()} ${esc(f.population.noun)}</p></li>`;' },
  { id: 'R5', why: '🔴 escaping is removed — an item name with a bracket breaks the document they are about to hand someone',
    from: "  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')",
    to:   "  return s; return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')" },
  { id: 'R6', why: '🔴 "What we could not work out" is dropped — a silent omission reads as a clean bill of health',
    from: "  const notComputed = r.notComputed.length === 0 ? '' :",
    to:   "  const notComputed = true ? '' :" },
  { id: 'R7', why: '🔴 a ZERO remedy cost renders as a blank — and a blank reads as an unknown, not as free',
    from: "<strong>${r.remedyCost === 0 ? 'Nothing — it is a decision, not a purchase' : esc(money(r.remedyCost))}</strong>",
    to:   "<strong>${r.remedyCost === 0 ? '' : esc(money(r.remedyCost))}</strong>" },
  { id: 'R8', why: '🔴 an INCOMPLETE read claims the total it never reached',
    from: '  if (!w.complete || w.expected === null) {',
    to:   '  if (false) {' },
  { id: 'R9', why: '⚠️ the recommendation drops what it does NOT fix — found out on day two',
    from: '    <p class="lim">What it does not fix: ${esc(r.limits)}</p>',
    to:   '' },
  { id: 'R10', why: "Intuit's entity word reaches the page instead of the owner's word",
    from: '  return `<li><strong>${esc(WALK_TITLE[w.entity])}</strong> — read in full',
    to:   '  return `<li><strong>${esc(w.entity)}</strong> — read in full' },
  { id: 'R11', why: '🔴 the not-computed section stops framing itself as neither good news nor bad',
    from: '     what has been read — so nothing below should be taken as good news or bad.',
    to:   '     what has been read.' },
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
