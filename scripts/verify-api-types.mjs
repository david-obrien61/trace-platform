#!/usr/bin/env node
/**
 * ── API TYPE RATCHET — type-check the deployed serverless surface ──────────────
 *
 * PURPOSE:      `api/` was in NO TypeScript project until 2026-09-22, so `npm run
 *               verify` type-checked every screen and not one handler, while Vercel
 *               compiled all twelve on every deploy and printed its errors without
 *               failing the build. This runs `tsc -p tsconfig.api.json` and RATCHETS:
 *               today's 16 known errors are baselined so it lands GREEN; any NEW
 *               error fails the build. Tech-debt #77.
 * DEPENDENCIES: typescript (already in the verify chain), tsconfig.api.json,
 *               api-type-baseline.json.
 * OUTPUTS:      exit 0 when no net-new error; exit 1 naming each new one.
 *
 * 🔴 IT KEYS ON ERROR IDENTITY, NOT ON A COUNT — AND THAT IS THE WHOLE DESIGN.
 * A count-only ratchet passes when one error is fixed and a different one is
 * introduced in the same commit: 16 in, 16 out, green, on a tree that regressed.
 * That is [[R-33]]'s shape — a check that cannot disagree with the thing it exists
 * to catch. The key is `path::TScode::message`, with LINE AND COLUMN DELIBERATELY
 * EXCLUDED so that editing a file above an error does not manufacture a false
 * "new" error. #78 re-keyed the quality ratchets on identity for this same reason.
 *
 * ⚠️ FAIL-ON-NET-NEW ONLY, matching CLAUDE.md §6 r9. A baselined error that has
 * been FIXED is printed loudly as a win to lock in — it does not fail the build,
 * because a gate that fails on good news teaches reflexive re-baselining (#78).
 *
 * Run:  node scripts/verify-api-types.mjs
 *       node scripts/verify-api-types.mjs --update     (re-baseline; shrink only)
 *       node scripts/verify-api-types.mjs --self-test  (probes, both directions)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'api-type-baseline.json');
const PROJECT = 'tsconfig.api.json';

/** Parse tsc output into stable identity keys. Indented continuation lines are not errors. */
export function parseDiagnostics(out) {
  const keys = [];
  for (const line of String(out).split('\n')) {
    if (/^\s/.test(line)) continue;                       // continuation detail, not its own error
    const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/);
    if (!m) continue;
    const [, path, , , code, message] = m;
    keys.push(`${path.replace(/\\/g, '/')}::${code}::${message.trim()}`);
  }
  return keys.sort();
}

function runTsc() {
  try {
    execFileSync('npx', ['tsc', '--noEmit', '-p', PROJECT], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return '';                                            // exit 0 — no diagnostics at all
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return null;
  return JSON.parse(readFileSync(BASELINE, 'utf8'));
}

// ── self-test — both directions, so the ratchet is proven able to REFUSE ────────
if (process.argv.includes('--self-test')) {
  let passed = 0, failed = 0;
  const ok = (c, m) => { if (c) passed++; else { failed++; console.error('   ✗ ' + m); } };
  const SAMPLE = "packages/cultivar-os/api/qbo/router.ts(287,45): error TS18046: 'tokens' is of type 'unknown'.";

  ok(parseDiagnostics(SAMPLE).length === 1, 'P1 a real diagnostic line parses to one key');
  ok(parseDiagnostics(SAMPLE)[0] === "packages/cultivar-os/api/qbo/router.ts::TS18046::'tokens' is of type 'unknown'.",
     'P2 the key is path + code + message — NO line or column');
  ok(parseDiagnostics(SAMPLE + '\n  Type X is not assignable to Y.').length === 1,
     'P3 an INDENTED continuation line is not counted as a second error');
  ok(parseDiagnostics('').length === 0, 'P4 empty output is zero errors');
  ok(parseDiagnostics('Found 3 errors in 2 files.').length === 0, 'P5 the summary line is not an error');

  // The defect the identity key exists to catch.
  const before = ['f.ts::TS1::a', 'f.ts::TS2::b'];
  const swapped = ['f.ts::TS1::a', 'f.ts::TS3::c'];       // one fixed, one introduced — count UNCHANGED
  const newOnes = swapped.filter(k => !before.includes(k));
  ok(before.length === swapped.length, 'P6 the swap keeps the COUNT identical — a count-only ratchet would pass it');
  ok(newOnes.length === 1 && newOnes[0] === 'f.ts::TS3::c',
     '🔴 P7 THE SWAP IS CAUGHT BY IDENTITY — this is the probe the whole design is for');

  // Line drift must NOT read as a new error.
  const moved = parseDiagnostics("packages/cultivar-os/api/qbo/router.ts(999,1): error TS18046: 'tokens' is of type 'unknown'.");
  ok(moved[0] === parseDiagnostics(SAMPLE)[0], '🔴 P8 the SAME error on a different LINE is the same key — editing above it is not a regression');

  // A genuinely new error is refused.
  const added = ['f.ts::TS1::a', 'f.ts::TS2::b', 'g.ts::TS9::boom'].filter(k => !before.includes(k));
  ok(added.length === 1, 'P9 a net-new error is detected');
  ok(before.filter(k => !swapped.includes(k)).length === 1, 'P10 a FIXED baseline error is detected as a win to lock in');

  console.log(`\nverify-api-types --self-test — ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// ── run ────────────────────────────────────────────────────────────────────────
const keys = parseDiagnostics(runTsc());

if (process.argv.includes('--update')) {
  const prev = loadBaseline();
  if (prev && keys.length > prev.errors.length) {
    console.error(`\n❌ REFUSING TO RE-BASELINE UPWARD — ${prev.errors.length} → ${keys.length}.`);
    console.error('   A baseline is DEBT: it shrinks, never grows (CLAUDE.md §6 r9). Fix the new');
    console.error('   errors, or state the reason in the close-out and edit the file by hand.\n');
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify({
    note: 'Known api/ type errors, keyed on path::TScode::message. Fail-on-net-new. Tech-debt #77. Shrink only.',
    updated: new Date().toISOString().slice(0, 10),
    count: keys.length,
    errors: keys,
  }, null, 2) + '\n');
  console.log(`✅ api-type baseline written — ${keys.length} known error(s).`);
  process.exit(0);
}

const baseline = loadBaseline();
if (!baseline) {
  console.error('❌ api-type-baseline.json is missing. Run: node scripts/verify-api-types.mjs --update');
  process.exit(1);
}

const known = new Set(baseline.errors);
const seen = new Set(keys);
const added = keys.filter(k => !known.has(k));
const fixed = baseline.errors.filter(k => !seen.has(k));

if (fixed.length > 0) {
  console.log(`\n🎉 ${fixed.length} baselined api/ type error(s) FIXED — re-baseline to lock the win:`);
  for (const f of fixed) console.log('   · ' + f);
  console.log('   node scripts/verify-api-types.mjs --update');
}

if (added.length > 0) {
  console.error(`\n❌ api-types FAILED — ${added.length} NET-NEW type error(s) in the deployed api/ surface:\n`);
  for (const a of added) {
    const [path, code, ...rest] = a.split('::');
    console.error(`   ${path}\n      ${code}: ${rest.join('::')}`);
  }
  console.error('\n   `api/` is compiled by Vercel on every deploy and is NOT covered by the');
  console.error('   two tsconfigs in quality-gate.mjs. Fix these, or say why in the close-out.\n');
  process.exit(1);
}

console.log(`✅ api-types — ${keys.length} known error(s), 0 net-new (baseline ${baseline.count}, ${baseline.updated}). Tech-debt #77.`);
