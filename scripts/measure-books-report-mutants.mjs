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
  // 🔴 RETARGETED 2026-09-04 — the line it mutated no longer exists. `generatedAt` left the
  // report entirely (the page now dates itself by the READ, not by the clock), so this mutant
  // reported "never applied" rather than passing quietly, which is the behaviour that made the
  // staleness visible in one run. The PROPERTY it defends is unchanged and still worth a mutant:
  // a date rendered to the second invites an analysis to be read as a transaction record.
  { id: 'R3', why: 'the read stamp becomes a precise timestamp — an analysis dressed as a transaction record',
    from: '    input.walks.filter(w => w.read && w.queriedAt).map(w => (w.queriedAt as string).slice(0, 10)),',
    to:   '    input.walks.filter(w => w.read && w.queriedAt).map(w => (w.queriedAt as string)),' },
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

  // ══════════════════════════════════════════════════════════════════════════════════════
  // R12-R15 — THE WORKING NOTES AND THE WRONG DATE, RESTORED. Each one shipped.
  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 THESE MUTANTS EXIST BECAUSE THE §H PROBES WERE WRITTEN AFTER THE FIX, NOT BEFORE IT.
  // A probe that has never been seen to refuse is a claim, and §H's first run was green because
  // the repair was already in the file. These are how it is proven able to fail — mechanically
  // and permanently, rather than by one revert nobody can re-run.
  //
  // Every `from` below is code that was really in this file until 2026-09-04, and R12 is the
  // exact line that printed "$32,934 owed" directly above "CONFIRMED — $30,736" in a document
  // handed to a customer.
  { id: 'R12', why: '🔴 THE DRIFT LINE RETURNS TO THE CUSTOMER DOCUMENT — two numbers for one fact, disagreeing, on the page Terry is handed',
    from: "    <p class=\"p\">${f.population.matched.toLocaleString()} of ${f.population.of.toLocaleString()} ${esc(f.population.noun)}</p></li>`;",
    to:   "    <p class=\"p\">${f.population.matched.toLocaleString()} of ${f.population.of.toLocaleString()} ${esc(f.population.noun)}</p>${f.remeasured ? `<p class=\"p\">Re-measured 3 September 2026: ${esc(f.remeasured)}</p>` : ''}</li>`;" },
  { id: 'R13', why: '🔴 the working notes return on the could-not-work-out page — "41 is not derivable from any of the three reads" is us talking to ourselves',
    from: "     <ul class=\"f\">${r.notComputed.map(f => `<li><p class=\"s\">${esc(f.notMeasured ?? '')}</p></li>`).join('')}</ul>`;",
    to:   "     <ul class=\"f\">${r.notComputed.map(f => `<li><p class=\"s\">${esc(f.notMeasured ?? '')}</p>${f.remeasured ? `<p class=\"p\">Re-measured 3 September 2026: ${esc(f.remeasured)}</p>` : ''}</li>`).join('')}</ul>`;" },
  { id: 'R14', why: '🔴 an UNREAD walk contributes its stale timestamp — the page dates itself off a read that never happened',
    from: "    input.walks.filter(w => w.read && w.queriedAt).map(w => (w.queriedAt as string).slice(0, 10)),",
    to:   "    input.walks.filter(w => w.queriedAt).map(w => (w.queriedAt as string).slice(0, 10))," },
  { id: 'R15', why: '🔴 a SPAN collapses to its newest date — half the figures are then dated to a day they were not read on',
    from: "    : { kind: 'span', earliest: dates[0], latest: dates[dates.length - 1] };",
    to:   "    : { kind: 'one', date: dates[dates.length - 1] };" },

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
