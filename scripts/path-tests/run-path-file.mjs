#!/usr/bin/env node
/**
 * run-path-file — build and run ONE path-test file exactly as verify-writer-registry does (ledger #347).
 * PURPOSE:      a quick single-file run while building, and the runner the crew-day mutants use.
 * DEPENDENCIES: esbuild · scripts/path-tests/lib (the PGlite stand-ins for supabase-js).
 * OUTPUTS:      the file's PATH / GUARD lines on stdout; exit 1 if the file failed.
 * Usage:        node scripts/path-tests/run-path-file.mjs scripts/path-tests/crew-day.paths.mts
 *               PATH_ONLY=crew.done,crew.expired node scripts/path-tests/run-path-file.mjs …
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const entry = process.argv[2];
if (!entry) { console.error('usage: run-path-file.mjs <path-test file>'); process.exit(2); }
const out = join(ROOT, '.writer-registry-single.bundle.mjs');
const shim = (p) => join(ROOT, 'scripts/path-tests/lib', p);
await build({
  entryPoints: [join(ROOT, entry)], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
  external: ['@electric-sql/pglite', '@electric-sql/pglite/*', 'esbuild'],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  plugins: [{ name: 'path-test-shims', setup(b) {
    b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: shim('supabaseShim.mjs') }));
    b.onResolve({ filter: /supabase\/client$/ }, () => ({ path: shim('appClientShim.mjs') }));
  } }],
});
let code = 0;
try {
  process.stdout.write(execSync(`node "${out}"`, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PATH_TEST_ROOT: ROOT }, maxBuffer: 64 * 1024 * 1024 }));
} catch (e) {
  process.stdout.write(String(e.stdout ?? ''));
  process.stderr.write(String(e.stderr ?? '').slice(0, 4000));
  code = 1;
} finally {
  rmSync(out, { force: true });
}
process.exit(code);
