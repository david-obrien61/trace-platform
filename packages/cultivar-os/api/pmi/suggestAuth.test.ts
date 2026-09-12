/**
 * ── /api/pmi/suggest REFUSES A CALLER IT CANNOT PROVE — AND REFUSES BEFORE IT SPENDS ─────────
 *
 * WHAT THIS GUARDS: tech-debt #261. Until 2026-09-11 this endpoint authenticated NOBODY. It
 * fires a BILLABLE Claude call, it took `businessId` off the request body, and it was live in
 * production — so anyone with the URL could burn our Anthropic spend and attribute the
 * suggestion to any tenant.
 *
 * 🔴 WHY NOTHING CAUGHT IT, which is the finding worth more than the fix. capK
 * (`verify-universals.mjs:1089`) is the cap that exists for exactly this class — "SERVICE-KEY
 * WRITES MUST PROVE THE CALLER". Its trigger is `kUsesServiceKey`:
 *     /SUPABASE_SERVICE_KEY|adminDb\s*\(\s*\)/
 * This handler touches no database at all, so capK never evaluated it. **capK guards the
 * DATABASE, not the SPEND** — a handler that writes nothing is invisible to it, and a handler
 * that writes nothing is still an open till.
 *
 * 🔴 THE ASSERTION IS ORDERING, NOT JUST THE STATUS CODE — and that is deliberate (R-33: a
 * check that cannot disagree is not a check). A 403 alone would also be produced by a gate
 * placed AFTER the Anthropic call, which would refuse the caller having already paid for them.
 * So every probe runs with ANTHROPIC_API_KEY *set to a value*: if the gate is absent the handler
 * proceeds into the SDK and answers 503; if the gate is present it answers 403 without ever
 * constructing the client. **403 vs 503 is the discriminator, and it is only meaningful because
 * the key is present.** Probe D proves the discriminator itself is live by removing the gate.
 *
 * ⚠️ WHAT THIS FILE CANNOT PROVE, stated rather than left to be discovered: the PASS direction.
 * `callerCan` tries `callerIsBusinessOwner` first and that function exposes no injectable seam,
 * so a member-succeeds case cannot be reached without a live Supabase session. **That direction
 * is proven LIVE, against the real endpoint, and the run is recorded in the close-out.** A unit
 * test asserting only refusal would pass just as well on an endpoint that refuses EVERYONE.
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/cultivar-os/api/pmi/suggestAuth.test.ts \
 *     --bundle --platform=node --format=cjs --external:@anthropic-ai/sdk \
 *     --external:@supabase/supabase-js | node
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import handler from './suggest';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// Paths resolve from process.cwd(), which `scripts/run-tests.mjs` pins to the repo ROOT (it
// bundles to stdout and pipes into node, so __dirname is the cwd, not this file's directory).
// Same convention as `vendorEdit.test.ts:35`. A wrong path THROWS here rather than passing
// vacuously, which is the behaviour we want from a path assumption.
const R = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const SUGGEST_SRC = 'packages/cultivar-os/api/pmi/suggest.ts';
const PMI_SRC = 'packages/shared/src/modules/PMI.tsx';
const MANIFEST_SRC = 'packages/shared/src/auth/permissionManifest.ts';

// ── A FAKE res THAT RECORDS WHAT THE HANDLER ANSWERED ────────────────────────────────────────
function fakeRes() {
  const out: { code: number | null; body: any } = { code: null, body: null };
  const res: any = {
    status(c: number) { out.code = c; return res; },
    json(b: any) { if (out.code === null) out.code = 200; out.body = b; return res; },
    end() { return res; },
  };
  return { res, out };
}

function req(headers: Record<string, string>, body: any) {
  return { method: 'POST', headers, body };
}

const ASSET = { businessId: '00000000-0000-0000-0000-0000000000ff', name: 'Kubota L3901' };

async function main() {
  // The key is PRESENT throughout — see the header. Without it every probe would 503 for the
  // wrong reason and the discriminator would be dead.
  process.env.ANTHROPIC_API_KEY = 'sk-ant-not-a-real-key-probe-only';
  // No Supabase env → callerCan's env() returns null → false. Belt and braces: the token guard
  // in callerHoldsPermission already refuses a blank token before any network call.
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;

  // ── A. NO Authorization HEADER AT ALL — the anonymous caller #261 is about ──────────────────
  {
    const { res, out } = fakeRes();
    await handler(req({}, ASSET), res);
    ok(out.code === 403, `A1: anonymous call must be 403, got ${out.code} (503 = the gate is gone and the SDK was reached)`);
    ok(out.body?.code === 'FORBIDDEN', `A2: anonymous refusal must carry code FORBIDDEN, got ${JSON.stringify(out.body)}`);
    ok(out.body?.ok === false, 'A3: refusal must report ok:false');
  }

  // ── B. A HEADER THAT IS PRESENT BUT EMPTY / MALFORMED — still nobody ────────────────────────
  for (const h of ['', 'Bearer ', 'Bearer', 'Basic abc123']) {
    const { res, out } = fakeRes();
    await handler(req({ authorization: h }, ASSET), res);
    ok(out.code === 403, `B: authorization '${h}' must be 403, got ${out.code}`);
  }

  // ── C. THE 400 STILL COMES FIRST — a gate must not swallow a shape error ────────────────────
  {
    const { res, out } = fakeRes();
    await handler(req({}, { name: 'Kubota' }), res);
    ok(out.code === 400, `C1: missing businessId must be 400 (not 403), got ${out.code}`);
    const { res: r2, out: o2 } = fakeRes();
    await handler(req({}, { businessId: ASSET.businessId }), r2);
    ok(o2.code === 400, `C2: missing name must be 400, got ${o2.code}`);
  }

  // ── D. NEGATIVE CONTROL — the mutant. Strip the gate from the SOURCE and confirm the ────────
  // discriminator above would go RED. Without this, A and B could be passing because the
  // handler refuses everything for some unrelated reason. This is the probe that proves the
  // other probes can disagree.
  {
    const src = R(SUGGEST_SRC);
    const gate = /if \(!\(await callerCan\(authHeader, businessId, 'pmi:read'\)\)\) \{[\s\S]*?\n {2}\}\n/;
    ok(gate.test(src), 'D1: the gate must be findable in the source (if this fails the mutant below is vacuous)');
    const mutated = src.replace(gate, '');
    ok(!/callerCan\(authHeader/.test(mutated), 'D2: the mutant must actually have removed the gate');
    // The mutant is not executed (that would need a rebuild); D asserts the REMOVAL is real and
    // that the surviving code path reaches the ANTHROPIC key read — i.e. that a missing gate
    // means spend, which is the whole claim.
    const afterGate = mutated.slice(mutated.indexOf('businessId and name are required'));
    ok(/ANTHROPIC_API_KEY/.test(afterGate) && /client\.messages\.create/.test(afterGate),
      'D3: with the gate removed the next thing the handler does is read the key and spend — this is what #261 was');
  }

  // ── E. THE CLIENT HALF — a server gate whose caller sends no token 403s EVERYONE ────────────
  // The defect this catches is not hypothetical: before this build `PMI.tsx` sent only
  // Content-Type. Shipping the gate alone would have broken Suggest for the owner too.
  {
    const pmi = R(PMI_SRC);
    const at = pmi.indexOf("fetch('/api/pmi/suggest'");
    ok(at > -1, 'E0: the fetch must still be findable');
    const fetchBlock = pmi.slice(at, at + 600);
    ok(/authHeaders\(\)/.test(fetchBlock), 'E1: the /api/pmi/suggest fetch must attach authHeaders()');
    ok(/import \{ authHeaders \}/.test(pmi), 'E2: PMI.tsx must import the SHARED authHeaders (never a hand-rolled header)');
    ok(!/Authorization:\s*`Bearer/.test(fetchBlock), 'E3: the token must come from the shared helper, not be built inline');
  }

  // ── F. THE STRING IS AN EXISTING ONE — no permission was minted for this fix ────────────────
  {
    const manifest = R(MANIFEST_SRC);
    ok(/'pmi:read'/.test(manifest), 'F1: pmi:read must already exist in the manifest');
    const src = R(SUGGEST_SRC);
    const strings = [...src.matchAll(/callerCan\([^,]+,[^,]+,\s*'([^']+)'/g)].map((m) => m[1]);
    ok(strings.length === 1 && strings[0] === 'pmi:read',
      `F2: exactly one gate, on pmi:read — got ${JSON.stringify(strings)}`);
  }

  console.log(`\nsuggestAuth.test.ts — ${passed} passed, ${failed} failed`);
  if (failed) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
}

main();
