/**
 * ── discovery/ingest — action='cost-apply' AT THE HANDLER, not at the helper · 2026-09-22 ──
 *
 * 🔴 RED-FIRST, AND THE RED IS A ReferenceError, NOT A WRONG ANSWER.
 *
 * `ingest.ts:34` was `export { callerHoldsPermission } from '.../callerPermission'`. A bare
 * re-export forwards a binding to IMPORTERS and creates NO LOCAL BINDING in the re-exporting
 * module — so the write-wall gate at `:77`, which calls the name directly, threw
 * `ReferenceError: callerHoldsPermission is not defined` on every cost-apply request.
 * The line's own comment asserted the opposite: *"re-exported here so its importers
 * (scripts/verify-write-wall.ts) AND THE COST-APPLY CALL SITE BELOW are unchanged."* [[R-26]].
 *
 * 🔴 WHY NOTHING CAUGHT IT — THIS IS THE FINDING, AND IT IS WHY THIS FILE EXISTS ([[R-33]] (c)).
 *   · `scripts/verify-write-wall.ts:15` IMPORTS `callerHoldsPermission` FROM `ingest.ts`. The
 *     re-export works for importers, so its "behavioural proof" exercised the helper through a
 *     door that was never broken — and never called the handler at all.
 *   · `verify-universals.mjs` cap7 greps the LITERAL STRING `callerHoldsPermission(req` in the
 *     endpoint source. An undefined identifier is the same string as a defined one, so a text
 *     check passes on a crash.
 *   Both were green. Every probe below therefore goes through the DEFAULT-EXPORTED HANDLER.
 *
 * THE FIX IS `callerHoldsPermission`, NOT `callerCan` — and that is a ruling, not a preference.
 * `callerCan` is `callerIsBusinessOwner(...) || callerHoldsPermission(...)`. The 2026-07-30
 * ruling, recorded in `20260910_permission_literal_merge.sql`, removed the owner branch from
 * `has_permission`: *"NO OWNER BRANCH (ruling 2026-07-30) — an owner passes by holding the
 * string, like every other member."* Gating this endpoint on `callerCan` would re-introduce at
 * the API layer exactly the divergence that ruling deleted in the database. So an OWNER is
 * allowed HERE by holding `costs:read`, which is what P5–P7 assert.
 *
 * SEAM: the handler calls the helper with three arguments, so the `_rpc` test seam is not
 * reachable from here — by design; a probe that injected it would stop testing the handler.
 * Instead the EXTERNAL `@supabase/supabase-js` module is intercepted before `./ingest` is
 * initialised, which lets the probes assert the one thing the write-wall is actually about:
 * WAS THE SERVICE-KEY CLIENT EVER CONSTRUCTED? It must not be, for a refused caller.
 *
 * Run:  node_modules/.bin/esbuild packages/cultivar-os/api/discovery/ingestCostApply.test.ts \
 *         --bundle --platform=node --format=cjs --external:@supabase/supabase-js \
 *         --external:@anthropic-ai/sdk | node
 */
import NodeModule from 'node:module';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── THE INTERCEPT — installed BEFORE ./ingest is initialised ─────────────────────
// esbuild leaves `@supabase/supabase-js` external, so ingest's `require` of it resolves through
// node at module-init time. `./ingest` is imported DYNAMICALLY below so this hook is in place
// first; a static import would be hoisted above it and the real client would load.
type ClientCall = { url: string; key: string; auth: string | undefined };
const clients: ClientCall[] = [];
const rpcCalls: Array<{ fn: string; args: Record<string, unknown>; token: string | undefined }> = [];
let PERMIT = false;

type Loader = { _load: (request: string, parent: unknown, isMain: boolean) => unknown };
const Mod = NodeModule as unknown as Loader;
const realLoad = Mod._load;
Mod._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === '@supabase/supabase-js') {
    return {
      createClient(url: string, key: string, opts?: { global?: { headers?: Record<string, string> } }) {
        const auth = opts?.global?.headers?.Authorization;
        clients.push({ url, key, auth });
        const token = auth ? String(auth).replace(/^Bearer\s+/i, '') : undefined;
        const chain: unknown = new Proxy(function () { /* chainable */ }, {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'stub: no live database in this test' } });
            return () => chain;
          },
          apply() { return chain; },
        });
        return {
          rpc(fn: string, args: Record<string, unknown>) {
            rpcCalls.push({ fn, args, token });
            return Promise.resolve({ data: fn === 'has_permission' ? PERMIT : null, error: null });
          },
          from() { return chain; },
        };
      },
    };
  }
  return realLoad.apply(this, [request, parent, isMain] as never);
};

process.env.SUPABASE_URL = 'https://stub.supabase.co';
process.env.SUPABASE_ANON_KEY = 'ANON-KEY';
process.env.SUPABASE_SERVICE_KEY = 'SERVICE-KEY';

// ── the request/response doubles ─────────────────────────────────────────────────
type Captured = { code: number; body: unknown };
function makeRes() {
  const cap: Captured = { code: 200, body: undefined };
  const res = {
    status(c: number) { cap.code = c; return res; },
    json(b: unknown) { cap.body = b; return res; },
  };
  return { res, cap };
}
function costApplyReq(authorization?: string) {
  return {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body: {
      action: 'cost-apply',
      line: { id: 'line-1', businessId: 'biz-1' },
      reasoning: { unitCost: 12.5, confidence: 'high', rationale: 'stub' },
    },
  };
}

async function main() {
  const mod = await import('./ingest');
  const handler = mod.default as (req: unknown, res: unknown) => Promise<unknown>;

  // ── §A THE CRASH ITSELF ────────────────────────────────────────────────────────
  // This is the probe that was RED before the fix, with
  // `ReferenceError: callerHoldsPermission is not defined`.
  clients.length = 0; rpcCalls.length = 0; PERMIT = false;
  let threw: unknown = null;
  const a = makeRes();
  try { await handler(costApplyReq(), a.res); } catch (e) { threw = e; }
  ok(threw === null,
    '🔴 P1 cost-apply does not THROW — the re-export at ingest.ts:34 created no local binding, so the gate at :77 raised ReferenceError'
        + (threw ? ` · got: ${(threw as Error).name}: ${(threw as Error).message}` : ''));
  ok(!(threw instanceof ReferenceError),
    '🔴 P2 and specifically not a ReferenceError — the exact failure the live 500 was made of');

  // ── §B A CALLER WITHOUT THE PERMISSION IS REFUSED ──────────────────────────────
  // No Bearer token: `callerHoldsPermission` refuses at the token guard, BEFORE any network
  // call. This is the fail-closed direction and it must reach a 403, not a crash.
  ok(a.cap.code === 403, `🔴 P3 no Authorization header → 403 refused (got ${a.cap.code})`);
  ok(String(JSON.stringify(a.cap.body)).includes('costs:read'),
    'P4 the refusal NAMES the permission required — a withheld action announces why (D-9)');
  ok(!clients.some(c => c.key === 'SERVICE-KEY'),
    '🔴 P5 THE WRITE-WALL HELD — the SERVICE-KEY client was never constructed for a refused caller. This is the assertion the whole gate exists for, and it is the one verify-write-wall.ts could not make, because it never called the handler');

  // A real member, with a real token, who does NOT hold costs:read → has_permission false.
  clients.length = 0; rpcCalls.length = 0; PERMIT = false;
  const b = makeRes();
  await handler(costApplyReq('Bearer member.jwt'), b.res);
  ok(b.cap.code === 403, `🔴 P6 a MEMBER holding a valid token but NOT costs:read → 403 (got ${b.cap.code})`);
  ok(!clients.some(c => c.key === 'SERVICE-KEY'),
    '🔴 P7 no service-key client for that member either — the refusal is before the write, not after it');
  ok(rpcCalls.length === 1 && rpcCalls[0]?.fn === 'has_permission',
    'P8 the decision came from the canonical has_permission RPC, not from a local re-implementation');

  // ── §C AN OWNER IS ALLOWED — BY HOLDING THE STRING (ruling 2026-07-30) ──────────
  clients.length = 0; rpcCalls.length = 0; PERMIT = true;
  const c = makeRes();
  await handler(costApplyReq('Bearer owner.jwt'), c.res);
  ok(c.cap.code !== 403,
    `🔴 P9 an OWNER holding costs:read is ALLOWED — not refused (got ${c.cap.code})`);
  ok(clients.some(cl => cl.key === 'SERVICE-KEY'),
    '🔴 P10 and the gate let the write path OPEN — the service-key client IS constructed once the caller is proven. P5 and P10 are the same assertion from the two sides; either alone could pass on a gate that always says the same thing');
  ok(rpcCalls[0]?.args?.p_perm === 'costs:read' && rpcCalls[0]?.args?.p_business_id === 'biz-1',
    'P11 the gate asked about the RIGHT permission for the RIGHT business');
  ok(rpcCalls[0]?.token === 'owner.jwt',
    '🔴 P12 authority was resolved from the AUTH CONTEXT, never the body — the caller client carried the Bearer token');

  // ── §D ORDERING, STATED AS ITS OWN FACT ────────────────────────────────────────
  // The anon/caller client must be built BEFORE the service-key client. If a future edit moves
  // the env read or the createClient above the gate, this goes red while P9/P10 stay green.
  const anonIdx = clients.findIndex(cl => cl.key === 'ANON-KEY');
  const svcIdx = clients.findIndex(cl => cl.key === 'SERVICE-KEY');
  ok(anonIdx >= 0 && svcIdx >= 0 && anonIdx < svcIdx,
    `🔴 P13 the CALLER check is constructed before the SERVICE-KEY writer (anon@${anonIdx} < service@${svcIdx})`);

  // ── §E THE OTHER ACTIONS ARE UNAFFECTED ────────────────────────────────────────
  // cost-apply is the ONLY branch that reaches :77; a bad `line` must still be a 400, which
  // proves the body validation still runs ahead of the gate rather than being bypassed by it.
  clients.length = 0; rpcCalls.length = 0; PERMIT = true;
  const d = makeRes();
  await handler({ method: 'POST', headers: {}, body: { action: 'cost-apply', line: { id: 'x' } } }, d.res);
  ok(d.cap.code === 400, `P14 cost-apply with an incomplete line is still a 400 (got ${d.cap.code})`);
  ok(rpcCalls.length === 0, 'P15 and it never reached the gate — validation first, then authority');

  const e = makeRes();
  await handler({ method: 'GET', headers: {}, body: {} }, e.res);
  ok(e.cap.code === 405, `P16 a non-POST is still 405 (got ${e.cap.code})`);

  console.log(`\ningestCostApply — ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
}

main().catch((err) => {
  console.error('ingestCostApply — 0 passed, 1 failed');
  console.error('FAILURES:\n  - the suite itself threw: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
