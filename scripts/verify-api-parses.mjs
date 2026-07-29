#!/usr/bin/env node
// ============================================================
// verify-api-parses — EVERY DEPLOYED api/ FILE PARSES (A10)
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
// OUTPUTS:      exit 0 = every file parses · 1 = a parse failure (file, line, esbuild's message)
//               · 2 = the cap's own probes failed, so it refuses to report.
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
console.log(`${GRN}${B}✓ every deployed api/ file parses.${O}\n`);
