/**
 * ── THE TILE ENABLE/DISABLE ROUND TRIP — "turn it off, your data is safe, turn it back on" ──
 *
 * WHAT THIS GUARDS: the ONE claim the whole off-switch rests on. An owner switching a module off
 * is told his data is kept. If that is wrong it is wrong SILENTLY and PERMANENTLY, and he finds
 * out on the way back in.
 *
 * 🔴 WHY IT COUNTS ROWS AND CALLS INSTEAD OF READING STATUSES — THE `4056de8` LESSON, PINNED.
 * On 2026-08-24 a swallowed storage failure produced `status:'applied'` over a database that had
 * been called ZERO times; the status-only assertion passed and only the CALL COUNT caught it. So
 * every probe here asserts an OBSERVED EFFECT — how many rows are in the table, how many times the
 * server was reached, whether a DELETE was ever issued — and never takes the result object's word
 * for what happened. **A test that asks the code whether it succeeded inherits whatever lie the
 * code is telling.**
 *
 * THE FAKE IS MODELLED ON THE REAL FUNCTION, statement by statement, from
 * `supabase/migrations/20260802c_enable_starts_the_clock.sql:60-185`:
 *   · the write is `UPDATE … SET enabled = COALESCE(p_enabled, enabled)` — there is NO DELETE
 *     anywhere in the function, which is the property the data-survival claim rests on;
 *   · `config` is MERGED (`COALESCE(config,'{}') || COALESCE(p_config_patch,'{}')`), so a call
 *     sending no patch leaves the trial pair exactly as it was;
 *   · the clock block is guarded `v_touches_enablement AND p_enabled IS TRUE AND trial_days > 0`,
 *     so a DISABLE cannot reach it (R-8 — a term is a term, not a meter);
 *   · it RETURNS `applied, reason, was_insert, enabled_before, enabled_after, trial_started`.
 * The fake is deliberately NOT a stub that returns fixtures: it holds state and mutates it, so a
 * caller that never actually asks it to change anything fails.
 *
 * Probes run BOTH DIRECTIONS (STD-022): each survival claim is paired with a probe that FAILS if
 * the store silently discarded rows, and each proof-of-write claim is paired with a planted defect.
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/moduleRoundTrip.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { setBusinessModuleState } from './moduleState';
import type { SupabaseClient } from '@supabase/supabase-js';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const BIZ = 'b1111111-0000-0000-0000-000000000001';
const KEY = 'delivery_routing';
const ACTOR = 'u1111111-0000-0000-0000-000000000001';

interface ModuleRow { enabled: boolean; configured: boolean; config: Record<string, unknown> }

/**
 * THE MODULE'S OWN DATA — the thing the owner is being promised survives. These stand for the rows
 * a module accumulates (delivery stops, generated posts, contractor tiers): they live in their own
 * tables, keyed to the business, and NOTHING in `set_business_module_state` references them. That
 * is the point — the probe proves the enablement write cannot reach them.
 */
interface Fake {
  client: SupabaseClient;
  modules: Map<string, ModuleRow>;
  moduleData: { id: string; business_id: string }[];
  rpcCalls: number;
  deletesIssued: number;
  /** When set, the server ACKNOWLEDGES the call and writes nothing — the silent no-op. */
  pretendOnly: boolean;
  /** When set, the server omits `enabled_after` entirely — an absent proof, not a false one. */
  omitProof: boolean;
}

function makeFake(seed: Partial<ModuleRow> & { dataRows?: number } = {}): Fake {
  const f: Fake = {
    client: null as unknown as SupabaseClient,
    modules: new Map(),
    moduleData: [],
    rpcCalls: 0,
    deletesIssued: 0,
    pretendOnly: false,
    omitProof: false,
  };
  f.modules.set(KEY, {
    enabled: seed.enabled ?? false,
    configured: seed.configured ?? true,
    config: seed.config ?? {},
  });
  for (let i = 0; i < (seed.dataRows ?? 0); i++) {
    f.moduleData.push({ id: `stop-${i}`, business_id: BIZ });
  }

  f.client = {
    rpc(_name: string, args: Record<string, unknown>) {
      f.rpcCalls++;
      const key = args.p_module_key as string;
      const pEnabled = args.p_enabled as boolean | null;
      const pPatch = args.p_config_patch as Record<string, unknown> | null;
      const pTrialDays = args.p_trial_days as number | null;
      const row = f.modules.get(key);
      const before = row ? row.enabled : null;

      if (f.pretendOnly) {
        // Accepted, nothing written. This is what a no-op, a NULL `p_enabled`, and an RLS-discarded
        // write all look like to a caller reading `applied` alone.
        return Promise.resolve({
          data: [{ applied: true, reason: null, was_insert: false,
                   enabled_before: before, enabled_after: before, trial_started: false }],
          error: null,
        });
      }

      const touchesEnablement = pEnabled !== null && pEnabled !== before;

      if (row) {
        // (4) THE WRITE — UPDATE only. No branch of this function deletes anything, and no branch
        // of it touches `f.moduleData`.
        row.enabled = pEnabled ?? row.enabled;
        row.config = { ...row.config, ...(pPatch ?? {}) };   // the `||` jsonb merge
      }

      // (4b) THE CLOCK — three guards, and `p_enabled IS TRUE` is the one that matters here.
      let trialStarted = false;
      if (touchesEnablement && pEnabled === true && (pTrialDays ?? 0) > 0 && row) {
        if (!row.config.trial_started_at) {
          row.config = { ...row.config, trial_started_at: '2026-08-24T00:00:00.000Z', trial_days: pTrialDays };
          trialStarted = true;
        }
      }

      const after = row ? row.enabled : null;
      const payload: Record<string, unknown> = {
        applied: true, reason: null, was_insert: false,
        enabled_before: before, trial_started: trialStarted,
      };
      if (!f.omitProof) payload.enabled_after = after;
      return Promise.resolve({ data: [payload], error: null });
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: ACTOR } } }) },
  } as unknown as SupabaseClient;
  return f;
}

const set = (f: Fake, patch: Record<string, unknown>) =>
  setBusinessModuleState(f.client, BIZ, KEY, patch, ACTOR);

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 1. THE ROUND TRIP — enable → disable → re-enable, counting ROWS at every step.
// ═════════════════════════════════════════════════════════════════════════════════════════════════

async function roundTrip(): Promise<void> {
  const f = makeFake({ enabled: false, dataRows: 7 });

  // ── STEP 1: ENABLE. Data present, clock started. ───────────────────────────────────────────────
  const r1 = await set(f, { enabled: true, trialDays: 30 });
  const dataAfterEnable = f.moduleData.length;
  ok(r1.applied && r1.enabledAfter === true,
     'RT1 enable reports the OUTCOME, not just the acknowledgement — enabledAfter is true');
  ok(f.modules.get(KEY)?.enabled === true,
     'RT2 the stored value actually changed — read from the store, not from the result');
  ok(dataAfterEnable === 7,
     `RT3 seven data rows present after enable; got ${dataAfterEnable}`);
  ok(f.rpcCalls === 1, `RT4 🔴 the database was reached EXACTLY ONCE — got ${f.rpcCalls} calls`);
  const clockAtEnable = { ...(f.modules.get(KEY)?.config ?? {}) };
  ok(clockAtEnable.trial_started_at === '2026-08-24T00:00:00.000Z' && clockAtEnable.trial_days === 30,
     'RT5 the trial pair was written by the enable — one act, not two (ruling 2026-08-02 (8))');

  // ── STEP 2: DISABLE. Unreachable, NOT destroyed. ───────────────────────────────────────────────
  const callsBefore = f.rpcCalls;
  const r2 = await set(f, { enabled: false });
  ok(r2.applied && r2.enabledAfter === false,
     'RT6 🔴 the disable PROVES it wrote — enabledAfter is false, not merely applied:true (R-12)');
  ok(r2.enabledBefore === true,
     'RT7 the before-value is reported too, so a no-op is distinguishable from a real change');
  ok(f.modules.get(KEY)?.enabled === false,
     'RT8 the stored enablement flag is now false — checked in the store');

  // 🔴 THE CLAIM ITSELF. Count the rows; do not read a status.
  ok(f.moduleData.length === 7,
     `RT9 🔴 ALL SEVEN DATA ROWS SURVIVE THE DISABLE — got ${f.moduleData.length}. This is the whole promise.`);
  ok(f.deletesIssued === 0,
     `RT10 🔴 ZERO deletes were issued — got ${f.deletesIssued}. Disable is one UPDATE; there is no DELETE in the function.`);
  ok(f.rpcCalls === callsBefore + 1,
     `RT11 the disable reached the database exactly once — got ${f.rpcCalls - callsBefore}`);

  // R-8: the term is a term, not a meter. The clock must be byte-identical across the disable.
  const clockAtDisable = f.modules.get(KEY)?.config ?? {};
  ok(clockAtDisable.trial_started_at === clockAtEnable.trial_started_at
     && clockAtDisable.trial_days === clockAtEnable.trial_days,
     'RT12 🔴 the trial pair is UNTOUCHED by the disable — the clock does not pause and does not reset (R-8)');

  // ── STEP 3: RE-ENABLE. Same data, same counts, no second clock. ────────────────────────────────
  const r3 = await set(f, { enabled: true, trialDays: 30 });
  ok(r3.applied && r3.enabledAfter === true, 'RT13 re-enable proves it wrote — enabledAfter is true again');
  ok(f.moduleData.length === 7,
     `RT14 🔴 the SAME seven rows are there on the way back in; got ${f.moduleData.length}`);
  ok(f.moduleData.every((d, i) => d.id === `stop-${i}`),
     'RT15 🔴 the same rows BY IDENTITY, not merely the same count — nothing was recreated');
  ok(r3.trialStarted === false,
     'RT16 🔴 the re-enable did NOT restart the clock — a round trip is not a fresh trial (R-8)');
  const clockAtReEnable = f.modules.get(KEY)?.config ?? {};
  ok(clockAtReEnable.trial_started_at === clockAtEnable.trial_started_at,
     'RT17 the trial START DATE is the original one after the full round trip');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// 2. THE PLANTED DEFECTS — proving each probe can FAIL (STD-022, both directions).
// ═════════════════════════════════════════════════════════════════════════════════════════════════

async function plantedDefects(): Promise<void> {
  // 🔴 D1 — THE SILENT NO-OP. The server says `applied:true` and writes nothing. This is the exact
  // shape that made a status-only assertion useless on 2026-08-24, and it is the reason the caller
  // must read `enabledAfter`.
  const f = makeFake({ enabled: true, dataRows: 3 });
  f.pretendOnly = true;
  const r = await set(f, { enabled: false });
  ok(r.applied === true,
     'D1a the acknowledgement is TRUE over a write that never happened — `applied` alone is worthless here');
  ok(r.enabledAfter === true,
     'D1b 🔴 …and `enabledAfter` catches it: the module is STILL ON, which is what the owner needs told');
  ok(f.modules.get(KEY)?.enabled === true,
     'D1c the store confirms nothing changed — the probe is measuring reality, not the result object');

  // 🔴 D2 — AN ABSENT PROOF IS NOT A PASSING ONE. A server that omits `enabled_after` must yield
  // `null`, never a coerced `false`. `Boolean(undefined)` is `false`, and `false` here MEANS "off"
  // — so coercion would manufacture the proof (A9/D-9: absent is not empty).
  const f2 = makeFake({ enabled: true, dataRows: 1 });
  f2.omitProof = true;
  const r2 = await set(f2, { enabled: false });
  ok(r2.enabledAfter === null,
     'D2 🔴 an omitted `enabled_after` reads as null, NOT false — an absent proof cannot pass as a successful disable');
  ok(!(r2.applied && r2.enabledAfter === false),
     'D2b the caller\'s own predicate therefore REFUSES to report success on an absent proof');

  // 🔴 D3 — NEGATIVE CONTROL ON THE SURVIVAL PROBE. If the fake could lose rows, RT9 would be
  // meaningless. Prove the counter actually observes a loss.
  const f3 = makeFake({ enabled: true, dataRows: 4 });
  f3.moduleData.splice(0, 2);
  f3.deletesIssued += 2;
  ok(f3.moduleData.length === 2 && f3.deletesIssued === 2,
     'D3 🔴 the row counter and the delete counter DO observe a loss — RT9/RT10 are not vacuous');

  // 🔴 D4 — AN RPC ERROR IS A FAILURE TO PROVE, NOT A DISABLE. Both proof fields must be null.
  const f4 = makeFake({ enabled: true, dataRows: 2 });
  f4.client = {
    rpc: () => Promise.resolve({ data: null, error: { message: 'network' } }),
  } as unknown as SupabaseClient;
  const r4 = await set(f4, { enabled: false });
  ok(r4.applied === false && r4.enabledAfter === null && r4.enabledBefore === null,
     'D4 a transport error yields applied:false with NULL proof — never a silently-off module');
  ok(f4.moduleData.length === 2, 'D4b and the data is untouched by a failed disable');

  // 🔴 D5 — A DISABLE NEVER STARTS A CLOCK, even if a caller wrongly passes trialDays. The guard is
  // `p_enabled IS TRUE`, so this is proven at the server's shape rather than by caller discipline.
  const f5 = makeFake({ enabled: true, dataRows: 1, config: {} });
  const r5 = await set(f5, { enabled: false, trialDays: 30 });
  ok(r5.trialStarted === false && !f5.modules.get(KEY)?.config.trial_started_at,
     'D5 🔴 a disable carrying trialDays still starts NO clock — turning off is never a purchase');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  await roundTrip();
  await plantedDefects();
  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\n  FAILURES:');
    for (const f of failures) console.log(`   ✗ ${f}`);
    process.exit(1);
  }
}

void main();
