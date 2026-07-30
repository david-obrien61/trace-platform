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
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const filter = process.argv[2] || '';

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

console.log(`\n── UNIT TESTS — ${files.length} file(s) ──────────────────────────────\n`);

const failed = [];
let totalAssertions = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  let out = '';
  let ok = true;
  try {
    // Bundle to CJS on stdout, pipe straight into node. Externals are runtime deps the
    // pure-function tests never actually call into.
    out = execSync(
      `"${ESBUILD}" "${file}" --bundle --platform=node --format=cjs --log-level=error ` +
      `--external:@supabase/supabase-js --external:@anthropic-ai/sdk | node`,
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

  if (ok) {
    console.log(`  ✅ ${rel}  (${counts})`);
  } else {
    failed.push({ rel, out });
    console.log(`  ❌ ${rel}  (${counts})`);
  }
}

console.log(`\n── ${files.length - failed.length}/${files.length} files pass · ${totalAssertions} assertions ─────────────────\n`);

if (failed.length > 0) {
  console.error(`RED — ${failed.length} test file(s) failing:\n`);
  for (const f of failed) {
    console.error(`──────── ${f.rel} ────────`);
    console.error(f.out.trim().split('\n').filter(l => l.includes('✗') || l.includes('FAIL') || l.includes('Error') || l.includes('error')).slice(0, 20).join('\n'));
    console.error('');
  }
  process.exit(1);
}
console.log('All test files pass.\n');
