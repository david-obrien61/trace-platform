#!/usr/bin/env node
/**
 * ── verify-writer-registry — no capture path without a registered writer and a passing test ──────
 *
 * PURPOSE:      David's rule, 2026-09-17 (CLAUDE.md §6 r21): *"Single functions that are called,
 *               repeatable, dependable and verifiable. The test for each function verifies, from
 *               capture to write, that each path is validated; and if any change is made to the
 *               writer function, the same validation runs from each capture/change form to the
 *               database, so we have no gaps."* This is the check that makes it a build failure.
 *
 * HOW IT FINDS CAPTURE PATHS (read the regexes below; nothing else is consulted). Every source file
 * under packages/, api/ and scripts/ (tests, path tests and SQL fixtures excluded) is scanned for
 * four signals, per registered domain:
 *   1. input        — a .tsx/.jsx file that mentions "customer" and renders an <input>/<textarea>
 *                     whose props name a contact field (phone, email, billing, address, line1,
 *                     street, zip, postal, tel), or uses the editor's `input('phone')` helper.
 *   2. entry-call   — a call to any of the domain's `entryFunctions` (the writer and every function
 *                     that feeds it), outside its own definition.
 *   3. table-write  — `.from('<registered table>')…insert|update|upsert|delete(`, or SQL
 *                     `INSERT INTO / UPDATE / DELETE FROM <registered table>`.
 *   4. guarded-column-write — `.from('customers')…insert|update|upsert(` with a guarded column key.
 * A flagged file must be one of a path's `files`, or `declared` with a reason. A table-write or
 * guarded-column-write is allowed only in the writer's own files or a declared file.
 *
 * CHECKS (each FAILS the build):
 *   A  a flagged file is not registered                    (a new input path without a test)
 *   B  a declaration is stale — its file is gone or no longer flagged — or has no reason
 *   C  a path's `at` anchor or one of its `files` does not exist (prints file:line when it does)
 *   D  a registered table / guarded column is written outside the writer
 *   E  a path has no test in the domain's test file, or the test file tests an unregistered id
 *   F  a path's test did not PASS (ALL registered path tests run on every verify, so any change to
 *      a writer re-runs every path that feeds it)
 *
 * DEPENDENCIES: writer-registry.json · esbuild · @electric-sql/pglite (dev) · the path tests.
 * OUTPUTS:      exit 0/1. `--self-test` plants a violation for each check and proves it goes red.
 *               `--no-run` skips F (the scan alone, for a quick look).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const REGISTRY = join(ROOT, 'writer-registry.json');

// ── the scanner ───────────────────────────────────────────────────────────────────────────────
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const INPUT = /<(input|textarea)\b(?:=>|[^>])*?(phone|email|billing|address|line1|street|zip|postal|\btel\b)(?:=>|[^>])*>/is;
const HELPER = /\binput\(\s*'(phone|email|billing_\w+)'/;

export function scanFile(path, source, domain) {
  const s = stripComments(source);
  const hits = new Set();
  if (/\.(tsx|jsx)$/.test(path) && /customer/i.test(s) && (INPUT.test(s) || HELPER.test(s))) hits.add('input');
  const entry = new RegExp(`\\b(${domain.entryFunctions.join('|')})\\s*\\(`, 'g');
  for (const m of s.matchAll(entry)) {
    const before = s.slice(Math.max(0, m.index - 24), m.index);
    if (!/function\s*\*?\s*$/.test(before)) { hits.add('entry-call'); break; }
  }
  const tables = domain.tables.join('|');
  if (new RegExp(`from\\(\\s*['"](${tables})['"]\\s*\\)[^;]*?\\.(insert|update|upsert|delete)\\s*\\(`, 's').test(s)
      || new RegExp(`(insert\\s+into|update|delete\\s+from)\\s+(public\\.)?"?(${tables})\\b`, 'i').test(s)) hits.add('table-write');
  const g = domain.guardedColumns;
  if (g && new RegExp(`from\\(\\s*['"]${g.table}['"]\\s*\\)[^;]*?\\.(insert|update|upsert)\\s*\\([^;]*?\\b(${g.columns.join('|')})\\s*:`, 's').test(s)) hits.add('guarded-column-write');
  return [...hits];
}

function anchorLine(source, anchor) {
  const i = source.indexOf(anchor);
  return i < 0 ? null : source.slice(0, i).split('\n').length;
}

/** PURE: every check except running the tests, over a {path → source} map and a test-output map. */
export function evaluate(files, registry, testResults /* Map<domainId, Map<pathId, 'PASS'|'FAIL'>> | null */) {
  const problems = [];
  const lines = [];
  for (const d of registry.domains) {
    const pathFiles = new Set(d.paths.flatMap(p => p.files));
    const declared = new Map(d.declared.map(x => [x.file, x.reason]));
    const writerFiles = new Set(d.writerFiles);
    const flagged = new Map();
    for (const [f, src] of files) {
      if (/\.test\.|\/path-tests\/|sql-harness\/|\/dist\//.test(f)) continue;
      const hits = scanFile(f, src, d);
      if (hits.length) flagged.set(f, hits);
    }
    // A — unregistered capture path
    for (const [f, hits] of flagged) {
      if (!pathFiles.has(f) && !declared.has(f) && !writerFiles.has(f)) {
        problems.push(`A [${d.id}] ${f} looks like a capture path (${hits.join(', ')}) and is not in writer-registry.json — add it as a path with an end-to-end test, or declare it with a reason`);
      }
    }
    // B — stale or reasonless declarations
    for (const [f, reason] of declared) {
      if (!reason || reason.trim().length < 10) problems.push(`B [${d.id}] declaration for ${f} has no reason`);
      if (!files.has(f)) problems.push(`B [${d.id}] declaration for ${f} names a file that no longer exists — remove it`);
      else if (!flagged.has(f) && !pathFiles.has(f)) problems.push(`B [${d.id}] declaration for ${f} is STALE — the file no longer looks like a capture path; remove the declaration`);
    }
    // C — anchors and files
    const [wf, wa] = d.writer.at.split('#');
    const wl = files.has(wf) ? anchorLine(files.get(wf), wa) : null;
    if (wl === null) problems.push(`C [${d.id}] writer anchor not found: ${d.writer.at}`);
    else lines.push(`  writer ${d.writer.name} — ${wf}:${wl}`);
    for (const p of d.paths) {
      const [af, aa] = p.at.split('#');
      const al = files.has(af) ? anchorLine(files.get(af), aa) : null;
      if (al === null) problems.push(`C [${d.id}] path ${p.id}: input anchor not found — ${p.at}`);
      for (const f of p.files) if (!files.has(f)) problems.push(`C [${d.id}] path ${p.id}: file ${f} does not exist`);
      const r = testResults?.get(d.id)?.get(p.id) ?? (testResults ? 'MISSING' : 'not run');
      lines.push(`  ${r === 'PASS' ? '✅' : r === 'not run' ? '··' : '❌'} ${p.id} — ${af}:${al ?? '?'} → ${p.chain}`);
    }
    // D — writes outside the writer
    for (const [f, hits] of flagged) {
      for (const h of hits.filter(x => x === 'table-write' || x === 'guarded-column-write')) {
        if (!writerFiles.has(f) && !declared.has(f)) problems.push(`D [${d.id}] ${f} writes ${h === 'table-write' ? d.tables.join('/') : `customers.${d.guardedColumns.columns.join('/')}`} outside ${d.writer.name} — route it through the writer`);
      }
    }
    // E — test coverage by id, both directions
    const testSrc = files.get(d.tests);
    if (!testSrc) problems.push(`E [${d.id}] test file ${d.tests} does not exist`);
    else {
      const ids = new Set([...testSrc.matchAll(/await path\(\s*'([^']+)'/g)].map(m => m[1]));
      for (const p of d.paths) if (!ids.has(p.id)) problems.push(`E [${d.id}] path ${p.id} has no test in ${d.tests}`);
      for (const id of ids) if (!d.paths.some(p => p.id === id)) problems.push(`E [${d.id}] ${d.tests} tests '${id}', which is not a registered path`);
    }
    // F — the tests passed
    if (testResults) {
      const got = testResults.get(d.id) ?? new Map();
      for (const p of d.paths) {
        const r = got.get(p.id);
        if (r !== 'PASS') problems.push(`F [${d.id}] path ${p.id}: test ${r ?? 'did not report'}`);
      }
    }
  }
  return { problems, lines };
}

function sourceFiles() {
  const list = execSync('git ls-files -co --exclude-standard packages api scripts', { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(f => /\.(tsx?|jsx?|mjs|mts|cjs)$/.test(f) && existsSync(join(ROOT, f)));
  return new Map(list.map(f => [f, readFileSync(join(ROOT, f), 'utf8')]));
}

async function runPathTests(registry) {
  const { build } = await import('esbuild');
  const results = new Map();
  for (const d of registry.domains) {
    const out = join(ROOT, `.writer-registry-${d.id}.bundle.mjs`);
    const shim = (p) => join(ROOT, 'scripts/path-tests/lib', p);
    const got = new Map();
    try {
      await build({
        entryPoints: [join(ROOT, d.tests)], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
        external: ['@electric-sql/pglite', '@electric-sql/pglite/*', 'esbuild'],
        banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
        plugins: [{ name: 'writer-registry-shims', setup(b) {
          b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: shim('supabaseShim.mjs') }));
          b.onResolve({ filter: /supabase\/client$/ }, () => ({ path: shim('appClientShim.mjs') }));
        } }],
      });
      let text = '';
      try {
        text = execSync(`node "${out}"`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH_TEST_ROOT: ROOT }, maxBuffer: 64 * 1024 * 1024 });
      } catch (e) { text = String(e.stdout ?? ''); }
      for (const m of text.matchAll(/^PATH (\S+) (PASS|FAIL)(.*)$/gm)) {
        got.set(m[1], m[2]);
        if (m[2] === 'FAIL') console.log(`  ❌ ${m[1]}${m[3]}`);
      }
    } catch (e) {
      console.log(`  ❌ ${d.id}: the path tests did not build — ${String(e.message).split('\n')[0]}`);
    } finally {
      rmSync(out, { force: true });
    }
    results.set(d.id, got);
  }
  return results;
}

// ── self-test: every check proven red, and a clean registry proven green ──────────────────────
function selfTest() {
  const domain = {
    id: 't', writer: { name: 'w', at: 'w.ts#function writeIt' }, writerFiles: ['w.ts'], tables: ['customer_phones'],
    guardedColumns: { table: 'customers', columns: ['phone'] }, entryFunctions: ['writeIt'], tests: 't.paths.mts',
    paths: [{ id: 'p1', at: 'form.tsx#function save', files: ['form.tsx'], chain: 'form → writeIt' }],
    declared: [{ file: 'search.tsx', reason: 'a search box, not a capture of a contact' }],
  };
  const base = () => new Map([
    ['w.ts', "export function writeIt() { return db.from('customer_phones').insert(x); }"],
    ['form.tsx', "const customerForm = 1;\nfunction save() { writeIt(); }\nconst el = <input value={phone} onChange={e => setPhone(e.target.value)} />;"],
    ['search.tsx', "const customerQuery = 1;\nconst el = <input value={q} placeholder=\"phone or email\" />;"],
    ['t.paths.mts', "await path('p1', 'x', async () => {});"],
  ]);
  const reg = () => ({ domains: [JSON.parse(JSON.stringify(domain))] });
  const pass = new Map([['t', new Map([['p1', 'PASS']])]]);
  const probes = [];
  const expect = (name, files, registry, results, code) => {
    const { problems } = evaluate(files, registry, results);
    const red = problems.some(p => p.startsWith(code));
    const ok = code === null ? problems.length === 0 : red;
    probes.push(ok);
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ` — got: ${problems.join(' | ') || '(nothing)'}`}`);
  };
  expect('negative control: a fully registered domain is green', base(), reg(), pass, null);
  { const f = base(); f.set('checkout2.tsx', "const customerStep = 1;\nconst el = <input type=\"tel\" value={phone} />;"); expect('A: a new customer phone input with no registry entry is red', f, reg(), pass, 'A'); }
  { const f = base(); f.set('api/new.ts', "export default async () => { await writeIt(); }"); expect('A: a new endpoint calling the writer is red', f, reg(), pass, 'A'); }
  { const f = base(); f.set('search.tsx', "export const nothing = 1;"); expect('B: a declaration whose file stopped looking like a path is red (stale)', f, reg(), pass, 'B'); }
  { const r = reg(); r.domains[0].declared[0].reason = ''; expect('B: a declaration without a reason is red', base(), r, pass, 'B'); }
  { const f = base(); f.set('form.tsx', "const customerForm = 1;\nfunction store() { writeIt(); }\nconst el = <input value={phone} />;"); expect('C: a path whose input anchor moved away is red', f, reg(), pass, 'C'); }
  { const f = base(); f.set('script.mjs', "await sb.from('customer_phones').update({ active: false }).eq('id', x);"); expect('D: a table write outside the writer is red', f, reg(), pass, 'D'); }
  { const f = base(); // Assembled from pieces so this file is not itself a literal customers write (contactRecord.test L2).
    f.set('seed.mjs', "await sb.from('" + 'custom' + "ers').insert({ first_name: 'a', phone: '1' });"); expect('D: a guarded-column write on customers is red', f, reg(), pass, 'D'); }
  { const f = base(); f.set('t.paths.mts', "// nothing"); expect('E: a path with no test is red', f, reg(), pass, 'E'); }
  { const f = base(); f.set('t.paths.mts', "await path('p1', 'x', async () => {});\nawait path('p9', 'y', async () => {});"); expect('E: a test for an unregistered id is red', f, reg(), pass, 'E'); }
  expect('F: a failing path test is red', base(), reg(), new Map([['t', new Map([['p1', 'FAIL']])]]), 'F');
  expect('F: a path test that never reported is red', base(), reg(), new Map([['t', new Map()]]), 'F');
  { const f = base(); f.set('arrow.tsx', "const customerStep = 1;\nconst el = <input onChange={e => set(e.target.value)} value={form.email} />;"); expect('A: an input whose props contain an arrow function is still seen', f, reg(), pass, 'A'); }
  const failed = probes.filter(p => !p).length;
  console.log(failed ? `\n❌ writer-registry self-test: ${failed} of ${probes.length} probes failed` : `\n✅ writer-registry self-test: ${probes.length}/${probes.length} probes, both directions`);
  process.exit(failed ? 1 : 0);
}

// ── main ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv.includes('--self-test')) selfTest();
else {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const files = sourceFiles();
  const results = process.argv.includes('--no-run') ? null : await runPathTests(registry);
  const { problems, lines } = evaluate(files, registry, results);
  for (const d of registry.domains) console.log(`\n── writer registry · ${d.id}: ${d.paths.length} capture paths, ${d.declared.length} declared non-paths`);
  for (const l of lines) console.log(l);
  if (problems.length) {
    console.log(`\n❌ verify-writer-registry — ${problems.length} problem(s):`);
    for (const p of problems) console.log(`  ${p}`);
    process.exit(1);
  }
  console.log(`\n✅ verify-writer-registry — every capture path is registered${results ? ' and its end-to-end test passed' : ' (tests not run: --no-run)'}.`);
}
