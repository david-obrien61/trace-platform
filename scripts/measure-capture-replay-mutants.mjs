/**
 * ── measure-capture-replay-mutants — can the file door be pushed open? ────────────────
 *
 * PURPOSE:      The live read counts its own pages and may trust its own arithmetic. A capture
 *               file came off a disk. Every mutant here RELAXES one of the three re-derivations
 *               — trusting the file's own header instead of its own pages — and every one makes
 *               a truncated or edited file LOAD. A loaded partial file produces a books review
 *               that is confidently wrong about a real business, and nothing on screen says so.
 * DEPENDENCIES: node_modules/.bin/esbuild. Mutates a temp copy of one file; restores in `finally`.
 * OUTPUTS:      CAUGHT/SURVIVED per mutant + summary. Exit 1 if any survived or never applied.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR.
 *
 * Run: node scripts/measure-capture-replay-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT   = new URL('..', import.meta.url).pathname;
const TARGET = ROOT + 'packages/shared/src/quickbooks/captureReplay.ts';
const SUITE  = 'packages/shared/src/quickbooks/captureReplay.test.ts';
const ESB    = ROOT + 'node_modules/.bin/esbuild';

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  { id: 'M1', why: '🔴 the file\'s own `complete:true` is TRUSTED instead of the check being re-run',
    from: '  const verdict = completeness(counted.total, retrieved);',
    to:   '  const verdict = root.complete === true ? { complete: true, headline: \'\' } : completeness(counted.total, retrieved);' },
  { id: 'M2', why: '🔴 `retrieved_total` is read from the header instead of counted from the rows',
    from: '  const headerRetrieved = root.retrieved_total;\n  if (typeof headerRetrieved === \'number\' && headerRetrieved !== retrieved) {',
    to:   '  const headerRetrieved = root.retrieved_total;\n  if (typeof headerRetrieved === \'number\') retrieved = headerRetrieved;\n  if (false) {' },
  { id: 'M3', why: '🔴 `expected_total` is read from the header instead of the count page\'s own body',
    from: '  if (typeof headerExpected === \'number\' && headerExpected !== counted.total) {',
    to:   '  if (false) {' },
  { id: 'M4', why: '🔴 the COUNT page is treated as a page of rows — every re-count silently one page short',
    from: '  const rowPages   = pages.filter(p => isObj(p) && p.query !== countQuery);',
    to:   '  const rowPages   = pages.filter(p => isObj(p));' },
  { id: 'M5', why: 'a saved page that came back 401/500 is parsed as records anyway',
    from: '    if (typeof status === \'number\' && status !== 200) {',
    to:   '    if (false) {' },
  { id: 'M6', why: 'a saved page that will not parse contributes zero rows instead of refusing',
    from: '    if (!rows.ok) {',
    to:   '    if (false) {' },
  { id: 'M7', why: '🔴 a file with NO saved count loads — completeness becomes unprovable and unmentioned',
    from: '  if (countPages.length === 0) {',
    to:   '  if (false) {' },
  { id: 'M8', why: '🔴 the INCOMPLETE refusal is downgraded to a pass — a short list presented as a list',
    from: '  if (!verdict.complete) {\n    return refuse(\'INCOMPLETE\', verdict.headline);\n  }',
    to:   '  if (false) {\n    return refuse(\'INCOMPLETE\', verdict.headline);\n  }' },
  { id: 'M9', why: 'an entity this platform does not read is GUESSED at rather than refused',
    from: '  if (typeof entity !== \'string\' || !(QBO_ENTITIES as readonly string[]).includes(entity)) {',
    to:   '  if (false) {' },
  { id: 'M10', why: '🔴 an unreadable count is coerced to a number instead of refusing',
    from: '  if (!counted.ok || counted.total === null) {',
    to:   '  if (false) {' },
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
