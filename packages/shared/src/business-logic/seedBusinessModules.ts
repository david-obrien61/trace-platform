// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Seed one `business_modules` row per catalog module at business creation.
// DEPENDENCIES: the `seed_business_modules` RPC (20260801c), a SupabaseClient, and a caller-supplied
//               catalog (AC-1 — shared knows the MECHANISM, the vertical owns the module list).
// OUTPUTS:      seedBusinessModules(supabase, businessId, actorUserId, rows)
//
// 🔴 THE DEFECT THIS CLOSES IS THE SAME ONE `seedPricingConfig` CLOSED, ONE TABLE OVER — and this
// time the missing row is MONEY. Nothing in the codebase creates a `business_modules` row: the RPC
// header says so at 20260801:233 ("NOTHING in the codebase creates a business_modules row, so for
// most tenants this IS the create path"). Every tenant has therefore been running with an empty
// module table, which was survivable while the row only held "which social channels are on."
// **The moment the row holds a TRIAL CLOCK, no row means no clock, which means no conversion date,
// which means a customer who is never billed.**
//
// 🔴 AND THE FAILURE IS INVISIBLE, WHICH IS THE PART THAT MATTERS. `useModules.ts:104` reads
// `nmByKey[module_key] ?? null` and renders `available` for a MISSING row and for a disabled row
// IDENTICALLY. **An unseeded tenant looks exactly like a correctly-seeded tenant with everything
// switched off.** There is no screen anywhere that distinguishes them. That is D-9's shape — absent
// rendering as present-and-zero — sitting under the UI in the data layer.
//
// ── SO: NON-BLOCKING, BUT NEVER SILENT ──────────────────────────────────────────────────────────
// §6 r6 says an integration failure never blocks an order, and the same reasoning applies here —
// losing a business that ALREADY EXISTS because its module seed failed would be a far worse trade.
// But "non-blocking" plus "the clock lives in the row" is exactly how a tenant ends up unbilled, so
// this function is built to make a failure LOUD and CHEAP TO REPAIR rather than to make it rare:
//   1. It returns COUNTS, not a boolean. `seeded + existing !== expected` is a SHORT SEED and the
//      caller warns with the actual numbers. A partial seed and a total failure look different.
//   2. It is IDEMPOTENT server-side (`ON CONFLICT DO NOTHING`, and a clock that refuses to restart),
//      so re-running is always safe — which is what lets the repair path BE the create path.
//   3. It is called from BOTH creation paths, and the wizard call sits OUTSIDE the legacy-create
//      branch, so a signup-path failure self-heals when the owner finishes onboarding.
//   4. 🔴 RESIDUAL, OWED NOT CLAIMED: an owner who signs up and abandons onboarding, with the
//      signup call also failing, has no rows and nothing notices. The third home is the marketplace
//      screen's load (ITEM 3) — seed-if-absent on open. NOT BUILT. Until it is, the standing
//      detection query is 20260801c V6, and it is one `GROUP BY` over `business_modules`.
//
// ⚠️ CALL ORDER IS LOAD-BEARING: **after the owner's `business_members` row exists.** Authority
// lives entirely in `business_members` since 20260730c removed the owner branch, so a seed
// attempted before that INSERT is DENIED for the owner of the business he just created — and it
// would be denied quietly, into a console warning, on the one path where nobody is looking.
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One module's day-one row state. Structurally what `catalogSeedRows()` produces.
 *
 * 🔴 `trial_days` IS PART OF THE PAYLOAD BECAUSE THE TERM IS SNAPSHOTTED INTO THE ROW, NOT READ
 * LIVE FROM THE CATALOG (David's ruling 2026-08-01). Expiry is computed from the stored
 * `(trial_started_at, trial_days)` pair, so editing the catalog governs NEW trials only and cannot
 * retroactively expire a tenant mid-trial. **A tenant's terms are what they were given.** The
 * server refuses `start_trial: true` with a non-positive `trial_days` — there is deliberately no
 * default, because the correct number is exactly what nobody has ratified.
 *
 * 🔴 `enabled` MEANS THE MODULE WORKS RIGHT NOW, AND A TRIALLING MODULE IS ENABLED (David's ruling
 * 2026-08-02, correcting the spec this file shipped with). The superseded version seeded every
 * add-on `enabled: false` with a clock running over it — but `enabled` is a functional gate, not a
 * label (`api/social/generate-posts.ts` refuses on it), so the clock counted down on something
 * nobody could use. **The trial is the grace period during which the module is fully live; the
 * clock ENDS access rather than withholding it.** Expiry — flipping a lapsed trial back off — is
 * NOT built, and until it is, a trial that runs out keeps working.
 *
 * `configured` is separate from `enabled` and seeds with it: they mean different things and diverge
 * the moment a trial lapses (access goes, the owner's setup stays). Both are true for core and for
 * a running trial — there is nothing to configure about being included, and seeding `false` put an
 * `[ENABLE]` button on a working feature (the dead-affordance class).
 */
export interface ModuleSeedRow {
  module_key: string;
  enabled: boolean;
  configured: boolean;
  start_trial: boolean;
  trial_days: number;
}

export interface ModuleSeedResult {
  /** false = the server REFUSED (authority or a malformed catalog). `reason` says which. */
  applied: boolean;
  reason: string | null;
  /** How many rows the catalog asked for. */
  expected: number;
  /** Newly created. 0 on a re-run over a complete tenant — that is success, not a failure. */
  seeded: number;
  /** Already present and left untouched. */
  existing: number;
  trialsStarted: number;
  /** true when `seeded + existing !== expected` — rows the catalog asked for that are not there. */
  short: boolean;
  error: { message: string } | null;
}

const EMPTY = { expected: 0, seeded: 0, existing: 0, trialsStarted: 0 };

export async function seedBusinessModules(
  supabase: SupabaseClient,
  businessId: string,
  actorUserId: string | null,
  rows: ModuleSeedRow[],
): Promise<ModuleSeedResult> {
  // A caller with no catalog is a wiring bug, and it must not read as a successful seed of nothing.
  // The server refuses an empty array too; this is the same refusal without the round trip.
  if (!rows || rows.length === 0) {
    return { applied: false, reason: 'module catalog is empty — nothing to seed', ...EMPTY,
             short: true, error: null };
  }

  const { data, error } = await supabase.rpc('seed_business_modules', {
    p_business_id:   businessId,
    p_actor_user_id: actorUserId,
    p_modules:       rows,
  });

  if (error) {
    return { applied: false, reason: null, ...EMPTY, expected: rows.length, short: true,
             error: { message: error.message } };
  }

  // The RPC is `RETURNS TABLE(...)`, so PostgREST hands back an array of one row.
  const r = (Array.isArray(data) ? data[0] : data) as {
    applied?: boolean; reason?: string | null;
    expected?: number; seeded?: number; existing?: number; trials_started?: number;
  } | null;

  const expected      = Number(r?.expected ?? rows.length);
  const seeded        = Number(r?.seeded ?? 0);
  const existing      = Number(r?.existing ?? 0);
  const trialsStarted = Number(r?.trials_started ?? 0);
  const applied       = Boolean(r?.applied);
  const reason        = (r?.reason as string | null) ?? null;

  // 🔴 THE SHORT-SEED CHECK. This is the whole reason the RPC returns counts instead of a boolean:
  // `applied:true` only says the call was authorised and ran. It does NOT say every row landed. A
  // tenant missing three rows is missing three clocks, and nothing downstream would ever say so.
  const short = !applied || seeded + existing !== expected;

  console.log('[TRACE:MODULES] seed_business_modules', {
    businessId, applied, reason, expected, seeded, existing, trialsStarted, short,
  });

  return { applied, reason, expected, seeded, existing, trialsStarted, short, error: null };
}

/**
 * The one place that decides what a seed failure SOUNDS like, so both call sites say the same thing
 * (§6 r8 — the same operation lives in exactly one place). Returns nothing; it warns.
 *
 * Deliberately `console.warn`, not `console.error` and not a thrown exception: this is non-blocking
 * by ruling, and an exception here would lose a business that already exists.
 */
export function warnOnShortModuleSeed(where: string, businessId: string, res: ModuleSeedResult): void {
  if (!res.short) return;
  console.warn(
    `[TRACE:MODULES] ${where}: MODULE SEED INCOMPLETE — this tenant has no trial clock for the ` +
    `missing modules and NOTHING IN THE UI WILL SAY SO. Re-runnable: 20260801c V3/V6.`,
    {
      businessId,
      expected: res.expected, seeded: res.seeded, existing: res.existing,
      missing: Math.max(0, res.expected - res.seeded - res.existing),
      reason: res.reason, error: res.error?.message ?? null,
    },
  );
}
