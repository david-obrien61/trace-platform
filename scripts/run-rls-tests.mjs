#!/usr/bin/env node
/**
 * ── RLS TEST RUNNER — every *.rls.mjs under scripts/rls/ ──────────────────────────────
 *
 * PURPOSE:      Run the member-authenticating integration suite as one gate. These tests sign
 *               in as an ephemeral member with the ANON key and assert under REAL row-level
 *               security — the service key only mints and deletes the principal.
 * DEPENDENCIES: scripts/lib/memberSession.mjs · packages/cultivar-os/.env.local · NETWORK · a
 *               live Supabase tenant.
 * OUTPUTS:      per-file pass/fail + summary. Exit 1 if any file fails.
 *
 * ⚠️ DELIBERATELY **NOT** CHAINED INTO `npm run verify`. That gate must stay offline and
 * deterministic: it runs on every build and must not depend on Supabase being reachable, on
 * credentials existing, or on a tenant's data. This one needs all three. Chaining it would make
 * a network blip look like a code regression — and a gate that fails for reasons unrelated to
 * the change gets worked around, which is worse than no gate (David's rule, from the write-path
 * ratchet). Run it deliberately: `npm run verify:rls`.
 *
 * WHERE IT IS NAMED so it does not rot unwired (the failure mode that already cost us three
 * times — 24 unchained unit tests, the stale Note A assertions, and the financial-wall harness
 * that had been red for weeks with nobody running it):
 *   · docs/owner-tests/customer-edit-surface-full-surface-test.md → card 7 header
 *   · package.json → `verify:rls`
 *
 * Optional: RLS_BUSINESS_ID=<uuid> to pin the tenant (defaults to the first business row).
 */
import { execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'scripts/rls');
const filter = process.argv[2] || '';

if (!existsSync(DIR)) { console.error('No scripts/rls directory.'); process.exit(1); }

const files = readdirSync(DIR).filter((f) => f.endsWith('.rls.mjs') && f.includes(filter)).sort();
if (files.length === 0) { console.error(`No .rls.mjs files${filter ? ` matching "${filter}"` : ''}.`); process.exit(1); }

console.log(`\n══ RLS INTEGRATION TESTS — ${files.length} file(s), real RLS, anon-key sessions ══`);

const failed = [];
for (const f of files) {
  const rel = relative(ROOT, join(DIR, f));
  try {
    execSync(`node "${join(DIR, f)}"`, { cwd: ROOT, stdio: 'inherit' });
    console.log(`\n  ✅ ${rel}\n`);
  } catch {
    failed.push(rel);
    console.log(`\n  ❌ ${rel}\n`);
  }
}

console.log(`══ ${files.length - failed.length}/${files.length} RLS test files pass ══\n`);
if (failed.length) {
  console.error('RED:\n' + failed.map((f) => ' - ' + f).join('\n'));
  process.exit(1);
}
