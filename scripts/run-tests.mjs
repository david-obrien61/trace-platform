#!/usr/bin/env node
/**
 * ── UNIT TEST RUNNER — discovers and runs every *.test.ts in packages/ ─────────────
 *
 * PURPOSE:      Chain the pure-function test suite into `npm run verify` so a red test
 *               is a build failure instead of a file nobody runs. There is no vitest/jest
 *               in this repo by design (§6 r10 — standard-by-value): each test file is a
 *               self-contained script with its own `ok()` harness that exits 1 on failure.
 *               This runner only bundles and executes them, and aggregates the exit codes.
 * DEPENDENCIES: node_modules/.bin/esbuild (already a dependency of the verify chain).
 * OUTPUTS:      Per-file PASS/FAIL line + summary. Exit 1 if ANY file fails.
 *
 * A file is FAILING if it exits non-zero — that includes a bundle/compile error, which is
 * itself a real failure (a test that cannot build is not a test that passes).
 *
 * Run: node scripts/run-tests.mjs            (or: npm run test)
 *      node scripts/run-tests.mjs <substr>   (run only files whose path matches)
 */
import { execFileSync, execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
// ⚠️ FLAGS ARE NOT A PATH FILTER. The first draft took `process.argv[2]` whole, so
// `--update-floor` was read as a substring to match, matched nothing, and the runner exited
// "No test files found" BEFORE reaching the flag it was given. A flag silently becoming a filter
// that matches nothing is a command that appears to run and does something else.
const args = process.argv.slice(2);
const filter = args.find(a => !a.startsWith('--')) || '';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, 'packages'))
  .filter(f => f.includes(filter))
  .sort();

if (files.length === 0) {
  console.error(`No test files found${filter ? ` matching "${filter}"` : ''}.`);
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE DISCOVERED-FILE FLOOR — tech-debt #186, and the defect it closes is our own
// ═════════════════════════════════════════════════════════════════════════════
// MEASURED 2026-09-04: two runs minutes apart on ONE tree reported `74/74 · 3838 assertions` and
// then `72/72 · 3775`. Both said *All test files pass*. The two missing files existed and passed
// when run alone — `readdirSync` was racing three other sessions writing into the same tree.
//
// **A SHORT RUN IS INDISTINGUISHABLE FROM A FULL ONE**, because `N/N files pass` compares the
// discovered count to ITSELF. It cannot disagree, which is [[R-33]] in the runner that certifies
// every other check — and it silently degrades the ratchet and every mutation harness that shells
// out to this file.
//
// The floor is the fix: the number of test files we KNOW exist, stored outside this run. Fewer
// than that is a failure even when every file that did run was green.
//
// ⚠️ IT ONLY EVER RISES, AND ONLY DELIBERATELY (`npm run test:floor`). A floor that lowered itself
// on a short run would launder exactly the defect it exists to catch — the same reasoning as the
// quality gate's "shrink them, never grow them", inverted because more tests is the good direction.
// ⚠️ A FILTERED RUN IS EXEMPT, obviously: `node scripts/run-tests.mjs foo` is meant to run a subset.
const BASELINE_PATH = join(ROOT, 'quality-baseline.json');
let floor = null;
try {
  floor = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))?.tests?.files ?? null;
} catch { floor = null; }

if (args.includes('--update-floor')) {
  const doc = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const was = doc.tests?.files ?? 0;
  if (files.length < was) {
    console.error(`REFUSED — the floor is ${was} and only ${files.length} files were discovered. ` +
      `A floor that lowers itself on a short run launders the very defect it exists to catch (#186). ` +
      `If test files were genuinely DELETED, lower it by hand and say why in the commit.`);
    process.exit(1);
  }
  doc.tests = { files: files.length, stamped: new Date().toISOString().slice(0, 10) };
  writeFileSync(BASELINE_PATH, JSON.stringify(doc, null, 2) + '\n');
  console.log(`test-file floor: ${was} → ${files.length}`);
  process.exit(0);
}

console.log(`\n── UNIT TESTS — ${files.length} file(s) discovered${floor !== null && !filter ? `, floor ${floor}` : ''} ─────────────\n`);

if (!filter && floor !== null && files.length < floor) {
  console.error(`\n🔴 SHORT RUN — ${files.length} test files discovered, but ${floor} are known to exist.\n`);
  console.error(`   ${floor - files.length} file(s) did not turn up. Nothing below this line is trustworthy:`);
  console.error(`   every file that DID run may be green while the missing ones are red.`);
  console.error(`   Cause, measured 2026-09-04: readdirSync racing another session writing into the`);
  console.error(`   same tree. Re-run; if the count is genuinely lower because tests were deleted,`);
  console.error(`   run \`npm run test:floor\` deliberately and say why in the commit. (tech-debt #186)\n`);
  process.exit(1);
}

const failed = [];
let totalAssertions = 0;
// 🔴 COUNTED, NOT ASSUMED. Today every discovered file is executed by the loop below, so these
// agree by construction — which is exactly why it is worth asserting: the day a `continue`, an
// early `break` or a try/catch swallows one, the summary would still read `N/N` because both
// halves of that fraction come from the same array. A count of what RAN cannot be faked by the
// loop that runs it.
let executed = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  let out = '';
  let ok = true;
  try {
    // Bundle to CJS on stdout, pipe straight into node. Externals are runtime deps the
    // pure-function tests never actually call into — EXCEPT `jsdom`, which the mounting test
    // (stopOfferMount.test.ts) very much calls into. It is external for the opposite reason:
    // bundled, jsdom loses the package-relative path to its own default stylesheet and dies
    // with ENOENT on `/Users/browser/default-stylesheet.css`. Left external, node resolves it
    // from node_modules and it works.
    // 🔴 `set -o pipefail` IS LOAD-BEARING, NOT HYGIENE — ADDED 2026-09-07 AFTER THIS RUNNER
    // REPORTED ✅ ON A FILE THAT WOULD NOT COMPILE. Without it, bash returns only the LAST
    // command's status: esbuild writes its error to STDERR and nothing to stdout, so `node` reads
    // an EMPTY program, exits 0, and the pipeline succeeds. The file was printed as passing with
    // `(no summary line)` beside it. This file's own header promises the opposite — *"a test that
    // cannot build is not a test that passes"* — so the intent was right and the pipeline defeated
    // it. [[R-33]] in the runner that certifies every other check.
    out = execSync(
      `set -o pipefail; "${ESBUILD}" "${file}" --bundle --platform=node --format=cjs --log-level=error ` +
      `--external:@supabase/supabase-js --external:@anthropic-ai/sdk --external:jsdom | node`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: '/bin/bash' }
    );
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || '');
  }

  // Two summary spellings exist in the suite: "N passed, N failed" (most files) and
  // "N passed / N failed" (compare.test.ts). Match both — an unparsed summary made that
  // file's 17 assertions invisible in the roll-up even though it runs and can fail.
  const m = out.match(/(\d+) passed,\s*(\d+) failed/) || out.match(/(\d+) passed\s*\/\s*(\d+) failed/);
  const counts = m ? `${m[1]} passed, ${m[2]} failed` : 'no summary line';
  if (m) totalAssertions += Number(m[1]) + Number(m[2]);

  // 🔴 NO SUMMARY LINE IS A FAILURE, NOT A FOOTNOTE (2026-09-07). A file that printed no summary
  // either died before reaching it or asserted nothing at all — and a suite with zero assertions
  // cannot disagree with anything, which is the one thing a test must be able to do. It used to
  // render as `✅ … (no summary line)`, which is a green tick over a file that proved nothing.
  if (ok && !m) {
    ok = false;
    out += '\n[runner] The file exited cleanly but printed no "N passed, N failed" summary — it ' +
           'either crashed before the summary or contains no assertions. Either way it proves nothing.';
  }

  executed++;
  if (ok) {
    console.log(`  ✅ ${rel}  (${counts})`);
  } else {
    failed.push({ rel, out });
    console.log(`  ❌ ${rel}  (${counts})`);
  }
}

console.log(`\n── ${files.length - failed.length}/${files.length} files pass · ${executed} executed · ${totalAssertions} assertions ─────────────────\n`);

if (executed !== files.length) {
  console.error(`🔴 ${files.length} files were discovered but only ${executed} ran — ${files.length - executed} ` +
    `were skipped by the runner itself, which is a different failure from a red test and is not reported as one.`);
  process.exit(1);
}

if (failed.length > 0) {
  console.error(`RED — ${failed.length} test file(s) failing:\n`);
  for (const f of failed) {
    console.error(`──────── ${f.rel} ────────`);
    // 🔴 THE FILTER MISSED esbuild'S OWN ERRORS, AND A PLANTED PROBE FOUND IT (2026-09-25).
    // A top-level-await file under --format=cjs was correctly reported RED and BY NAME — and then
    // printed NOTHING about why, because esbuild writes `✘ [ERROR] Top-level await is currently
    // not supported with the "cjs" output format` and the filter matched only lowercase `error`
    // and `Error`. A named failure with no reason sends the next person to read the file rather
    // than the message. `✘` and `[ERROR]` are esbuild's; the rest are the suites'.
    const lines = f.out.trim().split('\n')
      .filter(l => l.includes('✗') || l.includes('✘') || l.includes('[ERROR]')
                || /FAIL/i.test(l) || /error/i.test(l));
    // Falling back to the raw tail matters more than tidiness: a failure whose output matches
    // NOTHING in the list above would otherwise print an empty block, which reads as "no reason
    // given" when the reason was right there.
    console.error((lines.length ? lines : f.out.trim().split('\n').slice(-12)).slice(0, 20).join('\n'));
    console.error('');
  }
  process.exit(1);
}
console.log('All test files pass.\n');
