#!/usr/bin/env node
// ============================================================
// verify-api-parses — EVERY DEPLOYED api/ FILE PARSES (A10) + THE 12-FUNCTION CEILING HOLDS
// PURPOSE:      The deployed backend — the repo-root `api/` shims and `packages/*/api/**` — is in
//               NO tsconfig. All three tsconfigs are `include: ["src"]`, and the quality gate runs
//               `tsc -p` against two of them, so `api/` has neither a type check nor a PARSE check.
//               `npm run build:cultivar` is vite building the FRONTEND; its exit 0 says nothing
//               about these files. On 2026-07-27 that let a SyntaxError reach production:
//               `handleAuthUrl` awaited without being `async`, the module never parsed, and
//               auth-url + status + callback all returned 500 behind a green `npm run verify`.
// THE RULE:     A10 — every deployed artifact is checked by something that can fail. This is the
//               cheapest possible instance of it: parse-only, no baseline, ~30ms.
// PARSE-ONLY, DELIBERATELY (David, 2026-07-29): it catches exactly the class that shipped and needs
//               no baseline, so it lands today. TYPE-checking api/ is worth doing, is a SEPARATE
//               item, and likely wants a ratchet over pre-existing errors — filed as tech-debt #77,
//               not folded in here. A cap that ships now beats a better one that waits.
// WHY LOCAL, even though esbuild also runs on Vercel: whatever Vercel does, it did NOT block this —
//               the broken code was LIVE (proven: a failed Vercel build silently serves the
//               last-good bundle per tech-debt #60, and last-good predated the gate, so status
//               would have WORKED rather than 500'd). And if Vercel does check, a failure there is
//               invisible for the same #60 reason. No outcome makes a local parse check the wrong
//               thing to have.
// DEPENDENCIES: esbuild (already a devDependency; already used by verify:write-wall).
// SECOND ASSERTION — THE VERCEL FUNCTION CEILING (added 2026-09-14, ledger #318): the repo-root
//               `api/` directory is the deployed serverless surface and Vercel Hobby caps a
//               deployment at 12 functions. A 13th does NOT error — the whole deploy fails
//               SILENTLY and Vercel keeps serving the last-good bundle. That cost a day on
//               2026-06-20, when `api/deliveries/create.ts` was function #13: every deploy
//               silently failed and prod served stale code until it was folded into
//               `api/customers/create.ts` (CLAUDE.md §6 r11 · tech-debt #41 · #60).
//               This script ALREADY walks that directory on every build and never counted it.
// 🔴 IT COUNTS FUNCTION FILES RECURSIVELY, NOT `readdirSync('api').length`. The obvious form is
//               a cap that cannot fail: `readdirSync('api')` returns the TOP LEVEL only — 11
//               entries today, mixing 4 files with 7 directories — so `<= 12` reads GREEN while
//               we sit AT 12 of 12 with zero headroom, and a 13th function nested inside an
//               existing directory (`api/qbo/invoice/kinna.ts`) never moves the number at all.
//               2026-06-20's own defect, `api/deliveries/create.ts`, would have taken it from
//               11 to 12 and still passed. A wrong-population count that reads as headroom is
//               the very thing ledger #318 deleted from PLATFORM_STATE.md in the same pass.
// OUTPUTS:      exit 0 = every file parses AND the ceiling holds · 1 = a parse failure or the
//               ceiling is exceeded · 2 = the cap's own probes failed, so it refuses to report.
// USAGE:        npm run verify:api-parses
// ============================================================
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { transformSync } from 'esbuild';

const ROOT = process.cwd();

// THE DEPLOYED SURFACE. `api/` at the repo root is what Vercel deploys (12 shim files re-exporting
// packages/cultivar-os/api/*), and the implementations live under packages/*/api/. Both are shipped
// and neither is in a tsconfig.
const API_ROOTS = ['api', ...(() => {
  const pkgs = join(ROOT, 'packages');
  if (!existsSync(pkgs)) return [];
  return readdirSync(pkgs)
    .filter(p => existsSync(join(pkgs, p, 'api')))
    // ignition-os is FROZEN donor code (CLAUDE.md §2) and is not deployed — excluded deliberately.
    .filter(p => p !== 'ignition-os')
    .map(p => `packages/${p}/api`);
})()];

const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);
const PARSEABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const LOADER = { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js' };

/** Pure: parse one file's source. Returns null on success, or the failure detail. */
export function parseCheck(path, source) {
  const ext = extname(path);
  try {
    // TRANSFORM, not bundle: per-file, no module resolution, so a missing import is NOT reported as
    // a parse failure. This cap asserts ONE thing — the file is syntactically valid — and a check
    // that also fails for unrelated reasons is a check people learn to ignore.
    transformSync(source, { loader: LOADER[ext] ?? 'ts', target: 'es2022' });
    return null;
  } catch (err) {
    const e = (err?.errors ?? [])[0];
    return {
      message: e?.text ?? String(err?.message ?? err),
      line: e?.location?.line ?? null,
      column: e?.location?.column ?? null,
      snippet: e?.location?.lineText?.trim() ?? null,
    };
  }
}

/**
 * THE VERCEL HOBBY CEILING. One deployment may hold at most 12 serverless functions.
 * Confirmed Hobby by David 2026-09-08; CLAUDE.md §6 r11 records the plan check.
 */
export const FUNCTION_CEILING = 12;

/**
 * Pure: how many SERVERLESS FUNCTIONS does a list of repo-root `api/` paths deploy?
 *
 * One function per code file, at any depth — that is how Vercel builds the directory, and it is
 * why the count must be RECURSIVE. Non-code files are not functions: `api/qbo/.DS_Store` is live
 * in this repo right now and must not consume a slot.
 *
 * Takes the path list rather than reading the disk so the probes can hand it populations that do
 * not exist — including a 13th file, which is the only way to watch this cap refuse (§6 r19).
 */
export function countDeployedFunctions(relPaths) {
  return relPaths.filter(p => PARSEABLE.has(extname(p))).length;
}

// ── PROBES ───────────────────────────────────────────────────────────────────
// STD-024: the FIRST probe is the REAL defect, not a synthetic one — the shape extracted verbatim
// from router.ts before a13d354. STD-022: both directions.
function runProbes() {
  const R = [];
  const ck = (name, expect, got, detail) => R.push({ name, expect, got, ok: expect === got, detail });

  const fixture = join(ROOT, 'scripts/fixtures/parse-fail-await-in-non-async.ts.txt');
  if (!existsSync(fixture)) {
    ck('P1 the REAL defect fixture exists', 'present', 'MISSING');
  } else {
    const r = parseCheck('probe.ts', readFileSync(fixture, 'utf8'));
    ck('P1 🔴 THE REAL DEFECT (router.ts pre-a13d354) → FAILS', 'FAIL', r ? 'FAIL' : 'PASS', r?.message);
    ck('P1b …and the message names the actual cause', 'true',
      String(!!r && /await.*async/i.test(r.message)), r?.message);
  }
  ck('P2 a clean async handler → PASSES', 'PASS',
    parseCheck('ok.ts', `export async function h(req: any, res: any) { await f(); return res.end(); }\n`) ? 'FAIL' : 'PASS');
  ck('P3 an unterminated block → FAILS', 'FAIL',
    parseCheck('bad.ts', `export function h() { if (true) {\n`) ? 'FAIL' : 'PASS');
  ck('P4 TS type syntax is NOT a parse failure', 'PASS',
    parseCheck('t.ts', `type A = { a: string }; export const x: A = { a: 'y' };\n`) ? 'FAIL' : 'PASS');
  ck('P5 a MISSING IMPORT is not a parse failure (transform, not bundle)', 'PASS',
    parseCheck('i.ts', `import { nope } from './does-not-exist';\nexport const y = nope;\n`) ? 'FAIL' : 'PASS');
  ck('P6 tsx parses as tsx', 'PASS',
    parseCheck('c.tsx', `export const C = () => <div className="a">hi</div>;\n`) ? 'FAIL' : 'PASS');

  // ── THE CEILING PROBES (ledger #318) ──────────────────────────────────────
  // STD-024: the FIRST is the REAL defect — the 12 shipped files PLUS
  // `api/deliveries/create.ts`, function #13 on 2026-06-20, verbatim.
  const SHIPPED_12 = [
    'api/campaigns.ts', 'api/customers/create.ts', 'api/dashboard.ts', 'api/discovery/ingest.ts',
    'api/members/invite.ts', 'api/orders/submit.ts', 'api/pmi/suggest.ts', 'api/qbo-connector.ts',
    'api/qbo/invoice/cultivar.ts', 'api/receipts/ocr.ts', 'api/social/enable.ts',
    'api/social/generate-posts.ts',
  ];
  ck('P7 🔴 THE REAL DEFECT (2026-06-20: api/deliveries/create.ts was #13) → OVER', 'OVER',
    countDeployedFunctions([...SHIPPED_12, 'api/deliveries/create.ts']) > FUNCTION_CEILING ? 'OVER' : 'UNDER',
    '13 > 12 — the deploy that silently failed for a day, and prod served the last-good bundle');
  ck('P8 the 12 we actually ship → AT the ceiling, not over', 'AT',
    countDeployedFunctions(SHIPPED_12) === FUNCTION_CEILING ? 'AT' : `${countDeployedFunctions(SHIPPED_12)}`,
    'zero headroom is the true state — the cap must pass here, or it blocks every build');
  // 🔴 P9 IS THE ONE `readdirSync('api').length` CANNOT DO. A 13th nested inside an EXISTING
  // directory adds no top-level entry, so the shallow count never moves.
  ck('P9 a 13th nested in an EXISTING dir still counts → OVER', 'OVER',
    countDeployedFunctions([...SHIPPED_12, 'api/qbo/invoice/kinna.ts']) > FUNCTION_CEILING ? 'OVER' : 'UNDER',
    'the shallow readdirSync form reports 11 here and passes');
  ck('P10 a non-code file is NOT a function (api/qbo/.DS_Store is live)', 'AT',
    countDeployedFunctions([...SHIPPED_12, 'api/qbo/.DS_Store']) === FUNCTION_CEILING ? 'AT' : 'MISCOUNTED',
    'a stray dotfile must not consume a slot — this one is in the repo today');
  ck('P11 a DIRECTORY is not a function', 'AT',
    countDeployedFunctions([...SHIPPED_12, 'api/qbo', 'api/social']) === FUNCTION_CEILING ? 'AT' : 'MISCOUNTED',
    'readdirSync counts these; the ceiling does not');
  ck('P12 removing one shows headroom — the cap can move DOWN too', 'UNDER',
    countDeployedFunctions(SHIPPED_12.slice(0, 11)) < FUNCTION_CEILING ? 'UNDER' : 'AT',
    'a negative control: if this said AT, the counter would be ignoring its input');
  ck('P13 every counted extension is one Vercel builds', 'true',
    String(['.ts', '.tsx', '.js', '.jsx', '.mjs'].every(e => PARSEABLE.has(e))));
  return R;
}

function walk(dir, out = []) {
  let e; try { e = readdirSync(dir); } catch { return out; }
  for (const x of e) {
    if (EXCLUDE_DIRS.has(x)) continue;
    const full = join(dir, x);
    let s; try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) walk(full, out);
    else if (PARSEABLE.has(extname(x))) out.push(full);
  }
  return out;
}

const B='\x1b[1m', D='\x1b[2m', RED='\x1b[31m', GRN='\x1b[32m', YEL='\x1b[33m', O='\x1b[0m';
console.log(`\n${B}API PARSE CAP — every deployed api/ file parses (A10)${O}\n`);

const probes = runProbes();
console.log(`${B}PROBES (STD-022 both directions · STD-024 the FIRST is the real defect)${O}`);
for (const p of probes) {
  console.log(`  ${p.ok ? GRN+'ok  '+O : RED+'BAD '+O} ${p.name}${p.ok ? '' : `  ${RED}(expected ${p.expect}, got ${p.got})${O}`}`);
  if (p.ok && p.detail) console.log(`        ${D}↳ ${p.detail}${O}`);
}
if (probes.some(p => !p.ok)) {
  console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report a scan from a checker that does not work.${O}\n`);
  process.exit(2);
}

const files = API_ROOTS.flatMap(r => walk(join(ROOT, r)));
const fails = [];
for (const f of files) {
  const rel = relative(ROOT, f);
  const r = parseCheck(rel, readFileSync(f, 'utf8'));
  if (r) fails.push({ rel, ...r });
}

console.log(`\n${B}SCANNED${O} ${files.length} deployed api/ files across ${API_ROOTS.length} root(s)`);
console.log(`${D}roots: ${API_ROOTS.join(' · ')} — ignition-os excluded (frozen donor, not deployed)${O}`);
console.log(`${D}NOTE: parse-only. Type errors in api/ are NOT checked by anything — tech-debt #77.${O}\n`);

if (fails.length) {
  console.error(`${RED}${B}✗ ${fails.length} deployed api/ file(s) DO NOT PARSE — a module that cannot parse takes every route with it:${O}`);
  for (const f of fails) {
    console.error(`   ${RED}${f.rel}${f.line ? `:${f.line}${f.column != null ? `:${f.column}` : ''}` : ''}${O}`);
    console.error(`      ${f.message}`);
    if (f.snippet) console.error(`      ${D}${f.snippet}${O}`);
  }
  console.error('');
  process.exit(1);
}
// ── THE CEILING, MEASURED ON THE REPO-ROOT api/ ONLY ─────────────────────────
// packages/*/api/** are IMPLEMENTATIONS re-exported by the shims; Vercel deploys the root
// directory, so only it consumes slots. Counting both would double every number.
const rootApiFiles = walk(join(ROOT, 'api')).map(f => relative(ROOT, f));
const fnCount = countDeployedFunctions(rootApiFiles);
const headroom = FUNCTION_CEILING - fnCount;

console.log(`${B}VERCEL FUNCTION CEILING${O} — ${fnCount} of ${FUNCTION_CEILING} (Hobby)`);
console.log(`${D}counted RECURSIVELY under api/ — one function per code file at any depth${O}`);
if (fnCount > FUNCTION_CEILING) {
  console.error(`\n${RED}${B}✗ ${fnCount} FUNCTIONS IN api/ — THE CEILING IS ${FUNCTION_CEILING}. THIS DEPLOY WILL FAIL SILENTLY.${O}`);
  console.error(`   ${RED}Vercel does not error on a 13th function: the whole deployment fails and the`);
  console.error(`   last-good bundle keeps being served, so production looks fine while serving STALE code.${O}`);
  console.error(`   ${D}That cost a day on 2026-06-20 (api/deliveries/create.ts). CLAUDE.md §6 r11 is a`);
  console.error(`   STOP-AND-SURFACE: ride an existing endpoint (a new \`action\`/\`shape\`/\`?_route=\` branch),`);
  console.error(`   consolidate a pair, or upgrade to Vercel Pro. Do not silently mint file #13.${O}`);
  console.error(`   ${D}files counted:${O}`);
  for (const f of rootApiFiles.filter(f => PARSEABLE.has(extname(f))).sort()) console.error(`     ${f}`);
  console.error('');
  process.exit(1);
}
if (headroom === 0) {
  console.log(`  ${YEL}⚠ ZERO HEADROOM${O} — the next api/ file is #13 and fails the deploy SILENTLY.`);
  console.log(`  ${D}§6 r11: reuse before mint. Minting #13 is a STOP-and-surface event, never silent.${O}`);
} else {
  console.log(`  ${GRN}${headroom} slot(s) free${O}`);
}
console.log('');

console.log(`${GRN}${B}✓ every deployed api/ file parses, and the function ceiling holds.${O}\n`);
