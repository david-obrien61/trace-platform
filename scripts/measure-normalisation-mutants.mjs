/**
 * ── measure-normalisation-mutants — can we answer the owner's question for them? ──────
 *
 * PURPOSE:      Two failure shapes, and neither looks wrong on screen. (1) The mechanism quietly
 *               becomes a VOCABULARY — a favourite spelling that works at one nursery. (2) A
 *               question only the owner can answer arrives with a SUGGESTION attached, which is us
 *               answering it and calling it a default. Every mutant below produces a screen that
 *               is calmer and more confident than the truth.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-normalisation-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/inventory/normalisationConsent.ts';
const SUITE  = 'packages/shared/src/inventory/normalisationConsent.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'N1', why: '🔴 a size written ONE way is still asked about — a tidy catalogue gets a page of pointless confirmations',
    from: '    if (variants.length < 2) continue;',
    to:   '    if (false) continue;' },
  { id: 'N2', why: '🔴 the suggestion stops being the commonest spelling and becomes whichever was seen first',
    from: '      .sort((a, b) => b.items - a.items || a.label.localeCompare(b.label));',
    to:   '      ;' },
  { id: 'N3', why: '🔴 a MEANING question gains a suggestion — us answering "is #3/5 one product or two" for the owner',
    from: "        key, kind: 'meaning', variants, population,\n        suggestion: null, why: null,",
    to:   "        key, kind: 'meaning', variants, population,\n        suggestion: variants[0].label, why: 'most common'," },
  { id: 'N4', why: '🔴 an UNRECOGNISED label gains a suggestion — proposing a display for something we admit we cannot read',
    from: "        key, kind: 'unrecognised', variants, population,\n        suggestion: null, why: null,",
    to:   "        key, kind: 'unrecognised', variants, population,\n        suggestion: variants[0].label, why: 'most common'," },
  { id: 'N5', why: '🔴 an unrecognised label appearing once is SILENTLY DROPPED — we stop telling them we could not read it',
    from: "    if (bucket.kind === 'unrecognised') {",
    to:   "    if (bucket.kind === 'unrecognised' && variants.length > 1) {" },
  { id: 'N6', why: '🔴 the WHY becomes a fixed sentence instead of being computed from their data',
    from: "      why: `${plural(top.items, 'of your items already writes it', 'of your items already write it')} this way, out of ${population.toLocaleString()}.`,",
    to:   "      why: 'This is the most common spelling in your catalogue.'," },
  { id: 'N7', why: '🔴 the audit row drops what was SUGGESTED, leaving a setting rather than how it was arrived at',
    from: '      suggested: choice.suggested,',
    to:   '' },
  { id: 'N8', why: '🔴 declining stops being recorded as a decision, so the question returns on every future import',
    from: '      left_as_is: choice.chosen === null,',
    to:   '' },
  { id: 'N9', why: 'the tie-break is dropped, so which spelling is suggested depends on catalogue order',
    from: '|| a.label.localeCompare(b.label));',
    to:   ');' },
  { id: 'N10', why: '🔴 labels are lowercased, so the raw value the grower typed is rewritten (R-50 / D-23)',
    from: '      .map(([label, items]) => ({ label, items }))',
    to:   '      .map(([label, items]) => ({ label: label.toLowerCase(), items }))' },
  { id: 'N11', why: 'an ABSENT size becomes a variant, manufacturing a question about rows that have no size at all',
    from: '    if (!raw) continue;',
    to:   '    if (false) continue;' },
  { id: 'N12', why: '🔴 a RANGE is classified as a spelling question, so the meaning/cosmetic split collapses',
    from: "    const kind: GroupKind = !u ? 'unrecognised' : (u.valueMax !== null ? 'meaning' : 'spelling');",
    to:   "    const kind: GroupKind = !u ? 'unrecognised' : 'spelling';" },
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
