#!/usr/bin/env node
/**
 * exec-output-regression — DOES A LONG JOB'S OUTPUT, OR A LINGERING CHILD, HANG THE RUNNER?
 *
 * PURPOSE:      settle by measurement which of two hypotheses caused the 12h28m hang of
 *               `verify-writer-registry` on 2026-09-24, and stand as the regression for §6 r28.
 * DEPENDENCIES: none — node only. It plants its own children in a temp dir.
 * OUTPUTS:      five CASE lines and a verdict; exit 1 if the runner's chosen form can hang.
 *
 * THE TWO HYPOTHESES:
 *   H1 PIPE-BUFFER OVERFLOW — a child writing more than the ~64KB pipe buffer blocks on write
 *      while the parent is not draining, so both wait forever.
 *   H2 LINGERING DESCRIPTOR HOLDER — `execSync` returns when the child's stdout PIPE CLOSES, not
 *      when the child EXITS. A grandchild that inherits stdout and never exits holds the pipe open,
 *      so the parent waits on a descriptor nobody will close.
 *
 * ⚠️ H1 IS NOT WHAT HAPPENED HERE, and this file exists partly to record why: `crew-day.paths.mts`
 *    prints 16,729 bytes, comfortably inside the buffer. H1 is still a REAL failure mode worth a
 *    regression, which is why CASE A plants 5MB deliberately — far past any buffer.
 */
import { execSync, spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, openSync, closeSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'exec-regression-'));
const LIMIT = 20_000;                    // generous for a print loop; a hang blows straight past it
let failed = 0;

const BIG = join(dir, 'big.mjs');        // 5MB of stdout, then exits cleanly
writeFileSync(BIG, `const line = 'x'.repeat(99) + '\\n';
for (let i = 0; i < 50_000; i++) process.stdout.write(line);
process.stdout.write('DONE-BIG\\n');\n`);

const LINGER = join(dir, 'linger.mjs');  // prints a little, then leaves a child holding stdout
writeFileSync(LINGER, `import { spawn } from 'node:child_process';
process.stdout.write('DONE-SMALL\\n');
// The grandchild INHERITS stdout and never exits — a PGlite worker's shape.
spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'inherit', detached: false });
// The child itself exits immediately. Only the grandchild lives on.\n`);

function caseRun(name, fn, expectMarker) {
  const t0 = Date.now();
  let out = '', verdict;
  try { out = fn() ?? ''; verdict = out.includes(expectMarker) ? 'COMPLETED' : 'COMPLETED-BUT-TRUNCATED'; }
  catch (e) {
    verdict = (e.code === 'ETIMEDOUT' || e.signal === 'SIGKILL' || e.signal === 'SIGTERM') ? 'HUNG (killed by the limit)' : `ERROR ${e.code ?? e.message}`;
    out = String(e.stdout ?? '');
  }
  const ms = Date.now() - t0;
  console.log(`CASE ${name}: ${verdict} in ${ms}ms · ${out.length} bytes captured`);
  return { verdict, ms };
}

console.log('── H1 · 5MB of output (far past any pipe buffer) ──────────────────────────────────');
const a = caseRun('A execSync + piped stdout, 5MB', () =>
  execSync(`node "${BIG}"`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: LIMIT, killSignal: 'SIGKILL' }), 'DONE-BIG');
const b = caseRun('B execSync + stdout to a FILE, 5MB', () => {
  const f = join(dir, 'a.out'); const fd = openSync(f, 'w');
  try { execSync(`node "${BIG}"`, { stdio: ['ignore', fd, fd], timeout: LIMIT, killSignal: 'SIGKILL' }); } finally { closeSync(fd); }
  return readFileSync(f, 'utf8');
}, 'DONE-BIG');

console.log('\n── H2 · a grandchild that inherits stdout and never exits ─────────────────────────');
const c = caseRun('C execSync + piped stdout, lingering grandchild', () =>
  execSync(`node "${LINGER}"`, { encoding: 'utf8', timeout: LIMIT, killSignal: 'SIGKILL' }), 'DONE-SMALL');
const d = caseRun('D execSync + stdout to a FILE, lingering grandchild', () => {
  const f = join(dir, 'c.out'); const fd = openSync(f, 'w');
  try { execSync(`node "${LINGER}"`, { stdio: ['ignore', fd, fd], timeout: LIMIT, killSignal: 'SIGKILL' }); } finally { closeSync(fd); }
  return readFileSync(f, 'utf8');
}, 'DONE-SMALL');

console.log('\n── H3 · THE ACTUAL CAUSE · a child holding an open handle, relying on NATURAL exit ──');
// 🔴 THIS IS WHAT HAPPENED, and CASES C/D above are why the first two theories were wrong.
//    `crew-day.paths.mts` ended with `process.exitCode = 1` — which only sets a code and waits for
//    the event loop to drain — while every `freshDb()` left a PGlite database open. 36 open handles,
//    so the loop never drained, so the process never exited, so the runner waited forever.
//    ⚠️ `origin/main` has the same ending with 29 such calls and passes: a LATENT defect crossed by
//    adding guards, not one any single change introduced.
const HOLD_NATURAL = join(dir, 'hold-natural.mjs');
writeFileSync(HOLD_NATURAL, `const h = setInterval(() => {}, 1000);   // an open handle, like a live PGlite instance
process.stdout.write('WORK-DONE\\n');
process.exitCode = 0;                      // sets a code and WAITS — the defect, exactly\n`);

const HOLD_CLOSED = join(dir, 'hold-closed.mjs');
writeFileSync(HOLD_CLOSED, `const h = setInterval(() => {}, 1000);
process.stdout.write('WORK-DONE\\n');
clearInterval(h);                          // the fix: RELEASE the handle (closeLiveDbs())
process.exitCode = 0;\n`);

const f1 = caseRun('E natural exit WITH an open handle (the defect)', () =>
  execSync(`node "${HOLD_NATURAL}"`, { encoding: 'utf8', timeout: LIMIT, killSignal: 'SIGKILL' }), 'WORK-DONE');
const f2 = caseRun('F natural exit after RELEASING the handle (the fix)', () =>
  execSync(`node "${HOLD_CLOSED}"`, { encoding: 'utf8', timeout: LIMIT, killSignal: 'SIGKILL' }), 'WORK-DONE');

// tidy up any grandchild this test planted, by group, so the regression does not become the defect
try { spawnSync('pkill', ['-9', '-f', 'setInterval\\(\\(\\) => \\{\\}, 1000\\)']); } catch { /* best effort */ }

console.log('\n── WHAT THIS MEASURES ────────────────────────────────────────────────────────────');
console.log(`H1 pipe-buffer overflow:      ${a.verdict === 'HUNG (killed by the limit)' ? '🔴 REAL — 5MB through a pipe hangs' : `not reproduced (5MB through a pipe ${a.verdict})`}`);
console.log(`H2 lingering descriptor:      ${c.verdict === 'HUNG (killed by the limit)' ? '🔴 REAL — a lingering grandchild hangs the pipe form' : `not reproduced (${c.verdict})`}`);
console.log(`The FILE form under the same conditions: 5MB ${b.verdict} · lingering ${d.verdict}`);

// 🔴 THE ASSERTION: whatever the cause, the form the runner now uses must survive BOTH.
if (a.verdict !== 'COMPLETED' || b.verdict !== 'COMPLETED') {
  console.log('❌ 5MB of output no longer completes — H1 has become real and §6 r28 needs re-deriving'); failed++;
}
// 🔴 C, D and E are ASSERTED TO HANG. They are the findings, not failures — and asserting them keeps
//    anyone from "fixing" this by swapping a pipe for a file (D) and calling it done, which is the
//    wrong conclusion I drew before this file existed.
for (const [n, r] of [['C', c], ['D', d], ['E', f1]]) {
  if (r.verdict !== 'HUNG (killed by the limit)') {
    console.log(`❌ CASE ${n} completed — this test's reasoning is stale; re-derive §6 r28 before trusting it`); failed++;
  }
}
if (f2.verdict !== 'COMPLETED') { console.log('❌ releasing the handle did not let the child exit — the fix does not hold'); failed++; }
// AND the limit itself must have done the killing in every hung case, or r28 is decoration.
if ([c, d, f1].some(r => r.ms > LIMIT * 2)) { console.log('❌ a hang outlived its own time limit — the limit is not being enforced'); failed++; }

console.log(`\nH3 the real cause:            ${f1.verdict === 'HUNG (killed by the limit)' ? '🔴 CONFIRMED — an open handle + natural exit hangs the runner' : 'not reproduced'}`);
console.log(`    with the handle released:  ${f2.verdict} — this is what \`closeLiveDbs()\` buys`);
rmSync(dir, { recursive: true, force: true });
console.log(failed ? `\n❌ exec-output-regression — ${failed} failure(s)` : '\n✅ exec-output-regression — the cause is an open handle + natural exit (H3), not output volume (H1); releasing the handle fixes it, and the time limit caught every hang');
process.exit(failed ? 1 : 0);
