/**
 * ── diffPermissions — the blast-radius the Roles-tab confirm shows · permission funnel · 2026-07-23 ──
 *
 * RED-first (STD-002): the invariant is what a role save GAINS vs what it LOSES for a member,
 * asserted as behavior, not a pinned count. Ruling #1's consequence — "a role save can REMOVE
 * authority from people; the confirm must name what they lose" — is exactly `removed`.
 *
 * Run (pure TS, no React — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/auth/roleFunnel.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { diffPermissions } from './roleFunnel';

let passed = 0, failed = 0;
const failures: string[] = [];
const eq = (a: unknown, b: unknown, msg: string) => {
  if (JSON.stringify(a) === JSON.stringify(b)) passed++;
  else { failed++; failures.push(msg); console.error(`   ✗ ${msg} (got ${JSON.stringify(a)})`); }
};

// ── A — a pure GRANT (nothing lost) ─────────────────────────────────────────────
{
  const d = diffPermissions(['view_orders'], ['view_orders', 'import_pricing']);
  eq(d.added, ['import_pricing'], 'A: added names the new grant');
  eq(d.removed, [], 'A: nothing removed on a pure grant');
}

// ── B — a REVOCATION (the dangerous case ruling #1 exists for) ───────────────────
{
  const d = diffPermissions(['view_costs', 'view_margin', 'qr_checkout'], ['qr_checkout']);
  eq(d.removed, ['view_costs', 'view_margin'], 'B: removed names EVERY permission lost');
  eq(d.added, [], 'B: nothing added on a pure revocation');
}

// ── C — mixed (some gained, some lost) in ONE save ──────────────────────────────
{
  const d = diffPermissions(['a', 'b', 'c'], ['b', 'c', 'd']);
  eq(d.added, ['d'], 'C: added');
  eq(d.removed, ['a'], 'C: removed');
}

// ── D — identical sets → empty blast radius (a no-op save changes no one) ────────
{
  const d = diffPermissions(['a', 'b'], ['b', 'a']);
  eq(d.added, [], 'D: reorder is not a grant');
  eq(d.removed, [], 'D: reorder is not a revocation');
}

// ── E — from-nothing and to-nothing edges ───────────────────────────────────────
{
  eq(diffPermissions([], ['x']).added, ['x'], 'E: first grant on an empty member');
  eq(diffPermissions(['x'], []).removed, ['x'], 'E: wiping to empty loses everything');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
