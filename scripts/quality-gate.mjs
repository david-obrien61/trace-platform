#!/usr/bin/env node
// TRACE Platform — quality gate (baseline-and-ratchet)
// Installed 2026-06-24 (Lightning standing-gate prompt).
//
// Measures three correctness signals and compares to quality-baseline.json:
//   • tsc     — type errors (cultivar-os + trace-app)
//   • eslint  — lint problems (the bug classes: dead code, unused vars, floating/misused promises)
//   • knip    — dead code (unused files + unused exports/types) on the maintained app surface
//
// RATCHET: the build FAILS only on NET-NEW (any metric ABOVE its baseline). Baseline
// numbers are debt that must shrink, never grow. When a metric drops below baseline the
// gate PASSES and tells you to re-snapshot with `npm run quality:baseline` so the lower
// number is locked in (you can't silently regress back up to the old baseline).
//
// Usage:
//   node scripts/quality-gate.mjs            compare to baseline, exit 1 on net-new
//   node scripts/quality-gate.mjs --update   re-snapshot baseline to current counts
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'quality-baseline.json');

// Run a command, return stdout, swallow non-zero exit (these tools exit 1 when they find issues).
function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

function measureTsc() {
  let errors = 0;
  for (const proj of ['packages/cultivar-os/tsconfig.json', 'packages/trace-app/tsconfig.json']) {
    const out = run(`npx tsc --noEmit -p ${proj}`);
    errors += (out.match(/error TS\d+/g) || []).length;
  }
  return { errors };
}

function measureEslint() {
  const out = run(`npx eslint "packages/**/*.{ts,tsx,js,jsx}" -f json`);
  let total = 0;
  try {
    const report = JSON.parse(out);
    for (const f of report) total += f.errorCount + f.warningCount;
  } catch {
    console.error('  ! eslint produced no parseable JSON — treating as gate failure');
    return { total: Number.MAX_SAFE_INTEGER };
  }
  return { total };
}

function measureKnip() {
  const out = run(`npx knip --reporter json`);
  let unusedFiles = 0, unusedExports = 0, unusedTypes = 0;
  try {
    const report = JSON.parse(out);
    unusedFiles = (report.files || []).length;
    for (const it of (report.issues || [])) {
      unusedExports += (it.exports || []).length;
      unusedTypes += (it.types || []).length;
    }
  } catch {
    console.error('  ! knip produced no parseable JSON — treating as gate failure');
    return { unusedFiles: Number.MAX_SAFE_INTEGER, unusedExports: 0, unusedTypes: 0 };
  }
  return { unusedFiles, unusedExports, unusedTypes };
}

function measure() {
  console.log('  measuring tsc…');    const tsc = measureTsc();
  console.log('  measuring eslint…'); const eslint = measureEslint();
  console.log('  measuring knip…');   const knip = measureKnip();
  return { tsc, eslint, knip };
}

// Flatten nested metrics to dotted leaf comparisons.
function leaves(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object') Object.assign(out, leaves(v, prefix ? `${prefix}.${k}` : k));
    else out[prefix ? `${prefix}.${k}` : k] = v;
  }
  return out;
}

const update = process.argv.includes('--update');
console.log(`\n=== TRACE quality gate ${update ? '(RE-BASELINE)' : '(ratchet)'} ===`);
const current = measure();

if (update) {
  const payload = {
    _comment: 'Baseline-and-ratchet quality gate. `npm run verify` fails on NET-NEW only (any metric above baseline). These numbers are debt — shrink them, never grow them. Regenerate with `npm run quality:baseline` after fixing violations to lock in the lower number.',
    generated: new Date().toISOString().slice(0, 10),
    ...current,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
  console.log('\nBaseline written to quality-baseline.json:');
  console.log(JSON.stringify(current, null, 2));
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('\nNo quality-baseline.json found. Run `npm run quality:baseline` first.');
  process.exit(1);
}

const curLeaves = leaves(current);
const baseLeaves = leaves({ tsc: baseline.tsc, eslint: baseline.eslint, knip: baseline.knip });

let netNew = false, improved = false;
console.log('\n  metric                     baseline   current');
for (const key of Object.keys(curLeaves)) {
  const cur = curLeaves[key];
  const base = baseLeaves[key] ?? 0;
  let mark = ' ok ';
  if (cur > base) { mark = 'NEW!'; netNew = true; }
  else if (cur < base) { mark = ' ↓  '; improved = true; }
  console.log(`  ${key.padEnd(24)} ${String(base).padStart(8)}   ${String(cur).padStart(7)}  ${mark}`);
}

if (netNew) {
  console.error('\n✗ GATE FAILED — net-new violations above baseline (marked NEW!).');
  console.error('  Fix the new violation(s), or if this is intentional debt, justify it and');
  console.error('  re-baseline with `npm run quality:baseline` (do not let the baseline grow casually).');
  process.exit(1);
}
if (improved) {
  console.log('\n✓ GATE PASSED — and a metric dropped below baseline (↓).');
  console.log('  Lock in the win: run `npm run quality:baseline` and commit the smaller numbers.');
} else {
  console.log('\n✓ GATE PASSED — zero net-new violations.');
}
process.exit(0);
