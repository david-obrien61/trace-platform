/**
 * importTs — import a TypeScript module from a maintenance script (ledger #345).
 *
 * PURPOSE:      A script that writes a registered domain's tables must go through that domain's
 *               writer (writer-registry.json), and the writers are TypeScript with extensionless
 *               imports, which node cannot load directly. This bundles one entry with esbuild into
 *               a temp file and imports it — so a script calls the SAME writer the app calls,
 *               instead of carrying its own copy of the insert.
 * DEPENDENCIES: esbuild (already a dev dependency of the verify chain).
 * OUTPUTS:      importTs(relativePathFromRepoRoot) → the module's exports.
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../..', import.meta.url).pathname;

export async function importTs(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), 'importts-')), 'entry.mjs');
  await build({
    entryPoints: [join(ROOT, entry)], bundle: true, platform: 'node', format: 'esm', outfile,
    logLevel: 'error', external: ['@supabase/supabase-js', '@electric-sql/pglite', '@electric-sql/pglite/*'],
  });
  return import(pathToFileURL(outfile).href);
}
