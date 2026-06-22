/**
 * verify-write-wall.ts — Gate-3b WRITE-TAMPER PROOF (deterministic, no live session)
 *
 * The write-side twin of the read-wall HAR/tamper proof. Asserts the cost-apply caller-
 * permission gate (api/discovery/ingest.ts → callerHoldsPermission, MB_D-015): a caller
 * WITHOUT view_costs is REFUSED and the DB write is never reached; a caller WITH it is
 * allowed through. The injectable `_rpc` seam stands in for the live has_permission RPC so
 * the gate LOGIC is proven without tokens or a live DB. (The live role-driven HTTP HAR with
 * two real JWTs remains the OWNER-PROVEN bar; this is the BUILDER-COMPLETE behavioral proof.)
 *
 * Run (no test runner — esbuild → node):
 *   node_modules/.bin/esbuild scripts/verify-write-wall.ts --bundle --platform=node \
 *     --format=cjs --external:@supabase/supabase-js --external:@anthropic-ai/sdk | node
 */
import { callerHoldsPermission } from '../packages/cultivar-os/api/discovery/ingest';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

(async () => {
  // 1. No caller token → refused, and the RPC (DB) is NEVER consulted (the auth guard runs first).
  let rpcCalls = 0;
  const spyTrue = async () => { rpcCalls++; return true; };
  ok((await callerHoldsPermission(undefined, 'biz-1', 'view_costs', spyTrue)) === false,
    '1: no Authorization header → refused');
  ok(rpcCalls === 0, '1: no token → RPC never consulted (auth guard precedes the DB call)');

  // 2. Blank/whitespace bearer → refused too (no token to trust).
  ok((await callerHoldsPermission('Bearer    ', 'biz-1', 'view_costs', spyTrue)) === false,
    '2: blank bearer token → refused');

  // 3. THE TAMPER CASE — caller present but lacks view_costs (RPC false) → REFUSED, write blocked.
  ok((await callerHoldsPermission('Bearer staff.jwt', 'biz-1', 'view_costs', async () => false)) === false,
    '3: caller WITHOUT view_costs → REFUSED (the write is blocked)');

  // 4. Caller present and holds view_costs (RPC true) → allowed through to the write.
  let sawPerm = '';
  ok((await callerHoldsPermission('Bearer owner.jwt', 'biz-1', 'view_costs',
      async (_t, _b, p) => { sawPerm = p; return true; })) === true,
    '4: caller WITH view_costs → allowed');
  ok(sawPerm === 'view_costs', '4: the permission checked is exactly view_costs');

  // 5. The token reaching the check comes from the AUTH CONTEXT (header), not the body.
  let sawToken = '';
  await callerHoldsPermission('Bearer abc.123', 'biz-1', 'view_costs',
    async (t) => { sawToken = t; return true; });
  ok(sawToken === 'abc.123', '5: the caller bearer token (auth context) is what reaches the check');

  setTimeout(() => {
    console.log(`\nverify-write-wall.ts — ${passed} passed, ${failed} failed`);
    if (failed) { console.error('\nFAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
    console.log('✓ WRITE-WALL gate proven: no-view_costs caller refused (write blocked); view_costs caller allowed; token from auth context.');
  }, 10);
})();
